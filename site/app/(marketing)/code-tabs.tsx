import { codeToHtml } from 'shiki';

const codeExamples = {
  business: `import { business, team, process, policy } from 'business-as-code'

const startup = business({
  name: 'acme-corp',

  // Teams of humans and AI
  teams: [
    team({
      name: 'engineering',
      roles: [
        { name: 'engineer', type: 'human', count: 10 },
        { name: 'code-reviewer', type: 'agent', count: 2 },
      ],
    }),
    team({
      name: 'support',
      roles: [
        { name: 'agent', type: 'agent', count: 10, availability: '24/7' },
        { name: 'specialist', type: 'human', count: 3 },
      ],
    }),
  ],

  // Business processes as code
  processes: [hiringProcess, onboardingProcess, incidentResponseProcess],

  // Executable policies
  policies: [
    policy({
      name: 'expense-approval',
      rules: [
        { when: 'amount <= 100', then: 'auto-approve' },
        { when: 'amount > 100', then: 'require-manager' },
        { when: 'amount > 10000', then: 'require-cfo' },
      ],
    }),
  ],

  // Services this business offers
  services: [codeReviewService, supportService],
})`,

  service: `import { service, sla, pricing } from 'services-as-software'

// AI delivering work traditionally done by humans
const codeReviewService = service({
  name: 'code-review',
  description: 'Expert code review for pull requests',

  input: z.object({
    repository: z.string(),
    pullRequest: z.number(),
    reviewType: z.enum(['security', 'performance', 'general']),
  }),

  output: z.object({
    approved: z.boolean(),
    comments: z.array(reviewComment),
    suggestions: z.array(codeSuggestion),
  }),

  implementation: {
    agent: codeReviewAgent,
    escalation: { to: 'senior-engineers', when: 'complexity > 8' },
  },

  sla: sla({
    responseTime: '< 30 minutes',
    accuracy: '> 95%',
    availability: '99.9%',
  }),

  pricing: pricing({
    model: 'per-review',
    base: 5.00,
    modifiers: [{ when: 'reviewType = security', multiply: 2 }],
  }),
})`,

  product: `import { product, api, ui, capability } from 'digital-products'

const supportPortal = product({
  name: 'support-portal',

  capabilities: [
    capability('answer-questions', {
      function: answerQuestions,
      rateLimit: '100/minute',
    }),
    capability('create-ticket', {
      workflow: ticketWorkflow,
      auth: 'authenticated',
    }),
  ],

  interfaces: {
    api: api({
      version: 'v1',
      endpoints: [
        { path: '/ask', method: 'POST', capability: 'answer-questions' },
        { path: '/tickets', method: 'POST', capability: 'create-ticket' },
      ],
    }),
    widget: ui({
      type: 'embedded-widget',
      component: 'ChatWidget',
    }),
  },

  tenancy: {
    type: 'organization',
    tiers: { free: { users: 5 }, pro: { users: 50 } },
  },
})

await supportPortal.deploy({ region: 'us-east-1' })`,

  agent: `import { agent, capability, memory } from 'autonomous-agents'

const supportAgent = agent({
  name: 'support-agent',

  // Real identity in your systems
  identity: {
    email: 'support@company.com',
    slack: '@support-agent',
    phone: '+1-555-0123',
  },

  capabilities: [answerQuestions, createTicket, escalateToHuman],

  // Long-term memory
  memory: {
    type: 'persistent',
    includes: ['conversations', 'customer-preferences'],
  },

  // Autonomous decision making
  autonomy: {
    canDo: ['answer-common-questions', 'create-tickets'],
    escalateWhen: ['confidence < 0.7', 'sentiment = angry', 'topic = refund'],
  },

  // Safety guardrails
  guardrails: {
    neverMention: ['competitor-names'],
    maxActionsPerHour: 100,
  },
})

await supportAgent.deploy()`,

  human: `import { human, approval, review, escalation } from 'human-in-the-loop'

// Approval gates in workflows
const managerApproval = human.approval({
  name: 'expense-approval',
  assignTo: ({ input }) => input.requester.manager,
  timeout: '48h',
  escalateTo: 'department-head',
})

// Review cycles with iterations
const editorialReview = human.review({
  name: 'content-review',
  assignTo: { role: 'editor' },
  actions: ['approve', 'request-changes', 'reject'],
  maxIterations: 3,
  onRequestChanges: (feedback) => regenerateContent(feedback),
})

// AI handles routine, humans handle exceptions
const supportEscalation = human.escalation({
  when: ['confidence < 0.7', 'customer.tier = enterprise', 'topic in [refund, legal]'],
  assignTo: { role: 'specialist' },
  context: ['conversation', 'aiAnalysis'],
})

// Human + AI collaboration
const assistedReview = human.assisted({
  name: 'assisted-review',
  aiAssist: { suggestions: true, factCheck: true },
  humanDecides: { finalApproval: true },
})`,

  task: `import { task, queue, assignment } from 'digital-tasks'

const reviewTask = task({
  name: 'review-document',

  input: z.object({
    documentId: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']),
  }),

  output: z.object({
    approved: z.boolean(),
    comments: z.array(z.string()),
  }),

  // Dynamic assignment based on input
  assignment: assignment.dynamic(({ input }) => ({
    role: input.priority === 'urgent' ? 'senior-reviewer' : 'reviewer',
  })),

  // SLA based on priority
  deadline: ({ input }) => (input.priority === 'urgent' ? '4h' : '24h'),

  // Lifecycle hooks
  onOverdue: async (task) => {
    await escalate(task)
    await notify(task.assignee.manager)
  },
})

// Queue management
const reviewQueue = queue({
  name: 'review-queue',
  prioritization: ['priority', 'waitTime'],
  maxPerAssignee: 5,
})`,

  workflow: `import { workflow, step, stateMachine } from 'ai-workflows'

// Durable execution - survives failures
const onboarding = workflow({
  name: 'customer-onboarding',
  execute: async (ctx, customer) => {
    const account = await step('create-account', () => createAccount(customer))

    await step('send-welcome', () => sendEmail(customer.email, welcomeTemplate))

    // Wait for human verification
    const kyc = await step('kyc-check', () =>
      humanTask({ type: 'kyc-review', data: customer })
    )

    await ctx.sleep('30d') // Workflow pauses, no resources consumed

    await step('followup', () => sendFollowup(customer))

    return { account, kyc }
  },
})

// Or use state machines for complex flows
const orderMachine = stateMachine({
  initial: 'pending',
  states: {
    pending: { on: { PAY: 'processing' } },
    processing: { on: { SHIP: 'shipped' } },
    shipped: { on: { DELIVER: 'completed' } },
  },
})`,

  database: `import { database, table, column } from 'ai-database'

const db = database({
  name: 'my-app',
  tables: {
    documents: table({
      id: column.id(),
      title: column.string(),
      content: column.text(),
      embedding: column.vector(1536), // For semantic search
      createdAt: column.timestamp(),
    }),
  },
})

// Type-safe queries
const docs = await db.documents.findMany({
  where: { createdAt: { gt: lastWeek } },
  select: ['id', 'title'],
})

// Semantic search with vectors
const relevant = await db.documents.findSimilar({
  vector: await embed('quarterly revenue'),
  limit: 5,
  threshold: 0.8,
})

// Hybrid: structured + semantic
const results = await db.documents.findSimilar({
  vector: queryEmbedding,
  where: { authorId: currentUser.id },
})`,

  function: `import { fn } from 'ai-functions'

// Code function - deterministic
const calculateTotal = fn.code({
  name: 'calculate-total',
  execute: ({ items }) => items.reduce((sum, i) => sum + i.price, 0),
})

// Generative function - AI-powered
const summarize = fn.generative({
  name: 'summarize',
  model: 'claude-sonnet-4-20250514',
  prompt: ({ text }) => \`Summarize: \${text}\`,
})

// Agentic function - autonomous reasoning
const research = fn.agentic({
  name: 'research',
  tools: [webSearch, readDocument, extractData],
  maxIterations: 10,
})

// Human function - human-in-the-loop
const approve = fn.human({
  name: 'approve',
  assignTo: { role: 'manager' },
  ui: 'approval-form',
})

// All share the same interface
await calculateTotal.invoke({ items })
await summarize.invoke({ text })
await research.invoke({ topic })
await approve.invoke({ request })`,
};

const tabs = ['business', 'service', 'product', 'agent', 'human', 'task', 'workflow', 'database', 'function'] as const;

async function highlightCode(code: string) {
  return codeToHtml(code, {
    lang: 'typescript',
    theme: 'github-dark',
    transformers: [
      {
        line(node, line) {
          node.properties['data-line'] = line;
        },
      },
    ],
  });
}

async function CodeBlock({ code }: { code: string }) {
  const html = await highlightCode(code);
  return (
    <div
      className="text-sm leading-relaxed [&_pre]:!bg-transparent [&_pre]:!p-0 [&_code]:!bg-transparent"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

import { CodeTabsClient } from './code-tabs-client';

export async function CodeTabs() {
  // Pre-render all code blocks on server
  const highlightedCode: Record<string, string> = {};
  for (const tab of tabs) {
    highlightedCode[tab] = await highlightCode(codeExamples[tab]);
  }

  return <CodeTabsClient tabs={tabs} highlightedCode={highlightedCode} />;
}
