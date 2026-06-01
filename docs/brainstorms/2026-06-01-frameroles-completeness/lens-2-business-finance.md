# Lens 2 — Business / Finance / Contracts / Transactions

**Probe:** Does the committed `FrameRole` taxonomy under-represent what business-as-code, the finance substrate, transactions, pricing, and contracts need on their Actions? Region: money & contracts only.

## Grounding: what the committed taxonomy actually is

The actual `FrameRole` union in `packages/digital-objects/src/types.ts` is **9 roles**, not the SEED's nominal 11: `subject · object · recipient · source · destination · instrument · topic · cause · manner`. (`when`/`where` are Action-native fields; `why`→`cause`, `how`→`manner`; `beneficiary` is in the SEED prose but absent from the shipped union — worth flagging to the synthesis.)

The decisive structural fact for this lens: **roles classify the complements of an Action (the SVO edge), not the attributes of a Thing.** The finance substrate already draws this line crisply, and it draws it *against* money living in roles:

- `Agreement` (`business-as-code/src/entities/legal.ts`) carries `value`, `currency`, `term`, `paymentTerms`, `noticePeriod`, `counterparty`, `parties`, `governingLaw`, `liabilityLimit` — **all as typed Thing properties on its schema**, none as Action roles.
- `Money` (`finance/types.ts`) is a value object `{ amount: bigint, currency }` — a typed field carried *inside* `Cost.amount`, `OutcomeContract.amount`, `TransferOpts.amount`, `LedgerLine.amount`. It is never a Thing you reference; it is data.
- The one place the SVO layer actually emits a finance-domain Action (`services-as-software/.../publish.ts`) puts the money-adjacent payload in `objectData`, i.e. `Action.data`.

So the reduction test has a very high bar here: `Action.data` is not a theoretical fallback — it is the *demonstrated, in-use* home for financial quantities. A role must beat a pattern that already works.

---

## Candidates

### 1. amount / value / consideration ("paid $5,000")

**Definition.** The monetary quantity exchanged in a transaction; in contract law, *consideration* is the value each side gives.

**Examples.** `pay` (subject=Payer, object=Invoice, "$5,000"); `charge` (subject=Merchant, recipient=Customer, "$99/mo"); outcome-contract `settle` ("release 20,000 cents from escrow").

**Reduction test.** Real — money is everywhere. **But it fails *irreducible* hard.** `Money` is `{amount, currency}` — a value object, not a Thing with an id you can reference. A FrameRole filler is a `ThingRef | string` that dereferences to a Thing (`fillerKind: thing`). Money has no Thing identity; it is the canonical *typed datum*. The codebase already proves this: every `amount` in the substrate is a field, and `Agreement.value` is a schema property. Making `amount` a role would mean stuffing `'5000'` into `roles.amount` as a bare string, losing the currency, the bigint precision, and the discriminated `Money` shape — strictly worse than `data: { amount: { amount: 5000n, currency: 'USD' } }`. There is no query/gate/render that wants "the amount slot" abstractly across all verbs; gates want `Cost.amount`, `Budget.cap`, `OutcomeContract.amount` — each a typed field on a typed envelope.

**Verdict: REJECT → `data`. Confidence: very high.** This is the headline finding: money is fundamentally `data`, not a role.

### 2. price / rate / cost

**Definition.** The *declared* charge (price), the per-unit/per-period figure (rate), the *incurred* outlay (cost) — as opposed to the realized `amount` transferred.

**Examples.** `quote` a Service (`Pricing.outcome` tiers); `meter` a usage event (rateBasisPoints); `incur` a Cost (`finance/types.ts` `Cost`).

**Reduction test.** Same fate as `amount`, plus these are first-class *Things* when they need identity. `Pricing`, `Cost`, `CostModel` are typed envelopes. When a Cost needs to be an entity (it has `$id`, `$type: 'Cost'`, `actionRef`), it becomes an `object` or `result` Thing of a `incur`/`capture` Action — not a new role. `cost` as "the price paid" reduces to `amount` (already rejected); `cost` as "the Cost entity produced" reduces to `result`/`object`.

**Verdict: REJECT → `data` (the figure) or `result`/`object` (the Cost/Price Thing). Confidence: high.**

### 3. counterparty / co-party ("the other side of the contract")

**Definition.** In FIBO/ISDA usage, the *counterparty* is the opposing principal to a contract — the party who bears the reciprocal obligation. Distinct from a passive recipient: a counterparty is a *co-principal*, not a target.

**Examples.** `sign` an Agreement (subject=us, counterparty=them); outcome-contract has explicit `buyer` AND `seller` (`outcome-contract.ts`); a `Transfer` has distinct `fromAccountRef`/`toAccountRef` (`account.ts`); `trade` (each side gives consideration).

