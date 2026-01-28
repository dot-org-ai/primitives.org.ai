/**
 * Higher-Order Component (HOC) for React components
 *
 * Provides withAIProps HOC for wrapping React components
 * with AI-powered prop generation.
 *
 * @packageDocumentation
 */

import type { SimpleSchema } from 'ai-functions'
import type { PropSchema, AIComponentOptions, AIPropsConfig } from './types.js'
import { generateProps, mergeWithGenerated } from './generate.js'

/**
 * Options for withAIProps HOC
 */
export interface WithAIPropsOptions<P> extends Omit<AIComponentOptions<P>, 'schema'> {
  /** Schema for props to generate */
  schema: PropSchema
  /** Loading component to show while generating */
  loading?: () => unknown
  /** Error component to show on generation failure */
  error?: (error: Error) => unknown
  /** Fallback props to use if generation fails */
  fallback?: Partial<P>
}

/**
 * Create props wrapper that can be used with any component system
 *
 * This is framework-agnostic and returns the enhanced props.
 *
 * @example
 * ```ts
 * const enhancer = createPropsEnhancer({
 *   schema: {
 *     title: 'Page title',
 *     description: 'Page description',
 *   },
 *   defaults: {
 *     title: 'Default Title',
 *   },
 * })
 *
 * // Use with any component
 * const props = await enhancer({ description: 'My page' })
 * // { title: 'Default Title', description: 'My page' }
 *
 * const generatedProps = await enhancer({})
 * // { title: 'AI-generated title', description: 'AI-generated description' }
 * ```
 */
export function createPropsEnhancer<P extends Record<string, unknown>>(
  options: WithAIPropsOptions<P>
) {
  const { schema, defaults = {}, required = [], exclude = [], config = {}, fallback } = options

  return async (partialProps: Partial<P>): Promise<P> => {
    try {
      // Merge with defaults
      const propsWithDefaults = { ...defaults, ...partialProps }

      // Check required props
      const missingRequired = (required as string[]).filter(
        (key) => propsWithDefaults[key as keyof P] === undefined
      )
      if (missingRequired.length > 0) {
        throw new Error(`Missing required props: ${missingRequired.join(', ')}`)
      }

      // Filter out excluded props from schema
      const filteredSchema = filterSchemaKeys(schema, exclude as string[])

      // Generate missing props
      return await mergeWithGenerated<P>(filteredSchema, propsWithDefaults as Partial<P>, {
        ...(config.model !== undefined && { model: config.model }),
        ...(config.system !== undefined && { system: config.system }),
      })
    } catch (error) {
      if (fallback) {
        return { ...defaults, ...fallback, ...partialProps } as P
      }
      throw error
    }
  }
}

/**
 * Filter schema to exclude certain keys
 */
function filterSchemaKeys(schema: PropSchema, exclude: string[]): PropSchema {
  if (typeof schema === 'string' || exclude.length === 0) {
    return schema
  }

  const filtered: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(schema)) {
    if (!exclude.includes(key)) {
      filtered[key] = value
    }
  }
  return filtered as SimpleSchema
}

/**
 * Create an async props provider
 *
 * Returns a function that generates props on each call.
 * Useful for SSR and static generation.
 *
 * @example
 * ```ts
 * const getPageProps = createAsyncPropsProvider({
 *   schema: {
 *     title: 'SEO-optimized page title',
 *     meta: { description: 'Meta description' },
 *   },
 * })
 *
 * // In getStaticProps or getServerSideProps
 * export async function getStaticProps() {
 *   const props = await getPageProps({ slug: 'about' })
 *   return { props }
 * }
 * ```
 */
export function createAsyncPropsProvider<P extends Record<string, unknown>>(
  options: WithAIPropsOptions<P>
) {
  const enhancer = createPropsEnhancer(options)

  return {
    /**
     * Get props with AI generation
     */
    getProps: enhancer,

    /**
     * Get props for multiple items
     */
    getManyProps: async (contexts: Partial<P>[]): Promise<P[]> => {
      return Promise.all(contexts.map(enhancer))
    },

    /**
     * Get props with caching hint
     */
    getCachedProps: async (
      context: Partial<P>,
      revalidate?: number
    ): Promise<{ props: P; revalidate?: number }> => {
      const props = await enhancer(context)
      return { props, ...(revalidate !== undefined && { revalidate }) }
    },
  }
}

