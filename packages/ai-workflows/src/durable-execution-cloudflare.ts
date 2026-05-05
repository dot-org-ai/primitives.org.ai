/**
 * Cloudflare Workflows adapter for {@link DurableExecutionAdapter}.
 *
 * Bridges the backend-agnostic port defined in `./durable-execution.ts` to
 * Cloudflare's class-based {@link https://developers.cloudflare.com/workflows/ Workflows runtime}.
 * CF Workflows is the production default per
 * {@link ../../docs/adr/0004-durable-execution-cf-workflows-default.md ADR-0004}:
 * the recently expanded limits (25K steps default-configurable, 50K concurrent
 * instances, 365-day max sleep, 1 GB persisted state) plus zero per-step
 * billing make it the cost-optimal backend for cascade-heavy workloads.
 *
 * ## How the bridge works
 *
 * CF Workflows uses a class-based dispatch model — users author a
 * {@link WorkflowEntrypointLike} subclass with `async run(event, step)`, and
 * the runtime instantiates it for each invocation. Our port's
 * `run(name, fn, input)` is callback-shaped. The adapter resolves the
 * impedance mismatch with two complementary surfaces:
 *
 *   1. **Workflow-function registry.** Callers register named workflow bodies
 *      against the adapter via {@link CloudflareWorkflowsDurableExecution.register}
 *      (or implicitly the first time {@link CloudflareWorkflowsDurableExecution.run}
 *      is called with that name). The registry is a plain {@link Map}
 *      maintained on the adapter instance.
 *
 *   2. **`createWorkflowEntrypoint(adapter)`.** Returns a
 *      {@link WorkflowEntrypointLike} subclass whose `run(event, step)`
 *      reads the workflow name from `event.payload.__wfName`, looks the body
 *      up in the registry, and invokes it with a {@link WorkflowContext} that
 *      delegates each port primitive to the CF `step` argument. Users export
 *      this class from their worker module and wire it through `wrangler.jsonc`:
 *
 *      ```jsonc
 *      "workflows": [{
 *        "name": "cascade",
 *        "binding": "WORKFLOW",
 *        "class_name": "MyWorkflowEntrypoint"
 *      }]
 *      ```
 *
 * The adapter's `run()` triggers a workflow by calling `binding.create({
 * params: { __wfName, __wfInput } })` against the supplied
 * {@link WorkflowsBindingLike}. By default it polls
 * `instance.status()` until completion and returns the workflow output;
 * callers that need fire-and-forget can opt out via
 * {@link CloudflareWorkflowsDurableExecutionOptions.waitForCompletion}.
 *
 * ## Step / sleep / waitForEvent translation
 *
 *   - `ctx.step(name, fn)`           → `step.do(name, fn)`
 *   - `ctx.step(name, cfg, fn)`      → `step.do(name, cfg, fn)`
 *   - `ctx.sleep(duration)`          → `step.sleep(autoStepName, duration)`
 *   - `ctx.sleepUntil(date)`         → `step.sleepUntil(autoStepName, date)`
 *   - `ctx.waitForEvent(name, t?)`   → `step.waitForEvent(autoStepName, { type: name, timeout: t })`
 *
 * CF requires every primitive to receive a stable name; our port's `sleep` /
 * `sleepUntil` / `waitForEvent` don't. The bridge synthesises a deterministic
 * name from a per-context counter (`__sleep__1`, `__waitForEvent__Order.placed__1`)
 * incremented in body order. Bodies that take the same control-flow path on
 * replay therefore see identical names — the determinism rule applies.
 *
 * Callers who want full control over step naming for sleeps/waits should use
 * {@link DurableExecutionAdapter.step} (or `ctx.step`) wrapping the desired
 * primitive: e.g. `await ctx.step('payment-window', () => sleepUntil(deadline))`.
 *
 * ## Schedules
 *
 * CF Workflows do not support imperative cron registration through the binding;
 * scheduled triggers are declared in `wrangler.jsonc` under `[triggers] crons`
 * and routed to a Worker `scheduled()` handler. The adapter's
 * {@link DurableExecutionAdapter.schedule} therefore registers the workflow
 * body against the adapter and returns a {@link Subscription} whose `id` is
 * the workflow name; the user's worker `scheduled()` handler must call
 * {@link CloudflareWorkflowsDurableExecution.runSchedule} (or the adapter's
 * `run()`) when the cron fires. {@link CloudflareWorkflowsDurableExecution.defineSchedule}
 * is an alias for `schedule()` that emphasises the wrangler-coordinated nature
 * of CF scheduling.
 *
 * ## Rules of Workflows (CF-imposed; universal)
 *
 *   1. **Steps must be idempotent.** CF re-executes step bodies on replay
 *      after a hibernation boundary or transient failure. Wrap external
 *      side-effects so a duplicate invocation is observably equivalent to a
 *      single one.
 *
 *   2. **Step names must be deterministic.** CF uses the step name as the
 *      memoization key. Random ids, timestamps, or run-specific values in
 *      step names break replay.
 *
 *   3. **State must flow through step returns.** Variables defined in the
 *      workflow body but outside a step DO NOT survive hibernation. Read
 *      inputs at the top of a step and return only what subsequent steps
 *      need.
 *
 *   4. **Workflow bodies must be deterministic.** Two replays of the same
 *      input must take the same control-flow path. Push non-determinism
 *      (clocks, randomness, network reads) into steps so CF can memoize the
 *      result.
 *
 *   5. **Use `step.sleep` / `step.sleepUntil` / `step.waitForEvent`.** Never
 *      `setTimeout` or polling — only the runtime knows how to suspend and
 *      resume the workflow.
 *
 * ## Limits
 *
 * Declared via {@link CloudflareWorkflowsDurableExecution.limits}:
 *
 *   - **Steps per workflow:** 25,000 (default-configurable per Mar 2026
 *     change; see ADR-0004).
 *   - **Concurrent instances:** 50,000 per account (Apr 2026 change).
 *   - **Maximum sleep:** 365 days.
 *   - **Per-step / per-event payload:** 1 MiB (CF Workers RPC limit).
 *
 * @see {@link ../../docs/adr/0004-durable-execution-cf-workflows-default.md ADR-0004}
 * @see {@link https://developers.cloudflare.com/workflows/build/workflows-api/ Workflows API}
 * @see {@link https://developers.cloudflare.com/workflows/build/rules-of-workflows/ Rules of Workflows}
 *
 * @example Wiring an adapter
 * ```ts
 * // worker.ts
 * import {
 *   createCloudflareWorkflowsDurableExecution,
 *   createWorkflowEntrypoint,
 * } from 'ai-workflows/durable-execution'
 *
 * type Env = { WORKFLOW: import('cloudflare:workers').Workflow }
 *
 * const dx = createCloudflareWorkflowsDurableExecution({
 *   binding: () => env.WORKFLOW,  // resolved per-request
 * })
 *
 * dx.register('cascade', async (ctx) => {
 *   const plan = await ctx.step('plan', () => generatePlan(ctx.input))
 *   await ctx.sleep('1 minute')
 *   return ctx.step('write', () => writeAll(plan))
 * })
 *
 * // The class wrangler binds; CF instantiates it on each run.
 * export const MyWorkflow = createWorkflowEntrypoint(dx)
 *
 * export default {
 *   async fetch(req: Request, env: Env) {
 *     // Trigger from anywhere — adapter.run() goes through the binding.
 *     const result = await dx.run('cascade', undefined as never, { customerId: 'c-1' })
 *     return Response.json(result)
 *   },
 * }
 * ```
 *
 * @packageDocumentation
 */

