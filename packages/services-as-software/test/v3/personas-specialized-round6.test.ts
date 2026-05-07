/**
 * Personas — specialized factory tests, round 6.
 *
 * Pins the contract for the four contractual-clarity / actionability /
 * decision-bias / success-criteria factories shipped on top of the round-1 +
 * round-2 + round-3 + round-4 + round-5 specialized twenty:
 *
 *   - {@link Personas.contractualClarity}
 *   - {@link Personas.actionVerb}
 *   - {@link Personas.anchoring}
 *   - {@link Personas.successCriteria}
 *
 * Three test groups (mirroring `personas-specialized-round5.test.ts`):
 *
 *   1. `$id` namespace minting — every factory stamps `config.$id` under the
 *      expected `persona:<archetype>:<discriminator>` namespace.
 *   2. Opts threading — contractType / ambiguityTolerance / artifactType /
 *      commandPrecisionRequired / biasTypes / severityThreshold /
 *      criteriaTypes / minCriteriaPerObjective flow through to `config`
 *      verbatim; defaults are the documented ones.
 *   3. signOff defaults — contractualClarity + actionVerb + successCriteria
 *      are `'must-approve'` (load-bearing for shipping artifacts);
 *      anchoring is `'advisory'` (load-bearing for decision-recommendation
 *      Services where the human reviewer makes the call).
 */

import { describe, it, expect } from 'vitest'

import { Personas } from '../../src/v3/personas.js'

