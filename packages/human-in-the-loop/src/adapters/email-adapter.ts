/**
 * email-adapter — stub email ChannelAdapter for Human Function delivery.
 *
 * This is a no-op stub with the correct LifecycleChannelAdapter interface.
 * The real email adapter (which sends transactional email via SES/Resend/etc.)
 * is implemented in the consuming application.
 *
 * The stub:
 *   - `deliver()` logs the item to console (no actual email sent)
 *   - `respond()` routes the response through the store (no channel-specific parsing)
 *
 * To implement a real email adapter, copy this stub and:
 *   1. Replace the `deliver` body with your email provider SDK call.
 *   2. Wire up an inbound webhook handler (e.g. Postmark inbound, Resend
 *      webhook) that parses the reply and calls `emailAdapter.respond(id, res, store)`.
 *
 * @example
 * ```ts
 * import { emailAdapter } from 'human-in-the-loop'
 * import { adapterRegistry } from 'human-in-the-loop'
 *
 * adapterRegistry.register(emailAdapter)
 *
 * // Deliver a Human Function via email
 * await emailAdapter.deliver(item, store)
 *
 * // On reply webhook:
 * await emailAdapter.respond(item.id, { verb: 'approve', resolvedBy: 'person-alex' }, store)
 * ```
 */

import type { LifecycleChannelAdapter } from '../lifecycle-channel-adapter.js'
import type { LifecycleItem } from '../request-lifecycle.js'
import type { LifecycleStore, LifecycleResponse } from '../lifecycle-store.js'

/**
 * Stub email ChannelAdapter.
 *
 * deliver:  logs the Human Function title + assignee to console.
 *           No email is actually sent.
 * respond:  routes the response through store.complete() — real lifecycle
 *           transition enforced (claimed | in_progress → completed).
 */
export const emailAdapter: LifecycleChannelAdapter = {
  kind: 'email' as const,

  async deliver(item: LifecycleItem, _store: LifecycleStore): Promise<void> {
    // STUB: replace with real email delivery (SES, Resend, Postmark, etc.)
    console.log(
      `[email-adapter] STUB deliver — would email "${item.assignee}" about: "${item.title}" (id=${item.id}, kind=${item.kind}, priority=${item.priority})`
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
