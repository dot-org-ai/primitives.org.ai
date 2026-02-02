/**
 * Tests for digital-objects adapter
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryProvider, type DigitalObjectsProvider } from 'digital-objects'
import {
  createDigitalObjectsAdapter,
  createSimpleAdapter,
  type DigitalObjectsDatabaseContext,
} from '../digital-objects-adapter.js'
import type { DatabaseContext } from '../types.js'

describe('createDigitalObjectsAdapter', () => {
  let provider: DigitalObjectsProvider
  let adapter: DigitalObjectsDatabaseContext

  beforeEach(async () => {
    provider = createMemoryProvider()
    adapter = await createDigitalObjectsAdapter(provider)
  })

  describe('auto-definition', () => {
    it('should define workflow nouns', async () => {
      const workflowNoun = await provider.getNoun('Workflow')
      expect(workflowNoun).not.toBeNull()
      expect(workflowNoun?.name).toBe('Workflow')

      const artifactNoun = await provider.getNoun('Artifact')
      expect(artifactNoun).not.toBeNull()

      const scheduleNoun = await provider.getNoun('Schedule')
      expect(scheduleNoun).not.toBeNull()

      const cascadeNoun = await provider.getNoun('Cascade')
      expect(cascadeNoun).not.toBeNull()
    })

    it('should define workflow verbs', async () => {
      const emitVerb = await provider.getVerb('emit')
      expect(emitVerb).not.toBeNull()
      expect(emitVerb?.name).toBe('emit')

      const executeVerb = await provider.getVerb('execute')
      expect(executeVerb).not.toBeNull()

      const completeVerb = await provider.getVerb('complete')
      expect(completeVerb).not.toBeNull()

      const stepVerb = await provider.getVerb('step')
      expect(stepVerb).not.toBeNull()
    })

    it('should skip definition if already defined', async () => {
      // Create another adapter - should not throw
      const adapter2 = await createDigitalObjectsAdapter(provider)
      expect(adapter2).toBeDefined()
    })

    it('should skip auto-definition when disabled', async () => {
      const freshProvider = createMemoryProvider()
      await createDigitalObjectsAdapter(freshProvider, { autoDefine: true })

      // Nouns should be defined
      const workflowNoun = await freshProvider.getNoun('Workflow')
      expect(workflowNoun).not.toBeNull()
    })
  })

  describe('recordEvent', () => {
    it('should record events as Actions', async () => {
      await adapter.recordEvent('Customer.created', { name: 'John', email: 'john@example.com' })

      const actions = await provider.listActions({ verb: 'emit' })
      expect(actions.length).toBe(1)
      expect(actions[0]?.data).toMatchObject({
        event: 'Customer.created',
        data: { name: 'John', email: 'john@example.com' },
      })
    })

    it('should associate events with workflow when workflowId is set', async () => {
      const adapterWithWorkflow = await createDigitalObjectsAdapter(provider, {
        workflowId: 'wf-123',
      })

      await adapterWithWorkflow.recordEvent('Order.completed', { orderId: 'order-1' })

      const actions = await provider.listActions({ verb: 'emit', subject: 'wf-123' })
      expect(actions.length).toBe(1)
    })
  })

  describe('createAction', () => {
    it('should create actions with proper verb', async () => {
      await adapter.createAction({
        actor: 'user-1',
        object: 'document-1',
        action: 'edit',
        status: 'pending',
        metadata: { changes: ['title'] },
      })

      const actions = await provider.listActions({ verb: 'edit' })
      expect(actions.length).toBe(1)
      expect(actions[0]?.subject).toBe('user-1')
      expect(actions[0]?.object).toBe('document-1')
    })
  })

  describe('completeAction', () => {
    it('should record completion as an action', async () => {
      // First create an action
      const action = await provider.perform('process', 'worker', 'task-1', {})

      // Complete it
      await adapter.completeAction(action.id, { success: true, output: 'done' })

      // Verify completion action was recorded
      const completions = await provider.listActions({ verb: 'complete' })
      expect(completions.length).toBe(1)
      expect(completions[0]?.object).toBe(action.id)
      expect(completions[0]?.data).toMatchObject({
        result: { success: true, output: 'done' },
      })
    })
  })

  describe('artifacts', () => {
    it('should store artifacts as Things', async () => {
      await adapter.storeArtifact({
        key: 'ast-hash-123',
        type: 'ast',
        sourceHash: 'abc123',
        content: { type: 'Program', body: [] },
        metadata: { language: 'javascript' },
      })

      const thing = await provider.get('ast-hash-123')
      expect(thing).not.toBeNull()
      expect(thing?.noun).toBe('Artifact')
      expect(thing?.data).toMatchObject({
        key: 'ast-hash-123',
        type: 'ast',
        sourceHash: 'abc123',
      })
    })

    it('should retrieve artifact content', async () => {
      await adapter.storeArtifact({
        key: 'compiled-module',
        type: 'esm',
        sourceHash: 'def456',
        content: 'export default function() {}',
      })

      const content = await adapter.getArtifact('compiled-module')
      expect(content).toBe('export default function() {}')
    })

    it('should return null for non-existent artifact', async () => {
      const content = await adapter.getArtifact('does-not-exist')
      expect(content).toBeNull()
    })

    it('should include workflowId when set', async () => {
      const adapterWithWorkflow = await createDigitalObjectsAdapter(provider, {
        workflowId: 'wf-456',
      })

      await adapterWithWorkflow.storeArtifact({
        key: 'workflow-artifact',
        type: 'bundle',
        sourceHash: 'ghi789',
        content: { bundled: true },
      })

      const thing = await provider.get('workflow-artifact')
      expect(thing?.data).toHaveProperty('workflowId', 'wf-456')
    })
  })

  describe('extended methods', () => {
    it('should provide access to provider', () => {
      expect(adapter.provider).toBe(provider)
    })

    it('should get workflow by id', async () => {
      await provider.create(
        'Workflow',
        {
          name: 'test-workflow',
          status: 'running',
          context: { userId: '123' },
        },
        'wf-test'
      )

      const workflow = await adapter.getWorkflow('wf-test')
      expect(workflow).not.toBeNull()
      expect(workflow?.data).toMatchObject({ name: 'test-workflow' })
    })

    it('should update workflow', async () => {
      await provider.create(
        'Workflow',
        {
          name: 'test-workflow',
          status: 'running',
          context: {},
        },
        'wf-update'
      )

      const updated = await adapter.updateWorkflow('wf-update', {
        status: 'completed',
        context: { result: 'done' },
      })

      expect(updated.data).toMatchObject({
        status: 'completed',
        context: { result: 'done' },
      })
    })

    it('should list workflow actions', async () => {
      const adapterWithWorkflow = await createDigitalObjectsAdapter(provider, {
        workflowId: 'wf-actions',
      })

      await adapterWithWorkflow.recordEvent('Event1', {})
      await adapterWithWorkflow.recordEvent('Event2', {})

      const actions = await adapterWithWorkflow.listWorkflowActions('wf-actions')
      expect(actions.length).toBe(2)
    })

    it('should list actions by verb', async () => {
      await adapter.recordEvent('Event1', {})
      await adapter.recordEvent('Event2', {})

      const actions = await adapter.listActionsByVerb('emit')
      expect(actions.length).toBe(2)
    })
  })
})

describe('createSimpleAdapter', () => {
  it('should return only DatabaseContext interface', async () => {
    const provider = createMemoryProvider()
    const simple = await createSimpleAdapter(provider)

    // Should have all DatabaseContext methods
    expect(typeof simple.recordEvent).toBe('function')
    expect(typeof simple.createAction).toBe('function')
    expect(typeof simple.completeAction).toBe('function')
    expect(typeof simple.storeArtifact).toBe('function')
    expect(typeof simple.getArtifact).toBe('function')

    // Should NOT have extended methods
    expect((simple as DigitalObjectsDatabaseContext).provider).toBeUndefined()
    expect((simple as DigitalObjectsDatabaseContext).getWorkflow).toBeUndefined()
  })

  it('should work with workflow options', async () => {
    const provider = createMemoryProvider()
    const simple = await createSimpleAdapter(provider, { workflowId: 'wf-simple' })

    await simple.recordEvent('Test.event', { data: 'test' })

    const actions = await provider.listActions({ subject: 'wf-simple' })
    expect(actions.length).toBe(1)
  })
})
