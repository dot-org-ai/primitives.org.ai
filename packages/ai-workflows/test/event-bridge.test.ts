import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMachine } from 'xstate'
import { runMachine } from '../src/state-machine/runtime.js'
import { bridgeMachineToEventBus } from '../src/state-machine/event-bridge.js'
import type { EventBusPort } from '../src/state-machine/event-bridge.js'
import { createInMemoryStateMachineStorage } from '../src/state-machine/storage.js'
import { send } from '../src/send.js'
import { on, getEventHandlers, clearEventHandlers } from '../src/on.js'

/**
 * A tiny review machine used across the suite:
 *
 *   idle --REQUEST_REVIEW--> awaitingReview --REVIEW_COMPLETED--> done
 *
 * `awaitingReview` is the outbound-emitting state (it requests a review);
 * `REVIEW_COMPLETED` is the inbound event that arrives from a worker.
 */
function reviewMachine() {
  return createMachine({
    id: 'review',
    initial: 'idle',
    context: { verdict: undefined as string | undefined },
    states: {
      idle: {
        on: { REQUEST_REVIEW: 'awaitingReview' },
      },
      awaitingReview: {
        on: { REVIEW_COMPLETED: 'done' },
      },
      done: { type: 'final' },
    },
  })
}

/**
 * A test bus port that records every outbound emit and lets the test deliver
 * inbound events to whatever inbound handler the bridge registered. Isolated
 * from the global bus so lifecycle assertions are unambiguous.
 */
function createTestBus(): EventBusPort & {
  deliver(event: string, data: unknown): void
  emitted: Array<{ event: string; data: unknown }>
  handlerCount(noun: string, event: string): number
} {
  const handlers = new Map<string, Set<(data: unknown, $: unknown) => void>>()
  const emitted: Array<{ event: string; data: unknown }> = []
  const key = (noun: string, event: string) => `${noun}.${event}`

  return {
    register(noun, event, handler) {
      const k = key(noun, event)
      if (!handlers.has(k)) handlers.set(k, new Set())
      handlers.get(k)!.add(handler as (data: unknown, $: unknown) => void)
    },
    remove(noun, event, handler) {
      handlers.get(key(noun, event))?.delete(handler as (data: unknown, $: unknown) => void)
    },
    send(event, data) {
      emitted.push({ event, data })
    },
    deliver(event, data) {
      const parts = event.split('.')
      const k = key(parts[0]!, parts[1]!)
      for (const h of handlers.get(k) ?? []) h(data, {})
    },
    emitted,
    handlerCount(noun, event) {
      return handlers.get(key(noun, event))?.size ?? 0
    },
  }
}

