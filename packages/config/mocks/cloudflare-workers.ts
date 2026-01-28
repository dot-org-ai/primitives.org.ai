/**
 * Mock for cloudflare:workers module
 *
 * Provides mock implementations of Cloudflare Workers classes
 * for testing worker code outside of the Cloudflare Workers runtime.
 *
 * This is the shared mock used across all packages in the monorepo.
 */

/**
 * Mock ExecutionContext
 *
 * In real Cloudflare Workers, ExecutionContext provides methods for
 * extending the lifetime of the worker and handling exceptions.
 */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

/**
 * Mock RpcStub class
 *
 * In real Cloudflare Workers, RpcStub is used for type-safe RPC calls
 * to other workers or Durable Objects.
 */
export class RpcStub {}

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
 * Mock DurableObject base class
 *
 * In real Cloudflare Workers, DurableObject is the base class for
 * Durable Objects that provide strongly consistent storage and coordination.
 */
export class DurableObject<Env = unknown> {
  protected env: Env | undefined
  protected ctx: ExecutionContext | undefined

  constructor() {
    // Base class constructor
  }
}

export default {
  RpcStub,
  WorkerEntrypoint,
  DurableObject,
  RpcTarget,
}
