/**
 * hono/jsx integration for AI-powered props with hydration and streaming
 *
 * This module provides:
 * - Hydration data collection during server render
 * - Streaming render support with hono/jsx
 * - AI-powered component prop generation
 * - Context-aware rendering with Suspense support
 *
 * Bead: aip-fxpy (tests), aip-z57t (implementation)
 *
 * @packageDocumentation
 */

import { generateProps, mergeWithGenerated } from './generate.js'

// ============================================================================
// Types
// ============================================================================

/**
 * Hydration data structure collected during render
 */
export interface HydrationData {
  /** Map of component ID to props used during render */
  components: Map<string, Record<string, unknown>>
  /** Component hierarchy tree */
  tree: HydrationNode[]
  /** Serialize to JSON string */
  toJSON(): string
}

/**
 * Node in the component hydration tree
 */
export interface HydrationNode {
  id: string
  component: string
  props: Record<string, unknown>
  children: HydrationNode[]
}

/**
 * Context for hydration tracking
 */
export interface HydrationContext {
  /** Register a component render with props */
  register(componentName: string, props: Record<string, unknown>): string
  /** Get collected hydration data */
  getData(): HydrationData
  /** Clear collected data */
  clear(): void
}

/**
 * Options for streaming render
 */
export interface StreamingOptions {
  /** Include hydration data in stream */
  includeHydration?: boolean
  /** Suspense configuration */
  suspense?: {
    fallback: string
  }
  /** Error handler */
  onError?: (error: Error) => string
  /** Enable progressive enhancement */
  progressive?: boolean
  /** Custom headers for response */
  headers?: Record<string, string>
  /** Enable streaming mode */
  streaming?: boolean
}

/**
 * Options for streaming renderer
 */
export interface StreamingRendererOptions {
  /** DOCTYPE to prepend */
  doctype?: string
  /** Shell wrapper function */
  shell?: (content: string, hydration?: string) => string
  /** Include hydration data */
  includeHydration?: boolean
}

/**
 * Props for AI component creation
 */
export interface AIComponentProps<P = Record<string, unknown>> {
  /** Component name */
  name: string
  /** Schema for AI prop generation */
  schema: Record<string, string>
  /** Render function */
  render: (props: P) => string | Promise<string>
  /** Fallback props on error */
  fallback?: Partial<P>
  /** Enable progressive enhancement */
  progressive?: boolean
}

/**
 * Props for withAIProps wrapper
 */
export interface WithAIPropsOptions {
  /** Schema for AI prop generation */
  schema: Record<string, string>
  /** Fallback props on error */
  fallback?: Record<string, unknown>
}

/**
 * Props for AIPropsProvider
 */
export interface AIPropsProviderProps {
  /** AI props configuration */
  config: {
    model?: string
    cache?: boolean
    system?: string
  }
  /** Children to render */
  children: unknown
}

/**
 * Component type with schema attached
 */
export interface AIComponentFunction<P = Record<string, unknown>> {
  (props: Partial<P> & { context?: Record<string, unknown> }): Promise<string>
  schema: Record<string, string>
  displayName?: string
}

// ============================================================================
// Global hydration context (for useHydration hook simulation)
// ============================================================================

let globalHydrationContext: HydrationContext | null = null

// ============================================================================
// Hydration Data Collection
// ============================================================================

/**
 * Create hydration data with the toJSON method
 */
function createHydrationData(
  components: Map<string, Record<string, unknown>>,
  tree: HydrationNode[]
): HydrationData {
  return {
    components,
    tree,
    toJSON() {
      return serializeHydrationData(this)
    },
  }
}

/**
 * Collect hydration data from a component render
 *
 * @param component - Component function to render
 * @param props - Props to pass to component
 * @returns Hydration data collected during render
 */
