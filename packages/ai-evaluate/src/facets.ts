/**
 * Durable Object facets: per-sandbox persistent state for `evaluate()`.
 *
 * A facet is a Durable Object that a Durable Object starts under itself
 * (`ctx.facets.get(name, startup)`), with its own SQLite storage, from any
 * `DurableObjectClass` - including one of a dynamically loaded worker
 * (`WorkerStub.getDurableObjectClass(name)`). That is exactly the shape of a
 * sandbox with state: the host worker's `SandboxHost` Durable Object
 * (one per `sandboxId`, see `./worker.ts`) owns the facets; each facet runs a
 * class the sandboxed `module` exports; the script calls it as
 * `env.<binding>`. Nothing is declared for the sandbox's class in wrangler.
 *
 * Two runtime rules shape the wiring (both witnessed in workerd):
 * - a `DurableObjectClass` of a dynamically loaded worker cannot cross an RPC
 *   boundary ("the system does not know how to reload this Worker"), so the
 *   `SandboxHost` loads the facet worker itself, from the spec `evaluate()`
 *   sends it (`attach`);
 * - a stub of a facet cannot be serialized at all, so the facet never leaves
 *   its `SandboxHost`: the loaded worker holds a stub of the `SandboxHost`
 *   (a regular Durable Object stub) under a reserved env key, and the
 *   generated worker turns it into the `env.<binding>` proxy whose method
 *   calls are `invoke(name, method, args)` RPCs and whose `fetch()` is
 *   `fetchFacet(name, request)`.
 *
 * This module is the pure part: the facet host logic (`createFacetHost`,
 * what the `SandboxHost` class delegates to), the facet worker template, the
 * proxy snippet the sandbox templates embed, and the loopback lookup. It
 * imports nothing Workers-specific.
 */

import type { FacetOptions, WorkerCode, WorkerLoader } from './types.js'
import { transformModuleCode } from './worker-template/code-transforms.js'
import { loopbackExport } from './loopback.js'

/**
 * Name of the Durable Object class the host worker's main module must export
 * (with a namespace configured) for `facet` to work: `ctx.exports.SandboxHost`.
 */
export const SANDBOX_HOST_EXPORT = 'SandboxHost'

/**
 * The reserved env key under which the loaded worker receives its
 * `SandboxHost` stub. The generated worker removes it from the `env` the
 * sandboxed code sees; neither `env` nor `bindings` may use it.
 */
export const SANDBOX_HOST_BINDING_KEY = '__ai_evaluate_sandbox_host__'

/**
 * The json module that carries the sandbox identity into the script worker's
 * content-addressed `WorkerCode` spec when a facet is configured (as
 * `outbound.json` does for the outbound policy): `{ sandboxId, facet }`.
 *
 * The `SandboxHost` stub in the loader env is a binding, which `workerCodeId`
 * never hashes; without this module the same code under two `sandboxId`s is
 * one id, and under `isolation: 'cached'` the isolate loaded for sandbox A -
 * its env bound to A's stub - would serve sandbox B's script, so B's calls
 * would reach A's facet and A's storage (aip-263g.39). With it, a `'cached'`
 * isolate is one per sandbox: reused across evaluations of the same
 * `sandboxId`, never across sandboxes. The facet worker carries it as well:
 * it is always `loader.get(codeId)` and its env is not hashed, so without it
 * the first sandbox's env and bindings would serve every later sandbox with
 * the same module (aip-lrjh.5). One facet isolate per sandbox, running inside
 * the sandbox's own `SandboxHost`.
 */
export const SANDBOX_JSON_MODULE = 'sandbox.json'

/**
 * Error reported when `facet` is set and the host worker does not export
 * `SandboxHost` with a namespace (or runs on a compatibility date without
 * `ctx.exports`).
 */
