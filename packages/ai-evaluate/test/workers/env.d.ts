/**
 * Type `import { env } from 'cloudflare:test'` as the sandbox environment.
 *
 * `@cloudflare/vitest-pool-workers` types `env` as `Cloudflare.Env`; merging
 * `SandboxEnv` into it gives `env.loader` its real type. `PING`, `TAIL` and
 * `KV` are the extra bindings wrangler.test.jsonc declares for the `bindings`
 * and `tails` tests.
 */
import type { SandboxEnv } from '../../src/types.js'
import type { TailEventSummary } from './ping-worker.js'

declare global {
  namespace Cloudflare {
    interface Env extends SandboxEnv {
      /** Service binding to this worker's own `Ping` WorkerEntrypoint (ping-worker.ts) */
      PING: {
        ping(): Promise<string>
        fetch(input: RequestInfo, init?: RequestInit): Promise<Response>
      }
      /** Service binding to this worker's own `TailStub` tail worker (ping-worker.ts) */
      TAIL: {
        count(): Promise<number>
        drain(): Promise<TailEventSummary[]>
        fetch(input: RequestInfo, init?: RequestInit): Promise<Response>
      }
      /** A real KV namespace: a raw host binding the sandbox must never forward */
      KV: KVNamespace
    }
  }
}

export {}
