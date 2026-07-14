// =====================================================================================
// BEFORE (pre-Correction-H primitive): Passed<D> single-use brand + one commit door.
// The canonical FREE-mode crack — mint ONE Passed, smuggle it into every buy — compiles
// SILENTLY with no residual, no expiry, no tripwire. This is what H had to close.
// =====================================================================================
declare const PASS: unique symbol
interface Passed<D extends string> { readonly [PASS]: D }
interface Commitment<R> { readonly r: R }
declare function decide<D extends string>(d: D, approved: boolean): Passed<D> | null
declare function commitThroughSoftware<D extends string, R>(pass: Passed<D>, effect: () => R): Commitment<R>

function freeModeBefore(): void {
  const pass = decide('growth', true)          // ONE human approval
  if (!pass) return
  for (let i = 0; i < 1_000_000; i++) {          // one million autonomous buys...
    commitThroughSoftware(pass, () => {})        // ...all off the SAME token. Blank check. Silent.
  }
}
void freeModeBefore
