/**
 * Type Safety Tests for digital-workers
 *
 * Tests verifying proper handling of optional properties with
 * `exactOptionalPropertyTypes: true` TypeScript configuration.
 *
 * With this setting, optional properties (prop?: T) cannot have `undefined`
 * explicitly assigned. Instead, use either:
 * 1. Conditional assignment pattern: `if (value !== undefined) result.prop = value`
 * 2. Spread pattern: `...(value !== undefined && { prop: value })`
 *
 * @packageDocumentation
 */

import { describe, it, expect, expectTypeOf } from 'vitest'
import type {
  Worker,
  WorkerRef,
  Contacts,
  ContactPreferences,
  EmailContact,
  SlackContact,
  PhoneContact,
  NotifyResult,
  AskResult,
  ApprovalResult,
  DecideResult,
  DoResult,
  WorkerTeam,
  WorkerRole,
  WorkerGoals,
  WorkerKPI,
  WorkerOKR,
  NotifyOptions,
  AskOptions,
  ApproveOptions,
  DecideOptions,
  DoOptions,
  GenerateOptions,
  GenerateResult,
  IsOptions,
  TypeCheckResult,
} from '../src/types.js'
import type {
  RouteResult,
  AgentInfo,
  TaskRequest,
  RoutingMetrics,
  AgentAvailability,
  RoutingRule,
  EscalationPath,
  CompositeBalancerConfig,
} from '../src/load-balancing.js'
import type {
  ClassifiedError,
  ErrorContext,
  EscalationPolicy,
  RetryConfig,
  RetryState,
  FallbackConfig,
  AgentForFallback,
  RecoveryState,
  EscalationResult,
  HandleErrorOptions,
} from '../src/error-escalation.js'
import type {
  EmailMessage,
  EmailSendResult,
  ApprovalRequestData,
  ParsedEmailReply,
  EmailTransportConfig,
} from '../src/transports/email.js'
import type {
  SlackMessage,
  SlackTransportConfig,
  WebhookHandlerResult,
} from '../src/transports/slack.js'
import type { TransportConfig, MessagePayload, DeliveryResult, Address } from '../src/transports.js'

// ============================================================================
// Helper Type Assertions
// ============================================================================

/**
 * Type-level assertion that T is assignable to U
 */
type AssertAssignable<T, U> = T extends U ? true : false

/**
 * Creates an object with conditional property assignment
 * This is the pattern used throughout the codebase
 */
function createWithConditionalProps<T extends object>(base: T, optionals: Partial<T>): T {
  const result = { ...base }
  for (const [key, value] of Object.entries(optionals)) {
    if (value !== undefined) {
      ;(result as Record<string, unknown>)[key] = value
    }
  }
  return result
}

// ============================================================================
// types.ts - Worker Types
// ============================================================================

