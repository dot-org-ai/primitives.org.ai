# PRD — Route Layer 5 through the digital-workers Verb interface

**Date:** 2026-05-27
**Status:** ready-for-agent
**Origin:** Candidate A of the 2026-05-27 architecture review
**Related:** `CONTEXT.md` (Worker / Agent / Person), ADR-0002 (function-registry / digital-objects-registry separation), this PRD does not require a new ADR

## Problem Statement

A developer who reaches for `ask`, `do`, `decide`, `approve`, `notify`, `generate`, or `is` today gets a different implementation depending on which package they import from:

- `import { ask } from 'autonomous-agents'` — calls `generateObject` from `ai-functions` directly. No Worker dispatch, no channel routing, no audit trail.
- `import { ask } from 'human-in-the-loop'` — delegates to a `Human` singleton; goes through lifecycle / escalation, but bypasses the Worker port.
- `import { ask } from 'services-as-software'` — a pass-through wrapper around an endpoint handler. No business logic at all.
- `import { ask } from 'digital-workers'` — the documented "route to Workers (AI Agents or Humans) via communication channels" implementation.

The Worker is the runtime port over Person / Agent / Role that `CONTEXT.md` names as the canonical seam. Three Layer 5 packages bypass it. Callers cannot tell which `ask` they will get without reading the package's docstring, and the three implementations are not interchangeable — they have different audit, routing, and channel semantics. The action verbs (`ask`, `do`, `decide`, `approve`, `notify`, `generate`, `is`) are the SVO surface of the entire system; having them mean three different things at three different import paths is a load-bearing source of confusion that grows worse with every new caller.

## Solution

There is one Action dispatch surface: `digital-workers`. The seven Verb actions (`ask` / `do` / `decide` / `approve` / `notify` / `generate` / `is`) are exported from `digital-workers` and nowhere else. Behind that interface, the Worker port resolves the target — Agent, Person, or Role — and dispatches accordingly.

Layer 5 packages return to their `CONTEXT.md` roles:

- **`autonomous-agents`** is the **Agent filler** of the Worker port. It exposes Agent definitions, role/team composition, autonomy tiers, and the Agent-as-Worker adapter that `digital-workers` dispatches to when the target resolves to an Agent. It does not export action verbs.
- **`human-in-the-loop`** is the **Person filler** of the Worker port. It exposes the Human lifecycle (claim / progress / resolve / escalate), the multi-tier escalation engine, channel adapters (Chat SDK + the planned email/slack adapters per Candidate G), and the Person-as-Worker adapter. It does not export action verbs.
- **`services-as-software`** is the Service definition surface (contract + cascade + evaluators + oversight per the v3 work). Endpoint handlers that need to invoke a Worker action call `digital-workers.ask(target, …)` etc. directly. The pass-through wrappers are deleted.

Callers — including LLM-authored cascade code — import the seven Verbs from one place. The Worker target (a `WorkerRef`, an `Agent`, a `Person`, a `Role`, or a `Team`) determines how the Action resolves. Behaviour parity with the prior local implementations is preserved by ensuring the Agent-as-Worker adapter routes through `ai-functions.generateObject` (matching the prior `autonomous-agents.ask` semantics) when the Verb is a fast LLM call rather than a channel-mediated request.

## User Stories

