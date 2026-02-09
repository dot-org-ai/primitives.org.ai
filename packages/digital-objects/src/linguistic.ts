/**
 * Linguistic utilities for auto-deriving noun and verb forms
 */

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
    index: 'indices',
    vertex: 'vertices',
    matrix: 'matrices',
  }

  if (irregulars[w]) return irregulars[w]

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
    indices: 'index',
    vertices: 'vertex',
    matrices: 'matrix',
  }

  if (irregulars[w]) return irregulars[w]

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
 *   reverseAt: 'createdAt'
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
    rollout: { act: 'rollsout', activity: 'rollingout', event: 'rolledout' },
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
  } else if (/[^aeiou][aeiou][bcdfghlmnprstvwz]$/.test(base) && base.length <= 6) {
    // Double final consonant for short words (CVC pattern)
    activity = base + base[base.length - 1] + 'ing'
  } else {
    activity = base + 'ing'
  }

  // Past participle (event)
  if (base.endsWith('e')) {
    event = base + 'd'
  } else if (base.endsWith('y') && !/[aeiou]y$/.test(base)) {
    event = base.slice(0, -1) + 'ied'
  } else if (/[^aeiou][aeiou][bcdfghlmnprstvwz]$/.test(base) && base.length <= 6) {
    // Double final consonant for short words
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
