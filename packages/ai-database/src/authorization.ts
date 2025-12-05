/**
 * Authorization Primitives (FGA/RBAC)
 *
 * Based on WorkOS FGA design - Fine-Grained Authorization that:
 * - Extends RBAC with resource-scoped, hierarchical permissions
 * - Uses Subjects, Resources, Roles, Permissions, Assignments
 * - Supports automatic inheritance through resource hierarchy
 * - Integrates with Noun/Verb for action authorization
 *
 * @see https://workos.com/docs/fga
 * @packageDocumentation
 */

import type { Noun, Verb } from './schema.js'

// =============================================================================
// Core FGA Primitives
// =============================================================================

/**
 * Subject - who is requesting access
 *
 * Can be a user, group, service account, AI agent, or any entity
 * that can be granted permissions.
 */
export interface Subject {
  /** Subject type (user, group, service, agent) */
  type: string

  /** Unique identifier within the type */
  id: string

  /** Optional display name */
  name?: string

  /** Subject metadata */
  metadata?: Record<string, unknown>
}

/**
 * Subject types
 */
export type SubjectType =
  | 'user'       // Human user
  | 'group'      // Group of users
  | 'team'       // Team (organizational unit)
  | 'service'    // Service account
  | 'agent'      // AI agent
  | 'role'       // Role (for role inheritance)
  | string       // Custom subject types

/**
 * Resource - what is being accessed
 *
 * Any entity in the system that can have permissions.
 * Resources form a hierarchy (up to 5 levels).
 */
export interface Resource {
  /** Resource type (maps to Noun) */
  type: string

  /** Unique identifier */
  id: string

  /** Parent resource (for hierarchy) */
  parent?: ResourceRef

  /** Resource metadata */
  metadata?: Record<string, unknown>
}

/**
 * Resource reference (lightweight)
 */
export interface ResourceRef {
  type: string
  id: string
}

/**
 * Resource type definition
 */
export interface ResourceType {
  /** Type name (should match a Noun) */
  name: string

  /** Human-readable description */
  description?: string

  /** Parent type in hierarchy (null = root) */
  parentType?: string

  /** Actions available on this resource type */
  actions?: string[]

  /** Whether this is a high-cardinality type (kept local, not synced) */
  local?: boolean
}

// =============================================================================
// Role & Permission
// =============================================================================

/**
 * Permission - what action can be performed on what resource type
 */
export interface Permission {
  /** Permission name (e.g., 'read', 'write', 'admin') */
  name: string

  /** Description */
  description?: string

  /** Resource type this permission applies to */
  resourceType: string

  /** Actions granted (maps to Verb actions) */
  actions: string[]

  /** Whether this permission extends to child resource types */
  inheritable?: boolean
}

/**
 * Role - a named collection of permissions
 *
 * Roles are scoped to resource types. A "Workspace Admin" role
 * only makes sense on Workspace resources.
 */
export interface Role {
  /** Role identifier */
  id: string

  /** Display name */
  name: string

  /** Description */
  description?: string

  /** Resource type this role is scoped to */
  resourceType: string

  /** Permissions included in this role */
  permissions: Permission[]

  /** Parent roles (for role inheritance) */
  inherits?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Standard role levels (can be customized)
 */
export type RoleLevel =
  | 'owner'      // Full control, can delete
  | 'admin'      // Full control, cannot delete
  | 'editor'     // Can modify
  | 'viewer'     // Read-only
  | 'guest'      // Limited read
  | string       // Custom levels

// =============================================================================
// Assignment (Warrant)
// =============================================================================

/**
 * Assignment - binds a subject to a role on a resource
 *
 * This is the core authorization tuple: (subject, role, resource)
 * Also called a "warrant" in some FGA systems.
 */
export interface Assignment {
  /** Unique assignment ID */
  id: string

  /** Who is granted access */
  subject: Subject

  /** What role is granted */
  role: string

  /** On what resource */
  resource: ResourceRef

  /** When the assignment was created */
  createdAt: Date

  /** Who created the assignment */
  createdBy?: Subject

  /** Optional expiration */
  expiresAt?: Date

