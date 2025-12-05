/**
 * Analytics and Reporting Entity Types (Nouns)
 *
 * Semantic type definitions for analytics and reporting tools that can be used by
 * both remote human workers AND AI agents. Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, Verb } from 'ai-database'

// =============================================================================
// Report
// =============================================================================

/**
 * Report entity
 *
 * Represents a generated report with data, visualizations, and scheduling
 */
export const Report: Noun = {
  singular: 'report',
  plural: 'reports',
  description: 'A generated report containing data analysis and visualizations',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Report title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Report description or summary',
    },

    // Type and configuration
    type: {
      type: 'string',
      description: 'Report type: summary, detail, comparison, trend, custom',
      examples: ['summary', 'detail', 'comparison', 'trend', 'custom'],
    },
    format: {
      type: 'string',
      description: 'Output format: pdf, html, csv, xlsx, json',
      examples: ['pdf', 'html', 'csv', 'xlsx', 'json'],
    },
    template: {
      type: 'string',
      optional: true,
      description: 'Template used for report generation',
    },

    // Time range
    startDate: {
      type: 'datetime',
      optional: true,
      description: 'Start date for report data',
    },
    endDate: {
      type: 'datetime',
      optional: true,
      description: 'End date for report data',
    },
    period: {
      type: 'string',
      optional: true,
      description: 'Time period: daily, weekly, monthly, quarterly, yearly, custom',
      examples: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'],
    },

    // Scheduling
    scheduled: {
      type: 'boolean',
      optional: true,
      description: 'Whether report is automatically generated on schedule',
    },
    schedule: {
      type: 'string',
      optional: true,
      description: 'Cron expression or schedule string',
    },
    scheduleTimezone: {
      type: 'string',
      optional: true,
      description: 'Timezone for scheduled generation',
    },
    lastRunAt: {
      type: 'datetime',
      optional: true,
      description: 'When report was last generated',
    },
    nextRunAt: {
      type: 'datetime',
      optional: true,
      description: 'When report will next be generated',
    },

    // Status
    status: {
      type: 'string',
      description: 'Report status: draft, generating, completed, failed, scheduled',
      examples: ['draft', 'generating', 'completed', 'failed', 'scheduled'],
    },
    progress: {
      type: 'number',
      optional: true,
      description: 'Generation progress (0-100)',
    },
    error: {
      type: 'string',
      optional: true,
      description: 'Error message if generation failed',
    },

    // Content
    content: {
      type: 'json',
      optional: true,
      description: 'Generated report content/data',
    },
    url: {
      type: 'url',
      optional: true,
      description: 'URL to access/download the report',
    },
    size: {
      type: 'number',
      optional: true,
      description: 'Report file size in bytes',
    },

    // Distribution
    recipients: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Email addresses to send report to',
    },
    shared: {
      type: 'boolean',
      optional: true,
      description: 'Whether report is publicly shared',
    },
    shareUrl: {
      type: 'url',
      optional: true,
      description: 'Public URL for shared report',
    },

    // Metadata
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorizing reports',
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Report category',
    },
  },

  relationships: {
    dataSource: {
      type: 'DataSource',
      description: 'Primary data source for the report',
    },
    dataSources: {
      type: 'DataSource[]',
      description: 'All data sources used in the report',
    },
    queries: {
      type: 'Query[]',
      description: 'Queries used to fetch report data',
    },
    metrics: {
      type: 'Metric[]',
      description: 'Metrics included in the report',
    },
    widgets: {
      type: 'Widget[]',
      description: 'Widgets/visualizations in the report',
    },
    owner: {
      type: 'Contact',
      description: 'Report owner/creator',
    },
    subscribers: {
      type: 'Contact[]',
      description: 'People subscribed to receive this report',
    },
  },

  actions: [
    'create',
    'edit',
    'generate',
    'regenerate',
    'schedule',
    'unschedule',
    'export',
    'download',
    'share',
    'unshare',
    'send',
    'duplicate',
    'archive',
    'delete',
    'subscribe',
    'unsubscribe',
  ],

  events: [
    'created',
    'edited',
    'generating',
    'generated',
    'failed',
    'scheduled',
    'unscheduled',
    'exported',
    'downloaded',
    'shared',
    'unshared',
    'sent',
    'duplicated',
    'archived',
    'deleted',
  ],
}

