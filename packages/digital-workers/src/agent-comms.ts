/**
 * Agent-to-Agent Communication Layer
 *
 * Provides structured messaging, coordination patterns, and handoff protocols
 * for communication between agents in the digital-workers system.
 *
 * @packageDocumentation
 */

import type { Worker, WorkerRef } from './types.js'

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Message type for agent-to-agent communication
 */
export type MessageType = 'request' | 'response' | 'notification' | 'handoff' | 'ack' | 'error'

/**
 * Message priority levels
 */
export type MessagePriority = 'low' | 'normal' | 'high' | 'urgent'

/**
 * Agent message for inter-agent communication
 */
export interface AgentMessage<T = unknown> {
  /** Unique message identifier */
  id: string
  /** Message type */
  type: MessageType
  /** Sender agent ID */
  sender: string
  /** Recipient agent ID */
  recipient: string
  /** Message payload */
  payload: T
  /** Message timestamp */
  timestamp: Date
  /** Correlation ID for request/response pairing */
  correlationId?: string
  /** Reply-to agent ID */
  replyTo?: string
  /** Time-to-live in milliseconds */
  ttl?: number
  /** Message priority */
  priority?: MessagePriority
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Message delivery status
 */
export type DeliveryStatus = 'pending' | 'delivered' | 'acknowledged' | 'failed' | 'expired'

/**
 * Message envelope with delivery metadata
 */
export interface MessageEnvelope<T = unknown> {
  /** The wrapped message */
  message: AgentMessage<T>
  /** Number of delivery attempts */
  deliveryAttempts: number
  /** Timestamp of first delivery attempt */
  firstAttemptAt: Date
  /** Timestamp of last delivery attempt */
  lastAttemptAt: Date
  /** Current delivery status */
  status: DeliveryStatus
  /** Error message if failed */
  error?: string
}

/**
 * Message acknowledgment
 */
export interface MessageAck {
  /** ID of acknowledged message */
  messageId: string
  /** Acknowledgment status */
  status: 'received' | 'processed' | 'failed'
  /** Acknowledgment timestamp */
  timestamp: Date
  /** Acknowledging agent ID */
  agentId: string
  /** Processing result (for 'processed' status) */
  result?: unknown
  /** Error details (for 'failed' status) */
  error?: string
}

/**
 * Handoff request for transferring work between agents
 */
export interface HandoffRequest {
  /** Unique handoff identifier */
  id: string
  /** Source agent ID */
  fromAgent: string
  /** Target agent ID */
  toAgent: string
  /** Context to transfer */
  context: Record<string, unknown>
  /** Reason for handoff */
  reason?: string
  /** Handoff priority */
  priority?: MessagePriority
  /** Request timestamp */
  timestamp: Date
  /** Timeout in milliseconds */
  timeout?: number
  /** Previous handoff attempt ID (for retries) */
  previousAttempt?: string
  /** Callback on timeout */
  onTimeout?: (msg: AgentMessage) => void
}

/**
 * Handoff status
 */
export type HandoffStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'expired' | 'failed'

/**
 * Handoff result
 */
export interface HandoffResult {
  /** Handoff ID */
  handoffId: string
  /** Current status */
  status: HandoffStatus
  /** Result data (for completed handoffs) */
  result?: unknown
  /** Rejection reason */
  reason?: string
  /** Completed timestamp */
  completedAt?: Date
}

/**
 * Coordination pattern types
 */
export type CoordinationPattern =
  | 'request-response'
  | 'fan-out'
  | 'fan-in'
  | 'pipeline'
  | 'publish-subscribe'

// =============================================================================
// Message Handler Types
// =============================================================================

/**
 * Message handler function type
 */
export type MessageHandler<T = unknown> = (message: AgentMessage<T>) => void | Promise<void>

/**
 * Subscription options
 */
export interface SubscribeOptions {
  /** Filter by message types */
  types?: MessageType[]
  /** Filter by sender */
  from?: string
}

// =============================================================================
// AgentMessageBus Configuration
// =============================================================================

/**
 * Message bus configuration options
 */
export interface MessageBusOptions {
  /** Enable message persistence */
  persistence?: boolean
  /** Default message TTL in milliseconds */
  defaultTtl?: number
  /** Maximum queue size per agent */
  maxQueueSize?: number
}

// =============================================================================
// Internal Types
// =============================================================================

interface Subscription {
  handler: MessageHandler
  options?: SubscribeOptions
}

interface HandoffState {
  request: HandoffRequest
  status: HandoffStatus
  previousAttempts: string[]
  timeoutId?: ReturnType<typeof setTimeout>
  /** The original handoff message for tracking */
  originalMessage?: AgentMessage
}

interface StoredMessage {
  envelope: MessageEnvelope
  storedAt: Date
}

// =============================================================================
// AgentMessageBus Implementation
// =============================================================================

/**
 * Agent message bus for routing messages between agents
 */
export class AgentMessageBus {
  private subscriptions = new Map<string, Subscription[]>()
  private pendingAcks = new Map<string, Set<string>>()
  private messageStatus = new Map<string, DeliveryStatus>()
  private handoffs = new Map<string, HandoffState>()
  private storedMessages: StoredMessage[] = []
  private messageQueue = new Map<string, AgentMessage[]>()
  private processingAgent = new Set<string>()
  private disposed = false
  private options: Required<MessageBusOptions>

