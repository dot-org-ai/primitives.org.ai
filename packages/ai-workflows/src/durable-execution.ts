/**
 * DurableExecutionAdapter - Port for durable workflow execution backends.
 *
 * Defines a small, backend-agnostic interface that callers (notably
 * `ai-database`'s cascade orchestration in ADR-0003) can program against
 * without knowing which durable execution backend is wired underneath.
 *
 * ## Why this port exists
 *
 * `ai-workflows`'s {@link createWorkflowRuntime} owns the `$` runtime
 * contract — handlers, dispatch, cascade-context, database-context. It runs
 * in-process and lives only as long as the host process. For long-running
 * cascades, scheduled jobs, and orchestration spanning hours-to-days, an
 * external durable execution backend is required.
 *
 * Two production candidates (per ADR-0004):
 *
 *   - **Cloudflare Workflows** (default backend; Workers-only). Hibernation
 *     while waiting; no per-step billing; 25K steps default; 365-day max
 *     sleep. State must flow through step returns — in-memory variables do
 *     not survive hibernation.
 *
 *   - **Vercel Workflow Development Kit (WDK)** (alternate backend; Vercel
 *     or self-hosted). Apache-2.0; pluggable "Worlds"; per-step billing;
 *     event-sourced replay; unlimited sleep.
 *
 * Plus an in-process stub (this file's {@link createInMemoryDurableExecution})
 * for tests and local development that does not need durability across
 * process restarts. Phase 1 (bead `aip-fgq5`) will land a richer in-process
 * adapter that bridges this port to the existing
 * {@link createWorkflowRuntime}.
 *
 * The port is modeled after WDK's "Worlds" abstraction — the prior art for
 * exactly this pattern: a small, backend-portable surface for `step`,
 * `sleep`, `waitForEvent`, and scheduling, with each adapter translating to
 * its native primitive (CF's hibernation, WDK's event-sourced replay,
 * in-process's plain async).
 *
 * ## Programming model: Rules of Workflows
 *
 * These rules are universal to durable execution and are not specific to
 * any one backend. They originate in CF's "Rules of Workflows" guidance and
 * apply equally to WDK's deterministic replay model.
 *
 *   1. **Steps must be idempotent.** A step body may be re-executed across
 *      a hibernation/restart boundary or after a transient failure. Wrap
 *      external side-effects (writes, payments, emails) so a duplicate
 *      invocation is observably equivalent to a single invocation.
 *
 *   2. **Step names must be deterministic.** Adapters use the step name as
 *      a stable identity for memoization and event-sourced replay. Do not
 *      include random ids, timestamps, or run-specific values in the name.
 *
 *   3. **State flows through step returns.** Variables defined inside a
 *      workflow body but outside a step are not guaranteed to survive a
 *      hibernation boundary. Read inputs at the top of a step; return only
 *      what you need; pass results forward through subsequent steps.
 *
 *   4. **Workflow bodies must be deterministic.** Two replays of the same
 *      input must take the same control-flow path. Push non-determinism
 *      (clocks, randomness, network reads) into steps so the adapter can
 *      memoize the result.
 *
 *   5. **Sleeps and waits are first-class.** Use
 *      {@link DurableExecutionAdapter.sleep},
 *      {@link DurableExecutionAdapter.sleepUntil}, and
 *      {@link DurableExecutionAdapter.waitForEvent} rather than `setTimeout`
 *      or polling — only the adapter knows how to suspend and resume the
 *      workflow correctly.
 *
 * ## Error semantics
 *
 * - {@link DurableStepError} (and its subclasses) are thrown by step
 *   execution failures. The {@link DurableStepError.retryable} flag tells
 *   the caller whether the adapter considered the failure transient. Real
 *   adapters surface their backend's retry decisions through this flag.
 *
 * - {@link WaitForEventTimeoutError} is thrown by
 *   {@link DurableExecutionAdapter.waitForEvent} when a timeout elapses
 *   without the named event arriving. Callers should catch this explicitly
 *   to model "happens within N" branches.
 *
 * - All other thrown errors propagate as-is. Callers must classify
 *   non-retryable business errors themselves; adapters do not introspect
 *   user errors.
 *
 * ## Subpath export
 *
 * This module ships at the `ai-workflows/durable-execution` subpath so the
 * cascade orchestrator (in `ai-database`) can depend on the port without
 * pulling in the full `ai-workflows` runtime — keeping the static dependency
 * graph one-way (`ai-database` → `ai-workflows/durable-execution`).
 *
 * @example In-memory test usage
 * ```ts
 * import { createInMemoryDurableExecution } from 'ai-workflows/durable-execution'
 *
 * const dx = createInMemoryDurableExecution()
 * const result = await dx.run('charge-customer', async (ctx) => {
 *   const charged = await ctx.step('charge-card', async () => {
 *     return chargeStripe(ctx.input)
 *   })
 *   await ctx.sleep('1 second')
 *   return { id: charged.id }
 * }, { customerId: 'c-1', amount: 1000 })
 * ```
 *
 * @example Wiring a real adapter (future Phase 1; bead aip-fgq5/aip-i456)
 * ```ts
 * import type { DurableExecutionAdapter } from 'ai-workflows/durable-execution'
 *
 * function makeCascadeRunner(dx: DurableExecutionAdapter) {
 *   return (input: CascadeInput) => dx.run('cascade', async (ctx) => {
 *     const plan = await ctx.step('plan', () => generatePlan(ctx.input))
 *     return ctx.step('write', () => writeAll(plan))
 *   }, input)
 * }
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Workflow function shape
// =============================================================================

/**
 * Context passed to a {@link WorkflowFn}. Provides the same step / sleep /
 * wait primitives as the top-level {@link DurableExecutionAdapter}, plus the
 * input the workflow was invoked with.
 *
 * The context is bound to one workflow run; calls on it are routed to the
 * adapter that started the run.
 */
