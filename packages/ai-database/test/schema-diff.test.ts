/**
 * Tests for schema diff engine
 */

import { describe, it, expect } from 'vitest'
import { parseSchema } from '../src/schema/parse.js'
import { diffSchemas, describeDiff } from '../src/schema/diff.js'
import type { DatabaseSchema } from '../src/types.js'

describe('Schema Diff', () => {
  describe('diffSchemas', () => {
    it('detects no changes for identical schemas', () => {
      const schema: DatabaseSchema = {
        User: { name: 'string', email: 'string' },
      }

      const oldParsed = parseSchema(schema)
      const newParsed = parseSchema(schema)

      const diff = diffSchemas(oldParsed, newParsed)

      expect(diff.hasChanges).toBe(false)
      expect(diff.addedEntities).toHaveLength(0)
      expect(diff.removedEntities).toHaveLength(0)
      expect(diff.modifiedEntities).toHaveLength(0)
      expect(diff.summary).toBe('No changes detected')
    })

    it('detects added entities', () => {
      const oldSchema: DatabaseSchema = {
        User: { name: 'string' },
      }
      const newSchema: DatabaseSchema = {
        User: { name: 'string' },
        Post: { title: 'string' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))

      expect(diff.hasChanges).toBe(true)
      expect(diff.addedEntities).toContain('Post')
      expect(diff.addedEntities).toHaveLength(1)
    })

    it('detects removed entities', () => {
      const oldSchema: DatabaseSchema = {
        User: { name: 'string' },
        Post: { title: 'string' },
      }
      const newSchema: DatabaseSchema = {
        User: { name: 'string' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))

      expect(diff.hasChanges).toBe(true)
      expect(diff.removedEntities).toContain('Post')
      expect(diff.removedEntities).toHaveLength(1)
    })

    it('detects added fields', () => {
      const oldSchema: DatabaseSchema = {
        User: { name: 'string' },
      }
      const newSchema: DatabaseSchema = {
        User: { name: 'string', email: 'string' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))

      expect(diff.hasChanges).toBe(true)
      expect(diff.modifiedEntities).toHaveLength(1)

      const userDiff = diff.modifiedEntities[0]!
      expect(userDiff.entityName).toBe('User')
      expect(userDiff.addedFields).toHaveLength(1)
      expect(userDiff.addedFields[0]!.name).toBe('email')
    })

    it('detects removed fields', () => {
      const oldSchema: DatabaseSchema = {
        User: { name: 'string', email: 'string' },
      }
      const newSchema: DatabaseSchema = {
        User: { name: 'string' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))

      expect(diff.hasChanges).toBe(true)
      expect(diff.modifiedEntities).toHaveLength(1)

      const userDiff = diff.modifiedEntities[0]!
      expect(userDiff.removedFields).toHaveLength(1)
      expect(userDiff.removedFields[0]!.name).toBe('email')
    })

    it('detects type changes', () => {
      const oldSchema: DatabaseSchema = {
        User: { age: 'string' },
      }
      const newSchema: DatabaseSchema = {
        User: { age: 'number' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))

      expect(diff.hasChanges).toBe(true)
      expect(diff.modifiedEntities).toHaveLength(1)

      const userDiff = diff.modifiedEntities[0]!
      expect(userDiff.changedFields).toHaveLength(1)
      expect(userDiff.changedFields[0]!.name).toBe('age')
      expect(userDiff.changedFields[0]!.changeType).toBe('type')
      expect(userDiff.changedFields[0]!.description).toContain("from 'string' to 'number'")
    })

    it('detects optional flag changes', () => {
      const oldSchema: DatabaseSchema = {
        User: { email: 'string' },
      }
      const newSchema: DatabaseSchema = {
        User: { email: 'string?' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))

      expect(diff.hasChanges).toBe(true)
      const userDiff = diff.modifiedEntities[0]!
      expect(userDiff.changedFields[0]!.changeType).toBe('optional')
      expect(userDiff.changedFields[0]!.description).toContain('optional')
    })

    it('detects array flag changes', () => {
      const oldSchema: DatabaseSchema = {
        User: { tags: 'string' },
      }
      const newSchema: DatabaseSchema = {
        User: { tags: ['string'] },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))

      expect(diff.hasChanges).toBe(true)
      const userDiff = diff.modifiedEntities[0]!
      expect(userDiff.changedFields[0]!.changeType).toBe('array')
      expect(userDiff.changedFields[0]!.description).toContain('array')
    })

    it('detects relation changes', () => {
      const oldSchema: DatabaseSchema = {
        User: { company: 'string' },
        Company: { name: 'string' },
      }
      const newSchema: DatabaseSchema = {
        User: { company: '->Company' },
        Company: { name: 'string' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))

      expect(diff.hasChanges).toBe(true)
      const userDiff = diff.modifiedEntities.find((e) => e.entityName === 'User')!
      expect(userDiff.changedFields.length).toBeGreaterThan(0)
    })

    it('detects operator changes', () => {
      const oldSchema: DatabaseSchema = {
        Post: { category: '->Category' },
        Category: { name: 'string' },
      }
      const newSchema: DatabaseSchema = {
        Post: { category: '~>Category' },
        Category: { name: 'string' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))

      expect(diff.hasChanges).toBe(true)
      const postDiff = diff.modifiedEntities.find((e) => e.entityName === 'Post')!
      expect(postDiff.changedFields[0]!.changeType).toBe('operator')
    })

    it('detects possible renames', () => {
      const oldSchema: DatabaseSchema = {
        User: { userName: 'string', email: 'string' },
      }
      const newSchema: DatabaseSchema = {
        User: { displayName: 'string', email: 'string' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))

      expect(diff.hasChanges).toBe(true)
      const userDiff = diff.modifiedEntities[0]!
      expect(userDiff.removedFields[0]!.name).toBe('userName')
      expect(userDiff.addedFields[0]!.name).toBe('displayName')
      expect(userDiff.possibleRenames.length).toBeGreaterThan(0)
      expect(userDiff.possibleRenames[0]!.oldName).toBe('userName')
      expect(userDiff.possibleRenames[0]!.newName).toBe('displayName')
      expect(userDiff.possibleRenames[0]!.confidence).toBeGreaterThan(0.5)
    })

    it('generates summary for complex changes', () => {
      const oldSchema: DatabaseSchema = {
        User: { name: 'string' },
        OldEntity: { value: 'number' },
      }
      const newSchema: DatabaseSchema = {
        User: { name: 'string', email: 'string' },
        NewEntity: { value: 'string' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))

      expect(diff.summary).toContain('added')
      expect(diff.summary).toContain('removed')
      expect(diff.summary).toContain('modified')
    })
  })

  describe('describeDiff', () => {
    it('returns message for no changes', () => {
      const schema: DatabaseSchema = {
        User: { name: 'string' },
      }

      const diff = diffSchemas(parseSchema(schema), parseSchema(schema))
      const description = describeDiff(diff)

      expect(description).toBe('No schema changes detected.')
    })

    it('describes added entities', () => {
      const oldSchema: DatabaseSchema = {}
      const newSchema: DatabaseSchema = {
        User: { name: 'string' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))
      const description = describeDiff(diff)

      expect(description).toContain('Added Entities:')
      expect(description).toContain('+ User')
    })

    it('describes removed entities', () => {
      const oldSchema: DatabaseSchema = {
        User: { name: 'string' },
      }
      const newSchema: DatabaseSchema = {}

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))
      const description = describeDiff(diff)

      expect(description).toContain('Removed Entities:')
      expect(description).toContain('- User')
    })

    it('describes field changes', () => {
      const oldSchema: DatabaseSchema = {
        User: { name: 'string' },
      }
      const newSchema: DatabaseSchema = {
        User: { name: 'string', email: 'string?' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))
      const description = describeDiff(diff)

      expect(description).toContain('Modified: User')
      expect(description).toContain('+ email')
    })

    it('describes possible renames', () => {
      const oldSchema: DatabaseSchema = {
        User: { oldName: 'string' },
      }
      const newSchema: DatabaseSchema = {
        User: { newName: 'string' },
      }

      const diff = diffSchemas(parseSchema(oldSchema), parseSchema(newSchema))
      const description = describeDiff(diff)

      expect(description).toContain('Possible renames:')
      expect(description).toContain('oldName -> newName')
    })
  })
})
