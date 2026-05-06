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
