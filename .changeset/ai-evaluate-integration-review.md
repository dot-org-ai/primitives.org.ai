---
'ai-evaluate': patch
---

ai-evaluate: fixes from the 3.0 integration review (aip-263g)

- `limits.subRequests` replaces `limits.subrequests`: workerd's field is camel
  case, so the old spelling was accepted by the loader and silently ignored
  locally and in production. `validateOptions` now rejects `subrequests`
  (aip-263g.35).
- Facets: the facet worker's spec carries `sandbox.json` too, so it is one
  isolate per sandbox. Before, the facet worker (always `loader.get`, env not
  hashed) loaded for the first sandbox served every later `sandboxId` with the
  same module, with the first sandbox's `env` and `bindings` (aip-lrjh.5).
- `validateOptions` checks `fetch` (a string or malformed list no longer fails
  open to "allow all"), `isolation` (aip-263g.38), `outboundRpc` and `jsx`;
  `sandbox.json` is a reserved module name.
- The outbound gateway forwards with `redirect: 'manual'`, so a redirect from
  an allowlisted host is followed by the sandbox through the gateway again,
  never by the gateway.
- The bundler's shared install cache keeps `node_modules` only: one build's
  entry, `package.json` and `files` are no longer readable by a later build
  over the same dependencies.
- `ai-evaluate/codemode`: tool lookup uses own properties only (`constructor`
  is not a tool); `__proto__` is reserved and never a sanitized tool name.
- REPL `setContext(key)` requires an identifier key (it is interpolated into
  every later chunk).
- An `outboundRpc` registration is released if building the facet spec throws.
- Docs: `env` is visible to `script` and `tests`, not to `module` code
  (aip-263g.37, aip-lrjh.12); a `'cached'` isolate keeps the `env`, `bindings`
  and `tails` of the call that loaded it (aip-263g.36); allowlist patterns
  match the hostname only. Each has a workerd witness.
