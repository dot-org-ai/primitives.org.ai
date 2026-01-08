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

import { describe, it, expect } from 'vitest'
import { parseSchema } from '../src/schema.js'
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
})
