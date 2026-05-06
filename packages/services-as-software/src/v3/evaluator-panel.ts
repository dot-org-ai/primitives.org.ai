/**
 * EvaluatorPanel — typed multi-persona reviewer primitive (v3 §9).
 *
 * An EvaluatorPanel runs N reviewer personas against a target artifact and
 * aggregates their verdicts under a declared sign-off policy. Each persona is
 * an agentic reviewer with a name, persona prompt, sign-off requirement, and
 * a free-form config bag carrying persona-specific knobs (rubric, focus,
 * sources, etc).
 *
 * Two execution modes are supported:
 *
 *   - `parallel-multi-call` (default) — each persona makes its own LLM call;
 *     N independent verdicts are aggregated under `signOffPolicy`.
 *   - `aggregate-single-call` — all personas' rubrics are merged into one
 *     structured-output prompt; one LLM call returns a multi-axis verdict.
 *     The cost-aware shortcut from v3 §9 (Migration HOW risk #2).
 *
 * **Placement note (v3 §9):** EvaluatorPanel was originally drafted for
 * `ai-evaluate`. That package is the JS sandbox-execution surface used by AI
 * agents (Cloudflare worker_loaders / Miniflare); it is the wrong home for a
 * multi-persona-reviewer primitive. Per the deferred-placement decision in
 * v3 §9, EvaluatorPanel lands inline here in `services-as-software/src/v3/`.
 *
 * **Round 7 (this commit):** {@link EvaluatorPanel.run} is now real — each
 * persona resolves to an `ai-functions.generateObject` call against a typed
 * `VerdictSchema`. Iteration semantics (`iterationPolicy.maxRounds`) live on
 * the panel surface but are *driven by the caller* (Service.verify or
 * Service.invoke) — the panel itself doesn't know what to revise, so it just
 * counts rounds and returns. Round 8 will weave round-feedback into the
 * carry-prompt.
 *
 * @packageDocumentation
 */

import { generateObject } from 'ai-functions'
import { z } from 'zod'

import { estimateCostFromUsage } from './invoke/cost-estimate.js'

// ============================================================================
// Persona shape
// ============================================================================

/**
 * A single reviewer persona on an EvaluatorPanel.
 *
 * Personas are *lightweight* — they declare a name, a persona prompt (or a
 * reference into a persona library), a sign-off requirement, and a free-form
 * config bag carrying knobs the persona factory accepted.
 *
 * This is the value shape produced by the {@link Personas} factories in
 * `./personas.ts`. Custom personas can be authored directly by constructing
 * an `AgenticPersona` literal — the factories are sugar, not a moat.
 */
export interface AgenticPersona {
  /**
   * Stable identifier for the persona within a panel. Conventionally
   * `'<archetype>-validator-<domain>'` (e.g. `'pedantic-validator-gaap'`).
   * Used as the `reviewer` key in {@link PanelRejection} / {@link PanelApproval}.
   */
  name: string
  /**
   * Persona prompt or namespace reference. May be:
   *   - an inline prompt string ("You are a pedantic validator who…"), or
   *   - a `$id` reference into a persona library / business.org.ai namespace
   *     (e.g. `'occupations.org.ai/SeniorAccountant'`).
   * Resolution is deferred to the runtime; the EvaluatorPanel does not parse
   * this field.
   */
  persona: string
  /**
   * Sign-off requirement for *this* persona within the panel.
   *   - `'must-approve'` — this persona's approval is load-bearing; rejection
   *     blocks the overall verdict regardless of `signOffPolicy`.
   *   - `'advisory'` — verdict counts toward `majority` / `weighted` policies
   *     but rejection alone does not block the panel.
   */
  signOff: 'must-approve' | 'advisory'
  /**
   * Free-form bag of persona-specific knobs (rubric, focus list, source list,
   * brandVoiceRef, expertRef, minPercent, …). Persona factories populate this
   * with the args they accepted; runtime dispatch reads it when assembling
   * the LLM prompt.
   */
  config: Record<string, unknown>
}

// ============================================================================
// Verdict shape
// ============================================================================

/**
 * Single rejection emitted by a persona during a panel run.
 */
export interface PanelRejection {
  /** {@link AgenticPersona.name} of the rejecting persona. */
  reviewer: string
  /** Free-form rationale text returned by the reviewer. */
  rationale: string
}

