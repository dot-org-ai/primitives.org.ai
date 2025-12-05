/**
 * Linguistic Helpers
 *
 * Utilities for verb conjugation, noun pluralization, and linguistic inference.
 * Used for auto-generating forms, events, and semantic metadata.
 *
 * @packageDocumentation
 */

import { Verbs, type Noun, type Verb, type TypeMeta } from './types.js'

// =============================================================================
// Internal Helpers
// =============================================================================

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function preserveCase(original: string, replacement: string): string {
  if (original[0] === original[0]?.toUpperCase()) {
    return capitalize(replacement)
  }
  return replacement
}

function isVowel(char: string | undefined): boolean {
  return char ? 'aeiou'.includes(char.toLowerCase()) : false
}

function splitCamelCase(s: string): string[] {
  return s.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ')
}

/** Check if we should double the final consonant (CVC pattern) */
function shouldDoubleConsonant(verb: string): boolean {
  if (verb.length < 2) return false
  const last = verb[verb.length - 1]!
  const secondLast = verb[verb.length - 2]!
  // Don't double w, x, y
  if ('wxy'.includes(last)) return false
  // Must end in consonant preceded by vowel
  if (isVowel(last) || !isVowel(secondLast)) return false
  // Common verbs that double the final consonant
  const doublingVerbs = ['submit', 'commit', 'permit', 'omit', 'admit', 'emit', 'transmit', 'refer', 'prefer', 'defer', 'occur', 'recur', 'begin', 'stop', 'drop', 'shop', 'plan', 'scan', 'ban', 'run', 'gun', 'stun', 'cut', 'shut', 'hit', 'sit', 'fit', 'spit', 'quit', 'knit', 'get', 'set', 'pet', 'wet', 'bet', 'let', 'put', 'drag', 'brag', 'flag', 'tag', 'bag', 'nag', 'wag', 'hug', 'bug', 'mug', 'tug', 'rub', 'scrub', 'grab', 'stab', 'rob', 'sob', 'throb', 'nod', 'prod', 'plod', 'plot', 'rot', 'blot', 'spot', 'knot', 'trot', 'chat', 'pat', 'bat', 'mat', 'rat', 'slap', 'clap', 'flap', 'tap', 'wrap', 'snap', 'trap', 'cap', 'map', 'nap', 'zap', 'tip', 'sip', 'dip', 'rip', 'zip', 'slip', 'trip', 'drip', 'chip', 'clip', 'flip', 'grip', 'ship', 'skip', 'whip', 'strip', 'equip', 'hop', 'pop', 'mop', 'cop', 'chop', 'crop', 'prop', 'flop', 'swim', 'trim', 'slim', 'skim', 'dim', 'rim', 'brim', 'grim', 'hem', 'stem', 'jam', 'cram', 'ram', 'slam', 'dam', 'ham', 'scam', 'spam', 'tram', 'hum', 'drum', 'strum', 'sum', 'gum', 'chum', 'plum']
  // Short words (3 letters) almost always double
  if (verb.length <= 3) return true
  // Check if verb matches any known doubling pattern
  return doublingVerbs.some(v => verb === v || verb.endsWith(v))
}

/** Convert verb to past participle (create → created, publish → published) */
function toPastParticiple(verb: string): string {
  if (verb.endsWith('e')) return verb + 'd'
  if (verb.endsWith('y') && !isVowel(verb[verb.length - 2])) {
    return verb.slice(0, -1) + 'ied'
  }
  if (shouldDoubleConsonant(verb)) {
    return verb + verb[verb.length - 1] + 'ed'
  }
  return verb + 'ed'
}

/** Convert verb to actor noun (create → creator, publish → publisher) */
function toActor(verb: string): string {
  if (verb.endsWith('e')) return verb + 'r'
  if (verb.endsWith('y') && !isVowel(verb[verb.length - 2])) {
    return verb.slice(0, -1) + 'ier'
  }
  if (shouldDoubleConsonant(verb)) {
    return verb + verb[verb.length - 1] + 'er'
  }
  return verb + 'er'
}

/** Convert verb to present 3rd person (create → creates, publish → publishes) */
function toPresent(verb: string): string {
  if (verb.endsWith('y') && !isVowel(verb[verb.length - 2])) {
    return verb.slice(0, -1) + 'ies'
  }
  if (verb.endsWith('s') || verb.endsWith('x') || verb.endsWith('z') ||
      verb.endsWith('ch') || verb.endsWith('sh')) {
    return verb + 'es'
  }
  return verb + 's'
}

