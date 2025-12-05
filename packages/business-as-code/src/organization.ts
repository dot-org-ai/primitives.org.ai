/**
 * Organization Structure - Flows to FGA/RBAC
 *
 * Defines the complete organizational hierarchy:
 *
 * Organization
 *   └── Department
 *       └── Team
 *           └── Position (Role + Worker)
 *               └── Permissions (FGA/RBAC)
 *
 * This structure enables:
 * - Hierarchical permission inheritance
 * - Role-based task assignment
 * - Approval chains based on org structure
 * - Resource access control based on department/team
 *
 * @packageDocumentation
 */

import type { BusinessRole, TaskRoutingRule, WorkflowRole } from './roles.js'

// =============================================================================
// Organization Hierarchy
// =============================================================================

/**
 * Organization - top-level business entity
 *
 * @example
 * ```ts
 * const acme: Organization = {
 *   id: 'org_acme',
 *   name: 'Acme Corp',
 *   domain: 'acme.com',
 *   industry: 'technology',
 *
 *   // Hierarchy
 *   departments: [engineering, sales, support],
 *
 *   // Global settings
 *   settings: {
 *     defaultCurrency: 'USD',
 *     timezone: 'America/Los_Angeles',
 *     workWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
 *   },
 *
 *   // Resource hierarchy for FGA
 *   resourceHierarchy: {
 *     organization: { children: ['department', 'project', 'repository'] },
 *     department: { parent: 'organization', children: ['team'] },
 *     team: { parent: 'department', children: ['position'] },
 *   },
 * }
 * ```
 */
export interface Organization {
  /** Unique identifier */
  id: string

  /** Organization name */
  name: string

  /** Primary domain */
  domain?: string

  /** Legal name (if different) */
  legalName?: string

  /** Industry/sector */
  industry?: string

  /** Mission statement */
  mission?: string

  /** Core values */
  values?: string[]

  /** Founded date */
  foundedAt?: Date

  /** Headquarters location */
  headquarters?: Address

  /** Organization settings */
  settings?: OrganizationSettings

  /** Departments */
  departments?: Department[]

  /** Standalone teams (not in departments) */
  teams?: Team[]

  /** Organization-wide roles */
  roles?: BusinessRole[]

  /** Resource hierarchy for FGA */
  resourceHierarchy?: ResourceHierarchy

  /** Global approval chains */
  approvalChains?: ApprovalChain[]

  /** Task routing rules */
  routingRules?: TaskRoutingRule[]

  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Organization settings
 */
export interface OrganizationSettings {
  /** Default currency */
  defaultCurrency?: string

  /** Default timezone */
  timezone?: string

  /** Work week days */
  workWeek?: string[]

  /** Business hours */
  businessHours?: {
    start: string
    end: string
    timezone?: string
  }

  /** Fiscal year start month (1-12) */
  fiscalYearStart?: number

  /** Default language */
  language?: string

  /** Date format */
  dateFormat?: string
}

/**
 * Address
 */
export interface Address {
  street?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

// =============================================================================
// Department
// =============================================================================

/**
 * Department - major organizational division
 *
 * @example
 * ```ts
 * const engineering: Department = {
 *   id: 'dept_eng',
 *   name: 'Engineering',
 *   code: 'ENG',
 *
 *   // Leadership
 *   head: { roleId: 'role_cto', positionId: 'pos_cto_jane' },
 *
 *   // Teams
 *   teams: [platformTeam, productTeam, infraTeam],
 *
 *   // Budget
 *   budget: {
 *     annual: 5000000,
 *     currency: 'USD',
 *     categories: {
 *       salaries: 3500000,
 *       tools: 200000,
 *       infrastructure: 800000,
 *       training: 100000,
 *     },
 *   },
 *
 *   // FGA: Department-level permissions
 *   defaultPermissions: {
 *     repository: ['read'],
 *     project: ['read'],
 *   },
 * }
 * ```
 */
export interface Department {
  /** Unique identifier */
  id: string

