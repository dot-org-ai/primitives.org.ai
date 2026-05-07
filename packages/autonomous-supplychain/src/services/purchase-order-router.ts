/**
 * Purchase Order Router Service — PO routing + approval orchestration for the
 * procurement / supply-chain catalog.
 *
 * Distinguishing shape vs. siblings (`vendor-onboarding-runbook`,
 * `inventory-reorder-planner`):
 *   - `triage` archetype — the artefact is an approver-conditional routing
 *     decision with policy-classification + alternative-suggestions, not a
 *     vendor onboarding packet or a reorder plan;
 *   - 5-step cascade: Code fan-in (PO details + budget context + approval
 *     policy) → Generative (classify PO against policy) → Generative (route
 *     with rationale + alternatives) → Human (approver, conditional on
 *     classification) → Code fan-out (PO status + audit log);
 *   - `Pricing.perInvocation` 3 tiers keyed on PO amount band — small /
 *     medium / large ($49 / $199 / $799) — a small office-supply PO is worth
 *     less to route than a large multi-vendor capex PO;
 *   - declarative HITL = approver review, declared `approval` rationale (the
 *     approver owns the budget-authorisation decision; conditional on
 *     classification — in-policy POs may auto-approve once expirationPolicy
 *     thresholds are met, out-of-policy always routes through the approver);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(policy-coverage +
 *     routing-rationale))` — no HumanSign predicate at the OC level because
 *     the approver step is conditional and the audit log + classification
 *     decision are the load-bearing artefacts (the OC binds the routing
 *     quality, the audit binds the human signature when present).
 *
 * Per design v3 §3 (Catalog HOW supply-chain) + §6 (binding triggers,
 * conditional HumanSign) + §7 (per-invocation pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `po-cycle-time-reduction-and-policy-violation-rate-
 * reduction` — the compound metric every procurement org optimises against
 * (the router is worth running iff PO-submitted-to-routed cycle drops AND
 * the policy-violation rate drops vs. the pre-Service baseline; cycle-time
 * gains that come at the cost of higher policy violations are not improvements).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a PO submitted in the procurement system. Tight: 8 fields cover
 * the PO identity, the submitting team / requestor, the declared amount band
 * (so the per-invocation tier is resolvable at intake), the line items, the
 * vendor reference, the budget context, the approval policy reference, and
 * the trigger stage gating intake.
 */
export const PurchaseOrderInputSchema = z.object({
  poId: z.string(),
  submission: z.object({
    submittedByRef: z.string(),
    submittingTeam: z.enum([
      'engineering',
      'finance',
      'marketing',
      'product',
      'sales',
      'operations',
      'people',
      'legal',
      'executive',
      'facilities',
    ]),
    submittedAt: z.string(),
  }),
  declaredAmountBand: z.enum(['small', 'medium', 'large']),
  poLineItems: z
    .array(
      z.object({
        lineId: z.string(),
        description: z.string(),
        category: z.enum([
          'software',
          'hardware',
          'professional-services',
          'office-supplies',
          'travel',
          'logistics',
          'manufacturing',
          'marketing',
          'subscription',
          'other',
        ]),
        quantity: z.number().positive(),
        unitPriceUsd: z.number().nonnegative(),
        lineTotalUsd: z.number().nonnegative(),
      })
    )
    .min(1),
  vendor: z.object({
    vendorRef: z.string(),
    onboardingStatus: z.enum(['onboarded', 'in-onboarding', 'unknown']),
  }),
  budgetContext: z.object({
    glAccount: z.string(),
    costCenterRef: z.string(),
    budgetRemainingUsd: z.number(),
    budgetPeriodEndsIso: z.string(),
  }),
  approvalPolicyRef: z.string(),
  assignedApproverRef: z.string(),
  triggerStage: z.literal('po-submitted'),
})

/**
 * Output — a routed PO with policy classification, routing decision +
 * alternatives, the approver review (when triggered by classification), and
 * pointers to the emitted PO status + audit log artefacts.
 */
