#!/usr/bin/env npx tsx
/**
 * Fetch models from OpenRouter API and save to data/models.json
 *
 * Usage: npx tsx scripts/fetch-models.ts
 */

import { writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = join(__dirname, '..', 'data', 'models.json')

async function fetchModels() {
  console.log('Fetching models from OpenRouter API...')

  const response = await fetch('https://openrouter.ai/api/v1/models')

  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const models = data.data || data

  console.log(`Found ${models.length} models`)

  // Sort by created date (newest first)
  models.sort((a: any, b: any) => (b.created || 0) - (a.created || 0))

  writeFileSync(OUTPUT_PATH, JSON.stringify(models, null, 2))
  console.log(`Saved to ${OUTPUT_PATH}`)

  // Print some stats
  const providers = new Set(models.map((m: any) => m.id.split('/')[0]))
  console.log(`\nProviders: ${[...providers].join(', ')}`)
}

fetchModels().catch(console.error)
