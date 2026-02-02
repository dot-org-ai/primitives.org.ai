/**
 * Example: E-commerce Order Processing Pipeline
 *
 * This example demonstrates a complete order processing workflow using ai-workflows.
 * It handles the full order lifecycle from placement to fulfillment, including
 * inventory management, payment processing, and customer notifications.
 *
 * Key concepts demonstrated:
 * - Event-driven architecture with $.on handlers
 * - Event chaining (one event triggers another)
 * - State management with $.state
 * - Error handling and compensation
 * - Parallel operations with Promise.all
 *
 * @example
 * ```bash
 * npx tsx examples/01-ecommerce-order-pipeline.ts
 * ```
 */

import { Workflow, type WorkflowContext } from '../dist/index.js'

// ============================================================================
// Type Definitions
// ============================================================================

interface OrderItem {
  sku: string
  quantity: number
  price: number
}

interface Order {
  id: string
  customerId: string
  items: OrderItem[]
  total: number
  shippingAddress: string
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
}

interface Customer {
  id: string
  email: string
  name: string
}

interface Payment {
  orderId: string
  amount: number
  method: 'card' | 'paypal' | 'crypto'
  transactionId?: string
}

interface Shipment {
  orderId: string
  trackingNumber: string
  carrier: string
  estimatedDelivery: string
}

// ============================================================================
// Mock Services (replace with real implementations)
// ============================================================================

const inventoryService = {
  async reserve(items: OrderItem[]): Promise<boolean> {
    console.log('  [Inventory] Reserving items:', items.map((i) => i.sku).join(', '))
    // Simulate inventory check - 90% success rate
    return Math.random() > 0.1
  },

  async release(items: OrderItem[]): Promise<void> {
    console.log('  [Inventory] Releasing reserved items:', items.map((i) => i.sku).join(', '))
  },
}

const paymentService = {
  async charge(payment: Payment): Promise<{ transactionId: string }> {
    console.log(`  [Payment] Charging $${payment.amount} via ${payment.method}`)
    // Simulate payment processing
    return { transactionId: `txn_${Date.now()}` }
  },

  async refund(transactionId: string, amount: number): Promise<void> {
    console.log(`  [Payment] Refunding $${amount} for transaction ${transactionId}`)
  },
}

const shippingService = {
  async createShipment(orderId: string, address: string): Promise<Shipment> {
    console.log(`  [Shipping] Creating shipment for order ${orderId} to ${address}`)
    return {
      orderId,
      trackingNumber: `TRK${Date.now()}`,
      carrier: 'FastShip',
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    }
  },
}

const emailService = {
  async send(to: string, subject: string, body: string): Promise<void> {
    console.log(`  [Email] Sending to ${to}: "${subject}"`)
  },
}

// Mock database
const customers = new Map<string, Customer>([
  ['cust_1', { id: 'cust_1', email: 'john@example.com', name: 'John Doe' }],
  ['cust_2', { id: 'cust_2', email: 'jane@example.com', name: 'Jane Smith' }],
])

// ============================================================================
// Workflow Definition
// ============================================================================

