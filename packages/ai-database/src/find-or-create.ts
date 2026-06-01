/**
 * The live `findOrCreate` adapter + the semantic-identity verb surface (aip-cnks.4).
 *
 * This is the ai-database side of the findOrCreate seam. The pure decision policy
 * (`decide(Evidence) → Verdict`) and the impure ladder collector (`collect(input,
 * ports) → Evidence`) are COMMITTED in `ai-functions/find-or-create` and imported
 * here, never redefined — this module owns only the *adapters* and *materializers*:
 *
 *  1. `createFindPorts(backend, opts)` — a live {@link FindPorts} over a
 *     {@link FindOrCreateBackend}: `exact` (normalized key/name lookup), `lexical`
 *     (FTS / keyword overlap), `vector` (embed via the ai-functions embeddings
 *     socket → ANN), optional `ratify` (an LLM judge port), and `thresholds`
 *     (injected per-Noun calibration; default `null` → the core fails safe).
 *  2. `findOrCreate` / `findOrCreateMany` — `collect → decide → materialize`:
 *     `link` reuses the canonical row, `mint` persists (embed-on-write), and
 *     `quarantine` escalates (throws {@link EscalationRequired} by default;
 *     `opts.onEscalate: 'throw' | 'mint' | 'skip'`).
 *  3. `findOrGenerate` — the same gate, but CREATE delegates to an injected
 *     `generate(seed)` materializer (LLM authorship) before persisting.
 *  4. `routeFuzzyRef` — the gate-routing helper the schema `~>`/`<~` resolvers
 *     delegate to, so the declarative operators and the imperative verbs share one
 *     decision core.
 *
 * The `$generation` Noun policy (`'never' | 'auto' | 'review'`) type-gates the
 * generatable verbs: a Noun whose `$generation` is `'never'` exposes neither
 * `generate` nor `findOrGenerate` (conditional type {@link GeneratableVerbs}), and a
 * CREATE decision on such a Noun becomes ESCALATE, never minting fabricated reality.
 *
 * DEFERRED (real-DB integration): `createFindPorts` is exercised here against the
 * {@link InMemoryFindBackend}. Wiring `FindOrCreateBackend` onto the live pg+ch
 * `DBProvider` (pgvector ANN + tsvector FTS, ADR-0003) and the real ai-functions
 * embeddings socket for `embed()` is a follow-up; the seam is the
 * `FindOrCreateBackend` port, so no decision logic changes when that lands.
 *
 * @packageDocumentation
 */
import { collect, decide } from 'ai-functions/find-or-create'
import type {
  Evidence,
  FindPorts,
  GateCandidate,
  GateMode,
  ResolveInput,
  ThresholdBand,
  Verdict,
} from 'ai-functions/find-or-create'

// Re-export the committed gate-core surface so consumers of ai-database have a
// single import site for both the verbs and the types they speak in.
export { collect, decide }
export type { Evidence, FindPorts, GateCandidate, GateMode, ResolveInput, ThresholdBand, Verdict }

// =============================================================================
// $generation Noun policy
// =============================================================================

/**
 * Generatability is a Noun policy, declared once on the schema — not a per-call
 * choice. A `Customer`/`Lead`/`Person` has a real-world referent and must never be
 * fabricated (`'never'`); a `BlogPost`/`Offer` is a synthesized artifact (`'auto'`
 * / `'review'`). The type system enforces it: `generate`/`findOrGenerate` are
 * absent on a `'never'` Noun, and a CREATE decision on one escalates.
 */
export type GenerationPolicy = 'never' | 'auto' | 'review'

/** A minimal thing the gate persists/links. Mirrors ai-database's `Thing` shape. */
export interface FoundThing {
  readonly $id: string
  readonly $type: string
  readonly [key: string]: unknown
}

// =============================================================================
// Backend port — the seam between the adapter and live/in-memory storage
// =============================================================================

/**
 * The minimal storage capability the live adapter drives. Both the in-memory test
 * fake and the real pg+ch `DBProvider` (pgvector + FTS) structurally satisfy it.
 * `embed` is supplied by the ai-functions embeddings socket in production and by a
 * deterministic stand-in in tests, so the ladder is unit-testable with no network.
 */
