/**
 * Board Deck Financials Pack Service — board-meeting financial-section
 * authoring Service for the finance-services catalog.
 *
 * Distinguishing shape vs. siblings (`bookkeeper`, `controller`, `ap`, `ar`,
 * `tax`, `treasury`, `payroll`, `audit-prep`, `expense-policy-enforcer`,
 * `cash-runway-projector`):
 *   - `forecast-narrative` archetype — the artefact is the financial-section
 *     pages of the board deck (variance-explained narrative + forward-looking
 *     risks + asks), not bookkeeping / runway / a transactional adjudication;
 *   - 5-step cascade with a Code fan-in (financials + KPI snapshot), two
 *     Generative narrative steps (variance-explained narrative, then
 *     forward-looking risks-and-asks), a load-bearing Human CFO+CEO review,
 *     and a Code render fan-out;
 *   - `subscription` pricing — board-cycle subscription at $1,499/mo (the
 *     deck cadence is monthly book-close + scheduled board meeting);
 *   - declarative HITL = mandatory CFO+CEO review Human Function plus
 *     OutcomeContract enforces a CFO signature (the board deck has the CFO's
 *     name on it, and the CEO's review is the second pair of eyes);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(narrative-coherence
 *     + variance-tieout) + HumanSign(CFO))`.
 *
 * Per design v3 §3 (Catalog HOW finance) + §6 (binding triggers, conditional
 * HumanSign) + §7 (subscription pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `board-prep-cycle-time-reduction` — the compound
 * metric every CFO optimises against on the board cadence (the alternative is
 * a 60-hour scramble between book-close and the board meeting; this Service
 * is worth running iff the cycle-time trends down vs. the pre-Service
 * baseline).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a monthly book-close + scheduled board meeting. Tight: 6 fields
 * cover tenant identity, the close period, the board-meeting date, the
 * connected sources from which the cascade pulls financials + KPIs, and the
 * named CFO + CEO references the Human review step routes to.
 */
export const BoardCycleInputSchema = z.object({
  tenantRef: z.string(),
  closePeriod: z.object({
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12),
  }),
  boardMeetingAt: z.string(), // ISO-8601
  ledgerSources: z.array(z.enum(['quickbooks', 'netsuite', 'xero'])),
  kpiSources: z.array(z.enum(['stripe', 'chargebee', 'maxio', 'mixpanel', 'amplitude'])),
  reviewers: z.object({
    cfoRef: z.string(),
    ceoRef: z.string(),
  }),
})

/**
 * Output — board-deck financial-section pages: the consolidated financials
 * snapshot, the KPI snapshot, the variance-explained narrative, the
 * forward-looking risks-and-asks, the CFO+CEO review audit, and pointers to
 * the rendered final deck pages.
 */
export const BoardDeckFinancialsOutputSchema = z.object({
  tenantRef: z.string(),
  closePeriod: z.object({
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12),
  }),
  boardMeetingAt: z.string(),
  financialsSnapshot: z.object({
    revenueCents: z.bigint(),
    grossMarginPercent: z.number(),
    operatingExpensesCents: z.bigint(),
    netIncomeCents: z.bigint(),
    cashBalanceCents: z.bigint(),
  }),
  kpiSnapshot: z.array(
    z.object({
      id: z.string(),
      currentValue: z.number(),
      priorValue: z.number(),
      planValue: z.number().optional(),
      direction: z.enum(['better', 'worse', 'flat']),
    })
  ),
  varianceNarrative: z.object({
    bodyMarkdown: z.string(),
    variancesExplained: z.array(
      z.object({ kpiId: z.string(), driver: z.string(), magnitudeCents: z.bigint() })
    ),
  }),
  forwardLooking: z.object({
    risks: z.array(z.object({ title: z.string(), severity: z.enum(['low', 'med', 'high']) })),
    asks: z.array(z.object({ title: z.string(), askType: z.enum(['budget', 'hire', 'decision']) })),
  }),
  review: z.object({
    cfoSignedAt: z.string(),
    ceoReviewedAt: z.string(),
    decision: z.enum(['ship-as-drafted', 'edit-and-ship', 'block']),
  }),
  deck: z.object({
    pdfUrl: z.string(),
    slidesUrl: z.string(),
    pageCount: z.number().int().positive(),
  }),
  generatedAt: z.string(),
})

export type BoardCycleInput = z.infer<typeof BoardCycleInputSchema>
export type BoardDeckFinancialsOutput = z.infer<typeof BoardDeckFinancialsOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_boardPrepCycleTime: RewardSignal = {
  keyResultRef: 'kr:board-deck-financials-pack:board-prep-cycle-time-reduction',
}
const kr_signalCoverage: RewardSignal = {
  keyResultRef: 'kr:board-deck-financials-pack:signal-coverage',
}
const kr_narrativeCoherence: RewardSignal = {
  keyResultRef: 'kr:board-deck-financials-pack:narrative-coherence',
}
const kr_forwardLookingQuality: RewardSignal = {
  keyResultRef: 'kr:board-deck-financials-pack:forward-looking-quality',
}
const kr_renderLatency: RewardSignal = {
  keyResultRef: 'kr:board-deck-financials-pack:render-latency',
}