import {
  DurableStepError,
  WaitForEventTimeoutError,
  type DurableExecutionAdapter,
  type DurableExecutionKind,
  type StepConfig,
  type Subscription,
  type WorkflowContext,
  type WorkflowFn,
} from './durable-execution.js'

// =============================================================================
// Cloudflare Workflows shape (declared structurally for testability)
// =============================================================================

/**
 * Minimal `WorkflowStep` shape — only the methods this adapter uses.
 *
 * Defined structurally so the adapter compiles in Node test environments and
 * accepts a pure-JS fake without depending on `cloudflare:workers` at runtime.
 * In production, callers pass the real `step` argument provided by CF to
 * their {@link WorkflowEntrypointLike.run} method.
 */
export interface WorkflowStepLike {
  do<T>(name: string, callback: () => Promise<T>): Promise<T>
  do<T>(name: string, config: WorkflowStepConfigLike, callback: () => Promise<T>): Promise<T>
  sleep(name: string, duration: string | number): Promise<void>
  sleepUntil(name: string, timestamp: Date | number): Promise<void>
  waitForEvent<T = unknown>(
    name: string,
    options: { type: string; timeout?: string | number }
  ): Promise<{ payload: T; type: string; timestamp: Date } | T>
}

/**
 * Minimal `WorkflowStepConfig` shape passed to `step.do(name, config, fn)`.
 * Mirrors CF's `WorkflowStepConfig`. Compatible with our port's
 * {@link StepConfig}.
 */
