/**
 * Performance Review Narrator Service — quarterly performance-review packet
 * authoring Service for the people / HR catalog.
 *
 * Distinguishing shape vs. siblings (`hiring-loop-coordinator`,
 * `org-design-impact-modeler`):
 *   - `forecast-narrative` archetype — the artefact is a manager-personalised
 *     review packet (strengths-and-growth narrative + OKR-progress + next-
 *     cycle recommendations) signed by the manager, not an interview-loop
 *     schedule or an org-design impact memo;
 *   - 5-step cascade: Code fan-in (OKRs + 360 feedback + 1-1 notes) →
 *     Generative (strengths + growth narrative grounded in evidence) →
 *     Generative (OKR progress + next-cycle recommendations) → Human
 *     (manager personalises and signs) → Code (emit review packet);
 *   - `Pricing.subscription` — a recurring people-team subscription
 *     ($299/mo) plus metered overage at $99 per review-packet authored
 *     above the quarterly cadence baseline (a headcount-growing tenant
 *     pulls more packets than the baseline subscription covers);
 *   - declarative HITL = mandatory manager personalize-and-sign Human
 *     Function (the manager owns the relationship + the words their report
 *     reads — that voice cannot be delegated; uses `'trust'` rationale
 *     because the manager's first-person voice is the value), plus
 *     OutcomeContract requires manager signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(evidence-grounding +
 *     tone-fairness + actionability) + HumanSign(manager))`;
 *   - EvaluatorPanel includes `Personas.brandSafety({ toneRange: 'formal' })`
 *     and `Personas.factualAccuracy({ minCitationsPerClaim: 2 })` because
 *     review-packet language is high-stakes (legal-discoverable, compensation-
 *     adjacent) and every claim about an employee must be backed by at least
 *     two corroborating evidence citations.
 *
 * Per design v3 §3 (Catalog HOW people) + §6 (binding triggers, conditional
 * HumanSign) + §7 (subscription pricing factory with metered overage) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `review-cycle-time-reduction-per-manager` — the
 * compound metric every people org optimises against (the narrator is worth
 * running iff per-manager review-cycle prep time drops vs. the pre-Service
 * baseline, while review quality holds or improves).
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
 * Input — quarterly review cycle + an in-scope employee. Tight: 7 fields
 * cover the cycle identity, the employee being reviewed, the assigned
 * manager (Human personalize-and-sign routing), the review window, the
 * connected feedback sources, the role-band (so the narrator calibrates
 * the expectations envelope), and the cycle stage gating intake.
 */
export const ReviewCycleInputSchema = z.object({
  cycleId: z.string(),
  employeeRef: z.string(),
  assignedManagerRef: z.string(),
  reviewWindow: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  sources: z.object({
    okrSystem: z.enum(['lattice', 'culture-amp', 'workday', '15five', 'leapsome']),
    feedbackSystem: z.enum(['lattice', 'culture-amp', 'workday', '15five', 'leapsome']),
    oneOneNoteSource: z.enum(['notion', 'docs', 'lattice', '15five']),
  }),
  roleBand: z.enum(['ic', 'senior', 'manager', 'director', 'executive']),
  cycleStage: z.literal('packet-author'),
})

/**
 * Output — a manager-signed performance-review packet: the synthesised
 * strengths-and-growth narrative (with evidence citations), the OKR-progress
 * write-up + next-cycle recommendations, the manager personalisation audit,
 * and pointers to the emitted packet artefact.
 */
