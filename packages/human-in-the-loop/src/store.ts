/**
 * In-memory store implementation for human requests
 */

import type {
  HumanStore,
  HumanRequest,
  HumanRequestStatus,
  ReviewQueue,
} from './types.js'

/**
 * Simple in-memory implementation of HumanStore
 *
 * For production use, implement a persistent store using:
 * - Database (PostgreSQL, MongoDB, etc.)
 * - Key-value store (Redis)
 * - Message queue (RabbitMQ, AWS SQS)
 */
export class InMemoryHumanStore implements HumanStore {
  private requests = new Map<string, HumanRequest>()
  private requestIdCounter = 0

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
    return request ? (request as T) : null
  }

  /**
   * Update a request
   */
  async update<T extends HumanRequest>(
    id: string,
    updates: Partial<T>
  ): Promise<T> {
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
   * List requests with filters
   */
  async list<T extends HumanRequest>(
    filters?: ReviewQueue['filters'],
    limit?: number
  ): Promise<T[]> {
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
   * Complete a request
   */
  async complete<T extends HumanRequest>(
    id: string,
    response: T['response']
  ): Promise<T> {
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
}
