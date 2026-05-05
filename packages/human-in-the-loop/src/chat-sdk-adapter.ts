/**
 * Vercel Chat SDK channel adapter.
 *
 * Default `ChannelAdapter` implementation for `human-in-the-loop`. Wraps the
 * `chat` package (https://github.com/vercel/chat — npm: `chat`) which is a
 * unified TypeScript SDK that abstracts Slack, Microsoft Teams, Google Chat,
 * Discord, Telegram, etc. behind a single Thread/Message API. Per-platform
 * adapters (`@chat-adapter/slack`, `@chat-adapter/teams`, etc.) are installed
 * separately by the consuming app — Chat SDK itself is provider-agnostic so
 * the bundle stays small.
 *
 * SVO co-design step 7 (aip-gvh0). See
 * `docs/plans/2026-05-05-svo-co-design.md` § `human-in-the-loop.ChannelAdapter`.
 *
 * ## Dispatch
 *
 * `dispatch(task, worker)` resolves a thread for the worker and posts the
 * Task body to it:
 *
 * 1. If the Task's metadata carries an existing `chatThreadId`, the adapter
 *    re-acquires that thread via `bot.thread(threadId)` and posts there.
 *    This is how follow-up Tasks reach the same surfaced conversation.
 * 2. Otherwise, the adapter resolves the Worker to a chat-sdk recipient by
 *    `worker.contacts.slack.user`, `worker.contacts.teams.user`, or
 *    `worker.contacts.discord.user` and opens a DM via `bot.openDM(userId)`.
 * 3. The Task title and body are formatted as a markdown post; if a `body`
 *    field is absent the post falls back to the Task's `verb` and any
 *    `instruction`/`description` from legacy `HumanRequest`-shaped tasks.
 *
 * The returned `Subscription` cancels the dispatched post on `unsubscribe()`
 * by issuing a follow-up cancellation message in the thread (Chat SDK does
 * not expose a delete-message API uniformly across all adapters; the
 * cancellation is therefore semantic, not destructive).
 *
 * ## Receive
 *
 * `receive(callback)` registers `bot.onSubscribedMessage` so that any
 * message in a thread we previously dispatched into surfaces as an
 * `Action` of verb `'replied'`.
 *
 * The dispatched Task's Action id is carried in `action.roles.cause`
 * (per `digital-objects.Action.roles` from `aip-akqb` — cause is a
 * frame role, not a top-level field). The caller correlates
 * `roles.cause` back to outstanding Tasks to handle the response.
 *
 * Approval-shaped actions (button clicks, slash commands) are handled
 * separately by `bot.onAction` and are not registered through `receive`
 * by default — those should be wired in the consuming app where the
 * specific action ids are known.
 *
 * @packageDocumentation
 */

import type { Worker } from 'digital-workers'
import type { Task } from 'digital-tasks'
import type { Action } from 'digital-objects'
import type { ChannelAdapter, Subscription } from './types.js'

/**
 * Minimal Chat SDK surface we depend on.
 *
 * Mirrored locally so the adapter compiles without `chat`'s types resolving
 * (the package is a hard runtime dep but its `.d.ts` may not be available
 * in a stripped-down install). At runtime callers pass a real `Chat`
 * instance from the `chat` package.
 */
export interface ChatBotLike {
  thread(threadId: string): ChatThreadLike
  openDM(userId: string): Promise<ChatThreadLike>
  onSubscribedMessage(
    handler: (thread: ChatThreadLike, message: ChatMessageLike) => Promise<void> | void
  ): void
}

export interface ChatThreadLike {
  readonly id: string
  readonly channelId: string
  post(message: string): Promise<unknown>
}

export interface ChatMessageLike {
  readonly id?: string
  readonly text?: string
  readonly user?: { id: string; name?: string } | string
}

/**
 * Options for the Chat SDK adapter.
 */
