/**
 * Tests for the ClickHouse-backed experiment storage.
 *
 * Uses an in-memory fake `ClickHouseHttpFetcher` that interprets the SQL
 * the storage layer (and the underlying canonical CH adapter) emits.
 * No real ClickHouse instance is required.
 *
 * Coverage:
 * - Track event → SVO Action shape (verb / subject / object / data)
 * - storeResult / storeResults (single + bulk via commitBatch)
 * - getVariantStats / getBestVariant (analyticsQuery against actions)
 * - getEvents (round-trip via analyticsQuery)
 * - close() is a no-op
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { ClickHouseHttpFetcher } from 'ai-database'
import {
  ClickHouseExperimentStorage,
  createClickHouseExperimentStorage,
  ChdbStorage,
  createChdbBackend,
} from '../src/clickhouse-storage.js'
import type { ExperimentResult, TrackingEvent } from '../src/types.js'

interface ActionRow {
  ns: string
  id: string
  verb: string
  subject: string
  object: string
  roles: Record<string, string>
  data: Record<string, unknown>
  status: string
  created_at: string
  completed_at: string | null
}

function jsonResp<T>(rows: T[]): string {
  return JSON.stringify({ data: rows, rows: rows.length })
}

/**
 * Minimal fake fetcher that handles INSERT INTO actions (JSONEachRow) and
 * the analytical SELECTs the storage layer emits. Aggregations are
 * computed in JS — the SQL is parsed enough to detect the query family
 * (verb/subject filters, dimension extraction, aggregation choice).
 */
