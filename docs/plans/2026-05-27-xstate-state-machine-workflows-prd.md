# PRD — State machine workflows in ai-workflows via xstate; mermaid + xstate as bidirectional wire formats

**Date:** 2026-05-27
**Status:** ready-for-agent
**Origin:** Candidate H of the 2026-05-27 architecture review
**Related:** ADR-0011 (this PRD implements it), `CONTEXT.md` Workflow + State Machine entries, ADR-0003 (storage strategy), ADR-0004 (durable execution)

## Problem Statement

A developer building an event-driven, long-lived orchestration — PR-as-a-Service for devs.do is the canonical example — has no first-class durable representation in `ai-workflows`. The existing `WorkflowBuilder` DSL (`workflow().step().parallel().when().loop().forEach()`) expresses DAG-shaped flow well, but four shapes that the agentic-services roadmap depends on do not fit DAGs:

1. **Event-driven transitions.** The PR review loop advances on events that arrive from Worker action returns, webhooks, timers, and human decisions. The DSL's `.loop()` is a bounded retry, not an event-driven transition.
2. **Concurrent active state.** A workflow may be "awaiting review" AND "responding to a pause request" AND "scheduled for re-grill at 24h timeout" simultaneously. DAG executors don't represent multi-active state.
3. **Hierarchical state with history.** A "review" super-state containing per-persona sub-states needs history semantics so a workflow resuming after a pause returns to the exact sub-state it was in. The current DAG runtime has no equivalent.
4. **Diagrammable, LLM-authorable workflow shapes.** LLMs author orchestration shapes more reliably as `mermaid stateDiagram-v2` than as nested TypeScript DSL calls. The buyer-facing Service page, PR documentation, and dashboards need a visualizable form. The existing DSL has no diagram projection.

`ai-workflows` has a `Q2 2026 stateMachine()` roadmap entry that is a placeholder — no design rationale, no implementation path. A homegrown statechart runtime would take months to reach feature parity with what xstate has already shipped (full Harel statecharts with composite states, parallel regions, history, guards, persistence APIs, MIT-licensed).

## Solution

`ai-workflows` adopts xstate as the runtime for hierarchical state machine workflows. The integration is a thin shell around xstate that adds two seams:

1. **Wire format seam** — two formats accepted as authoring surfaces, both fed into `xstate.createMachine`:
   - **mermaid `stateDiagram-v2`** (string) — the LLM-authorable / human-readable wire format
   - **xstate `MachineConfig`** (TypeScript object) — the typed developer-authorable wire format

   A bidirectional translator pairs them — `fromMermaid(source)` parses to `MachineConfig`; `toMermaid(config)` renders the inverse. Both formats round-trip; the diagram is always available regardless of which surface was authored.

2. **Durability seam** — `StateMachineStorage` port with two adapters:
   - **DurableObjectAdapter** (default) — snapshot in DO storage; `alarm()` drives `after X` scheduled transitions; `fetch()` receives external events.
   - **PostgresAdapter** (via `ai-database`) — snapshot in a `state_machine_instances` row; event log in append-only table; scheduler via a timers table. Inherits ADR-0003 transactional/analytical split — pg-backed machines are queryable and replayable.

   xstate v5's `getPersistedSnapshot()` / `createActor(machine, { snapshot })` provide serialize/restore primitives; the adapters wrap these to satisfy the port.

The state machine runtime runs as a **peer** to the existing `WorkflowRuntime`, not as a step type inside it. Both runtimes share the `ai-workflows` event bus (`on` / `send` / `every` / `track`) — state machine transitions subscribe to bus events, and state-entry actions emit onto the bus. No new event primitives are introduced.

`ai-functions` gains a `mermaid()` primitive — an LLM-backed function that emits mermaid string output validated to parse into a runnable `MachineConfig`. The parser is the validator; generations that fail to parse are retried by the LLM call.

A renderer (xstate config → mermaid string) ships from day one. Same effort as the data-model ↔ ERD projection for Software: walk the config tree, emit lines. Authors who write xstate get a diagram for free; authors who write mermaid see the same diagram round-trip; PR review and docs use the same diagram.

