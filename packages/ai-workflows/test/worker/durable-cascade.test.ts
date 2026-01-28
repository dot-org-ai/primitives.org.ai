/**
 * DurableStep.cascade() Tests (RED Phase)
 *
 * Tests for DurableStep.cascade() - durable tiered execution pattern that
 * combines code -> generative -> agentic -> human escalation with
 * Cloudflare Workflows durability guarantees.
 *
 * These tests define the expected behavior for DurableStep.cascade() before implementation.
 * All tests SHOULD FAIL because DurableStep.cascade() does not exist yet.
 *
 * Uses @cloudflare/vitest-pool-workers - NO MOCKS.
 * Tests run against real Cloudflare Workflows bindings with AI Gateway.
 *
 * Bead: aip-9390
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test'

// ============================================================================
// These imports will FAIL because DurableStep.cascade() is not yet implemented.
// This is the RED phase of TDD.
// ============================================================================
import {
  DurableStep,
  StepContext,
  type StepConfig,
  type WorkflowStep,
} from '../../src/worker/durable-step.js'

// Import cascade types - these will need to be defined in DurableStep
// These imports WILL FAIL because the types don't exist yet
import type {
  CascadeConfig,
  CascadeTierConfig,
  CascadeTierResult,
  CascadeResult,
  CascadeContext,
  DurableCascadeStep,
} from '../../src/worker/durable-step.js'

// Import the TestWorkflow that should be defined in worker.ts
import { TestWorkflow } from '../../src/worker.js'

// ============================================================================
// Type Definitions for Test Environment
// ============================================================================

interface TestEnv {
  WORKFLOW: Workflow
  AI: Ai
  AI_GATEWAY: AiGateway
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a workflow instance from the binding.
 */
async function getWorkflowInstance(name?: string): Promise<WorkflowInstance> {
  const instance = await env.WORKFLOW.create({
    id: name ?? crypto.randomUUID(),
  })
  return instance
}

/**
 * Run a workflow and wait for it to complete.
 */
async function runWorkflow<T>(instance: WorkflowInstance, params?: unknown): Promise<T> {
  const status = await instance.status()
  if (status.status === 'queued' || status.status === 'running') {
    let current = status
    while (current.status !== 'complete' && current.status !== 'errored') {
      await new Promise((resolve) => setTimeout(resolve, 100))
      current = await instance.status()
    }
    if (current.status === 'errored') {
      const error = current.error as unknown
      let errorMessage: string

      if (typeof error === 'string') {
        errorMessage = error
      } else if (error && typeof error === 'object') {
        const err = error as Record<string, unknown>
        errorMessage = (err.message ??
          err.name ??
          err.error ??
          (err.cause &&
            typeof err.cause === 'object' &&
            (err.cause as Record<string, unknown>).message) ??
          JSON.stringify(error)) as string
      } else {
        errorMessage = String(error ?? 'Unknown error')
      }
      throw new Error(errorMessage)
    }
    return current.output as T
  }
  return status.output as T
}

// ============================================================================
// 1. DurableStep.cascade() - Static Method Existence
// ============================================================================

