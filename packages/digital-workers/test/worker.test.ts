/**
 * Worker Export Tests for digital-workers (RED phase)
 *
 * Tests the /worker export which provides DigitalWorkersService as a WorkerEntrypoint.
 * Uses @cloudflare/vitest-pool-workers for real Workers environment testing.
 *
 * NO MOCKS - tests use real AI Gateway binding for cached responses
 * and real Durable Objects for worker state management.
 *
 * These tests will FAIL until src/worker.ts is implemented (GREEN phase).
 *
 * The WorkerEntrypoint provides:
 * - Worker lifecycle management (spawn, terminate, pause, resume)
 * - Worker communication/messaging
 * - Worker state management
 * - Worker coordination patterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { env } from 'cloudflare:test'

// These imports will fail until worker.ts is implemented
import { DigitalWorkersService, DigitalWorkersServiceCore } from '../src/worker.js'

// =============================================================================
// Type Definitions for Expected Service Interface
// =============================================================================

/**
 * Worker instance state
 */
interface WorkerInstance {
  id: string
  name: string
  status: WorkerInstanceStatus
  type: 'agent' | 'human'
  tier?: string
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, unknown>
}

/**
 * Worker instance status
 */
type WorkerInstanceStatus = 'spawning' | 'running' | 'paused' | 'terminated' | 'error'

/**
 * Message sent between workers
 */
interface WorkerMessage<T = unknown> {
  id: string
  from: string
  to: string
  type: string
  payload: T
  timestamp: Date
  acknowledged?: boolean
}

/**
 * Worker spawn options
 */
interface SpawnOptions {
  name?: string
  type?: 'agent' | 'human'
  tier?: string
  metadata?: Record<string, unknown>
  timeout?: number
}

/**
 * Worker coordination task
 */
interface CoordinationTask<T = unknown> {
  id: string
  type: 'fanout' | 'pipeline' | 'race' | 'consensus'
  workers: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: T
  errors?: Error[]
}

// =============================================================================
// DigitalWorkersServiceCore (RpcTarget) Tests
// =============================================================================