export const SANDBOX_HOST_UNAVAILABLE_ERROR =
  'facet needs the SandboxHost Durable Object of the host worker: add ' +
  "`export { SandboxHost } from 'ai-evaluate/worker'` to the main module of the Worker that " +
  'calls evaluate(), declare it in wrangler (durable_objects.bindings with class_name ' +
  '"SandboxHost" and a migration with new_sqlite_classes: ["SandboxHost"]; compatibility date ' +
  '2025-11-17 or later, for ctx.exports); the local host of ai-evaluate/node has it already'

/** Error the `SandboxHost` raises for a facet no evaluation has attached in its lifetime */
export function facetNotAttachedError(name: string): Error {
  return new Error(
    `facet ${name} is not attached to this sandbox: evaluate() attaches a facet before running ` +
      'the script, so this is a call from a worker that was loaded without it'
  )
}

/** What `evaluate()` hands the `SandboxHost` for one facet (`attach`) */
export interface FacetSpec {
  /** The facet worker: the sandbox module (and imports) exporting the class, no script */
  code: WorkerCode
  /** `workerCodeId(code)`: the facet restarts on a new class when this changes */
  codeId: string
  /** The export of `code` that is the Durable Object class */
  className: string
  /** Facet Durable Object id (`FacetOptions.id`), when given */
  id?: string | undefined
}

/**
 * The RPC surface of the `SandboxHost` Durable Object, as `evaluate()` and
 * the generated worker use it. A Durable Object stub also carries `fetch`,
 * which is what makes it pass `isRpcStubLike` into the sandbox env.
 */
export interface SandboxHostStub {
  /** Register (or re-register) the facet `name` with its worker spec */
  attach(name: string, spec: FacetSpec): Promise<void>
  /** Call `method(...args)` on the facet (starting it on first use) */
  invoke(name: string, method: string, args: unknown[]): Promise<unknown>
  /** Send a request to the facet's `fetch` handler */
  fetchFacet(name: string, request: Request): Promise<Response>
  /** Stop the facet and delete its storage */
  detach(name: string): Promise<void>
}

/** The `SandboxHost` namespace: `ctx.exports.SandboxHost` on the host worker */
export interface SandboxHostNamespace {
  getByName(name: string): SandboxHostStub
}

/** A started facet, as `ctx.facets.get` returns it: an RPC stub with `fetch` */
export interface FacetStub {
  fetch(request: Request): Promise<Response>
  [method: string]: unknown
}

/** The slice of `DurableObjectState.facets` the facet host uses */
export interface FacetsApi {
  get(name: string, startup: () => FacetStartup | Promise<FacetStartup>): FacetStub
  abort(name: string, reason: unknown): void
  delete(name: string): void
}

/** What a facet's startup callback answers: the class to run, and optionally its id */
export interface FacetStartup {
  class: unknown
  id?: string | undefined
}

/** The pure facet host: what the `SandboxHost` Durable Object delegates to */
export interface FacetHost extends SandboxHostStub {
  /** The facet stub for `name` (starts it on first use); throws when not attached */
  facet(name: string): FacetStub
  /** Names of the facets attached in this host's lifetime */
  attached(): string[]
}

/**
 * Create the facet host for one `SandboxHost` instance.
 *
 * `attach` keeps the spec of each facet in memory for the startup callback,
 * which the runtime invokes lazily - on the first call into the facet, not
 * when `ctx.facets.get` hands out the stub - and again after an abort. A
 * facet attached under a different `codeId` than the one it runs is aborted
 * first, so a changed module restarts it on the new class; the facet's
 * SQLite storage is keyed by its name and survives the restart. `detach` is
 * `ctx.facets.delete`: stop and drop the storage.
 *
 * The facet worker is loaded with `loader.get(codeId, ...)`: the facet keeps
 * its class's isolate alive, so one isolate per distinct facet worker is the
 * right unit, whatever `isolation` the script worker runs under.
 */
