# Lens B — Distributed Systems / Event-Sourcing / Database Engineering

**Date:** 2026-06-01
**Lens:** B (Action stream + Thing store at operational scale)
**Mode:** HOW (generative). Architecture works, infra scales, 1M startups exist.

---

## Lens thesis

Treat `Action` not as an "audit row" but as **the single source of truth** — an append-only, immutable event log where every Action is simultaneously (a) a domain event, (b) a graph edge, and (c) an audit fact. Everything else — the `Thing` store, `related()`/`edges()` traversal, dashboards, workflow state, the dedup graph — is a **materialized projection** of that log. The moment you accept that `Thing.data` is *derived* and `Action[]` is *primary*, the whole consumer ecosystem (ai-database, ai-workflows, digital-workers, services-as-software) collapses into one pattern: **append Actions, project read models, subscribe to the changefeed.** rpc-promise is then the batching layer that makes appending N causally-linked Actions cost one round-trip instead of N. The interface's job is to make the log *trustworthy* (idempotent appends, causal ordering, optimistic concurrency) and *tailable* (cursor pagination, changefeed, replay). At 1M startups, the entire multiverse is one log you can fork, replay, and time-travel.

---

## Use cases

### 1. Workflow events fired off `Action.status` transitions (event-carried state transfer)

`ai-workflows` registers `$.on.Deal.won(...)`. Under the hood it tails the Action log filtered by `verb: 'win'` and `subject-noun: 'Deal'`. When `db.Deal.win(acme)` appends `Action{verb:'win', status:'completed'}`, the workflow runtime receives the *full Action* (subject, object, roles, data) and reacts — no second fetch.

```ts
$.on.Deal.won(async (action) => {
  // action carries everything; no re-read of the Deal
  await db.Invoice.issue(action.subject, { amount: action.data.value })
})
```

- **Systems mechanism:** event-carried state transfer over an append-only log; the consumer never queries back into the write model because the event is self-describing.
- **DEMAND:** `Action` must be a *fat event* — `subject`, `object`, `roles`, and `data` must all be denormalized onto the Action at append time and never be lazy refs the subscriber has to resolve. `listActions` filter must support `verb` **+ subject-noun** (not just subject-id), so a workflow can subscribe to "all `win` on any `Deal`."

### 2. Sagas / process managers driven by `cause` linkage

A "close-the-books" saga is a chain of Actions where each step's `cause` points at the prior step's Action id. The process manager reconstructs the saga by walking the cause-chain backward; compensation walks it forward emitting inverse verbs.

```ts
const charge = await db.Account.charge(cust, { cents: 5000 })
const ship   = await db.Order.ship(order, { cause: charge.id })   // roles.cause = charge.id
// compensation: if ship fails, walk cause-chain, emit verb.inverse for each
```

- **Systems mechanism:** saga orchestration via causation graph; compensation = replaying the inverse-verb of each completed step.
- **DEMAND:** `roles.cause` must accept an `ActionRef` and the provider must index it so `edges(actionId, direction: 'in')` returns the children an Action caused. The `Verb.inverse` form must be reliably present so compensation is mechanical. Need a `correlationId` distinct from `cause` (cause = parent step; correlation = whole saga instance) — **the current interface has `cause` but no `correlation`/saga-id.**

### 3. `related()`/`edges()` powering a denormalized CRM read model

A CRM dashboard never queries the Action log directly at read time. A projector subscribes to the changefeed and maintains a denormalized `ContactView` Thing. But for ad-hoc "show me everything Ada touched," the dashboard uses `edges(adaId, direction: 'out')` to get all Actions where Ada is subject, and `related(adaId, 'manage', 'out')` to hop to the Things.

```ts
const touched = await provider.edges(adaId, undefined, 'out', { limit: 50, orderBy: 'createdAt', order: 'desc' })
const reports = await provider.related(adaId, 'manage', 'out')
```

- **Systems mechanism:** CQRS — the activity feed is a live graph traversal; the dashboard summary is a separately-maintained projection.
- **DEMAND:** `edges()` must support **cursor pagination** (not just offset — offset breaks on an append-only log because new Actions shift offsets) and `orderBy: 'createdAt'`. `related()` must let `verb` be **omitted** (any verb) and must traverse role-edges, not only subject/object — "everything Ada is the `recipient` of."

