/**
 * Startup Studio Business Example
 *
 * A complete example of a startup studio modeled using primitives.org.ai
 * Think: Atomic, Idealab, Pioneer, Human Ventures, Diagram
 *
 * @example VentureForge - A startup studio building B2B SaaS companies
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
 * VentureForge - B2B SaaS Startup Studio
 */
export const VentureForgeBusiness = Business({
  name: 'VentureForge Studios',
  mission: 'Build and launch the next generation of B2B SaaS companies',
  values: ['Builder Mindset', 'Customer Obsession', 'Speed & Learning', 'Shared Success'],
  industry: 'Venture Building / Startup Studio',
  founded: new Date('2018-05-01'),
  stage: 'established',
  structure: {
    departments: [
      {
        name: 'Venture Team',
        headcount: 12,
        budget: 2000000,
        teams: [
          { name: 'Ideation', headcount: 3, focus: 'Idea generation & validation' },
          { name: 'Building', headcount: 6, focus: 'Product development' },
          { name: 'Growth', headcount: 3, focus: 'GTM & scaling' },
        ],
      },
      {
        name: 'Platform',
        headcount: 8,
        budget: 1200000,
        teams: [
          { name: 'Engineering', headcount: 4, focus: 'Shared infrastructure' },
          { name: 'Design', headcount: 2, focus: 'Brand & product design' },
          { name: 'Data', headcount: 2, focus: 'Analytics & insights' },
        ],
      },
      {
        name: 'Talent & Ops',
        headcount: 5,
        budget: 800000,
        teams: [
          { name: 'Talent', headcount: 2, focus: 'Recruiting founders & team' },
          { name: 'Operations', headcount: 2, focus: 'Finance, legal, admin' },
          { name: 'People', headcount: 1, focus: 'HR & culture' },
        ],
      },
      {
        name: 'Investment',
        headcount: 3,
        budget: 400000,
        teams: [
          { name: 'Fundraising', headcount: 2, focus: 'LP relations, capital' },
          { name: 'Portfolio', headcount: 1, focus: 'Portfolio support' },
        ],
      },
    ],
  },
})

// =============================================================================
// 2. VISION & GOALS
// =============================================================================

export const VentureForgeVision = Vision({
  statement: 'Build 100 enduring B2B companies that transform industries',
  timeHorizon: '2030',
  pillars: [
    'Idea Quality',
    'Builder Excellence',
    'Speed to Market',
    'Portfolio Returns',
  ],
  successIndicators: [
    { name: 'Companies Built', target: 100 },
    { name: 'Portfolio Value', target: 5000000000, unit: 'USD' },
    { name: 'Successful Exits', target: 20 },
    { name: 'Combined ARR', target: 500000000, unit: 'USD' },
  ],
})

export const VentureForgeGoals = Goals([
  {
    name: 'Launch 5 New Ventures',
    category: 'operational',
    status: 'in-progress',
    progress: 40,
    dueDate: new Date('2024-12-31'),
    owner: 'Managing Partner',
  },
  {
    name: 'Raise Fund III ($100M)',
    category: 'financial',
    status: 'in-progress',
    progress: 60,
    dueDate: new Date('2024-06-30'),
    owner: 'Head of Fundraising',
  },
  {
    name: 'Achieve $50M Portfolio ARR',
    category: 'financial',
    status: 'in-progress',
    progress: 70,
    dueDate: new Date('2024-12-31'),
    owner: 'Managing Partner',
  },
  {
    name: '2 Portfolio Exits',
    category: 'strategic',
    status: 'in-progress',
    progress: 50,
    dueDate: new Date('2024-12-31'),
    owner: 'Portfolio Lead',
  },
  {
    name: 'Build AI-Native Venture Platform',
    category: 'product',
    status: 'in-progress',
    progress: 30,
    dueDate: new Date('2024-09-30'),
    owner: 'Platform Lead',
  },
])

// =============================================================================
// 3. STUDIO SERVICES & PRODUCTS
// =============================================================================

/**
 * Studio Services - What VentureForge provides to portfolio companies
 */
