/**
 * SaaS Business Example
 *
 * A complete example of a B2B SaaS business modeled using primitives.org.ai
 * Demonstrates: Business definition, Products, Organization, Roles, KPIs, OKRs,
 * Processes, Workflows, Financial metrics, and Digital Workers
 *
 * @example CloudMetrics - A SaaS analytics platform
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

// Standard business roles placeholder
const StandardBusinessRoles: Record<string, any> = {
  ceo: { type: 'ceo', level: 10, permissions: { '*': ['manage'] } },
  cfo: { type: 'cfo', level: 9, permissions: { finance: ['manage'], budget: ['approve'] } },
  cto: { type: 'cto', level: 9, permissions: { technology: ['manage'], code: ['review'] } },
  engineer: { type: 'engineer', level: 3, canHandle: ['coding', 'code-review'] },
  support: { type: 'support', level: 2, canHandle: ['customer-inquiry', 'ticket-response'] },
}

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
  resourceHierarchy?: any
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
 * CloudMetrics - B2B SaaS Analytics Platform
 */
export const CloudMetricsBusiness = Business({
  name: 'CloudMetrics Inc.',
  mission: 'Empower businesses with real-time analytics to make data-driven decisions',
  values: ['Data-Driven', 'Customer Success', 'Transparency', 'Innovation'],
  industry: 'Software as a Service',
  founded: new Date('2022-01-15'),
  stage: 'growth',
  structure: {
    departments: [
      {
        name: 'Engineering',
        headcount: 25,
        budget: 3000000,
        teams: [
          { name: 'Platform', headcount: 8, focus: 'Core infrastructure' },
          { name: 'Frontend', headcount: 6, focus: 'User interfaces' },
          { name: 'Data', headcount: 5, focus: 'Analytics engine' },
          { name: 'DevOps', headcount: 4, focus: 'Infrastructure & deployment' },
          { name: 'QA', headcount: 2, focus: 'Quality assurance' },
        ],
      },
      {
        name: 'Product',
        headcount: 5,
        budget: 800000,
        teams: [
          { name: 'Product Management', headcount: 3 },
          { name: 'Design', headcount: 2 },
        ],
      },
      {
        name: 'Sales',
        headcount: 12,
        budget: 2000000,
        teams: [
          { name: 'Enterprise Sales', headcount: 5 },
          { name: 'Mid-Market', headcount: 4 },
          { name: 'SDR', headcount: 3 },
        ],
      },
      {
        name: 'Customer Success',
        headcount: 8,
        budget: 1000000,
        teams: [
          { name: 'Onboarding', headcount: 3 },
          { name: 'Support', headcount: 3 },
          { name: 'Renewals', headcount: 2 },
        ],
      },
      {
        name: 'Marketing',
        headcount: 6,
        budget: 1500000,
        teams: [
          { name: 'Growth', headcount: 2 },
          { name: 'Content', headcount: 2 },
          { name: 'Product Marketing', headcount: 2 },
        ],
      },
      {
        name: 'Finance & Operations',
        headcount: 4,
        budget: 500000,
      },
    ],
  },
})

// =============================================================================
// 2. VISION & GOALS
// =============================================================================

export const CloudMetricsVision = Vision({
  statement: 'Be the leading analytics platform for data-driven businesses worldwide',
  timeHorizon: '2027',
  pillars: [
    'Product Excellence',
    'Customer Success',
    'Market Leadership',
    'Operational Efficiency',
  ],
  successIndicators: [
    { name: 'ARR', target: 50000000, unit: 'USD' },
    { name: 'NPS', target: 70 },
    { name: 'Customer Count', target: 5000 },
    { name: 'Net Revenue Retention', target: 130, unit: '%' },
  ],
})

