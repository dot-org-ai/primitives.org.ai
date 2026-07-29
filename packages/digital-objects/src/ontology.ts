/**
 * Ontology() — the storage-agnostic SVO vocabulary factory.
 *
 * This is the seam between `@graphdl/core` (the static schema/vocabulary DSL)
 * and digital-objects (the SVO runtime). `Ontology(schema, opts?)`:
 *
 *   1. wraps graphdl's `Graph(schema)` to parse the entity vocabulary,
 *   2. derives the digital-objects runtime `Noun` forms for each entity,
 *   3. builds the verb vocabulary (default CRUD + any declared verbs), layering
 *      the SVO `Frame` (complement-role) grammar onto verbs, and
 *   4. binds an optional `DigitalObjectsProvider`.
 *
 * The result is a PURE, storage-agnostic vocabulary: no I/O is performed during
 * construction. The bound provider (if any) is simply held for callers that
 * want to drive instances/actions through it later.
 *
 * `DO()` and `Noun()` (the instance-proxy factories) are now deprecated in
 * favour of `Ontology()` for vocabulary definition. See their JSDoc.
 *
 * @packageDocumentation
 */

import { Graph, getEntityNames } from '@graphdl/core'
import type { GraphInput, ParsedGraph } from '@graphdl/core'
import type {
  DigitalObjectsProvider,
  Frame,
  Noun,
  Verb,
  VerbDefinition,
  VerbSource,
} from './types.js'
import { deriveNoun, deriveVerb } from './linguistic.js'

/**
 * Default CRUD verbs added to every Ontology unless overridden.
 */
const DEFAULT_CRUD_VERBS = ['create', 'update', 'delete'] as const

/**
 * A verb specification accepted by `Ontology`'s `verbs` option:
 * - a bare `Frame` (sugar — declares only the complement-role grammar), or
 * - a partial `VerbDefinition` (frame + provenance + overrides), or
 * - `null` to DISABLE a default CRUD verb.
 */
export type VerbSpec = Frame | Partial<VerbDefinition> | null

/**
 * Options for `Ontology()`.
 */
export interface OntologyOptions {
  /**
   * Declared verbs keyed by base action name. A value may be a bare `Frame`
   * (sugar), a partial `VerbDefinition`, or `null` to disable a default CRUD
   * verb. Verbs not listed here still get the default CRUD set.
   */
  verbs?: Record<string, VerbSpec> | undefined
  /**
   * An optional storage provider to bind. Held but NOT used during
   * construction — `Ontology` performs no I/O.
   */
  provider?: DigitalObjectsProvider | undefined
}

/**
 * A storage-agnostic SVO vocabulary produced by `Ontology()`.
 */
export interface OntologyVocabulary {
  /** The parsed graphdl graph (entities + typeUris). */
  readonly graph: ParsedGraph
  /** Runtime Noun definitions keyed by entity name. */
  readonly nouns: ReadonlyMap<string, Noun>
  /** Runtime Verb definitions keyed by base action name. */
  readonly verbs: ReadonlyMap<string, Verb>
  /** The bound provider, if any (no I/O performed during construction). */
  readonly provider: DigitalObjectsProvider | undefined

  /** Entity names in the vocabulary. */
  nounNames(): string[]
  /** Whether a noun exists. */
  hasNoun(name: string): boolean
  /** Look up a noun by name. */
  getNoun(name: string): Noun | undefined

  /** Verb action names in the vocabulary. */
  verbNames(): string[]
  /** Whether a verb exists. */
  hasVerb(action: string): boolean
  /** Look up a verb by action name. */
  getVerb(action: string): Verb | undefined
}

/** Detect whether a verb spec is a bare Frame (has a `subject`) vs a definition. */
function isFrame(spec: Partial<VerbDefinition> | Frame): spec is Frame {
  return typeof (spec as Frame).subject === 'string'
}

/**
 * Build a runtime Verb from a base action name and an optional spec.
 */
function buildVerb(action: string, spec?: Partial<VerbDefinition> | Frame): Verb {
  const derived = deriveVerb(action)

  let frame: Frame | undefined
  let def: Partial<VerbDefinition> = {}
  if (spec) {
    if (isFrame(spec)) {
      frame = spec
    } else {
      def = spec
      frame = spec.frame
    }
  }

  const verb: Verb = {
    name: def.name ?? action,
    action: def.action ?? derived.action,
    act: def.act ?? derived.act,
    activity: def.activity ?? derived.activity,
    event: def.event ?? derived.event,
    reverseBy: def.reverseBy ?? derived.reverseBy,
    reverseAt: def.reverseAt ?? derived.reverseAt,
    reverseIn: def.reverseIn ?? derived.reverseIn,
    source: (def.source as VerbSource | undefined) ?? 'domain',
    canonical: def.canonical ?? false,
    createdAt: new Date(),
  }
  if (def.inverse !== undefined) verb.inverse = def.inverse
  if (def.description !== undefined) verb.description = def.description
  if (frame !== undefined) verb.frame = frame
  return verb
}

/**
 * Build the runtime `Noun` for a graphdl entity.
 */
function buildNoun(name: string): Noun {
  const derived = deriveNoun(name)
  return {
    name,
    singular: derived.singular,
    plural: derived.plural,
    slug: derived.slug,
    createdAt: new Date(),
  }
}

/**
 * Define a storage-agnostic SVO vocabulary from a graphdl schema.
 *
 * @example
 * ```ts
 * const onto = Ontology(
 *   {
 *     Post: { $type: 'https://schema.org.ai/Post', title: 'string', author: '->Author.posts' },
 *     Author: { name: 'string' },
 *   },
 *   {
 *     verbs: { publish: { frame: { subject: 'Author', object: 'Post' } } },
 *     provider: createMemoryProvider(),
 *   }
 * )
 *
 * onto.getNoun('Post')      // runtime Noun (singular/plural/slug)
 * onto.getVerb('publish')   // runtime Verb with frame + event 'published'
 * onto.provider             // the bound provider (no I/O was performed)
 * ```
 */
export function Ontology(schema: GraphInput, opts: OntologyOptions = {}): OntologyVocabulary {
  const graph = Graph(schema)

  // Nouns — one per graphdl entity.
  const nouns = new Map<string, Noun>()
  for (const name of getEntityNames(graph)) {
    nouns.set(name, buildNoun(name))
  }

  // Verbs — default CRUD set, minus any disabled (null) ones, plus declared.
  const verbSpecs = opts.verbs ?? {}
  const disabled = new Set<string>()
  for (const [action, spec] of Object.entries(verbSpecs)) {
    if (spec === null) disabled.add(action)
  }

  const verbs = new Map<string, Verb>()
  for (const action of DEFAULT_CRUD_VERBS) {
    if (!disabled.has(action)) {
      verbs.set(action, buildVerb(action, verbSpecs[action] ?? undefined))
    }
  }
  for (const [action, spec] of Object.entries(verbSpecs)) {
    if (spec === null) continue
    verbs.set(action, buildVerb(action, spec))
  }

  return {
    graph,
    nouns,
    verbs,
    provider: opts.provider,

    nounNames: () => [...nouns.keys()],
    hasNoun: (name: string) => nouns.has(name),
    getNoun: (name: string) => nouns.get(name),

    verbNames: () => [...verbs.keys()],
    hasVerb: (action: string) => verbs.has(action),
    getVerb: (action: string) => verbs.get(action),
  }
}
