/**
 * Shared utility functions for worker template generation
 */

/**
 * Extract export names from module code
 * Supports both CommonJS (exports.foo) and ES module (export const foo) syntax
 */
export function getExportNames(moduleCode: string): string {
  const names = new Set<string>()

  // Match exports.name = ...
  const dotPattern = /exports\.(\w+)\s*=/g
  let match
  while ((match = dotPattern.exec(moduleCode)) !== null) {
    if (match[1]) names.add(match[1])
  }

  // Match exports['name'] = ... or exports["name"] = ...
  const bracketPattern = /exports\[['"](\w+)['"]\]\s*=/g
  while ((match = bracketPattern.exec(moduleCode)) !== null) {
    if (match[1]) names.add(match[1])
  }

  // Match export const name = ... or export let name = ... or export var name = ...
  const esConstPattern = /export\s+(?:const|let|var)\s+(\w+)\s*=/g
  while ((match = esConstPattern.exec(moduleCode)) !== null) {
    if (match[1]) names.add(match[1])
  }

  // Match export function name(...) or export async function name(...) or export async function* name(...)
  const esFunctionPattern = /export\s+(?:async\s+)?function\*?\s+(\w+)\s*\(/g
  while ((match = esFunctionPattern.exec(moduleCode)) !== null) {
    if (match[1]) names.add(match[1])
  }

  // Match export class name
  const esClassPattern = /export\s+class\s+(\w+)/g
  while ((match = esClassPattern.exec(moduleCode)) !== null) {
    if (match[1]) names.add(match[1])
  }

  return Array.from(names).join(', ') || '_unused'
}

/**
 * Wrap script to auto-return the last expression
 * Converts: `add(1, 2)` -> `return add(1, 2)`
 */
export function wrapScriptForReturn(script: string): string {
  const trimmed = script.trim()
  if (!trimmed) return script

  // If script already contains a return statement anywhere, don't modify
  if (/\breturn\b/.test(trimmed)) return script

  // If script starts with throw, don't modify
  if (/^\s*throw\b/.test(trimmed)) return script

  // If it's a single expression (no newlines, no semicolons except at end), wrap it
  const withoutTrailingSemi = trimmed.replace(/;?\s*$/, '')
  const isSingleLine = !withoutTrailingSemi.includes('\n')

  // Check if it looks like a single expression (no control flow, no declarations)
  const startsWithKeyword =
    /^\s*(const|let|var|if|for|while|switch|try|class|function|async\s+function)\b/.test(
      withoutTrailingSemi
    )

  if (isSingleLine && !startsWithKeyword) {
    return `return ${withoutTrailingSemi}`
  }

  // For multi-statement scripts, try to return the last expression
  const lines = trimmed.split('\n')
  const lastLineRaw = lines[lines.length - 1]
  if (!lastLineRaw) return script
  const lastLine = lastLineRaw.trim()

  // If last line is an expression (not a declaration, control flow, or throw)
  if (
    lastLine &&
    !/^\s*(const|let|var|if|for|while|switch|try|class|function|return|throw)\b/.test(lastLine)
  ) {
    lines[lines.length - 1] = `return ${lastLine.replace(/;?\s*$/, '')}`
    return lines.join('\n')
  }

  return script
}