export interface ChatSdkAdapterOptions {
  /**
   * Pre-constructed `Chat` instance from the `chat` package.
   *
   * The adapter does not construct the bot itself because configuration
   * (adapters, state backend, userName) is application-specific. Pass a
   * lazily-resolving function to avoid eager construction.
   */
  bot?: ChatBotLike | (() => ChatBotLike | Promise<ChatBotLike>)

  /**
   * Optional resolver mapping a `Worker` to a chat-sdk user id.
   *
   * Defaults to looking at `worker.contacts.slack.user`,
   * `worker.contacts.teams.user`, then `worker.contacts.discord.user`.
   */
  resolveUserId?: (worker: Worker) => string | undefined

  /**
   * Optional formatter mapping a `Task` to the markdown body posted to
   * the thread. Defaults to `### {title}\n\n{body}` with sensible
   * fallbacks.
   */
  formatTask?: (task: Task) => string
}

/** Default Worker -> chat-sdk user-id resolver. */
function defaultResolveUserId(worker: Worker): string | undefined {
  const contacts = worker.contacts
  if (!contacts) return undefined
  const slack = contacts.slack
  if (typeof slack === 'string') return slack
  if (slack && typeof slack === 'object' && 'user' in slack && slack.user) return slack.user
  const teams = contacts.teams
  if (typeof teams === 'string') return teams
  if (teams && typeof teams === 'object' && 'user' in teams && teams.user) return teams.user
  const discord = contacts.discord
  if (typeof discord === 'string') return discord
  if (discord && typeof discord === 'object' && 'user' in discord && discord.user)
    return discord.user
  return undefined
}

/** Default Task -> markdown formatter. */
function defaultFormatTask(task: Task): string {
  const title = task.title ?? (typeof task.verb === 'string' ? `Task: ${task.verb}` : 'Task')
  const body =
    task.body ??
    (task.metadata?.['description'] as string | undefined) ??
    (task.metadata?.['instruction'] as string | undefined) ??
    ''
  return body ? `### ${title}\n\n${body}` : `### ${title}`
}

