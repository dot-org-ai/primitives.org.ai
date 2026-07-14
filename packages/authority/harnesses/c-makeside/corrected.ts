// =====================================================================================
// CORRECTION C — pooled-executor authorship (make-side change, inventory #32).
// Ported to import the REAL frozen kernel (`@org.ai/authority`) instead of an inline copy.
// A POOLED, register-less executor AUTHORS the diff; a competence Seat CHECKS; the merge
// commits through the .do Substrate with the gate token — the build is no longer authorless.
// Two-sided harness: every guarded line MUST error (an unused expect-error directive is
// itself TS2578). EXIT 0 proves good code checks AND every defect caught.
// =====================================================================================
import {
  type Principal, type RegisterBook, type Agent, type JudgmentPoint, type Seat,
  type DecisionRecord, type GateDecision, type Commitment, type Escalation, type TenantBound,
  executor, authorityGate, adversarialGate, commitThroughSoftware, escalate,
  makeAgent, makeRegister,
} from '../../src/index'

// ===== Software surface — the make-side substrate (.do repo / build system) ==========
interface Diff { readonly id: string; readonly loc: number; readonly authorSha: string }
interface Substrate<T extends Principal> extends TenantBound<T> {
  build(diff: Diff): { readonly ok: boolean; readonly artifact: string }
  runCI(diff: Diff): { readonly green: boolean }
  mergeToMain(diff: Diff): void
  emit(name: string, data: Record<string, unknown>): void
}
declare function substrateOf<T extends Principal>(t: T): Substrate<T>

// =====================================================================================
// RE-RENDER — MAKE-SIDE CHANGE, single-tenant, code-build lane.
//   ralph/rae (pooled) AUTHOR the diff  →  quinn CHECKS quality (CI write-barrier)
//     →  tom PROPOSES the merge (advisory, committed:false, accrues to merge-authority)
//        →  tom's merge-to-main AUTHORITY gate (performer = ralph's Author; checker = tom)
//           →  Service COMMITS the merge through the .do Substrate with the gate token.
// =====================================================================================
declare const A: Principal<'A'>
declare const rosterA: RegisterBook<Principal<'A'>>
const tomA = rosterA.tom                             // Agent<'tom', Principal<'A'>>, register 'merge-authority'
const doA = substrateOf(A)

// ralph & rae: POOLED executors. LEGIBLE authorship, NO register, NO competence seat, NO authority.
const ralph = executor('ralph')                      // Author<'ralph'>
const rae = executor('rae')                          // Author<'rae'>

const mergeJP: JudgmentPoint<'merge-authority'> = { id: 'row32-make-side', accruesTo: 'merge-authority' }
const quinnQualityA: Seat<'quinn', 'quality', Principal<'A'>> =
  { name: 'quinn', domain: 'quality', principal: A }
const tomMergeA: Seat<'tom', 'merge', Principal<'A'>> =
  { name: 'tom', domain: 'merge', principal: A }

function runMakeSideChange(diff: Diff): Commitment<void> | Escalation {
  // 1. Software: pooled build + CI. Deterministic, no judgment. The diff carries ralph's authorSha.
  const built = doA.build(diff)
  const ci = doA.runCI(diff)

  // 2. QA gate (quinn's write-barrier, PR "required status check"):
  //    performer = ralph's AUTHOR identity (register-less — Correction C's slot);
  //    checker = quinn, competence-typed in 'quality'. The build is NO LONGER authorless.
  const qaGate = authorityGate('quality', 'pr-32', A, ralph, quinnQualityA)
  const qaRecord: DecisionRecord<'quality', Principal<'A'>> = {
    seat: 'quinn', domain: 'quality', principal: A,
    credentialProof: 'ci-sig', at: Date.now(), approved: built.ok && ci.green,
  }
  const qa = qaGate.decide(qaRecord)
  if (!qa.approved) return escalate(qa.escalateTo)

  // 3. Agent JUDGMENT: tom PROPOSES the merge. Advisory, stamps his merge-authority register,
  //    committed:false -> tom has zero power to self-release the merge (Correction A holds).
  const proposal = tomA.propose(mergeJP, { merge: diff.id, qa: qa.pass })
  const _adv: false = proposal.committed

  // 4. Merge-to-main AUTHORITY gate (the scarce commit right, PR "CODEOWNERS + branch protection"):
  //    performer = ralph's AUTHOR identity (identity-only); checker = tom, competent in 'merge'.
  const mergeGate = authorityGate('merge', 'pr-32', A, ralph, tomMergeA)
  const mergeRecord: DecisionRecord<'merge', Principal<'A'>> = {
    seat: 'tom', domain: 'merge', principal: A,
    credentialProof: 'tom-sig', at: Date.now(), approved: diff.loc < 400,
  }
  const decision = mergeGate.decide(mergeRecord)

  // 5. Service COMMITS the merge through the .do Substrate, only with the gate token.
  const done = commitThroughSoftware(decision, doA, () => doA.mergeToMain(diff))
  if (done.kind === 'escalated') return done

  // 6. Instrumentation: the merge is attributed to ralph's authorship + tom's approval.
  doA.emit('merged_to_main', { diff: diff.id, author: ralph.author, approvedBy: 'tom' })
  return done
}

