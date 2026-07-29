/**
 * services-as-software v4 — the QUALITY_REVIEW-phase VERIFIER adapter
 * (aip-cnks.10 pass 2).
 *
 * This is the concrete {@link Verifier} that drives the `QUALITY_REVIEW` phase
 * of the invocation FSM (see `./invoke.ts`) by adapting v3's
 * {@link EvaluatorPanel} — the intra-package 3-rater panel — into the v4 port.
 * services-as-software (L6) owns both v3 and v4, so the panel is consumed
 * directly (no reverse-layer import): the v3 panel is the rater substrate, the
 * v4 {@link VerificationVerdict} is the rolled-up verdict the FSM reads.
 *
 * ## The mapping
 *
 * {@link EvaluatorPanel.run} returns a {@link PanelVerdict} — a `verdict`
 * (`all-approved` | `partial` | `rejected`) plus per-persona `approvals` /
 * `rejections` and a `costUsd`. The adapter rolls that into a
 * {@link VerificationVerdict}:
 *
 *   - `all-approved` → rollup `auto-promote`;
 *   - `rejected`     → rollup `reject`;
 *   - `partial`      → rollup `queue-review`.
 *
 * Each `approval` becomes a `pass` {@link RaterVerdict}, each `rejection` a
 * `fail`; the panel's persona verdicts are synthesised into the *exactly-3*
 * `raters` tuple the FSM event spine carries (padded / capped — the v4 verdict
 * is canonically a 3-rater shape regardless of the panel's persona count). The
 * requested `assurance` is carried through on a non-reject verdict, and
 * DOWNGRADED to `unverifiable` when the panel rejects (a failed review attests
 * nothing).
 *
 * The panel runs against `ctx.output` — the cascade's typed result — so the
 * personas judge the delivered artifact, not an empty envelope.
 *
 * @packageDocumentation
 */

import { EvaluatorPanel } from '../v3/evaluator-panel.js'
import type {
  EvaluatorPanelSpec,
  PanelApproval,
  PanelRejection,
  PanelVerdict,
  PanelRunContext,
} from '../v3/evaluator-panel.js'

import type { Verifier, VerifyCtx } from './invoke.js'
import type { Assurance, RaterVerdict, VerificationVerdict } from './types.js'

// ============================================================================
// Verdict mapping
// ============================================================================

/** Map a {@link PanelVerdict.verdict} → a {@link VerificationVerdict.rollup}. */
function rollupOf(verdict: PanelVerdict['verdict']): VerificationVerdict['rollup'] {
  switch (verdict) {
    case 'all-approved':
      return 'auto-promote'
    case 'rejected':
      return 'reject'
    case 'partial':
      return 'queue-review'
  }
}

/**
 * Synthesise the canonical *exactly-3* {@link RaterVerdict} tuple from the
 * panel's per-persona approvals/rejections. Approvals → `pass`, rejections →
 * `fail`. The v4 verdict is a 3-rater shape by construction; a panel with
 * fewer signals is padded with `needs_review` placeholders, a panel with more
 * is capped to the first three (the load-bearing signal is the `rollup`, not
 * the raw count — the raters are the human-readable rationale window).
 */
function synthesizeRaters(
  approvals: readonly PanelApproval[],
  rejections: readonly PanelRejection[]
): readonly [RaterVerdict, RaterVerdict, RaterVerdict] {
  const signals: RaterVerdict[] = [
    ...approvals.map(
      (a): RaterVerdict => ({ rater: a.reviewer, verdict: 'pass', rationale: a.rationale })
    ),
    ...rejections.map(
      (r): RaterVerdict => ({ rater: r.reviewer, verdict: 'fail', rationale: r.rationale })
    ),
  ]
  while (signals.length < 3) {
    signals.push({
      rater: `synthetic-${signals.length}`,
      verdict: 'needs_review',
      rationale: '(synthesized) panel reported fewer than three persona signals',
    })
  }
  return [signals[0]!, signals[1]!, signals[2]!]
}

// ============================================================================
// makeEvaluatorPanelVerifier — the adapter
// ============================================================================

/** Options for the {@link makeEvaluatorPanelVerifier} adapter. */
export interface EvaluatorPanelVerifierOpts {
  /**
   * Optional sink for the panel's per-run USD cost. The FSM handle can wire
   * this to emit a `cost-incurred` event; absent ⇒ the cost is dropped.
   */
  onCost?: (costUsd: number) => void
  /** Optional {@link PanelRunContext} threaded into every `panel.run` call. */
  runContext?: PanelRunContext
}

/**
 * Adapt a v3 {@link EvaluatorPanel} into the v4 {@link Verifier} port. The
 * returned verifier runs the panel against `ctx.output` and maps the
 * {@link PanelVerdict} into a {@link VerificationVerdict} (see the module
 * docblock for the mapping). Injectable into
 * `createInvocationHandle({ verifier })`.
 */
export function makeEvaluatorPanelVerifier<TOut = unknown>(
  panel: EvaluatorPanel,
  opts: EvaluatorPanelVerifierOpts = {}
): Verifier<TOut> {
  return {
    async verify(ctx: VerifyCtx<TOut>): Promise<VerificationVerdict> {
      const panelVerdict = await panel.run(ctx.output, opts.runContext)
      if (opts.onCost) opts.onCost(panelVerdict.costUsd)

      const rollup = rollupOf(panelVerdict.verdict)
      // A rejected review attests nothing — downgrade the achieved assurance.
      const assuranceAchieved: Assurance = rollup === 'reject' ? 'unverifiable' : ctx.assurance

      return {
        metric: ctx.metric,
        raters: synthesizeRaters(panelVerdict.approvals, panelVerdict.rejections),
        rollup,
        assuranceAchieved,
      }
    },
  }
}

/**
 * Convenience: build a {@link Verifier} straight from an
 * {@link EvaluatorPanelSpec} (materialises the panel via
 * {@link EvaluatorPanel.define}, then adapts it). Saves the caller a two-step
 * `define`-then-`make` when they only need the verifier.
 */
export function fromSpec<TOut = unknown>(
  spec: EvaluatorPanelSpec,
  opts: EvaluatorPanelVerifierOpts = {}
): Verifier<TOut> {
  return makeEvaluatorPanelVerifier<TOut>(EvaluatorPanel.define(spec), opts)
}