export interface WorkflowContext<TInput = unknown> {
  /** The input value the workflow was invoked with. */
  readonly input: TInput

  /** Stable instance id assigned by the adapter at run start. */
  readonly instanceId: string

  /** Logical workflow name supplied at {@link DurableExecutionAdapter.run}. */
  readonly name: string

  /**
   * Execute a named, durable step. See
   * {@link DurableExecutionAdapter.step} for semantics.
   */
  step<T>(name: string, fn: () => Promise<T>): Promise<T>

  /**
   * Execute a named, durable step with explicit configuration. See
   * {@link DurableExecutionAdapter.step}.
   */
  step<T>(name: string, config: StepConfig, fn: () => Promise<T>): Promise<T>

  /** Suspend the workflow for {@link DurableExecutionAdapter.sleep}. */
  sleep(duration: string | number): Promise<void>

  /** Suspend until {@link DurableExecutionAdapter.sleepUntil}. */
  sleepUntil(date: Date): Promise<void>

  /** Wait for a named event. See {@link DurableExecutionAdapter.waitForEvent}. */
  waitForEvent<T = unknown>(name: string, timeout?: number | string): Promise<T>
}

/**
 * A user-authored workflow body.
 *
 * The body must be deterministic across replays — see the "Rules of
 * Workflows" in the module-level docs. The function is invoked once per
 * run-or-replay; the adapter memoizes step results by step name so repeated
 * executions converge on the same outcome.
 */
export type WorkflowFn<TResult = unknown, TInput = unknown> = (
  ctx: WorkflowContext<TInput>
) => Promise<TResult>

// =============================================================================
// Step configuration
// =============================================================================

/**
 * Per-step configuration. Adapters that do not support a given option treat
 * it as advisory. CF Workflows and WDK both support timeout and retries;
 * the in-memory stub honours retries and ignores timeout (since steps are
 * synchronous from the adapter's perspective).
 */
