/**
 * AI Delivery Entity Types (Nouns)
 *
 * AI delivery mechanics: AgentDelivery, AutonomyLevel, EscalationRule, ConfidenceThreshold, HumanHandoff, QualityGate
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// AgentDelivery
// =============================================================================

/**
 * AgentDelivery entity
 *
 * AI agent configuration for autonomous service delivery.
 */
export const AgentDelivery: Noun = {
  singular: 'agent-delivery',
  plural: 'agent-deliveries',
  description: 'AI agent configuration for autonomous service delivery',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Agent name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Agent description',
    },

    // Model
    model: {
      type: 'string',
      description: 'AI model identifier',
      examples: ['gpt-4', 'claude-3', 'gemini-pro', 'llama-3', 'custom'],
    },
    modelProvider: {
      type: 'string',
      optional: true,
      description: 'Model provider',
      examples: ['openai', 'anthropic', 'google', 'meta', 'custom'],
    },
    modelConfig: {
      type: 'json',
      optional: true,
      description: 'Model configuration',
    },

    // Prompt
    systemPrompt: {
      type: 'string',
      optional: true,
      description: 'System prompt',
    },
    contextTemplate: {
      type: 'string',
      optional: true,
      description: 'Context template',
    },

    // Capabilities
    tools: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Available tools',
    },
    capabilities: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Agent capabilities',
    },

    // Autonomy — the **autonomy** axis of a Verb (how supervised), one of
    // the three orthogonal verb axes (kind · audience · autonomy) documented
    // at `@org.ai/types` (`FunctionKind`); local record: ADR 0013. Distinct
    // from the kind axis: an agentic-kind verb can run at any autonomy level.
    autonomyLevel: {
      type: 'string',
      description: 'Level of autonomous operation',
      examples: ['full', 'supervised', 'assisted', 'advisory'],
    },
    autonomyScore: {
      type: 'number',
      optional: true,
      description: 'Autonomy score (1-5)',
    },

    // Confidence
    confidenceThreshold: {
      type: 'number',
      description: 'Min confidence for autonomous action (0-1)',
    },
    lowConfidenceAction: {
      type: 'string',
      optional: true,
      description: 'Action when below threshold',
      examples: ['escalate', 'queue', 'retry', 'fail'],
    },

    // Execution
    maxIterations: {
      type: 'number',
      optional: true,
      description: 'Max iterations per execution',
    },
    maxTokens: {
      type: 'number',
      optional: true,
      description: 'Max tokens per execution',
    },
    timeoutMs: {
      type: 'number',
      optional: true,
      description: 'Execution timeout',
    },

    // Safety
    guardrails: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Safety guardrails',
    },
    prohibitedActions: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Prohibited actions',
    },

    // Escalation
    escalationTriggers: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Conditions that trigger escalation',
    },

    // Metrics
    avgConfidence: {
      type: 'number',
      optional: true,
      description: 'Average confidence score',
    },
    successRate: {
      type: 'number',
      optional: true,
      description: 'Success rate (0-1)',
    },
    escalationRate: {
      type: 'number',
      optional: true,
      description: 'Escalation rate (0-1)',
    },

    // Status
    status: {
      type: 'string',
      description: 'Agent status',
      examples: ['active', 'paused', 'training', 'deprecated'],
    },
  },

  relationships: {
    service: {
      type: 'ProductizedService',
      description: 'Parent service',
    },
    escalationRules: {
      type: 'EscalationRule[]',
      description: 'Escalation rules',
    },
    qualityGates: {
      type: 'QualityGate[]',
      description: 'Quality gates',
    },
    confidenceThresholds: {
      type: 'ConfidenceThreshold[]',
      description: 'Confidence thresholds',
    },
  },

  actions: [
    'create',
    'update',
    'activate',
    'pause',
    'train',
    'evaluate',
    'escalate',
    'deprecate',
  ],

  events: [
    'created',
    'updated',
    'activated',
    'paused',
    'trained',
    'evaluated',
    'escalated',
    'deprecated',
  ],
}

// =============================================================================
// AutonomyLevel
// =============================================================================

/**
 * AutonomyLevel entity
 *
 * Defines a level of autonomous operation.
 */
