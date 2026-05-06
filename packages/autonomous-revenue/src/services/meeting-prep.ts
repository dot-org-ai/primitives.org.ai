/**
 * Meeting Prep Service — second catalog Service in the revenue / sales line,
 * extending the autonomous-revenue package beyond round-5 lead-qualification.
 *
 * Demonstrates: per-invocation tiered pricing (volume ladder), multi-step-research
 * archetype, six-step Cascade with two supervised Agentic research steps
 * (participant + company), two single-shot Generative steps (brief synth +
 * talking-point suggestion), Code wrappers on the I/O ends (calendar pull +
 * email deliver), 6 external-API tool permissions (Google Calendar / LinkedIn
 * / Clearbit / CRM contacts / CRM opportunities / Gmail send), trigger-based
 * routing on exec-tier meetings with unknown participants, EvaluatorPanel of
 * 2 personas (accuracy fact-checker + 95% coverage floor), AND-composed
 * OutcomeContract predicate (SchemaMatch + EvaluatorPass), 1-day delivery SLA.
 *
 * Per design v3 §3.E (Catalog HOW agent's meeting-prep spec) + §6 (binding
 * triggers) + §7 (per-invocation pricing factory) + §8 (ProofPredicate AND).
 *
 * Layer note: this Service lives in `autonomous-revenue` (L5 catalog) on top
 * of the `services-as-software` + `autonomous-finance` substrate (per v3 §12
 * packaging tradeoff: each catalog domain ships in its own L5 package so the
 * substrate stays clean at L3).
 *
 * Service-level reward = `meeting-outcome-improved` — proxy for the downstream
 * pipeline-conversion / opportunity-progression hill the brief is designed
 * to nudge.
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
 * Input — a calendar event scheduled in the operator's primary calendar.
 * Tight: 4 fields capture the event identity, the attendee list (each with an
 * optional `knownContact` flag indicating CRM presence), the title (used as a
 * topical anchor for company research), and the wall-clock kickoff time.
 */
export const MeetingEventInputSchema = z.object({
  eventId: z.string(),
  attendees: z.array(
    z.object({
      email: z.string(),
      knownContact: z.boolean().optional(),
    })
  ),
  title: z.string(),
  scheduledAt: z.string(), // ISO-8601
})

/**
 * Output — a synthesized meeting brief ready for delivery the night before the
 * event. 5 top-level fields cover identity + per-participant briefs +
 * per-company briefs + suggested talking points + a delivery-time receipt.
 */
export const MeetingBriefOutputSchema = z.object({
  eventId: z.string(),
  participantBriefs: z.array(
    z.object({
      email: z.string(),
      name: z.string(),
      title: z.string(),
      seniority: z.string(),
      linkedinUrl: z.string().optional(),
      summary: z.string(),
    })
  ),
  companyBriefs: z.array(
    z.object({
      domain: z.string(),
      name: z.string(),
      industry: z.string(),
      employees: z.number(),
      recentNews: z.array(z.string()),
      summary: z.string(),
    })
  ),
  talkingPoints: z.array(z.string()),
  deliveredAt: z.string(), // ISO-8601
})

export type MeetingEventInput = z.infer<typeof MeetingEventInputSchema>
export type MeetingBriefOutput = z.infer<typeof MeetingBriefOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands. Service-level kr_meetingOutcomeImproved proxies the
// downstream pipeline-progression hill the brief is designed to nudge.
// ============================================================================

const kr_meetingOutcomeImproved: RewardSignal = {
  keyResultRef: 'kr:meeting-prep:meeting-outcome-improved',
}
const kr_briefCoverage: RewardSignal = { keyResultRef: 'kr:meeting-prep:brief-coverage' }
const kr_participantAccuracy: RewardSignal = {
  keyResultRef: 'kr:meeting-prep:participant-accuracy',
}
const kr_companyAccuracy: RewardSignal = { keyResultRef: 'kr:meeting-prep:company-accuracy' }
const kr_talkingPointQuality: RewardSignal = {
  keyResultRef: 'kr:meeting-prep:talking-point-quality',
}

// ============================================================================
// Meeting Prep Service
// ============================================================================

/**
 * Meeting Prep — calendar event → researched brief delivered the night before.
 *
 * Cascade: pull-event (Code) → research-participants (Agentic, supervised) →
 *          research-companies (Agentic, supervised) →
 *          synthesize-brief (Generative) → suggest-talking-points (Generative) →
 *          deliver (Code, gmail.send).
 *
 * High-volume, no clarification: `clarificationPolicy.enabled: false` — the
 * brief is synthesised from public + CRM signal; the operator doesn't pause
 * a meeting to clarify with the brief synthesizer.
 *
 * Trigger-based routing: exec-tier meetings with unknown participants route
 * back to `research-participants` for a deeper pass before the brief assembles
 * (catches the "VP showing up unannounced" case).
 */
export const meetingPrep: ServiceInstance<MeetingEventInput, MeetingBriefOutput> = Service.define<
  MeetingEventInput,
  MeetingBriefOutput
>({
  name: 'MeetingPrep',
  promise:
    'Every meeting briefed: participants researched, talking points ready, brief delivered the night before',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: MeetingEventInputSchema, output: MeetingBriefOutputSchema },

  binding: {
    cascade: [
      Code({ name: 'pull-event', reward: kr_briefCoverage, handler: () => undefined }),
      Agentic({
        name: 'research-participants',
        reward: kr_participantAccuracy,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Agentic({
        name: 'research-companies',
        reward: kr_companyAccuracy,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({ name: 'synthesize-brief', reward: kr_briefCoverage }),
      Generative({ name: 'suggest-talking-points', reward: kr_talkingPointQuality }),
      Code({ name: 'deliver', reward: kr_briefCoverage, handler: () => undefined }),
    ],
    toolPermissions: [
      'google-calendar.events',
      'linkedin.profiles',
      'clearbit.companies',
      'crm.contacts',
      'crm.opportunities',
      'gmail.send',
    ],
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        when: 'meeting.tier === "exec" && participants.unknown_count > 0',
        action: 'route-to',
        target: 'research-participants',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:meeting-prep-review',
    personas: [
      Personas.accuracy({ domain: 'participant-research', name: 'fact-checker' }),
      Personas.coverage({ minPercent: 0.95, name: 'completeness-floor' }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:meeting-prep:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-revenue-ops',
    seller: 'svc:meeting-prep',
    serviceRef: 'svc:meeting-prep',
    predicate: AND(
      SchemaMatch(MeetingBriefOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
    ),
    amount: { amount: 200n, currency: 'USD' },
    // Brief must be delivered the night before — 1-day timeout from booking.
    timeoutDays: 1,
    onTimeout: 'escalate',
  },

  pricing: Pricing.perInvocation({
    tiers: [
      { id: 'starter', amount: 200n, includedPerMonth: 50 },
      { id: 'team', amount: 150n, includedPerMonth: 500 },
      { id: 'enterprise', amount: 100n, includedPerMonth: 5000 },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  reward: kr_meetingOutcomeImproved,

  lineage: {
    cellRef: 'business.org.ai/cells/sales-representatives/meeting-preparation',
    icpContextProblemRef: 'icp:meeting-prep:v1',
    foundingHypothesisRef: 'fh:meeting-prep:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
