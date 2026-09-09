/**
 * Security tests for ai-evaluate sandbox
 *
 * Tests various sandbox escape attempts, resource exhaustion,
 * and code injection. Network and environment isolation are witnessed against
 * the real worker_loaders binding in test/workers/security.workers.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { evaluate } from '../src/node.js'

describe('security', () => {
  describe('environment isolation (local host worker)', () => {
    // Strict: a failed evaluation is a failed test, never a silent pass.
    it('cannot access sensitive bindings from parent worker env', async () => {
      const result = await evaluate({
        script: `
          return {
            hasParentEnv: typeof parentEnv !== 'undefined',
            hasLoader: typeof env !== 'undefined' && !!env.loader,
            hasKV: typeof env !== 'undefined' && !!env.KV,
            hasDB: typeof env !== 'undefined' && !!env.DB,
            hasDO: typeof env !== 'undefined' && !!env.DO,
            hasR2: typeof env !== 'undefined' && !!env.R2,
            hasSecrets: typeof env !== 'undefined' && !!env.API_KEY,
          };
        `,
      })
      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.value).toEqual({
        hasParentEnv: false,
        hasLoader: false,
        hasKV: false,
        hasDB: false,
        hasDO: false,
        hasR2: false,
        hasSecrets: false,
      })
    })
  })

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
      // A synchronous loop cannot be interrupted from JS, and local workerd
      // enforces no CPU limit (aip-263g.14). Locally the contract is the Node
      // backstop in src/node.ts: the request is aborted at timeout + grace and
      // the wedged host is replaced, so each case below also pays a fresh host
      // start (~1s) for the next evaluation. On Cloudflare the loaded worker's
      // `limits.cpuMs` (bound to `timeout`) ends the loop instead.

      it('terminates infinite while loop', async () => {
        const result = await evaluate({
          script: 'while(true){}',
          timeout: 500,
        })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/^Timeout: Script execution exceeded 500ms/)
      }, 20000)

      it('terminates infinite for loop', async () => {
        const result = await evaluate({
          script: 'for(;;){}',
          timeout: 500,
        })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/^Timeout: Script execution exceeded 500ms/)
      }, 20000)

      it('terminates busy loop', async () => {
        const result = await evaluate({
          script: `
            let i = 0;
            while(true) { i++; }
            return i;
          `,
          timeout: 500,
        })
        expect(result.success).toBe(false)
        expect(result.error).toMatch(/^Timeout: Script execution exceeded 500ms/)
      }, 20000)

      it('recovers: the next evaluation runs on a fresh host', async () => {
        const result = await evaluate({ script: 'return "recovered"' })
        expect(result.success).toBe(true)
        expect(result.value).toBe('recovered')
      }, 20000)
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
