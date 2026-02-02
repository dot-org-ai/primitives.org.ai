/**
 * Consolidated types for org.ai
 *
 * This module exports consolidated type definitions that combine
 * the best features from multiple packages in the AI primitives ecosystem.
 */

// Role types
export type { Role, BusinessRoleType, RoleWorkerType } from './role.js'
export { isRole, createRole } from './role.js'

// Team types
export type {
  Team,
  TeamMember,
  TeamLead,
  Channel,
  MemberType,
  MemberStatus,
  MemberAvailability,
} from './team.js'
export { isTeam, createTeam } from './team.js'

// Goal types
export type { Goal, Goals, GoalStatus, GoalCategory, GoalPriority } from './goal.js'
export { isGoal } from './goal.js'

// KPI types
export type {
  KPI,
  KPIDefinition,
  KPICategory,
  KPITrend,
  KPIFrequency,
  KPIHistoryEntry,
} from './kpi.js'
export { isKPI } from './kpi.js'

// OKR types
export type { OKR, KeyResult, OKRStatus, KeyResultStatus } from './okr.js'
export { isOKR } from './okr.js'
