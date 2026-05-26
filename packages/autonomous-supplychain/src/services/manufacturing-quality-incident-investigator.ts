/**
 * Manufacturing Quality Incident Investigator Service — production-quality-
 * incident root-cause-analysis (RCA) for the procurement / supply-chain
 * catalog.
 *
 * Distinguishing shape vs. siblings (`vendor-onboarding-runbook`,
 * `purchase-order-router`, `inventory-reorder-planner`,
 * `supplier-risk-monitor`, `freight-cost-optimizer`,
 * `customs-compliance-filer`, `demand-forecast-synthesizer`):
 *   - `multi-step-research` archetype — the artefact is a quality-manager-
 *     and-plant-manager-signed RCA dossier (failure-mode classification +
 *     likely root causes + impact blast-radius + corrective + preventive
 *     actions + customer-comms needs) backed by traceable production-batch
 *     and supplier-lot evidence, not a vendor packet, a routing decision, a
 *     reorder plan, a risk narrative, a freight routing plan, a customs
 *     declaration, or a demand forecast;
 *   - 5-step cascade: Code fan-in (incident data + production-batch records
 *     + supplier-lot traceability + recent equipment maintenance) →
 *     Generative (classify failure mode + likely root causes + impact blast-
 *     radius) → Generative (draft RCA with corrective + preventive actions +
 *     customer-comms needs) → Human (quality-manager + plant-manager review)
 *     → Code fan-out (emit incident doc + CAPA tickets + audit trail);
 *   - `Pricing.perInvocation` 3 tiers keyed on declared incident severity —
 *     minor / major / critical-recall ($199 / $999 / $4,999) — a minor
 *     SPC excursion costs less to investigate than a major customer-quality
 *     complaint, and a critical-recall investigation is the highest-stakes
 *     tier;
 *   - declarative HITL = mandatory quality-manager + plant-manager review
 *     (the quality-manager carries `regulatory` rationale because RCA +
 *     CAPA artefacts are SOX-adjacent audit-control records mandated to
 *     carry a quality-authority signer; the plant-manager review is folded
 *     into the same step as `approval` on the operational envelope), plus
 *     OutcomeContract requires quality-manager signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(rca-soundness +
 *     capa-actionability + traceability-completeness + factual-accuracy +
 *     sox-regulatoryCompliance + evidence-traceability) + HumanSign(quality-
 *     manager))`;
 *   - EvaluatorPanel includes `Personas.factualAccuracy({ citationRequired:
 *     true, minCitationsPerClaim: 2 })`, `Personas.regulatoryCompliance({
 *     regulator: 'sox' })`, and `Personas.evidenceTraceability({
 *     traceabilityFloor: 0.95 })` because RCA artefacts are SOX-adjacent
 *     audit-control records (every cited claim must carry at least two
 *     citations), every artefact must survive a SOX audit before the
 *     quality-manager signs, and at least 95% of load-bearing claims must
 *     trace back to a fan-in evidence source (production-batch record,
 *     supplier-lot trace, or equipment-maintenance record).
 *
 * Per design v3 §3 (Catalog HOW supply-chain) + §6 (binding triggers,
 * mandatory HumanSign on regulatory rationale) + §7 (per-invocation pricing
 * factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `defect-recurrence-rate-and-time-to-root-cause-
 * improvement` — the compound metric every quality organisation optimises
 * against (the investigator is worth running iff defect recurrence drops
 * AND time-to-root-cause improves vs. the pre-Service baseline; either
 * surrogate alone is insufficient — slow but correct RCAs leave defects
 * recurring; fast but shallow RCAs miss the root cause).
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
 * Input — a quality-incident investigation triggered by an SPC alert, a
 * customer-quality complaint, or an audit finding. Tight: 8 fields cover the
 * incident identity, the trigger kind, the declared severity band (so the
 * per-invocation pricing tier is resolvable at intake), the incident data
 * source, the production-batch + supplier-lot + equipment-maintenance fan-
 * in pointers, the impacted-product slice, the assigned quality-manager +
 * plant-manager, and the trigger stage gating intake.
 */
