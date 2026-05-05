/**
 * Cascade Orchestrator — the moat work
 *
 * This module is the canonical, real cascade-generation engine for
 * `ai-database`. It replaces the placeholder generator (`schema/cascade.ts`'s
 * `PlaceholderValueGenerator`) for the SVO-shaped cascade surface and absorbs
 * the algorithmic patterns proven by the
 * `2026-05-06-cascade-via-ai-database-poc` (sibling-parallel `[->Type]`
 * expansion, pre-derived child ids for backref correctness, rubric-style
 * `$validate` with four verdict policies, embed-on-write) — but rebuilt on
 * the canonical SVO foundation:
 *
 * - LLM calls go through `generate()` from `ai-functions` (auto-routed via
 *   `ai-providers`), wrapped with the per-model `ModelPolicy` from
 *   `language-models` (`RetryPolicy.forModel` + `FallbackChain.forModel`)
 *   so retry/circuit-breaker/fallback behaviour is consistent with the rest
 *   of the platform.
 * - Generated entities are recorded as **Things** via the canonical
 *   `DBProvider` surface; relations are recorded as **Actions** with proper
 *   Frame role assignments (`subject`, `object`, plus optional Frame-role
 *   slots) per the `digital-objects` SVO ontology.
 * - Verbs auto-register via `provider.defineVerb(...)` on first use when
 *   the adapter exposes the Verb registry surface.
 * - Sharded writes flow through {@link CascadeWriteStrategy} so per-cascade
 *   DO isolation (Stack B) and partitioned-by-tenant Postgres (Stack A) get
 *   the right shape without leaking the choice into orchestrator code.
 * - Read-back-during-traversal goes through {@link CascadeWriteStrategy.readShardLocal}
 *   so cascade reads land on the same shard that received the write.
 *
 * ## What's deliberately NOT in this module
 *
 * - **Pipelines → Iceberg dual-write.** That's bead `aip-0ypt`; the
 *   orchestrator surfaces an `analyticalEmitter` on the underlying
 *   {@link CascadeWriteStrategy} which `aip-0ypt` will wire later.
 * - **CLI / Worker entrypoint.** The library function {@link generateCascade}
 *   is the surface; deployment shapes live downstream.
 * - **Observability beyond debug logging.** Telemetry / tracing is its own
 *   bead.
 * - **The schema-DSL cascade engine** (`schema/cascade.ts`). That module
 *   drives generation from the parsed `[->Type]` / `<-Type` schema syntax;
 *   this orchestrator drives generation from a {@link CascadeSpec} at the
 *   SVO level. Both can coexist; this is the canonical moat path.
 *
 * @see {@link ../docs/adr/0003-storage-strategy-pg-clickhouse-default.md}
 * @see {@link ../docs/reviews/2026-05-05-cascade-poc-evaluation.md}
 * @see {@link ../docs/plans/2026-05-05-cascade-storage-execution-implementation.md}
 * @packageDocumentation
 */

import type { DBProvider } from './schema/provider.js'
import type { DBProviderPort, SVOAction, VerbDefinitionInput } from './db-provider-port.js'
import { hasActionRecording, hasVerbRegistry } from './db-provider-port.js'
import {
  CascadeWriteStrategy,
  createCascadeWriteStrategy,
  type AnalyticalEmitter,
  type CascadeAction,
  type CascadeShardingStrategy,
  type CascadeThing,
  type ShardRef,
} from './cascade-write-strategy.js'

// =============================================================================
// Public types — cascade specification surface
// =============================================================================

/**
 * Validation rubric / policy.
 *
 * Mirrors the POC's rubric+policy gating — every generated entity may be
 * gated by an LLM-as-judge that scores against criteria. Four verdict
 * policies cover the realistic gating cases:
 *
 * - `'all-pass'` — every criterion's score must reach `threshold` (or 1 if
 *   omitted). Strict default.
 * - `'all-load-bearing-pass'` — only criteria flagged `loadBearing: true`
 *   must pass; advisory criteria are scored but don't gate.
 * - `'mean-ge-threshold'` — average of all scores must be >= `threshold`.
 * - `'weighted-ge-threshold'` — weighted mean using each criterion's
 *   `weight` (default 1) must be >= `threshold`.
 *
 * Verdict actions:
 * - `accept` — write the entity.
 * - `reject` — discard the entity (do not write, return as rejected).
 * - `regenerate` — re-run the LLM with feedback, up to
 *   {@link CascadeOptions.maxRegenerationAttempts}.
 * - `escalate` — bubble up to the caller as a typed error
 *   (`CascadeValidationEscalation`); cascade halts unless the caller
 *   catches it.
 */
export interface ValidationRubric {
  /** Rubric criteria. Each criterion gets one LLM score per validation call. */
  criteria: ReadonlyArray<{
    /** Short name (e.g., `'specificity'`, `'plausibility'`). */
    name: string
    /** Description shown to the LLM judge. */
    description: string
    /** When `true`, this criterion gates `'all-load-bearing-pass'` policy. */
    loadBearing?: boolean
    /** Weight for `'weighted-ge-threshold'` policy. Default 1. */
    weight?: number
  }>
  /** How the rubric scores collapse to a verdict. */
  policy: 'all-pass' | 'all-load-bearing-pass' | 'mean-ge-threshold' | 'weighted-ge-threshold'
  /**
   * Score threshold used by `mean-ge-threshold` and
   * `weighted-ge-threshold`. Each criterion is scored 0-1; the policy
   * compares the (weighted) mean. Default 0.7.
   */
  threshold?: number
  /**
   * What to do when the rubric verdict is "fail":
   * - `'reject'` (default) — discard the entity.
   * - `'regenerate'` — re-prompt with feedback up to the orchestrator's
   *   {@link CascadeOptions.maxRegenerationAttempts}.
   * - `'escalate'` — throw {@link CascadeValidationEscalation}.
   */
  onFail?: 'reject' | 'regenerate' | 'escalate'
}

