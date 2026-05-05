/**
 * Cascade Write Strategy — sharded parallel writes for cascade generation
 *
 * Phase 2 entry point of the cascade epic per
 * [ADR-0003](../../../docs/adr/0003-storage-strategy-pg-clickhouse-default.md)
 * and the
 * [implementation plan](../../../docs/plans/2026-05-05-cascade-storage-execution-implementation.md).
 *
 * This module is **strategy + scaffolding** — the *primitive* the cascade
 * orchestrator (`aip-8yal`) calls. It does not run the orchestration loop
 * itself, does not call LLMs, and does not implement the dual-write to
 * Pipelines/Iceberg fan-out (that's `aip-0ypt`). It does:
 *
 * 1. **Shard-key derivation** — given a cascade context, pick the
 *    {@link ShardRef} the next batch should land in. Built-in strategies
 *    cover the three sharding models declared on `DBProvider`:
 *    `per-cascade` (DO SQLite default), `partitioned-by-tenant` (PG
 *    schema-per-tenant or `tenant_id` partition key), `unsharded`.
 *
 * 2. **Bulk-write API** — {@link writeBatch} routes a batch of Things +
 *    Actions through the adapter's cascade fast path. For PG, that's the
 *    **CTE jsonb-bulk shape** proven by the substrate-write-probes
 *    (91 ms p50 for 500 things + 499 actions on Neon HTTP — see
 *    `docs/reviews/2026-05-05-cascade-poc-evaluation.md`). For DO SQLite,
 *    the routing layer pins the shard and forwards the batch into the
 *    per-cascade DO. For ClickHouse, JSONEachRow is the path.
 *
 * 3. **Read-back-during-traversal API** — {@link readShardLocal} performs a
 *    point read against the same shard the batch was written to. Cascade
 *    generation reads back just-written entities to inform the next
 *    generation step; cross-shard reads on the hot path are explicitly
 *    not supported.
 *
 * 4. **Pipelines fan-out hook** — a {@link AnalyticalEmitter} callback the
 *    caller may pass to {@link writeBatch}. The cascade-write-strategy
 *    invokes it post-commit so Stack B's dual-write
 *    (DO SQLite local → Pipelines → Iceberg → ClickHouse) can be wired
 *    later by `aip-0ypt` without changing this surface.
 *
 * ## Why a separate module
 *
 * The cascade orchestrator is long, has its own retry/validation/policy
 * concerns, and needs swappable storage. Pulling the write-strategy
 * primitive out keeps the orchestration module focused, lets us unit-test
 * shard-key derivation independently of LLM calls, and keeps the
 * provenance of the write shape (the substrate-write-probes verdict)
 * documented in one place rather than scattered through orchestrator code.
 *
 * @see {@link ../docs/adr/0003-storage-strategy-pg-clickhouse-default.md}
 * @see {@link ../docs/reviews/2026-05-05-cascade-poc-evaluation.md}
 * @packageDocumentation
 */

import type { DBProvider } from './schema/provider.js'
import type { DBProviderPort, ShardingModel, SVOAction } from './db-provider-port.js'
import { getProviderCapabilities } from './db-provider-port.js'

// =============================================================================
// Shard reference + context
// =============================================================================

/**
 * Stable handle the cascade orchestrator carries between
 * {@link CascadeWriteStrategy.pickShard} and subsequent calls to
 * {@link CascadeWriteStrategy.writeBatch} / {@link CascadeWriteStrategy.readShardLocal}.
 *
 * `key` is the routing key the strategy emitted (e.g. `'cascade:abc'`,
 * `'tenant:acme'`, `'__shared__'`); adapters consume it through
 * `context.cascadeId` / `context.tenantId` / a custom hook. `model` is the
 * sharding model that produced the key — useful for diagnostics and for
 * orchestrators that route differently when shards are per-cascade vs.
 * per-tenant.
 *
 * The opaque `context` field carries the full cascade context that
 * produced this `ShardRef`; the DO SQLite shard-routing helper consumes
 * it via {@link DOSqliteAdapter.withContext} so per-op operations land in
 * the correct DO.
 */
export interface ShardRef {
  /** Routing key emitted by the active sharding strategy. */
  key: string
  /** Sharding model declared on the underlying DBProvider adapter. */
  model: ShardingModel
  /** Cascade context that produced the key (for read-back routing). */
  context: CascadeShardContext
}

