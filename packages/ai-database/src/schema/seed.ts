/**
 * Seed Data Loading
 *
 * Handles fetching and parsing reference data from external sources.
 * Supports TSV (tab-separated) and CSV (comma-separated) formats.
 *
 * @packageDocumentation
 */

import type { SeedConfig } from '../types.js'

/**
 * Result of a seed operation
 */
export interface SeedResult {
  /** Number of records seeded */
  count: number
}

/**
 * Parse TSV/CSV content into rows
 *
 * @param content - Raw TSV/CSV content
 * @returns Array of row objects keyed by header names
 */
export function parseDelimitedData(content: string): Array<Record<string, string>> {
  const lines = content.trim().split('\n')
  if (lines.length < 2) {
    return [] // Need at least header + 1 data row
  }

  // Detect delimiter: if first line has tabs, use tabs; otherwise use comma
  const headerLine = lines[0]!
  const delimiter = headerLine.includes('\t') ? '\t' : ','

  // Parse header
  const headers = headerLine.split(delimiter).map(h => h.trim())

  // Parse data rows
  const rows: Array<Record<string, string>> = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]!.trim()
    if (!line) continue // Skip empty lines

    const values = line.split(delimiter)
    const row: Record<string, string> = {}

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]!
      const value = values[j]?.trim() ?? ''
      row[header] = value
    }

    rows.push(row)
  }

  return rows
}

/**
 * Fetch and parse seed data from a URL
 *
 * @param url - URL to fetch data from
 * @returns Parsed rows from the data file
 * @throws Error if fetch fails or data is invalid
 */
export async function fetchSeedData(url: string): Promise<Array<Record<string, string>>> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch seed data from ${url}: ${response.status} ${response.statusText}`)
  }

  const content = await response.text()
  return parseDelimitedData(content)
}

/**
 * Map seed data rows to entity records
 *
 * @param rows - Parsed data rows
 * @param config - Seed configuration with field mappings
 * @returns Array of entity records with mapped fields
 */
export function mapSeedDataToRecords(
  rows: Array<Record<string, string>>,
  config: SeedConfig
): Array<{ $id: string; [key: string]: unknown }> {
  const records: Array<{ $id: string; [key: string]: unknown }> = []

  for (const row of rows) {
    const id = row[config.idColumn]
    if (!id) continue // Skip rows without a valid ID

    const record: { $id: string; [key: string]: unknown } = {
      $id: id,
    }

    // Map each configured field
    for (const [fieldName, sourceColumn] of config.fieldMappings) {
      const value = row[sourceColumn]
      if (value !== undefined) {
        record[fieldName] = value
      }
    }

    records.push(record)
  }

  return records
}

/**
 * Load seed data from URL and prepare for database insertion
 *
 * @param config - Seed configuration
 * @returns Array of entity records ready for upsert
 */
export async function loadSeedData(
  config: SeedConfig
): Promise<Array<{ $id: string; [key: string]: unknown }>> {
  const rows = await fetchSeedData(config.url)
  return mapSeedDataToRecords(rows, config)
}