/**
 * Spec for a single child relationship in a cascade.
 *
 * Children are array-shaped (sibling-parallel fan-out) — the POC's `[->Type]`
 * pattern. A `count` directs the LLM to produce exactly N siblings (or a
 * range when `[count.min, count.max]`). The `verb` names the relation that
 * connects child→parent (e.g., `'placedBy'` for Order → Customer).
 *
 * `roles` may carry additional Frame role assignments beyond
 * subject/object — e.g., a `recipient` for `'sent'`. Values may be:
 *
 * - A literal string (Thing id) — used verbatim.
 * - The token `'$parent'` — substituted with the parent Thing id.
 * - The token `'$root'` — substituted with the cascade root Thing id.
 */
export interface ChildSpec {
  /** Child noun (e.g., `'Order'`). Must be defined in the schema or be a free-form noun the adapter accepts. */
  noun: string
  /**
   * Number of sibling children, or a `[min, max]` range. The orchestrator
   * passes the count to the LLM; the LLM is expected to honour it (the POC
   * found `min/2..max+2` works in practice for naming-style cascades).
   */
  count: number | readonly [number, number]
  /**
   * Verb connecting child → parent (the Action recorded after each child
   * is created). Subject is the child; object is the parent.
   */
  verb: string
  /**
   * Frame-role assignments beyond subject/object. Special tokens:
   * `'$parent'` resolves to the parent Thing id, `'$root'` to the root.
   */
  roles?: Partial<
    Record<Exclude<import('./db-provider-port.js').FrameRole, 'subject' | 'object'>, string>
  >
  /** Per-sibling generation hints (e.g., `'a B2B SaaS customer'`). */
  hints?: Record<string, unknown>
  /** Optional validation rubric for each generated sibling. */
  validate?: ValidationRubric
  /** Grandchildren — recursive cascade descent. */
  children?: ReadonlyArray<ChildSpec>
}

/**
 * Top-level cascade spec.
 *
 * The orchestrator generates one root Thing of {@link rootNoun}, optionally
 * validates it, then descends into {@link children} (sibling-parallel per
 * level, sequential between levels so parent ids exist when children
 * reference them).
 */
export interface CascadeSpec {
  rootNoun: string
  /** Generation hints for the root entity. */
  rootHints?: Record<string, unknown>
  /** Optional validation rubric for the root. */
  validate?: ValidationRubric
  /** Direct children of the root. Recursive. */
  children?: ReadonlyArray<ChildSpec>
}

/**
 * Options for {@link generateCascade}.
 */
export interface GenerateCascadeOptions extends CascadeSpec {
  /** Adapter to write through. Required. */
  adapter: DBProvider | DBProviderPort
  /**
   * Model alias or full id (e.g., `'sonnet'`, `'anthropic/claude-sonnet-4.5'`).
   * Resolved via `language-models`'s `policyFor()` for retry / fallback.
   * Default: `'sonnet'`.
   */
  model?: string
  /**
   * Optional separate model for validation (LLM-as-judge). Defaults to
   * {@link model}. Useful when callers want a cheaper judge than generator
   * (e.g., haiku for validation, sonnet for generation).
   */
  validationModel?: string
  /**
   * Maximum cascade depth (root + descendants). Hard cap to prevent
   * runaway recursion. Default 5.
   */
  maxDepth?: number
  /** Max regeneration attempts per entity when a rubric verdict is `'regenerate'`. Default 2. */
  maxRegenerationAttempts?: number
  /**
   * Optional embedder. If provided, every generated Thing's preferred
   * text fields (per {@link buildEmbedText}) are embedded and the vector
   * stored under `$embedding` on the Thing data. Cascade waits for embed
   * before write so reads-back-during-traversal include the embedding.
   */
  embedder?: (text: string) => Promise<number[]>
  /**
   * Override the LLM call. Default: `generate.generateObject` from
   * `ai-functions`. Tests pass a mock that returns deterministic objects.
   */
  generator?: CascadeGenerator
  /**
   * Override the validator LLM call. Default: same as {@link generator}.
   * Tests pass a mock that returns deterministic verdicts.
   */
  validator?: CascadeValidator
  /**
   * Sharding strategy for the underlying {@link CascadeWriteStrategy}.
   * Default: derived from the adapter's declared `ShardingModel`.
   */
  sharding?: CascadeShardingStrategy | 'per-cascade' | 'partitioned-by-tenant' | 'unsharded'
  /**
   * Stable cascade id. The same id MUST produce the same shape (idempotency).
   * If omitted the orchestrator derives one by content-hashing the spec +
   * rootHints. Re-running with the same id re-uses content-hashed entity
   * ids and lets `ON CONFLICT DO NOTHING` short-circuit duplicate writes.
   */
  cascadeId?: string
  /** Tenant id (required for `'partitioned-by-tenant'` sharding). */
  tenantId?: string
  /**
   * Subject ThingRef for every Action recorded (the Worker / Agent that
   * initiated the cascade). When omitted, Actions carry only `subject` =
   * the parent Thing id (typical for cascade-emitted relations).
   */
  initiator?: string
  /**
   * Optional analytical fan-out hook (passed through to
   * {@link CascadeWriteStrategy}). Stack B's dual-write path
   * (DO SQLite local → Pipelines → Iceberg → ClickHouse) wires here in
   * `aip-0ypt`.
   */
  analyticalEmitter?: AnalyticalEmitter
  /**
   * Pre-built strategy. When provided, the orchestrator uses it verbatim
   * (and ignores `sharding` / `analyticalEmitter`). Useful when the caller
   * already configured the strategy with custom wiring.
   */
  strategy?: CascadeWriteStrategy
  /**
   * Optional debug logger. Default: no-op.
   */
  debug?: (message: string, data?: Record<string, unknown>) => void
}

