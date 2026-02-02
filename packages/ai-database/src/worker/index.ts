/**
 * Worker Export - WorkerEntrypoint and Durable Object for Cloudflare Workers
 *
 * Use this export when deploying ai-database as a Cloudflare Worker service.
 *
 * @example
 * ```typescript
 * // worker.ts - the ai-database service
 * import { DatabaseWorker, DatabaseDO } from 'ai-database/worker'
 *
 * export { DatabaseDO }
 * export default DatabaseWorker
 * ```
 *
 * @example
 * ```jsonc
 * // wrangler.jsonc
 * {
 *   "name": "ai-database",
 *   "main": "src/worker.ts",
 *   "durable_objects": {
 *     "bindings": [
 *       { "name": "DATABASE_DO", "class_name": "DatabaseDO" }
 *     ]
 *   }
 * }
 * ```
 *
 * @packageDocumentation
 */

// Re-export worker classes
export {
  DatabaseService,
  DatabaseService as DatabaseWorker,
  DatabaseServiceCore,
  DatabaseDO,
} from '../worker.js'

// Re-export DBProvider adapter for worker services
export {
  createWorkerProvider,
  createBasicWorkerProvider,
  type DatabaseWorkerService,
  type WorkerProviderOptions,
} from './db-provider.js'

// Re-export worker-specific types
export type {
  // Environment types
  Env,
  EnvWithAI,
  // Execution context
  MockExecutionContext,
  MockDurableObjectState,
  MockDurableObjectStorage,
  MockDurableObjectId,
  // SQL storage types
  SqlStorage,
  SqlStorageResult,
  // Database row types
  DataRow,
  RelRow,
  EventRow,
  EmbeddingRow,
  SubscriptionRow,
  MetaRow,
  CountRow,
  // Deserialized row types
  DeserializedDataRow,
  DeserializedRelRow,
  DeserializedEventRow,
  // Event handler type
  DatabaseEventHandler,
  // Action types
  ActionStatus,
  Action,
  Artifact,
  // Request body types
  CreateDataBody,
  UpdateDataBody,
  CreateRelBody,
  CreateEventBody,
  SearchBody,
  SemanticSearchBody,
  HybridSearchBody,
  TraverseFilterBody,
  ReplayEventsBody,
  SubscribeBody,
  EmbeddingsConfigBody,
  EmbeddingsGenerateBody,
  EmbeddingsBatchBody,
  UpdateRelMetadataBody,
  QueryListBody,
  QueryFindBody,
  PipelineConfigBody,
  PipelineTestErrorBody,
  // Result types
  EntityResult,
  SearchResult,
  SemanticSearchResult,
  HybridSearchResult,
} from '../worker.js'

// Re-export default
export { default } from '../worker.js'
