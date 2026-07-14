// =====================================================================================
// CORRECTION G — durable authority, SOC2-attestation-over-weeks shape.
// Ported to import the REAL frozen kernel (`@org.ai/authority`), whose `serialize`/`remint`
// carry the FC1 `NoInfer` fix. cole (pooled executor, identity-only) performs; the auditor
// SEAT checks; decide takes a SIGNED record; the token is serialized, PARKED across the weeks
// the auditor forms an opinion, and re-minted at resume ONLY by re-presenting the record to
// the SAME gate. Two-sided harness: every guard MUST error; EXIT 0 proves both halves.
// =====================================================================================
import {
  type Principal, type SeatName, type Seat, type Passed, type DecisionRecord,
  type GateDecision, type AuthorityGate, type Commitment, type Escalation, type SerializedPassed,
  executor, authorityGate, escalate, commitThroughSoftware, serialize, remint, stackOf,
} from '../../src/index'

// =====================================================================================
// GOOD PATH — the SOC2 attestation-over-weeks shape. Must compile CLEAN.
// =====================================================================================
declare const A: Principal<'A'>
const stackA = stackOf(A)

const soc2Checker: Seat<'auditor', 'attestation', Principal<'A'>> =
  { name: 'auditor', domain: 'attestation', principal: A }
const soc2Gate = authorityGate('attestation', 'soc2-2026', A, executor('cole'), soc2Checker)
const soc2Record: DecisionRecord<'attestation', Principal<'A'>> = {
  seat: 'auditor', domain: 'attestation', principal: A,
  credentialProof: 'cpa-sig:audit-opinion-blob', at: 1, approved: true,
}

// t0: the deciding act. decide() STAMPS the seat via the signed record (not a boolean).
// The Passed is serialized together with that record -> the durable, persistable form.
function parkAcrossAuditorOpinion(): SerializedPassed<'attestation', 'soc2-2026', Principal<'A'>> | Escalation {
  const d = soc2Gate.decide(soc2Record)
  if (!d.approved) return escalate(d.escalateTo)
  return serialize(d.pass, soc2Record)          // survives the process boundary; carries the record
}

// t0 + weeks: resume. The ONLY way back to a live Passed is remint(gate, parked): it
// re-presents the record to the gate, which re-verifies competence + identity at runtime.
function resumeAfterOpinion(
  parked: SerializedPassed<'attestation', 'soc2-2026', Principal<'A'>>,
): Commitment<void> | Escalation {
  const live = remint(soc2Gate, parked)          // re-verify the signed record -> live token
  if ('escalatedTo' in live) return live
  // the seat that decided is still provable off the parked record that travelled with the token:
  const decidingSeat: SeatName = parked.record.seat        // 'auditor' — preserved across the boundary
  stackA.emit('attestation_committed', { by: decidingSeat, corr: parked.corr })
  return commitThroughSoftware({ approved: true, pass: live }, stackA, () => stackA.emit('attested', {}))
}
void parkAcrossAuditorOpinion; void resumeAfterOpinion

// =====================================================================================
// FALSIFICATION HARNESS — every guarded line MUST error.
// =====================================================================================
declare const parkedA: SerializedPassed<'attestation', 'soc2-2026', Principal<'A'>>

// -- G1: decide() takes a SIGNED, seat-stamped record — never a bare boolean (no seat erasure)
// @ts-expect-error  boolean is not a DecisionRecord — the deciding seat cannot be erased
const _gBool = soc2Gate.decide(true)

// -- G2: a parked token is NOT a live Passed by direct assignment (must remint via re-verify)
// @ts-expect-error  SerializedPassed lacks [PASS] — it is not a live Passed
const _gDirect: Passed<'attestation', 'soc2-2026', Principal<'A'>> = parkedA

// -- G3: a SINGLE `as` cast forge is ALSO rejected — the two shapes do not sufficiently overlap
// @ts-expect-error  Conversion may be a mistake: neither SerializedPassed nor Passed overlaps enough
const _gCast = parkedA as Passed<'attestation', 'soc2-2026', Principal<'A'>>

// -- G4: remint is bound to RE-PRESENTING THE RECORD to the matching gate. A wrong-corr gate
//        (different auditor opinion, 'soc2-2027') cannot re-mint this parked token.
declare const soc2Gate2027: AuthorityGate<'attestation', 'soc2-2027', Principal<'A'>>
// @ts-expect-error  corr 'soc2-2027' != parked's 'soc2-2026' — cannot re-mint against another gate
const _gWrongGate = remint(soc2Gate2027, parkedA)

// -- G5: you cannot skip remint and feed the parked token straight to a commit-time decision
// @ts-expect-error  SerializedPassed is not a Passed — the commit path needs a re-minted token
const _gSkip = commitThroughSoftware({ approved: true, pass: parkedA }, stackA, () => {})

// -- G6: serialize demands the REAL signed record for THIS token's domain — a mismatched-domain
//        record (a 'money' record smuggled onto an 'attestation' token) is rejected.
declare const attPass: Passed<'attestation', 'soc2-2026', Principal<'A'>>
declare const moneyRecord: DecisionRecord<'money', Principal<'A'>>
// @ts-expect-error  a 'money' record cannot be serialized onto an 'attestation' token
const _gWrongRecord = serialize(attPass, moneyRecord)
