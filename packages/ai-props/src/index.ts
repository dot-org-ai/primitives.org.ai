/**
 * ai-props - AI-powered props for intelligent component properties
 *
 * This package provides utilities for automatically generating
 * component props using AI based on schema definitions.
 *
 * @packageDocumentation
 */

// Export types
export * from './types.js'

// Export core functionality
export {
  AI,
  createAIComponent,
  definePropsSchema,
  createComponentFactory,
  composeAIComponents,
} from './ai.js'

// Export generation functions
export {
  generateProps,
  getPropsSync,
  prefetchProps,
  generatePropsMany,
  mergeWithGenerated,
  configureAIProps,
  getConfig,
  resetConfig,
} from './generate.js'

// Export cache utilities
export {
  MemoryPropsCache,
  LRUPropsCache,
  createCacheKey,
  getDefaultCache,
  configureCache,
  clearCache,
  DEFAULT_CACHE_TTL,
} from './cache.js'

// Export HOC and enhancers
export {
  createPropsEnhancer,
  createAsyncPropsProvider,
  createPropsTransformer,
  createConditionalGenerator,
  createBatchGenerator,
  type WithAIPropsOptions,
} from './hoc.js'

// Export validation utilities
export {
  validateProps,
  hasRequiredProps,
  getMissingProps,
  isComplete,
  getMissingFromSchema,
  sanitizeProps,
  mergeWithDefaults,
  createValidator,
  assertValidProps,
} from './validate.js'

// Export MDX utilities
export {
  parseMDX,
  extractComponentSchemas,
  renderMDXWithProps,
  streamMDXWithProps,
  createMDXPropsGenerator,
  compileMDX,
  clearMDXCache,
  getMDXCacheSize,
  configureMDXCache,
  getMDXCacheStats,
  invalidateMDXCacheByTag,
  cleanupMDXCache,
  type ParsedMDX,
  type ComponentSchemas,
  type MDXPropsGeneratorOptions,
  type MDXPropsGenerator,
  type RenderMDXOptions,
  type StreamMDXOptions,
  type CompileMDXOptions,
  type CompiledMDXFunction,
  type MDXCacheEntry,
  type MDXParseError,
  type CacheInvalidationStrategy,
  type MDXCacheOptions,
  type MDXCacheStats,
  type ParseMDXOptions,
} from './mdx.js'
