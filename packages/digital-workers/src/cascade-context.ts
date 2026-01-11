/**
 * Type-safe cascade context schema for agent coordination
 *
 * Provides structured data flow and coordination between agents in multi-agent
 * workflows. Enables type-safe context propagation, validation, enrichment,
 * and serialization for distributed agent systems.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

// ============================================================================
// Agent Tier Schema and Type
// ============================================================================

/**
 * Agent tier levels for cascade hierarchies
 *
 * - coordinator: Orchestrates multiple agents, highest level
 * - supervisor: Manages worker agents, handles escalation
 * - worker: Executes standard tasks
 * - specialist: Handles domain-specific tasks
 * - executor: Low-level task execution
 */
export const AgentTierSchema = z.enum([
  'coordinator',
  'supervisor',
  'worker',
  'specialist',
  'executor',
])

export type AgentTier = z.infer<typeof AgentTierSchema>

// ============================================================================
// Context Version Schema and Type
// ============================================================================

/**
 * Version tracking for context evolution and debugging
 */
export const ContextVersionSchema = z.object({
  major: z.number().int().nonnegative(),
  minor: z.number().int().nonnegative(),
  patch: z.number().int().nonnegative(),
  timestamp: z.date(),
  hash: z.string().optional(),
})

export type ContextVersion = z.infer<typeof ContextVersionSchema>

// ============================================================================
// Agent Reference Schema
// ============================================================================

/**
 * Reference to an agent with tier information
 */
export const AgentRefSchema = z.object({
  id: z.string().min(1),
  tier: AgentTierSchema,
  name: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
})

export type AgentRef = z.infer<typeof AgentRefSchema>

// ============================================================================
// Task Priority Schema
// ============================================================================

export const TaskPrioritySchema = z.enum(['critical', 'high', 'normal', 'low'])
export type TaskPriority = z.infer<typeof TaskPrioritySchema>

// ============================================================================
// Task Schema
// ============================================================================

export const TaskInfoSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  priority: TaskPrioritySchema,
  description: z.string(),
  deadline: z.date().optional(),
  parentTaskId: z.string().optional(),
})

export type TaskInfo = z.infer<typeof TaskInfoSchema>

// ============================================================================
// Execution Phase Schema
// ============================================================================

export const ExecutionPhaseSchema = z.enum([
  'planning',
  'execution',
  'validation',
  'escalation',
  'completed',
  'failed',
])

export type ExecutionPhase = z.infer<typeof ExecutionPhaseSchema>

// ============================================================================
// Execution State Schema
// ============================================================================

export const ExecutionStateSchema = z.object({
  phase: ExecutionPhaseSchema,
  startedAt: z.date(),
  completedAt: z.date().optional(),
  attempts: z.number().int().nonnegative(),
  lastError: z.string().optional(),
  escalatedFrom: z.string().optional(),
})

export type ExecutionState = z.infer<typeof ExecutionStateSchema>

// ============================================================================
// Trace Entry Schema
// ============================================================================

