/**
 * Compliance Attestation Author Service — periodic compliance attestation
 * packet (SOC2 / ISO27001 / HIPAA-eligible) for the legal catalog.
 *
 * Distinguishing shape vs. siblings (`contract-reviewer`,
 * `policy-impact-analyzer`, `ip-disclosure-triage`,
 * `litigation-discovery-prep`, `regulatory-filing-drafter`):
 *   - `quality-review` archetype — the artefact is a GC + compliance-officer-
 *     signed attestation packet (control-narrative + control-deviations +
 *     remediation plan + auditor-ready evidence trail) for a periodic
 *     attestation cycle, not a third-party-contract redline (sibling
 *     `contract-reviewer`), a forward-looking jurisdictional impact memo
 *     (sibling `policy-impact-analyzer`), an invention-disclosure triage
 *     decision (sibling `ip-disclosure-triage`), a courtroom production
 *     package (sibling `litigation-discovery-prep`), or an SEC/FINRA
 *     regulatory filing (sibling `regulatory-filing-drafter`);
 *   - 5-step cascade: Code fan-in (control status + evidence trail from
 *     systems + prior attestations) → Generative (synthesise control
 *     narrative with evidence citations + flag gaps) → Generative (draft
 *     attestation statement + control deviations + remediation plan) →
 *     Human (GC + compliance-officer review and sign) → Code (emit
 *     attestation packet + audit trail);
 *   - `Pricing.subscription` $1,999/mo per company plan with metered overage
 *     at $999 per attestation-cycle-completed event — attestations run on
 *     quarterly + ad-hoc cycles, the subscription captures the steady-state
 *     evidence-curation cost and the metered event captures the per-cycle
 *     synthesis + sign-off premium;
 *   - declarative HITL = mandatory GC + compliance-officer review Human
 *     Function (the GC owns regulatory-binding-on-attestation authority,
 *     the compliance-officer owns control-evidence-attestation authority),
 *     plus OutcomeContract requires compliance-officer signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(evidence-completeness +
 *     control-coverage + attestation-defensibility + SOX-regulatoryCompliance +
 *     factualAccuracy[first-party,industry-standard]) +
 *     HumanSign(compliance-officer))`.
 *
 * Per design v3 §3 (Catalog HOW legal) + §6 (binding triggers, conditional
 * HumanSign) + §7 (subscription pricing factory with metered overage) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `audit-cycle-time-and-finding-remediation-rate` —
 * the compound metric every compliance org optimises against (the author is
 * worth running iff the auditor-cycle clock from evidence-collected to
 * attestation-signed shrinks vs. the prior baseline AND the finding-to-
 * remediation rate holds at-or-above the prior cycle's rate).
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
 * Input — a periodic attestation cycle opening (or an auditor evidence
 * request) routed to the compliance-attestation intake channel. Tight: 8
 * fields cover the cycle identity, the framework + scope (so the metered
 * cycle event resolves at intake), the attestation period (start + end),
 * the in-scope-systems list, the auditor-of-record reference, the prior-
 * attestation pointer, the targeted attestation issue date, and the
 * assigned GC + compliance-officer reviewers.
 */
export const AttestationCycleInputSchema = z.object({
  cycleId: z.string(),
  framework: z.enum([
    'soc2-type-1',
    'soc2-type-2',
    'iso-27001',
    'iso-27701',
    'hipaa',
    'pci-dss',
    'cmmc',
  ]),
  scope: z.enum(['full-scope', 'incremental-update', 'auditor-evidence-request']),
  attestationPeriod: z.object({
    periodStart: z.string(), // ISO-8601
    periodEnd: z.string(), // ISO-8601
  }),
  inScopeSystems: z
    .array(
      z.object({
        systemRef: z.string(),
        systemKind: z.enum([
          'production-application',
          'data-store',
          'identity-provider',
          'logging-and-monitoring',
          'sub-processor',
          'workforce-tooling',
        ]),
      })
    )
    .min(1),
  auditorOfRecord: z.object({
    auditorRef: z.string(),
    firmName: z.string(),
  }),
  priorAttestationRef: z.string().optional(),
  targetIssueDate: z.string(), // ISO-8601
  reviewers: z.object({
    generalCounselRef: z.string(),
    complianceOfficerRef: z.string(),
  }),
})

/**
 * Output — a GC + compliance-officer signed attestation packet: the control
 * inventory + evidence trail, the synthesised control narrative + gap flags,
 * the attestation statement + control deviations + remediation plan, the
 * dual-reviewer audit, and pointers to the emitted attestation packet +
 * audit-trail artefacts.
 */
