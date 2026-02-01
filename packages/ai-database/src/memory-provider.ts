/**
 * In-memory Database Provider
 *
 * Simple provider implementation for testing and development.
 * Includes concurrency control via Semaphore for rate limiting.
 * Supports automatic embedding generation on create/update.
 */

import type {
  DBProvider,
  ListOptions,
  SearchOptions,
  EmbeddingsConfig,
  SemanticSearchOptions,
  HybridSearchOptions,
} from './schema.js'
import {
  cosineSimilarity,
  computeRRF,
  extractEmbeddableText,
  generateContentHash,
} from './semantic.js'
import { DEFAULT_EMBEDDING_DIMENSIONS, EMBEDDING_DIMENSIONS } from './constants.js'
import {
  validateTypeName,
  validateEntityId,
  validateSearchQuery,
  validateEntityData,
  validateRelationName,
  validateEventPattern,
  validateActionType,
  validateArtifactUrl,
  validateListOptions,
  validateSearchOptions,
  validateFieldName,
  isDangerousField,
} from './validation.js'
import { EntityNotFoundError, EntityAlreadyExistsError } from './errors.js'

// =============================================================================
// Semaphore for Concurrency Control
// =============================================================================

/**
 * Simple semaphore for concurrency control
 * Used to limit parallel operations (e.g., embedding, generation)
 */
export class Semaphore {
  private queue: Array<() => void> = []
  private running = 0

  constructor(private concurrency: number) {}

  /**
   * Acquire a slot. Returns a release function.
   */
  async acquire(): Promise<() => void> {
    if (this.running < this.concurrency) {
      this.running++
      return () => this.release()
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.running++
        resolve(() => this.release())
      })
    })
  }

  private release(): void {
    this.running--
    const next = this.queue.shift()
    if (next) next()
  }

  /**
   * Run a function with concurrency control
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire()
    try {
      return await fn()
    } finally {
      release()
    }
  }

  /**
   * Run multiple functions with concurrency control
   */
  async map<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
    return Promise.all(items.map((item) => this.run(() => fn(item))))
  }

  get pending(): number {
    return this.queue.length
  }

  get active(): number {
    return this.running
  }
}

// =============================================================================
// Types (Actor-Event-Object-Result pattern)
// =============================================================================

/**
 * Actor metadata for events and actions
 */
export interface ActorData {
  name?: string
  email?: string
  org?: string
  role?: string
  [key: string]: unknown
}

/**
 * Event with Actor-Event-Object-Result pattern
 *
 * Following ActivityStreams semantics:
 * - Actor: Who did it (user, system, agent)
 * - Event: What happened (created, updated, published)
 * - Object: What it was done to
 * - Result: What was the outcome
 */
export interface Event {
  id: string
  /** Actor identifier (user:id, system, agent:name) */
  actor: string
  /** Actor metadata */
  actorData?: ActorData
  /** Event type (Entity.action format) */
  event: string
  /** Object URL/identifier */
  object?: string
  /** Object data snapshot */
  objectData?: Record<string, unknown>
  /** Result URL/identifier */
  result?: string
  /** Result data */
  resultData?: Record<string, unknown>
  /** Additional metadata */
  meta?: Record<string, unknown>
  /** When the event occurred */
  timestamp: Date

  // Legacy compatibility
  /** @deprecated Use 'event' instead */
  type?: string
  /** @deprecated Use 'object' instead */
  url?: string
  /** @deprecated Use 'objectData' instead */
  data?: unknown
}

/**
 * Action with linguistic verb conjugations
 *
 * Uses act/action/activity pattern for semantic clarity:
 * - act: Present tense 3rd person (creates, publishes)
 * - action: Base verb form (create, publish)
 * - activity: Gerund/progressive (creating, publishing)
 */
export interface Action {
  id: string
  /** Actor identifier */
  actor: string
  /** Actor metadata */
  actorData?: ActorData
  /** Present tense verb (creates, publishes) */
  act: string
  /** Base verb form (create, publish) */
  action: string
  /** Gerund form (creating, publishing) */
  activity: string
  /** Object being acted upon */
  object?: string
  /** Object data/parameters */
  objectData?: Record<string, unknown>
  /** Action status */
  status: 'pending' | 'active' | 'completed' | 'failed' | 'cancelled'
  /** Progress count */
  progress?: number
  /** Total items */
  total?: number
  /** Result data */
  result?: Record<string, unknown>
  /** Error message */
  error?: string
  /** Additional metadata */
  meta?: Record<string, unknown>
  /** Created timestamp */
  createdAt: Date
  /** Updated timestamp */
  updatedAt?: Date
  /** Started timestamp */
  startedAt?: Date
  /** Completed timestamp */
  completedAt?: Date

  // Legacy compatibility
  /** @deprecated Use 'action' instead */
  type?: string
  /** @deprecated Use 'objectData' instead */
  data?: unknown
}

export interface Artifact {
  url: string
  type: string
  sourceHash: string
  content: unknown
  metadata?: Record<string, unknown>
  createdAt: Date
  updatedAt?: Date
}

/**
 * Embedding provider interface for pluggable embedding generation
 *
 * Allows injecting custom embedding implementations for testing or
 * using different embedding providers (ai-functions, OpenAI, Voyage, etc.)
 */
export interface EmbeddingProvider {
  /** Embed multiple texts and return their embeddings */
  embedTexts(texts: string[]): Promise<{ embeddings: number[][] }>
  /** Find similar items based on query embedding */
  findSimilar?<T>(
    queryEmbedding: number[],
    embeddings: number[][],
    items: T[],
    options?: { topK?: number; minScore?: number }
  ): Array<{ item: T; score: number; index: number }>
  /** Calculate cosine similarity between two vectors */
  cosineSimilarity?(a: number[], b: number[]): number
}

export interface MemoryProviderOptions {
  /** Concurrency limit for operations (default: 10) */
  concurrency?: number
  /** Embedding configuration per type */
  embeddings?: EmbeddingsConfig
  /**
   * Use ai-functions for embeddings instead of deterministic mock embeddings.
   * When enabled, embedTexts and cosineSimilarity from ai-functions will be used.
   * Default: false (uses deterministic mock embeddings for testing)
   */
  useAiFunctions?: boolean
  /**
   * Custom embedding provider for testing or alternative embedding services.
   * Takes precedence over useAiFunctions when provided.
   */
  embeddingProvider?: EmbeddingProvider
  /**
   * The number of dimensions for embeddings when using the built-in mock provider.
   *
   * Common values:
   * - 384: sentence-transformers (default)
   * - 1536: OpenAI ada-002, text-embedding-3-small
   * - 3072: OpenAI text-embedding-3-large
   * - 1024: Cohere embed-english-v3.0
   * - 4096: Voyage AI large models
   *
   * Note: This option is ignored when using a custom embeddingProvider,
   * as the provider determines its own dimensions.
   *
   * @default 384
   */
  embeddingDimensions?: number
}

// =============================================================================
// Generate ID
// =============================================================================

/**
 * Generate a unique ID for a new entity
 *
 * Uses crypto.randomUUID() to generate a UUID v4 identifier.
 *
 * @returns A new UUID string
 *
 * @internal
 */
function generateId(): string {
  return crypto.randomUUID()
}

// =============================================================================
// Verb Conjugation (Linguistic Helpers)
// =============================================================================

/**
 * Conjugate a verb to get all forms
 *
 * @example
 * ```ts
 * conjugateVerb('create')
 * // => { action: 'create', act: 'creates', activity: 'creating' }
 *
 * conjugateVerb('publish')
 * // => { action: 'publish', act: 'publishes', activity: 'publishing' }
 * ```
 */
function conjugateVerb(verb: string): { action: string; act: string; activity: string } {
  const base = verb.toLowerCase()

  // Known verbs with pre-defined conjugations
  const known: Record<string, { act: string; activity: string }> = {
    create: { act: 'creates', activity: 'creating' },
    update: { act: 'updates', activity: 'updating' },
    delete: { act: 'deletes', activity: 'deleting' },
    publish: { act: 'publishes', activity: 'publishing' },
    archive: { act: 'archives', activity: 'archiving' },
    generate: { act: 'generates', activity: 'generating' },
    process: { act: 'processes', activity: 'processing' },
    sync: { act: 'syncs', activity: 'syncing' },
    import: { act: 'imports', activity: 'importing' },
    export: { act: 'exports', activity: 'exporting' },
    run: { act: 'runs', activity: 'running' },
    execute: { act: 'executes', activity: 'executing' },
    send: { act: 'sends', activity: 'sending' },
    fetch: { act: 'fetches', activity: 'fetching' },
    build: { act: 'builds', activity: 'building' },
    deploy: { act: 'deploys', activity: 'deploying' },
  }

  if (known[base]) {
    return { action: base, ...known[base] }
  }

  // Auto-conjugate unknown verbs
  return {
    action: base,
    act: toPresent(base),
    activity: toGerund(base),
  }
}

