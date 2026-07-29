/**
 * Tests for offer.ts — the canonical schema.org Offer noun (value/type module).
 *
 * Covers:
 *  - the value-capture ladder (PricingBasis closed union + PRICING_BASES array)
 *  - PriceSpecification discriminated union (each structure)
 *  - FundingSource union
 *  - Offer() factory: construction, validate-and-normalize, itemOffered linking
 *  - alignment with the finance Pricing factories (basis ↔ finance Pricing.kind)
 */

import { describe, it, expect } from 'vitest'
import {
  Offer,
  PRICING_BASES,
  basisToPricingKind,
  type PricingBasis,
  type PriceSpecification,
  type FundingSource,
  type Offer as OfferType,
} from '../src/offer.js'

describe('PricingBasis — the value-capture ladder', () => {
  it('is a closed 5-rung ladder, low → high', () => {
    expect(PRICING_BASES).toEqual(['access', 'effort', 'usage', 'output', 'outcome'])
  })

  it('PRICING_BASES is readonly-typed and length 5', () => {
    expect(PRICING_BASES).toHaveLength(5)
  })

  it('every rung is a legal PricingBasis', () => {
    for (const b of PRICING_BASES) {
      const basis: PricingBasis = b
      expect(typeof basis).toBe('string')
    }
  })

  it('maps each rung to a canonical finance Pricing kind (alignment)', () => {
    expect(basisToPricingKind('access')).toBe('subscription')
    expect(basisToPricingKind('usage')).toBe('composite')
    expect(basisToPricingKind('output')).toBe('per-invocation')
    expect(basisToPricingKind('outcome')).toBe('outcome')
    // effort has no direct finance Pricing.kind — it is settled as composite/perInvocation
    expect(basisToPricingKind('effort')).toBe('composite')
  })
})

describe('PriceSpecification — discriminated union', () => {
  it('SinglePrice carries a Money amount', () => {
    const spec: PriceSpecification = {
      structure: 'SinglePrice',
      price: { amount: 9900n, currency: 'USD' },
    }
    expect(spec.structure).toBe('SinglePrice')
    if (spec.structure === 'SinglePrice') {
      expect(spec.price.amount).toBe(9900n)
      expect(spec.price.currency).toBe('USD')
    }
  })

  it('Tiered carries named tiers', () => {
    const spec: PriceSpecification = {
      structure: 'Tiered',
      tiers: [
        { name: 'Starter', price: { amount: 1900n, currency: 'USD' } },
        { name: 'Pro', price: { amount: 9900n, currency: 'USD' } },
      ],
    }
    if (spec.structure === 'Tiered') {
      expect(spec.tiers).toHaveLength(2)
      expect(spec.tiers[0]?.name).toBe('Starter')
    }
  })

  it('UsageMeter composes a finance MeteredEntry', () => {
    const spec: PriceSpecification = {
      structure: 'UsageMeter',
      meter: { event: 'api-call', amount: 5n },
      unit: 'request',
    }
    if (spec.structure === 'UsageMeter') {
      expect(spec.meter.event).toBe('api-call')
      expect(spec.meter.amount).toBe(5n)
      expect(spec.unit).toBe('request')
    }
  })

  it('SuccessFee references a metric and percentage', () => {
    const spec: PriceSpecification = {
      structure: 'SuccessFee',
      percent: 10,
      of: 'collected-amount',
    }
    if (spec.structure === 'SuccessFee') {
      expect(spec.percent).toBe(10)
      expect(spec.of).toBe('collected-amount')
    }
  })

  it('Gainshare references a baseline metric and share', () => {
    const spec: PriceSpecification = {
      structure: 'Gainshare',
      sharePercent: 25,
      baseline: 'baseline-revenue',
    }
    if (spec.structure === 'Gainshare') {
      expect(spec.sharePercent).toBe(25)
      expect(spec.baseline).toBe('baseline-revenue')
    }
  })

  it('CustomQuote carries an optional rfq url', () => {
    const spec: PriceSpecification = { structure: 'CustomQuote', rfqUrl: 'https://x/rfq' }
    if (spec.structure === 'CustomQuote') {
      expect(spec.rfqUrl).toBe('https://x/rfq')
    }
  })
})

describe('FundingSource — who pays', () => {
  it('direct is the default shape', () => {
    const src: FundingSource = { source: 'direct' }
    expect(src.source).toBe('direct')
  })

  it('ad-supported names a network', () => {
    const src: FundingSource = { source: 'ad-supported', network: 'adsense' }
    if (src.source === 'ad-supported') expect(src.network).toBe('adsense')
  })

  it('equity / barter / subsidized carry their counterparties', () => {
    const equity: FundingSource = { source: 'equity', instrument: 'SAFE' }
    const barter: FundingSource = { source: 'barter', counterparty: 'partner-co' }
    const subsidized: FundingSource = { source: 'subsidized', sponsor: 'gov-grant' }
    expect(equity.source).toBe('equity')
    expect(barter.source).toBe('barter')
    expect(subsidized.source).toBe('subsidized')
  })
})

