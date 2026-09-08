/**
 * Type `import { env } from 'cloudflare:test'` as the sandbox environment.
 *
 * `@cloudflare/vitest-pool-workers` types `env` as `Cloudflare.Env`; merging
 * `SandboxEnv` into it gives `env.LOADER` / `env.TEST` their real types.
 */
import type { SandboxEnv } from '../../src/types.js'

declare global {
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends SandboxEnv {}
  }
}

export {}
