import { describe, it, expect, vi } from 'vitest'
import { DO } from './do'

describe('Event handlers', () => {
  it('detects onNounEvent handlers', () => {
    const Post = DO({
      $type: 'Post',
      title: 'Title',
      onPostCreated: (post, $) => console.log('created', post),
      onPostUpdated: (payload, $) => console.log('updated', payload),
      onPostDeleted: (post, $) => console.log('deleted', post),
    })

    expect(Post.events).toHaveProperty('onPostCreated')
    expect(Post.events).toHaveProperty('onPostUpdated')
    expect(Post.events).toHaveProperty('onPostDeleted')
    expect(typeof Post.events.onPostCreated).toBe('function')
  })

  it('does not include events in fields', () => {
    const Post = DO({
      $type: 'Post',
      title: 'Title',
      onPostCreated: (post, $) => {},
    })

    expect(Post.fields).not.toHaveProperty('onPostCreated')
  })

  it('triggers event on create()', () => {
    const handler = vi.fn()
    const Post = DO({
      $type: 'Post',
      title: 'Title',
      onPostCreated: handler,
    })

    Post.create('post-1', { title: 'Hello' })
    expect(handler).toHaveBeenCalled()
  })
})

describe('Schedule handlers', () => {
  it('detects everyInterval handlers', () => {
    const Reporter = DO({
      $type: 'Reporter',
      everyHour: ($) => console.log('hourly'),
      everyDay: ($) => console.log('daily'),
      everyWeek: ($) => console.log('weekly'),
    })

    expect(Reporter.schedules).toHaveProperty('everyHour')
    expect(Reporter.schedules).toHaveProperty('everyDay')
    expect(Reporter.schedules).toHaveProperty('everyWeek')
  })

  it('does not include schedules in fields', () => {
    const Reporter = DO({
      $type: 'Reporter',
      everyHour: ($) => {},
    })

    expect(Reporter.fields).not.toHaveProperty('everyHour')
  })
})

describe('Cron handlers', () => {
  it('detects cron pattern handlers', () => {
    const Scheduler = DO({
      $type: 'Scheduler',
      '0 9 * * 1': ($) => console.log('Monday 9am'),
      '*/15 * * * *': ($) => console.log('Every 15 min'),
    })

    expect(Scheduler.crons).toHaveProperty('0 9 * * 1')
    expect(Scheduler.crons).toHaveProperty('*/15 * * * *')
  })
})

describe('Migration handlers', () => {
  it('detects migrate.N handlers', () => {
    const Post = DO({
      $type: 'Post',
      $version: 3,
      title: 'Title',
      'migrate.2': ($) => console.log('migrate to v2'),
      'migrate.3': ($) => console.log('migrate to v3'),
    })

    expect(Post.migrations).toHaveProperty('2')
    expect(Post.migrations).toHaveProperty('3')
    expect(typeof Post.migrations[2]).toBe('function')
  })

  it('does not include migrations in fields', () => {
    const Post = DO({
      $type: 'Post',
      'migrate.2': ($) => {},
    })

    expect(Post.fields).not.toHaveProperty('migrate.2')
  })

  it('runs migrations in order on version upgrade', () => {
    const migrations: number[] = []

    // Simulate storage with old version
    const mockStorage = {
      get: (key: string) => (key === '$version' ? 1 : null),
      put: vi.fn(),
      delete: vi.fn(),
      list: () => new Map(),
    }

    const Post = DO({
      $type: 'Post',
      $version: 3,
      'migrate.2': ($) => migrations.push(2),
      'migrate.3': ($) => migrations.push(3),
    })

    Post.bind(mockStorage)

    expect(migrations).toEqual([2, 3])
  })
})

describe('DOContext ($)', () => {
  it('provides $id, $type, $version', () => {
    let capturedContext: any

    const Post = DO({
      $type: 'Post',
      $version: 2,
      onPostCreated: (post, $) => {
        capturedContext = $
      },
    })

    Post.create('post-1', { title: 'Test' })

    expect(capturedContext.$type).toBe('Post')
    expect(capturedContext.$version).toBe(2)
  })

  it('provides instance operations', () => {
    let capturedContext: any

    const Post = DO({
      $type: 'Post',
      onPostCreated: (post, $) => {
        capturedContext = $
      },
    })

    Post.create('post-1', { title: 'Test' })

    expect(typeof capturedContext.instances).toBe('function')
    expect(typeof capturedContext.create).toBe('function')
    expect(typeof capturedContext.get).toBe('function')
    expect(typeof capturedContext.put).toBe('function')
    expect(typeof capturedContext.delete).toBe('function')
  })
})
