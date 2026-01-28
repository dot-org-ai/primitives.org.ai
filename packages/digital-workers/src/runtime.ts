/**
 * Runtime Integration for Human Request Processing
 *
 * Connects transport adapters (Slack, Email, etc.) to a request store and
 * provides orchestration for approval workflows, questions, and notifications.
 *
 * The HumanRequestProcessor is the central coordinator that:
 * - Sends requests via configured transports
 * - Tracks request state in a store
 * - Handles webhook callbacks from transports
 * - Notifies when requests complete or timeout
 *
 * @packageDocumentation
 */

import type { Transport, DeliveryResult } from './transports.js'
import type { WorkerRef } from './types.js'
import type { SlackTransport } from './transports/slack.js'
import type { EmailTransport } from './transports/email.js'

// =============================================================================
// Request Types
// =============================================================================

/**
 * Status of a human request
 */
export type RequestStatus = 'pending' | 'completed' | 'expired' | 'cancelled' | 'failed'

/**
 * Type of human request
 */
export type RequestType = 'approval' | 'question' | 'notification'

/**
 * Result of a completed request
 */
export interface RequestResult {
  /** Whether the request was approved (for approval type) */
  approved?: boolean
  /** Answer to a question (for question type) */
  answer?: unknown
  /** Who responded to the request */
  respondedBy?: WorkerRef
  /** When the response was received */
  respondedAt?: Date
  /** Additional notes from the responder */
  notes?: string
  /** The channel used for the response */
  via?: Transport
}

/**
 * A human request tracked by the runtime
 */
export interface HumanRequest {
  /** Unique request identifier */
  id: string
  /** Type of request */
  type: RequestType
  /** Target for the request (channel, email, etc.) */
  target: string
  /** Request content/message */
  content: string
  /** Current status */
  status: RequestStatus
  /** Transport used to send the request */
  transport: Transport
  /** External message ID from the transport */
  externalId?: string
  /** Who initiated the request */
  requestedBy?: WorkerRef
  /** Additional context for the request */
  context?: Record<string, unknown>
  /** Channel to notify requestor of result */
  notifyChannel?: string
  /** When the request was created */
  createdAt: Date
  /** When the request was completed */
  completedAt?: Date
  /** When the request expires */
  expiresAt?: Date
  /** Result of the request (when completed) */
  result?: RequestResult
}

/**
 * Data for creating a new request
 */
export interface CreateRequestData {
  type: RequestType
  target: string
  content: string
  transport: Transport
  requestedBy?: WorkerRef
  context?: Record<string, unknown>
  notifyChannel?: string
  expiresAt?: Date
}

/**
 * Data for updating a request
 */
export interface UpdateRequestData {
  status?: RequestStatus
  externalId?: string
  result?: RequestResult
  completedAt?: Date
}

// =============================================================================
// Request Store Interface
// =============================================================================

/**
 * Store interface for persisting human requests
 */
export interface HumanRequestStore {
  /** Create a new request */
  create(data: CreateRequestData): Promise<HumanRequest>
  /** Get a request by ID */
  get(id: string): Promise<HumanRequest | undefined>
  /** Update a request */
  update(id: string, data: UpdateRequestData): Promise<HumanRequest | undefined>
  /** Find a request by external ID (transport message ID) */
  findByExternalId(externalId: string): Promise<HumanRequest | undefined>
  /** List all pending requests */
  listPending(): Promise<HumanRequest[]>
  /** List expired requests that need processing */
  listExpired(): Promise<HumanRequest[]>
}

// =============================================================================
// In-Memory Request Store
// =============================================================================

/**
 * In-memory implementation of HumanRequestStore
 *
 * Suitable for development and testing. For production, implement
 * a store backed by Durable Objects, KV, or a database.
 */
export class InMemoryRequestStore implements HumanRequestStore {
  private requests = new Map<string, HumanRequest>()
  private externalIdIndex = new Map<string, string>()
  private counter = 0

  private generateId(): string {
    this.counter++
    return `req_${Date.now()}_${this.counter.toString().padStart(4, '0')}`
  }

  async create(data: CreateRequestData): Promise<HumanRequest> {
    const id = this.generateId()
    const request: HumanRequest = {
      id,
      type: data.type,
      target: data.target,
      content: data.content,
      status: 'pending',
      transport: data.transport,
      createdAt: new Date(),
    }

    if (data.requestedBy !== undefined) {
      request.requestedBy = data.requestedBy
    }
    if (data.context !== undefined) {
      request.context = data.context
    }
    if (data.notifyChannel !== undefined) {
      request.notifyChannel = data.notifyChannel
    }
    if (data.expiresAt !== undefined) {
      request.expiresAt = data.expiresAt
    }

    this.requests.set(id, request)
    return request
  }

