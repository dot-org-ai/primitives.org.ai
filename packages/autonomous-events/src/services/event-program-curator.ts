/**
 * Event Program Curator Service — conference / webinar program design Service
 * for the events catalog.
 *
 * Distinguishing shape vs. siblings (`partnership-deal-orchestrator`,
 * `event-attendee-engagement-monitor`):
 *   - `content-generation` archetype — the artefact is a program-chair-signed
 *     event-program document (themes + session-types + speaker assignments +
 *     diversity coverage + flow narrative) plus an outreach batch keyed on
 *     the audience-shape and prior-event performance, not a partnership deal
 *     pack or a real-time engagement dashboard;
 *   - 5-step cascade: Code fan-in (audience-shape + topic-pool + speaker-pool
 *     + prior-event-perf) → Generative (synthesize-program-arc with themes +
 *     session-types + diversity-coverage + flow-narrative) → Generative
 *     (draft-speaker-invitations + session-briefs) → Human (program-chair +
 *     content-lead review-and-sign) → Code (emit-program-doc +
 *     speaker-outreach-batch);
 *   - `Pricing.outcome` 3 tiers keyed on event scope — webinar / half-day /
 *     multi-day-conference ($999 / $4,999 / $19,999) — the program is worth
 *     more on a multi-day conference than on a one-shot webinar;
 *   - declarative HITL = mandatory program-chair + content-lead review Human
 *     Function (the program-chair owns the program-design authority — no
 *     speaker invitations send before the chair has signed), plus
 *     OutcomeContract requires program-chair signature with `approval`
 *     rationale (program-design ownership cannot be delegated);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(theme-coherence +
 *     diversity-coverage + flow-soundness) + HumanSign(program-chair))`.
 *
 * Per design v3 §3 (Catalog HOW events) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome tiered pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `attendee-NPS-and-session-attendance-rate` — the
 * compound metric every events-team org optimises against (the curator is
 * worth running iff post-event attendee-NPS AND per-session attendance-rate
 * both beat the pre-Service baseline at parity event scope).
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
 * Input — an event being scoped for program curation. Tight: 8 fields cover
 * the event identity, the event scope (so the outcome tier resolves at
 * intake), the audience shape, the topic-pool candidates, the speaker-pool
 * candidates, the prior-event performance reference, the program-chair and
 * content-lead routing targets, and the program format.
 */
export const EventProgramCuratorInputSchema = z.object({
  eventId: z.string(),
  eventScope: z.enum(['webinar', 'half-day', 'multi-day-conference']),
  eventFormat: z.enum(['in-person', 'virtual', 'hybrid']),
  scheduledStartDate: z.string(), // ISO-8601
  audienceShape: z.object({
    expectedAttendeeCount: z.number().int().nonnegative(),
    primaryRoles: z.array(z.string()).min(1),
    seniorityMix: z.array(z.enum(['ic', 'manager', 'director', 'vp', 'cxo'])).min(1),
    industries: z.array(z.string()).default([]),
  }),
  topicPool: z
    .array(
      z.object({
        topicId: z.string(),
        title: z.string(),
        rationale: z.string(),
      })
    )
    .min(1),
  speakerPool: z
    .array(
      z.object({
        speakerId: z.string(),
        name: z.string(),
        affiliation: z.string(),
        topics: z.array(z.string()).min(1),
        priorEventRating: z.number().min(0).max(5).optional(),
      })
    )
    .min(1),
  priorEventPerfRef: z.string().optional(),
  programChairRef: z.string(),
  contentLeadRef: z.string(),
})

/**
 * Output — a program-chair-signed event-program document + speaker-outreach
 * batch: the synthesised program-arc (themes + session-types + flow narrative
 * + diversity coverage), the per-session briefs, the per-speaker invitations,
 * the program-chair + content-lead review audit, and pointers to the emitted
 * program-doc + outreach-batch artefacts.
 */
