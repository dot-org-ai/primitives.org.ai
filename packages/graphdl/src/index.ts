/**
 * @graphdl/core - Pure TypeScript DSL for defining entity graphs
 *
 * Provides typesafe schema logic with noun/verb semantics, relationship operators,
 * and MDXLD conventions. This is a Layer 0 (Foundation) package with no internal
 * dependencies.
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Relationship types
  RelationshipOperator,
  RelationshipDirection,
  RelationshipMatchMode,
  ParsedRelationship,

  // Verb types
  Verb,
  VerbReverse,

  // Noun types
  Noun,
  NounProperty,
  NounRelationship,
  PrimitiveType,

  // Graph definition types
  FieldDefinition,
  EntityDefinition,
  GraphInput,

  // Parsed graph types
  ParsedField,
  ParsedEntity,
  ParsedGraph,
  TypeMeta,
  EntityDirectives,

  // Validation types
  ValidationErrorCode,
  ValidationError,
  ValidationResult,
} from './types.js'

// =============================================================================
// Graph DSL
// =============================================================================

export {
  Graph,
  getEntityNames,
  getTypeUris,
  getEntity,
  hasEntity,
  getRelationshipFields,
  getReferencingEntities,
  TYPE_ALIASES,
  PARAMETRIC_TYPES,
  GENERIC_TYPES,
  splitGenericParams,
  parseDefaultValue,
} from './graph.js'

// =============================================================================
// Verbs
// =============================================================================

export { Verbs, conjugate, getVerbFields, isStandardVerb, getStandardVerbs } from './verb.js'
export type { StandardVerbKey } from './verb.js'

// =============================================================================
// Nouns
// =============================================================================

export {
  inferNoun,
  defineNoun,
  createTypeMeta,
  getTypeMeta,
  Type,
  clearTypeMetaCache,
} from './noun.js'
export type { DefineNounOptions } from './noun.js'

// =============================================================================
// Relationship Operators
// =============================================================================

export {
  parseOperator,
  hasOperator,
  getOperator,
  isForwardOperator,
  isBackwardOperator,
  isFuzzyOperator,
  isExactOperator,
  OPERATOR_SEMANTICS,
  OPERATORS,
} from './relationship.js'

// =============================================================================
// Dependency Graph
// =============================================================================

export {
  buildDependencyGraph,
  topologicalSort,
  detectCycles,
  getParallelGroups,
  getAllDependencies,
  hasCycles,
  visualizeGraph,
  CircularDependencyError,
  PRIMITIVE_TYPES,
} from './dependency-graph.js'
export type {
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
  DetectCyclesOptions,
} from './dependency-graph.js'

// =============================================================================
// Linguistic Utilities
// =============================================================================

export {
  pluralize,
  singularize,
  capitalize,
  preserveCase,
  isVowel,
  splitCamelCase,
  toKebabCase,
  toPastParticiple,
  toActor,
  toPresent,
  toGerund,
  toResult,
} from './linguistic.js'

// =============================================================================
// Validation
// =============================================================================

export { validateGraph, validateEntity } from './validate.js'
