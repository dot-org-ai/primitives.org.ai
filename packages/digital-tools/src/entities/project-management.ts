/**
 * Project Management Entity Types (Nouns)
 *
 * Semantic type definitions for project management tools that can be used by
 * both remote human workers AND AI agents. Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, Verb } from 'ai-database'

// =============================================================================
// Project
// =============================================================================

/**
 * Project entity
 *
 * Represents a project with goals, deliverables, team members, and timeline.
 * Used by tools like Jira, Linear, Asana, Monday, ClickUp, etc.
 */
export const Project: Noun = {
  singular: 'project',
  plural: 'projects',
  description: 'A project with defined scope, timeline, and team members',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Project name',
    },
    key: {
      type: 'string',
      optional: true,
      description: 'Unique project key/identifier (e.g., PROJ, WEB)',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Detailed project description',
    },
    icon: {
      type: 'string',
      optional: true,
      description: 'Project icon/emoji',
    },
    color: {
      type: 'string',
      optional: true,
      description: 'Project color code',
    },

    // Status & Progress
    status: {
      type: 'string',
      description: 'Project status: planning, active, on-hold, completed, cancelled',
      examples: ['planning', 'active', 'on-hold', 'completed', 'cancelled'],
    },
    progress: {
      type: 'number',
      optional: true,
      description: 'Overall completion percentage (0-100)',
    },
    health: {
      type: 'string',
      optional: true,
      description: 'Project health: on-track, at-risk, off-track',
      examples: ['on-track', 'at-risk', 'off-track'],
    },

    // Timeline
    startDate: {
      type: 'date',
      optional: true,
      description: 'Project start date',
    },
    endDate: {
      type: 'date',
      optional: true,
      description: 'Project end date',
    },
    targetDate: {
      type: 'date',
      optional: true,
      description: 'Target completion date',
    },

    // Organization
    visibility: {
      type: 'string',
      description: 'Project visibility: public, private, team',
      examples: ['public', 'private', 'team'],
    },
    archived: {
      type: 'boolean',
      optional: true,
      description: 'Whether the project is archived',
    },

    // Metrics
    issueCount: {
      type: 'number',
      optional: true,
      description: 'Total number of issues',
    },
    openIssueCount: {
      type: 'number',
      optional: true,
      description: 'Number of open issues',
    },
    memberCount: {
      type: 'number',
      optional: true,
      description: 'Number of team members',
    },

    // Settings
    template: {
      type: 'string',
      optional: true,
      description: 'Project template used',
    },
    workflow: {
      type: 'json',
      optional: true,
      description: 'Custom workflow configuration',
    },
  },

  relationships: {
    owner: {
      type: 'Contact',
      description: 'Project owner/lead',
    },
    team: {
      type: 'Contact[]',
      description: 'Team members assigned to the project',
    },
    issues: {
      type: 'Issue[]',
      backref: 'project',
      description: 'Issues/tickets in this project',
    },
    epics: {
      type: 'Epic[]',
      backref: 'project',
      description: 'Epics in this project',
    },
    sprints: {
      type: 'Sprint[]',
      backref: 'project',
      description: 'Sprints/iterations for this project',
    },
    milestones: {
      type: 'Milestone[]',
      backref: 'project',
      description: 'Project milestones',
    },
    boards: {
      type: 'Board[]',
      backref: 'project',
      description: 'Kanban boards for this project',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'archive',
    'restore',
    'duplicate',
    'setStatus',
    'addMember',
    'removeMember',
    'setOwner',
    'setDates',
    'updateProgress',
    'export',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'archived',
    'restored',
    'duplicated',
    'statusChanged',
    'memberAdded',
    'memberRemoved',
    'ownerChanged',
    'datesChanged',
    'progressUpdated',
    'completed',
    'cancelled',
  ],
}

// =============================================================================
// Issue
// =============================================================================

/**
 * Issue/Ticket entity
 *
 * Represents a work item, task, bug, or feature request.
 * Brand-agnostic equivalent of:
 * - Jira Issue
 * - Linear Issue
 * - GitHub Issue
 * - Asana Task
 */
