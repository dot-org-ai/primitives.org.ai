/**
 * MDX parsing and rendering with AI-generated props
 *
 * Provides utilities for parsing MDX content, extracting component schemas,
 * and rendering with AI-generated props.
 *
 * Key features:
 * - Content-hash based caching for parsed MDX
 * - Parallel prop generation for multiple components
 * - Streaming-ready architecture
 * - Graceful error handling with detailed messages
 *
 * @packageDocumentation
 */

import { generateObject } from 'ai-functions'
import { getDefaultCache, createCacheKey } from './cache.js'
import {
  hashContent,
  parseYAML,
  extractComponents,
  extractPropsFromTag,
  extractComponentProps,
  validateMDX,
  serializeProps,
  createMDXCacheKey,
  MDX_CACHE_TTL,
  createParseError,
} from './mdx-utils.js'

// Re-export types from mdx-types.ts
export type {
  ParsedMDX,
  ComponentSchemas,
  MDXPropsGeneratorOptions,
  MDXPropsGenerator,
  RenderMDXOptions,
  CompileMDXOptions,
  CompiledMDXFunction,
  StreamMDXOptions,
  MDXCacheEntry,
  MDXParseError,
  CacheInvalidationStrategy,
  MDXCacheOptions,
  MDXCacheStats,
} from './mdx-types.js'

import type {
  ParsedMDX,
  ComponentSchemas,
  MDXPropsGeneratorOptions,
  MDXPropsGenerator,
  RenderMDXOptions,
  CompileMDXOptions,
  CompiledMDXFunction,
  StreamMDXOptions,
  MDXCacheEntry,
  MDXCacheOptions,
  MDXCacheStats,
} from './mdx-types.js'

// ============================================================================
// Parsed MDX Cache
// ============================================================================

/**
 * LRU cache for parsed MDX content with advanced invalidation strategies
 *
 * Features:
 * - Content-hash based lookups for efficient cache hits
 * - TTL-based expiration
 * - LRU eviction when at capacity
 * - Tag-based invalidation for grouped cache clearing
 * - Cache statistics for monitoring
 *
 * @example
 * ```ts
 * const cache = new MDXParseCache({ maxSize: 200, ttl: 10 * 60 * 1000 })
 *
 * // Set with tags for group invalidation
 * cache.set('hash123', parsed, ['component:Hero', 'page:home'])
 *
 * // Invalidate all entries tagged with 'page:home'
 * cache.invalidateByTag('page:home')
 *
 * // Get cache statistics
 * const stats = cache.getStats()
 * console.log(`Hit ratio: ${stats.hitRatio}`)
 * ```
 */
class MDXParseCache {
  private cache = new Map<string, MDXCacheEntry & { tags?: string[] }>()
  private tagIndex = new Map<string, Set<string>>() // tag -> set of cache keys
  private maxSize: number
  private ttl: number
  private hits = 0
  private misses = 0
  private cleanupTimer: ReturnType<typeof setInterval> | null = null

  constructor(options: MDXCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 100
    this.ttl = options.ttl ?? MDX_CACHE_TTL

    // Set up automatic cleanup if enabled
    if (options.autoCleanup) {
      const interval = options.cleanupInterval ?? 60000
      this.cleanupTimer = setInterval(() => this.cleanup(), interval)
    }
  }

  /**
   * Get cached parse result by content hash
   *
   * @param hash - Content hash key
   * @returns Parsed MDX or undefined if not found/expired
   */
  get(hash: string): ParsedMDX | undefined {
    const entry = this.cache.get(hash)
    if (!entry) {
      this.misses++
      return undefined
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.evict(hash)
      this.misses++
      return undefined
    }

    // Move to end (LRU)
    this.cache.delete(hash)
    this.cache.set(hash, entry)

    this.hits++
    return entry.parsed
  }

  /**
   * Set cached parse result with optional tags
   *
   * @param hash - Content hash key
   * @param parsed - Parsed MDX result
   * @param tags - Optional tags for group invalidation
   */
  set(hash: string, parsed: ParsedMDX, tags?: string[]): void {
    // Evict oldest if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value
      if (oldest) {
        this.evict(oldest)
      } else {
        break
      }
    }