export function createFacetHost(
  ctx: { facets: FacetsApi },
  loader: WorkerLoader | undefined
): FacetHost {
  const specs = new Map<string, FacetSpec>()

  const facet = (name: string): FacetStub =>
    ctx.facets.get(name, () => {
      const spec = specs.get(name)
      if (!spec) throw facetNotAttachedError(name)
      if (!loader) {
        throw new Error(
          'SandboxHost has no `loader` binding: the host worker that exports it must also declare ' +
            'the worker_loaders binding `loader`'
        )
      }
      const worker = loader.get(spec.codeId, () => spec.code)
      return { class: worker.getDurableObjectClass(spec.className), id: spec.id }
    })

  return {
    async attach(name, spec) {
      const current = specs.get(name)
      if (current && current.codeId !== spec.codeId) {
        ctx.facets.abort(name, `facet ${name} re-attached with a different worker`)
      }
      specs.set(name, spec)
    },
    async invoke(name, method, args) {
      const stub = facet(name)
      // Called as `stub.method(...)`, never through `Function.prototype.apply`
      // or `call`: on an RPC stub those are themselves property accesses
      // (`stub.method.apply` is a pipelined RPC), and the `this` argument -
      // the facet stub - cannot be serialized.
      const target = stub[method]
      if (typeof target !== 'function') {
        throw new Error(`facet ${name} has no method ${method}`)
      }
      return await (stub[method] as (...args: unknown[]) => unknown)(...args)
    },
    async fetchFacet(name, request) {
      return facet(name).fetch(request)
    },
    async detach(name) {
      ctx.facets.delete(name)
      specs.delete(name)
    },
    facet,
    attached: () => [...specs.keys()],
  }
}

/** Whether a string is a JavaScript identifier (the shape of a class or binding name) */
export function isIdentifier(name: unknown): name is string {
  return typeof name === 'string' && /^[A-Za-z_$][\w$]*$/.test(name)
}

/**
 * The env key the script sees the facet under: `FacetOptions.binding`, or the
 * class name in CONSTANT_CASE (`State` -> `STATE`, `ReplState` ->
 * `REPL_STATE`).
 */
export function facetBindingName(facet: FacetOptions): string {
  return facet.binding ?? facet.class.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()
}

/**
 * The facet worker: the sandbox module and its imports, with the facet class
 * exported under its name as a Durable Object class - and no script. It is
 * what the `SandboxHost` loads to start the facet, content-addressed apart
 * from the script worker so the facet stays hot while only the script
 * changes.
 *
 * The module code runs the same way as in the sandbox worker (`exports`
 * record, `export` rewritten by `transformModuleCode`, module-scope
 * neighbours in scope for the class). A class that already extends
 * `DurableObject` is exported as it is; a plain class is wrapped in one that
 * does - workerd only routes RPC to `DurableObject` subclasses - forwarding
 * every prototype method (and `fetch`) to an instance of the plain class
 * constructed with the same `(ctx, env)`. A module that exports nothing under
 * the name fails on the facet's first use with a message naming it.
 */
export function generateFacetWorkerCode(options: {
  module: string
  className: string
  /** Import declarations placed at the true top level of the worker module */
  imports?: string[] | undefined
  /** Code run once at module scope, before the user module */
  preamble?: string | undefined
}): string {
  const { module: rawModule, className, imports = [], preamble = '' } = options
  const module = rawModule ? transformModuleCode(rawModule) : ''
  const name = JSON.stringify(className)

  return `
// Sandbox facet worker: the ${className} Durable Object class of the sandbox module
import { DurableObject as __DurableObject__ } from 'cloudflare:workers';
${imports.join('\n')}

${preamble}

const exports = {};
${
  module
    ? `
try {
${module}
} catch (e) {
  console.error('Module error:', e.message);
}
`
    : '// No module code provided'
}

// A plain class becomes a DurableObject subclass that forwards to it
function __wrapFacetClass__(Target) {
  class Facet extends __DurableObject__ {
    constructor(ctx, env) {
      super(ctx, env);
      if (typeof Target !== 'function') {
        throw new Error('facet class ' + ${name} + ' is not exported by module');
      }
      this.__target__ = new Target(ctx, env);
    }
  }
  if (typeof Target === 'function') {
    const seen = new Set(['constructor']);
    for (let proto = Target.prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
      for (const key of Object.getOwnPropertyNames(proto)) {
        if (seen.has(key)) continue;
        seen.add(key);
        const descriptor = Object.getOwnPropertyDescriptor(proto, key);
        if (typeof descriptor?.value !== 'function') continue;
        Object.defineProperty(Facet.prototype, key, {
          value(...args) { return this.__target__[key](...args); },
          writable: true,
          configurable: true,
        });
      }
    }
  }
  return Facet;
}

const __Target__ = exports[${name}];
const __Facet__ =
  typeof __Target__ === 'function' &&
  Object.prototype.isPrototypeOf.call(__DurableObject__.prototype, __Target__.prototype)
    ? __Target__
    : __wrapFacetClass__(__Target__);

export { __Facet__ as ${className} };
`
}

