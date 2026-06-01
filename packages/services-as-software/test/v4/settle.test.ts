/**
 * v4 SETTLEMENT-adapter tests (aip-cnks.10 pass 2).
 *
 * `makeFinanceSettler` adapts a `business-as-code/finance` {@link FinanceProvider}
 * into the v4 {@link Settler} port: `charge({basis,amount,buyer,ref})` →
 * `provider.charge(...)` → a `charged` {@link Settlement} that retains the
 * provider's charge `$id`; `refund({chargeId,amount})` →
 * `provider.refund(chargeId, amount)` → a `refunded` Settlement. The
 * `no-prior-charge` sentinel short-circuits to a noop with NO provider call.
 *
 * These tests use `stubFinanceProvider()` — a tiny in-memory provider that
 * records calls — so the mapping is exercised with no real finance rail.
 */

import { describe, it, expect } from 'vitest'

import type { Money } from '../../src/v4/index.js'
import { makeFinanceSettler, stubFinanceProvider } from '../../src/v4/settle.js'

const USD = (amount: bigint): Money => ({ amount, currency: 'USD' })

describe('makeFinanceSettler — charge', () => {
  it('maps provider.charge → a charged Settlement carrying the chargeId', async () => {
    const provider = stubFinanceProvider()
    const settler = makeFinanceSettler(provider)
    const amount = USD(1000n)

    const settlement = await settler.charge({
      basis: 'output',
      amount,
      buyer: 'buyer:acme',
      ref: 'inv:1',
    })

    expect(settlement.outcome).toBe('charged')
    if (settlement.outcome !== 'charged') throw new Error('expected charged')
    expect(settlement.captured).toEqual(amount)
    expect(settlement.basis).toBe('output')
    // chargeId === contract === the provider charge $id (retained for refund).
    expect(settlement.chargeId).toBe(settlement.contract)
    expect(settlement.chargeId).toMatch(/^charge:/)

    // the provider saw the buyer/amount/ref.
    expect(provider.charges).toHaveLength(1)
    expect(provider.charges[0]).toMatchObject({ buyer: 'buyer:acme', amount, ref: 'inv:1' })
  })
})

describe('makeFinanceSettler — refund', () => {
  it('maps provider.refund(chargeId, amount) → a refunded Settlement', async () => {
    const provider = stubFinanceProvider()
    const settler = makeFinanceSettler(provider)
    const amount = USD(2500n)

    // First charge so the chargeId exists.
    const charged = await settler.charge({ basis: 'output', amount, buyer: 'buyer:b' })
    if (charged.outcome !== 'charged') throw new Error('expected charged')

    const refund = await settler.refund({ chargeId: charged.chargeId, amount })
    expect(refund.outcome).toBe('refunded')
    if (refund.outcome !== 'refunded') throw new Error('expected refunded')
    expect(refund.amount).toEqual(amount)
    expect(refund.chargeId).toBe(charged.chargeId)
    expect(refund.per).toMatch(/^refund:/)

    expect(provider.refunds).toHaveLength(1)
    expect(provider.refunds[0]).toMatchObject({ chargeId: charged.chargeId, amount })
  })

  it('full refund (no amount) reverses the captured amount', async () => {
    const provider = stubFinanceProvider()
    const settler = makeFinanceSettler(provider)
    const amount = USD(700n)
    const charged = await settler.charge({ basis: 'usage', amount, buyer: 'buyer:c' })
    if (charged.outcome !== 'charged') throw new Error('expected charged')

    const refund = await settler.refund({ chargeId: charged.chargeId })
    expect(refund.outcome).toBe('refunded')
    if (refund.outcome !== 'refunded') throw new Error('expected refunded')
    // provider falls back to the original captured amount for a full refund.
    expect(refund.amount).toEqual(amount)
  })
})

describe('makeFinanceSettler — no-prior-charge sentinel', () => {
  it('refunding the sentinel is a noop with NO provider call', async () => {
    const provider = stubFinanceProvider()
    const settler = makeFinanceSettler(provider)

    const settlement = await settler.refund({ chargeId: 'no-prior-charge' })
    expect(settlement).toEqual({ outcome: 'noop', reason: 'cancelled-pre-charge' })
    expect(provider.refunds).toHaveLength(0)
  })
})
