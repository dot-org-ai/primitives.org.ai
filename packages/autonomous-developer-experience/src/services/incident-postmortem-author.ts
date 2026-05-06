/**
 * Incident Postmortem Author Service — post-incident retrospective authoring
 * Service for the developer-experience catalog.
 *
 * Distinguishing shape vs. siblings (`api-docs-writer`, `changelog-generator`,
 * `sdk-generator`, `migration-guide-writer`, `tutorial-author`,
 * `example-suite-builder`, `release-readiness-checklist`):
 *   - `quality-review` archetype — the artefact is a published postmortem doc
 *     + a set of action-item issues with owners, not a doc / SDK / changelog
 *     / readiness gate;
 *   - 5-step cascade with one Code fan-in (incident timeline + slack channel
 *     export + monitoring graphs), two Generative narrative steps (RCA-
 *     candidate-narrative + action-items-with-owners), a load-bearing Human
 *     IC + engineering-leader review, and a Code fan-out (publish doc +
 *     create issues);
 *   - `outcome` pricing across S/M/L tiers keyed on incident severity (SEV3
 *     = $199, SEV2 = $799, SEV1+ = $2,499) — the postmortem is worth more
 *     when the customer-facing blast radius was larger;
 *   - declarative HITL = mandatory IC + eng-leader review Human Function
 *     plus the OutcomeContract requires the IC's signature (the IC owns the
 *     RCA narrative and the action-item set);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(rca-quality +
 *     action-actionability) + HumanSign(IC))`.
 *
 * Per design v3 §3 (Catalog HOW DX) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `time-to-postmortem-published-improvement` — the
 * compound metric every IC + eng-leader org optimises against (the
 * postmortem is worth running iff the time-to-published trends down vs. the
 * pre-Service baseline; the alternative is a 2-week scramble that loses the
 * audit trail).
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
 * Input — a resolved incident with a postmortem-due flag set. Tight: 6
 * fields cover incident identity, the resolved-at timestamp, the severity
 * (so the pricing tier is resolvable at intake), the IC + engineering-leader
 * references the Human review step routes to, and the source-of-record refs
 * the cascade fans-in to (incident system + slack channel + monitoring).
 */
export const IncidentResolvedInputSchema = z.object({
  incidentId: z.string(),
  resolvedAt: z.string(), // ISO-8601
  severity: z.enum(['sev3', 'sev2', 'sev1', 'sev0']),
  reviewers: z.object({
    icRef: z.string(),
    engineeringLeaderRef: z.string(),
  }),
  sources: z.object({
    incidentSystem: z.enum(['pagerduty', 'opsgenie', 'incident-io', 'firehydrant']),
    slackChannelRef: z.string(),
    monitoringSystem: z.enum(['datadog', 'grafana', 'newrelic', 'honeycomb']),
  }),
})

/**
 * Output — a published postmortem: the consolidated incident timeline, the
 * synthesized RCA narrative + RCA candidates, the drafted action items with
 * named owners, the IC + engineering-leader review audit, and pointers to
 * the published postmortem doc + created action-item issues.
 */
export const PostmortemOutputSchema = z.object({
  incidentId: z.string(),
  severity: z.enum(['sev3', 'sev2', 'sev1', 'sev0']),
  timeline: z.array(
    z.object({
      at: z.string(),
      kind: z.enum(['detection', 'page', 'investigation', 'mitigation', 'resolution']),
      summary: z.string(),
      sourceRef: z.string().optional(),
    })
  ),
  monitoringGraphs: z.array(
    z.object({
      url: z.string(),
      caption: z.string(),
    })
  ),
  rca: z.object({
    narrativeMarkdown: z.string(),
    candidates: z.array(
      z.object({
        candidateText: z.string(),
        confidence: z.number().min(0).max(1),
        evidenceRefs: z.array(z.string()).min(1),
      })
    ),
    primaryRootCause: z.string(),
  }),
  actionItems: z.array(
    z.object({
      title: z.string(),
      ownerRef: z.string(),
      kind: z.enum(['detect', 'mitigate', 'prevent', 'document']),
      dueAt: z.string(),
      issueUrl: z.string(),
    })
  ),
  review: z.object({
    icSignedAt: z.string(),
    engineeringLeaderReviewedAt: z.string(),
    decision: z.enum(['publish-as-drafted', 'edit-and-publish', 'block']),
  }),
  postmortemDocUrl: z.string(),
  publishedAt: z.string(),
})

export type IncidentResolvedInput = z.infer<typeof IncidentResolvedInputSchema>
export type PostmortemOutput = z.infer<typeof PostmortemOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_timeToPostmortem: RewardSignal = {
  keyResultRef: 'kr:incident-postmortem-author:time-to-postmortem-published-improvement',
}
const kr_signalCoverage: RewardSignal = {
  keyResultRef: 'kr:incident-postmortem-author:signal-coverage',
}
const kr_rcaQuality: RewardSignal = {
  keyResultRef: 'kr:incident-postmortem-author:rca-quality',
}
const kr_actionActionability: RewardSignal = {
  keyResultRef: 'kr:incident-postmortem-author:action-actionability',
}
const kr_publishLatency: RewardSignal = {
  keyResultRef: 'kr:incident-postmortem-author:publish-latency',
}

