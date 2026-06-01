# autonomous-agents ⟷ human-in-the-loop: one verb protocol, two tier-bindings, a single escalation seam

**Status:** proposed
**Date:** 2026-06-01

## Context

`autonomous-agents` (the `agentic` tier) and `human-in-the-loop` (the terminal
`human` tier) are the top two rungs of the cascade escalation ladder
`code → generative → agentic → human`. Both are **Worker specializations**: they
build on the frozen `digital-workers` Worker port (verbs
`do/ask/decide/approve/notify/generate/is`; `Worker` carries an Identity; a Role
resolves to its current filler at invocation; a Channel Adapter satisfies
`dispatch`). `human-in-the-loop` is an **injected port into
`services-as-software`** (ADR-0011 FunctionRunner→HumanChannel seam) and the
**ESCALATE landing** of the findOrCreate gate (the strategic-primitives plan,
`FIND | CREATE | ESCALATE`).

The two packages were drifting toward parallel vocabularies. The L4–L5 audit
flagged that `approve/ask/decide/notify/do/generate/is` exist on Worker, Agent,
*and* Human with subtly different semantics. The current surfaces are genuinely
asymmetric: an `Agent` has `generate`/`is` and its verbs resolve **immediately**;
a `Human` has `review` (and lacks `generate`/`is`), its verbs take a **routed**
param envelope (`assignee`/`role`/`team`/`priority`/`timeout`/`escalatesTo`) and
resolve through a **request-lifecycle FSM**
(`pending→claimed→in_progress→completed|released|timeout|escalated|cancelled`).

The interface was **designed four ways in parallel** ("Design It Twice", ×2):
**(A)** one configured `Worker`, autonomy as a single dial, the verb septet as the
whole surface; **(B)** two factories over one tier-parameterized `WorkerVerbs<T>`
protocol with the autonomy ladder encoded in conditional types; **(C)** the
escalation *ladder* as the primary object (`Cascade`) that auto-routes one verb
call up the rungs; **(D)** verbs as resumable algebraic effects bubbling up an
actor supervision tree, where a parked continuation **is** a `LifecycleItem`.

The four agreed on more than they disagreed: escalation must be **one** transition
that reuses the verb's own result type, mints exactly one `LifecycleItem`, threads
`escalatedFrom` provenance, and is simultaneously the cascade's agentic→human tail
and the findOrCreate `ESCALATE` landing; the 3-rater panel must be designed
**once**; persistence must be an injected port. They diverged on whether Agent/Human
is one surface or two, and where buyer identity lives.

## Decision

### 1. One verb *protocol*, two tier-*bindings* (resolves tension 1)

There is **one runtime Worker** (the frozen `digital-workers` contract — the dial,
`capabilityTier`, is the config) and **one shared verb vocabulary**,
`WorkerVerbs<Tier>`. `Agent` and `Human` are **two concrete bindings** of that one
vocabulary. The binding is a *function of the tier* — not two hand-written
surfaces that can drift:

- **Return shape** is `Settle<Tier, T>`: an `agentic` verb resolves **immediately**
  (`Promise<T>`); a `human` verb returns a **lifecycle-tracked** handle
  (`Tracked<T>` — a `Promise<T>` that also exposes the request-lifecycle FSM and
  `cancel`). This makes "humans are slow and cancellable" a property of the type,
  not a runtime flag (B's insight).
- **Extension verbs** are tier-derived: `agentic` adds `generate`/`is`/`verify`
  (self-check); `human` adds `review`/`ratify`. The current asymmetry is preserved
  *by construction* from one `TierVerbSet` map, not duplicated.

So it is "a configured Worker" at the runtime/ontology layer (A is right: one
Worker, autonomy is a dial) **and** "a distinct surface" at the type layer (B is
right: the binding gives a tier-appropriate face). `Agent()` and `Human()` remain
two factories; both reduce to the one Worker and carry Identity. We reject A's
single-`Invocation`-god-object minimalism (it makes the queue-operator surface and
per-verb policy awkward) and B's deep public conditional-type arithmetic (illegible
errors; leaks at the dynamic-dispatch core) — the bindings are **concrete named
types** (`Agent`, `Human`) over a shared protocol.

### 2. A single `escalate` transition — one seam, two triggers (resolves tension 2)

Escalation is **one** runtime transition: **re-dispatch the same `Action` at the
`human` tier**. It is the *only* code path that mints a `LifecycleItem`. It:
1. mints exactly one `LifecycleItem` (`pending`) via the frozen request-lifecycle
   FSM and the injected store;
2. resolves the target human (Role → current filler; `evaluateEscalation` /
   `EscalationPolicy` choose the assignee);
3. delivers via the Channel Adapter;
4. returns a `Tracked<T>` whose `T` is the **same** as the agent verb's result (an
   escalated `decide` still yields a `Decision`).

