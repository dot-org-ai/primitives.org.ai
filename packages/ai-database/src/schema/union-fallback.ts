/**
 * Union Type Fallback Search
 *
 * Implements fallback search behavior for union types in backward fuzzy (<~) operators.
 * When searching `<~Type1|Type2|Type3`, searches types in order and falls back to
 * the next type if no match is found or threshold not met.
 *
 * Supports two search modes:
 * - `ordered`: Search types sequentially, stop on first match (default)
 * - `parallel`: Search all types concurrently, return best match
 *
 * @packageDocumentation
 */

/**
 * Match result from a union type search
 */
export interface UnionMatch {
  /** Unique identifier of the matched entity */
  $id: string
  /** Similarity score (0-1) */
  $score: number
  /** Type that was matched */
  $type: string
  /** Additional match data */
  [key: string]: unknown
}

/**
 * Error that occurred during search
 */
export interface SearchError {
  /** Type that failed to search */
  type: string
  /** Error message */
  message: string
  /** Original error */
  error?: Error
}

/**
 * Result of a union type search operation
 */
export interface UnionSearchResult {
  /** Matches found (empty array if no matches) */
  matches: UnionMatch[]
  /** Types that were searched */
  searchedTypes: string[]
  /** Order in which types were searched */
  searchOrder: string[]
  /** Whether fallback was triggered (searched more than first type) */
  fallbackTriggered: boolean
  /** Whether all types were exhausted without finding a match */
  allTypesExhausted: boolean
  /** The type that matched (first match in ordered mode, best in parallel) */
  matchedType?: string
  /** Overall confidence score (highest match score) */
  confidence?: number
  /** Matches that were below threshold (for debugging) */
  belowThresholdMatches?: UnionMatch[]
  /** Errors that occurred during search */
  errors?: SearchError[]
}

/**
 * Searcher function type for searching a single type
 */
export type UnionSearcher = (
  type: string,
  query: string,
  options?: { threshold?: number; limit?: number }
) => Promise<UnionMatch[]>

/**
 * Options for union type fallback search
 */
export interface FallbackSearchOptions {
  /**
   * Search mode:
   * - `ordered`: Search types sequentially, stop on first match above threshold
   * - `parallel`: Search all types concurrently, return best match(es)
   */
  mode: 'ordered' | 'parallel'

  /**
   * Global similarity threshold (0-1)
   * Matches below this threshold are ignored (unless includeBelowThreshold is true)
   */
  threshold?: number

  /**
   * Per-type thresholds
   * Overrides the global threshold for specific types
   */
  thresholds?: Record<string, number>

  /**
   * Searcher function to perform the actual search
   * Called with (type, query, options) for each type being searched
   */
  searcher: UnionSearcher

  /**
   * In parallel mode, return all matches sorted by score (default: false, return only best)
   */
  returnAll?: boolean

  /**
   * Include matches below threshold in result for debugging (stored in belowThresholdMatches)
   */
  includeBelowThreshold?: boolean

  /**
   * Error handling mode:
   * - `throw`: Throw on first error (default in ordered mode)
   * - `continue`: Continue searching remaining types on error
   */
  onError?: 'throw' | 'continue'

  /**
   * Maximum number of results to return per type
   */
  limit?: number
}

/**
 * Parse union type string into array of individual types
 *
 * Handles various formats:
 * - `Type1|Type2|Type3` - Standard pipe-separated union
 * - `Type1 | Type2 | Type3` - With spaces around pipes
 * - `Type1|Type2(0.8)|Type3` - With threshold syntax (stripped from result)
 *
 * @param typeSpec - The union type specification string
 * @returns Array of individual type names in declaration order
 *
 * @example
 * ```ts
 * parseUnionTypes('Document|Video|Expert')
 * // => ['Document', 'Video', 'Expert']
 *
 * parseUnionTypes('Type1 | Type2(0.8) | Type3')
 * // => ['Type1', 'Type2', 'Type3']
 *
 * parseUnionTypes('SingleType')
 * // => ['SingleType']
 * ```
 */
export function parseUnionTypes(typeSpec: string): string[] {
  if (!typeSpec || typeSpec.trim() === '') {
    return []
  }

  // Split by pipe and process each type
  const types = typeSpec.split('|').map((t) => {
    let type = t.trim()

    // Strip threshold syntax: Type(0.8) -> Type
    const thresholdMatch = type.match(/^([A-Za-z][A-Za-z0-9_]*)\s*\([^)]*\)$/)
    if (thresholdMatch) {
      type = thresholdMatch[1]!
    }

    return type
  })

  // Filter out empty strings (from cases like "Type1||Type2")
  return types.filter((t) => t.length > 0)
}