/**
 * The function the orchestrator calls to produce one entity payload.
 *
 * Returns a flat record of fields. The orchestrator handles id derivation,
 * embedding, validation, and write — the generator is purely "make stuff up
 * for this noun".
 *
 * The default implementation calls `generateObject` from `ai-functions`
 * with a schema constructed from the spec's hints. Mocks bypass that
 * machinery for deterministic testing.
 */
export type CascadeGenerator = (input: {
  noun: string
  hints: Record<string, unknown>
  parentNoun?: string
  parentData?: Record<string, unknown>
  rootNoun: string
  rootData?: Record<string, unknown>
  cascadeId: string
  /** Path from root, e.g., `['Customer', 'Order:0', 'OrderItem:1']`. Useful for context. */
  path: ReadonlyArray<string>
  /** Sibling index within the parent's child array (0-based). */
  siblingIndex?: number
  /** Total siblings being generated for this child spec. */
  siblingCount?: number
  /** Feedback from a prior failed validation, if regenerating. */
  feedback?: string
  /** Model alias to use. */
  model: string
}) => Promise<Record<string, unknown>>

/**
 * The function the orchestrator calls to score an entity against a rubric.
 *
 * Returns one score per criterion, in the same order. Scores are 0..1.
 */
export type CascadeValidator = (input: {
  noun: string
  data: Record<string, unknown>
  rubric: ValidationRubric
  model: string
  parentData?: Record<string, unknown>
}) => Promise<{
  scores: Record<string, number>
  feedback?: string
}>

/**
 * Result of {@link generateCascade}.
 */
export interface CascadeResult {
  /** Stable cascade id (echoed back; derived if not supplied). */
  cascadeId: string
  /** Root Thing produced. Includes `$id`, `$type`, and the data fields. */
  root: GeneratedEntity
  /** All generated Things keyed by id. */
  thingsById: Map<string, GeneratedEntity>
  /** All generated Actions in write order. */
  actions: ReadonlyArray<GeneratedAction>
  /** Entities the validator rejected (NOT written). */
  rejected: ReadonlyArray<RejectedEntity>
  /** Stats for callers / observability. */
  stats: {
    generated: number
    written: number
    actionsRecorded: number
    rejectedCount: number
    regenerationAttempts: number
    embedded: number
    durationMs: number
  }
}

/**
 * A successfully-written generated entity.
 */
export interface GeneratedEntity {
  $id: string
  $type: string
  data: Record<string, unknown>
  /** Path from root (e.g., `['Customer', 'Order:0']`). */
  path: ReadonlyArray<string>
  /** Parent Thing id, if any. */
  parentId?: string
  /** Score map from the validation rubric, if validation ran. */
  validationScores?: Record<string, number>
}

/**
 * A recorded Action.
 */
export interface GeneratedAction {
  verb: string
  subject?: string
  object?: string
  roles?: Record<string, string>
  data?: Record<string, unknown>
}

/**
 * An entity rejected by the validator. Not written to storage.
 */
export interface RejectedEntity {
  noun: string
  data: Record<string, unknown>
  scores: Record<string, number>
  feedback?: string
  path: ReadonlyArray<string>
  parentId?: string
}

/**
 * Thrown when a rubric verdict is `'escalate'` — the caller must catch
 * this and decide whether to fail the cascade or recover.
 */
export class CascadeValidationEscalation extends Error {
  readonly noun: string
  readonly data: Record<string, unknown>
  readonly scores: Record<string, number>
  readonly path: ReadonlyArray<string>

