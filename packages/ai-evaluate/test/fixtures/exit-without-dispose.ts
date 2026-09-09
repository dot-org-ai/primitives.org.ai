/**
 * Fixture for test/node-exit.test.ts: use the process-wide local runtime and
 * never call `dispose()`. The process must exit on its own once the last
 * evaluation has returned - an idle host must not hold the event loop, and a
 * host that has already gone idle must still be waited for while a later
 * (slow) evaluation is in flight.
 *
 * Spawned as `node --import tsx <this file>`.
 */

import { ChildProcess } from 'node:child_process'
import { evaluate } from '../../src/node.js'

const first = await evaluate({ script: 'return 1 + 1' })

// Let the host go idle (its handles are unref'd) before the slow call.
await new Promise((resolve) => setTimeout(resolve, 200))

const pending = evaluate({
  script: 'await new Promise((resolve) => setTimeout(resolve, 1000)); return 7',
})

// While the slow call is in flight the host's handles are ref'd again, so the
// workerd child is visible among the process's active handles. Report its pid
// so the test can check it was reaped after exit. (`_getActiveHandles` lists
// only ref'd handles, which is also why this must be sampled mid-call.)
await new Promise((resolve) => setTimeout(resolve, 300))
const handles = (process as { _getActiveHandles?: () => unknown[] })._getActiveHandles?.() ?? []
const workerd = handles.find((h): h is ChildProcess => h instanceof ChildProcess)

const second = await pending

console.log(JSON.stringify({ first: first.value, second: second.value, workerdPid: workerd?.pid }))
// No dispose() here - on purpose.