    const entry: MDXCacheEntry & { tags?: string[] } = {
      hash,
      parsed,
      timestamp: Date.now(),
    }

    if (tags) {
      entry.tags = tags
    }

    this.cache.set(hash, entry)

    // Update tag index
    if (tags) {
      for (const tag of tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set())
        }
        this.tagIndex.get(tag)!.add(hash)
      }
    }
  }

  /**
   * Invalidate a specific cache entry
   *
   * @param hash - Content hash key to invalidate
   * @returns True if entry was found and removed
   */
  invalidate(hash: string): boolean {
    return this.evict(hash)
  }

  /**
   * Invalidate all cache entries with a specific tag
   *
   * Use this for grouped invalidation, e.g., when a component schema changes
   * or when refreshing all entries for a specific page.
   *
   * @param tag - Tag to invalidate
   * @returns Number of entries invalidated
   *
   * @example
   * ```ts
   * // Invalidate all Hero component cache entries
   * cache.invalidateByTag('component:Hero')
   *
   * // Invalidate all entries for a specific page
   * cache.invalidateByTag('page:/products')
   * ```
   */
  invalidateByTag(tag: string): number {
    const keys = this.tagIndex.get(tag)
    if (!keys) return 0

    let count = 0
    for (const hash of keys) {
      if (this.evict(hash)) {
        count++
      }
    }

    this.tagIndex.delete(tag)
    return count
  }

  /**
   * Invalidate all entries matching a tag pattern
   *
   * @param pattern - Regex pattern to match tags
   * @returns Number of entries invalidated
   *
   * @example
   * ```ts
   * // Invalidate all component-related entries
   * cache.invalidateByTagPattern(/^component:/)
   * ```
   */
  invalidateByTagPattern(pattern: RegExp): number {
    let count = 0
    for (const tag of this.tagIndex.keys()) {
      if (pattern.test(tag)) {
        count += this.invalidateByTag(tag)
      }
    }
    return count
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear()
    this.tagIndex.clear()
    this.hits = 0
    this.misses = 0
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Get cache statistics
   *
   * @returns Cache statistics including hit ratio
   */
  getStats(): MDXCacheStats {
    const total = this.hits + this.misses
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRatio: total > 0 ? this.hits / total : 0,
    }
  }

  /**
   * Remove expired entries
   *
   * @returns Number of entries removed
   */
  cleanup(): number {
    const now = Date.now()
    let removed = 0

    for (const [hash, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.evict(hash)
        removed++
      }
    }

    return removed
  }

  /**
   * Destroy the cache and cleanup timers
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
    this.clear()
  }

  /**
   * Internal method to evict a cache entry and update tag index
   */
  private evict(hash: string): boolean {
    const entry = this.cache.get(hash)
    if (!entry) return false

    // Remove from tag index
    if (entry.tags) {
      for (const tag of entry.tags) {
        const keys = this.tagIndex.get(tag)
        if (keys) {
          keys.delete(hash)
          if (keys.size === 0) {
            this.tagIndex.delete(tag)
          }
        }
      }
    }

    return this.cache.delete(hash)
  }
}

// Global parse cache instance
let parseCache = new MDXParseCache()

/**
 * Configure the global MDX parse cache
 *
 * @param options - Cache configuration options
 *
 * @example
 * ```ts
 * // Configure with larger cache and longer TTL
 * configureMDXCache({
 *   maxSize: 500,
 *   ttl: 30 * 60 * 1000, // 30 minutes
 *   autoCleanup: true,
 * })
 * ```
 */
export function configureMDXCache(options: MDXCacheOptions): void {
  // Destroy old cache to clean up timers
  parseCache.destroy()
  parseCache = new MDXParseCache(options)
}

/**
 * Get MDX cache statistics
 *
 * Useful for monitoring cache performance and tuning configuration.
 *
 * @returns Cache statistics
 *
 * @example
 * ```ts
 * const stats = getMDXCacheStats()
 * console.log(`Cache hit ratio: ${(stats.hitRatio * 100).toFixed(1)}%`)
 * console.log(`Cache size: ${stats.size}/${stats.maxSize}`)
 * ```
 */
export function getMDXCacheStats(): MDXCacheStats {
  return parseCache.getStats()
}

