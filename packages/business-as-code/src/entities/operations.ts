/**
 * Operations Entity Types (Nouns)
 *
 * Business operations: Process, Workflow, Procedure, Policy.
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// Process
// =============================================================================

/**
 * Process entity
 *
 * Represents a business process with defined steps.
 */
export const Process: Noun = {
  singular: 'process',
  plural: 'processes',
  description: 'A business process with defined steps',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Process name',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Process description',
    },

    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'Process type',
      examples: ['core', 'support', 'management'],
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Process category',
      examples: ['sales', 'marketing', 'operations', 'finance', 'hr', 'engineering', 'support'],
    },

    // Flow
    triggerType: {
      type: 'string',
      optional: true,
      description: 'How process is triggered',
      examples: ['manual', 'event', 'schedule', 'condition'],
    },
    triggerDescription: {
      type: 'string',
      optional: true,
      description: 'Trigger description',
    },

    // IO
    inputs: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Required inputs',
    },
    outputs: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Expected outputs',
    },

    // Metrics
    averageDuration: {
      type: 'string',
      optional: true,
      description: 'Average completion time',
    },
    sla: {
      type: 'string',
      optional: true,
      description: 'SLA target',
    },

    // Automation
    automationLevel: {
      type: 'string',
      optional: true,
      description: 'Automation level',
      examples: ['manual', 'semi-automated', 'automated', 'autonomous'],
    },
    automationPercentage: {
      type: 'number',
      optional: true,
      description: 'Percentage automated (0-100)',
    },

    // Versioning
    version: {
      type: 'string',
      optional: true,
      description: 'Process version',
    },

    // Status
    status: {
      type: 'string',
      description: 'Process status',
      examples: ['draft', 'active', 'deprecated', 'archived'],
    },
  },

  relationships: {
    owner: {
      type: 'Worker',
      required: false,
      description: 'Process owner',
    },
    department: {
      type: 'Department',
      required: false,
      description: 'Owning department',
    },
    steps: {
      type: 'ProcessStep[]',
      description: 'Process steps',
    },
    workflows: {
      type: 'Workflow[]',
      description: 'Implementing workflows',
    },
    metrics: {
      type: 'KPI[]',
      description: 'Process metrics',
    },
  },

  actions: [
    'create',
    'update',
    'publish',
    'addStep',
    'removeStep',
    'reorderSteps',
    'automate',
    'deprecate',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'published',
    'stepAdded',
    'stepRemoved',
    'stepsReordered',
    'automated',
    'deprecated',
    'archived',
  ],
}

// =============================================================================
// ProcessStep
// =============================================================================

/**
 * ProcessStep entity
 *
 * Represents a step within a business process.
 */
export const ProcessStep: Noun = {
  singular: 'process-step',
  plural: 'process-steps',
  description: 'A step within a business process',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Step name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Step description',
    },

    // Order
    order: {
      type: 'number',
      description: 'Step order',
    },

    // Execution
    type: {
      type: 'string',
      optional: true,
      description: 'Step type',
      examples: ['task', 'decision', 'approval', 'notification', 'wait', 'parallel', 'subprocess'],
    },
    automationLevel: {
      type: 'string',
      optional: true,
      description: 'Automation level',
      examples: ['manual', 'semi-automated', 'automated'],
    },

    // Assignment
    responsible: {
      type: 'string',
      optional: true,
      description: 'Responsible role or person',
    },
    accountable: {
      type: 'string',
      optional: true,
      description: 'Accountable role or person',
    },

    // Time
    estimatedDuration: {
      type: 'string',
      optional: true,
      description: 'Estimated duration',
    },
    sla: {
      type: 'string',
      optional: true,
      description: 'SLA for this step',
    },

    // IO
    inputs: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Required inputs',
    },
    outputs: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Expected outputs',
    },

    // Instructions
    instructions: {
      type: 'markdown',
      optional: true,
      description: 'Step instructions',
    },

    // Conditions
    condition: {
      type: 'string',
      optional: true,
      description: 'Condition for step execution',
    },
  },

  relationships: {
    process: {
      type: 'Process',
      description: 'Parent process',
    },
    nextStep: {
      type: 'ProcessStep',
      required: false,
      description: 'Next step',
    },
    alternatives: {
      type: 'ProcessStep[]',
      description: 'Alternative next steps (for decisions)',
    },
  },

  actions: [
    'create',
    'update',
    'move',
    'duplicate',
    'delete',
  ],

  events: [
    'created',
    'updated',
    'moved',
    'duplicated',
    'deleted',
  ],
}

