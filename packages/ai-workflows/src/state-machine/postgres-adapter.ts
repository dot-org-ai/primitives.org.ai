/**
 * PostgresAdapter — a {@link StateMachineStorage} backed by three Postgres
 * tables, plus a {@link PostgresStateMachineScheduler} that fires due `after X`
 * timers deterministically (no wall-clock waiting), and a small
 * {@link replayMachine} helper that re-applies a machine's event log against a
 * fresh actor.
 *
 * This is the analytical/replayable durability backend from ADR-0011, for
 * workflows whose history needs to be queryable / replayable / joinable with
 * analytical workloads. It maps the port's three concerns onto pg tables:
 *
 *   - **Snapshot** → one row in `state_machine_instances` (JSONB `snapshot`
 *     column, keyed by `machine_id`), replaced on every transition.
 *   - **Event log** → an append-only `state_machine_events` table with a
 *     monotonic 0-based `seq` per machine (arrival order), matching the
 *     in-memory adapter's observable behaviour the contract asserts.
 *   - **Timers** → rows in `state_machine_timers` (`schedule`/replace via
 *     `ON CONFLICT`, `cancel` via `DELETE`, `list` via `SELECT`). A scheduler
 *     reads due rows (`fire_at <= now`) and hands them back so the host can
 *     deliver the delay event into the actor.
 *
 * ## No `ai-database` import — dependency-injected executor (layering)
 *
 * Per `CLAUDE.md`'s layer rules, `ai-workflows` is Layer 0 and `ai-database` is
 * Layer 3 — a Layer-0 module must not import a Layer-3 package, or it would
 * invert (and risk cycling) the layering. So this adapter does **not** import
 * `ai-database`. Instead it accepts an injected {@link PgExecutor} — the exact
 * `(sql, params) => rows` driver-agnostic shape `ai-database`'s `pg-adapter`
 * exposes — re-declared structurally here. Callers wire it from whichever
 * `ai-database` executor factory (`createNeonHttpExecutor`,
 * `createPgClientExecutor`) they already use; `ai-workflows` stays free of any
 * `ai-database` dependency. Dependency injection over a static dep keeps the
 * package boundary clean and the seam testable with a fake executor offline.
 *
 * ## Schema
 *
 * ```sql
 * CREATE TABLE IF NOT EXISTS state_machine_instances (
 *   machine_id text PRIMARY KEY,
 *   snapshot   jsonb NOT NULL,
 *   updated_at timestamptz NOT NULL DEFAULT now()
 * );
 *
 * CREATE TABLE IF NOT EXISTS state_machine_events (
 *   machine_id text NOT NULL,
 *   seq        bigint NOT NULL,
 *   type       text NOT NULL,
 *   event      jsonb NOT NULL,
 *   created_at timestamptz NOT NULL DEFAULT now(),
 *   ts_ms      bigint NOT NULL,
 *   CONSTRAINT state_machine_events_pk PRIMARY KEY (machine_id, seq)
 * );
 *
 * CREATE TABLE IF NOT EXISTS state_machine_timers (
 *   machine_id text NOT NULL,
 *   id         text NOT NULL,
 *   fire_at    bigint NOT NULL,
 *   event      jsonb NOT NULL,
 *   CONSTRAINT state_machine_timers_pk PRIMARY KEY (machine_id, id)
 * );
 * CREATE INDEX IF NOT EXISTS state_machine_timers_fire_at_idx
 *   ON state_machine_timers (fire_at);
 * ```
 *
 * {@link bootstrapStateMachineSchema} ships this DDL so a caller can stand up
 * the tables in one call.
 *
 * @packageDocumentation
 */

import { runMachine } from './runtime.js'
import type { ActorClock, MachineHandle, RunnableMachine } from './runtime.js'
import type {
  MachineEventLogEntry,
  PersistedMachineSnapshot,
  ScheduledTimer,
  StateMachineStorage,
} from './storage.js'

