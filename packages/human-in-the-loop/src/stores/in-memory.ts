/**
 * Enhanced In-Memory Store Implementation for digital-workers runtime
 *
 * This store provides:
 * - Request storage with auto-generated IDs
 * - TTL/expiration support for requests
 * - Priority-based queue ordering
 * - Delete functionality for completed requests
 * - Automatic expiration checking
 */

import type {
  HumanStore,
  HumanRequest,
  HumanRequestStatus,
  Priority,
  ReviewQueue,
} from '../types.js'

/**
 * Priority weights for ordering (higher = more important)
 */
const PRIORITY_WEIGHTS: Record<Priority, number> = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1,
}

/**
 * Options for creating an InMemoryHumanStore
 */
export interface InMemoryHumanStoreOptions {
  /**
   * Interval in milliseconds for checking request expiration
   * @default 10000 (10 seconds)
   */
  checkExpirationInterval?: number
}

/**
 * Enhanced in-memory implementation of HumanStore for digital-workers runtime
 *
 * Features:
 * - Automatic ID generation
 * - TTL/expiration support via timeout field
 * - Priority-based queue ordering
 * - Delete functionality
 *
 * For production use, implement a persistent store using:
 * - Database (PostgreSQL, MongoDB, etc.)
 * - Key-value store (Redis)
 * - Message queue (RabbitMQ, AWS SQS)
 */
export class InMemoryHumanStore implements HumanStore {
  private requests = new Map<string, HumanRequest>()
  private requestIdCounter = 0
  private expirationTimer: ReturnType<typeof setInterval> | null = null
  private checkExpirationInterval: number

  constructor(options: InMemoryHumanStoreOptions = {}) {
    this.checkExpirationInterval = options.checkExpirationInterval ?? 10000
    this.startExpirationChecker()
  }

  /**
   * Start the background expiration checker
   */
  private startExpirationChecker(): void {
    // Don't start timer if interval is 0 or negative
    if (this.checkExpirationInterval <= 0) return

    this.expirationTimer = setInterval(() => {
      this.checkExpirations()
    }, this.checkExpirationInterval)
  }

  /**
   * Check all requests for expiration and update their status
   */
  private checkExpirations(): void {
    const now = Date.now()

    for (const [id, request] of this.requests.entries()) {
      if (this.isExpired(request, now)) {
        // Mark as expired
        this.requests.set(id, {
          ...request,
          status: 'timeout' as HumanRequestStatus,
          updatedAt: new Date(now),
          completedAt: new Date(now),
        })
      }
    }
  }

  /**
   * Check if a request has expired
   */
  private isExpired(request: HumanRequest, now: number = Date.now()): boolean {
    // Only pending or in_progress requests can expire
    if (!['pending', 'in_progress'].includes(request.status)) {
      return false
    }

    // No timeout means no expiration
    if (!request.timeout) {
      return false
    }

    const expirationTime = request.createdAt.getTime() + request.timeout
    return now > expirationTime
  }

  /**
   * Apply expiration check to a request if needed
   */
  private applyExpiration(request: HumanRequest): HumanRequest {
    if (this.isExpired(request)) {
      const now = new Date()
      return {
        ...request,
        status: 'timeout' as HumanRequestStatus,
        updatedAt: now,
        completedAt: now,
      }
    }
    return request
  }

  /**
   * Generate a unique request ID
   */
  private generateId(): string {
    return `req_${Date.now()}_${++this.requestIdCounter}`
  }