describe('DigitalWorkersServiceCore (RpcTarget)', () => {
  let core: InstanceType<typeof DigitalWorkersServiceCore>

  beforeEach(() => {
    core = new DigitalWorkersServiceCore(env)
  })

  describe('constructor', () => {
    it('creates a new DigitalWorkersServiceCore instance', () => {
      expect(core).toBeInstanceOf(DigitalWorkersServiceCore)
    })

    it('accepts env with AI and DO bindings', () => {
      const serviceWithEnv = new DigitalWorkersServiceCore(env)
      expect(serviceWithEnv).toBeDefined()
    })

    it('extends RpcTarget for RPC communication', () => {
      expect(core.constructor.name).toBe('DigitalWorkersServiceCore')
    })
  })

  // ===========================================================================
  // Worker Lifecycle Management
  // ===========================================================================

  describe('spawn()', () => {
    it('creates a new worker instance with auto-generated ID', async () => {
      const worker = await core.spawn()

      expect(worker).toBeDefined()
      expect(worker.id).toBeDefined()
      expect(worker.id.length).toBeGreaterThan(0)
      expect(worker.status).toBe('running')
      expect(worker.createdAt).toBeInstanceOf(Date)
    })

    it('creates a worker with custom name', async () => {
      const worker = await core.spawn({ name: 'test-worker' })

      expect(worker.name).toBe('test-worker')
    })

    it('creates an agent worker type by default', async () => {
      const worker = await core.spawn()

      expect(worker.type).toBe('agent')
    })

    it('creates a human worker type when specified', async () => {
      const worker = await core.spawn({ type: 'human' })

      expect(worker.type).toBe('human')
    })

    it('assigns capability tier when specified', async () => {
      const worker = await core.spawn({ tier: 'generative' })

      expect(worker.tier).toBe('generative')
    })

    it('stores metadata on the worker', async () => {
      const worker = await core.spawn({
        metadata: { department: 'engineering', role: 'reviewer' },
      })

      expect(worker.metadata).toEqual({ department: 'engineering', role: 'reviewer' })
    })

    it('sets spawning status initially before running', async () => {
      // This tests the state transition
      const worker = await core.spawn()

      // Worker should be running after spawn completes
      expect(['spawning', 'running']).toContain(worker.status)
    })
  })

  describe('terminate()', () => {
    let workerId: string

    beforeEach(async () => {
      const worker = await core.spawn({ name: 'to-terminate' })
      workerId = worker.id
    })

    it('terminates a running worker', async () => {
      const result = await core.terminate(workerId)

      expect(result).toBe(true)
    })

    it('sets worker status to terminated', async () => {
      await core.terminate(workerId)
      const worker = await core.getState(workerId)

      expect(worker?.status).toBe('terminated')
    })

    it('returns false for non-existent worker', async () => {
      const result = await core.terminate('nonexistent-worker-id')

      expect(result).toBe(false)
    })

    it('cannot terminate an already terminated worker', async () => {
      await core.terminate(workerId)
      const result = await core.terminate(workerId)

      // Should return false or throw - implementation dependent
      expect(result).toBe(false)
    })

    it('updates the updatedAt timestamp', async () => {
      const before = await core.getState(workerId)
      await core.terminate(workerId)
      const after = await core.getState(workerId)

      expect(after?.updatedAt.getTime()).toBeGreaterThanOrEqual(before!.updatedAt.getTime())
    })
  })

  describe('pause()', () => {
    let workerId: string

    beforeEach(async () => {
      const worker = await core.spawn({ name: 'to-pause' })
      workerId = worker.id
    })

    it('pauses a running worker', async () => {
      const result = await core.pause(workerId)

      expect(result).toBe(true)
    })

    it('sets worker status to paused', async () => {
      await core.pause(workerId)
      const worker = await core.getState(workerId)

      expect(worker?.status).toBe('paused')
    })

    it('returns false for non-existent worker', async () => {
      const result = await core.pause('nonexistent-worker-id')

      expect(result).toBe(false)
    })

    it('cannot pause a terminated worker', async () => {
      await core.terminate(workerId)
      const result = await core.pause(workerId)

      expect(result).toBe(false)
    })

    it('is idempotent - pausing already paused worker succeeds', async () => {
      await core.pause(workerId)
      const result = await core.pause(workerId)

      expect(result).toBe(true)
    })
  })

  describe('resume()', () => {
    let workerId: string

    beforeEach(async () => {
      const worker = await core.spawn({ name: 'to-resume' })
      workerId = worker.id
      await core.pause(workerId)
    })

    it('resumes a paused worker', async () => {
      const result = await core.resume(workerId)

      expect(result).toBe(true)
    })

    it('sets worker status back to running', async () => {
      await core.resume(workerId)
      const worker = await core.getState(workerId)

      expect(worker?.status).toBe('running')
    })

    it('returns false for non-existent worker', async () => {
      const result = await core.resume('nonexistent-worker-id')

      expect(result).toBe(false)
    })

    it('cannot resume a terminated worker', async () => {
      await core.terminate(workerId)
      const result = await core.resume(workerId)

      expect(result).toBe(false)
    })

    it('is idempotent - resuming already running worker succeeds', async () => {
      await core.resume(workerId)
      const result = await core.resume(workerId)

      expect(result).toBe(true)
    })
  })

  // ===========================================================================
  // Worker Communication / Messaging
  // ===========================================================================

  describe('send()', () => {
    let worker1Id: string
    let worker2Id: string

    beforeEach(async () => {
      const worker1 = await core.spawn({ name: 'sender' })
      const worker2 = await core.spawn({ name: 'receiver' })
      worker1Id = worker1.id
      worker2Id = worker2.id
    })

    it('sends a message between workers', async () => {
      const message = await core.send(worker1Id, worker2Id, 'greeting', { text: 'hello' })

      expect(message).toBeDefined()
      expect(message.id).toBeDefined()
      expect(message.from).toBe(worker1Id)
      expect(message.to).toBe(worker2Id)
      expect(message.type).toBe('greeting')
      expect(message.payload).toEqual({ text: 'hello' })
    })

    it('includes timestamp on message', async () => {
      const message = await core.send(worker1Id, worker2Id, 'test', {})

      expect(message.timestamp).toBeInstanceOf(Date)
    })

    it('throws when sender does not exist', async () => {
      await expect(core.send('nonexistent', worker2Id, 'test', {})).rejects.toThrow()
    })

    it('throws when receiver does not exist', async () => {
      await expect(core.send(worker1Id, 'nonexistent', 'test', {})).rejects.toThrow()
    })

    it('cannot send from a terminated worker', async () => {
      await core.terminate(worker1Id)

      await expect(core.send(worker1Id, worker2Id, 'test', {})).rejects.toThrow()
    })

    it('cannot send to a terminated worker', async () => {
      await core.terminate(worker2Id)

      await expect(core.send(worker1Id, worker2Id, 'test', {})).rejects.toThrow()
    })

    it('can send to a paused worker (message queued)', async () => {
      await core.pause(worker2Id)
      const message = await core.send(worker1Id, worker2Id, 'queued', { data: 'test' })

      expect(message).toBeDefined()
      expect(message.acknowledged).toBe(false)
    })
  })

  describe('receive()', () => {
    let worker1Id: string
    let worker2Id: string

    beforeEach(async () => {
      const worker1 = await core.spawn({ name: 'sender' })
      const worker2 = await core.spawn({ name: 'receiver' })
      worker1Id = worker1.id
      worker2Id = worker2.id
    })

    it('receives messages for a worker', async () => {
      await core.send(worker1Id, worker2Id, 'test', { msg: 'hello' })
      const messages = await core.receive(worker2Id)

      expect(messages).toHaveLength(1)
      expect(messages[0].type).toBe('test')
      expect(messages[0].payload).toEqual({ msg: 'hello' })
    })

    it('returns empty array when no messages', async () => {
      const messages = await core.receive(worker2Id)

      expect(messages).toEqual([])
    })

    it('receives multiple messages in order', async () => {
      await core.send(worker1Id, worker2Id, 'first', { order: 1 })
      await core.send(worker1Id, worker2Id, 'second', { order: 2 })
      await core.send(worker1Id, worker2Id, 'third', { order: 3 })

      const messages = await core.receive(worker2Id)

      expect(messages).toHaveLength(3)
      expect(messages[0].payload).toEqual({ order: 1 })
      expect(messages[1].payload).toEqual({ order: 2 })
      expect(messages[2].payload).toEqual({ order: 3 })
    })

    it('throws for non-existent worker', async () => {
      await expect(core.receive('nonexistent')).rejects.toThrow()
    })

    it('can optionally filter by message type', async () => {
      await core.send(worker1Id, worker2Id, 'typeA', { data: 'a' })
      await core.send(worker1Id, worker2Id, 'typeB', { data: 'b' })
      await core.send(worker1Id, worker2Id, 'typeA', { data: 'a2' })

      const messages = await core.receive(worker2Id, { type: 'typeA' })

      expect(messages).toHaveLength(2)
      expect(messages.every((m) => m.type === 'typeA')).toBe(true)
    })

    it('can limit number of messages received', async () => {
      await core.send(worker1Id, worker2Id, 'test', { n: 1 })
      await core.send(worker1Id, worker2Id, 'test', { n: 2 })
      await core.send(worker1Id, worker2Id, 'test', { n: 3 })

      const messages = await core.receive(worker2Id, { limit: 2 })

      expect(messages).toHaveLength(2)
    })
  })

  describe('acknowledge()', () => {
    let worker1Id: string
    let worker2Id: string
    let messageId: string

    beforeEach(async () => {
      const worker1 = await core.spawn({ name: 'sender' })
      const worker2 = await core.spawn({ name: 'receiver' })
      worker1Id = worker1.id
      worker2Id = worker2.id
      const message = await core.send(worker1Id, worker2Id, 'test', {})
      messageId = message.id
    })

    it('acknowledges a received message', async () => {
      const result = await core.acknowledge(worker2Id, messageId)

      expect(result).toBe(true)
    })

    it('marks message as acknowledged', async () => {
      await core.acknowledge(worker2Id, messageId)
      const messages = await core.receive(worker2Id, { acknowledged: true })

      expect(messages).toHaveLength(1)
      expect(messages[0].acknowledged).toBe(true)
    })

    it('returns false for non-existent message', async () => {
      const result = await core.acknowledge(worker2Id, 'nonexistent-message')

      expect(result).toBe(false)
    })

    it('throws for non-existent worker', async () => {
      await expect(core.acknowledge('nonexistent', messageId)).rejects.toThrow()
    })
  })

  describe('broadcast()', () => {
    let broadcasterId: string
    let receiverIds: string[]

    beforeEach(async () => {
      const broadcaster = await core.spawn({ name: 'broadcaster' })
      broadcasterId = broadcaster.id
      receiverIds = []
      for (let i = 0; i < 3; i++) {
        const receiver = await core.spawn({ name: `receiver-${i}` })
        receiverIds.push(receiver.id)
      }
    })

    it('sends message to multiple workers', async () => {
      const results = await core.broadcast(broadcasterId, receiverIds, 'announcement', {
        text: 'hello all',
      })

      expect(results).toHaveLength(3)
      expect(results.every((r) => r.success)).toBe(true)
    })

    it('each receiver gets the message', async () => {
      await core.broadcast(broadcasterId, receiverIds, 'broadcast', { data: 'test' })

      for (const receiverId of receiverIds) {
        const messages = await core.receive(receiverId)
        expect(messages).toHaveLength(1)
        expect(messages[0].type).toBe('broadcast')
      }
    })

    it('handles partial failures gracefully', async () => {
      await core.terminate(receiverIds[1]) // Terminate one receiver

      const results = await core.broadcast(broadcasterId, receiverIds, 'test', {})

      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[2].success).toBe(true)
    })

    it('returns empty array for empty receiver list', async () => {
      const results = await core.broadcast(broadcasterId, [], 'test', {})

      expect(results).toEqual([])
    })
  })

  // ===========================================================================
  // Worker State Management
  // ===========================================================================

  describe('getState()', () => {
    let workerId: string

    beforeEach(async () => {
      const worker = await core.spawn({
        name: 'stateful-worker',
        tier: 'agentic',
        metadata: { region: 'us-west' },
      })
      workerId = worker.id
    })

    it('retrieves full worker state', async () => {
      const state = await core.getState(workerId)

      expect(state).toBeDefined()
      expect(state?.id).toBe(workerId)
      expect(state?.name).toBe('stateful-worker')
      expect(state?.status).toBe('running')
      expect(state?.tier).toBe('agentic')
    })

    it('returns null for non-existent worker', async () => {
      const state = await core.getState('nonexistent-id')

      expect(state).toBeNull()
    })

    it('includes metadata in state', async () => {
      const state = await core.getState(workerId)

      expect(state?.metadata).toEqual({ region: 'us-west' })
    })

    it('includes timestamps', async () => {
      const state = await core.getState(workerId)

      expect(state?.createdAt).toBeInstanceOf(Date)
      expect(state?.updatedAt).toBeInstanceOf(Date)
    })

    it('returns terminated state for terminated worker', async () => {
      await core.terminate(workerId)
      const state = await core.getState(workerId)

      expect(state?.status).toBe('terminated')
    })
  })

  describe('setState()', () => {
    let workerId: string

    beforeEach(async () => {
      const worker = await core.spawn({ name: 'updatable-worker' })
      workerId = worker.id
    })

    it('updates worker metadata', async () => {
      await core.setState(workerId, { metadata: { updated: true, count: 42 } })
      const state = await core.getState(workerId)

      expect(state?.metadata).toEqual({ updated: true, count: 42 })
    })

    it('merges metadata by default', async () => {
      await core.spawn({
        name: 'merge-test',
        metadata: { a: 1, b: 2 },
      })
      const worker = await core.spawn({ name: 'merge-worker', metadata: { a: 1, b: 2 } })

      await core.setState(worker.id, { metadata: { b: 20, c: 3 } })
      const state = await core.getState(worker.id)

      expect(state?.metadata).toEqual({ a: 1, b: 20, c: 3 })
    })

    it('updates the updatedAt timestamp', async () => {
      const before = await core.getState(workerId)
      await new Promise((resolve) => setTimeout(resolve, 10)) // Small delay
      await core.setState(workerId, { metadata: { test: true } })
      const after = await core.getState(workerId)

      expect(after?.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime())
    })

    it('throws for non-existent worker', async () => {
      await expect(core.setState('nonexistent', { metadata: {} })).rejects.toThrow()
    })

    it('cannot update terminated worker', async () => {
      await core.terminate(workerId)

      await expect(core.setState(workerId, { metadata: { test: true } })).rejects.toThrow()
    })
  })

  describe('list()', () => {
    beforeEach(async () => {
      await core.spawn({ name: 'worker-1', type: 'agent', tier: 'code' })
      await core.spawn({ name: 'worker-2', type: 'agent', tier: 'generative' })
      await core.spawn({ name: 'worker-3', type: 'human' })
    })

    it('lists all workers', async () => {
      const workers = await core.list()

      expect(workers.length).toBeGreaterThanOrEqual(3)
    })

    it('filters by status', async () => {
      const worker = await core.spawn({ name: 'paused-worker' })
      await core.pause(worker.id)

      const pausedWorkers = await core.list({ status: 'paused' })

      expect(pausedWorkers.length).toBeGreaterThanOrEqual(1)
      expect(pausedWorkers.every((w) => w.status === 'paused')).toBe(true)
    })

    it('filters by type', async () => {
      const humanWorkers = await core.list({ type: 'human' })

      expect(humanWorkers.length).toBeGreaterThanOrEqual(1)
      expect(humanWorkers.every((w) => w.type === 'human')).toBe(true)
    })

    it('filters by tier', async () => {
      const generativeWorkers = await core.list({ tier: 'generative' })

      expect(generativeWorkers.length).toBeGreaterThanOrEqual(1)
      expect(generativeWorkers.every((w) => w.tier === 'generative')).toBe(true)
    })

    it('supports limit option', async () => {
      const workers = await core.list({ limit: 2 })

      expect(workers).toHaveLength(2)
    })

    it('excludes terminated workers by default', async () => {
      const worker = await core.spawn({ name: 'to-terminate' })
      await core.terminate(worker.id)

      const workers = await core.list()
      const terminated = workers.find((w) => w.id === worker.id)

      expect(terminated).toBeUndefined()
    })

    it('includes terminated workers when requested', async () => {
      const worker = await core.spawn({ name: 'to-terminate' })
      await core.terminate(worker.id)

      const workers = await core.list({ includeTerminated: true })
      const terminated = workers.find((w) => w.id === worker.id)

      expect(terminated).toBeDefined()
      expect(terminated?.status).toBe('terminated')
    })
  })

  // ===========================================================================
  // Worker Coordination Patterns
  // ===========================================================================

  describe('fanOut()', () => {
    let coordinatorId: string
    let workerIds: string[]

    beforeEach(async () => {
      const coordinator = await core.spawn({ name: 'coordinator' })
      coordinatorId = coordinator.id
      workerIds = []
      for (let i = 0; i < 3; i++) {
        const worker = await core.spawn({ name: `worker-${i}` })
        workerIds.push(worker.id)
      }
    })

    it('distributes work to multiple workers', async () => {
      const task = await core.fanOut(coordinatorId, workerIds, 'process', {
        data: [1, 2, 3],
      })

      expect(task).toBeDefined()
      expect(task.id).toBeDefined()
      expect(task.type).toBe('fanout')
      expect(task.workers).toEqual(workerIds)
    })

    it('tracks task status', async () => {
      const task = await core.fanOut(coordinatorId, workerIds, 'process', {})

      expect(['pending', 'running']).toContain(task.status)
    })

    it('sends message to each worker', async () => {
      await core.fanOut(coordinatorId, workerIds, 'fanout-task', { job: 'test' })

      for (const workerId of workerIds) {
        const messages = await core.receive(workerId)
        expect(messages.length).toBeGreaterThanOrEqual(1)
        expect(messages.some((m) => m.type === 'fanout-task')).toBe(true)
      }
    })

    it('handles empty worker list', async () => {
      await expect(core.fanOut(coordinatorId, [], 'test', {})).rejects.toThrow()
    })
  })

  describe('pipeline()', () => {
    let workerIds: string[]

    beforeEach(async () => {
      workerIds = []
      for (let i = 0; i < 3; i++) {
        const worker = await core.spawn({ name: `stage-${i}` })
        workerIds.push(worker.id)
      }
    })

    it('creates a sequential processing pipeline', async () => {
      const task = await core.pipeline(workerIds, 'transform', { input: 'start' })

      expect(task).toBeDefined()
      expect(task.type).toBe('pipeline')
      expect(task.workers).toEqual(workerIds)
    })

    it('sends initial data to first worker', async () => {
      await core.pipeline(workerIds, 'pipeline-start', { data: 'initial' })

      const messages = await core.receive(workerIds[0])
      expect(messages.length).toBeGreaterThanOrEqual(1)
      expect(messages.some((m) => m.type === 'pipeline-start')).toBe(true)
    })

    it('requires at least one worker', async () => {
      await expect(core.pipeline([], 'test', {})).rejects.toThrow()
    })
  })

  describe('race()', () => {
    let workerIds: string[]

    beforeEach(async () => {
      workerIds = []
      for (let i = 0; i < 3; i++) {
        const worker = await core.spawn({ name: `racer-${i}` })
        workerIds.push(worker.id)
      }
    })

    it('creates a race task (first to complete wins)', async () => {
      const task = await core.race(workerIds, 'compete', { query: 'test' })

      expect(task).toBeDefined()
      expect(task.type).toBe('race')
      expect(task.workers).toEqual(workerIds)
    })

    it('sends same task to all workers', async () => {
      await core.race(workerIds, 'race-task', { challenge: 'solve' })

      for (const workerId of workerIds) {
        const messages = await core.receive(workerId)
        expect(messages.length).toBeGreaterThanOrEqual(1)
        expect(messages.some((m) => m.type === 'race-task')).toBe(true)
      }
    })

    it('requires at least one worker', async () => {
      await expect(core.race([], 'test', {})).rejects.toThrow()
    })
  })

  describe('consensus()', () => {
    let workerIds: string[]

    beforeEach(async () => {
      workerIds = []
      for (let i = 0; i < 3; i++) {
        const worker = await core.spawn({ name: `voter-${i}` })
        workerIds.push(worker.id)
      }
    })

    it('creates a consensus task (all must agree)', async () => {
      const task = await core.consensus(workerIds, 'vote', { proposal: 'approve' })

      expect(task).toBeDefined()
      expect(task.type).toBe('consensus')
      expect(task.workers).toEqual(workerIds)
    })

    it('sends proposal to all workers', async () => {
      await core.consensus(workerIds, 'consensus-vote', { decision: 'yes/no' })

      for (const workerId of workerIds) {
        const messages = await core.receive(workerId)
        expect(messages.length).toBeGreaterThanOrEqual(1)
        expect(messages.some((m) => m.type === 'consensus-vote')).toBe(true)
      }
    })

    it('requires at least one worker', async () => {
      await expect(core.consensus([], 'test', {})).rejects.toThrow()
    })

    it('supports quorum threshold option', async () => {
      const task = await core.consensus(workerIds, 'vote', { proposal: 'test' }, { quorum: 2 })

      expect(task).toBeDefined()
      // Quorum of 2 out of 3 workers
    })
  })

  describe('getTaskStatus()', () => {
    let workerId: string
    let taskId: string

    beforeEach(async () => {
      const worker = await core.spawn({ name: 'task-worker' })
      workerId = worker.id
      const task = await core.fanOut(workerId, [workerId], 'test', {})
      taskId = task.id
    })

    it('retrieves coordination task status', async () => {
      const status = await core.getTaskStatus(taskId)

      expect(status).toBeDefined()
      expect(status?.id).toBe(taskId)
      expect(status?.type).toBe('fanout')
    })

    it('returns null for non-existent task', async () => {
      const status = await core.getTaskStatus('nonexistent-task')

      expect(status).toBeNull()
    })
  })
})

