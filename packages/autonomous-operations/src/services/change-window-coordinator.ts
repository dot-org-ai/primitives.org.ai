/**
 * Change Window Coordinator Service — release / change-window planning + risk
 * gate Service for the operations catalog.
 *
 * Distinguishing shape vs. siblings (`incident-commander`,
 * `oncall-handoff-narrator`, `capacity-planner`, `slo-budget-tracker`,
 * `runbook-author`):
 *   - `quality-review` archetype — the artefact is a release-manager-approved
 *     change-window runbook with blast-radius bundle + sequencing plan +
 *     rollback plan + monitoring watchpoints, not a continuous burn-down
 *     narrative or an in-incident mitigation plan;
 *   - 5-step cascade: Code fan-in (pending changes + dependent services +
 *     recent-incident overlap) → Generative (change-bundle with blast-radius +
 *     sequencing plan) → Generative (rollback plan + monitoring watchpoints)
 *     → Human (release-manager + SRE-lead joint go/no-go) → Code (emit
 *     change-window runbook + freeze overrides + audit-log);
 *   - `Pricing.outcome` 3 tiers keyed on change scope — team-window,
 *     cross-team-window, company-wide-freeze ($499 / $1,999 / $9,999) — the
 *     coordinator is worth more on a company-wide freeze than on a single-
 *     team window;
 *   - declarative HITL = mandatory release-manager + SRE-lead joint go/no-go
 *     (the release-manager owns ship authority; the SRE-lead owns the
 *     freeze-override authority during high-risk windows); plus
 *     OutcomeContract requires release-manager signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(blast-radius-coverage +
 *     rollback-soundness + monitoring-watchpoint-density) +
 *     HumanSign(release-manager))`.
 *
 * Per design v3 §3 (Catalog HOW operations) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate
 * AND).
 *
 * Service-level reward = `change-induced-incident-rate-reduction` — the
 * compound metric every change-management org optimises against (the
 * coordinator is worth running iff change-induced incidents drop vs. the
 * pre-Service baseline; the coordinator turns blast-radius + rollback +
 * monitoring into an explicit ship-time discipline rather than a post-
 * incident regret).
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
 * Input — a release-planned-or-change-window-scheduled trigger. Tight: 7
 * fields cover the change-window identity, the scope tier (so the outcome-
 * tier pricing is resolvable at intake), the planned window, the in-scope
 * change refs (so the cascade fans-in to the pending PR / config / migration
 * sets), the change-management system, the assigned release-manager (so the
 * joint go/no-go routes to the right inbox), and the assigned SRE-lead (so
 * the freeze-override authority routes correctly).
 */
export const ChangeWindowInputSchema = z.object({
  changeWindowId: z.string(),
  scopeTier: z.enum(['team-window', 'cross-team-window', 'company-wide-freeze']),
  plannedWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  inScopeChangeRefs: z
    .array(
      z.object({
        changeRef: z.string(),
        kind: z.enum(['code-deploy', 'config-change', 'schema-migration', 'feature-flag-flip']),
        ownerTeamRef: z.string(),
      })
    )
    .min(1),
  changeManagementSystem: z.enum(['github', 'gitlab', 'spinnaker', 'argocd', 'servicenow']),
  assignedReleaseManagerRef: z.string(),
  assignedSreLeadRef: z.string(),
})

/**
 * Output — a release-manager-approved change-window runbook: the change-
 * bundle with declared blast radius, the sequencing plan, the rollback plan,
 * the monitoring watchpoints, the joint go/no-go audit, and pointers to the
 * emitted runbook + freeze overrides + audit-log artefacts.
 */
