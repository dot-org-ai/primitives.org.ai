/**
 * Event Attendee Engagement Monitor Service — real-time event-engagement
 * tracking + interventions Service for the events catalog.
 *
 * Distinguishing shape vs. siblings (`event-program-curator`,
 * `partnership-deal-orchestrator`):
 *   - `forecast-narrative` archetype — the artefact is an event-producer-
 *     signed engagement-monitoring dashboard with real-time intervention
 *     log (engagement anomalies + low-rated session flags + VIP-touchpoint
 *     gaps + drafted interventions: session pivots + speaker prompts + VIP
 *     outreach), not a program-curation document or a partnership deal pack;
 *   - 5-step cascade: Code fan-in (attendee-engagement-stream + session-
 *     attendance + Q&A-volume + drop-off-signals) → Generative
 *     (detect-engagement-anomalies + flag-low-rated-sessions + identify-VIP-
 *     touchpoint-gaps) → Generative (draft-real-time-interventions: session-
 *     pivots + speaker-prompts + VIP-outreach) → Human (event-producer
 *     review-and-deploy on priority issues) → Code (emit-engagement-
 *     dashboard + intervention-log);
 *   - `Pricing.subscription` $799/mo events-team subscription with metered
 *     overage at $999 per live-event-day-monitored — the monitor is
 *     continuously running on a baseline plan with metered burst on event
 *     days;
 *   - declarative HITL = mandatory event-producer review-and-deploy Human
 *     Function on priority issues (the event-producer owns the decision
 *     to push interventions live during a running event), plus
 *     OutcomeContract requires event-producer signature with `approval`
 *     rationale (live-event intervention authority cannot be delegated);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(anomaly-precision +
 *     intervention-effectiveness + VIP-coverage) + HumanSign(event-
 *     producer))`.
 *
 * Per design v3 §3 (Catalog HOW events) + §6 (binding triggers, conditional
 * HumanSign) + §7 (subscription + metered pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `post-event-NPS-and-session-attendance-recovery` —
 * the compound metric every events-team org optimises against (the monitor
 * is worth running iff post-event NPS AND mid-event session-attendance
 * recovery on flagged sessions both beat the pre-Service baseline).
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
 * Input — a live-event monitoring tick (cascade fires on a streaming
 * cadence during an in-progress event). Tight: 8 fields cover the event
 * identity, the monitoring window, the event-producer routing target, the
 * VIP roster, the session schedule, the engagement-stream telemetry source
 * pointer, the prior-session baselines for anomaly detection, and the
 * intervention-channel options.
 */
export const EngagementMonitorInputSchema = z.object({
  eventId: z.string(),
  monitoringWindow: z.object({
    fromTs: z.string(), // ISO-8601
    toTs: z.string(), // ISO-8601
  }),
  eventProducerRef: z.string(),
  vipRoster: z
    .array(
      z.object({
        attendeeRef: z.string(),
        name: z.string(),
        tier: z.enum(['speaker', 'sponsor', 'vip-attendee', 'press']),
        targetTouchpointCount: z.number().int().nonnegative(),
      })
    )
    .default([]),
  sessionSchedule: z
    .array(
      z.object({
        sessionId: z.string(),
        title: z.string(),
        startTs: z.string(),
        endTs: z.string(),
        speakerRefs: z.array(z.string()).min(1),
      })
    )
    .min(1),
  engagementStreamRef: z.string(),
  priorSessionBaselineRef: z.string().optional(),
  interventionChannels: z
    .array(
      z.enum(['speaker-prompt', 'session-pivot', 'vip-outreach', 'attendee-broadcast', 'app-push'])
    )
    .min(1),
})

/**
 * Output — an event-producer-signed engagement monitoring snapshot:
 * detected engagement anomalies, flagged low-rated sessions, identified
 * VIP-touchpoint gaps, the drafted real-time interventions per channel,
 * the event-producer review + deploy audit, and pointers to the emitted
 * engagement-dashboard + intervention-log artefacts.
 */
