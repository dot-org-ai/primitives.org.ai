/**
 * Tests for the pure findOrCreate gate core — `decide(evidence) → Verdict`.
 *
 * This is the ② data-boundary core from the strategic-primitives-hardening design:
 * a pure, total, synchronous function over a materialized Evidence value. No I/O,
 * no embeddings, no LLM — the impure collector resolves the find ladder + ratifier
 * and hands a plain Evidence in. See docs/plans/2026-06-01-strategic-primitives-hardening.md.
 */

import { describe, it, expect } from 'vitest'
import { decide } from '../src/find-or-create.js'

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
