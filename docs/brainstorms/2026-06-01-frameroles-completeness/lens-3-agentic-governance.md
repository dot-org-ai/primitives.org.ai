# Lens 3 — Agentic Execution / Process / Governance

**Probe:** does the committed `FrameRole` taxonomy under-represent what `autonomous-agents`, `digital-workers`, `human-in-the-loop`, and `digital-tasks` need in their Actions? **Region:** agentic execution & governance. **Method:** ground every candidate in actual codebase shapes, then apply the SEED reduction test (Real / Load-bearing-beyond-`data` / Irreducible) ruthlessly.

A note on the baseline. types.ts ships **9** `FrameRole` literals (`subject object recipient source destination instrument topic cause manner`); SEED describes **11** by adding `beneficiary` + `result` and counting the Action-native adjuncts (`how`=manner, `why`=cause, `when`, `where`). I test against the SEED-11 plus the `manner` oversight enum (`autonomous|supervised|human-approved|escalated`), since that enum is the package's current way of encoding governance and is the thing my candidates must beat.

---

## 1. purpose / goal / objective ("in order to")

**Definition.** PropBank distinguishes **ArgM-PRP** (purpose — *forward-looking*, "the motivation for an action," `stayed home **to recover**`) from **ArgM-CAU** (cause — *backward-looking*, "the reason something happened," `**because I was sick**, I stayed home`). Our `why`/`cause` role is explicitly defined as "cause — an Action ref" (a *prior* Action that triggered this one). Purpose is its mirror: the *future end-state* the Action is performed toward.

**Concrete digital-object Actions.**
- An agent `enrich`es a Startup `in order to` advance Goal `g-revenue-q3` (`autonomous-agents` `Goal{ id, target, deadline }`, `AgentConfig.goals`). The Goal is a first-class Thing; the Action is *for* it.
- `digital-tasks` `TaskData` carries no purpose field but a Task is created `to satisfy` a parent Goal/OKR; `business-as-code` OKRs are the default Revenue/Growth/Profit objectives every agent action ladders up to.
- A `delegate(fromAgent, toAgent, task)` Action's purpose is the parent Goal, *not* its cause (the cause is "manager asked"; the purpose is "ship the feature").

**Reduction test.** *Real* — yes; Goal/OKR are Things, and the whole agentic stack is teleological (agents exist to advance goals). *Load-bearing* — yes, and it beats `data`: purpose is a **ref to a Thing** (a Goal), so it is graph-queryable ("show every Action advancing goal X" = goal burn-down, attribution, abandonment detection), exactly the kind of edge `roles` exists to carry; stuffing a goal-id in `data` loses the edge. *Irreducible* — this is the sharp one. Does purpose collapse into `cause`/`why`? **No** — PropBank, the canonical authority, keeps PRP and CAU as distinct ArgM modifiers precisely because direction differs (future end vs. past trigger). Does it collapse into `beneficiary`? No — the beneficiary is *who* gains; the purpose is *what end-state*. A founder (beneficiary) benefits from an Action whose purpose is a revenue Goal. Different fillers, different prepositions ("for X" vs "in order to Y").

**Verdict: KEEP — confidence HIGH.** This is the single most defensible gap. It is a Thing-ref edge (Action→Goal), it is the backbone of an agent economy, and the linguistic prior art (PropBank PRP≠CAU) refuses the reduction to `cause`. Name `purpose`, preposition "in order to", fillerKind `thing` (a Goal/OKR/Objective Noun), dereference `get`.

---

## 2. authority / under-authority-of (the authorization basis)

**Definition.** The authorization basis an agent acts *under* — the license, scope, or boundary that makes the Action legitimate. `business-as-code/finance/authority.ts` ships exactly this as `AuthorityBoundaryRef`: a 12-tag catalog (`cpa-attest`, `jd-bar-admitted`, `md-licensed`, `fiduciary-investment-advice`, `kyc-aml-required`, … + sentinels `self-only`/`tenant-only`) with policy hints `{ regulated, requiresHumanSign, requiresKYC }`. `AgentIdentity.scopes` (OAuth/capability scopes) is the per-agent version.

**Concrete digital-object Actions.**
- An agent `file`s a tax return **under `cpa-attest`** authority; the gate reads the tag → `requiresHumanSign: true` → routes to HITL. The Action is *invalid* without the authority filler.
- An agent `recommend`s a security **under `fiduciary-investment-advice`**; same gate, different boundary.
- `AgentIdentity.scopes: ['payments.write']` is the authority an agent `pay`s under (capability-based, `digital-tools` `AuthBroker.gate(req, need)`).