/**
 * Per-batch context the cascade orchestrator passes into
 * {@link CascadeWriteStrategy.pickShard}.
 *
 * Required fields are deliberately small. The full shape is open via
 * `[key: string]: unknown` so callers can carry deployment-specific
 * routing hints (e.g. region pin, A/B bucket) without changing this
 * port.
 *
 * `rootEntity` is the cascade's root (e.g. `FoundingHypothesis-abc123`);
 * the strategy may inspect its `$type` for type-aware sharding. It is
 * NOT used as the routing key directly — that's `cascadeId`.
 */
export interface CascadeShardContext {
  /**
   * The cascade root entity reference. The strategy may derive type-aware
   * routing from this (e.g. type-per-shard) but the canonical
   * `'per-cascade'` strategy uses {@link CascadeShardContext.cascadeId}.
   */
  rootEntity?: { $id: string; $type: string }

  /**
   * Stable cascade id. Required for `'per-cascade'` strategy. The
   * orchestrator typically derives this from a content hash of the
   * root entity + cascade definition so re-runs route to the same shard.
   */
  cascadeId?: string

  /**
   * Tenant id. Required for `'partitioned-by-tenant'` strategy.
   */
  tenantId?: string

  /**
   * Free-form context the caller may consult inside a custom strategy.
   */
  [key: string]: unknown
}

// =============================================================================
// Sharding strategies
// =============================================================================

/**
 * A sharding strategy maps a {@link CascadeShardContext} to a
 * {@link ShardRef}.
 *
 * Strategies MUST be deterministic — the same context MUST produce the
 * same key — so the cascade orchestrator's read-back during traversal
 * lands on the shard that received the write.
 *
 * Built-in strategies are exported as constants on
 * {@link CascadeShardingStrategies}; callers can also pass any
 * `(ctx) => ShardRef` callback.
 */
export type CascadeShardingStrategy = (ctx: CascadeShardContext) => ShardRef

/**
 * Built-in cascade sharding strategies.
 *
 * Each maps the abstract {@link ShardingModel} declared on a `DBProvider`
 * to a concrete routing-key derivation. Adapters consult their adapter's
 * declared sharding model via {@link getProviderCapabilities} when
 * picking a default; callers can override.
 *
 * - {@link perCascade} — one shard per cascade. Default for
 *   `do-sqlite` adapter (per ADR-0003 enabling pattern). Throws if
 *   {@link CascadeShardContext.cascadeId} is missing.
 * - {@link partitionedByTenant} — one shard per tenant. Default for
 *   `pg+pgvector` adapter. Throws if {@link CascadeShardContext.tenantId}
 *   is missing.
 * - {@link unsharded} — single global shard. Default for `memory` and any
 *   adapter that does not declare a sharding model. Always returns the
 *   constant key `'__shared__'`.
 */
export const CascadeShardingStrategies = {
  /**
   * One shard per cascade. Stack B's enabling pattern: every active
   * cascade gets its own DO (or its own PG partition / temp schema)
   * giving full single-shard write throughput in parallel.
   *
   * @param defaultCascadeId - Fallback when the per-op context omits
   *   `cascadeId`. Useful when the orchestrator has a stable cascade
   *   scope but individual write batches don't restate it.
   */
  perCascade(defaultCascadeId?: string): CascadeShardingStrategy {
    return (ctx) => {
      const cascadeId = ctx.cascadeId ?? defaultCascadeId
      if (!cascadeId) {
        throw new Error(
          'CascadeShardingStrategies.perCascade: no cascadeId in context. ' +
            'Pass `cascadeId` on the CascadeShardContext, or supply a ' +
            'default via perCascade(defaultCascadeId).'
        )
      }
      return {
        key: `cascade:${cascadeId}`,
        model: 'per-cascade',
        context: { ...ctx, cascadeId },
      }
    }
  },

  /**
   * One shard per tenant. The natural shape for multi-tenant Postgres
   * (schema-per-tenant or `tenant_id` partition key). Many cascades
   * within the same tenant share a partition; tenants are isolated.
   *
   * @param defaultTenantId - Fallback when the per-op context omits
   *   `tenantId`.
   */
  partitionedByTenant(defaultTenantId?: string): CascadeShardingStrategy {
    return (ctx) => {
      const tenantId = ctx.tenantId ?? defaultTenantId
      if (!tenantId) {
        throw new Error(
          'CascadeShardingStrategies.partitionedByTenant: no tenantId in ' +
            'context. Pass `tenantId` on the CascadeShardContext, or supply ' +
            'a default via partitionedByTenant(defaultTenantId).'
        )
      }
      return {
        key: `tenant:${tenantId}`,
        model: 'partitioned-by-tenant',
        context: { ...ctx, tenantId },
      }
    }
  },

  /**
   * Single global shard. Default for in-memory / dev / single small PG
   * deployments. Cascade throughput hits the underlying adapter's
   * single-writer ceiling.
   */
  unsharded(): CascadeShardingStrategy {
    return (ctx) => ({
      key: '__shared__',
      model: 'unsharded',
      context: { ...ctx },
    })
  },
} as const