  /** Department name */
  name: string

  /** Short code (e.g., 'ENG', 'SALES') */
  code?: string

  /** Description */
  description?: string

  /** Department head position */
  head?: PositionRef

  /** Parent department (for sub-departments) */
  parentId?: string

  /** Teams within department */
  teams?: Team[]

  /** Department budget */
  budget?: Budget

  /** Cost center code */
  costCenter?: string

  /** Department goals */
  goals?: string[]

  /** Default permissions for department members */
  defaultPermissions?: Record<string, string[]>

  /** Department-specific roles */
  roles?: BusinessRole[]

  /** Department-specific routing rules */
  routingRules?: TaskRoutingRule[]

  /** Metadata */
  metadata?: Record<string, unknown>
}

// =============================================================================
// Team
// =============================================================================

/**
 * Team - working group within a department
 *
 * @example
 * ```ts
 * const platformTeam: Team = {
 *   id: 'team_platform',
 *   name: 'Platform Team',
 *   departmentId: 'dept_eng',
 *
 *   // Leadership
 *   lead: { roleId: 'role_lead', positionId: 'pos_lead_bob' },
 *
 *   // Members
 *   positions: [
 *     { id: 'pos_1', roleId: 'role_engineer', workerId: 'worker_alice' },
 *     { id: 'pos_2', roleId: 'role_engineer', workerId: 'worker_charlie' },
 *     { id: 'pos_3', roleId: 'role_engineer', workerId: null }, // Open position
 *   ],
 *
 *   // Team resources (for FGA scoping)
 *   resources: {
 *     repositories: ['platform-core', 'platform-api'],
 *     projects: ['platform-v2'],
 *   },
 *
 *   // Team-level permissions (inherited by members)
 *   defaultPermissions: {
 *     repository: ['read', 'edit', 'act:merge'],
 *     project: ['read', 'edit'],
 *   },
 * }
 * ```
 */
export interface Team {
  /** Unique identifier */
  id: string

  /** Team name */
  name: string

  /** Parent department */
  departmentId?: string

  /** Description */
  description?: string

  /** Team lead position */
  lead?: PositionRef

  /** Team positions */
  positions?: Position[]

  /** Team objectives */
  objectives?: string[]

  /** Team resources (for FGA scoping) */
  resources?: TeamResources

  /** Team budget (if separate from department) */
  budget?: Budget

  /** Default permissions for team members */
  defaultPermissions?: Record<string, string[]>

  /** Workflow roles for this team */
  workflowRoles?: WorkflowRole[]

  /** Communication channels */
  channels?: TeamChannels

  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Team resources - scopes FGA permissions
 */
export interface TeamResources {
  /** Owned repositories */
  repositories?: string[]

  /** Owned projects */
  projects?: string[]

  /** Owned products */
  products?: string[]

  /** Custom resource types */
  [resourceType: string]: string[] | undefined
}

/**
 * Team communication channels
 */
export interface TeamChannels {
  slack?: string
  teams?: string
  email?: string
  discord?: string
}

// =============================================================================
// Position - Role + Worker Assignment
// =============================================================================

/**
 * Position - a role filled by a worker
 *
 * The position is the link between:
 * - Business Role (responsibilities, permissions)
 * - Worker (human or AI agent)
 * - Location in org hierarchy (team → department → org)
 *
 * @example
 * ```ts
 * const seniorEngineerPosition: Position = {
 *   id: 'pos_se_123',
 *   title: 'Senior Software Engineer',
 *
 *   // Role defines what this position can do
 *   roleId: 'role_senior_engineer',
 *
 *   // Worker currently filling this position
 *   workerId: 'worker_alice',
 *   workerType: 'human',
 *
 *   // Hierarchy
 *   teamId: 'team_platform',
 *   reportsTo: 'pos_lead_bob',
 *
 *   // Position-specific permissions (added to role permissions)
 *   additionalPermissions: {
 *     'repository:platform-core': ['manage'],
 *   },
 *
 *   // Employment details
 *   startDate: new Date('2023-01-15'),
 *   status: 'active',
 * }
 * ```
 */
export interface Position {
  /** Unique identifier */
  id: string

