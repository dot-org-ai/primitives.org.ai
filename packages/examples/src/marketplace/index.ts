/**
 * Marketplace Business Example
 *
 * A complete example of a two-sided marketplace modeled using primitives.org.ai
 * Think: Upwork, Toptal, Fiverr, or a B2B services marketplace
 *
 * @example TalentHub - A marketplace for freelance developers
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
 * TalentHub - Freelance Developer Marketplace
 */
export const TalentHubBusiness = Business({
  name: 'TalentHub Inc.',
  mission: 'Connect exceptional developers with innovative companies worldwide',
  values: ['Quality Talent', 'Fair Compensation', 'Trust & Transparency', 'Global Access'],
  industry: 'Staffing / Freelance Marketplace',
  founded: new Date('2019-08-01'),
  stage: 'growth',
  structure: {
    departments: [
      {
        name: 'Product & Engineering',
        headcount: 25,
        budget: 3500000,
        teams: [
          { name: 'Platform', headcount: 8, focus: 'Core marketplace' },
          { name: 'Matching', headcount: 5, focus: 'AI matching & recommendations' },
          { name: 'Payments', headcount: 4, focus: 'Escrow & payments' },
          { name: 'Mobile', headcount: 4, focus: 'iOS & Android apps' },
          { name: 'Trust & Safety', headcount: 4, focus: 'Fraud prevention, disputes' },
        ],
      },
      {
        name: 'Supply (Talent)',
        headcount: 15,
        budget: 1500000,
        teams: [
          { name: 'Talent Acquisition', headcount: 6, focus: 'Recruiting developers' },
          { name: 'Vetting', headcount: 5, focus: 'Skills assessment' },
          { name: 'Talent Success', headcount: 4, focus: 'Developer satisfaction' },
        ],
      },
      {
        name: 'Demand (Clients)',
        headcount: 12,
        budget: 1800000,
        teams: [
          { name: 'Sales', headcount: 6, focus: 'Enterprise clients' },
          { name: 'Client Success', headcount: 4, focus: 'Client satisfaction' },
          { name: 'Account Management', headcount: 2, focus: 'Key accounts' },
        ],
      },
      {
        name: 'Operations',
        headcount: 8,
        budget: 800000,
        teams: [
          { name: 'Support', headcount: 4, focus: 'Client & talent support' },
          { name: 'Quality', headcount: 2, focus: 'Quality assurance' },
          { name: 'Finance', headcount: 2, focus: 'Payments & invoicing' },
        ],
      },
      {
        name: 'Marketing',
        headcount: 6,
        budget: 1200000,
        teams: [
          { name: 'Brand & Content', headcount: 3 },
          { name: 'Growth', headcount: 3 },
        ],
      },
    ],
  },
})

// =============================================================================
// 2. VISION & GOALS
// =============================================================================

export const TalentHubVision = Vision({
  statement: 'Be the premier platform where top developers build their careers and companies access world-class talent',
  timeHorizon: '2028',
  pillars: [
    'Talent Quality',
    'Match Accuracy',
    'Client Success',
    'Developer Earnings',
  ],
  successIndicators: [
    { name: 'Gross Merchandise Value', target: 500000000, unit: 'USD' },
    { name: 'Active Developers', target: 100000 },
    { name: 'Enterprise Clients', target: 5000 },
    { name: 'Developer NPS', target: 70 },
  ],
})

export const TalentHubGoals = Goals([
  {
    name: 'Reach $100M GMV',
    category: 'financial',
    status: 'in-progress',
    progress: 60,
    dueDate: new Date('2024-12-31'),
    owner: 'CEO',
  },
  {
    name: 'Launch AI Matching 2.0',
    category: 'product',
    status: 'in-progress',
    progress: 40,
    dueDate: new Date('2024-06-30'),
    owner: 'VP Product',
  },
  {
    name: 'Onboard 20K Vetted Developers',
    category: 'supply',
    status: 'in-progress',
    progress: 55,
    dueDate: new Date('2024-09-30'),
    owner: 'VP Talent',
  },
  {
    name: 'Achieve 90% Match Success Rate',
    category: 'operational',
    status: 'in-progress',
    progress: 70,
    dueDate: new Date('2024-06-30'),
    owner: 'VP Product',
  },
  {
    name: 'Expand to 50 Countries',
    category: 'strategic',
    status: 'in-progress',
    progress: 45,
    dueDate: new Date('2024-12-31'),
    owner: 'VP Operations',
  },
])

