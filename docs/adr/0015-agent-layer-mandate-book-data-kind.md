# The Agent layer: AgentDefinition/AgentInstance, Mandate + Book, the `data` kind, and the effect-class grid

**Status:** proposed — ratified on merge (Nathan Clevenger)
**Date:** 2026-07-19
**Source:** grill-series session 3 ("the Interface Freeze"), ratified in-session; rulings in stack vault `specs/drivly-rebuild/RULINGS-2026-07-19-SESSION-3.md` (R-v…R-ac) + the frozen `W0-EVT.md` event contract. Design synthesis: stack vault `specs/drivly-rebuild/AGENT-DEFINITION-LAYER.md` (correction pass applying this ADR runs alongside).
**Companion posture:** this PR also flips **ADR-0011** (accepted, amended: `DeliverableKind` becomes the quartet; `Agent()` recorded as `Service()`'s sibling) and **ADR-0013** (accepted, untouched — `VerbParticipation` is a new binder, not an amendment). The X1 weekend fleet builds against accepted paper only.

## Context

Workers, verbs, and Deliverables exist, but "what may the stip verifier ever do" had no answer that survives a redeploy. The synthesized agent-layer design (deliverable-trio skeleton + worker-protocol instance shape + authority-customer ceiling law) needed a ratification pass; Book and Mandate (minted R-h via the portfolio battery) needed final shapes; the `data` fourth kind (ratified at studio scope, R-j) needed primitives-grain admission. Session 3 ran every contested surface through named objects (cfo.do, finn.do, the wholesale desk, Acme Motors' Finn fork, the Manheim proxy bidder) and the six-venue battery.

## Decision

### 1. AgentDefinition / AgentInstance (genotype / phenotype)

As synthesized in AGENT-DEFINITION-LAYER.md, with these ratified amendments:

- **Definitions declare `ToolNeed`s; only instances hold `GrantEdge`s.** Grant law: `grant(instance, request)` commits iff `request ⊆ definition.needs[tool].admits`.
- **The transitive ⊆-law (new):** when an agent grants (agent-as-grantor chains), the sub-grant must fit within the grantor's own grants — the ⊆-check applies down the whole chain. Without it the chain is a privilege-escalation ladder.
- **The manager pattern** (worked example: cfo.do): a SKU over a `financial-manager` definition whose deputized instance sub-grants mandate-scoped authority to lattice-sibling instances (bookkeeper: record, no spend; treasurer: the Mandate; forecaster: read-only). Separation of duties is enforced by grant topology, not lint.
- **Team is an overlay, never a principal.** No `team_…` species. A team = a versioned stategraph whose nodes are deputized instances and whose gates are evaluator panels (deterministic workflow wrapping non-deterministic agents). The operating sub-Book's principal is the company; the manager instance holds the Mandate. Acts attribute up the deputization chain.
- **`skin` → `persona`** (field on `AgentSku`); the presentational sense is *lens*. SKUs may re-persona name and voice; never contract, oversight, or grants.
- **Named agents are storefronts, not SKUs** — G4 offer surfaces listing N single-definition SKUs sharing one `PersonaRef`; storefronts sell **Offers** of any `DeliverableKind` (finn.do/bookkeeping = agent SKU; finn.do/balance-sheet = a `data` deliverable). Purchase mints a deputy into the tenant's team. The SKU law (narrows, never widens) is untouched. Canonical home = `agents.do/{slug}`; premium zones are doors (rel=canonical), never identity-bearing.
- **Comms identity binds to the instance** (email/Slack/phone provisioned at mint against the instance's `agent_…` id) — never to persona or SKU.
- **Derived definitions** are the tenant-customization mechanism: a customer (human or agent) adjusting roles/responsibilities/context/tools mints a tenant-scoped fork (`financial-manager+acme@1 extends financial-manager@2`); the instance re-pins (identity, track record, grants persist). The ⊆-check is never loosened — new grants commit against the derived admits.
- **The width/posture guardrail:** forks move authority *width* (tools, context, responsibilities, send windows to the regulatory wall, budgets); forks never touch *posture* (SoD constraints, archetype-mandated oversight floors, mandate tripwires). Width is the tenant's; posture is the platform's. Every refused posture-loosening has a legitimate route elsewhere (trust → TrackRecord/PromotionPolicy on the instance; cap friction → a bigger Mandate up the grantor chain).
- **The definition/instance law, stated once:** OrgRole : Worker :: Process : Task :: AgentDefinition : AgentInstance. Genotype = knowledge with identity, versioned, never principal-bearing; phenotype = the executing occurrence holding state and authority.
- **The link law:** a GET may start a session; it may never cross the membrane. External mutation from a GET-born session requires a standing Mandate or an explicit approve. Anonymous GET = ephemeral zero-grant session (attestation ladder rung 1).

### 2. Book and Mandate (final shapes)

```ts
interface Book {
  $id: `book_${string}`
  principal: `human_${string}` | `agent_${string}` | `company_${string}`
  parent?: `book_${string}`   // books nest: desk, pod, fund = sub-books
}

interface Measure { amount: number; unit: string }  // Money = the Measure whose unit is a currency

interface Mandate {
  $id: `mandate_${string}`
  book: `book_${string}`
  grantor: `human_${string}` | `agent_${string}`
  ceiling: Measure            // Money is one Measure; send quotas and position limits are Measures too
  perActionCap?: Measure
  expiresAt?: string          // time-box: mandatory posture
  tripwires: readonly Tripwire[]
  revoked?: string            // revocation is first-class, never deletion
}
// GrantEdge gains: mandate?: `mandate_${string}` — the edge charges the pool
```

- **Pool and conduit** (amends R-h's sentence): *a durable GrantEdge always charges a Mandate — the Mandate is the pool, the edge is the conduit.* One ceiling can back many tool edges (the desk's $500k week spans bids and transport); the limit order is the one-edge degenerate case.
- **The encumbrance trio, all derived, none stored:** ceiling (stored) − *encumbered* (open-commitments projection) − *settled* (settlement-stream projection) = **`available`** (the lens). The term "residual" is dead at this layer (it conflated the trio, and it collides with lease residual value in the automotive vertical, which keeps the word).
- **Mandate conjugations** (evidence register): limit order, Manheim proxy bid, CPL ad ceiling, fund mandate, floor-plan line, send quota, **power of attorney** (an agent signing under POA cites it), **issued card** (spending controls = ceiling + perActionCap; freeze = revocation). A Treasury financial account is a Book's external shadow; every issued card is mandate-scoped or it doesn't exist — cost-side completeness survives at external edges.

### 3. The `data` kind and the effect-class grid

- **`DeliverableKind` = `'service-as-software' | 'agent' | 'software' | 'data'`** — the quartet, primitives grain. The data contract on `outcomeContract` is four fields: **schema / coverage / freshness / provenance**, provenance carrying the assurance grade (attested provenance prices above best-effort — the oversight→pricing ceiling's data twin).
- **Effect classes** (on `ToolNeed` / acts): **read** (touches nothing; productized read = the data kind) / **record** (writes a system of record) / **act** (irreversible world-effects that consume something). Orthogonal **binding locus**, decided at activation and never in the definition: *house* (silent provision) | *external* (an adapter-runtime row, a ConnectFlow). Derivations: authority gradient (read = grant-light; record = scoped grants; act = Mandate or explicit approve, always), link-law enforcement, activation behavior per cell, verifier testability gradient (read = golden-answer deterministic; record = state-assertion; act = sandbox/contract-only).

### 4. Activation (annex)

`deriveOnboarding(definition)`: the `needs` array is simultaneously the ⊆-ceiling, the "what may it ever do" answer, and the onboarding generator (shipped referent: carriage's `toolPermissions → deriveIntegrationRequirements() → ConnectFlow → ToolConnection`). Activation is the universal G4→G5 crossing; the waitlist verdict is a lookup (`blockers = derivedRequirements − registeredAdapterCatalog`); a waitlisted tenant is a parked activation whose stored config completes with zero re-asking when the blocking adapter row registers; the blocker histogram is the adapter roadmap.

### 5. Evaluator separation of powers

**@org.ai/evaluator** = court of first instance (internal kernel: panels, oversight modes, escalation, golden-scenario gates). **autonomous-qa** = court of appeal (independent verifier, deliberately unscoped; verifies against published contracts held outside the fleet's write access; can fail what the internal evaluator passed, never vice versa). **api.qa** = its service domain. Acceptance = internal green necessary, api.qa green sufficient.

### 6. Events

The frozen event contract lives at stack vault `specs/drivly-rebuild/W0-EVT.md`: grammar `{noun}.{pastTenseVerb}@{n}` (whole type string lowercase; no generic change events — subject-scoped subscription IS `deal.updated`); envelope with required attested `who` (policy-fired events attribute to the instance whose policy fired); **`authority` required on act-class events iff the actor acts under delegation** (`who ≠ book.principal` — any agent, or a human under a mandate; omitted when the actor is the principal acting for themselves: authority is identity, not a grant; capture defaults to the actor's sole active mandate on the target book); bitemporal `occurredAt`/`recordedAt` (EPCIS eventTime/recordTime verbatim); append-only corrections via `causation`; singular `correlation` (flagged); and the lens doctrine (native spine; EPCIS / CloudEvents / schema:Action / Activity Streams / journal / OTel as seam-mapped renderings).

## Consequences

- The X1 weekend fleet has a frozen interface layer: this ADR + AGENT-DEFINITION-LAYER.md (corrected) + W0-EVT.md.
- `autonomous-agents` gets its answer: implement §1–2 shapes at functional completeness (in-memory registry, mint/grant/revoke with the transitive ⊆-check, verb dispatch honoring participation, the golden-scenario hook).
- autonomous-qa's pinned-spec harness digests W0-EVT + the golden-scenario contract as its first published-contract set.
- Vocabulary enters org.ai CONTEXT.md only when referents ship (ground rule 2): Mandate, Book, available, effect classes, Activation all wait for the weekend's referents.
- Disposition rows carried forward: `GrantEdge` vs kernel `Grant<D,Corr,Prin>`; `Agent` vs kernel `Agent<N,T>`; `class` on AgentDefinition stays an unlocked hint pending a second binder.

## Rejected

Grants on definitions; worker-by-composition; `team_…` as a species; plural correlation (ships singular, flagged); stored post-state/disposition; stored `residual`; role-domain canonical (the estate is incomplete by construction — a canon with holes isn't a canon).
