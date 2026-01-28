/**
 * E2E Test Types
 *
 * Shared types for the cross-environment E2E test architecture.
 * These types define the contract between test suites and environment runners.
 *
 * @packageDocumentation
 */

/**
 * RPC Client interface - the common interface all RPC proxies must implement.
 * This allows test suites to be agnostic about transport mechanism.
 */
export interface RPCClient {
  /**
   * Database operations
   */
  database: DatabaseClient

  /**
   * Digital objects operations
   */
  objects: DigitalObjectsClient

  /**
   * AI providers operations
   */
  providers: ProvidersClient

  /**
   * Workflows operations
   */
  workflows: WorkflowsClient
}

/**
 * Database client interface
 */
export interface DatabaseClient {
  get(type: string, id: string): Promise<EntityResult | null>
  list(type: string, options?: ListOptions): Promise<EntityResult[]>
  create(type: string, data: Record<string, unknown>, id?: string): Promise<EntityResult>
  update(type: string, id: string, data: Record<string, unknown>): Promise<EntityResult>
  delete(type: string, id: string): Promise<boolean>
  search(type: string, query: string, options?: SearchOptions): Promise<SearchResult[]>
  semanticSearch(
    type: string,
    query: string,
    options?: SemanticSearchOptions
  ): Promise<SemanticSearchResult[]>
  hybridSearch(
    type: string,
    query: string,
    options?: HybridSearchOptions
  ): Promise<HybridSearchResult[]>
  related(type: string, id: string, relation: string): Promise<EntityResult[]>
  relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void>
  unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void>
  clear(): void
}

/**
 * Digital objects client interface
 */
export interface DigitalObjectsClient {
  create<T>(noun: string, data: T, id?: string): Promise<Thing<T>>
  get<T>(id: string): Promise<Thing<T> | null>
  list<T>(noun: string, options?: ListOptions): Promise<Thing<T>[]>
  update<T>(id: string, data: Partial<T>): Promise<Thing<T>>
  delete(id: string): Promise<boolean>
  relate<T>(subject: string, verb: string, object: string, data?: T): Promise<Action<T>>
  unrelate(subject: string, verb: string, object: string): Promise<boolean>
  related<T>(id: string, verb?: string, direction?: 'in' | 'out'): Promise<Thing<T>[]>
  search<T>(query: string, options?: ListOptions): Promise<Thing<T>[]>
}

/**
 * AI providers client interface
 */
export interface ProvidersClient {
  list(): Promise<ProviderInfo[]>
  get(id: string): Promise<ProviderInfo | null>
  models(providerId?: string): Promise<ModelInfo[]>
  resolve(alias: string): Promise<ModelInfo | null>
}

/**
 * Workflows client interface
 */
export interface WorkflowsClient {
  create(definition: WorkflowDefinition): Promise<WorkflowInstance>
  get(id: string): Promise<WorkflowInstance | null>
  list(options?: ListOptions): Promise<WorkflowInstance[]>
  start(id: string, input?: unknown): Promise<WorkflowRun>
  pause(runId: string): Promise<void>
  resume(runId: string): Promise<void>
  cancel(runId: string): Promise<void>
}

// =============================================================================
// Supporting Types
// =============================================================================

export interface EntityResult {
  $id: string
  $type: string
  [key: string]: unknown
}

export interface SearchResult extends EntityResult {
  $score?: number
}

export interface SemanticSearchResult extends EntityResult {
  $score: number
}

export interface HybridSearchResult extends SemanticSearchResult {
  $rrfScore: number
  $ftsRank: number
  $semanticRank: number
}

export interface ListOptions {
  limit?: number
  offset?: number
  orderBy?: string
  order?: 'asc' | 'desc'
  filter?: Record<string, unknown>
}

export interface SearchOptions extends ListOptions {
  fields?: string[]
}

export interface SemanticSearchOptions extends SearchOptions {
  threshold?: number
}

export interface HybridSearchOptions extends SemanticSearchOptions {
  ftsWeight?: number
  semanticWeight?: number
}

export interface Thing<T = unknown> {
  id: string
  noun: string
  data: T
  createdAt: Date
  updatedAt: Date
}

export interface Action<T = unknown> {
  id: string
  verb: string
  subject?: string
  object?: string
  data?: T
  timestamp: Date
}

export interface ProviderInfo {
  id: string
  name: string
  description?: string
  models: string[]
  capabilities: string[]
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  contextWindow?: number
  maxOutputTokens?: number
  capabilities?: string[]
}

export interface WorkflowDefinition {
  name: string
  description?: string
  steps: WorkflowStep[]
  triggers?: WorkflowTrigger[]
}

export interface WorkflowStep {
  id: string
  name: string
  type: 'action' | 'condition' | 'parallel' | 'loop'
  config?: Record<string, unknown>
}

export interface WorkflowTrigger {
  type: 'event' | 'schedule' | 'manual'
  config?: Record<string, unknown>
}

export interface WorkflowInstance {
  id: string
  name: string
  definition: WorkflowDefinition
  status: 'draft' | 'active' | 'paused' | 'archived'
  createdAt: Date
  updatedAt: Date
}

export interface WorkflowRun {
  id: string
  workflowId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  input?: unknown
  output?: unknown
  error?: string
  startedAt: Date
  completedAt?: Date
}

// =============================================================================
// Test Suite Types
// =============================================================================

/**
 * A single test case definition
 */
export interface TestCase {
  name: string
  fn: () => Promise<void>
  skip?: boolean
  only?: boolean
  timeout?: number
}

/**
 * A test suite - a collection of test cases
 */
export interface TestSuite {
  name: string
  tests: TestCase[]
  beforeAll?: () => Promise<void>
  afterAll?: () => Promise<void>
  beforeEach?: () => Promise<void>
  afterEach?: () => Promise<void>
}

/**
 * Client factory function type - returns an RPC client
 * Different environments provide different implementations
 */
export type ClientFactory = () => RPCClient

/**
 * Test suite factory - creates a test suite given a client factory
 */
export type TestSuiteFactory = (getClient: ClientFactory) => TestSuite

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  /** Environment name */
  name: 'browser' | 'node' | 'worker'

  /** Base URL for deployed workers */
  baseUrl: string

  /** Authentication token (if needed) */
  token?: string

  /** Timeout for operations */
  timeout?: number
}
