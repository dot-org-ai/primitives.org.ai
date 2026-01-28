/**
 * Markdown Task List Parser and Serializer
 *
 * Bidirectional conversion between markdown task lists and Task objects.
 *
 * ## Syntax
 *
 * - `- [ ]` = Unordered/parallel tasks (can run simultaneously)
 * - `1. [ ]` = Ordered/sequential tasks (must run in order)
 * - `- [x]` or `1. [x]` = Completed task
 * - `- [-]` = In progress task
 * - `- [~]` = Blocked task
 * - `- [!]` = Failed task
 * - Indentation (2 spaces) = Subtasks
 * - `# Heading` = Project name
 * - `## Heading` = Task group/section
 *
 * ## Example
 *
 * ```markdown
 * # Launch Feature
 *
 * ## Planning (parallel)
 * - [ ] Design mockups
 * - [ ] Write technical spec
 * - [x] Create project board
 *
 * ## Implementation (sequential)
 * 1. [ ] Implement backend API
 * 2. [-] Implement frontend UI
 *    - [ ] Create components
 *    - [ ] Add state management
 * 3. [ ] Write tests
 *
 * ## Deployment
 * 1. [ ] Deploy to staging
 * 2. [ ] QA testing
 * 3. [ ] Deploy to production
 * ```
 *
 * @packageDocumentation
 */

import type { TaskStatus, TaskPriority } from './types.js'
import type {
  Project,
  TaskNode,
  TaskDefinition,
  ParallelGroup,
  SequentialGroup,
  ExecutionMode,
  CreateProjectOptions,
} from './project.js'
import { task, parallel, sequential, createProject } from './project.js'

// ============================================================================
// Status Markers
// ============================================================================

/**
 * Markdown checkbox markers and their task status
 */
const STATUS_MARKERS: Record<string, TaskStatus> = {
  ' ': 'pending',
  x: 'completed',
  X: 'completed',
  '-': 'in_progress',
  '~': 'blocked',
  '!': 'failed',
  '/': 'cancelled',
  '?': 'review',
}

/**
 * Reverse mapping: task status to marker
 */
const STATUS_TO_MARKER: Record<TaskStatus, string> = {
  pending: ' ',
  queued: ' ',
  assigned: '-',
  in_progress: '-',
  blocked: '~',
  review: '?',
  completed: 'x',
  failed: '!',
  cancelled: '/',
}

/**
 * Priority markers (can be added after checkbox)
 */
const PRIORITY_MARKERS: Record<string, TaskPriority> = {
  '!!': 'critical',
  '!': 'urgent',
  '^': 'high',
  '': 'normal',
  v: 'low',
}

// ============================================================================
// Parser Types
// ============================================================================

interface ParsedLine {
  indent: number
  isTask: boolean
  isOrdered: boolean
  orderNumber?: number
  status?: TaskStatus
  priority?: TaskPriority
  title: string
  isHeading: boolean
  headingLevel?: number
  raw: string
}

interface ParseContext {
  lines: ParsedLine[]
  index: number
  projectName?: string
  sections: Array<{
    name: string
    mode: ExecutionMode
    tasks: TaskNode[]
  }>
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Parse a single line of markdown
 */
function parseLine(line: string): ParsedLine {
  const raw = line

  // Count leading spaces for indent (2 spaces = 1 level)
  const leadingSpacesMatch = line.match(/^(\s*)/)
  const leadingSpaces = leadingSpacesMatch?.[1]?.length ?? 0
  const indent = Math.floor(leadingSpaces / 2)
  const trimmed = line.slice(leadingSpaces)

  // Check for heading
  const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
  if (headingMatch) {
    const matchedHashes = headingMatch[1]!
    const matchedTitle = headingMatch[2]!
    return {
      indent,
      isTask: false,
      isOrdered: false,
      title: matchedTitle.trim(),
      isHeading: true,
      headingLevel: matchedHashes.length,
      raw,
    }
  }

  // Check for unordered task: - [ ] or - [x] etc.
  const unorderedMatch = trimmed.match(/^[-*]\s+\[([^\]]*)\]\s*(.*)$/)
  if (unorderedMatch) {
    const marker = unorderedMatch[1]!
    let title = unorderedMatch[2]!.trim()
    let priority: TaskPriority = 'normal'

    // Check for priority marker at start of title
    if (title.startsWith('!!')) {
      priority = 'critical'
      title = title.slice(2).trim()
    } else if (title.startsWith('!')) {
      priority = 'urgent'
      title = title.slice(1).trim()
    } else if (title.startsWith('^')) {
      priority = 'high'
      title = title.slice(1).trim()
    } else if (title.startsWith('v')) {
      priority = 'low'
      title = title.slice(1).trim()
    }

    return {
      indent,
      isTask: true,
      isOrdered: false,
      status: STATUS_MARKERS[marker] ?? 'pending',
      priority,
      title,
      isHeading: false,
      raw,
    }
  }

