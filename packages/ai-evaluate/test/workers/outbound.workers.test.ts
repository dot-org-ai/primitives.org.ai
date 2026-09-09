/**
 * Fetch allowlists and `outboundRpc`, enforced as the loaded worker's
 * `globalOutbound` - a loopback stub of the host's `OutboundGateway`
 * entrypoint (ping-worker.ts exports it) - and witnessed against the real
 * `worker_loaders` binding inside workerd.
 *
 * Nothing in these tests reaches the network: an allowed host is answered by
 * an `outboundRpc` mock (the gateway asks it first), or aborted before I/O.
 */
/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { evaluate, buildWorkerCodeWithWarnings } from '../../src/evaluate.js'
import {
  OUTBOUND_JSON_MODULE,
  INTERCEPTOR_UNAVAILABLE_ERROR,
  OUTBOUND_RPC_CACHED_ERROR,
  registeredInterceptorCount,
} from '../../src/outbound.js'
import { workerCodeId } from '../../src/shared.js'

/**
 * A URL the gateway forwards to the host's real `fetch`, which fails at the
 * transport (nothing listens on port 1) - a witness that the request passed
 * the policy, without a network dependency.
 */
const REFUSED_URL = 'http://127.0.0.1:1/'

/** An `outboundRpc` that answers one host from the host side and declines the rest */
function answer(host: string, body = `served ${host}`) {
  const seen: string[] = []
  const outboundRpc = (url: string, request: Request) => {
    seen.push(`${request.method} ${url}`)
    return new URL(url).hostname === host ? new Response(body, { status: 200 }) : null
  }
  return { outboundRpc, seen }
}

