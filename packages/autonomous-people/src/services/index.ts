/**
 * Catalog barrel — autonomous-people Services.
 *
 * Ships three Services (`hiringLoopCoordinator`, `performanceReviewNarrator`,
 * `orgDesignImpactModeler`).
 *
 * Per v3 §12, catalog Services are module-evaluated TypeScript that yield a
 * typed `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `hiringLoopCoordinator.invoke(input)`.
 *
 * @packageDocumentation
 */

export {
  hiringLoopCoordinator,
  LoopTriggerInputSchema,
  LoopScheduleOutputSchema,
  type LoopTriggerInput,
  type LoopScheduleOutput,
} from './hiring-loop-coordinator.js'

export {
  performanceReviewNarrator,
  ReviewCycleInputSchema,
  ReviewPacketOutputSchema,
  type ReviewCycleInput,
  type ReviewPacketOutput,
} from './performance-review-narrator.js'

export {
  orgDesignImpactModeler,
  OrgChangeProposalInputSchema,
  OrgChangeImpactOutputSchema,
  type OrgChangeProposalInput,
  type OrgChangeImpactOutput,
} from './org-design-impact-modeler.js'
