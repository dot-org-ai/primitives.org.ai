# SYNTHESIS — FrameRole completeness probe

**Date:** 2026-06-01 · 4 lenses (linguistic · business-finance · agentic-governance · provenance-epistemics)

**Verdict: the committed 11 was under-represented — the probe found 4 high-confidence genuine additions (+1 medium), and strongly validated that all scalar *quantities* stay `data`.** All four lenses independently recommended the same meta-answer: **(b) a closed core + a `schema.org.ai`-namespaced extension path** — grow the core deliberately, never unboundedly.

## Lens scorecard

| Lens | Genuine additions found | Strongest rejection (validates discipline) |
|---|---|---|
| 1 · Linguistic | `purpose` (HIGH), `participant`/co-agent (MED) | amount/extent → data; experiencer→subject; product→result; material→source; negation/modality → proposition operators, not roles |
| 2 · Business/finance | **none** (zero finance-owned roles) | money IS `data` — `Money={bigint,currency}` value object; `Agreement` carries value/term/counterparty as *schema properties*; condition → `ProofPredicate` on the Thing |
| 3 · Agentic/governance | `purpose` (HIGH), `authority` (HIGH), `approver` (HIGH) | delegator→beneficiary∧authority; precondition→ProofPredicate; deadline/SLA/priority → Action-native scalar (like when/where); dependency→scheduler DAG |
| 4 · Provenance | `basis` (HIGH) | confidence/version→data; method/citation→basis.kind; wasInformedBy→why/cause; attribution→subject or authority |

## Genuine additions (survived the reduction test)

| Role | Conf. | Tier | Filler | Why it's irreducible | Grounding (already in codebase) |
|---|---|---|---|---|---|
| **`purpose`** | HIGH | universal adjunct | Goal Thing-ref | Forward-looking "in order to" — the twin of backward `why`/cause. PropBank keeps `ArgM-PRP` distinct from `ArgM-CAU`. Convergent: L1 (linguistic) + L3 (agentic "goal") landed on it independently → de-duped to one role `purpose`. | autonomous-agents `Goal`/OKR types |
| **`authority`** | HIGH | universal adjunct | AuthorityBoundary ref | "under whose authority" — the authorization basis an agent acts under; the gate reads it to route to HITL/KYC. Irreducible to instrument or the `how` oversight enum. | `business-as-code/finance/authority.ts` (12-tag catalog); ADR-0011 gatingBasis ceiling |
| **`approver`** | HIGH | universal adjunct | Person/Role ref | RACI-Accountable ≠ RACI-Responsible (`subject`). `how:human-approved` records *that* a human approved, not *which* — the legally load-bearing fact. | human-in-the-loop `ApprovalRequest.approver`, approver chains |
| **`basis`** | HIGH | universal adjunct | source fact(s) ref(s) | The grounding of a generated fact (PROV `wasDerivedFrom`/`used`; schema.org `isBasedOn`). Critical for LLM-composed Actions and collapse-provenance. NOT hypothetical — already a shipped indexed edge. | `rels.evidence_kind` (5-tier vocab); findOrCreate gate invariant #4 |
| `participant` / co-agent | MED | core valency | Thing ref | Joint/indirect actor — irreducible against the single-`subject` edge. Cross-lens demand: L2 noted counterparty would consume a general co-principal role. Weaker than the top 4. | schema.org `participant` |

## What was rejected (and why that's the point)

The probe's discipline is its value. **Scalar quantities are `data`, not roles** — amount, value, price, currency, confidence, priority, version, extent all stay typed fields. **Temporal/scalar targets are Action-native** like `when`/`where` — deadline/SLA, dueBy. **Structured conditions live on the Thing** — precondition/contingency → `ProofPredicate`. The business/finance lens producing *zero* role additions despite being the most "surely money needs a role" domain is the strongest validation that the taxonomy resists role-creep.

## Refined taxonomy (if all HIGH additions adopted)

- **Core valency** (per-Verb `Frame`): subject · object · recipient · beneficiary · source · destination · instrument · topic · result [· participant?]
- **Universal adjuncts** (any Action): when · where · how · why · **purpose** · **authority** · **approver** · **basis**

Core `roles` count: 11 → **15** (with the 4 HIGH adds), or 16 with `participant`. `when`/`where` remain Action-native; deadline/priority join them as Action-native scalars; quantities stay `data`.

## Flags for ADR-0012 / implementation

- **Live `types.ts` ships only 9 `FrameRole` literals** — `beneficiary` and `result` (named in the committed design) are NOT yet in the union, and `manner` is still a per-verb enum rather than the universal `how`. The code is behind the committed design; ADR-0012 records the migration to the full set.
- The 4 HIGH additions are all **gate/governance/provenance-relevant** — they connect to the parallel findOrCreate gate, ADR-0011's authority spine, and the collapse-provenance invariant. They are latent in the codebase already (shipped columns/types), not speculative.

## Recommendation
Adopt the 4 HIGH additions (`purpose`, `authority`, `approver`, `basis`) into the closed core (→ 15 roles); treat `participant` as optional (adopt only if joint-actor cases are common); commit to meta-answer **(b)**: closed core + a documented `schema.org.ai` extension path for domain-specific roles. Keep all quantities as `data` and scalar targets as Action-native fields.