export const QualityIncidentInputSchema = z.object({
  incidentId: z.string(),
  triggerKind: z.enum(['spc-alert', 'customer-quality-complaint', 'audit-finding']),
  declaredSeverityBand: z.enum(['minor', 'major', 'critical-recall']),
  incidentData: z.object({
    incidentSystemRef: z.string(),
    detectedAt: z.string(),
    detectedByRef: z.string(),
    incidentNarrativeMarkdown: z.string(),
  }),
  evidenceSources: z.object({
    productionBatchRecordsRef: z.string(),
    supplierLotTraceabilityRef: z.string(),
    equipmentMaintenanceLogRef: z.string(),
    spcSystemRef: z.string().optional(),
    customerComplaintRegistryRef: z.string().optional(),
    auditFindingRegistryRef: z.string().optional(),
  }),
  impactedProducts: z.object({
    productLineRefs: z.array(z.string()).min(1),
    affectedBatchRefs: z.array(z.string()).min(1),
    affectedSupplierLotRefs: z.array(z.string()).default([]),
    estimatedAffectedUnits: z.number().int().nonnegative(),
  }),
  reviewers: z.object({
    qualityManagerRef: z.string(),
    plantManagerRef: z.string(),
  }),
  triggerStage: z.literal('quality-incident-trigger'),
})

/**
 * Output — a quality-manager-and-plant-manager-signed RCA dossier: the
 * incident-data + production-batch + supplier-lot + equipment-maintenance
 * snapshot, the failure-mode classification + likely root causes + impact
 * blast-radius, the drafted RCA with corrective + preventive actions +
 * customer-comms needs, the dual-reviewer sign-off audit, and pointers to
 * the emitted incident document + CAPA tickets + audit trail.
 */
