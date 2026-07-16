import { describe, it, expectTypeOf } from 'vitest'
import { defineStartup, advance } from '../src/index.js'
import type { AutonomousStartup, StartupComposition } from '../src/index.js'
import { business, tenant, passFor } from './fixtures.js'

// These assertions are validated at compile time (vitest --typecheck / tsc over the test
// tree). They pin the capstone's deep type surface: the composition shape, the linear
// state parameter, and the authority gate on `advance`.

describe('composition typing', () => {
  it('binds exactly the five registers', () => {
    expectTypeOf<StartupComposition>().toHaveProperty('business')
    expectTypeOf<StartupComposition>().toHaveProperty('offers')
    expectTypeOf<StartupComposition>().toHaveProperty('products')
    expectTypeOf<StartupComposition>().toHaveProperty('tools')
    expectTypeOf<StartupComposition>().toHaveProperty('workforce')
  })

  it('carries the lifecycle state in the type parameter', () => {
    const idea = defineStartup({ name: 'Inbox Zero', business })
    expectTypeOf(idea).toEqualTypeOf<AutonomousStartup<'idea'>>()
  })
})

describe('authority gate on advance', () => {
  it('narrows the state on a legal, correctly-authorized step', () => {
    const prin = tenant('acme')
    const idea = defineStartup({ name: 'Inbox Zero', business, principal: prin })
    const named = advance(idea, passFor('idea', prin))
    expectTypeOf(named.state).toEqualTypeOf<'named'>()
  })

  it('rejects a wrong-domain token', () => {
    const prin = tenant('acme')
    const idea = defineStartup({ name: 'Inbox Zero', business, principal: prin })
    // @ts-expect-error — the idea→named transition draws on 'growth'; a 'money' (sited) token cannot authorize it
    advance(idea, passFor('sited', prin))
  })

  it('rejects a wrong-tenant token (non-portable across principals)', () => {
    const prin = tenant('acme')
    const other = tenant('globex')
    const idea = defineStartup({ name: 'Inbox Zero', business, principal: prin })
    // @ts-expect-error — a token minted for a different principal cannot authorize this tenant's transition
    advance(idea, passFor('idea', other))
  })

  it('does not type-check on a terminal running startup', () => {
    const prin = tenant('acme')
    const s = defineStartup({ name: 'Inbox Zero', business, principal: prin })
    const named = advance(s, passFor('idea', prin))
    const sited = advance(named, passFor('named', prin))
    const sellable = advance(sited, passFor('sited', prin))
    const running = advance(sellable, passFor('sellable', prin))
    expectTypeOf(running.state).toEqualTypeOf<'running'>()
    // @ts-expect-error — 'running' is terminal: it has no successor, so advance out of it is illegal
    advance(running, passFor('sellable', prin))
  })
})