export const StudioServices = {
  ideation: Service({
    name: 'Ideation & Validation',
    description: 'Market research, opportunity identification, and validation',
    pricingModel: 'equity',
    deliverables: [
      'Market research & sizing',
      'Competitive analysis',
      'Customer discovery (50+ interviews)',
      'Problem-solution fit validation',
      'Business model design',
    ],
  }),
  building: Service({
    name: 'Product Building',
    description: 'Full product development from 0 to MVP',
    pricingModel: 'equity',
    deliverables: [
      'Product strategy & roadmap',
      'UX/UI design',
      'Technical architecture',
      'MVP development',
      'Quality assurance',
    ],
  }),
  growth: Service({
    name: 'Go-to-Market',
    description: 'Launch and scale the business',
    pricingModel: 'equity',
    deliverables: [
      'Brand & positioning',
      'Marketing strategy',
      'Sales playbook',
      'First customers',
      'Growth experiments',
    ],
  }),
  operations: Service({
    name: 'Operational Support',
    description: 'Back-office and operational support',
    pricingModel: 'equity',
    deliverables: [
      'Legal & incorporation',
      'Finance & accounting',
      'HR & recruiting',
      'Compliance',
      'Office & infrastructure',
    ],
  }),
  capital: Service({
    name: 'Capital & Fundraising',
    description: 'Funding and investor relations',
    pricingModel: 'equity',
    deliverables: [
      'Initial capital ($500K-$2M)',
      'Fundraising support',
      'Investor introductions',
      'Board setup',
      'Follow-on capital',
    ],
  }),
}

/**
 * Studio Products - Shared infrastructure for portfolio
 */
export const StudioProducts = {
  launchpad: Product({
    name: 'VentureForge Launchpad',
    description: 'Shared technical infrastructure for ventures',
    pricingModel: 'free', // Included with studio
    features: [
      'Authentication & user management',
      'Payment processing',
      'Email & notifications',
      'Analytics & monitoring',
      'CI/CD pipelines',
      'Cloud infrastructure',
    ],
  }),
  analytics: Product({
    name: 'Portfolio Analytics',
    description: 'Cross-portfolio insights and benchmarks',
    pricingModel: 'free',
    features: [
      'Revenue tracking',
      'Growth metrics',
      'Benchmark comparisons',
      'Cohort analysis',
      'Forecasting',
    ],
  }),
}

/**
 * Investment Terms
 */
export const InvestmentTerms = {
  standard: {
    studioEquity: 30, // % equity for studio services
    initialCapital: 1000000, // $1M initial investment
    proRataRights: true,
    boardSeat: true,
    investmentPeriod: '18 months',
  },
  eir: { // Entrepreneur in Residence
    studioEquity: 25,
    founderEquity: 25, // Founder gets more
    initialCapital: 500000,
    proRataRights: true,
    boardSeat: true,
  },
  spinout: {
    studioEquity: 40,
    initialCapital: 2000000,
    proRataRights: true,
    boardSeat: true,
    founderSearch: true,
  },
}

// =============================================================================
// 4. ORGANIZATION & ROLES
// =============================================================================