/**
 * Parse per-type thresholds from union type specification
 *
 * Extracts threshold values from syntax like `Type1|Type2(0.8)|Type3(0.6)`
 *
 * @param typeSpec - The union type specification string
 * @returns Record mapping type names to their thresholds
 *
 * @example
 * ```ts
 * parseUnionThresholds('Type1|Type2(0.8)|Type3(0.6)')
 * // => { Type2: 0.8, Type3: 0.6 }
 * ```
 */
export function parseUnionThresholds(typeSpec: string): Record<string, number> {
  const thresholds: Record<string, number> = {}

  if (!typeSpec) return thresholds

  const parts = typeSpec.split('|')

  for (const part of parts) {
    const match = part.trim().match(/^([A-Za-z][A-Za-z0-9_]*)\s*\(([0-9.]+)\)$/)
    if (match) {
      const [, typeName, thresholdStr] = match
      const threshold = parseFloat(thresholdStr!)
      if (!isNaN(threshold) && threshold >= 0 && threshold <= 1) {
        thresholds[typeName!] = threshold
      }
    }
  }

  return thresholds
}

/**
 * Get the effective threshold for a type
 *
 * @param type - The type name
 * @param options - Search options containing global and per-type thresholds
 * @returns The threshold to use for this type
 */
function getThresholdForType(type: string, options: FallbackSearchOptions): number {
  // Per-type threshold takes precedence
  if (options.thresholds && type in options.thresholds) {
    return options.thresholds[type]!
  }
  // Fall back to global threshold, default to 0 (accept all)
  return options.threshold ?? 0
}

/**
 * Filter matches by threshold
 */
function filterByThreshold(
  matches: UnionMatch[],
  threshold: number,
  includeBelowThreshold?: boolean
): { above: UnionMatch[]; below: UnionMatch[] } {
  const above: UnionMatch[] = []
  const below: UnionMatch[] = []

  for (const match of matches) {
    if (match.$score >= threshold) {
      above.push(match)
    } else if (includeBelowThreshold) {
      below.push(match)
    }
  }

  return { above, below }
}

/**
 * Search union types with fallback behavior
 *
 * Searches multiple types either sequentially (ordered) or concurrently (parallel),
 * with support for per-type thresholds and graceful error handling.
 *
 * @param types - Array of type names to search (in priority order)
 * @param query - The search query
 * @param options - Search options including mode, thresholds, and searcher
 * @returns Search result with matches and metadata
 *
 * @example Ordered mode (stops on first match)
 * ```ts
 * const result = await searchUnionTypes(
 *   ['Document', 'Video', 'Expert'],
 *   'machine learning tutorial',
 *   {
 *     mode: 'ordered',
 *     threshold: 0.75,
 *     searcher: async (type, query) => {
 *       return provider.semanticSearch(type, query)
 *     }
 *   }
 * )
 * ```
 *
 * @example Parallel mode (searches all, returns best)
 * ```ts
 * const result = await searchUnionTypes(
 *   ['Document', 'Video', 'Expert'],
 *   'machine learning tutorial',
 *   {
 *     mode: 'parallel',
 *     returnAll: true,
 *     searcher: async (type, query) => {
 *       return provider.semanticSearch(type, query)
 *     }
 *   }
 * )
 * ```
 */
export async function searchUnionTypes(
  types: readonly string[],
  query: string,
  options: FallbackSearchOptions
): Promise<UnionSearchResult> {
  // Initialize result
  const result: UnionSearchResult = {
    matches: [],
    searchedTypes: [],
    searchOrder: [],
    fallbackTriggered: false,
    allTypesExhausted: false,
    errors: [],
  }
  if (options.includeBelowThreshold) {
    result.belowThresholdMatches = []
  }

  // Handle empty types array
  if (!types || types.length === 0) {
    result.allTypesExhausted = true
    return result
  }

  if (options.mode === 'parallel') {
    return searchParallel(types, query, options, result)
  } else {
    return searchOrdered(types, query, options, result)
  }
}

/**
 * Search types in order, stopping on first match
 */
