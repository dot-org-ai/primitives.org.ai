import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TestRunner, createRunner } from '../src/runner.js'

describe('TestRunner', () => {
  let runner: TestRunner

  beforeEach(() => {
    runner = createRunner()
  })

  describe('createRunner()', () => {
    it('creates a new TestRunner instance', () => {
      expect(runner).toBeInstanceOf(TestRunner)
    })
  })

  describe('describe()', () => {
    it('groups tests with a suite name', async () => {
      runner.describe('math', () => {
        runner.it('adds', () => {})
      })

      const results = await runner.run()
      expect(results.tests[0].name).toBe('math > adds')
    })

    it('supports nested describes', async () => {
      runner.describe('outer', () => {
        runner.describe('inner', () => {
          runner.it('test', () => {})
        })
      })

      const results = await runner.run()
      expect(results.tests[0].name).toBe('outer > inner > test')
    })

    it('restores previous suite after describe', async () => {
      runner.describe('first', () => {
        runner.it('test1', () => {})
      })
      runner.it('standalone', () => {})

      const results = await runner.run()
      expect(results.tests[0].name).toBe('first > test1')
      expect(results.tests[1].name).toBe('standalone')
    })
  })

  describe('it()', () => {
    it('registers a test', async () => {
      runner.it('my test', () => {})

      const results = await runner.run()
      expect(results.total).toBe(1)
      expect(results.tests[0].name).toBe('my test')
    })

    it('test() is alias for it()', async () => {
      runner.test('my test', () => {})

      const results = await runner.run()
      expect(results.total).toBe(1)
    })

    it('passes for successful tests', async () => {
      runner.it('passes', () => {
        // No error
      })

      const results = await runner.run()
      expect(results.passed).toBe(1)
      expect(results.failed).toBe(0)
    })

    it('fails for throwing tests', async () => {
      runner.it('fails', () => {
        throw new Error('test error')
      })

      const results = await runner.run()
      expect(results.passed).toBe(0)
      expect(results.failed).toBe(1)
      expect(results.tests[0].error).toContain('test error')
    })

    it('supports async tests', async () => {
      runner.it('async', async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const results = await runner.run()
      expect(results.passed).toBe(1)
    })

    it('catches async errors', async () => {
      runner.it('async fail', async () => {
        await Promise.reject(new Error('async error'))
      })

      const results = await runner.run()
      expect(results.failed).toBe(1)
      expect(results.tests[0].error).toContain('async error')
    })
  })

  describe('skip()', () => {
    it('marks test as skipped', async () => {
      runner.skip('skipped test', () => {
        throw new Error('should not run')
      })

      const results = await runner.run()
      expect(results.total).toBe(1)
      expect(results.skipped).toBe(1)
      expect(results.passed).toBe(0)
      expect(results.failed).toBe(0)
      expect(results.tests[0].skipped).toBe(true)
    })

    it('works without fn argument', async () => {
      runner.skip('skipped')

      const results = await runner.run()
      expect(results.skipped).toBe(1)
    })
  })

  describe('only()', () => {
    it('runs only marked tests', async () => {
      runner.it('normal', () => {})
      runner.only('only', () => {})

      const results = await runner.run()
      expect(results.total).toBe(1)
      expect(results.tests[0].name).toBe('only')
    })

    it('still includes skipped tests when only is used', async () => {
      runner.it('normal', () => {})
      runner.only('only', () => {})
      runner.skip('skipped', () => {})

      const results = await runner.run()
      expect(results.total).toBe(2)
      expect(results.tests.find(t => t.name === 'only')).toBeDefined()
      expect(results.tests.find(t => t.name === 'skipped')).toBeDefined()
    })
  })

  describe('beforeEach()', () => {
    it('runs before each test', async () => {
      let count = 0
      runner.beforeEach(() => {
        count++
      })
      runner.it('test1', () => {})
      runner.it('test2', () => {})

      await runner.run()
      expect(count).toBe(2)
    })

    it('hooks are scoped to describe blocks', async () => {
      let count = 0
      runner.describe('suite', () => {
        runner.beforeEach(() => {
          count++
        })
        runner.it('inside', () => {})
      })
      runner.it('outside', () => {})

      await runner.run()
      expect(count).toBe(1)
    })

    it('supports async hooks', async () => {
      let value = 0
      runner.beforeEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        value = 42
      })
      runner.it('test', () => {
        if (value !== 42) throw new Error('hook did not run')
      })

      const results = await runner.run()
      expect(results.passed).toBe(1)
    })
  })

  describe('afterEach()', () => {
    it('runs after each test', async () => {
      let count = 0
      runner.afterEach(() => {
        count++
      })
      runner.it('test1', () => {})
      runner.it('test2', () => {})

      await runner.run()
      expect(count).toBe(2)
    })

    it('runs only for passing tests (current behavior)', async () => {
      let count = 0
      runner.afterEach(() => {
        count++
      })
      runner.it('passing', () => {})
      runner.it('failing', () => {
        throw new Error('fail')
      })

      await runner.run()
      // Currently afterEach only runs for passing tests
      expect(count).toBe(1)
    })
  })

  describe('beforeAll()', () => {
    it('runs once before all tests', async () => {
      let count = 0
      runner.beforeAll(() => {
        count++
      })
      runner.it('test1', () => {})
      runner.it('test2', () => {})

      await runner.run()
      expect(count).toBe(1)
    })

    it('fails all tests if beforeAll throws', async () => {
      runner.beforeAll(() => {
        throw new Error('setup failed')
      })
      runner.it('test1', () => {})
      runner.it('test2', () => {})

      const results = await runner.run()
      expect(results.failed).toBe(2)
      expect(results.tests[0].error).toContain('beforeAll hook failed')
      expect(results.tests[1].error).toContain('beforeAll hook failed')
    })

    it('supports async hooks', async () => {
      let value = 0
      runner.beforeAll(async () => {
        await new Promise(resolve => setTimeout(resolve, 1))
        value = 42
      })
      runner.it('test', () => {
        if (value !== 42) throw new Error('hook did not run')
      })

      const results = await runner.run()
      expect(results.passed).toBe(1)
    })
  })

  describe('afterAll()', () => {
    it('runs once after all tests', async () => {
      let count = 0
      runner.afterAll(() => {
        count++
      })
      runner.it('test1', () => {})
      runner.it('test2', () => {})

      await runner.run()
      expect(count).toBe(1)
    })

    it('runs even if tests fail', async () => {
      let ran = false
      runner.afterAll(() => {
        ran = true
      })
      runner.it('failing', () => {
        throw new Error('fail')
      })

      await runner.run()
      expect(ran).toBe(true)
    })

    it('does not fail tests if afterAll throws', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      runner.it('test', () => {})
      runner.afterAll(() => {
        throw new Error('cleanup failed')
      })

      const results = await runner.run()
      expect(results.passed).toBe(1)
      expect(results.failed).toBe(0)

      consoleSpy.mockRestore()
    })
  })

  describe('reset()', () => {
    it('clears all tests', async () => {
      runner.it('test', () => {})
      runner.reset()

      const results = await runner.run()
      expect(results.total).toBe(0)
    })

    it('clears all hooks', async () => {
      let count = 0
      runner.beforeEach(() => { count++ })
      runner.afterEach(() => { count++ })
      runner.beforeAll(() => { count++ })
      runner.afterAll(() => { count++ })
      runner.reset()
      runner.it('test', () => {})

      await runner.run()
      expect(count).toBe(0)
    })

    it('clears current suite', async () => {
      runner.describe('suite', () => {
        runner.reset()
        runner.it('test', () => {})
      })

      const results = await runner.run()
      expect(results.tests[0].name).toBe('test')
    })
  })

  describe('run()', () => {
    it('returns correct totals', async () => {
      runner.it('pass1', () => {})
      runner.it('pass2', () => {})
      runner.it('fail', () => { throw new Error() })
      runner.skip('skip', () => {})

      const results = await runner.run()
      expect(results.total).toBe(4)
      expect(results.passed).toBe(2)
      expect(results.failed).toBe(1)
      expect(results.skipped).toBe(1)
    })

    it('tracks test durations', async () => {
      runner.it('test', async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const results = await runner.run()
      expect(results.tests[0].duration).toBeGreaterThanOrEqual(10)
    })

    it('tracks total duration', async () => {
      runner.it('test', async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
      })

      const results = await runner.run()
      expect(results.duration).toBeGreaterThanOrEqual(10)
    })

    it('returns empty results for no tests', async () => {
      const results = await runner.run()
      expect(results.total).toBe(0)
      expect(results.passed).toBe(0)
      expect(results.failed).toBe(0)
      expect(results.skipped).toBe(0)
      expect(results.tests).toEqual([])
    })
  })
})
