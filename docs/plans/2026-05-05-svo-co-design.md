# SVO Co-Design: Worker / Tool / Task on `digital-objects`

**Date:** 2026-05-05
**Status:** Proposed
**Related:** [CONTEXT.md](../../CONTEXT.md), [ARCHITECTURE.md](../../ARCHITECTURE.md)

## Summary

The `digital-workers` / `digital-tools` / `digital-tasks` packages were built before `digital-objects`. They each restate concepts (Subject, Verb, Action) that `digital-objects` already names properly. This plan realigns the runtime triangle onto the storage ontology without merging packages, so each package keeps its identity but stops reinventing types.

## The architectural error and the fix

| Concept | Storage layer (`digital-objects`) | Runtime layer | Today | After |
|---|---|---|---|---|
| Who acts | `Person` / `Agent` / `Thing` | `Worker` (with Role indirection) | Parallel `Worker` type, no link to `Thing` | Worker carries `IdentityRef → Thing<Person>` or `Thing<Agent>` or `Thing<Role>` |
| What action | `Verb` (conjugations only) | `Tool` (callable handler) | Tool has no link to Verb | Tool *registers* a Verb with a handler |
| What happened | `Action` (S-V-O record) | `Task` (issue-shaped work) | Task has its own status fields | Task extends Action with project-management metadata |
| Frame slots | absent | absent | (no concept) | Closed 10-role taxonomy on `Verb.frame`; filled per-Action |

## Package responsibilities (locked)

| Package | Owns | References |
|---|---|---|
| `digital-objects` | `Noun`, `Verb` (frame + provenance), `Thing`, `Action` | — |
| `id.org.ai` | `Person`, `Agent`, `Identity` (DID + scopes + payment instruments), `AuthBroker`, `PaymentBroker` | `digital-objects` for Noun/Thing |
| `digital-workers` | `Worker` port, `Role`, runtime status, load-balancing, escalation | `id.org.ai` for Identity, `digital-objects` for Action |
| `digital-tools` | `Tool` registry, `defineTool`, frame validation, dispatch | `digital-objects` for Verb registration, `id.org.ai` for brokers |
| `digital-tasks` | Issue-shaped Task semantics: title/body/comments/labels/dependencies/projects/milestones | `digital-objects` for Action |
| `human-in-the-loop` | Channel adapter registry; ships Vercel Chat SDK as default human channel | `digital-workers` Worker port |
| `autonomous-agents` | Agent runtime adapter for Worker port | `digital-workers` Worker port |

## Proposed port signatures

### `digital-objects.Verb` — gain `frame` and `source`

```ts
type FrameRole =
  | 'subject' | 'object' | 'recipient'
  | 'source' | 'destination' | 'instrument'
  | 'topic' | 'cause' | 'manner'

interface Frame {
  subject: NounRef | 'any'                 // required
  object?: NounRef                         // direct object
  recipient?: NounRef
  source?: NounRef
  destination?: NounRef
  instrument?: NounRef | 'Tool'
  topic?: NounRef
  cause?: 'Action'                         // links to parent Action
  manner?: string[]                        // enum, not a Thing
}

interface Verb {
  name: string                             // 'send', 'approve'
  conjugations: { action, act, activity, event, ... }
  frame: Frame
  source: 'verbs.org.ai' | 'apqc' | 'onet' | 'domain'
  canonical: boolean                       // true for pre-loaded
  description?: string
  createdAt: Date
}
```

### `digital-objects.Action` — gain `roles` map

```ts
interface Action<T = unknown> {
  id: string
  verb: string                             // Verb.name reference
  subject?: ThingRef                       // who/what acts
  object?: ThingRef                        // direct object
  roles?: Partial<Record<FrameRole, ThingRef | string>>  // remaining frame slots
  data?: T
  status: 'pending' | 'active' | 'completed' | 'failed'
  timestamp: Date
  location?: string
  paymentReceipt?: PaymentReceipt          // for paid Tools
  cause?: ActionRef                        // parent Action
}
```

### `id.org.ai.Identity`

**Note (2026-05-05 update):** The shapes below were corrected against `id.org.ai@0.3.0` and `schema.org.ai@0.1.0` (both published on npm).

Two earlier drafts were wrong:
- `PaymentInstrument.rail: 'x402' | 'mpp'` — real shape uses `rails: PaymentRail[]` records (`{ protocol, method, network?, asset? }`); one instrument can satisfy multiple rails (USDC wallet pays via both x402-exact and MPP-charge-tempo).
- `PaymentRequired.accepts: ('x402' | 'mpp')[]` — real shape is a discriminated union of three intents.

