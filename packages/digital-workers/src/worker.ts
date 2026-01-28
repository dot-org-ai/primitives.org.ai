/**
 * Worker Export - WorkerEntrypoint for RPC access to Digital Workers
 *
 * Exposes worker lifecycle management, messaging, and coordination via Cloudflare RPC.
 *
 * @example
 * ```typescript
 * // wrangler.jsonc
 * {
 *   "services": [
 *     { "binding": "DIGITAL_WORKERS", "service": "digital-workers" }
 *   ]
 * }
 *
 * // worker.ts - consuming service
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const service = env.DIGITAL_WORKERS.connect()
 *     const worker = await service.spawn({ name: 'my-worker' })
 *     return Response.json(worker)
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

import { WorkerEntrypoint, RpcTarget } from 'cloudflare:workers'

// =============================================================================
// Types
// =============================================================================

/**
 * Worker instance status
 */
type WorkerInstanceStatus = 'spawning' | 'running' | 'paused' | 'terminated' | 'error'

/**
 * Worker instance state
 */
interface WorkerInstance {
  id: string
  name: string
  status: WorkerInstanceStatus
  type: 'agent' | 'human'
  tier?: string | undefined
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, unknown> | undefined
}

/**
 * Message sent between workers
 */
interface WorkerMessage<T = unknown> {
  id: string
  from: string
  to: string
  type: string
  payload: T
  timestamp: Date
  acknowledged?: boolean
}

/**
 * Worker spawn options
 */
interface SpawnOptions {
  name?: string
  type?: 'agent' | 'human'
  tier?: string
  metadata?: Record<string, unknown>
  timeout?: number
}

/**
 * Receive options
 */
interface ReceiveOptions {
  type?: string
  limit?: number
  acknowledged?: boolean
}

/**
 * List options
 */
interface ListOptions {
  status?: WorkerInstanceStatus
  type?: 'agent' | 'human'
  tier?: string
  limit?: number
  includeTerminated?: boolean
}

/**
 * Set state options
 */
interface SetStateOptions {
  metadata?: Record<string, unknown>
}

/**
 * Broadcast result
 */
interface BroadcastResult {
  workerId: string
  success: boolean
  messageId?: string | undefined
  error?: string | undefined
}

/**
 * Coordination task
 */
interface CoordinationTask<T = unknown> {
  id: string
  type: 'fanout' | 'pipeline' | 'race' | 'consensus'
  workers: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: T | undefined
  errors?: Error[] | undefined
}

/**
 * Consensus options
 */
interface ConsensusOptions {
  quorum?: number
}

/**
 * Environment bindings
 */
export interface Env {
  AI?: unknown | undefined
  WORKER_STATE?: DurableObjectNamespace | undefined
}

// =============================================================================
// In-memory Storage (for standalone/test usage)
// =============================================================================

/**
 * Global in-memory storage for workers and messages
 */
const workerStore = new Map<string, WorkerInstance>()
const messageStore = new Map<string, WorkerMessage[]>() // workerId -> messages
const taskStore = new Map<string, CoordinationTask>()

/**
 * Generate a unique ID
 */
function generateId(): string {
  return crypto.randomUUID()
}

/**
 * Check if a JSON payload is serializable (no circular references)
 */
function isSerializable(obj: unknown): boolean {
  try {
    JSON.stringify(obj)
    return true
  } catch {
    return false
  }
}

// =============================================================================
// DigitalWorkersServiceCore (RpcTarget)
// =============================================================================

/**
 * Core digital workers service - extends RpcTarget for RPC communication
 *
 * Provides worker lifecycle management, messaging, and coordination.
 */
export class DigitalWorkersServiceCore extends RpcTarget {
  private env: Env

  constructor(env: Env = {}) {
    super()
    this.env = env
  }

  // ===========================================================================
  // Worker Lifecycle Management
  // ===========================================================================

