# business-as-code

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

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

---

## Entity Abstractions

Each entity defines **Properties** (data fields), **Actions** (imperative verbs), and **Events** (past tense state changes). This follows the same Noun pattern used in `digital-tools` and `ai-database`.

### Business

Core business entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Business** | `name`, `legalName`, `type` (startup, smb, enterprise, agency), `stage` (idea, pre-seed, seed, series-a...), `industry`, `mission`, `vision`, `values`, `targetMarket`, `teamSize`, `status` |
| **Vision** | `statement`, `timeframe`, `targetDate`, `successIndicators`, `progress`, `status` |
| **Value** | `name`, `description`, `behaviors`, `antiPatterns`, `priority`, `status` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Business** | create, update, launch, pivot, scale, acquire, merge, close, archive | created, updated, launched, pivoted, scaled, acquired, merged, closed, archived |
| **Vision** | create, update, activate, revise, achieve, abandon, archive | created, updated, activated, revised, achieved, abandoned, archived |
| **Value** | create, update, prioritize, deprecate, archive | created, updated, prioritized, deprecated, archived |

---

### Organization

Organizational hierarchy entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Organization** | `name`, `type` (functional, divisional, matrix, flat), `fiscalYearStart`, `defaultCurrency`, `departmentCount`, `teamCount`, `positionCount`, `status` |
| **Department** | `name`, `code`, `type` (engineering, product, design, marketing...), `budget`, `budgetCurrency`, `headcount`, `level`, `status` |
| **Team** | `name`, `code`, `type` (product, platform, growth...), `methodology` (scrum, kanban...), `capacity`, `headcount`, `slackChannel`, `status` |
| **Position** | `title`, `code`, `level` (intern, junior, mid, senior, staff...), `track` (ic, management, executive), `employmentType`, `workLocation`, `salaryMin`, `salaryMax`, `fte`, `skills`, `status` |
| **Role** | `name`, `code`, `type` (executive, manager, lead, contributor...), `permissions`, `capabilities`, `approvalLevel`, `approvalLimit`, `status` |
| **Worker** | `name`, `email`, `type` (human, agent), `firstName`, `lastName`, `agentId`, `modelId`, `availability`, `capacity`, `status` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Organization** | create, update, restructure, merge, split, archive | created, updated, restructured, merged, split, archived |
| **Department** | create, update, rename, setBudget, addTeam, removeTeam, setHead, merge, split, dissolve, archive | created, updated, renamed, budgetSet, teamAdded, teamRemoved, headChanged, merged, split, dissolved, archived |
| **Team** | create, update, rename, setLead, addMember, removeMember, setCapacity, assignProject, unassignProject, archive | created, updated, renamed, leadChanged, memberAdded, memberRemoved, capacityChanged, projectAssigned, projectUnassigned, archived |
| **Position** | create, update, open, fill, freeze, eliminate, transfer, promote, setCompensation, archive | created, updated, opened, filled, frozen, eliminated, transferred, promoted, compensationChanged, archived |
| **Role** | create, update, grantPermission, revokePermission, setApprovalLimit, deprecate, archive | created, updated, permissionGranted, permissionRevoked, approvalLimitChanged, deprecated, archived |
| **Worker** | create, update, onboard, assign, reassign, setAvailability, promote, transfer, offboard, archive | created, updated, onboarded, assigned, reassigned, availabilityChanged, promoted, transferred, offboarded, archived |

---

### Goals

Goal tracking entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Goal** | `name`, `type` (strategic, operational, tactical), `category` (growth, revenue, customer...), `priority`, `startDate`, `targetDate`, `progress`, `confidence`, `successMetrics`, `targetValue`, `currentValue`, `status` |
| **OKR** | `objective`, `type` (company, department, team, individual), `period`, `progress`, `confidence`, `grade`, `keyResultCount`, `status` |
| **KeyResult** | `description`, `metric`, `unit`, `startValue`, `targetValue`, `currentValue`, `progress`, `confidence`, `direction` (increase, decrease, maintain), `status` |
| **KPI** | `name`, `code`, `category` (financial, customer, operations...), `type` (leading, lagging), `unit`, `format`, `targetValue`, `currentValue`, `warningThreshold`, `criticalThreshold`, `direction`, `frequency`, `formula`, `status` |
| **Metric** | `name`, `category`, `value`, `unit`, `timestamp`, `period`, `source` |
| **Initiative** | `name`, `type` (project, program, experiment), `priority`, `startDate`, `endDate`, `progress`, `budget`, `spent`, `status` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Goal** | create, update, activate, updateProgress, markAtRisk, complete, cancel, extend, archive | created, updated, activated, progressUpdated, markedAtRisk, completed, cancelled, extended, overdue, archived |
| **OKR** | create, update, activate, addKeyResult, removeKeyResult, updateProgress, updateConfidence, grade, complete, cancel, archive | created, updated, activated, keyResultAdded, keyResultRemoved, progressUpdated, confidenceUpdated, graded, completed, cancelled, archived |
| **KeyResult** | create, update, updateValue, updateConfidence, complete, delete | created, updated, valueUpdated, confidenceUpdated, completed, deleted |
| **KPI** | create, update, measure, setTarget, setThresholds, alert, archive | created, updated, measured, targetSet, thresholdBreached, targetMet, alerted, archived |
| **Metric** | record, update, delete | recorded, updated, deleted |
| **Initiative** | create, update, approve, start, pause, resume, complete, cancel, archive | created, updated, approved, started, paused, resumed, completed, cancelled, archived |

---

### Offerings