export interface FindOrCreateBackend {
  /** Exact normalized key/name lookup (O(1)). Returns the canonical id or null. */
  exactLookup(noun: string, normalizedKey: string): Promise<string | null>
  /** Lexical / FTS keyword search. Best-first, scores in [0,1]. */
  lexicalSearch(noun: string, text: string, limit: number): Promise<readonly RawHit[]>
  /** Vector ANN over the given query embedding in the given gate mode. Best-first. */
  vectorSearch(noun: string, embedding: readonly number[], mode: GateMode, limit: number): Promise<readonly RawHit[]>
  /** Embed query/seed text in the given mode (asymmetric-match vs symmetric-collapse). */
  embed(text: string, mode: GateMode): Promise<number[]>
  /** Persist a new entity (embed-on-write so future vector finds can match it). */
  create(noun: string, data: Record<string, unknown>): Promise<FoundThing>
  /** Load an existing entity by id (for `link` materialization). */
  get(noun: string, id: string): Promise<FoundThing | null>
  /** Record that `source` exposed the canonical (provenance, never destructive merge). */
  addProvenance?(noun: string, id: string, source: string): Promise<void>
}

/** A raw scored hit from a backend tier. */
export interface RawHit {
  readonly id: string
  readonly score: number
}

// =============================================================================
// Text normalization (the exact tier's key) — pure, lexical, mode-agnostic
// =============================================================================

/** Normalize free text to the exact-tier key: lowercased, collapsed whitespace. */
export function normalizeKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

// =============================================================================
// createFindPorts — the live FindPorts adapter
// =============================================================================

/** A small/fast LLM judge over the marginal (judge-floor) band. */
export type RatifyJudge = (
  input: ResolveInput,
  candidate: GateCandidate
) => Promise<{ accept: boolean; confidence: number }>

/** Options for {@link createFindPorts}. */
export interface FindPortsOptions {
  /**
   * Injected per-Noun calibration. Default returns `null` (uncalibrated) so the
   * gate core fails safe to escalate rather than auto-linking a fuzzy match.
   */
  readonly thresholds?: (noun: string) => ThresholdBand | null
  /** Optional LLM ratifier for the marginal band. Absent → fail-safe escalation. */
  readonly ratify?: RatifyJudge
  /** Candidate fan-out per tier (default 10). */
  readonly limit?: number
}

const DEFAULT_LIMIT = 10

/**
 * Build a live {@link FindPorts} over a {@link FindOrCreateBackend}. Each tier maps
 * 1:1 to a backend capability; the exact tier flags `exact: true` (the core
 * short-circuits on it), lexical/vector flag `exact: false`.
 */
export function createFindPorts(
  backend: FindOrCreateBackend,
  options: FindPortsOptions = {}
): FindPorts {
  const limit = options.limit ?? DEFAULT_LIMIT
  const thresholds = options.thresholds ?? (() => null)

  const ports: FindPorts = {
    async exact(input: ResolveInput): Promise<GateCandidate | null> {
      const key = input.key ? normalizeKey(input.key) : normalizeKey(input.text)
      const id = await backend.exactLookup(input.noun, key)
      return id ? { id, score: 1, exact: true } : null
    },
    async lexical(input: ResolveInput): Promise<readonly GateCandidate[]> {
      const hits = await backend.lexicalSearch(input.noun, input.text, limit)
      return hits.map((h) => ({ id: h.id, score: h.score, exact: false }))
    },
    async vector(input: ResolveInput): Promise<readonly GateCandidate[]> {
      const embedding = await backend.embed(input.text, input.mode)
      const hits = await backend.vectorSearch(input.noun, embedding, input.mode, limit)
      return hits.map((h) => ({ id: h.id, score: h.score, exact: false }))
    },
    thresholds,
  }
  if (options.ratify) ports.ratify = options.ratify
  return ports
}

// =============================================================================
// findOrCreate / findOrCreateMany — gate → materialize
// =============================================================================

/** What to do when the gate quarantines (escalates). Default `'throw'`. */
export type OnEscalate = 'throw' | 'mint' | 'skip'

