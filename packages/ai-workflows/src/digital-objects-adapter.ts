/**
 * digital-objects adapter for ai-workflows
 *
 * Provides durable persistence for workflow state using digital-objects.
 * Maps workflow concepts to digital-objects primitives:
 * - Workflows -> Things
 * - Workflow steps/events -> Actions
 * - State changes -> Actions with data
 *
 * @example
 * ```typescript
 * import { createMemoryProvider } from 'digital-objects'
 * import { createDigitalObjectsAdapter } from 'ai-workflows'
 *
 * const provider = createMemoryProvider()
 * const db = createDigitalObjectsAdapter(provider)
 *
 * const workflow = Workflow($ => {
 *   $.on.Customer.created(async (customer, $) => {
 *     await $.send('Email.welcome', { to: customer.email })
 *   })
 * }, { db })
 * ```
 *
 * @packageDocumentation
 */

import type { DigitalObjectsProvider, Thing, Action, ActionStatusType } from 'digital-objects'
import type { DatabaseContext, ActionData, ArtifactData } from './types.js'

/**
 * Workflow instance data stored as a Thing
 */
export interface WorkflowThingData {
  name: string
  status: 'initializing' | 'running' | 'paused' | 'completed' | 'failed'
  context: Record<string, unknown>
  registeredEvents: string[]
  registeredSchedules: string[]
}

/**
 * Event data stored in Actions
 */
export interface EventActionData {
  event: string
  data: unknown
  eventId: string
}

/**
 * Step/action data stored in Actions
 */
export interface StepActionData {
  stepName: string
  status: ActionStatusType
  tier?: 'code' | 'generative' | 'agentic' | 'human'
  input?: unknown
  output?: unknown
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * Artifact data stored as a Thing
 */
export interface ArtifactThingData extends ArtifactData {
  workflowId?: string
}

/**
 * Options for creating the digital-objects adapter
 */
export interface DigitalObjectsAdapterOptions {
  /**
   * Workflow instance ID for tracking actions
   * If provided, all actions will be associated with this workflow
   */
  workflowId?: string

  /**
   * Whether to auto-define required nouns and verbs
   * @default true
   */
  autoDefine?: boolean
}

/**
 * Extended DatabaseContext with digital-objects specific methods
 */
export interface DigitalObjectsDatabaseContext extends DatabaseContext {
  /**
   * The underlying digital-objects provider
   */
  readonly provider: DigitalObjectsProvider

  /**
   * The workflow instance ID (if set)
   */
  readonly workflowId?: string

  /**
   * Get workflow state as a Thing
   */
  getWorkflow<T = WorkflowThingData>(id: string): Promise<Thing<T> | null>

  /**
   * Update workflow state
   */
  updateWorkflow<T = WorkflowThingData>(id: string, data: Partial<T>): Promise<Thing<T>>

  /**
   * List all actions for a workflow
   */
  listWorkflowActions<T = unknown>(workflowId: string): Promise<Action<T>[]>

