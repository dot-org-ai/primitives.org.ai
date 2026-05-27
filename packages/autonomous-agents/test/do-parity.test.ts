/**
 * Parity snapshot — `digital-workers.do(agentAsWorker(agent), task, options)`
 * MUST produce the SAME `generateObject` prompt + schema as the prior
 * `autonomous-agents.do(task, context, options)` did.
 *
 * The critical migration gate for PRD aip-2q19 (LLM-shape verbs slice). Both
 * paths build the `generateObject` arguments through the shared
 * `runDo`/`buildDoGenerateOptions` builder in `ask-dispatch.ts`; this test
 * asserts the construction is byte-for-byte identical.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai-functions', async () => {
  const actual = await vi.importActual<typeof import('ai-functions')>('ai-functions')
  return {
    ...actual,
    generateObject: vi.fn().mockResolvedValue({
      object: { result: 'mocked task result' },
    }),
  }
})

import { generateObject } from 'ai-functions'
import { doAction, __resetDeprecationNotices } from '../src/actions.js'
import { agentAsWorker } from '../src/worker.js'
import { Agent, Role } from '../src/index.js'
import { do as workerDo } from 'digital-workers'

const mockGenerateObject = vi.mocked(generateObject)

function makeAgent() {
  const role = Role({
    name: 'Worker',
    description: 'does things',
    skills: ['execution'],
  })
  return Agent({ name: 'TestAgent', role, mode: 'autonomous' })
}

describe('do parity — autonomous-agents.do vs digital-workers.do(agentAsWorker)', () => {
  beforeEach(() => {
    mockGenerateObject.mockClear()
    __resetDeprecationNotices()
  })

  it('produces identical generateObject arguments for a task with no context', async () => {
    await doAction('Calculate 2+2')
    const standaloneArgs = mockGenerateObject.mock.calls[0]?.[0]

    mockGenerateObject.mockClear()

    const worker = agentAsWorker(makeAgent())
    await workerDo(worker, 'Calculate 2+2')
    const workerArgs = mockGenerateObject.mock.calls[0]?.[0]

    expect(workerArgs).toEqual(standaloneArgs)
  })

  it('produces identical generateObject arguments for a task with context', async () => {
    const context = { input: [1, 2, 3] }

    await doAction('Sum the array', context)
    const standaloneArgs = mockGenerateObject.mock.calls[0]?.[0]

    mockGenerateObject.mockClear()

    const worker = agentAsWorker(makeAgent())
    await workerDo(worker, 'Sum the array', { context })
    const workerArgs = mockGenerateObject.mock.calls[0]?.[0]

    expect(workerArgs).toEqual(standaloneArgs)
  })

  it('snapshot of the canonical generateObject argument shape', async () => {
    await doAction('Summarise the input', { text: 'hello world' })
    const args = mockGenerateObject.mock.calls[0]?.[0]

    expect(args).toMatchInlineSnapshot(`
      {
        "model": "sonnet",
        "prompt": "Task: Summarise the input

      Context: {"text":"hello world"}",
        "schema": {
          "result": "The result of the task",
        },
        "system": "You are a helpful AI assistant. Execute tasks accurately and thoroughly.",
        "temperature": 0.7,
      }
    `)
  })

  it('snapshot via the worker dispatch path matches the standalone snapshot', async () => {
    const worker = agentAsWorker(makeAgent())
    await workerDo(worker, 'Summarise the input', { context: { text: 'hello world' } })
    const args = mockGenerateObject.mock.calls[0]?.[0]

    expect(args).toMatchInlineSnapshot(`
      {
        "model": "sonnet",
        "prompt": "Task: Summarise the input

      Context: {"text":"hello world"}",
        "schema": {
          "result": "The result of the task",
        },
        "system": "You are a helpful AI assistant. Execute tasks accurately and thoroughly.",
        "temperature": 0.7,
      }
    `)
  })
})