export async function collectHydrationData<P>(
  component: (props: P) => string | Promise<string>,
  props: P
): Promise<HydrationData> {
  // Create a hydration context
  const ctx = createHydrationContext()

  // Store global context for nested components
  const prevContext = globalHydrationContext
  globalHydrationContext = ctx

  try {
    // Get component name
    const componentName = component.name || 'Anonymous'

    // Register the component
    ctx.register(componentName, props as Record<string, unknown>)

    // Render the component (this might trigger nested registrations)
    await component(props)

    // Return collected data
    return ctx.getData()
  } finally {
    // Restore previous context
    globalHydrationContext = prevContext
  }
}

/**
 * Create a hydration context for tracking component renders
 *
 * @returns New hydration context
 */
export function createHydrationContext(): HydrationContext {
  const components = new Map<string, Record<string, unknown>>()
  const tree: HydrationNode[] = []
  let idCounter = 0

  return {
    register(componentName: string, props: Record<string, unknown>): string {
      const id = `${componentName}-${idCounter++}`
      components.set(componentName, props)

      const node: HydrationNode = {
        id,
        component: componentName,
        props,
        children: [],
      }
      tree.push(node)

      return id
    },

    getData(): HydrationData {
      return createHydrationData(new Map(components), [...tree])
    },

    clear(): void {
      components.clear()
      tree.length = 0
      idCounter = 0
    },
  }
}

/**
 * Serialize hydration data to JSON string
 *
 * @param data - Hydration data to serialize
 * @returns JSON string safe for script embedding
 */
export function serializeHydrationData(data: HydrationData): string {
  // Convert Map to object for serialization
  const componentsObj: Record<string, Record<string, unknown>> = {}

  // Use a WeakSet to detect circular references
  const seen = new WeakSet()

  function sanitizeValue(value: unknown): unknown {
    if (value === null || value === undefined) {
      return value
    }

    if (typeof value === 'object') {
      if (seen.has(value as object)) {
        return '[Circular]'
      }
      seen.add(value as object)

      if (Array.isArray(value)) {
        return value.map(sanitizeValue)
      }

      const result: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        result[k] = sanitizeValue(v)
      }
      return result
    }

    return value
  }

  for (const [key, value] of data.components) {
    componentsObj[key] = sanitizeValue(value) as Record<string, unknown>
  }

  const serializable = {
    components: componentsObj,
    tree: data.tree.map((node) => ({
      id: node.id,
      component: node.component,
      props: sanitizeValue(node.props),
      children: node.children,
    })),
  }

  let json = JSON.stringify(serializable)

  // Escape script tags to prevent XSS
  json = json.replace(/<script/gi, '\\u003cscript')
  json = json.replace(/<\/script/gi, '\\u003c/script')

  return json
}

/**
 * Provider component that enables hydration tracking for children
 *
 * @param props - Provider props with context and children
 * @returns Rendered output with hydration tracking
 */
export function HydrationProvider(props: {
  context: HydrationContext
  children: unknown
}): unknown {
  // Store context globally for nested components
  const prevContext = globalHydrationContext
  globalHydrationContext = props.context

  try {
    // Return children - in a real JSX environment this would render them
    return props.children
  } finally {
    // Note: In real JSX, we'd restore on unmount, not here
    // For our purposes, we keep it set for the duration
    globalHydrationContext = prevContext
  }
}

/**
 * Hook to access hydration context from within a component
 *
 * @returns Current hydration context
 */
export function useHydration(): HydrationContext {
  if (!globalHydrationContext) {
    // Return a no-op context if not in a HydrationProvider
    return createHydrationContext()
  }
  return globalHydrationContext
}

// ============================================================================
// Streaming Render
// ============================================================================

/**
 * Render a component to a ReadableStream
 *
 * @param component - Component function to render
 * @param props - Props to pass to component
 * @param options - Streaming options
 * @returns ReadableStream of rendered HTML
 */