// =============================================================================
// Dashboard
// =============================================================================

/**
 * Dashboard entity
 *
 * Represents a dashboard with multiple widgets displaying metrics and data
 */
export const Dashboard: Noun = {
  singular: 'dashboard',
  plural: 'dashboards',
  description: 'A dashboard containing widgets and charts for data visualization',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Dashboard name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Dashboard description',
    },

    // Layout
    layout: {
      type: 'string',
      description: 'Dashboard layout type: grid, freeform, fixed',
      examples: ['grid', 'freeform', 'fixed'],
    },
    columns: {
      type: 'number',
      optional: true,
      description: 'Number of columns in grid layout',
    },
    theme: {
      type: 'string',
      optional: true,
      description: 'Dashboard theme: light, dark, custom',
      examples: ['light', 'dark', 'custom'],
    },
    customStyles: {
      type: 'json',
      optional: true,
      description: 'Custom CSS styles or theme configuration',
    },

    // Time settings
    timeRange: {
      type: 'string',
      optional: true,
      description: 'Default time range: last_hour, last_24h, last_7d, last_30d, last_90d, custom',
      examples: ['last_hour', 'last_24h', 'last_7d', 'last_30d', 'last_90d', 'custom'],
    },
    startDate: {
      type: 'datetime',
      optional: true,
      description: 'Start date for custom time range',
    },
    endDate: {
      type: 'datetime',
      optional: true,
      description: 'End date for custom time range',
    },
    autoRefresh: {
      type: 'boolean',
      optional: true,
      description: 'Whether dashboard auto-refreshes',
    },
    refreshInterval: {
      type: 'number',
      optional: true,
      description: 'Auto-refresh interval in seconds',
    },
    lastRefreshedAt: {
      type: 'datetime',
      optional: true,
      description: 'When dashboard was last refreshed',
    },

    // Access control
    visibility: {
      type: 'string',
      description: 'Dashboard visibility: private, team, organization, public',
      examples: ['private', 'team', 'organization', 'public'],
    },
    shared: {
      type: 'boolean',
      optional: true,
      description: 'Whether dashboard is publicly shared',
    },
    shareUrl: {
      type: 'url',
      optional: true,
      description: 'Public URL for shared dashboard',
    },
    embedded: {
      type: 'boolean',
      optional: true,
      description: 'Whether dashboard can be embedded',
    },

    // Organization
    favorite: {
      type: 'boolean',
      optional: true,
      description: 'Whether dashboard is favorited by current user',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorizing dashboard',
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Dashboard category',
    },
    template: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a template dashboard',
    },
  },

  relationships: {
    widgets: {
      type: 'Widget[]',
      backref: 'dashboard',
      description: 'Widgets displayed on this dashboard',
    },
    dataSources: {
      type: 'DataSource[]',
      description: 'Data sources used by dashboard widgets',
    },
    owner: {
      type: 'Contact',
      description: 'Dashboard owner/creator',
    },
    viewers: {
      type: 'Contact[]',
      description: 'People with view access',
    },
    editors: {
      type: 'Contact[]',
      description: 'People with edit access',
    },
  },

  actions: [
    'create',
    'edit',
    'view',
    'refresh',
    'duplicate',
    'export',
    'share',
    'unshare',
    'embed',
    'favorite',
    'unfavorite',
    'addWidget',
    'removeWidget',
    'reorderWidgets',
    'setTimeRange',
    'archive',
    'delete',
  ],

  events: [
    'created',
    'edited',
    'viewed',
    'refreshed',
    'duplicated',
    'exported',
    'shared',
    'unshared',
    'embedded',
    'favorited',
    'unfavorited',
    'widgetAdded',
    'widgetRemoved',
    'widgetsReordered',
    'timeRangeChanged',
    'archived',
    'deleted',
  ],
}

