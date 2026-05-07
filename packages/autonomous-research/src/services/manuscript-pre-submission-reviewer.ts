/**
 * Manuscript Pre-Submission Reviewer Service — pre-submission manuscript
 * review for the research catalog.
 *
 * Distinguishing shape vs. siblings (`literature-review-synthesizer`,
 * `experiment-protocol-author`):
 *   - `quality-review` archetype — senior-author-signed memo + revision
 *     tracker grounded in target-journal style + current literature;
 *   - 6-step cascade: Code (manuscript + style guide + co-authors) →
 *     Generative (scope + novelty vs. current literature) → Generative
 *     (figure / statistical / clarity passes) → Generative (revision
 *     recommendations with priority) → Human (senior-author review) →
 *     Code (emit memo + tracker);
 *   - `Pricing.outcome` 3 tiers — short-letter / standard-article /
 *     review-or-major ($199 / $799 / $1,999) — keyed on length band;
 *   - declarative HITL = senior-author review Human Function (premium
 *     rationale; senior-author signs);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(
 *     senior-author))`.
 *
 * Service-level reward = `first-revision-acceptance-rate-improvement`.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

const ManuscriptKind = z.enum([
  'short-letter',
  'standard-article',
  'review-article',
  'systematic-review',
  'meta-analysis',
  'methods-paper',
  'case-report',
])

const LengthBand = z.enum(['short-letter', 'standard-article', 'review-or-major'])
const Severity = z.enum(['minor', 'moderate', 'major'])

/** Input — manuscript draft + target journal at intake. */
export const ManuscriptReviewInputSchema = z.object({
  manuscriptRef: z.string(),
  manuscriptMetadata: z.object({
    title: z.string(),
    abstract: z.string(),
    manuscriptKind: ManuscriptKind,
    lengthBand: LengthBand,
    wordCount: z.number().int().nonnegative(),
    keywords: z.array(z.string()).default([]),
  }),
  targetJournal: z.object({
    journalRef: z.string(),
    journalName: z.string(),
    styleGuideRef: z.string(),
    fieldScope: z.array(z.string()).min(1),
    impactFactor: z.number().min(0).optional(),
  }),
  coAuthors: z
    .array(
      z.object({
        coAuthorRef: z.string(),
        role: z.enum([
          'first-author',
          'corresponding-author',
          'senior-author',
          'contributing-author',
        ]),
        affiliation: z.string().optional(),
      })
    )
    .min(1),
  correspondingAuthorRef: z.string(),
  assignedSeniorAuthorRef: z.string(),
  figuresAndTables: z.object({
    figureCount: z.number().int().nonnegative(),
    tableCount: z.number().int().nonnegative(),
    figuresManifestRef: z.string().optional(),
  }),
  supplementaryMaterials: z.object({
    hasSupplementary: z.boolean(),
    supplementaryManifestRef: z.string().optional(),
  }),
})

