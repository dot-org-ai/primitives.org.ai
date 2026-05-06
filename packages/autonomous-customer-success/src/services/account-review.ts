/**
 * Account Review Service — round-11 catalog Service for the quarterly
 * account-health → renewal-forecast → expansion-brief loop in the
 * customer-success domain.
 *
 * Demonstrates: subscription pricing with metered overage (monthly base +
 * per-account-reviewed metered line), `multi-step-research` archetype,
 * partly-supervised cascade (score-health + forecast-renewal run under HITL
 * supervision), declarative HITL routing via `binding.triggers` (low health
 * scores escalate; large expansion opportunities route back to the supervised
 * identify-expansion step for human-supervised analysis), EvaluatorPanel of 3
 * personas (attribution-checker + forecast-skeptic + csm-domain) under
 * `all-approve`, AND-composed OutcomeContract predicate (SchemaMatch +
 * EvaluatorPass), `sla-credit-on-late-delivery` refund, `tenant-only`
 * authority, 7-day `timeoutDays`, clarification disabled (briefs are
 * synthesised from CRM + product-analytics signal — operators don't pause a
 * QBR cadence to clarify with the brief synthesizer).
 *
 * Per design v1 §3.D (Catalog HOW agent's Customer Success Account-review
 * spec) + v3 §6 (binding triggers) + v3 §7 (subscription + metered pricing
 * factory) + v3 §8 (ProofPredicate AND composition) + round-6 cleanups
 * (Pricing factory call) + round-9 (`{ enabled: false }` clarification form,
 * `timeoutDays`).
 *
 * Layer note: this Service lives in `autonomous-customer-success` (L5) and
 * depends on `services-as-software` (L5), `autonomous-finance` (L3), and
 * `digital-tools` (L4). No `Human` Functions in the cascade — HITL gates
 * are declarative triggers + per-Function `mode: 'supervised'` oversight.
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
 * Input — a single account scheduled for quarterly review. Tight: 2 fields
 * capture the account identity and the calendar period under review (quarter
 * + year). The cascade does the heavy lifting (Stripe + CRM + product-
 * analytics pulls).
 */
export const AccountReviewInputSchema = z.object({
  accountRef: z.string(),
  period: z.object({
    quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
    year: z.number().int().min(2020).max(2100),
  }),
})

/**
 * Output — a quarterly account brief: a normalised health score, a renewal
 * forecast (likelihood + expected ARR in cents), a list of expansion
 * opportunities (each with sized estimate), the synthesised brief text, and
 * a pointer to the scheduled CSM follow-up.
 */
export const AccountBriefOutputSchema = z.object({
  accountRef: z.string(),
  healthScore: z.number().min(0).max(1),
  renewalForecast: z.object({
    likelihood: z.number().min(0).max(1),
    expectedArr: z.bigint(),
  }),
  expansionOpportunities: z.array(
    z.object({
      productLine: z.string(),
      opportunitySize: z.bigint(), // USD cents
      rationale: z.string(),
    })
  ),
  brief: z.string(),
  scheduledFollowupRef: z.string(),
})

export type AccountReviewInput = z.infer<typeof AccountReviewInputSchema>
export type AccountBriefOutput = z.infer<typeof AccountBriefOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands.
// ============================================================================

const kr_grossRetention: RewardSignal = { keyResultRef: 'kr:account-review:gross-retention' }
const kr_usagePullCoverage: RewardSignal = {
  keyResultRef: 'kr:account-review:usage-pull-coverage',
}
const kr_healthAccuracy: RewardSignal = { keyResultRef: 'kr:account-review:health-accuracy' }
const kr_forecastAccuracy: RewardSignal = {
  keyResultRef: 'kr:account-review:forecast-accuracy',
}
const kr_expansionQuality: RewardSignal = {
  keyResultRef: 'kr:account-review:expansion-quality',
}
const kr_briefQuality: RewardSignal = { keyResultRef: 'kr:account-review:brief-quality' }
const kr_followupScheduled: RewardSignal = {
  keyResultRef: 'kr:account-review:followup-scheduled',
}

// ============================================================================
// Account Review Service
// ============================================================================

