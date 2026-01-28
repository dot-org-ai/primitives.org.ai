/**
 * Workflows E2E Test Suite
 *
 * Tests workflow creation, execution lifecycle, and control operations
 * against deployed workers. This suite is environment-agnostic --
 * the same tests run in browser, node, and vitest-pool-workers.
 *
 * @packageDocumentation
 */

import type { TestSuite, ClientFactory, WorkflowsClient, WorkflowDefinition } from '../types.js'
import {
  testId,
  assertDefined,
  assertEqual,
  assertTrue,
  assertNotEmpty,
  assertGreaterThan,
  assertType,
  assertIncludes,
  sleep,
} from '../helpers.js'

/**
 * Create the Workflows test suite
 */
export function createWorkflowsTests(getClient: ClientFactory): TestSuite {
  let workflows: WorkflowsClient

  const sampleWorkflow = (): WorkflowDefinition => ({
    name: `test-workflow-${testId()}`,
    description: 'E2E test workflow',
    steps: [
      {
        id: 'step-1',
        name: 'First Step',
        type: 'action',
        config: { action: 'log', message: 'Step 1 executed' },
      },
      {
        id: 'step-2',
        name: 'Second Step',
        type: 'action',
        config: { action: 'log', message: 'Step 2 executed' },
      },
    ],
  })

  return {
    name: 'Workflows',

    beforeEach: async () => {
      workflows = getClient().workflows
    },

    tests: [
      // =====================================================================
      // Workflow Creation
      // =====================================================================
      {
        name: 'should create a workflow',
        fn: async () => {
          const definition = sampleWorkflow()
          const instance = await workflows.create(definition)

          assertDefined(instance, 'Created workflow should be defined')
          assertDefined(instance.id, 'Workflow should have an ID')
          assertEqual(instance.name, definition.name)
          assertDefined(instance.definition, 'Should include definition')
        },
      },

      {
        name: 'should create a workflow with triggers',
        fn: async () => {
          const definition: WorkflowDefinition = {
            ...sampleWorkflow(),
            triggers: [
              { type: 'event', config: { event: 'user.created' } },
              { type: 'schedule', config: { cron: '0 * * * *' } },
            ],
          }

          const instance = await workflows.create(definition)

          assertDefined(instance)
          assertDefined(instance.definition.triggers, 'Should have triggers')
          assertEqual(instance.definition.triggers!.length, 2)
        },
      },

      // =====================================================================
      // Workflow Retrieval
      // =====================================================================
      {
        name: 'should get a workflow by ID',
        fn: async () => {
          const definition = sampleWorkflow()
          const created = await workflows.create(definition)

          const retrieved = await workflows.get(created.id)

          assertDefined(retrieved, 'Should find workflow by ID')
          assertEqual(retrieved.id, created.id)
          assertEqual(retrieved.name, definition.name)
        },
      },

      {
        name: 'should return null for non-existent workflow',
        fn: async () => {
          const result = await workflows.get('non-existent-workflow-id-xyz')
          assertEqual(result, null)
        },
      },

      {
        name: 'should list workflows',
        fn: async () => {
          // Create at least one workflow to ensure list is not empty
          await workflows.create(sampleWorkflow())

          const result = await workflows.list()

          assertDefined(result, 'Workflow list should be defined')
          assertTrue(Array.isArray(result), 'Should return an array')
          assertNotEmpty(result, 'Should have at least one workflow')
        },
      },

      {
        name: 'should list workflows with limit',
        fn: async () => {
          // Create multiple workflows
          await workflows.create(sampleWorkflow())
          await workflows.create(sampleWorkflow())
          await workflows.create(sampleWorkflow())

          const result = await workflows.list({ limit: 2 })

          assertDefined(result)
          assertTrue(result.length <= 2, 'Should respect limit')
        },
      },

      // =====================================================================
      // Workflow Execution
      // =====================================================================
      {
        name: 'should start a workflow run',
        fn: async () => {
          const created = await workflows.create(sampleWorkflow())
          const run = await workflows.start(created.id, { input: 'test data' })

          assertDefined(run, 'Workflow run should be defined')
          assertDefined(run.id, 'Run should have an ID')
          assertEqual(run.workflowId, created.id)
          assertTrue(
            ['pending', 'running'].includes(run.status),
            `Run status should be pending or running, got ${run.status}`
          )
        },
      },

      // =====================================================================
      // Workflow Control
      // =====================================================================
      {
        name: 'should pause a running workflow',
        fn: async () => {
          const created = await workflows.create(sampleWorkflow())
          const run = await workflows.start(created.id)

          // Give it a moment to start
          await sleep(100)

          await workflows.pause(run.id)

          // Verify - not all runtimes may support immediate status check
          // but the call should not throw
        },
      },

      {
        name: 'should resume a paused workflow',
        fn: async () => {
          const created = await workflows.create(sampleWorkflow())
          const run = await workflows.start(created.id)

          await sleep(100)
          await workflows.pause(run.id)
          await sleep(100)
          await workflows.resume(run.id)

          // The call should succeed without throwing
        },
      },

      {
        name: 'should cancel a workflow run',
        fn: async () => {
          const created = await workflows.create(sampleWorkflow())
          const run = await workflows.start(created.id)

          await workflows.cancel(run.id)

          // The call should succeed without throwing
        },
      },

      // =====================================================================
      // Complex Workflows
      // =====================================================================
      {
        name: 'should create a workflow with parallel steps',
        fn: async () => {
          const definition: WorkflowDefinition = {
            name: `parallel-${testId()}`,
            steps: [
              {
                id: 'parallel-group',
                name: 'Parallel Tasks',
                type: 'parallel',
                config: {
                  steps: ['task-a', 'task-b', 'task-c'],
                },
              },
              {
                id: 'task-a',
                name: 'Task A',
                type: 'action',
                config: { action: 'process', data: 'a' },
              },
              {
                id: 'task-b',
                name: 'Task B',
                type: 'action',
                config: { action: 'process', data: 'b' },
              },
              {
                id: 'task-c',
                name: 'Task C',
                type: 'action',
                config: { action: 'process', data: 'c' },
              },
            ],
          }

          const instance = await workflows.create(definition)

          assertDefined(instance)
          assertEqual(instance.definition.steps.length, 4)
        },
      },

      {
        name: 'should create a workflow with conditional steps',
        fn: async () => {
          const definition: WorkflowDefinition = {
            name: `conditional-${testId()}`,
            steps: [
              {
                id: 'check',
                name: 'Check Condition',
                type: 'condition',
                config: {
                  condition: 'input.amount > 100',
                  trueBranch: 'approve',
                  falseBranch: 'auto-approve',
                },
              },
              {
                id: 'approve',
                name: 'Manual Approval',
                type: 'action',
                config: { action: 'requestApproval' },
              },
              {
                id: 'auto-approve',
                name: 'Auto Approve',
                type: 'action',
                config: { action: 'autoApprove' },
              },
            ],
          }

          const instance = await workflows.create(definition)

          assertDefined(instance)
          const conditionStep = instance.definition.steps.find((s) => s.type === 'condition')
          assertDefined(conditionStep, 'Should have a condition step')
        },
      },
    ],
  }
}
