/**
 * Linguistic Helpers
 *
 * Utilities for verb conjugation, noun pluralization, and linguistic inference.
 * Used for auto-generating forms, events, and semantic metadata.
 *
 * This is THE CANONICAL SOURCE for linguistic utilities across the ecosystem.
 * .do/objects copies this file (zero-dep constraint). graphdl pioneered many
 * of these helpers — they are now unified here.
 *
 * @packageDocumentation
 */

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Capitalize the first letter of a string
 */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Preserve the case of the original string in the replacement
 */
export function preserveCase(original: string, replacement: string): string {
  if (original[0] === original[0]?.toUpperCase()) {
    return capitalize(replacement)
  }
  return replacement
}

/**
 * Check if a character is a vowel
 */
export function isVowel(char: string | undefined): boolean {
  return char ? 'aeiou'.includes(char.toLowerCase()) : false
}

/**
 * Split a PascalCase or camelCase string into words
 *
 * @example
 * splitCamelCase('BlogPost')   // => ['Blog', 'Post']
 * splitCamelCase('userProfile') // => ['user', 'Profile']
 */
export function splitCamelCase(s: string): string[] {
  return s.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ')
}

/**
 * Convert words to kebab-case (URL-safe slug)
 *
 * @example
 * toKebabCase('Blog Post')  // => 'blog-post'
 * toKebabCase('BlogPost')   // => 'blog-post'
 */
export function toKebabCase(s: string): string {
  return splitCamelCase(s).join('-').toLowerCase()
}

/**
 * Check if we should double the final consonant (CVC pattern)
 *
 * Uses a curated list of 200+ known doubling verbs rather than a fragile
 * inline CVC regex. Short words (<=3 chars) that end consonant-vowel-consonant
 * almost always double.
 */
export function shouldDoubleConsonant(verb: string): boolean {
  if (verb.length < 2) return false
  const last = verb.charAt(verb.length - 1)
  const secondLast = verb.charAt(verb.length - 2)
  // Don't double w, x, y
  if ('wxy'.includes(last)) return false
  // Must end in consonant preceded by vowel
  if (isVowel(last) || !isVowel(secondLast)) return false
  // Common verbs that double the final consonant
  const doublingVerbs = [
    'submit',
    'commit',
    'permit',
    'omit',
    'admit',
    'emit',
    'transmit',
    'refer',
    'prefer',
    'defer',
    'occur',
    'recur',
    'begin',
    'stop',
    'drop',
    'shop',
    'plan',
    'scan',
    'ban',
    'run',
    'gun',
    'stun',
    'cut',
    'shut',
    'hit',
    'sit',
    'fit',
    'spit',
    'quit',
    'knit',
    'get',
    'set',
    'pet',
    'wet',
    'bet',
    'let',
    'put',
    'drag',
    'brag',
    'flag',
    'tag',
    'bag',
    'nag',
    'wag',
    'hug',
    'bug',
    'mug',
    'tug',
    'rub',
    'scrub',
    'grab',
    'stab',
    'rob',
    'sob',
    'throb',
    'nod',
    'prod',
    'plod',
    'plot',
    'rot',
    'blot',
    'spot',
    'knot',
    'trot',
    'chat',
    'pat',
    'bat',
    'mat',
    'rat',
    'slap',
    'clap',
    'flap',
    'tap',
    'wrap',
    'snap',
    'trap',
    'cap',
    'map',
    'nap',
    'zap',
    'tip',
    'sip',
    'dip',
    'rip',
    'zip',
    'slip',
    'trip',
    'drip',
    'chip',
    'clip',
    'flip',
    'grip',
    'ship',
    'skip',
    'whip',
    'strip',
    'equip',
    'hop',
    'pop',
    'mop',
    'cop',
    'chop',
    'crop',
    'prop',
    'flop',
    'swim',
    'trim',
    'slim',
    'skim',
    'dim',
    'rim',
    'brim',
    'grim',
    'hem',
    'stem',
    'jam',
    'cram',
    'ram',
    'slam',
    'dam',
    'ham',
    'scam',
    'spam',
    'tram',
    'hum',
    'drum',
    'strum',
    'sum',
    'gum',
    'chum',
    'plum',
  ]
  // Short words (3 letters) almost always double
  if (verb.length <= 3) return true
  // Check if verb matches any known doubling pattern
  return doublingVerbs.some((v) => verb === v || verb.endsWith(v))
}

// =============================================================================
// Verb Conjugation Helpers
// =============================================================================