  /** Assignment metadata */
  metadata?: Record<string, unknown>
}

/**
 * Assignment input (for creating assignments)
 */
export interface AssignmentInput {
  subject: Subject | string  // Can use "user:123" format
  role: string
  resource: ResourceRef | string  // Can use "workspace:456" format
  expiresAt?: Date
  metadata?: Record<string, unknown>
}

// =============================================================================
// Authorization Check
// =============================================================================

/**
 * Authorization check request
 */
export interface AuthzCheckRequest {
  /** Who is requesting */
  subject: Subject | string

  /** What action */
  action: string

  /** On what resource */
  resource: ResourceRef | string

  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Authorization check result
 */
export interface AuthzCheckResult {
  /** Whether access is allowed */
  allowed: boolean

  /** Why (for debugging/audit) */
  reason?: string

  /** Which assignment granted access (if allowed) */
  assignment?: Assignment

  /** Check latency in ms */
  latencyMs?: number
}

/**
 * Batch authorization check
 */
export interface AuthzBatchCheckRequest {
  checks: AuthzCheckRequest[]
}

export interface AuthzBatchCheckResult {
  results: AuthzCheckResult[]
  latencyMs: number
}

// =============================================================================
// Resource Hierarchy
// =============================================================================

/**
 * Resource hierarchy definition
 *
 * Defines the parent-child relationships between resource types.
 * Permissions can flow down through the hierarchy.
 *
 * @example
 * ```ts
 * const hierarchy: ResourceHierarchy = {
 *   levels: [
 *     { type: 'organization', depth: 0 },
 *     { type: 'workspace', depth: 1, parentType: 'organization' },
 *     { type: 'project', depth: 2, parentType: 'workspace' },
 *     { type: 'document', depth: 3, parentType: 'project' },
 *   ],
 *   maxDepth: 5,
 * }
 * ```
 */
export interface ResourceHierarchy {
  /** Hierarchy levels */
  levels: ResourceType[]