/**
 * Create a props transformer
 *
 * Transforms existing props by filling in missing values.
 *
 * @example
 * ```ts
 * const transformUserProps = createPropsTransformer({
 *   schema: {
 *     displayName: 'Display name for the user',
 *     initials: 'User initials (2 letters)',
 *   },
 * })
 *
 * const user = await transformUserProps({
 *   username: 'johndoe',
 *   email: 'john@example.com',
 * })
 * // { username: 'johndoe', email: '...', displayName: 'John Doe', initials: 'JD' }
 * ```
 */
export function createPropsTransformer<
  I extends Record<string, unknown>,
  O extends Record<string, unknown>
>(options: {
  schema: PropSchema
  transform?: (input: I, generated: Record<string, unknown>) => O
  config?: AIPropsConfig
}) {
  const { schema, transform, config = {} } = options

  return async (input: I): Promise<I & O> => {
    const result = await generateProps({
      schema,
      context: input,
      ...(config.model !== undefined && { model: config.model }),
      ...(config.system !== undefined && { system: config.system }),
    })

    const generated = result.props as Record<string, unknown>

    if (transform) {
      return { ...input, ...transform(input, generated) }
    }

    return { ...input, ...generated } as I & O
  }
}

/**
 * Create a conditional props generator
 *
 * Only generates props when a condition is met.
 *
 * @example
 * ```ts
 * const maybeGenerateProps = createConditionalGenerator({
 *   schema: { summary: 'Article summary' },
 *   condition: (props) => !props.summary && props.content?.length > 100,
 * })
 * ```
 */
export function createConditionalGenerator<P extends Record<string, unknown>>(options: {
  schema: PropSchema
  condition: (props: Partial<P>) => boolean
  config?: AIPropsConfig
}) {
  const { schema, condition, config = {} } = options

  return async (props: Partial<P>): Promise<P> => {
    if (!condition(props)) {
      return props as P
    }

    return mergeWithGenerated(schema, props, {
      ...(config.model !== undefined && { model: config.model }),
      ...(config.system !== undefined && { system: config.system }),
    })
  }
}

/**
 * Batch props generator for list rendering
 *
 * Efficiently generates props for multiple items.
 *
 * @example
 * ```ts
 * const batchGenerator = createBatchGenerator({
 *   schema: { title: 'Item title', description: 'Item description' },
 * })
 *
 * const items = await batchGenerator.generate([
 *   { id: 1, category: 'tech' },
 *   { id: 2, category: 'science' },
 *   { id: 3, category: 'art' },
 * ])
 * ```
 */
export function createBatchGenerator<P extends Record<string, unknown>>(options: {
  schema: PropSchema
  concurrency?: number
  config?: AIPropsConfig
}) {
  const { schema, concurrency = 3, config = {} } = options

  return {
    /**
     * Generate props for multiple items
     */
    generate: async (items: Partial<P>[]): Promise<P[]> => {
      const results: P[] = []

      // Process in batches based on concurrency
      for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency)
        const batchResults = await Promise.all(
          batch.map((item) =>
            mergeWithGenerated<P>(schema, item, {
              ...(config.model !== undefined && { model: config.model }),
              ...(config.system !== undefined && { system: config.system }),
            })
          )
        )
        results.push(...batchResults)
      }

      return results
    },

    /**
     * Generate props one at a time (for rate limiting)
     */
    generateSequential: async (items: Partial<P>[]): Promise<P[]> => {
      const results: P[] = []

      for (const item of items) {
        const result = await mergeWithGenerated<P>(schema, item, {
          ...(config.model !== undefined && { model: config.model }),
          ...(config.system !== undefined && { system: config.system }),
        })
        results.push(result)
      }

      return results
    },
  }
}
