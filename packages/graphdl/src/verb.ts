/**
 * Verb Definitions and Conjugation
 *
 * Provides CRUD verbs with full conjugation and the conjugate() function
 * for auto-generating verb forms from base actions.
 *
 * @packageDocumentation
 */

import type { Verb } from './types.js'
import { toPastParticiple, toActor, toPresent, toGerund, toResult } from './linguistic.js'

// =============================================================================
// Standard CRUD Verbs
// =============================================================================

/**
 * Standard CRUD verbs with pre-defined conjugations
 *
 * @example
 * ```ts
 * Verbs.create
 * // => {
 * //   action: 'create',
 * //   actor: 'creator',
 * //   act: 'creates',
 * //   activity: 'creating',
 * //   result: 'creation',
 * //   reverse: { at: 'createdAt', by: 'createdBy', in: 'createdIn', for: 'createdFor' },
 * //   inverse: 'delete',
 * // }
 * ```
 */
export const Verbs = {
  create: {
    action: 'create',
    actor: 'creator',
    act: 'creates',
    activity: 'creating',
    result: 'creation',
    reverse: { at: 'createdAt', by: 'createdBy', in: 'createdIn', for: 'createdFor' },
    inverse: 'delete',
  },
  update: {
    action: 'update',
    actor: 'updater',
    act: 'updates',
    activity: 'updating',
    result: 'update',
    reverse: { at: 'updatedAt', by: 'updatedBy' },
  },
  delete: {
    action: 'delete',
    actor: 'deleter',
    act: 'deletes',
    activity: 'deleting',
    result: 'deletion',
    reverse: { at: 'deletedAt', by: 'deletedBy' },
    inverse: 'create',
  },
  publish: {
    action: 'publish',
    actor: 'publisher',
    act: 'publishes',
    activity: 'publishing',
    result: 'publication',
    reverse: { at: 'publishedAt', by: 'publishedBy' },
    inverse: 'unpublish',
  },
  archive: {
    action: 'archive',
    actor: 'archiver',
    act: 'archives',
    activity: 'archiving',
    result: 'archive',
    reverse: { at: 'archivedAt', by: 'archivedBy' },
    inverse: 'unarchive',
  },
  approve: {
    action: 'approve',
    actor: 'approver',
    act: 'approves',
    activity: 'approving',
    result: 'approval',
    reverse: { at: 'approvedAt', by: 'approvedBy' },
    inverse: 'reject',
  },
  reject: {
    action: 'reject',
    actor: 'rejector',
    act: 'rejects',
    activity: 'rejecting',
    result: 'rejection',
    reverse: { at: 'rejectedAt', by: 'rejectedBy' },
    inverse: 'approve',
  },
  assign: {
    action: 'assign',
    actor: 'assigner',
    act: 'assigns',
    activity: 'assigning',
    result: 'assignment',
    reverse: { at: 'assignedAt', by: 'assignedBy', to: 'assignedTo' },
    inverse: 'unassign',
  },
  complete: {
    action: 'complete',
    actor: 'completer',
    act: 'completes',
    activity: 'completing',
    result: 'completion',
    reverse: { at: 'completedAt', by: 'completedBy' },
  },
  submit: {
    action: 'submit',
    actor: 'submitter',
    act: 'submits',
    activity: 'submitting',
    result: 'submission',
    reverse: { at: 'submittedAt', by: 'submittedBy' },
  },
  review: {
    action: 'review',
    actor: 'reviewer',
    act: 'reviews',
    activity: 'reviewing',
    result: 'review',
    reverse: { at: 'reviewedAt', by: 'reviewedBy' },
  },
} as const satisfies Record<string, Verb>

// =============================================================================
// Conjugate Function
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
 * If the verb is a known standard verb (from Verbs), returns the pre-defined version.
 *
 * @example
 * ```ts
 * conjugate('publish')
 * // => { action: 'publish', actor: 'publisher', act: 'publishes', activity: 'publishing', ... }
 *
 * conjugate('create')
 * // => { action: 'create', actor: 'creator', act: 'creates', activity: 'creating', ... }
 *
 * conjugate('validate')
 * // => { action: 'validate', actor: 'validator', act: 'validates', activity: 'validating', ... }
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

/**
 * Check if an action is a known standard verb
 */
export function isStandardVerb(action: string): action is keyof typeof Verbs {
  return action in Verbs
}

/**
 * Get all standard verb names
 */
export function getStandardVerbs(): (keyof typeof Verbs)[] {
  return Object.keys(Verbs) as (keyof typeof Verbs)[]
}
