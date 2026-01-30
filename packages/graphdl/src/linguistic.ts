/**
 * Linguistic Helpers
 *
 * Utilities for verb conjugation, noun pluralization, and linguistic inference.
 * Used for auto-generating forms, events, and semantic metadata.
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
 * ```ts
 * splitCamelCase('BlogPost')   // => ['Blog', 'Post']
 * splitCamelCase('userProfile') // => ['user', 'Profile']
 * ```
 */
export function splitCamelCase(s: string): string[] {
  return s.replace(/([a-z])([A-Z])/g, '$1 $2').split(' ')
}

/**
 * Convert words to kebab-case (URL-safe slug)
 *
 * @example
 * ```ts
 * toKebabCase('Blog Post')  // => 'blog-post'
 * toKebabCase('BlogPost')   // => 'blog-post'
 * ```
 */
export function toKebabCase(s: string): string {
  return splitCamelCase(s).join('-').toLowerCase()
}

/** Check if we should double the final consonant (CVC pattern) */
function shouldDoubleConsonant(verb: string): boolean {
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
 * Convert verb to past participle (create → created, publish → published)
 *
 * @example
 * ```ts
 * toPastParticiple('create')  // => 'created'
 * toPastParticiple('publish') // => 'published'
 * toPastParticiple('submit')  // => 'submitted'
 * ```
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
 * Convert verb to actor noun (create → creator, publish → publisher)
 *
 * @example
 * ```ts
 * toActor('create')   // => 'creator'
 * toActor('publish')  // => 'publisher'
 * toActor('submit')   // => 'submitter'
 * ```
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
 * Convert verb to present 3rd person (create → creates, publish → publishes)
 *
 * @example
 * ```ts
 * toPresent('create')  // => 'creates'
 * toPresent('publish') // => 'publishes'
 * toPresent('carry')   // => 'carries'
 * ```
 */
export function toPresent(verb: string): string {
  if (verb.endsWith('y') && !isVowel(verb[verb.length - 2])) {
    return verb.slice(0, -1) + 'ies'
  }
  if (
    verb.endsWith('s') ||
    verb.endsWith('x') ||
    verb.endsWith('z') ||
    verb.endsWith('ch') ||
    verb.endsWith('sh')
  ) {
    return verb + 'es'
  }
  return verb + 's'
}

/**
 * Convert verb to gerund (create → creating, publish → publishing)
 *
 * @example
 * ```ts
 * toGerund('create')  // => 'creating'
 * toGerund('publish') // => 'publishing'
 * toGerund('run')     // => 'running'
 * ```
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
 * Convert verb to result noun (create → creation, publish → publication)
 *
 * @example
 * ```ts
 * toResult('create')    // => 'creation'
 * toResult('publish')   // => 'publication'
 * toResult('generate')  // => 'generation'
 * ```
 */
export function toResult(verb: string): string {
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

  if (IRREGULAR_PLURALS[lower]) {
    return preserveCase(singular, IRREGULAR_PLURALS[lower])
  }

  // Rules for regular plurals
  if (lower.endsWith('y') && !isVowel(lower[lower.length - 2])) {
    return singular.slice(0, -1) + 'ies'
  }
  // Words ending in z that double: quiz → quizzes, fez → fezzes
  if (lower.endsWith('z') && !lower.endsWith('zz')) {
    return singular + 'zes'
  }
  if (
    lower.endsWith('s') ||
    lower.endsWith('x') ||
    lower.endsWith('zz') ||
    lower.endsWith('ch') ||
    lower.endsWith('sh')
  ) {
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

  if (IRREGULAR_SINGULARS[lower]) {
    return preserveCase(plural, IRREGULAR_SINGULARS[lower])
  }

  // Rules for regular singulars
  if (lower.endsWith('ies')) {
    return plural.slice(0, -3) + 'y'
  }
  if (lower.endsWith('ves')) {
    return plural.slice(0, -3) + 'f'
  }
  // Handle -es endings: sses, xes, zes, ches, shes, and also single -ses like 'buses'
  if (lower.endsWith('ses') || lower.endsWith('xes') || lower.endsWith('zes')) {
    return plural.slice(0, -2)
  }
  if (lower.endsWith('ches') || lower.endsWith('shes')) {
    return plural.slice(0, -2)
  }
  if (lower.endsWith('s') && !lower.endsWith('ss')) {
    return plural.slice(0, -1)
  }

  return plural
}
