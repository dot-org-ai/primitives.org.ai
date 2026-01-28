/**
 * Role definition for digital workers
 */

import type { WorkerRole } from './types.js'

// Note: Role type is re-exported from types.ts which imports from org.ai

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
 * const engineer = defineRole({
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
 * const supportAgent = defineRole({
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
export function defineRole(
  definition: Omit<WorkerRole, 'type'> & { type?: WorkerRole['type'] }
): WorkerRole {
  return {
    ...definition,
    type: definition.type ?? 'hybrid',
  } as WorkerRole
}

/**
 * Create an AI-specific role
 *
 * @example
 * ```ts
 * const dataAnalyst = defineRole.ai({
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
defineRole.ai = (definition: Omit<WorkerRole, 'type'>): WorkerRole =>
  ({
    ...definition,
    type: 'ai',
  } as WorkerRole)

/**
 * Create a human-specific role
 *
 * @example
 * ```ts
 * const manager = defineRole.human({
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
defineRole.human = (definition: Omit<WorkerRole, 'type'>): WorkerRole =>
  ({
    ...definition,
    type: 'human',
  } as WorkerRole)

/**
 * Create a hybrid role (can be AI or human)
 *
 * @example
 * ```ts
 * const contentWriter = defineRole.hybrid({
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
defineRole.hybrid = (definition: Omit<WorkerRole, 'type'>): WorkerRole =>
  ({
    ...definition,
    type: 'hybrid',
  } as WorkerRole)

// Legacy alias for backward compatibility
export { defineRole as Role }