## User Stories

1. As a developer building PR-as-a-Service for devs.do, I want to author a workflow with event-driven review loops as a mermaid state diagram, so that I can express "grill → PRD → issues → parallel waves → multi-persona review fan → loop until all approve → ship" declaratively.
2. As a developer authoring an orchestration, I want to write the workflow once as a mermaid state diagram and have it run as a durable state machine, so that I don't author the diagram and the runtime separately.
3. As a developer who prefers typed code, I want to author the same workflow in xstate's `MachineConfig` with full TypeScript autocomplete, so that I get type safety on states, events, and guards.
4. As a developer reviewing a workflow PR, I want to see a mermaid state diagram in the PR description regardless of whether the author wrote mermaid or xstate, so that I can review the orchestration visually.
5. As an LLM authoring a workflow shape from a natural-language brief, I want to emit mermaid stateDiagram-v2 source, so that my output is both human-readable and machine-runnable without an intermediate transformation step.
6. As a developer wiring an LLM call that should return a workflow, I want `ai-functions.mermaid(prompt)` to return a string validated to be a runnable state machine, so that I don't have to write the validation loop myself.
7. As a developer running a state machine on Cloudflare Workers, I want a Durable Object adapter that persists the snapshot, drives `after X` transitions via DO alarms, and receives external events via the DO fetch handler, so that machines survive restarts and respond to outside-world events.
8. As a developer running a state machine on Postgres-backed infrastructure, I want a PostgresAdapter that snapshots state, appends events to a log, and schedules timers in a database table, so that the machine's history is queryable / replayable / joinable with analytical workloads.
9. As a developer building a state machine workflow that needs to dispatch Worker actions, I want state-entry actions to emit onto the `ai-workflows` event bus, so that other workflows and Workers consume the same events with no new event primitives.
10. As a developer building a state machine workflow that needs to wait for external work, I want transitions to subscribe to `on(pattern)` patterns, so that Worker action returns, webhooks, timers, and `send()` calls all trigger transitions through one event surface.
11. As a developer composing multi-persona review fans (per the v3 `EvaluatorPanel` work in services-as-software), I want each persona's verdict to arrive as an event the state machine transitions on, so that the review loop is naturally event-driven rather than polled.
12. As a developer building a workflow with concurrent regions (e.g., a long-running review while a separate cancel-watch listens), I want orthogonal parallel substates so that the regions advance independently.
13. As a developer building a workflow with composite states (e.g., a "Review" super-state containing per-persona sub-states), I want history semantics so that pausing and resuming returns to the exact sub-state the workflow was in.
14. As a developer pausing a long-running workflow, I want the durable snapshot to capture the full active-state configuration so that resume restores every active region and history slot.
15. As an operator inspecting a running workflow, I want to fetch the current mermaid diagram with the active state highlighted, so that I can see at a glance where the workflow is.
16. As an operator replaying a workflow that failed, I want to fetch the event log and replay events against a fresh actor, so that I can reproduce the failure and root-cause it.
17. As a developer reading `CONTEXT.md`, I want **Workflow** and **State Machine** to be named domain concepts with documented runtimes and wire formats, so that the vocabulary in the docs matches the vocabulary in the code.
18. As a developer using the existing DAG `WorkflowBuilder`, I want my workflows to be unaffected by this change, so that DAG-shaped flows continue to work exactly as they do today.
19. As a developer choosing between the DAG and state-machine runtimes, I want documentation that names the shape (sequential / parallel / bounded loops → DAG; event-driven / long-lived / hierarchical / multi-active → state machine), so that I pick the right tool without guessing.
20. As a developer testing a state machine workflow, I want to drive an actor with a sequence of events and assert the resulting state config and emitted events, so that tests cross the runtime's natural seam.
21. As a developer testing a mermaid wire format, I want to round-trip a diagram (parse → render → compare) so that the bidirectional translator is provably faithful for the cases I rely on.
22. As a developer of the workers.do runtime (per the prior grilling session), I want the state machine wire format to be one of the projections of a Service spec, so that the canonical service shape can compile to mermaid + xstate config + buyer-facing prose.
23. As a maintainer of `ai-workflows`, I want xstate as a non-optional dependency to be explicitly recorded in ADR-0011, so that the load-bearing nature of the dependency is documented.
24. As a developer migrating off the Q2 2026 placeholder `stateMachine()` roadmap entry, I want this PRD to close that placeholder, so that the roadmap is concrete rather than aspirational.
25. As an LLM authoring state machine source for a service template, I want the parser to fail loudly with a specific error message when a generation contains ambiguous or unsupported mermaid syntax, so that the retry round produces a corrected output.

