/**
 * Experiment Protocol Author Service — research-experiment protocol
 * drafting for the research catalog.
 *
 * Distinguishing shape vs. siblings (`literature-review-synthesizer`,
 * `manuscript-pre-submission-reviewer`):
 *   - `quality-review` archetype — PI- and IRB-coordinator-approved
 *     protocol document + IRB submission package grounded in prior
 *     protocols + IRB policy + lab equipment inventory;
 *   - 5-step cascade: Code (prior protocols + IRB policy + lab inventory)
 *     → Generative (protocol + controls + sample-size + power analysis)
 *     → Generative (IRB readiness checklist + ethical considerations) →
 *     Human (PI + IRB-coordinator review) → Code (emit doc + IRB package);
 *   - `Pricing.perInvocation` 3 tiers — simple-observational / inter-
 *     ventional-low-risk / interventional-high-risk ($299 / $1,499 /
 *     $4,999) — keyed on study-risk band;
 *   - declarative HITL = PI + IRB-coordinator dual review (regulatory
 *     rationale; PI signs);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(PI))`.
 *
 * Service-level reward = `IRB-first-submission-acceptance-rate`.
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

/**
 * Input — hypothesis + experimental approach proposed at intake. 8
 * fields: initiative, framed hypothesis, experimental approach, study-
 * risk band (→ pricing tier), sample profile, lab context, PI routing
 * target, IRB-coordinator routing target.
 */
export const ExperimentProtocolInputSchema = z.object({
  initiativeRef: z.string(),
  hypothesis: z.object({
    statement: z.string(),
    independentVariables: z.array(z.string()).min(1),
    dependentVariables: z.array(z.string()).min(1),
    nullHypothesis: z.string().optional(),
  }),
  experimentalApproach: z.object({
    designKind: z.enum([
      'observational',
      'cross-sectional',
      'cohort',
      'case-control',
      'rct',
      'crossover',
      'within-subjects',
      'between-subjects',
    ]),
    controlStrategy: z.enum([
      'no-control',
      'historical-control',
      'placebo-control',
      'active-control',
      'sham-control',
    ]),
    blinding: z.enum(['open-label', 'single-blind', 'double-blind', 'triple-blind']),
    proposedDurationDays: z.number().int().positive(),
  }),
  studyRiskBand: z.enum([
    'simple-observational',
    'interventional-low-risk',
    'interventional-high-risk',
  ]),
  sampleProfile: z.object({
    populationKind: z.enum([
      'human-subjects',
      'animal-subjects',
      'cell-line',
      'in-vitro',
      'in-silico',
      'archival-data',
    ]),
    targetEnrollment: z.number().int().positive(),
    inclusionCriteria: z.array(z.string()).default([]),
    exclusionCriteria: z.array(z.string()).default([]),
    sensitivePopulationFlags: z
      .array(z.enum(['minors', 'pregnant', 'prisoners', 'cognitively-impaired', 'phi-handling']))
      .default([]),
  }),
  labContext: z.object({
    labRef: z.string(),
    availableEquipment: z.array(z.string()).default([]),
    requiredEquipment: z.array(z.string()).default([]),
  }),
  assignedPrincipalInvestigatorRef: z.string(),
  assignedIrbCoordinatorRef: z.string(),
})

/**
 * Output — PI- and IRB-coordinator-approved protocol document + IRB
 * submission package: prior-protocols snapshot, drafted protocol with
 * controls + sample-size + power-analysis, IRB readiness checklist +
 * ethical-considerations memo, dual review audit, emitted document, IRB
 * submission package pointer.
 */
