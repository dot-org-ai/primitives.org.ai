/**
 * API Business Example
 *
 * A complete example of a developer-focused API business modeled using primitives.org.ai
 * Think: Stripe, Twilio, SendGrid, Algolia
 *
 * @example APIHub - A unified API gateway for third-party integrations
 * @packageDocumentation
 */

/**
 * NOTE: These examples demonstrate the DESIRED API shape for business-as-code.
 * Some types may not exist yet in the actual package. The examples serve as
 * documentation and specification for the ideal primitives API.
 */

// Use any for flexibility - these examples define the ideal API shape
const Business = (def: any) => def
const Product = (def: any) => def
const Service = (def: any) => def
const Goals = (defs: any[]) => defs
const Vision = (def: any) => def
const kpis = (defs: any[]) => defs
const okrs = (defs: any[]) => defs
const financials = (def: any) => def
const Process = (def: any) => def
const Workflow = (def: any) => def
const createBusinessRole = (def: any) => def

// Re-export Organization type placeholder
export interface Organization {
  id: string
  name: string
  settings?: any
  departments?: any[]
  teams?: any[]
  roles?: any[]
  approvalChains?: any[]
  routingRules?: any[]
}

// $ helper placeholder
const $ = {
  format: (n: number) => `$${n.toLocaleString()}`,
  growth: (current: number, previous: number) => ((current - previous) / previous * 100).toFixed(1),
  margin: (revenue: number, cost: number) => ((revenue - cost) / revenue * 100).toFixed(1),
}

// =============================================================================
// 1. BUSINESS DEFINITION
// =============================================================================

/**
 * APIHub - Unified API Gateway Platform
 */
export const APIHubBusiness = Business({
  name: 'APIHub Inc.',
  mission: 'Make API integrations simple, reliable, and scalable for every developer',
  values: ['Developer Experience', 'Reliability', 'Transparency', 'Security'],
  industry: 'Developer Tools / API Infrastructure',
  founded: new Date('2021-06-01'),
  stage: 'growth',
  structure: {
    departments: [
      {
        name: 'Engineering',
        headcount: 40,
        budget: 6000000,
        teams: [
          { name: 'API Platform', headcount: 12, focus: 'Core API infrastructure' },
          { name: 'Gateway', headcount: 8, focus: 'API gateway & routing' },
          { name: 'Integrations', headcount: 10, focus: 'Third-party connectors' },
          { name: 'Infrastructure', headcount: 6, focus: 'Cloud & reliability' },
          { name: 'Security', headcount: 4, focus: 'API security & compliance' },
        ],
      },
      {
        name: 'Product',
        headcount: 8,
        budget: 1200000,
        teams: [
          { name: 'Product Management', headcount: 4 },
          { name: 'Developer Experience', headcount: 2, focus: 'SDKs, docs, DX' },
          { name: 'Design', headcount: 2 },
        ],
      },
      {
        name: 'Developer Relations',
        headcount: 6,
        budget: 800000,
        teams: [
          { name: 'DevRel', headcount: 4, focus: 'Community & advocacy' },
          { name: 'Technical Writing', headcount: 2 },
        ],
      },
      {
        name: 'Sales',
        headcount: 10,
        budget: 1500000,
        teams: [
          { name: 'Enterprise Sales', headcount: 5 },
          { name: 'Self-Serve Growth', headcount: 3 },
          { name: 'Solutions Engineering', headcount: 2 },
        ],
      },
      {
        name: 'Support',
        headcount: 8,
        budget: 700000,
        teams: [
          { name: 'Technical Support', headcount: 5 },
          { name: 'Success Engineering', headcount: 3 },
        ],
      },
    ],
  },
})

// =============================================================================
// 2. VISION & GOALS
// =============================================================================

