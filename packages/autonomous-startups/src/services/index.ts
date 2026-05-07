/**
 * autonomous-startups catalog — barrel export.
 *
 * Re-exports the concrete `ServiceInstance` values that ship in this catalog.
 * Subpath imports are the canonical entry point (e.g.
 * `import { claudeCodeFeatureBuild } from 'autonomous-startups/claude-code-feature-build'`)
 * — this index is the convenience aggregate.
 */

export {
  claudeCodeFeatureBuild,
  FeatureBuildInput,
  FeatureBuildOutput,
  ReviewerApprovalsSchema,
} from './claude-code-feature-build.js'

// Re-export the inferred types as well; TS handles the value/type
// declaration-space split automatically.
export type { FeatureBuildInput as FeatureBuildInputType } from './claude-code-feature-build.js'
export type { FeatureBuildOutput as FeatureBuildOutputType } from './claude-code-feature-build.js'

export {
  wedgeHypothesisGenerator,
  WedgeHypothesisInputSchema,
  WedgeHypothesisOutputSchema,
} from './wedge-hypothesis-generator.js'
export type { WedgeHypothesisInput, WedgeHypothesisOutput } from './wedge-hypothesis-generator.js'

export {
  competitorUncopyabilityProber,
  CompetitorUncopyabilityInputSchema,
  CompetitorUncopyabilityOutputSchema,
} from './competitor-uncopyability-prober.js'
export type {
  CompetitorUncopyabilityInput,
  CompetitorUncopyabilityOutput,
} from './competitor-uncopyability-prober.js'

export {
  runtimeUnitEmitter,
  RuntimeUnitInputSchema,
  RuntimeUnitOutputSchema,
} from './runtime-unit-emitter.js'
export type { RuntimeUnitInput, RuntimeUnitOutput } from './runtime-unit-emitter.js'
