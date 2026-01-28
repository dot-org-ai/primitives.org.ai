/**
 * Metrics - KPIs and OKRs for autonomous agents
 *
 * Track key performance indicators and objectives/key results to measure
 * agent and team performance.
 *
 * @packageDocumentation
 */

import { calculateProgressPercent } from 'org.ai'
import type { KPI, OKR, KeyResult } from './types.js'

/**
 * Create a KPI (Key Performance Indicator)
 *
 * @example
 * ```ts
 * import { kpi } from 'autonomous-agents'
 *
 * const revenueKPI = kpi({
 *   name: 'Monthly Recurring Revenue',
 *   description: 'Total MRR from subscriptions',
 *   value: 125000,
 *   target: 150000,
 *   unit: 'USD',
 *   frequency: 'monthly',
 *   trend: 'up',
 * })
 *
 * // Update the value
 * revenueKPI.update(130000)
 *
 * // Add historical data
 * revenueKPI.addHistory(125000)
 *
 * // Get progress
 * const progress = revenueKPI.getProgress() // 86.67%
 * ```
 */
export function kpi(config: {
  name: string
  description?: string
  value: number | string
  target: number | string
  unit: string
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
}): KPIInstance {
  const state: KPI = {
    id: generateKPIId(config.name),
    name: config.name,
    ...(config.description !== undefined && { description: config.description }),
    value: config.value,
    target: config.target,
    unit: config.unit,
    ...(config.frequency !== undefined && { frequency: config.frequency }),
    history: [],
  }

  return {
    ...state,
    update,
    addHistory,
    getProgress,
    getTrend,
    getHistory,
    toJSON,
  }

  /**
   * Update the current value
   */
  function update(newValue: number | string): void {
    // Store old value in history
    if (state.value !== undefined) {
      addHistory(state.value)
    }
    state.value = newValue
    state.trend = calculateTrend()
  }

  /**
   * Add a historical data point
   */
  function addHistory(value: number | string, timestamp?: Date): void {
    if (!state.history) {
      state.history = []
    }
    state.history.push({
      timestamp: timestamp || new Date(),
      value,
    })
  }

  /**
   * Get progress towards target (as percentage 0-100)
   */
  function getProgress(): number {
    if (typeof state.value === 'number' && typeof state.target === 'number') {
      return calculateProgressPercent({ current: state.value, target: state.target })
    }
    // For string values, return 0 (cannot calculate numeric progress)
    return 0
  }

  /**
   * Get trend direction
   */
  function getTrend(): 'up' | 'down' | 'stable' {
    return state.trend || calculateTrend()
  }

  /**
   * Calculate trend from history
   */
  function calculateTrend(): 'up' | 'down' | 'stable' {
    if (!state.history || state.history.length < 2) return 'stable'

    const recent = state.history.slice(-2)
    const prev = recent[0]!.value
    const curr = recent[1]!.value

    if (typeof prev === 'number' && typeof curr === 'number') {
      if (curr > prev) return 'up'
      if (curr < prev) return 'down'
    }

    return 'stable'
  }

  /**
   * Get historical data
   */
  function getHistory(): Array<{ timestamp: Date; value: number | string }> {
    return state.history || []
  }

  /**
   * Convert to plain JSON
   */
  function toJSON(): KPI {
    return { ...state }
  }
}

/**
 * KPI instance with methods
 */
export interface KPIInstance extends KPI {
  /** Update the current value */
  update(value: number | string): void
  /** Add historical data point */
  addHistory(value: number | string, timestamp?: Date): void
  /** Get progress towards target (as percentage 0-100) */
  getProgress(): number
  /** Get trend direction */
  getTrend(): 'up' | 'down' | 'stable'
  /** Get historical data */
  getHistory(): Array<{ timestamp: Date; value: number | string }>
  /** Convert to plain JSON */
  toJSON(): KPI
}

/**
 * Create multiple KPIs
 *
 * @example
 * ```ts
 * import { kpis } from 'autonomous-agents'
 *
 * const metrics = kpis([
 *   { name: 'Revenue', value: 100000, target: 150000, unit: 'USD' },
 *   { name: 'Active Users', value: 5000, target: 10000, unit: 'users' },
 *   { name: 'NPS Score', value: 72, target: 80, unit: 'points' },
 * ])
 *
 * // Access individual KPIs
 * metrics.revenue.update(110000)
 *
 * // Get all KPIs
 * const all = metrics.getAll()
 *
 * // Get progress summary
 * const summary = metrics.getSummary()
 * ```
 */