  // Check for ordered task: 1. [ ] or 1. [x] etc.
  const orderedMatch = trimmed.match(/^(\d+)\.\s+\[([^\]]*)\]\s*(.*)$/)
  if (orderedMatch) {
    const orderNum = orderedMatch[1]!
    const marker = orderedMatch[2]!
    let title = orderedMatch[3]!.trim()
    let priority: TaskPriority = 'normal'

    // Check for priority marker
    if (title.startsWith('!!')) {
      priority = 'critical'
      title = title.slice(2).trim()
    } else if (title.startsWith('!')) {
      priority = 'urgent'
      title = title.slice(1).trim()
    } else if (title.startsWith('^')) {
      priority = 'high'
      title = title.slice(1).trim()
    } else if (title.startsWith('v')) {
      priority = 'low'
      title = title.slice(1).trim()
    }

    return {
      indent,
      isTask: true,
      isOrdered: true,
      orderNumber: parseInt(orderNum, 10),
      status: STATUS_MARKERS[marker] ?? 'pending',
      priority,
      title,
      isHeading: false,
      raw,
    }
  }

  // Plain text line
  return {
    indent,
    isTask: false,
    isOrdered: false,
    title: trimmed,
    isHeading: false,
    raw,
  }
}

/**
 * Parse tasks at a specific indent level
 */
function parseTasksAtIndent(
  lines: ParsedLine[],
  startIndex: number,
  baseIndent: number
): { tasks: TaskNode[]; nextIndex: number; mode: ExecutionMode } {
  const tasks: TaskNode[] = []
  let index = startIndex
  let mode: ExecutionMode = 'parallel' // Default based on first task type
  let modeSet = false

  while (index < lines.length) {
    const line = lines[index]!

    // Stop if we've gone back to a lower indent level
    if (line.indent < baseIndent && (line.isTask || line.isHeading)) {
      break
    }

    // Skip lines at lower indent (they belong to parent)
    if (line.indent < baseIndent) {
      index++
      continue
    }

    // Process tasks at our indent level
    if (line.indent === baseIndent && line.isTask) {
      // Set mode based on first task
      if (!modeSet) {
        mode = line.isOrdered ? 'sequential' : 'parallel'
        modeSet = true
      }

      // Parse subtasks
      const { tasks: subtasks, nextIndex } = parseTasksAtIndent(lines, index + 1, baseIndent + 1)

      const taskOptions: Partial<Omit<TaskDefinition, '__type' | 'title'>> = {
        metadata: {
          _originalStatus: line.status,
          _lineNumber: index,
        },
      }
      if (line.priority !== undefined) {
        taskOptions.priority = line.priority
      }
      if (subtasks.length > 0) {
        taskOptions.subtasks = subtasks
      }
      const taskDef = task(line.title, taskOptions)

      tasks.push(taskDef)
      index = nextIndex
    } else {
      index++
    }
  }

  return { tasks, nextIndex: index, mode }
}

/**
 * Parse a markdown string into a Project
 *
 * @example
 * ```ts
 * const markdown = `
 * # My Project
 *
 * - [ ] Task 1
 * - [ ] Task 2
 *
 * ## Sequential Work
 * 1. [ ] Step 1
 * 2. [ ] Step 2
 * `
 *
 * const project = parseMarkdown(markdown)
 * ```
 */
