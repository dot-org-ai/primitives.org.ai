/**
 * Peer Review Coordinator Service — academic peer-review queue management
 * for the research catalog.
 *
 * Distinguishing shape vs. siblings:
 *   - `multi-step-research` archetype — editor-approved invitation batch +
 *     assignment tracker + reminder cadence grounded in topic-expertise
 *     graph, reviewer-pool availability, and conflict-of-interest data;
 *   - 5-step cascade: Code (incoming manuscripts + reviewer-pool
 *     availability + topic-expertise graph + recent COI data) → Generative
 *     (match manuscripts to 3 recommended reviewers with COI checks +
 *     availability) → Generative (draft review-invitation with deadline +
 *     topic context) → Human (editor approves + sends invitations) → Code
 *     (emit invitation batch + assignment tracker + reminder cadence);
 *   - `Pricing.subscription` $999 / month per editorial board with metered
 *     overage at $49 / manuscript-routed beyond the included tier;
 *   - declarative HITL = editor approval Human Function (approval
 *     rationale; editor signs);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(editor))`.
 *
 * Service-level reward = `time-to-first-review-and-reviewer-acceptance-rate`.
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

const InvitationDecisionWindowDays = z.number().int().min(1).max(30)
const ReviewWindowDays = z.number().int().min(7).max(120)

/** Input — editor assigns reviewer slot OR weekly cron over the queue. */
export const PeerReviewCoordinatorInputSchema = z.object({
  journalRef: z.string(),
  editorialBoardRef: z.string(),
  trigger: z.enum(['editor-assigned-slot', 'weekly-cron']),
  incomingManuscripts: z
    .array(
      z.object({
        manuscriptRef: z.string(),
        title: z.string(),
        manuscriptKind: ManuscriptKind,
        topicKeywords: z.array(z.string()).min(1),
        correspondingAuthorRef: z.string(),
        coAuthorRefs: z.array(z.string()).default([]),
        submittedAt: z.string(),
      })
    )
    .min(1),
  reviewerPool: z.object({
    poolRef: z.string(),
    activeReviewerCount: z.number().int().nonnegative(),
    availabilitySnapshotRef: z.string(),
  }),
  invitationPolicy: z.object({
    invitationsPerManuscript: z.number().int().min(1).max(10),
    invitationDecisionWindowDays: InvitationDecisionWindowDays,
    reviewWindowDays: ReviewWindowDays,
    reminderCadenceDays: z.array(z.number().int().positive()).default([3, 7, 14]),
  }),
  conflictOfInterestPolicy: z.object({
    coAuthorshipLookbackYears: z.number().int().positive().default(5),
    institutionalAffiliationCheck: z.boolean().default(true),
    fundingOverlapCheck: z.boolean().default(true),
  }),
  assignedEditorRef: z.string(),
})