// =============================================================================
// Driver-agnostic executor (injected — no ai-database import)
// =============================================================================

/**
 * Driver-agnostic Postgres executor. The exact shape `ai-database`'s
 * `pg-adapter` exposes (`createNeonHttpExecutor` / `createPgClientExecutor`
 * both produce it), re-declared structurally here so this module never imports
 * `ai-database` — keeping `ai-workflows` (Layer 0) free of a Layer-3
 * dependency. Callers inject one built from their own `ai-database` driver.
 *
 * @param sql - Parameterised SQL with `$1`, `$2`, … placeholders.
 * @param params - Positional parameter values (may be omitted).
 * @returns Result rows as plain objects keyed by column name.
 */
export type PgExecutor = (
  sql: string,
  params?: ReadonlyArray<unknown>
) => Promise<Array<Record<string, unknown>>>

// =============================================================================
// Table-name layout
// =============================================================================

/**
 * The three table names the adapter reads/writes. Override to namespace them
 * (e.g. a per-tenant schema prefix); defaults match the ADR-0011 / PRD names.
 */
export interface PostgresStateMachineTables {
  /** Snapshot table — one row per machine, JSONB snapshot column. */
  instances: string
  /** Append-only event-log table — monotonic `seq` per machine. */
  events: string
  /** Timers table — pending `after X` transitions. */
  timers: string
}

const DEFAULT_TABLES: PostgresStateMachineTables = {
  instances: 'state_machine_instances',
  events: 'state_machine_events',
  timers: 'state_machine_timers',
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Options for {@link createPostgresStateMachineStorage}.
 */
export interface PostgresStateMachineStorageOptions {
  /**
   * Injected Postgres executor — typically built from `ai-database`'s
   * `createNeonHttpExecutor(neon(url))` or `createPgClientExecutor(sql)`. The
   * adapter is driver-agnostic; it only ever calls this function.
   */
  executor: PgExecutor
  /**
   * Override the table names. Partial overrides merge over
   * {@link DEFAULT_TABLES}.
   */
  tables?: Partial<PostgresStateMachineTables>
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Coerce a jsonb column value into a plain object. Drivers vary — neon returns
 * parsed objects; postgres.js may hand back a string depending on type
 * configuration. Mirrors `ai-database`'s `asJsonb`.
 */
function asObject<T extends Record<string, unknown>>(value: unknown): T {
  if (!value) return {} as T
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return {} as T
    }
  }
  if (typeof value === 'object') return value as T
  return {} as T
}

/** Coerce a bigint/numeric/string column into a JS number. */
function asNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

// =============================================================================
// The storage adapter
// =============================================================================

/**
 * A Postgres-backed {@link StateMachineStorage}. See
 * {@link createPostgresStateMachineStorage}. Carries the live executor and
 * resolved table names so the scheduler and replay helpers can be built from
 * the same instance.
 */
export interface PostgresStateMachineStorage extends StateMachineStorage {
  readonly kind: 'postgres'
  /** The injected executor (escape hatch for the scheduler / bootstrap). */
  readonly executor: PgExecutor
  /** The resolved table names this adapter reads/writes. */
  readonly tables: PostgresStateMachineTables
}

/**
 * Build a {@link StateMachineStorage} backed by three Postgres tables, via an
 * injected {@link PgExecutor}. Pure storage I/O — snapshot row, append-only
 * event log, timers table — with no actor or scheduler logic (that lives in
 * {@link createPostgresStateMachineScheduler}).
 *
 * @example
 * ```ts
 * import { neon } from '@neondatabase/serverless'
 * import { createNeonHttpExecutor } from 'ai-database'
 * import { createPostgresStateMachineStorage } from 'ai-workflows'
 *
 * const executor = createNeonHttpExecutor(neon(env.DATABASE_URL))
 * const storage = createPostgresStateMachineStorage({ executor })
 * await storage.setSnapshot('m-1', actor.getPersistedSnapshot())
 * ```
 */
