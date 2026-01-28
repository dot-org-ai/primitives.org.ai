/**
 * Worker Export - WorkerEntrypoint for RPC access to NS
 *
 * Import from 'digital-objects/worker' when deploying to Cloudflare Workers.
 *
 * @example
 * ```typescript
 * // wrangler.jsonc
 * {
 *   "main": "src/worker.ts",
 *   "durable_objects": {
 *     "bindings": [{ "name": "NS", "class_name": "NS" }]
 *   }
 * }
 *
 * // worker.ts - the digital-objects service
 * export { NS } from 'digital-objects/ns'
 * export { DigitalObjectsWorker as default } from 'digital-objects/worker'
 * ```
 *
 * @example
 * ```typescript
 * // consuming-worker.ts
 * interface Env {
 *   DIGITAL_OBJECTS: Service<typeof import('digital-objects/worker').DigitalObjectsWorker>
 * }
 *
 * export default {
 *   async fetch(request: Request, env: Env) {
 *     const service = env.DIGITAL_OBJECTS.connect('my-namespace')
 *     const post = await service.create('Post', { title: 'Hello' })
 *     return Response.json(post)
 *   }
 * }
 * ```
 */

export { DigitalObjectsWorker, DigitalObjectsService, default } from './worker.js'
export type { Env } from './worker.js'
