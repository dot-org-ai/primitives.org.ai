/**
 * Dependency Graph - builds and manages type dependencies for cascade generation
 *
 * This module provides:
 * - Graph construction from parsed schema relationships
 * - Topological sorting for correct generation order
 * - Cycle detection with clear error messages
 * - Parallel group identification for concurrent generation
 *
 * @packageDocumentation
 */

import type { ParsedGraph, ParsedEntity, RelationshipOperator } from './types.js'

// =============================================================================
// Types
// =============================================================================

/**
 * A node in the schema dependency graph representing an entity type
 */
export interface DependencyNode {
  /** Type name */
  name: string
  /** Types this node depends on (hard dependencies from -> and <-) */
  dependsOn: string[]
  /** Types that depend on this node */
  dependedOnBy: string[]
  /** Types this node softly depends on (from ~> and <~ fuzzy operators) */
  softDependsOn: string[]
}

/**
 * An edge in the dependency graph representing a relationship
 */
export interface DependencyEdge {
  /** Source type */
  from: string
  /** Target type */
  to: string
  /** Whether this is an array relationship */
  isArray: boolean
  /** The operator used: ->, ~>, <-, <~ */
  operator: RelationshipOperator
  /** Field name (may include ? suffix for optional fields) */
  fieldName: string
}

/**
 * The complete dependency graph structure
 */
export interface DependencyGraph {
  /** Map of type name to node */
  nodes: Record<string, DependencyNode>
  /** All edges in the graph */
  edges: DependencyEdge[]
}

// =============================================================================
// Constants
// =============================================================================

/**
 * Primitive types that don't create dependencies
 *
 * These types are leaf values and do not reference other entity types.
 * Includes precision numeric types (int, float, double, decimal) for
 * compatibility with IceType schemas.
 *
 * @remarks
 * When checking if a field type is a primitive, use `PRIMITIVE_TYPES.has(type)`.
 * Non-primitive types (PascalCase names) are treated as entity references.
 */
export const PRIMITIVE_TYPES = new Set([
  // Text types
  'string',
  'text',
  'markdown',
  'url',
  'email',
  // Numeric types
  'number',
  'int',
  'long',
  'bigint',
  'float',
  'double',
  'decimal',
  // Boolean
  'boolean',
  // Date/time types
  'date',
  'datetime',
  'timestamp',
  'timestamptz',
  'time',
  // Identifier types
  'uuid',
  // Binary types
  'binary',
  // Structured types
  'json',
  'object',
  'array',
])

// =============================================================================
// Errors
// =============================================================================

/**
 * Error thrown when a circular dependency is detected
 */
export class CircularDependencyError extends Error {
  /** The path of types that form the cycle */
  public readonly cyclePath: string[]

  constructor(cyclePath: string[]) {
    const cycleStr = cyclePath.join(' -> ')
    super(`Circular dependency detected: ${cycleStr}`)
    this.name = 'CircularDependencyError'
    this.cyclePath = cyclePath
  }
}

// =============================================================================
// Graph Construction
// =============================================================================

/**
 * Build a dependency graph from a parsed graph schema
 *
 * @param schema - The parsed graph from Graph()
 * @returns The dependency graph with nodes and edges
 */