// =============================================================================
// Widget
// =============================================================================

/**
 * Widget entity
 *
 * Represents a dashboard widget (chart, metric, table, etc.)
 */
export const Widget: Noun = {
  singular: 'widget',
  plural: 'widgets',
  description: 'A dashboard widget displaying data as a chart, metric, table, or other visualization',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Widget title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Widget description',
    },

    // Type and visualization
    type: {
      type: 'string',
      description: 'Widget type: metric, chart, table, text, image, iframe',
      examples: ['metric', 'chart', 'table', 'text', 'image', 'iframe'],
    },
    chartType: {
      type: 'string',
      optional: true,
      description: 'Chart type: line, bar, pie, area, scatter, heatmap, gauge, funnel',
      examples: ['line', 'bar', 'pie', 'area', 'scatter', 'heatmap', 'gauge', 'funnel'],
    },
    visualization: {
      type: 'json',
      optional: true,
      description: 'Visualization configuration (axes, colors, legend, etc.)',
    },

    // Layout
    position: {
      type: 'json',
      description: 'Widget position and size: {x, y, width, height}',
    },
    minWidth: {
      type: 'number',
      optional: true,
      description: 'Minimum width in grid units',
    },
    minHeight: {
      type: 'number',
      optional: true,
      description: 'Minimum height in grid units',
    },

    // Data
    data: {
      type: 'json',
      optional: true,
      description: 'Current widget data',
    },
    aggregation: {
      type: 'string',
      optional: true,
      description: 'Data aggregation method: sum, avg, min, max, count, distinct',
      examples: ['sum', 'avg', 'min', 'max', 'count', 'distinct'],
    },
    groupBy: {
      type: 'string',
      optional: true,
      description: 'Field to group data by',
    },
    filters: {
      type: 'json',
      optional: true,
      description: 'Data filters applied to widget',
    },
    limit: {
      type: 'number',
      optional: true,
      description: 'Maximum number of data points or rows',
    },

    // Time settings
    timeRange: {
      type: 'string',
      optional: true,
      description: 'Widget-specific time range override',
    },
    startDate: {
      type: 'datetime',
      optional: true,
      description: 'Start date for widget data',
    },
    endDate: {
      type: 'datetime',
      optional: true,
      description: 'End date for widget data',
    },

    // Display options
    showLegend: {
      type: 'boolean',
      optional: true,
      description: 'Whether to show chart legend',
    },
    showLabels: {
      type: 'boolean',
      optional: true,
      description: 'Whether to show data labels',
    },
    colors: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Custom color palette',
    },

    // Status
    loading: {
      type: 'boolean',
      optional: true,
      description: 'Whether widget is currently loading data',
    },
    error: {
      type: 'string',
      optional: true,
      description: 'Error message if data loading failed',
    },
    lastUpdatedAt: {
      type: 'datetime',
      optional: true,
      description: 'When widget data was last updated',
    },
  },

  relationships: {
    dashboard: {
      type: 'Dashboard',
      backref: 'widgets',
      description: 'Dashboard this widget belongs to',
    },
    dataSource: {
      type: 'DataSource',
      description: 'Data source for this widget',
    },
    query: {
      type: 'Query',
      description: 'Query used to fetch widget data',
    },
    metrics: {
      type: 'Metric[]',
      description: 'Metrics displayed in this widget',
    },
    alerts: {
      type: 'Alert[]',
      description: 'Alerts configured for this widget',
    },
  },

  actions: [
    'create',
    'edit',
    'refresh',
    'duplicate',
    'resize',
    'move',
    'delete',
    'export',
    'drilldown',
    'filter',
    'setTimeRange',
    'toggleLegend',
    'changeChartType',
  ],

  events: [
    'created',
    'edited',
    'refreshed',
    'duplicated',
    'resized',
    'moved',
    'deleted',
    'exported',
    'drilledDown',
    'filtered',
    'timeRangeChanged',
    'dataLoaded',
    'dataFailed',
  ],
}

