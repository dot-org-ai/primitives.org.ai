/**
 * Tests for fallback resolution patterns for human decisions
 *
 * TDD: RED phase - These tests should fail initially until implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  DecisionLogger,
  FeedbackLoop,
  FallbackChain,
  DecisionAnalytics,
  type DecisionLog,
  type DecisionContext,
  type FeedbackSignal,
  type FallbackHandler,
  type DecisionPattern,
} from '../src/fallback-resolution.js'
import { InMemoryHumanStore } from '../src/store.js'

describe('Fallback Resolution Patterns', () => {
  describe('DecisionLogger', () => {
    let logger: DecisionLogger

    beforeEach(() => {
      logger = new DecisionLogger()
    })

    describe('Decision Logging with Full Context', () => {
      it('should log a human decision with full context', () => {
        const context: DecisionContext = {
          requestId: 'req_123',
          requestType: 'approval',
          aiSuggestion: 'approve',
          aiConfidence: 0.85,
          inputData: { amount: 5000, category: 'expense' },
          timestamp: new Date('2026-01-11T10:00:00Z'),
        }

        const log = logger.logDecision({
          decisionMaker: 'alice@example.com',
          decision: 'approved',
          context,
          reasoning: 'Amount within budget limits',
        })

        expect(log.id).toBeDefined()
        expect(log.decisionMaker).toBe('alice@example.com')
        expect(log.decision).toBe('approved')
        expect(log.context.requestId).toBe('req_123')
        expect(log.context.aiSuggestion).toBe('approve')
        expect(log.reasoning).toBe('Amount within budget limits')
        expect(log.timestamp).toBeDefined()
      })

      it('should capture decision metadata including timestamps', () => {
        const log = logger.logDecision({
          decisionMaker: 'bob@example.com',
          decision: 'rejected',
          context: {
            requestId: 'req_456',
            requestType: 'review',
            aiSuggestion: 'approve',
            aiConfidence: 0.6,
            inputData: { code: 'console.log("test")' },
            timestamp: new Date(),
          },
          reasoning: 'Code quality issues found',
          metadata: {
            reviewTime: 300, // seconds
            changesRequested: 3,
          },
        })

        expect(log.metadata?.reviewTime).toBe(300)
        expect(log.metadata?.changesRequested).toBe(3)
        expect(log.timestamp).toBeInstanceOf(Date)
      })

      it('should track decision versioning for updates', () => {
        const initialLog = logger.logDecision({
          decisionMaker: 'alice@example.com',
          decision: 'pending-more-info',
          context: {
            requestId: 'req_789',
            requestType: 'decision',
            inputData: {},
            timestamp: new Date(),
          },
        })

        const updatedLog = logger.updateDecision(initialLog.id, {
          decision: 'approved',
          reasoning: 'Additional info received and verified',
        })

        expect(updatedLog.version).toBe(2)
        expect(updatedLog.previousVersions).toHaveLength(1)
        expect(updatedLog.previousVersions?.[0]?.decision).toBe('pending-more-info')
      })

      it('should retrieve decision history for a request', () => {
        const requestId = 'req_001'

        logger.logDecision({
          decisionMaker: 'alice@example.com',
          decision: 'escalated',
          context: {
            requestId,
            requestType: 'approval',
            inputData: {},
            timestamp: new Date(),
          },
        })

        logger.logDecision({
          decisionMaker: 'bob@example.com',
          decision: 'approved',
          context: {
            requestId,
            requestType: 'approval',
            inputData: {},
            timestamp: new Date(),
          },
        })

        const history = logger.getDecisionHistory(requestId)
        expect(history).toHaveLength(2)
        expect(history[0]?.decisionMaker).toBe('alice@example.com')
        expect(history[1]?.decisionMaker).toBe('bob@example.com')
      })
    })

    describe('Override Audit Trail', () => {
      it('should log when human overrides AI suggestion', () => {
        const log = logger.logDecision({
          decisionMaker: 'alice@example.com',
          decision: 'rejected',
          context: {
            requestId: 'req_override_1',
            requestType: 'approval',
            aiSuggestion: 'approve',
            aiConfidence: 0.92,
            inputData: { amount: 50000 },
            timestamp: new Date(),
          },
          reasoning: 'Amount exceeds quarterly budget despite AI approval',
        })

        expect(log.isOverride).toBe(true)
        expect(log.overrideDetails).toEqual({
          aiRecommendation: 'approve',
          humanDecision: 'rejected',
          aiConfidence: 0.92,
        })
      })

      it('should NOT mark as override when human agrees with AI', () => {
        const log = logger.logDecision({
          decisionMaker: 'alice@example.com',
          decision: 'approved',
          context: {
            requestId: 'req_agree_1',
            requestType: 'approval',
            aiSuggestion: 'approve',
            aiConfidence: 0.95,
            inputData: {},
            timestamp: new Date(),
          },
        })

        expect(log.isOverride).toBe(false)
        expect(log.overrideDetails).toBeUndefined()
      })

      it('should provide audit query by date range', () => {
        const startDate = new Date('2026-01-01')
        const endDate = new Date('2026-01-31')

        // Log some decisions
        logger.logDecision({
          decisionMaker: 'alice@example.com',
          decision: 'approved',
          context: {
            requestId: 'req_jan_1',
            requestType: 'approval',
            inputData: {},
            timestamp: new Date('2026-01-15'),
          },
        })

        logger.logDecision({
          decisionMaker: 'bob@example.com',
          decision: 'rejected',
          context: {
            requestId: 'req_feb_1',
            requestType: 'approval',
            inputData: {},
            timestamp: new Date('2026-02-15'),
          },
        })

        const janDecisions = logger.queryByDateRange(startDate, endDate)
        expect(janDecisions).toHaveLength(1)
        expect(janDecisions[0]?.context.requestId).toBe('req_jan_1')
      })

      it('should support compliance reporting with filters', () => {
        // Log override decision
        logger.logDecision({
          decisionMaker: 'alice@example.com',
          decision: 'rejected',
          context: {
            requestId: 'req_comp_1',
            requestType: 'approval',
            aiSuggestion: 'approve',
            aiConfidence: 0.88,
            inputData: {},
            timestamp: new Date(),
          },
        })

        // Log non-override decision
        logger.logDecision({
          decisionMaker: 'bob@example.com',
          decision: 'approved',
          context: {
            requestId: 'req_comp_2',
            requestType: 'approval',
            aiSuggestion: 'approve',
            aiConfidence: 0.95,
            inputData: {},
            timestamp: new Date(),
          },
        })

        const report = logger.getComplianceReport({
          overridesOnly: true,
        })

        expect(report.totalDecisions).toBe(2)
        expect(report.overrides).toBe(1)
        expect(report.overrideRate).toBeCloseTo(0.5)
        expect(report.overrideDecisions).toHaveLength(1)
      })
    })
  })

  describe('FeedbackLoop', () => {
    let feedbackLoop: FeedbackLoop

    beforeEach(() => {
      feedbackLoop = new FeedbackLoop()
    })

    describe('Decision to Training Signal', () => {
      it('should generate training signal from human decision', () => {
        const signal = feedbackLoop.generateSignal({
          decisionId: 'dec_123',
          requestId: 'req_123',
          inputData: { text: 'Approve this expense claim' },
          aiPrediction: 'approve',
          aiConfidence: 0.75,
          humanDecision: 'approved',
          outcome: 'correct',
        })

        expect(signal.id).toBeDefined()
        expect(signal.type).toBe('reinforcement')
        expect(signal.label).toBe('approved')
        expect(signal.weight).toBeGreaterThan(0)
        expect(signal.trainingData.input).toEqual({ text: 'Approve this expense claim' })
      })

      it('should generate correction signal when human overrides AI', () => {
        const signal = feedbackLoop.generateSignal({
          decisionId: 'dec_456',
          requestId: 'req_456',
          inputData: { amount: 100000 },
          aiPrediction: 'approve',
          aiConfidence: 0.9,
          humanDecision: 'rejected',
          outcome: 'override',
          reasoning: 'Amount too high for auto-approval',
        })

        expect(signal.type).toBe('correction')
        expect(signal.label).toBe('rejected')
        expect(signal.weight).toBeGreaterThan(1) // Higher weight for corrections
        expect(signal.trainingData.correction).toBe('Amount too high for auto-approval')
      })

      it('should aggregate feedback for batch training', () => {
        // Generate multiple signals
        feedbackLoop.generateSignal({
          decisionId: 'dec_1',
          requestId: 'req_1',
          inputData: { a: 1 },
          aiPrediction: 'approve',
          humanDecision: 'approved',
          outcome: 'correct',
        })

        feedbackLoop.generateSignal({
          decisionId: 'dec_2',
          requestId: 'req_2',
          inputData: { a: 2 },
          aiPrediction: 'approve',
          humanDecision: 'rejected',
          outcome: 'override',
        })

        feedbackLoop.generateSignal({
          decisionId: 'dec_3',
          requestId: 'req_3',
          inputData: { a: 3 },
          aiPrediction: 'reject',
          humanDecision: 'rejected',
          outcome: 'correct',
        })

        const batch = feedbackLoop.getTrainingBatch({ minSize: 2 })

        expect(batch.signals).toHaveLength(3)
        expect(batch.stats.totalSignals).toBe(3)
        expect(batch.stats.corrections).toBe(1)
        expect(batch.stats.reinforcements).toBe(2)
      })

      it('should export signals in standard ML format', () => {
        feedbackLoop.generateSignal({
          decisionId: 'dec_export_1',
          requestId: 'req_export_1',
          inputData: { text: 'Test input' },
          aiPrediction: 'approve',
          humanDecision: 'approved',
          outcome: 'correct',
        })

        const exported = feedbackLoop.exportForTraining('jsonl')

        expect(exported).toContain('"input"')
        expect(exported).toContain('"label"')
        expect(exported).toContain('Test input')
      })
    })

    describe('Feedback Aggregation', () => {
      it('should track AI accuracy over time', () => {
        // Correct predictions
        for (let i = 0; i < 8; i++) {
          feedbackLoop.generateSignal({
            decisionId: `dec_acc_${i}`,
            requestId: `req_acc_${i}`,
            inputData: {},
            aiPrediction: 'approve',
            humanDecision: 'approved',
            outcome: 'correct',
          })
        }

        // Incorrect predictions
        for (let i = 0; i < 2; i++) {
          feedbackLoop.generateSignal({
            decisionId: `dec_wrong_${i}`,
            requestId: `req_wrong_${i}`,
            inputData: {},
            aiPrediction: 'approve',
            humanDecision: 'rejected',
            outcome: 'override',
          })
        }

        const accuracy = feedbackLoop.getAccuracyMetrics()

        expect(accuracy.overallAccuracy).toBeCloseTo(0.8)
        expect(accuracy.totalDecisions).toBe(10)
        expect(accuracy.correctPredictions).toBe(8)
      })
    })
  })

  describe('FallbackChain', () => {
    let chain: FallbackChain

    beforeEach(() => {
      chain = new FallbackChain()
    })

    describe('Human Escalation Chain', () => {
      it('should define a fallback chain with multiple handlers', () => {
        chain.addHandler({
          id: 'junior-approver',
          name: 'Junior Approver',
          assignee: 'junior@example.com',
          canHandle: (ctx) => ctx.amount < 1000,
          timeout: 3600000, // 1 hour
          priority: 1,
        })

        chain.addHandler({
          id: 'senior-approver',
          name: 'Senior Approver',
          assignee: 'senior@example.com',
          canHandle: (ctx) => ctx.amount < 10000,
          timeout: 7200000, // 2 hours
          priority: 2,
        })

        chain.addHandler({
          id: 'executive-approver',
          name: 'Executive Approver',
          assignee: 'exec@example.com',
          canHandle: () => true, // Can handle anything
          timeout: 86400000, // 24 hours
          priority: 3,
        })

        const handlers = chain.getHandlers()
        expect(handlers).toHaveLength(3)
        expect(handlers[0]?.id).toBe('junior-approver')
      })

      it('should route request to appropriate handler based on context', async () => {
        chain.addHandler({
          id: 'small-expense',
          assignee: 'junior@example.com',
          canHandle: (ctx) => ctx.amount < 500,
          timeout: 3600000,
          priority: 1,
        })

        chain.addHandler({
          id: 'large-expense',
          assignee: 'senior@example.com',
          canHandle: (ctx) => ctx.amount >= 500,
          timeout: 7200000,
          priority: 2,
        })

        const handler = chain.findHandler({ amount: 250 })
        expect(handler?.id).toBe('small-expense')

        const handler2 = chain.findHandler({ amount: 1500 })
        expect(handler2?.id).toBe('large-expense')
      })

      it('should escalate to next handler when current times out', async () => {
        const mockStore = new InMemoryHumanStore()
        chain.setStore(mockStore)

        chain.addHandler({
          id: 'primary',
          assignee: 'alice@example.com',
          canHandle: () => true,
          timeout: 100, // Very short for testing
          priority: 1,
        })

        chain.addHandler({
          id: 'backup',
          assignee: 'bob@example.com',
          canHandle: () => true,
          timeout: 100,
          priority: 2,
        })

        const result = await chain.executeWithFallback({
          requestId: 'req_timeout_test',
          context: { data: 'test' },
          simulateTimeout: true, // For testing
        })

        expect(result.handlerUsed).toBe('backup')
        expect(result.escalated).toBe(true)
        expect(result.escalationPath).toEqual(['primary', 'backup'])
      })

      it('should track escalation path in audit', async () => {
        const mockStore = new InMemoryHumanStore()
        chain.setStore(mockStore)

        chain.addHandler({
          id: 'tier-1',
          assignee: 'tier1@example.com',
          canHandle: () => true,
          timeout: 50,
          priority: 1,
        })

        chain.addHandler({
          id: 'tier-2',
          assignee: 'tier2@example.com',
          canHandle: () => true,
          timeout: 50,
          priority: 2,
        })

        chain.addHandler({
          id: 'tier-3',
          assignee: 'tier3@example.com',
          canHandle: () => true,
          timeout: 50,
          priority: 3,
        })

        const result = await chain.executeWithFallback({
          requestId: 'req_multi_escalation',
          context: {},
          simulateTimeout: true,
          maxEscalations: 2,
        })

        const audit = chain.getEscalationAudit('req_multi_escalation')
        expect(audit.escalations).toHaveLength(2)
        expect(audit.escalations[0]?.from).toBe('tier-1')
        expect(audit.escalations[0]?.to).toBe('tier-2')
      })

      it('should fail gracefully when all handlers exhausted', async () => {
        const mockStore = new InMemoryHumanStore()
        chain.setStore(mockStore)

        chain.addHandler({
          id: 'only-handler',
          assignee: 'only@example.com',
          canHandle: () => true,
          timeout: 50,
          priority: 1,
        })

        await expect(
          chain.executeWithFallback({
            requestId: 'req_exhaust',
            context: {},
            simulateTimeout: true,
          })
        ).rejects.toThrow('All fallback handlers exhausted')
      })
    })
  })

  describe('DecisionAnalytics', () => {
    let analytics: DecisionAnalytics
    let logger: DecisionLogger

    beforeEach(() => {
      logger = new DecisionLogger()
      analytics = new DecisionAnalytics(logger)
    })

    describe('Pattern Detection', () => {
      it('should detect common decision patterns', () => {
        // Create pattern: Alice always rejects high amounts
        for (let i = 0; i < 5; i++) {
          logger.logDecision({
            decisionMaker: 'alice@example.com',
            decision: 'rejected',
            context: {
              requestId: `req_pattern_${i}`,
              requestType: 'approval',
              inputData: { amount: 50000 + i * 1000 },
              timestamp: new Date(),
            },
            reasoning: 'Amount too high',
          })
        }

        const patterns = analytics.detectPatterns({
          decisionMaker: 'alice@example.com',
          minOccurrences: 3,
        })

        expect(patterns.length).toBeGreaterThan(0)
        expect(patterns[0]?.type).toBe('consistent-rejection')
        expect(patterns[0]?.confidence).toBeGreaterThan(0.8)
      })

      it('should identify time-based patterns', () => {
        // Create pattern: Bob approves more on Fridays
        // Use explicit time to avoid timezone issues
        const friday = new Date('2026-01-09T12:00:00') // A Friday at noon local time
        for (let i = 0; i < 5; i++) {
          logger.logDecision({
            decisionMaker: 'bob@example.com',
            decision: 'approved',
            context: {
              requestId: `req_friday_${i}`,
              requestType: 'approval',
              inputData: {},
              timestamp: friday,
            },
          })
        }

        // Fewer approvals on Monday
        const monday = new Date('2026-01-12T12:00:00') // A Monday at noon local time
        for (let i = 0; i < 2; i++) {
          logger.logDecision({
            decisionMaker: 'bob@example.com',
            decision: 'approved',
            context: {
              requestId: `req_monday_${i}`,
              requestType: 'approval',
              inputData: {},
              timestamp: monday,
            },
          })
        }

        const timePatterns = analytics.detectTimePatterns('bob@example.com')

        expect(timePatterns.peakApprovalDay).toBe('Friday')
        expect(timePatterns.approvalsByDay.Friday).toBe(5)
      })

      it('should analyze decision consistency', () => {
        // Log consistent decisions
        for (let i = 0; i < 10; i++) {
          logger.logDecision({
            decisionMaker: 'consistent@example.com',
            decision: 'approved',
            context: {
              requestId: `req_consistent_${i}`,
              requestType: 'approval',
              inputData: { type: 'standard' },
              timestamp: new Date(),
            },
          })
        }

        // Log inconsistent decisions
        for (let i = 0; i < 10; i++) {
          logger.logDecision({
            decisionMaker: 'inconsistent@example.com',
            decision: i % 2 === 0 ? 'approved' : 'rejected',
            context: {
              requestId: `req_inconsistent_${i}`,
              requestType: 'approval',
              inputData: { type: 'standard' },
              timestamp: new Date(),
            },
          })
        }

        const consistencyConsistent = analytics.getConsistencyScore('consistent@example.com')
        const consistencyInconsistent = analytics.getConsistencyScore('inconsistent@example.com')

        expect(consistencyConsistent).toBeGreaterThan(0.9)
        expect(consistencyInconsistent).toBeLessThan(0.7)
      })
    })

    describe('Dashboard Data', () => {
      it('should provide summary statistics for dashboard', () => {
        // Log various decisions
        logger.logDecision({
          decisionMaker: 'alice@example.com',
          decision: 'approved',
          context: {
            requestId: 'req_dash_1',
            requestType: 'approval',
            aiSuggestion: 'approve',
            aiConfidence: 0.9,
            inputData: {},
            timestamp: new Date(),
          },
        })

        logger.logDecision({
          decisionMaker: 'bob@example.com',
          decision: 'rejected',
          context: {
            requestId: 'req_dash_2',
            requestType: 'approval',
            aiSuggestion: 'approve',
            aiConfidence: 0.85,
            inputData: {},
            timestamp: new Date(),
          },
        })

        const dashboardData = analytics.getDashboardData()

        expect(dashboardData.totalDecisions).toBe(2)
        expect(dashboardData.approvalRate).toBe(0.5)
        expect(dashboardData.overrideRate).toBe(0.5)
        expect(dashboardData.averageResponseTime).toBeDefined()
        expect(dashboardData.topDecisionMakers).toBeDefined()
      })

      it('should export decision data for training', () => {
        logger.logDecision({
          decisionMaker: 'alice@example.com',
          decision: 'approved',
          context: {
            requestId: 'req_export_1',
            requestType: 'approval',
            inputData: { text: 'Expense claim for travel' },
            timestamp: new Date(),
          },
        })

        const exportData = analytics.exportForTraining({
          format: 'jsonl',
          includeContext: true,
        })

        expect(exportData).toContain('Expense claim for travel')
        expect(exportData).toContain('approved')
      })
    })
  })
})