describe('types.ts - Optional Property Handling', () => {
  describe('Worker interface', () => {
    it('should create Worker with conditional optional properties', () => {
      const id = 'worker_1'
      const name = 'Test Worker'
      const role = undefined // Simulating optional value that might be undefined

      // Pattern: conditional assignment
      const worker: Worker = {
        id,
        name,
        type: 'human',
        status: 'available',
        contacts: {},
      }

      if (role !== undefined) {
        worker.role = role as never // This branch won't execute
      }

      expect(worker.id).toBe('worker_1')
      expect('role' in worker).toBe(false)
    })

    it('should create Worker with spread pattern for optional properties', () => {
      const capabilityTier: 'code' | undefined = 'code'
      const skills: string[] | undefined = undefined

      const worker: Worker = {
        id: 'worker_2',
        name: 'Agent',
        type: 'agent',
        status: 'available',
        contacts: {},
        ...(capabilityTier !== undefined && { capabilityTier }),
        ...(skills !== undefined && { skills }),
      }

      expect(worker.capabilityTier).toBe('code')
      expect('skills' in worker).toBe(false)
    })

    it('should handle nested optional contact properties', () => {
      const slackUser: string | undefined = 'U12345'
      const slackChannel: string | undefined = undefined

      const slackContact: SlackContact = {}
      if (slackUser !== undefined) slackContact.user = slackUser
      if (slackChannel !== undefined) slackContact.channel = slackChannel

      const worker: Worker = {
        id: 'worker_3',
        name: 'Worker',
        type: 'human',
        status: 'available',
        contacts: {
          slack: slackContact,
        },
      }

      expect((worker.contacts.slack as SlackContact).user).toBe('U12345')
      expect('channel' in (worker.contacts.slack as SlackContact)).toBe(false)
    })
  })

  describe('WorkerRef interface', () => {
    it('should create WorkerRef with only defined optional properties', () => {
      const type: 'human' | 'agent' | undefined = 'human'
      const name: string | undefined = undefined
      const role: string | undefined = 'Engineer'

      const ref: WorkerRef = { id: 'ref_1' }
      if (type !== undefined) ref.type = type
      if (name !== undefined) ref.name = name
      if (role !== undefined) ref.role = role

      expect(ref.type).toBe('human')
      expect('name' in ref).toBe(false)
      expect(ref.role).toBe('Engineer')
    })
  })

  describe('ContactPreferences interface', () => {
    it('should handle all optional properties correctly', () => {
      const primary: 'email' | undefined = 'email'
      const urgent: 'slack' | undefined = undefined
      const fallback: ('email' | 'slack')[] | undefined = ['email', 'slack']

      const prefs: ContactPreferences = {}
      if (primary !== undefined) prefs.primary = primary
      if (urgent !== undefined) prefs.urgent = urgent
      if (fallback !== undefined) prefs.fallback = fallback

      expect(prefs.primary).toBe('email')
      expect('urgent' in prefs).toBe(false)
      expect(prefs.fallback).toEqual(['email', 'slack'])
    })
  })

  describe('Result types', () => {
    it('should create NotifyResult with conditional optional properties', () => {
      const messageId: string | undefined = 'msg_123'
      const sentAt: Date | undefined = undefined
      const recipients: WorkerRef[] | undefined = [{ id: 'alice' }]

      const result: NotifyResult = {
        sent: true,
        via: ['email'],
      }
      if (messageId !== undefined) result.messageId = messageId
      if (sentAt !== undefined) result.sentAt = sentAt
      if (recipients !== undefined) result.recipients = recipients

      expect(result.messageId).toBe('msg_123')
      expect('sentAt' in result).toBe(false)
      expect(result.recipients).toHaveLength(1)
    })

    it('should create ApprovalResult with conditional optional properties', () => {
      const approvedBy: WorkerRef | undefined = { id: 'manager' }
      const notes: string | undefined = undefined
      const via: 'email' | undefined = 'email'

      const result: ApprovalResult = { approved: true }
      if (approvedBy !== undefined) result.approvedBy = approvedBy
      if (notes !== undefined) result.notes = notes
      if (via !== undefined) result.via = via

      expect(result.approvedBy?.id).toBe('manager')
      expect('notes' in result).toBe(false)
      expect(result.via).toBe('email')
    })
  })

  describe('Options types', () => {
    it('should create NotifyOptions with conditional properties', () => {
      const via: 'slack' | undefined = 'slack'
      const priority: 'high' | undefined = undefined
      const timeout: number | undefined = 5000

      const options: NotifyOptions = {}
      if (via !== undefined) options.via = via
      if (priority !== undefined) options.priority = priority
      if (timeout !== undefined) options.timeout = timeout

      expect(options.via).toBe('slack')
      expect('priority' in options).toBe(false)
      expect(options.timeout).toBe(5000)
    })
  })
})

// ============================================================================
// load-balancing.ts - Route and Agent Types
// ============================================================================