  constructor(input: {
    noun: string
    data: Record<string, unknown>
    scores: Record<string, number>
    path: ReadonlyArray<string>
    feedback?: string
  }) {
    super(
      `Cascade validation escalated for ${input.noun} at ${input.path.join('/')}: ${
        input.feedback ?? 'rubric verdict was "escalate"'
      }`
    )
    this.name = 'CascadeValidationEscalation'
    this.noun = input.noun
    this.data = input.data
    this.scores = input.scores
    this.path = input.path
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Run a cascade generation against an adapter.
 *
 * @example
 * ```ts
 * import { generateCascade, createMemoryProvider } from 'ai-database'
 *
 * const result = await generateCascade({
 *   adapter: createMemoryProvider(),
 *   rootNoun: 'Customer',
 *   rootHints: { industry: 'B2B SaaS', size: 'enterprise' },
 *   children: [
 *     {
 *       noun: 'Order',
 *       count: 5,
 *       verb: 'placedBy',
 *       hints: { stage: 'closed-won' },
 *       children: [
 *         { noun: 'OrderItem', count: [2, 5], verb: 'partOf' },
 *       ],
 *     },
 *   ],
 *   model: 'sonnet',
 * })
 *
 * console.log(result.root.$id)        // root Customer id
 * console.log(result.stats.written)   // 1 + 5 + (2..5)*5
 * ```
 */
export async function generateCascade(options: GenerateCascadeOptions): Promise<CascadeResult> {
  const startedAt = Date.now()
  const model = options.model ?? 'sonnet'
  const validationModel = options.validationModel ?? model
  const maxDepth = options.maxDepth ?? 5
  const maxRegenerationAttempts = options.maxRegenerationAttempts ?? 2
  const debug = options.debug ?? (() => {})

  // Stable cascade id — caller-supplied wins; otherwise content-hash the spec.
  const cascadeId =
    options.cascadeId ??
    contentHashId('cascade', {
      rootNoun: options.rootNoun,
      rootHints: options.rootHints ?? {},
      children: options.children ?? [],
    })

  // Build the write strategy (caller-supplied wins).
  const strategy =
    options.strategy ??
    createCascadeWriteStrategy({
      adapter: options.adapter,
      ...(options.sharding !== undefined && { sharding: options.sharding }),
      defaultCascadeId: cascadeId,
      ...(options.tenantId !== undefined && { defaultTenantId: options.tenantId }),
      ...(options.analyticalEmitter !== undefined && {
        analyticalEmitter: options.analyticalEmitter,
      }),
    })

  const shard = strategy.pickShard({
    cascadeId,
    ...(options.tenantId !== undefined && { tenantId: options.tenantId }),
    rootEntity: { $id: '__pending__', $type: options.rootNoun },
  })

  // LLM hooks — defaults call ai-functions; tests pass mocks.
  const generator = options.generator ?? defaultGenerator
  const validator = options.validator ?? defaultValidator

  // State accumulators.
  const thingsById = new Map<string, GeneratedEntity>()
  const actions: GeneratedAction[] = []
  const rejected: RejectedEntity[] = []
  let regenerationAttempts = 0
  let embedded = 0

  // Verb registry — auto-define on first use.
  const definedVerbs = new Set<string>()
  const ensureVerb = async (verb: string): Promise<void> => {
    if (definedVerbs.has(verb)) return
    definedVerbs.add(verb)
    if (hasVerbRegistry(options.adapter as DBProvider)) {
      try {
        await (
          options.adapter as DBProvider & {
            defineVerb: (def: VerbDefinitionInput) => Promise<unknown>
          }
        ).defineVerb({ name: verb })
      } catch {
        // Verb may already exist; ignore.
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Generate root.
  // ---------------------------------------------------------------------------

  debug('cascade:start', { cascadeId, rootNoun: options.rootNoun })

  const rootGen = await generateAndValidate({
    noun: options.rootNoun,
    hints: options.rootHints ?? {},
    rootNoun: options.rootNoun,
    cascadeId,
    path: [options.rootNoun],
    parentKey: cascadeId,
    rubric: options.validate,
    generator,
    validator,
    model,
    validationModel,
    maxRegenerationAttempts,
    debug,
    onRegenerate: () => {
      regenerationAttempts += 1
    },
  })

  if (rootGen.outcome === 'rejected') {
    rejected.push({
      noun: options.rootNoun,
      data: rootGen.data,
      scores: rootGen.scores,
      ...(rootGen.feedback !== undefined && { feedback: rootGen.feedback }),
      path: [options.rootNoun],
    })
    return finishResult({
      cascadeId,
      root: undefined,
      thingsById,
      actions,
      rejected,
      regenerationAttempts,
      embedded,
      startedAt,
    })
  }

  // Embed before write so reads-back-during-traversal see the embedding.
  if (options.embedder) {
    const text = buildEmbedText(rootGen.data)
    if (text) {
      try {
        const vec = await options.embedder(text)
        rootGen.data['$embedding'] = vec
        embedded += 1
      } catch (err) {
        debug('cascade:embed:fail', { noun: options.rootNoun, error: errorMessage(err) })
      }
    }
  }

  const rootId = deriveEntityId(options.rootNoun, rootGen.data, cascadeId, [options.rootNoun])
  const rootEntity: GeneratedEntity = {
    $id: rootId,
    $type: options.rootNoun,
    data: rootGen.data,
    path: [options.rootNoun],
    ...(rootGen.scores && Object.keys(rootGen.scores).length > 0
      ? { validationScores: rootGen.scores }
      : {}),
  }
  thingsById.set(rootId, rootEntity)

  // Write the root via the strategy fast path.
  await strategy.writeBatch(shard, {
    things: [{ id: rootId, type: options.rootNoun, data: rootGen.data }],
  })

  debug('cascade:root:written', { id: rootId, noun: options.rootNoun })

  // ---------------------------------------------------------------------------
  // Descend into children — sibling-parallel within each spec.
  // ---------------------------------------------------------------------------

  if (options.children && options.children.length > 0 && maxDepth > 1) {
    await descendChildren({
      parent: rootEntity,
      childSpecs: options.children,
      depth: 1,
      maxDepth,
      cascadeId,
      strategy,
      shard,
      generator,
      validator,
      model,
      validationModel,
      maxRegenerationAttempts,
      embedder: options.embedder,
      debug,
      thingsById,
      actions,
      rejected,
      ensureVerb,
      initiator: options.initiator,
      onRegenerate: () => {
        regenerationAttempts += 1
      },
      onEmbed: () => {
        embedded += 1
      },
    })
  }

  return finishResult({
    cascadeId,
    root: rootEntity,
    thingsById,
    actions,
    rejected,
    regenerationAttempts,
    embedded,
    startedAt,
  })
}

// =============================================================================
// Internal — recursive descent
// =============================================================================

interface DescendArgs {
  parent: GeneratedEntity
  childSpecs: ReadonlyArray<ChildSpec>
  depth: number
  maxDepth: number
  cascadeId: string
  strategy: CascadeWriteStrategy
  shard: ShardRef
  generator: CascadeGenerator
  validator: CascadeValidator
  model: string
  validationModel: string
  maxRegenerationAttempts: number
  embedder: GenerateCascadeOptions['embedder']
  debug: (message: string, data?: Record<string, unknown>) => void
  thingsById: Map<string, GeneratedEntity>
  actions: GeneratedAction[]
  rejected: RejectedEntity[]
  ensureVerb: (verb: string) => Promise<void>
  initiator: string | undefined
  onRegenerate: () => void
  onEmbed: () => void
}

async function descendChildren(args: DescendArgs): Promise<void> {
  if (args.depth >= args.maxDepth) {
    args.debug('cascade:max-depth-reached', { depth: args.depth, parent: args.parent.$id })
    return
  }

  // Pre-derive child ids per spec so grandchildren backrefs land cleanly,
  // and so the rubric-rejected children don't leak ids into the cascade.
  for (const spec of args.childSpecs) {
    await args.ensureVerb(spec.verb)
    const count = resolveCount(spec.count)
    if (count <= 0) continue

    args.debug('cascade:children:start', {
      parent: args.parent.$id,
      noun: spec.noun,
      count,
      verb: spec.verb,
    })

    // Sibling-parallel fan-out — every sibling generated concurrently.
    const siblingPromises = Array.from({ length: count }, (_, siblingIndex) =>
      generateOneSibling({
        spec,
        siblingIndex,
        siblingCount: count,
        parent: args.parent,
        cascadeId: args.cascadeId,
        generator: args.generator,
        validator: args.validator,
        model: args.model,
        validationModel: args.validationModel,
        maxRegenerationAttempts: args.maxRegenerationAttempts,
        embedder: args.embedder,
        rootData: args.thingsById.get(args.parent.path[0] ?? args.parent.$id)?.data,
        rootNoun: args.parent.path[0] ?? args.parent.$type,
        debug: args.debug,
        onRegenerate: args.onRegenerate,
        onEmbed: args.onEmbed,
      })
    )
    const siblingResults = await Promise.all(siblingPromises)

    // Collect accepted siblings; queue Things + Actions for the batch commit.
    const things: CascadeThing[] = []
    const cascadeActions: CascadeAction[] = []
    const acceptedSiblings: GeneratedEntity[] = []

    for (const result of siblingResults) {
      if (result.outcome === 'rejected') {
        args.rejected.push({
          noun: spec.noun,
          data: result.data,
          scores: result.scores,
          ...(result.feedback !== undefined && { feedback: result.feedback }),
          path: result.path,
          parentId: args.parent.$id,
        })
        continue
      }

      const childEntity: GeneratedEntity = {
        $id: result.id,
        $type: spec.noun,
        data: result.data,
        path: result.path,
        parentId: args.parent.$id,
        ...(result.scores && Object.keys(result.scores).length > 0
          ? { validationScores: result.scores }
          : {}),
      }
      args.thingsById.set(result.id, childEntity)
      acceptedSiblings.push(childEntity)
      things.push({ id: result.id, type: spec.noun, data: result.data })

      // Build the Action with proper Frame role assignment. Subject is the
      // child (it acts via the verb); object is the parent. Tokens
      // `'$parent'`/`'$root'` in `spec.roles` get resolved.
      const resolvedRoles = resolveRoleTokens(spec.roles, args.parent, args.thingsById)
      cascadeActions.push({
        verb: spec.verb,
        subject: result.id,
        object: args.parent.$id,
        ...(args.initiator !== undefined && {
          roles: { ...resolvedRoles, source: args.initiator },
        }),
        ...(args.initiator === undefined && Object.keys(resolvedRoles).length > 0
          ? { roles: resolvedRoles }
          : {}),
        status: 'completed',
      })
      args.actions.push({
        verb: spec.verb,
        subject: result.id,
        object: args.parent.$id,
        ...(Object.keys(resolvedRoles).length > 0 ? { roles: resolvedRoles } : {}),
      })
    }

    // Single batch commit per child spec — Things + Actions in one round-trip
    // through the strategy's fast path (CTE jsonb-bulk for PG).
    if (things.length > 0 || cascadeActions.length > 0) {
      await args.strategy.writeBatch(args.shard, { things, actions: cascadeActions })
    }

    args.debug('cascade:children:written', {
      parent: args.parent.$id,
      noun: spec.noun,
      accepted: acceptedSiblings.length,
      rejected: count - acceptedSiblings.length,
    })

    // Recurse into grandchildren — sequentially per accepted sibling so that
    // the cascade tree builds depth-first within each branch. Sibling-level
    // parallelism is preserved at the same level (we just generated all
    // siblings concurrently).
    if (spec.children && spec.children.length > 0 && args.depth + 1 < args.maxDepth) {
      for (const sibling of acceptedSiblings) {
        await descendChildren({
          ...args,
          parent: sibling,
          childSpecs: spec.children,
          depth: args.depth + 1,
        })
      }
    }
  }
}

// =============================================================================
// Internal — single-entity generation + validation loop
// =============================================================================

interface GenerateAndValidateArgs {
  noun: string
  hints: Record<string, unknown>
  rootNoun: string
  cascadeId: string
  path: ReadonlyArray<string>
  /**
   * The "parent key" used in id derivation (per the lineage-key discipline
   * from `cf-substrate/tierA-cascade`). For the root that's the cascadeId;
   * for children, the parent's $id.
   */
  parentKey: string
  parentNoun?: string
  parentData?: Record<string, unknown>
  rootData?: Record<string, unknown>
  siblingIndex?: number
  siblingCount?: number
  rubric: ValidationRubric | undefined
  generator: CascadeGenerator
  validator: CascadeValidator
  model: string
  validationModel: string
  maxRegenerationAttempts: number
  debug: (message: string, data?: Record<string, unknown>) => void
  onRegenerate: () => void
}

interface GenerateAndValidateResult {
  outcome: 'accepted' | 'rejected'
  data: Record<string, unknown>
  scores: Record<string, number>
  feedback?: string
}

async function generateAndValidate(
  args: GenerateAndValidateArgs
): Promise<GenerateAndValidateResult> {
  let attempt = 0
  let feedback: string | undefined

  while (true) {
    const data = await args.generator({
      noun: args.noun,
      hints: args.hints,
      ...(args.parentNoun !== undefined && { parentNoun: args.parentNoun }),
      ...(args.parentData !== undefined && { parentData: args.parentData }),
      rootNoun: args.rootNoun,
      ...(args.rootData !== undefined && { rootData: args.rootData }),
      cascadeId: args.cascadeId,
      path: args.path,
      ...(args.siblingIndex !== undefined && { siblingIndex: args.siblingIndex }),
      ...(args.siblingCount !== undefined && { siblingCount: args.siblingCount }),
      ...(feedback !== undefined && { feedback }),
      model: args.model,
    })

    // No rubric → accept verbatim.
    if (!args.rubric) {
      return { outcome: 'accepted', data, scores: {} }
    }

    const verdict = await args.validator({
      noun: args.noun,
      data,
      rubric: args.rubric,
      model: args.validationModel,
      ...(args.parentData !== undefined && { parentData: args.parentData }),
    })

    const passed = applyRubricPolicy(args.rubric, verdict.scores)
    args.debug('cascade:validate', {
      noun: args.noun,
      path: args.path,
      passed,
      attempt,
      scores: verdict.scores,
    })

    if (passed) {
      return {
        outcome: 'accepted',
        data,
        scores: verdict.scores,
        ...(verdict.feedback !== undefined && { feedback: verdict.feedback }),
      }
    }

    // Failed verdict — apply onFail policy.
    const onFail = args.rubric.onFail ?? 'reject'

    if (onFail === 'escalate') {
      throw new CascadeValidationEscalation({
        noun: args.noun,
        data,
        scores: verdict.scores,
        path: args.path,
        ...(verdict.feedback !== undefined && { feedback: verdict.feedback }),
      })
    }

    if (onFail === 'regenerate' && attempt < args.maxRegenerationAttempts) {
      attempt += 1
      args.onRegenerate()
      feedback =
        verdict.feedback ??
        `Previous attempt failed validation: ${JSON.stringify(verdict.scores)}. Improve.`
      continue
    }

    // reject (or regenerate exhausted) → return rejected.
    return {
      outcome: 'rejected',
      data,
      scores: verdict.scores,
      ...(verdict.feedback !== undefined && { feedback: verdict.feedback }),
    }
  }
}

interface SiblingResult {
  outcome: 'accepted' | 'rejected'
  id: string
  data: Record<string, unknown>
  scores: Record<string, number>
  feedback?: string
  path: ReadonlyArray<string>
}

async function generateOneSibling(args: {
  spec: ChildSpec
  siblingIndex: number
  siblingCount: number
  parent: GeneratedEntity
  cascadeId: string
  generator: CascadeGenerator
  validator: CascadeValidator
  model: string
  validationModel: string
  maxRegenerationAttempts: number
  embedder: GenerateCascadeOptions['embedder']
  rootData: Record<string, unknown> | undefined
  rootNoun: string
  debug: (message: string, data?: Record<string, unknown>) => void
  onRegenerate: () => void
  onEmbed: () => void
}): Promise<SiblingResult> {
  const path = [...args.parent.path, `${args.spec.noun}:${args.siblingIndex}`]
  const result = await generateAndValidate({
    noun: args.spec.noun,
    hints: args.spec.hints ?? {},
    rootNoun: args.rootNoun,
    cascadeId: args.cascadeId,
    path,
    parentKey: args.parent.$id,
    parentNoun: args.parent.$type,
    parentData: args.parent.data,
    ...(args.rootData !== undefined && { rootData: args.rootData }),
    siblingIndex: args.siblingIndex,
    siblingCount: args.siblingCount,
    ...(args.spec.validate !== undefined && { rubric: args.spec.validate }),
    rubric: args.spec.validate,
    generator: args.generator,
    validator: args.validator,
    model: args.model,
    validationModel: args.validationModel,
    maxRegenerationAttempts: args.maxRegenerationAttempts,
    debug: args.debug,
    onRegenerate: args.onRegenerate,
  })

  if (result.outcome === 'rejected') {
    return {
      outcome: 'rejected',
      id: '',
      data: result.data,
      scores: result.scores,
      ...(result.feedback !== undefined && { feedback: result.feedback }),
      path,
    }
  }

  // Embed BEFORE write so the embedding lands in the same write as the data.
  if (args.embedder) {
    const text = buildEmbedText(result.data)
    if (text) {
      try {
        const vec = await args.embedder(text)
        result.data['$embedding'] = vec
        args.onEmbed()
      } catch (err) {
        args.debug('cascade:embed:fail', { noun: args.spec.noun, error: errorMessage(err) })
      }
    }
  }

  const id = deriveEntityId(args.spec.noun, result.data, args.parent.$id, path)

  return {
    outcome: 'accepted',
    id,
    data: result.data,
    scores: result.scores,
    ...(result.feedback !== undefined && { feedback: result.feedback }),
    path,
  }
}

// =============================================================================
// Internal — id derivation, content hashing, role token resolution
// =============================================================================

/**
 * Derive a stable entity id from (parentKey + noun + path + sortable data).
 *
 * This is the lineage-key discipline from `cf-substrate/tierA-cascade`:
 * every child's id includes the parent's full idempotency key, so sibling
 * children at the same position across two cascade runs cannot collide.
 *
 * Same inputs → same id → idempotency on the write path
 * (`ON CONFLICT DO NOTHING`).
 */
function deriveEntityId(
  noun: string,
  data: Record<string, unknown>,
  parentKey: string,
  path: ReadonlyArray<string>
): string {
  return `${noun.toLowerCase()}-${contentHashId(noun, {
    parentKey,
    path: [...path],
    data: stableData(data),
  })}`
}

/**
 * Content-hash an object to a short stable string. FNV-1a 32-bit, hex, 8 chars.
 */
function contentHashId(prefix: string, value: unknown): string {
  const json = stableStringify(value)
  let h = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i)
    h = (h * 0x01000193) >>> 0
  }
  // 32 bits of stable hash → 8 hex chars. Combine with a second pass for
  // a 16-char id (still short, much lower collision risk than 8).
  const second = (h ^ 0xdeadbeef) >>> 0
  let h2 = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    h2 ^= json.charCodeAt((i * 7) % json.length) ^ ((second >>> i % 32) & 0xff)
    h2 = (h2 * 0x01000193) >>> 0
  }
  const a = h.toString(16).padStart(8, '0')
  const b = h2.toString(16).padStart(8, '0')
  return `${prefix.toLowerCase().replace(/[^a-z0-9]/g, '')}-${a}${b}`
}

/**
 * Stable JSON stringify — keys sorted recursively. Required because object
 * key order isn't guaranteed across runs / engines, which would yield
 * different content hashes for "the same" data.
 */
function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val === null || typeof val !== 'object' || Array.isArray(val)) return val
    const sortedKeys = Object.keys(val as Record<string, unknown>).sort()
    const result: Record<string, unknown> = {}
    for (const k of sortedKeys) {
      result[k] = (val as Record<string, unknown>)[k]
    }
    return result
  })
}

