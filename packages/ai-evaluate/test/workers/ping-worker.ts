/**
 * Main module of the workers-pool test worker (wrangler.test.jsonc `main`).
 *
 * `Ping` is a WorkerEntrypoint service the suite binds to itself as `env.PING`
 * so tests can hand a real RPC stub to `evaluate({ bindings })` and witness
 * the loaded worker calling back into it.
 *
 * `TailStub` is a tail worker the suite binds to itself as `env.TAIL`: passed
 * via `evaluate({ tails })`, the loaded worker's trace events land in its
 * `tail()` handler. It keeps a structured-cloneable summary of each event
 * (a `TraceItem` itself cannot cross RPC) that tests read back with
 * `count()` / `drain()`.
 *
 * `OutboundGateway` is what any host worker that calls `evaluate()` with a
 * fetch allowlist or `outboundRpc` must export: `evaluate()` binds a loopback
 * stub of it (`ctx.exports.OutboundGateway`) as the sandbox's `globalOutbound`.
 */
import { WorkerEntrypoint } from 'cloudflare:workers'

export { OutboundGateway } from '../../src/worker.js'

export class Ping extends WorkerEntrypoint {
  ping(): string {
    return 'pong'
  }
}

/** A trace event as `TailStub` records it: plain data, safe to return over RPC */
export interface TailEventSummary {
  outcome: string
  logs: { level: string; message: unknown[] }[]
  exceptions: { name: string; message: string }[]
}

/** Events received by `TailStub.tail()`, in arrival order (module scope: per isolate) */
const receivedTailEvents: TailEventSummary[] = []

export class TailStub extends WorkerEntrypoint {
  tail(events: TraceItem[]): void {
    for (const event of events) {
      receivedTailEvents.push({
        outcome: event.outcome,
        logs: event.logs.map((log) => ({ level: log.level, message: log.message })),
        exceptions: event.exceptions.map((error) => ({ name: error.name, message: error.message })),
      })
    }
  }

  count(): number {
    return receivedTailEvents.length
  }

  drain(): TailEventSummary[] {
    return receivedTailEvents.splice(0)
  }
}

export default {
  fetch(): Response {
    return new Response('ping worker', { status: 404 })
  },
}
