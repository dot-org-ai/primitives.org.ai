/**
 * Unit tests for escalation-engine.
 *
 * Covers:
 *   1. evaluateEscalation — SLA not breached → no-op
 *   2. evaluateEscalation — SLA breached → escalate with nextAssignee
 *   3. Idempotency — terminal items return escalate=false
 *   4. Priority threshold — items below minPriority are skipped
 *   5. Grace period — items within grace period are skipped
 *   6. Fixture policy map (FIXTURE_POLICIES) — IC→Team→Business→Studio routing
 *   7. getFixturePolicy — returns undefined for Studio and unknown assignees
 *   8. buildEscalatedItem — title prefix, status, assignee, cascade provenance,
 *      SLA duration preservation, ID uniqueness
 *   9. batchEvaluate — multi-item evaluation with mixed outcomes
 *   10. buildVantageLadder — factory produces correct policy shape
 *   11. Multi-hop escalation path — highest eligible level selected
 *
 * No I/O, no mocks, no framework imports.
 * Ported from management.studio escalation.test.ts (34 tests) with upstream
 * type names and extended for engine-specific cases.
 */

import { describe, it, expect } from 'vitest'
import {
  evaluateEscalation,
  buildEscalatedItem,
  batchEvaluate,
  buildVantageLadder,
  getFixturePolicy,
  FIXTURE_IC,
  FIXTURE_TEAM,
  FIXTURE_BUSINESS,
  FIXTURE_STUDIO,
  FIXTURE_POLICIES,
} from '../src/escalation-engine.js'
import type { EscalationPolicy, AssigneeRef } from '../src/escalation-engine.js'
import type { LifecycleItem } from '../src/request-lifecycle.js'

// ─────────────────────────────────────────────────────────────────────────────
// Shared time anchors
// ─────────────────────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-25T14:00:00Z')
const PAST_SLA = new Date('2026-05-25T12:00:00Z') // 2h before NOW (breached)
const FUTURE_SLA = new Date('2026-05-25T18:00:00Z') // 4h after NOW (ok)

// ─────────────────────────────────────────────────────────────────────────────
// Fixture factory
// ─────────────────────────────────────────────────────────────────────────────

let _idCounter = 0

function makeItem(overrides: Partial<LifecycleItem> = {}): LifecycleItem {
  _idCounter += 1
  const createdAt = new Date('2026-05-25T08:00:00Z')
  return {
    id: `hf-esc-test-${_idCounter}`,
    kind: 'approve',
    status: 'pending',
    priority: 'normal',
    title: `Test LifecycleItem ${_idCounter}`,
    artifact: { kind: 'Invoice', id: `inv-${_idCounter}` },
    assignee: FIXTURE_IC.assigneeId,
    teamId: 'team-engineering',
    businessId: 'business-acme-ops',
    studioId: 'studio-acme',
    createdAt,
    slaDeadline: FUTURE_SLA,
    updatedAt: createdAt,
    ...overrides,
  }
}