export interface StepConfig {
  /** Maximum total attempts including the first. Default: adapter-specific (typically 1). */
  retries?: {
    /** Total attempts (>= 1). */
    limit: number
    /** Delay between attempts. String forms: '1 second', '500ms'. */
    delay?: string | number
    /** Backoff curve. Default: 'constant'. */
    backoff?: 'constant' | 'linear' | 'exponential'
  }
  /** Per-attempt timeout. String or ms. */
  timeout?: string | number
}

// =============================================================================
// Subscription / scheduling
// =============================================================================

/**
 * Returned by {@link DurableExecutionAdapter.schedule}. Calling
 * {@link Subscription.unsubscribe} cancels the schedule; idempotent.
 */
export interface Subscription {
  /** Stable id for the schedule (adapter-defined format). */
  readonly id: string
  /** Cancel the schedule. Safe to call more than once. */
  unsubscribe(): void
}

// =============================================================================
// Error types
// =============================================================================

/**
 * Thrown when a step's body fails after all retries (or immediately, when
 * retries are not configured).
 *
 * The {@link DurableStepError.retryable} flag reflects the adapter's
 * judgement about the underlying failure: `true` means the adapter believed
 * the failure was transient (network, rate-limit, server error) and would
 * have retried again given more attempts; `false` means the adapter
 * classified it as terminal (programmer error, invalid input). Callers can
 * use this to decide whether to escalate or fall through to a different
 * code path.
 */
export class DurableStepError extends Error {
  /** Step name that failed. */
  readonly stepName: string
  /** Number of attempts the adapter actually made (>= 1). */
  readonly attempts: number
  /** Whether the adapter considered the cause transient. */
  readonly retryable: boolean
  /** The error that ultimately caused the failure. */
  override readonly cause: unknown

  constructor(
    message: string,
    options: {
      stepName: string
      attempts: number
      retryable: boolean
      cause: unknown
    }
  ) {
    super(message)
    this.name = 'DurableStepError'
    this.stepName = options.stepName
    this.attempts = options.attempts
    this.retryable = options.retryable
    this.cause = options.cause
  }
}

/**
 * Thrown when {@link DurableExecutionAdapter.waitForEvent} elapses without
 * the named event arriving.
 */
export class WaitForEventTimeoutError extends Error {
  readonly eventName: string
  readonly timeout: number | string
  constructor(eventName: string, timeout: number | string) {
    super(`Timed out waiting for event "${eventName}" after ${String(timeout)}`)
    this.name = 'WaitForEventTimeoutError'
    this.eventName = eventName
    this.timeout = timeout
  }
}

// =============================================================================
// The port
// =============================================================================

/**
 * Concrete adapter kind. Used only as a discriminant for callers that want
 * to log or branch on the active backend; should never be relied on for
 * correctness.
 */
export type DurableExecutionKind = 'in-process' | 'cloudflare' | 'vercel-wdk'

/**
 * The port. A small, backend-agnostic interface over `run`, `step`, `sleep`,
 * `waitForEvent`, and `schedule`.
 *
 * Real adapters live alongside this file but ship behind feature flags or
 * separate subpath modules so importing the port itself does not pull in
 * any backend dependencies.
 */
export interface DurableExecutionAdapter {
  /** Discriminant tag for the active backend. */
  readonly kind: DurableExecutionKind

  /**
   * Run a workflow body to completion. The adapter assigns the run a
   * stable `instanceId`, persists it (where applicable), and invokes `fn`
   * with a {@link WorkflowContext}.
   *
   * Resolves with the workflow's return value. Rejects with whatever the
   * body or its steps reject with — callers must handle both
   * {@link DurableStepError} and arbitrary user errors.
   *
   * @param name Logical name of the workflow (used for telemetry and, in
   * some backends, for routing). Should be stable across deployments.
   * @param fn The deterministic workflow body. See module docs for rules.
   * @param input Arbitrary input value passed through to `ctx.input`. Must
   * be JSON-serializable for adapters that persist state (CF, WDK).
   */
  run<TResult = unknown, TInput = unknown>(
    name: string,
    fn: WorkflowFn<TResult, TInput>,
    input: TInput
  ): Promise<TResult>

