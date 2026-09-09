/**
 * The package version, as a runtime constant.
 *
 * Kept equal to `package.json`'s `version` by `scripts/sync-static-version.ts`
 * (run by the root `version-packages` script after `changeset version`) and
 * witnessed by `test/static.test.ts`. Do not edit by hand; bump `package.json`
 * and run `pnpm sync:version`.
 */
export const VERSION = '3.0.0'