export function kpis(
  configs: Array<{
    name: string
    description?: string
    value: number | string
    target: number | string
    unit: string
    frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
  }>
): KPIsCollection {
  const kpiMap = new Map<string, KPIInstance>()

  // Create KPI instances
  configs.forEach((config) => {
    const instance = kpi(config)
    const key = config.name.toLowerCase().replace(/\s+/g, '')
    kpiMap.set(key, instance)
  })

  // Create proxy for direct access
  const proxy = new Proxy({} as Record<string, KPIInstance>, {
    get(_target, prop: string) {
      if (prop === 'getAll') return getAll
      if (prop === 'get') return get
      if (prop === 'getSummary') return getSummary
      if (prop === 'toJSON') return toJSON

      return kpiMap.get(prop)
    },
  })

  function getAll(): KPIInstance[] {
    return Array.from(kpiMap.values())
  }

  function get(name: string): KPIInstance | undefined {
    return kpiMap.get(name.toLowerCase().replace(/\s+/g, ''))
  }

  function getSummary(): {
    total: number
    onTrack: number
    atRisk: number
    averageProgress: number
  } {
    const all = getAll()
    const withTargets = all.filter((k) => k.target !== undefined)
    const onTrack = withTargets.filter((k) => {
      const progress = k.getProgress()
      return progress >= 70
    })
    const atRisk = withTargets.filter((k) => {
      const progress = k.getProgress()
      return progress < 70
    })

    const totalProgress = withTargets.reduce((sum, k) => {
      const progress = k.getProgress()
      return sum + (progress || 0)
    }, 0)

    return {
      total: all.length,
      onTrack: onTrack.length,
      atRisk: atRisk.length,
      averageProgress: withTargets.length > 0 ? totalProgress / withTargets.length : 0,
    }
  }

  function toJSON(): KPI[] {
    return getAll().map((k) => k.toJSON())
  }

  return proxy as KPIsCollection
}

/**
 * KPIs collection with dynamic access
 */
export interface KPIsCollection {
  /** Get all KPIs */
  getAll(): KPIInstance[]
  /** Get a specific KPI by name */
  get(name: string): KPIInstance | undefined
  /** Get summary of all KPIs */
  getSummary(): {
    total: number
    onTrack: number
    atRisk: number
    averageProgress: number
  }
  /** Convert all KPIs to JSON */
  toJSON(): KPI[]
  /** Dynamic access to KPIs by name */
  [key: string]: KPIInstance | ((...args: any[]) => any)
}

/**
 * Create an OKR (Objectives and Key Results)
 *
 * @example
 * ```ts
 * import { okr } from 'autonomous-agents'
 *
 * const growthOKR = okr({
 *   objective: 'Accelerate revenue growth',
 *   description: 'Drive sustainable revenue growth through product expansion and market penetration',
 *   keyResults: [
 *     {
 *       id: 'kr1',
 *       description: 'Increase MRR from $100k to $150k',
 *       current: 100000,
 *       target: 150000,
 *       unit: 'USD',
 *     },
 *     {
 *       id: 'kr2',
 *       description: 'Launch in 3 new markets',
 *       current: 0,
 *       target: 3,
 *       unit: 'markets',
 *     },
 *   ],
 *   period: 'Q1 2024',
 *   owner: 'CEO',
 * })
 *
 * // Update a key result
 * growthOKR.updateKeyResult('kr1', { current: 125000 })
 *
 * // Get overall progress
 * const progress = growthOKR.getProgress() // 58.33%
 * ```
 */
export function okr(config: {
  objective: string
  description?: string
  keyResults: KeyResult[]
  period?: string
  owner?: string
}): OKRInstance {
  const state: OKR = {
    id: generateOKRId(config.objective),
    objective: config.objective,
    ...(config.description !== undefined && { description: config.description }),
    keyResults: config.keyResults,
    ...(config.period !== undefined && { period: config.period }),
    ...(config.owner !== undefined && { owner: config.owner }),
    status: 'active',
  }

  return {
    ...state,
    updateKeyResult,
    getProgress,
    getKeyResult,
    getKeyResults,
    getStatus,
    toJSON,
  }

  /**
   * Update a key result
   */
  function updateKeyResult(keyResultId: string, updates: Partial<Omit<KeyResult, 'id'>>): void {
    const kr = state.keyResults.find((k) => k.id === keyResultId)
    if (!kr) {
      throw new Error(`Key result with id ${keyResultId} not found`)
    }
    Object.assign(kr, updates)

    // Recalculate progress
    kr.progress = calculateKeyResultProgress(kr)
    state.progress = calculateOKRProgress()
  }

  /**
   * Get overall OKR progress
   */
  function getProgress(): number {
    if (state.progress !== undefined) return state.progress
    return calculateOKRProgress()
  }

  /**
   * Calculate OKR progress from key results
   */
  function calculateOKRProgress(): number {
    if (state.keyResults.length === 0) return 0

    const totalProgress = state.keyResults.reduce((sum, kr) => {
      return sum + (kr.progress || calculateKeyResultProgress(kr))
    }, 0)

    return totalProgress / state.keyResults.length
  }

  /**
   * Get a specific key result
   */
  function getKeyResult(keyResultId: string): KeyResult | undefined {
    return state.keyResults.find((k) => k.id === keyResultId)
  }

  /**
   * Get all key results
   */
  function getKeyResults(): KeyResult[] {
    return [...state.keyResults]
  }

  /**
   * Get OKR status
   */
  function getStatus(): 'active' | 'completed' | 'at-risk' | 'cancelled' {
    if (state.status) return state.status

    const progress = getProgress()
    if (progress >= 100) return 'completed'
    if (progress < 50) return 'at-risk'
    return 'active'
  }

  /**
   * Convert to plain JSON
   */
  function toJSON(): OKR {
    return { ...state }
  }
}