export function buildDependencyGraph(schema: ParsedGraph): DependencyGraph {
  const nodes: Record<string, DependencyNode> = {}
  const edges: DependencyEdge[] = []

  // Initialize nodes for all entity types
  for (const [typeName] of schema.entities) {
    nodes[typeName] = {
      name: typeName,
      dependsOn: [],
      dependedOnBy: [],
      softDependsOn: [],
    }
  }

  // Process fields to build edges
  for (const [typeName, entity] of schema.entities) {
    for (const [fieldName, field] of entity.fields) {
      // Skip non-relation fields
      if (!field.isRelation || !field.relatedType) continue

      // Skip primitive types
      if (PRIMITIVE_TYPES.has(field.relatedType)) continue

      const target = field.relatedType
      const operator = field.operator ?? '->'
      const isArray = field.isArray
      const isSoft = operator === '~>' || operator === '<~'
      const isBackward = operator === '<-' || operator === '<~'
      const isOptionalField = field.isOptional

      // Add edge (mark optional in fieldName for cycle detection)
      edges.push({
        from: typeName,
        to: target,
        isArray,
        operator,
        fieldName: isOptionalField ? `${fieldName}?` : fieldName,
      })

      // Ensure target node exists (might be external/not in schema)
      if (!nodes[target]) {
        nodes[target] = {
          name: target,
          dependsOn: [],
          dependedOnBy: [],
          softDependsOn: [],
        }
      }

      // Determine dependency type based on operator
      // sourceNode is guaranteed to exist from the first loop
      // targetNode is guaranteed to exist from the check above
      const sourceNode = nodes[typeName]
      const targetNode = nodes[target]
      if (!sourceNode || !targetNode) continue

      if (isSoft || isOptionalField) {
        // Soft dependency (fuzzy search) or optional field
        if (!sourceNode.softDependsOn.includes(target)) {
          sourceNode.softDependsOn.push(target)
        }
      } else if (!isBackward) {
        // Hard dependency for forward exact references (->)
        // Backward references (<-) don't create generation dependencies
        // because the parent creates the child, not vice versa
        if (!sourceNode.dependsOn.includes(target)) {
          sourceNode.dependsOn.push(target)
        }
        if (!targetNode.dependedOnBy.includes(typeName)) {
          targetNode.dependedOnBy.push(typeName)
        }
      }
    }
  }

  return { nodes, edges }
}

// =============================================================================
// Topological Sort
// =============================================================================

/**
 * Compute topological order for generating types
 *
 * Returns types in order such that dependencies come before dependents.
 * This is essential for cascade generation - we need to create referenced
 * entities before the entities that reference them.
 *
 * @param graph - The dependency graph
 * @param rootType - The root type to start from
 * @param ignoreOptional - If true, optional dependencies don't contribute to ordering
 * @returns Array of type names in generation order (dependencies first, root last)
 * @throws CircularDependencyError if a cycle is detected
 */
export function topologicalSort(
  graph: DependencyGraph,
  rootType: string,
  ignoreOptional = false
): string[] {
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const result: string[] = []

  function visit(typeName: string, path: string[]): void {
    if (visited.has(typeName)) return

    if (visiting.has(typeName)) {
      // Circular dependency detected
      const cycleStart = path.indexOf(typeName)
      const cyclePath = [...path.slice(cycleStart), typeName]
      throw new CircularDependencyError(cyclePath)
    }

    visiting.add(typeName)

    const node = graph.nodes[typeName]
    if (node) {
      for (const dep of node.dependsOn) {
        // Check if this dependency is optional and should be ignored
        if (ignoreOptional) {
          const edge = graph.edges.find((e) => e.from === typeName && e.to === dep)
          if (edge && graph.nodes[dep]) {
            // Check if field has optional marker
            const fieldIsOptional = edge.fieldName.endsWith('?')
            if (fieldIsOptional) continue
          }
        }
        visit(dep, [...path, typeName])
      }
    }

    visiting.delete(typeName)
    visited.add(typeName)
    result.push(typeName)
  }

  visit(rootType, [])

  return result
}

// =============================================================================
// Cycle Detection
// =============================================================================

/**
 * Options for cycle detection
 */
export interface DetectCyclesOptions {
  /** If true, optional dependencies are ignored when detecting cycles */
  ignoreOptional?: boolean
}

/**
 * Detect all cycles in the dependency graph
 *
 * @param graph - The dependency graph to check
 * @param options - Detection options
 * @returns Array of cycles, where each cycle is an array of type names
 *          The first and last element of each cycle are the same (showing the loop)
 */
export function detectCycles(
  graph: DependencyGraph,
  options: DetectCyclesOptions = {}
): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const recStack = new Set<string>()

  function dfs(node: string, path: string[]): void {
    if (recStack.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node)
      const cycle = [...path.slice(cycleStart), node]
      cycles.push(cycle)
      return
    }

    if (visited.has(node)) return

    visited.add(node)
    recStack.add(node)

    const nodeInfo = graph.nodes[node]
    if (nodeInfo) {
      for (const dep of nodeInfo.dependsOn) {
        // Skip optional dependencies if configured
        if (options.ignoreOptional) {
          const edge = graph.edges.find((e) => e.from === node && e.to === dep)
          if (edge) {
            // Check if fieldName ends with ?
            if (edge.fieldName.endsWith('?')) continue
          }
        }
        dfs(dep, [...path, node])
      }
    }

    recStack.delete(node)
  }

  for (const node of Object.keys(graph.nodes)) {
    dfs(node, [])
  }

  return cycles
}

