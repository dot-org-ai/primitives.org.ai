/**
 * Type definitions for MDX integration
 *
 * Shared types used across MDX parsing, props generation, and rendering.
 *
 * @packageDocumentation
 */

/**
 * Result of parsing MDX content
 */
export interface ParsedMDX {
  /** Original MDX content */
  content: string
  /** Body content without frontmatter */
  body: string
  /** Parsed frontmatter data */
  frontmatter: Record<string, unknown>
  /** List of component names found in MDX */
  components: string[]
  /** Props extracted from components */
  componentProps: Record<string, Record<string, unknown>>
}

/**
 * Component schema definitions
 * Each component maps to an object schema (key -> description string)
 */
export type ComponentSchemas = Record<string, Record<string, string>>

/**
 * Options for creating an MDX props generator
 */
export interface MDXPropsGeneratorOptions {
  /** Schemas for components */
  schemas: ComponentSchemas
  /** Whether to cache generated props */
  cache?: boolean
  /** Model to use for generation */
  model?: string
  /** Maximum parallel generation requests (default: 3) */
  maxParallel?: number
}

/**
 * MDX props generator instance
 */
export interface MDXPropsGenerator {
  /** Generate props for components in MDX */
  generate: (mdx: string) => Promise<Record<string, Record<string, unknown>>>
  /** Clear the generator's cache */
  clearCache?: () => void
}

/**
 * Options for rendering MDX with props
 */
export interface RenderMDXOptions {
  /** Custom component renderers */
  components?: Record<string, (props: Record<string, unknown>) => string>
  /** Enable streaming render */
  stream?: boolean
}

/**
 * Options for compiling MDX
 */
export interface CompileMDXOptions {
  /** Custom component map */
  components?: Record<string, (props: Record<string, unknown>) => string>
}

/**
 * Compiled MDX function type
 */
export interface CompiledMDXFunction {
  (props: Record<string, Record<string, unknown>>): string
  /** Exported metadata from MDX */
  metadata?: Record<string, unknown>
}

/**
 * Options for streaming MDX rendering
 */
export interface StreamMDXOptions {
  /** Custom component renderers */
  components?: Record<string, (props: Record<string, unknown>) => string>
}

/**
 * Cache entry for parsed MDX
 */
export interface MDXCacheEntry {
  /** Content hash */
  hash: string
  /** Parsed MDX result */
  parsed: ParsedMDX
  /** Timestamp of cache entry */
  timestamp: number
}

/**
 * Cache entry for generated props
 */
export interface PropsCacheEntry {
  /** Cache key */
  key: string
  /** Generated props */
  props: Record<string, unknown>
  /** Timestamp of cache entry */
  timestamp: number
  /** Content hash used for generation */
  contentHash?: string
  /** Tags for invalidation */
  tags?: string[]
}

/**
 * MDX parse error with location information
 */
export interface MDXParseError extends Error {
  /** Line number where error occurred (1-indexed) */
  line?: number
  /** Column number where error occurred (1-indexed) */
  column?: number
  /** The problematic content */
  source?: string
}

/**
 * Cache invalidation strategy type
 */
export type CacheInvalidationStrategy =
  | 'ttl' // Time-based invalidation
  | 'lru' // Least recently used
  | 'tag' // Tag-based invalidation
  | 'manual' // Manual invalidation only

/**
 * Options for MDX cache configuration
 */
export interface MDXCacheOptions {
  /** Maximum cache size (default: 100) */
  maxSize?: number
  /** Time-to-live in milliseconds (default: 5 minutes) */
  ttl?: number
  /** Invalidation strategy (default: 'lru') */
  strategy?: CacheInvalidationStrategy
  /** Enable automatic cleanup interval */
  autoCleanup?: boolean
  /** Cleanup interval in milliseconds (default: 60 seconds) */
  cleanupInterval?: number
}

/**
 * MDX cache statistics
 */
export interface MDXCacheStats {
  /** Number of cache hits */
  hits: number
  /** Number of cache misses */
  misses: number
  /** Current cache size */
  size: number
  /** Maximum cache size */
  maxSize: number
  /** Cache hit ratio */
  hitRatio: number
}