// =============================================================================
// 3. PRODUCTS & SERVICES
// =============================================================================

export const MarketplacePlatform = Product({
  name: 'TalentHub Marketplace',
  description: 'Two-sided marketplace connecting developers and clients',
  pricingModel: 'commission',
  features: [
    'AI-powered matching',
    'Skill assessments',
    'Project management',
    'Time tracking',
    'Secure payments (escrow)',
    'Video interviews',
    'Code collaboration',
    'Reviews & ratings',
  ],
  roadmap: [
    { name: 'AI Matching 2.0', status: 'in-progress', priority: 'high', targetDate: new Date('2024-Q2') },
    { name: 'Team Matching', status: 'planned', priority: 'high', targetDate: new Date('2024-Q3') },
    { name: 'Skills Marketplace', status: 'planned', priority: 'medium', targetDate: new Date('2024-Q4') },
  ],
})

/**
 * Client Products
 */
export const ClientProducts = {
  selfServe: Product({
    name: 'Self-Serve',
    description: 'Post projects and find talent yourself',
    pricingModel: 'commission',
    price: 15, // % commission on transactions
    features: [
      'Unlimited job posts',
      'AI matching suggestions',
      'Basic support',
      'Standard escrow',
    ],
  }),
  managed: Product({
    name: 'Managed',
    description: 'Dedicated talent partner',
    pricingModel: 'commission',
    price: 20, // % commission
    features: [
      'Everything in Self-Serve',
      'Dedicated talent partner',
      'Pre-vetted shortlists',
      'Priority matching',
      'Extended payment terms',
    ],
  }),
  enterprise: Product({
    name: 'Enterprise',
    description: 'Full-service talent solution',
    pricingModel: 'subscription',
    price: 5000, // /month + commission
    features: [
      'Everything in Managed',
      'Dedicated team',
      'Custom vetting criteria',
      'API access',
      'Compliance & legal support',
      'SOW management',
      'Bulk hiring',
    ],
  }),
}

/**
 * Developer Products
 */
export const DeveloperProducts = {
  basic: Product({
    name: 'Basic Profile',
    description: 'Free developer profile',
    pricingModel: 'free',
    features: [
      'Profile creation',
      'Job applications',
      'Basic matching',
      'Skills assessments',
    ],
  }),
  pro: Product({
    name: 'Pro Profile',
    description: 'Enhanced visibility and features',
    pricingModel: 'subscription',
    price: 29, // /month
    features: [
      'Everything in Basic',
      'Featured in searches',
      'Priority support',
      'Advanced analytics',
      'Direct messaging',
    ],
  }),
}

/**
 * Value-Added Services
 */
export const Services = {
  vetting: Service({
    name: 'Premium Vetting',
    description: 'Comprehensive technical vetting',
    pricingModel: 'fixed',
    deliverables: [
      'Technical interview',
      'Code assessment',
      'Background check',
      'Reference verification',
    ],
  }),
  payroll: Service({
    name: 'Payroll Services',
    description: 'Handle contractor payments globally',
    pricingModel: 'percentage',
    deliverables: [
      'Multi-currency payments',
      'Tax documentation',
      'Compliance handling',
      'Payment scheduling',
    ],
  }),
}

// =============================================================================
// 4. ORGANIZATION & ROLES
// =============================================================================

