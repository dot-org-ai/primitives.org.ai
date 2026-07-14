// =====================================================================================
// @org.ai/authority — the corrected five-axis authority kernel (ADR 0081 FC1; extracted
// per ADR 0082 §B from the atlas incubation reference `app/_lib/sas/authority.ts` in
// explore.startups.studio).
//
// This is the FROZEN interface an ADR 0081 SHIP verdict adopts: the Register / Judgment /
// Authority factoring (round 1) with `Passed` UN-fused along five orthogonal axes —
// competence (D) x correlation (Corr) x principal/tenant (Prin) x time (Pending/Grant) x
// outcome-linkage (Accepted). Corrections C–H each cut a distinct axis; see the atlas
// `docs/adr/0081-*` §D–F and `docs/brainstorms/2026-07-13-studio-catalog-scoping/`.
//
// SOURCE + ROUND-3 CORRECTION. The signatures are the salvaged V2 interface (the atlas
// brainstorm's `harnesses/h-crack/interface-v2.ts`) with the ONE fix the V2 text omitted:
// `NoInfer` is completed on the covariant-only correlation params of the resolve/durable
// verbs — `resolvePending` (Corr, OutcomeD), `remint` (Corr, D) and `serialize` (D).
// Without it, Corr/OutcomeD/D are inferred from BOTH the pending/token AND the
// verdict/record and widen to a union, so a wrong-correlation verdict or a wrong-gate
// re-mint compiles SILENTLY (FINAL-VERDICT §(b); `probe1.ts`). This is a type-only /
// ambient interface module: it carries no runtime, it exists to pin the shape and anchor
// the standing type-canary harnesses under `harnesses/` (FC2). It is NOT imported at
// runtime by any consumer.
// =====================================================================================

// ===== 0. Competence domains (the checker axis) ======================================
export type Domain =
  | 'money' | 'merge' | 'quality' | 'schema' | 'legal' | 'growth' | 'product'
  | 'dispatch' | 'delivery' | 'attestation'   // physical + durable-human outcome domains

// ===== 1. PRINCIPAL / TENANT axis (Correction F) =====================================
// Branded so Principal<'A'> and Principal<'B'> are DISTINCT types. Authority tokens,
// seats, registers and software are all principal-tagged -> non-portable across tenants.
declare const TEN: unique symbol
export interface Principal<Id extends string = string> { readonly [TEN]: Id }
export declare function tenant<Id extends string>(id: Id): Principal<Id>

// ===== 2. Register / Identity (round-1 C1, now per (tenant, name)) ===================
export type RegisterKindMap = {
  finn: 'money-doctrine'; cara: 'customer-promise-memory'; mark: 'growth-doctrine'
  priya: 'product-hypothesis'; tom: 'merge-authority'; quinn: 'quality-rubric'
  // susan: intentionally ABSENT until admitted.
}
export type AgentName = keyof RegisterKindMap
export type KindOf<N extends AgentName> = RegisterKindMap[N]
export type RegisterKind = RegisterKindMap[AgentName] | 'open-risk-book' | 'schema-stewardship'

declare const REG: unique symbol
export interface Register<N extends AgentName, T extends Principal> {
  readonly [REG]: 'register'
  readonly owner: N
  readonly principal: T                    // register belongs to (tenant, name)
  readonly kind: KindOf<N>
  accrue(entry: RegisterEntry<T>): void     // accrual is tenant-bound: no cross-tenant write
}
export interface RegisterEntry<T extends Principal> { readonly principal: T; readonly at: number; readonly note: string }

// ===== 3. COMMIT-IDENTITY without register or authority (Correction C) ================
// Author<N> = a name + append-only authorship history. NO register, NO authority.
// Usable as a gate PERFORMER (identity-only). Pooled/stateless executors get one too.
export interface CommitRef { readonly sha: string; readonly at: number }
export interface Author<N extends string> { readonly author: N; readonly history: readonly CommitRef[] }
export declare function executor<N extends string>(name: N): Author<N>   // ralph/rae: identity, no register

