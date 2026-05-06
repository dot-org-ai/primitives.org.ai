/**
 * On-Call Handoff Narrator Service — weekly on-call handoff document Service
 * for the operations catalog.
 *
 * Distinguishing shape vs. siblings (`incident-commander`,
 * `capacity-planner`):
 *   - `forecast-narrative` archetype — the artefact is a weekly on-call
 *     handoff narrative + Slack thread covering known-knowns / known-unknowns,
 *     active mitigations, and pending investigations, not an in-incident
 *     mitigation plan or a quarterly capacity plan;
 *   - 4-step cascade: Code fan-in (week incidents + open issues + recent
 *     deploys + monitoring anomalies) → Generative (handoff narrative) →
 *     Generative (active mitigations + pending investigations) → Code (emit
 *     handoff doc + Slack thread); no Human Function in the cascade — the
 *     handoff doc lands in the team channel and the on-call team owns the
 *     read;
 *   - `Pricing.subscription` — the handoff is a recurring weekly cadence
 *     Service consumed by an entire on-call team ($199/mo per on-call team);
 *   - no HumanSign in the OutcomeContract — the handoff is informational
 *     and the quality floor is enforced by the evaluator panel; the on-call
 *     team owns the read;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(coverage-completeness +
 *     signal-clarity))`.
 *
 * Per design v3 §3 (Catalog HOW operations) + §6 (binding triggers) + §7
 * (subscription pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `handoff-prep-time-reduction` — the compound metric
 * every on-call team optimises against (the handoff narrator is worth running
 * iff the outgoing rotation spends minutes, not the traditional hour-plus,
 * preparing the handoff doc, while the incoming rotation gets the full
 * picture instead of cherry-picked highlights).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a weekly cron firing at on-call rotation handoff. Tight: 6 fields
 * cover team identity, the handoff window, the outgoing + incoming rotation
 * refs (so the cascade narrates from the outgoing rotation's POV and the
 * doc lands in the incoming rotation's inbox), the connected source
 * systems, and the Slack channel for the handoff thread.
 */
export const HandoffTriggerInputSchema = z.object({
  oncallTeamRef: z.string(),
  handoffWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  outgoingRotationRef: z.string(),
  incomingRotationRef: z.string(),
  sources: z.object({
    incidentSystem: z.enum(['pagerduty', 'opsgenie', 'incident-io', 'firehydrant']),
    issueTracker: z.enum(['jira', 'linear', 'github', 'gitlab']),
    deployTracker: z.enum(['github', 'gitlab', 'spinnaker', 'argocd']),
    monitoringSource: z.enum(['datadog', 'newrelic', 'grafana', 'prometheus']),
  }),
  slackChannel: z.string(),
})

/**
 * Output — a weekly on-call handoff narrative + Slack thread: the
 * week-incident roster, the handoff narrative with known-knowns and
 * known-unknowns, the active-mitigations list, the pending-investigations
 * list, and pointers to the emitted handoff-doc + Slack-thread artefacts.
 */
