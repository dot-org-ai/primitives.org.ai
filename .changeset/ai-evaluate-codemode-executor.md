---
'ai-evaluate': minor
---

ai-evaluate: `ai-evaluate/codemode` - an `Executor` for `@cloudflare/codemode` on top of `evaluate()`; `EvaluateOptions.modules` (aip-263g.11)

- New subpath `ai-evaluate/codemode` exporting `createExecutor(options)`: a
  `@cloudflare/codemode` (0.5+) `Executor` that runs the agent's code through
  `evaluate()` in place of the stock `DynamicWorkerExecutor`, so it gets the
  outbound gateway, content-addressed isolates, `timeout` as the CPU budget,
  `limits`, `tails` and npm `dependencies`. Options are codemode's own
  (`loader`, `timeout` default 60000, `globalOutbound` default `null`,
  `modules`, `bindings`) plus `evaluate` for the remaining `EvaluateOptions`.
  Use it as the `executor` of `createCodeTool({ tools, executor })` or
  `createCodemodeRuntime({ ctx, connectors, executor })`.
- The contract is codemode's: `execute(code, providersOrFns, options)`
  resolves to `{ result, logs }` or `{ result: undefined, error, logs }` with
  the sandbox's error string, never a `success: false` object and never a
  throw (codemode's `runCode` raises `error` as a thrown `Error`).
- Tool functions stay on the host: each provider namespace is a proxy in the
  sandbox whose calls are `POST https://codemode.invalid/<namespace>/<tool>`,
  answered by the host's `OutboundGateway` (`outboundRpc`) - so the host
  worker exports the gateway as it does for a fetch allowlist. Everything else
  the sandbox fetches is blocked (`globalOutbound: null`) or routed through
  the given `Fetcher`. Connectors dispatch the same way to `callTool`.
- `@cloudflare/codemode@^0.5` is an optional peer dependency; only its types
  are imported.
- `EvaluateOptions.modules`: extra ES modules of the loaded worker by name
  (`{ 'helper.js': '...' }`, importable as `./helper.js`), validated
  (reserved names, size) and part of the content-addressed spec.
