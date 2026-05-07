/**
 * Supplier Risk Monitor Service — ongoing supplier-risk surveillance for the
 * procurement / supply-chain catalog.
 *
 * Distinguishing shape vs. siblings (`vendor-onboarding-runbook`,
 * `purchase-order-router`, `inventory-reorder-planner`,
 * `freight-cost-optimizer`, `customs-compliance-filer`):
 *   - `forecast-narrative` archetype — the artefact is a per-supplier risk
 *     narrative + recommended action (monitor / diversify / escalate) signed
 *     by the procurement-lead + risk-officer, not a vendor onboarding packet,
 *     a routing decision, or a reorder plan;
 *   - 5-step cascade with one supervised Agentic public-news + sanctions-list
 *     + concentrated-dependency cross-check step (the Agentic step in this
 *     Service), bookended by Code fan-in (supplier-list + recent public news +
 *     ESG data + financial-distress signals + delivery performance), Generative
 *     synthesise-per-supplier-risk-narrative + recommend-actions, a
 *     procurement-lead + risk-officer Human sign-off gate, and Code fan-out
 *     (risk dashboard update + escalation tickets);
 *   - `Pricing.subscription` recurring monthly plan ($1,499/mo per supply-
 *     chain-org) with metered overage on `supplier-risk-escalation` events
 *     ($199 each) — the surveillance value compounds over the month, so a
 *     fixed plan is the right base, but the act of escalating a flagged
 *     supplier is the load-bearing per-event work the subscription amortises;
 *   - declarative HITL = mandatory procurement-lead + risk-officer review
 *     (both use `regulatory` rationale because SOX vendor-management controls
 *     and ongoing supplier-risk monitoring are the load-bearing controls
 *     mandated to carry a human signer), plus OutcomeContract requires risk-
 *     officer signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(signal-precision +
 *     recommendation-actionability + sox-regulatoryCompliance + factual-
 *     accuracy) + HumanSign(risk-officer))`;
 *   - EvaluatorPanel includes `Personas.regulatoryCompliance({ regulator:
 *     'sox' })` and `Personas.factualAccuracy({ citationRequired: true,
 *     sourceTypes: ['government', 'industry-standard'] })` because supplier
 *     risk monitoring is the load-bearing SOX vendor-management control and
 *     every flagged risk narrative must carry corroborating government /
 *     industry-standard sources before the risk-officer signs.
 *
 * Per design v3 §3 (Catalog HOW supply-chain) + §6 (binding triggers,
 * conditional HumanSign) + §7 (subscription pricing factory + metered overage)
 * + §8 (ProofPredicate AND).
 *
 * Service-level reward = `supplier-disruption-incident-rate-reduction` — the
 * compound metric every supply-chain org optimises against (the monitor is
 * worth running iff supplier-disruption incident rate drops vs. the pre-
 * Service baseline; the surveillance value is the absence of disruptions
 * that would otherwise have surprised the procurement organisation).
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
 * Input — a weekly surveillance cycle over the supplier portfolio. Tight: 8
 * fields cover the cycle identity, the trigger kind, the supplier-portfolio
 * scope, the surveillance data sources (public-news + ESG + financial-distress
 * + delivery-perf), the materiality thresholds for triggering an escalation,
 * the assigned procurement-lead + risk-officer, and the trigger stage gating
 * intake.
 */
