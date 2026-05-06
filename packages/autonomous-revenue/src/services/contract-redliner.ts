/**
 * Contract Redliner Service — third catalog Service in the revenue / sales
 * line, extending the autonomous-revenue package beyond round-5
 * lead-qualification with a regulated, attorney-gated flow.
 *
 * Demonstrates: outcome-tier pricing (NDA / MSA / enterprise-MSA), document-
 * extraction archetype, seven-step Cascade with two supervised Agentic steps
 * (clause identification + policy comparison), two single-shot Generative
 * steps (redline draft + risk memo), one Human review step (attorney sign-off,
 * regulatory rationale + accuracy/sample expiration policy), Code wrappers on
 * the I/O ends (parse + publish), 3 external-API tool permissions
 * (policy-vault / DocuSign / Gmail), clarification policy enabled with
 * round-trips bounded + general-counsel escalation, two trigger rules
 * (>$1M contract value or high-severity risk routes to attorney),
 * EvaluatorPanel of 3 personas (liability skeptic + 98% clause coverage +
 * domain-expert attorney reviewer), AND-composed OutcomeContract predicate
 * (SchemaMatch + EvaluatorPass + HumanSign by attorney role), 5-day delivery
 * SLA, jd-bar-admitted authority boundary.
 *
 * Per design v3 §3.E (Catalog HOW agent's contract-redliner spec) + §6
 * (binding triggers) + §7 (outcome-tier pricing factory) + §8 (ProofPredicate
 * AND with HumanSign).
 *
 * Layer note: this Service lives in `autonomous-revenue` (L5 catalog) on top
 * of the `services-as-software` + `autonomous-finance` substrate (per v3 §12
 * packaging tradeoff: each catalog domain ships in its own L5 package so the
 * substrate stays clean at L3).
 *
 * Service-level reward = `contract-cycle-time` — matches the BaC ch.7 worked
 * example where a redline service compresses time-to-signed-MSA against the
 * legal-ops productivity hill.
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
 * Input — a vendor contract document submitted for redlining. Tight: 5 fields
 * capture identity, kind (NDA / MSA / DPA / SOW), the raw text body to be
 * parsed + clause-identified, the optional contract value (in USD cents,
 * `bigint` for precision under high-value MSAs), and the governing
 * jurisdiction (drives policy-vault lookup).
 */
export const ContractDocInputSchema = z.object({
  contractId: z.string(),
  kind: z.enum(['nda', 'msa', 'dpa', 'sow']),
  contractText: z.string(),
  valueUsdCents: z.bigint().optional(),
  jurisdiction: z.string(),
})

/**
 * Output — a redlined contract with per-clause suggested edits, a synthesised
 * risk memo, and (when triggered) an attorney sign-off receipt. 5 top-level
 * fields cover identity + the redline list + the memo + the sign-off pointer
 * + a publish-time receipt.
 */
export const RedlinedContractOutputSchema = z.object({
  contractId: z.string(),
  redlines: z.array(
    z.object({
      clauseRef: z.string(),
      originalText: z.string(),
      suggestedText: z.string(),
      rationale: z.string(),
      severity: z.enum(['low', 'medium', 'high']),
    })
  ),
  riskMemo: z.string(),
  attorneySignOffRef: z.string().optional(),
  publishedAt: z.string(), // ISO-8601
})

export type ContractDocInput = z.infer<typeof ContractDocInputSchema>
export type RedlinedContractOutput = z.infer<typeof RedlinedContractOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands. Service-level kr_contractCycleTime matches the BaC ch.7
// worked example where redlining compresses time-to-signed-MSA on the
// legal-ops productivity hill.
// ============================================================================

const kr_contractCycleTime: RewardSignal = {
  keyResultRef: 'kr:contract-redliner:contract-cycle-time',
}
const kr_parseAccuracy: RewardSignal = { keyResultRef: 'kr:contract-redliner:parse-accuracy' }
const kr_clauseAccuracy: RewardSignal = { keyResultRef: 'kr:contract-redliner:clause-accuracy' }
const kr_policyAlignment: RewardSignal = {
  keyResultRef: 'kr:contract-redliner:policy-alignment',
}
const kr_redlineQuality: RewardSignal = { keyResultRef: 'kr:contract-redliner:redline-quality' }
const kr_riskMemoQuality: RewardSignal = {
  keyResultRef: 'kr:contract-redliner:risk-memo-quality',
}
const kr_attorneyApproval: RewardSignal = {
  keyResultRef: 'kr:contract-redliner:attorney-approval',
}
const kr_publishLatency: RewardSignal = { keyResultRef: 'kr:contract-redliner:publish-latency' }