export function parseMarkdown(markdown: string): Project {
  // Normalize line endings (handle Windows \r\n and old Mac \r)
  const normalizedMarkdown = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rawLines = normalizedMarkdown.split('\n')
  const lines = rawLines.map(parseLine)

  let projectName = 'Untitled Project'
  let projectDescription: string | undefined
  const allTasks: TaskNode[] = []

  // Find project name from first h1
  const h1Index = lines.findIndex((l) => l.isHeading && l.headingLevel === 1)
  if (h1Index !== -1) {
    projectName = lines[h1Index]!.title
  }

  // Process sections and tasks
  let currentSection: { name: string; mode: ExecutionMode; tasks: TaskNode[] } | null = null
  let index = 0

  while (index < lines.length) {
    const line = lines[index]!

    // New section (h2)
    if (line.isHeading && line.headingLevel === 2) {
      // Save previous section
      if (currentSection && currentSection.tasks.length > 0) {
        if (currentSection.mode === 'sequential') {
          allTasks.push(sequential(...currentSection.tasks))
        } else {
          allTasks.push(parallel(...currentSection.tasks))
        }
      }

      // Detect mode from section name (e.g., "## Implementation (sequential)")
      let sectionName = line.title
      let sectionMode: ExecutionMode = 'parallel'

      const modeMatch = sectionName.match(/\((parallel|sequential)\)\s*$/i)
      if (modeMatch) {
        sectionMode = modeMatch[1]!.toLowerCase() as ExecutionMode
        sectionName = sectionName.replace(/\s*\((parallel|sequential)\)\s*$/i, '')
      }

      currentSection = { name: sectionName, mode: sectionMode, tasks: [] }
      index++
      continue
    }

    // Task at root level or in section
    if (line.isTask && line.indent === 0) {
      const { tasks, nextIndex, mode } = parseTasksAtIndent(lines, index, 0)

      if (currentSection) {
        currentSection.tasks.push(...tasks)
        // Update section mode based on first task if not explicitly set
        if (currentSection.tasks.length === tasks.length) {
          currentSection.mode = mode
        }
      } else {
        // No section, add to root with appropriate grouping
        if (mode === 'sequential') {
          allTasks.push(sequential(...tasks))
        } else {
          allTasks.push(parallel(...tasks))
        }
      }
      index = nextIndex
      continue
    }

    index++
  }

  // Add final section
  if (currentSection && currentSection.tasks.length > 0) {
    if (currentSection.mode === 'sequential') {
      allTasks.push(sequential(...currentSection.tasks))
    } else {
      allTasks.push(parallel(...currentSection.tasks))
    }
  }

  const projectOptions: CreateProjectOptions = {
    name: projectName,
    tasks: allTasks,
  }
  if (projectDescription !== undefined) {
    projectOptions.description = projectDescription
  }

  return createProject(projectOptions)
}

// ============================================================================
// Serializer
// ============================================================================

/**
 * Options for markdown serialization
 */
export interface SerializeOptions {
  /** Include status markers (default: true) */
  includeStatus?: boolean
  /** Include priority markers (default: false) */
  includePriority?: boolean
  /** Indent size in spaces (default: 2) */
  indentSize?: number
  /** Include section headings (default: true) */
  includeSections?: boolean
}

/**
 * Serialize a task node to markdown lines
 */
function serializeTaskNode(
  node: TaskNode,
  indent: number,
  options: SerializeOptions,
  isSequential: boolean
): string[] {
  const lines: string[] = []
  const indentStr = ' '.repeat(indent * (options.indentSize || 2))

  if (node.__type === 'task') {
    const taskDef = node as TaskDefinition
    const status = (taskDef.metadata?.['_originalStatus'] as TaskStatus) || 'pending'
    const marker = options.includeStatus !== false ? STATUS_TO_MARKER[status] : ' '

    let prefix: string
    if (isSequential) {
      // Use numbered list for sequential
      const num = (taskDef.metadata?.['_sequenceNumber'] as number) || 1
      prefix = `${num}. [${marker}]`
    } else {
      // Use bullet for parallel
      prefix = `- [${marker}]`
    }

    let title = taskDef.title
    if (options.includePriority && taskDef.priority && taskDef.priority !== 'normal') {
      const priorityMarker =
        taskDef.priority === 'critical'
          ? '!!'
          : taskDef.priority === 'urgent'
          ? '!'
          : taskDef.priority === 'high'
          ? '^'
          : taskDef.priority === 'low'
          ? 'v'
          : ''
      title = `${priorityMarker}${title}`
    }

    lines.push(`${indentStr}${prefix} ${title}`)

    // Serialize subtasks
    if (taskDef.subtasks && taskDef.subtasks.length > 0) {
      for (const subtask of taskDef.subtasks) {
        lines.push(...serializeTaskNode(subtask, indent + 1, options, false))
      }
    }
  } else if (node.__type === 'parallel') {
    const group = node as ParallelGroup
    let seqNum = 1
    for (const child of group.tasks) {
      if (child.__type === 'task') {
        ;(child as TaskDefinition).metadata = {
          ...(child as TaskDefinition).metadata,
          _sequenceNumber: seqNum++,
        }
      }
      lines.push(...serializeTaskNode(child, indent, options, false))
    }
  } else if (node.__type === 'sequential') {
    const group = node as SequentialGroup
    let seqNum = 1
    for (const child of group.tasks) {
      if (child.__type === 'task') {
        ;(child as TaskDefinition).metadata = {
          ...(child as TaskDefinition).metadata,
          _sequenceNumber: seqNum++,
        }
      }
      lines.push(...serializeTaskNode(child, indent, options, true))
    }
  }

  return lines
}

