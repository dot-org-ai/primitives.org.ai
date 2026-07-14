# @org.ai/authority

**The authority kernel: a zero-dependency, types-only token algebra that turns authority mistakes into compile errors.**

Self-approval, wrong-domain checkers, cross-tenant token reuse, wrong-correlation outcome resolution, wrong-gate re-minting of parked authority — in any domain that adopts this interface, each of these is a **type error**, not a code-review hope or a runtime incident. The kernel is pure types plus `declare`d constructors: it carries **zero runtime code and zero dependencies** (not even `@org.ai/types` — it owns its `unique symbol` brands). It is the generator grammar that graded 1,311 startup bundles with zero domain knowledge and zero grammar defects (ADR 0081 Epic-B measurement).

- **Provenance:** [ADR 0081](https://github.com/dot-do/explore.startups.studio/blob/main/docs/adr/0081-studio-os-operating-catalog-and-the-corrected-sas-abstraction.md) (the corrected Software/Agent/Service abstraction that ratified this interface) and [ADR 0082 §B](https://github.com/dot-do/explore.startups.studio/blob/main/docs/adr/0082-extraction-seams-authority-kernel-and-three-tier-open-closed-architecture.md) (the extraction decision that placed it here). Extracted **semantically verbatim** from the atlas incubation reference `app/_lib/sas/authority.ts`; per ADR 0082 §F the atlas CI canary remains authoritative until this package is ratified.
- **Status:** unpublished workspace package (extraction under ratification). The interface itself is FROZEN — changes here are grammar changes and require an ADR.

## The model: authority works like a pull request

The reference implementation of correct authority is the PR model every engineer already trusts:

1. An **Author** (identity only — no register, no authority) performs work and *proposes* it.
2. A **checker** who is *someone else*, *competent in the relevant domain*, and *inside the same tenant* reviews it. Approval mints an unforgeable token; the proposal itself is structurally unable to commit.
3. The **merge (commit) only happens through the token**. No token, no commit — and the token cannot be forged, borrowed across tenants, re-used for a different correlation, or parked and re-minted at a different gate.

Everything in the kernel is this model, factored so precisely that the compiler enforces each clause.

## The five axes

ADR 0081's central correction: a single fused "approved" boolean hides five orthogonal questions. `Passed` is un-fused along all five; each axis is cut by its own correction (C–H) and defended by its own harness pair.

| Axis | Type parameter / token | What it prevents |
|---|---|---|
| **Competence** (Correction B/C) | `Domain` on `Passed<D, …>`, `Seat<N, D, P>` | A checker approving outside their domain (quality seat approving a money commit) |
| **Correlation** (Correction E) | `Corr` string param threading command → outcome | A verdict for shipment X resolving pending shipment Y |
| **Principal / tenant** (Correction F) | branded `Principal<Id>` on every token, seat, register | Cross-tenant token reuse; tenant A's approval spending in tenant B |
| **Time** (Corrections E/G/H) | `Pending` (validity horizon), `SerializedPassed` (parked), `Grant` (standing, draw-down) | Stale observation-epoch commits; wrong-gate re-mints; blank-check laundering |
| **Outcome linkage** (Correction D) | `Accepted<Corr, Prin>` distinct from `Passed<D, …>` | Laundering external outcome acceptance through the competence lattice |

## The token family

| Token / shape | Minted by | Meaning |
|---|---|---|
| `Proposal<K, V>` | `Agent.propose` | Advisory judgment; stamps the register; `committed: false` — structurally cannot commit |
| `Passed<D, Corr, Prin>` | `authorityGate` / `adversarialGate` | Command authority: competence D x correlation Corr x principal Prin; unforgeable (`unique symbol`) |
| `Accepted<Corr, Prin>` | `outcomeGate` | Outcome acceptance by an external, competence-LESS judge (customer/founder), with a `PricingBasis` |
| `Pending<Corr, OutcomeD>` | async `commitThroughSoftware` | Command committed, outcome OPEN; carries correlation + validity horizon; only a same-`Corr` verdict resolves it |
| `DecisionRecord<D, Prin>` | gate decision | Signed, seat-stamped, durably persistable record (runtime verifies `credentialProof`) |
| `SerializedPassed<D, Corr, Prin>` | `serialize` | Parked durable authority; re-mintable ONLY by re-presenting the record to the same-identity gate (`remint`) |
| `Grant<D, Corr, Prin>` | `grantFrom` | Standing authority: residual draw-down + `validUntil` + tripwire predicate; consumed via `commitFromGrant`, revocable mid-flight |
| `Capability<D, From, To>` | cross-tenant handoff | Explicit cross-tenant invocation; cannot unify with an internal commit token |
| `Register<N, T>` / `RegisterBook<T>` | `makeRegister` / roster | One durable, non-transferable, accumulating register per (agent, tenant); A.finn and B.finn are distinct |
| `Author<N>` | `executor` | Commit-identity WITHOUT register or authority — the gate performer axis; pooled executors get one too |

Constructor verbs: `tenant`, `executor`, `makeAgent`, `makeRegister`, `authorityGate`, `adversarialGate`, `outcomeGate`, `commitThroughSoftware`, `resolvePending`, `serialize`, `remint`, `grantFrom`, `commitFromGrant`, `revoke`, `invokeAcrossTenant`, `escalate`, `stackOf`. All are `declare`d — this package intentionally ships **no implementations**. Runtime substrates (reference interpreter, durable production runtime, id.org.ai identity layer) live above the kernel and depend on it, never the reverse (ADR 0082 §C).

## The conformance suite: two-sided harnesses

The harnesses under `harnesses/` are the kernel's proof, and they travel with it — a consumer without them re-inherits the fail-open risk that slipped human review three times. Each pair `c`–`i` defends one correction with a **two-sided** compile convention:

| Config | Expectation | Why |
|---|---|---|
| `tsconfig.json` (corrected/guarded) | **EXIT 0** | The good path compiles AND every guard fires (each lie line spends a `@ts-expect-error`) |
| `tsconfig.stripped.json` | **must FAIL** | The same code with guards removed; a clean compile means the kernel stopped rejecting the lie |
| `tsconfig.old-minimal.json` | **EXIT 0** | The pre-factoring fused interface compiles the lie **silently, by design** — the preserved silent-defect control |
| `tsconfig.residual.json` | **EXIT 0** | Honest non-linear runtime residue the type system cannot compel, ADR-owned (e.g. spend accounting) |

Pairs: `c-makeside` (commit-identity vs register), `d-outcome` (external acceptance ≠ competence), `e-shipment` (correlation through time), `f-marketplace` (cross-tenant), `g-durable` (park/re-mint), `h-standing` (grants/draw-down), `i-covariant-canary` (the NoInfer sites themselves).

## The canary contract (for consumers and for CI)

```bash
pnpm --filter @org.ai/authority canary            # all 19 harness configs match their declared outcome
pnpm --filter @org.ai/authority canary:mutation   # the canary is proven able to catch a missing NoInfer
```

`canary` compiles every harness tsconfig and asserts the naming-convention outcome above. `canary:mutation` is the self-test of the canary itself: it copies the kernel to a temp dir, strips one covariant `NoInfer<…>` site at a time, and asserts:

- the **7 load-bearing sites** (`authorityGate.D`, `adversarialGate.D`, `resolvePending.OutcomeD`, `resolvePending.Corr`, `serialize.D`, `remint.D`, `remint.Corr`) are each **caught** by at least one guarded harness, and
- the **2 brand-anchored sites** (`authorityGate.Prin`, `adversarialGate.Prin`) are proven **safe-by-redundancy**: the branded `principal` argument already pins `Prin`, so the suite stays green with the site stripped while the cross-tenant lie is still rejected by the brand.

A missing `NoInfer` slipped human review three times before this canary existed; the contract is that it never waits for review again. **Consumers pinning or vendoring the kernel must run both scripts in their CI** — `pnpm test` on this package runs both.

## What the compiler cannot compel

The kernel pins the shape; four obligations are runtime laws registered in ADR 0081 §F′ and fulfilled by the runtime layer (id.org.ai + the platform substrate, ADR 0082 §C): instance-store non-collision, token unforgeability (signing/attestation of `credentialProof`), a durable DecisionRecord/trail store, and single-use spend accounting for grants. The `residual`/`residuals` harness files document exactly which residue is honest.