export const AutonomyLevel: Noun = {
  singular: 'autonomy-level',
  plural: 'autonomy-levels',
  description: 'A defined level of autonomous operation',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Level name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Level description',
    },

    // Level
    level: {
      type: 'number',
      description: 'Numeric level (1-5)',
    },
    code: {
      type: 'string',
      description: 'Level code',
      examples: ['full', 'supervised', 'assisted', 'advisory', 'manual'],
    },

    // Permissions
    allowedActions: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Allowed autonomous actions',
    },
    restrictedActions: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Actions requiring approval',
    },
    prohibitedActions: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Prohibited actions',
    },

    // Thresholds
    confidenceRequired: {
      type: 'number',
      optional: true,
      description: 'Min confidence for autonomous action',
    },
    maxRiskTolerance: {
      type: 'number',
      optional: true,
      description: 'Max risk score allowed',
    },
    maxImpactScore: {
      type: 'number',
      optional: true,
      description: 'Max impact score allowed',
    },

    // Human Involvement
    humanApprovalRequired: {
      type: 'boolean',
      optional: true,
      description: 'Requires human approval',
    },
    humanReviewFrequency: {
      type: 'string',
      optional: true,
      description: 'How often humans review',
      examples: ['always', 'sampled', 'periodic', 'on-error', 'never'],
    },
    reviewSampleRate: {
      type: 'number',
      optional: true,
      description: 'Percentage of tasks reviewed (0-100)',
    },

    // Status
    status: {
      type: 'string',
      description: 'Level status',
      examples: ['active', 'deprecated'],
    },
  },

  relationships: {
    agents: {
      type: 'AgentDelivery[]',
      description: 'Agents at this level',
    },
    escalationRules: {
      type: 'EscalationRule[]',
      description: 'Associated escalation rules',
    },
  },

  actions: [
    'create',
    'update',
    'activate',
    'deprecate',
  ],

  events: [
    'created',
    'updated',
    'activated',
    'deprecated',
  ],
}

// =============================================================================
// EscalationRule
// =============================================================================

/**
 * EscalationRule entity
 *
 * Rules for escalating to human intervention.
 */
export const EscalationRule: Noun = {
  singular: 'escalation-rule',
  plural: 'escalation-rules',
  description: 'A rule defining when to escalate to human intervention',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Rule name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Rule description',
    },

    // Trigger
    triggerType: {
      type: 'string',
      description: 'Trigger type',
      examples: ['confidence', 'error', 'timeout', 'risk', 'keyword', 'pattern', 'manual', 'custom'],
    },
    condition: {
      type: 'string',
      optional: true,
      description: 'Trigger condition expression',
    },

    // Confidence Triggers
    confidenceThreshold: {
      type: 'number',
      optional: true,
      description: 'Confidence below this triggers escalation',
    },
    confidenceField: {
      type: 'string',
      optional: true,
      description: 'Field to check for confidence',
    },

    // Error Triggers
    errorTypes: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Error types that trigger escalation',
    },
    maxRetries: {
      type: 'number',
      optional: true,
      description: 'Retries before escalation',
    },

    // Risk Triggers
    riskThreshold: {
      type: 'number',
      optional: true,
      description: 'Risk score threshold',
    },
    sensitivePatterns: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Patterns indicating sensitive content',
    },

    // Escalation Target
    escalateTo: {
      type: 'string',
      description: 'Escalation target',
      examples: ['queue', 'team', 'individual', 'on-call', 'manager'],
    },
    targetId: {
      type: 'string',
      optional: true,
      description: 'Target team/person ID',
    },

    // Timing
    responseTimeTarget: {
      type: 'number',
      optional: true,
      description: 'Target response time (seconds)',
    },
    autoEscalateAfter: {
      type: 'number',
      optional: true,
      description: 'Auto-escalate to next level after (seconds)',
    },

    // Priority
    priority: {
      type: 'string',
      optional: true,
      description: 'Escalation priority',
      examples: ['low', 'medium', 'high', 'critical'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Rule status',
      examples: ['active', 'disabled', 'testing'],
    },
  },

  relationships: {
    agent: {
      type: 'AgentDelivery',
      required: false,
      description: 'Parent agent',
    },
    service: {
      type: 'ProductizedService',
      required: false,
      description: 'Parent service',
    },
    handoffs: {
      type: 'HumanHandoff[]',
      description: 'Resulting handoffs',
    },
  },

  actions: [
    'create',
    'update',
    'enable',
    'disable',
    'test',
    'trigger',
  ],

  events: [
    'created',
    'updated',
    'enabled',
    'disabled',
    'tested',
    'triggered',
  ],
}

// =============================================================================
// ConfidenceThreshold
// =============================================================================

/**
 * ConfidenceThreshold entity
 *
 * Confidence-based decision rules.
 */