export interface WorkflowStepConfigLike {
  retries?: {
    limit: number
    delay: string | number
    backoff?: 'constant' | 'linear' | 'exponential'
  }
  timeout?: string | number
}

/**
 * Minimal `WorkflowEvent<T>` shape — only the fields this adapter touches.
 * `payload` carries the `{ __wfName, __wfInput }` envelope produced by
 * {@link CloudflareWorkflowsDurableExecution.run}.
 */
export interface WorkflowEventLike<T = unknown> {
  readonly payload: Readonly<T>
  readonly timestamp?: Date
  readonly instanceId?: string
}

/**
 * Minimal `WorkflowInstance` shape — only the methods this adapter uses.
 *
 * Declared structurally to match CF's `WorkflowInstance` while remaining
 * testable without `cloudflare:workers`.
 */
export interface WorkflowInstanceLike {
  readonly id: string
  status(): Promise<{
    status:
      | 'queued'
      | 'running'
      | 'paused'
      | 'errored'
      | 'terminated'
      | 'complete'
      | 'waiting'
      | 'waitingForPause'
      | 'unknown'
    error?: { name: string; message: string }
    output?: unknown
  }>
  sendEvent?(args: { type: string; payload: unknown }): Promise<void>
}

/**
 * Minimal `Workflow` binding shape — only the methods this adapter uses.
 *
 * Mirrors `Workflow<PARAMS>` from `cloudflare:workers`. The adapter accepts
 * either the binding directly or a thunk that returns it (for environments
 * where the binding is only resolvable per-request, e.g. inside `fetch`).
 */
export interface WorkflowsBindingLike<PARAMS = unknown> {
  create(options?: { id?: string; params?: PARAMS }): Promise<WorkflowInstanceLike>
  get(id: string): Promise<WorkflowInstanceLike>
}

/**
 * Base class shape `createWorkflowEntrypoint` extends. Aliased here so users
 * (and tests) can refer to the structural type without importing
 * `cloudflare:workers`. Real callers receive an actual `WorkflowEntrypoint`
 * subclass; tests can stub it.
 */
export interface WorkflowEntrypointLike<Env = unknown, T = unknown> {
  run(event: Readonly<WorkflowEventLike<T>>, step: WorkflowStepLike): Promise<unknown>
}

// =============================================================================
// Adapter options
// =============================================================================

/**
 * Options for {@link createCloudflareWorkflowsDurableExecution}.
 */
export interface CloudflareWorkflowsDurableExecutionOptions {
  /**
   * The CF Workflows binding from a Workers environment, or a thunk that
   * resolves the binding per-call. Use the thunk form when the binding is
   * only available inside a request handler (e.g. `() => env.WORKFLOW`).
   */
  binding: WorkflowsBindingLike | (() => WorkflowsBindingLike)

  /**
   * When `true` (default), {@link DurableExecutionAdapter.run} polls the
   * created instance's status until it reaches `complete` or `errored` and
   * returns the workflow output (or throws on `errored`/`terminated`).
   *
   * When `false`, `run()` returns the {@link WorkflowInstanceLike} cast to
   * `unknown` so the caller can manage the lifecycle themselves. Useful for
   * fire-and-forget triggers or when polling is undesirable.
   *
   * Default: `true`.
   */
  waitForCompletion?: boolean

  /**
   * Polling interval (ms) when `waitForCompletion` is `true`. Default: 250.
   */
  pollIntervalMs?: number

