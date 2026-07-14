// =====================================================================================
// RESIDUALS THAT SURVIVE CORRECTION H (compile SILENTLY under the SAME V2 interface).
// This is the adversarial "what H does NOT catch." No @ts-expect-error guards: if any of
// these errored, the file would fail. It compiles EXIT 0 -> these laundering shapes are
// NOT type errors under V2. They are the honest runtime residue of Correction H.
// =====================================================================================
import {
  type Principal, type Grant, type GateDecision, type Stack,
  grantFrom, commitFromGrant, stackOf, commitThroughSoftware,
} from '../../src/index'

declare const A: Principal<'A'>
const stackA: Stack<Principal<'A'>> = stackOf(A)
declare const decisionA: GateDecision<'growth', 'ads-q3-freemode', Principal<'A'>>
declare const cacBelowThreshold: () => boolean

// -------------------------------------------------------------------------------------
// RESIDUAL 1 — NO LINEAR TYPES: the ORIGINAL grant is never marked "consumed."
// The residual is threaded by VALUE (commitFromGrant returns a decremented grant), but the
// original full-residual g0 stays in scope and can be re-drawn every iteration. Ignoring
// step.residual and re-passing g0 spends the FULL envelope on EVERY buy -> unbounded.
// The type system cannot forbid this (TS has no affine/linear/`used`-once types).
// -------------------------------------------------------------------------------------
function launderByReusingOriginalGrant(): void {
  const g0 = grantFrom(decisionA, 5_000, 9_999, () => cacBelowThreshold())
  if ('escalatedTo' in g0) return
  for (let i = 0; i < 1_000_000; i++) {
    // g0 re-passed every time; step.residual DISCARDED. Compiles clean. Blank check.
    const step = commitFromGrant(g0, 200, stackA, () => stackA.emit('ad_buy', { i }))
    void step
  }
}
void launderByReusingOriginalGrant

// -------------------------------------------------------------------------------------
// RESIDUAL 2 — EPISODIC-DOOR BYPASS: the Grant door is not the ONLY door.
// A standing loop mis-modeled as repeated *terminal* commitThroughSoftware(decision) reuses
// ONE Passed for unbounded distinct effects. commitThroughSoftware is meant to be terminal
// ("outcome achieved at commit"), but nothing types it as single-use, so the same
// GateDecision drives a million buys with NO residual and NO tripwire. Compiles clean.
// -------------------------------------------------------------------------------------
function launderThroughEpisodicDoor(): void {
  for (let i = 0; i < 1_000_000; i++) {
    // one gate approval, reused as a terminal commit a million times. No Grant involved.
    const done = commitThroughSoftware(decisionA, stackA, () => stackA.emit('ad_buy', { i }))
    void done
  }
}
void launderThroughEpisodicDoor