  /**
   * Spawn a new worker instance
   */
  async spawn(options: SpawnOptions = {}): Promise<WorkerInstance> {
    const id = generateId()
    const now = new Date()

    const worker: WorkerInstance = {
      id,
      name: options.name ?? `worker-${id.slice(0, 8)}`,
      status: 'running',
      type: options.type ?? 'agent',
      tier: options.tier,
      createdAt: now,
      updatedAt: now,
      metadata: options.metadata,
    }

    workerStore.set(id, worker)
    messageStore.set(id, [])

    return worker
  }

  /**
   * Terminate a worker
   */
  async terminate(workerId: string): Promise<boolean> {
    const worker = workerStore.get(workerId)
    if (!worker) return false
    if (worker.status === 'terminated') return false

    worker.status = 'terminated'
    worker.updatedAt = new Date()
    return true
  }

  /**
   * Pause a worker
   */
  async pause(workerId: string): Promise<boolean> {
    const worker = workerStore.get(workerId)
    if (!worker) return false
    if (worker.status === 'terminated') return false

    worker.status = 'paused'
    worker.updatedAt = new Date()
    return true
  }

  /**
   * Resume a paused worker
   */
  async resume(workerId: string): Promise<boolean> {
    const worker = workerStore.get(workerId)
    if (!worker) return false
    if (worker.status === 'terminated') return false

    worker.status = 'running'
    worker.updatedAt = new Date()
    return true
  }

  // ===========================================================================
  // Worker Communication / Messaging
  // ===========================================================================

  /**
   * Send a message from one worker to another
   */
  async send<T = unknown>(
    fromId: string,
    toId: string,
    type: string,
    payload: T
  ): Promise<WorkerMessage<T>> {
    const sender = workerStore.get(fromId)
    const receiver = workerStore.get(toId)

    if (!sender) {
      throw new Error(`Sender worker "${fromId}" not found`)
    }
    if (!receiver) {
      throw new Error(`Receiver worker "${toId}" not found`)
    }
    if (sender.status === 'terminated') {
      throw new Error(`Cannot send from terminated worker "${fromId}"`)
    }
    if (receiver.status === 'terminated') {
      throw new Error(`Cannot send to terminated worker "${toId}"`)
    }

    // Check for circular references
    if (!isSerializable(payload)) {
      throw new Error('Payload contains circular references or is not serializable')
    }

    const message: WorkerMessage<T> = {
      id: generateId(),
      from: fromId,
      to: toId,
      type,
      payload,
      timestamp: new Date(),
      acknowledged: receiver.status === 'running',
    }

    const messages = messageStore.get(toId) ?? []
    messages.push(message as WorkerMessage)
    messageStore.set(toId, messages)

    return message
  }

  /**
   * Receive messages for a worker
   */
  async receive<T = unknown>(
    workerId: string,
    options: ReceiveOptions = {}
  ): Promise<WorkerMessage<T>[]> {
    const worker = workerStore.get(workerId)
    if (!worker) {
      throw new Error(`Worker "${workerId}" not found`)
    }

    let messages = (messageStore.get(workerId) ?? []) as WorkerMessage<T>[]

    // Filter by type if specified
    if (options.type) {
      messages = messages.filter((m) => m.type === options.type)
    }

    // Filter by acknowledged status if specified
    if (options.acknowledged !== undefined) {
      messages = messages.filter((m) => m.acknowledged === options.acknowledged)
    }

    // Apply limit if specified
    if (options.limit !== undefined && options.limit > 0) {
      messages = messages.slice(0, options.limit)
    }

    return messages
  }

  /**
   * Acknowledge a message
   */
  async acknowledge(workerId: string, messageId: string): Promise<boolean> {
    const worker = workerStore.get(workerId)
    if (!worker) {
      throw new Error(`Worker "${workerId}" not found`)
    }

    const messages = messageStore.get(workerId) ?? []
    const message = messages.find((m) => m.id === messageId)

    if (!message) return false

    message.acknowledged = true
    return true
  }

