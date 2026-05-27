# State machine workflows via xstate; mermaid stateDiagram-v2 is the LLM-authorable wire format

**Status:** accepted
**Date:** 2026-05-27

## Context

`ai-workflows` ships a `WorkflowBuilder` DSL — `workflow().step().parallel().when().loop().forEach()` — that expresses DAG-shaped orchestrations with conditional branching and bounded loops. The DSL is sufficient for sequential / fan-out / retry-until-converged shapes, and the v3 `EvaluatorPanel` in `services-as-software` already composes against it (typed reviewer personas with `signOffPolicy` + `iterationPolicy.maxRounds`).

A second class of orchestrations does not fit DAG semantics:

1. **Event-driven, long-lived workflows.** PR-as-a-Service (devs.do): grill → PRD → issues → parallel implementation waves → multi-persona review fan → loop on rejection until all personas approve → ship. The review loop is *not* a bounded `.loop()` — it's a state machine with guarded transitions, where state advances on events that arrive from worker actions, webhooks, timers, and human decisions.
2. **Concurrent state.** A workflow may be "awaiting review" AND "responding to a pause request" AND "scheduled for re-grill at 24h timeout" — orthogonal regions running concurrently. DAG executors don't represent multi-active state.
3. **Hierarchical state.** Composite states (a "review" super-state containing per-persona sub-states), with **history** semantics so a workflow resuming after a pause returns to the exact sub-state it was in. The current DAG runtime has no equivalent.
4. **External authoring + visualization.** LLMs author workflow shapes more reliably as mermaid `stateDiagram-v2` than as `workflow().step().loop()` TypeScript. A diagrammable form is also the right surface for human review, PR documentation, and dashboards.

These needs are statechart needs — the formalism Harel defined in 1987 and that UML statecharts and xstate implement. Reinventing a hierarchical statechart runtime is a multi-month project; xstate has shipped exactly that runtime, in TypeScript, with a stable v5 actor model and built-in serialize/restore for durability (`getPersistedSnapshot` / `createActor(..., { snapshot })`). MIT-licensed.

A previous grilling session evaluated xstate vs a homegrown `stateMachine()` builder on the `ai-workflows` Q2 2026 roadmap. The homegrown path was a placeholder — there is no design rationale beyond "we'd build something." This ADR replaces that placeholder.

## Decision

`ai-workflows` adopts xstate as the runtime for hierarchical state machine workflows. Two wire formats are first-class inputs to the same runtime:

- **mermaid `stateDiagram-v2`** — the LLM-authorable / human-readable wire format
- **xstate `MachineConfig`** — the typed developer-authorable wire format

A bidirectional translator pairs them: mermaid source parses to `MachineConfig`, and `MachineConfig` renders back to mermaid for visualization and documentation. The translator is a tree-walk over a structured spec — both formats express the same Harel statechart formalism, so the mapping is near-1:1 (composite → nested, parallel → parallel regions, history → history states, guards → guarded transitions, entry actions → entry actions).

The runtime composes as:

```
mermaid stateDiagram-v2 (string)   ──┐
xstate MachineConfig (TS object)   ──┴──►  xstate.createMachine
                                                    │
                                                    ▼
                                            xstate.createActor
                                                    │
                                                    ▼
                                          StateMachineStorage (port)
                                           ├── DurableObjectAdapter (default)
                                           └── PostgresAdapter (via ai-database)
```

`StateMachineStorage` is a real seam — two adapters justify it from day one, and it inherits the ADR-0003 transactional/analytical split for free:

- **DurableObjectAdapter** — snapshot in DO storage; `alarm()` drives scheduled (`after X`) transitions; `fetch()` receives external events, calls `actor.send`, persists the new snapshot. Default for tenant-scoped, latency-sensitive workflows.
- **PostgresAdapter** — snapshot in a `state_machine_instances` row; event log in an append-only table; scheduler against a timers table. Default when the workflow's history needs to be queryable / replayable / analytically joinable.

The state machine runtime runs as a **peer** to the existing `WorkflowRuntime`, not as a step type inside it. Hierarchical statecharts and DAGs are genuinely different computational models; forcing statecharts through `CascadeExecutor` makes that module shallower (it ends up dispatching to a state-machine sub-runtime anyway). Both runtimes share the same event bus (`on` / `send` / `every` / `track`) and both consume `StateMachineStorage` / `DurableExecutionAdapter` at their durability seam.

