import { describe, it, expect } from 'vitest'

describe('index exports', () => {
  it('exports Assertion', async () => {
    const { Assertion } = await import('../src/index.js')
    expect(Assertion).toBeDefined()
  })

  it('exports expect', async () => {
    const { expect: expectFn } = await import('../src/index.js')
    expect(expectFn).toBeDefined()
    expect(typeof expectFn).toBe('function')
  })

  it('exports should', async () => {
    const { should } = await import('../src/index.js')
    expect(should).toBeDefined()
    expect(typeof should).toBe('function')
  })

  it('exports assert', async () => {
    const { assert } = await import('../src/index.js')
    expect(assert).toBeDefined()
  })

  it('exports TestRunner', async () => {
    const { TestRunner } = await import('../src/index.js')
    expect(TestRunner).toBeDefined()
  })

  it('exports createRunner', async () => {
    const { createRunner } = await import('../src/index.js')
    expect(createRunner).toBeDefined()
    expect(typeof createRunner).toBe('function')
  })

  it('exports TestService', async () => {
    const { TestService } = await import('../src/index.js')
    expect(TestService).toBeDefined()
  })

  it('exports TestWorker as alias', async () => {
    const { TestWorker, TestService } = await import('../src/index.js')
    expect(TestWorker).toBe(TestService)
  })

  it('exports TestServiceCore', async () => {
    const { TestServiceCore } = await import('../src/index.js')
    expect(TestServiceCore).toBeDefined()
  })
})
