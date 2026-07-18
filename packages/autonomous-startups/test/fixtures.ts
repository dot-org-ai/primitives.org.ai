// Minimal fixtures for capstone tests. The composed primitives carry rich shapes of their
// own; the capstone's tests exercise the CAPSTONE (composition, lifecycle@1, projection,
// validation), so we cast minimal stand-ins rather than restate each primitive's full
// interface.

import type { Passed, Principal, Domain } from '@org.ai/authority'
import type { BusinessModel, Offer, Product, Tool, Worker, DemandRegister } from '../src/index.js'
import type { AdvanceDomainOf, AdvanceableState } from '../src/index.js'

export const business = { name: 'Acme business model' } as unknown as BusinessModel

export const agentWorker = { name: 'Ada', type: 'agent' } as unknown as Worker
export const humanWorker = { name: 'Grace', type: 'human' } as unknown as Worker
export const badWorker = { name: 'Nobody', type: 'ghost' } as unknown as Worker

export const offer = { name: 'Managed onboarding' } as unknown as Offer
export const product = { name: 'Inbox Zero API' } as unknown as Product
export const tool = { name: 'gmail.send' } as unknown as Tool

/** A placeholder demand register (problems / markets are type-level placeholders). */
export const demand: DemandRegister = { problems: [{ id: 'inbox-overload' }], markets: [{ id: 'smb-ops' }] }

/** A fabricated tenant. `Principal` is a phantom brand, so a cast is the only way to mint one in a test. */
export function tenant<Id extends string>(_id: Id): Principal<Id> {
  return {} as unknown as Principal<Id>
}

/**
 * A fabricated authority token for an arbitrary competence domain. In production a `Passed`
 * is minted only by an @org.ai/authority gate; here we assert the phantom shape so the
 * runtime behaviour of the lifecycle@1 edges can be exercised.
 */
export function pass<D extends Domain, Prin extends Principal>(_domain: D, _principal: Prin): Passed<D, 'corr', Prin> {
  return {} as unknown as Passed<D, 'corr', Prin>
}

/** A fabricated authority token for the forward `advance` out of `state` (draws on AdvanceDomainOf<state>). */
export function passFor<S extends AdvanceableState, Prin extends Principal>(
  _state: S,
  _principal: Prin,
): Passed<AdvanceDomainOf<S>, 'corr', Prin> {
  return {} as unknown as Passed<AdvanceDomainOf<S>, 'corr', Prin>
}
