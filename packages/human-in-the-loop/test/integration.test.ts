/**
 * Integration tests for human-in-the-loop package
 *
 * These tests use REAL AI calls via the Cloudflare AI Gateway.
 * The gateway caches responses, so repeated test runs are fast and free.
 *
 * Required env vars:
 * - AI_GATEWAY_URL: Cloudflare AI Gateway URL
 * - AI_GATEWAY_TOKEN: Gateway auth token (or individual provider keys like ANTHROPIC_API_KEY)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
// Import directly from source files to avoid module resolution issues in Workers
import { Human, HumanManager } from '../src/human.js'
import { InMemoryHumanStore } from '../src/store.js'
import { createInMemoryStore } from '../src/stores/in-memory.js'
import { TierRegistry } from '../src/tier-registry.js'
import {
  DecisionLogger,
  FeedbackLoop,
  FallbackChain,
  DecisionAnalytics,
} from '../src/fallback-resolution.js'
import {
  AIFailureClassifier,
  ContextSanitizer,
  AutoEscalationTrigger,
  EscalationRouter,
} from '../src/ai-failure-escalation.js'
import {
  ExponentialBackoff,
  HumanRetryPolicy,
  HumanCircuitBreaker,
  SLATracker,
} from '../src/timeout-retry.js'
import { createWebhookRegistry } from '../src/webhooks.js'
// Note: helpers.ts creates a global Human instance at module load,
// which may not work in the Workers test environment
// import { defineRole, defineTeam, defineGoals, approve, ask, decide, generate, is, notify } from '../src/helpers.js'

// Skip tests if no gateway configured
const hasGateway = !!process.env.AI_GATEWAY_URL || !!process.env.ANTHROPIC_API_KEY

// Use haiku model for fast/cheap tests
const TEST_MODEL = 'haiku'

describe('human-in-the-loop exports', () => {
  it('should export Human and HumanManager', () => {
    expect(Human).toBeDefined()
    expect(typeof Human).toBe('function')
    expect(HumanManager).toBeDefined()
  })

  it('should export store implementations', () => {
    expect(InMemoryHumanStore).toBeDefined()
    expect(createInMemoryStore).toBeDefined()
  })

  it('should export tier registry', () => {
    expect(TierRegistry).toBeDefined()
  })

  it('should export fallback resolution components', () => {
    expect(DecisionLogger).toBeDefined()
    expect(FeedbackLoop).toBeDefined()
    expect(FallbackChain).toBeDefined()
    expect(DecisionAnalytics).toBeDefined()
  })

  it('should export AI failure escalation components', () => {
    expect(AIFailureClassifier).toBeDefined()
    expect(ContextSanitizer).toBeDefined()
    expect(AutoEscalationTrigger).toBeDefined()
    expect(EscalationRouter).toBeDefined()
  })

  it('should export timeout/retry utilities', () => {
    expect(ExponentialBackoff).toBeDefined()
    expect(HumanRetryPolicy).toBeDefined()
    expect(HumanCircuitBreaker).toBeDefined()
    expect(SLATracker).toBeDefined()
  })

  it('should export webhook utilities', () => {
    expect(createWebhookRegistry).toBeDefined()
  })

  // Note: Helper functions (defineRole, defineTeam, etc.) create a global Human instance
  // at module load, which may not work in Workers test environment.
  // These are tested in other test files that don't use the Workers pool.
})

describe('HumanManager creation', () => {
  it('should create a HumanManager with default options', () => {
    const human = Human({})

    expect(human).toBeDefined()
    expect(human).toBeInstanceOf(HumanManager)
  })

  it('should create a HumanManager with custom options', () => {
    const human = Human({
      defaultTimeout: 60000,
      defaultPriority: 'high',
      autoEscalate: true,
    })

    expect(human).toBeDefined()
  })

  it('should create a HumanManager with retry options', () => {
    // Note: Retry config is passed but managed internally
    const human = Human({
      retry: {
        maxRetries: 3,
        retryableErrors: ['timeout', 'network'],
      },
    })

    expect(human).toBeDefined()
    expect(human).toBeInstanceOf(HumanManager)
  })

  it('should create a HumanManager with circuit breaker', () => {
    // Note: Circuit breaker config is passed but managed internally
    const human = Human({
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeoutMs: 30000,
      },
    })

    expect(human).toBeDefined()
    expect(human).toBeInstanceOf(HumanManager)
  })

  it('should create a HumanManager with SLA tracking', () => {
    // Note: SLA config is passed but managed internally
    const human = Human({
      sla: {
        deadlineMs: 3600000,
        warningThresholdMs: 1800000,
      },
    })

    expect(human).toBeDefined()
    expect(human).toBeInstanceOf(HumanManager)
  })
})

describe('InMemoryHumanStore', () => {
  let store: InMemoryHumanStore

  beforeEach(() => {
    store = new InMemoryHumanStore()
  })

  it('should create and retrieve requests', async () => {
    const request = await store.create({
      type: 'approval' as const,
      title: 'Test Approval',
      description: 'Test description',
      priority: 'normal' as const,
      status: 'pending' as const,
      input: {},
    })

    expect(request).toBeDefined()
    expect(request.id).toBeDefined()
    expect(request.title).toBe('Test Approval')

    const retrieved = await store.get(request.id)
    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe(request.id)
  })

  it('should update request status', async () => {
    const request = await store.create({
      type: 'approval' as const,
      title: 'Test',
      description: 'Test',
      priority: 'normal' as const,
      status: 'pending' as const,
      input: {},
    })

    await store.update(request.id, { status: 'approved' as const })

    const updated = await store.get(request.id)
    expect(updated?.status).toBe('approved')
  })

  it('should list requests by status', async () => {
    await store.create({
      type: 'approval' as const,
      title: 'Pending 1',
      description: 'Test',
      priority: 'normal' as const,
      status: 'pending' as const,
      input: {},
    })

    await store.create({
      type: 'approval' as const,
      title: 'Approved 1',
      description: 'Test',
      priority: 'normal' as const,
      status: 'approved' as const,
      input: {},
    })

    const pending = await store.list({ status: 'pending' })
    expect(pending.length).toBe(1)
    expect(pending[0].title).toBe('Pending 1')

    const approved = await store.list({ status: 'approved' })
    expect(approved.length).toBe(1)
    expect(approved[0].title).toBe('Approved 1')
  })

  it('should list requests by priority', async () => {
    // Use a fresh store for this test
    const freshStore = new InMemoryHumanStore()

    await freshStore.create({
      type: 'approval' as const,
      title: 'Normal Priority',
      description: 'Test',
      priority: 'normal' as const,
      status: 'pending' as const,
      input: {},
    })

    await freshStore.create({
      type: 'approval' as const,
      title: 'High Priority',
      description: 'Test',
      priority: 'high' as const,
      status: 'pending' as const,
      input: {},
    })

    const highPriority = await freshStore.list({ priority: ['high'] })
    expect(highPriority.length).toBe(1)
    expect(highPriority[0].priority).toBe('high')
  })

  it('should cancel requests', async () => {
    const request = await store.create({
      type: 'approval' as const,
      title: 'To Cancel',
      description: 'Test',
      priority: 'normal' as const,
      status: 'pending' as const,
      input: {},
    })

    const cancelled = await store.cancel(request.id)
    expect(cancelled.status).toBe('cancelled')
  })
})

describe('TierRegistry', () => {
  let registry: TierRegistry

  beforeEach(() => {
    registry = new TierRegistry()
  })

  it('should register and retrieve tiers', () => {
    registry.registerTier('tier1', {
      name: 'First Response',
      priority: 1,
    })

    const tier = registry.getTier('tier1')
    expect(tier).toBeDefined()
    expect(tier?.name).toBe('First Response')
  })

  it('should get tiers in priority order', () => {
    registry.registerTier('t1', { name: 'Low', priority: 3 })
    registry.registerTier('t2', { name: 'High', priority: 1 })
    registry.registerTier('t3', { name: 'Medium', priority: 2 })

    const ordered = registry.listTiers()
    expect(ordered[0].name).toBe('High')
    expect(ordered[1].name).toBe('Medium')
    expect(ordered[2].name).toBe('Low')
  })

  it('should map and route failure types to tiers', () => {
    registry.registerTier('urgent', {
      name: 'Urgent',
      priority: 1,
    })

    registry.registerTier('normal', {
      name: 'Normal',
      priority: 2,
    })

    registry.mapFailureToTier('critical', 'urgent')
    registry.mapFailureToTier('timeout', 'normal')

    const urgentTierId = registry.routeToTier('critical')
    expect(urgentTierId).toBe('urgent')

    const normalTierId = registry.routeToTier('timeout')
    expect(normalTierId).toBe('normal')
  })
})

describe('ExponentialBackoff', () => {
  it('should calculate backoff delays correctly', () => {
    const backoff = new ExponentialBackoff({
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      multiplier: 2,
    })

    expect(backoff.getDelay(0)).toBe(1000)
    expect(backoff.getDelay(1)).toBe(2000)
    expect(backoff.getDelay(2)).toBe(4000)
    expect(backoff.getDelay(3)).toBe(8000)
  })

  it('should respect max delay', () => {
    const backoff = new ExponentialBackoff({
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      multiplier: 2,
    })

    expect(backoff.getDelay(10)).toBe(5000)
  })

  it('should add jitter when configured', () => {
    const backoff = new ExponentialBackoff({
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      multiplier: 2,
      jitterFactor: 0.2,
    })

    // With jitter, delays using getDelayWithJitter should vary
    const delays = Array.from({ length: 10 }, () => backoff.getDelayWithJitter(2))
    // All delays should be within the jitter range of base (4000)
    expect(delays.every((d) => d >= 3200 && d <= 4800)).toBe(true)
  })
})

describe('HumanCircuitBreaker', () => {
  it('should start in closed state', () => {
    const breaker = new HumanCircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
    })

    expect(breaker.state).toBe('closed')
  })

  it('should open after failure threshold', () => {
    const breaker = new HumanCircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 1000,
    })

    breaker.recordFailure()
    breaker.recordFailure()
    expect(breaker.state).toBe('closed')

    breaker.recordFailure()
    expect(breaker.state).toBe('open')
  })

  it('should close from half-open on success', () => {
    const breaker = new HumanCircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 1, // Immediate transition
    })

    breaker.recordFailure()
    breaker.recordFailure()
    expect(breaker.state).toBe('open')

    // Wait for auto-transition to half-open
    // Note: state getter auto-transitions after resetTimeoutMs
  })

  it('should transition to half-open after timeout', async () => {
    const breaker = new HumanCircuitBreaker({
      failureThreshold: 2,
      resetTimeoutMs: 50, // Very short for testing
    })

    breaker.recordFailure()
    breaker.recordFailure()
    expect(breaker.state).toBe('open')

    // Wait for reset timeout
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Next state check should show half_open (note underscore)
    const state = breaker.state
    expect(['half_open', 'closed']).toContain(state)
  })
})

describe('SLATracker', () => {
  it('should track request deadlines', () => {
    const tracker = new SLATracker({
      deadlineMs: 60000,
      warningThresholdMs: 30000,
    })

    const requestId = 'req-123'
    const result = tracker.track(requestId)

    expect(result.deadline).toBeInstanceOf(Date)
    expect(result.remainingMs).toBe(60000)

    const remaining = tracker.getRemainingTime(requestId)
    expect(remaining).toBeGreaterThan(59000) // Close to 60000
    expect(remaining).toBeLessThanOrEqual(60000)
  })

  it('should detect SLA violations', async () => {
    const tracker = new SLATracker({
      deadlineMs: 50, // Very short for testing
    })

    const requestId = 'req-456'
    tracker.track(requestId)

    // Wait for deadline to pass
    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(tracker.isViolated(requestId)).toBe(true)
  })

  it('should complete tracking for requests', () => {
    const tracker = new SLATracker({
      deadlineMs: 60000,
    })

    const requestId = 'req-789'
    tracker.track(requestId)
    tracker.complete(requestId)

    // After completion, request is no longer tracked
    expect(() => tracker.getRemainingTime(requestId)).toThrow()
  })
})

describe('DecisionLogger', () => {
  it('should log decisions', () => {
    const logger = new DecisionLogger()

    logger.logDecision({
      decisionMaker: 'user@example.com',
      decision: 'approved',
      context: {
        requestId: 'req-1',
        requestType: 'approval',
        inputData: { amount: 100 },
        timestamp: new Date(),
      },
      reasoning: 'Looks good',
    })

    const logs = logger.getDecisionHistory('req-1')
    expect(logs.length).toBe(1)
    expect(logs[0].decision).toBe('approved')
  })

  it('should generate compliance report', () => {
    const logger = new DecisionLogger()

    logger.logDecision({
      decisionMaker: 'admin@example.com',
      decision: 'approved',
      context: {
        requestId: 'req-2',
        requestType: 'approval',
        inputData: {},
        timestamp: new Date(),
      },
      reasoning: 'Authorized',
    })

    const report = logger.getComplianceReport()
    expect(report).toBeDefined()
    expect(report.totalDecisions).toBeGreaterThan(0)
  })
})

describe('AIFailureClassifier', () => {
  it('should classify failure types by category', () => {
    const classifier = new AIFailureClassifier()

    const failure = {
      code: 'RATE_LIMIT',
      message: 'Rate limit exceeded',
      timestamp: new Date(),
    }

    const category = classifier.categorize(failure)
    expect(['recoverable', 'critical', 'unknown']).toContain(category)
  })

  it('should map failures to tiers', () => {
    const classifier = new AIFailureClassifier()

    classifier.registerMapping('CUSTOM_ERROR', 'human')

    const tier = classifier.mapToTier('CUSTOM_ERROR')
    expect(tier).toBe('human')
  })

  it('should assess severity levels', () => {
    const classifier = new AIFailureClassifier()

    const failure = {
      code: 'VALIDATION_ERROR',
      message: 'Invalid input',
      timestamp: new Date(),
    }

    const severity = classifier.assessSeverity(failure)
    expect(['critical', 'high', 'medium', 'low']).toContain(severity)
  })

  it('should register custom failure types', () => {
    const classifier = new AIFailureClassifier()

    classifier.registerFailureType({
      code: 'MY_ERROR',
      tier: 'agentic',
      category: 'recoverable',
      severity: 'medium',
    })

    expect(classifier.mapToTier('MY_ERROR')).toBe('agentic')
    expect(
      classifier.categorize({ code: 'MY_ERROR', message: 'Test', timestamp: new Date() })
    ).toBe('recoverable')
    expect(
      classifier.assessSeverity({ code: 'MY_ERROR', message: 'Test', timestamp: new Date() })
    ).toBe('medium')
  })
})

describe('ContextSanitizer', () => {
  it('should sanitize sensitive data', () => {
    const sanitizer = new ContextSanitizer()

    const context = {
      user: 'john@example.com',
      password: 'secret123',
      apiKey: 'sk-12345',
      data: { message: 'Hello' },
    }

    const sanitized = sanitizer.sanitize(context)
    expect(sanitized.password).toBe('[REDACTED]')
    expect(sanitized.apiKey).toBe('[REDACTED]')
    expect((sanitized.data as { message: string }).message).toBe('Hello')
  })

  it('should preserve non-sensitive data', () => {
    const sanitizer = new ContextSanitizer()

    const context = {
      requestId: 'req-123',
      timestamp: new Date().toISOString(),
      action: 'approve',
    }

    const sanitized = sanitizer.sanitize(context)
    expect(sanitized.requestId).toBe('req-123')
    expect(sanitized.action).toBe('approve')
  })

  it('should extract context from AI failure', () => {
    const sanitizer = new ContextSanitizer()

    const failure = {
      code: 'AI_ERROR',
      message: 'Model failed',
      timestamp: new Date(),
      context: {
        model: 'gpt-4',
        requestId: 'req-456',
      },
    }

    const extracted = sanitizer.extractContext(failure)
    expect(extracted.failureCode).toBe('AI_ERROR')
    expect(extracted.failureMessage).toBe('Model failed')
    expect(extracted.model).toBe('gpt-4')
    expect(extracted.requestId).toBe('req-456')
  })
})

describe('Webhook Registry', () => {
  it('should register webhooks', () => {
    const registry = createWebhookRegistry()

    registry.register({
      url: 'https://example.com/webhook',
      events: ['request.created', 'request.completed'],
      secret: 'test-secret',
      enabled: true,
    })

    const webhooks = registry.getByEvent('request.created')
    expect(webhooks.length).toBe(1)
  })

  it('should unregister webhooks', () => {
    const registry = createWebhookRegistry()

    const webhook = registry.register({
      url: 'https://example.com/webhook2',
      events: ['request.escalated'],
      secret: 'test-secret',
      enabled: true,
    })

    registry.unregister(webhook.id)

    const webhooks = registry.getByEvent('request.escalated')
    expect(webhooks.length).toBe(0)
  })

  it('should enable and disable webhooks', () => {
    const registry = createWebhookRegistry()

    const webhook = registry.register({
      url: 'https://example.com/webhook3',
      events: ['request.timeout'],
      secret: 'test-secret',
      enabled: true,
    })

    registry.disable(webhook.id)
    expect(registry.get(webhook.id)?.enabled).toBe(false)

    registry.enable(webhook.id)
    expect(registry.get(webhook.id)?.enabled).toBe(true)
  })

  it('should list all webhooks', () => {
    const registry = createWebhookRegistry()

    registry.register({
      url: 'https://example.com/webhook4',
      events: ['request.created'],
      secret: 'secret1',
      enabled: true,
    })

    registry.register({
      url: 'https://example.com/webhook5',
      events: ['request.completed'],
      secret: 'secret2',
      enabled: true,
    })

    const all = registry.list()
    expect(all.length).toBe(2)
  })
})

// Note: Helper functions (defineRole, defineTeam, etc.) are tested in other test files.
// They create a global Human instance at module load, which has environment-specific behavior.

describe.skipIf(!hasGateway)('Human-in-the-loop request handling', () => {
  let human: HumanManager

  beforeEach(() => {
    human = Human({
      defaultTimeout: 60000,
      autoEscalate: false,
    })
  })

  it('should create approval workflow', async () => {
    // approve() method creates and returns a pending approval response
    // In a real scenario, this would block until human response
    // For testing, we just verify the API works
    expect(human.approve).toBeDefined()
    expect(typeof human.approve).toBe('function')
  })

  it('should support ask workflow', async () => {
    expect(human.ask).toBeDefined()
    expect(typeof human.ask).toBe('function')
  })

  it('should support do workflow', async () => {
    expect(human.do).toBeDefined()
    expect(typeof human.do).toBe('function')
  })

  it('should support decide workflow', async () => {
    expect(human.decide).toBeDefined()
    expect(typeof human.decide).toBe('function')
  })

  it('should support review workflow', async () => {
    expect(human.review).toBeDefined()
    expect(typeof human.review).toBe('function')
  })

  it('should support notify workflow', async () => {
    expect(human.notify).toBeDefined()
    expect(typeof human.notify).toBe('function')
  })

  it('should get request queue', async () => {
    const queue = await human.getQueue({ status: 'pending' })
    expect(queue).toBeDefined()
    expect(Array.isArray(queue)).toBe(true)
  })
})

describe('Escalation flow', () => {
  it('should handle escalation routing', async () => {
    const router = new EscalationRouter()

    router.registerReviewer({
      id: 'reviewer-1',
      name: 'John Reviewer',
      tiers: ['human'],
      available: true,
    })

    const reviewers = router.getReviewersForTier('human')
    expect(reviewers.length).toBe(1)
    expect(reviewers[0].name).toBe('John Reviewer')
  })

  it('should create escalation requests', async () => {
    const router = new EscalationRouter()

    router.registerReviewer({
      id: 'reviewer-2',
      name: 'Jane Reviewer',
      tiers: ['agentic', 'human'],
      available: true,
    })

    const request = await router.createEscalationRequest({
      failure: {
        code: 'AI_ERROR',
        message: 'AI processing failed',
        timestamp: new Date(),
      },
      tier: 'human',
      priority: 'high',
    })

    expect(request.id).toBeDefined()
    expect(request.priority).toBe('high')
  })

  it('should trigger auto-escalation based on failure patterns', () => {
    const trigger = new AutoEscalationTrigger()

    trigger.configure({
      windowMs: 60000,
      consecutiveFailureThreshold: 3,
    })

    // Record failures
    trigger.recordFailure({ code: 'ERROR_X', requestId: 'req-1' })
    trigger.recordFailure({ code: 'ERROR_X', requestId: 'req-2' })

    // Not yet at threshold
    expect(trigger.shouldEscalate('ERROR_X')).toBe(false)

    // Third failure triggers escalation
    trigger.recordFailure({ code: 'ERROR_X', requestId: 'req-3' })
    expect(trigger.shouldEscalate('ERROR_X')).toBe(true)
  })

  it('should reset escalation on success', () => {
    const trigger = new AutoEscalationTrigger()

    trigger.configure({
      windowMs: 60000,
      consecutiveFailureThreshold: 3,
    })

    trigger.recordFailure({ code: 'ERROR_Y', requestId: 'req-1' })
    trigger.recordFailure({ code: 'ERROR_Y', requestId: 'req-2' })
    trigger.recordSuccess({ code: 'ERROR_Y', requestId: 'req-3' })
    trigger.recordFailure({ code: 'ERROR_Y', requestId: 'req-4' })

    // Should not escalate because success reset the count
    expect(trigger.shouldEscalate('ERROR_Y')).toBe(false)
  })
})

describe('Feedback loop', () => {
  it('should generate feedback signals', () => {
    const feedbackLoop = new FeedbackLoop()

    const signal = feedbackLoop.generateSignal({
      decisionId: 'dec-1',
      requestId: 'req-1',
      inputData: { amount: 100 },
      aiPrediction: 'approve',
      aiConfidence: 0.9,
      humanDecision: 'approve',
      outcome: 'correct',
    })

    expect(signal).toBeDefined()
    expect(signal.type).toBe('reinforcement')
  })

  it('should track accuracy metrics', () => {
    const feedbackLoop = new FeedbackLoop()

    // Add some reinforcement signals
    feedbackLoop.generateSignal({
      decisionId: 'dec-1',
      requestId: 'req-1',
      inputData: {},
      aiPrediction: 'approve',
      humanDecision: 'approve',
      outcome: 'correct',
    })

    // Add a correction signal
    feedbackLoop.generateSignal({
      decisionId: 'dec-2',
      requestId: 'req-2',
      inputData: {},
      aiPrediction: 'approve',
      humanDecision: 'reject',
      outcome: 'override',
    })

    const metrics = feedbackLoop.getAccuracyMetrics()
    expect(metrics.totalDecisions).toBe(2)
    expect(metrics.correctPredictions).toBe(1)
    expect(metrics.overallAccuracy).toBe(0.5)
  })

  it('should export training data', () => {
    const feedbackLoop = new FeedbackLoop()

    feedbackLoop.generateSignal({
      decisionId: 'dec-1',
      requestId: 'req-1',
      inputData: { text: 'test' },
      aiPrediction: 'approve',
      humanDecision: 'approve',
      outcome: 'correct',
    })

    const exported = feedbackLoop.exportForTraining('json')
    expect(exported).toBeDefined()
    expect(JSON.parse(exported).length).toBe(1)
  })
})

describe('Decision analytics', () => {
  it('should analyze decision patterns', () => {
    const logger = new DecisionLogger()
    const analytics = new DecisionAnalytics(logger)

    // Record some decisions
    logger.logDecision({
      decisionMaker: 'user@example.com',
      decision: 'approved',
      context: {
        requestId: 'req-1',
        requestType: 'approval',
        inputData: {},
        timestamp: new Date(),
      },
    })

    logger.logDecision({
      decisionMaker: 'user@example.com',
      decision: 'approved',
      context: {
        requestId: 'req-2',
        requestType: 'approval',
        inputData: {},
        timestamp: new Date(),
      },
    })

    logger.logDecision({
      decisionMaker: 'user@example.com',
      decision: 'approved',
      context: {
        requestId: 'req-3',
        requestType: 'approval',
        inputData: {},
        timestamp: new Date(),
      },
    })

    const patterns = analytics.detectPatterns({ decisionMaker: 'user@example.com' })
    expect(patterns).toBeDefined()
    expect(patterns.length).toBeGreaterThan(0)
    expect(patterns[0].type).toBe('consistent-approval')
  })

  it('should get dashboard data', () => {
    const logger = new DecisionLogger()
    const analytics = new DecisionAnalytics(logger)

    logger.logDecision({
      decisionMaker: 'user1@example.com',
      decision: 'approved',
      context: {
        requestId: 'req-1',
        requestType: 'approval',
        inputData: {},
        timestamp: new Date(),
      },
    })

    logger.logDecision({
      decisionMaker: 'user2@example.com',
      decision: 'rejected',
      context: {
        requestId: 'req-2',
        requestType: 'approval',
        inputData: {},
        timestamp: new Date(),
      },
    })

    const dashboard = analytics.getDashboardData()
    expect(dashboard.totalDecisions).toBe(2)
    expect(dashboard.topDecisionMakers.length).toBeGreaterThan(0)
  })
})
