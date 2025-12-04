# business-as-code

Primitives for expressing business logic, strategy, and operations as code. Define your entire business model—from vision and goals to products, services, processes, KPIs, OKRs, and financials—in a declarative, type-safe way.

## Installation

```bash
npm install business-as-code
```

## Quick Start

```typescript
import { Business, Product, Goals, kpis, okrs, financials, $ } from 'business-as-code'

// Define your business
const company = Business({
  name: 'Acme Corp',
  mission: 'To make widgets accessible to everyone',
  values: ['Innovation', 'Customer Focus', 'Integrity'],
})

// Define products
const product = Product({
  name: 'Widget Pro',
  pricingModel: 'subscription',
  price: 99,
  cogs: 20,
})

// Track KPIs
const metrics = kpis([
  {
    name: 'Monthly Recurring Revenue',
    category: 'financial',
    target: 100000,
    current: 85000,
  },
])

// Use $ helper for calculations
console.log($.format(1234.56))  // "$1,234.56"
console.log($.growth(120, 100)) // 20
console.log($.margin(100, 60))  // 40
```

## Core Concepts

### Business Entity

Define your company with mission, values, and organizational structure:

```typescript
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
    teams: [
      {
        name: 'Platform',
        lead: 'Alice',
        objectives: ['Build scalable infrastructure'],
      },
    ],
  },
})

// Helper functions
import { getTotalBudget, getTotalTeamSize, getDepartment, validateBusiness } from 'business-as-code'

const budget = getTotalBudget(company)      // 3000000
const teamSize = getTotalTeamSize(company)  // 5 (from department members)
const engineering = getDepartment(company, 'Engineering')
```

### Vision

Articulate long-term direction with measurable indicators:

```typescript
const vision = Vision({
  statement: "To become the world's most trusted widget platform",
  timeframe: '5 years',
  successIndicators: [
    '10M+ active users',
    'Present in 50+ countries',
    'Industry-leading NPS score',
    '$1B+ annual revenue',
  ],
})

// Helper functions
import { checkIndicator, calculateProgress, validateVision } from 'business-as-code'

const progress = calculateProgress(vision, {
  'active_users': 5000000,
  'countries': 30,
})
```

### Goals

Track strategic and operational objectives with dependencies:

```typescript
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
    category: 'strategic',
    targetDate: new Date('2024-12-31'),
    status: 'in-progress',
    progress: 30,
    dependencies: ['Launch MVP'],  // Depends on MVP goal
  },
])

// Helper functions
import {
  updateProgress,
  markAtRisk,
  complete,
  isOverdue,
  getGoalsByCategory,
  getGoalsByStatus,
  calculateOverallProgress,
  hasCircularDependencies,
  sortByDependencies,
} from 'business-as-code'

const strategic = getGoalsByCategory(goals, 'strategic')
const inProgress = getGoalsByStatus(goals, 'in-progress')
const progress = calculateOverallProgress(goals)  // Average progress
const sorted = sortByDependencies(goals)          // Topological sort
```

### Products

Define product offerings with pricing and roadmap:

```typescript
const product = Product({
  name: 'Widget Pro',
  description: 'Enterprise-grade widget management platform',
  category: 'SaaS',
  targetSegment: 'Enterprise',
  valueProposition: 'Reduce widget management costs by 50%',
  pricingModel: 'subscription',  // 'one-time' | 'subscription' | 'usage-based' | 'freemium' | 'tiered'
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

// Helper functions
import {
  calculateGrossMargin,
  calculateGrossProfit,
  getRoadmapByStatus,
  getRoadmapByPriority,
  getOverdueRoadmapItems,
  addFeature,
  removeFeature,
} from 'business-as-code'

const margin = calculateGrossMargin(product)    // 79.8%
const profit = calculateGrossProfit(product)    // 79
const highPriority = getRoadmapByPriority(product.roadmap!, 'high')
```

### Services

Define professional services with SLAs:

```typescript
const service = Service({
  name: 'Widget Consulting',
  description: 'Expert widget implementation and optimization',
  category: 'Consulting',
  targetSegment: 'Enterprise',
  valueProposition: 'Get expert help implementing widgets in 2 weeks',
  pricingModel: 'fixed',  // 'hourly' | 'fixed' | 'retainer' | 'value-based'
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

// Helper functions
import {
  calculateHourlyPrice,
  calculateMonthlyRetainer,
  checkSLAUptime,
  parseDeliveryTimeToDays,
  estimateCompletionDate,
  calculateValueBasedPrice,
} from 'business-as-code'

const hourlyRate = calculateHourlyPrice(service, 40)  // hours
const days = parseDeliveryTimeToDays(service)         // 14
const completion = estimateCompletionDate(service)    // Date
```