  async get(id: string): Promise<HumanRequest | undefined> {
    return this.requests.get(id)
  }

  async update(id: string, data: UpdateRequestData): Promise<HumanRequest | undefined> {
    const request = this.requests.get(id)
    if (!request) {
      return undefined
    }

    if (data.status !== undefined) {
      request.status = data.status
    }
    if (data.externalId !== undefined) {
      request.externalId = data.externalId
      this.externalIdIndex.set(data.externalId, id)
    }
    if (data.result !== undefined) {
      request.result = data.result
    }
    if (data.completedAt !== undefined) {
      request.completedAt = data.completedAt
    }

    // Auto-set completedAt when status becomes terminal
    if (data.status === 'completed' || data.status === 'expired' || data.status === 'cancelled') {
      if (!request.completedAt) {
        request.completedAt = new Date()
      }
    }

    this.requests.set(id, request)
    return request
  }

  async findByExternalId(externalId: string): Promise<HumanRequest | undefined> {
    const requestId = this.externalIdIndex.get(externalId)
    if (!requestId) {
      return undefined
    }
    return this.requests.get(requestId)
  }

  async listPending(): Promise<HumanRequest[]> {
    const pending: HumanRequest[] = []
    for (const request of this.requests.values()) {
      if (request.status === 'pending') {
        pending.push(request)
      }
    }
    return pending
  }

  async listExpired(): Promise<HumanRequest[]> {
    const now = new Date()
    const expired: HumanRequest[] = []
    for (const request of this.requests.values()) {
      if (request.status === 'pending' && request.expiresAt && request.expiresAt <= now) {
        expired.push(request)
      }
    }
    return expired
  }
}

// =============================================================================
// Processor Types
// =============================================================================

/**
 * Supported transport adapters
 */
export interface TransportAdapters {
  slack?: SlackTransport
  email?: EmailTransport
}

/**
 * Result of submitting a request
 */
export interface SubmitResult {
  success: boolean
  requestId?: string
  externalId?: string
  error?: string
}

/**
 * Data for submitting a new request
 */
export interface SubmitRequestData {
  type: RequestType
  target: string
  content: string
  transport: Transport
  context?: Record<string, unknown>
  requestedBy?: WorkerRef
  notifyChannel?: string
  timeout?: number
}

/**
 * Webhook payload for processing responses
 */
export interface WebhookPayload {
  type: 'approval_response' | 'question_response' | 'email_reply'
  requestId: string
  approved?: boolean
  answer?: unknown
  respondedBy?: WorkerRef
  notes?: string
  from?: string
  content?: string
}

/**
 * Result of processing a webhook
 */
export interface WebhookResult {
  success: boolean
  requestId?: string
  error?: string
}

/**
 * Callback data when a request completes
 */
export interface CompleteCallbackData {
  requestId: string
  request: HumanRequest
  result: RequestResult
}

/**
 * Callback data when a request times out
 */
export interface TimeoutCallbackData {
  requestId: string
  request: HumanRequest
}

/**
 * Result of cancelling a request
 */
export interface CancelResult {
  success: boolean
  error?: string
}

/**
 * Configuration for HumanRequestProcessor
 */
export interface ProcessorConfig {
  /** Request store for persistence */
  store: HumanRequestStore
  /** Transport adapters */
  transports: TransportAdapters
  /** Callback when a request completes */
  onComplete?: (data: CompleteCallbackData) => void | Promise<void>
  /** Callback when a request times out */
  onTimeout?: (data: TimeoutCallbackData) => void | Promise<void>
  /** Whether to notify requestor of results */
  notifyRequestor?: boolean
  /** Interval for checking expired requests (ms) */
  checkIntervalMs?: number
}

// =============================================================================
// Human Request Processor
// =============================================================================

/**
 * Human Request Processor
 *
 * Coordinates between transport adapters and the request store to
 * handle approval workflows, questions, and notifications.
 *
 * @example
 * ```ts
 * const processor = createHumanRequestProcessor({
 *   store: new InMemoryRequestStore(),
 *   transports: {
 *     slack: createSlackTransport({ botToken, signingSecret }),
 *     email: createEmailTransport({ apiKey }),
 *   },
 *   onComplete: (data) => {
 *     console.log(`Request ${data.requestId} completed:`, data.result)
 *   },
 * })
 *
 * // Submit a request
 * const result = await processor.submitRequest({
 *   type: 'approval',
 *   target: '#approvals',
 *   content: 'Approve deployment?',
 *   transport: 'slack',
 * })
 *
 * // Handle webhook when user responds
 * await processor.handleWebhook('slack', {
 *   type: 'approval_response',
 *   requestId: result.requestId,
 *   approved: true,
 * })
 * ```
 */