// =============================================================================
// Metric
// =============================================================================

/**
 * Metric entity
 *
 * Represents a tracked metric or KPI with current value and trends
 */
export const Metric: Noun = {
  singular: 'metric',
  plural: 'metrics',
  description: 'A tracked metric or key performance indicator (KPI)',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Metric name',
    },
    displayName: {
      type: 'string',
      optional: true,
      description: 'Human-readable display name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Metric description',
    },

    // Type and calculation
    type: {
      type: 'string',
      description: 'Metric type: number, currency, percentage, ratio, duration, count',
      examples: ['number', 'currency', 'percentage', 'ratio', 'duration', 'count'],
    },
    unit: {
      type: 'string',
      optional: true,
      description: 'Unit of measurement',
    },
    format: {
      type: 'string',
      optional: true,
      description: 'Display format string',
    },
    aggregation: {
      type: 'string',
      description: 'Aggregation method: sum, avg, min, max, count, distinct',
      examples: ['sum', 'avg', 'min', 'max', 'count', 'distinct'],
    },
    formula: {
      type: 'string',
      optional: true,
      description: 'Calculation formula for computed metrics',
    },

    // Current value
    value: {
      type: 'number',
      description: 'Current metric value',
    },
    previousValue: {
      type: 'number',
      optional: true,
      description: 'Previous period value for comparison',
    },
    change: {
      type: 'number',
      optional: true,
      description: 'Absolute change from previous period',
    },
    changePercent: {
      type: 'number',
      optional: true,
      description: 'Percentage change from previous period',
    },

    // Trend
    trend: {
      type: 'string',
      optional: true,
      description: 'Trend direction: up, down, flat',
      examples: ['up', 'down', 'flat'],
    },
    trendData: {
      type: 'json',
      optional: true,
      description: 'Time series data for trend visualization',
    },

    // Thresholds
    target: {
      type: 'number',
      optional: true,
      description: 'Target value or goal',
    },
    minValue: {
      type: 'number',
      optional: true,
      description: 'Minimum acceptable value',
    },
    maxValue: {
      type: 'number',
      optional: true,
      description: 'Maximum acceptable value',
    },
    warningThreshold: {
      type: 'number',
      optional: true,
      description: 'Warning threshold value',
    },
    criticalThreshold: {
      type: 'number',
      optional: true,
      description: 'Critical threshold value',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Metric status: normal, warning, critical, unknown',
      examples: ['normal', 'warning', 'critical', 'unknown'],
    },

    // Metadata
    category: {
      type: 'string',
      optional: true,
      description: 'Metric category',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    dimensions: {
      type: 'json',
      optional: true,
      description: 'Dimensional breakdown of metric',
    },

    // Timing
    period: {
      type: 'string',
      optional: true,
      description: 'Time period: hourly, daily, weekly, monthly, quarterly, yearly',
      examples: ['hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    },
    timestamp: {
      type: 'datetime',
      optional: true,
      description: 'When metric was last calculated',
    },
  },

  relationships: {
    dataSource: {
      type: 'DataSource',
      description: 'Data source for this metric',
    },
    query: {
      type: 'Query',
      description: 'Query used to calculate metric',
    },
    goal: {
      type: 'Goal',
      required: false,
      description: 'Associated goal or target',
    },
    alerts: {
      type: 'Alert[]',
      backref: 'metric',
      description: 'Alerts configured for this metric',
    },
    reports: {
      type: 'Report[]',
      description: 'Reports that include this metric',
    },
    dashboards: {
      type: 'Dashboard[]',
      description: 'Dashboards that display this metric',
    },
  },

  actions: [
    'calculate',
    'refresh',
    'setTarget',
    'setThreshold',
    'track',
    'compare',
    'export',
    'archive',
    'delete',
  ],

  events: [
    'calculated',
    'refreshed',
    'targetSet',
    'thresholdSet',
    'thresholdExceeded',
    'targetReached',
    'trendChanged',
    'archived',
    'deleted',
  ],
}

// =============================================================================
// Goal
// =============================================================================

/**
 * Goal entity
 *
 * Represents a goal or target with progress tracking
 */
export const Goal: Noun = {
  singular: 'goal',
  plural: 'goals',
  description: 'A goal or target with progress tracking',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Goal name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Goal description',
    },

    // Target
    target: {
      type: 'number',
      description: 'Target value to achieve',
    },
    unit: {
      type: 'string',
      optional: true,
      description: 'Unit of measurement',
    },
    type: {
      type: 'string',
      description: 'Goal type: increase, decrease, maintain, threshold',
      examples: ['increase', 'decrease', 'maintain', 'threshold'],
    },

    // Current state
    current: {
      type: 'number',
      description: 'Current value',
    },
    progress: {
      type: 'number',
      description: 'Progress percentage (0-100)',
    },
    remaining: {
      type: 'number',
      optional: true,
      description: 'Remaining amount to reach goal',
    },

    // Timing
    startDate: {
      type: 'datetime',
      description: 'Goal start date',
    },
    endDate: {
      type: 'datetime',
      description: 'Goal target completion date',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'When goal was achieved',
    },

    // Status
    status: {
      type: 'string',
      description: 'Goal status: active, completed, failed, cancelled, paused',
      examples: ['active', 'completed', 'failed', 'cancelled', 'paused'],
    },
    onTrack: {
      type: 'boolean',
      optional: true,
      description: 'Whether goal is on track to be achieved',
    },
    projectedCompletion: {
      type: 'datetime',
      optional: true,
      description: 'Projected completion date based on current progress',
    },

    // Organization
    priority: {
      type: 'string',
      optional: true,
      description: 'Goal priority: low, medium, high, critical',
      examples: ['low', 'medium', 'high', 'critical'],
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Goal category',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },

    // Notifications
    notifyOnProgress: {
      type: 'boolean',
      optional: true,
      description: 'Whether to notify on progress milestones',
    },
    notifyOnCompletion: {
      type: 'boolean',
      optional: true,
      description: 'Whether to notify when goal is achieved',
    },
  },

  relationships: {
    metric: {
      type: 'Metric',
      description: 'Metric being tracked for this goal',
    },
    owner: {
      type: 'Contact',
      description: 'Goal owner/responsible person',
    },
    team: {
      type: 'Contact[]',
      description: 'Team members working towards this goal',
    },
    milestones: {
      type: 'Goal[]',
      description: 'Sub-goals or milestones',
    },
    parentGoal: {
      type: 'Goal',
      required: false,
      description: 'Parent goal if this is a milestone',
    },
  },

  actions: [
    'create',
    'update',
    'track',
    'complete',
    'fail',
    'cancel',
    'pause',
    'resume',
    'setTarget',
    'addMilestone',
    'delete',
  ],

  events: [
    'created',
    'updated',
    'progressed',
    'completed',
    'failed',
    'cancelled',
    'paused',
    'resumed',
    'targetChanged',
    'milestoneAdded',
    'milestoneReached',
    'deleted',
  ],
}