describe('event-bridge - bidirectional actor <-> event bus', () => {
  describe('inbound: bus event -> actor.send', () => {
    it('translates a matched bus event into a typed actor.send and transitions', () => {
      const storage = createInMemoryStateMachineStorage()
      // build synchronously: runMachine is async, but we drive through a bus
      // port we control, so resolve the handle first.
      return runMachine(reviewMachine(), storage, { machineId: 'in-1' }).then((handle) => {
        const bus = createTestBus()
        const dispose = bridgeMachineToEventBus(handle, {
          inbound: {
            'Review.requestStarted': { type: 'REQUEST_REVIEW' },
            'Worker.reviewCompleted': { type: 'REVIEW_COMPLETED' },
          },
          bus,
        })

        expect(handle.getState()).toBe('idle')

        bus.deliver('Review.requestStarted', {})
        expect(handle.getState()).toBe('awaitingReview')

        bus.deliver('Worker.reviewCompleted', { verdict: 'approved' })
        expect(handle.getState()).toBe('done')

        dispose()
      })
    })

    it('forwards the bus payload onto the actor event by default', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'in-2' })
      const sendSpy = vi.spyOn(handle, 'send')
      const bus = createTestBus()
      const dispose = bridgeMachineToEventBus(handle, {
        inbound: { 'Worker.reviewCompleted': { type: 'REVIEW_COMPLETED' } },
        bus,
      })

      bus.deliver('Worker.reviewCompleted', { verdict: 'rejected', persona: 'security' })

      expect(sendSpy).toHaveBeenCalledWith({
        type: 'REVIEW_COMPLETED',
        verdict: 'rejected',
        persona: 'security',
      })
      dispose()
    })

    it('applies a custom mapPayload transform', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'in-3' })
      const sendSpy = vi.spyOn(handle, 'send')
      const bus = createTestBus()
      const dispose = bridgeMachineToEventBus(handle, {
        inbound: {
          'Worker.reviewCompleted': {
            type: 'REVIEW_COMPLETED',
            mapPayload: (p) => ({ verdict: (p as { result: string }).result }),
          },
        },
        bus,
      })

      bus.deliver('Worker.reviewCompleted', { result: 'approved' })

      expect(sendSpy).toHaveBeenCalledWith({ type: 'REVIEW_COMPLETED', verdict: 'approved' })
      dispose()
    })

    it('rejects a malformed inbound pattern up front', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'in-4' })
      expect(() =>
        bridgeMachineToEventBus(handle, {
          inbound: { 'not-a-valid-pattern': { type: 'X' } },
          bus: createTestBus(),
        })
      ).toThrow(/Invalid inbound bus pattern/)
      handle.stop()
    })
  })

  describe('outbound: state entry -> bus send', () => {
    it('emits a bus event when the actor enters a configured state', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'out-1' })
      const bus = createTestBus()
      const dispose = bridgeMachineToEventBus(handle, {
        outbound: {
          awaitingReview: { event: 'Review.requested' },
          done: { event: 'Review.finished' },
        },
        bus,
      })

      // Initial state is idle - no emit yet.
      expect(bus.emitted).toHaveLength(0)

      handle.send('REQUEST_REVIEW')
      expect(bus.emitted).toEqual([
        {
          event: 'Review.requested',
          data: { state: 'awaitingReview', context: expect.anything() },
        },
      ])

      handle.send('REVIEW_COMPLETED')
      expect(bus.emitted).toHaveLength(2)
      expect(bus.emitted[1]).toMatchObject({ event: 'Review.finished', data: { state: 'done' } })
      dispose()
    })

    it('emits for an initial state that is configured for emission', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'out-2' })
      const bus = createTestBus()
      const dispose = bridgeMachineToEventBus(handle, {
        outbound: { idle: { event: 'Review.idleEntered' } },
        bus,
      })

      expect(bus.emitted).toEqual([
        { event: 'Review.idleEntered', data: { state: 'idle', context: expect.anything() } },
      ])
      dispose()
    })

    it('uses a custom buildPayload when provided', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'out-3' })
      const bus = createTestBus()
      const dispose = bridgeMachineToEventBus(handle, {
        outbound: {
          awaitingReview: {
            event: 'Review.requested',
            buildPayload: () => ({ prId: 'pr-42' }),
          },
        },
        bus,
      })

      handle.send('REQUEST_REVIEW')
      expect(bus.emitted).toEqual([{ event: 'Review.requested', data: { prId: 'pr-42' } }])
      dispose()
    })

    it('rejects a malformed outbound event up front', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'out-4' })
      expect(() =>
        bridgeMachineToEventBus(handle, {
          outbound: { awaitingReview: { event: 'badname' } },
          bus: createTestBus(),
        })
      ).toThrow(/Invalid outbound bus event/)
      handle.stop()
    })
  })

  describe('lifecycle: clean teardown, no leaked subscriptions', () => {
    it('stops delivering inbound events to the actor after dispose', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'life-1' })
      const bus = createTestBus()
      const dispose = bridgeMachineToEventBus(handle, {
        inbound: { 'Review.requestStarted': { type: 'REQUEST_REVIEW' } },
        bus,
      })

      expect(bus.handlerCount('Review', 'requestStarted')).toBe(1)

      dispose()

      // The bus handler is gone...
      expect(bus.handlerCount('Review', 'requestStarted')).toBe(0)
      // ...and a post-dispose delivery is a no-op (no handler left to forward).
      bus.deliver('Review.requestStarted', {})
      expect(handle.getState()).toBe('idle')
    })

    it('stops emitting outbound events after dispose', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'life-2' })
      const bus = createTestBus()
      const dispose = bridgeMachineToEventBus(handle, {
        outbound: { awaitingReview: { event: 'Review.requested' } },
        bus,
      })

      dispose()
      handle.send('REQUEST_REVIEW')
      expect(handle.getState()).toBe('awaitingReview')
      expect(bus.emitted).toHaveLength(0)
    })

    it('disposes itself when the machine stops (no leaked inbound handler)', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'life-3' })
      const bus = createTestBus()
      bridgeMachineToEventBus(handle, {
        inbound: { 'Review.requestStarted': { type: 'REQUEST_REVIEW' } },
        bus,
      })

      expect(bus.handlerCount('Review', 'requestStarted')).toBe(1)

      handle.stop()

      // Self-dispose on actor stop removed the bus handler.
      expect(bus.handlerCount('Review', 'requestStarted')).toBe(0)
    })

    it('disposes itself when the machine reaches a final state', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'life-4' })
      const bus = createTestBus()
      bridgeMachineToEventBus(handle, {
        inbound: { 'Worker.reviewCompleted': { type: 'REVIEW_COMPLETED' } },
        bus,
      })

      handle.send('REQUEST_REVIEW')
      handle.send('REVIEW_COMPLETED') // -> done (final)

      expect(handle.getState()).toBe('done')
      // Reaching a final state stops the actor; the bridge tore down with it.
      expect(bus.handlerCount('Worker', 'reviewCompleted')).toBe(0)
    })

    it('dispose is idempotent', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'life-5' })
      const bus = createTestBus()
      const dispose = bridgeMachineToEventBus(handle, {
        inbound: { 'Review.requestStarted': { type: 'REQUEST_REVIEW' } },
        bus,
      })

      expect(() => {
        dispose()
        dispose()
        dispose()
      }).not.toThrow()
      handle.stop()
    })
  })

  describe('integration with the real global on/send bus', () => {
    beforeEach(() => {
      clearEventHandlers()
    })

    it('inbound: a global send() reaches the actor through the bridge', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'glob-1' })
      // Default bus = global on/send.
      const dispose = bridgeMachineToEventBus(handle, {
        inbound: { 'Worker.reviewCompleted': { type: 'REVIEW_COMPLETED' } },
      })

      handle.send('REQUEST_REVIEW')
      expect(handle.getState()).toBe('awaitingReview')

      await send('Worker.reviewCompleted', { verdict: 'approved' })
      expect(handle.getState()).toBe('done')

      dispose()
    })

    it('outbound: a state entry emits onto the global bus where on(...) consumes it', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'glob-2' })
      const received: unknown[] = []
      on.Review.requested((data) => {
        received.push(data)
      })

      const dispose = bridgeMachineToEventBus(handle, {
        outbound: { awaitingReview: { event: 'Review.requested' } },
      })

      handle.send('REQUEST_REVIEW')
      // The global send() is async; let the microtask queue drain.
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(received).toHaveLength(1)
      expect(received[0]).toMatchObject({ state: 'awaitingReview' })

      dispose()
    })

    it('dispose removes only this bridge handler from the global registry', async () => {
      const storage = createInMemoryStateMachineStorage()
      const handle = await runMachine(reviewMachine(), storage, { machineId: 'glob-3' })
      // A pre-existing unrelated handler must survive the bridge teardown.
      on.Other.thing(() => {})
      expect(getEventHandlers()).toHaveLength(1)

      const dispose = bridgeMachineToEventBus(handle, {
        inbound: { 'Worker.reviewCompleted': { type: 'REVIEW_COMPLETED' } },
      })
      expect(getEventHandlers()).toHaveLength(2)

      dispose()
      // Only the bridge's handler was removed; the unrelated one remains.
      expect(getEventHandlers()).toHaveLength(1)
      expect(getEventHandlers()[0]?.noun).toBe('Other')
    })
  })
})