export const SupplierRiskCycleInputSchema = z.object({
  cycleId: z.string(),
  triggerKind: z.enum(['weekly-cron', 'supplier-portfolio-update', 'incident-driven']),
  supplierPortfolio: z.object({
    portfolioRef: z.string(),
    scopeKind: z.enum(['full-portfolio', 'tier-1-only', 'critical-path-only', 'subset']),
    supplierRefs: z.array(z.string()).default([]),
  }),
  dataSources: z.object({
    supplierDirectoryRef: z.string(),
    publicNewsFeedRef: z.string(),
    esgDataProviderRef: z.string(),
    financialDistressFeedRef: z.string(),
    deliveryPerfSystemRef: z.string(),
    sanctionsListRefs: z.array(z.string()).min(1),
  }),
  materialityThresholds: z.object({
    spendShareEscalateThreshold: z.number().nonnegative(),
    deliveryDefectRateEscalateThreshold: z.number().nonnegative(),
    financialDistressScoreEscalateThreshold: z.number().nonnegative(),
  }),
  reviewers: z.object({
    procurementLeadRef: z.string(),
    riskOfficerRef: z.string(),
  }),
  triggerStage: z.literal('supplier-risk-cycle'),
})

/**
 * Output — a procurement-lead-and-risk-officer-signed risk surveillance
 * artefact: the surveyed supplier list + portfolio snapshot, per-supplier
 * cross-check findings (public-news + sanctions-list + concentrated-dependency
 * flags), per-supplier risk narratives + recommended actions, the procurement-
 * lead + risk-officer sign-off audit, and pointers to the emitted dashboard
 * update + escalation tickets.
 */