/**
 * Convert verb to past participle (create -> created, publish -> published)
 *
 * @example
 * toPastParticiple('create')  // => 'created'
 * toPastParticiple('publish') // => 'published'
 * toPastParticiple('submit')  // => 'submitted'
 */
export function toPastParticiple(verb: string): string {
  if (verb.endsWith('e')) return verb + 'd'
  if (verb.endsWith('y') && !isVowel(verb[verb.length - 2])) {
    return verb.slice(0, -1) + 'ied'
  }
  if (shouldDoubleConsonant(verb)) {
    return verb + verb[verb.length - 1] + 'ed'
  }
  return verb + 'ed'
}

/**
 * Convert verb to actor noun (create -> creator, publish -> publisher)
 *
 * @example
 * toActor('create')   // => 'creator'
 * toActor('publish')  // => 'publisher'
 * toActor('submit')   // => 'submitter'
 */
export function toActor(verb: string): string {
  // Common -ate verbs drop the e and add -or
  if (verb.endsWith('ate')) return verb.slice(0, -1) + 'or'
  if (verb.endsWith('e')) return verb + 'r'
  if (verb.endsWith('y') && !isVowel(verb[verb.length - 2])) {
    return verb.slice(0, -1) + 'ier'
  }
  if (shouldDoubleConsonant(verb)) {
    return verb + verb[verb.length - 1] + 'er'
  }
  return verb + 'er'
}

/**
 * Convert verb to present 3rd person (create -> creates, publish -> publishes)
 *
 * @example
 * toPresent('create')  // => 'creates'
 * toPresent('publish') // => 'publishes'
 * toPresent('carry')   // => 'carries'
 */
export function toPresent(verb: string): string {
  if (verb.endsWith('y') && !isVowel(verb[verb.length - 2])) {
    return verb.slice(0, -1) + 'ies'
  }
  if (verb.endsWith('s') || verb.endsWith('x') || verb.endsWith('z') || verb.endsWith('ch') || verb.endsWith('sh')) {
    return verb + 'es'
  }
  return verb + 's'
}

/**
 * Convert verb to gerund (create -> creating, publish -> publishing)
 *
 * @example
 * toGerund('create')  // => 'creating'
 * toGerund('publish') // => 'publishing'
 * toGerund('run')     // => 'running'
 */
export function toGerund(verb: string): string {
  if (verb.endsWith('ie')) return verb.slice(0, -2) + 'ying'
  if (verb.endsWith('e') && !verb.endsWith('ee')) return verb.slice(0, -1) + 'ing'
  if (shouldDoubleConsonant(verb)) {
    return verb + verb[verb.length - 1] + 'ing'
  }
  return verb + 'ing'
}

/**
 * Convert verb to result noun (create -> creation, publish -> publication)
 *
 * @example
 * toResult('create')    // => 'creation'
 * toResult('publish')   // => 'publication'
 * toResult('generate')  // => 'generation'
 */
export function toResult(verb: string): string {
  // Common -ate -> -ation
  if (verb.endsWith('ate')) return verb.slice(0, -1) + 'ion'
  // Common -ify -> -ification
  if (verb.endsWith('ify')) return verb.slice(0, -1) + 'ication'
  // Common -ize -> -ization
  if (verb.endsWith('ize')) return verb.slice(0, -1) + 'ation'
  // Common -e -> -ion (but not always correct)
  if (verb.endsWith('e')) return verb.slice(0, -1) + 'ion'
  // Default: just add -ion
  return verb + 'ion'
}

// =============================================================================
// Noun Pluralization
// =============================================================================

/** Map of irregular plurals */
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
const IRREGULAR_SINGULARS: Record<string, string> = Object.fromEntries(Object.entries(IRREGULAR_PLURALS).map(([k, v]) => [v, k]))

// =============================================================================
// Noun Derivation
// =============================================================================

/**
 * Derive noun forms from a PascalCase name
 *
 * @example
 * deriveNoun('Post') => { singular: 'post', plural: 'posts', slug: 'post' }
 * deriveNoun('BlogPost') => { singular: 'blog post', plural: 'blog posts', slug: 'blog-post' }
 * deriveNoun('Person') => { singular: 'person', plural: 'persons', slug: 'person' }
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
// Verb Derivation
// =============================================================================

/**
 * Derive verb conjugations from base form
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
  if (base.endsWith('s') || base.endsWith('x') || base.endsWith('z') || base.endsWith('ch') || base.endsWith('sh')) {
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