export class HumanRequestProcessor {
  private store: HumanRequestStore
  private transports: TransportAdapters
  private onCompleteCallback: ((data: CompleteCallbackData) => void | Promise<void>) | null
  private onTimeoutCallback: ((data: TimeoutCallbackData) => void | Promise<void>) | null
  private notifyRequestor: boolean
  private checkIntervalMs: number
  private timeoutChecker: ReturnType<typeof setInterval> | null = null
  private destroyed = false

  constructor(config: ProcessorConfig) {
    this.store = config.store
    this.transports = config.transports
    this.onCompleteCallback = config.onComplete ?? null
    this.onTimeoutCallback = config.onTimeout ?? null
    this.notifyRequestor = config.notifyRequestor ?? false
    this.checkIntervalMs = config.checkIntervalMs ?? 30000

    // Start timeout checker if onTimeout callback is provided
    if (this.onTimeoutCallback) {
      this.startTimeoutChecker()
    }
  }

  /**
   * Submit a new human request via the specified transport
   */
  async submitRequest(data: SubmitRequestData): Promise<SubmitResult> {
    // Validate transport is configured
    const transport = this.getTransport(data.transport)
    if (!transport) {
      return {
        success: false,
        error: `Transport '${data.transport}' not configured`,
      }
    }

    // Calculate expiration time if timeout specified
    let expiresAt: Date | undefined
    if (data.timeout !== undefined) {
      expiresAt = new Date(Date.now() + data.timeout)
    }

    // Create request in store
    const createData: CreateRequestData = {
      type: data.type,
      target: data.target,
      content: data.content,
      transport: data.transport,
    }
    if (data.requestedBy !== undefined) {
      createData.requestedBy = data.requestedBy
    }
    if (data.context !== undefined) {
      createData.context = data.context
    }
    if (data.notifyChannel !== undefined) {
      createData.notifyChannel = data.notifyChannel
    }
    if (expiresAt !== undefined) {
      createData.expiresAt = expiresAt
    }

    const request = await this.store.create(createData)

    // Send via transport
    let deliveryResult: DeliveryResult

    try {
      deliveryResult = await this.sendViaTransport(data.transport, transport, request)
    } catch (error) {
      // Update request status to failed
      await this.store.update(request.id, { status: 'failed' })
      return {
        success: false,
        requestId: request.id,
        error: error instanceof Error ? error.message : String(error),
      }
    }

    if (!deliveryResult.success) {
      // Update request status to failed
      await this.store.update(request.id, { status: 'failed' })
      const errorResult: SubmitResult = {
        success: false,
        requestId: request.id,
      }
      if (deliveryResult.error) {
        errorResult.error = deliveryResult.error
      }
      return errorResult
    }

    // Update request with external ID
    if (deliveryResult.messageId) {
      await this.store.update(request.id, {
        externalId: deliveryResult.messageId,
      })
    }

    const successResult: SubmitResult = {
      success: true,
      requestId: request.id,
    }
    if (deliveryResult.messageId) {
      successResult.externalId = deliveryResult.messageId
    }
    return successResult
  }

  /**
   * Handle a webhook callback from a transport
   */
  async handleWebhook(transport: Transport, payload: WebhookPayload): Promise<WebhookResult> {
    const { requestId } = payload

    // Find the request
    const request = await this.store.get(requestId)
    if (!request) {
      return {
        success: false,
        requestId,
        error: `Request '${requestId}' not found`,
      }
    }

    // Check if already completed
    if (request.status !== 'pending') {
      return {
        success: false,
        requestId,
        error: `Request '${requestId}' already completed with status '${request.status}'`,
      }
    }

    // Build result based on payload type
    let result: RequestResult

    if (payload.type === 'email_reply') {
      // Parse email content for approval/rejection
      const approved = this.parseEmailApproval(payload.content ?? '')
      result = {
        approved,
        via: transport,
        respondedAt: new Date(),
      }
      if (payload.from) {
        result.respondedBy = { id: payload.from }
      }
    } else {
      result = {
        respondedAt: new Date(),
        via: transport,
      }
      if (payload.approved !== undefined) {
        result.approved = payload.approved
      }
      if (payload.answer !== undefined) {
        result.answer = payload.answer
      }
      if (payload.respondedBy !== undefined) {
        result.respondedBy = payload.respondedBy
      }
      if (payload.notes !== undefined) {
        result.notes = payload.notes
      }
    }

    // Update the request
    await this.store.update(requestId, {
      status: 'completed',
      result,
      completedAt: new Date(),
    })

    // Notify requestor if configured
    if (this.notifyRequestor && request.notifyChannel) {
      await this.notifyRequestorOfResult(request, result)
    }

    // Call onComplete callback
    if (this.onCompleteCallback) {
      const updatedRequest = await this.store.get(requestId)
      if (updatedRequest) {
        try {
          await this.onCompleteCallback({
            requestId,
            request: updatedRequest,
            result,
          })
        } catch {
          // Swallow callback errors
        }
      }
    }

    return {
      success: true,
      requestId,
    }
  }

