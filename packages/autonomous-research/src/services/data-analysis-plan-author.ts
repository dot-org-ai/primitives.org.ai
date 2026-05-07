/**
 * Data Analysis Plan Author Service — statistical analysis plan +
 * reproducibility package authoring for the research catalog.
 *
 * Distinguishing shape vs. siblings:
 *   - `quality-review` archetype — PI- and biostatistician-signed Data
 *     Analysis Plan (DAP) document + OSF pre-registration + analysis-code
 *     skeleton + reproducibility checklist;
 *   - 5-step cascade: Code (data schema + research questions + study design
 *     + IRB protocol) → Generative (draft analysis plan: primary +
 *     secondary + sensitivity analyses + multiplicity corrections + missing-
 *     data handling) → Generative (emit pre-registered protocol + code
 *     skeleton + reproducibility checklist) → Human (PI + biostatistician
 *     review) → Code (emit DAP doc + OSF pre-registration + analysis
 *     template);
 *   - `Pricing.outcome` 3 tiers — descriptive / inferential / multi-cohort-
 *     or-causal ($199 / $999 / $2,999) — keyed on analysis-tier band;
 *   - declarative HITL = dual review — PI (premium rationale; signs the
 *     plan) + biostatistician (premium rationale; signs the methods);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(PI))`.
 *
 * Service-level reward = `pre-registration-adherence-and-replication-fidelity`.
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

const AnalysisTier = z.enum(['descriptive', 'inferential', 'multi-cohort-or-causal'])

const StatTestKind = z.enum([
  't-test',
  'chi-square',
  'anova',
  'mann-whitney',
  'wilcoxon',
  'linear-regression',
  'logistic-regression',
  'mixed-effects',
  'cox-regression',
  'kaplan-meier',
  'glm',
  'multilevel',
  'difference-in-differences',
  'instrumental-variables',
  'propensity-score',
  'g-computation',
  'other',
])

const MissingDataApproach = z.enum([
  'complete-case',
  'mean-imputation',
  'multiple-imputation',
  'maximum-likelihood',
  'inverse-probability-weighting',
  'last-observation-carried-forward',
])

const MultiplicityApproach = z.enum([
  'none-justified',
  'bonferroni',
  'holm',
  'benjamini-hochberg',
  'hierarchical-gatekeeping',
  'pre-specified-primary-only',
])

/** Input — data-collection complete OR pre-registered analysis plan due. */
export const DataAnalysisPlanInputSchema = z.object({
  initiativeRef: z.string(),
  trigger: z.enum(['data-collection-complete', 'pre-registration-due']),
  analysisTier: AnalysisTier,
  studyDesign: z.object({
    designKind: z.enum([
      'observational',
      'cross-sectional',
      'cohort',
      'case-control',
      'rct',
      'crossover',
      'within-subjects',
      'between-subjects',
      'time-series',
      'panel',
    ]),
    randomizationStrategy: z.string().optional(),
    blinding: z.enum(['open-label', 'single-blind', 'double-blind', 'triple-blind']).optional(),
  }),
  researchQuestions: z
    .array(
      z.object({
        questionId: z.string(),
        question: z.string(),
        kind: z.enum(['primary', 'secondary', 'exploratory']),
      })
    )
    .min(1),
  dataSchema: z.object({
    datasetRef: z.string(),
    variables: z
      .array(
        z.object({
          variableRef: z.string(),
          name: z.string(),
          role: z.enum(['outcome', 'exposure', 'covariate', 'identifier', 'auxiliary']),
          measurementLevel: z.enum(['nominal', 'ordinal', 'interval', 'ratio']),
          missingnessExpectedPercent: z.number().min(0).max(100).default(0),
        })
      )
      .min(1),
    expectedSampleSize: z.number().int().positive(),
  }),
  irbProtocolRef: z.string().optional(),
  preRegistrationTarget: z.object({
    registry: z.enum(['osf', 'aspredicted', 'clinicaltrials-gov', 'isrctn', 'prospero', 'none']),
    targetDate: z.string().optional(),
  }),
  reproducibilityRequirements: z.object({
    requireCodeSkeleton: z.boolean().default(true),
    requireDataDictionary: z.boolean().default(true),
    requireOpenDataPlan: z.boolean().default(false),
    targetLanguage: z.enum(['r', 'python', 'stata', 'sas', 'other']),
  }),
  assignedPrincipalInvestigatorRef: z.string(),
  assignedBiostatisticianRef: z.string(),
})

