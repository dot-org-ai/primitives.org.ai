/**
 * Tests for queries.ts - Live Queries & Views for ai-database
 */

import { describe, it, expect } from 'vitest'
import {
  // Types
  StandardDimensions,
  StandardMeasures,
  CalculatedMetrics,

  // Builders
  query,
  QueryBuilder,
  view,
  ViewBuilder,
  dashboard,
  DashboardBuilder,

  // Pre-built queries
  MrrOverview,
  ArrBySegment,
  CohortRetention,
  UnitEconomics,
  RevenueByChannel,
  GrowthMetrics,

  // Pre-built dashboards
  ExecutiveDashboard,
} from '../src/queries.js'

describe('StandardDimensions', () => {
  it('should have time dimensions', () => {
    expect(StandardDimensions.date).toBeDefined()
    expect(StandardDimensions.date.name).toBe('date')
    expect(StandardDimensions.date.type).toBe('date')

    expect(StandardDimensions.month).toBeDefined()
    expect(StandardDimensions.month.granularity).toBe('month')

    expect(StandardDimensions.quarter).toBeDefined()
    expect(StandardDimensions.quarter.granularity).toBe('quarter')

    expect(StandardDimensions.year).toBeDefined()
    expect(StandardDimensions.year.granularity).toBe('year')
  })

  it('should have customer dimensions', () => {
    expect(StandardDimensions.customerId).toBeDefined()
    expect(StandardDimensions.customerSegment).toBeDefined()
    expect(StandardDimensions.plan).toBeDefined()
    expect(StandardDimensions.cohort).toBeDefined()
  })

  it('should have product dimensions', () => {
    expect(StandardDimensions.productId).toBeDefined()
    expect(StandardDimensions.productName).toBeDefined()
    expect(StandardDimensions.feature).toBeDefined()
  })

  it('should have geography dimensions', () => {
    expect(StandardDimensions.country).toBeDefined()
    expect(StandardDimensions.region).toBeDefined()
  })

  it('should have channel dimensions', () => {
    expect(StandardDimensions.channel).toBeDefined()
    expect(StandardDimensions.source).toBeDefined()
    expect(StandardDimensions.campaign).toBeDefined()
  })
})

describe('StandardMeasures', () => {
  it('should have revenue measures', () => {
    expect(StandardMeasures.revenue).toBeDefined()
    expect(StandardMeasures.revenue.aggregate).toBe('sum')
    expect(StandardMeasures.revenue.type).toBe('currency')

    expect(StandardMeasures.mrr).toBeDefined()
    expect(StandardMeasures.newMrr).toBeDefined()
    expect(StandardMeasures.expansionMrr).toBeDefined()
    expect(StandardMeasures.contractionMrr).toBeDefined()
    expect(StandardMeasures.churnedMrr).toBeDefined()
  })

  it('should have customer measures', () => {
    expect(StandardMeasures.customers).toBeDefined()
    expect(StandardMeasures.customers.aggregate).toBe('countDistinct')

    expect(StandardMeasures.newCustomers).toBeDefined()
    expect(StandardMeasures.churnedCustomers).toBeDefined()
  })

  it('should have usage measures', () => {
    expect(StandardMeasures.events).toBeDefined()
    expect(StandardMeasures.events.aggregate).toBe('count')

    expect(StandardMeasures.sessions).toBeDefined()
    expect(StandardMeasures.activeUsers).toBeDefined()
  })

  it('should have cost measures', () => {
    expect(StandardMeasures.cogs).toBeDefined()
    expect(StandardMeasures.salesSpend).toBeDefined()
    expect(StandardMeasures.marketingSpend).toBeDefined()
  })
})

describe('CalculatedMetrics', () => {
  it('should have revenue calculated metrics', () => {
    expect(CalculatedMetrics.arr).toBeDefined()
    expect(CalculatedMetrics.arr.expression).toBe('mrr * 12')
    expect(CalculatedMetrics.arr.measures).toContain('mrr')

    expect(CalculatedMetrics.netNewMrr).toBeDefined()
    expect(CalculatedMetrics.arpu).toBeDefined()
  })

  it('should have margin calculated metrics', () => {
    expect(CalculatedMetrics.grossProfit).toBeDefined()
    expect(CalculatedMetrics.grossMargin).toBeDefined()
    expect(CalculatedMetrics.grossMargin.type).toBe('percent')
  })

  it('should have efficiency calculated metrics', () => {
    expect(CalculatedMetrics.cac).toBeDefined()
    expect(CalculatedMetrics.ltv).toBeDefined()
    expect(CalculatedMetrics.ltvCacRatio).toBeDefined()
  })

  it('should have churn calculated metrics', () => {
    expect(CalculatedMetrics.customerChurnRate).toBeDefined()
    expect(CalculatedMetrics.revenueChurnRate).toBeDefined()
    expect(CalculatedMetrics.nrr).toBeDefined()
  })

  it('should have growth calculated metrics', () => {
    expect(CalculatedMetrics.quickRatio).toBeDefined()
    expect(CalculatedMetrics.magicNumber).toBeDefined()
  })
})

