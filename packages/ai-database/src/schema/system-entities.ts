/**
 * System Entity Definitions
 *
 * Provides ParsedEntity definitions for built-in system entities:
 * - Noun: represents type definitions
 * - Verb: represents action definitions
 * - Edge: represents relationships between types
 *
 * These are automatically added to every database schema.
 */

import type { ParsedEntity, ParsedField } from '../types.js'

/**
 * System entity names for filtering in schema operations
 */
export const SYSTEM_ENTITY_NAMES = new Set(['Noun', 'Verb', 'Edge'])

/**
 * Check if an entity name is a system entity
 */
export function isSystemEntity(entityName: string): boolean {
  return SYSTEM_ENTITY_NAMES.has(entityName)
}

/**
 * Helper to create a ParsedField with common defaults
 */
function field(name: string, type: string, options: { isOptional?: boolean } = {}): ParsedField {
  return {
    name,
    type,
    isArray: false,
    isOptional: options.isOptional ?? false,
    isRelation: false,
  }
}

/**
 * Create the Noun system entity definition
 * Represents type definitions in the schema
 */
export function createNounEntity(): ParsedEntity {
  return {
    name: 'Noun',
    fields: new Map([
      ['name', field('name', 'string')],
      ['singular', field('singular', 'string')],
      ['plural', field('plural', 'string')],
      ['slug', field('slug', 'string')],
      ['slugPlural', field('slugPlural', 'string')],
      ['description', field('description', 'string', { isOptional: true })],
      ['properties', field('properties', 'json', { isOptional: true })],
      ['relationships', field('relationships', 'json', { isOptional: true })],
      ['actions', field('actions', 'json', { isOptional: true })],
      ['events', field('events', 'json', { isOptional: true })],
      ['metadata', field('metadata', 'json', { isOptional: true })],
    ]),
  }
}

/**
 * Create the Verb system entity definition
 * Represents action definitions with conjugation forms
 */
export function createVerbEntity(): ParsedEntity {
  return {
    name: 'Verb',
    fields: new Map([
      ['action', field('action', 'string')],
      ['actor', field('actor', 'string', { isOptional: true })],
      ['act', field('act', 'string', { isOptional: true })],
      ['activity', field('activity', 'string', { isOptional: true })],
      ['result', field('result', 'string', { isOptional: true })],
      ['reverse', field('reverse', 'json', { isOptional: true })],
      ['inverse', field('inverse', 'string', { isOptional: true })],
      ['description', field('description', 'string', { isOptional: true })],
    ]),
  }
}

/**
 * Create the Edge system entity definition
 * Represents relationships between types
 */
export function createEdgeEntity(): ParsedEntity {
  return {
    name: 'Edge',
    fields: new Map([
      ['from', field('from', 'string')],
      ['name', field('name', 'string')],
      ['to', field('to', 'string')],
      ['backref', field('backref', 'string', { isOptional: true })],
      ['cardinality', field('cardinality', 'string')],
      ['direction', field('direction', 'string')],
      ['matchMode', field('matchMode', 'string', { isOptional: true })],
    ]),
  }
}

/**
 * Add all system entities to a parsed schema
 * This mutates the schema's entities map
 */
export function addSystemEntities(parsedSchema: { entities: Map<string, ParsedEntity> }): void {
  parsedSchema.entities.set('Noun', createNounEntity())
  parsedSchema.entities.set('Verb', createVerbEntity())
  parsedSchema.entities.set('Edge', createEdgeEntity())
}
