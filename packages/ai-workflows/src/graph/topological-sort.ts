/**
 * Topological Sort Implementation for Workflow Execution Ordering
 *
 * Provides multiple algorithms for topologically sorting workflow steps:
 * - Kahn's algorithm (BFS-based, good for detecting cycles)
 * - DFS-based algorithm (classic approach, provides cycle path)
 *
 * Features:
 * - Cycle detection with path reporting
 * - Parallel execution level grouping
 * - Stable, deterministic ordering
 * - Support for missing dependency handling
 */

/**
 * A node that can be topologically sorted
 */
export interface SortableNode {
  /** Unique identifier for the node */
  id: string
  /** IDs of nodes this node depends on */
  dependencies: string[]
}

/**
 * Execution level containing nodes that can run in parallel
 */
export interface ExecutionLevel {
  /** Level number (0 = no dependencies, 1 = depends on level 0, etc.) */
  level: number
  /** Node IDs that can run concurrently at this level */
  nodes: string[]
}

/**
 * Options for topological sort
 */
export interface TopologicalSortOptions {
  /** Throw CycleDetectedError instead of returning hasCycle: true (default: false) */
  throwOnCycle?: boolean
  /** Which algorithm to use (default: 'kahn') */
  algorithm?: 'kahn' | 'dfs'
  /** Throw on missing dependencies (default: false) */
  strict?: boolean
}

/**
 * Result of topological sort operation
 */
export interface TopologicalSortResult {
  /** Sorted node IDs in execution order */
  order: string[]
  /** Whether a cycle was detected */
  hasCycle: boolean
  /** Path of nodes forming the cycle (if detected) */
  cyclePath?: string[]
  /** Additional metadata from the algorithm */
  metadata?: {
    /** In-degrees for each node (Kahn's algorithm) */
    inDegrees?: Record<string, number>
  }
}

/**
 * Error thrown when a cycle is detected in the dependency graph
 */
export class CycleDetectedError extends Error {
  /** The path of nodes forming the cycle */
  cyclePath: string[]

  constructor(cyclePath: string[]) {
    const pathStr = cyclePath.join(' -> ')
    super(`Cycle detected in dependency graph: ${pathStr}`)
    this.name = 'CycleDetectedError'
    this.cyclePath = cyclePath
  }
}

/**
 * Error thrown when a dependency references a non-existent node
 */
export class MissingNodeError extends Error {
  /** The missing node ID */
  missingNode: string
  /** The node that references the missing node */
  referencedBy: string

  constructor(missingNode: string, referencedBy: string) {
    super(`Missing dependency '${missingNode}' referenced by '${referencedBy}'`)
    this.name = 'MissingNodeError'
    this.missingNode = missingNode
    this.referencedBy = referencedBy
  }
}

/**
 * Build adjacency list and compute in-degrees for Kahn's algorithm
 */
function buildGraph(
  nodes: SortableNode[],
  strict: boolean
): {
  adjacencyList: Map<string, string[]>
  inDegrees: Map<string, number>
  nodeSet: Set<string>
} {
  const nodeSet = new Set(nodes.map((n) => n.id))
  const adjacencyList = new Map<string, string[]>()
  const inDegrees = new Map<string, number>()

  // Initialize all nodes
  for (const node of nodes) {
    adjacencyList.set(node.id, [])
    inDegrees.set(node.id, 0)
  }

  // Build edges (dependency -> dependent)
  for (const node of nodes) {
    // Deduplicate dependencies
    const uniqueDeps = [...new Set(node.dependencies)]

    for (const dep of uniqueDeps) {
      if (!nodeSet.has(dep)) {
        if (strict) {
          throw new MissingNodeError(dep, node.id)
        }
        // Skip missing dependencies in non-strict mode
        continue
      }

      // Add edge from dependency to this node
      adjacencyList.get(dep)!.push(node.id)
      inDegrees.set(node.id, inDegrees.get(node.id)! + 1)
    }
  }

  return { adjacencyList, inDegrees, nodeSet }
}

/**
 * Topological sort using Kahn's algorithm (BFS-based)
 *
 * Algorithm:
 * 1. Calculate in-degree for each node
 * 2. Add all nodes with in-degree 0 to queue
 * 3. While queue not empty:
 *    - Remove node from queue, add to result
 *    - Decrease in-degree of all dependents
 *    - Add nodes with in-degree 0 to queue
 * 4. If result size < node count, cycle exists
 */
export function topologicalSortKahn(
  nodes: SortableNode[],
  options: TopologicalSortOptions = {}
): TopologicalSortResult {
  const { strict = false } = options

  if (nodes.length === 0) {
    return { order: [], hasCycle: false }
  }

  const { adjacencyList, inDegrees, nodeSet } = buildGraph(nodes, strict)

  const order: string[] = []
  const inDegreesCopy = new Map(inDegrees)

  // Start with nodes that have no dependencies (in-degree 0)
  // Sort alphabetically for determinism
  const queue: string[] = [...nodeSet].filter((id) => inDegreesCopy.get(id) === 0).sort()

  while (queue.length > 0) {
    // Sort queue for deterministic ordering
    queue.sort()
    const current = queue.shift()!
    order.push(current)

    // Decrease in-degree for all dependents
    for (const dependent of adjacencyList.get(current) || []) {
      const newDegree = inDegreesCopy.get(dependent)! - 1
      inDegreesCopy.set(dependent, newDegree)

      if (newDegree === 0) {
        queue.push(dependent)
      }
    }
  }

  // If we didn't process all nodes, there's a cycle
  const hasCycle = order.length < nodeSet.size

  // Convert in-degrees to record
  const inDegreesRecord: Record<string, number> = {}
  for (const [id, degree] of inDegrees) {
    inDegreesRecord[id] = degree
  }

  return {
    order,
    hasCycle,
    metadata: {
      inDegrees: inDegreesRecord,
    },
  }
}

