/**
 * Campaign Orchestrator Service — round-12 catalog Service for the marketing
 * campaign brief → audience build → content draft → send → measure → iterate
 * loop in the revenue / marketing domain.
 *
 * Demonstrates: composite pricing (monthly base + per-campaign-sent metered
 * overage), `multi-step-research` archetype, partly-supervised cascade with
 * TWO supervised Agentic gates (`build-audience` and `review-creative`),
 * declarative trigger routing for both audience-size guardrails (large
 * audiences route through `review-creative` for human-supervised approval)
 * and post-send measurement reaction (low CTR routes to `analyze-and-iterate`
 * for next-iteration recommendations), EvaluatorPanel of 3 personas (voice +
 * targeting-skeptic + attribution-checker) under `all-approve`, AND-composed
 * OutcomeContract predicate (SchemaMatch + EvaluatorPass + External Mailchimp
 * sent verifier) with a 14-day `timeoutDays` (campaigns measure across two-
 * week windows), `partial-credit-on-partial-delivery` refund.
 *
 * Per design v3 §3.E (Catalog HOW agent's campaign-orchestrator spec) + §6
 * (binding triggers — both `route-to` variants exercised) + §7 (composite
 * pricing factory) + §8 (ProofPredicate AND with External verifier).
 *
 * Layer note: this Service lives in `autonomous-revenue` (L5 catalog) on top
 * of the `services-as-software` + `autonomous-finance` substrate (per v3 §12
 * packaging tradeoff: each catalog domain ships in its own L5 package so the
 * substrate stays clean at L3).
 *
 * Service-level reward = `pipeline-generated` — campaigns nudge the pipeline-
 * generated hill via measured CTR + downstream conversions.
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
 * Input — a campaign brief: identity (campaign + product line), an opaque
 * audience-criteria object the `build-audience` step resolves into a real
 * Mailchimp segment, the requested content tone (drives the draft step),
 * and the target click-through rate (used by `analyze-and-iterate` to decide
 * whether the campaign hit, and surfaced via the trigger that routes to the
 * iterate step on under-performance).
 */
export const CampaignBriefInputSchema = z.object({
  campaignId: z.string(),
  productLine: z.string(),
  audienceCriteria: z.record(z.unknown()),
  contentTone: z.string(),
  targetCtrPct: z.number().min(0).max(1),
})

/**
 * Output — a sent + measured campaign: the resolved audience size, the
 * delivery timestamp, the actual measured CTR + open rate + conversion count,
 * and the `analyze-and-iterate` recommendation (free-form text the marketing
 * lead reads before commissioning the next-iteration campaign).
 */
export const CampaignResultOutputSchema = z.object({
  campaignId: z.string(),
  audienceSize: z.number().int().nonnegative(),
  sentAt: z.string(), // ISO-8601
  ctrActual: z.number().min(0).max(1),
  openRate: z.number().min(0).max(1),
  conversions: z.number().int().nonnegative(),
  recommendation: z.string(),
})

export type CampaignBriefInput = z.infer<typeof CampaignBriefInputSchema>
export type CampaignResultOutput = z.infer<typeof CampaignResultOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands. Service-level kr_pipelineGenerated proxies the pipeline-
// generated hill the campaign is designed to nudge.
// ============================================================================

const kr_pipelineGenerated: RewardSignal = {
  keyResultRef: 'kr:campaign-orchestrator:pipeline-generated',
}
const kr_briefParseFidelity: RewardSignal = {
  keyResultRef: 'kr:campaign-orchestrator:brief-parse-fidelity',
}
const kr_audienceQuality: RewardSignal = {
  keyResultRef: 'kr:campaign-orchestrator:audience-quality',
}
const kr_contentQuality: RewardSignal = {
  keyResultRef: 'kr:campaign-orchestrator:content-quality',
}
const kr_creativeApprovalRate: RewardSignal = {
  keyResultRef: 'kr:campaign-orchestrator:creative-approval-rate',
}
const kr_sendLatency: RewardSignal = {
  keyResultRef: 'kr:campaign-orchestrator:send-latency',
}
const kr_measurementAccuracy: RewardSignal = {
  keyResultRef: 'kr:campaign-orchestrator:measurement-accuracy',
}
const kr_iterationQuality: RewardSignal = {
  keyResultRef: 'kr:campaign-orchestrator:iteration-quality',
}

// ============================================================================
// Campaign Orchestrator Service
// ============================================================================

