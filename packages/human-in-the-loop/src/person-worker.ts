/**
 * Person-as-Worker adapter — the **Person filler** of the `digital-workers`
 * Worker port.
 *
 * `personAsWorker(person, options)` wraps a `Human` (a Person record) so it
 * satisfies the `Worker` interface from `digital-workers` AND carries a
 * `dispatch` port. When `digital-workers.ask(personWorker, question, …)`
 * dispatches, it routes through this adapter, which surfaces the Human
 * lifecycle — **claim → (startProgress) → resolve**, with **escalate** on
 * failure — and obtains the human's answer through an injected `resolve`
 * callback (the channel-delivery seam: Chat SDK today, email/Slack tomorrow,
 * a stub in tests).
 *
 * This is the counterpart to `autonomous-agents`' `agentAsWorker`: where the
 * Agent filler routes `ask` through `generateObject`, the Person filler routes
 * `ask` through the lifecycle state machine. Both satisfy the same
 * `WorkerDispatcher` contract so callers do not care which kind backs a
 * Worker. PRD: route Layer 5 through digital-workers (aip-qozi).
 *
 * @packageDocumentation
 */

import type {
  Worker as DigitalWorker,
  WorkerStatus,
  Contacts,
  ContactPreferences,
  WorkerDispatcher,
  WorkerAskInput,
  WorkerAskOutput,
} from 'digital-workers'
import type { Human } from './types.js'
import type {
  LifecycleItem,
  LifecyclePriority,
  RequestKind,
  ArtifactRef,
} from './request-lifecycle.js'
import type { LifecycleStore } from './lifecycle-store.js'
import type { LifecycleChannelAdapter } from './lifecycle-channel-adapter.js'
import { LifecycleStoreMemory } from './lifecycle-store-memory.js'

/**
 * Context handed to a `PersonAskResolver` when the lifecycle reaches the point
 * where the human's answer is needed.
 */
export interface PersonAskContext {
  /** The created (and claimed/in-progress) lifecycle item. */
  item: LifecycleItem
  /** The original question. */
  question: string
  /** The Person who owns this Worker. */
  person: Human
}

/**
 * Strategy for obtaining a human's answer to a delivered `ask` Function.
 *
 * This is the channel-delivery seam. Real deployments resolve this by
 * subscribing to a channel adapter's inbound response (Chat SDK webhook, email
 * reply, etc.); tests supply a stub that returns synchronously. The resolver
 * MUST resolve with the answer string (or reject to trigger escalation).
 */
export type PersonAskResolver = (ctx: PersonAskContext) => Promise<string>

/**
 * Options for {@link personAsWorker}.
 */
export interface PersonWorkerAdapterOptions {
  /** Stable Worker id. Defaults to the person's `id`. */
  id?: string
  /** Override the Worker `name`. Defaults to `person.name`. */
  name?: string
  /** Initial Worker status. Defaults to `'available'`. */
  status?: WorkerStatus
  /**
   * Contact channels. Defaults to a mapping derived from the person's
   * `channels` (slack / email / sms / web).
   */
  contacts?: Contacts
  /** Optional contact-routing preferences. */
  preferences?: ContactPreferences
  /** Override skills. Defaults to the person's roles. */
  skills?: string[]
  /** Free-form metadata stored on the Worker. */
  metadata?: Record<string, unknown>

  /**
   * Lifecycle persistence store. Defaults to a fresh in-memory store. Supply a
   * shared store to persist Human Functions across calls / surfaces.
   */
  store?: LifecycleStore
  /**
   * Optional channel adapter used to deliver the pending Function to the human
   * (push, email, Slack, web queue). Delivery failures are logged, not thrown.
   */
  channelAdapter?: LifecycleChannelAdapter
  /**
   * How the human's answer is obtained. REQUIRED — without it the adapter has
   * no way to surface the answer (it would only create a pending Function and
   * never resolve). Tests pass a stub; real deployments wire a channel-inbound
   * resolver.
   */
  resolve: PersonAskResolver
  /**
   * Default SLA window in milliseconds (used to compute `slaDeadline`).
   * Defaults to 1 hour.
   */
  slaMs?: number
  /** Default priority for created Functions. Defaults to `'normal'`. */
  priority?: LifecyclePriority
  /** Assignee identifier on created Functions. Defaults to the person's id. */
  assignee?: string
}

const DEFAULT_SLA_MS = 60 * 60 * 1000 // 1 hour

/**
 * Map a Person's `channels` into the `digital-workers` `Contacts` shape.
 */