Product and service entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Product** | `name`, `slug`, `type` (saas, app, platform, api...), `category`, `targetSegment`, `valueProposition`, `pricingModel` (free, freemium, subscription, one-time, usage-based, tiered), `price`, `currency`, `cogs`, `grossMargin`, `stage` (concept, development, alpha, beta, ga...), `status`, `visibility` |
| **Service** | `name`, `type` (consulting, implementation, support, training...), `pricingModel` (hourly, daily, fixed, retainer, value-based), `hourlyRate`, `deliveryTime`, `deliveryModel`, `slaUptime`, `slaResponseTime`, `inclusions`, `exclusions`, `deliverables`, `status` |
| **Feature** | `name`, `category`, `type` (core, premium, add-on, beta), `benefit`, `availability`, `enabledByDefault`, `status` |
| **PricingPlan** | `name`, `tier` (free, starter, pro, business, enterprise), `price`, `currency`, `billingPeriod`, `annualDiscount`, `includedUnits`, `unitPrice`, `usageLimits`, `trialDays`, `highlighted`, `status` |
| **RoadmapItem** | `name`, `type` (feature, improvement, bug-fix...), `quarter`, `targetDate`, `priority`, `effort`, `impact`, `progress`, `status`, `visibility` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Product** | create, update, launch, pause, resume, updatePricing, addFeature, removeFeature, sunset, archive | created, updated, launched, paused, resumed, pricingUpdated, featureAdded, featureRemoved, sunset, archived |
| **Service** | create, update, publish, pause, resume, updatePricing, updateSLA, discontinue, archive | created, updated, published, paused, resumed, pricingUpdated, slaUpdated, discontinued, archived |
| **Feature** | create, update, enable, disable, deprecate, remove | created, updated, enabled, disabled, deprecated, removed |
| **PricingPlan** | create, update, publish, hide, updatePrice, addFeature, removeFeature, discontinue, archive | created, updated, published, hidden, priceUpdated, featureAdded, featureRemoved, discontinued, archived |
| **RoadmapItem** | create, update, schedule, start, complete, defer, cancel, archive | created, updated, scheduled, started, completed, deferred, cancelled, archived |

---

### Operations

Process and workflow entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Process** | `name`, `type` (core, support, management), `category`, `triggerType`, `inputs`, `outputs`, `averageDuration`, `sla`, `automationLevel` (manual, semi-automated, automated, autonomous), `automationPercentage`, `version`, `status` |
| **ProcessStep** | `name`, `order`, `type` (task, decision, approval, notification, wait...), `automationLevel`, `responsible`, `accountable`, `estimatedDuration`, `sla`, `inputs`, `outputs`, `instructions`, `condition` |
| **Workflow** | `name`, `triggerType` (event, schedule, webhook, manual, api), `triggerEvent`, `triggerSchedule`, `timeout`, `retryPolicy`, `concurrency`, `runCount`, `successCount`, `failureCount`, `lastRunAt`, `status`, `enabled` |
| **WorkflowAction** | `name`, `order`, `type` (http, email, slack, database, transform, condition, loop, delay, approval, ai), `operation`, `config`, `inputs`, `condition`, `continueOnError`, `retryOnFailure` |
| **WorkflowRun** | `status` (pending, running, completed, failed, cancelled, waiting), `startedAt`, `completedAt`, `duration`, `currentStep`, `totalSteps`, `triggerData`, `output`, `error`, `attempt` |
| **Policy** | `name`, `code`, `type` (compliance, operational, security, hr, financial, data), `content`, `rules`, `enforcementLevel`, `effectiveDate`, `reviewDate`, `version`, `status` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Process** | create, update, publish, addStep, removeStep, reorderSteps, automate, deprecate, archive | created, updated, published, stepAdded, stepRemoved, stepsReordered, automated, deprecated, archived |
| **ProcessStep** | create, update, move, duplicate, delete | created, updated, moved, duplicated, deleted |
| **Workflow** | create, update, enable, disable, trigger, test, addAction, removeAction, archive | created, updated, enabled, disabled, triggered, completed, failed, archived |
| **WorkflowAction** | create, update, move, duplicate, delete, test | created, updated, moved, duplicated, deleted, executed, failed |
| **WorkflowRun** | start, pause, resume, cancel, retry | started, paused, resumed, completed, failed, cancelled, retried |
| **Policy** | create, update, submit, approve, publish, supersede, archive | created, updated, submitted, approved, published, superseded, archived |

---

### Financials

Financial entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Budget** | `name`, `type` (operating, capital, project, marketing, hiring, r&d), `period`, `startDate`, `endDate`, `amount`, `currency`, `spent`, `committed`, `available`, `utilization`, `status` |
| **Revenue** | `type` (subscription, one-time, usage, professional-services...), `category`, `source`, `amount`, `currency`, `period`, `date`, `isRecurring`, `recognized`, `recognizedAt`, `deferredAmount`, `segment`, `region` |
| **Expense** | `description`, `type` (payroll, cogs, marketing, sales, r&d, g&a...), `category`, `amount`, `currency`, `date`, `isRecurring`, `isCapex`, `isDeductible`, `vendor`, `invoiceNumber`, `status` |
| **Investment** | `name`, `type` (pre-seed, seed, series-a...), `instrumentType` (equity, safe, convertible-note, debt), `amount`, `currency`, `preMoneyValuation`, `postMoneyValuation`, `equityPercentage`, `leadInvestor`, `investors`, `status` |
| **FinancialPeriod** | `name`, `type` (month, quarter, half-year, year), `startDate`, `endDate`, `revenue`, `cogs`, `grossProfit`, `grossMargin`, `operatingExpenses`, `operatingIncome`, `operatingMargin`, `netIncome`, `ebitda`, `mrr`, `arr`, `nrr`, `grr`, `cac`, `ltv`, `ltvCacRatio`, `churnRate`, `burnRate`, `runway`, `status` |
| **Forecast** | `name`, `type` (revenue, expense, cash, headcount, arr), `scenario` (base, optimistic, pessimistic, stretch), `startDate`, `endDate`, `granularity`, `values`, `total`, `assumptions`, `growthRate`, `confidenceLevel`, `version`, `status` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Budget** | create, update, submit, approve, allocate, reallocate, freeze, unfreeze, close, archive | created, updated, submitted, approved, allocated, reallocated, frozen, unfrozen, thresholdWarning, overBudget, closed, archived |
| **Revenue** | record, update, recognize, defer, void | recorded, updated, recognized, deferred, voided |
| **Expense** | create, update, submit, approve, reject, pay, void | created, updated, submitted, approved, rejected, paid, voided |
| **Investment** | create, update, negotiate, signTermSheet, close, announce, cancel | created, updated, negotiated, termSheetSigned, closed, announced, cancelled |
| **FinancialPeriod** | create, update, close, reopen, audit | created, updated, closed, reopened, audited |
| **Forecast** | create, update, submit, approve, supersede, archive | created, updated, submitted, approved, superseded, archived |