export const TraceEntrySchema = z.object({
  agentId: z.string(),
  tier: AgentTierSchema,
  timestamp: z.date(),
  action: z.string(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  duration: z.number().optional(),
  error: z.string().optional(),
})

export type TraceEntry = z.infer<typeof TraceEntrySchema>

// ============================================================================
// AgentCascadeContext Schema
// ============================================================================

/**
 * Main cascade context schema for agent coordination
 *
 * Contains all information needed for agents to coordinate in a cascade:
 * - Identity: Context ID and version
 * - Agents: Origin and current agent references
 * - Task: Task information and priority
 * - State: Current execution state
 * - Data: Task-specific payload
 * - Trace: Execution history for debugging
 * - Metadata: Extension point for custom data
 */
export const AgentCascadeContextSchema = z.object({
  id: z.string().min(1),
  version: ContextVersionSchema,
  originAgent: AgentRefSchema,
  currentAgent: AgentRefSchema,
  task: TaskInfoSchema,
  state: ExecutionStateSchema,
  data: z.record(z.unknown()).optional(),
  trace: z.array(TraceEntrySchema),
  metadata: z.record(z.unknown()).optional(),
})

export type AgentCascadeContext = z.infer<typeof AgentCascadeContextSchema>

// ============================================================================
// Context Enrichment Type
// ============================================================================

/**
 * Data added by an agent during context propagation
 */
export interface ContextEnrichment {
  agentId: string
  tier: AgentTier
  timestamp: Date
  data: Record<string, unknown>
  action?: string
}

// ============================================================================
// Validation Result Type
// ============================================================================

/**
 * Result of context validation
 */
export interface ValidationResult {
  success: boolean
  data?: AgentCascadeContext
  errors?: Array<{
    path: (string | number)[]
    message: string
    code: string
  }>
}

// ============================================================================
// Context Diff Types
// ============================================================================

export interface ContextChange {
  path: (string | number)[]
  oldValue: unknown
  newValue: unknown
  type: 'added' | 'removed' | 'modified'
}

export interface ContextDiff {
  changes: ContextChange[]
  fromVersion: ContextVersion
  toVersion: ContextVersion
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a cascade context against the schema
 *
 * @param context - The context to validate
 * @returns Validation result with success flag and errors if any
 *
 * @example
 * ```ts
 * const result = validateContext(context)
 * if (!result.success) {
 *   console.error('Invalid context:', result.errors)
 * }
 * ```
 */
export function validateContext(context: unknown): ValidationResult {
  const result = AgentCascadeContextSchema.safeParse(context)

  if (result.success) {
    return { success: true, data: result.data }
  }

  return {
    success: false,
    errors: result.error.issues.map(issue => ({
      path: issue.path,
      message: issue.message,
      code: issue.code,
    })),
  }
}

// ============================================================================
// Context Version Functions
// ============================================================================

/**
 * Create a new context version
 *
 * @param options - Optional version numbers
 * @returns A new ContextVersion
 */
export function createContextVersion(
  options?: Partial<Pick<ContextVersion, 'major' | 'minor' | 'patch'>>
): ContextVersion {
  return {
    major: options?.major ?? 1,
    minor: options?.minor ?? 0,
    patch: options?.patch ?? 0,
    timestamp: new Date(),
  }
}

/**
 * Increment version patch number
 */
function incrementPatch(version: ContextVersion): ContextVersion {
  return {
    ...version,
    patch: version.patch + 1,
    timestamp: new Date(),
  }
}

// ============================================================================
// Context Factory Functions
// ============================================================================

/**
 * Generate a unique context ID
 */
function generateContextId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `ctx_${timestamp}_${random}`
}

/**
 * Create a new cascade context
 *
 * @param options - Context creation options
 * @returns A new AgentCascadeContext
 *
 * @example
 * ```ts
 * const context = createCascadeContext({
 *   originAgent: { id: 'coordinator', tier: 'coordinator', name: 'Main' },
 *   task: { id: 'task_1', type: 'analysis', priority: 'normal', description: 'Analyze data' },
 * })
 * ```
 */
export function createCascadeContext(options: {
  originAgent: AgentRef
  task: TaskInfo
  data?: Record<string, unknown>
  metadata?: Record<string, unknown>
}): AgentCascadeContext {
  return {
    id: generateContextId(),
    version: createContextVersion(),
    originAgent: options.originAgent,
    currentAgent: { ...options.originAgent },
    task: options.task,
    state: {
      phase: 'planning',
      startedAt: new Date(),
      attempts: 0,
    },
    data: options.data,
    trace: [],
    metadata: options.metadata,
  }
}

// ============================================================================
// Context Enrichment Functions
// ============================================================================

/**
 * Enrich a context with data from an agent
 *
 * Creates a new context with:
 * - Merged data from the enrichment
 * - Updated currentAgent to the enriching agent
 * - Incremented version patch
 * - Added trace entry
 *
 * @param context - The original context
 * @param enrichment - The enrichment data
 * @returns A new enriched context (original is unchanged)
 *
 * @example
 * ```ts
 * const enriched = enrichContext(context, {
 *   agentId: 'worker_1',
 *   tier: 'worker',
 *   timestamp: new Date(),
 *   data: { analysisResult: 'approved' },
 * })
 * ```
 */
export function enrichContext(
  context: AgentCascadeContext,
  enrichment: ContextEnrichment
): AgentCascadeContext {
  // Create trace entry
  const traceEntry: TraceEntry = {
    agentId: enrichment.agentId,
    tier: enrichment.tier,
    timestamp: enrichment.timestamp,
    action: enrichment.action ?? 'enrich',
  }

  // Merge data deeply
  const mergedData = deepMerge(context.data ?? {}, enrichment.data)

  return {
    ...context,
    version: incrementPatch(context.version),
    currentAgent: {
      id: enrichment.agentId,
      tier: enrichment.tier,
      name: context.currentAgent.name,
    },
    data: mergedData,
    trace: [...context.trace, traceEntry],
  }
}

// ============================================================================
// Serialization Functions
// ============================================================================

/**
 * Custom replacer for JSON.stringify that handles Date objects
 */
function dateReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return value
}

/**
 * Serialize a cascade context to JSON string
 *
 * Handles Date objects by converting them to ISO strings.
 *
 * @param context - The context to serialize
 * @returns JSON string representation
 */
export function serializeContext(context: AgentCascadeContext): string {
  return JSON.stringify(context, dateReplacer)
}

/**
 * Deserialize a JSON string to a cascade context
 *
 * Validates the deserialized data and restores Date objects.
 *
 * @param json - JSON string to deserialize
 * @returns The deserialized and validated context
 * @throws Error if JSON is invalid or context validation fails
 */
export function deserializeContext(json: string): AgentCascadeContext {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON string')
  }

  // Restore Date objects
  if (typeof parsed === 'object' && parsed !== null) {
    restoreDates(parsed as Record<string, unknown>)
  }

  // Validate the parsed context
  const result = validateContext(parsed)
  if (!result.success) {
    throw new Error(
      `Invalid context structure: ${result.errors?.map(e => e.message).join(', ')}`
    )
  }

  return result.data!
}

