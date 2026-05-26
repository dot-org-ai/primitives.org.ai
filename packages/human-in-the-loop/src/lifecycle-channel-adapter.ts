/**
 * lifecycle-channel-adapter — ChannelAdapter port for Human Function delivery.
 *
 * This module defines the port through which a Human Function (LifecycleItem)
 * is delivered to a human and through which the human's response re-enters
 * the lifecycle.
 *
 * # Port design
 *
 * ## Outbound: deliver(item, store)
 *   Get a pending item in front of the right human on this channel (push
 *   notification, email, Slack message, web queue update, etc.). The item
 *   must already exist in the store with status `pending`.
 *
 * ## Inbound: respond(id, response, store)
 *   Re-enter the human's response into the lifecycle. The adapter calls this
 *   when it receives a response from the human (e.g. user clicks "Approve" in
 *   the Slack modal, or POST arrives at the email reply webhook). The method
 *   calls `store.complete(id, response)` to drive the lifecycle transition
 *   (claimed | in_progress → completed) and returns the updated item.
 *
 * # Why this shape?
 *   - Symmetric: both delivery and response paths flow through the adapter,
 *     making the adapter the single seam between the lifecycle layer and the
 *     channel transport.
 *   - The store is injected at call-time (not constructor-time), so adapters
 *     are stateless and easily shared or mocked.
 *   - `respond()` on the interface is the minimal contract: the adapter
 *     documents how its channel surfaces call it (e.g. "the web adapter's
 *     Server Action calls respond(); the Slack adapter's webhook handler calls
 *     respond()"). Adapters may also expose channel-specific inbound helpers
 *     (e.g. `SlackAdapter.handleWebhook(req, store)` that parses the payload
 *     and calls `respond()`).
 *   - Callers who need to observe responses (e.g. an orchestrator waiting on
 *     a Human Function) poll the store or subscribe to a store-level event
 *     emitter. The adapter does not own the event bus — the store does.
 *
 * # Adapter registry
 *   `LifecycleAdapterRegistry` lets callers register and look up adapters by
 *   `LifecycleChannelKind` (or arbitrary string for custom channels). The web
 *   adapter in management.studio registers itself against this registry at
 *   startup.
 */

import type { LifecycleItem } from './request-lifecycle.js'
import type { LifecycleStore, LifecycleResponse } from './lifecycle-store.js'

// ============================================================================
// Channel kinds
// ============================================================================

/**
 * Well-known channel kinds for Human Function delivery.
 *
 * `web`   — The management.studio queue surface (implemented in that repo).
 * `email` — Email delivery (stub shipped in this package; real impl external).
 * `slack` — Slack delivery (stub shipped in this package; real impl external).
 *
 * Additional channels (e.g. `teams`, `sms`, `mobile`) may be registered as
 * arbitrary strings via the adapter registry without adding to this union.
 */
export type LifecycleChannelKind = 'web' | 'email' | 'slack' | 'teams' | 'sms'

// ============================================================================
// LifecycleChannelAdapter port
// ============================================================================

/**
 * Channel adapter port for Human Function delivery and response.
 *
 * Implement this interface to wire a new delivery surface:
 *   1. `deliver(item, store)` — push the item to the human on this channel.
 *   2. `respond(id, response, store)` — re-enter the human's response into
 *      the lifecycle (drives claimed | in_progress → completed).
 *
 * Adapters are expected to be stateless. All persistence flows through the
 * injected `LifecycleStore`.
 *
 * @example
 * ```ts
 * // In the management.studio web adapter:
 * export const webAdapter: LifecycleChannelAdapter = {
 *   kind: 'web',
 *   async deliver(item, store) {
 *     // Item already in store (created before deliver); web queue auto-shows it.
 *     // Optionally push a real-time notification (Server-Sent Event, etc.)
 *   },
 *   async respond(id, response, store) {
 *     return store.complete(id, response)
 *   },
 * }
 * ```
 */
export interface LifecycleChannelAdapter {
  /** Discriminator — identifies this adapter in a registry. */
  readonly kind: LifecycleChannelKind | string

  /**
   * Deliver a pending Human Function to a human on this channel.
   *
   * The item MUST already exist in the store with status `pending` before
   * `deliver` is called. Implementations push a notification, email, Slack
   * message, etc. to the item's `assignee`.
   *
   * Callers should call `deliver` immediately after `store.create(item)`.
   *
   * @param item  - The LifecycleItem to deliver (status=pending)
   * @param store - The store backing the lifecycle (for any store-reads needed)
   * @returns Promise<void> — fire-and-forget delivery; failures should be logged
   *          rather than throwing, to avoid breaking the caller's flow.
   */
  deliver(item: LifecycleItem, store: LifecycleStore): Promise<void>

  /**
   * Re-enter a human's response into the lifecycle.
   *
   * Called by the channel's inbound handler (webhook, Server Action, CLI,
   * etc.) when a human responds to a delivered item.
   *
   * Implementations call `store.complete(id, response)` (or another store
   * method for rejection/cancellation) to drive the lifecycle transition
   * and persist the result.
   *
   * @param id       - ID of the LifecycleItem being responded to
   * @param response - The human's response (verb, resolvedBy, optional data)
   * @param store    - The store to apply the response against
   * @returns The updated LifecycleItem after the lifecycle transition
   * @throws if the item is not found or the transition is illegal
   */
  respond(id: string, response: LifecycleResponse, store: LifecycleStore): Promise<LifecycleItem>
}

// ============================================================================
// Adapter registry
// ============================================================================

/**
 * Registry for LifecycleChannelAdapters.
 *
 * Allows runtime registration and lookup of adapters by channel kind.
 * The management.studio web adapter registers itself at startup.
 *
 * @example
 * ```ts
 * import { adapterRegistry, emailAdapter } from 'human-in-the-loop'
 *
 * // Register the web adapter (management.studio startup)
 * adapterRegistry.register(webAdapter)
 *
 * // Look up an adapter
 * const adapter = adapterRegistry.get('email') // emailAdapter stub
 *
 * // Deliver an item
 * if (adapter) {
 *   await adapter.deliver(item, store)
 * }
 * ```
 */
export class LifecycleAdapterRegistry {
  private adapters = new Map<string, LifecycleChannelAdapter>()

  /** Register an adapter. Overwrites any existing adapter for the same kind. */
  register(adapter: LifecycleChannelAdapter): void {
    this.adapters.set(adapter.kind, adapter)
  }

  /** Look up an adapter by channel kind. Returns undefined if not registered. */
  get(kind: LifecycleChannelKind | string): LifecycleChannelAdapter | undefined {
    return this.adapters.get(kind)
  }

  /** List all registered channel kinds. */
  kinds(): string[] {
    return Array.from(this.adapters.keys())
  }

  /** Remove an adapter (for testing). */
  unregister(kind: LifecycleChannelKind | string): void {
    this.adapters.delete(kind)
  }
}

/**
 * The default (global) adapter registry.
 *
 * Management.studio registers its `web` adapter against this instance.
 * Consumers can import and use this registry directly, or create their own
 * `LifecycleAdapterRegistry` instance for isolation.
 */
export const adapterRegistry = new LifecycleAdapterRegistry()
