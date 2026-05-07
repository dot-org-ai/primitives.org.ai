/**
 * Personas — specialized factory tests, round 4.
 *
 * Pins the contract for the four human-impact / cross-cell / statistical /
 * commercial-axis factories shipped on top of the round-1 + round-2 + round-3
 * specialized twelve:
 *
 *   - {@link Personas.empathy}
 *   - {@link Personas.dataIntegrity}
 *   - {@link Personas.statisticalRigor}
 *   - {@link Personas.commercialFit}
 *
 * Three test groups (mirroring `personas-specialized-round3.test.ts`):
 *
 *   1. `$id` namespace minting — every factory stamps `config.$id` under the
 *      expected `persona:<archetype>:<discriminator>` namespace.
 *   2. Opts threading — audienceType / sentimentTarget / checkSurfaces /
 *      toleranceLevel / rigorTier / dimensions / etc. flow through to
 *      `config` verbatim; defaults are the documented ones.
 *   3. signOff defaults — empathy + dataIntegrity + statisticalRigor are
 *      `'must-approve'` (load-bearing for shipping artifacts); commercialFit
 *      is `'advisory'` (load-bearing only for go-to-market Services where
 *      the human reviewer makes the commercial call).
 */

import { describe, it, expect } from 'vitest'

import { Personas } from '../../src/v3/personas.js'

