/**
 * Tests for exactOptionalPropertyTypes Compliance
 *
 * This file verifies that optional properties are handled correctly with
 * TypeScript's `exactOptionalPropertyTypes: true` setting.
 *
 * Key patterns tested:
 * 1. Conditional spread: ...(x !== undefined && { x })
 * 2. Direct assignment only when value is present
 * 3. Type inference for optional properties
 * 4. Ternary operator pattern: x !== undefined ? { x } : undefined
 *
 * Files covered:
 * - schema.ts
 * - schema/types.ts
 * - memory-provider.ts
 * - authorization.ts
 * - durable-promise.ts
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, expectTypeOf } from 'vitest'
import {
  createMemoryProvider,
  type MemoryProvider,
  type ActorData,
  type Event,
  type Action,
  type Artifact,
} from '../src/memory-provider.js'
import {
  type Subject,
  type Resource,
  type ResourceRef,
  type Permission,
  type Role,
  type Assignment,
  type AssignmentInput,
  type BusinessRole,
  type AuthorizedNoun,
  InMemoryAuthorizationEngine,
  StandardPermissions,
  createStandardRoles,
  authorizeNoun,
  linkBusinessRole,
} from '../src/authorization.js'
import {
  type DurablePromiseOptions,
  type ExecutionPriority,
  DurablePromise,
  durable,
  withContext,
  setDefaultContext,
  getCurrentContext,
} from '../src/durable-promise.js'
import type {
  ReferenceSpec,
  Draft,
  Resolved,
  DraftOptions,
  ResolveOptions,
  CascadeProgress,
  CascadeState,
  CreateEntityOptions,
  OperatorParseResult,
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
  EmbeddingTypeConfig,
  DBEvent,
  CreateEventOptions,
  DBAction,
  CreateActionOptions,
  DBArtifact,
  NLQueryResult,
  NLQueryContext,
  NLQueryPlan,
  GenerateOptions,
  DBOptions,
} from '../src/schema/types.js'
import type { Noun } from '../src/types.js'

// =============================================================================
// Schema Types Tests
// =============================================================================

describe('exactOptionalPropertyTypes: Schema Types', () => {
  describe('ReferenceSpec', () => {
    it('creates ReferenceSpec with required fields only', () => {
      const ref: ReferenceSpec = {
        field: 'author',
        operator: '->',
        type: 'Author',
        matchMode: 'exact',
        resolved: false,
      }

      expect(ref.field).toBe('author')
      expect(ref.operator).toBe('->')
      expect(ref.type).toBe('Author')
      expect(ref.matchMode).toBe('exact')
      expect(ref.resolved).toBe(false)
      // Optional fields should be undefined
      expect(ref.unionTypes).toBeUndefined()
      expect(ref.prompt).toBeUndefined()
      expect(ref.generatedText).toBeUndefined()
      expect(ref.sourceInstructions).toBeUndefined()
      expect(ref.threshold).toBeUndefined()
    })

    it('creates ReferenceSpec with optional fields using conditional spread', () => {
      const prompt = 'Generate author name'
      const threshold = 0.8

      // This is the safe pattern with exactOptionalPropertyTypes
      const ref: ReferenceSpec = {
        field: 'author',
        operator: '~>',
        type: 'Author',
        matchMode: 'fuzzy',
        resolved: false,
        ...(prompt !== undefined && { prompt }),
        ...(threshold !== undefined && { threshold }),
      }

      expect(ref.prompt).toBe('Generate author name')
      expect(ref.threshold).toBe(0.8)
    })

    it('handles union types correctly', () => {
      const unionTypes = ['Tutorial', 'Video', 'Documentation']

      const ref: ReferenceSpec = {
        field: 'content',
        operator: '~>',
        type: 'Tutorial',
        matchMode: 'fuzzy',
        resolved: false,
        ...(unionTypes !== undefined && { unionTypes }),
      }

      expect(ref.unionTypes).toEqual(['Tutorial', 'Video', 'Documentation'])
    })
  })

  describe('Draft and Resolved types', () => {
    interface TestEntity {
      $id: string
      $type: string
      name: string
      description?: string
    }

    it('creates Draft with $refs', () => {
      const draft: Draft<TestEntity> = {
        $phase: 'draft',
        $refs: {
          author: {
            field: 'author',
            operator: '->',
            type: 'Author',
            matchMode: 'exact',
            resolved: false,
          },
        },
        name: 'Test',
      }

      expect(draft.$phase).toBe('draft')
      expect(draft.$refs.author).toBeDefined()
    })

    it('creates Resolved with optional $errors using conditional spread', () => {
      const errors = [{ field: 'author', error: 'Not found' }]

      const resolved: Resolved<TestEntity> = {
        $phase: 'resolved',
        $id: '123',
        $type: 'Test',
        name: 'Test',
        ...(errors.length > 0 && { $errors: errors }),
      }

      expect(resolved.$phase).toBe('resolved')
      expect(resolved.$errors).toHaveLength(1)
    })

    it('creates Resolved without $errors when empty', () => {
      const resolved: Resolved<TestEntity> = {
        $phase: 'resolved',
        $id: '123',
        $type: 'Test',
        name: 'Test',
      }

      expect(resolved.$errors).toBeUndefined()
    })
  })

  describe('ListOptions and SearchOptions', () => {
    it('creates ListOptions with subset of optional fields', () => {
      const where = { status: 'active' }
      const limit = 10

      const options: ListOptions = {
        ...(where !== undefined && { where }),
        ...(limit !== undefined && { limit }),
      }

      expect(options.where).toEqual({ status: 'active' })
      expect(options.limit).toBe(10)
      expect(options.orderBy).toBeUndefined()
      expect(options.order).toBeUndefined()
      expect(options.offset).toBeUndefined()
    })

    it('creates SearchOptions extending ListOptions', () => {
      const fields = ['title', 'content']
      const minScore = 0.5

      const options: SearchOptions = {
        ...(fields !== undefined && { fields }),
        ...(minScore !== undefined && { minScore }),
        limit: 20,
      }

      expect(options.fields).toEqual(['title', 'content'])
      expect(options.minScore).toBe(0.5)
      expect(options.limit).toBe(20)
    })
  })

  describe('Ternary pattern for passing optional params to functions', () => {
    // This pattern is required when passing optional properties from one interface to another
    // function that also has optional properties. Using the ternary operator ensures TypeScript
    // correctly narrows the type.

    interface SourceOptions {
      suppressErrors?: boolean
    }

    interface TargetOptions {
      suppressErrors?: boolean
    }

    function processWithOptions(options?: TargetOptions): string {
      return options?.suppressErrors ? 'suppressed' : 'not suppressed'
    }

    it('uses ternary pattern when value might be undefined', () => {
      const options: SourceOptions = { suppressErrors: true }

      // This is the pattern used in schema.ts for getAllEdges
      const suppressErrors = options.suppressErrors
      const result = processWithOptions(
        suppressErrors !== undefined ? { suppressErrors } : undefined
      )

      expect(result).toBe('suppressed')
    })

    it('uses ternary pattern with undefined value', () => {
      const options: SourceOptions = {}

      const suppressErrors = options.suppressErrors
      const result = processWithOptions(
        suppressErrors !== undefined ? { suppressErrors } : undefined
      )

      expect(result).toBe('not suppressed')
    })

    it('handles optional chaining source correctly', () => {
      const maybeOptions: SourceOptions | undefined = { suppressErrors: false }

      // This simulates the exact case from schema.ts where options?.suppressErrors is used
      const suppressErrors = maybeOptions?.suppressErrors
      const result = processWithOptions(
        suppressErrors !== undefined ? { suppressErrors } : undefined
      )

      expect(result).toBe('not suppressed')
    })

    it('handles undefined source object', () => {
      const maybeOptions: SourceOptions | undefined = undefined

      const suppressErrors = maybeOptions?.suppressErrors
      const result = processWithOptions(
        suppressErrors !== undefined ? { suppressErrors } : undefined
      )

      expect(result).toBe('not suppressed')
    })
  })

  describe('CreateEntityOptions with cascade', () => {
    it('creates options without cascade', () => {
      const options: CreateEntityOptions = {
        draftOnly: true,
      }

      expect(options.draftOnly).toBe(true)
      expect(options.cascade).toBeUndefined()
      expect(options.maxDepth).toBeUndefined()
    })

    it('creates options with cascade using conditional spread', () => {
      const onProgress = (progress: CascadeProgress) => {
        console.log(progress)
      }
      const cascadeTypes = ['Author', 'Tag']

      const options: CreateEntityOptions = {
        cascade: true,
        maxDepth: 3,
        ...(onProgress !== undefined && { onProgress }),
        ...(cascadeTypes !== undefined && { cascadeTypes }),
      }

      expect(options.cascade).toBe(true)
      expect(options.maxDepth).toBe(3)
      expect(options.onProgress).toBeDefined()
      expect(options.cascadeTypes).toEqual(['Author', 'Tag'])
    })
  })

  describe('CascadeState internal type', () => {
    it('creates CascadeState with optional callbacks using conditional spread', () => {
      const rootOnProgress = (progress: CascadeProgress) => {}
      const rootOnError = (error: Error) => {}

      const state: CascadeState = {
        totalEntitiesCreated: 0,
        initialMaxDepth: 3,
        ...(rootOnProgress !== undefined && { rootOnProgress }),
        ...(rootOnError !== undefined && { rootOnError }),
      }

      expect(state.rootOnProgress).toBeDefined()
      expect(state.rootOnError).toBeDefined()
      expect(state.stopOnError).toBeUndefined()
      expect(state.cascadeTypes).toBeUndefined()
    })
  })

  describe('OperatorParseResult', () => {
    it('creates parse result with minimal fields', () => {
      const result: OperatorParseResult = {
        targetType: 'Author',
      }

      expect(result.targetType).toBe('Author')
      expect(result.prompt).toBeUndefined()
      expect(result.operator).toBeUndefined()
    })

    it('creates parse result with all optional fields', () => {
      const unionTypes = ['Author', 'Editor']
      const threshold = 0.9

      const result: OperatorParseResult = {
        targetType: 'Author',
        prompt: 'Find related author',
        operator: '~>',
        direction: 'forward',
        matchMode: 'fuzzy',
        ...(unionTypes !== undefined && { unionTypes }),
        ...(threshold !== undefined && { threshold }),
      }

      expect(result.unionTypes).toEqual(['Author', 'Editor'])
      expect(result.threshold).toBe(0.9)
    })
  })
})

// =============================================================================
// Memory Provider Tests
// =============================================================================

describe('exactOptionalPropertyTypes: Memory Provider', () => {
  let provider: MemoryProvider

  beforeEach(() => {
    provider = createMemoryProvider()
  })

  describe('ActorData optional fields', () => {
    it('creates ActorData with subset of fields', () => {
      const name = 'John Doe'
      const email = 'john@example.com'

      const actorData: ActorData = {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
      }

      expect(actorData.name).toBe('John Doe')
      expect(actorData.email).toBe('john@example.com')
      expect(actorData.org).toBeUndefined()
      expect(actorData.role).toBeUndefined()
    })
  })

  describe('Event with optional fields', () => {
    it('emits event with required fields only', async () => {
      const event = await provider.emit('Test.created', { id: '123' })

      expect(event.id).toBeDefined()
      expect(event.actor).toBe('system')
      expect(event.event).toBe('Test.created')
      expect(event.timestamp).toBeDefined()
      // objectData should have the emitted data
      expect(event.objectData).toEqual({ id: '123' })
    })

    it('emits event with optional fields using Actor-Event-Object pattern', async () => {
      const actorData: ActorData = { name: 'Test User', email: 'test@example.com' }
      const objectData = { title: 'Test' }
      const meta = { source: 'unit-test' }

      const event = await provider.emit({
        actor: 'user:123',
        event: 'Post.created',
        object: 'Post/456',
        ...(actorData !== undefined && { actorData }),
        ...(objectData !== undefined && { objectData }),
        ...(meta !== undefined && { meta }),
      })

      expect(event.actor).toBe('user:123')
      expect(event.actorData).toEqual({ name: 'Test User', email: 'test@example.com' })
      expect(event.objectData).toEqual({ title: 'Test' })
      expect(event.meta).toEqual({ source: 'unit-test' })
    })

    it('emits event without optional fields', async () => {
      const event = await provider.emit({
        actor: 'system',
        event: 'System.ping',
      })

      expect(event.actorData).toBeUndefined()
      expect(event.object).toBeUndefined()
      expect(event.objectData).toBeUndefined()
      expect(event.result).toBeUndefined()
      expect(event.resultData).toBeUndefined()
      expect(event.meta).toBeUndefined()
    })
  })

  describe('Action with optional fields', () => {
    it('creates action with minimal fields', async () => {
      const action = await provider.createAction({
        type: 'generate',
        data: { prompt: 'test' },
      })

      expect(action.id).toBeDefined()
      expect(action.actor).toBe('system')
      expect(action.action).toBe('generate')
      expect(action.status).toBe('pending')
      expect(action.actorData).toBeUndefined()
      expect(action.object).toBeUndefined()
    })

    it('creates action with optional fields using conditional spread', async () => {
      const actorData: ActorData = { name: 'AI Agent' }
      const meta = { priority: 'high' }

      const action = await provider.createAction({
        actor: 'agent:claude',
        action: 'process',
        object: 'Document/123',
        total: 100,
        ...(actorData !== undefined && { actorData }),
        ...(meta !== undefined && { meta }),
      })

      expect(action.actorData).toEqual({ name: 'AI Agent' })
      expect(action.object).toBe('Document/123')
      expect(action.total).toBe(100)
      expect(action.meta).toEqual({ priority: 'high' })
    })

    it('updates action with optional result', async () => {
      const action = await provider.createAction({
        type: 'generate',
        data: { count: 10 },
      })

      const result = { generated: 10, success: true }
      const updated = await provider.updateAction(action.id, {
        status: 'completed',
        ...(result !== undefined && { result }),
      })

      expect(updated.status).toBe('completed')
      expect(updated.result).toEqual({ generated: 10, success: true })
    })

    it('updates action with optional error', async () => {
      const action = await provider.createAction({
        type: 'process',
        data: {},
      })

      const error = 'Processing failed'
      const updated = await provider.updateAction(action.id, {
        status: 'failed',
        ...(error !== undefined && { error }),
      })

      expect(updated.status).toBe('failed')
      expect(updated.error).toBe('Processing failed')
    })
  })

  describe('Artifact with optional metadata', () => {
    it('sets artifact without metadata', async () => {
      await provider.setArtifact('Test/123', 'embedding', {
        content: [0.1, 0.2, 0.3],
        sourceHash: 'abc123',
      })

      const artifact = await provider.getArtifact('Test/123', 'embedding')
      expect(artifact).toBeDefined()
      expect(artifact?.metadata).toBeUndefined()
    })

    it('sets artifact with optional metadata using conditional spread', async () => {
      const metadata = { dimensions: 384, model: 'test-model' }

      await provider.setArtifact('Test/456', 'embedding', {
        content: [0.1, 0.2, 0.3],
        sourceHash: 'def456',
        ...(metadata !== undefined && { metadata }),
      })

      const artifact = await provider.getArtifact('Test/456', 'embedding')
      expect(artifact?.metadata).toEqual({ dimensions: 384, model: 'test-model' })
    })
  })

  describe('listEvents with optional filters', () => {
    beforeEach(async () => {
      await provider.emit('Post.created', { id: '1' })
      await provider.emit('Post.updated', { id: '1' })
      await provider.emit('User.created', { id: '2' })
    })

    it('lists events without filters', async () => {
      const events = await provider.listEvents()
      expect(events.length).toBeGreaterThan(0)
    })

    it('lists events with partial filters', async () => {
      const eventPattern = 'Post.*'

      const events = await provider.listEvents({
        ...(eventPattern !== undefined && { event: eventPattern }),
      })

      expect(events.every((e) => e.event.startsWith('Post.'))).toBe(true)
    })
  })

  describe('listActions with optional filters', () => {
    beforeEach(async () => {
      await provider.createAction({ type: 'generate', data: {} })
      await provider.createAction({ type: 'process', data: {} })
    })

    it('lists actions without filters', async () => {
      const actions = await provider.listActions()
      expect(actions.length).toBeGreaterThanOrEqual(2)
    })

    it('lists actions with partial filters', async () => {
      const status: Action['status'] = 'pending'

      const actions = await provider.listActions({
        ...(status !== undefined && { status }),
      })

      expect(actions.every((a) => a.status === 'pending')).toBe(true)
    })
  })
})

// =============================================================================
// Authorization Tests
// =============================================================================

describe('exactOptionalPropertyTypes: Authorization', () => {
  describe('Subject with optional fields', () => {
    it('creates Subject with required fields only', () => {
      const subject: Subject = {
        type: 'user',
        id: '123',
      }

      expect(subject.type).toBe('user')
      expect(subject.id).toBe('123')
      expect(subject.name).toBeUndefined()
      expect(subject.metadata).toBeUndefined()
    })

    it('creates Subject with optional fields using conditional spread', () => {
      const name = 'John Doe'
      const metadata = { department: 'Engineering' }

      const subject: Subject = {
        type: 'user',
        id: '123',
        ...(name !== undefined && { name }),
        ...(metadata !== undefined && { metadata }),
      }

      expect(subject.name).toBe('John Doe')
      expect(subject.metadata).toEqual({ department: 'Engineering' })
    })
  })

  describe('Resource with optional parent', () => {
    it('creates Resource without parent', () => {
      const resource: Resource = {
        type: 'organization',
        id: 'org-1',
      }

      expect(resource.parent).toBeUndefined()
    })

    it('creates Resource with optional parent', () => {
      const parent: ResourceRef = { type: 'organization', id: 'org-1' }

      const resource: Resource = {
        type: 'workspace',
        id: 'ws-1',
        ...(parent !== undefined && { parent }),
      }

      expect(resource.parent).toEqual({ type: 'organization', id: 'org-1' })
    })
  })

  describe('Permission with optional inheritable', () => {
    it('creates Permission without inheritable', () => {
      const permission: Permission = {
        name: 'read',
        resourceType: 'document',
        actions: ['read', 'get', 'list'],
      }

      expect(permission.inheritable).toBeUndefined()
      expect(permission.description).toBeUndefined()
    })

    it('creates Permission with optional fields', () => {
      const description = 'Read permission for documents'
      const inheritable = true

      const permission: Permission = {
        name: 'read',
        resourceType: 'document',
        actions: ['read', 'get', 'list'],
        ...(description !== undefined && { description }),
        ...(inheritable !== undefined && { inheritable }),
      }

      expect(permission.description).toBe('Read permission for documents')
      expect(permission.inheritable).toBe(true)
    })
  })

  describe('Role with optional fields', () => {
    it('creates Role with required fields only', () => {
      const role: Role = {
        id: 'viewer',
        name: 'Viewer',
        resourceType: 'document',
        permissions: [StandardPermissions.read('document')],
      }

      expect(role.description).toBeUndefined()
      expect(role.inherits).toBeUndefined()
      expect(role.metadata).toBeUndefined()
    })

    it('creates Role with optional fields using conditional spread', () => {
      const description = 'Can view documents'
      const inherits = ['guest']
      const metadata = { tier: 'free' }

      const role: Role = {
        id: 'viewer',
        name: 'Viewer',
        resourceType: 'document',
        permissions: [StandardPermissions.read('document')],
        ...(description !== undefined && { description }),
        ...(inherits !== undefined && { inherits }),
        ...(metadata !== undefined && { metadata }),
      }

      expect(role.description).toBe('Can view documents')
      expect(role.inherits).toEqual(['guest'])
      expect(role.metadata).toEqual({ tier: 'free' })
    })
  })

  describe('Assignment with optional fields', () => {
    it('creates Assignment without optional fields', () => {
      const assignment: Assignment = {
        id: 'assign-1',
        subject: { type: 'user', id: '123' },
        role: 'viewer',
        resource: { type: 'document', id: 'doc-1' },
        createdAt: new Date(),
      }

      expect(assignment.createdBy).toBeUndefined()
      expect(assignment.expiresAt).toBeUndefined()
      expect(assignment.metadata).toBeUndefined()
    })

    it('creates Assignment with optional fields', () => {
      const createdBy: Subject = { type: 'user', id: 'admin' }
      const expiresAt = new Date(Date.now() + 86400000)
      const metadata = { reason: 'project access' }

      const assignment: Assignment = {
        id: 'assign-1',
        subject: { type: 'user', id: '123' },
        role: 'editor',
        resource: { type: 'document', id: 'doc-1' },
        createdAt: new Date(),
        ...(createdBy !== undefined && { createdBy }),
        ...(expiresAt !== undefined && { expiresAt }),
        ...(metadata !== undefined && { metadata }),
      }

      expect(assignment.createdBy).toEqual({ type: 'user', id: 'admin' })
      expect(assignment.expiresAt).toBeDefined()
      expect(assignment.metadata).toEqual({ reason: 'project access' })
    })
  })

  describe('AssignmentInput with optional fields', () => {
    it('creates input with minimal fields', () => {
      const input: AssignmentInput = {
        subject: 'user:123',
        role: 'viewer',
        resource: 'document:doc-1',
      }

      expect(input.expiresAt).toBeUndefined()
      expect(input.metadata).toBeUndefined()
    })

    it('creates input with optional fields', () => {
      const expiresAt = new Date(Date.now() + 86400000)
      const metadata = { temporary: true }

      const input: AssignmentInput = {
        subject: 'user:123',
        role: 'editor',
        resource: 'document:doc-1',
        ...(expiresAt !== undefined && { expiresAt }),
        ...(metadata !== undefined && { metadata }),
      }

      expect(input.expiresAt).toBeDefined()
      expect(input.metadata).toEqual({ temporary: true })
    })
  })

  describe('BusinessRole with optional fields', () => {
    it('creates BusinessRole with required fields only', () => {
      const role: BusinessRole = {
        id: 'swe',
        name: 'Software Engineer',
      }

      expect(role.description).toBeUndefined()
      expect(role.department).toBeUndefined()
      expect(role.level).toBeUndefined()
      expect(role.reportsTo).toBeUndefined()
      expect(role.responsibilities).toBeUndefined()
      expect(role.skills).toBeUndefined()
      expect(role.authorizationRoles).toBeUndefined()
      expect(role.metadata).toBeUndefined()
    })

    it('creates BusinessRole with optional fields', () => {
      const department = 'Engineering'
      const level = 1
      const skills = ['typescript', 'python']

      const role: BusinessRole = {
        id: 'swe',
        name: 'Software Engineer',
        ...(department !== undefined && { department }),
        ...(level !== undefined && { level }),
        ...(skills !== undefined && { skills }),
      }

      expect(role.department).toBe('Engineering')
      expect(role.level).toBe(1)
      expect(role.skills).toEqual(['typescript', 'python'])
    })
  })

  describe('authorizeNoun with optional config', () => {
    it('handles noun with undefined config', () => {
      const noun: Noun = {
        singular: 'document',
        plural: 'documents',
      }

      // The authorizeNoun function should handle undefined config
      const authorized = authorizeNoun(noun, undefined)
      expect(authorized.authorization).toBeUndefined()
    })

    it('handles noun with partial config', () => {
      const noun: Noun = {
        singular: 'document',
        plural: 'documents',
      }

      const config = {
        parentType: 'workspace',
        local: false,
      }

      const authorized = authorizeNoun(noun, config)
      expect(authorized.authorization?.parentType).toBe('workspace')
      expect(authorized.authorization?.roles).toBeUndefined()
    })
  })

  describe('InMemoryAuthorizationEngine with optional fields', () => {
    let engine: InMemoryAuthorizationEngine

    beforeEach(() => {
      engine = new InMemoryAuthorizationEngine()
    })

    it('assigns with minimal input', async () => {
      const assignment = await engine.assign({
        subject: 'user:123',
        role: 'viewer',
        resource: 'document:doc-1',
      })

      expect(assignment.id).toBeDefined()
      expect(assignment.expiresAt).toBeUndefined()
      expect(assignment.metadata).toBeUndefined()
    })

    it('assigns with optional fields', async () => {
      const expiresAt = new Date(Date.now() + 86400000)
      const metadata = { source: 'test' }

      const assignment = await engine.assign({
        subject: 'user:123',
        role: 'editor',
        resource: 'document:doc-1',
        ...(expiresAt !== undefined && { expiresAt }),
        ...(metadata !== undefined && { metadata }),
      })

      expect(assignment.expiresAt).toEqual(expiresAt)
      expect(assignment.metadata).toEqual({ source: 'test' })
    })

    it('creates resource with optional fields', async () => {
      const parent: ResourceRef = { type: 'organization', id: 'org-1' }
      const metadata = { created: 'test' }

      const resource = await engine.createResource({
        type: 'workspace',
        id: 'ws-1',
        ...(parent !== undefined && { parent }),
        ...(metadata !== undefined && { metadata }),
      })

      expect(resource.parent).toEqual(parent)
      expect(resource.metadata).toEqual(metadata)
    })
  })
})

// =============================================================================
// Durable Promise Tests
// =============================================================================

describe('exactOptionalPropertyTypes: Durable Promise', () => {
  describe('DurablePromiseOptions', () => {
    it('creates options with required fields only', () => {
      const options: DurablePromiseOptions<string> = {
        method: 'ai.generate',
        executor: async () => 'result',
      }

      expect(options.method).toBe('ai.generate')
      expect(options.args).toBeUndefined()
      expect(options.priority).toBeUndefined()
      expect(options.concurrencyKey).toBeUndefined()
      expect(options.deferUntil).toBeUndefined()
      expect(options.dependsOn).toBeUndefined()
      expect(options.actor).toBeUndefined()
      expect(options.meta).toBeUndefined()
      expect(options.provider).toBeUndefined()
    })

    it('creates options with optional fields using conditional spread', () => {
      const args = [{ prompt: 'test' }]
      const priority: ExecutionPriority = 'batch'
      const actor = 'user:123'
      const meta = { source: 'test' }

      const options: DurablePromiseOptions<string> = {
        method: 'ai.generate',
        executor: async () => 'result',
        ...(args !== undefined && { args }),
        ...(priority !== undefined && { priority }),
        ...(actor !== undefined && { actor }),
        ...(meta !== undefined && { meta }),
      }

      expect(options.args).toEqual([{ prompt: 'test' }])
      expect(options.priority).toBe('batch')
      expect(options.actor).toBe('user:123')
      expect(options.meta).toEqual({ source: 'test' })
    })

    it('creates options with dependencies', () => {
      const dependsOn = ['action-1', 'action-2']
      const deferUntil = new Date(Date.now() + 3600000)

      const options: DurablePromiseOptions<number> = {
        method: 'db.sync',
        executor: async () => 42,
        ...(dependsOn !== undefined && { dependsOn }),
        ...(deferUntil !== undefined && { deferUntil }),
      }

      expect(options.dependsOn).toEqual(['action-1', 'action-2'])
      expect(options.deferUntil).toBeDefined()
    })
  })

  describe('ExecutionContext via withContext', () => {
    it('inherits context with optional fields', async () => {
      const provider = createMemoryProvider()
      const concurrencyKey = 'test-queue'
      const actor = 'user:123'

      await withContext(
        {
          priority: 'standard',
          ...(provider !== undefined && { provider }),
          ...(concurrencyKey !== undefined && { concurrencyKey }),
          ...(actor !== undefined && { actor }),
        },
        async () => {
          const context = getCurrentContext()
          expect(context?.priority).toBe('standard')
          expect(context?.provider).toBeDefined()
          expect(context?.concurrencyKey).toBe('test-queue')
          expect(context?.actor).toBe('user:123')
        }
      )
    })

    it('handles undefined optional context fields', async () => {
      await withContext(
        {
          priority: 'flex',
        },
        async () => {
          const context = getCurrentContext()
          expect(context?.priority).toBe('flex')
          expect(context?.provider).toBeUndefined()
          expect(context?.concurrencyKey).toBeUndefined()
          expect(context?.actor).toBeUndefined()
        }
      )
    })
  })

  describe('durable() helper function', () => {
    it('creates DurablePromise with minimal options', async () => {
      const promise = durable('test.operation', async () => 'done')

      expect(promise.method).toBe('test.operation')
      expect(promise.priority).toBe('standard') // default
      expect(promise.dependsOn).toEqual([])

      const result = await promise
      expect(result).toBe('done')
    })

    it('creates DurablePromise with optional options', async () => {
      const priority: ExecutionPriority = 'priority'
      const actor = 'agent:test'
      const meta = { urgent: true }

      const promise = durable('urgent.operation', async () => 'urgent result', {
        ...(priority !== undefined && { priority }),
        ...(actor !== undefined && { actor }),
        ...(meta !== undefined && { meta }),
      })

      expect(promise.priority).toBe('priority')
      // actor and meta are stored in the action, accessible via getAction()

      const result = await promise
      expect(result).toBe('urgent result')
    })
  })

  describe('setDefaultContext with optional fields', () => {
    it('sets context with partial options', () => {
      const concurrencyKey = 'default-queue'

      setDefaultContext({
        priority: 'standard',
        ...(concurrencyKey !== undefined && { concurrencyKey }),
      })

      const context = getCurrentContext()
      expect(context?.priority).toBe('standard')
      expect(context?.concurrencyKey).toBe('default-queue')
    })
  })
})

// =============================================================================
// DBEvent and DBAction Types Tests
// =============================================================================

describe('exactOptionalPropertyTypes: DB Event and Action Types', () => {
  describe('DBEvent type', () => {
    it('creates DBEvent with required fields only', () => {
      const event: DBEvent = {
        id: 'event-1',
        actor: 'system',
        event: 'Entity.created',
        timestamp: new Date(),
      }

      expect(event.actorData).toBeUndefined()
      expect(event.object).toBeUndefined()
      expect(event.objectData).toBeUndefined()
      expect(event.result).toBeUndefined()
      expect(event.resultData).toBeUndefined()
      expect(event.meta).toBeUndefined()
    })

    it('creates DBEvent with optional fields', () => {
      const actorData: ActorData = { name: 'Test' }
      const objectData = { id: '123' }
      const meta = { source: 'api' }

      const event: DBEvent = {
        id: 'event-1',
        actor: 'user:123',
        event: 'Post.created',
        timestamp: new Date(),
        object: 'Post/123',
        ...(actorData !== undefined && { actorData }),
        ...(objectData !== undefined && { objectData }),
        ...(meta !== undefined && { meta }),
      }

      expect(event.actorData).toEqual({ name: 'Test' })
      expect(event.objectData).toEqual({ id: '123' })
      expect(event.meta).toEqual({ source: 'api' })
    })
  })

  describe('DBAction type', () => {
    it('creates DBAction with required fields only', () => {
      const action: DBAction = {
        id: 'action-1',
        actor: 'system',
        act: 'processes',
        action: 'process',
        activity: 'processing',
        status: 'pending',
        createdAt: new Date(),
      }

      expect(action.actorData).toBeUndefined()
      expect(action.object).toBeUndefined()
      expect(action.objectData).toBeUndefined()
      expect(action.progress).toBeUndefined()
      expect(action.total).toBeUndefined()
      expect(action.result).toBeUndefined()
      expect(action.error).toBeUndefined()
      expect(action.meta).toBeUndefined()
      expect(action.startedAt).toBeUndefined()
      expect(action.completedAt).toBeUndefined()
    })

    it('creates DBAction with optional fields using conditional spread', () => {
      const progress = 50
      const total = 100
      const objectData = { items: ['a', 'b'] }

      const action: DBAction = {
        id: 'action-1',
        actor: 'agent:worker',
        act: 'generates',
        action: 'generate',
        activity: 'generating',
        status: 'active',
        createdAt: new Date(),
        startedAt: new Date(),
        ...(progress !== undefined && { progress }),
        ...(total !== undefined && { total }),
        ...(objectData !== undefined && { objectData }),
      }

      expect(action.progress).toBe(50)
      expect(action.total).toBe(100)
      expect(action.objectData).toEqual({ items: ['a', 'b'] })
    })
  })

  describe('CreateEventOptions type', () => {
    it('creates options with required fields only', () => {
      const options: CreateEventOptions = {
        actor: 'system',
        event: 'Test.ping',
      }

      expect(options.actorData).toBeUndefined()
      expect(options.object).toBeUndefined()
    })

    it('creates options with all optional fields', () => {
      const actorData: ActorData = { role: 'admin' }
      const objectData = { key: 'value' }
      const resultData = { success: true }
      const meta = { trace: 'abc' }

      const options: CreateEventOptions = {
        actor: 'user:admin',
        event: 'Admin.action',
        object: 'Resource/123',
        result: 'Result/456',
        ...(actorData !== undefined && { actorData }),
        ...(objectData !== undefined && { objectData }),
        ...(resultData !== undefined && { resultData }),
        ...(meta !== undefined && { meta }),
      }

      expect(options.actorData).toEqual({ role: 'admin' })
      expect(options.objectData).toEqual({ key: 'value' })
      expect(options.resultData).toEqual({ success: true })
      expect(options.meta).toEqual({ trace: 'abc' })
    })
  })

  describe('CreateActionOptions type', () => {
    it('creates options with required fields only', () => {
      const options: CreateActionOptions = {
        actor: 'system',
        action: 'sync',
      }

      expect(options.actorData).toBeUndefined()
      expect(options.object).toBeUndefined()
      expect(options.objectData).toBeUndefined()
      expect(options.total).toBeUndefined()
      expect(options.meta).toBeUndefined()
    })

    it('creates options with optional fields', () => {
      const total = 1000
      const meta = { batch: true }

      const options: CreateActionOptions = {
        actor: 'system',
        action: 'import',
        object: 'Dataset',
        ...(total !== undefined && { total }),
        ...(meta !== undefined && { meta }),
      }

      expect(options.total).toBe(1000)
      expect(options.meta).toEqual({ batch: true })
    })
  })
})

// =============================================================================
// NL Query Types Tests
// =============================================================================

describe('exactOptionalPropertyTypes: NL Query Types', () => {
  describe('NLQueryResult type', () => {
    it('creates result with required fields only', () => {
      const result: NLQueryResult<{ id: string }> = {
        interpretation: 'Find all items',
        confidence: 0.9,
        results: [{ id: '1' }, { id: '2' }],
      }

      expect(result.query).toBeUndefined()
      expect(result.explanation).toBeUndefined()
    })

    it('creates result with optional fields', () => {
      const query = 'SELECT * FROM items'
      const explanation = 'Found 2 items matching criteria'

      const result: NLQueryResult<{ id: string }> = {
        interpretation: 'Find all items',
        confidence: 0.95,
        results: [{ id: '1' }],
        ...(query !== undefined && { query }),
        ...(explanation !== undefined && { explanation }),
      }

      expect(result.query).toBe('SELECT * FROM items')
      expect(result.explanation).toBe('Found 2 items matching criteria')
    })
  })

  describe('NLQueryContext type', () => {
    it('creates context with required fields only', () => {
      const context: NLQueryContext = {
        types: [
          {
            name: 'Post',
            singular: 'post',
            plural: 'posts',
            fields: ['title', 'content'],
            relationships: [],
          },
        ],
      }

      expect(context.targetType).toBeUndefined()
      expect(context.recentEvents).toBeUndefined()
    })

    it('creates context with optional fields', () => {
      const targetType = 'Post'
      const recentEvents = [{ type: 'Post.created', timestamp: new Date() }]

      const context: NLQueryContext = {
        types: [],
        ...(targetType !== undefined && { targetType }),
        ...(recentEvents !== undefined && { recentEvents }),
      }

      expect(context.targetType).toBe('Post')
      expect(context.recentEvents).toHaveLength(1)
    })
  })

  describe('NLQueryPlan type', () => {
    it('creates plan with required fields only', () => {
      const plan: NLQueryPlan = {
        types: ['Post'],
        interpretation: 'List all posts',
        confidence: 0.8,
      }

      expect(plan.filters).toBeUndefined()
      expect(plan.search).toBeUndefined()
      expect(plan.timeRange).toBeUndefined()
      expect(plan.include).toBeUndefined()
    })

    it('creates plan with optional fields', () => {
      const filters = { status: 'published' }
      const search = 'typescript'
      const timeRange = { since: new Date() }
      const include = ['author', 'tags']

      const plan: NLQueryPlan = {
        types: ['Post'],
        interpretation: 'Find published posts about typescript',
        confidence: 0.95,
        ...(filters !== undefined && { filters }),
        ...(search !== undefined && { search }),
        ...(timeRange !== undefined && { timeRange }),
        ...(include !== undefined && { include }),
      }

      expect(plan.filters).toEqual({ status: 'published' })
      expect(plan.search).toBe('typescript')
      expect(plan.timeRange?.since).toBeDefined()
      expect(plan.include).toEqual(['author', 'tags'])
    })
  })
})

// =============================================================================
// GenerateOptions Tests
// =============================================================================

describe('exactOptionalPropertyTypes: GenerateOptions', () => {
  it('creates options with required fields only', () => {
    const options: GenerateOptions = {
      type: 'Post',
    }

    expect(options.count).toBeUndefined()
    expect(options.data).toBeUndefined()
    expect(options.mode).toBeUndefined()
  })

  it('creates options with optional fields', () => {
    const count = 10
    const data = { category: 'tech' }
    const mode: 'sync' | 'background' = 'background'

    const options: GenerateOptions = {
      type: 'Post',
      ...(count !== undefined && { count }),
      ...(data !== undefined && { data }),
      ...(mode !== undefined && { mode }),
    }

    expect(options.count).toBe(10)
    expect(options.data).toEqual({ category: 'tech' })
    expect(options.mode).toBe('background')
  })
})

// =============================================================================
// DBOptions Tests
// =============================================================================

describe('exactOptionalPropertyTypes: DBOptions', () => {
  it('creates options with no fields', () => {
    const options: DBOptions = {}

    expect(options.embeddings).toBeUndefined()
    expect(options.valueGenerator).toBeUndefined()
  })

  it('creates options with optional embeddings config', () => {
    const embeddings = {
      Post: { fields: ['title', 'content'] },
      User: false,
    }

    const options: DBOptions = {
      ...(embeddings !== undefined && { embeddings }),
    }

    expect(options.embeddings).toBeDefined()
    expect(options.embeddings?.['Post']).toEqual({ fields: ['title', 'content'] })
    expect(options.embeddings?.['User']).toBe(false)
  })
})
