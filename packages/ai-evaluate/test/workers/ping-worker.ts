/**
 * Main module of the workers-pool test worker (wrangler.test.jsonc `main`).
 *
 * `Ping` is a WorkerEntrypoint service the suite binds to itself as `env.PING`
 * so tests can hand a real RPC stub to `evaluate({ bindings })` and witness
 * the loaded worker calling back into it.
 */
import { WorkerEntrypoint } from 'cloudflare:workers'

export class Ping extends WorkerEntrypoint {
  ping(): string {
    return 'pong'
  }
}

export default {
  fetch(): Response {
    return new Response('ping worker', { status: 404 })
  },
}
