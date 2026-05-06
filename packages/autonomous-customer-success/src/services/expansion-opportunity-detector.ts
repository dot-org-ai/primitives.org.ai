/**
 * Expansion Opportunity Detector Service — usage-trend-driven expansion
 * revenue Service for the customer-success catalog.
 *
 * Distinguishing shape vs. siblings (`account-review`, `nps-followup`,
 * `support-triage`, `churn-rescue`, `onboarding-runbook`, `csm-qbr-deck`):
 *   - `expansion-research` archetype — the artefact is a CSM-bound outreach
 *     draft anchored on a researched expansion hypothesis, not a brief / deck
 *     / triage decision;
 *   - 5-step cascade with one supervised Agentic stakeholder-research step
 *     (the only one in the customer-success catalog), bookended by Code
 *     fan-in (account usage + product graph) and Human review-and-send;
 *   - `percentOf` pricing — 5% of realised expansion-ARR, capped at $25k
 *     per account (the Service shares in the upside it creates);
 *   - declarative HITL = mandatory CSM review-and-send Human Function (the
 *     CSM owns the relationship, the Service owns the hypothesis), plus
 *     OutcomeContract requires CSM signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(insight-novelty +
 *     outreach-quality) + HumanSign(CSM))`.
 *
 * Per design v3 §3 (Catalog HOW customer-success) + §6 (binding triggers,
 * conditional HumanSign) + §7 (percentOf pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `net-revenue-retention-rate-improvement` — the
 * compound metric every customer-success org optimises against.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — an account-usage-trend webhook firing on any account where
 * monthly-active-user count grew > 30% in the trailing 30 days. Tight: 5
 * fields cover account identity, the trend window, the observed growth
 * delta, the current ARR (so the cap is computable), and the assigned CSM
 * (so the Human review step routes to the right inbox).
 */
export const UsageTrendWebhookSchema = z.object({
  accountRef: z.string(),
  trendWindow: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  mauGrowth: z.object({
    priorMau: z.number().int().nonnegative(),
    currentMau: z.number().int().nonnegative(),
    growthPercent: z.number().min(30),
  }),
  currentArrCents: z.bigint(),
  assignedCsmRef: z.string(),
})

/**
 * Output — a CSM-reviewed expansion outreach: the consumed usage signals,
 * the identified expansion vector + buying signals, the researched
 * stakeholder + recent-news context, the drafted outreach, and the
 * CSM-review audit (decision, reviewer ref, sent timestamp).
 */
export const ExpansionOutreachOutputSchema = z.object({
  accountRef: z.string(),
  expansionHypothesis: z.object({
    vector: z.enum([
      'seat-expansion',
      'tier-upgrade',
      'cross-sell-product',
      'usage-overage-conversion',
      'multi-team-rollout',
    ]),
    buyingSignals: z.array(z.string()).min(1),
    estimatedExpansionArrCents: z.bigint(),
    confidence: z.number().min(0).max(1),
  }),
  stakeholderResearch: z.object({
    primaryStakeholder: z.object({
      name: z.string(),
      title: z.string(),
      linkedinUrl: z.string().optional(),
    }),
    additionalStakeholders: z.array(
      z.object({
        name: z.string(),
        title: z.string(),
      })
    ),
    recentNewsCitations: z.array(
      z.object({
        url: z.string(),
        publishedAt: z.string(),
        relevance: z.string(),
      })
    ),
  }),
  outreachDraft: z.object({
    subject: z.string(),
    bodyMarkdown: z.string(),
    suggestedSendAt: z.string(),
  }),
  csmReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['send-as-drafted', 'edit-and-send', 'park', 'discard']),
    reviewedAt: z.string(),
    sentAt: z.string().optional(),
  }),
  generatedAt: z.string(),
})

export type UsageTrendWebhook = z.infer<typeof UsageTrendWebhookSchema>
export type ExpansionOutreachOutput = z.infer<typeof ExpansionOutreachOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_nrrImprovement: RewardSignal = {
  keyResultRef: 'kr:expansion-opportunity-detector:net-revenue-retention-rate-improvement',
}
const kr_signalCoverage: RewardSignal = {
  keyResultRef: 'kr:expansion-opportunity-detector:signal-coverage',
}
const kr_insightNovelty: RewardSignal = {
  keyResultRef: 'kr:expansion-opportunity-detector:insight-novelty',
}
const kr_researchQuality: RewardSignal = {
  keyResultRef: 'kr:expansion-opportunity-detector:stakeholder-research-quality',
}
const kr_outreachQuality: RewardSignal = {
  keyResultRef: 'kr:expansion-opportunity-detector:outreach-quality',
}

// ============================================================================
// Expansion Opportunity Detector Service
// ============================================================================

