/**
 * Basic usage example for business-as-code
 *
 * This example demonstrates how to define business entities, goals, products,
 * KPIs, OKRs, and calculate financial metrics.
 */

import {
  Business,
  Vision,
  Goals,
  Product,
  Service,
  Process,
  Workflow,
  kpis,
  okrs,
  financials,
  $,
} from '../src/index.js'

// Define your business
const company = Business({
  name: 'Acme Corp',
  description: 'Building the future of widgets',
  industry: 'Technology',
  mission: 'To make widgets accessible to everyone',
  values: ['Innovation', 'Customer Focus', 'Integrity'],
  targetMarket: 'SMB and Enterprise',
  foundedAt: new Date('2020-01-01'),
  teamSize: 50,
  structure: {
    departments: [
      {
        name: 'Engineering',
        head: 'Jane Smith',
        members: ['Alice', 'Bob', 'Charlie'],
        budget: 2000000,
      },
      {
        name: 'Sales',
        head: 'John Doe',
        members: ['David', 'Eve'],
        budget: 1000000,
      },
    ],
  },
})

// Define vision
const vision = Vision({
  statement: 'To become the world\'s most trusted widget platform',
  timeframe: '5 years',
  successIndicators: [
    '10M+ active users',
    'Present in 50+ countries',
    'Industry-leading NPS score',
    '$1B+ annual revenue',
  ],
})

// Define goals
const goals = Goals([
  {
    name: 'Launch MVP',
    description: 'Ship minimum viable product to early customers',
    category: 'strategic',
    targetDate: new Date('2024-06-30'),
    owner: 'Product Team',
    metrics: ['User signups', 'Feature completion rate'],
    status: 'in-progress',
    progress: 65,
  },
  {
    name: 'Achieve Product-Market Fit',
    description: 'Validate product value with target customers',
    category: 'strategic',
    targetDate: new Date('2024-12-31'),
    owner: 'CEO',
    metrics: ['NPS > 50', 'Churn < 5%', '100+ paying customers'],
    status: 'in-progress',
    progress: 30,
    dependencies: ['Launch MVP'],
  },
])

// Define products
const product = Product({
  name: 'Widget Pro',
  description: 'Enterprise-grade widget management platform',
  category: 'SaaS',
  targetSegment: 'Enterprise',
  valueProposition: 'Reduce widget management costs by 50%',
  pricingModel: 'subscription',
  price: 99,
  currency: 'USD',
  cogs: 20,
  features: [
    'Unlimited widgets',
    'Advanced analytics',
    'API access',
    '24/7 support',
  ],
  roadmap: [
    {
      name: 'Mobile app',
      description: 'Native iOS and Android apps',
      targetDate: new Date('2024-09-01'),
      priority: 'high',
      status: 'in-progress',
    },
  ],
})

// Define services
const service = Service({
  name: 'Widget Consulting',
  description: 'Expert widget implementation and optimization',
  category: 'Consulting',
  targetSegment: 'Enterprise',
  valueProposition: 'Get expert help implementing widgets in 2 weeks',
  pricingModel: 'fixed',
  price: 5000,
  currency: 'USD',
  deliveryTime: '2 weeks',
  sla: {
    uptime: 99.9,
    responseTime: '< 24 hours',
    supportHours: 'Business hours (9-5 EST)',
    penalties: '10% refund per day of delay',
  },
})

// Define a business process
const process = Process({
  name: 'Customer Onboarding',
  description: 'Process for onboarding new customers',
  category: 'core',
  owner: 'Customer Success Team',
  steps: [
    {
      order: 1,
      name: 'Welcome Email',
      description: 'Send personalized welcome email',
      responsible: 'CS Manager',
      duration: '5 minutes',
      automationLevel: 'automated',
    },
    {
      order: 2,
      name: 'Initial Setup Call',
      description: 'Schedule and conduct setup call',
      responsible: 'CS Rep',
      duration: '30 minutes',
      automationLevel: 'manual',
    },
  ],
  inputs: ['Customer Information', 'Subscription Plan'],
  outputs: ['Configured Account', 'Training Materials'],
})

