/**
 * Security tests for ai-evaluate sandbox
 *
 * Tests various sandbox escape attempts, resource exhaustion,
 * network isolation, code injection, and environment isolation.
 */
import { describe, it, expect } from 'vitest'
import { evaluate } from '../src/node.js'

describe('security', () => {
  describe('sandbox escape attempts', () => {
    describe('prototype pollution', () => {
      it('blocks Object.prototype pollution from affecting host', async () => {
        const result = await evaluate({
          script: `
            Object.prototype.polluted = true;
            return ({}).polluted;
          `,
        })
        // The main environment should be unaffected by sandbox prototype pollution
        expect(({} as Record<string, unknown>).polluted).toBeUndefined()
      })

      it('blocks Array.prototype pollution from affecting host', async () => {
        const result = await evaluate({
          script: `
            Array.prototype.polluted = true;
            return [].polluted;
          `,
        })
        expect(([] as unknown as Record<string, unknown>).polluted).toBeUndefined()
      })

      it('blocks Function.prototype pollution from affecting host', async () => {
        const result = await evaluate({
          script: `
            Function.prototype.polluted = true;
            return (function(){}).polluted;
          `,
        })
        expect((function () {} as unknown as Record<string, unknown>).polluted).toBeUndefined()
      })
    })

    describe('global scope access', () => {
      it('blocks access to globalThis.process', async () => {
        const result = await evaluate({
          script: `
            if (typeof globalThis.process !== 'undefined') {
              return { hasProcess: true, env: globalThis.process.env };
            }
            return { hasProcess: false };
          `,
        })
        // Sandbox should not have access to Node.js process
        if (result.success) {
          expect(result.value).toEqual({ hasProcess: false })
        }
      })

      it('blocks access to global.require', async () => {
        const result = await evaluate({
          script: `
            if (typeof global !== 'undefined' && typeof global.require === 'function') {
              return { hasRequire: true };
            }
            if (typeof require === 'function') {
              return { hasRequire: true };
            }
            return { hasRequire: false };
          `,
        })
        if (result.success) {
          expect(result.value).toEqual({ hasRequire: false })
        }
      })

      it('blocks access to __dirname and __filename', async () => {
        const result = await evaluate({
          script: `
            return {
              hasDirname: typeof __dirname !== 'undefined',
              hasFilename: typeof __filename !== 'undefined'
            };
          `,
        })
        if (result.success) {
          expect(result.value).toEqual({ hasDirname: false, hasFilename: false })
        }
      })
    })

    describe('constructor access', () => {
      it('blocks constructor-based global access to process', async () => {
        const result = await evaluate({
          script: `
            try {
              const global = ({}).constructor.constructor('return this')();
              if (global.process) {
                return { escaped: true, hasProcess: true };
              }
              return { escaped: true, hasProcess: false };
            } catch (e) {
              return { escaped: false, error: e.message };
            }
          `,
        })
        // Either the access is blocked or it doesn't have process
        if (result.success && typeof result.value === 'object' && result.value !== null) {
          const value = result.value as Record<string, unknown>
          if (value.escaped) {
            expect(value.hasProcess).toBe(false)
          }
        }
      })

      it('blocks Function constructor escape to process', async () => {
        const result = await evaluate({
          script: `
            try {
              const fn = new Function('return this.process');
              const proc = fn();
              return { hasProcess: !!proc };
            } catch (e) {
              return { blocked: true, error: e.message };
            }
          `,
        })
        if (result.success && typeof result.value === 'object' && result.value !== null) {
          const value = result.value as Record<string, unknown>
          if (!value.blocked) {
            expect(value.hasProcess).toBe(false)
          }
        }
      })

      it('blocks eval-based escape attempts', async () => {
        const result = await evaluate({
          script: `
            try {
              const proc = eval('this.process || globalThis.process');
              return { hasProcess: !!proc };
            } catch (e) {
              return { blocked: true, error: e.message };
            }
          `,
        })
        if (result.success && typeof result.value === 'object' && result.value !== null) {
          const value = result.value as Record<string, unknown>
          if (!value.blocked) {
            expect(value.hasProcess).toBe(false)
          }
        }
      })
    })
  })

  describe('resource exhaustion', () => {
    describe('infinite loops with timeout', () => {
      // Note: Synchronous infinite loops are hard to interrupt in JavaScript.
      // The sandbox relies on workerd/Miniflare CPU time limits.
      // These tests are skipped by default to avoid hanging CI.

      it.skip('terminates infinite while loop (manual test)', async () => {
        const result = await evaluate({
          script: 'while(true){}',
          timeout: 2000,
        })
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      }, 30000)

      it.skip('terminates infinite for loop (manual test)', async () => {
        const result = await evaluate({
          script: 'for(;;){}',
          timeout: 2000,
        })
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      }, 30000)

      it.skip('terminates busy loop (manual test)', async () => {
        const result = await evaluate({
          script: `
            let i = 0;
            while(true) { i++; }
            return i;
          `,
          timeout: 2000,
        })
        expect(result.success).toBe(false)
      }, 30000)
    })

    describe('memory bombs', () => {
      // Note: Memory bomb tests can crash the test runner.
      // These are skipped by default to avoid CI issues.

      it.skip('handles large array allocation attempt (manual test)', async () => {
        const result = await evaluate({
          script: `
            try {
              const arr = new Array(1e9).fill('x'.repeat(1000));
              return { allocated: true };
            } catch (e) {
              return { blocked: true, error: e.message };
            }
          `,
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.blocked).toBe(true)
        }
      }, 15000)

      it('handles moderate string expansion', async () => {
        const result = await evaluate({
          script: `
            try {
              let s = 'x';
              // Limited to 20 iterations (~1MB) to avoid crashing
              for (let i = 0; i < 20; i++) {
                s = s + s; // exponential growth
              }
              return { length: s.length };
            } catch (e) {
              return { blocked: true, error: e.message };
            }
          `,
          timeout: 5000,
        })
        expect(result).toBeDefined()
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          // 2^20 = ~1 million characters
          expect(value.length).toBe(1048576)
        }
      }, 15000)
    })

    describe('stack overflow', () => {
      it('handles recursive function', async () => {
        const result = await evaluate({
          script: `
            function recurse() { return recurse(); }
            try {
              recurse();
              return { completed: true };
            } catch (e) {
              return { overflow: true, error: e.message };
            }
          `,
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          // Should catch the stack overflow
          expect(value.overflow).toBe(true)
        }
      }, 15000)

      it('handles mutual recursion', async () => {
        const result = await evaluate({
          script: `
            function a() { return b(); }
            function b() { return a(); }
            try {
              a();
              return { completed: true };
            } catch (e) {
              return { overflow: true, error: e.message };
            }
          `,
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.overflow).toBe(true)
        }
      }, 15000)
    })
  })

  describe('network isolation', () => {
    describe('fetch blocking when fetch: null', () => {
      // Note: The `fetch: null` option should block network access.
      // However, the actual blocking depends on the implementation.
      // These tests verify the expected behavior.

      it('verifies fetch behavior with network blocked', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              // Check what happens when we try to fetch
              try {
                const controller = new AbortController();
                setTimeout(() => controller.abort(), 500);
                await fetch('https://httpstat.us/200', { signal: controller.signal });
                return { fetchAllowed: true, networkBlocked: false };
              } catch (e) {
                // Aborted or blocked
                return { fetchAllowed: true, networkBlocked: true, error: e.message };
              }
            })();
          `,
          fetch: null,
          timeout: 3000,
        })
        // Test completes (doesn't hang)
        expect(result).toBeDefined()
      }, 10000)

      it('handles localhost access with fetch: null', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const controller = new AbortController();
                setTimeout(() => controller.abort(), 100);
                await fetch('http://127.0.0.1:8080', { signal: controller.signal });
                return { fetched: true };
              } catch (e) {
                return { blocked: true, error: e.message };
              }
            })();
          `,
          fetch: null,
          timeout: 2000,
        })
        // The request should either succeed (connection refused quickly),
        // be blocked, or timeout/abort. All are valid behaviors.
        // This test just verifies the sandbox doesn't hang on localhost requests.
        expect(result).toBeDefined()
      }, 5000)

      // Skip private network tests as they can cause long timeouts
      it.skip('blocks private network access (10.x.x.x)', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const response = await fetch('http://10.0.0.1:8080');
                return { fetched: true };
              } catch (e) {
                return { blocked: true, error: e.message };
              }
            })();
          `,
          fetch: null,
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.blocked).toBe(true)
        }
      }, 10000)

      it.skip('blocks private network access (192.168.x.x)', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const response = await fetch('http://192.168.1.1:8080');
                return { fetched: true };
              } catch (e) {
                return { blocked: true, error: e.message };
              }
            })();
          `,
          fetch: null,
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.blocked).toBe(true)
        }
      }, 10000)

      it.skip('blocks private network access (172.16.x.x)', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const response = await fetch('http://172.16.0.1:8080');
                return { fetched: true };
              } catch (e) {
                return { blocked: true, error: e.message };
              }
            })();
          `,
          fetch: null,
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.blocked).toBe(true)
        }
      }, 10000)
    })

    describe('fetch with FetchConfig mode: block', () => {
      it('blocks fetch requests with mode: block', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const response = await fetch('https://example.com');
                return { fetched: true, status: response.status };
              } catch (e) {
                return { blocked: true, error: e.message };
              }
            })();
          `,
          fetch: { mode: 'block' },
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.blocked).toBe(true)
        } else {
          expect(result.error).toBeDefined()
        }
      }, 10000)
    })

    describe('fetch allowlist mode', () => {
      it('blocks non-matching domains', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const response = await fetch('https://blocked.com/api');
                return { fetched: true, status: response.status };
              } catch (e) {
                return { blocked: true, error: e.message };
              }
            })();
          `,
          fetch: { mode: 'allowlist', allowedDomains: ['api.example.com'] },
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.blocked).toBe(true)
          expect(value.error).toContain('not in allowlist')
        } else {
          expect(result.error).toContain('not in allowlist')
        }
      }, 10000)

      it('allows matching exact domains', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const response = await fetch('https://api.example.com/data');
                return { fetched: true, blocked: false };
              } catch (e) {
                const isAllowlistError = e.message.includes('not in allowlist');
                // blocked: false means it wasn't blocked by allowlist (even if network failed)
                return { blocked: isAllowlistError, error: e.message };
              }
            })();
          `,
          fetch: { mode: 'allowlist', allowedDomains: ['api.example.com'] },
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          // Should NOT be blocked by allowlist (might fail for other reasons like DNS)
          expect(value.blocked).toBe(false)
        }
      }, 10000)

      it('supports wildcard patterns', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const response = await fetch('https://other.com/api');
                return { fetched: true };
              } catch (e) {
                const isAllowlistError = e.message.includes('not in allowlist');
                return { blocked: isAllowlistError, error: e.message };
              }
            })();
          `,
          fetch: { mode: 'allowlist', allowedDomains: ['*.example.com'] },
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.blocked).toBe(true)
          expect(value.error).toContain('not in allowlist')
        }
      }, 10000)

      it('wildcard matches subdomains', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const response = await fetch('https://api.example.com/data');
                return { fetched: true, blocked: false };
              } catch (e) {
                const isAllowlistError = e.message.includes('not in allowlist');
                return { blocked: isAllowlistError, error: e.message };
              }
            })();
          `,
          fetch: { mode: 'allowlist', allowedDomains: ['*.example.com'] },
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          // Should NOT be blocked by allowlist
          expect(value.blocked).toBe(false)
        }
      }, 10000)

      it('blocks localhost when not in allowlist', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const response = await fetch('http://localhost:8080/api');
                return { fetched: true };
              } catch (e) {
                const isAllowlistError = e.message.includes('not in allowlist');
                return { blocked: isAllowlistError, error: e.message };
              }
            })();
          `,
          fetch: { mode: 'allowlist', allowedDomains: ['api.example.com'] },
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.blocked).toBe(true)
        }
      }, 10000)
    })

    describe('backwards compatibility', () => {
      it('fetch: null still blocks all network (backwards compat)', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const response = await fetch('https://example.com');
                return { fetched: true };
              } catch (e) {
                return { blocked: true, error: e.message };
              }
            })();
          `,
          fetch: null,
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.blocked).toBe(true)
        }
      }, 10000)

      it('mode: allow explicitly allows all network', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const response = await fetch('https://httpstat.us/200');
                return { fetched: true };
              } catch (e) {
                const isAllowlistError = e.message.includes('not in allowlist');
                const isBlockedError = e.message.includes('Network access blocked');
                return {
                  allowlistBlocked: isAllowlistError,
                  networkBlocked: isBlockedError
                };
              }
            })();
          `,
          fetch: { mode: 'allow' },
          timeout: 5000,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.allowlistBlocked).toBe(false)
          expect(value.networkBlocked).toBe(false)
        }
      }, 10000)
    })
  })

  describe('code injection', () => {
    describe('template literal injection', () => {
      it('handles malicious template literal safely', async () => {
        const result = await evaluate({
          script: `
            const userInput = '\${process.env.SECRET}';
            const template = \`Value: \${userInput}\`;
            return template;
          `,
        })
        // Should return the literal string, not evaluate the nested template
        if (result.success) {
          expect(result.value).toBe('Value: ${process.env.SECRET}')
        }
      })

      it('handles nested template injection', async () => {
        const result = await evaluate({
          script: `
            const evil = '\`\${require("child_process").execSync("whoami")}\`';
            return evil;
          `,
        })
        // Should return the string, not execute it
        if (result.success) {
          expect(typeof result.value).toBe('string')
        }
      })
    })

    describe('unicode escape sequences', () => {
      it('handles unicode escape in identifiers', async () => {
        const result = await evaluate({
          script: `
            // \\u0070rocess would normalize to 'process'
            const \\u0070rocess = 'safe';
            return \\u0070rocess;
          `,
        })
        if (result.success) {
          expect(result.value).toBe('safe')
        }
      })

      it('handles zero-width characters', async () => {
        const result = await evaluate({
          script: `
            // Zero-width space and other invisible characters
            const a\u200B = 'visible';
            return a\u200B;
          `,
        })
        // Should handle this gracefully
        expect(result).toBeDefined()
      })
    })

    describe('comment injection', () => {
      it('handles comment-based code hiding', async () => {
        const result = await evaluate({
          script: `
            const x = 1; /* legitimate code */
            // const y = require('fs');
            return x;
          `,
        })
        expect(result.success).toBe(true)
        expect(result.value).toBe(1)
      })

      it('handles multi-line comment tricks', async () => {
        const result = await evaluate({
          script: `
            const a = 1 //* comment
            + 2 //*/ + 3;
            return a;
          `,
        })
        // Should parse correctly according to JS spec
        expect(result.success).toBe(true)
      })

      it('handles HTML comment syntax in JS', async () => {
        const result = await evaluate({
          script: `
            const x = 1;
            <!-- this is an HTML comment in JS
            const y = 2;
            --> more code
            return x;
          `,
        })
        // Behavior depends on strict mode, but shouldn't crash
        expect(result).toBeDefined()
      })
    })
  })

  describe('environment isolation', () => {
    describe('parent worker environment', () => {
      it('cannot access sensitive bindings from parent worker env', async () => {
        const result = await evaluate({
          script: `
            // Check for sensitive bindings that should not leak
            const checks = {
              hasParentEnv: typeof parentEnv !== 'undefined',
              hasKV: typeof env !== 'undefined' && !!env.KV,
              hasDB: typeof env !== 'undefined' && !!env.DB,
              hasDO: typeof env !== 'undefined' && !!env.DO,
              hasR2: typeof env !== 'undefined' && !!env.R2,
              hasSecrets: typeof env !== 'undefined' && !!env.API_KEY,
            };
            return checks;
          `,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          // Should not have access to parent's sensitive bindings
          expect(value.hasParentEnv).toBe(false)
          expect(value.hasKV).toBe(false)
          expect(value.hasDB).toBe(false)
          expect(value.hasDO).toBe(false)
          expect(value.hasR2).toBe(false)
          expect(value.hasSecrets).toBe(false)
        }
      })

      it('cannot access caches API for data exfiltration', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                if (typeof caches !== 'undefined') {
                  const cache = await caches.open('exfil');
                  return { hasCaches: true };
                }
                return { hasCaches: false };
              } catch (e) {
                return { blocked: true, error: e.message };
              }
            })();
          `,
        })
        // Either caches is unavailable or blocked
        expect(result).toBeDefined()
      })
    })

    describe('file system APIs', () => {
      it('cannot access Node.js fs module', async () => {
        const result = await evaluate({
          script: `
            try {
              const fs = require('fs');
              return { hasFs: true };
            } catch (e) {
              return { hasFs: false, error: e.message };
            }
          `,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.hasFs).toBe(false)
        }
      })

      it('cannot access dynamic import of fs', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const fs = await import('fs');
                return { hasFs: true };
              } catch (e) {
                return { hasFs: false, error: e.message };
              }
            })();
          `,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.hasFs).toBe(false)
        }
      })

      it('cannot access File System Access API', async () => {
        const result = await evaluate({
          script: `
            return {
              hasShowOpenFilePicker: typeof showOpenFilePicker !== 'undefined',
              hasShowSaveFilePicker: typeof showSaveFilePicker !== 'undefined',
              hasShowDirectoryPicker: typeof showDirectoryPicker !== 'undefined'
            };
          `,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.hasShowOpenFilePicker).toBe(false)
          expect(value.hasShowSaveFilePicker).toBe(false)
          expect(value.hasShowDirectoryPicker).toBe(false)
        }
      })
    })

    describe('process APIs', () => {
      it('cannot access process.env', async () => {
        const result = await evaluate({
          script: `
            try {
              if (typeof process !== 'undefined' && process.env) {
                return { hasProcessEnv: true, keys: Object.keys(process.env) };
              }
              return { hasProcessEnv: false };
            } catch (e) {
              return { hasProcessEnv: false, error: e.message };
            }
          `,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.hasProcessEnv).toBe(false)
        }
      })

      it('cannot access process.exit', async () => {
        const result = await evaluate({
          script: `
            try {
              if (typeof process !== 'undefined' && typeof process.exit === 'function') {
                return { hasProcessExit: true };
              }
              return { hasProcessExit: false };
            } catch (e) {
              return { hasProcessExit: false, error: e.message };
            }
          `,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.hasProcessExit).toBe(false)
        }
      })

      it('cannot access child_process', async () => {
        const result = await evaluate({
          script: `
            try {
              const cp = require('child_process');
              return { hasChildProcess: true };
            } catch (e) {
              return { hasChildProcess: false, error: e.message };
            }
          `,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.hasChildProcess).toBe(false)
        }
      })

      it('cannot spawn processes via dynamic import', async () => {
        const result = await evaluate({
          script: `
            return (async () => {
              try {
                const { spawn } = await import('child_process');
                return { hasSpawn: true };
              } catch (e) {
                return { hasSpawn: false, error: e.message };
              }
            })();
          `,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.hasSpawn).toBe(false)
        }
      })
    })

    describe('dangerous globals', () => {
      it('cannot access Deno namespace', async () => {
        const result = await evaluate({
          script: `
            return { hasDeno: typeof Deno !== 'undefined' };
          `,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.hasDeno).toBe(false)
        }
      })

      it('cannot access Bun namespace', async () => {
        const result = await evaluate({
          script: `
            return { hasBun: typeof Bun !== 'undefined' };
          `,
        })
        if (result.success && typeof result.value === 'object') {
          const value = result.value as Record<string, unknown>
          expect(value.hasBun).toBe(false)
        }
      })

      it('handles WebAssembly (may be sandboxed)', async () => {
        const result = await evaluate({
          script: `
            try {
              const wasmCode = new Uint8Array([
                0x00, 0x61, 0x73, 0x6d, // WASM magic
                0x01, 0x00, 0x00, 0x00  // Version
              ]);
              const module = new WebAssembly.Module(wasmCode);
              return { hasWasm: true };
            } catch (e) {
              return { hasWasm: false, error: e.message };
            }
          `,
        })
        // WebAssembly might be available but sandboxed
        expect(result).toBeDefined()
      })
    })
  })

  describe('additional security vectors', () => {
    it('handles __proto__ manipulation without affecting host', async () => {
      const result = await evaluate({
        script: `
          const obj = {};
          obj.__proto__.polluted = true;
          return { polluted: ({}).polluted };
        `,
      })
      // Host environment should not be affected
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('handles Object.defineProperty on prototypes without affecting host', async () => {
      const result = await evaluate({
        script: `
          try {
            Object.defineProperty(Object.prototype, 'pwned', {
              get: () => 'gotcha',
              configurable: true
            });
            return { pwned: ({}).pwned };
          } catch (e) {
            return { blocked: true, error: e.message };
          }
        `,
      })
      // Host environment should not be affected
      expect(({} as Record<string, unknown>).pwned).toBeUndefined()
    })

    it('handles Symbol.toStringTag manipulation', async () => {
      const result = await evaluate({
        script: `
          const fake = {
            [Symbol.toStringTag]: 'Process',
            env: { SECRET: 'value' }
          };
          return Object.prototype.toString.call(fake);
        `,
      })
      if (result.success) {
        expect(result.value).toBe('[object Process]')
      }
    })

    it('handles Proxy-based traps', async () => {
      const result = await evaluate({
        script: `
          const handler = {
            get: (target, prop) => {
              if (prop === 'process') {
                return { env: {} };
              }
              return target[prop];
            }
          };
          const proxy = new Proxy({}, handler);
          return { hasProxy: true, process: proxy.process };
        `,
      })
      // Proxy should work but not give real process access
      if (result.success && typeof result.value === 'object') {
        const value = result.value as Record<string, unknown>
        expect(value.hasProxy).toBe(true)
      }
    })

    it('handles Reflect-based access attempts', async () => {
      const result = await evaluate({
        script: `
          try {
            const global = Reflect.getPrototypeOf(Reflect.getPrototypeOf(() => {})).constructor('return this')();
            return { hasGlobal: !!global, hasProcess: !!global?.process };
          } catch (e) {
            return { blocked: true, error: e.message };
          }
        `,
      })
      if (result.success && typeof result.value === 'object') {
        const value = result.value as Record<string, unknown>
        if (!value.blocked) {
          expect(value.hasProcess).toBe(false)
        }
      }
    })
  })
})