  constructor(options: MessageBusOptions = {}) {
    this.options = {
      persistence: options.persistence ?? false,
      defaultTtl: options.defaultTtl ?? 30000,
      maxQueueSize: options.maxQueueSize ?? 1000,
    }
  }

  /**
   * Send a message to an agent
   */
  async send<T>(message: AgentMessage<T>): Promise<MessageEnvelope<T>> {
    if (this.disposed) {
      return this.createFailedEnvelope(message, 'Message bus disposed')
    }

    const envelope: MessageEnvelope<T> = {
      message,
      deliveryAttempts: 1,
      firstAttemptAt: new Date(),
      lastAttemptAt: new Date(),
      status: 'pending',
    }

    // Store message if persistence is enabled
    if (this.options.persistence) {
      this.storedMessages.push({ envelope: envelope as MessageEnvelope, storedAt: new Date() })
    }

    // Get subscriptions for recipient
    const subs = this.subscriptions.get(message.recipient)
    if (!subs || subs.length === 0) {
      envelope.status = 'failed'
      envelope.error = `Agent '${message.recipient}' not found`
      this.messageStatus.set(message.id, 'failed')
      return envelope
    }

    // Track pending acknowledgment
    if (message.type === 'request') {
      const senderAcks = this.pendingAcks.get(message.sender) ?? new Set()
      senderAcks.add(message.id)
      this.pendingAcks.set(message.sender, senderAcks)
    }

    // Setup TTL expiration
    if (message.ttl) {
      setTimeout(() => {
        if (this.messageStatus.get(message.id) !== 'acknowledged') {
          this.messageStatus.set(message.id, 'expired')
        }
      }, message.ttl)
    }

    // Deliver to matching subscribers
    try {
      await this.deliverMessage(message, subs)
      envelope.status = 'delivered'
      this.messageStatus.set(message.id, 'delivered')
    } catch (error) {
      envelope.status = 'failed'
      envelope.error = error instanceof Error ? error.message : String(error)
      this.messageStatus.set(message.id, 'failed')
    }

    return envelope
  }

  /**
   * Deliver message to subscribers with queue handling
   */
  private async deliverMessage<T>(message: AgentMessage<T>, subs: Subscription[]): Promise<void> {
    const matchingSubs = subs.filter((sub) => this.matchesFilter(message, sub.options))

    if (matchingSubs.length === 0) {
      return
    }

    // Queue messages if agent is busy
    if (this.processingAgent.has(message.recipient)) {
      const queue = this.messageQueue.get(message.recipient) ?? []
      queue.push(message as AgentMessage)
      this.messageQueue.set(message.recipient, queue)
      return
    }

    this.processingAgent.add(message.recipient)

    try {
      await Promise.all(matchingSubs.map((sub) => sub.handler(message as AgentMessage)))
    } finally {
      this.processingAgent.delete(message.recipient)
      await this.processQueue(message.recipient, subs)
    }
  }

  /**
   * Process queued messages
   */
  private async processQueue(agentId: string, subs: Subscription[]): Promise<void> {
    const queue = this.messageQueue.get(agentId)
    if (!queue || queue.length === 0) return

    const nextMessage = queue.shift()!
    this.messageQueue.set(agentId, queue)

    await this.deliverMessage(nextMessage, subs)
  }

