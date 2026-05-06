/**
 * Lead Qualification Service — proof-of-life for the v3 Service primitives in
 * the revenue / sales catalog.
 *
 * Demonstrates: outcome pricing (per-qualified-lead), lead-qualification
 * archetype, multi-Function cascade with two supervised Agentic steps
 * (BANT+MEDDIC qualify + AE route) + two Code steps (receive + enrich), 5
 * external-API tool permissions (Clearbit / LinkedIn / Salesforce / Apollo),
 * trigger-based HITL routing on revenue threshold (>$100M → SDR review),
 * EvaluatorPanel of 2 skeptic personas (ICP fit + buying intent), AND-composed
 * OutcomeContract predicate (SchemaMatch + EvaluatorPass + External Salesforce
 * verification).
 *
 * Per design v3 §3.E (Catalog HOW agent's lead-qualification spec) + §6
 * (binding triggers) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Layer note: this Service lives in `autonomous-revenue` (L5 catalog) on top
 * of the `services-as-software` + `autonomous-finance` substrate (per v3 §12
 * packaging tradeoff: each catalog domain ships in its own L5 package so the
 * substrate stays clean at L3).
 *
 * Service-level reward = `closed-won-rate` — matches the BaC ch.7:138 worked
 * example where lead-qualification pulls on the revenue→profit hill via
 * downstream pipeline conversion.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, External, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — an inbound lead captured from a marketing surface (form, demo
 * request, content download, in-person event, partner referral). Tight: 5
 * fields capture identity + provenance + the raw form payload to be enriched
 * downstream.
 */
export const InboundLeadSchema = z.object({
  leadId: z.string(),
  source: z.enum(['form', 'demo-request', 'content-download', 'event', 'referral']),
  email: z.string(),
  workEmailDomain: z.string().optional(),
  formFields: z.record(z.unknown()),
})

/**
 * Output — a fully qualified lead, enriched against Clearbit + LinkedIn, scored
 * on BANT + MEDDIC, ICP fit, buying intent, and routed to a named AE / SDR.
 * 7 top-level fields cover identity + enrichment + the two qualification
 * frameworks + the two scores + the routing target.
 */
export const QualifiedLeadSchema = z.object({
  leadId: z.string(),
  enrichment: z.object({
    company: z.object({
      name: z.string(),
      domain: z.string(),
      employees: z.number(),
      industry: z.string(),
      revenue: z.bigint().optional(),
    }),
    person: z.object({
      name: z.string(),
      title: z.string(),
      seniority: z.string(),
      linkedinUrl: z.string().optional(),
    }),
  }),
  bant: z.object({
    budget: z.string(),
    authority: z.string(),
    need: z.string(),
    timeline: z.enum(['<30d', '30-90d', '90-180d', '>180d', 'unknown']),
  }),
  meddic: z.object({
    metrics: z.string(),
    economicBuyer: z.string(),
    decisionCriteria: z.string(),
    decisionProcess: z.string(),
    identifyPain: z.string(),
    champion: z.string(),
  }),
  icpScore: z.number().min(0).max(100),
  intentScore: z.number().min(0).max(100),
  routedTo: z.string(),
})

export type InboundLead = z.infer<typeof InboundLeadSchema>
export type QualifiedLead = z.infer<typeof QualifiedLeadSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands. Service-level kr_closedWonRate matches the BaC ch.7:138
// worked example.
// ============================================================================

const kr_closedWonRate: RewardSignal = { keyResultRef: 'kr:lead-qualification:closed-won-rate' }
const kr_enrichmentCoverage: RewardSignal = {
  keyResultRef: 'kr:lead-qualification:enrichment-coverage',
}
const kr_qualifyAccuracy: RewardSignal = {
  keyResultRef: 'kr:lead-qualification:qualify-accuracy',
}
const kr_routeAccuracy: RewardSignal = {
  keyResultRef: 'kr:lead-qualification:route-accuracy',
}

// ============================================================================
// Lead Qualification Service
// ============================================================================

/**
 * Lead Qualification — inbound lead → enriched, scored, routed as a Service.
 *
 * Cascade: receive (Code) → enrich (Code, Clearbit + LinkedIn via $.api.*) →
 *          qualify (Agentic, supervised — BANT+MEDDIC) →
 *          route (Agentic, supervised — AE/SDR assignment).
 *
 * High-volume: `clarificationPolicy.enabled: false` (no round-trips to the
 * lead while qualifying — operators don't pause an inbound).
 *
 * Trigger-based HITL: leads from companies with revenue > $100M route to
 * `sdr-review` for human qualification (enterprise leads warrant a human
 * touch on the way in).
 */
export const leadQualification: ServiceInstance<InboundLead, QualifiedLead> = Service.define<
  InboundLead,
  QualifiedLead
>({
  name: 'LeadQualification',
  promise:
    'Inbound lead enriched, BANT/MEDDIC scored, ICP-graded, intent-graded, routed to the right AE — in seconds.',
  audience: 'business',
  archetype: 'lead-qualification',
  schema: { input: InboundLeadSchema, output: QualifiedLeadSchema },

  binding: {
    cascade: [
      Code({ name: 'receive', reward: kr_enrichmentCoverage, handler: () => undefined }),
      Code({ name: 'enrich', reward: kr_enrichmentCoverage, handler: () => undefined }),
      Agentic({
        name: 'qualify',
        reward: kr_qualifyAccuracy,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Agentic({
        name: 'route',
        reward: kr_routeAccuracy,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
    ],
    toolPermissions: [
      'clearbit.companies',
      'linkedin.profiles',
      'salesforce.leads',
      'salesforce.opportunities',
      'apollo.contacts',
    ],
    clarificationPolicy: {
      enabled: false,
      maxRoundTrips: 0,
      escalateTo: 'sdr-review',
    },
    triggers: [
      {
        when: 'enrichment.company.revenue > 10_000_000_000n',
        action: 'route-to',
        target: 'sdr-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:lead-qualification-review',
    personas: [
      Personas.skeptic({ domain: 'ideal-customer-profile' }),
      Personas.skeptic({ domain: 'buying-intent' }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:lead-qualification:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-revenue-ops',
    seller: 'svc:lead-qualification',
    serviceRef: 'svc:lead-qualification',
    predicate: AND(
      SchemaMatch(QualifiedLeadSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      External({
        verifier: 'salesforce',
        spec: { leadCreated: true, ownerAssigned: true },
      })
    ),
    amount: { amount: 500n, currency: 'USD' },
    // Per-lead SLA — onTimeout escalates per refundContract.
    expiresAt: 'PT1H',
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'qualified-lead',
        amount: 500n,
        currency: 'USD',
        description: 'Per qualified lead, charged only when EvaluatorPanel + Salesforce confirm.',
      },
    ],
  }),

  refundContract: 'no-charge-if-not-qualified',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 25n, perApiCall: 10n },
  reward: kr_closedWonRate,

  lineage: {
    cellRef: 'business.org.ai/cells/sales-representatives/inbound-lead-qualification',
    icpContextProblemRef: 'icp:lead-qualification:v1',
    foundingHypothesisRef: 'fh:lead-qualification:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
