/**
 * Live Queries & Views
 *
 * Query definitions for real-time analytics against ai-database (ClickHouse-backed).
 * These are NOT batch reports - they're live, composable queries that execute
 * in real-time against a performant OLAP database.
 *
 * @packageDocumentation
 */

import type { TimePeriod } from './types.js'

// =============================================================================
// Core Query Types
// =============================================================================

/**
 * Time granularity for aggregations
 */
export type Granularity = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'

/**
 * Aggregation function
 */
export type AggregateFunction =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'count'
  | 'countDistinct'
  | 'first'
  | 'last'
  | 'median'
  | 'p50'
  | 'p90'
  | 'p95'
  | 'p99'
  | 'stddev'
  | 'variance'

/**
 * Comparison operator
 */
export type Operator =
  | 'eq' // =
  | 'ne' // !=
  | 'gt' // >
  | 'gte' // >=
  | 'lt' // <
  | 'lte' // <=
  | 'in' // IN
  | 'notIn' // NOT IN
  | 'like' // LIKE
  | 'notLike' // NOT LIKE
  | 'between' // BETWEEN
  | 'isNull' // IS NULL
  | 'isNotNull' // IS NOT NULL

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc'

// =============================================================================
// Dimension & Measure (OLAP Primitives)
// =============================================================================

/**
 * Dimension - categorical attribute for grouping/filtering
 */
export interface Dimension {
  name: string
  field: string // Source field in database
  type: 'string' | 'number' | 'date' | 'boolean'
  description?: string
  granularity?: Granularity // For time dimensions
  format?: string // Display format
}

/**
 * Measure - numeric value to aggregate
 */
export interface Measure {
  name: string
  field: string // Source field or expression
  aggregate: AggregateFunction
  type?: 'number' | 'currency' | 'percent'
  description?: string
  format?: string
  currency?: string
}

/**
 * Calculated measure - derived from other measures
 */
export interface CalculatedMeasure {
  name: string
  expression: string // e.g., "revenue - cogs" or "revenue / customers"
  measures: string[] // Dependencies
  type?: 'number' | 'currency' | 'percent'
  description?: string
  format?: string
}

// =============================================================================
// Filter & Sort
// =============================================================================

/**
 * Filter condition
 */
export interface Filter {
  field: string
  operator: Operator
  value: unknown
  and?: Filter[]
  or?: Filter[]
}

/**
 * Sort specification
 */
export interface Sort {
  field: string
  direction: SortDirection
}

/**
 * Time range filter
 */
export interface TimeRange {
  field: string // The timestamp field
  start?: Date | string // Absolute or relative (e.g., '-30d')
  end?: Date | string
  granularity?: Granularity
}

// =============================================================================
// Query Definition
// =============================================================================

/**
 * Query definition - a composable, reusable query
 */
export interface Query {
  name: string
  description?: string

  // Data source
  source: string // Table or view name

  // What to select
  dimensions?: string[] // Dimension names to group by
  measures?: string[] // Measure names to aggregate

  // Filtering
  filters?: Filter[]
  timeRange?: TimeRange

  // Sorting & pagination
  sort?: Sort[]
  limit?: number
  offset?: number

  // Metadata
  tags?: string[]
  owner?: string
}

/**
 * Query with resolved schema
 */
export interface ResolvedQuery extends Query {
  resolvedDimensions: Dimension[]
  resolvedMeasures: (Measure | CalculatedMeasure)[]
}

// =============================================================================
// View Definition (Like Materialized Views)
// =============================================================================

/**
 * View - a saved query with optional materialization
 */
export interface View {
  name: string
  description?: string
  query: Query

  // Materialization options
  materialized?: boolean
  refreshInterval?: string // e.g., '5m', '1h', '1d'
  retention?: string // How long to keep data

  // Access
  public?: boolean
  owner?: string
  tags?: string[]
}

/**
 * Dashboard - collection of related views
 */
export interface Dashboard {
  name: string
  description?: string
  views: View[]
  layout?: DashboardLayout
  refreshInterval?: string
  owner?: string
  tags?: string[]
}

/**
 * Dashboard layout
 */
export interface DashboardLayout {
  columns: number
  rows: number
  items: DashboardItem[]
}

/**
 * Dashboard item position
 */
export interface DashboardItem {
  viewName: string
  x: number
  y: number
  width: number
  height: number
  visualization?: Visualization
}