export const TalentHubOrg: Organization = {
  id: 'talenthub',
  name: 'TalentHub Inc.',
  settings: {
    timezone: 'America/Los_Angeles',
    currency: 'USD',
    fiscalYearStart: 1,
  },
  departments: [
    {
      id: 'talent',
      name: 'Supply (Talent)',
      permissions: {
        developers: ['read', 'write', 'vet', 'approve'],
        applications: ['read', 'write', 'review'],
        assessments: ['read', 'write', 'score'],
      },
      teams: [
        {
          id: 'vetting',
          name: 'Vetting',
          positions: [
            { id: 'vetting-lead', title: 'Vetting Lead', roleId: 'vetting-manager', reportsTo: 'vp-talent' },
            { id: 'vetter-1', title: 'Technical Vetter', roleId: 'vetter', reportsTo: 'vetting-lead' },
          ],
        },
        {
          id: 'talent-success',
          name: 'Talent Success',
          positions: [
            { id: 'ts-lead', title: 'Talent Success Lead', roleId: 'talent-success', reportsTo: 'vp-talent' },
          ],
        },
      ],
    },
    {
      id: 'demand',
      name: 'Demand (Clients)',
      permissions: {
        clients: ['read', 'write', 'manage'],
        projects: ['read', 'write'],
        contracts: ['read', 'write', 'approve'],
      },
    },
    {
      id: 'operations',
      name: 'Operations',
      permissions: {
        disputes: ['read', 'write', 'resolve'],
        payments: ['read', 'write', 'release'],
        support: ['read', 'write'],
      },
    },
  ],
  roles: [
    createBusinessRole({
      id: 'vetting-manager',
      name: 'Vetting Manager',
      type: 'manager',
      level: 5,
      permissions: {
        developers: ['read', 'write', 'vet', 'approve', 'reject'],
        assessments: ['read', 'write', 'score', 'configure'],
      },
      canHandle: ['vetting-escalation', 'assessment-design', 'quality-review'],
      canApprove: ['developer-approval', 'vetting-exception'],
    }),
    createBusinessRole({
      id: 'vetter',
      name: 'Technical Vetter',
      type: 'support',
      level: 4,
      workerType: 'hybrid', // AI-assisted
      permissions: {
        developers: ['read', 'write', 'vet'],
        assessments: ['read', 'write', 'score'],
      },
      canHandle: ['technical-interview', 'code-review', 'skill-assessment'],
    }),
    createBusinessRole({
      id: 'talent-success',
      name: 'Talent Success Manager',
      type: 'support',
      level: 4,
      permissions: {
        developers: ['read', 'write'],
        projects: ['read'],
        support: ['read', 'write'],
      },
      canHandle: ['developer-onboarding', 'performance-review', 'dispute-mediation'],
    }),
    createBusinessRole({
      id: 'client-success',
      name: 'Client Success Manager',
      type: 'support',
      level: 4,
      permissions: {
        clients: ['read', 'write'],
        projects: ['read', 'write'],
        contracts: ['read'],
      },
      canHandle: ['client-onboarding', 'match-review', 'expansion'],
    }),
    createBusinessRole({
      id: 'matcher',
      name: 'Matching Specialist',
      type: 'support',
      level: 3,
      workerType: 'hybrid', // AI + human
      permissions: {
        developers: ['read'],
        clients: ['read'],
        projects: ['read', 'write'],
      },
      canHandle: ['initial-matching', 'shortlist-curation', 'match-optimization'],
    }),
    createBusinessRole({
      id: 'dispute-resolver',
      name: 'Dispute Resolver',
      type: 'support',
      level: 4,
      permissions: {
        disputes: ['read', 'write', 'resolve'],
        payments: ['read', 'hold', 'release'],
        developers: ['read'],
        clients: ['read'],
      },
      canHandle: ['dispute-investigation', 'mediation', 'refund-decision'],
      canApprove: ['refund', 'payment-release'],
    }),
    createBusinessRole({
      id: 'ai-matcher',
      name: 'AI Matching Agent',
      type: 'agent',
      level: 2,
      workerType: 'ai',
      permissions: {
        developers: ['read'],
        clients: ['read'],
        projects: ['read'],
        matches: ['read', 'write', 'suggest'],
      },
      canHandle: ['initial-matching', 'score-calculation', 'availability-check'],
    }),
    createBusinessRole({
      id: 'support-bot',
      name: 'Support Bot',
      type: 'agent',
      level: 1,
      workerType: 'ai',
      permissions: {
        support: ['read', 'write'],
        faq: ['read'],
      },
      canHandle: ['faq-response', 'status-check', 'basic-troubleshooting'],
    }),
  ],
  approvalChains: [
    {
      id: 'refund-approval',
      name: 'Refund Approval',
      requestType: 'refund',
      levels: [
        { threshold: 500, approvers: [{ type: 'role', roleId: 'dispute-resolver' }] },
        { threshold: 2000, approvers: [{ type: 'manager' }] },
        { threshold: 10000, approvers: [{ type: 'department-head' }] },
        { threshold: Infinity, approvers: [{ type: 'role', roleId: 'cfo' }] },
      ],
    },
    {
      id: 'developer-approval',
      name: 'Developer Approval',
      requestType: 'developer-approval',
      levels: [
        { threshold: 1, approvers: [{ type: 'role', roleId: 'vetter' }] }, // Standard
        { threshold: 2, approvers: [{ type: 'role', roleId: 'vetting-manager' }] }, // Exception
      ],
    },
  ],
  routingRules: [
    {
      id: 'project-matching',
      taskType: 'project-matching',
      priority: 1,
      assignTo: { roleId: 'ai-matcher' },
    },
    {
      id: 'vetting-assignment',
      taskType: 'developer-vetting',
      priority: 1,
      assignTo: { roleId: 'vetter' },
    },
    {
      id: 'dispute-routing',
      taskType: 'dispute',
      priority: 1,
      assignTo: { roleId: 'dispute-resolver' },
    },
    {
      id: 'support-routing',
      taskType: 'support-ticket',
      priority: 1,
      assignTo: { roleId: 'support-bot' },
    },
  ],
}

