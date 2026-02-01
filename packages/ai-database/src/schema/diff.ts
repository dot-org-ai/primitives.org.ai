/**
 * Schema Diff Engine
 *
 * Provides utilities for comparing two parsed schemas and detecting
 * added, removed, and modified entities and fields.
 *
 * @packageDocumentation
 */

import type { ParsedSchema, ParsedEntity, ParsedField } from '../types.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Describes a change to a single field
 */
export interface FieldChange {
  /** Name of the field */
  name: string
  /** Previous field definition (for modifications) */
  oldField?: ParsedField
  /** New field definition (for modifications) */
  newField?: ParsedField
  /** Type of change */
  changeType: 'type' | 'optional' | 'array' | 'relation' | 'operator' | 'multiple'
  /** Human-readable description of the change */
  description: string
}

/**
 * Possible rename detection for a removed+added field pair
 */
export interface PossibleRename {
  /** The old field name that was removed */
  oldName: string
  /** The new field name that was added */
  newName: string
  /** Confidence score (0-1) based on type similarity */
  confidence: number
  /** Why this might be a rename */
  reason: string
}

/**
 * Diff result for a single entity
 */
export interface EntityDiff {
  /** Name of the entity */
  entityName: string
  /** Fields that were added */
  addedFields: ParsedField[]
  /** Fields that were removed */
  removedFields: ParsedField[]
  /** Fields that were modified */
  changedFields: FieldChange[]
  /** Possible field renames (removed+added with similar types) */
  possibleRenames: PossibleRename[]
}

/**
 * Complete diff between two schemas
 */
export interface SchemaDiff {
  /** Entities that were added to the new schema */
  addedEntities: string[]
  /** Entities that were removed from the old schema */
  removedEntities: string[]
  /** Entities that were modified */
  modifiedEntities: EntityDiff[]
  /** Whether there are any changes at all */
  hasChanges: boolean
  /** Summary of changes */
  summary: string
}

// =============================================================================
// Field Comparison
// =============================================================================

/**
 * Compare two fields and determine if they are different
 *
 * @param oldField - The old field definition
 * @param newField - The new field definition
 * @returns List of changes if different, empty array if same
 */
function compareFields(oldField: ParsedField, newField: ParsedField): FieldChange[] {
  const changes: FieldChange[] = []

  // Check type change
  if (oldField.type !== newField.type) {
    changes.push({
      name: oldField.name,
      oldField,
      newField,
      changeType: 'type',
      description: `Type changed from '${oldField.type}' to '${newField.type}'`,
    })
  }

  // Check optional change
  if (oldField.isOptional !== newField.isOptional) {
    changes.push({
      name: oldField.name,
      oldField,
      newField,
      changeType: 'optional',
      description: oldField.isOptional
        ? 'Field changed from optional to required'
        : 'Field changed from required to optional',
    })
  }

  // Check array change
  if (oldField.isArray !== newField.isArray) {
    changes.push({
      name: oldField.name,
      oldField,
      newField,
      changeType: 'array',
      description: oldField.isArray
        ? 'Field changed from array to single value'
        : 'Field changed from single value to array',
    })
  }

  // Check relation change
  if (oldField.isRelation !== newField.isRelation) {
    changes.push({
      name: oldField.name,
      oldField,
      newField,
      changeType: 'relation',
      description: oldField.isRelation
        ? 'Field changed from relation to primitive'
        : 'Field changed from primitive to relation',
    })
  }

  // Check operator change
  if (oldField.operator !== newField.operator) {
    changes.push({
      name: oldField.name,
      oldField,
      newField,
      changeType: 'operator',
      description: `Operator changed from '${oldField.operator || 'none'}' to '${
        newField.operator || 'none'
      }'`,
    })
  }

  return changes
}

/**
 * Detect possible field renames by matching types between removed and added fields
 *
 * @param removedFields - Fields that were removed
 * @param addedFields - Fields that were added
 * @returns Possible rename pairs with confidence scores
 */
