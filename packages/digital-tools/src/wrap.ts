/**
 * `wrapTool()` — bridge from a `Tool` definition to an HTTP-shaped handler
 * gated by `id.org.ai` brokers.
 *
 * Mirrors id.org.ai's `wrap()` shape but is specific to digital-tools:
 *
 *   1. Calls `AuthBroker.gate(req, need)` to authenticate the caller.
 *      `need` is derived from the tool's `auth` declaration.
 *      On rejection, returns the broker's pre-baked `denialResponse(...)`.
 *
 *   2. When the tool declares `pricing`, calls
 *      `PaymentBroker.settle(req, identity, required)`. On rejection,
 *      returns the broker's pre-baked 402 (`PaymentRejection.response`).
 *      `required` is translated from our local MDXLD `PaymentRequired`
 *      shape into id.org.ai's discriminated `PaymentRequired` (`charge`
 *      intent — `session` intent is not yet supported in 0.3.0 and we
 *      throw a clear error if a tool requests it).
 *
 *   3. Reads `application/json` body, calls `tool.handler(input, ctx)`
 *      with `ctx.identity = Identity` and (when paid) `ctx.paymentReceipt
 *      = PaymentReceipt`. The receipt's `responseHeader` (e.g.
 *      `PAYMENT-RESPONSE` for x402 or `Payment-Receipt` for MPP) is
 *      stamped onto the success response.
 *
 *   4. Tools without `auth` and without `pricing` pass through directly;
 *      the handler is invoked with `ctx.identity` undefined-cast (we set
 *      it to a synthetic anonymous ref) so the handler signature stays
 *      consistent.
 *
 * Tests should pass structural fakes for `AuthBroker` and `PaymentBroker`
 * — both are interfaces in id.org.ai. We intentionally do NOT depend on
 * `AuthBrokerImpl` / `PaymentBrokerImpl` so this module is portable into
 * Workers without pulling concrete adapters.
 *
 * @packageDocumentation
 */

import type {
  AuthBroker,
  AuthRequirement as IdAuthRequirement,
  Identity,
  PaymentBroker,
  PaymentRequired as IdPaymentRequired,
  PaymentReceipt,
  RailQuote,
} from 'id.org.ai'
import { denialResponse } from 'id.org.ai'
import type { AuthRequirement, PaymentRequired, Tool, ToolHandlerContext } from './types.js'

/**
 * Translate the local MDXLD-shaped `AuthRequirement` (scopes + required
 * mechanism) into id.org.ai's typed `AuthRequirement`. We always emit
 * `minLevel: 1` for `oauth`/`apiKey` (a credential must be presented) and
 * `minLevel: 0` for `none` (anonymous OK). Scopes flow through unchanged.
 */
function toIdAuthRequirement(req: AuthRequirement): IdAuthRequirement {
  const minLevel = req.required === 'none' ? 0 : 1
  return {
    minLevel,
    ...(req.scopes.length > 0 && { scopes: req.scopes }),
  }
}

/**
 * Translate the local MDXLD-shaped `PaymentRequired` (single amount +
 * accepted protocols) into id.org.ai's discriminated `PaymentRequired`
 * (`charge` intent with explicit `RailQuote[]`). Each `accepts` entry
 * fans out into `(method)` quotes — we use `exact` for x402 and `tempo`
 * for MPP per phase-1 of `PaymentBrokerImpl`.
 *
 * Throws on `intent: 'session'` style requests — our local
 * `PaymentRequired` doesn't currently model session intent, but if a
 * caller mutates it to add one we surface the limitation early.
 */
function toIdPaymentRequired(pricing: PaymentRequired): IdPaymentRequired {
  // Local `PaymentRequired` doesn't carry an `intent` discriminator;
  // any future widening that does should fail fast here.
  if ((pricing as unknown as { intent?: string }).intent === 'session') {
    throw new Error(
      "wrapTool: 'session' intent pricing is not yet supported (id.org.ai PaymentBroker.session() is not implemented in 0.3.0). " +
        "Use 'charge' intent or wait for the next id.org.ai release."
    )
  }

  const accepts: RailQuote[] = pricing.accepts.map((protocol): RailQuote => {
    if (protocol === 'x402') {
      return {
        rail: { protocol: 'x402', method: 'exact', asset: pricing.currency },
        amount: pricing.amount,
        asset: pricing.currency,
        payTo: pricing.recipient,
      }
    }
    // protocol === 'mpp'
    return {
      rail: { protocol: 'mpp', method: 'tempo', asset: pricing.currency },
      amount: pricing.amount,
      asset: pricing.currency,
      payTo: pricing.recipient,
    }
  })

  return {
    intent: 'charge',
    accepts,
  }
}