describe('load-balancing.ts - Optional Property Handling', () => {
  describe('RouteResult interface', () => {
    it('should create RouteResult with conditional optional properties', () => {
      const reason: string | undefined = undefined
      const matchScore: number | undefined = 0.95
      const matchedRule: string | null | undefined = 'skill-match'

      const result: RouteResult = {
        agent: {
          id: 'agent_1',
          name: 'Test Agent',
          type: 'agent',
          status: 'available',
          skills: ['typescript'],
          currentLoad: 0,
          maxLoad: 10,
          contacts: {},
          metadata: {},
        },
        task: {
          id: 'task_1',
          name: 'Test Task',
          requiredSkills: ['typescript'],
          priority: 5,
          metadata: {},
        },
        strategy: 'capability',
        timestamp: new Date(),
      }
      if (reason !== undefined) result.reason = reason
      if (matchScore !== undefined) result.matchScore = matchScore
      if (matchedRule !== undefined) result.matchedRule = matchedRule

      expect('reason' in result).toBe(false)
      expect(result.matchScore).toBe(0.95)
      expect(result.matchedRule).toBe('skill-match')
    })

    it('should handle usedDefault and usedFallback optional flags', () => {
      const usedDefault: boolean | undefined = true
      const usedFallback: boolean | undefined = undefined

      const result: RouteResult = {
        agent: null,
        task: {
          id: 'task_2',
          name: 'Failed Task',
          requiredSkills: [],
          priority: 1,
          metadata: {},
        },
        strategy: 'round-robin',
        timestamp: new Date(),
        reason: 'no-available-agents',
      }
      if (usedDefault !== undefined) result.usedDefault = usedDefault
      if (usedFallback !== undefined) result.usedFallback = usedFallback

      expect(result.usedDefault).toBe(true)
      expect('usedFallback' in result).toBe(false)
    })
  })

  describe('TaskRequest interface', () => {
    it('should create TaskRequest with conditional enqueuedAt', () => {
      const enqueuedAt: Date | undefined = new Date()

      const task: TaskRequest = {
        id: 'task_1',
        name: 'Test',
        requiredSkills: [],
        priority: 5,
        metadata: {},
      }
      if (enqueuedAt !== undefined) task.enqueuedAt = enqueuedAt

      expect(task.enqueuedAt).toBeInstanceOf(Date)
    })
  })

  describe('AgentAvailability interface', () => {
    it('should handle optional load tracking', () => {
      const currentLoad: number | undefined = 5
      const maxLoad: number | undefined = undefined

      const availability: AgentAvailability = {
        status: 'available',
        lastSeen: new Date(),
      }
      if (currentLoad !== undefined) availability.currentLoad = currentLoad
      if (maxLoad !== undefined) availability.maxLoad = maxLoad

      expect(availability.currentLoad).toBe(5)
      expect('maxLoad' in availability).toBe(false)
    })
  })

  describe('RoutingRule interface', () => {
    it('should handle optional enabled and priority', () => {
      const enabled: boolean | undefined = true
      const priority: number | undefined = undefined

      const rule: RoutingRule = {
        name: 'test-rule',
        priority: 1,
        fromTier: 'code',
        toTier: 'generative',
        condition: () => true,
        action: () => null,
      }
      if (enabled !== undefined) rule.enabled = enabled
      if (priority !== undefined) rule.priority = priority

      expect(rule.enabled).toBe(true)
    })
  })

  describe('CompositeBalancerConfig interface', () => {
    it('should handle optional fallbackBehavior and customStrategies', () => {
      const fallbackBehavior: 'next-strategy' | 'none' | undefined = 'next-strategy'
      const customStrategies:
        | Record<string, (t: TaskRequest, a: AgentInfo[]) => AgentInfo | null>
        | undefined = undefined

      const config: CompositeBalancerConfig = {
        strategies: ['round-robin', 'least-busy'],
      }
      if (fallbackBehavior !== undefined) config.fallbackBehavior = fallbackBehavior
      if (customStrategies !== undefined) config.customStrategies = customStrategies

      expect(config.fallbackBehavior).toBe('next-strategy')
      expect('customStrategies' in config).toBe(false)
    })
  })
})

// ============================================================================
// error-escalation.ts - Error and Recovery Types
// ============================================================================

