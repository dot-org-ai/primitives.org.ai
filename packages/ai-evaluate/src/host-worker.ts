/**
 * Host worker for ai-evaluate
 *
 * A minimal Cloudflare Worker whose only job is to run `evaluate()` against
 * its own `loader` (worker_loaders) binding on `POST /evaluate`.
 *
 * This module is the single code path for local and production sandboxing:
 * - Deploy it with wrangler (`"worker_loaders": [{ "binding": "loader" }]`) to get a
 *   hosted sandbox endpoint.
 * - `ai-evaluate/node` loads this same module (and what it imports) into a
 *   Miniflare 5 host worker with a real `loader` binding, so local behaviour
 *   is the behaviour of Dynamic Workers rather than a separate dev template.
 */

import { evaluate } from './evaluate.js'
import { EVALUATE_PATH } from './shared.js'
import type { EvaluateOptions, EvaluateResult, SandboxEnv } from './types.js'

/**
 * The outbound gateway entrypoint, exported so `evaluate()` can bind it as
 * the sandbox's `globalOutbound` for `fetch: string[]` / `outboundRpc` (a
 * loopback stub via `ctx.exports`, see outbound.ts). A Worker of your own
 * that calls `evaluate()` needs the same export from its main module.
 */
export { OutboundGateway } from './worker.js'

/**
 * Handle one host-worker request.
 *
 * `POST /evaluate` with an `EvaluateOptions` JSON body returns the
 * `EvaluateResult` as JSON. Anything else is 404.
 *
 * Besides `OutboundGateway` only the default export leaves this module:
 * workerd requires every named export of a main module to be a handler.
 */
async function handleRequest(request: Request, env: SandboxEnv): Promise<Response> {
  const url = new URL(request.url)
  if (request.method !== 'POST' || url.pathname !== EVALUATE_PATH) {
    return new Response('Not Found', { status: 404 })
  }

  let options: EvaluateOptions
  try {
    options = (await request.json()) as EvaluateOptions
  } catch (error) {
    const result: EvaluateResult = {
      success: false,
      logs: [],
      error: `Invalid evaluate request body: ${
        error instanceof Error ? error.message : String(error)
      }`,
      duration: 0,
    }
    return Response.json(result, { status: 400 })
  }

  return Response.json(await evaluate(options, env))
}

export default {
  fetch: handleRequest,
}
