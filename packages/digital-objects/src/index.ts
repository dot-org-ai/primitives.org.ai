/**
 * digital-objects - Unified storage primitive for AI primitives
 *
 * Core concepts:
 * - **Nouns**: Entity type definitions (singular/plural/schema)
 * - **Verbs**: Action definitions (conjugations, reverse forms)
 * - **Things**: Entity instances (the actual data)
 * - **Actions**: Events + Relationships + Audit Trail (unified graph edges)
 *
 * Providers:
 * - `MemoryProvider`: In-memory for tests
 * - `NS`: SQLite in Cloudflare Durable Objects (import from 'digital-objects/ns')
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
  PrimitiveType,
  ListOptions,
  ActionOptions,
  DigitalObjectsProvider,
  Direction,
} from './types.js'

// Validation utilities and constants
export { validateDirection, MAX_BATCH_SIZE, ActionStatus } from './types.js'

// Memory Provider
export { MemoryProvider, createMemoryProvider } from './memory-provider.js'

// Linguistic utilities
export { deriveNoun, deriveVerb, pluralize, singularize } from './linguistic.js'

// NS Client (for HTTP access to NS Durable Object)
export { NSClient, createNSClient } from './ns-client.js'
export type { NSClientOptions } from './ns-client.js'

// R2 Persistence (backup/restore to Cloudflare R2)
export {
  createSnapshot,
  restoreSnapshot,
  appendWAL,
  replayWAL,
  compactWAL,
  exportJSONL,
  importJSONL,
  exportToR2,
  importFromR2,
} from './r2-persistence.js'
export type { Snapshot, WALEntry, SnapshotOptions, SnapshotResult } from './r2-persistence.js'

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
  errorToResponse,
} from './errors.js'

// Schema Validation
export { validateOnly, validateData } from './schema-validation.js'
export type {
  SchemaValidationError,
  ValidationErrorCode,
  ValidationResult,
  ValidationOptions,
} from './schema-validation.js'

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
  BeforeHookHandler,
  AfterHookHandler,
} from './noun-types.js'

// Noun runtime
export { setProvider, getProvider, MemoryNounProvider } from './noun-proxy.js'
export { registerNoun, getNounSchema, getAllNouns, clearRegistry } from './noun-registry.js'
export { parseProperty, parseNounDefinition, isVerbDeclaration } from './noun-parse.js'
