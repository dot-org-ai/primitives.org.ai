// =====================================================================================
// CORRECTION D — subjective outcome via an external terminal judge (brand-identity delivery).
// Ported to import the REAL frozen kernel (`@org.ai/authority`). The customer's subjective
// acceptance no longer has to be LAUNDERED through the competence lattice: outcomeGate +
// TerminalJudge -> Accepted<Corr,Prin> is DISTINCT from Passed<D>, and PricingBasis carries
// the effort/consumption fallback first-class. Two-sided harness: the HONEST path compiles;
// every LAUNDERING path is a type error. A clean EXIT 0 is two-sided (a spent @ts-expect-error
// over a non-erroring line is itself TS2578).
//
// FC1 NOTE: under the VERBATIM V2 signature this file documented a RESIDUAL — a wrong-corr
// Accepted resolved the Pending silently when Corr was INFERRED (only errored when pinned).
// The landed module completes `NoInfer` on `resolvePending`, so that residual is now CLOSED:
// `_eLeak` below is a type error even with Corr inferred (see FINAL-VERDICT §(b)).
// =====================================================================================
import {
  type Principal, type Agent, type Seat, type DecisionRecord, type Commitment,
  type Pending, type Escalation, type Passed, type Accepted, type TerminalJudge, type TenantBound,
  executor, authorityGate, commitThroughSoftware, resolvePending, outcomeGate, escalate,
} from '../../src/index'

// ===== Software surface — an artifact vault for the produced creative deliverable =====
interface BrandBrief { readonly id: string; readonly customer: string }
interface Stack<T extends Principal> extends TenantBound<T> {
  storeArtifact(brief: BrandBrief, uri: string): void
  emit(name: string, data: Record<string, unknown>): void
}
declare function stackOf<T extends Principal>(t: T): Stack<T>

// =====================================================================================
// RE-RENDER — Delivery-Run of a subjective brand-identity deliverable.
//   Performer : executor('sally') — creative capacity, IDENTITY-ONLY (Correction C).
//   Release   : an internal OVERSIGHT/competence gate (checker = quinn, delivery-competent).
//   Outcome   : the SUBJECTIVE terminal verdict — the external CUSTOMER (a TerminalJudge, NO
//               domain, NOT a Seat) accepts -> Accepted<Corr,Prin>, DISTINCT from Passed<D>.
//   Close     : resolvePending(pending, Accepted, ...) — no lattice, no laundering.
// =====================================================================================
declare const A: Principal<'A'>
const stackA = stackOf(A)

const brief: BrandBrief = { id: 'brand-9', customer: 'acme-corp' }

// quinn is the independent, delivery-competent release checker (performer sally != checker).
const releaseChecker: Seat<'quinn', 'delivery', Principal<'A'>> =
  { name: 'quinn', domain: 'delivery', principal: A }

function runBrandDelivery(): Commitment<void> | Escalation {
  // 1. Software: store the produced creative artifact. No judgment.
  stackA.storeArtifact(brief, 'vault://brand-9/final.fig')

  // 2. RELEASE gate (oversight/competence): sally's Author identity performs; quinn checks.
  const releaseGate = authorityGate('delivery', 'brand-9', A, executor('sally'), releaseChecker)
  const releaseRecord: DecisionRecord<'delivery', Principal<'A'>> = {
    seat: 'quinn', domain: 'delivery', principal: A,
    credentialProof: 'sig:release', at: Date.now(), approved: true,
  }
  const releaseDecision = releaseGate.decide(releaseRecord)

  // 3. Commit the RELEASE, but the OUTCOME (customer accepts the brand identity) is OPEN.
  const pending = commitThroughSoftware(
    releaseDecision, stackA, () => stackA.emit('brand_released', { brief: brief.id }),
    { outcome: 'delivery', validUntil: 9_999 },
  )
  if (pending.kind !== 'pending') return pending   // Escalation short-circuit

  // 4. OUTCOME gate: the EXTERNAL customer is the terminal judge (NO domain, NOT a Seat).
  //    Brand identity is subjective -> pricing basis = 'effort' (fallback, first-class).
  const customerGate = outcomeGate('brand-9', A)
  const customer: TerminalJudge<'acme-corp'> = { judge: 'acme-corp' }
  const verdict = customerGate.accept(customer, true, 'effort')
  if (!verdict.accepted) return escalate(verdict.escalateTo)

  // 5. Close the delivery with the Accepted token — D composes with E. No Passed<'quality'> proxy.
  return resolvePending(pending, verdict.token, stackA, () => stackA.emit('brand_accepted', {}))
}

// A consumption-basis variant is equally first-class (e.g. usage-metered retainer).
function acceptOnConsumption(): Accepted<'brand-9', Principal<'A'>> | Escalation {
  const g = outcomeGate('brand-9', A).accept({ judge: 'acme-corp' }, true, 'consumption')
  return g.accepted ? g.token : escalate(g.escalateTo)
}

// =====================================================================================
// FALSIFICATION HARNESS — every guarded line MUST error.
// =====================================================================================
declare const passDelivery: Passed<'delivery', 'brand-9', Principal<'A'>>
declare const acceptedBrand: Accepted<'brand-9', Principal<'A'>>
declare const wrongCorrAccepted: Accepted<'brand-8', Principal<'A'>>
declare const brandPending: Pending<'brand-9', 'delivery'>
declare const customerJudge: TerminalJudge<'acme-corp'>

// ---- CORE (D): Accepted is DISTINCT from Passed and cannot be laundered ----

//                   commit path — commitThroughSoftware takes a GateDecision, never an Accepted.
const _d1 = commitThroughSoftware(acceptedBrand, stackA, () => {})

//                   not a SeatName.
const _d2: Seat<'customer', 'quality', Principal<'A'>> = { name: 'customer', domain: 'quality', principal: A }

const _d3: Accepted<'brand-9', Principal<'A'>> = passDelivery

const _d4: Passed<'delivery', 'brand-9', Principal<'A'>> = acceptedBrand

const _d5 = outcomeGate('brand-9', A).accept(customerJudge, true, 'subscription')

//                   customer's TerminalJudge into a competence gate as a checker Seat.
const _d6 = authorityGate('quality', 'brand-9', A, executor('sally'), customerJudge)

//                   resolve this Pending (Corr PINNED explicitly).
const _d7 = resolvePending<'brand-9', 'delivery', Principal<'A'>, void>(brandPending, wrongCorrAccepted, stackA, () => {})

// FC1 (Correction E, now CLOSED): the SAME call with Corr INFERRED is ALSO an error — the
// landed module's `NoInfer<Corr>` pins Corr to the pending ('brand-9'), so a wrong-corr
// ('brand-8') verdict no longer widens the param to a union. This line documented the residual
// under the verbatim V2 signature; it is a type error now.
const _eLeak = resolvePending(brandPending, wrongCorrAccepted, stackA, () => {})

// ---- REGRESSION GUARD: the added D machinery did not break round-1 ----

type _SusanAgent = Agent<'susan', Principal<'A'>>

const _rSod = authorityGate('money', 'x', A, executor('finn'), { name: 'quinn', domain: 'quality', principal: A } as Seat<'quinn', 'quality', Principal<'A'>>)

export { runBrandDelivery, acceptOnConsumption }