export const HandoffNarrativeOutputSchema = z.object({
  oncallTeamRef: z.string(),
  handoffWindow: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  weekIncidents: z.array(
    z.object({
      incidentRef: z.string(),
      severity: z.enum(['SEV1', 'SEV2', 'SEV3']),
      mitigatedAt: z.string().optional(),
      summary: z.string(),
    })
  ),
  narrative: z.object({
    summaryMarkdown: z.string(),
    knownKnowns: z.array(z.string()),
    knownUnknowns: z.array(z.string()),
    monitoringAnomalies: z.array(
      z.object({
        anomalyDescription: z.string(),
        firstObservedAt: z.string(),
        relatedServices: z.array(z.string()),
      })
    ),
    recentDeployHotspots: z.array(
      z.object({
        serviceRef: z.string(),
        deployRef: z.string(),
        deployedAt: z.string(),
        riskNote: z.string(),
      })
    ),
  }),
  activeMitigations: z.array(
    z.object({
      mitigationId: z.string(),
      description: z.string(),
      ownerRef: z.string(),
      targetResolutionAt: z.string().optional(),
    })
  ),
  pendingInvestigations: z.array(
    z.object({
      investigationId: z.string(),
      description: z.string(),
      ownerRef: z.string(),
      lastUpdateAt: z.string().optional(),
    })
  ),
  handoffArtefacts: z.object({
    handoffDocUrl: z.string(),
    slackThreadRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type HandoffTriggerInput = z.infer<typeof HandoffTriggerInputSchema>
export type HandoffNarrativeOutput = z.infer<typeof HandoffNarrativeOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_handoffPrepTime: RewardSignal = {
  keyResultRef: 'kr:oncall-handoff-narrator:handoff-prep-time-reduction',
}
const kr_signalCoverage: RewardSignal = {
  keyResultRef: 'kr:oncall-handoff-narrator:signal-coverage',
}
const kr_narrativeQuality: RewardSignal = {
  keyResultRef: 'kr:oncall-handoff-narrator:narrative-quality',
}
const kr_followupCoverage: RewardSignal = {
  keyResultRef: 'kr:oncall-handoff-narrator:followup-coverage',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:oncall-handoff-narrator:emit-latency',
}

// ============================================================================
// On-Call Handoff Narrator Service
// ============================================================================

/**
 * On-Call Handoff Narrator — weekly cron + on-call rotation handoff →
 * handoff narrative + Slack thread covering known-knowns / known-unknowns,
 * active mitigations, and pending investigations as a Service.
 *
 * Cascade: fetch-week-incidents-open-issues-deploys-and-anomalies (Code, fan-in)
 *        → synthesize-handoff-narrative-with-known-knowns-and-known-unknowns (Generative)
 *        → highlight-active-mitigations-and-pending-investigations (Generative)
 *        → emit-handoff-doc-and-slack-thread (Code, fan-out).
 */
export const oncallHandoffNarrator: ServiceInstance<HandoffTriggerInput, HandoffNarrativeOutput> =
  Service.define<HandoffTriggerInput, HandoffNarrativeOutput>({
    name: 'On-Call Handoff Narrator',
    promise:
      'Every on-call rotation handoff lands as a complete narrative — known-knowns + known-unknowns + active mitigations + pending investigations — so the outgoing rotation hands off in minutes and the incoming rotation has the whole picture, not cherry-picked highlights.',
    audience: 'business',
    archetype: 'forecast-narrative',
    schema: { input: HandoffTriggerInputSchema, output: HandoffNarrativeOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-week-incidents-open-issues-deploys-and-anomalies',
          reward: kr_signalCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-handoff-narrative-with-known-knowns-and-known-unknowns',
          reward: kr_narrativeQuality,
        }),
        Generative({
          name: 'highlight-active-mitigations-and-pending-investigations',
          reward: kr_followupCoverage,
        }),
        Code({
          name: 'emit-handoff-doc-and-slack-thread',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'pagerduty.incidents',
        'opsgenie.incidents',
        'jira.issues',
        'linear.issues',
        'github.deploys',
        'datadog.anomalies',
        'newrelic.anomalies',
        'slack.messages',
        'docs.write',
      ],
      // Weekly cadence: clarification disabled — the handoff synthesises from
      // the incident + issue + deploy + monitoring signals; the outgoing
      // rotation owns review-in-channel.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Weeks containing any SEV1 incident escalate the handoff narrative
          // synthesis to a senior on-call lead supervisor in addition to the
          // regular Slack thread (the rotation lead reviews the doc before
          // the incoming rotation reads it cold).
          when: 'weekIncidents.some(i => i.severity == "SEV1")',
          action: 'escalate',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:oncall-handoff-narrator-review',
      personas: [
        // Coverage-completeness reviewer — pedantic check that the handoff
        // doc covers every SEV1 / SEV2 incident in the window, every active
        // mitigation, every pending investigation, and every monitoring
        // anomaly first-observed in the window. The risk this guards against
        // is "cherry-picked highlights".
        Personas.pedantic({
          domain: 'coverage-completeness',
          rubric: [
            'every-sev1-or-sev2-incident-cited',
            'every-active-mitigation-listed',
            'every-pending-investigation-listed',
            'every-week-monitoring-anomaly-cited',
            'no-silent-omissions',
          ],
          name: 'coverage-completeness-checker',
        }),
        // Signal-clarity reviewer — adversarially probes whether the
        // narrative is concrete (names services, names dates, names owners)
        // vs. surface-level "things were stable this week" hand-waving.
        Personas.skeptic({
          domain: 'signal-clarity',
          focus: ['names-services-and-owners', 'cites-concrete-dates', 'no-hand-waves'],
          name: 'signal-clarity-reviewer',
        }),
        // SRE domain reviewer — pulls the senior-SRE expert for judgment on
        // the overall handoff-doc quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/SiteReliabilityEngineers',
          name: 'sre-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:oncall-handoff-narrator:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-oncall-lead',
      seller: 'svc:oncall-handoff-narrator',
      serviceRef: 'svc:oncall-handoff-narrator',
      // No HumanSign — the handoff is informational; the on-call team owns
      // the read. The quality floor is enforced by the evaluator panel.
      predicate: AND(
        SchemaMatch(HandoffNarrativeOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
      ),
      amount: { amount: 19900n, currency: 'USD' },
      // 1-day SLA — handoff cron fires at rotation boundary, doc needs to
      // land in channel before the incoming rotation's first hour on call.
      timeoutDays: 1,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'oncall-handoff-narrator-monthly',
        amount: 19900n,
        currency: 'USD',
        interval: 'month',
      },
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 800n, perApiCall: 5n },
    reward: kr_handoffPrepTime,

    lineage: {
      cellRef: 'business.org.ai/cells/sre-managers/oncall-handoff-narrator',
      icpContextProblemRef: 'icp:oncall-handoff-narrator:v1',
      foundingHypothesisRef: 'fh:oncall-handoff-narrator:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
