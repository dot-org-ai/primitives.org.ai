/**
 * Linguistic utilities - re-exported from @graphdl/core
 *
 * Provides verb conjugation, noun pluralization, and linguistic inference.
 * Used for auto-generating forms, events, and semantic metadata.
 *
 * @packageDocumentation
 */
export {
  conjugate,
  pluralize,
  singularize,
  inferNoun,
  createTypeMeta,
  getTypeMeta,
  Type,
  getVerbFields,
  capitalize,
  preserveCase,
  isVowel,
  splitCamelCase,
  toKebabCase,
  toPastParticiple,
  toActor,
  toPresent,
  toGerund,
  toResult,
  clearTypeMetaCache,
} from '@graphdl/core'
