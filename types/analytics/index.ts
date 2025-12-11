/**
 * Analytics Types
 *
 * Types for Data & Analytics domain:
 * Metrics, Dashboards, Reports, ETL, Events, Experiments, and more.
 *
 * @module analytics
 */

import type {
  Input,
  Output,
  Action,
  BaseEvent,
  EventHandler,
  CRUDResource,
  ListParams,
  PaginatedResult,
} from '@/core/rpc'

// =============================================================================
// Metric - Metric Definition
// =============================================================================

/**
 * Metric type.
 */
export type MetricType = 'count' | 'sum' | 'average' | 'min' | 'max' | 'ratio' | 'percentage' | 'custom'

/**
 * Aggregation type.
 */
export type AggregationType = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'median' | 'percentile' | 'distinct_count'

/**
 * Time granularity for metrics.
 */
export type TimeGranularity = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year'

/**
 * Metric definition for tracking KPIs and measurements.
 *
 * Metrics define what to measure, how to calculate it,
 * and how to display it in dashboards and reports.
 *
 * @example
 * ```ts
 * const revenueMetric: Metric = {
 *   id: 'metric_mrr',
 *   name: 'Monthly Recurring Revenue',
 *   type: 'sum',
 *   description: 'Total MRR across all active subscriptions',
 *   unit: 'USD',
 *   aggregation: 'sum',
 *   formula: 'SUM(subscription_amount WHERE status = active)',
 *   datasetId: 'ds_subscriptions',
 *   dimensionIds: ['dim_product', 'dim_plan'],
 *   tags: ['revenue', 'saas'],
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   metadata: { category: 'financial' }
 * }
 * ```
 */
export interface Metric {
  /** Unique identifier */
  id: string

  /** Metric name */
  name: string

  /** Metric type */
  type: MetricType

  /** Human-readable description */
  description?: string

  /** Unit of measurement */
  unit?: string

  /** Aggregation method */
  aggregation: AggregationType

  /** Calculation formula/expression */
  formula?: string

  /** SQL query (if applicable) */
  query?: string

  /** Source dataset ID */
  datasetId?: string

  /** Dimension IDs for slicing */
  dimensionIds?: string[]

  /** Filter conditions */
  filters?: Record<string, unknown>

  /** Tags for organization */
  tags?: string[]

  /** Display format */
  format?: {
    decimals?: number
    prefix?: string
    suffix?: string
    compact?: boolean
  }

  /** Target/goal value */
  target?: number

  /** Threshold configuration */
  thresholds?: {
    critical?: number
    warning?: number
    good?: number
  }

  /** Owner user ID */
  ownerId?: string

  /** Is this a critical metric? */
  isCritical?: boolean

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MetricInput = Input<Metric>
export type MetricOutput = Output<Metric>

// =============================================================================
// MetricValue - Metric Data Point
// =============================================================================

/**
 * A single data point for a metric.
 *
 * @example
 * ```ts
 * const mrrValue: MetricValue = {
 *   id: 'mv_123',
 *   metricId: 'metric_mrr',
 *   value: 125000,
 *   timestamp: new Date('2024-01-31'),
 *   dimensions: { product: 'crm', plan: 'enterprise' },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface MetricValue {
  /** Unique identifier */
  id: string

  /** Metric ID */
  metricId: string

  /** Measured value */
  value: number

  /** Timestamp of measurement */
  timestamp: Date

  /** Dimension values */
  dimensions?: Record<string, string | number>

  /** Additional context */
  context?: Record<string, unknown>

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MetricValueInput = Input<MetricValue>
export type MetricValueOutput = Output<MetricValue>

// =============================================================================
// Dimension - Analytics Dimension
// =============================================================================

/**
 * Dimension type.
 */
export type DimensionType = 'string' | 'number' | 'date' | 'boolean' | 'category' | 'geography'

/**
 * A dimension for slicing and dicing data.
 *
 * @example
 * ```ts
 * const productDimension: Dimension = {
 *   id: 'dim_product',
 *   name: 'Product',
 *   type: 'category',
 *   description: 'Product identifier',
 *   values: ['crm', 'analytics', 'automation'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Dimension {
  /** Unique identifier */
  id: string

  /** Dimension name */
  name: string

  /** Dimension type */
  type: DimensionType

  /** Human-readable description */
  description?: string

  /** Column/field name in dataset */
  fieldName?: string

  /** Possible values (for categories) */
  values?: string[]

  /** Hierarchical parent dimension ID */
  parentDimensionId?: string

  /** Sort order */
  sortOrder?: number

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DimensionInput = Input<Dimension>
export type DimensionOutput = Output<Dimension>

// =============================================================================
// Measure - Analytics Measure
// =============================================================================

/**
 * A quantitative measure used in analytics.
 *
 * @example
 * ```ts
 * const totalRevenue: Measure = {
 *   id: 'measure_revenue',
 *   name: 'Total Revenue',
 *   aggregation: 'sum',
 *   fieldName: 'amount',
 *   datasetId: 'ds_transactions',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Measure {
  /** Unique identifier */
  id: string

  /** Measure name */
  name: string

  /** Aggregation type */
  aggregation: AggregationType

  /** Field name in dataset */
  fieldName: string

  /** Source dataset ID */
  datasetId: string

  /** Human-readable description */
  description?: string

  /** Display format */
  format?: {
    decimals?: number
    prefix?: string
    suffix?: string
  }

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MeasureInput = Input<Measure>
export type MeasureOutput = Output<Measure>

// =============================================================================
// Dashboard - Analytics Dashboard
// =============================================================================

/**
 * Dashboard visibility.
 */
export type DashboardVisibility = 'private' | 'shared' | 'public'

/**
 * Dashboard layout type.
 */
export type DashboardLayout = 'grid' | 'freeform' | 'responsive'

/**
 * Analytics dashboard for visualizing metrics.
 *
 * @example
 * ```ts
 * const execDashboard: Dashboard = {
 *   id: 'dash_exec',
 *   name: 'Executive Dashboard',
 *   description: 'Key business metrics',
 *   layout: 'grid',
 *   visibility: 'shared',
 *   widgetIds: ['widget_mrr', 'widget_churn', 'widget_growth'],
 *   refreshInterval: 300,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Dashboard {
  /** Unique identifier */
  id: string

  /** Dashboard name */
  name: string

  /** Human-readable description */
  description?: string

  /** Layout type */
  layout: DashboardLayout

  /** Visibility setting */
  visibility: DashboardVisibility

  /** Widget IDs in order */
  widgetIds?: string[]

  /** Layout configuration */
  layoutConfig?: {
    columns?: number
    rowHeight?: number
    margins?: { x: number; y: number }
  }

  /** Time range */
  timeRange?: {
    from?: Date
    to?: Date
    relative?: string
  }

  /** Auto-refresh interval (seconds) */
  refreshInterval?: number

  /** Filters applied to all widgets */
  globalFilters?: Record<string, unknown>

  /** Owner user ID */
  ownerId?: string

  /** Shared with user/team IDs */
  sharedWith?: string[]

  /** Tags for organization */
  tags?: string[]

  /** Is this dashboard favorited? */
  isFavorite?: boolean

  /** View count */
  viewCount?: number

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DashboardInput = Input<Dashboard>
export type DashboardOutput = Output<Dashboard>

// =============================================================================
// DashboardWidget - Dashboard Widget
// =============================================================================

/**
 * Widget type.
 */
export type WidgetType =
  | 'line_chart'
  | 'bar_chart'
  | 'pie_chart'
  | 'donut_chart'
  | 'area_chart'
  | 'scatter_plot'
  | 'table'
  | 'big_number'
  | 'gauge'
  | 'funnel'
  | 'heatmap'
  | 'custom'

/**
 * A widget on a dashboard.
 *
 * @example
 * ```ts
 * const mrrWidget: DashboardWidget = {
 *   id: 'widget_mrr',
 *   dashboardId: 'dash_exec',
 *   type: 'line_chart',
 *   title: 'MRR Growth',
 *   metricIds: ['metric_mrr'],
 *   position: { x: 0, y: 0, w: 6, h: 4 },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface DashboardWidget {
  /** Unique identifier */
  id: string

