/**
 * Miniflare instance pool for improved performance
 *
 * Reuses Miniflare instances between evaluations instead of creating/disposing
 * for each evaluation, providing 4-5x performance improvement.
 *
 * Uses Miniflare's setOptions() to update the worker script between uses,
 * avoiding the expensive instance creation/teardown cycle.
 */

import type {
  Miniflare as MiniflareType,
  MiniflareOptions as MiniflareOptionsType,
} from 'miniflare'

/**
 * Pool configuration options
 */
export interface PoolConfig {
  /** Number of instances to maintain in the pool (default: 3) */
  size?: number
  /** Milliseconds before disposing idle instance (default: 30000) */
  maxIdleTime?: number
}

/**
 * Outbound service handler type for network control
 * - () => never: Block all network access (throw error)
 * - (request: Request) => Response | Promise<Response>: Custom handler (allowlist, proxy, etc.)
 */
export type OutboundServiceHandler =
  | (() => never)
  | ((request: Request) => Response | Promise<Response>)

/**
 * Options for updating a pooled instance's worker
 */
export interface WorkerOptions {
  script: string
  compatibilityDate?: string
  outboundService?: OutboundServiceHandler
}

/**
 * A pooled Miniflare instance with metadata
 */
interface PooledInstance {
  instance: MiniflareType
  inUse: boolean
  lastUsed: number
  createdAt: number
}

// Type for the Miniflare constructor
type MiniflareConstructor = new (config: MiniflareOptionsType) => MiniflareType

/**
 * Global pool state (singleton per process)
 */
let pool: PooledInstance[] = []
let poolConfig: Required<PoolConfig> = {
  size: 3,
  maxIdleTime: 30000,
}
let idleCleanupInterval: NodeJS.Timeout | null = null
let MiniflareClass: MiniflareConstructor | null = null
let isShuttingDown = false

// Default worker script for warm instances
const WARM_WORKER_SCRIPT = `
export default {
  async fetch(request, env) {
    return new Response('ready', { status: 200 });
  }
};
`

/**
 * Configure the Miniflare pool
 *
 * @example
 * ```ts
 * import { configurePool } from 'ai-evaluate/node'
 *
 * configurePool({
 *   size: 5,        // Keep 5 warm instances
 *   maxIdleTime: 60000  // Dispose after 60s idle
 * })
 * ```
 */
export function configurePool(config: PoolConfig): void {
  poolConfig = {
    size: config.size ?? poolConfig.size,
    maxIdleTime: config.maxIdleTime ?? poolConfig.maxIdleTime,
  }
  startIdleCleanup()
}

/**
 * Get the current pool configuration
 */
export function getPoolConfig(): Required<PoolConfig> {
  return { ...poolConfig }
}

/**
 * Get pool statistics for monitoring
 */
export function getPoolStats(): {
  size: number
  available: number
  inUse: number
  config: Required<PoolConfig>
} {
  const available = pool.filter((p) => !p.inUse).length
  return {
    size: pool.length,
    available,
    inUse: pool.length - available,
    config: { ...poolConfig },
  }
}

/**
 * Initialize the Miniflare class (lazy load)
 */
async function getMiniflareClass(): Promise<MiniflareConstructor> {
  if (!MiniflareClass) {
    const { Miniflare } = await import('miniflare')
    MiniflareClass = Miniflare as MiniflareConstructor
  }
  return MiniflareClass
}

/**
 * Create a new Miniflare instance with a warm worker
 */
async function createInstance(): Promise<MiniflareType> {
  const Miniflare = await getMiniflareClass()
  return new Miniflare({
    modules: true,
    script: WARM_WORKER_SCRIPT,
    compatibilityDate: '2026-01-01',
  })
}

/**
 * Start the idle cleanup interval
 */
function startIdleCleanup(): void {
  if (idleCleanupInterval) {
    clearInterval(idleCleanupInterval)
  }

  idleCleanupInterval = setInterval(async () => {
    if (isShuttingDown) return

    const now = Date.now()
    const toDispose: PooledInstance[] = []

    // Find idle instances beyond the idle timeout
    for (let i = pool.length - 1; i >= 0; i--) {
      const item = pool[i]
      if (item && !item.inUse && now - item.lastUsed > poolConfig.maxIdleTime) {
        // Keep at least one warm instance
        if (pool.filter((p) => !p.inUse && !toDispose.includes(p)).length > 1) {
          toDispose.push(item)
          pool.splice(i, 1)
        }
      }
    }

    // Dispose old instances
    for (const item of toDispose) {
      try {
        await item.instance.dispose()
      } catch {
        // Ignore disposal errors
      }
    }
  }, 5000) // Check every 5 seconds

  // Don't keep the process alive just for cleanup
  if (idleCleanupInterval.unref) {
    idleCleanupInterval.unref()
  }
}