  /**
   * Broadcast a message to multiple workers
   */
  async broadcast<T = unknown>(
    fromId: string,
    toIds: string[],
    type: string,
    payload: T
  ): Promise<BroadcastResult[]> {
    if (toIds.length === 0) return []

    const results: BroadcastResult[] = []

    for (const toId of toIds) {
      try {
        const message = await this.send(fromId, toId, type, payload)
        results.push({
          workerId: toId,
          success: true,
          messageId: message.id,
        })
      } catch (error) {
        results.push({
          workerId: toId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return results
  }

  // ===========================================================================
  // Worker State Management
  // ===========================================================================

  /**
   * Get worker state
   */
  async getState(workerId: string): Promise<WorkerInstance | null> {
    if (!workerId) {
      throw new Error('Worker ID is required')
    }
    const worker = workerStore.get(workerId)
    if (!worker) return null

    // Return a copy to prevent mutation issues
    return {
      ...worker,
      createdAt: new Date(worker.createdAt.getTime()),
      updatedAt: new Date(worker.updatedAt.getTime()),
      metadata: worker.metadata ? { ...worker.metadata } : undefined,
    }
  }

  /**
   * Set worker state (update metadata)
   */
  async setState(workerId: string, options: SetStateOptions): Promise<void> {
    const worker = workerStore.get(workerId)
    if (!worker) {
      throw new Error(`Worker "${workerId}" not found`)
    }
    if (worker.status === 'terminated') {
      throw new Error(`Cannot update terminated worker "${workerId}"`)
    }

    // Merge metadata
    if (options.metadata) {
      worker.metadata = {
        ...(worker.metadata ?? {}),
        ...options.metadata,
      }
    }

    // Ensure updatedAt is always strictly greater than before
    const now = Date.now()
    const prevTime = worker.updatedAt.getTime()
    worker.updatedAt = new Date(Math.max(now, prevTime + 1))
  }

  /**
   * List workers with optional filtering
   */
  async list(options: ListOptions = {}): Promise<WorkerInstance[]> {
    let workers = Array.from(workerStore.values())

    // Exclude terminated by default
    if (!options.includeTerminated) {
      workers = workers.filter((w) => w.status !== 'terminated')
    }

    // Filter by status
    if (options.status) {
      workers = workers.filter((w) => w.status === options.status)
    }

    // Filter by type
    if (options.type) {
      workers = workers.filter((w) => w.type === options.type)
    }

    // Filter by tier
    if (options.tier) {
      workers = workers.filter((w) => w.tier === options.tier)
    }

    // Apply limit
    if (options.limit !== undefined && options.limit > 0) {
      workers = workers.slice(0, options.limit)
    }

    return workers
  }

  // ===========================================================================
  // Worker Coordination Patterns
  // ===========================================================================

  /**
   * Fan out work to multiple workers (parallel execution)
   */
  async fanOut<T = unknown>(
    coordinatorId: string,
    workerIds: string[],
    type: string,
    payload: T
  ): Promise<CoordinationTask<T>> {
    if (workerIds.length === 0) {
      throw new Error('At least one worker is required for fanOut')
    }

    const task: CoordinationTask<T> = {
      id: generateId(),
      type: 'fanout',
      workers: workerIds,
      status: 'running',
    }

    taskStore.set(task.id, task as CoordinationTask)

    // Send task to all workers
    await this.broadcast(coordinatorId, workerIds, type, payload)

    return task
  }

  /**
   * Create a sequential processing pipeline
   */
  async pipeline<T = unknown>(
    workerIds: string[],
    type: string,
    payload: T
  ): Promise<CoordinationTask<T>> {
    if (workerIds.length === 0) {
      throw new Error('At least one worker is required for pipeline')
    }

    const task: CoordinationTask<T> = {
      id: generateId(),
      type: 'pipeline',
      workers: workerIds,
      status: 'running',
    }

    taskStore.set(task.id, task as CoordinationTask)

    // Send initial data to first worker
    const firstWorkerId = workerIds[0]
    if (firstWorkerId) {
      const firstWorker = workerStore.get(firstWorkerId)

      if (firstWorker) {
        const message: WorkerMessage = {
          id: generateId(),
          from: 'system',
          to: firstWorkerId,
          type,
          payload,
          timestamp: new Date(),
          acknowledged: firstWorker.status === 'running',
        }

        const messages = messageStore.get(firstWorkerId) ?? []
        messages.push(message)
        messageStore.set(firstWorkerId, messages)
      }
    }

    return task
  }

  /**
   * Create a race (first to complete wins)
   */
  async race<T = unknown>(
    workerIds: string[],
    type: string,
    payload: T
  ): Promise<CoordinationTask<T>> {
    if (workerIds.length === 0) {
      throw new Error('At least one worker is required for race')
    }

    const task: CoordinationTask<T> = {
      id: generateId(),
      type: 'race',
      workers: workerIds,
      status: 'running',
    }

    taskStore.set(task.id, task as CoordinationTask)

    // Send same task to all workers
    for (const workerId of workerIds) {
      const worker = workerStore.get(workerId)
      if (worker) {
        const message: WorkerMessage = {
          id: generateId(),
          from: 'system',
          to: workerId,
          type,
          payload,
          timestamp: new Date(),
          acknowledged: worker.status === 'running',
        }

        const messages = messageStore.get(workerId) ?? []
        messages.push(message)
        messageStore.set(workerId, messages)
      }
    }

    return task
  }

  /**
   * Create a consensus task (all must agree)
   */
  async consensus<T = unknown>(
    workerIds: string[],
    type: string,
    payload: T,
    options: ConsensusOptions = {}
  ): Promise<CoordinationTask<T>> {
    if (workerIds.length === 0) {
      throw new Error('At least one worker is required for consensus')
    }

    const task: CoordinationTask<T> = {
      id: generateId(),
      type: 'consensus',
      workers: workerIds,
      status: 'running',
    }

    taskStore.set(task.id, task as CoordinationTask)

    // Send proposal to all workers
    for (const workerId of workerIds) {
      const worker = workerStore.get(workerId)
      if (worker) {
        const message: WorkerMessage = {
          id: generateId(),
          from: 'system',
          to: workerId,
          type,
          payload,
          timestamp: new Date(),
          acknowledged: worker.status === 'running',
        }

        const messages = messageStore.get(workerId) ?? []
        messages.push(message)
        messageStore.set(workerId, messages)
      }
    }

    return task
  }

  /**
   * Get coordination task status
   */
  async getTaskStatus<T = unknown>(taskId: string): Promise<CoordinationTask<T> | null> {
    return (taskStore.get(taskId) as CoordinationTask<T>) ?? null
  }
}

// =============================================================================
// DigitalWorkersService (WorkerEntrypoint)
// =============================================================================

/**
 * Digital Workers Service - WorkerEntrypoint for RPC access
 *
 * Provides `connect()` method that returns an RpcTarget service
 * with all worker management methods.
 *
 * @example
 * ```typescript
 * // In consuming worker
 * const workers = env.DIGITAL_WORKERS.connect()
 * const worker = await workers.spawn({ name: 'my-agent' })
 * await workers.send(worker.id, otherWorkerId, 'task', { data: 'hello' })
 * ```
 */
export class DigitalWorkersService extends WorkerEntrypoint<Env> {
  /**
   * Connect to the digital workers service
   *
   * @returns DigitalWorkersServiceCore instance for RPC calls
   */
  connect(): DigitalWorkersServiceCore {
    return new DigitalWorkersServiceCore(this.env)
  }
}

/**
 * Default export for Cloudflare Workers
 */
export default DigitalWorkersService
