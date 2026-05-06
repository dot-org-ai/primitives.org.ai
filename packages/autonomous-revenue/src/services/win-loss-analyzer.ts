/**
 * Win-Loss Analyzer Service — closed-deal post-mortem for the revenue catalog.
 *
 * Distinguishing shape vs. siblings (`lead-qualification`, `meeting-prep`,
 * `proposal-generator`, `contract-redliner`, `renewal-workbench`,
 * `campaign-orchestrator`):
 *   - `multi-step-research` archetype with a single autonomous Agentic step
 *     that conducts a buyer interview (the longest-running step in the
 *     cascade — outbound, schedule, conduct, transcribe, summarise);
 *   - 4-step cascade: Code (extract opp history) → Agentic (conduct buyer
 *     interview, supervised) → Generative (synthesise win-loss pattern) →
 *     Code (emit report);
 *   - `outcome` pricing across S/M/L deal-size tiers — small deals are
 *     cheaper to analyse (transactional purchases), large deals justify
 *     the senior-AE-level outbound effort to land the buyer interview;
 *   - declarative HITL via two triggers: (a) any deal >$1M routes the
 *     interview-conductor through supervised review, (b) any
 *     interview-decline routes back to a CRM-only synthesis path so the
 *     report still ships;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(insight-novelty +
 *     actionability) + External(salesforce.opportunity-updated))` — the
 *     CRM update is load-bearing because the report is only useful if it
 *     lands on the opp record where the AE will see it on the next deal.
 *
 * Service-level reward = `rep-quota-attainment-improvement` — measures the
 * delta in rep quota attainment between reps who consume win-loss reports
 * and a control cohort that doesn't. Multi-quarter signal, but the most
 * directly load-bearing outcome we can measure.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, External, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a closed opportunity (won or lost). Tight: 7 fields capture
 * identity, the close outcome, the deal economics, the AE who owned it,
 * and the buyer-side contact the cascade will attempt to interview.
 */
export const ClosedOpportunitySchema = z.object({
  opportunityRef: z.string(),
  accountRef: z.string(),
  closeOutcome: z.enum(['won', 'lost', 'no-decision']),
  closedAt: z.string(),
  dealSize: z.bigint(), // ARR in USD cents
  aeRef: z.string(),
  primaryBuyerContactRef: z.string(),
  competitorRefs: z.array(z.string()).optional(),
})

/**
 * Output — a win-loss report: the opportunity history (stage transitions,
 * key timeline beats), the buyer interview transcript + summary, the
 * synthesised win-loss pattern (factors that drove the outcome), and the
 * actionable recommendations for future deals.
 */
export const WinLossReportSchema = z.object({
  opportunityRef: z.string(),
  closeOutcome: z.enum(['won', 'lost', 'no-decision']),
  oppHistory: z.object({
    stageTransitions: z.array(
      z.object({
        fromStage: z.string(),
        toStage: z.string(),
        occurredAt: z.string(),
        rationale: z.string().optional(),
      })
    ),
    cycleDays: z.number(),
    touchCount: z.number(),
  }),
  buyerInterview: z
    .object({
      conducted: z.boolean(),
      transcriptUrl: z.string().optional(),
      summary: z.string(),
      buyerSentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
    })
    .optional(),
  pattern: z.object({
    primaryDrivers: z.array(z.string()),
    secondaryDrivers: z.array(z.string()),
    competitorInfluence: z.string().optional(),
    novelInsight: z.string().optional(),
  }),
  recommendations: z.array(
    z.object({
      audience: z.enum(['ae', 'sales-leader', 'product', 'marketing']),
      recommendation: z.string(),
      evidenceRef: z.string(),
    })
  ),
  reportUrl: z.string(),
  crmUpdateRef: z.string(),
  generatedAt: z.string(),
})

export type ClosedOpportunity = z.infer<typeof ClosedOpportunitySchema>
export type WinLossReport = z.infer<typeof WinLossReportSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_quotaAttainmentImprovement: RewardSignal = {
  keyResultRef: 'kr:win-loss-analyzer:rep-quota-attainment-improvement',
}
const kr_oppHistoryCoverage: RewardSignal = {
  keyResultRef: 'kr:win-loss-analyzer:opp-history-coverage',
}
const kr_interviewLandRate: RewardSignal = {
  keyResultRef: 'kr:win-loss-analyzer:interview-land-rate',
}
const kr_insightNovelty: RewardSignal = {
  keyResultRef: 'kr:win-loss-analyzer:insight-novelty',
}
const kr_reportEmitLatency: RewardSignal = {
  keyResultRef: 'kr:win-loss-analyzer:report-emit-latency',
}

// ============================================================================
// Win-Loss Analyzer Service
// ============================================================================