describe('error-escalation.ts - Optional Property Handling', () => {
  describe('ClassifiedError interface', () => {
    it('should create ClassifiedError with conditional optional properties', () => {
      const tier: 'code' | undefined = 'code'
      const agentId: string | undefined = undefined
      const taskId: string | undefined = 'task_123'
      const stack: string | undefined = 'Error: test\n  at test.js:1'
      const context: ErrorContext | undefined = { workflowId: 'wf_1' }

      const error: ClassifiedError = {
        id: 'err_1',
        original: new Error('Test error'),
        severity: 'medium',
        category: 'transient',
        timestamp: new Date(),
      }
      if (tier !== undefined) error.tier = tier
      if (agentId !== undefined) error.agentId = agentId
      if (taskId !== undefined) error.taskId = taskId
      if (stack !== undefined) error.stack = stack
      if (context !== undefined) error.context = context

      expect(error.tier).toBe('code')
      expect('agentId' in error).toBe(false)
      expect(error.taskId).toBe('task_123')
      expect(error.context?.workflowId).toBe('wf_1')
    })
  })

  describe('ErrorContext interface', () => {
    it('should handle all optional fields', () => {
      const workflowId: string | undefined = 'wf_1'
      const stepId: string | undefined = undefined
      const attemptNumber: number | undefined = 3
      const metadata: Record<string, unknown> | undefined = { key: 'value' }

      const context: ErrorContext = {}
      if (workflowId !== undefined) context.workflowId = workflowId
      if (stepId !== undefined) context.stepId = stepId
      if (attemptNumber !== undefined) context.attemptNumber = attemptNumber
      if (metadata !== undefined) context.metadata = metadata

      expect(context.workflowId).toBe('wf_1')
      expect('stepId' in context).toBe(false)
      expect(context.attemptNumber).toBe(3)
    })
  })

  describe('EscalationPolicy interface', () => {
    it('should handle optional skipTierThreshold and tierPolicies', () => {
      const skipTierThreshold: 'high' | undefined = 'high'
      const tierPolicies: Record<string, { maxRetries?: number }> | undefined = undefined

      const policy: EscalationPolicy = {
        maxEscalationDepth: 5,
        allowSkipTiers: true,
        rules: [],
      }
      if (skipTierThreshold !== undefined) policy.skipTierThreshold = skipTierThreshold
      if (tierPolicies !== undefined) policy.tierPolicies = tierPolicies

      expect(policy.skipTierThreshold).toBe('high')
      expect('tierPolicies' in policy).toBe(false)
    })
  })

  describe('RetryState interface', () => {
    it('should handle nullable Date properties', () => {
      // Note: These are explicitly typed as Date | null, not optional
      // This is correct usage - null means "not set yet"
      const state: RetryState = {
        attemptNumber: 0,
        lastAttemptTime: null,
        nextRetryTime: null,
        exhausted: false,
      }

      expect(state.lastAttemptTime).toBeNull()
      expect(state.nextRetryTime).toBeNull()
    })
  })

  describe('FallbackConfig interface', () => {
    it('should handle optional configuration fields', () => {
      const requiredSkills: string[] | undefined = ['typescript']
      const currentTier: 'code' | undefined = undefined
      const excludeAgentIds: string[] | undefined = ['agent_1']

      const config: FallbackConfig = {
        strategy: 'capability-match',
      }
      if (requiredSkills !== undefined) config.requiredSkills = requiredSkills
      if (currentTier !== undefined) config.currentTier = currentTier
      if (excludeAgentIds !== undefined) config.excludeAgentIds = excludeAgentIds

      expect(config.requiredSkills).toEqual(['typescript'])
      expect('currentTier' in config).toBe(false)
    })
  })

  describe('RecoveryState interface', () => {
    it('should handle optional agentId and resolution', () => {
      const agentId: string | undefined = 'agent_1'
      const resolution: string | undefined = undefined
      const isTerminal: boolean | undefined = false

      const state: RecoveryState = {
        errorId: 'err_1',
        tier: 'code',
        retryState: {
          attemptNumber: 0,
          lastAttemptTime: null,
          nextRetryTime: null,
          exhausted: false,
        },
        escalated: false,
        resolved: false,
        escalationPath: ['code'],
        fallbackHistory: [],
      }
      if (agentId !== undefined) state.agentId = agentId
      if (resolution !== undefined) state.resolution = resolution
      if (isTerminal !== undefined) state.isTerminal = isTerminal

      expect(state.agentId).toBe('agent_1')
      expect('resolution' in state).toBe(false)
      expect(state.isTerminal).toBe(false)
    })
  })

  describe('EscalationResult interface', () => {
    it('should handle conditional result properties', () => {
      const retryDelay: number | undefined = 1000
      const escalationPath: EscalationPath | undefined = undefined
      const degradationLevel: 'partial' | undefined = 'partial'

      const result: EscalationResult = {
        handled: true,
        action: 'retry',
        classifiedError: {
          id: 'err_1',
          original: new Error('Test'),
          severity: 'low',
          category: 'transient',
          timestamp: new Date(),
        },
      }
      if (retryDelay !== undefined) result.retryDelay = retryDelay
      if (escalationPath !== undefined) result.escalationPath = escalationPath
      if (degradationLevel !== undefined) result.degradationLevel = degradationLevel

      expect(result.retryDelay).toBe(1000)
      expect('escalationPath' in result).toBe(false)
      expect(result.degradationLevel).toBe('partial')
    })
  })
})