## Implementation Decisions

**Runtime placement.** The state machine runtime is a **peer** to the existing `WorkflowRuntime` — both live inside `ai-workflows`, both consume shared seams (event bus, `DurableExecutionAdapter`, the new `StateMachineStorage`). They do not share an executor; statecharts and DAGs are different computational models and forcing them through one runner makes the runner shallower.

**Dependency.** xstate v5 (MIT, stable). Added to `ai-workflows` `package.json` as a non-optional dependency. Per ADR-0011 this is a load-bearing dependency; the ADR captures the rationale.

**Module sketch — the modules introduced or modified:**

| Module | Role | Why it's a deep module |
|---|---|---|
| `ai-workflows/src/state-machine/runtime.ts` | Owns the actor lifecycle: takes a `MachineConfig`, a `StateMachineStorage` adapter, and an event-bus reference; creates the xstate actor; persists snapshots on transitions; relays bus events ↔ actor events. | Encapsulates the entire xstate integration behind one interface (`run(config, storage)`). Internally composes xstate + storage + event bus, but callers learn one entry point. |
| `ai-workflows/src/state-machine/storage.ts` | The `StateMachineStorage` port — snapshot read/write, event log append, timer schedule/cancel. | One interface; two real adapters (DO + pg) justify the seam from day one. |
| `ai-workflows/src/state-machine/durable-object-adapter.ts` | DO-backed `StateMachineStorage` adapter. Wraps DO `state.storage`, `alarm()`, and `fetch()`. | Hides the DO surface details (alarm scheduling, storage transactions) behind the port. |
| `ai-workflows/src/state-machine/postgres-adapter.ts` | Postgres-backed `StateMachineStorage` adapter via `ai-database`. Snapshot row + event log table + timers table. | Hides the pg schema and scheduler details behind the port. |
| `ai-workflows/src/state-machine/mermaid-parser.ts` | Parses mermaid `stateDiagram-v2` source into xstate `MachineConfig`. | One interface (`fromMermaid(source): MachineConfig`); the parser absorbs all of stateDiagram-v2's syntax. Tested by round-trip; consumed by `ai-functions.mermaid()` for validation. |
| `ai-workflows/src/state-machine/mermaid-renderer.ts` | Walks an xstate `MachineConfig` and emits mermaid `stateDiagram-v2` source. | One interface (`toMermaid(config): string`); the renderer absorbs the config-tree-walk. |
| `ai-workflows/src/state-machine/index.ts` | Public surface — `runMachine`, `fromMermaid`, `toMermaid`, `MachineConfig` re-export, storage adapters. | The wire format and storage choices live behind one barrel. |
| `ai-workflows/src/state-machine/event-bridge.ts` | Bidirectional bridge between the xstate actor and the `ai-workflows` event bus. Bus events with patterns matching transitions translate to `actor.send`; state-entry actions and inspect hooks emit Actions onto the bus. | One interface; encapsulates the wiring so callers don't subscribe / unsubscribe manually. |
| `ai-functions/src/mermaid.ts` | New `mermaid(prompt, options)` primitive. LLM call → string output → validate via `mermaid-parser` → retry on parse failure. | One interface (`mermaid(prompt): Promise<string>`); the validation loop and retry policy live inside. |
| `ai-workflows/src/index.ts` | Add the state-machine surface to the package exports. | Existing `WorkflowBuilder` exports unaffected. |

