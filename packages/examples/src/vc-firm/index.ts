/**
 * VC Firm Business Example
 *
 * A complete example of a venture capital firm modeled using primitives.org.ai
 * Think: a16z, Sequoia, Benchmark, Accel, Index Ventures
 *
 * @example Catalyst Ventures - An early-stage enterprise VC firm
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
 * Catalyst Ventures - Early-Stage Enterprise VC
 */
export const CatalystVenturesBusiness = Business({
  name: 'Catalyst Ventures',
  mission: 'Back exceptional founders building the future of enterprise software',
  values: ['Founder First', 'Long-Term Thinking', 'Operational Excellence', 'Integrity'],
  industry: 'Venture Capital',
  founded: new Date('2015-03-01'),
  stage: 'established',
  structure: {
    departments: [
      {
        name: 'Investment Team',
        headcount: 12,
        budget: 3500000,
        teams: [
          { name: 'Partners', headcount: 4, focus: 'Investment decisions' },
          { name: 'Principals', headcount: 4, focus: 'Deal sourcing & diligence' },
          { name: 'Associates', headcount: 4, focus: 'Research & support' },
        ],
      },
      {
        name: 'Platform',
        headcount: 8,
        budget: 1500000,
        teams: [
          { name: 'Talent', headcount: 3, focus: 'Portfolio recruiting' },
          { name: 'GTM', headcount: 2, focus: 'Sales & marketing support' },
          { name: 'Technical', headcount: 2, focus: 'Technical advisory' },
          { name: 'Marketing', headcount: 1, focus: 'Brand & content' },
        ],
      },
      {
        name: 'Operations',
        headcount: 5,
        budget: 800000,
        teams: [
          { name: 'Finance', headcount: 2, focus: 'Fund accounting' },
          { name: 'Legal', headcount: 1, focus: 'Legal & compliance' },
          { name: 'IR', headcount: 2, focus: 'LP relations' },
        ],
      },
    ],
  },
})

// =============================================================================
// 2. VISION & GOALS
// =============================================================================

export const CatalystVision = Vision({
  statement: 'Be the most founder-friendly firm backing category-defining enterprise companies',
  timeHorizon: '2030',
  pillars: [
    'Founder Partnership',
    'Platform Value',
    'Investment Returns',
    'Thought Leadership',
  ],
  successIndicators: [
    { name: 'AUM', target: 2000000000, unit: 'USD' },
    { name: 'Unicorn Portfolio Companies', target: 15 },
    { name: 'Net IRR', target: 30, unit: '%' },
    { name: 'Founder NPS', target: 90 },
  ],
})

export const CatalystGoals = Goals([
  {
    name: 'Close Fund V ($500M)',
    category: 'financial',
    status: 'in-progress',
    progress: 70,
    dueDate: new Date('2024-06-30'),
    owner: 'Managing Partner',
  },
  {
    name: 'Deploy Fund IV',
    category: 'operational',
    status: 'in-progress',
    progress: 60,
    dueDate: new Date('2024-12-31'),
    owner: 'Investment Team',
  },
  {
    name: '3 IPO/M&A Exits',
    category: 'strategic',
    status: 'in-progress',
    progress: 33,
    dueDate: new Date('2024-12-31'),
    owner: 'Managing Partner',
  },
  {
    name: 'Launch AI/ML Thesis',
    category: 'strategic',
    status: 'in-progress',
    progress: 50,
    dueDate: new Date('2024-03-31'),
    owner: 'Partner - AI',
  },
  {
    name: 'Expand Platform Team',
    category: 'operational',
    status: 'in-progress',
    progress: 40,
    dueDate: new Date('2024-06-30'),
    owner: 'Head of Platform',
  },
])

// =============================================================================
// 3. FUND STRUCTURE
// =============================================================================

export interface Fund {
  id: string
  name: string
  vintage: number
  size: number
  deployed: number
  reserved: number // For follow-ons
  status: 'fundraising' | 'investing' | 'harvesting' | 'closed'
  strategy: string
  metrics?: {
    tvpi?: number
    dpi?: number
    irr?: number
    moic?: number
  }
}