/**
 * Name of the module-scope function the generated worker builds the sandbox
 * `env` with (`facetEnvSource`): `__sandboxEnv__(loaderEnv)`.
 */
export const SANDBOX_ENV_FUNCTION = '__sandboxEnv__'

/**
 * The `env` the sandboxed code sees, as a module-scope `const` function of
 * the generated worker: `__sandboxEnv__(__env__)` answers a frozen copy of
 * the loader env with the reserved `SandboxHost` key removed and, when a
 * facet is configured, the facet proxy under its binding.
 *
 * The function is the only place in the generated worker that names the
 * loader env and the `SandboxHost` stub: the request handler calls it with
 * its env parameter and hands the result to a module-scope request function
 * that the user script is inlined into, so `__env__` and `__sandboxHost__`
 * are ReferenceErrors from the script and the stub - whose `attach` would
 * load an arbitrary worker through the host's loader, without the sandbox's
 * outbound policy - is out of its reach. `const` at module scope means a
 * script that breaks out of its function cannot redeclare or reassign it
 * (SyntaxError / TypeError, before or instead of running).
 *
 * The proxy is the only thing the sandbox gets: a method call is
 * `invoke(name, method, args)` on the `SandboxHost` stub, `fetch(input,
 * init)` is `fetchFacet(name, new Request(input, init))`. It is not thenable
 * (`then` is `undefined`), so `await env.STATE` is the proxy itself.
 */
export function facetEnvSource(facet?: { binding: string; name: string } | undefined): string {
  const key = JSON.stringify(SANDBOX_HOST_BINDING_KEY)
  if (!facet) {
    return `const ${SANDBOX_ENV_FUNCTION} = (__env__) => {
  const { [${key}]: __sandboxHost__, ...__bindings__ } = __env__;
  return Object.freeze({ ...__bindings__ });
};`
  }
  const binding = JSON.stringify(facet.binding)
  const name = JSON.stringify(facet.name)
  return `const ${SANDBOX_ENV_FUNCTION} = (__env__) => {
  const { [${key}]: __sandboxHost__, ...__bindings__ } = __env__;
  const __facet__ = new Proxy(Object.freeze({}), {
    get(_, method) {
      if (typeof method !== 'string' || method === 'then') return undefined;
      if (method === 'fetch') {
        return (input, init) => __sandboxHost__.fetchFacet(${name}, new Request(input, init));
      }
      return (...args) => __sandboxHost__.invoke(${name}, method, args);
    },
  });
  return Object.freeze({ ...__bindings__, [${binding}]: __facet__ });
};`
}

/**
 * The host worker's `SandboxHost` namespace (`ctx.exports.SandboxHost`), or
 * `null` where there is none: outside workerd, on a compatibility date
 * without `ctx.exports`, or when the main module does not export the class
 * with a namespace configured.
 */
export async function loopbackSandboxHost(): Promise<SandboxHostNamespace | null> {
  const namespace = await loopbackExport(SANDBOX_HOST_EXPORT)
  const candidate = namespace as { getByName?: unknown } | null
  return typeof candidate?.getByName === 'function' ? (namespace as SandboxHostNamespace) : null
}
