/**
 * Core types for AI experimentation
 */

/**
 * A variant within an experiment
 */
export interface ExperimentVariant<TConfig = unknown> {
  /** Unique identifier for the variant */
  id: string
  /** Human-readable name */
  name: string
  /** Variant configuration */
  config: TConfig
  /** Weight for weighted random selection (default: 1) */
  weight?: number
  /** Optional description */
  description?: string
}

/**
 * Configuration for an experiment
 */
export interface ExperimentConfig<TConfig = unknown, TResult = unknown> {
  /** Unique experiment identifier */
  id: string
  /** Human-readable name */
  name: string
  /** Experiment description */
  description?: string
  /** List of variants to test */
  variants: ExperimentVariant<TConfig>[]
  /** Function to execute for each variant */
  execute: (config: TConfig, context?: ExperimentContext) => Promise<TResult> | TResult
  /** Optional success metric function */
  metric?: (result: TResult) => number | Promise<number>
  /** Metadata for the experiment */
  metadata?: Record<string, unknown>
}

/**
 * Context passed to experiment execution
 */
export interface ExperimentContext {
  /** Experiment ID */
  experimentId: string
  /** Variant ID */
  variantId: string
  /** Run ID (unique per execution) */
  runId: string
  /** Timestamp when execution started */
  startedAt: Date
  /** Additional context data */
  data?: Record<string, unknown>
}

/**
 * Result of executing an experiment variant
 */
export interface ExperimentResult<TResult = unknown> {
  /** Experiment ID */
  experimentId: string
  /** Variant ID */
  variantId: string
  /** Variant name */
  variantName: string
  /** Run ID */
  runId: string
  /** Execution result */
  result: TResult
  /** Computed metric value (if metric function provided) */
  metricValue?: number
  /** Execution duration in milliseconds */
  duration: number
  /** Timestamp when execution started */
  startedAt: Date
  /** Timestamp when execution completed */
  completedAt: Date
  /** Error if execution failed */
  error?: Error
  /** Success flag */
  success: boolean
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Summary of experiment results across all variants
 */
export interface ExperimentSummary<TResult = unknown> {
  /** Experiment ID */
  experimentId: string
  /** Experiment name */
  experimentName: string
  /** Results for each variant */
  results: ExperimentResult<TResult>[]
  /** Best performing variant (by metric) */
  bestVariant?: {
    variantId: string
    variantName: string
    metricValue: number
  }
  /** Total execution duration */
  totalDuration: number
  /** Number of successful runs */
  successCount: number
  /** Number of failed runs */
  failureCount: number
  /** Timestamp when experiment started */
  startedAt: Date
  /** Timestamp when experiment completed */
  completedAt: Date
}

/**
 * Options for running an experiment
 */
export interface RunExperimentOptions {
  /** Run variants in parallel (default: true) */
  parallel?: boolean
  /** Maximum concurrent executions (default: unlimited) */
  maxConcurrency?: number
  /** Stop on first error (default: false) */
  stopOnError?: boolean
  /** Custom context data */
  context?: Record<string, unknown>
  /** Event callbacks */
  onVariantStart?: (variantId: string, variantName: string) => void
  onVariantComplete?: (result: ExperimentResult) => void
  onVariantError?: (variantId: string, error: Error) => void
}

/**
 * Parameters for cartesian product generation
 */
export type CartesianParams = Record<string, unknown[]>

/**
 * Result of cartesian product - array of parameter combinations
 */
export type CartesianResult<T extends CartesianParams> = Array<{
  [K in keyof T]: T[K][number]
}>

/**
 * Decision options
 */
export interface DecideOptions<T> {
  /** Options to choose from */
  options: T[]
  /** Scoring function for each option */
  score: (option: T) => number | Promise<number>
  /** Context or prompt for decision making */
  context?: string
  /** Whether to return all options sorted by score (default: false) */
  returnAll?: boolean
}

/**
 * Result of a decision
 */
export interface DecisionResult<T> {
  /** The selected option */
  selected: T
  /** Score of the selected option */
  score: number
  /** All options with their scores (if returnAll was true) */
  allOptions?: Array<{ option: T; score: number }>
}

/**
 * Tracking event types
 */
export type TrackingEventType =
  | 'experiment.start'
  | 'experiment.complete'
  | 'variant.start'
  | 'variant.complete'
  | 'variant.error'
  | 'metric.computed'
  | 'decision.made'

/**
 * Tracking event
 */
export interface TrackingEvent {
  /** Event type */
  type: TrackingEventType
  /** Timestamp */
  timestamp: Date
  /** Event data */
  data: Record<string, unknown>
}

/**
 * Tracking backend interface
 */
export interface TrackingBackend {
  /** Track an event */
  track(event: TrackingEvent): void | Promise<void>
  /** Flush pending events */
  flush?(): void | Promise<void>
}

/**
 * Options for tracking configuration
 */
export interface TrackingOptions {
  /** Custom tracking backend */
  backend?: TrackingBackend
  /** Whether tracking is enabled (default: true) */
  enabled?: boolean
  /** Additional metadata to include with all events */
  metadata?: Record<string, unknown>
}
