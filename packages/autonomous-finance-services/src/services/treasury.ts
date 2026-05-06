/**
 * Treasury Service — daily cash position, FX normalisation, runway forecast,
 * covenant monitoring, and supervised sweep-or-alert under a fiduciary
 * authority boundary.
 *
 * Distinguishing shape vs. controller:
 *   - data-enrichment archetype (per-day fan-in/fan-out across accounts) vs
 *     the controller's monthly document-extraction;
 *   - 6-step cascade with TWO supervised agentic gates (`check-covenants`,
 *     `sweep-or-alert`) and NO Human step on the happy path — autonomy by
 *     default with declarative escalation triggers (low runway, covenant
 *     breach);
 *   - 3-persona panel: FX skeptic, forecast accuracy reviewer, and a
 *     covenant-compliance skeptic — all with name overrides;
 *   - subscription pricing with per-account-day metered overage;
 *   - regulated authority boundary (`fiduciary-investment-advice`) — sweep
 *     decisions must compose against the boundary; cross-tenant investment
 *     recommendations stay out of scope.
 *
 * Per design v3 §3 (Catalog HOW finance) + §6 (binding triggers + autonomy)
 * + §7 (subscription pricing factory) + §8 (AND-composed predicates) +
 * §11 (clarification policy with CFO escalation).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas
// ============================================================================

/**
 * Input — a single trading-day snapshot the Service is asked to position,
 * forecast, and (if safe) sweep. `accounts` and `currencies` are reference-
 * arrays the upstream connector resolves to live balances at ingest time.
 */
export const TreasuryDayInputSchema = z.object({
  tenantId: z.string(),
  period: z.object({ date: z.string() }),
  accounts: z.array(z.string()),
  currencies: z.array(z.string()),
  covenantsRef: z.string().optional(),
})

/**
 * Output — the published cash position with FX-normalised totals, runway
 * forecast, covenant status, and the ranked recommendation list the
 * downstream `sweep-or-alert` step acted (or did not act) on.
 */
export const TreasuryPositionOutputSchema = z.object({
  tenantId: z.string(),
  period: z.object({ date: z.string() }),
  cashByCurrency: z.array(
    z.object({
      currency: z.string(),
      amountCents: z.bigint(),
    })
  ),
  totalUsdCents: z.bigint(),
  runway: z.object({
    months: z.number(),
    basis: z.enum(['trailing-3mo-burn', 'trailing-6mo-burn', 'forecast-12mo-burn']),
  }),
  covenants: z.object({
    breach: z.boolean(),
    details: z.string().optional(),
  }),
  recommendations: z.array(
    z.object({
      id: z.string(),
      action: z.enum(['sweep', 'hold', 'alert', 'fx-rebalance']),
      rationale: z.string(),
      amountCents: z.bigint().optional(),
    })
  ),
  publishedAt: z.string(),
})

export type TreasuryDayInput = z.infer<typeof TreasuryDayInputSchema>
export type TreasuryPositionOutput = z.infer<typeof TreasuryPositionOutputSchema>

// ============================================================================
// RewardSignal placeholder — runway clarity (visible-runway-months /
// forecast-error). Real $.Reward ref lands with business-as-code.
// ============================================================================

const kr_runwayClarity: RewardSignal = { keyResultRef: 'kr:treasury:runway-clarity' }

// ============================================================================
// Treasury Service
// ============================================================================

/**
 * Treasury — daily cash position + FX + runway + covenants + sweep as a
 * Service.
 *
 * Cascade: ingest-balances → fx-normalize → forecast-runway →
 *        check-covenants (supervised) → sweep-or-alert (supervised) →
 *        publish-position.
 *
 * Two declarative triggers gate the flow:
 *   - `runway_months < 6` escalates per oversight policy;
 *   - any `covenant.breach` routes to `sweep-or-alert` for supervised
 *     remediation before publication.
 *
 * The `fiduciary-investment-advice` boundary keeps any sweep recommendation
 * scoped to the tenant's own accounts; cross-counterparty advice is
 * out-of-scope until the boundary lifts.
 */
export const treasury: ServiceInstance<TreasuryDayInput, TreasuryPositionOutput> = Service.define<
  TreasuryDayInput,
  TreasuryPositionOutput
>({
  name: 'Treasury',
  promise: 'Daily cash position, sweep, FX, and runway forecast — managed under your covenants',
  audience: 'business',
  archetype: 'data-enrichment',
  schema: { input: TreasuryDayInputSchema, output: TreasuryPositionOutputSchema },

  binding: {
    cascade: [
      Code({ name: 'ingest-balances', reward: kr_runwayClarity, handler: () => undefined }),
      Code({ name: 'fx-normalize', reward: kr_runwayClarity, handler: () => undefined }),
      Generative({ name: 'forecast-runway', reward: kr_runwayClarity }),
      Agentic({
        name: 'check-covenants',
        reward: kr_runwayClarity,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Agentic({
        name: 'sweep-or-alert',
        reward: kr_runwayClarity,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Code({ name: 'publish-position', reward: kr_runwayClarity, handler: () => undefined }),
    ],
    toolPermissions: ['plaid.balances', 'mercury.accounts', 'fx.rates', 'stripe.transfers'],
    clarificationPolicy: {
      enabled: true,
      maxRoundTrips: 1,
      escalateTo: 'cfo',
    },
    triggers: [
      { when: 'runway_months < 6', action: 'escalate' },
      { when: 'covenant.breach', action: 'route-to', target: 'sweep-or-alert' },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:treasury-review',
    personas: [
      Personas.skeptic({ domain: 'fx-rate-validation', name: 'fx-checker' }),
      Personas.accuracy({ domain: 'forecast-grounding', name: 'forecast-checker' }),
      Personas.skeptic({ domain: 'covenant-compliance', name: 'covenant-skeptic' }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:treasury:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-cfo',
    seller: 'svc:treasury',
    serviceRef: 'svc:treasury',
    predicate: AND(
      SchemaMatch(TreasuryPositionOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
    ),
    amount: { amount: 49900n, currency: 'USD' },
    // 1-day SLA — daily position must publish on the trading day.
    timeoutDays: 1,
    onTimeout: 'escalate',
  },

  pricing: Pricing.subscription({
    plan: { id: 'monthly', amount: 49900n, currency: 'USD', interval: 'month' },
    metered: [{ event: 'account-day-tracked', amount: 5n }],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'fiduciary-investment-advice',
  costModel: { perInvocation: 100n },
  reward: kr_runwayClarity,

  lineage: {
    cellRef: 'business.org.ai/cells/treasury-analysts/daily-cash-position',
    icpContextProblemRef: 'icp:treasury:v1',
    foundingHypothesisRef: 'fh:treasury:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
