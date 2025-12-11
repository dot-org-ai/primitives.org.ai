/**
 * Engineering & Development Lifecycle Types
 *
 * Comprehensive types for software development lifecycle:
 * - Sprints and agile planning
 * - Releases and versioning
 * - Environments and configuration
 * - Feature flags and rollouts
 * - Deployments and rollbacks
 * - Incidents and on-call
 *
 * @module engineering
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
// Sprint - Agile Sprint Management
// =============================================================================

/**
 * Sprint status.
 */
export type SprintStatus =
  | 'planned'
  | 'active'
  | 'completed'
  | 'cancelled'

/**
 * Sprint representing an agile iteration.
 *
 * Tracks sprint planning, velocity, and completion
 * for agile development teams.
 *
 * @example
 * ```ts
 * const sprint: Sprint = {
 *   id: 'sprint_2024_q1_01',
 *   projectId: 'proj_001',
 *   name: 'Sprint 1',
 *   goal: 'Complete user authentication flow',
 *   status: 'active',
 *   startDate: new Date('2024-01-08'),
 *   endDate: new Date('2024-01-22'),
 *   plannedCapacity: 80,
 *   actualCapacity: 75,
 *   velocity: 45,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Sprint {
  /** Unique identifier */
  id: string

  /** Project ID */
  projectId: string

  /** Sprint name/number */
  name: string

  /** Sprint goal */
  goal?: string

  /** Sprint status */
  status: SprintStatus

  /** Start date */
  startDate: Date

  /** End date */
  endDate: Date

  /** Planned capacity (story points or hours) */
  plannedCapacity: number

  /** Actual capacity after adjustments */
  actualCapacity?: number

  /** Completed velocity */
  velocity?: number

  /** Committed story points */
  committedPoints?: number

  /** Completed story points */
  completedPoints?: number

  /** Carried over points from previous sprint */
  carryoverPoints?: number

  /** Team ID */
  teamId?: string

  /** Team members assigned */
  teamMembers?: string[]

  /** Sprint board columns */
  columns?: Array<{
    name: string
    order: number
    wipLimit?: number
  }>

  /** Retrospective notes */
  retrospective?: {
    wentWell?: string[]
    needsImprovement?: string[]
    actionItems?: Array<{
      description: string
      assignee?: string
      completed: boolean
    }>
    conductedAt?: Date
  }

  /** Daily standups */
  standups?: Array<{
    date: Date
    attendees: string[]
    blockers?: string[]
    notes?: string
  }>

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SprintInput = Input<Sprint>
export type SprintOutput = Output<Sprint>

// =============================================================================
// Release - Version/Release Management
// =============================================================================

/**
 * Release status.
 */
export type ReleaseStatus =
  | 'planned'
  | 'in_development'
  | 'code_freeze'
  | 'testing'
  | 'staging'
  | 'ready'
  | 'deploying'
  | 'released'
  | 'rolled_back'
  | 'cancelled'

/**
 * Release type.
 */
export type ReleaseType =
  | 'major'
  | 'minor'
  | 'patch'
  | 'hotfix'
  | 'rc'
  | 'beta'
  | 'alpha'

/**
 * Release representing a software version.
 *
 * Tracks release planning, contents, and deployment status.
 *
 * @example
 * ```ts
 * const release: Release = {
 *   id: 'rel_v2_1_0',
 *   projectId: 'proj_001',
 *   version: '2.1.0',
 *   name: 'February Release',
 *   type: 'minor',
 *   status: 'released',
 *   targetDate: new Date('2024-02-15'),
 *   releasedDate: new Date('2024-02-15'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Release {
  /** Unique identifier */
  id: string

  /** Project ID */
  projectId: string

  /** Version string */
  version: string

  /** Release name */
  name?: string

  /** Release type */
  type: ReleaseType

  /** Release status */
  status: ReleaseStatus

  /** Description */
  description?: string

  /** Target release date */
  targetDate?: Date

  /** Code freeze date */
  codeFreezeDate?: Date

  /** Actual release date */
  releasedDate?: Date

  /** Release branch */
  branch?: string

  /** Git tag */
  tag?: string

  /** Commit SHA */
  commitSha?: string

  /** Previous release version */
  previousVersion?: string

  /** Features included */
  features?: string[]

  /** Bugs fixed */
  bugFixes?: string[]

  /** Breaking changes */
  breakingChanges?: string[]

  /** Known issues */
  knownIssues?: string[]

  /** Migration steps */
  migrationSteps?: string[]

  /** Release notes (markdown) */
  releaseNotes?: string

  /** Changelog URL */
  changelogUrl?: string

  /** Documentation URL */
  documentationUrl?: string

  /** Environments deployed to */
  deployedEnvironments?: Array<{
    environmentId: string
    deployedAt: Date
    status: 'success' | 'failed' | 'rolled_back'
  }>

  /** Approvals */
  approvals?: Array<{
    stage: string
    approver: string
    approvedAt: Date
    notes?: string
  }>

  /** Release owner */
  ownerId?: string

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ReleaseInput = Input<Release>
export type ReleaseOutput = Output<Release>

