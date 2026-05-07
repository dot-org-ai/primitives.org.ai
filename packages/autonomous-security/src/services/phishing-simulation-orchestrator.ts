/**
 * Phishing Simulation Orchestrator Service — security-awareness phishing-
 * simulation Service for the security catalog.
 *
 * Distinguishing shape vs. siblings (`vuln-triager`,
 * `access-review-coordinator`):
 *   - `content-generation` archetype — the artefact is a security-lead-
 *     approved set of role-targeted phish templates + debrief content +
 *     launched simulation campaign + engagement-tracking emit, not a vuln-
 *     triage record or a quarterly UAR evidence pack;
 *   - 5-step cascade: Code fan-in (employee roster + role context + prior
 *     simulation results) → Generative (role-targeted phish templates: 3-5
 *     variants per role-cluster) → Generative (debrief content for clickers
 *     + escalation for repeat offenders) → Human (security-lead reviews and
 *     approves templates BEFORE launch) → Code (launch simulation + emit
 *     engagement tracking);
 *   - `Pricing.outcome` 3 tiers keyed on employee-count band — small-org /
 *     medium-org / enterprise ($999 / $4,999 / $19,999) — campaign value
 *     scales with population reach + click-rate-reduction headroom;
 *   - declarative HITL = mandatory security-lead pre-launch review (the
 *     security-lead owns brand-safety + ethical-design accountability — no
 *     phish goes live before the lead has approved the templates), plus
 *     OutcomeContract requires security-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(template-realism +
 *     role-targeting + brand-safety + ethical-design) + HumanSign(security-
 *     lead))`.
 *
 * Per design v3 §3 (Catalog HOW security) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `phish-click-rate-reduction-quarter-over-quarter` —
 * the compound metric every security-awareness program optimises against
 * (the orchestrator is worth running iff the click-rate at quarter-end
 * trends down vs. the prior quarter at parity role-mix + parity template-
 * difficulty).
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
 * Input — a monthly cron firing at simulation-due. Tight: 8 fields cover the
 * security-team identity, the campaign window, the in-scope employee
 * population (the cohort the simulation fans out to), the employee-count
 * band (so the per-tier outcome pricing is resolvable at intake), the
 * campaign-difficulty knob, the assigned security-lead routing target for
 * the pre-launch review, the simulation-platform fan-out target, and the
 * brand-safety guardrails (do-not-impersonate list, off-limits scenario
 * list).
 */
export const PhishingSimulationInputSchema = z.object({
  securityTeamRef: z.string(),
  campaignWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  inScopeEmployeePopulation: z.object({
    cohortName: z.string(),
    employeeCount: z.number().int().nonnegative(),
    roleClusters: z
      .array(
        z.object({
          clusterId: z.string(),
          clusterLabel: z.string(),
          employeeCount: z.number().int().nonnegative(),
          accessSensitivityTier: z.enum(['restricted', 'confidential', 'internal']),
        })
      )
      .min(1),
  }),
  employeeCountBand: z.enum(['small-org', 'medium-org', 'enterprise']),
  campaignDifficulty: z.enum(['gentle', 'standard', 'challenging']),
  assignedSecurityLeadRef: z.string(),
  simulationPlatform: z.enum(['knowbe4', 'proofpoint-security-awareness', 'hoxhunt', 'in-house']),
  brandSafetyGuardrails: z.object({
    doNotImpersonateBrands: z.array(z.string()).default([]),
    offLimitsScenarioCategories: z
      .array(
        z.enum([
          'death-or-illness',
          'family-emergency',
          'job-loss-or-layoff',
          'compensation-cut',
          'legal-threat',
        ])
      )
      .default([]),
    requiresLegalReviewForCustomBrands: z.boolean().default(true),
  }),
})

/**
 * Output — a security-lead-approved set of role-targeted phish templates +
 * launched campaign + engagement-tracking emit: the cohort snapshot, the
 * role-targeted template variants (3-5 per role cluster), the debrief +
 * escalation content, the security-lead pre-launch review audit, the
 * launched simulation campaign metadata, and the engagement-tracking emit
 * pointer.
 */
