// =====================================================================================
// compose(primitives) + the primitive registry (ADR 0001 amendment 3).
//
// An autonomous startup is a COMPOSITION of primitives. v2 makes the composition explicit
// and open: instead of hard-coding exactly five registers, the capstone carries a REGISTRY
// of composable primitives (each a named register SLOT with a cardinality and a
// required flag), and `compose(primitives)` builds a blueprint over any profile drawn from
// it. `CANONICAL_FIVE` is the default profile — the five conceptual primitives, resolved
// through the registry — so `compose()` with no argument is the canonical startup, and
// `defineStartup(spec)` is sugar over `compose().define(spec)`.
//
// The demand register (problems / markets) is a registered-but-optional sixth primitive: a
// profile that includes it binds the `demand` slot; the canonical profile does not.
// =====================================================================================

import type { Principal } from '@org.ai/authority'
import type { AutonomousStartup } from './startup.js'
import type { StartupSpec } from './startup.js'
import { defineFromProfile } from './startup.js'

/** The id of a composable primitive — a bare conceptual-primitive name, plus `demand`. */
export type PrimitiveId =
  | 'business-as-code'
  | 'services-as-software'
  | 'digital-products'
  | 'digital-tools'
  | 'digital-workers'
  | 'demand'

/** The composition slot a primitive binds into. */
export type SlotName = 'business' | 'offers' | 'products' | 'tools' | 'workforce' | 'demand'

/** How many values a slot holds. */
export type Cardinality = 'one' | 'many'

/** A composable primitive: a named register slot the capstone can bind. */
export interface Primitive<Id extends PrimitiveId = PrimitiveId> {
  /** The primitive's id (its bare conceptual-primitive name). */
  readonly id: Id
  /** The composition slot it binds into. */
  readonly slot: SlotName
  /** Whether the slot holds one value or many. */
  readonly cardinality: Cardinality
  /** Whether a construct is incomplete without this primitive bound. */
  readonly required: boolean
}

/** A profile: the ordered set of primitives a startup composes. */
export type Profile = readonly Primitive[]

/**
 * The registry of every composable primitive, resolved by id. `compose` and the canonical
 * profile both resolve THROUGH this table rather than restating slot facts inline.
 */
export const PRIMITIVE_REGISTRY = {
  'business-as-code': { id: 'business-as-code', slot: 'business', cardinality: 'one', required: true },
  'services-as-software': { id: 'services-as-software', slot: 'offers', cardinality: 'many', required: false },
  'digital-products': { id: 'digital-products', slot: 'products', cardinality: 'many', required: false },
  'digital-tools': { id: 'digital-tools', slot: 'tools', cardinality: 'many', required: false },
  'digital-workers': { id: 'digital-workers', slot: 'workforce', cardinality: 'many', required: false },
  demand: { id: 'demand', slot: 'demand', cardinality: 'one', required: false },
} as const satisfies Record<PrimitiveId, Primitive>

/** Resolve a list of primitive ids into a profile via the registry. */
export function resolveProfile(ids: readonly PrimitiveId[]): Profile {
  return ids.map((id) => PRIMITIVE_REGISTRY[id])
}

/** The five conceptual primitives that make up the canonical supply-side startup. */
export const CANONICAL_FIVE_IDS = [
  'business-as-code',
  'services-as-software',
  'digital-products',
  'digital-tools',
  'digital-workers',
] as const satisfies readonly PrimitiveId[]

/** The default profile: the five conceptual primitives, resolved through the registry. */
export const CANONICAL_FIVE: Profile = resolveProfile(CANONICAL_FIVE_IDS)

/** Whether a profile declares a given primitive id. */
export function profileHas(profile: Profile, id: PrimitiveId): boolean {
  return profile.some((p) => p.id === id)
}

/**
 * A blueprint over a resolved profile: `.define(spec)` mints a construct at the `idea`
 * state, binding exactly the slots the profile declares.
 */
export interface StartupBlueprint {
  /** The resolved profile this blueprint composes. */
  readonly profile: Profile
  /** Mint a fresh construct at the `idea` state from a spec. */
  define<Prin extends Principal = Principal>(spec: StartupSpec<Prin>): AutonomousStartup<'idea', Prin>
}

/**
 * Compose a startup blueprint from a profile of primitives. Defaults to `CANONICAL_FIVE`,
 * so `compose()` is the canonical startup. A custom profile changes which slots are bound
 * and which are required — e.g. `compose(resolveProfile([...CANONICAL_FIVE_IDS, 'demand']))`
 * additionally binds the demand register.
 */
export function compose(primitives: Profile = CANONICAL_FIVE): StartupBlueprint {
  return {
    profile: primitives,
    define<Prin extends Principal = Principal>(spec: StartupSpec<Prin>): AutonomousStartup<'idea', Prin> {
      return defineFromProfile<Prin>(primitives, spec)
    },
  }
}

/**
 * Define an autonomous startup from its spec — sugar over `compose().define(spec)`, i.e.
 * the canonical `CANONICAL_FIVE` profile. The result is a fresh construct at the `idea`
 * state; walk it forward with the lifecycle@1 edge functions (`advance`, `pivot`, …).
 */
export function defineStartup<Prin extends Principal = Principal>(
  spec: StartupSpec<Prin>,
): AutonomousStartup<'idea', Prin> {
  return compose().define<Prin>(spec)
}
