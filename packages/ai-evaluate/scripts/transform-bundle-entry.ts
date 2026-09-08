/**
 * Entry point for `scripts/build-transform-bundle.ts`: the slice of sucrase
 * that `src/transform.ts` needs. Only `transform` is bundled - the CLI,
 * `register` hooks and source-map helpers stay out of the worker.
 */
export { transform } from 'sucrase'
export type { Options as SucraseOptions, Transform as SucraseTransform } from 'sucrase'
