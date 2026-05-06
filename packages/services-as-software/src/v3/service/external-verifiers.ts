/**
 * External-verifier registry for the v3 ProofPredicate evaluator.
 *
 * Per `kind: 'external'` predicates (e.g. `External({ verifier: 'github',
 * spec: { merged: true } })`), the verify-time evaluator resolves the
 * `verifier` name through this lazy registry and delegates the actual check
 * to the registered handler.
 *
 * **Lazy + global by design.** Production deployments register their
 * verifiers (`github`, `salesforce`, `stripe`, `docusign`, …) at startup —
 * typically via a side-effecting import in the host app's bootstrap. Tests
 * register verifiers in `beforeEach` and tear them down in `afterEach` via
 * {@link __resetVerifiersForTests}.
 *
 * **Default behaviour for an unregistered verifier**: the predicate
 * evaluates to FALSE with a `'no verifier registered for "<name>"'` detail
 * string. This is the safe-fail default — verify-side gates should never
 * silently pass when their substrate is missing.
 *
 * @packageDocumentation
 */

/**
 * Result of one {@link ExternalVerifier.verify} invocation. `passed` is
 * authoritative; `detail` is an optional human-readable diagnostic that the
 * predicate evaluator surfaces back into `VerificationFailure.detail` on
 * failure.
 */
export interface ExternalVerifierResult {
  passed: boolean
  detail?: string
}

/**
 * One external-verifier handler. The `name` is matched case-sensitively
 * against `External({ verifier })`'s string. `verify(spec, ctx)` is awaited
 * by the predicate evaluator and may perform IO (HTTP calls, DB lookups,
 * etc.); the evaluator surfaces failures into the report.
 *
 * `ctx` is intentionally `unknown` — the evaluator passes through whatever
 * verify-time context the caller wired (e.g. tenant id, fixture metadata).
 */
export interface ExternalVerifier {
  name: string
  verify(spec: unknown, ctx?: unknown): Promise<ExternalVerifierResult>
}

const REGISTRY = new Map<string, ExternalVerifier>()

/**
 * Register an {@link ExternalVerifier}. Re-registering the same `name`
 * overwrites silently — production hosts may swap verifier implementations
 * (e.g. mock → real) at startup, and the registry should not require the
 * caller to call `__resetVerifiersForTests()` first.
 */
export function registerVerifier(verifier: ExternalVerifier): void {
  REGISTRY.set(verifier.name, verifier)
}

/**
 * Resolve a verifier by name. Returns `undefined` when no verifier with that
 * name has been registered — the predicate evaluator interprets this as
 * "predicate fails, with `detail: 'no verifier registered for ...'`".
 */
export function getVerifier(name: string): ExternalVerifier | undefined {
  return REGISTRY.get(name)
}

/**
 * Test helper — clears the registry. Production code MUST NOT call this; use
 * it only in test setup/teardown to keep test cases isolated.
 */
export function __resetVerifiersForTests(): void {
  REGISTRY.clear()
}