/** Output — editor-approved invitation batch + assignment tracker. */
export const PeerReviewCoordinatorOutputSchema = z.object({
  journalRef: z.string(),
  editorialBoardRef: z.string(),
  trigger: z.enum(['editor-assigned-slot', 'weekly-cron']),
  queueSnapshot: z.object({
    incomingCount: z.number().int().nonnegative(),
    activeReviewerCount: z.number().int().nonnegative(),
    snapshotAt: z.string(),
  }),
  reviewerMatches: z
    .array(
      z.object({
        manuscriptRef: z.string(),
        recommendedReviewers: z
          .array(
            z.object({
              reviewerRef: z.string(),
              topicMatchScore: z.number().min(0).max(1),
              topicEvidenceRefs: z.array(z.string()).min(1),
              availabilityWindowDays: z.number().int().nonnegative(),
              recentReviewLoadCount: z.number().int().nonnegative(),
              coiCheck: z.object({
                coAuthorshipFlag: z.boolean(),
                institutionalAffiliationFlag: z.boolean(),
                fundingOverlapFlag: z.boolean(),
                overallStatus: z.enum(['clear', 'flagged', 'blocked']),
                rationale: z.string().optional(),
              }),
            })
          )
          .min(1),
      })
    )
    .min(1),
  invitationDrafts: z
    .array(
      z.object({
        invitationId: z.string(),
        manuscriptRef: z.string(),
        reviewerRef: z.string(),
        subject: z.string(),
        bodyMarkdown: z.string(),
        decisionDeadline: z.string(),
        reviewDeadline: z.string(),
        topicContextSummary: z.string(),
      })
    )
    .min(1),
  editorApproval: z.object({
    editorRef: z.string(),
    decision: z.enum(['approve-batch', 'approve-with-edits', 'request-revision', 'reject-batch']),
    notes: z.string().optional(),
    approvedAt: z.string(),
  }),
  invitationBatch: z.object({
    batchRef: z.string(),
    sentCount: z.number().int().nonnegative(),
    sentAt: z.string(),
  }),
  assignmentTracker: z.object({
    trackerRef: z.string(),
    trackerUrl: z.string(),
    openInvitationCount: z.number().int().nonnegative(),
    openedAt: z.string(),
  }),
  reminderCadence: z.object({
    cadenceRef: z.string(),
    schedule: z
      .array(
        z.object({
          invitationId: z.string(),
          remindAtDayOffset: z.number().int().positive(),
          channel: z.enum(['email', 'editorial-portal', 'sms']),
        })
      )
      .default([]),
    scheduledAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type PeerReviewCoordinatorInput = z.infer<typeof PeerReviewCoordinatorInputSchema>
export type PeerReviewCoordinatorOutput = z.infer<typeof PeerReviewCoordinatorOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_timeToFirstReviewAndAcceptance: RewardSignal = {
  keyResultRef: 'kr:peer-review-coordinator:time-to-first-review-and-reviewer-acceptance-rate',
}
const kr_queueCoverage: RewardSignal = {
  keyResultRef: 'kr:peer-review-coordinator:queue-and-availability-coverage',
}
const kr_topicMatchAndCoi: RewardSignal = {
  keyResultRef: 'kr:peer-review-coordinator:topic-match-and-coi-coverage',
}
const kr_invitationCraft: RewardSignal = {
  keyResultRef: 'kr:peer-review-coordinator:invitation-craft-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:peer-review-coordinator:emit-latency',
}

// ============================================================================
// Peer Review Coordinator Service
// ============================================================================

/**
 * Peer Review Coordinator — incoming manuscripts + reviewer pool → editor-
 * approved invitation batch + assignment tracker + reminder cadence as a
 * Service.
 */
export const peerReviewCoordinator: ServiceInstance<
  PeerReviewCoordinatorInput,
  PeerReviewCoordinatorOutput
> = Service.define<PeerReviewCoordinatorInput, PeerReviewCoordinatorOutput>({
  name: 'Peer Review Coordinator',
  promise:
    'Every incoming manuscript on the editorial queue lands as an editor-approved invitation batch — three topic-matched reviewers with COI cleared and availability confirmed, an invitation drafted with deadline + topic context, and a reminder cadence scheduled — so time-to-first-review and reviewer-acceptance-rate trend up and the editor stays in approval mode rather than queue-management mode.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: PeerReviewCoordinatorInputSchema, output: PeerReviewCoordinatorOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-incoming-manuscripts-reviewer-pool-availability-topic-expertise-graph-and-recent-coi-data',
        reward: kr_queueCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'match-manuscripts-to-3-recommended-reviewers-with-coi-checks-and-availability',
        reward: kr_topicMatchAndCoi,
      }),
      Generative({
        name: 'draft-review-invitation-with-deadline-and-topic-context',
        reward: kr_invitationCraft,
      }),
      Human({
        name: 'editor-approves-and-sends-invitations',
        // `approval` rationale: editor approves the invitation batch but
        // routine matching is automated; the gate exists for editorial
        // judgement on borderline matches and final send authority.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 0.97, whenSamplesExceed: 5_000 },
      }),
      Code({
        name: 'emit-invitation-batch-assignment-tracker-and-reminder-cadence',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'editorial-system.read',
      'reviewer-pool.read',
      'topic-expertise-graph.read',
      'coi-registry.read',
      'pubmed.search',
      'orcid.read',
      'editorial-system.send-invitation',
      'tracker.create',
      'reminder-scheduler.create',
    ],
    // Cascade synthesises from manuscripts + pool + expertise-graph + COI
    // data; editor approval is the single human contact surface.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Reviews / systematic reviews / meta-analyses escalate to a
        // section-editor supervisor before editor approval.
        when: 'incomingManuscripts.exists(m, m.manuscriptKind == "review-article" || m.manuscriptKind == "systematic-review" || m.manuscriptKind == "meta-analysis")',
        action: 'escalate',
      },
      {
        // Every batch routes through editor approval before sending.
        when: 'true',
        action: 'route-to',
        target: 'editor-approves-and-sends-invitations',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:peer-review-coordinator-review',
    personas: [
      // Topic-match-precision reviewer — each recommended reviewer cites
      // at least one topic-evidence reference (publication, ORCID
      // expertise tag); reviewers reject blind matching that lands wrong
      // referees on a manuscript.
      Personas.factualAccuracy({
        minCitationsPerClaim: 1,
        name: 'topic-match-precision-and-evidence-grounding-reviewer',
      }),
      // Brand-safety reviewer — invitation copy is sent under the
      // journal's editorial brand; tone has to land between formal +
      // collegial; risk-tolerance is low because reputational damage
      // from a tone-deaf or accidental-COI invitation is hard to undo.
      Personas.brandSafety({
        riskTolerance: 'low',
        name: 'editorial-brand-safety-reviewer',
      }),
      // COI-coverage reviewer — every recommended reviewer has all three
      // COI checks (co-authorship, institutional affiliation, funding
      // overlap) with a concrete status; flagged status carries a
      // rationale; blocked reviewers never reach the invitation batch.
      Personas.pedantic({
        domain: 'coi-coverage',
        rubric: [
          'every-recommended-reviewer-has-all-three-coi-checks',
          'flagged-status-carries-a-concrete-rationale',
          'blocked-reviewers-never-reach-the-invitation-batch',
          'topic-match-score-tracks-cited-evidence',
          'availability-window-respects-review-deadline',
        ],
        name: 'coi-coverage-and-availability-realism-checker',
      }),
      // Reviewer-load realism reviewer — recent-review-load is
      // proportionate (no reviewer over-loaded); topic-match is non-
      // trivially scored; invitations are not duplicated to the same
      // reviewer in a window.
      Personas.skeptic({
        domain: 'reviewer-availability-realism',
        focus: [
          'no-reviewer-over-loaded-relative-to-pool-distribution',
          'no-duplicate-invitations-to-the-same-reviewer-in-a-cycle',
          'availability-window-greater-than-or-equal-to-review-deadline',
          'topic-match-score-not-rubber-stamped-at-1-0',
          'reminder-cadence-respects-decision-window',
        ],
        name: 'reviewer-availability-realism-checker',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:peer-review-coordinator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-editor-in-chief',
    seller: 'svc:peer-review-coordinator',
    serviceRef: 'svc:peer-review-coordinator',
    // Editor signs every invitation batch before the assignment tracker
    // opens and reminders schedule.
    predicate: AND(
      SchemaMatch(PeerReviewCoordinatorOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['editor'] })
    ),
    // Subscription pricing — see `pricing` for plan + metered overage.
    amount: { amount: 99900n, currency: 'USD' },
    // 3-day SLA — peer-review queue management is a high-cadence service.
    timeoutDays: 3,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: {
      id: 'editorial-board-monthly',
      amount: 99900n,
      currency: 'USD',
      interval: 'month',
    },
    metered: [
      {
        event: 'manuscript-routed',
        amount: 4900n,
        description: 'Per-manuscript overage: $49 each manuscript routed beyond the included tier.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 4500n, perApiCall: 4n },
  reward: kr_timeToFirstReviewAndAcceptance,

  lineage: {
    cellRef: 'business.org.ai/cells/research-leads/peer-review-coordinator',
    icpContextProblemRef: 'icp:peer-review-coordinator:v1',
    foundingHypothesisRef: 'fh:peer-review-coordinator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
