/**
 * human-in-the-loop - Primitives for integrating human oversight and intervention in AI workflows
 *
 * This package provides primitives for human oversight and intervention in AI workflows:
 * - Approval gates and workflows
 * - Review processes and queues
 * - Escalation paths
 * - Human intervention points
 * - Role and team management
 * - Goals, KPIs, and OKRs tracking
 *
 * Implements the digital-workers interface for humans operating within a company boundary.
 *
 * @packageDocumentation
 * @example
 * ```ts
 * import { Human, approve, ask, notify } from 'human-in-the-loop'
 *
 * // Create a Human-in-the-loop manager
 * const human = Human({
 *   defaultTimeout: 3600000, // 1 hour
 *   autoEscalate: true,
 * })
 *
 * // Request approval
 * const result = await approve({
 *   title: 'Deploy to production',
 *   description: 'Approve deployment of v2.0.0',
 *   subject: 'Production Deployment',
 *   assignee: 'tech-lead@example.com',
 *   priority: 'high',
 * })
 *
 * if (result.approved) {
 *   await deploy()
 *   await notify({
 *     type: 'success',
 *     title: 'Deployment complete',
 *     message: 'v2.0.0 deployed to production',
 *     recipient: 'team@example.com',
 *   })
 * }
 * ```
 */

// Export main Human constructor and manager
export { Human, HumanManager } from './human.js'

// Export helper functions (convenience API)
export {
  defineRole,
  defineTeam,
  defineGoals,
  approve,
  ask,
  do,
  decide,
  generate,
  is,
  notify,
  kpis,
  okrs,
  registerHuman,
  getDefaultHuman,
} from './helpers.js'

// Re-export organizational types from org.ai for convenience
export type {
  // Organizational types
  Role,
  Team,
  Goal,
  Goals,
  KPI,
  OKR,
  KeyResult,
} from 'org.ai'

// Re-export business entity types from business-as-code
export type {
  BusinessDefinition as Business,
  Organization as Company,
  Organization as Org,
  Organization,
  OrgTeam,
} from 'business-as-code'

// ============================================================================
// Digital Tools Types (schema.org.ai)
// ============================================================================

/**
 * Tool, Integration, and Capability types from @org.ai/types.
 *
 * These types represent the capabilities and integrations available to workers
 * and systems in the digital-workers ecosystem:
 *
 * - **Tool**: Functions/APIs that agents can invoke to accomplish tasks
 * - **Integration**: Connections to external services (Stripe, Slack, etc.)
 * - **Capability**: What a Worker/Agent/Tool can do (read, write, execute, etc.)
 *
 * @example
 * ```typescript
 * import type { ToolType, IntegrationType, CapabilityType } from 'human-in-the-loop'
 * import { createTool, createIntegration, createCapability, isTool, isIntegration, isCapability } from 'human-in-the-loop'
 *
 * // Create a tool
 * const searchTool = createTool({
 *   name: 'web-search',
 *   description: 'Search the web for information',
 *   inputs: [{ name: 'query', type: 'string', required: true }],
 *   outputs: { type: 'object' },
 * })
 *
 * // Create an integration
 * const slackIntegration = createIntegration({
 *   name: 'slack',
 *   provider: 'slack',
 *   category: 'message',
 *   capabilities: ['send_message', 'read_channel'],
 * })
 *
 * // Create a capability
 * const readCapability = createCapability({
 *   name: 'read-files',
 *   description: 'Read files from the filesystem',
 *   category: 'read',
 * })
 * ```
 */

// Re-export Tool types and utilities
export type {
  // Tool types
  ToolType,
  ToolParameterType,
  ToolInputType,
  ToolOutputType,
  ToolExecutionResultType,
  ToolValidationErrorType,
  ToolValidationResultType,
  ToolExecutorType,
  ToolCapabilityType,
  ExecutableToolType,
  ValidatableToolType,
  ToolsType,
  ToolboxType,
  ToolId,
} from 'org.ai'

export {
  // Tool constants
  TOOL_TYPE,
  StandardToolTypes,
  StandardCapabilities,
  // Tool runtime markers
  Tool,
  ToolInput,
  ToolOutput,
  ToolParameter,
  ToolExecutionResult,
  ToolValidationError,
  ToolValidationResult,
  ToolExecutor,
  ExecutableTool,
  ValidatableTool,
  Tools,
  Toolbox,
  ToolCapability,
  // Tool ID runtime marker (overloaded as type and symbol)
  ToolId as ToolIdMarker,
  // Tool type guards
  isTool,
  isToolId,
  isToolParameter,
  isToolExecutionResult,
  isToolValidationError,
} from 'org.ai'

// Re-export Integration types and utilities
export type {
  // Integration types
  IntegrationType,
  IntegrationStatusType,
  IntegrationCategoryType,
  IntegrationId,
} from 'org.ai'

