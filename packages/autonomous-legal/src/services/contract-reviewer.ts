/**
 * Contract Reviewer Service — incoming third-party contract review for the
 * legal catalog.
 *
 * Distinguishing shape vs. siblings (`policy-impact-analyzer`,
 * `ip-disclosure-triage`):
 *   - `quality-review` archetype — the artefact is a GC-or-deputy-signed
 *     redlined contract + risk memo against the company's playbook, not a
 *     forward-looking jurisdictional impact memo or an invention-disclosure
 *     triage decision;
 *   - 5-step cascade: Code fan-in (extract clauses + counterparty info) →
 *     Generative (check against company policy + flag deviations) →
 *     Generative (draft redlines + risk memo) → Human (GC-or-deputy review
 *     and sign) → Code (emit redlined doc + comparison tracker);
 *   - `Pricing.perInvocation` 3 tiers keyed on contract complexity — simple-
 *     NDA / standard-MSA / complex-SOW ($199 / $799 / $2,499) — a single NDA
 *     is worth less than a complex SOW with custom IP / data clauses;
 *   - declarative HITL = mandatory GC-or-deputy approval Human Function
 *     (the GC owns external-binding-commitment authority — only the GC can
 *     sign off on contractual commitments to third parties), plus
 *     OutcomeContract requires GC signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(policy-coverage +
 *     risk-flag-completeness + GDPR-regulatoryCompliance + factualAccuracy)
 *     + HumanSign(GC))`.
 *
 * Per design v3 §3 (Catalog HOW legal) + §6 (binding triggers, conditional
 * HumanSign) + §7 (per-invocation pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `contract-cycle-time-reduction` — the compound
 * metric every in-house legal team optimises against (the reviewer is worth
 * running iff time-from-incoming-contract-to-counter-redline drops vs. the
 * pre-Service baseline, holding redline-quality flat or improving).
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
 * Input — an incoming third-party contract uploaded to the legal intake
 * channel. Tight: 7 fields cover the contract identity, the contract
 * type / declared complexity (so the per-invocation tier is resolvable at
 * intake), the counterparty identity, the deal context (the internal owner
 * + business unit + estimated dollar value), the source-document pointer the
 * cascade fans-in against, the company-playbook reference the policy-check
 * step grades against, and the assigned GC-or-deputy reviewer.
 */
export const ContractIntakeInputSchema = z.object({
  contractId: z.string(),
  contractType: z.enum([
    'nda',
    'msa',
    'sow',
    'dpa',
    'order-form',
    'partnership',
    'license',
    'amendment',
  ]),
  declaredComplexity: z.enum(['simple-NDA', 'standard-MSA', 'complex-SOW']),
  counterparty: z.object({
    legalName: z.string(),
    jurisdictionOfIncorporation: z.string(),
    counterpartyDomain: z.string().optional(),
    isExistingVendor: z.boolean(),
  }),
  dealContext: z.object({
    internalOwnerRef: z.string(),
    businessUnit: z.string(),
    estimatedAnnualValueCents: z.bigint(),
    targetSignByDate: z.string(), // ISO-8601
  }),
  sourceDocument: z.object({
    documentUrl: z.string(),
    documentSha256: z.string(),
    pageCount: z.number().int().positive(),
  }),
  playbookRef: z.string(),
  assignedReviewerRef: z.string(),
})

/**
 * Output — a GC-or-deputy-signed contract review: the extracted clause
 * inventory + counterparty profile, the policy-deviation flags, the
 * drafted redlines + risk memo, the GC review audit, and pointers to the
 * emitted redlined document + comparison-tracker artefacts.
 */
