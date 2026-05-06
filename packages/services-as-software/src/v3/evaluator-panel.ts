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
 * The {@link EvaluatorPanel.run} method is currently a STUB returning a
 * hardcoded `'all-approved'` verdict. Real LLM dispatch wires through to
 * `ai-functions.generate` once SaS `Service.invoke` lands.
 *
 * @packageDocumentation
 */

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
}

// ============================================================================
// Run-time context
// ============================================================================

/**
 * Loose run-time context threaded into {@link EvaluatorPanel.run}.
 *
 * Intentionally permissive: the concrete shape is being negotiated with the
 * SaS `Service.invoke` work and the foundation-types branch. Today both
 * fields are opaque to the panel.
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
 *
 * Per v3 §9 the `run()` method is a STUB pending integration with
 * `ai-functions.generate` and SaS `Service.invoke`.
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
   * Run the panel against `target`. Currently a STUB.
   *
   * Contract (target shape once wired):
   *   1. For each persona, dispatch an `ai-functions.generate` call carrying
   *      `persona.persona` as the system prompt and `persona.config` as
   *      structured rubric inputs.
   *   2. Aggregate the per-persona verdicts under `signOffPolicy`.
   *   3. If at least one must-approve persona rejected and the round count is
   *      under `iterationPolicy.maxRounds`, optionally re-run (round-robin
   *      with the rejection rationale appended). Otherwise honour
   *      `onMaxRoundsExceeded`.
   *   4. Return a {@link PanelVerdict} with `rounds` set to the actual
   *      iteration count.
   *
   * STUB: returns hardcoded `'all-approved'` with one approval per persona.
   */
  run(target: unknown, ctx?: PanelRunContext): Promise<PanelVerdict>
}

// ============================================================================
// Factory + namespace value
// ============================================================================

/**
 * Internal helper — applied so the stub run signature can close over the spec.
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
    // TODO: dispatch to ai-functions.generate when SaS Service.invoke lands.
    async run(_target: unknown, _ctx?: PanelRunContext): Promise<PanelVerdict> {
      const approvals: PanelApproval[] = spec.personas.map((p) => ({
        reviewer: p.name,
        rationale: 'stub-approval pending ai-functions.generate wiring',
      }))
      return {
        verdict: 'all-approved',
        rejections: [],
        approvals,
        rounds: 1,
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
