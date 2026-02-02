/**
 * Example: Integration with ai-database for Persistence
 *
 * This example demonstrates how to integrate ai-workflows with a database
 * for durable event storage, state persistence, and audit logging.
 *
 * Note: This example uses a mock database implementation. In production,
 * you would use ai-database or another persistence layer.
 *
 * Key concepts demonstrated:
 * - DatabaseContext integration with workflows
 * - Durable event storage with $.do
 * - State checkpointing
 * - Audit trail with 5W+H events
 * - Recovery from failures
 *
 * @example
 * ```bash
 * npx tsx examples/04-database-persistence.ts
 * ```
 */

import {
  Workflow,
  createCascadeContext,
  recordStep,
  type WorkflowContext,
  type DatabaseContext,
} from '../dist/index.js'

// ============================================================================
// Type Definitions
// ============================================================================

interface StoredEvent {
  id: string
  event: string
  data: unknown
  timestamp: number
}

interface StoredAction {
  id: string
  actor: string
  object: string
  action: string
  status?: 'pending' | 'active' | 'completed' | 'failed'
  metadata?: Record<string, unknown>
  createdAt: number
  completedAt?: number
  result?: unknown
}

interface StoredArtifact {
  key: string
  type: string
  sourceHash: string
  content: unknown
  metadata?: Record<string, unknown>
  storedAt: number
}

interface WorkflowCheckpoint {
  workflowId: string
  state: Record<string, unknown>
  history: Array<{ timestamp: number; type: string; name: string; data?: unknown }>
  createdAt: number
}

// ============================================================================
// Mock Database Implementation
// ============================================================================

class MockDatabase {
  private events: StoredEvent[] = []
  private actions: Map<string, StoredAction> = new Map()
  private artifacts: Map<string, StoredArtifact> = new Map()
  private checkpoints: Map<string, WorkflowCheckpoint> = new Map()

  // Event storage
  async recordEvent(event: string, data: unknown): Promise<string> {
    const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const stored: StoredEvent = {
      id,
      event,
      data,
      timestamp: Date.now(),
    }
    this.events.push(stored)
    console.log(`  [DB] Recorded event: ${event} (${id})`)
    return id
  }

  async getEvents(filter?: { event?: string; since?: number }): Promise<StoredEvent[]> {
    let result = [...this.events]
    if (filter?.event) {
      result = result.filter((e) => e.event === filter.event)
    }
    if (filter?.since) {
      result = result.filter((e) => e.timestamp >= filter.since)
    }
    return result
  }

  // Action storage
  async createAction(action: Omit<StoredAction, 'id' | 'createdAt'>): Promise<string> {
    const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const stored: StoredAction = {
      ...action,
      id,
      status: action.status || 'pending',
      createdAt: Date.now(),
    }
    this.actions.set(id, stored)
    console.log(`  [DB] Created action: ${action.action} on ${action.object} (${id})`)
    return id
  }

  async updateAction(
    id: string,
    update: Partial<Pick<StoredAction, 'status' | 'result'>>
  ): Promise<void> {
    const action = this.actions.get(id)
    if (action) {
      Object.assign(action, update)
      if (update.status === 'completed' || update.status === 'failed') {
        action.completedAt = Date.now()
      }
      console.log(`  [DB] Updated action ${id}: status=${action.status}`)
    }
  }

  async getAction(id: string): Promise<StoredAction | null> {
    return this.actions.get(id) || null
  }

  async getPendingActions(): Promise<StoredAction[]> {
    return Array.from(this.actions.values()).filter(
      (a) => a.status === 'pending' || a.status === 'active'
    )
  }

  // Artifact storage
  async storeArtifact(artifact: Omit<StoredArtifact, 'storedAt'>): Promise<void> {
    const stored: StoredArtifact = {
      ...artifact,
      storedAt: Date.now(),
    }
    this.artifacts.set(artifact.key, stored)
    console.log(`  [DB] Stored artifact: ${artifact.key} (${artifact.type})`)
  }

  async getArtifact(key: string): Promise<StoredArtifact | null> {
    return this.artifacts.get(key) || null
  }

  // Checkpoint storage
  async saveCheckpoint(checkpoint: WorkflowCheckpoint): Promise<void> {
    this.checkpoints.set(checkpoint.workflowId, checkpoint)
    console.log(`  [DB] Saved checkpoint for workflow ${checkpoint.workflowId}`)
  }

  async getCheckpoint(workflowId: string): Promise<WorkflowCheckpoint | null> {
    return this.checkpoints.get(workflowId) || null
  }