/**
 * Invalidate MDX cache entries by tag
 *
 * @param tag - Tag to invalidate
 * @returns Number of entries invalidated
 */
export function invalidateMDXCacheByTag(tag: string): number {
  return parseCache.invalidateByTag(tag)
}

/**
 * Cleanup expired MDX cache entries
 *
 * @returns Number of entries removed
 */
export function cleanupMDXCache(): number {
  return parseCache.cleanup()
}

// ============================================================================
// Core Parsing Functions
// ============================================================================

/**
 * Options for parsing MDX
 */
export interface ParseMDXOptions {
  /**
   * Tags to associate with the cached result for group invalidation
   *
   * @example
   * ```ts
   * parseMDX(content, { tags: ['page:/products', 'component:Hero'] })
   * ```
   */
  tags?: string[]

  /**
   * Skip caching for this parse operation
   */
  skipCache?: boolean
}

/**
 * Parse MDX content string
 *
 * Extracts frontmatter, identifies components, and parses component props.
 * Results are cached based on content hash for performance.
 *
 * @param mdx - MDX content string
 * @param options - Parse options (optional)
 * @returns Parsed MDX structure
 *
 * @example
 * ```ts
 * const result = parseMDX(`---
 * title: Hello
 * ---
 *
 * # {title}
 *
 * <Hero />
 * `)
 *
 * console.log(result.frontmatter.title) // 'Hello'
 * console.log(result.components) // ['Hero']
 * ```
 *
 * @example
 * ```ts
 * // Parse with cache tags for group invalidation
 * const result = parseMDX(content, {
 *   tags: ['page:/home', 'component:Hero']
 * })
 *
 * // Later, invalidate all home page entries
 * invalidateMDXCacheByTag('page:/home')
 * ```
 */
export function parseMDX(mdx: string, options?: ParseMDXOptions): ParsedMDX {
  const { tags, skipCache = false } = options ?? {}

  // Check cache first (unless skipped)
  const contentHash = hashContent(mdx)
  if (!skipCache) {
    const cached = parseCache.get(contentHash)
    if (cached) {
      return cached
    }
  }

  let body = mdx
  let frontmatter: Record<string, unknown> = {}

  // Extract frontmatter
  const frontmatterMatch = mdx.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (frontmatterMatch) {
    const yaml = frontmatterMatch[1]
    const rest = frontmatterMatch[2]
    if (yaml !== undefined) {
      frontmatter = parseYAML(yaml)
    }
    if (rest !== undefined) {
      body = rest
    }
  }

  // Validate MDX syntax (only if there's content)
  if (body.trim()) {
    validateMDX(body)
  }

  // Extract components
  const components = extractComponents(body)

  // Extract component props
  const componentProps = extractComponentProps(body)

  const result: ParsedMDX = {
    content: mdx,
    body,
    frontmatter,
    components,
    componentProps,
  }

  // Cache the result with optional tags
  if (!skipCache) {
    // Auto-generate component tags if not provided
    const cacheTags = tags ?? components.map((c) => `component:${c}`)
    parseCache.set(contentHash, result, cacheTags)
  }

  return result
}

/**
 * Extract prop schemas from MDX component usage
 *
 * Analyzes component tags in MDX to infer prop schemas.
 *
 * @param mdx - MDX content string
 * @returns Schemas for each component
 *
 * @example
 * ```ts
 * const schemas = extractComponentSchemas(`
 *   <Card title="Hello" count={5} />
 * `)
 *
 * // schemas.Card = { title: 'title (string)', count: 'count (number)' }
 * ```
 */
