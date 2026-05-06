/**
 * Proposal Generator Service — round-11 catalog Service for the qualified-
 * opportunity → contextual-proposal → review-panel → sent loop in the revenue /
 * sales domain.
 *
 * Demonstrates: outcome-tier pricing (2 tiers — standard / enterprise),
 * `multi-step-research` archetype, six-step Cascade with one supervised Agentic
 * step (research-account), one Generative drafting step (draft-sections), four
 * Code wrappers on the I/O ends (pull-opp-context + assemble-pricing + render-
 * document + send), 5 external-API tool permissions (CRM opportunities + CRM
 * contacts + pricing-config + DocuSign + Gmail), clarification policy enabled
 * with round-trips bounded + AE escalation, one trigger rule (>$1M opportunity
 * value escalates to AE for human-supervised composition), EvaluatorPanel of 3
 * personas (voice-reviewer + pricing-checker + 98% rfp-coverage), AND-composed
 * OutcomeContract predicate (SchemaMatch + EvaluatorPass + External DocuSign
 * sent), 2-day delivery SLA, `quality-floor-fail` refund.
 *
 * Per design v3 §3.E (Catalog HOW agent's proposal-generator spec) + §6 (binding
 * triggers) + §7 (outcome-tier pricing factory) + §8 (ProofPredicate AND with
 * External verifier).
 *
 * Layer note: this Service lives in `autonomous-revenue` (L5 catalog) on top
 * of the `services-as-software` + `autonomous-finance` substrate (per v3 §12
 * packaging tradeoff: each catalog domain ships in its own L5 package so the
 * substrate stays clean at L3).
 *
 * Service-level reward = `proposal-close-rate` — proxy for the downstream
 * pipeline-conversion hill the proposal is designed to nudge.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, External, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a qualified opportunity ready for proposal generation. Tight: 4
 * fields capture identity (opportunity + account refs), the contracted product
 * line, and the requested scope (drives the research + draft-sections steps).
 */
export const OpportunityInputSchema = z.object({
  opportunityId: z.string(),
  accountRef: z.string(),
  productLine: z.string(),
  requestedScope: z.string(),
})

/**
 * Output — a sent proposal: the per-section composition (each labelled +
 * bodied), the assembled pricing object (line items + totals), the rendered
 * document URL (DocuSign envelope), and a delivery-time receipt.
 */
export const ProposalOutputSchema = z.object({
  opportunityId: z.string(),
  sections: z.array(
    z.object({
      label: z.string(),
      body: z.string(),
    })
  ),
  pricing: z.object({
    lineItems: z.array(
      z.object({
        sku: z.string(),
        quantity: z.number().int().positive(),
        unitAmount: z.bigint(), // USD cents
      })
    ),
    totalAmount: z.bigint(), // USD cents
    currency: z.string(),
  }),
  documentUrl: z.string(),
  sentAt: z.string(), // ISO-8601
})

export type OpportunityInput = z.infer<typeof OpportunityInputSchema>
export type ProposalOutput = z.infer<typeof ProposalOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands. Service-level kr_proposalCloseRate proxies the downstream
// pipeline-conversion hill the proposal is designed to nudge.
// ============================================================================

const kr_proposalCloseRate: RewardSignal = {
  keyResultRef: 'kr:proposal-generator:proposal-close-rate',
}
const kr_oppContextCoverage: RewardSignal = {
  keyResultRef: 'kr:proposal-generator:opp-context-coverage',
}
const kr_accountResearchAccuracy: RewardSignal = {
  keyResultRef: 'kr:proposal-generator:account-research-accuracy',
}
const kr_sectionQuality: RewardSignal = {
  keyResultRef: 'kr:proposal-generator:section-quality',
}
const kr_pricingFidelity: RewardSignal = {
  keyResultRef: 'kr:proposal-generator:pricing-fidelity',
}
const kr_renderFidelity: RewardSignal = {
  keyResultRef: 'kr:proposal-generator:render-fidelity',
}
const kr_sendLatency: RewardSignal = { keyResultRef: 'kr:proposal-generator:send-latency' }

// ============================================================================
// Proposal Generator Service
// ============================================================================

