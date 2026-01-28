/**
 * Organization Entity Types (Nouns)
 *
 * Organizational hierarchy: Organization, Department, Team, Position, Role.
 *
 * Uses digital-workers Worker type for position holders.
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'
import type { Worker as DigitalWorker, WorkerRef } from 'digital-workers'

// Re-export for convenience
export type { DigitalWorker, WorkerRef }

// =============================================================================
// Organization
// =============================================================================

/**
 * Organization entity
 *
 * Represents the top-level organizational structure.
 */
export const Organization: Noun = {
  singular: 'organization',
  plural: 'organizations',
  description: 'The top-level organizational structure',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Organization name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Organization description',
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Organization type',
      examples: ['functional', 'divisional', 'matrix', 'flat', 'holacracy'],
    },

    // Settings
    fiscalYearStart: {
      type: 'string',
      optional: true,
      description: 'Fiscal year start month (e.g., "January", "April")',
    },
    defaultCurrency: {
      type: 'string',
      optional: true,
      description: 'Default currency code',
      examples: ['USD', 'EUR', 'GBP'],
    },
    defaultTimezone: {
      type: 'string',
      optional: true,
      description: 'Default timezone',
    },

    // Size
    departmentCount: {
      type: 'number',
      optional: true,
      description: 'Number of departments',
    },
    teamCount: {
      type: 'number',
      optional: true,
      description: 'Number of teams',
    },
    positionCount: {
      type: 'number',
      optional: true,
      description: 'Number of positions',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Organization status',
      examples: ['active', 'restructuring', 'archived'],
    },
  },

  relationships: {
    business: {
      type: 'Business',
      description: 'Parent business',
    },
    departments: {
      type: 'Department[]',
      description: 'Departments',
    },
    teams: {
      type: 'Team[]',
      description: 'All teams',
    },
    positions: {
      type: 'Position[]',
      description: 'All positions',
    },
    roles: {
      type: 'Role[]',
      description: 'Defined roles',
    },
  },

  actions: ['create', 'update', 'restructure', 'merge', 'split', 'archive'],

  events: ['created', 'updated', 'restructured', 'merged', 'split', 'archived'],
}

// =============================================================================
// Department
// =============================================================================

/**
 * Department entity
 *
 * Represents a functional department or division.
 */
export const Department: Noun = {
  singular: 'department',
  plural: 'departments',
  description: 'A functional department or division',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Department name',
    },
    code: {
      type: 'string',
      optional: true,
      description: 'Department code (e.g., "ENG", "MKT")',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Department description',
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Department type',
      examples: [
        'engineering',
        'product',
        'design',
        'marketing',
        'sales',
        'operations',
        'finance',
        'hr',
        'legal',
        'support',
      ],
    },

    // Budget
    budget: {
      type: 'number',
      optional: true,
      description: 'Annual budget',
    },
    budgetCurrency: {
      type: 'string',
      optional: true,
      description: 'Budget currency',
    },
    budgetPeriod: {
      type: 'string',
      optional: true,
      description: 'Budget period',
      examples: ['monthly', 'quarterly', 'yearly'],
    },

    // Size
    headcount: {
      type: 'number',
      optional: true,
      description: 'Number of employees',
    },
    teamCount: {
      type: 'number',
      optional: true,
      description: 'Number of teams',
    },

    // Hierarchy
    level: {
      type: 'number',
      optional: true,
      description: 'Organizational level (1 = top)',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Department status',
      examples: ['active', 'forming', 'restructuring', 'dissolved'],
    },
  },

  relationships: {
    organization: {
      type: 'Organization',
      description: 'Parent organization',
    },
    parent: {
      type: 'Department',
      required: false,
      description: 'Parent department (for sub-departments)',
    },
    children: {
      type: 'Department[]',
      description: 'Sub-departments',
    },
    head: {
      type: 'Position',
      required: false,
      description: 'Department head position',
    },
    teams: {
      type: 'Team[]',
      description: 'Teams in this department',
    },
    goals: {
      type: 'Goal[]',
      description: 'Department goals',
    },
    budgets: {
      type: 'Budget[]',
      description: 'Budget allocations',
    },
  },

  actions: [
    'create',
    'update',
    'rename',
    'setBudget',
    'addTeam',
    'removeTeam',
    'setHead',
    'merge',
    'split',
    'dissolve',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'renamed',
    'budgetSet',
    'teamAdded',
    'teamRemoved',
    'headChanged',
    'merged',
    'split',
    'dissolved',
    'archived',
  ],
}

// =============================================================================
// Team
// =============================================================================

/**
 * Team entity
 *
 * Represents a working team within a department.
 */
