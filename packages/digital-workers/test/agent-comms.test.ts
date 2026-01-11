/**
 * Tests for agent-to-agent communication layer
 *
 * TDD RED Phase: Write failing tests first
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Worker, WorkerRef } from '../src/types.js'
import {
  // Types
  type AgentMessage,
  type MessageEnvelope,
  type MessageAck,
  type HandoffRequest,
  type HandoffResult,
  type CoordinationPattern,
  // Message Bus
  AgentMessageBus,
  createMessageBus,
  // Core Functions
  sendToAgent,
  broadcastToGroup,
  requestFromAgent,
  onMessage,
  acknowledge,
  // Coordination Patterns
  requestResponse,
  fanOut,
  fanIn,
  pipeline,
  // Handoff Protocol
  initiateHandoff,
  acceptHandoff,
  rejectHandoff,
  completeHandoff,
} from '../src/agent-comms.js'

// =============================================================================
// Test Fixtures
// =============================================================================

const agentA: Worker = {
  id: 'agent-a',
  name: 'Agent A',
  type: 'agent',
  status: 'available',
  contacts: {
    api: { endpoint: 'https://api.internal/agent-a', auth: 'bearer' },
  },
}

const agentB: Worker = {
  id: 'agent-b',
  name: 'Agent B',
  type: 'agent',
  status: 'available',
  contacts: {
    api: { endpoint: 'https://api.internal/agent-b', auth: 'bearer' },
  },
}

const agentC: Worker = {
  id: 'agent-c',
  name: 'Agent C',
  type: 'agent',
  status: 'available',
  contacts: {
    api: { endpoint: 'https://api.internal/agent-c', auth: 'bearer' },
  },
}

const agentGroup = {
  id: 'group-processors',
  name: 'Processors',
  members: [agentA, agentB, agentC],
}

// =============================================================================
// AgentMessage Interface Tests
// =============================================================================

describe('AgentMessage Types', () => {
  describe('AgentMessage interface', () => {
    it('should have required properties', () => {
      const message: AgentMessage = {
        id: 'msg_001',
        type: 'request',
        sender: 'agent-a',
        recipient: 'agent-b',
        payload: { task: 'process-data' },
        timestamp: new Date(),
      }

      expect(message.id).toBe('msg_001')
      expect(message.type).toBe('request')
      expect(message.sender).toBe('agent-a')
      expect(message.recipient).toBe('agent-b')
      expect(message.payload).toEqual({ task: 'process-data' })
      expect(message.timestamp).toBeInstanceOf(Date)
    })

    it('should support all message types', () => {
      const types: AgentMessage['type'][] = [
        'request',
        'response',
        'notification',
        'handoff',
        'ack',
        'error',
      ]
      expect(types).toHaveLength(6)
    })

    it('should support optional properties', () => {
      const message: AgentMessage = {
        id: 'msg_002',
        type: 'request',
        sender: 'agent-a',
        recipient: 'agent-b',
        payload: { data: 'test' },
        timestamp: new Date(),
        correlationId: 'corr_001',
        replyTo: 'agent-a',
        ttl: 30000,
        priority: 'high',
        metadata: { source: 'cascade' },
      }

      expect(message.correlationId).toBe('corr_001')
      expect(message.replyTo).toBe('agent-a')
      expect(message.ttl).toBe(30000)
      expect(message.priority).toBe('high')
      expect(message.metadata).toEqual({ source: 'cascade' })
    })
  })

  describe('MessageEnvelope interface', () => {
    it('should wrap message with delivery metadata', () => {
      const envelope: MessageEnvelope = {
        message: {
          id: 'msg_003',
          type: 'notification',
          sender: 'agent-a',
          recipient: 'agent-b',
          payload: { event: 'task-complete' },
          timestamp: new Date(),
        },
        deliveryAttempts: 1,
        firstAttemptAt: new Date(),
        lastAttemptAt: new Date(),
        status: 'pending',
      }

      expect(envelope.message.id).toBe('msg_003')
      expect(envelope.deliveryAttempts).toBe(1)
      expect(envelope.status).toBe('pending')
    })

    it('should track delivery status', () => {
      const statuses: MessageEnvelope['status'][] = [
        'pending',
        'delivered',
        'acknowledged',
        'failed',
        'expired',
      ]
      expect(statuses).toHaveLength(5)
    })
  })

  describe('MessageAck interface', () => {
    it('should acknowledge message receipt', () => {
      const ack: MessageAck = {
        messageId: 'msg_001',
        status: 'received',
        timestamp: new Date(),
        agentId: 'agent-b',
      }

      expect(ack.messageId).toBe('msg_001')
      expect(ack.status).toBe('received')
      expect(ack.agentId).toBe('agent-b')
    })

    it('should support processing status', () => {
      const ack: MessageAck = {
        messageId: 'msg_001',
        status: 'processed',
        timestamp: new Date(),
        agentId: 'agent-b',
        result: { success: true, output: 'completed' },
      }

      expect(ack.status).toBe('processed')
      expect(ack.result).toEqual({ success: true, output: 'completed' })
    })
  })
})

// =============================================================================
// AgentMessageBus Tests
// =============================================================================

describe('AgentMessageBus', () => {
  let bus: AgentMessageBus

  beforeEach(() => {
    bus = createMessageBus()
  })

  afterEach(() => {
    bus.dispose()
  })

  describe('creation and disposal', () => {
    it('should create a message bus', () => {
      expect(bus).toBeDefined()
      expect(bus.send).toBeInstanceOf(Function)
      expect(bus.subscribe).toBeInstanceOf(Function)
      expect(bus.dispose).toBeInstanceOf(Function)
    })

    it('should clean up on dispose', () => {
      const handler = vi.fn()
      bus.subscribe('agent-a', handler)
      bus.dispose()

      // Should not call handler after dispose
      bus.send({
        id: 'msg_test',
        type: 'notification',
        sender: 'agent-b',
        recipient: 'agent-a',
        payload: {},
        timestamp: new Date(),
      })

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('message sending', () => {
    it('should send message to subscribed agent', async () => {
      const handler = vi.fn()
      bus.subscribe('agent-b', handler)

      const message: AgentMessage = {
        id: 'msg_004',
        type: 'notification',
        sender: 'agent-a',
        recipient: 'agent-b',
        payload: { event: 'test' },
        timestamp: new Date(),
      }

      await bus.send(message)

      expect(handler).toHaveBeenCalledWith(message)
    })

    it('should return delivery envelope', async () => {
      bus.subscribe('agent-b', vi.fn())

      const message: AgentMessage = {
        id: 'msg_005',
        type: 'request',
        sender: 'agent-a',
        recipient: 'agent-b',
        payload: { task: 'process' },
        timestamp: new Date(),
      }

      const envelope = await bus.send(message)

      expect(envelope.message.id).toBe('msg_005')
      expect(envelope.status).toBe('delivered')
      expect(envelope.deliveryAttempts).toBe(1)
    })

    it('should fail for unsubscribed recipient', async () => {
      const message: AgentMessage = {
        id: 'msg_006',
        type: 'notification',
        sender: 'agent-a',
        recipient: 'unknown-agent',
        payload: {},
        timestamp: new Date(),
      }

      const envelope = await bus.send(message)

      expect(envelope.status).toBe('failed')
      expect(envelope.error).toContain('not found')
    })

    it('should queue messages when recipient is busy', async () => {
      let resolveHandler: () => void
      const handlerPromise = new Promise<void>((resolve) => {
        resolveHandler = resolve
      })

      // Slow handler that blocks
      const slowHandler = vi.fn(async () => {
        await handlerPromise
      })

      bus.subscribe('agent-b', slowHandler)

      const msg1: AgentMessage = {
        id: 'msg_007',
        type: 'request',
        sender: 'agent-a',
        recipient: 'agent-b',
        payload: { order: 1 },
        timestamp: new Date(),
      }

      const msg2: AgentMessage = {
        id: 'msg_008',
        type: 'request',
        sender: 'agent-a',
        recipient: 'agent-b',
        payload: { order: 2 },
        timestamp: new Date(),
      }

      // Send both messages
      const p1 = bus.send(msg1)
      const p2 = bus.send(msg2)

      // First message should be processing
      expect(slowHandler).toHaveBeenCalledTimes(1)

      // Release the handler
      resolveHandler!()

      await Promise.all([p1, p2])

      // Both should have been processed
      expect(slowHandler).toHaveBeenCalledTimes(2)
    })
  })

  describe('message subscription', () => {
    it('should allow multiple subscribers for same agent', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      bus.subscribe('agent-a', handler1)
      bus.subscribe('agent-a', handler2)

      const message: AgentMessage = {
        id: 'msg_009',
        type: 'notification',
        sender: 'agent-b',
        recipient: 'agent-a',
        payload: {},
        timestamp: new Date(),
      }

      await bus.send(message)

      expect(handler1).toHaveBeenCalledWith(message)
      expect(handler2).toHaveBeenCalledWith(message)
    })

    it('should return unsubscribe function', async () => {
      const handler = vi.fn()
      const unsubscribe = bus.subscribe('agent-a', handler)

      unsubscribe()

      await bus.send({
        id: 'msg_010',
        type: 'notification',
        sender: 'agent-b',
        recipient: 'agent-a',
        payload: {},
        timestamp: new Date(),
      })

      expect(handler).not.toHaveBeenCalled()
    })

    it('should filter by message type', async () => {
      const requestHandler = vi.fn()
      const notificationHandler = vi.fn()

      bus.subscribe('agent-a', requestHandler, { types: ['request'] })
      bus.subscribe('agent-a', notificationHandler, { types: ['notification'] })

      const request: AgentMessage = {
        id: 'msg_011',
        type: 'request',
        sender: 'agent-b',
        recipient: 'agent-a',
        payload: {},
        timestamp: new Date(),
      }

      const notification: AgentMessage = {
        id: 'msg_012',
        type: 'notification',
        sender: 'agent-b',
        recipient: 'agent-a',
        payload: {},
        timestamp: new Date(),
      }

      await bus.send(request)
      await bus.send(notification)

      expect(requestHandler).toHaveBeenCalledTimes(1)
      expect(notificationHandler).toHaveBeenCalledTimes(1)
    })
  })

  describe('message acknowledgment', () => {
    it('should track pending acknowledgments', async () => {
      bus.subscribe('agent-b', vi.fn())

      const message: AgentMessage = {
        id: 'msg_013',
        type: 'request',
        sender: 'agent-a',
        recipient: 'agent-b',
        payload: {},
        timestamp: new Date(),
      }

      await bus.send(message)

      const pending = bus.getPendingAcks('agent-a')
      expect(pending).toContain('msg_013')
    })

    it('should acknowledge received message', async () => {
      bus.subscribe('agent-b', vi.fn())

      const message: AgentMessage = {
        id: 'msg_014',
        type: 'request',
        sender: 'agent-a',
        recipient: 'agent-b',
        payload: {},
        timestamp: new Date(),
      }

      await bus.send(message)
      await bus.acknowledge('msg_014', 'agent-b', 'received')

      const pending = bus.getPendingAcks('agent-a')
      expect(pending).not.toContain('msg_014')
    })

    it('should timeout unacknowledged messages', async () => {
      vi.useFakeTimers()

      bus.subscribe('agent-b', vi.fn())

      const message: AgentMessage = {
        id: 'msg_015',
        type: 'request',
        sender: 'agent-a',
        recipient: 'agent-b',
        payload: {},
        timestamp: new Date(),
        ttl: 1000, // 1 second TTL
      }

      const envelope = await bus.send(message)
      expect(envelope.status).toBe('delivered')

      // Advance time past TTL
      vi.advanceTimersByTime(2000)

      const status = bus.getMessageStatus('msg_015')
      expect(status).toBe('expired')

      vi.useRealTimers()
    })
  })
})

// =============================================================================
// Core Communication Functions
// =============================================================================

describe('Core Communication Functions', () => {
  let bus: AgentMessageBus

  beforeEach(() => {
    bus = createMessageBus()
  })

  afterEach(() => {
    bus.dispose()
  })

  describe('sendToAgent', () => {
    it('should send message to specific agent', async () => {
      const handler = vi.fn()
      bus.subscribe('agent-b', handler)

      const envelope = await sendToAgent(bus, 'agent-a', 'agent-b', {
        task: 'process-data',
        input: { value: 42 },
      })

      expect(envelope.status).toBe('delivered')
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          sender: 'agent-a',
          recipient: 'agent-b',
          payload: { task: 'process-data', input: { value: 42 } },
        })
      )
    })

    it('should generate unique message ID', async () => {
      bus.subscribe('agent-b', vi.fn())

      const env1 = await sendToAgent(bus, 'agent-a', 'agent-b', { n: 1 })
      const env2 = await sendToAgent(bus, 'agent-a', 'agent-b', { n: 2 })

      expect(env1.message.id).not.toBe(env2.message.id)
    })

    it('should support message options', async () => {
      const handler = vi.fn()
      bus.subscribe('agent-b', handler)

      await sendToAgent(bus, 'agent-a', 'agent-b', { data: 'test' }, {
        priority: 'high',
        ttl: 5000,
        correlationId: 'corr_123',
      })

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: 'high',
          ttl: 5000,
          correlationId: 'corr_123',
        })
      )
    })
  })

  describe('broadcastToGroup', () => {
    it('should send to all agents in group', async () => {
      const handlerA = vi.fn()
      const handlerB = vi.fn()
      const handlerC = vi.fn()

      bus.subscribe('agent-a', handlerA)
      bus.subscribe('agent-b', handlerB)
      bus.subscribe('agent-c', handlerC)

      const results = await broadcastToGroup(
        bus,
        'broadcaster',
        ['agent-a', 'agent-b', 'agent-c'],
        { announcement: 'hello all' }
      )

      expect(results).toHaveLength(3)
      expect(handlerA).toHaveBeenCalled()
      expect(handlerB).toHaveBeenCalled()
      expect(handlerC).toHaveBeenCalled()
    })

    it('should continue on partial failure', async () => {
      bus.subscribe('agent-a', vi.fn())
      // agent-b not subscribed - will fail
      bus.subscribe('agent-c', vi.fn())

      const results = await broadcastToGroup(
        bus,
        'broadcaster',
        ['agent-a', 'agent-b', 'agent-c'],
        { message: 'test' }
      )

      expect(results).toHaveLength(3)
      expect(results.filter((r) => r.status === 'delivered')).toHaveLength(2)
      expect(results.filter((r) => r.status === 'failed')).toHaveLength(1)
    })

    it('should share same correlationId for batch', async () => {
      const receivedMessages: AgentMessage[] = []

      bus.subscribe('agent-a', (msg) => receivedMessages.push(msg))
      bus.subscribe('agent-b', (msg) => receivedMessages.push(msg))

      await broadcastToGroup(
        bus,
        'broadcaster',
        ['agent-a', 'agent-b'],
        { data: 'shared' }
      )

      expect(receivedMessages[0].correlationId).toBe(
        receivedMessages[1].correlationId
      )
    })
  })

  describe('requestFromAgent (request/response)', () => {
    it('should send request and await response', async () => {
      // Agent B processes requests
      bus.subscribe('agent-b', async (msg) => {
        if (msg.type === 'request') {
          await bus.send({
            id: `resp_${msg.id}`,
            type: 'response',
            sender: 'agent-b',
            recipient: msg.sender,
            payload: { result: 'processed', input: msg.payload },
            timestamp: new Date(),
            correlationId: msg.id,
          })
        }
      })

      const response = await requestFromAgent(bus, 'agent-a', 'agent-b', {
        action: 'compute',
        value: 100,
      })

      expect(response.payload).toEqual({
        result: 'processed',
        input: { action: 'compute', value: 100 },
      })
    })

    it('should timeout if no response', async () => {
      bus.subscribe('agent-b', vi.fn()) // Handler doesn't respond

      await expect(
        requestFromAgent(
          bus,
          'agent-a',
          'agent-b',
          { data: 'test' },
          { timeout: 100 }
        )
      ).rejects.toThrow('timeout')
    })

    it('should handle error response', async () => {
      bus.subscribe('agent-b', async (msg) => {
        if (msg.type === 'request') {
          await bus.send({
            id: `err_${msg.id}`,
            type: 'error',
            sender: 'agent-b',
            recipient: msg.sender,
            payload: { error: 'Processing failed', code: 'ERR_PROCESS' },
            timestamp: new Date(),
            correlationId: msg.id,
          })
        }
      })

      await expect(
        requestFromAgent(bus, 'agent-a', 'agent-b', { data: 'test' })
      ).rejects.toThrow('Processing failed')
    })
  })

  describe('onMessage', () => {
    it('should register handler for agent', () => {
      const handler = vi.fn()
      const unsubscribe = onMessage(bus, 'agent-a', handler)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should invoke handler on message receipt', async () => {
      const handler = vi.fn()
      onMessage(bus, 'agent-a', handler)

      await bus.send({
        id: 'msg_100',
        type: 'notification',
        sender: 'agent-b',
        recipient: 'agent-a',
        payload: { event: 'test' },
        timestamp: new Date(),
      })

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'msg_100' })
      )
    })

    it('should filter by sender', async () => {
      const handler = vi.fn()
      onMessage(bus, 'agent-a', handler, { from: 'agent-b' })

      await bus.send({
        id: 'msg_101',
        type: 'notification',
        sender: 'agent-b',
        recipient: 'agent-a',
        payload: {},
        timestamp: new Date(),
      })

      await bus.send({
        id: 'msg_102',
        type: 'notification',
        sender: 'agent-c',
        recipient: 'agent-a',
        payload: {},
        timestamp: new Date(),
      })

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ sender: 'agent-b' })
      )
    })
  })

  describe('acknowledge', () => {
    it('should send acknowledgment message', async () => {
      const ackHandler = vi.fn()
      bus.subscribe('agent-a', ackHandler)
      bus.subscribe('agent-b', vi.fn())

      const message: AgentMessage = {
        id: 'msg_ack_001',
        type: 'request',
        sender: 'agent-a',
        recipient: 'agent-b',
        payload: {},
        timestamp: new Date(),
      }

      await bus.send(message)
      await acknowledge(bus, message, 'received')

      expect(ackHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ack',
          correlationId: 'msg_ack_001',
          payload: expect.objectContaining({ status: 'received' }),
        })
      )
    })

    it('should include result in processed ack', async () => {
      const ackHandler = vi.fn()
      bus.subscribe('agent-a', ackHandler)
      bus.subscribe('agent-b', vi.fn())

      const message: AgentMessage = {
        id: 'msg_ack_002',
        type: 'request',
        sender: 'agent-a',
        recipient: 'agent-b',
        payload: {},
        timestamp: new Date(),
      }

      await bus.send(message)
      await acknowledge(bus, message, 'processed', { output: 'done' })

      expect(ackHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            status: 'processed',
            result: { output: 'done' },
          }),
        })
      )
    })
  })
})

// =============================================================================
// Coordination Patterns
// =============================================================================

describe('Coordination Patterns', () => {
  let bus: AgentMessageBus

  beforeEach(() => {
    bus = createMessageBus()
  })

  afterEach(() => {
    bus.dispose()
  })

  describe('requestResponse pattern', () => {
    it('should implement request/response with correlation', async () => {
      // Setup responder
      bus.subscribe('processor', async (msg) => {
        if (msg.type === 'request') {
          const result = (msg.payload as { value: number }).value * 2
          await bus.send({
            id: `resp_${msg.id}`,
            type: 'response',
            sender: 'processor',
            recipient: msg.sender,
            payload: { result },
            timestamp: new Date(),
            correlationId: msg.id,
          })
        }
      })

      const response = await requestResponse(bus, {
        from: 'requester',
        to: 'processor',
        payload: { value: 21 },
      })

      expect(response.payload).toEqual({ result: 42 })
    })
  })

  describe('fanOut pattern', () => {
    it('should distribute work to multiple agents', async () => {
      const results: unknown[] = []

      bus.subscribe('worker-1', async (msg) => {
        results.push({ worker: 1, input: msg.payload })
        await bus.send({
          id: `w1_${msg.id}`,
          type: 'response',
          sender: 'worker-1',
          recipient: msg.sender,
          payload: { processed: true, worker: 1 },
          timestamp: new Date(),
          correlationId: msg.correlationId,
        })
      })

      bus.subscribe('worker-2', async (msg) => {
        results.push({ worker: 2, input: msg.payload })
        await bus.send({
          id: `w2_${msg.id}`,
          type: 'response',
          sender: 'worker-2',
          recipient: msg.sender,
          payload: { processed: true, worker: 2 },
          timestamp: new Date(),
          correlationId: msg.correlationId,
        })
      })

      const responses = await fanOut(bus, {
        from: 'coordinator',
        to: ['worker-1', 'worker-2'],
        payload: { task: 'process-chunk' },
      })

      expect(responses).toHaveLength(2)
      expect(results).toHaveLength(2)
    })

    it('should handle partial failures in fanOut', async () => {
      bus.subscribe('worker-1', async (msg) => {
        await bus.send({
          id: `w1_${msg.id}`,
          type: 'response',
          sender: 'worker-1',
          recipient: msg.sender,
          payload: { success: true },
          timestamp: new Date(),
          correlationId: msg.correlationId,
        })
      })

      // worker-2 not subscribed

      const responses = await fanOut(bus, {
        from: 'coordinator',
        to: ['worker-1', 'worker-2'],
        payload: { task: 'process' },
        continueOnError: true,
      })

      expect(responses.filter((r) => r.success)).toHaveLength(1)
      expect(responses.filter((r) => !r.success)).toHaveLength(1)
    })
  })

  describe('fanIn pattern', () => {
    it('should collect responses from multiple agents', async () => {
      // Setup workers that send results
      bus.subscribe('collector', vi.fn())

      const collected = await fanIn(bus, {
        collector: 'collector',
        sources: ['source-1', 'source-2'],
        timeout: 1000,
        onSourceMessage: async (source) => {
          // Simulate sources sending data
          return { from: source, data: `data from ${source}` }
        },
      })

      expect(collected).toHaveLength(2)
      expect(collected.map((c) => c.from)).toContain('source-1')
      expect(collected.map((c) => c.from)).toContain('source-2')
    })
  })

  describe('pipeline pattern', () => {
    it('should chain agents in sequence', async () => {
      // Setup pipeline: step1 -> step2 -> step3
      bus.subscribe('step1', async (msg) => {
        const input = msg.payload as { value: number }
        await bus.send({
          id: `s1_${msg.id}`,
          type: 'response',
          sender: 'step1',
          recipient: msg.sender,
          payload: { value: input.value + 10 },
          timestamp: new Date(),
          correlationId: msg.id,
        })
      })

      bus.subscribe('step2', async (msg) => {
        const input = msg.payload as { value: number }
        await bus.send({
          id: `s2_${msg.id}`,
          type: 'response',
          sender: 'step2',
          recipient: msg.sender,
          payload: { value: input.value * 2 },
          timestamp: new Date(),
          correlationId: msg.id,
        })
      })

      bus.subscribe('step3', async (msg) => {
        const input = msg.payload as { value: number }
        await bus.send({
          id: `s3_${msg.id}`,
          type: 'response',
          sender: 'step3',
          recipient: msg.sender,
          payload: { value: input.value - 5, final: true },
          timestamp: new Date(),
          correlationId: msg.id,
        })
      })

      const result = await pipeline(bus, {
        initiator: 'orchestrator',
        stages: ['step1', 'step2', 'step3'],
        input: { value: 5 },
      })

      // Pipeline: 5 -> +10 = 15 -> *2 = 30 -> -5 = 25
      expect(result.payload).toEqual({ value: 25, final: true })
    })

    it('should stop pipeline on stage failure', async () => {
      bus.subscribe('step1', async (msg) => {
        await bus.send({
          id: `s1_${msg.id}`,
          type: 'error',
          sender: 'step1',
          recipient: msg.sender,
          payload: { error: 'Stage 1 failed' },
          timestamp: new Date(),
          correlationId: msg.id,
        })
      })

      bus.subscribe('step2', vi.fn())

      await expect(
        pipeline(bus, {
          initiator: 'orchestrator',
          stages: ['step1', 'step2'],
          input: { value: 1 },
        })
      ).rejects.toThrow('Stage 1 failed')
    })
  })
})

// =============================================================================
// Handoff Protocol Tests
// =============================================================================

describe('Handoff Protocol', () => {
  let bus: AgentMessageBus

  beforeEach(() => {
    bus = createMessageBus()
  })

  afterEach(() => {
    bus.dispose()
  })

  describe('HandoffRequest interface', () => {
    it('should define handoff request structure', () => {
      const request: HandoffRequest = {
        id: 'handoff_001',
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        context: {
          task: 'process-order',
          orderId: 'order_123',
          progress: 0.5,
        },
        reason: 'Escalation to specialist',
        priority: 'high',
        timestamp: new Date(),
      }

      expect(request.fromAgent).toBe('agent-a')
      expect(request.toAgent).toBe('agent-b')
      expect(request.context).toBeDefined()
      expect(request.reason).toBe('Escalation to specialist')
    })
  })

  describe('initiateHandoff', () => {
    it('should send handoff request to target agent', async () => {
      const handler = vi.fn()
      bus.subscribe('agent-b', handler)

      const result = await initiateHandoff(bus, {
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        context: { task: 'complex-analysis' },
        reason: 'Need specialist',
      })

      expect(result.status).toBe('pending')
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'handoff',
          payload: expect.objectContaining({
            action: 'request',
            context: { task: 'complex-analysis' },
          }),
        })
      )
    })

    it('should include context in handoff', async () => {
      const receivedContext: unknown[] = []

      bus.subscribe('agent-b', (msg) => {
        if (msg.type === 'handoff') {
          receivedContext.push((msg.payload as { context: unknown }).context)
        }
      })

      await initiateHandoff(bus, {
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        context: {
          state: { step: 3, data: [1, 2, 3] },
          history: ['step1', 'step2'],
          metadata: { priority: 'high' },
        },
      })

      expect(receivedContext[0]).toEqual({
        state: { step: 3, data: [1, 2, 3] },
        history: ['step1', 'step2'],
        metadata: { priority: 'high' },
      })
    })
  })

  describe('acceptHandoff', () => {
    it('should accept pending handoff', async () => {
      const ackHandler = vi.fn()
      bus.subscribe('agent-a', ackHandler)
      bus.subscribe('agent-b', vi.fn())

      const { handoffId } = await initiateHandoff(bus, {
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        context: {},
      })

      const result = await acceptHandoff(bus, handoffId, 'agent-b')

      expect(result.status).toBe('accepted')
      expect(ackHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'handoff',
          payload: expect.objectContaining({
            action: 'accepted',
            handoffId,
          }),
        })
      )
    })

    it('should fail to accept non-existent handoff', async () => {
      await expect(
        acceptHandoff(bus, 'non-existent', 'agent-b')
      ).rejects.toThrow('Handoff not found')
    })
  })

  describe('rejectHandoff', () => {
    it('should reject handoff with reason', async () => {
      const ackHandler = vi.fn()
      bus.subscribe('agent-a', ackHandler)
      bus.subscribe('agent-b', vi.fn())

      const { handoffId } = await initiateHandoff(bus, {
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        context: {},
      })

      const result = await rejectHandoff(bus, handoffId, 'agent-b', {
        reason: 'Currently at capacity',
      })

      expect(result.status).toBe('rejected')
      expect(ackHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            action: 'rejected',
            reason: 'Currently at capacity',
          }),
        })
      )
    })
  })

  describe('completeHandoff', () => {
    it('should complete accepted handoff', async () => {
      bus.subscribe('agent-a', vi.fn())
      bus.subscribe('agent-b', vi.fn())

      const { handoffId } = await initiateHandoff(bus, {
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        context: { task: 'process' },
      })

      await acceptHandoff(bus, handoffId, 'agent-b')

      const result = await completeHandoff(bus, handoffId, 'agent-b', {
        result: { success: true, output: 'completed task' },
      })

      expect(result.status).toBe('completed')
      expect(result.result).toEqual({ success: true, output: 'completed task' })
    })

    it('should fail to complete non-accepted handoff', async () => {
      bus.subscribe('agent-a', vi.fn())
      bus.subscribe('agent-b', vi.fn())

      const { handoffId } = await initiateHandoff(bus, {
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        context: {},
      })

      await expect(
        completeHandoff(bus, handoffId, 'agent-b', { result: {} })
      ).rejects.toThrow('Handoff not accepted')
    })
  })

  describe('handoff timeout handling', () => {
    it('should timeout pending handoff', async () => {
      vi.useFakeTimers()

      bus.subscribe('agent-a', vi.fn())
      bus.subscribe('agent-b', vi.fn())

      const { handoffId } = await initiateHandoff(bus, {
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        context: {},
        timeout: 1000,
      })

      vi.advanceTimersByTime(2000)

      const status = bus.getHandoffStatus(handoffId)
      expect(status).toBe('expired')

      vi.useRealTimers()
    })

    it('should notify initiator on timeout', async () => {
      vi.useFakeTimers()

      const timeoutHandler = vi.fn()
      bus.subscribe('agent-a', timeoutHandler)
      bus.subscribe('agent-b', vi.fn())

      await initiateHandoff(bus, {
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        context: {},
        timeout: 1000,
        onTimeout: timeoutHandler,
      })

      vi.advanceTimersByTime(2000)

      expect(timeoutHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'handoff',
          payload: expect.objectContaining({ action: 'timeout' }),
        })
      )

      vi.useRealTimers()
    })
  })

  describe('handoff failure recovery', () => {
    it('should allow retry after rejection', async () => {
      bus.subscribe('agent-a', vi.fn())
      bus.subscribe('agent-b', vi.fn())
      bus.subscribe('agent-c', vi.fn())

      // First handoff to agent-b rejected
      const { handoffId: firstId } = await initiateHandoff(bus, {
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        context: { task: 'process' },
      })

      await rejectHandoff(bus, firstId, 'agent-b', { reason: 'Busy' })

      // Retry to agent-c
      const { handoffId: secondId, status } = await initiateHandoff(bus, {
        fromAgent: 'agent-a',
        toAgent: 'agent-c',
        context: { task: 'process' },
        previousAttempt: firstId,
      })

      expect(status).toBe('pending')
      expect(secondId).not.toBe(firstId)
    })

    it('should track handoff history', async () => {
      bus.subscribe('agent-a', vi.fn())
      bus.subscribe('agent-b', vi.fn())
      bus.subscribe('agent-c', vi.fn())

      const { handoffId: firstId } = await initiateHandoff(bus, {
        fromAgent: 'agent-a',
        toAgent: 'agent-b',
        context: { task: 'process' },
      })

      await rejectHandoff(bus, firstId, 'agent-b', { reason: 'Busy' })

      const { handoffId: secondId } = await initiateHandoff(bus, {
        fromAgent: 'agent-a',
        toAgent: 'agent-c',
        context: { task: 'process' },
        previousAttempt: firstId,
      })

      await acceptHandoff(bus, secondId, 'agent-c')

      const history = bus.getHandoffHistory(secondId)
      expect(history).toContain(firstId)
    })
  })
})

// =============================================================================
// Message Persistence Tests
// =============================================================================

describe('Message Persistence', () => {
  let bus: AgentMessageBus

  beforeEach(() => {
    bus = createMessageBus({ persistence: true })
  })

  afterEach(() => {
    bus.dispose()
  })

  it('should persist messages', async () => {
    bus.subscribe('agent-b', vi.fn())

    await sendToAgent(bus, 'agent-a', 'agent-b', { data: 'test' })

    const messages = bus.getStoredMessages()
    expect(messages.length).toBeGreaterThan(0)
  })

  it('should retrieve message history', async () => {
    bus.subscribe('agent-b', vi.fn())

    await sendToAgent(bus, 'agent-a', 'agent-b', { n: 1 })
    await sendToAgent(bus, 'agent-a', 'agent-b', { n: 2 })
    await sendToAgent(bus, 'agent-a', 'agent-b', { n: 3 })

    const history = bus.getMessageHistory('agent-b', { limit: 2 })
    expect(history).toHaveLength(2)
  })

  it('should filter messages by time range', async () => {
    bus.subscribe('agent-b', vi.fn())

    const before = new Date()
    await sendToAgent(bus, 'agent-a', 'agent-b', { data: 'test' })
    const after = new Date()

    const messages = bus.getMessageHistory('agent-b', {
      from: before,
      to: after,
    })

    expect(messages.length).toBeGreaterThan(0)
  })

  it('should clear old messages', async () => {
    bus.subscribe('agent-b', vi.fn())

    await sendToAgent(bus, 'agent-a', 'agent-b', { data: 'test' })

    const beforeClear = bus.getStoredMessages().length
    bus.clearMessages({ olderThan: new Date(Date.now() + 1000) })
    const afterClear = bus.getStoredMessages().length

    expect(afterClear).toBeLessThan(beforeClear)
  })
})

// =============================================================================
// Integration with Worker Types
// =============================================================================

describe('Worker Integration', () => {
  let bus: AgentMessageBus

  beforeEach(() => {
    bus = createMessageBus()
  })

  afterEach(() => {
    bus.dispose()
  })

  it('should accept Worker as sender/recipient', async () => {
    bus.subscribe(agentB.id, vi.fn())

    const envelope = await sendToAgent(bus, agentA, agentB, {
      task: 'analyze',
    })

    expect(envelope.message.sender).toBe('agent-a')
    expect(envelope.message.recipient).toBe('agent-b')
  })

  it('should accept WorkerRef as sender/recipient', async () => {
    const refA: WorkerRef = { id: 'agent-a', name: 'Agent A' }
    const refB: WorkerRef = { id: 'agent-b', name: 'Agent B' }

    bus.subscribe(refB.id, vi.fn())

    const envelope = await sendToAgent(bus, refA, refB, { data: 'test' })

    expect(envelope.message.sender).toBe('agent-a')
    expect(envelope.message.recipient).toBe('agent-b')
  })

  it('should work with string agent IDs', async () => {
    bus.subscribe('target-agent', vi.fn())

    const envelope = await sendToAgent(
      bus,
      'source-agent',
      'target-agent',
      { data: 'test' }
    )

    expect(envelope.message.sender).toBe('source-agent')
    expect(envelope.message.recipient).toBe('target-agent')
  })
})
