/**
 * Personas — specialized factory tests, round 5.
 *
 * Pins the contract for the four executive-readiness / traceability /
 * assumption / handoff factories shipped on top of the round-1 + round-2 +
 * round-3 + round-4 specialized sixteen:
 *
 *   - {@link Personas.executiveSummary}
 *   - {@link Personas.evidenceTraceability}
 *   - {@link Personas.assumptionExplicitness}
 *   - {@link Personas.handoffReadiness}
 *
 * Three test groups (mirroring `personas-specialized-round4.test.ts`):
 *
 *   1. `$id` namespace minting — every factory stamps `config.$id` under the
 *      expected `persona:<archetype>:<discriminator>` namespace.
 *   2. Opts threading — audienceLevel / lengthCap / traceabilityFloor /
 *      sourceTypes / assumptionLevels / handoffSurfaces / contextDensity /
 *      etc. flow through to `config` verbatim; defaults are the documented
 *      ones.
 *   3. signOff defaults — executiveSummary + evidenceTraceability +
 *      assumptionExplicitness are `'must-approve'` (load-bearing for
 *      shipping artifacts); handoffReadiness is `'advisory'` (load-bearing
 *      for handoff Services where the human reviewer makes the call).
 */

import { describe, it, expect } from 'vitest'

import { Personas } from '../../src/v3/personas.js'

