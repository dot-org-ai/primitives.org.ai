/**
 * Type Tests for Worker Mock Classes
 *
 * These tests verify that our mock classes for Cloudflare Workers
 * match the expected type signatures from @cloudflare/workers-types.
 *
 * This is a TDD RED phase test - it tests types we need to fix.
 */

import { describe, it, expect, expectTypeOf } from 'vitest'
import { DatabaseService, DatabaseServiceCore, DatabaseDO } from '../src/worker.js'

/**
 * Type definitions that mirror Cloudflare Workers types.
 * These are used to verify our mocks match the real API.
 */

// ExecutionContext interface - matches @cloudflare/workers-types
interface ExecutionContext<Props = unknown> {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
  readonly props: Props
}

// DurableObjectState interface - matches @cloudflare/workers-types
interface DurableObjectState<Props = unknown> {
  waitUntil(promise: Promise<unknown>): void
  readonly props: Props
  readonly id: DurableObjectId
  readonly storage: DurableObjectStorage
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
}

// DurableObjectId interface
interface DurableObjectId {
  toString(): string
  equals(other: DurableObjectId): boolean
  readonly name?: string
}

// SqlStorage interface - matches DurableObjectStorage.sql
interface SqlStorage {
  exec(query: string, ...params: unknown[]): SqlStorageResult
}

interface SqlStorageResult {
  toArray(): unknown[]
}

// DurableObjectStorage interface
interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<boolean>
  deleteAll(): Promise<void>
  list<T = unknown>(): Promise<Map<string, T>>
  sql: SqlStorage
}

// RpcTarget base class shape
interface RpcTargetShape {
  // RpcTarget is a marker class with no required methods
}

// WorkerEntrypoint base class shape
interface WorkerEntrypointShape<Env = unknown> {
  // Protected members are not visible in interface
  // but the class should have ctx and env
}

// DurableObject base class shape
interface DurableObjectShape<Env = unknown> {
  fetch(request: Request): Response | Promise<Response>
  alarm?(): void | Promise<void>
}

describe('Worker Mock Type Compatibility', () => {
  describe('ExecutionContext mock', () => {
    it('should have waitUntil method', () => {
      // This test verifies that our mock ExecutionContext has the correct shape
      const mockCtx = {
        waitUntil: (_promise: Promise<unknown>) => {},
        passThroughOnException: () => {},
        props: {},
      }

      // Type assertion - this should compile without error
      const ctx: ExecutionContext = mockCtx
      expect(typeof ctx.waitUntil).toBe('function')
      expect(typeof ctx.passThroughOnException).toBe('function')
    })

    it('should accept Promise<unknown> in waitUntil', () => {
      const mockCtx: ExecutionContext = {
        waitUntil: (_promise: Promise<unknown>) => {},
        passThroughOnException: () => {},
        props: {},
      }

      // Should accept any promise
      expect(() => mockCtx.waitUntil(Promise.resolve())).not.toThrow()
      expect(() => mockCtx.waitUntil(Promise.resolve('test'))).not.toThrow()
      expect(() => mockCtx.waitUntil(Promise.resolve(42))).not.toThrow()
    })
  })

  describe('DurableObjectState mock', () => {
    it('should have storage with sql property', () => {
      // Create a mock state that matches DurableObjectState
      const mockSql: SqlStorage = {
        exec: (_query: string, ..._params: unknown[]) => ({
          toArray: () => [],
        }),
      }

      const mockStorage: DurableObjectStorage = {
        get: async <T>(_key: string) => undefined as T | undefined,
        put: async <T>(_key: string, _value: T) => {},
        delete: async (_key: string) => false,
        deleteAll: async () => {},
        list: async <T>() => new Map<string, T>(),
        sql: mockSql,
      }

      const mockState: Partial<DurableObjectState> = {
        storage: mockStorage,
        waitUntil: (_promise: Promise<unknown>) => {},
        props: {},
      }

      expect(mockState.storage).toBeDefined()
      expect(mockState.storage?.sql).toBeDefined()
      expect(typeof mockState.storage?.sql.exec).toBe('function')
    })

    it('should have proper SqlStorage.exec return type', () => {
      const mockSql: SqlStorage = {
        exec: (query: string, ...params: unknown[]) => ({
          toArray: () => [
            { id: '1', type: 'Test', data: '{}' },
            { id: '2', type: 'Test', data: '{}' },
          ],
        }),
      }

      const result = mockSql.exec('SELECT * FROM _data')
      const rows = result.toArray()

      expect(Array.isArray(rows)).toBe(true)
      expect(rows.length).toBe(2)
    })
  })

  describe('DatabaseServiceCore (RpcTarget)', () => {
    it('should be instantiable without arguments', () => {
      const service = new DatabaseServiceCore()
      expect(service).toBeInstanceOf(DatabaseServiceCore)
    })

    it('should be instantiable with namespace', () => {
      const service = new DatabaseServiceCore('test-namespace')
      expect(service).toBeInstanceOf(DatabaseServiceCore)
    })

    it('should have CRUD methods with proper signatures', () => {
      const service = new DatabaseServiceCore()

      // Type check: methods should exist with proper signatures
      expectTypeOf(service.get).toBeFunction()
      expectTypeOf(service.list).toBeFunction()
      expectTypeOf(service.create).toBeFunction()
      expectTypeOf(service.update).toBeFunction()
      expectTypeOf(service.delete).toBeFunction()
    })

    it('should have search methods with proper signatures', () => {
      const service = new DatabaseServiceCore()

      expectTypeOf(service.search).toBeFunction()
      expectTypeOf(service.semanticSearch).toBeFunction()
      expectTypeOf(service.hybridSearch).toBeFunction()
    })

    it('should have relationship methods with proper signatures', () => {
      const service = new DatabaseServiceCore()

      expectTypeOf(service.relate).toBeFunction()
      expectTypeOf(service.unrelate).toBeFunction()
      expectTypeOf(service.related).toBeFunction()
    })
  })

  describe('DatabaseService (WorkerEntrypoint)', () => {
    it('should export DatabaseService class', () => {
      expect(DatabaseService).toBeDefined()
      expect(typeof DatabaseService).toBe('function')
    })

    it('should have connect method in prototype', () => {
      expect(typeof DatabaseService.prototype.connect).toBe('function')
    })
  })

  describe('DatabaseDO (DurableObject)', () => {
    it('should export DatabaseDO class', () => {
      expect(DatabaseDO).toBeDefined()
      expect(typeof DatabaseDO).toBe('function')
    })

    it('should have fetch method for handling HTTP requests', () => {
      // DatabaseDO should have a fetch method as required by DurableObject
      expect(typeof DatabaseDO.prototype.fetch).toBe('function')
    })
  })
})

