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
 * ## Worker Actions
 *
 * Worker actions (notify, ask, approve, decide, do) are durable workflow actions
 * that integrate with ai-workflows. They can be invoked via:
 *
 * 1. `$.do('Worker.notify', data)` - Durable action
 * 2. `$.send('Worker.notify', data)` - Fire and forget
 * 3. `$.notify(target, message)` - Convenience method (when using withWorkers)
 *
 * @example
 * ```ts
 * import { Workflow } from 'ai-workflows'
 * import { registerWorkerActions, withWorkers } from 'digital-workers'
 *
 * const workflow = Workflow($ => {
 *   registerWorkerActions($)
 *   const worker$ = withWorkers($)
 *
 *   $.on.Expense.submitted(async (expense) => {
 *     await worker$.notify(finance, `New expense: ${expense.amount}`)
 *
 *     const approval = await worker$.approve(
 *       `Expense: $${expense.amount}`,
 *       manager,
 *       { via: 'slack' }
 *     )
 *
 *     if (approval.approved) {
 *       await worker$.notify(expense.submitter, 'Expense approved!')
 *     }
 *   })
 * })
 * ```
 *
 * @packageDocumentation
 */

// Export all types
export type * from './types.js'

// Export workflow integration
export {
  registerWorkerActions,
  withWorkers,
  handleNotify,
  handleAsk,
  handleApprove,
  handleDecide,
  handleDo,
  notify as notifyAction,
  ask as askAction,
  approve as approveAction,
  decide as decideAction,
} from './actions.js'

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

// Export verb definitions
export { WorkerVerbs } from './types.js'