### 4. Projection rebuild by replaying the Action log

A bug corrupts the `LeaderboardView`. Operator drops the view and rebuilds it by replaying every Action with `verb: 'score'` from the beginning of time through a pure fold.

```ts
let cursor = null, view = {}
do {
  const page = await provider.listActions({ verb: 'score', orderBy: 'createdAt', limit: 1000, after: cursor })
  for (const a of page) view = applyScore(view, a)
  cursor = page.at(-1)?.id
} while (cursor)
```

- **Systems mechanism:** event-sourcing projection rebuild — read model is disposable, log is canonical.
- **DEMAND:** `listActions` must guarantee a **total order** that's stable across the rebuild (monotonic, gap-tolerant) and support a **forward cursor** (`after: actionId`). The log must be genuinely append-only — `deleteAction` exists in the port, which **threatens replay determinism**; deletes should be tombstone-Actions (a `delete` verb), not physical removal, so a rebuild from t0 reproduces the same state.

### 5. The audit trail as a first-class, queryable read model

Compliance asks: "every `approve` Action on any `Refund` over $1k in Q1, by whom, in what order." This is a direct query against the log — the audit trail isn't a separate system, it *is* the primary store.

```ts
await provider.listActions({ verb: 'approve', object: undefined,
  where: { 'data.amount': { gte: 100000 } }, since: q1Start, until: q1End })
```

- **Systems mechanism:** the log is the audit store; queries are time-bounded scans over an immutable ledger.
- **DEMAND:** `ActionOptions` must add `since`/`until` time bounds and predicate filtering on `data.*` (the existing `where` is typed `Record<string, unknown>` — formalize that it filters Action `data`). Append must stamp an immutable `createdAt` from a trusted clock, and Action immutability must be a contract (no `update` on Action).

### 6. rpc-promise fan-out: a digital-worker speaks N dependent sentences in one round-trip

A digital-worker onboarding a customer says: create Company → create Contact (belongs to Company) → perform `qualify` on Contact → perform `assign` (instrument = the new Contact). Four causally-dependent ops, one network hop, because each later op references an *unresolved* RpcPromise of the prior.

```ts
const co  = provider.create('Company', { name: 'Acme' })          // RpcPromise
const ct  = co.pipe(c => provider.create('Contact', { company: c.id, name: 'Ada' }))
const q   = ct.pipe(c => provider.perform('qualify', c.id))
const asg = ct.pipe(c => provider.perform('assign', repId, c.id))
await Promise.all([q, asg])   // single flush: topologically ordered batch
```

