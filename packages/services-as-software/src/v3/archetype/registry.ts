/**
 * Archetype value-type, registry, and `defineServiceArchetype` factory.
 *
 * The registry is a process-local Map keyed by archetype id; the v3 surface
 * exposes a singleton {@link archetypes} for in-process use plus the
 * {@link ArchetypeRegistry} class for tests / multi-tenant runtimes that
 * want isolated registries.
 *
 * Defaults registered by the catalog (`./defaults.ts`) populate `archetypes`
 * lazily on first import via `./catalog.ts`; consumers don't need to call a
 * bootstrap function.
 *
 * @packageDocumentation
 */

import type { AgentMode, PersonaRef } from 'digital-tools'
import type { Money } from 'autonomous-finance'

// ============================================================================
// Archetype scalars
// ============================================================================

/**
 * Opaque reference to a Service archetype (e.g. `'summarization'`,
 * `'cold-outbound'`). Branded for type-safety; literal strings work.
 */
export type ServiceArchetypeRef = string & { __brand?: 'ServiceArchetypeRef' }

/**
 * How a Service delivers its result to the caller. The archetype default is
 * a hint — concrete Services may override.
 *
 * - `synchronous`         — request/response in a single call.
 * - `asynchronous-poll`   — caller receives a handle, polls for completion.
 * - `asynchronous-push`   — runtime pushes the result to a callback / webhook.
 * - `streaming`           — incremental events streamed to the caller.
 * - `batch`               — many inputs processed together; one bundled result.
 * - `human-in-the-loop`   — synchronous-feeling but pauses for human review.
 */
export type DeliveryPattern =
  | 'synchronous'
  | 'asynchronous-poll'
  | 'asynchronous-push'
  | 'streaming'
  | 'batch'
  | 'human-in-the-loop'

/**
 * Coarse shape of an archetype's input. Drives the default `OrderShape`
 * UI (single text box vs. list of records vs. file upload, …).
 */
export type InputShapePrimitive =
  | 'text'
  | 'document'
  | 'records'
  | 'query'
  | 'event'
  | 'audio'
  | 'image'

/**
 * Coarse shape of an archetype's output. Drives the default `DeliveryShape`
 * UI (rendered prose vs. structured table vs. ranked list, …).
 */
export type OutputShapePrimitive =
  | 'text'
  | 'structured-record'
  | 'records'
  | 'ranked-list'
  | 'classification'
  | 'document'
  | 'decision'

// ============================================================================
// Archetype-level policy defaults
// ============================================================================

/**
 * Default oversight knobs an archetype suggests for its agentic Functions.
 * `Service.define()` uses these when the spec doesn't override.
 */
export interface ArchetypeOversightDefaults {
  /** Default {@link AgentMode} the archetype starts at. */
  defaultMode: AgentMode
  /** Whether the archetype default-requires human sign-off. */
  requiresHumanSignOff: boolean
}

/**
 * Persona hint used to populate an EvaluatorPanel when the spec doesn't
 * declare its own.
 *
 * Kept as a small literal record — the next agent (EvaluatorPanel) replaces
 * this with a richer factory call against the `Personas` library declared in
 * v3 §9. Until then, this carries enough to render a placeholder panel.
 */
export interface EvaluatorPersonaHint {
  /** Persona reference (typically into the `ai-evaluate` persona library). */
  personaRef: PersonaRef
  /** Sign-off requirement for this persona. */
  signOff: 'self' | 'peer' | 'human' | 'panel' | 'none'
  /** Optional one-line description for catalog UI. */
  description?: string
}

/**
 * Coarse projected cost the archetype's catalog UI displays before invocation.
 *
 * Real per-invocation cost lands on the Service's {@link CostModel}; this is
 * a humanised hint for "what does a Service shaped like this typically cost?"
 */
export interface ArchetypeCostEstimate {
  /** Lower-bound estimate per invocation (cents in smallest unit). */
  minPerInvocation: Money
  /** Upper-bound estimate per invocation. */
  maxPerInvocation: Money
  /** Free-form note rendered next to the estimate. */
  notes?: string
}

/**
 * Hero-template hook for the catalog UI — opaque ref to a layout component
 * the customer-runtime resolves at render time. Most archetypes can omit;
 * the catalog falls back to a generic shell.
 */
export interface ArchetypeHeroTemplate {
  /** Reference to the layout component (e.g. `'hero:cold-outbound-v1'`). */
  templateRef: string
  /** Optional override props passed to the template. */
  props?: Record<string, unknown>
}

// ============================================================================
// ServiceArchetype value type
// ============================================================================

/**
 * Specification accepted by {@link defineServiceArchetype}. Identical to
 * {@link ServiceArchetype} but `id` is required and the result is registered.
 */
export interface ServiceArchetypeSpec {
  id: ServiceArchetypeRef
  label: string
  defaultDeliveryPattern: DeliveryPattern
  inputShape: InputShapePrimitive
  outputShape: OutputShapePrimitive
  defaultOversight: ArchetypeOversightDefaults
  defaultEvaluators: EvaluatorPersonaHint[]
  estimatedCost: ArchetypeCostEstimate
  heroTemplate?: ArchetypeHeroTemplate
}

/** Materialised archetype value as stored in the registry. */
export type ServiceArchetype = Readonly<ServiceArchetypeSpec>

// ============================================================================
// Registry
// ============================================================================

/**
 * Process-local archetype registry. Tests construct a fresh instance to
 * isolate state; production code uses the singleton {@link archetypes}.
 */
export class ArchetypeRegistry {
  readonly #entries = new Map<ServiceArchetypeRef, ServiceArchetype>()

  /** Register an archetype; throws on id conflict. */
  register(spec: ServiceArchetypeSpec): ServiceArchetype {
    if (this.#entries.has(spec.id)) {
      throw new Error(`ServiceArchetype already registered: ${spec.id}`)
    }
    const archetype: ServiceArchetype = Object.freeze({ ...spec })
    this.#entries.set(spec.id, archetype)
    return archetype
  }

  /** Look up an archetype by id; returns `undefined` if unknown. */
  get(id: ServiceArchetypeRef): ServiceArchetype | undefined {
    return this.#entries.get(id)
  }

  /** All registered archetypes, in insertion order. */
  list(): ServiceArchetype[] {
    return Array.from(this.#entries.values())
  }
}

/**
 * Singleton archetype registry used by `Service.define()`. Imports from
 * `./catalog.ts` (which loads `./defaults.ts`) populate this on first use.
 */
export const archetypes = new ArchetypeRegistry()

/**
 * Factory: register an archetype on the singleton {@link archetypes} and
 * return the materialised value. Standard sugar — equivalent to
 * `archetypes.register(spec)` but reads ergonomically inline:
 *
 * @example
 * ```ts
 * export const Summarization = defineServiceArchetype({
 *   id: 'summarization',
 *   label: 'Summarization',
 *   ...
 * })
 * ```
 */
export function defineServiceArchetype(spec: ServiceArchetypeSpec): ServiceArchetype {
  return archetypes.register(spec)
}