---

### Customers

Customer relationship management entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Customer** | `name`, `type` (individual, company, nonprofit), `stage` (prospect, trial, onboarding, active, at-risk, churned), `industry`, `size`, `annualRevenue`, `employeeCount`, `acquisitionSource`, `acquisitionDate`, `ltv`, `healthScore`, `nps`, `tier`, `status` |
| **Account** | `name`, `type` (customer, prospect, partner), `industry`, `annualRevenue`, `employeeCount`, `tier`, `owner`, `territory`, `mrr`, `arr`, `healthScore`, `churnRisk`, `expansionPotential`, `status` |
| **Contact** | `name`, `email`, `phone`, `title`, `role` (decision-maker, influencer, champion, user, blocker), `department`, `isPrimary`, `optInMarketing`, `optInEmail`, `lastContactedDate`, `status` |
| **Segment** | `name`, `type` (demographic, behavioral, firmographic, technographic, psychographic), `criteria`, `customerCount`, `totalRevenue`, `avgLtv`, `avgHealthScore`, `status` |
| **Persona** | `name`, `role`, `seniority`, `department`, `goals`, `painPoints`, `motivations`, `objections`, `preferredChannels`, `buyingRole`, `status` |
| **Interaction** | `type` (call, email, meeting, demo, support, chat, event), `direction` (inbound, outbound), `subject`, `outcome`, `nextSteps`, `date`, `duration`, `sentiment`, `status` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Customer** | create, update, qualify, convert, onboard, upgrade, downgrade, churn, winBack, delete, archive | created, updated, qualified, converted, onboarded, upgraded, downgraded, churned, wonBack, deleted, archived |
| **Account** | create, update, qualify, assign, reassign, merge, upgrade, downgrade, close, archive | created, updated, qualified, assigned, reassigned, merged, upgraded, downgraded, closed, archived |
| **Contact** | create, update, verify, enrich, optIn, optOut, merge, delete, archive | created, updated, verified, enriched, optedIn, optedOut, merged, deleted, archived |
| **Segment** | create, update, refresh, activate, deactivate, archive | created, updated, refreshed, activated, deactivated, archived |
| **Persona** | create, update, validate, archive | created, updated, validated, archived |
| **Interaction** | create, update, complete, cancel, followUp | created, updated, completed, cancelled, followedUp |

---

### Sales

Sales pipeline and revenue entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Deal** | `name`, `type` (new-business, expansion, renewal, upsell, cross-sell), `amount`, `currency`, `probability`, `stage`, `expectedCloseDate`, `actualCloseDate`, `daysInStage`, `daysOpen`, `leadSource`, `lossReason`, `competitor`, `forecastCategory`, `status` |
| **Pipeline** | `name`, `type` (sales, renewal, expansion, partnership), `totalValue`, `weightedValue`, `dealCount`, `avgDealSize`, `avgCycleTime`, `winRate`, `quotaAttainment`, `status` |
| **Stage** | `name`, `order`, `type` (qualification, discovery, proposal, negotiation, closed), `probability`, `durationDays`, `avgDuration`, `dealCount`, `dealValue`, `exitCriteria`, `status` |
| **Contract** | `name`, `type` (subscription, service, license, NDA, MSA, SOW), `value`, `currency`, `startDate`, `endDate`, `autoRenew`, `renewalNoticeDays`, `paymentTerms`, `status` |
| **Subscription** | `type` (monthly, annual, multi-year), `plan`, `mrr`, `arr`, `quantity`, `unitPrice`, `discount`, `startDate`, `renewalDate`, `cancelledDate`, `churnReason`, `status` |
| **Quote** | `name`, `version`, `amount`, `currency`, `discount`, `validUntil`, `paymentTerms`, `status` (draft, sent, viewed, accepted, rejected, expired) |
| **Order** | `orderNumber`, `type` (new, renewal, expansion, upgrade, downgrade), `amount`, `currency`, `taxAmount`, `totalAmount`, `status` (draft, pending, confirmed, processing, fulfilled, cancelled) |
| **Invoice** | `invoiceNumber`, `type` (standard, credit, debit, proforma), `amount`, `taxAmount`, `totalAmount`, `currency`, `dueDate`, `status` (draft, sent, viewed, paid, overdue, void) |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Deal** | create, update, qualify, advance, stall, win, lose, reopen, delete, archive | created, updated, qualified, stageChanged, stalled, won, lost, reopened, deleted, archived |
| **Pipeline** | create, update, refresh, forecast, archive | created, updated, refreshed, forecasted, archived |
| **Stage** | create, update, reorder, archive | created, updated, reordered, archived |
| **Contract** | create, update, send, sign, activate, amend, renew, terminate, expire, archive | created, updated, sent, signed, activated, amended, renewed, terminated, expired, archived |
| **Subscription** | create, update, activate, upgrade, downgrade, pause, resume, cancel, renew, churn | created, updated, activated, upgraded, downgraded, paused, resumed, cancelled, renewed, churned |
| **Quote** | create, update, send, view, accept, reject, revise, expire, delete | created, updated, sent, viewed, accepted, rejected, revised, expired, deleted |
| **Order** | create, update, confirm, process, fulfill, cancel, refund | created, updated, confirmed, processing, fulfilled, cancelled, refunded |
| **Invoice** | create, update, send, view, pay, void, writeOff, remind | created, updated, sent, viewed, paid, voided, writtenOff, reminded |