/**
 * Expansion Opportunity Detector — usage-trend webhook → expansion
 * hypothesis → researched outreach → CSM-sent expansion play as a Service.
 *
 * Cascade: fetch-account-usage-and-product-graph (Code, product-analytics fan-in)
 *        → identify-expansion-vector-and-buying-signals (Generative)
 *        → research-org-stakeholders-and-recent-news (Agentic, supervised)
 *        → draft-csm-outreach-with-expansion-hypothesis (Generative)
 *        → csm-review-and-send (Human, load-bearing).
 */
export const expansionOpportunityDetector: ServiceInstance<
  UsageTrendWebhook,
  ExpansionOutreachOutput
> = Service.define<UsageTrendWebhook, ExpansionOutreachOutput>({
  name: 'Expansion Opportunity Detector',
  promise:
    'Every account with a usage-growth signal gets a researched, CSM-reviewed expansion outreach within hours of the trend firing — and the Service only earns when expansion ARR realises.',
  audience: 'business',
  archetype: 'expansion-research',
  schema: { input: UsageTrendWebhookSchema, output: ExpansionOutreachOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-account-usage-and-product-graph',
        reward: kr_signalCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'identify-expansion-vector-and-buying-signals',
        reward: kr_insightNovelty,
      }),
      Agentic({
        name: 'research-org-stakeholders-and-recent-news',
        reward: kr_researchQuality,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({
        name: 'draft-csm-outreach-with-expansion-hypothesis',
        reward: kr_outreachQuality,
      }),
      Human({
        name: 'csm-review-and-send',
        rationale: 'trust',
        // CSM review stays human — the relationship belongs to the CSM,
        // not the Service. No promotion threshold ever displaces this step.
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
    ],
    toolPermissions: [
      'product-analytics.usage',
      'product-analytics.feature-graph',
      'crm.contacts',
      'crm.opportunities',
      'clearbit.companies',
      'linkedin.profiles',
      'apollo.contacts',
      'web.search',
      'gmail.send',
    ],
    // Webhook-triggered: clarification disabled — the cascade does not
    // pause to ask the CSM for clarification. The CSM review step at the
    // end is the single human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // High-ARR accounts (>= $250k current ARR) escalate the research
        // step to a senior CSM-supervisor before the outreach drafts.
        when: 'currentArrCents >= 25000000n',
        action: 'escalate',
      },
      {
        // Every outreach routes through CSM review-and-send before it
        // sends; OutcomeContract enforces the signature, the trigger
        // primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'csm-review-and-send',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:expansion-opportunity-detector-review',
    personas: [
      // Insight novelty reviewer — adversarially probes whether the
      // expansion hypothesis is grounded in the usage signals and not
      // a generic "buy more seats" boilerplate the CSM could have
      // written without the Service.
      Personas.skeptic({
        domain: 'insight-novelty',
        focus: ['signal-grounded', 'not-generic', 'csm-could-not-have-known'],
        name: 'insight-novelty-reviewer',
      }),
      // Outreach quality reviewer — pedantic check that the drafted
      // outreach hits brand-voice + has a clear ask + cites the
      // researched stakeholder context.
      Personas.pedantic({
        domain: 'outreach-quality',
        rubric: [
          'opens-with-stakeholder-context',
          'cites-researched-news-or-event',
          'states-explicit-expansion-ask',
          'matches-brand-voice',
          'no-generic-boilerplate',
        ],
        name: 'outreach-quality-checker',
      }),
      // CSM domain reviewer — pulls the CustomerSuccessManagers expert
      // for senior CSM judgment on the overall play.
      Personas.domain({
        expertRef: 'occupations.org.ai/CustomerSuccessManagers',
        name: 'csm-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:expansion-opportunity-detector:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-cs-lead',
    seller: 'svc:expansion-opportunity-detector',
    serviceRef: 'svc:expansion-opportunity-detector',
    // CSM signs every outreach before it sends — the relationship is
    // the CSM's, the play is the Service's.
    predicate: AND(
      SchemaMatch(ExpansionOutreachOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['csm'] })
    ),
    // Variable amount — settled at expansion-realisation time per the
    // percentOf pricing rule below.
    amount: { amount: 0n, currency: 'USD' },
    // 3-day SLA from webhook fire to CSM-sendable outreach.
    timeoutDays: 3,
    onTimeout: 'escalate',
  },

  // 5% of realised expansion ARR, capped at $25k per account. The metering
  // runtime resolves the `expansion-arr-realized` basis to the post-
  // settlement expansion-ARR delta and computes the charge as
  // `(realised_basis * 500) / 10000`, clamped at the $25k cap.
  pricing: Pricing.percentOf({
    basis: 'expansion-arr-realized',
    rateBasisPoints: 500,
    cap: { amount: 2500000n, currency: 'USD' },
  }),

  refundContract: 'no-charge-if-not-qualified',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 800n, perApiCall: 10n },
  reward: kr_nrrImprovement,

  lineage: {
    cellRef: 'business.org.ai/cells/customer-success-managers/expansion-opportunity-detection',
    icpContextProblemRef: 'icp:expansion-opportunity-detector:v1',
    foundingHypothesisRef: 'fh:expansion-opportunity-detector:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
