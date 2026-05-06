/**
 * Personas — specialized factory tests.
 *
 * Pins the contract for the four specialized factories added on top of the
 * six general-purpose ones:
 *
 *   - {@link Personas.regulatoryCompliance}
 *   - {@link Personas.accessibility}
 *   - {@link Personas.securityThreat}
 *   - {@link Personas.dataPrivacy}
 *
 * Three test groups:
 *
 *   1. `$id` namespace minting — every factory stamps `config.$id` under the
 *      expected `persona:<archetype>:<discriminator>` namespace so downstream
 *      MDXLD-aware tooling (panel introspection, audit log) can identify
 *      personas by stable id rather than mutable name.
 *   2. Opts threading — regulator / level / surfaces / framework / etc. flow
 *      through to `config` verbatim; defaults are the documented ones.
 *   3. signOffPolicy defaults — regulatoryCompliance + securityThreat are
 *      load-bearing (`'must-approve'`) per spec; accessibility and
 *      dataPrivacy are also `'must-approve'` per spec.
 */

import { describe, it, expect } from 'vitest'

import { Personas } from '../../src/v3/personas.js'

describe('Personas — specialized factories', () => {
  // ==========================================================================
  // Group 1 — $id namespace minting
  // ==========================================================================

  describe('$id namespace', () => {
    it('regulatoryCompliance mints persona:regulatory-compliance:<regulator>', () => {
      const p = Personas.regulatoryCompliance({ regulator: 'sec' })
      expect(p.config['$id']).toBe('persona:regulatory-compliance:sec')
    })

    it('regulatoryCompliance slugifies custom regulator strings', () => {
      const p = Personas.regulatoryCompliance({ regulator: 'iso 27001' })
      expect(p.config['$id']).toBe('persona:regulatory-compliance:iso-27001')
    })

    it('accessibility mints persona:accessibility:wcag-<level>', () => {
      const aa = Personas.accessibility()
      expect(aa.config['$id']).toBe('persona:accessibility:wcag-aa')
      const aaa = Personas.accessibility({ level: 'AAA' })
      expect(aaa.config['$id']).toBe('persona:accessibility:wcag-aaa')
    })

    it('securityThreat mints persona:security-threat:<severity>', () => {
      const all = Personas.securityThreat()
      expect(all.config['$id']).toBe('persona:security-threat:all')
      const critical = Personas.securityThreat({ severity: 'critical-only' })
      expect(critical.config['$id']).toBe('persona:security-threat:critical-only')
    })

    it('dataPrivacy mints persona:data-privacy:<framework>', () => {
      const general = Personas.dataPrivacy()
      expect(general.config['$id']).toBe('persona:data-privacy:general')
      const gdpr = Personas.dataPrivacy({ framework: 'gdpr' })
      expect(gdpr.config['$id']).toBe('persona:data-privacy:gdpr')
    })
  })

  // ==========================================================================
  // Group 2 — opts threading
  // ==========================================================================

  describe('opts threading', () => {
    it('regulatoryCompliance threads regulator + ruleSet into config', () => {
      const p = Personas.regulatoryCompliance({
        regulator: 'sec',
        ruleSet: ['SEC-Reg-FD', 'SEC-17a-4'],
      })
      expect(p.config['regulator']).toBe('sec')
      expect(p.config['ruleSet']).toEqual(['SEC-Reg-FD', 'SEC-17a-4'])
      // Prompt should mention the rule-set verbatim so the LLM applies the
      // documented rules rather than inferring them.
      expect(p.persona).toContain('SEC-Reg-FD')
      expect(p.persona).toContain('SEC-17a-4')
    })

    it('regulatoryCompliance defaults ruleSet to []', () => {
      const p = Personas.regulatoryCompliance({ regulator: 'hipaa' })
      expect(p.config['ruleSet']).toEqual([])
    })

    it('regulatoryCompliance defaults modelHint to opus', () => {
      const p = Personas.regulatoryCompliance({ regulator: 'sox' })
      expect(p.config['modelHint']).toBe('opus')
    })

    it('regulatoryCompliance honours explicit modelHint override', () => {
      const p = Personas.regulatoryCompliance({ regulator: 'sox', modelHint: 'sonnet' })
      expect(p.config['modelHint']).toBe('sonnet')
    })

    it('accessibility threads level + surfaces into config', () => {
      const p = Personas.accessibility({
        level: 'AAA',
        surfaces: ['screen-reader', 'cognitive'],
      })
      expect(p.config['level']).toBe('AAA')
      expect(p.config['surfaces']).toEqual(['screen-reader', 'cognitive'])
      expect(p.persona).toContain('WCAG 2.1 AAA')
    })

    it('accessibility defaults to AA + all four surfaces', () => {
      const p = Personas.accessibility()
      expect(p.config['level']).toBe('AA')
      expect(p.config['surfaces']).toEqual([
        'screen-reader',
        'keyboard-only',
        'low-vision',
        'cognitive',
      ])
    })

    it('securityThreat threads surfaces + severity into config', () => {
      const p = Personas.securityThreat({
        surfaces: ['prompt-injection', 'pii-leakage'],
        severity: 'critical-only',
      })
      expect(p.config['surfaces']).toEqual(['prompt-injection', 'pii-leakage'])
      expect(p.config['severity']).toBe('critical-only')
      expect(p.persona).toContain('prompt-injection')
      expect(p.persona).toContain('pii-leakage')
    })

    it('securityThreat defaults to all surfaces + all severities', () => {
      const p = Personas.securityThreat()
      expect(p.config['severity']).toBe('all')
      expect(p.config['surfaces']).toEqual([
        'injection',
        'data-exfiltration',
        'privilege-escalation',
        'pii-leakage',
        'prompt-injection',
        'denial-of-service',
      ])
    })

    it('securityThreat defaults modelHint to opus', () => {
      const p = Personas.securityThreat()
      expect(p.config['modelHint']).toBe('opus')
    })

    it('dataPrivacy threads framework + piiCategories + minimizationCheck', () => {
      const p = Personas.dataPrivacy({
        framework: 'gdpr',
        piiCategories: ['health', 'biometric'],
        minimizationCheck: false,
      })
      expect(p.config['framework']).toBe('gdpr')
      expect(p.config['piiCategories']).toEqual(['health', 'biometric'])
      expect(p.config['minimizationCheck']).toBe(false)
    })

    it('dataPrivacy defaults to general framework + all PII + minimization on', () => {
      const p = Personas.dataPrivacy()
      expect(p.config['framework']).toBe('general')
      expect(p.config['minimizationCheck']).toBe(true)
      expect(p.config['piiCategories']).toEqual([
        'name',
        'email',
        'phone',
        'ssn',
        'health',
        'financial',
        'biometric',
        'behavioral',
      ])
    })
  })

  // ==========================================================================
  // Group 3 — signOff defaults
  // ==========================================================================

  describe('signOff defaults', () => {
    it('regulatoryCompliance is must-approve (load-bearing)', () => {
      expect(Personas.regulatoryCompliance({ regulator: 'sec' }).signOff).toBe('must-approve')
    })

    it('accessibility is must-approve (human-consumed output)', () => {
      expect(Personas.accessibility().signOff).toBe('must-approve')
    })

    it('securityThreat is must-approve (load-bearing)', () => {
      expect(Personas.securityThreat().signOff).toBe('must-approve')
    })

    it('dataPrivacy is must-approve (customer-data-touching)', () => {
      expect(Personas.dataPrivacy().signOff).toBe('must-approve')
    })
  })

  // ==========================================================================
  // Misc — name override + archetype tag
  // ==========================================================================

  describe('shape conformance', () => {
    it('all four factories tag config.archetype', () => {
      expect(Personas.regulatoryCompliance({ regulator: 'sec' }).config['archetype']).toBe(
        'regulatory-compliance'
      )
      expect(Personas.accessibility().config['archetype']).toBe('accessibility')
      expect(Personas.securityThreat().config['archetype']).toBe('security-threat')
      expect(Personas.dataPrivacy().config['archetype']).toBe('data-privacy')
    })

    it('all four factories accept a name override', () => {
      expect(Personas.regulatoryCompliance({ regulator: 'sec', name: 'sec-checker' }).name).toBe(
        'sec-checker'
      )
      expect(Personas.accessibility({ name: 'a11y' }).name).toBe('a11y')
      expect(Personas.securityThreat({ name: 'sec-bot' }).name).toBe('sec-bot')
      expect(Personas.dataPrivacy({ name: 'privacy-bot' }).name).toBe('privacy-bot')
    })
  })
})
