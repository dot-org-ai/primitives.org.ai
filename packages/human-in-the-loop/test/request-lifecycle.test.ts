/**
 * Unit tests for request-lifecycle.
 *
 * Covers:
 *   1. Every valid transition (claim, startProgress, release, resolve,
 *      timeout, escalate, cancel) — positive path.
 *   2. Every invalid transition — fail-closed (returns Error, does not mutate).
 *   3. All 6 request kinds modeled correctly.
 *   4. Full valid-transition chains (positive flows).
 *   5. forAssignee filtering — positive, negative, empty.
 *   6. sortByPriorityThenSLA — ordering across multiple priority + SLA inputs.
 *   7. isBreached / timeToDeadline helpers.
 *
 * No I/O, no mocks, no framework imports.
 * Ported from management.studio hitl-queue.test.ts (78 tests) with
 * upstream type names.
 */

import { describe, it, expect } from 'vitest'
import {
  claim,
  startProgress,
  release,
  resolve,
  timeout,
  escalate,
  cancel,
  forAssignee,
  sortByPriorityThenSLA,
  isBreached,
  timeToDeadline,
} from '../src/request-lifecycle.js'
import type { LifecycleItem, LifecyclePriority, RequestKind } from '../src/request-lifecycle.js'

// ─────────────────────────────────────────────────────────────────────────────
// Fixture factory
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-25T10:00:00Z')
const SLA_NEAR = new Date('2026-05-25T12:00:00Z') // 2h from NOW
const SLA_FAR = new Date('2026-05-25T18:00:00Z') // 8h from NOW

let _idCounter = 0

