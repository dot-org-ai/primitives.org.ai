/**
 * Controller Service — month-end close review + GAAP enforcement +
 * audit-ready statement attestation.
 *
 * Distinguishing shape vs. bookkeeper:
 *   - longer cascade (6 steps) with TWO supervised agentic gates plus a
 *     terminal Human (CPA) sign-attest;
 *   - 3-persona panel: skeptic('gaap'), CPA domain expert, audit skeptic;
 *   - subscription pricing with metered per-statement overage;
 *   - regulated authority boundary (`cpa-attest`) with HITL on every run
 *     until earned-autonomy thresholds clear (0.99 accuracy, 120 samples).
 *
 * Per design v3 §3 (Catalog HOW finance) + §6 (binding triggers + earned
 * autonomy) + §7 (subscription pricing factory) + §8 (AND-composed
 * predicates with HumanSign).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas
// ============================================================================

/**
 * Input — handed off from the bookkeeper Service: closed books snapshot
 * the controller is asked to review and attest.
 */
export const ReviewedBooksInputSchema = z.object({
  tenantId: z.string(),
  period: z.object({ start: z.string(), end: z.string() }),
  closedBooksRef: z.string(),
  policyOverrides: z.array(z.string()).optional(),
  upstreamCloseAt: z.string(),
})

/**
 * Output — attested monthly statements with policy-enforcement record,
 * anomaly log, and CPA sign-off pointer.
 */
export const AttestedStatementsOutputSchema = z.object({
  tenantId: z.string(),
  period: z.object({ start: z.string(), end: z.string() }),
  statements: z.object({
    incomeStatementUrl: z.string(),
    balanceSheetUrl: z.string(),
    cashFlowUrl: z.string(),
  }),
  policyEnforcementRecord: z.array(
    z.object({
      ruleId: z.string(),
      outcome: z.enum(['enforced', 'waived', 'flagged']),
      rationale: z.string(),
    })
  ),
  anomalies: z.array(
    z.object({
      id: z.string(),
      severity: z.number(),
      rationale: z.string(),
    })
  ),
  attestationRef: z.string(),
  attestedAt: z.string(),
})

export type ReviewedBooksInput = z.infer<typeof ReviewedBooksInputSchema>
export type AttestedStatementsOutput = z.infer<typeof AttestedStatementsOutputSchema>

// ============================================================================
// RewardSignal placeholder — real KR ref lands with business-as-code.
// ============================================================================

const kr_statementAccuracy: RewardSignal = {
  keyResultRef: 'kr:controller:statement-accuracy',
}

// ============================================================================
// Controller Service
// ============================================================================

/**
 * Controller — monthly statement review + GAAP enforcement + audit-ready
 * attestation as a Service.
 *
 * Cascade: read-books → enforce-policy → flag-anomalies → produce-statements
 *        → sign-attest (Human/CPA) → publish.
 *
 * The Human sign-attest carries an earned-autonomy `expirationPolicy` —
 * once the cascade-without-the-human accuracy clears 0.99 over 120 samples
 * the policy may migrate the human off (per v3 §14 open decision).
 */
export const controller: ServiceInstance<ReviewedBooksInput, AttestedStatementsOutput> =
  Service.define<ReviewedBooksInput, AttestedStatementsOutput>({
    name: 'Controller',
    promise: 'Monthly statements reviewed, GAAP-enforced, audit-ready',
    audience: 'business',
    archetype: 'document-extraction',
    schema: { input: ReviewedBooksInputSchema, output: AttestedStatementsOutputSchema },

    binding: {
      cascade: [
        Code({ name: 'read-books', reward: kr_statementAccuracy, handler: () => undefined }),
        Agentic({
          name: 'enforce-policy',
          reward: kr_statementAccuracy,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Agentic({
          name: 'flag-anomalies',
          reward: kr_statementAccuracy,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Generative({ name: 'produce-statements', reward: kr_statementAccuracy }),
        Human({
          name: 'sign-attest',
          rationale: 'regulatory',
          expirationPolicy: { whenAccuracyExceeds: 0.99, whenSamplesExceed: 120 },
        }),
        Code({ name: 'publish', handler: () => undefined }),
      ],
      toolPermissions: ['quickbooks.entries', 'quickbooks.statements'],
      clarificationPolicy: {
        enabled: true,
        maxRoundTrips: 2,
        escalateTo: 'cfo',
      },
      triggers: [
        {
          when: 'anomaly.severity > 0.7',
          action: 'route-to',
          target: 'sign-attest',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:controller-review',
      personas: [
        Personas.skeptic({ domain: 'gaap', name: 'gaap-strict' }),
        Personas.domain({
          expertRef: 'occupations.org.ai/CertifiedPublicAccountants',
          name: 'cpa-reviewer',
        }),
        Personas.skeptic({ domain: 'audit-trail', name: 'audit-skeptic' }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:controller:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-cfo',
      seller: 'svc:controller',
      serviceRef: 'svc:controller',
      predicate: AND(
        SchemaMatch(AttestedStatementsOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['cpa'] })
      ),
      amount: { amount: 99900n, currency: 'USD' },
      // 7-day attestation SLA — onTimeout escalates to refundContract.
      timeoutDays: 7,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: { id: 'monthly', amount: 99900n, currency: 'USD', interval: 'month' },
      metered: [{ event: 'statement-attested', amount: 5n }],
    }),

    refundContract: 'sla-credit-on-late-close',
    authorityBoundary: 'cpa-attest',
    costModel: { perInvocation: 200n },
    reward: kr_statementAccuracy,

    lineage: {
      cellRef: 'business.org.ai/cells/financial-controllers/monthly-close-and-statements',
      icpContextProblemRef: 'icp:controller:v1',
      foundingHypothesisRef: 'fh:controller:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