Integration with the existing event bus is **bidirectional**:

- **Inbound** — `on(pattern)` patterns delivered onto the bus by Worker action returns, webhooks, timers, and `send()` calls translate to `actor.send(event)`. The event surface for transitions is the bus surface that already exists — no new primitives.
- **Outbound** — xstate state-entry actions and the `inspect` hook emit Actions onto the bus, which other workflows / Workers consume normally.

`ai-functions` gains a `mermaid()` primitive — an LLM-backed function that returns a mermaid string validated to parse into a runnable `MachineConfig`. The parser is the validator; generation that fails to parse is retried.

## Consequences

**Positive:**

- Full Harel statechart semantics — composite states, parallel regions, history, guards, internal transitions — without building any of them ourselves. xstate is the deep module; we ship a thin shell.
- Two wire formats, one runtime. LLMs author mermaid; developers author xstate. Both round-trip.
- Mermaid renders fall out for free on either authoring path — PRs, docs, dashboards, and the buyer-facing Service page can show the same diagram.
- The `StateMachineStorage` seam is real from day one (two adapters) and reuses the ADR-0003 storage split. No speculative seams.
- Event integration costs zero new primitives — transitions ride the existing `on` / `send` / `every` / `track` surface.
- The `Q2 2026 stateMachine()` placeholder on the `ai-workflows` roadmap is replaced with a concrete, dependency-backed plan.
- Unblocks the PR-as-a-Service shape devs.do is built around: review loops with multi-persona sign-off, pause/resume on external events, timer-based escalation, all expressed declaratively in a diagrammable form.

**Negative / accepted:**

- xstate becomes a non-optional dependency of `ai-workflows`. xstate v5 is stable and MIT, but a runtime-defining external dep deserves the explicit call-out.
- Two runtimes (`WorkflowRuntime` for DAGs, the new state-machine runtime) means two surfaces to keep in repair. Mitigation: both consume shared `StateMachineStorage`, `DurableExecutionAdapter`, and event-bus ports — the divergence stays at the runtime layer, not the seams.
- Full `stateDiagram-v2` parser coverage is non-trivial. The mapping is structural (statechart ↔ statechart), but composite states, parallel regions, and history need real parser care. Acceptable cost — xstate carries the runtime semantics behind those features.
- Mermaid is not a formally specified language. Edge cases in the parser will surface over time. Mitigation: validate by round-tripping (parse → render → compare); reject ambiguous syntax loudly.

## Alternatives considered

**Build a homegrown state-machine builder (the prior roadmap entry).** Rejected. Months of work to reimplement what xstate has shipped. No design rationale for divergence from xstate semantics.

**Extend `WorkflowBuilder` with a new `state-machine` step type.** Rejected. Composite states and orthogonal regions don't fit DAG semantics. The DAG executor would either grow to subsume a state-machine runtime (making it shallower) or dispatch to one (making the new step type a misleading abstraction).

**Use xstate only — drop mermaid as a wire format.** Rejected. LLMs author mermaid more reliably than xstate config; mermaid is the canonical diagram form for human review. Two real consumers (LLM authoring, human reading) justify the second wire format. The seam earns its keep from day one.

**Mermaid only — translate to a custom runtime, no xstate.** Rejected. Same problem as the homegrown builder, plus loses the typed-developer authoring surface.

**xstate config + xstate's built-in visualization (`@xstate/graph`) instead of mermaid.** Rejected. xstate's visualizer is interactive HTML; we need a string-emitted diagram that lives in markdown, PR comments, and docs. Mermaid is the diagram lingua franca.

## Migration

This ADR introduces new capability — no existing workflows migrate. The existing `WorkflowBuilder` DSL is unaffected and remains the right tool for DAG-shaped flows (sequential pipelines, fan-out/fan-in, bounded retry loops). Authors choose the runtime that fits the shape of the orchestration:

- **DAG-shaped (sequential, bounded loops, fan-out/fan-in)** → `WorkflowBuilder`
- **Event-driven, long-lived, hierarchical, or multi-active state** → state machine via mermaid or xstate

The `Q2 2026 stateMachine()` roadmap entry is closed by this ADR.