export const VentureForgeOrg: Organization = {
  id: 'ventureforge',
  name: 'VentureForge Studios',
  settings: {
    timezone: 'America/San_Francisco',
    currency: 'USD',
    fiscalYearStart: 1,
  },
  departments: [
    {
      id: 'venture',
      name: 'Venture Team',
      permissions: {
        ventures: ['read', 'write', 'create', 'manage'],
        ideas: ['read', 'write', 'validate', 'approve'],
        portfolio: ['read', 'write'],
      },
      teams: [
        {
          id: 'ideation',
          name: 'Ideation',
          positions: [
            { id: 'ideation-lead', title: 'Head of Ideation', roleId: 'venture-partner', reportsTo: 'mp' },
            { id: 'researcher-1', title: 'Market Researcher', roleId: 'venture-analyst', reportsTo: 'ideation-lead' },
          ],
        },
        {
          id: 'building',
          name: 'Building',
          positions: [
            { id: 'build-lead', title: 'Head of Building', roleId: 'venture-partner', reportsTo: 'mp' },
            { id: 'tech-lead', title: 'Technical Lead', roleId: 'tech-lead', reportsTo: 'build-lead' },
            { id: 'design-lead', title: 'Design Lead', roleId: 'design-lead', reportsTo: 'build-lead' },
          ],
        },
      ],
    },
    {
      id: 'platform',
      name: 'Platform',
      permissions: {
        infrastructure: ['read', 'write', 'deploy'],
        tools: ['read', 'write', 'manage'],
        data: ['read', 'write'],
      },
    },
    {
      id: 'investment',
      name: 'Investment',
      permissions: {
        fund: ['read', 'write', 'manage'],
        lps: ['read', 'write'],
        portfolio: ['read', 'write', 'report'],
      },
    },
  ],
  roles: [
    createBusinessRole({
      id: 'managing-partner',
      name: 'Managing Partner',
      type: 'executive',
      level: 10,
      permissions: {
        ventures: ['read', 'write', 'create', 'approve', 'kill'],
        fund: ['read', 'write', 'manage'],
        portfolio: ['read', 'write', 'manage'],
      },
      canHandle: ['venture-approval', 'investment-decision', 'exit-negotiation'],
      canApprove: ['new-venture', 'investment', 'exit', 'hiring'],
    }),
    createBusinessRole({
      id: 'venture-partner',
      name: 'Venture Partner',
      type: 'executive',
      level: 8,
      permissions: {
        ventures: ['read', 'write', 'create'],
        portfolio: ['read', 'write'],
        ideas: ['read', 'write', 'validate'],
      },
      canHandle: ['venture-building', 'founder-coaching', 'idea-validation'],
      canApprove: ['milestone', 'hiring'],
    }),
    createBusinessRole({
      id: 'venture-analyst',
      name: 'Venture Analyst',
      type: 'analyst',
      level: 4,
      permissions: {
        ventures: ['read'],
        ideas: ['read', 'write', 'research'],
        portfolio: ['read'],
      },
      canHandle: ['market-research', 'competitive-analysis', 'customer-discovery'],
    }),
    createBusinessRole({
      id: 'tech-lead',
      name: 'Technical Lead',
      type: 'engineer',
      level: 6,
      permissions: {
        ventures: ['read'],
        code: ['read', 'write', 'deploy'],
        infrastructure: ['read', 'write'],
      },
      canHandle: ['architecture', 'mvp-building', 'tech-assessment'],
      canApprove: ['technical-decision', 'deployment'],
    }),
    createBusinessRole({
      id: 'design-lead',
      name: 'Design Lead',
      type: 'support',
      level: 5,
      permissions: {
        ventures: ['read'],
        design: ['read', 'write', 'publish'],
      },
      canHandle: ['brand-design', 'product-design', 'ux-research'],
    }),
    createBusinessRole({
      id: 'eir',
      name: 'Entrepreneur in Residence',
      type: 'executive',
      level: 7,
      permissions: {
        ventures: ['read', 'write'],
        ideas: ['read', 'write', 'validate'],
      },
      canHandle: ['idea-exploration', 'venture-building', 'founder-role'],
    }),
    createBusinessRole({
      id: 'portfolio-ceo',
      name: 'Portfolio Company CEO',
      type: 'executive',
      level: 9,
      permissions: {
        ventures: ['read', 'write'], // Their venture only
      },
      canHandle: ['company-leadership', 'fundraising', 'team-building'],
    }),
  ],
  approvalChains: [
    {
      id: 'new-venture',
      name: 'New Venture Approval',
      requestType: 'new-venture',
      levels: [
        { threshold: 1, approvers: [{ type: 'role', roleId: 'venture-partner' }] }, // Initial
        { threshold: 2, approvers: [{ type: 'role', roleId: 'managing-partner' }] }, // Final
      ],
    },
    {
      id: 'investment',
      name: 'Investment Approval',
      requestType: 'investment',
      levels: [
        { threshold: 100000, approvers: [{ type: 'role', roleId: 'venture-partner' }] },
        { threshold: 500000, approvers: [{ type: 'role', roleId: 'managing-partner' }] },
        { threshold: Infinity, approvers: [{ type: 'all-partners' }] },
      ],
    },
  ],
  routingRules: [
    {
      id: 'idea-research',
      taskType: 'market-research',
      priority: 1,
      assignTo: { roleId: 'venture-analyst' },
    },
    {
      id: 'mvp-building',
      taskType: 'mvp-development',
      priority: 1,
      assignTo: { roleId: 'tech-lead' },
    },
    {
      id: 'venture-coaching',
      taskType: 'founder-coaching',
      priority: 1,
      assignTo: { roleId: 'venture-partner' },
    },
  ],
}