function detectPossibleRenames(
  removedFields: ParsedField[],
  addedFields: ParsedField[]
): PossibleRename[] {
  const possibleRenames: PossibleRename[] = []

  for (const removed of removedFields) {
    for (const added of addedFields) {
      // Skip if names are the same (not a rename)
      if (removed.name === added.name) continue

      let confidence = 0
      const reasons: string[] = []

      // Same type = high confidence
      if (removed.type === added.type) {
        confidence += 0.5
        reasons.push('same type')
      }

      // Same isRelation flag
      if (removed.isRelation === added.isRelation) {
        confidence += 0.15
        reasons.push('same relation status')
      }

      // Same isArray flag
      if (removed.isArray === added.isArray) {
        confidence += 0.15
        reasons.push('same array status')
      }

      // Same isOptional flag
      if (removed.isOptional === added.isOptional) {
        confidence += 0.1
        reasons.push('same optional status')
      }

      // Same operator
      if (removed.operator === added.operator) {
        confidence += 0.1
        reasons.push('same operator')
      }

      // Only suggest if confidence is high enough
      if (confidence >= 0.5) {
        possibleRenames.push({
          oldName: removed.name,
          newName: added.name,
          confidence,
          reason: reasons.join(', '),
        })
      }
    }
  }

  // Sort by confidence descending
  possibleRenames.sort((a, b) => b.confidence - a.confidence)

  return possibleRenames
}

// =============================================================================
// Entity Comparison
// =============================================================================

/**
 * Compare two entities and detect differences
 *
 * @param entityName - Name of the entity being compared
 * @param oldEntity - The old entity definition
 * @param newEntity - The new entity definition
 * @returns Entity diff with added, removed, and modified fields
 */
function compareEntities(
  entityName: string,
  oldEntity: ParsedEntity,
  newEntity: ParsedEntity
): EntityDiff {
  const addedFields: ParsedField[] = []
  const removedFields: ParsedField[] = []
  const changedFields: FieldChange[] = []

  // Get field names from both entities
  const oldFieldNames = new Set(oldEntity.fields.keys())
  const newFieldNames = new Set(newEntity.fields.keys())

  // Find added fields
  for (const fieldName of newFieldNames) {
    if (!oldFieldNames.has(fieldName)) {
      addedFields.push(newEntity.fields.get(fieldName)!)
    }
  }

  // Find removed fields
  for (const fieldName of oldFieldNames) {
    if (!newFieldNames.has(fieldName)) {
      removedFields.push(oldEntity.fields.get(fieldName)!)
    }
  }

  // Find modified fields
  for (const fieldName of oldFieldNames) {
    if (newFieldNames.has(fieldName)) {
      const oldField = oldEntity.fields.get(fieldName)!
      const newField = newEntity.fields.get(fieldName)!
      const fieldChanges = compareFields(oldField, newField)

      if (fieldChanges.length > 0) {
        // If multiple changes, consolidate into one entry
        if (fieldChanges.length > 1) {
          changedFields.push({
            name: fieldName,
            oldField,
            newField,
            changeType: 'multiple',
            description: fieldChanges.map((c) => c.description).join('; '),
          })
        } else {
          changedFields.push(fieldChanges[0]!)
        }
      }
    }
  }

  // Detect possible renames
  const possibleRenames = detectPossibleRenames(removedFields, addedFields)

  return {
    entityName,
    addedFields,
    removedFields,
    changedFields,
    possibleRenames,
  }
}

// =============================================================================
// Schema Comparison
// =============================================================================

/**
 * Compare two parsed schemas and detect all differences
 *
 * This function performs a comprehensive comparison between two schemas,
 * identifying:
 * - Added entities (in new schema but not old)
 * - Removed entities (in old schema but not new)
 * - Modified entities (field changes within entities)
 * - Possible field renames (based on type similarity)
 *
 * @param oldParsed - The old parsed schema
 * @param newParsed - The new parsed schema
 * @returns Complete diff with all detected changes
 *
 * @example
 * ```ts
 * const oldSchema = parseSchema({ User: { name: 'string' } })
 * const newSchema = parseSchema({
 *   User: { name: 'string', email: 'string' },
 *   Post: { title: 'string' }
 * })
 *
 * const diff = diffSchemas(oldSchema, newSchema)
 * // diff.addedEntities = ['Post']
 * // diff.modifiedEntities[0].addedFields[0].name = 'email'
 * ```
 */
