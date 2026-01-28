/**
 * WorkflowStateAdapter - Persistent workflow state using ai-database
 *
 * Provides durable storage for workflow state with:
 * - Optimistic locking via version control
 * - Step checkpoints for recovery
 * - Query by status and IDs
 * - Snapshots for point-in-time recovery
 *
 * @example
 * ```typescript
 * import { DB } from 'ai-database'
 * import { WorkflowStateAdapter } from 'ai-workflows/worker'
 *
 * const { db } = DB({ WorkflowState: { status: 'string' } })
 * const adapter = new WorkflowStateAdapter(db)
 *
 * await adapter.save('wf-123', {
 *   workflowId: 'wf-123',
 *   status: 'running',
 *   currentStep: 'process-payment',
 *   context: { orderId: 'order-1' },
 * })
 *
 * const state = await adapter.load('wf-123')
 * ```
 *
 * @packageDocumentation
 */

/**
 * Types for persisted workflow state
 */
export interface PersistedWorkflowState {
  workflowId: string
  version: number
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused'
  currentStep: string
  context: Record<string, unknown>
  checkpoints: Map<string, StepCheckpoint>
  history: WorkflowHistoryEntry[]
  input?: unknown
  output?: unknown
  error?: string
  createdAt: Date
  updatedAt: Date
}

export interface StepCheckpoint {
  stepId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: unknown
  error?: string
  attempt: number
  startedAt?: Date
  completedAt?: Date
}

export interface WorkflowHistoryEntry {
  timestamp: number
  type: 'event' | 'schedule' | 'transition' | 'action' | 'checkpoint'
  name: string
  data?: unknown
}

/**
 * Snapshot metadata
 */
export interface SnapshotInfo {
  id: string
  label?: string
  createdAt: Date
}

/**
 * Database connection interface
 * Compatible with ai-database DB() result or any similar provider
 */
export interface DatabaseConnection {
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
  search?: (
    type: string,
    query: string,
    options?: Record<string, unknown>
  ) => Promise<Record<string, unknown>[]>
  emit?: (event: string, data: unknown) => Promise<{ id: string }>
  clear?: () => void
}

/**
 * Serialized state format for storage
 * Includes index signature for compatibility with Record<string, unknown>
 */
interface SerializedState {
  [key: string]: unknown
  $id?: string
  $type?: string
  workflowId: string
  version: number
  status: string
  currentStep: string
  context: string // JSON serialized
  checkpoints: string // JSON serialized Map entries
  history: string // JSON serialized
  input?: string // JSON serialized
  output?: string // JSON serialized
  error?: string
  createdAt: string // ISO string
  updatedAt: string // ISO string
}

/**
 * Serialized snapshot format
 * Includes index signature for compatibility with Record<string, unknown>
 */
interface SerializedSnapshot {
  [key: string]: unknown
  $id?: string
  $type?: string
  snapshotId: string
  workflowId: string
  label?: string
  state: string // JSON serialized full state
  createdAt: string
}

/**
 * WorkflowStateAdapter - Persists workflow state using ai-database
 *
 * Provides optimistic locking, checkpoints, and snapshot recovery.
 */
export class WorkflowStateAdapter {
  private db: DatabaseConnection
  private readonly STATE_TYPE = 'WorkflowState'
  private readonly CHECKPOINT_TYPE = 'WorkflowCheckpoint'
  private readonly SNAPSHOT_TYPE = 'WorkflowSnapshot'

  /**
   * Create a new WorkflowStateAdapter
   *
   * @param database - Database connection (from ai-database DB() or compatible provider)
   * @throws Error if database connection is null/undefined
   */
  constructor(database: DatabaseConnection) {
    if (!database) {
      throw new Error('Database connection is required')
    }
    this.db = database
  }