/**
 * Single approval emitted by a persona during a panel run.
 */
export interface PanelApproval {
  /** {@link AgenticPersona.name} of the approving persona. */
  reviewer: string
  /** Free-form rationale text returned by the reviewer. */
  rationale: string
}

/**
 * Aggregated verdict returned from {@link EvaluatorPanel.run}.
 *
 *   - `'all-approved'` — every persona approved (or every must-approve persona
 *     approved, depending on `signOffPolicy`).
 *   - `'partial'`     — some personas approved, some rejected, but the panel
 *     did not meet the rejection threshold (e.g. `majority` partially met).
 *   - `'rejected'`    — the panel rejected under its `signOffPolicy`.
 */
export interface PanelVerdict {
  verdict: 'all-approved' | 'partial' | 'rejected'
  rejections: PanelRejection[]
  approvals: PanelApproval[]
  /** Number of iteration rounds the panel actually ran (>= 1). */
  rounds: number
  /**
   * USD cost summed across every persona's LLM call this run. Round-11
   * routes per-call cost through `ai-functions.BudgetTracker` for real
   * per-model pricing (Sonnet/Opus/Haiku/GPT-4o/Gemini all priced
   * correctly; unknown models fall back to Sonnet rates with a one-time
   * warn). Always >= 0; `0` for the defensive no-personas case.
   */
  costUsd: number
}

// ============================================================================
// Run-time context
// ============================================================================

/**
 * Loose run-time context threaded into {@link EvaluatorPanel.run}.
 *
 * Intentionally permissive: the concrete shape is being negotiated with the
 * SaS `Service.invoke` work and the foundation-types branch.
 */
export interface PanelRunContext {
  /**
   * Optional kill-threshold predicate / score the panel may use to short-
   * circuit. Opaque pending integration with `ProofPredicate` (v3 §8).
   */
  killThreshold?: unknown
  /**
   * Tenant scope for persisted artefacts emitted by the panel run (verdict,
   * per-persona transcript). Per ADR-0007.
   */
  tenantRef?: string
  /**
   * Iteration round counter. Defaults to `1`. The caller increments this when
   * re-invoking the panel after a `partial` / `rejected` verdict. Round 7
   * tracks the count only — round-feedback weaving (per BaC ch.10 track-record
   * updates) is out of scope for this round.
   */
  rounds?: number
}

// ============================================================================
// Spec + interface
// ============================================================================

/**
 * Spec passed to {@link EvaluatorPanel.define}.
 *
 * `mode` defaults to `'parallel-multi-call'` when omitted.
 */
export interface EvaluatorPanelSpec {
  /** MDXLD `$id` for the panel (e.g. `'panel:claude-code-review'`). */
  $id: string
  /** Personas that participate in the panel. Order is reported back unchanged. */
  personas: AgenticPersona[]
  /**
   * Aggregation policy across persona verdicts:
   *   - `'all-approve'` — every must-approve persona must approve;
   *   - `'majority'`    — > 50% of votes (weighted by must-approve = 1, advisory = 1);
   *   - `'weighted'`    — runtime resolves a weight map (deferred; pending v3 §9 follow-up).
   */
  signOffPolicy: 'all-approve' | 'majority' | 'weighted'
  /**
   * Iteration policy when at least one persona rejects.
   *   - `maxRounds`      — total review rounds, including the first.
   *   - `onMaxRoundsExceeded` —
   *       `'escalate'` hands the verdict to a human (HITL),
   *       `'auto-fail'` finalises as `'rejected'`.
   */
  iterationPolicy: {
    maxRounds: number
    onMaxRoundsExceeded: 'escalate' | 'auto-fail'
  }
  /**
   * Execution mode. Defaults to `'parallel-multi-call'`.
   *
   *   - `'parallel-multi-call'` — N personas, N LLM calls, parallel.
   *   - `'aggregate-single-call'` — N personas, 1 LLM call with merged rubric;
   *     cost-aware shortcut from v3 §9.
   */
  mode?: 'parallel-multi-call' | 'aggregate-single-call'
}

/**
 * Materialised EvaluatorPanel — the typed value the SaS `ServiceSpec.evaluators`
 * field accepts.
 */
