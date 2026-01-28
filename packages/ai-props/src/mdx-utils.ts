/**
 * MDX utility functions
 *
 * Internal utilities for MDX parsing, component extraction, and content hashing.
 *
 * @packageDocumentation
 */

import type { ParsedMDX, MDXParseError } from './mdx-types.js'

/**
 * Default cache TTL for MDX parsing (5 minutes)
 */
export const MDX_CACHE_TTL = 5 * 60 * 1000

/**
 * Create a content hash for cache keys
 *
 * Uses a simple but fast hash algorithm suitable for cache keys.
 *
 * @param content - Content to hash
 * @returns Hash string
 */
export function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(36)
}

/**
 * Create an MDX parse error with location information
 *
 * @param message - Error message
 * @param source - Source content where error occurred
 * @param position - Position in source (optional)
 * @returns MDXParseError
 */
export function createParseError(
  message: string,
  source?: string,
  position?: number
): MDXParseError {
  const error = new Error(message) as MDXParseError
  if (source !== undefined) {
    error.source = source
  }

  if (source && position !== undefined) {
    const lines = source.slice(0, position).split('\n')
    error.line = lines.length
    error.column = (lines[lines.length - 1]?.length || 0) + 1
  }

  return error
}

/**
 * Parse YAML frontmatter
 *
 * Handles basic YAML types: strings, numbers, booleans, arrays, and nested objects.
 *
 * @param yaml - YAML content string
 * @returns Parsed key-value pairs
 * @throws Error if YAML is invalid
 */
export function parseYAML(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.trim().split('\n')

  // Stack for tracking nested objects
  // Each entry stores: the parent object, the parent indent level, and the current object's indent
  const stack: Array<{
    parentObj: Record<string, unknown>
    parentIndent: number
    thisIndent: number
  }> = []
  let currentObj: Record<string, unknown> = result
  let currentIndent = -1 // Use -1 for root level
  let currentArray: unknown[] | null = null

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue

    // Calculate indentation
    const indentMatch = line.match(/^(\s*)/)
    const indent = indentMatch && indentMatch[1] !== undefined ? indentMatch[1].length : 0

    // Pop stack if we've dedented (back to a parent level or sibling)
    while (stack.length > 0 && indent <= stack[stack.length - 1]!.thisIndent) {
      const popped = stack.pop()!
      currentObj = popped.parentObj
      currentIndent = popped.parentIndent
      currentArray = null
    }

    // Check for array item
    const arrayMatch = line.match(/^(\s*)-\s*(.*)$/)
    if (arrayMatch && arrayMatch[2] !== undefined && currentArray !== null) {
      const value = parseYAMLValue(arrayMatch[2].trim())
      currentArray.push(value)
      continue
    }

    // Check for key-value pair (supporting special chars like $)
    const keyMatch = line.match(/^(\s*)([\w$]+):\s*(.*)$/)
    if (keyMatch && keyMatch[2] !== undefined && keyMatch[3] !== undefined) {
      const key = keyMatch[2]
      const value = keyMatch[3].trim()

      // If the value is empty, this might be a nested object or array
      if (value === '') {
        // Check if this is an array or nested object by looking at the next line
        const lineIndex = lines.indexOf(line)
        const nextLine = lines[lineIndex + 1]

        if (nextLine && nextLine.trim().startsWith('-')) {
          // It's an array
          currentArray = []
          currentObj[key] = currentArray
        } else {
          // It's a nested object
          const nestedObj: Record<string, unknown> = {}
          currentObj[key] = nestedObj
          stack.push({
            parentObj: currentObj,
            parentIndent: currentIndent,
            thisIndent: indent,
          })
          currentObj = nestedObj
          currentIndent = indent
          currentArray = null
        }
      } else {
        currentObj[key] = parseYAMLValue(value)
        currentArray = null
      }
    }
  }

  return result
}

/**
 * Parse a YAML value to its appropriate type
 *
 * @param value - YAML value string
 * @returns Parsed value
 * @throws Error if value is malformed
 */
export function parseYAMLValue(value: string): unknown {
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
    throw createParseError('Invalid YAML: unclosed array')
  }
  if (value.startsWith('{') && !value.endsWith('}')) {
    throw createParseError('Invalid YAML: unclosed object')
  }

  return value
}