// =============================================================================
// 5. PORTFOLIO COMPANIES
// =============================================================================

export interface PortfolioCompany {
  id: string
  name: string
  thesis: string
  stage: 'ideation' | 'validation' | 'building' | 'growth' | 'scale' | 'exit'
  founded: Date
  founders: string[]
  sector: string
  metrics: {
    arr?: number
    mrr?: number
    customers?: number
    employees?: number
    funding?: number
    valuation?: number
  }
  studioEquity: number
  status: 'active' | 'graduated' | 'shut-down' | 'exited'
}

export const Portfolio: PortfolioCompany[] = [
  {
    id: 'dataflow',
    name: 'DataFlow',
    thesis: 'Modern data pipeline for SMBs',
    stage: 'scale',
    founded: new Date('2020-03-15'),
    founders: ['Alex Chen', 'Maria Santos'],
    sector: 'Data Infrastructure',
    metrics: {
      arr: 8500000,
      mrr: 708333,
      customers: 450,
      employees: 45,
      funding: 25000000,
      valuation: 85000000,
    },
    studioEquity: 28,
    status: 'active',
  },
  {
    id: 'complianceai',
    name: 'ComplianceAI',
    thesis: 'AI-powered compliance automation',
    stage: 'growth',
    founded: new Date('2021-06-01'),
    founders: ['James Wilson'],
    sector: 'RegTech',
    metrics: {
      arr: 3200000,
      mrr: 266667,
      customers: 120,
      employees: 22,
      funding: 12000000,
      valuation: 40000000,
    },
    studioEquity: 30,
    status: 'active',
  },
  {
    id: 'talentops',
    name: 'TalentOps',
    thesis: 'HR operations platform for remote teams',
    stage: 'growth',
    founded: new Date('2021-09-15'),
    founders: ['Sarah Kim', 'David Park'],
    sector: 'HR Tech',
    metrics: {
      arr: 2100000,
      mrr: 175000,
      customers: 200,
      employees: 18,
      funding: 8000000,
      valuation: 25000000,
    },
    studioEquity: 32,
    status: 'active',
  },
  {
    id: 'securestack',
    name: 'SecureStack',
    thesis: 'Developer security platform',
    stage: 'building',
    founded: new Date('2023-01-10'),
    founders: ['Mike Johnson'],
    sector: 'Security',
    metrics: {
      arr: 450000,
      mrr: 37500,
      customers: 35,
      employees: 8,
      funding: 2000000,
      valuation: 8000000,
    },
    studioEquity: 30,
    status: 'active',
  },
  {
    id: 'aiwriter',
    name: 'AIWriter',
    thesis: 'AI content generation for marketing',
    stage: 'validation',
    founded: new Date('2023-09-01'),
    founders: ['EIR: John Smith'],
    sector: 'MarTech',
    metrics: {
      mrr: 15000,
      customers: 50,
      employees: 3,
      funding: 500000,
    },
    studioEquity: 25,
    status: 'active',
  },
  {
    id: 'cloudcost',
    name: 'CloudCost',
    thesis: 'Cloud cost optimization',
    stage: 'exit',
    founded: new Date('2019-08-01'),
    founders: ['Tom Brown', 'Lisa White'],
    sector: 'FinOps',
    metrics: {
      arr: 12000000,
      customers: 300,
      employees: 65,
      funding: 35000000,
      valuation: 150000000,
    },
    studioEquity: 25,
    status: 'exited', // Acquired
  },
]

// =============================================================================
// 6. KPIs & METRICS
// =============================================================================

