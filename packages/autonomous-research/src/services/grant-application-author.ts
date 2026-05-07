/**
 * Grant Application Author Service — research grant proposal authoring
 * (NIH / NSF / DARPA / private foundation) for the research catalog.
 *
 * Distinguishing shape vs. siblings (`literature-review-synthesizer`,
 * `experiment-protocol-author`, `manuscript-pre-submission-reviewer`,
 * `data-analysis-plan-author`, `peer-review-coordinator`):
 *   - `content-generation` archetype — PI-and-sponsored-research-officer-
 *     signed grant submission package (specific aims + significance +
 *     approach + budget + biosketch + facilities) grounded in the funding-
 *     call spec, PI bio, lab CV, prior funded grants, and supporting data;
 *   - 5-step cascade: Code (funding-call spec + PI bio + lab CV + prior
 *     funded grants + supporting data) → Generative (synthesise aims +
 *     significance + approach with evidence grounding) → Generative (draft
 *     budget + justifications + biosketch + facilities) → Human (PI +
 *     sponsored-research-officer review and sign) → Code (emit submission
 *     package + agency-format checklist);
 *   - `Pricing.outcome` 3 tiers — small-grant / standard-r01 / multi-PI-or-
 *     large ($999 / $4,999 / $19,999) — keyed on grant scale band;
 *   - declarative HITL = dual review — PI (premium rationale; signs
 *     scientific aims) + sponsored-research-officer (regulatory rationale;
 *     signs institutional compliance);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(PI) +
 *     HumanSign(sponsored-research-officer))`.
 *
 * Service-level reward = `grant-success-rate-improvement`.
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

const FundingAgency = z.enum([
  'nih',
  'nsf',
  'darpa',
  'doe',
  'nasa',
  'private-foundation',
  'industry-sponsor',
  'state-or-other',
])

const GrantScaleBand = z.enum(['small-grant', 'standard-r01', 'multi-pi-or-large'])

/** Input — grant submission greenlit + funding-call deadline at intake. */
export const GrantApplicationInputSchema = z.object({
  initiativeRef: z.string(),
  fundingCall: z.object({
    callRef: z.string(),
    agency: FundingAgency,
    mechanism: z.string(),
    callTitle: z.string(),
    deadline: z.string(),
    pageLimits: z.object({
      specificAimsPages: z.number().int().positive(),
      researchStrategyPages: z.number().int().positive(),
      biosketchPages: z.number().int().positive().optional(),
    }),
    formatRef: z.string(),
  }),
  grantScaleBand: GrantScaleBand,
  principalInvestigator: z.object({
    piRef: z.string(),
    bioRef: z.string(),
    careerStage: z.enum([
      'early-career',
      'new-investigator',
      'established-investigator',
      'senior-investigator',
    ]),
  }),
  coInvestigators: z
    .array(
      z.object({
        coiRef: z.string(),
        role: z.enum(['co-pi', 'co-investigator', 'consultant', 'collaborator']),
        affiliation: z.string().optional(),
      })
    )
    .default([]),
  labCvRef: z.string(),
  priorFundedGrants: z
    .array(
      z.object({
        grantRef: z.string(),
        agency: FundingAgency,
        title: z.string(),
        years: z.string(),
        outcomeRef: z.string().optional(),
      })
    )
    .default([]),
  supportingData: z.object({
    preliminaryDataRefs: z.array(z.string()).default([]),
    publicationRefs: z.array(z.string()).default([]),
    datasetRefs: z.array(z.string()).default([]),
  }),
  proposedBudget: z.object({
    requestedTotalDirectCostsUsd: z.number().int().nonnegative(),
    proposedDurationMonths: z.number().int().positive(),
    indirectCostRatePercent: z.number().min(0).max(150).optional(),
  }),
  assignedSponsoredResearchOfficerRef: z.string(),
})