/**
 * Visualization type
 */
export type Visualization =
  | 'number' // Single big number
  | 'trend' // Number with sparkline
  | 'table' // Data table
  | 'bar' // Bar chart
  | 'line' // Line chart
  | 'area' // Area chart
  | 'pie' // Pie chart
  | 'funnel' // Funnel chart
  | 'cohort' // Cohort matrix
  | 'heatmap' // Heatmap

// =============================================================================
// Metric Definitions (Standard SaaS Metrics as Queries)
// =============================================================================

/**
 * Standard SaaS metric dimensions
 */
export const StandardDimensions: Record<string, Dimension> = {
  // Time
  date: { name: 'date', field: 'date', type: 'date', description: 'Event date' },
  month: { name: 'month', field: 'date', type: 'date', granularity: 'month', description: 'Month' },
  quarter: {
    name: 'quarter',
    field: 'date',
    type: 'date',
    granularity: 'quarter',
    description: 'Quarter',
  },
  year: { name: 'year', field: 'date', type: 'date', granularity: 'year', description: 'Year' },

  // Customer
  customerId: {
    name: 'customerId',
    field: 'customer_id',
    type: 'string',
    description: 'Customer ID',
  },
  customerSegment: {
    name: 'customerSegment',
    field: 'customer_segment',
    type: 'string',
    description: 'Customer segment',
  },
  plan: { name: 'plan', field: 'plan', type: 'string', description: 'Subscription plan' },
  cohort: { name: 'cohort', field: 'cohort', type: 'string', description: 'Customer cohort' },

  // Product
  productId: { name: 'productId', field: 'product_id', type: 'string', description: 'Product ID' },
  productName: {
    name: 'productName',
    field: 'product_name',
    type: 'string',
    description: 'Product name',
  },
  feature: { name: 'feature', field: 'feature', type: 'string', description: 'Feature name' },

  // Geography
  country: { name: 'country', field: 'country', type: 'string', description: 'Country' },
  region: { name: 'region', field: 'region', type: 'string', description: 'Region' },

  // Channel
  channel: {
    name: 'channel',
    field: 'channel',
    type: 'string',
    description: 'Acquisition channel',
  },
  source: { name: 'source', field: 'source', type: 'string', description: 'Traffic source' },
  campaign: {
    name: 'campaign',
    field: 'campaign',
    type: 'string',
    description: 'Marketing campaign',
  },
}

/**
 * Standard SaaS metric measures
 */
export const StandardMeasures: Record<string, Measure> = {
  // Revenue
  revenue: {
    name: 'revenue',
    field: 'revenue',
    aggregate: 'sum',
    type: 'currency',
    description: 'Total revenue',
  },
  mrr: {
    name: 'mrr',
    field: 'mrr',
    aggregate: 'sum',
    type: 'currency',
    description: 'Monthly recurring revenue',
  },
  newMrr: {
    name: 'newMrr',
    field: 'new_mrr',
    aggregate: 'sum',
    type: 'currency',
    description: 'New MRR',
  },
  expansionMrr: {
    name: 'expansionMrr',
    field: 'expansion_mrr',
    aggregate: 'sum',
    type: 'currency',
    description: 'Expansion MRR',
  },
  contractionMrr: {
    name: 'contractionMrr',
    field: 'contraction_mrr',
    aggregate: 'sum',
    type: 'currency',
    description: 'Contraction MRR',
  },
  churnedMrr: {
    name: 'churnedMrr',
    field: 'churned_mrr',
    aggregate: 'sum',
    type: 'currency',
    description: 'Churned MRR',
  },

  // Customers
  customers: {
    name: 'customers',
    field: 'customer_id',
    aggregate: 'countDistinct',
    type: 'number',
    description: 'Unique customers',
  },
  newCustomers: {
    name: 'newCustomers',
    field: 'new_customer_id',
    aggregate: 'countDistinct',
    type: 'number',
    description: 'New customers',
  },
  churnedCustomers: {
    name: 'churnedCustomers',
    field: 'churned_customer_id',
    aggregate: 'countDistinct',
    type: 'number',
    description: 'Churned customers',
  },

  // Usage
  events: {
    name: 'events',
    field: 'event_id',
    aggregate: 'count',
    type: 'number',
    description: 'Event count',
  },
  sessions: {
    name: 'sessions',
    field: 'session_id',
    aggregate: 'countDistinct',
    type: 'number',
    description: 'Unique sessions',
  },
  activeUsers: {
    name: 'activeUsers',
    field: 'user_id',
    aggregate: 'countDistinct',
    type: 'number',
    description: 'Active users',
  },

  // Costs
  cogs: {
    name: 'cogs',
    field: 'cogs',
    aggregate: 'sum',
    type: 'currency',
    description: 'Cost of goods sold',
  },
  salesSpend: {
    name: 'salesSpend',
    field: 'sales_spend',
    aggregate: 'sum',
    type: 'currency',
    description: 'Sales spend',
  },
  marketingSpend: {
    name: 'marketingSpend',
    field: 'marketing_spend',
    aggregate: 'sum',
    type: 'currency',
    description: 'Marketing spend',
  },
}

