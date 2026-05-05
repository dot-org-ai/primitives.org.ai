/**
 * Tests for the Vercel Chat SDK channel adapter.
 *
 * SVO co-design step 7 (aip-gvh0). Verifies the `ChannelAdapter` port and
 * the Chat SDK default implementation. The `chat` package is mocked through
 * `ChatBotLike` shims so the tests run without a live chat workspace.
 */

import { describe, expect, it, vi } from 'vitest'
import { chatSdkAdapter, defaultChannelAdapter } from '../src/chat-sdk-adapter.js'
import type { ChannelAdapter, Subscription } from '../src/types.js'
import type { Worker } from 'digital-workers'
import type { Task } from 'digital-tasks'

function makeFakeBot() {
  const posts: Array<{ threadId: string; text: string }> = []
  const subscribers: Array<
    (
      thread: { id: string; channelId: string },
      message: { id?: string; text?: string; user?: { id: string } | string }
    ) => Promise<void> | void
  > = []

  const thread = (threadId: string) => ({
    id: threadId,
    channelId: `chan_${threadId}`,
    async post(text: string) {
      posts.push({ threadId, text })
      return { id: `msg_${posts.length}` }
    },
  })

  const bot = {
    thread,
    async openDM(userId: string) {
      return thread(`dm:${userId}`)
    },
    onSubscribedMessage(
      handler: (
        thread: { id: string; channelId: string },
        message: { id?: string; text?: string; user?: { id: string } | string }
      ) => Promise<void> | void
    ) {
      subscribers.push(handler)
    },
    /** Drive a synthetic incoming message through the receive path. */
    async simulateMessage(threadId: string, text: string, userId = 'U_alice') {
      for (const sub of subscribers) {
        await sub(
          { id: threadId, channelId: `chan_${threadId}` },
          { id: 'msg_in', text, user: { id: userId } }
        )
      }
    },
    posts,
    subscribers,
  }
  return bot
}

const baseWorker: Worker = {
  id: 'worker_alice',
  name: 'Alice',
  type: 'human',
  status: 'available',
  contacts: {
    slack: { workspace: 'acme', user: 'U_alice' },
  },
}

const baseTask: Task = {
  id: 'task_1',
  verb: 'review',
  $type: 'Task',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function: { name: 'review', type: 'human' as any } as any,
  title: 'Review deployment v2.0.0',
  body: 'Please approve before 5pm.',
  status: 'pending',
  priority: 'high',
  createdAt: new Date(),
  updatedAt: new Date(),
} as Task

