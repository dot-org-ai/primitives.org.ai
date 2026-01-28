import { describe, it, expect } from 'vitest'
import { DigitalObjectsWorker, DigitalObjectsService } from '../src/worker'
import { WorkerEntrypoint, RpcTarget } from 'cloudflare:workers'

describe('DigitalObjectsWorker', () => {
  it('should extend WorkerEntrypoint', () => {
    expect(DigitalObjectsWorker.prototype).toBeInstanceOf(WorkerEntrypoint.prototype.constructor)
  })

  it('should have connect method', () => {
    expect(typeof DigitalObjectsWorker.prototype.connect).toBe('function')
  })
})

describe('DigitalObjectsService', () => {
  it('should extend RpcTarget', () => {
    expect(DigitalObjectsService.prototype).toBeInstanceOf(RpcTarget.prototype.constructor)
  })

  it('should expose core provider methods', () => {
    const proto = DigitalObjectsService.prototype
    // Noun/Verb definitions
    expect(typeof proto.defineNoun).toBe('function')
    expect(typeof proto.defineVerb).toBe('function')
    // Thing CRUD
    expect(typeof proto.create).toBe('function')
    expect(typeof proto.get).toBe('function')
    expect(typeof proto.list).toBe('function')
    expect(typeof proto.update).toBe('function')
    expect(typeof proto.delete).toBe('function')
    // Relationships
    expect(typeof proto.relate).toBe('function')
    expect(typeof proto.unrelate).toBe('function')
    expect(typeof proto.related).toBe('function')
    // Actions
    expect(typeof proto.perform).toBe('function')
    expect(typeof proto.listActions).toBe('function')
    // Search
    expect(typeof proto.search).toBe('function')
  })
})

describe('DigitalObjectsService CRUD', () => {
  it('should create and get things', async () => {
    const service = new DigitalObjectsService('test-crud')
    const created = await service.create('Post', { title: 'Hello' })
    expect(created.id).toBeDefined()
    expect(created.noun).toBe('Post')
    expect(created.data.title).toBe('Hello')

    const retrieved = await service.get(created.id)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.data.title).toBe('Hello')
  })

  it('should update things', async () => {
    const service = new DigitalObjectsService('test-update')
    const created = await service.create('Post', { title: 'Hello' })
    const updated = await service.update(created.id, { title: 'Updated' })
    expect(updated.data.title).toBe('Updated')
  })

  it('should delete things', async () => {
    const service = new DigitalObjectsService('test-delete')
    const created = await service.create('Post', { title: 'Hello' })
    const deleted = await service.delete(created.id)
    expect(deleted).toBe(true)
    expect(await service.get(created.id)).toBeNull()
  })

  it('should list things', async () => {
    const service = new DigitalObjectsService('test-list')
    await service.create('Post', { title: 'First' })
    await service.create('Post', { title: 'Second' })
    const posts = await service.list('Post')
    expect(posts.length).toBe(2)
  })
})

describe('DigitalObjectsService relationships', () => {
  it('should create relationships with relate()', async () => {
    const service = new DigitalObjectsService('test-relate')
    const user = await service.create('User', { name: 'Alice' })
    const post = await service.create('Post', { title: 'Hello' })

    const action = await service.relate(user.id, 'wrote', post.id)
    expect(action.verb).toBe('wrote')
    expect(action.subject).toBe(user.id)
    expect(action.object).toBe(post.id)
  })

  it('should find related things', async () => {
    const service = new DigitalObjectsService('test-related')
    const user = await service.create('User', { name: 'Bob' })
    const post1 = await service.create('Post', { title: 'First' })
    const post2 = await service.create('Post', { title: 'Second' })

    await service.relate(user.id, 'wrote', post1.id)
    await service.relate(user.id, 'wrote', post2.id)

    const related = await service.related(user.id, 'wrote', 'out')
    expect(related.length).toBe(2)
  })

  it('should unrelate things', async () => {
    const service = new DigitalObjectsService('test-unrelate')
    const user = await service.create('User', { name: 'Carol' })
    const post = await service.create('Post', { title: 'Hello' })

    await service.relate(user.id, 'wrote', post.id)
    const unrelated = await service.unrelate(user.id, 'wrote', post.id)
    expect(unrelated).toBe(true)

    const related = await service.related(user.id, 'wrote')
    expect(related.length).toBe(0)
  })
})

describe('Namespace isolation', () => {
  it('should isolate data between namespaces', async () => {
    const service1 = new DigitalObjectsService('ns-1')
    const service2 = new DigitalObjectsService('ns-2')

    await service1.create('Post', { title: 'In NS1' })
    await service2.create('Post', { title: 'In NS2' })

    const posts1 = await service1.list('Post')
    const posts2 = await service2.list('Post')

    expect(posts1.length).toBe(1)
    expect(posts1[0].data.title).toBe('In NS1')
    expect(posts2.length).toBe(1)
    expect(posts2[0].data.title).toBe('In NS2')
  })
})