// =============================================================================
// DataSource
// =============================================================================

/**
 * DataSource entity
 *
 * Represents a connection to a data source (database, API, file, etc.)
 */
export const DataSource: Noun = {
  singular: 'data source',
  plural: 'data sources',
  description: 'A connection to a data source for analytics and reporting',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Data source name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Data source description',
    },

    // Type and connection
    type: {
      type: 'string',
      description: 'Data source type: database, api, file, webhook, streaming',
      examples: ['database', 'api', 'file', 'webhook', 'streaming'],
    },
    subtype: {
      type: 'string',
      optional: true,
      description: 'Specific data source subtype: postgresql, mysql, mongodb, rest, graphql, csv, json, etc.',
      examples: ['postgresql', 'mysql', 'mongodb', 'rest', 'graphql', 'csv', 'json'],
    },
    connectionString: {
      type: 'string',
      optional: true,
      description: 'Connection string or URL (may be encrypted)',
    },
    host: {
      type: 'string',
      optional: true,
      description: 'Host address',
    },
    port: {
      type: 'number',
      optional: true,
      description: 'Port number',
    },
    database: {
      type: 'string',
      optional: true,
      description: 'Database name',
    },
    schema: {
      type: 'string',
      optional: true,
      description: 'Schema name',
    },

    // Authentication
    authType: {
      type: 'string',
      optional: true,
      description: 'Authentication type: none, basic, apikey, oauth, certificate',
      examples: ['none', 'basic', 'apikey', 'oauth', 'certificate'],
    },
    username: {
      type: 'string',
      optional: true,
      description: 'Username for authentication',
    },
    encrypted: {
      type: 'boolean',
      optional: true,
      description: 'Whether credentials are encrypted',
    },

    // Configuration
    config: {
      type: 'json',
      optional: true,
      description: 'Additional configuration options',
    },
    timeout: {
      type: 'number',
      optional: true,
      description: 'Connection timeout in milliseconds',
    },
    maxConnections: {
      type: 'number',
      optional: true,
      description: 'Maximum number of concurrent connections',
    },
    ssl: {
      type: 'boolean',
      optional: true,
      description: 'Whether to use SSL/TLS',
    },

    // Status
    status: {
      type: 'string',
      description: 'Connection status: connected, disconnected, error, testing',
      examples: ['connected', 'disconnected', 'error', 'testing'],
    },
    lastConnectedAt: {
      type: 'datetime',
      optional: true,
      description: 'When connection was last established',
    },
    lastTestedAt: {
      type: 'datetime',
      optional: true,
      description: 'When connection was last tested',
    },
    error: {
      type: 'string',
      optional: true,
      description: 'Connection error message',
    },

    // Metadata
    tables: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Available tables or collections',
    },
    dataSchema: {
      type: 'json',
      optional: true,
      description: 'Data schema information',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },

    // Access control
    readOnly: {
      type: 'boolean',
      optional: true,
      description: 'Whether connection is read-only',
    },
    shared: {
      type: 'boolean',
      optional: true,
      description: 'Whether data source is shared with team',
    },
  },

  relationships: {
    reports: {
      type: 'Report[]',
      description: 'Reports using this data source',
    },
    dashboards: {
      type: 'Dashboard[]',
      description: 'Dashboards using this data source',
    },
    queries: {
      type: 'Query[]',
      backref: 'dataSource',
      description: 'Queries saved for this data source',
    },
    metrics: {
      type: 'Metric[]',
      description: 'Metrics calculated from this data source',
    },
    owner: {
      type: 'Contact',
      description: 'Data source owner',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with access to this data source',
    },
  },

  actions: [
    'create',
    'edit',
    'connect',
    'disconnect',
    'test',
    'refresh',
    'query',
    'sync',
    'share',
    'unshare',
    'delete',
  ],

  events: [
    'created',
    'edited',
    'connected',
    'disconnected',
    'tested',
    'refreshed',
    'queried',
    'synced',
    'shared',
    'unshared',
    'failed',
    'deleted',
  ],
}