/** Convert verb to gerund (create → creating, publish → publishing) */
function toGerund(verb: string): string {
  if (verb.endsWith('ie')) return verb.slice(0, -2) + 'ying'
  if (verb.endsWith('e') && !verb.endsWith('ee')) return verb.slice(0, -1) + 'ing'
  if (shouldDoubleConsonant(verb)) {
    return verb + verb[verb.length - 1] + 'ing'
  }
  return verb + 'ing'
}

/** Convert verb to result noun (create → creation, publish → publication) */
function toResult(verb: string): string {
  // Common -ate → -ation
  if (verb.endsWith('ate')) return verb.slice(0, -1) + 'ion'
  // Common -ify → -ification
  if (verb.endsWith('ify')) return verb.slice(0, -1) + 'ication'
  // Common -ize → -ization
  if (verb.endsWith('ize')) return verb.slice(0, -1) + 'ation'
  // Common -e → -ion (but not always correct)
  if (verb.endsWith('e')) return verb.slice(0, -1) + 'ion'
  // Default: just add -ion
  return verb + 'ion'
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Auto-conjugate a verb from just the base form
 *
 * Given just "publish", generates all forms:
 * - actor: publisher
 * - act: publishes
 * - activity: publishing
 * - result: publication
 * - reverse: { at: publishedAt, by: publishedBy, ... }
 *
 * @example
 * ```ts
 * conjugate('publish')
 * // => { action: 'publish', actor: 'publisher', act: 'publishes', activity: 'publishing', ... }
 *
 * conjugate('create')
 * // => { action: 'create', actor: 'creator', act: 'creates', activity: 'creating', ... }
 * ```
 */
export function conjugate(action: string): Verb {
  // Check if it's a known verb first
  if (action in Verbs) {
    return Verbs[action as keyof typeof Verbs]
  }

  const base = action.toLowerCase()
  const pastParticiple = toPastParticiple(base)

  return {
    action: base,
    actor: toActor(base),
    act: toPresent(base),
    activity: toGerund(base),
    result: toResult(base),
    reverse: {
      at: `${pastParticiple}At`,
      by: `${pastParticiple}By`,
      in: `${pastParticiple}In`,
      for: `${pastParticiple}For`,
    },
  }
}

/**
 * Auto-pluralize a noun
 *
 * @example
 * ```ts
 * pluralize('post')     // => 'posts'
 * pluralize('category') // => 'categories'
 * pluralize('person')   // => 'people'
 * pluralize('child')    // => 'children'
 * ```
 */
export function pluralize(singular: string): string {
  const lower = singular.toLowerCase()

  // Irregular plurals
  const irregulars: Record<string, string> = {
    person: 'people',
    child: 'children',
    man: 'men',
    woman: 'women',
    foot: 'feet',
    tooth: 'teeth',
    goose: 'geese',
    mouse: 'mice',
    ox: 'oxen',
    leaf: 'leaves',
    life: 'lives',
    knife: 'knives',
    wife: 'wives',
    half: 'halves',
    self: 'selves',
    calf: 'calves',
    analysis: 'analyses',
    crisis: 'crises',
    thesis: 'theses',
    datum: 'data',
    medium: 'media',
    criterion: 'criteria',
    phenomenon: 'phenomena',
  }

  if (irregulars[lower]) {
    return preserveCase(singular, irregulars[lower])
  }

  // Rules for regular plurals
  if (lower.endsWith('y') && !isVowel(lower[lower.length - 2])) {
    return singular.slice(0, -1) + 'ies'
  }
  // Words ending in z that double: quiz → quizzes, fez → fezzes
  if (lower.endsWith('z') && !lower.endsWith('zz')) {
    return singular + 'zes'
  }
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('zz') ||
      lower.endsWith('ch') || lower.endsWith('sh')) {
    return singular + 'es'
  }
  if (lower.endsWith('f')) {
    return singular.slice(0, -1) + 'ves'
  }
  if (lower.endsWith('fe')) {
    return singular.slice(0, -2) + 'ves'
  }

  return singular + 's'
}

/**
 * Auto-singularize a noun (reverse of pluralize)
 *
 * @example
 * ```ts
 * singularize('posts')      // => 'post'
 * singularize('categories') // => 'category'
 * singularize('people')     // => 'person'
 * ```
 */