// =============================================================================
// DigitalWorkersService (WorkerEntrypoint) Tests
// =============================================================================

describe('DigitalWorkersService (WorkerEntrypoint)', () => {
  it('exports DigitalWorkersService class', () => {
    expect(DigitalWorkersService).toBeDefined()
    expect(typeof DigitalWorkersService).toBe('function')
  })

  it('DigitalWorkersService has connect method in prototype', () => {
    expect(typeof DigitalWorkersService.prototype.connect).toBe('function')
  })

  describe('connect()', () => {
    it('returns a DigitalWorkersServiceCore instance', () => {
      const service = new DigitalWorkersService({ env } as any, {} as any)
      const core = service.connect()

      expect(core).toBeInstanceOf(DigitalWorkersServiceCore)
    })

    it('returns RpcTarget that can be used over RPC', () => {
      const service = new DigitalWorkersService({ env } as any, {} as any)
      const core = service.connect()

      // RpcTarget instances should have these characteristics
      expect(core).toBeDefined()
      expect(typeof core.spawn).toBe('function')
      expect(typeof core.terminate).toBe('function')
      expect(typeof core.pause).toBe('function')
      expect(typeof core.resume).toBe('function')
      expect(typeof core.send).toBe('function')
      expect(typeof core.receive).toBe('function')
      expect(typeof core.getState).toBe('function')
      expect(typeof core.list).toBe('function')
    })
  })
})