describe('fetch allowlist (globalOutbound gateway, workerd)', () => {
  it('the sandbox has no __originalFetch__ to reach past the allowlist', async () => {
    const result = await evaluate(
      {
        script: 'return __originalFetch__("https://example.com").then(r => r.status)',
        fetch: ['api.example.com'],
        timeout: 10000,
      },
      env
    )
    expect(result.success, JSON.stringify(result.value)).toBe(false)
    expect(result.value).toBeUndefined()
    expect(result.error).toMatch(/__originalFetch__ is not defined/)
  })

  it('fetch itself is the untouched global: a host outside the allowlist rejects', async () => {
    const result = await evaluate(
      { script: 'return fetch("https://blocked.test")', fetch: ['api.example.com'] },
      env
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/not in allowlist/)
    expect(result.error).toContain('blocked.test')
  })

  it('an allowed host proxies through the gateway (answered by outboundRpc)', async () => {
    const { outboundRpc, seen } = answer('api.example.com')
    const result = await evaluate(
      {
        script: `
          const response = await fetch('https://api.example.com/data', { method: 'POST', body: 'q' });
          return { status: response.status, body: await response.text() };
        `,
        fetch: ['api.example.com'],
        outboundRpc,
      },
      env
    )
    expect(result.success, result.error).toBe(true)
    expect(result.value).toEqual({ status: 200, body: 'served api.example.com' })
    expect(seen).toEqual(['POST https://api.example.com/data'])
  })

  it('the allowlist is checked against the request URL, not the interceptor', async () => {
    // The interceptor declines everything; the allowlist then blocks the host
    const { outboundRpc, seen } = answer('nobody.test')
    const result = await evaluate(
      {
        script: `
          try {
            await fetch('https://evil.test/x');
            return { blocked: false };
          } catch (e) {
            return { blocked: true, error: e.message };
          }
        `,
        fetch: ['api.example.com'],
        outboundRpc,
      },
      env
    )
    expect(result.success, result.error).toBe(true)
    expect(result.value).toMatchObject({ blocked: true })
    expect((result.value as { error: string }).error).toMatch(/not in allowlist/)
    // It was asked (interceptor first), and declined
    expect(seen).toEqual(['GET https://evil.test/x'])
  })

  it('wildcard patterns admit only the subdomains and the apex', async () => {
    // Admission is witnessed on the pure gateway (test/shared.test.ts): here,
    // what workerd blocks under `*.example.com`
    const result = await evaluate(
      {
        script: `
          const outcomes = {};
          for (const url of ['https://notexample.com/', 'https://example.com.evil.test/', 'https://evil.test/example.com']) {
            try {
              outcomes[url] = (await fetch(url)).status;
            } catch (e) {
              outcomes[url] = e.message;
            }
          }
          return outcomes;
        `,
        fetch: ['*.example.com'],
      },
      env
    )
    expect(result.success, result.error).toBe(true)
    expect(result.value).toEqual({
      'https://notexample.com/':
        'Network access blocked: domain not in allowlist. Attempted: notexample.com',
      'https://example.com.evil.test/':
        'Network access blocked: domain not in allowlist. Attempted: example.com.evil.test',
      'https://evil.test/example.com':
        'Network access blocked: domain not in allowlist. Attempted: evil.test',
    })
  })

  it('a script that catches the blocked fetch still completes', async () => {
    const result = await evaluate(
      {
        script: `
          try {
            await fetch('http://localhost:8080/api');
            return { blocked: false };
          } catch (e) {
            return { blocked: true, error: e.message };
          }
        `,
        fetch: ['api.example.com'],
      },
      env
    )
    expect(result.success, result.error).toBe(true)
    expect(result.value).toMatchObject({ blocked: true })
    expect((result.value as { error: string }).error).toContain('not in allowlist')
  })

  it('the generated worker contains no fetch patch', async () => {
    const { code, release } = await buildWorkerCodeWithWarnings({
      script: 'return 1',
      fetch: ['api.example.com'],
    })
    release()
    const source = code.modules['worker.js']
    expect(typeof source).toBe('string')
    expect(source).not.toContain('globalThis.fetch =')
    expect(source).not.toContain('__originalFetch__')
    expect(source).not.toContain('api.example.com')
    // The policy is on the loader spec instead: a Fetcher stub, and the json
    // module that puts the allowlist into the content-addressed id
    expect(code.globalOutbound).toBeDefined()
    expect(code.globalOutbound).not.toBeNull()
    expect(code.modules[OUTBOUND_JSON_MODULE]).toEqual({
      json: { allowlist: ['api.example.com'] },
    })
  })

  it('two allowlists over the same code are two workers', async () => {
    const a = await buildWorkerCodeWithWarnings({ script: 'return 1', fetch: ['a.com'] })
    const b = await buildWorkerCodeWithWarnings({ script: 'return 1', fetch: ['b.com'] })
    a.release()
    b.release()
    expect(workerCodeId(a.code)).not.toBe(workerCodeId(b.code))
  })

  it('the same allowlist over the same code is one worker: the spec is content-stable', async () => {
    // The policy in `outbound.json` is the allowlist only: nothing per-call
    // reaches the hashed spec, so `'cached'` really does reuse the isolate
    const a = await buildWorkerCodeWithWarnings({ script: 'return 1', fetch: ['a.com'] })
    const b = await buildWorkerCodeWithWarnings({ script: 'return 1', fetch: ['a.com'] })
    a.release()
    b.release()
    expect(workerCodeId(a.code)).toBe(workerCodeId(b.code))
    expect(a.code.modules[OUTBOUND_JSON_MODULE]).toEqual({ json: { allowlist: ['a.com'] } })
  })

  it('a cached isolate is never reused under another allowlist', async () => {
    const script = `
      try {
        return { status: (await fetch('${REFUSED_URL}')).status };
      } catch (e) {
        return { error: e.message };
      }
    `
    // Allowed: forwarded to the real fetch, which fails at the transport
    const first = await evaluate({ script, fetch: ['127.0.0.1'], isolation: 'cached' }, env)
    expect(first.success, first.error).toBe(true)
    expect((first.value as { error: string }).error).not.toMatch(/not in allowlist/)
    // Same code, other allowlist: another isolate, whose gateway blocks it
    const second = await evaluate({ script, fetch: ['b.test'], isolation: 'cached' }, env)
    expect(second.success, second.error).toBe(true)
    expect((second.value as { error: string }).error).toMatch(/not in allowlist/)
  })
})