export const Funds: Fund[] = [
  {
    id: 'fund-i',
    name: 'Catalyst Ventures I',
    vintage: 2015,
    size: 75000000,
    deployed: 75000000,
    reserved: 0,
    status: 'harvesting',
    strategy: 'Seed & Series A Enterprise',
    metrics: { tvpi: 4.2, dpi: 2.8, irr: 38, moic: 4.2 },
  },
  {
    id: 'fund-ii',
    name: 'Catalyst Ventures II',
    vintage: 2017,
    size: 150000000,
    deployed: 150000000,
    reserved: 0,
    status: 'harvesting',
    strategy: 'Seed & Series A Enterprise',
    metrics: { tvpi: 3.5, dpi: 1.5, irr: 32, moic: 3.5 },
  },
  {
    id: 'fund-iii',
    name: 'Catalyst Ventures III',
    vintage: 2019,
    size: 250000000,
    deployed: 225000000,
    reserved: 25000000,
    status: 'investing',
    strategy: 'Seed & Series A Enterprise',
    metrics: { tvpi: 2.8, dpi: 0.5, irr: 28 },
  },
  {
    id: 'fund-iv',
    name: 'Catalyst Ventures IV',
    vintage: 2022,
    size: 400000000,
    deployed: 180000000,
    reserved: 100000000,
    status: 'investing',
    strategy: 'Seed to Series B Enterprise',
    metrics: { tvpi: 1.4, dpi: 0, irr: 0 },
  },
  {
    id: 'fund-v',
    name: 'Catalyst Ventures V',
    vintage: 2024,
    size: 500000000,
    deployed: 0,
    reserved: 150000000,
    status: 'fundraising',
    strategy: 'Seed to Series B Enterprise + AI/ML',
  },
  {
    id: 'growth-i',
    name: 'Catalyst Growth I',
    vintage: 2021,
    size: 300000000,
    deployed: 240000000,
    reserved: 60000000,
    status: 'investing',
    strategy: 'Series B-D Growth',
    metrics: { tvpi: 1.6, dpi: 0.2, irr: 22 },
  },
]

export const TotalAUM = Funds.reduce((sum, f) => sum + f.size, 0)

// =============================================================================
// 4. PORTFOLIO COMPANIES
// =============================================================================

export interface PortfolioCompany {
  id: string
  name: string
  description: string
  sector: string
  stage: 'seed' | 'series-a' | 'series-b' | 'series-c' | 'growth' | 'pre-ipo' | 'public' | 'acquired'
  fundId: string
  initialInvestment: Date
  invested: number
  ownership: number // %
  currentValuation?: number
  markValue?: number
  status: 'active' | 'exited' | 'written-off'
  board?: boolean
  leadInvestor?: boolean
  metrics?: {
    arr?: number
    growth?: number // %
    employees?: number
  }
}

export const Portfolio: PortfolioCompany[] = [
  {
    id: 'datastream',
    name: 'DataStream',
    description: 'Real-time data infrastructure',
    sector: 'Data Infrastructure',
    stage: 'pre-ipo',
    fundId: 'fund-i',
    initialInvestment: new Date('2016-03-15'),
    invested: 8000000,
    ownership: 12,
    currentValuation: 2500000000,
    markValue: 300000000,
    status: 'active',
    board: true,
    leadInvestor: true,
    metrics: { arr: 180000000, growth: 45, employees: 800 },
  },
  {
    id: 'securecloud',
    name: 'SecureCloud',
    description: 'Cloud security platform',
    sector: 'Security',
    stage: 'public',
    fundId: 'fund-i',
    initialInvestment: new Date('2015-09-01'),
    invested: 5000000,
    ownership: 0, // Exited
    status: 'exited',
    board: true,
    leadInvestor: true,
  },
  {
    id: 'aiops',
    name: 'AIOps',
    description: 'AI-powered IT operations',
    sector: 'DevOps',
    stage: 'series-c',
    fundId: 'fund-ii',
    initialInvestment: new Date('2018-06-01'),
    invested: 15000000,
    ownership: 15,
    currentValuation: 800000000,
    markValue: 120000000,
    status: 'active',
    board: true,
    leadInvestor: true,
    metrics: { arr: 65000000, growth: 55, employees: 350 },
  },
  {
    id: 'complyhq',
    name: 'ComplyHQ',
    description: 'Compliance automation',
    sector: 'RegTech',
    stage: 'series-b',
    fundId: 'fund-iii',
    initialInvestment: new Date('2020-02-15'),
    invested: 20000000,
    ownership: 18,
    currentValuation: 400000000,
    markValue: 72000000,
    status: 'active',
    board: true,
    leadInvestor: true,
    metrics: { arr: 32000000, growth: 80, employees: 180 },
  },
  {
    id: 'devflow',
    name: 'DevFlow',
    description: 'Developer productivity platform',
    sector: 'Developer Tools',
    stage: 'series-a',
    fundId: 'fund-iv',
    initialInvestment: new Date('2022-09-01'),
    invested: 12000000,
    ownership: 20,
    currentValuation: 120000000,
    markValue: 24000000,
    status: 'active',
    board: true,
    leadInvestor: true,
    metrics: { arr: 8000000, growth: 120, employees: 45 },
  },
  {
    id: 'mlplatform',
    name: 'MLPlatform',
    description: 'Enterprise ML infrastructure',
    sector: 'AI/ML',
    stage: 'seed',
    fundId: 'fund-iv',
    initialInvestment: new Date('2023-06-15'),
    invested: 4000000,
    ownership: 15,
    currentValuation: 40000000,
    markValue: 6000000,
    status: 'active',
    board: false,
    leadInvestor: true,
    metrics: { arr: 500000, growth: 200, employees: 12 },
  },
]