  /** Maximum depth (WorkOS supports up to 5) */
  maxDepth: number
}

/**
 * Common SaaS resource hierarchies
 */
export const StandardHierarchies = {
  /** Organization → Workspace → Project → Resource */
  saas: {
    levels: [
      { name: 'organization', description: 'Top-level organization' },
      { name: 'workspace', description: 'Workspace within org', parentType: 'organization' },
      { name: 'project', description: 'Project within workspace', parentType: 'workspace' },
      { name: 'resource', description: 'Resource within project', parentType: 'project' },
    ],
    maxDepth: 4,
  },

  /** Organization → Team → Repository */
  devtools: {
    levels: [
      { name: 'organization', description: 'Top-level organization' },
      { name: 'team', description: 'Team within org', parentType: 'organization' },
      { name: 'repository', description: 'Repository owned by team', parentType: 'team' },
    ],
    maxDepth: 3,
  },

  /** Account → Folder → Document */
  documents: {
    levels: [
      { name: 'account', description: 'User account' },
      { name: 'folder', description: 'Folder in account', parentType: 'account' },
      { name: 'document', description: 'Document in folder', parentType: 'folder' },
    ],
    maxDepth: 3,
  },
} as const satisfies Record<string, ResourceHierarchy>

// =============================================================================
// Role Definitions
// =============================================================================

/**
 * Standard permissions
 *
 * Beyond CRUD, we add `act` for domain-specific verbs (send, pay, publish, etc.)
 *
 * Permission levels:
 * - read   → view data (GET operations)
 * - edit   → modify data (PUT/PATCH operations)
 * - act    → perform actions/verbs (POST operations with side effects)
 * - delete → remove (DELETE operations)
 * - manage → all + role assignment
 */
export const StandardPermissions = {
  create: (resourceType: string): Permission => ({
    name: 'create',
    description: `Create ${resourceType}`,
    resourceType,
    actions: ['create'],
    inheritable: true,
  }),

  read: (resourceType: string): Permission => ({
    name: 'read',
    description: `Read ${resourceType}`,
    resourceType,
    actions: ['read', 'get', 'list', 'search', 'view'],
    inheritable: true,
  }),

  edit: (resourceType: string): Permission => ({
    name: 'edit',
    description: `Edit ${resourceType}`,
    resourceType,
    actions: ['update', 'edit', 'modify', 'patch'],
    inheritable: true,
  }),

  /**
   * Act - perform domain-specific verbs/actions
   *
   * This is for state transitions and side effects:
   * - invoice.send, invoice.pay, invoice.void
   * - document.publish, document.archive
   * - order.fulfill, order.refund
   *
   * Can be scoped: act:* (all), act:send, act:pay, etc.
   */
  act: (resourceType: string, verbs?: string[]): Permission => ({
    name: 'act',
    description: verbs
      ? `Perform ${verbs.join(', ')} on ${resourceType}`
      : `Perform actions on ${resourceType}`,
    resourceType,
    actions: verbs || ['*'],  // '*' means all verbs
    inheritable: true,
  }),

  delete: (resourceType: string): Permission => ({
    name: 'delete',
    description: `Delete ${resourceType}`,
    resourceType,
    actions: ['delete', 'remove', 'destroy'],
    inheritable: false,  // Usually not inherited
  }),

  manage: (resourceType: string): Permission => ({
    name: 'manage',
    description: `Full management of ${resourceType}`,
    resourceType,
    actions: ['*'],  // All actions
    inheritable: true,
  }),
}

/**
 * @deprecated Use StandardPermissions instead
 */
export const CRUDPermissions = StandardPermissions

// =============================================================================
// Verb-Scoped Permissions (e.g., invoice.pay, document.publish)
// =============================================================================

/**
 * Create a verb-scoped permission
 *
 * @example
 * ```ts
 * // Single verb
 * const canPay = verbPermission('invoice', 'pay')
 * // { name: 'invoice.pay', actions: ['pay'], resourceType: 'invoice' }
 *
 * // Multiple verbs
 * const canManagePayments = verbPermission('invoice', ['send', 'pay', 'void', 'refund'])
 * ```
 */
export function verbPermission(
  resourceType: string,
  verbs: string | string[],
  options?: { inheritable?: boolean; description?: string }
): Permission {
  const verbList = Array.isArray(verbs) ? verbs : [verbs]
  const name = verbList.length === 1
    ? `${resourceType}.${verbList[0]}`
    : `${resourceType}.[${verbList.join(',')}]`

  return {
    name,
    description: options?.description || `Can ${verbList.join(', ')} ${resourceType}`,
    resourceType,
    actions: verbList,
    inheritable: options?.inheritable ?? true,
  }
}

/**
 * Create permissions from a Noun's actions
 *
 * @example
 * ```ts
 * const invoicePerms = nounPermissions(InvoiceNoun)
 * // Creates: invoice.create, invoice.send, invoice.pay, invoice.void, etc.
 * ```
 */
export function nounPermissions(noun: Noun): Permission[] {
  const resourceType = noun.singular
  const permissions: Permission[] = []

  // Standard CRUD
  permissions.push(StandardPermissions.read(resourceType))
  permissions.push(StandardPermissions.edit(resourceType))
  permissions.push(StandardPermissions.delete(resourceType))

  // Domain-specific verbs from noun.actions
  if (noun.actions) {
    for (const action of noun.actions) {
      const verb = typeof action === 'string' ? action : action.action
      // Skip standard CRUD verbs (already covered)
      if (['create', 'read', 'update', 'delete', 'get', 'list'].includes(verb)) continue

      permissions.push(verbPermission(resourceType, verb))
    }
  }

  return permissions
}

/**
 * Permission pattern matching
 *
 * Checks if an action matches a permission pattern.
 *
 * @example
 * ```ts
 * matchesPermission('pay', ['*'])           // true - wildcard
 * matchesPermission('pay', ['pay'])         // true - exact
 * matchesPermission('pay', ['send', 'pay']) // true - in list
 * matchesPermission('pay', ['send'])        // false
 * ```
 */
export function matchesPermission(action: string, allowedActions: string[]): boolean {
  if (allowedActions.includes('*')) return true
  if (allowedActions.includes(action)) return true

  // Check for prefix patterns like 'invoice.*' matching 'invoice.pay'
  for (const pattern of allowedActions) {
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -2)
      if (action.startsWith(prefix + '.')) return true
    }
  }

