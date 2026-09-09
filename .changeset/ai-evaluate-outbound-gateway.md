---
'ai-evaluate': major
---

ai-evaluate: enforce fetch allowlists and `outboundRpc` with a `globalOutbound` gateway, not an in-isolate fetch patch (aip-263g.7)

**Breaking:** a `fetch: string[]` allowlist (and `outboundRpc`) now needs the
`OutboundGateway` entrypoint exported from the main module of the Worker that
calls `evaluate()`: `export { OutboundGateway } from 'ai-evaluate/worker'`
(new subpath; compatibility date `2025-11-17` or later for `ctx.exports`).
Without it an evaluation that needs the gateway fails closed with an error
result. The Miniflare host of `ai-evaluate/node` exports it already.

- 2.x rebound `globalThis.fetch` inside the sandbox and kept the original as
  `__originalFetch__` in module scope, where the sandboxed code could reach it
  (and the prototype's `fetch` was another way past an own-property patch).
  The generated worker no longer contains any fetch control; the policy is
  the loader's `globalOutbound`: `null` for `fetch: false | null`, and for an
  allowlist or `outboundRpc` a loopback stub of `OutboundGateway` with the
  policy in its `props`. A blocked request still rejects with
  `Network access blocked: domain not in allowlist. Attempted: <host>`; a
  `fetch: false` sandbox now sees workerd's own message instead of the
  template's "fetch is disabled in this sandbox".
- `outboundRpc` works: the gateway asks it first for every request (a
  `Response` answers, `null` declines to the `fetch` policy). It is a host
  function registered for the duration of the evaluation; `ai-evaluate/node`
  without a host env rejects it, as it does `bindings` and `tails`.
- The allowlist joins the content-addressed spec as the `outbound.json`
  module, so a `'cached'` isolate is never reused under another policy.
- New `src/outbound.ts`: `createOutboundGateway(allowlist, outboundRpc?,
  upstream?)`, `outboundPolicy`, `blockedHostError`, and the gateway's
  constants, exported from `ai-evaluate`. `generateDomainCheckCode`,
  `generateFetchControlCode`, `getDomainCheckCode` and the `fetch` option of
  `generateWorkerCode` / `buildWorkerTemplate` are gone.
- `buildWorkerCodeWithWarnings` returns `release()`, which forgets the
  registered interceptor once the loaded worker is done.