describe('QueryBuilder', () => {
  describe('query()', () => {
    it('should create a basic query', () => {
      const q = query('test_query', 'test_table').build()

      expect(q.name).toBe('test_query')
      expect(q.source).toBe('test_table')
    })

    it('should set description', () => {
      const q = query('test', 'table').describe('A test query').build()

      expect(q.description).toBe('A test query')
    })

    it('should set dimensions', () => {
      const q = query('test', 'table').dimensions('month', 'segment').build()

      expect(q.dimensions).toEqual(['month', 'segment'])
    })

    it('should set measures', () => {
      const q = query('test', 'table').measures('mrr', 'customers').build()

      expect(q.measures).toEqual(['mrr', 'customers'])
    })

    it('should add filters', () => {
      const q = query('test', 'table')
        .filter('status', 'eq', 'active')
        .filter('revenue', 'gt', 1000)
        .build()

      expect(q.filters).toHaveLength(2)
      expect(q.filters![0]).toEqual({ field: 'status', operator: 'eq', value: 'active' })
      expect(q.filters![1]).toEqual({ field: 'revenue', operator: 'gt', value: 1000 })
    })

    it('should set where filters', () => {
      const filters = [
        { field: 'status', operator: 'eq' as const, value: 'active' },
        { field: 'revenue', operator: 'gt' as const, value: 1000 },
      ]
      const q = query('test', 'table').where(filters).build()

      expect(q.filters).toEqual(filters)
    })

    it('should set time range', () => {
      const start = new Date('2024-01-01')
      const end = new Date('2024-12-31')
      const q = query('test', 'table').timeRange('created_at', start, end, 'month').build()

      expect(q.timeRange).toEqual({
        field: 'created_at',
        start,
        end,
        granularity: 'month',
      })
    })

    it('should set last duration', () => {
      const q = query('test', 'table').last('30d').build()

      expect(q.timeRange).toEqual({
        field: 'date',
        start: '-30d',
      })
    })

    it('should set last duration with custom field', () => {
      const q = query('test', 'table').last('7d', 'created_at').build()

      expect(q.timeRange?.field).toBe('created_at')
      expect(q.timeRange?.start).toBe('-7d')
    })

    it('should add sort', () => {
      const q = query('test', 'table').sort('revenue', 'desc').sort('date', 'asc').build()

      expect(q.sort).toHaveLength(2)
      expect(q.sort![0]).toEqual({ field: 'revenue', direction: 'desc' })
      expect(q.sort![1]).toEqual({ field: 'date', direction: 'asc' })
    })

    it('should use desc as default sort direction', () => {
      const q = query('test', 'table').sort('revenue').build()

      expect(q.sort![0]?.direction).toBe('desc')
    })

    it('should set limit', () => {
      const q = query('test', 'table').limit(100).build()

      expect(q.limit).toBe(100)
    })

    it('should set offset', () => {
      const q = query('test', 'table').offset(50).build()

      expect(q.offset).toBe(50)
    })

    it('should set tags', () => {
      const q = query('test', 'table').tags('saas', 'revenue', 'metrics').build()

      expect(q.tags).toEqual(['saas', 'revenue', 'metrics'])
    })

    it('should set owner', () => {
      const q = query('test', 'table').owner('finance-team').build()

      expect(q.owner).toBe('finance-team')
    })

    it('should chain all builder methods', () => {
      const q = query('full_query', 'revenue_events')
        .describe('Full query example')
        .dimensions('month', 'segment')
        .measures('mrr', 'customers')
        .filter('status', 'eq', 'active')
        .last('12m')
        .sort('mrr', 'desc')
        .limit(100)
        .offset(0)
        .tags('test')
        .owner('team')
        .build()

      expect(q.name).toBe('full_query')
      expect(q.source).toBe('revenue_events')
      expect(q.description).toBe('Full query example')
      expect(q.dimensions).toEqual(['month', 'segment'])
      expect(q.measures).toEqual(['mrr', 'customers'])
      expect(q.filters).toHaveLength(1)
      expect(q.timeRange?.start).toBe('-12m')
      expect(q.sort).toHaveLength(1)
      expect(q.limit).toBe(100)
      expect(q.offset).toBe(0)
      expect(q.tags).toEqual(['test'])
      expect(q.owner).toBe('team')
    })
  })
})