const orderWorkflow = Workflow(($) => {
  // -------------------------------------------------------------------------
  // Order Placement - Entry point for the workflow
  // -------------------------------------------------------------------------
  $.on.Order.placed(async (order: Order, $: WorkflowContext) => {
    $.log(`Order ${order.id} placed by customer ${order.customerId}`)

    // Store order in workflow state
    $.state.currentOrder = order
    $.state.orderStatus = 'processing'

    // Step 1: Reserve inventory
    const reserved = await inventoryService.reserve(order.items)

    if (!reserved) {
      $.log(`Inventory unavailable for order ${order.id}`)
      $.send('Order.failed', {
        orderId: order.id,
        reason: 'inventory_unavailable',
      })
      return
    }

    $.state.inventoryReserved = true

    // Step 2: Trigger payment processing
    $.send('Payment.requested', {
      orderId: order.id,
      amount: order.total,
      method: 'card',
    })
  })

  // -------------------------------------------------------------------------
  // Payment Processing
  // -------------------------------------------------------------------------
  $.on.Payment.requested(async (payment: Payment, $: WorkflowContext) => {
    $.log(`Processing payment for order ${payment.orderId}: $${payment.amount}`)

    try {
      const result = await paymentService.charge(payment)

      // Store transaction ID for potential refunds
      $.state.transactionId = result.transactionId

      $.send('Payment.completed', {
        orderId: payment.orderId,
        transactionId: result.transactionId,
        amount: payment.amount,
      })
    } catch (error) {
      $.log(`Payment failed for order ${payment.orderId}`)
      $.send('Payment.failed', {
        orderId: payment.orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  $.on.Payment.completed(
    async (data: { orderId: string; transactionId: string }, $: WorkflowContext) => {
      $.log(`Payment completed for order ${data.orderId}`)
      $.state.paymentCompleted = true

      // Trigger order confirmation
      $.send('Order.confirmed', { orderId: data.orderId })
    }
  )

  $.on.Payment.failed(async (data: { orderId: string; error: string }, $: WorkflowContext) => {
    $.log(`Payment failed for order ${data.orderId}: ${data.error}`)

    // Compensation: Release reserved inventory
    const order = $.state.currentOrder as Order
    if ($.state.inventoryReserved) {
      await inventoryService.release(order.items)
      $.state.inventoryReserved = false
    }

    $.send('Order.failed', {
      orderId: data.orderId,
      reason: 'payment_failed',
    })
  })

  // -------------------------------------------------------------------------
  // Order Confirmation & Fulfillment
  // -------------------------------------------------------------------------
  $.on.Order.confirmed(async (data: { orderId: string }, $: WorkflowContext) => {
    const order = $.state.currentOrder as Order
    $.log(`Order ${data.orderId} confirmed, preparing for fulfillment`)

    $.state.orderStatus = 'confirmed'

    // Get customer for notifications
    const customer = customers.get(order.customerId)

    // Send confirmation email
    if (customer) {
      await emailService.send(
        customer.email,
        `Order Confirmed - ${data.orderId}`,
        `Thank you for your order, ${customer.name}! Your order #${data.orderId} has been confirmed.`
      )
    }

    // Trigger shipping
    $.send('Shipping.requested', {
      orderId: data.orderId,
      address: order.shippingAddress,
    })
  })

  $.on.Shipping.requested(
    async (data: { orderId: string; address: string }, $: WorkflowContext) => {
      $.log(`Creating shipment for order ${data.orderId}`)

      const shipment = await shippingService.createShipment(data.orderId, data.address)

      $.state.shipment = shipment
      $.state.orderStatus = 'shipped'

      $.send('Order.shipped', {
        orderId: data.orderId,
        shipment,
      })
    }
  )

  $.on.Order.shipped(async (data: { orderId: string; shipment: Shipment }, $: WorkflowContext) => {
    const order = $.state.currentOrder as Order
    const customer = customers.get(order.customerId)

    $.log(`Order ${data.orderId} shipped via ${data.shipment.carrier}`)

    // Send shipping notification
    if (customer) {
      await emailService.send(
        customer.email,
        `Your Order Has Shipped - ${data.orderId}`,
        `Your order is on its way! Tracking: ${data.shipment.trackingNumber}, ` +
          `Estimated delivery: ${data.shipment.estimatedDelivery}`
      )
    }
  })

  // -------------------------------------------------------------------------
  // Order Failure & Cancellation
  // -------------------------------------------------------------------------
  $.on.Order.failed(async (data: { orderId: string; reason: string }, $: WorkflowContext) => {
    const order = $.state.currentOrder as Order
    const customer = customers.get(order.customerId)

    $.log(`Order ${data.orderId} failed: ${data.reason}`)
    $.state.orderStatus = 'failed'

    // Notify customer
    if (customer) {
      await emailService.send(
        customer.email,
        `Order Could Not Be Processed - ${data.orderId}`,
        `We're sorry, but your order could not be processed. Reason: ${data.reason}`
      )
    }
  })

  $.on.Order.cancelled(async (data: { orderId: string; reason: string }, $: WorkflowContext) => {
    const order = $.state.currentOrder as Order
    $.log(`Order ${data.orderId} cancelled: ${data.reason}`)

    // Compensation: Release inventory
    if ($.state.inventoryReserved) {
      await inventoryService.release(order.items)
      $.state.inventoryReserved = false
    }

    // Compensation: Refund payment
    if ($.state.transactionId) {
      await paymentService.refund($.state.transactionId as string, order.total)
      $.state.transactionId = null
    }

    $.state.orderStatus = 'cancelled'

    const customer = customers.get(order.customerId)
    if (customer) {
      await emailService.send(
        customer.email,
        `Order Cancelled - ${data.orderId}`,
        `Your order has been cancelled. Any charges will be refunded within 3-5 business days.`
      )
    }
  })
})

// ============================================================================
// Demo Execution
// ============================================================================

async function runDemo() {
  console.log('='.repeat(60))
  console.log('E-commerce Order Processing Pipeline Demo')
  console.log('='.repeat(60))
  console.log()

  // Start the workflow
  await orderWorkflow.start()

  // Place a test order
  const testOrder: Order = {
    id: 'ORD_001',
    customerId: 'cust_1',
    items: [
      { sku: 'WIDGET-001', quantity: 2, price: 29.99 },
      { sku: 'GADGET-002', quantity: 1, price: 49.99 },
    ],
    total: 109.97,
    shippingAddress: '123 Main St, San Francisco, CA 94102',
    status: 'pending',
  }

  console.log('Placing order:', testOrder.id)
  console.log()

  await orderWorkflow.send('Order.placed', testOrder)

  // Wait for events to propagate
  await new Promise((resolve) => setTimeout(resolve, 100))

  // Display final state
  console.log()
  console.log('-'.repeat(60))
  console.log('Final Workflow State:')
  console.log(JSON.stringify(orderWorkflow.state, null, 2))

  // Clean up
  await orderWorkflow.stop()
}

// Run if executed directly
runDemo().catch(console.error)
