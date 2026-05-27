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
 *   - {@link toMermaid} — the mermaid `stateDiagram-v2` renderer (flat subset).
 *     The exact inverse of {@link fromMermaid}; emits a diagram from a
 *     `MachineConfig` (with an optional active-state highlight).
 *
 * Later slices add the rest of the mermaid wire format (composite / parallel /
 * history parsing + rendering) and the DO / pg storage adapters; their exports
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

// Postgres storage adapter + scheduler + run/replay helpers (via injected
// PgExecutor — no ai-database import; see postgres-adapter.ts layering note)
export {
  createPostgresStateMachineStorage,
  createPostgresStateMachineScheduler,
  bootstrapStateMachineSchema,
  runStoredMachine,
  replayMachine,
  type PgExecutor,
  type PostgresStateMachineStorage,
  type PostgresStateMachineStorageOptions,
  type PostgresStateMachineTables,
  type PostgresStateMachineScheduler,
  type DueTimer,
  type RunStoredMachineOptions,
} from './postgres-adapter.js'

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

// Mermaid wire format - renderer (flat subset). The exact inverse of the parser.
export {
  toMermaid,
  MermaidRenderError,
  type RenderableMachineConfig,
  type ToMermaidOptions,
} from './mermaid-renderer.js'