// =============================================================================
// Default Export Tests
// =============================================================================

describe('Default export', () => {
  it('exports DigitalWorkersService as default', async () => {
    const { default: DefaultExport } = await import('../src/worker.js')
    expect(DefaultExport).toBe(DigitalWorkersService)
  })
})

// =============================================================================
// Real Bindings Integration Tests
// =============================================================================

describe('Real AI Gateway integration', () => {
  let core: InstanceType<typeof DigitalWorkersServiceCore>

  beforeEach(() => {
    core = new DigitalWorkersServiceCore(env)
  })

  it('can access AI Gateway through env binding', () => {
    // env.AI should be available in workers environment
    expect(env).toBeDefined()
  })

  it('worker operations use real Durable Objects', async () => {
    // This tests real DO persistence
    const worker = await core.spawn({ name: 'persistent-worker' })
    const retrieved = await core.getState(worker.id)

    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe(worker.id)
  })
})

describe('State Persistence', () => {
  it('worker state persists across service instances', async () => {
    // First service instance - create worker
    const core1 = new DigitalWorkersServiceCore(env)
    const worker = await core1.spawn({
      name: 'persistent',
      metadata: { key: 'value' },
    })
    const workerId = worker.id

    // Second service instance - verify persistence
    const core2 = new DigitalWorkersServiceCore(env)
    const retrieved = await core2.getState(workerId)

    expect(retrieved).not.toBeNull()
    expect(retrieved?.name).toBe('persistent')
    expect(retrieved?.metadata).toEqual({ key: 'value' })
  })

  it('messages persist and can be received after reconnection', async () => {
    const core1 = new DigitalWorkersServiceCore(env)
    const sender = await core1.spawn({ name: 'sender' })
    const receiver = await core1.spawn({ name: 'receiver' })

    // Send message
    await core1.send(sender.id, receiver.id, 'persistent-msg', { data: 'test' })

    // New service instance - receive message
    const core2 = new DigitalWorkersServiceCore(env)
    const messages = await core2.receive(receiver.id)

    expect(messages.length).toBeGreaterThanOrEqual(1)
    expect(messages.some((m) => m.type === 'persistent-msg')).toBe(true)
  })
})

