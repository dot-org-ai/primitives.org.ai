/**
 * Parity snapshot — `digital-workers.generate(agentAsWorker(agent), prompt)`
 * MUST produce the SAME `generateObject` prompt + schema as the prior
 * `autonomous-agents.generate({ prompt })` did.
 *
 * Critical migration gate for PRD aip-2q19 (LLM-shape verbs slice).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai-functions', async () => {
  const actual = await vi.importActual<typeof import('ai-functions')>('ai-functions')
  return {
    ...actual,
    generateObject: vi.fn().mockResolvedValue({
      object: { result: 'mocked generation' },
    }),
  }
})

import { generateObject } from 'ai-functions'
import { generate as standaloneGenerate, __resetDeprecationNotices } from '../src/actions.js'
import { agentAsWorker } from '../src/worker.js'
import { Agent, Role } from '../src/index.js'
import { generate as workerGenerate } from 'digital-workers'

const mockGenerateObject = vi.mocked(generateObject)

function makeAgent() {
  const role = Role({
    name: 'Writer',
    description: 'writes things',
    skills: ['content'],
  })
  return Agent({ name: 'TestAgent', role, mode: 'autonomous' })
}

describe('generate parity — autonomous-agents.generate vs digital-workers.generate(agentAsWorker)', () => {
  beforeEach(() => {
    mockGenerateObject.mockClear()
    __resetDeprecationNotices()
  })

  it('produces identical generateObject arguments with default schema', async () => {
    await standaloneGenerate({ prompt: 'Write a haiku about code' })
    const standaloneArgs = mockGenerateObject.mock.calls[0]?.[0]

    mockGenerateObject.mockClear()

    const worker = agentAsWorker(makeAgent())
    await workerGenerate(worker, 'Write a haiku about code')
    const workerArgs = mockGenerateObject.mock.calls[0]?.[0]

    expect(workerArgs).toEqual(standaloneArgs)
  })

  it('produces identical generateObject arguments with custom schema', async () => {
    const schema = { title: 'Title', body: 'Body content' }

    await standaloneGenerate({ prompt: 'Write a blog post', schema })
    const standaloneArgs = mockGenerateObject.mock.calls[0]?.[0]

    mockGenerateObject.mockClear()

    const worker = agentAsWorker(makeAgent())
    await workerGenerate(worker, 'Write a blog post', { schema })
    const workerArgs = mockGenerateObject.mock.calls[0]?.[0]

    expect(workerArgs).toEqual(standaloneArgs)
  })

  it('snapshot of the canonical generateObject argument shape', async () => {
    await standaloneGenerate({ prompt: 'Write a haiku about code' })
    const args = mockGenerateObject.mock.calls[0]?.[0]

    expect(args).toMatchInlineSnapshot(`
      {
        "model": "sonnet",
        "prompt": "Write a haiku about code",
        "schema": {
          "result": "Generated content",
        },
        "system": "You are a creative AI assistant. Generate high-quality content.",
        "temperature": 0.8,
      }
    `)
  })

  it('snapshot via the worker dispatch path matches the standalone snapshot', async () => {
    const worker = agentAsWorker(makeAgent())
    await workerGenerate(worker, 'Write a haiku about code')
    const args = mockGenerateObject.mock.calls[0]?.[0]

    expect(args).toMatchInlineSnapshot(`
      {
        "model": "sonnet",
        "prompt": "Write a haiku about code",
        "schema": {
          "result": "Generated content",
        },
        "system": "You are a creative AI assistant. Generate high-quality content.",
        "temperature": 0.8,
      }
    `)
  })
})
