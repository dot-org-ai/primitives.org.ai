/**
 * Personas — specialized factory tests, round 3.
 *
 * Pins the contract for the four production-evaluation execution-axis
 * factories shipped on top of the round-1 + round-2 specialized eight:
 *
 *   - {@link Personas.scopeClarity}
 *   - {@link Personas.edgeCaseCoverage}
 *   - {@link Personas.regressionRisk}
 *   - {@link Personas.localizationReady}
 *
 * Three test groups (mirroring `personas-specialized-round2.test.ts`):
 *
 *   1. `$id` namespace minting — every factory stamps `config.$id` under the
 *      expected `persona:<archetype>:<discriminator>` namespace.
 *   2. Opts threading — artifactType / domains / changeType / targetLocales /
 *      etc. flow through to `config` verbatim; defaults are the documented
 *      ones.
 *   3. signOff defaults — scopeClarity + edgeCaseCoverage + regressionRisk are
 *      `'must-approve'` (load-bearing for shipping artifacts);
 *      localizationReady is `'advisory'` (load-bearing only for global-product
 *      Services where the verdict gates real-user UX).
 */

import { describe, it, expect } from 'vitest'

import { Personas } from '../../src/v3/personas.js'

describe('Personas — specialized factories (round 3)', () => {
  // ==========================================================================
  // Group 1 — $id namespace minting
  // ==========================================================================

  describe('$id namespace', () => {
    it('scopeClarity mints persona:scope-clarity:<artifactType>', () => {
      const p = Personas.scopeClarity()
      expect(p.config['$id']).toBe('persona:scope-clarity:prd')
      const sow = Personas.scopeClarity({ artifactType: 'sow' })
      expect(sow.config['$id']).toBe('persona:scope-clarity:sow')
      const epic = Personas.scopeClarity({ artifactType: 'epic' })
      expect(epic.config['$id']).toBe('persona:scope-clarity:epic')
    })

    it('scopeClarity slugifies custom artifact-type strings', () => {
      const p = Personas.scopeClarity({ artifactType: 'design doc' })
      expect(p.config['$id']).toBe('persona:scope-clarity:design-doc')
    })

    it('edgeCaseCoverage mints persona:edge-case-coverage:min-<n>', () => {
      const p = Personas.edgeCaseCoverage()
      expect(p.config['$id']).toBe('persona:edge-case-coverage:min-3')
      const five = Personas.edgeCaseCoverage({ minEdgeCasesPerScenario: 5 })
      expect(five.config['$id']).toBe('persona:edge-case-coverage:min-5')
    })

    it('regressionRisk mints persona:regression-risk:<changeType>', () => {
      const p = Personas.regressionRisk()
      expect(p.config['$id']).toBe('persona:regression-risk:code')
      const schema = Personas.regressionRisk({ changeType: 'schema' })
      expect(schema.config['$id']).toBe('persona:regression-risk:schema')
      const policy = Personas.regressionRisk({ changeType: 'policy' })
      expect(policy.config['$id']).toBe('persona:regression-risk:policy')
    })

    it('regressionRisk slugifies custom change-type strings', () => {
      const p = Personas.regressionRisk({ changeType: 'feature flag' })
      expect(p.config['$id']).toBe('persona:regression-risk:feature-flag')
    })

    it('localizationReady mints persona:localization-ready:universal by default', () => {
      const p = Personas.localizationReady()
      expect(p.config['$id']).toBe('persona:localization-ready:universal')
    })

    it('localizationReady mints persona:localization-ready:<slugged-locales> when supplied', () => {
      const p = Personas.localizationReady({ targetLocales: ['en-US', 'ja-JP'] })
      expect(p.config['$id']).toBe('persona:localization-ready:en-us-ja-jp')
    })
  })

  // ==========================================================================
  // Group 2 — opts threading
  // ==========================================================================

  describe('opts threading', () => {
    // ----- scopeClarity -----------------------------------------------------

    it('scopeClarity threads artifactType + boundary + out-of-scope flags', () => {
      const p = Personas.scopeClarity({
        artifactType: 'sow',
        scopeBoundaryRequired: true,
        outOfScopeListRequired: false,
      })
      expect(p.config['artifactType']).toBe('sow')
      expect(p.config['scopeBoundaryRequired']).toBe(true)
      expect(p.config['outOfScopeListRequired']).toBe(false)
      expect(p.persona).toContain('SOW')
      expect(p.persona).toContain('scope boundary')
      // out-of-scope flag false should produce the advisory clause
      expect(p.persona).toContain('Out-of-scope enumeration is optional')
    })

    it('scopeClarity defaults to prd + boundary required + out-of-scope required', () => {
      const p = Personas.scopeClarity()
      expect(p.config['artifactType']).toBe('prd')
      expect(p.config['scopeBoundaryRequired']).toBe(true)
      expect(p.config['outOfScopeListRequired']).toBe(true)
      expect(p.persona).toContain('PRD')
    })

    it('scopeClarity omits modelHint when not supplied (no default pin)', () => {
      const p = Personas.scopeClarity()
      expect(p.config['modelHint']).toBeUndefined()
    })

    it('scopeClarity honours modelHint when supplied', () => {
      const p = Personas.scopeClarity({ modelHint: 'opus' })
      expect(p.config['modelHint']).toBe('opus')
    })

    it('scopeClarity respects scopeBoundaryRequired=false in prompt language', () => {
      const p = Personas.scopeClarity({ scopeBoundaryRequired: false })
      expect(p.persona).toContain('Scope-boundary declaration is optional')
    })

    // ----- edgeCaseCoverage -------------------------------------------------

    it('edgeCaseCoverage threads domains + minEdgeCasesPerScenario into config', () => {
      const p = Personas.edgeCaseCoverage({
        domains: ['empty-input', 'partial-failure'],
        minEdgeCasesPerScenario: 5,
      })
      expect(p.config['domains']).toEqual(['empty-input', 'partial-failure'])
      expect(p.config['minEdgeCasesPerScenario']).toBe(5)
      expect(p.persona).toContain('empty-input')
      expect(p.persona).toContain('partial-failure')
      expect(p.persona).toContain('5 edge cases')
    })

    it('edgeCaseCoverage defaults to all seven domains + min 3', () => {
      const p = Personas.edgeCaseCoverage()
      expect(p.config['minEdgeCasesPerScenario']).toBe(3)
      expect(p.config['domains']).toEqual([
        'empty-input',
        'malformed-input',
        'extreme-volume',
        'concurrent-modification',
        'partial-failure',
        'time-zone',
        'localization',
      ])
    })

    it('edgeCaseCoverage defaults modelHint to opus', () => {
      const p = Personas.edgeCaseCoverage()
      expect(p.config['modelHint']).toBe('opus')
    })

    it('edgeCaseCoverage honours explicit modelHint override', () => {
      const p = Personas.edgeCaseCoverage({ modelHint: 'sonnet' })
      expect(p.config['modelHint']).toBe('sonnet')
    })

    it('edgeCaseCoverage singularises edge case vs edge cases correctly', () => {
      const p = Personas.edgeCaseCoverage({ minEdgeCasesPerScenario: 1 })
      expect(p.persona).toContain('1 edge case ')
      expect(p.persona).not.toContain('1 edge cases')
    })

    // ----- regressionRisk ---------------------------------------------------

    it('regressionRisk threads changeType + blast-radius + rollback flags', () => {
      const p = Personas.regressionRisk({
        changeType: 'schema',
        blastRadiusRequired: true,
        rollbackPlanRequired: false,
      })
      expect(p.config['changeType']).toBe('schema')
      expect(p.config['blastRadiusRequired']).toBe(true)
      expect(p.config['rollbackPlanRequired']).toBe(false)
      expect(p.persona).toContain('SCHEMA')
      expect(p.persona).toContain('blast-radius')
      expect(p.persona).toContain('Rollback-plan declaration is optional')
    })

    it('regressionRisk defaults to code + blast-radius required + rollback required', () => {
      const p = Personas.regressionRisk()
      expect(p.config['changeType']).toBe('code')
      expect(p.config['blastRadiusRequired']).toBe(true)
      expect(p.config['rollbackPlanRequired']).toBe(true)
      expect(p.persona).toContain('CODE')
    })

    it('regressionRisk defaults modelHint to opus', () => {
      const p = Personas.regressionRisk()
      expect(p.config['modelHint']).toBe('opus')
    })

    it('regressionRisk honours explicit modelHint override', () => {
      const p = Personas.regressionRisk({ modelHint: 'sonnet' })
      expect(p.config['modelHint']).toBe('sonnet')
    })

    it('regressionRisk respects blastRadiusRequired=false in prompt language', () => {
      const p = Personas.regressionRisk({ blastRadiusRequired: false })
      expect(p.persona).toContain('Blast-radius analysis is optional')
    })

    // ----- localizationReady ------------------------------------------------

    it('localizationReady threads targetLocales + checkSurfaces into config', () => {
      const p = Personas.localizationReady({
        targetLocales: ['en-US', 'fr-FR', 'ar-SA'],
        checkSurfaces: ['rtl', 'plurals'],
      })
      expect(p.config['targetLocales']).toEqual(['en-US', 'fr-FR', 'ar-SA'])
      expect(p.config['checkSurfaces']).toEqual(['rtl', 'plurals'])
      expect(p.persona).toContain('en-US')
      expect(p.persona).toContain('ar-SA')
      expect(p.persona).toContain('rtl')
      expect(p.persona).toContain('plurals')
    })

    it('localizationReady defaults to empty targetLocales + all seven surfaces', () => {
      const p = Personas.localizationReady()
      expect(p.config['targetLocales']).toEqual([])
      expect(p.config['checkSurfaces']).toEqual([
        'prose',
        'numerals',
        'date-time',
        'currency',
        'rtl',
        'plurals',
        'cultural-references',
      ])
    })

    it('localizationReady prompt mentions universal baseline when no locales supplied', () => {
      const p = Personas.localizationReady()
      expect(p.persona).toContain('universal baseline')
    })

    it('localizationReady omits modelHint when not supplied (no default pin)', () => {
      const p = Personas.localizationReady()
      expect(p.config['modelHint']).toBeUndefined()
    })

    it('localizationReady honours modelHint when supplied', () => {
      const p = Personas.localizationReady({ modelHint: 'opus' })
      expect(p.config['modelHint']).toBe('opus')
    })
  })

  // ==========================================================================
  // Group 3 — signOff defaults
  // ==========================================================================

  describe('signOff defaults', () => {
    it('scopeClarity is must-approve (scope ambiguity is dispositive)', () => {
      expect(Personas.scopeClarity().signOff).toBe('must-approve')
    })

    it('edgeCaseCoverage is must-approve (under-enumeration ships regressions)', () => {
      expect(Personas.edgeCaseCoverage().signOff).toBe('must-approve')
    })

    it('regressionRisk is must-approve (blast-radius / rollback discipline gates change)', () => {
      expect(Personas.regressionRisk().signOff).toBe('must-approve')
    })

    it('localizationReady is advisory (load-bearing only for global-product Services)', () => {
      expect(Personas.localizationReady().signOff).toBe('advisory')
    })
  })

  // ==========================================================================
  // Misc — name override + archetype tag
  // ==========================================================================

  describe('shape conformance', () => {
    it('all four factories tag config.archetype', () => {
      expect(Personas.scopeClarity().config['archetype']).toBe('scope-clarity')
      expect(Personas.edgeCaseCoverage().config['archetype']).toBe('edge-case-coverage')
      expect(Personas.regressionRisk().config['archetype']).toBe('regression-risk')
      expect(Personas.localizationReady().config['archetype']).toBe('localization-ready')
    })

    it('all four factories accept a name override', () => {
      expect(Personas.scopeClarity({ name: 'scope-bot' }).name).toBe('scope-bot')
      expect(Personas.edgeCaseCoverage({ name: 'edge-bot' }).name).toBe('edge-bot')
      expect(Personas.regressionRisk({ name: 'regress-bot' }).name).toBe('regress-bot')
      expect(Personas.localizationReady({ name: 'l10n-bot' }).name).toBe('l10n-bot')
    })

    it('all four factories mint deterministic default names', () => {
      expect(Personas.scopeClarity().name).toBe('scope-clarity-prd')
      expect(Personas.edgeCaseCoverage().name).toBe('edge-case-coverage-min-3')
      expect(Personas.regressionRisk().name).toBe('regression-risk-code')
      expect(Personas.localizationReady().name).toBe('localization-ready-universal')
    })
  })
})
