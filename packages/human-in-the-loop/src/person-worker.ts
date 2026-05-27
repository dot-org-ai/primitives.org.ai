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
  WorkerApproveInput,
  WorkerApproveOutput,
  WorkerNotifyInput,
  WorkerNotifyOutput,
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
 * Context handed to a `PersonApproveResolver` when the lifecycle reaches the
 * point where the human's approve/reject decision is needed.
 */
export interface PersonApproveContext {
  /** The created (and claimed/in-progress) lifecycle item. */
  item: LifecycleItem
  /** The original approval request body. */
  request: string
  /** The Person who owns this Worker. */
  person: Human
}

/**
 * Decision returned by a `PersonApproveResolver`.
 *
 * `approved: false` causes the lifecycle to escalate (active → escalated) when
 * the adapter was constructed with `escalateOnReject: true` (default), in
 * line with the existing Human approval semantics. Otherwise the rejection
 * resolves the item with verb='reject' and the caller receives
 * `{ approved: false }`.
 */
export interface PersonApproveDecision {
  /** Whether the human approved the request. */
  approved: boolean
  /** Optional free-text notes captured alongside the decision. */
  notes?: string
}

/**
 * Strategy for obtaining a human's approve/reject decision.
 *
 * The channel-delivery seam for `approve`. Tests pass a stub; real deployments
 * wire this to the channel adapter's inbound decision response. Resolver
 * failure (a thrown error or a timeout) triggers escalation.
 */
export type PersonApproveResolver = (ctx: PersonApproveContext) => Promise<PersonApproveDecision>

/**
 * Context handed to a `PersonNotifyHandler` when a notification is delivered
 * to the human. The handler is OPTIONAL — when omitted, the dispatcher relies
 * solely on the channel adapter for delivery.
 */
export interface PersonNotifyContext {
  /** The created lifecycle item (status='completed' after notify acknowledge). */
  item: LifecycleItem
  /** The notification body. */
  message: string
  /** Priority hint. */
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  /** The Person who owns this Worker. */
  person: Human
}

/**
 * Optional strategy for a Person filler to receive a delivered notification.
 *
 * Notify is fire-and-forget; the lifecycle item is created and immediately
 * resolved with verb='acknowledged'. This handler runs after the channel
 * adapter delivery — useful for in-process subscribers (e.g. an in-app toast
 * queue). It must not throw; throws are logged and swallowed.
 */