// =============================================================================
// 5. KPIs & METRICS
// =============================================================================

export const TalentHubKPIs = kpis([
  // Marketplace Metrics
  {
    name: 'Gross Merchandise Value (GMV)',
    category: 'financial',
    target: 100000000,
    current: 60000000,
    unit: 'USD',
    frequency: 'monthly',
    owner: 'CEO',
  },
  {
    name: 'Take Rate',
    category: 'financial',
    target: 18,
    current: 17,
    unit: '%',
    frequency: 'monthly',
    owner: 'CEO',
  },
  {
    name: 'Net Revenue',
    category: 'financial',
    target: 18000000,
    current: 10200000,
    unit: 'USD',
    frequency: 'monthly',
    owner: 'CFO',
  },
  // Supply Metrics
  {
    name: 'Active Developers',
    category: 'supply',
    target: 20000,
    current: 12000,
    frequency: 'monthly',
    owner: 'VP Talent',
  },
  {
    name: 'Vetted Developers',
    category: 'supply',
    target: 15000,
    current: 9500,
    frequency: 'monthly',
    owner: 'VP Talent',
  },
  {
    name: 'Developer Utilization',
    category: 'supply',
    target: 70,
    current: 58,
    unit: '%',
    frequency: 'weekly',
    owner: 'VP Talent',
  },
  {
    name: 'Developer NPS',
    category: 'supply',
    target: 65,
    current: 58,
    frequency: 'quarterly',
    owner: 'VP Talent',
  },
  // Demand Metrics
  {
    name: 'Active Clients',
    category: 'demand',
    target: 3000,
    current: 1800,
    frequency: 'monthly',
    owner: 'VP Sales',
  },
  {
    name: 'Average Project Size',
    category: 'demand',
    target: 25000,
    current: 18000,
    unit: 'USD',
    frequency: 'monthly',
    owner: 'VP Sales',
  },
  {
    name: 'Client Retention',
    category: 'demand',
    target: 85,
    current: 78,
    unit: '%',
    frequency: 'quarterly',
    owner: 'VP Client Success',
  },
  {
    name: 'Client NPS',
    category: 'demand',
    target: 60,
    current: 52,
    frequency: 'quarterly',
    owner: 'VP Client Success',
  },
  // Matching Metrics
  {
    name: 'Match Success Rate',
    category: 'operational',
    target: 90,
    current: 82,
    unit: '%',
    frequency: 'weekly',
    owner: 'VP Product',
  },
  {
    name: 'Time to Match',
    category: 'operational',
    target: 48,
    current: 72,
    unit: 'hours',
    frequency: 'weekly',
    owner: 'VP Product',
  },
  {
    name: 'Project Completion Rate',
    category: 'operational',
    target: 95,
    current: 91,
    unit: '%',
    frequency: 'monthly',
    owner: 'VP Operations',
  },
  // Trust & Safety
  {
    name: 'Dispute Rate',
    category: 'operational',
    target: 2,
    current: 3.5,
    unit: '%',
    frequency: 'monthly',
    owner: 'VP Operations',
  },
  {
    name: 'Fraud Rate',
    category: 'operational',
    target: 0.1,
    current: 0.15,
    unit: '%',
    frequency: 'monthly',
    owner: 'Trust & Safety Lead',
  },
])