  /**
   * Save workflow state to database
   *
   * Creates a new record if not exists, updates existing if found.
   * Automatically increments version and updates timestamps.
   *
   * @param workflowId - Unique workflow identifier
   * @param state - Partial state to save (merged with existing)
   */
  async save(workflowId: string, state: Partial<PersistedWorkflowState>): Promise<void> {
    const existing = await this.loadRaw(workflowId)
    const now = new Date()

    if (existing) {
      // Update existing state
      const updated = this.mergeState(existing, state)
      updated.version = (existing.version || 0) + 1
      updated.updatedAt = now

      const serialized = this.serialize(updated)
      await this.db.update(this.STATE_TYPE, workflowId, serialized)

      // Emit state updated event
      await this.emitEvent('WorkflowState.updated', {
        workflowId,
        version: updated.version,
        status: updated.status,
      })
    } else {
      // Create new state
      const newState: PersistedWorkflowState = {
        workflowId,
        version: state.version ?? 1,
        status: state.status ?? 'pending',
        currentStep: state.currentStep ?? '',
        context: state.context ?? {},
        checkpoints: state.checkpoints ?? new Map(),
        history: state.history ?? [],
        ...(state.input !== undefined && { input: state.input }),
        ...(state.output !== undefined && { output: state.output }),
        ...(state.error !== undefined && { error: state.error }),
        createdAt: now,
        updatedAt: now,
      }

      const serialized = this.serialize(newState)
      await this.db.create(this.STATE_TYPE, serialized, workflowId)

      // Emit state created event
      await this.emitEvent('WorkflowState.created', {
        workflowId,
        version: newState.version,
        status: newState.status,
      })
    }
  }

  /**
   * Load workflow state from database
   *
   * @param workflowId - Workflow identifier to load
   * @returns The persisted state or null if not found
   */
  async load(workflowId: string): Promise<PersistedWorkflowState | null> {
    return this.loadRaw(workflowId)
  }

  /**
   * Save a step checkpoint
   *
   * Checkpoints are stored as part of the workflow state.
   *
   * @param workflowId - Workflow identifier
   * @param stepId - Step identifier
   * @param checkpoint - Checkpoint data
   */
  async checkpoint(workflowId: string, stepId: string, checkpoint: StepCheckpoint): Promise<void> {
    const state = await this.loadRaw(workflowId)

    if (!state) {
      // Create minimal state with checkpoint
      await this.save(workflowId, {
        workflowId,
        status: 'running',
        checkpoints: new Map([[stepId, checkpoint]]),
      })
      return
    }

    // Update checkpoint in existing state
    const checkpoints = state.checkpoints ?? new Map()
    checkpoints.set(stepId, checkpoint)

    await this.save(workflowId, { checkpoints })
  }

  /**
   * Get a step checkpoint
   *
   * @param workflowId - Workflow identifier
   * @param stepId - Step identifier
   * @returns The checkpoint or null if not found
   */
  async getCheckpoint(workflowId: string, stepId: string): Promise<StepCheckpoint | null> {
    const state = await this.loadRaw(workflowId)
    if (!state || !state.checkpoints) {
      return null
    }
    return state.checkpoints.get(stepId) ?? null
  }

  /**
   * Update state with optimistic locking
   *
   * Only updates if the current version matches expectedVersion.
   * Returns false if version mismatch (concurrent modification detected).
   *
   * @param workflowId - Workflow identifier
   * @param expectedVersion - Expected current version
   * @param state - State updates to apply
   * @returns true if updated, false if version mismatch
   */
  async updateWithVersion(
    workflowId: string,
    expectedVersion: number,
    state: Partial<PersistedWorkflowState>
  ): Promise<boolean> {
    const existing = await this.loadRaw(workflowId)

    if (!existing) {
      return false
    }

    if (existing.version !== expectedVersion) {
      return false
    }

    // Version matches, perform update
    await this.save(workflowId, state)
    return true
  }

