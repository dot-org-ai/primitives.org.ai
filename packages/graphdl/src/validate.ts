/**
 * Graph Validation Engine
 *
 * Validates a parsed graph schema for correctness, checking field types,
 * directive references, relation targets, and modifier consistency.
 *
 * @packageDocumentation
 */

import type { ParsedGraph, ParsedEntity, ValidationResult, ValidationError } from './types.js'
import { PRIMITIVE_TYPES } from './dependency-graph.js'
import { PARAMETRIC_TYPES, GENERIC_TYPES } from './graph.js'

/**
 * Set of all known base types (primitives + parametric + generic)
 */
function isKnownType(type: string): boolean {
  return PRIMITIVE_TYPES.has(type) || PARAMETRIC_TYPES.has(type) || GENERIC_TYPES.has(type)
}

/**
 * Validate a single entity within the graph
 *
 * @param entity - The entity to validate
 * @param graph - The full graph for cross-entity checks
 * @returns Errors and warnings found
 */
export function validateEntity(
  entity: ParsedEntity,
  graph: ParsedGraph
): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  const fieldNames = new Set(entity.fields.keys())

  // Validate each field
  for (const [fieldName, field] of entity.fields) {
    // Check for unknown types (non-PascalCase, non-primitive)
    if (
      !field.isRelation &&
      !isKnownType(field.type) &&
      // PascalCase types are treated as entity references, which is valid
      !(field.type[0] === field.type[0]?.toUpperCase() && /^[A-Z]/.test(field.type))
    ) {
      errors.push({
        code: 'UNKNOWN_TYPE',
        message: `Unknown field type '${field.type}' on ${entity.name}.${fieldName}`,
        entity: entity.name,
        field: fieldName,
      })
    }

    // Check relation targets exist in the graph
    if (field.isRelation && field.relatedType) {
      if (!graph.entities.has(field.relatedType)) {
        errors.push({
          code: 'UNKNOWN_RELATION_TARGET',
          message: `Relation '${entity.name}.${fieldName}' references non-existent entity '${field.relatedType}'`,
          entity: entity.name,
          field: fieldName,
        })
      }
    }

    // Warn on conflicting modifiers (! + ?)
    if (field.isRequired && field.isOptional) {
      warnings.push({
        code: 'CONFLICTING_MODIFIERS',
        message: `Field '${entity.name}.${fieldName}' has both required (!) and optional (?) modifiers`,
        entity: entity.name,
        field: fieldName,
      })
    }
  }

  // Validate directives
  if (entity.directives) {
    // Validate $partitionBy
    const partitionBy = entity.directives['$partitionBy']
    if (Array.isArray(partitionBy)) {
      for (const fieldRef of partitionBy) {
        if (typeof fieldRef === 'string' && !fieldNames.has(fieldRef)) {
          errors.push({
            code: 'INVALID_PARTITION_FIELD',
            message: `$partitionBy references non-existent field '${fieldRef}' in entity '${entity.name}'`,
            entity: entity.name,
            field: fieldRef,
          })
        }
      }
    }

    // Validate $index
    const index = entity.directives['$index']
    if (Array.isArray(index)) {
      for (const indexDef of index) {
        if (Array.isArray(indexDef)) {
          for (const fieldRef of indexDef) {
            if (typeof fieldRef === 'string' && !fieldNames.has(fieldRef)) {
              errors.push({
                code: 'INVALID_INDEX_FIELD',
                message: `$index references non-existent field '${fieldRef}' in entity '${entity.name}'`,
                entity: entity.name,
                field: fieldRef,
              })
            }
          }
        }
      }
    }

    // Validate $fts
    const fts = entity.directives['$fts']
    if (Array.isArray(fts)) {
      for (const fieldRef of fts) {
        if (typeof fieldRef === 'string' && !fieldNames.has(fieldRef)) {
          errors.push({
            code: 'INVALID_FTS_FIELD',
            message: `$fts references non-existent field '${fieldRef}' in entity '${entity.name}'`,
            entity: entity.name,
            field: fieldRef,
          })
        }
      }
    }

    // Validate $vector
    const vector = entity.directives['$vector']
    if (vector && typeof vector === 'object' && 'field' in vector) {
      const vectorField = (vector as { field: string }).field
      if (typeof vectorField === 'string' && !fieldNames.has(vectorField)) {
        errors.push({
          code: 'INVALID_VECTOR_FIELD',
          message: `$vector references non-existent field '${vectorField}' in entity '${entity.name}'`,
          entity: entity.name,
          field: vectorField,
        })
      }
    }
  }

  return { errors, warnings }
}

/**
 * Validate an entire parsed graph schema
 *
 * Checks all entities for:
 * - Unknown field types
 * - Invalid directive field references ($partitionBy, $index, $fts, $vector)
 * - Relation targets referencing non-existent entities
 * - Conflicting modifiers (! + ?)
 *
 * @param graph - The parsed graph to validate
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```ts
 * const schema = Graph({
 *   User: { name: 'string', email: 'string!' },
 *   Post: { title: 'string', author: '->User' },
 * })
 * const result = validateGraph(schema)
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors)
 * }
 * ```
 */
export function validateGraph(graph: ParsedGraph): ValidationResult {
  const allErrors: ValidationError[] = []
  const allWarnings: ValidationError[] = []

  for (const [, entity] of graph.entities) {
    const { errors, warnings } = validateEntity(entity, graph)
    allErrors.push(...errors)
    allWarnings.push(...warnings)
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  }
}
