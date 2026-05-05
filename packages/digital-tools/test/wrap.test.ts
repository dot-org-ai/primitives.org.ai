/**
 * Tests for `wrapTool()` — broker-aware HTTP wrapping for Tools.
 *
 * We use structural fakes for `AuthBroker` and `PaymentBroker` rather
 * than `AuthBrokerImpl` / `PaymentBrokerImpl` so the suite stays
 * portable and doesn't pull DO/HTTP plumbing into the worker bundle.
 */

import { describe, it, expect } from 'vitest'
import type {
  AuthBroker,
  AuthDecision,
  Identity,
  PaymentBroker,
  PaymentInstrument,
  PaymentOutcome,
  PaymentReceipt,
  PaymentSession,
  SessionRequired,
} from 'id.org.ai'
import { defineTool, wrapTool, type Tool } from '../src/index.js'
import { __toIdAuthRequirement, __toIdPaymentRequired } from '../src/wrap.js'

// ---------- Test helpers --------------------------------------------------

/** Minimal Identity for fakes — fills the L0/L1 anonymous shape. */
const fakeIdentity = (over: Partial<Identity> = {}): Identity => ({
  id: 'agent:alice',
  type: 'agent',
  name: 'Alice',
  verified: true,
  level: 1,
  claimStatus: 'claimed',
  scopes: ['email:send'],
  ...over,
})

/** Builds an AuthBroker that always grants. */
function fakeAuthBrokerOk(identity = fakeIdentity()): AuthBroker {
  return {
    async gate(): Promise<AuthDecision> {
      return { ok: true, identity }
    },
    async identify() {
      return identity
    },
    check(id): AuthDecision {
      return { ok: true, identity: id }
    },
  }
}

/** Builds an AuthBroker that always denies. */
function fakeAuthBrokerDeny(): AuthBroker {
  return {
    async gate(): Promise<AuthDecision> {
      // Pre-baked denial response — wrapTool returns it directly.
      return {
        ok: false,
        identity: null,
        reason: 'unauthenticated',
        response: new Response(
          JSON.stringify({
            error: 'unauthenticated',
            error_description: 'No credential presented',
            reason: 'unauthenticated',
          }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }
        ),
      }
    },
    async identify() {
      return fakeIdentity({ level: 0, verified: false })
    },
    check(): AuthDecision {
      return {
        ok: false,
        identity: null,
        reason: 'unauthenticated',
      }
    },
  }
}

/** Builds a PaymentBroker that always settles successfully. */
function fakePaymentBrokerOk(): PaymentBroker {
  const receipt: PaymentReceipt = {
    ok: true,
    rail: { protocol: 'x402', method: 'exact', asset: 'USDC' },
    amount: '0.01',
    asset: 'USDC',
    txRef: '0xdeadbeef',
    settledAt: 1700000000,
    responseHeader: ['PAYMENT-RESPONSE', 'eyJzdGF0dXMiOiJzZXR0bGVkIn0='],
  }
  return {
    async settle(): Promise<PaymentOutcome> {
      return receipt
    },
    async session(_id, _req: SessionRequired): Promise<PaymentSession> {
      throw new Error('not used in these tests')
    },
    async instrumentsFor(): Promise<PaymentInstrument[]> {
      return []
    },
  }
}

/** Builds a PaymentBroker that always rejects. */
function fakePaymentBrokerDeny(): PaymentBroker {
  return {
    async settle(): Promise<PaymentOutcome> {
      return {
        ok: false,
        reason: 'no-payment',
        response: new Response(JSON.stringify({ error: 'payment_required' }), {
          status: 402,
          headers: {
            'content-type': 'application/json',
            'WWW-Authenticate': 'Payment realm="test"',
          },
        }),
      }
    },
    async session(_id, _req: SessionRequired): Promise<PaymentSession> {
      throw new Error('not used in these tests')
    },
    async instrumentsFor(): Promise<PaymentInstrument[]> {
      return []
    },
  }
}

// ---------- Tests --------------------------------------------------------