function makeFakeFetcher(): {
  fetcher: ClickHouseHttpFetcher
  actions: Map<string, ActionRow>
  log: Array<{ sql: string; body?: string }>
} {
  const actions = new Map<string, ActionRow>()
  const log: Array<{ sql: string; body?: string }> = []

  const fetcher: ClickHouseHttpFetcher = async (sql: string, body?: string) => {
    log.push(body !== undefined ? { sql, body } : { sql })
    const trimmed = sql.trim()
    const head = trimmed.split(/\s+/)[0]?.toUpperCase()

    if (head === 'INSERT' && body && /INTO\s+\w+\.actions/i.test(trimmed)) {
      const lines = body.split('\n').filter((l) => l.trim().length > 0)
      for (const line of lines) {
        const r = JSON.parse(line) as ActionRow & { data: string; roles: string }
        const data: Record<string, unknown> =
          typeof r.data === 'string' ? JSON.parse(r.data) : (r.data as Record<string, unknown>)
        const roles: Record<string, string> =
          typeof r.roles === 'string' ? JSON.parse(r.roles) : (r.roles as Record<string, string>)
        actions.set(r.id, {
          ns: r.ns,
          id: r.id,
          verb: r.verb,
          subject: r.subject,
          object: r.object,
          roles,
          data,
          status: r.status,
          created_at: r.created_at,
          completed_at: r.completed_at,
        })
      }
      return ''
    }

    // CREATE DATABASE / TABLE — no-op
    if (head === 'CREATE') return ''

    if (head === 'SELECT') {
      const ns = matchEq(trimmed, 'ns') ?? ''
      const subject = matchEq(trimmed, 'subject')
      const verb = matchEq(trimmed, 'verb') ?? ''
      const filtered = [...actions.values()].filter((a) => {
        if (a.ns !== ns) return false
        if (verb && a.verb !== verb) return false
        if (subject !== undefined && a.subject !== subject) return false
        return true
      })

      // getEvents: SELECT verb, created_at, data FROM actions ...
      if (/verb\s+AS\s+eventType/i.test(trimmed)) {
        const limitM = trimmed.match(/LIMIT\s+(\d+)/i)
        const limit = limitM ? Number(limitM[1]) : 100
        const variantId = matchEqExclusive(trimmed, 'object')
        const eventTypeFilter = verb || matchEq(trimmed, 'verb')
        const out = filtered
          .filter((a) => (variantId ? a.object === variantId : true))
          .filter((a) => (eventTypeFilter ? a.verb === eventTypeFilter : true))
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
          .slice(0, limit)
          .map((a) => ({
            eventType: a.verb,
            createdAt: a.created_at,
            data: JSON.stringify(a.data),
          }))
        return jsonResp(out)
      }

      // getExperiments: GROUP BY subject
      if (/GROUP\s+BY\s+subject/i.test(trimmed)) {
        const groups = new Map<string, ActionRow[]>()
        for (const a of filtered) {
          const list = groups.get(a.subject) ?? []
          list.push(a)
          groups.set(a.subject, list)
        }
        const out: Array<Record<string, unknown>> = []
        for (const [exp, rows] of groups) {
          if (!exp) continue
          const variants = new Set(rows.map((r) => r.object))
          const expName = String(rows[0]?.data['experimentName'] ?? '')
          const sorted = [...rows].sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
          out.push({
            experimentId: exp,
            experimentName: expName,
            variantCount: variants.size,
            runCount: rows.length,
            firstRun: sorted[0]?.created_at ?? '',
            lastRun: sorted[sorted.length - 1]?.created_at ?? '',
          })
        }
        out.sort((a, b) =>
          String(a['lastRun']) < String(b['lastRun'])
            ? 1
            : String(a['lastRun']) > String(b['lastRun'])
            ? -1
            : 0
        )
        return jsonResp(out)
      }

      // getVariantStats / getBestVariant: GROUP BY object
      if (/GROUP\s+BY\s+object/i.test(trimmed)) {
        const groups = new Map<string, ActionRow[]>()
        for (const a of filtered) {
          const list = groups.get(a.object) ?? []
          list.push(a)
          groups.set(a.object, list)
        }
        const rowsAgg: Array<Record<string, unknown>> = []
        for (const [variantId, list] of groups) {
          const successCount = list.filter(
            (a) => Number((a.data as Record<string, unknown>)['success'] ?? 0) === 1
          ).length
          const total = list.length
          const sumDur = list.reduce(
            (s, a) => s + Number((a.data as Record<string, unknown>)['durationMs'] ?? 0),
            0
          )
          const sumMet = list.reduce(
            (s, a) => s + Number((a.data as Record<string, unknown>)['metricValue'] ?? 0),
            0
          )
          const metValues = list.map((a) =>
            Number((a.data as Record<string, unknown>)['metricValue'] ?? 0)
          )
          const variantName = String((list[0]?.data ?? {})['variantName'] ?? '')
          const successRate = total === 0 ? 0 : successCount / total
          const avgMetric = total === 0 ? 0 : sumMet / total
          const avgDuration = total === 0 ? 0 : sumDur / total
          // getBestVariant uses `metricValue AS metricValue`
          if (/metricValue\s*$|metricValue,\s*$/m.test(trimmed) === false) {
            // distinguishing handled by output column shape below
          }
          rowsAgg.push({
            variantId,
            variantName,
            runCount: total,
            successCount,
            successRate,
            avgDuration,
            avgMetric,
            minMetric: metValues.length ? Math.min(...metValues) : 0,
            maxMetric: metValues.length ? Math.max(...metValues) : 0,
            // getBestVariant: column literally named `metricValue`
            metricValue:
              /successRate/i.test(trimmed) && /AS\s+metricValue/i.test(trimmed)
                ? successRate
                : /avg\(JSONExtractFloat\(data,\s*'durationMs'\)\)\s+AS\s+metricValue/i.test(
                    trimmed
                  )
                ? avgDuration
                : avgMetric,
          })
        }
        // Best-variant: HAVING + ORDER BY + LIMIT 1
        if (/LIMIT\s+1\b/i.test(trimmed) && /HAVING/i.test(trimmed)) {
          const havingM = trimmed.match(/runCount\s*>=\s*(\d+)/i)
          const min = havingM ? Number(havingM[1]) : 1
          const filteredRows = rowsAgg.filter((r) => Number(r['runCount']) >= min)
          const orderAsc = /ORDER\s+BY\s+metricValue\s+ASC/i.test(trimmed)
          filteredRows.sort((a, b) =>
            orderAsc
              ? Number(a['metricValue']) - Number(b['metricValue'])
              : Number(b['metricValue']) - Number(a['metricValue'])
          )
          return jsonResp(filteredRows.slice(0, 1))
        }
        rowsAgg.sort((a, b) => Number(b['avgMetric']) - Number(a['avgMetric']))
        return jsonResp(rowsAgg)
      }

      // getCartesianAnalysis / getCartesianGrid / getTimeSeries — return
      // empty for these tests; aggregation logic is exercised by the SQL
      // builder (it emits shape-correct queries) and the action-write path
      // is verified above.
      return jsonResp([])
    }

    return ''
  }

  return { fetcher, actions, log }
}

