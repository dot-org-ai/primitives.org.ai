/**
 * services-as-software v4 — the ACCEPTED/REFUNDED-phase SETTLER adapter
 * (aip-cnks.10 pass 2).
 *
 * This is the concrete {@link Settler} that drives the terminal `ACCEPTED` /
 * `REFUNDED` phases of the invocation FSM (see `./invoke.ts`) by adapting an
 * INJECTED `business-as-code/finance` {@link FinanceProvider} port into the v4
 * settlement port. The provider is a Layer-5 economic substrate that
 * services-as-software (L6) consumes — the adapter never imports a concrete
 * rail (Stripe/Tempo/x402/…); it depends only on the abstract port, and the
 * caller wires whichever provider they run.
 *
 * ## The mapping
 *
 *   - `charge({ basis, amount, buyer, ref })`
 *       → `provider.charge({ buyer, amount, ref })`
 *       → a `charged` {@link Settlement} that RETAINS the provider's charge
 *         `$id` as both `chargeId` (so a later refund can reference the exact
 *         capture) and `contract` (the settlement's outcome-contract ref).
 *   - `refund({ chargeId, amount })`
 *       → `provider.refund(chargeId, amount)`
 *       → a `refunded` {@link Settlement} carrying the refund `$id` as `per`.
 *
 * ## The `no-prior-charge` sentinel
 *
 * The invocation FSM's pre-charge refund path (an escalation resolved with
 * `refund` before any `accept()` ran) hands the {@link Settler} a
 * `no-prior-charge` sentinel `chargeId` meaning "reverse the guarantee, nothing
 * was captured." The adapter SHORT-CIRCUITS that to a `noop` settlement with NO
 * provider call — there is no charge to reverse.
 *
 * @packageDocumentation
 */

import type {
  ChargeOpts,
  ChargeResult,
  FinanceProvider,
  ProviderCapabilities,
  RefundResult,
} from 'business-as-code/finance'
import type { Money } from 'business-as-code/finance'

import type { ChargeArgs, RefundArgs, Settler } from './invoke.js'
import type { Settlement } from './types.js'

/** The pre-charge sentinel the FSM passes when no `accept()` ran (see docblock). */
const NO_PRIOR_CHARGE = 'no-prior-charge'

// ============================================================================
// makeFinanceSettler — the adapter
// ============================================================================

/**
 * Adapt a `business-as-code/finance` {@link FinanceProvider} into the v4
 * {@link Settler} port (see the module docblock for the mapping). Injectable
 * into `createInvocationHandle({ settler })`.
 */
export function makeFinanceSettler(provider: FinanceProvider): Settler {
  return {
    async charge(args: ChargeArgs): Promise<Settlement> {
      const opts: ChargeOpts = {
        buyer: args.buyer,
        amount: args.amount,
        ...(args.ref !== undefined ? { ref: args.ref } : {}),
      }
      const result = await provider.charge(opts)
      return {
        outcome: 'charged',
        chargeId: result.$id,
        captured: args.amount,
        basis: args.basis,
        // The charge id doubles as the settlement's outcome-contract ref —
        // the firmware binds the capture to the contract under the same id.
        contract: result.$id,
      }
    },

    async refund(args: RefundArgs): Promise<Settlement> {
      // Pre-charge sentinel: nothing was captured, so there is nothing to
      // reverse — short-circuit to a noop with NO provider call.
      if (args.chargeId === NO_PRIOR_CHARGE) {
        return { outcome: 'noop', reason: 'cancelled-pre-charge' }
      }
      const result = await provider.refund(args.chargeId, args.amount)
      return {
        outcome: 'refunded',
        amount: result.amount,
        per: result.$id,
        chargeId: args.chargeId,
      }
    },
  }
}

// ============================================================================
// stubFinanceProvider — a tiny in-memory FinanceProvider for tests
// ============================================================================

/** The recording surface a {@link stubFinanceProvider} exposes for assertions. */
export interface StubFinanceProvider extends FinanceProvider {
  /** Every `charge` call, in order. */
  readonly charges: ReadonlyArray<ChargeOpts>
  /** Every `refund` call, in order. */
  readonly refunds: ReadonlyArray<{ chargeId: string; amount?: Money }>
}

const STUB_CAPABILITIES: ProviderCapabilities = {
  payments: true,
  refunds: true,
  issuing: false,
  treasury: false,
  escrow: false,
  subscriptions: false,
  metering: false,
  merchant: false,
  multiCurrency: false,
  currencies: ['USD'],
  stablecoins: [],
  rails: [],
}

/**
 * A deterministic in-memory {@link FinanceProvider} for tests: it mints
 * incrementing `charge:`/`refund:` ids, records every call for assertion, and
 * remembers each charge's captured amount so a full refund (no `amount`) can
 * fall back to the original capture. Makes no real finance-rail call.
 */
export function stubFinanceProvider(): StubFinanceProvider {
  const charges: ChargeOpts[] = []
  const refunds: Array<{ chargeId: string; amount?: Money }> = []
  const capturedById = new Map<string, Money>()
  let seq = 0

  return {
    name: 'stub',
    capabilities: STUB_CAPABILITIES,
    charges,
    refunds,

    async charge(opts: ChargeOpts): Promise<ChargeResult> {
      charges.push(opts)
      const $id = `charge:${++seq}`
      capturedById.set($id, opts.amount)
      return {
        $id,
        $type: 'Charge',
        amount: opts.amount,
        status: 'captured',
        createdAt: new Date(0).toISOString(),
        providerData: { provider: 'stub', externalId: $id },
      }
    },

    async refund(chargeId: string, amount?: Money): Promise<RefundResult> {
      refunds.push(amount !== undefined ? { chargeId, amount } : { chargeId })
      // Full refund (no amount) reverses the original captured amount.
      const reversed = amount ?? capturedById.get(chargeId) ?? { amount: 0n, currency: 'USD' }
      return {
        $id: `refund:${++seq}`,
        $type: 'Refund',
        chargeId,
        amount: reversed,
        createdAt: new Date(0).toISOString(),
      }
    },
  }
}
