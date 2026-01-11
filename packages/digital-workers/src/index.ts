/**
 * digital-workers - Abstract interface for organizing digital work
 *
 * This package provides the foundational abstraction for structuring work
 * independent of whether AI agents or humans perform individual tasks. It
 * defines a unified Worker interface that enables workflows to be designed
 * once and executed by any combination of AI and human workers.
 *
 * Package relationships:
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
 *     await worker$.notify(finance, `New expense: ${expense.amount}`)
 *
 *     const approval = await worker$.approve(
 *       `Expense: $${expense.amount}`,
 *       manager,
 *       { via: 'slack' }
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
export { approve } from './approve.js'
export { ask } from './ask.js'
export { do } from './do.js'
export { decide } from './decide.js'
export { generate } from './generate.js'
export { is } from './is.js'
export { notify } from './notify.js'
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
