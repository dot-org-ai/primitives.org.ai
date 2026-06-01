/**
 * Tests for the Offer Noun wired into the offerings entity family.
 */

import { describe, it, expect } from 'vitest'
import { Offer, OfferingEntities, OfferingCategories } from '../src/entities/offerings.js'
import { OfferEntity } from '../src/index.js'

function isValidNoun(entity: unknown): boolean {
  if (typeof entity !== 'object' || entity === null) return false
  const e = entity as Record<string, unknown>
  return (
    typeof e.singular === 'string' &&
    typeof e.plural === 'string' &&
    typeof e.description === 'string' &&
    typeof e.properties === 'object' &&
    Array.isArray(e.actions) &&
    Array.isArray(e.events)
  )
}

describe('Offer Noun', () => {
  it('is a valid Noun definition', () => {
    expect(isValidNoun(Offer)).toBe(true)
  })

  it('has correct singular/plural', () => {
    expect(Offer.singular).toBe('offer')
    expect(Offer.plural).toBe('offers')
  })

  it('carries the value-capture ladder on gatingBasis', () => {
    expect(Offer.properties.gatingBasis).toBeDefined()
    expect(Offer.properties.gatingBasis.examples).toEqual([
      'access',
      'effort',
      'usage',
      'output',
      'outcome',
    ])
  })

  it('carries priceStructure + fundingSource', () => {
    expect(Offer.properties.priceStructure).toBeDefined()
    expect(Offer.properties.fundingSource).toBeDefined()
  })

  it('links itemOffered to Service|Product', () => {
    expect(Offer.relationships?.itemOffered).toBeDefined()
  })

  it('is registered in OfferingEntities', () => {
    expect(OfferingEntities.Offer).toBe(Offer)
  })

  it('is categorized under pricing', () => {
    expect(OfferingCategories.pricing).toContain('Offer')
  })

  it('is re-exported from the package root as OfferEntity', () => {
    expect(OfferEntity).toBe(Offer)
  })
})