/**
 * Strip transient fields (timestamps, embeddings, internal `$_` fields)
 * before hashing — id stability shouldn't depend on volatile data.
 */
function stableData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(data)) {
    if (k === 'createdAt' || k === 'updatedAt' || k === '$embedding') continue
    if (k.startsWith('_')) continue
    out[k] = v
  }
  return out
}

/**
 * Resolve `'$parent'`/`'$root'` tokens in role assignments.
 */
function resolveRoleTokens(
  roles: ChildSpec['roles'],
  parent: GeneratedEntity,
  thingsById: Map<string, GeneratedEntity>
): Record<string, string> {
  if (!roles) return {}
  const out: Record<string, string> = {}
  for (const [role, value] of Object.entries(roles)) {
    if (typeof value !== 'string') continue
    if (value === '$parent') {
      out[role] = parent.$id
    } else if (value === '$root') {
      // Find the root by walking parent.path (root is path[0]); thingsById's
      // first entry is the root in our orchestrator order.
      const rootEntry = thingsById.values().next().value as GeneratedEntity | undefined
      if (rootEntry) out[role] = rootEntry.$id
    } else {
      out[role] = value
    }
  }
  return out
}

/**
 * Resolve a `count` spec to an integer: literal, or randomized between
 * `[min, max]` (deterministic via the cascade content hash, but for now
 * we use Math.random — the LLM honours hints and the count is a soft
 * target).
 */