/**
 * Calculated SaaS metrics
 */
export const CalculatedMetrics: Record<string, CalculatedMeasure> = {
  // Revenue metrics
  arr: {
    name: 'arr',
    expression: 'mrr * 12',
    measures: ['mrr'],
    type: 'currency',
    description: 'Annual recurring revenue',
  },
  netNewMrr: {
    name: 'netNewMrr',
    expression: 'newMrr + expansionMrr - contractionMrr - churnedMrr',
    measures: ['newMrr', 'expansionMrr', 'contractionMrr', 'churnedMrr'],
    type: 'currency',
    description: 'Net new MRR',
  },
  arpu: {
    name: 'arpu',
    expression: 'mrr / customers',
    measures: ['mrr', 'customers'],
    type: 'currency',
    description: 'Average revenue per user',
  },

  // Margin metrics
  grossProfit: {
    name: 'grossProfit',
    expression: 'revenue - cogs',
    measures: ['revenue', 'cogs'],
    type: 'currency',
    description: 'Gross profit',
  },
  grossMargin: {
    name: 'grossMargin',
    expression: '(revenue - cogs) / revenue * 100',
    measures: ['revenue', 'cogs'],
    type: 'percent',
    description: 'Gross margin percentage',
  },

  // Efficiency metrics
  cac: {
    name: 'cac',
    expression: '(salesSpend + marketingSpend) / newCustomers',
    measures: ['salesSpend', 'marketingSpend', 'newCustomers'],
    type: 'currency',
    description: 'Customer acquisition cost',
  },
  ltv: {
    name: 'ltv',
    expression: 'arpu * grossMargin / 100 / churnRate',
    measures: ['arpu', 'grossMargin'],
    type: 'currency',
    description: 'Customer lifetime value',
  },
  ltvCacRatio: {
    name: 'ltvCacRatio',
    expression: 'ltv / cac',
    measures: ['ltv', 'cac'],
    type: 'number',
    description: 'LTV:CAC ratio',
  },

  // Churn metrics
  customerChurnRate: {
    name: 'customerChurnRate',
    expression: 'churnedCustomers / customers * 100',
    measures: ['churnedCustomers', 'customers'],
    type: 'percent',
    description: 'Customer churn rate',
  },
  revenueChurnRate: {
    name: 'revenueChurnRate',
    expression: 'churnedMrr / mrr * 100',
    measures: ['churnedMrr', 'mrr'],
    type: 'percent',
    description: 'Revenue churn rate',
  },
  nrr: {
    name: 'nrr',
    expression: '(mrr + expansionMrr - contractionMrr - churnedMrr) / mrr * 100',
    measures: ['mrr', 'expansionMrr', 'contractionMrr', 'churnedMrr'],
    type: 'percent',
    description: 'Net revenue retention',
  },

  // Growth metrics
  quickRatio: {
    name: 'quickRatio',
    expression: '(newMrr + expansionMrr) / (contractionMrr + churnedMrr)',
    measures: ['newMrr', 'expansionMrr', 'contractionMrr', 'churnedMrr'],
    type: 'number',
    description: 'SaaS Quick Ratio',
  },
  magicNumber: {
    name: 'magicNumber',
    expression: 'netNewMrr * 12 / (salesSpend + marketingSpend)',
    measures: ['netNewMrr', 'salesSpend', 'marketingSpend'],
    type: 'number',
    description: 'Magic Number',
  },
}