describe('Personas — specialized factories (round 5)', () => {
  // ==========================================================================
  // Group 1 — $id namespace minting
  // ==========================================================================

  describe('$id namespace', () => {
    it('executiveSummary mints persona:executive-summary:<audienceLevel>', () => {
      const p = Personas.executiveSummary()
      expect(p.config['$id']).toBe('persona:executive-summary:c-suite')
      const board = Personas.executiveSummary({ audienceLevel: 'Board' })
      expect(board.config['$id']).toBe('persona:executive-summary:board')
      const vp = Personas.executiveSummary({ audienceLevel: 'VP' })
      expect(vp.config['$id']).toBe('persona:executive-summary:vp')
      const director = Personas.executiveSummary({ audienceLevel: 'Director' })
      expect(director.config['$id']).toBe('persona:executive-summary:director')
    })

    it('evidenceTraceability mints persona:evidence-traceability:floor-<n>', () => {
      const p = Personas.evidenceTraceability()
      expect(p.config['$id']).toBe('persona:evidence-traceability:floor-95')
      const total = Personas.evidenceTraceability({ traceabilityFloor: 1.0 })
      expect(total.config['$id']).toBe('persona:evidence-traceability:floor-100')
      const lower = Personas.evidenceTraceability({ traceabilityFloor: 0.8 })
      expect(lower.config['$id']).toBe('persona:evidence-traceability:floor-80')
    })

    it('assumptionExplicitness mints persona:assumption-explicitness:<sensitivity>', () => {
      const p = Personas.assumptionExplicitness()
      expect(p.config['$id']).toBe('persona:assumption-explicitness:required')
      const optional = Personas.assumptionExplicitness({ sensitivityAnalysisRequired: false })
      expect(optional.config['$id']).toBe('persona:assumption-explicitness:optional')
    })

    it('handoffReadiness mints persona:handoff-readiness:universal-<density> by default', () => {
      const p = Personas.handoffReadiness()
      expect(p.config['$id']).toBe('persona:handoff-readiness:universal-standard')
    })

    it('handoffReadiness mints persona:handoff-readiness:<surfaces>-<density> when supplied', () => {
      const p = Personas.handoffReadiness({
        handoffSurfaces: ['engineering', 'ops'],
        contextDensity: 'comprehensive',
      })
      expect(p.config['$id']).toBe('persona:handoff-readiness:engineering-ops-comprehensive')
    })

    it('handoffReadiness slugifies custom handoff-surface strings', () => {
      const p = Personas.handoffReadiness({ handoffSurfaces: ['support team', 'sec ops'] })
      expect(p.config['$id']).toBe('persona:handoff-readiness:support-team-sec-ops-standard')
    })
  })

  // ==========================================================================
  // Group 2 — opts threading
  // ==========================================================================

  describe('opts threading', () => {
    // ----- executiveSummary -------------------------------------------------

    it('executiveSummary threads audienceLevel + lengthCap + mustIncludeActionItems into config', () => {
      const p = Personas.executiveSummary({
        audienceLevel: 'Board',
        lengthCap: 500,
        mustIncludeActionItems: false,
      })
      expect(p.config['audienceLevel']).toBe('Board')
      expect(p.config['lengthCap']).toBe(500)
      expect(p.config['mustIncludeActionItems']).toBe(false)
      expect(p.persona).toContain('Board')
      expect(p.persona).toContain('500 word')
      expect(p.persona).toContain('Action-item enumeration is optional')
    })

    it('executiveSummary defaults to C-suite + 250-word cap + action items required', () => {
      const p = Personas.executiveSummary()
      expect(p.config['audienceLevel']).toBe('C-suite')
      expect(p.config['lengthCap']).toBe(250)
      expect(p.config['mustIncludeActionItems']).toBe(true)
      expect(p.persona).toContain('C-suite')
      expect(p.persona).toContain('250 word')
      expect(p.persona).toContain('MUST include explicit action items')
    })

    it('executiveSummary omits modelHint when not supplied (no default pin)', () => {
      const p = Personas.executiveSummary()
      expect(p.config['modelHint']).toBeUndefined()
    })

    it('executiveSummary honours modelHint when supplied', () => {
      const p = Personas.executiveSummary({ modelHint: 'opus' })
      expect(p.config['modelHint']).toBe('opus')
    })

    it('executiveSummary respects mustIncludeActionItems=false in prompt language', () => {
      const p = Personas.executiveSummary({ mustIncludeActionItems: false })
      expect(p.persona).toContain('Action-item enumeration is optional')
    })

    // ----- evidenceTraceability ---------------------------------------------

    it('evidenceTraceability threads traceabilityFloor + sourceTypes into config', () => {
      const p = Personas.evidenceTraceability({
        traceabilityFloor: 0.85,
        sourceTypes: ['log-trace', 'screenshot'],
      })
      expect(p.config['traceabilityFloor']).toBe(0.85)
      expect(p.config['sourceTypes']).toEqual(['log-trace', 'screenshot'])
      expect(p.persona).toContain('log-trace')
      expect(p.persona).toContain('screenshot')
      expect(p.persona).toContain('85%')
    })

    it('evidenceTraceability defaults to 0.95 floor + all five source types', () => {
      const p = Personas.evidenceTraceability()
      expect(p.config['traceabilityFloor']).toBe(0.95)
      expect(p.config['sourceTypes']).toEqual([
        'first-party',
        'log-trace',
        'screenshot',
        'recording',
        'document-citation',
      ])
      expect(p.persona).toContain('95%')
    })

    it('evidenceTraceability defaults modelHint to opus', () => {
      const p = Personas.evidenceTraceability()
      expect(p.config['modelHint']).toBe('opus')
    })

    it('evidenceTraceability honours explicit modelHint override', () => {
      const p = Personas.evidenceTraceability({ modelHint: 'sonnet' })
      expect(p.config['modelHint']).toBe('sonnet')
    })

    it('evidenceTraceability rounds traceabilityFloor to integer percent in name + $id', () => {
      const p = Personas.evidenceTraceability({ traceabilityFloor: 0.876 })
      // round(0.876 * 100) === 88
      expect(p.name).toBe('evidence-traceability-floor-88')
      expect(p.config['$id']).toBe('persona:evidence-traceability:floor-88')
    })

    // ----- assumptionExplicitness -------------------------------------------

    it('assumptionExplicitness threads assumptionLevels + sensitivityAnalysisRequired into config', () => {
      const p = Personas.assumptionExplicitness({
        assumptionLevels: ['business', 'market'],
        sensitivityAnalysisRequired: false,
      })
      expect(p.config['assumptionLevels']).toEqual(['business', 'market'])
      expect(p.config['sensitivityAnalysisRequired']).toBe(false)
      expect(p.persona).toContain('business')
      expect(p.persona).toContain('market')
      expect(p.persona).toContain('Sensitivity-analysis declaration is optional')
    })

    it('assumptionExplicitness defaults to all four levels + sensitivity required', () => {
      const p = Personas.assumptionExplicitness()
      expect(p.config['sensitivityAnalysisRequired']).toBe(true)
      expect(p.config['assumptionLevels']).toEqual([
        'business',
        'technical',
        'market',
        'operational',
      ])
      expect(p.persona).toContain('MUST include an explicit sensitivity analysis')
    })

    it('assumptionExplicitness omits modelHint when not supplied (no default pin)', () => {
      const p = Personas.assumptionExplicitness()
      expect(p.config['modelHint']).toBeUndefined()
    })

    it('assumptionExplicitness honours modelHint when supplied', () => {
      const p = Personas.assumptionExplicitness({ modelHint: 'opus' })
      expect(p.config['modelHint']).toBe('opus')
    })

    it('assumptionExplicitness respects sensitivityAnalysisRequired=false in prompt language', () => {
      const p = Personas.assumptionExplicitness({ sensitivityAnalysisRequired: false })
      expect(p.persona).toContain('Sensitivity-analysis declaration is optional')
    })

    // ----- handoffReadiness -------------------------------------------------

    it('handoffReadiness threads handoffSurfaces + contextDensity into config', () => {
      const p = Personas.handoffReadiness({
        handoffSurfaces: ['engineering', 'cs'],
        contextDensity: 'comprehensive',
      })
      expect(p.config['handoffSurfaces']).toEqual(['engineering', 'cs'])
      expect(p.config['contextDensity']).toBe('comprehensive')
      expect(p.persona).toContain('engineering')
      expect(p.persona).toContain('cs')
      expect(p.persona).toContain('COMPREHENSIVE')
    })

    it('handoffReadiness defaults to empty handoffSurfaces (universal) + standard density', () => {
      const p = Personas.handoffReadiness()
      expect(p.config['handoffSurfaces']).toEqual([])
      expect(p.config['contextDensity']).toBe('standard')
      expect(p.persona).toContain('universal baseline')
      expect(p.persona).toContain('STANDARD')
    })

    it('handoffReadiness omits modelHint when not supplied (no default pin)', () => {
      const p = Personas.handoffReadiness()
      expect(p.config['modelHint']).toBeUndefined()
    })

    it('handoffReadiness honours modelHint when supplied', () => {
      const p = Personas.handoffReadiness({ modelHint: 'opus' })
      expect(p.config['modelHint']).toBe('opus')
    })

    it('handoffReadiness respects contextDensity=minimal in prompt language', () => {
      const p = Personas.handoffReadiness({ contextDensity: 'minimal' })
      expect(p.persona).toContain('MINIMAL')
    })

    it('handoffReadiness respects contextDensity=comprehensive in prompt language', () => {
      const p = Personas.handoffReadiness({ contextDensity: 'comprehensive' })
      expect(p.persona).toContain('COMPREHENSIVE')
    })
  })

  // ==========================================================================
  // Group 3 — signOff defaults
  // ==========================================================================

  describe('signOff defaults', () => {
    it('executiveSummary is must-approve (executive-readiness failures are dispositive)', () => {
      expect(Personas.executiveSummary().signOff).toBe('must-approve')
    })

    it('evidenceTraceability is must-approve (untraceable claims are dispositive on audit-grade output)', () => {
      expect(Personas.evidenceTraceability().signOff).toBe('must-approve')
    })

    it('assumptionExplicitness is must-approve (buried assumptions are dispositive on forecasts)', () => {
      expect(Personas.assumptionExplicitness().signOff).toBe('must-approve')
    })

    it('handoffReadiness is advisory (load-bearing for handoff Services, not a gate)', () => {
      expect(Personas.handoffReadiness().signOff).toBe('advisory')
    })
  })

  // ==========================================================================
  // Misc — name override + archetype tag
  // ==========================================================================

  describe('shape conformance', () => {
    it('all four factories tag config.archetype', () => {
      expect(Personas.executiveSummary().config['archetype']).toBe('executive-summary')
      expect(Personas.evidenceTraceability().config['archetype']).toBe('evidence-traceability')
      expect(Personas.assumptionExplicitness().config['archetype']).toBe('assumption-explicitness')
      expect(Personas.handoffReadiness().config['archetype']).toBe('handoff-readiness')
    })

    it('all four factories accept a name override', () => {
      expect(Personas.executiveSummary({ name: 'exec-bot' }).name).toBe('exec-bot')
      expect(Personas.evidenceTraceability({ name: 'trace-bot' }).name).toBe('trace-bot')
      expect(Personas.assumptionExplicitness({ name: 'assume-bot' }).name).toBe('assume-bot')
      expect(Personas.handoffReadiness({ name: 'handoff-bot' }).name).toBe('handoff-bot')
    })

    it('all four factories mint deterministic default names', () => {
      expect(Personas.executiveSummary().name).toBe('executive-summary-c-suite')
      expect(Personas.evidenceTraceability().name).toBe('evidence-traceability-floor-95')
      expect(Personas.assumptionExplicitness().name).toBe('assumption-explicitness-required')
      expect(Personas.handoffReadiness().name).toBe('handoff-readiness-universal-standard')
    })
  })
})