export const APIHubVision = Vision({
  statement: 'Power the connected economy by being the universal API layer for businesses',
  timeHorizon: '2028',
  pillars: [
    'Developer Experience Excellence',
    'Platform Reliability',
    'Integration Ecosystem',
    'Enterprise Security',
  ],
  successIndicators: [
    { name: 'API Calls/Month', target: 100000000000, unit: 'calls' },
    { name: 'Active Developers', target: 500000 },
    { name: 'Enterprise Customers', target: 2000 },
    { name: 'Platform Uptime', target: 99.99, unit: '%' },
  ],
})

export const APIHubGoals = Goals([
  {
    name: 'Reach 10B Monthly API Calls',
    category: 'product',
    status: 'in-progress',
    progress: 65,
    dueDate: new Date('2024-12-31'),
    owner: 'VP Engineering',
  },
  {
    name: 'Launch 50 New Integrations',
    category: 'product',
    status: 'in-progress',
    progress: 40,
    dueDate: new Date('2024-06-30'),
    owner: 'Integrations Lead',
  },
  {
    name: 'Achieve SOC 2 Type II',
    category: 'operational',
    status: 'in-progress',
    progress: 75,
    dueDate: new Date('2024-03-31'),
    owner: 'Security Lead',
  },
  {
    name: 'Grow Developer Community to 100K',
    category: 'growth',
    status: 'in-progress',
    progress: 55,
    dueDate: new Date('2024-09-30'),
    owner: 'DevRel Lead',
  },
  {
    name: '$20M ARR',
    category: 'financial',
    status: 'in-progress',
    progress: 70,
    dueDate: new Date('2024-12-31'),
    owner: 'CEO',
  },
])

// =============================================================================
// 3. PRODUCTS & PRICING
// =============================================================================

/**
 * Core API Products
 */
export const APIGateway = Product({
  name: 'APIHub Gateway',
  description: 'Unified API gateway with routing, rate limiting, and analytics',
  pricingModel: 'usage-based',
  features: [
    'API routing & load balancing',
    'Rate limiting & throttling',
    'Request/response transformation',
    'Analytics & monitoring',
    'API versioning',
    'Caching',
    'Circuit breaker',
  ],
  roadmap: [
    { name: 'GraphQL Support', status: 'in-progress', priority: 'high', targetDate: new Date('2024-Q1') },
    { name: 'gRPC Gateway', status: 'planned', priority: 'medium', targetDate: new Date('2024-Q2') },
    { name: 'AI-Powered Rate Limiting', status: 'planned', priority: 'medium', targetDate: new Date('2024-Q3') },
  ],
})

export const IntegrationsHub = Product({
  name: 'Integrations Hub',
  description: 'Pre-built connectors to 200+ third-party APIs',
  pricingModel: 'subscription',
  features: [
    '200+ pre-built integrations',
    'Unified data models',
    'Webhook management',
    'OAuth flow handling',
    'Data transformation',
    'Error handling & retries',
  ],
})

export const APIAnalytics = Product({
  name: 'API Analytics',
  description: 'Real-time API monitoring, debugging, and insights',
  pricingModel: 'usage-based',
  features: [
    'Real-time dashboards',
    'Request tracing',
    'Error analysis',
    'Performance metrics',
    'Usage patterns',
    'Alerting',
  ],
})

/**
 * Usage-based Pricing
 */
export const Pricing = {
  free: {
    name: 'Free',
    monthlyApiCalls: 10000,
    price: 0,
    features: ['10K API calls/month', 'Community support', '5 integrations'],
  },
  developer: {
    name: 'Developer',
    monthlyApiCalls: 1000000,
    price: 49, // base
    overage: 0.0001, // per call over limit
    features: ['1M API calls/month', 'Email support', '50 integrations', 'Analytics'],
  },
  team: {
    name: 'Team',
    monthlyApiCalls: 10000000,
    price: 299, // base
    overage: 0.00005, // per call over limit
    features: ['10M API calls/month', 'Priority support', 'All integrations', 'Team management'],
  },
  enterprise: {
    name: 'Enterprise',
    monthlyApiCalls: 'unlimited',
    price: 'custom',
    features: ['Unlimited API calls', 'Dedicated support', 'SLA', 'SSO', 'Custom integrations', 'VPC deployment'],
  },
}