export const CloudMetricsGoals = Goals([
  {
    name: 'Achieve $10M ARR',
    category: 'financial',
    status: 'in-progress',
    progress: 75,
    dueDate: new Date('2024-12-31'),
    owner: 'CEO',
    milestones: [
      { name: '$5M ARR', completed: true },
      { name: '$7.5M ARR', completed: true },
      { name: '$10M ARR', completed: false },
    ],
  },
  {
    name: 'Launch Enterprise Tier',
    category: 'product',
    status: 'in-progress',
    progress: 60,
    dueDate: new Date('2024-06-30'),
    owner: 'VP Product',
    dependencies: ['SOC 2 Compliance', 'SSO Integration'],
  },
  {
    name: 'SOC 2 Compliance',
    category: 'operational',
    status: 'in-progress',
    progress: 80,
    dueDate: new Date('2024-03-31'),
    owner: 'VP Engineering',
  },
  {
    name: 'SSO Integration',
    category: 'product',
    status: 'in-progress',
    progress: 90,
    dueDate: new Date('2024-02-28'),
    owner: 'Engineering Lead',
  },
  {
    name: 'Expand to EU Market',
    category: 'strategic',
    status: 'planned',
    progress: 10,
    dueDate: new Date('2024-09-30'),
    owner: 'VP Sales',
    dependencies: ['GDPR Compliance'],
  },
  {
    name: 'GDPR Compliance',
    category: 'operational',
    status: 'in-progress',
    progress: 45,
    dueDate: new Date('2024-06-30'),
    owner: 'Legal',
  },
])

// =============================================================================
// 3. PRODUCTS & PRICING
// =============================================================================

export const CloudMetricsProduct = Product({
  name: 'CloudMetrics Platform',
  description: 'Real-time analytics platform for SaaS businesses',
  pricingModel: 'subscription',
  features: [
    'Real-time dashboards',
    'Custom metrics',
    'Alerts & notifications',
    'API access',
    'Data exports',
    'Team collaboration',
    'SSO (Enterprise)',
    'Dedicated support (Enterprise)',
  ],
  roadmap: [
    {
      name: 'AI-Powered Insights',
      status: 'planned',
      priority: 'high',
      targetDate: new Date('2024-Q2'),
    },
    {
      name: 'Mobile App',
      status: 'in-progress',
      priority: 'medium',
      targetDate: new Date('2024-Q3'),
    },
    {
      name: 'Embedded Analytics',
      status: 'planned',
      priority: 'high',
      targetDate: new Date('2024-Q4'),
    },
  ],
})

export const PricingTiers = {
  starter: Product({
    name: 'Starter',
    pricingModel: 'subscription',
    price: 49, // /month
    billingPeriod: 'monthly',
    features: ['5 dashboards', '10 data sources', 'Email support'],
    targetMarket: 'Small businesses',
  }),
  growth: Product({
    name: 'Growth',
    pricingModel: 'subscription',
    price: 199, // /month
    billingPeriod: 'monthly',
    features: ['25 dashboards', '50 data sources', 'Priority support', 'API access'],
    targetMarket: 'Mid-market',
    cogs: 40,
  }),
  enterprise: Product({
    name: 'Enterprise',
    pricingModel: 'subscription',
    price: 999, // /month
    billingPeriod: 'monthly',
    features: ['Unlimited dashboards', 'Unlimited data sources', 'SSO', 'Dedicated success manager', '99.9% SLA'],
    targetMarket: 'Enterprise',
    cogs: 200,
  }),
}

// =============================================================================
// 4. ORGANIZATION & ROLES
// =============================================================================

