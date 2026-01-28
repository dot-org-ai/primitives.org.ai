/**
 * Type Guards for ai-promise-db.ts
 *
 * These type guards enable type-safe property access on proxy objects
 * and entity markers, reducing the need for `as any` casts.
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Entity marker interface for objects that may have type/id metadata.
 * Used by the hydration system to identify relations and their types.
 */
export interface EntityMarker {
  /** The entity type name (e.g., 'User', 'Post') */
  $type?: string
  /** The entity's unique identifier */
  $id?: string
  /** Indicates this is an array relation (for thenable arrays) */
  $isArrayRelation?: boolean
}

/**
 * Interface for objects that have a valueOf method returning a primitive.
 * Thenable relation proxies use valueOf() to return the underlying ID.
 */
export interface ValueOfable {
  valueOf(): unknown
}

/**
 * Interface for objects with explicit $id property.
 */
export interface HasId {
  $id: string
}

/**
 * Union type for values that can be entity IDs or references.
 */
export type EntityIdSource = string | ValueOfable | HasId | EntityMarker

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if a value has entity marker properties ($type, $id, or $isArrayRelation).
 *
 * @example
 * ```ts
 * const value = someProxy.$type
 * if (hasEntityMarker(value)) {
 *   // value is now typed as EntityMarker
 *   console.log(value.$type) // Safe access
 * }
 * ```
 */
export function hasEntityMarker(value: unknown): value is EntityMarker {
  return (
    value !== null &&
    typeof value === 'object' &&
    ('$type' in value || '$id' in value || '$isArrayRelation' in value)
  )
}

/**
 * Check if a value has a custom valueOf method that returns a string.
 * This is used to detect thenable relation proxies that return IDs via valueOf().
 *
 * Note: We check if valueOf returns a string to distinguish from Object.prototype.valueOf
 * which returns the object itself.
 *
 * @example
 * ```ts
 * if (isValueOfable(relationProxy)) {
 *   const id = relationProxy.valueOf()
 *   // id is now safely extracted
 * }
 * ```
 */
export function isValueOfable(value: unknown): value is ValueOfable {
  if (value === null || typeof value !== 'object') {
    return false
  }
  // All objects have valueOf, but we check if it returns a string (custom implementation)
  if ('valueOf' in value && typeof (value as Record<string, unknown>).valueOf === 'function') {
    const result = (value as ValueOfable).valueOf()
    return typeof result === 'string'
  }
  return false
}

/**
 * Check if a value has an explicit $id property.
 */
export function hasId(value: unknown): value is HasId {
  return (
    value !== null &&
    typeof value === 'object' &&
    '$id' in value &&
    typeof (value as Record<string, unknown>)['$id'] === 'string'
  )
}

/**
 * Check if an array has entity relation markers ($type or $isArrayRelation).
 * These markers are added by the hydration system to array relations.
 *
 * @example
 * ```ts
 * if (isEntityArray(members)) {
 *   // members is a relation array
 *   const type = members.$type // Safe access
 * }
 * ```
 */
export function isEntityArray(value: unknown): value is Array<unknown> & EntityMarker {
  if (!Array.isArray(value)) {
    return false
  }
  // Check for $type or $isArrayRelation properties on the array
  const arr = value as Array<unknown> & Record<string, unknown>
  return (
    (arr['$type'] !== undefined && typeof arr['$type'] === 'string') ||
    arr['$isArrayRelation'] === true
  )
}

/**
 * Check if a value is a non-null object (excluding arrays).
 * Useful for narrowing before accessing properties.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Check if an array contains relation elements (objects with $type markers).
 * Uses direct property access to match original behavior where $type !== undefined.
 */
export function hasRelationElements(arr: unknown[]): arr is Array<Record<string, unknown>> {
  return arr.some((v) => {
    if (v === null || typeof v !== 'object') {
      return false
    }
    // Use direct property access to match original behavior: (v as any).$type !== undefined
    const obj = v as Record<string, unknown>
    return obj['$type'] !== undefined
  })
}

// =============================================================================
// Extraction Functions
// =============================================================================

/**
 * Extract an entity ID from various sources.
 *
 * Supports:
 * - String IDs (returned as-is)
 * - Objects with valueOf() returning string (thenable proxies)
 * - Objects with $id property (entities)
 * - Objects with id property (generic objects)
 *
 * @example
 * ```ts
 * // Works with strings
 * extractEntityId('user-123') // 'user-123'
 *
 * // Works with thenable proxies
 * extractEntityId(post.author) // 'author-id' via valueOf()
 *
 * // Works with entities
 * extractEntityId(user) // user.$id
 * ```
 */
export function extractEntityId(value: unknown): string | undefined {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return undefined
  }

  // Handle string directly
  if (typeof value === 'string') {
    return value
  }

  // Handle objects
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>

    // Try valueOf() first (thenable proxies) - check if it returns a string
    if ('valueOf' in obj && typeof obj.valueOf === 'function') {
      const val = obj.valueOf()
      if (typeof val === 'string') {
        return val
      }
    }

    // Try $id property (entity marker)
    if ('$id' in obj && typeof obj['$id'] === 'string') {
      return obj['$id']
    }

    // Try plain id property (generic object)
    if ('id' in obj && typeof obj['id'] === 'string') {
      return obj['id']
    }
  }

  return undefined
}

