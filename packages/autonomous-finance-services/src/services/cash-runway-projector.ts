/**
 * Cash Runway Projector Service — finance team's monthly runway forecast service.
 *
 * Distinguishing shape vs. siblings in the finance catalog:
 *   - `forecast-narrative` archetype — the artefact is a CFO-grade scenario
 *     narrative + projection deck, not a transactional adjudication or
 *     document-extraction;
 *   - 4-step cascade: Code(fetch-cash-balances) → Code(extract-burn-rate) →
 *     Generative(synthesize-runway-narrative-with-scenarios) →
 *     Code(emit-projection-deck);
 *   - `subscription` pricing — the runway forecast is a recurring
 *     monthly-close cadence Service consumed by the finance team
 *     ($799/mo for finance-team subscription);
 *   - declarative HITL via CFO sign-off in the OutcomeContract — every
 *     runway deck ships with the CFO's name on it before it goes to the
 *     board / leadership audience;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(scenario-realism +
 *     ledger-tie-out) + HumanSign(CFO))`.
 *
 * Per design v3 §3 (Catalog HOW finance) + §6 (binding triggers, conditional
 * HumanSign) + §7 (subscription pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `cfo-quarterly-confidence-score` — qualitative but
 * trackable via NPS-style monthly survey to the CFO.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a monthly close + cash-position snapshot. Tight: 6 fields cover
 * tenant identity, the close period, and the connected ledger / banking /
 * billing sources from which the cascade pulls cash balances + burn signals.
 */
export const CashSnapshotInputSchema = z.object({
  tenantRef: z.string(),
  closePeriod: z.object({
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12),
  }),
  ledgerSources: z.array(z.enum(['quickbooks', 'netsuite', 'xero'])),
  bankSources: z.array(z.enum(['plaid', 'mercury', 'brex', 'svb'])),
  billingSources: z.array(z.enum(['stripe', 'chargebee', 'maxio'])).optional(),
  scenarios: z
    .array(z.enum(['base', 'upside', 'downside', 'conservative-hiring', 'paused-hiring']))
    .min(1),
})

/**
 * Output — a runway projection deck: the consolidated cash position, the
 * derived burn rate, the multi-scenario runway narrative, and pointers to
 * the rendered projection deck artefacts (PDF + Google Slides).
 */
export const RunwayProjectionOutputSchema = z.object({
  tenantRef: z.string(),
  closePeriod: z.object({
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12),
  }),
  cashPosition: z.object({
    totalCashCents: z.bigint(),
    operatingAccounts: z.array(
      z.object({
        accountRef: z.string(),
        balanceCents: z.bigint(),
        institution: z.string(),
      })
    ),
    sweepInvestments: z.bigint(),
  }),
  burnRate: z.object({
    grossBurnCentsPerMonth: z.bigint(),
    netBurnCentsPerMonth: z.bigint(),
    trailingMonths: z.number().int().min(1).max(24),
    revenueCentsPerMonth: z.bigint(),
  }),
  scenarios: z.array(
    z.object({
      id: z.enum(['base', 'upside', 'downside', 'conservative-hiring', 'paused-hiring']),
      runwayMonths: z.number(),
      assumptions: z.array(z.string()),
      narrativeMarkdown: z.string(),
    })
  ),
  deck: z.object({
    pdfUrl: z.string(),
    slidesUrl: z.string(),
    pageCount: z.number().int().positive(),
  }),
  cfoReviewRef: z.string().optional(),
  generatedAt: z.string(),
})

export type CashSnapshotInput = z.infer<typeof CashSnapshotInputSchema>
export type RunwayProjectionOutput = z.infer<typeof RunwayProjectionOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_cfoConfidence: RewardSignal = {
  keyResultRef: 'kr:cash-runway-projector:cfo-quarterly-confidence-score',
}
const kr_balanceCoverage: RewardSignal = {
  keyResultRef: 'kr:cash-runway-projector:balance-coverage',
}
const kr_burnAccuracy: RewardSignal = {
  keyResultRef: 'kr:cash-runway-projector:burn-rate-accuracy',
}
const kr_scenarioRealism: RewardSignal = {
  keyResultRef: 'kr:cash-runway-projector:scenario-realism',
}
const kr_deckRenderLatency: RewardSignal = {
  keyResultRef: 'kr:cash-runway-projector:deck-render-latency',
}