// =============================================================================
// Environment - Deployment Environment
// =============================================================================

/**
 * Environment type.
 */
export type EnvironmentType =
  | 'development'
  | 'testing'
  | 'staging'
  | 'uat'
  | 'preview'
  | 'production'
  | 'dr'
  | 'custom'

/**
 * Environment status.
 */
export type EnvironmentStatus =
  | 'active'
  | 'provisioning'
  | 'updating'
  | 'degraded'
  | 'down'
  | 'decommissioned'

/**
 * Environment representing a deployment target.
 *
 * Tracks environment configuration, status, and deployments.
 *
 * @example
 * ```ts
 * const env: Environment = {
 *   id: 'env_prod',
 *   projectId: 'proj_001',
 *   name: 'Production',
 *   type: 'production',
 *   status: 'active',
 *   url: 'https://app.example.com',
 *   region: 'us-east-1',
 *   tier: 'production',
 *   requiresApproval: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Environment {
  /** Unique identifier */
  id: string

  /** Project ID */
  projectId: string

  /** Environment name */
  name: string

  /** Environment type */
  type: EnvironmentType

  /** Environment status */
  status: EnvironmentStatus

  /** Base URL */
  url?: string

  /** API URL */
  apiUrl?: string

  /** Cloud region */
  region?: string

  /** Cloud provider */
  provider?: 'aws' | 'gcp' | 'azure' | 'vercel' | 'netlify' | 'cloudflare' | 'other'

  /** Environment tier (affects resources) */
  tier?: 'development' | 'staging' | 'production'

  /** Requires approval for deployments */
  requiresApproval: boolean

  /** Approved deployers */
  approvedDeployers?: string[]

  /** Auto-deploy branch */
  autoDeployBranch?: string

  /** Current deployed version */
  currentVersion?: string

  /** Current deployment ID */
  currentDeploymentId?: string

  /** Last deployment date */
  lastDeployedAt?: Date

  /** Environment variables (non-sensitive) */
  variables?: Record<string, string>

  /** Secret references */
  secrets?: Array<{
    name: string
    source: string
    lastRotated?: Date
  }>

  /** Infrastructure configuration */
  infrastructure?: {
    compute?: {
      type: string
      instances?: number
      cpu?: string
      memory?: string
    }
    database?: {
      type: string
      size?: string
      replicas?: number
    }
    cache?: {
      type: string
      size?: string
    }
    cdn?: boolean
  }

  /** Health check configuration */
  healthCheck?: {
    endpoint: string
    intervalSeconds: number
    timeoutSeconds: number
    healthyThreshold: number
    unhealthyThreshold: number
  }

  /** Data handling rules */
  dataHandling?: {
    piiMasking: boolean
    dataRetentionDays?: number
    anonymization: boolean
  }

  /** Maintenance windows */
  maintenanceWindows?: Array<{
    dayOfWeek: number
    startHour: number
    durationHours: number
    timezone: string
  }>

  /** Protected environment (prevents accidental deletion) */
  protected: boolean

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EnvironmentInput = Input<Environment>
export type EnvironmentOutput = Output<Environment>

// =============================================================================
// FeatureFlag - Feature Toggle Management
// =============================================================================

/**
 * Feature flag status.
 */
export type FeatureFlagStatus =
  | 'active'
  | 'inactive'
  | 'archived'

/**
 * Feature flag type.
 */