export function diffSchemas(oldParsed: ParsedSchema, newParsed: ParsedSchema): SchemaDiff {
  const addedEntities: string[] = []
  const removedEntities: string[] = []
  const modifiedEntities: EntityDiff[] = []

  // Get entity names from both schemas
  const oldEntityNames = new Set(oldParsed.entities.keys())
  const newEntityNames = new Set(newParsed.entities.keys())

  // Find added entities
  for (const entityName of newEntityNames) {
    if (!oldEntityNames.has(entityName)) {
      addedEntities.push(entityName)
    }
  }

  // Find removed entities
  for (const entityName of oldEntityNames) {
    if (!newEntityNames.has(entityName)) {
      removedEntities.push(entityName)
    }
  }

  // Find modified entities
  for (const entityName of oldEntityNames) {
    if (newEntityNames.has(entityName)) {
      const oldEntity = oldParsed.entities.get(entityName)!
      const newEntity = newParsed.entities.get(entityName)!
      const entityDiff = compareEntities(entityName, oldEntity, newEntity)

      // Only add to modified list if there are actual changes
      if (
        entityDiff.addedFields.length > 0 ||
        entityDiff.removedFields.length > 0 ||
        entityDiff.changedFields.length > 0
      ) {
        modifiedEntities.push(entityDiff)
      }
    }
  }

  // Determine if there are any changes
  const hasChanges =
    addedEntities.length > 0 || removedEntities.length > 0 || modifiedEntities.length > 0

  // Generate summary
  const summaryParts: string[] = []
  if (addedEntities.length > 0) {
    summaryParts.push(
      `${addedEntities.length} added entit${addedEntities.length === 1 ? 'y' : 'ies'}`
    )
  }
  if (removedEntities.length > 0) {
    summaryParts.push(
      `${removedEntities.length} removed entit${removedEntities.length === 1 ? 'y' : 'ies'}`
    )
  }
  if (modifiedEntities.length > 0) {
    summaryParts.push(
      `${modifiedEntities.length} modified entit${modifiedEntities.length === 1 ? 'y' : 'ies'}`
    )
  }

  const summary = hasChanges ? summaryParts.join(', ') : 'No changes detected'

  return {
    addedEntities,
    removedEntities,
    modifiedEntities,
    hasChanges,
    summary,
  }
}

/**
 * Get a human-readable description of a schema diff
 *
 * @param diff - The schema diff to describe
 * @returns Multi-line string describing all changes
 */
export function describeDiff(diff: SchemaDiff): string {
  if (!diff.hasChanges) {
    return 'No schema changes detected.'
  }

  const lines: string[] = ['Schema Changes:', '']

  if (diff.addedEntities.length > 0) {
    lines.push('Added Entities:')
    for (const entity of diff.addedEntities) {
      lines.push(`  + ${entity}`)
    }
    lines.push('')
  }

  if (diff.removedEntities.length > 0) {
    lines.push('Removed Entities:')
    for (const entity of diff.removedEntities) {
      lines.push(`  - ${entity}`)
    }
    lines.push('')
  }

  for (const entityDiff of diff.modifiedEntities) {
    lines.push(`Modified: ${entityDiff.entityName}`)

    for (const field of entityDiff.addedFields) {
      lines.push(
        `  + ${field.name}: ${field.type}${field.isOptional ? '?' : ''}${field.isArray ? '[]' : ''}`
      )
    }

    for (const field of entityDiff.removedFields) {
      lines.push(
        `  - ${field.name}: ${field.type}${field.isOptional ? '?' : ''}${field.isArray ? '[]' : ''}`
      )
    }

    for (const change of entityDiff.changedFields) {
      lines.push(`  ~ ${change.name}: ${change.description}`)
    }

    if (entityDiff.possibleRenames.length > 0) {
      lines.push('  Possible renames:')
      for (const rename of entityDiff.possibleRenames) {
        lines.push(
          `    ${rename.oldName} -> ${rename.newName} (${Math.round(
            rename.confidence * 100
          )}% confidence: ${rename.reason})`
        )
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}
