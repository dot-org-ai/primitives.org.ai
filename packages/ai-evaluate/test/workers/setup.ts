/**
 * Setup for the workers pool: account for the host-side rejections the
 * outbound gateway produces on purpose.
 *
 * The gateway (src/outbound.ts, bound as the sandbox's `globalOutbound`)
 * rejects a sandbox `fetch()` by throwing from the host's `OutboundGateway`
 * entrypoint - the only way a `Fetcher` makes its caller's `fetch()` reject.
 * workerd records that throw as an uncaught exception of the host worker
 * (the sandbox still receives it as its rejection), and here the host worker
 * is the test worker itself, so Vitest would report every blocked request as
 * an unhandled error and fail the run.
 *
 * Vitest defers to a second `unhandledRejection` listener when one exists.
 * This one accepts exactly the gateway's own rejections - a policy block, or
 * the transport failure of a forwarded request - and fails the running test
 * on anything else, which keeps the run at least as strict as the default.
 */
import { afterEach, expect } from 'vitest'

/** Rejections the gateway raises by design (src/outbound.ts, and workerd's own transport error) */
const EXPECTED = [/^Network access blocked: /, /^Network connection lost\.?$/]

const unexpected: unknown[] = []

process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  if (!EXPECTED.some((pattern) => pattern.test(message))) unexpected.push(reason)
})

afterEach(() => {
  const seen = unexpected.splice(0)
  expect(seen, `unhandled rejections: ${seen.map(String).join('; ')}`).toEqual([])
})