// =============================================================================
// Query
// =============================================================================

/**
 * Query entity
 *
 * Represents a saved query or filter for data retrieval
 */
export const Query: Noun = {
  singular: 'query',
  plural: 'queries',
  description: 'A saved query or filter for retrieving data',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Query name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Query description',
    },

    // Query definition
    queryType: {
      type: 'string',
      description: 'Query type: sql, graphql, rest, nosql, custom',
      examples: ['sql', 'graphql', 'rest', 'nosql', 'custom'],
    },
    queryString: {
      type: 'string',
      description: 'The query text (SQL, GraphQL, etc.)',
    },
    parameters: {
      type: 'json',
      optional: true,
      description: 'Query parameters and their default values',
    },
    variables: {
      type: 'json',
      optional: true,
      description: 'Current variable values',
    },

    // Filters and transformations
    filters: {
      type: 'json',
      optional: true,
      description: 'Additional filters applied to results',
    },
    sort: {
      type: 'json',
      optional: true,
      description: 'Sort configuration',
    },
    limit: {
      type: 'number',
      optional: true,
      description: 'Maximum number of results',
    },
    offset: {
      type: 'number',
      optional: true,
      description: 'Result offset for pagination',
    },
    transformations: {
      type: 'json',
      optional: true,
      description: 'Data transformations to apply',
    },

    // Caching
    cached: {
      type: 'boolean',
      optional: true,
      description: 'Whether to cache query results',
    },
    cacheDuration: {
      type: 'number',
      optional: true,
      description: 'Cache duration in seconds',
    },
    lastExecutedAt: {
      type: 'datetime',
      optional: true,
      description: 'When query was last executed',
    },

    // Performance
    executionTime: {
      type: 'number',
      optional: true,
      description: 'Last execution time in milliseconds',
    },
    rowCount: {
      type: 'number',
      optional: true,
      description: 'Number of rows returned',
    },
    timeout: {
      type: 'number',
      optional: true,
      description: 'Query timeout in milliseconds',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Query status: ready, running, completed, failed',
      examples: ['ready', 'running', 'completed', 'failed'],
    },
    error: {
      type: 'string',
      optional: true,
      description: 'Error message if query failed',
    },

    // Organization
    category: {
      type: 'string',
      optional: true,
      description: 'Query category',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    favorite: {
      type: 'boolean',
      optional: true,
      description: 'Whether query is favorited',
    },
    shared: {
      type: 'boolean',
      optional: true,
      description: 'Whether query is shared with team',
    },
  },

  relationships: {
    dataSource: {
      type: 'DataSource',
      backref: 'queries',
      description: 'Data source this query runs against',
    },
    reports: {
      type: 'Report[]',
      description: 'Reports using this query',
    },
    widgets: {
      type: 'Widget[]',
      description: 'Widgets using this query',
    },
    metrics: {
      type: 'Metric[]',
      description: 'Metrics calculated from this query',
    },
    owner: {
      type: 'Contact',
      description: 'Query owner/creator',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with access to this query',
    },
  },

  actions: [
    'create',
    'edit',
    'execute',
    'cancel',
    'test',
    'validate',
    'optimize',
    'schedule',
    'export',
    'duplicate',
    'share',
    'unshare',
    'favorite',
    'unfavorite',
    'delete',
  ],

  events: [
    'created',
    'edited',
    'executed',
    'cancelled',
    'tested',
    'validated',
    'optimized',
    'scheduled',
    'exported',
    'duplicated',
    'shared',
    'unshared',
    'favorited',
    'unfavorited',
    'failed',
    'deleted',
  ],
}

