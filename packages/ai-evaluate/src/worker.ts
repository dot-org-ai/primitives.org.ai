/**
 * Cloudflare Workers entrypoints of ai-evaluate (`ai-evaluate/worker`).
 *
 * A Worker that calls `evaluate()` with a fetch allowlist (`fetch: string[]`)
 * or an `outboundRpc` interceptor must export `OutboundGateway` from its main
 * module, so that `evaluate()` can bind a loopback stub of it
 * (`ctx.exports.OutboundGateway({ props })`) as the sandbox's `globalOutbound`:
 *
 * ```ts
 * import { evaluate } from 'ai-evaluate'
 * export { OutboundGateway } from 'ai-evaluate/worker'
 * ```
 *
 * Only this module imports `cloudflare:workers`; `ai-evaluate` and
 * `ai-evaluate/node` stay importable outside workerd.
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
import { gatewayFromProps, type OutboundGatewayProps } from './outbound.js'

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