/** Stable id generator for synthetic Action records. */
function actionId(): string {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Build a Chat SDK channel adapter.
 *
 * Returns a `ChannelAdapter` with `kind: 'chat-sdk'`. The adapter is
 * stateless beyond the bound `bot` reference and the in-process
 * thread-id -> task-id correlation map populated on `dispatch`.
 */
export function chatSdkAdapter(options: ChatSdkAdapterOptions = {}): ChannelAdapter {
  const resolveUserId = options.resolveUserId ?? defaultResolveUserId
  const formatTask = options.formatTask ?? defaultFormatTask

  /** Threads we have dispatched into → originating Task action id. */
  const threadToTask = new Map<string, string>()
  /** Receive callbacks registered through `receive()`. */
  const listeners = new Set<(response: Action) => void | Promise<void>>()
  /** Resolved bot, lazily memoised. */
  let resolvedBot: ChatBotLike | undefined
  let receiverInstalled = false

  async function getBot(): Promise<ChatBotLike> {
    if (resolvedBot) return resolvedBot
    const source = options.bot
    if (!source) {
      throw new Error(
        '[human-in-the-loop] chatSdkAdapter requires `options.bot` — pass a Chat instance from the `chat` package'
      )
    }
    resolvedBot = typeof source === 'function' ? await source() : source
    return resolvedBot
  }

  async function ensureReceiver(): Promise<void> {
    if (receiverInstalled) return
    const bot = await getBot()
    bot.onSubscribedMessage(async (thread, message) => {
      const causeId = threadToTask.get(thread.id)
      const userId = typeof message.user === 'string' ? message.user : message.user?.id ?? 'unknown'
      // Build the response Action. We follow the SVO co-design naming:
      // `verb='replied'`, `subject` = the responding user, `cause` carried
      // through the response data (since `digital-objects.Action` does not
      // yet have a top-level `cause` field — see plan §Migration order).
      const action: Action = {
        id: actionId(),
        verb: 'replied',
        subject: userId,
        ...(causeId ? { roles: { cause: causeId } } : {}),
        data: {
          text: message.text ?? '',
          threadId: thread.id,
          channelId: thread.channelId,
        },
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date(),
      }
      for (const listener of listeners) {
        try {
          await listener(action)
        } catch (err) {
          // Swallow listener errors to keep the receive loop resilient.
          // Surfaced via console for debugging; production callers should
          // wrap their callbacks in their own error handling.
          // eslint-disable-next-line no-console
          console.error('[human-in-the-loop] chat-sdk receive listener threw:', err)
        }
      }
    })
    receiverInstalled = true
  }

  return {
    kind: 'chat-sdk',

    async dispatch(task: Task, worker: Worker): Promise<Subscription> {
      const bot = await getBot()
      // Make sure incoming-message receiver is installed before we dispatch
      // so we never miss a reply that lands faster than the next dispatch.
      await ensureReceiver()

      const existingThreadId =
        (task.metadata?.['chatThreadId'] as string | undefined) ??
        (task.metadata?.['chatSdkThreadId'] as string | undefined)

      let thread: ChatThreadLike
      if (existingThreadId) {
        thread = bot.thread(existingThreadId)
      } else {
        const userId = resolveUserId(worker)
        if (!userId) {
          throw new Error(
            `[human-in-the-loop] chat-sdk adapter cannot resolve user id for worker ${worker.id} — set worker.contacts.{slack,teams,discord}.user or pass options.resolveUserId`
          )
        }
        thread = await bot.openDM(userId)
      }

      const taskActionId = task.id ?? actionId()
      threadToTask.set(thread.id, taskActionId)

      await thread.post(formatTask(task))

      let closed = false
      return {
        get closed() {
          return closed
        },
        unsubscribe() {
          if (closed) return
          closed = true
          threadToTask.delete(thread.id)
          // Best-effort cancel notice. We deliberately avoid awaiting/throwing
          // here so unsubscribe() stays synchronous per the Subscription
          // contract; failures are logged and otherwise non-fatal.
          void thread.post('_(task cancelled)_').catch((err: unknown) => {
            // eslint-disable-next-line no-console
            console.error('[human-in-the-loop] chat-sdk cancel post failed:', err)
          })
        },
      }
    },

    receive(callback: (response: Action) => void | Promise<void>): Subscription {
      listeners.add(callback)
      // Install the bot listener lazily on first receive() so adapters
      // constructed but never used don't try to wire into the bot.
      void ensureReceiver().catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[human-in-the-loop] chat-sdk receive setup failed:', err)
      })
      let closed = false
      return {
        get closed() {
          return closed
        },
        unsubscribe() {
          if (closed) return
          closed = true
          listeners.delete(callback)
        },
      }
    },
  }
}

/**
 * Default Chat SDK adapter instance.
 *
 * No bot is bound — the consuming app must call `chatSdkAdapter({ bot })`
 * with a configured `Chat` instance for the adapter to function. This
 * default exists so that `import { defaultChannelAdapter } from
 * 'human-in-the-loop'` yields a stable `ChannelAdapter` reference whose
 * `kind` and method shapes are predictable for type-checking and
 * registry lookups; it throws on `dispatch`/`receive` until configured.
 *
 * For real use, prefer:
 *
 * ```ts
 * import { Chat } from 'chat'
 * import { createSlackAdapter } from '@chat-adapter/slack'
 * import { chatSdkAdapter } from 'human-in-the-loop'
 *
 * const bot = new Chat({ userName: 'mybot', adapters: { slack: createSlackAdapter() }, state })
 * const channel = chatSdkAdapter({ bot })
 * ```
 */
export const defaultChannelAdapter: ChannelAdapter = chatSdkAdapter()
