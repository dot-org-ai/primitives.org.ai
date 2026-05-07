/**
 * Customer Feedback Synthesizer Service — multi-source customer-feedback
 * synthesis Service for the product-management catalog.
 *
 * Distinguishing shape vs. siblings (`prd-author`,
 * `roadmap-tradeoff-evaluator`):
 *   - `multi-step-research` archetype — the artefact is a citation-dense
 *     themes doc clustering customer signal across support, sales, surveys,
 *     community, and churn-interview sources, not a PRD or a quarterly
 *     tradeoff memo;
 *   - 4-step cascade with one supervised Agentic clustering step (the only
 *     Agentic step in the product catalog), bookended by Code fan-in over
 *     5 source systems, Generative synthesis with citation density and
 *     opportunity rankings, and Code fan-out (themes doc + linked source
 *     artifacts);
 *   - `Pricing.subscription` — a recurring product-team subscription
 *     ($1,499/mo) that runs on a weekly cron tied to the product-team
 *     review cadence;
 *   - declarative HITL = none (the run is a research synthesis where the
 *     output is a themes doc the product-team reads, not an artefact that
 *     ships externally; the OutcomeContract is bounded by the evaluator
 *     panel, not a human signature);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(theme-coherence +
 *     citation-density + signal-noise-discrimination))`;
 *   - EvaluatorPanel includes `Personas.factualAccuracy({
 *     minCitationsPerClaim: 3 })` because every theme claim must be
 *     corroborated by at least three citations across at least two source
 *     systems — a single support-ticket complaint is anecdote, three
 *     citations across support + sales + surveys is signal.
 *
 * Per design v3 §3 (Catalog HOW product) + §6 (binding triggers, no HumanSign
 * for research-only outputs) + §7 (subscription pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `feedback-cycle-time-reduction-and-feature-conversion-rate`
 * — the compound metric every product org optimises against (the synthesizer
 * is worth running iff per-cycle synthesis time drops + a higher fraction of
 * surfaced themes convert to shipped features vs. the pre-Service baseline).
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
 * Input — the weekly product-team review cadence fires + the connected
 * source systems are configured. Tight: 6 fields cover the cadence
 * identity, the product-team that owns the synthesis, the synthesis
 * window, the connected source-system pointers, the minimum citation
 * density required (per-tenant policy), and the cadence stage gating
 * intake.
 */
export const FeedbackCycleInputSchema = z.object({
  cycleId: z.string(),
  productTeamRef: z.string(),
  synthesisWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  sources: z.object({
    supportTicketSystem: z.enum(['zendesk', 'intercom', 'freshdesk', 'help-scout']),
    salesCallSource: z.enum(['gong', 'chorus', 'salesloft', 'outreach']),
    productSurveySystem: z.enum(['typeform', 'qualtrics', 'sprig', 'fullstory']),
    communityForumSource: z.enum(['discourse', 'circle', 'discord', 'slack-community']),
    churnInterviewSource: z.enum(['notion', 'docs', 'gong', 'lattice']),
  }),
  minCitationsPerTheme: z.number().int().positive().default(3),
  cadenceStage: z.literal('weekly-synthesis'),
})

/**
 * Output — a citation-dense themes doc clustering customer signal across
 * the connected source systems. The synthesis includes per-theme citation
 * density, severity-weighted opportunity rankings, and pointers to the
 * emitted themes doc + source-artifact links.
 */
