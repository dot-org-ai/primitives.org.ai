/**
 * Account Research Brief Service — pre-meeting account research for AE / SE
 * teams in the revenue / sales catalog.
 *
 * Distinguishing shape vs. siblings (`lead-qualification`, `meeting-prep`,
 * `proposal-generator`, `contract-redliner`, `renewal-workbench`,
 * `campaign-orchestrator`, `win-loss-analyzer`):
 *   - `multi-step-research` archetype — the artefact is a researched
 *     pre-meeting brief PDF (account history + current signals + buying
 *     signals + talking points) for an AE/SE preparing for a Director-level+
 *     meeting, not a generic meeting brief or a lead-qualification decision;
 *   - 4-step cascade with one supervised Agentic research step (the
 *     multi-source news + hiring + product-launches + exec-changes pass)
 *     bookended by Code fan-in (account + opportunity history) and Code
 *     fan-out (research-brief PDF emit), with a Generative synthesis
 *     between research and emit;
 *   - `perInvocation` pricing across three S/M/L tiers keyed on deal-size —
 *     the brief is worth more on a $1M deal than a $10k deal;
 *   - no Human Function in the cascade — the AE/SE consumes the brief
 *     directly, the OutcomeContract enforces the quality floor via the
 *     evaluator panel;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(actionability +
 *     recency-of-signals))`.
 *
 * Per design v3 §3 (Catalog HOW revenue) + §6 (binding triggers) + §7
 * (perInvocation pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `meeting-progression-rate-improvement` — the
 * compound metric the AE/SE org optimises against (the brief is worth
 * running iff the prepped meeting progresses to next-step at a higher rate
 * than the unprepared meeting).
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
 * Input — a scheduled meeting with a prospect or customer where at least
 * one attendee is Director-level or higher. Tight: 6 fields cover meeting
 * identity, the account ref, the meeting kickoff, the attendee list (with a
 * required seniority flag so the trigger filter is resolvable), the assigned
 * AE, and the deal-size band so the pricing tier is resolvable at intake.
 */
export const MeetingScheduledInputSchema = z.object({
  meetingId: z.string(),
  accountRef: z.string(),
  scheduledAt: z.string(), // ISO-8601
  attendees: z.array(
    z.object({
      email: z.string(),
      seniority: z.enum(['ic', 'manager', 'director', 'vp', 'cxo']),
    })
  ),
  assignedAeRef: z.string(),
  dealSizeBand: z.enum(['small', 'medium', 'large']),
})

/**
 * Output — a researched pre-meeting brief: the account history snapshot, the
 * researched signals (news + hiring + product-launches + exec-changes), the
 * synthesized talking points + buying signals, and pointers to the rendered
 * brief PDF artefact the AE/SE consumes.
 */
export const AccountResearchBriefOutputSchema = z.object({
  meetingId: z.string(),
  accountRef: z.string(),
  accountHistory: z.object({
    relationshipAgeDays: z.number().int().nonnegative(),
    openOpportunities: z.array(
      z.object({
        opportunityRef: z.string(),
        stage: z.string(),
        amountCents: z.bigint(),
      })
    ),
    closedOpportunities: z.array(
      z.object({
        opportunityRef: z.string(),
        outcome: z.enum(['won', 'lost']),
        closedAt: z.string(),
        amountCents: z.bigint(),
      })
    ),
  }),
  researchedSignals: z.object({
    news: z.array(
      z.object({
        url: z.string(),
        publishedAt: z.string(),
        headline: z.string(),
        relevance: z.string(),
      })
    ),
    hiring: z.array(
      z.object({
        role: z.string(),
        team: z.string(),
        postedAt: z.string(),
      })
    ),
    productLaunches: z.array(
      z.object({
        launchUrl: z.string(),
        productName: z.string(),
        launchedAt: z.string(),
      })
    ),
    execChanges: z.array(
      z.object({
        execName: z.string(),
        priorRole: z.string().optional(),
        newRole: z.string(),
        announcedAt: z.string(),
      })
    ),
  }),
  synthesis: z.object({
    talkingPoints: z.array(z.string()).min(1),
    buyingSignals: z.array(
      z.object({
        signal: z.string(),
        evidenceCitations: z.array(z.string()).min(1),
        confidence: z.number().min(0).max(1),
      })
    ),
  }),
  brief: z.object({
    pdfUrl: z.string(),
    pageCount: z.number().int().positive(),
  }),
  generatedAt: z.string(),
})

export type MeetingScheduledInput = z.infer<typeof MeetingScheduledInputSchema>
export type AccountResearchBriefOutput = z.infer<typeof AccountResearchBriefOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_meetingProgression: RewardSignal = {
  keyResultRef: 'kr:account-research-brief:meeting-progression-rate-improvement',
}
const kr_historyCoverage: RewardSignal = {
  keyResultRef: 'kr:account-research-brief:history-coverage',
}
const kr_signalRecency: RewardSignal = {
  keyResultRef: 'kr:account-research-brief:signal-recency',
}
const kr_actionability: RewardSignal = {
  keyResultRef: 'kr:account-research-brief:actionability',
}
const kr_renderLatency: RewardSignal = {
  keyResultRef: 'kr:account-research-brief:render-latency',
}

