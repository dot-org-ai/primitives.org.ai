// =====================================================================================
// The capstone construct + the lifecycle@1 edge functions.
//
// AutonomousStartup is the RUNTIME construct of the capstone. It is deliberately distinct
// from the `Startup` DATA noun published by @org.ai/types (https://schema.org.ai/Startup):
// the construct carries the composition, the lifecycle state, its pivot LINEAGE, and the
// tenant it belongs to, and it PROJECTS onto the canonical noun rather than redefining it.
//
// `defineFromProfile` mints one at the `idea` state, binding exactly the slots a profile
// declares (see ./primitives.ts; `defineStartup`/`compose` are the public entry points).
// The five lifecycle@1 edges — `advance`, `revert`, `pivot`, `dissolve`, `rename` — each
// walk the construct along one STATEGRAPH edge, and each is gated by @org.ai/authority at
// the type level: the caller must present an unforgeable `Passed` token whose competence
// domain is exactly that edge's domain and whose principal is exactly the startup's tenant.
// The token is a compile-time proof only — nothing about it is inspected at runtime, so the
// capstone stays free of authority machinery.
// =====================================================================================

import { STARTUP_TYPE } from '@org.ai/types'
import type { StartupType, StartupStageType } from '@org.ai/types'
import type { Passed, Principal } from '@org.ai/authority'
import type { StartupComposition, BusinessModel, Offer, Product, Tool, Worker, DemandRegister } from './composition.js'
import type {
  LifecycleState,
  LiveState,
  AdvanceableState,
  RevertableState,
  PivotableState,
  NextOf,
  PrevOf,
  AdvanceDomainOf,
  RevertDomainOf,
} from './lifecycle.js'
import { NEXT_STATE } from './lifecycle.js'
// Type-only: erased at emit, so no runtime import cycle with ./primitives.ts.
import type { Profile } from './primitives.js'

/** The construction-lifecycle state mapped onto the schema.org.ai/Startup maturity stage. */
const STAGE_BY_STATE: Record<LiveState, StartupStageType> = {
  idea: 'idea',
  named: 'idea',
  sited: 'building',
  sellable: 'building',
  running: 'scaling',
}

/**
 * One prior identity a construct carried before a `pivot`. Pivot is re-idea-WITH-lineage:
 * the construct re-enters `idea` but keeps an append-only trail of what it was.
 */
export interface LineageEntry {
  /** The construct's canonical `$id` at the moment it pivoted. */
  readonly $id: string
  /** The lifecycle state it pivoted out of. */
  readonly state: LifecycleState
  /** The name it carried at that point. */
  readonly name: string
  /** Monotonic pivot index (0 for the first pivot). */
  readonly pivotIndex: number
}

/**
 * The declaration of an autonomous startup: a business model plus the optional register
 * slots and a little identity. The rich shapes come straight from the composed primitives —
 * the spec does not restate them.
 */
export interface StartupSpec<Prin extends Principal = Principal> {
  /** Human-readable name. */
  readonly name: string
  /** One-line description. */
  readonly description?: string
  /** Elevator pitch. */
  readonly pitch?: string
  /** Industry / sector the startup operates in. */
  readonly industry?: string
  /** The commercial model (business-as-code) — the one required register. */
  readonly business: BusinessModel
  /** Paid-delivery offers (services-as-software). */
  readonly offers?: readonly Offer[]
  /** Digital products the startup ships (digital-products). */
  readonly products?: readonly Product[]
  /** Tools the startup wields (digital-tools). */
  readonly tools?: readonly Tool[]
  /** The workforce — agents and humans (digital-workers). */
  readonly workforce?: readonly Worker[]
  /** The demand register (problems / markets) — bound only when the profile includes it. */
  readonly demand?: DemandRegister
  /** Canonical `$id` for the projected noun; defaults to a startups.studio URL. */
  readonly homepage?: string
  /** The tenant this startup belongs to. Authority tokens are non-portable across tenants. */
  readonly principal?: Prin
}

/**
 * The autonomous startup construct.
 *
 * @typeParam S    - the current lifecycle state.
 * @typeParam Prin - the tenant this startup is bound to.
 */
export interface AutonomousStartup<
  S extends LifecycleState = 'idea',
  Prin extends Principal = Principal,
