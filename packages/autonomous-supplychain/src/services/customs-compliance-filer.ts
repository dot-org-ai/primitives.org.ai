/**
 * Customs Compliance Filer Service — cross-border customs declaration + HS-
 * code classification for the procurement / supply-chain catalog.
 *
 * Distinguishing shape vs. siblings (`vendor-onboarding-runbook`,
 * `purchase-order-router`, `inventory-reorder-planner`,
 * `supplier-risk-monitor`, `freight-cost-optimizer`):
 *   - `quality-review` archetype — the artefact is a trade-compliance-
 *     officer-attested customs declaration package (HS-code classifications
 *     with rationale + duty calculations + free-trade-eligibility checks +
 *     supporting-documentation checklist) ready for broker hand-off, not a
 *     vendor packet, a routing decision, a reorder plan, a risk narrative,
 *     or a freight routing plan;
 *   - 5-step cascade: Code fan-in (shipment manifest + product attributes +
 *     trade agreements + prior filings) → Generative (classify HS codes with
 *     rationale + rate-of-duty calc + free-trade-eligibility check) →
 *     Generative (draft customs declaration + supporting-documentation
 *     checklist) → Human (customs-broker-or-trade-compliance-officer review
 *     and attest) → Code fan-out (declaration package + broker handoff);
 *   - `Pricing.outcome` 3 tiers keyed on declared shipment-complexity band —
 *     simple-shipment / multi-line / restricted-goods ($199 / $799 / $2,999)
 *     — a single-line straightforward shipment is worth less to file than a
 *     multi-line shipment, and a restricted-goods shipment with export-
 *     control overlay is the highest-stakes tier;
 *   - declarative HITL = mandatory customs-broker-or-trade-compliance-
 *     officer review and attest (`regulatory` rationale because customs
 *     declarations are statutorily mandated to carry a licensed broker /
 *     trade-compliance-officer signature), plus OutcomeContract requires
 *     trade-compliance-officer signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(hs-code-accuracy +
 *     duty-calculation-precision + documentation-completeness + fincen-
 *     regulatoryCompliance + factual-accuracy) + HumanSign(trade-compliance-
 *     officer))`;
 *   - EvaluatorPanel includes `Personas.regulatoryCompliance({ regulator:
 *     'fincen' })` and `Personas.factualAccuracy({ citationRequired: true,
 *     sourceTypes: ['government'] })` because customs filings are FinCEN-
 *     adjacent (cross-border movement of goods + funds), and every HS-code
 *     classification + duty calculation must cite government tariff
 *     schedules / trade-agreement texts before the trade-compliance-officer
 *     attests.
 *
 * Per design v3 §3 (Catalog HOW supply-chain) + §6 (binding triggers,
 * mandatory HumanSign on regulatory rationale) + §7 (outcome pricing
 * factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `customs-rejection-rate-and-amendment-rate-
 * reduction` — the compound metric every cross-border supply-chain org
 * optimises against (the filer is worth running iff customs rejection rate
 * AND post-filing amendment rate drop vs. the pre-Service baseline; either
 * surrogate alone is insufficient — rejections are the first-order failure,
 * amendments are the second-order failure).
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
 * Input — a customs filing trigger from a shipment crossing a border or a
 * new product line entering a market. Tight: 8 fields cover the filing
 * identity, the trigger kind, the declared shipment-complexity band (so the
 * outcome-tier pricing is resolvable at intake), the shipment manifest, the
 * product-attribute slice, the trade-agreement context, the prior-filings
 * pointer, the assigned trade-compliance-officer, and the trigger stage
 * gating intake.
 */