export const EngagementMonitorOutputSchema = z.object({
  eventId: z.string(),
  monitoringWindow: z.object({
    fromTs: z.string(),
    toTs: z.string(),
  }),
  detectedAnomalies: z
    .array(
      z.object({
        anomalyId: z.string(),
        anomalyType: z.enum([
          'attendance-drop-off',
          'qa-volume-spike',
          'qa-volume-collapse',
          'session-rating-dip',
          'engagement-stream-flat',
          'sentiment-decline',
        ]),
        severity: z.enum(['low', 'medium', 'high']),
        sessionRef: z.string().optional(),
        observation: z.string(),
        signalRefs: z.array(z.string()).min(1),
      })
    )
    .default([]),
  lowRatedSessionFlags: z
    .array(
      z.object({
        sessionId: z.string(),
        currentRating: z.number().min(0).max(5),
        baselineRating: z.number().min(0).max(5).optional(),
        ratingDeltaRationale: z.string(),
      })
    )
    .default([]),
  vipTouchpointGaps: z
    .array(
      z.object({
        attendeeRef: z.string(),
        targetCount: z.number().int().nonnegative(),
        observedCount: z.number().int().nonnegative(),
        gapRationale: z.string(),
      })
    )
    .default([]),
  draftedInterventions: z
    .array(
      z.object({
        interventionId: z.string(),
        channel: z.enum([
          'speaker-prompt',
          'session-pivot',
          'vip-outreach',
          'attendee-broadcast',
          'app-push',
        ]),
        priority: z.enum(['low', 'medium', 'high']),
        targetRef: z.string(),
        draft: z.string(),
        expectedImpact: z.string(),
      })
    )
    .default([]),
  eventProducerReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['deploy-all', 'deploy-priority-only', 'edit-and-deploy', 'park', 'reject']),
    deployedInterventionIds: z.array(z.string()).default([]),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    dashboardUrl: z.string(),
    interventionLogRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type EngagementMonitorInput = z.infer<typeof EngagementMonitorInputSchema>
export type EngagementMonitorOutput = z.infer<typeof EngagementMonitorOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_postEventNpsAndAttendanceRecovery: RewardSignal = {
  keyResultRef:
    'kr:event-attendee-engagement-monitor:post-event-NPS-and-session-attendance-recovery',
}
const kr_telemetryFanInCoverage: RewardSignal = {
  keyResultRef: 'kr:event-attendee-engagement-monitor:telemetry-fan-in-coverage',
}
const kr_anomalyDetectionPrecision: RewardSignal = {
  keyResultRef: 'kr:event-attendee-engagement-monitor:anomaly-detection-precision',
}
const kr_interventionEffectiveness: RewardSignal = {
  keyResultRef: 'kr:event-attendee-engagement-monitor:intervention-effectiveness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:event-attendee-engagement-monitor:emit-latency',
}

// ============================================================================
// Event Attendee Engagement Monitor Service
// ============================================================================

/**
 * Event Attendee Engagement Monitor — event in-progress + telemetry-stream
 * → event-producer-signed engagement-monitoring snapshot with drafted
 * real-time interventions (session pivots + speaker prompts + VIP outreach)
 * deployed on priority issues as a Service.
 *
 * Cascade: fetch-attendee-engagement-stream-session-attendance-Q&A-volume-and-drop-off-signals (Code, fan-in)
 *        → detect-engagement-anomalies-flag-low-rated-sessions-and-identify-VIP-touchpoint-gaps (Generative)
 *        → draft-real-time-interventions-session-pivots-speaker-prompts-and-VIP-outreach (Generative)
 *        → event-producer-review-and-deploy-on-priority-issues (Human, approval rationale)
 *        → emit-engagement-dashboard-and-intervention-log (Code, fan-out).
 */
export const eventAttendeeEngagementMonitor: ServiceInstance<
  EngagementMonitorInput,
  EngagementMonitorOutput
> = Service.define<EngagementMonitorInput, EngagementMonitorOutput>({
  name: 'Event Attendee Engagement Monitor',
  promise:
    'Every in-progress event gets continuously monitored against attendee-engagement-stream + session-attendance + Q&A-volume + drop-off signals, with an event-producer-signed dashboard surfacing engagement anomalies + low-rated sessions + VIP-touchpoint gaps and drafted real-time interventions (session pivots + speaker prompts + VIP outreach) deployed on priority issues — so post-event NPS and mid-event session-attendance recovery both climb vs. the pre-Service baseline.',
  audience: 'business',
  archetype: 'forecast-narrative',
  schema: { input: EngagementMonitorInputSchema, output: EngagementMonitorOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-attendee-engagement-stream-session-attendance-Q-and-A-volume-and-drop-off-signals',
        reward: kr_telemetryFanInCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'detect-engagement-anomalies-flag-low-rated-sessions-and-identify-VIP-touchpoint-gaps',
        reward: kr_anomalyDetectionPrecision,
      }),
      Generative({
        name: 'draft-real-time-interventions-session-pivots-speaker-prompts-and-VIP-outreach',
        reward: kr_interventionEffectiveness,
      }),
      Human({
        name: 'event-producer-review-and-deploy-on-priority-issues',
        // `approval` rationale: event-producer owns live-event intervention
        // authority — pushing a session pivot or VIP outreach live during a
        // running event cannot be delegated to the cascade. The gate stays
        // human regardless of model accuracy.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-engagement-dashboard-and-intervention-log',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'event-platform.engagement-stream',
      'event-platform.session-attendance',
      'event-platform.qa-stream',
      'event-platform.session-ratings',
      'event-platform.attendee-presence',
      'crm.read',
      'comms-platform.draft',
      'app-push.draft',
      'docs.write',
      'dashboard.write',
    ],
    // Live monitoring tick: clarification disabled — the cascade fires on
    // a streaming cadence; the event-producer review-and-deploy step is
    // the single human contact point during the event.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // High-severity anomalies (sentiment-decline + attendance-drop-off
        // co-occurring; or three+ low-rated session flags within a single
        // window) escalate the intervention-drafting step to a senior
        // event-strategist supervisor before the event-producer review
        // (the producer still signs, but a senior backstops synthesis
        // quality on the highest-stakes ticks).
        when: 'detectedAnomaliesSeverityCount("high") >= 1',
        action: 'escalate',
      },
      {
        // Every monitoring tick routes through event-producer review
        // before the dashboard + intervention-log emit; OutcomeContract
        // enforces the signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'event-producer-review-and-deploy-on-priority-issues',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:event-attendee-engagement-monitor-review',
    personas: [
      // Anomaly-precision reviewer — pedantic check that every detected
      // anomaly cites at least one signal-ref (no "vibes-based" anomaly
      // claims), severity-grading is justified by the cited signals, and
      // the anomaly-type matches the cited signal pattern.
      Personas.pedantic({
        domain: 'anomaly-detection-precision',
        rubric: [
          'every-anomaly-cites-at-least-one-signal-ref',
          'severity-grading-justified-by-cited-signals',
          'anomaly-type-matches-cited-signal-pattern',
          'no-anomaly-claim-without-evidence',
          'baseline-comparison-explicit-when-available',
        ],
        name: 'anomaly-precision-checker',
      }),
      // Intervention-effectiveness reviewer — adversarially probes whether
      // each drafted intervention is concretely actionable (cites target
      // session / speaker / attendee, has a non-trivial expected-impact
      // note, and the channel matches the addressed anomaly's surface).
      Personas.skeptic({
        domain: 'intervention-effectiveness',
        focus: [
          'every-intervention-cites-concrete-target-ref',
          'every-intervention-has-non-trivial-expected-impact-note',
          'channel-matches-addressed-anomaly-surface',
          'priority-grading-tracks-anomaly-severity',
          'no-intervention-undefined-on-success-criteria',
        ],
        name: 'intervention-effectiveness-reviewer',
      }),
      // VIP-coverage reviewer — pedantic check that VIP-touchpoint gaps
      // are computed against the input vipRoster targetCount (not made-up
      // targets), gap-rationale traces to observed touchpoint events, and
      // the drafted VIP-outreach interventions cover the highest-tier
      // gaps first (sponsor + press tier before vip-attendee).
      Personas.pedantic({
        domain: 'VIP-coverage',
        rubric: [
          'gaps-computed-against-input-roster-targets',
          'gap-rationale-traces-to-observed-touchpoint-events',
          'sponsor-and-press-gaps-prioritised-before-vip-attendee-gaps',
          'speaker-tier-gaps-routed-to-speaker-prompt-channel',
          'no-VIP-gap-without-target-count',
        ],
        name: 'VIP-coverage-checker',
      }),
      // Empathy reviewer — `audienceType: 'public', sentimentTarget:
      // 'celebratory'` calibrates the persona to score interventions
      // (especially attendee-broadcast + app-push drafts) for the
      // celebratory-event register: warm, energising, never condescending,
      // never overly-formal. Live events are a celebratory surface;
      // interventions must read as "hosts" not "operators".
      Personas.empathy({
        audienceType: 'public',
        sentimentTarget: 'celebratory',
        name: 'empathy-reviewer',
      }),
      // Brand-safety reviewer — `low` risk-tolerance check on every
      // drafted intervention. Live-event broadcasts and VIP outreach
      // carry the highest reputational-risk surface during an in-progress
      // event; the monitor catches off-brand drafts before the event-
      // producer deploys them.
      Personas.brandSafety({
        riskTolerance: 'low',
        name: 'brand-safety-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:event-attendee-engagement-monitor:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-event-producer',
    seller: 'svc:event-attendee-engagement-monitor',
    serviceRef: 'svc:event-attendee-engagement-monitor',
    // Event-producer signs every monitoring tick before the dashboard +
    // intervention-log emit and any drafted intervention deploys live —
    // live-event intervention authority cannot be delegated.
    predicate: AND(
      SchemaMatch(EngagementMonitorOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['event-producer'] })
    ),
    // Subscription amount per cycle — the per-month plan amount is in
    // `pricing.plan`. Reflected here for predicate-level quote display.
    amount: { amount: 79900n, currency: 'USD' },
    // Same-day SLA — live monitoring needs a snapshot turning around in
    // hours, not days; an in-progress event cannot wait for the next
    // business day.
    timeoutDays: 1,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: {
      id: 'event-attendee-engagement-monitor-monthly',
      amount: 79900n,
      currency: 'USD',
      interval: 'month',
    },
    // Metered overage — every live-event-day monitored beyond the
    // bundled monthly baseline lines $999 on the monthly invoice. The
    // metering runtime resolves `live-event-day-monitored` to event-day
    // span counts.
    metered: [
      {
        event: 'live-event-day-monitored',
        amount: 99900n,
        description:
          'Live-event-day monitored beyond the bundled monthly baseline (the monitor runs continuously during in-progress event days; metered overage on event-day spans).',
      },
    ],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 3500n, perApiCall: 9n },
  reward: kr_postEventNpsAndAttendanceRecovery,

  lineage: {
    cellRef: 'business.org.ai/cells/event-leads/event-attendee-engagement-monitor',
    icpContextProblemRef: 'icp:event-attendee-engagement-monitor:v1',
    foundingHypothesisRef: 'fh:event-attendee-engagement-monitor:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
