/**
 * Integration test: `selectionFor` (L0, reads the model catalog) →
 * `runWithFallback` (L1). This is the full multi-provider abstraction the
 * `model.run(PreparedGeneration)` seam consumes — build a selection plan from
 * a real alias, then drive it with quota-fallback.
 *
 * Runs under the node vitest config only (`vitest.config.js`). The model
 * catalog is loaded via `require('../data/models.json')`, which is not
 * supported in the Cloudflare Workers (Miniflare) runtime, so this file is
 * excluded from the Workers pool config (`vitest.config.ts`). The pure driver
 * unit tests (catalog-free) live in `run.test.ts` and run in both.
 */

import { describe, it, expect } from 'vitest'
import { runWithFallback, selectionFor } from '../src/index.js'

describe('selectionFor + runWithFallback (catalog integration)', () => {
  it('runs the resolved primary candidate from a real alias', async () => {
    const plan = selectionFor('opus')
    const result = await runWithFallback(plan, async (c) => c.modelId)
    expect(result.value).toBe('anthropic/claude-opus-4.5')
    expect(result.attempts).toBe(1)
  })

  it('downgrades opus -> sonnet on a real quota error via the catalog chain', async () => {
    const plan = selectionFor('opus', { fallback: ['sonnet'] })
    const result = await runWithFallback(plan, async (c) => {
      if (c.modelId === 'anthropic/claude-opus-4.5') throw { status: 429 }
      return c.modelId
    })
    expect(result.value).toBe('anthropic/claude-sonnet-4.5')
    expect(result.attempts).toBe(2)
  })
})