export const ContractReviewOutputSchema = z.object({
  contractId: z.string(),
  extracted: z.object({
    counterpartyLegalName: z.string(),
    governingLaw: z.string().optional(),
    venue: z.string().optional(),
    clauseInventory: z
      .array(
        z.object({
          clauseId: z.string(),
          clauseType: z.string(),
          excerpt: z.string(),
          pageRef: z.number().int().positive(),
        })
      )
      .min(1),
  }),
  policyDeviations: z
    .array(
      z.object({
        deviationId: z.string(),
        clauseId: z.string(),
        playbookRuleRef: z.string(),
        severity: z.enum(['low', 'med', 'high', 'blocker']),
        rationale: z.string(),
      })
    )
    .min(0),
  redlines: z
    .array(
      z.object({
        redlineId: z.string(),
        clauseId: z.string(),
        action: z.enum(['delete', 'replace', 'insert', 'request-clarification']),
        proposedLanguage: z.string(),
        rationale: z.string(),
        citationRef: z.string().optional(),
      })
    )
    .min(0),
  riskMemo: z.object({
    summaryMarkdown: z.string(),
    topRisks: z
      .array(
        z.object({
          riskId: z.string(),
          description: z.string(),
          severity: z.enum(['low', 'med', 'high', 'blocker']),
          mitigation: z.string(),
        })
      )
      .min(0),
    overallRecommendation: z.enum(['sign-as-is', 'sign-with-redlines', 'escalate-to-GC', 'reject']),
  }),
  gcReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    approvedRedlineIds: z.array(z.string()),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  artefacts: z.object({
    redlinedDocumentUrl: z.string(),
    comparisonTrackerUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type ContractIntakeInput = z.infer<typeof ContractIntakeInputSchema>
export type ContractReviewOutput = z.infer<typeof ContractReviewOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_contractCycleTime: RewardSignal = {
  keyResultRef: 'kr:contract-reviewer:contract-cycle-time-reduction',
}
const kr_extractionCoverage: RewardSignal = {
  keyResultRef: 'kr:contract-reviewer:extraction-coverage',
}
const kr_policyCoverage: RewardSignal = {
  keyResultRef: 'kr:contract-reviewer:policy-coverage',
}
const kr_redlineQuality: RewardSignal = {
  keyResultRef: 'kr:contract-reviewer:redline-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:contract-reviewer:emit-latency',
}

// ============================================================================
// Contract Reviewer Service
// ============================================================================

/**
 * Contract Reviewer — vendor MSA / NDA / SOW received → GC-or-deputy-signed
 * redline + risk memo as a Service.
 *
 * Cascade: extract-clauses-and-counterparty-info (Code, fan-in)
 *        → check-against-company-policy-and-flag-deviations (Generative)
 *        → draft-redlines-and-risk-memo (Generative)
 *        → gc-or-deputy-review-and-sign (Human, regulatory rationale)
 *        → emit-redlined-doc-and-comparison-tracker (Code, fan-out).
 */
export const contractReviewer: ServiceInstance<ContractIntakeInput, ContractReviewOutput> =
  Service.define<ContractIntakeInput, ContractReviewOutput>({
    name: 'Contract Reviewer',
    promise:
      'Every incoming third-party contract gets a GC-signed redline + risk memo within hours, not days — clause inventory + policy-deviation flags + proposed redlines + ranked risks — so the deal cycle is bounded by counterparty turnaround, not internal review queue.',
    audience: 'business',
    archetype: 'quality-review',
    schema: { input: ContractIntakeInputSchema, output: ContractReviewOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'extract-clauses-and-counterparty-info',
          reward: kr_extractionCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'check-against-company-policy-and-flag-deviations',
          reward: kr_policyCoverage,
        }),
        Generative({
          name: 'draft-redlines-and-risk-memo',
          reward: kr_redlineQuality,
        }),
        Human({
          name: 'gc-or-deputy-review-and-sign',
          // `regulatory` rationale: external-binding-commitment authority
          // sits with the GC — only the GC (or designated deputy) can sign
          // off on contractual commitments to third parties. The gate stays
          // human regardless of model accuracy.
          rationale: 'regulatory',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-redlined-doc-and-comparison-tracker',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'contract-intake.read',
        'contract-storage.read',
        'contract-storage.write',
        'company-playbook.read',
        'counterparty-registry.read',
        'redline-engine.write',
        'docs.write',
      ],
      // Contract review: clarification disabled — the cascade synthesises
      // from the contract document + playbook + counterparty registry; the
      // GC review step is the single human contact point in the cascade.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Any deviation flagged as `blocker` escalates the redline-draft
          // step to a senior GC supervisor before the routine GC review (the
          // GC still signs, but the supervisor backstops the synthesis on the
          // highest-stakes deviations — non-standard limitation-of-liability,
          // unlimited indemnity, IP-assignment to counterparty, etc).
          when: 'policyDeviations.some(d => d.severity == "blocker")',
          action: 'escalate',
        },
        {
          // Every contract routes through GC review before the redlined doc
          // emits; OutcomeContract enforces the signature, the trigger primes
          // the queue.
          when: 'true',
          action: 'route-to',
          target: 'gc-or-deputy-review-and-sign',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:contract-reviewer-review',
      personas: [
        // Policy-coverage reviewer — pedantic check that every playbook rule
        // applicable to the contract type was evaluated against the contract
        // and either passed or surfaced a deviation. The risk this guards
        // against is "silent omission" — a clause that should have been
        // policy-checked but wasn't.
        Personas.pedantic({
          domain: 'policy-coverage',
          rubric: [
            'every-applicable-playbook-rule-evaluated',
            'every-deviation-cites-the-playbook-rule',
            'no-silent-omissions',
            'severity-grading-matches-playbook-rubric',
          ],
          name: 'policy-coverage-checker',
        }),
        // Risk-flag-completeness reviewer — adversarially probes whether the
        // top-risks list captures the actual deal-breakers (cap-on-liability,
        // indemnity scope, IP assignment, data-processing scope, audit
        // rights, change-of-control) vs. surface-level "general business
        // risk" hand-waving.
        Personas.skeptic({
          domain: 'risk-flag-completeness',
          focus: [
            'cap-on-liability-evaluated',
            'indemnity-scope-evaluated',
            'IP-assignment-evaluated',
            'data-processing-scope-evaluated',
            'audit-rights-evaluated',
            'change-of-control-evaluated',
            'no-hand-waves',
          ],
          name: 'risk-flag-completeness-reviewer',
        }),
        // Regulatory-compliance reviewer — GDPR-tier pass over the proposed
        // redlines + risk memo. Catches DPA-side issues (lawful-basis,
        // sub-processor disclosure, cross-border transfer mechanism) before
        // the GC signs.
        Personas.regulatoryCompliance({ regulator: 'gdpr' }),
        // Factual-accuracy reviewer — every load-bearing claim in the risk
        // memo (clause excerpts, playbook citations, jurisdictional
        // references) must carry a citation back to the source document or
        // the playbook. The risk this guards against is "fabricated clause
        // text" or "misattributed playbook rule".
        Personas.factualAccuracy({ citationRequired: true }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:contract-reviewer:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-general-counsel',
      seller: 'svc:contract-reviewer',
      serviceRef: 'svc:contract-reviewer',
      // GC-or-deputy signs every redlined contract before it ships back to
      // the counterparty — external-binding-commitment authority cannot be
      // delegated.
      predicate: AND(
        SchemaMatch(ContractReviewOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['general-counsel'] })
      ),
      // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
      amount: { amount: 79900n, currency: 'USD' },
      // 2-day SLA — contract review needs to land inside the deal-cycle
      // window, not the next sprint.
      timeoutDays: 2,
      onTimeout: 'escalate',
    },

    pricing: Pricing.perInvocation({
      tiers: [
        {
          id: 'simple-NDA',
          amount: 19900n,
          includedPerMonth: 12,
          overage: 19900n,
        },
        {
          id: 'standard-MSA',
          amount: 79900n,
          includedPerMonth: 6,
          overage: 79900n,
        },
        {
          id: 'complex-SOW',
          amount: 249900n,
          includedPerMonth: 2,
          overage: 249900n,
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 5000n, perApiCall: 12n },
    reward: kr_contractCycleTime,

    lineage: {
      cellRef: 'business.org.ai/cells/general-counsel/contract-reviewer',
      icpContextProblemRef: 'icp:contract-reviewer:v1',
      foundingHypothesisRef: 'fh:contract-reviewer:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