  /**
   * Query workflows by status
   *
   * @param status - Status to filter by
   * @returns Array of workflows matching the status
   */
  async queryByStatus(status: PersistedWorkflowState['status']): Promise<PersistedWorkflowState[]> {
    try {
      const results = await this.db.list(this.STATE_TYPE, {
        where: { status },
      })

      return results.map((r) => this.deserialize(r as unknown as SerializedState))
    } catch {
      // Fallback: list all and filter
      const all = await this.db.list(this.STATE_TYPE)
      return all
        .map((r) => this.deserialize(r as unknown as SerializedState))
        .filter((s) => s.status === status)
    }
  }

  /**
   * Query workflows by IDs (batch query)
   *
   * @param workflowIds - Array of workflow IDs to query
   * @returns Array of found workflows (non-existent IDs are excluded)
   */
  async queryByIds(workflowIds: string[]): Promise<PersistedWorkflowState[]> {
    const results: PersistedWorkflowState[] = []

    for (const id of workflowIds) {
      const state = await this.loadRaw(id)
      if (state) {
        results.push(state)
      }
    }

    return results
  }

  /**
   * Delete a workflow and its checkpoints
   *
   * @param workflowId - Workflow identifier to delete
   * @returns true if deleted, false if not found
   */
  async delete(workflowId: string): Promise<boolean> {
    const existing = await this.loadRaw(workflowId)

    if (!existing) {
      return false
    }

    await this.db.delete(this.STATE_TYPE, workflowId)

    // Emit deletion event
    await this.emitEvent('WorkflowState.deleted', { workflowId })

    return true
  }

  /**
   * List all workflows with pagination
   *
   * @param options - Pagination options (limit, offset)
   * @returns Array of workflows
   */
  async listAll(options?: { limit?: number; offset?: number }): Promise<PersistedWorkflowState[]> {
    const results = await this.db.list(this.STATE_TYPE, {
      ...(options?.limit !== undefined && { limit: options.limit }),
      ...(options?.offset !== undefined && { offset: options.offset }),
    })

    return results.map((r) => this.deserialize(r as unknown as SerializedState))
  }

