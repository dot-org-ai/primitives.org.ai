/**
 * Tests for `registerToolVerb` / `registerToolVerbs` (aip-47tm).
 *
 * Uses a structural-fake `VerbRegistrationProvider` rather than depending
 * on `MemoryProvider` so the suite stays portable and we can observe
 * exactly which provider methods get called.
 */

import { describe, it, expect } from 'vitest'
import type { Frame, Verb, VerbDefinition } from 'digital-objects'
import {
  defineTool,
  registerToolVerb,
  registerToolVerbs,
  bootstrapTools,
  VerbRegistrationConflictError,
  type VerbRegistrationProvider,
} from '../src/index.js'

/**
 * Minimal structural fake: stores Verbs in a Map and counts calls so
 * tests can assert idempotency (one defineVerb on second registration
 * with the same shape).
 */
function fakeProvider(): VerbRegistrationProvider & {
  defineCalls: number
  getCalls: number
  verbs: Map<string, Verb>
} {
  const verbs = new Map<string, Verb>()
  const provider = {
    defineCalls: 0,
    getCalls: 0,
    verbs,
    async defineVerb(def: VerbDefinition): Promise<Verb> {
      provider.defineCalls++
      const verb: Verb = {
        name: def.name,
        action: def.action ?? def.name,
        act: def.act ?? `${def.name}s`,
        activity: def.activity ?? `${def.name}ing`,
        event: def.event ?? `${def.name}ed`,
        reverseBy: def.reverseBy,
        reverseAt: def.reverseAt,
        reverseIn: def.reverseIn,
        inverse: def.inverse,
        description: def.description,
        frame: def.frame,
        source: def.source ?? 'domain',
        canonical: def.canonical ?? false,
        createdAt: new Date(),
      }
      verbs.set(verb.name, verb)
      return verb
    },
    async getVerb(name: string): Promise<Verb | null> {
      provider.getCalls++
      return verbs.get(name) ?? null
    },
  }
  return provider
}

const sendFrame: Frame = {
  subject: 'Agent',
  object: 'Email',
  recipient: 'Person',
}

describe('registerToolVerb', () => {
  it('registers a Verb when the tool declares one', async () => {
    const provider = fakeProvider()
    const tool = defineTool({
      id: 'communication.email.send',
      name: 'Send Email',
      description: 'Sends an email',
      category: 'communication',
      verb: 'send',
      frame: sendFrame,
      input: { type: 'object', properties: {} },
      handler: async () => ({ ok: true }),
    })

    const verb = await registerToolVerb(provider, tool)

    expect(verb).not.toBeNull()
    expect(verb?.name).toBe('send')
    expect(verb?.frame).toEqual(sendFrame)
    expect(provider.defineCalls).toBe(1)
  })

  it('returns null and skips registration for tools without a verb', async () => {
    const provider = fakeProvider()
    const tool = defineTool({
      id: 'legacy.tool',
      name: 'Legacy',
      description: 'No SVO metadata',
      category: 'data',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })

    const verb = await registerToolVerb(provider, tool)

    expect(verb).toBeNull()
    expect(provider.defineCalls).toBe(0)
    expect(provider.getCalls).toBe(0)
  })

  it('is idempotent for the same verb + frame (no second defineVerb)', async () => {
    const provider = fakeProvider()
    const tool = defineTool({
      id: 'communication.email.send',
      name: 'Send Email',
      description: 'Sends an email',
      category: 'communication',
      verb: 'send',
      frame: sendFrame,
      input: { type: 'object', properties: {} },
      handler: async () => ({ ok: true }),
    })

    const first = await registerToolVerb(provider, tool)
    const second = await registerToolVerb(provider, tool)

    expect(first?.name).toBe('send')
    expect(second?.name).toBe('send')
    expect(provider.defineCalls).toBe(1) // only the first call writes
    expect(provider.getCalls).toBe(2) // both calls do the existence check
  })

  it('treats both-undefined frames as equal (idempotent)', async () => {
    const provider = fakeProvider()
    const tool = defineTool({
      id: 'communication.email.send',
      name: 'Send Email',
      description: 'Sends an email (no frame)',
      category: 'communication',
      verb: 'send',
      input: { type: 'object', properties: {} },
      handler: async () => ({ ok: true }),
    })

    await registerToolVerb(provider, tool)
    await registerToolVerb(provider, tool)

    expect(provider.defineCalls).toBe(1)
  })

  it('throws VerbRegistrationConflictError on conflicting frames', async () => {
    const provider = fakeProvider()
    const toolA = defineTool({
      id: 'a.send',
      name: 'A Send',
      description: 'A',
      category: 'communication',
      verb: 'send',
      frame: sendFrame,
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })
    const toolB = defineTool({
      id: 'b.send',
      name: 'B Send',
      description: 'B',
      category: 'communication',
      verb: 'send',
      frame: { subject: 'Agent', object: 'Sms' }, // different shape
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })

    await registerToolVerb(provider, toolA)

    await expect(registerToolVerb(provider, toolB)).rejects.toBeInstanceOf(
      VerbRegistrationConflictError
    )
    expect(provider.defineCalls).toBe(1) // second tool's defineVerb never called
  })

  it('treats incoming-undefined as a conflict when the existing verb has a frame', async () => {
    const provider = fakeProvider()
    const framed = defineTool({
      id: 'a.send',
      name: 'A',
      description: 'with frame',
      category: 'communication',
      verb: 'send',
      frame: sendFrame,
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })
    const unframed = defineTool({
      id: 'b.send',
      name: 'B',
      description: 'no frame',
      category: 'communication',
      verb: 'send',
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })

    await registerToolVerb(provider, framed)
    await expect(registerToolVerb(provider, unframed)).rejects.toBeInstanceOf(
      VerbRegistrationConflictError
    )
  })

  it('compares manner arrays as unordered sets (idempotent across reorder)', async () => {
    const provider = fakeProvider()
    const toolA = defineTool({
      id: 'a.move',
      name: 'A',
      description: 'A',
      category: 'system',
      verb: 'move',
      frame: { subject: 'Agent', manner: ['fast', 'quiet'] },
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })
    const toolB = defineTool({
      id: 'b.move',
      name: 'B',
      description: 'B',
      category: 'system',
      verb: 'move',
      frame: { subject: 'Agent', manner: ['quiet', 'fast'] },
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })

    await registerToolVerb(provider, toolA)
    await registerToolVerb(provider, toolB) // different order, same set

    expect(provider.defineCalls).toBe(1)
  })

  it('detects conflict when manner sets differ', async () => {
    const provider = fakeProvider()
    const toolA = defineTool({
      id: 'a.move',
      name: 'A',
      description: 'A',
      category: 'system',
      verb: 'move',
      frame: { subject: 'Agent', manner: ['fast'] },
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })
    const toolB = defineTool({
      id: 'b.move',
      name: 'B',
      description: 'B',
      category: 'system',
      verb: 'move',
      frame: { subject: 'Agent', manner: ['fast', 'slow'] },
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })

    await registerToolVerb(provider, toolA)
    await expect(registerToolVerb(provider, toolB)).rejects.toBeInstanceOf(
      VerbRegistrationConflictError
    )
  })

  it('passes description through to the registered Verb', async () => {
    const provider = fakeProvider()
    const tool = defineTool({
      id: 'communication.email.send',
      name: 'Send Email',
      description: 'Sends an email',
      category: 'communication',
      verb: 'send',
      frame: sendFrame,
      input: { type: 'object', properties: {} },
      handler: async () => ({}),
    })

    await registerToolVerb(provider, tool)
    const verb = provider.verbs.get('send')

    expect(verb?.description).toBe('Sends an email')
  })
})