  /** Dashboard ID */
  dashboardId: string

  /** Widget type */
  type: WidgetType

  /** Widget title */
  title: string

  /** Widget description */
  description?: string

  /** Metric IDs to display */
  metricIds?: string[]

  /** Query ID (alternative to metrics) */
  queryId?: string

  /** Chart ID (alternative to metrics) */
  chartId?: string

  /** Position and size */
  position?: {
    x: number
    y: number
    w: number
    h: number
  }

  /** Widget-specific configuration */
  config?: {
    colors?: string[]
    showLegend?: boolean
    showAxes?: boolean
    comparison?: 'previous_period' | 'year_over_year'
    goal?: number
    [key: string]: unknown
  }

  /** Widget filters */
  filters?: Record<string, unknown>

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DashboardWidgetInput = Input<DashboardWidget>
export type DashboardWidgetOutput = Output<DashboardWidget>

// =============================================================================
// Report - Scheduled Report
// =============================================================================

/**
 * Report format.
 */
export type ReportFormat = 'pdf' | 'excel' | 'csv' | 'html' | 'json'

/**
 * Report frequency.
 */
export type ReportFrequency = 'once' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly'

/**
 * Report status.
 */
export type ReportStatus = 'draft' | 'active' | 'paused' | 'archived'

/**
 * Scheduled or on-demand report.
 *
 * @example
 * ```ts
 * const weeklyReport: Report = {
 *   id: 'report_weekly',
 *   name: 'Weekly Metrics Report',
 *   description: 'Key metrics for leadership',
 *   frequency: 'weekly',
 *   format: 'pdf',
 *   status: 'active',
 *   dashboardId: 'dash_exec',
 *   recipients: ['ceo@example.com', 'cfo@example.com'],
 *   scheduleConfig: { dayOfWeek: 1, hour: 9 },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Report {
  /** Unique identifier */
  id: string

  /** Report name */
  name: string

  /** Human-readable description */
  description?: string

  /** Report frequency */
  frequency: ReportFrequency

  /** Output format */
  format: ReportFormat

  /** Current status */
  status: ReportStatus

  /** Dashboard ID to report on */
  dashboardId?: string

  /** Metric IDs to include */
  metricIds?: string[]

  /** Query IDs to include */
  queryIds?: string[]

  /** Recipient email addresses */
  recipients?: string[]

  /** Schedule configuration */
  scheduleConfig?: {
    dayOfWeek?: number
    dayOfMonth?: number
    hour?: number
    minute?: number
    timezone?: string
  }

  /** Time range for report data */
  timeRange?: {
    from?: Date
    to?: Date
    relative?: string
  }

  /** Filters for report data */
  filters?: Record<string, unknown>

  /** Template ID */
  templateId?: string

  /** Owner user ID */
  ownerId?: string

  /** Last run timestamp */
  lastRunAt?: Date

