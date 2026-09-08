/**
 * Module customization hooks for test/fixtures/missing-miniflare.ts: make
 * `import('miniflare')` fail.
 *
 * - `MINIFLARE_FAILURE=missing` (default): ERR_MODULE_NOT_FOUND from the
 *   resolver, exactly as when the optional dependency was skipped at install
 *   time (Node < 22, where Miniflare 5's `engines.node` is not met).
 * - `MINIFLARE_FAILURE=broken`: some other error while loading the package.
 */

import process from 'node:process'

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'miniflare') {
    if (process.env.MINIFLARE_FAILURE === 'broken') {
      throw new Error('workerd binary failed to initialise')
    }
    const error = new Error(
      `Cannot find package 'miniflare' imported from ${context.parentURL ?? '<unknown>'}`
    )
    error.code = 'ERR_MODULE_NOT_FOUND'
    throw error
  }
  return nextResolve(specifier, context)
}