// =============================================================================
// 6. OKRs
// =============================================================================

export const TalentHubOKRs = okrs([
  {
    objective: 'Build the Most Effective Matching Engine',
    owner: 'VP Product',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Achieve 85% match success rate',
        metric: 'Match Success Rate',
        targetValue: 85,
        currentValue: 82,
        unit: '%',
      },
      {
        description: 'Reduce time to match to 48 hours',
        metric: 'Time to Match',
        targetValue: 48,
        currentValue: 72,
        unit: 'hours',
      },
      {
        description: 'Launch AI Matching 2.0',
        metric: 'Features Launched',
        targetValue: 1,
        currentValue: 0,
      },
    ],
  },
  {
    objective: 'Scale Supply with Quality',
    owner: 'VP Talent',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Reach 12K vetted developers',
        metric: 'Vetted Developers',
        targetValue: 12000,
        currentValue: 9500,
      },
      {
        description: 'Achieve 70% developer utilization',
        metric: 'Developer Utilization',
        targetValue: 70,
        currentValue: 58,
        unit: '%',
      },
      {
        description: 'Improve developer NPS to 62',
        metric: 'Developer NPS',
        targetValue: 62,
        currentValue: 58,
      },
    ],
  },
  {
    objective: 'Grow Enterprise Segment',
    owner: 'VP Sales',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Close 50 new enterprise clients',
        metric: 'Enterprise Clients',
        targetValue: 50,
        currentValue: 28,
      },
      {
        description: 'Increase APS to $22K',
        metric: 'Average Project Size',
        targetValue: 22000,
        currentValue: 18000,
        unit: 'USD',
      },
      {
        description: 'Achieve 82% client retention',
        metric: 'Client Retention',
        targetValue: 82,
        currentValue: 78,
        unit: '%',
      },
    ],
  },
  {
    objective: 'Build Trust & Safety Excellence',
    owner: 'VP Operations',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Reduce dispute rate to 2.5%',
        metric: 'Dispute Rate',
        targetValue: 2.5,
        currentValue: 3.5,
        unit: '%',
      },
      {
        description: 'Achieve 95% project completion',
        metric: 'Project Completion',
        targetValue: 95,
        currentValue: 91,
        unit: '%',
      },
      {
        description: 'Reduce fraud rate to 0.1%',
        metric: 'Fraud Rate',
        targetValue: 0.1,
        currentValue: 0.15,
        unit: '%',
      },
    ],
  },
])

// =============================================================================
// 7. PROCESSES
// =============================================================================

