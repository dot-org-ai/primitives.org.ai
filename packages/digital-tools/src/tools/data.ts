/**
 * Data Tools - Data manipulation, transformation, validation
 *
 * @packageDocumentation
 */

import { defineTool } from '../define.js'
import type { AnyTool } from '../types.js'

/**
 * Parse JSON string
 */
export const parseJson = defineTool<
  { text: string },
  { data: unknown; valid: boolean; error?: string }
>({
  id: 'data.json.parse',
  name: 'Parse JSON',
  description: 'Parse a JSON string into an object',
  category: 'data',
  subcategory: 'transform',
  input: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'JSON string to parse' },
    },
    required: ['text'],
  },
  handler: async (input) => {
    try {
      const data = JSON.parse(input.text)
      return { data, valid: true }
    } catch (e) {
      return {
        data: null,
        valid: false,
        error: e instanceof Error ? e.message : 'Invalid JSON',
      }
    }
  },
  options: {
    audience: 'both',
    tags: ['json', 'parse', 'transform'],
    idempotent: true,
  },
})

/**
 * Stringify object to JSON
 */
export const stringifyJson = defineTool<
  { data: unknown; pretty?: boolean },
  { text: string }
>({
  id: 'data.json.stringify',
  name: 'Stringify JSON',
  description: 'Convert an object to a JSON string',
  category: 'data',
  subcategory: 'transform',
  input: {
    type: 'object',
    properties: {
      data: { description: 'Data to stringify' },
      pretty: { type: 'boolean', description: 'Pretty print with indentation' },
    },
    required: ['data'],
  },
  handler: async (input) => {
    const text = input.pretty
      ? JSON.stringify(input.data, null, 2)
      : JSON.stringify(input.data)
    return { text }
  },
  options: {
    audience: 'both',
    tags: ['json', 'stringify', 'transform'],
    idempotent: true,
  },
})

/**
 * Parse CSV to array of objects
 */
export const parseCsv = defineTool<
  { text: string; delimiter?: string; hasHeaders?: boolean },
  { rows: Record<string, string>[]; headers: string[]; rowCount: number }
>({
  id: 'data.csv.parse',
  name: 'Parse CSV',
  description: 'Parse CSV text into an array of objects',
  category: 'data',
  subcategory: 'transform',
  input: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'CSV text to parse' },
      delimiter: { type: 'string', description: 'Column delimiter (default: comma)' },
      hasHeaders: { type: 'boolean', description: 'First row is headers (default: true)' },
    },
    required: ['text'],
  },
  handler: async (input) => {
    const delimiter = input.delimiter || ','
    const hasHeaders = input.hasHeaders !== false
    const lines = input.text.split('\n').filter((line) => line.trim())

    if (lines.length === 0) {
      return { rows: [], headers: [], rowCount: 0 }
    }

    const headers = hasHeaders
      ? lines[0].split(delimiter).map((h) => h.trim())
      : lines[0].split(delimiter).map((_, i) => `column${i + 1}`)

    const dataLines = hasHeaders ? lines.slice(1) : lines

    const rows = dataLines.map((line) => {
      const values = line.split(delimiter).map((v) => v.trim())
      const row: Record<string, string> = {}
      headers.forEach((header, i) => {
        row[header] = values[i] || ''
      })
      return row
    })

    return { rows, headers, rowCount: rows.length }
  },
  options: {
    audience: 'both',
    tags: ['csv', 'parse', 'transform'],
    idempotent: true,
  },
})

/**
 * Transform data using JSONPath-like expressions
 */
export const transformData = defineTool<
  { data: unknown; transform: Record<string, string> },
  { result: Record<string, unknown> }
>({
  id: 'data.transform',
  name: 'Transform Data',
  description: 'Transform data by mapping fields to new structure',
  category: 'data',
  subcategory: 'transform',
  input: {
    type: 'object',
    properties: {
      data: { description: 'Source data to transform' },
      transform: {
        type: 'object',
        description: 'Mapping of output fields to input paths (e.g., { "name": "user.firstName" })',
      },
    },
    required: ['data', 'transform'],
  },
  handler: async (input) => {
    const result: Record<string, unknown> = {}

    for (const [outputKey, inputPath] of Object.entries(input.transform)) {
      const pathParts = inputPath.split('.')
      let value: unknown = input.data

      for (const part of pathParts) {
        if (value && typeof value === 'object' && part in (value as Record<string, unknown>)) {
          value = (value as Record<string, unknown>)[part]
        } else {
          value = undefined
          break
        }
      }

      result[outputKey] = value
    }

    return { result }
  },
  options: {
    audience: 'both',
    tags: ['transform', 'map', 'extract'],
    idempotent: true,
  },
})

/**
 * Filter array of objects
 */
export const filterData = defineTool<
  { data: unknown[]; filter: Record<string, unknown> },
  { results: unknown[]; count: number }
>({
  id: 'data.filter',
  name: 'Filter Data',
  description: 'Filter an array of objects by field values',
  category: 'data',
  subcategory: 'transform',
  input: {
    type: 'object',
    properties: {
      data: { type: 'array', description: 'Array of objects to filter' },
      filter: { type: 'object', description: 'Filter criteria (e.g., { "status": "active" })' },
    },
    required: ['data', 'filter'],
  },
  handler: async (input) => {
    const results = input.data.filter((item) => {
      if (typeof item !== 'object' || item === null) return false

      for (const [key, value] of Object.entries(input.filter)) {
        if ((item as Record<string, unknown>)[key] !== value) {
          return false
        }
      }
      return true
    })

    return { results, count: results.length }
  },
  options: {
    audience: 'both',
    tags: ['filter', 'query', 'search'],
    idempotent: true,
  },
})

/**
 * All data tools
 */
export const dataTools: AnyTool[] = [
  parseJson,
  stringifyJson,
  parseCsv,
  transformData,
  filterData,
]