export const PhishingSimulationOutputSchema = z.object({
  securityTeamRef: z.string(),
  campaignWindow: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  cohortSnapshot: z.object({
    cohortName: z.string(),
    employeeCount: z.number().int().nonnegative(),
    roleClusterCount: z.number().int().nonnegative(),
    priorClickRatePercent: z.number().min(0).max(100).optional(),
    repeatOffenderCount: z.number().int().nonnegative(),
  }),
  roleTargetedTemplates: z
    .array(
      z.object({
        roleClusterId: z.string(),
        templateVariants: z
          .array(
            z.object({
              templateId: z.string(),
              scenarioCategory: z.enum([
                'invoice-payment',
                'shared-document',
                'password-reset',
                'shipping-notification',
                'meeting-invite',
                'benefits-enrollment',
                'it-helpdesk',
              ]),
              difficultyBand: z.enum(['gentle', 'standard', 'challenging']),
              subjectLine: z.string(),
              previewBody: z.string(),
              redFlagAnnotations: z.array(z.string()).min(1),
              brandImpersonatedRef: z.string().optional(),
            })
          )
          .min(3)
          .max(5),
      })
    )
    .min(1),
  debriefContent: z.object({
    clickerDebriefMarkdown: z.string(),
    repeatOffenderEscalationPlan: z.object({
      thresholdClickCount: z.number().int().positive(),
      escalationPath: z.array(
        z.object({
          step: z.string(),
          ownerRoleRef: z.string(),
        })
      ),
    }),
  }),
  securityLeadPreLaunchReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-template-edits', 'request-revision', 'reject']),
    approvedTemplateIds: z.array(z.string()),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  launchedCampaign: z.object({
    campaignRef: z.string(),
    platform: z.enum(['knowbe4', 'proofpoint-security-awareness', 'hoxhunt', 'in-house']),
    launchedAt: z.string(),
    targetEmployeeCount: z.number().int().nonnegative(),
    scheduledClosureAt: z.string(),
  }),
  engagementTracking: z.object({
    trackingDashboardUrl: z.string(),
    trackingEmitRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type PhishingSimulationInput = z.infer<typeof PhishingSimulationInputSchema>
export type PhishingSimulationOutput = z.infer<typeof PhishingSimulationOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_clickRateReduction: RewardSignal = {
  keyResultRef:
    'kr:phishing-simulation-orchestrator:phish-click-rate-reduction-quarter-over-quarter',
}
const kr_cohortCoverage: RewardSignal = {
  keyResultRef: 'kr:phishing-simulation-orchestrator:cohort-coverage',
}
const kr_templateRoleFit: RewardSignal = {
  keyResultRef: 'kr:phishing-simulation-orchestrator:template-role-fit',
}
const kr_debriefActionability: RewardSignal = {
  keyResultRef: 'kr:phishing-simulation-orchestrator:debrief-actionability',
}
const kr_launchLatency: RewardSignal = {
  keyResultRef: 'kr:phishing-simulation-orchestrator:launch-latency',
}

// ============================================================================
// Phishing Simulation Orchestrator Service
// ============================================================================

/**
 * Phishing Simulation Orchestrator — monthly cron + employee population in
 * scope → security-lead-approved set of role-targeted phish templates +
 * launched simulation campaign + engagement-tracking emit as a Service.
 *
 * Cascade: fetch-employee-roster-role-context-and-prior-simulation-results (Code, fan-in)
 *        → synthesize-role-targeted-phish-templates-3-to-5-variants-per-role-cluster (Generative)
 *        → draft-debrief-content-for-clickers-and-escalation-for-repeat-offenders (Generative)
 *        → security-lead-review-and-approve-templates-before-launch (Human, regulatory rationale)
 *        → launch-simulation-and-emit-engagement-tracking (Code, fan-out).
 */
export const phishingSimulationOrchestrator: ServiceInstance<
  PhishingSimulationInput,
  PhishingSimulationOutput
> = Service.define<PhishingSimulationInput, PhishingSimulationOutput>({
  name: 'Phishing Simulation Orchestrator',
  promise:
    'Every month, every role cluster in the employee population gets a role-targeted phishing simulation — 3-5 variants per cluster, brand-safe, security-lead-approved before launch, with debrief content for clickers and escalation for repeat offenders — so the click-rate trends down quarter-over-quarter and the security-awareness program ships measurable behaviour change.',
  audience: 'business',
  archetype: 'content-generation',
  schema: { input: PhishingSimulationInputSchema, output: PhishingSimulationOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-employee-roster-role-context-and-prior-simulation-results',
        reward: kr_cohortCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-role-targeted-phish-templates-3-to-5-variants-per-role-cluster',
        reward: kr_templateRoleFit,
      }),
      Generative({
        name: 'draft-debrief-content-for-clickers-and-escalation-for-repeat-offenders',
        reward: kr_debriefActionability,
      }),
      Human({
        name: 'security-lead-review-and-approve-templates-before-launch',
        // `regulatory` rationale: simulation templates carry brand-safety
        // + ethical-design accountability — impersonating a real brand or
        // shipping an off-limits scenario (death, layoff) creates legal +
        // reputational exposure. The pre-launch gate stays human
        // regardless of model accuracy.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'launch-simulation-and-emit-engagement-tracking',
        reward: kr_launchLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'hris.roster',
      'okta.users',
      'azure-ad.users',
      'simulation-platform.templates',
      'simulation-platform.campaigns',
      'simulation-platform.engagement',
      'docs.write',
      'analytics.emit',
    ],
    // Monthly cadence: clarification disabled — the cascade synthesises
    // from the roster + role-context + prior-results signals; the
    // security-lead pre-launch review is the single human contact point
    // before the campaign goes live.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Restricted-tier role clusters (executive / finance / IAM admin)
        // escalate the template synthesis to a senior security-awareness
        // supervisor before the security-lead review (the lead still
        // signs, but a senior backstops template-realism + brand-safety
        // on the highest-risk cohorts).
        when: 'inScopeEmployeePopulation.roleClusters.some(c => c.accessSensitivityTier == "restricted")',
        action: 'escalate',
      },
      {
        // Every campaign routes through security-lead pre-launch review
        // before the simulation goes live; OutcomeContract enforces the
        // signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'security-lead-review-and-approve-templates-before-launch',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:phishing-simulation-orchestrator-review',
    personas: [
      // Template-realism reviewer — adversarially probes whether each
      // template variant is realistic enough to be a meaningful test
      // (subject line + preview body land like a real lure) without
      // crossing into brand-impersonation or off-limits-scenario
      // territory. The risk this guards against is "templates so obvious
      // no one clicks" (no signal) AND "templates so deceptive they
      // create real harm" (ethical violation).
      Personas.skeptic({
        domain: 'template-realism',
        focus: [
          'subject-line-lands-like-a-real-lure',
          'preview-body-credible-for-the-role-cluster',
          'red-flag-annotations-cite-concrete-tells',
          'no-template-too-obvious-to-test-anything',
          'no-template-deceptive-enough-to-cause-real-harm',
        ],
        name: 'template-realism-reviewer',
      }),
      // Role-targeting reviewer — pedantic check that every role cluster
      // has 3-5 template variants, that scenarios are differentiated
      // across clusters (the executive cohort doesn't get the same
      // template as the IT-helpdesk cohort), and that the difficulty
      // band tracks the input `campaignDifficulty` knob.
      Personas.pedantic({
        domain: 'role-targeting',
        rubric: [
          'every-role-cluster-has-3-to-5-template-variants',
          'scenario-categories-differentiated-across-clusters',
          'difficulty-band-tracks-campaign-difficulty-input',
          'every-template-cites-red-flag-annotations',
          'no-cluster-silently-omitted',
        ],
        name: 'role-targeting-checker',
      }),
      // Brand-safety reviewer — low-risk-tolerance brand check on
      // every template (no impersonation of brands on the do-not-
      // impersonate list, no off-limits scenario categories, no preview
      // body that uses brand assets without legal-review-for-custom-
      // brands flagged).
      Personas.brandSafety({
        riskTolerance: 'low',
        name: 'brand-safety-reviewer',
      }),
      // Security-threat reviewer — adversarial security review on the
      // prompt-injection surface (the simulation platform receives
      // generated template bodies; templates that smuggle prompt-
      // injection payloads against the platform's downstream LLM
      // pipelines are the relevant attack surface here).
      Personas.securityThreat({
        surfaces: ['prompt-injection'],
        name: 'prompt-injection-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:phishing-simulation-orchestrator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-security-lead',
    seller: 'svc:phishing-simulation-orchestrator',
    serviceRef: 'svc:phishing-simulation-orchestrator',
    // Security-lead signs every template set before the campaign goes
    // live — phishing-simulation pre-launch authority cannot be
    // delegated (brand-safety + ethical-design accountability).
    predicate: AND(
      SchemaMatch(PhishingSimulationOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['security-lead'] })
    ),
    // Mid-tier amount; the per-tier amounts are in `pricing.tiers`.
    amount: { amount: 499900n, currency: 'USD' },
    // 14-day SLA — monthly cadence + template-synthesis depth + pre-
    // launch review means the campaign launches within a fortnight of
    // the trigger.
    timeoutDays: 14,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'small-org',
        amount: 99900n,
        currency: 'USD',
        description: 'Small-org employee-count band (≤250 employees). Monthly campaign. $999.',
      },
      {
        id: 'medium-org',
        amount: 499900n,
        currency: 'USD',
        description:
          'Medium-org employee-count band (251–2,500 employees). Monthly campaign. $4,999.',
      },
      {
        id: 'enterprise',
        amount: 1999900n,
        currency: 'USD',
        description:
          'Enterprise employee-count band (>2,500 employees). Monthly campaign. $19,999.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 14000n, perApiCall: 6n },
  reward: kr_clickRateReduction,

  lineage: {
    cellRef: 'business.org.ai/cells/security-leads/phishing-simulation-orchestrator',
    icpContextProblemRef: 'icp:phishing-simulation-orchestrator:v1',
    foundingHypothesisRef: 'fh:phishing-simulation-orchestrator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