export async function renderToReadableStream<P>(
  component: (props: P) => string | Promise<string>,
  props: P,
  options?: StreamingOptions
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder()

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        // Create hydration context if needed
        const ctx = options?.includeHydration ? createHydrationContext() : null

        if (ctx) {
          globalHydrationContext = ctx
        }

        // Render the component
        let content: string
        try {
          content = await component(props)
        } catch (error) {
          if (options?.onError && error instanceof Error) {
            content = options.onError(error)
          } else {
            throw error
          }
        }

        // Enqueue the content in chunks for streaming behavior
        const chunkSize = 1024
        for (let i = 0; i < content.length; i += chunkSize) {
          const chunk = content.slice(i, i + chunkSize)
          controller.enqueue(encoder.encode(chunk))
        }

        // Add hydration script if requested
        if (options?.includeHydration && ctx) {
          const componentName = component.name || 'Anonymous'
          ctx.register(componentName, props as Record<string, unknown>)
          const hydrationData = ctx.getData()
          const hydrationScript = `<script>window.__HYDRATION_DATA__=${serializeHydrationData(
            hydrationData
          )}</script>`
          controller.enqueue(encoder.encode(hydrationScript))
        }

        controller.close()
      } catch (error) {
        controller.error(error)
      } finally {
        globalHydrationContext = null
      }
    },
  })
}

/**
 * Create a streaming Response from a component
 *
 * @param component - Component function to render
 * @param props - Props to pass to component
 * @param options - Streaming options
 * @returns Response with streaming body
 */
export async function streamJSXResponse<P>(
  component: (props: P) => string | Promise<string>,
  props: P,
  options?: StreamingOptions
): Promise<Response> {
  const stream = await renderToReadableStream(component, props, options)

  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    ...options?.headers,
  })

  // Don't set Content-Length for streaming responses
  if (options?.streaming) {
    // Transfer-Encoding is typically set automatically by the runtime
  }

  return new Response(stream, {
    status: 200,
    headers,
  })
}

/**
 * Create a reusable streaming renderer with configuration
 *
 * @param options - Renderer options
 * @returns Streaming renderer instance
 */
export function createStreamingRenderer(options: StreamingRendererOptions): {
  render: <P>(
    component: (props: P) => string | Promise<string>,
    props: P
  ) => Promise<ReadableStream<Uint8Array>>
} {
  return {
    async render<P>(
      component: (props: P) => string | Promise<string>,
      props: P
    ): Promise<ReadableStream<Uint8Array>> {
      const encoder = new TextEncoder()

      return new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            // Create hydration context
            const ctx = options.includeHydration ? createHydrationContext() : null

            if (ctx) {
              globalHydrationContext = ctx
            }

            // Render the component
            const content = await component(props)

            // Register for hydration data
            if (ctx) {
              const componentName = component.name || 'Anonymous'
              ctx.register(componentName, props as Record<string, unknown>)
            }

            // Get hydration data
            let hydrationJson = ''
            if (options.includeHydration && ctx) {
              hydrationJson = serializeHydrationData(ctx.getData())
            }

            // Apply shell wrapper if provided
            let output: string
            if (options.shell) {
              // When using shell, pass hydration data with __HYDRATION_DATA__ prefix
              // so the shell can embed it directly in a script tag
              const hydrationScript = hydrationJson
                ? `window.__HYDRATION_DATA__=${hydrationJson}`
                : ''
              output = options.shell(content, hydrationScript)
            } else {
              output = content
              if (options.includeHydration && hydrationJson) {
                output += `<script>window.__HYDRATION_DATA__=${hydrationJson}</script>`
              }
            }

            // Prepend doctype if provided
            if (options.doctype) {
              output = options.doctype + '\n' + output
            }

            // Stream in chunks
            const chunkSize = 1024
            for (let i = 0; i < output.length; i += chunkSize) {
              const chunk = output.slice(i, i + chunkSize)
              controller.enqueue(encoder.encode(chunk))
            }

            controller.close()
          } catch (error) {
            controller.error(error)
          } finally {
            globalHydrationContext = null
          }
        },
      })
    },
  }
}

