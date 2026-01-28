/**
 * Cascade/Relationship Parsing Tests
 *
 * Tests for parsing cascade definitions from string descriptions.
 * Reference: @dotdo/do core/src/do.ts (parseCascade, CascadeDefinition, parseFilters)
 *
 * Cascade/Relationship Operators:
 * ->   outgoing (create/link, can cascade generate)
 * <-   incoming (refs pointing to me)
 * <->  bidirectional (many-to-many)
 * ~>   outgoing + fuzzy (find existing, no dupes)
 * <~   incoming + fuzzy (vector/similarity search)
 * <~>  bidirectional + fuzzy
 */

import { describe, it, expect } from 'vitest'
import { parseCascade, parseFilters, DO } from '../src/do'
import type { CascadeDefinition } from '../src/do'

describe('parseCascade', () => {
  it('parses outgoing cascade ->', () => {
    const result = parseCascade('Co-founders ->Founder')
    expect(result.cascade).toBeDefined()
    expect(result.cascade?.operator).toBe('->')
    expect(result.cascade?.targetType).toBe('Founder')
    expect(result.description).toBe('Co-founders')
  })

  it('parses incoming cascade <-', () => {
    const result = parseCascade('<- Tenant.tenantOf')
    expect(result.cascade?.operator).toBe('<-')
    expect(result.cascade?.targetType).toBe('Tenant')
    expect(result.cascade?.predicate).toBe('tenantOf')
  })

  it('parses bidirectional cascade <->', () => {
    const result = parseCascade('Friends <->User')
    expect(result.cascade?.operator).toBe('<->')
    expect(result.cascade?.isBidirectional).toBe(true)
  })

  it('parses fuzzy outgoing ~>', () => {
    const result = parseCascade('Similar ~>Product')
    expect(result.cascade?.operator).toBe('~>')
    expect(result.cascade?.isFuzzy).toBe(true)
  })

  it('parses fuzzy incoming <~', () => {
    const result = parseCascade('<~ Document.similar')
    expect(result.cascade?.operator).toBe('<~')
    expect(result.cascade?.isFuzzy).toBe(true)
  })

  it('parses fuzzy bidirectional <~>', () => {
    const result = parseCascade('Related <~>Item')
    expect(result.cascade?.operator).toBe('<~>')
    expect(result.cascade?.isFuzzy).toBe(true)
    expect(result.cascade?.isBidirectional).toBe(true)
  })

  it('parses route parameter', () => {
    const result = parseCascade(':tenant ->Workspace')
    expect(result.cascade?.routeParam).toBe('tenant')
    expect(result.cascade?.targetType).toBe('Workspace')
  })

  it('parses filters', () => {
    const result = parseCascade('->User[status=active]')
    expect(result.cascade?.filters).toHaveLength(1)
    expect(result.cascade?.filters?.[0]).toEqual({
      field: 'status',
      operator: '=',
      value: 'active',
    })
  })

  it('parses multiple filters', () => {
    const result = parseCascade('->User[status=active, plan=Pro]')
    expect(result.cascade?.filters).toHaveLength(2)
  })

  it('returns no cascade for plain string', () => {
    const result = parseCascade('Just a description')
    expect(result.cascade).toBeUndefined()
    expect(result.description).toBe('Just a description')
  })
})

describe('parseFilters', () => {
  it('parses equality filter', () => {
    const filters = parseFilters('status=active')
    expect(filters).toEqual([{ field: 'status', operator: '=', value: 'active' }])
  })

  it('parses numeric filter', () => {
    const filters = parseFilters('mrr>1000')
    expect(filters).toEqual([{ field: 'mrr', operator: '>', value: 1000 }])
  })

  it('parses boolean filter', () => {
    const filters = parseFilters('active=true')
    expect(filters).toEqual([{ field: 'active', operator: '=', value: true }])
  })

  it('parses inequality operators', () => {
    expect(parseFilters('a!=b')[0].operator).toBe('!=')
    expect(parseFilters('x>=10')[0].operator).toBe('>=')
    expect(parseFilters('y<=5')[0].operator).toBe('<=')
    expect(parseFilters('z<100')[0].operator).toBe('<')
  })
})

describe('DO() with cascades', () => {
  it('extracts cascades from definition', () => {
    const Startup = DO({
      $type: 'Startup',
      name: 'Name',
      founders: ['Co-founders ->Founder'],
      investors: ['Investors ->Investor'],
    })

    expect(Startup.cascades).toHaveProperty('founders')
    expect(Startup.cascades).toHaveProperty('investors')
    expect(Startup.cascades.founders.targetType).toBe('Founder')
    expect(Startup.cascades.founders.isArray).toBe(true)
  })

  it('distinguishes fields from cascades', () => {
    const Post = DO({
      $type: 'Post',
      title: 'Post title', // field
      author: 'Written by ->Author', // cascade
    })

    expect(Post.fields.title.cascade).toBeUndefined()
    expect(Post.fields.author.cascade).toBeDefined()
    expect(Post.cascades).toHaveProperty('author')
  })
})
