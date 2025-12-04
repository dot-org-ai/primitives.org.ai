import { describe, it, expect } from 'vitest'
import {
  task,
  parallel,
  sequential,
  createProject,
  workflow,
  materializeProject,
  getDependants,
  getDependencies,
  getReadyTasks,
  hasCycles,
  sortTasks,
} from '../src/index.js'
import type { AnyTask, TaskDefinition, ParallelGroup, SequentialGroup } from '../src/index.js'

describe('Project DSL', () => {
  describe('task()', () => {
    it('should create a task definition', () => {
      const t = task('Implement feature')

      expect(t.__type).toBe('task')
      expect(t.title).toBe('Implement feature')
    })

    it('should create a task with options', () => {
      const t = task('Review PR', {
        priority: 'high',
        description: 'Review the pull request',
        tags: ['review', 'urgent'],
      })

      expect(t.title).toBe('Review PR')
      expect(t.priority).toBe('high')
      expect(t.description).toBe('Review the pull request')
      expect(t.tags).toEqual(['review', 'urgent'])
    })

    it('should create a task with subtasks', () => {
      const t = task('Parent task', {
        subtasks: [
          task('Subtask 1'),
          task('Subtask 2'),
        ],
      })

      expect(t.subtasks).toHaveLength(2)
      expect((t.subtasks![0] as TaskDefinition).title).toBe('Subtask 1')
    })

    it('should create a task with function type', () => {
      const t = task('Human review', {
        functionType: 'human',
      })

      expect(t.functionType).toBe('human')
    })
  })

  describe('parallel()', () => {
    it('should create a parallel group', () => {
      const group = parallel(
        task('Task A'),
        task('Task B'),
        task('Task C'),
      )

      expect(group.__type).toBe('parallel')
      expect(group.tasks).toHaveLength(3)
    })

    it('should support nested groups', () => {
      const group = parallel(
        task('Task A'),
        sequential(
          task('Step 1'),
          task('Step 2'),
        ),
      )

      expect(group.tasks).toHaveLength(2)
      expect((group.tasks[1] as SequentialGroup).__type).toBe('sequential')
    })
  })

  describe('sequential()', () => {
    it('should create a sequential group', () => {
      const group = sequential(
        task('Step 1'),
        task('Step 2'),
        task('Step 3'),
      )

      expect(group.__type).toBe('sequential')
      expect(group.tasks).toHaveLength(3)
    })

    it('should support nested groups', () => {
      const group = sequential(
        task('Setup'),
        parallel(
          task('Build frontend'),
          task('Build backend'),
        ),
        task('Deploy'),
      )

      expect(group.tasks).toHaveLength(3)
      expect((group.tasks[1] as ParallelGroup).__type).toBe('parallel')
    })
  })

  describe('createProject()', () => {
    it('should create a project with basic options', () => {
      const project = createProject({
        name: 'My Project',
        description: 'Project description',
      })

      expect(project.id).toMatch(/^proj_/)
      expect(project.name).toBe('My Project')
      expect(project.description).toBe('Project description')
      expect(project.status).toBe('draft')
      expect(project.tasks).toEqual([])
      expect(project.createdAt).toBeInstanceOf(Date)
    })

    it('should create a project with tasks', () => {
      const project = createProject({
        name: 'Feature Launch',
        tasks: [
          parallel(
            task('Design mockups'),
            task('Write technical spec'),
          ),
          sequential(
            task('Implement backend'),
            task('Implement frontend'),
            task('Write tests'),
          ),
        ],
      })

      expect(project.tasks).toHaveLength(2)
      expect((project.tasks[0] as ParallelGroup).__type).toBe('parallel')
      expect((project.tasks[1] as SequentialGroup).__type).toBe('sequential')
    })

    it('should set default execution mode', () => {
      const project = createProject({
        name: 'Test Project',
        defaultMode: 'parallel',
      })

      expect(project.defaultMode).toBe('parallel')
    })

    it('should set owner', () => {
      const project = createProject({
        name: 'Test Project',
        owner: { type: 'human', id: 'user_1', name: 'John' },
      })

      expect(project.owner?.id).toBe('user_1')
    })
  })

  describe('workflow()', () => {
    it('should create a workflow builder', () => {
      const wf = workflow('My Workflow')
      expect(wf).toBeDefined()
      expect(wf.parallel).toBeDefined()
      expect(wf.sequential).toBeDefined()
      expect(wf.then).toBeDefined()
      expect(wf.task).toBeDefined()
      expect(wf.build).toBeDefined()
    })

    it('should build a project with fluent API', () => {
      const project = workflow('Feature Launch')
        .parallel(
          task('Design'),
          task('Spec'),
        )
        .then(task('Implement'))
        .then(task('Test'))
        .build()

      expect(project.name).toBe('Feature Launch')
      expect(project.tasks).toHaveLength(3)
    })

    it('should support sequential chaining', () => {
      const project = workflow('Sequential Work')
        .task('Step 1')
        .task('Step 2')
        .task('Step 3')
        .build()

      expect(project.tasks).toHaveLength(3)
    })

    it('should support mixed parallel and sequential', () => {
      const project = workflow('Mixed Workflow')
        .parallel(task('A'), task('B'))
        .sequential(task('1'), task('2'), task('3'))
        .then(task('Final'))
        .build()

      expect(project.tasks).toHaveLength(3)
    })

    it('should accept description', () => {
      const project = workflow('Test', 'Test description').build()
      expect(project.description).toBe('Test description')
    })

    it('should accept build options', () => {
      const project = workflow('Test')
        .task('Task')
        .build({ defaultMode: 'parallel', tags: ['test'] })

      expect(project.defaultMode).toBe('parallel')
      expect(project.tags).toEqual(['test'])
    })
  })

  describe('materializeProject()', () => {
    it('should convert project to actual Task objects', async () => {
      const project = createProject({
        name: 'Test Project',
        tasks: [
          task('Task 1'),
          task('Task 2'),
        ],
      })

      const { tasks } = await materializeProject(project)

      expect(tasks).toHaveLength(2)
      expect(tasks[0].id).toContain('task_0')
      expect(tasks[1].id).toContain('task_1')
    })

    it('should create dependencies for sequential tasks', async () => {
      const project = createProject({
        name: 'Sequential Project',
        tasks: [
          sequential(
            task('Step 1'),
            task('Step 2'),
            task('Step 3'),
          ),
        ],
      })

      const { tasks } = await materializeProject(project)

      expect(tasks).toHaveLength(3)
      // Step 2 depends on Step 1
      expect(tasks[1].dependencies).toHaveLength(1)
      expect(tasks[1].dependencies![0].taskId).toBe(tasks[0].id)
      // Step 3 depends on Step 2
      expect(tasks[2].dependencies).toHaveLength(1)
      expect(tasks[2].dependencies![0].taskId).toBe(tasks[1].id)
    })

    it('should not create dependencies for parallel tasks', async () => {
      const project = createProject({
        name: 'Parallel Project',
        tasks: [
          parallel(
            task('Task A'),
            task('Task B'),
            task('Task C'),
          ),
        ],
      })

      const { tasks } = await materializeProject(project)

      expect(tasks).toHaveLength(3)
      // Parallel tasks should have no dependencies between them
      tasks.forEach(t => {
        expect(t.dependencies).toBeUndefined()
      })
    })

    it('should handle nested groups', async () => {
      const project = createProject({
        name: 'Nested Project',
        tasks: [
          sequential(
            parallel(
              task('A1'),
              task('A2'),
            ),
            task('B'),
          ),
        ],
      })

      const { tasks } = await materializeProject(project)

      expect(tasks).toHaveLength(3)
      // A1 and A2 should have no dependencies
      expect(tasks[0].dependencies).toBeUndefined()
      expect(tasks[1].dependencies).toBeUndefined()
      // B should depend on both A1 and A2
      expect(tasks[2].dependencies).toHaveLength(2)
    })

    it('should process subtasks', async () => {
      const project = createProject({
        name: 'Subtask Project',
        tasks: [
          task('Parent', {
            subtasks: [
              task('Child 1'),
              task('Child 2'),
            ],
          }),
        ],
      })

      const { tasks } = await materializeProject(project)

      // Should have parent + 2 children
      expect(tasks).toHaveLength(3)
      // Children should have parentId set
      const parentId = tasks[0].id
      expect(tasks[1].parentId).toBe(parentId)
      expect(tasks[2].parentId).toBe(parentId)
    })
  })

  describe('Dependency Graph Utilities', () => {
    const createTestTasks = (): AnyTask[] => [
      {
        id: 'task_1',
        function: { type: 'generative', name: 'Task 1', args: {}, output: 'string' },
        status: 'queued',
        priority: 'normal',
        createdAt: new Date(),
        events: [],
      },
      {
        id: 'task_2',
        function: { type: 'generative', name: 'Task 2', args: {}, output: 'string' },
        status: 'queued',
        priority: 'normal',
        dependencies: [{ type: 'blocked_by', taskId: 'task_1', satisfied: false }],
        createdAt: new Date(),
        events: [],
      },
      {
        id: 'task_3',
        function: { type: 'generative', name: 'Task 3', args: {}, output: 'string' },
        status: 'queued',
        priority: 'normal',
        dependencies: [{ type: 'blocked_by', taskId: 'task_2', satisfied: false }],
        createdAt: new Date(),
        events: [],
      },
    ]

    describe('getDependants()', () => {
      it('should return tasks that depend on a given task', () => {
        const tasks = createTestTasks()
        const dependants = getDependants('task_1', tasks)

        expect(dependants).toHaveLength(1)
        expect(dependants[0].id).toBe('task_2')
      })

      it('should return empty array for task with no dependants', () => {
        const tasks = createTestTasks()
        const dependants = getDependants('task_3', tasks)

        expect(dependants).toHaveLength(0)
      })
    })

    describe('getDependencies()', () => {
      it('should return tasks that a given task depends on', () => {
        const tasks = createTestTasks()
        const deps = getDependencies(tasks[1], tasks)

        expect(deps).toHaveLength(1)
        expect(deps[0].id).toBe('task_1')
      })

      it('should return empty array for task with no dependencies', () => {
        const tasks = createTestTasks()
        const deps = getDependencies(tasks[0], tasks)

        expect(deps).toHaveLength(0)
      })
    })

    describe('getReadyTasks()', () => {
      it('should return tasks with no unsatisfied dependencies', () => {
        const tasks = createTestTasks()
        const ready = getReadyTasks(tasks)

        expect(ready).toHaveLength(1)
        expect(ready[0].id).toBe('task_1')
      })

      it('should include tasks with all dependencies satisfied', () => {
        const tasks = createTestTasks()
        tasks[1].dependencies![0].satisfied = true

        const ready = getReadyTasks(tasks)

        expect(ready).toHaveLength(2)
        expect(ready.map(t => t.id)).toContain('task_1')
        expect(ready.map(t => t.id)).toContain('task_2')
      })

      it('should exclude non-queued tasks', () => {
        const tasks = createTestTasks()
        tasks[0].status = 'in_progress'

        const ready = getReadyTasks(tasks)

        expect(ready).toHaveLength(0)
      })
    })

    describe('hasCycles()', () => {
      it('should return false for DAG', () => {
        const tasks = createTestTasks()
        expect(hasCycles(tasks)).toBe(false)
      })

      it('should return true for cyclic graph', () => {
        const tasks: AnyTask[] = [
          {
            id: 'cycle_1',
            function: { type: 'generative', name: 'Cycle 1', args: {}, output: 'string' },
            status: 'queued',
            priority: 'normal',
            dependencies: [{ type: 'blocked_by', taskId: 'cycle_2', satisfied: false }],
            createdAt: new Date(),
            events: [],
          },
          {
            id: 'cycle_2',
            function: { type: 'generative', name: 'Cycle 2', args: {}, output: 'string' },
            status: 'queued',
            priority: 'normal',
            dependencies: [{ type: 'blocked_by', taskId: 'cycle_1', satisfied: false }],
            createdAt: new Date(),
            events: [],
          },
        ]

        expect(hasCycles(tasks)).toBe(true)
      })

      it('should return false for empty task list', () => {
        expect(hasCycles([])).toBe(false)
      })
    })

    describe('sortTasks()', () => {
      it('should return tasks in topological order', () => {
        const tasks = createTestTasks()
        const sorted = sortTasks(tasks)

        expect(sorted).toHaveLength(3)
        expect(sorted[0].id).toBe('task_1')
        expect(sorted[1].id).toBe('task_2')
        expect(sorted[2].id).toBe('task_3')
      })

      it('should handle tasks with no dependencies', () => {
        const tasks: AnyTask[] = [
          {
            id: 'independent_1',
            function: { type: 'generative', name: 'Ind 1', args: {}, output: 'string' },
            status: 'queued',
            priority: 'normal',
            createdAt: new Date(),
            events: [],
          },
          {
            id: 'independent_2',
            function: { type: 'generative', name: 'Ind 2', args: {}, output: 'string' },
            status: 'queued',
            priority: 'normal',
            createdAt: new Date(),
            events: [],
          },
        ]

        const sorted = sortTasks(tasks)
        expect(sorted).toHaveLength(2)
      })

      it('should handle complex dependency graph', () => {
        //      A
        //     / \
        //    B   C
        //     \ /
        //      D
        const tasks: AnyTask[] = [
          {
            id: 'A',
            function: { type: 'generative', name: 'A', args: {}, output: 'string' },
            status: 'queued',
            priority: 'normal',
            createdAt: new Date(),
            events: [],
          },
          {
            id: 'B',
            function: { type: 'generative', name: 'B', args: {}, output: 'string' },
            status: 'queued',
            priority: 'normal',
            dependencies: [{ type: 'blocked_by', taskId: 'A', satisfied: false }],
            createdAt: new Date(),
            events: [],
          },
          {
            id: 'C',
            function: { type: 'generative', name: 'C', args: {}, output: 'string' },
            status: 'queued',
            priority: 'normal',
            dependencies: [{ type: 'blocked_by', taskId: 'A', satisfied: false }],
            createdAt: new Date(),
            events: [],
          },
          {
            id: 'D',
            function: { type: 'generative', name: 'D', args: {}, output: 'string' },
            status: 'queued',
            priority: 'normal',
            dependencies: [
              { type: 'blocked_by', taskId: 'B', satisfied: false },
              { type: 'blocked_by', taskId: 'C', satisfied: false },
            ],
            createdAt: new Date(),
            events: [],
          },
        ]

        const sorted = sortTasks(tasks)

        // A must come first
        expect(sorted[0].id).toBe('A')
        // D must come last
        expect(sorted[3].id).toBe('D')
        // B and C can be in any order between A and D
        const bcIds = [sorted[1].id, sorted[2].id]
        expect(bcIds).toContain('B')
        expect(bcIds).toContain('C')
      })
    })
  })
})