export const AttestationPacketOutputSchema = z.object({
  cycleId: z.string(),
  framework: z.string(),
  controlInventory: z
    .array(
      z.object({
        controlId: z.string(),
        controlName: z.string(),
        controlObjective: z.string(),
        currentStatus: z.enum(['effective', 'partially-effective', 'ineffective', 'not-tested']),
        evidenceCitations: z
          .array(
            z.object({
              evidenceId: z.string(),
              evidenceKind: z.enum([
                'system-log',
                'configuration-snapshot',
                'policy-document',
                'training-record',
                'screenshot',
                'review-attestation',
              ]),
              sourceSystemRef: z.string(),
              capturedAt: z.string(),
            })
          )
          .min(0),
      })
    )
    .min(1),
  controlNarrative: z.object({
    summaryMarkdown: z.string(),
    gapsIdentified: z
      .array(
        z.object({
          gapId: z.string(),
          controlId: z.string(),
          gapDescription: z.string(),
          severity: z.enum(['low', 'med', 'high', 'blocker']),
        })
      )
      .min(0),
  }),
  attestationStatement: z.object({
    summaryMarkdown: z.string(),
    overallAssertion: z.enum([
      'effective',
      'effective-with-deviations',
      'qualified',
      'unable-to-attest',
    ]),
    controlDeviations: z
      .array(
        z.object({
          deviationId: z.string(),
          controlId: z.string(),
          deviationDescription: z.string(),
          rootCause: z.string(),
          impactAssessment: z.string(),
        })
      )
      .min(0),
    remediationPlan: z
      .array(
        z.object({
          remediationId: z.string(),
          deviationId: z.string(),
          plannedAction: z.string(),
          ownerRef: z.string(),
          targetCompletionAt: z.string(),
        })
      )
      .min(0),
  }),
  reviews: z.object({
    generalCounsel: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    }),
    complianceOfficer: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    }),
  }),
  artefacts: z.object({
    attestationPacketUrl: z.string(),
    auditTrailUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type AttestationCycleInput = z.infer<typeof AttestationCycleInputSchema>
export type AttestationPacketOutput = z.infer<typeof AttestationPacketOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_auditCycleTime: RewardSignal = {
  keyResultRef: 'kr:compliance-attestation-author:audit-cycle-time-and-finding-remediation-rate',
}
const kr_evidenceFanInCoverage: RewardSignal = {
  keyResultRef: 'kr:compliance-attestation-author:evidence-fan-in-coverage',
}
const kr_controlNarrativeQuality: RewardSignal = {
  keyResultRef: 'kr:compliance-attestation-author:control-narrative-quality',
}
const kr_attestationDefensibility: RewardSignal = {
  keyResultRef: 'kr:compliance-attestation-author:attestation-defensibility',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:compliance-attestation-author:emit-latency',
}

// ============================================================================
// Compliance Attestation Author Service
// ============================================================================

/**
 * Compliance Attestation Author — quarterly attestation cycle (or auditor
 * evidence request) → GC + compliance-officer signed attestation packet
 * with control narrative, deviation flags, and remediation plan as a Service.
 *
 * Cascade: fetch-control-status-and-evidence-trail-and-prior-attestations (Code, fan-in)
 *        → synthesize-control-narrative-with-evidence-citations-and-flag-gaps (Generative)
 *        → draft-attestation-statement-and-control-deviations-and-remediation-plan (Generative)
 *        → gc-and-compliance-officer-review-and-sign (Human, regulatory rationale)
 *        → emit-attestation-packet-and-audit-trail (Code, fan-out).
 */
export const complianceAttestationAuthor: ServiceInstance<
  AttestationCycleInput,
  AttestationPacketOutput
> = Service.define<AttestationCycleInput, AttestationPacketOutput>({
  $id: 'svc:compliance-attestation-author',
  name: 'Compliance Attestation Author',
  promise:
    'Every attestation cycle (SOC2 / ISO27001 / HIPAA / PCI-DSS / CMMC) ships with a GC + compliance-officer signed packet — control inventory + evidence citations + deviation flags + remediation plan — so audit-cycle time falls below the prior-baseline and finding-to-remediation rate holds at-or-above the prior cycle.',
  audience: 'business',
  archetype: 'quality-review',
  schema: { input: AttestationCycleInputSchema, output: AttestationPacketOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-control-status-and-evidence-trail-and-prior-attestations',
        reward: kr_evidenceFanInCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-control-narrative-with-evidence-citations-and-flag-gaps',
        reward: kr_controlNarrativeQuality,
      }),
      Generative({
        name: 'draft-attestation-statement-and-control-deviations-and-remediation-plan',
        reward: kr_attestationDefensibility,
      }),
      Human({
        name: 'gc-and-compliance-officer-review-and-sign',
        // `regulatory` rationale: regulatory-binding-on-attestation
        // authority sits with the GC (and the compliance-officer for the
        // control-evidence-attestation envelope). The gate stays human
        // regardless of model accuracy.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-attestation-packet-and-audit-trail',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'control-registry.read',
      'evidence-store.read',
      'system-graph.read',
      'identity-provider.read',
      'log-store.read',
      'prior-attestations.read',
      'attestation-engine.write',
      'audit-trail.write',
      'docs.write',
    ],
    // Attestation authoring: clarification disabled — the cascade synthesises
    // from the control registry + evidence store + system graph + prior
    // attestations; the GC + compliance-officer review step is the single
    // human contact point in the cascade.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Full-scope SOC2-type-2 cycles escalate the synthesis step to a
        // senior compliance-counsel supervisor before the routine GC +
        // compliance-officer review (the GC + compliance-officer still
        // sign, but the supervisor backstops the synthesis on the highest-
        // stakes scope — type-2 attestations carry per-control operating-
        // effectiveness assertions across the full attestation period).
        when: 'framework == "soc2-type-2" && scope == "full-scope"',
        action: 'escalate',
      },
      {
        // Every cycle routes through GC + compliance-officer review before
        // the attestation packet emits; OutcomeContract enforces the
        // compliance-officer signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'gc-and-compliance-officer-review-and-sign',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:compliance-attestation-author-review',
    personas: [
      // Evidence-completeness reviewer — pedantic check that every in-scope
      // control has at least one evidence citation, every cited evidence
      // resolves to a source-system reference (no orphan citations), every
      // gap flagged ties to a specific control, and no in-scope control was
      // silently skipped. The risk this guards against is "control attested
      // without evidence" — the most common audit-finding pattern.
      Personas.pedantic({
        domain: 'evidence-completeness',
        rubric: [
          'every-in-scope-control-has-evidence-citation',
          'every-evidence-citation-resolves-to-source-system',
          'every-gap-ties-to-specific-control',
          'no-silent-control-skips',
          'evidence-capture-dates-within-attestation-period',
        ],
        name: 'evidence-completeness-checker',
      }),
      // Control-coverage reviewer — adversarially probes whether the
      // attestation covers the full framework control set (SOC2 trust-
      // services categories, ISO 27001 Annex A controls, HIPAA Security
      // Rule safeguards, etc.) vs. cherry-picked subset hand-waving.
      Personas.skeptic({
        domain: 'control-coverage',
        focus: [
          'every-framework-control-evaluated',
          'no-cherry-picked-subset',
          'in-scope-systems-cover-control-objective',
          'compensating-controls-named-when-claimed',
          'no-hand-waves',
        ],
        name: 'control-coverage-reviewer',
      }),
      // Attestation-defensibility reviewer — adversarial probe specifically
      // on the attestation-statement language: does the assertion match the
      // evidence + deviations? Is the qualified-vs-unqualified call
      // defensible? Are deviations remediated or scoped-out properly?
      Personas.skeptic({
        domain: 'attestation-defensibility',
        focus: [
          'assertion-matches-evidence-and-deviations',
          'qualified-vs-unqualified-call-defensible',
          'every-deviation-has-remediation-or-scope-out-rationale',
          'no-overstated-assertions',
        ],
        name: 'attestation-defensibility-reviewer',
      }),
      // Regulatory-compliance reviewer — SOX-tier pass over the attestation
      // statement (financially-material attestations carry SOX-404 ICFR
      // overlap; the persona catches ICFR-relevant control gaps before the
      // compliance-officer signs).
      Personas.regulatoryCompliance({ regulator: 'sox' }),
      // Factual-accuracy reviewer — every load-bearing claim in the
      // control narrative + attestation statement must cite first-party
      // evidence (system logs, control documents) or industry-standard
      // sources (SOC2 TSC, ISO 27001 Annex A, NIST SP 800-53 mappings);
      // peer-reviewed or government sources don't apply at this layer.
      Personas.factualAccuracy({
        citationRequired: true,
        sourceTypes: ['first-party', 'industry-standard'],
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:compliance-attestation-author:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-compliance-officer',
    seller: 'svc:compliance-attestation-author',
    serviceRef: 'svc:compliance-attestation-author',
    // Compliance-officer signs every attestation packet before it ships to
    // the auditor — control-evidence-attestation authority cannot be
    // delegated.
    predicate: AND(
      SchemaMatch(AttestationPacketOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['compliance-officer'] })
    ),
    amount: { amount: 199900n, currency: 'USD' },
    // 30-day SLA — attestation cycles run on quarterly rhythms; the packet
    // lands inside one month so the auditor-of-record has runway.
    timeoutDays: 30,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: {
      id: 'compliance-attestation-author-monthly',
      amount: 199900n,
      currency: 'USD',
      interval: 'month',
    },
    // Metered overage — each completed attestation cycle charges $999 above
    // the steady-state evidence-curation subscription. The metering runtime
    // resolves `attestation-cycle-completed` to cycle-emit events and lines
    // them on the monthly invoice.
    metered: [
      {
        event: 'attestation-cycle-completed',
        amount: 99900n,
        description:
          'Per-cycle attestation packet emitted (SOC2 / ISO27001 / HIPAA / PCI-DSS / CMMC) above the steady-state subscription baseline.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 18000n, perApiCall: 24n },
  reward: kr_auditCycleTime,

  lineage: {
    cellRef: 'business.org.ai/cells/compliance-officer/compliance-attestation-author',
    icpContextProblemRef: 'icp:compliance-attestation-author:v1',
    foundingHypothesisRef: 'fh:compliance-attestation-author:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