  return false
}

/**
 * Create standard roles for a resource type
 */
export function createStandardRoles(resourceType: string): Record<RoleLevel, Role> {
  return {
    owner: {
      id: `${resourceType}:owner`,
      name: 'Owner',
      description: `Full control of ${resourceType}, including deletion and transfer`,
      resourceType,
      permissions: [
        CRUDPermissions.manage(resourceType),
        {
          name: 'transfer',
          description: 'Transfer ownership',
          resourceType,
          actions: ['transfer'],
          inheritable: false,
        },
      ],
    },

    admin: {
      id: `${resourceType}:admin`,
      name: 'Admin',
      description: `Administrative access to ${resourceType}`,
      resourceType,
      permissions: [
        StandardPermissions.create(resourceType),
        StandardPermissions.read(resourceType),
        StandardPermissions.edit(resourceType),
        StandardPermissions.act(resourceType),
        StandardPermissions.delete(resourceType),
      ],
    },

    editor: {
      id: `${resourceType}:editor`,
      name: 'Editor',
      description: `Can edit ${resourceType}`,
      resourceType,
      permissions: [
        StandardPermissions.read(resourceType),
        StandardPermissions.edit(resourceType),
        StandardPermissions.act(resourceType),
      ],
    },

    viewer: {
      id: `${resourceType}:viewer`,
      name: 'Viewer',
      description: `Read-only access to ${resourceType}`,
      resourceType,
      permissions: [
        StandardPermissions.read(resourceType),
      ],
    },

    guest: {
      id: `${resourceType}:guest`,
      name: 'Guest',
      description: `Limited access to ${resourceType}`,
      resourceType,
      permissions: [
        {
          name: 'view',
          description: 'View basic info',
          resourceType,
          actions: ['get'],
          inheritable: false,
        },
      ],
    },
  }
}

// =============================================================================
// Authorization Schema (integrates with Noun)
// =============================================================================

/**
 * Authorization schema for a Noun
 *
 * Extends a Noun with authorization metadata.
 */
export interface AuthorizedNoun extends Noun {
  /** Resource type configuration */
  authorization?: {
    /** Parent resource type in hierarchy */
    parentType?: string

    /** Available roles for this resource type */
    roles?: Role[]

    /** Custom permissions beyond CRUD */
    permissions?: Permission[]

    /** Whether this is a high-cardinality type */
    local?: boolean

    /** Default role for new resources */
    defaultRole?: string
  }
}

/**
 * Add authorization to a Noun
 */
export function authorizeNoun(
  noun: Noun,
  config: AuthorizedNoun['authorization']
): AuthorizedNoun {
  return {
    ...noun,
    authorization: config,
  }
}

// =============================================================================
// Authorization Engine Interface
// =============================================================================

/**
 * Authorization engine interface
 *
 * Implemented by providers (WorkOS, in-memory, custom).
 */
export interface AuthorizationEngine {
  // Resource management
  createResource(resource: Resource): Promise<Resource>
  getResource(ref: ResourceRef): Promise<Resource | null>
  deleteResource(ref: ResourceRef): Promise<void>
  listResources(type: string, parentRef?: ResourceRef): Promise<Resource[]>

  // Assignment management
  assign(input: AssignmentInput): Promise<Assignment>
  unassign(assignmentId: string): Promise<void>
  getAssignment(id: string): Promise<Assignment | null>
  listAssignments(filter: {
    subject?: Subject
    role?: string
    resource?: ResourceRef
  }): Promise<Assignment[]>

  // Authorization checks
  check(request: AuthzCheckRequest): Promise<AuthzCheckResult>
  batchCheck(request: AuthzBatchCheckRequest): Promise<AuthzBatchCheckResult>