/** Output — senior-author-signed memo + revision tracker. */
export const ManuscriptReviewOutputSchema = z.object({
  manuscriptRef: z.string(),
  targetJournalRef: z.string(),
  manuscriptSnapshot: z.object({
    title: z.string(),
    manuscriptKind: ManuscriptKind,
    lengthBand: LengthBand,
    wordCount: z.number().int().nonnegative(),
    figureCount: z.number().int().nonnegative(),
    tableCount: z.number().int().nonnegative(),
    coAuthorCount: z.number().int().positive(),
  }),
  scopeAndNoveltyAssessment: z.object({
    scopeFitForJournal: z.enum(['strong-fit', 'in-scope', 'borderline', 'out-of-scope']),
    scopeFitRationale: z.string(),
    noveltyClaim: z.string(),
    noveltyEvidence: z
      .array(
        z.object({
          claim: z.string(),
          contrastedSourceRefs: z.array(z.string()).min(1),
          rationale: z.string(),
        })
      )
      .min(1),
    overlapWithPriorWork: z
      .array(
        z.object({
          priorSourceRef: z.string(),
          overlapKind: z.enum(['conceptual', 'methodological', 'data', 'incremental']),
          severity: Severity,
          mitigationSuggestion: z.string(),
        })
      )
      .default([]),
  }),
  qualityPasses: z.object({
    figureAndTableQuality: z.object({
      findings: z
        .array(
          z.object({
            findingId: z.string(),
            target: z.enum(['figure', 'table']),
            targetRef: z.string(),
            issue: z.string(),
            severity: Severity,
            recommendedFix: z.string(),
          })
        )
        .default([]),
    }),
    statisticalRigor: z.object({
      findings: z
        .array(
          z.object({
            findingId: z.string(),
            issue: z.string(),
            issueKind: z.enum([
              'inappropriate-test',
              'multiple-comparisons',
              'underpowered',
              'effect-size-omitted',
              'confidence-interval-omitted',
              'p-hacking-risk',
              'reporting-gap',
            ]),
            severity: Severity,
            recommendedFix: z.string(),
          })
        )
        .default([]),
      overallRigorRating: z.enum(['weak', 'adequate', 'strong']),
    }),
    writingClarity: z.object({
      findings: z
        .array(
          z.object({
            findingId: z.string(),
            section: z.enum([
              'abstract',
              'introduction',
              'methods',
              'results',
              'discussion',
              'conclusion',
            ]),
            issue: z.string(),
            severity: Severity,
            recommendedFix: z.string(),
          })
        )
        .default([]),
      readabilityScore: z.number().min(0).max(100).optional(),
      styleFitWithJournal: z.enum(['strong-fit', 'in-style', 'misaligned']),
    }),
  }),
  revisionRecommendations: z
    .array(
      z.object({
        recommendationId: z.string(),
        priority: z.enum(['must-fix-before-submission', 'should-fix', 'nice-to-have']),
        target: z.enum([
          'scope-or-novelty',
          'figure-or-table',
          'statistical-rigor',
          'writing-clarity',
          'structural',
        ]),
        description: z.string(),
        linkedFindingIds: z.array(z.string()).default([]),
      })
    )
    .min(1),
  seniorAuthorReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum([
      'approve-for-submission',
      'approve-with-must-fix',
      'request-revision',
      'reject-as-not-ready',
    ]),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  reviewMemo: z.object({
    memoRef: z.string(),
    memoUrl: z.string(),
    emittedAt: z.string(),
  }),
  revisionTracker: z.object({
    trackerRef: z.string(),
    trackerUrl: z.string(),
    openItemCount: z.number().int().nonnegative(),
    openedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type ManuscriptReviewInput = z.infer<typeof ManuscriptReviewInputSchema>
export type ManuscriptReviewOutput = z.infer<typeof ManuscriptReviewOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_firstRevisionAcceptanceRate: RewardSignal = {
  keyResultRef: 'kr:manuscript-pre-submission-reviewer:first-revision-acceptance-rate-improvement',
}
const kr_manuscriptCoverage: RewardSignal = {
  keyResultRef: 'kr:manuscript-pre-submission-reviewer:manuscript-coverage',
}
const kr_noveltyAssessmentSoundness: RewardSignal = {
  keyResultRef: 'kr:manuscript-pre-submission-reviewer:novelty-assessment-soundness',
}
const kr_qualityPassDepth: RewardSignal = {
  keyResultRef: 'kr:manuscript-pre-submission-reviewer:quality-pass-depth',
}
const kr_revisionPriorityFit: RewardSignal = {
  keyResultRef: 'kr:manuscript-pre-submission-reviewer:revision-priority-fit',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:manuscript-pre-submission-reviewer:emit-latency',
}

// ============================================================================
// Manuscript Pre-Submission Reviewer Service
// ============================================================================

/** Manuscript Pre-Submission Reviewer — Service. */
export const manuscriptPreSubmissionReviewer: ServiceInstance<
  ManuscriptReviewInput,
  ManuscriptReviewOutput
> = Service.define<ManuscriptReviewInput, ManuscriptReviewOutput>({
  name: 'Manuscript Pre-Submission Reviewer',
  promise:
    'Every research manuscript landing the pre-submission queue gets a senior-author-signed review memo + revision tracker — scope-and-novelty contrasted against current literature, figure-and-table quality + statistical-rigor + writing-clarity passes complete, revision recommendations prioritised — so first-revision acceptance trends up and the pre-submission cycle from "draft ready" to "submitted with confidence" collapses from weeks to days.',
  audience: 'business',
  archetype: 'quality-review',
  schema: { input: ManuscriptReviewInputSchema, output: ManuscriptReviewOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-manuscript-target-journal-style-guide-and-co-author-list',
        reward: kr_manuscriptCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'scope-and-novelty-check-against-current-literature',
        reward: kr_noveltyAssessmentSoundness,
      }),
      Generative({
        name: 'figure-and-table-quality-pass-statistical-rigor-pass-and-writing-clarity-pass',
        reward: kr_qualityPassDepth,
      }),
      Generative({
        name: 'draft-revision-recommendations-with-priority',
        reward: kr_revisionPriorityFit,
      }),
      Human({
        name: 'senior-author-review',
        // `premium` rationale: senior-author judgement on scope, tone, and
        // submission readiness is the value being sold; the gate stays
        // human regardless of model accuracy.
        rationale: 'premium',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-review-memo-and-revision-tracker',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'manuscript-store.read',
      'journal-style-guide.read',
      'pubmed.search',
      'semantic-scholar.search',
      'google-scholar.search',
      'figure-quality.analyze',
      'statistical-rigor.analyze',
      'readability.score',
      'docs.write',
      'tracker.create',
    ],
    // Cascade synthesises from manuscript + style-guide + co-authors;
    // senior-author review is the single human contact surface.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Review-or-major-tier manuscripts escalate quality passes to a
        // senior research-editor supervisor before senior-author review.
        when: 'manuscriptMetadata.lengthBand == "review-or-major" || manuscriptMetadata.manuscriptKind == "systematic-review" || manuscriptMetadata.manuscriptKind == "meta-analysis"',
        action: 'escalate',
      },
      {
        // Every manuscript routes through senior-author review before
        // the memo emits; OutcomeContract enforces the signature.
        when: 'true',
        action: 'route-to',
        target: 'senior-author-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:manuscript-pre-submission-reviewer-review',
    personas: [
      // Novelty-assessment + factual-grounding reviewer — every novelty
      // claim cites at least one peer-reviewed source the manuscript is
      // contrasted against. Peer-reviewed-only because reviewers don't
      // accept first-party citations as a contrast baseline.
      Personas.factualAccuracy({
        citationRequired: true,
        sourceTypes: ['peer-reviewed'],
        name: 'novelty-assessment-and-factual-grounding-reviewer',
      }),
      // Statistical-rigor reviewer — every finding cites a concrete
      // issue-kind, overall-rigor tracks finding-severity, and every
      // major finding has a recommended fix.
      Personas.pedantic({
        domain: 'statistical-rigor',
        rubric: [
          'every-finding-cites-an-issue-kind',
          'overall-rigor-rating-tracks-severity-distribution',
          'every-major-finding-has-a-recommended-fix',
        ],
        name: 'statistical-rigor-checker',
      }),
      // Clarity-and-style-fit reviewer — every writing-clarity finding
      // cites a section, style-fit tracks the cited style-guide, and
      // section-targeted findings sit in the right section.
      Personas.pedantic({
        domain: 'clarity-and-style-fit',
        rubric: [
          'every-clarity-finding-cites-a-section',
          'style-fit-tracks-cited-journal-style-guide',
          'section-targeted-findings-sit-in-the-right-section',
        ],
        name: 'clarity-and-style-fit-checker',
      }),
      // Regression-risk reviewer — pre-submission revisions are a
      // process change; probes whether each must-fix has blast-radius
      // (co-authors touched) + rollback (what's dropped if not tractable).
      Personas.regressionRisk({
        changeType: 'process',
        name: 'revision-process-regression-risk-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:manuscript-pre-submission-reviewer:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-research-lead',
    seller: 'svc:manuscript-pre-submission-reviewer',
    serviceRef: 'svc:manuscript-pre-submission-reviewer',
    // Senior author signs every memo before the revision tracker emits.
    predicate: AND(
      SchemaMatch(ManuscriptReviewOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['senior-author'] })
    ),
    // Mid-tier; per-tier amounts in `pricing.tiers`.
    amount: { amount: 79900n, currency: 'USD' },
    // 7-day SLA.
    timeoutDays: 7,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'short-letter',
        amount: 19900n,
        currency: 'USD',
        description: 'Short letter / case report (≤2,000 words). $199.',
      },
      {
        id: 'standard-article',
        amount: 79900n,
        currency: 'USD',
        description: 'Standard article (2,000–8,000 words). $799.',
      },
      {
        id: 'review-or-major',
        amount: 199900n,
        currency: 'USD',
        description:
          'Review / systematic review / meta-analysis / methods paper (8,000+ words). $1,999.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 9000n, perApiCall: 6n },
  reward: kr_firstRevisionAcceptanceRate,

  lineage: {
    cellRef: 'business.org.ai/cells/research-leads/manuscript-pre-submission-reviewer',
    icpContextProblemRef: 'icp:manuscript-pre-submission-reviewer:v1',
    foundingHypothesisRef: 'fh:manuscript-pre-submission-reviewer:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