export type FeatureFlagType =
  | 'boolean'
  | 'percentage'
  | 'targeting'
  | 'multivariate'

/**
 * FeatureFlag for controlling feature rollouts.
 *
 * Enables gradual rollouts, A/B testing, and kill switches.
 *
 * @example
 * ```ts
 * const flag: FeatureFlag = {
 *   id: 'ff_new_checkout',
 *   projectId: 'proj_001',
 *   key: 'new-checkout-flow',
 *   name: 'New Checkout Flow',
 *   description: 'Redesigned checkout experience',
 *   type: 'percentage',
 *   status: 'active',
 *   enabled: true,
 *   rolloutPercentage: 25,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface FeatureFlag {
  /** Unique identifier */
  id: string

  /** Project ID */
  projectId: string

  /** Flag key (used in code) */
  key: string

  /** Display name */
  name: string

  /** Description */
  description?: string

  /** Flag type */
  type: FeatureFlagType

  /** Flag status */
  status: FeatureFlagStatus

  /** Globally enabled */
  enabled: boolean

  /** Rollout percentage (for percentage type) */
  rolloutPercentage?: number

  /** Default value */
  defaultValue: boolean | string | number

  /** Variants (for multivariate) */
  variants?: Array<{
    key: string
    name: string
    value: boolean | string | number
    weight?: number
  }>

  /** Targeting rules */
  targeting?: {
    rules: Array<{
      id: string
      name?: string
      conditions: Array<{
        attribute: string
        operator: 'equals' | 'not_equals' | 'contains' | 'in' | 'not_in' | 'greater_than' | 'less_than'
        value: unknown
      }>
      variation: string | boolean | number
      percentage?: number
    }>
    defaultVariation: string | boolean | number
  }

  /** Environment-specific settings */
  environments?: Record<
    string,
    {
      enabled: boolean
      rolloutPercentage?: number
      targeting?: FeatureFlag['targeting']
    }
  >

  /** Tags for organization */
  tags?: string[]

  /** Related feature ID */
  featureId?: string

  /** Related experiment ID */
  experimentId?: string

  /** Owner */
  ownerId?: string

  /** Stale flag detection */
  staleDetection?: {
    lastEvaluatedAt?: Date
    evaluationCount?: number
    markedStaleAt?: Date
  }

  /** Scheduled changes */
  scheduledChanges?: Array<{
    scheduledFor: Date
    change: 'enable' | 'disable' | 'archive' | 'update_percentage'
    value?: unknown
    executed: boolean
    executedAt?: Date
  }>

  /** Audit log */
  changelog?: Array<{
    changedAt: Date
    changedBy: string
    change: string
    previousValue?: unknown
    newValue?: unknown
  }>

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FeatureFlagInput = Input<FeatureFlag>
export type FeatureFlagOutput = Output<FeatureFlag>

// =============================================================================
// Deployment - Deployment Execution
// =============================================================================

/**
 * Deployment status.
 */
export type DeploymentStatus =
  | 'pending'
  | 'queued'
  | 'building'
  | 'deploying'
  | 'verifying'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'rolling_back'
  | 'rolled_back'

/**
 * Deployment strategy.
 */
export type DeploymentStrategy =
  | 'rolling'
  | 'blue_green'
  | 'canary'
  | 'recreate'
  | 'feature_flag'