// =============================================================================
// Query Builder Functions
// =============================================================================

/**
 * Create a query
 */
export function query(name: string, source: string): QueryBuilder {
  return new QueryBuilder(name, source)
}

/**
 * Fluent query builder
 */
export class QueryBuilder {
  private _query: Query

  constructor(name: string, source: string) {
    this._query = { name, source }
  }

  describe(description: string): this {
    this._query.description = description
    return this
  }

  dimensions(...dims: string[]): this {
    this._query.dimensions = dims
    return this
  }

  measures(...measures: string[]): this {
    this._query.measures = measures
    return this
  }

  filter(field: string, operator: Operator, value: unknown): this {
    if (!this._query.filters) this._query.filters = []
    this._query.filters.push({ field, operator, value })
    return this
  }

  where(filters: Filter[]): this {
    this._query.filters = filters
    return this
  }

  timeRange(
    field: string,
    start?: Date | string,
    end?: Date | string,
    granularity?: Granularity
  ): this {
    const timeRange: TimeRange = { field }
    if (start !== undefined) timeRange.start = start
    if (end !== undefined) timeRange.end = end
    if (granularity !== undefined) timeRange.granularity = granularity
    this._query.timeRange = timeRange
    return this
  }

  last(duration: string, field: string = 'date'): this {
    this._query.timeRange = { field, start: `-${duration}` }
    return this
  }

  sort(field: string, direction: SortDirection = 'desc'): this {
    if (!this._query.sort) this._query.sort = []
    this._query.sort.push({ field, direction })
    return this
  }

  limit(n: number): this {
    this._query.limit = n
    return this
  }

  offset(n: number): this {
    this._query.offset = n
    return this
  }

  tags(...tags: string[]): this {
    this._query.tags = tags
    return this
  }

  owner(owner: string): this {
    this._query.owner = owner
    return this
  }

  build(): Query {
    return { ...this._query }
  }
}

// =============================================================================
// Pre-built SaaS Metric Queries
// =============================================================================

/**
 * MRR Overview query
 */
export const MrrOverview = query('mrr_overview', 'revenue_events')
  .describe('Monthly recurring revenue breakdown')
  .dimensions('month')
  .measures('mrr', 'newMrr', 'expansionMrr', 'contractionMrr', 'churnedMrr', 'netNewMrr')
  .last('12m')
  .sort('month', 'asc')
  .build()

/**
 * ARR by segment query
 */
export const ArrBySegment = query('arr_by_segment', 'revenue_events')
  .describe('Annual recurring revenue by customer segment')
  .dimensions('customerSegment')
  .measures('arr', 'customers', 'arpu')
  .last('1m')
  .sort('arr', 'desc')
  .build()

/**
 * Customer cohort retention query
 */
export const CohortRetention = query('cohort_retention', 'customer_events')
  .describe('Customer retention by signup cohort')
  .dimensions('cohort', 'month')
  .measures('customers', 'mrr')
  .last('12m')
  .sort('cohort', 'asc')
  .build()

/**
 * Unit economics query
 */
export const UnitEconomics = query('unit_economics', 'financial_events')
  .describe('Key unit economics metrics')
  .dimensions('month')
  .measures('cac', 'ltv', 'ltvCacRatio', 'arpu', 'customerChurnRate')
  .last('12m')
  .sort('month', 'asc')
  .build()

/**
 * Revenue by channel query
 */
export const RevenueByChannel = query('revenue_by_channel', 'revenue_events')
  .describe('Revenue breakdown by acquisition channel')
  .dimensions('channel')
  .measures('mrr', 'newCustomers', 'cac')
  .last('3m')
  .sort('mrr', 'desc')
  .build()

/**
 * Growth metrics query
 */
export const GrowthMetrics = query('growth_metrics', 'financial_events')
  .describe('Key growth and efficiency metrics')
  .dimensions('month')
  .measures('mrr', 'netNewMrr', 'quickRatio', 'nrr', 'magicNumber')
  .last('12m')
  .sort('month', 'asc')
  .build()

// =============================================================================
// View Builder
// =============================================================================

/**
 * Create a view from a query
 */
export function view(name: string, queryDef: Query): ViewBuilder {
  return new ViewBuilder(name, queryDef)
}

/**
 * Fluent view builder
 */
export class ViewBuilder {
  private _view: View

