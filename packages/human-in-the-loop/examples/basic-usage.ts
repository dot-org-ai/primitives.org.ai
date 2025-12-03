/**
 * Basic usage examples for human-in-the-loop
 *
 * This file demonstrates common patterns and use cases
 */

import {
  Human,
  Role,
  Team,
  Goals,
  approve,
  ask,
  decide,
  notify,
  kpis,
  okrs,
  registerHuman,
  type HumanType,
  type ApprovalResponse,
} from '../src/index.js'

// ============================================================================
// Setup: Define roles, teams, and humans
// ============================================================================

// Define roles
const techLead = Role({
  id: 'tech-lead',
  name: 'Tech Lead',
  description: 'Technical leadership and architecture decisions',
  capabilities: ['approve-prs', 'deploy-prod', 'review-code'],
  escalatesTo: 'engineering-manager',
})

const engineer = Role({
  id: 'engineer',
  name: 'Software Engineer',
  description: 'Software development',
  capabilities: ['write-code', 'review-code'],
  escalatesTo: 'tech-lead',
})

// Define teams
const engineeringTeam = Team({
  id: 'engineering',
  name: 'Engineering Team',
  description: 'Product development team',
  members: ['alice', 'bob', 'charlie'],
  lead: 'alice',
})

// Register humans
const alice: HumanType = registerHuman({
  id: 'alice',
  name: 'Alice Smith',
  email: 'alice@example.com',
  roles: ['tech-lead'],
  teams: ['engineering'],
  channels: {
    slack: '@alice',
    email: 'alice@example.com',
    web: true,
  },
})

const bob: HumanType = registerHuman({
  id: 'bob',
  name: 'Bob Johnson',
  email: 'bob@example.com',
  roles: ['engineer'],
  teams: ['engineering'],
  channels: {
    slack: '@bob',
    email: 'bob@example.com',
  },
})

// ============================================================================
// Example 1: Approval workflow
// ============================================================================

async function approvalExample() {
  console.log('=== Approval Example ===\n')

  try {
    // Request approval for production deployment
    const deployment: ApprovalResponse = await approve({
      title: 'Production Deployment',
      description: 'Deploy version 2.0.0 to production',
      subject: 'Production Deployment - v2.0.0',
      input: {
        version: '2.0.0',
        environment: 'production',
        changes: ['New AI features', 'Performance improvements', 'Bug fixes'],
      },
      assignee: alice.email,
      priority: 'high',
      timeout: 3600000, // 1 hour
      escalatesTo: 'engineering-manager',
    })

    if (deployment.approved) {
      console.log('✅ Deployment approved!')
      console.log('Comments:', deployment.comments)

      // Proceed with deployment
      await deploy()

      // Send success notification
      await notify({
        type: 'success',
        title: 'Deployment Complete',
        message: 'Version 2.0.0 successfully deployed to production',
        recipient: [alice.email!, engineeringTeam.id],
        channels: ['slack', 'email'],
        priority: 'normal',
      })
    } else {
      console.log('❌ Deployment rejected')
      console.log('Reason:', deployment.comments)
    }
  } catch (error) {
    console.error('Approval failed:', error)
  }
}

// ============================================================================
// Example 2: Ask a question
// ============================================================================

async function questionExample() {
  console.log('\n=== Question Example ===\n')

  try {
    const answer = await ask({
      title: 'Product Naming Decision',
      question: 'What should we name the new AI assistant feature?',
      context: {
        feature: 'AI-powered code assistant',
        targetAudience: 'developers',
        competitors: ['GitHub Copilot', 'Cursor', 'Tabnine'],
      },
      assignee: 'product-manager@example.com',
      suggestions: ['CodeMate', 'DevAssist', 'SmartCode', 'AIHelper'],
      priority: 'normal',
    })

    console.log('Answer received:', answer)
  } catch (error) {
    console.error('Question failed:', error)
  }
}

// ============================================================================
// Example 3: Decision with options
// ============================================================================

async function decisionExample() {
  console.log('\n=== Decision Example ===\n')

  try {
    const strategy = await decide({
      title: 'Deployment Strategy',
      description: 'Choose the deployment strategy for the new release',
      options: ['blue-green', 'canary', 'rolling', 'all-at-once'],
      context: {
        riskLevel: 'high',
        activeUsers: 100000,
        deploymentWindow: '2 hours',
        rollbackTime: '5 minutes',
      },
      criteria: [
        'Minimize risk to users',
        'Enable fast rollback',
        'Complete within deployment window',
      ],
      assignee: alice.email,
      priority: 'high',
    })

    console.log('Selected strategy:', strategy)
  } catch (error) {
    console.error('Decision failed:', error)
  }
}