describe('Personas — specialized factories (round 6)', () => {
  // ==========================================================================
  // Group 1 — $id namespace minting
  // ==========================================================================

  describe('$id namespace', () => {
    it('contractualClarity mints persona:contractual-clarity:<contractType>-<tolerance>', () => {
      const p = Personas.contractualClarity()
      expect(p.config['$id']).toBe('persona:contractual-clarity:msa-strict')
      const sow = Personas.contractualClarity({ contractType: 'sow' })
      expect(sow.config['$id']).toBe('persona:contractual-clarity:sow-strict')
      const nda = Personas.contractualClarity({
        contractType: 'nda',
        ambiguityTolerance: 'moderate',
      })
      expect(nda.config['$id']).toBe('persona:contractual-clarity:nda-moderate')
    })

    it('contractualClarity slugifies custom contractType strings', () => {
      const p = Personas.contractualClarity({ contractType: 'Reseller Agreement' })
      expect(p.config['$id']).toBe('persona:contractual-clarity:reseller-agreement-strict')
    })

    it('actionVerb mints persona:action-verb:<artifactType>', () => {
      const p = Personas.actionVerb()
      expect(p.config['$id']).toBe('persona:action-verb:runbook')
      const sop = Personas.actionVerb({ artifactType: 'sop' })
      expect(sop.config['$id']).toBe('persona:action-verb:sop')
      const tutorial = Personas.actionVerb({ artifactType: 'tutorial' })
      expect(tutorial.config['$id']).toBe('persona:action-verb:tutorial')
      const apiDoc = Personas.actionVerb({ artifactType: 'api-doc' })
      expect(apiDoc.config['$id']).toBe('persona:action-verb:api-doc')
      const spec = Personas.actionVerb({ artifactType: 'spec' })
      expect(spec.config['$id']).toBe('persona:action-verb:spec')
    })

    it('anchoring mints persona:anchoring:<severity>', () => {
      const p = Personas.anchoring()
      expect(p.config['$id']).toBe('persona:anchoring:all')
      const critical = Personas.anchoring({ severityThreshold: 'critical-only' })
      expect(critical.config['$id']).toBe('persona:anchoring:critical-only')
    })

    it('successCriteria mints persona:success-criteria:min-<n>', () => {
      const p = Personas.successCriteria()
      expect(p.config['$id']).toBe('persona:success-criteria:min-2')
      const stricter = Personas.successCriteria({ minCriteriaPerObjective: 3 })
      expect(stricter.config['$id']).toBe('persona:success-criteria:min-3')
      const lenient = Personas.successCriteria({ minCriteriaPerObjective: 1 })
      expect(lenient.config['$id']).toBe('persona:success-criteria:min-1')
    })
  })

  // ==========================================================================
  // Group 2 — opts threading
  // ==========================================================================

  describe('opts threading', () => {
    // ----- contractualClarity -----------------------------------------------

    it('contractualClarity threads contractType + ambiguityTolerance into config', () => {
      const p = Personas.contractualClarity({
        contractType: 'employment',
        ambiguityTolerance: 'moderate',
      })
      expect(p.config['contractType']).toBe('employment')
      expect(p.config['ambiguityTolerance']).toBe('moderate')
      expect(p.persona).toContain('EMPLOYMENT')
      expect(p.persona).toContain('MODERATE ambiguity tolerance')
    })

    it('contractualClarity defaults to msa + strict tolerance', () => {
      const p = Personas.contractualClarity()
      expect(p.config['contractType']).toBe('msa')
      expect(p.config['ambiguityTolerance']).toBe('strict')
      expect(p.persona).toContain('MSA')
      expect(p.persona).toContain('STRICT ambiguity tolerance')
    })

    it('contractualClarity defaults modelHint to opus', () => {
      const p = Personas.contractualClarity()
      expect(p.config['modelHint']).toBe('opus')
    })

    it('contractualClarity honours explicit modelHint override', () => {
      const p = Personas.contractualClarity({ modelHint: 'sonnet' })
      expect(p.config['modelHint']).toBe('sonnet')
    })

    it('contractualClarity respects ambiguityTolerance=strict in prompt language', () => {
      const p = Personas.contractualClarity({ ambiguityTolerance: 'strict' })
      expect(p.persona).toContain('STRICT ambiguity tolerance')
    })

    // ----- actionVerb --------------------------------------------------------

    it('actionVerb threads artifactType + commandPrecisionRequired into config', () => {
      const p = Personas.actionVerb({
        artifactType: 'sop',
        commandPrecisionRequired: false,
      })
      expect(p.config['artifactType']).toBe('sop')
      expect(p.config['commandPrecisionRequired']).toBe(false)
      expect(p.persona).toContain('SOP')
      expect(p.persona).toContain('Command-precision is advisory')
    })

    it('actionVerb defaults to runbook + commandPrecisionRequired true', () => {
      const p = Personas.actionVerb()
      expect(p.config['artifactType']).toBe('runbook')
      expect(p.config['commandPrecisionRequired']).toBe(true)
      expect(p.persona).toContain('RUNBOOK')
      expect(p.persona).toContain('MUST include an exact, copy-pasteable command')
    })

    it('actionVerb omits modelHint when not supplied (no default pin)', () => {
      const p = Personas.actionVerb()
      expect(p.config['modelHint']).toBeUndefined()
    })

    it('actionVerb honours modelHint when supplied', () => {
      const p = Personas.actionVerb({ modelHint: 'opus' })
      expect(p.config['modelHint']).toBe('opus')
    })

    it('actionVerb respects commandPrecisionRequired=false in prompt language', () => {
      const p = Personas.actionVerb({ commandPrecisionRequired: false })
      expect(p.persona).toContain('Command-precision is advisory')
    })

    // ----- anchoring --------------------------------------------------------

    it('anchoring threads biasTypes + severityThreshold into config', () => {
      const p = Personas.anchoring({
        biasTypes: ['anchoring', 'confirmation'],
        severityThreshold: 'critical-only',
      })
      expect(p.config['biasTypes']).toEqual(['anchoring', 'confirmation'])
      expect(p.config['severityThreshold']).toBe('critical-only')
      expect(p.persona).toContain('anchoring')
      expect(p.persona).toContain('confirmation')
      expect(p.persona).toContain('Flag only critical-severity bias contamination')
    })

    it('anchoring defaults to all seven bias types + all severities', () => {
      const p = Personas.anchoring()
      expect(p.config['severityThreshold']).toBe('all')
      expect(p.config['biasTypes']).toEqual([
        'anchoring',
        'availability',
        'confirmation',
        'survivorship',
        'recency',
        'authority',
        'sunk-cost',
      ])
      expect(p.persona).toContain('Flag every bias-tinged passage')
    })

    it('anchoring defaults modelHint to opus', () => {
      const p = Personas.anchoring()
      expect(p.config['modelHint']).toBe('opus')
    })

    it('anchoring honours explicit modelHint override', () => {
      const p = Personas.anchoring({ modelHint: 'sonnet' })
      expect(p.config['modelHint']).toBe('sonnet')
    })

    it('anchoring respects severityThreshold=all in prompt language', () => {
      const p = Personas.anchoring({ severityThreshold: 'all' })
      expect(p.persona).toContain('Flag every bias-tinged passage')
    })

    // ----- successCriteria --------------------------------------------------

    it('successCriteria threads criteriaTypes + minCriteriaPerObjective into config', () => {
      const p = Personas.successCriteria({
        criteriaTypes: ['measurable', 'time-bound'],
        minCriteriaPerObjective: 3,
      })
      expect(p.config['criteriaTypes']).toEqual(['measurable', 'time-bound'])
      expect(p.config['minCriteriaPerObjective']).toBe(3)
      expect(p.persona).toContain('measurable')
      expect(p.persona).toContain('time-bound')
      expect(p.persona).toContain('at least 3 criteri')
    })

    it('successCriteria defaults to all four criteria types + min 2', () => {
      const p = Personas.successCriteria()
      expect(p.config['minCriteriaPerObjective']).toBe(2)
      expect(p.config['criteriaTypes']).toEqual([
        'measurable',
        'time-bound',
        'attestable',
        'falsifiable',
      ])
      expect(p.persona).toContain('at least 2 criteri')
    })

    it('successCriteria omits modelHint when not supplied (no default pin)', () => {
      const p = Personas.successCriteria()
      expect(p.config['modelHint']).toBeUndefined()
    })

    it('successCriteria honours modelHint when supplied', () => {
      const p = Personas.successCriteria({ modelHint: 'opus' })
      expect(p.config['modelHint']).toBe('opus')
    })
  })

  // ==========================================================================
  // Group 3 — signOff defaults
  // ==========================================================================

  describe('signOff defaults', () => {
    it('contractualClarity is must-approve (contract ambiguity is dispositive on contract drafts)', () => {
      expect(Personas.contractualClarity().signOff).toBe('must-approve')
    })

    it('actionVerb is must-approve (vague action verbs are dispositive on operational artifacts)', () => {
      expect(Personas.actionVerb().signOff).toBe('must-approve')
    })

    it('anchoring is advisory (load-bearing for decision-recommendation Services, not a gate)', () => {
      expect(Personas.anchoring().signOff).toBe('advisory')
    })

    it('successCriteria is must-approve (vague success criteria are dispositive on OKRs / plans)', () => {
      expect(Personas.successCriteria().signOff).toBe('must-approve')
    })
  })

  // ==========================================================================
  // Misc — name override + archetype tag
  // ==========================================================================

  describe('shape conformance', () => {
    it('all four factories tag config.archetype', () => {
      expect(Personas.contractualClarity().config['archetype']).toBe('contractual-clarity')
      expect(Personas.actionVerb().config['archetype']).toBe('action-verb')
      expect(Personas.anchoring().config['archetype']).toBe('anchoring')
      expect(Personas.successCriteria().config['archetype']).toBe('success-criteria')
    })

    it('all four factories accept a name override', () => {
      expect(Personas.contractualClarity({ name: 'contract-bot' }).name).toBe('contract-bot')
      expect(Personas.actionVerb({ name: 'verb-bot' }).name).toBe('verb-bot')
      expect(Personas.anchoring({ name: 'bias-bot' }).name).toBe('bias-bot')
      expect(Personas.successCriteria({ name: 'criteria-bot' }).name).toBe('criteria-bot')
    })

    it('all four factories mint deterministic default names', () => {
      expect(Personas.contractualClarity().name).toBe('contractual-clarity-msa-strict')
      expect(Personas.actionVerb().name).toBe('action-verb-runbook')
      expect(Personas.anchoring().name).toBe('anchoring-all')
      expect(Personas.successCriteria().name).toBe('success-criteria-min-2')
    })
  })
})