export const VentureForgeKPIs = kpis([
  // Portfolio Metrics
  {
    name: 'Portfolio ARR',
    category: 'financial',
    target: 50000000,
    current: 35750000,
    unit: 'USD',
    frequency: 'monthly',
    owner: 'Managing Partner',
  },
  {
    name: 'Portfolio Valuation',
    category: 'financial',
    target: 500000000,
    current: 308000000,
    unit: 'USD',
    frequency: 'quarterly',
    owner: 'Managing Partner',
  },
  {
    name: 'Active Ventures',
    category: 'operational',
    target: 10,
    current: 5,
    frequency: 'monthly',
    owner: 'Head of Building',
  },
  {
    name: 'New Ventures / Year',
    category: 'operational',
    target: 5,
    current: 2,
    frequency: 'yearly',
    owner: 'Head of Ideation',
  },
  // Venture Building Metrics
  {
    name: 'Idea to Launch Time',
    category: 'operational',
    target: 6,
    current: 8,
    unit: 'months',
    frequency: 'quarterly',
    owner: 'Head of Building',
  },
  {
    name: 'Launch to $1M ARR Time',
    category: 'operational',
    target: 18,
    current: 24,
    unit: 'months',
    frequency: 'quarterly',
    owner: 'Managing Partner',
  },
  {
    name: 'Venture Success Rate',
    category: 'operational',
    target: 60,
    current: 55,
    unit: '%',
    frequency: 'yearly',
    owner: 'Managing Partner',
  },
  // Fund Metrics
  {
    name: 'Fund Deployed',
    category: 'financial',
    target: 80000000,
    current: 52000000,
    unit: 'USD',
    frequency: 'quarterly',
    owner: 'Head of Fundraising',
  },
  {
    name: 'TVPI (Total Value to Paid-In)',
    category: 'financial',
    target: 3.0,
    current: 2.4,
    frequency: 'quarterly',
    owner: 'Managing Partner',
  },
  {
    name: 'IRR',
    category: 'financial',
    target: 25,
    current: 22,
    unit: '%',
    frequency: 'yearly',
    owner: 'Managing Partner',
  },
  // Team Metrics
  {
    name: 'EIR Pipeline',
    category: 'talent',
    target: 10,
    current: 6,
    frequency: 'quarterly',
    owner: 'Head of Talent',
  },
  {
    name: 'Founder NPS',
    category: 'customer',
    target: 80,
    current: 72,
    frequency: 'quarterly',
    owner: 'Managing Partner',
  },
])

// =============================================================================
// 7. OKRs
// =============================================================================

export const VentureForgeOKRs = okrs([
  {
    objective: 'Build Portfolio to $50M ARR',
    owner: 'Managing Partner',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Grow DataFlow to $12M ARR',
        metric: 'DataFlow ARR',
        targetValue: 12000000,
        currentValue: 8500000,
        unit: 'USD',
      },
      {
        description: 'Grow ComplianceAI to $5M ARR',
        metric: 'ComplianceAI ARR',
        targetValue: 5000000,
        currentValue: 3200000,
        unit: 'USD',
      },
      {
        description: 'Launch 2 new ventures',
        metric: 'Ventures Launched',
        targetValue: 2,
        currentValue: 1,
      },
    ],
  },
  {
    objective: 'Accelerate Venture Building',
    owner: 'Head of Building',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Reduce idea-to-launch to 6 months',
        metric: 'Idea to Launch',
        targetValue: 6,
        currentValue: 8,
        unit: 'months',
      },
      {
        description: 'Ship 3 MVPs this quarter',
        metric: 'MVPs Shipped',
        targetValue: 3,
        currentValue: 1,
      },
      {
        description: 'Achieve 60% venture success rate',
        metric: 'Success Rate',
        targetValue: 60,
        currentValue: 55,
        unit: '%',
      },
    ],
  },
  {
    objective: 'Build World-Class Venture Platform',
    owner: 'Platform Lead',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Launch AI ideation assistant',
        metric: 'AI Features',
        targetValue: 1,
        currentValue: 0,
      },
      {
        description: '100% portfolio on shared infrastructure',
        metric: 'Platform Adoption',
        targetValue: 100,
        currentValue: 80,
        unit: '%',
      },
      {
        description: 'Reduce MVP build time by 30%',
        metric: 'Build Time Reduction',
        targetValue: 30,
        currentValue: 15,
        unit: '%',
      },
    ],
  },
  {
    objective: 'Close Fund III',
    owner: 'Head of Fundraising',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Raise $100M for Fund III',
        metric: 'Fund Size',
        targetValue: 100000000,
        currentValue: 60000000,
        unit: 'USD',
      },
      {
        description: 'Secure 3 anchor LPs',
        metric: 'Anchor LPs',
        targetValue: 3,
        currentValue: 2,
      },
      {
        description: 'Achieve 80% LP re-up rate',
        metric: 'LP Re-up',
        targetValue: 80,
        currentValue: 75,
        unit: '%',
      },
    ],
  },
])