describe('outboundRpc (workerd)', () => {
  it('serves a host-side response under fetch: true and forwards the rest', async () => {
    const { outboundRpc, seen } = answer('rpc.test', '{"ok":true}')
    const result = await evaluate(
      {
        script: `
          const served = await (await fetch('https://rpc.test/call')).json();
          // Declined by the interceptor and forwarded to the host's real
          // fetch, which fails at the transport: not a policy error
          let forwarded;
          try {
            forwarded = (await fetch('${REFUSED_URL}')).status;
          } catch (e) {
            forwarded = e.message;
          }
          return { served, forwarded };
        `,
        fetch: true,
        outboundRpc,
      },
      env
    )
    expect(result.success, result.error).toBe(true)
    expect(result.value).toMatchObject({ served: { ok: true } })
    expect(String((result.value as { forwarded: unknown }).forwarded)).not.toMatch(
      /allowlist|blocked/
    )
    expect(seen).toEqual(['GET https://rpc.test/call', `GET ${REFUSED_URL}`])
  })

  it('under fetch: false only intercepted requests get through', async () => {
    const { outboundRpc } = answer('rpc.test')
    const result = await evaluate(
      {
        script: `
          const served = (await fetch('https://rpc.test/')).status;
          try {
            await fetch('https://example.com/');
            return { served, other: 'fetched' };
          } catch (e) {
            return { served, other: e.message };
          }
        `,
        fetch: false,
        outboundRpc,
      },
      env
    )
    expect(result.success, result.error).toBe(true)
    expect(result.value).toMatchObject({ served: 200 })
    expect((result.value as { other: string }).other).toMatch(/not in allowlist/)
  })

  it('the interceptor is registered for the evaluation only', async () => {
    const before = registeredInterceptorCount()
    const { outboundRpc } = answer('rpc.test')
    await evaluate({ script: 'return (await fetch("https://rpc.test/")).status', outboundRpc }, env)
    expect(registeredInterceptorCount()).toBe(before)
    // Also released when the evaluation fails
    await evaluate({ script: 'throw new Error("boom")', outboundRpc }, env)
    expect(registeredInterceptorCount()).toBe(before)
  })

  it("with isolation: 'cached' the evaluation is rejected, not silently made fresh", async () => {
    // The interceptor is registered per evaluation under a fresh id, so no
    // two calls could ever share a cached isolate: rather than a unique
    // worker per call with no warning, the combination fails closed, before
    // anything is registered or loaded.
    const before = registeredInterceptorCount()
    const { outboundRpc, seen } = answer('rpc.test')
    const options = {
      script: 'return (await fetch("https://rpc.test/")).status',
      outboundRpc,
      isolation: 'cached' as const,
    }
    const first = await evaluate(options, env)
    const second = await evaluate(options, env)
    for (const result of [first, second]) {
      expect(result.success).toBe(false)
      expect(result.error).toBe(OUTBOUND_RPC_CACHED_ERROR)
    }
    expect(seen).toEqual([])
    expect(registeredInterceptorCount()).toBe(before)
    // The same call under the default ('fresh') isolation runs
    const fresh = await evaluate({ ...options, isolation: 'fresh' }, env)
    expect(fresh.success, fresh.error).toBe(true)
    expect(fresh.value).toBe(200)
  })

  it('a gateway whose interceptor is gone fails closed', async () => {
    const { outboundRpc } = answer('rpc.test')
    const { code, release } = await buildWorkerCodeWithWarnings({
      script: 'return (await fetch("https://rpc.test/")).status',
      fetch: true,
      outboundRpc,
    })
    // The interceptor is released before the worker runs: the stub now names
    // an id the host no longer holds
    release()
    const worker = env.loader!.load(code)
    const response = await worker.getEntrypoint().fetch(new Request('http://sandbox/execute'))
    const result = (await response.json()) as { success: boolean; error?: string }
    expect(result.success).toBe(false)
    expect(result.error).toBe(INTERCEPTOR_UNAVAILABLE_ERROR)
  })
})
