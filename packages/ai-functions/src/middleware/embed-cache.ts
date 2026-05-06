/**
 * embeddingCacheMiddleware — content-addressable cache for `wrapEmbeddingModel`
 *
 * Embedding-side analogue of {@link cacheMiddleware}. Wraps `doEmbed` and
 * caches the resulting embeddings keyed on
 * `{ values, modelId, providerOptions }` so a re-embed of the same value
 * batch with the same model returns the cached vectors without hitting the
 * provider.
 *
 * **Why a separate middleware instead of reusing `cacheMiddleware`?**
 * AI SDK 6 splits language-model and embedding-model surfaces:
 * `LanguageModelV3Middleware` exposes `wrapGenerate` / `wrapStream` against
 * `LanguageModelV3CallOptions`, while `EmbeddingModelV3Middleware` exposes
 * `wrapEmbed` against `EmbeddingModelV3CallOptions`. The cache shape
 * (per-value vector vs. per-prompt completion payload) is also different —
 * embeddings cache batched arrays, generations cache single result objects.
 *
 * - **Hit derivation:** stable hash of `{ values, modelId, providerOptions }`.
 *   `values` is the array as-passed (caller can pre-normalise if they want
 *   case/whitespace insensitivity). Generation knobs don't apply.
 *
 * - **Batch semantics:** the cache key is the *whole* batch. A subset hit
 *   doesn't trigger a partial-fill — that's a more invasive shape change
 *   (the legacy `EmbeddingCache.getMany` did per-text caching, but it was
 *   only used in the example and added 100+ LOC of bookkeeping). Callers
 *   that want per-text caching should use stable per-text batches.
 *
 * - **TTL:** 24h default, configurable. Lazy expiry on access.
 *
 * - **Pluggable store:** in-memory default (Map-backed); custom store
 *   honored as-is. Disk persistence is intentionally not provided here —
 *   embedding payloads (large `number[][]`) make on-disk JSON a bad fit;
 *   callers who want it should pass a custom store.
 *
 * - **Env gate:** honors `process.env.V3_EVAL_CACHE` for parity with
 *   `cacheMiddleware`. Override via the `enabled` option.
 *
 * @packageDocumentation
 */

import type {
  EmbeddingModelV3CallOptions,
  EmbeddingModelV3Embedding,
  EmbeddingModelV3Middleware,
  EmbeddingModelV3Result,
  SharedV3Warning,
} from '@ai-sdk/provider'
import { hashKey } from '../cache.js'

// ============================================================================
// Types
// ============================================================================

/** Cached embedding payload. */
interface EmbedCacheEntry {
  /** The embedding vectors returned for the cached batch. */
  embeddings: Array<EmbeddingModelV3Embedding>
  /** Provider warnings carried alongside the cached batch. */
  warnings: Array<SharedV3Warning>
  /** Insert epoch ms — drives TTL eviction. */
  createdAt: number
}

/** Pluggable cache store for embedding results. */
export interface EmbedCacheMiddlewareStore {
  get(key: string): EmbedCacheEntry | undefined
  set(key: string, value: EmbedCacheEntry): void
  delete(key: string): void
}

/** Options for {@link embeddingCacheMiddleware}. */
export interface EmbedCacheMiddlewareOptions {
  /**
   * Cache backend. `'memory'` uses a process-local Map. A custom
   * {@link EmbedCacheMiddlewareStore} can be passed instead.
   *
   * @default 'memory'
   */
  store?: 'memory' | EmbedCacheMiddlewareStore
  /**
   * TTL in milliseconds. Entries older than `ttlMs` are evicted on access.
   *
   * @default 86_400_000 (24h)
   */
  ttlMs?: number
  /**
   * Custom hash function for cache keys. Defaults to a stable hash of
   * `{ values, modelId, providerOptions }`.
   */
  keyHash?: (params: EmbeddingModelV3CallOptions, modelId: string) => string
  /**
   * Optional override for the env gate. When `false`, the middleware acts
   * as a passthrough regardless of `V3_EVAL_CACHE`. When `true`, always
   * caches. Defaults to `process.env.V3_EVAL_CACHE` truthy-check.
   */
  enabled?: boolean
}

// ============================================================================
// Stores
// ============================================================================

class MemoryStore implements EmbedCacheMiddlewareStore {
  private readonly map: Map<string, EmbedCacheEntry> = new Map()
  get(key: string): EmbedCacheEntry | undefined {
    return this.map.get(key)
  }
  set(key: string, value: EmbedCacheEntry): void {
    this.map.set(key, value)
  }
  delete(key: string): void {
    this.map.delete(key)
  }
}

// ============================================================================
// Helpers
// ============================================================================

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

function defaultKeyHash(params: EmbeddingModelV3CallOptions, modelId: string): string {
  return hashKey({
    values: params.values,
    modelId,
    providerOptions: params.providerOptions,
  })
}

function envGateEnabled(): boolean {
  const v = process.env['V3_EVAL_CACHE']
  return typeof v === 'string' && v.length > 0
}

function isExpired(entry: EmbedCacheEntry, ttlMs: number): boolean {
  return Date.now() - entry.createdAt > ttlMs
}

// ============================================================================
// Middleware
// ============================================================================

/**
 * Build an embedding-cache middleware for `wrapEmbeddingModel`.
 *
 * @example
 * ```ts
 * import { wrapEmbeddingModel } from 'ai'
 * import { embeddingCacheMiddleware } from 'ai-functions'
 *
 * const model = wrapEmbeddingModel({
 *   model: openai.embedding('text-embedding-3-small'),
 *   middleware: embeddingCacheMiddleware({ ttlMs: 86_400_000 }),
 * })
 * ```
 */
export function embeddingCacheMiddleware(
  options: EmbedCacheMiddlewareOptions = {}
): EmbeddingModelV3Middleware {
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS
  const keyHash = options.keyHash ?? defaultKeyHash
  const store: EmbedCacheMiddlewareStore =
    options.store === undefined || options.store === 'memory' ? new MemoryStore() : options.store
  const enabled = options.enabled ?? envGateEnabled()

  return {
    specificationVersion: 'v3',
    async wrapEmbed({ doEmbed, params, model }) {
      if (!enabled) return doEmbed()
      const key = keyHash(params, model.modelId)
      const cached = store.get(key)
      if (cached !== undefined) {
        if (isExpired(cached, ttlMs)) {
          store.delete(key)
        } else {
          // Replay shape matches EmbeddingModelV3Result. Provider-side
          // metadata (response headers, body, usage) is intentionally absent
          // on a hit — callers reading those should disable the cache.
          const replay: EmbeddingModelV3Result = {
            embeddings: cached.embeddings,
            warnings: cached.warnings,
          }
          return replay
        }
      }
      const result = await doEmbed()
      store.set(key, {
        embeddings: result.embeddings,
        warnings: result.warnings,
        createdAt: Date.now(),
      })
      return result
    },
  }
}
