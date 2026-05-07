/**
 * Catalog barrel — autonomous-research Services.
 *
 * Ships six Services (`literatureReviewSynthesizer`, `experimentProtocolAuthor`,
 * `manuscriptPreSubmissionReviewer`, `grantApplicationAuthor`,
 * `dataAnalysisPlanAuthor`, `peerReviewCoordinator`).
 *
 * Per v3 §12, catalog Services are module-evaluated TypeScript that yield a
 * typed `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `literatureReviewSynthesizer.invoke(input)`.
 *
 * @packageDocumentation
 */

export {
  literatureReviewSynthesizer,
  LiteratureReviewInputSchema,
  LiteratureReviewOutputSchema,
  type LiteratureReviewInput,
  type LiteratureReviewOutput,
} from './literature-review-synthesizer.js'

export {
  experimentProtocolAuthor,
  ExperimentProtocolInputSchema,
  ExperimentProtocolOutputSchema,
  type ExperimentProtocolInput,
  type ExperimentProtocolOutput,
} from './experiment-protocol-author.js'

export {
  manuscriptPreSubmissionReviewer,
  ManuscriptReviewInputSchema,
  ManuscriptReviewOutputSchema,
  type ManuscriptReviewInput,
  type ManuscriptReviewOutput,
} from './manuscript-pre-submission-reviewer.js'

export {
  grantApplicationAuthor,
  GrantApplicationInputSchema,
  GrantApplicationOutputSchema,
  type GrantApplicationInput,
  type GrantApplicationOutput,
} from './grant-application-author.js'

export {
  dataAnalysisPlanAuthor,
  DataAnalysisPlanInputSchema,
  DataAnalysisPlanOutputSchema,
  type DataAnalysisPlanInput,
  type DataAnalysisPlanOutput,
} from './data-analysis-plan-author.js'

export {
  peerReviewCoordinator,
  PeerReviewCoordinatorInputSchema,
  PeerReviewCoordinatorOutputSchema,
  type PeerReviewCoordinatorInput,
  type PeerReviewCoordinatorOutput,
} from './peer-review-coordinator.js'