// =============================================================================
// Workflow
// =============================================================================

/**
 * Workflow entity
 *
 * Represents an automated workflow.
 */
export const Workflow: Noun = {
  singular: 'workflow',
  plural: 'workflows',
  description: 'An automated workflow',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Workflow name',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Workflow description',
    },

    // Trigger
    triggerType: {
      type: 'string',
      description: 'Trigger type',
      examples: ['event', 'schedule', 'webhook', 'manual', 'api'],
    },
    triggerEvent: {
      type: 'string',
      optional: true,
      description: 'Trigger event name',
    },
    triggerSchedule: {
      type: 'string',
      optional: true,
      description: 'Cron schedule',
    },
    triggerWebhook: {
      type: 'url',
      optional: true,
      description: 'Webhook URL',
    },
    triggerCondition: {
      type: 'string',
      optional: true,
      description: 'Trigger condition',
    },

    // Execution
    timeout: {
      type: 'number',
      optional: true,
      description: 'Timeout in seconds',
    },
    retryPolicy: {
      type: 'json',
      optional: true,
      description: 'Retry policy',
    },
    concurrency: {
      type: 'number',
      optional: true,
      description: 'Max concurrent executions',
    },

    // Stats
    runCount: {
      type: 'number',
      optional: true,
      description: 'Total run count',
    },
    successCount: {
      type: 'number',
      optional: true,
      description: 'Successful runs',
    },
    failureCount: {
      type: 'number',
      optional: true,
      description: 'Failed runs',
    },
    lastRunAt: {
      type: 'datetime',
      optional: true,
      description: 'Last run time',
    },
    lastRunStatus: {
      type: 'string',
      optional: true,
      description: 'Last run status',
    },

    // Status
    status: {
      type: 'string',
      description: 'Workflow status',
      examples: ['draft', 'active', 'paused', 'error', 'archived'],
    },
    enabled: {
      type: 'boolean',
      optional: true,
      description: 'Is enabled',
    },
  },

  relationships: {
    owner: {
      type: 'Worker',
      required: false,
      description: 'Workflow owner',
    },
    team: {
      type: 'Team',
      required: false,
      description: 'Owning team',
    },
    process: {
      type: 'Process',
      required: false,
      description: 'Parent process',
    },
    actions: {
      type: 'WorkflowAction[]',
      description: 'Workflow actions',
    },
    runs: {
      type: 'WorkflowRun[]',
      description: 'Execution history',
    },
  },

  actions: [
    'create',
    'update',
    'enable',
    'disable',
    'trigger',
    'test',
    'addAction',
    'removeAction',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'enabled',
    'disabled',
    'triggered',
    'completed',
    'failed',
    'archived',
  ],
}

// =============================================================================
// WorkflowAction
// =============================================================================

/**
 * WorkflowAction entity
 *
 * Represents an action step within a workflow.
 */
export const WorkflowAction: Noun = {
  singular: 'workflow-action',
  plural: 'workflow-actions',
  description: 'An action step within a workflow',

  properties: {
    // Identity
    name: {
      type: 'string',
      optional: true,
      description: 'Action name',
    },

    // Order
    order: {
      type: 'number',
      description: 'Action order',
    },

    // Type
    type: {
      type: 'string',
      description: 'Action type',
      examples: ['http', 'email', 'slack', 'database', 'transform', 'condition', 'loop', 'delay', 'approval', 'ai'],
    },
    operation: {
      type: 'string',
      optional: true,
      description: 'Operation to perform',
    },

    // Configuration
    config: {
      type: 'json',
      optional: true,
      description: 'Action configuration',
    },
    inputs: {
      type: 'json',
      optional: true,
      description: 'Input mappings',
    },

    // Conditions
    condition: {
      type: 'string',
      optional: true,
      description: 'Execution condition',
    },

    // Error handling
    continueOnError: {
      type: 'boolean',
      optional: true,
      description: 'Continue on error',
    },
    retryOnFailure: {
      type: 'boolean',
      optional: true,
      description: 'Retry on failure',
    },
    maxRetries: {
      type: 'number',
      optional: true,
      description: 'Max retry attempts',
    },
  },

  relationships: {
    workflow: {
      type: 'Workflow',
      description: 'Parent workflow',
    },
    nextAction: {
      type: 'WorkflowAction',
      required: false,
      description: 'Next action',
    },
  },

  actions: [
    'create',
    'update',
    'move',
    'duplicate',
    'delete',
    'test',
  ],

  events: [
    'created',
    'updated',
    'moved',
    'duplicated',
    'deleted',
    'executed',
    'failed',
  ],
}

