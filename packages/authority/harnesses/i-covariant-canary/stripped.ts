// =====================================================================================
// FC2 COVARIANT-PARAMETER CANARY — STRIPPED (guards removed). MUST FAIL to compile.
// Generated from corrected.ts by deleting every `@ts-expect-error` directive; the guarded
// covariant/brand defects now surface as real errors. Verified by tsconfig.stripped.json.
//
// A single, auditable harness that pins EVERY covariant `NoInfer<…>` site the resolve /
// durable / gate verbs depend on. Corrections C–H each proved ONE workflow shape; this file
// is orthogonal — it isolates each covariant type-parameter to exactly ONE axis so that the
// mutation self-test (`scripts/canary-mutation.mjs`) can strip a single site's `NoInfer`
// from a copy of `authority.ts` and prove the strip is CAUGHT here.
//
// Each guarded probe below differs from a fully-valid call in EXACTLY ONE axis (domain, corr,
// or tenant). With `NoInfer` present every guarded line is a real type error, so — per the
// two-sided convention — a clean EXIT 0 proves BOTH that the good path checks AND that every
//
// TWO CLASSES of site (the mutation test asserts each class distinctly):
//   • LOAD-BEARING (7 sites): removing the `NoInfer` widens the covariant param to a union and
//     fails. These are the FC1 fixes that slipped review three times.
//         authorityGate.D · adversarialGate.D · resolvePending.OutcomeD · resolvePending.Corr ·
//         serialize.D · remint.D · remint.Corr
//     (adversarialGate.D and remint.D are NOT individually pinned by the C–H pairs — this
//      harness is what closes those two coverage gaps.)
//   • BRAND-ANCHORED (2 sites): authorityGate.Prin / adversarialGate.Prin. The branded
//     `principal: Prin` argument is a naked source position that already fixes `Prin`, so the
//     cross-tenant lie is rejected by the BRAND regardless of `NoInfer<Prin>` — those two
//     `NoInfer`s are belt-and-suspenders (matches the FC1 note: "Prin … brand-caught"). The
//     `_agPrin` / `_advPrin` lines below are the brand guards: they keep firing with the site
//     stripped, which is exactly how the mutation test proves the redundancy is SAFE.
// =====================================================================================
import {
  type Principal, type Seat, type Passed, type Accepted, type DecisionRecord,
  type Pending, type SerializedPassed, type AuthorityGate, type TenantBound,
  authorityGate, adversarialGate, resolvePending, serialize, remint, executor, stackOf,
} from '../../src/index'

// ===== Fixtures =======================================================================
declare const A: Principal<'A'>
declare const B: Principal<'B'>
const perf = executor('ralph')                                     // Author<'ralph'> (identity-only performer)
const soft: TenantBound<Principal<'A'>> = stackOf(A)

// Seats — one right, plus one-axis-wrong variants.
const tomMerge: Seat<'tom', 'merge', Principal<'A'>> = { name: 'tom', domain: 'merge', principal: A }
const counselMerge: Seat<'counsel', 'merge', Principal<'A'>> = { name: 'counsel', domain: 'merge', principal: A }
const quinnQuality: Seat<'quinn', 'quality', Principal<'A'>> = { name: 'quinn', domain: 'quality', principal: A }   // wrong DOMAIN
const controllerB: Seat<'controller', 'merge', Principal<'B'>> = { name: 'controller', domain: 'merge', principal: B } // wrong TENANT

// resolvePending fixtures — pending awaits ('wo-1' × 'delivery').
declare const pending: Pending<'wo-1', 'delivery'>
declare const goodVerdict: Passed<'delivery', 'wo-1', Principal<'A'>>
declare const wrongDomainVerdict: Passed<'dispatch', 'wo-1', Principal<'A'>>   // corr matches, DOMAIN differs
declare const wrongCorrVerdict: Passed<'delivery', 'wo-9', Principal<'A'>>     // domain matches, CORR differs

