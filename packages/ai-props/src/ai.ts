/**
 * AI() wrapper for components with intelligent prop generation
 *
 * The AI() function wraps a component definition and automatically
 * generates missing props using AI when the component is rendered.
 *
 * @packageDocumentation
 */

import type { SimpleSchema } from 'ai-functions'
import type { PropSchema, AIComponentOptions, AIComponent, AIPropsConfig } from './types.js'
import { generateProps, mergeWithGenerated } from './generate.js'

/**
 * Create an AI-powered component wrapper
 *
 * The returned function accepts partial props and generates
 * any missing props using AI based on the schema.
 *
 * @example
 * ```ts
 * const UserCard = AI({
 *   schema: {
 *     name: 'Full name of the user',
 *     bio: 'A short biography',
 *     avatar: 'URL to avatar image',
 *   },
 *   defaults: {
 *     avatar: 'https://example.com/default-avatar.png',
 *   },
 * })
 *
 * // Generate all props
 * const props = await UserCard({})
 *
 * // Generate only missing props
 * const props2 = await UserCard({ name: 'John Doe' })
 * ```
 */
export function AI<P extends Record<string, unknown>>(
  options: AIComponentOptions<P>
): AIComponent<P> {
  const { schema, defaults = {}, required = [], exclude = [], config = {} } = options

  // Build filtered schema (exclude specified props)
  const filteredSchema = filterSchema(schema, exclude as string[])

  /**
   * The AI component function
   */
  const aiComponent = async (partialProps: Partial<P>): Promise<P> => {
    // Merge with defaults
    const propsWithDefaults = { ...defaults, ...partialProps }

    // Check if all required props are provided
    const missingRequired = (required as string[]).filter(
      (key) => propsWithDefaults[key as keyof P] === undefined
    )
    if (missingRequired.length > 0) {
      throw new Error(`Missing required props: ${missingRequired.join(', ')}`)
    }

    // Generate missing props
    const fullProps = await mergeWithGenerated<P>(filteredSchema, propsWithDefaults as Partial<P>, {
      ...(config.model !== undefined && { model: config.model }),
      ...(config.system !== undefined && { system: config.system }),
    })

    return fullProps
  }

  // Attach metadata
  aiComponent.schema = schema
  aiComponent.config = config

  // Attach helper method
  aiComponent.generateProps = async (context?: Partial<P>): Promise<P> => {
    return aiComponent(context || {})
  }

  return aiComponent as AIComponent<P>
}

/**
 * Filter schema to exclude certain keys
 */
function filterSchema(schema: PropSchema, exclude: string[]): PropSchema {
  if (typeof schema === 'string') {
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
 * Create a typed AI component with inference
 *
 * @example
 * ```ts
 * const ProductCard = createAIComponent<{
 *   title: string
 *   price: number
 *   description: string
 * }>({
 *   schema: {
 *     title: 'Product title',
 *     price: 'Price in USD (number)',
 *     description: 'Product description',
 *   },
 * })
 * ```
 */
export function createAIComponent<P extends Record<string, unknown>>(
  options: AIComponentOptions<P>
): AIComponent<P> {
  return AI<P>(options)
}

/**
 * Define props schema with type inference
 *
 * @example
 * ```ts
 * const userSchema = definePropsSchema({
 *   name: 'User name',
 *   email: 'Email address',
 *   age: 'Age (number)',
 * })
 * ```
 */
export function definePropsSchema<T extends Record<string, string | SimpleSchema>>(schema: T): T {
  return schema
}

/**
 * Create a component factory for generating multiple instances
 *
 * @example
 * ```ts
 * const factory = createComponentFactory({
 *   schema: { name: 'Product name', price: 'Price (number)' },
 * })
 *
 * const products = await factory.generateMany([
 *   { category: 'electronics' },
 *   { category: 'clothing' },
 *   { category: 'food' },
 * ])
 * ```
 */
export function createComponentFactory<P extends Record<string, unknown>>(
  options: AIComponentOptions<P>
) {
  const component = AI<P>(options)

  return {
    component,
    schema: options.schema,

    /**
     * Generate a single instance
     */
    generate: (context?: Partial<P>) => component(context || {}),

    /**
     * Generate multiple instances
     */
    generateMany: async (contexts: Partial<P>[]): Promise<P[]> => {
      return Promise.all(contexts.map((ctx) => component(ctx)))
    },

    /**
     * Generate with specific overrides
     */
    generateWith: async (context: Partial<P>, overrides: Partial<P>): Promise<P> => {
      const generated = await component(context)
      return { ...generated, ...overrides }
    },
  }
}

/**
 * Compose multiple AI components
 *
 * Creates a component that combines props from multiple schemas.
 *
 * @example
 * ```ts
 * const FullProfile = composeAIComponents({
 *   user: userSchema,
 *   settings: settingsSchema,
 *   preferences: preferencesSchema,
 * })
 *
 * const profile = await FullProfile({
 *   user: { name: 'John' },
 *   settings: {},
 *   preferences: { theme: 'dark' },
 * })
 * ```
 */
export function composeAIComponents<
  T extends Record<string, AIComponentOptions<Record<string, unknown>>>
>(
  components: T
): AIComponent<{
  [K in keyof T]: T[K] extends AIComponentOptions<infer P> ? P : never
}> {
  type ResultProps = {
    [K in keyof T]: T[K] extends AIComponentOptions<infer P> ? P : never
  }

  const aiComponent = async (partialProps: Partial<ResultProps>): Promise<ResultProps> => {
    const results: Record<string, unknown> = {}

    // Generate each component's props
    await Promise.all(
      Object.entries(components).map(async ([key, options]) => {
        const component = AI(options as AIComponentOptions<Record<string, unknown>>)
        const partial = (partialProps as Record<string, unknown>)[key] || {}
        results[key] = await component(partial as Partial<Record<string, unknown>>)
      })
    )

    return results as ResultProps
  }

  // Compose schemas
  const composedSchema: Record<string, unknown> = {}
  for (const [key, options] of Object.entries(components)) {
    composedSchema[key] = options.schema
  }

  aiComponent.schema = composedSchema as PropSchema
  aiComponent.config = {}
  aiComponent.generateProps = (context?: Partial<ResultProps>) => aiComponent(context || {})

  return aiComponent as AIComponent<ResultProps>
}
