/**
 * Catalog Services exported from `autonomous-developer-experience`. Per v3
 * §12, catalog Services are module-evaluated TypeScript that yield a typed
 * `ServiceInstance<TIn, TOut>` value, exported as a named binding so consumers
 * get full type inference into `apiDocsWriter.invoke(input)`.
 *
 * @packageDocumentation
 */

export { apiDocsWriter, RepoIntakeSchema, PublishedDocsSchema } from './api-docs-writer.js'
export type { RepoIntake, PublishedDocs } from './api-docs-writer.js'

export {
  changelogGenerator,
  GitRangeInputSchema,
  ChangelogOutputSchema,
} from './changelog-generator.js'
export type { GitRangeInput, ChangelogOutput } from './changelog-generator.js'

export {
  sdkGenerator,
  OpenAPISpecInputSchema,
  PublishedSDKsOutputSchema,
  SdkTargetLanguageSchema,
  SdkRegistrySchema,
} from './sdk-generator.js'
export type {
  OpenAPISpecInput,
  PublishedSDKsOutput,
  SdkTargetLanguage,
  SdkRegistry,
} from './sdk-generator.js'

export {
  migrationGuideWriter,
  VersionPairInputSchema,
  MigrationGuideOutputSchema,
  BreakingChangeSeveritySchema,
} from './migration-guide-writer.js'
export type {
  VersionPairInput,
  MigrationGuideOutput,
  BreakingChangeSeverity,
} from './migration-guide-writer.js'

export {
  tutorialAuthor,
  TutorialLanguageSchema,
  FeatureDocInputSchema,
  PublishedTutorialOutputSchema,
} from './tutorial-author.js'
export type {
  TutorialLanguage,
  FeatureDocInput,
  PublishedTutorialOutput,
} from './tutorial-author.js'

export {
  exampleSuiteBuilder,
  ExampleLanguageSchema,
  ExampleCiStatusSchema,
  RepoExamplesInputSchema,
  PublishedExamplesOutputSchema,
} from './example-suite-builder.js'
export type {
  ExampleLanguage,
  ExampleCiStatus,
  RepoExamplesInput,
  PublishedExamplesOutput,
} from './example-suite-builder.js'

export {
  releaseReadinessChecklist,
  ReleaseCandidatePRSchema,
  ReadinessReportSchema,
} from './release-readiness-checklist.js'
export type { ReleaseCandidatePR, ReadinessReport } from './release-readiness-checklist.js'

export {
  incidentPostmortemAuthor,
  IncidentResolvedInputSchema,
  PostmortemOutputSchema,
} from './incident-postmortem-author.js'
export type { IncidentResolvedInput, PostmortemOutput } from './incident-postmortem-author.js'