  /**
   * Maximum total wait time (ms) when `waitForCompletion` is `true`. After
   * this elapses the adapter throws a {@link DurableStepError} with
   * `retryable: false`. Default: 24 hours (86_400_000 ms). Set higher for
   * long-sleeping workflows or use `waitForCompletion: false`.
   */
  pollTimeoutMs?: number

  /**
   * Override `setTimeout` for tests. Defaults to the global `setTimeout`.
   * Used by the polling loop and the (no-op) schedule registry.
   */
  delay?: (ms: number) => Promise<void>
}

/**
 * Limits the adapter knows about (per ADR-0004 / current CF docs).
 */
export interface CloudflareWorkflowsLimits {
  /** Maximum steps per workflow (default-configurable as of Mar 2026). */
  readonly maxSteps: 25_000
  /** Maximum concurrent workflow instances per account. */
  readonly maxConcurrentInstances: 50_000
  /** Maximum single sleep / sleepUntil duration. */
  readonly maxSleepDays: 365
  /** Per-step / per-event payload size (CF Workers RPC limit). */
  readonly maxPayloadBytes: 1_048_576
}

const CLOUDFLARE_WORKFLOWS_LIMITS: CloudflareWorkflowsLimits = {
  maxSteps: 25_000,
  maxConcurrentInstances: 50_000,
  maxSleepDays: 365,
  maxPayloadBytes: 1_048_576,
}

// =============================================================================
// Internal: payload envelope
// =============================================================================

/**
 * Internal envelope passed as the `params` to `binding.create()`. The
 * generated {@link WorkflowEntrypointLike} reads these fields from
 * `event.payload` to dispatch into the registered workflow body.
 *
 * Names are double-underscored to avoid collision with user-supplied input
 * keys when input is itself an object literal — though we always wrap input
 * inside `__wfInput` so this is belt-and-suspenders.
 */
export interface WorkflowEnvelope<TInput = unknown> {
  readonly __wfName: string
  readonly __wfInput: TInput
}

function isEnvelope(payload: unknown): payload is WorkflowEnvelope {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    '__wfName' in payload &&
    typeof (payload as { __wfName?: unknown }).__wfName === 'string' &&
    '__wfInput' in payload
  )
}

// =============================================================================
// Adapter
// =============================================================================

/**
 * The adapter returned by {@link createCloudflareWorkflowsDurableExecution}.
 *
 * Extends {@link DurableExecutionAdapter} with:
 *
 *   - {@link CloudflareWorkflowsDurableExecution.register} — explicitly
 *     register a workflow body before triggering it.
 *   - {@link CloudflareWorkflowsDurableExecution.defineSchedule} — alias for
 *     `schedule()` whose name emphasises the wrangler-coordinated nature.
 *   - {@link CloudflareWorkflowsDurableExecution.runSchedule} — invoke a
 *     scheduled workflow from a Worker `scheduled()` handler when its cron
 *     fires.
 *   - {@link CloudflareWorkflowsDurableExecution.entrypointHandler} — bound
 *     handler used by the {@link WorkflowEntrypointLike} class to dispatch
 *     incoming events back into the registered body.
 *   - {@link CloudflareWorkflowsDurableExecution.limits} — declared CF
 *     Workflows limits (consumers can introspect to bound their own steps).
 */
export interface CloudflareWorkflowsDurableExecution extends DurableExecutionAdapter {
  readonly kind: 'cloudflare'
  readonly limits: CloudflareWorkflowsLimits

  /**
   * Register a workflow body under `name`. Subsequent `run(name, ...)` and
   * scheduled invocations dispatch to it. Calling `register` with an
   * existing name replaces the previous body.
   */
  register<TResult = unknown, TInput = unknown>(name: string, fn: WorkflowFn<TResult, TInput>): void

  /**
   * Alias for {@link DurableExecutionAdapter.schedule}. CF Workflows have no
   * imperative cron API; the user's wrangler config defines the schedule
   * (`[triggers] crons = [...]`) and routes to a `scheduled()` handler that
   * calls {@link runSchedule} when the cron fires.
   *
   * Returns a {@link Subscription} whose `id` equals `name`.
   */
  defineSchedule<TResult = unknown>(
    name: string,
    cron: string,
    fn: WorkflowFn<TResult, undefined>
  ): Subscription