// =============================================================================
// 5. SERVICES (Platform)
// =============================================================================

export const PlatformServices = {
  talent: Service({
    name: 'Talent Network',
    description: 'Executive recruiting and team building support',
    pricingModel: 'free', // Included for portfolio
    deliverables: [
      'Executive search support',
      'Candidate pipeline',
      'Interview process design',
      'Compensation benchmarking',
      'Reference checks',
    ],
  }),
  gtm: Service({
    name: 'GTM Acceleration',
    description: 'Sales and marketing support',
    pricingModel: 'free',
    deliverables: [
      'Sales playbook development',
      'Customer introductions',
      'Marketing strategy',
      'Pricing optimization',
      'Partnership introductions',
    ],
  }),
  technical: Service({
    name: 'Technical Advisory',
    description: 'Technical strategy and architecture review',
    pricingModel: 'free',
    deliverables: [
      'Architecture review',
      'Technology strategy',
      'Security assessment',
      'Scalability planning',
      'Tech due diligence support',
    ],
  }),
  ops: Service({
    name: 'Operational Excellence',
    description: 'Finance, legal, and operational support',
    pricingModel: 'free',
    deliverables: [
      'CFO/finance support',
      'Legal introductions',
      'Board governance',
      'Fundraising preparation',
      'M&A support',
    ],
  }),
}

// =============================================================================
// 6. ORGANIZATION & ROLES
// =============================================================================