/**
 * Extract the $type marker from an entity or relation proxy.
 * Uses direct property access to handle proxy objects that may not expose 'in' trap.
 *
 * @example
 * ```ts
 * const entity = { $type: 'User', name: 'John' }
 * extractMarkerType(entity) // 'User'
 * ```
 */
export function extractMarkerType(value: unknown): string | undefined {
  if (value === null || typeof value !== 'object') {
    return undefined
  }
  // Use direct property access to handle proxies: (value as any).$type
  const obj = value as Record<string, unknown>
  const type = obj['$type']
  if (type !== undefined && typeof type === 'string') {
    return type
  }
  return undefined
}

/**
 * Extract $type from an array relation.
 */
export function extractArrayRelationType(arr: unknown): string | undefined {
  if (isEntityArray(arr) && typeof arr.$type === 'string') {
    return arr.$type
  }
  return undefined
}

/**
 * Safely access a property on an unknown value.
 * Returns undefined if the value is not an object or the property doesn't exist.
 */
export function safeGet<T = unknown>(value: unknown, key: string): T | undefined {
  if (isPlainObject(value)) {
    return value[key] as T | undefined
  }
  return undefined
}

// =============================================================================
// Type Assertion Helpers
// =============================================================================

/**
 * Assert that a value is a record (for use after type narrowing).
 * This is used internally to avoid as any when we've already verified
 * the value is an object.
 */
export function asRecord(value: object): Record<string, unknown> {
  return value as Record<string, unknown>
}

/**
 * Assert that a callback is properly typed.
 * Used when the callback signature is known but TypeScript can't infer it.
 */
export function asCallback<T, U>(
  fn: (item: T, index: number) => U
): (item: unknown, index: number) => U {
  return fn as (item: unknown, index: number) => U
}

/**
 * Assert that a predicate is properly typed for array filter operations.
 * Used when TypeScript can't infer the exact array element type.
 */
export function asPredicate<T>(
  fn: (item: T, index: number) => boolean
): (item: unknown, index: number) => boolean {
  return fn as (item: unknown, index: number) => boolean
}

/**
 * Assert that a comparator is properly typed for array sort operations.
 * Used when TypeScript can't infer the exact array element type.
 */
export function asComparator<T>(
  fn: ((a: T, b: T) => number) | undefined
): ((a: unknown, b: unknown) => number) | undefined {
  return fn as ((a: unknown, b: unknown) => number) | undefined
}

/**
 * Type-safe access to symbol-keyed properties on objects.
 * Used in proxy handlers where we need to access symbol properties.
 */
export function getSymbolProperty<T = unknown>(obj: object, sym: symbol): T | undefined {
  return (obj as Record<symbol, unknown>)[sym] as T | undefined
}

/**
 * Cast an item to the expected type.
 * Used when the item type is known but TypeScript sees it as unknown.
 */
export function asItem<T>(value: unknown): T {
  return value as T
}

// =============================================================================
// Draft/Resolve Type Guards
// =============================================================================

/**
 * Check if an object is in draft phase.
 * Draft objects have $phase === 'draft' and may have $refs.
 */
export function isDraft(value: unknown): value is Record<string, unknown> & { $phase: 'draft' } {
  return isPlainObject(value) && value['$phase'] === 'draft'
}

/**
 * Check if an object is in resolved phase.
 * Resolved objects have $phase === 'resolved'.
 */
export function isResolved(
  value: unknown
): value is Record<string, unknown> & { $phase: 'resolved' } {
  return isPlainObject(value) && value['$phase'] === 'resolved'
}

/**
 * Extract $refs from a draft object safely.
 * Returns undefined if the value is not a draft or has no $refs.
 */
export function extractRefs(value: unknown): Record<string, unknown> | undefined {
  if (isDraft(value) && isPlainObject(value['$refs'])) {
    return value['$refs'] as Record<string, unknown>
  }
  return undefined
}

/**
 * Set a property on a Record safely.
 * Used to avoid type assertions when setting properties on draft/resolved objects.
 */
export function setProperty(obj: Record<string, unknown>, key: string, value: unknown): void {
  obj[key] = value
}

// =============================================================================
// Dynamic Import Type Guards
// =============================================================================

/**
 * Validate that a dynamic import result has the expected factory function.
 * Used to replace dangerous double-casts (as unknown as SomeModule).
 *
 * @example
 * ```ts
 * const module = await import('@mdxdb/fs')
 * if (hasFactoryFunction(module, 'createFsProvider')) {
 *   const provider = module.createFsProvider({ root: './content' })
 * }
 * ```
 */
export function hasFactoryFunction<T extends string>(
  module: unknown,
  functionName: T
): module is Record<T, (...args: unknown[]) => unknown> {
  return (
    module !== null &&
    typeof module === 'object' &&
    functionName in module &&
    typeof (module as Record<string, unknown>)[functionName] === 'function'
  )
}

/**
 * Check if a value is a function.
 * Useful for validating dynamic imports.
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function'
}

// =============================================================================
// Schema Type Guards
// =============================================================================

/**
 * Safely access schema metadata fields.
 * Returns undefined if the field is not present or not the expected type.
 */
export function getSchemaMetadata<T>(
  schema: Record<string, unknown> | undefined,
  field: string
): T | undefined {
  if (!schema || !isPlainObject(schema)) {
    return undefined
  }
  return schema[field] as T | undefined
}