export const Team: Noun = {
  singular: 'team',
  plural: 'teams',
  description: 'A working team within a department',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Team name',
    },
    code: {
      type: 'string',
      optional: true,
      description: 'Team code',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Team description',
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Team type',
      examples: ['product', 'platform', 'growth', 'infrastructure', 'support', 'project', 'tiger'],
    },
    methodology: {
      type: 'string',
      optional: true,
      description: 'Working methodology',
      examples: ['scrum', 'kanban', 'scrumban', 'waterfall', 'hybrid'],
    },

    // Size
    capacity: {
      type: 'number',
      optional: true,
      description: 'Team capacity (FTE)',
    },
    headcount: {
      type: 'number',
      optional: true,
      description: 'Number of members',
    },

    // Communication
    slackChannel: {
      type: 'string',
      optional: true,
      description: 'Slack channel',
    },
    email: {
      type: 'string',
      optional: true,
      description: 'Team email',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Team status',
      examples: ['active', 'forming', 'storming', 'norming', 'performing', 'adjourning'],
    },
  },

  relationships: {
    department: {
      type: 'Department',
      description: 'Parent department',
    },
    lead: {
      type: 'Position',
      required: false,
      description: 'Team lead position',
    },
    positions: {
      type: 'Position[]',
      description: 'Team positions',
    },
    projects: {
      type: 'Project[]',
      description: 'Active projects',
    },
    workflows: {
      type: 'Workflow[]',
      description: 'Team workflows',
    },
  },

  actions: [
    'create',
    'update',
    'rename',
    'setLead',
    'addMember',
    'removeMember',
    'setCapacity',
    'assignProject',
    'unassignProject',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'renamed',
    'leadChanged',
    'memberAdded',
    'memberRemoved',
    'capacityChanged',
    'projectAssigned',
    'projectUnassigned',
    'archived',
  ],
}

// =============================================================================
// Position
// =============================================================================

/**
 * Position entity
 *
 * Represents a position/job within the organization.
 */
export const Position: Noun = {
  singular: 'position',
  plural: 'positions',
  description: 'A position or job within the organization',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Position title',
    },
    code: {
      type: 'string',
      optional: true,
      description: 'Position code',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Position description',
    },

    // Classification
    level: {
      type: 'string',
      optional: true,
      description: 'Job level',
      examples: [
        'intern',
        'junior',
        'mid',
        'senior',
        'staff',
        'principal',
        'director',
        'vp',
        'c-level',
      ],
    },
    track: {
      type: 'string',
      optional: true,
      description: 'Career track',
      examples: ['individual-contributor', 'management', 'executive'],
    },
    grade: {
      type: 'string',
      optional: true,
      description: 'Pay grade',
    },

    // Type
    employmentType: {
      type: 'string',
      optional: true,
      description: 'Employment type',
      examples: ['full-time', 'part-time', 'contract', 'intern', 'advisor'],
    },
    workLocation: {
      type: 'string',
      optional: true,
      description: 'Work location type',
      examples: ['remote', 'office', 'hybrid'],
    },

    // Compensation
    salaryMin: {
      type: 'number',
      optional: true,
      description: 'Minimum salary',
    },
    salaryMax: {
      type: 'number',
      optional: true,
      description: 'Maximum salary',
    },
    salaryCurrency: {
      type: 'string',
      optional: true,
      description: 'Salary currency',
    },
    equityMin: {
      type: 'number',
      optional: true,
      description: 'Minimum equity percentage',
    },
    equityMax: {
      type: 'number',
      optional: true,
      description: 'Maximum equity percentage',
    },

    // Capacity
    fte: {
      type: 'number',
      optional: true,
      description: 'Full-time equivalent (0-1)',
    },

    // Requirements
    requirements: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Position requirements',
    },
    skills: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Required skills',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Position status',
      examples: ['open', 'filled', 'frozen', 'eliminated'],
    },
  },

  relationships: {
    team: {
      type: 'Team',
      description: 'Parent team',
    },
    role: {
      type: 'Role',
      description: 'Assigned role',
    },
    reportsTo: {
      type: 'Position',
      required: false,
      description: 'Reports to position',
    },
    directReports: {
      type: 'Position[]',
      description: 'Direct reports',
    },
    holder: {
      type: 'Worker',
      required: false,
      description: 'Current position holder',
    },
  },

  actions: [
    'create',
    'update',
    'open',
    'fill',
    'freeze',
    'eliminate',
    'transfer',
    'promote',
    'setCompensation',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'opened',
    'filled',
    'frozen',
    'eliminated',
    'transferred',
    'promoted',
    'compensationChanged',
    'archived',
  ],
}

