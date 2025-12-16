import type { Noun } from 'ai-database'

/**
 * Planning Entities
 * Issue, Plan - Planning-focused abstractions for tracking work
 *
 * These complement the execution-focused Task in digital-tasks
 * and the project management entities in projects.ts
 *
 * Key distinction:
 * - Task (digital-tasks): Function execution with workers, queues, runtime
 * - Task (projects.ts): Project management work item
 * - Issue (planning.ts): Planning-focused with design, acceptance criteria, notes
 */

/**
 * WorkItem - A planning-focused work item (ticket/issue)
 *
 * Models the full lifecycle of work from ideation through completion:
 * - What: title, description
 * - Why: context, business value
 * - How: design (implementation approach)
 * - Done: acceptance criteria
 * - Context: notes (session handoff, progress tracking)
 *
 * This abstraction is backend-agnostic and can be implemented by:
 * - beads (SQLite) - maps to beads Issue
 * - Linear - maps to Linear Issue
 * - GitHub Issues
 * - Jira - maps to Jira Issue/Ticket
 * - etc.
 *
 * Note: Distinct from entities/risk.ts Issue which represents
 * operational/business issues (problems requiring resolution).
 * WorkItem represents planned development work.
 */
export const WorkItem: Noun = {
  singular: 'workItem',
  plural: 'workItems',
  description: 'A planning-focused work item with design and acceptance criteria',
  properties: {
    // Identity
    id: { type: 'string', description: 'Unique issue ID' },
    title: { type: 'string', description: 'Issue title (concise, action-oriented)' },

    // What & Why
    description: { type: 'string', description: 'Problem statement - WHY this matters (immutable once set)' },

    // How
    design: { type: 'string', description: 'Implementation approach - HOW to build (can evolve during work)' },

    // Done
    acceptanceCriteria: { type: 'string', description: 'Definition of done - WHAT success looks like (markdown checklist)' },

    // Context
    notes: { type: 'string', description: 'Session context - COMPLETED/IN_PROGRESS/NEXT format for handoff' },

    // Status
    status: {
      type: 'string',
      description: 'Issue status',
      examples: ['open', 'in_progress', 'blocked', 'closed'],
    },
    priority: {
      type: 'number',
      description: 'Priority level (0=critical, 1=high, 2=normal, 3=low)',
    },
    issueType: {
      type: 'string',
      description: 'Type of issue',
      examples: ['task', 'bug', 'feature', 'epic', 'chore'],
    },

    // Assignment
    assignee: { type: 'string', description: 'Assigned person or agent', optional: true },

    // Timing
    createdAt: { type: 'datetime', description: 'When created' },
    updatedAt: { type: 'datetime', description: 'When last updated' },
    closedAt: { type: 'datetime', description: 'When closed', optional: true },
    closeReason: { type: 'string', description: 'Why issue was closed', optional: true },

    // Estimation
    estimatedMinutes: { type: 'number', description: 'Estimated time in minutes', optional: true },

    // External references
    externalRef: { type: 'string', description: 'External system reference (PR, commit, etc.)', optional: true },

    // Compaction (for long-running issues)
    compactionLevel: { type: 'number', description: 'How many times compressed', optional: true },

    // Metadata
    labels: { type: 'string[]', description: 'Issue labels/tags' },
    metadata: { type: 'object', description: 'Additional metadata', optional: true },
  },
  relationships: {
    // Hierarchy
    parent: { type: 'workItem', description: 'Parent work item (for epics)', backref: 'children' },
    children: { type: 'workItem[]', description: 'Child work items', backref: 'parent' },

    // Dependencies
    blockedBy: { type: 'workItem[]', description: 'Work items blocking this one', backref: 'blocks' },
    blocks: { type: 'workItem[]', description: 'Work items this one blocks', backref: 'blockedBy' },
    relatedTo: { type: 'workItem[]', description: 'Related work items (soft link)', backref: 'relatedTo' },
    discoveredFrom: { type: 'workItem', description: 'Work item this was discovered from (provenance)', backref: 'discovered' },
    discovered: { type: 'workItem[]', description: 'Work items discovered while working on this', backref: 'discoveredFrom' },

    // Project context
    project: { type: 'project', description: 'Parent project', backref: 'workItems' },

    // Plan context
    plan: { type: 'plan', description: 'Parent plan', backref: 'workItems' },

    // Comments
    comments: { type: 'comment[]', description: 'Work item comments', backref: 'workItem' },

    // Events
    events: { type: 'event[]', description: 'Work item events (audit trail)', backref: 'workItem' },
  },
  actions: [
    'create',
    'update',
    'assign',
    'start',
    'block',
    'unblock',
    'close',
    'reopen',
    'comment',
    'link',
    'unlink',
  ],
  events: [
    'created',
    'updated',
    'assigned',
    'started',
    'blocked',
    'unblocked',
    'closed',
    'reopened',
    'commented',
    'linked',
    'unlinked',
  ],
}

/**
 * Comment - A comment on an issue
 */