> {
  /** The current lifecycle state. */
  readonly state: S
  /** Human-readable name (leased — a `rename` changes it; the `$id` does not). */
  readonly name: string
  /** One-line description. */
  readonly description?: string
  /** Elevator pitch. */
  readonly pitch?: string
  /** Industry / sector. */
  readonly industry?: string
  /** The bound registers. */
  readonly composition: StartupComposition
  /** Append-only trail of prior identities, grown by `pivot`. Empty until first pivot. */
  readonly lineage: readonly LineageEntry[]
  /** The tenant this startup belongs to. */
  readonly principal?: Prin
  /** Projection onto the canonical schema.org.ai/Startup data noun. */
  readonly startup: StartupType
}

function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.length > 0 ? slug : 'startup'
}

function projectNoun(
  $id: string,
  name: string,
  stage: StartupStageType,
  parts: { description?: string; pitch?: string; industry?: string },
): StartupType {
  return {
    $id,
    $type: STARTUP_TYPE,
    name,
    stage,
    ...(parts.description !== undefined ? { description: parts.description } : {}),
    ...(parts.pitch !== undefined ? { pitch: parts.pitch } : {}),
    ...(parts.industry !== undefined ? { industry: parts.industry } : {}),
  }
}

/**
 * Mint a construct at the `idea` state from a profile + spec. Binds the five supply
 * registers always; binds the `demand` register only when the profile declares it (ADR 0001
 * amendment 3). `compose(profile).define(spec)` and `defineStartup(spec)` are the public
 * entry points — call those rather than this directly.
 */
export function defineFromProfile<Prin extends Principal = Principal>(
  profile: Profile,
  spec: StartupSpec<Prin>,
): AutonomousStartup<'idea', Prin> {
  const bindsDemand = profile.some((p) => p.id === 'demand')
  const composition: StartupComposition = {
    business: spec.business,
    offers: spec.offers ?? [],
    products: spec.products ?? [],
    tools: spec.tools ?? [],
    workforce: spec.workforce ?? [],
    ...(bindsDemand && spec.demand !== undefined ? { demand: spec.demand } : {}),
  }
  const $id = spec.homepage ?? `https://startups.studio/${slugify(spec.name)}`
  const noun = projectNoun($id, spec.name, STAGE_BY_STATE.idea, {
    ...(spec.description !== undefined ? { description: spec.description } : {}),
    ...(spec.pitch !== undefined ? { pitch: spec.pitch } : {}),
    ...(spec.industry !== undefined ? { industry: spec.industry } : {}),
  })
  return {
    state: 'idea',
    name: spec.name,
    composition,
    lineage: [],
    startup: noun,
    ...(spec.description !== undefined ? { description: spec.description } : {}),
    ...(spec.pitch !== undefined ? { pitch: spec.pitch } : {}),
    ...(spec.industry !== undefined ? { industry: spec.industry } : {}),
    ...(spec.principal !== undefined ? { principal: spec.principal } : {}),
  }
}

/** Re-project the construct's noun at a new stage, preserving `$id` and descriptive parts. */
function reproject(s: AutonomousStartup<LifecycleState>, name: string, stage: StartupStageType): StartupType {
  return {
    ...s.startup,
    name,
    stage,
  }
}

/**
 * `advance` — walk the construct one forward build step (the STATEGRAPH `advance` edge).
 *
 * The next state is fixed by the forward spine, so there is no `to` argument to get wrong.
 * Gated at the type level: the caller must present a `Passed` token whose domain is exactly
 * `AdvanceDomainOf<From>` (growth → product → money → delivery) and whose principal is the
 * startup's tenant. A wrong-domain, wrong-tenant, or absent token is a compile error, and
 * `advance` on `running`/`dissolved` does not type-check at all (no forward edge exists).
 */
export function advance<From extends AdvanceableState, Corr extends string, Prin extends Principal>(
  startup: AutonomousStartup<From, Prin>,
  authority: Passed<AdvanceDomainOf<From>, Corr, NoInfer<Prin>>,
): AutonomousStartup<NextOf<From>, Prin> {
  void authority
  const next = NEXT_STATE[startup.state] as unknown as NextOf<From>
  return {
    ...startup,
    state: next,
    startup: reproject(startup, startup.name, STAGE_BY_STATE[next as LiveState]),
  } as AutonomousStartup<NextOf<From>, Prin>
}