  /** Next scheduled run */
  nextRunAt?: Date

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ReportInput = Input<Report>
export type ReportOutput = Output<Report>

// =============================================================================
// ReportSchedule - Report Schedule Record
// =============================================================================

/**
 * Run status.
 */
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * A scheduled report execution record.
 *
 * @example
 * ```ts
 * const schedule: ReportSchedule = {
 *   id: 'sched_123',
 *   reportId: 'report_weekly',
 *   status: 'completed',
 *   scheduledAt: new Date('2024-01-29T09:00:00Z'),
 *   startedAt: new Date('2024-01-29T09:00:05Z'),
 *   completedAt: new Date('2024-01-29T09:02:30Z'),
 *   outputUrl: 'https://storage.example.com/reports/weekly-2024-01-29.pdf',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ReportSchedule {
  /** Unique identifier */
  id: string

  /** Report ID */
  reportId: string

  /** Execution status */
  status: RunStatus

  /** Scheduled time */
  scheduledAt: Date

  /** Actual start time */
  startedAt?: Date

  /** Completion time */
  completedAt?: Date

  /** Output file URL */
  outputUrl?: string

  /** File size (bytes) */
  fileSize?: number

  /** Error message (if failed) */
  error?: string

  /** Recipients who received this */
  recipients?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ReportScheduleInput = Input<ReportSchedule>
export type ReportScheduleOutput = Output<ReportSchedule>

// =============================================================================
// Chart - Chart Configuration
// =============================================================================

/**
 * Chart type.
 */
export type ChartType =
  | 'line'
  | 'bar'
  | 'column'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'bubble'
  | 'heatmap'
  | 'funnel'
  | 'gauge'
  | 'table'

/**
 * A reusable chart configuration.
 *
 * @example
 * ```ts
 * const revenueChart: Chart = {
 *   id: 'chart_revenue',
 *   name: 'Revenue Trend',
 *   type: 'line',
 *   queryId: 'query_monthly_revenue',
 *   config: {
 *     xAxis: 'month',
 *     yAxis: 'revenue',
 *     colors: ['#0088FE'],
 *     showLegend: true
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Chart {
  /** Unique identifier */
  id: string

  /** Chart name */
  name: string

  /** Chart type */
  type: ChartType

  /** Human-readable description */
  description?: string

  /** Query ID for data */
  queryId?: string

  /** Dataset ID (alternative to query) */
  datasetId?: string

  /** Metric IDs (alternative to query) */
  metricIds?: string[]

  /** Chart configuration */
  config?: {
    xAxis?: string
    yAxis?: string | string[]
    colors?: string[]
    showLegend?: boolean
    showAxes?: boolean
    stacked?: boolean
    smooth?: boolean
    goal?: number
    [key: string]: unknown
  }

  /** Owner user ID */
  ownerId?: string

  /** Tags for organization */
  tags?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ChartInput = Input<Chart>
export type ChartOutput = Output<Chart>

// =============================================================================
// Query - Saved Query
// =============================================================================

/**
 * Query language/type.
 */
export type QueryLanguage = 'sql' | 'graphql' | 'mongodb' | 'elasticsearch' | 'custom'

/**
 * A saved query for analytics.
 *
 * @example
 * ```ts
 * const monthlyRevenueQuery: Query = {
 *   id: 'query_monthly_revenue',
 *   name: 'Monthly Revenue',
 *   language: 'sql',
 *   query: 'SELECT DATE_TRUNC(month, created_at) as month, SUM(amount) as revenue FROM transactions GROUP BY month',
 *   datasetId: 'ds_transactions',
 *   parameters: [{ name: 'start_date', type: 'date' }],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Query {
  /** Unique identifier */
  id: string

  /** Query name */
  name: string

  /** Query language */
  language: QueryLanguage

  /** Human-readable description */
  description?: string

  /** Query string */
  query: string

  /** Source dataset ID */
  datasetId?: string

  /** Query parameters */
  parameters?: Array<{
    name: string
    type: string
    defaultValue?: unknown
    required?: boolean
  }>

  /** Result schema */
  schema?: Array<{
    name: string
    type: string
  }>

  /** Owner user ID */
  ownerId?: string

  /** Tags for organization */
  tags?: string[]

  /** Is this query verified/trusted? */
  isVerified?: boolean

  /** Last run timestamp */
  lastRunAt?: Date

  /** Execution count */
  runCount?: number

  /** Average execution time (ms) */
  avgExecutionTime?: number

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type QueryInput = Input<Query>
export type QueryOutput = Output<Query>

// =============================================================================
// Dataset - Data Source/Table
// =============================================================================

/**
 * Dataset type.
 */
export type DatasetType = 'table' | 'view' | 'materialized_view' | 'external' | 'virtual'

/**
 * Update frequency.
 */
export type UpdateFrequency = 'realtime' | 'streaming' | 'batch' | 'scheduled' | 'manual'

/**
 * A dataset/table in the analytics system.
 *
 * @example
 * ```ts
 * const transactionsDataset: Dataset = {
 *   id: 'ds_transactions',
 *   name: 'Transactions',
 *   type: 'table',
 *   dataSourceId: 'datasource_pg',
 *   tableName: 'transactions',
 *   rowCount: 1500000,
 *   updateFrequency: 'realtime',
 *   schema: [
 *     { name: 'id', type: 'string', isPrimaryKey: true },
 *     { name: 'amount', type: 'number' },
 *     { name: 'created_at', type: 'timestamp' }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Dataset {
  /** Unique identifier */
  id: string

  /** Dataset name */
  name: string

  /** Dataset type */
  type: DatasetType

  /** Human-readable description */
  description?: string

  /** Data source ID */
  dataSourceId?: string

  /** Table/collection name */
  tableName?: string

  /** Schema definition */
  schema?: Array<{
    name: string
    type: string
    description?: string
    isPrimaryKey?: boolean
    isNullable?: boolean
  }>

  /** Row count */
  rowCount?: number

  /** Data size (bytes) */
  dataSize?: number

  /** Update frequency */
  updateFrequency?: UpdateFrequency

  /** Last updated timestamp */
  lastUpdatedAt?: Date

  /** Partition configuration */
  partitioning?: {
    type: 'range' | 'hash' | 'list'
    column: string
    interval?: string
  }

  /** Owner user ID */
  ownerId?: string

  /** Tags for organization */
  tags?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DatasetInput = Input<Dataset>
export type DatasetOutput = Output<Dataset>

// =============================================================================
// DataSource - External Data Connection
// =============================================================================

/**
 * Data source type.
 */
export type DataSourceType =
  | 'postgres'
  | 'mysql'
  | 'mongodb'
  | 'bigquery'
  | 'snowflake'
  | 'redshift'
  | 'clickhouse'
  | 'elasticsearch'
  | 's3'
  | 'api'
  | 'custom'

/**
 * Connection status.
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'testing'

/**
 * An external data source connection.
 *
 * @example
 * ```ts
 * const pgDataSource: DataSource = {
 *   id: 'datasource_pg',
 *   name: 'Production PostgreSQL',
 *   type: 'postgres',
 *   status: 'connected',
 *   config: {
 *     host: 'db.example.com',
 *     port: 5432,
 *     database: 'production',
 *     ssl: true
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface DataSource {
  /** Unique identifier */
  id: string

  /** Data source name */
  name: string

  /** Data source type */
  type: DataSourceType

  /** Human-readable description */
  description?: string

  /** Connection status */
  status: ConnectionStatus

  /** Connection configuration */
  config?: {
    host?: string
    port?: number
    database?: string
    username?: string
    ssl?: boolean
    [key: string]: unknown
  }

  /** Credentials reference (encrypted) */
  credentialsId?: string

  /** Last connection test */
  lastTestedAt?: Date

  /** Last sync timestamp */
  lastSyncedAt?: Date

  /** Owner user ID */
  ownerId?: string

  /** Tags for organization */
  tags?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DataSourceInput = Input<DataSource>
export type DataSourceOutput = Output<DataSource>

// =============================================================================
// ETLJob - ETL/Data Pipeline Job
// =============================================================================

/**
 * ETL job type.
 */
export type ETLJobType = 'extract' | 'transform' | 'load' | 'full_pipeline'

/**
 * ETL status.
 */
export type ETLStatus = 'idle' | 'scheduled' | 'running' | 'completed' | 'failed' | 'paused'

/**
 * An ETL/data pipeline job definition.
 *
 * @example
 * ```ts
 * const dailyETL: ETLJob = {
 *   id: 'etl_daily',
 *   name: 'Daily Analytics Pipeline',
 *   type: 'full_pipeline',
 *   status: 'idle',
 *   sourceDataSourceId: 'datasource_pg',
 *   targetDataSourceId: 'datasource_warehouse',
 *   schedule: '0 2 * * *',
 *   transformations: ['transform_clean', 'transform_aggregate'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ETLJob {
  /** Unique identifier */
  id: string

  /** Job name */
  name: string

  /** Job type */
  type: ETLJobType

  /** Human-readable description */
  description?: string

  /** Current status */
  status: ETLStatus

  /** Source data source ID */
  sourceDataSourceId?: string

  /** Target data source ID */
  targetDataSourceId?: string

  /** Source query/table */
  sourceQuery?: string

  /** Target table */
  targetTable?: string

  /** Schedule (cron expression) */
  schedule?: string

  /** Transformation IDs to apply */
  transformations?: string[]

  /** Job configuration */
  config?: {
    batchSize?: number
    parallelism?: number
    retryAttempts?: number
    timeout?: number
    [key: string]: unknown
  }

  /** Last run timestamp */
  lastRunAt?: Date

  /** Next scheduled run */
  nextRunAt?: Date

  /** Run count */
  runCount?: number

  /** Success rate (0-1) */
  successRate?: number

  /** Owner user ID */
  ownerId?: string

  /** Tags for organization */
  tags?: string[]

  /** Is job enabled? */
  isEnabled?: boolean

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    airflow?: string
    prefect?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ETLJobInput = Input<ETLJob>
export type ETLJobOutput = Output<ETLJob>

// =============================================================================
// ETLRun - ETL Run Record
// =============================================================================

/**
 * An ETL job execution record.
 *
 * @example
 * ```ts
 * const run: ETLRun = {
 *   id: 'run_123',
 *   jobId: 'etl_daily',
 *   status: 'completed',
 *   startedAt: new Date('2024-01-29T02:00:00Z'),
 *   completedAt: new Date('2024-01-29T02:15:30Z'),
 *   recordsProcessed: 150000,
 *   recordsFailed: 5,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ETLRun {
  /** Unique identifier */
  id: string

  /** ETL job ID */
  jobId: string

  /** Run status */
  status: RunStatus

  /** Start time */
  startedAt: Date

  /** Completion time */
  completedAt?: Date

  /** Duration (seconds) */
  duration?: number

  /** Records processed */
  recordsProcessed?: number

  /** Records failed */
  recordsFailed?: number

  /** Bytes processed */
  bytesProcessed?: number

  /** Error message (if failed) */
  error?: string

  /** Error stack trace */
  errorStack?: string

  /** Run logs */
  logs?: Array<{
    timestamp: Date
    level: 'debug' | 'info' | 'warn' | 'error'
    message: string
  }>

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    airflow?: string
    prefect?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ETLRunInput = Input<ETLRun>
export type ETLRunOutput = Output<ETLRun>

// =============================================================================
// Transformation - Data Transformation
// =============================================================================

/**
 * Transformation type.
 */
export type TransformationType =
  | 'filter'
  | 'map'
  | 'aggregate'
  | 'join'
  | 'pivot'
  | 'unpivot'
  | 'normalize'
  | 'denormalize'
  | 'custom'

/**
 * A data transformation definition.
 *
 * @example
 * ```ts
 * const cleanTransform: Transformation = {
 *   id: 'transform_clean',
 *   name: 'Clean Customer Data',
 *   type: 'custom',
 *   description: 'Remove duplicates and normalize emails',
 *   code: 'function transform(row) { return { ...row, email: row.email.toLowerCase().trim() }; }',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Transformation {
  /** Unique identifier */
  id: string

  /** Transformation name */
  name: string

  /** Transformation type */
  type: TransformationType

  /** Human-readable description */
  description?: string

  /** Transformation code/expression */
  code?: string

  /** SQL expression (if applicable) */
  sql?: string

  /** Configuration */
  config?: Record<string, unknown>

  /** Input schema */
  inputSchema?: Array<{
    name: string
    type: string
  }>

  /** Output schema */
  outputSchema?: Array<{
    name: string
    type: string
  }>

  /** Owner user ID */
  ownerId?: string

  /** Tags for organization */
  tags?: string[]

  /** Is this transformation verified? */
  isVerified?: boolean

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TransformationInput = Input<Transformation>
export type TransformationOutput = Output<Transformation>

// =============================================================================
// Event - Analytics Event (Product Event)
// =============================================================================

/**
 * Event type.
 */
export type EventType = 'track' | 'page' | 'screen' | 'identify' | 'group' | 'alias'

/**
 * An analytics event (product event).
 *
 * Note: This is different from BaseEvent which is for system events.
 * This represents product analytics events like "User Signed Up".
 *
 * @example
 * ```ts
 * const signupEvent: Event = {
 *   id: 'evt_123',
 *   type: 'track',
 *   name: 'User Signed Up',
 *   userId: 'user_456',
 *   timestamp: new Date(),
 *   properties: {
 *     plan: 'pro',
 *     source: 'website',
 *     referrer: 'google'
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Event {
  /** Unique identifier */
  id: string

  /** Event type */
  type: EventType

  /** Event name */
  name: string

  /** User ID */
  userId?: string

  /** Anonymous ID */
  anonymousId?: string

  /** Session ID */
  sessionId?: string

  /** Event timestamp */
  timestamp: Date

  /** Event properties */
  properties?: Record<string, unknown>

  /** User traits (for identify events) */
  traits?: Record<string, unknown>

  /** Context information */
  context?: {
    ip?: string
    userAgent?: string
    locale?: string
    timezone?: string
    page?: {
      url?: string
      path?: string
      referrer?: string
      title?: string
    }
    device?: {
      type?: string
      manufacturer?: string
      model?: string
    }
    os?: {
      name?: string
      version?: string
    }
    app?: {
      name?: string
      version?: string
      build?: string
    }
    [key: string]: unknown
  }

  /** Event property IDs */
  eventPropertyIds?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    heap?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EventInput = Input<Event>
export type EventOutput = Output<Event>

// =============================================================================
// EventProperty - Event Property Definition
// =============================================================================

/**
 * Property data type.
 */
export type PropertyDataType = 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array'

/**
 * An event property definition.
 *
 * @example
 * ```ts
 * const planProperty: EventProperty = {
 *   id: 'prop_plan',
 *   name: 'plan',
 *   dataType: 'string',
 *   description: 'Subscription plan name',
 *   possibleValues: ['free', 'pro', 'enterprise'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface EventProperty {
  /** Unique identifier */
  id: string

  /** Property name */
  name: string

  /** Data type */
  dataType: PropertyDataType

  /** Human-readable description */
  description?: string

  /** Possible values (for enums) */
  possibleValues?: string[]

  /** Is this property required? */
  isRequired?: boolean

  /** Example value */
  example?: unknown

  /** Related event names */
  eventNames?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EventPropertyInput = Input<EventProperty>
export type EventPropertyOutput = Output<EventProperty>

// =============================================================================
// UserProfile - Analytics User Profile
// =============================================================================

/**
 * User lifecycle stage.
 */
export type UserLifecycleStage = 'new' | 'active' | 'engaged' | 'power_user' | 'at_risk' | 'dormant' | 'churned'

/**
 * An analytics user profile.
 *
 * @example
 * ```ts
 * const profile: UserProfile = {
 *   id: 'profile_123',
 *   userId: 'user_456',
 *   email: 'john@example.com',
 *   lifecycleStage: 'active',
 *   firstSeenAt: new Date('2024-01-01'),
 *   lastSeenAt: new Date('2024-01-29'),
 *   eventCount: 1250,
 *   traits: { plan: 'pro', company: 'Acme' },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface UserProfile {
  /** Unique identifier */
  id: string

  /** User ID */
  userId?: string

  /** Anonymous ID */
  anonymousId?: string

  /** Email address */
  email?: string

  /** Display name */
  name?: string

  /** Lifecycle stage */
  lifecycleStage?: UserLifecycleStage

  /** First seen timestamp */
  firstSeenAt?: Date

  /** Last seen timestamp */
  lastSeenAt?: Date

  /** Total event count */
  eventCount?: number

  /** Session count */
  sessionCount?: number

  /** User traits/properties */
  traits?: Record<string, unknown>

  /** UTM parameters */
  utm?: {
    source?: string
    medium?: string
    campaign?: string
    term?: string
    content?: string
  }

  /** Referrer */
  referrer?: string

  /** Segment IDs */
  segmentIds?: string[]

  /** Cohort IDs */
  cohortIds?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    intercom?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type UserProfileInput = Input<UserProfile>
export type UserProfileOutput = Output<UserProfile>

// =============================================================================
// Segment - User/Data Segment
// =============================================================================

/**
 * Segment type.
 */
export type SegmentType = 'static' | 'dynamic' | 'behavioral' | 'demographic'

/**
 * A user or data segment.
 *
 * @example
 * ```ts
 * const powerUsersSegment: Segment = {
 *   id: 'seg_power',
 *   name: 'Power Users',
 *   type: 'dynamic',
 *   description: 'Users with >100 events in last 30 days',
 *   conditions: {
 *     all: [
 *       { property: 'event_count_30d', operator: 'gte', value: 100 }
 *     ]
 *   },
 *   userCount: 1500,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Segment {
  /** Unique identifier */
  id: string

  /** Segment name */
  name: string

  /** Segment type */
  type: SegmentType

  /** Human-readable description */
  description?: string

  /** Segment conditions/filters */
  conditions?: {
    all?: Array<{
      property: string
      operator: string
      value: unknown
    }>
    any?: Array<{
      property: string
      operator: string
      value: unknown
    }>
  }

  /** Static user IDs (for static segments) */
  userIds?: string[]

  /** User count */
  userCount?: number

  /** Last computed timestamp */
  lastComputedAt?: Date

  /** Owner user ID */
  ownerId?: string

  /** Tags for organization */
  tags?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SegmentInput = Input<Segment>
export type SegmentOutput = Output<Segment>

// =============================================================================
// Cohort - User Cohort
// =============================================================================

/**
 * Cohort type.
 */
export type CohortType = 'acquisition' | 'behavioral' | 'custom'

/**
 * A user cohort grouped by time or behavior.
 *
 * @example
 * ```ts
 * const janCohort: Cohort = {
 *   id: 'cohort_jan2024',
 *   name: 'January 2024 Signups',
 *   type: 'acquisition',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-01-31'),
 *   userCount: 450,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Cohort {
  /** Unique identifier */
  id: string

  /** Cohort name */
  name: string

  /** Cohort type */
  type: CohortType

  /** Human-readable description */
  description?: string

  /** Cohort start date */
  startDate?: Date

  /** Cohort end date */
  endDate?: Date

  /** Criteria for cohort membership */
  criteria?: {
    event?: string
    property?: string
    value?: unknown
    filters?: Record<string, unknown>
  }

  /** User count */
  userCount?: number

  /** User IDs */
  userIds?: string[]

  /** Retention data */
  retention?: Array<{
    period: number
    rate: number
    userCount: number
  }>

  /** Owner user ID */
  ownerId?: string

  /** Tags for organization */
  tags?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CohortInput = Input<Cohort>
export type CohortOutput = Output<Cohort>

// =============================================================================
// Funnel - Conversion Funnel
// =============================================================================

/**
 * A conversion funnel definition.
 *
 * @example
 * ```ts
 * const signupFunnel: Funnel = {
 *   id: 'funnel_signup',
 *   name: 'Signup Funnel',
 *   description: 'User signup flow',
 *   stepIds: ['step_visit', 'step_register', 'step_verify', 'step_complete'],
 *   conversionRate: 0.35,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Funnel {
  /** Unique identifier */
  id: string

  /** Funnel name */
  name: string

  /** Human-readable description */
  description?: string

  /** Funnel step IDs in order */
  stepIds: string[]

  /** Time window for completion */
  timeWindow?: {
    value: number
    unit: 'minutes' | 'hours' | 'days' | 'weeks'
  }

  /** Overall conversion rate (0-1) */
  conversionRate?: number

  /** Filters applied to funnel */
  filters?: Record<string, unknown>

  /** Owner user ID */
  ownerId?: string

  /** Tags for organization */
  tags?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FunnelInput = Input<Funnel>
export type FunnelOutput = Output<Funnel>

// =============================================================================
// FunnelStep - Funnel Step
// =============================================================================

/**
 * A step in a conversion funnel.
 *
 * @example
 * ```ts
 * const registerStep: FunnelStep = {
 *   id: 'step_register',
 *   funnelId: 'funnel_signup',
 *   name: 'Registration Form',
 *   order: 2,
 *   eventName: 'Registration Started',
 *   userCount: 2500,
 *   conversionRate: 0.65,
 *   dropoffRate: 0.35,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface FunnelStep {
  /** Unique identifier */
  id: string

  /** Funnel ID */
  funnelId: string

  /** Step name */
  name: string

  /** Step order/position */
  order: number

  /** Event name for this step */
  eventName: string

  /** Event filters */
  filters?: Record<string, unknown>

  /** User count at this step */
  userCount?: number

  /** Conversion rate to next step (0-1) */
  conversionRate?: number

  /** Dropoff rate from previous step (0-1) */
  dropoffRate?: number

  /** Average time to next step (seconds) */
  avgTimeToNext?: number

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FunnelStepInput = Input<FunnelStep>
export type FunnelStepOutput = Output<FunnelStep>

// =============================================================================
// Experiment - A/B Experiment
// =============================================================================

/**
 * Experiment status.
 */
export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived'

/**
 * Experiment type.
 */
export type ExperimentType = 'ab_test' | 'multivariate' | 'feature_flag' | 'personalization'

/**
 * An A/B test or experiment.
 *
 * @example
 * ```ts
 * const pricingExperiment: Experiment = {
 *   id: 'exp_pricing',
 *   name: 'Pricing Page Test',
 *   type: 'ab_test',
 *   status: 'running',
 *   description: 'Test new pricing page design',
 *   hypothesis: 'New design will increase conversions by 10%',
 *   variantIds: ['var_control', 'var_treatment'],
 *   metricIds: ['metric_conversion', 'metric_revenue'],
 *   startDate: new Date('2024-01-15'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Experiment {
  /** Unique identifier */
  id: string

  /** Experiment name */
  name: string

  /** Experiment type */
  type: ExperimentType

  /** Current status */
  status: ExperimentStatus

  /** Human-readable description */
  description?: string

  /** Hypothesis being tested */
  hypothesis?: string

  /** Variant IDs */
  variantIds: string[]

  /** Metric IDs being tracked */
  metricIds?: string[]

  /** Goal metric ID */
  goalMetricId?: string

  /** Target audience/segment */
  segmentId?: string

  /** Traffic allocation (0-1) */
  trafficAllocation?: number

  /** Start date */
  startDate?: Date

  /** End date */
  endDate?: Date

  /** Minimum sample size */
  minSampleSize?: number

  /** Confidence level required */
  confidenceLevel?: number

  /** Winner variant ID */
  winnerId?: string

  /** Owner user ID */
  ownerId?: string

  /** Tags for organization */
  tags?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    optimizely?: string
    launchdarkly?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ExperimentInput = Input<Experiment>
export type ExperimentOutput = Output<Experiment>

// =============================================================================
// ExperimentVariant - Experiment Variant
// =============================================================================

/**
 * A variant in an experiment.
 *
 * @example
 * ```ts
 * const treatmentVariant: ExperimentVariant = {
 *   id: 'var_treatment',
 *   experimentId: 'exp_pricing',
 *   name: 'New Design',
 *   isControl: false,
 *   allocation: 0.5,
 *   userCount: 2500,
 *   config: { showTestimonials: true, layout: 'grid' },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ExperimentVariant {
  /** Unique identifier */
  id: string

  /** Experiment ID */
  experimentId: string

  /** Variant name */
  name: string

  /** Human-readable description */
  description?: string

  /** Is this the control variant? */
  isControl: boolean

  /** Traffic allocation (0-1) */
  allocation: number

  /** User count */
  userCount?: number

  /** Variant configuration */
  config?: Record<string, unknown>

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    optimizely?: string
    launchdarkly?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ExperimentVariantInput = Input<ExperimentVariant>
export type ExperimentVariantOutput = Output<ExperimentVariant>

// =============================================================================
// ExperimentResult - Experiment Result
// =============================================================================

/**
 * Statistical significance.
 */
export type StatisticalSignificance = 'not_significant' | 'trending' | 'significant' | 'highly_significant'

/**
 * Results for an experiment variant.
 *
 * @example
 * ```ts
 * const result: ExperimentResult = {
 *   id: 'result_123',
 *   experimentId: 'exp_pricing',
 *   variantId: 'var_treatment',
 *   metricId: 'metric_conversion',
 *   value: 0.125,
 *   improvement: 0.15,
 *   significance: 'significant',
 *   pValue: 0.01,
 *   confidenceInterval: { lower: 0.05, upper: 0.25 },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ExperimentResult {
  /** Unique identifier */
  id: string

  /** Experiment ID */
  experimentId: string

  /** Variant ID */
  variantId: string

  /** Metric ID */
  metricId: string

  /** Metric value */
  value: number

  /** Improvement over control */
  improvement?: number

  /** Statistical significance */
  significance?: StatisticalSignificance

  /** P-value */
  pValue?: number

  /** Confidence interval */
  confidenceInterval?: {
    lower: number
    upper: number
  }

  /** Sample size */
  sampleSize?: number

  /** Computed timestamp */
  computedAt?: Date

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    optimizely?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ExperimentResultInput = Input<ExperimentResult>
export type ExperimentResultOutput = Output<ExperimentResult>

// =============================================================================
// Goal - Analytics Goal
// =============================================================================

/**
 * Goal type.
 */
export type GoalType = 'event' | 'metric' | 'funnel' | 'revenue'

/**
 * Goal status.
 */
export type GoalStatus = 'active' | 'achieved' | 'missed' | 'archived'

/**
 * A business or product goal.
 *
 * @example
 * ```ts
 * const revenueGoal: Goal = {
 *   id: 'goal_q1_revenue',
 *   name: 'Q1 Revenue Target',
 *   type: 'metric',
 *   status: 'active',
 *   metricId: 'metric_mrr',
 *   targetValue: 500000,
 *   currentValue: 425000,
 *   deadline: new Date('2024-03-31'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Goal {
  /** Unique identifier */
  id: string

  /** Goal name */
  name: string

  /** Goal type */
  type: GoalType

  /** Current status */
  status: GoalStatus

  /** Human-readable description */
  description?: string

  /** Target metric ID */
  metricId?: string

  /** Target event name */
  eventName?: string

  /** Target funnel ID */
  funnelId?: string

  /** Target value */
  targetValue?: number

  /** Current value */
  currentValue?: number

  /** Progress percentage (0-1) */
  progress?: number

  /** Deadline */
  deadline?: Date

  /** Owner user ID */
  ownerId?: string

  /** Team/department */
  team?: string

  /** Tags for organization */
  tags?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type GoalInput = Input<Goal>
export type GoalOutput = Output<Goal>

// =============================================================================
// Alert - Metric Alert
// =============================================================================

/**
 * Alert severity.
 */
export type AlertSeverity = 'info' | 'warning' | 'critical'

/**
 * Alert status.
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'muted'

/**
 * Condition operator.
 */
export type ConditionOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'change_gt' | 'change_lt'

/**
 * A metric alert configuration.
 *
 * @example
 * ```ts
 * const churnAlert: Alert = {
 *   id: 'alert_churn',
 *   name: 'High Churn Alert',
 *   metricId: 'metric_churn_rate',
 *   condition: {
 *     operator: 'gt',
 *     value: 0.05
 *   },
 *   severity: 'critical',
 *   status: 'active',
 *   recipients: ['ceo@example.com', 'product@example.com'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Alert {
  /** Unique identifier */
  id: string

  /** Alert name */
  name: string

  /** Human-readable description */
  description?: string

  /** Metric ID to monitor */
  metricId: string

  /** Alert condition */
  condition: {
    operator: ConditionOperator
    value: number
    duration?: number
  }

  /** Alert severity */
  severity: AlertSeverity

  /** Current status */
  status: AlertStatus

  /** Notification recipients */
  recipients?: string[]

  /** Notification channels */
  channels?: Array<'email' | 'slack' | 'pagerduty' | 'webhook'>

  /** Webhook URL */
  webhookUrl?: string

  /** Check frequency (minutes) */
  checkFrequency?: number

  /** Last triggered timestamp */
  lastTriggeredAt?: Date

  /** Trigger count */
  triggerCount?: number

  /** Acknowledged by */
  acknowledgedBy?: string

  /** Acknowledged at */
  acknowledgedAt?: Date

  /** Resolved at */
  resolvedAt?: Date

  /** Muted until */
  mutedUntil?: Date

  /** Owner user ID */
  ownerId?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    pagerduty?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AlertInput = Input<Alert>
export type AlertOutput = Output<Alert>

// =============================================================================
// Anomaly - Detected Anomaly
// =============================================================================

/**
 * Anomaly type.
 */
export type AnomalyType = 'spike' | 'drop' | 'trend_change' | 'outlier' | 'missing_data'

/**
 * A detected anomaly in metrics.
 *
 * @example
 * ```ts
 * const anomaly: Anomaly = {
 *   id: 'anomaly_123',
 *   metricId: 'metric_active_users',
 *   type: 'drop',
 *   severity: 'warning',
 *   timestamp: new Date('2024-01-29T14:30:00Z'),
 *   expectedValue: 5000,
 *   actualValue: 3500,
 *   deviation: -0.3,
 *   confidence: 0.95,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Anomaly {
  /** Unique identifier */
  id: string

  /** Metric ID */
  metricId: string

  /** Anomaly type */
  type: AnomalyType

  /** Severity level */
  severity: AlertSeverity

  /** Anomaly timestamp */
  timestamp: Date

  /** Expected value */
  expectedValue?: number

  /** Actual value */
  actualValue?: number

  /** Deviation from expected */
  deviation?: number

  /** Confidence score (0-1) */
  confidence?: number

  /** Explanation/reason */
  explanation?: string

  /** Is this a false positive? */
  isFalsePositive?: boolean

  /** Marked as false positive by */
  falsePositiveMarkedBy?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    amplitude?: string
    mixpanel?: string
    segment?: string
    googleAnalytics?: string
    datadog?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AnomalyInput = Input<Anomaly>
export type AnomalyOutput = Output<Anomaly>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface MetricActions extends CRUDResource<Metric, MetricInput> {
  /** Calculate metric value */
  calculate: Action<{ id: string; startDate?: Date; endDate?: Date; dimensions?: Record<string, string> }, MetricValue>

  /** Get metric values over time */
  getValues: Action<{ id: string; startDate: Date; endDate: Date; granularity?: TimeGranularity } & ListParams, PaginatedResult<MetricValue>>

  /** Add target/goal */
  setTarget: Action<{ id: string; target: number }, Metric>

  /** Compare periods */
  compare: Action<{ id: string; period1: { from: Date; to: Date }; period2: { from: Date; to: Date } }, MetricComparison>
}

export interface MetricValueActions extends CRUDResource<MetricValue, MetricValueInput> {
  /** Record value */
  record: Action<MetricValueInput, MetricValue>

  /** Bulk record values */
  recordBatch: Action<{ values: MetricValueInput[] }, MetricValue[]>
}

export interface DimensionActions extends CRUDResource<Dimension, DimensionInput> {
  /** Get dimension values */
  getValues: Action<{ id: string }, string[]>

  /** Get hierarchy */
  getHierarchy: Action<{ id: string }, Dimension[]>
}

export interface MeasureActions extends CRUDResource<Measure, MeasureInput> {
  /** Calculate measure */
  calculate: Action<{ id: string; filters?: Record<string, unknown> }, number>
}

export interface DashboardActions extends CRUDResource<Dashboard, DashboardInput> {
  /** Clone dashboard */
  clone: Action<{ id: string; name: string }, Dashboard>

  /** Add widget */
  addWidget: Action<{ id: string; widget: DashboardWidgetInput }, DashboardWidget>

  /** Remove widget */
  removeWidget: Action<{ id: string; widgetId: string }, void>

  /** Reorder widgets */
  reorderWidgets: Action<{ id: string; widgetIds: string[] }, Dashboard>

  /** Share with users */
  share: Action<{ id: string; userIds: string[] }, Dashboard>

  /** Unshare */
  unshare: Action<{ id: string; userIds: string[] }, Dashboard>

  /** Get snapshot */
  getSnapshot: Action<{ id: string }, { url: string }>
}

export interface DashboardWidgetActions extends CRUDResource<DashboardWidget, DashboardWidgetInput> {
  /** Get widget data */
  getData: Action<{ id: string; timeRange?: { from: Date; to: Date } }, WidgetData>

  /** Refresh widget */
  refresh: Action<{ id: string }, DashboardWidget>
}

export interface ReportActions extends CRUDResource<Report, ReportInput> {
  /** Generate report now */
  generate: Action<{ id: string }, ReportSchedule>

  /** Pause report */
  pause: Action<{ id: string }, Report>

  /** Resume report */
  resume: Action<{ id: string }, Report>

  /** Send test */
  sendTest: Action<{ id: string; recipients?: string[] }, void>

  /** Get schedules */
  getSchedules: Action<{ id: string } & ListParams, PaginatedResult<ReportSchedule>>
}

export interface ReportScheduleActions extends CRUDResource<ReportSchedule, ReportScheduleInput> {
  /** Download report */
  download: Action<{ id: string }, { url: string; contentType: string }>

  /** Retry failed report */
  retry: Action<{ id: string }, ReportSchedule>
}

export interface ChartActions extends CRUDResource<Chart, ChartInput> {
  /** Get chart data */
  getData: Action<{ id: string; timeRange?: { from: Date; to: Date }; filters?: Record<string, unknown> }, ChartData>

  /** Clone chart */
  clone: Action<{ id: string; name: string }, Chart>
}

export interface QueryActions extends CRUDResource<Query, QueryInput> {
  /** Execute query */
  execute: Action<{ id: string; parameters?: Record<string, unknown>; limit?: number }, QueryResult>

  /** Validate query */
  validate: Action<{ id: string }, { valid: boolean; errors?: string[] }>

  /** Get execution history */
  getHistory: Action<{ id: string } & ListParams, PaginatedResult<QueryExecution>>

  /** Clone query */
  clone: Action<{ id: string; name: string }, Query>
}

export interface DatasetActions extends CRUDResource<Dataset, DatasetInput> {
  /** Preview data */
  preview: Action<{ id: string; limit?: number }, { rows: unknown[]; schema: Dataset['schema'] }>

  /** Get statistics */
  getStats: Action<{ id: string }, DatasetStats>

  /** Refresh dataset */
  refresh: Action<{ id: string }, Dataset>

  /** Get lineage */
  getLineage: Action<{ id: string }, DataLineage>
}

export interface DataSourceActions extends CRUDResource<DataSource, DataSourceInput> {
  /** Test connection */
  test: Action<{ id: string }, { success: boolean; message?: string; latency?: number }>

  /** Sync schemas */
  sync: Action<{ id: string }, { datasets: Dataset[] }>

  /** Get datasets */
  getDatasets: Action<{ id: string } & ListParams, PaginatedResult<Dataset>>
}

export interface ETLJobActions extends CRUDResource<ETLJob, ETLJobInput> {
  /** Run job now */
  run: Action<{ id: string }, ETLRun>

  /** Enable job */
  enable: Action<{ id: string }, ETLJob>

  /** Disable job */
  disable: Action<{ id: string }, ETLJob>

  /** Get runs */
  getRuns: Action<{ id: string } & ListParams, PaginatedResult<ETLRun>>

  /** Get metrics */
  getMetrics: Action<{ id: string; from?: Date; to?: Date }, ETLMetrics>
}

export interface ETLRunActions extends CRUDResource<ETLRun, ETLRunInput> {
  /** Cancel run */
  cancel: Action<{ id: string }, ETLRun>

  /** Retry run */
  retry: Action<{ id: string }, ETLRun>

  /** Get logs */
  getLogs: Action<{ id: string; limit?: number }, { logs: ETLRun['logs'] }>
}

export interface TransformationActions extends CRUDResource<Transformation, TransformationInput> {
  /** Test transformation */
  test: Action<{ id: string; sampleData: unknown[] }, { output: unknown[]; errors?: string[] }>

  /** Verify transformation */
  verify: Action<{ id: string }, Transformation>
}

export interface EventActions extends CRUDResource<Event, EventInput> {
  /** Track event */
  track: Action<Omit<EventInput, 'type'> & { type?: EventType }, Event>

  /** Identify user */
  identify: Action<{ userId: string; traits: Record<string, unknown> }, Event>

  /** Get event counts */
  getCounts: Action<{ name?: string; startDate: Date; endDate: Date; granularity?: TimeGranularity }, EventCounts>

  /** Get top events */
  getTop: Action<{ startDate: Date; endDate: Date; limit?: number }, Array<{ name: string; count: number }>>
}

export interface EventPropertyActions extends CRUDResource<EventProperty, EventPropertyInput> {
  /** Get property values */
  getValues: Action<{ id: string; limit?: number }, string[]>
}

export interface UserProfileActions extends CRUDResource<UserProfile, UserProfileInput> {
  /** Update traits */
  updateTraits: Action<{ id: string; traits: Record<string, unknown> }, UserProfile>

  /** Get events */
  getEvents: Action<{ id: string } & ListParams, PaginatedResult<Event>>

  /** Get activity timeline */
  getTimeline: Action<{ id: string; from?: Date; to?: Date }, ActivityTimeline>

  /** Merge profiles */
  merge: Action<{ sourceId: string; targetId: string }, UserProfile>
}

export interface SegmentActions extends CRUDResource<Segment, SegmentInput> {
  /** Compute segment */
  compute: Action<{ id: string }, Segment>

  /** Get users */
  getUsers: Action<{ id: string } & ListParams, PaginatedResult<UserProfile>>

  /** Export users */
  export: Action<{ id: string; format: 'csv' | 'json' }, { url: string }>
}

export interface CohortActions extends CRUDResource<Cohort, CohortInput> {
  /** Compute cohort */
  compute: Action<{ id: string }, Cohort>

  /** Get users */
  getUsers: Action<{ id: string } & ListParams, PaginatedResult<UserProfile>>

  /** Get retention */
  getRetention: Action<{ id: string; periods: number }, CohortRetention>
}

export interface FunnelActions extends CRUDResource<Funnel, FunnelInput> {
  /** Add step */
  addStep: Action<{ id: string; step: FunnelStepInput }, FunnelStep>

  /** Remove step */
  removeStep: Action<{ id: string; stepId: string }, void>

  /** Reorder steps */
  reorderSteps: Action<{ id: string; stepIds: string[] }, Funnel>

  /** Get analysis */
  getAnalysis: Action<{ id: string; startDate: Date; endDate: Date }, FunnelAnalysis>
}

export interface FunnelStepActions extends CRUDResource<FunnelStep, FunnelStepInput> {
  /** Get users */
  getUsers: Action<{ id: string; limit?: number }, string[]>

  /** Get dropoff reasons */
  getDropoffReasons: Action<{ id: string }, Array<{ reason: string; count: number }>>
}

export interface ExperimentActions extends CRUDResource<Experiment, ExperimentInput> {
  /** Start experiment */
  start: Action<{ id: string }, Experiment>

  /** Pause experiment */
  pause: Action<{ id: string }, Experiment>

  /** Complete experiment */
  complete: Action<{ id: string; winnerId?: string }, Experiment>

  /** Get results */
  getResults: Action<{ id: string }, ExperimentResult[]>

  /** Assign user to variant */
  assignUser: Action<{ id: string; userId: string }, { variantId: string }>
}

export interface ExperimentVariantActions extends CRUDResource<ExperimentVariant, ExperimentVariantInput> {
  /** Get users */
  getUsers: Action<{ id: string } & ListParams, PaginatedResult<string>>
}

export interface ExperimentResultActions extends CRUDResource<ExperimentResult, ExperimentResultInput> {
  /** Compute results */
  compute: Action<{ experimentId: string; variantId: string; metricId: string }, ExperimentResult>
}

export interface GoalActions extends CRUDResource<Goal, GoalInput> {
  /** Update progress */
  updateProgress: Action<{ id: string }, Goal>

  /** Mark as achieved */
  achieve: Action<{ id: string }, Goal>

  /** Mark as missed */
  miss: Action<{ id: string }, Goal>
}

export interface AlertActions extends CRUDResource<Alert, AlertInput> {
  /** Acknowledge alert */
  acknowledge: Action<{ id: string }, Alert>

  /** Resolve alert */
  resolve: Action<{ id: string }, Alert>

  /** Mute alert */
  mute: Action<{ id: string; duration?: number }, Alert>

  /** Unmute alert */
  unmute: Action<{ id: string }, Alert>

  /** Test alert */
  test: Action<{ id: string }, void>

  /** Get history */
  getHistory: Action<{ id: string } & ListParams, PaginatedResult<AlertHistory>>
}

export interface AnomalyActions extends CRUDResource<Anomaly, AnomalyInput> {
  /** Mark as false positive */
  markFalsePositive: Action<{ id: string }, Anomaly>

  /** Get for metric */
  getForMetric: Action<{ metricId: string; from?: Date; to?: Date } & ListParams, PaginatedResult<Anomaly>>
}

// =============================================================================
// Supporting Types
// =============================================================================

export interface MetricComparison {
  metricId: string
  period1: {
    from: Date
    to: Date
    value: number
  }
  period2: {
    from: Date
    to: Date
    value: number
  }
  change: number
  changePercent: number
}

export interface WidgetData {
  widgetId: string
  data: unknown
  timestamp: Date
}

export interface ChartData {
  chartId: string
  data: unknown[]
  schema?: Array<{ name: string; type: string }>
  timestamp: Date
}

export interface QueryResult {
  queryId: string
  rows: unknown[]
  rowCount: number
  schema?: Array<{ name: string; type: string }>
  executionTime: number
  timestamp: Date
}

export interface QueryExecution {
  id: string
  queryId: string
  startedAt: Date
  completedAt?: Date
  duration?: number
  rowCount?: number
  error?: string
  userId?: string
}

export interface DatasetStats {
  datasetId: string
  rowCount: number
  dataSize: number
  nullCounts?: Record<string, number>
  distinctCounts?: Record<string, number>
  minValues?: Record<string, unknown>
  maxValues?: Record<string, unknown>
  avgValues?: Record<string, number>
  computedAt: Date
}

export interface DataLineage {
  datasetId: string
  upstream: Array<{ id: string; name: string; type: string }>
  downstream: Array<{ id: string; name: string; type: string }>
}

export interface ETLMetrics {
  jobId: string
  period: { from: Date; to: Date }
  runsTotal: number
  runsSucceeded: number
  runsFailed: number
  avgDuration: number
  totalRecordsProcessed: number
  successRate: number
}

export interface EventCounts {
  eventName?: string
  counts: Array<{
    timestamp: Date
    count: number
  }>
}

export interface ActivityTimeline {
  userId: string
  events: Array<{
    timestamp: Date
    eventName: string
    properties?: Record<string, unknown>
  }>
}

export interface CohortRetention {
  cohortId: string
  periods: Array<{
    period: number
    retentionRate: number
    userCount: number
    retainedUsers: number
  }>
}

export interface FunnelAnalysis {
  funnelId: string
  period: { from: Date; to: Date }
  totalUsers: number
  conversionRate: number
  steps: Array<{
    stepId: string
    name: string
    userCount: number
    conversionRate: number
    dropoffRate: number
    avgTimeToNext?: number
  }>
}

export interface AlertHistory {
  id: string
  alertId: string
  triggeredAt: Date
  metricValue: number
  condition: Alert['condition']
  acknowledgedAt?: Date
  resolvedAt?: Date
}

// =============================================================================
// Events
// =============================================================================

export interface MetricEvents {
  created: BaseEvent<'metric.created', Metric>
  updated: BaseEvent<'metric.updated', Metric>
  deleted: BaseEvent<'metric.deleted', { id: string }>
  target_set: BaseEvent<'metric.target_set', { metricId: string; target: number }>
  threshold_exceeded: BaseEvent<'metric.threshold_exceeded', { metricId: string; threshold: string; value: number }>
}

export interface DashboardEvents {
  created: BaseEvent<'dashboard.created', Dashboard>
  updated: BaseEvent<'dashboard.updated', Dashboard>
  deleted: BaseEvent<'dashboard.deleted', { id: string }>
  widget_added: BaseEvent<'dashboard.widget_added', { dashboardId: string; widget: DashboardWidget }>
  widget_removed: BaseEvent<'dashboard.widget_removed', { dashboardId: string; widgetId: string }>
  shared: BaseEvent<'dashboard.shared', { dashboardId: string; userIds: string[] }>
}

export interface ReportEvents {
  created: BaseEvent<'report.created', Report>
  updated: BaseEvent<'report.updated', Report>
  deleted: BaseEvent<'report.deleted', { id: string }>
  generated: BaseEvent<'report.generated', ReportSchedule>
  failed: BaseEvent<'report.failed', { reportId: string; error: string }>
}

export interface ExperimentEvents {
  created: BaseEvent<'experiment.created', Experiment>
  updated: BaseEvent<'experiment.updated', Experiment>
  deleted: BaseEvent<'experiment.deleted', { id: string }>
  started: BaseEvent<'experiment.started', Experiment>
  paused: BaseEvent<'experiment.paused', { id: string }>
  completed: BaseEvent<'experiment.completed', { experimentId: string; winnerId?: string }>
  user_assigned: BaseEvent<'experiment.user_assigned', { experimentId: string; userId: string; variantId: string }>
}

export interface AlertEvents {
  created: BaseEvent<'alert.created', Alert>
  updated: BaseEvent<'alert.updated', Alert>
  deleted: BaseEvent<'alert.deleted', { id: string }>
  triggered: BaseEvent<'alert.triggered', { alertId: string; metricValue: number }>
  acknowledged: BaseEvent<'alert.acknowledged', { alertId: string; acknowledgedBy: string }>
  resolved: BaseEvent<'alert.resolved', { alertId: string }>
  muted: BaseEvent<'alert.muted', { alertId: string; until?: Date }>
}

export interface AnomalyEvents {
  detected: BaseEvent<'anomaly.detected', Anomaly>
  false_positive_marked: BaseEvent<'anomaly.false_positive_marked', { anomalyId: string; markedBy: string }>
}

// =============================================================================
// Resources (Actions + Events)
// =============================================================================

export interface MetricResource extends MetricActions {
  on: <K extends keyof MetricEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<MetricEvents[K], TProxy>
  ) => () => void
}

export interface MetricValueResource extends MetricValueActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface DimensionResource extends DimensionActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface MeasureResource extends MeasureActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface DashboardResource extends DashboardActions {
  on: <K extends keyof DashboardEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DashboardEvents[K], TProxy>
  ) => () => void
}

export interface DashboardWidgetResource extends DashboardWidgetActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface ReportResource extends ReportActions {
  on: <K extends keyof ReportEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ReportEvents[K], TProxy>
  ) => () => void
}

export interface ReportScheduleResource extends ReportScheduleActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface ChartResource extends ChartActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface QueryResource extends QueryActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface DatasetResource extends DatasetActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface DataSourceResource extends DataSourceActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface ETLJobResource extends ETLJobActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface ETLRunResource extends ETLRunActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface TransformationResource extends TransformationActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface EventResource extends EventActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface EventPropertyResource extends EventPropertyActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface UserProfileResource extends UserProfileActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface SegmentResource extends SegmentActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface CohortResource extends CohortActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface FunnelResource extends FunnelActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface FunnelStepResource extends FunnelStepActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface ExperimentResource extends ExperimentActions {
  on: <K extends keyof ExperimentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ExperimentEvents[K], TProxy>
  ) => () => void
}

