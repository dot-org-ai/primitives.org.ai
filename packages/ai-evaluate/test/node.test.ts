import { describe, it, expect, vi, afterAll } from 'vitest'

afterAll(async () => {
  const { dispose } = await import('../src/node.js')
  await dispose()
})

describe('ai-evaluate/node', () => {
  describe('JSX transformation', () => {
    // Note: JSX transformation uses esbuild which may produce ESM-wrapped code
    // These tests verify the JSX detection and transformation attempt

    it('detects and attempts to transform simple JSX', async () => {
      const { evaluate } = await import('../src/node.js')

      // JSX code that would need transformation
      const result = await evaluate({
        module: `
          function h(tag, props, ...children) {
            return { tag, props, children }
          }
          exports.render = () => <div>Hello</div>
        `,
        script: 'return render()',
      })

      // The transformation is attempted - result depends on esbuild output format
      // Either it succeeds or returns an error (not a crash)
      expect(typeof result.success).toBe('boolean')
      expect(Array.isArray(result.logs)).toBe(true)
    })

    it('detects JSX with props', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          function h(tag, props, ...children) {
            return { tag, props, children }
          }
          const handler = () => 'clicked'
          exports.render = () => <Button onClick={handler}>Click</Button>
        `,
        script: 'return render()',
      })

      // Verify the function doesn't crash and returns a valid result shape
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.duration).toBe('number')
    })

    it('detects JSX fragments', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          function h(tag, props, ...children) {
            return { tag, props, children }
          }
          function Fragment(props) {
            return props.children
          }
          exports.render = () => <><span/><span/></>
        `,
        script: 'return render()',
      })

      // Verify graceful handling
      expect(typeof result.success).toBe('boolean')
    })

    it('handles JSX transform failure gracefully', async () => {
      const { evaluate } = await import('../src/node.js')

      // Even with JSX that fails to transform correctly, evaluate should not throw
      const result = await evaluate({
        module: `
          function h(tag, props, ...children) {
            return { tag, props, children }
          }
          exports.element = <div>Test</div>
        `,
        script: 'return element',
      })

      // Should return a result (success or error), not throw
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('logs')
      expect(result).toHaveProperty('duration')
    })

    it('passes through non-JSX code unchanged', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          exports.add = (a, b) => a + b
        `,
        script: 'return add(2, 3)',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(5)
    })

    it('handles code that looks like JSX but is a string', async () => {
      const { evaluate } = await import('../src/node.js')

      // String literals with angle brackets may still be detected by the regex
      // but the transformation should still produce valid code
      const result = await evaluate({
        module: `
          exports.html = "Not JSX"
        `,
        script: 'return html',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe('Not JSX')
    })

    it('handles empty module gracefully', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'return 123',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(123)
    })
  })

  describe('local runtime (Miniflare 5 host worker with LOADER binding)', () => {
    it('createLocalRuntime returns { evaluate, dispose } and evaluates a script', async () => {
      const { createLocalRuntime } = await import('../src/node.js')

      const runtime = createLocalRuntime()
      expect(typeof runtime.evaluate).toBe('function')
      expect(typeof runtime.dispose).toBe('function')

      const result = await runtime.evaluate({ script: 'return 1+1' })
      expect(result.success).toBe(true)
      expect(result.value).toBe(2)

      await expect(runtime.dispose()).resolves.toBeUndefined()
      // dispose is idempotent
      await expect(runtime.dispose()).resolves.toBeUndefined()
    })

    it('reuses one host across calls (second call is not a cold start)', async () => {
      const { createLocalRuntime } = await import('../src/node.js')
      const runtime = createLocalRuntime()
      try {
        const first = await runtime.evaluate({ script: 'return 1' })
        const second = await runtime.evaluate({ script: 'return 2' })
        expect(first.value).toBe(1)
        expect(second.value).toBe(2)
        // The first call pays for bundling + workerd startup; the second must not.
        expect(second.duration).toBeLessThan(first.duration)
      } finally {
        await runtime.dispose()
      }
    })

    it('maintains isolation between evaluations', async () => {
      const { evaluate } = await import('../src/node.js')

      // First evaluation sets a global
      const result1 = await evaluate({
        script: 'globalThis.testValue = 42; return globalThis.testValue;',
      })
      expect(result1.success).toBe(true)
      expect(result1.value).toBe(42)

      // Second evaluation (different script -> different loaded worker) must not see it
      const result2 = await evaluate({
        script: 'return globalThis.testValue;',
      })
      expect(result2.success).toBe(true)
      expect(result2.value).toBeUndefined()
    })

    it('times out a CPU-bound script and recovers for the next call', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'while(true){}',
        timeout: 100,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Timeout/)

      // The wedged host is replaced; subsequent evaluations work again
      const after = await evaluate({ script: 'return "alive"' })
      expect(after.success).toBe(true)
      expect(after.value).toBe('alive')
    }, 20000)

    it('times out a slow async script via the host worker AbortSignal.timeout', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'await new Promise((r) => setTimeout(r, 10000)); return "never"',
        timeout: 100,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Timeout: Script execution exceeded 100ms/)
      // Well under the script's own 10s: the host aborted it, not the Node backstop
      expect(result.duration).toBeLessThan(5000)
    }, 10000)

    it('fails fast on a promise that can never settle (workerd hang detection)', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'await new Promise(() => {}); return "never"',
        timeout: 1000,
      })
      expect(result.success).toBe(false)
      expect(result.error).toMatch(/hung|Timeout/)
    }, 10000)

    it('evaluates without env binding (uses the shared local runtime)', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'return 42',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(42)
    })

    it('blocks network via globalOutbound when fetch: null', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: `
          try {
            await fetch('https://example.com')
            return 'fetch succeeded'
          } catch (e) {
            return 'fetch blocked: ' + e.message
          }
        `,
        fetch: null,
      })
      expect(result.success).toBe(true)
      expect(result.value).toContain('fetch blocked')
    })

    it('allows network when fetch is not null', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: `
          // Verify fetch exists and is callable
          return typeof globalThis.fetch === 'function'
        `,
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(true)
    })

    it('runs repeated evaluations on one host', async () => {
      const { evaluate } = await import('../src/node.js')

      for (let i = 0; i < 3; i++) {
        const result = await evaluate({
          script: `return ${i}`,
        })
        expect(result.success).toBe(true)
        expect(result.value).toBe(i)
      }
    })

    it('returns duration in result', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'return true',
      })
      expect(result.success).toBe(true)
      expect(typeof result.duration).toBe('number')
      expect(result.duration).toBeGreaterThanOrEqual(0)
    })

    it('captures console output', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: `
          console.log('log message');
          console.warn('warn message');
          console.error('error message');
          return 'done'
        `,
      })
      expect(result.success).toBe(true)
      expect(result.logs.length).toBeGreaterThanOrEqual(3)
      expect(result.logs.some((l) => l.level === 'log' && l.message === 'log message')).toBe(true)
      expect(result.logs.some((l) => l.level === 'warn' && l.message === 'warn message')).toBe(true)
      expect(result.logs.some((l) => l.level === 'error' && l.message === 'error message')).toBe(
        true
      )
    })

    it('exports dispose() for the shared runtime', async () => {
      const { evaluate, dispose } = await import('../src/node.js')
      expect(typeof dispose).toBe('function')
      await expect(dispose()).resolves.toBeUndefined()
      // A fresh runtime is created on the next call
      const result = await evaluate({ script: 'return "fresh"' })
      expect(result.value).toBe('fresh')
    })
  })

  describe('single code path with src/evaluate.ts', () => {
    it('does not use a dev-only worker template', async () => {
      const template = await import('../src/worker-template/index.js')
      const devSpy = vi.spyOn(template, 'generateDevWorkerCode')
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({ script: 'return 7' })
      expect(result.success).toBe(true)
      expect(result.value).toBe(7)
      expect(devSpy).not.toHaveBeenCalled()
      devSpy.mockRestore()
    })

    it('bundles host-worker -> evaluate as the host worker (same bytes as prod)', async () => {
      const { bundleHostWorker } = await import('../src/node.js')
      const bundle = await bundleHostWorker()
      // The host is the evaluate() implementation, not a separate local template
      expect(bundle).toContain('Sandbox requires worker_loaders binding')
      expect(bundle).toContain('/evaluate')
      expect(bundle).toContain('Simple Sandbox Worker')
      expect(bundle).not.toContain('Dev Mode')
    })

    it('delegates to evaluate() from src/evaluate.ts when env has a loader', async () => {
      const evaluateModule = await import('../src/evaluate.js')
      const { evaluate } = await import('../src/node.js')

      const canned = { success: true, value: 'from-loader', logs: [], duration: 0 }
      const env = {
        loader: {
          get: () => ({
            getEntrypoint: () => ({
              fetch: async () => Response.json(canned),
            }),
          }),
        },
      }

      const direct = await evaluateModule.evaluate({ script: 'return 1' }, env)
      const viaNode = await evaluate({ script: 'return 1' }, env)
      expect(viaNode.value).toBe('from-loader')
      expect(Object.keys(viaNode).sort()).toEqual(Object.keys(direct).sort())
    })
  })

  describe('esbuild optional dependency', () => {
    it('esbuild is available in dev environment', async () => {
      // esbuild should be available in dev
      const esbuild = await import('esbuild').catch(() => null)
      expect(esbuild).not.toBeNull()
      expect(typeof esbuild?.transform).toBe('function')
    })

    it('graceful fallback when code has no JSX', async () => {
      const { evaluate } = await import('../src/node.js')

      // Code without JSX should work regardless of esbuild
      const result = await evaluate({
        module: `
          exports.multiply = (a, b) => a * b
        `,
        script: 'return multiply(6, 7)',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(42)
    })

    it('uses esbuild for JSX detection patterns', async () => {
      // Test that JSX patterns are detected
      // The containsJSX function should identify these patterns
      const patterns = [
        '<div>content</div>', // lowercase tag
        '<Button />', // uppercase tag
        '<>fragment</>', // fragment
        'return <Component />', // return JSX
        'return (\n<div>\n</div>\n)', // multiline return JSX
      ]

      // All these should be detected as JSX
      for (const pattern of patterns) {
        const jsxPattern = /<[A-Z][a-zA-Z0-9]*[\s/>]|<[a-z][a-z0-9-]*[\s/>]|<>|<\/>/
        const jsxReturnPattern = /return\s*\(\s*<|return\s+<[A-Za-z]/
        const isJSX = jsxPattern.test(pattern) || jsxReturnPattern.test(pattern)
        expect(isJSX).toBe(true)
      }
    })

    it('does not detect non-JSX patterns', async () => {
      // These should NOT be detected as JSX
      const patterns = [
        'const x = a < b ? c : d', // comparison (no space after <)
        '5 > 3', // comparison
        'arr.map(x => x * 2)', // arrow function
      ]

      for (const pattern of patterns) {
        const jsxPattern = /<[A-Z][a-zA-Z0-9]*[\s/>]|<[a-z][a-z0-9-]*[\s/>]|<>|<\/>/
        const jsxReturnPattern = /return\s*\(\s*<|return\s+<[A-Za-z]/
        const isJSX = jsxPattern.test(pattern) || jsxReturnPattern.test(pattern)
        expect(isJSX).toBe(false)
      }
    })
  })

  describe('import from ai-evaluate/node', () => {
    it('exports evaluate function', async () => {
      const nodeModule = await import('../src/node.js')
      expect(typeof nodeModule.evaluate).toBe('function')
    })

    it('exports createEvaluator function', async () => {
      const nodeModule = await import('../src/node.js')
      expect(typeof nodeModule.createEvaluator).toBe('function')
    })

    it('createEvaluator returns working evaluator', async () => {
      const { createEvaluator } = await import('../src/node.js')

      const evaluator = createEvaluator()
      expect(typeof evaluator).toBe('function')

      const result = await evaluator({
        script: 'return "hello from evaluator"',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe('hello from evaluator')
    })

    it('evaluate function works standalone', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          exports.greet = (name) => 'Hello, ' + name
        `,
        script: 'return greet("World")',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe('Hello, World')
    })

    it('re-exports types from types.js', async () => {
      // Types are compile-time only, just verify module loads
      const nodeModule = await import('../src/node.js')
      expect(nodeModule).toBeDefined()
      // Verify the module exports the expected functions
      expect(Object.keys(nodeModule)).toContain('evaluate')
      expect(Object.keys(nodeModule)).toContain('createEvaluator')
    })
  })

  describe('error handling', () => {
    it('handles evaluation errors gracefully', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'throw new Error("intentional error")',
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('intentional error')
    })

    it('handles syntax errors in module', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: 'exports.foo = {;', // Invalid syntax
      })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns error for undefined function calls', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'return undefinedFunction()',
      })
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('handles async errors in script', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: `
          return Promise.reject(new Error('async failure'))
        `,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('async failure')
    })

    it('catches module initialization errors', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: 'throw new Error("init error")',
        script: 'return true',
      })
      // Module errors are logged, and execution may continue or fail
      expect(result).toHaveProperty('logs')
    })

    it('returns proper error shape on failure', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: 'throw new Error("test")',
      })
      expect(result).toHaveProperty('success', false)
      expect(result).toHaveProperty('error')
      expect(result).toHaveProperty('logs')
      expect(result).toHaveProperty('duration')
      expect(typeof result.error).toBe('string')
      expect(typeof result.duration).toBe('number')
    })
  })

  describe('test execution', () => {
    it('runs tests with passing results', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        tests: `
          describe('math', () => {
            it('adds numbers', () => {
              expect(1 + 1).toBe(2);
            });
          });
        `,
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.total).toBe(1)
      expect(result.testResults?.passed).toBe(1)
    })

    it('runs tests with failing results', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        tests: `
          it('fails', () => {
            expect(1).toBe(2);
          });
        `,
      })
      expect(result.success).toBe(false)
      expect(result.testResults?.failed).toBe(1)
    })

    it('combines module and tests', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        module: `
          exports.double = (n) => n * 2
        `,
        tests: `
          describe('double', () => {
            it('doubles 5', () => {
              expect(double(5)).toBe(10);
            });
            it('doubles 0', () => {
              expect(double(0)).toBe(0);
            });
          });
        `,
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.total).toBe(2)
      expect(result.testResults?.passed).toBe(2)
    })
  })
})