  /**
   * Create a snapshot of current workflow state
   *
   * Snapshots allow point-in-time recovery of workflow state.
   *
   * @param workflowId - Workflow identifier
   * @param label - Optional human-readable label
   * @returns Snapshot ID
   */
  async createSnapshot(workflowId: string, label?: string): Promise<string> {
    const state = await this.loadRaw(workflowId)

    if (!state) {
      throw new Error(`Workflow "${workflowId}" not found`)
    }

    const snapshotId = `snap-${workflowId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const snapshot: SerializedSnapshot = {
      snapshotId,
      workflowId,
      ...(label !== undefined && { label }),
      state: JSON.stringify(this.serialize(state)),
      createdAt: new Date().toISOString(),
    }

    await this.db.create(
      this.SNAPSHOT_TYPE,
      snapshot as unknown as Record<string, unknown>,
      snapshotId
    )

    return snapshotId
  }

  /**
   * Restore workflow state from a snapshot
   *
   * @param workflowId - Workflow identifier
   * @param snapshotId - Snapshot ID to restore from
   */
  async restoreSnapshot(workflowId: string, snapshotId: string): Promise<void> {
    const snapshot = (await this.db.get(
      this.SNAPSHOT_TYPE,
      snapshotId
    )) as unknown as SerializedSnapshot | null

    if (!snapshot) {
      throw new Error(`Snapshot "${snapshotId}" not found`)
    }

    if (snapshot.workflowId !== workflowId) {
      throw new Error(`Snapshot "${snapshotId}" does not belong to workflow "${workflowId}"`)
    }

    const restoredState = JSON.parse(snapshot.state) as SerializedState
    const state = this.deserialize(restoredState)

    // Save restored state with incremented version
    await this.db.update(
      this.STATE_TYPE,
      workflowId,
      this.serialize({
        ...state,
        version: state.version + 1,
        updatedAt: new Date(),
      })
    )

    // Emit restoration event
    await this.emitEvent('WorkflowState.restored', {
      workflowId,
      snapshotId,
    })
  }

  /**
   * Get all snapshots for a workflow
   *
   * @param workflowId - Workflow identifier
   * @returns Array of snapshot metadata
   */
  async getSnapshots(workflowId: string): Promise<SnapshotInfo[]> {
    const all = await this.db.list(this.SNAPSHOT_TYPE)

    return all
      .map((r) => r as unknown as SerializedSnapshot)
      .filter((s) => s.workflowId === workflowId)
      .map((s) => ({
        id: s.snapshotId,
        ...(s.label !== undefined && { label: s.label }),
        createdAt: new Date(s.createdAt),
      }))
  }

  // ==========================================================================
  // Private helpers
  // ==========================================================================

  /**
   * Load raw state from database
   */
  private async loadRaw(workflowId: string): Promise<PersistedWorkflowState | null> {
    const data = await this.db.get(this.STATE_TYPE, workflowId)

    if (!data) {
      return null
    }

    return this.deserialize(data as unknown as SerializedState)
  }

  /**
   * Merge partial state into existing state
   */
  private mergeState(
    existing: PersistedWorkflowState,
    updates: Partial<PersistedWorkflowState>
  ): PersistedWorkflowState {
    return {
      ...existing,
      ...updates,
      // Deep merge context
      context: {
        ...existing.context,
        ...(updates.context ?? {}),
      },
      // Merge checkpoints (updates override)
      checkpoints: updates.checkpoints ?? existing.checkpoints,
      // Append history if provided
      history: updates.history ?? existing.history,
    }
  }

  /**
   * Serialize state for database storage
   */
  private serialize(state: PersistedWorkflowState): SerializedState {
    return {
      workflowId: state.workflowId,
      version: state.version,
      status: state.status,
      currentStep: state.currentStep,
      context: JSON.stringify(state.context),
      checkpoints: JSON.stringify(state.checkpoints ? Array.from(state.checkpoints.entries()) : []),
      history: JSON.stringify(state.history),
      ...(state.input !== undefined && { input: JSON.stringify(state.input) }),
      ...(state.output !== undefined && { output: JSON.stringify(state.output) }),
      ...(state.error !== undefined && { error: state.error }),
      createdAt: state.createdAt.toISOString(),
      updatedAt: state.updatedAt.toISOString(),
    }
  }

  /**
   * Deserialize state from database format
   */
  private deserialize(data: SerializedState): PersistedWorkflowState {
    let checkpointsMap: Map<string, StepCheckpoint>

    try {
      const entries = JSON.parse(data.checkpoints || '[]') as Array<[string, StepCheckpoint]>
      checkpointsMap = new Map(
        entries.map(([key, cp]) => [
          key,
          {
            ...cp,
            ...(cp.startedAt !== undefined && { startedAt: new Date(cp.startedAt) }),
            ...(cp.completedAt !== undefined && { completedAt: new Date(cp.completedAt) }),
          },
        ])
      )
    } catch {
      checkpointsMap = new Map()
    }

    return {
      workflowId: data.workflowId,
      version: data.version,
      status: data.status as PersistedWorkflowState['status'],
      currentStep: data.currentStep,
      context: JSON.parse(data.context || '{}'),
      checkpoints: checkpointsMap,
      history: JSON.parse(data.history || '[]'),
      ...(data.input !== undefined && { input: JSON.parse(data.input) }),
      ...(data.output !== undefined && { output: JSON.parse(data.output) }),
      ...(data.error !== undefined && { error: data.error }),
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    }
  }

  /**
   * Emit an event to the database (if supported)
   */
  private async emitEvent(event: string, data: unknown): Promise<void> {
    if (this.db.emit) {
      try {
        await this.db.emit(event, data)
      } catch {
        // Event emission is best-effort
      }
    }
  }
}