/**
 * Calculate monthly bill for usage
 */
export function calculateMonthlyBill(plan: keyof typeof Pricing, apiCalls: number): number {
  const pricing = Pricing[plan]
  if (pricing.price === 'custom' || pricing.price === 0) return pricing.price === 0 ? 0 : -1

  const base = pricing.price as number
  const limit = pricing.monthlyApiCalls as number
  const overage = 'overage' in pricing ? pricing.overage as number : 0

  if (apiCalls <= limit) return base
  return base + (apiCalls - limit) * overage
}

// =============================================================================
// 4. ORGANIZATION & ROLES
// =============================================================================

export const APIHubOrg: Organization = {
  id: 'apihub',
  name: 'APIHub Inc.',
  settings: {
    timezone: 'America/New_York',
    currency: 'USD',
    fiscalYearStart: 1,
  },
  departments: [
    {
      id: 'engineering',
      name: 'Engineering',
      permissions: {
        code: ['read', 'write', 'deploy'],
        infrastructure: ['read', 'write', 'manage'],
        api: ['read', 'write', 'manage'],
      },
      teams: [
        {
          id: 'api-platform',
          name: 'API Platform',
          positions: [
            { id: 'api-lead', title: 'API Platform Lead', roleId: 'staff-engineer', reportsTo: 'eng-vp' },
            { id: 'api-eng-1', title: 'Senior API Engineer', roleId: 'senior-engineer', reportsTo: 'api-lead' },
            { id: 'api-eng-2', title: 'API Engineer', roleId: 'engineer', reportsTo: 'api-lead' },
          ],
        },
        {
          id: 'integrations',
          name: 'Integrations',
          positions: [
            { id: 'int-lead', title: 'Integrations Lead', roleId: 'senior-engineer', reportsTo: 'eng-vp' },
          ],
        },
        {
          id: 'sre',
          name: 'Site Reliability',
          positions: [
            { id: 'sre-lead', title: 'SRE Lead', roleId: 'sre', reportsTo: 'eng-vp' },
          ],
        },
      ],
    },
    {
      id: 'devrel',
      name: 'Developer Relations',
      permissions: {
        docs: ['read', 'write', 'publish'],
        community: ['read', 'write', 'moderate'],
        content: ['read', 'write', 'publish'],
      },
    },
  ],
  roles: [
    createBusinessRole({
      id: 'staff-engineer',
      name: 'Staff Engineer',
      type: 'engineer',
      level: 7,
      permissions: {
        code: ['read', 'write', 'review', 'merge', 'deploy'],
        architecture: ['read', 'write', 'approve'],
        oncall: ['read', 'write', 'escalate'],
      },
      canHandle: ['architecture', 'incident-commander', 'code-review'],
      canApprove: ['architecture-decision', 'major-release'],
    }),
    createBusinessRole({
      id: 'senior-engineer',
      name: 'Senior Engineer',
      type: 'engineer',
      level: 5,
      permissions: {
        code: ['read', 'write', 'review', 'merge'],
        deployments: ['read', 'write'],
      },
      canHandle: ['coding', 'code-review', 'feature-design'],
      canApprove: ['pull-request'],
    }),
    createBusinessRole({
      id: 'engineer',
      name: 'Engineer',
      type: 'engineer',
      level: 3,
      permissions: {
        code: ['read', 'write'],
        deployments: ['read'],
      },
      canHandle: ['coding', 'bug-fix'],
    }),
    createBusinessRole({
      id: 'sre',
      name: 'Site Reliability Engineer',
      type: 'engineer',
      level: 5,
      permissions: {
        infrastructure: ['read', 'write', 'manage'],
        deployments: ['read', 'write', 'rollback'],
        oncall: ['read', 'write', 'escalate'],
      },
      canHandle: ['incident-response', 'capacity-planning', 'deployment'],
    }),
    createBusinessRole({
      id: 'devrel',
      name: 'Developer Advocate',
      type: 'support',
      level: 4,
      permissions: {
        docs: ['read', 'write', 'publish'],
        community: ['read', 'write', 'moderate'],
        samples: ['read', 'write', 'publish'],
      },
      canHandle: ['documentation', 'sample-code', 'community-support', 'conference-talk'],
    }),
    createBusinessRole({
      id: 'solutions-engineer',
      name: 'Solutions Engineer',
      type: 'support',
      level: 5,
      permissions: {
        customers: ['read', 'write'],
        code: ['read'],
        integrations: ['read', 'write'],
      },
      canHandle: ['technical-demo', 'poc', 'integration-support', 'architecture-review'],
    }),
    createBusinessRole({
      id: 'support-bot',
      name: 'Support Bot',
      type: 'agent',
      level: 1,
      workerType: 'ai',
      permissions: {
        docs: ['read'],
        customers: ['read'],
        support: ['read', 'write'],
      },
      canHandle: ['documentation-query', 'status-check', 'basic-troubleshooting'],
    }),
  ],
  approvalChains: [
    {
      id: 'api-change',
      name: 'API Change Approval',
      requestType: 'api-change',
      levels: [
        { threshold: 1, approvers: [{ type: 'role', roleId: 'senior-engineer' }] }, // Minor
        { threshold: 2, approvers: [{ type: 'role', roleId: 'staff-engineer' }] }, // Major
        { threshold: 3, approvers: [{ type: 'department-head' }] }, // Breaking
      ],
    },
    {
      id: 'integration-publish',
      name: 'Integration Publish',
      requestType: 'integration-publish',
      levels: [
        { threshold: Infinity, approvers: [{ type: 'role', roleId: 'senior-engineer' }, { type: 'role', roleId: 'devrel' }] },
      ],
    },
  ],
  routingRules: [
    {
      id: 'basic-support',
      taskType: 'documentation-query',
      priority: 1,
      assignTo: { roleId: 'support-bot' },
    },
    {
      id: 'technical-support',
      taskType: 'integration-issue',
      priority: 2,
      assignTo: { roleId: 'solutions-engineer' },
    },
    {
      id: 'incident',
      taskType: 'incident',
      priority: 1,
      assignTo: { roleId: 'sre' },
    },
  ],
}

