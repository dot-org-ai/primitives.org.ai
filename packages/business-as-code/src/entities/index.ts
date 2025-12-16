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
 * - customers: Customer management (Customer, Account, Contact, Segment, Persona, Interaction)
 * - sales: Sales & revenue (Deal, Pipeline, Stage, Contract, Subscription, Quote, Order, Invoice)
 * - marketing: Marketing & demand gen (Campaign, Lead, Audience, Content, Funnel, FunnelStage, MarketingEvent)
 * - partnerships: Partners & vendors (Partner, Vendor, Affiliate, Partnership, Integration, Reseller)
 * - legal: Legal & compliance (Agreement, License, IntellectualProperty, Compliance, LegalPolicy, Trademark)
 * - risk: Risk management (Risk, Mitigation, Incident, Control, Assessment, Issue)
 * - projects: Project management (Project, Task, Milestone, Sprint, Deliverable, Epic, Story, Resource)
 * - communication: Communication (Meeting, Decision, ActionItem, Announcement, Feedback, Discussion)
 * - assets: Assets & inventory (Asset, Inventory, Equipment, Facility, Software, DataAsset)
 * - market: Market intelligence (Market, Competitor, Trend, Opportunity, SWOT, Industry)
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
// Customers (Customer management)
// =============================================================================

export {
  Customer,
  Account,
  Contact,
  Segment,
  Persona,
  Interaction,
  CustomerEntities,
} from './customers.js'

// =============================================================================
// Sales (Sales & revenue)
// =============================================================================

export {
  Deal,
  Pipeline,
  Stage,
  Contract,
  Subscription,
  Quote,
  Order,
  Invoice,
  SalesEntities,
} from './sales.js'

// =============================================================================
// Marketing (Marketing & demand gen)
// =============================================================================

export {
  Campaign,
  Lead,
  Audience,
  Content,
  Funnel,
  FunnelStage,
  MarketingEvent,
  MarketingEntities,
} from './marketing.js'

// =============================================================================
// Partnerships (Partners & vendors)
// =============================================================================

export {
  Partner,
  Vendor,
  Affiliate,
  Partnership,
  Integration,
  Reseller,
  PartnershipEntities,
} from './partnerships.js'

// =============================================================================
// Legal (Legal & compliance)
// =============================================================================

export {
  Agreement,
  License,
  IntellectualProperty,
  Compliance,
  LegalPolicy,
  Trademark,
  LegalEntities,
} from './legal.js'

// =============================================================================
// Risk (Risk management)
// =============================================================================

export {
  Risk,
  Mitigation,
  Incident,
  Control,
  Assessment,
  Issue,
  RiskEntities,
} from './risk.js'

// =============================================================================
// Projects (Project management)
// =============================================================================

export {
  Project,
  Task,
  Milestone,
  Sprint,
  Deliverable,
  Epic,
  Story,
  Resource,
  ProjectEntities,
} from './projects.js'

// =============================================================================
// Planning (Work items, plans - beads-compatible)
// =============================================================================

export {
  WorkItem,
  WorkItemComment,
  WorkItemEvent,
  Comment as PlanningComment,
  Event as PlanningEvent,
  Plan,
  DependencyTypes,
  type DependencyType,
  PlanningEntities,
} from './planning.js'

// =============================================================================
// Communication (Communication & collaboration)
// =============================================================================

export {
  Meeting,
  Decision,
  ActionItem,
  Announcement,
  Feedback,
  Discussion,
  CommunicationEntities,
} from './communication.js'

// =============================================================================
// Assets (Assets & inventory)
// =============================================================================

export {
  Asset,
  Inventory,
  Equipment,
  Facility,
  Software,
  DataAsset,
  AssetEntities,
} from './assets.js'

// =============================================================================
// Market (Market intelligence)
// =============================================================================

export {
  Market,
  Competitor,
  Trend,
  Opportunity,
  SWOT,
  Industry,
  MarketEntities,
} from './market.js'

// =============================================================================
// All Entities Collection
// =============================================================================

import { BusinessEntities } from './business.js'
import { OrganizationEntities } from './organization.js'
import { GoalEntities } from './goals.js'
import { OfferingEntities } from './offerings.js'
import { OperationsEntities } from './operations.js'
import { FinancialEntities } from './financials.js'
import { CustomerEntities } from './customers.js'
import { SalesEntities } from './sales.js'
import { MarketingEntities } from './marketing.js'
import { PartnershipEntities } from './partnerships.js'
import { LegalEntities } from './legal.js'
import { RiskEntities } from './risk.js'
import { ProjectEntities } from './projects.js'
import { PlanningEntities } from './planning.js'
import { CommunicationEntities } from './communication.js'
import { AssetEntities } from './assets.js'
import { MarketEntities } from './market.js'

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
  customers: CustomerEntities,
  sales: SalesEntities,
  marketing: MarketingEntities,
  partnerships: PartnershipEntities,
  legal: LegalEntities,
  risk: RiskEntities,
  projects: ProjectEntities,
  planning: PlanningEntities,
  communication: CommunicationEntities,
  assets: AssetEntities,
  market: MarketEntities,
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
  'customers',
  'sales',
  'marketing',
  'partnerships',
  'legal',
  'risk',
  'projects',
  'planning',
  'communication',
  'assets',
  'market',
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
  // Customers
  ...CustomerEntities,
  // Sales
  ...SalesEntities,
  // Marketing
  ...MarketingEntities,
  // Partnerships
  ...PartnershipEntities,
  // Legal
  ...LegalEntities,
  // Risk
  ...RiskEntities,
  // Projects
  ...ProjectEntities,
  // Planning (beads-compatible work items)
  ...PlanningEntities,
  // Communication
  ...CommunicationEntities,
  // Assets
  ...AssetEntities,
  // Market
  ...MarketEntities,
} as const