**Reduction test.** *Real* — yes; `authority.ts` is shipped, with a gate that *reads it to route*. *Load-bearing* — emphatically: this is the canonical example of a **gate-relevant** role (SEED's test-2 wording). The realizer/gate must reason over it exhaustively (regulated→HITL, KYC→identity check). `data` cannot serve because the substrate "enforces gating + HITL routing per tag" — it must be a typed, queryable slot, not opaque payload. *Irreducible* — does it collapse into `instrument` (with/via)? Tempting — authority is "the thing the act is done *through*." But `instrument` is a Tool/means (the API, the model); authority is a *normative permission*, not a tool. You can have the instrument and lack the authority (an unlicensed agent with a working tax API). Does it collapse into `how`/`manner`? The `manner` oversight enum encodes *how much supervision* (autonomous/supervised/…), not *what license*. Orthogonal: a `cpa-attest` Action can be `autonomous` or `escalated`.

**Verdict: KEEP — confidence HIGH.** Strongest governance candidate. It is shipped, gate-bearing, and irreducible to instrument/manner. Name `authority` (or `underAuthorityOf`), preposition "under authority of", fillerKind could be `literal` (the `AuthorityBoundaryRef` tag) *or* `thing` (an Authority/License Noun) — recommend `thing` so licenses are first-class graph nodes (who-holds-what-license queries). This is also the natural home for `gatingBasis` ceilings from the oversight taxonomy.

---

## 3. approver / authorizer (who signed off)

**Definition.** The party who **authorized/signed off** an Action — distinct from who *performed* it. RACI nails this: **Responsible** = "the one doing the actual work" vs **Accountable** = "a *single* person who must answer for and sign off on the deliverable … and deal with the consequences." Our `subject` is RACI-Responsible; there is no slot for RACI-Accountable. The codebase has this everywhere: `ApprovalRequest.approver` / `approvers[]`, `ApprovalResult.approver`, `HumanRequest.respondedBy`, `ProofPredicate.HumanSign({ signerRoles })`, `SignOffMode = none|self|peer|human|panel`.

**Concrete digital-object Actions.**
- An agent `publish`es an Offer; **approver = `cfo@co`** (`$generation:'review'` Nouns route generated drafts through HITL sign-off — directly from the hardening plan).
- A `refund` Action `issuedBy` agent but **approvedBy** a human under SLA (`business-as-code/finance/sla.ts` auto-credit/escalate).
- `cpa-attest` output: subject = the drafting agent, approver = the CPA whose signature makes it bind (`HumanSign.signerRoles`).

**Reduction test.** *Real* — yes, pervasive. *Load-bearing* — yes: audit/compliance queries ("who signed off action X", "show all actions a CPA approved") are the reason an audit trail exists; it is a queryable Thing-ref edge, beating `data`. *Irreducible* — the SEED warning: is approver just "a second `subject`"? **No.** RACI's whole point is Responsible≠Accountable and there is exactly *one* Accountable. Two distinct fillers, two distinct prepositions ("by X" / "approved by Y"), distinct query semantics (the approver bears liability, the subject bears execution). Is it `how: human-approved`? The `manner` enum tells you *that* a human approved (a mode); it cannot tell you *which* human/role — and "which human" is the legally load-bearing fact. So `how` records the gate fired; `approver` records who closed it. Complementary, not redundant.

**Verdict: KEEP — confidence HIGH.** The RACI-Accountable slot. Name `approver` (or `authorizer`), preposition "approved by", fillerKind `thing` (a Person/Role/Agent), dereference `get`. Note: a full RACI would also want **consulted**/**informed**, but those are weaker (see §8) — `approver` is the one with teeth.

---

## 4. delegator / on-behalf-of-principal

**Definition.** When an agent acts *on behalf of* a principal (the human/org whose authority and interest it carries). `business-as-code/finance/identity.ts` ships `AgentIdentity.delegatedFor` ("when the agent buys on behalf of someone else — B2A2D, B2A2B; null when buying for self"). `autonomous-agents` `delegate(fromAgentId, toAgentId, task)` and `business-as-code` `canDelegateTask(role, taskType)` are the org-internal version.

**Concrete digital-object Actions.**
- An agent `purchase`s a SaaS seat **on behalf of `acme-corp`** (`delegatedFor: 'acme-corp'`). The principal, not the agent, is bound and billed.
- A `negotiate` Action where the subject is a procurement agent acting **for** the CFO (principal).

**Reduction test.** *Real* — yes (shipped `delegatedFor`). *Load-bearing* — yes for agentic commerce (who is *bound*, who *pays*). *Irreducible* — **this is where I reject hard.** Does the principal collapse into `beneficiary`? In the overwhelming majority of cases **yes** — "on behalf of X" means X is who-it's-for, which is exactly `beneficiary` ("for-whom"). `delegatedFor` semantically *is* the beneficiary of the purchase. The residual distinct case — principal ≠ beneficiary (an agent acting *under* A's authority but *for* B's benefit) — is real but rare, and when it occurs it decomposes cleanly into `authority` (§2, whose permission) + `beneficiary` (whose interest). So delegation is not a *new* role; it is the *conjunction* of two roles we (will) have.

**Verdict: MAP-TO-EXISTING (`beneficiary`, + `authority` for the authority-bearing half) — confidence MEDIUM-HIGH.** Keep the *concept* documented as "delegation = beneficiary ∧ authority"; do not add a `principal` role.

---

## 5. precondition / trigger (what gated/fired the Action)

**Definition.** The condition or event that had to hold before the Action could fire. BPMN models this as the **trigger/condition on a start or intermediate event**; `digital-tasks` has `TaskStatus: 'blocked'` and `TaskDependency{ type:'blocked_by', taskId, satisfied }`; HITL `EscalationPolicy` fires on a timeout condition.

**Reduction test.** *Real* — yes. *Irreducible* — the "trigger as a prior event" reading is **already `cause`/`why`** (an Action ref — the thing that *triggered* this one). The "precondition as a data predicate" reading ("fired because balance > $0") is a **typed predicate over `data`**, and `business-as-code/finance` already owns predicates as `ProofPredicate` (a structured value, not a role-edge). So trigger→`cause`, precondition→`data`/`ProofPredicate`. No new role survives.

**Verdict: MAP-TO-EXISTING (`cause`) / REJECT (precondition→data) — confidence HIGH.**

---

## 6. deadline / dueBy / SLA (future temporal target)

**Definition.** A *future* time the Action must complete by — distinct from `when` (Action-native `createdAt`/`completedAt`, which are *observed* times). Shipped widely: `Goal.deadline`, `TaskData.deadline`/`scheduledFor`, HITL `SLATracker`/`SLAConfig.deadlineMs` + priority-based SLA tiers + `sortByPriorityThenSLA`.

**Reduction test.** *Real* — yes, very. *Load-bearing* — borderline. SLA proximity *drives queue ordering* (HITL `sortByPriorityThenSLA`), which is real behavior. *Irreducible* — but a deadline is a **scalar literal (a timestamp/duration), not an edge to a Thing.** It plays no SVO complement role — there is no "the agent escalated the request *to* `2026-06-30`" reading where the date is a participant; the date is an *attribute of the request*. The reduction test's purpose is to keep typed-scalar attributes in `data` (or in this case a first-class `Action.deadline` field alongside `completedAt`, mirroring how `when`/`where` are Action-native fields, *not* `FrameRole`s). Adding it to the role taxonomy would be the exact "typed-data masquerading as a role" error SEED warns against.

**Verdict: REJECT as a FrameRole; recommend an Action-native field (`dueBy?: Date`) parallel to the `when`/`where` treatment — confidence HIGH.** SLA *policy* (warn/violate/escalate behavior) is `business-as-code` `SLAPolicy`, not a role.

---

## 7. priority / severity

**Definition.** Urgency/importance ranking. Shipped as a closed enum almost identically in four packages: `autonomous-agents` `Priority='low|medium|high|urgent'`, HITL `'low|normal|high|critical'`, `digital-tasks` `TaskPriority='low|normal|high|urgent|critical'`.

**Reduction test.** *Real* — yes. *Irreducible* — **no.** Priority is a closed scalar enum that is an *attribute of the task/request*, not a relation between the Action and a participant. There is no preposition, no filler-Thing, no edge. It is the textbook `data` (or a typed scalar field on the task Thing). It drives sorting, but so does `createdAt` — sortability does not make something a role.

**Verdict: REJECT (→ `data` / typed scalar field) — confidence HIGH.**

---

## 8. dependency / blocks / blockedBy (between Actions)

**Definition.** Ordering/blocking relations *between Actions/Tasks*. Shipped: `TaskDependency{ type:'blocked_by', taskId, satisfied }`; the hardening plan's schedule seam runs "staged dependency-wave execution" with cycle detection.

**Reduction test.** *Real* — yes. *Load-bearing* — yes (the scheduler walks these edges; punch-list item #1 is cycle detection over them). *Irreducible* — this is a genuine **Action→Action edge**, which is structurally like `cause` (also an Action ref). `cause`/`why` already carries "Action A happened because of Action B." `blocked_by` is arguably the *same relation viewed prospectively* (B must finish before A) vs. `cause` retrospectively (A happened because B did). They're close but not identical: `cause` is "B made A happen"; `blocked_by` is "A *cannot* happen until B does" (a gating dependency that may never resolve). Still, I judge this **better modeled as a first-class Action↔Action relation in the scheduler / `digital-tasks` graph than as a `FrameRole` complement** — it is not an SVO complement of a single verb (no "the agent enrich-ed *blocked-by* X" surface), it is an inter-Action DAG edge. The Frame taxonomy is about a verb's *complements*, not the workflow DAG.

**Verdict: MAP-TO-EXISTING-LAYER (scheduler/Task DAG, adjacent to `cause`) — confidence MEDIUM-HIGH.** Don't add to `FrameRole`; it lives in the schedule seam.

---

## Ranked shortlist of genuine additions

| # | Role | Verdict | Confidence | One-line justification |
|---|------|---------|-----------|------------------------|
| 1 | **`purpose`** ("in order to" → Goal/OKR) | KEEP | HIGH | PropBank PRP≠CAU; a Thing-ref edge (Action→Goal) `cause` cannot carry; backbone of a teleological agent economy. |
| 2 | **`authority`** (under-authority-of → AuthorityBoundary/License) | KEEP | HIGH | Already shipped + gate-reads-to-route; the canonical gate-relevant role; irreducible to instrument/manner. |
| 3 | **`approver`** (approved-by → Person/Role) | KEEP | HIGH | RACI-Accountable ≠ Responsible(`subject`); legally load-bearing "which signer"; `how:human-approved` only records *that*, not *who*. |

Everything else **reduces**: `delegator`→`beneficiary`∧`authority`; `precondition`→`data`/`ProofPredicate`, `trigger`→`cause`; `deadline/SLA`→Action-native scalar field (like `when`); `priority`→`data`/typed scalar; `dependency/blockedBy`→scheduler Action-DAG (adjacent to `cause`), not a verb complement.

These three additions take the role-taxonomy from SEED-11 to **14**, all in the same shape as existing roles (Thing-ref edges with a preposition and a clear query). Note the trio is internally coherent: `purpose` (what end), `authority` (under whose permission), `approver` (who signed off) are the three governance facets a single high-stakes agent Action needs that pure SVO + cause/manner cannot express — *for* what, *under* what license, signed-off-by whom.

## Meta-question recommendation: **(b) closed core + documented `schema.org.ai` extension path**

Add `purpose`, `authority`, `approver` to the **closed core** now — they are domain-general (every agentic Action is teleological, permissioned, and auditable), they are Thing-ref edges the realizer/gate must reason over exhaustively, and they are already shipped as types elsewhere. But this lens *also* surfaced the boundary the closed-set model can't hold: `priority`, `deadline`, `severity` are real, queried, behavior-driving — yet they are **typed scalars, not role-edges**, and they vary by domain (SLA tiers differ per vertical). Forcing them into `FrameRole` would corrupt the taxonomy with non-relational attributes; banning them entirely loses real governance signal. The clean resolution is the same split the package already uses for `when`/`where`: **role-edges (Thing-refs with prepositions) stay in the closed `FrameRole` core; temporal/scalar attributes become Action-native fields (`dueBy`, `priority`) or `data`; and a `schema.org.ai`-namespaced extension path** lets a regulated vertical declare e.g. a domain-specific `attestingAuthority` subtype of `authority` without reopening the core. Closed core for the relations the engine reasons over exhaustively; documented extension for the long tail. The core grows by *three*; it should not grow unboundedly.

---

**Sources:** [PropBank Annotation Guidelines (Babko-Malaya, LDC)](https://catalog.ldc.upenn.edu/docs/LDC2007T21/propbank/english-propbank.pdf) · [English PropBank Annotation Guidelines (Bonial, Colorado)](https://verbs.colorado.edu/propbank/EPB-Annotation-Guidelines.pdf) · [Responsibility assignment matrix (RACI) — Wikipedia](https://en.wikipedia.org/wiki/Responsibility_assignment_matrix) · [RACI: Consulted and Informed (Triaster)](https://blog.triaster.co.uk/blog/responsible-accountable-consulted-informed-raci-matrix)
