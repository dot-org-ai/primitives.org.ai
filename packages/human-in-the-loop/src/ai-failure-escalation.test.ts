/**
 * Tests for AI Failure to Human Escalation Integration
 *
 * This module tests the integration between AI failures and human escalation.
 * It covers:
 * - Failure type mapping to escalation tiers
 * - Context extraction and sanitization
 * - Auto-escalation triggers based on failure patterns
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  AIFailureClassifier,
  FailureCategory,
  FailureSeverity,
  AIFailure,
  ContextSanitizer,
  SanitizedContext,
  AutoEscalationTrigger,
  EscalationConfig,
  EscalationRouter,
  EscalationRoute,
} from './ai-failure-escalation.js'

describe('AIFailureClassifier', () => {
  let classifier: AIFailureClassifier

  beforeEach(() => {
    classifier = new AIFailureClassifier()
  })

  describe('Failure Type Mapping', () => {
    it('should map AI error codes to human escalation tiers', () => {
      // Rate limit errors should go to code tier (retry)
      expect(classifier.mapToTier('rate_limit_exceeded')).toBe('code')
      expect(classifier.mapToTier('timeout')).toBe('code')
      expect(classifier.mapToTier('service_unavailable')).toBe('code')

      // Generation failures should go to generative tier (regenerate)
      expect(classifier.mapToTier('invalid_output_format')).toBe('generative')
      expect(classifier.mapToTier('content_filter_triggered')).toBe('generative')
      expect(classifier.mapToTier('hallucination_detected')).toBe('generative')

      // Complex reasoning failures should go to agentic tier
      expect(classifier.mapToTier('reasoning_loop_detected')).toBe('agentic')
      expect(classifier.mapToTier('context_overflow')).toBe('agentic')

      // Critical failures should go to human tier
      expect(classifier.mapToTier('safety_violation')).toBe('human')
      expect(classifier.mapToTier('approval_required')).toBe('human')
      expect(classifier.mapToTier('data_integrity_error')).toBe('human')
    })

    it('should return undefined for unknown error codes', () => {
      expect(classifier.mapToTier('unknown_error_xyz')).toBeUndefined()
    })

    it('should support custom tier mappings', () => {
      classifier.registerMapping('custom_error', 'human')
      expect(classifier.mapToTier('custom_error')).toBe('human')
    })

    it('should allow updating existing mappings', () => {
      classifier.registerMapping('rate_limit_exceeded', 'human')
      expect(classifier.mapToTier('rate_limit_exceeded')).toBe('human')
    })
  })

  describe('Failure Categorization', () => {
    it('should categorize failures as recoverable', () => {
      const failure: AIFailure = {
        code: 'rate_limit_exceeded',
        message: 'Rate limit exceeded',
        timestamp: new Date(),
      }

      const category = classifier.categorize(failure)
      expect(category).toBe('recoverable')
    })

    it('should categorize failures as critical', () => {
      const failure: AIFailure = {
        code: 'safety_violation',
        message: 'Safety policy violated',
        timestamp: new Date(),
      }

      const category = classifier.categorize(failure)
      expect(category).toBe('critical')
    })

    it('should categorize unknown failures as unknown', () => {
      const failure: AIFailure = {
        code: 'completely_unknown_error',
        message: 'Unknown error occurred',
        timestamp: new Date(),
      }

      const category = classifier.categorize(failure)
      expect(category).toBe('unknown')
    })

    it('should support custom category rules', () => {
      classifier.registerCategoryRule(
        (failure) => failure.code.startsWith('custom_'),
        'recoverable'
      )

      const failure: AIFailure = {
        code: 'custom_validation_error',
        message: 'Custom validation failed',
        timestamp: new Date(),
      }

      expect(classifier.categorize(failure)).toBe('recoverable')
    })
  })

  describe('Failure Severity Assessment', () => {
    it('should assess severity based on failure type', () => {
      expect(classifier.assessSeverity({ code: 'timeout', message: '', timestamp: new Date() })).toBe('low')
      expect(classifier.assessSeverity({ code: 'invalid_output_format', message: '', timestamp: new Date() })).toBe('medium')
      expect(classifier.assessSeverity({ code: 'safety_violation', message: '', timestamp: new Date() })).toBe('critical')
    })

    it('should consider failure frequency in severity assessment', () => {
      // Simulate multiple failures
      const failure: AIFailure = { code: 'timeout', message: '', timestamp: new Date() }

      // First occurrence - low severity
      expect(classifier.assessSeverity(failure)).toBe('low')

      // Track the failure
      classifier.trackFailure(failure)
      classifier.trackFailure(failure)
      classifier.trackFailure(failure)

      // After multiple occurrences - elevated severity
      expect(classifier.assessSeverity(failure, { checkFrequency: true })).toBe('medium')
    })
  })

  describe('Custom Failure Type Registration', () => {
    it('should register custom failure types with full configuration', () => {
      classifier.registerFailureType({
        code: 'ml_model_drift',
        tier: 'agentic',
        category: 'recoverable',
        severity: 'high',
        description: 'ML model has drifted from expected behavior',
      })

      expect(classifier.mapToTier('ml_model_drift')).toBe('agentic')

      const failure: AIFailure = { code: 'ml_model_drift', message: '', timestamp: new Date() }
      expect(classifier.categorize(failure)).toBe('recoverable')
      expect(classifier.assessSeverity(failure)).toBe('high')
    })

    it('should unregister custom failure types', () => {
      classifier.registerFailureType({
        code: 'temp_error',
        tier: 'code',
        category: 'recoverable',
        severity: 'low',
      })

      expect(classifier.mapToTier('temp_error')).toBe('code')

      classifier.unregisterFailureType('temp_error')
      expect(classifier.mapToTier('temp_error')).toBeUndefined()
    })

    it('should list all registered failure types', () => {
      const types = classifier.listFailureTypes()

      expect(types).toContain('rate_limit_exceeded')
      expect(types).toContain('safety_violation')
      expect(types).toContain('approval_required')
    })
  })
})

describe('ContextSanitizer', () => {
  let sanitizer: ContextSanitizer

  beforeEach(() => {
    sanitizer = new ContextSanitizer()
  })

  describe('Context Extraction', () => {
    it('should extract relevant context from AI failure responses', () => {
      const failure: AIFailure = {
        code: 'invalid_output_format',
        message: 'Expected JSON but got text',
        timestamp: new Date(),
        context: {
          model: 'gpt-4',
          prompt: 'Generate a JSON response',
          response: '{"invalid": json}',
          requestId: 'req_123',
        },
      }

      const extracted = sanitizer.extractContext(failure)

      expect(extracted.failureCode).toBe('invalid_output_format')
      expect(extracted.failureMessage).toBe('Expected JSON but got text')
      expect(extracted.model).toBe('gpt-4')
      expect(extracted.requestId).toBe('req_123')
    })

    it('should include stack trace for debugging when enabled', () => {
      const failure: AIFailure = {
        code: 'runtime_error',
        message: 'Unexpected error',
        timestamp: new Date(),
        error: new Error('Something went wrong'),
      }

      const extracted = sanitizer.extractContext(failure, { includeStackTrace: true })

      expect(extracted.stackTrace).toBeDefined()
      expect(extracted.stackTrace).toContain('Error: Something went wrong')
    })

    it('should exclude stack trace by default', () => {
      const failure: AIFailure = {
        code: 'runtime_error',
        message: 'Unexpected error',
        timestamp: new Date(),
        error: new Error('Something went wrong'),
      }

      const extracted = sanitizer.extractContext(failure)

      expect(extracted.stackTrace).toBeUndefined()
    })
  })

  describe('Sensitive Data Sanitization', () => {
    it('should redact API keys from context', () => {
      const context = {
        apiKey: 'sk-1234567890abcdef',
        message: 'API call failed',
        headers: {
          Authorization: 'Bearer sk-secret-key-here',
        },
      }

      const sanitized = sanitizer.sanitize(context)

      expect(sanitized.apiKey).toBe('[REDACTED]')
      expect(sanitized.headers?.Authorization).toBe('[REDACTED]')
    })

    it('should redact passwords and secrets', () => {
      const context = {
        password: 'super-secret-123',
        dbPassword: 'db-pass-456',
        secret: 'my-secret-value',
        secretKey: 'key-789',
      }

      const sanitized = sanitizer.sanitize(context)

      expect(sanitized.password).toBe('[REDACTED]')
      expect(sanitized.dbPassword).toBe('[REDACTED]')
      expect(sanitized.secret).toBe('[REDACTED]')
      expect(sanitized.secretKey).toBe('[REDACTED]')
    })

    it('should redact credit card numbers', () => {
      const context = {
        message: 'Payment failed',
        cardNumber: '4111-1111-1111-1111',
        details: 'Card 4532015112830366 was declined',
      }

      const sanitized = sanitizer.sanitize(context)

      expect(sanitized.cardNumber).toBe('[REDACTED]')
      expect(sanitized.details).not.toContain('4532015112830366')
      expect(sanitized.details).toContain('[REDACTED]')
    })

    it('should redact email addresses when configured', () => {
      const sanitizerWithEmail = new ContextSanitizer({ redactEmails: true })
      const context = {
        userEmail: 'user@example.com',
        message: 'Error for user test@test.com',
      }

      const sanitized = sanitizerWithEmail.sanitize(context)

      expect(sanitized.userEmail).toBe('[REDACTED]')
      expect(sanitized.message).not.toContain('test@test.com')
    })

    it('should allow custom redaction patterns', () => {
      sanitizer.addRedactionPattern(/SSN-\d{3}-\d{2}-\d{4}/g, 'SSN pattern')

      const context = {
        message: 'User SSN-123-45-6789 failed verification',
      }

      const sanitized = sanitizer.sanitize(context)

      expect(sanitized.message).not.toContain('SSN-123-45-6789')
      expect(sanitized.message).toContain('[REDACTED]')
    })

    it('should handle nested objects', () => {
      const context = {
        user: {
          name: 'John',
          credentials: {
            apiKey: 'secret-api-key',
            password: 'user-password',
          },
        },
      }

      const sanitized = sanitizer.sanitize(context)

      expect(sanitized.user?.name).toBe('John')
      expect(sanitized.user?.credentials?.apiKey).toBe('[REDACTED]')
      expect(sanitized.user?.credentials?.password).toBe('[REDACTED]')
    })

    it('should handle arrays', () => {
      const context = {
        users: [
          { name: 'Alice', apiKey: 'key-1' },
          { name: 'Bob', apiKey: 'key-2' },
        ],
      }

      const sanitized = sanitizer.sanitize(context)

      expect(sanitized.users?.[0]?.name).toBe('Alice')
      expect(sanitized.users?.[0]?.apiKey).toBe('[REDACTED]')
      expect(sanitized.users?.[1]?.apiKey).toBe('[REDACTED]')
    })
  })

  describe('Context Enrichment', () => {
    it('should add timestamps to context', () => {
      const context = { message: 'Test failure' }

      const enriched = sanitizer.enrich(context)

      expect(enriched.timestamp).toBeDefined()
      expect(enriched.timestamp).toBeInstanceOf(Date)
    })

    it('should add request IDs when not present', () => {
      const context = { message: 'Test failure' }

      const enriched = sanitizer.enrich(context)

      expect(enriched.requestId).toBeDefined()
      expect(enriched.requestId).toMatch(/^req_/)
    })

    it('should preserve existing request IDs', () => {
      const context = { message: 'Test failure', requestId: 'req_existing_123' }

      const enriched = sanitizer.enrich(context)

      expect(enriched.requestId).toBe('req_existing_123')
    })

    it('should add environment metadata', () => {
      const context = { message: 'Test failure' }

      const enriched = sanitizer.enrich(context, {
        includeEnvironment: true,
        environment: 'production',
      })

      expect(enriched.environment).toBe('production')
    })

    it('should add correlation ID for tracing', () => {
      const context = { message: 'Test failure' }

      const enriched = sanitizer.enrich(context, { correlationId: 'corr_abc123' })

      expect(enriched.correlationId).toBe('corr_abc123')
    })
  })
})

describe('AutoEscalationTrigger', () => {
  let trigger: AutoEscalationTrigger

  beforeEach(() => {
    trigger = new AutoEscalationTrigger()
  })

  describe('Pattern-Based Escalation', () => {
    it('should trigger escalation after consecutive failures', () => {
      const config: EscalationConfig = {
        consecutiveFailureThreshold: 3,
        windowMs: 60000, // 1 minute
      }

      trigger.configure(config)

      // Simulate 3 consecutive failures
      trigger.recordFailure({ code: 'timeout', requestId: 'req_1' })
      trigger.recordFailure({ code: 'timeout', requestId: 'req_2' })
      trigger.recordFailure({ code: 'timeout', requestId: 'req_3' })

      expect(trigger.shouldEscalate('timeout')).toBe(true)
    })

    it('should not trigger escalation below threshold', () => {
      const config: EscalationConfig = {
        consecutiveFailureThreshold: 5,
        windowMs: 60000,
      }

      trigger.configure(config)

      trigger.recordFailure({ code: 'timeout', requestId: 'req_1' })
      trigger.recordFailure({ code: 'timeout', requestId: 'req_2' })

      expect(trigger.shouldEscalate('timeout')).toBe(false)
    })

    it('should reset counter on success', () => {
      trigger.configure({ consecutiveFailureThreshold: 3, windowMs: 60000 })

      trigger.recordFailure({ code: 'timeout', requestId: 'req_1' })
      trigger.recordFailure({ code: 'timeout', requestId: 'req_2' })
      trigger.recordSuccess({ code: 'timeout', requestId: 'req_3' })
      trigger.recordFailure({ code: 'timeout', requestId: 'req_4' })

      expect(trigger.shouldEscalate('timeout')).toBe(false)
    })
  })

  describe('Rate-Based Escalation', () => {
    it('should trigger escalation when failure rate exceeds threshold', () => {
      trigger.configure({
        failureRateThreshold: 0.5, // 50%
        minSampleSize: 4,
        windowMs: 60000,
      })

      // 3 failures out of 4 = 75% failure rate
      trigger.recordFailure({ code: 'api_error', requestId: 'req_1' })
      trigger.recordFailure({ code: 'api_error', requestId: 'req_2' })
      trigger.recordFailure({ code: 'api_error', requestId: 'req_3' })
      trigger.recordSuccess({ code: 'api_error', requestId: 'req_4' })

      expect(trigger.shouldEscalate('api_error')).toBe(true)
    })

    it('should not trigger below minimum sample size', () => {
      trigger.configure({
        failureRateThreshold: 0.5,
        minSampleSize: 10,
        windowMs: 60000,
      })

      trigger.recordFailure({ code: 'api_error', requestId: 'req_1' })
      trigger.recordFailure({ code: 'api_error', requestId: 'req_2' })
      trigger.recordFailure({ code: 'api_error', requestId: 'req_3' })

      expect(trigger.shouldEscalate('api_error')).toBe(false)
    })
  })

  describe('Escalation Threshold Configuration', () => {
    it('should support per-error-code thresholds', () => {
      trigger.configure({
        thresholds: {
          'safety_violation': { consecutiveFailureThreshold: 1 }, // Immediate
          'timeout': { consecutiveFailureThreshold: 5 }, // More tolerance
        },
        windowMs: 60000,
      })

      trigger.recordFailure({ code: 'safety_violation', requestId: 'req_1' })
      expect(trigger.shouldEscalate('safety_violation')).toBe(true)

      trigger.recordFailure({ code: 'timeout', requestId: 'req_2' })
      expect(trigger.shouldEscalate('timeout')).toBe(false)
    })

    it('should support time-based windows', () => {
      vi.useFakeTimers()

      trigger.configure({
        consecutiveFailureThreshold: 3,
        windowMs: 1000, // 1 second
      })

      trigger.recordFailure({ code: 'timeout', requestId: 'req_1' })
      trigger.recordFailure({ code: 'timeout', requestId: 'req_2' })

      // Move time forward past window
      vi.advanceTimersByTime(2000)

      trigger.recordFailure({ code: 'timeout', requestId: 'req_3' })

      // Should not escalate because old failures are outside window
      expect(trigger.shouldEscalate('timeout')).toBe(false)

      vi.useRealTimers()
    })

    it('should support cooldown period after escalation', () => {
      trigger.configure({
        consecutiveFailureThreshold: 2,
        windowMs: 60000,
        cooldownMs: 5000,
      })

      trigger.recordFailure({ code: 'timeout', requestId: 'req_1' })
      trigger.recordFailure({ code: 'timeout', requestId: 'req_2' })

      expect(trigger.shouldEscalate('timeout')).toBe(true)

      // Acknowledge escalation
      trigger.acknowledgeEscalation('timeout')

      // Immediate new failure should not trigger during cooldown
      trigger.recordFailure({ code: 'timeout', requestId: 'req_3' })
      trigger.recordFailure({ code: 'timeout', requestId: 'req_4' })

      expect(trigger.shouldEscalate('timeout')).toBe(false)
    })
  })

  describe('Escalation Notifications', () => {
    it('should emit escalation event when triggered', () => {
      const onEscalation = vi.fn()
      trigger.configure({
        consecutiveFailureThreshold: 2,
        windowMs: 60000,
        onEscalation,
      })

      trigger.recordFailure({ code: 'timeout', requestId: 'req_1' })
      trigger.recordFailure({ code: 'timeout', requestId: 'req_2' })

      trigger.checkAndEscalate('timeout')

      expect(onEscalation).toHaveBeenCalledWith(
        expect.objectContaining({
          failureCode: 'timeout',
          failureCount: 2,
          triggeredAt: expect.any(Date),
        })
      )
    })

    it('should provide escalation context', () => {
      const onEscalation = vi.fn()
      trigger.configure({
        consecutiveFailureThreshold: 2,
        windowMs: 60000,
        onEscalation,
      })

      trigger.recordFailure({
        code: 'timeout',
        requestId: 'req_1',
        context: { model: 'gpt-4' },
      })
      trigger.recordFailure({
        code: 'timeout',
        requestId: 'req_2',
        context: { model: 'gpt-4' },
      })

      trigger.checkAndEscalate('timeout')

      expect(onEscalation).toHaveBeenCalledWith(
        expect.objectContaining({
          recentFailures: expect.arrayContaining([
            expect.objectContaining({ requestId: 'req_1' }),
            expect.objectContaining({ requestId: 'req_2' }),
          ]),
        })
      )
    })
  })

  describe('Escalation Routing', () => {
    it('should route to appropriate tier based on failure pattern', () => {
      trigger.configure({
        consecutiveFailureThreshold: 2,
        windowMs: 60000,
        routingRules: [
          { pattern: /timeout/, tier: 'code' },
          { pattern: /safety_/, tier: 'human' },
          { pattern: /reasoning_/, tier: 'agentic' },
        ],
      })

      trigger.recordFailure({ code: 'timeout', requestId: 'req_1' })
      trigger.recordFailure({ code: 'timeout', requestId: 'req_2' })

      const route = trigger.getEscalationRoute('timeout')
      expect(route?.tier).toBe('code')

      trigger.recordFailure({ code: 'safety_violation', requestId: 'req_3' })
      trigger.recordFailure({ code: 'safety_violation', requestId: 'req_4' })

      const safetyRoute = trigger.getEscalationRoute('safety_violation')
      expect(safetyRoute?.tier).toBe('human')
    })
  })
})

describe('EscalationRouter', () => {
  let router: EscalationRouter

  beforeEach(() => {
    router = new EscalationRouter()
  })

  describe('Routing to Human Reviewers', () => {
    it('should route failures to appropriate human reviewers based on tier', () => {
      router.registerReviewer({
        id: 'reviewer_1',
        name: 'Senior Engineer',
        tiers: ['code', 'generative'],
        capabilities: ['debugging', 'ai-output-review'],
      })

      router.registerReviewer({
        id: 'reviewer_2',
        name: 'AI Safety Team',
        tiers: ['human'],
        capabilities: ['safety-review', 'policy-compliance'],
      })

      const codeReviewers = router.getReviewersForTier('code')
      expect(codeReviewers).toHaveLength(1)
      expect(codeReviewers[0]?.id).toBe('reviewer_1')

      const humanReviewers = router.getReviewersForTier('human')
      expect(humanReviewers).toHaveLength(1)
      expect(humanReviewers[0]?.id).toBe('reviewer_2')
    })

    it('should support capability-based routing', () => {
      router.registerReviewer({
        id: 'reviewer_1',
        name: 'ML Engineer',
        tiers: ['generative'],
        capabilities: ['model-debugging', 'prompt-engineering'],
      })

      router.registerReviewer({
        id: 'reviewer_2',
        name: 'Backend Engineer',
        tiers: ['generative'],
        capabilities: ['api-debugging', 'performance'],
      })

      const mlReviewers = router.getReviewersByCapability('model-debugging')
      expect(mlReviewers).toHaveLength(1)
      expect(mlReviewers[0]?.id).toBe('reviewer_1')
    })

    it('should consider reviewer availability', () => {
      router.registerReviewer({
        id: 'reviewer_1',
        name: 'Available Engineer',
        tiers: ['code'],
        available: true,
      })

      router.registerReviewer({
        id: 'reviewer_2',
        name: 'Unavailable Engineer',
        tiers: ['code'],
        available: false,
      })

      const available = router.getAvailableReviewers('code')
      expect(available).toHaveLength(1)
      expect(available[0]?.id).toBe('reviewer_1')
    })

    it('should route to on-call reviewer when no one is available', () => {
      router.registerReviewer({
        id: 'oncall_1',
        name: 'On-Call Engineer',
        tiers: ['code', 'generative', 'agentic', 'human'],
        isOnCall: true,
      })

      router.registerReviewer({
        id: 'reviewer_1',
        name: 'Regular Engineer',
        tiers: ['code'],
        available: false,
      })

      const reviewers = router.getAvailableReviewers('code')
      expect(reviewers).toHaveLength(1)
      expect(reviewers[0]?.id).toBe('oncall_1')
    })
  })

  describe('Escalation Request Creation', () => {
    it('should create escalation request with full context', async () => {
      const failure: AIFailure = {
        code: 'safety_violation',
        message: 'Content policy violated',
        timestamp: new Date(),
        context: {
          model: 'gpt-4',
          prompt: 'Test prompt',
          response: 'Problematic response',
        },
      }

      router.registerReviewer({
        id: 'reviewer_1',
        name: 'Safety Reviewer',
        tiers: ['human'],
        available: true,
      })

      const request = await router.createEscalationRequest({
        failure,
        tier: 'human',
        priority: 'critical',
        title: 'Safety Violation Review Required',
        description: 'AI generated content that violates safety policies',
      })

      expect(request.id).toBeDefined()
      expect(request.type).toBe('review')
      expect(request.priority).toBe('critical')
      expect(request.assignee).toBe('reviewer_1')
      expect(request.metadata?.failureCode).toBe('safety_violation')
    })

    it('should integrate with HumanManager for request creation', async () => {
      const mockHumanManager = {
        review: vi.fn().mockResolvedValue({
          approved: true,
          comments: 'Safe to proceed',
        }),
      }

      router.setHumanManager(mockHumanManager as any)

      router.registerReviewer({
        id: 'reviewer_1',
        name: 'Reviewer',
        tiers: ['human'],
        available: true,
      })

      const failure: AIFailure = {
        code: 'safety_violation',
        message: 'Review needed',
        timestamp: new Date(),
      }

      await router.escalateForReview({
        failure,
        tier: 'human',
        priority: 'high',
      })

      expect(mockHumanManager.review).toHaveBeenCalled()
    })
  })

  describe('Routing Metrics', () => {
    it('should track routing metrics by tier', () => {
      router.registerReviewer({
        id: 'reviewer_1',
        name: 'Reviewer',
        tiers: ['code'],
        available: true,
      })

      router.recordRouting('code', 'reviewer_1')
      router.recordRouting('code', 'reviewer_1')
      router.recordRouting('code', 'reviewer_1')

      const metrics = router.getMetrics()
      expect(metrics.byTier['code']?.routingCount).toBe(3)
    })

    it('should track routing metrics by reviewer', () => {
      router.registerReviewer({
        id: 'reviewer_1',
        name: 'Reviewer 1',
        tiers: ['code'],
        available: true,
      })

      router.registerReviewer({
        id: 'reviewer_2',
        name: 'Reviewer 2',
        tiers: ['code'],
        available: true,
      })

      router.recordRouting('code', 'reviewer_1')
      router.recordRouting('code', 'reviewer_1')
      router.recordRouting('code', 'reviewer_2')

      const metrics = router.getMetrics()
      expect(metrics.byReviewer['reviewer_1']?.assignmentCount).toBe(2)
      expect(metrics.byReviewer['reviewer_2']?.assignmentCount).toBe(1)
    })
  })
})

describe('Integration', () => {
  it('should classify, sanitize, and route failures end-to-end', async () => {
    const classifier = new AIFailureClassifier()
    const sanitizer = new ContextSanitizer()
    const trigger = new AutoEscalationTrigger()
    const router = new EscalationRouter()

    // Configure
    trigger.configure({
      consecutiveFailureThreshold: 2,
      windowMs: 60000,
    })

    router.registerReviewer({
      id: 'safety_team',
      name: 'Safety Team',
      tiers: ['human'],
      available: true,
    })

    // Simulate failures
    const failure: AIFailure = {
      code: 'safety_violation',
      message: 'Content policy violated',
      timestamp: new Date(),
      context: {
        apiKey: 'sk-secret-key',
        model: 'gpt-4',
        response: 'Problematic content',
      },
    }

    // Classify
    const tier = classifier.mapToTier(failure.code)
    expect(tier).toBe('human')

    const category = classifier.categorize(failure)
    expect(category).toBe('critical')

    // Sanitize
    const sanitized = sanitizer.sanitize(failure.context)
    expect(sanitized.apiKey).toBe('[REDACTED]')
    expect(sanitized.model).toBe('gpt-4')

    // Enrich
    const enriched = sanitizer.enrich(sanitized)
    expect(enriched.requestId).toBeDefined()
    expect(enriched.timestamp).toBeDefined()

    // Record failure and check escalation
    trigger.recordFailure({ code: failure.code, requestId: 'req_1' })
    trigger.recordFailure({ code: failure.code, requestId: 'req_2' })

    expect(trigger.shouldEscalate(failure.code)).toBe(true)

    // Route to reviewer
    const reviewers = router.getAvailableReviewers('human')
    expect(reviewers).toHaveLength(1)
    expect(reviewers[0]?.id).toBe('safety_team')
  })
})