export const ExperimentProtocolOutputSchema = z.object({
  initiativeRef: z.string(),
  hypothesis: z.object({
    statement: z.string(),
  }),
  studyRiskBand: z.enum([
    'simple-observational',
    'interventional-low-risk',
    'interventional-high-risk',
  ]),
  priorProtocolsSnapshot: z.array(
    z.object({
      protocolRef: z.string(),
      title: z.string(),
      similarityRationale: z.string(),
    })
  ),
  protocolDraft: z.object({
    title: z.string(),
    objectives: z.array(z.string()).min(1),
    procedureSteps: z
      .array(
        z.object({
          stepNumber: z.number().int().positive(),
          stepLabel: z.string(),
          description: z.string(),
          materialsAndEquipment: z.array(z.string()).default([]),
        })
      )
      .min(1),
    controls: z
      .array(
        z.object({
          controlId: z.string(),
          controlKind: z.enum([
            'placebo',
            'active-comparator',
            'sham',
            'historical',
            'positive',
            'negative',
          ]),
          rationale: z.string(),
        })
      )
      .min(1),
    sampleSizeJustification: z.object({
      targetSampleSize: z.number().int().positive(),
      effectSize: z.number(),
      effectSizeMetric: z.enum(['cohen-d', 'cohen-f', 'odds-ratio', 'hazard-ratio', 'eta-squared']),
      alpha: z.number().min(0).max(1),
      power: z.number().min(0).max(1),
      attritionAssumptionPercent: z.number().min(0).max(100),
      methodReference: z.string(),
    }),
    statisticalAnalysisPlan: z.object({
      primaryEndpointAnalysis: z.string(),
      secondaryEndpointsAnalysis: z.array(z.string()).default([]),
      adjustmentsForMultipleComparisons: z.string().optional(),
    }),
  }),
  irbReadinessChecklist: z.object({
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
    consentDocumentDraftRef: z.string().optional(),
    dataPrivacyPlan: z.string(),
    sensitivePopulationSafeguards: z.array(z.string()).default([]),
  }),
  ethicalConsiderations: z.object({
    riskBenefitSummary: z.string(),
    coercionAndUndueInfluenceMitigations: z.array(z.string()).default([]),
    dataMinimizationMeasures: z.array(z.string()).default([]),
  }),
  principalInvestigatorReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  irbCoordinatorReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  protocolDocument: z.object({
    documentRef: z.string(),
    documentUrl: z.string(),
    emittedAt: z.string(),
  }),
  irbSubmissionPackage: z.object({
    packageRef: z.string(),
    packageUrl: z.string(),
    submissionTargetIrbRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type ExperimentProtocolInput = z.infer<typeof ExperimentProtocolInputSchema>
export type ExperimentProtocolOutput = z.infer<typeof ExperimentProtocolOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_irbFirstSubmissionAcceptance: RewardSignal = {
  keyResultRef: 'kr:experiment-protocol-author:irb-first-submission-acceptance-rate',
}
const kr_priorProtocolsCoverage: RewardSignal = {
  keyResultRef: 'kr:experiment-protocol-author:prior-protocols-coverage',
}
const kr_powerAnalysisSoundness: RewardSignal = {
  keyResultRef: 'kr:experiment-protocol-author:power-analysis-soundness',
}
const kr_irbReadiness: RewardSignal = {
  keyResultRef: 'kr:experiment-protocol-author:irb-readiness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:experiment-protocol-author:emit-latency',
}

// ============================================================================
// Experiment Protocol Author Service
// ============================================================================

/**
 * Experiment Protocol Author — hypothesis + experimental approach → PI-
 * and IRB-coordinator-approved protocol document + IRB submission package
 * as a Service.
 */
export const experimentProtocolAuthor: ServiceInstance<
  ExperimentProtocolInput,
  ExperimentProtocolOutput
> = Service.define<ExperimentProtocolInput, ExperimentProtocolOutput>({
  name: 'Experiment Protocol Author',
  promise:
    'Every hypothesis + experimental approach lands as a PI- and IRB-coordinator-approved protocol document with a justified sample size, power-analysed primary endpoint, controls picked deliberately, an IRB-readiness checklist, and an ethical-considerations memo — so first-submission IRB acceptance trends up and the time from hypothesis to IRB-ready package collapses from weeks to days.',
  audience: 'business',
  archetype: 'quality-review',
  schema: { input: ExperimentProtocolInputSchema, output: ExperimentProtocolOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-prior-protocols-irb-policy-and-lab-equipment-inventory',
        reward: kr_priorProtocolsCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'draft-protocol-with-controls-sample-size-justification-and-power-analysis',
        reward: kr_powerAnalysisSoundness,
      }),
      Generative({
        name: 'draft-irb-readiness-checklist-and-ethical-considerations',
        reward: kr_irbReadiness,
      }),
      Human({
        name: 'pi-and-irb-coordinator-review',
        // `regulatory` rationale: IRB submissions + human/animal-subjects
        // research carry compliance-tied accountability — both PI
        // (scientific) and IRB-coordinator (regulatory) sign before the
        // package emits.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-protocol-doc-and-irb-submission-package',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'protocol-archive.read',
      'irb-policy.read',
      'lab-inventory.read',
      'power-analysis.compute',
      'consent-template.read',
      'docs.write',
      'irb-portal.submit',
    ],
    // Cascade synthesises from hypothesis + approach + sample + lab; the
    // dual PI + IRB-coordinator review is the single human contact surface.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // High-risk studies + sensitive-population flags escalate to a
        // senior research-ethics supervisor before the dual review.
        when: 'studyRiskBand == "interventional-high-risk" || sampleProfile.sensitivePopulationFlags.length > 0',
        action: 'escalate',
      },
      {
        // Every protocol routes through dual review before emit.
        when: 'true',
        action: 'route-to',
        target: 'pi-and-irb-coordinator-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:experiment-protocol-author-review',
    personas: [
      // Power-analysis-soundness reviewer — sample-size cites power,
      // effect size, alpha, attrition, and a referenced method; target
      // size resolves consistently. Guards against rubber-stamp "n=30
      // because it's a round number" justification.
      Personas.pedantic({
        domain: 'power-analysis-soundness',
        rubric: [
          'sample-size-cites-effect-size-alpha-power-and-attrition',
          'effect-size-metric-matches-design-kind',
          'method-reference-cites-a-concrete-citation',
          'target-sample-size-consistent-with-cited-inputs',
          'no-rubber-stamp-round-number-justification',
        ],
        name: 'power-analysis-soundness-checker',
      }),
      // Regulatory-compliance reviewer — HIPAA-tier compliance check
      // (PHI handling, data-privacy plan, sensitive-population safeguards,
      // consent-document draft). Right floor even for non-clinical
      // studies because the dossier travels through the IRB portal.
      Personas.regulatoryCompliance({
        regulator: 'hipaa',
        name: 'hipaa-compliance-reviewer',
      }),
      // Edge-case-coverage reviewer — protocols fail at the edges
      // (drop-outs, partial-data, equipment failure, deviations, missed
      // dosing); enforces ≥5 edge-cases per primary scenario.
      Personas.edgeCaseCoverage({
        minEdgeCasesPerScenario: 5,
        name: 'edge-case-coverage-reviewer',
      }),
      // Ethical-coverage reviewer — concretely addresses risk-benefit,
      // coercion + undue-influence, and data-minimization (no hand-wavy
      // "risks are minimal" without enumeration).
      Personas.skeptic({
        domain: 'ethical-coverage',
        focus: [
          'risk-benefit-summary-cites-concrete-risks-and-benefits',
          'coercion-mitigations-enumerated-not-asserted',
          'data-minimization-measures-cite-specific-fields-or-flows',
          'sensitive-population-safeguards-applied-when-flagged',
          'no-hand-wavy-risks-are-minimal-claims',
        ],
        name: 'ethical-coverage-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:experiment-protocol-author:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-research-lead',
    seller: 'svc:experiment-protocol-author',
    serviceRef: 'svc:experiment-protocol-author',
    // PI signs every protocol before the IRB package emits.
    predicate: AND(
      SchemaMatch(ExperimentProtocolOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['principal-investigator'] })
    ),
    // Mid-tier; per-tier amounts in `pricing.tiers`.
    amount: { amount: 149900n, currency: 'USD' },
    // 14-day SLA.
    timeoutDays: 14,
    onTimeout: 'escalate',
  },

  pricing: Pricing.perInvocation({
    tiers: [
      {
        id: 'simple-observational',
        amount: 29900n,
        includedPerMonth: 6,
        overage: 29900n,
      },
      {
        id: 'interventional-low-risk',
        amount: 149900n,
        includedPerMonth: 3,
        overage: 149900n,
      },
      {
        id: 'interventional-high-risk',
        amount: 499900n,
        includedPerMonth: 1,
        overage: 499900n,
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 12000n, perApiCall: 7n },
  reward: kr_irbFirstSubmissionAcceptance,

  lineage: {
    cellRef: 'business.org.ai/cells/research-leads/experiment-protocol-author',
    icpContextProblemRef: 'icp:experiment-protocol-author:v1',
    foundingHypothesisRef: 'fh:experiment-protocol-author:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
