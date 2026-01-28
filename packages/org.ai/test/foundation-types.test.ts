/**
 * Tests for foundation types from @org.ai/types
 *
 * Tests Thing, Worker, Agent, Human, Tool, and related types
 * re-exported through org.ai.
 */

import { describe, it, expect } from 'vitest'

// Import from org.ai which re-exports from @org.ai/types
import {
  // Thing types
  type Thing,
  type ThingDO,
  Thing as ThingMarker,
  // Worker types
  type WorkerType,
  type AgentType,
  type HumanType,
  type WorkerStatusType,
  Worker,
  Agent,
  Human,
  WorkerStatus,
  WORKER_TYPE,
  AGENT_TYPE,
  HUMAN_TYPE,
  // Worker type guards
  isWorker,
  isAgent,
  isHuman,
  // Worker factory functions
  createAgent,
  createHuman,
  // Worker schemas
  WorkerSchema,
  AgentSchema,
  HumanSchema,
  // Tool types
  type ToolType,
  type ToolParameterType,
  type ToolExecutionResultType,
  type ToolValidationErrorType,
  type ToolboxType,
  Tool,
  TOOL_TYPE,
  isTool,
  isToolParameter,
  isToolExecutionResult,
  isToolValidationError,
  // Noun and Verb types
  type Noun,
  type Verb,
  StandardVerbs,
  type StandardVerb,
  // Event types
  type Event,
  type EventWhat,
  type EventWho,
  type EventWhen,
  type EventWhere,
  // Collection types
  type Things,
  type ThingsDO,
  type Collection,
  type ListOptions,
  type ListResult,
  type PaginationInfo,
  THINGS_TYPE,
  COLLECTION_TYPE,
} from '../src/index.js'

