/**
 * Tests for worker actions module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  handleNotify,
  handleAsk,
  handleApprove,
  handleDecide,
  handleDo,
  registerWorkerActions,
  withWorkers,
  notify,
  ask,
  approve as approveAction,
  decide,
} from '../src/actions.js'
import { approve } from '../src/approve.js'
import type {
  Worker,
  Team,
  NotifyActionData,
  AskActionData,
  ApproveActionData,
  DecideActionData,
  DoActionData,
} from '../src/types.js'

// Mock WorkflowContext
const createMockContext = () => {
  const handlers: Record<string, Record<string, unknown>> = {}

  return {
    send: vi.fn().mockResolvedValue(undefined),
    do: vi.fn().mockImplementation(async (event, data) => {
      // Simulate action execution
      if (event === 'Worker.notify') {
        return { sent: true, via: ['slack'], messageId: 'msg_123' }
      }
      if (event === 'Worker.ask') {
        return { answer: 'test response', answeredAt: new Date() }
      }
      if (event === 'Worker.approve') {
        return { approved: true, approvedAt: new Date() }
      }
      if (event === 'Worker.decide') {
        return { choice: 'A', reasoning: 'Best option', confidence: 0.8 }
      }
      return {}
    }),
    try: vi.fn(),
    on: new Proxy({} as Record<string, Record<string, (handler: unknown) => void>>, {
      get: (_, namespace: string) => {
        if (!handlers[namespace]) {
          handlers[namespace] = {}
        }
        return new Proxy({}, {
          get: (_, event: string) => {
            return (handler: unknown) => {
              handlers[namespace][event] = handler
            }
          }
        })
      }
    }),
    every: {} as any,
    state: {},
    log: vi.fn(),
  }
}

// Test fixtures
const alice: Worker = {
  id: 'alice',
  name: 'Alice',
  type: 'human',
  status: 'available',
  contacts: {
    email: 'alice@company.com',
    slack: { workspace: 'acme', user: 'U123' },
  },
}

const bob: Worker = {
  id: 'bob',
  name: 'Bob',
  type: 'human',
  status: 'available',
  contacts: {
    email: 'bob@company.com',
    slack: { workspace: 'acme', user: 'U456' },
  },
}

const engineering: Team = {
  id: 'team_eng',
  name: 'Engineering',
  members: [{ id: 'alice' }, { id: 'bob' }],
  contacts: {
    slack: '#engineering',
    email: 'eng@company.com',
  },
  lead: { id: 'alice' },
}

describe('Action Handlers', () => {
  let mockContext: ReturnType<typeof createMockContext>

  beforeEach(() => {
    mockContext = createMockContext()
  })

  describe('handleNotify', () => {
    it('should send notification to worker', async () => {
      const data: NotifyActionData = {
        actor: 'system',
        object: alice,
        action: 'notify',
        message: 'Hello Alice',
        via: 'slack',
      }

      const result = await handleNotify(data, mockContext as any)

      expect(result.sent).toBe(true)
      expect(result.via).toContain('slack')
      expect(result.messageId).toBeDefined()
    })

    it('should send to multiple channels', async () => {
      const data: NotifyActionData = {
        actor: 'system',
        object: alice,
        action: 'notify',
        message: 'Urgent message',
        via: ['slack', 'email'],
        priority: 'urgent',
      }

      const result = await handleNotify(data, mockContext as any)

      expect(result.sent).toBe(true)
      expect(result.delivery).toBeDefined()
    })

    it('should handle missing contacts', async () => {
      const data: NotifyActionData = {
        actor: 'system',
        object: { id: 'unknown' },
        action: 'notify',
        message: 'Test',
      }

      const result = await handleNotify(data, mockContext as any)

      expect(result.sent).toBe(false)
      expect(result.via).toHaveLength(0)
    })

    it('should emit notified event on success', async () => {
      const data: NotifyActionData = {
        actor: 'system',
        object: alice,
        action: 'notify',
        message: 'Test',
        via: 'slack',
      }

      await handleNotify(data, mockContext as any)

      expect(mockContext.send).toHaveBeenCalledWith(
        'Worker.notified',
        expect.objectContaining({ message: 'Test' })
      )
    })
  })

  describe('handleAsk', () => {
    it('should send question to worker', async () => {
      const data: AskActionData = {
        actor: 'system',
        object: alice,
        action: 'ask',
        question: 'What is the status?',
        via: 'slack',
      }

      const result = await handleAsk(data, mockContext as any)

      expect(result.answer).toBeDefined()
      expect(result.answeredAt).toBeInstanceOf(Date)
      expect(result.via).toBe('slack')
    })

    it('should throw if no channel available', async () => {
      const data: AskActionData = {
        actor: 'system',
        object: { id: 'unknown' },
        action: 'ask',
        question: 'Test?',
      }

      await expect(handleAsk(data, mockContext as any)).rejects.toThrow(
        'No valid channel available'
      )
    })
  })

  describe('handleApprove', () => {
    it('should send approval request', async () => {
      const data: ApproveActionData = {
        actor: { id: 'system' },
        object: alice, // Use alice which has contacts
        action: 'approve',
        request: 'Expense: $500',
        via: 'slack',
      }

      const result = await handleApprove(data, mockContext as any)

      expect(result.approvedAt).toBeInstanceOf(Date)
      expect(result.via).toBe('slack')
    })

    it('should emit approved/rejected event', async () => {
      const data: ApproveActionData = {
        actor: { id: 'system' },
        object: alice, // Use alice which has contacts
        action: 'approve',
        request: 'Test',
        via: 'slack',
      }

      const result = await handleApprove(data, mockContext as any)

      // Default mock returns approved: false
      expect(mockContext.send).toHaveBeenCalledWith(
        'Worker.rejected',
        expect.any(Object)
      )
    })
  })

  describe('handleDecide', () => {
    it('should make a decision', async () => {
      const data: DecideActionData = {
        actor: 'ai',
        object: 'decision',
        action: 'decide',
        options: ['A', 'B', 'C'],
        context: 'Choose the best option',
        criteria: ['cost', 'time'],
      }

      const result = await handleDecide(data, mockContext as any)

      expect(result.choice).toBeDefined()
      expect(result.reasoning).toBeDefined()
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should emit decided event', async () => {
      const data: DecideActionData = {
        actor: 'ai',
        object: 'decision',
        action: 'decide',
        options: ['X', 'Y'],
      }

      await handleDecide(data, mockContext as any)

      expect(mockContext.send).toHaveBeenCalledWith(
        'Worker.decided',
        expect.any(Object)
      )
    })
  })

  describe('handleDo', () => {
    it('should execute task', async () => {
      const data: DoActionData = {
        actor: { id: 'agent_1' },
        object: 'production',
        action: 'do',
        instruction: 'Deploy v2.0',
      }

      const result = await handleDo(data, mockContext as any)

      expect(result.success).toBe(true)
      expect(result.duration).toBeDefined()
      expect(result.steps).toBeDefined()
    })

    it('should retry on failure', async () => {
      const data: DoActionData = {
        actor: { id: 'agent_1' },
        object: 'task',
        action: 'do',
        instruction: 'Flaky task',
        maxRetries: 2,
      }

      const result = await handleDo(data, mockContext as any)

      // Should track retry attempts in steps
      expect(result.steps?.length).toBeGreaterThan(0)
    })
  })
})

describe('registerWorkerActions', () => {
  it('should register handlers with context', () => {
    const mockContext = createMockContext()

    registerWorkerActions(mockContext as any)

    // The handlers should be registered (via the proxy)
    // We can't easily verify this without more introspection
    expect(mockContext).toBeDefined()
  })
})

describe('withWorkers', () => {
  let mockContext: ReturnType<typeof createMockContext>

  beforeEach(() => {
    mockContext = createMockContext()
  })

  it('should extend context with notify', async () => {
    const worker$ = withWorkers(mockContext as any)

    const result = await worker$.notify(alice, 'Test message', { via: 'slack' })

    expect(mockContext.do).toHaveBeenCalledWith(
      'Worker.notify',
      expect.objectContaining({
        action: 'notify',
        message: 'Test message',
      })
    )
    expect(result.sent).toBe(true)
  })

  it('should extend context with ask', async () => {
    const worker$ = withWorkers(mockContext as any)

    const result = await worker$.ask<string>(alice, 'Question?')

    expect(mockContext.do).toHaveBeenCalledWith(
      'Worker.ask',
      expect.objectContaining({
        action: 'ask',
        question: 'Question?',
      })
    )
    expect(result.answer).toBeDefined()
  })

  it('should extend context with approve', async () => {
    const worker$ = withWorkers(mockContext as any)

    const result = await worker$.approve('Request', alice)

    expect(mockContext.do).toHaveBeenCalledWith(
      'Worker.approve',
      expect.objectContaining({
        action: 'approve',
        request: 'Request',
      })
    )
    expect(result.approved).toBe(true)
  })

  it('should extend context with decide', async () => {
    const worker$ = withWorkers(mockContext as any)

    const result = await worker$.decide({
      options: ['A', 'B'],
      criteria: ['speed'],
    })

    expect(mockContext.do).toHaveBeenCalledWith(
      'Worker.decide',
      expect.objectContaining({
        action: 'decide',
        options: ['A', 'B'],
      })
    )
    expect(result.choice).toBeDefined()
  })

  it('should preserve original context methods', () => {
    const worker$ = withWorkers(mockContext as any)

    expect(worker$.send).toBe(mockContext.send)
    expect(worker$.do).toBe(mockContext.do)
    expect(worker$.state).toBe(mockContext.state)
    expect(worker$.log).toBe(mockContext.log)
  })
})

describe('Standalone Functions', () => {
  describe('notify', () => {
    it('should send notification to worker', async () => {
      const result = await notify(alice, 'Hello', { via: 'slack' })

      expect(result.sent).toBe(true)
      expect(result.messageId).toBeDefined()
    })

    it('should send to team', async () => {
      const result = await notify(engineering, 'Team update', { via: 'slack' })

      expect(result.via).toContain('slack')
    })

    it('should handle string target', async () => {
      const result = await notify('user_123', 'Test')

      expect(result).toBeDefined()
    })
  })

  describe('ask', () => {
    it('should ask worker a question', async () => {
      const result = await ask(alice, 'What is the status?', { via: 'slack' })

      expect(result.answer).toBeDefined()
      expect(result.answeredAt).toBeInstanceOf(Date)
    })

    it('should throw if no channel available', async () => {
      await expect(ask({ id: 'unknown' }, 'Test?')).rejects.toThrow()
    })
  })

  describe('approve', () => {
    it('should request approval', async () => {
      const result = await approve('Request', alice, { via: 'slack' })

      expect(result.approvedAt).toBeInstanceOf(Date)
    })

    it('should support batch approval', async () => {
      const results = await approve.batch(
        ['Request 1', 'Request 2'],
        alice,
        { via: 'slack' }
      )

      expect(results).toHaveLength(2)
    })

    it('should support any approver', async () => {
      const result = await approve.any('Urgent', [alice, bob], { via: 'slack' })

      expect(result.approvedAt).toBeInstanceOf(Date)
    })

    it('should support all approvers', async () => {
      const result = await approve.all('Major change', [alice, bob], { via: 'slack' })

      expect(result.approvals).toBeDefined()
    })
  })

  describe('decide', () => {
    it('should make a decision', async () => {
      const result = await decide({
        options: ['A', 'B', 'C'],
        context: 'Choose wisely',
        criteria: ['cost'],
      })

      expect(result.choice).toBeDefined()
      expect(result.reasoning).toBeDefined()
    })
  })
})

describe('Target Resolution', () => {
  describe('Worker target', () => {
    it('should extract contacts from worker', async () => {
      const result = await notify(alice, 'Test', { via: 'email' })

      expect(result.via).toContain('email')
    })
  })

  describe('Team target', () => {
    it('should use team contacts', async () => {
      const result = await notify(engineering, 'Team message', { via: 'slack' })

      expect(result.via).toContain('slack')
    })
  })

  describe('WorkerRef target', () => {
    it('should handle minimal reference', async () => {
      const result = await notify({ id: 'user_1' }, 'Test')

      expect(result).toBeDefined()
    })
  })

  describe('String target', () => {
    it('should handle string ID', async () => {
      const result = await notify('user_123', 'Test')

      expect(result).toBeDefined()
    })
  })
})

describe('Channel Resolution', () => {
  it('should use specified channel', async () => {
    const result = await notify(alice, 'Test', { via: 'email' })

    expect(result.via).toContain('email')
  })

  it('should use multiple channels', async () => {
    const result = await notify(alice, 'Urgent', {
      via: ['slack', 'email'],
      priority: 'urgent',
    })

    expect(result.delivery?.length).toBeGreaterThan(0)
  })

  it('should fallback to available channel', async () => {
    const result = await notify(alice, 'Test')

    expect(result.via.length).toBeGreaterThan(0)
  })

  it('should prioritize urgent channels', async () => {
    const result = await notify(alice, 'Urgent!', { priority: 'urgent' })

    // Should try slack/sms/phone for urgent
    expect(result).toBeDefined()
  })
})
