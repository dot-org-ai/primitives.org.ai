import { describe, it, expect } from 'vitest'
import { isStartup, STARTUP_TYPE } from '@org.ai/types'
import {
  compose,
  defineStartup,
  advance,
  revert,
  pivot,
  dissolve,
  rename,
  toStartupNoun,
  isLive,
  CANONICAL_FIVE,
  CANONICAL_FIVE_IDS,
  resolveProfile,
  profileHas,
} from '../src/index.js'
import { business, agentWorker, offer, product, tool, demand, tenant, pass, passFor } from './fixtures.js'

describe('compose (profile-driven composition)', () => {
  it('defaults to the CANONICAL_FIVE profile', () => {
    const blueprint = compose()
    expect(blueprint.profile).toBe(CANONICAL_FIVE)
    expect(blueprint.profile.map((p) => p.id)).toEqual([...CANONICAL_FIVE_IDS])
    expect(profileHas(blueprint.profile, 'demand')).toBe(false)
  })

  it('resolves the canonical five through the registry with the right slots and requiredness', () => {
    const byId = Object.fromEntries(CANONICAL_FIVE.map((p) => [p.id, p]))
    expect(byId['business-as-code']).toMatchObject({ slot: 'business', cardinality: 'one', required: true })
    expect(byId['digital-workers']).toMatchObject({ slot: 'workforce', cardinality: 'many', required: false })
  })

  it('binds the five supply registers and omits demand under the canonical profile', () => {
    const s = compose().define({ name: 'Inbox Zero', business, offers: [offer], demand })
    expect(s.composition.offers).toEqual([offer])
    // demand is NOT bound because CANONICAL_FIVE does not include the demand primitive
    expect(s.composition.demand).toBeUndefined()
  })

  it('binds the demand register when the profile includes the demand primitive', () => {
    const profile = resolveProfile([...CANONICAL_FIVE_IDS, 'demand'])
    expect(profileHas(profile, 'demand')).toBe(true)
    const s = compose(profile).define({ name: 'Inbox Zero', business, demand })
    expect(s.composition.demand).toBe(demand)
  })
})

describe('defineStartup (sugar over compose().define)', () => {
  it('mints a construct at the idea state with empty lineage', () => {
    const s = defineStartup({ name: 'Inbox Zero', business })
    expect(s.state).toBe('idea')
    expect(s.name).toBe('Inbox Zero')
    expect(s.lineage).toEqual([])
  })

  it('defaults the four optional registers to empty and keeps the business model', () => {
    const s = defineStartup({ name: 'Inbox Zero', business })
    expect(s.composition.business).toBe(business)
    expect(s.composition.offers).toEqual([])
    expect(s.composition.products).toEqual([])
    expect(s.composition.tools).toEqual([])
    expect(s.composition.workforce).toEqual([])
  })

  it('binds the five registers when supplied', () => {
    const s = defineStartup({
      name: 'Inbox Zero',
      business,
      offers: [offer],
      products: [product],
      tools: [tool],
      workforce: [agentWorker],
    })
    expect(s.composition.offers).toEqual([offer])
    expect(s.composition.products).toEqual([product])
    expect(s.composition.tools).toEqual([tool])
    expect(s.composition.workforce).toEqual([agentWorker])
  })

  it('projects onto a valid schema.org.ai/Startup data noun', () => {
    const s = defineStartup({
      name: 'Inbox Zero',
      business,
      description: 'Autonomous inbox triage',
      industry: 'Productivity',
    })
    const noun = toStartupNoun(s)
    expect(noun.$type).toBe(STARTUP_TYPE)
    expect(noun.$id).toBe('https://startups.studio/inbox-zero')
    expect(noun.name).toBe('Inbox Zero')
    expect(noun.stage).toBe('idea')
    expect(noun.description).toBe('Autonomous inbox triage')
    expect(isStartup(noun)).toBe(true)
  })

  it('honours an explicit homepage as the canonical $id', () => {
    const s = defineStartup({ name: 'Inbox Zero', business, homepage: 'https://inboxzero.example' })
    expect(toStartupNoun(s).$id).toBe('https://inboxzero.example')
  })
})