  // Discovery
  listSubjectsWithAccess(resource: ResourceRef, action?: string): Promise<Subject[]>
  listResourcesForSubject(subject: Subject, resourceType: string, action?: string): Promise<Resource[]>
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse subject string to Subject object
 *
 * @example
 * ```ts
 * parseSubject('user:123') // { type: 'user', id: '123' }
 * parseSubject('group:admins') // { type: 'group', id: 'admins' }
 * ```
 */
export function parseSubject(str: string): Subject {
  const [type, id] = str.split(':')
  if (!type || !id) {
    throw new Error(`Invalid subject format: ${str}. Expected 'type:id'`)
  }
  return { type, id }
}

/**
 * Format Subject as string
 */
export function formatSubject(subject: Subject): string {
  return `${subject.type}:${subject.id}`
}

/**
 * Parse resource string to ResourceRef
 *
 * @example
 * ```ts
 * parseResource('workspace:456') // { type: 'workspace', id: '456' }
 * ```
 */
export function parseResource(str: string): ResourceRef {
  const [type, id] = str.split(':')
  if (!type || !id) {
    throw new Error(`Invalid resource format: ${str}. Expected 'type:id'`)
  }
  return { type, id }
}

/**
 * Format ResourceRef as string
 */
export function formatResource(resource: ResourceRef): string {
  return `${resource.type}:${resource.id}`
}

/**
 * Check if a subject matches another (for assignment matching)
 */
export function subjectMatches(a: Subject, b: Subject): boolean {
  return a.type === b.type && a.id === b.id
}

/**
 * Check if a resource matches another
 */
export function resourceMatches(a: ResourceRef, b: ResourceRef): boolean {
  return a.type === b.type && a.id === b.id
}

// =============================================================================
// In-Memory Authorization Engine (for testing/development)
// =============================================================================

/**
 * In-memory authorization engine
 *
 * Simple implementation for testing and development.
 * For production, use WorkOS or a persistent provider.
 */
export class InMemoryAuthorizationEngine implements AuthorizationEngine {
  private resources = new Map<string, Resource>()
  private assignments = new Map<string, Assignment>()
  private roles = new Map<string, Role>()
  private hierarchy: ResourceHierarchy

  constructor(config?: { hierarchy?: ResourceHierarchy; roles?: Role[] }) {
    this.hierarchy = config?.hierarchy || StandardHierarchies.saas
    if (config?.roles) {
      for (const role of config.roles) {
        this.roles.set(role.id, role)
      }
    }
  }

  // Resource management
  async createResource(resource: Resource): Promise<Resource> {
    const key = formatResource(resource)
    this.resources.set(key, resource)
    return resource
  }

  async getResource(ref: ResourceRef): Promise<Resource | null> {
    return this.resources.get(formatResource(ref)) || null
  }

  async deleteResource(ref: ResourceRef): Promise<void> {
    this.resources.delete(formatResource(ref))
  }

  async listResources(type: string, parentRef?: ResourceRef): Promise<Resource[]> {
    const results: Resource[] = []
    for (const resource of this.resources.values()) {
      if (resource.type !== type) continue
      if (parentRef && (!resource.parent || !resourceMatches(resource.parent, parentRef))) continue
      results.push(resource)
    }
    return results
  }

  // Assignment management
  async assign(input: AssignmentInput): Promise<Assignment> {
    const subject = typeof input.subject === 'string'
      ? parseSubject(input.subject)
      : input.subject
    const resource = typeof input.resource === 'string'
      ? parseResource(input.resource)
      : input.resource

    const assignment: Assignment = {
      id: `${formatSubject(subject)}:${input.role}:${formatResource(resource)}`,
      subject,
      role: input.role,
      resource,
      createdAt: new Date(),
      expiresAt: input.expiresAt,
      metadata: input.metadata,
    }

    this.assignments.set(assignment.id, assignment)
    return assignment
  }

  async unassign(assignmentId: string): Promise<void> {
    this.assignments.delete(assignmentId)
  }

  async getAssignment(id: string): Promise<Assignment | null> {
    return this.assignments.get(id) || null
  }

