import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { R2Bucket, R2Object, R2ObjectBody } from '@cloudflare/workers-types'
import { createMemoryProvider } from '../src/memory-provider.js'
import type { DigitalObjectsProvider } from '../src/types.js'

// Mock R2 bucket for testing
function createMockR2Bucket(): R2Bucket & { storage: Map<string, string> } {
  const storage = new Map<string, string>()

  return {
    storage,
    async put(key: string, value: string | ArrayBuffer | ReadableStream) {
      const content = typeof value === 'string' ? value : JSON.stringify(value)
      storage.set(key, content)
      return {
        key,
        version: '1',
        size: content.length,
        etag: 'mock-etag',
        httpEtag: '"mock-etag"',
        checksums: {},
        uploaded: new Date(),
        httpMetadata: {},
        customMetadata: {},
        writeHttpMetadata: () => {},
      } as R2Object
    },
    async get(key: string) {
      const content = storage.get(key)
      if (!content) return null
      return {
        key,
        version: '1',
        size: content.length,
        etag: 'mock-etag',
        httpEtag: '"mock-etag"',
        checksums: {},
        uploaded: new Date(),
        httpMetadata: {},
        customMetadata: {},
        body: new ReadableStream(),
        bodyUsed: false,
        arrayBuffer: async () => new TextEncoder().encode(content).buffer,
        text: async () => content,
        json: async () => JSON.parse(content),
        blob: async () => new Blob([content]),
        writeHttpMetadata: () => {},
      } as R2ObjectBody
    },
    async delete(key: string | string[]) {
      const keys = Array.isArray(key) ? key : [key]
      for (const k of keys) {
        storage.delete(k)
      }
    },
    async list(options?: { prefix?: string }) {
      const keys = Array.from(storage.keys())
        .filter((k) => !options?.prefix || k.startsWith(options.prefix))
        .map((key) => ({
          key,
          version: '1',
          size: storage.get(key)?.length ?? 0,
          etag: 'mock-etag',
          httpEtag: '"mock-etag"',
          checksums: {},
          uploaded: new Date(),
          httpMetadata: {},
          customMetadata: {},
        }))
      return {
        objects: keys,
        truncated: false,
        cursor: undefined,
        delimitedPrefixes: [],
      }
    },
    async head(key: string) {
      if (!storage.has(key)) return null
      return {
        key,
        version: '1',
        size: storage.get(key)?.length ?? 0,
        etag: 'mock-etag',
        httpEtag: '"mock-etag"',
        checksums: {},
        uploaded: new Date(),
        httpMetadata: {},
        customMetadata: {},
        writeHttpMetadata: () => {},
      } as R2Object
    },
    createMultipartUpload: vi.fn(),
    resumeMultipartUpload: vi.fn(),
  } as unknown as R2Bucket & { storage: Map<string, string> }
}

// Import the persistence functions
import {
  createSnapshot,
  restoreSnapshot,
  appendWAL,
  replayWAL,
  compactWAL,
  exportJSONL,
  importJSONL,
  exportToR2,
  importFromR2,
} from '../src/r2-persistence.js'