/**
 * Win-Loss Analyzer — closed-deal post-mortem as a Service.
 *
 * Cascade: extract-opp-history (Code, salesforce + gong + chorus pulls)
 *        → conduct-buyer-interview (Agentic, supervised; outbound + schedule
 *          + conduct + transcribe + summarise — the single longest-running
 *          step in the cascade)
 *        → synthesize-win-loss-pattern (Generative, pattern recognition
 *          across opp history + interview transcript + competitor signal)
 *        → emit-report (Code, render report + post to CRM opportunity).
 */
export const winLossAnalyzer: ServiceInstance<ClosedOpportunity, WinLossReport> = Service.define<
  ClosedOpportunity,
  WinLossReport
>({
  name: 'Win-Loss Analyzer',
  promise:
    'Every closed deal — won or lost — gets a buyer-grounded post-mortem on the opportunity record before the next deal starts.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: ClosedOpportunitySchema, output: WinLossReportSchema },

  binding: {
    cascade: [
      Code({
        name: 'extract-opp-history',
        reward: kr_oppHistoryCoverage,
        handler: () => undefined,
      }),
      Agentic({
        name: 'conduct-buyer-interview',
        reward: kr_interviewLandRate,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({
        name: 'synthesize-win-loss-pattern',
        reward: kr_insightNovelty,
      }),
      Code({
        name: 'emit-report',
        reward: kr_reportEmitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'salesforce.opportunities',
      'salesforce.contacts',
      'gong.calls',
      'chorus.calls',
      'gmail.send',
      'gcal.events',
    ],
    // Multi-step research: clarification disabled — the buyer-interview
    // step IS the clarification round; the cascade doesn't pause to ask
    // the AE to clarify on top.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // High-stakes deals (>$1M ARR) get the supervised buyer interview
        // — the AE listens in and the interviewer agent can hand off mid-
        // call if the buyer pivots to a strategic conversation.
        when: 'opp.dealSize > 100000000n',
        action: 'route-to',
        target: 'conduct-buyer-interview',
      },
      {
        // If the buyer declines the interview, fall back to a synthesis
        // path that uses CRM + call recordings only. The report still
        // ships; the buyerInterview output field carries `conducted: false`.
        when: 'interview.declined == true',
        action: 'route-to',
        target: 'synthesize-win-loss-pattern',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:win-loss-analyzer-review',
    personas: [
      // Insight novelty reviewer — adversarially probes whether the
      // synthesised pattern actually surfaces something the AE didn't
      // already know vs. restating the opp history.
      Personas.skeptic({
        domain: 'insight-novelty',
        focus: ['restated-history', 'tautological-pattern', 'no-new-information'],
        name: 'insight-novelty-reviewer',
      }),
      // Actionability reviewer — pedantic check that every recommendation
      // has a named audience, a specific recommendation, and a pointer
      // back to evidence in the report.
      Personas.pedantic({
        domain: 'recommendations-actionable',
        rubric: [
          'every-recommendation-has-named-audience',
          'every-recommendation-has-specific-action',
          'every-recommendation-has-evidence-pointer',
          'no-recommendation-is-generic-platitude',
        ],
        name: 'actionability-checker',
      }),
      // Sales leader domain reviewer — pulls the SalesManagers expert
      // from business.org.ai for senior judgment on whether the report
      // would change a sales leader's coaching plan.
      Personas.domain({
        expertRef: 'occupations.org.ai/SalesManagers',
        name: 'sales-leader-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:win-loss-analyzer:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-revenue-ops',
    seller: 'svc:win-loss-analyzer',
    serviceRef: 'svc:win-loss-analyzer',
    // External CRM-update verifier is load-bearing: the report is only
    // useful if it lands on the opp record where the AE will see it
    // before the next deal. SchemaMatch alone isn't enough.
    predicate: AND(
      SchemaMatch(WinLossReportSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      External({
        verifier: 'salesforce',
        spec: { opportunityUpdated: true, reportUrlAttached: true },
      })
    ),
    // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`
    // — settlement runtime resolves which tier a given opp falls into.
    amount: { amount: 99900n, currency: 'USD' },
    // 14-day SLA — buyer interviews take wall-clock to schedule, conduct,
    // and transcribe. The cycle is async by design.
    timeoutDays: 14,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'small-deal',
        amount: 19900n,
        currency: 'USD',
        description: 'Deals < $50k ARR — CRM-only synthesis, optional interview.',
      },
      {
        id: 'mid-deal',
        amount: 99900n,
        currency: 'USD',
        description: 'Deals $50k–$500k ARR — buyer interview + competitor analysis.',
      },
      {
        id: 'large-deal',
        amount: 499900n,
        currency: 'USD',
        description: 'Deals > $500k ARR — supervised interview + multi-buyer outreach.',
      },
    ],
  }),

  refundContract: 'no-charge-if-report-not-actioned-within-quarter',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 2000n, perApiCall: 25n },
  reward: kr_quotaAttainmentImprovement,

  lineage: {
    cellRef: 'business.org.ai/cells/sales-managers/win-loss-analysis',
    icpContextProblemRef: 'icp:win-loss-analyzer:v1',
    foundingHypothesisRef: 'fh:win-loss-analyzer:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
