/**
 * Org Design Impact Modeler Service — proposed-org-change impact analysis
 * Service for the people / HR catalog.
 *
 * Distinguishing shape vs. siblings (`hiring-loop-coordinator`,
 * `performance-review-narrator`):
 *   - `forecast-narrative` archetype — the artefact is a CHRO-and-sponsor-
 *     VP-signed impact memo (span-of-control + comp-band collisions + role-
 *     clarity risks + mitigations + sequencing plan), not an interview-loop
 *     schedule or a quarterly review packet;
 *   - 5-step cascade: Code fan-in (current org graph + headcount budget +
 *     roles of affected people) → Generative (impact narrative: span-of-
 *     control + comp-band collisions + role-clarity risks) → Generative
 *     (mitigations + sequencing plan) → Human (CHRO + sponsor-VP sign) →
 *     Code (emit impact memo + change tracker);
 *   - `Pricing.outcome` 3 tiers keyed on the scope of the proposed change —
 *     team / function / company-wide — the impact memo is worth more on a
 *     company-wide reorg than on a single-team consolidation;
 *   - declarative HITL = mandatory CHRO sign-off Human Function (the CHRO
 *     owns the people-impact authority for any structural change at the
 *     VP-or-above-proposing tier; uses `'approval'` rationale because the
 *     decision authority cannot be delegated), plus OutcomeContract
 *     requires CHRO signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(span-of-control-
 *     realism + comp-band-coverage + sequencing-soundness) +
 *     HumanSign(CHRO))`.
 *
 * Per design v3 §3 (Catalog HOW people) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `post-reorg-attrition-vs-baseline` — the compound
 * metric every CHRO / people-leader optimises against (the modeler is worth
 * running iff the structural changes it greenlights ship without an
 * attrition spike vs. the pre-change attrition baseline).
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
 * Input — a VP-or-above proposes a re-org / new-function / consolidation.
 * Tight: 7 fields cover the proposal identity, the sponsor-VP (and rank
 * gate the trigger validates), the kind of change (new-function /
 * consolidation / re-org), the change scope (so the outcome-tier pricing is
 * resolvable at intake), the affected org-units, the proposal narrative the
 * cascade reasons against, and the target effective-date.
 */
export const OrgChangeProposalInputSchema = z.object({
  proposalId: z.string(),
  sponsorVpRef: z.string(),
  sponsorRank: z.enum(['vp', 'svp', 'evp', 'c-level']),
  changeKind: z.enum(['new-function', 'consolidation', 're-org', 'split', 'role-reclassification']),
  changeScope: z.enum(['team', 'function', 'company-wide']),
  affectedOrgUnits: z.array(z.string()).min(1),
  proposalNarrative: z.string(),
  targetEffectiveDate: z.string(), // ISO-8601
})

/**
 * Output — a CHRO + sponsor-VP signed impact memo: the current org-graph
 * snapshot, the impact narrative (span-of-control + comp-band collisions +
 * role-clarity risks), the proposed mitigations + sequencing plan, the
 * CHRO + sponsor-VP review audit, and pointers to the emitted impact-memo
 * + change-tracker artefacts.
 */