/** Output — DAP document + OSF pre-registration + reproducibility package. */
export const DataAnalysisPlanOutputSchema = z.object({
  initiativeRef: z.string(),
  analysisTier: AnalysisTier,
  inputSnapshot: z.object({
    datasetRef: z.string(),
    expectedSampleSize: z.number().int().positive(),
    primaryQuestionCount: z.number().int().nonnegative(),
    secondaryQuestionCount: z.number().int().nonnegative(),
    fetchedAt: z.string(),
  }),
  primaryAnalyses: z
    .array(
      z.object({
        analysisId: z.string(),
        questionId: z.string(),
        outcomeVariableRef: z.string(),
        exposureVariableRef: z.string().optional(),
        statisticalTest: StatTestKind,
        rationale: z.string(),
        powerAnalysis: z.object({
          targetSampleSize: z.number().int().positive(),
          effectSize: z.number(),
          alpha: z.number().min(0).max(1),
          power: z.number().min(0).max(1),
          methodReference: z.string(),
        }),
      })
    )
    .min(1),
  secondaryAnalyses: z
    .array(
      z.object({
        analysisId: z.string(),
        questionId: z.string(),
        statisticalTest: StatTestKind,
        rationale: z.string(),
      })
    )
    .default([]),
  sensitivityAnalyses: z
    .array(
      z.object({
        analysisId: z.string(),
        purpose: z.enum([
          'robustness-to-missing-data',
          'robustness-to-outliers',
          'alternative-model-spec',
          'subgroup-consistency',
          'unmeasured-confounding',
        ]),
        description: z.string(),
      })
    )
    .min(1),
  multiplicityHandling: z.object({
    approach: MultiplicityApproach,
    familyOfTests: z.array(z.string()).default([]),
    rationale: z.string(),
  }),
  missingDataHandling: z.object({
    approach: MissingDataApproach,
    assumedMechanism: z.enum(['mcar', 'mar', 'mnar']),
    rationale: z.string(),
  }),
  preRegisteredProtocol: z.object({
    protocolRef: z.string(),
    registry: z.enum(['osf', 'aspredicted', 'clinicaltrials-gov', 'isrctn', 'prospero', 'none']),
    deviationPolicy: z.string(),
    submittedAt: z.string().optional(),
  }),
  codeSkeleton: z.object({
    language: z.enum(['r', 'python', 'stata', 'sas', 'other']),
    skeletonRef: z.string(),
    skeletonUrl: z.string(),
    notebookKind: z.enum(['rmd', 'qmd', 'jupyter', 'do-file', 'sas-program', 'plain-script']),
  }),
  reproducibilityChecklist: z.object({
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
    overallStatus: z.enum(['reproducible', 'gaps-remain']),
  }),
  principalInvestigatorReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  biostatisticianReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  dapDocument: z.object({
    documentRef: z.string(),
    documentUrl: z.string(),
    emittedAt: z.string(),
  }),
  osfPreRegistration: z.object({
    preRegistrationRef: z.string(),
    preRegistrationUrl: z.string(),
    locked: z.boolean(),
    lockedAt: z.string().optional(),
  }),
  analysisTemplate: z.object({
    templateRef: z.string(),
    templateUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type DataAnalysisPlanInput = z.infer<typeof DataAnalysisPlanInputSchema>
export type DataAnalysisPlanOutput = z.infer<typeof DataAnalysisPlanOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_preRegistrationAndReplicationFidelity: RewardSignal = {
  keyResultRef: 'kr:data-analysis-plan-author:pre-registration-adherence-and-replication-fidelity',
}
const kr_inputCoverage: RewardSignal = {
  keyResultRef: 'kr:data-analysis-plan-author:input-coverage',
}
const kr_analysisPlanCompleteness: RewardSignal = {
  keyResultRef: 'kr:data-analysis-plan-author:analysis-plan-completeness',
}
const kr_reproducibilityCompleteness: RewardSignal = {
  keyResultRef: 'kr:data-analysis-plan-author:reproducibility-completeness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:data-analysis-plan-author:emit-latency',
}

// ============================================================================
// Data Analysis Plan Author Service
// ============================================================================

/**
 * Data Analysis Plan Author — data schema + research questions + study
 * design → PI- and biostatistician-signed DAP document + OSF pre-
 * registration + reproducibility package as a Service.
 */
export const dataAnalysisPlanAuthor: ServiceInstance<
  DataAnalysisPlanInput,
  DataAnalysisPlanOutput
> = Service.define<DataAnalysisPlanInput, DataAnalysisPlanOutput>({
  name: 'Data Analysis Plan Author',
  promise:
    'Every data-collection-complete or pre-registration-due milestone lands as a PI- and biostatistician-signed DAP document + locked OSF pre-registration + analysis-code skeleton + reproducibility checklist — primary, secondary, and sensitivity analyses pre-specified, multiplicity and missing-data handling justified — so pre-registration adherence and replication fidelity trend up and the time from "data ready" to "analysis-ready protocol" collapses from weeks to days.',
  audience: 'business',
  archetype: 'quality-review',
  schema: { input: DataAnalysisPlanInputSchema, output: DataAnalysisPlanOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-data-schema-research-questions-study-design-and-irb-protocol',
        reward: kr_inputCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'draft-analysis-plan-primary-and-secondary-and-sensitivity-analyses-with-multiplicity-and-missing-data-handling',
        reward: kr_analysisPlanCompleteness,
      }),
      Generative({
        name: 'emit-pre-registered-protocol-code-skeleton-and-reproducibility-checklist',
        reward: kr_reproducibilityCompleteness,
      }),
      Human({
        name: 'pi-and-biostatistician-review',
        // `premium` rationale: biostatistician judgement on test selection,
        // power, and missing-data assumptions is the value being sold; PI
        // judgement on scientific framing is the parallel premium signal.
        rationale: 'premium',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-dap-doc-osf-pre-registration-and-analysis-template',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'data-catalog.read',
      'study-design.read',
      'irb-policy.read',
      'power-analysis.compute',
      'osf.publish',
      'aspredicted.publish',
      'code-skeleton.scaffold',
      'docs.write',
      'analysis-template.scaffold',
    ],
    // Cascade synthesises from data-schema + questions + design + IRB; the
    // dual PI + biostatistician review is the single human contact surface.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Multi-cohort or causal-inference plans escalate to a senior
        // methods supervisor before the dual review.
        when: 'analysisTier == "multi-cohort-or-causal"',
        action: 'escalate',
      },
      {
        // Every plan routes through dual review before emit.
        when: 'true',
        action: 'route-to',
        target: 'pi-and-biostatistician-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:data-analysis-plan-author-review',
    personas: [
      // Edge-case-coverage reviewer — analysis plans fail at the edges
      // (small subgroups, missing-data patterns, outliers, model
      // mis-specification, distributional violations); enforces ≥6
      // edge-cases per primary scenario for a credible sensitivity-
      // analysis battery.
      Personas.edgeCaseCoverage({
        minEdgeCasesPerScenario: 6,
        name: 'sensitivity-and-edge-case-coverage-reviewer',
      }),
      // Citation-grounding reviewer — every method choice cites a peer-
      // reviewed methodological reference. Reviewers reject plans that
      // pick a test without a referenced rationale.
      Personas.factualAccuracy({
        citationRequired: true,
        sourceTypes: ['peer-reviewed'],
        name: 'methodology-citation-grounding-reviewer',
      }),
      // Power-analysis-soundness reviewer — every primary analysis cites
      // a target sample size, effect size, alpha, power, and a referenced
      // method; secondary analyses are explicitly tagged as such.
      Personas.pedantic({
        domain: 'power-analysis-and-multiplicity',
        rubric: [
          'every-primary-analysis-cites-effect-size-alpha-and-power',
          'method-reference-cites-a-concrete-citation',
          'multiplicity-approach-matches-family-size',
          'no-rubber-stamp-bonferroni-without-justification',
          'pre-specified-primary-set-locked-before-data-look',
        ],
        name: 'power-analysis-and-multiplicity-checker',
      }),
      // Reproducibility-completeness reviewer — every reproducibility
      // checklist item has a concrete owner + status (no "TBD" gaps);
      // missing-data approach matches the assumed mechanism.
      Personas.pedantic({
        domain: 'reproducibility-completeness',
        rubric: [
          'every-checklist-item-has-a-concrete-status',
          'overall-status-tracks-checklist-gap-count',
          'missing-data-approach-matches-assumed-mechanism',
          'code-skeleton-language-matches-target-language',
          'pre-registration-locked-before-emit-when-registry-not-none',
        ],
        name: 'reproducibility-completeness-checker',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:data-analysis-plan-author:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-research-lead',
    seller: 'svc:data-analysis-plan-author',
    serviceRef: 'svc:data-analysis-plan-author',
    // PI signs every DAP before the OSF pre-registration locks.
    predicate: AND(
      SchemaMatch(DataAnalysisPlanOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['principal-investigator'] })
    ),
    // Mid-tier; per-tier amounts in `pricing.tiers`.
    amount: { amount: 99900n, currency: 'USD' },
    // 14-day SLA.
    timeoutDays: 14,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'descriptive',
        amount: 19900n,
        currency: 'USD',
        description:
          'Descriptive analysis plan (single dataset, descriptive + simple inferential, no causal claims). PI + biostatistician-signed. $199.',
      },
      {
        id: 'inferential',
        amount: 99900n,
        currency: 'USD',
        description:
          'Inferential analysis plan (regression / GLM / mixed-effects, multiplicity-adjusted, sensitivity battery). PI + biostatistician-signed. $999.',
      },
      {
        id: 'multi-cohort-or-causal',
        amount: 299900n,
        currency: 'USD',
        description:
          'Multi-cohort or causal-inference plan (DiD, IV, propensity-score, g-computation, multi-site harmonisation). PI + biostatistician-signed. $2,999.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 11000n, perApiCall: 7n },
  reward: kr_preRegistrationAndReplicationFidelity,

  lineage: {
    cellRef: 'business.org.ai/cells/research-leads/data-analysis-plan-author',
    icpContextProblemRef: 'icp:data-analysis-plan-author:v1',
    foundingHypothesisRef: 'fh:data-analysis-plan-author:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