export const CloudMetricsOrg: Organization = {
  id: 'cloudmetrics',
  name: 'CloudMetrics Inc.',
  settings: {
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    fiscalYearStart: 1, // January
  },
  departments: [
    {
      id: 'engineering',
      name: 'Engineering',
      permissions: {
        code: ['read', 'write', 'deploy'],
        infrastructure: ['read', 'write', 'manage'],
      },
      budget: {
        annual: 3000000,
        spent: 2250000,
        categories: {
          salaries: { annual: 2500000, spent: 1875000 },
          infrastructure: { annual: 400000, spent: 300000 },
          tools: { annual: 100000, spent: 75000 },
        },
      },
      teams: [
        {
          id: 'platform',
          name: 'Platform',
          positions: [
            { id: 'platform-lead', title: 'Platform Lead', roleId: 'senior-engineer', reportsTo: 'eng-vp' },
            { id: 'platform-eng-1', title: 'Senior Platform Engineer', roleId: 'senior-engineer', reportsTo: 'platform-lead' },
            { id: 'platform-eng-2', title: 'Platform Engineer', roleId: 'engineer', reportsTo: 'platform-lead' },
          ],
        },
        {
          id: 'frontend',
          name: 'Frontend',
          positions: [
            { id: 'frontend-lead', title: 'Frontend Lead', roleId: 'senior-engineer', reportsTo: 'eng-vp' },
            { id: 'frontend-eng-1', title: 'Senior Frontend Engineer', roleId: 'senior-engineer', reportsTo: 'frontend-lead' },
          ],
        },
      ],
    },
    {
      id: 'sales',
      name: 'Sales',
      permissions: {
        deals: ['read', 'write', 'manage'],
        customers: ['read', 'write'],
      },
      budget: {
        annual: 2000000,
        spent: 1500000,
        categories: {
          salaries: { annual: 1500000, spent: 1125000 },
          commissions: { annual: 400000, spent: 300000 },
          travel: { annual: 100000, spent: 75000 },
        },
      },
    },
    {
      id: 'customer-success',
      name: 'Customer Success',
      permissions: {
        customers: ['read', 'write'],
        support: ['read', 'write', 'manage'],
      },
    },
  ],
  roles: [
    createBusinessRole({
      id: 'ceo',
      name: 'CEO',
      ...StandardBusinessRoles.ceo,
    }),
    createBusinessRole({
      id: 'cfo',
      name: 'CFO',
      ...StandardBusinessRoles.cfo,
    }),
    createBusinessRole({
      id: 'senior-engineer',
      name: 'Senior Engineer',
      type: 'engineer',
      level: 5,
      permissions: {
        code: ['read', 'write', 'review', 'merge'],
        deployments: ['read', 'write'],
        incidents: ['read', 'write', 'escalate'],
      },
      canHandle: ['coding', 'code-review', 'architecture', 'incident-response'],
      canApprove: ['pull-request', 'design-doc'],
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
      canHandle: ['coding', 'code-review', 'bug-fix'],
    }),
    createBusinessRole({
      id: 'ae',
      name: 'Account Executive',
      type: 'sales',
      level: 4,
      permissions: {
        deals: ['read', 'write', 'negotiate'],
        customers: ['read', 'write'],
      },
      canHandle: ['demo', 'negotiation', 'contract-review'],
      canApprove: ['discount'],
    }),
    createBusinessRole({
      id: 'csm',
      name: 'Customer Success Manager',
      type: 'support',
      level: 4,
      permissions: {
        customers: ['read', 'write'],
        support: ['read', 'write', 'escalate'],
      },
      canHandle: ['onboarding', 'training', 'renewal', 'upsell'],
    }),
    createBusinessRole({
      id: 'support-agent',
      name: 'Support Agent',
      type: 'support',
      level: 2,
      workerType: 'hybrid', // Can be AI or human
      permissions: {
        support: ['read', 'write'],
        customers: ['read'],
      },
      canHandle: ['tier-1-support', 'documentation-query', 'status-check'],
    }),
  ],
  approvalChains: [
    {
      id: 'expense-approval',
      name: 'Expense Approval',
      requestType: 'expense',
      levels: [
        { threshold: 1000, approvers: [{ type: 'manager' }] },
        { threshold: 5000, approvers: [{ type: 'department-head' }] },
        { threshold: 25000, approvers: [{ type: 'role', roleId: 'cfo' }] },
        { threshold: Infinity, approvers: [{ type: 'role', roleId: 'ceo' }] },
      ],
    },
    {
      id: 'discount-approval',
      name: 'Discount Approval',
      requestType: 'discount',
      levels: [
        { threshold: 10, approvers: [{ type: 'manager' }] }, // Up to 10%
        { threshold: 20, approvers: [{ type: 'department-head' }] }, // Up to 20%
        { threshold: 30, approvers: [{ type: 'role', roleId: 'cro' }] }, // Up to 30%
        { threshold: Infinity, approvers: [{ type: 'role', roleId: 'ceo' }] }, // >30%
      ],
    },
  ],
  routingRules: [
    {
      id: 'tier-1-support-routing',
      taskType: 'tier-1-support',
      priority: 1,
      assignTo: { roleId: 'support-agent' },
      conditions: { complexity: 'low' },
    },
    {
      id: 'escalated-support-routing',
      taskType: 'tier-2-support',
      priority: 2,
      assignTo: { roleId: 'csm' },
      conditions: { complexity: 'high' },
    },
    {
      id: 'code-review-routing',
      taskType: 'code-review',
      priority: 1,
      assignTo: { roleId: 'senior-engineer' },
    },
  ],
}

// =============================================================================
// 5. KPIs & METRICS
// =============================================================================

