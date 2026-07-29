/**
 * Tests for the pure findOrCreate gate core — `decide(evidence) → Verdict`.
 *
 * This is the ② data-boundary core from the strategic-primitives-hardening design:
 * a pure, total, synchronous function over a materialized Evidence value. No I/O,
 * no embeddings, no LLM — the impure collector resolves the find ladder + ratifier
 * and hands a plain Evidence in. See docs/plans/2026-06-01-strategic-primitives-hardening.md.
 */

import { describe, it, expect } from 'vitest'
import { decide, collect, type FindPorts } from '../src/find-or-create.js'

const band = { autoLink: 0.92, judgeFloor: 0.8 }

describe('decide — the pure findOrCreate gate core', () => {
  it('mints when there are no candidate matches (greenfield)', () => {
    const verdict = decide({
      mode: 'symmetric-collapse',
      candidates: [],
      band,
      ratification: null,
    })

    expect(verdict.kind).toBe('mint')
  })

  it('links to an exact match without consulting the vector tier', () => {
    const verdict = decide({
      mode: 'symmetric-collapse',
      candidates: [{ id: 'thing:soybean-farming', score: 1, exact: true }],
      band,
      ratification: null,
    })

    expect(verdict).toMatchObject({ kind: 'link', canonical: 'thing:soybean-farming', mechanism: 'exact' })
  })

  it('links when the top vector candidate is at or above the autoLink band', () => {
    const verdict = decide({
      mode: 'symmetric-collapse',
      candidates: [
        { id: 'a', score: 0.95, exact: false },
        { id: 'b', score: 0.4, exact: false },
      ],
      band,
      ratification: null,
    })

    expect(verdict).toMatchObject({ kind: 'link', canonical: 'a', mechanism: 'auto-link' })
  })

  it('links in the judge band when the ratifier accepts', () => {
    const verdict = decide({
      mode: 'symmetric-collapse',
      candidates: [{ id: 'a', score: 0.85, exact: false }],
      band,
      ratification: { accept: true, confidence: 0.9 },
    })

    expect(verdict).toMatchObject({ kind: 'link', canonical: 'a', mechanism: 'ratify' })
  })

  it('mints in the judge band when the ratifier rejects', () => {
    const verdict = decide({
      mode: 'symmetric-collapse',
      candidates: [{ id: 'a', score: 0.85, exact: false }],
      band,
      ratification: { accept: false, confidence: 0.9 },
    })

    expect(verdict.kind).toBe('mint')
  })

  it('escalates in the judge band when no ratifier is available (never auto-mint on uncertainty)', () => {
    const verdict = decide({
      mode: 'symmetric-collapse',
      candidates: [{ id: 'a', score: 0.85, exact: false }],
      band,
      ratification: null,
    })

    expect(verdict.kind).toBe('quarantine')
  })

  it('mints when the top candidate is below the judge floor (clear miss)', () => {
    const verdict = decide({
      mode: 'symmetric-collapse',
      candidates: [{ id: 'a', score: 0.5, exact: false }],
      band,
      ratification: null,
    })

    expect(verdict).toMatchObject({ kind: 'mint', mechanism: 'below-floor' })
  })

  it('escalates (fail-safe) when the band is uncalibrated, even on a strong score', () => {
    const verdict = decide({
      mode: 'symmetric-collapse',
      candidates: [{ id: 'a', score: 0.99, exact: false }],
      band: null,
      ratification: null,
    })

    expect(verdict).toMatchObject({ kind: 'quarantine', mechanism: 'no-calibrated-band' })
  })

  it('escalates rather than minting into a closed pool on a clear miss', () => {
    const verdict = decide({
      mode: 'symmetric-collapse',
      candidates: [{ id: 'a', score: 0.5, exact: false }],
      band,
      ratification: null,
      closedPool: true,
    })

    expect(verdict).toMatchObject({ kind: 'quarantine', mechanism: 'closed-pool' })
  })

  it('escalates rather than minting into an empty closed pool', () => {
    const verdict = decide({
      mode: 'symmetric-collapse',
      candidates: [],
      band,
      ratification: null,
      closedPool: true,
    })

    expect(verdict).toMatchObject({ kind: 'quarantine', mechanism: 'closed-pool' })
  })

  it('breaks score ties deterministically by id, independent of candidate order (idempotent)', () => {
    const args = (a: string, b: string) =>
      ({
        mode: 'symmetric-collapse' as const,
        candidates: [
          { id: a, score: 0.95, exact: false },
          { id: b, score: 0.95, exact: false },
        ],
        band,
        ratification: null,
      })

    expect(decide(args('b', 'a'))).toMatchObject({ kind: 'link', canonical: 'a' })
    expect(decide(args('a', 'b'))).toMatchObject({ kind: 'link', canonical: 'a' })
  })
})

describe('collect — the find-ladder collector (fakes for ports)', () => {
  it('short-circuits on an exact hit — never calls the vector tier', async () => {
    let vectorCalls = 0
    const ports: FindPorts = {
      exact: async () => ({ id: 'co:acme', score: 1, exact: true }),
      lexical: async () => [],
      vector: async () => {
        vectorCalls++
        return []
      },
      thresholds: () => band,
    }

    const evidence = await collect({ text: 'Acme Inc', noun: 'Company', mode: 'symmetric-collapse' }, ports)

    expect(evidence.candidates).toContainEqual({ id: 'co:acme', score: 1, exact: true })
    expect(vectorCalls).toBe(0)
  })

  it('with no exact match, unions and dedups the FTS + vector candidates', async () => {
    const ports: FindPorts = {
      exact: async () => null,
      lexical: async () => [{ id: 'a', score: 0.7, exact: false }],
      vector: async () => [
        { id: 'a', score: 0.9, exact: false },
        { id: 'b', score: 0.6, exact: false },
      ],
      thresholds: () => band,
    }

    const evidence = await collect({ text: 'x', noun: 'N', mode: 'asymmetric-match' }, ports)

    // 'a' deduped to one entry (best score wins), 'b' included
    expect(evidence.candidates.map((c) => c.id).sort()).toEqual(['a', 'b'])
    expect(evidence.candidates.find((c) => c.id === 'a')?.score).toBe(0.9)
  })

  it('runs the ratifier only when the fused top lands in the judge band', async () => {
    let ratifyCalls = 0
    const ports: FindPorts = {
      exact: async () => null,
      lexical: async () => [],
      vector: async () => [{ id: 'a', score: 0.85, exact: false }], // judge band [0.8, 0.92)
      ratify: async () => {
        ratifyCalls++
        return { accept: true, confidence: 0.88 }
      },
      thresholds: () => band,
    }

    const evidence = await collect({ text: 'x', noun: 'N', mode: 'asymmetric-match' }, ports)

    expect(ratifyCalls).toBe(1)
    expect(evidence.ratification).toEqual({ accept: true, confidence: 0.88 })
  })

  it('does not run the ratifier on a confident match above the autoLink band', async () => {
    let ratifyCalls = 0
    const ports: FindPorts = {
      exact: async () => null,
      lexical: async () => [],
      vector: async () => [{ id: 'a', score: 0.97, exact: false }], // above autoLink 0.92
      ratify: async () => {
        ratifyCalls++
        return { accept: true, confidence: 1 }
      },
      thresholds: () => band,
    }

    const evidence = await collect({ text: 'x', noun: 'N', mode: 'asymmetric-match' }, ports)

    expect(ratifyCalls).toBe(0)
    expect(evidence.ratification).toBeNull()
  })
})
