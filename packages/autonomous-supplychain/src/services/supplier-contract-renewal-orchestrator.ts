/**
 * Supplier Contract Renewal Orchestrator Service — supplier-contract renewal
 * cycle for the procurement / supply-chain catalog.
 *
 * Distinguishing shape vs. siblings (`vendor-onboarding-runbook`,
 * `purchase-order-router`, `inventory-reorder-planner`,
 * `supplier-risk-monitor`, `freight-cost-optimizer`,
 * `customs-compliance-filer`, `demand-forecast-synthesizer`,
 * `manufacturing-quality-incident-investigator`):
 *   - `multi-step-research` archetype — the artefact is a procurement-lead-
 *     and-finance-lead-signed renewal package (negotiation position +
 *     leverage analysis + walkaway thresholds + renewal proposal + RFP-or-
 *     renegotiation strategy + supplier-communication batch) backed by
 *     supplier-performance + spend-analysis + competing-quotes + market-
 *     benchmark evidence, not a vendor onboarding packet, a PO routing
 *     decision, a reorder plan, a risk narrative, a freight routing plan, a
 *     customs declaration, a demand forecast, or an RCA dossier;
 *   - 5-step cascade: Code fan-in (supplier perf + spend analysis +
 *     competing quotes + market benchmarks) → Generative (synthesise
 *     negotiation position + leverage analysis + walkaway thresholds) →
 *     Generative (draft renewal proposal + RFP-or-renegotiation strategy)
 *     → Human (procurement-lead + finance-lead review) → Code fan-out
 *     (emit renewal package + supplier-communication batch);
 *   - `Pricing.percentOf` keyed on the realised contract value — 0.5%
 *     (50 bps) of `contract-value`, capped at $50k per contract — the
 *     orchestrator's compensation tracks the value of the contract being
 *     renewed (bps-on-contract-value is the pricing convention every
 *     procurement-as-a-service vendor uses for renewal work);
 *   - declarative HITL = mandatory procurement-lead + finance-lead review
 *     (both `approval` rationale — the procurement-lead owns the supplier-
 *     relationship envelope, the finance-lead owns the spend-commitment
 *     envelope; both route through the single review step but neither role
 *     is mandated by a regulator), plus OutcomeContract requires
 *     procurement-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(leverage-analysis-
 *     soundness + walkaway-rationale + market-benchmark-recency +
 *     commercial-fit + budget-realism + contractual-clarity) +
 *     HumanSign(procurement-lead))`;
 *   - EvaluatorPanel includes `Personas.commercialFit({ dimensions:
 *     ['pricing-realism', 'unit-economics'] })`, `Personas.budgetRealism({
 *     budgetType: 'cost' })`, and `Personas.contractualClarity({
 *     contractType: 'msa', ambiguityTolerance: 'strict' })` because
 *     renewal packages carry explicit pricing-realism + unit-economics
 *     surfaces (every renewal must reconcile the negotiation position to
 *     the spend reality), explicit cost surfaces (every walkaway threshold
 *     must survive a budget-realism audit), and explicit contractual-
 *     clarity surfaces (the drafted renewal proposal is an MSA-class
 *     instrument and must survive a strict ambiguity audit before the
 *     procurement-lead signs).
 *
 * Per design v3 §3 (Catalog HOW supply-chain) + §6 (binding triggers,
 * mandatory HumanSign) + §7 (percent-of pricing factory with cap) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `renewal-cost-savings-and-cycle-time-improvement`
 * — the compound metric every procurement organisation optimises against
 * (the orchestrator is worth running iff renewal cost savings improve AND
 * cycle time drops vs. the pre-Service baseline; either surrogate alone is
 * insufficient — savings achieved on a six-month cycle that misses the
 * renewal window cost the org leverage; cycle-time gains that come at the
 * cost of weaker renewal terms erode unit economics).
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
 * Input — a supplier-contract renewal cycle triggered by an upcoming renewal
 * date inside the 90-day window. Tight: 8 fields cover the cycle identity,
 * the trigger kind, the supplier + contract under renewal, the data sources
 * the cascade fans-in over, the negotiation context (target levers + RFP
 * eligibility), the assigned procurement-lead + finance-lead, the renewal-
 * window deadline, and the trigger stage gating intake.
 */
