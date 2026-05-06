/**
 * AgentIdentity + AgentMerchant — cross-provider identity for the four
 * agentic-commerce gaps Stripe didn't ship at Sessions 2026:
 *   - Agent-as-buyer with delegation (B2A2D, B2A2B)
 *   - Agent-as-merchant (Stripe makes you wire through Connect manually)
 */

export interface AgentIdentity {
  $id: string
  $type: 'AgentIdentity'
  /** Worker the identity is for (Person/Agent/Role); ThingRef shape. */
  workerRef: string
  /**
   * When the agent buys on behalf of someone else (B2A2D, B2A2B).
   * Null when buying for self (B2A or A2A).
   */
  delegatedFor?: string
  /** OAuth / capability scopes the identity carries. */
  scopes: string[]
  /** Per-provider credentials (Stripe Projects keys, Tempo wallet IDs, etc.). */
  providerCreds: Record<string, unknown>
}

export interface AgentMerchant {
  $id: string
  $type: 'AgentMerchant'
  workerRef: string
  /** Account that receives payouts. */
  payoutAccountRef: string
  providerData: Record<string, unknown>
}