export const CatalystOrg: Organization = {
  id: 'catalyst',
  name: 'Catalyst Ventures',
  settings: {
    timezone: 'America/San_Francisco',
    currency: 'USD',
    fiscalYearStart: 1,
  },
  departments: [
    {
      id: 'investment',
      name: 'Investment Team',
      permissions: {
        deals: ['read', 'write', 'diligence', 'recommend'],
        portfolio: ['read', 'write'],
        fund: ['read'],
      },
      teams: [
        {
          id: 'partners',
          name: 'Partners',
          positions: [
            { id: 'mp', title: 'Managing Partner', roleId: 'managing-partner', reportsTo: null },
            { id: 'gp-1', title: 'General Partner', roleId: 'general-partner', reportsTo: 'mp' },
            { id: 'gp-2', title: 'General Partner', roleId: 'general-partner', reportsTo: 'mp' },
            { id: 'gp-3', title: 'General Partner', roleId: 'general-partner', reportsTo: 'mp' },
          ],
        },
        {
          id: 'principals',
          name: 'Principals',
          positions: [
            { id: 'principal-1', title: 'Principal', roleId: 'principal', reportsTo: 'gp-1' },
            { id: 'principal-2', title: 'Principal', roleId: 'principal', reportsTo: 'gp-2' },
          ],
        },
        {
          id: 'associates',
          name: 'Associates',
          positions: [
            { id: 'associate-1', title: 'Associate', roleId: 'associate', reportsTo: 'principal-1' },
            { id: 'associate-2', title: 'Associate', roleId: 'associate', reportsTo: 'principal-2' },
          ],
        },
      ],
    },
    {
      id: 'platform',
      name: 'Platform',
      permissions: {
        portfolio: ['read', 'support'],
        talent: ['read', 'write'],
        gtm: ['read', 'write'],
      },
    },
    {
      id: 'operations',
      name: 'Operations',
      permissions: {
        fund: ['read', 'write', 'report'],
        lps: ['read', 'write'],
        compliance: ['read', 'write', 'manage'],
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
        deals: ['read', 'write', 'approve', 'veto'],
        fund: ['read', 'write', 'manage'],
        portfolio: ['read', 'write', 'manage'],
        lps: ['read', 'write'],
      },
      canHandle: ['investment-decision', 'fundraising', 'lp-relations', 'exit'],
      canApprove: ['investment', 'follow-on', 'exit', 'hiring'],
    }),
    createBusinessRole({
      id: 'general-partner',
      name: 'General Partner',
      type: 'executive',
      level: 9,
      permissions: {
        deals: ['read', 'write', 'diligence', 'recommend', 'lead'],
        portfolio: ['read', 'write', 'board'],
        fund: ['read'],
      },
      canHandle: ['deal-sourcing', 'diligence', 'board-seat', 'portfolio-support'],
      canApprove: ['term-sheet', 'follow-on'],
    }),
    createBusinessRole({
      id: 'principal',
      name: 'Principal',
      type: 'analyst',
      level: 6,
      permissions: {
        deals: ['read', 'write', 'diligence', 'recommend'],
        portfolio: ['read', 'support'],
      },
      canHandle: ['deal-sourcing', 'diligence', 'portfolio-support'],
    }),
    createBusinessRole({
      id: 'associate',
      name: 'Associate',
      type: 'analyst',
      level: 4,
      permissions: {
        deals: ['read', 'write', 'research'],
        portfolio: ['read'],
      },
      canHandle: ['market-research', 'deal-sourcing', 'diligence-support'],
    }),
    createBusinessRole({
      id: 'platform-head',
      name: 'Head of Platform',
      type: 'manager',
      level: 7,
      permissions: {
        portfolio: ['read', 'support', 'coordinate'],
        talent: ['read', 'write', 'manage'],
        gtm: ['read', 'write', 'manage'],
      },
      canHandle: ['platform-strategy', 'portfolio-support', 'talent-coordination'],
    }),
    createBusinessRole({
      id: 'talent-partner',
      name: 'Talent Partner',
      type: 'support',
      level: 5,
      permissions: {
        portfolio: ['read'],
        talent: ['read', 'write'],
        candidates: ['read', 'write'],
      },
      canHandle: ['executive-search', 'recruiting-support', 'compensation-advice'],
    }),
    createBusinessRole({
      id: 'ir-manager',
      name: 'IR Manager',
      type: 'support',
      level: 5,
      permissions: {
        fund: ['read', 'report'],
        lps: ['read', 'write'],
      },
      canHandle: ['lp-reporting', 'lp-communication', 'agm-coordination'],
    }),
    createBusinessRole({
      id: 'deal-sourcing-bot',
      name: 'Deal Sourcing Bot',
      type: 'agent',
      level: 2,
      workerType: 'ai',
      permissions: {
        deals: ['read', 'write'],
        research: ['read', 'write'],
      },
      canHandle: ['company-research', 'news-monitoring', 'deal-flow-tracking'],
    }),
  ],
  approvalChains: [
    {
      id: 'investment',
      name: 'Investment Approval',
      requestType: 'investment',
      levels: [
        { threshold: 2000000, approvers: [{ type: 'role', roleId: 'general-partner' }] }, // Seed
        { threshold: 10000000, approvers: [{ type: 'role', roleId: 'managing-partner' }, { type: 'role', roleId: 'general-partner' }] }, // Series A
        { threshold: Infinity, approvers: [{ type: 'all-partners' }] }, // Large checks - full partnership
      ],
    },
    {
      id: 'follow-on',
      name: 'Follow-on Approval',
      requestType: 'follow-on',
      levels: [
        { threshold: 5000000, approvers: [{ type: 'role', roleId: 'general-partner' }] },
        { threshold: Infinity, approvers: [{ type: 'role', roleId: 'managing-partner' }] },
      ],
    },
  ],
  routingRules: [
    {
      id: 'deal-research',
      taskType: 'company-research',
      priority: 1,
      assignTo: { roleId: 'associate' },
    },
    {
      id: 'deal-diligence',
      taskType: 'deal-diligence',
      priority: 2,
      assignTo: { roleId: 'principal' },
    },
    {
      id: 'executive-search',
      taskType: 'executive-search',
      priority: 1,
      assignTo: { roleId: 'talent-partner' },
    },
  ],
}

// =============================================================================
// 7. KPIs & METRICS
// =============================================================================

