/**
 * A `WorkerLoader` for the Node test pool whose `get()` / `load()` really
 * execute the `WorkerCode` they are handed.
 *
 * `evaluate()` from `src/evaluate.ts` runs in the Node process and calls
 * `loader.get(id, factory)`; this loader ships the resulting `WorkerCode` into
 * a small Miniflare "bridge" worker whose own `env.LOADER` is a real
 * `worker_loaders` binding. The bridge loads the code into a workerd isolate,
 * forwards the request the Node side made (`http://sandbox/execute`), and
 * returns the loaded worker's `Response` unchanged. So what `evaluate()`
 * receives is the generated worker's actual output - not a canned value, and
 * not a result borrowed from the `ai-evaluate/node` path.
 *
 * Test-only: the deployed host worker (`src/host-worker.ts`) accepts
 * `EvaluateOptions`, never a raw `WorkerCode`.
 */

import type { Miniflare } from 'miniflare'
import type { WorkerCode, WorkerLoader, WorkerStub } from '../../src/types.js'
import { COMPATIBILITY_DATE } from '../../src/shared.js'

/** Name of the bridge worker inside its Miniflare instance */
const BRIDGE_WORKER_NAME = 'ai-evaluate-loader-bridge'

/** Route on the bridge worker that loads a `WorkerCode` and runs a request */
const BRIDGE_PATH = '/load'

/**
 * The bridge worker, as plain ESM. Body: `{ id?, code, url, method }`.
 * `id` selects the cached path (`LOADER.get`), its absence the fresh one
 * (`LOADER.load`), mirroring `loadWorker()` in `src/evaluate.ts`.
 */
const BRIDGE_WORKER_SOURCE = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method !== 'POST' || url.pathname !== '${BRIDGE_PATH}') {
      return new Response('Not Found', { status: 404 })
    }
    const { id, code, url: target, method } = await request.json()
    const stub = id ? env.LOADER.get(id, () => code) : env.LOADER.load(code)
    return stub.getEntrypoint().fetch(new Request(target, { method }))
  }
}
`

export interface LoaderBridge {
  /** A loader whose stubs run the loaded code inside workerd */
  loader: WorkerLoader
  /** Every `WorkerCode` the loader was asked to load, in order */
  loaded: WorkerCode[]
  /** Tear down the bridge's Miniflare instance */
  dispose(): Promise<void>
}

/**
 * Start a loader bridge. Creating the Miniflare instance is deferred to the
 * first stub `fetch`, so a bridge that is never exercised costs nothing.
 */
export function createLoaderBridge(): LoaderBridge {
  let miniflarePromise: Promise<Miniflare> | null = null
  const loaded: WorkerCode[] = []

  const getMiniflare = (): Promise<Miniflare> => {
    miniflarePromise ??= (async () => {
      const { Miniflare } = await import('miniflare')
      const miniflare = new Miniflare({
        workers: [
          {
            config: {
              name: BRIDGE_WORKER_NAME,
              type: 'worker',
              compatibilityDate: COMPATIBILITY_DATE,
              manifest: {
                mainModule: 'bridge.js',
                modules: { 'bridge.js': { type: 'esm', contents: BRIDGE_WORKER_SOURCE } },
              },
              env: { LOADER: { type: 'worker-loader' } },
            },
          },
        ],
      })
      await miniflare.ready
      return miniflare
    })()
    return miniflarePromise
  }

  const stubFor = (
    id: string | null,
    resolveCode: () => WorkerCode | Promise<WorkerCode>
  ): WorkerStub => ({
    getDurableObjectClass: () => {
      throw new Error('loader bridge: Durable Object classes are not supported')
    },
    getEntrypoint: () => ({
      fetch: async (request: Request): Promise<Response> => {
        const code = await resolveCode()
        loaded.push(code)
        const miniflare = await getMiniflare()
        const response = await miniflare.dispatchFetch(
          `http://${BRIDGE_WORKER_NAME}${BRIDGE_PATH}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id, code, url: request.url, method: request.method }),
          }
        )
        // Miniflare's Response is undici's; `evaluate()` only needs `.json()`
        return response as unknown as Response
      },
    }),
  })

  const loader: WorkerLoader = {
    get: (id, factory) => stubFor(id, factory),
    load: (code) => stubFor(null, () => code),
  }

  const dispose = async (): Promise<void> => {
    const pending = miniflarePromise
    miniflarePromise = null
    if (!pending) return
    const miniflare = await pending.catch(() => null)
    await miniflare?.dispose()
  }

  return { loader, loaded, dispose }
}
