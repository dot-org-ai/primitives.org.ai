/**
 * Hiring Loop Coordinator Service — interview-loop coordination Service for
 * the people / HR catalog.
 *
 * Distinguishing shape vs. siblings (`performance-review-narrator`,
 * `org-design-impact-modeler`):
 *   - `multi-step-research` archetype — the artefact is a hiring-manager-
 *     confirmed onsite-loop schedule, with the panel selected, slots
 *     reconciled across panel + candidate availability, and prep docs sent,
 *     not a quarterly review packet or an org-design impact memo;
 *   - 5-step cascade with one supervised Agentic schedule-coordination step
 *     (the only Agentic step in the people catalog), bookended by Code
 *     fan-in (candidate profile + role spec + panel availability),
 *     Generative synthesis of the loop structure + question allocation, a
 *     hiring-manager Human review-and-confirm gate, and Code fan-out
 *     (loop schedule + prep-doc send);
 *   - `Pricing.perInvocation` 3 tiers keyed on the role's IC / senior /
 *     executive band ($299 / $999 / $4,999) — the loop is worth more on
 *     executive than on IC because of the longer panel + the higher cost
 *     of a bad onsite;
 *   - declarative HITL = mandatory hiring-manager review-and-confirm Human
 *     Function (the hiring-manager owns the panel composition + the bar
 *     for the role and cannot delegate the confirm), plus OutcomeContract
 *     requires hiring-manager signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(panel-coverage +
 *     question-alignment) + HumanSign(hiring-manager))`.
 *
 * Per design v3 §3 (Catalog HOW people) + §6 (binding triggers, conditional
 * HumanSign) + §7 (perInvocation pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `time-to-loop-confirmed-improvement` — the compound
 * metric every TA / hiring org optimises against (the coordinator is worth
 * running iff onsite loops confirm in hours, not the traditional days of
 * recruiter back-and-forth, vs. the pre-Service baseline).
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
 * Input — a candidate moves to the onsite-loop stage in the ATS. Tight: 7
 * fields cover the candidate identity, the role being interviewed for, the
 * role-band so the perInvocation tier is resolvable at intake, the assigned
 * hiring-manager (Human review routing), the candidate-availability window,
 * the preferred loop format, and the ATS stage the trigger fired from.
 */
export const LoopTriggerInputSchema = z.object({
  candidateRef: z.string(),
  roleRef: z.string(),
  roleBand: z.enum(['ic', 'senior', 'executive']),
  assignedHiringManagerRef: z.string(),
  candidateAvailabilityWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
    timezone: z.string(),
  }),
  loopFormat: z.enum(['onsite', 'virtual', 'hybrid']),
  atsStage: z.literal('onsite-loop'),
})

/**
 * Output — a hiring-manager-confirmed loop schedule: the synthesised loop
 * structure, the per-interviewer question allocation, the reconciled
 * schedule (slot per interviewer × candidate), the hiring-manager review
 * audit, and pointers to the emitted schedule + prep-doc artefacts.
 */