describe('Foundation Types - @org.ai/types re-exports', () => {
  // ==========================================================================
  // Thing Tests
  // ==========================================================================
  describe('Thing', () => {
    it('exports Thing type marker', () => {
      expect(ThingMarker).toBeDefined()
      expect(typeof ThingMarker).toBe('symbol')
    })

    it('Thing interface has required fields', () => {
      const thing: Thing = {
        $id: 'https://example.com/things/1',
        $type: 'https://schema.org.ai/Thing',
      }

      expect(thing.$id).toBe('https://example.com/things/1')
      expect(thing.$type).toBe('https://schema.org.ai/Thing')
    })

    it('Thing supports optional fields', () => {
      const thing: Thing = {
        $id: 'https://example.com/things/2',
        $type: 'https://schema.org.ai/Thing',
        name: 'Test Thing',
        data: { foo: 'bar' },
        visibility: 'public',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      expect(thing.name).toBe('Test Thing')
      expect(thing.data).toEqual({ foo: 'bar' })
      expect(thing.visibility).toBe('public')
    })

    it('ThingDO extends Thing with isDO marker', () => {
      const thingDO: ThingDO = {
        $id: 'https://example.com/things/3',
        $type: 'https://schema.org.ai/Thing',
        isDO: true,
      }

      expect(thingDO.isDO).toBe(true)
    })

    it('ThingDO supports git integration', () => {
      const thingDO: ThingDO = {
        $id: 'https://example.com/things/4',
        $type: 'https://schema.org.ai/Thing',
        isDO: true,
        $git: {
          repo: 'acme/platform',
          branch: 'main',
          commit: 'abc123',
          syncMode: 'sync',
        },
      }

      expect(thingDO.$git?.repo).toBe('acme/platform')
      expect(thingDO.$git?.syncMode).toBe('sync')
    })
  })

  // ==========================================================================
  // Worker Tests
  // ==========================================================================
  describe('Worker', () => {
    it('exports Worker type marker', () => {
      expect(Worker).toBeDefined()
      expect(typeof Worker).toBe('symbol')
    })

    it('exports WorkerStatus constants', () => {
      expect(WorkerStatus).toContain('idle')
      expect(WorkerStatus).toContain('working')
      expect(WorkerStatus).toContain('paused')
      expect(WorkerStatus).toContain('offline')
    })

    it('exports type URL constants', () => {
      expect(WORKER_TYPE).toBe('https://schema.org.ai/Worker')
      expect(AGENT_TYPE).toBe('https://schema.org.ai/Agent')
      expect(HUMAN_TYPE).toBe('https://schema.org.ai/Human')
    })

    it('WorkerType interface has required fields', () => {
      const worker: WorkerType = {
        $id: 'https://example.com/workers/1',
        $type: WORKER_TYPE,
        status: 'idle',
      }

      expect(worker.status).toBe('idle')
    })

    it('isWorker validates worker objects', () => {
      const worker: WorkerType = {
        $id: 'https://example.com/workers/1',
        $type: WORKER_TYPE,
        status: 'idle',
      }

      expect(isWorker(worker)).toBe(true)
      expect(isWorker(null)).toBe(false)
      expect(isWorker({})).toBe(false)
    })
  })

  // ==========================================================================
  // Agent Tests
  // ==========================================================================
  describe('Agent', () => {
    it('exports Agent type marker', () => {
      expect(Agent).toBeDefined()
      expect(typeof Agent).toBe('symbol')
    })

    it('createAgent creates an agent with required fields', () => {
      const agent = createAgent({
        model: 'claude-3-opus',
        autonomous: true,
      })

      expect(agent.$id).toMatch(/^https:\/\/schema\.org\.ai\/agents\//)
      expect(agent.$type).toBe(AGENT_TYPE)
      expect(agent.model).toBe('claude-3-opus')
      expect(agent.autonomous).toBe(true)
      expect(agent.status).toBe('idle')
    })

    it('createAgent supports optional fields', () => {
      const agent = createAgent({
        model: 'gpt-4',
        autonomous: false,
        name: 'AssistantBot',
        provider: 'openai',
        systemPrompt: 'You are a helpful assistant',
        temperature: 0.7,
        maxTokens: 1000,
        tools: ['search', 'calculator'],
        capabilities: ['text-generation', 'code-analysis'],
      })

      expect(agent.name).toBe('AssistantBot')
      expect(agent.provider).toBe('openai')
      expect(agent.systemPrompt).toBe('You are a helpful assistant')
      expect(agent.temperature).toBe(0.7)
      expect(agent.maxTokens).toBe(1000)
      expect(agent.tools).toEqual(['search', 'calculator'])
      expect(agent.capabilities).toEqual(['text-generation', 'code-analysis'])
    })

    it('isAgent validates agent objects', () => {
      const agent = createAgent({
        model: 'test',
        autonomous: false,
      })

      expect(isAgent(agent)).toBe(true)
      expect(isWorker(agent)).toBe(true) // Agent is also a Worker
    })

    it('isAgent returns false for non-agents', () => {
      expect(isAgent(null)).toBe(false)
      expect(isAgent({})).toBe(false)
      expect(isAgent({ $type: HUMAN_TYPE, status: 'idle' })).toBe(false)
    })

    it('AgentSchema validates agent objects', () => {
      const agent = createAgent({
        model: 'claude-3-opus',
        autonomous: true,
      })
      const result = AgentSchema.safeParse(agent)

      expect(result.success).toBe(true)
    })
  })

  // ==========================================================================
  // Human Tests
  // ==========================================================================
  describe('Human', () => {
    it('exports Human type marker', () => {
      expect(Human).toBeDefined()
      expect(typeof Human).toBe('symbol')
    })

    it('createHuman creates a human with minimal fields', () => {
      const human = createHuman()

      expect(human.$id).toMatch(/^https:\/\/schema\.org\.ai\/humans\//)
      expect(human.$type).toBe(HUMAN_TYPE)
      expect(human.status).toBe('idle')
    })

    it('createHuman supports all optional fields', () => {
      const human = createHuman({
        name: 'Alice Smith',
        email: 'alice@example.com',
        role: 'Engineer',
        department: 'Engineering',
        manager: 'https://schema.org.ai/humans/bob',
        timezone: 'America/Los_Angeles',
        capabilities: ['coding', 'design'],
        availability: {
          schedule: 'weekdays',
          workingHours: { start: '09:00', end: '17:00' },
        },
      })

      expect(human.name).toBe('Alice Smith')
      expect(human.email).toBe('alice@example.com')
      expect(human.role).toBe('Engineer')
      expect(human.department).toBe('Engineering')
      expect(human.manager).toBe('https://schema.org.ai/humans/bob')
      expect(human.timezone).toBe('America/Los_Angeles')
      expect(human.capabilities).toEqual(['coding', 'design'])
      expect(human.availability?.workingHours).toEqual({ start: '09:00', end: '17:00' })
    })

    it('isHuman validates human objects', () => {
      const human = createHuman({ name: 'Test' })

      expect(isHuman(human)).toBe(true)
      expect(isWorker(human)).toBe(true) // Human is also a Worker
    })

    it('isHuman returns false for agents', () => {
      const agent = createAgent({ model: 'test', autonomous: false })
      expect(isHuman(agent)).toBe(false)
    })

    it('HumanSchema validates human objects', () => {
      const human = createHuman({ name: 'Test', email: 'test@example.com' })
      const result = HumanSchema.safeParse(human)

      expect(result.success).toBe(true)
    })
  })

  // ==========================================================================
  // Tool Tests
  // ==========================================================================
  describe('Tool', () => {
    it('exports Tool type marker', () => {
      expect(Tool).toBeDefined()
      expect(typeof Tool).toBe('symbol')
    })

    it('exports TOOL_TYPE constant', () => {
      expect(TOOL_TYPE).toBe('https://schema.org.ai/Tool')
    })

    it('ToolType interface has required fields', () => {
      const tool: ToolType = {
        $id: 'https://example.com/tools/search',
        $type: TOOL_TYPE,
        name: 'Search Tool',
        description: 'Searches the web',
        inputs: [{ name: 'query', type: 'string', required: true }],
        outputs: { type: 'object', description: 'Search results' },
      }

      expect(tool.name).toBe('Search Tool')
      expect(tool.inputs).toHaveLength(1)
    })

    it('isTool validates tool objects', () => {
      const tool: ToolType = {
        $id: 'https://example.com/tools/1',
        $type: TOOL_TYPE,
        name: 'Test Tool',
        description: 'A test tool',
        inputs: [],
        outputs: { type: 'string' },
      }

      expect(isTool(tool)).toBe(true)
      expect(isTool(null)).toBe(false)
      expect(isTool({})).toBe(false)
    })

    it('isToolParameter validates tool parameters', () => {
      const param: ToolParameterType = {
        name: 'query',
        type: 'string',
        required: true,
        description: 'Search query',
      }

      expect(isToolParameter(param)).toBe(true)
      expect(isToolParameter({})).toBe(false)
    })

    it('isToolExecutionResult validates execution results', () => {
      const result: ToolExecutionResultType = {
        success: true,
        data: { items: [] },
        duration: 150,
      }

      expect(isToolExecutionResult(result)).toBe(true)
      expect(isToolExecutionResult({})).toBe(false)
    })

    it('isToolValidationError validates validation errors', () => {
      const error: ToolValidationErrorType = {
        field: 'query',
        message: 'Required field missing',
        code: 'REQUIRED',
      }

      expect(isToolValidationError(error)).toBe(true)
      expect(isToolValidationError({})).toBe(false)
    })

    it('ToolboxType groups related tools', () => {
      const toolbox: ToolboxType = {
        name: 'Web Tools',
        description: 'Tools for web operations',
        tools: [],
      }

      expect(toolbox.name).toBe('Web Tools')
    })
  })

  // ==========================================================================
  // Noun and Verb Tests
  // ==========================================================================
  describe('Noun and Verb', () => {
    it('Noun interface defines type schemas', () => {
      const noun: Noun = {
        noun: 'Customer',
        plural: 'Customers',
        description: 'A customer entity',
        schema: {
          name: 'string',
          email: 'email',
        },
      }

      expect(noun.noun).toBe('Customer')
      expect(noun.plural).toBe('Customers')
    })

    it('Verb interface defines actions', () => {
      const verb: Verb = {
        verb: 'create',
        activity: 'creating',
        event: 'created',
        inverse: 'delete',
        description: 'Creates a new entity',
      }

      expect(verb.verb).toBe('create')
      expect(verb.activity).toBe('creating')
      expect(verb.event).toBe('created')
    })

    it('StandardVerbs contains common verbs', () => {
      expect(StandardVerbs).toContain('create')
      expect(StandardVerbs).toContain('update')
      expect(StandardVerbs).toContain('delete')
      expect(StandardVerbs).toContain('get')
      expect(StandardVerbs).toContain('list')
    })
  })

  // ==========================================================================
  // Event Tests
  // ==========================================================================
  describe('Event (5W+H)', () => {
    it('Event interface has 5W+H dimensions', () => {
      const event: Event = {
        $id: 'https://example.com/events/1',
        $type: 'https://schema.org.ai/Event',
        what: {
          action: 'created',
          verb: 'create',
        },
        who: {
          id: 'user-123',
          type: 'user',
          name: 'Alice',
        },
        when: {
          timestamp: new Date(),
          duration: 100,
        },
      }

      expect(event.what.action).toBe('created')
      expect(event.who.type).toBe('user')
    })

    it('EventWhere supports location data', () => {
      const where: EventWhere = {
        ns: 'production',
        url: 'https://api.example.com/customers',
        location: { lat: 37.7749, lng: -122.4194 },
      }

      expect(where.location?.lat).toBe(37.7749)
    })
  })

  // ==========================================================================
  // Collection Tests
  // ==========================================================================
  describe('Collections', () => {
    it('exports collection type constants', () => {
      expect(THINGS_TYPE).toBe('https://schema.org.ai/Things')
      expect(COLLECTION_TYPE).toBe('https://schema.org.ai/Collection')
    })

    it('Things interface represents typed collections', () => {
      const things: Things = {
        $id: 'https://example.com/customers',
        $type: THINGS_TYPE,
        itemType: 'https://schema.org.ai/Customer',
        count: 42,
      }

      expect(things.itemType).toBe('https://schema.org.ai/Customer')
      expect(things.count).toBe(42)
    })

    it('ListOptions supports pagination parameters', () => {
      const options: ListOptions = {
        limit: 10,
        offset: 20,
        cursor: 'abc123',
        sort: { field: 'createdAt', direction: 'desc' },
        filter: { $type: 'Customer' } as Partial<Thing>,
        search: 'test',
        includeDeleted: false,
      }

      expect(options.limit).toBe(10)
      expect(options.sort).toEqual({ field: 'createdAt', direction: 'desc' })
    })

    it('ListResult contains items and pagination', () => {
      const result: ListResult = {
        items: [
          { $id: 'https://example.com/1', $type: 'Customer' },
          { $id: 'https://example.com/2', $type: 'Customer' },
        ],
        pagination: {
          total: 100,
          count: 2,
          limit: 10,
          offset: 0,
          hasMore: true,
          nextCursor: 'next123',
        },
      }

      expect(result.items).toHaveLength(2)
      expect(result.pagination.hasMore).toBe(true)
    })
  })
})
