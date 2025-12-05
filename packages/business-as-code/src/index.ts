/**
 * business-as-code - Primitives for expressing business logic and processes as code
 *
 * This package provides primitives for defining business entities, goals, products,
 * services, processes, workflows, KPIs, OKRs, and financial metrics.
 *
 * @example
 * ```ts
 * import { Business, Product, Goals, kpis, okrs, financials, $ } from 'business-as-code'
 *
 * // Define your business
 * const company = Business({
 *   name: 'Acme Corp',
 *   mission: 'To make widgets accessible to everyone',
 *   values: ['Innovation', 'Customer Focus', 'Integrity'],
 * })
 *
 * // Define products
 * const product = Product({
 *   name: 'Widget Pro',
 *   pricingModel: 'subscription',
 *   price: 99,
 *   cogs: 20,
 * })
 *
 * // Define goals
 * const goals = Goals([
 *   {
 *     name: 'Launch MVP',
 *     category: 'strategic',
 *     status: 'in-progress',
 *     progress: 65,
 *   },
 * ])
 *
 * // Track KPIs
 * const kpiList = kpis([
 *   {
 *     name: 'Monthly Recurring Revenue',
 *     category: 'financial',
 *     target: 100000,
 *     current: 85000,
 *   },
 * ])
 *
 * // Define OKRs
 * const okrList = okrs([
 *   {
 *     objective: 'Achieve Product-Market Fit',
 *     keyResults: [
 *       {
 *         description: 'Increase NPS',
 *         metric: 'NPS',
 *         targetValue: 60,
 *         currentValue: 52,
 *       },
 *     ],
 *   },
 * ])
 *
 * // Calculate financials
 * const metrics = financials({
 *   revenue: 1000000,
 *   cogs: 300000,
 *   operatingExpenses: 500000,
 * })
 *
 * // Use $ helper for calculations
 * console.log($.format(1234.56)) // "$1,234.56"
 * console.log($.growth(120, 100)) // 20
 * console.log($.margin(100, 60)) // 40
 * ```
 *
 * @packageDocumentation
 */

// Export all types
export type {
  Currency,
  TimePeriod,
  BusinessDefinition,
  OrganizationalStructure,
  Department,
  Team,
  VisionDefinition,
  GoalDefinition,
  ProductDefinition,
  ServiceDefinition,
  RoadmapItem,
  ServiceLevelAgreement,
  ProcessDefinition,
  ProcessStep,
  ProcessMetric,
  WorkflowDefinition,
  WorkflowAction,
  WorkflowTrigger,
  KPIDefinition,
  OKRDefinition,
  KeyResult,
  FinancialMetrics,
  FinancialStatement,
  BusinessContext,
  BusinessOperations,
} from './types.js'

// Export business entity functions
export {
  Business,
  getTotalBudget,
  getTotalTeamSize,
  getDepartment,
  getTeam,
  validateBusiness,
} from './business.js'

// Export vision functions
export {
  Vision,
  checkIndicator,
  calculateProgress,
  validateVision,
} from './vision.js'

// Export goal functions
export {
  Goals,
  Goal,
  updateProgress,
  markAtRisk,
  complete,
  isOverdue,
  getGoalsByCategory,
  getGoalsByStatus,
  getGoalsByOwner,
  calculateOverallProgress,
  hasCircularDependencies,
  sortByDependencies,
  validateGoals,
} from './goals.js'

// Export product functions
export {
  Product,
  calculateGrossMargin,
  calculateGrossProfit,
  getRoadmapByStatus,
  getRoadmapByPriority,
  getOverdueRoadmapItems,
  updateRoadmapItem,
  addFeature,
  removeFeature,
  validateProduct,
} from './product.js'

// Export service functions
export {
  Service,
  calculateHourlyPrice,
  calculateMonthlyRetainer,
  checkSLAUptime,
  parseDeliveryTimeToDays,
  estimateCompletionDate,
  calculateValueBasedPrice,
  validateService,
} from './service.js'

// Export process functions
export {
  Process,
  getStepsInOrder,
  getStepsByAutomationLevel,
  calculateTotalDuration,
  formatDuration,
  calculateAutomationPercentage,
  getMetric,
  meetsTarget,
  calculateMetricAchievement,
  updateMetric,
  addStep,
  removeStep,
  validateProcess,
} from './process.js'

// Export workflow functions
export {
  Workflow,
  getActionsInOrder,
  getActionsByType,
  getConditionalActions,
  addAction,
  removeAction,
  updateAction,
  isEventTrigger,
  isScheduleTrigger,
  isWebhookTrigger,
  parseWaitDuration,
  evaluateCondition,
  fillTemplate,
  validateWorkflow,
} from './workflow.js'

// Export KPI functions
export {
  kpis,
  kpi,
  calculateAchievement,
  meetsTarget as kpiMeetsTarget,
  updateCurrent,
  updateTarget,
  getKPIsByCategory,
  getKPIsByFrequency,
  getKPIsOnTarget,
  getKPIsOffTarget,
  calculateHealthScore,
  groupByCategory,
  calculateVariance,
  calculateVariancePercentage,
  formatValue,
  comparePerformance,
  validateKPIs,
} from './kpis.js'