// rae authors a second diff on the same pooled lane — same legible slot, no register needed.
function raeAlsoAuthors(diff: Diff): GateDecision<'quality', 'pr-33', Principal<'A'>> {
  const g = authorityGate('quality', 'pr-33', A, rae, quinnQualityA)
  return g.decide({ seat: 'quinn', domain: 'quality', principal: A, credentialProof: 'ci', at: 0, approved: true })
}
void runMakeSideChange; void raeAlsoAuthors

// =====================================================================================
// FALSIFICATION HARNESS — every guarded line MUST error.
// =====================================================================================
const openRiskJP: JudgmentPoint<'open-risk-book'> = { id: 'row29', accruesTo: 'open-risk-book' }
declare const B: Principal<'B'>
const controllerB: Seat<'controller', 'merge', Principal<'B'>> = { name: 'controller', domain: 'merge', principal: B }

// ----- CORRECTION C: ralph is a PERFORMER (identity) but NOT an owner/checker (register/competence) -----
// @ts-expect-error  C1: pooled executor ralph has no register -> not an Agent
type _RalphAgent = Agent<'ralph', Principal<'A'>>
// @ts-expect-error  C2: ralph is not a register-owner in the roster
const _ralphReg = rosterA.ralph
// @ts-expect-error  C3: a pooled executor has no competence Seat -> cannot be a CHECKER
const _ralphSeat: Seat<'ralph', 'merge', Principal<'A'>> = { name: 'ralph', domain: 'merge', principal: A }
// @ts-expect-error  C4: ralph cannot even mint a register (no register kind maps to 'ralph')
const _ralphMint = makeRegister('ralph', A, 'merge-authority')

// ----- THE ROUND-2 CRACK ITSELF: the build must NOT be authorless -----
// @ts-expect-error  X1: a gate cannot be performed by a bare Seat — the performer axis is Author-only
const _authorless = authorityGate('quality', 'pr-32', A, quinnQualityA, quinnQualityA)
// @ts-expect-error  X2: a gate cannot be performed by a plain string name — authorship must be a real Author<N>
const _stringPerformer = authorityGate('quality', 'pr-32', A, 'ralph', quinnQualityA)
// @ts-expect-error  X3: the merge cannot be committed authorlessly — commit needs a GateDecision, not a bare effect
const _noDecisionCommit = commitThroughSoftware(doA, () => doA.mergeToMain({ id: 'd', loc: 1, authorSha: '' }))

// ----- CORRECTION B / SoD held: competence-distinct AND performer != checker -----
// @ts-expect-error  B1: quinn ('quality') cannot check a 'merge' gate (competence-distinct)
const _sodComp = authorityGate('merge', 'pr-32', A, ralph, quinnQualityA)
// @ts-expect-error  B2: tom cannot check a merge gate that tom's OWN author performed (performer != checker)
const _sodSelf = authorityGate('merge', 'pr-32', A, tomA.author, tomMergeA)
// @ts-expect-error  B3: adversarial N-of-M needs >= 2 merge-competent non-ralph seats
const _sodNofM = adversarialGate('merge', 'pr-32', A, ralph, [tomMergeA])

// ----- CORRECTION A held: tom's proposal is advisory; it cannot self-commit -----
// @ts-expect-error  A1: a Proposal is never self-committed (committed is the literal false)
const _selfCommit: true = tomA.propose(mergeJP, {}).committed
// @ts-expect-error  A2: cara cannot own a second register kind (one register per identity)
const _caraTwo = makeAgent('cara', A, makeRegister('cara', A, 'customer-promise-memory'), [openRiskJP])

// ----- CORRECTION F held: tokens/seats non-portable across tenants -----
// @ts-expect-error  F1: B's controller seat cannot satisfy A's merge gate SoD (principal-distinct)
const _fSeat = authorityGate('merge', 'pr-32', A, ralph, controllerB)