  // Stats
  getStats() {
    return {
      events: this.events.length,
      actions: this.actions.size,
      artifacts: this.artifacts.size,
      checkpoints: this.checkpoints.size,
    }
  }

  // Dump for inspection
  dump() {
    return {
      events: this.events,
      actions: Array.from(this.actions.values()),
      artifacts: Array.from(this.artifacts.values()),
      checkpoints: Array.from(this.checkpoints.values()),
    }
  }
}

// ============================================================================
// Database Context Adapter
// ============================================================================

function createDatabaseContext(db: MockDatabase): DatabaseContext {
  return {
    async recordEvent(event: string, data: unknown): Promise<void> {
      await db.recordEvent(event, data)
    },

    async createAction(action: {
      actor: string
      object: string
      action: string
      status?: 'pending' | 'active' | 'completed' | 'failed'
      metadata?: Record<string, unknown>
    }): Promise<void> {
      await db.createAction(action)
    },

    async completeAction(id: string, result: unknown): Promise<void> {
      await db.updateAction(id, { status: 'completed', result })
    },

    async storeArtifact(artifact: {
      key: string
      type: string
      sourceHash: string
      content: unknown
      metadata?: Record<string, unknown>
    }): Promise<void> {
      await db.storeArtifact(artifact)
    },

    async getArtifact(key: string): Promise<unknown | null> {
      const artifact = await db.getArtifact(key)
      return artifact?.content ?? null
    },
  }
}

// ============================================================================
// Durable Workflow Example
// ============================================================================

interface PaymentRequest {
  orderId: string
  amount: number
  customerId: string
}

interface PaymentResult {
  transactionId: string
  status: 'success' | 'failed'
  processedAt: number
}

async function createDurablePaymentWorkflow(db: MockDatabase) {
  const dbContext = createDatabaseContext(db)

  const workflow = Workflow(
    ($) => {
      // Payment processing with durable state
      $.on.Payment.process(async (request: PaymentRequest, $: WorkflowContext) => {
        $.log(`Processing payment for order ${request.orderId}`)

        // Create cascade context for tracing
        const cascade = createCascadeContext({ name: 'payment-processing' })

        // Step 1: Validate payment
        const validateStep = recordStep(cascade, 'validate', {
          actor: 'payment-service',
          action: 'validate-payment',
        })

        try {
          // Simulate validation
          await new Promise((resolve) => setTimeout(resolve, 50))
          if (request.amount <= 0) {
            throw new Error('Invalid amount')
          }
          validateStep.complete()
          $.log('  Payment validated')
        } catch (error) {
          validateStep.fail(error instanceof Error ? error : new Error(String(error)))
          throw error
        }

        // Step 2: Process payment (durable)
        const processStep = recordStep(cascade, 'process', {
          actor: 'payment-gateway',
          action: 'charge-card',
        })

        try {
          // This would be $.do in real usage for durable execution
          await new Promise((resolve) => setTimeout(resolve, 100))
          const transactionId = `txn_${Date.now()}`

          // Store transaction artifact
          if ($.db) {
            await $.db.storeArtifact({
              key: `payment:${request.orderId}`,
              type: 'transaction',
              sourceHash: request.orderId,
              content: {
                transactionId,
                amount: request.amount,
                customerId: request.customerId,
              },
            })
          }

          processStep.complete()
          $.log(`  Payment processed: ${transactionId}`)

          // Emit success event
          $.send('Payment.completed', {
            orderId: request.orderId,
            transactionId,
            amount: request.amount,
          })

          return {
            transactionId,
            status: 'success' as const,
            processedAt: Date.now(),
          }
        } catch (error) {
          processStep.fail(error instanceof Error ? error : new Error(String(error)))

          $.send('Payment.failed', {
            orderId: request.orderId,
            error: error instanceof Error ? error.message : String(error),
          })

          throw error
        }
      })

      $.on.Payment.completed(
        async (data: { orderId: string; transactionId: string }, $: WorkflowContext) => {
          $.log(`Payment ${data.transactionId} completed for order ${data.orderId}`)

          // Create action to fulfill order
          if ($.db) {
            await $.db.createAction({
              actor: 'fulfillment-service',
              object: `order:${data.orderId}`,
              action: 'fulfill',
              metadata: { transactionId: data.transactionId },
            })
          }
        }
      )

      $.on.Payment.failed(async (data: { orderId: string; error: string }, $: WorkflowContext) => {
        $.log(`Payment failed for order ${data.orderId}: ${data.error}`)

        // Create action to notify customer
        if ($.db) {
          await $.db.createAction({
            actor: 'notification-service',
            object: `customer:order:${data.orderId}`,
            action: 'notify-payment-failed',
            metadata: { error: data.error },
          })
        }
      })
    },
    { db: dbContext }
  )

  return workflow
}

