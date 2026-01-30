/**
 * Tests for Schema Dependency Graph Adapter
 *
 * This file tests ai-database's dependency graph adapter which wraps @graphdl/core.
 * Core functionality (buildDependencyGraph, topologicalSort, detectCycles, etc.) is
 * thoroughly tested in packages/graphdl/test/dependency-graph.test.ts.
 *
 * These tests focus on:
 * 1. Adapter functionality - ParsedSchema to ParsedGraph conversion
 * 2. Type alias exports (SchemaDepNode, SchemaDepEdge, SchemaDepGraph)
 * 3. Integration with ai-database's parseSchema() function
 * 4. Complex scenarios specific to ai-database usage patterns
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

describe('Dependency Graph Adapter', () => {
  // =============================================================================
  // Adapter Tests: Verify ParsedSchema -> ParsedGraph conversion works correctly
  // =============================================================================

  describe('ParsedSchema to ParsedGraph conversion', () => {
    it('should build graph from parseSchema() output', () => {
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

    it('should handle parseSchema() with $instructions field', () => {
      const schema = parseSchema({
        Company: {
          $instructions: 'A tech company',
          departments: ['->Department'],
        },
        Department: {
          name: 'string',
        },
      })

      const graph = buildDependencyGraph(schema)

      expect(graph.nodes['Company']).toBeDefined()
      expect(graph.nodes['Company'].dependsOn).toContain('Department')
    })

    it('should handle schema with all relationship operators', () => {
      const schema = parseSchema({
        Main: {
          exact: '->ExactTarget',
          fuzzy: '~>FuzzyTarget',
          backExact: '<-BackTarget',
          backFuzzy: '<~BackFuzzyTarget',
        },
        ExactTarget: { name: 'string' },
        FuzzyTarget: { name: 'string' },
        BackTarget: { name: 'string' },
        BackFuzzyTarget: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)

      // Forward exact -> hard dependency
      expect(graph.nodes['Main'].dependsOn).toContain('ExactTarget')
      // Forward fuzzy -> soft dependency
      expect(graph.nodes['Main'].softDependsOn).toContain('FuzzyTarget')
      // Backward refs don't create forward dependencies
      expect(graph.nodes['Main'].dependsOn).not.toContain('BackTarget')
    })
  })

  // =============================================================================
  // Type Alias Tests: Verify exported types work correctly
  // =============================================================================

  describe('Type aliases', () => {
    it('should export SchemaDepGraph type that works with buildDependencyGraph', () => {
      const schema = parseSchema({
        User: { name: 'string' },
      })

      const graph: SchemaDepGraph = buildDependencyGraph(schema)

      expect(graph.nodes).toBeDefined()
      expect(graph.edges).toBeDefined()
    })

    it('should export SchemaDepNode type for node access', () => {
      const schema = parseSchema({
        User: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const node: SchemaDepNode = graph.nodes['User']

      expect(node.dependsOn).toBeDefined()
      expect(node.dependedOnBy).toBeDefined()
      expect(node.softDependsOn).toBeDefined()
    })

    it('should export SchemaDepEdge type for edge access', () => {
      const schema = parseSchema({
        Post: { author: '->User' },
        User: { name: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const edge: SchemaDepEdge = graph.edges[0]

      expect(edge.from).toBeDefined()
      expect(edge.to).toBeDefined()
      expect(edge.operator).toBeDefined()
    })
  })

  // =============================================================================
  // Integration Tests: Complex scenarios used by ai-database
  // =============================================================================

  describe('Integration with cascade generation', () => {
    it('should provide correct order for typical cascade scenario', () => {
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

      // Verify correct generation order
      const employeeIdx = order.indexOf('Employee')
      const teamIdx = order.indexOf('Team')
      const deptIdx = order.indexOf('Department')
      const locationIdx = order.indexOf('Location')
      const companyIdx = order.indexOf('Company')

      expect(employeeIdx).toBeLessThan(teamIdx)
      expect(teamIdx).toBeLessThan(deptIdx)
      expect(deptIdx).toBeLessThan(companyIdx)
      expect(locationIdx).toBeLessThan(companyIdx)
    })

    it('should handle diamond dependency pattern', () => {
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

    it('should identify parallel generation opportunities', () => {
      const schema = parseSchema({
        Report: {
          author: '->User',
          data: '->Dataset',
        },
        User: { name: 'string' },
        Dataset: { source: 'string' },
      })

      const graph = buildDependencyGraph(schema)
      const groups = getParallelGroups(graph, 'Report')

      // User and Dataset are independent, should be in first group
      expect(groups[0]).toContain('User')
      expect(groups[0]).toContain('Dataset')
      // Report depends on both, should be in second group
      expect(groups[1]).toContain('Report')
    })
  })

  // =============================================================================
  // Cycle Detection Tests: Verify error handling works with adapter
  // =============================================================================

  describe('Cycle detection through adapter', () => {
    it('should throw CircularDependencyError for cycles', () => {
      const schema = parseSchema({
        A: { b: '->B' },
        B: { a: '->A' },
      })

      const graph = buildDependencyGraph(schema)

      expect(() => topologicalSort(graph, 'A')).toThrow(CircularDependencyError)
    })

    it('should detect cycles and report them', () => {
      const schema = parseSchema({
        Order: { payment: '->Payment' },
        Payment: { receipt: '->Receipt' },
        Receipt: { order: '->Order' },
      })

      const graph = buildDependencyGraph(schema)
      const cycles = detectCycles(graph)

      expect(cycles.length).toBeGreaterThan(0)
      const cycle = cycles[0]
      // First and last element should be the same (showing the loop)
      expect(cycle[0]).toBe(cycle[cycle.length - 1])
    })

    it('should handle optional self-references without throwing', () => {
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
  })

  // =============================================================================
  // Re-exported Constants Tests
  // =============================================================================

  describe('PRIMITIVE_TYPES constant', () => {
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

  // =============================================================================
  // CircularDependencyError Tests
  // =============================================================================

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
})
