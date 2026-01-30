import { describe, it, expect } from 'vitest'
import { Verbs, conjugate, getVerbFields, isStandardVerb, getStandardVerbs } from '../src/verb.js'

describe('Verbs constant', () => {
  it('contains standard CRUD verbs', () => {
    expect(Verbs.create).toBeDefined()
    expect(Verbs.update).toBeDefined()
    expect(Verbs.delete).toBeDefined()
  })

  it('has complete conjugations for create', () => {
    expect(Verbs.create).toEqual({
      action: 'create',
      actor: 'creator',
      act: 'creates',
      activity: 'creating',
      result: 'creation',
      reverse: {
        at: 'createdAt',
        by: 'createdBy',
        in: 'createdIn',
        for: 'createdFor',
      },
      inverse: 'delete',
    })
  })

  it('has complete conjugations for update', () => {
    expect(Verbs.update.action).toBe('update')
    expect(Verbs.update.actor).toBe('updater')
    expect(Verbs.update.act).toBe('updates')
    expect(Verbs.update.activity).toBe('updating')
    expect(Verbs.update.reverse?.at).toBe('updatedAt')
    expect(Verbs.update.reverse?.by).toBe('updatedBy')
  })

  it('has inverse for delete', () => {
    expect(Verbs.delete.inverse).toBe('create')
  })

  it('has publish with unpublish inverse', () => {
    expect(Verbs.publish.inverse).toBe('unpublish')
  })

  it('has archive with unarchive inverse', () => {
    expect(Verbs.archive.inverse).toBe('unarchive')
  })

  it('has approve with reject inverse', () => {
    expect(Verbs.approve.inverse).toBe('reject')
    expect(Verbs.reject.inverse).toBe('approve')
  })
})

describe('conjugate', () => {
  it('returns standard verb for known verbs', () => {
    expect(conjugate('create')).toEqual(Verbs.create)
    expect(conjugate('update')).toEqual(Verbs.update)
    expect(conjugate('delete')).toEqual(Verbs.delete)
    expect(conjugate('publish')).toEqual(Verbs.publish)
  })

  it('auto-conjugates unknown verbs', () => {
    const result = conjugate('configure')
    expect(result.action).toBe('configure')
    expect(result.actor).toBe('configurer')
    expect(result.act).toBe('configures')
    expect(result.activity).toBe('configuring')
    expect(result.result).toBe('configurion')
    expect(result.reverse?.at).toBe('configuredAt')
    expect(result.reverse?.by).toBe('configuredBy')
  })

  it('auto-conjugates -ate verbs with -ator suffix', () => {
    const result = conjugate('validate')
    expect(result.action).toBe('validate')
    expect(result.actor).toBe('validator')
    expect(result.act).toBe('validates')
    expect(result.activity).toBe('validating')
    expect(result.result).toBe('validation')
  })

  it('handles verbs ending in e', () => {
    const result = conjugate('configure')
    expect(result.actor).toBe('configurer')
    expect(result.activity).toBe('configuring')
    expect(result.reverse?.at).toBe('configuredAt')
  })

  it('handles verbs ending in y', () => {
    const result = conjugate('apply')
    expect(result.actor).toBe('applier')
    expect(result.act).toBe('applies')
    expect(result.activity).toBe('applying')
    expect(result.reverse?.at).toBe('appliedAt')
  })

  it('handles verbs that double consonants', () => {
    const result = conjugate('submit')
    expect(result.actor).toBe('submitter')
    expect(result.activity).toBe('submitting')
    expect(result.reverse?.at).toBe('submittedAt')
  })
})

describe('getVerbFields', () => {
  it('returns reverse fields for known verbs', () => {
    expect(getVerbFields('create')).toEqual({
      at: 'createdAt',
      by: 'createdBy',
      in: 'createdIn',
      for: 'createdFor',
    })
  })

  it('returns partial fields for verbs without all reverse forms', () => {
    expect(getVerbFields('update')).toEqual({
      at: 'updatedAt',
      by: 'updatedBy',
    })
  })
})

describe('isStandardVerb', () => {
  it('returns true for standard verbs', () => {
    expect(isStandardVerb('create')).toBe(true)
    expect(isStandardVerb('update')).toBe(true)
    expect(isStandardVerb('delete')).toBe(true)
    expect(isStandardVerb('publish')).toBe(true)
  })

  it('returns false for non-standard verbs', () => {
    expect(isStandardVerb('validate')).toBe(false)
    expect(isStandardVerb('configure')).toBe(false)
  })
})

describe('getStandardVerbs', () => {
  it('returns all standard verb names', () => {
    const verbs = getStandardVerbs()
    expect(verbs).toContain('create')
    expect(verbs).toContain('update')
    expect(verbs).toContain('delete')
    expect(verbs).toContain('publish')
    expect(verbs).toContain('archive')
    expect(verbs).toContain('approve')
    expect(verbs).toContain('reject')
    expect(verbs.length).toBeGreaterThan(5)
  })
})
