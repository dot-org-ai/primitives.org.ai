/**
 * Parity snapshot — `digital-workers.is(agentAsWorker(agent), value, type)`
 * MUST produce the SAME `generateObject` prompt + schema as the prior
 * `autonomous-agents.is(value, type)` did.
 *
 * Critical migration gate for PRD aip-2q19 (LLM-shape verbs slice).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai-functions', async () => {
  const actual = await vi.importActual<typeof import('ai-functions')>('ai-functions')
  return {
    ...actual,
    generateObject: vi.fn().mockResolvedValue({
      object: { isValid: true, reason: 'mocked validation' },
    }),
  }
})

import { generateObject } from 'ai-functions'
import { is as standaloneIs, __resetDeprecationNotices } from '../src/actions.js'
import { agentAsWorker } from '../src/worker.js'
import { Agent, Role } from '../src/index.js'
import { is as workerIs } from 'digital-workers'

const mockGenerateObject = vi.mocked(generateObject)

function makeAgent() {
  const role = Role({
    name: 'Validator',
    description: 'validates things',
    skills: ['validation'],
  })
  return Agent({ name: 'TestAgent', role, mode: 'autonomous' })
}

describe('is parity — autonomous-agents.is vs digital-workers.is(agentAsWorker)', () => {
  beforeEach(() => {
    mockGenerateObject.mockClear()
    __resetDeprecationNotices()
  })

  it('produces identical generateObject arguments for a string type', async () => {
    await standaloneIs('test@example.com', 'email')
    const standaloneArgs = mockGenerateObject.mock.calls[0]?.[0]

    mockGenerateObject.mockClear()

    const worker = agentAsWorker(makeAgent())
    await workerIs(worker, 'test@example.com', 'email')
    const workerArgs = mockGenerateObject.mock.calls[0]?.[0]

    expect(workerArgs).toEqual(standaloneArgs)
  })

  it('produces identical generateObject arguments for a schema', async () => {
    const schema = { name: 'Full name', age: 'Age (number)' }
    const value = { name: 'Alice', age: 30 }

    await standaloneIs(value, schema)
    const standaloneArgs = mockGenerateObject.mock.calls[0]?.[0]

    mockGenerateObject.mockClear()

    const worker = agentAsWorker(makeAgent())
    await workerIs(worker, value, schema)
    const workerArgs = mockGenerateObject.mock.calls[0]?.[0]

    expect(workerArgs).toEqual(standaloneArgs)
  })

  it('snapshot of the canonical generateObject argument shape for string type', async () => {
    await standaloneIs('hello@example.com', 'email')
    const args = mockGenerateObject.mock.calls[0]?.[0]

    expect(args).toMatchInlineSnapshot(`
      {
        "model": "sonnet",
        "prompt": "Value: "hello@example.com"

      Expected type: email",
        "schema": {
          "isValid": "Is this value a valid email? (boolean)",
          "reason": "Explanation",
        },
        "system": "You are a type validator. Determine if the value matches the expected type or schema.",
        "temperature": 0,
      }
    `)
  })

  it('snapshot via the worker dispatch path matches the standalone snapshot', async () => {
    const worker = agentAsWorker(makeAgent())
    await workerIs(worker, 'hello@example.com', 'email')
    const args = mockGenerateObject.mock.calls[0]?.[0]

    expect(args).toMatchInlineSnapshot(`
      {
        "model": "sonnet",
        "prompt": "Value: "hello@example.com"

      Expected type: email",
        "schema": {
          "isValid": "Is this value a valid email? (boolean)",
          "reason": "Explanation",
        },
        "system": "You are a type validator. Determine if the value matches the expected type or schema.",
        "temperature": 0,
      }
    `)
  })
})
