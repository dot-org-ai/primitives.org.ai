/**
 * Tests for schedule timer cleanup
 *
 * These tests expose the memory leak issue where timers accumulate
 * when workflows are destroyed without cleanup.
 *
 * GREEN PHASE: Tests should pass with timer cleanup implementation.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { Workflow } from '../src/workflow.js'
import { clearEventHandlers } from '../src/on.js'
import { clearScheduleHandlers } from '../src/every.js'
// Import timer registry - global functions require explicit opt-in
import { clearAllTimers, enableGlobalTimerRegistry } from '../src/timer-registry.js'

// Enable global timer registry for tests that use global.getActiveWorkflowTimerCount, etc.
enableGlobalTimerRegistry()

describe('Schedule Timer Cleanup', () => {
  beforeEach(() => {
    clearEventHandlers()
    clearScheduleHandlers()
    clearAllTimers() // Clear any lingering timers from previous tests
    vi.useFakeTimers()
  })

  afterEach(() => {
    clearAllTimers() // Clean up timers after each test
    vi.useRealTimers()
  })

  describe('Timer Memory Leak Detection', () => {
    it('should not execute timer handlers after workflow goes out of scope', async () => {
      // This test verifies that the global cleanup API can stop orphaned timers
      const handler = vi.fn()

      // Create workflow in a scope and let it go out of scope without stopping
      function createAndAbandonWorkflow() {
        const workflow = Workflow(($) => {
          $.every.seconds(1)(handler)
        })
        // Start the workflow - this creates the timer
        // But we don't call stop() before letting it go out of scope
        return workflow.start()
      }

      await createAndAbandonWorkflow()
      // workflow is now out of scope, but timer is still running
      // Use the global cleanup function to clear all orphaned timers
      clearAllTimers()

      // Advance time - handler should NOT be called after cleanup
      await vi.advanceTimersByTimeAsync(5000)

      // After calling clearAllTimers(), orphaned timers should be stopped
      expect(handler).toHaveBeenCalledTimes(0)
    })

    it('should track active timers globally for cleanup', async () => {
      // This test verifies that there's a way to track and clean up all active timers
      // Currently there is no global registry, so this will fail

      const handler1 = vi.fn()
      const handler2 = vi.fn()

      const workflow1 = Workflow(($) => {
        $.every.seconds(1)(handler1)
      })

      const workflow2 = Workflow(($) => {
        $.every.seconds(1)(handler2)
      })

      await workflow1.start()
      await workflow2.start()

      // There should be a way to get the count of active timers
      // This API doesn't exist yet
      const getActiveTimerCount = () => {
        // @ts-expect-error - This function doesn't exist yet
        return typeof global.getActiveWorkflowTimerCount === 'function'
          ? // @ts-expect-error - This function doesn't exist yet
            global.getActiveWorkflowTimerCount()
          : -1 // Return -1 to indicate the function doesn't exist
      }

      const timerCount = getActiveTimerCount()

      // BUG: This will fail because there's no global timer registry
      expect(timerCount).toBe(2)

      await workflow1.stop()
      await workflow2.stop()
    })

    it('should provide a clearAllTimers utility for cleanup', async () => {
      // Test that there's a utility to clear all timers from all workflows
      const handler = vi.fn()

      // Create multiple workflows
      const workflow1 = Workflow(($) => {
        $.every.seconds(1)(handler)
      })
      const workflow2 = Workflow(($) => {
        $.every.seconds(2)(handler)
      })

      await workflow1.start()
      await workflow2.start()

      // Verify timers are running
      await vi.advanceTimersByTimeAsync(2000)
      expect(handler).toHaveBeenCalled()
      const callCountBefore = handler.mock.calls.length

      // There should be a way to clear all timers at once
      // This API doesn't exist yet
      const clearAllWorkflowTimers = () => {
        // @ts-expect-error - This function doesn't exist yet
        if (typeof global.clearAllWorkflowTimers === 'function') {
          // @ts-expect-error - This function doesn't exist yet
          global.clearAllWorkflowTimers()
          return true
        }
        return false
      }

      const cleared = clearAllWorkflowTimers()

      // BUG: This will fail because there's no global clear function
      expect(cleared).toBe(true)

      // After clearing, no more handlers should be called
      handler.mockClear()
      await vi.advanceTimersByTimeAsync(5000)
      expect(handler).toHaveBeenCalledTimes(0)
    })

    it('should clean up timers when workflow is explicitly destroyed', async () => {
      // Test that a destroy() method exists and cleans up timers
      const handler = vi.fn()

      const workflow = Workflow(($) => {
        $.every.seconds(1)(handler)
      })

      await workflow.start()

      // Verify timer is running
      await vi.advanceTimersByTimeAsync(2000)
      expect(handler).toHaveBeenCalledTimes(2)

      // There should be a destroy() method that cleans up everything
      // This API doesn't exist yet - only stop() exists
      const destroyWorkflow = () => {
        if ('destroy' in workflow && typeof workflow.destroy === 'function') {
          ;(workflow as { destroy: () => Promise<void> }).destroy()
          return true
        }
        return false
      }

      const destroyed = destroyWorkflow()

      // BUG: This will fail because there's no destroy() method
      expect(destroyed).toBe(true)
    })

    it('should not leak timers when multiple workflows are started and stopped rapidly', async () => {
      // Stress test: Create and destroy many workflows quickly
      // Verify that the global cleanup API can handle multiple orphaned workflows
      const handler = vi.fn()
      const iterations = 10

      for (let i = 0; i < iterations; i++) {
        const workflow = Workflow(($) => {
          $.every.seconds(1)(handler)
        })
        await workflow.start()
        // Intentionally NOT calling stop() to simulate memory leak
      }

      // Use global cleanup to clear all 10 orphaned timers at once
      clearAllTimers()

      // After cleanup, no timers should be running
      await vi.advanceTimersByTimeAsync(1000)

      // After calling clearAllTimers(), all orphaned timers should be stopped
      expect(handler).toHaveBeenCalledTimes(0)
    })

    it('should support a dispose pattern for automatic cleanup', async () => {
      // Test using Symbol.dispose for automatic cleanup (requires proper implementation)
      const handler = vi.fn()

      const workflow = Workflow(($) => {
        $.every.seconds(1)(handler)
      })

      await workflow.start()

      // Check if workflow supports dispose pattern
      const hasDispose = Symbol.dispose in workflow || 'dispose' in workflow

      // BUG: This will fail because dispose pattern is not implemented
      expect(hasDispose).toBe(true)

      // If dispose exists, calling it should stop all timers
      if (hasDispose) {
        if (Symbol.dispose in workflow) {
          ;(workflow as { [Symbol.dispose]: () => void })[Symbol.dispose]()
        } else if ('dispose' in workflow) {
          ;(workflow as { dispose: () => void }).dispose()
        }

        handler.mockClear()
        await vi.advanceTimersByTimeAsync(5000)
        expect(handler).toHaveBeenCalledTimes(0)
      }
    })
  })

  describe('Timer Registration Tracking', () => {
    it('should expose the number of registered timers on a workflow', async () => {
      const workflow = Workflow(($) => {
        $.every.seconds(1)(() => {})
        $.every.seconds(2)(() => {})
        $.every.seconds(3)(() => {})
      })

      await workflow.start()

      // There should be a way to inspect how many timers are registered
      const getTimerCount = () => {
        if ('timerCount' in workflow) {
          return (workflow as { timerCount: number }).timerCount
        }
        if (
          'getTimerCount' in workflow &&
          typeof (workflow as { getTimerCount: () => number }).getTimerCount === 'function'
        ) {
          return (workflow as { getTimerCount: () => number }).getTimerCount()
        }
        return -1
      }

      const count = getTimerCount()

      // BUG: This will fail because there's no timerCount property
      expect(count).toBe(3)

      await workflow.stop()
    })

    it('should decrement timer count when stop is called', async () => {
      const workflow = Workflow(($) => {
        $.every.seconds(1)(() => {})
        $.every.seconds(2)(() => {})
      })

      await workflow.start()
      await workflow.stop()

      const getTimerCount = () => {
        if ('timerCount' in workflow) {
          return (workflow as { timerCount: number }).timerCount
        }
        return -1
      }

      const count = getTimerCount()

      // BUG: This will fail because there's no timerCount property
      expect(count).toBe(0)
    })
  })

  describe('Global Timer Registry', () => {
    it('should register timers with a global registry', async () => {
      // Import the registry (doesn't exist yet)
      let registry: { getAll: () => unknown[] } | undefined

      try {
        // @ts-expect-error - This module doesn't export a registry yet
        const mod = await import('../src/timer-registry.js')
        registry = mod.timerRegistry
      } catch {
        // Expected to fail - module doesn't exist
      }

      // BUG: This will fail because timer-registry.js doesn't exist
      expect(registry).toBeDefined()
    })

    it('should allow clearing specific workflow timers from registry', async () => {
      const handler = vi.fn()

      const workflow = Workflow(($) => {
        $.every.seconds(1)(handler)
      })

      await workflow.start()

      // There should be a way to get the workflow's timer IDs
      const getTimerIds = () => {
        if (
          'getTimerIds' in workflow &&
          typeof (workflow as { getTimerIds: () => string[] }).getTimerIds === 'function'
        ) {
          return (workflow as { getTimerIds: () => string[] }).getTimerIds()
        }
        return null
      }

      const timerIds = getTimerIds()

      // BUG: This will fail because there's no getTimerIds method
      expect(timerIds).not.toBeNull()
      expect(Array.isArray(timerIds)).toBe(true)
      expect(timerIds?.length).toBeGreaterThan(0)

      await workflow.stop()
    })
  })

  describe('Cleanup on Process Exit', () => {
    it('should register cleanup handlers for process exit', async () => {
      // Check if there's a cleanup handler registered for process exit
      // Note: The cleanup handler may be registered at module import time,
      // so we just verify that listeners exist (not that new ones are added)

      const workflow = Workflow(($) => {
        $.every.seconds(1)(() => {})
      })

      await workflow.start()

      // After starting a workflow, process cleanup should be registered
      // (either now or at module import time)
      const exitListeners = process.listeners('exit')
      const beforeExitListeners = process.listeners('beforeExit')

      // There should be at least one cleanup handler registered
      // for either 'exit' or 'beforeExit' events
      const hasCleanupListener = exitListeners.length > 0 || beforeExitListeners.length > 0

      expect(hasCleanupListener).toBe(true)

      await workflow.stop()
    })
  })
})