/**
 * Deployment representing a deployment execution.
 *
 * Tracks deployment lifecycle from start to completion.
 *
 * @example
 * ```ts
 * const deployment: Deployment = {
 *   id: 'deploy_001',
 *   projectId: 'proj_001',
 *   environmentId: 'env_prod',
 *   releaseId: 'rel_v2_1_0',
 *   version: '2.1.0',
 *   status: 'succeeded',
 *   strategy: 'rolling',
 *   startedAt: new Date('2024-02-15T10:00:00Z'),
 *   completedAt: new Date('2024-02-15T10:15:00Z'),
 *   deployedBy: 'user_001',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Deployment {
  /** Unique identifier */
  id: string

  /** Project ID */
  projectId: string

  /** Environment ID */
  environmentId: string

  /** Release ID */
  releaseId?: string

  /** Version being deployed */
  version: string

  /** Deployment status */
  status: DeploymentStatus

  /** Deployment strategy */
  strategy: DeploymentStrategy

  /** Git branch */
  branch?: string

  /** Git commit SHA */
  commitSha?: string

  /** Commit message */
  commitMessage?: string

  /** Triggered by */
  trigger: 'manual' | 'push' | 'merge' | 'schedule' | 'api' | 'rollback'

  /** User who initiated deployment */
  deployedBy: string

  /** Started timestamp */
  startedAt?: Date

  /** Completed timestamp */
  completedAt?: Date

  /** Duration in seconds */
  durationSeconds?: number

  /** Canary/rollout configuration */
  rollout?: {
    percentage: number
    incrementPercentage?: number
    incrementIntervalMinutes?: number
    pausedAt?: number
    targetPercentage: number
  }

  /** Build information */
  build?: {
    id: string
    duration?: number
    logs?: string
    artifacts?: Array<{
      name: string
      url: string
      size: number
    }>
  }

  /** Deployment steps */
  steps?: Array<{
    name: string
    status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped'
    startedAt?: Date
    completedAt?: Date
    logs?: string
    error?: string
  }>

  /** Health checks */
  healthChecks?: Array<{
    name: string
    status: 'pending' | 'healthy' | 'unhealthy'
    checkedAt?: Date
    response?: {
      statusCode: number
      latencyMs: number
    }
  }>

  /** Previous deployment (for rollback reference) */
  previousDeploymentId?: string

  /** Rollback information */
  rollback?: {
    triggeredAt: Date
    triggeredBy: string
    reason: string
    targetDeploymentId: string
  }

  /** Approvals */
  approvals?: Array<{
    stage: string
    required: boolean
    approver?: string
    approvedAt?: Date
    status: 'pending' | 'approved' | 'rejected'
    notes?: string
  }>

  /** Error information */
  error?: {
    message: string
    code?: string
    step?: string
    logs?: string
  }

  /** Notifications sent */
  notifications?: Array<{
    channel: 'slack' | 'email' | 'pagerduty' | 'webhook'
    sentAt: Date
    status: 'sent' | 'failed'
  }>

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DeploymentInput = Input<Deployment>
export type DeploymentOutput = Output<Deployment>

// =============================================================================
// Incident - Production Incident Management
// =============================================================================

/**
 * Incident severity.
 */
export type IncidentSeverity =
  | 'sev1'  // Critical - major outage
  | 'sev2'  // High - significant degradation
  | 'sev3'  // Medium - partial degradation
  | 'sev4'  // Low - minor issue
  | 'sev5'  // Informational

/**
 * Incident status.
 */
export type IncidentStatus =
  | 'detected'
  | 'investigating'
  | 'identified'
  | 'mitigating'
  | 'monitoring'
  | 'resolved'
  | 'postmortem'
  | 'closed'

