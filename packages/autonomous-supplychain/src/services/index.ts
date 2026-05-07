/**
 * Catalog barrel — autonomous-supplychain Services.
 *
 * Ships three Services (`vendorOnboardingRunbook`, `purchaseOrderRouter`,
 * `inventoryReorderPlanner`).
 *
 * Per v3 §12, catalog Services are module-evaluated TypeScript that yield a
 * typed `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `vendorOnboardingRunbook.invoke(input)`.
 *
 * @packageDocumentation
 */

export {
  vendorOnboardingRunbook,
  VendorOnboardingRequestInputSchema,
  VendorOnboardingPacketOutputSchema,
  type VendorOnboardingRequestInput,
  type VendorOnboardingPacketOutput,
} from './vendor-onboarding-runbook.js'

export {
  purchaseOrderRouter,
  PurchaseOrderInputSchema,
  PurchaseOrderRoutingOutputSchema,
  type PurchaseOrderInput,
  type PurchaseOrderRoutingOutput,
} from './purchase-order-router.js'

export {
  inventoryReorderPlanner,
  InventoryReorderCycleInputSchema,
  InventoryReorderPlanOutputSchema,
  type InventoryReorderCycleInput,
  type InventoryReorderPlanOutput,
} from './inventory-reorder-planner.js'