export const CloudMetricsKPIs = kpis([
  // Revenue Metrics
  {
    name: 'Monthly Recurring Revenue (MRR)',
    category: 'financial',
    target: 850000,
    current: 780000,
    unit: 'USD',
    frequency: 'monthly',
    owner: 'CEO',
  },
  {
    name: 'Annual Recurring Revenue (ARR)',
    category: 'financial',
    target: 10000000,
    current: 9360000,
    unit: 'USD',
    frequency: 'monthly',
    owner: 'CEO',
  },
  {
    name: 'Net Revenue Retention (NRR)',
    category: 'financial',
    target: 120,
    current: 115,
    unit: '%',
    frequency: 'monthly',
    owner: 'VP Customer Success',
  },
  // Customer Metrics
  {
    name: 'Customer Count',
    category: 'customer',
    target: 800,
    current: 720,
    frequency: 'monthly',
    owner: 'VP Sales',
  },
  {
    name: 'Churn Rate',
    category: 'customer',
    target: 2,
    current: 2.5,
    unit: '%',
    frequency: 'monthly',
    owner: 'VP Customer Success',
  },
  {
    name: 'Net Promoter Score (NPS)',
    category: 'customer',
    target: 60,
    current: 55,
    frequency: 'quarterly',
    owner: 'VP Product',
  },
  // Sales Metrics
  {
    name: 'Sales Qualified Leads',
    category: 'sales',
    target: 200,
    current: 185,
    frequency: 'monthly',
    owner: 'VP Marketing',
  },
  {
    name: 'Win Rate',
    category: 'sales',
    target: 25,
    current: 22,
    unit: '%',
    frequency: 'monthly',
    owner: 'VP Sales',
  },
  {
    name: 'Average Contract Value (ACV)',
    category: 'sales',
    target: 15000,
    current: 13500,
    unit: 'USD',
    frequency: 'monthly',
    owner: 'VP Sales',
  },
  // Operational Metrics
  {
    name: 'System Uptime',
    category: 'operational',
    target: 99.9,
    current: 99.95,
    unit: '%',
    frequency: 'monthly',
    owner: 'VP Engineering',
  },
  {
    name: 'Support Response Time',
    category: 'operational',
    target: 4,
    current: 3.2,
    unit: 'hours',
    frequency: 'weekly',
    owner: 'Support Lead',
  },
  {
    name: 'Deployment Frequency',
    category: 'operational',
    target: 20,
    current: 18,
    unit: 'deploys/month',
    frequency: 'monthly',
    owner: 'VP Engineering',
  },
])

// =============================================================================
// 6. OKRs
// =============================================================================

export const CloudMetricsOKRs = okrs([
  {
    objective: 'Achieve Product-Market Fit for Enterprise Segment',
    owner: 'VP Product',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Close 10 Enterprise customers',
        metric: 'Enterprise Customers',
        targetValue: 10,
        currentValue: 6,
      },
      {
        description: 'Achieve Enterprise NPS of 60+',
        metric: 'Enterprise NPS',
        targetValue: 60,
        currentValue: 52,
      },
      {
        description: 'Launch SSO & SCIM integrations',
        metric: 'Features Launched',
        targetValue: 2,
        currentValue: 1,
      },
    ],
  },
  {
    objective: 'Scale Sales Machine',
    owner: 'VP Sales',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Increase MQL to SQL conversion to 35%',
        metric: 'MQL to SQL Conversion',
        targetValue: 35,
        currentValue: 28,
        unit: '%',
      },
      {
        description: 'Reduce sales cycle to 45 days',
        metric: 'Sales Cycle',
        targetValue: 45,
        currentValue: 52,
        unit: 'days',
      },
      {
        description: 'Hire 3 new Account Executives',
        metric: 'AEs Hired',
        targetValue: 3,
        currentValue: 2,
      },
    ],
  },
  {
    objective: 'Build World-Class Engineering Culture',
    owner: 'VP Engineering',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Achieve 80% test coverage',
        metric: 'Test Coverage',
        targetValue: 80,
        currentValue: 72,
        unit: '%',
      },
      {
        description: 'Reduce incident response time to 15 minutes',
        metric: 'Incident Response Time',
        targetValue: 15,
        currentValue: 22,
        unit: 'minutes',
      },
      {
        description: 'Ship 50 customer-requested features',
        metric: 'Features Shipped',
        targetValue: 50,
        currentValue: 38,
      },
    ],
  },
  {
    objective: 'Maximize Customer Success',
    owner: 'VP Customer Success',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Achieve 95% renewal rate',
        metric: 'Renewal Rate',
        targetValue: 95,
        currentValue: 92,
        unit: '%',
      },
      {
        description: 'Increase expansion revenue to 25% of ARR',
        metric: 'Expansion Revenue',
        targetValue: 25,
        currentValue: 18,
        unit: '%',
      },
      {
        description: 'Reduce time-to-value to 14 days',
        metric: 'Time to Value',
        targetValue: 14,
        currentValue: 21,
        unit: 'days',
      },
    ],
  },
])

