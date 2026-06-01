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

// Note: the in-memory reference provider (`createMemoryProvider`) and the
// ai-database `DBProvider` adapter (`createDBProviderAdapter`) are exposed from
// the `digital-objects/testing` subpath — they are a test/dev surface, not the
// production storage (which lives in ai-database per ADR-0003).

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

// RPC Promise pipelining (Cap'n-Proto-style) — the batching primitive the
// runtime/proxy layers (ai-database, ai-workflows) build on.
export { createRpcPromise, isRpcPromise, wrapRpcPromise, BatchCollector } from './rpc-promise.js'
export type { BatchOperation, RpcPromise } from './rpc-promise.js'
