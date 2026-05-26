/**
 * slack-adapter — stub Slack ChannelAdapter for Human Function delivery.
 *
 * This is a no-op stub with the correct LifecycleChannelAdapter interface.
 * The real Slack adapter (which posts Block Kit messages and handles
 * interactive component payloads) is implemented in the consuming application.
 *
 * The stub:
 *   - `deliver()` logs the item to console (no actual Slack message sent)
 *   - `respond()` routes the response through the store (no Slack API calls)
 *
 * To implement a real Slack adapter, copy this stub and:
 *   1. Replace the `deliver` body with a Slack Web API `chat.postMessage` call
 *      using Block Kit interactive components (approve/reject buttons, etc.).
 *   2. Wire up a Slack interactive payload handler (POST /slack/actions) that
 *      parses the payload and calls `slackAdapter.respond(id, res, store)`.
 *
 * @example
 * ```ts
 * import { slackAdapter } from 'human-in-the-loop'
 * import { adapterRegistry } from 'human-in-the-loop'
 *
 * adapterRegistry.register(slackAdapter)
 *
 * // Deliver a Human Function via Slack
 * await slackAdapter.deliver(item, store)
 *
 * // In Slack interactive payload handler:
 * await slackAdapter.respond(item.id, { verb: 'approve', resolvedBy: 'person-alex' }, store)
 * ```
 */

import type { LifecycleChannelAdapter } from '../lifecycle-channel-adapter.js'
import type { LifecycleItem } from '../request-lifecycle.js'
import type { LifecycleStore, LifecycleResponse } from '../lifecycle-store.js'

/**
 * Stub Slack ChannelAdapter.
 *
 * deliver:  logs the Human Function title + assignee to console.
 *           No Slack message is actually sent.
 * respond:  routes the response through store.complete() — real lifecycle
 *           transition enforced (claimed | in_progress → completed).
 */
export const slackAdapter: LifecycleChannelAdapter = {
  kind: 'slack' as const,

  async deliver(item: LifecycleItem, _store: LifecycleStore): Promise<void> {
    // STUB: replace with real Slack delivery (Block Kit postMessage, etc.)
    console.log(
      `[slack-adapter] STUB deliver — would message "${item.assignee}" on Slack about: "${item.title}" (id=${item.id}, kind=${item.kind}, priority=${item.priority})`
    )
  },

  async respond(
    id: string,
    response: LifecycleResponse,
    store: LifecycleStore
  ): Promise<LifecycleItem> {
    // Route response through the store lifecycle (enforces state machine)
    return store.complete(id, response)
  },
}