---

### Marketing

Marketing and demand generation entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Campaign** | `name`, `type` (email, social, content, paid-search, paid-social, event, webinar, direct-mail, ABM), `channel`, `status` (draft, scheduled, active, paused, completed, cancelled), `budget`, `spent`, `impressions`, `clicks`, `ctr`, `conversions`, `conversionRate`, `cpl`, `roi`, `startDate`, `endDate` |
| **Lead** | `name`, `email`, `company`, `title`, `source`, `status` (new, contacted, qualified, unqualified, nurturing, converted, lost), `score`, `grade`, `temperature` (cold, warm, hot), `mqlDate`, `sqlDate`, `utmSource`, `utmMedium`, `utmCampaign` |
| **Audience** | `name`, `type` (segment, list, lookalike, retargeting, suppression), `source`, `size`, `refreshFrequency`, `criteria`, `status` |
| **Content** | `title`, `type` (blog, whitepaper, ebook, case-study, video, webinar, infographic, podcast, social, email), `format`, `topic`, `stage` (awareness, consideration, decision), `author`, `wordCount`, `readTime`, `views`, `downloads`, `status` |
| **Funnel** | `name`, `type` (marketing, sales, conversion, onboarding), `totalVisitors`, `totalConversions`, `conversionRate`, `avgTimeToConvert`, `dropoffRate`, `status` |
| **FunnelStage** | `name`, `order`, `type` (awareness, interest, consideration, intent, evaluation, purchase), `visitors`, `conversions`, `conversionRate`, `dropoffRate`, `avgTimeInStage` |
| **MarketingEvent** | `name`, `type` (conference, webinar, workshop, meetup, trade-show, launch-event, virtual-event), `format` (in-person, virtual, hybrid), `capacity`, `registrations`, `attendance`, `attendanceRate`, `cost`, `costPerAttendee`, `leadsGenerated`, `roi`, `status` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Campaign** | create, update, launch, pause, resume, complete, cancel, clone, analyze | created, updated, launched, paused, resumed, completed, cancelled, cloned, analyzed |
| **Lead** | create, update, score, grade, qualify, disqualify, nurture, convert, assign, merge | created, updated, scored, graded, qualified, disqualified, nurtured, converted, assigned, merged |
| **Audience** | create, update, refresh, activate, deactivate, export, archive | created, updated, refreshed, activated, deactivated, exported, archived |
| **Content** | create, update, publish, unpublish, archive, promote, analyze | created, updated, published, unpublished, archived, promoted, analyzed |
| **Funnel** | create, update, analyze, optimize, archive | created, updated, analyzed, optimized, archived |
| **FunnelStage** | create, update, reorder | created, updated, reordered |
| **MarketingEvent** | create, update, publish, register, unregister, start, end, cancel, archive | created, updated, published, registered, unregistered, started, ended, cancelled, archived |

---

### Partnerships

Partner and vendor management entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Partner** | `name`, `type` (strategic, technology, channel, solution, reseller, referral, OEM), `tier` (platinum, gold, silver, bronze), `status`, `territories`, `specializations`, `certifications`, `revenueShare`, `referralFee`, `totalRevenue`, `totalDeals`, `nda`, `portalAccess`, `enablementComplete` |
| **Vendor** | `name`, `type` (supplier, contractor, consultant, SaaS, service), `category`, `status`, `paymentTerms`, `contractValue`, `annualSpend`, `riskLevel`, `complianceStatus`, `slaScore`, `qualityScore`, `certifications` |
| **Affiliate** | `name`, `type` (individual, company, influencer, blogger, publisher), `status`, `affiliateId`, `referralCode`, `commissionRate`, `commissionType`, `totalClicks`, `totalConversions`, `conversionRate`, `totalRevenue`, `totalCommissions`, `tier` |
| **Partnership** | `name`, `type` (strategic, technology, channel, co-marketing, co-selling, integration, reseller, white-label, OEM), `status`, `objectives`, `revenueShare`, `territories`, `exclusivity`, `targetRevenue`, `actualRevenue`, `healthScore` |
| **Integration** | `name`, `type` (API, webhook, SDK, embed, SSO, data-sync), `status`, `direction` (inbound, outbound, bidirectional), `authentication`, `syncFrequency`, `lastSyncStatus`, `enabled` |
| **Reseller** | `name`, `type` (VAR, distributor, MSP, SI, retail), `tier`, `territories`, `verticals`, `products`, `discountLevel`, `margin`, `quota`, `yearToDateSales`, `certifiedReps`, `dealRegistration` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Partner** | create, update, onboard, activate, deactivate, suspend, terminate, upgrade, downgrade, certify, enable, review, renew | created, updated, onboarded, activated, deactivated, suspended, terminated, upgraded, downgraded, certified, enabled, reviewed, renewed |
| **Vendor** | create, update, evaluate, approve, reject, activate, suspend, terminate, review, audit, renew | created, updated, evaluated, approved, rejected, activated, suspended, terminated, reviewed, audited, renewed |
| **Affiliate** | create, update, approve, reject, activate, suspend, terminate, upgrade, downgrade, payout, track | created, updated, approved, rejected, activated, suspended, terminated, upgraded, downgraded, paidOut, tracked |
| **Partnership** | create, update, propose, negotiate, approve, reject, activate, pause, resume, extend, terminate, renew, review | created, updated, proposed, negotiated, approved, rejected, activated, paused, resumed, extended, terminated, renewed, reviewed |
| **Integration** | create, update, develop, test, deploy, enable, disable, sync, debug, deprecate, version | created, updated, developed, tested, deployed, enabled, disabled, synced, debugged, deprecated, versioned |
| **Reseller** | create, update, onboard, activate, suspend, terminate, upgrade, downgrade, certify, enable, allocateFunds | created, updated, onboarded, activated, suspended, terminated, upgraded, downgraded, certified, enabled, fundsAllocated |

