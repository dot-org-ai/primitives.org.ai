import { describe, it, expect } from 'vitest'
import { Graph, validateGraph } from '../src/index.js'
import type { ValidationResult } from '../src/index.js'

describe('Validation Engine', () => {
  describe('validateGraph()', () => {
    describe('valid graphs', () => {
      it('returns no errors for a valid graph', () => {
        const schema = Graph({
          User: {
            name: 'string',
            email: 'string!',
            age: 'int?',
          },
        })
        const result = validateGraph(schema)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('returns no errors for a graph with valid relationships', () => {
        const schema = Graph({
          User: {
            name: 'string',
          },
          Post: {
            title: 'string',
            author: '->User.posts',
          },
        })
        const result = validateGraph(schema)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('returns no errors for a graph with valid directives', () => {
        const schema = Graph({
          User: {
            $partitionBy: ['tenantId'],
            $index: [['email'], ['createdAt']],
            $fts: ['bio'],
            $vector: { field: 'embedding', dimensions: 1536 },
            tenantId: 'string',
            email: 'string',
            createdAt: 'datetime',
            bio: 'string',
            embedding: 'float[]',
          },
        })
        const result = validateGraph(schema)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('returns no errors for an empty graph', () => {
        const schema = Graph({})
        const result = validateGraph(schema)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })

    describe('unknown field types', () => {
      it('catches unknown non-PascalCase field types', () => {
        const schema = Graph({
          User: {
            data: 'unknowntype',
          },
        })
        const result = validateGraph(schema)
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors[0]?.code).toBe('UNKNOWN_TYPE')
        expect(result.errors[0]?.entity).toBe('User')
        expect(result.errors[0]?.field).toBe('data')
      })
    })

    describe('$partitionBy validation', () => {
      it('catches $partitionBy referencing non-existent fields', () => {
        const schema = Graph({
          User: {
            $partitionBy: ['nonExistentField'],
            name: 'string',
          },
        })
        const result = validateGraph(schema)
        expect(result.valid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some((e) => e.code === 'INVALID_PARTITION_FIELD')).toBe(true)
      })
    })

    describe('$index validation', () => {
      it('catches $index referencing non-existent fields', () => {
        const schema = Graph({
          User: {
            $index: [['nonExistent']],
            name: 'string',
          },
        })
        const result = validateGraph(schema)
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.code === 'INVALID_INDEX_FIELD')).toBe(true)
      })
    })

    describe('$fts validation', () => {
      it('catches $fts referencing non-existent fields', () => {
        const schema = Graph({
          Post: {
            $fts: ['nonExistent'],
            title: 'string',
          },
        })
        const result = validateGraph(schema)
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.code === 'INVALID_FTS_FIELD')).toBe(true)
      })
    })

    describe('$vector validation', () => {
      it('catches $vector referencing non-existent field', () => {
        const schema = Graph({
          Document: {
            $vector: { field: 'nonExistent', dimensions: 1536 },
            content: 'string',
          },
        })
        const result = validateGraph(schema)
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.code === 'INVALID_VECTOR_FIELD')).toBe(true)
      })
    })

    describe('relation target validation', () => {
      it('catches relations referencing non-existent entities', () => {
        const schema = Graph({
          Post: {
            author: '->NonExistentEntity',
          },
        })
        const result = validateGraph(schema)
        expect(result.valid).toBe(false)
        expect(result.errors.some((e) => e.code === 'UNKNOWN_RELATION_TARGET')).toBe(true)
      })
    })

    describe('conflicting modifiers', () => {
      it('warns on conflicting ! and ? modifiers', () => {
        const schema = Graph({
          User: {
            email: 'string?!',
          },
        })
        const result = validateGraph(schema)
        // This should be a warning, not necessarily an error
        expect(result.warnings.length).toBeGreaterThan(0)
        expect(result.warnings.some((w) => w.code === 'CONFLICTING_MODIFIERS')).toBe(true)
      })
    })
  })

  describe('ValidationResult type', () => {
    it('has expected structure', () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      }
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })
  })
})