// =============================================================================
// Batch shapes — Things + Actions in the canonical SVO recording shape
// =============================================================================

/**
 * A Thing to write in a cascade batch.
 *
 * The cascade orchestrator pre-derives stable ids (content hashes
 * including the parent's full idempotency key per the lineage-key
 * discipline from `cf-substrate/tierA-cascade`) before commit so
 * grandchildren backrefs point at the right parent. This module
 * trusts the caller's id discipline and writes verbatim.
 */
export interface CascadeThing {
  /** Stable, content-hashed id derived upstream by the orchestrator. */
  id: string
  /** Thing `$type` (e.g. `'Customer'`, `'Order'`, `'NameCandidate'`). */
  type: string
  /** Thing payload. The adapter writes this as a jsonb / String column. */
  data: Record<string, unknown>
}

/**
 * An Action to write in a cascade batch.
 *
 * Wire-compatible with {@link SVOAction} minus `id` (caller-supplied or
 * adapter-generated) and lifecycle timestamps (adapters set these at
 * commit time). Actions carry **subject** + **object** + **Frame
 * roles** — the post-SVO recording shape; adapters route them to the
 * per-row columns / role jsonb map per their schema.
 *
 * `relateTuple` is the legacy `(fromType, fromId, relation, toType, toId)`
 * shape some callers may carry; for backward compatibility the cascade
 * orchestrator can populate it and the strategy converts to an Action
 * before write. Pure SVO callers omit it.
 */
export interface CascadeAction {
  /** Optional caller-supplied id. Adapter generates if omitted. */
  id?: string
  /** Verb name. References a Verb in the adapter's registry. */
  verb: string
  /** Subject Thing id (actor / who-acts). */
  subject?: string
  /** Object Thing id (what-is-acted-on). */
  object?: string
  /** Frame role assignments beyond subject/object (recipient/source/...). */
  roles?: Record<string, string>
  /** Verb-specific payload. */
  data?: Record<string, unknown>
  /**
   * Action lifecycle status. Defaults to `'completed'` for cascade
   * relations (the relation is observed-as-true at write time). The
   * orchestrator may pass `'pending'` for Actions that record an
   * in-flight LLM step and transition to `'completed'`/`'failed'`
   * after the call returns.
   */
  status?: SVOAction['status']
}

/**
 * The unit of work the cascade orchestrator hands the strategy.
 *
 * Both arrays may be empty independently — a batch may be Things-only
 * (entity creation) or Actions-only (relation recording).
 */
export interface CascadeBatch {
  things?: ReadonlyArray<CascadeThing>
  actions?: ReadonlyArray<CascadeAction>
}

/**
 * Result returned by {@link CascadeWriteStrategy.writeBatch}.
 *
 * `thingsInserted` / `actionsInserted` reflect the count actually inserted
 * (excludes idempotent conflicts). Adapters whose drivers don't surface
 * row counts (some ClickHouse paths) report the input batch size — see
 * adapter-specific docs.
 */
export interface CascadeBatchResult {
  thingsInserted: number
  actionsInserted: number
  shard: ShardRef
}

// =============================================================================
// Adapter capabilities the strategy needs
// =============================================================================

/**
 * Optional `commitBatch` shape adapters expose to opt into the cascade
 * fast path. PG and CH adapters in this package implement this; in-memory
 * and DO SQLite do not (they fall back to per-op writes).
 *
 * When present, the strategy routes the entire batch through
 * `commitBatch` — for PG that's the CTE jsonb-bulk shape, for CH it's
 * the JSONEachRow path.
 */
export interface BulkCommitCapable {
  commitBatch(input: {
    things?: ReadonlyArray<{ id: string; type: string; data: Record<string, unknown> }>
    actions?: ReadonlyArray<{
      id?: string
      verb: string
      subject?: string | undefined
      object?: string | undefined
      roles?: Record<string, string> | undefined
      data?: Record<string, unknown> | undefined
      status?: SVOAction['status'] | undefined
    }>
  }): Promise<{ thingsInserted: number; actionsInserted: number }>
}

/**
 * Optional context-binding shape adapters expose to receive shard
 * routing for every subsequent operation. The DO SQLite adapter
 * implements `withCascade`/`withTenant`/`withContext`; PG and CH
 * adapters return `this` (no per-shard binding needed — their `ns`
 * column carries the partition key already).
 */
