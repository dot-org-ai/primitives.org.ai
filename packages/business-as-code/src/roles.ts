/**
 * Business Roles - Bridges digital-workers and ai-database authorization
 *
 * Connects:
 * - WorkerRole (business role: CEO, Engineer, Manager)
 * - Authorization Role (FGA/RBAC: permissions, access control)
 * - Task Assignment (who handles what in workflows/processes)
 *
 * @packageDocumentation
 */

// =============================================================================
// Business Role - Bridges Worker Role and Authorization
// =============================================================================

/**
 * Business role type - the function of a worker in the organization
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
  // Custom
  | string

/**
 * Business Role - extends WorkerRole with authorization and task capabilities
 *
 * @example
 * ```ts
 * const engineeringManager: BusinessRole = {
 *   id: 'role_eng_manager',
 *   name: 'Engineering Manager',
 *   type: 'manager',
 *   department: 'Engineering',
 *   description: 'Leads engineering team and makes technical decisions',
 *
 *   // Business responsibilities
 *   responsibilities: [
 *     'Lead engineering team',
 *     'Make architecture decisions',
 *     'Conduct code reviews',
 *   ],
 *
 *   // Authorization permissions (from FGA)
 *   permissions: {
 *     repository: ['read', 'edit', 'act:merge', 'act:deploy'],
 *     project: ['read', 'edit', 'manage'],
 *     team: ['read', 'edit'],
 *   },
 *
 *   // Task capabilities
 *   canHandle: ['code-review', 'architecture-decision', 'deployment-approval'],
 *   canDelegate: ['code-review', 'testing'],
 *   canApprove: ['pull-request', 'deployment', 'budget-under-5k'],
 *
 *   // Worker type preference
 *   workerType: 'human',
 * }
 * ```
 */
export interface BusinessRole {
  /** Unique role identifier */
  id: string

  /** Role display name */
  name: string

  /** Role type classification */
  type: BusinessRoleType

  /** Department or team */
  department?: string

  /** Human-readable description */
  description?: string

  /** Key responsibilities */
  responsibilities?: string[]

  /** Required skills */
  skills?: string[]

  /**
   * Authorization permissions by resource type
   *
   * Maps resource types to allowed actions:
   * - 'read', 'edit', 'delete', 'manage' (standard)
   * - 'act:*' or 'act:verb' (domain-specific verbs)
   *
   * @example
   * ```ts
   * permissions: {
   *   document: ['read', 'edit'],
   *   invoice: ['read', 'act:send', 'act:void'],
   *   project: ['read', 'edit', 'manage'],
   * }
   * ```
   */
  permissions?: Record<string, string[]>

  /** Task types this role can handle */
  canHandle?: string[]

  /** Task types this role can delegate to others */
  canDelegate?: string[]

  /** Request types this role can approve */
  canApprove?: string[]

  /** Escalation path - role to escalate to */
  escalateTo?: string

  /** Reports to - manager role */
  reportsTo?: string

  /** Worker type preference: 'ai' | 'human' | 'hybrid' */
  workerType?: 'ai' | 'human' | 'hybrid'

  /** Level in hierarchy (1 = entry, higher = more senior) */
  level?: number

  /** Compensation band */
  compensationBand?: string

  /** Additional metadata */
  metadata?: Record<string, unknown>
}

// =============================================================================
// Task Assignment - Connects Workers to Tasks
// =============================================================================

/**
 * Task status
 */
export type TaskStatus =
  | 'pending'
  | 'assigned'
  | 'in_progress'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * Task priority
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical'

/**
 * Task assignment - links a worker to a task
 *
 * @example
 * ```ts
 * const assignment: TaskAssignment = {
 *   id: 'assign_123',
 *   taskId: 'task_review_pr_456',
 *   taskType: 'code-review',
 *
 *   // Who is assigned
 *   assignee: { type: 'worker', id: 'worker_alice' },
 *   role: 'role_eng_manager',
 *
 *   // From what process/workflow
 *   processId: 'process_code_review',
 *   stepId: 'step_1_review',
 *
 *   // Status and timing
 *   status: 'in_progress',
 *   priority: 'high',
 *   assignedAt: new Date(),
 *   dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
 *
 *   // Context
 *   context: {
 *     pullRequestId: 'pr_789',
 *     repository: 'acme/webapp',
 *   },
 * }
 * ```
 */
