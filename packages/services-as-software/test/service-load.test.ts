/**
 * Tests for `Service.load()` — round-trip define → publish → load.
 *
 * Covers:
 *   - happy path: hydrated ServiceInstance carries the same readable fields
 *     as the original (name, promise, audience, archetype, lineage, schema,
 *     binding, pricing, oversight, etc.)
 *   - INVALID_REF for empty / non-string refs
 *   - NOT_FOUND when no listing matches
 *   - CORRUPT_STATE when the listing exists but the runtime unit is missing
 *   - bound methods on the loaded instance work (retire transitions FSM)
 *   - load registers the hydrated service in the lifecycle as `published`
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'

import { Code } from 'digital-tools'
import type { FunctionRef } from 'digital-tools'

import { Pricing } from 'business-as-code/finance'

import {
  Service,
  ServiceLifecycle,
  ServiceLoadError,
  __resetMarketplaceReposForTests,
  configureRuntimeUnitRepo,
  getMarketplaceRepo,
  getRuntimeUnitRepo,
  InMemoryRuntimeUnitRepo,
  verifyService,
  publishService,
} from '../src/v3/index.js'
import type { ServiceInstance, ServiceRef } from '../src/v3/index.js'

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

interface SummarizeIn {
  text: string
}
interface SummarizeOut {
  summary: string
}

/**
 * Build a fully-specced Service that we round-trip through publish + load.
 * Keeps the spec minimal but exercises the optional fields the loader is
 * supposed to hydrate (description, pricing, oversight, lineage).
 */
function defineSummarizeService(): ServiceInstance<SummarizeIn, SummarizeOut> {
  const handler = async (input: SummarizeIn): Promise<SummarizeOut> => ({
    summary: `summary of ${input.text.slice(0, 16)}`,
  })

  const codeStep = Code<SummarizeIn, SummarizeOut>({
    name: 'summarize-step',
    handler,
  })

  return Service.define<SummarizeIn, SummarizeOut>({
    name: 'Summarize',
    promise: 'One-paragraph summary of any text.',
    description: 'Distil a passage to its single most important sentence.',
    audience: 'human',
    archetype: 'transactional-workflow',
    schema: {
      input: z.object({ text: z.string() }),
      output: z.object({ summary: z.string() }),
    },
    binding: {
      cascade: [codeStep as unknown as FunctionRef],
      toolPermissions: [],
      clarificationPolicy: { enabled: false },
    },
    pricing: Pricing.perInvocation({
      tiers: [{ id: 'std', amount: 100n }],
    }),
    oversight: { mode: 'autonomous' },
    lineage: {
      cellRef: 'cell:test-cell',
      icpContextProblemRef: 'icp:test-problem',
      foundingHypothesisRef: 'fh:test-hypothesis',
      cascadeRunId: 'run:test-run',
      versionVector: {
        ontology: '1.0.0',
        engine: '1.0.0',
        generation: '1.0.0',
        fh: '1.0.0',
      },
    },
  })
}

/**
 * Drive the full publish pipeline (define already happened; this just runs
 * verify + publish so a listing+runtime-unit pair exists in the configured
 * repos).
 */
async function publishViaPipeline(svc: ServiceInstance<SummarizeIn, SummarizeOut>): Promise<void> {
  const report = await verifyService(svc, {
    fixtures: [{ input: { text: 'hello world' } }],
  })
  expect(report.passed).toBe(true)
  await publishService(svc)
}

// ----------------------------------------------------------------------------
// Reset state between tests
// ----------------------------------------------------------------------------

beforeEach(() => {
  __resetMarketplaceReposForTests()
  ServiceLifecycle.__resetForTests()
})

// ----------------------------------------------------------------------------
// Happy path
// ----------------------------------------------------------------------------

describe('Service.load — round-trip', () => {
  it('hydrates a ServiceInstance whose readable fields match the original', async () => {
    const original = defineSummarizeService()
    await publishViaPipeline(original)

    const loaded = await Service.load<SummarizeIn, SummarizeOut>(original.$id as ServiceRef)

    expect(loaded.$id).toBe(original.$id)
    expect(loaded.$type).toBe('Service')
    expect(loaded.name).toBe(original.name)
    expect(loaded.promise).toBe(original.promise)
    expect(loaded.description).toBe(original.description)
    // Single-audience services denormalize the scalar audience straight back.
    expect(loaded.audience).toBe('human')
    expect(loaded.archetype).toBe(original.archetype)
    expect(loaded.binding).toEqual(original.binding)
    expect(loaded.schema).toEqual(original.schema)
    expect(loaded.pricing).toEqual(original.pricing)
    expect(loaded.oversight).toEqual(original.oversight)
    expect(loaded.lineage).toEqual(original.lineage)
  })

  it('attaches the rendered UI shapes from the listing', async () => {
    const svc = defineSummarizeService()
    await publishViaPipeline(svc)

    const loaded = await Service.load<SummarizeIn, SummarizeOut>(svc.$id as ServiceRef)

    expect(loaded.catalog).toBeDefined()
    expect(loaded.order).toBeDefined()
    expect(loaded.onboarding).toBeDefined()
    expect(loaded.delivery).toBeDefined()
    expect(loaded.portal).toBeDefined()
  })

  it('registers the loaded service in the lifecycle as `published`', async () => {
    const svc = defineSummarizeService()
    await publishViaPipeline(svc)

    // Reset just the lifecycle FSM so the load has to re-register; the repo
    // still carries the listing + runtime unit.
    ServiceLifecycle.__resetForTests()

    const loaded = await Service.load<SummarizeIn, SummarizeOut>(svc.$id as ServiceRef)
    expect(ServiceLifecycle.getState(loaded.$id)).toBe('published')
  })

  it('resolves a listing $id (lst:...) as well as a service $id (svc:...)', async () => {
    const svc = defineSummarizeService()
    await publishViaPipeline(svc)

    const listing = await getMarketplaceRepo().byService(svc.$id)
    expect(listing).toBeDefined()

    const loaded = await Service.load<SummarizeIn, SummarizeOut>(listing!.$id as ServiceRef)
    expect(loaded.$id).toBe(svc.$id)
  })
})

