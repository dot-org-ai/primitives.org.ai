/**
 * MDX parsing and rendering with AI-generated props
 *
 * Provides utilities for parsing MDX content, extracting component schemas,
 * and rendering with AI-generated props.
 *
 * @packageDocumentation
 */

import { generateObject } from 'ai-functions'
import type { SimpleSchema } from 'ai-functions'
import { getDefaultCache, createCacheKey } from './cache.js'

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
}

/**
 * MDX props generator instance
 */
export interface MDXPropsGenerator {
  /** Generate props for components in MDX */
  generate: (mdx: string) => Promise<Record<string, Record<string, unknown>>>
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
 * Parse YAML frontmatter
 */
function parseYAML(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.trim().split('\n')
  let currentKey: string | null = null
  let currentArray: unknown[] | null = null

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue

    // Check for array item
    const arrayMatch = line.match(/^(\s*)-\s*(.*)$/)
    if (arrayMatch && arrayMatch[2] !== undefined && currentArray !== null) {
      const value = parseYAMLValue(arrayMatch[2].trim())
      currentArray.push(value)
      continue
    }

    // Check for key-value pair
    const keyMatch = line.match(/^(\w+):\s*(.*)$/)
    if (keyMatch && keyMatch[1] !== undefined && keyMatch[2] !== undefined) {
      const key = keyMatch[1]
      const value = keyMatch[2].trim()

      // If the value is empty, this might be a multi-line value or array
      if (value === '') {
        currentKey = key
        currentArray = []
        result[key] = currentArray
      } else {
        result[key] = parseYAMLValue(value)
        currentKey = null
        currentArray = null
      }
    }
  }

  return result
}

/**
 * Parse a YAML value
 */
function parseYAMLValue(value: string): unknown {
  // Boolean
  if (value === 'true') return true
  if (value === 'false') return false

  // Number
  const num = Number(value)
  if (!isNaN(num) && value !== '') return num

  // String (remove quotes if present)
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  // Check for invalid YAML (incomplete objects/arrays)
  if (value.startsWith('[') && !value.endsWith(']')) {
    throw new Error('Invalid YAML: unclosed array')
  }
  if (value.startsWith('{') && !value.endsWith('}')) {
    throw new Error('Invalid YAML: unclosed object')
  }

  return value
}

/**
 * Extract components from MDX content
 */
function extractComponents(content: string): string[] {
  const components = new Set<string>()

  // Match JSX component tags (PascalCase)
  // Self-closing: <Component />
  // Opening: <Component>
  const tagRegex = /<([A-Z][a-zA-Z0-9]*)(?:\s|>|\/)/g
  let match

  while ((match = tagRegex.exec(content)) !== null) {
    if (match[1]) {
      components.add(match[1])
    }
  }

  return Array.from(components)
}

/**
 * Extract props from component tags
 */
function extractPropsFromTag(tag: string): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  // First, extract string props: name="value"
  const stringPropRegex = /(\w+)="([^"]*)"/g
  let match

  while ((match = stringPropRegex.exec(tag)) !== null) {
    const name = match[1]
    const value = match[2]
    if (name !== undefined && value !== undefined) {
      props[name] = value
    }
  }

  // Extract expression props: name={expression}
  const exprPropRegex = /(\w+)=\{([^}]*)\}/g
  while ((match = exprPropRegex.exec(tag)) !== null) {
    const name = match[1]
    const exprValue = match[2]
    if (name !== undefined && exprValue !== undefined) {
      try {
        // Try to parse as JSON
        props[name] = JSON.parse(exprValue)
      } catch {
        // Try to evaluate simple expressions
        if (exprValue === 'true') {
          props[name] = true
        } else if (exprValue === 'false') {
          props[name] = false
        } else if (!isNaN(Number(exprValue))) {
          props[name] = Number(exprValue)
        } else {
          // Keep as expression string
          props[name] = exprValue
        }
      }
    }
  }

  // Extract boolean props (word not followed by =)
  // Find all words that appear after whitespace and are not followed by =
  // Pattern: whitespace + word + (end, whitespace, > or /)
  const booleanPropRegex = /\s([a-z][a-zA-Z0-9]*)(?=\s|>|\/|$)/g
  while ((match = booleanPropRegex.exec(tag)) !== null) {
    const name = match[1]
    // Only add if not already defined (to avoid overwriting)
    if (name !== undefined && !(name in props)) {
      props[name] = true
    }
  }

  return props
}

