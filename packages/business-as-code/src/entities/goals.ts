/**
 * Goal Entity Types (Nouns)
 *
 * Goal tracking entities: Goal, OKR, KPI, Metric.
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// Goal
// =============================================================================

/**
 * Goal entity
 *
 * Represents a strategic or operational goal.
 */
export const Goal: Noun = {
  singular: 'goal',
  plural: 'goals',
  description: 'A strategic or operational goal',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Goal name/title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Goal description',
    },

    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'Goal type',
      examples: ['strategic', 'operational', 'tactical'],
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Goal category',
      examples: ['growth', 'revenue', 'customer', 'product', 'operations', 'people', 'financial'],
    },
    priority: {
      type: 'string',
      optional: true,
      description: 'Priority level',
      examples: ['critical', 'high', 'medium', 'low'],
    },

    // Timeline
    startDate: {
      type: 'date',
      optional: true,
      description: 'Start date',
    },
    targetDate: {
      type: 'date',
      optional: true,
      description: 'Target completion date',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'Actual completion time',
    },

    // Progress
    progress: {
      type: 'number',
      optional: true,
      description: 'Progress percentage (0-100)',
    },
    confidence: {
      type: 'number',
      optional: true,
      description: 'Confidence level (0-100)',
    },

    // Success Criteria
    successMetrics: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Success metrics',
    },
    targetValue: {
      type: 'number',
      optional: true,
      description: 'Target value for primary metric',
    },
    currentValue: {
      type: 'number',
      optional: true,
      description: 'Current value for primary metric',
    },
    unit: {
      type: 'string',
      optional: true,
      description: 'Metric unit',
    },

    // Status
    status: {
      type: 'string',
      description: 'Goal status',
      examples: ['draft', 'active', 'on-track', 'at-risk', 'behind', 'completed', 'cancelled'],
    },
  },

  relationships: {
    owner: {
      type: 'Worker',
      required: false,
      description: 'Goal owner',
    },
    team: {
      type: 'Team',
      required: false,
      description: 'Responsible team',
    },
    department: {
      type: 'Department',
      required: false,
      description: 'Responsible department',
    },
    parent: {
      type: 'Goal',
      required: false,
      description: 'Parent goal',
    },
    children: {
      type: 'Goal[]',
      description: 'Sub-goals',
    },
    dependencies: {
      type: 'Goal[]',
      description: 'Goals this depends on',
    },
    kpis: {
      type: 'KPI[]',
      description: 'Related KPIs',
    },
  },

  actions: [
    'create',
    'update',
    'activate',
    'updateProgress',
    'markAtRisk',
    'complete',
    'cancel',
    'extend',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'activated',
    'progressUpdated',
    'markedAtRisk',
    'completed',
    'cancelled',
    'extended',
    'overdue',
    'archived',
  ],
}

// =============================================================================
// OKR (Objective and Key Results)
// =============================================================================

/**
 * OKR entity
 *
 * Represents an objective with measurable key results.
 */
export const OKR: Noun = {
  singular: 'okr',
  plural: 'okrs',
  description: 'An objective with measurable key results',

  properties: {
    // Objective
    objective: {
      type: 'string',
      description: 'Objective statement',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Objective description',
    },

    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'OKR type',
      examples: ['company', 'department', 'team', 'individual'],
    },
    category: {
      type: 'string',
      optional: true,
      description: 'OKR category',
      examples: ['growth', 'product', 'customer', 'operations', 'people'],
    },

    // Period
    period: {
      type: 'string',
      optional: true,
      description: 'OKR period (e.g., "Q1 2025", "H1 2025")',
    },
    startDate: {
      type: 'date',
      optional: true,
      description: 'Period start date',
    },
    endDate: {
      type: 'date',
      optional: true,
      description: 'Period end date',
    },

    // Progress
    progress: {
      type: 'number',
      optional: true,
      description: 'Overall progress (0-100)',
    },
    confidence: {
      type: 'number',
      optional: true,
      description: 'Confidence level (0-1)',
    },
    grade: {
      type: 'number',
      optional: true,
      description: 'Final grade (0-1)',
    },

    // Key Results count
    keyResultCount: {
      type: 'number',
      optional: true,
      description: 'Number of key results',
    },
    completedKeyResultCount: {
      type: 'number',
      optional: true,
      description: 'Completed key results',
    },

    // Status
    status: {
      type: 'string',
      description: 'OKR status',
      examples: ['draft', 'active', 'on-track', 'at-risk', 'behind', 'completed', 'cancelled'],
    },
  },

  relationships: {
    owner: {
      type: 'Worker',
      required: false,
      description: 'OKR owner',
    },
    team: {
      type: 'Team',
      required: false,
      description: 'Responsible team',
    },
    department: {
      type: 'Department',
      required: false,
      description: 'Responsible department',
    },
    parent: {
      type: 'OKR',
      required: false,
      description: 'Parent OKR (alignment)',
    },
    children: {
      type: 'OKR[]',
      description: 'Aligned child OKRs',
    },
    keyResults: {
      type: 'KeyResult[]',
      description: 'Key results',
    },
  },

  actions: [
    'create',
    'update',
    'activate',
    'addKeyResult',
    'removeKeyResult',
    'updateProgress',
    'updateConfidence',
    'grade',
    'complete',
    'cancel',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'activated',
    'keyResultAdded',
    'keyResultRemoved',
    'progressUpdated',
    'confidenceUpdated',
    'graded',
    'completed',
    'cancelled',
    'archived',
  ],
}