---

### Legal

Legal and compliance entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Agreement** | `name`, `type` (NDA, MSA, SOW, SLA, DPA, employment, partnership, licensing), `status`, `parties`, `counterparty`, `effectiveDate`, `expirationDate`, `term`, `autoRenew`, `value`, `governingLaw`, `confidentiality`, `nonCompete`, `exclusivity`, `version` |
| **License** | `name`, `type` (software, content, patent, trademark, API, SDK), `model` (perpetual, subscription, usage-based, seat-based), `status`, `licenseKey`, `product`, `edition`, `seats`, `maxSeats`, `features`, `restrictions`, `territory`, `exclusivity`, `transferable` |
| **IntellectualProperty** | `name`, `type` (patent, trademark, copyright, trade-secret, design, domain), `status`, `registrationNumber`, `filingDate`, `registrationDate`, `expirationDate`, `jurisdiction`, `classes`, `claims`, `inventors`, `owner`, `value` |
| **Compliance** | `name`, `type` (regulation, certification, standard, policy, audit), `framework` (SOC2, ISO27001, GDPR, HIPAA, PCI-DSS, SOX, CCPA), `status`, `scope`, `requirements`, `controls`, `certificationDate`, `expirationDate`, `findings`, `complianceScore` |
| **LegalPolicy** | `name`, `type` (privacy, security, HR, ethics, acceptable-use, data-retention), `status`, `version`, `scope`, `applicableTo`, `effectiveDate`, `reviewDate`, `owner`, `acknowledgmentRequired` |
| **Trademark** | `name`, `mark`, `type` (word, design, combined, sound, color), `status`, `registrationNumber`, `filingDate`, `registrationDate`, `expirationDate`, `jurisdiction`, `classes`, `goodsServices`, `owner` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Agreement** | create, update, draft, review, negotiate, approve, reject, sign, execute, amend, renew, terminate, expire, archive | created, updated, drafted, reviewed, negotiated, approved, rejected, signed, executed, amended, renewed, terminated, expired, archived |
| **License** | create, update, issue, activate, suspend, renew, upgrade, downgrade, transfer, revoke, expire | created, updated, issued, activated, suspended, renewed, upgraded, downgraded, transferred, revoked, expired |
| **IntellectualProperty** | create, update, file, register, publish, grant, maintain, renew, license, assign, abandon, enforce | created, updated, filed, registered, published, granted, maintained, renewed, licensed, assigned, abandoned, enforced |
| **Compliance** | create, update, assess, audit, certify, remediate, renew, expire, exempt, report | created, updated, assessed, audited, certified, remediated, renewed, expired, exempted, reported |
| **LegalPolicy** | create, update, draft, review, approve, publish, deprecate, archive, acknowledge, enforce | created, updated, drafted, reviewed, approved, published, deprecated, archived, acknowledged, enforced |
| **Trademark** | create, update, search, file, register, renew, maintain, license, abandon, cancel, enforce, monitor | created, updated, searched, filed, registered, renewed, maintained, licensed, abandoned, cancelled, enforced, monitored |

---

### Risk

Risk management entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Risk** | `name`, `type` (strategic, operational, financial, compliance, reputational, security, technology), `category`, `status`, `source`, `likelihood`, `impact`, `riskScore`, `riskLevel`, `inherentRiskScore`, `residualRiskScore`, `treatment` (accept, mitigate, transfer, avoid), `financialImpact`, `owner` |
| **Mitigation** | `name`, `type` (preventive, detective, corrective, compensating), `status`, `priority`, `strategy`, `expectedReduction`, `actualReduction`, `cost`, `owner`, `plannedStartDate`, `plannedEndDate`, `effectiveness`, `progress` |
| **Incident** | `name`, `type` (security, data-breach, system-outage, operational, compliance, safety, fraud), `status`, `severity`, `priority`, `impact`, `impactedUsers`, `impactedSystems`, `rootCause`, `detectedAt`, `resolvedAt`, `timeToDetect`, `timeToResolve`, `lessonsLearned` |
| **Control** | `name`, `type` (preventive, detective, corrective, compensating, deterrent), `category` (technical, administrative, physical, operational), `status`, `controlId`, `framework`, `objective`, `frequency`, `automationLevel`, `effectiveness`, `maturity`, `lastTestDate` |
| **Assessment** | `name`, `type` (risk, security, compliance, vendor, impact, vulnerability, audit), `status`, `scope`, `methodology`, `framework`, `assessor`, `findings`, `criticalFindings`, `overallRating`, `riskScore`, `recommendations` |
| **Issue** | `name`, `type` (operational, technical, process, compliance, vendor, customer), `status`, `severity`, `priority`, `impact`, `rootCause`, `resolution`, `workaround`, `owner`, `assignee`, `dueDate`, `escalated` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Risk** | create, update, assess, escalate, accept, mitigate, transfer, avoid, review, close, reopen, monitor | created, updated, assessed, escalated, accepted, mitigated, transferred, avoided, reviewed, closed, reopened, monitored |
| **Mitigation** | create, update, plan, start, implement, verify, complete, fail, defer, cancel | created, updated, planned, started, implemented, verified, completed, failed, deferred, cancelled |
| **Incident** | create, update, detect, confirm, escalate, investigate, contain, eradicate, recover, resolve, close, reopen, notify, postMortem | created, updated, detected, confirmed, escalated, investigated, contained, eradicated, recovered, resolved, closed, reopened, notified, postMortemCompleted |
| **Control** | create, update, implement, test, review, deprecate, remediate, evidence | created, updated, implemented, tested, reviewed, deprecated, remediated, evidenced |
| **Assessment** | create, update, schedule, start, conduct, review, complete, cancel, report, followUp | created, updated, scheduled, started, conducted, reviewed, completed, cancelled, reported, followedUp |
| **Issue** | create, update, investigate, escalate, assign, resolve, close, reopen, workaround | created, updated, investigated, escalated, assigned, resolved, closed, reopened, workaroundApplied |

