/**
 * DatabaseContext Implementation - Persistence layer for ai-workflows using ai-database
 *
 * Provides durable storage for workflow events, actions, and artifacts with:
 * - Event sourcing (immutable event log)
 * - State snapshots and restoration
 * - Event replay capabilities
 * - Action tracking with status management
 * - Artifact caching for compiled content
 *
 * @example
 * ```typescript
 * import { DB } from 'ai-database'
 * import { createDatabaseContext } from 'ai-workflows'
 *
 * const { db, events } = DB({
 *   WorkflowEvent: { type: 'string', data: 'string' },
 *   WorkflowAction: { actor: 'string', status: 'string' },
 *   WorkflowArtifact: { key: 'string', type: 'string' },
 *   WorkflowSnapshot: { workflowId: 'string', state: 'string' },
 * })
 *
 * const dbContext = createDatabaseContext({ db, events })
 *
 * // Use with Workflow
 * const workflow = Workflow($ => {
 *   $.on.Customer.created(async (customer, $) => {
 *     // Events are now persisted durably
 *     $.send('Email.welcome', { to: customer.email })
 *   })
 * }, { db: dbContext })
 * ```
 *
 * @packageDocumentation
 */

import type { DatabaseContext, ActionData, ArtifactData } from './types.js'
import { getLogger } from './logger.js'

/**
 * Event stored in the database
 */
export interface StoredEvent {
  $id: string
  $type: string
  eventType: string
  data: string // JSON serialized
  timestamp: number
  correlationId?: string
  causationId?: string
  workflowId?: string
  source?: string
}

/**
 * Action stored in the database
 */
export interface StoredAction {
  $id: string
  $type: string
  actor: string
  object: string
  action: string
  status: 'pending' | 'active' | 'completed' | 'failed'
  metadata: string // JSON serialized
  result?: string // JSON serialized
  createdAt: number
  updatedAt: number
  completedAt?: number
}

/**
 * Artifact stored in the database
 */
export interface StoredArtifact {
  $id: string
  $type: string
  key: string
  artifactType: string
  sourceHash: string
  content: string // JSON serialized
  metadata?: string // JSON serialized
  createdAt: number
}

/**
 * Snapshot stored in the database
 */
export interface StoredSnapshot {
  $id: string
  $type: string
  workflowId: string
  label?: string
  state: string // JSON serialized
  eventSequence: number // Last event sequence at snapshot time
  createdAt: number
}

/**
 * Database provider interface for persistence operations
 * Compatible with ai-database DB() result or any similar provider
 */
export interface DatabaseProvider {
  get: (type: string, id: string) => Promise<Record<string, unknown> | null>
  create: (
    type: string,
    data: Record<string, unknown>,
    id?: string
  ) => Promise<Record<string, unknown>>
  update: (
    type: string,
    id: string,
    data: Record<string, unknown>
  ) => Promise<Record<string, unknown>>
  delete: (type: string, id: string) => Promise<boolean>
  list: (
    type: string,
    options?: { limit?: number; offset?: number; where?: Record<string, unknown> }
  ) => Promise<Record<string, unknown>[]>
  emit?: (event: string, data: unknown) => Promise<{ id: string }>
}

/**
 * Events API interface for event subscription
 */
export interface EventsAPI {
  on: (event: string, handler: (data: unknown) => void) => () => void
  emit: (
    event: string | { event: string; [key: string]: unknown },
    data?: unknown
  ) => Promise<{ id: string }>
  list?: (options?: { event?: string; since?: Date; limit?: number }) => Promise<unknown[]>
  replay?: (options: {
    event?: string
    since?: Date
    handler: (event: unknown) => Promise<void>
  }) => Promise<void>
}

/**
 * Options for creating a DatabaseContext
 */
export interface DatabaseContextOptions {
  /** Database provider (from ai-database DB() or compatible) */
  db: DatabaseProvider
  /** Events API (optional, for event sourcing) */
  events?: EventsAPI
  /** Workflow ID for scoping events */
  workflowId?: string
  /** Source identifier for events */
  source?: string
}

/**
 * Extended DatabaseContext with event sourcing capabilities
 */
export interface EventSourcingContext extends DatabaseContext {
  /** Get all events for a workflow */
  getEvents: (options?: { since?: Date; limit?: number }) => Promise<StoredEvent[]>

  /** Replay events through a handler */
  replay: (
    handler: (event: string, data: unknown) => Promise<void>,
    options?: { since?: Date }
  ) => Promise<void>