export interface EvaluatorPanel {
  readonly $id: string
  readonly $type: 'EvaluatorPanel'
  readonly personas: AgenticPersona[]
  readonly signOffPolicy: 'all-approve' | 'majority' | 'weighted'
  readonly iterationPolicy: {
    maxRounds: number
    onMaxRoundsExceeded: 'escalate' | 'auto-fail'
  }
  readonly mode: 'parallel-multi-call' | 'aggregate-single-call'
  /**
   * Run the panel against `target`.
   *
   * Contract:
   *   1. For each persona, dispatch an `ai-functions.generateObject` call
   *      carrying `persona.persona` as the system-style prompt and
   *      `persona.config` as structured rubric inputs. Mode selects between
   *      N parallel calls (`parallel-multi-call`) or one merged call
   *      (`aggregate-single-call`).
   *   2. Aggregate the per-persona verdicts under `signOffPolicy`.
   *   3. Track which round this is via `ctx.rounds` (defaults to 1). The
   *      panel itself does not iterate — it returns the verdict and lets the
   *      caller (Service.verify or Service.invoke) decide whether to re-run
   *      with feedback. When `rounds >= maxRounds`, `onMaxRoundsExceeded`
   *      semantics are the caller's responsibility (round 8 wiring).
   *   4. Sum LLM costs into `PanelVerdict.costUsd`.
   */
  run(target: unknown, ctx?: PanelRunContext): Promise<PanelVerdict>
}

// ============================================================================
// LLM dispatch — persona → verdict
// ============================================================================

/**
 * Single-persona verdict shape used by the LLM. Round 7 keeps it minimal:
 * `verdict` + `rationale`. Future rounds may add `confidence`, `evidence`,
 * `cite-rubric-item`, etc.
 */
const VerdictSchema = z.object({
  verdict: z.enum(['approve', 'reject']),
  rationale: z.string(),
})

/**
 * Defensive hard cap on iteration rounds, applied regardless of
 * `iterationPolicy.maxRounds`. Prevents a misconfigured panel from looping
 * forever if a future version starts iterating internally.
 */
const HARD_MAX_ROUNDS = 5

/**
 * JSON.stringify with bigint coercion (carried-input may include bigints).
 */
function safeStringify(v: unknown): string {
  return JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val))
}

/**
 * Build the per-persona prompt. Concatenates the persona descriptor, its
 * config knobs (verbatim JSON), the target under review, and an explicit
 * instruction to emit a `{ verdict, rationale }` object.
 */
function buildPersonaPrompt(persona: AgenticPersona, target: unknown, round: number): string {
  return [
    persona.persona,
    `Persona config (knobs): ${safeStringify(persona.config)}`,
    `Review round: ${round}`,
    `Target under review:`,
    safeStringify(target),
    `Emit a single verdict object: verdict ('approve' | 'reject') and a concise rationale.`,
  ].join('\n\n')
}

/**
 * Dispatch one persona → one verdict. Used by `parallel-multi-call`.
 *
 * Reads `persona.config.modelHint` (when present) so each persona can pick
 * its own model — e.g. `Personas.skeptic({ modelHint: 'opus' })` for
 * high-stakes review. Falls back to `'sonnet'` when the persona declares no
 * preference. The chosen model is threaded through to
 * {@link estimateCostFromUsage} so the cost is priced against the real rate
 * table rather than a hardcoded constant.
 */
async function runPersonaCall(
  persona: AgenticPersona,
  target: unknown,
  round: number
): Promise<{ approval?: PanelApproval; rejection?: PanelRejection; costUsd: number }> {
  const prompt = buildPersonaPrompt(persona, target, round)
  // Per-persona modelHint, falling back to Sonnet when the persona declared
  // no preference. The Personas factories store this on `config.modelHint`
  // (round-12 fix); custom literal personas may set it directly.
  const modelHint = persona.config['modelHint']
  const model: string = typeof modelHint === 'string' ? modelHint : 'sonnet'
  const result = await generateObject({
    model,
    schema: VerdictSchema,
    prompt,
  })
  // ai-functions.generateObject types `result.object` as the schema arg
  // itself (T = schema), not its inferred output. Round 7+ in ai-functions
  // will tighten this with a `z.infer<S>` overload; until then we narrow
  // via the schema's own `_output` type via a single typed cast.
  const verdict = result.object as unknown as z.infer<typeof VerdictSchema>
  const costUsd = estimateCostFromUsage(result.usage, model)
  if (verdict.verdict === 'approve') {
    return {
      approval: { reviewer: persona.name, rationale: verdict.rationale },
      costUsd,
    }
  }
  return {
    rejection: { reviewer: persona.name, rationale: verdict.rationale },
    costUsd,
  }
}