// =============================================================================
// 7. PROCESSES
// =============================================================================

export const LeadToCustomerProcess = Process({
  name: 'Lead to Customer',
  description: 'End-to-end process from lead capture to closed-won deal',
  owner: 'VP Sales',
  steps: [
    {
      order: 1,
      name: 'Lead Capture',
      description: 'Capture lead from marketing channels',
      automationLevel: 'automated',
      duration: 'instant',
      owner: 'Marketing',
    },
    {
      order: 2,
      name: 'Lead Qualification',
      description: 'Qualify lead based on ICP and intent signals',
      automationLevel: 'semi-automated',
      duration: '24 hours',
      owner: 'SDR',
    },
    {
      order: 3,
      name: 'Discovery Call',
      description: 'Conduct discovery call to understand needs',
      automationLevel: 'manual',
      duration: '30 minutes',
      owner: 'SDR',
    },
    {
      order: 4,
      name: 'Product Demo',
      description: 'Deliver personalized product demonstration',
      automationLevel: 'manual',
      duration: '45 minutes',
      owner: 'AE',
    },
    {
      order: 5,
      name: 'Proposal',
      description: 'Create and send proposal',
      automationLevel: 'semi-automated',
      duration: '2 days',
      owner: 'AE',
    },
    {
      order: 6,
      name: 'Negotiation',
      description: 'Negotiate terms and pricing',
      automationLevel: 'manual',
      duration: '1 week',
      owner: 'AE',
    },
    {
      order: 7,
      name: 'Contract',
      description: 'Generate and sign contract',
      automationLevel: 'semi-automated',
      duration: '3 days',
      owner: 'AE',
    },
    {
      order: 8,
      name: 'Handoff',
      description: 'Hand off to Customer Success',
      automationLevel: 'automated',
      duration: '1 hour',
      owner: 'AE',
    },
  ],
  metrics: [
    { name: 'Conversion Rate', target: 25, unit: '%' },
    { name: 'Average Sales Cycle', target: 45, unit: 'days' },
    { name: 'Win Rate', target: 25, unit: '%' },
  ],
})

export const CustomerOnboardingProcess = Process({
  name: 'Customer Onboarding',
  description: 'Onboard new customers to achieve time-to-value',
  owner: 'VP Customer Success',
  steps: [
    {
      order: 1,
      name: 'Welcome',
      description: 'Send welcome email with access credentials',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 2,
      name: 'Kickoff Call',
      description: 'Conduct kickoff call to set expectations',
      automationLevel: 'manual',
      duration: '1 hour',
      owner: 'CSM',
    },
    {
      order: 3,
      name: 'Data Integration',
      description: 'Help customer connect data sources',
      automationLevel: 'semi-automated',
      duration: '2 days',
      owner: 'CSM',
    },
    {
      order: 4,
      name: 'Dashboard Setup',
      description: 'Configure initial dashboards',
      automationLevel: 'semi-automated',
      duration: '1 day',
      owner: 'CSM',
    },
    {
      order: 5,
      name: 'Training',
      description: 'Conduct product training session',
      automationLevel: 'manual',
      duration: '2 hours',
      owner: 'CSM',
    },
    {
      order: 6,
      name: 'First Value',
      description: 'Ensure customer achieves first value milestone',
      automationLevel: 'manual',
      duration: '1 week',
      owner: 'CSM',
    },
    {
      order: 7,
      name: 'Graduation',
      description: 'Move customer to steady-state support',
      automationLevel: 'automated',
      duration: '1 day',
    },
  ],
  metrics: [
    { name: 'Time to Value', target: 14, unit: 'days' },
    { name: 'Onboarding Completion Rate', target: 95, unit: '%' },
    { name: 'CSAT', target: 90, unit: '%' },
  ],
})

