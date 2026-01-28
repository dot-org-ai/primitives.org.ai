/**
 * Mock for cloudflare:workers module
 *
 * Provides mock implementations of WorkerEntrypoint and RpcTarget
 * for testing worker code outside of the Cloudflare Workers runtime.
 */

/**
 * Mock RpcTarget base class
 *
 * In real Cloudflare Workers, RpcTarget is the base class for objects
 * that can be passed over RPC. This mock provides a simple base class.
 */
export class RpcTarget {
  constructor() {
    // Base class constructor
  }
}

/**
 * Mock WorkerEntrypoint base class
 *
 * In real Cloudflare Workers, WorkerEntrypoint is the base class for
 * workers that expose RPC methods. This mock provides a simple base class.
 */
export class WorkerEntrypoint<Env = unknown> {
  protected env: Env | undefined
  protected ctx: ExecutionContext | undefined

  constructor() {
    // Base class constructor
  }
}

/**
 * Mock ExecutionContext
 */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}