export const Issue: Noun = {
  singular: 'issue',
  plural: 'issues',
  description: 'A work item, task, bug, or feature request',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Issue title/summary',
    },
    identifier: {
      type: 'string',
      optional: true,
      description: 'Issue identifier (e.g., PROJ-123, #456)',
    },
    description: {
      type: 'markdown',
      optional: true,
      description: 'Detailed issue description',
    },

    // Type & Classification
    type: {
      type: 'string',
      description: 'Issue type: task, bug, feature, story, epic, subtask',
      examples: ['task', 'bug', 'feature', 'story', 'epic', 'subtask'],
    },
    priority: {
      type: 'string',
      description: 'Priority level: none, low, medium, high, urgent',
      examples: ['none', 'low', 'medium', 'high', 'urgent'],
    },
    severity: {
      type: 'string',
      optional: true,
      description: 'Bug severity: minor, major, critical, blocker',
      examples: ['minor', 'major', 'critical', 'blocker'],
    },

    // Status & Progress
    status: {
      type: 'string',
      description: 'Issue status: backlog, todo, in-progress, review, done, cancelled',
      examples: ['backlog', 'todo', 'in-progress', 'review', 'done', 'cancelled'],
    },
    progress: {
      type: 'number',
      optional: true,
      description: 'Completion percentage (0-100)',
    },
    resolution: {
      type: 'string',
      optional: true,
      description: 'Resolution: fixed, wont-fix, duplicate, works-as-designed',
      examples: ['fixed', 'wont-fix', 'duplicate', 'works-as-designed'],
    },

    // Timeline
    createdAt: {
      type: 'datetime',
      description: 'When the issue was created',
    },
    updatedAt: {
      type: 'datetime',
      description: 'When the issue was last updated',
    },
    startDate: {
      type: 'date',
      optional: true,
      description: 'Planned start date',
    },
    dueDate: {
      type: 'date',
      optional: true,
      description: 'Due date',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the issue was completed',
    },

    // Estimation
    estimate: {
      type: 'number',
      optional: true,
      description: 'Story points or time estimate',
    },
    estimateType: {
      type: 'string',
      optional: true,
      description: 'Estimation unit: points, hours, days',
      examples: ['points', 'hours', 'days'],
    },
    timeSpent: {
      type: 'number',
      optional: true,
      description: 'Actual time spent in hours',
    },
    timeRemaining: {
      type: 'number',
      optional: true,
      description: 'Estimated time remaining in hours',
    },

    // Context
    storyPoints: {
      type: 'number',
      optional: true,
      description: 'Story points for agile estimation',
    },
    environment: {
      type: 'string',
      optional: true,
      description: 'Environment where issue occurs: dev, staging, production',
      examples: ['dev', 'staging', 'production'],
    },

    // Organization
    archived: {
      type: 'boolean',
      optional: true,
      description: 'Whether the issue is archived',
    },
  },

  relationships: {
    project: {
      type: 'Project',
      backref: 'issues',
      description: 'Project this issue belongs to',
    },
    epic: {
      type: 'Epic',
      required: false,
      backref: 'issues',
      description: 'Parent epic if this is part of one',
    },
    sprint: {
      type: 'Sprint',
      required: false,
      backref: 'issues',
      description: 'Sprint this issue is assigned to',
    },
    milestone: {
      type: 'Milestone',
      required: false,
      backref: 'issues',
      description: 'Milestone this issue is part of',
    },
    assignee: {
      type: 'Contact',
      required: false,
      description: 'Person assigned to work on this issue',
    },
    reporter: {
      type: 'Contact',
      description: 'Person who reported/created the issue',
    },
    labels: {
      type: 'Label[]',
      description: 'Labels applied to this issue',
    },
    parent: {
      type: 'Issue',
      required: false,
      description: 'Parent issue (for subtasks)',
    },
    subtasks: {
      type: 'Issue[]',
      description: 'Child issues/subtasks',
    },
    blockedBy: {
      type: 'Issue[]',
      description: 'Issues blocking this one',
    },
    blocks: {
      type: 'Issue[]',
      description: 'Issues this one blocks',
    },
    relatedTo: {
      type: 'Issue[]',
      description: 'Related issues',
    },
    comments: {
      type: 'Comment[]',
      backref: 'issue',
      description: 'Comments on this issue',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'Files attached to this issue',
    },
    column: {
      type: 'Column',
      required: false,
      description: 'Board column this issue is in',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'archive',
    'restore',
    'duplicate',
    'assign',
    'unassign',
    'setStatus',
    'setPriority',
    'setType',
    'addLabel',
    'removeLabel',
    'addSubtask',
    'link',
    'unlink',
    'block',
    'unblock',
    'move',
    'comment',
    'estimate',
    'logTime',
    'watch',
    'unwatch',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'archived',
    'restored',
    'duplicated',
    'assigned',
    'unassigned',
    'statusChanged',
    'priorityChanged',
    'typeChanged',
    'labeled',
    'unlabeled',
    'subtaskAdded',
    'linked',
    'unlinked',
    'blocked',
    'unblocked',
    'moved',
    'commented',
    'estimated',
    'timeLogged',
    'completed',
    'reopened',
  ],
}

