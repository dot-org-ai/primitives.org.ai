/**
 * Catalog barrel — autonomous-people Services.
 *
 * Ships six Services (`hiringLoopCoordinator`, `performanceReviewNarrator`,
 * `orgDesignImpactModeler`, `compensationBandAnalyst`,
 * `candidateExperienceEvaluator`, `talentPipelineQualityMonitor`).
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

export {
  compensationBandAnalyst,
  CompBandTriggerInputSchema,
  OfferRecommendationOutputSchema,
  type CompBandTriggerInput,
  type OfferRecommendationOutput,
} from './compensation-band-analyst.js'

export {
  candidateExperienceEvaluator,
  CandidateFeedbackTriggerInputSchema,
  CandidateFeedbackReportOutputSchema,
  type CandidateFeedbackTriggerInput,
  type CandidateFeedbackReportOutput,
} from './candidate-experience-evaluator.js'

export {
  talentPipelineQualityMonitor,
  PipelineMonitorTriggerInputSchema,
  PipelineHealthReportOutputSchema,
  type PipelineMonitorTriggerInput,
  type PipelineHealthReportOutput,
} from './talent-pipeline-quality-monitor.js'