// ============================================================================
// AI Component Creation
// ============================================================================

/**
 * Create a component with AI-powered prop generation
 *
 * @param options - Component options including schema and render function
 * @returns AI-enhanced component function
 */
export function createAIComponent<P extends Record<string, unknown>>(
  options: AIComponentProps<P>
): AIComponentFunction<P> {
  const { name, schema, render, fallback, progressive } = options

  const aiComponent = async (
    props: Partial<P> & { context?: Record<string, unknown> }
  ): Promise<string> => {
    const { context, ...partialProps } = props

    // Check which props are missing
    const schemaKeys = Object.keys(schema)
    const providedKeys = Object.keys(partialProps)
    const missingKeys = schemaKeys.filter((k) => !providedKeys.includes(k))

    let finalProps: P

    if (missingKeys.length === 0) {
      // All props provided, no generation needed
      finalProps = partialProps as P
    } else {
      // Generate missing props
      try {
        // Build schema for only missing props
        const missingSchema: Record<string, string> = {}
        for (const key of missingKeys) {
          const schemaValue = schema[key]
          if (schemaValue !== undefined) {
            missingSchema[key] = schemaValue
          }
        }

        const result = await generateProps<Partial<P>>({
          schema: missingSchema,
          context: context || partialProps,
        })

        finalProps = {
          ...result.props,
          ...partialProps,
        } as P
      } catch (error) {
        // Use fallback on error
        if (fallback) {
          finalProps = {
            ...fallback,
            ...partialProps,
          } as P
        } else {
          throw error
        }
      }
    }

    // Render the component
    return render(finalProps)
  }

  // Attach schema and metadata
  aiComponent.schema = schema
  aiComponent.displayName = `AI(${name})`

  return aiComponent
}

/**
 * Wrap an existing component with AI prop generation
 *
 * @param component - Component function to wrap
 * @param options - AI props options
 * @returns Wrapped component with AI props
 */
export function withAIProps<P extends Record<string, unknown>>(
  component: (props: P) => string | Promise<string>,
  options: WithAIPropsOptions
): AIComponentFunction<P> {
  const { schema, fallback } = options

  const wrappedComponent = async (
    props: Partial<P> & { context?: Record<string, unknown> }
  ): Promise<string> => {
    const { context, ...partialProps } = props

    // Check which props are missing
    const schemaKeys = Object.keys(schema)
    const providedKeys = Object.keys(partialProps)
    const missingKeys = schemaKeys.filter((k) => !providedKeys.includes(k))

    let finalProps: P

    if (missingKeys.length === 0) {
      // All props provided
      finalProps = partialProps as P
    } else {
      // Generate missing props
      try {
        const missingSchema: Record<string, string> = {}
        for (const key of missingKeys) {
          const schemaValue = schema[key]
          if (schemaValue !== undefined) {
            missingSchema[key] = schemaValue
          }
        }

        const result = await generateProps<Partial<P>>({
          schema: missingSchema,
          context: context || partialProps,
        })

        finalProps = {
          ...result.props,
          ...partialProps,
        } as P
      } catch (error) {
        if (fallback) {
          finalProps = {
            ...fallback,
            ...partialProps,
          } as P
        } else {
          throw error
        }
      }
    }

    return component(finalProps)
  }

  // Preserve displayName
  const originalName =
    (component as { displayName?: string }).displayName || component.name || 'Component'
  wrappedComponent.schema = schema
  wrappedComponent.displayName = `withAIProps(${originalName})`

  return wrappedComponent
}

/**
 * Provider component for AI props configuration
 *
 * @param props - Provider props with config and children
 * @returns Rendered output with AI props context
 */
export function AIPropsProvider(props: AIPropsProviderProps): unknown {
  // Store configuration globally (in a real implementation, use React Context)
  // For now, we just pass through children
  return props.children
}
