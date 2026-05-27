/**
 * Parity snapshot — `digital-workers.decide(agentAsWorker(agent), { options })`
 * MUST produce the SAME `generateObject` prompt + schema as the prior
 * `autonomous-agents.decide(options, context, settings)` did.
 *
 * Critical migration gate for PRD aip-2q19 (LLM-shape verbs slice).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('ai-functions', async () => {
  const actual = await vi.importActual<typeof import('ai-functions')>('ai-functions')
  return {
    ...actual,
    generateObject: vi.fn().mockResolvedValue({
      object: { decision: 'A', reasoning: 'mocked', confidence: 90 },
    }),
  }
})

import { generateObject } from 'ai-functions'
import { decide as standaloneDecide, __resetDeprecationNotices } from '../src/actions.js'
import { agentAsWorker } from '../src/worker.js'
import { Agent, Role } from '../src/index.js'
import { decide as workerDecide } from 'digital-workers'

const mockGenerateObject = vi.mocked(generateObject)

function makeAgent() {
  const role = Role({
    name: 'Decider',
    description: 'decides things',
    skills: ['judgement'],
  })
  return Agent({ name: 'TestAgent', role, mode: 'autonomous' })
}

describe('decide parity — autonomous-agents.decide vs digital-workers.decide(agentAsWorker)', () => {
  beforeEach(() => {
    mockGenerateObject.mockClear()
    __resetDeprecationNotices()
  })

  it('produces identical generateObject arguments without context', async () => {
    await standaloneDecide(['A', 'B', 'C'])
    const standaloneArgs = mockGenerateObject.mock.calls[0]?.[0]

    mockGenerateObject.mockClear()

    const worker = agentAsWorker(makeAgent())
    await workerDecide(worker, { options: ['A', 'B', 'C'] })
    const workerArgs = mockGenerateObject.mock.calls[0]?.[0]

    expect(workerArgs).toEqual(standaloneArgs)
  })

  it('produces identical generateObject arguments with string context', async () => {
    await standaloneDecide(['A', 'B'], 'pick the better letter')
    const standaloneArgs = mockGenerateObject.mock.calls[0]?.[0]

    mockGenerateObject.mockClear()

    const worker = agentAsWorker(makeAgent())
    await workerDecide(worker, { options: ['A', 'B'], context: 'pick the better letter' })
    const workerArgs = mockGenerateObject.mock.calls[0]?.[0]

    expect(workerArgs).toEqual(standaloneArgs)
  })

  it('snapshot of the canonical generateObject argument shape', async () => {
    await standaloneDecide(['red', 'green', 'blue'], 'choose the safest color')
    const args = mockGenerateObject.mock.calls[0]?.[0]

    expect(args).toMatchInlineSnapshot(`
      {
        "model": "sonnet",
        "prompt": "Make a decision between these options:
      1. red
      2. green
      3. blue

      Context: choose the safest color",
        "schema": {
          "confidence": "Confidence level 0-100 (number)",
          "decision": "red | green | blue",
          "reasoning": "Reasoning for this decision",
        },
        "system": "You are a strategic decision-maker. Evaluate options carefully and provide clear reasoning.",
        "temperature": 0.7,
      }
    `)
  })

  it('snapshot via the worker dispatch path matches the standalone snapshot', async () => {
    const worker = agentAsWorker(makeAgent())
    await workerDecide(worker, {
      options: ['red', 'green', 'blue'],
      context: 'choose the safest color',
    })
    const args = mockGenerateObject.mock.calls[0]?.[0]

    expect(args).toMatchInlineSnapshot(`
      {
        "model": "sonnet",
        "prompt": "Make a decision between these options:
      1. red
      2. green
      3. blue

      Context: choose the safest color",
        "schema": {
          "confidence": "Confidence level 0-100 (number)",
          "decision": "red | green | blue",
          "reasoning": "Reasoning for this decision",
        },
        "system": "You are a strategic decision-maker. Evaluate options carefully and provide clear reasoning.",
        "temperature": 0.7,
      }
    `)
  })
})