export const CustomsFilingInputSchema = z.object({
  filingId: z.string(),
  triggerKind: z.enum(['shipment-crossing-border', 'new-product-line-entering-market']),
  declaredComplexityBand: z.enum(['simple-shipment', 'multi-line', 'restricted-goods']),
  shipmentManifest: z.object({
    manifestRef: z.string(),
    originCountry: z.string(),
    destinationCountry: z.string(),
    incoterm: z.enum(['EXW', 'FCA', 'FOB', 'CIF', 'CIP', 'DAP', 'DPU', 'DDP']),
    declaredValueUsd: z.number().nonnegative(),
    lines: z
      .array(
        z.object({
          lineId: z.string(),
          productRef: z.string(),
          quantity: z.number().positive(),
          unitValueUsd: z.number().nonnegative(),
          countryOfOrigin: z.string(),
        })
      )
      .min(1),
  }),
  productAttributes: z.object({
    productAttributeRegistryRef: z.string(),
    materialCompositionRefs: z.array(z.string()).default([]),
    endUseCategory: z.enum([
      'consumer',
      'industrial',
      'medical',
      'defense',
      'dual-use',
      'agricultural',
      'other',
    ]),
    restrictionFlags: z.array(
      z.enum([
        'export-controlled',
        'dual-use',
        'sanctioned-country-overlap',
        'requires-import-license',
        'agricultural-quarantine',
        'none',
      ])
    ),
  }),
  tradeContext: z.object({
    tradeAgreementRefs: z.array(z.string()).default([]),
    priorFilingsRef: z.string().optional(),
    customsBrokerRef: z.string(),
  }),
  assignedTradeComplianceOfficerRef: z.string(),
  triggerStage: z.literal('customs-filing-trigger'),
})

/**
 * Output — a trade-compliance-officer-attested customs declaration package:
 * the fetched shipment-manifest + product-attribute + trade-agreement + prior-
 * filings snapshot, the per-line HS-code classifications with rationale, the
 * duty calculations, the free-trade-eligibility checks, the drafted customs
 * declaration + supporting-documentation checklist, the trade-compliance-
 * officer attestation, and pointers to the emitted declaration package +
 * broker handoff.
 */