export function createPostgresStateMachineStorage(
  options: PostgresStateMachineStorageOptions
): PostgresStateMachineStorage {
  const executor = options.executor
  const tables: PostgresStateMachineTables = { ...DEFAULT_TABLES, ...options.tables }

  return {
    kind: 'postgres',
    executor,
    tables,

    async setSnapshot(machineId, snapshot) {
      // Replace-on-write: one row per machine, keyed by machine_id.
      await executor(
        `INSERT INTO ${tables.instances} (machine_id, snapshot, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (machine_id)
         DO UPDATE SET snapshot = EXCLUDED.snapshot, updated_at = now()`,
        [machineId, JSON.stringify(snapshot)]
      )
    },

    async getSnapshot(machineId) {
      const rows = await executor(
        `SELECT snapshot FROM ${tables.instances} WHERE machine_id = $1 LIMIT 1`,
        [machineId]
      )
      if (rows.length === 0) return undefined
      return asObject<Record<string, unknown>>(rows[0]!['snapshot']) as PersistedMachineSnapshot
    },

    async appendEvent(machineId, event) {
      const timestamp = Date.now()
      // Assign seq atomically as COALESCE(max(seq)+1, 0) for this machine. A
      // single round-trip INSERT…SELECT keeps the seq monotonic and 0-based
      // even under concurrent appends (the (machine_id, seq) PK rejects a
      // duplicate, surfacing a retryable conflict rather than a gap).
      const rows = await executor(
        `INSERT INTO ${tables.events} (machine_id, seq, type, event, ts_ms)
         SELECT $1, COALESCE(MAX(seq) + 1, 0), $2, $3::jsonb, $4
         FROM ${tables.events} WHERE machine_id = $1
         RETURNING seq, ts_ms`,
        [machineId, event.type, JSON.stringify({ ...event }), timestamp]
      )
      const seq = rows.length > 0 ? asNumber(rows[0]!['seq']) : 0
      const tsMs = rows.length > 0 ? asNumber(rows[0]!['ts_ms']) : timestamp
      return {
        seq,
        timestamp: tsMs,
        type: event.type,
        event: { ...event },
      }
    },

    async getEvents(machineId) {
      const rows = await executor(
        `SELECT seq, type, event, ts_ms FROM ${tables.events}
         WHERE machine_id = $1
         ORDER BY seq ASC`,
        [machineId]
      )
      return rows.map((row): MachineEventLogEntry => {
        const event = asObject<Record<string, unknown>>(row['event'])
        return {
          seq: asNumber(row['seq']),
          timestamp: asNumber(row['ts_ms']),
          type: String(row['type']),
          event,
        }
      })
    },

    async scheduleTimer(machineId, timer) {
      // Re-scheduling an existing id replaces it (ON CONFLICT DO UPDATE).
      await executor(
        `INSERT INTO ${tables.timers} (machine_id, id, fire_at, event)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT ON CONSTRAINT state_machine_timers_pk
         DO UPDATE SET fire_at = EXCLUDED.fire_at, event = EXCLUDED.event`,
        [machineId, timer.id, timer.fireAt, JSON.stringify(timer.event)]
      )
    },

    async cancelTimer(machineId, timerId) {
      // Read existence first to return a stable boolean — neon / postgres.js
      // do not consistently surface rowCount through the executor shape.
      const existing = await executor(
        `SELECT 1 FROM ${tables.timers} WHERE machine_id = $1 AND id = $2 LIMIT 1`,
        [machineId, timerId]
      )
      if (existing.length === 0) return false
      await executor(`DELETE FROM ${tables.timers} WHERE machine_id = $1 AND id = $2`, [
        machineId,
        timerId,
      ])
      return true
    },

    async getTimers(machineId) {
      const rows = await executor(
        `SELECT id, fire_at, event FROM ${tables.timers}
         WHERE machine_id = $1
         ORDER BY fire_at ASC, id ASC`,
        [machineId]
      )
      return rows.map((row): ScheduledTimer => {
        const event = asObject<Record<string, unknown>>(row['event'])
        return {
          id: String(row['id']),
          fireAt: asNumber(row['fire_at']),
          event,
        }
      })
    },
  }
}

