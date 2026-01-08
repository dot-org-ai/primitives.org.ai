/**
 * Events API - Public interface for database event subscriptions
 *
 * The events system allows you to subscribe to database changes in real-time.
 * Events are emitted automatically for CRUD operations and can also be
 * manually emitted for custom workflows.
 *
 * @module events
 *
 * @example Basic usage
 * ```ts
 * import { DB } from '@org.ai/db'
 *
 * const { db, events } = DB({
 *   Post: { title: 'string', content: 'string' },
 *   Comment: { text: 'string', post: 'Post.comments' },
 * })
 *
 * // Subscribe to entity events
 * events.on('entity:created', (event) => {
 *   console.log(`Created ${event.object}:`, event.objectData)
 * })
 *
 * events.on('entity:updated', (event) => {
 *   console.log(`Updated ${event.object}`)
 * })
 *
 * events.on('entity:deleted', (event) => {
 *   console.log(`Deleted ${event.object}`)
 * })
 *
 * // Subscribe to type-specific events
 * events.on('Post.created', (event) => {
 *   console.log('New post:', event.objectData?.title)
 * })
 *
 * // Subscribe to cascade progress
 * events.on('cascade:progress', (event) => {
 *   const { current, total } = event.meta || {}
 *   console.log(`Creating entities: ${current}/${total}`)
 * })
 *
 * // Subscribe to resolve completion
 * events.on('resolve:complete', (event) => {
 *   console.log(`Resolved draft to ${event.result}`)
 * })
 * ```
 *
 * @example Pattern matching
 * ```ts
 * // All Post events
 * events.on('Post.*', (event) => console.log('Post event:', event.event))
 *
 * // All created events across types
 * events.on('*.created', (event) => console.log('Created:', event.object))
 *
 * // All events
 * events.on('*', (event) => console.log('Event:', event.event))
 * ```
 *
 * @example Emitting custom events
 * ```ts
 * // Emit with Actor-Event-Object-Result pattern
 * await events.emit({
 *   actor: 'user:john',
 *   event: 'Post.published',
 *   object: 'Post/hello-world',
 *   objectData: { title: 'Hello World' },
 *   result: 'Publication/pub-123',
 *   meta: { channel: 'blog' },
 * })
 *
 * // Simple emit (legacy pattern)
 * await events.emit('custom:event', { data: 'value' })
 * ```
 *
 * @example Listing and replaying events
 * ```ts
 * // List recent events
 * const recentEvents = await events.list({
 *   event: 'Post.created',
 *   since: new Date('2024-01-01'),
 *   limit: 100,
 * })
 *
 * // Replay events through a handler
 * await events.replay({
 *   event: 'Post.*',
 *   since: new Date('2024-01-01'),
 *   handler: async (event) => {
 *     await processEvent(event)
 *   },
 * })
 * ```
 */

// Re-export event types from schema
export type {
  DBEvent,
  EventsAPI,
  CreateEventOptions,
  ActorData,
} from './schema.js'

/**
 * Standard event types emitted by the database
 *
 * These are the built-in event types that the database emits automatically:
 *
 * - `entity:created` - Emitted when any entity is created
 * - `entity:updated` - Emitted when any entity is updated
 * - `entity:deleted` - Emitted when any entity is deleted
 * - `cascade:progress` - Emitted during cascade operations to track progress
 * - `resolve:complete` - Emitted when a draft entity is resolved to a persistent entity
 *
 * Type-specific events follow the pattern `{TypeName}.{action}`:
 * - `Post.created` - Emitted when a Post is created
 * - `User.updated` - Emitted when a User is updated
 * - `Comment.deleted` - Emitted when a Comment is deleted
 */
export const StandardEventTypes = {
  /** Emitted when any entity is created */
  ENTITY_CREATED: 'entity:created',
  /** Emitted when any entity is updated */
  ENTITY_UPDATED: 'entity:updated',
  /** Emitted when any entity is deleted */
  ENTITY_DELETED: 'entity:deleted',
  /** Emitted during cascade operations to report progress */
  CASCADE_PROGRESS: 'cascade:progress',
  /** Emitted when a draft entity is resolved to persistent storage */
  RESOLVE_COMPLETE: 'resolve:complete',
} as const

/**
 * Event type literals for type-safe subscriptions
 */
export type StandardEventType = (typeof StandardEventTypes)[keyof typeof StandardEventTypes]

/**
 * Helper to create type-specific event patterns
 *
 * @example
 * ```ts
 * const pattern = entityEvent('Post', 'created') // 'Post.created'
 * events.on(pattern, handler)
 * ```
 */
export function entityEvent(typeName: string, action: 'created' | 'updated' | 'deleted'): string {
  return `${typeName}.${action}`
}

/**
 * Helper to create wildcard patterns
 *
 * @example
 * ```ts
 * // All events for a type
 * const pattern = typePattern('Post') // 'Post.*'
 *
 * // All events of an action across types
 * const pattern = actionPattern('created') // '*.created'
 * ```
 */
export function typePattern(typeName: string): string {
  return `${typeName}.*`
}

export function actionPattern(action: 'created' | 'updated' | 'deleted'): string {
  return `*.${action}`
}