/**
 * Proposal Generator — qualified opportunity → contextual proposal → review
 * panel → sent in hours, not days.
 *
 * Cascade: pull-opp-context (Code, crm pull) →
 *          research-account (Agentic, supervised) →
 *          draft-sections (Generative) →
 *          assemble-pricing (Code, pricing-config lookup) →
 *          render-document (Code, DocuSign envelope) →
 *          send (Code, gmail.send + DocuSign send).
 *
 * Clarification enabled: proposal flows often need clarification (scope edges,
 * payment terms, custom-T&Cs) — `maxRoundTrips: 2`, escalates to `ae` once
 * exhausted.
 *
 * Trigger-based escalation: $1M+ opportunities (expressed in USD cents)
 * always escalate to the AE for human-supervised composition before any
 * proposal is sent.
 */
export const proposalGenerator: ServiceInstance<OpportunityInput, ProposalOutput> = Service.define<
  OpportunityInput,
  ProposalOutput
>({
  name: 'Proposal Generator',
  promise: 'Qualified opportunity → contextual proposal → review panel → sent in hours, not days',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: OpportunityInputSchema, output: ProposalOutputSchema },

  binding: {
    cascade: [
      Code({ name: 'pull-opp-context', reward: kr_oppContextCoverage, handler: () => undefined }),
      Agentic({
        name: 'research-account',
        reward: kr_accountResearchAccuracy,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({ name: 'draft-sections', reward: kr_sectionQuality }),
      Code({ name: 'assemble-pricing', reward: kr_pricingFidelity, handler: () => undefined }),
      Code({ name: 'render-document', reward: kr_renderFidelity, handler: () => undefined }),
      Code({ name: 'send', reward: kr_sendLatency, handler: () => undefined }),
    ],
    toolPermissions: [
      'crm.opportunities',
      'crm.contacts',
      'pricing-config.lookup',
      'docusign.envelopes',
      'gmail.send',
    ],
    clarificationPolicy: { enabled: true, maxRoundTrips: 2, escalateTo: 'ae' },
    triggers: [
      {
        // $1M+ deals always escalate to the AE for human-supervised
        // composition before any proposal is sent.
        when: 'opportunity.value_usd > 100_000_000n',
        action: 'escalate',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:proposal-generator-review',
    personas: [
      // Voice reviewer — checks the drafted sections match the sales-style
      // brand voice (confident, specific, customer-grounded).
      Personas.voice({ brandVoiceRef: 'sales-style-guide', name: 'voice-reviewer' }),
      // Pricing checker — fact-grounds the assemble-pricing line items
      // against the pricing-config source of truth so the proposal doesn't
      // ship with a fat-finger SKU price.
      Personas.accuracy({ domain: 'pricing-figures', name: 'pricing-checker' }),
      // RFP coverage floor — ensures the drafted sections cover ≥ 98% of
      // the canonical RFP rubric items for the requested scope.
      Personas.coverage({ minPercent: 0.98, name: 'rfp-coverage' }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:proposal-generator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-revenue-ops',
    seller: 'svc:proposal-generator',
    serviceRef: 'svc:proposal-generator',
    // AND(schema, panel, external): output validates, panel approves, AND
    // DocuSign confirms the envelope was sent. The external check pins the
    // outcome to a verifiable side-effect rather than just an LLM verdict.
    predicate: AND(
      SchemaMatch(ProposalOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      External({ verifier: 'docusign', spec: { sent: true } })
    ),
    amount: { amount: 49900n, currency: 'USD' },
    // Standard SLA — 2 business days from intake to sent.
    timeoutDays: 2,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      { id: 'standard', amount: 9900n, currency: 'USD', description: 'Standard proposal ($99).' },
      {
        id: 'enterprise',
        amount: 49900n,
        currency: 'USD',
        description: 'Enterprise proposal ($499).',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 300n },
  reward: kr_proposalCloseRate,

  lineage: {
    cellRef: 'business.org.ai/cells/sales-representatives/proposal-creation',
    icpContextProblemRef: 'icp:proposal-generator:v1',
    foundingHypothesisRef: 'fh:proposal-generator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