// Define a workflow
const workflow = Workflow({
  name: 'New Customer Welcome',
  description: 'Automated welcome sequence for new customers',
  trigger: {
    type: 'event',
    event: 'Customer.created',
  },
  actions: [
    {
      order: 1,
      type: 'send',
      description: 'Send welcome email',
      params: {
        template: 'welcome_email',
        to: '{{customer.email}}',
      },
    },
    {
      order: 2,
      type: 'create',
      description: 'Create onboarding task',
      params: {
        type: 'Task',
        title: 'Onboard {{customer.name}}',
        assignee: 'customer_success_team',
      },
    },
  ],
})

// Track KPIs
const kpiList = kpis([
  {
    name: 'Monthly Recurring Revenue',
    description: 'Total predictable revenue per month',
    category: 'financial',
    unit: 'USD',
    target: 100000,
    current: 85000,
    frequency: 'monthly',
    dataSource: 'Billing System',
    formula: 'SUM(active_subscriptions.price)',
  },
  {
    name: 'Customer Churn Rate',
    description: 'Percentage of customers lost per month',
    category: 'customer',
    unit: 'percent',
    target: 5,
    current: 3.2,
    frequency: 'monthly',
    dataSource: 'CRM',
    formula: '(churned_customers / total_customers) * 100',
  },
  {
    name: 'Net Promoter Score',
    description: 'Customer satisfaction and loyalty metric',
    category: 'customer',
    unit: 'score',
    target: 50,
    current: 48,
    frequency: 'quarterly',
    dataSource: 'Survey Platform',
  },
])

// Define OKRs
const okrList = okrs([
  {
    objective: 'Achieve Product-Market Fit',
    description: 'Validate that our product solves a real problem for customers',
    period: 'Q2 2024',
    owner: 'CEO',
    keyResults: [
      {
        description: 'Increase Net Promoter Score',
        metric: 'NPS',
        startValue: 40,
        targetValue: 60,
        currentValue: 52,
        unit: 'score',
      },
      {
        description: 'Reduce monthly churn rate',
        metric: 'Churn Rate',
        startValue: 8,
        targetValue: 4,
        currentValue: 5.5,
        unit: 'percent',
      },
      {
        description: 'Achieve customer retention',
        metric: 'Customers with 3+ months',
        startValue: 50,
        targetValue: 200,
        currentValue: 125,
        unit: 'customers',
      },
    ],
    status: 'on-track',
    confidence: 75,
  },
])

// Calculate financials
const metrics = financials({
  revenue: 1000000,
  cogs: 300000,
  operatingExpenses: 500000,
  currency: 'USD',
  period: 'monthly',
})

// Use $ helper for calculations
console.log('\n=== Business Operations with $ ===')
console.log('Format currency:', $.format(1234.56))
console.log('Calculate percentage:', $.percent(25, 100))
console.log('Calculate growth:', $.growth(120, 100))
console.log('Calculate margin:', $.margin(100, 60))
console.log('Calculate ROI:', $.roi(150, 100))
console.log('Calculate LTV:', $.ltv(100, 12, 24))
console.log('Calculate CAC:', $.cac(10000, 100))
console.log('Calculate burn rate:', $.burnRate(100000, 70000, 3))
console.log('Calculate runway:', $.runway(100000, 10000))

// Display results
console.log('\n=== Business Summary ===')
console.log(`Company: ${company.name}`)
console.log(`Mission: ${company.mission}`)
console.log(`Team Size: ${company.teamSize}`)
console.log(`\nVision: ${vision.statement}`)
console.log(`Timeframe: ${vision.timeframe}`)
console.log(`\nGoals: ${goals.length}`)
console.log(`Products: ${product.name} - ${$.format(product.price!)} ${product.pricingModel}`)
console.log(`Services: ${service.name} - ${$.format(service.price!)} ${service.pricingModel}`)
console.log(`\nKPIs: ${kpiList.length}`)
console.log(`OKRs: ${okrList.length}`)
console.log(`\n=== Financial Metrics ===`)
console.log(`Revenue: ${$.format(metrics.revenue!)}`)
console.log(`Gross Profit: ${$.format(metrics.grossProfit!)}`)
console.log(`Gross Margin: ${metrics.grossMargin!.toFixed(1)}%`)
console.log(`Operating Income: ${$.format(metrics.operatingIncome!)}`)
console.log(`Operating Margin: ${metrics.operatingMargin!.toFixed(1)}%`)
console.log(`Net Income: ${$.format(metrics.netIncome!)}`)
console.log(`Net Margin: ${metrics.netMargin!.toFixed(1)}%`)