describe('Concurrent Operations', () => {
  let core: InstanceType<typeof DigitalWorkersServiceCore>

  beforeEach(() => {
    core = new DigitalWorkersServiceCore(env)
  })

  it('handles concurrent worker spawning', async () => {
    const promises = []
    for (let i = 0; i < 5; i++) {
      promises.push(core.spawn({ name: `concurrent-${i}` }))
    }

    const workers = await Promise.all(promises)

    expect(workers).toHaveLength(5)
    // All IDs should be unique
    const ids = workers.map((w) => w.id)
    expect(new Set(ids).size).toBe(5)
  })

  it('handles concurrent message sending', async () => {
    const sender = await core.spawn({ name: 'concurrent-sender' })
    const receiver = await core.spawn({ name: 'concurrent-receiver' })

    const promises = []
    for (let i = 0; i < 10; i++) {
      promises.push(core.send(sender.id, receiver.id, 'concurrent', { n: i }))
    }

    const messages = await Promise.all(promises)

    expect(messages).toHaveLength(10)
    // All message IDs should be unique
    const ids = messages.map((m) => m.id)
    expect(new Set(ids).size).toBe(10)
  })

  it('handles concurrent state updates', async () => {
    const worker = await core.spawn({ name: 'concurrent-update' })

    const promises = []
    for (let i = 0; i < 5; i++) {
      promises.push(core.setState(worker.id, { metadata: { update: i } }))
    }

    // All updates should complete without error
    await Promise.all(promises)

    const state = await core.getState(worker.id)
    expect(state?.metadata?.update).toBeDefined()
  })
})

