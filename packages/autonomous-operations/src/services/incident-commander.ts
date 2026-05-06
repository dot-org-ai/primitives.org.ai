/**
 * Incident Commander Service — SEV1 / SEV2 incident-coordination Service for
 * the operations catalog.
 *
 * Distinguishing shape vs. siblings (`oncall-handoff-narrator`,
 * `capacity-planner`):
 *   - `multi-step-research` archetype — the artefact is an IC-approved
 *     mitigation plan + status-update fan-out coordinated across Slack /
 *     PagerDuty / statuspage end-to-end during the incident, not a weekly
 *     handoff narrative or a quarterly capacity plan;
 *   - 5-step cascade with one supervised Agentic status-update-coordination
 *     step (the only Agentic step in the operations catalog), bookended by
 *     Code fan-in (current status + last incidents + service graph),
 *     Generative synthesis of the initial runbook + mitigation plan, an IC
 *     Human approval gate, and Code fan-out (incident timeline + status
 *     update);
 *   - `Pricing.outcome` 3 tiers keyed on declared severity — SEV3 / SEV2 /
 *     SEV1 ($199 / $999 / $2,999) — the incident is worth more on SEV1 than
 *     on SEV3;
 *   - declarative HITL = mandatory IC approval Human Function (the IC owns
 *     mitigation-action authority — restart prod, drain a region, fail-over
 *     a database — none of which can be delegated), plus OutcomeContract
 *     requires IC signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(runbook-actionability +
 *     status-clarity) + HumanSign(IC))`.
 *
 * Per design v3 §3 (Catalog HOW operations) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `time-to-mitigation-improvement` — the compound
 * metric every SRE / on-call org optimises against (the IC Service is worth
 * running iff time-to-mitigation on incidents at parity severity beats the
 * pre-Service baseline).
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
 * Input — a SEV1 / SEV2 alert firing + on-call paged. Tight: 7 fields cover
 * the incident identity, the firing alert, the declared severity (so the
 * outcome-tier pricing is resolvable at intake), the affected services /
 * regions for the cascade fan-in, the on-call IC routing target, and the
 * cross-channel status surfaces the Agentic coordinator updates.
 */
export const IncidentTriggerInputSchema = z.object({
  incidentId: z.string(),
  firingAlert: z.object({
    alertName: z.string(),
    monitoringSource: z.enum(['datadog', 'newrelic', 'pagerduty', 'cloudwatch', 'grafana']),
    firedAt: z.string(), // ISO-8601
    detail: z.string(),
  }),
  declaredSeverity: z.enum(['SEV1', 'SEV2', 'SEV3']),
  affectedServices: z.array(z.string()).min(1),
  affectedRegions: z.array(z.string()).default([]),
  assignedIncidentCommanderRef: z.string(),
  statusSurfaces: z.object({
    slackChannel: z.string(),
    pagerDutyIncidentId: z.string(),
    statuspageComponentRefs: z.array(z.string()).default([]),
  }),
})

/**
 * Output — an IC-approved mitigation plan + cross-channel status-update
 * fan-out: the synthesized runbook, the mitigation plan with action items,
 * the IC review audit, the coordinated status-update timeline, and pointers
 * to the emitted incident-timeline artefact.
 */