// =============================================================================
// Sprint
// =============================================================================

/**
 * Sprint/Iteration entity
 *
 * Represents a time-boxed iteration for agile development.
 */
export const Sprint: Noun = {
  singular: 'sprint',
  plural: 'sprints',
  description: 'A time-boxed iteration for agile development',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Sprint name',
    },
    number: {
      type: 'number',
      optional: true,
      description: 'Sprint number/sequence',
    },
    goal: {
      type: 'string',
      optional: true,
      description: 'Sprint goal or objective',
    },

    // Status
    status: {
      type: 'string',
      description: 'Sprint status: planning, active, completed, cancelled',
      examples: ['planning', 'active', 'completed', 'cancelled'],
    },

    // Timeline
    startDate: {
      type: 'date',
      description: 'Sprint start date',
    },
    endDate: {
      type: 'date',
      description: 'Sprint end date',
    },
    duration: {
      type: 'number',
      optional: true,
      description: 'Sprint duration in days',
    },

    // Metrics
    capacity: {
      type: 'number',
      optional: true,
      description: 'Team capacity in story points or hours',
    },
    commitment: {
      type: 'number',
      optional: true,
      description: 'Committed story points or hours',
    },
    completed: {
      type: 'number',
      optional: true,
      description: 'Completed story points or hours',
    },
    velocity: {
      type: 'number',
      optional: true,
      description: 'Actual velocity (completed work)',
    },
    issueCount: {
      type: 'number',
      optional: true,
      description: 'Total number of issues',
    },
    completedIssueCount: {
      type: 'number',
      optional: true,
      description: 'Number of completed issues',
    },

    // Settings
    autoComplete: {
      type: 'boolean',
      optional: true,
      description: 'Whether to auto-complete the sprint when end date is reached',
    },
  },

  relationships: {
    project: {
      type: 'Project',
      backref: 'sprints',
      description: 'Project this sprint belongs to',
    },
    issues: {
      type: 'Issue[]',
      backref: 'sprint',
      description: 'Issues in this sprint',
    },
    team: {
      type: 'Contact[]',
      description: 'Team members working in this sprint',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'start',
    'complete',
    'cancel',
    'addIssue',
    'removeIssue',
    'setGoal',
    'setCapacity',
    'extend',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'started',
    'completed',
    'cancelled',
    'issueAdded',
    'issueRemoved',
    'goalChanged',
    'capacityChanged',
    'extended',
  ],
}

// =============================================================================
// Milestone
// =============================================================================

/**
 * Milestone/Release entity
 *
 * Represents a significant point in project timeline, often a release or major deliverable.
 */
