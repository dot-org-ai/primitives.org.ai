/**
 * Tests for DigitalObjectsFunctionRegistry
 *
 * This tests the persistent function registry implementation using digital-objects.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryProvider } from 'digital-objects/testing'
import type { DigitalObjectsProvider } from 'digital-objects'
import {
  createDigitalObjectsRegistry,
  DigitalObjectsFunctionRegistry,
  FUNCTION_NOUNS,
  FUNCTION_VERBS,
} from '../src/digital-objects-registry.js'
import { defineFunction } from '../src/index.js'
import type { DefinedFunction } from '../src/types.js'

describe('createDigitalObjectsRegistry', () => {
  let provider: DigitalObjectsProvider

  beforeEach(() => {
    provider = createMemoryProvider()
  })

  it('creates a registry with nouns defined', async () => {
    const registry = await createDigitalObjectsRegistry({ provider })

    // Check that nouns were defined
    const nouns = await provider.listNouns()
    const nounNames = nouns.map((n) => n.name)

    expect(nounNames).toContain(FUNCTION_NOUNS.CODE)
    expect(nounNames).toContain(FUNCTION_NOUNS.GENERATIVE)
    expect(nounNames).toContain(FUNCTION_NOUNS.AGENTIC)
    expect(nounNames).toContain(FUNCTION_NOUNS.HUMAN)
  })

  it('creates a registry with verbs defined', async () => {
    const registry = await createDigitalObjectsRegistry({ provider })

    // Check that verbs were defined
    const verbs = await provider.listVerbs()
    const verbNames = verbs.map((v) => v.name)

    expect(verbNames).toContain(FUNCTION_VERBS.DEFINE)
    expect(verbNames).toContain(FUNCTION_VERBS.CALL)
    expect(verbNames).toContain(FUNCTION_VERBS.COMPLETE)
    expect(verbNames).toContain(FUNCTION_VERBS.FAIL)
  })

  it('can skip auto-initialization', async () => {
    const registry = await createDigitalObjectsRegistry({
      provider,
      autoInitialize: false,
    })

    // Should not have defined nouns yet
    const nouns = await provider.listNouns()
    expect(nouns.length).toBe(0)

    // Can manually initialize
    await registry.initialize()
    const nounsAfter = await provider.listNouns()
    expect(nounsAfter.length).toBe(4)
  })
})

describe('DigitalObjectsFunctionRegistry', () => {
  let provider: DigitalObjectsProvider
  let registry: DigitalObjectsFunctionRegistry

  beforeEach(async () => {
    provider = createMemoryProvider()
    registry = await createDigitalObjectsRegistry({ provider })
  })

  describe('set()', () => {
    it('stores function definitions as Things', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'summarize',
        args: { text: 'Text to summarize' },
        output: 'string',
      })

      registry.set('summarize', fn)

      // Wait for async storage to complete
      await new Promise((resolve) => setTimeout(resolve, 10))

      // Check that it was stored as a Thing
      const things = await provider.find(FUNCTION_NOUNS.GENERATIVE, { name: 'summarize' })
      expect(things.length).toBe(1)
      expect(things[0].data).toMatchObject({
        name: 'summarize',
        type: 'generative',
        output: 'string',
      })
    })

    it('stores different function types in their respective nouns', async () => {
      const codeFn = defineFunction({
        type: 'code',
        name: 'implement',
        args: { spec: 'Spec' },
        language: 'typescript',
      })

      const agenticFn = defineFunction({
        type: 'agentic',
        name: 'research',
        args: { topic: 'Topic' },
        instructions: 'Research thoroughly',
      })

      const humanFn = defineFunction({
        type: 'human',
        name: 'approve',
        args: { amount: 'Amount' },
        channel: 'web',
        instructions: 'Review and approve',
      })

      registry.set('implement', codeFn)
      registry.set('research', agenticFn)
      registry.set('approve', humanFn)

      await new Promise((resolve) => setTimeout(resolve, 10))

      const codeThings = await provider.find(FUNCTION_NOUNS.CODE, { name: 'implement' })
      const agenticThings = await provider.find(FUNCTION_NOUNS.AGENTIC, { name: 'research' })
      const humanThings = await provider.find(FUNCTION_NOUNS.HUMAN, { name: 'approve' })

      expect(codeThings.length).toBe(1)
      expect(agenticThings.length).toBe(1)
      expect(humanThings.length).toBe(1)
    })
  })

  describe('get()', () => {
    it('retrieves function definitions from cache', () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'translate',
        args: { text: 'Text', lang: 'Target language' },
        output: 'string',
      })

      registry.set('translate', fn)

      const retrieved = registry.get('translate')
      expect(retrieved).toBe(fn)
      expect(retrieved?.definition.name).toBe('translate')
    })

    it('returns undefined for non-existent functions', () => {
      const result = registry.get('nonexistent')
      expect(result).toBeUndefined()
    })
  })

  describe('getAsync()', () => {
    it('retrieves function definitions from storage', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'analyze',
        args: { data: 'Data to analyze' },
        output: 'string',
      })

      await registry.setAsync('analyze', fn)

      // Create a new registry to simulate fresh load
      const newRegistry = await createDigitalObjectsRegistry({ provider })

      const retrieved = await newRegistry.getAsync('analyze')
      expect(retrieved).toBeDefined()
      expect(retrieved?.definition.name).toBe('analyze')
      expect(retrieved?.definition.type).toBe('generative')
    })
  })

  describe('has()', () => {
    it('checks if function exists in cache', () => {
      expect(registry.has('test')).toBe(false)

      const fn = defineFunction({
        type: 'generative',
        name: 'test',
        args: {},
        output: 'string',
      })

      registry.set('test', fn)
      expect(registry.has('test')).toBe(true)
    })
  })

  describe('hasAsync()', () => {
    it('checks if function exists in storage', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'stored',
        args: {},
        output: 'string',
      })

      await registry.setAsync('stored', fn)

      // Create new registry
      const newRegistry = await createDigitalObjectsRegistry({ provider })

      expect(await newRegistry.hasAsync('stored')).toBe(true)
      expect(await newRegistry.hasAsync('notexist')).toBe(false)
    })
  })

  describe('delete()', () => {
    it('removes functions from cache', () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'toDelete',
        args: {},
        output: 'string',
      })

      registry.set('toDelete', fn)
      expect(registry.has('toDelete')).toBe(true)

      const result = registry.delete('toDelete')
      expect(result).toBe(true)
      expect(registry.has('toDelete')).toBe(false)
    })

    it('returns false for non-existent functions', () => {
      const result = registry.delete('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('deleteAsync()', () => {
    it('removes functions from storage', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'toRemove',
        args: {},
        output: 'string',
      })

      await registry.setAsync('toRemove', fn)

      // Verify it exists
      const things = await provider.find(FUNCTION_NOUNS.GENERATIVE, { name: 'toRemove' })
      expect(things.length).toBe(1)

      // Delete it
      const result = await registry.deleteAsync('toRemove')
      expect(result).toBe(true)

      // Verify it's gone
      const thingsAfter = await provider.find(FUNCTION_NOUNS.GENERATIVE, { name: 'toRemove' })
      expect(thingsAfter.length).toBe(0)
    })
  })

  describe('list() and listAsync()', () => {
    it('list() returns all function names from cache', () => {
      const fn1 = defineFunction({
        type: 'generative',
        name: 'func1',
        args: {},
        output: 'string',
      })
      const fn2 = defineFunction({
        type: 'code',
        name: 'func2',
        args: {},
        language: 'typescript',
      })

      registry.set('func1', fn1)
      registry.set('func2', fn2)

      const names = registry.list()
      expect(names).toContain('func1')
      expect(names).toContain('func2')
      expect(names.length).toBe(2)
    })

    it('listAsync() returns all function names including from storage', async () => {
      const fn1 = defineFunction({
        type: 'generative',
        name: 'funcA',
        args: {},
        output: 'string',
      })
      const fn2 = defineFunction({
        type: 'agentic',
        name: 'funcB',
        args: {},
        instructions: 'Do something',
      })

      await registry.setAsync('funcA', fn1)
      await registry.setAsync('funcB', fn2)

      const names = await registry.listAsync()
      expect(names).toContain('funcA')
      expect(names).toContain('funcB')
    })
  })

  describe('getAll() equivalent - list + get pattern', () => {
    it('returns all functions', () => {
      const fn1 = defineFunction({
        type: 'generative',
        name: 'alpha',
        args: {},
        output: 'string',
      })
      const fn2 = defineFunction({
        type: 'generative',
        name: 'beta',
        args: {},
        output: 'string',
      })
      const fn3 = defineFunction({
        type: 'code',
        name: 'gamma',
        args: {},
        language: 'python',
      })

      registry.set('alpha', fn1)
      registry.set('beta', fn2)
      registry.set('gamma', fn3)

      // getAll pattern: list all names then get each
      const allFunctions = registry.list().map((name) => registry.get(name))

      expect(allFunctions.length).toBe(3)
      expect(allFunctions.map((f) => f?.definition.name)).toContain('alpha')
      expect(allFunctions.map((f) => f?.definition.name)).toContain('beta')
      expect(allFunctions.map((f) => f?.definition.name)).toContain('gamma')
    })
  })

  describe('clear() and clearAsync()', () => {
    it('clear() removes all functions from cache', () => {
      const fn1 = defineFunction({
        type: 'generative',
        name: 'a',
        args: {},
        output: 'string',
      })
      const fn2 = defineFunction({
        type: 'generative',
        name: 'b',
        args: {},
        output: 'string',
      })

      registry.set('a', fn1)
      registry.set('b', fn2)
      expect(registry.list().length).toBe(2)

      registry.clear()
      expect(registry.list().length).toBe(0)
    })

    it('clearAsync() removes all functions from storage', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'toClear',
        args: {},
        output: 'string',
      })

      await registry.setAsync('toClear', fn)

      // Verify stored
      let things = await provider.list(FUNCTION_NOUNS.GENERATIVE)
      expect(things.length).toBe(1)

      await registry.clearAsync()

      // Verify cleared
      things = await provider.list(FUNCTION_NOUNS.GENERATIVE)
      expect(things.length).toBe(0)
    })
  })
})

describe('DigitalObjectsFunctionRegistry - Action Tracking', () => {
  let provider: DigitalObjectsProvider
  let registry: DigitalObjectsFunctionRegistry

  beforeEach(async () => {
    provider = createMemoryProvider()
    registry = await createDigitalObjectsRegistry({ provider })
  })

  describe('trackCall()', () => {
    it('creates an Action for function invocation', async () => {
      // First, store a function
      const fn = defineFunction({
        type: 'generative',
        name: 'greet',
        args: { name: 'Name to greet' },
        output: 'string',
      })
      await registry.setAsync('greet', fn)

      // Track a call
      const callAction = await registry.trackCall('greet', { name: 'Alice' })

      expect(callAction).toBeDefined()
      expect(callAction.verb).toBe(FUNCTION_VERBS.CALL)
      expect(callAction.data).toMatchObject({
        args: { name: 'Alice' },
      })
      expect(callAction.id).toBeDefined()
    })

    it('links call action to the function Thing', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'process',
        args: { input: 'Input data' },
        output: 'string',
      })
      const thing = await registry.setAsync('process', fn)

      const callAction = await registry.trackCall('process', { input: 'test' })

      // The action's object should be the function thing's ID
      expect(callAction.object).toBe(thing.id)
    })
  })

  describe('trackCompletion()', () => {
    it('creates an Action for successful completion', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'compute',
        args: { value: 'Input value' },
        output: 'string',
      })
      await registry.setAsync('compute', fn)

      const callAction = await registry.trackCall('compute', { value: 42 })

      const completionAction = await registry.trackCompletion(callAction.id, 'Result: 84', 150)

      expect(completionAction).toBeDefined()
      expect(completionAction.verb).toBe(FUNCTION_VERBS.COMPLETE)
      expect(completionAction.object).toBe(callAction.id)
      expect(completionAction.data).toMatchObject({
        result: 'Result: 84',
        duration: 150,
      })
    })

    it('stores the result in the action data', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'calculate',
        args: {},
        output: 'string',
      })
      await registry.setAsync('calculate', fn)

      const callAction = await registry.trackCall('calculate', {})
      const completionAction = await registry.trackCompletion(callAction.id, {
        computed: true,
        value: 100,
      })

      expect(completionAction.data?.result).toEqual({ computed: true, value: 100 })
    })
  })

  describe('trackFailure()', () => {
    it('creates an Action for failed execution', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'failing',
        args: {},
        output: 'string',
      })
      await registry.setAsync('failing', fn)

      const callAction = await registry.trackCall('failing', {})

      const failureAction = await registry.trackFailure(callAction.id, 'Connection timeout', 5000)

      expect(failureAction).toBeDefined()
      expect(failureAction.verb).toBe(FUNCTION_VERBS.FAIL)
      expect(failureAction.object).toBe(callAction.id)
      expect(failureAction.data).toMatchObject({
        error: 'Connection timeout',
        duration: 5000,
      })
    })

    it('stores error message in action data', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'erroring',
        args: {},
        output: 'string',
      })
      await registry.setAsync('erroring', fn)

      const callAction = await registry.trackCall('erroring', {})
      const failureAction = await registry.trackFailure(callAction.id, 'Invalid input provided')

      expect(failureAction.data?.error).toBe('Invalid input provided')
    })
  })

  describe('getCallHistory()', () => {
    it('returns calls for a specific function', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'tracked',
        args: { x: 'Input' },
        output: 'string',
      })
      await registry.setAsync('tracked', fn)

      // Make multiple calls
      await registry.trackCall('tracked', { x: 1 })
      await registry.trackCall('tracked', { x: 2 })
      await registry.trackCall('tracked', { x: 3 })

      const history = await registry.getCallHistory('tracked')

      expect(history.length).toBe(3)
      expect(history.every((a) => a.verb === FUNCTION_VERBS.CALL)).toBe(true)
    })

    it('returns empty array for function with no calls', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'unused',
        args: {},
        output: 'string',
      })
      await registry.setAsync('unused', fn)

      const history = await registry.getCallHistory('unused')
      expect(history).toEqual([])
    })

    it('returns empty array for non-existent function', async () => {
      const history = await registry.getCallHistory('nonexistent')
      expect(history).toEqual([])
    })

    it('only returns calls for the specified function', async () => {
      const fn1 = defineFunction({
        type: 'generative',
        name: 'funcA',
        args: {},
        output: 'string',
      })
      const fn2 = defineFunction({
        type: 'generative',
        name: 'funcB',
        args: {},
        output: 'string',
      })

      await registry.setAsync('funcA', fn1)
      await registry.setAsync('funcB', fn2)

      await registry.trackCall('funcA', { data: 'a1' })
      await registry.trackCall('funcA', { data: 'a2' })
      await registry.trackCall('funcB', { data: 'b1' })

      const historyA = await registry.getCallHistory('funcA')
      const historyB = await registry.getCallHistory('funcB')

      expect(historyA.length).toBe(2)
      expect(historyB.length).toBe(1)
    })
  })

  describe('getRecentCalls()', () => {
    it('returns recent calls across all functions', async () => {
      const fn1 = defineFunction({
        type: 'generative',
        name: 'recent1',
        args: {},
        output: 'string',
      })
      const fn2 = defineFunction({
        type: 'code',
        name: 'recent2',
        args: {},
        language: 'typescript',
      })

      await registry.setAsync('recent1', fn1)
      await registry.setAsync('recent2', fn2)

      await registry.trackCall('recent1', { call: 1 })
      await registry.trackCall('recent2', { call: 2 })
      await registry.trackCall('recent1', { call: 3 })

      const recentCalls = await registry.getRecentCalls()

      expect(recentCalls.length).toBe(3)
      expect(recentCalls.every((a) => a.verb === FUNCTION_VERBS.CALL)).toBe(true)
    })

    it('respects the limit parameter', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'limited',
        args: {},
        output: 'string',
      })
      await registry.setAsync('limited', fn)

      // Make 5 calls
      for (let i = 0; i < 5; i++) {
        await registry.trackCall('limited', { index: i })
      }

      const limited = await registry.getRecentCalls(3)
      expect(limited.length).toBe(3)
    })

    it('defaults to 10 results', async () => {
      const fn = defineFunction({
        type: 'generative',
        name: 'many',
        args: {},
        output: 'string',
      })
      await registry.setAsync('many', fn)

      // Make 15 calls
      for (let i = 0; i < 15; i++) {
        await registry.trackCall('many', { index: i })
      }

      const recent = await registry.getRecentCalls()
      expect(recent.length).toBe(10)
    })
  })

  describe('getProvider()', () => {
    it('returns the underlying provider', () => {
      const returnedProvider = registry.getProvider()
      expect(returnedProvider).toBe(provider)
    })
  })
})

describe('DigitalObjectsFunctionRegistry - Edge Cases', () => {
  let provider: DigitalObjectsProvider
  let registry: DigitalObjectsFunctionRegistry

  beforeEach(async () => {
    provider = createMemoryProvider()
    registry = await createDigitalObjectsRegistry({ provider })
  })

  it('handles updating an existing function', async () => {
    const fn1 = defineFunction({
      type: 'generative',
      name: 'evolving',
      args: { v: 'version 1' },
      output: 'string',
    })

    await registry.setAsync('evolving', fn1)

    // Update with new version
    const fn2 = defineFunction({
      type: 'generative',
      name: 'evolving',
      args: { v: 'version 2', extra: 'new field' },
      output: 'string',
    })

    await registry.setAsync('evolving', fn2)

    // Should still have only one Thing
    const things = await provider.find(FUNCTION_NOUNS.GENERATIVE, { name: 'evolving' })
    expect(things.length).toBe(1)

    // Retrieved function should be the updated one
    const retrieved = registry.get('evolving')
    expect(retrieved).toBe(fn2)
  })

  it('handles multiple initializations gracefully', async () => {
    // Initialize multiple times - should not throw or duplicate nouns
    await registry.initialize()
    await registry.initialize()
    await registry.initialize()

    const nouns = await provider.listNouns()
    expect(nouns.length).toBe(4) // Should still be exactly 4
  })

  it('preserves function type-specific fields', async () => {
    const humanFn = defineFunction({
      type: 'human',
      name: 'approval',
      args: { request: 'Request details' },
      channel: 'email',
      instructions: 'Please review and approve',
      timeout: 86400000,
      assignee: 'manager@example.com',
    })

    await registry.setAsync('approval', humanFn)

    // Retrieve from a fresh registry
    const newRegistry = await createDigitalObjectsRegistry({ provider })
    const retrieved = await newRegistry.getAsync('approval')

    expect(retrieved?.definition.type).toBe('human')
    const def = retrieved?.definition as {
      channel: string
      instructions: string
      timeout: number
      assignee: string
    }
    expect(def.channel).toBe('email')
    expect(def.instructions).toBe('Please review and approve')
    expect(def.timeout).toBe(86400000)
    expect(def.assignee).toBe('manager@example.com')
  })

  it('tracks define action when creating new function', async () => {
    const fn = defineFunction({
      type: 'generative',
      name: 'newFunc',
      args: {},
      output: 'string',
    })

    await registry.setAsync('newFunc', fn)

    // Should have a define action
    const actions = await provider.listActions({ verb: FUNCTION_VERBS.DEFINE })
    expect(actions.length).toBe(1)
    expect(actions[0].data).toMatchObject({
      name: 'newFunc',
      type: 'generative',
    })
  })
})