export const IncidentMitigationOutputSchema = z.object({
  incidentId: z.string(),
  contextSnapshot: z.object({
    serviceGraphSliceRef: z.string(),
    lastSimilarIncidents: z.array(
      z.object({
        incidentRef: z.string(),
        rootCauseSummary: z.string(),
        mitigationApplied: z.string(),
      })
    ),
    currentDeployHeads: z.array(
      z.object({
        serviceRef: z.string(),
        deployRef: z.string(),
        deployedAt: z.string(),
      })
    ),
  }),
  runbook: z.object({
    hypothesis: z.string(),
    nextProbes: z.array(z.string()).min(1),
    rollbackOptions: z.array(z.string()),
  }),
  mitigationPlan: z.object({
    summary: z.string(),
    actions: z
      .array(
        z.object({
          actionId: z.string(),
          description: z.string(),
          blastRadius: z.enum(['contained', 'service-wide', 'region-wide', 'global']),
          requiresHumanApproval: z.boolean(),
          owner: z.string(),
        })
      )
      .min(1),
  }),
  icApproval: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-subset', 'request-edit', 'reject']),
    approvedActionIds: z.array(z.string()),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  statusUpdates: z.array(
    z.object({
      surface: z.enum(['slack', 'pagerduty', 'statuspage']),
      postedAt: z.string(),
      summary: z.string(),
      ref: z.string(),
    })
  ),
  incidentTimeline: z.object({
    timelineUrl: z.string(),
    timelineEntryCount: z.number().int().nonnegative(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type IncidentTriggerInput = z.infer<typeof IncidentTriggerInputSchema>
export type IncidentMitigationOutput = z.infer<typeof IncidentMitigationOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_timeToMitigation: RewardSignal = {
  keyResultRef: 'kr:incident-commander:time-to-mitigation-improvement',
}
const kr_contextCoverage: RewardSignal = {
  keyResultRef: 'kr:incident-commander:context-coverage',
}
const kr_runbookActionability: RewardSignal = {
  keyResultRef: 'kr:incident-commander:runbook-actionability',
}
const kr_coordinationLatency: RewardSignal = {
  keyResultRef: 'kr:incident-commander:coordination-latency',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:incident-commander:emit-latency',
}

// ============================================================================
// Incident Commander Service
// ============================================================================

/**
 * Incident Commander — SEV1 / SEV2 alert + on-call paged → IC-approved
 * mitigation plan + cross-channel status-update fan-out as a Service.
 *
 * Cascade: fetch-current-status-last-incidents-and-service-graph (Code, fan-in)
 *        → synthesize-initial-runbook-and-mitigation-plan (Generative)
 *        → coordinate-status-updates-across-slack-pagerduty-statuspage (Agentic, supervised)
 *        → ic-approves-mitigation-actions (Human, regulatory rationale)
 *        → emit-incident-timeline-and-post-status-update (Code, fan-out).
 */
export const incidentCommander: ServiceInstance<IncidentTriggerInput, IncidentMitigationOutput> =
  Service.define<IncidentTriggerInput, IncidentMitigationOutput>({
    name: 'Incident Commander',
    promise:
      'Every SEV1 / SEV2 alert gets an IC-approved mitigation plan + cross-channel status updates coordinated end-to-end — runbook + mitigation actions + status-page + Slack + PagerDuty in lock-step — so the team mitigates faster and stakeholders never go dark.',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: IncidentTriggerInputSchema, output: IncidentMitigationOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-current-status-last-incidents-and-service-graph',
          reward: kr_contextCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-initial-runbook-and-mitigation-plan',
          reward: kr_runbookActionability,
        }),
        Agentic({
          name: 'coordinate-status-updates-across-slack-pagerduty-statuspage',
          reward: kr_coordinationLatency,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Human({
          name: 'ic-approves-mitigation-actions',
          // `regulatory` rationale: mitigation actions (restart prod, drain
          // region, fail-over a database) carry production blast-radius and
          // require IC sign-off. The gate stays human regardless of model
          // accuracy.
          rationale: 'regulatory',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-incident-timeline-and-post-status-update',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'datadog.metrics',
        'datadog.logs',
        'pagerduty.incidents',
        'pagerduty.oncall',
        'statuspage.components',
        'slack.channels',
        'slack.messages',
        'service-graph.read',
        'incident-history.read',
        'deploy-history.read',
      ],
      // Incident response: clarification disabled — the cascade synthesises
      // from the firing alert + service graph + recent deploys; the IC
      // approval step is the single human contact point during the incident.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // SEV1 incidents escalate the runbook synthesis to a senior SRE
          // supervisor before the IC review (the IC still signs, but a
          // supervisor backstops the synthesis quality on the highest-stakes
          // tier).
          when: 'declaredSeverity == "SEV1"',
          action: 'escalate',
        },
        {
          // Every incident routes through IC approval before mitigation
          // actions deploy; OutcomeContract enforces the signature, the
          // trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'ic-approves-mitigation-actions',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:incident-commander-review',
      personas: [
        // Runbook-actionability reviewer — adversarially probes whether the
        // synthesized runbook is concretely actionable (next probes name
        // commands / dashboards) vs. surface-level "investigate further"
        // hand-waving.
        Personas.skeptic({
          domain: 'runbook-actionability',
          focus: ['concrete-next-probes', 'cites-specific-dashboards', 'no-hand-waves'],
          name: 'runbook-actionability-reviewer',
        }),
        // Status-clarity reviewer — pedantic check that every status update
        // posted to Slack / PagerDuty / statuspage is plain-language, names
        // affected services, names current state, names ETA-to-next-update.
        Personas.pedantic({
          domain: 'status-clarity',
          rubric: [
            'plain-language-no-jargon',
            'names-affected-services',
            'names-current-state',
            'names-eta-to-next-update',
            'no-internal-only-language-on-statuspage',
          ],
          name: 'status-clarity-checker',
        }),
        // Blast-radius reviewer — pedantic check that every mitigation
        // action has its blast radius declared and that any service-wide /
        // region-wide / global action carries `requiresHumanApproval = true`.
        Personas.pedantic({
          domain: 'blast-radius-soundness',
          rubric: [
            'every-action-has-blast-radius-declared',
            'service-wide-or-broader-requires-human-approval',
            'no-global-action-without-IC-sign',
            'rollback-options-cover-each-action',
          ],
          name: 'blast-radius-reviewer',
        }),
        // SRE domain reviewer — pulls the senior-SRE expert for judgment
        // on the overall mitigation-plan quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/SiteReliabilityEngineers',
          name: 'sre-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:incident-commander:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-sre-lead',
      seller: 'svc:incident-commander',
      serviceRef: 'svc:incident-commander',
      // IC signs every mitigation plan before actions deploy — production
      // blast-radius authority cannot be delegated.
      predicate: AND(
        SchemaMatch(IncidentMitigationOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['incident-commander'] })
      ),
      // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
      amount: { amount: 99900n, currency: 'USD' },
      // Sub-day SLA — incidents need a mitigation plan posted within hours,
      // not days. Day-level granularity is a floor.
      timeoutDays: 1,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        {
          id: 'SEV3',
          amount: 19900n,
          currency: 'USD',
          description: 'SEV3 incident — single-service degradation. $199.',
        },
        {
          id: 'SEV2',
          amount: 99900n,
          currency: 'USD',
          description: 'SEV2 incident — multi-service or partial outage. $999.',
        },
        {
          id: 'SEV1',
          amount: 299900n,
          currency: 'USD',
          description: 'SEV1 incident — full outage or business-critical impact. $2,999.',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 6000n, perApiCall: 18n },
    reward: kr_timeToMitigation,

    lineage: {
      cellRef: 'business.org.ai/cells/sre-managers/incident-commander',
      icpContextProblemRef: 'icp:incident-commander:v1',
      foundingHypothesisRef: 'fh:incident-commander:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