// ----------------------------------------------------------------------------
// Bound methods
// ----------------------------------------------------------------------------

describe('Service.load — bound methods', () => {
  it('retire() transitions the loaded service to `retired`', async () => {
    const svc = defineSummarizeService()
    await publishViaPipeline(svc)
    ServiceLifecycle.__resetForTests()

    const loaded = await Service.load<SummarizeIn, SummarizeOut>(svc.$id as ServiceRef)
    await loaded.retire('end-of-life')

    expect(ServiceLifecycle.getState(loaded.$id)).toBe('retired')
  })

  it('invoke() dispatches against the registered service (does not throw NOT_REGISTERED)', async () => {
    const svc = defineSummarizeService()
    await publishViaPipeline(svc)
    ServiceLifecycle.__resetForTests()

    const loaded = await Service.load<SummarizeIn, SummarizeOut>(svc.$id as ServiceRef)
    // We just verify the bound method does not throw the
    // "not registered in lifecycle" error — the actual cascade walk uses the
    // round-4 mock runtime which returns a handle synchronously.
    const handle = loaded.invoke({ text: 'hello world' })
    expect(handle).toBeDefined()
  })
})

// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------

describe('Service.load — errors', () => {
  it('throws INVALID_REF for an empty string', async () => {
    await expect(Service.load('' as ServiceRef)).rejects.toMatchObject({
      name: 'ServiceLoadError',
      code: 'INVALID_REF',
    })
  })

  it('throws INVALID_REF for a non-string ref', async () => {
    // Cast to bypass the compile-time type — runtime validation is the safety net.
    await expect(Service.load(undefined as unknown as ServiceRef)).rejects.toMatchObject({
      name: 'ServiceLoadError',
      code: 'INVALID_REF',
    })
  })

  it('throws NOT_FOUND when no listing matches the ref', async () => {
    await expect(Service.load('svc:nonexistent' as ServiceRef)).rejects.toMatchObject({
      name: 'ServiceLoadError',
      code: 'NOT_FOUND',
    })
  })

  it('throws CORRUPT_STATE when the listing exists but the runtime unit is missing', async () => {
    const svc = defineSummarizeService()
    await publishViaPipeline(svc)

    // Swap in a fresh empty RuntimeUnit repo while keeping the marketplace
    // listing in place. Now the listing exists but the runtime unit lookup
    // returns undefined.
    configureRuntimeUnitRepo(new InMemoryRuntimeUnitRepo())

    await expect(
      Service.load<SummarizeIn, SummarizeOut>(svc.$id as ServiceRef)
    ).rejects.toMatchObject({
      name: 'ServiceLoadError',
      code: 'CORRUPT_STATE',
    })
  })

  it('ServiceLoadError carries the offending ref', async () => {
    const ref = 'svc:does-not-exist' as ServiceRef
    try {
      await Service.load(ref)
      throw new Error('expected throw')
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceLoadError)
      const e = err as ServiceLoadError
      expect(e.code).toBe('NOT_FOUND')
      expect(e.ref).toBe(ref)
    }
  })
})

// ----------------------------------------------------------------------------
// Round-trip limitations (documented in load.ts JSDoc)
// ----------------------------------------------------------------------------

describe('Service.load — round-trip limitations', () => {
  it('does not preserve outputContract / costModel / reward (function-valued, not persisted)', async () => {
    // The reduced spec does not set any of these fields, so the load should
    // come back with them all undefined regardless. This codifies the
    // documented limitation.
    const svc = defineSummarizeService()
    await publishViaPipeline(svc)

    const loaded = await Service.load<SummarizeIn, SummarizeOut>(svc.$id as ServiceRef)
    expect(loaded.outputContract).toBeUndefined()
    expect(loaded.costModel).toBeUndefined()
    expect(loaded.reward).toBeUndefined()
  })
})