  /**
   * Execute a named, idempotent step.
   *
   * Step names must be stable across replays — the adapter uses the name
   * as the memoization key. On replay, a step that has already succeeded
   * returns its memoized result without re-invoking `fn`. On a transient
   * failure, the adapter retries per {@link StepConfig.retries} (or its
   * default policy).
   *
   * Outside of `run()` (e.g. when the adapter is called directly without a
   * surrounding workflow body) implementations may either: (a) treat
   * `step` as a thin wrapper that calls `fn` once with no replay, or (b)
   * throw. The in-memory stub picks (a) because it is convenient for tests.
   *
   * Step bodies must be idempotent — see the Rules of Workflows.
   */
  step<T>(name: string, fn: () => Promise<T>): Promise<T>
  step<T>(name: string, config: StepConfig, fn: () => Promise<T>): Promise<T>

  /**
   * Suspend execution for a duration. The adapter's backend may hibernate
   * the workflow during the sleep window; in-memory the stub merely awaits.
   *
   * @param duration Number of milliseconds, or a human string accepted by
   * the backend (e.g. `'1 second'`, `'5 minutes'`, `'1 day'`). Adapters
   * that do not understand a string form must throw.
   */
  sleep(duration: string | number): Promise<void>

  /** Suspend execution until the given absolute timestamp. */
  sleepUntil(date: Date): Promise<void>

  /**
   * Wait for an externally-signalled event by name.
   *
   * @param name Event name. Convention: `Noun.event` (matching
   * `ai-workflows`'s dispatch shape) but adapters do not enforce this.
   * @param timeout Optional max wait. Number = milliseconds. String = a
   * backend-recognised duration. When `undefined` the adapter waits
   * forever (or until its hard backend limit, e.g. 365 days for CF).
   *
   * Rejects with {@link WaitForEventTimeoutError} if the timeout elapses.
   */
  waitForEvent<T = unknown>(name: string, timeout?: number | string): Promise<T>

  /**
   * Register a workflow body to run on a cron schedule.
   *
   * The schedule itself is durable — the adapter is responsible for firing
   * at the given cron expression even across process restarts. The
   * returned {@link Subscription} cancels the schedule when unsubscribed.
   *
   * Fired runs receive an empty input (`undefined`). To pass per-run data,
   * read it from external state inside the workflow body.
   */
  schedule<TResult = unknown>(
    name: string,
    cron: string,
    fn: WorkflowFn<TResult, undefined>
  ): Subscription
}

// =============================================================================
// In-memory stub for tests
// =============================================================================

/**
 * Options for {@link createInMemoryDurableExecution}.
 */
export interface InMemoryDurableExecutionOptions {
  /**
   * Override the clock. Used by tests to control sleep without waiting in
   * real time. When provided, `sleep`/`sleepUntil` resolve as soon as the
   * clock returns a value `>= deadline`.
   */
  now?: () => number

  /**
   * Override the sleep primitive. Defaults to a real `setTimeout`. Tests
   * that want to fast-forward time can replace this with a no-op.
   */
  delay?: (ms: number) => Promise<void>
}

/**
 * Internal: parse human-readable durations like `'1 second'`, `'500ms'`,
 * `'5 minutes'` into milliseconds. The supported grammar is small on
 * purpose; real backends define their own. Numbers pass through.
 */
function parseDuration(input: string | number): number {
  if (typeof input === 'number') return input
  const trimmed = input.trim().toLowerCase()
  const match = trimmed.match(
    /^(\d+(?:\.\d+)?)\s*(ms|millisecond|milliseconds|s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days)$/
  )
  if (!match) {
    throw new Error(`Unrecognised duration: "${input}"`)
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
    /* istanbul ignore next */
    default:
      throw new Error(`Unrecognised duration unit: "${unit}"`)
  }
}

