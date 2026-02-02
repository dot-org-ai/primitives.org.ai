/**
 * Events and Actions Example - ai-database
 *
 * This example demonstrates the events and actions APIs:
 * - Event subscription and emission
 * - Long-running action tracking
 * - Durable forEach with persistence
 * - Progress tracking and error handling
 *
 * Run with: npx tsx examples/08-events-actions.ts
 */

import {
  DB,
  setProvider,
  createMemoryProvider,
  StandardEventTypes,
  ActionStatuses,
  isTerminal,
  getProgressPercent,
  formatActionStatus,
} from '../src/index.js'
import type { DatabaseSchema, DBEvent, DBAction } from '../src/index.js'

async function main() {
  // Initialize provider
  setProvider(createMemoryProvider())

  // Define schema
  const schema = {
    Customer: {
      name: 'string',
      email: 'string',
      tier: 'string',
      lastActivity: 'datetime?',
    },
    Order: {
      customer: '->Customer',
      items: 'json',
      total: 'number',
      status: 'string',
      processedAt: 'datetime?',
    },
    Product: {
      name: 'string',
      sku: 'string',
      price: 'number',
      inventory: 'number',
    },
    ImportJob: {
      source: 'string',
      status: 'string',
      progress: 'number',
      totalRecords: 'number',
      processedRecords: 'number',
      errors: 'json?',
    },
  } as const satisfies DatabaseSchema

  const { db, events, actions } = DB(schema)

  console.log('=== Events and Actions Example ===\n')

  // ====================================
  // Part 1: Events API
  // ====================================
  console.log('--- Part 1: Events API ---\n')

  // Track event listeners for cleanup
  const eventLog: string[] = []

  // Subscribe to entity events
  events.on('Customer.created', (event: DBEvent) => {
    eventLog.push(`[Event] Customer created: ${event.data?.name}`)
    console.log(`[Event] Customer created: ${event.data?.name}`)
  })

  events.on('Customer.updated', (event: DBEvent) => {
    eventLog.push(`[Event] Customer updated: ${event.data?.$id}`)
    console.log(`[Event] Customer updated: ${event.data?.$id}`)
  })

  events.on('Order.created', (event: DBEvent) => {
    eventLog.push(`[Event] New order: $${event.data?.total}`)
    console.log(`[Event] New order: $${event.data?.total}`)
  })

  // Wildcard subscription for all updates
  events.on('*.updated', (event: DBEvent) => {
    eventLog.push(`[Event] Entity updated: ${event.type}`)
  })

  // Create some entities to trigger events
  console.log('Creating entities...\n')

  const customer = await db.Customer.create({
    name: 'John Doe',
    email: 'john@example.com',
    tier: 'gold',
  })

  const order = await db.Order.create({
    customer: customer.$id,
    items: [
      { sku: 'PROD-001', qty: 2 },
      { sku: 'PROD-002', qty: 1 },
    ],
    total: 149.99,
    status: 'pending',
  })

  // Update customer
  await db.Customer.update(customer.$id, {
    lastActivity: new Date(),
  })

  console.log(`\nTotal events captured: ${eventLog.length}`)

  // Show standard event types
  console.log('\nStandard event types:')
  console.log(`  ${StandardEventTypes.join(', ')}`)

  // ====================================
  // Part 2: Actions API
  // ====================================
  console.log('\n--- Part 2: Actions API ---\n')

  // Create a long-running action
  const importAction = await actions.create({
    type: 'import-customers',
    data: {
      source: 'crm-export.csv',
      expectedRecords: 1000,
    },
    total: 1000,
  })

  console.log('Created action:', importAction.id)
  console.log('Status:', formatActionStatus(importAction.status))

  // Simulate progress updates
  console.log('\nSimulating import progress...')

  let progress = 0
  while (progress < 100) {
    progress += 20
    await actions.update(importAction.id, {
      progress: Math.min(progress, 100) * 10, // 0-1000
    })

    const updated = await actions.get(importAction.id)
    if (updated) {
      console.log(`  Progress: ${getProgressPercent(updated)}%`)
    }

    await new Promise((r) => setTimeout(r, 100)) // Simulate work
  }

  // Complete the action
  await actions.update(importAction.id, { status: 'completed' })
  const completedAction = await actions.get(importAction.id)
  console.log('Final status:', formatActionStatus(completedAction?.status || 'unknown'))
  console.log('Is terminal?', isTerminal(completedAction?.status || 'pending'))

  // Show action statuses
  console.log('\nAction statuses:')
  for (const status of ActionStatuses) {
    console.log(`  - ${status}: terminal=${isTerminal(status)}`)
  }

  // ====================================
  // Part 3: Durable forEach
  // ====================================
  console.log('\n--- Part 3: Durable forEach ---\n')

  // Create test products
  console.log('Creating test products...')
  for (let i = 1; i <= 10; i++) {
    await db.Product.create({
      name: `Product ${i}`,
      sku: `PROD-${String(i).padStart(3, '0')}`,
      price: Math.round(Math.random() * 100 + 10),
      inventory: Math.floor(Math.random() * 100),
    })
  }

  // Process products with forEach
  console.log('\nProcessing products with forEach...')

  const processStats = {
    processed: 0,
    totalValue: 0,
    errors: 0,
  }

  const forEachResult = await db.Product.forEach(
    async (product) => {
      // Simulate processing
      processStats.processed++
      processStats.totalValue += (product.price as number) * (product.inventory as number)

      // Simulate occasional errors
      if (Math.random() < 0.1) {
        throw new Error(`Random processing error for ${product.sku}`)
      }

      // Update product
      await db.Product.update(product.$id, {
        inventory: (product.inventory as number) + 10,
      })
    },
    {
      concurrency: 3,
      maxRetries: 2,
      retryDelay: 100,
      persist: 'process-products', // Enable durability

      onProgress: (p) => {
        if (p.completed % 3 === 0) {
          console.log(`  Progress: ${p.completed}/${p.total} (${p.errors} errors)`)
        }
      },

      onError: (err, product) => {
        processStats.errors++
        console.log(`  Error processing ${product?.sku}: ${err.message}`)
        return 'continue' // or 'retry' or 'stop'
      },
    }
  )

  console.log('\nforEach complete:')
  console.log(`  Processed: ${forEachResult.completed}/${forEachResult.total}`)
  console.log(`  Errors: ${forEachResult.errors}`)
  console.log(`  Duration: ${forEachResult.duration}ms`)

  // Resume example (if persisted)
  if (forEachResult.actionId) {
    console.log(`  Action ID: ${forEachResult.actionId}`)
    console.log('  To resume after crash: db.Product.forEach(fn, { resume: actionId })')
  }

  // ====================================
  // Part 4: Order Processing Workflow
  // ====================================
  console.log('\n--- Part 4: Order Processing Workflow ---\n')

  // Create more orders
  console.log('Creating orders...')
  const orders = []
  for (let i = 0; i < 5; i++) {
    const o = await db.Order.create({
      customer: customer.$id,
      items: [{ sku: `PROD-${String(i + 1).padStart(3, '0')}`, qty: i + 1 }],
      total: (i + 1) * 25,
      status: 'pending',
    })
    orders.push(o)
  }

  // Process orders action
  const processOrdersAction = await actions.create({
    type: 'process-orders',
    data: { batchId: 'batch-001' },
    total: orders.length,
  })

  console.log('Processing orders...')

  let processedOrders = 0
  for (const order of orders) {
    try {
      // Simulate order processing
      await new Promise((r) => setTimeout(r, 50))

      await db.Order.update(order.$id, {
        status: 'processed',
        processedAt: new Date(),
      })

      processedOrders++
      await actions.update(processOrdersAction.id, {
        progress: processedOrders,
      })

      console.log(`  Processed order ${order.$id}`)
    } catch (err) {
      await db.Order.update(order.$id, { status: 'failed' })
      console.log(`  Failed order ${order.$id}`)
    }
  }

  await actions.update(processOrdersAction.id, { status: 'completed' })

  console.log('\nOrder processing complete')

  // ====================================
  // Part 5: Query Events and Actions
  // ====================================
  console.log('\n--- Part 5: Querying Events and Actions ---\n')

  // Query recent events
  const recentEvents = await events.list({
    after: new Date(Date.now() - 60000), // Last minute
    limit: 10,
  })

  console.log(`Recent events: ${recentEvents.length}`)
  for (const event of recentEvents.slice(0, 5)) {
    console.log(`  - ${event.type} at ${event.timestamp}`)
  }

  // Query actions by status
  const completedActions = await actions.list({
    status: 'completed',
  })

  console.log(`\nCompleted actions: ${completedActions.length}`)
  for (const action of completedActions) {
    console.log(`  - ${action.type}: ${formatActionStatus(action.status)}`)
  }

  // ====================================
  // Part 6: Event Patterns
  // ====================================
  console.log('\n--- Part 6: Event Patterns ---\n')

  // Pattern matching examples
  console.log('Event subscription patterns:')
  console.log("  events.on('Customer.created', fn)    // Specific entity + event")
  console.log("  events.on('Customer.*', fn)          // All Customer events")
  console.log("  events.on('*.created', fn)           // All create events")
  console.log("  events.on('*.*', fn)                 // All events")

  // Correlation tracking
  console.log('\nCorrelation tracking:')
  console.log('  Events can include correlationId and causationId')
  console.log('  for tracing related events across workflows')

  // Event sourcing pattern
  console.log('\nEvent sourcing pattern:')
  console.log('  1. All changes emit events')
  console.log('  2. Events are immutable and append-only')
  console.log('  3. State can be rebuilt from event stream')
  console.log('  4. Enables audit trails and time travel')

  // ====================================
  // Summary
  // ====================================
  console.log('\n--- Summary ---\n')

  console.log('Events API:')
  console.log('  - Subscribe to entity lifecycle events')
  console.log('  - Pattern matching for flexible subscriptions')
  console.log('  - Immutable event log for auditing')

  console.log('\nActions API:')
  console.log('  - Track long-running operations')
  console.log('  - Progress reporting and status updates')
  console.log('  - Built-in state machine (pending -> active -> completed/failed)')

  console.log('\nDurable forEach:')
  console.log('  - Process large collections with concurrency')
  console.log('  - Automatic retries with configurable backoff')
  console.log('  - Persist progress for crash recovery')
  console.log('  - Resume from checkpoint after restart')

  console.log('\n=== Events and Actions Example Complete ===')
}

main().catch(console.error)
