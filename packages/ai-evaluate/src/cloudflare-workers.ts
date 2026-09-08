/**
 * The slice of `cloudflare:workers` that `./worker.ts` uses, declared here so
 * this package compiles without `@cloudflare/workers-types` on its global
 * scope (which would collide with the Node globals `./node.ts` relies on).
 *
 * An ambient declaration only: it emits no JavaScript, and `dist/worker.d.ts`
 * imports the real module, which a Workers project resolves through its own
 * `@cloudflare/workers-types`. (A `.d.ts` under `src/` would be gitignored.)
 */
declare module 'cloudflare:workers' {
  /** `ctx` of a `WorkerEntrypoint`: the parts this package reads */
  export interface EntrypointContext<Props> {
    /** The `props` a loopback stub (`ctx.exports.X({ props })`) was created with */
    readonly props: Props
    /** Loopback bindings of the current worker's main-module exports */
    readonly exports: Record<string, unknown>
    waitUntil(promise: Promise<unknown>): void
    passThroughOnException(): void
  }

  export abstract class WorkerEntrypoint<Env = unknown, Props = unknown> {
    protected readonly ctx: EntrypointContext<Props>
    protected readonly env: Env
    constructor(ctx: EntrypointContext<Props>, env: Env)
    fetch?(request: Request): Response | Promise<Response>
  }

  /** Loopback bindings of the current worker's main-module exports (`ctx.exports`) */
  export const exports: Record<string, unknown>
}