export interface ShardContextBindable<T> {
  withContext(context: Record<string, unknown>): T
  withCascade?(cascadeId: string): T
  withTenant?(tenantId: string): T
}

/**
 * Hook the cascade-write-strategy invokes after a successful commit so
 * Stack B's dual-write (DO SQLite local → Pipelines → Iceberg → CH) can
 * fan-out the same batch to the analytical store.
 *
 * Implementation lives in `aip-0ypt`; this strategy only surfaces the
 * extension point. Failures inside the emitter are logged and swallowed
 * — the analytical fan-out is not load-bearing for cascade correctness.
 */
export type AnalyticalEmitter = (input: {
  shard: ShardRef
  batch: CascadeBatch
  result: { thingsInserted: number; actionsInserted: number }
}) => Promise<void> | void

// =============================================================================
// CascadeWriteStrategy — the primary surface
// =============================================================================

/**
 * Constructor options for {@link CascadeWriteStrategy}.
 */
export interface CascadeWriteStrategyOptions {
  /**
   * The DBProvider adapter to write through. Must be
   * {@link BulkCommitCapable} for the cascade fast path; if not, the
   * strategy falls back to per-op writes (`create()` + `relate()`).
   */
  adapter: DBProvider | DBProviderPort

  /**
   * Sharding strategy. One of:
   * - A built-in strategy from {@link CascadeShardingStrategies}.
   * - A custom `(ctx) => ShardRef` callback.
   * - A shorthand string mapped to a built-in:
   *   - `'per-cascade'` → `CascadeShardingStrategies.perCascade()`
   *   - `'partitioned-by-tenant'` → `CascadeShardingStrategies.partitionedByTenant()`
   *   - `'unsharded'` → `CascadeShardingStrategies.unsharded()`
   *
   * Default: derived from the adapter's declared
   * {@link ProviderTierCapabilities.shardingModel} via
   * {@link getProviderCapabilities}. Adapters that don't declare default
   * to `'unsharded'`.
   */
  sharding?: CascadeShardingStrategy | 'per-cascade' | 'partitioned-by-tenant' | 'unsharded'

  /**
   * Default cascade id used when {@link CascadeShardingStrategies.perCascade}
   * is the active strategy and the per-op context omits it.
   */
  defaultCascadeId?: string

  /**
   * Default tenant id used when
   * {@link CascadeShardingStrategies.partitionedByTenant} is the active
   * strategy and the per-op context omits it.
   */
  defaultTenantId?: string

  /**
   * Maximum number of Things + Actions per round-trip to the adapter.
   * Per the substrate-write-probes verdict the CTE jsonb-bulk shape
   * achieves sublinear scaling above N=100 and 91 ms p50 at N=500. We
   * default to **1000** — well within the sweet spot for both PG and
   * DO SQLite per-op limits — and chunk larger batches into rounds.
   *
   * @default 1000
   */
  maxBatchSize?: number

  /**
   * Optional analytical fan-out hook (see {@link AnalyticalEmitter}).
   * Implementation deferred to `aip-0ypt`; surfaced here as a
   * non-blocking extension point.
   */
  analyticalEmitter?: AnalyticalEmitter
}

/**
 * The cascade write strategy primitive.
 *
 * Composes a `DBProvider` adapter with a sharding strategy and exposes
 * the bulk-write + read-back surface the cascade orchestrator
 * (`aip-8yal`) calls per traversal step. This module owns:
 *
 * - Routing-key derivation ({@link pickShard})
 * - Bulk write via the adapter's cascade fast path ({@link writeBatch})
 * - Local read-back from the same shard ({@link readShardLocal})
 * - Analytical fan-out hook (post-commit; opt-in)
 *
 * It does NOT own:
 *
 * - LLM-driven generation (the orchestrator calls it before issuing batches)
 * - Validation / policy / retry (the orchestrator wraps the strategy)
 * - Pipelines→Iceberg dual-write semantics (`aip-0ypt`)
 * - Cross-shard joins (out of scope per ADR-0003 hot-path constraint)
 *
 * @example
 * ```ts
 * import {
 *   CascadeWriteStrategy,
 *   createPostgresProvider,
 * } from 'ai-database'
 *
 * const adapter = createPostgresProvider({ executor, namespace: 'tenant-9' })
 * const strategy = new CascadeWriteStrategy({
 *   adapter,
 *   sharding: 'partitioned-by-tenant',
 *   defaultTenantId: 'tenant-9',
 * })
 *
 * const shard = strategy.pickShard({
 *   rootEntity: { $id: 'fh-1', $type: 'FoundingHypothesis' },
 *   tenantId: 'tenant-9',
 * })
 *
 * await strategy.writeBatch(shard, {
 *   things: [{ id: 'cust-1', type: 'Customer', data: { name: 'Acme' } }],
 *   actions: [{ verb: 'placedBy', subject: 'order-1', object: 'cust-1', status: 'completed' }],
 * })
 * ```
 */
