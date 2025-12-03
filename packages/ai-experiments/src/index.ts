/**
 * ai-experiments - AI-powered experimentation primitives for testing and evaluating models
 *
 * This package provides tools for A/B testing, parameter exploration, decision making,
 * and tracking in AI applications.
 *
 * @packageDocumentation
 */

// Export core types
export * from './types.js'

// Export experiment functionality
export { Experiment, createVariantsFromGrid } from './experiment.js'

// Export cartesian product utilities
export {
  cartesian,
  cartesianFilter,
  cartesianSample,
  cartesianCount,
  cartesianWithLabels,
} from './cartesian.js'

// Export decision making utilities
export {
  decide,
  decideWeighted,
  decideEpsilonGreedy,
  decideThompsonSampling,
  decideUCB,
} from './decide.js'

// Export tracking utilities
export {
  track,
  flush,
  configureTracking,
  getTrackingConfig,
  createConsoleBackend,
  createMemoryBackend,
  createBatchBackend,
  createFileBackend,
} from './tracking.js'
