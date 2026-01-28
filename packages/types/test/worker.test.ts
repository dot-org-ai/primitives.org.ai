/**
 * Worker, Agent, Human Types - TDD RED Phase Tests
 *
 * These tests define the expected interface for Worker types in schema.org.ai:
 * - Worker: Base type for work executors (abstract base)
 * - Agent: AI agent that can execute work
 * - Human: Human worker that can execute work
 *
 * Worker hierarchy:
 *   Thing
 *     └── Worker (base)
 *           ├── Agent (AI)
 *           └── Human (Person)
 *
 * These tests WILL FAIL until the implementation is complete in GREEN phase.
 */

import { describe, it, expect } from 'vitest'

describe('Worker Types (schema.org.ai)', () => {
  // ==========================================================================
  // Worker (Base Type)
  // ==========================================================================
  describe('Worker (base type)', () => {
    describe('interface shape', () => {
      it('should export Worker type', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('Worker')
      })

      it('should have required $id field (URL identity)', async () => {
        const { Worker } = (await import('../src/index.js')) as {
          Worker: {
            $id: string
            $type: string
            status: string
          }
        }
        // Worker must have URL-based identity like Thing
        expect(Worker).toBeDefined()
      })

      it('should have required $type field', async () => {
        const { Worker } = (await import('../src/index.js')) as {
          Worker: {
            $type: 'https://schema.org.ai/Worker'
          }
        }
        expect(Worker).toBeDefined()
      })

      it('should have required status field', async () => {
        // Worker status: 'idle' | 'working' | 'paused' | 'offline'
        const { Worker } = (await import('../src/index.js')) as {
          Worker: {
            status: 'idle' | 'working' | 'paused' | 'offline'
          }
        }
        expect(Worker).toBeDefined()
      })

      it('should have optional name field', async () => {
        const { Worker } = (await import('../src/index.js')) as {
          Worker: {
            name?: string
          }
        }
        expect(Worker).toBeDefined()
      })

      it('should have optional capabilities array', async () => {
        // What the worker can do
        const { Worker } = (await import('../src/index.js')) as {
          Worker: {
            capabilities?: string[]
          }
        }
        expect(Worker).toBeDefined()
      })

      it('should have optional currentTask field', async () => {
        // Reference to what the worker is currently doing
        const { Worker } = (await import('../src/index.js')) as {
          Worker: {
            currentTask?: string
          }
        }
        expect(Worker).toBeDefined()
      })

      it('should extend Thing interface', async () => {
        const { Worker, Thing } = (await import('../src/index.js')) as {
          Worker: object
          Thing: object
        }
        // Worker should be a subtype of Thing
        expect(Worker).toBeDefined()
        expect(Thing).toBeDefined()
      })
    })

    describe('WorkerSchema Zod validation', () => {
      it('should export WorkerSchema', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('WorkerSchema')
      })

      it('should validate a valid Worker object', async () => {
        const { WorkerSchema } = (await import('../src/index.js')) as {
          WorkerSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = WorkerSchema.safeParse({
          $id: 'https://example.com/workers/1',
          $type: 'https://schema.org.ai/Worker',
          status: 'idle',
        })
        expect(result.success).toBe(true)
      })

      it('should validate Worker with optional fields', async () => {
        const { WorkerSchema } = (await import('../src/index.js')) as {
          WorkerSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = WorkerSchema.safeParse({
          $id: 'https://example.com/workers/1',
          $type: 'https://schema.org.ai/Worker',
          status: 'working',
          name: 'Worker 1',
          capabilities: ['code', 'text'],
          currentTask: 'https://example.com/tasks/1',
        })
        expect(result.success).toBe(true)
      })

      it('should reject Worker without $id', async () => {
        const { WorkerSchema } = (await import('../src/index.js')) as {
          WorkerSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = WorkerSchema.safeParse({
          $type: 'https://schema.org.ai/Worker',
          status: 'idle',
        })
        expect(result.success).toBe(false)
      })

      it('should reject Worker without status', async () => {
        const { WorkerSchema } = (await import('../src/index.js')) as {
          WorkerSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = WorkerSchema.safeParse({
          $id: 'https://example.com/workers/1',
          $type: 'https://schema.org.ai/Worker',
        })
        expect(result.success).toBe(false)
      })

      it('should reject Worker with invalid status', async () => {
        const { WorkerSchema } = (await import('../src/index.js')) as {
          WorkerSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = WorkerSchema.safeParse({
          $id: 'https://example.com/workers/1',
          $type: 'https://schema.org.ai/Worker',
          status: 'invalid-status',
        })
        expect(result.success).toBe(false)
      })

      it('should reject non-object values', async () => {
        const { WorkerSchema } = (await import('../src/index.js')) as {
          WorkerSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        expect(WorkerSchema.safeParse(null).success).toBe(false)
        expect(WorkerSchema.safeParse(undefined).success).toBe(false)
        expect(WorkerSchema.safeParse('string').success).toBe(false)
        expect(WorkerSchema.safeParse(123).success).toBe(false)
      })
    })

    describe('isWorker type guard', () => {
      it('should export isWorker function', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('isWorker')
        expect(typeof module.isWorker).toBe('function')
      })

      it('should return true for valid Worker', async () => {
        const { isWorker } = (await import('../src/index.js')) as {
          isWorker: (v: unknown) => boolean
        }
        const worker = {
          $id: 'https://example.com/workers/1',
          $type: 'https://schema.org.ai/Worker',
          status: 'idle',
        }
        expect(isWorker(worker)).toBe(true)
      })

      it('should return true for Agent (subtype)', async () => {
        const { isWorker } = (await import('../src/index.js')) as {
          isWorker: (v: unknown) => boolean
        }
        const agent = {
          $id: 'https://example.com/agents/1',
          $type: 'https://schema.org.ai/Agent',
          status: 'working',
          model: 'claude-3-opus',
          autonomous: true,
        }
        expect(isWorker(agent)).toBe(true)
      })

      it('should return true for Human (subtype)', async () => {
        const { isWorker } = (await import('../src/index.js')) as {
          isWorker: (v: unknown) => boolean
        }
        const human = {
          $id: 'https://example.com/humans/1',
          $type: 'https://schema.org.ai/Human',
          status: 'idle',
          email: 'human@example.com',
        }
        expect(isWorker(human)).toBe(true)
      })

      it('should return false for invalid data', async () => {
        const { isWorker } = (await import('../src/index.js')) as {
          isWorker: (v: unknown) => boolean
        }
        expect(isWorker({ invalid: 'data' })).toBe(false)
        expect(isWorker(null)).toBe(false)
        expect(isWorker(undefined)).toBe(false)
      })
    })

    describe('WorkerStatus type', () => {
      it('should export WorkerStatus type', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('WorkerStatus')
      })

      it('should include idle status', async () => {
        const { WorkerStatus } = (await import('../src/index.js')) as {
          WorkerStatus: readonly string[]
        }
        expect(WorkerStatus).toContain('idle')
      })

      it('should include working status', async () => {
        const { WorkerStatus } = (await import('../src/index.js')) as {
          WorkerStatus: readonly string[]
        }
        expect(WorkerStatus).toContain('working')
      })

      it('should include paused status', async () => {
        const { WorkerStatus } = (await import('../src/index.js')) as {
          WorkerStatus: readonly string[]
        }
        expect(WorkerStatus).toContain('paused')
      })

      it('should include offline status', async () => {
        const { WorkerStatus } = (await import('../src/index.js')) as {
          WorkerStatus: readonly string[]
        }
        expect(WorkerStatus).toContain('offline')
      })
    })
  })

  // ==========================================================================
  // Agent Type (AI Worker)
  // ==========================================================================
  describe('Agent (AI worker)', () => {
    describe('interface shape', () => {
      it('should export Agent type', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('Agent')
      })

      it('should have $type of Agent', async () => {
        const { Agent } = (await import('../src/index.js')) as {
          Agent: {
            $type: 'https://schema.org.ai/Agent'
          }
        }
        expect(Agent).toBeDefined()
      })

      it('should have required model field', async () => {
        // What AI model powers this agent
        const { Agent } = (await import('../src/index.js')) as {
          Agent: {
            model: string
          }
        }
        expect(Agent).toBeDefined()
      })

      it('should have required autonomous field', async () => {
        // Whether agent can act without human approval
        const { Agent } = (await import('../src/index.js')) as {
          Agent: {
            autonomous: boolean
          }
        }
        expect(Agent).toBeDefined()
      })

      it('should have optional provider field', async () => {
        // Who provides the AI (anthropic, openai, etc.)
        const { Agent } = (await import('../src/index.js')) as {
          Agent: {
            provider?: string
          }
        }
        expect(Agent).toBeDefined()
      })

      it('should have optional systemPrompt field', async () => {
        // Base instructions for the agent
        const { Agent } = (await import('../src/index.js')) as {
          Agent: {
            systemPrompt?: string
          }
        }
        expect(Agent).toBeDefined()
      })

      it('should have optional temperature field', async () => {
        // Creativity/randomness setting
        const { Agent } = (await import('../src/index.js')) as {
          Agent: {
            temperature?: number
          }
        }
        expect(Agent).toBeDefined()
      })

      it('should have optional maxTokens field', async () => {
        // Token limit for responses
        const { Agent } = (await import('../src/index.js')) as {
          Agent: {
            maxTokens?: number
          }
        }
        expect(Agent).toBeDefined()
      })

      it('should have optional tools array', async () => {
        // Available tools/functions for the agent
        const { Agent } = (await import('../src/index.js')) as {
          Agent: {
            tools?: string[]
          }
        }
        expect(Agent).toBeDefined()
      })

      it('should inherit from Worker (have status)', async () => {
        const { Agent } = (await import('../src/index.js')) as {
          Agent: {
            status: 'idle' | 'working' | 'paused' | 'offline'
          }
        }
        expect(Agent).toBeDefined()
      })
    })

    describe('AgentSchema Zod validation', () => {
      it('should export AgentSchema', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('AgentSchema')
      })

      it('should validate a valid Agent object', async () => {
        const { AgentSchema } = (await import('../src/index.js')) as {
          AgentSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = AgentSchema.safeParse({
          $id: 'https://example.com/agents/1',
          $type: 'https://schema.org.ai/Agent',
          status: 'idle',
          model: 'claude-3-opus',
          autonomous: false,
        })
        expect(result.success).toBe(true)
      })

      it('should validate Agent with all optional fields', async () => {
        const { AgentSchema } = (await import('../src/index.js')) as {
          AgentSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = AgentSchema.safeParse({
          $id: 'https://example.com/agents/1',
          $type: 'https://schema.org.ai/Agent',
          status: 'working',
          name: 'Claude Assistant',
          model: 'claude-3-opus',
          autonomous: true,
          provider: 'anthropic',
          systemPrompt: 'You are a helpful assistant.',
          temperature: 0.7,
          maxTokens: 4096,
          tools: ['code_interpreter', 'web_search'],
          capabilities: ['text', 'code', 'vision'],
        })
        expect(result.success).toBe(true)
      })

      it('should reject Agent without model', async () => {
        const { AgentSchema } = (await import('../src/index.js')) as {
          AgentSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = AgentSchema.safeParse({
          $id: 'https://example.com/agents/1',
          $type: 'https://schema.org.ai/Agent',
          status: 'idle',
          autonomous: false,
        })
        expect(result.success).toBe(false)
      })

      it('should reject Agent without autonomous', async () => {
        const { AgentSchema } = (await import('../src/index.js')) as {
          AgentSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = AgentSchema.safeParse({
          $id: 'https://example.com/agents/1',
          $type: 'https://schema.org.ai/Agent',
          status: 'idle',
          model: 'claude-3-opus',
        })
        expect(result.success).toBe(false)
      })

      it('should reject Agent with non-boolean autonomous', async () => {
        const { AgentSchema } = (await import('../src/index.js')) as {
          AgentSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = AgentSchema.safeParse({
          $id: 'https://example.com/agents/1',
          $type: 'https://schema.org.ai/Agent',
          status: 'idle',
          model: 'claude-3-opus',
          autonomous: 'yes',
        })
        expect(result.success).toBe(false)
      })

      it('should reject Agent with invalid temperature', async () => {
        const { AgentSchema } = (await import('../src/index.js')) as {
          AgentSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = AgentSchema.safeParse({
          $id: 'https://example.com/agents/1',
          $type: 'https://schema.org.ai/Agent',
          status: 'idle',
          model: 'claude-3-opus',
          autonomous: false,
          temperature: 3.0, // Should be 0-2 typically
        })
        expect(result.success).toBe(false)
      })

      it('should reject Agent with wrong $type', async () => {
        const { AgentSchema } = (await import('../src/index.js')) as {
          AgentSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = AgentSchema.safeParse({
          $id: 'https://example.com/agents/1',
          $type: 'https://schema.org.ai/Human',
          status: 'idle',
          model: 'claude-3-opus',
          autonomous: false,
        })
        expect(result.success).toBe(false)
      })
    })

    describe('isAgent type guard', () => {
      it('should export isAgent function', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('isAgent')
        expect(typeof module.isAgent).toBe('function')
      })

      it('should return true for valid Agent', async () => {
        const { isAgent } = (await import('../src/index.js')) as {
          isAgent: (v: unknown) => boolean
        }
        const agent = {
          $id: 'https://example.com/agents/1',
          $type: 'https://schema.org.ai/Agent',
          status: 'idle',
          model: 'claude-3-opus',
          autonomous: false,
        }
        expect(isAgent(agent)).toBe(true)
      })

      it('should return false for Worker (base type)', async () => {
        const { isAgent } = (await import('../src/index.js')) as {
          isAgent: (v: unknown) => boolean
        }
        const worker = {
          $id: 'https://example.com/workers/1',
          $type: 'https://schema.org.ai/Worker',
          status: 'idle',
        }
        expect(isAgent(worker)).toBe(false)
      })

      it('should return false for Human', async () => {
        const { isAgent } = (await import('../src/index.js')) as {
          isAgent: (v: unknown) => boolean
        }
        const human = {
          $id: 'https://example.com/humans/1',
          $type: 'https://schema.org.ai/Human',
          status: 'idle',
          email: 'human@example.com',
        }
        expect(isAgent(human)).toBe(false)
      })

      it('should return false for invalid data', async () => {
        const { isAgent } = (await import('../src/index.js')) as {
          isAgent: (v: unknown) => boolean
        }
        expect(isAgent({ invalid: 'data' })).toBe(false)
        expect(isAgent(null)).toBe(false)
        expect(isAgent(undefined)).toBe(false)
      })
    })

    describe('createAgent factory', () => {
      it('should export createAgent function', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('createAgent')
        expect(typeof module.createAgent).toBe('function')
      })

      it('should create a valid Agent with required fields', async () => {
        const { createAgent, isAgent } = (await import('../src/index.js')) as {
          createAgent: (opts: { model: string; autonomous: boolean }) => object
          isAgent: (v: unknown) => boolean
        }
        const agent = createAgent({
          model: 'claude-3-opus',
          autonomous: false,
        })
        expect(isAgent(agent)).toBe(true)
      })

      it('should auto-generate $id', async () => {
        const { createAgent } = (await import('../src/index.js')) as {
          createAgent: (opts: { model: string; autonomous: boolean }) => { $id: string }
        }
        const agent = createAgent({
          model: 'claude-3-opus',
          autonomous: false,
        })
        expect(agent.$id).toBeDefined()
        expect(agent.$id).toMatch(/^https:\/\//)
      })

      it('should set correct $type', async () => {
        const { createAgent } = (await import('../src/index.js')) as {
          createAgent: (opts: { model: string; autonomous: boolean }) => { $type: string }
        }
        const agent = createAgent({
          model: 'claude-3-opus',
          autonomous: false,
        })
        expect(agent.$type).toBe('https://schema.org.ai/Agent')
      })

      it('should default status to idle', async () => {
        const { createAgent } = (await import('../src/index.js')) as {
          createAgent: (opts: { model: string; autonomous: boolean }) => { status: string }
        }
        const agent = createAgent({
          model: 'claude-3-opus',
          autonomous: false,
        })
        expect(agent.status).toBe('idle')
      })

      it('should allow custom options', async () => {
        const { createAgent } = (await import('../src/index.js')) as {
          createAgent: (opts: {
            model: string
            autonomous: boolean
            name?: string
            provider?: string
            temperature?: number
          }) => {
            name: string
            provider: string
            temperature: number
          }
        }
        const agent = createAgent({
          model: 'gpt-4',
          autonomous: true,
          name: 'GPT Assistant',
          provider: 'openai',
          temperature: 0.5,
        })
        expect(agent.name).toBe('GPT Assistant')
        expect(agent.provider).toBe('openai')
        expect(agent.temperature).toBe(0.5)
      })
    })
  })

  // ==========================================================================
  // Human Type (Human Worker)
  // ==========================================================================
  describe('Human (human worker)', () => {
    describe('interface shape', () => {
      it('should export Human type', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('Human')
      })

      it('should have $type of Human', async () => {
        const { Human } = (await import('../src/index.js')) as {
          Human: {
            $type: 'https://schema.org.ai/Human'
          }
        }
        expect(Human).toBeDefined()
      })

      it('should have optional email field', async () => {
        const { Human } = (await import('../src/index.js')) as {
          Human: {
            email?: string
          }
        }
        expect(Human).toBeDefined()
      })

      it('should have optional role field', async () => {
        const { Human } = (await import('../src/index.js')) as {
          Human: {
            role?: string
          }
        }
        expect(Human).toBeDefined()
      })

      it('should have optional department field', async () => {
        const { Human } = (await import('../src/index.js')) as {
          Human: {
            department?: string
          }
        }
        expect(Human).toBeDefined()
      })

      it('should have optional manager field', async () => {
        // Reference to another Human
        const { Human } = (await import('../src/index.js')) as {
          Human: {
            manager?: string
          }
        }
        expect(Human).toBeDefined()
      })

      it('should have optional timezone field', async () => {
        const { Human } = (await import('../src/index.js')) as {
          Human: {
            timezone?: string
          }
        }
        expect(Human).toBeDefined()
      })

      it('should have optional availability field', async () => {
        // Working hours, schedule, etc.
        const { Human } = (await import('../src/index.js')) as {
          Human: {
            availability?: {
              schedule?: string
              workingHours?: { start: string; end: string }
            }
          }
        }
        expect(Human).toBeDefined()
      })

      it('should inherit from Worker (have status)', async () => {
        const { Human } = (await import('../src/index.js')) as {
          Human: {
            status: 'idle' | 'working' | 'paused' | 'offline'
          }
        }
        expect(Human).toBeDefined()
      })
    })

    describe('HumanSchema Zod validation', () => {
      it('should export HumanSchema', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('HumanSchema')
      })

      it('should validate a valid Human object', async () => {
        const { HumanSchema } = (await import('../src/index.js')) as {
          HumanSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = HumanSchema.safeParse({
          $id: 'https://example.com/humans/1',
          $type: 'https://schema.org.ai/Human',
          status: 'idle',
        })
        expect(result.success).toBe(true)
      })

      it('should validate Human with all optional fields', async () => {
        const { HumanSchema } = (await import('../src/index.js')) as {
          HumanSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = HumanSchema.safeParse({
          $id: 'https://example.com/humans/1',
          $type: 'https://schema.org.ai/Human',
          status: 'working',
          name: 'Jane Doe',
          email: 'jane@example.com',
          role: 'Senior Engineer',
          department: 'Engineering',
          manager: 'https://example.com/humans/manager-1',
          timezone: 'America/Los_Angeles',
          availability: {
            schedule: 'weekdays',
            workingHours: { start: '09:00', end: '17:00' },
          },
          capabilities: ['code-review', 'architecture', 'mentoring'],
        })
        expect(result.success).toBe(true)
      })

      it('should validate Human with valid email', async () => {
        const { HumanSchema } = (await import('../src/index.js')) as {
          HumanSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = HumanSchema.safeParse({
          $id: 'https://example.com/humans/1',
          $type: 'https://schema.org.ai/Human',
          status: 'idle',
          email: 'valid@example.com',
        })
        expect(result.success).toBe(true)
      })

      it('should reject Human with invalid email', async () => {
        const { HumanSchema } = (await import('../src/index.js')) as {
          HumanSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = HumanSchema.safeParse({
          $id: 'https://example.com/humans/1',
          $type: 'https://schema.org.ai/Human',
          status: 'idle',
          email: 'not-an-email',
        })
        expect(result.success).toBe(false)
      })

      it('should reject Human with wrong $type', async () => {
        const { HumanSchema } = (await import('../src/index.js')) as {
          HumanSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = HumanSchema.safeParse({
          $id: 'https://example.com/humans/1',
          $type: 'https://schema.org.ai/Agent',
          status: 'idle',
        })
        expect(result.success).toBe(false)
      })

      it('should reject Human without status', async () => {
        const { HumanSchema } = (await import('../src/index.js')) as {
          HumanSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        const result = HumanSchema.safeParse({
          $id: 'https://example.com/humans/1',
          $type: 'https://schema.org.ai/Human',
        })
        expect(result.success).toBe(false)
      })

      it('should reject non-object values', async () => {
        const { HumanSchema } = (await import('../src/index.js')) as {
          HumanSchema: { safeParse: (v: unknown) => { success: boolean } }
        }
        expect(HumanSchema.safeParse(null).success).toBe(false)
        expect(HumanSchema.safeParse(undefined).success).toBe(false)
        expect(HumanSchema.safeParse('string').success).toBe(false)
      })
    })

    describe('isHuman type guard', () => {
      it('should export isHuman function', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('isHuman')
        expect(typeof module.isHuman).toBe('function')
      })

      it('should return true for valid Human', async () => {
        const { isHuman } = (await import('../src/index.js')) as {
          isHuman: (v: unknown) => boolean
        }
        const human = {
          $id: 'https://example.com/humans/1',
          $type: 'https://schema.org.ai/Human',
          status: 'idle',
        }
        expect(isHuman(human)).toBe(true)
      })

      it('should return false for Worker (base type)', async () => {
        const { isHuman } = (await import('../src/index.js')) as {
          isHuman: (v: unknown) => boolean
        }
        const worker = {
          $id: 'https://example.com/workers/1',
          $type: 'https://schema.org.ai/Worker',
          status: 'idle',
        }
        expect(isHuman(worker)).toBe(false)
      })

      it('should return false for Agent', async () => {
        const { isHuman } = (await import('../src/index.js')) as {
          isHuman: (v: unknown) => boolean
        }
        const agent = {
          $id: 'https://example.com/agents/1',
          $type: 'https://schema.org.ai/Agent',
          status: 'idle',
          model: 'claude-3-opus',
          autonomous: false,
        }
        expect(isHuman(agent)).toBe(false)
      })

      it('should return false for invalid data', async () => {
        const { isHuman } = (await import('../src/index.js')) as {
          isHuman: (v: unknown) => boolean
        }
        expect(isHuman({ invalid: 'data' })).toBe(false)
        expect(isHuman(null)).toBe(false)
        expect(isHuman(undefined)).toBe(false)
      })
    })

    describe('createHuman factory', () => {
      it('should export createHuman function', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('createHuman')
        expect(typeof module.createHuman).toBe('function')
      })

      it('should create a valid Human with minimal fields', async () => {
        const { createHuman, isHuman } = (await import('../src/index.js')) as {
          createHuman: (opts?: object) => object
          isHuman: (v: unknown) => boolean
        }
        const human = createHuman()
        expect(isHuman(human)).toBe(true)
      })

      it('should auto-generate $id', async () => {
        const { createHuman } = (await import('../src/index.js')) as {
          createHuman: (opts?: object) => { $id: string }
        }
        const human = createHuman()
        expect(human.$id).toBeDefined()
        expect(human.$id).toMatch(/^https:\/\//)
      })

      it('should set correct $type', async () => {
        const { createHuman } = (await import('../src/index.js')) as {
          createHuman: (opts?: object) => { $type: string }
        }
        const human = createHuman()
        expect(human.$type).toBe('https://schema.org.ai/Human')
      })

      it('should default status to idle', async () => {
        const { createHuman } = (await import('../src/index.js')) as {
          createHuman: (opts?: object) => { status: string }
        }
        const human = createHuman()
        expect(human.status).toBe('idle')
      })

      it('should allow custom options', async () => {
        const { createHuman } = (await import('../src/index.js')) as {
          createHuman: (opts: {
            name?: string
            email?: string
            role?: string
            department?: string
          }) => {
            name: string
            email: string
            role: string
            department: string
          }
        }
        const human = createHuman({
          name: 'John Smith',
          email: 'john@example.com',
          role: 'Engineer',
          department: 'Platform',
        })
        expect(human.name).toBe('John Smith')
        expect(human.email).toBe('john@example.com')
        expect(human.role).toBe('Engineer')
        expect(human.department).toBe('Platform')
      })
    })
  })

  // ==========================================================================
  // Type Relationships and Constants
  // ==========================================================================
  describe('Type relationships and constants', () => {
    describe('type URLs', () => {
      it('should export WORKER_TYPE constant', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('WORKER_TYPE')
        expect(module.WORKER_TYPE).toBe('https://schema.org.ai/Worker')
      })

      it('should export AGENT_TYPE constant', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('AGENT_TYPE')
        expect(module.AGENT_TYPE).toBe('https://schema.org.ai/Agent')
      })

      it('should export HUMAN_TYPE constant', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('HUMAN_TYPE')
        expect(module.HUMAN_TYPE).toBe('https://schema.org.ai/Human')
      })
    })

    describe('type hierarchy', () => {
      it('should recognize Agent as Worker subtype', async () => {
        const { isWorker } = (await import('../src/index.js')) as {
          isWorker: (v: unknown) => boolean
        }
        const agent = {
          $id: 'https://example.com/agents/1',
          $type: 'https://schema.org.ai/Agent',
          status: 'idle',
          model: 'claude-3-opus',
          autonomous: false,
        }
        expect(isWorker(agent)).toBe(true)
      })

      it('should recognize Human as Worker subtype', async () => {
        const { isWorker } = (await import('../src/index.js')) as {
          isWorker: (v: unknown) => boolean
        }
        const human = {
          $id: 'https://example.com/humans/1',
          $type: 'https://schema.org.ai/Human',
          status: 'idle',
        }
        expect(isWorker(human)).toBe(true)
      })

      it('should not recognize regular Thing as Worker', async () => {
        const { isWorker } = (await import('../src/index.js')) as {
          isWorker: (v: unknown) => boolean
        }
        const thing = {
          $id: 'https://example.com/things/1',
          $type: 'https://schema.org.ai/Thing',
        }
        expect(isWorker(thing)).toBe(false)
      })
    })

    describe('Worker list types', () => {
      it('should export WorkerTypes constant array', async () => {
        const module = await import('../src/index.js')
        expect(module).toHaveProperty('WorkerTypes')
        expect(Array.isArray(module.WorkerTypes)).toBe(true)
      })

      it('should include Worker in WorkerTypes', async () => {
        const { WorkerTypes } = (await import('../src/index.js')) as {
          WorkerTypes: string[]
        }
        expect(WorkerTypes).toContain('https://schema.org.ai/Worker')
      })

      it('should include Agent in WorkerTypes', async () => {
        const { WorkerTypes } = (await import('../src/index.js')) as {
          WorkerTypes: string[]
        }
        expect(WorkerTypes).toContain('https://schema.org.ai/Agent')
      })

      it('should include Human in WorkerTypes', async () => {
        const { WorkerTypes } = (await import('../src/index.js')) as {
          WorkerTypes: string[]
        }
        expect(WorkerTypes).toContain('https://schema.org.ai/Human')
      })
    })
  })

  // ==========================================================================
  // Integration with Thing
  // ==========================================================================
  describe('Integration with Thing base type', () => {
    it('Worker should have Thing properties available', async () => {
      const { WorkerSchema } = (await import('../src/index.js')) as {
        WorkerSchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = WorkerSchema.safeParse({
        $id: 'https://example.com/workers/1',
        $type: 'https://schema.org.ai/Worker',
        status: 'idle',
        // Thing properties
        name: 'Test Worker',
        data: { custom: 'data' },
        visibility: 'org',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      expect(result.success).toBe(true)
    })

    it('Agent should have Thing properties available', async () => {
      const { AgentSchema } = (await import('../src/index.js')) as {
        AgentSchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = AgentSchema.safeParse({
        $id: 'https://example.com/agents/1',
        $type: 'https://schema.org.ai/Agent',
        status: 'idle',
        model: 'claude-3-opus',
        autonomous: false,
        // Thing properties
        name: 'Claude Agent',
        visibility: 'user',
        createdAt: new Date(),
      })
      expect(result.success).toBe(true)
    })

    it('Human should have Thing properties available', async () => {
      const { HumanSchema } = (await import('../src/index.js')) as {
        HumanSchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = HumanSchema.safeParse({
        $id: 'https://example.com/humans/1',
        $type: 'https://schema.org.ai/Human',
        status: 'idle',
        // Thing properties
        name: 'Jane Developer',
        visibility: 'public',
        data: { preferences: { theme: 'dark' } },
      })
      expect(result.success).toBe(true)
    })
  })
})
