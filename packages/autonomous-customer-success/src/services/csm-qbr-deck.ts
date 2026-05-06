/**
 * CSM QBR Deck Service — Quarterly Business Review deck generator for the
 * customer-success domain.
 *
 * Distinguishing shape vs. siblings (`account-review`, `nps-followup`,
 * `support-triage`, `churn-rescue`, `onboarding-runbook`):
 *   - `content-generation` archetype — the primary artefact is a slide deck
 *     CSMs walk customers through, not a brief or a triage decision;
 *   - 4-step cascade with two Generative authoring stages (narrative
 *     section + action-items section) bookended by Code (metrics fetch +
 *     deck render);
 *   - `subscription` pricing (the QBR cadence is a recurring engagement)
 *     with per-deck-generated metered overage — customers pay $399/mo for
 *     the cadence + $99 per deck generated above the included quota;
 *   - declarative HITL via the `csm-review` declarative trigger
 *     (red-flag accounts route through CSM review before the deck ships),
 *     plus an EvaluatorPanel that requires CSM sign-off via the OutcomeContract;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(narrative-quality +
 *     action-items-actionable) + HumanSign(CSM review))`.
 *
 * Service-level reward = `customer-attended-QBR-rate` — measures how many
 * scheduled QBRs the customer actually showed up to (a deck good enough to
 * make the meeting feel worthwhile is the leading indicator).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a customer account scheduled for QBR. Tight: 4 fields capture
 * identity, the calendar period, the scheduled meeting reference, and the
 * deck template style the CSM wants. The cascade does the heavy lifting
 * (CRM + product-analytics + billing pulls).
 */
export const QBRRequestSchema = z.object({
  accountRef: z.string(),
  period: z.object({
    quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
    year: z.number().int().min(2020).max(2100),
  }),
  scheduledMeetingRef: z.string(),
  deckTemplate: z.enum(['executive', 'detail', 'expansion-pitch']),
})

/**
 * Output — a fully rendered QBR deck: the source metrics, the synthesised
 * narrative, the action items the CSM will walk the customer through, and
 * pointers to the rendered deck artefacts (PDF + Google Slides).
 */
export const QBRDeckOutputSchema = z.object({
  accountRef: z.string(),
  period: z.object({
    quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
    year: z.number().int().min(2020).max(2100),
  }),
  metrics: z.object({
    arr: z.bigint(),
    seatsActive: z.number(),
    seatsLicensed: z.number(),
    productAdoptionScore: z.number().min(0).max(1),
    supportTicketCount: z.number(),
    npsLatest: z.number().min(-100).max(100).optional(),
  }),
  narrativeSections: z.array(
    z.object({
      heading: z.string(),
      body: z.string(),
      sourceMetricRefs: z.array(z.string()),
    })
  ),
  actionItems: z.array(
    z.object({
      title: z.string(),
      owner: z.enum(['csm', 'customer-exec', 'customer-admin', 'support']),
      dueBy: z.string(),
      rationale: z.string(),
    })
  ),
  deck: z.object({
    pdfUrl: z.string(),
    slidesUrl: z.string(),
    pageCount: z.number().int().positive(),
  }),
  csmReviewRef: z.string().optional(),
  generatedAt: z.string(),
})

export type QBRRequest = z.infer<typeof QBRRequestSchema>
export type QBRDeckOutput = z.infer<typeof QBRDeckOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_attendedQBRRate: RewardSignal = {
  keyResultRef: 'kr:csm-qbr-deck:customer-attended-qbr-rate',
}
const kr_metricsCoverage: RewardSignal = {
  keyResultRef: 'kr:csm-qbr-deck:metrics-coverage',
}
const kr_narrativeQuality: RewardSignal = {
  keyResultRef: 'kr:csm-qbr-deck:narrative-quality',
}
const kr_actionItemsActionable: RewardSignal = {
  keyResultRef: 'kr:csm-qbr-deck:action-items-actionable',
}
const kr_deckRenderLatency: RewardSignal = {
  keyResultRef: 'kr:csm-qbr-deck:deck-render-latency',
}

// ============================================================================
// CSM QBR Deck Service
// ============================================================================