export const CatalystKPIs = kpis([
  // Fund Performance
  {
    name: 'AUM',
    category: 'financial',
    target: 2000000000,
    current: 1675000000,
    unit: 'USD',
    frequency: 'quarterly',
    owner: 'Managing Partner',
  },
  {
    name: 'Fund IV TVPI',
    category: 'financial',
    target: 2.0,
    current: 1.4,
    frequency: 'quarterly',
    owner: 'Managing Partner',
  },
  {
    name: 'Net IRR (Blended)',
    category: 'financial',
    target: 25,
    current: 28,
    unit: '%',
    frequency: 'yearly',
    owner: 'Managing Partner',
  },
  // Investment Activity
  {
    name: 'New Investments / Year',
    category: 'operational',
    target: 15,
    current: 8,
    frequency: 'yearly',
    owner: 'Investment Team',
  },
  {
    name: 'Follow-ons / Year',
    category: 'operational',
    target: 20,
    current: 12,
    frequency: 'yearly',
    owner: 'Investment Team',
  },
  {
    name: 'Win Rate (Competitive Deals)',
    category: 'operational',
    target: 40,
    current: 35,
    unit: '%',
    frequency: 'quarterly',
    owner: 'Investment Team',
  },
  // Deal Flow
  {
    name: 'Deals Reviewed / Month',
    category: 'operational',
    target: 200,
    current: 180,
    frequency: 'monthly',
    owner: 'Investment Team',
  },
  {
    name: 'Meetings / Month',
    category: 'operational',
    target: 80,
    current: 65,
    frequency: 'monthly',
    owner: 'Investment Team',
  },
  {
    name: 'Conversion Rate (Meeting to Term Sheet)',
    category: 'operational',
    target: 5,
    current: 4.2,
    unit: '%',
    frequency: 'quarterly',
    owner: 'Investment Team',
  },
  // Portfolio
  {
    name: 'Portfolio Companies',
    category: 'portfolio',
    target: 50,
    current: 42,
    frequency: 'quarterly',
    owner: 'Managing Partner',
  },
  {
    name: 'Unicorns',
    category: 'portfolio',
    target: 10,
    current: 6,
    frequency: 'quarterly',
    owner: 'Managing Partner',
  },
  {
    name: 'Portfolio ARR (Aggregate)',
    category: 'portfolio',
    target: 500000000,
    current: 385000000,
    unit: 'USD',
    frequency: 'quarterly',
    owner: 'Managing Partner',
  },
  // Platform
  {
    name: 'Executive Placements / Year',
    category: 'platform',
    target: 50,
    current: 35,
    frequency: 'yearly',
    owner: 'Head of Platform',
  },
  {
    name: 'Customer Intros / Quarter',
    category: 'platform',
    target: 100,
    current: 75,
    frequency: 'quarterly',
    owner: 'Head of Platform',
  },
  {
    name: 'Founder NPS',
    category: 'customer',
    target: 85,
    current: 78,
    frequency: 'yearly',
    owner: 'Managing Partner',
  },
  // LP Relations
  {
    name: 'LP Re-up Rate',
    category: 'financial',
    target: 90,
    current: 85,
    unit: '%',
    frequency: 'yearly',
    owner: 'IR Manager',
  },
])

// =============================================================================
// 8. OKRs
// =============================================================================

export const CatalystOKRs = okrs([
  {
    objective: 'Close Fund V Successfully',
    owner: 'Managing Partner',
    period: 'H1 2024',
    keyResults: [
      {
        description: 'Raise $500M for Fund V',
        metric: 'Fund Size',
        targetValue: 500000000,
        currentValue: 350000000,
        unit: 'USD',
      },
      {
        description: 'Secure 3 new anchor LPs',
        metric: 'New Anchors',
        targetValue: 3,
        currentValue: 1,
      },
      {
        description: 'Achieve 90% LP re-up rate',
        metric: 'Re-up Rate',
        targetValue: 90,
        currentValue: 85,
        unit: '%',
      },
    ],
  },
  {
    objective: 'Build Best-in-Class Investment Team',
    owner: 'Managing Partner',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Hire 2 new partners',
        metric: 'Partners Hired',
        targetValue: 2,
        currentValue: 1,
      },
      {
        description: 'Achieve 40% competitive win rate',
        metric: 'Win Rate',
        targetValue: 40,
        currentValue: 35,
        unit: '%',
      },
      {
        description: 'Source 30% deals from network',
        metric: 'Network Sourcing',
        targetValue: 30,
        currentValue: 22,
        unit: '%',
      },
    ],
  },
  {
    objective: 'Maximize Portfolio Value',
    owner: 'Portfolio Team',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Support 5 portfolio fundraises',
        metric: 'Fundraises Supported',
        targetValue: 5,
        currentValue: 3,
      },
      {
        description: 'Achieve 80% follow-on rate',
        metric: 'Follow-on Rate',
        targetValue: 80,
        currentValue: 72,
        unit: '%',
      },
      {
        description: 'Add 2 new unicorns',
        metric: 'New Unicorns',
        targetValue: 2,
        currentValue: 1,
      },
    ],
  },
  {
    objective: 'Scale Platform Impact',
    owner: 'Head of Platform',
    period: 'Q1 2024',
    keyResults: [
      {
        description: 'Place 15 executives',
        metric: 'Executive Placements',
        targetValue: 15,
        currentValue: 8,
      },
      {
        description: 'Make 30 customer intros',
        metric: 'Customer Intros',
        targetValue: 30,
        currentValue: 18,
      },
      {
        description: 'Achieve 85 Founder NPS',
        metric: 'Founder NPS',
        targetValue: 85,
        currentValue: 78,
      },
    ],
  },
])