  /**
   * Invoke a previously registered scheduled workflow. Intended to be called
   * from a Worker `scheduled()` handler when the cron fires. Returns the
   * triggered instance handle (or its output if `waitForCompletion`).
   */
  runSchedule(name: string): Promise<unknown>

  /**
   * The dispatch handler used by the generated
   * {@link WorkflowEntrypointLike} class. Exposed so callers can build their
   * own entrypoint subclass (e.g. to layer custom env-handling) and forward
   * `(event, step)` here.
   */
  entrypointHandler(event: WorkflowEventLike, step: WorkflowStepLike): Promise<unknown>
}

/**
 * Construct a Cloudflare Workflows {@link DurableExecutionAdapter}.
 *
 * The adapter satisfies the full port contract by translating each call into
 * its CF equivalent (see module docs). Step bodies execute inside CF's
 * runtime and inherit CF's idempotency, replay, and hibernation semantics.
 *
 * **The adapter does not run workflow bodies in-process.** Calling `run()`
 * triggers a CF Workflow via the supplied binding; the body runs on CF's
 * infrastructure and the adapter polls (or returns the instance handle).
 * For tests that need to exercise the body directly without a CF runtime,
 * use {@link createInProcessDurableExecution} or
 * {@link createInMemoryDurableExecution} instead.
 *
 * @example
 * ```ts
 * import { createCloudflareWorkflowsDurableExecution, createWorkflowEntrypoint } from 'ai-workflows/durable-execution'
 *
 * type Env = { WORKFLOW: Workflow }
 *
 * const dx = createCloudflareWorkflowsDurableExecution({ binding: () => env.WORKFLOW })
 * dx.register('hello', async (ctx) => `hi, ${ctx.input}`)
 *
 * export const HelloWorkflow = createWorkflowEntrypoint(dx)
 * ```
 */
