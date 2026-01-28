/**
 * digital-workers - Abstract interface for organizing digital work
 *
 * This package provides the foundational abstraction for structuring work
 * independent of whether AI agents or humans perform individual tasks. It
 * defines a unified Worker interface that enables workflows to be designed
 * once and executed by any combination of AI and human workers.
 *
 * ## Worker Routing vs ai-functions Primitives
 *
 * **IMPORTANT:** This package exports functions that overlap in name with
 * `ai-functions` primitives (do, ask, decide, approve, generate, is) but
 * serve fundamentally different purposes:
 *
 * | Function | digital-workers | ai-functions |
 * |----------|----------------|--------------|
 * | `do` | Routes tasks to Workers | Direct LLM task description |
 * | `ask` | Routes questions via Slack/email | LLM content for human UI |
 * | `decide` | Multi-criteria decision framework | LLM-as-judge comparison |
 * | `approve` | Real approval workflow via channels | LLM-generated approval content |
 * | `generate` | Content generation with metadata | Core LLM generation primitive |
 * | `is` | Type/schema validation with errors | Boolean assertion via LLM |
 * | `notify` | Real channel delivery | (no equivalent) |
 *
 * **digital-workers functions are worker coordination primitives** that route
 * work to AI Agents or Humans via real communication channels.
 *
 * **ai-functions primitives are direct LLM operations** for text generation,
 * decision-making, and content creation.
 *
 * ## Package relationships:
 * - `autonomous-agents` - Implements Worker for AI agents
 * - `human-in-the-loop` - Implements Worker for humans
 * - `ai-workflows` - Uses digital-workers to orchestrate execution
 *
 * The key insight: define WHAT work needs to happen, not WHO does it.
 *
 * ## Worker Actions
 *
 * Worker actions (notify, ask, approve, decide, do) are durable workflow actions
 * that integrate with ai-workflows. They can be invoked via:
 *
 * 1. `$.do('Worker.notify', data)` - Durable action
 * 2. `$.send('Worker.notify', data)` - Fire and forget
 * 3. `$.notify(target, message)` - Convenience method (when using withWorkers)
 *
 * @example
 * ```ts
 * import { Workflow } from 'ai-workflows'
 * import { registerWorkerActions, withWorkers } from 'digital-workers'
 *
 * const workflow = Workflow($ => {
 *   registerWorkerActions($)
 *   const worker$ = withWorkers($)
 *
 *   $.on.Expense.submitted(async (expense) => {
 *     // These route to REAL workers via REAL channels
 *     await worker$.notify(finance, `New expense: ${expense.amount}`)
 *
 *     const approval = await worker$.approve(
 *       `Expense: $${expense.amount}`,
 *       manager,
 *       { via: 'slack' }  // Actually sends to Slack!
 *     )
 *
 *     if (approval.approved) {
 *       await worker$.notify(expense.submitter, 'Expense approved!')
 *     }
 *   })
 * })
 * ```
 *
 * @packageDocumentation
 */

// Export all types
export type * from './types.js'

// Export workflow integration
export {
  registerWorkerActions,
  withWorkers,
  handleNotify,
  handleAsk,
  handleApprove,
  handleDecide,
  handleDo,
  notify as notifyAction,
  ask as askAction,
  approve as approveAction,
  decide as decideAction,
} from './actions.js'

// Export core functions
export { Role } from './role.js'
export { Team } from './team.js'
export { Goals } from './goals.js'

/**
 * Worker Routing Functions
 *
 * These functions route work to Workers (AI Agents or Humans) via real
 * communication channels. They are NOT direct LLM primitives.
 *
 * For direct LLM primitives, use the identically-named functions from
 * `ai-functions` instead. See module documentation for comparison table.
 */
export { approve } from './approve.js'
export { ask } from './ask.js'
export { browse } from './browse.js'
export { do } from './do.js'
export { decide } from './decide.js'
export { generate } from './generate.js'
export { image } from './image.js'
export { is } from './is.js'
export { notify } from './notify.js'
export { video } from './video.js'

export { kpis, okrs } from './kpis.js'

// Export verb definitions
export { WorkerVerbs } from './types.js'

// Export capability tiers
export {
  CAPABILITY_TIERS,
  TIER_ORDER,
  compareTiers,
  isHigherTier,
  isLowerTier,
  getNextTier,
  getPreviousTier,
  getTierConfig,
  getToolsForTier,
  matchTierToComplexity,
  canExecuteAtTier,
  validateTierEscalation,
  createCapabilityProfile,
  TierRegistry,
} from './capability-tiers.js'