// =============================================================================
// 5. KPIs & METRICS
// =============================================================================

export const APIHubKPIs = kpis([
  // Platform Metrics
  {
    name: 'Monthly API Calls',
    category: 'operational',
    target: 10000000000,
    current: 6500000000,
    frequency: 'monthly',
    owner: 'VP Engineering',
  },
  {
    name: 'API Uptime',
    category: 'operational',
    target: 99.99,
    current: 99.97,
    unit: '%',
    frequency: 'monthly',
    owner: 'SRE Lead',
  },
  {
    name: 'P99 Latency',
    category: 'operational',
    target: 50,
    current: 45,
    unit: 'ms',
    frequency: 'daily',
    owner: 'API Platform Lead',
  },
  {
    name: 'Error Rate',
    category: 'operational',
    target: 0.1,
    current: 0.08,
    unit: '%',
    frequency: 'daily',
    owner: 'API Platform Lead',
  },
  // Developer Metrics
  {
    name: 'Active Developers',
    category: 'customer',
    target: 100000,
    current: 65000,
    frequency: 'monthly',
    owner: 'DevRel Lead',
  },
  {
    name: 'Developer NPS',
    category: 'customer',
    target: 70,
    current: 65,
    frequency: 'quarterly',
    owner: 'VP Product',
  },
  {
    name: 'Time to First API Call',
    category: 'customer',
    target: 5,
    current: 7,
    unit: 'minutes',
    frequency: 'weekly',
    owner: 'DX Lead',
  },
  {
    name: 'Documentation Coverage',
    category: 'operational',
    target: 100,
    current: 92,
    unit: '%',
    frequency: 'monthly',
    owner: 'Tech Writing Lead',
  },
  // Revenue Metrics
  {
    name: 'MRR',
    category: 'financial',
    target: 1500000,
    current: 1170000,
    unit: 'USD',
    frequency: 'monthly',
    owner: 'CEO',
  },
  {
    name: 'Net Revenue Retention',
    category: 'financial',
    target: 130,
    current: 125,
    unit: '%',
    frequency: 'monthly',
    owner: 'VP Sales',
  },
  {
    name: 'Free to Paid Conversion',
    category: 'sales',
    target: 5,
    current: 3.8,
    unit: '%',
    frequency: 'monthly',
    owner: 'Growth Lead',
  },
])