// ============================================================================
// Board Deck Financials Pack Service
// ============================================================================

/**
 * Board Deck Financials Pack — book-close + board-meeting cycle → CFO-signed
 * financial-section deck pages as a Service.
 *
 * Cascade: fetch-financials-and-kpi-snapshot (Code, ledger + KPI fan-in)
 *        → narrative-author-with-variance-explanations (Generative)
 *        → forward-looking-risks-and-asks (Generative)
 *        → cfo-and-ceo-review (Human, load-bearing)
 *        → render-final-deck-pages (Code, slides + PDF render).
 */
export const boardDeckFinancialsPack: ServiceInstance<BoardCycleInput, BoardDeckFinancialsOutput> =
  Service.define<BoardCycleInput, BoardDeckFinancialsOutput>({
    name: 'Board Deck Financials Pack',
    promise:
      'Every board cycle, the CFO ships a board-ready financial-section deck — variance-explained narrative + forward-looking risks-and-asks, CFO + CEO reviewed — within days of book-close.',
    audience: 'business',
    archetype: 'forecast-narrative',
    schema: { input: BoardCycleInputSchema, output: BoardDeckFinancialsOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-financials-and-kpi-snapshot',
          reward: kr_signalCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'narrative-author-with-variance-explanations',
          reward: kr_narrativeCoherence,
        }),
        Generative({
          name: 'forward-looking-risks-and-asks',
          reward: kr_forwardLookingQuality,
        }),
        Human({
          name: 'cfo-and-ceo-review',
          rationale: 'approval',
          // Board-deck sign-off stays human — CFO + CEO names are on the deck.
          // No promotion threshold ever displaces this step.
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'render-final-deck-pages',
          reward: kr_renderLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'quickbooks.balances',
        'quickbooks.reports',
        'netsuite.balances',
        'netsuite.reports',
        'stripe.metrics',
        'chargebee.metrics',
        'mixpanel.kpis',
        'amplitude.kpis',
        'gdrive.slides',
        'gdrive.files',
      ],
      // Board-cycle cadence: clarification disabled — the deck synthesises
      // from the ledger + KPI signals; the cascade does not pause to clarify
      // with finance ops. The CFO+CEO review step at the end is the single
      // human contact point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Material variance (any KPI off-plan by > 20%) escalates to the
          // CFO out-of-band before the deck ships, in addition to the
          // regular review step.
          when: 'kpiSnapshot.some(k => Math.abs((k.currentValue - (k.planValue ?? k.currentValue)) / Math.max(k.planValue ?? 1, 1)) > 0.2)',
          action: 'escalate',
        },
        {
          // Every deck routes through CFO+CEO review before it ships;
          // OutcomeContract enforces this, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'cfo-and-ceo-review',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:board-deck-financials-pack-review',
      personas: [
        // Narrative coherence reviewer — the variance narrative must hold
        // together as a story a board member can follow without the
        // backing data, with no contradictory claims across pages.
        Personas.skeptic({
          domain: 'narrative-coherence',
          focus: ['no-contradictions', 'each-variance-has-a-driver', 'tells-one-story'],
          name: 'narrative-coherence-reviewer',
        }),
        // Variance tie-out reviewer — pedantic check that every variance
        // figure cited reconciles to a ledger-supported source and that the
        // KPI snapshot ties to the source-of-record.
        Personas.pedantic({
          domain: 'variance-tieout',
          rubric: [
            'variance-magnitudes-tie-to-ledger',
            'kpi-values-tie-to-source-of-record',
            'no-orphaned-figure',
            'prior-period-is-correctly-restated',
          ],
          name: 'variance-tieout-checker',
        }),
        // CFO domain reviewer — pulls the senior-finance expert for
        // judgment on the overall board-section.
        Personas.domain({
          expertRef: 'occupations.org.ai/ChiefExecutives',
          name: 'cfo-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:board-deck-financials-pack:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-cfo',
      seller: 'svc:board-deck-financials-pack',
      serviceRef: 'svc:board-deck-financials-pack',
      // CFO signs every board deck before it ships — the deck has the CFO's
      // name on it, the CEO is the second pair of eyes captured in
      // `review.ceoReviewedAt`.
      predicate: AND(
        SchemaMatch(BoardDeckFinancialsOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['cfo'] })
      ),
      amount: { amount: 149900n, currency: 'USD' },
      // 7-day SLA — book-close fires and the board meeting needs the deck
      // a clean week ahead of the convene.
      timeoutDays: 7,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'board-deck-financials-pack-monthly',
        amount: 149900n,
        currency: 'USD',
        interval: 'month',
      },
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 1200n, perApiCall: 5n },
    reward: kr_boardPrepCycleTime,

    lineage: {
      cellRef: 'business.org.ai/cells/financial-managers/board-deck-financials-pack',
      icpContextProblemRef: 'icp:board-deck-financials-pack:v1',
      foundingHypothesisRef: 'fh:board-deck-financials-pack:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