export const DeveloperVettingProcess = Process({
  name: 'Developer Vetting',
  description: 'Comprehensive vetting process for new developers',
  owner: 'VP Talent',
  steps: [
    {
      order: 1,
      name: 'Application',
      description: 'Developer submits application',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 2,
      name: 'Initial Screening',
      description: 'AI screens application for basic requirements',
      automationLevel: 'automated',
      duration: '5 minutes',
    },
    {
      order: 3,
      name: 'Skills Assessment',
      description: 'Automated coding assessment',
      automationLevel: 'automated',
      duration: '2 hours',
    },
    {
      order: 4,
      name: 'Technical Interview',
      description: 'Live technical interview with vetter',
      automationLevel: 'manual',
      duration: '1 hour',
      owner: 'Technical Vetter',
    },
    {
      order: 5,
      name: 'Background Check',
      description: 'Identity and background verification',
      automationLevel: 'semi-automated',
      duration: '3 days',
    },
    {
      order: 6,
      name: 'Reference Check',
      description: 'Verify work references',
      automationLevel: 'semi-automated',
      duration: '2 days',
    },
    {
      order: 7,
      name: 'Profile Review',
      description: 'Final review and approval',
      automationLevel: 'manual',
      duration: '1 day',
      owner: 'Vetting Manager',
    },
    {
      order: 8,
      name: 'Onboarding',
      description: 'Developer onboarding and training',
      automationLevel: 'semi-automated',
      duration: '1 day',
    },
  ],
  metrics: [
    { name: 'Time to Vet', target: 7, unit: 'days' },
    { name: 'Acceptance Rate', target: 25, unit: '%' },
    { name: 'Quality Score', target: 85, unit: '%' },
  ],
})

export const ProjectMatchingProcess = Process({
  name: 'Project Matching',
  description: 'Match developers to client projects',
  owner: 'VP Product',
  steps: [
    {
      order: 1,
      name: 'Project Intake',
      description: 'Client posts project requirements',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 2,
      name: 'Requirement Analysis',
      description: 'AI analyzes and structures requirements',
      automationLevel: 'automated',
      duration: '5 minutes',
    },
    {
      order: 3,
      name: 'AI Matching',
      description: 'AI generates candidate shortlist',
      automationLevel: 'automated',
      duration: '10 minutes',
    },
    {
      order: 4,
      name: 'Availability Check',
      description: 'Verify candidate availability',
      automationLevel: 'automated',
      duration: '1 hour',
    },
    {
      order: 5,
      name: 'Human Review',
      description: 'Matching specialist reviews shortlist',
      automationLevel: 'manual',
      duration: '4 hours',
      owner: 'Matching Specialist',
    },
    {
      order: 6,
      name: 'Client Presentation',
      description: 'Present shortlist to client',
      automationLevel: 'semi-automated',
      duration: '1 day',
    },
    {
      order: 7,
      name: 'Interviews',
      description: 'Client interviews candidates',
      automationLevel: 'manual',
      duration: '3 days',
    },
    {
      order: 8,
      name: 'Selection',
      description: 'Client selects developer',
      automationLevel: 'manual',
      duration: '1 day',
    },
    {
      order: 9,
      name: 'Contract',
      description: 'Generate and sign contract',
      automationLevel: 'semi-automated',
      duration: '1 day',
    },
  ],
  metrics: [
    { name: 'Time to Match', target: 48, unit: 'hours' },
    { name: 'Match Success Rate', target: 90, unit: '%' },
    { name: 'Interviews per Match', target: 3 },
  ],
})

export const DisputeResolutionProcess = Process({
  name: 'Dispute Resolution',
  description: 'Resolve disputes between clients and developers',
  owner: 'VP Operations',
  steps: [
    {
      order: 1,
      name: 'Dispute Filed',
      description: 'Party files dispute',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 2,
      name: 'Auto-Hold',
      description: 'Hold disputed funds in escrow',
      automationLevel: 'automated',
      duration: 'instant',
    },
    {
      order: 3,
      name: 'Evidence Collection',
      description: 'Both parties submit evidence',
      automationLevel: 'semi-automated',
      duration: '3 days',
    },
    {
      order: 4,
      name: 'AI Analysis',
      description: 'AI analyzes dispute and evidence',
      automationLevel: 'automated',
      duration: '1 hour',
    },
    {
      order: 5,
      name: 'Investigation',
      description: 'Dispute resolver investigates',
      automationLevel: 'manual',
      duration: '2 days',
      owner: 'Dispute Resolver',
    },
    {
      order: 6,
      name: 'Mediation',
      description: 'Attempt to mediate resolution',
      automationLevel: 'manual',
      duration: '2 days',
      owner: 'Dispute Resolver',
    },
    {
      order: 7,
      name: 'Decision',
      description: 'Make binding decision',
      automationLevel: 'manual',
      duration: '1 day',
      owner: 'Dispute Resolver',
    },
    {
      order: 8,
      name: 'Fund Release',
      description: 'Release funds per decision',
      automationLevel: 'semi-automated',
      duration: '1 day',
    },
  ],
  metrics: [
    { name: 'Resolution Time', target: 7, unit: 'days' },
    { name: 'Satisfaction Rate', target: 75, unit: '%' },
    { name: 'Appeal Rate', target: 10, unit: '%' },
  ],
})

