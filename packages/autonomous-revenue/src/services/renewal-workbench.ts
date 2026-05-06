/**
 * Renewal Workbench Service — round-11 catalog Service for the upcoming-
 * renewal → usage-trend + value-brief + next-step-playbook loop in the
 * revenue / sales domain.
 *
 * Demonstrates: subscription pricing with metered overage (monthly base +
 * per-renewal-prepared metered line), `multi-step-research` archetype,
 * partly-supervised cascade (compute-value-realization runs under HITL
 * supervision), declarative HITL routing via `binding.triggers` (low value-
 * realization scores escalate; large renewal values route back to the
 * supervised recommend-playbook step for human-supervised analysis),
 * EvaluatorPanel of 2 personas (value-checker + attribution-skeptic) under
 * `all-approve`, AND-composed OutcomeContract predicate (SchemaMatch +
 * EvaluatorPass), `sla-credit-on-late-delivery` refund, `tenant-only`
 * authority, 14-day `timeoutDays`, clarification disabled (briefs synthesise
 * from CRM + product-analytics signal — operators don't pause a renewal
 * cadence to clarify with the brief synthesizer).
 *
 * Per design v3 §3.E (Catalog HOW agent's renewal-workbench spec) + §6
 * (binding triggers) + §7 (subscription + metered pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Layer note: this Service lives in `autonomous-revenue` (L5 catalog) on top
 * of the `services-as-software` + `autonomous-finance` substrate (per v3 §12
 * packaging tradeoff: each catalog domain ships in its own L5 package so the
 * substrate stays clean at L3).
 *
 * Service-level reward = `net-retention` — matches the BaC ch.7 worked example
 * where renewal preparation pulls on the net-retention hill via downstream
 * AE-led close.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a single subscription with an upcoming renewal date. Tight: 2 fields
 * capture identity (subscription ref) and the renewal date (drives the
 * identify-upcoming + pull-usage-trend windowing).
 */
export const UpcomingRenewalInputSchema = z.object({
  subscriptionRef: z.string(),
  renewsOn: z.string(), // ISO-8601 date
})

/**
 * Output — a renewal brief: a normalised value-realization score, a usage-
 * trend descriptor, the synthesised brief text, the recommended next-step
 * plays (each labelled + rationaled), and a pointer to the scheduled AE
 * follow-up.
 */
export const RenewalBriefOutputSchema = z.object({
  subscriptionRef: z.string(),
  valueRealizationScore: z.number().min(0).max(1),
  usageTrend: z.object({
    direction: z.enum(['up', 'flat', 'down']),
    pctChange: z.number(),
    summary: z.string(),
  }),
  brief: z.string(),
  recommendedPlays: z.array(
    z.object({
      label: z.string(),
      rationale: z.string(),
    })
  ),
  scheduledFollowupRef: z.string(),
})

export type UpcomingRenewalInput = z.infer<typeof UpcomingRenewalInputSchema>
export type RenewalBriefOutput = z.infer<typeof RenewalBriefOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands. Service-level kr_netRetention proxies the net-retention
// hill the brief is designed to nudge.
// ============================================================================

const kr_netRetention: RewardSignal = { keyResultRef: 'kr:renewal-workbench:net-retention' }
const kr_identifyCoverage: RewardSignal = {
  keyResultRef: 'kr:renewal-workbench:identify-coverage',
}
const kr_usageTrendAccuracy: RewardSignal = {
  keyResultRef: 'kr:renewal-workbench:usage-trend-accuracy',
}
const kr_valueRealizationAccuracy: RewardSignal = {
  keyResultRef: 'kr:renewal-workbench:value-realization-accuracy',
}
const kr_briefQuality: RewardSignal = { keyResultRef: 'kr:renewal-workbench:brief-quality' }
const kr_playbookQuality: RewardSignal = {
  keyResultRef: 'kr:renewal-workbench:playbook-quality',
}
const kr_followupScheduled: RewardSignal = {
  keyResultRef: 'kr:renewal-workbench:followup-scheduled',
}

// ============================================================================
// Renewal Workbench Service
// ============================================================================