// ============================================================================
// Cash Runway Projector Service
// ============================================================================

/**
 * Cash Runway Projector — monthly close + cash snapshot → multi-scenario
 * runway narrative → CFO-signed projection deck as a Service.
 *
 * Cascade: fetch-cash-balances (Code, ledger + bank pulls)
 *        → extract-burn-rate (Code, trailing-N-month derivation)
 *        → synthesize-runway-narrative-with-scenarios (Generative)
 *        → emit-projection-deck (Code, slides + PDF render).
 */
export const cashRunwayProjector: ServiceInstance<CashSnapshotInput, RunwayProjectionOutput> =
  Service.define<CashSnapshotInput, RunwayProjectionOutput>({
    name: 'Cash Runway Projector',
    promise:
      'Every month, the finance team gets a CFO-signed runway deck — multi-scenario, ledger-tied, board-ready — within 24 hours of close.',
    audience: 'business',
    archetype: 'forecast-narrative',
    schema: { input: CashSnapshotInputSchema, output: RunwayProjectionOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-cash-balances',
          reward: kr_balanceCoverage,
          handler: () => undefined,
        }),
        Code({
          name: 'extract-burn-rate',
          reward: kr_burnAccuracy,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-runway-narrative-with-scenarios',
          reward: kr_scenarioRealism,
        }),
        Code({
          name: 'emit-projection-deck',
          reward: kr_deckRenderLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'quickbooks.balances',
        'netsuite.balances',
        'plaid.accounts',
        'mercury.accounts',
        'brex.accounts',
        'stripe.subscriptions',
        'chargebee.subscriptions',
        'gdrive.slides',
        'gdrive.files',
      ],
      // Monthly close cadence: clarification disabled — the runway deck
      // synthesises from the ledger + banking signals; the cascade does
      // not pause to clarify with finance ops.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Sub-6-month runway escalates straight to the CFO with a
          // priority flag — the deck still runs end-to-end, but the CFO
          // is paged out-of-band.
          when: 'scenarios.base.runwayMonths < 6',
          action: 'escalate',
        },
        {
          // Every deck routes through CFO sign-off before it ships;
          // OutcomeContract enforces this, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'cfo-sign-off',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:cash-runway-projector-review',
      personas: [
        // Scenario realism reviewer — adversarially probes whether the
        // multi-scenario runway story holds up under operating-plan
        // assumptions a senior FP&A analyst would actually defend.
        Personas.skeptic({
          domain: 'scenario-realism',
          focus: ['burn-trajectory-realistic', 'revenue-assumption-defensible', 'no-magic-savings'],
          name: 'scenario-realism-reviewer',
        }),
        // Ledger tie-out reviewer — pedantic check that every cash figure
        // in the deck reconciles to a ledger-supported source.
        Personas.pedantic({
          domain: 'ledger-tie-out',
          rubric: [
            'cash-balance-reconciles-to-ledger',
            'burn-rate-derivable-from-statements',
            'revenue-reconciles-to-billing-system',
            'no-orphaned-figure',
          ],
          name: 'ledger-tie-out-checker',
        }),
        // CFO domain reviewer — pulls the CFO expert from
        // business.org.ai for senior-finance judgment on the overall deck.
        Personas.domain({
          expertRef: 'occupations.org.ai/ChiefExecutives',
          name: 'cfo-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:cash-runway-projector:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-cfo',
      seller: 'svc:cash-runway-projector',
      serviceRef: 'svc:cash-runway-projector',
      // CFO signs every runway deck before it ships to the board / leadership.
      predicate: AND(
        SchemaMatch(RunwayProjectionOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['cfo'] })
      ),
      amount: { amount: 79900n, currency: 'USD' },
      // 5-day SLA — the cascade fires at month-close and the CFO needs the
      // deck within a week to brief the board.
      timeoutDays: 5,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'cash-runway-projector-monthly',
        amount: 79900n,
        currency: 'USD',
        interval: 'month',
      },
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 600n, perApiCall: 5n },
    reward: kr_cfoConfidence,

    lineage: {
      cellRef: 'business.org.ai/cells/financial-managers/cash-runway-projection',
      icpContextProblemRef: 'icp:cash-runway-projector:v1',
      foundingHypothesisRef: 'fh:cash-runway-projector:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