export {
  // Integration constants
  INTEGRATION_TYPE,
  IntegrationStatus,
  IntegrationCategory,
  // Integration runtime markers
  Integration,
  Integrations,
  IntegrationId as IntegrationIdMarker,
  // Integration schema
  IntegrationSchema,
  // Integration type guards and factory
  isIntegration,
  isIntegrationId,
  createIntegration,
} from 'org.ai'

// Re-export Capability types and utilities
export type {
  // Capability types
  CapabilityType,
  CapabilityCategoryType,
  CapabilityLevelType,
  CapabilityId,
} from 'org.ai'

export {
  // Capability constants
  CAPABILITY_TYPE,
  CapabilityCategory,
  CapabilityLevel,
  // Capability runtime markers
  Capability,
  Capabilities,
  CapabilityId as CapabilityIdMarker,
  // Capability schema
  CapabilitySchema,
  // Capability type guards and factory
  isCapability,
  isCapabilityId,
  createCapability,
  hasCapability,
} from 'org.ai'

// Export store implementations
export { InMemoryHumanStore } from './store.js'

// Export enhanced store for digital-workers runtime
export {
  InMemoryHumanStore as EnhancedInMemoryStore,
  createInMemoryStore,
} from './stores/in-memory.js'

export type { InMemoryHumanStoreOptions } from './stores/in-memory.js'

// Export timeout/retry utilities
export {
  // Classes
  ExponentialBackoff,
  HumanRetryPolicy,
  HumanCircuitBreaker,
  SLATracker,
  // Error types
  RetryError,
  CircuitOpenError,
  SLAViolationError,
  // Functions
  withRetry,
} from './timeout-retry.js'

export type {
  BackoffConfig,
  RetryConfig,
  CircuitBreakerConfig,
  SLAConfig,
  WithRetryOptions,
  CircuitState,
  EscalationContext,
  RetryExhaustedContext,
  SLAWarningContext,
  SLAViolationContext,
} from './timeout-retry.js'

// Export webhook functionality
export {
  createWebhookRegistry,
  getDefaultWebhookRegistry,
  signPayload,
  verifySignature,
} from './webhooks.js'

export type {
  WebhookRegistry,
  WebhookConfig,
  WebhookEvent,
  WebhookEventType,
  WebhookRegistryOptions,
  DeliveryResult,
  RetryOptions as WebhookRetryOptions,
  DeadLetterItem,
} from './webhooks.js'

// Export cascade tier registry for failure type routing
export { TierRegistry } from './tier-registry.js'

export type {
  CascadeTier,
  TierConfig,
  TierHandler,
  TierHandlerResult,
  TierMetrics,
  FailureType,
  FailurePattern,
  FailureInfo,
  PriorityMapping,
} from './tier-registry.js'

// Export fallback resolution patterns for human decisions
export {
  DecisionLogger,
  FeedbackLoop,
  FallbackChain,
  DecisionAnalytics,
} from './fallback-resolution.js'

// Export AI failure to human escalation integration
export {
  AIFailureClassifier,
  ContextSanitizer,
  AutoEscalationTrigger,
  EscalationRouter,
} from './ai-failure-escalation.js'

export type {
  // AI failure types
  AIFailure,
  FailureCategory,
  FailureSeverity,
  CascadeTierId,
  FailureTypeConfig,
  CategoryRule,
  SanitizedContext,
  ContextSanitizerOptions,
  // Escalation types
  EscalationConfig,
  EscalationEvent,
  FailureRecord,
  EscalationRoute,
  ReviewerConfig,
  RoutingMetrics,
  EscalationRequestParams,
  CreatedEscalationRequest,
} from './ai-failure-escalation.js'

export type {
  // Decision logging
  DecisionContext,
  DecisionLog,
  LogDecisionInput,
  ComplianceReportFilters,
  ComplianceReport,
  // Feedback loop
  FeedbackSignal,
  GenerateSignalInput,
  TrainingBatch,
  AccuracyMetrics,
  // Fallback chain
  FallbackHandler,
  EscalationRecord,
  EscalationAudit,
  ExecuteWithFallbackResult,
  // Analytics
  DecisionPattern,
  TimePatterns,
  DashboardData,
} from './fallback-resolution.js'

// Export human-in-the-loop specific types
export type {
  // Status and enums
  HumanRequestStatus,
  Priority,

  // Human-specific type (with contact channels)
  Human as HumanType,

  // Legacy aliases (deprecated - use org.ai types directly)
  KPIs,
  OKRs,

  // Request types
  HumanRequest,
  ApprovalRequest,
  ApprovalResponse,
  QuestionRequest,
  TaskRequest,
  DecisionRequest,
  ReviewRequest,
  ReviewResponse,
  Notification,

  // Management
  ReviewQueue,
  EscalationPolicy,
  ApprovalWorkflow,

  // Store interface
  HumanStore,
  HumanOptions,

  // Retry/Circuit Breaker/SLA options
  RetryOptions,
  CircuitBreakerOptions,
  SLAOptions,
} from './types.js'