function matchEq(sql: string, column: string): string | undefined {
  const escaped = column.replace(/[.]/g, '\\.')
  const re = new RegExp(`(?<![a-zA-Z_.])${escaped}\\s*=\\s*'([^']*)'`)
  const m = sql.match(re)
  return m?.[1]
}

function matchEqExclusive(sql: string, column: string): string | undefined {
  // Same as matchEq but explicitly typed for clarity
  return matchEq(sql, column)
}

describe('ClickHouseExperimentStorage', () => {
  let fake: ReturnType<typeof makeFakeFetcher>
  let storage: ClickHouseExperimentStorage

  beforeEach(() => {
    fake = makeFakeFetcher()
    storage = createClickHouseExperimentStorage({
      fetcher: fake.fetcher,
      database: 'aidb',
      namespace: 'experiments',
    })
  })

  it('records track() events as SVO Actions', async () => {
    const event: TrackingEvent = {
      type: 'variant.complete',
      timestamp: new Date('2026-05-05T10:00:00.000Z'),
      data: {
        experimentId: 'exp-1',
        experimentName: 'Greeting',
        variantId: 'v1',
        variantName: 'Formal',
        runId: 'run-1',
        success: true,
        duration: 100,
        metricValue: 0.5,
        metricName: 'wordCount',
        dimensions: { temperature: 0.7 },
      },
    }
    await storage.track(event)

    expect(fake.actions.size).toBe(1)
    const [row] = [...fake.actions.values()]
    expect(row!.verb).toBe('variant.complete')
    expect(row!.subject).toBe('exp-1')
    expect(row!.object).toBe('v1')
    expect(row!.status).toBe('completed')
    expect(row!.roles['runId']).toBe('run-1')
    expect((row!.data as Record<string, unknown>)['experimentName']).toBe('Greeting')
    expect((row!.data as Record<string, unknown>)['variantName']).toBe('Formal')
    expect((row!.data as Record<string, unknown>)['success']).toBe(1)
    expect((row!.data as Record<string, unknown>)['durationMs']).toBe(100)
    expect((row!.data as Record<string, unknown>)['metricValue']).toBe(0.5)
    expect((row!.data as Record<string, unknown>)['dimensions']).toEqual({ temperature: 0.7 })
  })

  it('marks variant.error events as failed status', async () => {
    await storage.track({
      type: 'variant.error',
      timestamp: new Date('2026-05-05T10:00:00.000Z'),
      data: {
        experimentId: 'exp-1',
        variantId: 'v1',
        success: false,
        error: new Error('boom'),
      },
    })

    const [row] = [...fake.actions.values()]
    expect(row!.status).toBe('failed')
    expect((row!.data as Record<string, unknown>)['errorMessage']).toBe('boom')
  })

  it('storeResult writes a variant.complete row', async () => {
    const result: ExperimentResult = {
      experimentId: 'exp-2',
      variantId: 'v1',
      variantName: 'Variant 1',
      runId: 'r-1',
      result: { value: 42 },
      metricValue: 0.9,
      duration: 150,
      startedAt: new Date('2026-05-05T10:00:00.000Z'),
      completedAt: new Date('2026-05-05T10:00:00.150Z'),
      success: true,
    }
    await storage.storeResult(result)

    expect(fake.actions.size).toBe(1)
    const [row] = [...fake.actions.values()]
    expect(row!.verb).toBe('variant.complete')
    expect(row!.subject).toBe('exp-2')
    expect(row!.object).toBe('v1')
    expect((row!.data as Record<string, unknown>)['metricValue']).toBe(0.9)
  })

  it('storeResults bulk-inserts via commitBatch (one HTTP body)', async () => {
    const base = (i: number): ExperimentResult => ({
      experimentId: 'exp-3',
      variantId: `v${i}`,
      variantName: `Variant ${i}`,
      runId: `r-${i}`,
      result: { value: i },
      metricValue: i * 0.1,
      duration: 100 + i,
      startedAt: new Date('2026-05-05T10:00:00.000Z'),
      completedAt: new Date('2026-05-05T10:00:00.000Z'),
      success: true,
    })
    await storage.storeResults([base(1), base(2), base(3)])

    expect(fake.actions.size).toBe(3)
    // commitBatch sends one INSERT with multiple JSONEachRow lines
    const inserts = fake.log.filter(
      (e) => /^INSERT/i.test(e.sql) && /INTO\s+aidb\.actions/i.test(e.sql)
    )
    expect(inserts.length).toBeGreaterThanOrEqual(1)
    const lastInsert = inserts[inserts.length - 1]!
    expect(lastInsert.body!.split('\n').filter((l) => l.length > 0)).toHaveLength(3)
  })

  it('getVariantStats aggregates across runs', async () => {
    const exp = 'exp-4'
    for (let i = 0; i < 3; i++) {
      await storage.storeResult({
        experimentId: exp,
        variantId: 'va',
        variantName: 'A',
        runId: `r-a-${i}`,
        result: {},
        metricValue: 1.0,
        duration: 100,
        startedAt: new Date(),
        completedAt: new Date(`2026-05-05T10:00:0${i}.000Z`),
        success: true,
      })
    }
    for (let i = 0; i < 2; i++) {
      await storage.storeResult({
        experimentId: exp,
        variantId: 'vb',
        variantName: 'B',
        runId: `r-b-${i}`,
        result: {},
        metricValue: 0.5,
        duration: 200,
        startedAt: new Date(),
        completedAt: new Date(`2026-05-05T10:00:0${i}.000Z`),
        success: true,
      })
    }

    const stats = await storage.getVariantStats(exp)
    expect(stats).toHaveLength(2)
    const a = stats.find((s) => s.variantId === 'va')!
    const b = stats.find((s) => s.variantId === 'vb')!
    expect(a.runCount).toBe(3)
    expect(a.successRate).toBe(1)
    expect(a.avgMetric).toBeCloseTo(1.0, 5)
    expect(b.runCount).toBe(2)
    expect(b.avgMetric).toBeCloseTo(0.5, 5)
    // Sorted by avgMetric DESC
    expect(stats[0]!.variantId).toBe('va')
  })

  it('getBestVariant returns highest-metric variant by default', async () => {
    const exp = 'exp-5'
    await storage.storeResult({
      experimentId: exp,
      variantId: 'lo',
      variantName: 'Low',
      runId: 'r-1',
      result: {},
      metricValue: 0.1,
      duration: 100,
      startedAt: new Date(),
      completedAt: new Date(),
      success: true,
    })
    await storage.storeResult({
      experimentId: exp,
      variantId: 'hi',
      variantName: 'High',
      runId: 'r-2',
      result: {},
      metricValue: 0.9,
      duration: 100,
      startedAt: new Date(),
      completedAt: new Date(),
      success: true,
    })

    const best = await storage.getBestVariant(exp)
    expect(best).not.toBeNull()
    expect(best!.variantId).toBe('hi')
    expect(best!.metricValue).toBeCloseTo(0.9, 5)
  })

  it('getEvents returns the recorded events', async () => {
    await storage.track({
      type: 'variant.complete',
      timestamp: new Date('2026-05-05T10:00:00.000Z'),
      data: { experimentId: 'exp-6', variantId: 'v1', metricValue: 0.5, success: true },
    })
    const events = await storage.getEvents('exp-6')
    expect(events).toHaveLength(1)
    expect(events[0]!.type).toBe('variant.complete')
    expect(events[0]!.data['metricValue']).toBe(0.5)
  })

  it('close() is a no-op', () => {
    expect(() => storage.close()).not.toThrow()
  })

  it('flush() resolves without error', async () => {
    await expect(storage.flush()).resolves.toBeUndefined()
  })
})

describe('Backwards-compat aliases', () => {
  it('ChdbStorage is an alias for ClickHouseExperimentStorage', () => {
    const fake = makeFakeFetcher()
    // ChdbStorage is exported as a const alias for the class
    const s = new ChdbStorage({ fetcher: fake.fetcher })
    expect(s).toBeInstanceOf(ClickHouseExperimentStorage)
  })

  it('createChdbBackend creates a ClickHouseExperimentStorage', () => {
    const fake = makeFakeFetcher()
    const s = createChdbBackend({ fetcher: fake.fetcher })
    expect(s).toBeInstanceOf(ClickHouseExperimentStorage)
  })
})
