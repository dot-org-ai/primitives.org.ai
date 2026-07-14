// =====================================================================================
// CORRECTION H — standing / delegated authority (paid-acquisition FREE-mode).
// Ported to import the REAL frozen kernel (`@org.ai/authority`). "Thousands/sec autonomous
// buys under ONE standing envelope; tripwire auto-degrade on CAC breach." ONE gate act mints
// ONE Grant; a fleet of STATELESS executors draws it down against the residual; the tripwire
// revokes mid-flight. Two-sided harness: every guarded line MUST error (an unused expect-error
// directive is itself TS2578), so EXIT 0 proves the honest path checks AND every laundering
// attack is a real type error.
// =====================================================================================
import {
  type Principal, type RegisterBook, type Grant, type GateDecision, type Commitment,
  type Escalation, type Passed, type Seat, type DecisionRecord, type Stack,
  authorityGate, grantFrom, commitFromGrant, revoke, stackOf,
} from '../../src/index'

declare const A: Principal<'A'>
declare const B: Principal<'B'>
declare const rosterA: RegisterBook<Principal<'A'>>
declare const cacBelowThreshold: () => boolean

const markA = rosterA.mark                 // Agent<'mark', Principal<'A'>> — growth register owner
const stackA: Stack<Principal<'A'>> = stackOf(A)
const stackB: Stack<Principal<'B'>> = stackOf(B)

// growth-competent, non-mark checker of THIS tenant (founder holds the growth ROE seat)
const growthChecker: Seat<'founder', 'growth', Principal<'A'>> =
  { name: 'founder', domain: 'growth', principal: A }

// =====================================================================================
// GOOD PATH — the honest FREE-mode envelope. ONE gate act mints ONE Grant; a fleet of
// STATELESS executors draws it down against the residual; the tripwire revokes mid-flight.
// =====================================================================================
const adsGate = authorityGate('growth', 'ads-q3-freemode', A, markA.author, growthChecker)
const adsRecord: DecisionRecord<'growth', Principal<'A'>> = {
  seat: 'founder', domain: 'growth', principal: A,
  credentialProof: 'roe-sig', at: 0, approved: true,
}

// A STATELESS executor: a pure (grant) -> step function. It captures NO gate, NO decision,
// NO agent. Thousands can run in parallel; each is handed only the current grant token.
type Step =
  | { readonly commitment: Commitment<void>; readonly residual: Grant<'growth', 'ads-q3-freemode', Principal<'A'>> }
  | Escalation
function statelessBuy(
  grant: Grant<'growth', 'ads-q3-freemode', Principal<'A'>>,
  i: number,
): Step {
  return commitFromGrant(grant, 200, stackA, () => stackA.emit('ad_buy', { i }))
}

function runFreeMode(): void {
  const d = adsGate.decide(adsRecord)
  if (!d.approved) return

  // Grant MINTED ONCE. residual budget = 5_000; expiry horizon; predicate = tripwire = the
  // delegated checker (a continuously-evaluated Software invariant, NOT a Seat).
  const g0 = grantFrom(d, 5_000, 9_999, () => cacBelowThreshold())
  if ('escalatedTo' in g0) return

  // DRAWN DOWN BY MANY stateless executors. No gate per buy. The residual is threaded
  // by value; the tripwire revokes mid-flight on CAC breach (auto-degrade to $0 residual).
  let grant: Grant<'growth', 'ads-q3-freemode', Principal<'A'>> = g0
  for (let i = 0; i < 5_000; i++) {
    if (!grant.predicate()) { grant = revoke(grant); break }   // tripwire fires -> residual 0
    const step = statelessBuy(grant, i)
    if ('escalatedTo' in step) { grant = revoke(grant); break }
    grant = step.residual                                       // thread the decremented grant
  }
}
void runFreeMode

// =====================================================================================
// FALSIFICATION HARNESS — Correction H. Every guarded line MUST error.
// =====================================================================================
declare const decisionA: GateDecision<'growth', 'ads-q3-freemode', Principal<'A'>>
declare const passA: Passed<'growth', 'ads-q3-freemode', Principal<'A'>>
declare const grantA: Grant<'growth', 'ads-q3-freemode', Principal<'A'>>

// ----- (H1) blank-check laundering: mint once, smuggle a BARE PASSED into every buy -----
const _h1 = commitFromGrant(passA, 200, stackA, () => {})

// ----- (H2) tripwire-less delegation: a Grant MUST carry its predicate (the checker) -----
const _h2 = grantFrom(decisionA, 5_000, 9_999)

// ----- (H3, H×F) the standing envelope is NON-PORTABLE across tenants -----
const _h3 = commitFromGrant(grantA, 200, stackB, () => {})

// ----- (H4) the Grant brand is UNFORGEABLE — you cannot hand-build a blank check -----
const _h4: Grant<'growth', 'ads-q3-freemode', Principal<'A'>> = {
  corr: 'ads-q3-freemode', principal: A, residual: Number.MAX_SAFE_INTEGER,
  validUntil: 9_999, predicate: () => true,
}

// ----- (H5) the tripwire must be a real checker, not erased to a constant boolean -----
const _h5 = grantFrom(decisionA, 5_000, 9_999, true)