export function createCloudflareWorkflowsDurableExecution(
  options: CloudflareWorkflowsDurableExecutionOptions
): CloudflareWorkflowsDurableExecution {
  const waitForCompletion = options.waitForCompletion ?? true
  const pollIntervalMs = options.pollIntervalMs ?? 250
  const pollTimeoutMs = options.pollTimeoutMs ?? 24 * 60 * 60 * 1000
  const delay =
    options.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  const registry = new Map<string, WorkflowFn>()
  const schedules = new Map<string, { cron: string; fn: WorkflowFn<unknown, undefined> }>()

  function resolveBinding(): WorkflowsBindingLike {
    const b = options.binding
    return typeof b === 'function' ? b() : b
  }

  // ---------------------------------------------------------------------------
  // Workflow context bridge — invoked by the entrypoint handler with the CF
  // `step` argument. Each port primitive translates to the matching CF call.
  // ---------------------------------------------------------------------------

  function buildContext<TInput>(
    name: string,
    instanceId: string,
    input: TInput,
    step: WorkflowStepLike
  ): WorkflowContext<TInput> {
    // Auto-naming counter for sleep/waitForEvent (CF requires every primitive
    // to receive a stable, deterministic name). The body's control flow is
    // deterministic, so a strictly increasing counter yields stable names
    // across replays.
    let sleepCounter = 0
    let sleepUntilCounter = 0
    const waitCounters = new Map<string, number>()

    const ctx: WorkflowContext<TInput> = {
      input,
      instanceId,
      name,
      step: ((
        stepName: string,
        configOrFn: StepConfig | (() => Promise<unknown>),
        maybeFn?: () => Promise<unknown>
      ) => {
        if (typeof configOrFn === 'function') {
          return step.do(stepName, configOrFn) as Promise<unknown>
        }
        return step.do(stepName, configOrFn as WorkflowStepConfigLike, maybeFn!) as Promise<unknown>
      }) as WorkflowContext<TInput>['step'],
      async sleep(duration) {
        const stepName = `__sleep__${++sleepCounter}`
        await step.sleep(stepName, duration as string | number)
      },
      async sleepUntil(date) {
        const stepName = `__sleepUntil__${++sleepUntilCounter}`
        await step.sleepUntil(stepName, date)
      },
      async waitForEvent<T = unknown>(eventName: string, timeout?: number | string): Promise<T> {
        const seq = (waitCounters.get(eventName) ?? 0) + 1
        waitCounters.set(eventName, seq)
        const stepName = `__waitForEvent__${eventName}__${seq}`
        try {
          const opts: { type: string; timeout?: string | number } = { type: eventName }
          if (timeout !== undefined) opts.timeout = timeout
          const result = await step.waitForEvent<T>(stepName, opts)
          // CF returns { payload, type, timestamp } — unwrap to the user-shaped
          // value when the envelope is present; otherwise pass through.
          if (
            result !== null &&
            typeof result === 'object' &&
            'payload' in (result as Record<string, unknown>)
          ) {
            return (result as { payload: T }).payload
          }
          return result as T
        } catch (err) {
          // CF surfaces wait timeouts as thrown errors; normalise to the
          // port's WaitForEventTimeoutError when the message indicates a
          // timeout. Otherwise rethrow.
          const msg = err instanceof Error ? err.message : String(err)
          if (/timeout|timed out/i.test(msg) && timeout !== undefined) {
            throw new WaitForEventTimeoutError(eventName, timeout)
          }
          throw err
        }
      },
    }
    return ctx
  }

  // ---------------------------------------------------------------------------
  // Entrypoint handler — invoked by the generated WorkflowEntrypoint class.
  // ---------------------------------------------------------------------------

  async function entrypointHandler(
    event: WorkflowEventLike,
    step: WorkflowStepLike
  ): Promise<unknown> {
    const payload = event.payload
    if (!isEnvelope(payload)) {
      throw new Error(
        'Cloudflare Workflows adapter: workflow event payload missing __wfName/__wfInput envelope. ' +
          'Workflows triggered through this adapter must be created via adapter.run() or adapter.runSchedule().'
      )
    }
    const fn = registry.get(payload.__wfName)
    if (!fn) {
      throw new Error(
        `Cloudflare Workflows adapter: no workflow registered for name "${payload.__wfName}". ` +
          'Call adapter.register(name, fn) before triggering it.'
      )
    }
    const instanceId = event.instanceId ?? `cf-${Date.now()}`
    const ctx = buildContext(payload.__wfName, instanceId, payload.__wfInput, step)
    return fn(ctx)
  }

  // ---------------------------------------------------------------------------
  // Polling — wait for an instance to terminate.
  // ---------------------------------------------------------------------------

  async function pollUntilDone(instance: WorkflowInstanceLike): Promise<unknown> {
    const start = Date.now()
    // First check is unconditional so quick-completing workflows return
    // without an extra delay tick.
    let last = await instance.status()
    while (true) {
      if (last.status === 'complete') return last.output
      if (last.status === 'errored' || last.status === 'terminated') {
        const message =
          last.error?.message ?? `Workflow instance ${instance.id} ended with status ${last.status}`
        throw new DurableStepError(message, {
          stepName: `<workflow:${instance.id}>`,
          attempts: 1,
          retryable: false,
          cause: last.error ?? new Error(message),
        })
      }
      if (Date.now() - start > pollTimeoutMs) {
        throw new DurableStepError(
          `Workflow instance ${instance.id} did not complete within ${pollTimeoutMs}ms`,
          {
            stepName: `<workflow:${instance.id}>`,
            attempts: 1,
            retryable: false,
            cause: new Error('poll timeout'),
          }
        )
      }
      await delay(pollIntervalMs)
      last = await instance.status()
    }
  }

  // ---------------------------------------------------------------------------
  // Public surface
  // ---------------------------------------------------------------------------

  function register<TResult = unknown, TInput = unknown>(
    name: string,
    fn: WorkflowFn<TResult, TInput>
  ): void {
    registry.set(name, fn as WorkflowFn)
  }

  async function run<TResult = unknown, TInput = unknown>(
    name: string,
    fn: WorkflowFn<TResult, TInput>,
    input: TInput
  ): Promise<TResult> {
    // Implicitly register if the caller supplied a body. Allows the
    // canonical port shape `dx.run(name, fn, input)` without a separate
    // register() step. If the same name is later run() with no body, the
    // most recent registration wins — matching the in-process adapter.
    if (typeof fn === 'function') {
      registry.set(name, fn as WorkflowFn)
    }
    const binding = resolveBinding()
    const envelope: WorkflowEnvelope<TInput> = { __wfName: name, __wfInput: input }
    const instance = await binding.create({ params: envelope })
    if (!waitForCompletion) {
      // Caller manages the instance; return it cast through unknown.
      return instance as unknown as TResult
    }
    return (await pollUntilDone(instance)) as TResult
  }

  async function step<T>(
    name: string,
    configOrFn: StepConfig | (() => Promise<T>),
    maybeFn?: () => Promise<T>
  ): Promise<T> {
    // Outside a workflow body CF Workflows have no step concept — the binding
    // can't run a single step in isolation. We mirror the in-memory stub's
    // behaviour for callers using `dx.step()` outside a `run`: execute the
    // function directly without memoization. Inside a body, the
    // {@link WorkflowContext.step} delegate is used (which translates to
    // `step.do`).
    void name
    const fn = typeof configOrFn === 'function' ? configOrFn : maybeFn!
    return fn()
  }

  async function sleep(duration: string | number): Promise<void> {
    // Outside a body, sleep is just a delay — there's no CF step context to
    // suspend. This matches the in-memory stub.
    const ms = typeof duration === 'number' ? duration : parseDurationLoose(duration)
    if (ms > 0) await delay(ms)
  }

  async function sleepUntil(date: Date): Promise<void> {
    const ms = date.getTime() - Date.now()
    if (ms > 0) await delay(ms)
  }

  function waitForEvent<T = unknown>(name: string, timeout?: number | string): Promise<T> {
    // Outside a body there is no CF step.waitForEvent surface. Reject so
    // callers don't accidentally rely on hibernation-style waits without a
    // running workflow.
    return Promise.reject(
      new Error(
        `Cloudflare Workflows adapter: waitForEvent("${name}"${
          timeout !== undefined ? `, ${String(timeout)}` : ''
        }) ` +
          'is only supported inside a workflow body (ctx.waitForEvent). ' +
          'Trigger the workflow via adapter.run() and call waitForEvent on its ctx.'
      )
    )
  }

  function schedule<TResult = unknown>(
    name: string,
    cron: string,
    fn: WorkflowFn<TResult, undefined>
  ): Subscription {
    schedules.set(name, { cron, fn: fn as WorkflowFn<unknown, undefined> })
    registry.set(name, fn as WorkflowFn)
    return {
      id: name,
      unsubscribe(): void {
        schedules.delete(name)
        // Leave the body in registry so already-fired runs still resolve.
      },
    }
  }

  function defineSchedule<TResult = unknown>(
    name: string,
    cron: string,
    fn: WorkflowFn<TResult, undefined>
  ): Subscription {
    return schedule(name, cron, fn)
  }

  async function runSchedule(name: string): Promise<unknown> {
    const entry = schedules.get(name)
    if (!entry) {
      throw new Error(
        `Cloudflare Workflows adapter: no schedule registered for "${name}". ` +
          'Call adapter.defineSchedule(name, cron, fn) before invoking runSchedule.'
      )
    }
    return run(name, entry.fn, undefined)
  }

  const adapter: CloudflareWorkflowsDurableExecution = {
    kind: 'cloudflare' as DurableExecutionKind & 'cloudflare',
    limits: CLOUDFLARE_WORKFLOWS_LIMITS,
    register,
    run: run as DurableExecutionAdapter['run'],
    step: step as DurableExecutionAdapter['step'],
    sleep,
    sleepUntil,
    waitForEvent,
    schedule,
    defineSchedule,
    runSchedule,
    entrypointHandler,
  }

  return adapter
}