  /**
   * Check if message matches subscription filter
   */
  private matchesFilter(message: AgentMessage, options?: SubscribeOptions): boolean {
    if (!options) return true
    if (options.types && !options.types.includes(message.type)) return false
    if (options.from && message.sender !== options.from) return false
    return true
  }

  /**
   * Subscribe to messages for an agent
   */
  subscribe(agentId: string, handler: MessageHandler, options?: SubscribeOptions): () => void {
    const subs = this.subscriptions.get(agentId) ?? []
    const subscription: Subscription = { handler, ...(options !== undefined && { options }) }
    subs.push(subscription)
    this.subscriptions.set(agentId, subs)

    return () => {
      const currentSubs = this.subscriptions.get(agentId) ?? []
      const index = currentSubs.indexOf(subscription)
      if (index !== -1) {
        currentSubs.splice(index, 1)
        this.subscriptions.set(agentId, currentSubs)
      }
    }
  }

  /**
   * Acknowledge a message
   */
  async acknowledge(
    messageId: string,
    agentId: string,
    status: 'received' | 'processed' | 'failed'
  ): Promise<void> {
    this.messageStatus.set(messageId, 'acknowledged')

    // Remove from pending acks
    for (const entry of Array.from(this.pendingAcks.entries())) {
      const [sender, acks] = entry
      if (acks.has(messageId)) {
        acks.delete(messageId)
        this.pendingAcks.set(sender, acks)
        break
      }
    }
  }

  /**
   * Get pending acknowledgments for a sender
   */
  getPendingAcks(senderId: string): string[] {
    const acks = this.pendingAcks.get(senderId)
    return acks ? Array.from(acks) : []
  }

  /**
   * Get message delivery status
   */
  getMessageStatus(messageId: string): DeliveryStatus | undefined {
    return this.messageStatus.get(messageId)
  }

  /**
   * Get handoff status
   */
  getHandoffStatus(handoffId: string): HandoffStatus | undefined {
    return this.handoffs.get(handoffId)?.status
  }

  /**
   * Get handoff history (previous attempts)
   */
  getHandoffHistory(handoffId: string): string[] {
    return this.handoffs.get(handoffId)?.previousAttempts ?? []
  }

  /**
   * Register a handoff
   */
  registerHandoff(request: HandoffRequest, originalMessage?: AgentMessage): void {
    const state: HandoffState = {
      request,
      status: 'pending',
      previousAttempts: request.previousAttempt ? [request.previousAttempt] : [],
      ...(originalMessage !== undefined && { originalMessage }),
    }

    // Setup timeout if specified
    if (request.timeout) {
      state.timeoutId = setTimeout(() => {
        const currentState = this.handoffs.get(request.id)
        if (currentState && currentState.status === 'pending') {
          currentState.status = 'expired'
          this.handoffs.set(request.id, currentState)

          // Notify initiator of timeout
          if (request.onTimeout) {
            const timeoutMsg: AgentMessage = {
              id: `timeout_${request.id}`,
              type: 'handoff',
              sender: 'system',
              recipient: request.fromAgent,
              payload: { action: 'timeout', handoffId: request.id },
              timestamp: new Date(),
            }
            request.onTimeout(timeoutMsg)
          }
        }
      }, request.timeout)
    }

    this.handoffs.set(request.id, state)
  }

  /**
   * Get handoff request info
   */
  getHandoffRequest(handoffId: string): HandoffRequest | undefined {
    return this.handoffs.get(handoffId)?.request
  }

  /**
   * Update handoff status
   */
  updateHandoffStatus(handoffId: string, status: HandoffStatus): void {
    const state = this.handoffs.get(handoffId)
    if (state) {
      // Clear timeout if pending timeout exists
      if (state.timeoutId) {
        clearTimeout(state.timeoutId)
      }
      state.status = status
      this.handoffs.set(handoffId, state)
    }
  }

  /**
   * Get stored messages (for persistence)
   */
  getStoredMessages(): MessageEnvelope[] {
    return this.storedMessages.map((s) => s.envelope)
  }