/** The materialized outcome of one findOrCreate, mapping the gate verdict. */
export interface FindOrCreateResult {
  readonly decision: 'linked' | 'minted' | 'quarantined'
  readonly thing: FoundThing | null
  readonly confidence: number
  readonly mechanism: string
  readonly reason?: string
}

/** Input to the imperative findOrCreate verb. */
export interface FindOrCreateInput {
  readonly noun: string
  readonly mode: GateMode
  /** Text to resolve against (the find ladder's query). */
  readonly text: string
  /** Explicit normalized key (e.g. SKU/ISBN), overriding text for the exact tier. */
  readonly key?: string
  /** The entity to persist on CREATE. */
  readonly data: Record<string, unknown>
  /** Closed reference/enum Noun → CREATE escalates instead of minting. */
  readonly closedPool?: boolean
  /** Where this reference came from — tracked on the canonical (provenance). */
  readonly provenance?: string
}

/** Options for the findOrCreate materializers. */
export interface FindOrCreateOptions {
  readonly ports: FindPorts
  readonly backend: FindOrCreateBackend
  readonly onEscalate?: OnEscalate
}

/** Thrown when the gate quarantines and `onEscalate` is `'throw'` (the default). */
export class EscalationRequired extends Error {
  readonly noun: string
  readonly verdict: Extract<Verdict, { kind: 'quarantine' }>
  constructor(noun: string, verdict: Extract<Verdict, { kind: 'quarantine' }>) {
    super(`findOrCreate escalation required for ${noun}: ${verdict.reason} (${verdict.mechanism})`)
    this.name = 'EscalationRequired'
    this.noun = noun
    this.verdict = verdict
  }
}

function toResolveInput(input: FindOrCreateInput): ResolveInput {
  const r: ResolveInput = { text: input.text, noun: input.noun, mode: input.mode }
  return {
    ...r,
    ...(input.key !== undefined ? { key: input.key } : {}),
    ...(input.closedPool !== undefined ? { closedPool: input.closedPool } : {}),
  }
}

/**
 * Materialize a single verdict. `create` is the CREATE materializer — `backend.create`
 * for findOrCreate, the injected `generate→persist` for findOrGenerate.
 */
async function materialize(
  input: FindOrCreateInput,
  verdict: Verdict,
  opts: FindOrCreateOptions,
  create: (input: FindOrCreateInput) => Promise<FoundThing>
): Promise<FindOrCreateResult> {
  const { backend, noun } = { backend: opts.backend, noun: input.noun }

  if (verdict.kind === 'link') {
    const thing = await backend.get(noun, verdict.canonical)
    if (input.provenance && backend.addProvenance) {
      await backend.addProvenance(noun, verdict.canonical, input.provenance)
    }
    return { decision: 'linked', thing, confidence: verdict.confidence, mechanism: verdict.mechanism }
  }

  if (verdict.kind === 'mint') {
    const thing = await create(input)
    if (input.provenance && backend.addProvenance) {
      await backend.addProvenance(noun, thing.$id, input.provenance)
    }
    return { decision: 'minted', thing, confidence: verdict.confidence, mechanism: verdict.mechanism }
  }

  // quarantine
  const onEscalate = opts.onEscalate ?? 'throw'
  if (onEscalate === 'mint') {
    const thing = await create(input)
    if (input.provenance && backend.addProvenance) {
      await backend.addProvenance(noun, thing.$id, input.provenance)
    }
    return { decision: 'minted', thing, confidence: verdict.confidence, mechanism: 'escalate-mint' }
  }
  if (onEscalate === 'skip') {
    return {
      decision: 'quarantined',
      thing: null,
      confidence: verdict.confidence,
      mechanism: verdict.mechanism,
      reason: verdict.reason,
    }
  }
  throw new EscalationRequired(noun, verdict)
}

/**
 * `findOrCreate(entity)` = `find ?? create`. Runs the find ladder + decision core,
 * then materializes: `link` reuses the canonical, `mint` persists the supplied
 * `data` (embed-on-write), `quarantine` escalates per `onEscalate`.
 */