/**
 * `revert` — undo the last build step (the STATEGRAPH `revert` edge). Draws on the SAME
 * competence domain as the forward edge it un-does (`RevertDomainOf<From>`): the authority
 * that can make a step is exactly the authority that can revert it. Illegal out of `idea`
 * (nothing to undo) and `dissolved` (terminal) — a compile error in both cases.
 */
export function revert<From extends RevertableState, Corr extends string, Prin extends Principal>(
  startup: AutonomousStartup<From, Prin>,
  authority: Passed<RevertDomainOf<From>, Corr, NoInfer<Prin>>,
): AutonomousStartup<PrevOf<From>, Prin> {
  void authority
  const prev = PREV_STATE[startup.state] as unknown as PrevOf<From>
  return {
    ...startup,
    state: prev,
    startup: reproject(startup, startup.name, STAGE_BY_STATE[prev as LiveState]),
  } as AutonomousStartup<PrevOf<From>, Prin>
}

/**
 * `pivot` — re-idea-with-lineage (the STATEGRAPH `pivot` edge). The construct re-enters
 * `idea`, keeping its composition, tenant, and `$id` (identity is owned), and appends a
 * lineage entry recording what it pivoted out of. Draws on the growth domain. Legal only
 * from a formed live state (`named`/`sited`/`sellable`/`running`) — pivoting `idea` or a
 * `dissolved` construct is a compile error.
 */
export function pivot<From extends PivotableState, Corr extends string, Prin extends Principal>(
  startup: AutonomousStartup<From, Prin>,
  authority: Passed<'growth', Corr, NoInfer<Prin>>,
): AutonomousStartup<'idea', Prin> {
  void authority
  const entry: LineageEntry = {
    $id: startup.startup.$id,
    state: startup.state,
    name: startup.name,
    pivotIndex: startup.lineage.length,
  }
  return {
    ...startup,
    state: 'idea',
    lineage: [...startup.lineage, entry],
    startup: reproject(startup, startup.name, STAGE_BY_STATE.idea),
  } as AutonomousStartup<'idea', Prin>
}

/**
 * `dissolve` — wind the construct down to the terminal `dissolved` state (the STATEGRAPH
 * `dissolve` edge). Draws on the legal domain. Legal from any live state. The projected
 * noun keeps its last stage (a dissolved startup was whatever maturity it reached);
 * `isLive` on the result is `false`, and no edge leaves `dissolved`.
 */
export function dissolve<From extends LiveState, Corr extends string, Prin extends Principal>(
  startup: AutonomousStartup<From, Prin>,
  authority: Passed<'legal', Corr, NoInfer<Prin>>,
): AutonomousStartup<'dissolved', Prin> {
  void authority
  return {
    ...startup,
    state: 'dissolved',
  } as AutonomousStartup<'dissolved', Prin>
}

/**
 * `rename` — change the construct's name without changing its state (the STATEGRAPH `rename`
 * self-edge). Draws on the schema (identity-stewardship) domain. Legal from any live state.
 * Names are leased: the projected noun's `name` updates but its `$id` does NOT — identity is
 * owned, only the label changes.
 */
export function rename<S extends LiveState, Corr extends string, Prin extends Principal>(
  startup: AutonomousStartup<S, Prin>,
  name: string,
  authority: Passed<'schema', Corr, NoInfer<Prin>>,
): AutonomousStartup<S, Prin> {
  void authority
  return {
    ...startup,
    name,
    startup: reproject(startup, name, startup.startup.stage),
  }
}

/** The single `revert` predecessor of each state at runtime (`null` where none). */
const PREV_STATE = {
  idea: null,
  named: 'idea',
  sited: 'named',
  sellable: 'sited',
  running: 'sellable',
  dissolved: null,
} as const satisfies Record<LifecycleState, LifecycleState | null>

/** Project any startup construct onto the canonical schema.org.ai/Startup data noun. */
export function toStartupNoun(startup: AutonomousStartup<LifecycleState>): StartupType {
  return startup.startup
}