The Action carries `escalatedFrom`; every rung attempt is an `Action` in one audit
trail. This single seam is reachable two ways — **implicitly** (the panel verdict /
a policy floor / a findOrCreate `ESCALATE` auto-triggers it — C's zero-ceremony
common case) and **explicitly** (`agent.escalate(action, reason)` for
developer-driven handoff — B's typed transition). There is no second ad-hoc
notification path; `notify` is a verb, not an escalation mechanism. We adopt D's
*semantics* (a pending `LifecycleItem` is parked work; the channel adapter
resuming it is the higher tier answering) **without** D's algebraic-continuation
machinery — TypeScript cannot serialize delimited continuations, and durability
would degrade to replay. Re-dispatch + a lifecycle-tracked handle gets the same
result with an honest implementation.

### 3. The 3-rater EvaluatorPanel, designed once; its verdict drives escalation (resolves tension 3)

One `EvaluatorPanel` (absorbed from `services-builder/packages/verify`): three
raters (two model personas + one mechanical rules rater), majority aggregate →
`auto-promote | queue-review | reject`, **JIT** (cached verdict for an
already-verified subject, else runs the panel), injected ports (`RaterModelInvoker`,
`VerifyDb`, `CascadeInvoker`, `EvaluatorRunner`). The verdict **is** the escalation
trigger (D's "panel is the handler that decides resume-vs-escalate"):
`auto-promote ⇒ accept`, `queue-review ⇒ escalate(human)`, `reject ⇒ fail`. An
`Agent` runs it as `verify` (self-check, immediate); the `Human` tier is where a
`queue-review`'d item lands and is `ratify`'d. One panel, one verdict union, two
tier-faces, zero duplication.

### 4. Buyer identity is **consumed from `id.org.ai`**; the verifier is a port checked at the gate (resolves tension 4)

`BuyerIdentity { id; kind: 'human'|'agent'|'service-account'; … }` is an **Identity**
concern — its `kind` discriminant *is* the Identity person/agent split, and
CONTEXT.md already names `id.org.ai` the canonical Identity home (DID + scopes +
payment instruments), consumed as `id.org.ai@^0.3.0`. Re-homing identity into
`human-in-the-loop` would **fork the canonical identity model** — the exact drift
CONTEXT.md exists to prevent. So we **consume `id.org.ai`** for `BuyerIdentity` and
the attested-intent `mintEnvelope`/`verifyEnvelope` (HMAC-SHA256).

We keep D's enforcement-location argument by holding an injected `IntentVerifier`
**port** on the runtime and calling it **at the escalation/dispatch gate** — a
forged or expired envelope is rejected *before* a human is ever paged. The security
boundary and the escalation boundary stay the same line of code, **without** forking
the crypto. If `id.org.ai@^0.3.0` does not yet export attested-intent, that is an
**upstream ask** (a follow-on bead), not a license to re-home it.

**Tradeoff surfaced:** folding into `human-in-the-loop` would make the package
self-contained (no dependency, crypto co-located with the gate). We reject it
because it duplicates security-critical identity logic the org centralizes and
tempts exactly the new-`digital-identity`-package move the CLAUDE.md guardrail
forbids. **No new npm package, no new scope.**

### 5. Persistence is one injected port (resolves tension 5)

One injected `SpectrumStore` whose `lifecycle` field **is** the frozen
`human-in-the-loop` `LifecycleStore`. Agent history and human lifecycle items are
the **same** `Action`-shaped records (agent history = the audit/event stream; a
human lifecycle item = a pending `Action` at tier `human`). Durable mutation never
appears on the `Agent`/`Human` surface and is never hardcoded — swapping in-memory
for Durable Objects / Postgres is a one-field change.

### 6. Opt-in `Ladder` for the auto-routing common case

C's auto-routing ladder is real value but must not be mandatory (C's own weakness:
when the caller wants a *specific* tier, a mandatory ladder fights them). So the
`Ladder` is **opt-in sugar** over registered rungs: `Ladder().register(agent).register(human)`
exposes the verb vocabulary and auto-routes (try cheap → self-verify → climb on
`queue-review`). A bare `Agent` or `Human` is usable directly; the degenerate
one-rung ladder is just the rung.

## Consequences

- **One source of truth for the verb vocabulary.** `WorkerVerbs<Tier>` +
  `Settle<Tier,T>` + the `TierVerbSet` map mean Agent and Human cannot drift apart;
  the asymmetry is derived, not copy-pasted. Grounds to the in-flight schema.org.ai
  Worker/Agent/Human types (`aip-7ie3`).
- **The escalation seam is the single most-travelled path and the only
  `LifecycleItem` minter** — auditable, replayable, and identical for the cascade
  tail and the findOrCreate ESCALATE landing.
- **The panel is shared** by both packages; it needs a home both can depend on
  (candidates: `digital-workers` port + concrete impl, or a `/verify` subpath) —
  resolved in the build epic, not here.
- **`human-in-the-loop` stays an injected port** into `services-as-software`; no
  reverse import. **`id.org.ai` gains a consumer**, not a fork.
- **No new npm package, no new scope** (CLAUDE.md guardrail). The
  `business-as-code` layering inversion is left untouched.

## ADRs respected

- ADR-0008 (HITL workflow lifetime caps) — the escalate seam's `LifecycleItem`
  honors the existing lifetime caps; the supervisor's stop condition reuses them.
- ADR-0011 (services-as-software Deliverable envelope + `Service()` front door) —
  `human-in-the-loop` remains the injected FunctionRunner→HumanChannel port; the
  escalate seam is the concrete landing of `assurance`→QUALITY_REVIEW→human.
- ADR-0006 (service reverify policy) — the EvaluatorPanel's verdict composes with
  the reverify policy on identity-bearing fields.
- ADR-0010 (ai-functions delegates code execution to ai-evaluate) — an Agent's
  Code/Generative work executes through that sandbox; the panel's mechanical rater
  may too.
