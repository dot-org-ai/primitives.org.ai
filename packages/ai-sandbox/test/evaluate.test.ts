import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { evaluate } from '../src/index.js'

describe('evaluate', () => {
  describe('script execution', () => {
    it('executes simple expressions', async () => {
      const result = await evaluate({
        script: 'return 1 + 1'
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(2)
    })

    it('captures console output', async () => {
      const result = await evaluate({
        script: `
          console.log('hello');
          console.warn('warning');
          console.error('error');
          return 'done';
        `
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe('done')
      expect(result.logs).toHaveLength(3)
      expect(result.logs[0].level).toBe('log')
      expect(result.logs[0].message).toBe('hello')
      expect(result.logs[1].level).toBe('warn')
      expect(result.logs[2].level).toBe('error')
    })

    it('handles script errors', async () => {
      const result = await evaluate({
        script: 'throw new Error("test error")'
      })
      expect(result.success).toBe(false)
      expect(result.error).toContain('test error')
    })
  })

  describe('module exports', () => {
    it('exposes exports to script', async () => {
      const result = await evaluate({
        module: `
          exports.add = (a, b) => a + b;
          exports.multiply = (a, b) => a * b;
        `,
        script: 'return add(2, 3) + multiply(4, 5)'
      })
      expect(result.success).toBe(true)
      expect(result.value).toBe(25) // 5 + 20
    })

    it('exposes exports to tests', async () => {
      const result = await evaluate({
        module: `
          exports.double = (n) => n * 2;
        `,
        tests: `
          describe('double', () => {
            it('doubles a number', () => {
              expect(double(5)).toBe(10);
            });
          });
        `
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.total).toBe(1)
      expect(result.testResults?.passed).toBe(1)
    })
  })

  describe('test framework', () => {
    it('runs passing tests', async () => {
      const result = await evaluate({
        tests: `
          describe('math', () => {
            it('adds', () => {
              expect(1 + 1).toBe(2);
            });
            it('subtracts', () => {
              expect(5 - 3).toBe(2);
            });
          });
        `
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.total).toBe(2)
      expect(result.testResults?.passed).toBe(2)
      expect(result.testResults?.failed).toBe(0)
    })

    it('reports failing tests', async () => {
      const result = await evaluate({
        tests: `
          it('fails', () => {
            expect(1).toBe(2);
          });
        `
      })
      expect(result.success).toBe(false)
      expect(result.testResults?.total).toBe(1)
      expect(result.testResults?.failed).toBe(1)
      expect(result.testResults?.tests[0].error).toContain('Expected 2')
    })

    it('supports skipped tests', async () => {
      const result = await evaluate({
        tests: `
          it.skip('skipped', () => {
            expect(1).toBe(2);
          });
          it('runs', () => {
            expect(1).toBe(1);
          });
        `
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.total).toBe(2)
      expect(result.testResults?.passed).toBe(1)
      expect(result.testResults?.skipped).toBe(1)
    })

    it('supports beforeEach hooks', async () => {
      const result = await evaluate({
        tests: `
          let count = 0;
          beforeEach(() => {
            count++;
          });
          it('first', () => {
            expect(count).toBe(1);
          });
          it('second', () => {
            expect(count).toBe(2);
          });
        `
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.passed).toBe(2)
    })

    it('supports async tests', async () => {
      const result = await evaluate({
        tests: `
          it('async test', async () => {
            const value = await Promise.resolve(42);
            expect(value).toBe(42);
          });
        `
      })
      expect(result.success).toBe(true)
      expect(result.testResults?.passed).toBe(1)
    })
  })

  describe('expect matchers', () => {
    it('toBe', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect(1).toBe(1);
            expect('a').toBe('a');
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toEqual', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect({ a: 1 }).toEqual({ a: 1 });
            expect([1, 2]).toEqual([1, 2]);
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toContain', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect([1, 2, 3]).toContain(2);
            expect('hello').toContain('ell');
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toThrow', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect(() => { throw new Error('boom'); }).toThrow('boom');
            expect(() => { throw new Error('boom'); }).toThrow(/boom/);
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toHaveProperty', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect({ a: { b: 1 } }).toHaveProperty('a.b');
            expect({ a: { b: 1 } }).toHaveProperty('a.b', 1);
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toMatchObject', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect({ a: 1, b: 2 }).toMatchObject({ a: 1 });
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('not matchers', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect(1).not.toBe(2);
            expect({ a: 1 }).not.toEqual({ a: 2 });
            expect([1, 2]).not.toContain(3);
          });
        `
      })
      expect(result.success).toBe(true)
    })

    it('toBeCloseTo', async () => {
      const result = await evaluate({
        tests: `
          it('works', () => {
            expect(0.1 + 0.2).toBeCloseTo(0.3);
          });
        `
      })
      expect(result.success).toBe(true)
    })
  })
})