// =============================================================================
// 9. PROCESSES
// =============================================================================

export const DealSourcingProcess = Process({
  name: 'Deal Sourcing',
  description: 'Source and evaluate new investment opportunities',
  owner: 'Investment Team',
  steps: [
    {
      order: 1,
      name: 'Inbound/Outbound',
      description: 'Receive or identify potential deal',
      automationLevel: 'semi-automated',
      duration: 'ongoing',
    },
    {
      order: 2,
      name: 'Initial Screen',
      description: 'Quick assessment against investment criteria',
      automationLevel: 'semi-automated',
      duration: '1 day',
      owner: 'Associate',
    },
    {
      order: 3,
      name: 'First Meeting',
      description: 'Initial meeting with founders',
      automationLevel: 'manual',
      duration: '1 hour',
      owner: 'Principal',
    },
    {
      order: 4,
      name: 'Deep Dive',
      description: 'Extended meeting and product demo',
      automationLevel: 'manual',
      duration: '2 hours',
      owner: 'Partner',
    },
    {
      order: 5,
      name: 'Market Research',
      description: 'Market sizing and competitive analysis',
      automationLevel: 'semi-automated',
      duration: '1 week',
      owner: 'Associate',
    },
    {
      order: 6,
      name: 'Partner Meeting',
      description: 'Present to full partnership',
      automationLevel: 'manual',
      duration: '30 minutes',
      owner: 'Partner',
    },
    {
      order: 7,
      name: 'Due Diligence',
      description: 'Full due diligence process',
      automationLevel: 'manual',
      duration: '2-4 weeks',
      owner: 'Principal',
    },
    {
      order: 8,
      name: 'Investment Committee',
      description: 'Final IC decision',
      automationLevel: 'manual',
      duration: '1 day',
    },
    {
      order: 9,
      name: 'Term Sheet',
      description: 'Issue and negotiate term sheet',
      automationLevel: 'manual',
      duration: '1 week',
      owner: 'Partner',
    },
    {
      order: 10,
      name: 'Close',
      description: 'Legal documentation and close',
      automationLevel: 'manual',
      duration: '2-4 weeks',
    },
  ],
  metrics: [
    { name: 'Time to Decision', target: 4, unit: 'weeks' },
    { name: 'Win Rate', target: 40, unit: '%' },
    { name: 'Conversion (Meeting to IC)', target: 10, unit: '%' },
  ],
})

export const DueDiligenceProcess = Process({
  name: 'Due Diligence',
  description: 'Comprehensive due diligence on investment opportunities',
  owner: 'Investment Team',
  steps: [
    {
      order: 1,
      name: 'Data Room Review',
      description: 'Review company data room',
      automationLevel: 'semi-automated',
      duration: '3 days',
      owner: 'Associate',
    },
    {
      order: 2,
      name: 'Financial Analysis',
      description: 'Financial model review and projections',
      automationLevel: 'manual',
      duration: '1 week',
      owner: 'Principal',
    },
    {
      order: 3,
      name: 'Customer Calls',
      description: 'Reference calls with customers',
      automationLevel: 'manual',
      duration: '1 week',
      owner: 'Principal',
    },
    {
      order: 4,
      name: 'Expert Calls',
      description: 'Industry expert interviews',
      automationLevel: 'manual',
      duration: '1 week',
      owner: 'Associate',
    },
    {
      order: 5,
      name: 'Technical Review',
      description: 'Technology and product assessment',
      automationLevel: 'manual',
      duration: '3 days',
      owner: 'Technical Advisor',
    },
    {
      order: 6,
      name: 'Founder References',
      description: 'Back-channel founder references',
      automationLevel: 'manual',
      duration: '1 week',
      owner: 'Partner',
    },
    {
      order: 7,
      name: 'Legal Review',
      description: 'Cap table and legal review',
      automationLevel: 'semi-automated',
      duration: '3 days',
      owner: 'Legal',
    },
    {
      order: 8,
      name: 'Investment Memo',
      description: 'Write investment memo',
      automationLevel: 'manual',
      duration: '3 days',
      owner: 'Principal',
    },
  ],
  metrics: [
    { name: 'Completion Time', target: 3, unit: 'weeks' },
    { name: 'Customer Calls', target: 10 },
    { name: 'Expert Calls', target: 5 },
  ],
})