// ============================================================================
// State Recovery Example
// ============================================================================

async function demonstrateStateRecovery(db: MockDatabase) {
  console.log('\n--- State Recovery Demo ---\n')

  // Simulate saving a checkpoint
  const checkpoint: WorkflowCheckpoint = {
    workflowId: 'workflow-123',
    state: {
      orderId: 'order-456',
      step: 'payment-processing',
      attempts: 2,
    },
    history: [
      { timestamp: Date.now() - 10000, type: 'event', name: 'Order.placed' },
      { timestamp: Date.now() - 5000, type: 'action', name: 'validate' },
      {
        timestamp: Date.now() - 1000,
        type: 'action',
        name: 'process-payment',
        data: { attempt: 1 },
      },
    ],
    createdAt: Date.now(),
  }

  await db.saveCheckpoint(checkpoint)

  // Simulate recovery
  console.log('Recovering workflow state...')
  const recovered = await db.getCheckpoint('workflow-123')

  if (recovered) {
    console.log(`  Recovered workflow: ${recovered.workflowId}`)
    console.log(`  State: ${JSON.stringify(recovered.state)}`)
    console.log(`  History entries: ${recovered.history.length}`)
    console.log(`  Last action: ${recovered.history[recovered.history.length - 1]?.name}`)
  }
}

// ============================================================================
// Audit Trail Example
// ============================================================================

async function demonstrateAuditTrail(db: MockDatabase) {
  console.log('\n--- Audit Trail Demo ---\n')

  // Record various events
  await db.recordEvent('User.login', {
    userId: 'user-123',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
  })

  await db.recordEvent('Order.placed', {
    orderId: 'order-789',
    customerId: 'user-123',
    total: 99.99,
  })

  await db.recordEvent('Payment.processed', {
    orderId: 'order-789',
    transactionId: 'txn-abc',
    amount: 99.99,
  })

  await db.recordEvent('Order.shipped', {
    orderId: 'order-789',
    trackingNumber: 'TRK123456',
    carrier: 'FastShip',
  })

  // Query events
  console.log('All recorded events:')
  const events = await db.getEvents()
  for (const event of events) {
    console.log(`  ${new Date(event.timestamp).toISOString()} | ${event.event}`)
  }

  // Query specific event type
  console.log('\nOrder-related events:')
  const orderEvents = await db.getEvents({ event: 'Order.placed' })
  for (const event of orderEvents) {
    console.log(`  ${event.id}: ${JSON.stringify(event.data)}`)
  }
}

// ============================================================================
// Demo Execution
// ============================================================================

async function runDemo() {
  console.log('='.repeat(60))
  console.log('Database Persistence Integration Demo')
  console.log('='.repeat(60))
  console.log()

  // Create mock database
  const db = new MockDatabase()

  // Create and start workflow
  const workflow = await createDurablePaymentWorkflow(db)
  await workflow.start()

  // Process some payments
  console.log('--- Processing Payments ---\n')

  await workflow.send('Payment.process', {
    orderId: 'order-001',
    amount: 99.99,
    customerId: 'cust-001',
  })
  await new Promise((resolve) => setTimeout(resolve, 200))

  await workflow.send('Payment.process', {
    orderId: 'order-002',
    amount: 149.99,
    customerId: 'cust-002',
  })
  await new Promise((resolve) => setTimeout(resolve, 200))

  // Demonstrate state recovery
  await demonstrateStateRecovery(db)

  // Demonstrate audit trail
  await demonstrateAuditTrail(db)

  // Show database stats
  console.log('\n--- Database Stats ---\n')
  const stats = db.getStats()
  console.log(`  Events: ${stats.events}`)
  console.log(`  Actions: ${stats.actions}`)
  console.log(`  Artifacts: ${stats.artifacts}`)
  console.log(`  Checkpoints: ${stats.checkpoints}`)

  // Show pending actions
  console.log('\n--- Pending Actions ---\n')
  const pending = await db.getPendingActions()
  for (const action of pending) {
    console.log(`  ${action.id}: ${action.action} on ${action.object} (${action.status})`)
  }

  // Full dump for inspection
  console.log('\n--- Full Database Dump ---\n')
  const dump = db.dump()
  console.log(JSON.stringify(dump, null, 2))

  // Clean up
  await workflow.stop()
}

// Run if executed directly
runDemo().catch(console.error)
