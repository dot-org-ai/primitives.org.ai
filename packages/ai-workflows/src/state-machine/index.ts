/**
 * State machine workflows - public surface.
 *
 * The hierarchical state machine runtime from ADR-0011 / the xstate PRD. Runs
 * as a peer to the DAG {@link import('../workflow-builder.js').WorkflowBuilder}.
 * This barrel exposes the spine of the capability:
 *
 *   - {@link runMachine} — the actor-lifecycle entry point.
 *   - {@link StateMachineStorage} — the durability port (snapshot read/write,
 *     event-log append, timer schedule/cancel) plus the in-memory adapter.
 *   - A re-export of xstate's `createMachine` and the `MachineConfig` type so
 *     callers author typed statecharts without a direct xstate import.
 *
 * Later slices add the mermaid wire format (`fromMermaid` / `toMermaid`), the
 * event bridge, and the DO / pg storage adapters; their exports land here.
 *
 * @packageDocumentation
 */

// Runtime - actor lifecycle entry point + handle
export {
  runMachine,
  type RunnableMachine,
  type RunMachineOptions,
  type MachineHandle,
  type ActorClock,
} from './runtime.js'

// Durable Object storage adapter + host DO class
export {
  createDurableObjectStateMachineStorage,
  StateMachineDurableObject,
  type DurableObjectStateMachineStorage,
  type DurableObjectStorageLike,
  type DurableObjectStateLike,
  type StateMachineBootOptions,
} from './durable-object-adapter.js'

// Storage port + in-memory adapter
export {
  createInMemoryStateMachineStorage,
  type StateMachineStorage,
  type StateMachineStorageKind,
  type InMemoryStateMachineStorage,
  type PersistedMachineSnapshot,
  type MachineEventLogEntry,
  type ScheduledTimer,
} from './storage.js'

// xstate authoring surface re-export - callers write typed statecharts without
// importing xstate directly.
export { createMachine } from 'xstate'
export type { MachineConfig } from 'xstate'