  async listAssignments(filter: {
    subject?: Subject
    role?: string
    resource?: ResourceRef
  }): Promise<Assignment[]> {
    const results: Assignment[] = []
    for (const assignment of this.assignments.values()) {
      if (filter.subject && !subjectMatches(assignment.subject, filter.subject)) continue
      if (filter.role && assignment.role !== filter.role) continue
      if (filter.resource && !resourceMatches(assignment.resource, filter.resource)) continue
      results.push(assignment)
    }
    return results
  }

  // Authorization checks
  async check(request: AuthzCheckRequest): Promise<AuthzCheckResult> {
    const start = Date.now()
    const subject = typeof request.subject === 'string'
      ? parseSubject(request.subject)
      : request.subject
    const resource = typeof request.resource === 'string'
      ? parseResource(request.resource)
      : request.resource

    // Check direct assignments
    const assignments = await this.listAssignments({ subject })

    for (const assignment of assignments) {
      // Check if assignment is on this resource or a parent
      if (this.resourceInScope(resource, assignment.resource)) {
        const role = this.roles.get(assignment.role)
        if (role && this.roleGrantsAction(role, request.action, resource.type)) {
          return {
            allowed: true,
            reason: `Granted by role '${role.name}' on ${formatResource(assignment.resource)}`,
            assignment,
            latencyMs: Date.now() - start,
          }
        }
      }
    }

    return {
      allowed: false,
      reason: 'No matching assignment found',
      latencyMs: Date.now() - start,
    }
  }

  async batchCheck(request: AuthzBatchCheckRequest): Promise<AuthzBatchCheckResult> {
    const start = Date.now()
    const results = await Promise.all(request.checks.map(c => this.check(c)))
    return {
      results,
      latencyMs: Date.now() - start,
    }
  }

  // Discovery
  async listSubjectsWithAccess(resource: ResourceRef, action?: string): Promise<Subject[]> {
    const subjects: Subject[] = []
    const seen = new Set<string>()

    for (const assignment of this.assignments.values()) {
      if (!this.resourceInScope(resource, assignment.resource)) continue

      const role = this.roles.get(assignment.role)
      if (action && role && !this.roleGrantsAction(role, action, resource.type)) continue

      const key = formatSubject(assignment.subject)
      if (!seen.has(key)) {
        seen.add(key)
        subjects.push(assignment.subject)
      }
    }

    return subjects
  }

  async listResourcesForSubject(
    subject: Subject,
    resourceType: string,
    action?: string
  ): Promise<Resource[]> {
    const resources: Resource[] = []
    const assignments = await this.listAssignments({ subject })

    for (const assignment of assignments) {
      const role = this.roles.get(assignment.role)
      if (!role) continue
      if (action && !this.roleGrantsAction(role, action, resourceType)) continue

      // Find all resources of the type that are in scope
      for (const resource of this.resources.values()) {
        if (resource.type !== resourceType) continue
        if (this.resourceInScope(resource, assignment.resource)) {
          resources.push(resource)
        }
      }
    }

    return resources
  }

  // Helpers
  private resourceInScope(target: ResourceRef, scope: ResourceRef): boolean {
    // Same resource
    if (resourceMatches(target, scope)) return true

    // Check if scope is a parent of target
    const targetResource = this.resources.get(formatResource(target))
    if (!targetResource?.parent) return false

    return this.resourceInScope(targetResource.parent, scope)
  }

  private roleGrantsAction(role: Role, action: string, resourceType: string): boolean {
    for (const permission of role.permissions) {
      // Check resource type match (or inheritable)
      if (permission.resourceType !== resourceType && !permission.inheritable) continue

      // Check action match
      if (permission.actions.includes(action) || permission.actions.includes('*')) {
        return true
      }
    }

    // Check inherited roles
    if (role.inherits) {
      for (const inheritedRoleId of role.inherits) {
        const inheritedRole = this.roles.get(inheritedRoleId)
        if (inheritedRole && this.roleGrantsAction(inheritedRole, action, resourceType)) {
          return true
        }
      }
    }

    return false
  }

  // Role management
  registerRole(role: Role): void {
    this.roles.set(role.id, role)
  }

