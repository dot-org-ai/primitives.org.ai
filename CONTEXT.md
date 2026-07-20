# Context

The primitives.org.ai monorepo provides composable AI primitives that share one ontology: a Subject-Verb-Object record of who did what to what. This file names the load-bearing concepts so packages don't drift into parallel vocabularies.

## Vision

The big-picture thesis lives in [`THESIS.md`](./THESIS.md). One-paragraph version: this repo ships the OSS primitives for the **agentic economy** — software economics applied to the ~$100T services market. The headline products are **`services-as-software`** (the cars: cascade-delivered outcome-priced Services) and **`business-as-code`** (the deterministic rails: typed Goals/OKRs/Reward/Oversight/Process/Audit). Beneath them, **`autonomous-finance`** is the financial nervous system; **`digital-objects`** is the SVO substrate; **`autonomous-{cs,revenue,dx,startups}`** are catalog packages of canonical Services. Three-tier ecosystem: OSS primitives (this repo) → managed runtimes (`platform.do`, `api.services`) → catalogs (`agents.do`, `startup-builder`'s 1M-Service combinator). See `THESIS.md` for the full design rationale; `docs/plans/2026-05-05-*-design*.md` for current architectural decisions.

## Language

### Storage ontology (`digital-objects`)

**Noun**: A type of entity (e.g., "Customer", "Order") with linguistic forms — singular, plural, slug — and an optional schema.
_Avoid_: Entity type, model, class.

**Verb**: A type of action (e.g., "send", "approve") with conjugations (action/act/activity/event) and a Frame describing its complement roles.
_Avoid_: Action type (Action is the instance), method.

**Frame**: The set of complement roles a Verb can take. Closed taxonomy of nine roles: `subject`, `object`, `recipient`, `source`, `destination`, `instrument`, `topic`, `cause`, `manner`. Plus the literal `when` (timestamp) and `where` (location), carried on Action directly rather than as Frame slots.
_Avoid_: Schema, case grammar.

**Thing**: An instance of a Noun (e.g., a specific Customer record). Plays Subject or Object in an Action.
_Avoid_: Entity, instance, record.

**Action**: A `subject --verb--> object` triple with status, timestamp, and lifecycle. Unified record — graph edge, event, audit entry — all in one shape.
_Avoid_: Event (Actions surface as events but the durable record is the Action), transaction.

### Frame roles (closed taxonomy)

**Subject**: Who or what acts. Filled by a Worker, Person, Agent, or System. Required.

**Object**: What is acted on directly. Filled by a Thing. Required for transitive verbs.

**Recipient**: To whom the action is directed (indirect object). Filled by a Thing — often a Worker.

**Source**: Where the action originated from.

**Destination**: Where the action is targeted to.

**Instrument**: The means used. Filled by a Tool reference or a Thing.

**Topic**: What the action concerns (the "about" relation).

**Cause**: Why the action happened. Links to a parent Action.

**Manner**: Qualitatively how the action was performed (enum/string, not a Thing).

### Identity (`id.org.ai`)

> The `id.org.ai` package lives in its own repository at
> [`dot-org-ai/id.org.ai`](https://github.com/dot-org-ai/id.org.ai) and is now
> consumed as a regular npm dependency at `id.org.ai@^0.3.0`. Companion package
> `schema.org.ai@^0.1.0` provides shared schema types.

**Person**: A specific human. A Thing of Noun "Person".
_Avoid_: User, account.

**Agent**: A specific autonomous AI agent. A Thing of Noun "Agent".
_Avoid_: Bot, AI, assistant.

**Identity**: A Person or Agent's authenticated context — DID, OAuth scopes, payment instruments. Carried by a Worker into every invocation.
_Avoid_: Auth, credentials, session.

**Auth Broker**: The port that decides whether an Identity has the required scopes for an invocation.

**Payment Broker**: The port that negotiates a payment rail (x402, MPP) by intersecting an Identity's funding instruments with a Tool's `accepts` list.

### Runtime

**Worker**: The runtime port over Person, Agent, or Role for work-doing. Carries an Identity reference and dispatches Tools.
_Avoid_: User, service, actor (used loosely elsewhere).

**Role**: A slot in an org structure (e.g., "CEO", "PDM") filled by a Person or Agent. Resolves to its current filler at invocation time.
_Avoid_: Position, title.

**Tool**: A callable Verb — registers a Verb in the ontology and attaches a handler with auth and optional pricing requirements.
_Avoid_: Function, capability.

**Task**: An issue-shaped work item — title, body, comments, labels, dependencies, assignees. A specialization of Action with project-management metadata. Generates many child Actions over its lifecycle, including one terminal Action that records the actual work.
_Avoid_: Job, ticket, work item.

**Channel Adapter**: A concrete way a Worker is reached — Vercel Chat SDK (default for humans), web, mobile (Expo), email, Slack, agent runtime. Satisfies the Worker `dispatch` port.
_Avoid_: Transport, integration.

**Workflow**: A durable orchestration of Actions over time. Two computational shapes are first-class: **DAG workflows** (sequential / parallel / conditional / loop) authored via the `ai-workflows` `WorkflowBuilder` DSL; and **State Machine workflows** (hierarchical states with event-driven transitions) authored as mermaid `stateDiagram-v2` or xstate `MachineConfig`. Both run on the same `DurableExecutionAdapter` port and share the same event bus (`on` / `send` / `every` / `track`).
_Avoid_: Pipeline, job graph, flow (used generically elsewhere).

**State Machine**: A hierarchical statechart with states, transitions, guards, entry/exit actions, parallel regions, and history. Runtime is xstate (`createMachine` / `createActor`); wire formats are mermaid `stateDiagram-v2` (LLM/human surface) and xstate `MachineConfig` (typed developer surface). Both wire formats round-trip through a bidirectional parser/renderer. Persists via the `StateMachineStorage` port (Durable Object default; Postgres alternative via `ai-database`). Transitions subscribe to the workflow event bus; state entries can emit onto it.
_Avoid_: Workflow (use **Workflow** for the surrounding concept), FSM (we mean the hierarchical variant), graph.

### The App (software register)

> Ruled in the 2026-07-19 software-spec grill (SG-1…SG-10; spec: startups.studio stack vault `specs/studio/SOFTWARE.md`). The abstract App is a **composition of the primitives above** — Nouns + Tools + workflows + roster + plans — never a parallel vocabulary. These entries name what the composition adds.

**Mount**: The running whole-app the interpreter creates from a definition — the apply/materialise target, and what a cockpit watches. Editing the definition updates the mount; every workspace sees the new shape.
_Avoid_: instance, deployment.

**Workspace**: The per-tenant cell of a mount (one Durable Object + SQLite per tenant) that a rendering attaches to. Connections attach and detach (the tmux model); the workspace survives any one rendering disconnecting.
_Avoid_: session — reserved to MCP's transport handshake and the web-login sense; tenant (the operator; the workspace is their cell).

**Noun source**: Where a declared Noun's Things live: `house` (the app's own Things — a CRM's Deals) or `substrate` (the interpreter's own records read through a lens — a cockpit's Workspaces). An app never creates substrate-sourced Things.

Verb **axes** (kind · audience · autonomy) are defined at the **Verb axes** entry in the Language section above — that entry ships with `FunctionKind` in `@org.ai/types` (SG-3; primitives PR #45) and is not duplicated here.

**Customization doors**: The four (and only four) ways an app customizes the shared core: its definition; a function override (a different Tool bound to the same Verb at app scope); a component override at a named slot; theme tokens. No ejection, no per-app fork.

## Relationships

- A **Verb** declares a **Frame** of roles it accepts.
- A **Tool** registers a **Verb** with a handler, auth requirements, and optional pricing.
- A **Worker** carries an **Identity** (reference into `id.org.ai`).
- A **Worker** invoking a **Tool** produces an **Action** — Worker as **Subject**, other roles filled by **Things**.
- A **Task** is an **Action** in the work-coordination sense, plus issue-shaped metadata; Tasks generate many child **Actions** (assignment, comments, transitions) and one terminal **Action**.
- A **Role** is filled by a **Person** or **Agent**; a Worker referencing a Role resolves to its current filler at invocation time.
- A **Channel Adapter** satisfies the Worker port for one surface (Chat SDK / web / mobile / email / Slack / agent runtime).
- The **Auth Broker** and **Payment Broker** read the Worker's **Identity** and the Tool's auth/pricing to gate invocation.

## Example dialogue

> **Dev:** "If priya@ approves a refund, what's the **Action** record?"
> **Domain expert:** "An Action with **Subject**=priya (a **Person**), **Verb**=approve, **Object**=refund (a **Thing**). If she approved as **Role** `ceo()` rather than as priya-the-person, Subject is the Role ref and the audit shows both the role and the current filler."

> **Dev:** "Does every **Worker** invocation create a **Task**?"
> **Domain expert:** "No. `worker.do(verb, args)` produces an Action directly — for fast, single-shot work. Tasks are for issue-shaped work where coordination matters: assignees, comments, dependencies, milestones. A Task generates many Actions over its lifecycle."

> **Dev:** "A **Tool** that costs USDC — where does the payment metadata live?"
> **Domain expert:** "On the Tool's `pricing` field, MDXLD-shaped (`$type: 'PaymentRequired'`) with `accepts: ['x402', 'mpp']`. The **Payment Broker** intersects that with the invoking Worker's **Identity** — which carries wallet and SPT handles from id.org.ai — and picks the rail."

> **Dev:** "Three **Tools** with the same **Verb** name — collision?"
> **Domain expert:** "No. The Verb is registered once in the ontology with its conjugations and Frame; multiple Tools may attach handlers to the same Verb for different Subject/Object kinds. The Verb is the semantic identity; the Tool is one implementation."

## Flagged ambiguities

- **"action"** was used in two senses: generic English for "operation," and the **Action** record. Resolved: capitalize when referring to the SVO triple.
- **"task"** was used to mean both a queued background job and a project-management work item. Resolved: **Task** means the issue-shaped work item. Queue mechanics are an implementation detail of dispatch.
- **"object"** was used for both the SVO **Object** (frame role) and JavaScript-style objects. Resolved: capitalize when referring to the frame role.
- **"function"** was used for both Tools and `digital-tasks`'s legacy `function` field. Resolved: **Tool** is the canonical name for callable Verbs; the `function` field on Tasks renames to `tool` over time.
- **"identity"** lowercased was used for "who you are" generically; **Identity** capitalized means specifically the `id.org.ai` record (DID + scopes + payment instruments).