// =============================================================================
// 8. PROCESSES
// =============================================================================

export const IdeaValidationProcess = Process({
  name: 'Idea Validation',
  description: 'Validate new venture ideas before committing resources',
  owner: 'Head of Ideation',
  steps: [
    {
      order: 1,
      name: 'Idea Submission',
      description: 'EIR or partner submits idea thesis',
      automationLevel: 'manual',
      duration: '1 day',
    },
    {
      order: 2,
      name: 'Market Research',
      description: 'Research market size, trends, competition',
      automationLevel: 'semi-automated',
      duration: '1 week',
      owner: 'Venture Analyst',
    },
    {
      order: 3,
      name: 'Customer Discovery',
      description: 'Conduct 20+ customer interviews',
      automationLevel: 'manual',
      duration: '2 weeks',
      owner: 'EIR',
    },
    {
      order: 4,
      name: 'Problem Validation',
      description: 'Validate problem-solution fit',
      automationLevel: 'manual',
      duration: '1 week',
      owner: 'Venture Partner',
    },
    {
      order: 5,
      name: 'Business Model',
      description: 'Design and validate business model',
      automationLevel: 'manual',
      duration: '1 week',
      owner: 'EIR',
    },
    {
      order: 6,
      name: 'Investment Committee',
      description: 'Present to IC for approval',
      automationLevel: 'manual',
      duration: '1 day',
      owner: 'Venture Partner',
    },
    {
      order: 7,
      name: 'Go/No-Go Decision',
      description: 'Final decision to proceed',
      automationLevel: 'manual',
      duration: '1 day',
      owner: 'Managing Partner',
    },
  ],
  metrics: [
    { name: 'Validation Time', target: 6, unit: 'weeks' },
    { name: 'Pass Rate', target: 30, unit: '%' },
    { name: 'Customer Interviews', target: 20 },
  ],
})

export const VentureBuildProcess = Process({
  name: 'Venture Building',
  description: 'Build new venture from validation to MVP',
  owner: 'Head of Building',
  steps: [
    {
      order: 1,
      name: 'Team Assembly',
      description: 'Assign founder and initial team',
      automationLevel: 'manual',
      duration: '2 weeks',
      owner: 'Head of Talent',
    },
    {
      order: 2,
      name: 'Incorporation',
      description: 'Legal setup and incorporation',
      automationLevel: 'semi-automated',
      duration: '1 week',
      owner: 'Operations',
    },
    {
      order: 3,
      name: 'Product Strategy',
      description: 'Define product vision and roadmap',
      automationLevel: 'manual',
      duration: '2 weeks',
      owner: 'Venture Partner',
    },
    {
      order: 4,
      name: 'Design Sprint',
      description: 'UX research and design',
      automationLevel: 'manual',
      duration: '2 weeks',
      owner: 'Design Lead',
    },
    {
      order: 5,
      name: 'MVP Development',
      description: 'Build minimum viable product',
      automationLevel: 'manual',
      duration: '8 weeks',
      owner: 'Tech Lead',
    },
    {
      order: 6,
      name: 'Beta Launch',
      description: 'Launch to beta customers',
      automationLevel: 'semi-automated',
      duration: '2 weeks',
    },
    {
      order: 7,
      name: 'Iterate',
      description: 'Customer feedback and iteration',
      automationLevel: 'manual',
      duration: '4 weeks',
      owner: 'Portfolio CEO',
    },
    {
      order: 8,
      name: 'GA Launch',
      description: 'General availability launch',
      automationLevel: 'semi-automated',
      duration: '2 weeks',
    },
  ],
  metrics: [
    { name: 'Time to MVP', target: 12, unit: 'weeks' },
    { name: 'Time to First Customer', target: 16, unit: 'weeks' },
    { name: 'Time to $100K ARR', target: 9, unit: 'months' },
  ],
})