/**
 * Incident representing a production issue.
 *
 * Tracks incident lifecycle from detection to resolution
 * and postmortem.
 *
 * @example
 * ```ts
 * const incident: Incident = {
 *   id: 'inc_001',
 *   projectId: 'proj_001',
 *   title: 'API Latency Spike',
 *   severity: 'sev2',
 *   status: 'resolved',
 *   summary: 'Database connection pool exhaustion caused API latency',
 *   detectedAt: new Date('2024-02-15T14:30:00Z'),
 *   acknowledgedAt: new Date('2024-02-15T14:32:00Z'),
 *   resolvedAt: new Date('2024-02-15T15:45:00Z'),
 *   commanderId: 'user_001',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Incident {
  /** Unique identifier */
  id: string

  /** Project ID */
  projectId: string

  /** Incident title */
  title: string

  /** Severity level */
  severity: IncidentSeverity

  /** Current status */
  status: IncidentStatus

  /** Summary of what happened */
  summary?: string

  /** Detailed description */
  description?: string

  /** Impact description */
  impact?: string

  /** Customer-facing status */
  customerImpact?: 'none' | 'minor' | 'partial' | 'major' | 'critical'

  /** Affected services/systems */
  affectedSystems?: string[]

  /** Affected environments */
  affectedEnvironments?: string[]

  /** Detection method */
  detectionMethod?: 'monitoring' | 'alert' | 'customer_report' | 'internal_report' | 'automated'

  /** Related alert IDs */
  alertIds?: string[]

  /** Detection timestamp */
  detectedAt: Date

  /** Acknowledgment timestamp */
  acknowledgedAt?: Date

  /** Identified timestamp (root cause found) */
  identifiedAt?: Date

  /** Mitigation started timestamp */
  mitigationStartedAt?: Date

  /** Resolved timestamp */
  resolvedAt?: Date

  /** Time to acknowledge (seconds) */
  timeToAcknowledge?: number

  /** Time to resolve (seconds) */
  timeToResolve?: number

  /** Incident commander */
  commanderId?: string

  /** Communications lead */
  communicationsLeadId?: string

  /** Team members involved */
  responders?: Array<{
    userId: string
    role: 'commander' | 'communications' | 'technical' | 'observer'
    joinedAt: Date
    leftAt?: Date
  }>

  /** Timeline of events */
  timeline?: Array<{
    timestamp: Date
    type: 'status_change' | 'action' | 'communication' | 'note'
    description: string
    author?: string
  }>

  /** Root cause (once identified) */
  rootCause?: string

  /** Resolution description */
  resolution?: string

  /** Mitigation steps taken */
  mitigationSteps?: string[]

  /** Related deployments */
  relatedDeploymentIds?: string[]

  /** Related commits */
  relatedCommits?: string[]

  /** Communication channels */
  communicationChannels?: {
    slackChannel?: string
    warRoom?: string
    statusPageUrl?: string
  }

  /** Status page updates */
  statusPageUpdates?: Array<{
    timestamp: Date
    status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
    message: string
  }>

  /** Customer communications sent */
  customerCommunications?: Array<{
    sentAt: Date
    channel: 'email' | 'in_app' | 'status_page' | 'social'
    subject?: string
    message: string
  }>

  /** Postmortem */
  postmortem?: {
    status: 'pending' | 'draft' | 'published'
    documentUrl?: string
    conductedAt?: Date
    attendees?: string[]
    findings?: string[]
    actionItems?: Array<{
      id: string
      description: string
      assignee?: string
      dueDate?: Date
      status: 'open' | 'in_progress' | 'completed'
      ticketId?: string
    }>
    lessonsLearned?: string[]
    preventionMeasures?: string[]
  }

  /** Tags */
  tags?: string[]

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type IncidentInput = Input<Incident>
export type IncidentOutput = Output<Incident>

// =============================================================================
// Actions
// =============================================================================

/**
 * Sprint actions.
 */
export interface SprintActions extends CRUDResource<Sprint, SprintInput> {
  /** List sprints by project */
  listByProject: Action<{ projectId: string } & ListParams, PaginatedResult<Sprint>>
  /** Get active sprint */
  getActive: Action<{ projectId: string }, Sprint | null>
  /** Start a sprint */
  start: Action<{ id: string }, Sprint>
  /** Complete a sprint */
  complete: Action<{ id: string; velocity?: number }, Sprint>
  /** Add retrospective */
  addRetrospective: Action<
    { id: string; retrospective: Sprint['retrospective'] },
    Sprint
  >
  /** Calculate velocity */
  calculateVelocity: Action<
    { projectId: string; sprintCount?: number },
    { averageVelocity: number; sprints: Array<{ id: string; velocity: number }> }
  >
}

/**
 * Release actions.
 */
export interface ReleaseActions extends CRUDResource<Release, ReleaseInput> {
  /** List releases by project */
  listByProject: Action<{ projectId: string } & ListParams, PaginatedResult<Release>>
  /** Get latest release */
  getLatest: Action<{ projectId: string }, Release | null>
  /** Start code freeze */
  startCodeFreeze: Action<{ id: string }, Release>
  /** Publish release */
  publish: Action<{ id: string; releaseNotes?: string }, Release>
  /** Roll back release */
  rollback: Action<{ id: string; reason: string }, Release>
  /** Add approval */
  approve: Action<{ id: string; stage: string; notes?: string }, Release>
  /** Generate changelog */
  generateChangelog: Action<{ id: string }, { changelog: string }>
}

/**
 * Environment actions.
 */
