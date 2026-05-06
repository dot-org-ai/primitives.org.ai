/**
 * Catalog barrel — autonomous-operations Services.
 *
 * Ships three Services (`incidentCommander`, `oncallHandoffNarrator`,
 * `capacityPlanner`).
 *
 * Per v3 §12, catalog Services are module-evaluated TypeScript that yield a
 * typed `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `incidentCommander.invoke(input)`.
 *
 * @packageDocumentation
 */

export {
  incidentCommander,
  IncidentTriggerInputSchema,
  IncidentMitigationOutputSchema,
  type IncidentTriggerInput,
  type IncidentMitigationOutput,
} from './incident-commander.js'

export {
  oncallHandoffNarrator,
  HandoffTriggerInputSchema,
  HandoffNarrativeOutputSchema,
  type HandoffTriggerInput,
  type HandoffNarrativeOutput,
} from './oncall-handoff-narrator.js'

export {
  capacityPlanner,
  CapacityReviewInputSchema,
  CapacityPlanOutputSchema,
  type CapacityReviewInput,
  type CapacityPlanOutput,
} from './capacity-planner.js'