export function singularize(plural: string): string {
  const lower = plural.toLowerCase()

  // Irregular singulars
  const irregulars: Record<string, string> = {
    people: 'person',
    children: 'child',
    men: 'man',
    women: 'woman',
    feet: 'foot',
    teeth: 'tooth',
    geese: 'goose',
    mice: 'mouse',
    oxen: 'ox',
    leaves: 'leaf',
    lives: 'life',
    knives: 'knife',
    wives: 'wife',
    halves: 'half',
    selves: 'self',
    calves: 'calf',
    analyses: 'analysis',
    crises: 'crisis',
    theses: 'thesis',
    data: 'datum',
    media: 'medium',
    criteria: 'criterion',
    phenomena: 'phenomenon',
  }

  if (irregulars[lower]) {
    return preserveCase(plural, irregulars[lower])
  }

  // Rules for regular singulars
  if (lower.endsWith('ies')) {
    return plural.slice(0, -3) + 'y'
  }
  if (lower.endsWith('ves')) {
    return plural.slice(0, -3) + 'f'
  }
  if (lower.endsWith('es') && (
    lower.endsWith('sses') || lower.endsWith('xes') || lower.endsWith('zes') ||
    lower.endsWith('ches') || lower.endsWith('shes')
  )) {
    return plural.slice(0, -2)
  }
  if (lower.endsWith('s') && !lower.endsWith('ss')) {
    return plural.slice(0, -1)
  }

  return plural
}

/**
 * Infer a complete Noun from just a type name
 *
 * @example
 * ```ts
 * inferNoun('BlogPost')
 * // => { singular: 'blog post', plural: 'blog posts', ... }
 *
 * inferNoun('Category')
 * // => { singular: 'category', plural: 'categories', ... }
 * ```
 */
export function inferNoun(typeName: string): Noun {
  const words = splitCamelCase(typeName)
  const singular = words.join(' ').toLowerCase()
  const plural = words.slice(0, -1).concat(pluralize(words[words.length - 1]!)).join(' ').toLowerCase()

  return {
    singular,
    plural,
    actions: ['create', 'update', 'delete'],
    events: ['created', 'updated', 'deleted'],
  }
}

/**
 * Create TypeMeta from a type name - all linguistic forms auto-inferred
 *
 * @example
 * ```ts
 * const meta = createTypeMeta('BlogPost')
 * meta.singular  // 'blog post'
 * meta.plural    // 'blog posts'
 * meta.slug      // 'blog-post'
 * meta.created   // 'BlogPost.created'
 * meta.createdAt // 'createdAt'
 * meta.creator   // 'creator'
 * ```
 */
export function createTypeMeta(typeName: string): TypeMeta {
  const noun = inferNoun(typeName)
  const slug = noun.singular.replace(/\s+/g, '-')
  const slugPlural = noun.plural.replace(/\s+/g, '-')

  return {
    name: typeName,
    singular: noun.singular,
    plural: noun.plural,
    slug,
    slugPlural,

    // From Verbs.create
    creator: 'creator',
    createdAt: 'createdAt',
    createdBy: 'createdBy',
    updatedAt: 'updatedAt',
    updatedBy: 'updatedBy',

    // Event types
    created: `${typeName}.created`,
    updated: `${typeName}.updated`,
    deleted: `${typeName}.deleted`,
  }
}

/** Cache of TypeMeta by type name */
const typeMetaCache = new Map<string, TypeMeta>()

/**
 * Get or create TypeMeta for a type name (cached)
 */
export function getTypeMeta(typeName: string): TypeMeta {
  let meta = typeMetaCache.get(typeName)
  if (!meta) {
    meta = createTypeMeta(typeName)
    typeMetaCache.set(typeName, meta)
  }
  return meta
}

/**
 * Type proxy - provides dynamic access to type metadata
 *
 * @example
 * ```ts
 * const Post = Type('Post')
 * Post.singular  // 'post'
 * Post.plural    // 'posts'
 * Post.created   // 'Post.created'
 *
 * // In event handlers:
 * on.create(thing => {
 *   console.log(thing.$type.plural)  // 'posts'
 * })
 * ```
 */
export function Type(name: string): TypeMeta {
  return getTypeMeta(name)
}

/**
 * Get reverse property names for a verb action
 *
 * @example
 * ```ts
 * getVerbFields('create')
 * // => { at: 'createdAt', by: 'createdBy', in: 'createdIn', for: 'createdFor' }
 *
 * getVerbFields('publish')
 * // => { at: 'publishedAt', by: 'publishedBy' }
 * ```
 */
export function getVerbFields(action: keyof typeof Verbs): Record<string, string> {
  return Verbs[action]?.reverse ?? {}
}
