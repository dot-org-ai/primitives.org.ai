/**
 * Database Provider Interface and Resolution
 *
 * Contains the DBProvider interface and provider resolution logic.
 *
 * @packageDocumentation
 */

import type {
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
  DBEvent,
  DBAction,
  DBArtifact,
  CreateEventOptions,
  CreateActionOptions,
  EmbeddingsConfig,
} from './types.js'
import { setProviderResolver } from '../ai-promise-db.js'

// =============================================================================
// Transaction Types
// =============================================================================

/**
 * A transaction wraps get/put/delete operations and applies them atomically.
 *
 * Writes are buffered until commit() is called. On rollback(), all buffered
 * writes are discarded. Reading within a transaction sees buffered writes.
 */
export interface Transaction {
  /** Get an entity (reads buffered writes first, then falls through to provider) */
  get(type: string, id: string): Promise<Record<string, unknown> | null>

  /** Create an entity (buffered until commit) */
  create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>>

  /** Update an entity (buffered until commit) */
  update(type: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>

  /** Delete an entity (buffered until commit) */
  delete(type: string, id: string): Promise<boolean>

  /** Create a relationship (buffered until commit) */
  relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string,
    metadata?: { matchMode?: 'exact' | 'fuzzy'; similarity?: number; matchedType?: string }
  ): Promise<void>

  /** Apply all buffered writes atomically */
  commit(): Promise<void>

  /** Discard all buffered writes */
  rollback(): Promise<void>
}

// =============================================================================
// Provider Interfaces
// =============================================================================

/**
 * Semantic search result with score
 */
export interface SemanticSearchResult {
  $id: string
  $type: string
  $score: number
  [key: string]: unknown
}

/**
 * Hybrid search result with RRF and component scores
 */
export interface HybridSearchResult extends SemanticSearchResult {
  $rrfScore: number
  $ftsRank: number
  $semanticRank: number
}

/**
 * Database provider interface that adapters must implement
 */
export interface DBProvider {
  /** Get an entity */
  get(type: string, id: string): Promise<Record<string, unknown> | null>

  /** List entities */
  list(type: string, options?: ListOptions): Promise<Record<string, unknown>[]>

  /** Search entities */
  search(type: string, query: string, options?: SearchOptions): Promise<Record<string, unknown>[]>

  /** Create an entity */
  create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>>

  /** Update an entity */
  update(type: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>

  /** Delete an entity */
  delete(type: string, id: string): Promise<boolean>

  /** Get related entities */
  related(type: string, id: string, relation: string): Promise<Record<string, unknown>[]>

  /** Create a relationship */
  relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string,
    metadata?: { matchMode?: 'exact' | 'fuzzy'; similarity?: number; matchedType?: string }
  ): Promise<void>

  /** Remove a relationship */
  unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void>

  /** Begin a transaction (optional - not all providers support this) */
  beginTransaction?(): Promise<Transaction>
}

/**
 * Extended provider interface with semantic search, events, actions, and artifacts
 *
 * Providers that support advanced features implement this interface.
 * Use type guards like `'semanticSearch' in provider` to check for support.
 */
export interface DBProviderExtended extends DBProvider {
  /** Configure embeddings for auto-generation */
  setEmbeddingsConfig(config: EmbeddingsConfig): void

  /** Semantic search using vector similarity */
  semanticSearch(
    type: string,
    query: string,
    options?: SemanticSearchOptions
  ): Promise<SemanticSearchResult[]>

  /** Hybrid search combining FTS and semantic */
  hybridSearch(
    type: string,
    query: string,
    options?: HybridSearchOptions
  ): Promise<HybridSearchResult[]>

  // Events API
  /** Subscribe to events matching a pattern */
  on(pattern: string, handler: (event: DBEvent) => void | Promise<void>): () => void
  /** Emit an event */
  emit(options: CreateEventOptions): Promise<DBEvent>
  emit(type: string, data: unknown): Promise<DBEvent>
  /** List events */
  listEvents(options?: {
    event?: string
    actor?: string
    object?: string
    since?: Date
    until?: Date
    limit?: number
  }): Promise<DBEvent[]>
  /** Replay events through a handler */
  replayEvents(options: {
    event?: string
    actor?: string
    since?: Date
    handler: (event: DBEvent) => void | Promise<void>
  }): Promise<void>

  // Actions API
  /** Create a new action */
  createAction(
    options: CreateActionOptions | { type: string; data: unknown; total?: number }
  ): Promise<DBAction>
  /** Get an action by ID */
  getAction(id: string): Promise<DBAction | null>
  /** Update an action */
  updateAction(
    id: string,
    updates: Partial<Pick<DBAction, 'status' | 'progress' | 'result' | 'error'>>
  ): Promise<DBAction>
  /** List actions */
  listActions(options?: {
    status?: DBAction['status']
    action?: string
    actor?: string
    object?: string
    since?: Date
    until?: Date
    limit?: number
  }): Promise<DBAction[]>
  /** Retry a failed action */
  retryAction(id: string): Promise<DBAction>
  /** Cancel an action */
  cancelAction(id: string): Promise<void>