/**
 * Dispatch all personas in ONE LLM call. Builds an aggregate schema with one
 * verdict slot per persona (keyed by `name`) and a single merged prompt that
 * lists every persona's descriptor + config.
 */
async function runAggregateCall(
  personas: AgenticPersona[],
  target: unknown,
  round: number
): Promise<{ approvals: PanelApproval[]; rejections: PanelRejection[]; costUsd: number }> {
  // Build a per-persona schema slot keyed by name. Zod accepts a record-like
  // shape via z.object on a literal — we construct it dynamically from the
  // persona list.
  const shape: Record<string, typeof VerdictSchema> = {}
  for (const p of personas) {
    shape[p.name] = VerdictSchema
  }
  const aggregateSchema = z.object(shape)

  const personaBlock = personas
    .map(
      (p, i) =>
        `## Persona ${i + 1}: ${p.name}\n` +
        `${p.persona}\n` +
        `Config (knobs): ${safeStringify(p.config)}`
    )
    .join('\n\n')

  const prompt = [
    `You are emitting verdicts for ${personas.length} reviewer personas in a single pass.`,
    `Each persona has its own descriptor and config; render each one's review independently.`,
    `Review round: ${round}`,
    personaBlock,
    `Target under review:`,
    safeStringify(target),
    `Emit one verdict object per persona, keyed by persona name. Each value: { verdict: 'approve' | 'reject', rationale: string }.`,
  ].join('\n\n')

  // Aggregate mode runs every persona under a SINGLE LLM call — per-persona
  // `modelHint` is intentionally NOT honoured here (you can't ask one model
  // to roleplay another model's pricing). Use Service-level / panel-level
  // modelHint for aggregate mode; per-persona modelHint is only honoured in
  // 'parallel-multi-call' mode (see `runPersonaCall`).
  const model = 'sonnet'
  const result = await generateObject({
    model,
    schema: aggregateSchema,
    prompt,
  })
  const costUsd = estimateCostFromUsage(result.usage, model)
  const approvals: PanelApproval[] = []
  const rejections: PanelRejection[] = []
  // See note in `runPersonaCall`: `result.object` is typed as the schema arg.
  const obj = result.object as unknown as Record<
    string,
    { verdict: 'approve' | 'reject'; rationale: string }
  >
  for (const p of personas) {
    const slot = obj[p.name]
    if (!slot) {
      // Defensive: the LLM omitted a persona's slot. Treat as rejection so
      // the panel doesn't silently approve unreviewed axes.
      rejections.push({
        reviewer: p.name,
        rationale: '(missing) aggregate response omitted this persona; defaulting to reject',
      })
      continue
    }
    if (slot.verdict === 'approve') {
      approvals.push({ reviewer: p.name, rationale: slot.rationale })
    } else {
      rejections.push({ reviewer: p.name, rationale: slot.rationale })
    }
  }
  return { approvals, rejections, costUsd }
}

// ============================================================================
// Sign-off resolution
// ============================================================================

/**
 * Resolve the aggregate verdict from per-persona approvals/rejections under
 * the panel's `signOffPolicy`.
 *
 *   - `'all-approve'` — any must-approve rejection → `'rejected'`; otherwise
 *     all-approved means every persona approved (advisory rejections still
 *     downgrade to `'partial'`).
 *   - `'majority'`    — `approves > N/2` → `'all-approved'`; else if any
 *     approval exists → `'partial'`; else `'rejected'`. Must-approve
 *     rejections still hard-block to `'rejected'` (a must-approve persona
 *     overriding majority is the whole point of the must-approve flag).
 *   - `'weighted'`    — TODO: weight metadata pending. Treat as 'majority'.
 */