// ===== 4. Judgment (advisory; stamps the register; no commit power) ==================
export interface JudgmentPoint<K extends RegisterKind> { readonly id: string; readonly accruesTo: K }
export interface Proposal<K extends RegisterKind, V> {
  readonly stampedBy: K
  readonly value: V
  readonly committed: false                 // proposals NEVER self-commit
}

// ===== 5. Agent = Register + Judgment + an Author projection (identity universal) =====
export interface Agent<N extends AgentName, T extends Principal> {
  readonly name: N
  readonly principal: T
  readonly author: Author<N>                            // identity is universal
  readonly register: Register<N, T>                     // exactly one, per (tenant, name)
  readonly owns: readonly JudgmentPoint<KindOf<N>>[]    // ALL judgments accrue to THE register
  propose<V>(jp: JudgmentPoint<KindOf<N>>, value: V): Proposal<KindOf<N>, V>
}

// RegisterBook<Tenant> — the per-tenant closed roster. A.finn and B.finn are DISTINCT.
export type RegisterBook<Tenant extends Principal> = { readonly [N in AgentName]: Agent<N, Tenant> }

// ===== 6. Seat = COMPETENCE axis, principal-tagged (Corrections B + F) ================
export type SeatName = AgentName | 'controller' | 'founder' | 'counsel' | 'cpa' | 'auditor'
export interface Seat<N extends SeatName, D extends Domain, P extends Principal> {
  readonly name: N; readonly domain: D; readonly principal: P
}

// ===== 7. The factored AUTHORITY token family ========================================
// Passed<D, Corr, Prin>: competence D x correlation Corr x principal Prin. Unforgeable.
declare const PASS: unique symbol
export interface Passed<D extends Domain, Corr extends string, Prin extends Principal> {
  readonly [PASS]: D
  readonly corr: Corr                       // links command-auth to outcome-auth (Correction E)
  readonly principal: Prin                  // non-portable (Correction F)
}

// Accepted<Corr, Prin>: outcome acceptance by an external, competence-LESS judge.
// DISTINCT from Passed<D> — cannot be laundered through the competence lattice (Correction D).
declare const ACCEPT: unique symbol
export type PricingBasis = 'outcome' | 'per-action' | 'consumption' | 'effort'
export interface Accepted<Corr extends string, Prin extends Principal> {
  readonly [ACCEPT]: 'accepted'
  readonly corr: Corr
  readonly principal: Prin
  readonly basis: PricingBasis
}

// DecisionRecord — signed, seat-stamped, durably persistable (Correction G).
export interface DecisionRecord<D extends Domain, Prin extends Principal> {
  readonly seat: SeatName
  readonly domain: D
  readonly principal: Prin
  readonly credentialProof: string          // signature / attestation blob (verified at runtime)
  readonly at: number
  readonly approved: boolean
}

// ===== 8. Gates: performer axis (identity) split from checker axis (competence) ======
export type GateDecision<D extends Domain, Corr extends string, Prin extends Principal> =
  | { readonly approved: true;  readonly pass: Passed<D, Corr, Prin> }
  | { readonly approved: false; readonly escalateTo: 'founder' | 'counsel' | 'cpa' }

export interface AuthorityGate<D extends Domain, Corr extends string, Prin extends Principal> {
  readonly domain: D
  readonly corr: Corr
  readonly principal: Prin
  decide(record: DecisionRecord<D, Prin>): GateDecision<D, Corr, Prin>   // NOT a bare boolean
}

// Episodic gate. performer = Author<PN> (IDENTITY ONLY). checker = Seat competent in D,
// name != performer, principal == gate's principal (SoD by (principal AND name), Correction F).
export declare function authorityGate<D extends Domain, PN extends string, Corr extends string, Prin extends Principal>(
  domain: D, corr: Corr, principal: Prin,
  performer: Author<PN>,
  checker: Seat<Exclude<SeatName, PN>, NoInfer<D>, NoInfer<Prin>>,
): AuthorityGate<D, Corr, Prin>