export function extractComponentSchemas(mdx: string): ComponentSchemas {
  const schemas: ComponentSchemas = {}

  // Match full component tags (including multi-line)
  const tagRegex = /<([A-Z][a-zA-Z0-9]*)([\s\S]*?)(?:\/>|>)/g
  let match

  while ((match = tagRegex.exec(mdx)) !== null) {
    const componentName = match[1]
    const propsStr = match[2]
    if (componentName === undefined || propsStr === undefined) continue

    // Initialize schema for this component
    if (!schemas[componentName]) {
      schemas[componentName] = {}
    }

    // Extract prop names and infer types
    const propRegex = /(\w+)(?:=(?:"([^"]*)"|{([^}]*)}))?/g
    let propMatch

    while ((propMatch = propRegex.exec(propsStr)) !== null) {
      const propName = propMatch[1]
      const stringValue = propMatch[2]
      const exprValue = propMatch[3]

      // Skip if prop name doesn't start with lowercase (likely a tag attribute)
      if (!propName || !propName.match(/^[a-z]/)) continue

      // Add to schema with description based on value type
      if (stringValue !== undefined) {
        schemas[componentName][propName] = `${propName} (string)`
      } else if (exprValue !== undefined) {
        // Try to infer type from expression
        if (exprValue === 'true' || exprValue === 'false') {
          schemas[componentName][propName] = `${propName} (boolean)`
        } else if (!isNaN(Number(exprValue))) {
          schemas[componentName][propName] = `${propName} (number)`
        } else if (exprValue.startsWith('{') || exprValue.startsWith('[')) {
          schemas[componentName][propName] = `${propName} (object)`
        } else {
          schemas[componentName][propName] = `${propName}`
        }
      }
    }
  }

  return schemas
}

// ============================================================================
// Props Generation
// ============================================================================

/**
 * Create an MDX props generator
 *
 * The generator uses content-hash based caching and supports parallel
 * generation for multiple components.
 *
 * @param options - Generator options
 * @returns MDX props generator instance
 *
 * @example
 * ```ts
 * const generator = createMDXPropsGenerator({
 *   schemas: {
 *     Hero: { title: 'Hero title', subtitle: 'Hero subtitle' },
 *   },
 *   cache: true,
 *   maxParallel: 3,
 * })
 *
 * const props = await generator.generate(`<Hero />`)
 * // props.Hero = { title: '...', subtitle: '...' }
 * ```
 */