---

### Projects

Project management entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Project** | `name`, `type` (product, internal, client, research, infrastructure), `status`, `phase`, `priority`, `methodology` (agile, scrum, kanban, waterfall), `objectives`, `scope`, `startDate`, `endDate`, `progress`, `health`, `budget`, `spent`, `sponsor`, `owner`, `manager`, `teamSize` |
| **Task** | `name`, `type` (task, bug, feature, improvement, research), `status`, `priority`, `resolution`, `estimate`, `timeSpent`, `storyPoints`, `complexity`, `startDate`, `dueDate`, `assignee`, `labels`, `acceptanceCriteria`, `progress` |
| **Milestone** | `name`, `type` (phase-gate, release, delivery, review, approval, launch), `status`, `targetDate`, `actualDate`, `progress`, `deliverables`, `criteria`, `owner`, `approver`, `approved` |
| **Sprint** | `name`, `number`, `goal`, `status`, `startDate`, `endDate`, `duration`, `capacity`, `commitment`, `completed`, `velocity`, `completionRate`, `carryOver`, `totalTasks`, `completedTasks` |
| **Deliverable** | `name`, `type` (document, software, report, design, prototype, training), `status`, `format`, `version`, `dueDate`, `deliveredDate`, `owner`, `acceptanceCriteria`, `accepted`, `progress` |
| **Epic** | `name`, `status`, `priority`, `theme`, `businessValue`, `successMetrics`, `acceptanceCriteria`, `startDate`, `targetDate`, `estimate`, `completed`, `progress`, `owner` |
| **Story** | `name`, `userStory`, `status`, `priority`, `storyPoints`, `businessValue`, `acceptanceCriteria`, `persona`, `assignee`, `labels`, `components`, `progress` |
| **Resource** | `name`, `type` (person, equipment, material, facility, budget), `status`, `role`, `skills`, `capacity`, `allocated`, `available`, `utilizationTarget`, `utilizationActual`, `costRate`, `billableRate` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Project** | create, update, plan, approve, start, pause, resume, complete, cancel, archive, replan, review | created, updated, planned, approved, started, paused, resumed, completed, cancelled, archived, replanned, reviewed |
| **Task** | create, update, assign, start, pause, resume, complete, cancel, reopen, block, unblock, estimate, review | created, updated, assigned, started, paused, resumed, completed, cancelled, reopened, blocked, unblocked, estimated, reviewed |
| **Milestone** | create, update, start, complete, delay, approve, cancel, review | created, updated, started, completed, delayed, approved, cancelled, reviewed |
| **Sprint** | create, update, plan, start, complete, cancel, review, retrospect | created, updated, planned, started, completed, cancelled, reviewed, retrospected |
| **Deliverable** | create, update, start, submit, review, approve, reject, revise, deliver, accept | created, updated, started, submitted, reviewed, approved, rejected, revised, delivered, accepted |
| **Epic** | create, update, refine, start, complete, cancel, split, prioritize | created, updated, refined, started, completed, cancelled, split, prioritized |
| **Story** | create, update, refine, estimate, assign, start, complete, reject, split | created, updated, refined, estimated, assigned, started, completed, rejected, split |
| **Resource** | create, update, allocate, deallocate, reassign, book, release | created, updated, allocated, deallocated, reassigned, booked, released |

---

### Communication