export const PurchaseOrderRoutingOutputSchema = z.object({
  poId: z.string(),
  contextSnapshot: z.object({
    poTotalUsd: z.number().nonnegative(),
    vendor: z.object({
      vendorRef: z.string(),
      onboardingStatus: z.enum(['onboarded', 'in-onboarding', 'unknown']),
    }),
    budgetContext: z.object({
      glAccount: z.string(),
      costCenterRef: z.string(),
      budgetRemainingUsd: z.number(),
      budgetPeriodEndsIso: z.string(),
      budgetUtilisationAfterApprovalPct: z.number().nonnegative(),
    }),
    approvalPolicyRef: z.string(),
  }),
  policyClassification: z.object({
    classification: z.enum(['in-policy', 'out-of-policy-low', 'out-of-policy-high']),
    matchedPolicyClauses: z.array(
      z.object({
        clauseId: z.string(),
        clauseSummary: z.string(),
      })
    ),
    violatedPolicyClauses: z.array(
      z.object({
        clauseId: z.string(),
        clauseSummary: z.string(),
        violationDetail: z.string(),
      })
    ),
    rationaleMarkdown: z.string(),
  }),
  routingDecision: z.object({
    routedTo: z.enum(['auto-approve', 'approver-review', 'finance-controller', 'CFO-escalation']),
    rationaleMarkdown: z.string(),
    alternativeSuggestions: z
      .array(
        z.object({
          suggestionId: z.string(),
          summary: z.string(),
          estimatedSavingsUsd: z.number().nonnegative(),
          tradeoffNotes: z.string(),
        })
      )
      .min(0),
  }),
  approverReview: z
    .object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-conditions', 'request-revision', 'reject']),
      conditions: z.array(z.string()),
      notes: z.string().optional(),
      decidedAt: z.string(),
    })
    .optional(),
  artefacts: z.object({
    poStatusRef: z.string(),
    auditLogRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type PurchaseOrderInput = z.infer<typeof PurchaseOrderInputSchema>
export type PurchaseOrderRoutingOutput = z.infer<typeof PurchaseOrderRoutingOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_poCycleAndViolation: RewardSignal = {
  keyResultRef:
    'kr:purchase-order-router:po-cycle-time-reduction-and-policy-violation-rate-reduction',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:purchase-order-router:intake-coverage',
}
const kr_classificationAccuracy: RewardSignal = {
  keyResultRef: 'kr:purchase-order-router:classification-accuracy',
}
const kr_routingRationale: RewardSignal = {
  keyResultRef: 'kr:purchase-order-router:routing-rationale-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:purchase-order-router:emit-latency',
}

// ============================================================================
// Purchase Order Router Service
// ============================================================================

/**
 * Purchase Order Router — PO submitted → policy classification + routing
 * decision (with alternative suggestions) + approver review (conditional on
 * classification) + audit log as a Service.
 *
 * Cascade: fetch-po-details-budget-context-and-approval-policy (Code, fan-in)
 *        → classify-po-against-policy-in-policy-or-out-of-policy-low-or-out-of-policy-high (Generative)
 *        → route-with-rationale-and-alternative-suggestions (Generative)
 *        → approver-conditional-on-classification (Human, approval rationale)
 *        → emit-po-status-and-audit-log (Code, fan-out).
 */
export const purchaseOrderRouter: ServiceInstance<PurchaseOrderInput, PurchaseOrderRoutingOutput> =
  Service.define<PurchaseOrderInput, PurchaseOrderRoutingOutput>({
    name: 'Purchase Order Router',
    promise:
      'Every submitted PO lands a policy classification, a routed decision with rationale + alternative suggestions, and an audit log within minutes — out-of-policy POs route through the right approver, in-policy POs flow through without friction — so PO cycle time drops without trading off policy violations.',
    audience: 'business',
    archetype: 'triage',
    schema: { input: PurchaseOrderInputSchema, output: PurchaseOrderRoutingOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-po-details-budget-context-and-approval-policy',
          reward: kr_intakeCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'classify-po-against-policy-in-policy-or-out-of-policy-low-or-out-of-policy-high',
          reward: kr_classificationAccuracy,
        }),
        Generative({
          name: 'route-with-rationale-and-alternative-suggestions',
          reward: kr_routingRationale,
        }),
        Human({
          name: 'approver-conditional-on-classification',
          // `approval` rationale: the approver owns the budget-authorisation
          // decision. Conditional on classification — in-policy small POs may
          // auto-approve once expirationPolicy thresholds are met, but out-
          // of-policy POs always route through the approver. The gate stays
          // human until the cascade compiler decides to migrate it.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 0.99, whenSamplesExceed: 5_000 },
        }),
        Code({
          name: 'emit-po-status-and-audit-log',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'procurement-system.read',
        'procurement-system.write',
        'budget-system.read',
        'approval-policy.read',
        'vendor-directory.read',
        'audit-log.write',
        'notification-channel.write',
      ],
      // PO routing: clarification disabled — the cascade synthesises from the
      // PO line items + budget context + approval policy; the approver step
      // is the single conditional human contact point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Out-of-policy-high POs escalate the routing step to the finance
          // controller (or CFO for material amounts) before the routine
          // approver review — high-violation POs need senior eyes before the
          // routine approver signs.
          when: 'declaredAmountBand == "large"',
          action: 'escalate',
        },
        {
          // Every PO routes through the approver step (which may auto-
          // approve if classification + expirationPolicy permit) before the
          // PO status emits and the audit log writes.
          when: 'true',
          action: 'route-to',
          target: 'approver-conditional-on-classification',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:purchase-order-router-review',
      personas: [
        // Policy-coverage reviewer — pedantic check that every PO line item
        // is evaluated against the named approval-policy clauses (no line
        // silently skipped), every classification cites the matched +
        // violated clauses, and every violation carries a violation detail.
        // The risk this guards against is "routed-without-policy-evaluation".
        Personas.pedantic({
          domain: 'policy-coverage',
          rubric: [
            'every-line-item-evaluated-against-policy',
            'every-classification-cites-matched-clauses',
            'every-violation-cites-clause-id-and-detail',
            'no-silent-policy-skips',
            'budget-utilisation-cited-in-rationale',
            'vendor-onboarding-status-considered',
          ],
          name: 'policy-coverage-checker',
        }),
        // Routing-rationale reviewer — adversarially probes whether each
        // routing decision has a concrete rationale (cites the
        // classification, names the routed-to target, names the alternative
        // suggestions when out-of-policy) vs. surface-level "route to
        // approver" hand-waving.
        Personas.skeptic({
          domain: 'routing-rationale',
          focus: [
            'routing-decision-cites-classification',
            'routed-to-target-justified-by-policy',
            'out-of-policy-routes-include-alternatives',
            'alternative-suggestions-quantify-savings',
            'no-hand-waves',
          ],
          name: 'routing-rationale-reviewer',
        }),
        // Procurement-domain reviewer — pulls the senior-procurement expert
        // for judgment on the overall classification + routing quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/PurchasingAgents',
          name: 'procurement-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:purchase-order-router:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-procurement-operations',
      seller: 'svc:purchase-order-router',
      serviceRef: 'svc:purchase-order-router',
      // Routing-quality OC — no HumanSign predicate at the OC level because
      // the approver step is conditional on classification (the audit log +
      // classification record bind the human signature when present, but the
      // OC binds the routing quality regardless of whether the approver was
      // invoked on a given PO).
      predicate: AND(
        SchemaMatch(PurchaseOrderRoutingOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
      ),
      // Mid-tier amount; the per-tier per-invocation amounts are in
      // `pricing.tiers`.
      amount: { amount: 19900n, currency: 'USD' },
      // Sub-day SLA — POs need routing within hours, not days. Day-level
      // granularity is a floor.
      timeoutDays: 1,
      onTimeout: 'escalate',
    },

    pricing: Pricing.perInvocation({
      tiers: [
        {
          id: 'small',
          amount: 4900n,
          includedPerMonth: 200,
          overage: 4900n,
        },
        {
          id: 'medium',
          amount: 19900n,
          includedPerMonth: 50,
          overage: 19900n,
        },
        {
          id: 'large',
          amount: 79900n,
          includedPerMonth: 10,
          overage: 79900n,
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 4000n, perApiCall: 10n },
    reward: kr_poCycleAndViolation,

    lineage: {
      cellRef: 'business.org.ai/cells/procurement/purchase-order-router',
      icpContextProblemRef: 'icp:purchase-order-router:v1',
      foundingHypothesisRef: 'fh:purchase-order-router:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