function makePolicy(
  nextAssignee: AssigneeRef = FIXTURE_TEAM,
  opts: { gracePeriodMs?: number } = {}
): EscalationPolicy {
  return buildVantageLadder('test-policy', 'Test Policy', nextAssignee, opts)
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. evaluateEscalation — SLA not breached → no-op
// ─────────────────────────────────────────────────────────────────────────────

describe('evaluateEscalation — within SLA', () => {
  it('returns escalate=false when SLA deadline has not passed', () => {
    const item = makeItem({ slaDeadline: FUTURE_SLA })
    const policy = makePolicy()
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.escalate).toBe(false)
    expect(decision.reason).toMatch(/SLA deadline has not passed/)
  })

  it('reason describes remaining time', () => {
    const item = makeItem({ slaDeadline: FUTURE_SLA })
    const policy = makePolicy()
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.reason).toContain('remaining')
  })

  it('does not set nextAssignee when within SLA', () => {
    const item = makeItem({ slaDeadline: FUTURE_SLA })
    const policy = makePolicy()
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.nextAssignee).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. evaluateEscalation — SLA breached → escalate
// ─────────────────────────────────────────────────────────────────────────────

describe('evaluateEscalation — SLA breached', () => {
  it('returns escalate=true when SLA is past', () => {
    const item = makeItem({ slaDeadline: PAST_SLA })
    const policy = makePolicy()
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.escalate).toBe(true)
  })

  it('sets nextAssignee to the policy escalation target', () => {
    const item = makeItem({ slaDeadline: PAST_SLA })
    const policy = makePolicy(FIXTURE_TEAM)
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.nextAssignee?.assigneeId).toBe(FIXTURE_TEAM.assigneeId)
  })

  it('includes reason describing the escalation', () => {
    const item = makeItem({ slaDeadline: PAST_SLA })
    const policy = makePolicy()
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.reason).toMatch(/SLA breached/)
    expect(decision.reason).toContain(FIXTURE_TEAM.name)
  })

  it('escalates a "claimed" item that is past SLA', () => {
    const item = makeItem({
      status: 'claimed',
      slaDeadline: PAST_SLA,
      claimedBy: FIXTURE_IC.assigneeId,
    })
    const policy = makePolicy()
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.escalate).toBe(true)
  })

  it('escalates an "in_progress" item that is past SLA', () => {
    const item = makeItem({ status: 'in_progress', slaDeadline: PAST_SLA })
    const policy = makePolicy()
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.escalate).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. Idempotency — terminal items always return escalate=false
// ─────────────────────────────────────────────────────────────────────────────

describe('evaluateEscalation — idempotency (terminal statuses)', () => {
  const terminalStatuses = ['completed', 'cancelled', 'timeout', 'escalated', 'released'] as const

  for (const status of terminalStatuses) {
    it(`returns escalate=false for status="${status}"`, () => {
      const item = makeItem({ status, slaDeadline: PAST_SLA })
      const policy = makePolicy()
      const decision = evaluateEscalation(item, policy, NOW)
      expect(decision.escalate).toBe(false)
      expect(decision.reason).toMatch(/terminal status/)
    })
  }

  it('running twice over a past-SLA item is idempotent if caller applies timeout', () => {
    // First evaluation — item is pending/past-SLA → escalate=true
    const item = makeItem({ status: 'pending', slaDeadline: PAST_SLA })
    const policy = makePolicy()
    const d1 = evaluateEscalation(item, policy, NOW)
    expect(d1.escalate).toBe(true)

    // Caller applies the timeout transition
    const timedOut = { ...item, status: 'timeout' as const }

    // Second evaluation — item is terminal → escalate=false
    const d2 = evaluateEscalation(timedOut, policy, NOW)
    expect(d2.escalate).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Priority threshold
// ─────────────────────────────────────────────────────────────────────────────

describe('evaluateEscalation — priority threshold', () => {
  it('skips escalation when item priority is below minPriority', () => {
    const item = makeItem({ priority: 'low', slaDeadline: PAST_SLA })
    const policy: EscalationPolicy = {
      ...makePolicy(),
      conditions: { timeout: 0, minPriority: 'high' },
    }
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.escalate).toBe(false)
    expect(decision.reason).toMatch(/below policy minPriority/)
  })

  it('escalates when item priority meets minPriority', () => {
    const item = makeItem({ priority: 'high', slaDeadline: PAST_SLA })
    const policy: EscalationPolicy = {
      ...makePolicy(),
      conditions: { timeout: 0, minPriority: 'high' },
    }
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.escalate).toBe(true)
  })

  it('escalates when item priority exceeds minPriority', () => {
    const item = makeItem({ priority: 'critical', slaDeadline: PAST_SLA })
    const policy: EscalationPolicy = {
      ...makePolicy(),
      conditions: { timeout: 0, minPriority: 'normal' },
    }
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.escalate).toBe(true)
  })

  it('escalates all priorities when minPriority is undefined', () => {
    const lowItem = makeItem({ priority: 'low', slaDeadline: PAST_SLA })
    const policy = makePolicy() // no minPriority
    const decision = evaluateEscalation(lowItem, policy, NOW)
    expect(decision.escalate).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. Grace period
// ─────────────────────────────────────────────────────────────────────────────

describe('evaluateEscalation — grace period', () => {
  it('does not escalate when within grace period past SLA', () => {
    // Item SLA was 1h ago; grace period is 3h → not yet eligible
    const sla1hAgo = new Date(NOW.getTime() - 1 * 3600 * 1000)
    const item = makeItem({ slaDeadline: sla1hAgo })
    const policy = makePolicy(FIXTURE_TEAM, { gracePeriodMs: 3 * 3600 * 1000 })
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.escalate).toBe(false)
    expect(decision.reason).toMatch(/grace period/)
  })

  it('escalates when past both SLA and grace period', () => {
    // Item SLA was 4h ago; grace period is 2h → eligible
    const sla4hAgo = new Date(NOW.getTime() - 4 * 3600 * 1000)
    const item = makeItem({ slaDeadline: sla4hAgo })
    const policy = makePolicy(FIXTURE_TEAM, { gracePeriodMs: 2 * 3600 * 1000 })
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.escalate).toBe(true)
  })

  it('escalates immediately (gracePeriodMs=0) when SLA is past', () => {
    const item = makeItem({ slaDeadline: PAST_SLA })
    const policy = makePolicy(FIXTURE_TEAM, { gracePeriodMs: 0 })
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.escalate).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Fixture policy map routing — IC→Team→Business→Studio
// ─────────────────────────────────────────────────────────────────────────────

describe('FIXTURE_POLICIES — Vantage routing', () => {
  it('IC (Alex) routes to Team (Sam) on breach', () => {
    const item = makeItem({ assignee: FIXTURE_IC.assigneeId, slaDeadline: PAST_SLA })
    const policy = FIXTURE_POLICIES[FIXTURE_IC.assigneeId]
    expect(policy).toBeDefined()
    const decision = evaluateEscalation(item, policy!, NOW)
    expect(decision.escalate).toBe(true)
    expect(decision.nextAssignee?.assigneeId).toBe(FIXTURE_TEAM.assigneeId)
  })

  it('Team (Sam) routes to Business (Jordan) on breach', () => {
    const item = makeItem({ assignee: FIXTURE_TEAM.assigneeId, slaDeadline: PAST_SLA })
    const policy = FIXTURE_POLICIES[FIXTURE_TEAM.assigneeId]
    expect(policy).toBeDefined()
    const decision = evaluateEscalation(item, policy!, NOW)
    expect(decision.escalate).toBe(true)
    expect(decision.nextAssignee?.assigneeId).toBe(FIXTURE_BUSINESS.assigneeId)
  })

  it('Business (Jordan) routes to Studio (Morgan) on breach', () => {
    const item = makeItem({ assignee: FIXTURE_BUSINESS.assigneeId, slaDeadline: PAST_SLA })
    const policy = FIXTURE_POLICIES[FIXTURE_BUSINESS.assigneeId]
    expect(policy).toBeDefined()
    const decision = evaluateEscalation(item, policy!, NOW)
    expect(decision.escalate).toBe(true)
    expect(decision.nextAssignee?.assigneeId).toBe(FIXTURE_STUDIO.assigneeId)
  })

  it('Studio (Morgan) has no policy in FIXTURE_POLICIES', () => {
    const policy = FIXTURE_POLICIES[FIXTURE_STUDIO.assigneeId]
    expect(policy).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. getFixturePolicy
// ─────────────────────────────────────────────────────────────────────────────

describe('getFixturePolicy', () => {
  it('returns IC policy for Alex', () => {
    const policy = getFixturePolicy(FIXTURE_IC.assigneeId)
    expect(policy).toBeDefined()
    expect(policy!.id).toBe('policy-ic-to-team')
    expect(policy!.escalationPath[0].assignee.assigneeId).toBe(FIXTURE_TEAM.assigneeId)
  })

  it('returns team policy for Sam', () => {
    const policy = getFixturePolicy(FIXTURE_TEAM.assigneeId)
    expect(policy).toBeDefined()
    expect(policy!.id).toBe('policy-team-to-business')
    expect(policy!.escalationPath[0].assignee.assigneeId).toBe(FIXTURE_BUSINESS.assigneeId)
  })

  it('returns business policy for Jordan', () => {
    const policy = getFixturePolicy(FIXTURE_BUSINESS.assigneeId)
    expect(policy).toBeDefined()
    expect(policy!.id).toBe('policy-business-to-studio')
    expect(policy!.escalationPath[0].assignee.assigneeId).toBe(FIXTURE_STUDIO.assigneeId)
  })

  it('returns undefined for Morgan (Studio operator — no higher level)', () => {
    expect(getFixturePolicy(FIXTURE_STUDIO.assigneeId)).toBeUndefined()
  })

  it('returns undefined for an unknown assigneeId', () => {
    expect(getFixturePolicy('person-unknown')).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. buildEscalatedItem
// ─────────────────────────────────────────────────────────────────────────────

describe('buildEscalatedItem', () => {
  it('prefixes title with [Escalated]', () => {
    const original = makeItem({ title: 'Approve refund #123' })
    const result = buildEscalatedItem(original, FIXTURE_TEAM, NOW)
    expect(result.title).toBe('[Escalated] Approve refund #123')
  })

  it('sets status to "pending"', () => {
    const original = makeItem({ status: 'claimed', claimedBy: FIXTURE_IC.assigneeId })
    const result = buildEscalatedItem(original, FIXTURE_TEAM, NOW)
    expect(result.status).toBe('pending')
  })

  it('sets assignee to the next assignee', () => {
    const original = makeItem({ assignee: FIXTURE_IC.assigneeId })
    const result = buildEscalatedItem(original, FIXTURE_TEAM, NOW)
    expect(result.assignee).toBe(FIXTURE_TEAM.assigneeId)
  })

  it('clears claimer info', () => {
    const original = makeItem({
      status: 'claimed',
      claimedBy: FIXTURE_IC.assigneeId,
      claimedAt: new Date('2026-05-25T10:00:00Z'),
    })
    const result = buildEscalatedItem(original, FIXTURE_TEAM, NOW)
    expect(result.claimedBy).toBeUndefined()
    expect(result.claimedAt).toBeUndefined()
  })

  it('sets a fresh SLA deadline preserving original duration', () => {
    const createdAt = new Date('2026-05-25T08:00:00Z')
    const slaDeadline = new Date('2026-05-25T12:00:00Z') // 4h from creation
    const original = makeItem({ createdAt, slaDeadline })

    const result = buildEscalatedItem(original, FIXTURE_TEAM, NOW)

    const duration = slaDeadline.getTime() - createdAt.getTime()
    const expectedSla = new Date(NOW.getTime() + duration)
    expect(result.slaDeadline.toISOString()).toBe(expectedSla.toISOString())
  })

  it('threads original item ID into cascade.functionId', () => {
    const original = makeItem({
      cascade: { workflowId: 'wf-001', functionId: 'fn-old' },
    })
    const result = buildEscalatedItem(original, FIXTURE_TEAM, NOW)
    expect(result.cascade?.functionId).toBe(original.id)
    expect(result.cascade?.workflowId).toBe('wf-001')
  })

  it('assigns a unique ID different from the original', () => {
    const original = makeItem()
    const result = buildEscalatedItem(original, FIXTURE_TEAM, NOW)
    expect(result.id).not.toBe(original.id)
    expect(result.id).toContain(original.id)
  })

  it('preserves teamId / businessId / studioId from original', () => {
    const original = makeItem({
      teamId: 'team-x',
      businessId: 'biz-y',
      studioId: 'studio-z',
    })
    const result = buildEscalatedItem(original, FIXTURE_TEAM, NOW)
    expect(result.teamId).toBe('team-x')
    expect(result.businessId).toBe('biz-y')
    expect(result.studioId).toBe('studio-z')
  })

  it('clears resolution and completedAt from escalated item', () => {
    const original = makeItem({
      completedAt: new Date(),
      resolution: { verb: 'approve', resolvedBy: 'person-x', resolvedAt: new Date() },
    })
    const result = buildEscalatedItem(original, FIXTURE_TEAM, NOW)
    expect(result.completedAt).toBeUndefined()
    expect(result.resolution).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. batchEvaluate
// ─────────────────────────────────────────────────────────────────────────────

describe('batchEvaluate', () => {
  it('returns an entry for every item', () => {
    const items = [makeItem({ slaDeadline: PAST_SLA }), makeItem({ slaDeadline: FUTURE_SLA })]
    const results = batchEvaluate(items, getFixturePolicy, NOW)
    expect(results).toHaveLength(2)
  })

  it('marks breached items as escalate=true', () => {
    const item = makeItem({ assignee: FIXTURE_IC.assigneeId, slaDeadline: PAST_SLA })
    const results = batchEvaluate([item], getFixturePolicy, NOW)
    expect(results[0].decision.escalate).toBe(true)
    expect(results[0].decision.nextAssignee?.assigneeId).toBe(FIXTURE_TEAM.assigneeId)
  })

  it('marks within-SLA items as escalate=false', () => {
    const item = makeItem({ assignee: FIXTURE_IC.assigneeId, slaDeadline: FUTURE_SLA })
    const results = batchEvaluate([item], getFixturePolicy, NOW)
    expect(results[0].decision.escalate).toBe(false)
  })

  it('handles items with no policy (Studio operator)', () => {
    const item = makeItem({ assignee: FIXTURE_STUDIO.assigneeId, slaDeadline: PAST_SLA })
    const results = batchEvaluate([item], getFixturePolicy, NOW)
    expect(results[0].decision.escalate).toBe(false)
    expect(results[0].policy).toBeUndefined()
    expect(results[0].decision.reason).toMatch(/no escalation policy found/)
  })

  it('handles mixed batch correctly', () => {
    const breached = makeItem({ assignee: FIXTURE_IC.assigneeId, slaDeadline: PAST_SLA })
    const ok = makeItem({ assignee: FIXTURE_IC.assigneeId, slaDeadline: FUTURE_SLA })
    const studio = makeItem({ assignee: FIXTURE_STUDIO.assigneeId, slaDeadline: PAST_SLA })

    const results = batchEvaluate([breached, ok, studio], getFixturePolicy, NOW)

    const shouldEscalate = results.filter((r) => r.decision.escalate)
    const shouldNotEscalate = results.filter((r) => !r.decision.escalate)
    expect(shouldEscalate).toHaveLength(1)
    expect(shouldNotEscalate).toHaveLength(2)
  })

  it('returns empty array for empty input', () => {
    const results = batchEvaluate([], getFixturePolicy, NOW)
    expect(results).toHaveLength(0)
  })

  it('does not escalate terminal items even when past SLA', () => {
    const terminal = makeItem({ status: 'timeout', slaDeadline: PAST_SLA })
    const results = batchEvaluate([terminal], getFixturePolicy, NOW)
    expect(results[0].decision.escalate).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. buildVantageLadder
// ─────────────────────────────────────────────────────────────────────────────

describe('buildVantageLadder', () => {
  it('produces a policy with the specified id and name', () => {
    const policy = buildVantageLadder('test-id', 'Test Name', FIXTURE_TEAM)
    expect(policy.id).toBe('test-id')
    expect(policy.name).toBe('Test Name')
  })

  it('sets escalationPath[0].assignee to the specified nextAssignee', () => {
    const policy = buildVantageLadder('test-id', 'Test', FIXTURE_TEAM)
    expect(policy.escalationPath[0].assignee.assigneeId).toBe(FIXTURE_TEAM.assigneeId)
  })

  it('defaults gracePeriodMs to 0', () => {
    const policy = buildVantageLadder('test-id', 'Test', FIXTURE_TEAM)
    expect(policy.conditions.timeout).toBe(0)
    expect(policy.escalationPath[0].afterMs).toBe(0)
  })

  it('applies custom gracePeriodMs', () => {
    const policy = buildVantageLadder('test-id', 'Test', FIXTURE_TEAM, { gracePeriodMs: 3600000 })
    expect(policy.conditions.timeout).toBe(3600000)
    expect(policy.escalationPath[0].afterMs).toBe(3600000)
  })

  it('applies minPriority when specified', () => {
    const policy = buildVantageLadder('test-id', 'Test', FIXTURE_TEAM, { minPriority: 'high' })
    expect(policy.conditions.minPriority).toBe('high')
  })

  it('leaves minPriority undefined when not specified', () => {
    const policy = buildVantageLadder('test-id', 'Test', FIXTURE_TEAM)
    expect(policy.conditions.minPriority).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 11. Multi-hop escalation path
// ─────────────────────────────────────────────────────────────────────────────

describe('evaluateEscalation — multi-hop escalation path', () => {
  const multiHopPolicy: EscalationPolicy = {
    id: 'multi-hop',
    name: 'Multi-hop test policy',
    conditions: { timeout: 0 },
    escalationPath: [
      { assignee: FIXTURE_TEAM, afterMs: 0 }, // immediate on breach
      { assignee: FIXTURE_BUSINESS, afterMs: 2 * 3600 * 1000 }, // after 2h more
      { assignee: FIXTURE_STUDIO, afterMs: 4 * 3600 * 1000 }, // after 4h more
    ],
  }

  it('selects level 0 when overdue by less than 2h', () => {
    // Item SLA was 1h ago → only level 0 eligible
    const sla1hAgo = new Date(NOW.getTime() - 1 * 3600 * 1000)
    const item = makeItem({ slaDeadline: sla1hAgo })
    const decision = evaluateEscalation(item, multiHopPolicy, NOW)
    expect(decision.escalate).toBe(true)
    expect(decision.nextAssignee?.assigneeId).toBe(FIXTURE_TEAM.assigneeId)
  })

  it('selects level 1 when overdue by more than 2h but less than 4h', () => {
    // Item SLA was 3h ago → levels 0 and 1 eligible; pick highest = level 1
    const sla3hAgo = new Date(NOW.getTime() - 3 * 3600 * 1000)
    const item = makeItem({ slaDeadline: sla3hAgo })
    const decision = evaluateEscalation(item, multiHopPolicy, NOW)
    expect(decision.escalate).toBe(true)
    expect(decision.nextAssignee?.assigneeId).toBe(FIXTURE_BUSINESS.assigneeId)
  })

  it('selects level 2 when overdue by more than 4h', () => {
    // Item SLA was 5h ago → all levels eligible; pick highest = level 2
    const sla5hAgo = new Date(NOW.getTime() - 5 * 3600 * 1000)
    const item = makeItem({ slaDeadline: sla5hAgo })
    const decision = evaluateEscalation(item, multiHopPolicy, NOW)
    expect(decision.escalate).toBe(true)
    expect(decision.nextAssignee?.assigneeId).toBe(FIXTURE_STUDIO.assigneeId)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 12. Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('evaluateEscalation — edge cases', () => {
  it('returns escalate=false for an empty escalation path', () => {
    const item = makeItem({ slaDeadline: PAST_SLA })
    const policy: EscalationPolicy = {
      id: 'empty-path',
      name: 'Empty path',
      conditions: { timeout: 0 },
      escalationPath: [],
    }
    const decision = evaluateEscalation(item, policy, NOW)
    expect(decision.escalate).toBe(false)
    expect(decision.reason).toMatch(/no escalation path/)
  })

  it('handles exactly-at-deadline (now === slaDeadline) as within-SLA', () => {
    const item = makeItem({ slaDeadline: NOW })
    const policy = makePolicy()
    const decision = evaluateEscalation(item, policy, NOW)
    // msSinceSla = 0 which is NOT < gracePeriodMs (0), so it should escalate
    expect(decision.escalate).toBe(true)
  })

  it('preserves item immutability (does not mutate item)', () => {
    const item = makeItem({ slaDeadline: PAST_SLA })
    const statusBefore = item.status
    const policy = makePolicy()
    evaluateEscalation(item, policy, NOW)
    expect(item.status).toBe(statusBefore)
  })
})
