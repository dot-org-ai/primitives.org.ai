/**
 * Role - Define an agent or worker role
 *
 * Roles define the responsibilities, skills, permissions, and capabilities
 * for agents or human workers within a digital workforce.
 *
 * @packageDocumentation
 */

import type { Role as RoleType, AIFunctionDefinition } from './types.js'

/**
 * Create a role definition
 *
 * @example
 * ```ts
 * import { Role } from 'autonomous-agents'
 *
 * const productManager = Role({
 *   name: 'Product Manager',
 *   description: 'Responsible for product strategy, roadmap, and feature prioritization',
 *   skills: [
 *     'product strategy',
 *     'user research',
 *     'roadmap planning',
 *     'stakeholder management',
 *     'data analysis',
 *   ],
 *   permissions: ['create:feature', 'update:roadmap', 'approve:requirements'],
 *   outputs: ['product briefs', 'roadmaps', 'user stories', 'requirements'],
 * })
 *
 * const engineer = Role({
 *   name: 'Software Engineer',
 *   description: 'Designs, develops, and maintains software systems',
 *   skills: [
 *     'software design',
 *     'coding',
 *     'testing',
 *     'debugging',
 *     'code review',
 *   ],
 *   permissions: ['read:code', 'write:code', 'deploy:staging'],
 *   tools: [
 *     { name: 'runTests', description: 'Run test suite', parameters: {}, handler: async () => {} },
 *     { name: 'deploy', description: 'Deploy to environment', parameters: {}, handler: async () => {} },
 *   ],
 * })
 * ```
 */
export function Role(config: {
  name: string
  description: string
  skills: string[]
  permissions?: string[]
  tools?: AIFunctionDefinition[]
  outputs?: string[]
}): RoleType {
  // Generate a unique ID based on the role name
  const id = config.name.toLowerCase().replace(/\s+/g, '-')

  return {
    id,
    name: config.name,
    description: config.description,
    skills: config.skills,
    ...(config.permissions !== undefined && { permissions: config.permissions }),
    ...(config.tools !== undefined && { tools: config.tools }),
    ...(config.outputs !== undefined && { outputs: config.outputs }),
  }
}

/**
 * Predefined common roles
 */