export const QualityIncidentRcaOutputSchema = z.object({
  incidentId: z.string(),
  evidenceSnapshot: z.object({
    snapshotIso: z.string(),
    productionBatchesEvaluated: z.number().int().nonnegative(),
    supplierLotsEvaluated: z.number().int().nonnegative(),
    equipmentMaintenanceRecordsEvaluated: z.number().int().nonnegative(),
  }),
  failureModeClassification: z.object({
    failureModeId: z.string(),
    failureModeKind: z.enum([
      'material-defect',
      'process-deviation',
      'equipment-malfunction',
      'human-error',
      'design-defect',
      'supplier-induced',
      'environmental',
      'unknown',
    ]),
    classificationRationaleMarkdown: z.string(),
    sourcesCited: z.array(z.string()).min(2),
  }),
  likelyRootCauses: z
    .array(
      z.object({
        rootCauseId: z.string(),
        likelihood: z.enum(['low', 'medium', 'high']),
        causeNarrativeMarkdown: z.string(),
        sourcesCited: z.array(z.string()).min(2),
      })
    )
    .min(1),
  impactBlastRadius: z.object({
    impactedUnits: z.number().int().nonnegative(),
    impactedCustomerSegments: z.array(z.string()),
    impactedShipmentRefs: z.array(z.string()),
    estimatedFinancialExposureUsd: z.number().nonnegative(),
    blastRadiusRationaleMarkdown: z.string(),
  }),
  rca: z.object({
    rcaDocumentRef: z.string(),
    correctiveActions: z
      .array(
        z.object({
          actionId: z.string(),
          ownerRef: z.string(),
          targetCompletionDate: z.string(),
          actionDescriptionMarkdown: z.string(),
        })
      )
      .min(1),
    preventiveActions: z
      .array(
        z.object({
          actionId: z.string(),
          ownerRef: z.string(),
          targetCompletionDate: z.string(),
          actionDescriptionMarkdown: z.string(),
        })
      )
      .min(1),
    customerCommsNeeds: z.object({
      commsRequired: z.boolean(),
      audience: z.array(z.string()),
      draftCommsMarkdown: z.string().optional(),
      rationaleMarkdown: z.string(),
    }),
  }),
  signOffs: z.object({
    qualityManager: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-conditions', 'request-revision', 'reject']),
      conditions: z.array(z.string()),
      notes: z.string().optional(),
      signedAt: z.string(),
    }),
    plantManager: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-conditions', 'request-revision', 'reject']),
      conditions: z.array(z.string()),
      notes: z.string().optional(),
      signedAt: z.string(),
    }),
  }),
  artefacts: z.object({
    incidentDocRef: z.string(),
    capaTicketRefs: z.array(z.string()).min(1),
    auditTrailRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type QualityIncidentInput = z.infer<typeof QualityIncidentInputSchema>
export type QualityIncidentRcaOutput = z.infer<typeof QualityIncidentRcaOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_recurrenceAndTtr: RewardSignal = {
  keyResultRef:
    'kr:manufacturing-quality-incident-investigator:defect-recurrence-rate-and-time-to-root-cause-improvement',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:manufacturing-quality-incident-investigator:intake-coverage',
}
const kr_classificationQuality: RewardSignal = {
  keyResultRef: 'kr:manufacturing-quality-incident-investigator:classification-quality',
}
const kr_capaActionability: RewardSignal = {
  keyResultRef: 'kr:manufacturing-quality-incident-investigator:capa-actionability',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:manufacturing-quality-incident-investigator:emit-latency',
}

// ============================================================================
// Manufacturing Quality Incident Investigator Service
// ============================================================================

/**
 * Manufacturing Quality Incident Investigator — SPC alert / customer-quality
 * complaint / audit-finding trigger → quality-manager-and-plant-manager-
 * signed RCA dossier (failure-mode classification + likely root causes +
 * impact blast-radius + corrective and preventive actions + customer-comms
 * needs) backed by traceable evidence as a Service.
 *
 * Cascade: fetch-incident-data-production-batch-records-supplier-lot-traceability-and-recent-equipment-maintenance (Code, fan-in)
 *        → classify-failure-mode-likely-root-causes-and-impact-blast-radius (Generative)
 *        → draft-rca-with-corrective-and-preventive-actions-and-customer-comms-needs (Generative)
 *        → quality-manager-and-plant-manager-review (Human, regulatory rationale)
 *        → emit-incident-doc-capa-tickets-and-audit-trail (Code, fan-out).
 */
export const manufacturingQualityIncidentInvestigator: ServiceInstance<
  QualityIncidentInput,
  QualityIncidentRcaOutput
> = Service.define<QualityIncidentInput, QualityIncidentRcaOutput>({
  name: 'Manufacturing Quality Incident Investigator',
  promise:
    'Every quality-incident trigger lands a quality-manager-and-plant-manager-signed RCA dossier — failure-mode classification + likely root causes + impact blast-radius + corrective and preventive actions + customer-comms needs — backed by traceable production-batch + supplier-lot + equipment-maintenance evidence, so defect recurrence drops and time-to-root-cause improves against the pre-Service baseline.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: {
    input: QualityIncidentInputSchema,
    output: QualityIncidentRcaOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-incident-data-production-batch-records-supplier-lot-traceability-and-recent-equipment-maintenance',
        reward: kr_intakeCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'classify-failure-mode-likely-root-causes-and-impact-blast-radius',
        reward: kr_classificationQuality,
      }),
      Generative({
        name: 'draft-rca-with-corrective-and-preventive-actions-and-customer-comms-needs',
        reward: kr_capaActionability,
      }),
      Human({
        name: 'quality-manager-and-plant-manager-review',
        // `regulatory` rationale: RCA + CAPA artefacts are SOX-adjacent
        // audit-control records statutorily mandated to carry a quality-
        // authority signer. The quality-manager owns the audit-accountability
        // envelope; the plant-manager folds into the same review step on the
        // operational envelope. The quality-manager signature is OutcomeContract-
        // load-bearing.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-incident-doc-capa-tickets-and-audit-trail',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'incident-system.read',
      'production-batch-system.read',
      'supplier-lot-traceability-system.read',
      'equipment-maintenance-log.read',
      'spc-system.read',
      'customer-complaint-registry.read',
      'audit-finding-registry.read',
      'incident-doc-system.write',
      'capa-ticketing-system.write',
      'audit-trail-system.write',
    ],
    // Quality incident investigation: clarification disabled — the cascade
    // synthesises from incident data + production-batch + supplier-lot +
    // equipment-maintenance evidence; the quality-manager + plant-manager
    // review step is the single human contact point in the cascade.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Critical-recall incidents escalate the classification + RCA steps
        // to a senior quality-and-regulatory supervisor before the routine
        // quality-manager + plant-manager review (the manager + plant-
        // manager still sign, but the supervisor backstops the synthesis on
        // the highest-stakes tier — the recall blast-radius typically
        // includes regulator notification and customer-cohort comms).
        when: 'declaredSeverityBand == "critical-recall"',
        action: 'escalate',
      },
      {
        // Every incident routes through quality-manager + plant-manager
        // review before the incident doc emits and CAPA tickets fan out;
        // OutcomeContract enforces the quality-manager signature, the
        // trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'quality-manager-and-plant-manager-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:manufacturing-quality-incident-investigator-review',
    personas: [
      // RCA-soundness reviewer — pedantic check that the failure-mode
      // classification cites at least two corroborating evidence sources,
      // that every likely root cause carries a likelihood + narrative, and
      // that the rationale traces back to fan-in production-batch /
      // supplier-lot / equipment-maintenance records. The risk this guards
      // against is "RCA narrative that reads plausible but doesn't
      // reconcile to traced evidence".
      Personas.pedantic({
        domain: 'rca-soundness',
        rubric: [
          'failure-mode-cites-at-least-two-sources',
          'every-root-cause-cites-likelihood-and-narrative',
          'rationale-traces-to-batch-or-lot-or-equipment-record',
          'no-root-cause-without-evidence-citation',
          'classification-kind-justified-by-evidence',
          'no-narrative-without-citation',
        ],
        name: 'rca-soundness-checker',
      }),
      // CAPA-actionability reviewer — adversarially probes whether every
      // corrective and preventive action carries an owner, a target
      // completion date, and an action description specific enough to
      // execute (vs. boilerplate "improve quality controls"). The risk
      // this guards against is "CAPA tickets that close as 'done' without
      // changing anything".
      Personas.skeptic({
        domain: 'capa-actionability',
        focus: [
          'every-corrective-action-has-owner-and-date',
          'every-preventive-action-has-owner-and-date',
          'action-description-specific-enough-to-execute',
          'no-vague-improve-quality-actions',
          'preventive-actions-distinct-from-corrective',
          'customer-comms-needs-rationale-cited',
        ],
        name: 'capa-actionability-reviewer',
      }),
      // Traceability-completeness reviewer — adversarial probe that the
      // impact blast-radius reconciles with the impacted-products fan-in
      // (no silent units left out, no impacted customer segments missed,
      // affected-shipment refs trace back to supplier-lot evidence), and
      // that the financial exposure estimate is grounded in unit counts +
      // typical settlement values vs. invented headline numbers.
      Personas.skeptic({
        domain: 'traceability-completeness',
        focus: [
          'impacted-units-reconcile-with-batch-records',
          'impacted-customer-segments-trace-to-shipments',
          'affected-supplier-lots-named-when-supplier-induced',
          'financial-exposure-grounded-in-units-and-settlement',
          'no-silent-blast-radius-omissions',
        ],
        name: 'traceability-completeness-reviewer',
      }),
      // Factual-accuracy reviewer — every load-bearing claim in the RCA
      // dossier must carry at least two citations (RCA + CAPA dossiers are
      // load-bearing audit records; single-source claims do not survive a
      // SOX audit). This is the editorial standard the quality-manager
      // signature relies on.
      Personas.factualAccuracy({
        citationRequired: true,
        minCitationsPerClaim: 2,
        name: 'factual-accuracy-reviewer',
      }),
      // SOX regulatory-compliance reviewer — RCA + CAPA artefacts are SOX-
      // adjacent audit-control records. Every dossier must survive a SOX
      // audit before the quality-manager signs.
      Personas.regulatoryCompliance({
        regulator: 'sox',
        name: 'sox-regulatoryCompliance-reviewer',
      }),
      // Evidence-traceability reviewer — at least 95% of load-bearing
      // claims must trace back to a fan-in evidence source (production-
      // batch record, supplier-lot trace, or equipment-maintenance record).
      // The traceability floor is the load-bearing constraint that
      // distinguishes a "RCA backed by evidence" from a "RCA backed by
      // generative plausibility".
      Personas.evidenceTraceability({
        traceabilityFloor: 0.95,
        name: 'evidence-traceability-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:manufacturing-quality-incident-investigator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-quality-manager',
    seller: 'svc:manufacturing-quality-incident-investigator',
    serviceRef: 'svc:manufacturing-quality-incident-investigator',
    // Quality-manager signs every RCA dossier before the incident doc emits
    // and CAPA tickets fan out — quality-and-audit authority cannot be
    // delegated to the cascade.
    predicate: AND(
      SchemaMatch(QualityIncidentRcaOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['quality-manager'] })
    ),
    // Mid-tier amount; the per-tier per-invocation amounts are in
    // `pricing.tiers`.
    amount: { amount: 99900n, currency: 'USD' },
    // 3-day SLA — quality-incident investigations need to land inside half
    // a workweek so CAPA tickets land before customer escalation cycles
    // compound the incident.
    timeoutDays: 3,
    onTimeout: 'escalate',
  },

  // Per-invocation pricing — three tiers keyed on declared incident severity
  // band. A minor SPC excursion is straightforward to investigate; a major
  // customer-quality complaint typically pulls in multi-batch + supplier-lot
  // traceability; a critical-recall investigation is the highest-stakes
  // tier (recall blast-radius + regulator notification + customer-cohort
  // comms).
  pricing: Pricing.perInvocation({
    tiers: [
      {
        id: 'minor',
        amount: 19900n,
        includedPerMonth: 50,
        overage: 19900n,
      },
      {
        id: 'major',
        amount: 99900n,
        includedPerMonth: 10,
        overage: 99900n,
      },
      {
        id: 'critical-recall',
        amount: 499900n,
        includedPerMonth: 2,
        overage: 499900n,
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 13000n, perApiCall: 25n },
  reward: kr_recurrenceAndTtr,

  lineage: {
    cellRef: 'business.org.ai/cells/supply-chain/manufacturing-quality-incident-investigator',
    icpContextProblemRef: 'icp:manufacturing-quality-incident-investigator:v1',
    foundingHypothesisRef: 'fh:manufacturing-quality-incident-investigator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