  /** Position title */
  title: string

  /** Business role this position requires */
  roleId: string

  /** Worker filling this position (null = open position) */
  workerId?: string | null

  /** Type of worker (human, agent, or either) */
  workerType?: 'human' | 'agent' | 'any'

  /** Team this position belongs to */
  teamId?: string

  /** Position this reports to */
  reportsTo?: string

  /** Direct reports (position IDs) */
  directReports?: string[]

  /** Position-specific additional permissions */
  additionalPermissions?: Record<string, string[]>

  /** Start date */
  startDate?: Date

  /** End date (for contractors/temporary) */
  endDate?: Date

  /** Position status */
  status?: 'active' | 'open' | 'on-leave' | 'terminated'

  /** Full-time equivalent (1.0 = full-time) */
  fte?: number

  /** Location */
  location?: string

  /** Remote/hybrid/onsite */
  workModel?: 'remote' | 'hybrid' | 'onsite'

  /** Compensation */
  compensation?: Compensation

  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Position reference
 */
export interface PositionRef {
  positionId?: string
  roleId?: string
  workerId?: string
}

/**
 * Compensation details
 */
export interface Compensation {
  /** Base salary */
  baseSalary?: number

  /** Currency */
  currency?: string

  /** Pay frequency */
  frequency?: 'hourly' | 'weekly' | 'biweekly' | 'monthly' | 'annual'

  /** Bonus target percentage */
  bonusTarget?: number

  /** Equity grants */
  equity?: {
    type: 'options' | 'rsu' | 'shares'
    amount: number
    vestingSchedule?: string
  }

  /** Band/level */
  band?: string
}

// =============================================================================
// Budget
// =============================================================================

/**
 * Budget allocation
 */
export interface Budget {
  /** Total annual budget */
  annual?: number

  /** Currency */
  currency?: string

  /** Budget period */
  period?: string

  /** Budget categories */
  categories?: Record<string, number>

  /** Spent to date */
  spent?: number

  /** Remaining */
  remaining?: number
}

// =============================================================================
// Resource Hierarchy - FGA Integration
// =============================================================================

/**
 * Resource hierarchy definition for FGA
 *
 * Defines how resources relate to each other for permission inheritance.
 *
 * @example
 * ```ts
 * const hierarchy: ResourceHierarchy = {
 *   // Organization is root
 *   organization: {
 *     children: ['department', 'project', 'repository'],
 *   },
 *
 *   // Department inherits from org
 *   department: {
 *     parent: 'organization',
 *     children: ['team'],
 *   },
 *
 *   // Team inherits from department
 *   team: {
 *     parent: 'department',
 *     children: ['position'],
 *   },
 *
 *   // Project can be org-level or team-level
 *   project: {
 *     parent: 'organization',
 *     alternateParents: ['team'],
 *     children: ['document', 'task'],
 *   },
 *
 *   // Repository can be org-level or team-level
 *   repository: {
 *     parent: 'organization',
 *     alternateParents: ['team'],
 *   },
 * }
 * ```
 */
export interface ResourceHierarchy {
  [resourceType: string]: ResourceHierarchyNode
}

/**
 * Node in resource hierarchy
 */
export interface ResourceHierarchyNode {
  /** Primary parent resource type */
  parent?: string

  /** Alternative parent types */
  alternateParents?: string[]

  /** Child resource types */
  children?: string[]

  /** Whether permissions cascade down */
  inheritPermissions?: boolean