export class CascadeWriteStrategy {
  private readonly adapter: DBProvider
  private readonly strategy: CascadeShardingStrategy
  readonly maxBatchSize: number
  private readonly emitter: AnalyticalEmitter | undefined

  constructor(options: CascadeWriteStrategyOptions) {
    this.adapter = options.adapter as DBProvider
    this.strategy = resolveShardingStrategy(options)
    this.maxBatchSize = options.maxBatchSize ?? 1000
    this.emitter = options.analyticalEmitter
  }

  /**
   * Derive the {@link ShardRef} the next batch should land in. Pure —
   * never touches the adapter.
   *
   * Throws when the active strategy needs context the caller didn't
   * supply (e.g. `'per-cascade'` with no `cascadeId`).
   */
  pickShard(context: CascadeShardContext): ShardRef {
    return this.strategy(context)
  }

  /**
   * Bulk-commit a batch of Things + Actions to the shard.
   *
   * - When the adapter is {@link BulkCommitCapable}, the entire batch
   *   travels in a single fast-path call — for PG that's the CTE
   *   jsonb-bulk shape (91 ms p50 / 500 things on Neon HTTP), for CH
   *   the JSONEachRow path.
   * - When the adapter is not bulk-capable (in-memory, DO SQLite via
   *   the current wire shape), the strategy falls back to per-op
   *   `create()` + `relate()` calls. This still flows through the
   *   shard-aware adapter so reads land on the same shard, but
   *   throughput is the per-op ceiling.
   * - Batches larger than {@link maxBatchSize} are split into rounds.
   *   Rounds run sequentially within a single `writeBatch` call to
   *   preserve write-order guarantees the orchestrator may rely on
   *   (e.g. parents before children). Sibling parallelism is the
   *   orchestrator's concern, not this primitive's.
   *
   * Post-commit, if an {@link AnalyticalEmitter} was configured, it is
   * invoked once per chunk so Stack B's analytical fan-out can mirror
   * the same batch into Pipelines→Iceberg. Emitter failures are logged
   * and swallowed — they MUST NOT fail the cascade write.
   */
  async writeBatch(shard: ShardRef, batch: CascadeBatch): Promise<CascadeBatchResult> {
    const things = batch.things ?? []
    const actions = batch.actions ?? []
    if (things.length === 0 && actions.length === 0) {
      return { thingsInserted: 0, actionsInserted: 0, shard }
    }

    const boundAdapter = this.bindAdapterToShard(shard)
    const chunks = chunkBatch({ things, actions }, this.maxBatchSize)

    let thingsInserted = 0
    let actionsInserted = 0
    for (const chunk of chunks) {
      const result = await this.writeChunk(boundAdapter, chunk)
      thingsInserted += result.thingsInserted
      actionsInserted += result.actionsInserted
      // Post-commit fan-out hook for aip-0ypt. Failures are non-fatal —
      // the cascade local commit is the source of truth for traversal.
      if (this.emitter) {
        try {
          await this.emitter({ shard, batch: chunk, result })
        } catch {
          // Analytical fan-out is best-effort; log site is the caller's
          // concern (we don't pull a logger dependency here).
        }
      }
    }
    return { thingsInserted, actionsInserted, shard }
  }

  /**
   * Read a Thing back from the same shard the batch was written to.
   *
   * Cascade generation reads back just-written entities to inform the
   * next traversal step (e.g. resolve a freshly-written `Customer`
   * before generating its `Orders`). Cross-shard reads are explicitly
   * not supported on the hot path per ADR-0003.
   *
   * Returns `null` if the entity is not in the shard. The caller may
   * still attempt a cross-shard read via the unsharded adapter surface
   * if needed for cold-path reconciliation.
   */
  async readShardLocal(
    shard: ShardRef,
    type: string,
    id: string
  ): Promise<Record<string, unknown> | null> {
    const boundAdapter = this.bindAdapterToShard(shard)
    return boundAdapter.get(type, id)
  }