export const Comment: Noun = {
  singular: 'comment',
  plural: 'comments',
  description: 'A comment on an issue',
  properties: {
    id: { type: 'string', description: 'Comment ID' },
    text: { type: 'string', description: 'Comment text (markdown)' },
    author: { type: 'string', description: 'Comment author' },
    createdAt: { type: 'datetime', description: 'When created' },
  },
  relationships: {
    workItem: { type: 'workItem', description: 'Parent work item', backref: 'comments', required: true },
  },
  actions: ['create', 'update', 'delete'],
  events: ['created', 'updated', 'deleted'],
}

/**
 * Event - An audit trail event on an issue
 */
export const Event: Noun = {
  singular: 'event',
  plural: 'events',
  description: 'An audit trail event for issue changes',
  properties: {
    id: { type: 'string', description: 'Event ID' },
    eventType: {
      type: 'string',
      description: 'Type of event',
      examples: [
        'created',
        'status_changed',
        'priority_changed',
        'assigned',
        'unassigned',
        'dependency_added',
        'dependency_removed',
        'label_added',
        'label_removed',
        'commented',
      ],
    },
    actor: { type: 'string', description: 'Who triggered the event' },
    oldValue: { type: 'string', description: 'Previous value', optional: true },
    newValue: { type: 'string', description: 'New value', optional: true },
    comment: { type: 'string', description: 'Optional comment on the change', optional: true },
    createdAt: { type: 'datetime', description: 'When event occurred' },
  },
  relationships: {
    workItem: { type: 'workItem', description: 'Parent work item', backref: 'events', required: true },
  },
  actions: ['create'],
  events: ['created'],
}

/**
 * WorkItemComment - Alias for Comment (for clarity)
 */
export const WorkItemComment = Comment

/**
 * WorkItemEvent - Alias for Event (for clarity)
 */
export const WorkItemEvent = Event

/**
 * Plan - A high-level planning document that generates issues
 *
 * Bridges Strategy → Plan → Issues → Tasks
 *
 * A Plan captures:
 * - Goals and objectives
 * - Constraints and assumptions
 * - Design decisions
 * - Issue breakdown
 */
export const Plan: Noun = {
  singular: 'plan',
  plural: 'plans',
  description: 'A high-level planning document that generates issues',
  properties: {
    id: { type: 'string', description: 'Plan ID' },
    title: { type: 'string', description: 'Plan title' },
    description: { type: 'string', description: 'What this plan aims to achieve' },

    // Goals
    objectives: { type: 'string[]', description: 'Plan objectives' },
    successCriteria: { type: 'string[]', description: 'How we know the plan succeeded' },

    // Constraints
    constraints: { type: 'string[]', description: 'Constraints to work within' },
    assumptions: { type: 'string[]', description: 'Assumptions made' },
    risks: { type: 'string[]', description: 'Identified risks' },

    // Design
    approach: { type: 'string', description: 'Overall approach (markdown)' },
    decisions: { type: 'string[]', description: 'Key decisions made' },
    tradeoffs: { type: 'string[]', description: 'Trade-offs considered' },

    // Status
    status: {
      type: 'string',
      description: 'Plan status',
      examples: ['draft', 'review', 'approved', 'in_progress', 'completed', 'abandoned'],
    },

    // Timing
    createdAt: { type: 'datetime', description: 'When created' },
    updatedAt: { type: 'datetime', description: 'When last updated' },
    approvedAt: { type: 'datetime', description: 'When approved', optional: true },
    approvedBy: { type: 'string', description: 'Who approved', optional: true },

    // Metadata
    tags: { type: 'string[]', description: 'Plan tags' },
    metadata: { type: 'object', description: 'Additional metadata', optional: true },
  },
  relationships: {
    // Work items generated from this plan
    workItems: { type: 'workItem[]', description: 'Work items generated from this plan', backref: 'plan' },

    // Project context
    project: { type: 'project', description: 'Parent project', backref: 'plans' },

    // Author
    author: { type: 'resource', description: 'Plan author', backref: 'plans' },
  },
  actions: ['create', 'update', 'submit', 'approve', 'reject', 'start', 'complete', 'abandon'],
  events: ['created', 'updated', 'submitted', 'approved', 'rejected', 'started', 'completed', 'abandoned'],
}

/**
 * Dependency types for issue relationships
 */
export const DependencyTypes = {
  /** Hard blocker - issue A blocks issue B from starting */
  blocks: 'blocks',
  /** Soft link - issues are related but not blocking */
  related: 'related',
  /** Hierarchical - epic/subtask relationship */
  parentChild: 'parent-child',
  /** Provenance - issue B discovered while working on A */
  discoveredFrom: 'discovered-from',
} as const

export type DependencyType = (typeof DependencyTypes)[keyof typeof DependencyTypes]

// Export all planning entities
export const PlanningEntities = {
  WorkItem,
  WorkItemComment,
  WorkItemEvent,
  Comment,
  Event,
  Plan,
}

export default PlanningEntities