  /** Maximum depth (for nested resources) */
  maxDepth?: number
}

// =============================================================================
// Approval Chains
// =============================================================================

/**
 * Approval chain - defines who approves what
 *
 * @example
 * ```ts
 * const expenseApprovalChain: ApprovalChain = {
 *   id: 'chain_expense',
 *   name: 'Expense Approval',
 *   type: 'expense',
 *
 *   levels: [
 *     {
 *       threshold: 1000,
 *       approvers: [{ type: 'direct-manager' }],
 *     },
 *     {
 *       threshold: 5000,
 *       approvers: [
 *         { type: 'direct-manager' },
 *         { type: 'role', roleId: 'director' },
 *       ],
 *     },
 *     {
 *       threshold: 25000,
 *       approvers: [
 *         { type: 'direct-manager' },
 *         { type: 'role', roleId: 'vp' },
 *         { type: 'role', roleId: 'cfo' },
 *       ],
 *     },
 *   ],
 *
 *   // Escalation settings
 *   escalation: {
 *     afterHours: 24,
 *     escalateTo: 'skip-level-manager',
 *   },
 * }
 * ```
 */
export interface ApprovalChain {
  /** Chain identifier */
  id: string

  /** Chain name */
  name: string

  /** What type of requests this chain handles */
  type: string

  /** Approval levels */
  levels: ApprovalLevel[]

  /** Escalation rules */
  escalation?: EscalationRule

  /** Active/inactive */
  active?: boolean

  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Approval level within a chain
 */
export interface ApprovalLevel {
  /** Threshold amount (requests above this need this level) */
  threshold?: number

  /** Approvers at this level */
  approvers: ApproverSpec[]

  /** How many approvers needed */
  requiredApprovals?: number

  /** Whether approvals at this level are sequential or parallel */
  approvalMode?: 'sequential' | 'parallel' | 'any'

  /** SLA for this level (hours) */
  slaHours?: number
}

/**
 * Approver specification
 */
export interface ApproverSpec {
  /** Approver type */
  type: 'direct-manager' | 'skip-level-manager' | 'role' | 'position' | 'worker' | 'team'

  /** Role ID (if type is 'role') */
  roleId?: string

  /** Position ID (if type is 'position') */
  positionId?: string

  /** Worker ID (if type is 'worker') */
  workerId?: string

  /** Team ID (if type is 'team') */
  teamId?: string
}

/**
 * Escalation rule
 */
export interface EscalationRule {
  /** Hours before escalation */
  afterHours: number

  /** Who to escalate to */
  escalateTo: 'skip-level-manager' | 'department-head' | 'role' | 'position'

  /** Role ID if escalating to role */
  roleId?: string

  /** Position ID if escalating to position */
  positionId?: string

  /** Maximum escalations */
  maxEscalations?: number
}

// =============================================================================
// Permission Resolution
// =============================================================================

/**
 * Resolved permissions for a worker
 *
 * Combines:
 * - Organization-level defaults
 * - Department-level permissions
 * - Team-level permissions
 * - Role permissions
 * - Position-specific permissions
 */
export interface ResolvedPermissions {
  /** Worker ID */
  workerId: string

  /** Position ID */
  positionId: string

  /** Effective permissions by resource type */
  permissions: Record<string, string[]>

  /** Resource-specific permissions */
  resourcePermissions: Record<string, Record<string, string[]>>

  /** Approval capabilities */
  canApprove: string[]

  /** Task handling capabilities */
  canHandle: string[]