async function searchOrdered(
  types: readonly string[],
  query: string,
  options: FallbackSearchOptions,
  result: UnionSearchResult
): Promise<UnionSearchResult> {
  const { searcher, includeBelowThreshold, onError = 'throw' } = options

  for (let i = 0; i < types.length; i++) {
    const type = types[i]!
    const threshold = getThresholdForType(type, options)

    result.searchedTypes.push(type)
    result.searchOrder.push(type)

    if (i > 0) {
      result.fallbackTriggered = true
    }

    try {
      const searchOpts: { threshold?: number; limit?: number } = { threshold }
      if (options.limit !== undefined) searchOpts.limit = options.limit
      const matches = await searcher(type, query, searchOpts)

      // Filter by threshold
      const { above, below } = filterByThreshold(matches, threshold, includeBelowThreshold)

      // Collect below-threshold matches for debugging
      if (includeBelowThreshold && below.length > 0) {
        result.belowThresholdMatches!.push(...below)
      }

      // If we found matches above threshold, stop searching
      if (above.length > 0) {
        result.matches = above
        result.matchedType = type
        result.confidence = Math.max(...above.map((m) => m.$score))
        return result
      }
    } catch (error) {
      if (onError === 'throw') {
        throw error
      }
      // Continue mode: record error and try next type
      const searchError: SearchError = {
        type,
        message: error instanceof Error ? error.message : String(error),
      }
      if (error instanceof Error) searchError.error = error
      result.errors!.push(searchError)
    }
  }

  // No matches found in any type
  result.allTypesExhausted = true
  return result
}

/**
 * Search all types in parallel, return best match(es)
 */
async function searchParallel(
  types: readonly string[],
  query: string,
  options: FallbackSearchOptions,
  result: UnionSearchResult
): Promise<UnionSearchResult> {
  const { searcher, returnAll = false, includeBelowThreshold, onError = 'continue' } = options

  // Mark all types as searched
  result.searchedTypes = [...types]
  result.searchOrder = [...types]

  // Search all types in parallel
  const searchPromises = types.map(async (type) => {
    const threshold = getThresholdForType(type, options)

    try {
      const searchOpts: { threshold?: number; limit?: number } = { threshold }
      if (options.limit !== undefined) searchOpts.limit = options.limit
      const matches = await searcher(type, query, searchOpts)
      return { type, matches, error: null }
    } catch (error) {
      return {
        type,
        matches: [] as UnionMatch[],
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  })

  const results = await Promise.all(searchPromises)

  // Collect all matches and errors
  const allMatches: UnionMatch[] = []
  const allBelowThreshold: UnionMatch[] = []

  for (const { type, matches, error } of results) {
    if (error) {
      if (onError === 'throw') {
        throw error
      }
      result.errors!.push({
        type,
        message: error.message,
        error,
      })
      continue
    }

    const threshold = getThresholdForType(type, options)
    const { above, below } = filterByThreshold(matches, threshold, includeBelowThreshold)

    allMatches.push(...above)
    if (includeBelowThreshold) {
      allBelowThreshold.push(...below)
    }
  }

  // Sort by score descending
  allMatches.sort((a, b) => b.$score - a.$score)
  result.belowThresholdMatches = allBelowThreshold

  if (allMatches.length === 0) {
    result.allTypesExhausted = true
    return result
  }

  // Return all matches or just the best one
  if (returnAll) {
    result.matches = allMatches
  } else {
    result.matches = [allMatches[0]!]
  }

  result.matchedType = result.matches[0]!.$type
  result.confidence = result.matches[0]!.$score

  // Fallback triggered if the best match isn't from the first type
  result.fallbackTriggered = result.matchedType !== types[0]

  return result
}

/**
 * Create a searcher function that wraps a semantic search provider
 *
 * @param provider - The database provider with semanticSearch method
 * @returns A searcher function compatible with searchUnionTypes
 *
 * @example
 * ```ts
 * const searcher = createProviderSearcher(provider)
 * const result = await searchUnionTypes(
 *   ['Document', 'Video'],
 *   'tutorial',
 *   { mode: 'ordered', searcher }
 * )
 * ```
 */
export function createProviderSearcher(provider: {
  semanticSearch: (
    type: string,
    query: string,
    options?: { minScore?: number; limit?: number }
  ) => Promise<Array<{ $id: string; $score: number; [key: string]: unknown }>>
}): UnionSearcher {
  return async (type, query, options) => {
    const searchOpts: { minScore?: number; limit?: number } = {
      limit: options?.limit ?? 10,
    }
    if (options?.threshold !== undefined) searchOpts.minScore = options.threshold
    const results = await provider.semanticSearch(type, query, searchOpts)

    return results.map((r) => ({
      ...r,
      $type: type,
    })) as UnionMatch[]
  }
}