function resolveCount(spec: number | readonly [number, number]): number {
  if (typeof spec === 'number') return Math.max(0, Math.floor(spec))
  const [min, max] = spec
  if (min < 0 || max < min) return 0
  if (min === max) return min
  return Math.floor(min + Math.random() * (max - min + 1))
}

// =============================================================================
// Internal — rubric policy evaluation
// =============================================================================

function applyRubricPolicy(rubric: ValidationRubric, scores: Record<string, number>): boolean {
  const threshold = rubric.threshold ?? 0.7
  switch (rubric.policy) {
    case 'all-pass': {
      for (const c of rubric.criteria) {
        const s = scores[c.name]
        if (s === undefined || s < (rubric.threshold ?? 1)) return false
      }
      return true
    }
    case 'all-load-bearing-pass': {
      for (const c of rubric.criteria) {
        if (!c.loadBearing) continue
        const s = scores[c.name]
        if (s === undefined || s < (rubric.threshold ?? 1)) return false
      }
      return true
    }
    case 'mean-ge-threshold': {
      const values: number[] = []
      for (const c of rubric.criteria) {
        const s = scores[c.name]
        if (s === undefined) return false
        values.push(s)
      }
      if (values.length === 0) return false
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      return mean >= threshold
    }
    case 'weighted-ge-threshold': {
      let weightedSum = 0
      let weightTotal = 0
      for (const c of rubric.criteria) {
        const s = scores[c.name]
        if (s === undefined) return false
        const w = c.weight ?? 1
        weightedSum += s * w
        weightTotal += w
      }
      if (weightTotal === 0) return false
      return weightedSum / weightTotal >= threshold
    }
  }
}