/**
 * Serialize a Project to markdown
 *
 * @example
 * ```ts
 * const project = createProject({
 *   name: 'My Project',
 *   tasks: [
 *     parallel(
 *       task('Task 1'),
 *       task('Task 2'),
 *     ),
 *     sequential(
 *       task('Step 1'),
 *       task('Step 2'),
 *     ),
 *   ],
 * })
 *
 * const markdown = toMarkdown(project)
 * // # My Project
 * //
 * // - [ ] Task 1
 * // - [ ] Task 2
 * //
 * // 1. [ ] Step 1
 * // 2. [ ] Step 2
 * ```
 */
export function toMarkdown(project: Project, options: SerializeOptions = {}): string {
  const lines: string[] = []

  // Project title
  lines.push(`# ${project.name}`)
  lines.push('')

  if (project.description) {
    lines.push(project.description)
    lines.push('')
  }

  // Tasks
  for (const node of project.tasks) {
    const taskLines = serializeTaskNode(node, 0, options, false)
    lines.push(...taskLines)

    // Add blank line between top-level groups
    if (taskLines.length > 0) {
      lines.push('')
    }
  }

  return lines.join('\n').trim() + '\n'
}

// ============================================================================
// Conversion Utilities
// ============================================================================

/**
 * Update task statuses in a project from markdown
 * (Useful for syncing when markdown is edited externally)
 */
export function syncStatusFromMarkdown(project: Project, markdown: string): Project {
  const parsed = parseMarkdown(markdown)

  // Build a map of task titles to statuses from parsed markdown
  const statusMap = new Map<string, TaskStatus>()

  function collectStatuses(node: TaskNode) {
    if (node.__type === 'task') {
      const taskDef = node as TaskDefinition
      const status = taskDef.metadata?.['_originalStatus'] as TaskStatus
      if (status) {
        statusMap.set(taskDef.title, status)
      }
      if (taskDef.subtasks) {
        taskDef.subtasks.forEach(collectStatuses)
      }
    } else if (node.__type === 'parallel' || node.__type === 'sequential') {
      const group = node as ParallelGroup | SequentialGroup
      group.tasks.forEach(collectStatuses)
    }
  }

  parsed.tasks.forEach(collectStatuses)

  // Update statuses in original project
  function updateStatuses(node: TaskNode): TaskNode {
    if (node.__type === 'task') {
      const taskDef = node as TaskDefinition
      const newStatus = statusMap.get(taskDef.title)
      const result: TaskDefinition = {
        ...taskDef,
        metadata: {
          ...taskDef.metadata,
          _originalStatus: newStatus || taskDef.metadata?.['_originalStatus'],
        },
      }
      if (taskDef.subtasks) {
        result.subtasks = taskDef.subtasks.map(updateStatuses)
      }
      return result
    } else if (node.__type === 'parallel') {
      const group = node as ParallelGroup
      return {
        ...group,
        tasks: group.tasks.map(updateStatuses),
      }
    } else if (node.__type === 'sequential') {
      const group = node as SequentialGroup
      return {
        ...group,
        tasks: group.tasks.map(updateStatuses),
      }
    }
    return node
  }

  return {
    ...project,
    tasks: project.tasks.map(updateStatuses),
    updatedAt: new Date(),
  }
}