// =============================================================================
// 6. OKRs
// =============================================================================

export const APIHubOKRs = okrs([
  {
    objective: 'Build the Best Developer Experience in API Tools',
    owner: 'VP Product',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Achieve Time to First API Call under 5 minutes',
        metric: 'TTFAC',
        targetValue: 5,
        currentValue: 7,
        unit: 'minutes',
      },
      {
        description: 'Launch SDK for 5 new languages',
        metric: 'SDKs Launched',
        targetValue: 5,
        currentValue: 2,
      },
      {
        description: 'Reach Developer NPS of 70',
        metric: 'Developer NPS',
        targetValue: 70,
        currentValue: 65,
      },
    ],
  },
  {
    objective: 'Achieve Platform Reliability Excellence',
    owner: 'VP Engineering',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Maintain 99.99% uptime',
        metric: 'Uptime',
        targetValue: 99.99,
        currentValue: 99.97,
        unit: '%',
      },
      {
        description: 'Reduce P99 latency to 30ms',
        metric: 'P99 Latency',
        targetValue: 30,
        currentValue: 45,
        unit: 'ms',
      },
      {
        description: 'Implement multi-region failover',
        metric: 'Regions with Failover',
        targetValue: 3,
        currentValue: 1,
      },
    ],
  },
  {
    objective: 'Expand Integration Ecosystem',
    owner: 'Integrations Lead',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Launch 25 new integrations',
        metric: 'Integrations Launched',
        targetValue: 25,
        currentValue: 12,
      },
      {
        description: 'Achieve 95% integration test coverage',
        metric: 'Test Coverage',
        targetValue: 95,
        currentValue: 82,
        unit: '%',
      },
      {
        description: 'Partner with 5 major API providers',
        metric: 'Partnerships Signed',
        targetValue: 5,
        currentValue: 2,
      },
    ],
  },
  {
    objective: 'Scale Developer Community',
    owner: 'DevRel Lead',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Grow to 100K active developers',
        metric: 'Active Developers',
        targetValue: 100000,
        currentValue: 65000,
      },
      {
        description: 'Publish 50 technical tutorials',
        metric: 'Tutorials Published',
        targetValue: 50,
        currentValue: 28,
      },
      {
        description: 'Speak at 10 developer conferences',
        metric: 'Conference Talks',
        targetValue: 10,
        currentValue: 4,
      },
    ],
  },
])

// =============================================================================
// 7. PROCESSES
// =============================================================================

