/**
 * Tests for workflow.ts - Workflow definition and automation sequences
 */

import { describe, it, expect } from 'vitest'
import {
  Workflow,
  getActionsInOrder,
  getActionsByType,
  getConditionalActions,
  addAction,
  removeAction,
  updateAction,
  isEventTrigger,
  isScheduleTrigger,
  isWebhookTrigger,
  parseWaitDuration,
  evaluateCondition,
  fillTemplate,
  validateWorkflow,
} from '../src/workflow.js'
import type { WorkflowDefinition, WorkflowAction, WorkflowTrigger } from '../src/types.js'

describe('Workflow', () => {
  describe('Workflow()', () => {
    it('should create a workflow with required fields', () => {
      const workflow = Workflow({
        name: 'Test Workflow',
        trigger: { type: 'event', event: 'user.created' },
      })

      expect(workflow.name).toBe('Test Workflow')
      expect(workflow.trigger.type).toBe('event')
      expect(workflow.actions).toEqual([])
      expect(workflow.metadata).toEqual({})
    })

    it('should create a workflow with all fields', () => {
      const workflow = Workflow({
        name: 'Welcome Flow',
        description: 'Welcomes new users',
        trigger: { type: 'event', event: 'user.created' },
        actions: [
          { order: 1, type: 'send', description: 'Send email' },
          { order: 2, type: 'create', description: 'Create task' },
        ],
        metadata: { version: 1 },
      })

      expect(workflow.name).toBe('Welcome Flow')
      expect(workflow.description).toBe('Welcomes new users')
      expect(workflow.actions).toHaveLength(2)
      expect(workflow.metadata).toEqual({ version: 1 })
    })

    it('should throw error if name is missing', () => {
      expect(() =>
        Workflow({
          name: '',
          trigger: { type: 'event' },
        })
      ).toThrow('Workflow name is required')
    })

    it('should throw error if trigger is missing', () => {
      expect(() =>
        Workflow({
          name: 'Test',
          trigger: undefined as unknown as WorkflowTrigger,
        })
      ).toThrow('Workflow trigger is required')
    })
  })

  describe('getActionsInOrder()', () => {
    const workflow = Workflow({
      name: 'Test',
      trigger: { type: 'manual' },
      actions: [
        { order: 3, type: 'notify', description: 'Third' },
        { order: 1, type: 'send', description: 'First' },
        { order: 2, type: 'create', description: 'Second' },
      ],
    })

    it('should return actions sorted by order', () => {
      const sorted = getActionsInOrder(workflow)

      expect(sorted[0]?.order).toBe(1)
      expect(sorted[0]?.description).toBe('First')
      expect(sorted[1]?.order).toBe(2)
      expect(sorted[2]?.order).toBe(3)
    })

    it('should handle workflow with no actions', () => {
      const emptyWorkflow = Workflow({
        name: 'Empty',
        trigger: { type: 'manual' },
      })

      const sorted = getActionsInOrder(emptyWorkflow)
      expect(sorted).toEqual([])
    })
  })

  describe('getActionsByType()', () => {
    const workflow = Workflow({
      name: 'Test',
      trigger: { type: 'manual' },
      actions: [
        { order: 1, type: 'send', description: 'Send 1' },
        { order: 2, type: 'create', description: 'Create 1' },
        { order: 3, type: 'send', description: 'Send 2' },
        { order: 4, type: 'notify', description: 'Notify 1' },
      ],
    })

    it('should filter actions by type', () => {
      const sendActions = getActionsByType(workflow, 'send')

      expect(sendActions).toHaveLength(2)
      expect(sendActions[0]?.description).toBe('Send 1')
      expect(sendActions[1]?.description).toBe('Send 2')
    })

    it('should return empty array for non-existent type', () => {
      const deleteActions = getActionsByType(workflow, 'delete')
      expect(deleteActions).toHaveLength(0)
    })
  })

  describe('getConditionalActions()', () => {
    const workflow = Workflow({
      name: 'Test',
      trigger: { type: 'manual' },
      actions: [
        { order: 1, type: 'send', description: 'Always runs' },
        {
          order: 2,
          type: 'notify',
          description: 'Conditional',
          condition: 'user.premium === true',
        },
        {
          order: 3,
          type: 'create',
          description: 'Also conditional',
          condition: 'order.total > 100',
        },
      ],
    })

    it('should return only conditional actions', () => {
      const conditional = getConditionalActions(workflow)

      expect(conditional).toHaveLength(2)
      expect(conditional[0]?.description).toBe('Conditional')
      expect(conditional[1]?.description).toBe('Also conditional')
    })

    it('should return empty array if no conditional actions', () => {
      const simpleWorkflow = Workflow({
        name: 'Simple',
        trigger: { type: 'manual' },
        actions: [{ order: 1, type: 'send', description: 'Always' }],
      })

      const conditional = getConditionalActions(simpleWorkflow)
      expect(conditional).toHaveLength(0)
    })
  })

  describe('addAction()', () => {
    it('should add action to workflow', () => {
      const workflow = Workflow({
        name: 'Test',
        trigger: { type: 'manual' },
        actions: [{ order: 1, type: 'send', description: 'First' }],
      })

      const updated = addAction(workflow, { order: 2, type: 'notify', description: 'Second' })

      expect(updated.actions).toHaveLength(2)
      expect(updated.actions?.[1]?.order).toBe(2)
    })

    it('should add action to empty workflow', () => {
      const workflow = Workflow({
        name: 'Test',
        trigger: { type: 'manual' },
      })

      const updated = addAction(workflow, { order: 1, type: 'send', description: 'First' })

      expect(updated.actions).toHaveLength(1)
    })
  })

  describe('removeAction()', () => {
    const workflow = Workflow({
      name: 'Test',
      trigger: { type: 'manual' },
      actions: [
        { order: 1, type: 'send', description: 'First' },
        { order: 2, type: 'create', description: 'Second' },
        { order: 3, type: 'notify', description: 'Third' },
      ],
    })

    it('should remove action by order', () => {
      const updated = removeAction(workflow, 2)

      expect(updated.actions).toHaveLength(2)
      expect(updated.actions?.find((a) => a.order === 2)).toBeUndefined()
    })

    it('should handle removing non-existent action', () => {
      const updated = removeAction(workflow, 99)
      expect(updated.actions).toHaveLength(3)
    })
  })

  describe('updateAction()', () => {
    const workflow = Workflow({
      name: 'Test',
      trigger: { type: 'manual' },
      actions: [
        { order: 1, type: 'send', description: 'Original' },
        { order: 2, type: 'create', description: 'Second' },
      ],
    })

    it('should update action properties', () => {
      const updated = updateAction(workflow, 1, { description: 'Updated', type: 'notify' })

      const action = updated.actions?.find((a) => a.order === 1)
      expect(action?.description).toBe('Updated')
      expect(action?.type).toBe('notify')
    })

    it('should not affect other actions', () => {
      const updated = updateAction(workflow, 1, { description: 'Updated' })

      const secondAction = updated.actions?.find((a) => a.order === 2)
      expect(secondAction?.description).toBe('Second')
    })

    it('should handle updating non-existent action', () => {
      const updated = updateAction(workflow, 99, { description: 'Updated' })
      expect(updated.actions).toHaveLength(2)
    })
  })

  describe('Trigger type checkers', () => {
    it('isEventTrigger should identify event triggers', () => {
      expect(isEventTrigger({ type: 'event', event: 'user.created' })).toBe(true)
      expect(isEventTrigger({ type: 'schedule' })).toBe(false)
    })

    it('isScheduleTrigger should identify schedule triggers', () => {
      expect(isScheduleTrigger({ type: 'schedule', schedule: '0 9 * * *' })).toBe(true)
      expect(isScheduleTrigger({ type: 'event' })).toBe(false)
    })

    it('isWebhookTrigger should identify webhook triggers', () => {
      expect(isWebhookTrigger({ type: 'webhook', webhook: 'https://example.com' })).toBe(true)
      expect(isWebhookTrigger({ type: 'manual' })).toBe(false)
    })
  })

  describe('parseWaitDuration()', () => {
    it('should parse milliseconds', () => {
      expect(parseWaitDuration('100 ms')).toBe(100)
      expect(parseWaitDuration('500 milliseconds')).toBe(500)
    })

    it('should parse seconds', () => {
      expect(parseWaitDuration('30 seconds')).toBe(30000)
      expect(parseWaitDuration('1 second')).toBe(1000)
      expect(parseWaitDuration('5 s')).toBe(5000)
    })

    it('should parse minutes', () => {
      expect(parseWaitDuration('5 minutes')).toBe(300000)
      expect(parseWaitDuration('1 minute')).toBe(60000)
      expect(parseWaitDuration('10 m')).toBe(600000)
    })

    it('should parse hours', () => {
      expect(parseWaitDuration('2 hours')).toBe(7200000)
      expect(parseWaitDuration('1 hour')).toBe(3600000)
      expect(parseWaitDuration('24 h')).toBe(86400000)
    })

    it('should parse days', () => {
      expect(parseWaitDuration('1 day')).toBe(86400000)
      expect(parseWaitDuration('7 days')).toBe(604800000)
      expect(parseWaitDuration('2 d')).toBe(172800000)
    })

    it('should return 0 for invalid format', () => {
      expect(parseWaitDuration('invalid')).toBe(0)
      expect(parseWaitDuration('')).toBe(0)
      expect(parseWaitDuration('minutes')).toBe(0)
    })
  })

  describe('evaluateCondition()', () => {
    it('should evaluate simple equality', () => {
      expect(evaluateCondition('active === true', { active: true })).toBe(true)
      expect(evaluateCondition('active === false', { active: true })).toBe(false)
    })

    it('should evaluate comparisons', () => {
      expect(evaluateCondition('amount > 100', { amount: 150 })).toBe(true)
      expect(evaluateCondition('amount > 100', { amount: 50 })).toBe(false)
      expect(evaluateCondition('count >= 5', { count: 5 })).toBe(true)
    })

    it('should handle missing context variables', () => {
      expect(evaluateCondition('missing === true', {})).toBe(false)
    })

    it('should evaluate string comparisons', () => {
      expect(evaluateCondition('status === "active"', { status: 'active' })).toBe(true)
    })

    it('should return false for invalid conditions', () => {
      expect(evaluateCondition('invalid syntax {{}}', {})).toBe(false)
    })
  })

  describe('fillTemplate()', () => {
    it('should fill simple templates', () => {
      const result = fillTemplate('Hello {{name}}!', { name: 'Alice' })
      expect(result).toBe('Hello Alice!')
    })

    it('should fill multiple placeholders', () => {
      const result = fillTemplate('{{greeting}} {{name}}, you have {{count}} messages', {
        greeting: 'Hello',
        name: 'Bob',
        count: 5,
      })
      expect(result).toBe('Hello Bob, you have 5 messages')
    })

    it('should handle nested paths', () => {
      const result = fillTemplate('Welcome {{user.name}}!', {
        user: { name: 'Charlie' },
      })
      expect(result).toBe('Welcome Charlie!')
    })

    it('should handle deeply nested paths', () => {
      const result = fillTemplate('Order: {{order.customer.name}}', {
        order: { customer: { name: 'Acme Corp' } },
      })
      expect(result).toBe('Order: Acme Corp')
    })

    it('should replace missing values with empty string', () => {
      const result = fillTemplate('Hello {{missing}}!', {})
      expect(result).toBe('Hello !')
    })

    it('should handle template with no placeholders', () => {
      const result = fillTemplate('No placeholders here', { value: 'test' })
      expect(result).toBe('No placeholders here')
    })

    it('should handle whitespace in placeholders', () => {
      const result = fillTemplate('Hello {{ name }}!', { name: 'Alice' })
      expect(result).toBe('Hello Alice!')
    })
  })

  describe('validateWorkflow()', () => {
    it('should validate valid workflow', () => {
      const workflow: WorkflowDefinition = {
        name: 'Valid Workflow',
        trigger: { type: 'event', event: 'user.created' },
        actions: [
          { order: 1, type: 'send', description: 'Send email' },
          { order: 2, type: 'notify', description: 'Notify admin' },
        ],
      }

      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail if name is missing', () => {
      const workflow: WorkflowDefinition = {
        name: '',
        trigger: { type: 'event' },
      }

      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Workflow name is required')
    })

    it('should fail if trigger is missing', () => {
      const workflow = {
        name: 'Test',
        trigger: undefined,
      } as unknown as WorkflowDefinition

      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Workflow trigger is required')
    })

    it('should fail if event trigger has no event', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test',
        trigger: { type: 'event' },
      }

      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Event trigger must specify an event name')
    })

    it('should fail if schedule trigger has no schedule', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test',
        trigger: { type: 'schedule' },
      }

      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Schedule trigger must specify a schedule expression')
    })

    it('should fail if webhook trigger has no webhook URL', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test',
        trigger: { type: 'webhook' },
      }

      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Webhook trigger must specify a webhook URL')
    })

    it('should fail if action has no type', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test',
        trigger: { type: 'manual' },
        actions: [{ order: 1, type: '' as WorkflowAction['type'], description: 'No type' }],
      }

      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Action at order 1 must have a type')
    })

    it('should fail for duplicate action orders', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test',
        trigger: { type: 'manual' },
        actions: [
          { order: 1, type: 'send', description: 'First' },
          { order: 1, type: 'notify', description: 'Duplicate' },
        ],
      }

      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Duplicate action order: 1')
    })

    it('should fail if wait action has no duration', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test',
        trigger: { type: 'manual' },
        actions: [{ order: 1, type: 'wait', description: 'Wait without duration' }],
      }

      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Wait action at order 1 must specify duration')
    })

    it('should pass for wait action with duration', () => {
      const workflow: WorkflowDefinition = {
        name: 'Test',
        trigger: { type: 'manual' },
        actions: [
          { order: 1, type: 'wait', description: 'Wait', params: { duration: '5 minutes' } },
        ],
      }

      const result = validateWorkflow(workflow)
      expect(result.valid).toBe(true)
    })
  })
})