export interface EnvironmentActions extends CRUDResource<Environment, EnvironmentInput> {
  /** List environments by project */
  listByProject: Action<{ projectId: string } & ListParams, PaginatedResult<Environment>>
  /** Get environment status */
  getStatus: Action<{ id: string }, { status: EnvironmentStatus; health: 'healthy' | 'degraded' | 'down' }>
  /** Update variables */
  updateVariables: Action<{ id: string; variables: Record<string, string> }, Environment>
  /** Rotate secrets */
  rotateSecrets: Action<{ id: string; secrets: string[] }, Environment>
  /** Promote from another environment */
  promote: Action<{ id: string; fromEnvironmentId: string }, Deployment>
}

/**
 * FeatureFlag actions.
 */
export interface FeatureFlagActions extends CRUDResource<FeatureFlag, FeatureFlagInput> {
  /** List flags by project */
  listByProject: Action<{ projectId: string } & ListParams, PaginatedResult<FeatureFlag>>
  /** Toggle flag */
  toggle: Action<{ id: string; enabled: boolean }, FeatureFlag>
  /** Update rollout percentage */
  updateRollout: Action<{ id: string; percentage: number }, FeatureFlag>
  /** Add targeting rule */
  addTargetingRule: Action<
    { id: string; rule: NonNullable<FeatureFlag['targeting']>['rules'][0] },
    FeatureFlag
  >
  /** Schedule change */
  scheduleChange: Action<
    { id: string; scheduledFor: Date; change: 'enable' | 'disable'; value?: unknown },
    FeatureFlag
  >
  /** Evaluate flag for user */
  evaluate: Action<
    { key: string; userId: string; attributes?: Record<string, unknown> },
    { value: boolean | string | number; variation?: string }
  >
  /** Get stale flags */
  getStaleFlags: Action<{ projectId: string; days: number }, FeatureFlag[]>
}

/**
 * Deployment actions.
 */
export interface DeploymentActions extends CRUDResource<Deployment, DeploymentInput> {
  /** List deployments by environment */
  listByEnvironment: Action<{ environmentId: string } & ListParams, PaginatedResult<Deployment>>
  /** List deployments by release */
  listByRelease: Action<{ releaseId: string } & ListParams, PaginatedResult<Deployment>>
  /** Deploy */
  deploy: Action<
    { environmentId: string; version: string; releaseId?: string; strategy?: DeploymentStrategy },
    Deployment
  >
  /** Approve deployment */
  approve: Action<{ id: string; stage: string; notes?: string }, Deployment>
  /** Cancel deployment */
  cancel: Action<{ id: string; reason: string }, Deployment>
  /** Rollback */
  rollback: Action<{ id: string; targetDeploymentId?: string; reason: string }, Deployment>
  /** Update rollout */
  updateRollout: Action<{ id: string; percentage: number }, Deployment>
  /** Pause rollout */
  pauseRollout: Action<{ id: string }, Deployment>
  /** Resume rollout */
  resumeRollout: Action<{ id: string }, Deployment>
  /** Get deployment logs */
  getLogs: Action<{ id: string; step?: string }, { logs: string }>
}

/**
 * Incident actions.
 */
export interface IncidentActions extends CRUDResource<Incident, IncidentInput> {
  /** List incidents by project */
  listByProject: Action<{ projectId: string } & ListParams, PaginatedResult<Incident>>
  /** List active incidents */
  listActive: Action<{ projectId?: string } & ListParams, PaginatedResult<Incident>>
  /** Acknowledge incident */
  acknowledge: Action<{ id: string }, Incident>
  /** Update status */
  updateStatus: Action<{ id: string; status: IncidentStatus; notes?: string }, Incident>
  /** Escalate */
  escalate: Action<{ id: string; severity: IncidentSeverity; reason: string }, Incident>
  /** Add timeline event */
  addTimelineEvent: Action<
    { id: string; type: string; description: string },
    Incident
  >
  /** Resolve incident */
  resolve: Action<{ id: string; resolution: string; rootCause?: string }, Incident>
  /** Create postmortem */
  createPostmortem: Action<{ id: string }, Incident>
  /** Add action item */
  addActionItem: Action<
    { id: string; description: string; assignee?: string; dueDate?: Date },
    Incident
  >
  /** Get incident metrics */
  getMetrics: Action<
    { projectId: string; startDate: Date; endDate: Date },
    {
      totalIncidents: number
      bySeverity: Record<IncidentSeverity, number>
      mttr: number
      mtta: number
    }
  >
}

