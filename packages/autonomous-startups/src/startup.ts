// =====================================================================================
// defineStartup + AutonomousStartup — the capstone construct.
//
// AutonomousStartup is the RUNTIME construct of the capstone. It is deliberately distinct
// from the `Startup` DATA noun published by @org.ai/types (https://schema.org.ai/Startup):
// the construct carries the five-primitive composition, the construction-lifecycle state,
// and the tenant it belongs to, and it PROJECTS onto the canonical noun rather than
// redefining it. `defineStartup` mints one at the `idea` state; `advance` walks it forward
// one legal, authority-gated step at a time.
// =====================================================================================

import { STARTUP_TYPE } from '@org.ai/types'
import type { StartupType, StartupStageType } from '@org.ai/types'
import type { Passed, Principal } from '@org.ai/authority'
import type { StartupComposition, BusinessModel, Offer, Product, Tool, Worker } from './composition.js'
import type { LifecycleState, NonTerminalState, NextOf, DomainOf } from './lifecycle.js'
import { NEXT_STATE } from './lifecycle.js'

/** The construction-lifecycle state mapped onto the schema.org.ai/Startup maturity stage. */
const STAGE_BY_STATE: Record<LifecycleState, StartupStageType> = {
  idea: 'idea',
  named: 'idea',
  sited: 'building',
  sellable: 'building',
  running: 'scaling',
}

/**
 * The declaration of an autonomous startup: a business model plus the four optional
 * register slots and a little identity. The rich shapes come straight from the composed
 * primitives — the spec does not restate them.
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
  /** Canonical `$id` for the projected noun; defaults to a startups.studio URL. */
  readonly homepage?: string
  /** The tenant this startup belongs to. Authority tokens are non-portable across tenants. */
  readonly principal?: Prin
}

/**
 * The autonomous startup construct.
 *
 * @typeParam S    - the current construction-lifecycle state.
 * @typeParam Prin - the tenant this startup is bound to.
 */
export interface AutonomousStartup<
  S extends LifecycleState = 'idea',
  Prin extends Principal = Principal,
> {
  /** The current construction-lifecycle state. */
  readonly state: S
  /** Human-readable name. */
  readonly name: string
  /** One-line description. */
  readonly description?: string
  /** Elevator pitch. */
  readonly pitch?: string
  /** Industry / sector. */
  readonly industry?: string
  /** The five bound registers. */
  readonly composition: StartupComposition
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
  name: string,
  state: LifecycleState,
  parts: { description?: string; pitch?: string; industry?: string; homepage?: string },
): StartupType {
  return {
    $id: parts.homepage ?? `https://startups.studio/${slugify(name)}`,
    $type: STARTUP_TYPE,
    name,
    stage: STAGE_BY_STATE[state],
    ...(parts.description !== undefined ? { description: parts.description } : {}),
    ...(parts.pitch !== undefined ? { pitch: parts.pitch } : {}),
    ...(parts.industry !== undefined ? { industry: parts.industry } : {}),
  }
}

/**
 * Define an autonomous startup from its spec. The result is a fresh construct at the
 * `idea` state; walk it forward with `advance`.
 */
export function defineStartup<Prin extends Principal = Principal>(
  spec: StartupSpec<Prin>,
): AutonomousStartup<'idea', Prin> {
  const composition: StartupComposition = {
    business: spec.business,
    offers: spec.offers ?? [],
    products: spec.products ?? [],
    tools: spec.tools ?? [],
    workforce: spec.workforce ?? [],
  }
  const noun = projectNoun(spec.name, 'idea', {
    ...(spec.description !== undefined ? { description: spec.description } : {}),
    ...(spec.pitch !== undefined ? { pitch: spec.pitch } : {}),
    ...(spec.industry !== undefined ? { industry: spec.industry } : {}),
    ...(spec.homepage !== undefined ? { homepage: spec.homepage } : {}),
  })
  return {
    state: 'idea',
    name: spec.name,
    composition,
    startup: noun,
    ...(spec.description !== undefined ? { description: spec.description } : {}),
    ...(spec.pitch !== undefined ? { pitch: spec.pitch } : {}),
    ...(spec.industry !== undefined ? { industry: spec.industry } : {}),
    ...(spec.principal !== undefined ? { principal: spec.principal } : {}),
  }
}

/**
 * Walk a startup forward one legal step.
 *
 * The next state is fixed by the linear lifecycle, so there is no `to` argument to get
 * wrong. Advancing is gated by @org.ai/authority at the type level: the caller must
 * present an unforgeable `Passed` token whose competence domain is exactly the one this
 * transition draws on (`DomainOf<From>`) and whose principal is exactly the startup's
 * tenant (`Prin`). A wrong-domain, wrong-tenant, or absent token is a compile error, and
 * `advance` on a `running` startup does not type-check at all (there is no successor).
 * The token is a compile-time proof only — nothing about it is inspected at runtime, so
 * the capstone stays free of authority machinery.
 */
export function advance<
  From extends NonTerminalState,
  Corr extends string,
  Prin extends Principal,
>(
  startup: AutonomousStartup<From, Prin>,
  authority: Passed<DomainOf<From>, Corr, NoInfer<Prin>>,
): AutonomousStartup<NextOf<From>, Prin> {
  void authority
  const next = NEXT_STATE[startup.state] as unknown as NextOf<From>
  const advanced = {
    ...startup,
    state: next,
    startup: { ...startup.startup, stage: STAGE_BY_STATE[next] },
  }
  return advanced as AutonomousStartup<NextOf<From>, Prin>
}

/** Project any startup construct onto the canonical schema.org.ai/Startup data noun. */
export function toStartupNoun(startup: AutonomousStartup<LifecycleState>): StartupType {
  return startup.startup
}