  /**
   * Get message history for an agent
   */
  getMessageHistory(
    agentId: string,
    options?: { limit?: number; from?: Date; to?: Date }
  ): MessageEnvelope[] {
    let messages = this.storedMessages
      .filter(
        (s) => s.envelope.message.recipient === agentId || s.envelope.message.sender === agentId
      )
      .map((s) => s.envelope)

    if (options?.from) {
      messages = messages.filter((m) => m.message.timestamp >= options.from!)
    }

    if (options?.to) {
      messages = messages.filter((m) => m.message.timestamp <= options.to!)
    }

    if (options?.limit) {
      messages = messages.slice(-options.limit)
    }

    return messages
  }

  /**
   * Clear old messages
   */
  clearMessages(options?: { olderThan?: Date }): void {
    if (options?.olderThan) {
      this.storedMessages = this.storedMessages.filter((s) => s.storedAt >= options.olderThan!)
    } else {
      this.storedMessages = []
    }
  }

  /**
   * Dispose the message bus
   */
  dispose(): void {
    this.disposed = true
    this.subscriptions.clear()
    this.pendingAcks.clear()
    this.messageStatus.clear()
    this.messageQueue.clear()
    this.processingAgent.clear()

    // Clear all handoff timeouts
    for (const state of Array.from(this.handoffs.values())) {
      if (state.timeoutId) {
        clearTimeout(state.timeoutId)
      }
    }
    this.handoffs.clear()
  }