  // Artifacts API
  /** Get an artifact */
  getArtifact(url: string, type: string): Promise<DBArtifact | null>
  /** Set an artifact */
  setArtifact(
    url: string,
    type: string,
    data: { content: unknown; sourceHash: string; metadata?: Record<string, unknown> }
  ): Promise<void>
  /** Delete an artifact */
  deleteArtifact(url: string, type?: string): Promise<void>
  /** List artifacts for a URL */
  listArtifacts(url: string): Promise<DBArtifact[]>
}

/**
 * Type guard to check if provider has semantic search
 */
export function hasSemanticSearch(
  provider: DBProvider
): provider is DBProvider & Pick<DBProviderExtended, 'semanticSearch'> {
  return 'semanticSearch' in provider
}

/**
 * Type guard to check if provider has hybrid search
 */
export function hasHybridSearch(
  provider: DBProvider
): provider is DBProvider & Pick<DBProviderExtended, 'hybridSearch'> {
  return 'hybridSearch' in provider
}

/**
 * Type guard to check if provider has events API
 */
export function hasEventsAPI(
  provider: DBProvider
): provider is DBProvider &
  Pick<DBProviderExtended, 'on' | 'emit' | 'listEvents' | 'replayEvents'> {
  return 'on' in provider && 'emit' in provider
}

/**
 * Type guard to check if provider has actions API
 */
export function hasActionsAPI(
  provider: DBProvider
): provider is DBProvider &
  Pick<
    DBProviderExtended,
    'createAction' | 'getAction' | 'updateAction' | 'listActions' | 'retryAction' | 'cancelAction'
  > {
  return 'createAction' in provider && 'getAction' in provider
}

/**
 * Type guard to check if provider has artifacts API
 */
export function hasArtifactsAPI(
  provider: DBProvider
): provider is DBProvider &
  Pick<DBProviderExtended, 'getArtifact' | 'setArtifact' | 'deleteArtifact' | 'listArtifacts'> {
  return 'getArtifact' in provider && 'setArtifact' in provider
}

/**
 * Type guard to check if provider supports transactions
 */
export function hasTransactionSupport(
  provider: DBProvider
): provider is DBProvider & { beginTransaction(): Promise<Transaction> } {
  return 'beginTransaction' in provider && typeof (provider as any).beginTransaction === 'function'
}

/**
 * Type guard to check if provider has embeddings config
 */
export function hasEmbeddingsConfig(
  provider: DBProvider
): provider is DBProvider & Pick<DBProviderExtended, 'setEmbeddingsConfig'> {
  return 'setEmbeddingsConfig' in provider
}

// =============================================================================
// Provider Resolution
// =============================================================================

let globalProvider: DBProvider | null = null
let providerPromise: Promise<DBProvider> | null = null

/** File count threshold for suggesting ClickHouse upgrade */
const FILE_COUNT_THRESHOLD = 10_000

/**
 * Set the global database provider
 */
export function setProvider(provider: DBProvider): void {
  globalProvider = provider
  providerPromise = null
  // Also update the ai-promise-db module's provider resolver
  setProviderResolver(() => Promise.resolve(provider))
}

/**
 * Parsed DATABASE_URL
 */
interface ParsedDatabaseUrl {
  provider: 'fs' | 'sqlite' | 'clickhouse' | 'memory'
  /** Content root directory */
  root: string
  /** Remote URL for Turso/ClickHouse HTTP */
  remoteUrl?: string
}

/**
 * Parse DATABASE_URL into provider type and paths
 *
 * Local storage (all use .db/ folder):
 * - `./content` => fs (default)
 * - `sqlite://./content` => sqlite stored in ./content/.db/index.sqlite
 * - `chdb://./content` => clickhouse stored in ./content/.db/clickhouse/
 *
 * Remote:
 * - `libsql://your-db.turso.io` => Turso SQLite
 * - `clickhouse://host:8123` => ClickHouse HTTP
 * - `:memory:` => in-memory
 */
function parseDatabaseUrl(url: string): ParsedDatabaseUrl {
  if (!url) return { provider: 'fs', root: './content' }

  // In-memory
  if (url === ':memory:') {
    return { provider: 'memory', root: '' }
  }

  // Remote Turso
  if (url.startsWith('libsql://') || url.includes('.turso.io')) {
    return { provider: 'sqlite', root: '', remoteUrl: url }
  }

  // Remote ClickHouse
  if (url.startsWith('clickhouse://') && url.includes(':')) {
    // clickhouse://host:port/db
    return { provider: 'clickhouse', root: '', remoteUrl: url.replace('clickhouse://', 'https://') }
  }

  // Local SQLite: sqlite://./content => ./content/.db/index.sqlite
  if (url.startsWith('sqlite://')) {
    const root = url.replace('sqlite://', '') || './content'
    return { provider: 'sqlite', root }
  }

  // Local ClickHouse (chDB): chdb://./content => ./content/.db/clickhouse/
  if (url.startsWith('chdb://')) {
    const root = url.replace('chdb://', '') || './content'
    return { provider: 'clickhouse', root }
  }

  // Default: filesystem
  return { provider: 'fs', root: url }
}