### Processes

Define business processes with steps and metrics:

```typescript
const process = Process({
  name: 'Customer Onboarding',
  description: 'Process for onboarding new customers',
  category: 'core',  // 'core' | 'support' | 'management'
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
  metrics: [
    {
      name: 'Time to First Value',
      target: 7,
      current: 5,
      unit: 'days',
    },
  ],
})

// Helper functions
import {
  getStepsInOrder,
  getStepsByAutomationLevel,
  calculateTotalDuration,
  formatDuration,
  calculateAutomationPercentage,
  getMetric,
  meetsTarget,
  addStep,
  removeStep,
} from 'business-as-code'

const automated = getStepsByAutomationLevel(process.steps!, 'automated')
const duration = calculateTotalDuration(process)    // Total duration
const automationPct = calculateAutomationPercentage(process)  // 50%
```

### Workflows

Define automated sequences triggered by events:

```typescript
const workflow = Workflow({
  name: 'New Customer Welcome',
  description: 'Automated welcome sequence for new customers',
  trigger: {
    type: 'event',      // 'event' | 'schedule' | 'webhook' | 'manual'
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
      type: 'wait',
      description: 'Wait 24 hours',
      params: { duration: '24h' },
    },
    {
      order: 3,
      type: 'create',
      description: 'Create onboarding task',
      params: {
        type: 'Task',
        title: 'Onboard {{customer.name}}',
        assignee: 'customer_success_team',
      },
      condition: '{{customer.plan}} == "enterprise"',
    },
  ],
})

// Helper functions
import {
  getActionsInOrder,
  getActionsByType,
  getConditionalActions,
  addAction,
  isEventTrigger,
  isScheduleTrigger,
  parseWaitDuration,
  evaluateCondition,
  fillTemplate,
} from 'business-as-code'

const sendActions = getActionsByType(workflow.actions!, 'send')
const conditional = getConditionalActions(workflow.actions!)
```

### KPIs (Key Performance Indicators)

Track critical business metrics:

```typescript
const kpiList = kpis([
  {
    name: 'Monthly Recurring Revenue',
    description: 'Total predictable revenue per month',
    category: 'financial',  // 'financial' | 'customer' | 'operations' | 'people' | 'growth'
    unit: 'USD',
    target: 100000,
    current: 85000,
    frequency: 'monthly',
    dataSource: 'Billing System',
    formula: 'SUM(active_subscriptions.price)',
  },
  {
    name: 'Customer Churn Rate',
    category: 'customer',
    unit: 'percent',
    target: 5,
    current: 3.2,
    frequency: 'monthly',
  },
  {
    name: 'Net Promoter Score',
    category: 'customer',
    unit: 'score',
    target: 50,
    current: 48,
    frequency: 'quarterly',
  },
])

// Helper functions
import {
  calculateAchievement,
  kpiMeetsTarget,
  updateCurrent,
  getKPIsByCategory,
  getKPIsOnTarget,
  getKPIsOffTarget,
  calculateHealthScore,
  groupByCategory,
  calculateVariance,
  formatValue,
} from 'business-as-code'

const achievement = calculateAchievement(kpiList[0])  // 85%
const financial = getKPIsByCategory(kpiList, 'financial')
const onTarget = getKPIsOnTarget(kpiList)
const healthScore = calculateHealthScore(kpiList)     // Overall health
```

### OKRs (Objectives and Key Results)

Set and track ambitious goals:

```typescript
const okrList = okrs([
  {
    objective: 'Achieve Product-Market Fit',
    description: 'Validate that our product solves a real problem',
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

// Helper functions
import {
  calculateKeyResultProgress,
  calculateOKRProgress,
  calculateConfidence,
  updateKeyResult,
  isKeyResultOnTrack,
  isOKROnTrack,
  getKeyResultsAtRisk,
  getOKRsByOwner,
  getOKRsByPeriod,
  calculateSuccessRate,
  formatKeyResult,
} from 'business-as-code'

const progress = calculateOKRProgress(okrList[0])     // Average KR progress
const atRisk = getKeyResultsAtRisk(okrList[0].keyResults!)
const q2OKRs = getOKRsByPeriod(okrList, 'Q2 2024')
```

### Financials

Calculate financial metrics and statements:

```typescript
const metrics = financials({
  revenue: 1000000,
  cogs: 300000,
  operatingExpenses: 500000,
  currency: 'USD',
  period: 'monthly',
})

// Automatically calculates:
// - grossProfit: 700000
// - grossMargin: 70%
// - operatingIncome: 200000
// - operatingMargin: 20%
// - netIncome: 200000
// - netMargin: 20%

// Helper functions
import {
  calculateGrossMargin,
  calculateOperatingMargin,
  calculateNetMargin,
  calculateEBITDAMargin,
  calculateBurnRate,
  calculateRunway,
  calculateCAC,
  calculateLTV,
  calculateLTVtoCAC,
  calculatePaybackPeriod,
  calculateARR,
  calculateMRR,
  calculateGrowthRate,
  calculateCAGR,
  calculateROI,
  calculateROE,
  calculateROA,
  calculateQuickRatio,
  calculateCurrentRatio,
  calculateDebtToEquity,
  formatCurrency,
  createStatement,
  compareMetrics,
} from 'business-as-code'

// SaaS metrics
const mrr = calculateMRR(subscriptions)
const arr = calculateARR(mrr)
const ltv = calculateLTV(avgRevenue, churnRate)
const cac = calculateCAC(marketingSpend, newCustomers)
const ltvCacRatio = calculateLTVtoCAC(ltv, cac)

// Startup metrics
const burnRate = calculateBurnRate(cashStart, cashEnd, months)
const runway = calculateRunway(cash, burnRate)
const growth = calculateGrowthRate(current, previous)
```

### $ Helper

Convenient helper for common business calculations:

```typescript
import { $ } from 'business-as-code'

// Currency formatting
$.format(1234.56)           // "$1,234.56"
$.format(1234.56, 'EUR')    // "€1,234.56"

// Percentages
$.percent(25, 100)          // 25

// Growth
$.growth(120, 100)          // 20 (20% growth)

// Margins
$.margin(100, 60)           // 40 (40% margin)

// ROI
$.roi(150, 100)             // 50 (50% ROI)

// Customer metrics
$.ltv(100, 12, 24)          // Lifetime value
$.cac(10000, 100)           // Customer acquisition cost (100)

// Startup metrics
$.burnRate(100000, 70000, 3)  // Monthly burn rate (10000)
$.runway(100000, 10000)       // Runway in months (10)

// Context management
$.context                   // Access business context
$.log('event', data)        // Log business event
```

### Context Management

Share business context across your application:

```typescript
import { updateContext, getContext, resetContext } from 'business-as-code'

// Set context
updateContext({
  business: company,
  goals: goals,
  kpis: kpiList,
  financials: metrics,
})

// Access context
const ctx = getContext()
console.log(ctx.business?.name)

// Reset context
resetContext()
```

## API Reference

### Entity Functions

| Function | Description |
|----------|-------------|
| `Business(def)` | Create a business entity |
| `Vision(def)` | Define business vision |
| `Goals(defs)` | Create goal list |
| `Goal(def)` | Create single goal |
| `Product(def)` | Define a product |
| `Service(def)` | Define a service |
| `Process(def)` | Define a business process |
| `Workflow(def)` | Define an automated workflow |
| `kpis(defs)` | Create KPI list |
| `kpi(def)` | Create single KPI |
| `okrs(defs)` | Create OKR list |
| `okr(def)` | Create single OKR |
| `financials(data)` | Calculate financial metrics |

### $ Helper Methods

| Method | Description |
|--------|-------------|
| `$.format(amount, currency?)` | Format as currency |
| `$.percent(value, total)` | Calculate percentage |
| `$.growth(current, previous)` | Calculate growth rate |
| `$.margin(revenue, cost)` | Calculate margin |
| `$.roi(gain, cost)` | Calculate ROI |
| `$.ltv(value, frequency, lifetime)` | Customer lifetime value |
| `$.cac(spend, customers)` | Customer acquisition cost |
| `$.burnRate(start, end, months)` | Monthly burn rate |
| `$.runway(cash, burnRate)` | Runway in months |
| `$.context` | Access business context |
| `$.log(event, data?)` | Log business event |

### Types

All types are fully exported for TypeScript users:

```typescript
import type {
  BusinessDefinition,
  VisionDefinition,
  GoalDefinition,
  ProductDefinition,
  ServiceDefinition,
  ProcessDefinition,
  WorkflowDefinition,
  KPIDefinition,
  OKRDefinition,
  KeyResult,
  FinancialMetrics,
  FinancialStatement,
  BusinessContext,
  BusinessOperations,
  Currency,
  TimePeriod,
} from 'business-as-code'
```

## Use Cases

### Startup Planning
Define your business model, track runway, and monitor growth metrics.

### Strategic Planning
Set OKRs, track goals, and measure progress toward vision.

### Financial Modeling
Calculate margins, growth rates, and SaaS metrics.

### Process Documentation
Document business processes with automation levels and metrics.

### Dashboard Building
Power business dashboards with structured data.

## License

MIT
