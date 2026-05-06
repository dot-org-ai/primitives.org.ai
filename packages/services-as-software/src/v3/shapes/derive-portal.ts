/**
 * Derive a default {@link PortalShape} from a {@link ServiceInstance}.
 *
 * Per v3 §8, the portal UI defaults to four columns (`state`, `createdAt`,
 * `cost`, `duration`), filterable by all four; receipts are always enabled;
 * dispute flow is enabled only when the Service declares a `refundContract`
 * (otherwise there's no contractual hook to dispute against).
 *
 * @packageDocumentation
 */

import type { ServiceInstance } from '../service.js'
import type {
  InvocationState,
  PortalDisputeFlow,
  PortalFilterableColumn,
  PortalShape,
  PortalSubscriptionView,
} from './types.js'

// ============================================================================
// Internal helpers
// ============================================================================

const DEFAULT_COLUMNS: readonly string[] = ['state', 'createdAt', 'cost', 'duration']
const DEFAULT_FILTERABLE: readonly PortalFilterableColumn[] = ['state', 'date', 'cost', 'duration']

/**
 * Default dispute-flow gating. When the Service declares a
 * {@link RefundContractRef}, the dispute button is openable from the three
 * states where contractual disagreement matters (`DELIVERED`, `ACCEPTED`,
 * `DISPUTED`). With no refund contract, dispute is disabled.
 */
function deriveDisputeFlow(svc: ServiceInstance<unknown, unknown>): PortalDisputeFlow {
  if (!svc.refundContract) {
    return { enabled: false, openableFromStates: [] }
  }
  const openableFromStates: InvocationState[] = ['DELIVERED', 'ACCEPTED', 'DISPUTED']
  return { enabled: true, openableFromStates }
}

/**
 * Derive a subscription view block when (and only when) the Service has
 * subscription-shaped pricing. Carries a small default column set; the
 * Service may override with a richer column list.
 */
function deriveSubscriptionView(
  svc: ServiceInstance<unknown, unknown>
): PortalSubscriptionView | undefined {
  if (svc.pricing?.kind !== 'subscription') return undefined
  return { columns: ['plan', 'amount', 'interval', 'nextRenewal', 'status'] }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Derive a default {@link PortalShape} from `svc`. Pure function.
 */
export function derivePortal(svc: ServiceInstance<unknown, unknown>): PortalShape {
  const subscriptionView = deriveSubscriptionView(svc)
  const shape: PortalShape = {
    invocationHistoryColumns: [...DEFAULT_COLUMNS],
    filterableBy: [...DEFAULT_FILTERABLE],
    receiptsEnabled: true,
    disputeFlow: deriveDisputeFlow(svc),
  }
  if (subscriptionView) shape.subscriptionView = subscriptionView
  return shape
}