describe('Error Handling', () => {
  let core: InstanceType<typeof DigitalWorkersServiceCore>

  beforeEach(() => {
    core = new DigitalWorkersServiceCore(env)
  })

  it('provides meaningful error for invalid worker ID format', async () => {
    await expect(core.getState('')).rejects.toThrow()
  })

  it('provides meaningful error for invalid message payload', async () => {
    const sender = await core.spawn({ name: 'sender' })
    const receiver = await core.spawn({ name: 'receiver' })

    // Circular reference should fail
    const circular: any = {}
    circular.self = circular

    await expect(core.send(sender.id, receiver.id, 'test', circular)).rejects.toThrow()
  })

  it('handles worker in error state', async () => {
    const worker = await core.spawn({ name: 'error-worker' })

    // Force error state (implementation specific)
    // The test verifies that error state is properly tracked
    const state = await core.getState(worker.id)
    expect(state?.status).not.toBe('error') // Fresh worker shouldn't be in error
  })
})

// =============================================================================
// Stateless Actions on WorkerEntrypoint (RED phase - not yet implemented)
// =============================================================================
//
// These tests verify that DigitalWorkersServiceCore exposes stateless action
// methods (notify, decide, askAI) directly on the RpcTarget. This enables
// consuming workers to call these actions without managing worker lifecycle.
//
// Pattern:
//   const service = env.DIGITAL_WORKERS.connect()
//   const decision = await service.decide({ options: ['A', 'B'] })
//   await service.notify({ target: 'alice', message: 'Done' })
//   const answer = await service.askAI('What should we do?')
//
// These methods are STATELESS - they do not require spawning a worker first.
// They use the AI binding from env for real AI Gateway calls.
// =============================================================================