// =============================================================================
// Internal — embed-text builder
// =============================================================================

/**
 * Build the embedding text from a Thing's data, preferring human-readable
 * fields per the POC's `embedTextFor`. Falls back to JSON if no preferred
 * fields exist.
 */
export function buildEmbedText(data: Record<string, unknown>): string {
  const preferred = ['name', 'label', 'title', 'description', 'tagline', 'summary', 'rationale']
  const parts: string[] = []
  for (const key of preferred) {
    const v = data[key]
    if (typeof v === 'string' && v.trim().length > 0) {
      parts.push(v.trim())
    }
  }
  if (parts.length > 0) return parts.join(' — ')
  // Fallback: JSON-stringify scalar fields.
  const scalars: string[] = []
  for (const [k, v] of Object.entries(data)) {
    if (k.startsWith('$') || k.startsWith('_')) continue
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      scalars.push(`${k}: ${String(v)}`)
    }
  }
  return scalars.join(' | ')
}

// =============================================================================
// Internal — default LLM hooks (lazy import; tests pass mocks)
// =============================================================================

const defaultGenerator: CascadeGenerator = async (input) => {
  // Lazy import so tests / non-LLM environments don't pay the dep cost.
  const { generateObject } = await import('ai-functions')
  // Compose a simple schema: every hint key becomes a string field; the LLM
  // fills in additional fields. Callers wanting strict schemas should pass a
  // custom generator.
  const schema: Record<string, string> = {}
  for (const [k, v] of Object.entries(input.hints)) {
    schema[k] = typeof v === 'string' ? v : `Generate a ${k}`
  }
  // Default-fill at least one field so generateObject has work to do.
  if (Object.keys(schema).length === 0) {
    schema['name'] = `Generate a name for the ${input.noun}`
    schema['description'] = `Generate a description for the ${input.noun}`
  }

  const promptParts: string[] = [`Generate a ${input.noun} entity for cascade ${input.cascadeId}.`]
  if (input.parentNoun) {
    promptParts.push(
      `Parent: ${input.parentNoun}${
        input.parentData ? ` — ${stableStringify(stableData(input.parentData))}` : ''
      }`
    )
  }
  if (input.siblingCount && input.siblingCount > 1 && input.siblingIndex !== undefined) {
    promptParts.push(
      `This is sibling ${input.siblingIndex + 1} of ${input.siblingCount}; vary from siblings.`
    )
  }
  if (input.feedback) {
    promptParts.push(`Reviewer feedback to address: ${input.feedback}`)
  }

  // Wrap the call with model policy (retry + fallback). Failures bubble.
  let policy: { execute: <T>(op: () => Promise<T>) => Promise<T> } | null = null
  try {
    const { RetryPolicy } = await import('ai-functions')
    policy = RetryPolicy.forModel(input.model)
  } catch {
    // language-models / retry not available — call generateObject directly.
  }

  const call = async (): Promise<Record<string, unknown>> => {
    const { object } = await generateObject({
      model: input.model,
      schema,
      prompt: promptParts.join('\n'),
    })
    return object as Record<string, unknown>
  }

  if (policy) {
    return policy.execute(() => call())
  }
  return call()
}

