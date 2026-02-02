/**
 * Client Export - RPC client for connecting to ai-database workers
 *
 * Use this export when consuming ai-database as an RPC service from
 * another Cloudflare Worker or any HTTP client.
 *
 * @example Using with Cloudflare service bindings
 * ```typescript
 * // consumer-worker.ts
 * import type { DatabaseService } from 'ai-database/worker'
 *
 * interface Env {
 *   AI_DATABASE: Service<DatabaseService>
 * }
 *
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     // Direct RPC via service binding
 *     const service = env.AI_DATABASE.connect('my-namespace')
 *     const post = await service.create('Post', { title: 'Hello' })
 *     return Response.json(post)
 *   }
 * }
 * ```
 *
 * @example Using with HTTP client (rpc.do)
 * ```typescript
 * import { createDatabaseClient } from 'ai-database/client'
 *
 * const client = createDatabaseClient('https://ai-database.workers.dev')
 * const service = client.connect('my-namespace')
 * const post = await service.create('Post', { title: 'Hello World' })
 * ```
 *
 * @packageDocumentation
 */

// Re-export the client factory and default client
export { createDatabaseClient, default } from '../client.js'

// Re-export client-specific types
export type {
  DatabaseClient,
  DatabaseClientOptions,
  DatabaseServiceAPI,
  DatabaseServiceCoreAPI,
  EntityResult,
  SearchResult,
  SemanticSearchResult,
  HybridSearchResult,
  DeserializedEventRow,
  Action,
  Artifact,
} from '../client.js'

// Re-export DB factory for client-side schema definition
export { DB } from '../schema.js'

// Re-export type utilities for entity transformation
export { toExpanded, toFlat } from '../types.js'

// Re-export core types needed for client usage
export type {
  // Thing types (mdxld-based)
  ThingFlat,
  ThingExpanded,
  // Schema types
  DatabaseSchema,
  EntitySchema,
  FieldDefinition,
  PrimitiveType,
  ParsedSchema,
  ParsedEntity,
  ParsedField,
  // Provider types
  DBProvider,
  ListOptions,
  SearchOptions,
  // DB Result type
  DBResult,
  TypedDB,
  EntityOperations,
  // Event types
  DBEvent,
  ActorData,
  // Action types
  DBAction,
  // Artifact types
  DBArtifact,
  // Natural Language Query types
  NLQueryResult,
  NLQueryContext,
  NLQueryPlan,
  // Graph Database Types (for @mdxdb adapters)
  EntityId,
  Thing,
  Relationship,
  // Query Types
  QueryOptions,
  ThingSearchOptions,
  CreateOptions,
  UpdateOptions,
  RelateOptions,
  // Event/Action/Artifact Option Types
  StoreArtifactOptions,
  EventQueryOptions,
  ActionQueryOptions,
  ActionStatus,
  ArtifactType,
  // Client Interfaces
  DBClient,
  DBClientExtended,
  // Semantic Search types
  SemanticSearchOptions,
  HybridSearchOptions,
} from '../schema.js'
