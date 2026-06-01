/**
 * Linguistic Helpers
 *
 * digital-objects shares its linguistics with `@graphdl/core` (Layer 0). The
 * generic, byte-identical helpers (case utilities, the verb conjugation
 * helpers, and `shouldDoubleConsonant`) are now RE-EXPORTED from graphdl rather
 * than duplicated here — graphdl is the canonical home for the shared schema/
 * linguistics vocabulary.
 *
 * This file keeps only the pieces where digital-objects intentionally DIVERGES
 * from or EXTENDS graphdl:
 *
 * - `pluralize` / `singularize` — digital-objects carries extra technical
 *   irregulars (`index`/`vertex`/`matrix`) and multi-word phrase handling, and
 *   deliberately differs from graphdl on a couple of edge cases (e.g.
 *   `quiz → quizes`, single-z). graphdl's published `pluralize` has its own
 *   behavioral contract (`quiz → quizzes`), so the two cannot be unified
 *   without breaking one suite. digital-objects keeps its superset variant.
 * - `deriveNoun` / `deriveVerb` — the SVO-runtime derivation helpers that
 *   graphdl does not provide (graphdl exposes `inferNoun`/`conjugate` instead,
 *   which use graphdl's nested `reverse: { at, by, in, for }` representation;
 *   digital-objects derives the flat `reverseBy`/`reverseAt`/`reverseIn` +
 *   `event` form used throughout its runtime).
 *
 * @packageDocumentation
 */

// =============================================================================
// Shared helpers re-exported from @graphdl/core (single source of truth)
// =============================================================================

import { shouldDoubleConsonant, preserveCase } from '@graphdl/core'

export {
  capitalize,
  preserveCase,
  isVowel,
  splitCamelCase,
  toKebabCase,
  shouldDoubleConsonant,
  toPastParticiple,
  toActor,
  toPresent,
  toGerund,
  toResult,
} from '@graphdl/core'

// =============================================================================
// Noun Pluralization (digital-objects variant — superset of graphdl's)
// =============================================================================

