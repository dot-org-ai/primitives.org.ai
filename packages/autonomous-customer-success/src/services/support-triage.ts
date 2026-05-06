/**
 * Support Triage Service — proof-of-life for the v3 Service primitives in
 * the customer-success domain.
 *
 * Demonstrates: high-volume per-invocation tier pricing (3 tiers — starter /
 * growth / scale), `triage` archetype, fully-autonomous cascade (no Human
 * Functions; classify already promoted via TrackRecord), declarative HITL
 * routing via `binding.triggers` (route-to a human-agent on low-confidence),
 * EvaluatorPanel of 3 personas (voice + accuracy + brand-voice), OR-composed
 * OutcomeContract predicate (AND(SchemaMatch, EvaluatorPass) OR HumanSign),
 * `quality-floor-fail` refund, `tenant-only` authority, 1-day expiry.
 *
 * Per design v1 §3.D (Catalog HOW agent's Customer Support Triage spec) +
 * v3 §6 (binding triggers) + v3 §7 (perInvocation pricing factory) + v3 §8
 * (ProofPredicate OR composition).
 *
 * Layer note: this Service lives in `autonomous-customer-success` (L5) and
 * depends on `services-as-software` (L5), `autonomous-finance` (L3), and
 * `digital-tools` (L4). No `Human` Functions in the cascade — the HITL gate
 * is a declarative trigger that routes to an out-of-cascade `human-agent`
 * worker on low-confidence classification.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, OR, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a single inbound support ticket from any of four channels (email /
 * chat / web form / social). Tight: 6 fields capture identity, source,
 * subject, body, and optional attachments.
 */
export const TicketSchema = z.object({
  ticketId: z.string(),
  channel: z.enum(['email', 'chat', 'form', 'social']),
  customerRef: z.string(),
  subject: z.string(),
  body: z.string(),
  attachments: z
    .array(
      z.object({
        url: z.string(),
        mimeType: z.string(),
      })
    )
    .optional(),
})

/**
 * Output — a triaged ticket: category + priority + CRM-enriched context +
 * draft reply + the worker / queue the ticket was routed to. `confidence`
 * carries the classifier's calibrated score so the trigger compiler can
 * route low-confidence cases to a human agent.
 */
export const TriagedSchema = z.object({
  ticketId: z.string(),
  category: z.enum(['billing', 'technical', 'account', 'feature-request', 'other']),
  priority: z.enum(['p0', 'p1', 'p2', 'p3']),
  enrichment: z.object({
    customerTier: z.string().optional(),
    accountValueCents: z.bigint().optional(),
    recentTickets: z.number().optional(),
    crmRef: z.string().optional(),
  }),
  draftReply: z.string(),
  routedTo: z.string(),
  confidence: z.number().min(0).max(1),
})

export type Ticket = z.infer<typeof TicketSchema>
export type Triaged = z.infer<typeof TriagedSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands.
// ============================================================================

const kr_csat: RewardSignal = { keyResultRef: 'kr:support-triage:csat' }
const kr_classifyAccuracy: RewardSignal = {
  keyResultRef: 'kr:support-triage:classify-accuracy',
}
const kr_replyQuality: RewardSignal = { keyResultRef: 'kr:support-triage:reply-quality' }
const kr_routeAccuracy: RewardSignal = { keyResultRef: 'kr:support-triage:route-accuracy' }

// ============================================================================
// Support Triage Service
// ============================================================================

/**
 * Support Triage — high-volume inbound-ticket handling as a Service.
 *
 * Cascade: classify (Agentic, autonomous — already promoted via TrackRecord)
 *        → enrich (Code, CRM lookup)
 *        → draft-reply (Generative)
 *        → route (Agentic, supervised).
 *
 * The `classify.confidence < 0.7` trigger short-circuits to `human-agent`
 * (an out-of-cascade Worker, not a Function in the cascade) — keeping the
 * cascade itself pure-autonomous while preserving the HITL escape hatch.
 *
 * Pricing is per-invocation with three tiers (1k / 10k / 100k included per
 * month) so high-volume tenants get sub-linear cost.
 */
export const supportTriage: ServiceInstance<Ticket, Triaged> = Service.define<Ticket, Triaged>({
  name: 'Support Triage',
  promise: 'Inbound tickets classified, enriched, drafted, and routed in seconds.',
  audience: 'business',
  archetype: 'triage',
  schema: { input: TicketSchema, output: TriagedSchema },

  binding: {
    cascade: [
      Agentic({
        name: 'classify',
        reward: kr_classifyAccuracy,
        // Already promoted via TrackRecord — runs without per-invocation sign-off.
        mode: 'autonomous',
        oversight: { mode: 'autonomous' },
        signOff: 'none',
      }),
      Code({ name: 'enrich', reward: kr_csat, handler: () => undefined }),
      Generative({ name: 'draft-reply', reward: kr_replyQuality }),
      Agentic({
        name: 'route',
        reward: kr_routeAccuracy,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
    ],
    toolPermissions: ['crm.contacts', 'crm.accounts', 'kb.search', 'router.queues'],
    // High-volume design: clarification disabled to keep latency tight; the
    // confidence-trigger handles the only real escape hatch.
    clarificationPolicy: {
      enabled: false,
      maxRoundTrips: 0,
      escalateTo: 'human-agent',
    },
    triggers: [
      {
        when: 'classify.confidence < 0.7',
        action: 'route-to',
        target: 'human-agent',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:support-triage-review',
    personas: [
      // Tone reviewer — checks the draft reply matches the customer-facing
      // tone in the support voice guide.
      Personas.voice({ brandVoiceRef: 'brand:support/tone' }),
      // Accuracy reviewer — fact-grounds enrichment + reply against the
      // KB and CRM record.
      Personas.accuracy({
        domain: 'support-reply-accuracy',
        sources: ['kb://support', 'crm://accounts'],
      }),
      // Brand-voice reviewer — separate brand-guide ref (corporate brand
      // voice, distinct from the support-tone guide above).
      Personas.voice({ brandVoiceRef: 'brand:do-industries/voice' }),
    ],
    signOffPolicy: 'all-approve',
    // High-volume design: only one extra round before escalation.
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:support-triage:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-support-lead',
    seller: 'svc:support-triage',
    serviceRef: 'svc:support-triage',
    // OR(autonomous-pass, human-sign): either schema + panel approve, or a
    // support-agent signs off. Lets the HITL trigger satisfy the contract
    // without forcing the panel through.
    predicate: OR(
      AND(
        SchemaMatch(TriagedSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
      ),
      HumanSign({ signerRoles: ['support-agent'] })
    ),
    amount: { amount: 50n, currency: 'USD' },
    // 1-day SLA per high-volume archetype default.
    expiresAt: 'P1D',
    onTimeout: 'escalate',
  },

  pricing: Pricing.perInvocation({
    tiers: [
      { id: 'starter', amount: 50n, includedPerMonth: 1000 },
      { id: 'growth', amount: 35n, includedPerMonth: 10000 },
      { id: 'scale', amount: 20n, includedPerMonth: 100000 },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 8n },
  reward: kr_csat,

  lineage: {
    cellRef: 'business.org.ai/cells/customer-service-representatives/inbound-ticket-handling',
    icpContextProblemRef: 'icp:support-triage:v1',
    foundingHypothesisRef: 'fh:support-triage:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