export const ContractRenewalCycleInputSchema = z.object({
  cycleId: z.string(),
  triggerKind: z.enum([
    'renewal-window-90-day',
    'renewal-window-60-day',
    'renewal-window-30-day',
    'renegotiation-request',
  ]),
  supplierContract: z.object({
    supplierRef: z.string(),
    contractRef: z.string(),
    currentContractValueUsd: z.number().nonnegative(),
    contractStartIso: z.string(),
    contractEndIso: z.string(),
    contractKind: z.enum(['msa', 'sow', 'sales-order', 'license', 'service-agreement']),
  }),
  dataSources: z.object({
    supplierPerfSystemRef: z.string(),
    spendAnalysisSystemRef: z.string(),
    competingQuoteRegistryRef: z.string(),
    marketBenchmarkProviderRef: z.string(),
    benchmarkRecencyMonthsMax: z.number().int().positive(),
  }),
  negotiationContext: z.object({
    targetLevers: z
      .array(z.enum(['price', 'volume-discount', 'sla', 'payment-terms', 'term-length', 'scope']))
      .min(1),
    rfpEligible: z.boolean(),
    incumbentSwitchingCostUsd: z.number().nonnegative(),
  }),
  reviewers: z.object({
    procurementLeadRef: z.string(),
    financeLeadRef: z.string(),
  }),
  triggerStage: z.literal('contract-renewal-cycle'),
})

/**
 * Output — a procurement-lead-and-finance-lead-signed renewal package: the
 * fan-in evidence snapshot (supplier perf + spend + competing quotes +
 * market benchmarks), the negotiation position + leverage analysis +
 * walkaway thresholds, the drafted renewal proposal + RFP-or-renegotiation
 * strategy, the dual-reviewer sign-off audit, and pointers to the emitted
 * renewal package + supplier-communication batch.
 */