function resolveVerdict(
  personas: AgenticPersona[],
  approvals: PanelApproval[],
  rejections: PanelRejection[],
  policy: 'all-approve' | 'majority' | 'weighted'
): 'all-approved' | 'partial' | 'rejected' {
  const personaByName = new Map(personas.map((p) => [p.name, p]))

  // Must-approve rejection always hard-blocks regardless of policy — the
  // 'must-approve' flag exists precisely to override aggregate logic.
  const mustApproveRejected = rejections.some(
    (r) => personaByName.get(r.reviewer)?.signOff === 'must-approve'
  )

  if (policy === 'all-approve') {
    if (rejections.length === 0) return 'all-approved'
    if (mustApproveRejected) return 'rejected'
    // Only advisory rejections — partial.
    return 'partial'
  }

  // 'majority' (and 'weighted' for now — TODO: weight metadata pending).
  if (mustApproveRejected) return 'rejected'
  const total = approvals.length + rejections.length
  if (total === 0) return 'rejected'
  if (approvals.length > total / 2) return 'all-approved'
  if (approvals.length === 0) return 'rejected'
  return 'partial'
}

// ============================================================================
// Factory + namespace value
// ============================================================================

/**
 * Internal helper — builds an EvaluatorPanel value with the real `run`
 * implementation closing over the spec.
 */
function buildPanel(spec: EvaluatorPanelSpec): EvaluatorPanel {
  const mode = spec.mode ?? 'parallel-multi-call'
  return {
    $id: spec.$id,
    $type: 'EvaluatorPanel',
    personas: spec.personas,
    signOffPolicy: spec.signOffPolicy,
    iterationPolicy: spec.iterationPolicy,
    mode,
    async run(target: unknown, ctx?: PanelRunContext): Promise<PanelVerdict> {
      // Defensive no-personas case — return an empty all-approved verdict.
      if (spec.personas.length === 0) {
        return {
          verdict: 'all-approved',
          rejections: [],
          approvals: [],
          rounds: ctx?.rounds ?? 1,
          costUsd: 0,
        }
      }

      // Round count: ctx.rounds defaults to 1; clamped to the lesser of the
      // configured maxRounds and the defensive HARD_MAX_ROUNDS. The caller
      // increments ctx.rounds when re-invoking; we surface the value back on
      // the verdict but do not iterate internally (round 8 work).
      const requestedRound = ctx?.rounds ?? 1
      const cappedMax = Math.min(spec.iterationPolicy.maxRounds, HARD_MAX_ROUNDS)
      const round = Math.max(1, Math.min(requestedRound, cappedMax))

      let approvals: PanelApproval[]
      let rejections: PanelRejection[]
      let costUsd: number

      if (mode === 'aggregate-single-call') {
        const agg = await runAggregateCall(spec.personas, target, round)
        approvals = agg.approvals
        rejections = agg.rejections
        costUsd = agg.costUsd
      } else {
        // 'parallel-multi-call' — N independent LLM calls in parallel.
        const results = await Promise.all(
          spec.personas.map((p) => runPersonaCall(p, target, round))
        )
        approvals = []
        rejections = []
        costUsd = 0
        for (const r of results) {
          if (r.approval) approvals.push(r.approval)
          if (r.rejection) rejections.push(r.rejection)
          costUsd += r.costUsd
        }
      }

      const verdict = resolveVerdict(spec.personas, approvals, rejections, spec.signOffPolicy)

      // NOTE: When `round >= cappedMax` and verdict is 'partial' | 'rejected',
      // `iterationPolicy.onMaxRoundsExceeded` semantics ('escalate' vs
      // 'auto-fail') are the *caller's* responsibility — the panel reports
      // the verdict and the round count; Service.verify / Service.invoke
      // decides whether to surface to HITL or finalise. Round 8 will wire a
      // structured `escalate-required` flag here when callers need it.

      return {
        verdict,
        rejections,
        approvals,
        rounds: round,
        costUsd,
      }
    },
  }
}

/**
 * `EvaluatorPanel` value namespace — paired with the {@link EvaluatorPanel}
 * type via TypeScript's value+type merge so consumers can write:
 *
 * ```ts
 * import { EvaluatorPanel } from 'services-as-software'
 * const panel = EvaluatorPanel.define({...})
 * const v: EvaluatorPanel = panel
 * ```
 */
export const EvaluatorPanel = {
  /**
   * Materialise an {@link EvaluatorPanel} from its spec. Mode defaults to
   * `'parallel-multi-call'`.
   */
  define(spec: EvaluatorPanelSpec): EvaluatorPanel {
    return buildPanel(spec)
  },
}