// =============================================================================
// KeyResult
// =============================================================================

/**
 * KeyResult entity
 *
 * Represents a measurable key result within an OKR.
 */
export const KeyResult: Noun = {
  singular: 'key-result',
  plural: 'key-results',
  description: 'A measurable key result within an OKR',

  properties: {
    // Description
    description: {
      type: 'string',
      description: 'Key result description',
    },

    // Metric
    metric: {
      type: 'string',
      description: 'Metric being measured',
    },
    unit: {
      type: 'string',
      optional: true,
      description: 'Unit of measurement',
    },

    // Values
    startValue: {
      type: 'number',
      optional: true,
      description: 'Starting value',
    },
    targetValue: {
      type: 'number',
      description: 'Target value',
    },
    currentValue: {
      type: 'number',
      optional: true,
      description: 'Current value',
    },

    // Progress
    progress: {
      type: 'number',
      optional: true,
      description: 'Progress percentage (0-100)',
    },
    confidence: {
      type: 'number',
      optional: true,
      description: 'Confidence level (0-1)',
    },

    // Type
    direction: {
      type: 'string',
      optional: true,
      description: 'Direction of improvement',
      examples: ['increase', 'decrease', 'maintain'],
    },
    measurementType: {
      type: 'string',
      optional: true,
      description: 'How progress is measured',
      examples: ['percentage', 'absolute', 'binary', 'milestone'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Key result status',
      examples: ['not-started', 'on-track', 'at-risk', 'behind', 'completed'],
    },
  },

  relationships: {
    okr: {
      type: 'OKR',
      description: 'Parent OKR',
    },
    owner: {
      type: 'Worker',
      required: false,
      description: 'Key result owner',
    },
    initiatives: {
      type: 'Initiative[]',
      description: 'Supporting initiatives',
    },
  },

  actions: [
    'create',
    'update',
    'updateValue',
    'updateConfidence',
    'complete',
    'delete',
  ],

  events: [
    'created',
    'updated',
    'valueUpdated',
    'confidenceUpdated',
    'completed',
    'deleted',
  ],
}

// =============================================================================
// KPI (Key Performance Indicator)
// =============================================================================

/**
 * KPI entity
 *
 * Represents a key performance indicator.
 */
export const KPI: Noun = {
  singular: 'kpi',
  plural: 'kpis',
  description: 'A key performance indicator',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'KPI name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'KPI description',
    },
    code: {
      type: 'string',
      optional: true,
      description: 'KPI code (e.g., "MRR", "NPS")',
    },

    // Classification
    category: {
      type: 'string',
      optional: true,
      description: 'KPI category',
      examples: ['financial', 'customer', 'operations', 'people', 'product', 'growth'],
    },
    type: {
      type: 'string',
      optional: true,
      description: 'KPI type',
      examples: ['leading', 'lagging'],
    },

    // Measurement
    unit: {
      type: 'string',
      optional: true,
      description: 'Unit of measurement',
    },
    format: {
      type: 'string',
      optional: true,
      description: 'Display format',
      examples: ['number', 'currency', 'percentage', 'duration'],
    },
    precision: {
      type: 'number',
      optional: true,
      description: 'Decimal precision',
    },

    // Values
    targetValue: {
      type: 'number',
      optional: true,
      description: 'Target value',
    },
    currentValue: {
      type: 'number',
      optional: true,
      description: 'Current value',
    },
    previousValue: {
      type: 'number',
      optional: true,
      description: 'Previous period value',
    },
    baselineValue: {
      type: 'number',
      optional: true,
      description: 'Baseline value',
    },

    // Thresholds
    warningThreshold: {
      type: 'number',
      optional: true,
      description: 'Warning threshold',
    },
    criticalThreshold: {
      type: 'number',
      optional: true,
      description: 'Critical threshold',
    },
    direction: {
      type: 'string',
      optional: true,
      description: 'Good direction',
      examples: ['higher-is-better', 'lower-is-better', 'target'],
    },

    // Tracking
    frequency: {
      type: 'string',
      optional: true,
      description: 'Measurement frequency',
      examples: ['realtime', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly'],
    },
    lastMeasuredAt: {
      type: 'datetime',
      optional: true,
      description: 'Last measurement time',
    },

    // Calculation
    formula: {
      type: 'string',
      optional: true,
      description: 'Calculation formula',
    },
    dataSource: {
      type: 'string',
      optional: true,
      description: 'Data source',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'KPI status',
      examples: ['on-target', 'warning', 'critical', 'no-data'],
    },
  },

  relationships: {
    owner: {
      type: 'Worker',
      required: false,
      description: 'KPI owner',
    },
    department: {
      type: 'Department',
      required: false,
      description: 'Responsible department',
    },
    goals: {
      type: 'Goal[]',
      description: 'Related goals',
    },
    dashboard: {
      type: 'Dashboard',
      required: false,
      description: 'Display dashboard',
    },
    history: {
      type: 'KPIValue[]',
      description: 'Historical values',
    },
  },

  actions: [
    'create',
    'update',
    'measure',
    'setTarget',
    'setThresholds',
    'alert',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'measured',
    'targetSet',
    'thresholdBreached',
    'targetMet',
    'alerted',
    'archived',
  ],
}