  /**
   * Get a request by ID
   */
  async getRequest(requestId: string): Promise<HumanRequest | undefined> {
    return this.store.get(requestId)
  }

  /**
   * Cancel a pending request
   */
  async cancelRequest(requestId: string): Promise<CancelResult> {
    const request = await this.store.get(requestId)
    if (!request) {
      return {
        success: false,
        error: `Request '${requestId}' not found`,
      }
    }

    if (request.status !== 'pending') {
      return {
        success: false,
        error: `Request '${requestId}' already completed with status '${request.status}'`,
      }
    }

    await this.store.update(requestId, {
      status: 'cancelled',
      completedAt: new Date(),
    })

    return { success: true }
  }

  /**
   * Stop the processor and clean up resources
   */
  destroy(): void {
    this.destroyed = true
    if (this.timeoutChecker !== null) {
      clearInterval(this.timeoutChecker)
      this.timeoutChecker = null
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private getTransport(transport: Transport): SlackTransport | EmailTransport | undefined {
    switch (transport) {
      case 'slack':
        return this.transports.slack
      case 'email':
        return this.transports.email
      default:
        return undefined
    }
  }

  private async sendViaTransport(
    transportName: Transport,
    transport: SlackTransport | EmailTransport,
    request: HumanRequest
  ): Promise<DeliveryResult> {
    if (transportName === 'slack') {
      const slackTransport = transport as SlackTransport
      if (request.type === 'approval') {
        const options: {
          requestId: string
          context?: Record<string, unknown>
        } = { requestId: request.id }
        if (request.context !== undefined) {
          options.context = request.context
        }
        return slackTransport.sendApprovalRequest(request.target, request.content, options)
      } else if (request.type === 'question') {
        return slackTransport.sendQuestion(request.target, request.content, {
          requestId: request.id,
        })
      } else {
        return slackTransport.sendNotification(request.target, request.content)
      }
    }

    if (transportName === 'email') {
      const emailTransport = transport as EmailTransport
      if (request.type === 'approval') {
        const options: {
          to: string
          request: string
          requestId: string
          context?: Record<string, unknown>
        } = {
          to: request.target,
          request: request.content,
          requestId: request.id,
        }
        if (request.context !== undefined) {
          options.context = request.context
        }
        return emailTransport.sendApprovalRequest(options)
      } else {
        return emailTransport.sendNotification({
          to: request.target,
          message: request.content,
        })
      }
    }

    return {
      success: false,
      transport: transportName,
      error: `Unsupported transport: ${transportName}`,
    }
  }

  private parseEmailApproval(content: string): boolean {
    const lower = content.toLowerCase().trim()
    const approvePatterns = [/^approved/i, /^yes/i, /^lgtm/i, /^ok\b/i]

    for (const pattern of approvePatterns) {
      if (pattern.test(lower)) {
        return true
      }
    }

    return false
  }

  private async notifyRequestorOfResult(
    request: HumanRequest,
    result: RequestResult
  ): Promise<void> {
    if (!request.notifyChannel) {
      return
    }

    // Use Slack if available
    const slackTransport = this.transports.slack
    if (slackTransport) {
      const status = result.approved ? 'approved' : 'rejected'
      const message = `Your request "${request.content}" was ${status}${
        result.notes ? `: ${result.notes}` : ''
      }`

      await slackTransport.sendNotification(request.notifyChannel, message)
    }
  }

  private startTimeoutChecker(): void {
    this.timeoutChecker = setInterval(async () => {
      if (this.destroyed) {
        return
      }

      try {
        const expiredRequests = await this.store.listExpired()

        for (const request of expiredRequests) {
          // Update status to expired
          await this.store.update(request.id, {
            status: 'expired',
            completedAt: new Date(),
          })

          // Call onTimeout callback
          if (this.onTimeoutCallback) {
            try {
              await this.onTimeoutCallback({
                requestId: request.id,
                request,
              })
            } catch {
              // Swallow callback errors
            }
          }
        }
      } catch {
        // Swallow errors in timeout checker
      }
    }, this.checkIntervalMs)
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a HumanRequestProcessor instance
 *
 * @example
 * ```ts
 * const processor = createHumanRequestProcessor({
 *   store: new InMemoryRequestStore(),
 *   transports: {
 *     slack: createSlackTransport({ botToken, signingSecret }),
 *   },
 *   onComplete: (data) => console.log('Completed:', data),
 *   onTimeout: (data) => console.log('Timed out:', data),
 * })
 * ```
 */
export function createHumanRequestProcessor(config: ProcessorConfig): HumanRequestProcessor {
  return new HumanRequestProcessor(config)
}