describe('ViewBuilder', () => {
  const testQuery = query('test', 'table').build()

  describe('view()', () => {
    it('should create a basic view', () => {
      const v = view('test_view', testQuery).build()

      expect(v.name).toBe('test_view')
      expect(v.query).toEqual(testQuery)
    })

    it('should set description', () => {
      const v = view('test', testQuery).describe('A test view').build()

      expect(v.description).toBe('A test view')
    })

    it('should set materialization', () => {
      const v = view('test', testQuery).materialize('5m', '30d').build()

      expect(v.materialized).toBe(true)
      expect(v.refreshInterval).toBe('5m')
      expect(v.retention).toBe('30d')
    })

    it('should set public flag', () => {
      const v = view('test', testQuery).public().build()

      expect(v.public).toBe(true)
    })

    it('should set owner', () => {
      const v = view('test', testQuery).owner('data-team').build()

      expect(v.owner).toBe('data-team')
    })

    it('should set tags', () => {
      const v = view('test', testQuery).tags('financial', 'metrics').build()

      expect(v.tags).toEqual(['financial', 'metrics'])
    })

    it('should chain all builder methods', () => {
      const v = view('full_view', testQuery)
        .describe('Full view example')
        .materialize('1h', '7d')
        .public()
        .owner('analytics')
        .tags('test', 'example')
        .build()

      expect(v.name).toBe('full_view')
      expect(v.description).toBe('Full view example')
      expect(v.materialized).toBe(true)
      expect(v.refreshInterval).toBe('1h')
      expect(v.retention).toBe('7d')
      expect(v.public).toBe(true)
      expect(v.owner).toBe('analytics')
      expect(v.tags).toEqual(['test', 'example'])
    })
  })
})

describe('DashboardBuilder', () => {
  const testQuery = query('test', 'table').build()
  const testView = view('test_view', testQuery).build()

  describe('dashboard()', () => {
    it('should create a basic dashboard', () => {
      const d = dashboard('test_dashboard').build()

      expect(d.name).toBe('test_dashboard')
      expect(d.views).toEqual([])
    })

    it('should set description', () => {
      const d = dashboard('test').describe('A test dashboard').build()

      expect(d.description).toBe('A test dashboard')
    })

    it('should add views', () => {
      const d = dashboard('test').add(testView).build()

      expect(d.views).toHaveLength(1)
      expect(d.views[0]).toEqual(testView)
    })

    it('should add multiple views', () => {
      const view2 = view('test_view_2', testQuery).build()
      const d = dashboard('test').add(testView).add(view2).build()

      expect(d.views).toHaveLength(2)
    })

    it('should set layout', () => {
      const d = dashboard('test').layout(4, 3).build()

      expect(d.layout).toBeDefined()
      expect(d.layout?.columns).toBe(4)
      expect(d.layout?.rows).toBe(3)
      expect(d.layout?.items).toEqual([])
    })

    it('should add view with layout options when layout is set', () => {
      const d = dashboard('test')
        .layout(4, 3)
        .add(testView, { x: 0, y: 0, width: 2, height: 1, visualization: 'line' })
        .build()

      expect(d.views).toHaveLength(1)
      expect(d.layout?.items).toHaveLength(1)
      expect(d.layout?.items[0]).toEqual({
        viewName: 'test_view',
        x: 0,
        y: 0,
        width: 2,
        height: 1,
        visualization: 'line',
      })
    })

    it('should set refresh interval', () => {
      const d = dashboard('test').refresh('5m').build()

      expect(d.refreshInterval).toBe('5m')
    })

    it('should set owner', () => {
      const d = dashboard('test').owner('exec-team').build()

      expect(d.owner).toBe('exec-team')
    })

    it('should set tags', () => {
      const d = dashboard('test').tags('executive', 'saas').build()

      expect(d.tags).toEqual(['executive', 'saas'])
    })

    it('should chain all builder methods', () => {
      const d = dashboard('full_dashboard')
        .describe('Full dashboard example')
        .layout(4, 3)
        .add(testView, { x: 0, y: 0, width: 2, height: 1 })
        .refresh('10m')
        .owner('leadership')
        .tags('kpi', 'metrics')
        .build()

      expect(d.name).toBe('full_dashboard')
      expect(d.description).toBe('Full dashboard example')
      expect(d.layout?.columns).toBe(4)
      expect(d.layout?.rows).toBe(3)
      expect(d.views).toHaveLength(1)
      expect(d.refreshInterval).toBe('10m')
      expect(d.owner).toBe('leadership')
      expect(d.tags).toEqual(['kpi', 'metrics'])
    })
  })
})