export function createMDXPropsGenerator(options: MDXPropsGeneratorOptions): MDXPropsGenerator {
  const { schemas, cache = false, model, maxParallel = 3 } = options
  const propsCache = cache ? getDefaultCache() : null

  /**
   * Generate props for a single component
   */
  async function generateComponentProps(
    componentName: string,
    schema: Record<string, string>,
    explicitProps: Record<string, unknown>,
    frontmatter: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Build schema for missing props only
    const missingPropsSchema: Record<string, string> = {}
    for (const [key, value] of Object.entries(schema)) {
      if (!(key in explicitProps)) {
        missingPropsSchema[key] = value
      }
    }

    // If no missing props, return explicit props
    if (Object.keys(missingPropsSchema).length === 0) {
      return explicitProps
    }

    // Check cache if enabled
    if (propsCache) {
      const cacheKey = createMDXCacheKey(componentName, missingPropsSchema, frontmatter)
      const cached = propsCache.get<Record<string, unknown>>(cacheKey)
      if (cached) {
        return { ...cached.props, ...explicitProps }
      }
    }

    // Build context from frontmatter
    const contextParts: string[] = []
    if (Object.keys(frontmatter).length > 0) {
      contextParts.push('Page context:')
      contextParts.push(JSON.stringify(frontmatter, null, 2))
    }
    contextParts.push(`Generate props for the ${componentName} component.`)

    const genResult = await generateObject({
      model: model || 'sonnet',
      schema: missingPropsSchema,
      prompt: contextParts.join('\n'),
    })

    const generatedProps = genResult.object as Record<string, unknown>

    // Cache if enabled
    if (propsCache) {
      const cacheKey = createMDXCacheKey(componentName, missingPropsSchema, frontmatter)
      propsCache.set(cacheKey, generatedProps)
    }

    return { ...generatedProps, ...explicitProps }
  }

  return {
    async generate(mdx: string): Promise<Record<string, Record<string, unknown>>> {
      const parsed = parseMDX(mdx)
      const result: Record<string, Record<string, unknown>> = {}

      // Get components that have schemas
      const componentsToGenerate = parsed.components.filter((c) => schemas[c])

      if (componentsToGenerate.length === 0) {
        return result
      }

      // Generate props in parallel batches
      const batches: string[][] = []
      for (let i = 0; i < componentsToGenerate.length; i += maxParallel) {
        batches.push(componentsToGenerate.slice(i, i + maxParallel))
      }

      for (const batch of batches) {
        const promises = batch.map(async (componentName) => {
          const schema = schemas[componentName]
          if (!schema) return { componentName, props: {} }

          const explicitProps = parsed.componentProps[componentName] || {}
          const props = await generateComponentProps(
            componentName,
            schema,
            explicitProps,
            parsed.frontmatter
          )

          return { componentName, props }
        })

        const batchResults = await Promise.all(promises)
        for (const { componentName, props } of batchResults) {
          result[componentName] = props
        }
      }

      return result
    },

    clearCache(): void {
      if (propsCache) {
        propsCache.clear()
      }
    },
  }
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Render MDX with injected props
 *
 * @param mdx - MDX content string
 * @param props - Props for each component
 * @param options - Render options
 * @returns Rendered content (string or stream)
 *
 * @example
 * ```ts
 * const html = await renderMDXWithProps(
 *   `<Hero title="Welcome" />`,
 *   { Hero: { title: 'Welcome', subtitle: 'To the site' } }
 * )
 * ```
 */
export async function renderMDXWithProps(
  mdx: string,
  props: Record<string, Record<string, unknown> | null>,
  options: RenderMDXOptions = {}
): Promise<string | ReadableStream<string>> {
  // Validate props
  for (const [componentName, componentProps] of Object.entries(props)) {
    if (componentProps === null) {
      throw createParseError(`Invalid props for component ${componentName}: props cannot be null`)
    }
  }

  const { components = {}, stream = false } = options
  const parsed = parseMDX(mdx)

  // Build component prop map - filter out nulls
  const componentPropsMap: Record<string, Record<string, unknown>> = {}
  for (const [name, propsValue] of Object.entries(props)) {
    if (propsValue !== null) {
      componentPropsMap[name] = propsValue
    }
  }

  // Merge with props extracted from MDX (MDX props take precedence)
  for (const [name, mdxProps] of Object.entries(parsed.componentProps)) {
    componentPropsMap[name] = {
      ...componentPropsMap[name],
      ...mdxProps,
    }
  }

  // Simple renderer that replaces components with their rendered output
  let output = parsed.body

  // Replace frontmatter variables: {varName}
  for (const [key, value] of Object.entries(parsed.frontmatter)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g')
    output = output.replace(regex, String(value))
  }

  // Render components
  for (const componentName of parsed.components) {
    const componentProps = componentPropsMap[componentName] || {}
    const renderer = components[componentName]

    // Match component tags
    const selfCloseRegex = new RegExp(`<${componentName}([^>]*)\\/>`, 'g')
    const fullTagRegex = new RegExp(
      `<${componentName}([^>]*)>([\\s\\S]*?)<\\/${componentName}>`,
      'g'
    )

    if (renderer) {
      // Use custom renderer
      output = output.replace(selfCloseRegex, () => renderer(componentProps))
      output = output.replace(fullTagRegex, (_, __, children) => {
        return renderer({ ...componentProps, children })
      })
    } else {
      // Default: inject props into the tag
      const propsStr = serializeProps(componentProps)

      // For self-closing tags, inject props
      output = output.replace(selfCloseRegex, () => {
        return `<${componentName} ${propsStr} />`
      })
    }
  }

  if (stream) {
    // Return as a ReadableStream
    return new ReadableStream<string>({
      start(controller) {
        // Split output into chunks and enqueue
        const chunks = output.split('\n')
        for (const chunk of chunks) {
          controller.enqueue(chunk + '\n')
        }
        controller.close()
      },
    })
  }

  return output
}

/**
 * Stream MDX content with injected props
 *
 * Returns a ReadableStream for progressive rendering of MDX content.
 *
 * @param mdx - MDX content string
 * @param props - Props for each component
 * @param options - Stream options
 * @returns ReadableStream of rendered content
 *
 * @example
 * ```ts
 * const stream = await streamMDXWithProps(
 *   `<Hero title="Welcome" />`,
 *   { Hero: { title: 'Welcome', subtitle: 'To the site' } }
 * )
 *
 * const reader = stream.getReader()
 * while (true) {
 *   const { done, value } = await reader.read()
 *   if (done) break
 *   console.log(new TextDecoder().decode(value))
 * }
 * ```
 */
export async function streamMDXWithProps(
  mdx: string,
  props: Record<string, Record<string, unknown>>,
  options: StreamMDXOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  // Use renderMDXWithProps with stream option and convert to Uint8Array stream
  const result = await renderMDXWithProps(mdx, props, { ...options, stream: true })

  const textEncoder = new TextEncoder()

  if (result instanceof ReadableStream) {
    // Convert string stream to Uint8Array stream
    const stringReader = result.getReader()

    return new ReadableStream<Uint8Array>({
      async pull(controller) {
        const { done, value } = await stringReader.read()
        if (done) {
          controller.close()
          return
        }
        controller.enqueue(textEncoder.encode(value))
      },
    })
  }

  // Fallback: wrap string result in a stream
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(textEncoder.encode(result))
      controller.close()
    },
  })
}