Also: `ThingRef` is widened in `schema.org.ai@0.1.0` to `string | { $id, $type, name? }` (was just `string` in our `digital-objects`). Bare strings still work; typed refs let `Worker.resolve()` skip a fetch.

`IdentityRef` should be `ThingRef` (the schema.org.ai widened form), not a separate `string` alias.

The L2→L3 transition (`'subscribe'`) is no longer library-emitted in `id.org.ai`; only L0→L1 (`provision`) and L1→L2 (`claim`) are emitted by the state machine. L3 is downstream product surface.

```ts
// All from id.org.ai@^0.3.0
interface Identity {
  did?: string                             // Decentralized Identifier (optional in 0.3.0)
  subject?: ThingRef                       // → Person or Agent (optional in 0.3.0; back-compat with legacy shape)
  scopes?: string[]                        // OAuth-style permissions
  paymentInstruments?: PaymentInstrument[]
  contacts?: ContactChannel[]
}

interface PaymentInstrument {
  $type: 'wallet' | 'spt' | 'stripeCustomer'
  rails: PaymentRail[]                     // one instrument can satisfy multiple rails
  pubkey?: string
  sptHandle?: string
  spendCap?: { amount: string, currency: string, period: 'session' | 'day' }
}

interface PaymentRail {
  protocol: 'x402' | 'mpp'                 // x402 v2 spec; MPP IETF draft draft-httpauth-payment-00
  method: 'exact' | 'tempo' | 'stripe-spt' | 'solana' | 'lightning' | 'card'
  network?: string                         // e.g., 'base', 'solana'
  asset?: string                           // e.g., 'USDC'
}

interface AuthBroker {
  gate(req: Request, need: AuthRequirement): Promise<AuthDecision>
  identify(req: Request): Promise<Identity | null>
  check(identity: Identity, need: AuthRequirement): Promise<AuthDecision>
}

interface PaymentBroker {
  settle(req: Request, identity: Identity, required: PaymentRequired): Promise<PaymentReceipt>
  session(...): Promise<PaymentSession>    // not yet implemented in 0.3.0 (MPP escrow)
  instrumentsFor(identity: Identity): PaymentInstrument[]
}

// AuthRequirement is a discriminated union — bare CapabilityLevel for the 95% case,
// or a typed object for FGA-shaped checks
type AuthRequirement = CapabilityLevel | {
  minLevel?: CapabilityLevel
  scopes?: string[]
  anyScopes?: string[]
  roles?: string[]
  resource?: ThingRef                      // for fine-grained-authorization (FGA) checks
}
```

### `digital-workers.Worker`

```ts
interface Worker {
  ref: ThingRef                            // → Person | Agent | Role
  identity: IdentityRef                    // → id.org.ai Identity
  status: WorkerStatus                     // derived for Role; direct for Person/Agent
  contacts: ContactChannel[]               // preferred channels for Tasks

  resolve(): Promise<Person | Agent>       // resolves Role to current filler
  do<T>(verb: string, args: ToolArgs): Promise<Action<T>>     // direct invocation
  assign(spec: TaskSpec): Promise<Task>    // issue-shaped dispatch
}

interface Role extends Thing {
  $type: 'Role'
  name: string                             // 'CEO', 'PDM'
  filler: ThingRef                         // current Person | Agent
  fallbackChain?: ThingRef[]               // if filler unavailable
}
```

### `digital-tools.Tool`

```ts
interface Tool<TArgs = unknown, TResult = unknown> {
  verb: string                             // registers/references Verb
  frame: Frame                             // declares role types
  auth?: AuthRequirement                   // scopes/oauth/apiKey
  pricing?: PaymentRequired                // MDXLD-shaped, x402/MPP-compatible
  handler: (args: TArgs, ctx: ToolContext) => Promise<TResult>
}

// PaymentRequired is a union of three shapes per id.org.ai@0.3.0:
type PaymentRequired =
  // 1. Bare shorthand for the 95% case
  | { amount: string; currency: string; recipient: string }
  // 2. Explicit charge intent with multi-rail support
  | { intent: 'charge'; accepts: RailQuote[] }
  // 3. MPP escrow / session intent (broker.session() — not yet implemented in 0.3.0)
  | { intent: 'session'; budget: string; ttlSeconds: number; accepts: RailQuote[] }

interface RailQuote {
  rail: PaymentRail
  amount: string
  currency: string
  recipient: string                        // wallet address or stripeAccountId
  facilitator?: string
}

interface ToolContext {
  identity: Identity                       // injected by AuthBroker check
  payment?: PaymentRail                    // injected by PaymentBroker if pricing
  parentAction?: ActionRef                 // for Cause linkage
}
```

