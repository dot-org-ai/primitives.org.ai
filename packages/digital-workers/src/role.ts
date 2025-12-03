/**
 * Role definition for digital workers
 */

import type { WorkerRole } from './types.js'

/**
 * Define a worker role
 *
 * Roles define responsibilities, skills, and permissions for workers
 * (both AI agents and humans) within an organization.
 *
 * @param definition - Role definition
 * @returns The defined role
 *
 * @example
 * ```ts
 * const engineer = Role({
 *   name: 'Software Engineer',
 *   description: 'Builds and maintains software systems',
 *   responsibilities: [
 *     'Write clean, maintainable code',
 *     'Review pull requests',
 *     'Fix bugs and issues',
 *     'Participate in architecture decisions',
 *   ],
 *   skills: ['TypeScript', 'React', 'Node.js'],
 *   type: 'hybrid', // Can be filled by AI or human
 * })
 * ```
 *
 * @example
 * ```ts
 * const supportAgent = Role({
 *   name: 'Customer Support Agent',
 *   description: 'Assists customers with inquiries and issues',
 *   responsibilities: [
 *     'Respond to customer inquiries',
 *     'Troubleshoot issues',
 *     'Escalate complex problems',
 *     'Maintain customer satisfaction',
 *   ],
 *   type: 'ai', // AI-first role
 * })
 * ```
 */
export function Role(definition: Omit<WorkerRole, 'type'> & { type?: WorkerRole['type'] }): WorkerRole {
  return {
    type: 'hybrid', // Default to hybrid (can be AI or human)
    ...definition,
  }
}

/**
 * Create an AI-specific role
 *
 * @example
 * ```ts
 * const dataAnalyst = Role.ai({
 *   name: 'Data Analyst',
 *   description: 'Analyzes data and generates insights',
 *   responsibilities: [
 *     'Process large datasets',
 *     'Generate reports',
 *     'Identify trends and patterns',
 *   ],
 * })
 * ```
 */
Role.ai = (definition: Omit<WorkerRole, 'type'>): WorkerRole => ({
  ...definition,
  type: 'ai',
})

/**
 * Create a human-specific role
 *
 * @example
 * ```ts
 * const manager = Role.human({
 *   name: 'Engineering Manager',
 *   description: 'Leads engineering team and makes strategic decisions',
 *   responsibilities: [
 *     'Team leadership and mentoring',
 *     'Strategic planning',
 *     'Performance reviews',
 *     'Budget management',
 *   ],
 * })
 * ```
 */
Role.human = (definition: Omit<WorkerRole, 'type'>): WorkerRole => ({
  ...definition,
  type: 'human',
})

/**
 * Create a hybrid role (can be AI or human)
 *
 * @example
 * ```ts
 * const contentWriter = Role.hybrid({
 *   name: 'Content Writer',
 *   description: 'Creates written content for various channels',
 *   responsibilities: [
 *     'Write blog posts and articles',
 *     'Create marketing copy',
 *     'Edit and proofread content',
 *   ],
 * })
 * ```
 */
Role.hybrid = (definition: Omit<WorkerRole, 'type'>): WorkerRole => ({
  ...definition,
  type: 'hybrid',
})