/** Internal: compute backoff delay for retry attempt n (1-based). */
function computeBackoff(config: NonNullable<StepConfig['retries']>, attempt: number): number {
  const baseMs = config.delay !== undefined ? parseDuration(config.delay) : 0
  const strategy = config.backoff ?? 'constant'
  switch (strategy) {
    case 'constant':
      return baseMs
    case 'linear':
      return baseMs * attempt
    case 'exponential':
      return baseMs * Math.pow(2, attempt - 1)
  }
}

/**
 * Construct an in-memory {@link DurableExecutionAdapter} suitable for tests
 * and validating the port shape. **Not durable** — state lives only in
 * closure for the lifetime of the process.
 *
 * Behaviour:
 *
 * - `run`: invokes the body once with a fresh context. No replay.
 * - `step`: memoizes the result by step name within a single `run`
 *   invocation; outside a `run` it executes once and returns. Honours
 *   retries (constant/linear/exponential backoff).
 * - `sleep` / `sleepUntil`: awaits real time by default, overridable via
 *   {@link InMemoryDurableExecutionOptions.delay}.
 * - `waitForEvent`: pairs with {@link InMemoryDurableExecution.emit} on the
 *   returned object. If `timeout` elapses first, rejects with
 *   {@link WaitForEventTimeoutError}.
 * - `schedule`: installs a `setInterval` that fires the workflow body each
 *   `cron` tick. The cron expression itself is **not** parsed in the stub —
 *   it is treated as opaque metadata. Tests that want time-driven schedules
 *   should drive emissions manually via the returned helpers.
 *
 * The stub satisfies the full {@link DurableExecutionAdapter} surface so
 * tests can validate the port shape without writing a real adapter.
 */
export interface InMemoryDurableExecution extends DurableExecutionAdapter {
  /**
   * Manually deliver an event to the next pending {@link waitForEvent}
   * call with the matching name. Returns `true` if a waiter was resolved,
   * `false` otherwise.
   */
  emit<T = unknown>(name: string, value: T): boolean
}

