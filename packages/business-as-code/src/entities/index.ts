/**
 * Business Entity Types (Nouns)
 *
 * Comprehensive entity definitions for business-as-code primitives.
 * Each entity follows the Noun pattern with Properties, Actions, and Events.
 *
 * Categories:
 * - business: Core business entities (Business, Vision, Value)
 * - organization: Org structure (Organization, Department, Team, Position, Role, Worker)
 * - goals: Goal tracking (Goal, OKR, KeyResult, KPI, Metric, Initiative)
 * - offerings: Products & services (Product, Service, Feature, PricingPlan, RoadmapItem)
 * - operations: Processes & workflows (Process, ProcessStep, Workflow, WorkflowAction, WorkflowRun, Policy)
 * - financials: Financial entities (Budget, Revenue, Expense, Investment, FinancialPeriod, Forecast)
 *
 * @packageDocumentation
 */

// =============================================================================
// Business (Core business entities)
// =============================================================================

export {
  Business,
  Vision,
  Value,
  BusinessEntities,
  BusinessCategories,
} from './business.js'

// =============================================================================
// Organization (Org structure)
// =============================================================================

export {
  Organization,
  Department,
  Team,
  Position,
  Role,
  Worker,
  OrganizationEntities,
  OrganizationCategories,
} from './organization.js'

// =============================================================================
// Goals (Goal tracking)
// =============================================================================

export {
  Goal,
  OKR,
  KeyResult,
  KPI,
  Metric,
  Initiative,
  GoalEntities,
  GoalCategories,
} from './goals.js'

// =============================================================================
// Offerings (Products & Services)
// =============================================================================

export {
  Product,
  Service,
  Feature,
  PricingPlan,
  RoadmapItem,
  OfferingEntities,
  OfferingCategories,
} from './offerings.js'

// =============================================================================
// Operations (Processes & Workflows)
// =============================================================================

export {
  Process,
  ProcessStep,
  Workflow,
  WorkflowAction,
  WorkflowRun,
  Policy,
  OperationsEntities,
  OperationsCategories,
} from './operations.js'

// =============================================================================
// Financials (Financial entities)
// =============================================================================

export {
  Budget,
  Revenue,
  Expense,
  Investment,
  FinancialPeriod,
  Forecast,
  FinancialEntities,
  FinancialCategories,
} from './financials.js'

// =============================================================================
// All Entities Collection
// =============================================================================

import { BusinessEntities } from './business.js'
import { OrganizationEntities } from './organization.js'
import { GoalEntities } from './goals.js'
import { OfferingEntities } from './offerings.js'
import { OperationsEntities } from './operations.js'
import { FinancialEntities } from './financials.js'

/**
 * All business entities organized by category
 */
export const AllBusinessEntities = {
  business: BusinessEntities,
  organization: OrganizationEntities,
  goals: GoalEntities,
  offerings: OfferingEntities,
  operations: OperationsEntities,
  financials: FinancialEntities,
} as const

/**
 * All entity category names
 */
export const BusinessEntityCategories = [
  'business',
  'organization',
  'goals',
  'offerings',
  'operations',
  'financials',
] as const

export type BusinessEntityCategory = (typeof BusinessEntityCategories)[number]

/**
 * Flat list of all entities for quick access
 */
export const Entities = {
  // Business
  ...BusinessEntities,
  // Organization
  ...OrganizationEntities,
  // Goals
  ...GoalEntities,
  // Offerings
  ...OfferingEntities,
  // Operations
  ...OperationsEntities,
  // Financials
  ...FinancialEntities,
} as const