// ============================================================================
// transports/*.ts - Transport Types
// ============================================================================

describe('transports/email.ts - Optional Property Handling', () => {
  describe('EmailMessage interface', () => {
    it('should create EmailMessage with conditional optional properties', () => {
      const replyTo: string | undefined = 'reply@example.com'
      const text: string | undefined = undefined
      const html: string | undefined = '<p>Hello</p>'

      const message: EmailMessage = {
        to: 'test@example.com',
        from: 'sender@example.com',
        subject: 'Test',
      }
      if (replyTo !== undefined) message.replyTo = replyTo
      if (text !== undefined) message.text = text
      if (html !== undefined) message.html = html

      expect(message.replyTo).toBe('reply@example.com')
      expect('text' in message).toBe(false)
      expect(message.html).toBe('<p>Hello</p>')
    })
  })

  describe('EmailSendResult interface', () => {
    it('should handle optional messageId and error', () => {
      const messageId: string | undefined = 'msg_123'
      const error: string | undefined = undefined

      const result: EmailSendResult = { success: true }
      if (messageId !== undefined) result.messageId = messageId
      if (error !== undefined) result.error = error

      expect(result.messageId).toBe('msg_123')
      expect('error' in result).toBe(false)
    })
  })

  describe('ParsedEmailReply interface', () => {
    it('should handle multiple optional fields', () => {
      const approved: boolean | undefined = true
      const requestId: string | undefined = 'req_123'
      const notes: string | undefined = undefined
      const from: string | undefined = 'user@example.com'

      const reply: ParsedEmailReply = {
        isApprovalResponse: true,
      }
      if (approved !== undefined) reply.approved = approved
      if (requestId !== undefined) reply.requestId = requestId
      if (notes !== undefined) reply.notes = notes
      if (from !== undefined) reply.from = from

      expect(reply.approved).toBe(true)
      expect(reply.requestId).toBe('req_123')
      expect('notes' in reply).toBe(false)
      expect(reply.from).toBe('user@example.com')
    })
  })
})

describe('transports/slack.ts - Optional Property Handling', () => {
  describe('SlackMessage interface', () => {
    it('should handle optional thread and metadata', () => {
      const thread_ts: string | undefined = '1234567890.123456'
      const reply_broadcast: boolean | undefined = undefined

      const message: SlackMessage = {
        channel: '#general',
        text: 'Hello',
      }
      if (thread_ts !== undefined) message.thread_ts = thread_ts
      if (reply_broadcast !== undefined) message.reply_broadcast = reply_broadcast

      expect(message.thread_ts).toBe('1234567890.123456')
      expect('reply_broadcast' in message).toBe(false)
    })
  })

  describe('WebhookHandlerResult interface', () => {
    it('should handle multiple optional fields', () => {
      const actionId: string | undefined = 'approve_123'
      const userId: string | undefined = 'U12345'
      const channelId: string | undefined = undefined
      const error: string | undefined = undefined

      const result: WebhookHandlerResult = { success: true }
      if (actionId !== undefined) result.actionId = actionId
      if (userId !== undefined) result.userId = userId
      if (channelId !== undefined) result.channelId = channelId
      if (error !== undefined) result.error = error

      expect(result.actionId).toBe('approve_123')
      expect(result.userId).toBe('U12345')
      expect('channelId' in result).toBe(false)
      expect('error' in result).toBe(false)
    })
  })
})

