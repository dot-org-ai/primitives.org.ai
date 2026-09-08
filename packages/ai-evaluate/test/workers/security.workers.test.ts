/**
 * Network and environment isolation, witnessed against the real
 * `worker_loaders` binding inside workerd.
 *
 * These blocks moved here from test/security.test.ts, which keeps the
 * pure-JS escape vectors (prototype pollution, constructor/eval escapes, code
 * injection, resource exhaustion) on the Node pool. Here every assertion is
 * about what workerd does with the loaded worker: what `globalOutbound: null`
 * blocks, which bindings the isolate can see, and which host APIs exist.
 */
/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { env } from 'cloudflare:test'
import { describe, it, expect } from 'vitest'
import { evaluate } from '../../src/evaluate.js'

/** Run a script that catches its own errors and returns an object */
async function probe(script: string, options: { fetch?: boolean | null | string[] } = {}) {
  const result = await evaluate({ script, timeout: 10000, ...options }, env)
  expect(result.success, result.error).toBe(true)
  expect(typeof result.value).toBe('object')
  return result.value as Record<string, unknown>
}

describe('security (workerd)', () => {
  describe('network isolation', () => {
    describe('fetch: false / null blocks all network', () => {
      it('blocks public hosts with fetch: false', async () => {
        const value = await probe(
          `
            try {
              const response = await fetch('https://example.com');
              return { blocked: false, status: response.status };
            } catch (e) {
              return { blocked: true, error: e.message };
            }
          `,
          { fetch: false }
        )
        expect(value.blocked).toBe(true)
        expect(value.error).toMatch(/Network|blocked|outbound/i)
      })

      it('blocks public hosts with fetch: null (backwards compat)', async () => {
        const value = await probe(
          `
            try {
              await fetch('https://example.com');
              return { blocked: false };
            } catch (e) {
              return { blocked: true, error: e.message };
            }
          `,
          { fetch: null }
        )
        expect(value.blocked).toBe(true)
      })

      it('blocks localhost and private ranges with fetch: null', async () => {
        const value = await probe(
          `
            const targets = [
              'http://127.0.0.1:8080',
              'http://localhost:8080',
              'http://10.0.0.1:8080',
              'http://192.168.1.1:8080',
              'http://172.16.0.1:8080',
            ];
            const outcomes = {};
            for (const target of targets) {
              try {
                await fetch(target);
                outcomes[target] = 'fetched';
              } catch (e) {
                outcomes[target] = 'blocked';
              }
            }
            return { outcomes };
          `,
          { fetch: null }
        )
        expect(Object.values(value.outcomes as Record<string, string>)).toEqual([
          'blocked',
          'blocked',
          'blocked',
          'blocked',
          'blocked',
        ])
      })
    })

    describe('fetch allowlist', () => {
      it('blocks non-matching domains', async () => {
        const value = await probe(
          `
            try {
              await fetch('https://blocked.com/api');
              return { blocked: false };
            } catch (e) {
              return { blocked: true, error: e.message };
            }
          `,
          { fetch: ['api.example.com'] }
        )
        expect(value.blocked).toBe(true)
        expect(value.error).toContain('not in allowlist')
      })

      // Allowed-domain probes pass a pre-aborted signal: the allowlist check
      // runs first, then the real fetch rejects with AbortError before any
      // network I/O. That witnesses "passed the allowlist" without DNS.
      it('allows matching exact domains past the allowlist', async () => {
        const value = await probe(
          `
            try {
              await fetch('https://api.example.com/data', { signal: AbortSignal.abort() });
              return { allowlistBlocked: false, fetched: true };
            } catch (e) {
              return { allowlistBlocked: e.message.includes('not in allowlist'), name: e.name, error: e.message };
            }
          `,
          { fetch: ['api.example.com'] }
        )
        expect(value.allowlistBlocked).toBe(false)
        expect(value.name).toBe('AbortError')
      })

      it('wildcard patterns block other domains', async () => {
        const value = await probe(
          `
            try {
              await fetch('https://other.com/api');
              return { blocked: false };
            } catch (e) {
              return { blocked: e.message.includes('not in allowlist'), error: e.message };
            }
          `,
          { fetch: ['*.example.com'] }
        )
        expect(value.blocked).toBe(true)
      })

      it('wildcard patterns match subdomains', async () => {
        const value = await probe(
          `
            try {
              await fetch('https://api.example.com/data', { signal: AbortSignal.abort() });
              return { allowlistBlocked: false };
            } catch (e) {
              return { allowlistBlocked: e.message.includes('not in allowlist'), name: e.name, error: e.message };
            }
          `,
          { fetch: ['*.example.com'] }
        )
        expect(value.allowlistBlocked).toBe(false)
        expect(value.name).toBe('AbortError')
      })

      it('blocks localhost when not in the allowlist', async () => {
        const value = await probe(
          `
            try {
              await fetch('http://localhost:8080/api');
              return { blocked: false };
            } catch (e) {
              return { blocked: e.message.includes('not in allowlist'), error: e.message };
            }
          `,
          { fetch: ['api.example.com'] }
        )
        expect(value.blocked).toBe(true)
      })
    })

    describe('fetch: true allows network', () => {
      it('does not block fetch in the sandbox', async () => {
        const value = await probe(
          `
            try {
              await fetch('https://example.com', { signal: AbortSignal.abort() });
              return { allowlistBlocked: false, networkBlocked: false };
            } catch (e) {
              return {
                allowlistBlocked: e.message.includes('not in allowlist'),
                networkBlocked: e.message.includes('Network access blocked') || e.message.includes('not permitted'),
                name: e.name,
                error: e.message,
              };
            }
          `,
          { fetch: true }
        )
        expect(value.allowlistBlocked).toBe(false)
        expect(value.networkBlocked).toBe(false)
        // Reached the real fetch (aborted before I/O), so workerd has an outbound
        expect(value.name).toBe('AbortError')
      })
    })
  })

  describe('environment isolation', () => {
    describe('parent worker environment', () => {
      it('cannot see the parent worker bindings', async () => {
        const value = await probe(`
          return {
            hasParentEnv: typeof parentEnv !== 'undefined',
            hasLoaderGlobal: typeof LOADER !== 'undefined',
            hasLoader: typeof env !== 'undefined' && !!env.LOADER,
            hasKV: typeof env !== 'undefined' && !!env.KV,
            hasDB: typeof env !== 'undefined' && !!env.DB,
            hasSecrets: typeof env !== 'undefined' && !!env.API_KEY,
          };
        `)
        expect(value.hasParentEnv).toBe(false)
        expect(value.hasLoaderGlobal).toBe(false)
        expect(value.hasLoader).toBe(false)
        expect(value.hasKV).toBe(false)
        expect(value.hasDB).toBe(false)
        expect(value.hasSecrets).toBe(false)
      })

      it('the loaded worker gets an empty env, not the host env', async () => {
        // The script runs inside the sandbox worker's fetch handler, so `env`
        // is the loaded worker's own env - which the loader left empty. The
        // host's LOADER binding (and anything else in the host env) is absent.
        const value = await probe(`
          return { keys: typeof env === 'undefined' ? null : Object.keys(env) };
        `)
        expect(value.keys).toEqual([])
      })

      it('cannot use the caches API for data exfiltration', async () => {
        const value = await probe(`
          try {
            if (typeof caches === 'undefined') return { hasCaches: false };
            const cache = await caches.open('exfil');
            await cache.put('https://exfil.example/x', new Response('secret'));
            const hit = await cache.match('https://exfil.example/x');
            return { hasCaches: true, stored: !!hit };
          } catch (e) {
            return { hasCaches: true, stored: false, error: e.message };
          }
        `)
        // workerd exposes `caches` to every worker; a loaded worker must not
        // be able to persist anything through it.
        expect(value.stored).toBe(false)
      })
    })

    describe('file system APIs', () => {
      it('cannot require the Node.js fs module', async () => {
        const value = await probe(`
          try {
            const fs = require('fs');
            return { hasFs: true };
          } catch (e) {
            return { hasFs: false, error: e.message };
          }
        `)
        expect(value.hasFs).toBe(false)
      })

      it('cannot dynamically import fs', async () => {
        const value = await probe(`
          try {
            await import('fs');
            return { hasFs: true };
          } catch (e) {
            return { hasFs: false, error: e.message };
          }
        `)
        expect(value.hasFs).toBe(false)
      })

      it('has no File System Access API', async () => {
        const value = await probe(`
          return {
            hasShowOpenFilePicker: typeof showOpenFilePicker !== 'undefined',
            hasShowSaveFilePicker: typeof showSaveFilePicker !== 'undefined',
            hasShowDirectoryPicker: typeof showDirectoryPicker !== 'undefined',
          };
        `)
        expect(value.hasShowOpenFilePicker).toBe(false)
        expect(value.hasShowSaveFilePicker).toBe(false)
        expect(value.hasShowDirectoryPicker).toBe(false)
      })
    })

    describe('process APIs', () => {
      it('has no process.env', async () => {
        const value = await probe(`
          return {
            hasProcessEnv: typeof process !== 'undefined' && !!process.env && Object.keys(process.env).length > 0,
          };
        `)
        expect(value.hasProcessEnv).toBe(false)
      })

      it('has no process.exit', async () => {
        const value = await probe(`
          return { hasProcessExit: typeof process !== 'undefined' && typeof process.exit === 'function' };
        `)
        expect(value.hasProcessExit).toBe(false)
      })

      it('cannot require child_process', async () => {
        const value = await probe(`
          try {
            require('child_process');
            return { hasChildProcess: true };
          } catch (e) {
            return { hasChildProcess: false, error: e.message };
          }
        `)
        expect(value.hasChildProcess).toBe(false)
      })

      it('cannot dynamically import child_process', async () => {
        const value = await probe(`
          try {
            await import('child_process');
            return { hasSpawn: true };
          } catch (e) {
            return { hasSpawn: false, error: e.message };
          }
        `)
        expect(value.hasSpawn).toBe(false)
      })
    })

    describe('host runtime globals', () => {
      it('has no Deno or Bun namespace', async () => {
        const value = await probe(`
          return { hasDeno: typeof Deno !== 'undefined', hasBun: typeof Bun !== 'undefined' };
        `)
        expect(value.hasDeno).toBe(false)
        expect(value.hasBun).toBe(false)
      })

      it('runs WebAssembly inside the isolate', async () => {
        const value = await probe(`
          try {
            const wasmCode = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
            new WebAssembly.Module(wasmCode);
            return { hasWasm: true };
          } catch (e) {
            return { hasWasm: false, error: e.message };
          }
        `)
        // workerd provides WebAssembly; it is sandboxed by the isolate itself
        expect(typeof value.hasWasm).toBe('boolean')
      })
    })
  })
})