/**
 * CSM QBR Deck — quarterly business review deck generator as a Service.
 *
 * Cascade: fetch-account-metrics (Code, CRM + billing + product-analytics)
 *        → narrative-section-author (Generative)
 *        → action-items-section (Generative)
 *        → render-deck (Code, slides + PDF render).
 */
export const csmQbrDeck: ServiceInstance<QBRRequest, QBRDeckOutput> = Service.define<
  QBRRequest,
  QBRDeckOutput
>({
  name: 'CSM QBR Deck',
  promise:
    'Per-customer QBR deck — metrics, narrative, action items — generated, CSM-reviewed, ready to present.',
  audience: 'business',
  archetype: 'content-generation',
  schema: { input: QBRRequestSchema, output: QBRDeckOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-account-metrics',
        reward: kr_metricsCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'narrative-section-author',
        reward: kr_narrativeQuality,
      }),
      Generative({
        name: 'action-items-section',
        reward: kr_actionItemsActionable,
      }),
      Code({ name: 'render-deck', reward: kr_deckRenderLatency, handler: () => undefined }),
    ],
    toolPermissions: [
      'crm.contacts',
      'crm.opportunities',
      'stripe.subscriptions',
      'product-analytics.usage',
      'gdrive.slides',
      'gdrive.files',
    ],
    // QBR cadence design: clarification disabled — the deck synthesises from
    // CRM + product-analytics signal; operators don't pause the QBR cadence
    // to clarify with the deck author.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Red-flag accounts (low product adoption AND seat shrink) route to
        // CSM review before the deck ships — the CSM rewrites the deck
        // narrative with a save-or-graceful-exit framing.
        when: 'metrics.productAdoptionScore < 0.4',
        action: 'escalate',
      },
      {
        // Expansion-pitch decks for $250k+ ARR accounts route back to the
        // action-items step so the CSM can supervise the expansion ask.
        when: 'deckTemplate == "expansion-pitch" && metrics.arr > 25000000n',
        action: 'route-to',
        target: 'action-items-section',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:csm-qbr-deck-review',
    personas: [
      // Narrative quality reviewer — adversarially probes whether the
      // narrative sections actually make the customer's story land.
      Personas.skeptic({
        domain: 'narrative-quality',
        focus: ['data-grounded', 'customer-relevant', 'reads-like-a-story'],
        name: 'narrative-quality-reviewer',
      }),
      // Action-items actionability reviewer — pedantic check that every
      // action item has an owner, a due date, and a clear next step.
      Personas.pedantic({
        domain: 'action-items-actionable',
        rubric: [
          'every-item-has-named-owner',
          'every-item-has-explicit-due-date',
          'every-item-has-specific-next-step',
          'no-item-is-vague-aspiration',
        ],
        name: 'action-items-checker',
      }),
      // CSM domain reviewer — pulls the CustomerSuccessManagers expert from
      // business.org.ai for senior CSM judgment on the overall deck.
      Personas.domain({
        expertRef: 'occupations.org.ai/CustomerSuccessManagers',
        name: 'csm-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:csm-qbr-deck:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-cs-lead',
    seller: 'svc:csm-qbr-deck',
    serviceRef: 'svc:csm-qbr-deck',
    // CSM signs off every deck before it ships to the customer — the deck
    // is going on the CSM's calendar, so the CSM's name is on it.
    predicate: AND(
      SchemaMatch(QBRDeckOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['csm'] })
    ),
    amount: { amount: 9900n, currency: 'USD' },
    // 5-day SLA — the cadence usually has a week of wall clock between the
    // metrics-pull window closing and the scheduled QBR meeting.
    timeoutDays: 5,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: {
      id: 'csm-qbr-deck-monthly',
      amount: 39900n,
      currency: 'USD',
      interval: 'month',
    },
    metered: [
      {
        event: 'qbr-deck-generated',
        amount: 9900n,
        description: 'Per-deck metered overage on top of the monthly subscription.',
      },
    ],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 400n },
  reward: kr_attendedQBRRate,

  lineage: {
    cellRef: 'business.org.ai/cells/customer-success-managers/quarterly-business-review',
    icpContextProblemRef: 'icp:csm-qbr-deck:v1',
    foundingHypothesisRef: 'fh:csm-qbr-deck:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