export const PortfolioSupportProcess = Process({
  name: 'Portfolio Support',
  description: 'Ongoing support for portfolio companies',
  owner: 'Head of Platform',
  steps: [
    {
      order: 1,
      name: 'Monthly Check-in',
      description: 'Monthly sync with CEO',
      automationLevel: 'manual',
      duration: '30 minutes',
      owner: 'Partner',
    },
    {
      order: 2,
      name: 'Board Meeting',
      description: 'Quarterly board meeting',
      automationLevel: 'manual',
      duration: '3 hours',
      owner: 'Partner',
    },
    {
      order: 3,
      name: 'Platform Support',
      description: 'Talent, GTM, technical support',
      automationLevel: 'manual',
      duration: 'ongoing',
      owner: 'Platform Team',
    },
    {
      order: 4,
      name: 'Fundraising Support',
      description: 'Support next round fundraising',
      automationLevel: 'manual',
      duration: '3 months',
      owner: 'Partner',
    },
    {
      order: 5,
      name: 'Strategic Planning',
      description: 'Annual strategic planning',
      automationLevel: 'manual',
      duration: '1 day',
      owner: 'Partner',
    },
  ],
  metrics: [
    { name: 'Founder NPS', target: 85 },
    { name: 'Follow-on Rate', target: 80, unit: '%' },
    { name: 'Board Attendance', target: 100, unit: '%' },
  ],
})

// =============================================================================
// 10. WORKFLOWS
// =============================================================================

export const DealScreeningWorkflow = Workflow({
  name: 'Deal Screening',
  description: 'Automated initial deal screening',
  trigger: { type: 'event', event: 'deal.submitted' },
  actions: [
    {
      order: 1,
      type: 'compute',
      name: 'Parse Deal Info',
      config: {
        extract: ['company', 'stage', 'sector', 'metrics', 'founders'],
      },
    },
    {
      order: 2,
      type: 'compute',
      name: 'Thesis Fit Score',
      config: {
        criteria: ['sector_fit', 'stage_fit', 'metrics_threshold', 'team_background'],
        weights: [0.3, 0.2, 0.3, 0.2],
      },
    },
    {
      order: 3,
      type: 'api',
      name: 'Enrich Company Data',
      config: {
        sources: ['pitchbook', 'crunchbase', 'linkedin'],
      },
    },
    {
      order: 4,
      type: 'condition',
      name: 'Check Fit Score',
      condition: 'fitScore >= 70',
    },
    {
      order: 5,
      type: 'notification',
      name: 'Alert Team',
      config: {
        channel: 'slack',
        template: 'high_priority_deal',
        to: '#deal-flow',
      },
    },
    {
      order: 6,
      type: 'task',
      name: 'Assign Review',
      config: {
        type: 'deal-review',
        assignTo: 'associate',
        dueIn: '24 hours',
      },
    },
  ],
})

export const PortfolioMonitoringWorkflow = Workflow({
  name: 'Portfolio Monitoring',
  description: 'Weekly portfolio health monitoring',
  trigger: { type: 'schedule', cron: '0 9 * * 1' }, // Weekly Monday 9am
  actions: [
    {
      order: 1,
      type: 'api',
      name: 'Collect Metrics',
      config: {
        sources: ['portfolio_dashboard', 'financial_reports'],
        metrics: ['arr', 'growth', 'runway', 'team_changes'],
      },
    },
    {
      order: 2,
      type: 'compute',
      name: 'Calculate Health Scores',
      config: {
        factors: ['revenue_growth', 'burn_rate', 'runway', 'retention'],
      },
    },
    {
      order: 3,
      type: 'condition',
      name: 'Check At Risk',
      condition: 'healthScore < 60 || runway < 9',
    },
    {
      order: 4,
      type: 'notification',
      name: 'Alert Partner',
      config: {
        channel: 'email',
        template: 'portfolio_alert',
        priority: 'high',
      },
    },
    {
      order: 5,
      type: 'task',
      name: 'Schedule Check-in',
      config: {
        type: 'portfolio-checkin',
        assignTo: 'partner',
        dueIn: '48 hours',
      },
    },
  ],
})