**Wire format mapping (mermaid stateDiagram-v2 ↔ xstate MachineConfig).** The mapping is structural; both formats express Harel statecharts.

| mermaid | xstate |
|---|---|
| `state foo` | `states: { foo: { ... } }` |
| `[*] --> foo` | top-level `initial: 'foo'` |
| `foo --> bar : EV` | `foo.on.EV: 'bar'` |
| `foo --> bar : EV [guard]` | `foo.on.EV: { target: 'bar', guard: 'guard' }` |
| `foo : entry / action` | `foo.entry: ['action']` |
| `foo : exit / action` | `foo.exit: ['action']` |
| `state Composite { ... }` | nested `states` config |
| `--` (in composite) | `type: 'parallel'` and child regions |
| `[H]` | `history: 'shallow'` |
| `[H*]` | `history: 'deep'` |
| `note right of foo` | ignored (documentation only) |

Full `stateDiagram-v2` parsing is in scope — the user committed to "everything possible" and xstate v5 has the corresponding feature for every mermaid construct. Edge cases the parser cannot map (custom mermaid extensions, malformed input) fail loudly with a specific error message; they do not silently downgrade.

**Event bridge — concrete wiring.** Bidirectional, thin:

- Inbound: `on('worker.review.completed', handler)` on the bus. The handler calls `actor.send({ type: 'REVIEW_COMPLETED', ...payload })`. Pattern → event type mapping is configured per machine (via a top-level `eventBus` config block in the `MachineConfig`).
- Outbound: xstate's `inspect` API receives every transition; the bridge filters for transitions tagged with a bus event and `send`s onto the bus. State-entry actions can also `emit` events that the bridge relays.

**Active-state durability.** xstate v5's `getPersistedSnapshot()` returns a structurally serializable snapshot — including all parallel-region states and history slots. The DO adapter writes this snapshot to storage on every transition. The pg adapter writes it as a JSONB column on the snapshot row. Resume calls `createActor(machine, { snapshot })`.

**Timers.** xstate's `after` transitions translate to:
- DO adapter — `state.storage.setAlarm(timestamp)`. The DO `alarm()` handler resolves which transition fires and calls `actor.send`.
- pg adapter — insert into `state_machine_timers (machine_id, transition_id, fire_at)`. A scheduler (existing in `ai-workflows/src/cron-scheduler.ts` or a new tiny one for sub-cron precision) wakes machines at `fire_at`.

**Renderer.** Walks the `MachineConfig` tree. For each state: emit declaration, entry/exit actions, nested states (with composite syntax), parallel-region separators, history markers. For each transition: emit source / target / event / guard. Tested by round-trip.

**No new ADR needed for the bidirectional event bridge / runtime placement / two-runtime decision** — all three are captured in ADR-0011. This PRD implements the ADR.

## Testing Decisions

**What makes a good test here:** drive the actor with a sequence of events (or drive the bus with messages that should reach the actor) and assert on the resulting state configuration, persisted snapshot, and bus-emitted events. The interface is the entry point (`runMachine` / `fromMermaid` / `toMermaid` / `mermaid()`); tests cross those exact seams. Tests that mock xstate internals or assert on intermediate parser AST shapes are skipped.

**Modules to test:**

