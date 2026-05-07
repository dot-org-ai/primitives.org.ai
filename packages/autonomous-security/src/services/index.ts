/**
 * Catalog barrel — autonomous-security Services.
 *
 * Ships three Services (`vulnTriager`, `accessReviewCoordinator`,
 * `phishingSimulationOrchestrator`).
 *
 * Per v3 §12, catalog Services are module-evaluated TypeScript that yield a
 * typed `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `vulnTriager.invoke(input)`.
 *
 * @packageDocumentation
 */

export {
  vulnTriager,
  VulnTriggerInputSchema,
  VulnTriageOutputSchema,
  type VulnTriggerInput,
  type VulnTriageOutput,
} from './vuln-triager.js'

export {
  accessReviewCoordinator,
  AccessReviewInputSchema,
  AccessReviewOutputSchema,
  type AccessReviewInput,
  type AccessReviewOutput,
} from './access-review-coordinator.js'

export {
  phishingSimulationOrchestrator,
  PhishingSimulationInputSchema,
  PhishingSimulationOutputSchema,
  type PhishingSimulationInput,
  type PhishingSimulationOutput,
} from './phishing-simulation-orchestrator.js'