export const SupportTicketProcess = Process({
  name: 'Support Ticket Resolution',
  description: 'Handle customer support tickets efficiently',
  owner: 'Support Lead',
  steps: [
    {
      order: 1,
      name: 'Intake',
      description: 'Receive and categorize ticket',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 2,
      name: 'Triage',
      description: 'Assess priority and assign to appropriate agent',
      automationLevel: 'semi-automated',
      duration: '15 minutes',
    },
    {
      order: 3,
      name: 'Initial Response',
      description: 'Provide initial response to customer',
      automationLevel: 'semi-automated',
      duration: '1 hour',
      owner: 'Support Agent',
    },
    {
      order: 4,
      name: 'Investigation',
      description: 'Investigate and diagnose issue',
      automationLevel: 'manual',
      duration: '2 hours',
      owner: 'Support Agent',
    },
    {
      order: 5,
      name: 'Resolution',
      description: 'Resolve issue or escalate',
      automationLevel: 'manual',
      duration: '4 hours',
      owner: 'Support Agent',
    },
    {
      order: 6,
      name: 'Verification',
      description: 'Verify resolution with customer',
      automationLevel: 'semi-automated',
      duration: '1 hour',
    },
    {
      order: 7,
      name: 'Closure',
      description: 'Close ticket and request feedback',
      automationLevel: 'automated',
      duration: 'instant',
    },
  ],
  metrics: [
    { name: 'First Response Time', target: 1, unit: 'hours' },
    { name: 'Resolution Time', target: 8, unit: 'hours' },
    { name: 'First Contact Resolution', target: 70, unit: '%' },
    { name: 'CSAT', target: 90, unit: '%' },
  ],
})

// =============================================================================
// 8. WORKFLOWS (Automated)
// =============================================================================

export const LeadScoringWorkflow = Workflow({
  name: 'Lead Scoring',
  description: 'Automatically score and qualify leads',
  trigger: { type: 'event', event: 'lead.created' },
  actions: [
    {
      order: 1,
      type: 'compute',
      name: 'Calculate Firmographic Score',
      config: {
        factors: ['company_size', 'industry', 'location'],
        weights: [0.4, 0.35, 0.25],
      },
    },
    {
      order: 2,
      type: 'compute',
      name: 'Calculate Behavioral Score',
      config: {
        factors: ['page_views', 'content_downloads', 'email_opens'],
        weights: [0.3, 0.4, 0.3],
      },
    },
    {
      order: 3,
      type: 'compute',
      name: 'Combine Scores',
      config: {
        formula: '(firmographic * 0.6) + (behavioral * 0.4)',
      },
    },
    {
      order: 4,
      type: 'condition',
      name: 'Check MQL Threshold',
      condition: 'score >= 70',
    },
    {
      order: 5,
      type: 'notification',
      name: 'Notify SDR',
      config: {
        channel: 'slack',
        template: 'new_mql_alert',
      },
    },
  ],
})

export const ChurnPredictionWorkflow = Workflow({
  name: 'Churn Prediction Alert',
  description: 'Alert CSM when customer shows churn signals',
  trigger: { type: 'schedule', cron: '0 9 * * *' }, // Daily at 9 AM
  actions: [
    {
      order: 1,
      type: 'compute',
      name: 'Calculate Health Score',
      config: {
        factors: ['usage_trend', 'support_tickets', 'login_frequency', 'feature_adoption'],
        weights: [0.3, 0.2, 0.25, 0.25],
      },
    },
    {
      order: 2,
      type: 'condition',
      name: 'Check At-Risk Threshold',
      condition: 'healthScore < 60',
    },
    {
      order: 3,
      type: 'notification',
      name: 'Alert CSM',
      config: {
        channel: 'email',
        template: 'at_risk_customer',
        priority: 'high',
      },
    },
    {
      order: 4,
      type: 'task',
      name: 'Create Save Play Task',
      config: {
        type: 'customer-save-play',
        assignTo: 'csm',
        dueIn: '48 hours',
      },
    },
  ],
})

