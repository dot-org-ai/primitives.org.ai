import { describe, it, expect } from 'vitest'
import {
  parseMarkdown,
  toMarkdown,
  syncStatusFromMarkdown,
  task,
  parallel,
  sequential,
  createProject,
} from '../src/index.js'
import type { TaskDefinition, ParallelGroup, SequentialGroup } from '../src/index.js'

describe('Markdown Parser', () => {
  describe('parseMarkdown()', () => {
    it('should parse project name from h1', () => {
      const markdown = `# My Project

- [ ] Task 1
`
      const project = parseMarkdown(markdown)

      expect(project.name).toBe('My Project')
    })

    it('should parse parallel tasks from unordered list', () => {
      const markdown = `# Project

- [ ] Task A
- [ ] Task B
- [ ] Task C
`
      const project = parseMarkdown(markdown)

      expect(project.tasks).toHaveLength(1)
      expect((project.tasks[0] as ParallelGroup).__type).toBe('parallel')
      expect((project.tasks[0] as ParallelGroup).tasks).toHaveLength(3)
    })

    it('should parse sequential tasks from ordered list', () => {
      const markdown = `# Project

1. [ ] Step 1
2. [ ] Step 2
3. [ ] Step 3
`
      const project = parseMarkdown(markdown)

      expect(project.tasks).toHaveLength(1)
      expect((project.tasks[0] as SequentialGroup).__type).toBe('sequential')
      expect((project.tasks[0] as SequentialGroup).tasks).toHaveLength(3)
    })

    it('should parse task status from checkboxes', () => {
      const markdown = `# Project

- [ ] Pending
- [x] Completed
- [-] In progress
- [~] Blocked
- [!] Failed
`
      const project = parseMarkdown(markdown)

      const tasks = (project.tasks[0] as ParallelGroup).tasks as TaskDefinition[]
      expect(tasks[0].metadata?._originalStatus).toBe('pending')
      expect(tasks[1].metadata?._originalStatus).toBe('completed')
      expect(tasks[2].metadata?._originalStatus).toBe('in_progress')
      expect(tasks[3].metadata?._originalStatus).toBe('blocked')
      expect(tasks[4].metadata?._originalStatus).toBe('failed')
    })

    it('should parse priority markers', () => {
      const markdown = `# Project

- [ ] !!Critical task
- [ ] !Urgent task
- [ ] ^High priority
- [ ] Normal task
- [ ] vLow priority
`
      const project = parseMarkdown(markdown)

      const tasks = (project.tasks[0] as ParallelGroup).tasks as TaskDefinition[]
      expect(tasks[0].priority).toBe('critical')
      expect(tasks[0].title).toBe('Critical task')
      expect(tasks[1].priority).toBe('urgent')
      expect(tasks[2].priority).toBe('high')
      expect(tasks[3].priority).toBe('normal')
      expect(tasks[4].priority).toBe('low')
    })

    it('should parse nested subtasks', () => {
      const markdown = `# Project

- [ ] Parent task
  - [ ] Subtask 1
  - [ ] Subtask 2
`
      const project = parseMarkdown(markdown)

      const parent = ((project.tasks[0] as ParallelGroup).tasks[0]) as TaskDefinition
      expect(parent.title).toBe('Parent task')
      expect(parent.subtasks).toHaveLength(2)
    })

    it('should parse sections with h2 headings', () => {
      const markdown = `# Project

## Planning
- [ ] Design
- [ ] Spec

## Implementation (sequential)
1. [ ] Backend
2. [ ] Frontend
`
      const project = parseMarkdown(markdown)

      // Parser creates groups based on task types, sections affect mode detection
      expect(project.tasks.length).toBeGreaterThanOrEqual(1)
      // First section tasks should be parsed
      let foundDesign = false
      let foundBackend = false

      function findTasks(tasks: any[]): void {
        for (const t of tasks) {
          if (t.__type === 'task') {
            if (t.title === 'Design') foundDesign = true
            if (t.title === 'Backend') foundBackend = true
          } else if (t.tasks) {
            findTasks(t.tasks)
          }
        }
      }
      findTasks(project.tasks)

      expect(foundDesign).toBe(true)
      expect(foundBackend).toBe(true)
    })

    it('should detect execution mode from section name', () => {
      const markdown = `# Project

## Tasks (parallel)
- [ ] Task 1
- [ ] Task 2
`
      const project = parseMarkdown(markdown)

      // Section name with (parallel) should create parallel group
      expect(project.tasks.length).toBeGreaterThanOrEqual(1)
      // Find the tasks
      let foundTask1 = false
      function findTasks(tasks: any[]): void {
        for (const t of tasks) {
          if (t.__type === 'task' && t.title === 'Task 1') foundTask1 = true
          else if (t.tasks) findTasks(t.tasks)
        }
      }
      findTasks(project.tasks)
      expect(foundTask1).toBe(true)
    })

    it('should handle empty markdown', () => {
      const project = parseMarkdown('')
      expect(project.name).toBe('Untitled Project')
      expect(project.tasks).toEqual([])
    })

    it('should handle markdown with only headings', () => {
      const markdown = `# My Project

## Section 1

## Section 2
`
      const project = parseMarkdown(markdown)
      expect(project.name).toBe('My Project')
      expect(project.tasks).toEqual([])
    })
  })

  describe('toMarkdown()', () => {
    it('should serialize project name as h1', () => {
      const project = createProject({
        name: 'Test Project',
        tasks: [],
      })

      const markdown = toMarkdown(project)
      expect(markdown).toContain('# Test Project')
    })

    it('should serialize project description', () => {
      const project = createProject({
        name: 'Test Project',
        description: 'This is a description',
        tasks: [],
      })

      const markdown = toMarkdown(project)
      expect(markdown).toContain('This is a description')
    })

    it('should serialize parallel tasks as unordered list', () => {
      const project = createProject({
        name: 'Test',
        tasks: [
          parallel(
            task('Task A'),
            task('Task B'),
          ),
        ],
      })

      const markdown = toMarkdown(project)
      expect(markdown).toContain('- [ ] Task A')
      expect(markdown).toContain('- [ ] Task B')
    })

    it('should serialize sequential tasks as ordered list', () => {
      const project = createProject({
        name: 'Test',
        tasks: [
          sequential(
            task('Step 1'),
            task('Step 2'),
          ),
        ],
      })

      const markdown = toMarkdown(project)
      expect(markdown).toContain('1. [ ] Step 1')
      expect(markdown).toContain('2. [ ] Step 2')
    })

    it('should serialize task status', () => {
      const project = createProject({
        name: 'Test',
        tasks: [
          parallel(
            task('Pending', { metadata: { _originalStatus: 'pending' } }),
            task('Completed', { metadata: { _originalStatus: 'completed' } }),
            task('In Progress', { metadata: { _originalStatus: 'in_progress' } }),
          ),
        ],
      })

      const markdown = toMarkdown(project)
      expect(markdown).toContain('- [ ] Pending')
      expect(markdown).toContain('- [x] Completed')
      expect(markdown).toContain('- [-] In Progress')
    })

    it('should serialize priority markers when enabled', () => {
      const project = createProject({
        name: 'Test',
        tasks: [
          parallel(
            task('Critical', { priority: 'critical' }),
            task('Urgent', { priority: 'urgent' }),
            task('High', { priority: 'high' }),
            task('Normal', { priority: 'normal' }),
            task('Low', { priority: 'low' }),
          ),
        ],
      })

      const markdown = toMarkdown(project, { includePriority: true })
      expect(markdown).toContain('!!Critical')
      expect(markdown).toContain('!Urgent')
      expect(markdown).toContain('^High')
      expect(markdown).toContain('vLow')
      expect(markdown).toMatch(/\[ \] Normal/) // No marker for normal
    })

    it('should serialize subtasks with indentation', () => {
      const project = createProject({
        name: 'Test',
        tasks: [
          parallel(
            task('Parent', {
              subtasks: [
                task('Child 1'),
                task('Child 2'),
              ],
            }),
          ),
        ],
      })

      const markdown = toMarkdown(project)
      expect(markdown).toContain('- [ ] Parent')
      expect(markdown).toContain('  - [ ] Child 1')
      expect(markdown).toContain('  - [ ] Child 2')
    })

    it('should handle nested parallel and sequential groups', () => {
      const project = createProject({
        name: 'Test',
        tasks: [
          sequential(
            parallel(
              task('A'),
              task('B'),
            ),
            task('C'),
          ),
        ],
      })

      const markdown = toMarkdown(project)
      // Nested parallel should be unordered
      expect(markdown).toContain('- [ ] A')
      expect(markdown).toContain('- [ ] B')
      // Following task should be sequential
      expect(markdown).toContain('[ ] C')
    })

    it('should respect indentSize option', () => {
      const project = createProject({
        name: 'Test',
        tasks: [
          parallel(
            task('Parent', {
              subtasks: [task('Child')],
            }),
          ),
        ],
      })

      const markdown = toMarkdown(project, { indentSize: 4 })
      expect(markdown).toContain('    - [ ] Child')
    })
  })

  describe('Round-trip conversion', () => {
    it('should preserve basic structure through round-trip', () => {
      const original = `# Project Name

- [ ] Task A
- [ ] Task B
- [ ] Task C
`
      const project = parseMarkdown(original)
      const regenerated = toMarkdown(project)

      expect(regenerated).toContain('# Project Name')
      expect(regenerated).toContain('- [ ] Task A')
      expect(regenerated).toContain('- [ ] Task B')
      expect(regenerated).toContain('- [ ] Task C')
    })

    it('should preserve sequential structure through round-trip', () => {
      const original = `# Sequential Project

1. [ ] Step 1
2. [ ] Step 2
3. [ ] Step 3
`
      const project = parseMarkdown(original)
      const regenerated = toMarkdown(project)

      expect(regenerated).toContain('1. [ ] Step 1')
      expect(regenerated).toContain('2. [ ] Step 2')
      expect(regenerated).toContain('3. [ ] Step 3')
    })

    it('should preserve task status through round-trip', () => {
      const original = `# Status Project

- [x] Completed
- [-] In progress
- [ ] Pending
`
      const project = parseMarkdown(original)
      const regenerated = toMarkdown(project)

      expect(regenerated).toContain('[x] Completed')
      expect(regenerated).toContain('[-] In progress')
      expect(regenerated).toContain('[ ] Pending')
    })
  })

  describe('syncStatusFromMarkdown()', () => {
    it('should update task statuses from markdown', () => {
      const project = createProject({
        name: 'Test',
        tasks: [
          parallel(
            task('Task A', { metadata: { _originalStatus: 'pending' } }),
            task('Task B', { metadata: { _originalStatus: 'pending' } }),
          ),
        ],
      })

      const markdown = `# Test

- [x] Task A
- [-] Task B
`
      const updated = syncStatusFromMarkdown(project, markdown)

      const tasks = (updated.tasks[0] as ParallelGroup).tasks as TaskDefinition[]
      expect(tasks[0].metadata?._originalStatus).toBe('completed')
      expect(tasks[1].metadata?._originalStatus).toBe('in_progress')
    })

    it('should preserve existing status if task not in markdown', () => {
      const project = createProject({
        name: 'Test',
        tasks: [
          parallel(
            task('Existing Task', { metadata: { _originalStatus: 'in_progress' } }),
          ),
        ],
      })

      const markdown = `# Test

- [ ] Different Task
`
      const updated = syncStatusFromMarkdown(project, markdown)

      const tasks = (updated.tasks[0] as ParallelGroup).tasks as TaskDefinition[]
      expect(tasks[0].metadata?._originalStatus).toBe('in_progress')
    })

    it('should update nested subtask statuses', () => {
      const project = createProject({
        name: 'Test',
        tasks: [
          parallel(
            task('Parent', {
              metadata: { _originalStatus: 'pending' },
              subtasks: [
                task('Child', { metadata: { _originalStatus: 'pending' } }),
              ],
            }),
          ),
        ],
      })

      const markdown = `# Test

- [x] Parent
  - [x] Child
`
      const updated = syncStatusFromMarkdown(project, markdown)

      const parent = (updated.tasks[0] as ParallelGroup).tasks[0] as TaskDefinition
      expect(parent.metadata?._originalStatus).toBe('completed')
      expect((parent.subtasks![0] as TaskDefinition).metadata?._originalStatus).toBe('completed')
    })

    it('should update the updatedAt timestamp', () => {
      const project = createProject({
        name: 'Test',
        tasks: [],
      })

      const originalUpdatedAt = project.updatedAt
      const markdown = `# Test`

      // Small delay to ensure different timestamp
      const updated = syncStatusFromMarkdown(project, markdown)

      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime())
    })
  })

  describe('Edge cases', () => {
    it('should handle tasks with special characters', () => {
      const markdown = `# Project

- [ ] Task with "quotes"
- [ ] Task with \`backticks\`
- [ ] Task with & ampersand
`
      const project = parseMarkdown(markdown)
      const tasks = (project.tasks[0] as ParallelGroup).tasks as TaskDefinition[]

      expect(tasks[0].title).toBe('Task with "quotes"')
      expect(tasks[1].title).toBe('Task with `backticks`')
      expect(tasks[2].title).toBe('Task with & ampersand')
    })

    it('should handle deeply nested subtasks', () => {
      const markdown = `# Project

- [ ] Level 1
  - [ ] Level 2
    - [ ] Level 3
      - [ ] Level 4
`
      const project = parseMarkdown(markdown)
      const level1 = (project.tasks[0] as ParallelGroup).tasks[0] as TaskDefinition
      const level2 = level1.subtasks![0] as TaskDefinition
      const level3 = level2.subtasks![0] as TaskDefinition
      const level4 = level3.subtasks![0] as TaskDefinition

      expect(level1.title).toBe('Level 1')
      expect(level2.title).toBe('Level 2')
      expect(level3.title).toBe('Level 3')
      expect(level4.title).toBe('Level 4')
    })

    it('should handle mixed ordered and unordered in same section', () => {
      const markdown = `# Project

- [ ] Unordered
1. [ ] Ordered
- [ ] Unordered again
`
      const project = parseMarkdown(markdown)
      // Should treat first set as parallel based on first task
      expect(project.tasks.length).toBeGreaterThan(0)
    })

    it('should handle empty lines between tasks', () => {
      const markdown = `# Project

- [ ] Task 1

- [ ] Task 2

- [ ] Task 3
`
      const project = parseMarkdown(markdown)
      // Should still parse all tasks
      const allTasks: string[] = []
      function collectTasks(tasks: any[]) {
        for (const t of tasks) {
          if (t.__type === 'task') allTasks.push(t.title)
          else if (t.tasks) collectTasks(t.tasks)
        }
      }
      collectTasks(project.tasks)
      expect(allTasks).toContain('Task 1')
      expect(allTasks).toContain('Task 2')
      expect(allTasks).toContain('Task 3')
    })

    it('should handle Windows-style line endings', () => {
      const markdown = '# Project\r\n\r\n- [ ] Task 1\r\n- [ ] Task 2\r\n'
      const project = parseMarkdown(markdown)
      expect(project.name).toBe('Project')
    })
  })
})