/**
 * Acquire a Miniflare instance from the pool and configure it with a worker
 *
 * If a free instance is available, it will be reconfigured and returned.
 * Otherwise, a new instance will be created (up to pool size limit).
 * If pool is exhausted, creates a temporary instance.
 *
 * @param workerOptions - Configuration for the worker to run
 * @returns Object with the configured instance and a release function
 */
export async function acquireInstance(workerOptions: WorkerOptions): Promise<{
  instance: MiniflareType
  release: () => Promise<void>
  isPooled: boolean
}> {
  if (isShuttingDown) {
    throw new Error('Pool is shutting down')
  }

  // Start idle cleanup if not started
  if (!idleCleanupInterval) {
    startIdleCleanup()
  }

  const { script, compatibilityDate = '2026-01-01', outboundService } = workerOptions

  // Build the options for setOptions
  const updateOptions: MiniflareOptionsType = {
    modules: true,
    script,
    compatibilityDate,
  }

  // Only add outboundService if it's defined (for blocking network)
  if (outboundService !== undefined) {
    updateOptions.outboundService = outboundService
  }

  // Try to find an available instance
  const available = pool.find((p) => !p.inUse)
  if (available) {
    available.inUse = true
    // Reconfigure the instance with the new worker script
    await available.instance.setOptions(updateOptions)
    return {
      instance: available.instance,
      release: async () => {
        available.inUse = false
        available.lastUsed = Date.now()
      },
      isPooled: true,
    }
  }

  // Create new instance if pool not full
  if (pool.length < poolConfig.size) {
    const Miniflare = await getMiniflareClass()
    const instance = new Miniflare(updateOptions)
    const pooled: PooledInstance = {
      instance,
      inUse: true,
      lastUsed: Date.now(),
      createdAt: Date.now(),
    }
    pool.push(pooled)
    return {
      instance,
      release: async () => {
        pooled.inUse = false
        pooled.lastUsed = Date.now()
      },
      isPooled: true,
    }
  }

  // Pool exhausted - create temporary instance
  const Miniflare = await getMiniflareClass()
  const tempInstance = new Miniflare(updateOptions)
  return {
    instance: tempInstance,
    release: async () => {
      // Dispose temporary instance immediately
      await tempInstance.dispose()
    },
    isPooled: false,
  }
}

/**
 * Pre-warm the pool with instances
 *
 * Call this at application startup to avoid cold start latency.
 *
 * @example
 * ```ts
 * import { warmPool } from 'ai-evaluate/node'
 *
 * // Pre-warm 3 instances at startup
 * await warmPool(3)
 * ```
 */
export async function warmPool(count?: number): Promise<void> {
  const targetCount = count ?? poolConfig.size
  const toCreate = Math.max(0, targetCount - pool.length)

  const promises: Promise<void>[] = []
  for (let i = 0; i < toCreate; i++) {
    promises.push(
      (async () => {
        const instance = await createInstance()
        pool.push({
          instance,
          inUse: false,
          lastUsed: Date.now(),
          createdAt: Date.now(),
        })
      })()
    )
  }

  await Promise.all(promises)

  // Start idle cleanup if not already started
  if (!idleCleanupInterval) {
    startIdleCleanup()
  }
}

/**
 * Dispose all instances and clean up the pool
 *
 * Call this before process exit to ensure clean shutdown.
 *
 * @example
 * ```ts
 * import { disposePool } from 'ai-evaluate/node'
 *
 * process.on('beforeExit', async () => {
 *   await disposePool()
 * })
 * ```
 */
export async function disposePool(): Promise<void> {
  isShuttingDown = true

  if (idleCleanupInterval) {
    clearInterval(idleCleanupInterval)
    idleCleanupInterval = null
  }

  const instances = [...pool]
  pool = []

  await Promise.all(
    instances.map(async (item) => {
      try {
        await item.instance.dispose()
      } catch {
        // Ignore disposal errors
      }
    })
  )

  isShuttingDown = false
}

/**
 * Reset the pool (for testing purposes)
 */
export async function resetPool(): Promise<void> {
  await disposePool()
  poolConfig = {
    size: 3,
    maxIdleTime: 30000,
  }
  MiniflareClass = null
}

// Register cleanup on process exit
if (typeof process !== 'undefined') {
  const cleanup = () => {
    isShuttingDown = true
    if (idleCleanupInterval) {
      clearInterval(idleCleanupInterval)
    }
    // Synchronous disposal attempt - best effort
    for (const item of pool) {
      try {
        // Fire and forget - we're exiting anyway
        item.instance.dispose().catch(() => {})
      } catch {
        // Ignore errors during shutdown
      }
    }
    pool = []
  }

  process.on('exit', cleanup)
  process.on('SIGINT', () => {
    cleanup()
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    cleanup()
    process.exit(0)
  })
}