export const FeedbackThemesOutputSchema = z.object({
  cycleId: z.string(),
  productTeamRef: z.string(),
  themes: z
    .array(
      z.object({
        themeId: z.string(),
        title: z.string(),
        narrative: z.string(),
        severity: z.enum(['low', 'medium', 'high', 'critical']),
        sourceCitations: z
          .array(
            z.object({
              sourceSystem: z.enum([
                'support-tickets',
                'sales-calls',
                'product-surveys',
                'community-forum',
                'churn-interviews',
              ]),
              artefactRef: z.string(),
              quotedSnippet: z.string(),
            })
          )
          .min(3),
        coveringSourceSystemCount: z.number().int().min(2),
      })
    )
    .min(1),
  opportunityRankings: z
    .array(
      z.object({
        themeRef: z.string(),
        rank: z.number().int().positive(),
        rationale: z.string(),
      })
    )
    .min(1),
  emittedArtefacts: z.object({
    themesDocUrl: z.string(),
    linkedSourceArtefactRefs: z.array(z.string()).min(1),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type FeedbackCycleInput = z.infer<typeof FeedbackCycleInputSchema>
export type FeedbackThemesOutput = z.infer<typeof FeedbackThemesOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_feedbackCycleTimeAndConversion: RewardSignal = {
  keyResultRef:
    'kr:customer-feedback-synthesizer:feedback-cycle-time-reduction-and-feature-conversion-rate',
}
const kr_sourceCoverage: RewardSignal = {
  keyResultRef: 'kr:customer-feedback-synthesizer:source-coverage',
}
const kr_clusterCoherence: RewardSignal = {
  keyResultRef: 'kr:customer-feedback-synthesizer:cluster-coherence',
}
const kr_themeCitationDensity: RewardSignal = {
  keyResultRef: 'kr:customer-feedback-synthesizer:theme-citation-density',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:customer-feedback-synthesizer:emit-latency',
}

// ============================================================================
// Customer Feedback Synthesizer Service
// ============================================================================

/**
 * Customer Feedback Synthesizer — weekly product-team cadence trigger →
 * citation-dense themes doc clustering customer signal across 5 source
 * systems as a Service.
 *
 * Cascade: fetch-support-tickets-sales-calls-surveys-community-and-churn-notes (Code, fan-in)
 *        → cluster-feedback-by-theme-and-severity (Agentic, supervised)
 *        → synthesize-themes-with-citation-density-and-opportunity-rankings (Generative)
 *        → emit-themes-doc-and-linked-source-artifacts (Code, fan-out).
 */
export const customerFeedbackSynthesizer: ServiceInstance<
  FeedbackCycleInput,
  FeedbackThemesOutput
> = Service.define<FeedbackCycleInput, FeedbackThemesOutput>({
  name: 'Customer Feedback Synthesizer',
  promise:
    'Every weekly product-team cadence gets a citation-dense themes doc — customer signal clustered across support + sales + surveys + community + churn-interviews, severity-weighted, opportunity-ranked — so PMs spend the cycle on the decision, not on assembly.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: FeedbackCycleInputSchema, output: FeedbackThemesOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-support-tickets-sales-calls-surveys-community-and-churn-notes',
        reward: kr_sourceCoverage,
        handler: () => undefined,
      }),
      Agentic({
        name: 'cluster-feedback-by-theme-and-severity',
        reward: kr_clusterCoherence,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({
        name: 'synthesize-themes-with-citation-density-and-opportunity-rankings',
        reward: kr_themeCitationDensity,
      }),
      Code({
        name: 'emit-themes-doc-and-linked-source-artifacts',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'zendesk.tickets',
      'gong.calls',
      'typeform.responses',
      'discourse.threads',
      'notion.docs',
      'docs.write',
    ],
    // Feedback synthesis: clarification disabled — the cascade fans in
    // across 5 source systems with no human contact point; the run is a
    // research synthesis the product-team reads, not an externally-shipped
    // artefact requiring a signature.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // High-volume cycles (>10k tickets in window) escalate the
        // clustering supervision to a senior research-ops supervisor
        // before synthesis (the failure modes compound at volume).
        when: 'cycleStage == "weekly-synthesis"',
        action: 'route-to',
        target: 'cluster-feedback-by-theme-and-severity',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:customer-feedback-synthesizer-review',
    personas: [
      // Theme-coherence reviewer — pedantic check that every theme has a
      // single coherent narrative thread (not a junk-drawer cluster), that
      // the severity band coheres with the cited evidence, and that no
      // theme silently merges unrelated complaint classes.
      Personas.pedantic({
        domain: 'theme-coherence',
        rubric: [
          'every-theme-single-coherent-narrative',
          'severity-band-coheres-with-evidence',
          'no-junk-drawer-clusters',
          'no-silently-merged-complaint-classes',
        ],
        name: 'theme-coherence-checker',
      }),
      // Citation-density reviewer — fact-grounding persona requiring at
      // least 3 corroborating citations per theme across at least 2 source
      // systems. A single support-ticket complaint is anecdote; 3 citations
      // across support + sales + surveys is signal.
      Personas.factualAccuracy({
        minCitationsPerClaim: 3,
        name: 'citation-density-checker',
      }),
      // Signal-noise-discrimination reviewer — adversarially probes
      // whether the synthesis surfaces high-signal themes vs. high-noise
      // anecdote, including whether the opportunity-ranking rationale
      // is grounded in cited evidence vs. plausible-sounding filler.
      Personas.skeptic({
        domain: 'signal-noise-discrimination',
        focus: [
          'high-signal-themes-prioritized',
          'no-high-noise-anecdote-elevated',
          'opportunity-ranking-rationale-grounded',
          'no-plausible-sounding-filler',
        ],
        name: 'signal-noise-discrimination-reviewer',
      }),
      // Product domain reviewer — pulls the senior-product-manager expert
      // for judgment on the overall themes-doc quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/ProductManagers',
        name: 'product-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:customer-feedback-synthesizer:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-product-team',
    seller: 'svc:customer-feedback-synthesizer',
    serviceRef: 'svc:customer-feedback-synthesizer',
    // No HumanSign — the artefact is a research synthesis the product-team
    // reads, not an externally-shipped doc requiring a signature. The
    // EvaluatorPanel is the binding quality floor.
    predicate: AND(
      SchemaMatch(FeedbackThemesOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
    ),
    amount: { amount: 149900n, currency: 'USD' },
    // 2-day SLA — weekly cadence; the synthesis ships within 48 hours of
    // the cron firing so the product-team review cadence isn't delayed.
    timeoutDays: 2,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: {
      id: 'customer-feedback-synthesizer-monthly',
      amount: 149900n,
      currency: 'USD',
      interval: 'month',
    },
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 6000n, perApiCall: 15n },
  reward: kr_feedbackCycleTimeAndConversion,

  lineage: {
    cellRef: 'business.org.ai/cells/product-managers/customer-feedback-synthesizer',
    icpContextProblemRef: 'icp:customer-feedback-synthesizer:v1',
    foundingHypothesisRef: 'fh:customer-feedback-synthesizer:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