  /**
   * Create a failed envelope
   */
  private createFailedEnvelope<T>(message: AgentMessage<T>, error: string): MessageEnvelope<T> {
    return {
      message,
      deliveryAttempts: 0,
      firstAttemptAt: new Date(),
      lastAttemptAt: new Date(),
      status: 'failed',
      error,
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new message bus instance
 */
export function createMessageBus(options?: MessageBusOptions): AgentMessageBus {
  return new AgentMessageBus(options)
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Generate a unique handoff ID
 */
function generateHandoffId(): string {
  return `handoff_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Generate a unique correlation ID
 */
function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * Resolve agent ID from Worker, WorkerRef, or string
 */
function resolveAgentId(agent: Worker | WorkerRef | string): string {
  if (typeof agent === 'string') return agent
  return agent.id
}

// =============================================================================
// Core Communication Functions
// =============================================================================

/**
 * Message send options
 */
export interface SendOptions {
  /** Message priority */
  priority?: MessagePriority
  /** Time-to-live in milliseconds */
  ttl?: number
  /** Correlation ID for request/response pairing */
  correlationId?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Send a message to a specific agent
 */
export async function sendToAgent<T>(
  bus: AgentMessageBus,
  sender: Worker | WorkerRef | string,
  recipient: Worker | WorkerRef | string,
  payload: T,
  options?: SendOptions
): Promise<MessageEnvelope<T>> {
  const message: AgentMessage<T> = {
    id: generateMessageId(),
    type: 'notification',
    sender: resolveAgentId(sender),
    recipient: resolveAgentId(recipient),
    payload,
    timestamp: new Date(),
    ...(options?.priority !== undefined && { priority: options.priority }),
    ...(options?.ttl !== undefined && { ttl: options.ttl }),
    ...(options?.correlationId !== undefined && { correlationId: options.correlationId }),
    ...(options?.metadata !== undefined && { metadata: options.metadata }),
  }

  return bus.send(message)
}

/**
 * Broadcast a message to multiple agents
 */
export async function broadcastToGroup<T>(
  bus: AgentMessageBus,
  sender: Worker | WorkerRef | string,
  recipients: (Worker | WorkerRef | string)[],
  payload: T,
  options?: SendOptions
): Promise<MessageEnvelope<T>[]> {
  const correlationId = options?.correlationId ?? generateCorrelationId()

  const results = await Promise.all(
    recipients.map((recipient) =>
      sendToAgent(bus, sender, recipient, payload, {
        ...options,
        correlationId,
      })
    )
  )

  return results
}

/**
 * Request options
 */
export interface RequestOptions extends SendOptions {
  /** Request timeout in milliseconds */
  timeout?: number
}

/**
 * Send a request to an agent and await response
 */
export async function requestFromAgent<TReq, TRes>(
  bus: AgentMessageBus,
  sender: Worker | WorkerRef | string,
  recipient: Worker | WorkerRef | string,
  payload: TReq,
  options?: RequestOptions
): Promise<AgentMessage<TRes>> {
  const senderId = resolveAgentId(sender)
  const recipientId = resolveAgentId(recipient)
  const messageId = generateMessageId()
  const timeout = options?.timeout ?? 30000

  return new Promise<AgentMessage<TRes>>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout>
    let unsubscribe: (() => void) | undefined

    // Setup response handler
    unsubscribe = bus.subscribe(senderId, (response) => {
      if (response.correlationId === messageId) {
        clearTimeout(timeoutId)
        unsubscribe?.()

        if (response.type === 'error') {
          const errorPayload = response.payload as { error?: string }
          reject(new Error(errorPayload.error ?? 'Request failed'))
        } else {
          resolve(response as AgentMessage<TRes>)
        }
      }
    })

    // Setup timeout
    timeoutId = setTimeout(() => {
      unsubscribe?.()
      reject(new Error('Request timeout'))
    }, timeout)

    // Send request
    const message: AgentMessage<TReq> = {
      id: messageId,
      type: 'request',
      sender: senderId,
      recipient: recipientId,
      payload,
      timestamp: new Date(),
      correlationId: messageId,
      replyTo: senderId,
      ...(options?.priority !== undefined && { priority: options.priority }),
      ...(options?.ttl !== undefined && { ttl: options.ttl }),
      ...(options?.metadata !== undefined && { metadata: options.metadata }),
    }

    bus
      .send(message)
      .then((envelope) => {
        // Fail fast if delivery failed (recipient not found, etc.)
        if (envelope.status === 'failed') {
          clearTimeout(timeoutId)
          unsubscribe?.()
          reject(new Error(envelope.error ?? 'Message delivery failed'))
        }
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        unsubscribe?.()
        reject(error)
      })
  })
}

/**
 * On-message handler options
 */
export interface OnMessageOptions {
  /** Filter by sender */
  from?: string
  /** Filter by message types */
  types?: MessageType[]
}

/**
 * Register a message handler for an agent
 */
export function onMessage<T = unknown>(
  bus: AgentMessageBus,
  agentId: string,
  handler: MessageHandler<T>,
  options?: OnMessageOptions
): () => void {
  return bus.subscribe(agentId, handler as MessageHandler, {
    ...(options?.from !== undefined && { from: options.from }),
    ...(options?.types !== undefined && { types: options.types }),
  })
}

/**
 * Send an acknowledgment for a received message
 */
export async function acknowledge(
  bus: AgentMessageBus,
  message: AgentMessage,
  status: 'received' | 'processed',
  result?: unknown
): Promise<void> {
  // Send ack message to original sender
  const ackMessage: AgentMessage = {
    id: generateMessageId(),
    type: 'ack',
    sender: message.recipient,
    recipient: message.sender,
    payload: {
      messageId: message.id,
      status,
      timestamp: new Date(),
      agentId: message.recipient,
      result,
    },
    timestamp: new Date(),
    correlationId: message.id,
  }

  await bus.send(ackMessage)
  await bus.acknowledge(message.id, message.recipient, status)
}

// =============================================================================
// Coordination Patterns
// =============================================================================

/**
 * Request-response pattern options
 */
export interface RequestResponseOptions<T> {
  /** Requesting agent */
  from: Worker | WorkerRef | string
  /** Target agent */
  to: Worker | WorkerRef | string
  /** Request payload */
  payload: T
  /** Timeout in milliseconds */
  timeout?: number
  /** Message priority */
  priority?: MessagePriority
}

/**
 * Execute request-response pattern
 */
export async function requestResponse<TReq, TRes>(
  bus: AgentMessageBus,
  options: RequestResponseOptions<TReq>
): Promise<AgentMessage<TRes>> {
  return requestFromAgent<TReq, TRes>(bus, options.from, options.to, options.payload, {
    ...(options.timeout !== undefined && { timeout: options.timeout }),
    ...(options.priority !== undefined && { priority: options.priority }),
  })
}

/**
 * Fan-out pattern options
 */
export interface FanOutOptions<T> {
  /** Coordinating agent */
  from: Worker | WorkerRef | string
  /** Target agents */
  to: (Worker | WorkerRef | string)[]
  /** Payload to distribute */
  payload: T
  /** Timeout per agent */
  timeout?: number
  /** Continue even if some agents fail */
  continueOnError?: boolean
}

/**
 * Fan-out response result
 */
export interface FanOutResult<T> {
  /** Target agent ID */
  agentId: string
  /** Whether the request succeeded */
  success: boolean
  /** Response payload if successful */
  payload?: T
  /** Error if failed */
  error?: string
}

/**
 * Execute fan-out pattern - distribute work to multiple agents
 */
export async function fanOut<TReq, TRes>(
  bus: AgentMessageBus,
  options: FanOutOptions<TReq>
): Promise<FanOutResult<TRes>[]> {
  const correlationId = generateCorrelationId()
  const timeout = options.timeout ?? 30000
  const fromId = resolveAgentId(options.from)

  const results = await Promise.all(
    options.to.map(async (agent): Promise<FanOutResult<TRes>> => {
      const agentId = resolveAgentId(agent)

      try {
        const response = await requestFromAgent<TReq, TRes>(bus, fromId, agentId, options.payload, {
          timeout,
          correlationId,
        })

        return {
          agentId,
          success: true,
          payload: response.payload,
        }
      } catch (error) {
        if (!options.continueOnError) {
          throw error
        }

        return {
          agentId,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    })
  )

  return results
}

/**
 * Fan-in pattern options
 */
export interface FanInOptions<T> {
  /** Collecting agent */
  collector: Worker | WorkerRef | string
  /** Source agents to collect from */
  sources: (Worker | WorkerRef | string)[]
  /** Timeout for all sources */
  timeout?: number
  /** Handler to get data from each source */
  onSourceMessage: (sourceId: string) => Promise<T>
}

/**
 * Execute fan-in pattern - collect responses from multiple agents
 */
export async function fanIn<T>(bus: AgentMessageBus, options: FanInOptions<T>): Promise<T[]> {
  const results = await Promise.all(
    options.sources.map((source) => {
      const sourceId = resolveAgentId(source)
      return options.onSourceMessage(sourceId)
    })
  )

  return results
}

/**
 * Pipeline pattern options
 */
export interface PipelineOptions<T> {
  /** Orchestrating agent */
  initiator: Worker | WorkerRef | string
  /** Ordered list of pipeline stages (agent IDs) */
  stages: (Worker | WorkerRef | string)[]
  /** Initial input */
  input: T
  /** Timeout per stage */
  stageTimeout?: number
}

/**
 * Execute pipeline pattern - chain agents in sequence
 */
export async function pipeline<T>(
  bus: AgentMessageBus,
  options: PipelineOptions<T>
): Promise<AgentMessage<T>> {
  const initiatorId = resolveAgentId(options.initiator)
  let currentPayload = options.input
  let lastResponse: AgentMessage<T> | undefined

  for (const stage of options.stages) {
    const stageId = resolveAgentId(stage)

    lastResponse = await requestFromAgent<T, T>(bus, initiatorId, stageId, currentPayload, {
      ...(options.stageTimeout !== undefined && { timeout: options.stageTimeout }),
    })

    currentPayload = lastResponse.payload
  }

  return lastResponse!
}

// =============================================================================
// Handoff Protocol
// =============================================================================

/**
 * Initiate handoff options
 */
export interface InitiateHandoffOptions {
  /** Source agent */
  fromAgent: Worker | WorkerRef | string
  /** Target agent */
  toAgent: Worker | WorkerRef | string
  /** Context to transfer */
  context: Record<string, unknown>
  /** Reason for handoff */
  reason?: string
  /** Timeout in milliseconds */
  timeout?: number
  /** Previous handoff attempt ID */
  previousAttempt?: string
  /** Callback on timeout */
  onTimeout?: (msg: AgentMessage) => void
}

/**
 * Initiate a handoff to another agent
 */
export async function initiateHandoff(
  bus: AgentMessageBus,
  options: InitiateHandoffOptions
): Promise<{ handoffId: string; status: HandoffStatus }> {
  const handoffId = generateHandoffId()
  const fromAgentId = resolveAgentId(options.fromAgent)
  const toAgentId = resolveAgentId(options.toAgent)

  const request: HandoffRequest = {
    id: handoffId,
    fromAgent: fromAgentId,
    toAgent: toAgentId,
    context: options.context,
    timestamp: new Date(),
    ...(options.reason !== undefined && { reason: options.reason }),
    ...(options.timeout !== undefined && { timeout: options.timeout }),
    ...(options.previousAttempt !== undefined && { previousAttempt: options.previousAttempt }),
    ...(options.onTimeout !== undefined && { onTimeout: options.onTimeout }),
  }

  // Register handoff in bus
  bus.registerHandoff(request)

  // Send handoff request message
  const message: AgentMessage = {
    id: generateMessageId(),
    type: 'handoff',
    sender: fromAgentId,
    recipient: toAgentId,
    payload: {
      action: 'request',
      handoffId,
      context: options.context,
      reason: options.reason,
    },
    timestamp: new Date(),
    correlationId: handoffId,
  }

  await bus.send(message)

  return { handoffId, status: 'pending' }
}

/**
 * Accept a pending handoff
 */
export async function acceptHandoff(
  bus: AgentMessageBus,
  handoffId: string,
  agentId: string
): Promise<HandoffResult> {
  const status = bus.getHandoffStatus(handoffId)

  if (!status) {
    throw new Error('Handoff not found')
  }

  if (status !== 'pending') {
    throw new Error(`Cannot accept handoff in '${status}' state`)
  }

  bus.updateHandoffStatus(handoffId, 'accepted')

  // Get the handoff request to find the initiating agent
  const request = bus.getHandoffRequest(handoffId)

  if (request) {
    const acceptMessage: AgentMessage = {
      id: generateMessageId(),
      type: 'handoff',
      sender: agentId,
      recipient: request.fromAgent,
      payload: {
        action: 'accepted',
        handoffId,
      },
      timestamp: new Date(),
      correlationId: handoffId,
    }

    await bus.send(acceptMessage)
  }

  return { handoffId, status: 'accepted' }
}

/**
 * Reject handoff options
 */
export interface RejectHandoffOptions {
  /** Reason for rejection */
  reason?: string
}

/**
 * Reject a pending handoff
 */
export async function rejectHandoff(
  bus: AgentMessageBus,
  handoffId: string,
  agentId: string,
  options?: RejectHandoffOptions
): Promise<HandoffResult> {
  const status = bus.getHandoffStatus(handoffId)

  if (!status) {
    throw new Error('Handoff not found')
  }

  bus.updateHandoffStatus(handoffId, 'rejected')

  // Get the handoff request to find the initiating agent
  const request = bus.getHandoffRequest(handoffId)

  if (request) {
    const rejectMessage: AgentMessage = {
      id: generateMessageId(),
      type: 'handoff',
      sender: agentId,
      recipient: request.fromAgent,
      payload: {
        action: 'rejected',
        handoffId,
        ...(options?.reason !== undefined && { reason: options.reason }),
      },
      timestamp: new Date(),
      correlationId: handoffId,
    }

    await bus.send(rejectMessage)
  }

  return {
    handoffId,
    status: 'rejected',
    ...(options?.reason !== undefined && { reason: options.reason }),
  }
}

/**
 * Complete handoff options
 */
export interface CompleteHandoffOptions {
  /** Result of the handoff work */
  result?: unknown
}

/**
 * Complete a handoff (mark work as done)
 */
export async function completeHandoff(
  bus: AgentMessageBus,
  handoffId: string,
  agentId: string,
  options?: CompleteHandoffOptions
): Promise<HandoffResult> {
  const status = bus.getHandoffStatus(handoffId)

  if (!status) {
    throw new Error('Handoff not found')
  }

  if (status !== 'accepted') {
    throw new Error('Handoff not accepted')
  }

  bus.updateHandoffStatus(handoffId, 'completed')

  // Get the handoff request to find the initiating agent
  const request = bus.getHandoffRequest(handoffId)

  if (request) {
    const completeMessage: AgentMessage = {
      id: generateMessageId(),
      type: 'handoff',
      sender: agentId,
      recipient: request.fromAgent,
      payload: {
        action: 'completed',
        handoffId,
        result: options?.result,
      },
      timestamp: new Date(),
      correlationId: handoffId,
    }

    await bus.send(completeMessage)
  }

  return {
    handoffId,
    status: 'completed',
    result: options?.result,
    completedAt: new Date(),
  }
}