// ============================================================================
// Incident Postmortem Author Service
// ============================================================================

/**
 * Incident Postmortem Author — resolved incident → IC-signed postmortem doc
 * + action-item issues as a Service.
 *
 * Cascade: fetch-incident-timeline-slack-and-monitoring (Code, fan-in)
 *        → synthesize-narrative-with-rca-candidates (Generative)
 *        → draft-action-items-with-owners (Generative)
 *        → ic-and-engineering-leader-review (Human, load-bearing)
 *        → publish-postmortem-and-create-action-item-issues (Code, fan-out).
 */
export const incidentPostmortemAuthor: ServiceInstance<IncidentResolvedInput, PostmortemOutput> =
  Service.define<IncidentResolvedInput, PostmortemOutput>({
    name: 'Incident Postmortem Author',
    promise:
      'Every resolved incident gets an IC-signed postmortem and tracked action-item issues — RCA-narrative + monitoring-graphs + named owners — within days of resolution.',
    audience: 'business',
    archetype: 'quality-review',
    schema: { input: IncidentResolvedInputSchema, output: PostmortemOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-incident-timeline-slack-and-monitoring',
          reward: kr_signalCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-narrative-with-rca-candidates',
          reward: kr_rcaQuality,
        }),
        Generative({
          name: 'draft-action-items-with-owners',
          reward: kr_actionActionability,
        }),
        Human({
          name: 'ic-and-engineering-leader-review',
          rationale: 'approval',
          // Postmortem sign-off stays human — IC + engineering-leader names
          // are on the doc and own the action items. No promotion threshold
          // ever displaces this step.
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'publish-postmortem-and-create-action-item-issues',
          reward: kr_publishLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'pagerduty.incidents',
        'opsgenie.incidents',
        'incident-io.incidents',
        'slack.history',
        'datadog.graphs',
        'grafana.graphs',
        'newrelic.graphs',
        'github.issues',
        'confluence.pages',
        'notion.pages',
      ],
      // Postmortem-cycle cadence: clarification disabled — the cascade
      // synthesises from the incident-system + slack + monitoring signals;
      // the IC + engineering-leader review step at the end is the single
      // human contact point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // SEV1+ incidents always escalate the review step out-of-band to
          // the engineering-leader before publish, in addition to the
          // regular review step.
          when: '["sev1","sev0"].includes(severity)',
          action: 'escalate',
        },
        {
          // Every postmortem routes through IC + eng-leader review before
          // it publishes; OutcomeContract enforces the IC signature, the
          // trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'ic-and-engineering-leader-review',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:incident-postmortem-author-review',
      personas: [
        // RCA-quality reviewer — adversarially probes whether the RCA
        // candidates are grounded in the incident timeline and monitoring
        // signals (no "the system was overloaded" hand-waves), and whether
        // the primary root cause is defensible against a senior IC.
        Personas.skeptic({
          domain: 'rca-quality',
          focus: [
            'rca-grounded-in-timeline',
            'rca-grounded-in-monitoring',
            'no-hand-waves',
            'primary-cause-defensible',
          ],
          name: 'rca-quality-reviewer',
        }),
        // Action-actionability reviewer — pedantic check that every action
        // item has a named owner, a due-date, a kind classification, and a
        // tracked issue URL.
        Personas.pedantic({
          domain: 'action-actionability',
          rubric: [
            'every-action-has-owner',
            'every-action-has-due-date',
            'every-action-has-kind',
            'every-action-has-tracked-issue',
          ],
          name: 'action-actionability-checker',
        }),
        // IC domain reviewer — pulls the senior-IC expert for judgment on
        // the overall postmortem.
        Personas.domain({
          expertRef: 'occupations.org.ai/SoftwareDevelopers',
          name: 'ic-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:incident-postmortem-author:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-engineering-leader',
      seller: 'svc:incident-postmortem-author',
      serviceRef: 'svc:incident-postmortem-author',
      // IC signs every postmortem before it publishes — the IC owns the
      // narrative and the action items. The engineering-leader review is
      // the second pair of eyes captured in `review.engineeringLeaderReviewedAt`.
      predicate: AND(
        SchemaMatch(PostmortemOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['ic'] })
      ),
      // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`
      // — settlement runtime resolves which tier a given incident falls into
      // off `severity`.
      amount: { amount: 79900n, currency: 'USD' },
      // 5-day SLA — postmortems lose value the longer they take to publish
      // after resolution.
      timeoutDays: 5,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        {
          id: 'sev3',
          amount: 19900n,
          currency: 'USD',
          description: 'SEV3 — minor / single-team-impact incident, slim postmortem.',
        },
        {
          id: 'sev2',
          amount: 79900n,
          currency: 'USD',
          description: 'SEV2 — degraded-but-not-down service, full RCA postmortem.',
        },
        {
          id: 'sev1-plus',
          amount: 249900n,
          currency: 'USD',
          description: 'SEV1+ — customer-facing outage, multi-author RCA + exec brief.',
        },
      ],
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 800n, perApiCall: 5n },
    reward: kr_timeToPostmortem,

    lineage: {
      cellRef: 'business.org.ai/cells/software-developers/incident-postmortem-author',
      icpContextProblemRef: 'icp:incident-postmortem-author:v1',
      foundingHypothesisRef: 'fh:incident-postmortem-author:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