describe('registerToolVerbs (bulk)', () => {
  it('registers all SVO-aware tools and skips legacy tools', async () => {
    const provider = fakeProvider()
    const tools = [
      defineTool({
        id: 'communication.email.send',
        name: 'Email',
        description: 'Email',
        category: 'communication',
        verb: 'send',
        frame: sendFrame,
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      }),
      defineTool({
        id: 'legacy.tool',
        name: 'Legacy',
        description: 'No verb',
        category: 'data',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      }),
      defineTool({
        id: 'media.transcribe',
        name: 'Transcribe',
        description: 'Transcribe',
        category: 'media',
        verb: 'transcribe',
        frame: { subject: 'Agent', object: 'Audio' },
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      }),
    ]

    const registered = await registerToolVerbs(provider, tools)

    expect(registered).toHaveLength(2)
    expect(registered.map((v) => v.name).sort()).toEqual(['send', 'transcribe'])
    expect(provider.defineCalls).toBe(2)
  })

  it('is idempotent across re-runs (safe to call at startup repeatedly)', async () => {
    const provider = fakeProvider()
    const tools = [
      defineTool({
        id: 'communication.email.send',
        name: 'Email',
        description: 'Email',
        category: 'communication',
        verb: 'send',
        frame: sendFrame,
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      }),
    ]

    await registerToolVerbs(provider, tools)
    await registerToolVerbs(provider, tools)

    expect(provider.defineCalls).toBe(1)
  })

  it('bootstrapTools is an alias of registerToolVerbs', () => {
    expect(bootstrapTools).toBe(registerToolVerbs)
  })

  it('throws on conflict and stops at the first conflicting tool', async () => {
    const provider = fakeProvider()
    const tools = [
      defineTool({
        id: 'a.send',
        name: 'A',
        description: 'A',
        category: 'communication',
        verb: 'send',
        frame: sendFrame,
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      }),
      defineTool({
        id: 'b.send',
        name: 'B',
        description: 'B',
        category: 'communication',
        verb: 'send',
        frame: { subject: 'Agent', object: 'Sms' },
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      }),
      defineTool({
        id: 'c.never',
        name: 'C',
        description: 'C',
        category: 'data',
        verb: 'never',
        input: { type: 'object', properties: {} },
        handler: async () => ({}),
      }),
    ]

    await expect(registerToolVerbs(provider, tools)).rejects.toBeInstanceOf(
      VerbRegistrationConflictError
    )
    // First tool succeeded, conflicting second halted the loop;
    // third tool was never reached.
    expect(provider.defineCalls).toBe(1)
    expect(provider.verbs.has('never')).toBe(false)
  })
})