describe('DurableStep.cascade()', () => {
  describe('static method existence', () => {
    it('should expose DurableStep.cascade() as a static method', () => {
      // DurableStep.cascade() should be a static factory method
      expect(DurableStep.cascade).toBeDefined()
      expect(typeof DurableStep.cascade).toBe('function')
    })

    it('should create a DurableCascadeStep with cascade configuration', () => {
      const cascadeStep = DurableStep.cascade('process-refund', {
        code: async (input) => ({ approved: true }),
      })

      expect(cascadeStep).toBeDefined()
      expect(cascadeStep.name).toBe('process-refund')
    })

    it('should return a DurableCascadeStep that can be run with workflow step', async () => {
      const cascadeStep = DurableStep.cascade('test-cascade', {
        code: async (input) => ({ result: 'code' }),
      })

      // Should have a run method like regular DurableStep
      expect(cascadeStep.run).toBeDefined()
      expect(typeof cascadeStep.run).toBe('function')
    })
  })

  // ============================================================================
  // 2. Cascade Tier Definition
  // ============================================================================

  describe('cascade tier definition', () => {
    it('should accept code tier handler', () => {
      const cascadeStep = DurableStep.cascade('code-only', {
        code: async (input: { amount: number }) => {
          if (input.amount < 100) {
            return { approved: true, reason: 'Auto-approved small amount' }
          }
          throw new Error('Amount too large for code tier')
        },
      })

      expect(cascadeStep).toBeDefined()
    })

    it('should accept generative tier handler with AI context', () => {
      const cascadeStep = DurableStep.cascade('with-generative', {
        code: async (input) => {
          throw new Error('Escalate to generative')
        },
        generative: async (input, ctx) => {
          // ctx should have ai binding for AI Gateway
          const result = await ctx.ai.run('@cf/meta/llama-3-8b-instruct', {
            messages: [{ role: 'user', content: `Process: ${JSON.stringify(input)}` }],
          })
          return { decision: result.response }
        },
      })

      expect(cascadeStep).toBeDefined()
    })

    it('should accept agentic tier handler with tools', () => {
      const cascadeStep = DurableStep.cascade('with-agentic', {
        code: async (input) => {
          throw new Error('Escalate to agentic')
        },
        agentic: async (input, ctx) => {
          // Agentic tier can use tools and make multiple AI calls
          const analysis = await ctx.ai.run('@cf/meta/llama-3-8b-instruct', {
            messages: [{ role: 'user', content: 'Analyze this request' }],
          })
          return { agentDecision: analysis.response }
        },
      })

      expect(cascadeStep).toBeDefined()
    })

    it('should accept human tier handler for human-in-the-loop', () => {
      const cascadeStep = DurableStep.cascade('with-human', {
        code: async (input) => {
          throw new Error('Escalate to human')
        },
        human: async (input, ctx) => {
          // Human tier should create a human review request and wait
          const reviewId = await ctx.requestHumanReview({
            type: 'refund-approval',
            data: input,
            assignee: 'finance-team',
          })
          return { reviewId, status: 'pending-human' }
        },
      })

      expect(cascadeStep).toBeDefined()
    })

    it('should accept all four tiers in a complete cascade', () => {
      const cascadeStep = DurableStep.cascade('full-cascade', {
        code: async (input) => {
          // Try deterministic rules first
          if (input.amount < 50) return { approved: true }
          throw new Error('Needs AI review')
        },
        generative: async (input, ctx) => {
          // Try simple AI decision
          const result = await ctx.ai.run('@cf/meta/llama-3-8b-instruct', {
            messages: [{ role: 'user', content: 'Should we approve?' }],
          })
          if (result.response.includes('yes')) return { approved: true }
          throw new Error('Needs deeper analysis')
        },
        agentic: async (input, ctx) => {
          // Try agentic reasoning with tools
          const analysis = await ctx.ai.run('@cf/meta/llama-3-8b-instruct', {
            messages: [{ role: 'user', content: 'Deep analysis needed' }],
          })
          if (analysis.response.includes('approve')) return { approved: true }
          throw new Error('Needs human review')
        },
        human: async (input, ctx) => {
          // Fall back to human
          return ctx.requestHumanReview({ type: 'manual-review', data: input })
        },
      })

      expect(cascadeStep).toBeDefined()
    })
  })

  // ============================================================================
  // 3. Cascade Execution Order
  // ============================================================================

  describe('cascade execution order', () => {
    it('should execute tiers in order: code -> generative -> agentic -> human', async () => {
      const instance = await getWorkflowInstance('cascade-order-test-1')

      const result = await runWorkflow<{
        executionOrder: string[]
        finalTier: string
      }>(instance)

      expect(result.executionOrder).toEqual(['code', 'generative', 'agentic', 'human'])
      expect(result.finalTier).toBe('human')
    })

    it('should short-circuit when a tier succeeds', async () => {
      const instance = await getWorkflowInstance('cascade-shortcircuit-test-1')

      const result = await runWorkflow<{
        executedTiers: string[]
        successTier: string
        value: unknown
      }>(instance)

      // If code tier succeeds, should not execute other tiers
      expect(result.executedTiers).toEqual(['code'])
      expect(result.successTier).toBe('code')
    })

    it('should escalate to next tier on failure', async () => {
      const instance = await getWorkflowInstance('cascade-escalate-test-1')

      const result = await runWorkflow<{
        executedTiers: string[]
        successTier: string
        errors: Array<{ tier: string; error: string }>
      }>(instance)

      // Code fails, generative succeeds
      expect(result.executedTiers).toEqual(['code', 'generative'])
      expect(result.successTier).toBe('generative')
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].tier).toBe('code')
    })

    it('should skip unconfigured tiers gracefully', async () => {
      const instance = await getWorkflowInstance('cascade-skip-test-1')

      const result = await runWorkflow<{
        executedTiers: string[]
        skippedTiers: string[]
        successTier: string
      }>(instance)

      // Only code and human configured, generative and agentic skipped
      expect(result.skippedTiers).toContain('generative')
      expect(result.skippedTiers).toContain('agentic')
    })
  })

  // ============================================================================
  // 4. AI Tier -> Human Tier Fallback
  // ============================================================================

  describe('AI to human fallback', () => {
    it('should escalate from generative to human when AI fails', async () => {
      const instance = await getWorkflowInstance('ai-human-fallback-test-1')

      const result = await runWorkflow<{
        aiTierFailed: boolean
        humanTierInvoked: boolean
        finalResult: unknown
      }>(instance)

      expect(result.aiTierFailed).toBe(true)
      expect(result.humanTierInvoked).toBe(true)
    })

    it('should preserve AI tier error context for human review', async () => {
      const instance = await getWorkflowInstance('ai-error-context-test-1')

      const result = await runWorkflow<{
        humanReviewContext: {
          previousTierErrors: Array<{
            tier: string
            error: string
            attempt: number
          }>
        }
      }>(instance)

      expect(result.humanReviewContext.previousTierErrors).toBeDefined()
      expect(result.humanReviewContext.previousTierErrors.length).toBeGreaterThan(0)
    })

    it('should include AI reasoning in human escalation', async () => {
      const instance = await getWorkflowInstance('ai-reasoning-test-1')

      const result = await runWorkflow<{
        humanReviewData: {
          aiAttempts: Array<{
            tier: string
            reasoning: string
            confidence: number
          }>
          escalationReason: string
        }
      }>(instance)

      expect(result.humanReviewData.aiAttempts).toBeDefined()
      expect(result.humanReviewData.escalationReason).toBeDefined()
    })

    it('should support custom escalation conditions', async () => {
      const instance = await getWorkflowInstance('custom-escalation-test-1')

      // Cascade with custom condition: escalate if confidence < 0.8
      const result = await runWorkflow<{
        aiConfidence: number
        escalatedDueToLowConfidence: boolean
        humanInvoked: boolean
      }>(instance)

      expect(result.aiConfidence).toBeLessThan(0.8)
      expect(result.escalatedDueToLowConfidence).toBe(true)
      expect(result.humanInvoked).toBe(true)
    })
  })

  // ============================================================================
  // 5. Multiple AI Providers (Fast Model -> Slow Model)
  // ============================================================================

  describe('multiple AI providers cascade', () => {
    it('should support fast model before slow model in generative tier', async () => {
      const instance = await getWorkflowInstance('fast-slow-model-test-1')

      const result = await runWorkflow<{
        modelUsed: string
        attemptedModels: string[]
        response: string
      }>(instance)

      // Fast model should be tried first
      expect(result.attemptedModels[0]).toBe('@cf/meta/llama-3-8b-instruct')
      // If fast fails, slow model
      expect(result.attemptedModels).toContain('@cf/meta/llama-3-70b-instruct')
    })

    it('should cascade through model tiers within generative tier', async () => {
      const instance = await getWorkflowInstance('model-cascade-test-1')

      const result = await runWorkflow<{
        modelAttempts: Array<{
          model: string
          success: boolean
          latencyMs: number
        }>
        finalModel: string
      }>(instance)

      expect(result.modelAttempts.length).toBeGreaterThan(1)
      expect(result.finalModel).toBeDefined()
    })

    it('should support custom model ordering', async () => {
      const instance = await getWorkflowInstance('custom-model-order-test-1')

      const result = await runWorkflow<{
        modelOrder: string[]
        selectedModel: string
      }>(instance)

      // Custom order: cheapest -> balanced -> premium
      expect(result.modelOrder).toEqual([
        '@cf/meta/llama-3-8b-instruct',
        '@cf/mistral/mistral-7b-instruct-v0.1',
        '@cf/meta/llama-3-70b-instruct',
      ])
    })

    it('should respect model-specific timeouts', async () => {
      const instance = await getWorkflowInstance('model-timeout-test-1')

      const result = await runWorkflow<{
        modelResults: Array<{
          model: string
          timedOut: boolean
          timeoutMs: number
        }>
      }>(instance)

      // Fast model has shorter timeout than slow model
      const fastModel = result.modelResults.find((m) => m.model.includes('8b'))
      const slowModel = result.modelResults.find((m) => m.model.includes('70b'))

      expect(fastModel?.timeoutMs).toBeLessThan(slowModel?.timeoutMs ?? 0)
    })

    it('should use AI Gateway caching for deterministic tests', async () => {
      const instance = await getWorkflowInstance('ai-gateway-cache-test-1')

      const result = await runWorkflow<{
        cacheHit: boolean
        cachedResponse: string
        responseTime: number
      }>(instance)

      // Second request should hit cache
      expect(result.cacheHit).toBe(true)
      expect(result.responseTime).toBeLessThan(100) // Cached response should be fast
    })
  })

  // ============================================================================
  // 6. Tier Timeout Configuration
  // ============================================================================

  describe('tier timeout configuration', () => {
    it('should support per-tier timeout configuration', async () => {
      const instance = await getWorkflowInstance('tier-timeout-config-test-1')

      const result = await runWorkflow<{
        tierTimeouts: Record<string, number>
        appliedTimeouts: Record<string, number>
      }>(instance)

      expect(result.tierTimeouts).toEqual({
        code: 5000,
        generative: 30000,
        agentic: 300000,
        human: 86400000,
      })
    })

    it('should use default timeouts when not specified', async () => {
      const instance = await getWorkflowInstance('default-timeout-test-1')

      const result = await runWorkflow<{
        usedDefaults: boolean
        defaultTimeouts: Record<string, number>
      }>(instance)

      expect(result.usedDefaults).toBe(true)
      expect(result.defaultTimeouts.code).toBe(5000)
      expect(result.defaultTimeouts.generative).toBe(30000)
    })

    it('should escalate on tier timeout', async () => {
      const instance = await getWorkflowInstance('timeout-escalation-test-1')

      const result = await runWorkflow<{
        timedOutTier: string
        escalatedToTier: string
        timeoutError: string
      }>(instance)

      expect(result.timedOutTier).toBe('code')
      expect(result.escalatedToTier).toBe('generative')
      expect(result.timeoutError).toContain('timeout')
    })

    it('should record timeout in tier result', async () => {
      const instance = await getWorkflowInstance('timeout-record-test-1')

      const result = await runWorkflow<{
        tierResults: Array<{
          tier: string
          timedOut: boolean
          duration: number
          configuredTimeout: number
        }>
      }>(instance)

      const timedOutTier = result.tierResults.find((t) => t.timedOut)
      expect(timedOutTier).toBeDefined()
      expect(timedOutTier?.duration).toBeGreaterThanOrEqual(timedOutTier?.configuredTimeout ?? 0)
    })

    it('should support total cascade timeout', async () => {
      const instance = await getWorkflowInstance('total-timeout-test-1')

      // Cascade with 60s total timeout
      await expect(runWorkflow(instance)).rejects.toThrow(/cascade.*timeout/i)
    })
  })

  // ============================================================================
  // 7. Tier Success Conditions
  // ============================================================================

  describe('tier success conditions', () => {
    it('should treat returned value as success', async () => {
      const instance = await getWorkflowInstance('return-success-test-1')

      const result = await runWorkflow<{
        tierStatus: string
        returnedValue: unknown
      }>(instance)

      expect(result.tierStatus).toBe('success')
      expect(result.returnedValue).toBeDefined()
    })

    it('should treat thrown error as failure and escalate', async () => {
      const instance = await getWorkflowInstance('throw-failure-test-1')

      const result = await runWorkflow<{
        failedTier: string
        escalatedTo: string
        error: string
      }>(instance)

      expect(result.failedTier).toBe('code')
      expect(result.escalatedTo).toBe('generative')
    })

    it('should support custom success condition function', async () => {
      const instance = await getWorkflowInstance('custom-success-test-1')

      const result = await runWorkflow<{
        tierResult: { confidence: number }
        customConditionResult: boolean
        finalStatus: string
      }>(instance)

      // Custom condition: success only if confidence > 0.9
      expect(result.tierResult.confidence).toBeLessThan(0.9)
      expect(result.customConditionResult).toBe(false)
      expect(result.finalStatus).toBe('escalated')
    })

    it('should support partial success with escalation', async () => {
      const instance = await getWorkflowInstance('partial-success-test-1')

      const result = await runWorkflow<{
        partialResult: { approved: boolean; confidence: number }
        needsHumanReview: boolean
        escalatedWithPartialResult: boolean
      }>(instance)

      // Tier returned a result but flagged for human review
      expect(result.partialResult.approved).toBe(true)
      expect(result.partialResult.confidence).toBeLessThan(0.8)
      expect(result.needsHumanReview).toBe(true)
      expect(result.escalatedWithPartialResult).toBe(true)
    })

    it('should support retry before escalation', async () => {
      const instance = await getWorkflowInstance('retry-before-escalate-test-1')

      const result = await runWorkflow<{
        tierAttempts: number
        maxRetries: number
        finallyEscalated: boolean
      }>(instance)

      // Should retry 3 times before escalating
      expect(result.tierAttempts).toBe(3)
      expect(result.maxRetries).toBe(3)
      expect(result.finallyEscalated).toBe(true)
    })
  })

  // ============================================================================
  // 8. Tier Result Merging
  // ============================================================================

  describe('tier result merging', () => {
    it('should accumulate results from all attempted tiers', async () => {
      const instance = await getWorkflowInstance('result-accumulate-test-1')

      const result = await runWorkflow<{
        allTierResults: Array<{
          tier: string
          result: unknown
          status: string
        }>
      }>(instance)

      expect(result.allTierResults.length).toBeGreaterThan(1)
      expect(result.allTierResults.every((t) => t.tier && t.status)).toBe(true)
    })

    it('should merge partial results into final result', async () => {
      const instance = await getWorkflowInstance('result-merge-test-1')

      const result = await runWorkflow<{
        mergedResult: {
          codeAnalysis: unknown
          aiRecommendation: unknown
          humanDecision: unknown
        }
        contributingTiers: string[]
      }>(instance)

      // Each tier contributes to the final merged result
      expect(result.mergedResult.codeAnalysis).toBeDefined()
      expect(result.contributingTiers.length).toBeGreaterThan(1)
    })

    it('should provide access to individual tier results', async () => {
      const instance = await getWorkflowInstance('individual-results-test-1')

      const result = await runWorkflow<CascadeResult<unknown>>(instance)

      expect(result.history).toBeDefined()
      expect(Array.isArray(result.history)).toBe(true)
      expect(result.history[0]).toHaveProperty('tier')
      expect(result.history[0]).toHaveProperty('success')
      expect(result.history[0]).toHaveProperty('duration')
    })

    it('should support custom result merger function', async () => {
      const instance = await getWorkflowInstance('custom-merger-test-1')

      const result = await runWorkflow<{
        customMergedResult: {
          consensus: string
          sources: string[]
        }
      }>(instance)

      expect(result.customMergedResult.consensus).toBeDefined()
      expect(result.customMergedResult.sources.length).toBeGreaterThan(0)
    })

    it('should preserve tier metadata in results', async () => {
      const instance = await getWorkflowInstance('tier-metadata-test-1')

      const result = await runWorkflow<{
        tierMetadata: Array<{
          tier: string
          startTime: number
          endTime: number
          latencyMs: number
          attempts: number
        }>
      }>(instance)

      expect(result.tierMetadata.every((m) => m.latencyMs >= 0)).toBe(true)
      expect(result.tierMetadata.every((m) => m.attempts >= 1)).toBe(true)
    })
  })

  // ============================================================================
  // 9. Error Propagation Through Tiers
  // ============================================================================

  describe('error propagation through tiers', () => {
    it('should propagate error to next tier with context', async () => {
      const instance = await getWorkflowInstance('error-propagate-test-1')

      const result = await runWorkflow<{
        receivedErrors: Array<{
          fromTier: string
          error: string
        }>
        currentTier: string
      }>(instance)

      expect(result.receivedErrors.length).toBeGreaterThan(0)
      expect(result.receivedErrors[0].fromTier).toBeDefined()
    })

    it('should accumulate errors from all failed tiers', async () => {
      const instance = await getWorkflowInstance('error-accumulate-test-1')

      const result = await runWorkflow<{
        allErrors: Array<{
          tier: string
          error: string
          timestamp: number
        }>
        totalFailures: number
      }>(instance)

      expect(result.allErrors.length).toBe(result.totalFailures)
    })

    it('should throw AllTiersFailedError when all tiers fail', async () => {
      const instance = await getWorkflowInstance('all-tiers-fail-test-1')

      await expect(runWorkflow(instance)).rejects.toThrow(/all.*tiers.*failed/i)
    })

    it('should include error history in AllTiersFailedError', async () => {
      const instance = await getWorkflowInstance('error-history-test-1')

      try {
        await runWorkflow(instance)
        expect.fail('Should have thrown')
      } catch (error: unknown) {
        const err = error as Error & { history?: Array<{ tier: string; error: Error }> }
        expect(err.history).toBeDefined()
        expect(err.history?.length).toBeGreaterThan(0)
      }
    })

    it('should support custom error handlers per tier', async () => {
      const instance = await getWorkflowInstance('custom-error-handler-test-1')

      const result = await runWorkflow<{
        errorHandled: boolean
        handlerTier: string
        recoveredValue: unknown
      }>(instance)

      expect(result.errorHandled).toBe(true)
      expect(result.recoveredValue).toBeDefined()
    })

    it('should support error transformation between tiers', async () => {
      const instance = await getWorkflowInstance('error-transform-test-1')

      const result = await runWorkflow<{
        originalError: string
        transformedError: string
        transformedForHuman: boolean
      }>(instance)

      // Technical error transformed to human-readable
      expect(result.originalError).toContain('ECONNREFUSED')
      expect(result.transformedError).toContain('service temporarily unavailable')
    })
  })

  // ============================================================================
  // 10. Durable Cascade Checkpoints
  // ============================================================================

  describe('durable cascade checkpoints', () => {
    it('should persist tier results as durable checkpoints', async () => {
      const instance = await getWorkflowInstance('durable-checkpoint-test-1')

      const result = await runWorkflow<{
        checkpointsCreated: number
        checkpointIds: string[]
      }>(instance)

      expect(result.checkpointsCreated).toBeGreaterThan(0)
      expect(result.checkpointIds.length).toBe(result.checkpointsCreated)
    })

    it('should resume cascade from last successful tier on restart', async () => {
      const instance = await getWorkflowInstance('cascade-resume-test-1')

      const result = await runWorkflow<{
        resumedFromTier: string
        tiersReExecuted: string[]
        tiersSkipped: string[]
      }>(instance)

      // Should not re-execute already completed tiers
      expect(result.tiersSkipped.length).toBeGreaterThan(0)
    })

    it('should store tier inputs and outputs durably', async () => {
      const instance = await getWorkflowInstance('durable-io-test-1')

      const result = await runWorkflow<{
        storedTierData: Array<{
          tier: string
          input: unknown
          output: unknown
          storedAt: number
        }>
      }>(instance)

      expect(result.storedTierData.every((d) => d.input !== undefined)).toBe(true)
      expect(result.storedTierData.every((d) => d.output !== undefined)).toBe(true)
    })

    it('should support snapshot and restore of cascade state', async () => {
      const instance = await getWorkflowInstance('cascade-snapshot-test-1')

      const result = await runWorkflow<{
        snapshotId: string
        restoredFromSnapshot: boolean
        stateAfterRestore: {
          currentTier: string
          completedTiers: string[]
        }
      }>(instance)

      expect(result.snapshotId).toBeDefined()
      expect(result.restoredFromSnapshot).toBe(true)
    })
  })

  // ============================================================================
  // 11. 5W+H Audit Trail
  // ============================================================================

  describe('5W+H audit trail', () => {
    it('should record Who (actor) for each tier execution', async () => {
      const instance = await getWorkflowInstance('audit-who-test-1')

      const result = await runWorkflow<{
        auditEvents: Array<{
          who: string
          tier: string
        }>
      }>(instance)

      expect(result.auditEvents.every((e) => e.who !== undefined)).toBe(true)
      // Different actors for different tiers
      expect(result.auditEvents.some((e) => e.who === 'system')).toBe(true)
      expect(
        result.auditEvents.some((e) => e.who.includes('human') || e.who.includes('user'))
      ).toBe(true)
    })

    it('should record What (action) for each tier', async () => {
      const instance = await getWorkflowInstance('audit-what-test-1')

      const result = await runWorkflow<{
        auditEvents: Array<{
          what: string
          tier: string
        }>
      }>(instance)

      expect(result.auditEvents.find((e) => e.tier === 'code')?.what).toContain('execute')
      expect(result.auditEvents.find((e) => e.tier === 'generative')?.what).toContain('ai')
    })

    it('should record When (timestamp) for all events', async () => {
      const instance = await getWorkflowInstance('audit-when-test-1')

      const result = await runWorkflow<{
        auditEvents: Array<{
          when: number
          tier: string
        }>
      }>(instance)

      // Events should be in chronological order
      const timestamps = result.auditEvents.map((e) => e.when)
      const sorted = [...timestamps].sort((a, b) => a - b)
      expect(timestamps).toEqual(sorted)
    })

    it('should record Where (cascade context) for each event', async () => {
      const instance = await getWorkflowInstance('audit-where-test-1')

      const result = await runWorkflow<{
        auditEvents: Array<{
          where: string
          cascadeName: string
          workflowId: string
        }>
      }>(instance)

      expect(result.auditEvents.every((e) => e.where === result.auditEvents[0].where)).toBe(true)
      expect(result.auditEvents[0].cascadeName).toBeDefined()
    })

    it('should record Why (reason) for escalations', async () => {
      const instance = await getWorkflowInstance('audit-why-test-1')

      const result = await runWorkflow<{
        escalationEvents: Array<{
          why: string
          fromTier: string
          toTier: string
        }>
      }>(instance)

      expect(result.escalationEvents.length).toBeGreaterThan(0)
      expect(result.escalationEvents.every((e) => e.why !== undefined && e.why !== '')).toBe(true)
    })

    it('should record How (method/details) for tier execution', async () => {
      const instance = await getWorkflowInstance('audit-how-test-1')

      const result = await runWorkflow<{
        auditEvents: Array<{
          how: {
            status: string
            duration: number
            metadata: Record<string, unknown>
          }
        }>
      }>(instance)

      expect(result.auditEvents.every((e) => e.how.status !== undefined)).toBe(true)
      expect(result.auditEvents.every((e) => e.how.duration >= 0)).toBe(true)
    })

    it('should persist audit trail durably', async () => {
      const instance = await getWorkflowInstance('audit-persist-test-1')

      const result = await runWorkflow<{
        auditTrailPersisted: boolean
        auditRecordCount: number
        canQueryAuditHistory: boolean
      }>(instance)

      expect(result.auditTrailPersisted).toBe(true)
      expect(result.auditRecordCount).toBeGreaterThan(0)
      expect(result.canQueryAuditHistory).toBe(true)
    })
  })

  // ============================================================================
  // 12. AI Gateway Integration
  // ============================================================================

  describe('AI Gateway integration', () => {
    it('should use AI Gateway binding for generative tier', async () => {
      const instance = await getWorkflowInstance('ai-gateway-binding-test-1')

      const result = await runWorkflow<{
        usedAiGateway: boolean
        gatewayResponse: unknown
      }>(instance)

      expect(result.usedAiGateway).toBe(true)
      expect(result.gatewayResponse).toBeDefined()
    })

    it('should support AI Gateway caching for deterministic tests', async () => {
      const instance = await getWorkflowInstance('ai-gateway-caching-test-1')

      const result = await runWorkflow<{
        firstCallCached: boolean
        secondCallFromCache: boolean
        responsesMatch: boolean
      }>(instance)

      // First call should cache, second should hit cache
      expect(result.secondCallFromCache).toBe(true)
      expect(result.responsesMatch).toBe(true)
    })

    it('should provide AI context to tier handlers', async () => {
      const instance = await getWorkflowInstance('ai-context-test-1')

      const result = await runWorkflow<{
        contextHasAi: boolean
        aiBindingType: string
      }>(instance)

      expect(result.contextHasAi).toBe(true)
      expect(result.aiBindingType).toBe('function')
    })

    it('should handle AI Gateway errors gracefully', async () => {
      const instance = await getWorkflowInstance('ai-gateway-error-test-1')

      const result = await runWorkflow<{
        aiGatewayFailed: boolean
        escalatedAfterAiFailure: boolean
        errorCaptured: string
      }>(instance)

      expect(result.aiGatewayFailed).toBe(true)
      expect(result.escalatedAfterAiFailure).toBe(true)
    })
  })

  // ============================================================================
  // 13. Integration with Existing CascadeExecutor
  // ============================================================================

  describe('CascadeExecutor integration', () => {
    it('should use CascadeContext for tracing', async () => {
      const instance = await getWorkflowInstance('cascade-context-test-1')

      const result = await runWorkflow<{
        cascadeContext: {
          correlationId: string
          steps: Array<{ name: string; status: string }>
        }
      }>(instance)

      expect(result.cascadeContext.correlationId).toBeDefined()
      expect(result.cascadeContext.steps.length).toBeGreaterThan(0)
    })

    it('should emit FiveWH events via onEvent callback', async () => {
      const instance = await getWorkflowInstance('fivewh-events-test-1')

      const result = await runWorkflow<{
        eventsEmitted: number
        eventTypes: string[]
      }>(instance)

      expect(result.eventsEmitted).toBeGreaterThan(0)
      expect(result.eventTypes).toContain('tier-code-execute')
    })

    it('should provide execution metrics', async () => {
      const instance = await getWorkflowInstance('metrics-test-1')

      const result = await runWorkflow<{
        metrics: {
          totalDuration: number
          tierDurations: Record<string, number>
        }
      }>(instance)

      expect(result.metrics.totalDuration).toBeGreaterThan(0)
      expect(Object.keys(result.metrics.tierDurations).length).toBeGreaterThan(0)
    })
  })
})