export const ChangeWindowRunbookOutputSchema = z.object({
  changeWindowId: z.string(),
  scopeTier: z.enum(['team-window', 'cross-team-window', 'company-wide-freeze']),
  plannedWindow: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  changeBundle: z.array(
    z.object({
      changeRef: z.string(),
      kind: z.enum(['code-deploy', 'config-change', 'schema-migration', 'feature-flag-flip']),
      ownerTeamRef: z.string(),
      blastRadius: z.enum(['contained', 'service-wide', 'cross-team', 'company-wide']),
      dependentServiceRefs: z.array(z.string()),
      recentIncidentOverlapRefs: z.array(z.string()),
    })
  ),
  sequencingPlan: z.object({
    summaryMarkdown: z.string(),
    phases: z
      .array(
        z.object({
          phaseId: z.string(),
          orderIndex: z.number().int().nonnegative(),
          changeRefs: z.array(z.string()).min(1),
          gateCondition: z.string(),
          estimatedDurationMinutes: z.number().int().nonnegative(),
        })
      )
      .min(1),
    parallelismRationale: z.string(),
  }),
  rollbackPlan: z.object({
    summaryMarkdown: z.string(),
    perChangeProcedures: z
      .array(
        z.object({
          changeRef: z.string(),
          rollbackProcedure: z.string(),
          rollbackEstimatedMinutes: z.number().int().nonnegative(),
          dataLossRisk: z.enum(['none', 'forward-only-replay', 'irreversible']),
        })
      )
      .min(1),
    bundleRollbackOrdering: z.array(z.string()),
  }),
  monitoringWatchpoints: z
    .array(
      z.object({
        watchpointId: z.string(),
        sourceMetricRef: z.string(),
        tripCondition: z.string(),
        severityIfTripped: z.enum(['SEV1', 'SEV2', 'SEV3']),
        autoActionOnTrip: z.enum(['alert-only', 'pause-window', 'auto-rollback']),
        relatedChangeRefs: z.array(z.string()),
      })
    )
    .min(1),
  goNoGoApproval: z.object({
    releaseManagerReviewerRef: z.string(),
    sreLeadReviewerRef: z.string(),
    decision: z.enum(['go', 'go-with-edits', 'no-go', 'defer']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  freezeOverrideRefs: z.array(z.string()).default([]),
  runbookArtefact: z.object({
    runbookUrl: z.string(),
    auditLogRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type ChangeWindowInput = z.infer<typeof ChangeWindowInputSchema>
export type ChangeWindowRunbookOutput = z.infer<typeof ChangeWindowRunbookOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_changeIncidentRate: RewardSignal = {
  keyResultRef: 'kr:change-window-coordinator:change-induced-incident-rate-reduction',
}
const kr_pendingChangesCoverage: RewardSignal = {
  keyResultRef: 'kr:change-window-coordinator:pending-changes-coverage',
}
const kr_blastRadiusQuality: RewardSignal = {
  keyResultRef: 'kr:change-window-coordinator:blast-radius-and-sequencing-quality',
}
const kr_rollbackSoundness: RewardSignal = {
  keyResultRef: 'kr:change-window-coordinator:rollback-and-watchpoint-soundness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:change-window-coordinator:emit-latency',
}

// ============================================================================
// Change Window Coordinator Service
// ============================================================================

/**
 * Change Window Coordinator — release-planned or change-window-scheduled →
 * release-manager-approved change-window runbook + freeze overrides +
 * audit-log emitted as a Service.
 *
 * Cascade: fetch-pending-changes-dependent-services-and-recent-incident-overlap (Code, fan-in)
 *        → synthesize-change-bundle-with-blast-radius-and-sequencing-plan (Generative)
 *        → draft-rollback-plan-and-monitoring-watchpoints (Generative)
 *        → release-manager-and-sre-lead-go-no-go-review (Human, approval rationale)
 *        → emit-change-window-runbook-freeze-overrides-and-audit-log (Code, fan-out).
 */
export const changeWindowCoordinator: ServiceInstance<
  ChangeWindowInput,
  ChangeWindowRunbookOutput
> = Service.define<ChangeWindowInput, ChangeWindowRunbookOutput>({
  name: 'Change Window Coordinator',
  promise:
    'Every release / change-window lands as a release-manager-approved runbook — change-bundle with blast-radius + sequencing plan + rollback plan + monitoring watchpoints — so blast-radius, rollback, and watchpoint discipline is decided at ship-time, not regretted post-incident.',
  audience: 'business',
  archetype: 'quality-review',
  schema: { input: ChangeWindowInputSchema, output: ChangeWindowRunbookOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-pending-changes-dependent-services-and-recent-incident-overlap',
        reward: kr_pendingChangesCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-change-bundle-with-blast-radius-and-sequencing-plan',
        reward: kr_blastRadiusQuality,
      }),
      Generative({
        name: 'draft-rollback-plan-and-monitoring-watchpoints',
        reward: kr_rollbackSoundness,
      }),
      Human({
        name: 'release-manager-and-sre-lead-go-no-go-review',
        // `approval` rationale: the release-manager owns ship authority;
        // the SRE-lead owns freeze-override authority during high-risk
        // windows. The gate stays human regardless of model accuracy.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-change-window-runbook-freeze-overrides-and-audit-log',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'github.pulls',
      'github.deploys',
      'gitlab.pipelines',
      'spinnaker.pipelines',
      'argocd.applications',
      'servicenow.changes',
      'service-graph.read',
      'incident-history.read',
      'datadog.metrics',
      'newrelic.metrics',
      'docs.write',
      'audit-log.write',
    ],
    // Change-window cadence: clarification disabled — the cascade synthesises
    // from the change-set + service-graph + incident-history signals; the
    // joint release-manager + SRE-lead review is the single human contact
    // point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Company-wide-freeze windows escalate the rollback + watchpoint
        // synthesis to a senior release-engineering supervisor before the
        // joint go/no-go (the release-manager still signs, but a supervisor
        // backstops the rollback / watchpoint quality on the highest-stakes
        // tier).
        when: 'scopeTier == "company-wide-freeze"',
        action: 'escalate',
      },
      {
        // Every runbook routes through the joint release-manager + SRE-lead
        // go/no-go before audit-log emit; OutcomeContract enforces the
        // signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'release-manager-and-sre-lead-go-no-go-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:change-window-coordinator-review',
    personas: [
      // Blast-radius-coverage reviewer — pedantic check that every change
      // declares a blast radius, that every cross-team / company-wide change
      // names dependent service-refs, and that recent-incident overlaps are
      // explicitly cited rather than silently ignored. The risk this guards
      // against is "shipped without checking what else this touches".
      Personas.pedantic({
        domain: 'blast-radius-coverage',
        rubric: [
          'every-change-has-blast-radius-declared',
          'cross-team-or-broader-cites-dependent-services',
          'recent-incident-overlap-explicitly-cited',
          'no-silent-blast-radius-omissions',
        ],
        name: 'blast-radius-coverage-checker',
      }),
      // Rollback-soundness reviewer — pedantic check that every change has
      // a per-change rollback procedure, that data-loss-risk is honestly
      // flagged (no silent `irreversible` migrations slipping through as
      // `forward-only-replay`), and that the bundle-rollback ordering
      // unwinds the sequencing-plan in reverse.
      Personas.pedantic({
        domain: 'rollback-soundness',
        rubric: [
          'every-change-has-rollback-procedure',
          'data-loss-risk-honestly-flagged',
          'bundle-rollback-unwinds-sequencing-in-reverse',
          'no-orphaned-changes-without-rollback',
        ],
        name: 'rollback-soundness-checker',
      }),
      // Monitoring-watchpoint-density reviewer — pedantic check that every
      // change with `service-wide` or broader blast radius has at least one
      // watchpoint, that every watchpoint declares an autoActionOnTrip, and
      // that company-wide-freeze tier carries auto-rollback (not just
      // alert-only) watchpoints.
      Personas.pedantic({
        domain: 'monitoring-watchpoint-density',
        rubric: [
          'every-service-wide-change-has-watchpoint',
          'every-watchpoint-declares-auto-action',
          'company-wide-freeze-uses-auto-rollback-not-alert-only',
          'no-watchpoint-without-trip-condition',
        ],
        name: 'monitoring-watchpoint-density-checker',
      }),
      // Regression-risk reviewer — change-window is a `code` change-bundle;
      // require explicit blast-radius (already required in schema) and
      // explicit rollback plan. Adversarial probe of the joint product.
      Personas.regressionRisk({
        changeType: 'code',
        blastRadiusRequired: true,
        rollbackPlanRequired: true,
        name: 'change-bundle-regression-risk-reviewer',
      }),
      // Timeline-realism reviewer — sequencing plan declares phase durations
      // and gate conditions; require dependency-aware timeline realism so
      // unmodelled handoffs and invalid sequencing are flagged before the
      // window opens.
      Personas.timelineRealism({
        dependencyAware: true,
        name: 'sequencing-timeline-realism-reviewer',
      }),
      // SRE domain reviewer — pulls the senior-SRE expert for judgment on
      // the overall change-window-runbook quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/SiteReliabilityEngineers',
        name: 'sre-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:change-window-coordinator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-release-manager',
    seller: 'svc:change-window-coordinator',
    serviceRef: 'svc:change-window-coordinator',
    // Release-manager signs every change-window runbook before the window
    // opens — ship authority cannot be delegated.
    predicate: AND(
      SchemaMatch(ChangeWindowRunbookOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['release-manager'] })
    ),
    // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
    amount: { amount: 199900n, currency: 'USD' },
    // 3-day SLA — change-window runbooks ship within 72 hours of intake so
    // the joint review fits inside the planning window before the change
    // opens.
    timeoutDays: 3,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'team-window',
        amount: 49900n,
        currency: 'USD',
        description: 'Single-team change window — blast radius contained to one team. $499.',
      },
      {
        id: 'cross-team-window',
        amount: 199900n,
        currency: 'USD',
        description:
          'Cross-team change window — blast radius spans multiple teams or services. $1,999.',
      },
      {
        id: 'company-wide-freeze',
        amount: 999900n,
        currency: 'USD',
        description:
          'Company-wide freeze window — blast radius spans the company-wide release surface. $9,999.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 9000n, perApiCall: 16n },
  reward: kr_changeIncidentRate,

  lineage: {
    cellRef: 'business.org.ai/cells/sre-managers/change-window-coordinator',
    icpContextProblemRef: 'icp:change-window-coordinator:v1',
    foundingHypothesisRef: 'fh:change-window-coordinator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