const defaultValidator: CascadeValidator = async (input) => {
  const { generateObject } = await import('ai-functions')

  // Build a schema that asks for one score per criterion, plus optional feedback.
  const schema: Record<string, string> = { feedback: 'Brief feedback on what to improve.' }
  for (const c of input.rubric.criteria) {
    schema[c.name] = `Score 0-1 for: ${c.description}`
  }

  const prompt = [
    `Evaluate this ${input.noun} against the rubric. Return a numeric score 0..1 for each criterion, and brief feedback.`,
    `Entity: ${stableStringify(stableData(input.data))}`,
    input.parentData ? `Parent context: ${stableStringify(stableData(input.parentData))}` : '',
    `Criteria: ${input.rubric.criteria.map((c) => `- ${c.name}: ${c.description}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const { object } = await generateObject({
    model: input.model,
    schema,
    prompt,
  })
  const obj = object as Record<string, unknown>
  const scores: Record<string, number> = {}
  for (const c of input.rubric.criteria) {
    const v = obj[c.name]
    scores[c.name] = typeof v === 'number' ? Math.max(0, Math.min(1, v)) : 0
  }
  return {
    scores,
    ...(typeof obj['feedback'] === 'string' && { feedback: obj['feedback'] as string }),
  }
}

// =============================================================================
// Internal — result finalization
// =============================================================================

interface FinishArgs {
  cascadeId: string
  root: GeneratedEntity | undefined
  thingsById: Map<string, GeneratedEntity>
  actions: GeneratedAction[]
  rejected: RejectedEntity[]
  regenerationAttempts: number
  embedded: number
  startedAt: number
}

function finishResult(args: FinishArgs): CascadeResult {
  return {
    cascadeId: args.cascadeId,
    root: args.root ?? {
      $id: '',
      $type: '',
      data: {},
      path: [],
    },
    thingsById: args.thingsById,
    actions: args.actions,
    rejected: args.rejected,
    stats: {
      generated: args.thingsById.size + args.rejected.length,
      written: args.thingsById.size,
      actionsRecorded: args.actions.length,
      rejectedCount: args.rejected.length,
      regenerationAttempts: args.regenerationAttempts,
      embedded: args.embedded,
      durationMs: Date.now() - args.startedAt,
    },
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Re-export type so callers can build SVOAction-shaped Actions if needed
// without importing the port directly.
export type { SVOAction }

// Mark the orchestrator's awareness that hasActionRecording is available
// (callers may invoke it directly on the adapter for ad-hoc Action recording
// outside the cascade — the orchestrator itself goes through CascadeWriteStrategy).
export { hasActionRecording }
