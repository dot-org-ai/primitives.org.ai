/**
 * org.ai/types - Shared type definitions
 *
 * Re-exports all types from @org.ai/types for convenient access.
 * This allows importing from either:
 * - `import { Thing, Worker } from 'org.ai'`
 * - `import { Thing, Worker } from 'org.ai/types'`
 * - `import { Thing, Worker } from '@org.ai/types'`
 *
 * @packageDocumentation
 */

export * from '@org.ai/types'

// Also export consolidated types (Role, Team, Goal, KPI, OKR)
// Note: WorkerType is renamed to avoid conflict with @org.ai/types WorkerType
export type {
  // Role types
  Role,
  RoleType,
  WorkerType as RoleWorkerType,
  // Team types
  Team,
  TeamMember,
  TeamLead,
  Channel,
  MemberType,
  MemberStatus,
  MemberAvailability,
  // Goal types
  Goal,
  Goals,
  GoalStatus,
  GoalCategory,
  GoalPriority,
  // KPI types
  KPI,
  KPIDefinition,
  KPICategory,
  KPITrend,
  KPIFrequency,
  KPIHistoryEntry,
  // OKR types
  OKR,
  KeyResult,
  OKRStatus,
  KeyResultStatus,
} from './types/index.js'

export { isRole, createRole, isTeam, createTeam, isGoal, isKPI, isOKR } from './types/index.js'