1. As a developer building a Service cascade, I want `ask` / `do` / `decide` / `approve` / `notify` / `generate` / `is` to mean exactly one thing regardless of which package I import from, so that I do not have to read three docstrings to find out which Worker dispatch I am getting.
2. As a developer who currently imports actions from `autonomous-agents`, I want my callsites to continue working with one-line import changes, so that the migration cost is bounded.
3. As a developer who currently imports actions from `human-in-the-loop`, I want my callsites to continue working with one-line import changes, so that the migration cost is bounded.
4. As a developer who currently imports actions from `services-as-software`, I want my callsites to continue working with one-line import changes, so that the migration cost is bounded.
5. As a developer authoring a `digital-workers.ask(agent, question)` call, I want the Agent target to dispatch via `ai-functions.generateObject` so that the fast in-process LLM path is preserved.
6. As a developer authoring a `digital-workers.ask(person, question)` call, I want the Person target to dispatch via the Human lifecycle so that claim / progress / resolve / escalate semantics apply.
7. As a developer authoring a `digital-workers.ask(role, question)` call, I want the Role to resolve to its current Person or Agent filler at dispatch time so that org-structure changes do not break callsites.
8. As a developer building an Agent, I want to register the Agent as a Worker via a single documented adapter so that `digital-workers` can dispatch to it without per-Agent wiring.
9. As a developer building a human review workflow, I want the Person Worker adapter to surface the Human lifecycle so that I get escalation, SLA tracking, and channel delivery for free.
10. As an LLM authoring cascade code, I want the action verbs to live at a single import path so that generated code is consistent and does not drift between packages.
11. As a maintainer auditing an Action record (per the SVO ontology), I want every action — regardless of which Layer 5 surface initiated it — to flow through one dispatch point so that audit trails are uniform.
12. As a maintainer writing tests, I want to mock one Worker port rather than three parallel action surfaces so that tests stay manageable as new Verbs are added.
13. As a maintainer onboarding to the codebase, I want to find the canonical implementation of `ask` in exactly one file so that I can understand the action surface without grepping three packages.
14. As a developer using `services-as-software` Service endpoints, I want endpoint handlers to compose `digital-workers` actions when they need Worker dispatch so that the Service definition stays a contract layer, not a re-implementation of the action surface.
15. As a developer dispatching to a `Team`, I want the team's load-balancing / round-robin / capability routing (already in `digital-workers/src/load-balancing.ts`) to apply transparently so that Team targets work the same as individual Workers.
16. As a developer wiring an `EvaluatorPanel` review fan (per the v3 work in `services-as-software`), I want each persona to be called via `digital-workers.ask` so that personas can be Agents today and Humans tomorrow without changing the panel code.
17. As an operator monitoring system behaviour, I want all action telemetry to emit from one module so that observability does not have to triangulate three surfaces.
18. As a developer reading `CONTEXT.md`, I want the code to honour the glossary — Worker is the runtime port, Action is what a Worker invocation produces — so that the vocabulary I read in the docs is the vocabulary I see in the code.
19. As a developer adding a new Verb to the action surface (e.g. `review`, `synthesize`), I want to add it in one place so that the cost of growing the surface is bounded.
20. As a developer migrating an old `autonomous-agents.ask(question)` callsite to `digital-workers.ask(agent, question)`, I want a deprecation warning at the old callsite during a release cycle so that I have time to migrate without breakage.
21. As a developer using `human-in-the-loop` for an approval workflow, I want the `Human` class to keep its existing public surface (`define`, `claim`, `escalate`, etc.) so that lifecycle / escalation work is unaffected.
22. As a developer using `autonomous-agents` to construct an Agent, I want the `Agent`, `Role`, `Team`, `Goals` exports to remain stable so that agent-construction code is unaffected.
23. As a developer composing a `services-as-software` Service, I want the v3 `OutputContract`, `ServiceSpec`, `EvaluatorPanel`, persona library, and Service factory to remain stable so that Service authoring is unaffected.

## Implementation Decisions

**Modules — what changes.**