describe('Stateless Actions - notify()', () => {
  let core: InstanceType<typeof DigitalWorkersServiceCore>

  beforeEach(() => {
    core = new DigitalWorkersServiceCore(env)
  })

  it('exposes notify as a method on DigitalWorkersServiceCore', () => {
    expect(typeof core.notify).toBe('function')
  })

  it('sends a notification and returns a result', async () => {
    const result = await core.notify({
      target: 'test-user',
      message: 'Hello from stateless action',
    })

    expect(result).toBeDefined()
    expect(result.sent).toBe(true)
    expect(result.messageId).toBeDefined()
    expect(typeof result.messageId).toBe('string')
  })

  it('includes channel information in result', async () => {
    const result = await core.notify({
      target: 'test-user',
      message: 'Test notification',
      via: 'webhook',
    })

    expect(result.via).toBeDefined()
    expect(Array.isArray(result.via)).toBe(true)
    expect(result.via.length).toBeGreaterThan(0)
  })

  it('supports priority levels', async () => {
    const result = await core.notify({
      target: 'test-user',
      message: 'Urgent: Server is down!',
      priority: 'urgent',
    })

    expect(result.sent).toBe(true)
  })

  it('supports sending to multiple targets', async () => {
    const result = await core.notify({
      target: ['user-a', 'user-b', 'user-c'],
      message: 'Team broadcast notification',
    })

    expect(result.sent).toBe(true)
    expect(result.recipients).toBeDefined()
    expect(result.recipients?.length).toBe(3)
  })

  it('includes sentAt timestamp in result', async () => {
    const result = await core.notify({
      target: 'test-user',
      message: 'Timestamped notification',
    })

    expect(result.sentAt).toBeInstanceOf(Date)
  })

  it('returns sent:false when target is unreachable', async () => {
    const result = await core.notify({
      target: { id: 'nonexistent', contacts: {} },
      message: 'Should fail gracefully',
      via: 'slack',
    })

    expect(result.sent).toBe(false)
    expect(result.via).toHaveLength(0)
  })

  it('supports metadata in notification', async () => {
    const result = await core.notify({
      target: 'test-user',
      message: 'Deployment complete',
      metadata: { version: '2.1.0', environment: 'production' },
    })

    expect(result.sent).toBe(true)
  })
})

describe('Stateless Actions - decide()', () => {
  let core: InstanceType<typeof DigitalWorkersServiceCore>

  beforeEach(() => {
    core = new DigitalWorkersServiceCore(env)
  })

  it('exposes decide as a method on DigitalWorkersServiceCore', () => {
    expect(typeof core.decide).toBe('function')
  })

  it('makes a decision between options using real AI Gateway', async () => {
    const decision = await core.decide({
      options: ['Option A', 'Option B'],
      context: 'Choose the better option for testing',
    })

    expect(decision).toBeDefined()
    expect(decision.choice).toBeDefined()
    expect(['Option A', 'Option B']).toContain(decision.choice)
  })

  it('returns reasoning with the decision', async () => {
    const decision = await core.decide({
      options: ['Deploy now', 'Wait until Monday'],
      context: 'Production deploy on a Friday afternoon',
    })

    expect(decision.reasoning).toBeDefined()
    expect(typeof decision.reasoning).toBe('string')
    expect(decision.reasoning.length).toBeGreaterThan(0)
  })

  it('returns confidence score between 0 and 1', async () => {
    const decision = await core.decide({
      options: ['React', 'Vue', 'Svelte'],
      context: 'Choose a frontend framework for a new project',
      criteria: ['performance', 'ecosystem', 'developer experience'],
    })

    expect(decision.confidence).toBeDefined()
    expect(typeof decision.confidence).toBe('number')
    expect(decision.confidence).toBeGreaterThanOrEqual(0)
    expect(decision.confidence).toBeLessThanOrEqual(1)
  })

  it('supports criteria for multi-criteria evaluation', async () => {
    const decision = await core.decide({
      options: ['Approach A', 'Approach B', 'Approach C'],
      context: 'Technical architecture decision',
      criteria: ['scalability', 'cost', 'time-to-market'],
    })

    expect(decision.choice).toBeDefined()
    // Should be one of the provided options
    expect(['Approach A', 'Approach B', 'Approach C']).toContain(decision.choice)
  })

  it('returns alternatives with scores', async () => {
    const decision = await core.decide({
      options: ['A', 'B', 'C'],
      context: 'Simple ranking test',
    })

    expect(decision.alternatives).toBeDefined()
    expect(Array.isArray(decision.alternatives)).toBe(true)
    // Each alternative should have an option and a score
    if (decision.alternatives && decision.alternatives.length > 0) {
      for (const alt of decision.alternatives) {
        expect(alt.option).toBeDefined()
        expect(typeof alt.score).toBe('number')
      }
    }
  })

  it('handles structured options (objects)', async () => {
    const decision = await core.decide({
      options: [
        { id: 'migrate', label: 'Migrate to new platform' },
        { id: 'refactor', label: 'Refactor existing system' },
        { id: 'rebuild', label: 'Rebuild from scratch' },
      ],
      context: 'Legacy system modernization decision',
    })

    expect(decision.choice).toBeDefined()
  })

  it('requires at least two options', async () => {
    await expect(
      core.decide({
        options: ['Only one option'],
        context: 'Not enough options',
      })
    ).rejects.toThrow()
  })
})