  /** Inheritance chain (for debugging) */
  inheritanceChain: string[]
}

/**
 * Resolve permissions for a position in the org hierarchy
 */
export function resolvePermissions(
  org: Organization,
  positionId: string
): ResolvedPermissions | null {
  // Find the position
  let position: Position | undefined
  let team: Team | undefined
  let department: Department | undefined

  // Search through hierarchy
  for (const dept of org.departments || []) {
    for (const t of dept.teams || []) {
      const pos = t.positions?.find(p => p.id === positionId)
      if (pos) {
        position = pos
        team = t
        department = dept
        break
      }
    }
    if (position) break
  }

  // Also check standalone teams
  if (!position) {
    for (const t of org.teams || []) {
      const pos = t.positions?.find(p => p.id === positionId)
      if (pos) {
        position = pos
        team = t
        break
      }
    }
  }

  if (!position) return null

  // Find the role
  const role = org.roles?.find(r => r.id === position.roleId)

  // Build inheritance chain
  const inheritanceChain: string[] = []
  const permissions: Record<string, string[]> = {}
  const resourcePermissions: Record<string, Record<string, string[]>> = {}
  const canApprove: string[] = []
  const canHandle: string[] = []

  // 1. Department defaults
  if (department?.defaultPermissions) {
    inheritanceChain.push(`department:${department.id}`)
    mergePermissions(permissions, department.defaultPermissions)
  }

  // 2. Team defaults
  if (team?.defaultPermissions) {
    inheritanceChain.push(`team:${team.id}`)
    mergePermissions(permissions, team.defaultPermissions)
  }

  // 3. Team resources (scoped permissions)
  if (team?.resources) {
    for (const [resourceType, resourceIds] of Object.entries(team.resources)) {
      if (resourceIds) {
        for (const resourceId of resourceIds) {
          const key = `${resourceType}:${resourceId}`
          resourcePermissions[key] = resourcePermissions[key] || {}
          mergePermissions(resourcePermissions[key], team.defaultPermissions || {})
        }
      }
    }
  }

  // 4. Role permissions
  if (role?.permissions) {
    inheritanceChain.push(`role:${role.id}`)
    mergePermissions(permissions, role.permissions)
  }

  // 5. Role capabilities
  if (role?.canApprove) {
    canApprove.push(...role.canApprove)
  }
  if (role?.canHandle) {
    canHandle.push(...role.canHandle)
  }

  // 6. Position-specific permissions
  if (position.additionalPermissions) {
    inheritanceChain.push(`position:${position.id}`)
    mergePermissions(permissions, position.additionalPermissions)

    // Handle resource-specific permissions
    for (const [key, perms] of Object.entries(position.additionalPermissions)) {
      if (key.includes(':')) {
        resourcePermissions[key] = resourcePermissions[key] || {}
        resourcePermissions[key] = { ...resourcePermissions[key], _direct: perms }
      }
    }
  }

  return {
    workerId: position.workerId || '',
    positionId: position.id,
    permissions,
    resourcePermissions,
    canApprove: [...new Set(canApprove)],
    canHandle: [...new Set(canHandle)],
    inheritanceChain,
  }
}

/**
 * Merge permissions into target
 */
function mergePermissions(
  target: Record<string, string[]>,
  source: Record<string, string[]>
): void {
  for (const [key, perms] of Object.entries(source)) {
    if (!target[key]) {
      target[key] = []
    }
    for (const perm of perms) {
      if (!target[key].includes(perm)) {
        target[key].push(perm)
      }
    }
  }
}

/**
 * Get approval chain for a request
 */
export function getApprovalChainForRequest(
  org: Organization,
  requestType: string,
  amount?: number
): ApproverSpec[] {
  const chain = org.approvalChains?.find(c => c.type === requestType && c.active !== false)
  if (!chain) return []

  // Find the appropriate level based on amount
  const levels = [...chain.levels].sort((a, b) => (a.threshold || 0) - (b.threshold || 0))

  for (const level of levels.reverse()) {
    if (amount === undefined || (level.threshold && amount <= level.threshold)) {
      return level.approvers
    }
  }

  // Return highest level if amount exceeds all thresholds
  return levels[levels.length - 1]?.approvers || []
}

/**
 * Find manager for a position (follows reportsTo chain)
 */
export function findManager(
  org: Organization,
  positionId: string
): Position | null {
  // Find the position
  for (const dept of org.departments || []) {
    for (const team of dept.teams || []) {
      const position = team.positions?.find(p => p.id === positionId)
      if (position?.reportsTo) {
        // Find the manager position
        for (const d of org.departments || []) {
          for (const t of d.teams || []) {
            const manager = t.positions?.find(p => p.id === position.reportsTo)
            if (manager) return manager
          }
        }
      }
    }
  }
  return null
}