export const PortfolioSupportProcess = Process({
  name: 'Portfolio Support',
  description: 'Ongoing support for portfolio companies',
  owner: 'Portfolio Lead',
  steps: [
    {
      order: 1,
      name: 'Weekly Sync',
      description: 'Weekly sync with portfolio CEO',
      automationLevel: 'manual',
      duration: '30 minutes',
      owner: 'Venture Partner',
    },
    {
      order: 2,
      name: 'Metric Review',
      description: 'Review weekly/monthly metrics',
      automationLevel: 'semi-automated',
      duration: '1 hour',
    },
    {
      order: 3,
      name: 'Board Meeting',
      description: 'Quarterly board meeting',
      automationLevel: 'manual',
      duration: '2 hours',
      owner: 'Venture Partner',
    },
    {
      order: 4,
      name: 'Fundraising Support',
      description: 'Help with Series A/B fundraising',
      automationLevel: 'manual',
      duration: '3 months',
      owner: 'Managing Partner',
    },
    {
      order: 5,
      name: 'Talent Support',
      description: 'Help with key hires',
      automationLevel: 'semi-automated',
      duration: 'ongoing',
      owner: 'Head of Talent',
    },
  ],
  metrics: [
    { name: 'NPS', target: 80 },
    { name: 'Follow-on Funding Rate', target: 80, unit: '%' },
    { name: 'Founder Retention', target: 90, unit: '%' },
  ],
})

// =============================================================================
// 9. WORKFLOWS
// =============================================================================

export const IdeaScreeningWorkflow = Workflow({
  name: 'Idea Screening',
  description: 'Initial screening of new venture ideas',
  trigger: { type: 'event', event: 'idea.submitted' },
  actions: [
    {
      order: 1,
      type: 'compute',
      name: 'AI Thesis Analysis',
      config: {
        analyze: ['market_size', 'competition', 'timing', 'fit'],
      },
    },
    {
      order: 2,
      type: 'compute',
      name: 'Score Idea',
      config: {
        factors: ['market', 'team', 'timing', 'defensibility', 'studio_fit'],
        weights: [0.25, 0.25, 0.2, 0.15, 0.15],
      },
    },
    {
      order: 3,
      type: 'condition',
      name: 'Check Score',
      condition: 'score >= 70',
    },
    {
      order: 4,
      type: 'notification',
      name: 'Alert Partner',
      config: {
        channel: 'slack',
        template: 'high_potential_idea',
      },
    },
    {
      order: 5,
      type: 'task',
      name: 'Assign Research',
      config: {
        type: 'market-research',
        assignTo: 'venture-analyst',
        dueIn: '1 week',
      },
    },
  ],
})

export const PortfolioAlertWorkflow = Workflow({
  name: 'Portfolio Health Alert',
  description: 'Alert on portfolio company health changes',
  trigger: { type: 'schedule', cron: '0 9 * * 1' }, // Weekly Monday 9am
  actions: [
    {
      order: 1,
      type: 'compute',
      name: 'Calculate Health Scores',
      config: {
        metrics: ['revenue_growth', 'burn_rate', 'runway', 'nrr', 'team_changes'],
      },
    },
    {
      order: 2,
      type: 'condition',
      name: 'Check At Risk',
      condition: 'healthScore < 60 || runway < 6',
    },
    {
      order: 3,
      type: 'notification',
      name: 'Alert Managing Partner',
      config: {
        channel: 'email',
        template: 'portfolio_at_risk',
        priority: 'high',
      },
    },
    {
      order: 4,
      type: 'task',
      name: 'Create Intervention Task',
      config: {
        type: 'portfolio-intervention',
        assignTo: 'venture-partner',
        data: ['company', 'healthScore', 'issues'],
      },
    },
  ],
})

export const FundraisingWorkflow = Workflow({
  name: 'Fundraising Support',
  description: 'Coordinate fundraising support for portfolio companies',
  trigger: { type: 'event', event: 'fundraising.initiated' },
  actions: [
    {
      order: 1,
      type: 'notification',
      name: 'Notify Team',
      config: {
        channel: 'slack',
        template: 'fundraising_kick_off',
        to: ['venture-partner', 'managing-partner'],
      },
    },
    {
      order: 2,
      type: 'task',
      name: 'Update Materials',
      config: {
        type: 'deck-review',
        assignTo: 'venture-partner',
        dueIn: '1 week',
      },
    },
    {
      order: 3,
      type: 'task',
      name: 'Investor Intros',
      config: {
        type: 'investor-intros',
        assignTo: 'managing-partner',
        dueIn: '2 weeks',
      },
    },
    {
      order: 4,
      type: 'wait',
      name: 'Wait for Process',
      duration: '2 weeks',
    },
    {
      order: 5,
      type: 'notification',
      name: 'Check-in',
      config: {
        channel: 'slack',
        template: 'fundraising_checkin',
      },
    },
  ],
})

