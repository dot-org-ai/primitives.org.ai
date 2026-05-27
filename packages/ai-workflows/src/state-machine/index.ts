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
 *   - {@link bridgeMachineToEventBus} — the bidirectional event bridge wiring an
 *     actor to the `ai-workflows` `on` / `send` bus (inbound bus → `actor.send`,
 *     outbound state-entry → `send`).
 *   - A re-export of xstate's `createMachine` and the `MachineConfig` type so
 *     callers author typed statecharts without a direct xstate import.
 *   - {@link fromMermaid} — the mermaid `stateDiagram-v2` wire format parser
 *     (flat subset). Produces a `MachineConfig` whose guards / actions are
 *     string names the caller provides at machine-creation time.
 *
 * Later slices add the rest of the mermaid wire format (`toMermaid`, composite
 * / parallel / history parsing) and the DO / pg storage adapters; their exports
 * land here.
 *
 * @packageDocumentation
 */

// Runtime - actor lifecycle entry point + handle
export {
  runMachine,
  type RunnableMachine,
  type RunMachineOptions,
  type MachineHandle,
} from './runtime.js'

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

// Event bridge - bidirectional wiring between an actor and the event bus
export {
  bridgeMachineToEventBus,
  type MachineEventBusConfig,
  type InboundMapping,
  type OutboundMapping,
  type BridgeMachineToEventBusOptions,
  type EventBusPort,
  type BridgeDisposer,
} from './event-bridge.js'

// xstate authoring surface re-export - callers write typed statecharts without
// importing xstate directly.
export { createMachine } from 'xstate'
export type { MachineConfig } from 'xstate'

// Mermaid wire format - parser (flat subset).
export { fromMermaid, MermaidParseError, type ParsedMachineConfig } from './mermaid-parser.js'
