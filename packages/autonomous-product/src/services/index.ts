/**
 * Catalog barrel — autonomous-product Services.
 *
 * Ships six Services (`prdAuthor`, `customerFeedbackSynthesizer`,
 * `roadmapTradeoffEvaluator`, `releaseExperimentDesigner`,
 * `featureDeprecationCoordinator`, `jobsToBeDoneClusterer`).
 *
 * Per v3 §12, catalog Services are module-evaluated TypeScript that yield a
 * typed `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `prdAuthor.invoke(input)`.
 *
 * @packageDocumentation
 */

export {
  prdAuthor,
  PrdTriggerInputSchema,
  PrdDocumentOutputSchema,
  type PrdTriggerInput,
  type PrdDocumentOutput,
} from './prd-author.js'

export {
  customerFeedbackSynthesizer,
  FeedbackCycleInputSchema,
  FeedbackThemesOutputSchema,
  type FeedbackCycleInput,
  type FeedbackThemesOutput,
} from './customer-feedback-synthesizer.js'

export {
  roadmapTradeoffEvaluator,
  RoadmapPlanningInputSchema,
  RoadmapDecisionOutputSchema,
  type RoadmapPlanningInput,
  type RoadmapDecisionOutput,
} from './roadmap-tradeoff-evaluator.js'

export {
  releaseExperimentDesigner,
  ExperimentDesignInputSchema,
  ExperimentSpecOutputSchema,
  type ExperimentDesignInput,
  type ExperimentSpecOutput,
} from './release-experiment-designer.js'

export {
  featureDeprecationCoordinator,
  DeprecationCoordinationInputSchema,
  DeprecationRunbookOutputSchema,
  type DeprecationCoordinationInput,
  type DeprecationRunbookOutput,
} from './feature-deprecation-coordinator.js'

export {
  jobsToBeDoneClusterer,
  JobsToBeDoneInputSchema,
  JobsToBeDoneOutputSchema,
  type JobsToBeDoneInput,
  type JobsToBeDoneOutput,
} from './jobs-to-be-done-clusterer.js'
