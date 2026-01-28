import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NSClient, createNSClient } from '../src/ns-client.js'

// Mock fetch globally
const mockFetch = vi.fn()

describe('NSClient', () => {
  let client: NSClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = new NSClient({
      baseUrl: 'https://example.com/ns',
      namespace: 'test-namespace',
      fetch: mockFetch as typeof fetch,
    })
  })

  // ==================== Constructor & Configuration ====================

  describe('Constructor', () => {
    it('should create client with required options', () => {
      const newClient = new NSClient({
        baseUrl: 'https://example.com',
        fetch: mockFetch as typeof fetch,
      })
      expect(newClient).toBeInstanceOf(NSClient)
    })

    it('should use default namespace when not provided', async () => {
      const defaultNsClient = new NSClient({
        baseUrl: 'https://example.com',
        fetch: mockFetch as typeof fetch,
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await defaultNsClient.listNouns()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('ns=default'),
        expect.any(Object)
      )
    })

    it('should strip trailing slash from base URL', async () => {
      const clientWithSlash = new NSClient({
        baseUrl: 'https://example.com/',
        namespace: 'test',
        fetch: mockFetch as typeof fetch,
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await clientWithSlash.listNouns()

      // Should not have double slashes (except in protocol)
      const calledUrl = mockFetch.mock.calls[0][0] as string
      // Remove protocol for double-slash check
      const pathPart = calledUrl.replace('https://', '')
      expect(pathPart).not.toContain('//')
      expect(calledUrl.startsWith('https://example.com/nouns')).toBe(true)
    })

    it('should use custom fetch function when provided', async () => {
      const customFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })

      const customClient = new NSClient({
        baseUrl: 'https://example.com',
        fetch: customFetch as typeof fetch,
      })

      await customClient.listNouns()

      expect(customFetch).toHaveBeenCalled()
    })
  })

  // ==================== HTTP Methods ====================

  describe('HTTP methods', () => {
    it('should make GET requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Test',
          singular: 'test',
          plural: 'tests',
          slug: 'test',
          createdAt: new Date().toISOString(),
        }),
      })

      const result = await client.getNoun('Test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/nouns/Test'),
        expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
      )
      expect(result?.name).toBe('Test')
    })

    it('should make POST requests with JSON body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Test',
          singular: 'test',
          plural: 'tests',
          slug: 'test',
          createdAt: new Date().toISOString(),
        }),
      })

      await client.defineNoun({ name: 'Test' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/nouns'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Test' }),
          headers: { 'Content-Type': 'application/json' },
        })
      )
    })

    it('should make PATCH requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'thing-1',
          noun: 'Post',
          data: { title: 'Updated' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })

      await client.update('thing-1', { title: 'Updated' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/things/thing-1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ title: 'Updated' }),
        })
      )
    })

    it('should make DELETE requests for things', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deleted: true }),
      })

      const result = await client.delete('thing-1')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/things/thing-1'),
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(result).toBe(true)
    })

    it('should make DELETE requests for actions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deleted: true }),
      })

      const result = await client.deleteAction('action-1')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/actions/action-1'),
        expect.objectContaining({ method: 'DELETE' })
      )
      expect(result).toBe(true)
    })

    it('should include namespace in all requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.listNouns()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('ns=test-namespace'),
        expect.any(Object)
      )
    })
  })

  // ==================== Error Handling ====================

  describe('Error handling', () => {
    it('should return null for 404 responses on getNoun', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      const result = await client.getNoun('NonExistent')
      expect(result).toBeNull()
    })

    it('should return null for 404 responses on getVerb', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      const result = await client.getVerb('NonExistent')
      expect(result).toBeNull()
    })

    it('should return null for 404 responses on get', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      const result = await client.get('non-existent-id')
      expect(result).toBeNull()
    })

    it('should return null for 404 responses on getAction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      const result = await client.getAction('non-existent-id')
      expect(result).toBeNull()
    })

    it('should throw on 500 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      })

      await expect(client.defineNoun({ name: 'Test' })).rejects.toThrow('NS request failed: 500')
    })

    it('should throw on 400 errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request: invalid data',
      })

      await expect(client.create('Post', { invalid: true })).rejects.toThrow(
        'NS request failed: 400'
      )
    })

    it('should throw on 401 unauthorized errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized',
      })

      await expect(client.listNouns()).rejects.toThrow('NS request failed: 401')
    })

    it('should throw on 403 forbidden errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      })

      await expect(client.listNouns()).rejects.toThrow('NS request failed: 403')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      // Use listNouns which throws errors (getNoun catches and returns null)
      await expect(client.listNouns()).rejects.toThrow('Network error')
    })

    it('should handle connection refused errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      await expect(client.listNouns()).rejects.toThrow('ECONNREFUSED')
    })

    it('should handle timeout errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Request timeout'))

      await expect(client.create('Post', {})).rejects.toThrow('Request timeout')
    })

    it('should include error text in thrown error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        text: async () => 'Validation failed: name is required',
      })

      await expect(client.defineNoun({ name: '' })).rejects.toThrow(
        'NS request failed: 422 Validation failed: name is required'
      )
    })
  })

  // ==================== URL Encoding ====================

  describe('URL encoding', () => {
    it('should encode special characters in noun names', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      })

      try {
        await client.getNoun('Test/Noun')
      } catch {
        // Ignore error
      }

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('Test%2FNoun'),
        expect.any(Object)
      )
    })

    it('should encode special characters in thing IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      await client.get('id/with/slashes')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('id%2Fwith%2Fslashes'),
        expect.any(Object)
      )
    })

    it('should encode spaces in IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      await client.get('id with spaces')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('id%20with%20spaces'),
        expect.any(Object)
      )
    })

    it('should encode ampersands in IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      await client.get('id&with&ampersands')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('id%26with%26ampersands'),
        expect.any(Object)
      )
    })

    it('should encode question marks in IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      await client.get('id?with?questions')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('id%3Fwith%3Fquestions'),
        expect.any(Object)
      )
    })
  })

  // ==================== Noun Methods ====================

  describe('Noun methods', () => {
    it('should define a noun', async () => {
      const nounData = {
        name: 'Post',
        singular: 'post',
        plural: 'posts',
        slug: 'post',
        createdAt: new Date().toISOString(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => nounData,
      })

      const result = await client.defineNoun({ name: 'Post' })

      expect(result.name).toBe('Post')
      expect(result.singular).toBe('post')
    })

    it('should define a noun with description', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Article',
          description: 'A blog article',
          singular: 'article',
          plural: 'articles',
          slug: 'article',
          createdAt: new Date().toISOString(),
        }),
      })

      await client.defineNoun({ name: 'Article', description: 'A blog article' })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
      expect(body.description).toBe('A blog article')
    })

    it('should list all nouns', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            name: 'Post',
            singular: 'post',
            plural: 'posts',
            slug: 'post',
            createdAt: new Date().toISOString(),
          },
          {
            name: 'Author',
            singular: 'author',
            plural: 'authors',
            slug: 'author',
            createdAt: new Date().toISOString(),
          },
        ],
      })

      const nouns = await client.listNouns()

      expect(nouns).toHaveLength(2)
      expect(nouns[0].name).toBe('Post')
      expect(nouns[1].name).toBe('Author')
    })

    it('should return empty array when no nouns exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      const nouns = await client.listNouns()
      expect(nouns).toHaveLength(0)
    })
  })

  // ==================== Verb Methods ====================

  describe('Verb methods', () => {
    it('should define a verb', async () => {
      const verbData = {
        name: 'create',
        action: 'create',
        act: 'creates',
        activity: 'creating',
        event: 'created',
        reverseBy: 'createdBy',
        reverseAt: 'createdAt',
        createdAt: new Date().toISOString(),
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => verbData,
      })

      const result = await client.defineVerb({ name: 'create' })

      expect(result.name).toBe('create')
      expect(result.event).toBe('created')
    })

    it('should define a verb with inverse', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'publish',
          inverse: 'unpublish',
          action: 'publish',
          act: 'publishes',
          activity: 'publishing',
          event: 'published',
          createdAt: new Date().toISOString(),
        }),
      })

      await client.defineVerb({ name: 'publish', inverse: 'unpublish' })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
      expect(body.inverse).toBe('unpublish')
    })

    it('should get a verb by name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'write',
          action: 'write',
          act: 'writes',
          activity: 'writing',
          event: 'written',
          createdAt: new Date().toISOString(),
        }),
      })

      const verb = await client.getVerb('write')

      expect(verb?.name).toBe('write')
      expect(verb?.event).toBe('written')
    })

    it('should list all verbs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            name: 'create',
            action: 'create',
            act: 'creates',
            activity: 'creating',
            event: 'created',
            createdAt: new Date().toISOString(),
          },
          {
            name: 'delete',
            action: 'delete',
            act: 'deletes',
            activity: 'deleting',
            event: 'deleted',
            createdAt: new Date().toISOString(),
          },
        ],
      })

      const verbs = await client.listVerbs()

      expect(verbs).toHaveLength(2)
    })
  })

  // ==================== Thing Methods ====================

  describe('Thing methods', () => {
    it('should create a thing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'thing-123',
          noun: 'Post',
          data: { title: 'Hello World' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })

      const thing = await client.create('Post', { title: 'Hello World' })

      expect(thing.id).toBe('thing-123')
      expect(thing.noun).toBe('Post')
      expect(thing.data.title).toBe('Hello World')
    })

    it('should create a thing with custom ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'custom-id',
          noun: 'Post',
          data: { title: 'Custom' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })

      await client.create('Post', { title: 'Custom' }, 'custom-id')

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
      expect(body.id).toBe('custom-id')
    })

    it('should get a thing by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'thing-123',
          noun: 'Post',
          data: { title: 'Test Post' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })

      const thing = await client.get('thing-123')

      expect(thing?.id).toBe('thing-123')
      expect(thing?.data.title).toBe('Test Post')
    })

    it('should list things by noun', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'post-1',
            noun: 'Post',
            data: { title: 'First' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'post-2',
            noun: 'Post',
            data: { title: 'Second' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      })

      const posts = await client.list('Post')

      expect(posts).toHaveLength(2)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('noun=Post'),
        expect.any(Object)
      )
    })

    it('should list things with limit option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.list('Post', { limit: 10 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object)
      )
    })

    it('should list things with offset option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.list('Post', { offset: 20 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('offset=20'),
        expect.any(Object)
      )
    })

    it('should list things with orderBy option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.list('Post', { orderBy: 'createdAt' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('orderBy=createdAt'),
        expect.any(Object)
      )
    })

    it('should list things with order option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.list('Post', { order: 'desc' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('order=desc'),
        expect.any(Object)
      )
    })

    it('should filter results client-side with where option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'post-1',
            noun: 'Post',
            data: { title: 'Draft', status: 'draft' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'post-2',
            noun: 'Post',
            data: { title: 'Published', status: 'published' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      })

      const posts = await client.list<{ title: string; status: string }>('Post', {
        where: { status: 'draft' },
      })

      expect(posts).toHaveLength(1)
      expect(posts[0].data.status).toBe('draft')
    })

    it('should find things by criteria', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'post-1',
            noun: 'Post',
            data: { status: 'published' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      })

      const posts = await client.find<{ status: string }>('Post', { status: 'published' })

      expect(posts).toHaveLength(1)
    })

    it('should update a thing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'post-1',
          noun: 'Post',
          data: { title: 'Updated Title' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })

      const updated = await client.update('post-1', { title: 'Updated Title' })

      expect(updated.data.title).toBe('Updated Title')
    })

    it('should delete a thing and return true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deleted: true }),
      })

      const result = await client.delete('post-1')
      expect(result).toBe(true)
    })

    it('should delete a thing and return false when not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deleted: false }),
      })

      const result = await client.delete('non-existent')
      expect(result).toBe(false)
    })

    it('should search things', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'post-1',
            noun: 'Post',
            data: { title: 'Hello World' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      })

      const results = await client.search('Hello')

      expect(results).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('q=Hello'), expect.any(Object))
    })

    it('should search things with limit option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.search('test', { limit: 5 })

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('limit=5'), expect.any(Object))
    })
  })

  // ==================== Action Methods ====================

  describe('Action methods', () => {
    it('should perform an action', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'action-123',
          verb: 'write',
          subject: 'author-1',
          object: 'post-1',
          status: 'completed',
          createdAt: new Date().toISOString(),
        }),
      })

      const action = await client.perform('write', 'author-1', 'post-1')

      expect(action.id).toBe('action-123')
      expect(action.verb).toBe('write')
      expect(action.subject).toBe('author-1')
      expect(action.object).toBe('post-1')
    })

    it('should perform an action with data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'action-123',
          verb: 'publish',
          object: 'post-1',
          data: { publishedBy: 'admin' },
          status: 'completed',
          createdAt: new Date().toISOString(),
        }),
      })

      await client.perform('publish', undefined, 'post-1', { publishedBy: 'admin' })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
      expect(body.data.publishedBy).toBe('admin')
    })

    it('should perform an action without subject or object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'action-123',
          verb: 'backup',
          status: 'completed',
          createdAt: new Date().toISOString(),
        }),
      })

      const action = await client.perform('backup')

      expect(action.verb).toBe('backup')
      expect(action.subject).toBeUndefined()
      expect(action.object).toBeUndefined()
    })

    it('should get an action by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'action-123',
          verb: 'write',
          status: 'completed',
          createdAt: new Date().toISOString(),
        }),
      })

      const action = await client.getAction('action-123')

      expect(action?.id).toBe('action-123')
    })

    it('should list actions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'action-1',
            verb: 'write',
            status: 'completed',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'action-2',
            verb: 'publish',
            status: 'completed',
            createdAt: new Date().toISOString(),
          },
        ],
      })

      const actions = await client.listActions()

      expect(actions).toHaveLength(2)
    })

    it('should list actions with verb filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.listActions({ verb: 'write' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('verb=write'),
        expect.any(Object)
      )
    })

    it('should list actions with subject filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.listActions({ subject: 'author-1' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('subject=author-1'),
        expect.any(Object)
      )
    })

    it('should list actions with object filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.listActions({ object: 'post-1' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('object=post-1'),
        expect.any(Object)
      )
    })

    it('should list actions with status filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.listActions({ status: 'pending' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=pending'),
        expect.any(Object)
      )
    })

    it('should list actions with array status filter (uses first)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.listActions({ status: ['pending', 'active'] })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=pending'),
        expect.any(Object)
      )
    })

    it('should list actions with limit filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.listActions({ limit: 50 })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=50'),
        expect.any(Object)
      )
    })

    it('should delete an action and return true', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deleted: true }),
      })

      const result = await client.deleteAction('action-1')
      expect(result).toBe(true)
    })

    it('should delete an action and return false when not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deleted: false }),
      })

      const result = await client.deleteAction('non-existent')
      expect(result).toBe(false)
    })
  })

  // ==================== Graph Traversal Methods ====================

  describe('Graph traversal methods', () => {
    it('should get related things', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'post-1',
            noun: 'Post',
            data: { title: 'Post 1' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 'post-2',
            noun: 'Post',
            data: { title: 'Post 2' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      })

      const related = await client.related('author-1')

      expect(related).toHaveLength(2)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/related/author-1'),
        expect.any(Object)
      )
    })

    it('should get related things with verb filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.related('author-1', 'write')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('verb=write'),
        expect.any(Object)
      )
    })

    it('should get related things with outbound direction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.related('author-1', 'write', 'out')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('direction=out'),
        expect.any(Object)
      )
    })

    it('should get related things with inbound direction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.related('post-1', 'write', 'in')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('direction=in'),
        expect.any(Object)
      )
    })

    it('should get related things with both direction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.related('thing-1', undefined, 'both')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('direction=both'),
        expect.any(Object)
      )
    })

    it('should get edges for a thing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'action-1',
            verb: 'write',
            subject: 'author-1',
            object: 'post-1',
            status: 'completed',
            createdAt: new Date().toISOString(),
          },
        ],
      })

      const edges = await client.edges('author-1')

      expect(edges).toHaveLength(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/edges/author-1'),
        expect.any(Object)
      )
    })

    it('should get edges with verb filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.edges('author-1', 'write')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('verb=write'),
        expect.any(Object)
      )
    })

    it('should get edges with direction', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.edges('author-1', undefined, 'out')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('direction=out'),
        expect.any(Object)
      )
    })
  })

  // ==================== Lifecycle Methods ====================

  describe('Lifecycle methods', () => {
    it('should have a close method that does nothing', async () => {
      await expect(client.close()).resolves.toBeUndefined()
    })

    it('should be callable multiple times without error', async () => {
      await client.close()
      await client.close()
      await expect(client.close()).resolves.toBeUndefined()
    })
  })

  // ==================== Factory Function ====================

  describe('createNSClient factory', () => {
    it('should create an NSClient instance', () => {
      const factoryClient = createNSClient({
        baseUrl: 'https://example.com',
        namespace: 'test',
        fetch: mockFetch as typeof fetch,
      })

      expect(factoryClient).toBeDefined()
      expect(typeof factoryClient.defineNoun).toBe('function')
      expect(typeof factoryClient.create).toBe('function')
    })

    it('should return a DigitalObjectsProvider compatible object', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      })

      const provider = createNSClient({
        baseUrl: 'https://example.com',
        fetch: mockFetch as typeof fetch,
      })

      // Verify all DigitalObjectsProvider methods exist
      expect(provider.defineNoun).toBeDefined()
      expect(provider.getNoun).toBeDefined()
      expect(provider.listNouns).toBeDefined()
      expect(provider.defineVerb).toBeDefined()
      expect(provider.getVerb).toBeDefined()
      expect(provider.listVerbs).toBeDefined()
      expect(provider.create).toBeDefined()
      expect(provider.get).toBeDefined()
      expect(provider.list).toBeDefined()
      expect(provider.find).toBeDefined()
      expect(provider.update).toBeDefined()
      expect(provider.delete).toBeDefined()
      expect(provider.search).toBeDefined()
      expect(provider.perform).toBeDefined()
      expect(provider.getAction).toBeDefined()
      expect(provider.listActions).toBeDefined()
      expect(provider.deleteAction).toBeDefined()
      expect(provider.related).toBeDefined()
      expect(provider.edges).toBeDefined()
    })
  })

  // ==================== Edge Cases ====================

  describe('Edge cases', () => {
    it('should handle empty response body for list operations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      const result = await client.listNouns()
      expect(result).toEqual([])
    })

    it('should handle responses with extra fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          name: 'Test',
          singular: 'test',
          plural: 'tests',
          slug: 'test',
          createdAt: new Date().toISOString(),
          extraField: 'should be ignored by TypeScript but passed through',
        }),
      })

      const noun = await client.getNoun('Test')
      expect(noun?.name).toBe('Test')
    })

    it('should handle Unicode characters in IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      await client.get('id-with-unicode-\u4e2d\u6587')

      // URLSearchParams encodes Unicode
      expect(mockFetch).toHaveBeenCalled()
    })

    it('should handle very long IDs', async () => {
      const longId = 'a'.repeat(1000)

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not found',
      })

      await client.get(longId)

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining(longId), expect.any(Object))
    })

    it('should handle concurrent requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          name: 'Test',
          singular: 'test',
          plural: 'tests',
          slug: 'test',
          createdAt: new Date().toISOString(),
        }),
      })

      const promises = [client.getNoun('Test1'), client.getNoun('Test2'), client.getNoun('Test3')]

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should handle null data in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'thing-1',
          noun: 'Post',
          data: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      })

      const thing = await client.get('thing-1')
      expect(thing?.data).toBeNull()
    })

    it('should handle undefined optional parameters in listActions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })

      await client.listActions({})

      // Should not include undefined params in URL
      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).not.toContain('undefined')
    })
  })
})