- **Systems mechanism:** promise pipelining (Cap'n Proto) — server-side substitution of as-yet-unresolved ids eliminates N+1 round-trips across graph hops.
- **DEMAND:** rpc-promise / `BatchCollector` must **topologically order dependent ops within one flush** and substitute a *promised id* into a later op's args before the batch executes. The current `BatchCollector` queues flat ops with concrete args and flushes on microtask — it has no notion of "arg #2 is the result of op #1." The batch wire format must carry **intra-batch references** (e.g. `{ ref: 0, path: 'id' }`).

### 7. Intra-stage `Promise.all`, sequential across hops (the schedule/fan-out seam)

A cascade generating a startup fans out 200 independent `create('Feature', ...)` calls in one stage (no inter-dependencies → one batched `createMany`), then *waits* before the next stage that performs `dependsOn` Actions wiring features together. The scheduler distinguishes "siblings → one batch" from "parent→child → ordered."

- **Systems mechanism:** structured concurrency over the log — fan-out within a stage collapses to `createMany`/`performMany`; the hop boundary is a barrier.
- **DEMAND:** `createMany`/`performMany` must define **partial-failure semantics** — return per-item results (`Array<{ok,value}|{ok,error}>`), not all-or-nothing, so one bad Feature doesn't sink 199 good ones. Batch must respect `MAX_BATCH_SIZE` by auto-chunking, transparently.

### 8. Idempotent append with client-supplied id (exactly-once under retry)

A digital-worker's network blips mid-`perform`. It retries with the **same client-generated Action id**. The provider treats the second append as a no-op returning the existing Action — so the cascade never double-charges, double-emails, or double-creates.

```ts
const id = `act_${deterministicHash(verb, subjectId, payloadHash)}`
await provider.perform('charge', acct, undefined, { cents: 5000 }, { id })  // retry-safe
```

- **Systems mechanism:** idempotency keys → exactly-once append over an at-least-once transport.
- **DEMAND:** `perform()` must accept a **client-supplied id** (today only `create()` does; `perform`'s signature has no id slot) and guarantee idempotent insert-or-return-existing on id collision. This is the single most load-bearing requirement for the whole cascade. (See "highest-leverage" below.)

### 9. Optimistic concurrency on `update` (lost-update prevention on the Thing projection)

Two stages of a cascade both touch the same `Landing` Thing's `expression` fields. The second writer must not silently clobber the first. Update takes an expected version; mismatch → conflict the caller can merge or retry.

```ts
const t = await provider.get(landingId)
await provider.update(landingId, { headline }, { ifVersion: t.version })  // throws ConflictError on stale
```

- **Systems mechanism:** optimistic concurrency control via compare-and-swap on a version/etag.
- **DEMAND:** `Thing` must carry a monotonic **`version`** (or the provider must expose an etag), and `update`/`ValidationOptions` must accept `ifVersion`. Pairs naturally with `TokenStratum`: `frozen` fields reject any update post-create (server-enforced), so concurrency control only matters for `expression`/`composition`.

### 10. Changefeed / CDC powering live dashboards and embedding backfill

`explore.startups.studio` shows a live "what's happening across all startups" wall. A single `subscribe()` to the Action changefeed (filtered, resumable from a cursor) drives it. Separately, every `Thing` create triggers an embedding-backfill consumer that reads the create-Action, embeds `Thing.data`, and writes the vector — decoupled from the write path.

```ts
for await (const action of provider.subscribe({ since: lastCursor })) {
  bus.publish(action)                       // live wall
  if (action.verb === 'create') queue.embed(action.object)  // backfill
}
```

- **Systems mechanism:** change-data-capture / log tailing → fan-out to multiple independent consumers, each tracking its own cursor (consumer-group semantics).
- **DEMAND:** the port needs a **`subscribe(options): AsyncIterable<Action>`** changefeed seam with a resumable cursor and at-least-once delivery — the committed interface has no streaming method. Backfill consumers need to durably checkpoint a cursor, so Action ids must be **cursor-sortable** (monotonic / sortable like ULID/KSUID).

### 11. Multi-tenant scoped providers (one log per startup, one port shape)

Each of 1M startups gets its own provider instance bound at the seam — `Ontology(schema, { provider })` — backed by its own Durable-Object SQLite shard. Same ontology code, isolated Action log per tenant. A "platform" provider can union-read across shards for cross-startup analytics without any tenant being able to read another's log.

```ts
const { db } = DB(crm, { provider: makeTenantProvider(startupId) })  // DO-SQLite shard
```

- **Systems mechanism:** physical multi-tenancy via per-tenant log shards behind one logical port; the ontology is tenant-agnostic.
- **DEMAND:** `DigitalObjectsProvider` must be cheaply instantiable per-tenant (it already is — pure port, no global state) and the same port must back **MemoryProvider (tests) / pg+ch (prod, ADR-0003) / DO-SQLite (edge)** with identical semantics. Append ordering and idempotency guarantees must hold across all three implementations, or projections diverge by backend.

### 12. The 1000× moment — fork-and-replay the multiverse

Because every startup *is* a totally-ordered Action log, you can **fork** any startup at any point in its history (copy the log up to Action `act_N`), then replay a *different* set of decisions forward — a counterfactual A/B of an entire company. "What if this startup had pivoted at week 3?" is `replay(log[0..week3]) then append alternative Actions`. At 1M startups, the studio runs evolutionary search over *forked timelines*, scoring each replay's projected revenue — survival of the fittest log.

```ts
const fork = await provider.fork(startupId, { uptoAction: pivotPointId })
await fork.performMany(alternativeStrategy)   // counterfactual timeline
const score = projectRevenue(await fork.listActions({ verb: 'win' }))
```

- **Systems mechanism:** event-log forking + deterministic replay → counterfactual simulation; time-travel debugging at company granularity.
- **DEMAND:** replay determinism requires (a) physical append-only (no destructive `deleteAction` — tombstone instead), (b) Action ids stable and content-addressable enough to dedup on re-append, (c) a `fork(uptoCursor)` capability on the port (or, minimally, `listActions` + bulk-`performMany` into a fresh provider so fork is *composable* from existing primitives). The cleanest path: keep the port minimal and make fork a function *over* `subscribe`+`performMany`.

---

## Highest-leverage use case + sharpest DEMAND

**#8 — idempotent `perform()` with a client-supplied id.** I hold this as *the* linchpin of the entire lens.

Everything else in this document — sagas (#2), projection rebuild (#4), changefeed fan-out (#10), and especially fork-and-replay (#12) — silently assumes the log is an **append-only ledger of exactly-once facts.** The instant `perform()` can produce a duplicate Action on retry, every projection double-counts, every saga fires compensation against phantom steps, and every replay produces a *different* state than the original — replay determinism dies, and with it the 1000× moment. The cascade generating 1M startups runs over an at-least-once substrate (Workers retry, queues redeliver, networks blip); without an idempotency key on the *write of an Action*, the cheap FIND-half of findOrCreate cannot trust that "this Action already happened" — it will regenerate work the cascade was designed to stop.

The sharp demand: **`perform()` must accept a client-supplied `id` and guarantee insert-or-return-existing on collision** — identical to `create()`'s existing `id?` slot, which `perform()` conspicuously lacks. Make the Action id **content-addressable by default** (`hash(verb, subject, object, roles, payload)`) so two attempts at the same fact converge on the same id without the caller coordinating. This one change turns the log from "mostly append-only" into "provably replayable," which is the foundation every other use case stands on.

---

## Requirements this lens imposes on the committed interface

- **`perform(verb, subject?, object?, data?, options?)` must accept a client-supplied/content-addressable `id`** and be idempotent (insert-or-return-existing on collision). Today only `create()` has an `id?` slot. *(Highest leverage.)*
- **Action must be a fat, self-describing event** — `subject`/`object`/`roles`/`data` denormalized at append time; subscribers never re-read the write model.
- **Action must be immutable** — no `update` on Action; status transitions append a new fact or are modeled as the only mutable field with a constrained `pending→active→completed|failed|cancelled` transition guard.
- **Replace destructive `deleteAction` with tombstone semantics** (a `delete`/inverse-verb Action) so replay from t0 is deterministic; physical deletes break event-sourcing.
- **`listActions`/`edges` must support forward cursor pagination** (`after: actionId`) and stable total order — offset pagination is incorrect on an append-only log. Action ids must be **monotonic/sortable** (ULID/KSUID-style) to double as cursors.
- **`ActionOptions` must add `since`/`until` time bounds** and formalize `where` as a predicate over `Action.data` (incl. comparison ops like `gte`).
- **`listActions` filter must match on subject-/object-*Noun*, not only ids** — workflows subscribe to "all `win` on any `Deal`."
- **A `subscribe(options): AsyncIterable<Action>` changefeed seam** with resumable cursor + at-least-once delivery and consumer-group-friendly checkpointing. (Not present; required for CDC, live dashboards, embedding backfill.)
- **rpc-promise / `BatchCollector` must carry intra-batch references** (`{ ref: i, path }`) and topologically order dependent ops in one flush, substituting promised ids server-side.
- **`createMany`/`performMany` must return per-item results** (partial-failure tolerant) and auto-chunk to `MAX_BATCH_SIZE`.
- **A distinct `correlationId` (saga id)** alongside `roles.cause` (parent-step ref); `edges(actionId, 'in')` must traverse the causation graph.
- **`Thing` must carry a monotonic `version`/etag** and `update` must accept `ifVersion` for optimistic concurrency; `frozen`-stratum fields reject post-create writes server-side.
- **Identical append ordering + idempotency semantics across MemoryProvider / pg+ch / DO-SQLite** — or per-tenant projections diverge by backend.
- **Fork/replay should be *composable* from `subscribe` + `performMany`** rather than a bespoke port method — keep the port minimal, build time-travel on top.