/** Output — PI + sponsored-research-officer signed grant submission package. */
export const GrantApplicationOutputSchema = z.object({
  initiativeRef: z.string(),
  fundingCall: z.object({
    callRef: z.string(),
    agency: FundingAgency,
    mechanism: z.string(),
    deadline: z.string(),
  }),
  grantScaleBand: GrantScaleBand,
  fundingCallSpecSnapshot: z.object({
    callRef: z.string(),
    formatRef: z.string(),
    pageLimitsHonored: z.boolean(),
    fetchedAt: z.string(),
  }),
  piAndLabSnapshot: z.object({
    piBioRef: z.string(),
    labCvRef: z.string(),
    priorFundedCount: z.number().int().nonnegative(),
    fetchedAt: z.string(),
  }),
  specificAims: z.object({
    overarchingHypothesis: z.string(),
    aims: z
      .array(
        z.object({
          aimNumber: z.number().int().positive(),
          aimTitle: z.string(),
          aimRationale: z.string(),
          aimApproachSummary: z.string(),
          expectedOutcomes: z.array(z.string()).min(1),
        })
      )
      .min(1),
    pageCount: z.number().int().positive(),
  }),
  significance: z.object({
    significanceClaim: z.string(),
    evidenceCitations: z
      .array(
        z.object({
          claim: z.string(),
          sourceRef: z.string(),
          sourceTier: z.enum(['peer-reviewed', 'primary', 'preprint', 'review-article']),
        })
      )
      .min(1),
    innovationClaim: z.string(),
  }),
  approach: z.object({
    perAimApproach: z
      .array(
        z.object({
          aimNumber: z.number().int().positive(),
          experimentalDesign: z.string(),
          methodSteps: z.array(z.string()).min(1),
          rigorAndReproducibility: z.string(),
          potentialPitfallsAndAlternatives: z.string(),
        })
      )
      .min(1),
    pageCount: z.number().int().positive(),
    timelineGanttRef: z.string().optional(),
  }),
  budget: z.object({
    yearlyBreakdown: z
      .array(
        z.object({
          year: z.number().int().positive(),
          personnelUsd: z.number().int().nonnegative(),
          equipmentUsd: z.number().int().nonnegative(),
          suppliesUsd: z.number().int().nonnegative(),
          travelUsd: z.number().int().nonnegative(),
          otherUsd: z.number().int().nonnegative(),
          subtotalDirectUsd: z.number().int().nonnegative(),
        })
      )
      .min(1),
    totalDirectCostsUsd: z.number().int().nonnegative(),
    indirectCostsUsd: z.number().int().nonnegative(),
    totalCostsUsd: z.number().int().nonnegative(),
    justifications: z
      .array(
        z.object({
          lineItem: z.string(),
          rationale: z.string(),
        })
      )
      .min(1),
  }),
  biosketch: z.object({
    biosketchRef: z.string(),
    pageCount: z.number().int().positive(),
    formatHonored: z.boolean(),
  }),
  facilitiesAndResources: z.object({
    facilitiesNarrative: z.string(),
    keyEquipment: z.array(z.string()).default([]),
    institutionalResources: z.array(z.string()).default([]),
  }),
  principalInvestigatorReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  sponsoredResearchOfficerReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    institutionalCompliance: z.object({
      indirectCostRateConfirmed: z.boolean(),
      cofiHandled: z.boolean(),
      iacucIrbStatusNoted: z.boolean(),
    }),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  submissionPackage: z.object({
    packageRef: z.string(),
    packageUrl: z.string(),
    targetPortal: z.enum([
      'era-commons',
      'fastlane',
      'research.gov',
      'grants.gov',
      'agency-direct',
    ]),
    emittedAt: z.string(),
  }),
  agencyFormatChecklist: z.object({
    items: z
      .array(
        z.object({
          itemId: z.string(),
          requirement: z.string(),
          status: z.enum(['ready', 'gap', 'na']),
          gapNotes: z.string().optional(),
        })
      )
      .min(1),
    overallStatus: z.enum(['ready-to-submit', 'gaps-remain']),
  }),
  generatedAt: z.string(),
})

export type GrantApplicationInput = z.infer<typeof GrantApplicationInputSchema>
export type GrantApplicationOutput = z.infer<typeof GrantApplicationOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_grantSuccessRate: RewardSignal = {
  keyResultRef: 'kr:grant-application-author:grant-success-rate-improvement',
}
const kr_callSpecCoverage: RewardSignal = {
  keyResultRef: 'kr:grant-application-author:funding-call-spec-coverage',
}
const kr_aimsAndSignificanceQuality: RewardSignal = {
  keyResultRef: 'kr:grant-application-author:aims-and-significance-and-approach-quality',
}
const kr_budgetAndBiosketchSoundness: RewardSignal = {
  keyResultRef: 'kr:grant-application-author:budget-and-biosketch-and-facilities-soundness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:grant-application-author:emit-latency',
}

// ============================================================================
// Grant Application Author Service
// ============================================================================

/**
 * Grant Application Author — funding-call deadline + PI greenlight → PI- and
 * sponsored-research-officer-signed grant submission package
 * (specific-aims + significance + approach + budget + biosketch +
 * facilities) as a Service.
 */
export const grantApplicationAuthor: ServiceInstance<
  GrantApplicationInput,
  GrantApplicationOutput