export const IntegrationDevelopmentProcess = Process({
  name: 'Integration Development',
  description: 'Process for building and launching new API integrations',
  owner: 'Integrations Lead',
  steps: [
    {
      order: 1,
      name: 'API Research',
      description: 'Research target API documentation and capabilities',
      automationLevel: 'manual',
      duration: '2 days',
      owner: 'Integration Engineer',
    },
    {
      order: 2,
      name: 'Schema Design',
      description: 'Design unified schema and data model',
      automationLevel: 'manual',
      duration: '1 day',
      owner: 'Integration Engineer',
    },
    {
      order: 3,
      name: 'Implementation',
      description: 'Build the integration connector',
      automationLevel: 'manual',
      duration: '1 week',
      owner: 'Integration Engineer',
    },
    {
      order: 4,
      name: 'Testing',
      description: 'Write and run integration tests',
      automationLevel: 'semi-automated',
      duration: '2 days',
      owner: 'Integration Engineer',
    },
    {
      order: 5,
      name: 'Documentation',
      description: 'Write API documentation and guides',
      automationLevel: 'manual',
      duration: '1 day',
      owner: 'Technical Writer',
    },
    {
      order: 6,
      name: 'Security Review',
      description: 'Security and compliance review',
      automationLevel: 'manual',
      duration: '2 days',
      owner: 'Security Engineer',
    },
    {
      order: 7,
      name: 'Beta Release',
      description: 'Release to beta customers',
      automationLevel: 'automated',
      duration: '1 week',
    },
    {
      order: 8,
      name: 'GA Release',
      description: 'General availability release',
      automationLevel: 'semi-automated',
      duration: '1 day',
    },
  ],
  metrics: [
    { name: 'Time to Ship', target: 3, unit: 'weeks' },
    { name: 'Test Coverage', target: 95, unit: '%' },
    { name: 'Documentation Completeness', target: 100, unit: '%' },
  ],
})

export const IncidentResponseProcess = Process({
  name: 'Incident Response',
  description: 'Handle production incidents efficiently',
  owner: 'SRE Lead',
  steps: [
    {
      order: 1,
      name: 'Detection',
      description: 'Automated alerting detects incident',
      automationLevel: 'automated',
      duration: '1 minute',
    },
    {
      order: 2,
      name: 'Triage',
      description: 'On-call determines severity',
      automationLevel: 'manual',
      duration: '5 minutes',
      owner: 'SRE On-Call',
    },
    {
      order: 3,
      name: 'Notification',
      description: 'Notify stakeholders based on severity',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 4,
      name: 'Investigation',
      description: 'Root cause analysis',
      automationLevel: 'manual',
      duration: '15 minutes',
      owner: 'SRE On-Call',
    },
    {
      order: 5,
      name: 'Mitigation',
      description: 'Apply fix or workaround',
      automationLevel: 'manual',
      duration: '30 minutes',
      owner: 'SRE On-Call',
    },
    {
      order: 6,
      name: 'Resolution',
      description: 'Confirm service restored',
      automationLevel: 'semi-automated',
      duration: '10 minutes',
    },
    {
      order: 7,
      name: 'Communication',
      description: 'Update status page and notify customers',
      automationLevel: 'semi-automated',
      duration: '5 minutes',
    },
    {
      order: 8,
      name: 'Postmortem',
      description: 'Blameless postmortem within 48 hours',
      automationLevel: 'manual',
      duration: '2 hours',
      owner: 'Incident Commander',
    },
  ],
  metrics: [
    { name: 'MTTD (Mean Time to Detect)', target: 1, unit: 'minutes' },
    { name: 'MTTR (Mean Time to Resolve)', target: 30, unit: 'minutes' },
    { name: 'Postmortem Completion Rate', target: 100, unit: '%' },
  ],
})

export const DeveloperOnboardingProcess = Process({
  name: 'Developer Onboarding',
  description: 'Get developers to first successful API call',
  owner: 'DX Lead',
  steps: [
    {
      order: 1,
      name: 'Signup',
      description: 'Developer creates account',
      automationLevel: 'automated',
      duration: '30 seconds',
    },
    {
      order: 2,
      name: 'API Key Generation',
      description: 'Generate API credentials',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 3,
      name: 'SDK Selection',
      description: 'Choose language SDK',
      automationLevel: 'semi-automated',
      duration: '1 minute',
    },
    {
      order: 4,
      name: 'Quick Start',
      description: 'Interactive quick start guide',
      automationLevel: 'semi-automated',
      duration: '3 minutes',
    },
    {
      order: 5,
      name: 'First API Call',
      description: 'Make first successful API call',
      automationLevel: 'semi-automated',
      duration: '2 minutes',
    },
    {
      order: 6,
      name: 'Explore',
      description: 'Explore additional features',
      automationLevel: 'semi-automated',
      duration: '10 minutes',
    },
  ],
  metrics: [
    { name: 'Time to First API Call', target: 5, unit: 'minutes' },
    { name: 'Signup to First Call Conversion', target: 80, unit: '%' },
    { name: 'Week 1 Retention', target: 50, unit: '%' },
  ],
})

