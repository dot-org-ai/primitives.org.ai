// =====================================================================================
// CORRECTION F — cross-tenant handoff (agent-to-agent marketplace, shape 4).
// Ported to import the REAL frozen kernel (`@org.ai/authority`). startup-A's buyer-agent
// authorizes a purchase INTERNALLY, then hands off across the Agent Gateway to startup-B's
// seller-Service via a Capability, settling on Billing-Connect (B's Software). Two tenants,
// two RegisterBooks, one Gateway seam. Two-sided harness: every guarded line MUST error.
// =====================================================================================
import {
  type Domain, type Principal, type RegisterBook, type Agent, type JudgmentPoint, type Seat,
  type DecisionRecord, type GateDecision, type Commitment, type Escalation, type Passed,
  type Capability, type TenantBound,
  authorityGate, commitThroughSoftware, invokeAcrossTenant,
} from '../../src/index'

// ===== Software surface — the money Software / payable ledger (Billing-Connect) ======
interface Invoice { readonly id: string; readonly ageDays: number; readonly amount: number }
interface Stack<T extends Principal> extends TenantBound<T> {
  age(inv: Invoice): number
  writeOff(inv: Invoice): void
  recordPlan(inv: Invoice): void
  emit(name: string, data: Record<string, unknown>): void
  referToCollections(inv: Invoice): { readonly referralId: string }
}
declare function stackOf<T extends Principal>(t: T): Stack<T>
// Cross-tenant handoff constructor (Correction F): mints a Capability, never a Passed.
declare function grantCapability<D extends Domain, From extends Principal, To extends Principal>(
  from: From, to: To, domain: D, scope: string,
): Capability<D, From, To>

// =====================================================================================
// AGENT-TO-AGENT MARKETPLACE re-render (the shape that motivated Correction F).
// =====================================================================================
declare const A: Principal<'A'>
declare const B: Principal<'B'>
declare const rosterA: RegisterBook<Principal<'A'>>
declare const rosterB: RegisterBook<Principal<'B'>>

const finnA = rosterA.finn                 // Agent<'finn', Principal<'A'>> — A's money-doctrine buyer
const stackA = stackOf(A)
const stackB = stackOf(B)                   // B's Software (where Billing-Connect settles)

const controllerA: Seat<'controller', 'money', Principal<'A'>> =
  { name: 'controller', domain: 'money', principal: A }
const controllerB: Seat<'controller', 'money', Principal<'B'>> =
  { name: 'controller', domain: 'money', principal: B }
const buyJP: JudgmentPoint<'money-doctrine'> = { id: 'row13-b2a-buy', accruesTo: 'money-doctrine' }

// GOOD PATH — the honest marketplace transaction compiles clean.
function buyFromSellerB(): Commitment<void> | Escalation {
  // 1. A's buyer-agent JUDGES the purchase (advisory, stamps finn's register, committed:false).
  const plan = finnA.propose(buyJP, { seller: 'B', item: 'seller-service', budget: 200 })
  const _c: false = plan.committed

  // 2. A's INTERNAL spend gate. performer = finn's Author identity; checker = A's money controller.
  const gate = authorityGate('money', 'mktpl-88', A, finnA.author, controllerA)
  const record: DecisionRecord<'money', Principal<'A'>> = {
    seat: 'controller', domain: 'money', principal: A,
    credentialProof: 'sig:...', at: Date.now(), approved: true,
  }
  const decision = gate.decide(record)

  // 3. A commits the purchase-authorization on A's OWN Software (the payable).
  const authd = commitThroughSoftware(decision, stackA, () => stackA.emit('purchase_authorized', { corr: 'mktpl-88' }))
  if (authd.kind === 'escalated') return authd

  // 4. GATEWAY SEAM: hand off across tenants via a Capability (NOT an internal commit token).
  const cap = grantCapability(A, B, 'money', 'billing-connect')
  return invokeAcrossTenant(cap, stackB, () => stackB.emit('billing_connect_settled', { corr: 'mktpl-88' }))
}
const marketplaceCap = grantCapability(A, B, 'money', 'billing-connect')
void buyFromSellerB

// BENIGN (compiles — and here is WHY containment still holds): performer identity is
// principal-free by Correction C, so A's finn identity MAY submit to B's gate. It is NOT a
// breach: the CHECKER is principal-locked to B (controllerB) and the emitted token is B's.
const _crossTenantPerformerOk = authorityGate('money', 'b-side-77', B, finnA.author, controllerB)
void _crossTenantPerformerOk

// =====================================================================================
// FALSIFICATION HARNESS — every guarded line MUST error.
// =====================================================================================
declare const decisionA: GateDecision<'money', 'mktpl-88', Principal<'A'>>
declare const passA: Passed<'money', 'mktpl-88', Principal<'A'>>
const quinnQualityA: Seat<'quinn', 'quality', Principal<'A'>> = { name: 'quinn', domain: 'quality', principal: A }
const finnMoneyA: Seat<'finn', 'money', Principal<'A'>> = { name: 'finn', domain: 'money', principal: A }

// ----- CLAIM 1: RegisterBook<Tenant> makes A.finn != B.finn -----
// @ts-expect-error  F1: B's finn is a DISTINCT identity from A's finn (per-(tenant,name))
const _f1: Agent<'finn', Principal<'A'>> = rosterB.finn

// ----- CLAIM 2: Passed<D,Principal> is non-portable (A token cannot settle B commit) -----
// @ts-expect-error  F2: A's authority token cannot commit B's Software (principal mismatch)
const _f2 = commitThroughSoftware(decisionA, stackB, () => {})

// ----- CLAIM 3: SoD excludes by (principal AND name) -----
// @ts-expect-error  F3-name: quinn ('quality') is not competent to check a 'money' gate
const _f3name = authorityGate('money', 'x', A, finnA.author, quinnQualityA)
// @ts-expect-error  F3-self: finn cannot check his own money act (performer != checker by NAME)
const _f3self = authorityGate('money', 'x', A, finnA.author, finnMoneyA)
// @ts-expect-error  F3-principal: B's controller (counterparty seat) cannot satisfy A's gate SoD
const _f3prin = authorityGate('money', 'x', A, finnA.author, controllerB)

// ----- CLAIM 4: a Gateway handoff (Capability) cannot unify with an internal Software call -----
// @ts-expect-error  F4a: a cross-tenant Capability is NOT an internal commit token
const _f4a = commitThroughSoftware(marketplaceCap, stackA, () => {})
// @ts-expect-error  F4b: an internal GateDecision is NOT a cross-tenant Capability
const _f4b = invokeAcrossTenant(decisionA, stackB, () => {})
// @ts-expect-error  F4c: a bare internal Passed is NOT a cross-tenant Capability either
const _f4c = invokeAcrossTenant(passA, stackB, () => {})

// ----- extra Correction-F edges -----
// @ts-expect-error  F5: a cross-tenant Capability (to B) cannot be redirected onto the caller's own (A) Stack
const _f5 = invokeAcrossTenant(marketplaceCap, stackA, () => {})
// @ts-expect-error  F6: register accrual cannot cross tenants (B entry onto A's register)
finnA.register.accrue({ principal: B, at: 0, note: 'x' })