export const ConfidenceThreshold: Noun = {
  singular: 'confidence-threshold',
  plural: 'confidence-thresholds',
  description: 'A confidence-based decision rule',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Threshold name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Threshold description',
    },

    // Threshold
    minConfidence: {
      type: 'number',
      description: 'Minimum confidence (0-1)',
    },
    maxConfidence: {
      type: 'number',
      optional: true,
      description: 'Maximum confidence (0-1)',
    },

    // Context
    context: {
      type: 'string',
      optional: true,
      description: 'Application context',
      examples: ['classification', 'generation', 'extraction', 'decision', 'any'],
    },
    taskTypes: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Applicable task types',
    },

    // Action
    action: {
      type: 'string',
      description: 'Action when threshold met',
      examples: ['proceed', 'review', 'escalate', 'retry', 'fail'],
    },
    requiresHumanReview: {
      type: 'boolean',
      optional: true,
      description: 'Requires human review',
    },
    allowOverride: {
      type: 'boolean',
      optional: true,
      description: 'Allows human override',
    },

    // Risk Adjustment
    riskMultiplier: {
      type: 'number',
      optional: true,
      description: 'Risk-adjusted multiplier',
    },
    adjustForDomain: {
      type: 'boolean',
      optional: true,
      description: 'Adjust based on domain',
    },

    // Learning
    adaptive: {
      type: 'boolean',
      optional: true,
      description: 'Threshold adapts over time',
    },
    learningRate: {
      type: 'number',
      optional: true,
      description: 'Adaptation learning rate',
    },

    // Status
    status: {
      type: 'string',
      description: 'Threshold status',
      examples: ['active', 'disabled', 'testing'],
    },
  },

  relationships: {
    agent: {
      type: 'AgentDelivery',
      required: false,
      description: 'Parent agent',
    },
    service: {
      type: 'ProductizedService',
      required: false,
      description: 'Parent service',
    },
  },

  actions: [
    'create',
    'update',
    'enable',
    'disable',
    'adjust',
    'test',
  ],

  events: [
    'created',
    'updated',
    'enabled',
    'disabled',
    'adjusted',
    'tested',
  ],
}

// =============================================================================
// HumanHandoff
// =============================================================================

/**
 * HumanHandoff entity
 *
 * A point where AI hands off to human.
 */
export const HumanHandoff: Noun = {
  singular: 'human-handoff',
  plural: 'human-handoffs',
  description: 'A point where AI hands off to human intervention',

  properties: {
    // Identity
    id: {
      type: 'string',
      description: 'Handoff ID',
    },

    // Trigger
    triggerReason: {
      type: 'string',
      description: 'Why handoff was triggered',
      examples: ['low-confidence', 'error', 'escalation-rule', 'user-request', 'safety', 'complexity'],
    },
    triggerDetails: {
      type: 'string',
      optional: true,
      description: 'Detailed trigger explanation',
    },

    // Context
    context: {
      type: 'json',
      optional: true,
      description: 'Execution context at handoff',
    },
    conversationHistory: {
      type: 'json',
      optional: true,
      description: 'Conversation history',
    },
    agentOutput: {
      type: 'json',
      optional: true,
      description: 'Agent output before handoff',
    },
    confidence: {
      type: 'number',
      optional: true,
      description: 'Confidence at handoff',
    },

    // Assignment
    assignedTo: {
      type: 'string',
      optional: true,
      description: 'Assigned human/team',
    },
    assignedAt: {
      type: 'date',
      optional: true,
      description: 'Assignment time',
    },

    // Priority
    priority: {
      type: 'string',
      description: 'Handoff priority',
      examples: ['low', 'medium', 'high', 'critical'],
    },
    dueBy: {
      type: 'date',
      optional: true,
      description: 'Due date/time',
    },

    // Resolution
    resolution: {
      type: 'string',
      optional: true,
      description: 'Resolution type',
      examples: ['completed', 'returned-to-ai', 'cancelled', 'escalated-further'],
    },
    resolutionNotes: {
      type: 'string',
      optional: true,
      description: 'Resolution notes',
    },
    humanOutput: {
      type: 'json',
      optional: true,
      description: 'Human-provided output',
    },

    // Timing
    createdAt: {
      type: 'date',
      optional: true,
      description: 'Creation time',
    },
    resolvedAt: {
      type: 'date',
      optional: true,
      description: 'Resolution time',
    },
    waitTimeMs: {
      type: 'number',
      optional: true,
      description: 'Wait time in ms',
    },
    handlingTimeMs: {
      type: 'number',
      optional: true,
      description: 'Handling time in ms',
    },

    // Feedback
    feedbackProvided: {
      type: 'boolean',
      optional: true,
      description: 'Feedback was provided',
    },
    feedbackUsedForTraining: {
      type: 'boolean',
      optional: true,
      description: 'Used for AI training',
    },

    // Status
    status: {
      type: 'string',
      description: 'Handoff status',
      examples: ['pending', 'assigned', 'in-progress', 'resolved', 'expired'],
    },
  },

  relationships: {
    execution: {
      type: 'ServiceExecution',
      description: 'Related execution',
    },
    escalationRule: {
      type: 'EscalationRule',
      required: false,
      description: 'Triggering rule',
    },
    agent: {
      type: 'AgentDelivery',
      required: false,
      description: 'Agent that handed off',
    },
  },

  actions: [
    'create',
    'assign',
    'start',
    'resolve',
    'returnToAI',
    'escalate',
    'expire',
  ],

  events: [
    'created',
    'assigned',
    'started',
    'resolved',
    'returnedToAI',
    'escalated',
    'expired',
  ],
}