export type {
  CapabilityTier,
  CapabilityProfile,
  TierConfig,
  TierToolset,
  TaskComplexity,
  TierMatchResult,
  TierEscalation,
  EscalationValidationResult,
  ProfileConstraints,
} from './capability-tiers.js'

// Export browser automation types
export type {
  BrowseOptions,
  BrowseResult,
  BrowseAction,
  BrowseActionType,
  Viewport,
  ClickOptions,
  TypeOptions,
  ScrollOptions,
  ScreenshotOptions,
  ExtractOptions,
} from './browse.js'

// Export image generation types
export type {
  ImageStyle,
  ImageSize,
  ImageFormat,
  ImageOptions,
  ImageResult,
  VariationOptions,
  EditOptions,
  UpscaleOptions,
  UpscaleResult,
} from './image.js'

// Export video generation types
export type {
  VideoOptions,
  VideoResult,
  VideoResolution,
  VideoAspectRatio,
  VideoModel,
  VideoStyle,
  VideoMetadata,
  VideoFromImageOptions,
  VideoExtendOptions,
  VideoEditOptions,
} from './video.js'

// Export transport bridge (connects to digital-tools)
export type {
  Transport,
  TransportConfig,
  MessagePayload,
  MessageAction,
  DeliveryResult,
  Address,
  TransportHandler,
} from './transports.js'

export {
  channelToTransport,
  getWorkerTransports,
  getTeamTransports,
  resolveAddress,
  resolveWorkerAddresses,
  getPrimaryAddress,
  registerTransport,
  getTransportHandler,
  hasTransport,
  listTransports,
  sendViaTransport,
  sendToMultipleTransports,
  buildNotifyPayload,
  buildAskPayload,
  buildApprovePayload,
  toDigitalToolsMessage,
  fromDigitalToolsMessage,
  MessageTypeMapping,
  CallTypeMapping,
} from './transports.js'

// Export cascade context for agent coordination
export {
  // Functions
  createCascadeContext,
  validateContext,
  enrichContext,
  serializeContext,
  deserializeContext,
  mergeContexts,
  diffContexts,
  createContextVersion,
  // Schemas
  AgentCascadeContextSchema,
  AgentTierSchema,
  ContextVersionSchema,
  AgentRefSchema,
  TaskPrioritySchema,
  TaskInfoSchema,
  ExecutionPhaseSchema,
  ExecutionStateSchema,
  TraceEntrySchema,
} from './cascade-context.js'

export type {
  AgentCascadeContext,
  AgentTier,
  AgentRef,
  ContextVersion,
  ContextEnrichment,
  ValidationResult,
  TaskPriority,
  TaskInfo,
  ExecutionPhase,
  ExecutionState,
  TraceEntry,
  ContextChange,
  ContextDiff,
} from './cascade-context.js'

// Export agent-to-agent communication layer
export {
  // Message Bus
  AgentMessageBus,
  createMessageBus,
  // Core Functions
  sendToAgent,
  broadcastToGroup,
  requestFromAgent,
  onMessage,
  acknowledge,
  // Coordination Patterns
  requestResponse,
  fanOut,
  fanIn,
  pipeline,
  // Handoff Protocol
  initiateHandoff,
  acceptHandoff,
  rejectHandoff,
  completeHandoff,
} from './agent-comms.js'

export type {
  // Message Types
  AgentMessage,
  MessageEnvelope,
  MessageAck,
  MessageType,
  MessagePriority,
  DeliveryStatus,
  // Handoff Types
  HandoffRequest,
  HandoffResult,
  HandoffStatus,
  // Coordination Types
  CoordinationPattern,
  // Handler Types
  MessageHandler,
  SubscribeOptions,
  // Options Types
  MessageBusOptions,
  SendOptions,
  RequestOptions,
  OnMessageOptions,
  RequestResponseOptions,
  FanOutOptions,
  FanOutResult,
  FanInOptions,
  PipelineOptions,
  InitiateHandoffOptions,
  RejectHandoffOptions,
  CompleteHandoffOptions,
} from './agent-comms.js'

// Export load balancing and routing for agent coordination
export {
  // Balancer Factories
  createRoundRobinBalancer,
  createLeastBusyBalancer,
  createCapabilityRouter,
  createPriorityQueueBalancer,
  createAgentAvailabilityTracker,
  createCompositeBalancer,
  createRoutingRuleEngine,
  // Metrics
  collectRoutingMetrics,
  resetRoutingMetrics,
} from './load-balancing.js'