// =============================================================================
// Alert
// =============================================================================

/**
 * Alert entity
 *
 * Represents an alert or notification triggered by metric thresholds
 */
export const Alert: Noun = {
  singular: 'alert',
  plural: 'alerts',
  description: 'An alert or notification based on metric thresholds and conditions',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Alert name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Alert description',
    },

    // Condition
    condition: {
      type: 'string',
      description: 'Alert condition expression',
    },
    operator: {
      type: 'string',
      description: 'Comparison operator: gt, gte, lt, lte, eq, ne, between, outside',
      examples: ['gt', 'gte', 'lt', 'lte', 'eq', 'ne', 'between', 'outside'],
    },
    threshold: {
      type: 'number',
      description: 'Threshold value',
    },
    secondThreshold: {
      type: 'number',
      optional: true,
      description: 'Second threshold for between/outside operators',
    },

    // Evaluation
    evaluationInterval: {
      type: 'number',
      description: 'How often to evaluate condition (in seconds)',
    },
    evaluationWindow: {
      type: 'number',
      optional: true,
      description: 'Time window for evaluation (in seconds)',
    },
    evaluationCount: {
      type: 'number',
      optional: true,
      description: 'Number of consecutive evaluations before triggering',
    },

    // Severity
    severity: {
      type: 'string',
      description: 'Alert severity: info, warning, error, critical',
      examples: ['info', 'warning', 'error', 'critical'],
    },
    priority: {
      type: 'string',
      optional: true,
      description: 'Alert priority: low, medium, high',
      examples: ['low', 'medium', 'high'],
    },

    // Status
    enabled: {
      type: 'boolean',
      description: 'Whether alert is enabled',
    },
    status: {
      type: 'string',
      description: 'Alert status: active, triggered, resolved, snoozed, disabled',
      examples: ['active', 'triggered', 'resolved', 'snoozed', 'disabled'],
    },
    triggeredAt: {
      type: 'datetime',
      optional: true,
      description: 'When alert was triggered',
    },
    resolvedAt: {
      type: 'datetime',
      optional: true,
      description: 'When alert condition was resolved',
    },
    snoozedUntil: {
      type: 'datetime',
      optional: true,
      description: 'Alert is snoozed until this time',
    },
    lastEvaluatedAt: {
      type: 'datetime',
      optional: true,
      description: 'When condition was last evaluated',
    },
    nextEvaluationAt: {
      type: 'datetime',
      optional: true,
      description: 'When condition will be evaluated next',
    },

    // Notification
    notificationChannels: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Notification channels: email, sms, slack, webhook, push',
      examples: ['email', 'sms', 'slack', 'webhook', 'push'],
    },
    recipients: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Recipients to notify',
    },
    message: {
      type: 'string',
      optional: true,
      description: 'Custom alert message',
    },
    notifyOnResolve: {
      type: 'boolean',
      optional: true,
      description: 'Whether to notify when alert resolves',
    },

    // History
    triggerCount: {
      type: 'number',
      optional: true,
      description: 'Number of times alert has triggered',
    },
    lastTriggerValue: {
      type: 'number',
      optional: true,
      description: 'Metric value when last triggered',
    },

    // Organization
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Alert category',
    },
  },

  relationships: {
    metric: {
      type: 'Metric',
      backref: 'alerts',
      description: 'Metric being monitored',
    },
    widget: {
      type: 'Widget',
      required: false,
      description: 'Widget associated with this alert',
    },
    dataSource: {
      type: 'DataSource',
      description: 'Data source for alert evaluation',
    },
    owner: {
      type: 'Contact',
      description: 'Alert owner/creator',
    },
    subscribers: {
      type: 'Contact[]',
      description: 'People subscribed to alert notifications',
    },
  },

  actions: [
    'create',
    'edit',
    'enable',
    'disable',
    'trigger',
    'resolve',
    'snooze',
    'unsnooze',
    'test',
    'acknowledge',
    'escalate',
    'delete',
  ],

  events: [
    'created',
    'edited',
    'enabled',
    'disabled',
    'triggered',
    'resolved',
    'snoozed',
    'unsnoozed',
    'tested',
    'acknowledged',
    'escalated',
    'notificationSent',
    'notificationFailed',
    'deleted',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All analytics and reporting entity types
 */
export const AnalyticsEntities = {
  Report,
  Dashboard,
  Widget,
  Metric,
  Goal,
  DataSource,
  Query,
  Alert,
}

/**
 * Entity categories for organization
 */
export const AnalyticsCategories = {
  reporting: ['Report'],
  visualization: ['Dashboard', 'Widget'],
  tracking: ['Metric', 'Goal', 'Alert'],
  data: ['DataSource', 'Query'],
} as const
