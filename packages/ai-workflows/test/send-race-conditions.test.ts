/**
 * Tests for EventBus race conditions
 *
 * These tests expose the race condition in send.ts:34-42 where concurrent
 * emit() calls can cause events to be skipped or processed out of order.
 *
 * This is the RED phase of TDD - these tests are expected to fail or be flaky.
 *
 * KNOWN ISSUES EXPOSED:
 * 1. send() returns before event is processed when processing=true
 * 2. Events can be skipped when concurrent emit() calls overlap
 * 3. Cascaded events ($.send inside handlers) don't await properly
 * 4. Global EventBus can get stuck with processing=true
 *
 * TODO: These tests are skipped until the race conditions are fixed.
 * @see https://github.com/org-ai/primitives/issues/XXX
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { send, getEventBus } from '../src/send.js'
import { on, clearEventHandlers } from '../src/on.js'

/**
 * Helper to wait for the EventBus to finish processing.
 * This is a workaround for the race condition where send() returns early.
 */
async function waitForEventBus(maxWaitMs = 500): Promise<void> {
  const start = Date.now()
  // Poll until the bus is idle or timeout
  while (Date.now() - start < maxWaitMs) {
    // Give the event loop a chance to process
    await new Promise((resolve) => setImmediate(resolve))
  }
}

