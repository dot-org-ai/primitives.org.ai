/**
 * The host worker modules, embedded at build time.
 *
 * In the source tree this is a placeholder: `loadHostWorker()` (see
 * `./host-modules.ts`) falls back to reading `host-worker` and its imports
 * from disk beside itself, which is what vitest (running `src/*.ts`) and
 * `tsc --watch` (emitting `dist/*.js`) rely on.
 *
 * `scripts/build-host-worker.ts` runs after `tsc` and overwrites
 * `dist/host-worker-modules.js` with the real module map, so the published
 * package carries the host worker inside its own JavaScript. That is what
 * lets a consumer bundle `ai-evaluate/node` into a single file: there is no
 * `dist/host-worker.js` next to such a bundle, and `import.meta.url` points at
 * the consumer's artifact, so nothing may be located relative to this module
 * at runtime.
 */

import type { HostWorkerModules } from './host-modules.js'

/** `null` in `src/`; the walked `dist/` module graph in the built package */
export const EMBEDDED_HOST_WORKER: HostWorkerModules | null = null
