/**
 * Team definition for digital workers
 */

import type { WorkerTeam } from './types.js'

// Note: Team type is re-exported from types.ts which imports from org.ai

/**
 * Define a team of workers
 *
 * Teams organize workers (AI agents and humans) into cohesive units
 * with shared goals and responsibilities.
 *
 * @param definition - Team definition
 * @returns The defined team
 *
 * @example
 * ```ts
 * const engineeringTeam = defineTeam({
 *   id: 'team_eng',
 *   name: 'Engineering',
 *   description: 'Product engineering team',
 *   members: [
 *     { id: 'alice', name: 'Alice', role: 'Senior Engineer', type: 'human' },
 *     { id: 'bob', name: 'Bob', role: 'Engineer', type: 'human' },
 *     { id: 'ai-reviewer', name: 'Code Reviewer', role: 'Code Reviewer', type: 'ai' },
 *     { id: 'ai-tester', name: 'Test Generator', role: 'Test Engineer', type: 'ai' },
 *   ],
 *   contacts: { slack: '#engineering', email: 'eng@company.com' },
 *   goals: [
 *     'Ship features on schedule',
 *     'Maintain code quality',
 *     'Reduce technical debt',
 *   ],
 *   lead: { id: 'alice', type: 'human', name: 'Alice' },
 * })
 * ```
 *
 * @example
 * ```ts
 * const supportTeam = defineTeam({
 *   id: 'team_support',
 *   name: 'Customer Support',
 *   description: '24/7 customer support team',
 *   members: [
 *     { id: 'support-ai-1', name: 'Support Bot Alpha', role: 'Support Agent', type: 'ai' },
 *     { id: 'support-ai-2', name: 'Support Bot Beta', role: 'Support Agent', type: 'ai' },
 *     { id: 'escalation-human', name: 'Jane', role: 'Senior Support', type: 'human' },
 *   ],
 *   contacts: { slack: '#support' },
 *   goals: [
 *     'Maintain 95% satisfaction rate',
 *     'Response time under 5 minutes',
 *     'First contact resolution > 80%',
 *   ],
 *   lead: { id: 'escalation-human', type: 'human', name: 'Jane' },
 * })
 * ```
 */
export function defineTeam(definition: WorkerTeam): WorkerTeam {
  return definition
}

/**
 * Add a member to a team
 *
 * @param team - The team to add to
 * @param member - The member to add
 * @returns Updated team
 *
 * @example
 * ```ts
 * const updatedTeam = defineTeam.addMember(engineeringTeam, {
 *   id: 'charlie',
 *   name: 'Charlie',
 *   role: 'Junior Engineer',
 *   type: 'human',
 * })
 * ```
 */
defineTeam.addMember = (team: WorkerTeam, member: WorkerTeam['members'][number]): WorkerTeam => ({
  ...team,
  members: [...team.members, member],
})

/**
 * Remove a member from a team
 *
 * @param team - The team to remove from
 * @param memberId - ID of the member to remove
 * @returns Updated team
 *
 * @example
 * ```ts
 * const updatedTeam = defineTeam.removeMember(engineeringTeam, 'bob')
 * ```
 */
defineTeam.removeMember = (team: WorkerTeam, memberId: string): WorkerTeam => ({
  ...team,
  members: team.members.filter((m) => m.id !== memberId),
})

/**
 * Get all AI members of a team
 *
 * @param team - The team
 * @returns Array of AI members
 *
 * @example
 * ```ts
 * const aiMembers = defineTeam.aiMembers(supportTeam)
 * console.log(aiMembers) // [Support Bot Alpha, Support Bot Beta]
 * ```
 */
defineTeam.aiMembers = (team: WorkerTeam) => team.members.filter((m) => m.type === 'agent')

/**
 * Get all human members of a team
 *
 * @param team - The team
 * @returns Array of human members
 *
 * @example
 * ```ts
 * const humans = defineTeam.humanMembers(engineeringTeam)
 * console.log(humans) // [Alice, Bob]
 * ```
 */
defineTeam.humanMembers = (team: WorkerTeam) => team.members.filter((m) => m.type === 'human')

/**
 * Get members by role
 *
 * @param team - The team
 * @param role - Role to filter by
 * @returns Array of members with that role
 *
 * @example
 * ```ts
 * const engineers = defineTeam.byRole(engineeringTeam, 'Engineer')
 * ```
 */
defineTeam.byRole = (team: WorkerTeam, role: string) => team.members.filter((m) => m.role === role)

// Legacy alias for backward compatibility
export { defineTeam as Team }