describe('R2 Persistence', () => {
  let provider: DigitalObjectsProvider
  let r2: R2Bucket & { storage: Map<string, string> }

  beforeEach(async () => {
    provider = createMemoryProvider()
    r2 = createMockR2Bucket()

    // Set up some test data
    await provider.defineNoun({ name: 'Post' })
    await provider.defineNoun({ name: 'Author' })
    await provider.defineVerb({ name: 'write' })
    await provider.defineVerb({ name: 'publish' })

    const author = await provider.create('Author', { name: 'Alice' })
    const post1 = await provider.create('Post', { title: 'First Post', status: 'published' })
    const post2 = await provider.create('Post', { title: 'Second Post', status: 'draft' })

    await provider.perform('write', author.id, post1.id)
    await provider.perform('write', author.id, post2.id)
    await provider.perform('publish', undefined, post1.id)
  })

  describe('Snapshot', () => {
    it('should create a complete snapshot', async () => {
      const snapshot = await createSnapshot(provider, r2, 'test-ns')

      expect(r2.storage.has('snapshots/test-ns/latest.json')).toBe(true)
      const stored = JSON.parse(r2.storage.get('snapshots/test-ns/latest.json')!)
      expect(stored.nouns).toHaveLength(2)
      expect(stored.verbs).toHaveLength(2)
      expect(stored.things).toHaveLength(3)
      expect(stored.actions).toHaveLength(3)
    })

    it('should restore from snapshot', async () => {
      await createSnapshot(provider, r2, 'test-ns')

      // Create fresh provider
      const newProvider = createMemoryProvider()
      await restoreSnapshot(newProvider, r2, 'test-ns')

      const nouns = await newProvider.listNouns()
      expect(nouns).toHaveLength(2)

      const posts = await newProvider.list('Post')
      expect(posts).toHaveLength(2)
    })

    it('should create timestamped snapshots', async () => {
      const result = await createSnapshot(provider, r2, 'test-ns', { timestamp: true })

      expect(result.key).toMatch(/snapshots\/test-ns\/\d+\.json/)
    })
  })

  describe('WAL (Write-Ahead Log)', () => {
    it('should append operations to WAL', async () => {
      await appendWAL(r2, 'test-ns', {
        type: 'create',
        noun: 'Post',
        id: 'test-id',
        data: { title: 'New Post' },
        timestamp: Date.now(),
      })

      const walFiles = await r2.list({ prefix: 'wal/test-ns/' })
      expect(walFiles.objects.length).toBeGreaterThan(0)
    })

    it('should replay WAL on top of snapshot', async () => {
      // Create snapshot
      await createSnapshot(provider, r2, 'test-ns')

      // Append some operations
      const timestamp = Date.now()
      await appendWAL(r2, 'test-ns', {
        type: 'create',
        noun: 'Post',
        id: 'wal-post-id',
        data: { title: 'WAL Post' },
        timestamp,
      })

      // Restore snapshot first, then replay WAL on fresh provider
      const newProvider = createMemoryProvider()
      await restoreSnapshot(newProvider, r2, 'test-ns')
      await replayWAL(newProvider, r2, 'test-ns')

      const posts = await newProvider.list('Post')
      expect(posts).toHaveLength(3) // 2 from snapshot + 1 from WAL
    })

    it('should compact WAL after snapshot', async () => {
      // Add multiple WAL entries
      for (let i = 0; i < 10; i++) {
        await appendWAL(r2, 'test-ns', {
          type: 'create',
          noun: 'Post',
          id: `post-${i}`,
          data: { title: `Post ${i}` },
          timestamp: Date.now() + i,
        })
      }

      // Compact (create snapshot + delete old WAL)
      await createSnapshot(provider, r2, 'test-ns')
      await compactWAL(r2, 'test-ns')

      const walFiles = await r2.list({ prefix: 'wal/test-ns/' })
      expect(walFiles.objects).toHaveLength(0)
    })
  })

  describe('JSONL Export/Import', () => {
    it('should export all data as JSONL', async () => {
      const jsonl = await exportJSONL(provider)

      const lines = jsonl.trim().split('\n')
      expect(lines.length).toBe(10) // 2 nouns + 2 verbs + 3 things + 3 actions

      // Each line should be valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow()
      }
    })

    it('should import from JSONL', async () => {
      const jsonl = await exportJSONL(provider)

      const newProvider = createMemoryProvider()
      await importJSONL(newProvider, jsonl)

      const nouns = await newProvider.listNouns()
      expect(nouns).toHaveLength(2)
    })

    it('should export to R2', async () => {
      await exportToR2(provider, r2, 'exports/test-ns.jsonl')

      expect(r2.storage.has('exports/test-ns.jsonl')).toBe(true)
    })

    it('should import from R2', async () => {
      await exportToR2(provider, r2, 'exports/test-ns.jsonl')

      const newProvider = createMemoryProvider()
      await importFromR2(newProvider, r2, 'exports/test-ns.jsonl')

      const things = await newProvider.list('Post')
      expect(things).toHaveLength(2)
    })
  })
})
