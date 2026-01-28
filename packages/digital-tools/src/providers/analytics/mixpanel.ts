/**
 * Mixpanel Analytics Provider
 *
 * Concrete implementation of AnalyticsProvider using Mixpanel API.
 *
 * @packageDocumentation
 */

import type {
  AnalyticsProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  TrackEventOptions,
  AnalyticsQueryOptions,
  AnalyticsQueryResult,
  AnalyticsReportData,
} from '../types.js'
import { defineProvider } from '../registry.js'

const MIXPANEL_TRACK_URL = 'https://api.mixpanel.com/track'
const MIXPANEL_ENGAGE_URL = 'https://api.mixpanel.com/engage'
const MIXPANEL_QUERY_URL = 'https://mixpanel.com/api/2.0'

/**
 * Mixpanel provider info
 */
export const mixpanelInfo: ProviderInfo = {
  id: 'analytics.mixpanel',
  name: 'Mixpanel',
  description: 'Mixpanel product analytics and user engagement platform',
  category: 'analytics',
  website: 'https://mixpanel.com',
  docsUrl: 'https://developer.mixpanel.com/docs',
  requiredConfig: ['projectToken'],
  optionalConfig: ['apiSecret'],
}

/**
 * Create Mixpanel analytics provider
 */
export function createMixpanelProvider(config: ProviderConfig): AnalyticsProvider {
  let projectToken: string
  let apiSecret: string | undefined

  return {
    info: mixpanelInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      projectToken = cfg['projectToken'] as string
      apiSecret = cfg['apiSecret'] as string | undefined

      if (!projectToken) {
        throw new Error('Mixpanel project token is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        // Try to track a test event to verify connectivity
        const testEvent = {
          event: 'health_check',
          properties: {
            token: projectToken,
            time: Math.floor(Date.now() / 1000),
            $insert_id: `health_check_${Date.now()}`,
          },
        }

        const response = await fetch(MIXPANEL_TRACK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([testEvent]),
        })

        const result = (await response.json()) as { status: number }

        return {
          healthy: response.ok && result.status === 1,
          latencyMs: Date.now() - start,
          message: response.ok ? 'Connected' : `HTTP ${response.status}`,
          checkedAt: new Date(),
        }
      } catch (error) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          message: error instanceof Error ? error.message : 'Unknown error',
          checkedAt: new Date(),
        }
      }
    },

    async dispose(): Promise<void> {
      // No cleanup needed
    },

    async track(event: TrackEventOptions): Promise<boolean> {
      try {
        const eventData = {
          event: event.event,
          properties: {
            token: projectToken,
            distinct_id: event.userId || event.anonymousId || 'unknown',
            time: event.timestamp
              ? Math.floor(event.timestamp.getTime() / 1000)
              : Math.floor(Date.now() / 1000),
            $insert_id: `${event.event}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            ...event.properties,
          },
        }

        const response = await fetch(MIXPANEL_TRACK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([eventData]),
        })

        const result = (await response.json()) as { status: number }
        return response.ok && result.status === 1
      } catch (error) {
        console.error('Mixpanel track error:', error)
        return false
      }
    },

    async identify(userId: string, traits?: Record<string, unknown>): Promise<boolean> {
      try {
        const engageData = {
          $token: projectToken,
          $distinct_id: userId,
          $set: traits || {},
        }

        const response = await fetch(MIXPANEL_ENGAGE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([engageData]),
        })

        const result = (await response.json()) as { status: number }
        return response.ok && result.status === 1
      } catch (error) {
        console.error('Mixpanel identify error:', error)
        return false
      }
    },

    async page(name: string, properties?: Record<string, unknown>): Promise<boolean> {
      return this.track({
        event: 'Page Viewed',
        properties: {
          page_name: name,
          ...properties,
        },
      })
    },

    async alias(userId: string, previousId: string): Promise<boolean> {
      try {
        const aliasEvent = {
          event: '$create_alias',
          properties: {
            token: projectToken,
            distinct_id: previousId,
            alias: userId,
          },
        }

        const response = await fetch(MIXPANEL_TRACK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify([aliasEvent]),
        })

        const result = (await response.json()) as { status: number }
        return response.ok && result.status === 1
      } catch (error) {
        console.error('Mixpanel alias error:', error)
        return false
      }
    },

    async getReport(reportId: string): Promise<AnalyticsReportData | null> {
      if (!apiSecret) {
        throw new Error('Mixpanel API secret is required for querying reports')
      }

      try {
        const auth = Buffer.from(`${apiSecret}:`).toString('base64')
        const response = await fetch(`${MIXPANEL_QUERY_URL}/reports/${reportId}`, {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        })

        if (!response.ok) {
          return null
        }

        const data = (await response.json()) as {
          name?: string
          description?: string
          query?: AnalyticsQueryOptions
          result?: AnalyticsQueryResult
          created?: string
          updated?: string
        }
        return {
          id: reportId,
          name: data.name || reportId,
          ...(data.description !== undefined && { description: data.description }),
          query: data.query || { metrics: [], dateRange: { start: new Date(), end: new Date() } },
          ...(data.result !== undefined && { result: data.result }),
          createdAt: data.created ? new Date(data.created) : new Date(),
          updatedAt: data.updated ? new Date(data.updated) : new Date(),
        }
      } catch (error) {
        console.error('Mixpanel getReport error:', error)
        return null
      }
    },

    async runQuery(query: AnalyticsQueryOptions): Promise<AnalyticsQueryResult> {
      if (!apiSecret) {
        throw new Error('Mixpanel API secret is required for running queries')
      }

      try {
        const auth = Buffer.from(`${apiSecret}:`).toString('base64')

        // Construct query parameters
        const params = new URLSearchParams()
        const fromDate = query.dateRange.start.toISOString().split('T')[0]
        const toDate = query.dateRange.end.toISOString().split('T')[0]
        if (fromDate) params.append('from_date', fromDate)
        if (toDate) params.append('to_date', toDate)

        if (query.metrics.length > 0) {
          params.append('event', query.metrics.join(','))
        }

        if (query.limit) {
          params.append('limit', query.limit.toString())
        }

        // Use the segmentation endpoint for queries
        const endpoint = query.dimensions && query.dimensions.length > 0 ? 'segmentation' : 'events'

        const response = await fetch(`${MIXPANEL_QUERY_URL}/${endpoint}?${params.toString()}`, {
          headers: {
            Authorization: `Basic ${auth}`,
          },
        })

        if (!response.ok) {
          throw new Error(`Query failed: ${response.statusText}`)
        }

        const data = (await response.json()) as {
          data?: Record<string, Record<string, number>>
        }

        // Transform Mixpanel response to our format
        const rows: Array<Record<string, unknown>> = []
        const totals: Record<string, number> = {}

        if (data.data) {
          Object.entries(data.data).forEach(([key, values]) => {
            const row: Record<string, unknown> = { metric: key }

            if (typeof values === 'object' && values !== null) {
              Object.entries(values).forEach(([date, value]) => {
                row[date] = value
                if (typeof value === 'number') {
                  totals[key] = (totals[key] || 0) + value
                }
              })
            }

            rows.push(row)
          })
        }

        return {
          rows,
          totals,
          rowCount: rows.length,
        }
      } catch (error) {
        console.error('Mixpanel runQuery error:', error)
        throw error
      }
    },
  }
}

/**
 * Mixpanel provider definition
 */
export const mixpanelProvider = defineProvider(mixpanelInfo, async (config) =>
  createMixpanelProvider(config)
)