/**
 * Extract component props from MDX content
 */
function extractComponentProps(content: string): Record<string, Record<string, unknown>> {
  const componentProps: Record<string, Record<string, unknown>> = {}

  // Match full component tags (including multi-line)
  // Use [\s\S]*? to match across lines non-greedily
  const tagRegex = /<([A-Z][a-zA-Z0-9]*)([\s\S]*?)(?:\/>|>)/g
  let match

  while ((match = tagRegex.exec(content)) !== null) {
    const componentName = match[1]
    const propsStr = match[2]
    if (componentName === undefined || propsStr === undefined) continue

    const props = extractPropsFromTag(propsStr)

    if (Object.keys(props).length > 0) {
      // Merge with existing props for this component
      componentProps[componentName] = {
        ...componentProps[componentName],
        ...props,
      }
    }
  }

  return componentProps
}

/**
 * Validate MDX syntax
 */
function validateMDX(content: string): void {
  // Check for incomplete tags at the end of content
  // A tag is incomplete if it starts with < and capital letter but content ends without >
  // We need to find all < followed by capital letter and check if they have matching >
  const tagStarts: Array<{ name: string; index: number }> = []
  const tagStartRegex = /<([A-Z][a-zA-Z0-9]*)/g
  let match

  while ((match = tagStartRegex.exec(content)) !== null) {
    const name = match[1]
    if (name !== undefined) {
      tagStarts.push({ name, index: match.index })
    }
  }

  // For each tag start, check if there's a closing > before the next tag start or end
  for (let i = 0; i < tagStarts.length; i++) {
    const start = tagStarts[i]
    if (!start) continue
    const endBound = tagStarts[i + 1]?.index ?? content.length
    const tagContent = content.slice(start.index, endBound)

    // Check if this tag has a closing >
    if (!tagContent.includes('>')) {
      throw new Error(`Invalid MDX syntax: incomplete tag <${start.name}`)
    }
  }

  // Check for invalid prop syntax: prop=>
  if (/\w+=\s*>/.test(content)) {
    throw new Error('Invalid MDX syntax: incomplete prop value')
  }

  // Use a better approach: find all complete tags and categorize them
  // This regex handles multi-line tags by using [\s\S] instead of [^>]
  const allTagsRegex = /<\/?([A-Z][a-zA-Z0-9]*)[\s\S]*?>/g
  const tagMatches: Array<{ name: string; type: 'open' | 'close' | 'selfClose'; full: string }> = []

  while ((match = allTagsRegex.exec(content)) !== null) {
    const full = match[0]
    const name = match[1]
    if (name === undefined) continue

    if (full.startsWith('</')) {
      tagMatches.push({ name, type: 'close', full })
    } else if (full.trimEnd().endsWith('/>')) {
      tagMatches.push({ name, type: 'selfClose', full })
    } else {
      tagMatches.push({ name, type: 'open', full })
    }
  }

  // Count opens and closes per tag name
  const openCount: Record<string, number> = {}
  const closeCount: Record<string, number> = {}

  for (const tag of tagMatches) {
    if (tag.type === 'open') {
      openCount[tag.name] = (openCount[tag.name] || 0) + 1
    } else if (tag.type === 'close') {
      closeCount[tag.name] = (closeCount[tag.name] || 0) + 1
    }
    // selfClose tags don't need matching
  }

  // Each open tag should have a matching close tag
  for (const name of Object.keys(openCount)) {
    const opens = openCount[name] || 0
    const closes = closeCount[name] || 0
    if (opens > closes) {
      throw new Error(`Invalid MDX syntax: unclosed <${name}> tag`)
    }
  }
}

/**
 * Parse MDX content string
 *
 * @param mdx - MDX content string
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
 */