// serialize / remint fixtures — token is ('attestation' × 'soc2').
declare const attPass: Passed<'attestation', 'soc2', Principal<'A'>>
declare const attRecord: DecisionRecord<'attestation', Principal<'A'>>
declare const moneyRecord: DecisionRecord<'money', Principal<'A'>>            // wrong DOMAIN record
declare const parkedAtt: SerializedPassed<'attestation', 'soc2', Principal<'A'>>
declare const gateAtt: AuthorityGate<'attestation', 'soc2', Principal<'A'>>   // right gate
declare const gateMoneySoc2: AuthorityGate<'money', 'soc2', Principal<'A'>>   // corr matches, DOMAIN differs
declare const gateAtt2027: AuthorityGate<'attestation', 'soc2-2027', Principal<'A'>> // domain matches, CORR differs

// ===== POSITIVE CONTROLS — the good path MUST compile (guards aren't just rejecting everything) ==
const _okGate = authorityGate('merge', 'c', A, perf, tomMerge)
const _okAdv = adversarialGate('merge', 'c', A, perf, [tomMerge, counselMerge])
const _okResolveDomain = resolvePending(pending, goodVerdict, soft, () => {})
const _okSerialize = serialize(attPass, attRecord)
const _okRemint = remint(gateAtt, parkedAtt)
void _okGate; void _okAdv; void _okResolveDomain; void _okSerialize; void _okRemint

// =====================================================================================
// LOAD-BEARING covariant sites — each strip un-breaks EXACTLY the matching line.
// =====================================================================================

// authorityGate.D — checker domain 'quality' != gate domain 'merge'. Strip NoInfer<D> and
// D widens to 'merge' | 'quality', so quinn's seat is accepted -> this line compiles.
const _agDomain = authorityGate('merge', 'c', A, perf, quinnQuality)

// adversarialGate.D — slot-1 checker domain 'quality' != gate domain 'merge' (COVERAGE GAP: the
// C–H pairs never pin the adversarial-tuple domain). Strip NoInfer<D> and it compiles.
const _advDomain = adversarialGate('merge', 'c', A, perf, [quinnQuality, tomMerge])

// resolvePending.OutcomeD — verdict domain 'dispatch' != awaited 'delivery' (corr matches).
// Strip NoInfer<OutcomeD> and OutcomeD widens to 'delivery' | 'dispatch' -> compiles.
const _rpDomain = resolvePending(pending, wrongDomainVerdict, soft, () => {})

// resolvePending.Corr — verdict corr 'wo-9' != pending corr 'wo-1' (domain matches). Strip
// NoInfer<Corr> (both the Passed and Accepted arms) and Corr widens to a union -> compiles.
const _rpCorr = resolvePending(pending, wrongCorrVerdict, soft, () => {})

// serialize.D — record domain 'money' != token domain 'attestation'. Strip NoInfer<D> and D
// widens to 'attestation' | 'money' -> the mismatched record serializes silently.
const _serDomain = serialize(attPass, moneyRecord)

// remint.D — gate domain 'money' != parked token domain 'attestation' (corr matches, COVERAGE
// GAP: g-durable's G4 only pins remint.Corr). Strip NoInfer<D> and D widens -> re-mints silently.
const _reDomain = remint(gateMoneySoc2, parkedAtt)

// remint.Corr — gate corr 'soc2-2027' != parked corr 'soc2' (domain matches). Strip NoInfer<Corr>
// and Corr widens -> a wrong-gate (later auditor opinion) re-mints silently.
const _reCorr = remint(gateAtt2027, parkedAtt)

// =====================================================================================
// BRAND-ANCHORED Prin sites — these lines are the cross-tenant SoD guard. They error via the
// branded Principal, INDEPENDENT of NoInfer<Prin>; stripping authorityGate.Prin /
// adversarialGate.Prin leaves them firing (that is how the mutation test proves the redundancy
// is safe: the cross-tenant lie stays rejected).
// =====================================================================================
const _agPrin = authorityGate('merge', 'c', A, perf, controllerB)
const _advPrin = adversarialGate('merge', 'c', A, perf, [controllerB, tomMerge])

void _agDomain; void _advDomain; void _rpDomain; void _rpCorr
void _serDomain; void _reDomain; void _reCorr; void _agPrin; void _advPrin