// ============================================================================
// Example 4: Goals and OKRs
// ============================================================================

function goalsExample() {
  console.log('\n=== Goals and OKRs Example ===\n')

  // Define team goals
  const q1Goals = Goals({
    id: 'engineering-q1-2024',
    objectives: [
      'Launch AI assistant v2.0',
      'Improve system performance by 50%',
      'Reduce bug count by 40%',
    ],
    successCriteria: [
      'Release by March 31',
      'Pass all performance benchmarks',
      'Achieve customer satisfaction score of 4.5+',
    ],
    targetDate: new Date('2024-03-31'),
  })

  console.log('Q1 Goals:', q1Goals)

  // Define OKRs
  const q1OKRs = okrs({
    id: 'engineering-okrs-q1-2024',
    objective: 'Build world-class AI development tools',
    keyResults: [
      {
        description: 'Increase active users by 50%',
        progress: 0.3,
        current: 13000,
        target: 15000,
      },
      {
        description: 'Achieve 95% uptime',
        progress: 0.92,
        current: 0.95,
        target: 0.95,
      },
      {
        description: 'Reduce average response time to <100ms',
        progress: 0.75,
        current: 120,
        target: 100,
      },
    ],
    period: 'Q1 2024',
    owner: alice.email,
  })

  console.log('Q1 OKRs:', q1OKRs)

  // Track KPIs
  const performanceKPI = kpis({
    id: 'api-response-time',
    name: 'API Response Time',
    value: 120,
    target: 100,
    unit: 'ms',
    trend: 'down',
  })

  console.log('Performance KPI:', performanceKPI)
}

// ============================================================================
// Example 5: Using Human instance for advanced operations
// ============================================================================

async function advancedExample() {
  console.log('\n=== Advanced Example ===\n')

  // Create a custom Human instance with specific configuration
  const human = Human({
    defaultTimeout: 7200000, // 2 hours
    defaultPriority: 'high',
    autoEscalate: true,
    escalationPolicies: [
      {
        id: 'critical-approval',
        name: 'Critical Approval Policy',
        conditions: {
          timeout: 1800000, // 30 minutes
          minPriority: 'critical',
        },
        escalationPath: [
          {
            assignee: 'tech-lead',
            afterMs: 1800000, // 30 minutes
            notifyVia: ['slack', 'sms'],
          },
          {
            assignee: 'engineering-manager',
            afterMs: 3600000, // 1 hour
            notifyVia: ['slack', 'email', 'sms'],
          },
          {
            assignee: 'cto',
            afterMs: 7200000, // 2 hours
            notifyVia: ['slack', 'email', 'sms'],
          },
        ],
      },
    ],
  })

  // Create an approval workflow
  const deploymentWorkflow = human.createWorkflow({
    id: 'prod-deployment-workflow',
    name: 'Production Deployment Workflow',
    steps: [
      {
        name: 'Code Review',
        role: 'engineer',
        approvers: [bob.id],
        requireAll: true,
      },
      {
        name: 'Security Review',
        role: 'security-engineer',
        approvers: ['security-team'],
        requireAll: false,
      },
      {
        name: 'Tech Lead Approval',
        role: 'tech-lead',
        approvers: [alice.id],
        requireAll: true,
      },
    ],
    currentStep: 0,
    status: 'pending',
  })

  console.log('Created workflow:', deploymentWorkflow)

  // Get the review queue
  const queue = await human.getQueue({
    name: 'High Priority Queue',
    description: 'All high priority pending requests',
    filters: {
      status: ['pending', 'in_progress'],
      priority: ['high', 'critical'],
    },
    sortBy: 'priority',
    sortDirection: 'desc',
    limit: 10,
  })

  console.log('Queue:', queue.name, 'Items:', queue.items.length)
}

// ============================================================================
// Mock deployment function
// ============================================================================

async function deploy() {
  console.log('🚀 Deploying to production...')
  // Simulate deployment
  await new Promise((resolve) => setTimeout(resolve, 100))
  console.log('✅ Deployment successful!')
}

// ============================================================================
// Run examples
// ============================================================================

async function main() {
  console.log('Human-in-the-Loop Examples\n')
  console.log('Note: These examples demonstrate the API.')
  console.log('Actual human responses would need to be provided via the store.\n')

  // Run examples (most will timeout or error without actual human responses)
  // In a real system, humans would respond via UI, webhooks, or API calls

  goalsExample()

  // Uncomment to test async examples (they will wait for human responses)
  // await approvalExample()
  // await questionExample()
  // await decisionExample()
  // await advancedExample()
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export {
  approvalExample,
  questionExample,
  decisionExample,
  goalsExample,
  advancedExample,
}