// =============================================================================
// WorkflowEntrypoint factory
// =============================================================================

/**
 * Constructor-shape returned by {@link createWorkflowEntrypoint} when called
 * without the optional `Base` class. Callable with `new` like a normal
 * `WorkflowEntrypoint` subclass — CF instantiates it once per workflow run.
 *
 * The first constructor argument is `ctx` (an `ExecutionContext`) and the
 * second is `env`; declared `unknown` here so this module compiles without
 * `cloudflare:workers` types in the build environment.
 */
export type WorkflowEntrypointConstructor = new (ctx: unknown, env: unknown) => {
  run(event: WorkflowEventLike, step: WorkflowStepLike): Promise<unknown>
}

/**
 * Generate a {@link WorkflowEntrypointLike} subclass bound to `adapter`.
 *
 * Users export the returned class from their worker module and reference it
 * in `wrangler.jsonc` under `workflows[].class_name`. CF instantiates the
 * class for each workflow run, calls its `run(event, step)`, and the adapter
 * dispatches into the registered body.
 *
 * **Why a factory instead of a fixed export?** CF binds workflows by class
 * name at deploy time — each binding needs its own class identity. The
 * factory pattern lets users have multiple adapters/classes in one module
 * (e.g. one per binding) without colliding.
 *
 * If `Base` is omitted, this module declares an internal abstract class with
 * the signature CF expects. In production, callers SHOULD pass the real
 * `WorkflowEntrypoint` from `cloudflare:workers` so CF's runtime magic (env
 * injection, `[Rpc.__WORKFLOW_ENTRYPOINT_BRAND]`, etc.) is preserved:
 *
 * ```ts
 * import { WorkflowEntrypoint } from 'cloudflare:workers'
 * import { createCloudflareWorkflowsDurableExecution, createWorkflowEntrypoint } from 'ai-workflows/durable-execution'
 *
 * const dx = createCloudflareWorkflowsDurableExecution({ binding: () => env.WORKFLOW })
 * export const MyWorkflow = createWorkflowEntrypoint(dx, WorkflowEntrypoint)
 * ```
 *
 * In tests / Node environments where `cloudflare:workers` isn't available,
 * call without `Base` and the adapter's dispatch logic is exercised against
 * the structural fake.
 */
