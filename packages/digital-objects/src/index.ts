/**
 * digital-objects - the SVO runtime ontology layer (over @graphdl/core)
 *
 * Core concepts:
 * - **Nouns**: Entity type definitions (singular/plural/schema)
 * - **Verbs**: Action definitions (conjugations, reverse forms, SVO Frame)
 * - **Things**: Entity instances (the actual data)
 * - **Actions**: Events + Relationships + Audit Trail (unified graph edges)
 *
 * Storage is NOT owned here — it lives behind the `DigitalObjectsProvider`
 * port, implemented by `ai-database` (pg+ch + DO-SQLite, ADR-0003). A
 * `MemoryProvider` is provided for tests. See ADR-0012.
 *
 * @packageDocumentation
 */

// Types
export type {
  Noun as NounType,
  NounDefinition,
  Verb,
  VerbDefinition,
  Thing,
  Action,
  ActionStatusType,
  FieldDefinition,
  ExtendedFieldDefinition,
  SimpleFieldType,
  PrimitiveType,
  ListOptions,
  ActionOptions,
  DigitalObjectsProvider,
  Direction,
  // SVO co-design (aip-akqb): Frame, role taxonomy, provenance
  Frame,
  FrameRole,
  VerbSource,
  NounRef,
  ThingRef,
  ActionRef,
  // Token strata (L0 — orthogonal to Frame)
  TokenStratum,
} from './types.js'

// Validation utilities and constants
export { validateDirection, MAX_BATCH_SIZE, ActionStatus } from './types.js'

// Memory Provider
export { MemoryProvider, createMemoryProvider } from './memory-provider.js'

// Linguistic utilities
export {
  deriveNoun,
  deriveVerb,
  pluralize,
  singularize,
  capitalize,
  preserveCase,
  isVowel,
  splitCamelCase,
  toKebabCase,
  shouldDoubleConsonant,
  toPastParticiple,
  toActor,
  toPresent,
  toGerund,
  toResult,
} from './linguistic.js'

// ai-database Adapter
export { createDBProviderAdapter } from './ai-database-adapter.js'
export type {
  DBProvider,
  ListOptions as DBListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
} from './ai-database-adapter.js'

// Errors
export {
  DigitalObjectsError,
  NotFoundError,
  ValidationError,
  ConflictError,
  TokenStratumViolation,
  errorToResponse,
} from './errors.js'

// Token strata sugar factories
export { Frozen, Negotiable, Expression, Composition } from './token-strata.js'
export type { StratumFieldType, StratumOpts } from './token-strata.js'

// Schema Validation
export { validateOnly, validateData } from './schema-validation.js'
export type {
  SchemaValidationError,
  ValidationErrorCode,
  ValidationResult,
  ValidationOptions,
} from './schema-validation.js'

// Ontology() Factory - storage-agnostic SVO vocabulary (graphdl Graph() +
// Frame layering + provider binding). The recommended way to define a
// vocabulary; supersedes the DO()/Noun() instance-proxy factories below.
export { Ontology } from './ontology.js'
export type { OntologyVocabulary, OntologyOptions, VerbSpec } from './ontology.js'

// DO() Factory - Declarative Digital Object Definitions
export {
  DO,
  DigitalObjectDefinition,
  parseFieldType,
  parseField,
  parseEnumValues,
  parseCascade,
  parseFilters,
  isGenerativeString,
} from './do.js'
export type {
  DODefinition,
  DOContext,
  DOStorage,
  DOInstance,
  ParsedDefinition,
  ParsedField,
  CascadeDefinition,
  CascadeOperator,
  CallableDefinition,
  InferSchema,
  FilterCondition,
  GenerativeFunctionDef,
  CodeFunctionDef,
  FunctionDef,
  EventHandler,
  ScheduleHandler,
  MigrateHandler,
} from './do.js'

// Noun() Factory - High-level entity definition API
export { Noun } from './noun.js'
export type {
  PropertyValue,
  NounDefinitionInput,
  NounSchema,
  NounInstance,
  NounEntity,
  VerbConjugation,
  NounProvider,
  PipelineableNounProvider,
  RpcPromise,
  NounOptions,
  BeforeHookHandler,
  AfterHookHandler,
  EntityEvent,
} from './noun-types.js'

// Noun runtime
export {
  setProvider,
  getProvider,
  setProviderFactory,
  clearProviderFactory,
  createScopedProvider,
  MemoryNounProvider,
  setEntityRegistry,
  getEntityRegistry,
  subscribeToEvents,
  clearEventBus,
} from './noun-proxy.js'
export { registerNoun, getNounSchema, getAllNouns, clearRegistry } from './noun-registry.js'
export { parseProperty, parseNounDefinition, isVerbDeclaration } from './noun-parse.js'

// RPC Promise pipelining
export { createRpcPromise, isRpcPromise, wrapRpcPromise, BatchCollector } from './rpc-promise.js'
export type { BatchOperation } from './rpc-promise.js'
export type { BatchContext } from './noun-types.js'