  /** Create a snapshot of current state */
  createSnapshot: (state: unknown, label?: string) => Promise<string>

  /** Restore state from a snapshot */
  restoreSnapshot: (snapshotId: string) => Promise<unknown>

  /** Get available snapshots */
  getSnapshots: () => Promise<Array<{ id: string; label?: string; createdAt: Date }>>

  /** Get the event sequence number */
  getEventSequence: () => number
}

/**
 * Entity type names for database storage
 */
const ENTITY_TYPES = {
  EVENT: 'WorkflowEvent',
  ACTION: 'WorkflowAction',
  ARTIFACT: 'WorkflowArtifact',
  SNAPSHOT: 'WorkflowSnapshot',
} as const

/**
 * Generate a unique ID
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Create a DatabaseContext implementation backed by ai-database
 *
 * @param options - Configuration options
 * @returns DatabaseContext implementation with event sourcing capabilities
 */
export function createDatabaseContext(options: DatabaseContextOptions): EventSourcingContext {
  const { db, events, workflowId, source = 'workflow' } = options

  // Track event sequence for ordering
  let eventSequence = 0

  // Event handlers for live subscriptions
  const eventHandlers = new Map<string, Set<(data: unknown) => void>>()

  /**
   * Subscribe to live events from ai-database
   */
  if (events?.on) {
    // Subscribe to workflow events
    events.on('WorkflowEvent.created', (data) => {
      const event = data as StoredEvent
      const handlers = eventHandlers.get(event.eventType)
      if (handlers) {
        const parsedData = JSON.parse(event.data)
        for (const handler of handlers) {
          try {
            handler(parsedData)
          } catch (error) {
            getLogger().error(
              `[database-context] Error in event handler for ${event.eventType}:`,
              error
            )
          }
        }
      }
    })
  }

  return {
    /**
     * Record an event (immutable)
     */
    async recordEvent(eventType: string, data: unknown): Promise<void> {
      eventSequence++
      const eventId = generateId()
      const timestamp = Date.now()

      const storedEvent: Omit<StoredEvent, '$id' | '$type'> = {
        eventType,
        data: JSON.stringify(data),
        timestamp,
        source,
        ...(workflowId && { workflowId }),
      }

      // Store in database
      await db.create(
        ENTITY_TYPES.EVENT,
        storedEvent as unknown as Record<string, unknown>,
        eventId
      )

      // Emit to events API if available
      if (events?.emit) {
        await events.emit({
          event: 'WorkflowEvent.created',
          actor: source,
          object: `${ENTITY_TYPES.EVENT}/${eventId}`,
          objectData: storedEvent,
        })
      }
    },

    /**
     * Create an action (pending work)
     */
    async createAction(action: ActionData): Promise<void> {
      const actionId = generateId()
      const now = Date.now()

      const storedAction: Omit<StoredAction, '$id' | '$type'> = {
        actor: action.actor,
        object: action.object,
        action: action.action,
        status: action.status ?? 'pending',
        metadata: JSON.stringify(action.metadata ?? {}),
        createdAt: now,
        updatedAt: now,
      }

      await db.create(
        ENTITY_TYPES.ACTION,
        storedAction as unknown as Record<string, unknown>,
        actionId
      )

      if (events?.emit) {
        await events.emit({
          event: 'WorkflowAction.created',
          actor: action.actor,
          object: `${ENTITY_TYPES.ACTION}/${actionId}`,
          objectData: storedAction,
        })
      }
    },

    /**
     * Complete an action
     */
    async completeAction(id: string, result: unknown): Promise<void> {
      const existing = await db.get(ENTITY_TYPES.ACTION, id)
      if (!existing) {
        throw new Error(`Action not found: ${id}`)
      }

      const now = Date.now()
      await db.update(ENTITY_TYPES.ACTION, id, {
        status: 'completed',
        result: JSON.stringify(result),
        updatedAt: now,
        completedAt: now,
      })

      if (events?.emit) {
        // Cast is safe - we validated existing is not null above
        const existingAction = existing as unknown as StoredAction
        await events.emit({
          event: 'WorkflowAction.completed',
          actor: existingAction.actor,
          object: `${ENTITY_TYPES.ACTION}/${id}`,
          result: result,
        })
      }
    },

    /**
     * Store an artifact
     */
    async storeArtifact(artifact: ArtifactData): Promise<void> {
      const storedArtifact: Omit<StoredArtifact, '$id' | '$type'> = {
        key: artifact.key,
        artifactType: artifact.type,
        sourceHash: artifact.sourceHash,
        content: JSON.stringify(artifact.content),
        ...(artifact.metadata && { metadata: JSON.stringify(artifact.metadata) }),
        createdAt: Date.now(),
      }

      // Use key as ID for easy lookup
      await db.create(
        ENTITY_TYPES.ARTIFACT,
        storedArtifact as unknown as Record<string, unknown>,
        artifact.key
      )
    },

    /**
     * Get an artifact
     */
    async getArtifact(key: string): Promise<unknown | null> {
      const stored = await db.get(ENTITY_TYPES.ARTIFACT, key)
      if (!stored) {
        return null
      }

      const artifact = stored as unknown as StoredArtifact
      return JSON.parse(artifact.content)
    },

    /**
     * Get all events for a workflow
     */
    async getEvents(queryOptions?: { since?: Date; limit?: number }): Promise<StoredEvent[]> {
      const where: Record<string, unknown> = {}
      if (workflowId) {
        where['workflowId'] = workflowId
      }

      const listOptions: { limit?: number; where?: Record<string, unknown> } = {}
      if (Object.keys(where).length > 0) {
        listOptions.where = where
      }
      if (queryOptions?.limit !== undefined) {
        listOptions.limit = queryOptions.limit
      }

      const results = await db.list(ENTITY_TYPES.EVENT, listOptions)

      // Filter by timestamp if since is provided
      let events = results as unknown as StoredEvent[]
      if (queryOptions?.since) {
        const sinceTimestamp = queryOptions.since.getTime()
        events = events.filter((e) => e.timestamp >= sinceTimestamp)
      }

      // Sort by timestamp
      events.sort((a, b) => a.timestamp - b.timestamp)

      return events
    },

    /**
     * Replay events through a handler
     */
    async replay(
      handler: (event: string, data: unknown) => Promise<void>,
      replayOptions?: { since?: Date }
    ): Promise<void> {
      const storedEvents = await this.getEvents(replayOptions)

      for (const event of storedEvents) {
        const data = JSON.parse(event.data)
        await handler(event.eventType, data)
      }
    },

    /**
     * Create a snapshot of current state
     */
    async createSnapshot(state: unknown, label?: string): Promise<string> {
      const snapshotId = `snap-${workflowId ?? 'global'}-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`

      const storedSnapshot: Omit<StoredSnapshot, '$id' | '$type'> = {
        workflowId: workflowId ?? 'global',
        ...(label && { label }),
        state: JSON.stringify(state),
        eventSequence,
        createdAt: Date.now(),
      }

      await db.create(
        ENTITY_TYPES.SNAPSHOT,
        storedSnapshot as unknown as Record<string, unknown>,
        snapshotId
      )

      if (events?.emit) {
        await events.emit({
          event: 'WorkflowSnapshot.created',
          actor: source,
          object: `${ENTITY_TYPES.SNAPSHOT}/${snapshotId}`,
          objectData: { workflowId, label, eventSequence },
        })
      }

      return snapshotId
    },

    /**
     * Restore state from a snapshot
     */
    async restoreSnapshot(snapshotId: string): Promise<unknown> {
      const stored = await db.get(ENTITY_TYPES.SNAPSHOT, snapshotId)
      if (!stored) {
        throw new Error(`Snapshot not found: ${snapshotId}`)
      }

      const snapshot = stored as unknown as StoredSnapshot

      // Verify workflow ownership
      if (workflowId && snapshot.workflowId !== workflowId) {
        throw new Error(`Snapshot "${snapshotId}" does not belong to workflow "${workflowId}"`)
      }

      // Update event sequence to match snapshot
      eventSequence = snapshot.eventSequence

      if (events?.emit) {
        await events.emit({
          event: 'WorkflowSnapshot.restored',
          actor: source,
          object: `${ENTITY_TYPES.SNAPSHOT}/${snapshotId}`,
          result: { workflowId, eventSequence },
        })
      }

      return JSON.parse(snapshot.state)
    },

    /**
     * Get available snapshots
     */
    async getSnapshots(): Promise<Array<{ id: string; label?: string; createdAt: Date }>> {
      const where: Record<string, unknown> = {}
      if (workflowId) {
        where['workflowId'] = workflowId
      }

      const listOptions: { where?: Record<string, unknown> } = {}
      if (Object.keys(where).length > 0) {
        listOptions.where = where
      }

      const results = await db.list(ENTITY_TYPES.SNAPSHOT, listOptions)

      return (results as unknown as StoredSnapshot[])
        .map((s) => ({
          id: s.$id,
          ...(s.label && { label: s.label }),
          createdAt: new Date(s.createdAt),
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },

    /**
     * Get the current event sequence number
     */
    getEventSequence(): number {
      return eventSequence
    },
  }
}

/**
 * Create a simple in-memory DatabaseContext for testing
 *
 * @returns DatabaseContext implementation backed by in-memory storage
 */
export function createMemoryDatabaseContext(): EventSourcingContext {
  const events: StoredEvent[] = []
  const actions = new Map<string, StoredAction>()
  const artifacts = new Map<string, StoredArtifact>()
  const snapshots = new Map<string, StoredSnapshot>()
  let eventSequence = 0

  return {
    async recordEvent(eventType: string, data: unknown): Promise<void> {
      eventSequence++
      events.push({
        $id: generateId(),
        $type: ENTITY_TYPES.EVENT,
        eventType,
        data: JSON.stringify(data),
        timestamp: Date.now(),
        source: 'memory',
      })
    },

    async createAction(action: ActionData): Promise<void> {
      const actionId = generateId()
      const now = Date.now()
      actions.set(actionId, {
        $id: actionId,
        $type: ENTITY_TYPES.ACTION,
        actor: action.actor,
        object: action.object,
        action: action.action,
        status: action.status ?? 'pending',
        metadata: JSON.stringify(action.metadata ?? {}),
        createdAt: now,
        updatedAt: now,
      })
    },

    async completeAction(id: string, result: unknown): Promise<void> {
      const existing = actions.get(id)
      if (!existing) {
        throw new Error(`Action not found: ${id}`)
      }
      existing.status = 'completed'
      existing.result = JSON.stringify(result)
      existing.updatedAt = Date.now()
      existing.completedAt = Date.now()
    },

    async storeArtifact(artifact: ArtifactData): Promise<void> {
      artifacts.set(artifact.key, {
        $id: artifact.key,
        $type: ENTITY_TYPES.ARTIFACT,
        key: artifact.key,
        artifactType: artifact.type,
        sourceHash: artifact.sourceHash,
        content: JSON.stringify(artifact.content),
        ...(artifact.metadata && { metadata: JSON.stringify(artifact.metadata) }),
        createdAt: Date.now(),
      })
    },

    async getArtifact(key: string): Promise<unknown | null> {
      const stored = artifacts.get(key)
      if (!stored) {
        return null
      }
      return JSON.parse(stored.content)
    },

    async getEvents(queryOptions?: { since?: Date; limit?: number }): Promise<StoredEvent[]> {
      let result = [...events]

      if (queryOptions?.since) {
        const sinceTimestamp = queryOptions.since.getTime()
        result = result.filter((e) => e.timestamp >= sinceTimestamp)
      }

      result.sort((a, b) => a.timestamp - b.timestamp)

      if (queryOptions?.limit) {
        result = result.slice(0, queryOptions.limit)
      }

      return result
    },

    async replay(
      handler: (event: string, data: unknown) => Promise<void>,
      replayOptions?: { since?: Date }
    ): Promise<void> {
      const storedEvents = await this.getEvents(replayOptions)

      for (const event of storedEvents) {
        const data = JSON.parse(event.data)
        await handler(event.eventType, data)
      }
    },

    async createSnapshot(state: unknown, label?: string): Promise<string> {
      const snapshotId = `snap-memory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

      snapshots.set(snapshotId, {
        $id: snapshotId,
        $type: ENTITY_TYPES.SNAPSHOT,
        workflowId: 'memory',
        ...(label && { label }),
        state: JSON.stringify(state),
        eventSequence,
        createdAt: Date.now(),
      })

      return snapshotId
    },

    async restoreSnapshot(snapshotId: string): Promise<unknown> {
      const snapshot = snapshots.get(snapshotId)
      if (!snapshot) {
        throw new Error(`Snapshot not found: ${snapshotId}`)
      }

      eventSequence = snapshot.eventSequence
      return JSON.parse(snapshot.state)
    },

    async getSnapshots(): Promise<Array<{ id: string; label?: string; createdAt: Date }>> {
      return Array.from(snapshots.values())
        .map((s) => ({
          id: s.$id,
          ...(s.label && { label: s.label }),
          createdAt: new Date(s.createdAt),
        }))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },

    getEventSequence(): number {
      return eventSequence
    },
  }
}
