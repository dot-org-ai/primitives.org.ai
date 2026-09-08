/**
 * Outbound gateway: the network policy of a sandboxed worker, enforced by the
 * runtime rather than by code inside the isolate.
 *
 * A loaded worker's `globalOutbound` is the `Fetcher` every global `fetch()`
 * in it goes through. For `fetch: false | null` it is `null` (no outbound at
 * all). For a domain allowlist, or an `outboundRpc` interceptor, it is a stub
 * of the host worker's `OutboundGateway` entrypoint (see `./worker.ts`),
 * created through the host's loopback bindings (`ctx.exports`) with the policy
 * in `props`. The sandbox cannot reach past it: there is no `__originalFetch__`
 * in module scope, no reassigned `globalThis.fetch`, nothing to unpatch.
 *
 * This module is the pure part - the policy (`createOutboundGateway`), the
 * decision of when a gateway is needed (`outboundPolicy`) and the loopback
 * lookup - and imports nothing Workers-specific, so `evaluate()` and the Node
 * host can import it. The `WorkerEntrypoint` class lives in `./worker.ts`.
 *
 * workerd will not accept an entrypoint of a dynamically loaded worker as
 * another worker's `globalOutbound` ("the system does not know how to reload
 * this Worker from scratch"), which is why the gateway is an entrypoint of the
 * host worker itself, and why the host's main module must export it.
 */

import type { EvaluateOptions } from './types.js'
import { isDomainAllowed } from './shared.js'

/**
 * Name of the entrypoint the host worker's main module must export for
 * `fetch: string[]` and `outboundRpc` to work: `ctx.exports.OutboundGateway`.
 */
export const OUTBOUND_GATEWAY_EXPORT = 'OutboundGateway'

/**
 * The json module that carries the outbound policy into the content-addressed
 * `WorkerCode` spec (as `package.json` does for dependencies): the same code
 * under two allowlists is two workers, and a `'cached'` isolate is never
 * reused under a policy other than the one it was loaded with.
 */
export const OUTBOUND_JSON_MODULE = 'outbound.json'

/**
 * Error reported when a policy needs the gateway and the host worker does not
 * export it (or runs on a compatibility date without `ctx.exports`).
 */
export const OUTBOUND_GATEWAY_UNAVAILABLE_ERROR =
  'fetch allowlist and outboundRpc need the OutboundGateway entrypoint of the host worker: ' +
  "add `export { OutboundGateway } from 'ai-evaluate/worker'` to the main module of the Worker " +
  'that calls evaluate() (compatibility date 2025-11-17 or later, for ctx.exports); ' +
  'the local host of ai-evaluate/node exports it already'

/**
 * Error the gateway throws when its `props` name an `outboundRpc` interceptor
 * that this isolate does not hold. The interceptor is a host-side function and
 * cannot cross an isolate boundary, so a request that would need it fails
 * closed instead of going to the network.
 */
export const INTERCEPTOR_UNAVAILABLE_ERROR =
  'Network access blocked: the outboundRpc interceptor for this sandbox is not available in ' +
  'the isolate serving its outbound gateway'

/**
 * A host-side interceptor for the sandbox's outbound requests
 * (`EvaluateOptions.outboundRpc`): it is asked first, for every request; a
 * `Response` answers the request, `null` declines it (the allowlist then
 * decides, and the request goes to the network if allowed).
 */
export type OutboundInterceptor = (
  url: string,
  request: Request
) => Promise<Response | null> | Response | null

/**
 * What the gateway entrypoint receives as `ctx.props`: structured-cloneable
 * only (a loopback stub's `props` are cloned, never serialized for RPC).
 */
export interface OutboundGatewayProps {
  /** Allowed hosts (wildcards: `*.example.com`); `null` for no host restriction */
  allowlist: string[] | null
  /** Registry id of the host-side `outboundRpc` interceptor, when one is set */
  interceptor?: string
}

/**
 * The gateway as a `Fetcher`-shaped object: what the `OutboundGateway`
 * entrypoint delegates to, and what tests exercise without a runtime.
 */
export interface OutboundGateway {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>
}

/** The error a request to a host outside the allowlist fails with */
export function blockedHostError(url: string): Error {
  let host = url
  try {
    host = new URL(url).hostname
  } catch {
    // Not a URL: report it as given
  }
  return new Error(`Network access blocked: domain not in allowlist. Attempted: ${host}`)
}

/**
 * Create the outbound policy for one sandbox.
 *
 * `fetch(request)` asks `outboundRpc` first when there is one (a `Response`
 * answers the request), then checks the host against `allowlist` with
 * `isDomainAllowed` - `null` means no restriction - and forwards allowed
 * requests to `upstream` (the host worker's own `fetch` by default). A
 * blocked request rejects with `blockedHostError`, so the sandbox's `fetch()`
 * throws rather than receiving a response.
 *
 * The interceptor sees a clone of a request that has a body, so a request it
 * declines can still be forwarded.
 */