// =============================================================================
// Schema bootstrap
// =============================================================================

/**
 * Run the canonical DDL for the three state-machine tables against an executor.
 * Idempotent — uses `IF NOT EXISTS` throughout. A convenience for tests and
 * one-shot setup; production deployments typically run migrations via a
 * dedicated tool.
 *
 * @param executor - the same {@link PgExecutor} the storage adapter uses.
 * @param tables - optional table-name overrides (must match the adapter's).
 */
export async function bootstrapStateMachineSchema(
  executor: PgExecutor,
  tables?: Partial<PostgresStateMachineTables>
): Promise<void> {
  const t: PostgresStateMachineTables = { ...DEFAULT_TABLES, ...tables }

  await executor(
    `CREATE TABLE IF NOT EXISTS ${t.instances} (
      machine_id text PRIMARY KEY,
      snapshot   jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )`
  )

  await executor(
    `CREATE TABLE IF NOT EXISTS ${t.events} (
      machine_id text NOT NULL,
      seq        bigint NOT NULL,
      type       text NOT NULL,
      event      jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      ts_ms      bigint NOT NULL,
      CONSTRAINT state_machine_events_pk PRIMARY KEY (machine_id, seq)
    )`
  )

  await executor(
    `CREATE TABLE IF NOT EXISTS ${t.timers} (
      machine_id text NOT NULL,
      id         text NOT NULL,
      fire_at    bigint NOT NULL,
      event      jsonb NOT NULL,
      CONSTRAINT state_machine_timers_pk PRIMARY KEY (machine_id, id)
    )`
  )
  await executor(
    `CREATE INDEX IF NOT EXISTS state_machine_timers_fire_at_idx ON ${t.timers} (fire_at)`
  )
}

// =============================================================================
// Scheduler — fires due timers deterministically (no wall-clock waiting)
// =============================================================================

/**
 * A due timer resolved by {@link PostgresStateMachineScheduler.pollDueTimers}:
 * the machine it belongs to plus the scheduled timer record. The host delivers
 * `timer.event` into the actor for `machineId`, then removes the timer.
 */
export interface DueTimer {
  /** The machine instance this timer fires for. */
  readonly machineId: string
  /** The scheduled timer (its `event` is the delay event to deliver). */
  readonly timer: ScheduledTimer
}

/**
 * The pg scheduler — the analogue of the DO `alarm()` handler. Where the DO
 * arms a single alarm at the earliest `fireAt`, the pg backend has no wakeup
 * primitive of its own; a caller (a cron worker, or a test) drives it by
 * calling {@link pollDueTimers} with a `now`. This keeps timer firing fully
 * deterministic in tests — there is no real clock waiting.
 */
export interface PostgresStateMachineScheduler {
  /**
   * Return every timer due at-or-before `now` (`fire_at <= now`), across all
   * machines, in ascending `fire_at` order. Read-only — does not remove the
   * timers; the caller removes each one (via `cancelTimer`) after delivering
   * its event, so a crash between poll and deliver leaves the timer pending
   * for the next poll (at-least-once).
   */
  pollDueTimers(now: number): Promise<readonly DueTimer[]>

  /**
   * Convenience: poll due timers for a single machine only. Same semantics as
   * {@link pollDueTimers}, scoped to `machineId`.
   */
  pollDueTimersFor(machineId: string, now: number): Promise<readonly DueTimer[]>
}

/**
 * Build a {@link PostgresStateMachineScheduler} over the same tables a
 * {@link PostgresStateMachineStorage} uses. Pass the storage instance (it
 * carries the executor + table names).
 *
 * @example
 * ```ts
 * const storage = createPostgresStateMachineStorage({ executor })
 * const scheduler = createPostgresStateMachineScheduler(storage)
 *
 * // In a cron worker (or deterministically in a test):
 * for (const { machineId, timer } of await scheduler.pollDueTimers(Date.now())) {
 *   handleFor(machineId).send(timer.event) // deliver the `after X` event
 *   await storage.cancelTimer(machineId, timer.id) // then remove it
 * }
 * ```
 */