// =============================================================================
// 8. WORKFLOWS
// =============================================================================

export const MatchingWorkflow = Workflow({
  name: 'AI Matching',
  description: 'Automated matching of developers to projects',
  trigger: { type: 'event', event: 'project.posted' },
  actions: [
    {
      order: 1,
      type: 'compute',
      name: 'Parse Requirements',
      config: {
        extract: ['skills', 'experience', 'availability', 'budget', 'timezone'],
      },
    },
    {
      order: 2,
      type: 'compute',
      name: 'Query Candidates',
      config: {
        filters: ['skills_match', 'available', 'rate_range'],
        limit: 100,
      },
    },
    {
      order: 3,
      type: 'compute',
      name: 'Score Candidates',
      config: {
        factors: ['skill_match', 'experience_match', 'availability', 'rating', 'past_performance'],
        weights: [0.3, 0.2, 0.15, 0.2, 0.15],
      },
    },
    {
      order: 4,
      type: 'compute',
      name: 'Generate Shortlist',
      config: {
        top_n: 10,
        diversity: true,
        exclude_recent: true,
      },
    },
    {
      order: 5,
      type: 'notification',
      name: 'Notify Candidates',
      config: {
        channel: 'email',
        template: 'project_opportunity',
      },
    },
    {
      order: 6,
      type: 'task',
      name: 'Queue Human Review',
      config: {
        type: 'match-review',
        assignTo: 'matcher',
        dueIn: '4 hours',
      },
    },
  ],
})

export const UtilizationAlertWorkflow = Workflow({
  name: 'Developer Utilization Alert',
  description: 'Alert when developer utilization drops',
  trigger: { type: 'schedule', cron: '0 9 * * 1' }, // Weekly Monday 9am
  actions: [
    {
      order: 1,
      type: 'compute',
      name: 'Calculate Utilization',
      config: {
        lookback: '30 days',
        threshold: 40, // % utilization
      },
    },
    {
      order: 2,
      type: 'condition',
      name: 'Check Low Utilization',
      condition: 'developer.utilization < 40',
    },
    {
      order: 3,
      type: 'notification',
      name: 'Alert Talent Success',
      config: {
        channel: 'slack',
        template: 'low_utilization_alert',
      },
    },
    {
      order: 4,
      type: 'task',
      name: 'Create Outreach Task',
      config: {
        type: 'developer-outreach',
        assignTo: 'talent-success',
        data: ['developer.id', 'utilization', 'last_project'],
      },
    },
  ],
})

export const PaymentReleaseWorkflow = Workflow({
  name: 'Milestone Payment Release',
  description: 'Process milestone completion and payment release',
  trigger: { type: 'event', event: 'milestone.submitted' },
  actions: [
    {
      order: 1,
      type: 'notification',
      name: 'Notify Client',
      config: {
        channel: 'email',
        template: 'milestone_submitted',
      },
    },
    {
      order: 2,
      type: 'wait',
      name: 'Wait for Approval',
      duration: '5 days',
    },
    {
      order: 3,
      type: 'condition',
      name: 'Check Approval',
      condition: 'milestone.status == "approved" || milestone.autoApprove == true',
    },
    {
      order: 4,
      type: 'api',
      name: 'Release Payment',
      config: {
        action: 'release_escrow',
        amount: '${milestone.amount}',
        to: '${developer.payoutMethod}',
      },
    },
    {
      order: 5,
      type: 'notification',
      name: 'Confirm Payment',
      config: {
        channel: 'email',
        template: 'payment_released',
        to: ['client', 'developer'],
      },
    },
    {
      order: 6,
      type: 'compute',
      name: 'Update Metrics',
      config: {
        update: ['gmv', 'developer_earnings', 'project_progress'],
      },
    },
  ],
})

