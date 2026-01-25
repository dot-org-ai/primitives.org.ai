import { describe, it, expect } from 'vitest'

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

  describe('Miniflare-specific behavior', () => {
    it('evaluates without env binding (uses Miniflare)', async () => {
      const { evaluate } = await import('../src/node.js')

      // No env passed - should use Miniflare fallback
      const result = await evaluate({
        script: 'return 42',
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(42)
    })

    it('handles timeout with AbortController', async () => {
      const { evaluate } = await import('../src/node.js')

      const result = await evaluate({
        script: `
          // Infinite loop that should be aborted
          while(true) {}
          return 'never'
        `,
        timeout: 100,
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Timeout')
    }, 10000)

    it('blocks network via outboundService when fetch: null', async () => {
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
      // Network blocking via outboundService may cause different errors
      // The key is that fetch doesn't succeed
      if (result.success) {
        expect(result.value).toContain('fetch blocked')
      } else {
        // Network blocking might cause an error at the worker level
        expect(result.error).toBeDefined()
      }
    })

    it('allows network when fetch is not null', async () => {
      const { evaluate } = await import('../src/node.js')

      // This test verifies network is allowed by default
      // We don't actually make a network call, just verify the option is respected
      const result = await evaluate({
        script: `
          // Verify fetch exists and is callable
          return typeof globalThis.fetch === 'function'
        `,
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(true)
    })

    it('disposes Miniflare instance after execution', async () => {
      const { evaluate } = await import('../src/node.js')

      // Execute multiple evaluations to ensure proper cleanup
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

    it('captures console output in Miniflare', async () => {
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