  /**
   * Read a list of just-written entities from the shard. Wraps
   * `adapter.list(type)` after binding the shard context.
   *
   * Use when the cascade needs to enumerate all of a type the current
   * cascade has produced (e.g. all `OrderItem` for the current
   * `Order`). For point reads, prefer {@link readShardLocal}.
   */
  async listShardLocal(
    shard: ShardRef,
    type: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Record<string, unknown>[]> {
    const boundAdapter = this.bindAdapterToShard(shard)
    return boundAdapter.list(type, options)
  }

  // ===========================================================================
  // Internal helpers
  // ===========================================================================

  /**
   * Bind the adapter to the shard so subsequent ops route correctly.
   *
   * For DO SQLite, {@link DOSqliteAdapter.withContext} is used to pin
   * the cascade/tenant id. For PG/CH, the `ns` column on the adapter
   * already carries the partition key, so this is a no-op (return
   * `this`).
   */
  private bindAdapterToShard(shard: ShardRef): DBProvider {
    const bindable = this.adapter as ShardContextBindable<DBProvider> & DBProvider
    if (typeof bindable.withContext === 'function') {
      return bindable.withContext({ ...shard.context })
    }
    return this.adapter
  }

  /**
   * Write a single chunk through the adapter's cascade fast path or
   * the per-op fallback.
   */
  private async writeChunk(
    adapter: DBProvider,
    chunk: CascadeBatch
  ): Promise<{ thingsInserted: number; actionsInserted: number }> {
    const things = chunk.things ?? []
    const actions = chunk.actions ?? []

    const bulkCapable = adapter as DBProvider & Partial<BulkCommitCapable>
    if (typeof bulkCapable.commitBatch === 'function') {
      // PG / CH fast path. PG uses the CTE jsonb-bulk shape (proven by
      // the substrate-write-probes); CH uses JSONEachRow. Both shapes
      // are documented on the respective adapter.
      return bulkCapable.commitBatch({
        ...(things.length > 0 && { things }),
        ...(actions.length > 0 && {
          actions: actions.map((a) => ({
            ...(a.id !== undefined && { id: a.id }),
            verb: a.verb,
            subject: a.subject,
            object: a.object,
            roles: a.roles,
            data: a.data,
            status: a.status,
          })),
        }),
      })
    }

    // Fallback: per-op writes. Used by DO SQLite (bulk path lives at the
    // DO wire level — out of scope for this bead) and the in-memory
    // adapter. Sequential within a chunk so writes appear in the order
    // the orchestrator emitted them; parallelism is the orchestrator's
    // concern.
    let thingsInserted = 0
    for (const thing of things) {
      try {
        await adapter.create(thing.type, thing.id, thing.data)
        thingsInserted += 1
      } catch (err) {
        // Best-effort idempotency: swallow already-exists errors so
        // re-runs of a content-hashed cascade don't fail. Surface
        // anything else.
        if (!isAlreadyExistsError(err)) throw err
      }
    }
    let actionsInserted = 0
    for (const action of actions) {
      // Use recordAction when available (SVO surface); fall back to
      // relate() if the adapter only exposes the structural surface.
      const svo = adapter as Partial<{ recordAction: SvoRecordActionFn }>
      if (typeof svo.recordAction === 'function') {
        await svo.recordAction({
          verb: action.verb,
          ...(action.subject !== undefined && { subject: action.subject }),
          ...(action.object !== undefined && { object: action.object }),
          ...(action.roles !== undefined && { roles: action.roles }),
          ...(action.data !== undefined && { data: action.data }),
          ...(action.status !== undefined && { status: action.status }),
        })
      } else if (action.subject && action.object) {
        // Best-effort fallback — the adapter doesn't speak SVO. We have
        // no type information for relate(), which expects fromType /
        // toType; we use the data fields if present, else a generic
        // 'Thing' placeholder. Adapters in this position are dev-only
        // (in-memory tests) so this is acceptable.
        const fromType = (action.data?.['fromType'] as string) ?? 'Thing'
        const toType = (action.data?.['toType'] as string) ?? 'Thing'
        await adapter.relate(fromType, action.subject, action.verb, toType, action.object)
      }
      actionsInserted += 1
    }
    return { thingsInserted, actionsInserted }
  }
}

// =============================================================================
// PG-specific bulk-write helper — the proven CTE jsonb-bulk shape
// =============================================================================

/**
 * Stand-alone helper that emits the PG cascade-write SQL the
 * substrate-write-probes proved out: a single CTE round-trip with
 * bulk `VALUES (...), (...)` inserts and `ON CONFLICT DO NOTHING`.
 *
 * **This is the shape the canonical PG adapter's
 * {@link PostgresProvider.commitBatch} uses.** The helper is exported so
 * cascade orchestrators that bypass the adapter (e.g. running raw SQL
 * for benchmarking) can still use the proven shape without re-deriving
 * it. The adapter's `commitBatch` remains the recommended path.
 *
 * Returns the SQL text + ordered positional params. Things take 4
 * columns: `(ns, id, type, data)`. Actions take 10 columns:
 * `(ns, id, verb, subject, object, roles, data, status, created_at, completed_at)`.
 *
 * Why: documenting the shape in a stand-alone helper anchors the write
 * shape to the substrate-write-probes evidence (91 ms p50 for 500 docs +
 * 499 rels on Neon HTTP, sublinear scaling above N=100). Future schema
 * changes that invalidate the column list will land here visibly.
 *
 * @internal Use {@link PostgresProvider.commitBatch} for production code.
 */
export function buildPgCommitBatchSql(input: {
  schema: string
  namespace: string
  things: ReadonlyArray<CascadeThing>
  actions: ReadonlyArray<CascadeAction>
  /** ISO-8601 string for `created_at` / `completed_at` columns. */
  now: string
}): { sql: string; params: unknown[] } | null {
  const { schema, namespace, things, actions, now } = input
  if (things.length === 0 && actions.length === 0) return null

  const thingCols = 4
  const actionCols = 10
  const thingOffset = things.length * thingCols

  const thingPlaceholders = things
    .map((_, i) => {
      const base = i * thingCols
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}::jsonb)`
    })
    .join(', ')

  const actionPlaceholders = actions
    .map((_, i) => {
      const base = thingOffset + i * actionCols
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${
        base + 6
      }::jsonb, $${base + 7}::jsonb, $${base + 8}, $${base + 9}, $${base + 10})`
    })
    .join(', ')

  const params: unknown[] = []
  for (const t of things) {
    params.push(namespace, t.id, t.type, JSON.stringify(t.data))
  }
  for (const a of actions) {
    const status = a.status ?? 'pending'
    const completedAt =
      status === 'completed' || status === 'failed' || status === 'cancelled' ? now : null
    params.push(
      namespace,
      a.id ?? generateId(),
      a.verb,
      a.subject ?? null,
      a.object ?? null,
      JSON.stringify(a.roles ?? {}),
      JSON.stringify(a.data ?? {}),
      status,
      now,
      completedAt
    )
  }

  const ctes: string[] = []
  if (things.length > 0) {
    ctes.push(
      `inserted_things AS (
        INSERT INTO ${schema}.things (ns, id, type, data) VALUES ${thingPlaceholders}
        ON CONFLICT ON CONSTRAINT things_pk DO NOTHING
        RETURNING 1
      )`
    )
  }
  if (actions.length > 0) {
    ctes.push(
      `inserted_actions AS (
        INSERT INTO ${schema}.actions
          (ns, id, verb, subject, object, roles, data, status, created_at, completed_at)
        VALUES ${actionPlaceholders}
        ON CONFLICT ON CONSTRAINT actions_pk DO NOTHING
        RETURNING 1
      )`
    )
  }

  const sql = `WITH ${ctes.join(', ')}
    SELECT
      ${things.length > 0 ? `(SELECT COUNT(*) FROM inserted_things)::int` : '0'} AS things_inserted,
      ${
        actions.length > 0 ? `(SELECT COUNT(*) FROM inserted_actions)::int` : '0'
      } AS actions_inserted`

  return { sql, params }
}