describe('wrapTool', () => {
  it('passes through tools without auth or pricing', async () => {
    const tool = defineTool({
      id: 'svo.passthrough',
      name: 'Passthrough',
      description: 'No auth, no pricing',
      category: 'data',
      input: { type: 'object', properties: { x: { type: 'number' } } },
      handler: async (input: { x: number }) => ({ doubled: input.x * 2 }),
    })

    const handler = wrapTool(undefined, undefined, tool)
    const req = new Request('https://example.com/tool', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ x: 21 }),
    })

    const res = await handler(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { doubled: number }
    expect(body).toEqual({ doubled: 42 })
  })

  it('calls AuthBroker.gate() and threads Identity into ctx on success', async () => {
    const tool = defineTool({
      id: 'svo.auth.ok',
      name: 'Auth OK',
      description: 'Tool with auth that succeeds',
      category: 'communication',
      auth: { scopes: ['email:send'], required: 'oauth' },
      input: { type: 'object', properties: {} },
      handler: async (_input, ctx) => {
        // Identity should be the full Identity record from the broker
        const id = ctx?.identity
        if (typeof id === 'string') {
          throw new Error('expected Identity object, got string')
        }
        return { caller: id?.id, verified: id?.verified }
      },
    })

    const handler = wrapTool(fakeAuthBrokerOk(), undefined, tool)
    const req = new Request('https://example.com/tool', { method: 'POST' })
    const res = await handler(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { caller: string; verified: boolean }
    expect(body).toEqual({ caller: 'agent:alice', verified: true })
  })

  it('returns the broker denial response when auth fails', async () => {
    const tool = defineTool({
      id: 'svo.auth.deny',
      name: 'Auth Deny',
      description: 'Tool with auth that fails',
      category: 'communication',
      auth: { scopes: ['email:send'], required: 'oauth' },
      input: { type: 'object', properties: {} },
      handler: async () => {
        throw new Error('handler should not be called')
      },
    })

    const handler = wrapTool(fakeAuthBrokerDeny(), undefined, tool)
    const req = new Request('https://example.com/tool', { method: 'POST' })
    const res = await handler(req)
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error: string; reason: string }
    expect(body.reason).toBe('unauthenticated')
  })

  it('returns 500 when auth is declared but no broker is provided', async () => {
    const tool = defineTool({
      id: 'svo.auth.misconfig',
      name: 'Auth Misconfigured',
      description: 'Auth declared without broker',
      category: 'data',
      auth: { scopes: ['x'], required: 'oauth' },
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })
    const handler = wrapTool(undefined, undefined, tool)
    const res = await handler(new Request('https://example.com/x', { method: 'POST' }))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('configuration_error')
  })

  it('calls PaymentBroker.settle() and threads PaymentReceipt into ctx + response header', async () => {
    const tool = defineTool({
      id: 'svo.pay.ok',
      name: 'Paid Tool',
      description: 'Tool with pricing that succeeds',
      category: 'data',
      auth: { scopes: [], required: 'apiKey' },
      pricing: {
        $type: 'PaymentRequired',
        amount: '0.01',
        currency: 'USDC',
        accepts: ['x402'],
        recipient: '0xfeed',
      },
      input: { type: 'object', properties: {} },
      handler: async (_input, ctx) => {
        const receipt = ctx?.paymentReceipt
        return { settled: receipt?.ok, txRef: receipt?.txRef }
      },
    })

    const handler = wrapTool(fakeAuthBrokerOk(), fakePaymentBrokerOk(), tool)
    const res = await handler(new Request('https://example.com/x', { method: 'POST' }))
    expect(res.status).toBe(200)
    // The receipt's responseHeader should be stamped onto the response.
    expect(res.headers.get('PAYMENT-RESPONSE')).toBe('eyJzdGF0dXMiOiJzZXR0bGVkIn0=')
    const body = (await res.json()) as { settled: boolean; txRef: string }
    expect(body).toEqual({ settled: true, txRef: '0xdeadbeef' })
  })

  it('returns the broker 402 response when payment fails', async () => {
    const tool = defineTool({
      id: 'svo.pay.deny',
      name: 'Paid Tool',
      description: 'Tool with pricing that fails',
      category: 'data',
      auth: { scopes: [], required: 'apiKey' },
      pricing: {
        $type: 'PaymentRequired',
        amount: '0.01',
        currency: 'USDC',
        accepts: ['x402', 'mpp'],
        recipient: '0xfeed',
      },
      input: { type: 'object', properties: {} },
      handler: async () => {
        throw new Error('handler should not be called')
      },
    })

    const handler = wrapTool(fakeAuthBrokerOk(), fakePaymentBrokerDeny(), tool)
    const res = await handler(new Request('https://example.com/x', { method: 'POST' }))
    expect(res.status).toBe(402)
    expect(res.headers.get('WWW-Authenticate')).toContain('Payment')
  })

  it('returns 500 when pricing is declared but no PaymentBroker is provided', async () => {
    const tool = defineTool({
      id: 'svo.pay.misconfig',
      name: 'Paid Misconfigured',
      description: 'Pricing declared without broker',
      category: 'data',
      pricing: {
        $type: 'PaymentRequired',
        amount: '0.01',
        currency: 'USDC',
        accepts: ['x402'],
        recipient: '0xfeed',
      },
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })
    // Only auth broker provided (none required for this tool — no `auth`),
    // but the payment broker is missing.
    const handler = wrapTool(undefined, undefined, tool)
    const res = await handler(new Request('https://example.com/x', { method: 'POST' }))
    expect(res.status).toBe(500)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('configuration_error')
  })

  it('throws at wrap-time when a tool tries to use session intent', () => {
    // Local PaymentRequired doesn't model `intent: 'session'`, but we
    // surface the limitation if a caller hands us a shape that does.
    // Cast through `unknown` since the local type doesn't expose the
    // discriminator yet.
    const tool: Tool = {
      id: 'svo.pay.session',
      name: 'Session Tool',
      description: 'Hypothetical session-intent pricing',
      category: 'data',
      parameters: [],
      pricing: {
        // Pretend a future widening allows this shape.
        intent: 'session',
        $type: 'PaymentRequired',
        amount: '1.00',
        currency: 'USDC',
        accepts: ['mpp'],
        recipient: '0xfeed',
      } as unknown as Tool['pricing'],
      handler: async () => ({}),
    }

    expect(() => wrapTool(undefined, fakePaymentBrokerOk(), tool)).toThrow(
      /session.*not yet supported/i
    )
  })

  it('translates AuthRequirement: oauth -> minLevel 1 with scopes', () => {
    const out = __toIdAuthRequirement({ scopes: ['email:send', 'admin'], required: 'oauth' })
    expect(out).toEqual({ minLevel: 1, scopes: ['email:send', 'admin'] })
  })

  it('translates AuthRequirement: none -> minLevel 0, no scopes when empty', () => {
    const out = __toIdAuthRequirement({ scopes: [], required: 'none' })
    expect(out).toEqual({ minLevel: 0 })
  })

  it('translates PaymentRequired: x402 + mpp -> charge intent with two RailQuotes', () => {
    const out = __toIdPaymentRequired({
      $type: 'PaymentRequired',
      amount: '0.05',
      currency: 'USDC',
      accepts: ['x402', 'mpp'],
      recipient: '0xfeed',
    })
    if (!('intent' in out) || out.intent !== 'charge') {
      throw new Error('expected charge intent')
    }
    expect(out.accepts).toHaveLength(2)
    expect(out.accepts[0].rail.protocol).toBe('x402')
    expect(out.accepts[0].rail.method).toBe('exact')
    expect(out.accepts[1].rail.protocol).toBe('mpp')
    expect(out.accepts[1].rail.method).toBe('tempo')
    // amount + payTo flow through unchanged.
    expect(out.accepts[0].amount).toBe('0.05')
    expect(out.accepts[0].payTo).toBe('0xfeed')
  })
})
