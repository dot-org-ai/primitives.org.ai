// Minimal fixtures for capstone tests. The composed primitives carry rich shapes of their
// own; the capstone's tests exercise the CAPSTONE (lifecycle, projection, validation), so
// we cast minimal stand-ins rather than restate each primitive's full interface.

import type { Passed, Principal } from '@org.ai/authority'
import type { BusinessModel, Offer, Product, Tool, Worker } from '../src/index.js'
import type { DomainOf, LifecycleState } from '../src/index.js'

export const business = { name: 'Acme business model' } as unknown as BusinessModel

export const agentWorker = { name: 'Ada', type: 'agent' } as unknown as Worker
export const humanWorker = { name: 'Grace', type: 'human' } as unknown as Worker
export const badWorker = { name: 'Nobody', type: 'ghost' } as unknown as Worker

export const offer = { name: 'Managed onboarding' } as unknown as Offer
export const product = { name: 'Inbox Zero API' } as unknown as Product
export const tool = { name: 'gmail.send' } as unknown as Tool

/** A fabricated tenant. `Principal` is a phantom brand, so a cast is the only way to mint one in a test. */
export function tenant<Id extends string>(_id: Id): Principal<Id> {
  return {} as unknown as Principal<Id>
}

/**
 * A fabricated authority token for the transition out of `state`. In production a `Passed`
 * is minted only by an @org.ai/authority gate; here we assert the phantom shape so the
 * runtime behaviour of `advance` can be exercised.
 */
export function passFor<S extends LifecycleState, Prin extends Principal>(
  _state: S,
  _principal: Prin,
): Passed<DomainOf<S>, 'corr', Prin> {
  return {} as unknown as Passed<DomainOf<S>, 'corr', Prin>
}