/**
 * Renewal Workbench — upcoming renewal → usage trend + value brief + next-step
 * playbook → AE-ready in advance.
 *
 * Cascade: identify-upcoming (Code, stripe + crm pulls)
 *        → pull-usage-trend (Code, product-analytics pull)
 *        → compute-value-realization (Agentic, supervised)
 *        → draft-value-brief (Generative)
 *        → recommend-playbook (Generative)
 *        → schedule-followup (Code, gmail send + crm task creation).
 *
 * Two declarative triggers wire HITL behaviour:
 *   - `value_realization.score < 0.3` escalates per the oversight policy (a
 *     low value-realization score on an upcoming renewal warrants immediate
 *     AE attention);
 *   - `renewal.value_usd > 50_000_000n` (i.e. $500k+ renewals) routes back to
 *     the supervised `recommend-playbook` step so an AE reviews the recommended
 *     plays before they appear in the brief.
 *
 * Pricing is subscription-based with per-renewal-prepared metered overage —
 * customers pay $99/mo for the renewal cadence + $2.50 per renewal prepared.
 */
export const renewalWorkbench: ServiceInstance<UpcomingRenewalInput, RenewalBriefOutput> =
  Service.define<UpcomingRenewalInput, RenewalBriefOutput>({
    name: 'Renewal Workbench',
    promise:
      'Upcoming renewal → usage trend + value brief + next-step playbook → AE-ready in advance',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: UpcomingRenewalInputSchema, output: RenewalBriefOutputSchema },

    binding: {
      cascade: [
        Code({ name: 'identify-upcoming', reward: kr_identifyCoverage, handler: () => undefined }),
        Code({
          name: 'pull-usage-trend',
          reward: kr_usageTrendAccuracy,
          handler: () => undefined,
        }),
        Agentic({
          name: 'compute-value-realization',
          reward: kr_valueRealizationAccuracy,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Generative({ name: 'draft-value-brief', reward: kr_briefQuality }),
        Generative({ name: 'recommend-playbook', reward: kr_playbookQuality }),
        Code({
          name: 'schedule-followup',
          reward: kr_followupScheduled,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'stripe.subscriptions',
        'product-analytics.usage',
        'crm.opportunities',
        'gmail.send',
      ],
      // Renewal-cadence design: clarification disabled — briefs synthesise
      // from CRM + product-analytics signal; operators don't pause a renewal
      // cadence to clarify with the brief synthesizer.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Low value-realization scores warrant immediate AE attention.
          when: 'value_realization.score < 0.3',
          action: 'escalate',
        },
        {
          // $500k+ renewals route back to the supervised recommend-playbook
          // step so an AE reviews the recommended plays before they ship.
          when: 'renewal.value_usd > 50_000_000n',
          action: 'route-to',
          target: 'recommend-playbook',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:renewal-workbench-review',
      personas: [
        // Value checker — fact-grounds the value-realization claims against
        // the product-analytics source of truth so the brief doesn't cite
        // realisation metrics the customer never produced.
        Personas.accuracy({ domain: 'value-realization-claims', name: 'value-checker' }),
        // Attribution skeptic — adversarially probes the usage-attribution
        // chain; assumes the attribution is wrong until proven otherwise.
        Personas.skeptic({ domain: 'usage-attribution', name: 'attribution-skeptic' }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:renewal-workbench:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-revenue-ops',
      seller: 'svc:renewal-workbench',
      serviceRef: 'svc:renewal-workbench',
      // AND(schema, panel): output validates AND panel approves. No external
      // verifier — the brief lands in the AE's queue; downstream renewal close
      // is a separate Service.
      predicate: AND(
        SchemaMatch(RenewalBriefOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
      ),
      amount: { amount: 2500n, currency: 'USD' },
      // 14-day SLA — renewal prep needs two weeks of wall clock for usage
      // pulls + supervised value-realization computation + brief synthesis.
      timeoutDays: 14,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'renewal-workbench-monthly',
        amount: 9900n,
        currency: 'USD',
        interval: 'month',
      },
      metered: [
        {
          event: 'renewal-prepared',
          amount: 250n,
          description: 'Per-renewal metered overage on top of the monthly subscription.',
        },
      ],
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 150n },
    reward: kr_netRetention,

    lineage: {
      cellRef: 'business.org.ai/cells/customer-success-managers/renewal-prep',
      icpContextProblemRef: 'icp:renewal-workbench:v1',
      foundingHypothesisRef: 'fh:renewal-workbench:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
