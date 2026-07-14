// =====================================================================================
// CORRECTION E — command-time != outcome-time (field-service dispatch / physical shipment).
// Ported to import the REAL frozen kernel (`@org.ai/authority`). Command released NOW (dispatch
// authorized + truck rolls); OUTCOME (POD/EPCIS `delivered`) verified LATER. The three-way
// commit types the in-flight state; Corr correlates command-auth to the outcome-auth that
// completes it. Two-sided harness: every guarded line MUST error (an unused @ts-expect-error
// is itself TS2578). EXIT 0 => good code checks AND every E defect caught.
// =====================================================================================
import {
  type Principal, type RegisterBook, type JudgmentPoint, type Seat, type DecisionRecord,
  type GateDecision, type Commitment, type Pending, type Escalation, type Passed, type TenantBound,
  executor, authorityGate, commitThroughSoftware, resolvePending, outcomeGate, escalate,
} from '../../src/index'

// ===== Software surface — a Work Order / dispatch board + a delivery-proof intake ========
interface WorkOrder { readonly id: string; readonly addr: string; readonly sla: number }
interface DeliveryProof { readonly epc: string; readonly pod: boolean; readonly scannedAt: number }
interface FieldStack<T extends Principal> extends TenantBound<T> {
  route(wo: WorkOrder): number
  dispatch(wo: WorkOrder): void
  ingestProof(wo: WorkOrder): DeliveryProof
  emit(name: string, data: Record<string, unknown>): void
}
declare function fieldStackOf<T extends Principal>(t: T): FieldStack<T>

// =====================================================================================
// RE-RENDER — FIELD-SERVICE DISPATCH / PHYSICAL SHIPMENT (row 15 delivery-run, physical).
// =====================================================================================
declare const A: Principal<'A'>
declare const rosterA: RegisterBook<Principal<'A'>>
const priyaA = rosterA.priya                 // ops lead who PROPOSES the dispatch (advisory)
const field = fieldStackOf(A)

const dispatchJP: JudgmentPoint<'product-hypothesis'> =
  { id: 'row15-dispatch', accruesTo: 'product-hypothesis' }
// The reserved DISPATCH-competent checker of THIS tenant (a logistics controller).
const dispatchCtl: Seat<'controller', 'dispatch', Principal<'A'>> =
  { name: 'controller', domain: 'dispatch', principal: A }
// The reserved DELIVERY-competent checker (proof-of-delivery attestation seat).
const deliveryCtl: Seat<'auditor', 'delivery', Principal<'A'>> =
  { name: 'auditor', domain: 'delivery', principal: A }

// ONE correlation id ties command-auth to outcome-auth. It is a literal type, load-bearing.
const CORR = 'wo-88231' as const
type Corr = typeof CORR

// -- PHASE 1 (COMMAND, now): authorize dispatch, roll the truck, get a PENDING back -------------
function releaseDispatch(wo: WorkOrder): Pending<Corr, 'delivery'> | Escalation {
  const eta = field.route(wo)

  const plan = priyaA.propose(dispatchJP, { wo: wo.id, eta })
  const _c: false = plan.committed

  const gate = authorityGate('dispatch', CORR, A, priyaA.author, dispatchCtl)
  const record: DecisionRecord<'dispatch', Principal<'A'>> = {
    seat: 'controller', domain: 'dispatch', principal: A,
    credentialProof: 'sig:dispatch', at: Date.now(), approved: eta < wo.sla,
  }
  const decision = gate.decide(record)

  // COMMIT the COMMAND through Software with the async overload. The truck rolls NOW, but the
  // return type is Pending<Corr,'delivery'> -- NOT a Commitment. No false terminal success.
  const inFlight = commitThroughSoftware(
    decision, field, () => field.dispatch(wo),
    { outcome: 'delivery', validUntil: Date.now() + 72 * 3600_000 },
  )
  if (inFlight.kind === 'escalated') return inFlight
  field.emit('dispatched', { wo: wo.id, corr: CORR })
  return inFlight                              // still open: the outcome hasn't happened yet
}

// -- PHASE 2 (OUTCOME, later): a delivery-competent seat OR the external customer closes it ------
function closeByProof(
  pending: Pending<Corr, 'delivery'>, wo: WorkOrder,
): Commitment<void> | Escalation {
  const proof = field.ingestProof(wo)
  const deliveryGate = authorityGate('delivery', CORR, A, executor('rae'), deliveryCtl)
  const drec: DecisionRecord<'delivery', Principal<'A'>> = {
    seat: 'auditor', domain: 'delivery', principal: A,
    credentialProof: 'sig:pod', at: proof.scannedAt, approved: proof.pod,
  }
  const verdict = deliveryGate.decide(drec)
  if (!verdict.approved) return escalate(verdict.escalateTo)
  // resolvePending ONLY accepts a verdict carrying the SAME Corr. Command-auth <-> outcome-auth linked.
  return resolvePending(pending, verdict.pass, field, () => field.emit('delivered', { wo: wo.id }))
}

function closeByCustomer(
  pending: Pending<Corr, 'delivery'>,
): Commitment<void> | Escalation {
  const cust = outcomeGate(CORR, A)
  const v = cust.accept({ judge: 'acme-logistics' }, true, 'outcome')
  if (!v.accepted) return escalate(v.escalateTo)
  return resolvePending(pending, v.token, field, () => field.emit('signed_pod', {}))
}

function fieldServiceRun(wo: WorkOrder): Commitment<void> | Escalation {
  const inFlight = releaseDispatch(wo)
  if (inFlight.kind === 'escalated') return inFlight
  return closeByProof(inFlight, wo)
}
void closeByCustomer; void fieldServiceRun

// =====================================================================================
// FALSIFICATION HARNESS — Correction-E focus. Every guarded line MUST error.
// =====================================================================================
declare const pendingE: Pending<Corr, 'delivery'>
declare const goodDeliveryVerdict: Passed<'delivery', Corr, Principal<'A'>>
declare const wrongCorrVerdict: Passed<'delivery', 'wo-99999', Principal<'A'>>
declare const wrongDomainVerdict: Passed<'dispatch', Corr, Principal<'A'>>
declare const dispatchDecision: GateDecision<'dispatch', Corr, Principal<'A'>>

// ----- (E1) wrong correlation cannot resolve a Pending — Corr is load-bearing -----
const _e1 = resolvePending(pendingE, wrongCorrVerdict, field, () => {})

// ----- (E2) command-time Pending is NOT a terminal Commitment — no false success at command time -----
const _e2: Commitment<void> = pendingE

// ----- (E3) the outcome verdict must match the awaited OUTCOME domain, not the command domain -----
const _e3 = resolvePending(pendingE, wrongDomainVerdict, field, () => {})

// ----- (E4) the async commit returns Pending, so it cannot be consumed as a Commitment directly -----
const _e4: Commitment<void> = commitThroughSoftware(
  dispatchDecision, field, () => {},
  { outcome: 'delivery', validUntil: 1 },
)

// ----- (E5) you cannot skip the command lane and fabricate a Commitment from a bare outcome verdict -----
const _e5 = resolvePending(goodDeliveryVerdict, goodDeliveryVerdict, field, () => {})

// ----- (E6) a Pending cannot be re-narrowed to Escalation to fake a terminal outcome either -----
const _e6: Escalation = pendingE

// ----- POSITIVE CONTROL (must COMPILE — proves the good path isn't accidentally broken) -----
const _ok: Commitment<void> | Escalation = resolvePending(
  pendingE, goodDeliveryVerdict, field, () => field.emit('ok', {}),
)
void _ok