export interface TaskAssignment {
  /** Unique assignment ID */
  id: string

  /** Task identifier */
  taskId: string

  /** Task type (for routing) */
  taskType: string

  /** Task description */
  description?: string

  /** Who is assigned */
  assignee: AssigneeRef

  /** Required role for this task */
  role?: string

  /** Source process ID */
  processId?: string

  /** Source workflow ID */
  workflowId?: string

  /** Step ID within process/workflow */
  stepId?: string

  /** Current status */
  status: TaskStatus

  /** Priority */
  priority?: TaskPriority

  /** When assigned */
  assignedAt: Date

  /** Who assigned it */
  assignedBy?: AssigneeRef

  /** Due date */
  dueAt?: Date

  /** Started at */
  startedAt?: Date

  /** Completed at */
  completedAt?: Date

  /** Task context/data */
  context?: Record<string, unknown>

  /** Task result */
  result?: unknown

  /** Notes */
  notes?: string

  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Reference to an assignee (worker, team, or role)
 */
export interface AssigneeRef {
  /** Type of assignee */
  type: 'worker' | 'team' | 'role'
  /** Assignee ID */
  id: string
  /** Display name */
  name?: string
}

// =============================================================================
// Role-Based Task Routing
// =============================================================================

/**
 * Task routing rule - determines who handles what tasks
 *
 * @example
 * ```ts
 * const routingRules: TaskRoutingRule[] = [
 *   {
 *     taskType: 'code-review',
 *     requiredRole: 'engineer',
 *     requiredLevel: 2,
 *     requiredSkills: ['TypeScript'],
 *     preferWorkerType: 'human',
 *   },
 *   {
 *     taskType: 'expense-approval',
 *     requiredRole: 'manager',
 *     amountThreshold: 1000,
 *     escalateAbove: 5000, // Escalate to director above $5k
 *     escalateTo: 'director',
 *   },
 *   {
 *     taskType: 'customer-inquiry',
 *     requiredRole: 'agent',
 *     preferWorkerType: 'ai',
 *     fallbackTo: 'human', // Escalate to human if AI can't handle
 *   },
 * ]
 * ```
 */
export interface TaskRoutingRule {
  /** Task type this rule applies to */
  taskType: string

  /** Required role type */
  requiredRole?: BusinessRoleType

  /** Minimum level required */
  requiredLevel?: number

  /** Required skills */
  requiredSkills?: string[]

  /** Required permissions */
  requiredPermissions?: string[]

  /** Preferred worker type */
  preferWorkerType?: 'ai' | 'human' | 'hybrid'

  /** Amount threshold (for approval tasks) */
  amountThreshold?: number

  /** Amount above which to escalate */
  escalateAbove?: number

  /** Role to escalate to */
  escalateTo?: BusinessRoleType | string

  /** Fallback worker type if preferred unavailable */
  fallbackTo?: 'ai' | 'human'

  /** Priority for this task type */
  defaultPriority?: TaskPriority

  /** SLA in minutes */
  slaMinutes?: number

  /** Additional conditions */
  conditions?: Record<string, unknown>
}

// =============================================================================
// Workflow Role - Role within a specific workflow
// =============================================================================

/**
 * Workflow role - defines a role within the context of a workflow
 *
 * @example
 * ```ts
 * const workflowRoles: WorkflowRole[] = [
 *   {
 *     name: 'Requester',
 *     description: 'Person who initiates the request',
 *     canInitiate: true,
 *     canView: ['all'],
 *   },
 *   {
 *     name: 'Approver',
 *     description: 'Person who approves or rejects',
 *     tasks: ['review', 'approve', 'reject'],
 *     canView: ['details', 'history'],
 *     requiredBusinessRole: 'manager',
 *   },
 *   {
 *     name: 'Processor',
 *     description: 'Person who processes after approval',
 *     tasks: ['process', 'complete'],
 *     requiredBusinessRole: 'operator',
 *   },
 * ]
 * ```
 */
export interface WorkflowRole {
  /** Role name within workflow */
  name: string

