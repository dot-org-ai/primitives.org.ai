/**
 * org.ai - The primary consumer-facing types package for AI-powered organizations
 *
 * This package consolidates foundation types from `@org.ai/types` with organizational
 * types (Role, Team, Goal, KPI, OKR) into a single, unified package.
 *
 * **Consumers should import from `org.ai`, not `@org.ai/types` directly.**
 *
 * ## Package Structure
 *
 * ```
 * org.ai (this package - consumer-facing)
 * ├── Re-exports all of @org.ai/types (foundation types)
 * │   ├── Thing, ThingDO - Base entity types
 * │   ├── Worker, Agent, Human - Worker types
 * │   ├── Tool, Toolbox - Tool types
 * │   ├── Event (5W+H) - Event types
 * │   ├── Noun, Verb - Schema types
 * │   ├── LeanCanvas, StoryBrand, Founder - Business framework types
 * │   └── Startup, ICP - Customer profile types
 * │
 * └── Adds organizational types (defined here)
 *     ├── Role - Job roles and responsibilities
 *     ├── Team - Team structures and members
 *     ├── Goal - Goal tracking
 *     ├── KPI - Key Performance Indicators
 *     └── OKR - Objectives and Key Results
 * ```
 *
 * ## Why org.ai Instead of @org.ai/types?
 *
 * 1. **Single Import Source**: Import all types from one package
 * 2. **Complete Type Set**: Foundation types + organizational types in one place
 * 3. **Simplified Dependencies**: Only add `org.ai` to your package.json
 * 4. **Future-Proof**: New organizational types will be added to `org.ai`
 *
 * @example Importing types
 * ```typescript
 * import type {
 *   // Foundation types (from @org.ai/types)
 *   Thing, Worker, Agent, Human, Tool, Event, Noun, Verb,
 *   Startup, ICP, LeanCanvas, StoryBrand,
 *
 *   // Organizational types (from org.ai)
 *   Role, Team, Goal, KPI, OKR,
 * } from 'org.ai'
 * ```
 *
 * @example Using type guards
 * ```typescript
 * import { isAgent, isRole, isTeam } from 'org.ai'
 *
 * if (isAgent(worker)) {
 *   console.log(worker.model, worker.autonomous)
 * }
 * ```
 *
 * @example Creating entities with factory functions
 * ```typescript
 * import { createAgent, createHuman, createRole, createTeam } from 'org.ai'
 *
 * const agent = createAgent({
 *   model: 'claude-3-opus',
 *   autonomous: true,
 *   name: 'ResearchAgent',
 * })
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// FOUNDATION TYPES - Re-exported from @org.ai/types
// ============================================================================
/**
 * Re-exports all types from @org.ai/types for unified consumer access.
 *
 * @org.ai/types is the foundation package that provides:
 * - Thing, ThingDO - Base entity types with URL-based identity
 * - Things, ThingsDO, Collection - Collection types
 * - Noun, Verb, StandardVerbs - Schema types
 * - Event, EventWhat, EventWho, EventWhen, EventWhere, EventWhy, EventHow - 5W+H events
 * - Worker, Agent, Human - Worker types with schemas and type guards
 * - Tool, Toolbox - Tool types
 * - LeanCanvas, StoryBrand, Founder - Business model framework types
 * - Startup, ICP - Startup and customer profile types
 * - ListOptions, ListResult, PaginationInfo - Pagination types
 * - AIFunctionType, EventHandlerType, WorkflowContextType - Function types
 *
 * Consumers should NOT import from @org.ai/types directly.
 * Instead, import from org.ai which includes these plus organizational types.
 */
export * from '@org.ai/types'

// ============================================================================
// ORGANIZATIONAL TYPES - Role, Team, Goal, KPI, OKR
// ============================================================================
/**
 * Organizational types defined in this package.
 *
 * These types extend the foundation with organization-specific concepts:
 * - Role - Job roles and responsibilities
 * - Team - Team structures with members and channels
 * - Goal - Goal tracking with status and priority
 * - KPI - Key Performance Indicators with trends
 * - OKR - Objectives and Key Results
 *
 * These types are unique to org.ai and not available in @org.ai/types.
 */
export * from './types/index.js'

// ============================================================================
// UTILITY FUNCTIONS - Progress calculations, etc.
// ============================================================================
/**
 * Shared utility functions for common operations across packages.
 */
export * from './utils/index.js'
