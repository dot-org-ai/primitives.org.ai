/**
 * @org.ai/types
 *
 * Comprehensive type definitions for the primitives.org.ai ecosystem.
 * Business-as-Code: Every aspect of a business represented in TypeScript.
 *
 * This package provides TypeScript types for:
 * - Core primitives (Thing, Noun, Verb, Event, Action, Domain)
 * - RPC abstractions (Actions, Events, Input/Output distinction)
 * - Organizational types (Database, Function, Goal, Plan, Project, Task, Workflow, Experiment)
 * - Application types (App, API, CLI, Dashboard, SDK)
 * - Business types (Business, Agent, Human)
 * - Product types (Product, Marketplace, Roadmap, Feature, Epic, Story, Bug, Backlog)
 * - Service types (Service, SaaS)
 * - Site types (Site, Blog, Directory)
 * - Tool types (CRM, Payments)
 * - Finance & Accounting (Account, Transaction, Invoice, Budget, Payroll, Asset)
 * - HR & People (Employee, Candidate, Department, Performance, Benefits, Compensation)
 * - Sales & Revenue (Lead, Opportunity, Pipeline, Quote, Contract, Commission)
 * - Operations & Logistics (Inventory, Warehouse, Shipment, PurchaseOrder, Fulfillment)
 * - Legal & Compliance (Contract, Agreement, Compliance, Audit, Risk, IP)
 * - Marketing & Growth (Campaign, Audience, Email, Content, Attribution, Journey)
 * - Customer Success & Support (Ticket, SLA, KnowledgeBase, HealthScore, NPS)
 * - Identity & Auth (User, Session, Role, Permission, Policy, MFA)
 * - Communication & Collaboration (Message, Channel, Calendar, Meeting, Document)
 * - Data & Analytics (Metric, Dashboard, Report, Experiment, Funnel, Cohort)
 * - Equity & Fundraising (Investor, Shareholder, Share, ShareClass, CapTable, FundingRound, StartupMetrics)
 * - Engineering & DevOps (Sprint, Release, Environment, FeatureFlag, Deployment, Incident)
 * - Governance & Corporate (Board, BoardMember, Advisor, Founder, Level, Role)
 *
 * @example
 * ```ts
 * // Import core types directly
 * import type { Thing, Action, EventHandler, Input, Output } from 'primitives.org.ai'
 *
 * // Import domain-specific types from submodules
 * import type { Employee } from 'primitives.org.ai/hr'
 * import type { Transaction, Account } from 'primitives.org.ai/finance'
 * import type { Ticket } from 'primitives.org.ai/support'
 * import type { Contact, Company } from 'primitives.org.ai/tool/crm'
 *
 * // Or import entire domain namespaces
 * import * as Finance from 'primitives.org.ai/finance'
 * import * as HR from 'primitives.org.ai/hr'
 * ```
 *
 * @packageDocumentation
 */
// =============================================================================
// Core Types - Always exported directly
// =============================================================================
export * from '@/core/index';
// =============================================================================
// Organizational Types
// =============================================================================
export * from '@/org/index';
// =============================================================================
// Application Types
// =============================================================================
export * from '@/app/index';
// =============================================================================
// Business Types
// =============================================================================
export * from '@/business/index';
// =============================================================================
// Product Types
// =============================================================================
export * from '@/product/index';
// =============================================================================
// Site Types
// =============================================================================
export * from '@/site/index';
// =============================================================================
// Tool Types (CRM, Payments)
// =============================================================================
export * from '@/tool/index';
// =============================================================================
// Version
// =============================================================================
/**
 * Package version
 */
export const VERSION = '0.1.0';
// =============================================================================
// Type Utilities
// =============================================================================
/**
 * Helper to create a typed resource proxy.
 *
 * @example
 * ```ts
 * const contacts = createResource<ContactResource>({
 *   create: async (input) => { ... },
 *   get: async ({ id }) => { ... },
 *   // ...
 * })
 * ```
 */
export function createResource(implementation) {
    return implementation;
}
/**
 * Helper to define an action handler.
 *
 * @example
 * ```ts
 * const createContact = defineAction<ContactInput, Contact>(async (input) => {
 *   // implementation
 *   return contact
 * })
 * ```
 */
export function defineAction(handler) {
    return handler;
}
/**
 * Helper to define an event handler with proper typing.
 *
 * @example
 * ```ts
 * const handleContactCreated = defineEventHandler<ContactCreatedEvent, CRMProxy>(
 *   async (event, ctx) => {
 *     console.log('Contact created:', event.data.email)
 *   }
 * )
 * ```
 */
export function defineEventHandler(handler) {
    return handler;
}
