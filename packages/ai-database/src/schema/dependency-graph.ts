/**
 * Dependency Graph - builds and manages type dependencies for cascade generation
 *
 * This module re-exports the dependency graph functionality from @graphdl/core
 * with type aliases for backward compatibility. The ai-database package uses
 * slightly different type names (SchemaDepNode, SchemaDepEdge, SchemaDepGraph)
 * compared to graphdl (DependencyNode, DependencyEdge, DependencyGraph).
 *
 * Additionally, ai-database's buildDependencyGraph takes a ParsedSchema while
 * graphdl's takes a ParsedGraph. This module provides an adapter function to
 * bridge this difference.
 *
 * @packageDocumentation
 */

import type { ParsedSchema } from '../types.js'
import type { DependencyNode, DependencyEdge, DependencyGraph, ParsedGraph } from '@graphdl/core'

import {
  buildDependencyGraph as buildDependencyGraphCore,
  topologicalSort,
  detectCycles,
  getParallelGroups,
  getAllDependencies,
  hasCycles,
  visualizeGraph,
  CircularDependencyError,
  PRIMITIVE_TYPES,
} from '@graphdl/core'

// =============================================================================
// Type Aliases for Backward Compatibility
// =============================================================================

/**
 * A node in the schema dependency graph representing an entity type
 * @alias DependencyNode from @graphdl/core
 */
export type SchemaDepNode = DependencyNode

/**
 * An edge in the dependency graph representing a relationship
 * @alias DependencyEdge from @graphdl/core
 */
export type SchemaDepEdge = DependencyEdge

/**
 * The complete dependency graph structure
 * @alias DependencyGraph from @graphdl/core
 */
export type SchemaDepGraph = DependencyGraph

// =============================================================================
// Re-exports from @graphdl/core
// =============================================================================

export {
  topologicalSort,
  detectCycles,
  getParallelGroups,
  getAllDependencies,
  hasCycles,
  visualizeGraph,
  CircularDependencyError,
  PRIMITIVE_TYPES,
}

export type { DetectCyclesOptions } from '@graphdl/core'

// =============================================================================
// Adapter Function
// =============================================================================

/**
 * Convert ParsedSchema to ParsedGraph for use with @graphdl/core functions
 *
 * The main difference is that ParsedGraph has an additional `typeUris` field.
 * For ai-database's ParsedSchema, we just add an empty typeUris map.
 */
function toGraphdlParsedGraph(schema: ParsedSchema): ParsedGraph {
  return {
    entities: schema.entities,
    typeUris: new Map(),
  }
}

/**
 * Build a dependency graph from a parsed schema
 *
 * This is a wrapper around @graphdl/core's buildDependencyGraph that
 * accepts ai-database's ParsedSchema type.
 *
 * @param schema - The parsed schema from parseSchema()
 * @returns The dependency graph with nodes and edges
 */
export function buildDependencyGraph(schema: ParsedSchema): SchemaDepGraph {
  return buildDependencyGraphCore(toGraphdlParsedGraph(schema))
}