/**
 * Recursively restore ISO date strings to Date objects
 */
function restoreDates(obj: Record<string, unknown>): void {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/

  for (const key of Object.keys(obj)) {
    const value = obj[key]
    if (typeof value === 'string' && isoDateRegex.test(value)) {
      obj[key] = new Date(value)
    } else if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            restoreDates(item as Record<string, unknown>)
          }
        }
      } else {
        restoreDates(value as Record<string, unknown>)
      }
    }
  }
}

// ============================================================================
// Context Merge/Diff Functions
// ============================================================================

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>
): T {
  const result: Record<string, unknown> = { ...target }

  for (const key of Object.keys(source)) {
    const sourceValue = source[key]
    const targetValue = result[key]

    if (
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      )
    } else {
      result[key] = sourceValue
    }
  }

  return result as T
}

/**
 * Merge two cascade contexts
 *
 * Combines contexts preferring the newer version:
 * - Takes version, state from the newer context
 * - Deep merges data objects
 * - Concatenates trace arrays
 * - Merges metadata
 *
 * @param ctx1 - First context
 * @param ctx2 - Second context
 * @returns Merged context
 */
export function mergeContexts(
  ctx1: AgentCascadeContext,
  ctx2: AgentCascadeContext
): AgentCascadeContext {
  // Determine which is newer based on version
  const ctx1Version = ctx1.version.major * 10000 + ctx1.version.minor * 100 + ctx1.version.patch
  const ctx2Version = ctx2.version.major * 10000 + ctx2.version.minor * 100 + ctx2.version.patch
  const [older, newer] = ctx1Version <= ctx2Version ? [ctx1, ctx2] : [ctx2, ctx1]

  // Merge data deeply
  const mergedData = deepMerge(older.data ?? {}, newer.data ?? {})

  // Combine traces (deduplicate by timestamp + agentId)
  const seenTraces = new Set<string>()
  const combinedTrace: TraceEntry[] = []
  for (const entry of [...older.trace, ...newer.trace]) {
    const key = `${entry.agentId}-${entry.timestamp.getTime()}`
    if (!seenTraces.has(key)) {
      seenTraces.add(key)
      combinedTrace.push(entry)
    }
  }

  // Merge metadata
  const mergedMetadata = deepMerge(older.metadata ?? {}, newer.metadata ?? {})

  return {
    ...newer,
    data: mergedData,
    trace: combinedTrace,
    metadata: mergedMetadata,
  }
}

/**
 * Compare two contexts and return the differences
 *
 * @param ctx1 - Original context
 * @param ctx2 - Modified context
 * @returns Diff object with list of changes
 */
export function diffContexts(
  ctx1: AgentCascadeContext,
  ctx2: AgentCascadeContext
): ContextDiff {
  const changes: ContextChange[] = []

  // Helper to compare values recursively
  function compareValues(
    path: (string | number)[],
    val1: unknown,
    val2: unknown
  ): void {
    // Handle undefined/null
    if (val1 === undefined && val2 !== undefined) {
      changes.push({ path, oldValue: val1, newValue: val2, type: 'added' })
      return
    }
    if (val1 !== undefined && val2 === undefined) {
      changes.push({ path, oldValue: val1, newValue: val2, type: 'removed' })
      return
    }

    // Handle Date objects
    if (val1 instanceof Date && val2 instanceof Date) {
      if (val1.getTime() !== val2.getTime()) {
        changes.push({ path, oldValue: val1, newValue: val2, type: 'modified' })
      }
      return
    }

    // Handle primitives
    if (typeof val1 !== 'object' || typeof val2 !== 'object') {
      if (val1 !== val2) {
        changes.push({ path, oldValue: val1, newValue: val2, type: 'modified' })
      }
      return
    }

    // Handle null
    if (val1 === null || val2 === null) {
      if (val1 !== val2) {
        changes.push({ path, oldValue: val1, newValue: val2, type: 'modified' })
      }
      return
    }

    // Handle arrays
    if (Array.isArray(val1) && Array.isArray(val2)) {
      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        changes.push({ path, oldValue: val1, newValue: val2, type: 'modified' })
      }
      return
    }

    // Handle objects
    const obj1 = val1 as Record<string, unknown>
    const obj2 = val2 as Record<string, unknown>
    const allKeys = Array.from(new Set([...Object.keys(obj1), ...Object.keys(obj2)]))

    for (const key of allKeys) {
      compareValues([...path, key], obj1[key], obj2[key])
    }
  }

  // Compare top-level fields (excluding trace which is handled specially)
  const fieldsToCompare = [
    'id',
    'version',
    'originAgent',
    'currentAgent',
    'task',
    'state',
    'data',
    'metadata',
  ] as const

  for (const field of fieldsToCompare) {
    compareValues([field], ctx1[field], ctx2[field])
  }

  return {
    changes,
    fromVersion: ctx1.version,
    toVersion: ctx2.version,
  }
}
