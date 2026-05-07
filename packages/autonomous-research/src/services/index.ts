/**
 * Catalog barrel — autonomous-research Services.
 *
 * Ships three Services (`literatureReviewSynthesizer`, `experimentProtocolAuthor`,
 * `manuscriptPreSubmissionReviewer`).
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