  /** Description */
  description?: string

  /** Can initiate this workflow */
  canInitiate?: boolean

  /** Tasks this role handles */
  tasks?: string[]

  /** What this role can view */
  canView?: string[]

  /** Required business role */
  requiredBusinessRole?: BusinessRoleType | string

  /** Required permissions */
  requiredPermissions?: string[]

  /** Minimum level */
  minLevel?: number
}

// =============================================================================
// Standard Business Roles
// =============================================================================

/**
 * Standard business roles with typical permissions
 */
export const StandardBusinessRoles: Record<string, Partial<BusinessRole>> = {
  // Executive
  ceo: {
    type: 'ceo',
    name: 'Chief Executive Officer',
    level: 10,
    permissions: { '*': ['manage'] },
    canApprove: ['*'],
    workerType: 'human',
  },
  cto: {
    type: 'cto',
    name: 'Chief Technology Officer',
    level: 10,
    department: 'Technology',
    permissions: {
      technology: ['manage'],
      repository: ['manage'],
      infrastructure: ['manage'],
    },
    canApprove: ['technical-decision', 'architecture', 'technology-budget'],
    workerType: 'human',
  },
  cfo: {
    type: 'cfo',
    name: 'Chief Financial Officer',
    level: 10,
    department: 'Finance',
    permissions: {
      finance: ['manage'],
      budget: ['manage'],
      expense: ['manage'],
    },
    canApprove: ['expense', 'budget', 'financial-decision'],
    workerType: 'human',
  },

  // Management
  director: {
    type: 'director',
    level: 8,
    permissions: {
      team: ['manage'],
      project: ['manage'],
      budget: ['read', 'edit'],
    },
    canApprove: ['hiring', 'budget-under-50k', 'project'],
    workerType: 'human',
  },
  manager: {
    type: 'manager',
    level: 6,
    permissions: {
      team: ['read', 'edit'],
      project: ['read', 'edit', 'manage'],
    },
    canApprove: ['expense-under-5k', 'time-off', 'code-review'],
    workerType: 'human',
  },
  lead: {
    type: 'lead',
    level: 5,
    permissions: {
      team: ['read'],
      project: ['read', 'edit'],
      repository: ['read', 'edit', 'act:merge'],
    },
    canDelegate: ['code-review', 'testing'],
    workerType: 'hybrid',
  },

  // Individual Contributors
  engineer: {
    type: 'engineer',
    level: 3,
    department: 'Engineering',
    permissions: {
      repository: ['read', 'edit'],
      project: ['read'],
    },
    canHandle: ['coding', 'code-review', 'bug-fix', 'testing'],
    workerType: 'hybrid',
  },
  analyst: {
    type: 'analyst',
    level: 3,
    permissions: {
      data: ['read'],
      report: ['read', 'edit'],
    },
    canHandle: ['data-analysis', 'reporting', 'research'],
    workerType: 'hybrid',
  },

  // Operations
  agent: {
    type: 'agent',
    level: 2,
    permissions: {
      ticket: ['read', 'edit', 'act:respond', 'act:escalate'],
      customer: ['read'],
    },
    canHandle: ['customer-inquiry', 'support-ticket', 'basic-troubleshooting'],
    workerType: 'ai', // AI-first
  },
  assistant: {
    type: 'assistant',
    level: 1,
    permissions: {
      calendar: ['read', 'edit'],
      email: ['read', 'act:draft'],
      task: ['read', 'edit'],
    },
    canHandle: ['scheduling', 'email-draft', 'task-management', 'research'],
    workerType: 'ai', // AI-first
  },
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a business role from a standard template
 */
export function createBusinessRole(
  id: string,
  template: keyof typeof StandardBusinessRoles,
  overrides?: Partial<BusinessRole>
): BusinessRole {
  const standard = StandardBusinessRoles[template]
  if (!standard) {
    throw new Error(`Unknown role template: ${template}`)
  }

  return {
    id,
    name: standard.name || template,
    type: standard.type || template,
    ...standard,
    ...overrides,
  } as BusinessRole
}

/**
 * Check if a role has permission for an action on a resource type
 */
export function hasPermission(
  role: BusinessRole,
  resourceType: string,
  action: string
): boolean {
  if (!role.permissions) return false

  // Check wildcard permissions
  const wildcardPerms = role.permissions['*']
  if (wildcardPerms) {
    if (wildcardPerms.includes('manage') || wildcardPerms.includes('*')) return true
    if (wildcardPerms.includes(action)) return true
  }

  // Check resource-specific permissions
  const resourcePerms = role.permissions[resourceType]
  if (!resourcePerms) return false

  // Check for exact match
  if (resourcePerms.includes(action)) return true

  // Check for 'manage' which includes all actions
  if (resourcePerms.includes('manage') || resourcePerms.includes('*')) return true

  // Check for act:* pattern
  if (action.startsWith('act:')) {
    if (resourcePerms.includes('act:*')) return true
  }

  return false
}

/**
 * Check if a role can handle a task type
 */
export function canHandleTask(role: BusinessRole, taskType: string): boolean {
  if (!role.canHandle) return false
  return role.canHandle.includes(taskType) || role.canHandle.includes('*')
}

/**
 * Check if a role can approve a request type
 */
export function canApproveRequest(role: BusinessRole, requestType: string): boolean {
  if (!role.canApprove) return false
  return role.canApprove.includes(requestType) || role.canApprove.includes('*')
}

/**
 * Check if a role can delegate a task type
 */
export function canDelegateTask(role: BusinessRole, taskType: string): boolean {
  if (!role.canDelegate) return false
  return role.canDelegate.includes(taskType) || role.canDelegate.includes('*')
}

/**
 * Find the best role for a task based on routing rules
 */
export function findRoleForTask(
  taskType: string,
  rules: TaskRoutingRule[],
  context?: { amount?: number; skills?: string[] }
): TaskRoutingRule | undefined {
  const matchingRules = rules.filter(rule => rule.taskType === taskType)

  if (matchingRules.length === 0) return undefined

  // If there's an amount and escalation rules, check those
  if (context?.amount) {
    for (const rule of matchingRules) {
      if (rule.escalateAbove && context.amount > rule.escalateAbove) {
        // Find the escalated rule
        const escalatedRule = rules.find(
          r => r.taskType === taskType && r.requiredRole === rule.escalateTo
        )
        if (escalatedRule) return escalatedRule
      }
    }
  }

  // Return the first matching rule
  return matchingRules[0]
}

/**
 * Create a task assignment
 */
export function createTaskAssignment(
  taskId: string,
  taskType: string,
  assignee: AssigneeRef,
  options?: Partial<Omit<TaskAssignment, 'id' | 'taskId' | 'taskType' | 'assignee' | 'status' | 'assignedAt'>>
): TaskAssignment {
  return {
    id: `assign_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    taskId,
    taskType,
    assignee,
    status: 'assigned',
    assignedAt: new Date(),
    priority: 'normal',
    ...options,
  }
}

/**
 * Transition task assignment status
 */
export function transitionTaskStatus(
  assignment: TaskAssignment,
  newStatus: TaskStatus,
  options?: { result?: unknown; notes?: string }
): TaskAssignment {
  const now = new Date()

  return {
    ...assignment,
    status: newStatus,
    ...(newStatus === 'in_progress' && !assignment.startedAt ? { startedAt: now } : {}),
    ...(newStatus === 'completed' || newStatus === 'failed' ? { completedAt: now } : {}),
    ...(options?.result ? { result: options.result } : {}),
    ...(options?.notes ? { notes: options.notes } : {}),
  }
}