export const OrgChangeImpactOutputSchema = z.object({
  proposalId: z.string(),
  currentOrgSnapshot: z.object({
    affectedHeadcount: z.number().int().nonnegative(),
    spanOfControlByManager: z.array(
      z.object({
        managerRef: z.string(),
        currentReports: z.number().int().nonnegative(),
        proposedReports: z.number().int().nonnegative(),
      })
    ),
    affectedRolesByCompBand: z.array(
      z.object({
        compBand: z.string(),
        headcount: z.number().int().nonnegative(),
      })
    ),
  }),
  impactNarrative: z.object({
    summaryMarkdown: z.string(),
    spanOfControlRisks: z
      .array(
        z.object({
          managerRef: z.string(),
          riskNarrative: z.string(),
          severity: z.enum(['low', 'medium', 'high']),
        })
      )
      .default([]),
    compBandCollisions: z
      .array(
        z.object({
          collisionDescription: z.string(),
          affectedEmployees: z.array(z.string()),
          severity: z.enum(['low', 'medium', 'high']),
        })
      )
      .default([]),
    roleClarityRisks: z
      .array(
        z.object({
          riskDescription: z.string(),
          affectedRoles: z.array(z.string()),
          severity: z.enum(['low', 'medium', 'high']),
        })
      )
      .default([]),
  }),
  mitigations: z
    .array(
      z.object({
        mitigationId: z.string(),
        targetRiskRef: z.string(),
        mitigationDescription: z.string(),
        ownerRef: z.string(),
      })
    )
    .min(1),
  sequencingPlan: z.object({
    phases: z
      .array(
        z.object({
          phaseId: z.string(),
          description: z.string(),
          targetStartDate: z.string(),
          targetEndDate: z.string(),
          dependencies: z.array(z.string()).default([]),
        })
      )
      .min(1),
    totalDurationDays: z.number().int().positive(),
  }),
  chroReview: z.object({
    chroRef: z.string(),
    sponsorVpRef: z.string(),
    decision: z.enum(['approve', 'request-edit', 'reject']),
    notes: z.string().optional(),
    signedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    impactMemoUrl: z.string(),
    changeTrackerRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type OrgChangeProposalInput = z.infer<typeof OrgChangeProposalInputSchema>
export type OrgChangeImpactOutput = z.infer<typeof OrgChangeImpactOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_postReorgAttrition: RewardSignal = {
  keyResultRef: 'kr:org-design-impact-modeler:post-reorg-attrition-vs-baseline',
}
const kr_orgGraphCoverage: RewardSignal = {
  keyResultRef: 'kr:org-design-impact-modeler:org-graph-coverage',
}
const kr_impactNarrativeRealism: RewardSignal = {
  keyResultRef: 'kr:org-design-impact-modeler:impact-narrative-realism',
}
const kr_mitigationCoverage: RewardSignal = {
  keyResultRef: 'kr:org-design-impact-modeler:mitigation-coverage',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:org-design-impact-modeler:emit-latency',
}

// ============================================================================
// Org Design Impact Modeler Service
// ============================================================================

/**
 * Org Design Impact Modeler — VP-or-above org-change proposal → CHRO +
 * sponsor-VP signed impact memo (span-of-control + comp-band collisions +
 * role-clarity risks + mitigations + sequencing plan) as a Service.
 *
 * Cascade: fetch-current-org-graph-headcount-budget-and-affected-roles (Code, fan-in)
 *        → synthesize-impact-narrative-with-span-comp-and-role-clarity-risks (Generative)
 *        → draft-mitigations-and-sequencing-plan (Generative)
 *        → chro-and-sponsor-vp-sign (Human, approval rationale)
 *        → emit-impact-memo-and-change-tracker (Code, fan-out).
 */
export const orgDesignImpactModeler: ServiceInstance<
  OrgChangeProposalInput,
  OrgChangeImpactOutput
> = Service.define<OrgChangeProposalInput, OrgChangeImpactOutput>({
  name: 'Org Design Impact Modeler',
  promise:
    'Every VP-or-above proposed re-org / new-function / consolidation gets a CHRO-and-sponsor-VP-signed impact memo — span-of-control + comp-band collisions + role-clarity risks + mitigations + sequencing — before the change gets greenlit, so structural changes ship without an attrition spike.',
  audience: 'business',
  archetype: 'forecast-narrative',
  schema: { input: OrgChangeProposalInputSchema, output: OrgChangeImpactOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-current-org-graph-headcount-budget-and-affected-roles',
        reward: kr_orgGraphCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-impact-narrative-with-span-comp-and-role-clarity-risks',
        reward: kr_impactNarrativeRealism,
      }),
      Generative({
        name: 'draft-mitigations-and-sequencing-plan',
        reward: kr_mitigationCoverage,
      }),
      Human({
        name: 'chro-and-sponsor-vp-sign',
        // `approval` rationale: CHRO sign-off on the people-impact of
        // any VP-or-above-proposed structural change cannot be delegated
        // — the decision authority is the value the customer pays for.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-impact-memo-and-change-tracker',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'workday.org-graph',
      'workday.headcount',
      'workday.comp-bands',
      'lattice.roles',
      'finance.headcount-budget',
      'docs.write',
      'pdf.render',
      'change-tracker.create',
    ],
    // Org-design impact analysis: clarification disabled — the cascade
    // synthesises from the org graph + headcount budget + affected-role
    // descriptors; the CHRO + sponsor-VP sign step is the single human
    // contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Company-wide re-orgs escalate the impact-narrative synthesis to a
        // senior org-design partner supervisor before the CHRO sign step
        // (the second-order effects compound at company scope).
        when: 'changeScope == "company-wide"',
        action: 'escalate',
      },
      {
        // Every proposal routes through CHRO + sponsor-VP sign before the
        // memo emits; OutcomeContract enforces the signature, the trigger
        // primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'chro-and-sponsor-vp-sign',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:org-design-impact-modeler-review',
    personas: [
      // Span-of-control-realism reviewer — pedantic check that every
      // proposed manager span lies inside a defensible band (typically
      // 5-12 reports) and that any span outside the band is explicitly
      // flagged with rationale.
      Personas.pedantic({
        domain: 'span-of-control-realism',
        rubric: [
          'every-manager-span-inside-defensible-band',
          'spans-outside-band-explicitly-flagged',
          'no-silent-span-overload',
          'flat-spans-justified-when-claimed',
        ],
        name: 'span-of-control-checker',
      }),
      // Comp-band-coverage reviewer — pedantic check that every comp-band
      // collision identified in the affected-headcount slice is named in
      // the impact narrative and has at least one mitigation entry, with
      // no silent omissions.
      Personas.pedantic({
        domain: 'comp-band-coverage',
        rubric: [
          'every-collision-named-in-narrative',
          'every-collision-has-mitigation-entry',
          'no-silently-omitted-collisions',
          'severity-band-coheres-with-affected-headcount',
        ],
        name: 'comp-band-coverage-checker',
      }),
      // Sequencing-soundness reviewer — adversarially probes whether the
      // proposed phase plan respects mitigation dependencies (e.g. comp-
      // band re-leveling lands before role-reclassification fan-out) and
      // whether the total duration is realistic vs. wishful.
      Personas.skeptic({
        domain: 'sequencing-soundness',
        focus: [
          'phase-dependencies-respect-mitigation-order',
          'duration-realistic-not-wishful',
          'no-dangling-mitigations-outside-plan',
        ],
        name: 'sequencing-soundness-reviewer',
      }),
      // HR domain reviewer — pulls the senior-org-design-partner expert
      // for judgment on the overall impact-memo quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/HumanResourcesManagers',
        name: 'people-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:org-design-impact-modeler:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-chro',
    seller: 'svc:org-design-impact-modeler',
    serviceRef: 'svc:org-design-impact-modeler',
    // CHRO signs every memo before it emits — people-impact authority for
    // VP-or-above structural changes cannot be delegated.
    predicate: AND(
      SchemaMatch(OrgChangeImpactOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['chro'] })
    ),
    // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
    amount: { amount: 9999n, currency: 'USD' },
    // 14-day SLA — impact analysis at function / company scope ships
    // within a fortnight of the proposal so the change isn't bottlenecked
    // on the memo.
    timeoutDays: 14,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      { id: 'team', amount: 1999n },
      { id: 'function', amount: 9999n },
      { id: 'company-wide', amount: 49999n },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 8000n, perApiCall: 14n },
  reward: kr_postReorgAttrition,

  lineage: {
    cellRef: 'business.org.ai/cells/human-resources-managers/org-design-impact-modeler',
    icpContextProblemRef: 'icp:org-design-impact-modeler:v1',
    foundingHypothesisRef: 'fh:org-design-impact-modeler:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