describe('Personas — specialized factories (round 4)', () => {
  // ==========================================================================
  // Group 1 — $id namespace minting
  // ==========================================================================

  describe('$id namespace', () => {
    it('empathy mints persona:empathy:<audienceType>-<sentimentTarget>', () => {
      const p = Personas.empathy()
      expect(p.config['$id']).toBe('persona:empathy:public-neutral')
      const patient = Personas.empathy({
        audienceType: 'patient',
        sentimentTarget: 'reassuring',
      })
      expect(patient.config['$id']).toBe('persona:empathy:patient-reassuring')
      const employee = Personas.empathy({
        audienceType: 'employee',
        sentimentTarget: 'apologetic',
      })
      expect(employee.config['$id']).toBe('persona:empathy:employee-apologetic')
    })

    it('empathy slugifies custom audience-type strings', () => {
      const p = Personas.empathy({ audienceType: 'board member' })
      expect(p.config['$id']).toBe('persona:empathy:board-member-neutral')
    })

    it('dataIntegrity mints persona:data-integrity:<toleranceLevel>', () => {
      const p = Personas.dataIntegrity()
      expect(p.config['$id']).toBe('persona:data-integrity:strict')
      const moderate = Personas.dataIntegrity({ toleranceLevel: 'moderate' })
      expect(moderate.config['$id']).toBe('persona:data-integrity:moderate')
      const loose = Personas.dataIntegrity({ toleranceLevel: 'loose' })
      expect(loose.config['$id']).toBe('persona:data-integrity:loose')
    })

    it('statisticalRigor mints persona:statistical-rigor:<rigorTier>', () => {
      const p = Personas.statisticalRigor()
      expect(p.config['$id']).toBe('persona:statistical-rigor:mixed')
      const freq = Personas.statisticalRigor({ rigorTier: 'frequentist' })
      expect(freq.config['$id']).toBe('persona:statistical-rigor:frequentist')
      const bayes = Personas.statisticalRigor({ rigorTier: 'bayesian' })
      expect(bayes.config['$id']).toBe('persona:statistical-rigor:bayesian')
    })

    it('commercialFit mints persona:commercial-fit:<audienceForPitch>', () => {
      const p = Personas.commercialFit()
      expect(p.config['$id']).toBe('persona:commercial-fit:internal-stakeholder')
      const investor = Personas.commercialFit({ audienceForPitch: 'investor' })
      expect(investor.config['$id']).toBe('persona:commercial-fit:investor')
      const partner = Personas.commercialFit({ audienceForPitch: 'partner' })
      expect(partner.config['$id']).toBe('persona:commercial-fit:partner')
    })
  })

  // ==========================================================================
  // Group 2 — opts threading
  // ==========================================================================

  describe('opts threading', () => {
    // ----- empathy ----------------------------------------------------------

    it('empathy threads audienceType + sentimentTarget + avoidPatterns into config', () => {
      const p = Personas.empathy({
        audienceType: 'patient',
        sentimentTarget: 'reassuring',
        avoidPatterns: ['corporate-jargon', 'condescending'],
      })
      expect(p.config['audienceType']).toBe('patient')
      expect(p.config['sentimentTarget']).toBe('reassuring')
      expect(p.config['avoidPatterns']).toEqual(['corporate-jargon', 'condescending'])
      expect(p.persona).toContain('patient')
      expect(p.persona).toContain('reassuring')
      expect(p.persona).toContain('corporate-jargon')
      expect(p.persona).toContain('condescending')
    })

    it('empathy defaults to public + neutral + all five avoidPatterns', () => {
      const p = Personas.empathy()
      expect(p.config['audienceType']).toBe('public')
      expect(p.config['sentimentTarget']).toBe('neutral')
      expect(p.config['avoidPatterns']).toEqual([
        'corporate-jargon',
        'condescending',
        'passive-aggressive',
        'overly-formal',
        'overly-casual',
      ])
    })

    it('empathy omits modelHint when not supplied (no default pin)', () => {
      const p = Personas.empathy()
      expect(p.config['modelHint']).toBeUndefined()
    })

    it('empathy honours modelHint when supplied', () => {
      const p = Personas.empathy({ modelHint: 'opus' })
      expect(p.config['modelHint']).toBe('opus')
    })

    // ----- dataIntegrity ----------------------------------------------------

    it('dataIntegrity threads checkSurfaces + toleranceLevel into config', () => {
      const p = Personas.dataIntegrity({
        checkSurfaces: ['numerical-tieout', 'date-consistency'],
        toleranceLevel: 'moderate',
      })
      expect(p.config['checkSurfaces']).toEqual(['numerical-tieout', 'date-consistency'])
      expect(p.config['toleranceLevel']).toBe('moderate')
      expect(p.persona).toContain('numerical-tieout')
      expect(p.persona).toContain('date-consistency')
      expect(p.persona).toContain('MODERATE')
    })

    it('dataIntegrity defaults to all five surfaces + strict tolerance', () => {
      const p = Personas.dataIntegrity()
      expect(p.config['toleranceLevel']).toBe('strict')
      expect(p.config['checkSurfaces']).toEqual([
        'numerical-tieout',
        'date-consistency',
        'reference-integrity',
        'name-consistency',
        'unit-consistency',
      ])
      expect(p.persona).toContain('STRICT')
    })

    it('dataIntegrity defaults modelHint to opus', () => {
      const p = Personas.dataIntegrity()
      expect(p.config['modelHint']).toBe('opus')
    })

    it('dataIntegrity honours explicit modelHint override', () => {
      const p = Personas.dataIntegrity({ modelHint: 'sonnet' })
      expect(p.config['modelHint']).toBe('sonnet')
    })

    it('dataIntegrity respects toleranceLevel=loose in prompt language', () => {
      const p = Personas.dataIntegrity({ toleranceLevel: 'loose' })
      expect(p.persona).toContain('LOOSE')
    })

    // ----- statisticalRigor -------------------------------------------------

    it('statisticalRigor threads checkSurfaces + rigorTier into config', () => {
      const p = Personas.statisticalRigor({
        checkSurfaces: ['sample-size', 'p-value-misuse'],
        rigorTier: 'frequentist',
      })
      expect(p.config['checkSurfaces']).toEqual(['sample-size', 'p-value-misuse'])
      expect(p.config['rigorTier']).toBe('frequentist')
      expect(p.persona).toContain('sample-size')
      expect(p.persona).toContain('p-value-misuse')
      expect(p.persona).toContain('FREQUENTIST')
    })

    it('statisticalRigor defaults to all seven surfaces + mixed regime', () => {
      const p = Personas.statisticalRigor()
      expect(p.config['rigorTier']).toBe('mixed')
      expect(p.config['checkSurfaces']).toEqual([
        'sample-size',
        'multiple-comparisons',
        'effect-size',
        'confidence-interval',
        'p-value-misuse',
        'survivorship-bias',
        'simpsons-paradox',
      ])
      expect(p.persona).toContain('MIXED')
    })

    it('statisticalRigor defaults modelHint to opus', () => {
      const p = Personas.statisticalRigor()
      expect(p.config['modelHint']).toBe('opus')
    })

    it('statisticalRigor honours explicit modelHint override', () => {
      const p = Personas.statisticalRigor({ modelHint: 'sonnet' })
      expect(p.config['modelHint']).toBe('sonnet')
    })

    it('statisticalRigor respects rigorTier=bayesian in prompt language', () => {
      const p = Personas.statisticalRigor({ rigorTier: 'bayesian' })
      expect(p.persona).toContain('BAYESIAN')
    })

    // ----- commercialFit ----------------------------------------------------

    it('commercialFit threads dimensions + audienceForPitch into config', () => {
      const p = Personas.commercialFit({
        dimensions: ['pricing-realism', 'unit-economics'],
        audienceForPitch: 'investor',
      })
      expect(p.config['dimensions']).toEqual(['pricing-realism', 'unit-economics'])
      expect(p.config['audienceForPitch']).toBe('investor')
      expect(p.persona).toContain('pricing-realism')
      expect(p.persona).toContain('unit-economics')
      expect(p.persona).toContain('INVESTOR')
    })

    it('commercialFit defaults to all six dimensions + internal-stakeholder audience', () => {
      const p = Personas.commercialFit()
      expect(p.config['audienceForPitch']).toBe('internal-stakeholder')
      expect(p.config['dimensions']).toEqual([
        'pricing-realism',
        'icp-fit',
        'channel-fit',
        'total-addressable-market',
        'competitive-positioning',
        'unit-economics',
      ])
      expect(p.persona).toContain('INTERNAL-STAKEHOLDER')
    })

    it('commercialFit omits modelHint when not supplied (no default pin)', () => {
      const p = Personas.commercialFit()
      expect(p.config['modelHint']).toBeUndefined()
    })

    it('commercialFit honours modelHint when supplied', () => {
      const p = Personas.commercialFit({ modelHint: 'opus' })
      expect(p.config['modelHint']).toBe('opus')
    })

    it('commercialFit respects audienceForPitch=customer in prompt language', () => {
      const p = Personas.commercialFit({ audienceForPitch: 'customer' })
      expect(p.persona).toContain('CUSTOMER')
    })

    it('commercialFit respects audienceForPitch=partner in prompt language', () => {
      const p = Personas.commercialFit({ audienceForPitch: 'partner' })
      expect(p.persona).toContain('PARTNER')
    })
  })

  // ==========================================================================
  // Group 3 — signOff defaults
  // ==========================================================================

  describe('signOff defaults', () => {
    it('empathy is must-approve (tone failures are dispositive on human-facing copy)', () => {
      expect(Personas.empathy().signOff).toBe('must-approve')
    })

    it('dataIntegrity is must-approve (cross-cell mismatches are dispositive)', () => {
      expect(Personas.dataIntegrity().signOff).toBe('must-approve')
    })

    it('statisticalRigor is must-approve (methodological failures are dispositive)', () => {
      expect(Personas.statisticalRigor().signOff).toBe('must-approve')
    })

    it('commercialFit is advisory (load-bearing for go-to-market, not a gate)', () => {
      expect(Personas.commercialFit().signOff).toBe('advisory')
    })
  })

  // ==========================================================================
  // Misc — name override + archetype tag
  // ==========================================================================

  describe('shape conformance', () => {
    it('all four factories tag config.archetype', () => {
      expect(Personas.empathy().config['archetype']).toBe('empathy')
      expect(Personas.dataIntegrity().config['archetype']).toBe('data-integrity')
      expect(Personas.statisticalRigor().config['archetype']).toBe('statistical-rigor')
      expect(Personas.commercialFit().config['archetype']).toBe('commercial-fit')
    })

    it('all four factories accept a name override', () => {
      expect(Personas.empathy({ name: 'empathy-bot' }).name).toBe('empathy-bot')
      expect(Personas.dataIntegrity({ name: 'tieout-bot' }).name).toBe('tieout-bot')
      expect(Personas.statisticalRigor({ name: 'stats-bot' }).name).toBe('stats-bot')
      expect(Personas.commercialFit({ name: 'gtm-bot' }).name).toBe('gtm-bot')
    })

    it('all four factories mint deterministic default names', () => {
      expect(Personas.empathy().name).toBe('empathy-public-neutral')
      expect(Personas.dataIntegrity().name).toBe('data-integrity-strict')
      expect(Personas.statisticalRigor().name).toBe('statistical-rigor-mixed')
      expect(Personas.commercialFit().name).toBe('commercial-fit-internal-stakeholder')
    })
  })
})