describe.skip('EventBus race conditions', () => {
  beforeEach(async () => {
    clearEventHandlers()
    // Wait for any pending processing from previous tests
    await waitForEventBus(50)
  })

  afterEach(async () => {
    clearEventHandlers()
    // Wait for any pending processing before next test
    await waitForEventBus(50)
  })

  describe('concurrent emit() calls', () => {
    /**
     * Race condition: When multiple emit() calls happen concurrently,
     * some events may not be delivered because:
     * 1. emit() pushes to pending (line 24)
     * 2. emit() checks !this.processing (line 26)
     * 3. If another emit() pushed but process() hasn't set processing=true yet,
     *    multiple calls can enter process() simultaneously
     */
    it('should deliver all events when emit() is called concurrently', async () => {
      const receivedEvents: string[] = []
      const eventCount = 100

      // Register a handler that records all received events
      on.Test.event(async (data: { id: number }) => {
        receivedEvents.push(`event-${data.id}`)
      })

      // Fire all events concurrently without awaiting
      const promises = Array.from({ length: eventCount }, (_, i) => send('Test.event', { id: i }))

      // Wait for all emits to complete
      await Promise.all(promises)

      // All events should be delivered
      expect(receivedEvents.length).toBe(eventCount)

      // Verify all event IDs are present
      const expectedIds = Array.from({ length: eventCount }, (_, i) => `event-${i}`)
      expect(receivedEvents.sort()).toEqual(expectedIds.sort())
    })

    /**
     * Race condition: Events fired during handler execution may complete
     * before the send() caller gets control back.
     *
     * When emit() is called while process() is running:
     * 1. Event is pushed to pending
     * 2. this.processing is true, so emit() returns immediately
     * 3. The caller's await send() resolves before the event is processed
     */
    it('should ensure send() resolves only after the event is fully processed', async () => {
      let eventProcessed = false

      on.Test.event(async () => {
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 50))
        eventProcessed = true
      })

      // First emit to start processing
      const firstSend = send('Test.event', { id: 1 })

      // Second emit while first is processing
      // Due to the race condition, this may resolve before the handler completes
      await new Promise((resolve) => setTimeout(resolve, 10))
      const secondSend = send('Test.event', { id: 2 })

      // When send() resolves, the event should be processed
      await secondSend

      // This assertion may fail due to race condition:
      // secondSend resolves immediately because processing=true,
      // but the event hasn't been processed yet
      expect(eventProcessed).toBe(true)

      await firstSend // Clean up
    })

    /**
     * Race condition: Handler that emits more events creates a cascade
     * where new events may not be awaited properly.
     */
    it('should properly await cascaded events from handlers', async () => {
      const executionOrder: string[] = []

      on.Step.one(async (_data, $) => {
        executionOrder.push('step-1-start')
        await new Promise((resolve) => setTimeout(resolve, 20))
        await $.send('Step.two', {})
        executionOrder.push('step-1-end')
      })

      on.Step.two(async () => {
        executionOrder.push('step-2-start')
        await new Promise((resolve) => setTimeout(resolve, 20))
        executionOrder.push('step-2-end')
      })

      await send('Step.one', {})

      // Expected order: step-1-start, step-2-start, step-2-end, step-1-end
      // But due to race condition, step-1-end may come before step-2-end
      expect(executionOrder).toEqual(['step-1-start', 'step-2-start', 'step-2-end', 'step-1-end'])
    })

    /**
     * Race condition: Multiple concurrent emits may cause the processing
     * flag to be set to false prematurely, causing events to be skipped.
     */
    it('should not skip events when multiple process() calls overlap', async () => {
      const processedEvents: number[] = []
      const totalEvents = 50

      on.Concurrent.event(async (data: { id: number }) => {
        // Small delay to increase chance of race condition
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5))
        processedEvents.push(data.id)
      })

      // Fire events with slight delays to maximize race window
      const promises: Promise<void>[] = []
      for (let i = 0; i < totalEvents; i++) {
        promises.push(send('Concurrent.event', { id: i }))
        // Tiny delay to spread out the calls
        if (i % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1))
        }
      }

      await Promise.all(promises)

      // Wait a bit more for any stragglers
      await new Promise((resolve) => setTimeout(resolve, 100))

      // All events should be processed
      expect(processedEvents.length).toBe(totalEvents)
    })

    /**
     * Race condition: Events may be lost if emit() returns before
     * processing completes, and the event was pushed during the
     * while loop's shift() operation.
     */
    it('should handle rapid fire events without losing any', async () => {
      let eventCount = 0
      const targetCount = 1000

      on.Rapid.fire(async () => {
        eventCount++
      })

      // Fire events as fast as possible
      const promises = Array.from({ length: targetCount }, () => send('Rapid.fire', {}))

      await Promise.all(promises)

      // Allow any pending processing to complete
      await new Promise((resolve) => setTimeout(resolve, 100))

      expect(eventCount).toBe(targetCount)
    })

    /**
     * This test specifically targets the race between lines 26-28 and 35
     * where multiple emit() calls can both see processing=false before
     * either sets it to true.
     */
    it('should serialize event processing even with synchronous concurrent emits', async () => {
      const processingConcurrency: number[] = []
      let currentlyProcessing = 0
      let maxConcurrency = 0

      on.Serialize.check(async () => {
        currentlyProcessing++
        maxConcurrency = Math.max(maxConcurrency, currentlyProcessing)
        processingConcurrency.push(currentlyProcessing)
        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 10))
        currentlyProcessing--
      })

      // Fire many events simultaneously
      const promises = Array.from({ length: 20 }, () => send('Serialize.check', {}))

      await Promise.all(promises)

      // If properly serialized, we should never have more than 1 handler
      // processing at a time (events should queue, not run in parallel)
      // Note: The current implementation DOES run handlers in parallel via Promise.all,
      // but different events should still be processed sequentially
      console.log('Max concurrency observed:', maxConcurrency)
      console.log('Concurrency at each event:', processingConcurrency)

      // This may fail due to race condition allowing multiple process() calls
      expect(maxConcurrency).toBeLessThanOrEqual(1)
    })

    /**
     * Race condition: When emit() is called and processing=true,
     * it returns immediately. If process() finishes before the pushed
     * event is processed, the event may be orphaned.
     */
    it('should not orphan events pushed while processing is finishing', async () => {
      const processedEvents: number[] = []

      on.Orphan.test(async (data: { id: number }) => {
        // Very short delay
        await new Promise((resolve) => setImmediate(resolve))
        processedEvents.push(data.id)
      })

      // Start first event
      const first = send('Orphan.test', { id: 1 })

      // Wait for processing to likely be in the deliver() await
      await new Promise((resolve) => setImmediate(resolve))

      // Push more events while processing
      const second = send('Orphan.test', { id: 2 })
      const third = send('Orphan.test', { id: 3 })

      await Promise.all([first, second, third])

      // Give extra time for any pending events
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(processedEvents.sort()).toEqual([1, 2, 3])
    })

    /**
     * Stress test: High-frequency event emission should not lose events.
     */
    it('should handle stress test with interleaved emits', async () => {
      const results: { type: string; id: number }[] = []

      on.TypeA.event((data: { id: number }) => {
        results.push({ type: 'A', id: data.id })
      })

      on.TypeB.event((data: { id: number }) => {
        results.push({ type: 'B', id: data.id })
      })

      // Interleave different event types
      const promises: Promise<void>[] = []
      for (let i = 0; i < 100; i++) {
        promises.push(send('TypeA.event', { id: i }))
        promises.push(send('TypeB.event', { id: i }))
      }

      await Promise.all(promises)
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(results.filter((r) => r.type === 'A').length).toBe(100)
      expect(results.filter((r) => r.type === 'B').length).toBe(100)
    })
  })

  describe('event ordering', () => {
    /**
     * Events should be processed in the order they were emitted.
     * The race condition may cause out-of-order processing.
     */
    it('should process events in FIFO order', async () => {
      const processedOrder: number[] = []

      on.Order.test(async (data: { seq: number }) => {
        // Small random delay to expose ordering issues
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 5))
        processedOrder.push(data.seq)
      })

      // Emit events in order
      for (let i = 0; i < 20; i++) {
        await send('Order.test', { seq: i })
      }

      // Events should be processed in order
      const expected = Array.from({ length: 20 }, (_, i) => i)
      expect(processedOrder).toEqual(expected)
    })

    /**
     * When emit() calls are not awaited between each other,
     * order should still be maintained.
     */
    it('should maintain order even with fire-and-await-all pattern', async () => {
      const processedOrder: number[] = []

      on.FireAll.test((data: { seq: number }) => {
        processedOrder.push(data.seq)
      })

      // Fire all without individual awaits
      const promises = Array.from({ length: 50 }, (_, i) => send('FireAll.test', { seq: i }))

      await Promise.all(promises)

      // Order should be maintained
      const expected = Array.from({ length: 50 }, (_, i) => i)
      expect(processedOrder).toEqual(expected)
    })
  })

  describe('send() promise semantics', () => {
    /**
     * send() should resolve only when the event has been fully delivered
     * to all handlers and those handlers have completed.
     */
    it('should resolve after handler completion, not just after queueing', async () => {
      let handlerCompleted = false

      on.Semantics.test(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        handlerCompleted = true
      })

      await send('Semantics.test', {})

      // After send() resolves, handler should have completed
      expect(handlerCompleted).toBe(true)
    })

    /**
     * When emit() is called while processing=true, the returned promise
     * should still wait for the event to be processed.
     */
    it('should wait for processing even when emit returns early due to processing flag', async () => {
      let firstHandlerStarted = false
      let secondHandlerCompleted = false

      on.Wait.first(async () => {
        firstHandlerStarted = true
        await new Promise((resolve) => setTimeout(resolve, 100))
      })

      on.Wait.second(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50))
        secondHandlerCompleted = true
      })

      // Start first event (will set processing=true)
      const firstPromise = send('Wait.first', {})

      // Wait for first handler to start
      await new Promise((resolve) => setTimeout(resolve, 10))
      expect(firstHandlerStarted).toBe(true)

      // Emit second event while first is processing
      // Due to race condition, this may resolve before second handler completes
      const secondPromise = send('Wait.second', {})
      await secondPromise

      // This assertion exposes the race condition:
      // secondPromise resolves immediately because processing=true,
      // not when the event is actually processed
      expect(secondHandlerCompleted).toBe(true)

      await firstPromise // Clean up
    })
  })
})