// =============================================================================
// Events
// =============================================================================

export interface SprintEvents {
  created: BaseEvent<'sprint.created', Sprint>
  started: BaseEvent<'sprint.started', Sprint>
  completed: BaseEvent<'sprint.completed', Sprint>
  cancelled: BaseEvent<'sprint.cancelled', Sprint>
}

export interface ReleaseEvents {
  created: BaseEvent<'release.created', Release>
  code_freeze: BaseEvent<'release.code_freeze', Release>
  published: BaseEvent<'release.published', Release>
  rolled_back: BaseEvent<'release.rolled_back', Release>
}

export interface EnvironmentEvents {
  created: BaseEvent<'environment.created', Environment>
  updated: BaseEvent<'environment.updated', { before: Environment; after: Environment }>
  status_changed: BaseEvent<'environment.status_changed', { environment: Environment; previousStatus: EnvironmentStatus }>
  deployed: BaseEvent<'environment.deployed', { environment: Environment; deployment: Deployment }>
}

export interface FeatureFlagEvents {
  created: BaseEvent<'feature_flag.created', FeatureFlag>
  toggled: BaseEvent<'feature_flag.toggled', { flag: FeatureFlag; enabled: boolean }>
  rollout_updated: BaseEvent<'feature_flag.rollout_updated', { flag: FeatureFlag; percentage: number }>
  archived: BaseEvent<'feature_flag.archived', FeatureFlag>
  stale: BaseEvent<'feature_flag.stale', FeatureFlag>
}

export interface DeploymentEvents {
  created: BaseEvent<'deployment.created', Deployment>
  started: BaseEvent<'deployment.started', Deployment>
  succeeded: BaseEvent<'deployment.succeeded', Deployment>
  failed: BaseEvent<'deployment.failed', { deployment: Deployment; error: string }>
  rolled_back: BaseEvent<'deployment.rolled_back', Deployment>
  approval_required: BaseEvent<'deployment.approval_required', { deployment: Deployment; stage: string }>
}

export interface IncidentEvents {
  created: BaseEvent<'incident.created', Incident>
  acknowledged: BaseEvent<'incident.acknowledged', Incident>
  status_changed: BaseEvent<'incident.status_changed', { incident: Incident; previousStatus: IncidentStatus }>
  escalated: BaseEvent<'incident.escalated', { incident: Incident; previousSeverity: IncidentSeverity }>
  resolved: BaseEvent<'incident.resolved', Incident>
  postmortem_created: BaseEvent<'incident.postmortem_created', Incident>
}

// =============================================================================
// Resources
// =============================================================================

export interface SprintResource extends SprintActions {
  on: <E extends keyof SprintEvents>(
    event: E,
    handler: EventHandler<SprintEvents[E]>
  ) => () => void
}

export interface ReleaseResource extends ReleaseActions {
  on: <E extends keyof ReleaseEvents>(
    event: E,
    handler: EventHandler<ReleaseEvents[E]>
  ) => () => void
}

export interface EnvironmentResource extends EnvironmentActions {
  on: <E extends keyof EnvironmentEvents>(
    event: E,
    handler: EventHandler<EnvironmentEvents[E]>
  ) => () => void
}

export interface FeatureFlagResource extends FeatureFlagActions {
  on: <E extends keyof FeatureFlagEvents>(
    event: E,
    handler: EventHandler<FeatureFlagEvents[E]>
  ) => () => void
}

export interface DeploymentResource extends DeploymentActions {
  on: <E extends keyof DeploymentEvents>(
    event: E,
    handler: EventHandler<DeploymentEvents[E]>
  ) => () => void
}

export interface IncidentResource extends IncidentActions {
  on: <E extends keyof IncidentEvents>(
    event: E,
    handler: EventHandler<IncidentEvents[E]>
  ) => () => void
}

// =============================================================================
// Proxy
// =============================================================================

/**
 * Engineering module proxy for RPC access.
 */
export interface EngineeringProxy {
  sprints: SprintResource
  releases: ReleaseResource
  environments: EnvironmentResource
  featureFlags: FeatureFlagResource
  deployments: DeploymentResource
  incidents: IncidentResource
}