describe('Pre-built Queries', () => {
  describe('MrrOverview', () => {
    it('should have correct structure', () => {
      expect(MrrOverview.name).toBe('mrr_overview')
      expect(MrrOverview.source).toBe('revenue_events')
      expect(MrrOverview.dimensions).toContain('month')
      expect(MrrOverview.measures).toContain('mrr')
      expect(MrrOverview.measures).toContain('newMrr')
      expect(MrrOverview.measures).toContain('expansionMrr')
      expect(MrrOverview.measures).toContain('contractionMrr')
      expect(MrrOverview.measures).toContain('churnedMrr')
      expect(MrrOverview.measures).toContain('netNewMrr')
      expect(MrrOverview.timeRange?.start).toBe('-12m')
    })
  })

  describe('ArrBySegment', () => {
    it('should have correct structure', () => {
      expect(ArrBySegment.name).toBe('arr_by_segment')
      expect(ArrBySegment.source).toBe('revenue_events')
      expect(ArrBySegment.dimensions).toContain('customerSegment')
      expect(ArrBySegment.measures).toContain('arr')
      expect(ArrBySegment.measures).toContain('customers')
      expect(ArrBySegment.measures).toContain('arpu')
    })
  })

  describe('CohortRetention', () => {
    it('should have correct structure', () => {
      expect(CohortRetention.name).toBe('cohort_retention')
      expect(CohortRetention.source).toBe('customer_events')
      expect(CohortRetention.dimensions).toContain('cohort')
      expect(CohortRetention.dimensions).toContain('month')
      expect(CohortRetention.measures).toContain('customers')
      expect(CohortRetention.measures).toContain('mrr')
    })
  })

  describe('UnitEconomics', () => {
    it('should have correct structure', () => {
      expect(UnitEconomics.name).toBe('unit_economics')
      expect(UnitEconomics.source).toBe('financial_events')
      expect(UnitEconomics.measures).toContain('cac')
      expect(UnitEconomics.measures).toContain('ltv')
      expect(UnitEconomics.measures).toContain('ltvCacRatio')
      expect(UnitEconomics.measures).toContain('arpu')
      expect(UnitEconomics.measures).toContain('customerChurnRate')
    })
  })

  describe('RevenueByChannel', () => {
    it('should have correct structure', () => {
      expect(RevenueByChannel.name).toBe('revenue_by_channel')
      expect(RevenueByChannel.source).toBe('revenue_events')
      expect(RevenueByChannel.dimensions).toContain('channel')
      expect(RevenueByChannel.measures).toContain('mrr')
      expect(RevenueByChannel.measures).toContain('newCustomers')
      expect(RevenueByChannel.measures).toContain('cac')
    })
  })

  describe('GrowthMetrics', () => {
    it('should have correct structure', () => {
      expect(GrowthMetrics.name).toBe('growth_metrics')
      expect(GrowthMetrics.source).toBe('financial_events')
      expect(GrowthMetrics.dimensions).toContain('month')
      expect(GrowthMetrics.measures).toContain('mrr')
      expect(GrowthMetrics.measures).toContain('netNewMrr')
      expect(GrowthMetrics.measures).toContain('quickRatio')
      expect(GrowthMetrics.measures).toContain('nrr')
      expect(GrowthMetrics.measures).toContain('magicNumber')
    })
  })
})

describe('Pre-built Dashboards', () => {
  describe('ExecutiveDashboard', () => {
    it('should have correct structure', () => {
      expect(ExecutiveDashboard.name).toBe('executive')
      expect(ExecutiveDashboard.description).toBe('Executive overview of key SaaS metrics')
      expect(ExecutiveDashboard.views).toHaveLength(5)
      expect(ExecutiveDashboard.refreshInterval).toBe('5m')
      expect(ExecutiveDashboard.tags).toContain('executive')
      expect(ExecutiveDashboard.tags).toContain('saas')
      expect(ExecutiveDashboard.tags).toContain('metrics')
    })

    it('should have correct layout', () => {
      expect(ExecutiveDashboard.layout).toBeDefined()
      expect(ExecutiveDashboard.layout?.columns).toBe(4)
      expect(ExecutiveDashboard.layout?.rows).toBe(3)
      expect(ExecutiveDashboard.layout?.items).toHaveLength(5)
    })

    it('should have views with visualizations', () => {
      const items = ExecutiveDashboard.layout?.items || []
      const visualizations = items.map((item) => item.visualization)

      expect(visualizations).toContain('trend')
      expect(visualizations).toContain('bar')
      expect(visualizations).toContain('table')
      expect(visualizations).toContain('line')
      expect(visualizations).toContain('cohort')
    })
  })
})