| Module | Change | Result |
|---|---|---|
| `digital-workers` action surface (`ask` / `do` / `decide` / `approve` / `notify` / `generate` / `is`) | Already the canonical implementation. Audit each Verb to confirm the target-resolution → channel-resolution → dispatch pipeline matches the documented behaviour, and that the Agent target path uses `ai-functions.generateObject` so prior `autonomous-agents.X` callers get identical output. | The Worker port becomes the single seam for Action dispatch. |
| `digital-workers` Worker adapter contract | Formalise the Worker adapter port — what an `Agent`-as-Worker, a `Person`-as-Worker, or a `Service`-as-Worker must provide for `digital-workers` to dispatch to it. | Layer 5 packages register adapters against a documented seam. |
| `autonomous-agents` Agent-as-Worker adapter | Either expose an existing adapter (if `Agent.do()` already satisfies the port) or write a thin one that surfaces the existing Agent capability set as a Worker. Routes Verb actions to `ai-functions.generateObject` with the Agent's role/goals as system context. | autonomous-agents fills the Agent slot of the Worker port. |
| `autonomous-agents/src/actions.ts` | Delete the seven Verb exports. Keep the file only if it has remaining non-Verb exports; otherwise delete the file. | autonomous-agents stops shadowing the Worker action surface. |
| `human-in-the-loop` Person-as-Worker adapter | Confirm or add an adapter that surfaces the Human lifecycle (claim / progress / escalate / resolve) as a Worker dispatch. Channel routing reuses the existing channel-adapter port. | human-in-the-loop fills the Person slot of the Worker port; lifecycle/escalation depth is preserved behind the Worker seam. |
| `human-in-the-loop/src/helpers.ts` | Delete the Verb-action helper exports (`ask`, `do`, `decide`, `approve`, `generate`, `notify`). Keep `defineRole`, `defineTeam`, and any non-Verb helpers. | human-in-the-loop stops shadowing the Worker action surface. |
| `services-as-software/src/helpers.ts` | Delete the pass-through Verb wrappers (`ask`, `do_`, `generate`, `is`, `notify`). Service endpoint handlers that need to invoke a Worker action import directly from `digital-workers`. | services-as-software stays a contract / cascade / evaluator surface; no parallel action implementation. |
| `services-as-software/v3/evaluator-panel.ts` | Update each persona resolution path to call `digital-workers.ask(persona, …)` instead of `ai-functions.generateObject` directly. Personas become Workers; the panel composes against the Worker port. | EvaluatorPanel becomes the first real consumer of the unified Worker action surface — typed personas that can be Agents today and Humans tomorrow with no panel code change. |
| Layer 5 internal callsites | Anywhere within `autonomous-agents`, `human-in-the-loop`, `services-as-software` that called the now-deleted local action helpers, swap to `digital-workers.X` with an appropriate Worker target. | Internal consumers route through the unified surface. |
| Cross-package imports in the repo | Find all callers of the deleted exports across `packages/*`, swap their imports. | Repo-wide consumers route through the unified surface. |

**Worker target resolution.** The Worker target argument is one of:

- A concrete `WorkerRef` (the typed Worker reference shape already in `digital-workers/src/types.ts`)
- An `Agent` instance — autonomous-agents constructs these
- A `Person` reference — `Person` from `org.ai` / `id.org.ai`
- A `Role` — resolves to its current filler at dispatch time, per `CONTEXT.md`
- A `Team` — applies `digital-workers`'s existing load-balancing / capability routing

`digital-workers` already accepts an `ActionTarget` shape. The audit confirms this set is complete; if any case is missing, it is added.

**Behaviour parity with prior local implementations.** The Agent-as-Worker adapter explicitly routes through `ai-functions.generateObject` for the Verb actions that today call it directly in `autonomous-agents/src/actions.ts`. The prompt + schema construction is identical; the difference is that the call goes through `digital-workers.ask(agent, …)` → Agent-as-Worker adapter → `generateObject`. A snapshot test of the prompt construction confirms parity.

**Migration path.** Two-phase, single PR per package:

- **Phase 1** — add deprecation warnings to the Verb exports in `autonomous-agents/src/actions.ts`, `human-in-the-loop/src/helpers.ts`, `services-as-software/src/helpers.ts`. Re-export each Verb from the same file but log a one-time deprecation notice (with the new import path) on first call. Internal callsites in the same packages migrate immediately. Internal callsites in other monorepo packages migrate in the same PR.
- **Phase 2** — delete the deprecated re-exports. Bump the affected packages' minor versions. (One release cycle separates Phase 1 and Phase 2.)

**No new ADR.** This work realigns implementation with `CONTEXT.md`'s Worker port and ADR-0002's registry separation rationale. The decision was already made; the code drifted. No new ADR is required.

## Testing Decisions

**What makes a good test here:** an integration test that exercises `digital-workers.ask(target, …)` for each kind of target — `Agent`, `Person`, `Role`, `Team`, `WorkerRef` — and asserts the dispatch routed correctly (Agent target invokes `generateObject` with the expected prompt; Person target invokes the Human lifecycle in the expected state; Role target resolves to the current filler). The test crosses the Worker port — the single seam — and exercises real behaviour, not adapter wiring. Implementation-detail tests (mocking the Worker adapter and asserting it was called) are skipped.

**Modules to test:**