  constructor(name: string, queryDef: Query) {
    this._view = { name, query: queryDef }
  }

  describe(description: string): this {
    this._view.description = description
    return this
  }

  materialize(refreshInterval?: string, retention?: string): this {
    this._view.materialized = true
    if (refreshInterval !== undefined) this._view.refreshInterval = refreshInterval
    if (retention !== undefined) this._view.retention = retention
    return this
  }

  public(): this {
    this._view.public = true
    return this
  }

  owner(owner: string): this {
    this._view.owner = owner
    return this
  }

  tags(...tags: string[]): this {
    this._view.tags = tags
    return this
  }

  build(): View {
    return { ...this._view }
  }
}

// =============================================================================
// Dashboard Builder
// =============================================================================

/**
 * Create a dashboard
 */
export function dashboard(name: string): DashboardBuilder {
  return new DashboardBuilder(name)
}

/**
 * Fluent dashboard builder
 */
export class DashboardBuilder {
  private _dashboard: Dashboard

  constructor(name: string) {
    this._dashboard = { name, views: [] }
  }

  describe(description: string): this {
    this._dashboard.description = description
    return this
  }

  add(
    viewDef: View,
    options?: {
      x?: number
      y?: number
      width?: number
      height?: number
      visualization?: Visualization
    }
  ): this {
    this._dashboard.views.push(viewDef)
    if (options && this._dashboard.layout) {
      const item: DashboardItem = {
        viewName: viewDef.name,
        x: options.x || 0,
        y: options.y || 0,
        width: options.width || 1,
        height: options.height || 1,
      }
      if (options.visualization !== undefined) item.visualization = options.visualization
      this._dashboard.layout.items.push(item)
    }
    return this
  }

  layout(columns: number, rows: number): this {
    this._dashboard.layout = { columns, rows, items: [] }
    return this
  }

  refresh(interval: string): this {
    this._dashboard.refreshInterval = interval
    return this
  }

  owner(owner: string): this {
    this._dashboard.owner = owner
    return this
  }

  tags(...tags: string[]): this {
    this._dashboard.tags = tags
    return this
  }

  build(): Dashboard {
    return { ...this._dashboard }
  }
}

// =============================================================================
// Pre-built Dashboards
// =============================================================================

/**
 * Executive SaaS Dashboard
 */
export const ExecutiveDashboard = dashboard('executive')
  .describe('Executive overview of key SaaS metrics')
  .layout(4, 3)
  .add(view('mrr', MrrOverview).build(), {
    x: 0,
    y: 0,
    width: 2,
    height: 1,
    visualization: 'trend',
  })
  .add(view('arr_segments', ArrBySegment).build(), {
    x: 2,
    y: 0,
    width: 2,
    height: 1,
    visualization: 'bar',
  })
  .add(view('unit_econ', UnitEconomics).build(), {
    x: 0,
    y: 1,
    width: 2,
    height: 1,
    visualization: 'table',
  })
  .add(view('growth', GrowthMetrics).build(), {
    x: 2,
    y: 1,
    width: 2,
    height: 1,
    visualization: 'line',
  })
  .add(view('cohorts', CohortRetention).build(), {
    x: 0,
    y: 2,
    width: 4,
    height: 1,
    visualization: 'cohort',
  })
  .refresh('5m')
  .tags('executive', 'saas', 'metrics')
  .build()

// =============================================================================
// Query Execution Types (Interface with ai-database)
// =============================================================================

/**
 * Query result row
 */
export type QueryRow = Record<string, unknown>

/**
 * Query result
 */
export interface QueryResult {
  query: Query
  rows: QueryRow[]
  rowCount: number
  executionTimeMs: number
  cached?: boolean
  metadata?: Record<string, unknown>
}

/**
 * Query executor interface (implemented by ai-database)
 */
export interface QueryExecutor {
  execute(query: Query): Promise<QueryResult>
  explain(query: Query): Promise<string>
  validate(query: Query): Promise<{ valid: boolean; errors?: string[] }>
}

/**
 * Streaming query result
 */
export interface StreamingQueryResult {
  query: Query
  stream: AsyncIterable<QueryRow>
  cancel: () => void
}

/**
 * Streaming query executor interface
 */
export interface StreamingQueryExecutor extends QueryExecutor {
  stream(query: Query): StreamingQueryResult
}