// ============================================================================
// Account Research Brief Service
// ============================================================================

/**
 * Account Research Brief — meeting-scheduled webhook → researched
 * pre-meeting brief PDF for the AE/SE as a Service.
 *
 * Cascade: fetch-account-and-opportunity-history (Code, CRM fan-in)
 *        → research-news-hiring-launches-exec-changes (Agentic, supervised)
 *        → synthesize-talking-points-and-buying-signals (Generative)
 *        → emit-research-brief-pdf (Code, PDF render fan-out).
 */
export const accountResearchBrief: ServiceInstance<
  MeetingScheduledInput,
  AccountResearchBriefOutput
> = Service.define<MeetingScheduledInput, AccountResearchBriefOutput>({
  name: 'Account Research Brief',
  promise:
    'Every Director-level+ meeting gets a researched pre-meeting brief PDF — account history, current signals, buying signals, talking points — in the AE/SE inbox before kickoff.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: MeetingScheduledInputSchema, output: AccountResearchBriefOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-account-and-opportunity-history',
        reward: kr_historyCoverage,
        handler: () => undefined,
      }),
      Agentic({
        name: 'research-news-hiring-launches-exec-changes',
        reward: kr_signalRecency,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({
        name: 'synthesize-talking-points-and-buying-signals',
        reward: kr_actionability,
      }),
      Code({
        name: 'emit-research-brief-pdf',
        reward: kr_renderLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'crm.accounts',
      'crm.opportunities',
      'crm.contacts',
      'clearbit.companies',
      'linkedin.profiles',
      'web.search',
      'news.search',
      'pdf.render',
    ],
    // Pre-meeting brief: clarification disabled — the brief is synthesised
    // from public + CRM signal; the AE doesn't pause to clarify with the
    // research cascade.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Only meetings with a Director-level or higher attendee qualify;
        // the runtime filters at intake but the trigger documents the rule.
        when: 'attendees.some(a => ["director","vp","cxo"].includes(a.seniority))',
        action: 'route-to',
        target: 'research-news-hiring-launches-exec-changes',
      },
      {
        // Large-deal meetings escalate the research step to a senior
        // research-supervisor for an extra pass before the synthesis runs.
        when: 'dealSizeBand == "large"',
        action: 'escalate',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:account-research-brief-review',
    personas: [
      // Actionability reviewer — adversarially probes whether the talking
      // points and buying signals are concretely usable in the meeting,
      // not generic "ask about their priorities" boilerplate.
      Personas.skeptic({
        domain: 'actionability',
        focus: ['concrete-and-usable', 'not-generic', 'tied-to-researched-signal'],
        name: 'actionability-reviewer',
      }),
      // Recency-of-signals reviewer — pedantic check that every researched
      // signal carries a publish date and is recent enough to matter
      // (last 90 days for news / launches / hiring; last 12 months for
      // exec changes).
      Personas.pedantic({
        domain: 'recency-of-signals',
        rubric: [
          'every-signal-has-publish-date',
          'news-published-within-90-days',
          'launches-published-within-90-days',
          'hiring-posted-within-90-days',
          'exec-changes-within-12-months',
        ],
        name: 'recency-checker',
      }),
      // Sales domain reviewer — pulls the senior-AE expert for judgment on
      // the overall brief quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/SalesRepresentatives',
        name: 'sales-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:account-research-brief:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-revenue-ops',
    seller: 'svc:account-research-brief',
    serviceRef: 'svc:account-research-brief',
    // No HumanSign — the AE/SE consumes the brief; the quality floor is
    // enforced by the evaluator panel.
    predicate: AND(
      SchemaMatch(AccountResearchBriefOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
    ),
    // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
    amount: { amount: 4900n, currency: 'USD' },
    // 1-day SLA — meetings move on calendar timescale.
    timeoutDays: 1,
    onTimeout: 'escalate',
  },

  pricing: Pricing.perInvocation({
    tiers: [
      {
        id: 'small-deal',
        amount: 1900n,
        includedPerMonth: 200,
        overage: 1900n,
      },
      {
        id: 'medium-deal',
        amount: 4900n,
        includedPerMonth: 100,
        overage: 4900n,
      },
      {
        id: 'large-deal',
        amount: 14900n,
        includedPerMonth: 25,
        overage: 14900n,
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 250n, perApiCall: 8n },
  reward: kr_meetingProgression,

  lineage: {
    cellRef: 'business.org.ai/cells/sales-representatives/account-research-brief',
    icpContextProblemRef: 'icp:account-research-brief:v1',
    foundingHypothesisRef: 'fh:account-research-brief:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