  /**
   * Query actions by verb
   */
  listActionsByVerb<T = unknown>(verb: string): Promise<Action<T>[]>
}

/**
 * Define workflow-specific nouns in the provider
 */
async function defineWorkflowNouns(provider: DigitalObjectsProvider): Promise<void> {
  // Check if already defined
  const existing = await provider.getNoun('Workflow')
  if (existing) return

  await Promise.all([
    provider.defineNoun({
      name: 'Workflow',
      description: 'Workflow instance with state and event handlers',
    }),
    provider.defineNoun({
      name: 'Artifact',
      description: 'Cached workflow artifact (AST, compiled code, etc.)',
    }),
    provider.defineNoun({
      name: 'Schedule',
      description: 'Scheduled task registration',
    }),
    provider.defineNoun({
      name: 'Cascade',
      description: 'Cascade execution context for tiered processing',
    }),
  ])
}

/**
 * Define workflow-specific verbs in the provider
 */
async function defineWorkflowVerbs(provider: DigitalObjectsProvider): Promise<void> {
  // Check if already defined
  const existing = await provider.getVerb('emit')
  if (existing) return

  await Promise.all([
    provider.defineVerb({
      name: 'emit',
      description: 'Emit an event',
    }),
    provider.defineVerb({
      name: 'track',
      description: 'Track a telemetry event (fire and forget)',
    }),
    provider.defineVerb({
      name: 'execute',
      description: 'Execute a workflow step',
    }),
    provider.defineVerb({
      name: 'complete',
      description: 'Mark an action as completed',
    }),
    provider.defineVerb({
      name: 'fail',
      description: 'Mark an action as failed',
    }),
    provider.defineVerb({
      name: 'set',
      description: 'Set a context value',
    }),
    provider.defineVerb({
      name: 'step',
      description: 'Record a cascade step',
    }),
    provider.defineVerb({
      name: 'dependsOn',
      description: 'Declare step dependency',
    }),
    provider.defineVerb({
      name: 'escalate',
      description: 'Escalate to next tier in cascade',
    }),
    provider.defineVerb({
      name: 'transition',
      description: 'Workflow state transition',
    }),
  ])
}

/**
 * Create a DatabaseContext adapter backed by digital-objects
 *
 * @param provider - The digital-objects provider (MemoryProvider, NS, etc.)
 * @param options - Optional configuration
 * @returns A DatabaseContext compatible with ai-workflows
 *
 * @example
 * ```typescript
 * import { createMemoryProvider } from 'digital-objects'
 * import { createDigitalObjectsAdapter, Workflow } from 'ai-workflows'
 *
 * const provider = createMemoryProvider()
 * const db = await createDigitalObjectsAdapter(provider)
 *
 * // Use with Workflow
 * const workflow = Workflow($ => {
 *   $.on.Order.created(async (order, $) => {
 *     $.log('Order created:', order.id)
 *   })
 * }, { db })
 * ```
 */
export async function createDigitalObjectsAdapter(
  provider: DigitalObjectsProvider,
  options: DigitalObjectsAdapterOptions = {}
): Promise<DigitalObjectsDatabaseContext> {
  const { workflowId, autoDefine = true } = options

  // Auto-define nouns and verbs if enabled
  if (autoDefine) {
    await defineWorkflowNouns(provider)
    await defineWorkflowVerbs(provider)
  }

  const result: DigitalObjectsDatabaseContext = {
    provider,
    ...(workflowId !== undefined && { workflowId }),

    async recordEvent(event: string, data: unknown): Promise<void> {
      const eventId = crypto.randomUUID()
      await provider.perform<EventActionData>('emit', workflowId, undefined, {
        event,
        data,
        eventId,
      })
    },

    async createAction(action: ActionData): Promise<void> {
      const stepData: StepActionData = {
        stepName: `${action.actor}.${action.action}.${action.object}`,
        status: (action.status as ActionStatusType) ?? 'pending',
      }
      if (action.metadata) {
        stepData.metadata = action.metadata
      }
      await provider.perform<StepActionData>(action.action, action.actor, action.object, stepData)
    },

    async completeAction(id: string, result: unknown): Promise<void> {
      // Record completion as an action pointing to the original action
      await provider.perform<{ result: unknown; completedAt: number }>('complete', undefined, id, {
        result,
        completedAt: Date.now(),
      })
    },

    async storeArtifact(artifact: ArtifactData): Promise<void> {
      const artifactData: ArtifactThingData = {
        ...artifact,
        ...(workflowId && { workflowId }),
      }
      // Use artifact.key as the ID for easy retrieval
      await provider.create<ArtifactThingData>('Artifact', artifactData, artifact.key)
    },

    async getArtifact(key: string): Promise<unknown | null> {
      const thing = await provider.get<ArtifactThingData>(key)
      return thing?.data?.content ?? null
    },

    // Extended methods for digital-objects integration

    async getWorkflow<T = WorkflowThingData>(id: string): Promise<Thing<T> | null> {
      return provider.get<T>(id)
    },

    async updateWorkflow<T = WorkflowThingData>(id: string, data: Partial<T>): Promise<Thing<T>> {
      return provider.update<T>(id, data)
    },

    async listWorkflowActions<T = unknown>(wfId: string): Promise<Action<T>[]> {
      return provider.listActions<T>({ subject: wfId })
    },

    async listActionsByVerb<T = unknown>(verb: string): Promise<Action<T>[]> {
      return provider.listActions<T>({ verb })
    },
  }

  return result
}

/**
 * Synchronous factory that returns a partially initialized adapter.
 * Use this when you need synchronous construction but can defer initialization.
 *
 * @param provider - The digital-objects provider
 * @param options - Optional configuration
 * @returns A function that initializes and returns the adapter
 *
 * @example
 * ```typescript
 * const initAdapter = createDigitalObjectsAdapterSync(provider)
 *
 * // Later, when async is available
 * const db = await initAdapter()
 * ```
 */
export function createDigitalObjectsAdapterSync(
  provider: DigitalObjectsProvider,
  options: DigitalObjectsAdapterOptions = {}
): () => Promise<DigitalObjectsDatabaseContext> {
  return () => createDigitalObjectsAdapter(provider, options)
}

/**
 * Create a simple DatabaseContext without the extended digital-objects methods.
 * This is useful when you only need the basic DatabaseContext interface.
 *
 * @param provider - The digital-objects provider
 * @param options - Optional configuration
 * @returns A basic DatabaseContext
 */
export async function createSimpleAdapter(
  provider: DigitalObjectsProvider,
  options: DigitalObjectsAdapterOptions = {}
): Promise<DatabaseContext> {
  const fullAdapter = await createDigitalObjectsAdapter(provider, options)

  // Return only the DatabaseContext interface
  return {
    recordEvent: fullAdapter.recordEvent.bind(fullAdapter),
    createAction: fullAdapter.createAction.bind(fullAdapter),
    completeAction: fullAdapter.completeAction.bind(fullAdapter),
    storeArtifact: fullAdapter.storeArtifact.bind(fullAdapter),
    getArtifact: fullAdapter.getArtifact.bind(fullAdapter),
  }
}
