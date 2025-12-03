import { describe, it, expect } from 'vitest'
import { evaluate, createEvaluator } from '../src/index.js'

describe('evaluate - extended tests', () => {
  describe('edge cases', () => {
    it('handles empty options', async () => {
      const result = await evaluate({})
      expect(result.success).toBe(true)
      expect(result.logs).toEqual([])
    })

    it('handles undefined return', async () => {
      const result = await evaluate({
        script: 'const x = 1;'
      })
      expect(result.success).toBe(true)
      expect(result.value).toBeUndefined()
    })

    it('handles null return', async () => {
      const result = await evaluate({
        script: 'return null;'
      })
      expect(result.success).toBe(true)
      expect(result.value).toBeNull()
    })

    it('handles complex object return', async () => {
      const result = await evaluate({
        script: 'return { nested: { value: [1, 2, { a: 3 }] } };'
      })
      expect(result.success).toBe(true)
      expect(result.value).toEqual({ nested: { value: [1, 2, { a: 3 }] } })
    })

    it('handles array return', async () => {
      const result = await evaluate({
        script: 'return [1, "two", true, null];'
      })
      expect(result.success).toBe(true)
      expect(result.value).toEqual([1, 'two', true, null])
    })
  })

  describe('module errors', () => {
    it('fails on module syntax errors', async () => {
      const result = await evaluate({
        module: 'exports.foo = {;'
      })
      // Syntax errors cause the entire worker to fail to parse
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('captures module runtime errors', async () => {
      const result = await evaluate({
        module: 'throw new Error("module error");'
      })
      expect(result.logs.some(l => l.message.includes('Module error'))).toBe(true)
    })
  })

  describe('console methods', () => {
    it('captures console.info', async () => {
      const result = await evaluate({
        script: 'console.info("info message"); return true;'
      })
      expect(result.logs).toContainEqual(expect.objectContaining({
        level: 'info',
        message: 'info message'
      }))
    })

    it('captures console.debug', async () => {
      const result = await evaluate({
        script: 'console.debug("debug message"); return true;'
      })
      expect(result.logs).toContainEqual(expect.objectContaining({
        level: 'debug',
        message: 'debug message'
      }))
    })

    it('stringifies objects in console output', async () => {
      const result = await evaluate({
        script: 'console.log({ a: 1 }); return true;'
      })
      expect(result.logs[0].message).toBe('{"a":1}')
    })

    it('joins multiple console arguments', async () => {
      const result = await evaluate({
        script: 'console.log("a", "b", "c"); return true;'
      })
      expect(result.logs[0].message).toBe('a b c')
    })
  })

  describe('async scripts', () => {
    it('handles Promise return values', async () => {
      const result = await evaluate({
        script: `
          return Promise.resolve(42).then(v => v * 2);
        `
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(84)
    })

    it('handles Promise rejection in script', async () => {
      const result = await evaluate({
        script: 'return Promise.reject(new Error("async error"));'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('async error')
    })

    it('handles async IIFE', async () => {
      const result = await evaluate({
        script: `
          return (async () => {
            const value = await Promise.resolve(42);
            return value * 2;
          })();
        `
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(84)
    })
  })

  describe('test framework - additional matchers', () => {
    it('toBeTruthy', async () => {
      const result = await evaluate({
        tests: `
          it('truthy values', () => {
            expect(1).toBeTruthy();
            expect("a").toBeTruthy();
            expect({}).toBeTruthy();
            expect([]).toBeTruthy();
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toBeFalsy', async () => {
      const result = await evaluate({
        tests: `
          it('falsy values', () => {
            expect(0).toBeFalsy();
            expect("").toBeFalsy();
            expect(null).toBeFalsy();
            expect(undefined).toBeFalsy();
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toBeNull', async () => {
      const result = await evaluate({
        tests: `
          it('null check', () => {
            expect(null).toBeNull();
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toBeUndefined', async () => {
      const result = await evaluate({
        tests: `
          it('undefined check', () => {
            expect(undefined).toBeUndefined();
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toBeDefined', async () => {
      const result = await evaluate({
        tests: `
          it('defined check', () => {
            expect(0).toBeDefined();
            expect("").toBeDefined();
            expect(null).toBeDefined();
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toBeNaN', async () => {
      const result = await evaluate({
        tests: `
          it('NaN check', () => {
            expect(NaN).toBeNaN();
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toContainEqual', async () => {
      const result = await evaluate({
        tests: `
          it('containEqual check', () => {
            expect([{ a: 1 }, { b: 2 }]).toContainEqual({ a: 1 });
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toStrictEqual', async () => {
      const result = await evaluate({
        tests: `
          it('strict equal check', () => {
            expect({ a: 1, b: 2 }).toStrictEqual({ a: 1, b: 2 });
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toBeGreaterThan', async () => {
      const result = await evaluate({
        tests: `
          it('greater than check', () => {
            expect(10).toBeGreaterThan(5);
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toBeLessThan', async () => {
      const result = await evaluate({
        tests: `
          it('less than check', () => {
            expect(5).toBeLessThan(10);
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toBeGreaterThanOrEqual', async () => {
      const result = await evaluate({
        tests: `
          it('greater or equal check', () => {
            expect(10).toBeGreaterThanOrEqual(10);
            expect(10).toBeGreaterThanOrEqual(5);
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toBeLessThanOrEqual', async () => {
      const result = await evaluate({
        tests: `
          it('less or equal check', () => {
            expect(10).toBeLessThanOrEqual(10);
            expect(5).toBeLessThanOrEqual(10);
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toMatch with string', async () => {
      const result = await evaluate({
        tests: `
          it('match check', () => {
            expect("hello world").toMatch("world");
            expect("hello world").toMatch(/world/);
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toBeInstanceOf', async () => {
      const result = await evaluate({
        tests: `
          it('instanceof check', () => {
            expect(new Error()).toBeInstanceOf(Error);
            expect([]).toBeInstanceOf(Array);
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toBeTypeOf', async () => {
      const result = await evaluate({
        tests: `
          it('typeof check', () => {
            expect("hello").toBeTypeOf("string");
            expect(42).toBeTypeOf("number");
            expect(true).toBeTypeOf("boolean");
            expect({}).toBeTypeOf("object");
            expect(() => {}).toBeTypeOf("function");
          });
        `
      })
      expect(result.success).toBe(true)
    })
  })

  describe('test framework - hooks', () => {
    it('afterEach', async () => {
      const result = await evaluate({
        tests: `
          let cleanupCount = 0;
          afterEach(() => {
            cleanupCount++;
          });
          it('first', () => {
            expect(cleanupCount).toBe(0);
          });
          it('second', () => {
            expect(cleanupCount).toBe(1);
          });
        `
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.passed).toBe(2)
    })

    it('nested describes with hooks', async () => {
      const result = await evaluate({
        tests: `
          let outer = 0;
          let inner = 0;
          describe('outer', () => {
            beforeEach(() => { outer++; });
            it('outer test', () => {
              expect(outer).toBe(1);
              expect(inner).toBe(0);
            });
            describe('inner', () => {
              beforeEach(() => { inner++; });
              it('inner test', () => {
                expect(outer).toBe(2);
                expect(inner).toBe(1);
              });
            });
          });
        `
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.passed).toBe(2)
    })
  })

  describe('test framework - only', () => {
    it('runs only marked tests', async () => {
      const result = await evaluate({
        tests: `
          it('should not run', () => {
            expect(1).toBe(2); // would fail
          });
          it.only('should run', () => {
            expect(1).toBe(1);
          });
        `
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.total).toBe(1)
    })

    it('test.only works', async () => {
      const result = await evaluate({
        tests: `
          test('should not run', () => {
            expect(1).toBe(2);
          });
          test.only('should run', () => {
            expect(1).toBe(1);
          });
        `
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.total).toBe(1)
    })
  })

  describe('test framework - resolves/rejects', () => {
    it('resolves matcher', async () => {
      const result = await evaluate({
        tests: `
          it('resolves', async () => {
            await expect(Promise.resolve(42)).resolves.toBe(42);
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('rejects matcher', async () => {
      const result = await evaluate({
        tests: `
          it('rejects', async () => {
            await expect(Promise.reject(new Error('fail'))).rejects.toBeInstanceOf(Error);
          });
        `
      })
      expect(result.success).toBe(true)
    })
  })

  describe('test framework - error messages', () => {
    it('provides descriptive error for toBe failure', async () => {
      const result = await evaluate({
        tests: `
          it('fails', () => {
            expect(1).toBe(2);
          });
        `
      })
      expect(result.success).toBe(false)
      expect(result.testResults?.tests[0].error).toContain('Expected')
      expect(result.testResults?.tests[0].error).toContain('2')
    })

    it('provides descriptive error for toEqual failure', async () => {
      const result = await evaluate({
        tests: `
          it('fails', () => {
            expect({ a: 1 }).toEqual({ a: 2 });
          });
        `
      })
      expect(result.success).toBe(false)
      expect(result.testResults?.tests[0].error).toBeDefined()
    })

    it('provides descriptive error for toContain failure', async () => {
      const result = await evaluate({
        tests: `
          it('fails', () => {
            expect([1, 2, 3]).toContain(4);
          });
        `
      })
      expect(result.success).toBe(false)
      expect(result.testResults?.tests[0].error).toContain('contain')
    })
  })
})

describe('createEvaluator', () => {
  it('returns a function', () => {
    const evaluator = createEvaluator({})
    expect(typeof evaluator).toBe('function')
  })

  it('returned function works like evaluate', async () => {
    const evaluator = createEvaluator({})
    const result = await evaluator({ script: 'return 42;' })
    expect(result.success).toBe(true)
    expect(result.value).toBe(42)
  })
})
