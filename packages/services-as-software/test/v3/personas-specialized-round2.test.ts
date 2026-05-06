/**
 * Personas — specialized factory tests, round 2.
 *
 * Pins the contract for the four production-evaluation realism factories
 * shipped on top of the round-1 specialized four:
 *
 *   - {@link Personas.factualAccuracy}
 *   - {@link Personas.brandSafety}
 *   - {@link Personas.budgetRealism}
 *   - {@link Personas.timelineRealism}
 *
 * Three test groups (mirroring `personas-specialized.test.ts`):
 *
 *   1. `$id` namespace minting — every factory stamps `config.$id` under the
 *      expected `persona:<archetype>:<discriminator>` namespace.
 *   2. Opts threading — sourceTypes / brandVoiceRef / sanityRanges /
 *      lookaheadWeeks / etc. flow through to `config` verbatim; defaults are
 *      the documented ones.
 *   3. signOff defaults — factualAccuracy + brandSafety are `'must-approve'`
 *      (load-bearing for outward-facing claims); budgetRealism +
 *      timelineRealism are `'advisory'` (load-bearing inputs but the verdict
 *      is guidance rather than a hard gate).
 */

import { describe, it, expect } from 'vitest'

import { Personas } from '../../src/v3/personas.js'

describe('Personas — specialized factories (round 2)', () => {
  // ==========================================================================
  // Group 1 — $id namespace minting
  // ==========================================================================

  describe('$id namespace', () => {
    it('factualAccuracy mints persona:factual-accuracy:cit-<required>-min-<n>', () => {
      const p = Personas.factualAccuracy()
      expect(p.config['$id']).toBe('persona:factual-accuracy:cit-required-min-1')
      const optional = Personas.factualAccuracy({ citationRequired: false })
      expect(optional.config['$id']).toBe('persona:factual-accuracy:cit-optional-min-1')
      const min2 = Personas.factualAccuracy({ minCitationsPerClaim: 2 })
      expect(min2.config['$id']).toBe('persona:factual-accuracy:cit-required-min-2')
    })

    it('brandSafety mints persona:brand-safety:<tone>-<risk>', () => {
      const p = Personas.brandSafety()
      expect(p.config['$id']).toBe('persona:brand-safety:conversational-medium')
      const formalLow = Personas.brandSafety({ toneRange: 'formal', riskTolerance: 'low' })
      expect(formalLow.config['$id']).toBe('persona:brand-safety:formal-low')
    })

    it('brandSafety slugifies custom tone strings', () => {
      const p = Personas.brandSafety({ toneRange: 'playful formal' })
      expect(p.config['$id']).toBe('persona:brand-safety:playful-formal-medium')
    })

    it('budgetRealism mints persona:budget-realism:<budgetType>', () => {
      const p = Personas.budgetRealism()
      expect(p.config['$id']).toBe('persona:budget-realism:all')
      const cost = Personas.budgetRealism({ budgetType: 'cost' })
      expect(cost.config['$id']).toBe('persona:budget-realism:cost')
    })

    it('timelineRealism mints persona:timeline-realism:lookahead-<weeks>', () => {
      const p = Personas.timelineRealism()
      expect(p.config['$id']).toBe('persona:timeline-realism:lookahead-12')
      const long = Personas.timelineRealism({ lookaheadWeeks: 26 })
      expect(long.config['$id']).toBe('persona:timeline-realism:lookahead-26')
    })
  })

  // ==========================================================================
  // Group 2 — opts threading
  // ==========================================================================

  describe('opts threading', () => {
    // ----- factualAccuracy --------------------------------------------------

    it('factualAccuracy threads citationRequired + sourceTypes + minCitations', () => {
      const p = Personas.factualAccuracy({
        citationRequired: true,
        sourceTypes: ['primary', 'peer-reviewed'],
        minCitationsPerClaim: 3,
      })
      expect(p.config['citationRequired']).toBe(true)
      expect(p.config['sourceTypes']).toEqual(['primary', 'peer-reviewed'])
      expect(p.config['minCitationsPerClaim']).toBe(3)
      // The prompt should mention the cap so the LLM applies the documented rule.
      expect(p.persona).toContain('3 inline citations')
      expect(p.persona).toContain('primary')
      expect(p.persona).toContain('peer-reviewed')
    })

    it('factualAccuracy defaults to citationRequired + all source types + min 1', () => {
      const p = Personas.factualAccuracy()
      expect(p.config['citationRequired']).toBe(true)
      expect(p.config['minCitationsPerClaim']).toBe(1)
      expect(p.config['sourceTypes']).toEqual([
        'primary',
        'peer-reviewed',
        'government',
        'industry-standard',
        'first-party',
      ])
    })

    it('factualAccuracy defaults modelHint to opus', () => {
      const p = Personas.factualAccuracy()
      expect(p.config['modelHint']).toBe('opus')
    })

    it('factualAccuracy honours explicit modelHint override', () => {
      const p = Personas.factualAccuracy({ modelHint: 'sonnet' })
      expect(p.config['modelHint']).toBe('sonnet')
    })

    it('factualAccuracy respects citationRequired=false in prompt language', () => {
      const p = Personas.factualAccuracy({ citationRequired: false })
      expect(p.persona).toContain('Citations are optional')
    })

    // ----- brandSafety ------------------------------------------------------

    it('brandSafety threads brandVoiceRef + toneRange + riskTolerance', () => {
      const p = Personas.brandSafety({
        brandVoiceRef: 'brand:do-industries/voice',
        toneRange: 'formal',
        riskTolerance: 'low',
      })
      expect(p.config['brandVoiceRef']).toBe('brand:do-industries/voice')
      expect(p.config['toneRange']).toBe('formal')
      expect(p.config['riskTolerance']).toBe('low')
      expect(p.persona).toContain('brand:do-industries/voice')
      expect(p.persona).toContain('formal')
    })

    it('brandSafety defaults to conversational + medium + no brandVoiceRef', () => {
      const p = Personas.brandSafety()
      expect(p.config['toneRange']).toBe('conversational')
      expect(p.config['riskTolerance']).toBe('medium')
      expect(p.config['brandVoiceRef']).toBeUndefined()
    })

    it('brandSafety omits modelHint when not supplied (no default pin)', () => {
      const p = Personas.brandSafety()
      expect(p.config['modelHint']).toBeUndefined()
    })

    it('brandSafety honours modelHint when supplied', () => {
      const p = Personas.brandSafety({ modelHint: 'opus' })
      expect(p.config['modelHint']).toBe('opus')
    })

    // ----- budgetRealism ----------------------------------------------------

    it('budgetRealism threads budgetType + sanityRanges into config', () => {
      const p = Personas.budgetRealism({
        budgetType: 'cost',
        sanityRanges: { costUsdMax: 250_000 },
      })
      expect(p.config['budgetType']).toBe('cost')
      expect(p.config['sanityRanges']).toEqual({ costUsdMax: 250_000 })
      // Prompt should mention the cap so the LLM applies the documented rule.
      expect(p.persona).toContain('$250,000')
    })

    it('budgetRealism formats all three sanity ranges in the prompt', () => {
      const p = Personas.budgetRealism({
        sanityRanges: { costUsdMax: 100_000, timeWeeksMax: 8, scopeItemsMax: 12 },
      })
      expect(p.persona).toContain('$100,000')
      expect(p.persona).toContain('8 weeks')
      expect(p.persona).toContain('12')
    })

    it('budgetRealism defaults to all axes + empty sanity ranges', () => {
      const p = Personas.budgetRealism()
      expect(p.config['budgetType']).toBe('all')
      expect(p.config['sanityRanges']).toEqual({})
    })

    it('budgetRealism omits modelHint when not supplied', () => {
      const p = Personas.budgetRealism()
      expect(p.config['modelHint']).toBeUndefined()
    })

    // ----- timelineRealism --------------------------------------------------

    it('timelineRealism threads dependencyAware + lookaheadWeeks + criticalPath', () => {
      const p = Personas.timelineRealism({
        dependencyAware: false,
        lookaheadWeeks: 26,
        criticalPathRequired: true,
      })
      expect(p.config['dependencyAware']).toBe(false)
      expect(p.config['lookaheadWeeks']).toBe(26)
      expect(p.config['criticalPathRequired']).toBe(true)
      expect(p.persona).toContain('26 week')
      expect(p.persona).toContain('critical path')
    })

    it('timelineRealism defaults to dependencyAware=true + 12wk + no critical-path requirement', () => {
      const p = Personas.timelineRealism()
      expect(p.config['dependencyAware']).toBe(true)
      expect(p.config['lookaheadWeeks']).toBe(12)
      expect(p.config['criticalPathRequired']).toBe(false)
    })

    it('timelineRealism singularises week vs weeks correctly', () => {
      const p = Personas.timelineRealism({ lookaheadWeeks: 1 })
      expect(p.persona).toContain('1 week of')
      expect(p.persona).not.toContain('1 weeks')
    })

    it('timelineRealism omits modelHint when not supplied', () => {
      const p = Personas.timelineRealism()
      expect(p.config['modelHint']).toBeUndefined()
    })
  })

  // ==========================================================================
  // Group 3 — signOff defaults
  // ==========================================================================

  describe('signOff defaults', () => {
    it('factualAccuracy is must-approve (load-bearing factual claims)', () => {
      expect(Personas.factualAccuracy().signOff).toBe('must-approve')
    })

    it('brandSafety is must-approve (public-facing reputational risk)', () => {
      expect(Personas.brandSafety().signOff).toBe('must-approve')
    })

    it('budgetRealism is advisory (guidance, not a gate)', () => {
      expect(Personas.budgetRealism().signOff).toBe('advisory')
    })

    it('timelineRealism is advisory (guidance, not a gate)', () => {
      expect(Personas.timelineRealism().signOff).toBe('advisory')
    })
  })

  // ==========================================================================
  // Misc — name override + archetype tag
  // ==========================================================================

  describe('shape conformance', () => {
    it('all four factories tag config.archetype', () => {
      expect(Personas.factualAccuracy().config['archetype']).toBe('factual-accuracy')
      expect(Personas.brandSafety().config['archetype']).toBe('brand-safety')
      expect(Personas.budgetRealism().config['archetype']).toBe('budget-realism')
      expect(Personas.timelineRealism().config['archetype']).toBe('timeline-realism')
    })

    it('all four factories accept a name override', () => {
      expect(Personas.factualAccuracy({ name: 'fact-bot' }).name).toBe('fact-bot')
      expect(Personas.brandSafety({ name: 'brand-bot' }).name).toBe('brand-bot')
      expect(Personas.budgetRealism({ name: 'budget-bot' }).name).toBe('budget-bot')
      expect(Personas.timelineRealism({ name: 'timeline-bot' }).name).toBe('timeline-bot')
    })

    it('all four factories mint deterministic default names', () => {
      expect(Personas.factualAccuracy().name).toBe('factual-accuracy-cit-required-min-1')
      expect(Personas.brandSafety().name).toBe('brand-safety-conversational-medium')
      expect(Personas.budgetRealism().name).toBe('budget-realism-all')
      expect(Personas.timelineRealism().name).toBe('timeline-realism-lookahead-12')
    })
  })
})