export type {
  // Core Types
  LoadBalancer,
  BalancerStrategy,
  AgentInfo,
  TaskRequest,
  RouteResult,
  // Availability Types
  AgentAvailability,
  // Rule Types
  RoutingRule,
  RoutingRuleCondition,
  // Metrics Types
  RoutingMetrics,
  // Composite Types
  CompositeBalancerConfig,
} from './load-balancing.js'

// Export Slack transport adapter
export {
  SlackTransport,
  createSlackTransport,
  registerSlackTransport,
  // Block Kit helpers
  slackSection,
  slackHeader,
  slackDivider,
  slackContext,
  slackButton,
  slackActions,
} from './transports/slack.js'

export type {
  SlackTransportConfig,
  SlackBlockType,
  SlackTextObject,
  SlackButtonElement,
  SlackConfirmDialog,
  SlackSectionBlock,
  SlackDividerBlock,
  SlackHeaderBlock,
  SlackContextBlock,
  SlackActionsBlock,
  SlackBlock,
  SlackMessage,
  SlackApiResponse,
  SlackPostMessageResponse,
  SlackUserInfoResponse,
  SlackConversationInfoResponse,
  SlackInteractionPayload,
  SlackActionPayload,
  SlackWebhookRequest,
  WebhookHandlerResult,
} from './transports/slack.js'

// Export Email transport adapter
export {
  EmailTransport,
  createEmailTransport,
  createEmailTransportWithProvider,
  createResendProvider,
  // Template generators
  generateNotificationEmail,
  generateApprovalEmail,
  // Reply parsing
  parseApprovalReply,
  // Type guards
  isEmailTransportConfig,
  isApproved,
  isRejected,
} from './transports/email.js'

export type {
  // Provider types
  EmailProvider,
  EmailMessage,
  EmailSendResult,
  EmailAttachment,
  EmailTag,
  // Configuration types
  EmailTransportConfig,
  EmailTemplateOptions,
  // Approval types
  ApprovalRequestData,
  ParsedEmailReply,
  InboundEmail,
} from './transports/email.js'

// Export error escalation for multi-level error handling
export {
  // Error Classification
  getErrorSeverity,
  getErrorCategory,
  createClassifiedError,
  classifyError,
  isEscalatable,
  preserveContext,
  buildErrorChain,
  // Escalation Routing
  createEscalationPolicy,
  getNextEscalationTier,
  determineEscalationPath,
  shouldEscalate,
  detectCircularEscalation,
  validateEscalationPath,
  // Recovery Patterns
  calculateBackoff,
  createRetryState,
  shouldRetry,
  selectFallbackAgent,
  getDegradationLevel,
  createRecoveryState,
  updateRecoveryState,
  isRecoverable,
  // Escalation Engine
  createEscalationEngine,
} from './error-escalation.js'

export type {
  // Error Classification Types
  ErrorSeverity,
  ErrorCategory,
  ClassifiedError,
  ErrorContext,
  ErrorChain,
  SeverityOptions,
  ErrorChainOptions,
  // Escalation Routing Types
  EscalationPath,
  EscalationPolicy,
  EscalationPolicyOptions,
  EscalationRule,
  EscalationThreshold,
  EscalationResult,
  EscalationValidationResult as ErrorEscalationValidationResult,
  TierPolicyConfig,
  ErrorHistoryEntry,
  // Recovery Pattern Types
  RetryConfig,
  RetryState,
  FallbackConfig,
  AgentForFallback,
  DegradationLevel,
  DegradationOptions,
  RecoveryState,
  RecoveryStateOptions,
  RecoveryStateUpdate,
  // Engine Types
  EscalationEngine,
  EscalationEngineOptions,
  HandleErrorOptions,
  EscalationMetrics,
} from './error-escalation.js'

// Export runtime integration for human request processing
export {
  // Classes
  HumanRequestProcessor,
  InMemoryRequestStore,
  // Factory functions
  createHumanRequestProcessor,
} from './runtime.js'

export type {
  // Request types
  HumanRequest,
  HumanRequestStore,
  RequestStatus,
  RequestType,
  RequestResult,
  CreateRequestData,
  UpdateRequestData,
  // Processor types
  ProcessorConfig,
  TransportAdapters,
  SubmitResult,
  SubmitRequestData,
  WebhookPayload,
  WebhookResult,
  CompleteCallbackData,
  TimeoutCallbackData,
  CancelResult,
} from './runtime.js'

// Export logger interface for error logging
export type { Logger } from './logger.js'
export { noopLogger, createConsoleLogger } from './logger.js'

// Export ID generation utilities
export { generateRequestId } from './utils/id.js'