function personChannelsToContacts(person: Human): Contacts {
  const contacts: Contacts = {}
  const ch = person.channels
  if (!ch) return contacts
  if (ch.slack !== undefined) contacts.slack = ch.slack
  if (ch.email !== undefined) contacts.email = ch.email
  if (ch.sms !== undefined) contacts.sms = ch.sms
  if (ch.web === true) contacts.web = { userId: person.id }
  return contacts
}

/**
 * `personAsWorker` — adapt a `Human` (Person) to the kind-agnostic `Worker`
 * interface from `digital-workers`, attaching a lifecycle-backed `dispatch`
 * port.
 *
 * @example
 * ```ts
 * import { ask } from 'digital-workers'
 * import { personAsWorker } from 'human-in-the-loop'
 *
 * const priyaWorker = personAsWorker(priya, {
 *   // Wire the Chat SDK / web queue inbound here; stubbed in tests.
 *   resolve: async ({ item }) => awaitInboundAnswer(item.id),
 * })
 * const { answer, answeredBy } = await ask(priyaWorker, 'Approve the refund?')
 * ```
 */
export function personAsWorker(person: Human, options: PersonWorkerAdapterOptions): DigitalWorker {
  const id = options.id ?? person.id
  const name = options.name ?? person.name

  const worker: DigitalWorker = {
    id,
    name,
    type: 'human',
    status: options.status ?? 'available',
    contacts: options.contacts ?? personChannelsToContacts(person),
    skills: options.skills ?? person.roles ?? [],
    dispatch: personDispatcher(person, id, name, options),
  }

  if (options.preferences !== undefined) worker.preferences = options.preferences
  if (options.metadata !== undefined) worker.metadata = options.metadata

  return worker
}

/**
 * Build the lifecycle-backed `WorkerDispatcher` for a Person filler.
 *
 * The `ask` verb walks the Human lifecycle:
 *   create (pending) → deliver → claim → startProgress → resolve (completed)
 * obtaining the answer via the injected `resolve` callback. On resolver
 * failure the item is escalated (active → escalated) before the error
 * re-throws, surfacing the escalation transition.
 */
function personDispatcher(
  person: Human,
  id: string,
  name: string,
  options: PersonWorkerAdapterOptions
): WorkerDispatcher {
  const store = options.store ?? new LifecycleStoreMemory()
  const slaMs = options.slaMs ?? DEFAULT_SLA_MS
  const priority = options.priority ?? 'normal'
  const assignee = options.assignee ?? person.id

  return {
    async ask<T = string>(input: WorkerAskInput): Promise<WorkerAskOutput<T>> {
      const now = new Date()
      const kind: RequestKind = 'ask'
      const artifact: ArtifactRef = {
        kind: 'Question',
        id: `q_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
        title: input.question,
        ...(input.context !== undefined && { context: input.context }),
      }

      const item: LifecycleItem = {
        id: `hf_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
        kind,
        askPayload: { question: input.question },
        status: 'pending',
        priority,
        title: input.question,
        artifact,
        assignee,
        createdAt: now,
        slaDeadline: new Date(now.getTime() + (input.timeout ?? slaMs)),
        updatedAt: now,
      }

      // 1. Persist the pending Function.
      const created = await store.create(item)

      // 2. Deliver to the human via the configured channel (best-effort).
      if (options.channelAdapter) {
        try {
          await options.channelAdapter.deliver(created, store)
        } catch (err) {
          // Delivery failures must not break the caller's flow.
          console.warn(`[human-in-the-loop] channel delivery failed for ${created.id}:`, err)
        }
      }

      // 3. Claim the Function on behalf of the assignee, then start progress.
      let current = await store.update(created.id, {
        status: 'claimed',
        claimedBy: assignee,
        claimedAt: new Date(),
      })
      current = await store.update(current.id, { status: 'in_progress' })

      // 4. Obtain the human's answer (the channel-inbound seam). On failure,
      //    escalate the Function before surfacing the error.
      let answerText: string
      try {
        answerText = await options.resolve({ item: current, question: input.question, person })
      } catch (err) {
        await store.escalate(current.id, assignee)
        throw err
      }

      // 5. Resolve the Function (in_progress → completed).
      await store.complete(current.id, {
        verb: 'answered',
        resolvedBy: assignee,
        comments: answerText,
        data: { answer: answerText },
      })

      return {
        answer: answerText as unknown as T,
        answeredBy: { id, type: 'human', name },
      }
    },
  }
}