// =============================================================================
// QualityGate
// =============================================================================

/**
 * QualityGate entity
 *
 * Quality assurance checkpoint.
 */
export const QualityGate: Noun = {
  singular: 'quality-gate',
  plural: 'quality-gates',
  description: 'A quality assurance checkpoint in service delivery',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Gate name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Gate description',
    },

    // Position
    stage: {
      type: 'string',
      description: 'Pipeline stage',
      examples: ['input', 'processing', 'output', 'delivery'],
    },
    order: {
      type: 'number',
      optional: true,
      description: 'Gate order in stage',
    },

    // Criteria
    criteriaType: {
      type: 'string',
      description: 'Type of criteria',
      examples: ['rule', 'model', 'human', 'automated', 'hybrid'],
    },
    criteria: {
      type: 'json',
      optional: true,
      description: 'Quality criteria definition',
    },

    // Thresholds
    passThreshold: {
      type: 'number',
      optional: true,
      description: 'Score to pass (0-1)',
    },
    warnThreshold: {
      type: 'number',
      optional: true,
      description: 'Score for warning (0-1)',
    },

    // Actions
    onPass: {
      type: 'string',
      optional: true,
      description: 'Action on pass',
      examples: ['continue', 'log', 'notify'],
    },
    onFail: {
      type: 'string',
      optional: true,
      description: 'Action on fail',
      examples: ['block', 'escalate', 'retry', 'warn'],
    },
    onWarn: {
      type: 'string',
      optional: true,
      description: 'Action on warning',
      examples: ['continue', 'flag', 'review'],
    },

    // Review
    requiresReview: {
      type: 'boolean',
      optional: true,
      description: 'Requires human review',
    },
    reviewSampleRate: {
      type: 'number',
      optional: true,
      description: 'Sample rate for review (0-100)',
    },

    // Metrics
    passRate: {
      type: 'number',
      optional: true,
      description: 'Historical pass rate',
    },
    avgScore: {
      type: 'number',
      optional: true,
      description: 'Average quality score',
    },
    evaluationsCount: {
      type: 'number',
      optional: true,
      description: 'Total evaluations',
    },

    // Status
    status: {
      type: 'string',
      description: 'Gate status',
      examples: ['active', 'disabled', 'testing'],
    },
  },

  relationships: {
    agent: {
      type: 'AgentDelivery',
      required: false,
      description: 'Parent agent',
    },
    service: {
      type: 'ProductizedService',
      required: false,
      description: 'Parent service',
    },
    workflow: {
      type: 'ServiceWorkflow',
      required: false,
      description: 'Parent workflow',
    },
  },

  actions: [
    'create',
    'update',
    'enable',
    'disable',
    'evaluate',
    'adjustThreshold',
  ],

  events: [
    'created',
    'updated',
    'enabled',
    'disabled',
    'evaluated',
    'passed',
    'failed',
    'warned',
  ],
}

// =============================================================================
// Exports
// =============================================================================

export const DeliveryEntities = {
  AgentDelivery,
  AutonomyLevel,
  EscalationRule,
  ConfidenceThreshold,
  HumanHandoff,
  QualityGate,
}

export const DeliveryCategories = {
  agents: ['AgentDelivery'],
  autonomy: ['AutonomyLevel', 'ConfidenceThreshold'],
  escalation: ['EscalationRule', 'HumanHandoff'],
  quality: ['QualityGate'],
} as const