| Module | Test approach |
|---|---|
| `mermaid-parser` | Property test: corpus of stateDiagram-v2 snippets covering every supported construct (states, transitions, guards, entry/exit, composite, parallel, history). For each, assert the produced `MachineConfig` runs the expected example trace under xstate. |
| `mermaid-renderer` | Round-trip test: corpus of xstate `MachineConfig` objects → render → parse → compare. Equality up to structural normalization. |
| Round-trip | For each mermaid example: parse → render → parse → compare configs. For each xstate example: render → parse → render → compare strings (after normalization). |
| `StateMachineStorage` contract | Shared contract test (one test file, run against both adapters). Set snapshot, get snapshot, append event, schedule timer, cancel timer, fire timer. Asserts both adapters satisfy the same observable behaviour. |
| `runtime.ts` (integration) | End-to-end: take a mermaid PR-review machine, run it against the DO adapter (Miniflare in-process), feed it review-completed events, assert it progresses through states, persists snapshots, and emits the right bus events. Repeat against the pg adapter. |
| `event-bridge` | Drive the bus with patterned events; assert the actor received the expected `actor.send` calls. Drive the actor through state transitions; assert the bus received the expected emits. |
| `ai-functions.mermaid()` | Integration test against an LLM (already the pattern for the AI-dependent test suite — long timeouts, single-worker execution per `CLAUDE.md`). Prompt → mermaid → parse → assert it runs. Retry-on-parse-failure path tested by injecting a fake invalid LLM response on the first call. |
| Diagram-with-active-state-highlight | Snapshot test that `toMermaid(config, { highlight: actor.getSnapshot().value })` produces a diagram with the expected classDef styling applied to active states. |

**Prior art for the tests:**

- `packages/ai-workflows/test/workflow-builder.test.ts` — the existing DAG builder tests; the state-machine integration tests follow the same shape (build a workflow, drive it, assert).
- `packages/ai-evaluate/test/sandbox-execution.test.ts` — pattern for Miniflare-backed Workers tests; the DO adapter integration tests reuse this approach.
- `packages/ai-database/` test suite (whatever exists) — pattern for pg-backed adapter tests; the pg adapter integration tests reuse this approach.
- `packages/ai-functions/test/define.test.ts` and similar — pattern for LLM-dependent integration tests with retry logic.
- xstate's own test corpus — reference for what statechart-runtime tests look like; we don't test xstate itself, but we use its test shape as a template.

## Out of Scope

- **xstate visual editor / Stately.ai studio integration.** Out of scope. The wire formats are mermaid and xstate config; neither requires the Stately visual editor. (If teams want it, they can edit xstate config in Stately and copy the output — no integration work required.)
- **xstate as the runtime for the existing DAG `WorkflowBuilder`.** Out of scope. The DSL is fine for DAG shapes; rewriting it on xstate adds dependency surface without depth. The two runtimes coexist.
- **New event primitives.** Out of scope. State machines reuse `on` / `send` / `every` / `track` from the existing event bus.
- **Service spec → state-machine projection.** Out of scope here; this is downstream of the workers.do / Atlas service-spec work in flight. This PRD ships the runtime; the projection from a Service spec to a `MachineConfig` is a future PRD.
- **Migration of existing DAG workflows to state machines.** Out of scope; nothing forces existing flows to migrate. Authors pick the shape that fits.
- **Cross-machine orchestration (saga / parent-child machines).** Out of scope for v1. xstate supports invoke / spawn, but the durability story for parent-child actors on DO / pg needs its own design pass. Single-machine workflows ship first.
- **A built-in admin UI for inspecting running machines.** Out of scope. The renderer + event-log APIs are enough for callers (or workers.do) to build inspection UIs.

## Further Notes

This PRD implements **ADR-0011** (already written and committed in this session). The ADR carries the design rationale; this PRD carries the build plan.

The work has two natural compositions downstream:

- **workers.do / Service spec projection.** Once the runtime exists, a Service spec (per the prior grilling-session conclusion: type-level spec in Atlas, runtime in workers.do) compiles to three projections: mermaid for buyer-facing pages, xstate `MachineConfig` for the runtime, buyer-facing prose for marketing. This PRD makes that compilation viable.
- **PR-as-a-Service workflow on devs.do.** The canonical example from the grilling session: grill → PRD → issues → parallel waves → multi-persona review fan → loop until all approve → ship. With this runtime in place, devs.do can express this shape natively without homegrown state management.

The `Q2 2026 stateMachine()` roadmap entry in `ai-workflows` is closed by this PRD plus ADR-0011 — replaced with a concrete dependency-backed plan.