// =============================================================================
// DO SQLite shard-routing helper
// =============================================================================

/**
 * Resolve the DO id name for a given shard from a Cloudflare DO
 * namespace binding.
 *
 * The actual shard pinning happens inside `DOSqliteAdapter` —
 * {@link DOSqliteAdapter.withContext} consumes the `ShardRef.context`
 * when subsequent ops are issued, and the adapter's internal
 * `resolveStub` calls `namespace.idFromName(...).` This helper exposes
 * the same routing logic for callers that need to **manually** route a
 * batch into a per-cascade DO without going through the adapter (e.g.
 * direct fetch into a DO that hasn't been wrapped yet).
 *
 * For canonical use, prefer the adapter — `withContext(shard.context)`
 * encapsulates this.
 *
 * @example
 * ```ts
 * import { resolveDOIdName, CascadeShardingStrategies } from 'ai-database'
 *
 * const strategy = CascadeShardingStrategies.perCascade()
 * const shard = strategy({ cascadeId: 'abc' })
 * const idName = resolveDOIdName(shard) // 'cascade:abc'
 * const id = env.DATABASE.idFromName(idName)
 * const stub = env.DATABASE.get(id)
 * await stub.fetch(...)
 * ```
 */
export function resolveDOIdName(shard: ShardRef): string {
  return shard.key
}