/**
 * Extract component names from MDX content
 *
 * Finds all PascalCase JSX component tags.
 *
 * @param content - MDX body content
 * @returns Array of unique component names
 */
export function extractComponents(content: string): string[] {
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
 * Extract props from a component tag string
 *
 * Parses string props, expression props, and boolean props.
 *
 * @param tag - Component tag content (attributes portion)
 * @returns Props object
 */
export function extractPropsFromTag(tag: string): Record<string, unknown> {
  const props: Record<string, unknown> = {}

  // Extract string props: name="value"
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
  const booleanPropRegex = /\s([a-z][a-zA-Z0-9]*)(?=\s|>|\/|$)/g
  while ((match = booleanPropRegex.exec(tag)) !== null) {
    const name = match[1]
    // Only add if not already defined
    if (name !== undefined && !(name in props)) {
      props[name] = true
    }
  }

  return props
}

/**
 * Extract component props from all components in MDX content
 *
 * @param content - MDX body content
 * @returns Map of component names to their props
 */
export function extractComponentProps(content: string): Record<string, Record<string, unknown>> {
  const componentProps: Record<string, Record<string, unknown>> = {}

  // Match full component tags (including multi-line)
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
 *
 * Checks for unclosed tags and invalid prop syntax.
 *
 * @param content - MDX body content
 * @throws MDXParseError if syntax is invalid
 */
export function validateMDX(content: string): void {
  // Check for incomplete tags at the end of content
  const tagStarts: Array<{ name: string; index: number }> = []
  const tagStartRegex = /<([A-Z][a-zA-Z0-9]*)/g
  let match

  while ((match = tagStartRegex.exec(content)) !== null) {
    const name = match[1]
    if (name !== undefined) {
      tagStarts.push({ name, index: match.index })
    }
  }

  // For each tag start, check if there's a closing >
  for (let i = 0; i < tagStarts.length; i++) {
    const start = tagStarts[i]
    if (!start) continue
    const endBound = tagStarts[i + 1]?.index ?? content.length
    const tagContent = content.slice(start.index, endBound)

    if (!tagContent.includes('>')) {
      throw createParseError(
        `Invalid MDX syntax: incomplete tag <${start.name}`,
        content,
        start.index
      )
    }
  }

  // Check for invalid prop syntax: prop=>
  const invalidPropMatch = content.match(/\w+=\s*>/)
  if (invalidPropMatch) {
    const position = content.indexOf(invalidPropMatch[0])
    throw createParseError('Invalid MDX syntax: incomplete prop value', content, position)
  }

  // Validate matching open/close tags
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
  }

  // Each open tag should have a matching close tag
  for (const name of Object.keys(openCount)) {
    const opens = openCount[name] || 0
    const closes = closeCount[name] || 0
    if (opens > closes) {
      throw createParseError(`Invalid MDX syntax: unclosed <${name}> tag`, content)
    }
  }
}

/**
 * Serialize props to JSX attribute string
 *
 * @param props - Props object
 * @returns JSX attribute string
 */
export function serializeProps(props: Record<string, unknown>): string {
  return Object.entries(props)
    .map(([k, v]) => {
      if (typeof v === 'string') {
        return `${k}="${v}"`
      }
      return `${k}={${JSON.stringify(v)}}`
    })
    .join(' ')
}

/**
 * Sort object keys for consistent hashing
 *
 * @param obj - Object to sort
 * @returns Object with sorted keys
 */
export function sortObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {}
  for (const key of Object.keys(obj).sort()) {
    const value = obj[key]
    sorted[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? sortObject(value as Record<string, unknown>)
        : value
  }
  return sorted
}

/**
 * Create a cache key for MDX props generation
 *
 * @param componentName - Component name
 * @param schema - Component schema
 * @param context - Frontmatter context
 * @returns Cache key string
 */
export function createMDXCacheKey(
  componentName: string,
  schema: Record<string, string>,
  context?: Record<string, unknown>
): string {
  const schemaHash = hashContent(JSON.stringify(sortObject(schema)))
  const contextHash = context ? hashContent(JSON.stringify(sortObject(context))) : ''
  return `mdx:${componentName}:${schemaHash}:${contextHash}`
}