export function createPostgresStateMachineScheduler(
  storage: PostgresStateMachineStorage
): PostgresStateMachineScheduler {
  const { executor, tables } = storage

  function toDue(row: Record<string, unknown>): DueTimer {
    return {
      machineId: String(row['machine_id']),
      timer: {
        id: String(row['id']),
        fireAt: asNumber(row['fire_at']),
        event: asObject<Record<string, unknown>>(row['event']),
      },
    }
  }

  return {
    async pollDueTimers(now) {
      const rows = await executor(
        `SELECT machine_id, id, fire_at, event FROM ${tables.timers}
         WHERE fire_at <= $1
         ORDER BY fire_at ASC, machine_id ASC, id ASC`,
        [now]
      )
      return rows.map(toDue)
    },

    async pollDueTimersFor(machineId, now) {
      const rows = await executor(
        `SELECT machine_id, id, fire_at, event FROM ${tables.timers}
         WHERE machine_id = $1 AND fire_at <= $2
         ORDER BY fire_at ASC, id ASC`,
        [machineId, now]
      )
      return rows.map(toDue)
    },
  }
}

// =============================================================================
// Run a stored machine + replay the event log
// =============================================================================

/**
 * Options for {@link runStoredMachine}.
 */
export interface RunStoredMachineOptions {
  /** The stable id under which the machine's snapshot/events/timers are keyed. */
  machineId: string
  /**
   * Optional xstate clock — pass one that routes `after X` delays through
   * {@link PostgresStateMachineStorage.scheduleTimer} so the scheduler can fire
   * them. When omitted, xstate's default in-process clock is used.
   */
  clock?: ActorClock
}

/**
 * A no-op {@link ActorClock}. The pg backend fires `after` transitions through
 * the {@link PostgresStateMachineScheduler} (durable timer rows + a poller), not
 * through xstate's in-process clock — so when no clock is supplied we install
 * this no-op so xstate's own `setTimeout` never fires the transition behind the
 * scheduler's back. All `after` firing flows through durable timers.
 */
const noopClock: ActorClock = {
  setTimeout: () => undefined,
  clearTimeout: () => undefined,
}

/**
 * Reconcile durable timer rows against an actor's *current* pending `after`
 * transitions. This is the pg analogue of the DO adapter's `syncTimers` and the
 * core durability fix: xstate's `getPersistedSnapshot()` does NOT persist
 * pending `after` timers and `createActor(..., { snapshot })` does NOT re-arm
 * them, but the rehydrated actor's active states still declare them (carrying
 * xstate's real delay-event type via {@link MachineHandle.pendingAfterTransitions}).
 *
 * Each pending transition is scheduled as a timer row keyed on (and carrying)
 * xstate's REAL delay-event type, so the scheduler can later send that exact
 * event into the resumed actor to take the transition. Timers no longer pending
 * (their state was left) are cancelled; still-pending ones are NEVER deleted.
 *
 * On resume the original arm time is unrecoverable, so `fireAt` is measured from
 * `nowMs` — an `after X` survives as "X from when the machine was resumed", the
 * correct durable-resume semantics.
 */
export async function syncPostgresTimers(
  handle: MachineHandle,
  storage: PostgresStateMachineStorage,
  nowMs: number = Date.now()
): Promise<void> {
  const machineId = handle.machineId
  const pending = handle.pendingAfterTransitions()
  const wanted = new Map(pending.map((t) => [t.eventType, t] as const))

  for (const existing of await storage.getTimers(machineId)) {
    if (!wanted.has(existing.id)) {
      await storage.cancelTimer(machineId, existing.id)
    }
  }

  const current = new Map((await storage.getTimers(machineId)).map((t) => [t.id, t]))
  for (const [eventType, t] of wanted) {
    if (current.has(eventType)) continue
    await storage.scheduleTimer(machineId, {
      id: eventType,
      fireAt: nowMs + t.delay,
      event: { type: eventType },
    })
  }
}