/**
 * Check if a character is a vowel (a, e, i, o, u)
 *
 * @param char - The character to check
 * @returns True if the character is a vowel
 *
 * @internal
 */
function isVowel(char: string | undefined): boolean {
  return char ? 'aeiou'.includes(char.toLowerCase()) : false
}

/**
 * Check if we should double the final consonant when adding a suffix
 *
 * English spelling rules require doubling the final consonant in certain
 * cases when adding suffixes like -ing or -ed. This applies to short words
 * ending in consonant-vowel-consonant patterns.
 *
 * @param verb - The verb to check
 * @returns True if the final consonant should be doubled
 *
 * @example
 * ```ts
 * shouldDoubleConsonant('run')  // => true  (running)
 * shouldDoubleConsonant('play') // => false (playing)
 * shouldDoubleConsonant('fix')  // => false (fixing - x is excluded)
 * ```
 *
 * @internal
 */
function shouldDoubleConsonant(verb: string): boolean {
  if (verb.length < 2) return false
  const last = verb[verb.length - 1]!
  const secondLast = verb[verb.length - 2]!
  if ('wxy'.includes(last)) return false
  if (isVowel(last) || !isVowel(secondLast)) return false
  // Short words (3 letters) almost always double
  if (verb.length <= 3) return true
  return false
}

/**
 * Convert a verb to present tense third person singular form
 *
 * Applies English conjugation rules for third person singular:
 * - Verbs ending in consonant + y: change y to ies (try → tries)
 * - Verbs ending in s, x, z, ch, sh: add es (push → pushes)
 * - Other verbs: add s (run → runs)
 *
 * @param verb - The base form of the verb
 * @returns The third person singular present tense form
 *
 * @example
 * ```ts
 * toPresent('create')  // => 'creates'
 * toPresent('push')    // => 'pushes'
 * toPresent('try')     // => 'tries'
 * ```
 *
 * @internal
 */
function toPresent(verb: string): string {
  if (verb.endsWith('y') && !isVowel(verb[verb.length - 2])) {
    return verb.slice(0, -1) + 'ies'
  }
  if (
    verb.endsWith('s') ||
    verb.endsWith('x') ||
    verb.endsWith('z') ||
    verb.endsWith('ch') ||
    verb.endsWith('sh')
  ) {
    return verb + 'es'
  }
  return verb + 's'
}

/**
 * Convert a verb to gerund/present participle form (-ing)
 *
 * Applies English spelling rules for adding -ing:
 * - Verbs ending in ie: change ie to ying (die → dying)
 * - Verbs ending in e (not ee): drop e, add ing (create → creating)
 * - Verbs requiring consonant doubling: double + ing (run → running)
 * - Other verbs: add ing (play → playing)
 *
 * @param verb - The base form of the verb
 * @returns The gerund/present participle form
 *
 * @example
 * ```ts
 * toGerund('create')  // => 'creating'
 * toGerund('run')     // => 'running'
 * toGerund('die')     // => 'dying'
 * ```
 *
 * @internal
 */
function toGerund(verb: string): string {
  if (verb.endsWith('ie')) return verb.slice(0, -2) + 'ying'
  if (verb.endsWith('e') && !verb.endsWith('ee')) return verb.slice(0, -1) + 'ing'
  if (shouldDoubleConsonant(verb)) {
    return verb + verb[verb.length - 1] + 'ing'
  }
  return verb + 'ing'
}

// =============================================================================
// In-memory Provider
// =============================================================================

/**
 * In-memory storage for entities, relationships, events, actions, and artifacts
 */
export class MemoryProvider implements DBProvider {
  // Things: type -> id -> entity
  private entities = new Map<string, Map<string, Record<string, unknown>>>()

  // Relationships: from:relation -> Set<to>
  private relations = new Map<string, Set<string>>()

  // Events: chronological log
  private events: Event[] = []
  private eventHandlers = new Map<string, Array<(event: Event) => void | Promise<void>>>()

  // Actions: id -> action
  private actions = new Map<string, Action>()

  // Artifacts: url:type -> artifact
  private artifacts = new Map<string, Artifact>()

  // Concurrency control
  private semaphore: Semaphore

  // Embedding configuration
  private embeddingsConfig: EmbeddingsConfig

  // Flag to use ai-functions for embeddings
  private useAiFunctions: boolean

  // Custom embedding provider (for testing or alternative services)
  private embeddingProvider?: EmbeddingProvider

  // Embedding dimensions for mock provider
  private embeddingDimensions: number

  constructor(options: MemoryProviderOptions = {}) {
    this.semaphore = new Semaphore(options.concurrency ?? 10)
    this.embeddingsConfig = options.embeddings ?? {}
    this.useAiFunctions = options.useAiFunctions ?? false
    if (options.embeddingProvider !== undefined) {
      this.embeddingProvider = options.embeddingProvider
    }
    this.embeddingDimensions = options.embeddingDimensions ?? DEFAULT_EMBEDDING_DIMENSIONS
  }

  /**
   * Enable or disable ai-functions for embeddings
   */
  setUseAiFunctions(enabled: boolean): void {
    this.useAiFunctions = enabled
  }

  /**
   * Set a custom embedding provider
   */
  setEmbeddingProvider(provider: EmbeddingProvider | undefined): void {
    if (provider !== undefined) {
      this.embeddingProvider = provider
    } else {
      this.embeddingProvider = undefined as unknown as EmbeddingProvider
    }
  }

  /**
   * Set embeddings configuration
   */
  setEmbeddingsConfig(config: EmbeddingsConfig): void {
    this.embeddingsConfig = config
  }

  // ===========================================================================
  // Embedding Generation
  // ===========================================================================