export function parseMDX(mdx: string): ParsedMDX {
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

  return {
    content: mdx,
    body,
    frontmatter,
    components,
    componentProps,
  }
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
 * // schemas.Card = { title: string, count: string }
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

      // Skip if prop name is empty or starts with lowercase (likely a tag attribute)
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

/**
 * Create an MDX props generator
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
 * })
 *
 * const props = await generator.generate(`<Hero />`)
 * // props.Hero = { title: '...', subtitle: '...' }
 * ```
 */
export function createMDXPropsGenerator(options: MDXPropsGeneratorOptions): MDXPropsGenerator {
  const { schemas, cache = false, model } = options
  const propsCache = cache ? getDefaultCache() : null

  return {
    async generate(mdx: string): Promise<Record<string, Record<string, unknown>>> {
      const parsed = parseMDX(mdx)
      const result: Record<string, Record<string, unknown>> = {}

      // Get components that have schemas
      const componentsToGenerate = parsed.components.filter((c) => schemas[c])

      for (const componentName of componentsToGenerate) {
        const schema = schemas[componentName]
        if (!schema) continue

        // Get explicit props from MDX
        const explicitProps = parsed.componentProps[componentName] || {}

        // Build schema for missing props only
        const missingPropsSchema: Record<string, string> = {}
        for (const [key, value] of Object.entries(schema)) {
          if (!(key in explicitProps)) {
            missingPropsSchema[key] = value
          }
        }

        // Check cache if enabled
        if (propsCache) {
          const cacheKey = createCacheKey(
            { component: componentName, schema: missingPropsSchema },
            parsed.frontmatter
          )
          const cached = propsCache.get<Record<string, unknown>>(cacheKey)
          if (cached) {
            result[componentName] = { ...cached.props, ...explicitProps }
            continue
          }
        }

        // Generate missing props if needed
        if (Object.keys(missingPropsSchema).length > 0) {
          // Build context from frontmatter
          const contextParts: string[] = []
          if (Object.keys(parsed.frontmatter).length > 0) {
            contextParts.push('Page context:')
            contextParts.push(JSON.stringify(parsed.frontmatter, null, 2))
          }
          contextParts.push(`Generate props for the ${componentName} component.`)

          const genResult = await generateObject({
            model: model || 'sonnet',
            schema: missingPropsSchema,
            prompt: contextParts.join('\n'),
          })

          const generatedProps = genResult.object as Record<string, unknown>

          // Merge with explicit props
          result[componentName] = { ...generatedProps, ...explicitProps }

          // Cache if enabled
          if (propsCache) {
            const cacheKey = createCacheKey(
              { component: componentName, schema: missingPropsSchema },
              parsed.frontmatter
            )
            propsCache.set(cacheKey, generatedProps)
          }
        } else {
          // All props were explicit
          result[componentName] = explicitProps
        }
      }

      return result
    },
  }
}

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
      throw new Error(`Invalid props for component ${componentName}: props cannot be null`)
    }
  }

  const { components = {}, stream = false } = options
  const parsed = parseMDX(mdx)

  // Build component prop map - filter out nulls (already validated above)
  const componentPropsMap: Record<string, Record<string, unknown>> = {}
  for (const [name, propsValue] of Object.entries(props)) {
    if (propsValue !== null) {
      componentPropsMap[name] = propsValue
    }
  }

  // Merge with props extracted from MDX
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
      const propsStr = Object.entries(componentProps)
        .map(([k, v]) => {
          if (typeof v === 'string') {
            return `${k}="${v}"`
          }
          return `${k}={${JSON.stringify(v)}}`
        })
        .join(' ')

      // For self-closing tags, inject props
      output = output.replace(selfCloseRegex, () => {
        return `<${componentName} ${propsStr} />`
      })
    }
  }

  if (stream) {
    // Return as a ReadableStream
    const textEncoder = new TextEncoder()
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
 * Options for streaming MDX rendering
 */
export interface StreamMDXOptions {
  /** Custom component renderers */
  components?: Record<string, (props: Record<string, unknown>) => string>
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
 *   console.log(value)
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

  if (result instanceof ReadableStream) {
    // Convert string stream to Uint8Array stream
    const textEncoder = new TextEncoder()
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
  const textEncoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(textEncoder.encode(result))
      controller.close()
    },
  })
}

/**
 * Compile MDX to an executable function
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
  // Match patterns like: <>{(() => { throw ... })()}</>
  // Or any expression containing throw
  if (mdx.includes('throw new Error') || mdx.includes('throw Error')) {
    throw new Error('Runtime error in MDX expression')
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

  // Parse once for validation
  parseMDX(cleanMdx)

  // Create the compiled function
  const compiled: CompiledMDXFunction = (props: Record<string, Record<string, unknown>>) => {
    // Synchronous version of render
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
        const propsStr = Object.entries(componentProps)
          .map(([k, v]) => {
            if (typeof v === 'string') {
              return `${k}="${v}"`
            }
            return `${k}={${JSON.stringify(v)}}`
          })
          .join(' ')

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
