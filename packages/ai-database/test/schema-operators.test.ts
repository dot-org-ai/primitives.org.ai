/**
 * Tests for schema operator parsing
 *
 * Tests parsing of forward/reverse reference operators with exact/fuzzy match modes:
 * - `->` Forward Exact: strict foreign key reference
 * - `~>` Forward Fuzzy: AI-matched semantic reference
 * - `<-` Reverse Exact: strict backlink
 * - `<~` Reverse Fuzzy: AI-matched backlink
 *
 * These tests focus on the RED phase for the `->` (forward exact) operator.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { parseSchema, DB, setProvider, createMemoryProvider } from '../src/index.js'
import type { DatabaseSchema } from '../src/schema.js'

describe('Schema Operator Parsing', () => {
  describe('-> (Forward Exact) Operator', () => {
    it('parses simple forward exact reference: { Post: { author: "->Author" } }', () => {
      const schema: DatabaseSchema = {
        Post: {
          author: '->Author',
        },
        Author: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const post = parsed.entities.get('Post')
      const authorField = post!.fields.get('author')

      expect(authorField).toBeDefined()
      expect(authorField!.operator).toBe('->')
      expect(authorField!.direction).toBe('forward')
      expect(authorField!.matchMode).toBe('exact')
      expect(authorField!.relatedType).toBe('Author')
      expect(authorField!.isRelation).toBe(true)
      // No prompt for simple reference
      expect(authorField!.prompt).toBeUndefined()
    })

    it('parses forward exact with embedded prompt: { Startup: { idea: "What is the core idea? ->Idea" } }', () => {
      const schema: DatabaseSchema = {
        Startup: {
          idea: 'What is the core idea? ->Idea',
        },
        Idea: {
          description: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const startup = parsed.entities.get('Startup')
      const ideaField = startup!.fields.get('idea')

      expect(ideaField).toBeDefined()
      expect(ideaField!.operator).toBe('->')
      expect(ideaField!.direction).toBe('forward')
      expect(ideaField!.matchMode).toBe('exact')
      expect(ideaField!.relatedType).toBe('Idea')
      expect(ideaField!.isRelation).toBe(true)
      // Prompt should be extracted (text before the operator)
      expect(ideaField!.prompt).toBe('What is the core idea?')
    })

    it('parses forward exact array: { Startup: { founders: ["Who are the founders? ->Founder"] } }', () => {
      const schema: DatabaseSchema = {
        Startup: {
          founders: ['Who are the founders? ->Founder'],
        },
        Founder: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const startup = parsed.entities.get('Startup')
      const foundersField = startup!.fields.get('founders')

      expect(foundersField).toBeDefined()
      expect(foundersField!.operator).toBe('->')
      expect(foundersField!.direction).toBe('forward')
      expect(foundersField!.matchMode).toBe('exact')
      expect(foundersField!.relatedType).toBe('Founder')
      expect(foundersField!.isRelation).toBe(true)
      expect(foundersField!.isArray).toBe(true)
      // Prompt should be extracted (text before the operator)
      expect(foundersField!.prompt).toBe('Who are the founders?')
    })

    it('preserves existing relation parsing for non-operator syntax', () => {
      // Ensure backward compatibility with existing Author.posts syntax
      const schema: DatabaseSchema = {
        Post: {
          author: 'Author.posts',
        },
        Author: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const post = parsed.entities.get('Post')
      const authorField = post!.fields.get('author')

      expect(authorField).toBeDefined()
      expect(authorField!.relatedType).toBe('Author')
      expect(authorField!.backref).toBe('posts')
      expect(authorField!.isRelation).toBe(true)
      // Legacy syntax should not have operator properties set
      expect(authorField!.operator).toBeUndefined()
    })

    it('handles forward exact with backref syntax: { Post: { author: "->Author.posts" } }', () => {
      const schema: DatabaseSchema = {
        Post: {
          author: '->Author.posts',
        },
        Author: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const post = parsed.entities.get('Post')
      const authorField = post!.fields.get('author')

      expect(authorField).toBeDefined()
      expect(authorField!.operator).toBe('->')
      expect(authorField!.direction).toBe('forward')
      expect(authorField!.matchMode).toBe('exact')
      expect(authorField!.relatedType).toBe('Author')
      expect(authorField!.backref).toBe('posts')
      expect(authorField!.isRelation).toBe(true)
    })

    it('handles forward exact with optional modifier: { Post: { category: "->Category?" } }', () => {
      const schema: DatabaseSchema = {
        Post: {
          category: '->Category?',
        },
        Category: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const post = parsed.entities.get('Post')
      const categoryField = post!.fields.get('category')

      expect(categoryField).toBeDefined()
      expect(categoryField!.operator).toBe('->')
      expect(categoryField!.direction).toBe('forward')
      expect(categoryField!.matchMode).toBe('exact')
      expect(categoryField!.relatedType).toBe('Category')
      expect(categoryField!.isRelation).toBe(true)
      expect(categoryField!.isOptional).toBe(true)
    })
  })

  describe('Field-level threshold parsing', () => {
    it('should parse threshold from ~>Type(0.9) syntax', () => {
      const schema: DatabaseSchema = {
        ICP: {
          occupation: '~>Occupation(0.9)',
        },
        Occupation: {
          title: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const field = parsed.entities.get('ICP')?.fields.get('occupation')

      expect(field?.threshold).toBe(0.9)
      expect(field?.relatedType).toBe('Occupation')
    })

    it('should parse threshold with prompt', () => {
      const schema: DatabaseSchema = {
        ICP: {
          role: 'What role? ~>Role(0.85)',
        },
        Role: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const field = parsed.entities.get('ICP')?.fields.get('role')

      expect(field?.prompt).toBe('What role?')
      expect(field?.threshold).toBe(0.85)
    })

    it('should parse threshold with different decimal precision', () => {
      const schema: DatabaseSchema = {
        Entity: {
          ref1: '~>Target(0.5)',
          ref2: '~>Target(0.75)',
          ref3: '~>Target(0.999)',
        },
        Target: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const entity = parsed.entities.get('Entity')

      expect(entity?.fields.get('ref1')?.threshold).toBe(0.5)
      expect(entity?.fields.get('ref2')?.threshold).toBe(0.75)
      expect(entity?.fields.get('ref3')?.threshold).toBe(0.999)
    })

    it('should handle boundary threshold value of 1.0', () => {
      const schema: DatabaseSchema = {
        Entity: {
          ref: '~>Target(1.0)',  // Exactly 1.0 should be valid
        },
        Target: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const field = parsed.entities.get('Entity')?.fields.get('ref')

      // 1.0 is a valid threshold (edge case)
      expect(field?.threshold).toBe(1.0)
      expect(field?.relatedType).toBe('Target')
    })

    it('should handle boundary threshold value of 0.0', () => {
      const schema: DatabaseSchema = {
        Entity: {
          ref: '~>Target(0.0)',  // Exactly 0.0 should be valid
        },
        Target: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const field = parsed.entities.get('Entity')?.fields.get('ref')

      // 0.0 is a valid threshold (edge case)
      expect(field?.threshold).toBe(0.0)
      expect(field?.relatedType).toBe('Target')
    })

    it('should parse threshold with optional modifier', () => {
      const schema: DatabaseSchema = {
        Entity: {
          ref: '~>Target(0.8)?',
        },
        Target: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const field = parsed.entities.get('Entity')?.fields.get('ref')

      expect(field?.threshold).toBe(0.8)
      expect(field?.isOptional).toBe(true)
      expect(field?.relatedType).toBe('Target')
    })

    it('should parse threshold with array syntax', () => {
      const schema: DatabaseSchema = {
        Entity: {
          refs: ['~>Target(0.7)'],
        },
        Target: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const field = parsed.entities.get('Entity')?.fields.get('refs')

      expect(field?.threshold).toBe(0.7)
      expect(field?.isArray).toBe(true)
      expect(field?.relatedType).toBe('Target')
    })

    it('should default threshold to undefined when not specified', () => {
      const schema: DatabaseSchema = {
        Entity: {
          ref: '~>Target',
        },
        Target: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const field = parsed.entities.get('Entity')?.fields.get('ref')

      expect(field?.threshold).toBeUndefined()
      expect(field?.relatedType).toBe('Target')
    })

    it('should not parse threshold for exact operators', () => {
      const schema: DatabaseSchema = {
        Entity: {
          ref: '->Target(0.9)',  // Threshold doesn't make sense for exact match
        },
        Target: {
          name: 'string',
        },
      }

      const parsed = parseSchema(schema)
      const field = parsed.entities.get('Entity')?.fields.get('ref')

      // Threshold should still be parsed for exact operators
      // (whether to use it is a runtime decision)
      expect(field?.threshold).toBe(0.9)
      expect(field?.matchMode).toBe('exact')
    })
  })

  describe('Field-level threshold runtime behavior', () => {
    beforeEach(() => {
      setProvider(createMemoryProvider())
    })

    it('should use field threshold over entity threshold', async () => {
      const { db } = DB({
        ICP: {
          $fuzzyThreshold: 0.7,
          occupation: '~>Occupation(0.95)',  // Field overrides entity threshold
        },
        Occupation: { title: 'string' },
      })

      // Create an existing occupation
      await db.Occupation.create({ title: 'Engineer' })

      // Create ICP with a hint that's similar but not exact
      const icp = await db.ICP.create({ occupationHint: 'Developer' })

      // With high field-level threshold (0.95), should generate instead of match
      const occ = await icp.occupation
      expect(occ.$generated).toBe(true)  // 0.95 threshold not met
    })

    it('should use entity threshold when field threshold not specified', async () => {
      const { db } = DB({
        ICP: {
          $fuzzyThreshold: 0.3,  // Very low threshold
          occupation: '~>Occupation',  // No field-level threshold
        },
        Occupation: { title: 'string', description: 'string' },
      })

      // Create an existing occupation
      const existingOcc = await db.Occupation.create({
        title: 'Software Engineer',
        description: 'Writes code for a living',
      })

      // Create ICP with a somewhat related hint
      const icp = await db.ICP.create({ occupationHint: 'Programmer' })

      // With low entity threshold (0.3), should match existing
      const occ = await icp.occupation
      expect(occ.$id).toBe(existingOcc.$id)  // Low threshold met, reused existing
    })
  })
})