/**
 * Campaign Orchestrator — campaign brief in, sent + measured + next-iteration-
 * recommended campaign out.
 *
 * Cascade: parse-brief (Code, structured intake)
 *        → build-audience (Agentic, supervised — segment definitions are
 *          judgment calls; large audiences additionally route to review-
 *          creative via the binding trigger)
 *        → draft-content (Generative, brand-voice-aligned)
 *        → review-creative (Agentic, supervised — final creative review
 *          gate before send)
 *        → schedule-send (Code, mailchimp.campaigns send + gmail.send for
 *          internal CC)
 *        → measure-cohort (Code, product-analytics.cohorts pull post-send)
 *        → analyze-and-iterate (Generative — recommendation for the next
 *          iteration based on measured CTR vs. target).
 *
 * Two declarative triggers wire HITL behaviour:
 *   - `audience.size > 100000` routes to `review-creative` (large blasts get
 *     supervised creative review regardless of normal autonomy thresholds);
 *   - `measurement.click_through_rate < 0.01` routes to `analyze-and-iterate`
 *     (under-performing campaigns get a structured next-iteration brief).
 */
export const campaignOrchestrator: ServiceInstance<CampaignBriefInput, CampaignResultOutput> =
  Service.define<CampaignBriefInput, CampaignResultOutput>({
    name: 'Campaign Orchestrator',
    promise: 'Campaign brief → audience build → content draft → send → measure → iterate',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: CampaignBriefInputSchema, output: CampaignResultOutputSchema },

    binding: {
      cascade: [
        Code({ name: 'parse-brief', reward: kr_briefParseFidelity, handler: () => undefined }),
        Agentic({
          name: 'build-audience',
          reward: kr_audienceQuality,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Generative({ name: 'draft-content', reward: kr_contentQuality }),
        Agentic({
          name: 'review-creative',
          reward: kr_creativeApprovalRate,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Code({ name: 'schedule-send', reward: kr_sendLatency, handler: () => undefined }),
        Code({ name: 'measure-cohort', reward: kr_measurementAccuracy, handler: () => undefined }),
        Generative({ name: 'analyze-and-iterate', reward: kr_iterationQuality }),
      ],
      toolPermissions: [
        'mailchimp.audiences',
        'mailchimp.campaigns',
        'crm.contacts',
        'product-analytics.cohorts',
        'gmail.send',
      ],
      clarificationPolicy: { enabled: true, maxRoundTrips: 2, escalateTo: 'marketing-lead' },
      triggers: [
        {
          // Large blasts (>100k recipients) route through supervised
          // creative review regardless of normal autonomy thresholds.
          when: 'audience.size > 100000',
          action: 'route-to',
          target: 'review-creative',
        },
        {
          // Under-performing campaigns (<1% CTR) route to the iterate step
          // for a structured next-iteration brief.
          when: 'measurement.click_through_rate < 0.01',
          action: 'route-to',
          target: 'analyze-and-iterate',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:campaign-orchestrator-review',
      personas: [
        // Voice reviewer — checks the drafted content matches the marketing
        // brand-voice guide (on-brand, audience-appropriate tone).
        Personas.voice({ brandVoiceRef: 'marketing-style-guide', name: 'voice-reviewer' }),
        // Targeting skeptic — adversarially probes the resolved audience
        // segment against the brief criteria; assumes the targeting is
        // wrong (over-broad or off-target) until proven otherwise.
        Personas.skeptic({ domain: 'audience-targeting', name: 'targeting-skeptic' }),
        // Attribution checker — fact-grounds the post-send measurement
        // against the analytics source of truth so the iterate brief
        // doesn't cite conversions the cohort never produced.
        Personas.accuracy({ domain: 'analytics-attribution', name: 'attribution-checker' }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:campaign-orchestrator:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-marketing-ops',
      seller: 'svc:campaign-orchestrator',
      serviceRef: 'svc:campaign-orchestrator',
      // AND(schema, panel, external): output validates, panel approves, AND
      // Mailchimp confirms the campaign was actually sent. The external
      // check pins the outcome to a verifiable side-effect rather than just
      // an LLM verdict.
      predicate: AND(
        SchemaMatch(CampaignResultOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        External({ verifier: 'mailchimp', spec: { sent: true } })
      ),
      amount: { amount: 9900n, currency: 'USD' },
      // 14-day SLA — campaigns measure across two-week windows (send-day to
      // post-send measurement + iterate brief).
      timeoutDays: 14,
      onTimeout: 'escalate',
    },

    pricing: Pricing.composite({
      base: { id: 'monthly-base', amount: 9900n, description: 'monthly subscription' },
      metered: [
        {
          event: 'campaign-sent',
          amount: 2500n,
          description: '$25 per campaign sent (covers send + measure + iterate)',
        },
      ],
    }),

    refundContract: 'partial-credit-on-partial-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 250n },
    reward: kr_pipelineGenerated,

    lineage: {
      cellRef: 'business.org.ai/cells/marketing-managers/campaign-execution',
      icpContextProblemRef: 'icp:campaign-orchestrator:v1',
      foundingHypothesisRef: 'fh:campaign-orchestrator:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