export const SupplierRiskReportOutputSchema = z.object({
  cycleId: z.string(),
  portfolioSnapshot: z.object({
    snapshotIso: z.string(),
    suppliersEvaluated: z.number().int().nonnegative(),
    suppliersWithFlags: z.number().int().nonnegative(),
    suppliersRecommendedForEscalation: z.number().int().nonnegative(),
  }),
  supplierRiskNarratives: z
    .array(
      z.object({
        narrativeId: z.string(),
        supplierRef: z.string(),
        crossCheckFindings: z.object({
          publicNewsFlags: z.array(
            z.object({
              flagId: z.string(),
              severity: z.enum(['info', 'warning', 'critical']),
              observation: z.string(),
              sourcesCited: z.array(z.string()).min(1),
            })
          ),
          sanctionsListFlags: z.array(
            z.object({
              flagId: z.string(),
              listRef: z.string(),
              matchKind: z.enum(['exact', 'fuzzy', 'related-entity']),
              observation: z.string(),
            })
          ),
          concentratedDependencyFlags: z.array(
            z.object({
              flagId: z.string(),
              dependencyKind: z.enum([
                'spend-concentration',
                'sole-source',
                'geographic-concentration',
                'tier-2-dependency',
              ]),
              observation: z.string(),
            })
          ),
        }),
        riskNarrativeMarkdown: z.string(),
        sourcesCited: z.array(z.string()).min(1),
        recommendedAction: z.enum(['monitor', 'diversify', 'escalate']),
        actionRationaleMarkdown: z.string(),
      })
    )
    .min(1),
  signOffs: z.object({
    procurementLead: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-conditions', 'request-revision', 'reject']),
      conditions: z.array(z.string()),
      notes: z.string().optional(),
      signedAt: z.string(),
    }),
    riskOfficer: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-conditions', 'request-revision', 'reject']),
      conditions: z.array(z.string()),
      notes: z.string().optional(),
      signedAt: z.string(),
    }),
  }),
  artefacts: z.object({
    riskDashboardUpdateRef: z.string(),
    escalationTicketRefs: z.array(z.string()),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type SupplierRiskCycleInput = z.infer<typeof SupplierRiskCycleInputSchema>
export type SupplierRiskReportOutput = z.infer<typeof SupplierRiskReportOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_disruptionIncidentRate: RewardSignal = {
  keyResultRef: 'kr:supplier-risk-monitor:supplier-disruption-incident-rate-reduction',
}
const kr_dataCoverage: RewardSignal = {
  keyResultRef: 'kr:supplier-risk-monitor:data-coverage',
}
const kr_crossCheckCoverage: RewardSignal = {
  keyResultRef: 'kr:supplier-risk-monitor:cross-check-coverage',
}
const kr_narrativeQuality: RewardSignal = {
  keyResultRef: 'kr:supplier-risk-monitor:narrative-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:supplier-risk-monitor:emit-latency',
}

// ============================================================================
// Supplier Risk Monitor Service
// ============================================================================

/**
 * Supplier Risk Monitor — weekly cron / supplier-portfolio update / incident-
 * driven cycle → procurement-lead-and-risk-officer-signed per-supplier risk
 * narratives with recommended actions (monitor / diversify / escalate),
 * dashboard update, and escalation tickets as a Service.
 *
 * Cascade: fetch-supplier-list-recent-public-news-esg-data-financial-distress-and-delivery-perf (Code, fan-in)
 *        → supervised-cross-check-public-news-sanctions-list-and-concentrated-dependency-flags (Agentic, supervised)
 *        → synthesize-per-supplier-risk-narrative-and-recommend-actions (Generative)
 *        → procurement-lead-and-risk-officer-review (Human, regulatory rationale)
 *        → emit-risk-dashboard-update-and-escalation-tickets (Code, fan-out).
 */
export const supplierRiskMonitor: ServiceInstance<
  SupplierRiskCycleInput,
  SupplierRiskReportOutput
> = Service.define<SupplierRiskCycleInput, SupplierRiskReportOutput>({
  name: 'Supplier Risk Monitor',
  promise:
    'Every week the supplier portfolio lands a procurement-lead-and-risk-officer-signed risk narrative — public-news cross-check, sanctions-list screen, concentrated-dependency flags, and a monitor / diversify / escalate recommendation per supplier — so supplier-disruption surprises decline against the pre-Service baseline.',
  audience: 'business',
  archetype: 'forecast-narrative',
  schema: {
    input: SupplierRiskCycleInputSchema,
    output: SupplierRiskReportOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-supplier-list-recent-public-news-esg-data-financial-distress-and-delivery-perf',
        reward: kr_dataCoverage,
        handler: () => undefined,
      }),
      Agentic({
        name: 'supervised-cross-check-public-news-sanctions-list-and-concentrated-dependency-flags',
        reward: kr_crossCheckCoverage,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({
        name: 'synthesize-per-supplier-risk-narrative-and-recommend-actions',
        reward: kr_narrativeQuality,
      }),
      Human({
        name: 'procurement-lead-and-risk-officer-review',
        // `regulatory` rationale: SOX vendor-management controls and ongoing
        // supplier-risk monitoring are mandated to carry a human signer. The
        // procurement-lead owns the supplier-relationship envelope; the
        // risk-officer owns the third-party-risk + concentrated-dependency
        // envelope. Neither delegates.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-risk-dashboard-update-and-escalation-tickets',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'supplier-directory.read',
      'public-news-feed.read',
      'esg-provider.read',
      'financial-distress-feed.read',
      'delivery-perf-system.read',
      'sanctions-list.read',
      'risk-dashboard.write',
      'ticketing-system.write',
      'notification-channel.write',
    ],
    // Supplier risk monitoring: clarification disabled — the cascade
    // synthesises from the supplier portfolio + public-news + ESG + financial-
    // distress + delivery-perf signals; the procurement-lead + risk-officer
    // review step is the single human contact point in the cascade.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Incident-driven cycles escalate the cross-check + narrative steps
        // to a senior risk supervisor before the routine procurement-lead +
        // risk-officer review (the lead + officer still sign, but the
        // supervisor backstops the synthesis on incident-driven cycles
        // where a supplier disruption has already materialised).
        when: 'triggerKind == "incident-driven"',
        action: 'escalate',
      },
      {
        // Every cycle routes through procurement-lead + risk-officer review
        // before the dashboard update emits and escalation tickets fan out;
        // OutcomeContract enforces the risk-officer signature, the trigger
        // primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'procurement-lead-and-risk-officer-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:supplier-risk-monitor-review',
    personas: [
      // Signal-precision reviewer — pedantic check that every flagged risk
      // signal cites concrete data (a specific public-news article, a
      // specific sanctions-list match, a specific concentrated-dependency
      // metric) vs. surface-level "elevated risk" hand-waving. The risk
      // this guards against is "false-positive narratives that erode
      // procurement-lead trust in the surveillance".
      Personas.pedantic({
        domain: 'signal-precision',
        rubric: [
          'every-public-news-flag-cites-source',
          'every-sanctions-flag-cites-list-and-match-kind',
          'every-dependency-flag-cites-metric',
          'narrative-cites-concrete-signals-not-vibes',
          'no-recommended-escalation-without-flag',
          'no-flag-without-severity',
        ],
        name: 'signal-precision-checker',
      }),
      // Recommendation-actionability reviewer — adversarially probes whether
      // every monitor / diversify / escalate recommendation has a concrete
      // rationale tying the recommended action to the flagged signals
      // (escalations cite the breached materiality threshold, diversifications
      // cite a concentrated-dependency flag, monitor recommendations cite
      // why the flags don't yet warrant action) vs. boilerplate.
      Personas.skeptic({
        domain: 'recommendation-actionability',
        focus: [
          'escalations-cite-breached-threshold',
          'diversifications-cite-dependency-flag',
          'monitor-cites-why-no-action',
          'no-vague-recommendations',
          'action-tracks-flag-severity',
        ],
        name: 'recommendation-actionability-reviewer',
      }),
      // SOX regulatory-compliance reviewer — supplier-risk monitoring is a
      // load-bearing SOX vendor-management control. Every weekly artefact
      // must survive a SOX audit before the risk-officer signs.
      Personas.regulatoryCompliance({
        regulator: 'sox',
        name: 'sox-regulatoryCompliance-reviewer',
      }),
      // Factual-accuracy reviewer — every load-bearing risk claim must
      // carry a citation, and citations must come from authoritative tiers
      // (government registries / industry-standard provider feeds), not
      // first-party blog posts. This is the editorial standard the risk-
      // officer signature relies on.
      Personas.factualAccuracy({
        citationRequired: true,
        sourceTypes: ['government', 'industry-standard'],
        name: 'factual-accuracy-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:supplier-risk-monitor:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-risk-officer',
    seller: 'svc:supplier-risk-monitor',
    serviceRef: 'svc:supplier-risk-monitor',
    // Risk-officer signs every weekly surveillance artefact before the
    // dashboard update emits and escalation tickets fan out — third-party-
    // risk authority cannot be delegated to the cascade.
    predicate: AND(
      SchemaMatch(SupplierRiskReportOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['risk-officer'] })
    ),
    // Mid-tier amount; the recurring plan + metered overage live in `pricing`.
    amount: { amount: 149900n, currency: 'USD' },
    // 7-day SLA — weekly surveillance lands within one workweek so the
    // procurement organisation has fresh signal before the next supply-chain
    // committee.
    timeoutDays: 7,
    onTimeout: 'escalate',
  },

  // Subscription pricing — $1,499/mo per supply-chain-org recurring plan.
  // The surveillance value compounds over the month, so a fixed plan is the
  // right base. Metered overage on `supplier-risk-escalation` events ($199
  // each) prices the load-bearing per-event work the subscription
  // amortises — a quiet month produces few escalations, a noisy month with
  // material disruptions produces many.
  pricing: Pricing.subscription({
    plan: {
      id: 'supplier-risk-monitor-monthly',
      amount: 149900n,
      currency: 'USD',
      interval: 'month',
    },
    metered: [
      {
        event: 'supplier-risk-escalation',
        amount: 19900n,
        description:
          'Supplier risk escalation event — a flagged supplier whose recommended action crossed into "escalate".',
      },
    ],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 9000n, perApiCall: 18n },
  reward: kr_disruptionIncidentRate,

  lineage: {
    cellRef: 'business.org.ai/cells/supply-chain/supplier-risk-monitor',
    icpContextProblemRef: 'icp:supplier-risk-monitor:v1',
    foundingHypothesisRef: 'fh:supplier-risk-monitor:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
