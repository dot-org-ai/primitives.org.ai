/**
 * Parity snapshot — `digital-workers.ask(agentAsWorker(agent), q)` MUST produce
 * the SAME `generateObject` prompt + schema as the prior
 * `autonomous-agents.ask(q)` did.
 *
 * This is the critical migration gate for PRD aip-qozi (route Layer 5 through
 * digital-workers). Both paths build the `generateObject` arguments through the
 * shared `buildAskGenerateOptions` builder in `ask-dispatch.ts`; this test
 * asserts the construction is byte-for-byte identical.
 *
 * If this test breaks, the migration of every prior `autonomous-agents.ask`
 * callsite onto `digital-workers.ask` is no longer safe.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture every generateObject call the two paths make. Mock BEFORE the
// modules under test are imported so they pick up the mock.
vi.mock('ai-functions', async () => {
  const actual = await vi.importActual<typeof import('ai-functions')>('ai-functions')
  return {
    ...actual,
    generateObject: vi.fn().mockResolvedValue({
      object: { answer: 'mocked', reasoning: 'mocked reasoning' },
    }),
  }
})

import { generateObject } from 'ai-functions'
import { ask as standaloneAsk, __resetDeprecationNotices } from '../src/actions.js'
import { agentAsWorker } from '../src/worker.js'
import { Agent, Role } from '../src/index.js'
import { ask as workerAsk } from 'digital-workers'

const mockGenerateObject = vi.mocked(generateObject)

function makeAgent() {
  const role = Role({
    name: 'Reviewer',
    description: 'reviews things',
    skills: ['review', 'analysis'],
  })
  return Agent({ name: 'TestAgent', role, mode: 'autonomous' })
}

describe('ask parity — autonomous-agents.ask vs digital-workers.ask(agentAsWorker)', () => {
  beforeEach(() => {
    mockGenerateObject.mockClear()
    __resetDeprecationNotices()
  })

  it('produces identical generateObject arguments for a question with no context', async () => {
    // Path A: prior standalone autonomous-agents.ask
    await standaloneAsk('What is TypeScript?')
    const standaloneArgs = mockGenerateObject.mock.calls[0]?.[0]

    mockGenerateObject.mockClear()

    // Path B: digital-workers.ask(agentAsWorker(agent), …)
    const agent = makeAgent()
    const worker = agentAsWorker(agent)
    await workerAsk(worker, 'What is TypeScript?')
    const workerArgs = mockGenerateObject.mock.calls[0]?.[0]

    // The parity gate: every generateObject argument must match.
    expect(workerArgs).toEqual(standaloneArgs)
  })

  it('produces identical generateObject arguments for a question with context', async () => {
    const context = { project: 'web', language: 'ts' }

    await standaloneAsk('Which framework?', context)
    const standaloneArgs = mockGenerateObject.mock.calls[0]?.[0]

    mockGenerateObject.mockClear()

    const agent = makeAgent()
    const worker = agentAsWorker(agent)
    await workerAsk(worker, 'Which framework?', { context })
    const workerArgs = mockGenerateObject.mock.calls[0]?.[0]

    expect(workerArgs).toEqual(standaloneArgs)
  })

  it('produces a stable snapshot of the generateObject argument shape', async () => {
    await standaloneAsk('What is the capital of France?', { hint: 'European country' })
    const args = mockGenerateObject.mock.calls[0]?.[0]

    // Snapshot the exact prompt + schema + system + model + temperature shape.
    // If this snapshot changes, the parity contract has shifted and every prior
    // autonomous-agents.ask callsite needs re-validation.
    expect(args).toMatchInlineSnapshot(`
      {
        "model": "sonnet",
        "prompt": "Question: What is the capital of France?

      Context: {"hint":"European country"}",
        "schema": {
          "answer": "The answer to the question",
          "reasoning": "Supporting reasoning",
        },
        "system": "You are a knowledgeable AI assistant. Provide clear, accurate answers.",
        "temperature": 0.7,
      }
    `)
  })

  it('produces a stable snapshot via the worker dispatch path too', async () => {
    const agent = makeAgent()
    const worker = agentAsWorker(agent)
    await workerAsk(worker, 'What is the capital of France?', {
      context: { hint: 'European country' },
    })
    const args = mockGenerateObject.mock.calls[0]?.[0]

    // Identical shape to the standalone snapshot above — proves parity.
    expect(args).toMatchInlineSnapshot(`
      {
        "model": "sonnet",
        "prompt": "Question: What is the capital of France?

      Context: {"hint":"European country"}",
        "schema": {
          "answer": "The answer to the question",
          "reasoning": "Supporting reasoning",
        },
        "system": "You are a knowledgeable AI assistant. Provide clear, accurate answers.",
        "temperature": 0.7,
      }
    `)
  })

  it('preserves caller-supplied schema through the worker dispatch path', async () => {
    const customSchema = { topic: 'The topic', summary: 'A short summary' }

    const agent = makeAgent()
    const worker = agentAsWorker(agent)
    await workerAsk(worker, 'Summarise this.', {
      context: { text: 'hello world' },
      schema: customSchema,
    })
    const args = mockGenerateObject.mock.calls[0]?.[0]

    expect(args).toMatchObject({
      schema: customSchema,
      prompt: 'Question: Summarise this.\n\nContext: {"text":"hello world"}',
      model: 'sonnet',
    })
  })
})
