/**
 * cacheMiddleware — content-addressable cache for `wrapLanguageModel`
 *
 * Implements the AI SDK cookbook's local-caching-middleware pattern
 * (https://ai-sdk.dev/cookbook/node/local-caching-middleware) on top of the
 * AI SDK 6 `LanguageModelV3Middleware` shape:
 *
 * - **Hit derivation:** content-hash of `{ prompt, modelId, responseFormat }`
 *   so a schema change (responseFormat.type === 'json' carries a `schema`
 *   JSONSchema7) invalidates the entry. Generation parameters (temperature,
 *   topP, etc.) are deliberately *not* part of the key for the eval-fixture
 *   use case — flipping temperature shouldn't blow up a 5x verify-time win.
 *   Callers who want strict keying should pass a custom `keyHash`.
 *
 * - **Stream support:** cached entries store the `LanguageModelV3StreamPart[]`
 *   array; `wrapStream` replays them via `simulateReadableStream` so consumers
 *   see the same chunked event sequence on a hit. (`wrapGenerate` is the
 *   common path; both share the same cache map.)
 *
 * - **TTL:** 24h default, configurable via `ttlMs`. Entries past TTL are
 *   evicted on access (lazy expiry — no background timer).
 *
 * - **Pluggable store:** in-memory default (Map-backed); `'disk'` writes to
 *   a JSON file at `.cache/v3-eval-cache.json` for cross-process fixture
 *   sharing. Disk reads/writes are best-effort — IO failures fall through
 *   to the wrapped model.
 *
 * - **Env gate:** honors `process.env.V3_EVAL_CACHE`. When unset/empty, the
 *   middleware short-circuits to a passthrough — useful for production where
 *   cache hits would be incorrect but the operator wants the same wrap chain.
 *   Set to `'1'` (or any truthy non-empty string) to enable.
 *
 * @packageDocumentation
 */

import { simulateReadableStream } from 'ai'
import type {
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3Middleware,
  LanguageModelV3StreamPart,
  LanguageModelV3StreamResult,
} from '@ai-sdk/provider'
import { hashKey } from '../cache.js'

// ============================================================================
// Types
// ============================================================================

/** Cached payload — both generate result and stream chunks under one key. */
interface CacheEntry {
  /** Result captured from `doGenerate`. Absent if the entry came from a stream call. */
  generateResult?: LanguageModelV3GenerateResult
  /** Stream chunks captured from `doStream` (replayed via simulateReadableStream). */
  streamChunks?: LanguageModelV3StreamPart[]
  /** Insert epoch ms — drives TTL eviction. */
  createdAt: number
}

/** Pluggable cache store for cached LLM results. */
export interface CacheMiddlewareStore {
  get(key: string): CacheEntry | undefined
  set(key: string, value: CacheEntry): void
  delete(key: string): void
}

/** Options for {@link cacheMiddleware}. */
export interface CacheMiddlewareOptions {
  /**
   * Cache backend. `'memory'` uses a process-local Map; `'disk'` writes to
   * `.cache/v3-eval-cache.json` for cross-process fixture sharing. A custom
   * {@link CacheMiddlewareStore} can be passed instead.
   *
   * @default 'memory'
   */
  store?: 'memory' | 'disk' | CacheMiddlewareStore
  /**
   * TTL in milliseconds. Entries older than `ttlMs` are evicted on access.
   *
   * @default 86_400_000 (24h)
   */
  ttlMs?: number
  /**
   * Custom hash function for cache keys. Defaults to a stable hash of
   * `{ prompt, modelId, responseFormat }`.
   */
  keyHash?: (params: LanguageModelV3CallOptions, modelId: string) => string
  /**
   * Optional override for the env gate. When `false`, the middleware acts
   * as a passthrough regardless of `V3_EVAL_CACHE`. When `true`, always
   * caches. Defaults to `process.env.V3_EVAL_CACHE` truthy-check.
   */
  enabled?: boolean
  /** Optional custom path for the disk store (defaults to `.cache/v3-eval-cache.json`). */
  diskPath?: string
}

// ============================================================================
// Stores
// ============================================================================

class MemoryStore implements CacheMiddlewareStore {
  private readonly map: Map<string, CacheEntry> = new Map()
  get(key: string): CacheEntry | undefined {
    return this.map.get(key)
  }
  set(key: string, value: CacheEntry): void {
    this.map.set(key, value)
  }
  delete(key: string): void {
    this.map.delete(key)
  }
}

/**
 * Disk-backed store. Best-effort — JSON parse / write errors fall through
 * silently so a corrupt cache file never blocks an LLM call. The whole map
 * is rewritten on each `set` (cheap for the eval-fixture use case which is
 * dominated by reads).
 */
class DiskStore implements CacheMiddlewareStore {
  private readonly path: string
  private cache: Map<string, CacheEntry> | null = null