| Module | Test approach |
|---|---|
| `digital-workers` action surface (seven Verbs) | Integration tests per Verb × target kind. Already partially covered in `packages/digital-workers/test/ask.test.ts`, `approve.test.ts`, `do.test.ts`. Extend coverage to ensure Agent target routes through `generateObject` and Person target routes through Human lifecycle. |
| Agent-as-Worker adapter | Contract test that the adapter satisfies the Worker port and that each Verb routes to the expected `ai-functions` call with parity-preserving prompt construction. |
| Person-as-Worker adapter | Contract test that the adapter satisfies the Worker port and that each Verb invokes the expected Human lifecycle transition. |
| Behaviour parity | Snapshot test that comparing `autonomous-agents.ask(question)` (current behaviour) vs `digital-workers.ask(agent, question)` (new dispatch) produces equivalent prompt + schema for `generateObject`. Run once during migration; delete after Phase 2. |
| EvaluatorPanel persona dispatch | Update the existing `services-as-software/test/evaluator-panel.test.ts` to assert each persona is invoked via `digital-workers.ask`. |
| Migration deprecation warnings | A unit test per migrated package that confirms calling the deprecated export logs the deprecation notice once per process. |

**Prior art for the tests:**

- `packages/digital-workers/test/ask.test.ts`, `approve.test.ts`, `do.test.ts`, `notify.test.ts` — existing tests of the Worker action surface; the new tests extend rather than replace these.
- `packages/digital-workers/test/load-balancing-safety.test.ts` — pattern for Worker-port contract tests.
- `packages/services-as-software/test/v3/evaluator-panel.test.ts` (if it exists) — pattern for panel composition tests.
- `packages/autonomous-agents/test/actions.test.ts` — these tests migrate to assert the Agent-as-Worker adapter satisfies the same input/output behaviour.

## Out of Scope

- **Candidate G (Channel Adapter stubs).** The placeholder email and Slack adapters in `human-in-the-loop` are addressed in a separate review item. This PRD does not implement real Email or Slack adapters.
- **Candidate H (xstate state machines).** Workflow representation work is independent and runs in parallel. This PRD does not touch `ai-workflows`.
- **Candidate B (org.ai ⇆ business-as-code translation tax).** Goal / KPI / OKR shape consolidation is a separate item.
- **Candidate D (ai-functions primitives delegation stack).** Collapsing `primitives.ts` / `ai.ts` / `ai-schemas.ts` is a separate item.
- **`ai-functions.ask` etc.** The `ai-functions` package's primitives (LLM-only, no Worker dispatch) remain. They are a lower layer than the Worker action surface and serve a different purpose (the Agent-as-Worker adapter calls them). Their existence is by design and `digital-workers/src/ask.ts` already documents the distinction.
- **New Verbs.** Adding new Verbs to the action surface (e.g. `review`, `synthesize`) is out of scope; the work is to align existing Verbs.
- **External consumers of the deleted exports.** If any external package outside the monorepo imports `ask` from `autonomous-agents`, that's a downstream migration. We document the migration path in the changelog; we do not chase external callsites.

## Further Notes

This is a realignment, not a redesign. The unified interface already exists at `digital-workers/src/index.ts` lines 108-116. The deletion test is direct: remove the Verb exports from the three Layer 5 packages → complexity does not reappear, because the canonical implementation already covers the cases. The Layer 5 packages return to the roles `CONTEXT.md` already names — Agent filler, Person filler, Service contract surface.

Once landed, two follow-on candidates from the architecture review become natural compositions on top:

- **Candidate C (Deepen the Worker routing primitives)** consolidates the four files (`ask.ts`, `approve.ts`, `notify.ts`, `do.ts`) inside `digital-workers` into one routing module with Verbs as table rows. Easier after this PRD because the seam consumers have all been driven through.
- **Candidate D (Collapse the primitives delegation stack in ai-functions)** is independent but compounds: once the Agent-as-Worker adapter is the only caller path into `ai-functions` Verb primitives, the `primitives.ts` / `ai.ts` / `ai-schemas.ts` shells have one consumer rather than many, making the collapse cheaper.

The EvaluatorPanel update in Phase 1 is the user-visible payoff: a typed multi-persona review fan where personas can mix Agent and Person without panel code changes. That is the PR-as-a-Service review primitive devs.do is built around.
