/**
 * The `EvaluateResult` key sets both entry points must produce - shared by the
 * Node pool (`ai-evaluate/node`, and `src/evaluate.ts` driven through the
 * loader bridge) and the workers pool (`src/evaluate.ts` against a real
 * `worker_loaders` binding), so parity is asserted against one contract
 * rather than one path against the other.
 */

/** Keys of a successful `{ script }` evaluation (no tests) */
export const SCRIPT_RESULT_KEYS = ['duration', 'logs', 'success', 'value'] as const

/** Keys of a successful `{ tests }` evaluation (embedded runner) */
export const TESTS_RESULT_KEYS = ['duration', 'logs', 'success', 'testResults'] as const

/** Sorted own keys of a result, for comparison against the sets above */
export function resultKeys(result: object): string[] {
  return Object.keys(result).sort()
}