export const LoopScheduleOutputSchema = z.object({
  candidateRef: z.string(),
  roleRef: z.string(),
  loopStructure: z.object({
    summary: z.string(),
    totalDurationMinutes: z.number().int().positive(),
    interviewerSlots: z
      .array(
        z.object({
          interviewerRef: z.string(),
          competency: z.enum([
            'coding',
            'system-design',
            'behavioral',
            'role-specific',
            'leadership',
            'product-sense',
            'culture-add',
          ]),
          durationMinutes: z.number().int().positive(),
        })
      )
      .min(1),
  }),
  questionAllocation: z.array(
    z.object({
      interviewerRef: z.string(),
      assignedQuestions: z.array(z.string()).min(1),
      roleAlignmentRationale: z.string(),
    })
  ),
  reconciledSchedule: z.array(
    z.object({
      interviewerRef: z.string(),
      slotStartAt: z.string(),
      slotEndAt: z.string(),
      meetingRef: z.string(),
    })
  ),
  hiringManagerReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['confirm', 'request-edit', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    scheduleUrl: z.string(),
    prepDocUrl: z.string(),
    candidateInviteRefs: z.array(z.string()),
    panelInviteRefs: z.array(z.string()),
    sentAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type LoopTriggerInput = z.infer<typeof LoopTriggerInputSchema>
export type LoopScheduleOutput = z.infer<typeof LoopScheduleOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_timeToLoopConfirmed: RewardSignal = {
  keyResultRef: 'kr:hiring-loop-coordinator:time-to-loop-confirmed-improvement',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:hiring-loop-coordinator:intake-coverage',
}
const kr_loopStructureFit: RewardSignal = {
  keyResultRef: 'kr:hiring-loop-coordinator:loop-structure-fit',
}
const kr_schedulingReconciliation: RewardSignal = {
  keyResultRef: 'kr:hiring-loop-coordinator:scheduling-reconciliation',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:hiring-loop-coordinator:emit-latency',
}

// ============================================================================
// Hiring Loop Coordinator Service
// ============================================================================

/**
 * Hiring Loop Coordinator — onsite-loop ATS-stage trigger → hiring-manager-
 * confirmed loop schedule + prep docs as a Service.
 *
 * Cascade: fetch-candidate-profile-role-spec-and-panel-availability (Code, fan-in)
 *        → synthesize-loop-structure-and-role-aligned-question-allocation (Generative)
 *        → coordinate-scheduling-across-panel-and-candidate (Agentic, supervised)
 *        → hiring-manager-review-and-confirm (Human, approval rationale)
 *        → emit-loop-schedule-and-send-prep-docs (Code, fan-out).
 */
export const hiringLoopCoordinator: ServiceInstance<LoopTriggerInput, LoopScheduleOutput> =
  Service.define<LoopTriggerInput, LoopScheduleOutput>({
    name: 'Hiring Loop Coordinator',
    promise:
      'Every candidate moving to onsite-loop gets a hiring-manager-confirmed schedule — panel selected, questions role-aligned, slots reconciled, prep docs sent — in hours, not days of recruiter back-and-forth.',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: LoopTriggerInputSchema, output: LoopScheduleOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-candidate-profile-role-spec-and-panel-availability',
          reward: kr_intakeCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-loop-structure-and-role-aligned-question-allocation',
          reward: kr_loopStructureFit,
        }),
        Agentic({
          name: 'coordinate-scheduling-across-panel-and-candidate',
          reward: kr_schedulingReconciliation,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Human({
          name: 'hiring-manager-review-and-confirm',
          // `approval` rationale: hiring-manager sign-off on the panel
          // composition + the bar for the role cannot be delegated. The
          // gate stays human regardless of model accuracy.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-loop-schedule-and-send-prep-docs',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'ats.candidates',
        'ats.roles',
        'ats.stages',
        'calendar.availability',
        'calendar.events',
        'docs.write',
        'gmail.send',
      ],
      // Loop coordination: clarification disabled — the cascade synthesises
      // from candidate profile + role spec + panel availability; the
      // hiring-manager review-and-confirm step is the single human contact
      // point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Executive-band loops escalate the loop-structure synthesis to a
          // senior TA-partner supervisor before the hiring-manager confirm
          // (the bar + the panel composition are higher-stakes at exec).
          when: 'roleBand == "executive"',
          action: 'escalate',
        },
        {
          // Every loop routes through hiring-manager review-and-confirm
          // before the schedule emits; OutcomeContract enforces the
          // signature, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'hiring-manager-review-and-confirm',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:hiring-loop-coordinator-review',
      personas: [
        // Panel-coverage reviewer — pedantic check that the proposed panel
        // covers every competency required by the role-spec and that no
        // single interviewer is double-booked across the loop.
        Personas.pedantic({
          domain: 'panel-coverage',
          rubric: [
            'every-required-competency-covered',
            'no-interviewer-double-booked',
            'panel-includes-cross-functional-rep-when-role-requires',
            'no-bar-raiser-conflict-of-interest',
          ],
          name: 'panel-coverage-checker',
        }),
        // Question-alignment reviewer — adversarially probes whether each
        // assigned question actually maps to the competency the slot is
        // probing vs. generic "tell me about yourself" filler.
        Personas.skeptic({
          domain: 'question-alignment',
          focus: ['maps-to-competency', 'role-spec-grounded', 'no-generic-filler'],
          name: 'question-alignment-reviewer',
        }),
        // Scheduling-feasibility reviewer — pedantic check that every
        // reconciled slot lies inside the candidate-availability window,
        // every interviewer slot lies inside the interviewer's availability,
        // and the loop totals fit within the declared format / day.
        Personas.pedantic({
          domain: 'scheduling-feasibility',
          rubric: [
            'every-slot-inside-candidate-availability',
            'every-slot-inside-interviewer-availability',
            'loop-fits-declared-format-and-day-length',
            'breaks-allocated-between-back-to-back-slots',
          ],
          name: 'scheduling-feasibility-checker',
        }),
        // HR domain reviewer — pulls the senior-TA-partner expert for
        // judgment on the overall loop quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/HumanResourcesManagers',
          name: 'people-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:hiring-loop-coordinator:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-hiring-manager',
      seller: 'svc:hiring-loop-coordinator',
      serviceRef: 'svc:hiring-loop-coordinator',
      // Hiring-manager signs every loop before the schedule emits — panel
      // composition + bar-for-role authority cannot be delegated.
      predicate: AND(
        SchemaMatch(LoopScheduleOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['hiring-manager'] })
      ),
      // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
      amount: { amount: 99900n, currency: 'USD' },
      // 1-day SLA — onsite loops should confirm within 24 hours of the
      // candidate hitting the onsite-loop stage so the funnel doesn't stall.
      timeoutDays: 1,
      onTimeout: 'escalate',
    },

    pricing: Pricing.perInvocation({
      tiers: [
        {
          id: 'ic',
          amount: 29900n,
          includedPerMonth: 20,
          overage: 29900n,
        },
        {
          id: 'senior',
          amount: 99900n,
          includedPerMonth: 8,
          overage: 99900n,
        },
        {
          id: 'executive',
          amount: 499900n,
          includedPerMonth: 2,
          overage: 499900n,
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 1500n, perApiCall: 10n },
    reward: kr_timeToLoopConfirmed,

    lineage: {
      cellRef: 'business.org.ai/cells/human-resources-managers/hiring-loop-coordinator',
      icpContextProblemRef: 'icp:hiring-loop-coordinator:v1',
      foundingHypothesisRef: 'fh:hiring-loop-coordinator:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
