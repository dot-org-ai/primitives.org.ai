/**
 * Type definitions for ai-props
 *
 * @packageDocumentation
 */

import type { SimpleSchema } from 'ai-functions'

/**
 * Configuration for AI prop generation
 */
export interface AIPropsConfig {
  /** Model to use for generation (default: 'sonnet') */
  model?: string
  /** System prompt for generation context */
  system?: string
  /** Whether to cache generated props */
  cache?: boolean
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTTL?: number
  /** Custom generation function */
  generate?: <T>(schema: SimpleSchema, context: Record<string, unknown>) => Promise<T>
}

/**
 * Schema definition for component props
 * Can be a SimpleSchema or a named type string
 */
export type PropSchema = SimpleSchema | string

/**
 * Options for prop generation
 */
export interface GeneratePropsOptions {
  /** Schema defining the props to generate */
  schema: PropSchema
  /** Partial props to use as context */
  context?: Record<string, unknown>
  /** Additional prompt context */
  prompt?: string
  /** Model to use */
  model?: string
  /** System prompt */
  system?: string
}

/**
 * Result of prop generation
 */
export interface GeneratePropsResult<T> {
  /** Generated props */
  props: T
  /** Whether props were from cache */
  cached: boolean
  /** Generation metadata */
  metadata?: {
    model: string
    tokens?: number
    duration?: number
  }
}

/**
 * Cache entry for generated props
 */
export interface PropsCacheEntry<T = unknown> {
  props: T
  timestamp: number
  key: string
}

/**
 * Props cache interface
 */
export interface PropsCache {
  get<T>(key: string): PropsCacheEntry<T> | undefined
  set<T>(key: string, props: T): void
  delete(key: string): boolean
  clear(): void
  size: number
}

/**
 * Hook result for useAIProps
 */
export interface UseAIPropsResult<T> {
  /** Generated props (null while loading) */
  props: T | null
  /** Whether generation is in progress */
  loading: boolean
  /** Error if generation failed */
  error: Error | null
  /** Regenerate props */
  regenerate: () => Promise<void>
  /** Whether props were from cache */
  cached: boolean
}

/**
 * Options for useAIProps hook
 */
export interface UseAIPropsOptions<T> extends Omit<GeneratePropsOptions, 'context'> {
  /** Partial props to merge and use as context */
  partialProps?: Partial<T>
  /** Skip generation if all required props are provided */
  skipIfComplete?: boolean
  /** Dependencies that trigger regeneration */
  deps?: unknown[]
}

/**
 * Component wrapper options for AI()
 */
export interface AIComponentOptions<P> {
  /** Schema for the component props */
  schema: PropSchema
  /** Default props */
  defaults?: Partial<P>
  /** Props that are always required (never generated) */
  required?: (keyof P)[]
  /** Props to exclude from generation */
  exclude?: (keyof P)[]
  /** AI generation config */
  config?: AIPropsConfig
}

/**
 * Enhanced component type with AI capabilities
 */
export interface AIComponent<P> {
  (props: Partial<P>): Promise<P>
  /** Original schema */
  schema: PropSchema
  /** Generate props without rendering */
  generateProps: (context?: Partial<P>) => Promise<P>
  /** Configuration */
  config: AIPropsConfig
}

/**
 * Type helper to extract props type from a schema
 */
export type InferProps<S extends PropSchema> = S extends SimpleSchema
  ? S extends string
    ? string
    : S extends { [key: string]: SimpleSchema }
    ? { [K in keyof S]: InferProps<S[K]> }
    : unknown
  : unknown

/**
 * Validation result for props
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
}

/**
 * Individual validation error
 */
export interface ValidationError {
  path: string
  message: string
  expected?: string
  received?: unknown
}
