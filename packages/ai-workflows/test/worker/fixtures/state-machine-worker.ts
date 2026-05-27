/**
 * Miniflare test-fixture worker for the state-machine Durable Object adapter.
 *
 * Defines a concrete {@link StateMachineDurableObject} subclass bound to a tiny
 * test machine, plus a default `fetch` handler that routes requests to the DO so
 * the Miniflare integration test can drive the actor over HTTP (external events)
 * and trigger the alarm path. The DO `alarm()` / `fetch()` wiring under test
 * lives in the base class in `src/state-machine/durable-object-adapter.ts`.
 *
 * The machine has both an event-driven transition (`PING -> pinged`) and a
 * timer-driven `after` transition (`armed -(50ms)-> firedByTimer`), so the test
 * can exercise the fetch->event and alarm->timer paths and the resume path.
 */

import type { MachineConfig } from 'xstate'
import {
  StateMachineDurableObject,
  type StateMachineBootOptions,
} from '../../../src/state-machine/durable-object-adapter.js'

/**
 * Test statechart:
 *   idle --PING--> pinged --ARM--> armed --(after 50ms)--> firedByTimer
 *                                       \--CANCEL--> idle
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const testMachine: MachineConfig<any, any> = {
  id: 'sm-do-test',
  initial: 'idle',
  states: {
    idle: { on: { PING: 'pinged' } },
    pinged: { on: { ARM: 'armed' } },
    armed: {
      on: { CANCEL: 'idle' },
      after: { 50: 'firedByTimer' },
    },
    firedByTimer: { type: 'final' },
  },
}

/**
 * Concrete DO bound to {@link testMachine}. Uses a fixed machineId per DO
 * instance so storage keys are deterministic across requests to the same id.
 */
export class StateMachineTestDO extends StateMachineDurableObject {
  protected describeMachine(): StateMachineBootOptions {
    return { machine: testMachine, machineId: 'sm-do-test-instance' }
  }

  /**
   * Test seam: simulate DO hibernation/eviction by dropping all in-memory state
   * (the running actor + any closures) while durable `state.storage` survives.
   * The next `fetch()` / `alarm()` reconstructs a fresh actor from storage —
   * proving an `after` timer survives reconstruction with no in-memory callback.
   */
  simulateHibernation(): void {
    this.forgetInMemoryState()
  }
}

interface Env {
  STATE_MACHINE_DO: DurableObjectNamespace
}

/**
 * Route every request to a single named DO instance so the test can address it
 * by a stable name and observe persistence/resume across requests.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const id = env.STATE_MACHINE_DO.idFromName('singleton')
    const stub = env.STATE_MACHINE_DO.get(id)
    return stub.fetch(request)
  },
}