export const ReviewPacketOutputSchema = z.object({
  cycleId: z.string(),
  employeeRef: z.string(),
  strengthsAndGrowthNarrative: z.object({
    summaryMarkdown: z.string(),
    strengths: z
      .array(
        z.object({
          theme: z.string(),
          narrative: z.string(),
          evidenceCitations: z.array(z.string()).min(2),
        })
      )
      .min(1),
    growthAreas: z
      .array(
        z.object({
          theme: z.string(),
          narrative: z.string(),
          evidenceCitations: z.array(z.string()).min(2),
        })
      )
      .min(1),
  }),
  okrProgress: z.object({
    summaryMarkdown: z.string(),
    perObjective: z
      .array(
        z.object({
          objectiveRef: z.string(),
          progress: z.enum(['exceeded', 'met', 'partially-met', 'missed']),
          evidenceCitations: z.array(z.string()).min(1),
          rationale: z.string(),
        })
      )
      .min(1),
  }),
  nextCycleRecommendations: z
    .array(
      z.object({
        recommendation: z.string(),
        successCriteria: z.string(),
        supportingResources: z.array(z.string()).default([]),
      })
    )
    .min(1),
  managerPersonalisation: z.object({
    managerRef: z.string(),
    decision: z.enum(['sign', 'edit-and-sign', 'reject']),
    editedSections: z.array(z.string()).default([]),
    notes: z.string().optional(),
    signedAt: z.string(),
  }),
  packet: z.object({
    pdfUrl: z.string(),
    docUrl: z.string().optional(),
    pageCount: z.number().int().positive(),
  }),
  generatedAt: z.string(),
})

export type ReviewCycleInput = z.infer<typeof ReviewCycleInputSchema>
export type ReviewPacketOutput = z.infer<typeof ReviewPacketOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_reviewCycleTime: RewardSignal = {
  keyResultRef: 'kr:performance-review-narrator:review-cycle-time-reduction-per-manager',
}
const kr_signalCoverage: RewardSignal = {
  keyResultRef: 'kr:performance-review-narrator:signal-coverage',
}
const kr_narrativeQuality: RewardSignal = {
  keyResultRef: 'kr:performance-review-narrator:narrative-quality',
}
const kr_okrProgressRealism: RewardSignal = {
  keyResultRef: 'kr:performance-review-narrator:okr-progress-realism',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:performance-review-narrator:emit-latency',
}

// ============================================================================
// Performance Review Narrator Service
// ============================================================================

/**
 * Performance Review Narrator — quarterly review-cycle trigger + in-scope
 * employee → manager-signed review packet (strengths-and-growth narrative +
 * OKR progress + next-cycle recommendations) as a Service.
 *
 * Cascade: fetch-okrs-360-feedback-and-manager-1-1-notes (Code, fan-in)
 *        → synthesize-strengths-growth-narrative-with-evidence (Generative)
 *        → draft-okr-progress-and-next-cycle-recommendations (Generative)
 *        → manager-personalize-and-sign (Human, trust rationale)
 *        → emit-review-packet (Code, fan-out).
 */
