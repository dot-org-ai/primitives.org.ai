/**
 * Consolidated Team type for org.ai
 *
 * Combines the best features from:
 * - digital-workers Team (id, name, description, members as WorkerRef[], contacts, lead, goals, metadata)
 * - autonomous-agents Team (goals as Goal[], context, channels)
 * - human-in-the-loop Team (members as string[], lead)
 */

import type { Goal } from './goal.js'

/**
 * Member type - human or AI agent
 */
export type MemberType = 'human' | 'agent'

/**
 * Member status
 */
export type MemberStatus = 'active' | 'inactive' | 'pending'

/**
 * Member availability
 */
export type MemberAvailability = 'available' | 'busy' | 'away' | 'offline'

/**
 * TeamMember interface - a member of a team
 */
export interface TeamMember {
  /** Member identifier */
  id: string
  /** Member name */
  name: string
  /** Role in the team */
  role?: string
  /** Member type (human or agent) */
  type: MemberType
  /** Current status */
  status?: MemberStatus
  /** Current availability */
  availability?: MemberAvailability
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Team lead reference
 */
export interface TeamLead {
  /** Lead identifier */
  id: string
  /** Lead name */
  name: string
  /** Lead type */
  type: MemberType
}

/**
 * Communication channel
 */
export interface Channel {
  /** Channel identifier */
  id: string
  /** Channel type (slack, email, teams, etc.) */
  type: string
  /** Channel configuration */
  config?: Record<string, unknown>
}

/**
 * Team interface - consolidated team definition
 *
 * Combines identity, membership, leadership, goals, communication,
 * and shared context.
 */
export interface Team {
  // Core identity
  /** Unique team identifier */
  id: string
  /** Team name */
  name: string
  /** Team description */
  description?: string

  // Members (typed)
  /** List of team members */
  members: TeamMember[]

  // Leadership
  /** Team lead */
  lead?: TeamLead

  // Goals (from autonomous-agents)
  /** Team goals */
  goals?: Goal[]

  // Communication (from autonomous-agents/digital-workers)
  /** Communication channels */
  channels?: Channel[]
  /** Contact information */
  contacts?: Record<string, string>

  // Shared context
  /** Shared team context */
  context?: Record<string, unknown>

  // Extensibility
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Type guard for Team
 */
export function isTeam(value: unknown): value is Team {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return typeof v['id'] === 'string' && typeof v['name'] === 'string' && Array.isArray(v['members'])
}

/**
 * Input type for createTeam factory function
 */
export interface CreateTeamInput {
  id: string
  name: string
  description?: string
  members: TeamMember[]
  lead?: TeamLead
  goals?: Goal[]
  channels?: Channel[]
  contacts?: Record<string, string>
  context?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

/**
 * Factory function to create a Team
 */
export function createTeam(opts: CreateTeamInput): Team {
  const team: Team = {
    id: opts.id,
    name: opts.name,
    members: opts.members,
  }

  if (opts.description !== undefined) team.description = opts.description
  if (opts.lead !== undefined) team.lead = opts.lead
  if (opts.goals !== undefined) team.goals = opts.goals
  if (opts.channels !== undefined) team.channels = opts.channels
  if (opts.contacts !== undefined) team.contacts = opts.contacts
  if (opts.context !== undefined) team.context = opts.context
  if (opts.metadata !== undefined) team.metadata = opts.metadata

  return team
}
