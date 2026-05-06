/**
 * Payroll Service — biweekly pay run preparation, deductions, employer-tax
 * calculation, payroll-admin sign-off, execution, and quarterly tax filings
 * under a KYC/AML authority boundary.
 *
 * Distinguishing shape vs. controller:
 *   - transactional-workflow archetype (per-employee fan-out across a fixed
 *     pay period) vs the controller's monthly document-extraction;
 *   - 7-step cascade with a Human gate (`review`) carrying the tightest
 *     earned-autonomy thresholds in the catalog (0.99 accuracy, 24 samples)
 *     — pay runs are a low-frequency, high-stakes surface;
 *   - 3-persona panel: 100% coverage floor (every employee accounted for),
 *     a withholding skeptic, and a payroll-clerk domain expert;
 *   - composite pricing (flat monthly base + metered per-employee-per-run);
 *   - OutcomeContract requires payroll-admin HumanSign + External
 *     verification from Gusto that the run completed.
 *
 * Per design v3 §3 (Catalog HOW finance) + §6 (binding triggers + earned
 * autonomy) + §7 (composite pricing factory) + §8 (AND-composed predicates
 * with HumanSign + External).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, External, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas
// ============================================================================

/**
 * Input — a pay period and the employee roster the Service is asked to
 * prepare, approve, and execute. `employees` is a reference-array the
 * upstream connector resolves to live employee records at ingest time.
 */
export const PayrollPeriodInputSchema = z.object({
  tenantId: z.string(),
  period: z.object({ start: z.string(), end: z.string() }),
  employees: z.array(z.string()),
  payDate: z.string(),
  priorRunRef: z.string().optional(),
})

/**
 * Output — the executed pay run: per-employee gross + net, employer-side
 * tax total, the filings receipt list, and the execution timestamp.
 */
export const PayrollRunOutputSchema = z.object({
  tenantId: z.string(),
  period: z.object({ start: z.string(), end: z.string() }),
  grossByEmployee: z.array(
    z.object({
      employeeRef: z.string(),
      grossCents: z.bigint(),
    })
  ),
  netByEmployee: z.array(
    z.object({
      employeeRef: z.string(),
      netCents: z.bigint(),
    })
  ),
  employerTaxesCents: z.bigint(),
  filings: z.array(
    z.object({
      jurisdiction: z.string(),
      formId: z.string(),
      receiptRef: z.string(),
    })
  ),
  payrollAdminSignOffRef: z.string(),
  executedAt: z.string(),
})

export type PayrollPeriodInput = z.infer<typeof PayrollPeriodInputSchema>
export type PayrollRunOutput = z.infer<typeof PayrollRunOutputSchema>

// ============================================================================
// RewardSignal placeholder — on-time + accurate pay-run rate. Real $.Reward
// ref lands with business-as-code.
// ============================================================================

const kr_payrollOnTimeAccuracy: RewardSignal = {
  keyResultRef: 'kr:payroll:on-time-accuracy',
}

// ============================================================================
// Payroll Service
// ============================================================================

/**
 * Payroll — biweekly pay-run preparation, approval, execution, and
 * quarterly filings as a Service.
 *
 * Cascade: gather-period → compute-gross → compute-deductions (supervised) →
 *        compute-employer-taxes (supervised) → review (Human) →
 *        execute-pay-run → file-quarterly-tax.
 *
 * One declarative trigger gates the flow: any 10%+ delta in gross pay vs the
 * prior period routes to `review` regardless of normal autonomy thresholds.
 *
 * The Human `review` step has the tightest earned-autonomy expirationPolicy
 * in the catalog (0.99 accuracy / 24 samples) — pay runs are low-frequency,
 * high-stakes, and the migration window is correspondingly short. The
 * `kyc-aml-required` boundary keeps execution gated on identity verification.
 */
export const payroll: ServiceInstance<PayrollPeriodInput, PayrollRunOutput> = Service.define<
  PayrollPeriodInput,
  PayrollRunOutput
>({
  name: 'Payroll',
  promise: 'Pay run prepared, approved, executed — with all tax withholdings and filings',
  audience: 'business',
  archetype: 'transactional-workflow',
  schema: { input: PayrollPeriodInputSchema, output: PayrollRunOutputSchema },

  binding: {
    cascade: [
      Code({ name: 'gather-period', reward: kr_payrollOnTimeAccuracy, handler: () => undefined }),
      Code({ name: 'compute-gross', reward: kr_payrollOnTimeAccuracy, handler: () => undefined }),
      Agentic({
        name: 'compute-deductions',
        reward: kr_payrollOnTimeAccuracy,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Agentic({
        name: 'compute-employer-taxes',
        reward: kr_payrollOnTimeAccuracy,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Human({
        name: 'review',
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 0.99, whenSamplesExceed: 24 },
      }),
      Code({ name: 'execute-pay-run', reward: kr_payrollOnTimeAccuracy, handler: () => undefined }),
      Code({
        name: 'file-quarterly-tax',
        reward: kr_payrollOnTimeAccuracy,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'gusto.employees',
      'gusto.runs',
      'irs.filings',
      'state-tax.filings',
      'stripe.transfers',
    ],
    clarificationPolicy: {
      enabled: true,
      maxRoundTrips: 2,
      escalateTo: 'payroll-admin',
    },
    triggers: [
      {
        when: 'gross_pay.delta > 0.10',
        action: 'route-to',
        target: 'review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:payroll-review',
    personas: [
      Personas.coverage({ minPercent: 1.0, name: 'completeness' }),
      Personas.skeptic({ domain: 'tax-withholding', name: 'withholding-checker' }),
      Personas.domain({
        expertRef: 'occupations.org.ai/PayrollAndTimekeepingClerks',
        name: 'payroll-pro',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:payroll:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-cfo',
    seller: 'svc:payroll',
    serviceRef: 'svc:payroll',
    predicate: AND(
      SchemaMatch(PayrollRunOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['payroll-admin'] }),
      External({ verifier: 'gusto', spec: { run_completed: true } })
    ),
    amount: { amount: 19900n, currency: 'USD' },
    // 3-day window from period close to executed pay run.
    timeoutDays: 3,
    onTimeout: 'escalate',
  },

  pricing: Pricing.composite({
    base: { id: 'monthly-base', amount: 19900n },
    metered: [{ event: 'employee-pay-run', amount: 600n }],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'kyc-aml-required',
  costModel: { perInvocation: 200n },
  reward: kr_payrollOnTimeAccuracy,

  lineage: {
    cellRef: 'business.org.ai/cells/payroll-clerks/biweekly-pay-run',
    icpContextProblemRef: 'icp:payroll:v1',
    foundingHypothesisRef: 'fh:payroll:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