describe('chatSdkAdapter', () => {
  it('reports kind = chat-sdk', () => {
    const adapter = chatSdkAdapter()
    expect(adapter.kind).toBe('chat-sdk')
  })

  it('throws on dispatch when no bot is configured', async () => {
    const adapter = chatSdkAdapter()
    await expect(adapter.dispatch(baseTask, baseWorker)).rejects.toThrow(/requires .*bot/)
  })

  it('opens a DM by default and posts the formatted task body', async () => {
    const bot = makeFakeBot()
    const adapter = chatSdkAdapter({ bot })

    const sub = await adapter.dispatch(baseTask, baseWorker)
    expect(sub.closed).toBe(false)
    expect(bot.posts).toHaveLength(1)
    expect(bot.posts[0]?.threadId).toBe('dm:U_alice')
    expect(bot.posts[0]?.text).toContain('Review deployment v2.0.0')
    expect(bot.posts[0]?.text).toContain('Please approve before 5pm.')
  })

  it('reuses an existing chatThreadId from task.metadata', async () => {
    const bot = makeFakeBot()
    const adapter = chatSdkAdapter({ bot })
    const task: Task = { ...baseTask, metadata: { chatThreadId: 'existing_thread_42' } }

    await adapter.dispatch(task, baseWorker)
    expect(bot.posts[0]?.threadId).toBe('existing_thread_42')
  })

  it('uses options.resolveUserId when provided', async () => {
    const bot = makeFakeBot()
    const adapter = chatSdkAdapter({ bot, resolveUserId: () => 'U_custom' })
    await adapter.dispatch(baseTask, baseWorker)
    expect(bot.posts[0]?.threadId).toBe('dm:U_custom')
  })

  it('throws if no user id can be resolved', async () => {
    const bot = makeFakeBot()
    const adapter = chatSdkAdapter({ bot })
    const worker: Worker = { ...baseWorker, contacts: {} }
    await expect(adapter.dispatch(baseTask, worker)).rejects.toThrow(/cannot resolve user id/)
  })

  it('routes incoming messages through receive() with cause linking back to the dispatched task', async () => {
    const bot = makeFakeBot()
    const adapter = chatSdkAdapter({ bot })
    await adapter.dispatch(baseTask, baseWorker)

    const seen: Array<{ verb: string; cause?: string }> = []
    adapter.receive((action) => {
      seen.push({ verb: action.verb, cause: action.roles?.cause as string | undefined })
    })

    await bot.simulateMessage('dm:U_alice', 'lgtm')
    expect(seen).toHaveLength(1)
    expect(seen[0]?.verb).toBe('replied')
    expect(seen[0]?.cause).toBe('task_1')
  })

  it('receive() returns a working unsubscribe', async () => {
    const bot = makeFakeBot()
    const adapter = chatSdkAdapter({ bot })
    await adapter.dispatch(baseTask, baseWorker)

    const calls: number[] = []
    const sub = adapter.receive(() => calls.push(1))
    sub.unsubscribe()
    expect(sub.closed).toBe(true)
    await bot.simulateMessage('dm:U_alice', 'lgtm')
    expect(calls).toHaveLength(0)
  })

  it('dispatch() subscription unsubscribe is idempotent and posts a cancel notice', async () => {
    const bot = makeFakeBot()
    const adapter = chatSdkAdapter({ bot })
    const sub = await adapter.dispatch(baseTask, baseWorker)
    sub.unsubscribe()
    sub.unsubscribe() // idempotent
    expect(sub.closed).toBe(true)
    // Allow the deferred cancel post promise to settle.
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(bot.posts.some((p) => p.text.includes('cancelled'))).toBe(true)
  })

  it('accepts a lazy bot factory', async () => {
    const bot = makeFakeBot()
    const factory = vi.fn(() => bot)
    const adapter = chatSdkAdapter({ bot: factory })
    await adapter.dispatch(baseTask, baseWorker)
    expect(factory).toHaveBeenCalledTimes(1)
    // Subsequent dispatches reuse the same resolved bot.
    await adapter.dispatch(baseTask, baseWorker)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('formatTask override controls the posted body', async () => {
    const bot = makeFakeBot()
    const adapter = chatSdkAdapter({ bot, formatTask: (t) => `CUSTOM:${t.id}` })
    await adapter.dispatch(baseTask, baseWorker)
    expect(bot.posts[0]?.text).toBe('CUSTOM:task_1')
  })
})

describe('defaultChannelAdapter', () => {
  it('is a ChannelAdapter with kind = chat-sdk', () => {
    const adapter: ChannelAdapter = defaultChannelAdapter
    expect(adapter.kind).toBe('chat-sdk')
    expect(typeof adapter.dispatch).toBe('function')
    expect(typeof adapter.receive).toBe('function')
  })

  it('throws on dispatch until the consuming app configures a bot', async () => {
    await expect(defaultChannelAdapter.dispatch(baseTask, baseWorker)).rejects.toThrow(/bot/)
  })

  it('Subscription shape from receive()', () => {
    const sub: Subscription = defaultChannelAdapter.receive(() => undefined)
    expect(sub.closed).toBe(false)
    sub.unsubscribe()
    expect(sub.closed).toBe(true)
  })
})