export const Milestone: Noun = {
  singular: 'milestone',
  plural: 'milestones',
  description: 'A significant point in project timeline or a release',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Milestone name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Milestone description',
    },
    version: {
      type: 'string',
      optional: true,
      description: 'Version number for releases (e.g., v1.2.0)',
    },

    // Status
    status: {
      type: 'string',
      description: 'Milestone status: planned, active, completed, cancelled',
      examples: ['planned', 'active', 'completed', 'cancelled'],
    },
    progress: {
      type: 'number',
      optional: true,
      description: 'Overall completion percentage (0-100)',
    },

    // Timeline
    startDate: {
      type: 'date',
      optional: true,
      description: 'Milestone start date',
    },
    targetDate: {
      type: 'date',
      description: 'Target completion date',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the milestone was completed',
    },

    // Metrics
    issueCount: {
      type: 'number',
      optional: true,
      description: 'Total number of issues',
    },
    openIssueCount: {
      type: 'number',
      optional: true,
      description: 'Number of open issues',
    },
    closedIssueCount: {
      type: 'number',
      optional: true,
      description: 'Number of closed issues',
    },

    // Organization
    archived: {
      type: 'boolean',
      optional: true,
      description: 'Whether the milestone is archived',
    },
  },

  relationships: {
    project: {
      type: 'Project',
      backref: 'milestones',
      description: 'Project this milestone belongs to',
    },
    issues: {
      type: 'Issue[]',
      backref: 'milestone',
      description: 'Issues associated with this milestone',
    },
    owner: {
      type: 'Contact',
      required: false,
      description: 'Person responsible for this milestone',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'archive',
    'restore',
    'complete',
    'cancel',
    'addIssue',
    'removeIssue',
    'setTargetDate',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'archived',
    'restored',
    'completed',
    'cancelled',
    'issueAdded',
    'issueRemoved',
    'targetDateChanged',
    'delayed',
  ],
}

// =============================================================================
// Board
// =============================================================================

/**
 * Board entity
 *
 * Represents a Kanban board for visualizing work and workflow.
 */
export const Board: Noun = {
  singular: 'board',
  plural: 'boards',
  description: 'A Kanban board for visualizing work and workflow',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Board name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Board description',
    },
    icon: {
      type: 'string',
      optional: true,
      description: 'Board icon/emoji',
    },

    // Type
    type: {
      type: 'string',
      description: 'Board type: kanban, scrum, list',
      examples: ['kanban', 'scrum', 'list'],
    },

    // Settings
    swimlanes: {
      type: 'string',
      optional: true,
      description: 'Swimlane grouping: none, assignee, priority, epic',
      examples: ['none', 'assignee', 'priority', 'epic'],
    },
    cardStyle: {
      type: 'string',
      optional: true,
      description: 'Card display style: compact, detailed, custom',
      examples: ['compact', 'detailed', 'custom'],
    },
    autoArchive: {
      type: 'boolean',
      optional: true,
      description: 'Whether to automatically archive completed issues',
    },

    // Organization
    visibility: {
      type: 'string',
      description: 'Board visibility: public, private, team',
      examples: ['public', 'private', 'team'],
    },
    archived: {
      type: 'boolean',
      optional: true,
      description: 'Whether the board is archived',
    },
  },

  relationships: {
    project: {
      type: 'Project',
      backref: 'boards',
      description: 'Project this board belongs to',
    },
    columns: {
      type: 'Column[]',
      backref: 'board',
      description: 'Columns in this board',
    },
    owner: {
      type: 'Contact',
      description: 'Board owner',
    },
    members: {
      type: 'Contact[]',
      description: 'Members with access to this board',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'archive',
    'restore',
    'duplicate',
    'addColumn',
    'removeColumn',
    'reorderColumns',
    'addMember',
    'removeMember',
    'setSwimlanes',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'archived',
    'restored',
    'duplicated',
    'columnAdded',
    'columnRemoved',
    'columnsReordered',
    'memberAdded',
    'memberRemoved',
    'swimlanesChanged',
  ],
}

// =============================================================================
// Column
// =============================================================================

/**
 * Column entity
 *
 * Represents a column in a Kanban board (e.g., Todo, In Progress, Done).
 */
export const Column: Noun = {
  singular: 'column',
  plural: 'columns',
  description: 'A column in a Kanban board representing a workflow state',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Column name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Column description',
    },

    // Visual
    color: {
      type: 'string',
      optional: true,
      description: 'Column color code',
    },
    icon: {
      type: 'string',
      optional: true,
      description: 'Column icon/emoji',
    },

    // Position
    position: {
      type: 'number',
      description: 'Column position/order (0-indexed)',
    },

    // Constraints
    wipLimit: {
      type: 'number',
      optional: true,
      description: 'Work-in-progress limit for this column',
    },
    issueCount: {
      type: 'number',
      optional: true,
      description: 'Current number of issues in this column',
    },

    // Status Mapping
    statusCategory: {
      type: 'string',
      description: 'Status category: todo, in-progress, done',
      examples: ['todo', 'in-progress', 'done'],
    },
  },

  relationships: {
    board: {
      type: 'Board',
      backref: 'columns',
      description: 'Board this column belongs to',
    },
    issues: {
      type: 'Issue[]',
      description: 'Issues currently in this column',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'rename',
    'move',
    'setColor',
    'setWipLimit',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'renamed',
    'moved',
    'colorChanged',
    'wipLimitChanged',
    'wipLimitExceeded',
  ],
}

