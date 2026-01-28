# Expense Approval Example

A complete **human-in-the-loop** workflow example demonstrating how to integrate AI analysis with human approval using the AI Primitives stack.

## Overview

This example implements an expense approval workflow that:

1. **Submits** an expense for approval
2. **Analyzes** the expense using AI to determine risk level
3. **Routes** high-risk expenses to human approvers via Slack or Email
4. **Handles** human approval/rejection responses
5. **Completes** the workflow with a full audit trail

## Architecture

```
                    +------------------+
                    |  ExpenseWorkflow |
                    +--------+---------+
                             |
         +-------------------+-------------------+
         |                   |                   |
         v                   v                   v
+--------+-------+  +--------+-------+  +--------+-------+
| ExpenseAnalyzer|  | ApprovalRouter |  |  HumanStore   |
|  (AI Analysis) |  | (Slack/Email)  |  |  (State Mgmt) |
+----------------+  +----------------+  +----------------+
         |                   |                   |
         v                   v                   v
   ai-functions       digital-workers    human-in-the-loop
```

## Quick Start

```typescript
import {
  createExpenseWorkflow,
  type ExpenseSubmission
} from '@ai-primitives/examples/expense-approval'

// Create workflow instance
const workflow = createExpenseWorkflow({
  mockMode: false, // Use real transports
  slackBotToken: process.env.SLACK_BOT_TOKEN,
  defaultChannel: 'slack',
})

// Create expense submission
const expense: ExpenseSubmission = {
  id: 'exp-001',
  amountCents: 15000, // $150.00
  currency: 'USD',
  category: 'travel',
  description: 'Flight to NYC for client meeting',
  submittedBy: 'alice@company.com',
  submittedAt: new Date(),
  vendor: 'United Airlines',
  receipt: 'https://receipts.example.com/exp-001.pdf',
  project: 'CLIENT-001',
}

// Run complete workflow
const result = await workflow.run(expense)

console.log(`Status: ${result.status}`)
console.log(`Risk Level: ${result.analysis.riskLevel}`)
if (result.approval) {
  console.log(`Approved by: ${result.approval.approvedBy}`)
}
```

## Step-by-Step Usage

For more control, you can run each step individually:

```typescript
const workflow = createExpenseWorkflow({ mockMode: true })

// Step 1: Submit expense
const { requestId } = await workflow.submit(expense)

// Step 2: AI analysis
const analysis = await workflow.analyze(requestId)
console.log(`Risk: ${analysis.riskLevel}, Suggested: ${analysis.suggestedAction}`)

// Step 3: Route to approver (if needed)
if (analysis.requiresHumanReview) {
  const delivery = await workflow.routeToApprover(requestId, 'slack')
  console.log(`Sent to approver: ${delivery.success}`)
}

// Step 4: Handle human response (from webhook)
await workflow.handleResponse(requestId, {
  approved: true,
  approvedBy: 'manager@company.com',
  approvedAt: new Date(),
  comments: 'Looks good!',
  approvalChannel: 'slack',
})

// Step 5: Complete workflow
const result = await workflow.complete(requestId)
console.log(`Final status: ${result.status}`)
console.log(`Processing time: ${result.processingTimeMs}ms`)
```

## Components

### ExpenseAnalyzer

Analyzes expenses for risk and determines if human review is needed.

```typescript
import { analyzeExpense, createExpenseAnalyzer } from './analyzer'

// Simple usage
const analysis = await analyzeExpense(expense)

// Custom configuration
const analyzer = createExpenseAnalyzer({
  policy: {
    autoApproveMaxCents: 10000, // $100
    humanReviewMinCents: 100000, // $1000
  },
})
const analysis = await analyzer.analyze(expense)
```

**Risk Factors Detected:**
- Missing receipt for expenses over $25
- Missing vendor information
- Suspiciously round amounts
- Amounts just under reporting thresholds
- Vague descriptions
- Weekend submissions
- High-value expenses (over $5,000)
- No project assignment

### ApprovalRouter

Routes approval requests to humans via Slack or Email.