Communication and collaboration entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Meeting** | `name`, `type` (one-on-one, team, all-hands, standup, planning, review, retrospective, interview, client), `status`, `recurring`, `recurrencePattern`, `startTime`, `endTime`, `duration`, `location`, `virtualLink`, `platform`, `organizer`, `attendees`, `agenda`, `notes` |
| **Decision** | `name`, `type` (strategic, tactical, operational, technical, policy, resource), `status`, `outcome`, `rationale`, `alternatives`, `impact`, `risks`, `benefits`, `decisionMaker`, `proposedDate`, `decidedDate`, `reviewDate`, `reversible` |
| **ActionItem** | `name`, `status`, `priority`, `source`, `assignee`, `assignedBy`, `dueDate`, `completedDate`, `context`, `outcome`, `blockers`, `progress` |
| **Announcement** | `title`, `content`, `type` (general, product, company, HR, policy, event, milestone, emergency), `status`, `priority`, `audience`, `channels`, `author`, `publishDate`, `acknowledgmentRequired`, `acknowledgmentCount`, `viewCount` |
| **Feedback** | `title`, `content`, `type` (feature-request, bug-report, complaint, praise, suggestion, review, NPS), `source`, `status`, `sentiment`, `rating`, `npsScore`, `category`, `priority`, `submitter`, `assignee`, `response` |
| **Discussion** | `title`, `content`, `type` (question, proposal, brainstorm, announcement, decision, RFC), `status`, `category`, `author`, `participants`, `replyCount`, `viewCount`, `pinned`, `locked`, `resolved`, `visibility` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Meeting** | create, update, schedule, reschedule, cancel, start, end, summarize, record | created, updated, scheduled, rescheduled, cancelled, started, ended, summarized, recorded |
| **Decision** | create, update, propose, review, approve, reject, defer, implement, supersede, archive | created, updated, proposed, reviewed, approved, rejected, deferred, implemented, superseded, archived |
| **ActionItem** | create, update, assign, reassign, start, complete, cancel, defer, escalate | created, updated, assigned, reassigned, started, completed, cancelled, deferred, escalated |
| **Announcement** | create, update, draft, schedule, publish, recall, archive, acknowledge, feature | created, updated, drafted, scheduled, published, recalled, archived, acknowledged, featured |
| **Feedback** | create, update, acknowledge, assign, respond, resolve, decline, archive, merge, upvote | created, updated, acknowledged, assigned, responded, resolved, declined, archived, merged, upvoted |
| **Discussion** | create, update, reply, resolve, close, reopen, pin, unpin, lock, unlock, archive | created, updated, replied, resolved, closed, reopened, pinned, unpinned, locked, unlocked, archived |

---

### Assets

Asset and inventory management entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Asset** | `name`, `type` (hardware, software, furniture, vehicle, equipment, real-estate, digital, IP), `category`, `status`, `assetTag`, `serialNumber`, `manufacturer`, `model`, `condition`, `location`, `assignedTo`, `purchaseDate`, `purchasePrice`, `currentValue`, `depreciationMethod`, `warrantyExpiry` |
| **Inventory** | `name`, `sku`, `barcode`, `type` (raw-material, work-in-progress, finished-goods, supplies, spare-parts), `category`, `status`, `unitOfMeasure`, `quantityOnHand`, `quantityReserved`, `quantityAvailable`, `reorderPoint`, `reorderQuantity`, `unitCost`, `totalValue`, `location`, `warehouse` |
| **Equipment** | `name`, `type` (computer, server, network, printer, phone, machinery, vehicle, tool), `status`, `assetTag`, `serialNumber`, `manufacturer`, `model`, `specifications`, `condition`, `location`, `assignedTo`, `serviceContract`, `lastServiceDate`, `nextServiceDate` |
| **Facility** | `name`, `type` (office, warehouse, factory, datacenter, retail, lab, headquarters), `status`, `code`, `address`, `city`, `country`, `squareFootage`, `floors`, `capacity`, `currentOccupancy`, `ownership` (owned, leased, subleased, coworking), `monthlyRent`, `operatingCost`, `manager` |
| **Software** | `name`, `type` (SaaS, on-premise, desktop, mobile, embedded, open-source), `category`, `status`, `vendor`, `version`, `edition`, `licenseType`, `licensedUsers`, `activeUsers`, `deploymentType`, `ssoEnabled`, `dataClassification`, `businessCriticality`, `annualCost` |
| **DataAsset** | `name`, `type` (database, data-lake, file, API, report, model, dataset, stream), `category`, `status`, `classification` (public, internal, confidential, restricted, PII, PHI), `format`, `schema`, `size`, `recordCount`, `source`, `refreshFrequency`, `owner`, `steward`, `qualityScore` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Asset** | create, update, assign, unassign, transfer, maintain, repair, retire, dispose, audit, reserve, check-in, check-out | created, updated, assigned, unassigned, transferred, maintained, repaired, retired, disposed, audited, reserved, checkedIn, checkedOut |
| **Inventory** | create, update, receive, ship, transfer, adjust, count, reserve, unreserve, reorder, discontinue | created, updated, received, shipped, transferred, adjusted, counted, reserved, unreserved, reordered, discontinued |
| **Equipment** | create, update, assign, unassign, service, repair, calibrate, retire, dispose, reserve, return | created, updated, assigned, unassigned, serviced, repaired, calibrated, retired, disposed, reserved, returned |
| **Facility** | create, update, open, close, renovate, expand, consolidate, audit, inspect | created, updated, opened, closed, renovated, expanded, consolidated, audited, inspected |
| **Software** | create, update, deploy, upgrade, downgrade, renew, deprecate, retire, review, integrate | created, updated, deployed, upgraded, downgraded, renewed, deprecated, retired, reviewed, integrated |
| **DataAsset** | create, update, refresh, archive, delete, share, restrict, classify, audit, document | created, updated, refreshed, archived, deleted, shared, restricted, classified, audited, documented |

---

### Market

Market intelligence entities.

#### Properties