// =============================================================================
// 10. FINANCIALS
// =============================================================================

export const VentureForgeFinancials = financials({
  revenue: 4400000, // Management fees + realized gains
  cogs: 0, // Venture building is internally resourced
  operatingExpenses: 4000000, // Team, office, operations
  depreciation: 50000,
  interestExpense: 0,
  otherIncome: 0,
  taxes: 100000,
})

export const StudioMetrics = {
  fund: {
    size: 80000000,
    deployed: 52000000,
    remaining: 28000000,
    managementFee: 0.02, // 2%
    carry: 0.20, // 20%
  },
  portfolio: {
    companies: 5,
    totalArr: 35750000,
    totalValuation: 308000000,
    avgEquity: 28, // %
    studioValue: 86240000, // Portfolio value * avg equity
  },
  performance: {
    tvpi: 2.4,
    dpi: 0.8, // Realized returns
    irr: 22, // %
    moic: 2.4,
  },
  operations: {
    venturesLaunched: 15, // All time
    successRate: 55, // %
    avgTimeToMvp: 8, // months
    avgTimeToMillionArr: 24, // months
  },
  lps: {
    count: 25,
    reupRate: 75, // %
  },
}

// =============================================================================
// 11. UTILITY FUNCTIONS
// =============================================================================

export function getBusinessSummary() {
  return {
    company: VentureForgeBusiness,
    vision: VentureForgeVision,
    goals: VentureForgeGoals,
    services: StudioServices,
    products: StudioProducts,
    portfolio: Portfolio,
    kpis: VentureForgeKPIs,
    okrs: VentureForgeOKRs,
    financials: VentureForgeFinancials,
    metrics: StudioMetrics,
  }
}

export function getPortfolioSummary() {
  const active = Portfolio.filter(c => c.status === 'active')
  const totalArr = active.reduce((sum, c) => sum + (c.metrics.arr || 0), 0)
  const totalValuation = active.reduce((sum, c) => sum + (c.metrics.valuation || 0), 0)

  return {
    activeCompanies: active.length,
    totalArr: $.format(totalArr),
    totalValuation: $.format(totalValuation),
    avgEquity: `${StudioMetrics.portfolio.avgEquity}%`,
    studioValue: $.format(totalValuation * (StudioMetrics.portfolio.avgEquity / 100)),
  }
}

export function getFundMetrics() {
  return {
    fundSize: $.format(StudioMetrics.fund.size),
    deployed: $.format(StudioMetrics.fund.deployed),
    remaining: $.format(StudioMetrics.fund.remaining),
    tvpi: `${StudioMetrics.performance.tvpi}x`,
    irr: `${StudioMetrics.performance.irr}%`,
  }
}

export function getCompanyByStage() {
  const byStage = Portfolio.reduce((acc, c) => {
    acc[c.stage] = (acc[c.stage] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  return byStage
}

export default {
  business: VentureForgeBusiness,
  vision: VentureForgeVision,
  goals: VentureForgeGoals,
  services: StudioServices,
  products: StudioProducts,
  investmentTerms: InvestmentTerms,
  organization: VentureForgeOrg,
  portfolio: Portfolio,
  kpis: VentureForgeKPIs,
  okrs: VentureForgeOKRs,
  processes: {
    ideaValidation: IdeaValidationProcess,
    ventureBuild: VentureBuildProcess,
    portfolioSupport: PortfolioSupportProcess,
  },
  workflows: {
    ideaScreening: IdeaScreeningWorkflow,
    portfolioAlert: PortfolioAlertWorkflow,
    fundraising: FundraisingWorkflow,
  },
  financials: VentureForgeFinancials,
  metrics: StudioMetrics,
}