export interface ExperimentVariantResource extends ExperimentVariantActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface ExperimentResultResource extends ExperimentResultActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface GoalResource extends GoalActions {
  on: <K extends keyof never, TProxy = unknown>(
    event: K,
    handler: EventHandler<never, TProxy>
  ) => () => void
}

export interface AlertResource extends AlertActions {
  on: <K extends keyof AlertEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AlertEvents[K], TProxy>
  ) => () => void
}

export interface AnomalyResource extends AnomalyActions {
  on: <K extends keyof AnomalyEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AnomalyEvents[K], TProxy>
  ) => () => void
}

// =============================================================================
// Analytics Proxy (unified interface)
// =============================================================================

/**
 * Complete Analytics interface combining all resources.
 *
 * @example
 * ```ts
 * const analytics: AnalyticsProxy = getAnalyticsProxy()
 *
 * // Create a metric
 * const metric = await analytics.metrics.create({
 *   name: 'Active Users',
 *   type: 'count',
 *   aggregation: 'distinct_count'
 * })
 *
 * // Track an event
 * await analytics.events.track({
 *   name: 'User Signed Up',
 *   userId: 'user_123',
 *   properties: { plan: 'pro' }
 * })
 *
 * // Create a dashboard
 * const dashboard = await analytics.dashboards.create({
 *   name: 'Executive Dashboard',
 *   layout: 'grid',
 *   visibility: 'shared'
 * })
 *
 * // Run an experiment
 * const experiment = await analytics.experiments.create({
 *   name: 'Pricing Test',
 *   type: 'ab_test',
 *   variantIds: ['control', 'treatment']
 * })
 *
 * await analytics.experiments.start({ id: experiment.id })
 * ```
 */
export interface AnalyticsProxy {
  metrics: MetricResource
  metricValues: MetricValueResource
  dimensions: DimensionResource
  measures: MeasureResource
  dashboards: DashboardResource
  dashboardWidgets: DashboardWidgetResource
  reports: ReportResource
  reportSchedules: ReportScheduleResource
  charts: ChartResource
  queries: QueryResource
  datasets: DatasetResource
  dataSources: DataSourceResource
  etlJobs: ETLJobResource
  etlRuns: ETLRunResource
  transformations: TransformationResource
  events: EventResource
  eventProperties: EventPropertyResource
  userProfiles: UserProfileResource
  segments: SegmentResource
  cohorts: CohortResource
  funnels: FunnelResource
  funnelSteps: FunnelStepResource
  experiments: ExperimentResource
  experimentVariants: ExperimentVariantResource
  experimentResults: ExperimentResultResource
  goals: GoalResource
  alerts: AlertResource
  anomalies: AnomalyResource
}
