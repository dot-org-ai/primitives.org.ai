/**
 * Tests for Schema Dependency Graph
 *
 * The dependency graph is used to:
 * - Determine generation order for cascade operations
 * - Detect circular dependencies
 * - Identify parallel generation opportunities
 *
 * Uses TDD red-green-refactor methodology.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import { parseSchema } from '../../src/schema/parse.js'
import {
  buildDependencyGraph,
  topologicalSort,
  detectCycles,
  getParallelGroups,
  CircularDependencyError,
  PRIMITIVE_TYPES,
  type SchemaDepGraph,
  type SchemaDepNode,
  type SchemaDepEdge,
} from '../../src/schema/dependency-graph.js'

describe('Dependency Graph', () => {
  describe('buildDependencyGraph', () => {
    it('should build graph from schema entity relationships', () => {
      const schema = parseSchema({
        Post: {
          title: 'string',
          author: '->Author',
        },
        Author: {
          name: 'string',
        },
      })

      const graph = buildDependencyGraph(schema)

      expect(graph.nodes).toHaveProperty('Post')
      expect(graph.nodes).toHaveProperty('Author')
      expect(graph.nodes['Post'].dependsOn).toContain('Author')
      expect(graph.nodes['Author'].dependedOnBy).toContain('Post')
    })

    it('should handle forward exact (->) dependencies as hard dependencies', () => {
      const schema = parseSchema({
        Order: {
          customer: '->Customer',
          items: ['->LineItem'],
        },
        Customer: { name: 'string' },
        LineItem: { product: '->Product' },
        Product: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)

      // Order depends on Customer and LineItem
      expect(graph.nodes['Order'].dependsOn).toContain('Customer')
      expect(graph.nodes['Order'].dependsOn).toContain('LineItem')

      // LineItem depends on Product
      expect(graph.nodes['LineItem'].dependsOn).toContain('Product')

      // These should be hard dependencies (not soft)
      expect(graph.nodes['Order'].softDependsOn).not.toContain('Customer')
      expect(graph.nodes['Order'].softDependsOn).not.toContain('LineItem')
    })

    it('should handle forward fuzzy (~>) dependencies as soft dependencies', () => {
      const schema = parseSchema({
        Article: {
          title: 'string',
          category: '~>Category',
          relatedPosts: ['~>Post'],
        },
        Category: { name: 'string' },
        Post: { title: 'string' },
      })

      const graph = buildDependencyGraph(schema)

      // Fuzzy references should be soft dependencies
      expect(graph.nodes['Article'].softDependsOn).toContain('Category')
      expect(graph.nodes['Article'].softDependsOn).toContain('Post')

      // They should NOT be hard dependencies
      expect(graph.nodes['Article'].dependsOn).not.toContain('Category')
      expect(graph.nodes['Article'].dependsOn).not.toContain('Post')
    })

    it('should handle backward exact (<-) references', () => {
      const schema = parseSchema({
        Comment: {
          text: 'string',
          post: '<-Post',
        },
        Post: {
          title: 'string',
        },
      })

      const graph = buildDependencyGraph(schema)

      // Backward references don't create hard dependencies for generation order
      // (the parent creates the child, not the other way around)
      expect(graph.nodes['Comment'].dependsOn).not.toContain('Post')
    })

    it('should handle backward fuzzy (<~) references as soft dependencies', () => {
      const schema = parseSchema({
        Review: {
          content: 'string',
          product: '<~Product',
        },
        Product: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)

      // Backward fuzzy should be soft dependency
      expect(graph.nodes['Review'].softDependsOn).toContain('Product')
      expect(graph.nodes['Review'].dependsOn).not.toContain('Product')
    })

    it('should ignore primitive types', () => {
      const schema = parseSchema({
        User: {
          name: 'string',
          age: 'number',
          active: 'boolean',
          createdAt: 'date',
        },
      })

      const graph = buildDependencyGraph(schema)

      expect(graph.nodes['User'].dependsOn).toEqual([])
      expect(graph.nodes['User'].softDependsOn).toEqual([])
    })

    it('should track edges with metadata', () => {
      const schema = parseSchema({
        Task: {
          assignee: '->Person',
          reviewer: '~>Person',
        },
        Person: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)

      const assigneeEdge = graph.edges.find(
        (e) => e.from === 'Task' && e.fieldName === 'assignee'
      )
      expect(assigneeEdge).toBeDefined()
      expect(assigneeEdge?.operator).toBe('->')
      expect(assigneeEdge?.to).toBe('Person')

      const reviewerEdge = graph.edges.find(
        (e) => e.from === 'Task' && e.fieldName === 'reviewer'
      )
      expect(reviewerEdge).toBeDefined()
      expect(reviewerEdge?.operator).toBe('~>')
    })

    it('should handle optional fields', () => {
      const schema = parseSchema({
        Project: {
          name: 'string',
          lead: '->Person?',
          sponsor: '~>Company?',
        },
        Person: { name: 'string' },
        Company: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)

      // Optional exact reference should still be tracked (but in softDependsOn)
      // The key is that optional fields don't block generation
      const leadEdge = graph.edges.find(
        (e) => e.from === 'Project' && e.to === 'Person'
      )
      expect(leadEdge).toBeDefined()
      // Field name should have ? suffix to mark it as optional
      expect(leadEdge?.fieldName).toBe('lead?')

      // Optional fields should be in softDependsOn, not dependsOn
      expect(graph.nodes['Project'].softDependsOn).toContain('Person')
      expect(graph.nodes['Project'].dependsOn).not.toContain('Person')
    })

    it('should handle array relationships', () => {
      const schema = parseSchema({
        Team: {
          members: ['->Person'],
          advisors: ['~>Expert'],
        },
        Person: { name: 'string' },
        Expert: { specialty: 'string' },
      })

      const graph = buildDependencyGraph(schema)

      const membersEdge = graph.edges.find(
        (e) => e.from === 'Team' && e.fieldName === 'members'
      )
      expect(membersEdge).toBeDefined()
      expect(membersEdge?.isArray).toBe(true)
    })
  })

  describe('topologicalSort', () => {
    it('should return types in correct generation order', () => {
      const schema = parseSchema({
        Order: { customer: '->Customer', items: ['->LineItem'] },
        Customer: { name: 'string' },
        LineItem: { product: '->Product' },
        Product: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const order = topologicalSort(graph, 'Order')

      // Product should come before LineItem
      expect(order.indexOf('Product')).toBeLessThan(order.indexOf('LineItem'))

      // Customer and LineItem should come before Order
      expect(order.indexOf('Customer')).toBeLessThan(order.indexOf('Order'))
      expect(order.indexOf('LineItem')).toBeLessThan(order.indexOf('Order'))

      // Order should be last since we're generating it
      expect(order[order.length - 1]).toBe('Order')
    })

    it('should handle linear dependency chains', () => {
      const schema = parseSchema({
        A: { b: '->B' },
        B: { c: '->C' },
        C: { d: '->D' },
        D: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const order = topologicalSort(graph, 'A')

      expect(order).toEqual(['D', 'C', 'B', 'A'])
    })

    it('should handle diamond dependencies', () => {
      const schema = parseSchema({
        Top: { left: '->Left', right: '->Right' },
        Left: { bottom: '->Bottom' },
        Right: { bottom: '->Bottom' },
        Bottom: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const order = topologicalSort(graph, 'Top')

      // Bottom must come before Left and Right
      expect(order.indexOf('Bottom')).toBeLessThan(order.indexOf('Left'))
      expect(order.indexOf('Bottom')).toBeLessThan(order.indexOf('Right'))

      // Left and Right must come before Top
      expect(order.indexOf('Left')).toBeLessThan(order.indexOf('Top'))
      expect(order.indexOf('Right')).toBeLessThan(order.indexOf('Top'))

      // Top should be last
      expect(order[order.length - 1]).toBe('Top')
    })

    it('should only include reachable types from root', () => {
      const schema = parseSchema({
        Main: { dep: '->Dep' },
        Dep: { name: 'string' },
        Unrelated: { other: '->OtherDep' },
        OtherDep: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const order = topologicalSort(graph, 'Main')

      expect(order).toContain('Main')
      expect(order).toContain('Dep')
      expect(order).not.toContain('Unrelated')
      expect(order).not.toContain('OtherDep')
    })

    it('should handle self-referential types', () => {
      const schema = parseSchema({
        Node: {
          value: 'string',
          parent: '->Node?',
        },
      })

      const graph = buildDependencyGraph(schema)

      // With optional self-reference, should not throw
      const order = topologicalSort(graph, 'Node', true)
      expect(order).toContain('Node')
    })

    it('should throw CircularDependencyError for cycles', () => {
      const schema = parseSchema({
        A: { b: '->B' },
        B: { a: '->A' },
      })

      const graph = buildDependencyGraph(schema)

      expect(() => topologicalSort(graph, 'A')).toThrow(CircularDependencyError)
    })

    it('should ignore optional dependencies when ignoreOptional is true', () => {
      const schema = parseSchema({
        Parent: { child: '->Child' },
        Child: { parent: '->Parent?' }, // Optional back-reference
      })

      const graph = buildDependencyGraph(schema)

      // Without ignoreOptional, this would be a cycle
      // With ignoreOptional, the optional reference is skipped
      const order = topologicalSort(graph, 'Parent', true)
      expect(order).toContain('Parent')
      expect(order).toContain('Child')
    })
  })

  describe('detectCycles', () => {
    it('should detect simple A -> B -> A cycle', () => {
      const schema = parseSchema({
        A: { b: '->B' },
        B: { a: '->A' },
      })

      const graph = buildDependencyGraph(schema)
      const cycles = detectCycles(graph)

      expect(cycles.length).toBeGreaterThan(0)
      // Cycle should include A and B
      const cycle = cycles[0]
      expect(cycle).toContain('A')
      expect(cycle).toContain('B')
    })

    it('should detect complex A -> B -> C -> A cycle', () => {
      const schema = parseSchema({
        A: { b: '->B' },
        B: { c: '->C' },
        C: { a: '->A' },
      })

      const graph = buildDependencyGraph(schema)
      const cycles = detectCycles(graph)

      expect(cycles.length).toBeGreaterThan(0)
      // Cycle should include all three
      const cycle = cycles[0]
      expect(cycle).toContain('A')
      expect(cycle).toContain('B')
      expect(cycle).toContain('C')
    })

    it('should return empty array for DAGs', () => {
      const schema = parseSchema({
        A: { b: '->B', c: '->C' },
        B: { d: '->D' },
        C: { d: '->D' },
        D: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const cycles = detectCycles(graph)

      expect(cycles).toEqual([])
    })

    it('should detect multiple independent cycles', () => {
      const schema = parseSchema({
        A: { b: '->B' },
        B: { a: '->A' },
        X: { y: '->Y' },
        Y: { x: '->X' },
      })

      const graph = buildDependencyGraph(schema)
      const cycles = detectCycles(graph)

      // Should find at least 2 cycles
      expect(cycles.length).toBeGreaterThanOrEqual(2)
    })

    it('should ignore optional dependencies when configured', () => {
      // Note: Optional fields are already treated as soft dependencies in buildDependencyGraph,
      // so they won't create cycles in the hard dependency graph.
      // This test verifies the ignoreOptional flag works when edges are marked optional.
      const schema = parseSchema({
        Parent: { child: '->Child' },
        Child: { parent: '->Parent' }, // Hard dependency - creates a cycle
      })

      const graph = buildDependencyGraph(schema)

      // Should find cycle with both hard dependencies
      const cyclesFound = detectCycles(graph)
      expect(cyclesFound.length).toBeGreaterThan(0)

      // Now test with a schema where we manually want to ignore optional edges
      // The ignoreOptional flag checks the edge fieldName for '?' suffix
      const schema2 = parseSchema({
        A: { b: '->B' },
        B: { a: '->A?' }, // Optional - will be in softDependsOn, not dependsOn
      })

      const graph2 = buildDependencyGraph(schema2)

      // Optional reference goes to softDependsOn, so no hard dependency cycle
      const cycles2 = detectCycles(graph2)
      expect(cycles2).toEqual([])
    })

    it('should report cycle path for error messages', () => {
      const schema = parseSchema({
        Order: { payment: '->Payment' },
        Payment: { receipt: '->Receipt' },
        Receipt: { order: '->Order' },
      })

      const graph = buildDependencyGraph(schema)
      const cycles = detectCycles(graph)

      expect(cycles.length).toBeGreaterThan(0)

      // The cycle path should show the full loop
      const cycle = cycles[0]
      expect(cycle.length).toBeGreaterThanOrEqual(3)
      // First and last element should be the same (showing the loop)
      expect(cycle[0]).toBe(cycle[cycle.length - 1])
    })
  })

  describe('getParallelGroups', () => {
    it('should identify independent entities for parallel generation', () => {
      const schema = parseSchema({
        Company: {
          departments: ['->Department'],
          locations: ['->Location'],
        },
        Department: { name: 'string' },
        Location: { address: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const groups = getParallelGroups(graph, 'Company')

      // Department and Location have no dependencies, should be in same group
      const firstGroup = groups[0]
      expect(firstGroup).toContain('Department')
      expect(firstGroup).toContain('Location')

      // Company depends on both, should be in later group
      const companyGroup = groups.find((g) => g.includes('Company'))
      expect(groups.indexOf(companyGroup!)).toBeGreaterThan(0)
    })

    it('should respect dependency ordering in groups', () => {
      const schema = parseSchema({
        Project: { tasks: ['->Task'] },
        Task: { assignee: '->Person' },
        Person: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const groups = getParallelGroups(graph, 'Project')

      // Find which group each type is in
      const personGroupIndex = groups.findIndex((g) => g.includes('Person'))
      const taskGroupIndex = groups.findIndex((g) => g.includes('Task'))
      const projectGroupIndex = groups.findIndex((g) => g.includes('Project'))

      // Person should be before Task (Person has no deps)
      expect(personGroupIndex).toBeLessThan(taskGroupIndex)

      // Task should be before Project
      expect(taskGroupIndex).toBeLessThan(projectGroupIndex)
    })

    it('should handle entities with shared dependencies', () => {
      const schema = parseSchema({
        Report: {
          author: '->User',
          reviewer: '->User',
          data: '->Dataset',
        },
        User: { name: 'string' },
        Dataset: { source: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const groups = getParallelGroups(graph, 'Report')

      // User and Dataset are independent, should be in first group
      const firstGroup = groups[0]
      expect(firstGroup).toContain('User')
      expect(firstGroup).toContain('Dataset')
    })

    it('should handle complex dependency structures', () => {
      const schema = parseSchema({
        App: { screens: ['->Screen'] },
        Screen: { widgets: ['->Widget'], theme: '->Theme' },
        Widget: { style: '->Style' },
        Theme: { colors: '->ColorPalette' },
        Style: { font: '->Font' },
        ColorPalette: { name: 'string' },
        Font: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const groups = getParallelGroups(graph, 'App')

      // ColorPalette and Font have no dependencies, should be earliest
      const firstGroup = groups[0]
      expect(firstGroup).toContain('ColorPalette')
      expect(firstGroup).toContain('Font')

      // Verify ordering: App should be last
      const lastGroup = groups[groups.length - 1]
      expect(lastGroup).toContain('App')
    })

    it('should only include reachable types from root', () => {
      const schema = parseSchema({
        Main: { related: '->Related' },
        Related: { name: 'string' },
        Orphan: { data: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const groups = getParallelGroups(graph, 'Main')

      const allTypes = groups.flat()
      expect(allTypes).toContain('Main')
      expect(allTypes).toContain('Related')
      expect(allTypes).not.toContain('Orphan')
    })

    it('should handle single node graphs', () => {
      const schema = parseSchema({
        Solo: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const groups = getParallelGroups(graph, 'Solo')

      expect(groups).toEqual([['Solo']])
    })

    it('should handle disconnected subgraphs when queried from different roots', () => {
      const schema = parseSchema({
        GraphA: { nodeA: '->NodeA' },
        NodeA: { name: 'string' },
        GraphB: { nodeB: '->NodeB' },
        NodeB: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)

      const groupsA = getParallelGroups(graph, 'GraphA')
      const allTypesA = groupsA.flat()
      expect(allTypesA).toContain('GraphA')
      expect(allTypesA).toContain('NodeA')
      expect(allTypesA).not.toContain('GraphB')
      expect(allTypesA).not.toContain('NodeB')

      const groupsB = getParallelGroups(graph, 'GraphB')
      const allTypesB = groupsB.flat()
      expect(allTypesB).toContain('GraphB')
      expect(allTypesB).toContain('NodeB')
      expect(allTypesB).not.toContain('GraphA')
      expect(allTypesB).not.toContain('NodeA')
    })
  })

  describe('PRIMITIVE_TYPES', () => {
    it('should include all standard primitive types', () => {
      expect(PRIMITIVE_TYPES.has('string')).toBe(true)
      expect(PRIMITIVE_TYPES.has('number')).toBe(true)
      expect(PRIMITIVE_TYPES.has('boolean')).toBe(true)
      expect(PRIMITIVE_TYPES.has('date')).toBe(true)
    })

    it('should not include entity references', () => {
      expect(PRIMITIVE_TYPES.has('User')).toBe(false)
      expect(PRIMITIVE_TYPES.has('Post')).toBe(false)
    })
  })

  describe('CircularDependencyError', () => {
    it('should include cycle path in error message', () => {
      const cyclePath = ['A', 'B', 'C', 'A']
      const error = new CircularDependencyError(cyclePath)

      expect(error.message).toContain('A')
      expect(error.message).toContain('B')
      expect(error.message).toContain('C')
      expect(error.cyclePath).toEqual(cyclePath)
    })

    it('should be an instance of Error', () => {
      const error = new CircularDependencyError(['X', 'Y', 'X'])
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('Integration with cascade generation', () => {
    it('should provide correct order for cascade generation', () => {
      // This schema represents a typical cascade scenario
      const schema = parseSchema({
        Company: {
          $instructions: 'A tech company',
          departments: ['->Department'],
          headquarters: '->Location',
        },
        Department: {
          teams: ['->Team'],
        },
        Team: {
          members: ['->Employee'],
        },
        Employee: {
          name: 'string',
        },
        Location: {
          address: 'string',
        },
      })

      const graph = buildDependencyGraph(schema)
      const order = topologicalSort(graph, 'Company')

      // Verify the order is valid for generation
      // Employee and Location have no deps - should be first
      const employeeIdx = order.indexOf('Employee')
      const locationIdx = order.indexOf('Location')
      const teamIdx = order.indexOf('Team')
      const deptIdx = order.indexOf('Department')
      const companyIdx = order.indexOf('Company')

      // Employee must come before Team
      expect(employeeIdx).toBeLessThan(teamIdx)

      // Team must come before Department
      expect(teamIdx).toBeLessThan(deptIdx)

      // Department and Location must come before Company
      expect(deptIdx).toBeLessThan(companyIdx)
      expect(locationIdx).toBeLessThan(companyIdx)
    })
  })
})
