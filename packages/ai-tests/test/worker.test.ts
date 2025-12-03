import { describe, it, expect, beforeEach } from 'vitest'
import { TestServiceCore, TestService } from '../src/worker.js'
import { Assertion } from '../src/assertions.js'
import { TestRunner } from '../src/runner.js'

describe('TestServiceCore', () => {
  let service: TestServiceCore

  beforeEach(() => {
    service = new TestServiceCore()
  })

  describe('constructor', () => {
    it('creates a new TestServiceCore instance', () => {
      expect(service).toBeInstanceOf(TestServiceCore)
    })
  })

  describe('expect()', () => {
    it('returns an Assertion', () => {
      const assertion = service.expect(42)
      expect(assertion).toBeInstanceOf(Assertion)
    })

    it('accepts optional message', () => {
      const assertion = service.expect(42, 'custom message')
      expect(assertion).toBeInstanceOf(Assertion)
    })
  })

  describe('should()', () => {
    it('returns an Assertion', () => {
      const assertion = service.should(42)
      expect(assertion).toBeInstanceOf(Assertion)
    })
  })

  describe('assert', () => {
    it('returns chai assert object', () => {
      expect(service.assert).toBeDefined()
      expect(typeof service.assert.equal).toBe('function')
    })
  })

  describe('describe()', () => {
    it('delegates to runner', async () => {
      service.describe('suite', () => {
        service.it('test', () => {})
      })

      const results = await service.run()
      expect(results.tests[0].name).toBe('suite > test')
    })
  })

  describe('it()', () => {
    it('delegates to runner', async () => {
      service.it('test', () => {})

      const results = await service.run()
      expect(results.total).toBe(1)
    })
  })

  describe('test()', () => {
    it('is alias for it', async () => {
      service.test('test', () => {})

      const results = await service.run()
      expect(results.total).toBe(1)
    })
  })

  describe('skip()', () => {
    it('delegates to runner', async () => {
      service.skip('skipped', () => {})

      const results = await service.run()
      expect(results.skipped).toBe(1)
    })
  })

  describe('only()', () => {
    it('delegates to runner', async () => {
      service.it('normal', () => {})
      service.only('only', () => {})

      const results = await service.run()
      expect(results.total).toBe(1)
      expect(results.tests[0].name).toBe('only')
    })
  })

  describe('beforeEach()', () => {
    it('delegates to runner', async () => {
      let count = 0
      service.beforeEach(() => { count++ })
      service.it('test1', () => {})
      service.it('test2', () => {})

      await service.run()
      expect(count).toBe(2)
    })
  })

  describe('afterEach()', () => {
    it('delegates to runner', async () => {
      let count = 0
      service.afterEach(() => { count++ })
      service.it('test1', () => {})
      service.it('test2', () => {})

      await service.run()
      expect(count).toBe(2)
    })
  })

  describe('beforeAll()', () => {
    it('delegates to runner', async () => {
      let count = 0
      service.beforeAll(() => { count++ })
      service.it('test1', () => {})
      service.it('test2', () => {})

      await service.run()
      expect(count).toBe(1)
    })
  })

  describe('afterAll()', () => {
    it('delegates to runner', async () => {
      let count = 0
      service.afterAll(() => { count++ })
      service.it('test1', () => {})
      service.it('test2', () => {})

      await service.run()
      expect(count).toBe(1)
    })
  })

  describe('run()', () => {
    it('returns test results', async () => {
      service.it('pass', () => {})
      service.it('fail', () => { throw new Error('fail') })

      const results = await service.run()
      expect(results.total).toBe(2)
      expect(results.passed).toBe(1)
      expect(results.failed).toBe(1)
    })
  })

  describe('reset()', () => {
    it('clears all tests and hooks', async () => {
      service.it('test', () => {})
      service.beforeEach(() => {})
      service.reset()

      const results = await service.run()
      expect(results.total).toBe(0)
    })
  })

  describe('createRunner()', () => {
    it('returns a new TestRunner', () => {
      const runner = service.createRunner()
      expect(runner).toBeInstanceOf(TestRunner)
    })

    it('returns independent runner', async () => {
      service.it('service test', () => {})

      const runner = service.createRunner()
      runner.it('runner test', () => {})

      const serviceResults = await service.run()
      const runnerResults = await runner.run()

      expect(serviceResults.total).toBe(1)
      expect(runnerResults.total).toBe(1)
      expect(serviceResults.tests[0].name).toBe('service test')
      expect(runnerResults.tests[0].name).toBe('runner test')
    })
  })
})

describe('TestService (WorkerEntrypoint)', () => {
  it('exports TestService class', async () => {
    const { default: TestServiceClass } = await import('../src/worker.js')
    expect(TestServiceClass).toBeDefined()
    expect(typeof TestServiceClass).toBe('function')
  })

  it('TestService has connect method in prototype', () => {
    expect(typeof TestService.prototype.connect).toBe('function')
  })
})