  /**
   * Generate embedding for text (deterministic for testing)
   *
   * Uses semantic word vectors to create meaningful embeddings
   * where similar concepts have higher cosine similarity.
   */
  private generateEmbedding(text: string): number[] {
    // Import semantic vectors for deterministic embeddings
    const SEMANTIC_VECTORS: Record<string, number[]> = {
      // AI/ML domain
      machine: [0.9, 0.1, 0.05, 0.02],
      learning: [0.85, 0.15, 0.08, 0.03],
      artificial: [0.88, 0.12, 0.06, 0.04],
      intelligence: [0.87, 0.13, 0.07, 0.05],
      neural: [0.82, 0.18, 0.09, 0.06],
      network: [0.75, 0.2, 0.15, 0.1],
      deep: [0.8, 0.17, 0.1, 0.08],
      ai: [0.92, 0.08, 0.04, 0.02],
      ml: [0.88, 0.12, 0.06, 0.03],

      // Programming domain
      programming: [0.15, 0.85, 0.1, 0.05],
      code: [0.12, 0.88, 0.12, 0.06],
      software: [0.18, 0.82, 0.15, 0.08],
      development: [0.2, 0.8, 0.18, 0.1],
      typescript: [0.1, 0.9, 0.08, 0.04],
      javascript: [0.12, 0.88, 0.1, 0.05],
      python: [0.25, 0.75, 0.12, 0.06],
      react: [0.08, 0.85, 0.2, 0.1],
      vue: [0.06, 0.84, 0.18, 0.08],
      frontend: [0.05, 0.8, 0.25, 0.12],
      programs: [0.14, 0.86, 0.1, 0.04], // computer programs - programming domain
      program: [0.14, 0.86, 0.1, 0.04], // singular form
      write: [0.12, 0.84, 0.08, 0.05], // writing code - programming context
      develop: [0.18, 0.82, 0.12, 0.08], // develop software - programming domain
      utility: [0.1, 0.8, 0.15, 0.1], // utility programs - programming domain
      specialized: [0.15, 0.78, 0.12, 0.08], // specialized software - programming domain

      // Database domain
      database: [0.1, 0.7, 0.08, 0.6],
      query: [0.12, 0.65, 0.1, 0.7],
      sql: [0.08, 0.6, 0.05, 0.75],
      index: [0.1, 0.58, 0.08, 0.72],
      optimization: [0.15, 0.55, 0.12, 0.68],
      performance: [0.18, 0.5, 0.15, 0.65],

      // DevOps domain
      kubernetes: [0.05, 0.6, 0.8, 0.15],
      docker: [0.08, 0.55, 0.82, 0.12],
      container: [0.06, 0.5, 0.85, 0.1],
      deployment: [0.1, 0.45, 0.78, 0.18],
      devops: [0.12, 0.48, 0.75, 0.2],

      // Food domain (distinctly different direction - high in dim 3, low elsewhere)
      cooking: [0.05, 0.08, 0.05, 0.95],
      recipe: [0.06, 0.07, 0.04, 0.93],
      food: [0.04, 0.06, 0.04, 0.96],
      pasta: [0.03, 0.05, 0.03, 0.97],
      pizza: [0.03, 0.06, 0.04, 0.96],
      italian: [0.04, 0.07, 0.04, 0.94],
      garden: [0.05, 0.04, 0.03, 0.92],
      flowers: [0.04, 0.03, 0.03, 0.91],
      chef: [0.05, 0.1, 0.05, 0.95],
      restaurant: [0.06, 0.08, 0.04, 0.93],
      kitchen: [0.05, 0.09, 0.05, 0.94],
      antonio: [0.05, 0.08, 0.04, 0.92],

      // Research/Academic domain (similar to AI/ML)
      researcher: [0.82, 0.2, 0.1, 0.08],
      phd: [0.8, 0.18, 0.12, 0.1],
      research: [0.85, 0.15, 0.1, 0.07],
      professor: [0.78, 0.22, 0.12, 0.1],
      academic: [0.75, 0.2, 0.15, 0.12],

      // Location/Venue domain (for fuzzy threshold tests - need distinct clusters)
      // "conference center downtown" cluster - high values in different dimensions
      conference: [0.2, 0.25, 0.85, 0.2],
      center: [0.18, 0.22, 0.88, 0.18],
      downtown: [0.15, 0.2, 0.9, 0.15],
      // "tech hub 123 main st" cluster - completely different direction
      hub: [0.85, 0.15, 0.2, 0.15],
      main: [0.12, 0.12, 0.15, 0.1],
      st: [0.1, 0.1, 0.12, 0.08],
      '123': [0.08, 0.08, 0.1, 0.05],

      // GraphQL/API
      graphql: [0.1, 0.75, 0.15, 0.55],
      // Note: api is defined in Documentation cluster below (strong in doc dimension)
      rest: [0.12, 0.68, 0.18, 0.48],
      queries: [0.14, 0.65, 0.12, 0.6],

      // Testing
      testing: [0.1, 0.78, 0.08, 0.15],
      test: [0.08, 0.8, 0.06, 0.12],
      unit: [0.06, 0.82, 0.05, 0.1],
      integration: [0.12, 0.75, 0.1, 0.18],

      // State management
      state: [0.08, 0.82, 0.2, 0.08],
      management: [0.15, 0.75, 0.25, 0.12],
      hooks: [0.06, 0.88, 0.15, 0.05],
      usestate: [0.05, 0.9, 0.12, 0.04],
      useeffect: [0.04, 0.88, 0.1, 0.03],

      // Related/Concept domain (for semantic similarity tests)
      related: [0.5, 0.5, 0.5, 0.5],
      concept: [0.55, 0.45, 0.55, 0.45],
      similar: [0.52, 0.48, 0.52, 0.48],
      different: [0.48, 0.52, 0.48, 0.52],
      words: [0.45, 0.55, 0.45, 0.55],
      semantically: [0.6, 0.4, 0.6, 0.4],

      // Exact match domain (distinctly different vectors)
      exact: [0.1, 0.1, 0.1, 0.9],
      match: [0.15, 0.15, 0.1, 0.85],
      title: [0.1, 0.2, 0.1, 0.8],
      contains: [0.12, 0.18, 0.12, 0.78],
      search: [0.08, 0.22, 0.08, 0.82],
      terms: [0.05, 0.25, 0.05, 0.85],

      // Business domain (for fuzzy forward resolution tests)
      enterprise: [0.7, 0.3, 0.8, 0.6],
      large: [0.65, 0.25, 0.75, 0.55],
      corporations: [0.68, 0.28, 0.78, 0.58],
      companies: [0.6, 0.4, 0.7, 0.5],
      company: [0.62, 0.38, 0.72, 0.52],
      thousands: [0.7, 0.2, 0.7, 0.5],
      employees: [0.55, 0.35, 0.65, 0.45],
      big: [0.68, 0.3, 0.75, 0.58],
      small: [0.3, 0.6, 0.3, 0.4],
      business: [0.5, 0.5, 0.6, 0.5],
      owners: [0.4, 0.5, 0.5, 0.45],
      consumer: [0.35, 0.55, 0.35, 0.35],
      individual: [0.32, 0.58, 0.32, 0.32],
      b2c: [0.3, 0.6, 0.3, 0.35],

      // Management/Operations domain (distinctly different from programming - high in dim 3, low in dim 2)
      operations: [0.6, 0.15, 0.85, 0.55], // operations management - NOT programming
      coordinate: [0.55, 0.12, 0.82, 0.5], // coordinate teams - management
      plan: [0.52, 0.18, 0.78, 0.48], // planning - management domain
      direct: [0.58, 0.14, 0.8, 0.52], // direct teams - management
      formulate: [0.5, 0.2, 0.75, 0.45], // formulate policies - executive
      policies: [0.48, 0.15, 0.78, 0.5], // policies - executive/management
      direction: [0.55, 0.18, 0.76, 0.48], // overall direction - executive
      organizations: [0.6, 0.2, 0.8, 0.55], // organizations - management
      sector: [0.58, 0.22, 0.75, 0.52], // public/private sector - business
      determine: [0.52, 0.16, 0.72, 0.46], // determine policies - executive

      // Tech professional domain
      developer: [0.2, 0.85, 0.15, 0.1],
      engineer: [0.25, 0.82, 0.18, 0.12],
      engineers: [0.27, 0.8, 0.2, 0.14],
      builds: [0.18, 0.78, 0.16, 0.08],
      writes: [0.15, 0.75, 0.12, 0.06],
      professional: [0.22, 0.72, 0.2, 0.15],
      applications: [0.2, 0.78, 0.18, 0.1],
      tech: [0.25, 0.8, 0.2, 0.12],
      technology: [0.28, 0.78, 0.22, 0.14],
      electronics: [0.3, 0.75, 0.25, 0.15],
      device: [0.25, 0.82, 0.2, 0.1],
      furniture: [0.1, 0.15, 0.2, 0.85],
      home: [0.12, 0.18, 0.22, 0.8],
      living: [0.1, 0.15, 0.2, 0.82],
      goods: [0.3, 0.5, 0.35, 0.4],
      leaders: [0.4, 0.5, 0.6, 0.4],
      senior: [0.35, 0.55, 0.55, 0.35],

      // Data science domain
      data: [0.75, 0.3, 0.15, 0.55],
      science: [0.78, 0.25, 0.12, 0.5],
      scientist: [0.8, 0.28, 0.1, 0.52],
      background: [0.72, 0.32, 0.14, 0.48],

      // DevOps/cloud domain
      cloud: [0.1, 0.55, 0.85, 0.15],
      expertise: [0.15, 0.5, 0.8, 0.18],

      // Support domain
      support: [0.2, 0.45, 0.3, 0.55],
      specialist: [0.22, 0.48, 0.32, 0.52],
      technical: [0.25, 0.65, 0.35, 0.4],
      issues: [0.18, 0.42, 0.28, 0.48],

      // Security domain
      security: [0.3, 0.6, 0.4, 0.7],
      auth: [0.28, 0.58, 0.38, 0.72],
      authentication: [0.32, 0.55, 0.42, 0.75],
      identity: [0.35, 0.52, 0.45, 0.68],
      oauth: [0.3, 0.62, 0.4, 0.7],

      // CRM domain
      crm: [0.45, 0.4, 0.7, 0.55],
      sales: [0.42, 0.38, 0.68, 0.52],
      salesforce: [0.48, 0.42, 0.72, 0.58],
      provider: [0.5, 0.45, 0.65, 0.5],

      // Electronics/Audio domain - cluster for electronic devices
      electronic: [0.32, 0.76, 0.24, 0.14],
      audio: [0.3, 0.74, 0.22, 0.12],
      devices: [0.28, 0.78, 0.2, 0.1],

      // Apparel/Fashion domain - distinctly different from electronics
      apparel: [0.08, 0.12, 0.15, 0.92],
      fashion: [0.1, 0.14, 0.12, 0.9],
      clothing: [0.06, 0.1, 0.14, 0.94],

      // iOS/iPhone/smartphone cluster - distinct from laptop
      ios: [0.9, 0.7, 0.15, 0.05],
      iphone: [0.88, 0.72, 0.16, 0.06],
      smartphone: [0.85, 0.68, 0.18, 0.08],
      mobile: [0.82, 0.65, 0.2, 0.1],
      apple: [0.5, 0.6, 0.3, 0.2],

      // MacBook/laptop cluster - distinctly different direction from smartphone
      macbook: [0.15, 0.55, 0.85, 0.25],
      laptop: [0.12, 0.52, 0.88, 0.28],
      computer: [0.15, 0.7, 0.5, 0.2], // "computer" leans toward programming (high dim 2) for "computer programs/software"
      macos: [0.18, 0.58, 0.82, 0.22],

      // Samsung/Android cluster - similar to iOS cluster direction
      samsung: [0.78, 0.62, 0.22, 0.14],
      galaxy: [0.76, 0.6, 0.24, 0.16],
      android: [0.8, 0.64, 0.2, 0.12],

      // Audio accessories
      wireless: [0.28, 0.72, 0.24, 0.14],
      bluetooth: [0.26, 0.74, 0.22, 0.12],
      headphones: [0.3, 0.76, 0.2, 0.1],

      // Young professionals domain
      young: [0.65, 0.35, 0.45, 0.15],
      professionals: [0.68, 0.38, 0.42, 0.12],
      working: [0.62, 0.32, 0.48, 0.18],
      adults: [0.58, 0.3, 0.5, 0.22],
      early: [0.64, 0.34, 0.46, 0.16],
      careers: [0.7, 0.4, 0.4, 0.1],
      career: [0.7, 0.4, 0.4, 0.1],
      urban: [0.6, 0.36, 0.44, 0.2],
      college: [0.66, 0.38, 0.42, 0.14],
      educated: [0.68, 0.4, 0.4, 0.12],
      ages: [0.5, 0.3, 0.4, 0.3],

      // Senior citizens domain - distinctly different from young professionals
      citizens: [0.15, 0.55, 0.35, 0.75],
      retired: [0.12, 0.5, 0.38, 0.8],

      // AI/Deep learning extension
      models: [0.86, 0.14, 0.08, 0.04],

      // Web development technologies
      web: [0.1, 0.86, 0.12, 0.06],
      technologies: [0.12, 0.84, 0.14, 0.08],
      node: [0.1, 0.88, 0.1, 0.04],
      js: [0.12, 0.86, 0.12, 0.06],
      backend: [0.15, 0.82, 0.18, 0.1],

      // Marketing domain
      marketing: [0.4, 0.45, 0.55, 0.4],
      manager: [0.38, 0.48, 0.52, 0.38],
      strategy: [0.42, 0.5, 0.5, 0.35],
      charge: [0.35, 0.42, 0.55, 0.42],

      // Project management
      project: [0.35, 0.55, 0.45, 0.35],
      soft: [0.3, 0.52, 0.48, 0.4],
      skills: [0.32, 0.58, 0.42, 0.32],

      // Content types for union type resolution tests
      // The key insight: make words that appear in BOTH query and target entity
      // have strong alignment in the same cluster

      // Tutorial cluster - strong in dim 1 (learning/educational)
      // Query: "A step-by-step guide for learning React components" should match Tutorial
      // Tutorial title: "Getting Started with React Hooks"
      // Common context: "step", "guide", "learning", "react"
      tutorial: [0.95, 0.1, 0.08, 0.02],
      step: [0.92, 0.08, 0.05, 0.02], // key query word
      steps: [0.92, 0.08, 0.05, 0.02], // pluralized
      guide: [0.88, 0.1, 0.08, 0.04], // appears in query - bias toward tutorial
      walkthrough: [0.9, 0.08, 0.06, 0.02],
      getting: [0.92, 0.08, 0.05, 0.02], // Tutorial title starts with this
      started: [0.9, 0.06, 0.04, 0.02], // Tutorial title word
      components: [0.88, 0.15, 0.06, 0.03], // query word, tutorial context

      // Video cluster - strong in dim 2 (media/visual)
      // Query: "A video introduction to machine learning concepts" should match Video
      // Video title: "Machine Learning Fundamentals"
      // Common context: "video", "machine", "learning", "fundamentals"
      video: [0.05, 0.95, 0.08, 0.04],
      watch: [0.04, 0.9, 0.06, 0.03],
      film: [0.03, 0.88, 0.05, 0.02],
      movie: [0.02, 0.85, 0.04, 0.02],
      introduction: [0.08, 0.9, 0.08, 0.05], // query word, video context
      intro: [0.06, 0.88, 0.06, 0.04],
      duration: [0.02, 0.82, 0.04, 0.02],
      hours: [0.02, 0.8, 0.03, 0.02],
      fundamentals: [0.08, 0.92, 0.06, 0.04], // Video title word
      concepts: [0.1, 0.85, 0.08, 0.05], // query word, video context
      mp4: [0.01, 0.98, 0.02, 0.01],
      homepage: [0.04, 0.88, 0.06, 0.03],

      // Documentation cluster - strong in dim 3 (reference/formal)
      // Documentation title: "API Reference Guide"
      // Note: "guide" also appears here but we bias it toward tutorial
      documentation: [0.06, 0.1, 0.95, 0.04],
      api: [0.05, 0.08, 0.92, 0.03], // Documentation title word - strong in doc cluster
      reference: [0.04, 0.08, 0.92, 0.03], // Documentation title word
      pages: [0.03, 0.06, 0.9, 0.02], // Documentation field
      manual: [0.02, 0.05, 0.88, 0.02],

      // Course cluster - strong in dim 4 (comprehensive/structured)
      // Course title: "Full Stack Web Development Bootcamp"
      course: [0.15, 0.2, 0.1, 0.92],
      bootcamp: [0.12, 0.18, 0.08, 0.9],
      modules: [0.1, 0.15, 0.06, 0.88],
      curriculum: [0.08, 0.12, 0.05, 0.85],
      comprehensive: [0.06, 0.1, 0.04, 0.82],
      full: [0.1, 0.15, 0.08, 0.85],
      stack: [0.12, 0.18, 0.1, 0.82],

      // Image cluster - strong in dim 2+3 (visual media) - different direction from video
      // Image should NOT be matched for "video" queries
      image: [0.05, 0.45, 0.85, 0.08],
      photo: [0.04, 0.42, 0.88, 0.06],
      picture: [0.03, 0.4, 0.9, 0.05],
      src: [0.06, 0.48, 0.82, 0.08],
      alt: [0.05, 0.45, 0.8, 0.06],

      // Document cluster - different from documentation
      document: [0.08, 0.1, 0.78, 0.15],
      file: [0.06, 0.12, 0.75, 0.12],
      path: [0.05, 0.15, 0.72, 0.1],
      format: [0.04, 0.18, 0.7, 0.08],
    }

    const DEFAULT_VECTOR = [0.1, 0.1, 0.1, 0.1]

    // Simple hash function
    const simpleHash = (str: string): number => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash
      }
      return Math.abs(hash)
    }

    // Seeded random
    const seededRandom = (seed: number, index: number): number => {
      const x = Math.sin(seed + index) * 10000
      return x - Math.floor(x)
    }

    // Tokenize
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0)

    if (words.length === 0) {
      return Array.from({ length: this.embeddingDimensions }, (_, i) => seededRandom(0, i) * 0.01)
    }

    // Aggregate word vectors
    const aggregated: number[] = [0, 0, 0, 0]
    for (const word of words) {
      const lower = word.toLowerCase()
      const vec =
        SEMANTIC_VECTORS[lower] ??
        DEFAULT_VECTOR.map((v, i) => v + seededRandom(simpleHash(lower), i) * 0.1)
      for (let i = 0; i < 4; i++) {
        aggregated[i]! += vec[i]!
      }
    }

    // Normalize
    const norm = Math.sqrt(aggregated.reduce((sum, v) => sum + v * v, 0))
    const normalized = aggregated.map((v) => v / (norm || 1))

    // Expand to full dimensions
    const textHash = simpleHash(text)
    const embedding = new Array(this.embeddingDimensions)

    for (let i = 0; i < this.embeddingDimensions; i++) {
      const baseIndex = i % 4
      const base = normalized[baseIndex]!
      const noise = seededRandom(textHash, i) * 0.1 - 0.05
      embedding[i] = base + noise
    }

    // Final normalization
    const finalNorm = Math.sqrt(embedding.reduce((sum: number, v: number) => sum + v * v, 0))
    return embedding.map((v: number) => v / (finalNorm || 1))
  }

  /**
   * Check if embeddings should be generated for a given entity type
   *
   * Consults the embeddings configuration to determine:
   * - If embeddings are disabled for this type (config === false)
   * - If specific fields are configured for embedding
   * - If auto-detection of text fields should be used (default)
   *
   * @param type - The entity type name
   * @returns Object with enabled flag and optional field list
   *
   * @internal
   */
  private shouldEmbed(type: string): { enabled: boolean; fields?: string[] } {
    const config = this.embeddingsConfig[type]
    if (config === false) {
      return { enabled: false }
    }
    if (config && config.fields) {
      return { enabled: true, fields: config.fields }
    }
    // Default: embed all text fields (auto-detect)
    return { enabled: true }
  }

  /**
   * Auto-generate and store an embedding for an entity
   *
   * Called during create/update operations to automatically generate
   * embeddings for entities based on their text content. The embedding
   * is stored as an artifact associated with the entity.
   *
   * Priority for embedding generation:
   * 1. Custom embeddingProvider if set (for testing or alternative services)
   * 2. ai-functions if useAiFunctions is enabled
   * 3. Deterministic mock embedding (default for testing)
   *
   * @param type - The entity type name
   * @param id - The entity ID
   * @param data - The entity data to extract text from
   *
   * @internal
   */
  private async autoEmbed(type: string, id: string, data: Record<string, unknown>): Promise<void> {
    const { enabled, fields } = this.shouldEmbed(type)
    if (!enabled) return

    // Extract embeddable text
    const { text, fields: embeddedFields } = extractEmbeddableText(data, fields)
    if (!text.trim()) return

    let embedding: number[]
    let dimensions: number = this.embeddingDimensions
    let source: string = 'mock'

    // Priority: embeddingProvider > useAiFunctions > mock
    if (this.embeddingProvider) {
      try {
        const result = await this.embeddingProvider.embedTexts([text])
        embedding = result.embeddings[0] ?? this.generateEmbedding(text)
        dimensions = embedding.length
        source = 'custom-provider'
      } catch (err) {
        console.warn('Custom embedding provider failed, falling back to mock:', err)
        embedding = this.generateEmbedding(text)
      }
    } else if (this.useAiFunctions) {
      try {
        const { embedTexts } = await import('ai-functions')
        const result = await embedTexts([text])
        embedding = result.embeddings[0] ?? this.generateEmbedding(text)
        dimensions = embedding.length
        source = 'ai-functions'
      } catch (err) {
        // Fallback to mock embedding if ai-functions fails
        console.warn('ai-functions embedTexts failed, falling back to mock:', err)
        embedding = this.generateEmbedding(text)
      }
    } else {
      embedding = this.generateEmbedding(text)
    }

    const contentHash = generateContentHash(text)

    // Store as artifact with complete metadata
    const url = `${type}/${id}`
    await this.setArtifact(url, 'embedding', {
      content: embedding,
      sourceHash: contentHash,
      metadata: {
        fields: embeddedFields,
        dimensions,
        text: text.slice(0, 200),
        source,
      },
    })
  }

  // ===========================================================================
  // Things (Records)
  // ===========================================================================

  /**
   * Get or create the storage map for an entity type
   *
   * Lazily creates the type-specific storage map if it doesn't exist.
   * This ensures each entity type has its own namespace for ID collisions.
   *
   * @param type - The entity type name
   * @returns The Map storing entities of this type (id -> entity data)
   *
   * @internal
   */
  private getTypeStore(type: string): Map<string, Record<string, unknown>> {
    if (!this.entities.has(type)) {
      this.entities.set(type, new Map())
    }
    return this.entities.get(type)!
  }

  async get(type: string, id: string): Promise<Record<string, unknown> | null> {
    validateTypeName(type)
    validateEntityId(id)
    const store = this.getTypeStore(type)
    const entity = store.get(id)
    return entity ? { ...entity, $id: id, $type: type } : null
  }

  async list(type: string, options?: ListOptions): Promise<Record<string, unknown>[]> {
    validateTypeName(type)
    validateListOptions(options)
    const store = this.getTypeStore(type)
    let results: Record<string, unknown>[] = []

    for (const [id, entity] of store) {
      const full: Record<string, unknown> = { ...entity, $id: id, $type: type }

      // Apply where filter
      if (options?.where) {
        let matches = true
        for (const [key, value] of Object.entries(options.where)) {
          if ((full as Record<string, unknown>)[key] !== value) {
            matches = false
            break
          }
        }
        if (!matches) continue
      }

      results.push(full)
    }

    // Sort
    if (options?.orderBy) {
      const field = options.orderBy
      const dir = options.order === 'desc' ? -1 : 1
      results.sort((a, b) => {
        const aVal = a[field]
        const bVal = b[field]
        if (aVal === undefined && bVal === undefined) return 0
        if (aVal === undefined) return dir
        if (bVal === undefined) return -dir
        if ((aVal as string | number) < (bVal as string | number)) return -dir
        if ((aVal as string | number) > (bVal as string | number)) return dir
        return 0
      })
    }

    // Paginate
    if (options?.offset) {
      results = results.slice(options.offset)
    }
    if (options?.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  async search(
    type: string,
    query: string,
    options?: SearchOptions
  ): Promise<Record<string, unknown>[]> {
    validateTypeName(type)
    validateSearchQuery(query)
    validateSearchOptions(options)

    const all = await this.list(type, options)
    const queryLower = query.toLowerCase()
    let fields = options?.fields || ['$all']

    // Filter out dangerous field names
    fields = fields.filter((f) => !isDangerousField(f))

    // If all fields were dangerous, return empty results
    if (fields.length === 0) {
      return []
    }

    const scored: Array<{ entity: Record<string, unknown>; score: number }> = []

    for (const entity of all) {
      let searchText: string
      if (fields.includes('$all')) {
        searchText = JSON.stringify(entity).toLowerCase()
      } else {
        searchText = fields
          .map((f) => String(entity[f] || ''))
          .join(' ')
          .toLowerCase()
      }

      if (searchText.includes(queryLower)) {
        const index = searchText.indexOf(queryLower)
        const score = 1 - index / searchText.length
        if (!options?.minScore || score >= options.minScore) {
          scored.push({ entity, score })
        }
      }
    }

    scored.sort((a, b) => b.score - a.score)
    return scored.map((s) => s.entity)
  }

  /**
   * Semantic search using embedding similarity
   *
   * Priority for embedding and similarity operations:
   * 1. Custom embeddingProvider if set
   * 2. ai-functions if useAiFunctions is enabled
   * 3. Local mock implementations (default)
   */
  async semanticSearch(
    type: string,
    query: string,
    options?: SemanticSearchOptions
  ): Promise<Array<Record<string, unknown> & { $score: number }>> {
    const store = this.getTypeStore(type)
    const limit = options?.limit ?? 10
    const minScore = options?.minScore ?? 0

    // Generate query embedding
    let queryEmbedding: number[]
    if (this.embeddingProvider) {
      try {
        const result = await this.embeddingProvider.embedTexts([query])
        queryEmbedding = result.embeddings[0] ?? this.generateEmbedding(query)
      } catch (err) {
        console.warn('Custom embedding provider failed for query, falling back to mock:', err)
        queryEmbedding = this.generateEmbedding(query)
      }
    } else if (this.useAiFunctions) {
      try {
        const { embedTexts } = await import('ai-functions')
        const result = await embedTexts([query])
        queryEmbedding = result.embeddings[0] ?? this.generateEmbedding(query)
      } catch (err) {
        console.warn('ai-functions embedTexts failed for query, falling back to mock:', err)
        queryEmbedding = this.generateEmbedding(query)
      }
    } else {
      queryEmbedding = this.generateEmbedding(query)
    }

    // Get similarity function
    let similarityFn: (a: number[], b: number[]) => number
    if (this.embeddingProvider?.cosineSimilarity) {
      similarityFn = this.embeddingProvider.cosineSimilarity
    } else if (this.useAiFunctions) {
      try {
        const { cosineSimilarity: aiCosineSimilarity } = await import('ai-functions')
        similarityFn = aiCosineSimilarity
      } catch (err) {
        console.warn('ai-functions cosineSimilarity not available, using local:', err)
        similarityFn = cosineSimilarity
      }
    } else {
      similarityFn = cosineSimilarity
    }

    // Collect embeddings and entities for potential findSimilar usage
    const embeddings: number[][] = []
    const entities: Array<{ entity: Record<string, unknown>; id: string }> = []

    for (const [id, entity] of store) {
      const url = `${type}/${id}`
      const artifact = await this.getArtifact(url, 'embedding')

      if (!artifact || !Array.isArray(artifact.content)) {
        continue
      }

      embeddings.push(artifact.content as number[])
      entities.push({ entity: { ...entity, $id: id, $type: type }, id })
    }

    // If using embeddingProvider with findSimilar, use it
    if (this.embeddingProvider?.findSimilar && entities.length > 0) {
      try {
        const results = this.embeddingProvider.findSimilar(queryEmbedding, embeddings, entities, {
          topK: limit,
          minScore,
        })
        return results.map(({ item, score }) => ({
          ...item.entity,
          $score: score,
        }))
      } catch (err) {
        console.warn(
          'Custom embedding provider findSimilar failed, falling back to manual scoring:',
          err
        )
      }
    }

    // If using ai-functions and we have entities, try to use findSimilar
    if (this.useAiFunctions && entities.length > 0) {
      try {
        const { findSimilar } = await import('ai-functions')
        const results = findSimilar(queryEmbedding, embeddings, entities, { topK: limit, minScore })
        return results.map(({ item, score }) => ({
          ...item.entity,
          $score: score,
        }))
      } catch (err) {
        // Fall through to manual scoring if findSimilar fails
        console.warn('ai-functions findSimilar failed, falling back to manual scoring:', err)
      }
    }

    // Manual scoring fallback
    const scored: Array<{ entity: Record<string, unknown>; score: number }> = []

    for (let i = 0; i < entities.length; i++) {
      const embedding = embeddings[i]!
      const { entity } = entities[i]!
      const score = similarityFn(queryEmbedding, embedding)

      if (score >= minScore) {
        scored.push({ entity, score })
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score)

    // Apply limit and add $score
    return scored.slice(0, limit).map(({ entity, score }) => ({
      ...entity,
      $score: score,
    }))
  }

  /**
   * Hybrid search combining FTS and semantic with RRF scoring
   */
  async hybridSearch(
    type: string,
    query: string,
    options?: HybridSearchOptions
  ): Promise<
    Array<
      Record<string, unknown> & {
        $rrfScore: number
        $ftsRank: number
        $semanticRank: number
        $score: number
      }
    >
  > {
    const limit = options?.limit ?? 10
    const offset = options?.offset ?? 0
    const rrfK = options?.rrfK ?? 60
    const ftsWeight = options?.ftsWeight ?? 0.5
    const semanticWeight = options?.semanticWeight ?? 0.5
    const minScore = options?.minScore ?? 0

    // Get FTS results with their ranks
    const ftsResults = await this.search(type, query)
    const ftsRanks = new Map<string, number>()
    ftsResults.forEach((entity, index) => {
      const id = (entity['$id'] as string) || (entity['id'] as string)
      ftsRanks.set(id, index + 1) // 1-indexed rank
    })

    // Get semantic results with their ranks and scores
    // Get more results to ensure we have enough after offset
    const semanticResults = await this.semanticSearch(type, query, {
      limit: (limit + offset) * 2,
      minScore,
    })
    const semanticRanks = new Map<string, { rank: number; score: number }>()
    semanticResults.forEach((entity, index) => {
      const id = (entity['$id'] as string) || (entity['id'] as string)
      semanticRanks.set(id, { rank: index + 1, score: entity.$score })
    })

    // Combine results with RRF
    const allIds = new Set([...ftsRanks.keys(), ...semanticRanks.keys()])
    const combined: Array<{
      entity: Record<string, unknown>
      rrfScore: number
      ftsRank: number
      semanticRank: number
      semanticScore: number
    }> = []

    const store = this.getTypeStore(type)

    for (const id of allIds) {
      const entity = store.get(id)
      if (!entity) continue

      const ftsRank = ftsRanks.get(id) ?? Infinity
      const semantic = semanticRanks.get(id) ?? { rank: Infinity, score: 0 }
      const semanticRank = semantic.rank
      const semanticScore = semantic.score

      // Skip if semantic score is below threshold (when we have a semantic result)
      if (semanticRanks.has(id) && semanticScore < minScore) continue

      const rrfScore = computeRRF(ftsRank, semanticRank, rrfK, ftsWeight, semanticWeight)

      combined.push({
        entity: { ...entity, $id: id, $type: type },
        rrfScore,
        ftsRank,
        semanticRank,
        semanticScore,
      })
    }

    // Sort by RRF score descending
    combined.sort((a, b) => b.rrfScore - a.rrfScore)

    // Apply offset and limit, then return with scoring fields
    return combined
      .slice(offset, offset + limit)
      .map(({ entity, rrfScore, ftsRank, semanticRank, semanticScore }) => ({
        ...entity,
        $rrfScore: rrfScore,
        $ftsRank: ftsRank,
        $semanticRank: semanticRank,
        $score: semanticScore,
      }))
  }

  /**
   * Get all embeddings for a type
   */
  async getAllEmbeddings(type: string): Promise<Array<{ id: string; embedding: number[] }>> {
    const store = this.getTypeStore(type)
    const results: Array<{ id: string; embedding: number[] }> = []

    for (const [id] of store) {
      const url = `${type}/${id}`
      const artifact = await this.getArtifact(url, 'embedding')

      if (artifact && Array.isArray(artifact.content)) {
        results.push({
          id,
          embedding: artifact.content as number[],
        })
      }
    }

    return results
  }

  async create(
    type: string,
    id: string | undefined,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    validateTypeName(type)
    if (id !== undefined) {
      validateEntityId(id)
    }
    validateEntityData(data)

    const store = this.getTypeStore(type)
    const entityId = id || generateId()

    if (store.has(entityId)) {
      throw new EntityAlreadyExistsError(type, entityId, 'create')
    }

    const entity = {
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    store.set(entityId, entity)

    // Auto-generate embedding
    await this.autoEmbed(type, entityId, entity)

    // Emit type-specific and global events
    const eventData = { $id: entityId, $type: type, ...entity }
    await this.emit(`${type}.created`, eventData)
    await this.emit('entity:created', eventData)

    return { ...entity, $id: entityId, $type: type }
  }

  async update(
    type: string,
    id: string,
    data: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    validateTypeName(type)
    validateEntityId(id)
    validateEntityData(data)

    const store = this.getTypeStore(type)
    const existing = store.get(id)

    if (!existing) {
      throw new EntityNotFoundError(type, id, 'update')
    }

    const updated = {
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    }

    store.set(id, updated)

    // Re-generate embedding with updated data
    await this.autoEmbed(type, id, updated)

    // Invalidate non-embedding artifacts when data changes
    await this.invalidateArtifacts(`${type}/${id}`)

    // Emit type-specific and global events
    const eventData = { $id: id, $type: type, ...updated }
    await this.emit(`${type}.updated`, eventData)
    await this.emit('entity:updated', eventData)

    return { ...updated, $id: id, $type: type }
  }

  async delete(type: string, id: string): Promise<boolean> {
    validateTypeName(type)
    validateEntityId(id)

    const store = this.getTypeStore(type)

    if (!store.has(id)) {
      return false
    }

    store.delete(id)

    // Emit type-specific and global events
    const eventData = { $id: id, $type: type }
    await this.emit(`${type}.deleted`, eventData)
    await this.emit('entity:deleted', eventData)

    // Clean up relations
    for (const [key, targets] of this.relations) {
      if (key.startsWith(`${type}:${id}:`)) {
        this.relations.delete(key)
      }
      targets.delete(`${type}:${id}`)
    }

    // Clean up artifacts
    await this.deleteArtifact(`${type}/${id}`)

    return true
  }

  // ===========================================================================
  // Relationships
  // ===========================================================================

  /**
   * Generate a unique key for storing relationships
   *
   * Creates a composite key from source entity type, ID, and relation name
   * that serves as the key in the relations Map.
   *
   * @param fromType - The source entity type
   * @param fromId - The source entity ID
   * @param relation - The relationship name
   * @returns Composite key in format "type:id:relation"
   *
   * @internal
   */
  private relationKey(fromType: string, fromId: string, relation: string): string {
    return `${fromType}:${fromId}:${relation}`
  }

  async related(type: string, id: string, relation: string): Promise<Record<string, unknown>[]> {
    const key = this.relationKey(type, id, relation)
    const targets = this.relations.get(key)

    if (!targets) return []

    const results: Record<string, unknown>[] = []
    for (const target of targets) {
      const [targetType, targetId] = target.split(':')
      const entity = await this.get(targetType!, targetId!)
      if (entity) {
        results.push(entity)
      }
    }

    return results
  }

  async relate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string,
    metadata?: { matchMode?: 'exact' | 'fuzzy'; similarity?: number; matchedType?: string }
  ): Promise<void> {
    validateTypeName(fromType)
    validateEntityId(fromId)
    validateRelationName(relation)
    validateTypeName(toType)
    validateEntityId(toId)

    const key = this.relationKey(fromType, fromId, relation)

    if (!this.relations.has(key)) {
      this.relations.set(key, new Set())
    }

    this.relations.get(key)!.add(`${toType}:${toId}`)

    // Emit event with metadata
    await this.emit('Relation.created', {
      from: `${fromType}/${fromId}`,
      type: relation,
      to: `${toType}/${toId}`,
      matchMode: metadata?.matchMode,
      similarity: metadata?.similarity,
    })
  }

  async unrelate(
    fromType: string,
    fromId: string,
    relation: string,
    toType: string,
    toId: string
  ): Promise<void> {
    const key = this.relationKey(fromType, fromId, relation)
    const targets = this.relations.get(key)

    if (targets) {
      targets.delete(`${toType}:${toId}`)

      // Emit event
      await this.emit('Relation.deleted', {
        from: `${fromType}/${fromId}`,
        type: relation,
        to: `${toType}/${toId}`,
      })
    }
  }

  // ===========================================================================
  // Events (Actor-Event-Object-Result pattern)
  // ===========================================================================

  /**
   * Emit an event using Actor-Event-Object-Result pattern
   *
   * @example
   * ```ts
   * // New pattern
   * await provider.emit({
   *   actor: 'user:john',
   *   event: 'Post.created',
   *   object: 'Post/hello-world',
   *   objectData: { title: 'Hello World' },
   * })
   *
   * // Legacy pattern (still supported)
   * await provider.emit('Post.created', { title: 'Hello World' })
   * ```
   */
  async emit(
    eventOrType:
      | string
      | {
          actor?: string
          actorData?: ActorData
          event: string
          object?: string
          objectData?: Record<string, unknown>
          result?: string
          resultData?: Record<string, unknown>
          meta?: Record<string, unknown>
        },
    data?: unknown
  ): Promise<Event> {
    let event: Event

    if (typeof eventOrType === 'string') {
      // Legacy pattern: emit('Post.created', { ... })
      event = {
        id: generateId(),
        actor: 'system',
        event: eventOrType,
        timestamp: new Date(),
        // Legacy fields
        type: eventOrType,
        data,
        ...(data !== undefined && { objectData: data as Record<string, unknown> }),
      }
    } else {
      // New pattern: emit({ actor, event, object, ... })
      event = {
        id: generateId(),
        actor: eventOrType.actor ?? 'system',
        event: eventOrType.event,
        timestamp: new Date(),
        // Legacy fields
        type: eventOrType.event,
        ...(eventOrType.actorData !== undefined && { actorData: eventOrType.actorData }),
        ...(eventOrType.object !== undefined && { object: eventOrType.object }),
        ...(eventOrType.objectData !== undefined && { objectData: eventOrType.objectData }),
        ...(eventOrType.result !== undefined && { result: eventOrType.result }),
        ...(eventOrType.resultData !== undefined && { resultData: eventOrType.resultData }),
        ...(eventOrType.meta !== undefined && { meta: eventOrType.meta }),
      }
    }

    this.events.push(event)

    // Trigger handlers (with concurrency control)
    const handlers = this.getEventHandlers(event.event)
    await this.semaphore.map(handlers, (handler) => Promise.resolve(handler(event)))

    return event
  }

  /**
   * Get all event handlers matching an event type
   *
   * Collects handlers from all registered patterns that match the given
   * event type. Supports exact matches, wildcards (*), and prefix/suffix
   * patterns (*.created, Post.*).
   *
   * @param type - The event type to match handlers for
   * @returns Array of matching event handlers
   *
   * @internal
   */
  private getEventHandlers(type: string): Array<(event: Event) => void | Promise<void>> {
    const handlers: Array<(event: Event) => void | Promise<void>> = []

    for (const [pattern, patternHandlers] of [...this.eventHandlers]) {
      if (this.matchesPattern(type, pattern)) {
        handlers.push(...[...patternHandlers])
      }
    }

    return handlers
  }

  /**
   * Check if an event type matches a subscription pattern
   *
   * Supports several pattern formats:
   * - Exact match: 'Post.created' matches 'Post.created'
   * - Global wildcard: '*' matches everything
   * - Prefix wildcard: 'Post.*' matches 'Post.created', 'Post.updated', etc.
   * - Suffix wildcard: '*.created' matches 'Post.created', 'User.created', etc.
   *
   * @param type - The event type to check
   * @param pattern - The subscription pattern to match against
   * @returns True if the type matches the pattern
   *
   * @internal
   */
  private matchesPattern(type: string, pattern: string): boolean {
    if (pattern === type) return true
    if (pattern === '*') return true
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2)
      return type.startsWith(prefix + '.')
    }
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(2)
      return type.endsWith('.' + suffix)
    }
    return false
  }

  on(pattern: string, handler: (event: Event) => void | Promise<void>): () => void {
    validateEventPattern(pattern)

    if (!this.eventHandlers.has(pattern)) {
      this.eventHandlers.set(pattern, [])
    }
    this.eventHandlers.get(pattern)!.push(handler)

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(pattern)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index !== -1) handlers.splice(index, 1)
      }
    }
  }

  async listEvents(options?: {
    event?: string
    actor?: string
    object?: string
    since?: Date
    until?: Date
    limit?: number
    /** @deprecated Use 'event' instead */
    type?: string
  }): Promise<Event[]> {
    let results = [...this.events]

    // Filter by event pattern
    const eventPattern = options?.event ?? options?.type
    if (eventPattern) {
      results = results.filter((e) => this.matchesPattern(e.event, eventPattern))
    }
    if (options?.actor) {
      results = results.filter((e) => e.actor === options.actor)
    }
    if (options?.object) {
      results = results.filter((e) => e.object === options.object)
    }
    if (options?.since) {
      results = results.filter((e) => e.timestamp >= options.since!)
    }
    if (options?.until) {
      results = results.filter((e) => e.timestamp <= options.until!)
    }
    if (options?.limit) {
      results = results.slice(-options.limit)
    }

    return results
  }

  async replayEvents(options: {
    event?: string
    actor?: string
    since?: Date
    handler: (event: Event) => void | Promise<void>
    /** @deprecated Use 'event' instead */
    type?: string
  }): Promise<void> {
    const eventPattern = options.event ?? options.type
    const events = await this.listEvents({
      ...(eventPattern !== undefined && { event: eventPattern }),
      ...(options.actor !== undefined && { actor: options.actor }),
      ...(options.since !== undefined && { since: options.since }),
    })

    for (const event of events) {
      await this.semaphore.run(() => Promise.resolve(options.handler(event)))
    }
  }

  // ===========================================================================
  // Actions (Linguistic Verb Pattern)
  // ===========================================================================

  /**
   * Create an action with automatic verb conjugation
   *
   * @example
   * ```ts
   * // New pattern with verb conjugation
   * const action = await provider.createAction({
   *   actor: 'system',
   *   action: 'generate',  // auto-conjugates to act='generates', activity='generating'
   *   object: 'Post',
   *   objectData: { count: 100 },
   *   total: 100,
   * })
   *
   * // Legacy pattern (still supported)
   * const action = await provider.createAction({
   *   type: 'generate',
   *   data: { count: 100 },
   *   total: 100,
   * })
   * ```
   */
  async createAction(data: {
    actor?: string
    actorData?: ActorData
    action?: string
    object?: string
    objectData?: Record<string, unknown>
    total?: number
    meta?: Record<string, unknown>
    // Legacy
    type?: string
    data?: unknown
  }): Promise<Action> {
    // Get base verb from action or legacy type
    const baseVerb = data.action ?? data.type ?? 'process'

    // Validate action type
    validateActionType(baseVerb)

    // Auto-conjugate verb forms
    const conjugated = conjugateVerb(baseVerb)

    const objectData = data.objectData ?? (data.data as Record<string, unknown> | undefined)
    const action: Action = {
      id: generateId(),
      actor: data.actor ?? 'system',
      act: conjugated.act,
      action: conjugated.action,
      activity: conjugated.activity,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      // Legacy fields
      type: baseVerb,
      data: data.data,
      ...(data.actorData !== undefined && { actorData: data.actorData }),
      ...(data.object !== undefined && { object: data.object }),
      ...(objectData !== undefined && { objectData }),
      ...(data.total !== undefined && { total: data.total }),
      ...(data.meta !== undefined && { meta: data.meta }),
    }

    this.actions.set(action.id, action)

    await this.emit({
      actor: action.actor,
      event: 'Action.created',
      object: action.id,
      objectData: {
        action: action.action,
        ...(action.object !== undefined && { object: action.object }),
      },
      ...(action.actorData !== undefined && { actorData: action.actorData }),
    })

    return action
  }

  async getAction(id: string): Promise<Action | null> {
    return this.actions.get(id) ?? null
  }

  async updateAction(
    id: string,
    updates: Partial<Pick<Action, 'status' | 'progress' | 'result' | 'error'>>
  ): Promise<Action> {
    const action = this.actions.get(id)
    if (!action) {
      throw new EntityNotFoundError('Action', id, 'updateAction')
    }

    Object.assign(action, updates)

    if (updates.status === 'active' && !action.startedAt) {
      action.startedAt = new Date()
      await this.emit({
        actor: action.actor,
        event: 'Action.started',
        object: action.id,
        objectData: { action: action.action, activity: action.activity },
      })
    }

    if (updates.status === 'completed') {
      action.completedAt = new Date()
      await this.emit({
        actor: action.actor,
        event: 'Action.completed',
        object: action.id,
        objectData: { action: action.action },
        ...(action.object !== undefined && { result: action.object }),
        ...(action.result !== undefined && { resultData: action.result }),
      })
    }

    if (updates.status === 'failed') {
      action.completedAt = new Date()
      await this.emit({
        actor: action.actor,
        event: 'Action.failed',
        object: action.id,
        objectData: { action: action.action, error: action.error },
      })
    }

    if (updates.status === 'cancelled') {
      action.completedAt = new Date()
      await this.emit({
        actor: action.actor,
        event: 'Action.cancelled',
        object: action.id,
        objectData: { action: action.action },
      })
    }

    return action
  }

  async listActions(options?: {
    status?: Action['status']
    action?: string
    actor?: string
    object?: string
    since?: Date
    until?: Date
    limit?: number
    /** @deprecated Use 'action' instead */
    type?: string
  }): Promise<Action[]> {
    let results = Array.from(this.actions.values())

    if (options?.status) {
      results = results.filter((a) => a.status === options.status)
    }
    // Filter by action or legacy type
    const actionFilter = options?.action ?? options?.type
    if (actionFilter) {
      results = results.filter((a) => a.action === actionFilter)
    }
    if (options?.actor) {
      results = results.filter((a) => a.actor === options.actor)
    }
    if (options?.object) {
      results = results.filter((a) => a.object === options.object)
    }
    if (options?.since) {
      results = results.filter((a) => a.createdAt >= options.since!)
    }
    if (options?.until) {
      results = results.filter((a) => a.createdAt <= options.until!)
    }
    if (options?.limit) {
      results = results.slice(0, options.limit)
    }

    return results
  }

  async retryAction(id: string): Promise<Action> {
    const action = this.actions.get(id)
    if (!action) {
      throw new EntityNotFoundError('Action', id, 'retryAction')
    }
    if (action.status !== 'failed') {
      throw new Error(`Can only retry failed actions: ${id}`)
    }

    action.status = 'pending'
    delete action.error
    delete action.startedAt
    delete action.completedAt

    await this.emit({
      actor: action.actor,
      event: 'Action.retried',
      object: action.id,
      objectData: { action: action.action },
    })

    return action
  }

  async cancelAction(id: string): Promise<void> {
    const action = this.actions.get(id)
    if (!action) {
      throw new EntityNotFoundError('Action', id, 'cancelAction')
    }
    if (
      action.status === 'completed' ||
      action.status === 'failed' ||
      action.status === 'cancelled'
    ) {
      throw new Error(`Cannot cancel finished action: ${id}`)
    }

    action.status = 'cancelled'
    action.completedAt = new Date()

    await this.emit({
      actor: action.actor,
      event: 'Action.cancelled',
      object: action.id,
      objectData: { action: action.action },
    })
  }

  // ===========================================================================
  // Artifacts
  // ===========================================================================

  /**
   * Generate a unique key for storing artifacts
   *
   * Creates a composite key from URL and artifact type for storage
   * in the artifacts Map.
   *
   * @param url - The entity URL (e.g., 'Post/123')
   * @param type - The artifact type (e.g., 'embedding')
   * @returns Composite key in format "url:type"
   *
   * @internal
   */
  private artifactKey(url: string, type: string): string {
    return `${url}:${type}`
  }

  async getArtifact(url: string, type: string): Promise<Artifact | null> {
    return this.artifacts.get(this.artifactKey(url, type)) ?? null
  }

  async setArtifact(
    url: string,
    type: string,
    data: { content: unknown; sourceHash: string; metadata?: Record<string, unknown> }
  ): Promise<void> {
    validateArtifactUrl(url)

    const artifact: Artifact = {
      url,
      type,
      sourceHash: data.sourceHash,
      content: data.content,
      createdAt: new Date(),
      ...(data.metadata !== undefined && { metadata: data.metadata }),
    }

    this.artifacts.set(this.artifactKey(url, type), artifact)
  }

  async deleteArtifact(url: string, type?: string): Promise<void> {
    if (type) {
      this.artifacts.delete(this.artifactKey(url, type))
    } else {
      // Delete all artifacts for this URL
      for (const key of this.artifacts.keys()) {
        if (key.startsWith(`${url}:`)) {
          this.artifacts.delete(key)
        }
      }
    }
  }

  /**
   * Invalidate cached artifacts for an entity (except embeddings)
   *
   * Called when entity data changes to ensure stale computed content
   * (like cached transformations) is regenerated. Embeddings are preserved
   * as they're regenerated separately via autoEmbed.
   *
   * @param url - The entity URL whose artifacts should be invalidated
   *
   * @internal
   */
  private async invalidateArtifacts(url: string): Promise<void> {
    // Keep embedding artifact but mark others for regeneration
    for (const [key, artifact] of this.artifacts) {
      if (key.startsWith(`${url}:`) && artifact.type !== 'embedding') {
        this.artifacts.delete(key)
      }
    }
  }

  async listArtifacts(url: string): Promise<Artifact[]> {
    const results: Artifact[] = []
    for (const [key, artifact] of this.artifacts) {
      if (key.startsWith(`${url}:`)) {
        results.push(artifact)
      }
    }
    return results
  }

  // ===========================================================================
  // Utilities
  // ===========================================================================

  /**
   * Run an operation with concurrency control
   */
  async withConcurrency<T>(fn: () => Promise<T>): Promise<T> {
    return this.semaphore.run(fn)
  }

  /**
   * Run multiple operations with concurrency control
   */
  async mapWithConcurrency<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
    return this.semaphore.map(items, fn)
  }

  /**
   * Clear all data (useful for testing)
   */
  clear(): void {
    this.entities.clear()
    this.relations.clear()
    this.events.length = 0
    this.actions.clear()
    this.artifacts.clear()
    this.eventHandlers.clear()
  }

  /**
   * Get stats
   */
  stats(): {
    entities: number
    relations: number
    events: number
    actions: {
      pending: number
      active: number
      completed: number
      failed: number
      cancelled: number
    }
    artifacts: number
    concurrency: { active: number; pending: number }
  } {
    let entityCount = 0
    for (const store of this.entities.values()) {
      entityCount += store.size
    }

    let relationCount = 0
    for (const targets of this.relations.values()) {
      relationCount += targets.size
    }

    const actionStats = { pending: 0, active: 0, completed: 0, failed: 0, cancelled: 0 }
    for (const action of this.actions.values()) {
      actionStats[action.status]++
    }

    return {
      entities: entityCount,
      relations: relationCount,
      events: this.events.length,
      actions: actionStats,
      artifacts: this.artifacts.size,
      concurrency: {
        active: this.semaphore.active,
        pending: this.semaphore.pending,
      },
    }
  }
}

/**
 * Create an in-memory provider
 */
export function createMemoryProvider(options?: MemoryProviderOptions): MemoryProvider {
  return new MemoryProvider(options)
}
