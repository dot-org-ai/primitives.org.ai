/**
 * Process-exit contract for `ai-evaluate/node`.
 *
 * The process-wide Miniflare host must not keep a Node process alive once it
 * is idle: a script or CLI that calls `evaluate()` and never `dispose()`s has
 * to exit on its own. vitest hides this (it kills its workers), so the
 * fixture is run in a real child `node` process and its exit is asserted.
 */

import { execFile } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { describe, it, expect } from 'vitest'

const execFileAsync = promisify(execFile)

const here = dirname(fileURLToPath(import.meta.url))
const packageDir = join(here, '..')
const fixture = join(here, 'fixtures', 'exit-without-dispose.ts')
const disposeFixture = join(here, 'fixtures', 'dispose-after-idle.ts')

/** Upper bound for the whole fixture: host startup + ~1.2s of evaluations */
const EXIT_BOUND_MS = 20_000

interface FixtureReport {
  first: unknown
  second: unknown
  workerdPid?: number
}

/** The fixture's last stdout line is a JSON report; absent if it never got there */
function parseReport(stdout: string): FixtureReport | undefined {
  const line = stdout.trim().split('\n').at(-1) ?? ''
  try {
    return JSON.parse(line) as FixtureReport
  } catch {
    return undefined
  }
}

/** Kill a leftover workerd (test-failure cleanup only) and wait for it to go */
async function reap(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    return
  }
  const deadline = Date.now() + 2_000
  while (isAlive(pid) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

describe('ai-evaluate/node process exit', () => {
  it('a script that never calls dispose() exits on its own, and workerd is reaped', async () => {
    const start = Date.now()
    let report: FixtureReport | undefined
    try {
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        ['--import', 'tsx', fixture],
        // SIGTERM (not SIGKILL) so that, when the fixture hangs, Miniflare's own
        // signal hook gets a chance to reap workerd instead of orphaning it.
        { cwd: packageDir, timeout: EXIT_BOUND_MS, killSignal: 'SIGTERM' }
      )
      report = parseReport(stdout)
      expect(stderr).not.toMatch(/ERR_RUNTIME/)
    } catch (error) {
      // execFile rejects on a non-zero exit or when the bound is hit (killed).
      // The fixture prints its report before it would hang, so recover the
      // workerd pid from the partial stdout and make sure a failure of this
      // test does not leave a workerd behind.
      report = parseReport((error as { stdout?: string }).stdout ?? '')
      if (report?.workerdPid) await reap(report.workerdPid)
      throw error
    }
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(EXIT_BOUND_MS)

    expect(report?.first).toBe(2)
    // The slow call ran after the host had gone idle: the loop was held for it.
    expect(report?.second).toBe(7)

    // Miniflare's exit hook SIGKILLs workerd on process exit; give it a moment.
    expect(typeof report?.workerdPid).toBe('number')
    const pid = report?.workerdPid as number
    const deadline = Date.now() + 2_000
    while (isAlive(pid) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
    expect(isAlive(pid)).toBe(false)
  })

  it('an `await dispose()` at the tail of a script settles and the process exits 0', async () => {
    // Teardown of an idle host must hold the loop open until it completes;
    // otherwise Node exits 13 (unsettled top-level await) mid-dispose.
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      ['--import', 'tsx', disposeFixture],
      { cwd: packageDir, timeout: EXIT_BOUND_MS, killSignal: 'SIGTERM' }
    )
    expect(stderr).not.toMatch(/unsettled top-level await/)
    const line = stdout.trim().split('\n').at(-1) ?? ''
    expect(JSON.parse(line)).toEqual({ value: 2, disposed: true })
  })
})