describe('transports.ts - Optional Property Handling', () => {
  describe('DeliveryResult interface', () => {
    it('should handle optional messageId, error, and metadata', () => {
      const messageId: string | undefined = 'msg_123'
      const error: string | undefined = undefined
      const metadata: Record<string, unknown> | undefined = { provider: 'resend' }

      const result: DeliveryResult = {
        success: true,
        transport: 'email',
      }
      if (messageId !== undefined) result.messageId = messageId
      if (error !== undefined) result.error = error
      if (metadata !== undefined) result.metadata = metadata

      expect(result.messageId).toBe('msg_123')
      expect('error' in result).toBe(false)
      expect(result.metadata?.['provider']).toBe('resend')
    })
  })

  describe('Address interface', () => {
    it('should handle optional name and metadata', () => {
      const name: string | undefined = 'Test User'
      const metadata: Record<string, unknown> | undefined = undefined

      const address: Address = {
        transport: 'email',
        value: 'test@example.com',
      }
      if (name !== undefined) address.name = name
      if (metadata !== undefined) address.metadata = metadata

      expect(address.name).toBe('Test User')
      expect('metadata' in address).toBe(false)
    })
  })

  describe('MessagePayload interface', () => {
    it('should handle many optional message properties', () => {
      const from: string | undefined = 'system'
      const subject: string | undefined = undefined
      const priority: 'high' | undefined = 'high'
      const threadId: string | undefined = undefined

      const payload: MessagePayload = {
        to: 'user@example.com',
        body: 'Message content',
        type: 'notification',
      }
      if (from !== undefined) payload.from = from
      if (subject !== undefined) payload.subject = subject
      if (priority !== undefined) payload.priority = priority
      if (threadId !== undefined) payload.threadId = threadId

      expect(payload.from).toBe('system')
      expect('subject' in payload).toBe(false)
      expect(payload.priority).toBe('high')
      expect('threadId' in payload).toBe(false)
    })
  })
})

// ============================================================================
// Spread Pattern Tests
// ============================================================================

describe('Spread Pattern for Optional Properties', () => {
  it('should use spread pattern for object literals', () => {
    const optional1: string | undefined = 'value1'
    const optional2: string | undefined = undefined
    const optional3: number | undefined = 42

    interface TestInterface {
      required: string
      optional1?: string
      optional2?: string
      optional3?: number
    }

    const result: TestInterface = {
      required: 'base',
      ...(optional1 !== undefined && { optional1 }),
      ...(optional2 !== undefined && { optional2 }),
      ...(optional3 !== undefined && { optional3 }),
    }

    expect(result.required).toBe('base')
    expect(result.optional1).toBe('value1')
    expect('optional2' in result).toBe(false)
    expect(result.optional3).toBe(42)
  })

  it('should work with nested optional properties', () => {
    const nestedProp: { inner?: string } | undefined = { inner: 'nested' }
    const anotherNested: { value?: number } | undefined = undefined

    interface OuterInterface {
      id: string
      nested?: { inner?: string }
      another?: { value?: number }
    }

    const result: OuterInterface = {
      id: 'test',
      ...(nestedProp !== undefined && { nested: nestedProp }),
      ...(anotherNested !== undefined && { another: anotherNested }),
    }

    expect(result.nested?.inner).toBe('nested')
    expect('another' in result).toBe(false)
  })
})

// ============================================================================
// Type-Level Tests
// ============================================================================

describe('Type-Level Assertions', () => {
  it('should verify Worker type structure', () => {
    // Type-level test - ensures the interface structure is correct
    type WorkerKeys = keyof Worker
    expectTypeOf<WorkerKeys>().toMatchTypeOf<
      | 'id'
      | 'name'
      | 'type'
      | 'status'
      | 'contacts'
      | 'preferences'
      | 'role'
      | 'teams'
      | 'skills'
      | 'tools'
      | 'capabilityTier'
      | 'capabilityProfile'
      | 'metadata'
    >()
  })

  it('should verify RouteResult optional properties are not required', () => {
    // This should compile - reason is optional
    const minimalResult: RouteResult = {
      agent: null,
      task: {
        id: '1',
        name: 'test',
        requiredSkills: [],
        priority: 1,
        metadata: {},
      },
      strategy: 'round-robin',
      timestamp: new Date(),
    }

    expect(minimalResult).toBeDefined()
    expect('reason' in minimalResult).toBe(false)
  })

  it('should verify ClassifiedError optional properties are not required', () => {
    // This should compile - tier, agentId, etc. are optional
    const minimalError: ClassifiedError = {
      id: 'err_1',
      original: new Error('test'),
      severity: 'low',
      category: 'transient',
      timestamp: new Date(),
    }

    expect(minimalError).toBeDefined()
    expect('tier' in minimalError).toBe(false)
  })
})