**Reduction test.** This is the *strongest* candidate in the region, because contracts are genuinely **two-principal** events and SVO is one-subject-biased. Is `recipient` enough? Partly — `recipient` already captures "to-whom" and `publish.ts` uses it for the listing. But `recipient` connotes a *passive* beneficiary/target, whereas a counterparty is an *active co-obligor* who signs, pays, and can breach. The substrate models this asymmetry explicitly: `OutcomeContract.buyer` vs `OutcomeContract.seller` are both Workers with reciprocal duties, and a `Transfer` distinguishes the two account-Things directionally.

**However** — apply the test ruthlessly. (a) *Real:* yes. (b) *Load-bearing beyond data:* yes — gates care who the counterparty is (KYC/AML on `kyc-aml-required`, authority-boundary on the obligor). (c) *Irreducible:* this is where it wobbles. For a `Transfer`/`pay`, the two sides map cleanly to **`source` (from-account) and `destination` (to-account)** — already in the taxonomy and *directional*, which is exactly what a transaction wants. For a `sign`/`agree`, the second principal is plausibly a second `subject` (the linguistic-theory lens's "Co-Agent") rather than a finance-specific role. So "counterparty" largely **reduces to `source`/`destination` (for value flows) or to a co-subject (for mutual contracts)**. It survives only if the synthesis decides money-flow direction shouldn't overload `source`/`destination`.

**Verdict: MAP-TO-EXISTING (`source`/`destination` for flows; co-`subject` for mutual contracts). Confidence: medium-high.** Flag to synthesis as the one role worth a second look if a general "co-party / co-agent" role lands from Lens 1 — finance would *use* it, but finance does not independently *justify* it over `source`/`destination`.

### 4. currency / unit

**Definition.** The denomination of a quantity (USD/USDC/BTC; or rows/seats/tickets).

**Reduction test.** `currency` is a *field of* `Money` — it travels inside the value object. It is data-of-data. No Action ever wants a bare "currency slot." Trivially `data`.

**Verdict: REJECT → `data`. Confidence: very high.**

### 5. term / duration ("leased for 12 months")

**Definition.** The temporal extent an obligation runs.

**Examples.** `lease` (12 months); `subscribe` (`SubscriptionPlan.interval`); outcome-contract `timeoutDays`/`expiresAt`.

**Reduction test.** Real and load-bearing (the timeout gate fires on it). But it is consistently modeled as **typed temporal data on the envelope**: `Agreement.term`, `SubscriptionPlan.interval: 'day'|...|'year'`, `OutcomeContract.timeoutDays`, `Budget.period`. The taxonomy already declared `when`/`where` to be *Action-native* rather than roles; `term`/`duration` is the same category — a temporal attribute, not a complement that dereferences to a Thing. It is data (or, like `when`, a candidate Action-native field), never a Thing-ref role.

**Verdict: REJECT → `data` (or Action-native temporal, per the `when` precedent). Confidence: high.**

### 6. frequency / schedule ("bills monthly")

**Definition.** The recurrence cadence of a repeated Action.

**Examples.** `bill` monthly (`SubscriptionPlan.interval`); `Budget.period: 'daily'|'weekly'|'monthly'`; SLA `close-by-day-5`.

**Reduction test.** Identical disposition to `term`: enumerated typed data (`interval`, `period`). VerbNet lists `Frequency` as a thematic role, so a generalist might keep it — but in *this* substrate it is always a closed enum field on the pricing/budget envelope, never a Thing-ref. The recurrence belongs to the *schedule/plan Thing*, and an individual `bill` Action is a single occurrence whose cadence is read off the parent plan.

**Verdict: REJECT → `data`. Confidence: high.** (Defer the linguistic-generality argument to Lens 1; from finance, it doesn't earn a slot.)

### 7. condition / contingency ("payable if delivered")

**Definition.** A predicate that gates whether/when an Action's effect (typically settlement) takes place.

**Examples.** Outcome-contract release **iff** `ProofPredicate` passes (`proof-predicate.ts`); `RefundContract` triggers on `quality-floor-fail`; SLA credit **on** breach.

**Reduction test.** This is conceptually the most *load-bearing* finance concept — settlement is entirely predicate-driven, and Stripe-vs-substrate differentiation is literally "we ship the outcome predicate." But: (a) the condition is a rich composable structure (`ProofPredicate`'s 7 leaves + AND/OR), not a Thing-ref or an enum string — it cannot fit `roles.condition` as a `ThingRef | string`. (b) It is *already* a first-class typed field on the contract Thing (`OutcomeContract.predicate`), where it is queried and evaluated by the settlement runtime. (c) An Action that *evaluates* the condition has the predicate's referent as its `topic` (what the gate is *about*) or the contract as its `object`. So "condition" is **a typed field on a contract Thing, gated at settlement** — not an Action role. It fails *irreducible* (too structured for a role filler) even though it passes *real* and *load-bearing* spectacularly.

**Verdict: REJECT as a role → keep as the typed `predicate` field; the Action that turns on it uses `topic`/`object`/`cause`. Confidence: medium-high.** Worth flagging: if Lens 3 (governance) proposes a `precondition` role, finance's settlement predicate is the canonical *content* it would carry — but the content's natural home is the contract Thing, and the predicate's structure exceeds what a role filler can hold.

### 8. collateral / security

**Definition.** An asset pledged to secure an obligation; released or seized on default.

**Examples.** `escrow` funds (`OutcomeContract.escrowAccountRef`); `pledge` collateral; `secure` a loan.

**Reduction test.** Escrow is real in the substrate (`escrowAccountRef`), but it is **an Account Thing referenced by the contract**, and an `escrow`/`release` Action treats that account as `source`/`destination` (funds flow from escrow to seller). Collateral-as-asset is the `object` of a `pledge` Action and the `instrument` of a `secure` Action. No residue requires a dedicated "collateral" slot; the asset's *role in the specific Action* (object/source/destination/instrument) already names it.

**Verdict: MAP-TO-EXISTING (`object` / `source` / `destination` / `instrument` per verb). Confidence: high.**

### 9. basis (the rate/index a price derives from)

**Definition.** The realized quantity a proportional charge is computed against (`PercentOfBasis`: `invoice-amount` / `collected-amount` / `transaction-volume`).

**Examples.** `meter` a `percent-of` charge (`pricing.ts` — "2% of collected funds"); index a rate to a benchmark.

**Reduction test.** This is a genuinely interesting one — `basis` is *not* the money, it's *what the money is computed from*, which feels role-like ("derived-from"). But in the substrate it is a **closed enum string** (`PercentOfBasis`) that the metering runtime *resolves* to a bigint at settlement. It lives as a field on the `Pricing` value. Its "derived-from" flavor is the **provenance lens's territory** (`derivedFrom`/`wasDerivedFrom`), not a finance-specific role — and even there, for a single metering Action the basis quantity is just data the runtime reads. From the finance side it is a typed config field, not an Action complement.

**Verdict: REJECT → `data` (defer the derivation flavor to Lens 4). Confidence: medium-high.**

---

## Synthesis

### (a) Ranked shortlist of genuine additions from this region

1. **(none clears the bar on finance grounds alone).**
2. *Watch-item:* **counterparty / co-party** — the only candidate that is real + load-bearing + nearly irreducible. It loses to `source`/`destination` for value flows and to a co-`subject` for mutual contracts, so finance does not *independently* justify it. If Lens 1 (Co-Agent) or Lens 3 lands a general co-principal role, **finance will eagerly consume it** for `buyer`/`seller` symmetry. Recommend the synthesis treat this as a cross-lens vote, not a finance-owned addition.
3. *Watch-item:* **condition / contingency** — spectacular load-bearing-ness, but its content (`ProofPredicate`) is too structured for a role filler and already has a first-class home on the contract Thing. If Lens 3 proposes `precondition`, note it can only hold a *ref*, not the predicate itself.

Everything else — **amount, value, consideration, price, rate, cost, currency, unit, term, duration, frequency, schedule, collateral, basis** — **REJECTS to `data`** (or maps to existing object/source/destination/instrument). The substrate already demonstrates this: `Money` is a value object, `Agreement` puts value/term/counterparty/currency in its *schema*, and the live finance Action emits payload via `objectData`.

### (b) The headline for the meta-question

**Money/value is fundamentally `data`, not a first-class role.** This is the most important deliverable from this lens. The temptation to add `amount`/`value` is strong (VerbNet has `Asset`/`Value`), but the substrate's own design refutes it: monetary quantities are precision-typed value objects (`Money` = `{bigint, currency}`) and discriminated envelopes (`Pricing`, `Cost`, `Budget`), carried as *fields*. A role filler is a `ThingRef | string` that dereferences to a Thing; money has no Thing identity and would *lose* type safety, currency, and precision if flattened into a role string. Roles are for the *who/what/to-whom* of the SVO edge; money is the *how-much*, and how-much is data.

### Recommendation on closed-vs-extensible

**(b): closed core + documented `schema.org.ai`-namespaced extension path.** The finance region produces *zero* additions that the core 9 must absorb — but it produces a rich, evolving vocabulary of *typed envelopes* (`Money`, `Pricing` with five variants, `ProofPredicate` with seven leaves, `RefundContractRef`, `AuthorityBoundaryRef`) that clearly want to live as **schema'd Thing types and typed `Action.data` shapes**, not as roles. A frozen-larger role set would invite exactly the wrong move: promoting `amount`/`basis`/`term` into roles to feel "complete," when they belong in `data`/schema. A closed *core* taxonomy (the realizer/gate/exporter reason over it exhaustively) plus a namespaced extension path for genuine future roles is the right shape — and the extension path's *first job* is to host any cross-lens co-principal role (counterparty/co-agent) without the finance team having to fork the core. Finance's lesson for the meta-question: **resist role-creep; push quantity and structure into typed data, keep roles thin and edge-shaped.**
