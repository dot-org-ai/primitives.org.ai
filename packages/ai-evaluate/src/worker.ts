/**
 * Cloudflare Workers entrypoints of ai-evaluate (`ai-evaluate/worker`).
 *
 * A Worker that calls `evaluate()` with a fetch allowlist (`fetch: string[]`)
 * or an `outboundRpc` interceptor must export `OutboundGateway` from its main
 * module, so that `evaluate()` can bind a loopback stub of it
 * (`ctx.exports.OutboundGateway({ props })`) as the sandbox's `globalOutbound`;
 * one that calls it with a `facet` must export `SandboxHost` (with a Durable
 * Object namespace configured in wrangler), so that `evaluate()` can reach
 * the sandbox's facets through `ctx.exports.SandboxHost.getByName(sandboxId)`:
 *
 * ```ts
 * import { evaluate } from 'ai-evaluate'
 * export { OutboundGateway, SandboxHost } from 'ai-evaluate/worker'
 * ```
 *
 * ```jsonc
 * // wrangler.jsonc
 * "durable_objects": { "bindings": [{ "name": "SANDBOX_HOST", "class_name": "SandboxHost" }] },
 * "migrations": [{ "tag": "v1", "new_sqlite_classes": ["SandboxHost"] }]
 * ```
 *
 * Only this module imports `cloudflare:workers`; `ai-evaluate` and
 * `ai-evaluate/node` stay importable outside workerd.
 */

import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers'
import { gatewayFromProps, type OutboundGatewayProps } from './outbound.js'
import { createFacetHost, type FacetHost, type FacetSpec } from './facets.js'
import type { SandboxEnv } from './types.js'

/**
 * The outbound gateway of a sandbox: every global `fetch()` the loaded worker
 * makes arrives here as a request, carrying the sandbox's policy in
 * `ctx.props` (see `OutboundGatewayProps`). The policy itself is
 * `createOutboundGateway` (outbound.ts): interceptor first, then allowlist,
 * then the host worker's own `fetch` for what is allowed. A blocked request
 * throws, and the sandbox's `fetch()` rejects with that message.
 */
export class OutboundGateway extends WorkerEntrypoint<unknown, OutboundGatewayProps> {
  override fetch(request: Request): Promise<Response> {
    return gatewayFromProps(this.ctx.props).fetch(request)
  }
}

/**
 * The Durable Object that owns a sandbox's facets - one instance per
 * `sandboxId` (`getByName`), SQLite-backed so it can hold facets. Each facet
 * runs a class the sandboxed `module` exports, loaded from the facet worker
 * `evaluate()` attaches (through this worker's own `loader` binding), with
 * SQLite storage of its own that outlives the evaluation.
 *
 * The facet stubs never leave this object (workerd does not serialize them):
 * the loaded worker calls `invoke` / `fetchFacet` through a stub of this
 * object, which the generated worker wraps as `env.<binding>`. The logic is
 * `createFacetHost` (facets.ts), which is what the tests exercise.
 */
export class SandboxHost extends DurableObject<SandboxEnv> {
  #host: FacetHost | undefined

  private get host(): FacetHost {
    this.#host ??= createFacetHost(this.ctx, this.env.loader)
    return this.#host
  }

  /** Register the facet `name` with its worker spec (restarts it when the spec's id changed) */
  attach(name: string, spec: FacetSpec): Promise<void> {
    return this.host.attach(name, spec)
  }

  /** Call `method(...args)` on the facet, starting it on first use */
  invoke(name: string, method: string, args: unknown[]): Promise<unknown> {
    return this.host.invoke(name, method, args)
  }

  /** Send a request to the facet's `fetch` handler */
  fetchFacet(name: string, request: Request): Promise<Response> {
    return this.host.fetchFacet(name, request)
  }

  /** Stop the facet and delete its storage */
  detach(name: string): Promise<void> {
    return this.host.detach(name)
  }

  /** Names of the facets attached in this object's lifetime */
  attached(): string[] {
    return this.host.attached()
  }
}