/**
 * Read the persisted snapshot for `machineId` and resume a running actor from
 * it (`runMachine(..., { resume: true })`). If no snapshot exists yet the
 * machine starts fresh from its initial state, so this is also the right entry
 * point for a first run on pg-backed storage.
 *
 * After starting (fresh OR resumed), it reconciles durable timer rows against
 * the actor's pending `after` transitions ({@link syncPostgresTimers}) so a
 * machine reconstructed from a stored snapshot re-arms its still-pending `after`
 * timers with xstate's real delay-event type — the scheduler then fires them.
 * This is the core durability fix: xstate does not restore `after` timers across
 * resume, so the adapter re-arms them from the rehydrated active states.
 *
 * @example
 * ```ts
 * const handle = await runStoredMachine(prReviewMachine, storage, {
 *   machineId: 'pr-42',
 * })
 * handle.getState() // exactly where the prior run left off
 * ```
 */
export async function runStoredMachine(
  machine: RunnableMachine,
  storage: PostgresStateMachineStorage,
  options: RunStoredMachineOptions
): Promise<MachineHandle> {
  const existing = await storage.getSnapshot(options.machineId)
  const handle = await runMachine(machine, storage, {
    machineId: options.machineId,
    resume: existing ? true : false,
    clock: options.clock ?? noopClock,
  })
  // Re-arm durable timers from the actor's pending after-transitions. On resume
  // this restores timers xstate did not; on a fresh start it arms the initial
  // state's delays. Skipped when a caller supplies their own clock (they own
  // timer routing — e.g. the deterministic-clock test that mirrors timers itself).
  if (!options.clock) {
    await syncPostgresTimers(handle, storage)
  }
  return handle
}

/**
 * Replay a machine's persisted event log against a **fresh** actor to reproduce
 * a run. Reads `getEvents(machineId)` in arrival order and re-applies each event
 * with `actor.send`, returning a handle to the replayed actor. The replay runs
 * under a separate `machineId` (default: `"<machineId>:replay"`) so it does not
 * clobber the original's snapshot/log — root-causing should be side-effect-free
 * against the source instance.
 *
 * @param machine - the same statechart the original run used.
 * @param storage - the pg storage holding the source event log.
 * @param sourceMachineId - the instance whose log to replay.
 * @param replayStorage - where the replay actor persists (default: a fresh
 *   in-process {@link import('./storage.js').InMemoryStateMachineStorage}; pass
 *   one to inspect the replayed snapshots/log).
 * @param replayMachineId - the id the replay actor runs under.
 *
 * @example
 * ```ts
 * const replayed = await replayMachine(prReviewMachine, storage, 'pr-42')
 * replayed.getState() // the state the original reached, reconstructed from events
 * ```
 */
export async function replayMachine(
  machine: RunnableMachine,
  storage: PostgresStateMachineStorage,
  sourceMachineId: string,
  options: {
    replayStorage?: StateMachineStorage
    replayMachineId?: string
  } = {}
): Promise<MachineHandle> {
  const events = await storage.getEvents(sourceMachineId)
  const { createInMemoryStateMachineStorage } = await import('./storage.js')
  const target = options.replayStorage ?? createInMemoryStateMachineStorage()
  const replayMachineId = options.replayMachineId ?? `${sourceMachineId}:replay`

  const handle = await runMachine(machine, target, {
    machineId: replayMachineId,
    // Do not double-log into the replay store; we are re-applying the source
    // log verbatim, not recording a new run.
    logEvents: false,
  })

  for (const entry of events) {
    handle.send(entry.event as { type: string } & Record<string, unknown>)
  }

  return handle
}