export const performanceReviewNarrator: ServiceInstance<ReviewCycleInput, ReviewPacketOutput> =
  Service.define<ReviewCycleInput, ReviewPacketOutput>({
    name: 'Performance Review Narrator',
    promise:
      'Every quarterly review cycle gets a manager-signed packet — strengths + growth narrative grounded in evidence, OKR progress with citations, next-cycle recommendations — so managers spend the cycle on the conversation, not on assembly.',
    audience: 'business',
    archetype: 'forecast-narrative',
    schema: { input: ReviewCycleInputSchema, output: ReviewPacketOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-okrs-360-feedback-and-manager-1-1-notes',
          reward: kr_signalCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-strengths-growth-narrative-with-evidence',
          reward: kr_narrativeQuality,
        }),
        Generative({
          name: 'draft-okr-progress-and-next-cycle-recommendations',
          reward: kr_okrProgressRealism,
        }),
        Human({
          name: 'manager-personalize-and-sign',
          // `trust` rationale: the manager's first-person voice + the
          // relationship with the report cannot be delegated. The packet
          // ships only when the manager has personally edited and signed.
          rationale: 'trust',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-review-packet',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'lattice.okrs',
        'lattice.feedback',
        'culture-amp.feedback',
        'workday.employees',
        '15five.notes',
        'notion.docs',
        'docs.write',
        'pdf.render',
      ],
      // Review-packet authoring: clarification disabled — the cascade
      // synthesises from OKRs + 360 feedback + 1-1 notes; the manager
      // personalize-and-sign step is the single human contact point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Director-or-above bands escalate the strengths-growth narrative
          // synthesis to a senior people-business-partner supervisor before
          // the manager personalise-and-sign step (the language stakes are
          // higher, and the audience is broader).
          when: 'roleBand == "director" or roleBand == "executive"',
          action: 'escalate',
        },
        {
          // Every packet routes through manager personalize-and-sign before
          // it emits; OutcomeContract enforces the signature, the trigger
          // primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'manager-personalize-and-sign',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:performance-review-narrator-review',
      personas: [
        // Evidence-grounding reviewer — fact-grounding persona requiring at
        // least 2 corroborating evidence citations per load-bearing claim
        // about the employee. Review-packet claims are legal-discoverable
        // and compensation-adjacent — single-source claims aren't acceptable.
        Personas.factualAccuracy({
          minCitationsPerClaim: 2,
          name: 'evidence-grounding-checker',
        }),
        // Tone-fairness reviewer — brand-safety persona constrained to a
        // formal tone register; the packet language must be even-handed,
        // not punitive, not effusive, and aligned to the formal register
        // every people org applies to written performance feedback.
        Personas.brandSafety({
          toneRange: 'formal',
          name: 'tone-fairness-checker',
        }),
        // Actionability reviewer — adversarially probes whether the next-
        // cycle recommendations are concretely actionable (have success
        // criteria + supporting resources) vs. vague aspirational language
        // the report can't translate into behaviour.
        Personas.skeptic({
          domain: 'actionability',
          focus: [
            'concrete-success-criteria',
            'supporting-resources-named',
            'no-vague-aspirations',
          ],
          name: 'actionability-reviewer',
        }),
        // OKR-realism reviewer — pedantic check that every OKR-progress
        // call cites evidence from the OKR system, that the called-progress
        // band matches the cited evidence, and that no objective is silently
        // omitted.
        Personas.pedantic({
          domain: 'okr-progress-realism',
          rubric: [
            'every-objective-progress-cites-evidence',
            'progress-band-matches-evidence',
            'no-silently-omitted-objectives',
            'rationale-coheres-with-progress-band',
          ],
          name: 'okr-realism-checker',
        }),
        // HR domain reviewer — pulls the senior-people-business-partner
        // expert for judgment on the overall packet quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/HumanResourcesManagers',
          name: 'people-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:performance-review-narrator:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-people-leader',
      seller: 'svc:performance-review-narrator',
      serviceRef: 'svc:performance-review-narrator',
      // Manager signs every packet before it emits — the manager's first-
      // person voice + the relationship ownership cannot be delegated.
      predicate: AND(
        SchemaMatch(ReviewPacketOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['manager'] })
      ),
      amount: { amount: 29900n, currency: 'USD' },
      // 7-day SLA — review-cycle prep takes a week from cycle-trigger to
      // manager-signed packet.
      timeoutDays: 7,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'performance-review-narrator-monthly',
        amount: 29900n,
        currency: 'USD',
        interval: 'month',
      },
      // Metered overage — review-packet-authored events above the
      // quarterly cadence baseline charge $99 each. The metering runtime
      // resolves `review-packet-authored` to invocations beyond the
      // implicit per-quarter baseline and lines them on the monthly
      // invoice.
      metered: [
        {
          event: 'review-packet-authored',
          amount: 9900n,
          description: 'Review packet authored above the quarterly cadence baseline.',
        },
      ],
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 4500n, perApiCall: 10n },
    reward: kr_reviewCycleTime,

    lineage: {
      cellRef: 'business.org.ai/cells/human-resources-managers/performance-review-narrator',
      icpContextProblemRef: 'icp:performance-review-narrator:v1',
      foundingHypothesisRef: 'fh:performance-review-narrator:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