describe('Offer() factory', () => {
  it('builds a canonical schema.org Offer from a minimal spec', () => {
    const offer = Offer({
      name: 'Bookkeeping — monthly',
      itemOffered: { $type: 'Service', $id: 'service:bookkeeping' },
      priceSpecification: {
        structure: 'SinglePrice',
        price: { amount: 49900n, currency: 'USD' },
      },
    })

    expect(offer.$type).toBe('Offer')
    expect(offer.name).toBe('Bookkeeping — monthly')
    expect(offer.itemOffered.$type).toBe('Service')
    expect(offer.itemOffered.$id).toBe('service:bookkeeping')
    expect(offer.priceSpecification.structure).toBe('SinglePrice')
  })

  it('defaults gatingBasis to access and fundingSource to direct', () => {
    const offer = Offer({
      name: 'Free tier',
      itemOffered: { $type: 'Product', $id: 'product:widget' },
      priceSpecification: { structure: 'CustomQuote' },
    })
    expect(offer.gatingBasis).toBe('access')
    expect(offer.fundingSource).toEqual({ source: 'direct' })
  })

  it('derives a default $id from itemOffered when omitted', () => {
    const offer = Offer({
      name: 'Audit',
      itemOffered: { $type: 'Service', $id: 'service:audit' },
      priceSpecification: { structure: 'CustomQuote' },
    })
    expect(offer.$id).toContain('service:audit')
  })

  it('preserves an explicit $id', () => {
    const offer = Offer({
      $id: 'offer:my-offer',
      name: 'Audit',
      itemOffered: { $type: 'Service', $id: 'service:audit' },
      priceSpecification: { structure: 'CustomQuote' },
    })
    expect(offer.$id).toBe('offer:my-offer')
  })

  it('links itemOffered to a Product ref', () => {
    const offer = Offer({
      name: 'Widget Pro',
      itemOffered: { $type: 'Product', $id: 'product:widget-pro' },
      priceSpecification: {
        structure: 'SinglePrice',
        price: { amount: 9900n, currency: 'USD' },
      },
    })
    expect(offer.itemOffered.$type).toBe('Product')
    expect(offer.itemOffered.$id).toBe('product:widget-pro')
  })

  it('carries an explicit gatingBasis + secondaryBasis', () => {
    const offer = Offer({
      name: 'Outcome deal',
      itemOffered: { $type: 'Service', $id: 'service:collections' },
      gatingBasis: 'outcome',
      secondaryBasis: 'access',
      priceSpecification: {
        structure: 'SuccessFee',
        percent: 10,
        of: 'collected-amount',
      },
      fundingSource: { source: 'direct' },
    })
    expect(offer.gatingBasis).toBe('outcome')
    expect(offer.secondaryBasis).toBe('access')
  })

  it('throws when name is missing', () => {
    expect(() =>
      // @ts-expect-error name is required
      Offer({
        itemOffered: { $type: 'Service', $id: 'service:x' },
        priceSpecification: { structure: 'CustomQuote' },
      })
    ).toThrow(/name/i)
  })

  it('throws when itemOffered is missing', () => {
    expect(() =>
      // @ts-expect-error itemOffered is required
      Offer({ name: 'x', priceSpecification: { structure: 'CustomQuote' } })
    ).toThrow(/itemOffered/i)
  })

  it('throws when itemOffered.$type is not Service or Product', () => {
    expect(() =>
      Offer({
        name: 'x',
        // @ts-expect-error invalid item type
        itemOffered: { $type: 'Business', $id: 'business:x' },
        priceSpecification: { structure: 'CustomQuote' },
      })
    ).toThrow(/Service|Product/)
  })

  it('throws when priceSpecification is missing', () => {
    expect(() =>
      // @ts-expect-error priceSpecification is required
      Offer({ name: 'x', itemOffered: { $type: 'Service', $id: 'service:x' } })
    ).toThrow(/price/i)
  })

  it('throws when gatingBasis is not on the ladder', () => {
    expect(() =>
      Offer({
        name: 'x',
        itemOffered: { $type: 'Service', $id: 'service:x' },
        // @ts-expect-error illegal basis
        gatingBasis: 'vibes',
        priceSpecification: { structure: 'CustomQuote' },
      })
    ).toThrow(/basis/i)
  })

  it('result satisfies the Offer type and is a plain object', () => {
    const offer: OfferType = Offer({
      name: 'x',
      itemOffered: { $type: 'Service', $id: 'service:x' },
      priceSpecification: { structure: 'CustomQuote' },
    })
    expect(Object.getPrototypeOf(offer)).toBe(Object.prototype)
  })
})