export async function findOrCreate(
  input: FindOrCreateInput,
  opts: FindOrCreateOptions
): Promise<FindOrCreateResult> {
  const evidence = await collect(toResolveInput(input), opts.ports)
  const verdict = decide(evidence)
  return materialize(input, verdict, opts, (i) => opts.backend.create(i.noun, i.data))
}

/**
 * `findOrCreateMany(inputs)` — per-item verdicts (the cohort runtime). Items are
 * resolved sequentially so that an earlier mint is visible (embed-on-write) to a
 * later, semantically-equivalent item: N references collapse to one mint + N−1
 * links rather than N rows.
 */
export async function findOrCreateMany(
  inputs: readonly FindOrCreateInput[],
  opts: FindOrCreateOptions
): Promise<FindOrCreateResult[]> {
  const results: FindOrCreateResult[] = []
  for (const input of inputs) {
    results.push(await findOrCreate(input, opts))
  }
  return results
}

// =============================================================================
// findOrGenerate — gate then GENERATE on CREATE
// =============================================================================

/** Input to findOrGenerate — CREATE authors the entity from `seed` via the LLM. */
export interface FindOrGenerateInput {
  readonly noun: string
  readonly mode: GateMode
  readonly text: string
  readonly key?: string
  /** The seed the generator authors a full entity from. */
  readonly seed: Record<string, unknown>
  readonly closedPool?: boolean
  readonly provenance?: string
  /**
   * The Noun's generation policy. `'never'` makes findOrGenerate unavailable at the
   * type level (see {@link GeneratableVerbs}); at runtime a CREATE on a `'never'`
   * Noun escalates rather than fabricating reality.
   */
  readonly generation?: GenerationPolicy
}

/** Options for findOrGenerate — `generate` is the CREATE materializer. */
export interface FindOrGenerateOptions {
  readonly ports: FindPorts
  readonly backend: FindOrCreateBackend
  readonly onEscalate?: OnEscalate
  /** LLM authorship: turn a seed into a full entity to persist. */
  readonly generate: (seed: Record<string, unknown>, noun: string) => Promise<Record<string, unknown>>
}

/**
 * `findOrGenerate(seed)` = `find ?? generate`. Same gate as findOrCreate, but the
 * CREATE materializer delegates to `generate(seed)` (LLM authorship) before
 * persisting. A `'never'` generation policy forces ESCALATE on CREATE — the cascade
 * authors content but must never invent the real-world entities it references.
 */
export async function findOrGenerate(
  input: FindOrGenerateInput,
  opts: FindOrGenerateOptions
): Promise<FindOrCreateResult> {
  // Cascade-safety invariant: a CREATE/mint on a 'never' Noun is ESCALATE, never generation.
  const escalateOnCreate = input.generation === 'never'

  const foc: FindOrCreateInput = {
    noun: input.noun,
    mode: input.mode,
    text: input.text,
    data: input.seed,
    ...(input.key !== undefined ? { key: input.key } : {}),
    ...(input.closedPool !== undefined ? { closedPool: input.closedPool } : {}),
    ...(input.provenance !== undefined ? { provenance: input.provenance } : {}),
  }

  const evidence = await collect(toResolveInput(foc), opts.ports)
  const verdict = decide(evidence)

  // 'never' Noun: any non-link verdict becomes a quarantine (don't fabricate reality).
  const effective: Verdict =
    escalateOnCreate && verdict.kind === 'mint'
      ? { kind: 'quarantine', mechanism: 'generation-never', confidence: verdict.confidence, reason: 'CREATE on a $generation:never Noun must escalate, not generate' }
      : verdict

  const materializeOpts: FindOrCreateOptions = {
    ports: opts.ports,
    backend: opts.backend,
    ...(opts.onEscalate !== undefined ? { onEscalate: opts.onEscalate } : {}),
  }

  return materialize(foc, effective, materializeOpts, async (i) => {
    const authored = await opts.generate(input.seed, i.noun)
    return opts.backend.create(i.noun, authored)
  })
}

// =============================================================================
// Public verb surface — the type-gated method shapes for the entity proxy
// =============================================================================

/**
 * The semantic-identity verbs available on EVERY Noun: `find` (tiered hybrid →
 * match | null), `create` (persist supplied data), `findOrCreate` (find ?? create).
 */