// ============================================================================
// Contract Redliner Service
// ============================================================================

/**
 * Contract Redliner — vendor contract → redlined draft + risk memo + attorney
 * sign-off as a Service.
 *
 * Cascade: parse-contract (Code) → identify-clauses (Agentic, supervised) →
 *          compare-to-policy (Agentic, supervised) →
 *          draft-redlines (Generative) → produce-risk-memo (Generative) →
 *          review (Human, regulatory rationale, expirationPolicy) →
 *          publish (Code, DocuSign + email).
 *
 * Clarification enabled: legal flows often need clarification (jurisdiction
 * scope, counterparty intent, indemnity scope) — `maxRoundTrips: 3`,
 * escalates to `general-counsel` once exhausted.
 *
 * Trigger-based routing: high-value contracts (>$1M, expressed in USD cents)
 * or high-severity risk findings route directly to the attorney `review` step;
 * otherwise the cascade may complete review without an escalation.
 */
export const contractRedliner: ServiceInstance<ContractDocInput, RedlinedContractOutput> =
  Service.define<ContractDocInput, RedlinedContractOutput>({
    name: 'ContractRedliner',
    promise: 'Vendor MSA, NDA, DPA — redlined against your policy in minutes, not days',
    audience: 'business',
    archetype: 'document-extraction',
    schema: { input: ContractDocInputSchema, output: RedlinedContractOutputSchema },

    binding: {
      cascade: [
        Code({ name: 'parse-contract', reward: kr_parseAccuracy, handler: () => undefined }),
        Agentic({
          name: 'identify-clauses',
          reward: kr_clauseAccuracy,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Agentic({
          name: 'compare-to-policy',
          reward: kr_policyAlignment,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Generative({ name: 'draft-redlines', reward: kr_redlineQuality }),
        Generative({ name: 'produce-risk-memo', reward: kr_riskMemoQuality }),
        Human({
          name: 'review',
          reward: kr_attorneyApproval,
          rationale: 'regulatory',
          expirationPolicy: { whenAccuracyExceeds: 0.95, whenSamplesExceed: 100 },
        }),
        Code({ name: 'publish', reward: kr_publishLatency, handler: () => undefined }),
      ],
      toolPermissions: ['policy-vault.lookup', 'docusign.envelopes', 'gmail.send'],
      clarificationPolicy: {
        enabled: true,
        maxRoundTrips: 3,
        escalateTo: 'general-counsel',
      },
      triggers: [
        {
          when: 'contract.value_usd > 100_000_000n',
          action: 'route-to',
          target: 'review',
        },
        {
          when: 'risk.severity === "high"',
          action: 'escalate',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:contract-redliner-review',
      personas: [
        Personas.skeptic({ domain: 'liability-clauses', name: 'liability-skeptic' }),
        Personas.coverage({ minPercent: 0.98, name: 'clause-coverage' }),
        Personas.domain({
          expertRef: 'occupations.org.ai/Lawyers',
          name: 'attorney-reviewer',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:contract-redliner:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-legal-ops',
      seller: 'svc:contract-redliner',
      serviceRef: 'svc:contract-redliner',
      predicate: AND(
        SchemaMatch(RedlinedContractOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['attorney'] })
      ),
      amount: { amount: 49900n, currency: 'USD' },
      // Standard MSA SLA — 5 business days from intake.
      timeoutDays: 5,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        { id: 'nda', amount: 9900n, currency: 'USD', description: 'NDA redline ($99).' },
        { id: 'msa', amount: 49900n, currency: 'USD', description: 'MSA redline ($499).' },
        {
          id: 'enterprise-msa',
          amount: 199900n,
          currency: 'USD',
          description: 'Enterprise MSA redline ($1999).',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'jd-bar-admitted',
    reward: kr_contractCycleTime,

    lineage: {
      cellRef: 'business.org.ai/cells/lawyers/contract-redlining',
      icpContextProblemRef: 'icp:contract-redliner:v1',
      foundingHypothesisRef: 'fh:contract-redliner:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