> = Service.define<GrantApplicationInput, GrantApplicationOutput>({
  name: 'Grant Application Author',
  promise:
    'Every PI-greenlit grant submission lands as a PI- and sponsored-research-officer-signed submission package — specific aims and significance grounded in cited evidence, an approach with rigor + reproducibility + alternatives, a justified budget, biosketch and facilities prepared to agency format — so grant success rate trends up and the time from "greenlight" to "submission ready" collapses from quarters to weeks.',
  audience: 'business',
  archetype: 'content-generation',
  schema: { input: GrantApplicationInputSchema, output: GrantApplicationOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-funding-call-spec-pi-bio-lab-cv-prior-funded-grants-and-supporting-data',
        reward: kr_callSpecCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-aims-and-significance-and-approach-sections-with-evidence-grounding',
        reward: kr_aimsAndSignificanceQuality,
      }),
      Generative({
        name: 'draft-budget-with-justifications-biosketch-and-facilities',
        reward: kr_budgetAndBiosketchSoundness,
      }),
      Human({
        name: 'pi-and-sponsored-research-officer-review-and-sign',
        // `regulatory` rationale: a grant submission carries institutional
        // commitments (indirect-cost rate, conflict-of-interest disclosures,
        // IACUC/IRB status). PI signs scientific content; sponsored-research
        // officer signs institutional compliance — both are required.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-submission-package-and-agency-format-checklist',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'funding-call-registry.read',
      'pi-bio.read',
      'lab-cv.read',
      'grant-history.read',
      'preliminary-data.read',
      'publication-store.read',
      'biosketch-template.read',
      'facilities-template.read',
      'agency-format.validate',
      'docs.write',
      'submission-portal.stage',
    ],
    // Cascade synthesises from funding-call + PI-bio + lab-CV + prior-grants
    // + supporting-data; the dual PI + sponsored-research-officer review is
    // the single human contact surface.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Multi-PI / large mechanisms escalate to a senior research-
        // development supervisor before the dual review.
        when: 'grantScaleBand == "multi-pi-or-large" || coInvestigators.length > 2',
        action: 'escalate',
      },
      {
        // Every grant routes through dual review before emit.
        when: 'true',
        action: 'route-to',
        target: 'pi-and-sponsored-research-officer-review-and-sign',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:grant-application-author-review',
    personas: [
      // Factual-accuracy + citation-grounding reviewer — every significance
      // claim cites a peer-reviewed or primary source. Reviewers reject
      // grants that hand-wave on prior art.
      Personas.factualAccuracy({
        citationRequired: true,
        sourceTypes: ['peer-reviewed', 'primary'],
        name: 'specific-aim-clarity-and-citation-grounding-reviewer',
      }),
      // Scope-clarity reviewer — declares scope-boundary + out-of-scope on
      // the project-brief artifact (specific aims + approach must hang
      // together as a single coherent project).
      Personas.scopeClarity({
        artifactType: 'project-brief',
        name: 'significance-novelty-and-scope-clarity-reviewer',
      }),
      // Budget-realism reviewer — cost / time / scope all sanity-checked
      // simultaneously; budget justifications must enumerate line items
      // (not "personnel: $X" with no rationale).
      Personas.budgetRealism({
        budgetType: 'all',
        name: 'budget-justification-completeness-reviewer',
      }),
      // Approach-rigor reviewer — every aim has a method, rigor +
      // reproducibility statement, and alternatives if the primary path
      // fails. NIH-style "rigor and transparency" gate.
      Personas.pedantic({
        domain: 'approach-rigor-and-reproducibility',
        rubric: [
          'every-aim-cites-an-experimental-design',
          'every-aim-has-a-rigor-and-reproducibility-statement',
          'every-aim-cites-pitfalls-and-alternatives',
          'budget-yearly-breakdown-sums-to-total-direct-costs',
          'page-counts-respect-call-page-limits',
        ],
        name: 'approach-rigor-and-reproducibility-checker',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:grant-application-author:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-research-lead',
    seller: 'svc:grant-application-author',
    serviceRef: 'svc:grant-application-author',
    // PI + sponsored-research-officer both sign every submission before the
    // package emits to the agency portal.
    predicate: AND(
      SchemaMatch(GrantApplicationOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['principal-investigator'] }),
      HumanSign({ signerRoles: ['sponsored-research-officer'] })
    ),
    // Mid-tier; per-tier amounts in `pricing.tiers`.
    amount: { amount: 499900n, currency: 'USD' },
    // 30-day SLA — grant prep is a multi-week effort.
    timeoutDays: 30,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'small-grant',
        amount: 99900n,
        currency: 'USD',
        description:
          'Small grant (foundation seed / pilot / R03-class, < $250k direct). PI + SRO-signed package. $999.',
      },
      {
        id: 'standard-r01',
        amount: 499900n,
        currency: 'USD',
        description:
          'Standard R01-class single-PI grant ($250k–$2M direct, 4–5 year). PI + SRO-signed package. $4,999.',
      },
      {
        id: 'multi-pi-or-large',
        amount: 1999900n,
        currency: 'USD',
        description:
          'Multi-PI / center / DARPA / large foundation ($2M+ direct, multi-site). PI + SRO-signed package. $19,999.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 25000n, perApiCall: 12n },
  reward: kr_grantSuccessRate,

  lineage: {
    cellRef: 'business.org.ai/cells/research-leads/grant-application-author',
    icpContextProblemRef: 'icp:grant-application-author:v1',
    foundingHypothesisRef: 'fh:grant-application-author:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