// =============================================================================
// Role
// =============================================================================

/**
 * Role entity
 *
 * Represents a role with permissions and capabilities.
 */
export const Role: Noun = {
  singular: 'role',
  plural: 'roles',
  description: 'A role with permissions and capabilities',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Role name',
    },
    code: {
      type: 'string',
      optional: true,
      description: 'Role code',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Role description',
    },

    // Type
    type: {
      type: 'string',
      optional: true,
      description: 'Role type',
      examples: ['executive', 'manager', 'lead', 'contributor', 'specialist', 'support'],
    },

    // Permissions
    permissions: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Granted permissions',
    },
    capabilities: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Role capabilities',
    },

    // Approval
    approvalLevel: {
      type: 'number',
      optional: true,
      description: 'Approval authority level',
    },
    approvalLimit: {
      type: 'number',
      optional: true,
      description: 'Approval spending limit',
    },

    // Hierarchy
    level: {
      type: 'number',
      optional: true,
      description: 'Role hierarchy level',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Role status',
      examples: ['active', 'deprecated'],
    },
  },

  relationships: {
    organization: {
      type: 'Organization',
      description: 'Parent organization',
    },
    parent: {
      type: 'Role',
      required: false,
      description: 'Parent role (inherits permissions)',
    },
    children: {
      type: 'Role[]',
      description: 'Child roles',
    },
    positions: {
      type: 'Position[]',
      description: 'Positions with this role',
    },
  },

  actions: [
    'create',
    'update',
    'grantPermission',
    'revokePermission',
    'setApprovalLimit',
    'deprecate',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'permissionGranted',
    'permissionRevoked',
    'approvalLimitChanged',
    'deprecated',
    'archived',
  ],
}

// =============================================================================
// Worker
// =============================================================================

/**
 * Worker entity
 *
 * Represents a human employee or AI agent that fills a position.
 */
export const Worker: Noun = {
  singular: 'worker',
  plural: 'workers',
  description: 'A human employee or AI agent that fills a position',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Worker name',
    },
    email: {
      type: 'string',
      optional: true,
      description: 'Email address',
    },
    avatarUrl: {
      type: 'url',
      optional: true,
      description: 'Avatar URL',
    },

    // Type
    type: {
      type: 'string',
      description: 'Worker type',
      examples: ['human', 'agent'],
    },

    // Human-specific
    firstName: {
      type: 'string',
      optional: true,
      description: 'First name',
    },
    lastName: {
      type: 'string',
      optional: true,
      description: 'Last name',
    },
    phone: {
      type: 'string',
      optional: true,
      description: 'Phone number',
    },
    location: {
      type: 'string',
      optional: true,
      description: 'Work location',
    },
    timezone: {
      type: 'string',
      optional: true,
      description: 'Timezone',
    },
    startDate: {
      type: 'date',
      optional: true,
      description: 'Start date',
    },

    // Agent-specific
    agentId: {
      type: 'string',
      optional: true,
      description: 'AI agent identifier',
    },
    modelId: {
      type: 'string',
      optional: true,
      description: 'AI model identifier',
    },
    capabilities: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Agent capabilities',
    },

    // Availability
    availability: {
      type: 'string',
      optional: true,
      description: 'Availability status',
      examples: ['available', 'busy', 'away', 'offline'],
    },
    capacity: {
      type: 'number',
      optional: true,
      description: 'Available capacity (0-1)',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Worker status',
      examples: ['active', 'onboarding', 'on-leave', 'offboarding', 'inactive'],
    },
  },

  relationships: {
    position: {
      type: 'Position',
      required: false,
      description: 'Current position',
    },
    manager: {
      type: 'Worker',
      required: false,
      description: 'Direct manager',
    },
    directReports: {
      type: 'Worker[]',
      description: 'Direct reports',
    },
    tasks: {
      type: 'Task[]',
      description: 'Assigned tasks',
    },
  },

  actions: [
    'create',
    'update',
    'onboard',
    'assign',
    'reassign',
    'setAvailability',
    'promote',
    'transfer',
    'offboard',
    'archive',
  ],

  events: [
    'created',
    'updated',
    'onboarded',
    'assigned',
    'reassigned',
    'availabilityChanged',
    'promoted',
    'transferred',
    'offboarded',
    'archived',
  ],
}

// =============================================================================
// Exports
// =============================================================================

export const OrganizationEntities = {
  Organization,
  Department,
  Team,
  Position,
  Role,
  Worker,
}

export const OrganizationCategories = {
  structure: ['Organization', 'Department', 'Team'],
  people: ['Position', 'Role', 'Worker'],
} as const
