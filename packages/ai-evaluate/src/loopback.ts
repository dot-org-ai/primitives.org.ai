/**
 * Loopback bindings of the host worker: `ctx.exports.X` for every named
 * export of its main module, reached through the `exports` export of
 * `cloudflare:workers` so that `evaluate(options, env)` needs no
 * `ExecutionContext` parameter.
 *
 * `evaluate()` binds two of the host's exports this way: `OutboundGateway`
 * (the sandbox's `globalOutbound`, see outbound.ts) and `SandboxHost` (the
 * Durable Object that owns the sandbox's facets, see facets.ts). Outside
 * workerd, on a compatibility date without `ctx.exports`, or when the main
 * module lacks the export, the lookup answers `null` and the caller fails
 * closed with its own message.
 */

/** Module specifier, kept out of the import expression so bundlers leave it to the runtime */
const CLOUDFLARE_WORKERS = 'cloudflare:workers'

/**
 * The host worker's loopback binding for one of its main-module exports, or
 * `null` where there is none.
 */
export async function loopbackExport(name: string): Promise<unknown> {
  let workers: { exports?: Record<string, unknown> } | undefined
  try {
    workers = (await import(/* @vite-ignore */ CLOUDFLARE_WORKERS)) as typeof workers
  } catch {
    return null
  }
  try {
    return workers?.exports?.[name] ?? null
  } catch {
    // `exports` throws where the runtime has no loopback bindings
    return null
  }
}
