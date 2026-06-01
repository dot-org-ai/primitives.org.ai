/**
 * Cascade orchestrator — public types and injected port interfaces.
 *
 * The orchestrator is the ④ queue-spine from
 * docs/plans/2026-06-01-strategic-primitives-hardening.md: a durable work queue
 * of refs that expand. Generating a node emits a Draft carrying child `$refs`;
 * resolving each ref through the findOrCreate gate is admission control —
 * `link` reuses an existing canonical (no enqueue), `mint` enqueues the child,
 * `escalate` defers it.
 *
 * LAYERING — ai-workflows is Layer 1 and must NOT import ai-functions (L2) or
 * ai-database (L3) for VALUES. The decision verbs (`link | mint | escalate`)
 * and the generate/admit/store seams are therefore expressed as **structural
 * port interfaces** here, owned by the orchestrator. The shapes mirror
 * ai-functions/src/find-or-create.ts (`Verdict` = link | mint | quarantine; the
 * orchestrator's `escalate` is that `quarantine` band surfaced as flow control).
 * A consumer wires a live gate by passing an `AdmitPort` whose `admit` adapts
 * `collect()` + `decide()` from ai-functions — that adapter lives in the
 * consumer / a higher layer, never here. No value crosses the layer boundary,
 * so no dependency edge and no cycle is introduced.
 */

/** Which embedding space the gate's vector tier ran in (mirrors ai-functions GateMode). */
export type CascadeMode = 'asymmetric-match' | 'symmetric-collapse'

/**
 * A reference that expands into a node. Generation emits these as a Draft's
 * `$refs`; the orchestrator resolves each via the admit gate.
 */
export interface CascadeRef {
  /** The Noun/type being referenced (e.g. 'Author', 'Problem'). */
  readonly noun: string
  /** The natural-language seed/name to resolve or generate from. */
  readonly text: string
  /** Optional exact/normalized key the gate's cheapest tier can match on. */
  readonly key?: string
  /** The embedding regime the gate should resolve this ref in. */
  readonly mode: CascadeMode
  /**
   * Prompt-context chained from the parent's output. Threaded onto the queue
   * item so the child's generation sees its parent's result.
   */
  readonly context?: unknown
}

/**
 * The output of generating one node: the materialized artifact plus the child
 * refs it points at (the Draft/Resolve two-phase — generation drafts, then a
 * resolve pass runs the gate per ref).
 */
export interface Draft<TOutput = unknown> {
  readonly output: TOutput
  readonly refs: readonly CascadeRef[]
}

/** A node being processed: the ref that produced it + (post-generation) its Draft output. */
export interface CascadeNode<TOutput = unknown> {
  readonly ref: CascadeRef
  /** Present only when the node has been generated (passed to store/admit). */
  readonly output?: TOutput
}

/**
 * Admission verdict — the orchestrator's flow-control projection of the gate's
 * decision. Structurally compatible with consuming ai-functions' `Verdict`:
 *  - `link`     → reuse the canonical, do not enqueue a child (short-circuit).
 *  - `mint`     → continue: generate (if not already) + store + enqueue children.
 *  - `escalate` → defer (the gate's `quarantine` band: think-longer / stronger
 *                 model / human review); do not generate or enqueue.
 */
export type AdmissionVerdict =
  | { readonly kind: 'link'; readonly canonical: string; readonly reason: string; readonly confidence: number }
  | { readonly kind: 'mint'; readonly reason: string; readonly confidence: number }
  | { readonly kind: 'escalate'; readonly reason: string; readonly confidence: number }

/**
 * Per-Noun timing policy (Grounding case #5).
 *  - `online`  → admission runs DURING expansion, pre-generation: a `link` skips
 *               generation entirely (zero post-hoc cleanup). Right for
 *               high-overlap Nouns (Problems, cross-standard Verbs).
 *  - `offline` → generate first, store eagerly; collapse decisions are deferred
 *               to a batch phase (`CascadeResult.deferredCollapse`). Right for
 *               low-overlap Nouns. Default when a Noun has no policy.
 */
export interface NounPolicy {
  readonly timing: 'online' | 'offline'
}

// ---------------------------------------------------------------------------
// Injected ports (structural — the orchestrator owns NONE of them)
// ---------------------------------------------------------------------------

/** Generate (author) a node, emitting a Draft. The leaf composes the LLM call. */
export interface GeneratePort<TOutput = unknown> {
  generate(node: CascadeNode<TOutput>): Promise<Draft<TOutput>>
}

/**
 * The findOrCreate gate as admission control. A live adapter wraps
 * ai-functions' `collect()` + `decide()`; the in-memory fake is pure.
 */
export interface AdmitPort {
  admit(ref: CascadeRef): Promise<AdmissionVerdict>
}

/** Persist a minted/generated node; returns its assigned id. */
export interface StorePort<TOutput = unknown> {
  store(node: CascadeNode<TOutput> & { readonly output: TOutput }): Promise<string>
}

/** The three ports the orchestrator drives. */
export interface CascadePorts<TOutput = unknown> {
  readonly generate: GeneratePort<TOutput>
  readonly admit: AdmitPort
  readonly store: StorePort<TOutput>
}

/** What the caller hands `runCascade`. */
export interface CascadeOptions<TOutput = unknown> {
  /** The seed ref that the cascade expands from. */
  readonly root: CascadeRef
  /** The injected ports (no DB/LLM owned by the orchestrator). */
  readonly ports: CascadePorts<TOutput>
  /** Per-Noun timing policies; absent Noun defaults to `offline` semantics. */
  readonly policies?: Readonly<Record<string, NounPolicy>>
  /** Safety backstop in addition to cycle detection. Default: unbounded. */
  readonly maxDepth?: number
}

/** A deferred collapse decision recorded for offline Nouns (batch phase). */
export interface DeferredCollapse {
  /** `noun:text` of the stored node. */
  readonly ref: string
  /** The id the node was stored under. */
  readonly stored: string
  /** The canonical the deferred gate would collapse it onto. */
  readonly canonical: string
}

/** The aggregate outcome of a cascade run. */
export interface CascadeResult {
  /** Stored ids of nodes that were minted (CREATE). */
  readonly minted: string[]
  /** Refs that linked to an existing canonical (FIND, short-circuit). */
  readonly linked: Array<{ readonly ref: string; readonly canonical: string }>
  /** Refs deferred to review (ESCALATE). */
  readonly escalated: Array<{ readonly ref: string; readonly reason: string }>
  /** Refs dropped by cycle/depth guards (not an error — the cascade is finite). */
  readonly skipped: Array<{ readonly ref: string; readonly reason: 'visited' | 'max-depth' }>
  /** Offline-timing collapse decisions, applied by a later batch phase. */
  readonly deferredCollapse: DeferredCollapse[]
}