interface PendingWaiter {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

/**
 * @see InMemoryDurableExecution
 */
export function createInMemoryDurableExecution(
  options: InMemoryDurableExecutionOptions = {}
): InMemoryDurableExecution {
  const now = options.now ?? (() => Date.now())
  const delay =
    options.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  // Per-run memoization is keyed by the surrounding run's instanceId. Calls
  // outside of a run get an `undefined` key (single shared bucket).
  const runMemo = new Map<string | undefined, Map<string, unknown>>()

  // Active event waiters, FIFO per event name.
  const waiters = new Map<string, PendingWaiter[]>()

  // Active scheduled intervals, by subscription id.
  const schedules = new Map<string, ReturnType<typeof setInterval>>()
  let scheduleSeq = 0
  let runSeq = 0

  // Tracks the active run so step() can attribute results to the right
  // memo bucket. We only support a single concurrent run for memo purposes;
  // concurrent runs do not share state regardless.
  type RunFrame = { instanceId: string }
  const runStack: RunFrame[] = []
  const currentRun = (): RunFrame | undefined => runStack[runStack.length - 1]

  async function executeStep<T>(
    name: string,
    config: StepConfig | undefined,
    fn: () => Promise<T>
  ): Promise<T> {
    const frame = currentRun()
    const bucketKey = frame?.instanceId
    let bucket = runMemo.get(bucketKey)
    if (!bucket) {
      bucket = new Map()
      runMemo.set(bucketKey, bucket)
    }
    if (bucket.has(name)) {
      return bucket.get(name) as T
    }

    const retries = config?.retries
    const maxAttempts = retries?.limit ?? 1
    let lastErr: unknown
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fn()
        bucket.set(name, result)
        return result
      } catch (err) {
        lastErr = err
        if (attempt < maxAttempts && retries) {
          const wait = computeBackoff(retries, attempt)
          if (wait > 0) await delay(wait)
        }
      }
    }
    throw new DurableStepError(`Step "${name}" failed after ${maxAttempts} attempt(s)`, {
      stepName: name,
      attempts: maxAttempts,
      retryable: true,
      cause: lastErr,
    })
  }

  async function sleep(duration: string | number): Promise<void> {
    const ms = parseDuration(duration)
    if (ms > 0) await delay(ms)
  }

  async function sleepUntil(date: Date): Promise<void> {
    const ms = date.getTime() - now()
    if (ms > 0) await delay(ms)
  }

  function waitForEvent<T = unknown>(name: string, timeout?: number | string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const queue = waiters.get(name) ?? []
      const waiter: PendingWaiter = {
        resolve: (v) => resolve(v as T),
        reject,
      }
      queue.push(waiter)
      waiters.set(name, queue)

      if (timeout !== undefined) {
        const ms = parseDuration(timeout)
        const timer = setTimeout(() => {
          const q = waiters.get(name)
          if (!q) return
          const idx = q.indexOf(waiter)
          if (idx >= 0) {
            q.splice(idx, 1)
            if (q.length === 0) waiters.delete(name)
            reject(new WaitForEventTimeoutError(name, timeout))
          }
        }, ms)
        // Don't keep the process alive solely for a wait timeout.
        if (typeof (timer as { unref?: () => void }).unref === 'function') {
          ;(timer as { unref?: () => void }).unref!()
        }
      }
    })
  }

  function emit<T = unknown>(name: string, value: T): boolean {
    const queue = waiters.get(name)
    if (!queue || queue.length === 0) return false
    const waiter = queue.shift()!
    if (queue.length === 0) waiters.delete(name)
    waiter.resolve(value)
    return true
  }

  function schedule<TResult = unknown>(
    name: string,
    cron: string,
    fn: WorkflowFn<TResult, undefined>
  ): Subscription {
    const id = `sched-${++scheduleSeq}`
    // The stub does not parse cron — it fires every second. Tests that
    // need precise timing should drive runs manually rather than rely on
    // the stub's scheduler. Real adapters honour the cron expression.
    void cron
    void name
    const handle = setInterval(() => {
      void adapter.run(name, fn, undefined).catch(() => {
        // Schedule errors are swallowed; the stub has nowhere to surface
        // them. Real adapters log/persist failures.
      })
    }, 1000)
    if (typeof (handle as unknown as { unref?: () => void }).unref === 'function') {
      ;(handle as unknown as { unref: () => void }).unref()
    }
    schedules.set(id, handle)
    return {
      id,
      unsubscribe(): void {
        const h = schedules.get(id)
        if (h) {
          clearInterval(h)
          schedules.delete(id)
        }
      },
    }
  }

  async function run<TResult = unknown, TInput = unknown>(
    name: string,
    fn: WorkflowFn<TResult, TInput>,
    input: TInput
  ): Promise<TResult> {
    const instanceId = `run-${++runSeq}`
    const frame: RunFrame = { instanceId }
    runStack.push(frame)
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
          return executeStep(stepName, undefined, configOrFn) as Promise<unknown>
        }
        return executeStep(stepName, configOrFn, maybeFn!) as Promise<unknown>
      }) as WorkflowContext<TInput>['step'],
      sleep,
      sleepUntil,
      waitForEvent,
    }
    try {
      return await fn(ctx)
    } finally {
      runStack.pop()
      runMemo.delete(instanceId)
    }
  }

  const adapter: InMemoryDurableExecution = {
    kind: 'in-process',
    run,
    step: ((
      name: string,
      configOrFn: StepConfig | (() => Promise<unknown>),
      maybeFn?: () => Promise<unknown>
    ) => {
      if (typeof configOrFn === 'function') {
        return executeStep(name, undefined, configOrFn) as Promise<unknown>
      }
      return executeStep(name, configOrFn, maybeFn!) as Promise<unknown>
    }) as DurableExecutionAdapter['step'],
    sleep,
    sleepUntil,
    waitForEvent,
    schedule,
    emit,
  }

  return adapter
}