/** Map of irregular plurals (includes technical irregulars graphdl omits) */
const IRREGULAR_PLURALS: Record<string, string> = {
  person: 'people',
  child: 'children',
  man: 'men',
  woman: 'women',
  foot: 'feet',
  tooth: 'teeth',
  goose: 'geese',
  mouse: 'mice',
  ox: 'oxen',
  index: 'indices',
  vertex: 'vertices',
  matrix: 'matrices',
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

/** Reverse map of irregular singulars */
const IRREGULAR_SINGULARS: Record<string, string> = Object.fromEntries(
  Object.entries(IRREGULAR_PLURALS).map(([k, v]) => [v, k])
)

/**
 * Pluralize a word
 *
 * Handles common English pluralization rules:
 * - Words ending in 's', 'x', 'z', 'ch', 'sh' -> add 'es'
 * - Words ending in consonant + 'y' -> replace 'y' with 'ies'
 * - Words ending in 'f' or 'fe' -> replace with 'ves'
 * - Special cases (person->people, child->children, etc.)
 * - Default: add 's'
 */
export function pluralize(word: string): string {
  // Handle multi-word phrases (pluralize last word only)
  const parts = word.split(' ')
  if (parts.length > 1) {
    const lastIdx = parts.length - 1
    parts[lastIdx] = pluralize(parts[lastIdx]!)
    return parts.join(' ')
  }

  const w = word.toLowerCase()

  // Irregular plurals
  if (IRREGULAR_PLURALS[w]) return preserveCase(word, IRREGULAR_PLURALS[w])

  // Words ending in 's', 'x', 'z', 'ch', 'sh' -> add 'es'
  if (/[sxz]$/.test(w) || /[sc]h$/.test(w)) {
    return w + 'es'
  }

  // Words ending in consonant + 'y' -> replace 'y' with 'ies'
  if (/[^aeiou]y$/.test(w)) {
    return w.slice(0, -1) + 'ies'
  }

  // Words ending in 'f' -> replace with 'ves'
  if (/f$/.test(w)) {
    return w.slice(0, -1) + 'ves'
  }

  // Words ending in 'fe' -> replace with 'ves'
  if (/fe$/.test(w)) {
    return w.slice(0, -2) + 'ves'
  }

  // Default: add 's'
  return w + 's'
}

/**
 * Singularize a word (reverse of pluralize)
 */
export function singularize(word: string): string {
  // Handle multi-word phrases
  const parts = word.split(' ')
  if (parts.length > 1) {
    const lastIdx = parts.length - 1
    parts[lastIdx] = singularize(parts[lastIdx]!)
    return parts.join(' ')
  }

  const w = word.toLowerCase()

  // Irregular singulars (reverse of irregulars)
  if (IRREGULAR_SINGULARS[w]) return preserveCase(word, IRREGULAR_SINGULARS[w])

  // Words ending in 'ies' -> replace with 'y'
  if (/ies$/.test(w)) {
    return w.slice(0, -3) + 'y'
  }

  // Words ending in 'ves' -> replace with 'f' or 'fe'
  if (/ves$/.test(w)) {
    // Default to 'f' (most common, e.g., 'leaves' -> 'leaf')
    const fSingular = w.slice(0, -3) + 'f'
    return fSingular
  }

  // Words ending in 'es' (but not 'ies' or 'ves')
  if (/[sxz]es$/.test(w) || /[sc]hes$/.test(w)) {
    return w.slice(0, -2)
  }

  // Words ending in 's' (but not 'es')
  if (/s$/.test(w) && !/ss$/.test(w)) {
    return w.slice(0, -1)
  }

  return w
}

// =============================================================================
// Noun Derivation (digital-objects SVO runtime — not in graphdl)
// =============================================================================

/**
 * Derive noun forms from a PascalCase name
 *
 * @example
 * deriveNoun('Post') => { singular: 'post', plural: 'posts', slug: 'post' }
 * deriveNoun('BlogPost') => { singular: 'blog post', plural: 'blog posts', slug: 'blog-post' }
 * deriveNoun('Person') => { singular: 'person', plural: 'people', slug: 'person' }
 */
export function deriveNoun(name: string): { singular: string; plural: string; slug: string } {
  // Convert PascalCase to words
  const words = name
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
  const singular = words
  const slug = words.replace(/\s+/g, '-')
  const plural = pluralize(singular)

  return { singular, plural, slug }
}

// =============================================================================
// Verb Derivation (digital-objects SVO runtime — not in graphdl)
// =============================================================================

/**
 * Derive verb conjugations from base form
 *
 * Produces the FLAT reverse-form representation (`reverseBy`/`reverseAt`/
 * `reverseIn`) plus the past-participle `event`, which is the canonical
 * runtime shape digital-objects uses for the event bus and audit trail.
 * (graphdl's `conjugate()` instead returns the nested `reverse: { at, by,
 * in, for }` + `result`/`actor` static-vocabulary shape.)
 *
 * @example
 * deriveVerb('create') => {
 *   action: 'create',
 *   act: 'creates',
 *   activity: 'creating',
 *   event: 'created',
 *   reverseBy: 'createdBy',
 *   reverseAt: 'createdAt',
 *   reverseIn: 'createdIn'
 * }
 */
export function deriveVerb(name: string): {
  action: string
  act: string
  activity: string
  event: string
  reverseBy: string
  reverseAt: string
  reverseIn: string
} {
  const base = name.toLowerCase()

  // Known irregular verbs
  const irregulars: Record<string, { act: string; activity: string; event: string }> = {
    write: { act: 'writes', activity: 'writing', event: 'written' },
    read: { act: 'reads', activity: 'reading', event: 'read' },
    run: { act: 'runs', activity: 'running', event: 'run' },
    begin: { act: 'begins', activity: 'beginning', event: 'begun' },
    do: { act: 'does', activity: 'doing', event: 'done' },
    go: { act: 'goes', activity: 'going', event: 'gone' },
    have: { act: 'has', activity: 'having', event: 'had' },
    be: { act: 'is', activity: 'being', event: 'been' },
    set: { act: 'sets', activity: 'setting', event: 'set' },
    get: { act: 'gets', activity: 'getting', event: 'got' },
    put: { act: 'puts', activity: 'putting', event: 'put' },
    cut: { act: 'cuts', activity: 'cutting', event: 'cut' },
    hit: { act: 'hits', activity: 'hitting', event: 'hit' },
    lose: { act: 'loses', activity: 'losing', event: 'lost' },
    win: { act: 'wins', activity: 'winning', event: 'won' },
    pay: { act: 'pays', activity: 'paying', event: 'paid' },
    reopen: { act: 'reopens', activity: 'reopening', event: 'reopened' },
    rollout: { act: 'rollouts', activity: 'rollingOut', event: 'rolledOut' },
    cancel: { act: 'cancels', activity: 'cancelling', event: 'cancelled' },
  }

  if (irregulars[base]) {
    const irr = irregulars[base]
    return {
      action: base,
      act: irr.act,
      activity: irr.activity,
      event: irr.event,
      reverseBy: `${irr.event}By`,
      reverseAt: `${irr.event}At`,
      reverseIn: `${irr.event}In`,
    }
  }

  // Regular verb conjugations
  let act: string
  let activity: string
  let event: string

  // Third person singular (act)
  if (
    base.endsWith('s') ||
    base.endsWith('x') ||
    base.endsWith('z') ||
    base.endsWith('ch') ||
    base.endsWith('sh')
  ) {
    act = base + 'es'
  } else if (base.endsWith('y') && !/[aeiou]y$/.test(base)) {
    act = base.slice(0, -1) + 'ies'
  } else {
    act = base + 's'
  }

  // Present participle (activity) - gerund
  if (base.endsWith('e') && !base.endsWith('ee')) {
    activity = base.slice(0, -1) + 'ing'
  } else if (base.endsWith('ie')) {
    activity = base.slice(0, -2) + 'ying'
  } else if (shouldDoubleConsonant(base)) {
    activity = base + base[base.length - 1] + 'ing'
  } else {
    activity = base + 'ing'
  }

  // Past participle (event)
  if (base.endsWith('e')) {
    event = base + 'd'
  } else if (base.endsWith('y') && !/[aeiou]y$/.test(base)) {
    event = base.slice(0, -1) + 'ied'
  } else if (shouldDoubleConsonant(base)) {
    event = base + base[base.length - 1] + 'ed'
  } else {
    event = base + 'ed'
  }

  return {
    action: base,
    act,
    activity,
    event,
    reverseBy: `${event}By`,
    reverseAt: `${event}At`,
    reverseIn: `${event}In`,
  }
}