export interface BaseSemanticVerbs<TData extends Record<string, unknown>> {
  find(input: { text: string; key?: string; mode?: GateMode }): Promise<FoundThing | null>
  create(data: TData): Promise<FoundThing>
  findOrCreate(input: Omit<FindOrCreateInput, 'noun' | 'mode'> & { mode?: GateMode }): Promise<FindOrCreateResult>
}

/**
 * The generatable verbs — present ONLY on Nouns whose `$generation !== 'never'`.
 * `generate(seed)` (LLM-author + persist) and `findOrGenerate(seed)` (find ??
 * generate). On a `'never'` Noun these are structurally absent (`never`).
 */
export interface GeneratableOnly<TData extends Record<string, unknown>, TSeed extends Record<string, unknown>> {
  generate(seed: TSeed): Promise<FoundThing>
  findOrGenerate(
    input: Omit<FindOrGenerateInput, 'noun' | 'mode' | 'generation'> & { mode?: GateMode }
  ): Promise<FindOrCreateResult>
}

/**
 * Conditional type that gates the generatable verbs on the Noun's `$generation`
 * policy. `'never'` → only {@link BaseSemanticVerbs} (calling `.generate(...)`
 * doesn't compile); `'auto'`/`'review'` → also {@link GeneratableOnly}.
 */
export type GeneratableVerbs<
  TData extends Record<string, unknown>,
  TSeed extends Record<string, unknown>,
  TGen extends GenerationPolicy
> = TGen extends 'never'
  ? BaseSemanticVerbs<TData>
  : BaseSemanticVerbs<TData> & GeneratableOnly<TData, TSeed>

// =============================================================================
// routeFuzzyRef — the gate-routing seam for the ~>/<~ operators
// =============================================================================

/**
 * The shared decision routine the schema `~>` (forward-fuzzy) and `<~`
 * (backward-fuzzy) resolvers delegate to, so the declarative operators and the
 * imperative verbs use ONE decision core. `~>` (relationship resolution,
 * name → other-type node) is `asymmetric-match`; entity-dedup `findOrCreate` is
 * `symmetric-collapse`. Returns the verdict; the resolver maps `link` → reuse the
 * canonical id, `mint` → generate/persist, `quarantine` → leave unresolved/escalate.
 *
 * NOTE: wiring this into the 167KB schema.ts resolver (replacing its ad-hoc
 * 0.75-threshold semantic search) is the remaining "unify ~>/<~" integration;
 * this function is that seam, unit-tested via the gate above.
 */
export async function routeFuzzyRef(
  input: { text: string; key?: string; noun: string; operator: '~>' | '<~'; closedPool?: boolean },
  ports: FindPorts
): Promise<Verdict> {
  const resolveInput: ResolveInput = {
    text: input.text,
    noun: input.noun,
    // ~> and <~ are relationship resolution → asymmetric MATCH mode.
    mode: 'asymmetric-match',
    ...(input.key !== undefined ? { key: input.key } : {}),
    ...(input.closedPool !== undefined ? { closedPool: input.closedPool } : {}),
  }
  const evidence = await collect(resolveInput, ports)
  return decide(evidence)
}

// =============================================================================
// InMemoryFindBackend — hermetic test backend (no DB, no network)
// =============================================================================

interface StoredRow {
  thing: FoundThing
  key: string
  text: string
  embedding: number[]
  tokens: Set<string>
  provenance: Set<string>
}

function tokenize(text: string): string[] {
  return normalizeKey(text)
    .split(' ')
    .filter((w) => w.length > 0)
}

/**
 * A deterministic, dependency-free bag-of-words embedding for the in-memory
 * backend — semantically-overlapping texts share more token dimensions, so cosine
 * ranks related rows above unrelated ones without any model call. Production
 * `embed()` is the real ai-functions embeddings socket (deferred wiring).
 */
function bagOfWordsEmbedding(text: string, vocab: Map<string, number>): number[] {
  const tokens = tokenize(text)
  for (const t of tokens) if (!vocab.has(t)) vocab.set(t, vocab.size)
  const vec = new Array(vocab.size).fill(0)
  for (const t of tokens) {
    const i = vocab.get(t)!
    vec[i] += 1
  }
  return vec
}

