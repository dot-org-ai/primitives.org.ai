import { describe, it, expect } from 'vitest'
import { DO, DigitalObjectDefinition } from './do'

describe('DO() factory', () => {
  it('creates DigitalObjectDefinition from object', () => {
    const Post = DO({ $type: 'Post', title: 'Post title' })
    expect(Post).toBeInstanceOf(DigitalObjectDefinition)
    expect(Post.$type).toBe('Post')
  })

  it('has $version defaulting to 1', () => {
    const Post = DO({ $type: 'Post' })
    expect(Post.$version).toBe(1)
  })

  it('accepts explicit $version', () => {
    const Post = DO({ $type: 'Post', $version: 3 })
    expect(Post.$version).toBe(3)
  })

  it('exposes fields property', () => {
    const Post = DO({ $type: 'Post', title: 'Title', body: 'Body content' })
    expect(Post.fields).toHaveProperty('title')
    expect(Post.fields).toHaveProperty('body')
  })

  it('is callable for extension', () => {
    const Base = DO({ $type: 'Base', name: 'Name' })
    const Extended = Base({ $type: 'Extended', extra: 'Extra field' })
    expect(Extended.$type).toBe('Extended')
    expect(Extended.$extends).toBe('Base')
    expect(Extended.fields).toHaveProperty('name')
    expect(Extended.fields).toHaveProperty('extra')
  })

  it('serializes to JSON', () => {
    const Post = DO({ $type: 'Post', title: 'Title' })
    const json = Post.toJSON()
    expect(json.$type).toBe('Post')
    expect(json.title).toBe('Title')
  })

  it('parses from JSON string', () => {
    const json = JSON.stringify({ $type: 'Post', title: 'Title' })
    const Post = DO.parse(json)
    expect(Post.$type).toBe('Post')
  })
})

describe('DigitalObjectDefinition instance management', () => {
  it('creates instances with create()', () => {
    const Post = DO({ $type: 'Post', title: 'Title' })
    const instance = Post.create('post-1', { title: 'Hello' })
    expect(instance.$id).toBe('post-1')
    expect(instance.$type).toBe('Post')
    expect(instance.data.title).toBe('Hello')
  })

  it('retrieves instances with get()', () => {
    const Post = DO({ $type: 'Post', title: 'Title' })
    Post.create('post-1', { title: 'Hello' })
    const instance = Post.get('post-1')
    expect(instance).not.toBeNull()
    expect(instance?.data.title).toBe('Hello')
  })

  it('lists all instances', () => {
    const Post = DO({ $type: 'Post', title: 'Title' })
    Post.create('post-1', { title: 'First' })
    Post.create('post-2', { title: 'Second' })
    const instances = Post.instances()
    expect(instances).toHaveLength(2)
  })

  it('updates instances with put()', () => {
    const Post = DO({ $type: 'Post', title: 'Title' })
    Post.create('post-1', { title: 'Hello' })
    Post.put('post-1', { title: 'Updated' })
    const instance = Post.get('post-1')
    expect(instance?.data.title).toBe('Updated')
  })

  it('deletes instances', () => {
    const Post = DO({ $type: 'Post', title: 'Title' })
    Post.create('post-1', { title: 'Hello' })
    const deleted = Post.delete('post-1')
    expect(deleted).toBe(true)
    expect(Post.get('post-1')).toBeNull()
  })
})