### `digital-tasks.Task`

```ts
interface Task<T = unknown> extends Action<T> {
  $type: 'Task'
  title: string
  body?: string                            // rich markdown description
  assignees: WorkerRef[]
  allowedWorkers: ('agent' | 'human' | 'any')[]
  priority: 'urgent' | 'high' | 'normal' | 'low'

  // GitHub-issue-shaped fields
  labels?: string[]
  project?: string                         // milestone/project ref
  dependencies?: TaskDep[]
  comments?: Comment[]                     // child Actions of verb 'commented'

  scheduledFor?: Date
  deadline?: Date
}
```

### `human-in-the-loop.ChannelAdapter`

```ts
interface ChannelAdapter {
  kind: 'chat-sdk' | 'web' | 'expo' | 'email' | 'slack' | 'teams'
  dispatch(task: Task, worker: Worker): Promise<Subscription>
  receive(callback: (response: Action) => void): Subscription
}
```

The package ships **Vercel Chat SDK** as the default `chat-sdk` adapter (hard dependency). Other channels are sub-packages (`@org.ai/hitl-expo`, `@org.ai/hitl-slack`, etc.).

## End-to-end invocation flow

```
worker.do('transcribe', audioFile)
  │
  ├─ digital-objects: resolve Verb 'transcribe' → frame {subject, object: AudioFile}
  ├─ digital-tools:    look up Tool registered to that Verb → handler + auth + pricing
  ├─ id.org.ai (AuthBroker):    check worker.identity has 'audio:read' scope
  ├─ id.org.ai (PaymentBroker): intersect identity.paymentInstruments × tool.pricing.accepts → pick rail
  │     └─ rail = x402 (worker's wallet has USDC)
  ├─ digital-tools: invoke handler({subject, object}, ctx with identity + payment)
  │     └─ if external service returns 402 mid-call, PaymentBroker.pay() handles automatically
  ├─ digital-objects: record Action {subject=worker.ref, verb='transcribe', object=audioFile, paymentReceipt, status='completed'}
  └─ return Action<TranscriptResult>
```

For an issue-shaped Task instead of a direct invocation:

```
task.create({ verb: 'review', object: pullRequest, assignees: [ceo()] })
  │
  ├─ digital-tasks: persist Task as Action with project-management overlay
  ├─ digital-workers: resolve ceo() Role → current filler Person
  ├─ Worker.dispatch(task) → channel adapter (Chat SDK by default)
  ├─ human-in-the-loop: surface Task in Vercel Chat UI
  ├─ ... (human reviews, comments, transitions; each generates a child Action)
  └─ task.complete(result) → terminal Action {verb='reviewed', subject=ceo, object=pr, status='completed'}
```

## Migration order

Phased so that no step breaks the previous layer:

1. **`digital-objects.Verb` gains `frame` and `source` fields.** Backward-compatible (optional). Pre-load canonical verbs from `verbs.org.ai`.
2. **`digital-objects.Action` gains `roles` map.** Backward-compatible (optional).
3. **`id.org.ai`**: define `Identity`, `AuthBroker`, `PaymentBroker`. Confirm package home (this repo or moved out).
4. **`digital-workers.Worker.identity`** field added; legacy fields deprecated. `Role` Noun registered with `digital-objects` at package init.
5. **`digital-tools.defineTool`** gains `frame`, `auth`, `pricing` fields. The handler signature gains `(args, ctx)`. Existing tools still work (frame inferred from input shape if absent).
6. **`digital-tasks.Task`** extends `Action`; legacy `function` field aliased to `tool`. Migrate to issue-shaped semantics.
7. **`human-in-the-loop`** absorbs Vercel Chat SDK as default adapter. Other channels become sub-packages.
8. **`autonomous-agents`** explicit `./worker` adapter export alongside main direct-kind exports.

## What this leaves unchanged

- Layer rules: no internal dependencies are inverted. `digital-objects` stays Layer 0.
- Package count: still seven packages in this triangle (digital-objects + id.org.ai + workers + tools + tasks + HITL + autonomous-agents).
- Public APIs: backward-compatible everywhere. New fields are additive.

## Open questions deferred to implementation

- Exact wire format for `paymentReceipt` (x402 receipt schema vs MPP transaction reference).
- Whether `Comment` on a Task is a first-class entity or just a child Action with `verb='commented'`.
- Migration path for existing `function-registry` callers when it merges with `digital-objects-registry` (see separate plan).
- Channel-adapter discovery: registry lookup vs explicit injection.