```typescript
import { createApprovalRouter, routeToApprover } from './router'

// Simple usage
const result = await routeToApprover({
  requestId: 'req-001',
  expense,
  analysis,
  approvers: ['manager@company.com'],
  channel: 'slack',
})

// With configuration
const router = createApprovalRouter({
  slackBotToken: process.env.SLACK_BOT_TOKEN,
  emailApiKey: process.env.RESEND_API_KEY,
  mockMode: false,
})

const result = await router.route(request)
```

### ExpenseWorkflow

Orchestrates the complete workflow with state management.

```typescript
import { createExpenseWorkflow } from './workflow'

const workflow = createExpenseWorkflow({
  mockMode: true,
  defaultChannel: 'slack',
  onEvent: (event) => {
    console.log(`[${event.type}] by ${event.actor}`)
  },
})
```

## Type Definitions

All types are exported for reuse:

```typescript
import type {
  ExpenseSubmission,
  ExpenseAnalysis,
  ApprovalResponse,
  WorkflowResult,
  WorkflowEvent,
  ExpensePolicy,
} from './types'
```

See [types.ts](./types.ts) for complete type documentation.

## Testing

The example includes a mock client for E2E testing:

```typescript
import { createMockHumanApprovalClient } from './workflow'

// Use in tests
const client = createMockHumanApprovalClient()

const { requestId } = await client.submitExpense(expense)
const analysis = await client.analyzeExpense(expense)
await client.routeToApprover(requestId, expense, analysis, 'slack')
await client.simulateHumanResponse(requestId, { approved: true, ... })
const result = await client.completeWorkflow(requestId)
```

## Integration with E2E Test Suite

This example is tested by the `human-approval.suite.ts` E2E test suite:

```typescript
import { createHumanApprovalTests } from '@ai-primitives/e2e/suites'
import { createMockHumanApprovalClient } from './workflow'

const suite = createHumanApprovalTests(() => ({
  humanApproval: createMockHumanApprovalClient(),
}))
```

## Configuration

### Expense Policy

```typescript
const policy: ExpensePolicy = {
  // Max amount for automatic approval ($50)
  autoApproveMaxCents: 5000,

  // Min amount requiring human review ($500)
  humanReviewMinCents: 50000,

  // Categories that always need review
  alwaysReviewCategories: ['equipment', 'services'],

  // Max risk score for auto-approval
  maxAutoApproveRiskScore: 20,

  // Default approvers
  defaultApprovers: ['manager@company.com'],

  // Escalation timeout (24 hours)
  escalationTimeoutMs: 24 * 60 * 60 * 1000,
}
```

### Transport Configuration

For real deployments, configure the transports:

```typescript
const workflow = createExpenseWorkflow({
  mockMode: false,

  // Slack configuration
  slackBotToken: process.env.SLACK_BOT_TOKEN,

  // Email configuration (Resend)
  emailApiKey: process.env.RESEND_API_KEY,
})
```

## Audit Trail

Every workflow produces a complete audit trail:

```typescript
const result = await workflow.complete(requestId)

for (const event of result.auditTrail) {
  console.log(`[${event.timestamp}] ${event.type} by ${event.actor}`)
  if (event.details) {
    console.log(`  Details: ${JSON.stringify(event.details)}`)
  }
}
```

Example output:
```
[2024-01-15T10:00:00Z] submitted by alice@company.com
  Details: {"expenseId":"exp-001","amount":15000,"category":"travel"}
[2024-01-15T10:00:01Z] analyzed by system:ai-analyzer
  Details: {"riskLevel":"medium","riskScore":35,"suggestedAction":"human_review"}
[2024-01-15T10:00:02Z] routed by system:router
  Details: {"channel":"slack","approvers":["manager@company.com"],"delivered":true}
[2024-01-15T10:05:00Z] approved by manager@company.com
  Details: {"approved":true,"comments":"Looks good!","channel":"slack"}
```

## Related Packages

- [`ai-functions`](../../../ai-functions) - AI generation and analysis
- [`digital-workers`](../../../digital-workers) - Worker routing and transports
- [`human-in-the-loop`](../../../human-in-the-loop) - Human approval management

## License

MIT
