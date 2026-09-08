/**
 * Type `import { env } from 'cloudflare:test'` as the sandbox environment.
 *
 * `@cloudflare/vitest-pool-workers` types `env` as `Cloudflare.Env`; merging
 * `SandboxEnv` into it gives `env.loader` its real type. `PING` and `KV` are
 * the extra bindings wrangler.test.jsonc declares for the `bindings` tests.
 */
import type { SandboxEnv } from '../../src/types.js'

declare global {
  namespace Cloudflare {
    interface Env extends SandboxEnv {
      /** Service binding to this worker's own `Ping` WorkerEntrypoint (ping-worker.ts) */
      PING: {
        ping(): Promise<string>
        fetch(input: RequestInfo, init?: RequestInit): Promise<Response>
      }
      /** A real KV namespace: a raw host binding the sandbox must never forward */
      KV: KVNamespace
    }
  }
}

export {}
