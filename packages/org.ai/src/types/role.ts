/**
 * Consolidated Role type for org.ai
 *
 * Combines the best features from:
 * - autonomous-agents Role (id, name, description, skills, permissions, tools, outputs)
 * - business-as-code BusinessRole (type, department, responsibilities, canHandle, canDelegate, canApprove)
 */

/**
 * BusinessRoleType - Standard business role types
 * Named to avoid conflict with RoleType interface from @org.ai/types
 */
export type BusinessRoleType =
  // Executive
  | 'ceo'
  | 'cto'
  | 'cfo'
  | 'coo'
  | 'cmo'
  | 'cpo'
  // Management
  | 'director'
  | 'manager'
  | 'lead'
  | 'supervisor'
  // Individual Contributors
  | 'engineer'
  | 'designer'
  | 'analyst'
  | 'specialist'
  | 'coordinator'
  // Operations
  | 'operator'
  | 'agent'
  | 'assistant'

/**
 * Worker type preference for role assignment
 */
export type RoleWorkerType = 'ai' | 'human' | 'hybrid'

/**
 * Role interface - consolidated role definition
 *
 * Combines identity, capabilities, business context, task capabilities,
 * hierarchy, and worker preferences.
 */
export interface Role {
  // Core identity
  /** Unique role identifier */
  id: string
  /** Human-readable role name */
  name: string
  /** Role description */
  description: string

  // Capabilities (from autonomous-agents)
  /** Skills required for this role */
  skills: string[]
  /** Permissions granted to this role */
  permissions?: string[]
  /** Tools available to this role */
  tools?: string[]
  /** Expected outputs from this role */
  outputs?: string[]

  // Business context (from business-as-code)
  /** Role type classification */
  type?: BusinessRoleType | string
  /** Department this role belongs to */
  department?: string
  /** List of responsibilities */
  responsibilities?: string[]

  // Task capabilities
  /** Types of tasks this role can handle */
  canHandle?: string[]
  /** Types of tasks this role can delegate */
  canDelegate?: string[]
  /** Types of requests this role can approve */
  canApprove?: string[]

  // Hierarchy
  /** Role ID to escalate issues to */
  escalateTo?: string
  /** Role ID this role reports to */
  reportsTo?: string
  /** Hierarchical level (higher = more senior) */
  level?: number

  // Worker preference
  /** Preferred worker type for this role */
  workerType?: RoleWorkerType

  // Extensibility
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Type guard for Role
 */
export function isRole(value: unknown): value is Role {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v['id'] === 'string' &&
    typeof v['name'] === 'string' &&
    typeof v['description'] === 'string' &&
    Array.isArray(v['skills'])
  )
}

/**
 * Input type for createRole factory function
 */
export interface CreateRoleInput {
  id: string
  name: string
  description: string
  skills: string[]
  permissions?: string[]
  tools?: string[]
  outputs?: string[]
  type?: BusinessRoleType | string
  department?: string
  responsibilities?: string[]
  canHandle?: string[]
  canDelegate?: string[]
  canApprove?: string[]
  escalateTo?: string
  reportsTo?: string
  level?: number
  workerType?: RoleWorkerType
  metadata?: Record<string, unknown>
}

/**
 * Factory function to create a Role
 */
export function createRole(opts: CreateRoleInput): Role {
  const role: Role = {
    id: opts.id,
    name: opts.name,
    description: opts.description,
    skills: opts.skills,
  }

  if (opts.permissions !== undefined) role.permissions = opts.permissions
  if (opts.tools !== undefined) role.tools = opts.tools
  if (opts.outputs !== undefined) role.outputs = opts.outputs
  if (opts.type !== undefined) role.type = opts.type
  if (opts.department !== undefined) role.department = opts.department
  if (opts.responsibilities !== undefined) role.responsibilities = opts.responsibilities
  if (opts.canHandle !== undefined) role.canHandle = opts.canHandle
  if (opts.canDelegate !== undefined) role.canDelegate = opts.canDelegate
  if (opts.canApprove !== undefined) role.canApprove = opts.canApprove
  if (opts.escalateTo !== undefined) role.escalateTo = opts.escalateTo
  if (opts.reportsTo !== undefined) role.reportsTo = opts.reportsTo
  if (opts.level !== undefined) role.level = opts.level
  if (opts.workerType !== undefined) role.workerType = opts.workerType
  if (opts.metadata !== undefined) role.metadata = opts.metadata

  return role
}