export declare function adversarialGate<D extends Domain, PN extends string, Corr extends string, Prin extends Principal>(
  domain: D, corr: Corr, principal: Prin,
  performer: Author<PN>,
  checkers: readonly [
    Seat<Exclude<SeatName, PN>, NoInfer<D>, NoInfer<Prin>>,
    Seat<Exclude<SeatName, PN>, NoInfer<D>, NoInfer<Prin>>,
    ...Seat<Exclude<SeatName, PN>, NoInfer<D>, NoInfer<Prin>>[],
  ],
): AuthorityGate<D, Corr, Prin>

// ===== 9. OUTCOME gate — external judge, Accepted token (Correction D) ================
export interface TerminalJudge<J extends string> { readonly judge: J }   // customer/founder; NO domain
export interface OutcomeGate<Corr extends string, Prin extends Principal> {
  readonly corr: Corr; readonly principal: Prin
  accept(judge: TerminalJudge<string>, verdict: boolean, basis: PricingBasis):
    { readonly accepted: true; readonly token: Accepted<Corr, Prin> }
    | { readonly accepted: false; readonly escalateTo: string }
}
export declare function outcomeGate<Corr extends string, Prin extends Principal>(
  corr: Corr, principal: Prin,
): OutcomeGate<Corr, Prin>

// ===== 10. Three-way COMMIT + correlation (Correction E) =============================
// Software is tenant-bound; commit matches the committing tenant's principal (Correction F).
export interface TenantBound<T extends Principal> { readonly principal: T }

declare const COMMIT: unique symbol
declare const PENDING: unique symbol
export interface Commitment<R> { readonly kind: 'committed'; readonly [COMMIT]: R }
export interface Pending<Corr extends string, OutcomeD extends Domain> {
  readonly kind: 'pending'
  readonly [PENDING]: Corr
  readonly awaiting: OutcomeD
  readonly validUntil: number               // observation-epoch validity horizon (TOCTOU)
}
export interface Escalation { readonly kind: 'escalated'; readonly escalatedTo: string }
export declare function escalate(to: string): Escalation

// Terminal digital command: outcome achieved at commit.
export declare function commitThroughSoftware<D extends Domain, Corr extends string, Prin extends Principal, R>(
  decision: GateDecision<D, Corr, Prin>,
  on: TenantBound<Prin>,
  effect: () => R,
): Commitment<R> | Escalation
// Async command: command committed, outcome OPEN -> Pending carrying Corr + horizon.
export declare function commitThroughSoftware<D extends Domain, Corr extends string, Prin extends Principal, OutcomeD extends Domain, R>(
  decision: GateDecision<D, Corr, Prin>,
  on: TenantBound<Prin>,
  effect: () => R,
  awaiting: { readonly outcome: OutcomeD; readonly validUntil: number },
): Pending<Corr, OutcomeD> | Escalation

// Close a Pending — ONLY a verdict carrying the SAME Corr resolves it. The verdict may be a
// competent Passed<OutcomeD> OR an external Accepted (Correction D composes with E).
//
// FC1 CORRECTION (round 3): `NoInfer` on the verdict pins Corr + OutcomeD to the PENDING.
// The verbatim V2 signature omitted it, so both params were inferred from the pending AND the
// verdict, widened to a union, and a wrong-corr / wrong-domain verdict resolved the wrong
// Pending SILENTLY. NoInfer closes E1/E3 (FINAL-VERDICT §(b)).
export declare function resolvePending<Corr extends string, OutcomeD extends Domain, Prin extends Principal, R>(
  pending: Pending<Corr, OutcomeD>,
  verdict: Passed<NoInfer<OutcomeD>, NoInfer<Corr>, Prin> | Accepted<NoInfer<Corr>, Prin>,
  on: TenantBound<Prin>,
  effect: () => R,
): Commitment<R> | Escalation

