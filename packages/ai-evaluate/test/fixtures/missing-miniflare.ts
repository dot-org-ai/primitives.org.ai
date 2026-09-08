/**
 * Fixture for test/node.test.ts ("miniflare availability"): run the local
 * runtime in a process where `miniflare` cannot be resolved, as when the
 * optional dependency was skipped at install time. Prints the two
 * `evaluate()` results (shared runtime, then an explicit `createLocalRuntime`)
 * as a JSON report on its last stdout line.
 *
 * Spawned as `node --import tsx <this file>`.
 */

import { register } from 'node:module'

register('./hide-miniflare-hooks.mjs', import.meta.url)

const { evaluate, createLocalRuntime, dispose, MINIFLARE_UNAVAILABLE_ERROR } = await import(
  '../../src/node.js'
)

const shared = await evaluate({ script: 'return 1 + 1' })
const runtime = createLocalRuntime()
const explicit = await runtime.evaluate({ script: 'return 1 + 1' })
// A failed start is not a host: there is nothing to release
await runtime.dispose()
await dispose()

console.log(JSON.stringify({ shared, explicit, message: MINIFLARE_UNAVAILABLE_ERROR }))
