import { describe, it, expect } from 'vitest'
import { Graph } from '../src/graph.js'
import {
  buildDependencyGraph,
  topologicalSort,
  detectCycles,
  getParallelGroups,
  getAllDependencies,
  hasCycles,
  visualizeGraph,
  CircularDependencyError,
} from '../src/dependency-graph.js'

describe('buildDependencyGraph', () => {
  it('builds a graph from parsed schema', () => {
    const schema = Graph({
      Post: {
        author: '->User',
      },
      User: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)

    expect(graph.nodes['Post']).toBeDefined()
    expect(graph.nodes['User']).toBeDefined()
    expect(graph.nodes['Post']?.dependsOn).toContain('User')
    expect(graph.nodes['User']?.dependedOnBy).toContain('Post')
  })

  it('handles fuzzy operators as soft dependencies', () => {
    const schema = Graph({
      Post: {
        category: '~>Category',
      },
      Category: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)

    expect(graph.nodes['Post']?.dependsOn).not.toContain('Category')
    expect(graph.nodes['Post']?.softDependsOn).toContain('Category')
  })

  it('handles optional fields as soft dependencies', () => {
    const schema = Graph({
      Post: {
        author: '->User?',
      },
      User: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)

    expect(graph.nodes['Post']?.dependsOn).not.toContain('User')
    expect(graph.nodes['Post']?.softDependsOn).toContain('User')
  })

  it('tracks edges with metadata', () => {
    const schema = Graph({
      Post: {
        author: '->User.posts',
        categories: ['~>Category'],
      },
      User: {
        name: 'string',
      },
      Category: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)

    expect(graph.edges.length).toBeGreaterThan(0)
    const authorEdge = graph.edges.find((e) => e.fieldName === 'author')
    expect(authorEdge?.operator).toBe('->')
    expect(authorEdge?.isArray).toBe(false)

    const categoriesEdge = graph.edges.find((e) => e.fieldName === 'categories')
    expect(categoriesEdge?.operator).toBe('~>')
    expect(categoriesEdge?.isArray).toBe(true)
  })
})

describe('topologicalSort', () => {
  it('returns types in dependency order', () => {
    const schema = Graph({
      Post: {
        author: '->User',
      },
      User: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)
    const order = topologicalSort(graph, 'Post')

    // User should come before Post (dependencies first)
    expect(order.indexOf('User')).toBeLessThan(order.indexOf('Post'))
  })

  it('handles transitive dependencies', () => {
    const schema = Graph({
      Comment: {
        post: '->Post',
      },
      Post: {
        author: '->User',
      },
      User: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)
    const order = topologicalSort(graph, 'Comment')

    // Order: User, Post, Comment
    expect(order.indexOf('User')).toBeLessThan(order.indexOf('Post'))
    expect(order.indexOf('Post')).toBeLessThan(order.indexOf('Comment'))
  })

  it('throws CircularDependencyError for cycles', () => {
    const schema = Graph({
      A: {
        b: '->B',
      },
      B: {
        a: '->A',
      },
    })

    const graph = buildDependencyGraph(schema)

    expect(() => topologicalSort(graph, 'A')).toThrow(CircularDependencyError)
  })

  it('ignores optional dependencies when configured', () => {
    const schema = Graph({
      A: {
        b: '->B',
        c: '->C?', // Optional, should be ignored
      },
      B: {
        name: 'string',
      },
      C: {
        a: '->A', // Would create cycle if not optional
      },
    })

    const graph = buildDependencyGraph(schema)

    // Without ignoreOptional, this would throw due to A -> C? -> A cycle
    // But optional deps are already soft deps, so no cycle
    const order = topologicalSort(graph, 'A', true)
    expect(order).toContain('A')
    expect(order).toContain('B')
  })
})

describe('detectCycles', () => {
  it('returns empty array for acyclic graphs', () => {
    const schema = Graph({
      Post: {
        author: '->User',
      },
      User: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)
    const cycles = detectCycles(graph)

    expect(cycles).toEqual([])
  })

  it('detects simple cycles', () => {
    const schema = Graph({
      A: {
        b: '->B',
      },
      B: {
        a: '->A',
      },
    })

    const graph = buildDependencyGraph(schema)
    const cycles = detectCycles(graph)

    expect(cycles.length).toBeGreaterThan(0)
  })

  it('ignores optional dependencies when configured', () => {
    const schema = Graph({
      A: {
        b: '->B?', // Optional
      },
      B: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)
    const cycles = detectCycles(graph, { ignoreOptional: true })

    expect(cycles).toEqual([])
  })
})

describe('getParallelGroups', () => {
  it('groups independent types together', () => {
    const schema = Graph({
      Post: {
        author: '->User',
        category: '->Category',
      },
      User: {
        name: 'string',
      },
      Category: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)
    const groups = getParallelGroups(graph, 'Post')

    // User and Category can be generated in parallel (first group)
    // Post must come after both
    expect(groups.length).toBe(2)
    expect(groups[0]).toContain('User')
    expect(groups[0]).toContain('Category')
    expect(groups[1]).toContain('Post')
  })

  it('handles linear dependencies', () => {
    const schema = Graph({
      C: {
        b: '->B',
      },
      B: {
        a: '->A',
      },
      A: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)
    const groups = getParallelGroups(graph, 'C')

    // Each type in its own group
    expect(groups.length).toBe(3)
    expect(groups[0]).toEqual(['A'])
    expect(groups[1]).toEqual(['B'])
    expect(groups[2]).toEqual(['C'])
  })
})

describe('getAllDependencies', () => {
  it('returns all transitive dependencies', () => {
    const schema = Graph({
      C: {
        b: '->B',
      },
      B: {
        a: '->A',
      },
      A: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)
    const deps = getAllDependencies(graph, 'C')

    expect(deps.has('B')).toBe(true)
    expect(deps.has('A')).toBe(true)
    expect(deps.size).toBe(2)
  })

  it('returns empty set for types with no dependencies', () => {
    const schema = Graph({
      A: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)
    const deps = getAllDependencies(graph, 'A')

    expect(deps.size).toBe(0)
  })
})

describe('hasCycles', () => {
  it('returns false for acyclic graphs', () => {
    const schema = Graph({
      Post: {
        author: '->User',
      },
      User: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)
    expect(hasCycles(graph)).toBe(false)
  })

  it('returns true for cyclic graphs', () => {
    const schema = Graph({
      A: {
        b: '->B',
      },
      B: {
        a: '->A',
      },
    })

    const graph = buildDependencyGraph(schema)
    expect(hasCycles(graph)).toBe(true)
  })
})

describe('visualizeGraph', () => {
  it('returns a human-readable visualization', () => {
    const schema = Graph({
      Post: {
        author: '->User',
      },
      User: {
        name: 'string',
      },
    })

    const graph = buildDependencyGraph(schema)
    const viz = visualizeGraph(graph)

    expect(viz).toContain('Dependency Graph:')
    expect(viz).toContain('Post:')
    expect(viz).toContain('User')
    expect(viz).toContain('hard deps')
  })
})

describe('CircularDependencyError', () => {
  it('includes cycle path in error', () => {
    const error = new CircularDependencyError(['A', 'B', 'A'])
    expect(error.message).toContain('A -> B -> A')
    expect(error.cyclePath).toEqual(['A', 'B', 'A'])
    expect(error.name).toBe('CircularDependencyError')
  })
})