export const EventProgramCuratorOutputSchema = z.object({
  eventId: z.string(),
  programArc: z.object({
    themes: z
      .array(
        z.object({
          themeId: z.string(),
          title: z.string(),
          rationale: z.string(),
          targetSessionCount: z.number().int().positive(),
        })
      )
      .min(1),
    sessionTypes: z
      .array(z.enum(['keynote', 'panel', 'workshop', 'fireside', 'lightning-talk', 'roundtable']))
      .min(1),
    flowNarrative: z.string(),
    diversityCoverage: z.object({
      genderMix: z.string(),
      seniorityMix: z.string(),
      industryMix: z.string(),
      regionMix: z.string().optional(),
      gapNotes: z.array(z.string()).default([]),
    }),
    citations: z
      .array(
        z.object({
          sourceType: z.enum(['first-party', 'industry-standard', 'primary']),
          ref: z.string(),
        })
      )
      .min(1),
  }),
  sessionBriefs: z
    .array(
      z.object({
        sessionId: z.string(),
        themeRef: z.string(),
        sessionType: z.enum([
          'keynote',
          'panel',
          'workshop',
          'fireside',
          'lightning-talk',
          'roundtable',
        ]),
        title: z.string(),
        abstract: z.string(),
        targetSpeakerIds: z.array(z.string()).min(1),
        durationMinutes: z.number().int().positive(),
      })
    )
    .min(1),
  speakerInvitations: z
    .array(
      z.object({
        speakerId: z.string(),
        sessionId: z.string(),
        invitationDraft: z.string(),
        personalisationNote: z.string(),
      })
    )
    .min(1),
  programChairReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-and-send', 'edit-and-send', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  contentLeadReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-and-send', 'edit-and-send', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    programDocUrl: z.string(),
    outreachBatchRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type EventProgramCuratorInput = z.infer<typeof EventProgramCuratorInputSchema>
export type EventProgramCuratorOutput = z.infer<typeof EventProgramCuratorOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_attendeeNpsAndAttendance: RewardSignal = {
  keyResultRef: 'kr:event-program-curator:attendee-NPS-and-session-attendance-rate',
}
const kr_audienceFanInCoverage: RewardSignal = {
  keyResultRef: 'kr:event-program-curator:audience-fan-in-coverage',
}
const kr_programArcCoherence: RewardSignal = {
  keyResultRef: 'kr:event-program-curator:program-arc-coherence',
}
const kr_invitationQuality: RewardSignal = {
  keyResultRef: 'kr:event-program-curator:invitation-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:event-program-curator:emit-latency',
}

// ============================================================================
// Event Program Curator Service
// ============================================================================

/**
 * Event Program Curator — event scoped + speaker-pool / topic-candidates
 * available → program-chair-signed event-program document with themes +
 * session-types + diversity-coverage + flow-narrative + speaker-invitations
 * keyed to the audience shape and prior-event performance as a Service.
 *
 * Cascade: fetch-audience-shape-and-topic-pool-and-speaker-pool-and-prior-event-perf (Code, fan-in)
 *        → synthesize-program-arc-themes-session-types-diversity-coverage-and-flow-narrative (Generative)
 *        → draft-speaker-invitations-and-session-briefs (Generative)
 *        → program-chair-and-content-lead-review (Human, approval rationale)
 *        → emit-program-doc-and-speaker-outreach-batch (Code, fan-out).
 */
export const eventProgramCurator: ServiceInstance<
  EventProgramCuratorInput,
  EventProgramCuratorOutput
> = Service.define<EventProgramCuratorInput, EventProgramCuratorOutput>({
  name: 'Event Program Curator',
  promise:
    'Every conference / webinar lands as a program-chair-signed program document — themes + session-types + diversity-coverage + flow-narrative — with personalised speaker invitations and session briefs, calibrated to the audience shape and prior-event performance, so the program team moves from blank-page to outreach-batch in days instead of weeks.',
  audience: 'business',
  archetype: 'content-generation',
  schema: { input: EventProgramCuratorInputSchema, output: EventProgramCuratorOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-audience-shape-and-topic-pool-and-speaker-pool-and-prior-event-perf',
        reward: kr_audienceFanInCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-program-arc-themes-session-types-diversity-coverage-and-flow-narrative',
        reward: kr_programArcCoherence,
      }),
      Generative({
        name: 'draft-speaker-invitations-and-session-briefs',
        reward: kr_invitationQuality,
      }),
      Human({
        name: 'program-chair-and-content-lead-review',
        // `approval` rationale: program-chair sign-off on the program-arc +
        // speaker invitations cannot be delegated. The program-chair owns
        // brand + audience-experience accountability. The gate stays human
        // regardless of model accuracy.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-program-doc-and-speaker-outreach-batch',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'event-platform.read',
      'speaker-database.read',
      'topic-research.read',
      'prior-event-perf.read',
      'attendee-survey.read',
      'audience-analytics.read',
      'cms.publish',
      'crm.contacts',
      'gmail.send',
      'docs.write',
    ],
    // Program curation: clarification disabled — the cascade synthesises
    // from the audience-shape + topic-pool + speaker-pool + prior-event
    // perf; the program-chair + content-lead review step at the end is
    // the single human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Multi-day-conference scope escalates the program-arc step to a
        // senior content-strategist supervisor before the program-chair
        // review (the chair still signs, but a senior backstops the
        // synthesis quality on the highest-stakes tier).
        when: 'eventScope == "multi-day-conference"',
        action: 'escalate',
      },
      {
        // Every event routes through program-chair + content-lead review
        // before the outreach batch sends; OutcomeContract enforces the
        // signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'program-chair-and-content-lead-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:event-program-curator-review',
    personas: [
      // Theme-coherence reviewer — pedantic check that every theme lands
      // a non-trivial title + rationale, the per-theme target session
      // count adds up to the total session count, and no two themes
      // collapse into the same conceptual frame.
      Personas.pedantic({
        domain: 'theme-coherence',
        rubric: [
          'every-theme-cites-a-non-trivial-rationale',
          'per-theme-session-counts-add-up',
          'no-two-themes-collapse-conceptually',
          'themes-trace-to-audience-shape',
          'themes-trace-to-topic-pool',
        ],
        name: 'theme-coherence-checker',
      }),
      // Diversity-coverage reviewer — pedantic check that gender +
      // seniority + industry mix gaps are explicitly named (an empty
      // gap-notes list with a poor mix is a reject) and that each gap
      // note traces to a concrete remediation pointer.
      Personas.pedantic({
        domain: 'diversity-coverage',
        rubric: [
          'gender-mix-explicitly-stated',
          'seniority-mix-explicitly-stated',
          'industry-mix-explicitly-stated',
          'gap-notes-traceable-to-remediation',
          'no-empty-gap-notes-on-skewed-mix',
        ],
        name: 'diversity-coverage-checker',
      }),
      // Flow-soundness reviewer — adversarially probes whether the flow
      // narrative is internally consistent (session-types alternate to
      // sustain attention; keynotes anchor opening + closing slots; flow-
      // narrative paragraphs trace to per-session briefs).
      Personas.skeptic({
        domain: 'flow-soundness',
        focus: [
          'session-types-alternate-to-sustain-attention',
          'keynotes-anchor-opening-and-closing',
          'flow-narrative-traces-to-per-session-briefs',
          'pacing-matches-audience-seniority-mix',
          'no-three-deep-back-to-back-workshop-slots',
        ],
        name: 'flow-soundness-reviewer',
      }),
      // Brand-safety reviewer — `low` risk-tolerance check on the
      // synthesised invitations + session briefs. Conference + webinar
      // programs are the brand surface that carries the highest
      // reputational risk if a session lands off-brand or a speaker
      // invitation reads badly.
      Personas.brandSafety({
        riskTolerance: 'low',
        name: 'brand-safety-reviewer',
      }),
      // Factual-accuracy reviewer — every load-bearing claim in the
      // program-arc citation set must carry at least one citation. The
      // floor of 1 keeps the bar non-trivial without forcing academic-
      // grade citation density on what is fundamentally a curation
      // artefact.
      Personas.factualAccuracy({
        minCitationsPerClaim: 1,
        name: 'factual-accuracy-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:event-program-curator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-event-lead',
    seller: 'svc:event-program-curator',
    serviceRef: 'svc:event-program-curator',
    // Program-chair signs every program before the outreach batch sends —
    // program-design authority cannot be delegated.
    predicate: AND(
      SchemaMatch(EventProgramCuratorOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['program-chair'] })
    ),
    // Mid-tier amount; the per-tier amounts are in `pricing.tiers`.
    amount: { amount: 499900n, currency: 'USD' },
    // 14-day SLA — program curation is multi-week work; the document
    // lands in the chair's inbox inside two weeks of intake so outreach
    // has time to land speakers.
    timeoutDays: 14,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'webinar',
        amount: 99900n,
        currency: 'USD',
        description:
          'Single-session webinar program — one theme, 1–3 speakers, 60–90 min run. Program doc + outreach batch delivered in 5 business days. $999.',
      },
      {
        id: 'half-day',
        amount: 499900n,
        currency: 'USD',
        description:
          'Half-day event — 2–3 themes, 4–8 sessions, mixed session-types. Program doc + outreach batch delivered in 10 business days. $4,999.',
      },
      {
        id: 'multi-day-conference',
        amount: 1999900n,
        currency: 'USD',
        description:
          'Multi-day conference — 4+ themes, 20+ sessions, full-mix session-types, diversity coverage explicit. Program doc + outreach batch delivered in 14 business days. $19,999.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 8500n, perApiCall: 18n },
  reward: kr_attendeeNpsAndAttendance,

  lineage: {
    cellRef: 'business.org.ai/cells/event-leads/event-program-curator',
    icpContextProblemRef: 'icp:event-program-curator:v1',
    foundingHypothesisRef: 'fh:event-program-curator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