// ===== 11. DURABLE authority (Correction G) ==========================================
// A parked, serializable Passed. Carries the signed DecisionRecord. Re-mintable at resume
// ONLY by re-presenting the record to a gate that re-verifies competence + identity.
export interface SerializedPassed<D extends Domain, Corr extends string, Prin extends Principal> {
  readonly wire: 'passed'
  readonly domain: D
  readonly corr: Corr
  readonly principal: Prin
  readonly record: DecisionRecord<D, Prin>
}
// FC1 CORRECTION (round 3): `NoInfer<D>` pins the record's domain to the TOKEN being
// serialized — otherwise a mismatched-domain record widens D to a union and serializes onto
// the wrong token silently (FINAL-VERDICT §(b), G-verifier).
export declare function serialize<D extends Domain, Corr extends string, Prin extends Principal>(
  pass: Passed<D, Corr, Prin>, record: DecisionRecord<NoInfer<D>, Prin>,
): SerializedPassed<D, Corr, Prin>
// FC1 CORRECTION (round 3): `NoInfer<D>` + `NoInfer<Corr>` pin the parked token to the GATE
// identity — otherwise a wrong-gate (wrong auditor opinion / wrong corr) re-mints a parked
// token silently. This is the binding Correction G *claims* but only enforces once NoInfer
// is added (FINAL-VERDICT §(b), G-verifier).
export declare function remint<D extends Domain, Corr extends string, Prin extends Principal>(
  gate: AuthorityGate<D, Corr, Prin>, parked: SerializedPassed<NoInfer<D>, NoInfer<Corr>, Prin>,
): Passed<D, Corr, Prin> | Escalation      // runtime: re-verifies the signed record

// ===== 12. STANDING / DELEGATED authority (Correction H) =============================
// Grant<D> = { residual, validUntil, predicate }. Minted by ONE gate act, drawn by MANY
// stateless executors, revoked mid-flight by a Software tripwire (predicate IS the checker).
declare const GRANT: unique symbol
export interface Grant<D extends Domain, Corr extends string, Prin extends Principal> {
  readonly [GRANT]: D
  readonly corr: Corr
  readonly principal: Prin
  readonly residual: number
  readonly validUntil: number
  readonly predicate: () => boolean         // the delegated checker (tripwire invariant) — REQUIRED
}
export declare function grantFrom<D extends Domain, Corr extends string, Prin extends Principal>(
  decision: GateDecision<D, Corr, Prin>,
  residual: number, validUntil: number, predicate: () => boolean,
): Grant<D, Corr, Prin> | Escalation
// Consume against the residual. Returns a fresh Passed + the DECREMENTED grant to thread.
// blank-check laundering (one gate act -> unbounded spend) is impossible: the standing door
// only accepts a Grant, never a bare Passed.
export declare function commitFromGrant<D extends Domain, Corr extends string, Prin extends Principal, R>(
  grant: Grant<D, Corr, Prin>, amount: number, on: TenantBound<Prin>, effect: () => R,
): { readonly commitment: Commitment<R>; readonly residual: Grant<D, Corr, Prin> } | Escalation
export declare function revoke<D extends Domain, Corr extends string, Prin extends Principal>(
  grant: Grant<D, Corr, Prin>,
): Grant<D, Corr, Prin>                     // tripwire fires: residual -> 0

// ===== 13. Cross-tenant HANDOFF capability (Correction F) ============================
// Distinct from Passed: an Agent-Gateway / MCP handoff cannot unify with an internal commit.
declare const CAP: unique symbol
export interface Capability<D extends Domain, From extends Principal, To extends Principal> {
  readonly [CAP]: D; readonly from: From; readonly to: To; readonly scope: string
}
export declare function invokeAcrossTenant<D extends Domain, From extends Principal, To extends Principal, R>(
  cap: Capability<D, From, To>, on: TenantBound<To>, effect: () => R,
): Commitment<R>

// ===== 14. Software (durable state + deterministic ops; NO judgment) =================
// A minimal Software surface: durable, tenant-bound, no judgment. Each workflow shape brings
// its own richer Software surface (a Substrate / FieldStack / …) by extending TenantBound<T>.
export interface Stack<T extends Principal> extends TenantBound<T> {
  emit(name: string, data: Record<string, unknown>): void
}
export declare function stackOf<T extends Principal>(t: T): Stack<T>

// ===== 15. Roster construction (round-1 register admission) ==========================
export declare function makeAgent<N extends AgentName, T extends Principal>(
  name: N, principal: T, register: Register<N, T>, owns: readonly JudgmentPoint<KindOf<N>>[],
): Agent<N, T>
export declare function makeRegister<N extends AgentName, T extends Principal>(name: N, principal: T, kind: KindOf<N>): Register<N, T>