export const Roles = {
  /**
   * Product Manager role
   */
  ProductManager: Role({
    name: 'Product Manager',
    description:
      'Owns product vision, strategy, and roadmap. Prioritizes features based on user needs and business goals.',
    skills: [
      'product strategy',
      'user research',
      'roadmap planning',
      'feature prioritization',
      'stakeholder management',
      'data analysis',
      'market research',
    ],
    permissions: ['create:feature', 'update:roadmap', 'approve:requirements', 'view:analytics'],
    outputs: [
      'product briefs',
      'roadmaps',
      'user stories',
      'requirements documents',
      'prioritization frameworks',
    ],
  }),

  /**
   * Software Engineer role
   */
  SoftwareEngineer: Role({
    name: 'Software Engineer',
    description:
      'Designs, develops, tests, and maintains software systems following best practices.',
    skills: [
      'software design',
      'programming',
      'testing',
      'debugging',
      'code review',
      'system architecture',
      'version control',
    ],
    permissions: ['read:code', 'write:code', 'review:pr', 'deploy:staging'],
    outputs: ['code', 'tests', 'documentation', 'technical designs', 'pull requests'],
  }),

  /**
   * Designer role
   */
  Designer: Role({
    name: 'Designer',
    description:
      'Creates user interfaces, experiences, and visual designs that are intuitive and engaging.',
    skills: [
      'UI design',
      'UX design',
      'visual design',
      'prototyping',
      'user research',
      'accessibility',
      'design systems',
    ],
    permissions: ['create:design', 'update:design-system', 'approve:mockups'],
    outputs: ['mockups', 'prototypes', 'design systems', 'style guides', 'user flows'],
  }),

  /**
   * Data Analyst role
   */
  DataAnalyst: Role({
    name: 'Data Analyst',
    description: 'Analyzes data to uncover insights, trends, and actionable recommendations.',
    skills: [
      'data analysis',
      'statistics',
      'SQL',
      'data visualization',
      'A/B testing',
      'reporting',
    ],
    permissions: ['read:analytics', 'query:database', 'create:report'],
    outputs: ['reports', 'dashboards', 'insights', 'recommendations', 'metrics'],
  }),

  /**
   * Content Writer role
   */
  ContentWriter: Role({
    name: 'Content Writer',
    description: 'Creates compelling written content for various channels and audiences.',
    skills: ['writing', 'editing', 'SEO', 'content strategy', 'storytelling', 'brand voice'],
    permissions: ['create:content', 'publish:blog', 'update:docs'],
    outputs: ['blog posts', 'documentation', 'marketing copy', 'social media content', 'emails'],
  }),

  /**
   * Customer Support role
   */
  CustomerSupport: Role({
    name: 'Customer Support',
    description:
      'Provides help and assistance to customers, resolving issues and answering questions.',
    skills: [
      'customer service',
      'problem solving',
      'communication',
      'empathy',
      'product knowledge',
      'troubleshooting',
    ],
    permissions: ['read:tickets', 'update:ticket', 'access:customer-data'],
    outputs: ['ticket responses', 'knowledge base articles', 'customer feedback', 'issue reports'],
  }),

  /**
   * Project Manager role
   */
  ProjectManager: Role({
    name: 'Project Manager',
    description: 'Plans, executes, and delivers projects on time and within budget.',
    skills: [
      'project planning',
      'task management',
      'risk management',
      'stakeholder communication',
      'resource allocation',
      'agile methodologies',
    ],
    permissions: ['create:project', 'assign:task', 'update:timeline', 'view:resources'],
    outputs: ['project plans', 'status reports', 'timelines', 'risk assessments', 'retrospectives'],
  }),

  /**
   * QA Engineer role
   */
  QAEngineer: Role({
    name: 'QA Engineer',
    description:
      'Ensures software quality through testing, automation, and quality assurance processes.',
    skills: [
      'manual testing',
      'test automation',
      'bug reporting',
      'test planning',
      'quality assurance',
      'regression testing',
    ],
    permissions: ['run:tests', 'create:bug-report', 'approve:release'],
    outputs: ['test plans', 'test cases', 'bug reports', 'automation scripts', 'quality reports'],
  }),

  /**
   * Marketing Manager role
   */
  MarketingManager: Role({
    name: 'Marketing Manager',
    description: 'Develops and executes marketing strategies to drive growth and brand awareness.',
    skills: [
      'marketing strategy',
      'campaign management',
      'digital marketing',
      'analytics',
      'brand management',
      'content marketing',
    ],
    permissions: ['create:campaign', 'approve:content', 'view:analytics', 'manage:budget'],
    outputs: [
      'marketing plans',
      'campaigns',
      'content calendars',
      'performance reports',
      'brand guidelines',
    ],
  }),

  /**
   * DevOps Engineer role
   */
  DevOpsEngineer: Role({
    name: 'DevOps Engineer',
    description: 'Manages infrastructure, deployment pipelines, and ensures system reliability.',
    skills: [
      'infrastructure management',
      'CI/CD',
      'monitoring',
      'automation',
      'cloud platforms',
      'security',
    ],
    permissions: [
      'deploy:production',
      'manage:infrastructure',
      'access:logs',
      'configure:monitoring',
    ],
    outputs: [
      'deployment scripts',
      'infrastructure code',
      'monitoring dashboards',
      'incident reports',
      'runbooks',
    ],
  }),
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: RoleType, permission: string): boolean {
  return role.permissions?.includes(permission) || false
}

/**
 * Check if a role has a specific skill
 */
export function hasSkill(role: RoleType, skill: string): boolean {
  return role.skills.some(
    (s) => s.toLowerCase() === skill.toLowerCase() || s.toLowerCase().includes(skill.toLowerCase())
  )
}

/**
 * Get all permissions for a role
 */
export function getPermissions(role: RoleType): string[] {
  return role.permissions || []
}

/**
 * Get all skills for a role
 */
export function getSkills(role: RoleType): string[] {
  return role.skills
}

/**
 * Merge multiple roles into a compound role
 */
export function mergeRoles(name: string, ...roles: RoleType[]): RoleType {
  const allSkills = new Set<string>()
  const allPermissions = new Set<string>()
  const allTools: AIFunctionDefinition[] = []
  const allOutputs = new Set<string>()
  const descriptions: string[] = []

  roles.forEach((role) => {
    role.skills.forEach((skill) => allSkills.add(skill))
    role.permissions?.forEach((permission) => allPermissions.add(permission))
    role.tools?.forEach((tool) => allTools.push(tool))
    role.outputs?.forEach((output) => allOutputs.add(output))
    descriptions.push(role.description)
  })

  return Role({
    name,
    description: descriptions.join(' '),
    skills: Array.from(allSkills),
    permissions: Array.from(allPermissions),
    tools: allTools,
    outputs: Array.from(allOutputs),
  })
}
