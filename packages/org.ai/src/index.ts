/**
 * org.ai - Core types for AI-powered organizations
 *
 * This package provides shared type definitions for the AI primitives ecosystem.
 * For runtime functionality, use the individual packages directly or the
 * `ai-primitives` umbrella package.
 *
 * @example Types import
 * ```ts
 * import type { Thing, Agent, Role, Team, Goal, KPI, OKR } from 'org.ai'
 * ```
 *
 * @example Identity utilities
 * ```ts
 * import { createUser, createAgentIdentity, createSession } from 'org.ai/identity'
 * ```
 *
 * @example For runtime functionality, use ai-primitives
 * ```ts
 * import { ai, generate, list, DB, Workflow } from 'ai-primitives'
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// BASE TYPES - From @org.ai/types
// ============================================================================
// Re-export all types from @org.ai/types for concise imports.
//
// Includes:
// - Thing, ThingDO - Base entity types with URL-based identity
// - Things, ThingsDO, Collection - Collection types
// - Noun, Verb, StandardVerbs - Schema types
// - Event, EventWhat, EventWho, EventWhen, EventWhere, EventWhy, EventHow - 5W+H events
// - Worker, Agent, Human - Worker types with schemas and type guards
// - Tool, Toolbox - Tool types
// - LeanCanvas, StoryBrand, Founder - Business model framework types
// - Startup, ICP - Startup and customer profile types
// - ListOptions, ListResult, PaginationInfo - Pagination types

export * from '@org.ai/types'

// ============================================================================
// ORGANIZATIONAL TYPES - Role, Team, Goal, KPI, OKR
// ============================================================================
// Consolidated types for organizational structures and metrics.

export * from './types/index.js'

// ============================================================================
// UTILITY FUNCTIONS - Progress calculations, etc.
// ============================================================================
// Shared utilities for common operations across packages.

export * from './utils/index.js'