export const TrialConversionWorkflow = Workflow({
  name: 'Trial Conversion Nurture',
  description: 'Nurture trial users towards conversion',
  trigger: { type: 'event', event: 'trial.started' },
  actions: [
    {
      order: 1,
      type: 'notification',
      name: 'Welcome Email',
      config: { template: 'trial_welcome', channel: 'email' },
    },
    {
      order: 2,
      type: 'wait',
      name: 'Wait 3 Days',
      duration: '3 days',
    },
    {
      order: 3,
      type: 'condition',
      name: 'Check Activation',
      condition: 'user.hasConnectedDataSource == false',
    },
    {
      order: 4,
      type: 'notification',
      name: 'Activation Nudge',
      config: { template: 'connect_data_source', channel: 'email' },
    },
    {
      order: 5,
      type: 'wait',
      name: 'Wait Until Day 7',
      duration: '4 days',
    },
    {
      order: 6,
      type: 'task',
      name: 'Schedule Demo Call',
      config: {
        type: 'demo-call',
        assignTo: 'sdr',
      },
    },
    {
      order: 7,
      type: 'wait',
      name: 'Wait Until Day 12',
      duration: '5 days',
    },
    {
      order: 8,
      type: 'condition',
      name: 'Check Not Converted',
      condition: 'user.plan == "trial"',
    },
    {
      order: 9,
      type: 'notification',
      name: 'Final Offer Email',
      config: { template: 'trial_ending_offer', channel: 'email' },
    },
  ],
})

// =============================================================================
// 9. FINANCIALS
// =============================================================================

export const CloudMetricsFinancials = financials({
  revenue: 9360000, // ARR
  cogs: 1872000, // 20% of revenue
  operatingExpenses: 6500000, // Salaries, marketing, etc.
  depreciation: 200000,
  interestExpense: 50000,
  otherIncome: 25000,
  taxes: 300000,
})

// Additional SaaS-specific metrics
export const SaaSMetrics = {
  mrr: 780000,
  arr: 9360000,
  customers: 720,
  arpu: 1083, // MRR / customers
  cac: 8500,
  ltv: 32500, // ARPU * 30 months avg
  ltvToCac: 3.8,
  paybackPeriod: 7.8, // months
  nrr: 115,
  grr: 97,
  quickRatio: 3.2, // (new + expansion) / (churn + contraction)
  burnMultiple: 1.8,
  ruleOf40: 52, // Growth rate + profit margin
}

// =============================================================================
// 10. UTILITY FUNCTIONS
// =============================================================================

/**
 * Get full business summary
 */
export function getBusinessSummary() {
  return {
    company: CloudMetricsBusiness,
    vision: CloudMetricsVision,
    goals: CloudMetricsGoals,
    product: CloudMetricsProduct,
    kpis: CloudMetricsKPIs,
    okrs: CloudMetricsOKRs,
    financials: CloudMetricsFinancials,
    metrics: SaaSMetrics,
  }
}

/**
 * Calculate runway based on current metrics
 */
export function calculateRunway() {
  const monthlyBurn = (CloudMetricsFinancials.operatingExpenses - CloudMetricsFinancials.revenue) / 12
  const cashOnHand = 5000000 // Assume $5M in bank
  return monthlyBurn > 0 ? cashOnHand / monthlyBurn : Infinity
}

/**
 * Format key metrics for dashboard
 */
export function getDashboardMetrics() {
  return {
    revenue: {
      mrr: $.format(SaaSMetrics.mrr),
      arr: $.format(SaaSMetrics.arr),
      growth: `${$.growth(SaaSMetrics.mrr, 700000)}%`, // vs last period
    },
    customers: {
      total: SaaSMetrics.customers,
      arpu: $.format(SaaSMetrics.arpu),
      nrr: `${SaaSMetrics.nrr}%`,
    },
    efficiency: {
      ltvToCac: `${SaaSMetrics.ltvToCac}x`,
      paybackPeriod: `${SaaSMetrics.paybackPeriod} months`,
      ruleOf40: SaaSMetrics.ruleOf40,
    },
  }
}

// Export everything
export default {
  business: CloudMetricsBusiness,
  vision: CloudMetricsVision,
  goals: CloudMetricsGoals,
  product: CloudMetricsProduct,
  pricing: PricingTiers,
  organization: CloudMetricsOrg,
  kpis: CloudMetricsKPIs,
  okrs: CloudMetricsOKRs,
  processes: {
    leadToCustomer: LeadToCustomerProcess,
    onboarding: CustomerOnboardingProcess,
    support: SupportTicketProcess,
  },
  workflows: {
    leadScoring: LeadScoringWorkflow,
    churnPrediction: ChurnPredictionWorkflow,
    trialConversion: TrialConversionWorkflow,
  },
  financials: CloudMetricsFinancials,
  metrics: SaaSMetrics,
}
