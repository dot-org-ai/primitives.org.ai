/**
 * `loadHostWorker()` source selection: the module map embedded at build time
 * wins; the disk walk is the fallback for the `src/` placeholder.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(() => {
  vi.doUnmock('../src/host-worker-modules.js')
  vi.resetModules()
})

describe('loadHostWorker', () => {
  it('falls back to the disk walk while the embed is the src/ placeholder', async () => {
    const { EMBEDDED_HOST_WORKER } = await import('../src/host-worker-modules.js')
    expect(EMBEDDED_HOST_WORKER).toBeNull()

    const { loadHostWorker, walkHostWorker } = await import('../src/host-modules.js')
    expect(loadHostWorker()).toEqual(walkHostWorker())
  })

  it('uses the embedded module map when the build has written one', async () => {
    const embedded = {
      mainModule: 'host-worker.js',
      modules: { 'host-worker.js': 'export default { fetch: () => new Response() }' },
    }
    vi.resetModules()
    vi.doMock('../src/host-worker-modules.js', () => ({ EMBEDDED_HOST_WORKER: embedded }))

    const { loadHostWorker } = await import('../src/host-modules.js')
    expect(loadHostWorker()).toBe(embedded)
  })
})
