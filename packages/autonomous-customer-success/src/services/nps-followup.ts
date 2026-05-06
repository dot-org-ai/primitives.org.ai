/**
 * NPS Followup Service — round-6 catalog Service for the high-volume
 * post-survey acknowledgement loop in the customer-success domain.
 *
 * Demonstrates: high-volume per-invocation tier pricing (3 tiers — starter /
 * growth / scale, 500 / 5k / 50k included per month), `triage` archetype,
 * fully-autonomous cascade (no Human Functions; classify-sentiment already
 * promoted via TrackRecord), declarative HITL routing via `binding.triggers`
 * (route detractor enterprise responses to an out-of-cascade `csm-handoff`
 * worker), EvaluatorPanel of 2 personas (tone-reviewer + theme-checker)
 * under `all-approve`, AND-composed OutcomeContract predicate
 * (SchemaMatch + EvaluatorPass), `quality-floor-fail` refund,
 * `tenant-only` authority, 1-day `timeoutDays`.
 *
 * Per design v1 §3.D (Catalog HOW agent's Customer Success NPS-followup
 * spec) + v3 §6 (binding triggers) + v3 §7 (perInvocation pricing factory)
 * + v3 §8 (ProofPredicate AND composition) + round-6 cleanups
 * (`{ enabled: false }` clarification form, Pricing factory call).
 *
 * Layer note: this Service lives in `autonomous-customer-success` (L5) and
 * depends on `services-as-software` (L5), `autonomous-finance` (L3), and
 * `digital-tools` (L4). No `Human` Functions in the cascade — the HITL gate
 * is a declarative trigger that routes detractor enterprise survey responses
 * to an out-of-cascade `csm-handoff` worker.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a single inbound NPS survey response from any of four channels
 * (Delighted email, in-product widget, sms, transactional follow-up). Tight:
 * 5 fields capture identity, score, optional comment, and channel.
 */
export const NPSResponseInputSchema = z.object({
  responseId: z.string(),
  customerRef: z.string(),
  score: z.number().int().min(0).max(10),
  comment: z.string().optional(),
  channel: z.enum(['email', 'in-product', 'sms', 'transactional']),
})

/**
 * Output — an acknowledged NPS response: a calibrated sentiment score,
 * extracted themes, the composed reply text, the timestamp the reply was
 * sent, and the worker / queue the response was routed to (defaults to
 * `auto-acknowledge`; switches to `csm-handoff` when the trigger fires).
 */
export const NPSAcknowledgedOutputSchema = z.object({
  responseId: z.string(),
  sentimentScore: z.number().min(-1).max(1),
  themes: z.array(z.string()),
  replyText: z.string(),
  sentAt: z.string(),
  routedTo: z.string(),
})

export type NPSResponseInput = z.infer<typeof NPSResponseInputSchema>
export type NPSAcknowledgedOutput = z.infer<typeof NPSAcknowledgedOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands.
// ============================================================================

const kr_npsResponseRate: RewardSignal = { keyResultRef: 'kr:nps-followup:response-rate' }
const kr_sentimentAccuracy: RewardSignal = {
  keyResultRef: 'kr:nps-followup:sentiment-accuracy',
}
const kr_themeCoverage: RewardSignal = { keyResultRef: 'kr:nps-followup:theme-coverage' }
const kr_replyQuality: RewardSignal = { keyResultRef: 'kr:nps-followup:reply-quality' }

// ============================================================================
// NPS Followup Service
// ============================================================================

/**
 * NPS Followup — high-volume post-survey acknowledgement as a Service.
 *
 * Cascade: classify-sentiment (Agentic, autonomous — already promoted via
 *          TrackRecord)
 *        → extract-themes (Generative)
 *        → compose-reply (Generative)
 *        → send (Code, gmail send + crm log).
 *
 * The `sentiment.score < -0.5 && customer.tier === "enterprise"` trigger
 * short-circuits to `csm-handoff` (an out-of-cascade Worker, not a Function
 * in the cascade) — keeping the cascade itself pure-autonomous while
 * preserving the HITL escape hatch for detractor enterprise responses.
 *
 * Pricing is per-invocation with three tiers (500 / 5k / 50k included per
 * month) so high-volume tenants get sub-linear cost.
 */
export const npsFollowup: ServiceInstance<NPSResponseInput, NPSAcknowledgedOutput> = Service.define<
  NPSResponseInput,
  NPSAcknowledgedOutput
>({
  name: 'NPS Followup',
  promise: 'Every survey response acknowledged, categorized, and routed — promoter or detractor',
  audience: 'business',
  archetype: 'triage',
  schema: { input: NPSResponseInputSchema, output: NPSAcknowledgedOutputSchema },

  binding: {
    cascade: [
      Agentic({
        name: 'classify-sentiment',
        reward: kr_sentimentAccuracy,
        // Already promoted via TrackRecord — runs without per-invocation sign-off.
        mode: 'autonomous',
        oversight: { mode: 'autonomous' },
        signOff: 'none',
      }),
      Generative({ name: 'extract-themes', reward: kr_themeCoverage }),
      Generative({ name: 'compose-reply', reward: kr_replyQuality }),
      Code({ name: 'send', reward: kr_npsResponseRate, handler: () => undefined }),
    ],
    toolPermissions: ['delighted.responses', 'gmail.send', 'crm.contacts'],
    // High-volume design: clarification disabled to keep latency tight; the
    // detractor-enterprise trigger handles the only real escape hatch.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        when: 'sentiment.score < -0.5 && customer.tier === "enterprise"',
        action: 'route-to',
        target: 'csm-handoff',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:nps-followup-review',
    personas: [
      // Tone reviewer — checks the composed reply matches the customer-
      // success follow-up brand voice (warm, gracious, brief).
      Personas.voice({ brandVoiceRef: 'brand:cs-followup', name: 'tone-reviewer' }),
      // Theme checker — fact-grounds the extracted themes against the
      // raw survey comment so we don't acknowledge a theme the customer
      // never raised.
      Personas.accuracy({ domain: 'theme-extraction', name: 'theme-checker' }),
    ],
    signOffPolicy: 'all-approve',
    // High-volume design: only one extra round before escalation.
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:nps-followup:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-cs-lead',
    seller: 'svc:nps-followup',
    serviceRef: 'svc:nps-followup',
    // AND(autonomous-pass): schema + panel approve. No human-sign branch —
    // the detractor-enterprise trigger reroutes those cases out of the
    // cascade entirely, so the contract here is the autonomous-pass path.
    predicate: AND(
      SchemaMatch(NPSAcknowledgedOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
    ),
    amount: { amount: 25n, currency: 'USD' },
    // 1-day SLA per high-volume archetype default.
    timeoutDays: 1,
    onTimeout: 'escalate',
  },

  pricing: Pricing.perInvocation({
    tiers: [
      { id: 'starter', amount: 25n, includedPerMonth: 500 },
      { id: 'growth', amount: 18n, includedPerMonth: 5000 },
      { id: 'scale', amount: 12n, includedPerMonth: 50000 },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 5n },
  reward: kr_npsResponseRate,

  lineage: {
    cellRef: 'business.org.ai/cells/customer-success-managers/nps-survey-followup',
    icpContextProblemRef: 'icp:nps-followup:v1',
    foundingHypothesisRef: 'fh:nps-followup:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