export function createWorkflowEntrypoint<Env = unknown, T = unknown>(
  adapter: CloudflareWorkflowsDurableExecution,
  Base?: WorkflowEntrypointConstructor
): WorkflowEntrypointConstructor {
  if (Base) {
    return class extends Base {
      override async run(event: WorkflowEventLike<T>, step: WorkflowStepLike): Promise<unknown> {
        return adapter.entrypointHandler(event, step)
      }
    } as unknown as WorkflowEntrypointConstructor
  }
  // Pure-JS shim used when callers don't (or can't) supply the real CF base
  // class. Sufficient for unit tests of the dispatch path; production callers
  // should always pass `WorkflowEntrypoint` from `cloudflare:workers`.
  return class WorkflowEntrypointShim {
    constructor(_ctx: unknown, _env: unknown) {
      // Match CF's two-arg constructor shape; we don't need the values.
      void _ctx
      void _env
    }
    async run(event: WorkflowEventLike<T>, step: WorkflowStepLike): Promise<unknown> {
      return adapter.entrypointHandler(event, step)
    }
  } as unknown as WorkflowEntrypointConstructor
}

// =============================================================================
// Internal: minimal duration parser (top-level sleep outside a body)
// =============================================================================

/**
 * Tolerant duration parser used only by the top-level `sleep()` outside a
 * body. Inside a body, durations are passed verbatim to CF's `step.sleep`,
 * which has its own grammar. We do not constrain string forms here as
 * tightly as the in-memory stub since CF accepts a richer grammar
 * (`'10 seconds'`, `'1 day'`, etc.).
 */
function parseDurationLoose(input: string): number {
  const trimmed = input.trim().toLowerCase()
  const match = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(ms|millisecond|milliseconds|s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days|w|week|weeks)$/
  )
  if (!match) {
    throw new Error(`Cloudflare Workflows adapter: unrecognised duration "${input}"`)
  }
  const value = parseFloat(match[1]!)
  const unit = match[2]!
  switch (unit) {
    case 'ms':
    case 'millisecond':
    case 'milliseconds':
      return value
    case 's':
    case 'sec':
    case 'second':
    case 'seconds':
      return value * 1000
    case 'm':
    case 'min':
    case 'minute':
    case 'minutes':
      return value * 60_000
    case 'h':
    case 'hr':
    case 'hour':
    case 'hours':
      return value * 3_600_000
    case 'd':
    case 'day':
    case 'days':
      return value * 86_400_000
    case 'w':
    case 'week':
    case 'weeks':
      return value * 604_800_000
    /* istanbul ignore next */
    default:
      throw new Error(`Cloudflare Workflows adapter: unrecognised duration unit "${unit}"`)
  }
}
