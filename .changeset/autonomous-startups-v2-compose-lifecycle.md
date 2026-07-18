---
'autonomous-startups': minor
---

autonomous-startups v2: `compose(primitives)` + lifecycle@1 stategraph (ADR 0001 amendment 3)

Re-expresses the capstone per the constitution's amendment 3. Still `0.x` — nothing is
entrenched (ADR 0001 fixation gate); this is an additive/reshaping minor pre-1.0.

- **Open composition.** A `PRIMITIVE_REGISTRY` of composable primitives (each a named
  register slot with a cardinality + required flag) replaces the hard-coded five.
  `compose(primitives)` builds a blueprint over any profile; `CANONICAL_FIVE` is the
  registry-resolved default profile, so `compose()` is the canonical startup and
  `defineStartup(spec)` is kept as sugar over `compose().define(spec)`.
- **Composable demand register (SLOT).** `demand` (problems / markets) is a registered but
  optional sixth primitive — a **type-level placeholder** (no implementation) bound only when
  a profile includes it. Reserved for `problems.org.ai` + a markets register.
- **lifecycle@1 — a versioned stategraph.** Replaces the linear forward-only walk with an
  explicit `STATEGRAPH` (`LIFECYCLE_VERSION === 1`) over six states (five live + terminal
  `dissolved`) and five edge kinds: `advance`, `revert`, `pivot` (re-idea-with-lineage),
  `dissolve`, `rename` (name leased, `$id` owned) — plus a `live` predicate (`isLive`).
- **Authority gating preserved per edge.** Each edge function still demands an unforgeable
  `@org.ai/authority` `Passed` token whose competence domain is pinned to that edge (advance:
  growth/product/money/delivery; revert: the undone edge's domain; pivot: growth; dissolve:
  legal; rename: schema) and whose principal is pinned to the tenant. Wrong-domain,
  wrong-tenant, and illegal-source edges are compile errors (verified under `vitest --typecheck`).

Tests, README, and the exported surface are updated; `pnpm build` + `pnpm test` are green.