  constructor(path: string) {
    this.path = path
  }

  private load(): Map<string, CacheEntry> {
    if (this.cache !== null) return this.cache
    this.cache = new Map()
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as typeof import('fs')
      if (fs.existsSync(this.path)) {
        const raw = fs.readFileSync(this.path, 'utf-8')
        const parsed = JSON.parse(raw) as Record<string, CacheEntry>
        for (const [k, v] of Object.entries(parsed)) {
          this.cache.set(k, v)
        }
      }
    } catch {
      // best-effort
    }
    return this.cache
  }

  private flush(): void {
    if (this.cache === null) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as typeof import('fs')
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require('path') as typeof import('path')
      const dir = path.dirname(this.path)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const obj = Object.fromEntries(this.cache)
      fs.writeFileSync(this.path, JSON.stringify(obj), 'utf-8')
    } catch {
      // best-effort
    }
  }

  get(key: string): CacheEntry | undefined {
    return this.load().get(key)
  }

  set(key: string, value: CacheEntry): void {
    this.load().set(key, value)
    this.flush()
  }

  delete(key: string): void {
    this.load().delete(key)
    this.flush()
  }
}

// ============================================================================
// Helpers
// ============================================================================

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

function defaultKeyHash(params: LanguageModelV3CallOptions, modelId: string): string {
  // Stable hash of prompt + model + responseFormat (which carries the
  // schema for object generation). Generation knobs are deliberately
  // excluded so the eval-fixture cache survives temperature tweaks.
  return hashKey({
    prompt: params.prompt,
    modelId,
    responseFormat: params.responseFormat,
  })
}

function envGateEnabled(): boolean {
  const v = process.env['V3_EVAL_CACHE']
  return typeof v === 'string' && v.length > 0
}

function isExpired(entry: CacheEntry, ttlMs: number): boolean {
  return Date.now() - entry.createdAt > ttlMs
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Build a cache middleware for `wrapLanguageModel`. Wraps `doGenerate` and
 * `doStream`; on a hit replays the cached payload, on a miss invokes the
 * downstream model and stores the result.
 *
 * Composition note: install **before** budget/trace so cache hits don't
 * pay the downstream model cost (the trace/budget middleware still see the
 * payload via the wrapped result they observe in their own `wrapGenerate`).
 *
 * @example
 * ```ts
 * import { wrapLanguageModel } from 'ai'
 * import { cacheMiddleware } from 'ai-functions'
 *
 * const model = wrapLanguageModel({
 *   model: openai('gpt-4o'),
 *   middleware: cacheMiddleware({ store: 'disk', ttlMs: 86_400_000 }),
 * })
 * ```
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}): LanguageModelV3Middleware {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const keyHash = options.keyHash ?? defaultKeyHash
  const store: CacheMiddlewareStore =
    options.store === undefined || options.store === 'memory'
      ? new MemoryStore()
      : options.store === 'disk'
      ? new DiskStore(options.diskPath ?? '.cache/v3-eval-cache.json')
      : options.store
  const enabled = options.enabled ?? envGateEnabled()

  return {
    specificationVersion: 'v3',
    async wrapGenerate({ doGenerate, params, model }) {
      if (!enabled) return doGenerate()
      const key = keyHash(params, model.modelId)
      const cached = store.get(key)
      if (cached !== undefined) {
        if (isExpired(cached, ttlMs)) {
          store.delete(key)
        } else if (cached.generateResult !== undefined) {
          return cached.generateResult
        }
      }
      const result = await doGenerate()
      store.set(key, { generateResult: result, createdAt: Date.now() })
      return result
    },
    async wrapStream({ doStream, params, model }) {
      if (!enabled) return doStream()
      const key = keyHash(params, model.modelId)
      const cached = store.get(key)
      if (cached !== undefined) {
        if (isExpired(cached, ttlMs)) {
          store.delete(key)
        } else if (cached.streamChunks !== undefined) {
          // Replay cached chunks via simulateReadableStream so consumers
          // see the same async iteration shape as a fresh call.
          const replay: LanguageModelV3StreamResult = {
            stream: simulateReadableStream<LanguageModelV3StreamPart>({
              chunks: cached.streamChunks,
              initialDelayInMs: 0,
              chunkDelayInMs: 0,
            }),
          }
          return replay
        }
      }
      const result = await doStream()
      // Tee the stream: forward to caller, accumulate for cache.
      const chunks: LanguageModelV3StreamPart[] = []
      const transformedStream = result.stream.pipeThrough(
        new TransformStream<LanguageModelV3StreamPart, LanguageModelV3StreamPart>({
          transform(chunk, controller) {
            chunks.push(chunk)
            controller.enqueue(chunk)
          },
          flush() {
            store.set(key, { streamChunks: chunks, createdAt: Date.now() })
          },
        })
      )
      return {
        ...result,
        stream: transformedStream,
      }
    },
  }
}