export const CustomsDeclarationOutputSchema = z.object({
  filingId: z.string(),
  contextSnapshot: z.object({
    snapshotIso: z.string(),
    shipmentManifestRef: z.string(),
    productAttributeRegistryRef: z.string(),
    tradeAgreementRefs: z.array(z.string()),
    priorFilingsRef: z.string().optional(),
  }),
  hsCodeClassifications: z
    .array(
      z.object({
        classificationId: z.string(),
        shipmentLineRef: z.string(),
        hsCode: z.string(),
        hsCodeRevision: z.string(),
        classificationRationaleMarkdown: z.string(),
        sourcesCited: z.array(z.string()).min(1),
        rateOfDutyPct: z.number().nonnegative(),
        dutyCalcUsd: z.number().nonnegative(),
        freeTradeEligibility: z.object({
          eligibleAgreementRefs: z.array(z.string()),
          ineligibleReasons: z.array(z.string()),
          claimedReductionPct: z.number().nonnegative(),
        }),
      })
    )
    .min(1),
  customsDeclaration: z.object({
    declarationDraftRef: z.string(),
    declaredTotalDutyUsd: z.number().nonnegative(),
    declaredTotalValueUsd: z.number().nonnegative(),
    incotermAffirmed: z.string(),
    summaryMarkdown: z.string(),
  }),
  supportingDocumentationChecklist: z.object({
    requiredDocs: z
      .array(
        z.object({
          docId: z.string(),
          docKind: z.enum([
            'commercial-invoice',
            'packing-list',
            'bill-of-lading',
            'certificate-of-origin',
            'import-license',
            'export-license',
            'phyto-certificate',
            'safety-data-sheet',
            'other',
          ]),
          status: z.enum(['present', 'missing', 'pending-verification']),
          notes: z.string().optional(),
        })
      )
      .min(1),
    completenessPct: z.number().min(0).max(1),
  }),
  tradeComplianceOfficerAttestation: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['attest', 'attest-with-conditions', 'request-revision', 'reject']),
    conditions: z.array(z.string()),
    notes: z.string().optional(),
    attestedAt: z.string(),
  }),
  artefacts: z.object({
    declarationPackageRef: z.string(),
    brokerHandoffRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type CustomsFilingInput = z.infer<typeof CustomsFilingInputSchema>
export type CustomsDeclarationOutput = z.infer<typeof CustomsDeclarationOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_rejectionAndAmendmentRate: RewardSignal = {
  keyResultRef: 'kr:customs-compliance-filer:customs-rejection-rate-and-amendment-rate-reduction',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:customs-compliance-filer:intake-coverage',
}
const kr_classificationAccuracy: RewardSignal = {
  keyResultRef: 'kr:customs-compliance-filer:classification-accuracy',
}
const kr_documentationCompleteness: RewardSignal = {
  keyResultRef: 'kr:customs-compliance-filer:documentation-completeness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:customs-compliance-filer:emit-latency',
}

// ============================================================================
// Customs Compliance Filer Service
// ============================================================================

/**
 * Customs Compliance Filer — shipment-crossing-border / new-product-line-
 * entering-market trigger → trade-compliance-officer-attested customs
 * declaration package (HS-code classifications + duty calculations + free-
 * trade-eligibility check + supporting-documentation checklist) ready for
 * broker hand-off as a Service.
 *
 * Cascade: fetch-shipment-manifest-product-attributes-trade-agreements-and-prior-filings (Code, fan-in)
 *        → classify-HS-codes-with-rationale-rate-of-duty-calc-and-free-trade-eligibility-check (Generative)
 *        → draft-customs-declaration-and-supporting-documentation-checklist (Generative)
 *        → customs-broker-or-trade-compliance-officer-review-and-attest (Human, regulatory rationale)
 *        → emit-declaration-package-and-broker-handoff (Code, fan-out).
 */
export const customsComplianceFiler: ServiceInstance<CustomsFilingInput, CustomsDeclarationOutput> =
  Service.define<CustomsFilingInput, CustomsDeclarationOutput>({
    name: 'Customs Compliance Filer',
    promise:
      'Every cross-border filing trigger lands a trade-compliance-officer-attested customs declaration package — HS-code classifications with cited rationale, duty calculations, free-trade-eligibility check, and supporting-documentation checklist — ready for broker hand-off, so customs rejection and amendment rates drop against the pre-Service baseline.',
    audience: 'business',
    archetype: 'quality-review',
    schema: {
      input: CustomsFilingInputSchema,
      output: CustomsDeclarationOutputSchema,
    },

    binding: {
      cascade: [
        Code({
          name: 'fetch-shipment-manifest-product-attributes-trade-agreements-and-prior-filings',
          reward: kr_intakeCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'classify-HS-codes-with-rationale-rate-of-duty-calc-and-free-trade-eligibility-check',
          reward: kr_classificationAccuracy,
        }),
        Generative({
          name: 'draft-customs-declaration-and-supporting-documentation-checklist',
          reward: kr_documentationCompleteness,
        }),
        Human({
          name: 'customs-broker-or-trade-compliance-officer-review-and-attest',
          // `regulatory` rationale: customs declarations are statutorily
          // mandated to carry a licensed customs-broker / trade-compliance-
          // officer attestation. The trade-compliance-officer owns the cross-
          // border declaration envelope; the licensed customs-broker is the
          // statutorily named alternative attestor. Neither delegates to the
          // cascade.
          rationale: 'regulatory',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-declaration-package-and-broker-handoff',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'shipment-system.read',
        'product-attribute-registry.read',
        'trade-agreement-registry.read',
        'prior-filings-registry.read',
        'tariff-schedule.read',
        'customs-broker-channel.write',
        'declaration-package.write',
        'audit-log.write',
      ],
      // Customs filing: clarification disabled — the cascade synthesises from
      // the shipment manifest + product attributes + trade-agreement context;
      // the trade-compliance-officer review-and-attest step is the single
      // human contact point in the cascade.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Restricted-goods filings escalate the classification + declaration
          // steps to a senior trade-compliance supervisor before the routine
          // trade-compliance-officer review (the officer still attests, but
          // the supervisor backstops the synthesis on the highest-stakes tier
          // — export-controlled, dual-use, or sanctioned-country-overlap
          // shipments).
          when: 'declaredComplexityBand == "restricted-goods"',
          action: 'escalate',
        },
        {
          // Every filing routes through trade-compliance-officer review-and-
          // attest before the declaration package emits and the broker hand-
          // off fires; OutcomeContract enforces the trade-compliance-officer
          // signature, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'customs-broker-or-trade-compliance-officer-review-and-attest',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:customs-compliance-filer-review',
      personas: [
        // HS-code-accuracy reviewer — pedantic check that every shipment line
        // carries an HS-code classification with a cited rationale, that the
        // HS-code revision is named (so a tariff update doesn't silently
        // misclassify), and that no line is silently skipped. The risk this
        // guards against is "rejected-at-customs because a line shipped with
        // a stale-revision HS code".
        Personas.pedantic({
          domain: 'hs-code-accuracy',
          rubric: [
            'every-shipment-line-classified',
            'every-classification-cites-rationale-and-source',
            'hs-code-revision-named',
            'restriction-flags-considered-in-classification',
            'no-silent-line-skips',
          ],
          name: 'hs-code-accuracy-checker',
        }),
        // Duty-calculation-precision reviewer — adversarially probes whether
        // each line's `dutyCalcUsd` reconciles against the cited
        // `rateOfDutyPct` and the line's declared value, whether free-trade-
        // eligibility reductions are applied consistently, and whether the
        // declared total duty matches the sum of per-line duties.
        Personas.skeptic({
          domain: 'duty-calculation-precision',
          focus: [
            'per-line-duty-reconciles-with-rate-and-value',
            'free-trade-reductions-applied-consistently',
            'declared-total-duty-equals-sum-of-line-duties',
            'no-rounding-drift-in-totals',
            'rate-of-duty-traceable-to-tariff-schedule',
          ],
          name: 'duty-calculation-precision-reviewer',
        }),
        // Documentation-completeness reviewer — adversarially probes the
        // supporting-documentation checklist for missing required docs given
        // the shipment context (e.g. agricultural shipments require phyto-
        // certificates; restricted goods require import / export licenses;
        // free-trade claims require certificates of origin).
        Personas.skeptic({
          domain: 'documentation-completeness',
          focus: [
            'agricultural-shipments-require-phyto-cert',
            'restricted-goods-require-license',
            'free-trade-claims-require-certificate-of-origin',
            'completeness-pct-reconciles-with-docs',
            'missing-docs-named-in-conditions',
          ],
          name: 'documentation-completeness-reviewer',
        }),
        // FinCEN regulatory-compliance reviewer — customs filings are FinCEN-
        // adjacent (cross-border movement of goods + funds). Every filing
        // must survive a FinCEN-rule audit before the trade-compliance-
        // officer attests.
        Personas.regulatoryCompliance({
          regulator: 'fincen',
          name: 'fincen-regulatoryCompliance-reviewer',
        }),
        // Factual-accuracy reviewer — every load-bearing classification +
        // duty + eligibility claim must carry a citation, and citations
        // must come from government sources (tariff schedules, trade-
        // agreement texts). First-party / industry-standard sources are not
        // sufficient for a customs attestation.
        Personas.factualAccuracy({
          citationRequired: true,
          sourceTypes: ['government'],
          name: 'factual-accuracy-reviewer',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:customs-compliance-filer:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-trade-compliance-officer',
      seller: 'svc:customs-compliance-filer',
      serviceRef: 'svc:customs-compliance-filer',
      // Trade-compliance-officer attests every customs declaration before the
      // broker hand-off fires — cross-border declaration authority is
      // statutorily reserved for licensed brokers / officers.
      predicate: AND(
        SchemaMatch(CustomsDeclarationOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['trade-compliance-officer'] })
      ),
      // Mid-tier amount; the per-tier outcome amounts are in `pricing.tiers`.
      amount: { amount: 79900n, currency: 'USD' },
      // 2-day SLA — customs declarations need to land inside two workdays so
      // shipment dwell time at the port doesn't compound the filing latency.
      timeoutDays: 2,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        {
          id: 'simple-shipment',
          amount: 19900n,
          currency: 'USD',
          description:
            'Simple shipment — single line, no restriction flags, single trade agreement. $199.',
        },
        {
          id: 'multi-line',
          amount: 79900n,
          currency: 'USD',
          description:
            'Multi-line shipment — multiple HS-code classifications, mixed origin, multi-agreement eligibility. $799.',
        },
        {
          id: 'restricted-goods',
          amount: 299900n,
          currency: 'USD',
          description:
            'Restricted-goods shipment — export-controlled / dual-use / sanctioned-country-overlap / import-license-required goods, highest-stakes attestation tier. $2,999.',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 10000n, perApiCall: 20n },
    reward: kr_rejectionAndAmendmentRate,

    lineage: {
      cellRef: 'business.org.ai/cells/supply-chain/customs-compliance-filer',
      icpContextProblemRef: 'icp:customs-compliance-filer:v1',
      foundingHypothesisRef: 'fh:customs-compliance-filer:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