// =============================================================================
// Helpers — chunking, error classification, id generation, strategy resolution
// =============================================================================

/**
 * Split a batch into chunks no larger than `maxBatchSize` rows
 * (Things + Actions counted together).
 *
 * The substrate-write-probes verdict shows sublinear scaling above N=100
 * for the CTE shape — a single round-trip carrying 500 things + 499 rels
 * lands in 91 ms p50. We default to 1000 rows/chunk in the strategy;
 * callers can override via {@link CascadeWriteStrategyOptions.maxBatchSize}.
 *
 * Things and Actions are kept together within a chunk so a parent +
 * child + their relation can fit in one round-trip when the orchestrator
 * emits them as one batch. When the chunk boundary falls inside a
 * Thing/Action group the orchestrator built, callers should size their
 * batches (or the `maxBatchSize`) to avoid splitting groups.
 *
 * @internal exported for tests.
 */
export function chunkBatch(batch: CascadeBatch, maxBatchSize: number): CascadeBatch[] {
  if (maxBatchSize <= 0) {
    throw new Error('chunkBatch: maxBatchSize must be > 0')
  }
  const things = batch.things ?? []
  const actions = batch.actions ?? []
  const total = things.length + actions.length
  if (total <= maxBatchSize) return [{ things, actions }]

  const chunks: CascadeBatch[] = []
  let ti = 0
  let ai = 0
  while (ti < things.length || ai < actions.length) {
    const remainingThings = things.length - ti
    const takeThings = Math.min(remainingThings, maxBatchSize)
    const remaining = maxBatchSize - takeThings
    const takeActions = Math.min(actions.length - ai, remaining)
    chunks.push({
      things: things.slice(ti, ti + takeThings),
      actions: actions.slice(ai, ai + takeActions),
    })
    ti += takeThings
    ai += takeActions
  }
  return chunks
}

/**
 * Classify an error as the adapter's idempotent-conflict signal so
 * per-op fallback writes can swallow re-runs.
 */
function isAlreadyExistsError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  // Loose match — adapters use different wording. Cascade re-runs depend
  // on content-hashed ids, so a true conflict is benign.
  return /already exists|duplicate|unique constraint|conflict/i.test(msg)
}

/**
 * Resolve the active sharding strategy from constructor options. Falls
 * back to the adapter's declared {@link ShardingModel} when the caller
 * didn't supply one.
 */
function resolveShardingStrategy(opts: CascadeWriteStrategyOptions): CascadeShardingStrategy {
  const sharding = opts.sharding
  if (typeof sharding === 'function') return sharding
  const declared = sharding ?? getProviderCapabilities(opts.adapter as DBProvider).shardingModel

  switch (declared) {
    case 'per-cascade':
      return CascadeShardingStrategies.perCascade(opts.defaultCascadeId)
    case 'partitioned-by-tenant':
      return CascadeShardingStrategies.partitionedByTenant(opts.defaultTenantId)
    case 'unsharded':
      return CascadeShardingStrategies.unsharded()
    default:
      // Custom / forward-compat shard models declared by future adapters
      // fall back to unsharded; callers should pass an explicit strategy.
      return CascadeShardingStrategies.unsharded()
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Tests in environments without `crypto` get a deterministic prefix +
  // timestamp; production paths always have crypto available.
  return `cascade-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// Type-only helper to keep the per-op SVO fallback typed. Mirrors the
// shape of `DBProviderSVO.recordAction` without importing the SVO type
// at runtime (the strategy module is intentionally light on type deps).
type SvoRecordActionFn = (input: {
  verb: string
  subject?: string
  object?: string
  roles?: Record<string, string>
  data?: Record<string, unknown>
  status?: SVOAction['status']
}) => Promise<unknown>

/**
 * Convenience factory.
 *
 * @example
 * ```ts
 * import {
 *   createCascadeWriteStrategy,
 *   createPostgresProvider,
 * } from 'ai-database'
 *
 * const adapter = createPostgresProvider({ executor, namespace: 't9' })
 * const strategy = createCascadeWriteStrategy({
 *   adapter,
 *   sharding: 'partitioned-by-tenant',
 *   defaultTenantId: 't9',
 * })
 * ```
 */
export function createCascadeWriteStrategy(
  options: CascadeWriteStrategyOptions
): CascadeWriteStrategy {
  return new CascadeWriteStrategy(options)
}