describe('advance (forward, authority-gated)', () => {
  it('walks a construct forward one legal step, updating the projected stage', () => {
    const prin = tenant('acme')
    const idea = defineStartup({ name: 'Inbox Zero', business, principal: prin })
    const named = advance(idea, passFor('idea', prin))
    expect(named.state).toBe('named')
    expect(named.startup.stage).toBe('idea')

    const sited = advance(named, passFor('named', prin))
    expect(sited.state).toBe('sited')
    expect(sited.startup.stage).toBe('building')

    const sellable = advance(sited, passFor('sited', prin))
    expect(sellable.state).toBe('sellable')

    const running = advance(sellable, passFor('sellable', prin))
    expect(running.state).toBe('running')
    expect(running.startup.stage).toBe('scaling')
  })

  it('preserves identity and composition across the walk', () => {
    const prin = tenant('acme')
    const idea = defineStartup({ name: 'Inbox Zero', business, workforce: [agentWorker], principal: prin })
    const named = advance(idea, passFor('idea', prin))
    expect(named.name).toBe('Inbox Zero')
    expect(named.composition.workforce).toEqual([agentWorker])
    expect(named.startup.$id).toBe(idea.startup.$id)
  })
})

describe('revert (undo the last build step)', () => {
  it('steps back one state, restoring the projected stage', () => {
    const prin = tenant('acme')
    const named = advance(defineStartup({ name: 'X', business, principal: prin }), passFor('idea', prin))
    const sited = advance(named, passFor('named', prin))
    expect(sited.state).toBe('sited')
    expect(sited.startup.stage).toBe('building')

    const backToNamed = revert(sited, pass('product', prin))
    expect(backToNamed.state).toBe('named')
    expect(backToNamed.startup.stage).toBe('idea')

    const backToIdea = revert(backToNamed, pass('growth', prin))
    expect(backToIdea.state).toBe('idea')
  })
})

describe('pivot (re-idea-with-lineage)', () => {
  it('re-enters idea, keeps the $id, and appends a lineage entry', () => {
    const prin = tenant('acme')
    const named = advance(defineStartup({ name: 'Inbox Zero', business, principal: prin }), passFor('idea', prin))
    const sited = advance(named, passFor('named', prin))
    const repivoted = pivot(sited, pass('growth', prin))

    expect(repivoted.state).toBe('idea')
    expect(repivoted.startup.stage).toBe('idea')
    expect(repivoted.startup.$id).toBe(sited.startup.$id) // identity is owned
    expect(repivoted.lineage).toHaveLength(1)
    expect(repivoted.lineage[0]).toMatchObject({ state: 'sited', name: 'Inbox Zero', pivotIndex: 0 })
  })

  it('accumulates lineage across multiple pivots', () => {
    const prin = tenant('acme')
    let s = advance(defineStartup({ name: 'X', business, principal: prin }), passFor('idea', prin))
    s = pivot(s, pass('growth', prin))
    const named2 = advance(s, passFor('idea', prin))
    const twice = pivot(named2, pass('growth', prin))
    expect(twice.lineage).toHaveLength(2)
    expect(twice.lineage.map((l) => l.pivotIndex)).toEqual([0, 1])
  })
})

describe('dissolve (wind down to terminal)', () => {
  it('moves to dissolved, is no longer live, and keeps the last projected stage', () => {
    const prin = tenant('acme')
    const named = advance(defineStartup({ name: 'X', business, principal: prin }), passFor('idea', prin))
    const sited = advance(named, passFor('named', prin))
    const dead = dissolve(sited, pass('legal', prin))
    expect(dead.state).toBe('dissolved')
    expect(isLive(dead.state)).toBe(false)
    expect(dead.startup.stage).toBe('building') // preserves the maturity it reached
  })

  it('can dissolve straight from idea', () => {
    const prin = tenant('acme')
    const dead = dissolve(defineStartup({ name: 'X', business, principal: prin }), pass('legal', prin))
    expect(dead.state).toBe('dissolved')
  })
})

describe('rename (identity kept, name leased)', () => {
  it('changes the name and the projected noun name but NOT the $id or the state', () => {
    const prin = tenant('acme')
    const named = advance(defineStartup({ name: 'Inbox Zero', business, principal: prin }), passFor('idea', prin))
    const renamed = rename(named, 'Zero Inbox', pass('schema', prin))
    expect(renamed.state).toBe('named') // unchanged
    expect(renamed.name).toBe('Zero Inbox')
    expect(renamed.startup.name).toBe('Zero Inbox')
    expect(renamed.startup.$id).toBe(named.startup.$id) // identity is owned; only the label changes
  })
})