// Export OKR functions
export {
  okrs,
  okr,
  calculateKeyResultProgress,
  calculateOKRProgress,
  calculateConfidence,
  updateKeyResult,
  isKeyResultOnTrack,
  isOKROnTrack,
  getKeyResultsOnTrack,
  getKeyResultsAtRisk,
  getOKRsByOwner,
  getOKRsByPeriod,
  getOKRsByStatus,
  calculateSuccessRate,
  formatKeyResult,
  compareOKRPerformance,
  validateOKRs,
} from './okrs.js'

// Export financial functions
export {
  financials,
  calculateGrossMargin as calculateFinancialGrossMargin,
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
  getLineItem,
  compareMetrics,
  validateFinancials,
} from './financials.js'

// Export $ helper and context management
export {
  $,
  createBusinessOperations,
  updateContext,
  getContext,
  resetContext,
} from './dollar.js'

// Export SaaS metrics
export type {
  // Time types
  DateRange,
  MetricPeriod,
  DataPoint,
  TimeSeries,

  // Revenue metrics
  MRR,
  ARR,
  NRR,
  GRR,
  ARPU,
  RevenueSegment,

  // Customer metrics
  CAC,
  LTV,
  LTVtoCAC,
  Churn,
  RetentionCohort,

  // Growth metrics
  GrowthRate,
  QuickRatio,

  // Efficiency metrics
  MagicNumber,
  BurnMultiple,
  RuleOf40,
  EfficiencyScore,

  // Pipeline & Sales
  Pipeline,
  PipelineStage,
  SalesVelocity,

  // Operational
  NPS,
  CustomerHealth,
  HealthFactor,

  // Comprehensive
  SaaSMetrics,
} from './metrics.js'

export {
  // SaaS Metric Calculation functions (produce structured SaaS metric objects)
  calculateMRR as calculateMRRMetric,
  calculateARRFromMRR as calculateARRMetric,
  calculateNRR as calculateNRRMetric,
  calculateGRR as calculateGRRMetric,
  calculateCACMetric,
  calculateLTVMetric,
  calculateLTVtoCACRatio,
  calculateQuickRatioMetric,
  calculateMagicNumberMetric,
  calculateBurnMultipleMetric,
  calculateRuleOf40Metric,
  calculateGrowthRates,
  calculateChurnMetrics,

  // Time-series aggregation
  aggregateTimeSeries,
  createMetricPeriod,
} from './metrics.js'

// Export live queries & views (ai-database / ClickHouse integration)
export type {
  // Core types
  Granularity,
  AggregateFunction,
  Operator,
  SortDirection,

  // OLAP primitives
  Dimension,
  Measure,
  CalculatedMeasure,

  // Query building
  Filter,
  Sort,
  TimeRange,
  Query,
  ResolvedQuery,

  // Views & Dashboards
  View,
  Dashboard,
  DashboardLayout,
  DashboardItem,
  Visualization,

  // Execution
  QueryRow,
  QueryResult,
  QueryExecutor,
  StreamingQueryResult,
  StreamingQueryExecutor,
} from './queries.js'

export {
  // Standard definitions
  StandardDimensions,
  StandardMeasures,
  CalculatedMetrics,

  // Builders
  query,
  QueryBuilder,
  view,
  ViewBuilder,
  dashboard,
  DashboardBuilder,

  // Pre-built queries
  MrrOverview,
  ArrBySegment,
  CohortRetention,
  UnitEconomics,
  RevenueByChannel,
  GrowthMetrics,

  // Pre-built dashboards
  ExecutiveDashboard,
} from './queries.js'

// Export roles (bridges digital-workers and ai-database authorization)
export type {
  BusinessRoleType,
  BusinessRole,
  TaskStatus,
  TaskPriority,
  TaskAssignment,
  AssigneeRef,
  TaskRoutingRule,
  WorkflowRole,
} from './roles.js'

export {
  StandardBusinessRoles,
  createBusinessRole,
  hasPermission,
  canHandleTask,
  canApproveRequest,
  canDelegateTask,
  findRoleForTask,
  createTaskAssignment,
  transitionTaskStatus,
} from './roles.js'

// Export organization (full hierarchy to FGA/RBAC)
export type {
  Organization,
  OrganizationSettings,
  Address,
  Department as OrgDepartment,
  Team as OrgTeam,
  TeamResources,
  TeamChannels,
  Position,
  PositionRef,
  Compensation,
  Budget,
  ResourceHierarchy,
  ResourceHierarchyNode,
  ApprovalChain,
  ApprovalLevel,
  ApproverSpec,
  EscalationRule,
  ResolvedPermissions,
} from './organization.js'

export {
  resolvePermissions,
  getApprovalChainForRequest,
  findManager,
} from './organization.js'