export function createOutboundGateway(
  allowlist: readonly string[] | null,
  outboundRpc?: OutboundInterceptor,
  upstream: (request: Request) => Promise<Response> = (request) => fetch(request)
): OutboundGateway {
  const hosts = allowlist === null ? null : [...allowlist]
  return {
    async fetch(input, init) {
      const request =
        input instanceof Request && init === undefined ? input : new Request(input, init)
      if (outboundRpc) {
        const intercepted = await outboundRpc(request.url, request.body ? request.clone() : request)
        if (intercepted) return intercepted
      }
      if (hosts !== null && !isDomainAllowed(request.url, hosts)) {
        throw blockedHostError(request.url)
      }
      return upstream(request)
    },
  }
}

/**
 * Host-side interceptors by id, for the gateway entrypoint to look up from
 * `ctx.props.interceptor`. Module scope: the loopback entrypoint that serves a
 * sandbox's outbound runs in the host worker, and a function cannot travel in
 * `props`. An id that this isolate does not hold fails closed
 * (`INTERCEPTOR_UNAVAILABLE_ERROR`).
 */
const interceptors = new Map<string, OutboundInterceptor>()

/** Register an interceptor for the duration of one evaluation; returns its id */
export function registerInterceptor(interceptor: OutboundInterceptor): string {
  const id = crypto.randomUUID()
  interceptors.set(id, interceptor)
  return id
}

/** Forget a registered interceptor (a no-op for an unknown id) */
export function releaseInterceptor(id: string): void {
  interceptors.delete(id)
}

/** Number of interceptors currently registered (test observability) */
export function registeredInterceptorCount(): number {
  return interceptors.size
}

/**
 * The gateway for a set of `props`, as the `OutboundGateway` entrypoint
 * builds it per request.
 *
 * @throws Error (`INTERCEPTOR_UNAVAILABLE_ERROR`) when `props.interceptor`
 *   names an interceptor this isolate does not hold
 */
export function gatewayFromProps(props: OutboundGatewayProps): OutboundGateway {
  let interceptor: OutboundInterceptor | undefined
  if (props.interceptor !== undefined) {
    interceptor = interceptors.get(props.interceptor)
    if (!interceptor) throw new Error(INTERCEPTOR_UNAVAILABLE_ERROR)
  }
  return createOutboundGateway(props.allowlist, interceptor)
}

/**
 * Whether an evaluation needs the gateway, and under which allowlist.
 *
 * - `fetch: string[]` - the allowlist, always through the gateway;
 * - `fetch: false | null` - no gateway (`globalOutbound: null` is the
 *   enforcement) unless `outboundRpc` is set, in which case the gateway
 *   serves intercepted requests and blocks every other host (`[]`);
 * - `fetch: true` / absent - no gateway unless `outboundRpc` is set, in
 *   which case the gateway intercepts and forwards everything else (`null`).
 *
 * Returns `null` when no gateway is needed.
 */
export function outboundPolicy(
  options: Pick<EvaluateOptions, 'fetch' | 'outboundRpc'>
): { allowlist: string[] | null } | null {
  const { fetch: fetchOption, outboundRpc } = options
  if (Array.isArray(fetchOption)) return { allowlist: [...fetchOption] }
  if (!outboundRpc) return null
  return { allowlist: fetchOption === false || fetchOption === null ? [] : null }
}

/** A loopback binding of the host's `OutboundGateway` export: `ctx.exports.OutboundGateway` */
export type OutboundGatewayFactory = (options: { props: OutboundGatewayProps }) => unknown

/** Module specifier, kept out of the import expression so bundlers leave it to the runtime */
const CLOUDFLARE_WORKERS = 'cloudflare:workers'

/**
 * The host worker's loopback binding for its `OutboundGateway` export, or
 * `null` where there is none: outside workerd (Node), on a compatibility date
 * without `ctx.exports`, or when the main module does not export the class.
 *
 * `cloudflare:workers` exposes the current worker's loopback bindings as
 * `exports`, which is how `evaluate(options, env)` reaches the gateway without
 * an `ExecutionContext` parameter.
 */
export async function loopbackOutboundGateway(): Promise<OutboundGatewayFactory | null> {
  let workers: { exports?: Record<string, unknown> } | undefined
  try {
    workers = (await import(/* @vite-ignore */ CLOUDFLARE_WORKERS)) as typeof workers
  } catch {
    return null
  }
  let factory: unknown
  try {
    factory = workers?.exports?.[OUTBOUND_GATEWAY_EXPORT]
  } catch {
    // `exports` throws where the runtime has no loopback bindings
    return null
  }
  return typeof factory === 'function' ? (factory as OutboundGatewayFactory) : null
}