export const LPReportingWorkflow = Workflow({
  name: 'LP Reporting',
  description: 'Quarterly LP reporting process',
  trigger: { type: 'schedule', cron: '0 9 1 */3 *' }, // Quarterly
  actions: [
    {
      order: 1,
      type: 'api',
      name: 'Aggregate Data',
      config: {
        collect: ['portfolio_metrics', 'fund_performance', 'new_investments', 'exits'],
      },
    },
    {
      order: 2,
      type: 'task',
      name: 'Update Valuations',
      config: {
        type: 'valuation-update',
        assignTo: 'finance',
        dueIn: '1 week',
      },
    },
    {
      order: 3,
      type: 'task',
      name: 'Draft Report',
      config: {
        type: 'lp-report-draft',
        assignTo: 'ir-manager',
        dueIn: '2 weeks',
      },
    },
    {
      order: 4,
      type: 'task',
      name: 'Partner Review',
      config: {
        type: 'report-review',
        assignTo: 'managing-partner',
        dueIn: '1 week',
      },
    },
    {
      order: 5,
      type: 'notification',
      name: 'Send to LPs',
      config: {
        channel: 'email',
        template: 'quarterly_lp_report',
        to: 'lps',
      },
    },
  ],
})

// =============================================================================
// 11. FINANCIALS
// =============================================================================

export const CatalystFinancials = financials({
  revenue: 33500000, // Management fees (2% of AUM)
  cogs: 0,
  operatingExpenses: 25000000,
  depreciation: 100000,
  interestExpense: 0,
  otherIncome: 0,
  taxes: 2000000,
})

export const FirmMetrics = {
  aum: 1675000000,
  managementFee: 0.02, // 2%
  carry: 0.20, // 20%
  managementFeeRevenue: 33500000,
  realizedCarry: 45000000, // From exits
  portfolio: {
    companies: 42,
    activeBoard: 18,
    unicorns: 6,
    totalInvested: 680000000,
    totalMarkValue: 1250000000,
    aggregateArr: 385000000,
  },
  dealFlow: {
    dealsReviewedYearly: 2200,
    meetingsYearly: 800,
    investmentsYearly: 12,
    conversionRate: 0.5, // %
  },
  team: {
    partners: 4,
    principals: 4,
    associates: 4,
    platform: 8,
    operations: 5,
  },
  performance: {
    blendedIrr: 28,
    blendedTvpi: 2.8,
    blendedDpi: 1.2,
  },
}

// =============================================================================
// 12. UTILITY FUNCTIONS
// =============================================================================

export function getBusinessSummary() {
  return {
    company: CatalystVenturesBusiness,
    vision: CatalystVision,
    goals: CatalystGoals,
    funds: Funds,
    portfolio: Portfolio,
    services: PlatformServices,
    kpis: CatalystKPIs,
    okrs: CatalystOKRs,
    financials: CatalystFinancials,
    metrics: FirmMetrics,
  }
}

export function getFundPerformance() {
  return Funds.map(f => ({
    name: f.name,
    vintage: f.vintage,
    size: $.format(f.size),
    deployed: `${((f.deployed / f.size) * 100).toFixed(0)}%`,
    tvpi: f.metrics?.tvpi ? `${f.metrics.tvpi}x` : 'N/A',
    irr: f.metrics?.irr ? `${f.metrics.irr}%` : 'N/A',
    status: f.status,
  }))
}

export function getPortfolioSummary() {
  const active = Portfolio.filter(c => c.status === 'active')
  const totalValue = active.reduce((sum, c) => sum + (c.markValue || 0), 0)
  const totalInvested = active.reduce((sum, c) => sum + c.invested, 0)

  return {
    companies: active.length,
    totalInvested: $.format(totalInvested),
    totalValue: $.format(totalValue),
    moic: (totalValue / totalInvested).toFixed(2) + 'x',
    unicorns: active.filter(c => (c.currentValuation || 0) >= 1000000000).length,
  }
}

export function getTopCompanies(n: number = 5) {
  return Portfolio
    .filter(c => c.status === 'active' && c.markValue)
    .sort((a, b) => (b.markValue || 0) - (a.markValue || 0))
    .slice(0, n)
    .map(c => ({
      name: c.name,
      stage: c.stage,
      value: $.format(c.markValue!),
      ownership: `${c.ownership}%`,
      arr: c.metrics?.arr ? $.format(c.metrics.arr) : 'N/A',
    }))
}

export default {
  business: CatalystVenturesBusiness,
  vision: CatalystVision,
  goals: CatalystGoals,
  funds: Funds,
  portfolio: Portfolio,
  services: PlatformServices,
  organization: CatalystOrg,
  kpis: CatalystKPIs,
  okrs: CatalystOKRs,
  processes: {
    dealSourcing: DealSourcingProcess,
    dueDiligence: DueDiligenceProcess,
    portfolioSupport: PortfolioSupportProcess,
  },
  workflows: {
    dealScreening: DealScreeningWorkflow,
    portfolioMonitoring: PortfolioMonitoringWorkflow,
    lpReporting: LPReportingWorkflow,
  },
  financials: CatalystFinancials,
  metrics: FirmMetrics,
}