/**
 * Topological sort using DFS-based algorithm
 *
 * Algorithm:
 * 1. For each unvisited node:
 *    - Mark as "in progress"
 *    - Recursively visit all dependencies
 *    - Mark as "visited" and add to result (in reverse)
 * 2. If we encounter a node "in progress", we found a cycle
 */
export function topologicalSortDFS(
  nodes: SortableNode[],
  options: TopologicalSortOptions = {}
): TopologicalSortResult {
  const { strict = false } = options

  if (nodes.length === 0) {
    return { order: [], hasCycle: false }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const nodeSet = new Set(nodes.map((n) => n.id))

  const visited = new Set<string>()
  const inProgress = new Set<string>()
  const order: string[] = []
  let cyclePath: string[] | undefined

  function dfs(nodeId: string, path: string[]): boolean {
    if (inProgress.has(nodeId)) {
      // Found a cycle - construct the cycle path
      const cycleStart = path.indexOf(nodeId)
      cyclePath = [...path.slice(cycleStart), nodeId]
      return true // Cycle detected
    }

    if (visited.has(nodeId)) {
      return false // Already processed
    }

    inProgress.add(nodeId)
    path.push(nodeId)

    const node = nodeMap.get(nodeId)
    if (node) {
      // Deduplicate and sort dependencies for determinism
      const uniqueDeps = [...new Set(node.dependencies)].sort()

      for (const dep of uniqueDeps) {
        if (!nodeSet.has(dep)) {
          if (strict) {
            throw new MissingNodeError(dep, nodeId)
          }
          continue // Skip missing deps in non-strict mode
        }

        if (dfs(dep, path)) {
          return true // Propagate cycle detection
        }
      }
    }

    path.pop()
    inProgress.delete(nodeId)
    visited.add(nodeId)
    order.push(nodeId)

    return false
  }

  // Process nodes in sorted order for determinism
  const sortedNodeIds = [...nodeSet].sort()

  for (const nodeId of sortedNodeIds) {
    if (!visited.has(nodeId)) {
      if (dfs(nodeId, [])) {
        break // Stop on first cycle
      }
    }
  }

  const hasCycle = cyclePath !== undefined

  return {
    order: hasCycle ? order : order, // DFS produces correct order
    hasCycle,
    ...(cyclePath !== undefined && { cyclePath }),
  }
}

/**
 * Main topological sort function with algorithm selection
 *
 * @param nodes - Array of nodes to sort
 * @param options - Sort options
 * @returns Sorted result with order and cycle information
 */
export function topologicalSort(
  nodes: SortableNode[],
  options: TopologicalSortOptions = {}
): TopologicalSortResult {
  const { algorithm = 'dfs', throwOnCycle = false } = options

  let result: TopologicalSortResult

  if (algorithm === 'kahn') {
    result = topologicalSortKahn(nodes, options)

    // Kahn's algorithm doesn't provide cycle path, so detect it separately
    if (result.hasCycle) {
      const dfsResult = topologicalSortDFS(nodes, options)
      if (dfsResult.cyclePath !== undefined) {
        result = { ...result, cyclePath: dfsResult.cyclePath }
      }
    }
  } else {
    result = topologicalSortDFS(nodes, options)
  }

  if (result.hasCycle && throwOnCycle) {
    throw new CycleDetectedError(result.cyclePath || ['unknown'])
  }

  return result
}

/**
 * Get execution levels for parallel execution
 *
 * Groups nodes by their execution level:
 * - Level 0: Nodes with no dependencies
 * - Level N: Nodes whose dependencies are all at level < N
 *
 * @param nodes - Array of nodes to analyze
 * @returns Array of execution levels, sorted by level number
 * @throws CycleDetectedError if a cycle is detected
 */
export function getExecutionLevels(nodes: SortableNode[]): ExecutionLevel[] {
  if (nodes.length === 0) {
    return []
  }

  // First, verify no cycles exist
  const sortResult = topologicalSort(nodes, { throwOnCycle: true })

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const nodeSet = new Set(nodes.map((n) => n.id))
  const levels = new Map<string, number>()

  // Calculate level for each node
  function calculateLevel(nodeId: string): number {
    if (levels.has(nodeId)) {
      return levels.get(nodeId)!
    }

    const node = nodeMap.get(nodeId)
    if (!node) {
      return 0
    }

    // Filter to only existing dependencies
    const validDeps = node.dependencies.filter((d) => nodeSet.has(d))

    if (validDeps.length === 0) {
      levels.set(nodeId, 0)
      return 0
    }

    let maxDepLevel = -1
    for (const dep of validDeps) {
      const depLevel = calculateLevel(dep)
      maxDepLevel = Math.max(maxDepLevel, depLevel)
    }

    const level = maxDepLevel + 1
    levels.set(nodeId, level)
    return level
  }

  // Calculate levels for all nodes
  for (const node of nodes) {
    calculateLevel(node.id)
  }

  // Group nodes by level
  const levelGroups = new Map<number, string[]>()
  for (const [nodeId, level] of levels) {
    if (!levelGroups.has(level)) {
      levelGroups.set(level, [])
    }
    levelGroups.get(level)!.push(nodeId)
  }

  // Convert to sorted array of ExecutionLevels
  const result: ExecutionLevel[] = []
  const sortedLevels = [...levelGroups.keys()].sort((a, b) => a - b)

  for (const level of sortedLevels) {
    result.push({
      level,
      // Sort nodes within level for determinism
      nodes: levelGroups.get(level)!.sort(),
    })
  }

  return result
}