// =============================================================================
// 9. FINANCIALS
// =============================================================================

export const TalentHubFinancials = financials({
  revenue: 10800000, // Net revenue (GMV * take rate)
  cogs: 2160000, // 20% (payments, vetting, support)
  operatingExpenses: 7800000,
  depreciation: 100000,
  interestExpense: 0,
  otherIncome: 50000,
  taxes: 150000,
})

export const MarketplaceMetrics = {
  gmv: 60000000, // yearly
  takeRate: 0.17,
  netRevenue: 10200000,
  supply: {
    totalDevelopers: 15000,
    vettedDevelopers: 9500,
    activeDevelopers: 12000,
    utilization: 58, // %
    avgHourlyRate: 75,
    developerNps: 58,
  },
  demand: {
    totalClients: 2500,
    activeClients: 1800,
    enterpriseClients: 150,
    avgProjectSize: 18000,
    repeatRate: 65, // %
    clientNps: 52,
  },
  matching: {
    successRate: 82, // %
    timeToMatch: 72, // hours
    interviewsPerMatch: 3.5,
  },
  trustSafety: {
    disputeRate: 3.5, // %
    fraudRate: 0.15, // %
    completionRate: 91, // %
  },
  economics: {
    cac: 450,
    ltv: 8500,
    paybackPeriod: 4, // months
  },
}

// =============================================================================
// 10. UTILITY FUNCTIONS
// =============================================================================

export function getBusinessSummary() {
  return {
    company: TalentHubBusiness,
    vision: TalentHubVision,
    goals: TalentHubGoals,
    products: { platform: MarketplacePlatform, client: ClientProducts, developer: DeveloperProducts },
    kpis: TalentHubKPIs,
    okrs: TalentHubOKRs,
    financials: TalentHubFinancials,
    metrics: MarketplaceMetrics,
  }
}

export function getMarketplaceHealth() {
  const liquidity = MarketplaceMetrics.supply.activeDevelopers / MarketplaceMetrics.demand.activeClients
  return {
    gmv: $.format(MarketplaceMetrics.gmv),
    takeRate: `${(MarketplaceMetrics.takeRate * 100).toFixed(0)}%`,
    liquidity: liquidity.toFixed(2),
    supplyUtilization: `${MarketplaceMetrics.supply.utilization}%`,
    matchSuccessRate: `${MarketplaceMetrics.matching.successRate}%`,
  }
}

export function getSupplyDemandBalance() {
  return {
    developers: {
      total: MarketplaceMetrics.supply.totalDevelopers.toLocaleString(),
      active: MarketplaceMetrics.supply.activeDevelopers.toLocaleString(),
      utilization: `${MarketplaceMetrics.supply.utilization}%`,
    },
    clients: {
      total: MarketplaceMetrics.demand.totalClients.toLocaleString(),
      active: MarketplaceMetrics.demand.activeClients.toLocaleString(),
      repeatRate: `${MarketplaceMetrics.demand.repeatRate}%`,
    },
  }
}

export default {
  business: TalentHubBusiness,
  vision: TalentHubVision,
  goals: TalentHubGoals,
  products: { platform: MarketplacePlatform, client: ClientProducts, developer: DeveloperProducts },
  services: Services,
  organization: TalentHubOrg,
  kpis: TalentHubKPIs,
  okrs: TalentHubOKRs,
  processes: {
    vetting: DeveloperVettingProcess,
    matching: ProjectMatchingProcess,
    dispute: DisputeResolutionProcess,
  },
  workflows: {
    matching: MatchingWorkflow,
    utilization: UtilizationAlertWorkflow,
    payment: PaymentReleaseWorkflow,
  },
  financials: TalentHubFinancials,
  metrics: MarketplaceMetrics,
}
