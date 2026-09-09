/**
 * Fixture for test/node-exit.test.ts: evaluate, let the host go idle, then
 * `await dispose()` as the last thing the script does. The process must exit
 * normally (code 0) once teardown has completed - not with Node's "unsettled
 * top-level await" (code 13) because the idle host's unref'd handles let the
 * loop drain before `miniflare.dispose()` settled.
 *
 * Spawned as `node --import tsx <this file>`.
 */

import { evaluate, dispose } from '../../src/node.js'

const result = await evaluate({ script: 'return 1 + 1' })

// Let the host go idle (its handles are unref'd) before tearing it down.
await new Promise((resolve) => setTimeout(resolve, 200))

await dispose()
console.log(JSON.stringify({ value: result.value, disposed: true }))