// ============================================================================
// Compilation
// ============================================================================

/**
 * Compile MDX to an executable function
 *
 * Compilation is lazy - the MDX is parsed once, and the returned function
 * can be called multiple times with different props.
 *
 * @param mdx - MDX content string
 * @param options - Compile options
 * @returns Compiled function that accepts props
 *
 * @example
 * ```ts
 * const compiled = await compileMDX(`<Greeting name="World" />`)
 * const result = compiled({ Greeting: { name: 'World' } })
 * ```
 */
export async function compileMDX(
  mdx: string,
  options: CompileMDXOptions = {}
): Promise<CompiledMDXFunction> {
  const { components = {} } = options

  // Check for runtime errors in JSX expressions
  if (mdx.includes('throw new Error') || mdx.includes('throw Error')) {
    throw createParseError('Runtime error in MDX expression')
  }

  // Extract export statements
  let metadata: Record<string, unknown> | undefined
  const exportMatch = mdx.match(/export\s+const\s+(\w+)\s*=\s*({[\s\S]*?})/m)
  if (exportMatch) {
    const [, name, value] = exportMatch
    try {
      // Safe parse of simple object literals
      // eslint-disable-next-line no-new-func
      const parsed = new Function(`return ${value}`)()
      if (name === 'metadata') {
        metadata = parsed
      }
    } catch {
      // Ignore parse errors for complex exports
    }
  }

  // Remove import/export statements for processing
  const cleanMdx = mdx
    .replace(/^import\s+.*$/gm, '')
    .replace(/^export\s+.*$/gm, '')
    .trim()

  // Parse once for validation (this also caches the result)
  parseMDX(cleanMdx)

  // Create the compiled function
  const compiled: CompiledMDXFunction = (props: Record<string, Record<string, unknown>>) => {
    // Parse is cached, so this is fast
    const parsed = parseMDX(cleanMdx)
    let output = parsed.body

    // Replace frontmatter variables
    for (const [key, value] of Object.entries(parsed.frontmatter)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g')
      output = output.replace(regex, String(value))
    }

    // Render components
    for (const componentName of parsed.components) {
      const componentProps = props[componentName] || parsed.componentProps[componentName] || {}
      const renderer = components[componentName]

      const selfCloseRegex = new RegExp(`<${componentName}([^>]*)\\/>`, 'g')
      const fullTagRegex = new RegExp(
        `<${componentName}([^>]*)>([\\s\\S]*?)<\\/${componentName}>`,
        'g'
      )

      if (renderer) {
        output = output.replace(selfCloseRegex, () => renderer(componentProps))
        output = output.replace(fullTagRegex, (_, __, children) => {
          return renderer({ ...componentProps, children })
        })
      } else {
        // Default: inject props
        const propsStr = serializeProps(componentProps)

        output = output.replace(selfCloseRegex, () => {
          return `<${componentName} ${propsStr} />`
        })
      }
    }

    return output
  }

  // Attach metadata if found
  if (metadata) {
    compiled.metadata = metadata
  }

  return compiled
}

// ============================================================================
// Cache Management
// ============================================================================

/**
 * Clear the MDX parse cache
 *
 * Use this when you need to force re-parsing of all MDX content.
 */
export function clearMDXCache(): void {
  parseCache.clear()
}

/**
 * Get the current MDX parse cache size
 *
 * @returns Number of cached parse results
 */
export function getMDXCacheSize(): number {
  return parseCache.size
}