/**
 * Read the request body as JSON. Returns `undefined` for empty bodies
 * and non-JSON content types so tools with no input still work.
 */
async function readJsonBody(req: Request): Promise<unknown> {
  const ct = req.headers.get('content-type') ?? ''
  if (!ct.toLowerCase().includes('application/json')) return undefined
  const text = await req.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/**
 * Build a JSON `Response` for a successful tool invocation. Stamps the
 * payment receipt's `responseHeader` (e.g. `PAYMENT-RESPONSE` for x402
 * or `Payment-Receipt` for MPP) when present.
 */
function jsonOk(body: unknown, receipt?: PaymentReceipt): Response {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (receipt?.responseHeader) {
    const [name, value] = receipt.responseHeader
    headers[name] = value
  }
  return new Response(JSON.stringify(body), { status: 200, headers })
}

/**
 * Build a JSON error `Response`.
 */
function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, error_description: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/**
 * Wrap a Tool with broker-aware HTTP handling.
 *
 * @param broker         AuthBroker (id.org.ai). Required when the tool has `auth`.
 * @param paymentBroker  PaymentBroker (id.org.ai). Required when the tool has `pricing`.
 * @param tool           The tool definition.
 * @returns A function `(req: Request) => Promise<Response>` honoring the
 *          tool's `auth` and `pricing` declarations.
 *
 * @example
 * ```ts
 * const handler = wrapTool(authBroker, paymentBroker, sendEmailTool)
 * // Use as a Worker fetch handler:
 * export default { fetch: handler }
 * ```
 *
 * Tools without `auth` / `pricing` pass through with no broker calls.
 * In that case the broker arguments may still be provided but are unused.
 */
export function wrapTool<TInput, TOutput>(
  broker: AuthBroker | undefined,
  paymentBroker: PaymentBroker | undefined,
  tool: Tool<TInput, TOutput>
): (req: Request) => Promise<Response> {
  // Pre-translate auth/pricing once so per-request work stays minimal,
  // and so a `session`-intent pricing fails at wrap-time rather than at
  // first request — easier to debug.
  const idAuth = tool.auth ? toIdAuthRequirement(tool.auth) : null
  const idPricing = tool.pricing ? toIdPaymentRequired(tool.pricing) : null

  return async function wrappedTool(req: Request): Promise<Response> {
    let identity: Identity | undefined
    let receipt: PaymentReceipt | undefined

    // --- Auth gate ----------------------------------------------------
    if (idAuth) {
      if (!broker) {
        return jsonError(
          500,
          'configuration_error',
          `Tool "${tool.id}" declares auth but no AuthBroker was provided to wrapTool()`
        )
      }
      const decision = await broker.gate(req, idAuth)
      if (!decision.ok) {
        return denialResponse(decision)
      }
      identity = decision.identity
    }

    // --- Payment settle ----------------------------------------------
    if (idPricing) {
      if (!paymentBroker) {
        return jsonError(
          500,
          'configuration_error',
          `Tool "${tool.id}" declares pricing but no PaymentBroker was provided to wrapTool()`
        )
      }
      // Auth is required for paid tools so we have an Identity to settle
      // against. If a tool has pricing without auth we fall back to a
      // synthetic anonymous identity — the broker still accepts it but
      // rail negotiation will fail unless the request carries proof.
      const settleIdentity: Identity = identity ?? {
        id: 'anonymous',
        type: 'agent',
        name: 'anonymous',
        verified: false,
        level: 0,
        claimStatus: 'unclaimed',
      }
      const outcome = await paymentBroker.settle(req, settleIdentity, idPricing)
      if (!outcome.ok) {
        return outcome.response
      }
      receipt = outcome
    }

    // --- Invoke handler -----------------------------------------------
    let input: TInput
    try {
      input = (await readJsonBody(req)) as TInput
    } catch {
      return jsonError(400, 'invalid_request', 'Could not parse request body as JSON')
    }

    const ctx: ToolHandlerContext = {
      identity: identity ?? 'anonymous',
      ...(receipt && { paymentReceipt: receipt }),
    }

    try {
      const result = await tool.handler(input, ctx)
      return jsonOk(result, receipt)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return jsonError(500, 'execution_error', message)
    }
  }
}

/**
 * Internal: exported only for tests. Turn a local MDXLD `PaymentRequired`
 * into id.org.ai's `PaymentRequired`. Throws on session intent.
 */
export const __toIdPaymentRequired = toIdPaymentRequired

/**
 * Internal: exported only for tests. Turn a local `AuthRequirement`
 * into id.org.ai's `AuthRequirement`.
 */
export const __toIdAuthRequirement = toIdAuthRequirement