function cosine(a: readonly number[], b: readonly number[]): number {
  const n = Math.max(a.length, b.length)
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    dot += x * y
    na += x * x
    nb += y * y
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom === 0 ? 0 : dot / denom
}

/**
 * In-memory {@link FindOrCreateBackend} for unit tests — extends the
 * `memory-provider` notion to the find-ladder shape. Deterministic, hermetic.
 */
export class InMemoryFindBackend implements FindOrCreateBackend {
  private rows = new Map<string, StoredRow[]>()
  private vocab = new Map<string, number>()
  private seq = 0

  private rowsFor(noun: string): StoredRow[] {
    let list = this.rows.get(noun)
    if (!list) {
      list = []
      this.rows.set(noun, list)
    }
    return list
  }

  count(noun: string): number {
    return this.rows.get(noun)?.length ?? 0
  }

  provenanceOf(noun: string, id: string): string[] {
    const row = this.rows.get(noun)?.find((r) => r.thing.$id === id)
    return row ? [...row.provenance] : []
  }

  async exactLookup(noun: string, normalizedKey: string): Promise<string | null> {
    const row = this.rowsFor(noun).find((r) => r.key === normalizedKey)
    return row ? row.thing.$id : null
  }

  async lexicalSearch(noun: string, text: string, limit: number): Promise<readonly RawHit[]> {
    const queryTokens = new Set(tokenize(text))
    if (queryTokens.size === 0) return []
    const scored = this.rowsFor(noun)
      .map((r) => {
        let overlap = 0
        for (const t of queryTokens) if (r.tokens.has(t)) overlap += 1
        const union = new Set([...queryTokens, ...r.tokens]).size
        const score = union === 0 ? 0 : overlap / union // Jaccard in [0,1]
        return { id: r.thing.$id, score }
      })
      .filter((h) => h.score > 0)
      .sort((p, q) => (q.score !== p.score ? q.score - p.score : p.id < q.id ? -1 : 1))
    return scored.slice(0, limit)
  }

  async vectorSearch(
    noun: string,
    embedding: readonly number[],
    _mode: GateMode,
    limit: number
  ): Promise<readonly RawHit[]> {
    const scored = this.rowsFor(noun)
      .map((r) => ({ id: r.thing.$id, score: cosine(embedding, r.embedding) }))
      .filter((h) => h.score > 0)
      .sort((p, q) => (q.score !== p.score ? q.score - p.score : p.id < q.id ? -1 : 1))
    return scored.slice(0, limit)
  }

  async embed(text: string, _mode: GateMode): Promise<number[]> {
    return bagOfWordsEmbedding(text, this.vocab)
  }

  async create(noun: string, data: Record<string, unknown>): Promise<FoundThing> {
    const id = `${noun.toLowerCase()}-${++this.seq}`
    const thing: FoundThing = { $id: id, $type: noun, ...data }
    // The embeddable text mirrors the exact-tier key source: name → code → title → joined values.
    const text = embeddableText(data)
    const row: StoredRow = {
      thing,
      key: deriveKey(data, text),
      text,
      embedding: bagOfWordsEmbedding(text, this.vocab),
      tokens: new Set(tokenize(text)),
      provenance: new Set(),
    }
    this.rowsFor(noun).push(row)
    return thing
  }

  async get(noun: string, id: string): Promise<FoundThing | null> {
    return this.rowsFor(noun).find((r) => r.thing.$id === id)?.thing ?? null
  }

  async addProvenance(noun: string, id: string, source: string): Promise<void> {
    const row = this.rowsFor(noun).find((r) => r.thing.$id === id)
    if (row) row.provenance.add(source)
  }
}

/** Pick the primary text from entity data for embedding/keying. */
function embeddableText(data: Record<string, unknown>): string {
  const primary = data['name'] ?? data['title'] ?? data['code']
  if (typeof primary === 'string') return primary
  return Object.values(data)
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
}

/** Derive the exact-tier key: an explicit `key` field wins, else the normalized text. */
function deriveKey(data: Record<string, unknown>, text: string): string {
  const explicit = data['key']
  return typeof explicit === 'string' ? normalizeKey(explicit) : normalizeKey(text)
}