function makeItem(overrides: Partial<LifecycleItem> = {}): LifecycleItem {
  _idCounter += 1
  return {
    id: `hf-test-${_idCounter}`,
    kind: 'approve',
    status: 'pending',
    priority: 'normal',
    title: `Test LifecycleItem ${_idCounter}`,
    artifact: { kind: 'Invoice', id: `inv-${_idCounter}` },
    assignee: 'person-alex',
    teamId: 'team-engineering',
    businessId: 'business-acme-ops',
    studioId: 'studio-acme',
    createdAt: NOW,
    slaDeadline: SLA_FAR,
    updatedAt: NOW,
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. claim — pending → claimed
// ─────────────────────────────────────────────────────────────────────────────

describe('claim', () => {
  it('transitions pending → claimed', () => {
    const item = makeItem({ status: 'pending' })
    const result = claim(item, { claimedBy: 'person-alex' })
    expect(result instanceof Error).toBe(false)
    const next = result as LifecycleItem
    expect(next.status).toBe('claimed')
    expect(next.claimedBy).toBe('person-alex')
  })

  it('sets claimedAt to provided value', () => {
    const claimedAt = new Date('2026-05-25T11:00:00Z')
    const item = makeItem({ status: 'pending' })
    const result = claim(item, { claimedBy: 'person-alex', claimedAt })
    const next = result as LifecycleItem
    expect(next.claimedAt).toEqual(claimedAt)
  })

  it('sets claimedAt to a Date when not provided', () => {
    const item = makeItem({ status: 'pending' })
    const result = claim(item, { claimedBy: 'person-alex' })
    const next = result as LifecycleItem
    expect(next.claimedAt).toBeInstanceOf(Date)
  })

  it('updates updatedAt', () => {
    const item = makeItem({ status: 'pending', updatedAt: NOW })
    const result = claim(item, { claimedBy: 'person-alex' })
    const next = result as LifecycleItem
    expect(next.updatedAt).not.toEqual(NOW)
  })

  it('does NOT mutate the original item', () => {
    const item = makeItem({ status: 'pending' })
    claim(item, { claimedBy: 'person-alex' })
    expect(item.status).toBe('pending')
  })

  it('returns Error for claimed item (fail-closed)', () => {
    const item = makeItem({ status: 'claimed' })
    const result = claim(item, { claimedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/cannot claim/)
  })

  it('returns Error for in_progress item', () => {
    const item = makeItem({ status: 'in_progress' })
    const result = claim(item, { claimedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for completed item (fail-closed)', () => {
    const item = makeItem({ status: 'completed' })
    const result = claim(item, { claimedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for cancelled item (fail-closed)', () => {
    const item = makeItem({ status: 'cancelled' })
    const result = claim(item, { claimedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for timeout item (fail-closed)', () => {
    const item = makeItem({ status: 'timeout' })
    const result = claim(item, { claimedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for escalated item (fail-closed)', () => {
    const item = makeItem({ status: 'escalated' })
    const result = claim(item, { claimedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for released item (fail-closed — released is terminal)', () => {
    const item = makeItem({ status: 'released' })
    const result = claim(item, { claimedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. startProgress — claimed → in_progress
// ─────────────────────────────────────────────────────────────────────────────

describe('startProgress', () => {
  it('transitions claimed → in_progress', () => {
    const item = makeItem({ status: 'claimed' })
    const result = startProgress(item, {})
    expect(result instanceof Error).toBe(false)
    expect((result as LifecycleItem).status).toBe('in_progress')
  })

  it('accepts explicit startedAt', () => {
    const startedAt = new Date('2026-05-25T11:30:00Z')
    const item = makeItem({ status: 'claimed' })
    const result = startProgress(item, { startedAt })
    expect((result as LifecycleItem).updatedAt).toEqual(startedAt)
  })

  it('returns Error for pending item', () => {
    const item = makeItem({ status: 'pending' })
    const result = startProgress(item, {})
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/cannot startProgress/)
  })

  it('returns Error for already in_progress item', () => {
    const item = makeItem({ status: 'in_progress' })
    const result = startProgress(item, {})
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for completed item', () => {
    const item = makeItem({ status: 'completed' })
    const result = startProgress(item, {})
    expect(result).toBeInstanceOf(Error)
  })

  it('does NOT mutate the original item', () => {
    const item = makeItem({ status: 'claimed' })
    startProgress(item, {})
    expect(item.status).toBe('claimed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. release — claimed | in_progress → released
// ─────────────────────────────────────────────────────────────────────────────

describe('release', () => {
  it('transitions claimed → released', () => {
    const item = makeItem({ status: 'claimed', claimedBy: 'person-alex' })
    const result = release(item, { releasedBy: 'person-alex' })
    expect(result instanceof Error).toBe(false)
    const next = result as LifecycleItem
    expect(next.status).toBe('released')
  })

  it('transitions in_progress → released', () => {
    const item = makeItem({ status: 'in_progress' })
    const result = release(item, { releasedBy: 'person-alex' })
    expect(result instanceof Error).toBe(false)
    expect((result as LifecycleItem).status).toBe('released')
  })

  it('clears claimedBy and claimedAt on release', () => {
    const item = makeItem({
      status: 'claimed',
      claimedBy: 'person-alex',
      claimedAt: NOW,
    })
    const result = release(item, { releasedBy: 'person-alex' })
    const next = result as LifecycleItem
    expect(next.claimedBy).toBeUndefined()
    expect(next.claimedAt).toBeUndefined()
  })

  it('returns Error for pending item', () => {
    const item = makeItem({ status: 'pending' })
    const result = release(item, { releasedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/cannot release/)
  })

  it('returns Error for completed item', () => {
    const item = makeItem({ status: 'completed' })
    const result = release(item, { releasedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for cancelled item', () => {
    const item = makeItem({ status: 'cancelled' })
    const result = release(item, { releasedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
  })

  it('does NOT mutate the original item', () => {
    const item = makeItem({ status: 'claimed' })
    release(item, { releasedBy: 'person-alex' })
    expect(item.status).toBe('claimed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. resolve — in_progress | claimed → completed
// ─────────────────────────────────────────────────────────────────────────────

describe('resolve', () => {
  it('transitions in_progress → completed', () => {
    const item = makeItem({ status: 'in_progress' })
    const result = resolve(item, { verb: 'approve', resolvedBy: 'person-alex' })
    expect(result instanceof Error).toBe(false)
    const next = result as LifecycleItem
    expect(next.status).toBe('completed')
    expect(next.resolution?.verb).toBe('approve')
    expect(next.resolution?.resolvedBy).toBe('person-alex')
  })

  it('transitions claimed → completed (direct resolve without startProgress)', () => {
    const item = makeItem({ status: 'claimed' })
    const result = resolve(item, {
      verb: 'reject',
      resolvedBy: 'person-alex',
      comments: 'Out of policy',
    })
    expect(result instanceof Error).toBe(false)
    const next = result as LifecycleItem
    expect(next.status).toBe('completed')
    expect(next.resolution?.verb).toBe('reject')
    expect(next.resolution?.comments).toBe('Out of policy')
  })

  it('records completedAt', () => {
    const resolvedAt = new Date('2026-05-25T11:45:00Z')
    const item = makeItem({ status: 'in_progress' })
    const result = resolve(item, { verb: 'approve', resolvedBy: 'person-alex', resolvedAt })
    const next = result as LifecycleItem
    expect(next.completedAt).toEqual(resolvedAt)
  })

  it('includes optional comments in resolution', () => {
    const item = makeItem({ status: 'in_progress' })
    const result = resolve(item, {
      verb: 'approve',
      resolvedBy: 'person-alex',
      comments: 'LGTM',
    })
    expect((result as LifecycleItem).resolution?.comments).toBe('LGTM')
  })

  it('includes arbitrary data in resolution', () => {
    const item = makeItem({ status: 'in_progress' })
    const data = { approvalCode: 'APR-001', conditions: ['within-budget'] }
    const result = resolve(item, { verb: 'approve', resolvedBy: 'person-alex', data })
    expect((result as LifecycleItem).resolution?.data).toEqual(data)
  })

  it('returns Error for pending item', () => {
    const item = makeItem({ status: 'pending' })
    const result = resolve(item, { verb: 'approve', resolvedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/cannot resolve/)
  })

  it('returns Error for completed item (fail-closed)', () => {
    const item = makeItem({ status: 'completed' })
    const result = resolve(item, { verb: 'approve', resolvedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for cancelled item', () => {
    const item = makeItem({ status: 'cancelled' })
    const result = resolve(item, { verb: 'approve', resolvedBy: 'person-alex' })
    expect(result).toBeInstanceOf(Error)
  })

  it('does NOT mutate the original item', () => {
    const item = makeItem({ status: 'in_progress' })
    resolve(item, { verb: 'approve', resolvedBy: 'person-alex' })
    expect(item.status).toBe('in_progress')
    expect(item.resolution).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. timeout — active → timeout
// ─────────────────────────────────────────────────────────────────────────────

describe('timeout', () => {
  it('transitions pending → timeout', () => {
    const item = makeItem({ status: 'pending' })
    const result = timeout(item, {})
    expect(result instanceof Error).toBe(false)
    expect((result as LifecycleItem).status).toBe('timeout')
  })

  it('transitions claimed → timeout', () => {
    const item = makeItem({ status: 'claimed' })
    const result = timeout(item, {})
    expect(result instanceof Error).toBe(false)
    expect((result as LifecycleItem).status).toBe('timeout')
  })

  it('transitions in_progress → timeout', () => {
    const item = makeItem({ status: 'in_progress' })
    const result = timeout(item, {})
    expect(result instanceof Error).toBe(false)
    expect((result as LifecycleItem).status).toBe('timeout')
  })

  it('accepts explicit timedOutAt', () => {
    const timedOutAt = new Date('2026-05-25T14:00:00Z')
    const item = makeItem({ status: 'pending' })
    const result = timeout(item, { timedOutAt })
    expect((result as LifecycleItem).updatedAt).toEqual(timedOutAt)
  })

  it('returns Error for completed item (fail-closed)', () => {
    const item = makeItem({ status: 'completed' })
    const result = timeout(item, {})
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/cannot timeout/)
  })

  it('returns Error for already-timeout item', () => {
    const item = makeItem({ status: 'timeout' })
    const result = timeout(item, {})
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for cancelled item', () => {
    const item = makeItem({ status: 'cancelled' })
    const result = timeout(item, {})
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for escalated item', () => {
    const item = makeItem({ status: 'escalated' })
    const result = timeout(item, {})
    expect(result).toBeInstanceOf(Error)
  })

  it('does NOT mutate the original item', () => {
    const item = makeItem({ status: 'pending' })
    timeout(item, {})
    expect(item.status).toBe('pending')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. escalate — active → escalated
// ─────────────────────────────────────────────────────────────────────────────

describe('escalate', () => {
  it('transitions pending → escalated', () => {
    const item = makeItem({ status: 'pending' })
    const result = escalate(item, {})
    expect(result instanceof Error).toBe(false)
    expect((result as LifecycleItem).status).toBe('escalated')
  })

  it('transitions claimed → escalated', () => {
    const item = makeItem({ status: 'claimed' })
    const result = escalate(item, {})
    expect(result instanceof Error).toBe(false)
    expect((result as LifecycleItem).status).toBe('escalated')
  })

  it('transitions in_progress → escalated', () => {
    const item = makeItem({ status: 'in_progress' })
    const result = escalate(item, {})
    expect(result instanceof Error).toBe(false)
    expect((result as LifecycleItem).status).toBe('escalated')
  })

  it('returns Error for completed item (fail-closed)', () => {
    const item = makeItem({ status: 'completed' })
    const result = escalate(item, {})
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/cannot escalate/)
  })

  it('returns Error for already-escalated item', () => {
    const item = makeItem({ status: 'escalated' })
    const result = escalate(item, {})
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for timeout item', () => {
    const item = makeItem({ status: 'timeout' })
    const result = escalate(item, {})
    expect(result).toBeInstanceOf(Error)
  })

  it('does NOT mutate the original item', () => {
    const item = makeItem({ status: 'pending' })
    escalate(item, {})
    expect(item.status).toBe('pending')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. cancel — active → cancelled
// ─────────────────────────────────────────────────────────────────────────────

describe('cancel', () => {
  it('transitions pending → cancelled', () => {
    const item = makeItem({ status: 'pending' })
    const result = cancel(item, {})
    expect(result instanceof Error).toBe(false)
    expect((result as LifecycleItem).status).toBe('cancelled')
  })

  it('transitions claimed → cancelled', () => {
    const item = makeItem({ status: 'claimed' })
    const result = cancel(item, {})
    expect(result instanceof Error).toBe(false)
    expect((result as LifecycleItem).status).toBe('cancelled')
  })

  it('transitions in_progress → cancelled', () => {
    const item = makeItem({ status: 'in_progress' })
    const result = cancel(item, {})
    expect(result instanceof Error).toBe(false)
    expect((result as LifecycleItem).status).toBe('cancelled')
  })

  it('returns Error for completed item (fail-closed)', () => {
    const item = makeItem({ status: 'completed' })
    const result = cancel(item, {})
    expect(result).toBeInstanceOf(Error)
    expect((result as Error).message).toMatch(/cannot cancel/)
  })

  it('returns Error for already-cancelled item', () => {
    const item = makeItem({ status: 'cancelled' })
    const result = cancel(item, {})
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for timeout item', () => {
    const item = makeItem({ status: 'timeout' })
    const result = cancel(item, {})
    expect(result).toBeInstanceOf(Error)
  })

  it('returns Error for escalated item', () => {
    const item = makeItem({ status: 'escalated' })
    const result = cancel(item, {})
    expect(result).toBeInstanceOf(Error)
  })

  it('does NOT mutate the original item', () => {
    const item = makeItem({ status: 'pending' })
    cancel(item, {})
    expect(item.status).toBe('pending')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. All 6 request kinds modeled correctly
// ─────────────────────────────────────────────────────────────────────────────

describe('all 6 request kinds', () => {
  const kinds: RequestKind[] = ['approve', 'ask', 'decide', 'review', 'do', 'notify']

  for (const kind of kinds) {
    it(`kind="${kind}" can be claimed and resolved`, () => {
      const item = makeItem({ kind, status: 'pending' })
      const claimed = claim(item, { claimedBy: 'person-alex' }) as LifecycleItem
      expect(claimed.status).toBe('claimed')
      expect(claimed.kind).toBe(kind)

      const completed = resolve(claimed, {
        verb: kind === 'approve' ? 'approve' : 'done',
        resolvedBy: 'person-alex',
      }) as LifecycleItem
      expect(completed.status).toBe('completed')
      expect(completed.kind).toBe(kind)
    })

    it(`kind="${kind}" can be cancelled from pending`, () => {
      const item = makeItem({ kind, status: 'pending' })
      const result = cancel(item, {}) as LifecycleItem
      expect(result.status).toBe('cancelled')
    })

    it(`kind="${kind}" can be timed out from pending`, () => {
      const item = makeItem({ kind, status: 'pending' })
      const result = timeout(item, {}) as LifecycleItem
      expect(result.status).toBe('timeout')
    })
  }

  it('ask kind carries askPayload through transitions', () => {
    const item = makeItem({
      kind: 'ask',
      askPayload: { question: 'What should we do?', suggestions: ['A', 'B'] },
    })
    const claimed = claim(item, { claimedBy: 'person-alex' }) as LifecycleItem
    expect(claimed.askPayload?.question).toBe('What should we do?')
    expect(claimed.askPayload?.suggestions).toEqual(['A', 'B'])
  })

  it('decide kind carries decidePayload through transitions', () => {
    const item = makeItem({
      kind: 'decide',
      decidePayload: { options: ['Option A', 'Option B'], criteria: 'Cost efficiency' },
    })
    const claimed = claim(item, { claimedBy: 'person-alex' }) as LifecycleItem
    expect(claimed.decidePayload?.options).toEqual(['Option A', 'Option B'])
  })

  it('review kind carries reviewPayload through transitions', () => {
    const item = makeItem({
      kind: 'review',
      reviewPayload: { content: 'PR diff here', criteria: 'Code quality' },
    })
    const inProg = startProgress(
      claim(item, { claimedBy: 'person-alex' }) as LifecycleItem,
      {}
    ) as LifecycleItem
    expect(inProg.reviewPayload?.content).toBe('PR diff here')
  })

  it('do kind carries doPayload through transitions', () => {
    const item = makeItem({
      kind: 'do',
      doPayload: { instructions: 'Deploy to prod', tools: ['ssh', 'kubectl'] },
    })
    const claimed = claim(item, { claimedBy: 'person-alex' }) as LifecycleItem
    expect(claimed.doPayload?.instructions).toBe('Deploy to prod')
    expect(claimed.doPayload?.tools).toEqual(['ssh', 'kubectl'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. Full valid-transition chains
// ─────────────────────────────────────────────────────────────────────────────

describe('full transition chains', () => {
  it('pending → claimed → in_progress → completed', () => {
    const item = makeItem({ status: 'pending' })
    const claimed = claim(item, { claimedBy: 'person-alex' }) as LifecycleItem
    expect(claimed.status).toBe('claimed')

    const inProg = startProgress(claimed, {}) as LifecycleItem
    expect(inProg.status).toBe('in_progress')

    const completed = resolve(inProg, {
      verb: 'approve',
      resolvedBy: 'person-alex',
    }) as LifecycleItem
    expect(completed.status).toBe('completed')
    expect(completed.resolution?.verb).toBe('approve')
  })

  it('pending → claimed → released (cannot claim released)', () => {
    const item = makeItem({ status: 'pending' })
    const claimed = claim(item, { claimedBy: 'person-alex' }) as LifecycleItem
    const released = release(claimed, { releasedBy: 'person-alex' }) as LifecycleItem
    expect(released.status).toBe('released')

    // released is terminal — cannot claim it again
    const reClaim = claim(released, { claimedBy: 'person-alex' })
    expect(reClaim).toBeInstanceOf(Error)
  })

  it('pending → timeout → cannot transition further', () => {
    const item = makeItem({ status: 'pending' })
    const timedOut = timeout(item, {}) as LifecycleItem
    expect(timedOut.status).toBe('timeout')

    expect(claim(timedOut, { claimedBy: 'person-alex' })).toBeInstanceOf(Error)
    expect(resolve(timedOut, { verb: 'approve', resolvedBy: 'person-alex' })).toBeInstanceOf(Error)
    expect(cancel(timedOut, {})).toBeInstanceOf(Error)
  })

  it('pending → escalated → cannot transition further', () => {
    const item = makeItem({ status: 'pending' })
    const escalated = escalate(item, {}) as LifecycleItem
    expect(escalated.status).toBe('escalated')

    expect(claim(escalated, { claimedBy: 'person-alex' })).toBeInstanceOf(Error)
    expect(resolve(escalated, { verb: 'approve', resolvedBy: 'person-alex' })).toBeInstanceOf(Error)
  })

  it('pending → claimed → in_progress → released (not re-claimable)', () => {
    const item = makeItem({ status: 'pending' })
    const claimed = claim(item, { claimedBy: 'person-alex' }) as LifecycleItem
    const inProg = startProgress(claimed, {}) as LifecycleItem
    const released = release(inProg, { releasedBy: 'person-alex' }) as LifecycleItem
    expect(released.status).toBe('released')
    expect(release(released, { releasedBy: 'person-alex' })).toBeInstanceOf(Error)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. forAssignee filtering
// ─────────────────────────────────────────────────────────────────────────────

describe('forAssignee', () => {
  const items: LifecycleItem[] = [
    makeItem({ assignee: 'person-alex', id: 'fa-1' }),
    makeItem({ assignee: 'person-sam', id: 'fa-2' }),
    makeItem({ assignee: 'person-alex', id: 'fa-3' }),
    makeItem({ assignee: 'person-jordan', id: 'fa-4' }),
  ]

  it('returns only items assigned to the given assigneeId', () => {
    const result = forAssignee(items, 'person-alex')
    expect(result).toHaveLength(2)
    expect(result.every((i) => i.assignee === 'person-alex')).toBe(true)
  })

  it('returns empty array when no items match', () => {
    const result = forAssignee(items, 'person-nobody')
    expect(result).toHaveLength(0)
  })

  it('returns all items when all match', () => {
    const alexItems = items.filter((i) => i.assignee === 'person-alex')
    const result = forAssignee(alexItems, 'person-alex')
    expect(result).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    const result = forAssignee([], 'person-alex')
    expect(result).toHaveLength(0)
  })

  it('does not mutate the input array', () => {
    const copy = [...items]
    forAssignee(items, 'person-alex')
    expect(items).toEqual(copy)
  })

  it('includes items of any status (not filtered by status)', () => {
    const mixed: LifecycleItem[] = [
      makeItem({ assignee: 'person-alex', status: 'pending' }),
      makeItem({ assignee: 'person-alex', status: 'claimed' }),
      makeItem({ assignee: 'person-alex', status: 'completed' }),
    ]
    const result = forAssignee(mixed, 'person-alex')
    expect(result).toHaveLength(3)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 11. sortByPriorityThenSLA
// ─────────────────────────────────────────────────────────────────────────────

describe('sortByPriorityThenSLA', () => {
  function makeWithPriorityAndSLA(
    priority: LifecyclePriority,
    slaDeadline: Date,
    id?: string
  ): LifecycleItem {
    return makeItem({
      priority,
      slaDeadline,
      id: id ?? `sort-${priority}-${slaDeadline.toISOString()}`,
    })
  }

  it('sorts critical before high before normal before low', () => {
    const items: LifecycleItem[] = [
      makeWithPriorityAndSLA('low', SLA_FAR),
      makeWithPriorityAndSLA('critical', SLA_FAR),
      makeWithPriorityAndSLA('normal', SLA_FAR),
      makeWithPriorityAndSLA('high', SLA_FAR),
    ]
    const sorted = sortByPriorityThenSLA(items, NOW)
    expect(sorted[0].priority).toBe('critical')
    expect(sorted[1].priority).toBe('high')
    expect(sorted[2].priority).toBe('normal')
    expect(sorted[3].priority).toBe('low')
  })

  it('within same priority, sorts closer SLA deadline first', () => {
    const sla1h = new Date(NOW.getTime() + 1 * 3600 * 1000)
    const sla4h = new Date(NOW.getTime() + 4 * 3600 * 1000)
    const sla8h = new Date(NOW.getTime() + 8 * 3600 * 1000)

    const items: LifecycleItem[] = [
      makeWithPriorityAndSLA('high', sla8h, 'sort-h-8h'),
      makeWithPriorityAndSLA('high', sla1h, 'sort-h-1h'),
      makeWithPriorityAndSLA('high', sla4h, 'sort-h-4h'),
    ]
    const sorted = sortByPriorityThenSLA(items, NOW)
    expect(sorted[0].id).toBe('sort-h-1h')
    expect(sorted[1].id).toBe('sort-h-4h')
    expect(sorted[2].id).toBe('sort-h-8h')
  })

  it('priority ordering supersedes SLA proximity', () => {
    const sla1h = new Date(NOW.getTime() + 1 * 3600 * 1000)
    const sla8h = new Date(NOW.getTime() + 8 * 3600 * 1000)

    const items: LifecycleItem[] = [
      makeWithPriorityAndSLA('normal', sla1h, 'normal-near'),
      makeWithPriorityAndSLA('high', sla8h, 'high-far'),
    ]
    const sorted = sortByPriorityThenSLA(items, NOW)
    expect(sorted[0].id).toBe('high-far')
    expect(sorted[1].id).toBe('normal-near')
  })

  it('returns empty array for empty input', () => {
    expect(sortByPriorityThenSLA([], NOW)).toHaveLength(0)
  })

  it('does not mutate the input array', () => {
    const items: LifecycleItem[] = [
      makeWithPriorityAndSLA('low', SLA_FAR),
      makeWithPriorityAndSLA('critical', SLA_NEAR),
    ]
    const original = [...items]
    sortByPriorityThenSLA(items, NOW)
    expect(items[0].priority).toBe(original[0].priority)
    expect(items[1].priority).toBe(original[1].priority)
  })

  it('handles a mix of priorities and SLA values correctly', () => {
    const sla1h = new Date(NOW.getTime() + 1 * 3600 * 1000)
    const sla2h = new Date(NOW.getTime() + 2 * 3600 * 1000)
    const sla6h = new Date(NOW.getTime() + 6 * 3600 * 1000)
    const sla12h = new Date(NOW.getTime() + 12 * 3600 * 1000)

    const items: LifecycleItem[] = [
      makeWithPriorityAndSLA('normal', sla12h, 'n-12h'),
      makeWithPriorityAndSLA('critical', sla2h, 'c-2h'),
      makeWithPriorityAndSLA('high', sla6h, 'h-6h'),
      makeWithPriorityAndSLA('critical', sla1h, 'c-1h'),
      makeWithPriorityAndSLA('low', sla12h, 'l-12h'),
      makeWithPriorityAndSLA('high', sla2h, 'h-2h'),
    ]
    const sorted = sortByPriorityThenSLA(items, NOW)
    // Expected order: c-1h, c-2h, h-2h, h-6h, n-12h, l-12h
    expect(sorted[0].id).toBe('c-1h')
    expect(sorted[1].id).toBe('c-2h')
    expect(sorted[2].id).toBe('h-2h')
    expect(sorted[3].id).toBe('h-6h')
    expect(sorted[4].id).toBe('n-12h')
    expect(sorted[5].id).toBe('l-12h')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 12. isBreached / timeToDeadline helpers
// ─────────────────────────────────────────────────────────────────────────────

describe('isBreached', () => {
  it('returns false when SLA deadline is in the future', () => {
    const item = makeItem({ slaDeadline: new Date(NOW.getTime() + 1000) })
    expect(isBreached(item, NOW)).toBe(false)
  })

  it('returns true when SLA deadline is in the past', () => {
    const item = makeItem({ slaDeadline: new Date(NOW.getTime() - 1000) })
    expect(isBreached(item, NOW)).toBe(true)
  })
})

describe('timeToDeadline', () => {
  it('returns positive ms when deadline is in the future', () => {
    const item = makeItem({ slaDeadline: new Date(NOW.getTime() + 5000) })
    expect(timeToDeadline(item, NOW)).toBe(5000)
  })

  it('returns negative ms when deadline has passed', () => {
    const item = makeItem({ slaDeadline: new Date(NOW.getTime() - 3000) })
    expect(timeToDeadline(item, NOW)).toBe(-3000)
  })
})