/**
 * Resolve provider from DATABASE_URL environment variable
 *
 * @example
 * ```bash
 * # Filesystem (default) - stores in ./content with .db/ metadata
 * DATABASE_URL=./content
 *
 * # Local SQLite - stores in ./content/.db/index.sqlite
 * DATABASE_URL=sqlite://./content
 *
 * # Remote Turso
 * DATABASE_URL=libsql://your-db.turso.io
 *
 * # Local ClickHouse (chDB) - stores in ./content/.db/clickhouse/
 * DATABASE_URL=chdb://./content
 *
 * # Remote ClickHouse
 * DATABASE_URL=clickhouse://localhost:8123
 *
 * # In-memory (testing)
 * DATABASE_URL=:memory:
 * ```
 */
export async function resolveProvider(): Promise<DBProvider> {
  if (globalProvider) return globalProvider

  if (providerPromise) return providerPromise

  providerPromise = (async () => {
    const databaseUrl =
      (typeof process !== 'undefined' && process.env?.['DATABASE_URL']) || './content'

    const parsed = parseDatabaseUrl(databaseUrl)

    switch (parsed.provider) {
      case 'memory': {
        const { createMemoryProvider } = await import('../memory-provider.js')
        globalProvider = createMemoryProvider()
        break
      }

      case 'fs': {
        try {
          // `as any` cast required: @mdxdb/fs is an optional external package
          // that may or may not have TypeScript declarations available
          const { createFsProvider } = await import('@mdxdb/fs' as any)
          globalProvider = createFsProvider({ root: parsed.root })

          // Check file count and warn if approaching threshold
          checkFileCountThreshold(parsed.root)
        } catch (err) {
          console.warn('@mdxdb/fs not available, falling back to memory provider')
          const { createMemoryProvider } = await import('../memory-provider.js')
          globalProvider = createMemoryProvider()
        }
        break
      }

      case 'sqlite': {
        try {
          // `as any` cast required: @mdxdb/sqlite is an optional external package
          // that may or may not have TypeScript declarations available
          const { createSqliteProvider } = await import('@mdxdb/sqlite' as any)

          if (parsed.remoteUrl) {
            // Remote Turso
            globalProvider = await createSqliteProvider({ url: parsed.remoteUrl })
          } else {
            // Local SQLite in .db folder
            const dbPath = `${parsed.root}/.db/index.sqlite`
            globalProvider = await createSqliteProvider({ url: `file:${dbPath}` })
          }
        } catch (err) {
          console.warn('@mdxdb/sqlite not available, falling back to memory provider')
          const { createMemoryProvider } = await import('../memory-provider.js')
          globalProvider = createMemoryProvider()
        }
        break
      }

      case 'clickhouse': {
        try {
          // `as any` cast required: @mdxdb/clickhouse is an optional external package
          // that may or may not have TypeScript declarations available
          const { createClickhouseProvider } = await import('@mdxdb/clickhouse' as any)

          if (parsed.remoteUrl) {
            // Remote ClickHouse
            globalProvider = await createClickhouseProvider({
              mode: 'http',
              url: parsed.remoteUrl,
            })
          } else {
            // Local chDB in .db folder
            const dbPath = `${parsed.root}/.db/clickhouse`
            globalProvider = await createClickhouseProvider({
              mode: 'chdb',
              url: dbPath,
            })
          }
        } catch (err) {
          console.warn('@mdxdb/clickhouse not available, falling back to memory provider')
          const { createMemoryProvider } = await import('../memory-provider.js')
          globalProvider = createMemoryProvider()
        }
        break
      }

      default: {
        const { createMemoryProvider } = await import('../memory-provider.js')
        globalProvider = createMemoryProvider()
      }
    }

    // Update the ai-promise-db module's provider resolver
    if (globalProvider) {
      setProviderResolver(() => Promise.resolve(globalProvider!))
    }

    return globalProvider!
  })()

  return providerPromise
}

/**
 * Check file count and warn if approaching threshold
 */
async function checkFileCountThreshold(root: string): Promise<void> {
  try {
    const fs = await import('node:fs/promises')
    const path = await import('node:path')

    async function countFiles(dir: string): Promise<number> {
      let count = 0
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue
          if (entry.isDirectory()) {
            count += await countFiles(path.join(dir, entry.name))
          } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
            count++
          }
        }
      } catch {
        // Directory doesn't exist yet
      }
      return count
    }

    const count = await countFiles(root)
    if (count > FILE_COUNT_THRESHOLD) {
      console.warn(
        `\n  You have ${count.toLocaleString()} MDX files. ` +
          `Consider upgrading to ClickHouse for better performance:\n` +
          `   DATABASE_URL=chdb://./data/clickhouse\n`
      )
    }
  } catch {
    // Ignore errors in file counting
  }
}