export type PersonNotifyHandler = (ctx: PersonNotifyContext) => void | Promise<void>

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
   * How the human's approve/reject decision is obtained. OPTIONAL — when
   * omitted the dispatcher does not implement the `approve` verb, and
   * `digital-workers.approve(personWorker, …)` falls back to channel routing.
   * Tests pass a stub; real deployments wire a channel-inbound resolver.
   */
  approveResolver?: PersonApproveResolver
  /**
   * Whether rejection (a resolver returning `{ approved: false }`) escalates
   * the lifecycle item. Defaults to `false` — a rejection is a legitimate
   * decision and resolves cleanly with verb='reject'. Set to `true` for
   * approval flows that must escalate any rejection (per ApprovalOptions
   * `escalate`). Resolver THROWS always escalate, regardless of this flag.
   */
  escalateOnReject?: boolean
  /**
   * Optional handler invoked when a notification is delivered. The lifecycle
   * item is created with kind='notify' and immediately resolved
   * (verb='acknowledged'); this handler runs after channel-adapter delivery
   * and after the resolution. Useful for in-process subscribers. Errors
   * thrown here are logged and swallowed (notify is fire-and-forget).
   */
  notifyHandler?: PersonNotifyHandler
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

  const dispatcher: WorkerDispatcher = {
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

  // `approve` is only attached when the adapter was given an approveResolver.
  // Without it `digital-workers.approve` falls back to channel routing.
  if (options.approveResolver) {
    dispatcher.approve = async (input: WorkerApproveInput): Promise<WorkerApproveOutput> => {
      const now = new Date()
      const escalateOnReject = options.escalateOnReject ?? false
      const artifact: ArtifactRef = {
        kind: 'ApprovalRequest',
        id: `ar_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
        title: input.request,
        ...(input.context !== undefined && { context: input.context }),
      }

      const item: LifecycleItem = {
        id: `hf_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
        kind: 'approve',
        status: 'pending',
        priority,
        title: input.request,
        artifact,
        assignee,
        createdAt: now,
        slaDeadline: new Date(now.getTime() + (input.timeout ?? slaMs)),
        updatedAt: now,
      }

      // 1. Persist the pending approval Function.
      const created = await store.create(item)

      // 2. Deliver to the human via the configured channel (best-effort).
      if (options.channelAdapter) {
        try {
          await options.channelAdapter.deliver(created, store)
        } catch (err) {
          console.warn(`[human-in-the-loop] channel delivery failed for ${created.id}:`, err)
        }
      }

      // 3. Claim and move to in_progress (matches the ask lifecycle walk).
      let current = await store.update(created.id, {
        status: 'claimed',
        claimedBy: assignee,
        claimedAt: new Date(),
      })
      current = await store.update(current.id, { status: 'in_progress' })

      // 4. Obtain the human's decision (the channel-inbound seam). Throws
      //    always escalate, surfacing the error.
      let decision: PersonApproveDecision
      try {
        decision = await options.approveResolver!({
          item: current,
          request: input.request,
          person,
        })
      } catch (err) {
        await store.escalate(current.id, assignee)
        throw err
      }

      // 5. Apply the decision. A rejection optionally escalates (when the
      //    adapter was constructed with escalateOnReject OR the caller passed
      //    `escalate: true` on this call). Otherwise resolve cleanly.
      const shouldEscalate = !decision.approved && (escalateOnReject || input.escalate === true)
      if (shouldEscalate) {
        await store.escalate(current.id, assignee)
      } else {
        await store.complete(current.id, {
          verb: decision.approved ? 'approve' : 'reject',
          resolvedBy: assignee,
          ...(decision.notes !== undefined && { comments: decision.notes }),
          data: { approved: decision.approved },
        })
      }

      return {
        approved: decision.approved,
        ...(decision.notes !== undefined && { notes: decision.notes }),
        approvedBy: { id, type: 'human', name },
      }
    }
  }

  // `notify` is always attached for a Person filler — humans always have a
  // reasonable notification semantic (deliver via channel adapter, log a
  // lifecycle item). `digital-workers.notify` still adds delivery metadata
  // around this.
  dispatcher.notify = async (input: WorkerNotifyInput): Promise<WorkerNotifyOutput> => {
    const now = new Date()
    const artifact: ArtifactRef = {
      kind: 'Notification',
      id: `nf_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
      title: input.message,
    }

    const item: LifecycleItem = {
      id: `hf_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
      kind: 'notify',
      status: 'pending',
      priority,
      title: input.message,
      artifact,
      assignee,
      createdAt: now,
      slaDeadline: new Date(now.getTime() + slaMs),
      updatedAt: now,
    }

    // 1. Persist the pending notify Function.
    const created = await store.create(item)

    let deliveryFailed = false
    // 2. Deliver via the configured channel (best-effort). Failures do NOT
    //    break the caller's flow but are reflected in the returned `sent`.
    if (options.channelAdapter) {
      try {
        await options.channelAdapter.deliver(created, store)
      } catch (err) {
        deliveryFailed = true
        console.warn(`[human-in-the-loop] channel delivery failed for ${created.id}:`, err)
      }
    }

    // 3. notify is fire-and-forget: claim and resolve immediately with
    //    verb='acknowledged' (the lifecycle still records who received it).
    let current = await store.update(created.id, {
      status: 'claimed',
      claimedBy: assignee,
      claimedAt: new Date(),
    })
    const completed = await store.complete(current.id, {
      verb: 'acknowledged',
      resolvedBy: assignee,
      comments: input.message,
      data: {
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.metadata !== undefined && { metadata: input.metadata }),
      },
    })

    // 4. Optional in-process subscriber hook (swallow errors — fire-and-forget).
    if (options.notifyHandler) {
      try {
        await options.notifyHandler({
          item: completed,
          message: input.message,
          ...(input.priority !== undefined && { priority: input.priority }),
          person,
        })
      } catch (err) {
        console.warn(`[human-in-the-loop] notifyHandler threw for ${completed.id}:`, err)
      }
    }

    return {
      sent: !deliveryFailed,
      ...(deliveryFailed && {
        notes: 'channel adapter delivery failed — lifecycle item still recorded',
      }),
    }
  }

  return dispatcher
}
