/**
 * Actions API tests
 *
 * Tests the public actions API for durable execution of long-running operations.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import {
  ActionStatuses,
  isTerminal,
  isInProgress,
  canRetry,
  canCancel,
  getProgressPercent,
  formatActionStatus,
} from '../src/actions.js'

describe('Actions API', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  const schema = {
    Lead: {
      name: 'string',
      email: 'string',
      score: 'number',
    },
    Report: {
      title: 'string',
      format: 'string',
    },
  } as const

  describe('ActionStatuses constants', () => {
    it('exports standard action status constants', () => {
      expect(ActionStatuses.PENDING).toBe('pending')
      expect(ActionStatuses.ACTIVE).toBe('active')
      expect(ActionStatuses.COMPLETED).toBe('completed')
      expect(ActionStatuses.FAILED).toBe('failed')
      expect(ActionStatuses.CANCELLED).toBe('cancelled')
    })
  })

  describe('Status helper functions', () => {
    it('isTerminal identifies completed/failed/cancelled', () => {
      expect(isTerminal('pending')).toBe(false)
      expect(isTerminal('active')).toBe(false)
      expect(isTerminal('completed')).toBe(true)
      expect(isTerminal('failed')).toBe(true)
      expect(isTerminal('cancelled')).toBe(true)
    })

    it('isInProgress identifies pending/active', () => {
      expect(isInProgress('pending')).toBe(true)
      expect(isInProgress('active')).toBe(true)
      expect(isInProgress('completed')).toBe(false)
      expect(isInProgress('failed')).toBe(false)
      expect(isInProgress('cancelled')).toBe(false)
    })

    it('canRetry only returns true for failed', () => {
      expect(canRetry('pending')).toBe(false)
      expect(canRetry('active')).toBe(false)
      expect(canRetry('completed')).toBe(false)
      expect(canRetry('failed')).toBe(true)
      expect(canRetry('cancelled')).toBe(false)
    })

    it('canCancel returns true for pending/active', () => {
      expect(canCancel('pending')).toBe(true)
      expect(canCancel('active')).toBe(true)
      expect(canCancel('completed')).toBe(false)
      expect(canCancel('failed')).toBe(false)
      expect(canCancel('cancelled')).toBe(false)
    })
  })

  describe('getProgressPercent', () => {
    it('calculates percentage correctly', () => {
      expect(getProgressPercent({ progress: 50, total: 100 })).toBe(50)
      expect(getProgressPercent({ progress: 33, total: 100 })).toBe(33)
      expect(getProgressPercent({ progress: 1, total: 3 })).toBe(33)
      expect(getProgressPercent({ progress: 100, total: 100 })).toBe(100)
    })

    it('handles edge cases', () => {
      expect(getProgressPercent({ total: 0 })).toBe(0)
      expect(getProgressPercent({})).toBe(0)
      expect(getProgressPercent({ progress: 50 })).toBe(0)
    })
  })

  describe('formatActionStatus', () => {
    it('formats pending status', () => {
      const result = formatActionStatus({
        status: 'pending',
        activity: 'generating',
        object: 'Lead',
      })
      expect(result).toContain('pending')
      expect(result).toContain('generating')
      expect(result).toContain('Lead')
    })

    it('formats active status with progress', () => {
      const result = formatActionStatus({
        status: 'active',
        activity: 'generating',
        object: 'Lead',
        progress: 50,
        total: 100,
      })
      expect(result).toContain('generating')
      expect(result).toContain('Lead')
      expect(result).toContain('50%')
    })

    it('formats completed status with result', () => {
      const result = formatActionStatus({
        status: 'completed',
        result: { processed: 100 },
      })
      expect(result).toContain('completed')
      expect(result).toContain('100')
    })

    it('formats failed status with error', () => {
      const result = formatActionStatus({
        status: 'failed',
        error: 'Connection timeout',
      })
      expect(result).toContain('failed')
      expect(result).toContain('Connection timeout')
    })

    it('formats cancelled status', () => {
      const result = formatActionStatus({
        status: 'cancelled',
      })
      expect(result).toBe('cancelled')
    })
  })

  describe('actions.create()', () => {
    it('creates an action with pending status', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        actor: 'system',
        action: 'generate',
        object: 'Lead',
        objectData: { count: 100 },
        total: 100,
      })

      expect(action.id).toBeDefined()
      expect(action.status).toBe('pending')
      expect(action.action).toBe('generate')
      expect(action.total).toBe(100)
      expect(action.progress).toBe(0)
    })

    it('auto-conjugates verb forms', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        actor: 'system',
        action: 'generate',
        object: 'Lead',
      })

      // The action should have conjugated forms
      expect(action.action).toBe('generate')
      expect(action.act).toBe('generates')
      expect(action.activity).toBe('generating')
    })

    it('supports legacy type/data format', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        type: 'batch-process',
        data: { count: 10 },
        total: 10,
      })

      expect(action.id).toBeDefined()
      expect(action.type).toBe('batch-process')
      expect(action.status).toBe('pending')
    })
  })

  describe('actions.get()', () => {
    it('retrieves an action by ID', async () => {
      const { actions } = DB(schema)

      const created = await actions.create({
        actor: 'system',
        action: 'process',
        object: 'Lead',
      })

      const retrieved = await actions.get(created.id)

      expect(retrieved).not.toBeNull()
      expect(retrieved?.id).toBe(created.id)
      expect(retrieved?.action).toBe('process')
    })

    it('returns null for non-existent action', async () => {
      const { actions } = DB(schema)

      const retrieved = await actions.get('nonexistent-id')
      expect(retrieved).toBeNull()
    })
  })

  describe('actions.update()', () => {
    it('updates action status to active', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        actor: 'system',
        action: 'generate',
        object: 'Lead',
      })

      const updated = await actions.update(action.id, { status: 'active' })

      expect(updated.status).toBe('active')
      expect(updated.startedAt).toBeInstanceOf(Date)
    })

    it('updates action progress', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        actor: 'system',
        action: 'generate',
        object: 'Lead',
        total: 100,
      })

      await actions.update(action.id, { status: 'active' })
      const updated = await actions.update(action.id, { progress: 50 })

      expect(updated.progress).toBe(50)
    })

    it('marks action as completed with result', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        actor: 'system',
        action: 'generate',
        object: 'Lead',
        total: 100,
      })

      await actions.update(action.id, { status: 'active' })
      const completed = await actions.update(action.id, {
        status: 'completed',
        result: { generated: 100 },
      })

      expect(completed.status).toBe('completed')
      expect(completed.completedAt).toBeInstanceOf(Date)
      expect(completed.result).toEqual({ generated: 100 })
    })

    it('marks action as failed with error', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        actor: 'system',
        action: 'generate',
        object: 'Lead',
      })

      await actions.update(action.id, { status: 'active' })
      const failed = await actions.update(action.id, {
        status: 'failed',
        error: 'Connection timeout',
      })

      expect(failed.status).toBe('failed')
      expect(failed.completedAt).toBeInstanceOf(Date)
      expect(failed.error).toBe('Connection timeout')
    })
  })

  describe('actions.list()', () => {
    it('lists all actions', async () => {
      const { actions } = DB(schema)

      await actions.create({ actor: 'system', action: 'task1', object: 'Lead' })
      await actions.create({ actor: 'system', action: 'task2', object: 'Report' })

      const all = await actions.list({})
      expect(all.length).toBeGreaterThanOrEqual(2)
    })

    it('filters by status', async () => {
      const { actions } = DB(schema)

      const action1 = await actions.create({ actor: 'system', action: 'task1', object: 'Lead' })
      const action2 = await actions.create({ actor: 'system', action: 'task2', object: 'Report' })

      await actions.update(action1.id, { status: 'completed' })

      const pending = await actions.list({ status: 'pending' })
      const completed = await actions.list({ status: 'completed' })

      expect(pending.some((a) => a.id === action2.id)).toBe(true)
      expect(completed.some((a) => a.id === action1.id)).toBe(true)
    })

    it('filters by action type', async () => {
      const { actions } = DB(schema)

      await actions.create({ actor: 'system', action: 'generate', object: 'Lead' })
      await actions.create({ actor: 'system', action: 'generate', object: 'Report' })
      await actions.create({ actor: 'system', action: 'export', object: 'Report' })

      const generateActions = await actions.list({ action: 'generate' })
      expect(generateActions.length).toBeGreaterThanOrEqual(2)
      expect(generateActions.every((a) => a.action === 'generate')).toBe(true)
    })
  })

  describe('actions.retry()', () => {
    it('retries a failed action', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        actor: 'system',
        action: 'process',
        object: 'Lead',
      })

      await actions.update(action.id, { status: 'active' })
      await actions.update(action.id, { status: 'failed', error: 'Timeout' })

      const retried = await actions.retry(action.id)

      expect(retried.status).toBe('pending')
      expect(retried.error).toBeUndefined()
    })

    it('throws error when retrying non-failed action', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        actor: 'system',
        action: 'process',
        object: 'Lead',
      })

      await expect(actions.retry(action.id)).rejects.toThrow('Can only retry failed actions')
    })
  })

  describe('actions.cancel()', () => {
    it('cancels a pending action', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        actor: 'system',
        action: 'process',
        object: 'Lead',
      })

      await actions.cancel(action.id)

      const cancelled = await actions.get(action.id)
      expect(cancelled?.status).toBe('cancelled')
    })

    it('cancels an active action', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        actor: 'system',
        action: 'process',
        object: 'Lead',
      })

      await actions.update(action.id, { status: 'active' })
      await actions.cancel(action.id)

      const cancelled = await actions.get(action.id)
      expect(cancelled?.status).toBe('cancelled')
    })

    it('throws error when cancelling completed action', async () => {
      const { actions } = DB(schema)

      const action = await actions.create({
        actor: 'system',
        action: 'process',
        object: 'Lead',
      })

      await actions.update(action.id, { status: 'completed' })

      await expect(actions.cancel(action.id)).rejects.toThrow('Cannot cancel finished action')
    })
  })

  describe('actions.conjugate()', () => {
    it('conjugates standard verbs', () => {
      const { actions } = DB(schema)

      const create = actions.conjugate('create')
      expect(create.action).toBe('create')
      expect(create.act).toBe('creates')
      expect(create.activity).toBe('creating')
      expect(create.actor).toBe('creator')
    })

    it('conjugates custom verbs', () => {
      const { actions } = DB(schema)

      const generate = actions.conjugate('generate')
      expect(generate.action).toBe('generate')
      expect(generate.act).toBe('generates')
      expect(generate.activity).toBe('generating')
    })

    it('conjugates irregular verbs', () => {
      const { actions } = DB(schema)

      const publish = actions.conjugate('publish')
      expect(publish.action).toBe('publish')
      expect(publish.act).toBe('publishes')
      expect(publish.activity).toBe('publishing')
      expect(publish.actor).toBe('publisher')
    })
  })
})

describe('Actions API - Usage examples', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  /**
   * Example: Background job tracking
   *
   * Track a long-running background job with progress updates.
   */
  it('example: background job tracking', async () => {
    const { actions } = DB({
      Lead: { name: 'string', email: 'string' },
    } as const)

    // Create the action
    const action = await actions.create({
      actor: 'worker:lead-generator',
      action: 'generate',
      object: 'Lead',
      objectData: { template: 'enterprise' },
      total: 100,
    })

    expect(action.status).toBe('pending')

    // Start processing
    await actions.update(action.id, { status: 'active' })

    // Simulate progress updates
    for (let i = 25; i <= 100; i += 25) {
      await actions.update(action.id, { progress: i })
    }

    // Complete the action
    const completed = await actions.update(action.id, {
      status: 'completed',
      result: { generatedCount: 100 },
    })

    expect(completed.status).toBe('completed')
    expect(completed.result).toEqual({ generatedCount: 100 })
  })

  /**
   * Example: Error handling and retry
   *
   * Handle failures gracefully and retry operations.
   */
  it('example: error handling and retry', async () => {
    const { actions } = DB({
      Email: { to: 'string', subject: 'string' },
    } as const)

    const action = await actions.create({
      actor: 'worker:email-sender',
      action: 'send',
      object: 'Email',
      objectData: { to: 'user@example.com' },
    })

    // Start processing
    await actions.update(action.id, { status: 'active' })

    // Simulate failure
    await actions.update(action.id, {
      status: 'failed',
      error: 'SMTP connection timeout',
    })

    // Check if we can retry
    const failed = await actions.get(action.id)
    expect(canRetry(failed!.status)).toBe(true)

    // Retry the action
    const retried = await actions.retry(action.id)
    expect(retried.status).toBe('pending')

    // Process again successfully
    await actions.update(action.id, { status: 'active' })
    await actions.update(action.id, { status: 'completed' })

    const final = await actions.get(action.id)
    expect(final?.status).toBe('completed')
  })

  /**
   * Example: Monitoring active jobs
   *
   * Dashboard for monitoring all running actions.
   */
  it('example: monitoring active jobs', async () => {
    const { actions } = DB({
      Lead: { name: 'string' },
      Report: { title: 'string' },
    } as const)

    // Create multiple actions
    const leadGen = await actions.create({
      actor: 'system',
      action: 'generate',
      object: 'Lead',
      total: 1000,
    })

    const reportExport = await actions.create({
      actor: 'user:admin',
      action: 'export',
      object: 'Report',
      total: 50,
    })

    // Start them
    await actions.update(leadGen.id, { status: 'active', progress: 250 })
    await actions.update(reportExport.id, { status: 'active', progress: 10 })

    // Monitor all active actions
    const active = await actions.list({ status: 'active' })

    expect(active.length).toBe(2)

    // Format status for display
    for (const action of active) {
      const display = formatActionStatus(action)
      expect(display).toContain('%')
    }

    // Check progress percentages
    const leadAction = active.find((a) => a.object === 'Lead')
    expect(getProgressPercent(leadAction!)).toBe(25)

    const reportAction = active.find((a) => a.object === 'Report')
    expect(getProgressPercent(reportAction!)).toBe(20)
  })

  /**
   * Example: User-initiated cancellation
   *
   * Allow users to cancel pending operations.
   */
  it('example: user-initiated cancellation', async () => {
    const { actions } = DB({
      Export: { format: 'string' },
    } as const)

    // User starts an export
    const action = await actions.create({
      actor: 'user:john',
      action: 'export',
      object: 'Export',
      objectData: { format: 'csv' },
      total: 10000,
    })

    await actions.update(action.id, { status: 'active', progress: 100 })

    // User changes their mind
    expect(canCancel(action.status)).toBe(true) // Can still cancel pending
    const active = await actions.get(action.id)
    expect(canCancel(active!.status)).toBe(true) // Can still cancel active

    await actions.cancel(action.id)

    const cancelled = await actions.get(action.id)
    expect(cancelled?.status).toBe('cancelled')
    expect(canCancel(cancelled!.status)).toBe(false) // Cannot cancel again
  })

  /**
   * Example: Action lifecycle events
   *
   * Actions emit events that can be subscribed to.
   */
  it('example: action lifecycle events', async () => {
    const { actions, events } = DB({
      Job: { name: 'string' },
    } as const)

    const receivedEvents: string[] = []

    // Subscribe to action events
    await new Promise((resolve) => setTimeout(resolve, 10))

    events.on('Action.*', (event) => {
      receivedEvents.push(event.event)
    })

    await new Promise((resolve) => setTimeout(resolve, 10))

    // Create and process an action
    const action = await actions.create({
      actor: 'system',
      action: 'process',
      object: 'Job',
    })

    await actions.update(action.id, { status: 'active' })
    await actions.update(action.id, { status: 'completed' })

    await new Promise((resolve) => setTimeout(resolve, 10))

    // Verify events were emitted
    expect(receivedEvents).toContain('Action.created')
    expect(receivedEvents).toContain('Action.started')
    expect(receivedEvents).toContain('Action.completed')
  })
})
