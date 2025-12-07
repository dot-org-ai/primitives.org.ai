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

## Usage

```typescript
import {
  // Entity definitions (Noun pattern)
  BusinessEntity,
  OrganizationEntity,
  GoalEntity,
  OKREntity,
  KPIEntity,
  ProductEntity,
  ServiceEntity,
  ProcessEntity,
  WorkflowEntity,
  BudgetEntity,

  // All entities by category
  AllBusinessEntities,
  BusinessEntityCategories,

  // Flat entity access
  Entities,
} from 'business-as-code'

// Access entity definitions
console.log(BusinessEntity.properties)  // Property definitions
console.log(BusinessEntity.actions)     // Available actions
console.log(BusinessEntity.events)      // Possible events

// All entities
console.log(AllBusinessEntities.business)      // Business, Vision, Value
console.log(AllBusinessEntities.organization)  // Organization, Department, Team, Position, Role, Worker
console.log(AllBusinessEntities.goals)         // Goal, OKR, KeyResult, KPI, Metric, Initiative
console.log(AllBusinessEntities.offerings)     // Product, Service, Feature, PricingPlan, RoadmapItem
console.log(AllBusinessEntities.operations)    // Process, ProcessStep, Workflow, WorkflowAction, WorkflowRun, Policy
console.log(AllBusinessEntities.financials)    // Budget, Revenue, Expense, Investment, FinancialPeriod, Forecast
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