// =============================================================================
// 8. WORKFLOWS
// =============================================================================

export const UsageAlertWorkflow = Workflow({
  name: 'Usage Alert',
  description: 'Alert customers approaching rate limits',
  trigger: { type: 'event', event: 'usage.threshold_reached' },
  actions: [
    {
      order: 1,
      type: 'condition',
      name: 'Check Usage Level',
      condition: 'usage.percent >= 80',
    },
    {
      order: 2,
      type: 'notification',
      name: 'Email Developer',
      config: {
        template: 'usage_warning',
        channel: 'email',
        data: ['usage.current', 'usage.limit', 'usage.percent'],
      },
    },
    {
      order: 3,
      type: 'condition',
      name: 'Check Critical Level',
      condition: 'usage.percent >= 95',
    },
    {
      order: 4,
      type: 'notification',
      name: 'Slack Alert',
      config: {
        template: 'usage_critical',
        channel: 'slack',
        priority: 'high',
      },
    },
    {
      order: 5,
      type: 'task',
      name: 'Create Upsell Opportunity',
      config: {
        type: 'upsell-opportunity',
        assignTo: 'account-manager',
        data: ['customer.id', 'usage.current', 'recommended_plan'],
      },
    },
  ],
})

export const IncidentAlertWorkflow = Workflow({
  name: 'Incident Alert',
  description: 'Automated incident detection and response',
  trigger: { type: 'event', event: 'monitor.alert_triggered' },
  actions: [
    {
      order: 1,
      type: 'compute',
      name: 'Determine Severity',
      config: {
        rules: [
          { condition: 'errorRate > 10', severity: 'critical' },
          { condition: 'errorRate > 5', severity: 'high' },
          { condition: 'errorRate > 1', severity: 'medium' },
          { condition: 'true', severity: 'low' },
        ],
      },
    },
    {
      order: 2,
      type: 'notification',
      name: 'Page On-Call',
      config: {
        channel: 'pagerduty',
        severity: '${severity}',
      },
    },
    {
      order: 3,
      type: 'task',
      name: 'Create Incident',
      config: {
        type: 'incident',
        severity: '${severity}',
        assignTo: 'sre-oncall',
      },
    },
    {
      order: 4,
      type: 'condition',
      name: 'Check Severity Critical',
      condition: 'severity == "critical"',
    },
    {
      order: 5,
      type: 'notification',
      name: 'Update Status Page',
      config: {
        channel: 'statuspage',
        status: 'investigating',
        component: '${affected_component}',
      },
    },
    {
      order: 6,
      type: 'notification',
      name: 'Notify Leadership',
      config: {
        channel: 'slack',
        to: '#engineering-leadership',
        template: 'critical_incident',
      },
    },
  ],
})