/**
 * OKR instance with methods
 */
export interface OKRInstance extends OKR {
  /** Update a key result */
  updateKeyResult(keyResultId: string, updates: Partial<Omit<KeyResult, 'id'>>): void
  /** Get overall progress */
  getProgress(): number
  /** Get a specific key result */
  getKeyResult(keyResultId: string): KeyResult | undefined
  /** Get all key results */
  getKeyResults(): KeyResult[]
  /** Get OKR status */
  getStatus(): 'active' | 'completed' | 'at-risk' | 'cancelled'
  /** Convert to plain JSON */
  toJSON(): OKR
}

/**
 * Create multiple OKRs
 *
 * @example
 * ```ts
 * import { okrs } from 'autonomous-agents'
 *
 * const objectives = okrs([
 *   {
 *     objective: 'Accelerate revenue growth',
 *     keyResults: [
 *       { id: 'kr1', description: 'Increase MRR to $150k', current: 100000, target: 150000 },
 *     ],
 *   },
 *   {
 *     objective: 'Improve product quality',
 *     keyResults: [
 *       { id: 'kr2', description: 'Reduce bug count to 10', current: 25, target: 10 },
 *     ],
 *   },
 * ])
 *
 * const all = objectives.getAll()
 * const summary = objectives.getSummary()
 * ```
 */
export function okrs(
  configs: Array<{
    objective: string
    description?: string
    keyResults: KeyResult[]
    period?: string
    owner?: string
  }>
): OKRsCollection {
  const okrList = configs.map((config) => okr(config))

  return {
    getAll() {
      return okrList
    },
    get(id: string) {
      return okrList.find((o) => o.id === id)
    },
    getByOwner(owner: string) {
      return okrList.filter((o) => o.owner === owner)
    },
    getSummary() {
      const totalProgress = okrList.reduce((sum, o) => sum + o.getProgress(), 0)

      return {
        total: okrList.length,
        onTrack: okrList.filter((o) => o.getProgress() >= 70).length,
        atRisk: okrList.filter((o) => o.getProgress() < 50).length,
        completed: okrList.filter((o) => o.status === 'completed').length,
        averageProgress: okrList.length > 0 ? totalProgress / okrList.length : 0,
      }
    },
    toJSON() {
      return okrList.map((o) => o.toJSON())
    },
  }
}

/**
 * OKRs collection
 */
export interface OKRsCollection {
  /** Get all OKRs */
  getAll(): OKRInstance[]
  /** Get a specific OKR by ID */
  get(id: string): OKRInstance | undefined
  /** Get OKRs by owner */
  getByOwner(owner: string): OKRInstance[]
  /** Get summary of all OKRs */
  getSummary(): {
    total: number
    onTrack: number
    atRisk: number
    completed: number
    averageProgress: number
  }
  /** Convert all OKRs to JSON */
  toJSON(): OKR[]
}

/**
 * Generate a KPI ID from name
 */
function generateKPIId(name: string): string {
  return `kpi-${name.toLowerCase().replace(/\s+/g, '-')}`
}

/**
 * Generate an OKR ID from objective
 */
function generateOKRId(objective: string): string {
  return `okr-${objective.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}`
}

/**
 * Calculate progress for a key result
 */
function calculateKeyResultProgress(kr: KeyResult): number {
  if (typeof kr.current === 'number' && typeof kr.target === 'number') {
    return calculateProgressPercent({ current: kr.current, target: kr.target })
  }
  return 0
}

/**
 * Update key result status based on progress
 */
export function updateKeyResultStatus(kr: KeyResult): void {
  const progress = kr.progress || calculateKeyResultProgress(kr)

  if (progress >= 100) {
    kr.status = 'completed'
  } else if (progress >= 70) {
    kr.status = 'on-track'
  } else if (progress >= 30) {
    kr.status = 'at-risk'
  } else {
    kr.status = 'off-track'
  }
}

/**
 * Create a key result
 */
export function createKeyResult(config: {
  id: string
  description: string
  current: number
  target: number
  unit?: string
}): KeyResult {
  const kr: KeyResult = {
    id: config.id,
    description: config.description,
    current: config.current,
    target: config.target,
    ...(config.unit !== undefined && { unit: config.unit }),
    progress: calculateKeyResultProgress({
      id: config.id,
      description: config.description,
      current: config.current,
      target: config.target,
    }),
  }

  updateKeyResultStatus(kr)
  return kr
}