  /**
   * Create a new request
   */
  async create<T extends HumanRequest>(
    request: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<T> {
    const now = new Date()
    const fullRequest = {
      ...request,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now,
    } as T

    this.requests.set(fullRequest.id, fullRequest)
    return fullRequest
  }

  /**
   * Get a request by ID
   */
  async get<T extends HumanRequest>(id: string): Promise<T | null> {
    const request = this.requests.get(id)
    if (!request) {
      return null
    }

    // Check and apply expiration
    const updated = this.applyExpiration(request)
    if (updated !== request) {
      this.requests.set(id, updated)
    }

    return updated as T
  }

  /**
   * Update a request
   */
  async update<T extends HumanRequest>(id: string, updates: Partial<T>): Promise<T> {
    const request = this.requests.get(id)
    if (!request) {
      throw new Error(`Request not found: ${id}`)
    }

    const updated = {
      ...request,
      ...updates,
      updatedAt: new Date(),
    } as T

    this.requests.set(id, updated)
    return updated
  }

  /**
   * Delete a request by ID
   */
  async delete(id: string): Promise<boolean> {
    return this.requests.delete(id)
  }

  /**
   * List requests with filters
   */
  async list<T extends HumanRequest>(
    filters?: ReviewQueue['filters'],
    limit?: number
  ): Promise<T[]> {
    // First, apply expiration checks to all requests
    for (const [id, request] of this.requests.entries()) {
      const updated = this.applyExpiration(request)
      if (updated !== request) {
        this.requests.set(id, updated)
      }
    }

    let requests = Array.from(this.requests.values()) as T[]

    // Apply filters
    if (filters) {
      if (filters.status) {
        requests = requests.filter((r) => filters.status!.includes(r.status))
      }
      if (filters.priority) {
        requests = requests.filter((r) => filters.priority!.includes(r.priority))
      }
      if (filters.assignee) {
        requests = requests.filter((r) => {
          if (!r.assignee) return false
          const assignees = Array.isArray(r.assignee) ? r.assignee : [r.assignee]
          return assignees.some((a) => filters.assignee!.includes(a))
        })
      }
      if (filters.role) {
        requests = requests.filter((r) => r.role && filters.role!.includes(r.role))
      }
      if (filters.team) {
        requests = requests.filter((r) => r.team && filters.team!.includes(r.team))
      }
    }

    // Sort by creation date (newest first)
    requests.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    // Apply limit
    if (limit && limit > 0) {
      requests = requests.slice(0, limit)
    }

    return requests
  }

  /**
   * List requests ordered by priority (highest first)
   */
  async listByPriority<T extends HumanRequest>(
    filters?: ReviewQueue['filters'],
    limit?: number
  ): Promise<T[]> {
    let requests = await this.list<T>(filters)

    // Sort by priority (highest first), then by creation date (oldest first for FIFO within priority)
    requests.sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority]
      if (priorityDiff !== 0) return priorityDiff
      // Within same priority, use FIFO (oldest first)
      return a.createdAt.getTime() - b.createdAt.getTime()
    })

    // Apply limit
    if (limit && limit > 0) {
      requests = requests.slice(0, limit)
    }

    return requests
  }

  /**
   * Complete a request
   */
  async complete<T extends HumanRequest>(id: string, response: T['response']): Promise<T> {
    const request = await this.get<T>(id)
    if (!request) {
      throw new Error(`Request not found: ${id}`)
    }

    return this.update<T>(id, {
      status: 'completed' as HumanRequestStatus,
      response,
      completedAt: new Date(),
    } as Partial<T>)
  }

  /**
   * Reject a request
   */
  async reject(id: string, reason: string): Promise<HumanRequest> {
    const request = await this.get(id)
    if (!request) {
      throw new Error(`Request not found: ${id}`)
    }

    return this.update(id, {
      status: 'rejected' as HumanRequestStatus,
      rejectionReason: reason,
      completedAt: new Date(),
    })
  }

  /**
   * Escalate a request
   */
  async escalate(id: string, to: string): Promise<HumanRequest> {
    const request = await this.get(id)
    if (!request) {
      throw new Error(`Request not found: ${id}`)
    }

    return this.update(id, {
      status: 'escalated' as HumanRequestStatus,
      assignee: to,
    })
  }

  /**
   * Cancel a request
   */
  async cancel(id: string): Promise<HumanRequest> {
    const request = await this.get(id)
    if (!request) {
      throw new Error(`Request not found: ${id}`)
    }

    return this.update(id, {
      status: 'cancelled' as HumanRequestStatus,
      completedAt: new Date(),
    })
  }

  /**
   * Clear all requests (for testing)
   */
  clear(): void {
    this.requests.clear()
    this.requestIdCounter = 0
  }

  /**
   * Get total count of requests
   */
  count(): number {
    return this.requests.size
  }

  /**
   * Dispose of the store and cleanup resources
   */
  dispose(): void {
    if (this.expirationTimer) {
      clearInterval(this.expirationTimer)
      this.expirationTimer = null
    }
    this.clear()
  }
}

/**
 * Factory function to create an InMemoryHumanStore
 *
 * @param options - Configuration options for the store
 * @returns A new InMemoryHumanStore instance
 *
 * @example
 * ```ts
 * import { createInMemoryStore } from 'human-in-the-loop'
 *
 * const store = createInMemoryStore({
 *   checkExpirationInterval: 5000, // Check every 5 seconds
 * })
 *
 * // Create a request with TTL
 * const request = await store.create({
 *   type: 'approval',
 *   status: 'pending',
 *   title: 'Approve deployment',
 *   description: 'Deploy to production',
 *   input: { version: '2.0.0' },
 *   priority: 'high',
 *   timeout: 3600000, // 1 hour TTL
 * })
 *
 * // Later, cleanup
 * store.dispose()
 * ```
 */
export function createInMemoryStore(options?: InMemoryHumanStoreOptions): InMemoryHumanStore {
  return new InMemoryHumanStore(options)
}