  getRole(id: string): Role | undefined {
    return this.roles.get(id)
  }
}

// =============================================================================
// Business Role Integration
// =============================================================================

/**
 * Business role - organizational role (CEO, Engineer, Manager)
 *
 * Different from authorization Role - this represents a job function.
 * Can be linked to authorization Roles for permissions.
 */
export interface BusinessRole {
  /** Role identifier */
  id: string

  /** Display name (CEO, Software Engineer, Product Manager) */
  name: string

  /** Description */
  description?: string

  /** Department */
  department?: string

  /** Level in organization (1 = IC, 2 = Manager, 3 = Director, 4 = VP, 5 = C-level) */
  level?: number

  /** Reports to (parent role) */
  reportsTo?: string

  /** Responsibilities */
  responsibilities?: string[]

  /** Required skills */
  skills?: string[]

  /** Authorization roles this business role grants */
  authorizationRoles?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Link business roles to authorization roles
 */
export function linkBusinessRole(
  businessRole: BusinessRole,
  authRoles: string[]
): BusinessRole {
  return {
    ...businessRole,
    authorizationRoles: [
      ...(businessRole.authorizationRoles || []),
      ...authRoles,
    ],
  }
}

// =============================================================================
// Noun Definition for Role (makes Role a first-class entity)
// =============================================================================

/**
 * Role as a Noun - can be stored in ai-database
 */
export const RoleNoun: Noun = {
  singular: 'role',
  plural: 'roles',
  description: 'An authorization role with permissions',

  properties: {
    id: { type: 'string', description: 'Unique role identifier' },
    name: { type: 'string', description: 'Display name' },
    description: { type: 'string', optional: true, description: 'Role description' },
    resourceType: { type: 'string', description: 'Resource type this role is scoped to' },
    level: { type: 'string', optional: true, description: 'Role level (owner, admin, editor, viewer, guest)' },
  },

  relationships: {
    permissions: { type: 'Permission[]', description: 'Permissions granted by this role' },
    inherits: { type: 'Role[]', description: 'Parent roles inherited from' },
    assignments: { type: 'Assignment[]', backref: 'role', description: 'Assignments using this role' },
  },

  actions: ['create', 'update', 'delete', 'assign', 'unassign'],
  events: ['created', 'updated', 'deleted', 'assigned', 'unassigned'],
}

/**
 * Assignment as a Noun
 */
export const AssignmentNoun: Noun = {
  singular: 'assignment',
  plural: 'assignments',
  description: 'A role assignment binding subject, role, and resource',

  properties: {
    id: { type: 'string', description: 'Unique assignment identifier' },
    subjectType: { type: 'string', description: 'Subject type (user, group, service, agent)' },
    subjectId: { type: 'string', description: 'Subject identifier' },
    roleId: { type: 'string', description: 'Role identifier' },
    resourceType: { type: 'string', description: 'Resource type' },
    resourceId: { type: 'string', description: 'Resource identifier' },
    expiresAt: { type: 'datetime', optional: true, description: 'Expiration timestamp' },
  },

  relationships: {
    role: { type: 'Role', backref: 'assignments', description: 'The assigned role' },
  },

  actions: ['create', 'delete', 'extend', 'revoke'],
  events: ['created', 'deleted', 'extended', 'revoked', 'expired'],
}

/**
 * Permission as a Noun
 */
export const PermissionNoun: Noun = {
  singular: 'permission',
  plural: 'permissions',
  description: 'A permission granting actions on a resource type',

  properties: {
    name: { type: 'string', description: 'Permission name' },
    description: { type: 'string', optional: true, description: 'Permission description' },
    resourceType: { type: 'string', description: 'Resource type this applies to' },
    actions: { type: 'string', array: true, description: 'Actions granted' },
    inheritable: { type: 'boolean', optional: true, description: 'Whether permission flows to children' },
  },

  relationships: {
    roles: { type: 'Role[]', backref: 'permissions', description: 'Roles that include this permission' },
  },

  actions: ['create', 'update', 'delete'],
  events: ['created', 'updated', 'deleted'],
}

/**
 * All authorization-related Nouns
 */
export const AuthorizationNouns = {
  Role: RoleNoun,
  Assignment: AssignmentNoun,
  Permission: PermissionNoun,
}