| Entity | Key Properties |
|--------|----------------|
| **Market** | `name`, `type` (geographic, demographic, psychographic, behavioral, industry, vertical), `status`, `region`, `countries`, `size` (TAM), `serviceable` (SAM), `obtainable` (SOM), `growthRate`, `maturity`, `competitiveness`, `marketShare`, `targetShare`, `penetration`, `avgDealSize`, `salesCycle`, `priority` |
| **Competitor** | `name`, `type` (direct, indirect, substitute, potential, emerging), `status`, `website`, `founded`, `headquarters`, `employeeCount`, `revenue`, `marketShare`, `positioning`, `targetSegments`, `products`, `pricing`, `strengths`, `weaknesses`, `differentiators`, `threatLevel`, `winRate`, `lossRate` |
| **Trend** | `name`, `type` (technology, market, consumer, regulatory, economic, social, environmental), `status`, `category`, `timeframe`, `strength`, `confidence`, `impact`, `impactAreas`, `drivers`, `signals`, `implications`, `opportunities`, `threats`, `relevance`, `actionRequired` |
| **Opportunity** | `name`, `type` (market-expansion, product, acquisition, partnership, technology, cost-reduction), `status`, `source`, `potentialValue`, `probability`, `expectedValue`, `investmentRequired`, `roi`, `risks`, `benefits`, `requirements`, `owner`, `windowStart`, `windowEnd`, `priority`, `strategicFit` |
| **SWOT** | `name`, `type` (company, product, market, competitor, project), `status`, `subject`, `strengths`, `weaknesses`, `opportunities`, `threats`, `overallAssessment`, `recommendations`, `actionItems`, `author`, `analysisDate`, `validUntil` |
| **Industry** | `name`, `code`, `classification` (NAICS, SIC, GICS), `status`, `size`, `growthRate`, `employmentSize`, `majorPlayers`, `concentration`, `barriers`, `regulations`, `technologyDrivers`, `disruptions`, `trends`, `relevance` |

#### Actions & Events

| Entity | Actions | Events |
|--------|---------|--------|
| **Market** | create, update, analyze, enter, expand, exit, prioritize, segment, review | created, updated, analyzed, entered, expanded, exited, prioritized, segmented, reviewed |
| **Competitor** | create, update, analyze, monitor, compare, benchmark, track, alert, archive | created, updated, analyzed, monitored, compared, benchmarked, tracked, alerted, archived |
| **Trend** | create, update, identify, analyze, monitor, respond, archive, validate, escalate | created, updated, identified, analyzed, monitored, responded, archived, validated, escalated |
| **Opportunity** | create, update, identify, evaluate, approve, decline, pursue, capture, abandon, review | created, updated, identified, evaluated, approved, declined, pursued, captured, abandoned, reviewed |
| **SWOT** | create, update, conduct, review, approve, archive, share, revisit | created, updated, conducted, reviewed, approved, archived, shared, revisited |
| **Industry** | create, update, analyze, monitor, enter, exit, benchmark, report | created, updated, analyzed, monitored, entered, exited, benchmarked, reported |

---

## Usage

```typescript
import {
  // Entity definitions (Noun pattern)
  Business, Vision, Value,                    // business
  Organization, Department, Team,              // organization
  Goal, OKR, KeyResult, KPI, Metric,          // goals
  Product, Service, Feature, PricingPlan,      // offerings
  Process, Workflow, Policy,                   // operations
  Budget, Revenue, Expense, Investment,        // financials
  Customer, Account, Contact, Segment,         // customers
  Deal, Pipeline, Contract, Subscription,      // sales
  Campaign, Lead, Audience, Content, Funnel,   // marketing
  Partner, Vendor, Affiliate, Partnership,     // partnerships
  Agreement, License, Compliance,              // legal
  Risk, Mitigation, Incident, Control,         // risk
  Project, Task, Milestone, Sprint, Epic,      // projects
  Meeting, Decision, ActionItem, Feedback,     // communication
  Asset, Inventory, Equipment, Facility,       // assets
  Market, Competitor, Trend, Opportunity,      // market

  // All entities by category
  AllBusinessEntities,
  BusinessEntityCategories,

  // Flat entity access
  Entities,
} from 'business-as-code'

// Access entity definitions
console.log(Business.properties)  // Property definitions
console.log(Business.actions)     // Available actions
console.log(Business.events)      // Possible events

// All 16 entity categories
console.log(AllBusinessEntities.business)       // Business, Vision, Value
console.log(AllBusinessEntities.organization)   // Organization, Department, Team, Position, Role, Worker
console.log(AllBusinessEntities.goals)          // Goal, OKR, KeyResult, KPI, Metric, Initiative
console.log(AllBusinessEntities.offerings)      // Product, Service, Feature, PricingPlan, RoadmapItem
console.log(AllBusinessEntities.operations)     // Process, ProcessStep, Workflow, WorkflowAction, WorkflowRun, Policy
console.log(AllBusinessEntities.financials)     // Budget, Revenue, Expense, Investment, FinancialPeriod, Forecast
console.log(AllBusinessEntities.customers)      // Customer, Account, Contact, Segment, Persona, Interaction
console.log(AllBusinessEntities.sales)          // Deal, Pipeline, Stage, Contract, Subscription, Quote, Order, Invoice
console.log(AllBusinessEntities.marketing)      // Campaign, Lead, Audience, Content, Funnel, FunnelStage, MarketingEvent
console.log(AllBusinessEntities.partnerships)   // Partner, Vendor, Affiliate, Partnership, Integration, Reseller
console.log(AllBusinessEntities.legal)          // Agreement, License, IntellectualProperty, Compliance, LegalPolicy, Trademark
console.log(AllBusinessEntities.risk)           // Risk, Mitigation, Incident, Control, Assessment, Issue
console.log(AllBusinessEntities.projects)       // Project, Task, Milestone, Sprint, Deliverable, Epic, Story, Resource
console.log(AllBusinessEntities.communication)  // Meeting, Decision, ActionItem, Announcement, Feedback, Discussion
console.log(AllBusinessEntities.assets)         // Asset, Inventory, Equipment, Facility, Software, DataAsset
console.log(AllBusinessEntities.market)         // Market, Competitor, Trend, Opportunity, SWOT, Industry
```

---

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

### AI Agent Integration
Entity definitions power AI agents with structured business context.

## License

MIT
