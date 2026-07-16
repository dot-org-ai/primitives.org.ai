import { describe, it, expect } from 'vitest'
import { isStartup, STARTUP_TYPE } from '@org.ai/types'
import { defineStartup, advance, toStartupNoun } from '../src/index.js'
import { business, agentWorker, offer, product, tool, tenant, passFor } from './fixtures.js'

describe('defineStartup', () => {
  it('mints a construct at the idea state', () => {
    const s = defineStartup({ name: 'Inbox Zero', business })
    expect(s.state).toBe('idea')
    expect(s.name).toBe('Inbox Zero')
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

describe('advance (authority-gated lifecycle walk)', () => {
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