export const ContractRenewalPackageOutputSchema = z.object({
  cycleId: z.string(),
  evidenceSnapshot: z.object({
    snapshotIso: z.string(),
    supplierPerfWindowMonths: z.number().int().positive(),
    spendAnalysisWindowMonths: z.number().int().positive(),
    competingQuotesEvaluated: z.number().int().nonnegative(),
    marketBenchmarksEvaluated: z.number().int().nonnegative(),
    benchmarkOldestAgeMonths: z.number().int().nonnegative(),
  }),
  negotiationPosition: z.object({
    targetContractValueUsd: z.number().nonnegative(),
    targetSavingsUsd: z.number(),
    targetSavingsPct: z.number(),
    leverPriorities: z
      .array(
        z.object({
          lever: z.enum([
            'price',
            'volume-discount',
            'sla',
            'payment-terms',
            'term-length',
            'scope',
          ]),
          priority: z.enum(['high', 'medium', 'low']),
          rationaleMarkdown: z.string(),
        })
      )
      .min(1),
    positionNarrativeMarkdown: z.string(),
  }),
  leverageAnalysis: z.object({
    incumbentLeveragePoints: z.array(
      z.object({
        leverageId: z.string(),
        kind: z.enum([
          'spend-share',
          'multi-year-relationship',
          'integrated-tooling',
          'switching-cost',
          'reference-customer',
        ]),
        descriptionMarkdown: z.string(),
      })
    ),
    counterpartyLeveragePoints: z.array(
      z.object({
        leverageId: z.string(),
        kind: z.enum([
          'sole-source',
          'unique-capability',
          'regulatory-monopoly',
          'incumbent-data-lock-in',
          'short-renewal-runway',
        ]),
        descriptionMarkdown: z.string(),
      })
    ),
    leverageBalanceNarrativeMarkdown: z.string(),
  }),
  walkawayThresholds: z.object({
    walkawayContractValueUsd: z.number().nonnegative(),
    walkawayConditions: z
      .array(
        z.object({
          conditionId: z.string(),
          conditionKind: z.enum([
            'price-ceiling',
            'sla-floor',
            'payment-terms-floor',
            'scope-floor',
            'term-length-ceiling',
          ]),
          descriptionMarkdown: z.string(),
        })
      )
      .min(1),
    walkawayRationaleMarkdown: z.string(),
  }),
  renewalProposal: z.object({
    proposalDraftRef: z.string(),
    strategy: z.enum(['renegotiate-incumbent', 'rfp-multi-supplier', 'switch-to-alternative']),
    strategyRationaleMarkdown: z.string(),
    proposalSummaryMarkdown: z.string(),
  }),
  signOffs: z.object({
    procurementLead: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-conditions', 'request-revision', 'reject']),
      conditions: z.array(z.string()),
      notes: z.string().optional(),
      signedAt: z.string(),
    }),
    financeLead: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-conditions', 'request-revision', 'reject']),
      conditions: z.array(z.string()),
      notes: z.string().optional(),
      signedAt: z.string(),
    }),
  }),
  artefacts: z.object({
    renewalPackageRef: z.string(),
    supplierCommunicationBatchRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type ContractRenewalCycleInput = z.infer<typeof ContractRenewalCycleInputSchema>
export type ContractRenewalPackageOutput = z.infer<typeof ContractRenewalPackageOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_savingsAndCycleTime: RewardSignal = {
  keyResultRef:
    'kr:supplier-contract-renewal-orchestrator:renewal-cost-savings-and-cycle-time-improvement',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:supplier-contract-renewal-orchestrator:intake-coverage',
}
const kr_positionQuality: RewardSignal = {
  keyResultRef: 'kr:supplier-contract-renewal-orchestrator:position-quality',
}
const kr_proposalQuality: RewardSignal = {
  keyResultRef: 'kr:supplier-contract-renewal-orchestrator:proposal-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:supplier-contract-renewal-orchestrator:emit-latency',
}

// ============================================================================
// Supplier Contract Renewal Orchestrator Service
// ============================================================================

/**
 * Supplier Contract Renewal Orchestrator — 90-day-window renewal trigger →
 * procurement-lead-and-finance-lead-signed renewal package (negotiation
 * position + leverage analysis + walkaway thresholds + renewal proposal +
 * RFP-or-renegotiation strategy + supplier-communication batch) backed by
 * supplier-performance + spend-analysis + competing-quotes + market-
 * benchmark evidence as a Service.
 *
 * Cascade: fetch-supplier-perf-spend-analysis-competing-quotes-and-market-benchmarks (Code, fan-in)
 *        → synthesize-negotiation-position-leverage-analysis-and-walkaway-thresholds (Generative)
 *        → draft-renewal-proposal-and-rfp-or-renegotiation-strategy (Generative)
 *        → procurement-lead-and-finance-lead-review (Human, approval rationale)
 *        → emit-renewal-package-and-supplier-communication-batch (Code, fan-out).
 */
export const supplierContractRenewalOrchestrator: ServiceInstance<
  ContractRenewalCycleInput,
  ContractRenewalPackageOutput
> = Service.define<ContractRenewalCycleInput, ContractRenewalPackageOutput>({
  name: 'Supplier Contract Renewal Orchestrator',
  promise:
    'Every renewal-window trigger lands a procurement-lead-and-finance-lead-signed renewal package — negotiation position + leverage analysis + walkaway thresholds + renewal proposal + RFP-or-renegotiation strategy + supplier-communication batch — backed by supplier-perf + spend + competing-quote + market-benchmark evidence, so renewal cost savings improve and cycle time drops against the pre-Service baseline.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: {
    input: ContractRenewalCycleInputSchema,
    output: ContractRenewalPackageOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-supplier-perf-spend-analysis-competing-quotes-and-market-benchmarks',
        reward: kr_intakeCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-negotiation-position-leverage-analysis-and-walkaway-thresholds',
        reward: kr_positionQuality,
      }),
      Generative({
        name: 'draft-renewal-proposal-and-rfp-or-renegotiation-strategy',
        reward: kr_proposalQuality,
      }),
      Human({
        name: 'procurement-lead-and-finance-lead-review',
        // `approval` rationale: the procurement-lead owns the supplier-
        // relationship envelope; the finance-lead owns the spend-commitment
        // envelope. Both review every renewal package before it emits and
        // the supplier-communication batch fires. Neither role is regulator-
        // mandated, but both gates stay human regardless of model accuracy
        // because the downstream renewal commitments reshape multi-year
        // spend allocations.
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-renewal-package-and-supplier-communication-batch',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'supplier-perf-system.read',
      'spend-analysis-system.read',
      'competing-quote-registry.read',
      'market-benchmark-provider.read',
      'contract-registry.read',
      'renewal-package.write',
      'supplier-communication-channel.write',
      'audit-log.write',
    ],
    // Contract renewal: clarification disabled — the cascade synthesises
    // from supplier perf + spend + competing quotes + market benchmarks;
    // the procurement-lead + finance-lead review step is the single human
    // contact point in the cascade.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // 30-day-window renewal cycles escalate the position + proposal
        // steps to a senior procurement supervisor before the routine
        // procurement-lead + finance-lead review (the leads still sign,
        // but the supervisor backstops the synthesis on tight-window
        // cycles where the negotiation runway is already compressed).
        when: 'triggerKind == "renewal-window-30-day"',
        action: 'escalate',
      },
      {
        // Every cycle routes through procurement-lead + finance-lead
        // review before the renewal package emits and the supplier-
        // communication batch fires; OutcomeContract enforces the
        // procurement-lead signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'procurement-lead-and-finance-lead-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:supplier-contract-renewal-orchestrator-review',
    personas: [
      // Leverage-analysis-soundness reviewer — pedantic check that every
      // incumbent + counterparty leverage point cites a concrete kind and
      // description grounded in the fan-in evidence (spend share traces to
      // spend analysis; switching cost traces to negotiation context;
      // sole-source flag traces to competing-quote registry). The risk
      // this guards against is "leverage analysis that reads strategic
      // but doesn't reconcile to the evidence snapshot".
      Personas.pedantic({
        domain: 'leverage-analysis-soundness',
        rubric: [
          'every-incumbent-leverage-cites-evidence',
          'every-counterparty-leverage-cites-evidence',
          'spend-share-traces-to-spend-analysis',
          'switching-cost-traces-to-negotiation-context',
          'sole-source-traces-to-competing-quote-registry',
          'no-leverage-without-citation',
        ],
        name: 'leverage-analysis-soundness-checker',
      }),
      // Walkaway-rationale reviewer — adversarially probes whether the
      // walkaway contract value, the walkaway conditions, and the
      // walkaway rationale reconcile to the negotiation context (target
      // levers + switching cost) and to the leverage balance. The risk
      // this guards against is "walkaway thresholds that look credible
      // but don't reconcile to the underlying spend / leverage reality".
      Personas.skeptic({
        domain: 'walkaway-rationale',
        focus: [
          'walkaway-value-reconciles-with-current-and-target',
          'walkaway-conditions-cover-target-levers',
          'walkaway-rationale-cites-leverage-balance',
          'no-walkaway-condition-without-rationale',
          'walkaway-respects-switching-cost',
        ],
        name: 'walkaway-rationale-reviewer',
      }),
      // Market-benchmark-recency reviewer — adversarial probe that the
      // benchmarks evaluated in the evidence snapshot are within the
      // recency window declared in the input (`benchmarkRecencyMonthsMax`),
      // that the oldest benchmark age is reported, and that stale
      // benchmarks are excluded from the position synthesis. The risk
      // this guards against is "renewal positions anchored to two-year-
      // old benchmarks that no longer reflect market clearing prices".
      Personas.skeptic({
        domain: 'market-benchmark-recency',
        focus: [
          'oldest-benchmark-age-reported',
          'benchmarks-within-recency-window',
          'no-stale-benchmarks-anchoring-position',
          'benchmark-set-size-disclosed',
          'recency-floor-respected-end-to-end',
        ],
        name: 'market-benchmark-recency-reviewer',
      }),
      // Commercial-fit reviewer — renewal packages carry explicit pricing-
      // realism + unit-economics surfaces. Every renewal must reconcile
      // the negotiation position to the spend reality (pricing-realism)
      // and the unit-economics implied by the proposed deltas (unit-
      // economics). Reject on absence.
      Personas.commercialFit({
        dimensions: ['pricing-realism', 'unit-economics'],
        name: 'commercial-fit-reviewer',
      }),
      // Budget-realism reviewer — every walkaway threshold + target
      // contract value carries explicit cost claims that must survive a
      // cost-axis realism audit before the finance-lead signs.
      Personas.budgetRealism({
        budgetType: 'cost',
        name: 'budget-realism-checker',
      }),
      // Contractual-clarity reviewer — the drafted renewal proposal is an
      // MSA-class instrument and must survive a strict ambiguity audit
      // before the procurement-lead signs. Strict tier flags every
      // ambiguous defined term, every undefined who/when/how clause, and
      // every missing remedy.
      Personas.contractualClarity({
        contractType: 'msa',
        ambiguityTolerance: 'strict',
        name: 'contractual-clarity-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:supplier-contract-renewal-orchestrator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-procurement-lead',
    seller: 'svc:supplier-contract-renewal-orchestrator',
    serviceRef: 'svc:supplier-contract-renewal-orchestrator',
    // Procurement-lead signs every renewal package before it emits and the
    // supplier-communication batch fires — supplier-relationship + spend-
    // commitment authority cannot be delegated to the cascade.
    predicate: AND(
      SchemaMatch(ContractRenewalPackageOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['procurement-lead'] })
    ),
    // Mid-tier amount placeholder; per-cycle billing resolves through the
    // percent-of pricing factory below at settlement time.
    amount: { amount: 500000n, currency: 'USD' },
    // 14-day SLA — renewal cycles need to land inside two workweeks so the
    // negotiation runway absorbs at least one back-and-forth before the
    // renewal-window deadline.
    timeoutDays: 14,
    onTimeout: 'escalate',
  },

  // Percent-of pricing — 0.5% (50 basis points) of the realised contract
  // value, capped at $50k per contract. The metering runtime resolves the
  // `contract-value` basis to the realised renewed-contract USD at
  // settlement time and computes the charge as
  // `(contract_value * 50) / 10000`, clamped by `cap` at $50k. Bps-on-
  // contract-value is the pricing convention every procurement-as-a-service
  // vendor uses for renewal work — the orchestrator's compensation tracks
  // the value of the contract being renewed.
  pricing: Pricing.percentOf({
    basis: 'contract-value',
    rateBasisPoints: 50,
    cap: { amount: 5_000_000n, currency: 'USD' },
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 14000n, perApiCall: 28n },
  reward: kr_savingsAndCycleTime,

  lineage: {
    cellRef: 'business.org.ai/cells/supply-chain/supplier-contract-renewal-orchestrator',
    icpContextProblemRef: 'icp:supplier-contract-renewal-orchestrator:v1',
    foundingHypothesisRef: 'fh:supplier-contract-renewal-orchestrator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