// =============================================================================
// Metric
// =============================================================================

/**
 * Metric entity
 *
 * Represents a general business metric or measurement.
 */
export const Metric: Noun = {
  singular: 'metric',
  plural: 'metrics',
  description: 'A general business metric or measurement',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Metric name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Metric description',
    },

    // Classification
    category: {
      type: 'string',
      optional: true,
      description: 'Metric category',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags',
    },

    // Value
    value: {
      type: 'number',
      description: 'Current value',
    },
    unit: {
      type: 'string',
      optional: true,
      description: 'Unit of measurement',
    },

    // Timestamp
    timestamp: {
      type: 'datetime',
      description: 'Measurement timestamp',
    },
    period: {
      type: 'string',
      optional: true,
      description: 'Measurement period',
    },

    // Source
    source: {
      type: 'string',
      optional: true,
      description: 'Data source',
    },
  },

  relationships: {
    kpi: {
      type: 'KPI',
      required: false,
      description: 'Related KPI',
    },
  },

  actions: [
    'record',
    'update',
    'delete',
  ],

  events: [
    'recorded',
    'updated',
    'deleted',
  ],
}

// =============================================================================
// Initiative
// =============================================================================

/**
 * Initiative entity
 *
 * Represents a strategic initiative or project supporting goals.
 */
export const Initiative: Noun = {
  singular: 'initiative',
  plural: 'initiatives',
  description: 'A strategic initiative or project supporting goals',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Initiative name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Initiative description',
    },

    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'Initiative type',
      examples: ['project', 'program', 'experiment', 'improvement'],
    },
    priority: {
      type: 'string',
      optional: true,
      description: 'Priority level',
      examples: ['critical', 'high', 'medium', 'low'],
    },

    // Timeline
    startDate: {
      type: 'date',
      optional: true,
      description: 'Start date',
    },
    endDate: {
      type: 'date',
      optional: true,
      description: 'End date',
    },

    // Progress
    progress: {
      type: 'number',
      optional: true,
      description: 'Progress percentage (0-100)',
    },

    // Resources
    budget: {
      type: 'number',
      optional: true,
      description: 'Allocated budget',
    },
    budgetCurrency: {
      type: 'string',
      optional: true,
      description: 'Budget currency',
    },
    spent: {
      type: 'number',
      optional: true,
      description: 'Amount spent',
    },

    // Status
    status: {
      type: 'string',
      description: 'Initiative status',
      examples: ['proposed', 'approved', 'in-progress', 'on-hold', 'completed', 'cancelled'],
    },
  },

  relationships: {
    owner: {
      type: 'Worker',
      required: false,
      description: 'Initiative owner',
    },
    team: {
      type: 'Team',
      required: false,
      description: 'Responsible team',
    },
    goals: {
      type: 'Goal[]',
      description: 'Supported goals',
    },
    keyResults: {
      type: 'KeyResult[]',
      description: 'Supported key results',
    },
  },

  actions: [
    'create',
    'update',
    'approve',
    'start',
    'pause',
    'resume',
    'complete',
    'cancel',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'approved',
    'started',
    'paused',
    'resumed',
    'completed',
    'cancelled',
    'archived',
  ],
}

// =============================================================================
// Exports
// =============================================================================

export const GoalEntities = {
  Goal,
  OKR,
  KeyResult,
  KPI,
  Metric,
  Initiative,
}

export const GoalCategories = {
  objectives: ['Goal', 'OKR', 'KeyResult'],
  measurement: ['KPI', 'Metric'],
  execution: ['Initiative'],
} as const
