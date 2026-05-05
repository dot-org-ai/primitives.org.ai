# Context

The primitives.org.ai monorepo provides composable AI primitives that share one ontology: a Subject-Verb-Object record of who did what to what. This file names the load-bearing concepts so packages don't drift into parallel vocabularies.

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

> The `id.org.ai` package now lives in its own repository at
> [`dot-org-ai/id.org.ai`](https://github.com/dot-org-ai/id.org.ai) and is
> integrated here as a git submodule under `external/id.org.ai`. This is an
> interim arrangement; once the upstream stabilises and publishes to npm, it
> will be consumed as a regular versioned dependency. See
> [ARCHITECTURE.md](./ARCHITECTURE.md#external-submodules) for setup.

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