/**
 * Account Review — quarterly account-health → renewal-forecast → expansion-
 * brief as a Service.
 *
 * Cascade: pull-usage-data (Code, stripe + crm + product-analytics pulls)
 *        → score-health (Agentic, supervised)
 *        → forecast-renewal (Agentic, supervised)
 *        → identify-expansion (Generative)
 *        → write-brief (Generative)
 *        → schedule-followup (Code, gmail send + crm task creation).
 *
 * Two declarative triggers wire HITL behaviour:
 *   - `health.score < 0.4` escalates per the oversight policy (a low health
 *     score on a quarterly review warrants immediate CSM attention);
 *   - `expansion.opportunity_size > 5_000_000_00n` (i.e. $50k+ expansion)
 *     routes back to the supervised `identify-expansion` step so a CSM
 *     reviews the sized opportunity before it appears in the brief.
 *
 * Pricing is subscription-based with per-account-reviewed metered overage —
 * customers pay $199/mo for the QBR cadence + $50 per account reviewed.
 */
export const accountReview: ServiceInstance<AccountReviewInput, AccountBriefOutput> =
  Service.define<AccountReviewInput, AccountBriefOutput>({
    name: 'Account Review',
    promise:
      'Quarterly account health → renewal forecast → expansion brief — every account, on time',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: AccountReviewInputSchema, output: AccountBriefOutputSchema },

    binding: {
      cascade: [
        Code({ name: 'pull-usage-data', reward: kr_usagePullCoverage, handler: () => undefined }),
        Agentic({
          name: 'score-health',
          reward: kr_healthAccuracy,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Agentic({
          name: 'forecast-renewal',
          reward: kr_forecastAccuracy,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Generative({ name: 'identify-expansion', reward: kr_expansionQuality }),
        Generative({ name: 'write-brief', reward: kr_briefQuality }),
        Code({
          name: 'schedule-followup',
          reward: kr_followupScheduled,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'stripe.subscriptions',
        'crm.contacts',
        'crm.opportunities',
        'product-analytics.usage',
        'gmail.send',
      ],
      // QBR cadence design: clarification disabled — briefs synthesise from
      // CRM + product-analytics signal; operators don't pause the QBR cadence
      // to clarify with the brief synthesizer.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Low health scores warrant immediate CSM attention — escalate.
          when: 'health.score < 0.4',
          action: 'escalate',
        },
        {
          // $50k+ expansion opportunities route back to the supervised
          // identify-expansion step so a CSM reviews the sized opportunity.
          when: 'expansion.opportunity_size > 5_000_000_00n',
          action: 'route-to',
          target: 'identify-expansion',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:account-review-review',
      personas: [
        // Attribution checker — fact-grounds usage signals against the
        // product-analytics source of truth so the brief doesn't cite usage
        // patterns the customer never produced.
        Personas.accuracy({ domain: 'usage-attribution', name: 'attribution-checker' }),
        // Forecast skeptic — adversarially probes the renewal-forecast step's
        // grounding; assumes the forecast is overstated until proven otherwise.
        Personas.skeptic({ domain: 'forecast-grounding', name: 'forecast-skeptic' }),
        // CSM domain reviewer — pulls the CustomerSuccessManagers expert from
        // business.org.ai for senior CSM judgment on the overall brief.
        Personas.domain({
          expertRef: 'occupations.org.ai/CustomerSuccessManagers',
          name: 'csm-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      // Multi-step research design: 3 rounds before escalation (one extra
      // round vs. high-volume archetypes since the artefacts are richer).
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:account-review:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-cs-lead',
      seller: 'svc:account-review',
      serviceRef: 'svc:account-review',
      // AND(schema, panel): output validates AND panel approves. No external
      // verifier — the brief lands in the CSM's queue; downstream renewal
      // close is a separate Service.
      predicate: AND(
        SchemaMatch(AccountBriefOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
      ),
      amount: { amount: 5000n, currency: 'USD' },
      // 7-day SLA per multi-step archetype default — the QBR cadence has a
      // week of wall clock for usage pulls + supervised review.
      timeoutDays: 7,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'account-review-monthly',
        amount: 19900n,
        currency: 'USD',
        interval: 'month',
      },
      metered: [
        {
          event: 'account-reviewed',
          amount: 50n,
          description: 'Per-account metered overage on top of the monthly subscription.',
        },
      ],
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 200n },
    reward: kr_grossRetention,

    lineage: {
      cellRef: 'business.org.ai/cells/customer-success-managers/quarterly-business-review',
      icpContextProblemRef: 'icp:account-review:v1',
      foundingHypothesisRef: 'fh:account-review:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