// =============================================================================
// Label
// =============================================================================

/**
 * Label entity
 *
 * Represents a label/tag for categorizing and filtering issues.
 */
export const Label: Noun = {
  singular: 'label',
  plural: 'labels',
  description: 'A label or tag for categorizing and filtering issues',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Label name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Label description',
    },

    // Visual
    color: {
      type: 'string',
      description: 'Label color code (hex)',
    },
    icon: {
      type: 'string',
      optional: true,
      description: 'Label icon/emoji',
    },

    // Organization
    category: {
      type: 'string',
      optional: true,
      description: 'Label category or group',
    },
  },

  relationships: {
    project: {
      type: 'Project',
      required: false,
      description: 'Project this label is scoped to (if any)',
    },
    issues: {
      type: 'Issue[]',
      description: 'Issues with this label',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'rename',
    'setColor',
    'merge',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'renamed',
    'colorChanged',
    'merged',
    'applied',
    'removed',
  ],
}

// =============================================================================
// Epic
// =============================================================================

/**
 * Epic entity
 *
 * Represents a large body of work that can be broken down into smaller issues.
 */
export const Epic: Noun = {
  singular: 'epic',
  plural: 'epics',
  description: 'A large body of work containing multiple related issues',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Epic name/title',
    },
    identifier: {
      type: 'string',
      optional: true,
      description: 'Epic identifier (e.g., PROJ-E1)',
    },
    description: {
      type: 'markdown',
      optional: true,
      description: 'Detailed epic description',
    },

    // Visual
    color: {
      type: 'string',
      optional: true,
      description: 'Epic color code',
    },
    icon: {
      type: 'string',
      optional: true,
      description: 'Epic icon/emoji',
    },

    // Status & Progress
    status: {
      type: 'string',
      description: 'Epic status: planned, active, completed, cancelled',
      examples: ['planned', 'active', 'completed', 'cancelled'],
    },
    progress: {
      type: 'number',
      optional: true,
      description: 'Overall completion percentage (0-100)',
    },

    // Timeline
    startDate: {
      type: 'date',
      optional: true,
      description: 'Epic start date',
    },
    targetDate: {
      type: 'date',
      optional: true,
      description: 'Target completion date',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the epic was completed',
    },

    // Metrics
    issueCount: {
      type: 'number',
      optional: true,
      description: 'Total number of issues in this epic',
    },
    completedIssueCount: {
      type: 'number',
      optional: true,
      description: 'Number of completed issues',
    },
    storyPoints: {
      type: 'number',
      optional: true,
      description: 'Total story points',
    },
    completedStoryPoints: {
      type: 'number',
      optional: true,
      description: 'Completed story points',
    },

    // Organization
    archived: {
      type: 'boolean',
      optional: true,
      description: 'Whether the epic is archived',
    },
  },

  relationships: {
    project: {
      type: 'Project',
      backref: 'epics',
      description: 'Project this epic belongs to',
    },
    issues: {
      type: 'Issue[]',
      backref: 'epic',
      description: 'Issues in this epic',
    },
    owner: {
      type: 'Contact',
      required: false,
      description: 'Person responsible for this epic',
    },
    labels: {
      type: 'Label[]',
      description: 'Labels applied to this epic',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'archive',
    'restore',
    'setStatus',
    'addIssue',
    'removeIssue',
    'setDates',
    'addLabel',
    'removeLabel',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'archived',
    'restored',
    'statusChanged',
    'issueAdded',
    'issueRemoved',
    'datesChanged',
    'labeled',
    'unlabeled',
    'completed',
    'cancelled',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All project management entity types
 */
export const ProjectManagementEntities = {
  Project,
  Issue,
  Sprint,
  Milestone,
  Board,
  Column,
  Label,
  Epic,
}

/**
 * Entity categories for organization
 */
export const ProjectManagementCategories = {
  core: ['Project', 'Issue', 'Epic'],
  planning: ['Sprint', 'Milestone'],
  visualization: ['Board', 'Column'],
  organization: ['Label'],
} as const