describe('Type-safe SQL Row Interfaces', () => {
  // Define expected row interfaces that should replace `any`
  interface DataRow {
    id: string
    type: string
    data: string // JSON string
    created_at: string
    updated_at: string
  }

  interface RelRow {
    from_id: string
    relation: string
    to_id: string
    metadata: string | null
    created_at: string
  }

  interface EventRow {
    id: string
    event: string
    actor: string | null
    object: string | null
    data: string | null
    result: string | null
    previous_data: string | null
    timestamp: string
  }

  describe('DataRow interface', () => {
    it('should have all required fields', () => {
      const row: DataRow = {
        id: 'test-id',
        type: 'Test',
        data: '{"name": "test"}',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      expect(row.id).toBe('test-id')
      expect(row.type).toBe('Test')
      expect(typeof row.data).toBe('string')
    })
  })

  describe('RelRow interface', () => {
    it('should have all required fields', () => {
      const row: RelRow = {
        from_id: 'author-1',
        relation: 'wrote',
        to_id: 'post-1',
        metadata: null,
        created_at: new Date().toISOString(),
      }

      expect(row.from_id).toBe('author-1')
      expect(row.relation).toBe('wrote')
      expect(row.to_id).toBe('post-1')
    })

    it('should allow metadata as JSON string', () => {
      const row: RelRow = {
        from_id: 'author-1',
        relation: 'wrote',
        to_id: 'post-1',
        metadata: '{"similarity": 0.95}',
        created_at: new Date().toISOString(),
      }

      expect(typeof row.metadata).toBe('string')
    })
  })

  describe('EventRow interface', () => {
    it('should have all required fields', () => {
      const row: EventRow = {
        id: 'event-1',
        event: 'Post.created',
        actor: 'user-1',
        object: 'post-1',
        data: '{"title": "Hello"}',
        result: null,
        previous_data: null,
        timestamp: new Date().toISOString(),
      }

      expect(row.id).toBe('event-1')
      expect(row.event).toBe('Post.created')
    })
  })
})

describe('Events and Actions API Types', () => {
  // These types should replace the `any` in the events/actions API

  interface DatabaseEvent {
    id: string
    event: string
    actor?: string
    object?: string
    data?: unknown
    timestamp: string
  }

  interface Action {
    id: string
    action: string
    actor: string
    object?: string
    status: 'pending' | 'in_progress' | 'completed' | 'failed'
    progress?: number
    total?: number
    data?: unknown
    result?: unknown
    error?: string
    createdAt: string
    updatedAt: string
  }

  interface Artifact {
    url: string
    type: string
    content: unknown
    sourceHash: string
    metadata?: Record<string, unknown>
    createdAt: string
    updatedAt: string
  }

  describe('DatabaseEvent interface', () => {
    it('should have required fields', () => {
      const event: DatabaseEvent = {
        id: 'evt-1',
        event: 'Post.created',
        timestamp: new Date().toISOString(),
      }

      expect(event.id).toBe('evt-1')
      expect(event.event).toBe('Post.created')
    })

    it('should allow optional actor and object', () => {
      const event: DatabaseEvent = {
        id: 'evt-2',
        event: 'Comment.created',
        actor: 'user-1',
        object: 'comment-1',
        data: { text: 'Hello' },
        timestamp: new Date().toISOString(),
      }

      expect(event.actor).toBe('user-1')
      expect(event.object).toBe('comment-1')
    })
  })

  describe('Action interface', () => {
    it('should have required fields', () => {
      const action: Action = {
        id: 'action-1',
        action: 'embeddings.generate',
        actor: 'system',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      expect(action.status).toBe('pending')
    })

    it('should track progress', () => {
      const action: Action = {
        id: 'action-2',
        action: 'embeddings.batch',
        actor: 'system',
        status: 'in_progress',
        progress: 50,
        total: 100,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      expect(action.progress).toBe(50)
      expect(action.total).toBe(100)
    })
  })

  describe('Artifact interface', () => {
    it('should have required fields', () => {
      const artifact: Artifact = {
        url: 'https://example.com/doc',
        type: 'markdown',
        content: '# Hello',
        sourceHash: 'abc123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      expect(artifact.url).toBe('https://example.com/doc')
      expect(artifact.type).toBe('markdown')
    })
  })
})

describe('Provider Method Types', () => {
  // These types verify that provider methods have proper signatures
  // instead of using `any` for the provider

  interface ProviderWithEvents {
    on(pattern: string, handler: (event: DatabaseEvent) => void | Promise<void>): () => void
    emit(
      eventOrOptions: string | { event: string; actor: string; object?: string; data?: unknown },
      data?: unknown
    ): Promise<DatabaseEvent>
    listEvents(options?: {
      event?: string
      actor?: string
      object?: string
      since?: Date
      until?: Date
      limit?: number
    }): Promise<DatabaseEvent[]>
  }

  interface ProviderWithActions {
    createAction(options: {
      action: string
      actor: string
      object?: string
      data?: unknown
      total?: number
    }): Promise<Action>
    getAction(id: string): Promise<Action | null>
    updateAction(
      id: string,
      updates: { status?: string; progress?: number; result?: unknown; error?: string }
    ): Promise<Action>
    listActions(options?: {
      status?: string
      action?: string
      actor?: string
      object?: string
      since?: Date
      until?: Date
      limit?: number
    }): Promise<Action[]>
  }

  interface ProviderWithArtifacts {
    getArtifact(url: string, type: string): Promise<Artifact | null>
    setArtifact(
      url: string,
      type: string,
      data: { content: unknown; sourceHash: string; metadata?: Record<string, unknown> }
    ): Promise<void>
    deleteArtifact(url: string, type?: string): Promise<void>
    listArtifacts(url: string): Promise<Artifact[]>
  }

  // Type definitions referenced in tests
  interface DatabaseEvent {
    id: string
    event: string
    actor?: string
    object?: string
    data?: unknown
    timestamp: string
  }

  interface Action {
    id: string
    action: string
    actor: string
    object?: string
    status: string
    progress?: number
    total?: number
    data?: unknown
    result?: unknown
    error?: string
    createdAt: string
    updatedAt: string
  }

  interface Artifact {
    url: string
    type: string
    content: unknown
    sourceHash: string
    metadata?: Record<string, unknown>
    createdAt: string
    updatedAt: string
  }

  it('should define ProviderWithEvents interface', () => {
    // This test just verifies the interface compiles
    const mockProvider: ProviderWithEvents = {
      on: (_pattern, _handler) => () => {},
      emit: async () => ({
        id: 'evt-1',
        event: 'test',
        timestamp: new Date().toISOString(),
      }),
      listEvents: async () => [],
    }

    expect(typeof mockProvider.on).toBe('function')
    expect(typeof mockProvider.emit).toBe('function')
    expect(typeof mockProvider.listEvents).toBe('function')
  })

  it('should define ProviderWithActions interface', () => {
    const mockProvider: ProviderWithActions = {
      createAction: async () => ({
        id: 'action-1',
        action: 'test',
        actor: 'system',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      getAction: async () => null,
      updateAction: async () => ({
        id: 'action-1',
        action: 'test',
        actor: 'system',
        status: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      listActions: async () => [],
    }

    expect(typeof mockProvider.createAction).toBe('function')
  })

  it('should define ProviderWithArtifacts interface', () => {
    const mockProvider: ProviderWithArtifacts = {
      getArtifact: async () => null,
      setArtifact: async () => {},
      deleteArtifact: async () => {},
      listArtifacts: async () => [],
    }

    expect(typeof mockProvider.getArtifact).toBe('function')
  })
})