describe('Stateless Actions - askAI()', () => {
  let core: InstanceType<typeof DigitalWorkersServiceCore>

  beforeEach(() => {
    core = new DigitalWorkersServiceCore(env)
  })

  it('exposes askAI as a method on DigitalWorkersServiceCore', () => {
    expect(typeof core.askAI).toBe('function')
  })

  it('answers a question using real AI Gateway', async () => {
    const answer = await core.askAI('What is 2 + 2?')

    expect(answer).toBeDefined()
    expect(typeof answer).toBe('string')
    expect(answer.length).toBeGreaterThan(0)
  })

  it('accepts context for informed answers', async () => {
    const answer = await core.askAI('What is our refund policy?', {
      context: {
        refundWindow: '30 days',
        conditions: 'Original packaging required',
        exceptions: 'Digital products non-refundable',
      },
    })

    expect(answer).toBeDefined()
    expect(typeof answer).toBe('string')
  })

  it('supports structured response with schema', async () => {
    const result = await core.askAI('List three primary colors', {
      schema: {
        colors: ['Color name as a string'],
      },
    })

    expect(result).toBeDefined()
    // When schema is provided, result should match the schema shape
    expect(typeof result).toBe('object')
    const structured = result as { colors: string[] }
    expect(Array.isArray(structured.colors)).toBe(true)
    expect(structured.colors.length).toBe(3)
  })

  it('returns plain string when no schema provided', async () => {
    const answer = await core.askAI('Say hello')

    expect(typeof answer).toBe('string')
  })

  it('handles complex questions with context', async () => {
    const answer = await core.askAI('Should we scale up the database?', {
      context: {
        currentCPU: '85%',
        currentMemory: '70%',
        queryLatency: '450ms',
        peakHours: '9am-5pm EST',
      },
    })

    expect(answer).toBeDefined()
    expect(typeof answer).toBe('string')
    expect(answer.length).toBeGreaterThan(0)
  })

  it('handles empty question gracefully', async () => {
    await expect(core.askAI('')).rejects.toThrow()
  })
})

describe('Stateless Actions - Job ID Pattern', () => {
  let core: InstanceType<typeof DigitalWorkersServiceCore>

  beforeEach(() => {
    core = new DigitalWorkersServiceCore(env)
  })

  it('decide returns a job ID for tracking', async () => {
    const decision = await core.decide({
      options: ['A', 'B'],
      context: 'Test decision for job tracking',
    })

    expect(decision.jobId).toBeDefined()
    expect(typeof decision.jobId).toBe('string')
    expect(decision.jobId.length).toBeGreaterThan(0)
  })

  it('askAI returns a job ID when called with tracking option', async () => {
    const result = await core.askAI('Test question', { track: true })

    // When tracking is enabled, result becomes an object with jobId
    expect(typeof result).toBe('object')
    const tracked = result as { answer: string; jobId: string }
    expect(tracked.jobId).toBeDefined()
    expect(typeof tracked.jobId).toBe('string')
  })

  it('notify returns a job ID', async () => {
    const result = await core.notify({
      target: 'test-user',
      message: 'Job tracking test',
    })

    expect(result.jobId).toBeDefined()
    expect(typeof result.jobId).toBe('string')
  })

  it('job IDs are unique across calls', async () => {
    const result1 = await core.notify({ target: 'user-a', message: 'First' })
    const result2 = await core.notify({ target: 'user-b', message: 'Second' })

    expect(result1.jobId).not.toBe(result2.jobId)
  })

  it('job ID follows expected format pattern', async () => {
    const result = await core.notify({ target: 'user', message: 'Format test' })

    // Job IDs should follow a predictable pattern (e.g., job_<uuid> or similar)
    expect(result.jobId).toMatch(/^job_/)
  })
})

describe('Stateless Actions via connect() RPC', () => {
  it('connect() returns a service with stateless action methods', () => {
    const service = new DigitalWorkersService({ env } as any, {} as any)
    const core = service.connect()

    // Verify stateless action methods exist alongside lifecycle methods
    expect(typeof core.notify).toBe('function')
    expect(typeof core.decide).toBe('function')
    expect(typeof core.askAI).toBe('function')

    // Lifecycle methods should still exist
    expect(typeof core.spawn).toBe('function')
    expect(typeof core.terminate).toBe('function')
    expect(typeof core.send).toBe('function')
  })

  it('stateless actions do not require spawning a worker first', async () => {
    const service = new DigitalWorkersService({ env } as any, {} as any)
    const core = service.connect()

    // Should work without any prior spawn() calls
    const decision = await core.decide({
      options: ['Yes', 'No'],
      context: 'Simple yes/no test without worker lifecycle',
    })

    expect(decision.choice).toBeDefined()
    expect(['Yes', 'No']).toContain(decision.choice)
  })

  it('stateless actions are independent of worker state', async () => {
    const service = new DigitalWorkersService({ env } as any, {} as any)
    const core = service.connect()

    // Notify should work independently
    const notifyResult = await core.notify({
      target: 'independent-user',
      message: 'No worker required',
    })
    expect(notifyResult.sent).toBe(true)

    // askAI should work independently
    const answer = await core.askAI('Is this independent?')
    expect(answer).toBeDefined()
  })
})
