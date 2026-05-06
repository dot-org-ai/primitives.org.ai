/**
 * Tax Service — quarterly accruals, annual returns, multi-state filings,
 * and notice handling by a CPA-class agent + human reviewer.
 *
 * Distinguishing shape vs. bookkeeper:
 *   - 6-step cascade with the same earned-autonomy Human gate pattern
 *     (cpa-review with whenAccuracyExceeds: 0.99, whenSamplesExceed: 60)
 *     but tighter sample threshold than controller (60 vs 120) — tax is a
 *     lower-frequency surface;
 *   - 3-persona panel with a coverage-pedant floor (99% completeness) — tax
 *     forms are strictly enumerable, not a stylistic surface;
 *   - tiered outcome pricing: quarterly $499, annual $1,999, multi-state
 *     annual $3,999 — pure milestone billing, no subscription;
 *   - clarification policy maxRoundTrips: 3 (more dialogue than other
 *     finance Services — tax preparation is famously back-and-forth).
 *
 * Per design v3 §3 (Catalog HOW finance) + §6 (HITL with earned autonomy)
 * + §7 (outcome-tier pricing factory) + §8 (HumanSign predicate).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas
// ============================================================================

/**
 * Input — a tax period the Service is asked to compute, draft, and file
 * for. The `kind` discriminator drives pricing-tier selection downstream.
 */
export const TaxPeriodSchema = z.object({
  tenantId: z.string(),
  kind: z.enum(['quarterly-filing', 'annual-return', 'multi-state-annual']),
  jurisdictions: z.array(z.string()),
  periodStart: z.string(),
  periodEnd: z.string(),
  closedBooksRef: z.string(),
  priorReturnRef: z.string().optional(),
})

/**
 * Output — a filed return: liability calc, deduction record, the drafted
 * forms, and the filing receipt with CPA sign-off pointer.
 */
export const FiledReturnSchema = z.object({
  tenantId: z.string(),
  kind: z.enum(['quarterly-filing', 'annual-return', 'multi-state-annual']),
  period: z.object({ start: z.string(), end: z.string() }),
  jurisdictions: z.array(z.string()),
  liability: z.object({
    grossCents: z.bigint(),
    deductionsCents: z.bigint(),
    netDueCents: z.bigint(),
  }),
  deductions: z.array(
    z.object({
      id: z.string(),
      amountCents: z.bigint(),
      category: z.string(),
      citation: z.string(),
    })
  ),
  filings: z.array(
    z.object({
      jurisdiction: z.string(),
      formId: z.string(),
      receiptRef: z.string(),
    })
  ),
  cpaSignOffRef: z.string(),
  filedAt: z.string(),
})

export type TaxPeriod = z.infer<typeof TaxPeriodSchema>
export type FiledReturn = z.infer<typeof FiledReturnSchema>

// ============================================================================
// RewardSignal placeholder — minimise total tax burden net of risk.
// ============================================================================

const kr_taxBurdenOptimal: RewardSignal = { keyResultRef: 'kr:tax:burden-optimal' }

// ============================================================================
// Tax Service
// ============================================================================

/**
 * Tax — CPA-class quarterly + annual filings as a Service.
 *
 * Cascade: gather-period → categorize-deductions → compute-liability →
 *        draft-return → cpa-review (Human) → file.
 *
 * The Human cpa-review step has an earned-autonomy `expirationPolicy`
 * tighter than the controller's: 0.99 accuracy / 60 samples. Tax is lower-
 * frequency than the monthly close, so the migration window is shorter on
 * the sample axis even at the same accuracy floor.
 */
export const tax: ServiceInstance<TaxPeriod, FiledReturn> = Service.define<TaxPeriod, FiledReturn>({
  name: 'Tax',
  promise: 'Quarterly accruals, annual returns, filings, notices — handled by a CPA-class agent',
  audience: 'business',
  archetype: 'document-extraction',
  schema: { input: TaxPeriodSchema, output: FiledReturnSchema },

  binding: {
    cascade: [
      Code({ name: 'gather-period', reward: kr_taxBurdenOptimal, handler: () => undefined }),
      Agentic({
        name: 'categorize-deductions',
        reward: kr_taxBurdenOptimal,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Code({ name: 'compute-liability', reward: kr_taxBurdenOptimal, handler: () => undefined }),
      Generative({ name: 'draft-return', reward: kr_taxBurdenOptimal }),
      Human({
        name: 'cpa-review',
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 0.99, whenSamplesExceed: 60 },
      }),
      Code({ name: 'file', reward: kr_taxBurdenOptimal, handler: () => undefined }),
    ],
    toolPermissions: ['quickbooks.entries', 'irs.filings', 'state-tax.filings'],
    clarificationPolicy: {
      enabled: true,
      maxRoundTrips: 3,
      escalateTo: 'tax-cpa',
    },
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:tax-review',
    personas: [
      Personas.skeptic({ domain: 'tax-code-citation', name: 'cite-checker' }),
      Personas.domain({
        expertRef: 'occupations.org.ai/TaxPreparers',
        name: 'tax-pro',
      }),
      Personas.coverage({ minPercent: 0.99, name: 'completeness' }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:tax:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-cfo',
    seller: 'svc:tax',
    serviceRef: 'svc:tax',
    predicate: AND(
      SchemaMatch(FiledReturnSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['cpa'] })
    ),
    // Tier-defining amount; the runtime selects the realised tier from
    // `pricing.outcome.tiers` based on `TaxPeriod.kind` at settlement.
    amount: { amount: 49900n, currency: 'USD' },
    timeoutDays: 30,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      { id: 'quarterly-filing', amount: 49900n, currency: 'USD' },
      { id: 'annual-return', amount: 199900n, currency: 'USD' },
      { id: 'multi-state-annual', amount: 399900n, currency: 'USD' },
    ],
  }),

  refundContract: 'time-bounded-money-back',
  authorityBoundary: 'cpa-attest',
  costModel: { perInvocation: 500n },
  reward: kr_taxBurdenOptimal,

  lineage: {
    cellRef: 'business.org.ai/cells/tax-preparers/quarterly-and-annual-filing',
    icpContextProblemRef: 'icp:tax:v1',
    foundingHypothesisRef: 'fh:tax:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