export const NewDeveloperWorkflow = Workflow({
  name: 'New Developer Engagement',
  description: 'Onboard and engage new developers',
  trigger: { type: 'event', event: 'developer.signup' },
  actions: [
    {
      order: 1,
      type: 'notification',
      name: 'Welcome Email',
      config: { template: 'developer_welcome', channel: 'email' },
    },
    {
      order: 2,
      type: 'wait',
      name: 'Wait 1 Day',
      duration: '1 day',
    },
    {
      order: 3,
      type: 'condition',
      name: 'Check First API Call',
      condition: 'developer.apiCallCount == 0',
    },
    {
      order: 4,
      type: 'notification',
      name: 'Getting Started Nudge',
      config: { template: 'getting_started', channel: 'email' },
    },
    {
      order: 5,
      type: 'wait',
      name: 'Wait 3 Days',
      duration: '3 days',
    },
    {
      order: 6,
      type: 'condition',
      name: 'Check Still Inactive',
      condition: 'developer.apiCallCount < 10',
    },
    {
      order: 7,
      type: 'task',
      name: 'Assign DevRel Outreach',
      config: {
        type: 'developer-outreach',
        assignTo: 'devrel',
      },
    },
    {
      order: 8,
      type: 'wait',
      name: 'Wait 7 Days',
      duration: '7 days',
    },
    {
      order: 9,
      type: 'condition',
      name: 'Check Active Developer',
      condition: 'developer.apiCallCount >= 100',
    },
    {
      order: 10,
      type: 'notification',
      name: 'Power User Resources',
      config: { template: 'power_user_resources', channel: 'email' },
    },
  ],
})

// =============================================================================
// 9. FINANCIALS
// =============================================================================

export const APIHubFinancials = financials({
  revenue: 14040000, // ARR
  cogs: 3510000, // 25% (infrastructure heavy)
  operatingExpenses: 9000000,
  depreciation: 300000,
  interestExpense: 0,
  otherIncome: 50000,
  taxes: 200000,
})

export const APIMetrics = {
  mrr: 1170000,
  arr: 14040000,
  developers: {
    total: 65000,
    active: 45000,
    paying: 3200,
  },
  apiCalls: {
    monthly: 6500000000,
    daily: 216666667,
    peakRps: 50000,
  },
  arpu: 365, // MRR / paying developers
  cac: 250,
  ltv: 4380, // 12 months avg * ARPU
  ltvToCac: 17.5,
  nrr: 125,
  freeToConversion: 3.8, // %
  infrastructureCostPerCall: 0.00004, // $
  grossMargin: 75, // %
}

// =============================================================================
// 10. UTILITY FUNCTIONS
// =============================================================================

export function getBusinessSummary() {
  return {
    company: APIHubBusiness,
    vision: APIHubVision,
    goals: APIHubGoals,
    products: { gateway: APIGateway, integrations: IntegrationsHub, analytics: APIAnalytics },
    kpis: APIHubKPIs,
    okrs: APIHubOKRs,
    financials: APIHubFinancials,
    metrics: APIMetrics,
  }
}

export function getPlatformHealth() {
  return {
    uptime: `${APIMetrics.apiCalls.monthly > 0 ? 99.97 : 0}%`,
    latency: '45ms P99',
    errorRate: '0.08%',
    throughput: `${(APIMetrics.apiCalls.daily / 1000000).toFixed(0)}M calls/day`,
  }
}

export function getDeveloperMetrics() {
  return {
    total: APIMetrics.developers.total.toLocaleString(),
    active: APIMetrics.developers.active.toLocaleString(),
    paying: APIMetrics.developers.paying.toLocaleString(),
    conversionRate: `${((APIMetrics.developers.paying / APIMetrics.developers.total) * 100).toFixed(2)}%`,
  }
}

export default {
  business: APIHubBusiness,
  vision: APIHubVision,
  goals: APIHubGoals,
  products: { gateway: APIGateway, integrations: IntegrationsHub, analytics: APIAnalytics },
  pricing: Pricing,
  organization: APIHubOrg,
  kpis: APIHubKPIs,
  okrs: APIHubOKRs,
  processes: {
    integrationDevelopment: IntegrationDevelopmentProcess,
    incidentResponse: IncidentResponseProcess,
    developerOnboarding: DeveloperOnboardingProcess,
  },
  workflows: {
    usageAlert: UsageAlertWorkflow,
    incidentAlert: IncidentAlertWorkflow,
    newDeveloper: NewDeveloperWorkflow,
  },
  financials: APIHubFinancials,
  metrics: APIMetrics,
}