// =============================================================================
// WorkflowRun
// =============================================================================

/**
 * WorkflowRun entity
 *
 * Represents a workflow execution instance.
 */
export const WorkflowRun: Noun = {
  singular: 'workflow-run',
  plural: 'workflow-runs',
  description: 'A workflow execution instance',

  properties: {
    // Status
    status: {
      type: 'string',
      description: 'Run status',
      examples: ['pending', 'running', 'completed', 'failed', 'cancelled', 'waiting'],
    },

    // Timing
    startedAt: {
      type: 'datetime',
      optional: true,
      description: 'Start time',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'Completion time',
    },
    duration: {
      type: 'number',
      optional: true,
      description: 'Duration in milliseconds',
    },

    // Progress
    currentStep: {
      type: 'number',
      optional: true,
      description: 'Current step number',
    },
    totalSteps: {
      type: 'number',
      optional: true,
      description: 'Total steps',
    },

    // IO
    triggerData: {
      type: 'json',
      optional: true,
      description: 'Trigger input data',
    },
    output: {
      type: 'json',
      optional: true,
      description: 'Final output',
    },

    // Error
    error: {
      type: 'string',
      optional: true,
      description: 'Error message',
    },
    errorStep: {
      type: 'number',
      optional: true,
      description: 'Step that failed',
    },

    // Retry
    attempt: {
      type: 'number',
      optional: true,
      description: 'Attempt number',
    },
  },

  relationships: {
    workflow: {
      type: 'Workflow',
      description: 'Parent workflow',
    },
    triggeredBy: {
      type: 'Worker',
      required: false,
      description: 'Who triggered the run',
    },
    stepResults: {
      type: 'WorkflowStepResult[]',
      description: 'Step execution results',
    },
  },

  actions: [
    'start',
    'pause',
    'resume',
    'cancel',
    'retry',
  ],

  events: [
    'started',
    'paused',
    'resumed',
    'completed',
    'failed',
    'cancelled',
    'retried',
  ],
}

// =============================================================================
// Policy
// =============================================================================

/**
 * Policy entity
 *
 * Represents a business policy or rule.
 */
export const Policy: Noun = {
  singular: 'policy',
  plural: 'policies',
  description: 'A business policy or rule',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Policy name',
    },
    code: {
      type: 'string',
      optional: true,
      description: 'Policy code',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Policy description',
    },

    // Classification
    type: {
      type: 'string',
      optional: true,
      description: 'Policy type',
      examples: ['compliance', 'operational', 'security', 'hr', 'financial', 'data'],
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Policy category',
    },

    // Content
    content: {
      type: 'markdown',
      optional: true,
      description: 'Policy content',
    },
    rules: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Policy rules',
    },

    // Enforcement
    enforcementLevel: {
      type: 'string',
      optional: true,
      description: 'Enforcement level',
      examples: ['mandatory', 'recommended', 'optional'],
    },
    violations: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Violation consequences',
    },

    // Dates
    effectiveDate: {
      type: 'date',
      optional: true,
      description: 'Effective date',
    },
    reviewDate: {
      type: 'date',
      optional: true,
      description: 'Next review date',
    },
    expirationDate: {
      type: 'date',
      optional: true,
      description: 'Expiration date',
    },

    // Versioning
    version: {
      type: 'string',
      optional: true,
      description: 'Policy version',
    },

    // Status
    status: {
      type: 'string',
      description: 'Policy status',
      examples: ['draft', 'review', 'active', 'superseded', 'archived'],
    },
  },

  relationships: {
    owner: {
      type: 'Worker',
      required: false,
      description: 'Policy owner',
    },
    department: {
      type: 'Department',
      required: false,
      description: 'Owning department',
    },
    supersedes: {
      type: 'Policy',
      required: false,
      description: 'Previous version superseded',
    },
    supersededBy: {
      type: 'Policy',
      required: false,
      description: 'New version that supersedes this',
    },
  },

  actions: [
    'create',
    'update',
    'submit',
    'approve',
    'publish',
    'supersede',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'submitted',
    'approved',
    'published',
    'superseded',
    'archived',
  ],
}

// =============================================================================
// Exports
// =============================================================================

export const OperationsEntities = {
  Process,
  ProcessStep,
  Workflow,
  WorkflowAction,
  WorkflowRun,
  Policy,
}

export const OperationsCategories = {
  processes: ['Process', 'ProcessStep'],
  automation: ['Workflow', 'WorkflowAction', 'WorkflowRun'],
  governance: ['Policy'],
} as const