// ============================================================================
// 14. CascadeConfig Type Tests (Compile-time)
// ============================================================================

describe('CascadeConfig types', () => {
  it('should define CascadeTierConfig type', () => {
    // This is a compile-time type test
    const tierConfig: CascadeTierConfig = {
      timeout: 5000,
      retries: { limit: 3, delay: 1000, backoff: 'exponential' },
      successCondition: (result) => result.confidence > 0.9,
    }

    expect(tierConfig.timeout).toBe(5000)
  })

  it('should define CascadeConfig with all tiers', () => {
    const config: CascadeConfig<{ approved: boolean }> = {
      code: async (input) => ({ approved: true }),
      generative: async (input, ctx) => ({ approved: true }),
      agentic: async (input, ctx) => ({ approved: true }),
      human: async (input, ctx) => ({ approved: true }),
      timeouts: {
        code: 5000,
        generative: 30000,
        agentic: 300000,
        human: 86400000,
      },
      totalTimeout: 100000,
      onEvent: (event) => console.log(event),
      resultMerger: (results) => results[results.length - 1]?.value ?? { approved: false },
    }

    expect(config.code).toBeDefined()
    expect(config.timeouts?.code).toBe(5000)
  })

  it('should define CascadeResult type', () => {
    const result: CascadeResult<{ approved: boolean }> = {
      value: { approved: true },
      tier: 'code',
      history: [
        {
          tier: 'code',
          success: true,
          value: { approved: true },
          duration: 100,
        },
      ],
      skippedTiers: ['generative', 'agentic', 'human'],
      context: {
        correlationId: 'test-123',
        steps: [],
      } as CascadeContext,
      metrics: {
        totalDuration: 100,
        tierDurations: { code: 100 },
      },
    }

    expect(result.value.approved).toBe(true)
    expect(result.tier).toBe('code')
  })
})
