import { describe, it, expectTypeOf } from 'vitest'
import { compose, defineStartup, advance, revert, pivot, dissolve, rename } from '../src/index.js'
import type { AutonomousStartup, StartupComposition, Profile } from '../src/index.js'
import { business, tenant, pass, passFor } from './fixtures.js'

// These assertions are validated at compile time (tsc over the test tree). They pin the
// capstone's deep type surface: the composition shape, the lifecycle state parameter, and the
// per-edge authority gate — one @ts-expect-error per illegal edge (wrong domain, wrong tenant,
// illegal source state).

describe('composition + compose typing', () => {
  it('binds the five supply registers plus the optional demand slot', () => {
    expectTypeOf<StartupComposition>().toHaveProperty('business')
    expectTypeOf<StartupComposition>().toHaveProperty('offers')
    expectTypeOf<StartupComposition>().toHaveProperty('products')
    expectTypeOf<StartupComposition>().toHaveProperty('tools')
    expectTypeOf<StartupComposition>().toHaveProperty('workforce')
    expectTypeOf<StartupComposition>().toHaveProperty('demand')
  })

  it('compose returns a blueprint over a profile; define mints an idea construct', () => {
    expectTypeOf(compose().profile).toEqualTypeOf<Profile>()
    const idea = compose().define({ name: 'Inbox Zero', business })
    expectTypeOf(idea).toEqualTypeOf<AutonomousStartup<'idea'>>()
    expectTypeOf(defineStartup({ name: 'Inbox Zero', business })).toEqualTypeOf<AutonomousStartup<'idea'>>()
  })
})

describe('advance gate', () => {
  it('narrows the state on a legal, correctly-authorized step', () => {
    const prin = tenant('acme')
    const idea = defineStartup({ name: 'Inbox Zero', business, principal: prin })
    const named = advance(idea, passFor('idea', prin))
    expectTypeOf(named.state).toEqualTypeOf<'named'>()
  })

  it('rejects a wrong-domain token', () => {
    const prin = tenant('acme')
    const idea = defineStartup({ name: 'Inbox Zero', business, principal: prin })
    // @ts-expect-error — idea→named draws on 'growth'; a 'money' token cannot authorize it
    advance(idea, pass('money', prin))
  })

  it('rejects a wrong-tenant token (non-portable across principals)', () => {
    const prin = tenant('acme')
    const other = tenant('globex')
    const idea = defineStartup({ name: 'Inbox Zero', business, principal: prin })
    // @ts-expect-error — a token minted for a different principal cannot authorize this tenant's step
    advance(idea, passFor('idea', other))
  })

  it('does not type-check on a terminal running startup (no forward edge)', () => {
    const prin = tenant('acme')
    const s = defineStartup({ name: 'Inbox Zero', business, principal: prin })
    const named = advance(s, passFor('idea', prin))
    const sited = advance(named, passFor('named', prin))
    const sellable = advance(sited, passFor('sited', prin))
    const running = advance(sellable, passFor('sellable', prin))
    expectTypeOf(running.state).toEqualTypeOf<'running'>()
    // @ts-expect-error — 'running' has no advance edge
    advance(running, passFor('sellable', prin))
  })
})

describe('revert gate', () => {
  it('narrows to the predecessor on a legal, correctly-authorized revert', () => {
    const prin = tenant('acme')
    const named = advance(defineStartup({ name: 'X', business, principal: prin }), passFor('idea', prin))
    const back = revert(named, pass('growth', prin)) // named→idea un-does the growth edge
    expectTypeOf(back.state).toEqualTypeOf<'idea'>()
  })

  it('rejects a wrong-domain revert token', () => {
    const prin = tenant('acme')
    const named = advance(defineStartup({ name: 'X', business, principal: prin }), passFor('idea', prin))
    // @ts-expect-error — reverting named→idea draws on 'growth', not 'money'
    revert(named, pass('money', prin))
  })

  it('does not type-check out of idea (nothing to undo)', () => {
    const prin = tenant('acme')
    const idea = defineStartup({ name: 'X', business, principal: prin })
    // @ts-expect-error — 'idea' has no revert edge
    revert(idea, pass('growth', prin))
  })
})

describe('pivot gate', () => {
  it('re-idea narrows to idea on a legal growth-authorized pivot', () => {
    const prin = tenant('acme')
    const named = advance(defineStartup({ name: 'X', business, principal: prin }), passFor('idea', prin))
    const repivot = pivot(named, pass('growth', prin))
    expectTypeOf(repivot.state).toEqualTypeOf<'idea'>()
  })

  it('rejects a wrong-domain pivot token (pivot draws on growth)', () => {
    const prin = tenant('acme')
    const named = advance(defineStartup({ name: 'X', business, principal: prin }), passFor('idea', prin))
    // @ts-expect-error — pivot draws on 'growth', not 'product'
    pivot(named, pass('product', prin))
  })

  it('does not type-check from idea (nothing to re-idea)', () => {
    const prin = tenant('acme')
    const idea = defineStartup({ name: 'X', business, principal: prin })
    // @ts-expect-error — 'idea' is not a pivotable (formed live) state
    pivot(idea, pass('growth', prin))
  })
})

describe('dissolve gate', () => {
  it('narrows to dissolved on a legal-authorized dissolve', () => {
    const prin = tenant('acme')
    const idea = defineStartup({ name: 'X', business, principal: prin })
    const dead = dissolve(idea, pass('legal', prin))
    expectTypeOf(dead.state).toEqualTypeOf<'dissolved'>()
  })

  it('rejects a wrong-domain dissolve token (dissolve draws on legal)', () => {
    const prin = tenant('acme')
    const idea = defineStartup({ name: 'X', business, principal: prin })
    // @ts-expect-error — dissolve draws on 'legal', not 'money'
    dissolve(idea, pass('money', prin))
  })

  it('does not type-check out of a dissolved (terminal) startup', () => {
    const prin = tenant('acme')
    const dead = dissolve(defineStartup({ name: 'X', business, principal: prin }), pass('legal', prin))
    expectTypeOf(dead.state).toEqualTypeOf<'dissolved'>()
    // @ts-expect-error — 'dissolved' is terminal; no edge leaves it
    dissolve(dead, pass('legal', prin))
  })
})

describe('rename gate', () => {
  it('keeps the state on a legal schema-authorized rename', () => {
    const prin = tenant('acme')
    const named = advance(defineStartup({ name: 'X', business, principal: prin }), passFor('idea', prin))
    const renamed = rename(named, 'Y', pass('schema', prin))
    expectTypeOf(renamed.state).toEqualTypeOf<'named'>()
  })

  it('rejects a wrong-domain rename token (rename draws on schema)', () => {
    const prin = tenant('acme')
    const named = advance(defineStartup({ name: 'X', business, principal: prin }), passFor('idea', prin))
    // @ts-expect-error — rename draws on 'schema', not 'growth'
    rename(named, 'Y', pass('growth', prin))
  })

  it('does not type-check on a dissolved (terminal) startup', () => {
    const prin = tenant('acme')
    const dead = dissolve(defineStartup({ name: 'X', business, principal: prin }), pass('legal', prin))
    // @ts-expect-error — 'dissolved' is terminal; rename is a live-only self-edge
    rename(dead, 'Y', pass('schema', prin))
  })
})
