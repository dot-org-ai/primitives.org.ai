/**
 * Tests for Noun() factory — the Digital Objects foundation
 *
 * Covers:
 * - Property parsing (fields, relationships, enums, verbs, disabled)
 * - Verb conjugation (CRUD + custom)
 * - Proxy dispatch (create, get, find, update, delete)
 * - Before/after hooks
 * - Entity meta-fields ($id, $type, $context, $version, $createdAt, $updatedAt)
 * - Disabled verbs (null)
 * - Registry
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Noun } from '../src/noun.js'
import { parseProperty, parseNounDefinition, isVerbDeclaration } from '../src/noun-parse.js'
import { clearRegistry, getNounSchema, getAllNouns } from '../src/noun-registry.js'
import { setProvider, MemoryNounProvider } from '../src/noun-proxy.js'

beforeEach(() => {
  clearRegistry()
  setProvider(new MemoryNounProvider())
})

// =============================================================================
// Property Parsing
// =============================================================================

describe('parseProperty', () => {
  it('should parse null as disabled', () => {
    const result = parseProperty('update', null)
    expect(result.kind).toBe('disabled')
    expect(result.name).toBe('update')
  })

  it('should parse required string field', () => {
    const result = parseProperty('name', 'string!')
    expect(result.kind).toBe('field')
    expect(result.type).toBe('string')
    expect(result.modifiers?.required).toBe(true)
  })

  it('should parse optional indexed string field', () => {
    const result = parseProperty('email', 'string?#')
    expect(result.kind).toBe('field')
    expect(result.type).toBe('string')
    expect(result.modifiers?.optional).toBe(true)
    expect(result.modifiers?.indexed).toBe(true)
  })

  it('should parse unique indexed field', () => {
    const result = parseProperty('slug', 'string!##')
    expect(result.kind).toBe('field')
    expect(result.modifiers?.required).toBe(true)
    expect(result.modifiers?.unique).toBe(true)
    expect(result.modifiers?.indexed).toBe(true)
  })

  it('should parse forward relationship', () => {
    const result = parseProperty('company', '-> Company.contacts')
    expect(result.kind).toBe('relationship')
    expect(result.operator).toBe('->')
    expect(result.targetType).toBe('Company')
    expect(result.backref).toBe('contacts')
  })

  it('should parse reverse relationship array', () => {
    const result = parseProperty('deals', '<- Deal.contact[]')
    expect(result.kind).toBe('relationship')
    expect(result.operator).toBe('<-')
    expect(result.targetType).toBe('Deal')
    expect(result.backref).toBe('contact')
    expect(result.isArray).toBe(true)
  })

  it('should parse pipe-separated enum', () => {
    const result = parseProperty('stage', 'Lead | Qualified | Customer | Churned | Partner')
    expect(result.kind).toBe('enum')
    expect(result.enumValues).toEqual(['Lead', 'Qualified', 'Customer', 'Churned', 'Partner'])
  })

  it('should parse verb declaration (PascalCase value)', () => {
    const result = parseProperty('qualify', 'Qualified')
    expect(result.kind).toBe('verb')
    expect(result.verbAction).toBe('qualify')
  })

  it('should parse field with default value', () => {
    const result = parseProperty('status', 'string = "active"')
    expect(result.kind).toBe('field')
    expect(result.type).toBe('string')
    expect(result.defaultValue).toBe('active')
  })

  it('should parse datetime field', () => {
    const result = parseProperty('timestamp', 'datetime!')
    expect(result.kind).toBe('field')
    expect(result.type).toBe('datetime')
    expect(result.modifiers?.required).toBe(true)
  })

  it('should parse explicit enum', () => {
    const result = parseProperty('type', 'enum(email,phone,sms)')
    expect(result.kind).toBe('enum')
    expect(result.enumValues).toEqual(['email', 'phone', 'sms'])
  })
})

describe('isVerbDeclaration', () => {
  it('should detect PascalCase verb values', () => {
    expect(isVerbDeclaration('qualify', 'Qualified')).toBe(true)
    expect(isVerbDeclaration('close', 'Closed')).toBe(true)
    expect(isVerbDeclaration('activate', 'Activated')).toBe(true)
    expect(isVerbDeclaration('pause', 'Paused')).toBe(true)
  })

  it('should NOT detect known types as verbs', () => {
    expect(isVerbDeclaration('name', 'String')).toBe(false)
    expect(isVerbDeclaration('active', 'Boolean')).toBe(false)
    expect(isVerbDeclaration('count', 'Number')).toBe(false)
  })

  it('should NOT detect CRUD verbs as custom verbs', () => {
    expect(isVerbDeclaration('create', 'Created')).toBe(false)
    expect(isVerbDeclaration('update', 'Updated')).toBe(false)
    expect(isVerbDeclaration('delete', 'Deleted')).toBe(false)
  })

  it('should NOT detect PascalCase keys (entity names)', () => {
    expect(isVerbDeclaration('Company', 'Related')).toBe(false)
  })
})

describe('parseNounDefinition', () => {
  it('should categorize all property types', () => {
    const result = parseNounDefinition({
      name: 'string!',
      email: 'string?#',
      stage: 'Lead | Qualified | Customer',
      company: '-> Company.contacts',
      deals: '<- Deal.contact[]',
      qualify: 'Qualified',
      update: null,
    })

    expect(result.fields.size).toBe(2) // name, email
    expect(result.fields.has('stage')).toBe(true) // enum goes to fields
    expect(result.relationships.size).toBe(2) // company, deals
    expect(result.verbDeclarations.size).toBe(1) // qualify
    expect(result.disabled.size).toBe(1) // update
    expect(result.disabled.has('update')).toBe(true)
  })
})

// =============================================================================
// Noun() Factory
// =============================================================================

describe('Noun()', () => {
  it('should be a function', () => {
    expect(typeof Noun).toBe('function')
  })

  it('should create an entity with CRUD methods', () => {
    const TestEntity = Noun('TestEntity', {
      name: 'string!',
    })

    expect(typeof TestEntity['create']).toBe('function')
    expect(typeof TestEntity['get']).toBe('function')
    expect(typeof TestEntity['find']).toBe('function')
    expect(typeof TestEntity['update']).toBe('function')
    expect(typeof TestEntity['delete']).toBe('function')
  })

  it('should create an entity with custom verbs', () => {
    const TestEntity = Noun('TestEntity', {
      name: 'string!',
      status: 'Active | Inactive',
      activate: 'Activated',
    })

    expect(typeof TestEntity['create']).toBe('function')
    expect(typeof TestEntity['activate']).toBe('function')
  })

  it('should create BEFORE hooks (activity form)', () => {
    const TestEntity = Noun('TestEntity', {
      name: 'string!',
      activate: 'Activated',
    })

    expect(typeof TestEntity['creating']).toBe('function')
    expect(typeof TestEntity['updating']).toBe('function')
    expect(typeof TestEntity['deleting']).toBe('function')
    expect(typeof TestEntity['activating']).toBe('function')
  })

  it('should create AFTER hooks (event form)', () => {
    const TestEntity = Noun('TestEntity', {
      name: 'string!',
      activate: 'Activated',
    })

    expect(typeof TestEntity['created']).toBe('function')
    expect(typeof TestEntity['updated']).toBe('function')
    expect(typeof TestEntity['deleted']).toBe('function')
    expect(typeof TestEntity['activated']).toBe('function')
  })

  it('should disable verbs with null', () => {
    const ImmutableEvent = Noun('ImmutableEvent', {
      name: 'string!',
      timestamp: 'datetime!',
      update: null,
      delete: null,
    })

    expect(ImmutableEvent['update']).toBeNull()
    expect(ImmutableEvent['delete']).toBeNull()
    // create should still work
    expect(typeof ImmutableEvent['create']).toBe('function')
  })

  it('should register noun in the global registry', () => {
    Noun('MyEntity', { name: 'string!' })

    const schema = getNounSchema('MyEntity')
    expect(schema).toBeDefined()
    expect(schema?.name).toBe('MyEntity')
    expect(schema?.singular).toBe('my entity')
    expect(schema?.plural).toBe('my entities')
  })

  it('should track all registered nouns', () => {
    Noun('EntityA', { name: 'string!' })
    Noun('EntityB', { name: 'string!' })

    const all = getAllNouns()
    expect(all.size).toBe(2)
    expect(all.has('EntityA')).toBe(true)
    expect(all.has('EntityB')).toBe(true)
  })
})

// =============================================================================
// CRUD Operations
// =============================================================================

describe('CRUD operations', () => {
  it('create should return instance with meta fields', async () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      stage: 'Lead | Qualified',
    })

    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<Record<string, unknown>>
    const result = await create({ name: 'Alice', stage: 'Lead' })

    expect(result['$id']).toBeDefined()
    expect(result['$type']).toBe('Contact')
    expect(result['$context']).toBeDefined()
    expect(typeof result['$context']).toBe('string')
    expect(result['$version']).toBe(1)
    expect(result['$createdAt']).toBeDefined()
    expect(result['$updatedAt']).toBeDefined()
    expect(result['name']).toBe('Alice')
    expect(result['stage']).toBe('Lead')
  })

  it('$id should be in {type}_{sqid} format', async () => {
    const Contact = Noun('Contact', { name: 'string!' })

    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<Record<string, unknown>>
    const result = await create({ name: 'Test' })

    const id = result['$id'] as string
    expect(id).toMatch(/^contact_[a-zA-Z0-9]+$/)
    const suffix = id.replace('contact_', '')
    expect(suffix.length).toBeGreaterThanOrEqual(5)
    expect(suffix.length).toBeLessThanOrEqual(12)
  })

  it('$createdAt should be a valid ISO string', async () => {
    const Contact = Noun('Contact', { name: 'string!' })

    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<Record<string, unknown>>
    const result = await create({ name: 'Test' })

    const createdAt = result['$createdAt'] as string
    expect(new Date(createdAt).toISOString()).toBe(createdAt)
  })

  it('get should retrieve by ID', async () => {
    const Contact = Noun('Contact', { name: 'string!' })

    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<Record<string, unknown>>
    const get = Contact['get'] as (id: string) => Promise<Record<string, unknown> | null>

    const created = await create({ name: 'Alice' })
    const retrieved = await get(created['$id'] as string)

    expect(retrieved).toBeDefined()
    expect(retrieved?.['name']).toBe('Alice')
  })

  it('find should return matching entities', async () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      stage: 'Lead | Qualified',
    })

    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<Record<string, unknown>>
    const find = Contact['find'] as (where?: Record<string, unknown>) => Promise<Record<string, unknown>[]>

    await create({ name: 'Alice', stage: 'Lead' })
    await create({ name: 'Bob', stage: 'Qualified' })
    await create({ name: 'Carol', stage: 'Lead' })

    const leads = await find({ stage: 'Lead' })
    expect(leads.length).toBe(2)
  })

  it('update should modify and increment version', async () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      stage: 'Lead | Qualified',
    })

    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<Record<string, unknown>>
    const update = Contact['update'] as (id: string, data: Record<string, unknown>) => Promise<Record<string, unknown>>

    const created = await create({ name: 'Alice', stage: 'Lead' })
    const updated = await update(created['$id'] as string, { stage: 'Qualified' })

    expect(updated['stage']).toBe('Qualified')
    expect(updated['$version']).toBe(2)
  })

  it('delete should remove the entity', async () => {
    const Contact = Noun('Contact', { name: 'string!' })

    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<Record<string, unknown>>
    const del = Contact['delete'] as (id: string) => Promise<boolean>
    const get = Contact['get'] as (id: string) => Promise<Record<string, unknown> | null>

    const created = await create({ name: 'Alice' })
    const result = await del(created['$id'] as string)
    expect(result).toBe(true)

    const retrieved = await get(created['$id'] as string)
    expect(retrieved).toBeNull()
  })
})

// =============================================================================
// Verb Conjugation
// =============================================================================

describe('verb conjugation', () => {
  it('Contact should have create/creating/created', () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      qualify: 'Qualified',
    })

    expect(typeof Contact['create']).toBe('function')
    expect(typeof Contact['creating']).toBe('function')
    expect(typeof Contact['created']).toBe('function')
  })

  it('Contact should have update/updating/updated', () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      qualify: 'Qualified',
    })

    expect(typeof Contact['update']).toBe('function')
    expect(typeof Contact['updating']).toBe('function')
    expect(typeof Contact['updated']).toBe('function')
  })

  it('Contact should have delete/deleting/deleted', () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      qualify: 'Qualified',
    })

    expect(typeof Contact['delete']).toBe('function')
    expect(typeof Contact['deleting']).toBe('function')
    expect(typeof Contact['deleted']).toBe('function')
  })

  it('Contact.qualify/qualifying/qualified should exist', () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      qualify: 'Qualified',
    })

    expect(typeof Contact['qualify']).toBe('function')
    expect(typeof Contact['qualifying']).toBe('function')
    expect(typeof Contact['qualified']).toBe('function')
  })

  it('Deal.close/closing/closed should exist', () => {
    const Deal = Noun('Deal', {
      name: 'string!',
      value: 'number',
      close: 'Closed',
    })

    expect(typeof Deal['close']).toBe('function')
    expect(typeof Deal['closing']).toBe('function')
    expect(typeof Deal['closed']).toBe('function')
  })
})

// =============================================================================
// Hooks
// =============================================================================

describe('hooks', () => {
  it('BEFORE hook should fire before create', async () => {
    const calls: string[] = []

    const Contact = Noun('Contact', { name: 'string!' })
    const creating = Contact['creating'] as (handler: (data: Record<string, unknown>) => void) => void
    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<Record<string, unknown>>

    creating(() => {
      calls.push('before')
    })

    await create({ name: 'Alice' })
    expect(calls).toEqual(['before'])
  })

  it('AFTER hook should fire after create', async () => {
    const calls: string[] = []

    const Contact = Noun('Contact', { name: 'string!' })
    const created = Contact['created'] as (handler: (instance: Record<string, unknown>) => void) => void
    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<Record<string, unknown>>

    created((instance) => {
      calls.push(`after:${instance['name']}`)
    })

    await create({ name: 'Alice' })
    expect(calls).toEqual(['after:Alice'])
  })

  it('BEFORE hook can transform data', async () => {
    const Contact = Noun('Contact', { name: 'string!' })
    const creating = Contact['creating'] as (handler: (data: Record<string, unknown>) => Record<string, unknown>) => void
    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<Record<string, unknown>>

    creating((data) => {
      return { ...data, name: (data['name'] as string).toUpperCase() }
    })

    const result = await create({ name: 'alice' })
    expect(result['name']).toBe('ALICE')
  })

  it('custom verb hooks should fire', async () => {
    const calls: string[] = []

    const Contact = Noun('Contact', {
      name: 'string!',
      qualify: 'Qualified',
    })

    const qualifying = Contact['qualifying'] as (handler: (data: Record<string, unknown>) => void) => void
    const qualified = Contact['qualified'] as (handler: (instance: Record<string, unknown>) => void) => void
    const create = Contact['create'] as (data: Record<string, unknown>) => Promise<Record<string, unknown>>
    const qualify = Contact['qualify'] as (id: string, data?: Record<string, unknown>) => Promise<Record<string, unknown>>

    qualifying(() => calls.push('before-qualify'))
    qualified(() => calls.push('after-qualify'))

    const contact = await create({ name: 'Alice', stage: 'Lead' })
    await qualify(contact['$id'] as string, { stage: 'Qualified' })

    expect(calls).toEqual(['before-qualify', 'after-qualify'])
  })
})

// =============================================================================
// Relationship Parsing
// =============================================================================

describe('relationship parsing', () => {
  it('should parse the Contact definition from CLAUDE.md', () => {
    const Contact = Noun('Contact', {
      name: 'string!',
      email: 'string?#',
      stage: 'Lead | Qualified | Customer | Churned | Partner',
      company: '-> Company.contacts',
      deals: '<- Deal.contact[]',
      messages: '<- Message.contact[]',
      qualify: 'Qualified',
    })

    expect(Contact).toBeDefined()

    const schema = getNounSchema('Contact')
    expect(schema).toBeDefined()
    expect(schema?.fields.has('name')).toBe(true)
    expect(schema?.fields.has('email')).toBe(true)
    expect(schema?.fields.has('stage')).toBe(true) // enum → fields
    expect(schema?.relationships.has('company')).toBe(true)
    expect(schema?.relationships.has('deals')).toBe(true)
    expect(schema?.relationships.has('messages')).toBe(true)
    expect(schema?.verbs.has('qualify')).toBe(true)
    expect(schema?.verbs.has('create')).toBe(true)
    expect(schema?.verbs.has('update')).toBe(true)
    expect(schema?.verbs.has('delete')).toBe(true)
  })
})

// =============================================================================
// Immutable Entities
// =============================================================================

describe('immutable entities', () => {
  it('null disables update and delete', () => {
    const ImmutableEvent = Noun('ImmutableEvent', {
      name: 'string!',
      timestamp: 'datetime!',
      update: null,
      delete: null,
    })

    expect(ImmutableEvent['update']).toBeNull()
    expect(ImmutableEvent['delete']).toBeNull()
    expect(typeof ImmutableEvent['create']).toBe('function')
  })

  it('disabled verbs return null for activity and event forms too', () => {
    const ImmutableEvent = Noun('ImmutableEvent', {
      name: 'string!',
      update: null,
      delete: null,
    })

    // Activity and event forms of disabled verbs should also be null
    expect(ImmutableEvent['updating']).toBeNull()
    expect(ImmutableEvent['updated']).toBeNull()
    expect(ImmutableEvent['deleting']).toBeNull()
    expect(ImmutableEvent['deleted']).toBeNull()
  })
})

// =============================================================================
// $schema access
// =============================================================================

describe('$schema access', () => {
  it('should expose schema via $schema', () => {
    const Contact = Noun('Contact', { name: 'string!' })

    const schema = Contact['$schema'] as { name: string; singular: string; plural: string }
    expect(schema.name).toBe('Contact')
    expect(schema.singular).toBe('contact')
    expect(schema.plural).toBe('contacts')
  })

  it('should expose name via $name', () => {
    const Contact = Noun('Contact', { name: 'string!' })
    expect(Contact['$name']).toBe('Contact')
  })
})
