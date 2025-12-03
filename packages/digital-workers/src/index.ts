/**
 * digital-workers - Common abstract interface over AI Agents and Humans
 *
 * Digital workers operate within a company/business boundary and share
 * interfaces with Services, which can cross company boundaries.
 *
 * This is a FOUNDATIONAL package that provides primitives for AI workers
 * that can perform tasks. Other packages (autonomous-agents, human-in-the-loop,
 * services-as-software) depend on it.
 *
 * @packageDocumentation
 */

// Export all types
export type * from './types.js'

// Export core functions
export { Role } from './role.js'
export { Team } from './team.js'
export { Goals } from './goals.js'
export { approve } from './approve.js'
export { ask } from './ask.js'
export { do } from './do.js'
export { decide } from './decide.js'
export { generate } from './generate.js'
export { is } from './is.js'
export { notify } from './notify.js'
export { kpis, okrs } from './kpis.js'