// =============================================================================
// Parallel Groups
// =============================================================================

/**
 * Get parallel generation groups - types that can be generated concurrently
 *
 * Returns an array of arrays, where each inner array contains types that
 * can be generated in parallel (they have no dependencies on each other).
 * Groups are ordered so that earlier groups must complete before later ones.
 *
 * @param graph - The dependency graph
 * @param rootType - The root type to start from
 * @returns Array of parallel groups, in execution order
 */
export function getParallelGroups(graph: DependencyGraph, rootType: string): string[][] {
  const inDegree: Record<string, number> = {}
  const relevantNodes = new Set<string>()

  // First, find all nodes reachable from root
  function findReachable(node: string): void {
    if (relevantNodes.has(node)) return
    relevantNodes.add(node)
    const nodeInfo = graph.nodes[node]
    if (nodeInfo) {
      for (const dep of nodeInfo.dependsOn) {
        findReachable(dep)
      }
    }
  }
  findReachable(rootType)

  // Initialize in-degrees for relevant nodes only
  for (const node of relevantNodes) {
    inDegree[node] = 0
  }

  // Count incoming edges (dependencies)
  for (const node of relevantNodes) {
    const nodeInfo = graph.nodes[node]
    if (nodeInfo) {
      for (const dep of nodeInfo.dependsOn) {
        if (relevantNodes.has(dep)) {
          const currentDegree = inDegree[node] ?? 0
          inDegree[node] = currentDegree + 1
        }
      }
    }
  }

  const groups: string[][] = []

  while (Object.keys(inDegree).length > 0) {
    // Find all nodes with in-degree 0 (no remaining dependencies)
    const group = Object.entries(inDegree)
      .filter(([, degree]) => degree === 0)
      .map(([node]) => node)

    if (group.length === 0) {
      // Remaining nodes have cycles - break to avoid infinite loop
      break
    }

    groups.push(group)

    // Remove processed nodes and update in-degrees
    for (const node of group) {
      delete inDegree[node]
      // Reduce in-degree of nodes that depend on this node
      for (const dependent of graph.nodes[node]?.dependedOnBy ?? []) {
        if (dependent in inDegree) {
          const currentDegree = inDegree[dependent] ?? 0
          inDegree[dependent] = currentDegree - 1
        }
      }
    }
  }

  return groups
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get all dependencies for a specific type (including transitive)
 *
 * @param graph - The dependency graph
 * @param typeName - The type to get dependencies for
 * @returns Set of all type names this type depends on
 */
export function getAllDependencies(graph: DependencyGraph, typeName: string): Set<string> {
  const deps = new Set<string>()

  function collect(node: string): void {
    const nodeInfo = graph.nodes[node]
    if (!nodeInfo) return

    for (const dep of nodeInfo.dependsOn) {
      if (!deps.has(dep)) {
        deps.add(dep)
        collect(dep)
      }
    }
  }

  collect(typeName)
  return deps
}

/**
 * Check if the graph has any cycles
 *
 * @param graph - The dependency graph
 * @returns true if cycles exist, false otherwise
 */
export function hasCycles(graph: DependencyGraph): boolean {
  return detectCycles(graph).length > 0
}

/**
 * Get a human-readable visualization of the dependency graph
 *
 * @param graph - The dependency graph
 * @returns Multi-line string showing the graph structure
 */
export function visualizeGraph(graph: DependencyGraph): string {
  const lines: string[] = ['Dependency Graph:', '']

  for (const [name, node] of Object.entries(graph.nodes)) {
    lines.push(`${name}:`)
    if (node.dependsOn.length > 0) {
      lines.push(`  -> ${node.dependsOn.join(', ')} (hard deps)`)
    }
    if (node.softDependsOn.length > 0) {
      lines.push(`  ~> ${node.softDependsOn.join(', ')} (soft deps)`)
    }
    if (node.dependedOnBy.length > 0) {
      lines.push(`  <- ${node.dependedOnBy.join(', ')} (depended on by)`)
    }
    if (node.dependsOn.length === 0 && node.softDependsOn.length === 0) {
      lines.push(`  (no dependencies)`)
    }
    lines.push('')
  }

  return lines.join('\n')
}
