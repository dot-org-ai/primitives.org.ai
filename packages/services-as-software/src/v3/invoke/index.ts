/**
 * `invoke/` barrel — call-site machinery for `service.invoke()` per v3 §5 + §10.
 *
 * Re-exports the typed handle, the FSM, the event union, the options bag, and
 * the runtime factory. Imported by `../index.ts` and by the parallel
 * `Service.define` agent's bound-method implementation.
 *
 * @packageDocumentation
 */

// FSM (state enum + transition table + predicates)
export type { InvocationState, Transition } from './invocation-state.js'
export { TRANSITIONS, isTerminal, isWaitingOnCustomer, canTransition } from './invocation-state.js'

// Event union + clarification round-trip shapes
export type {
  InvocationEvent,
  ClarificationRequest,
  ClarificationResponse,
} from './invocation-event.js'

// Handle (interface + in-memory implementation class)
export type { InvocationHandle } from './handle.js'
export { InvocationHandleImpl } from './handle.js'

// InvokeOpts + WorkerRef
export type { InvokeOpts, WorkerRef } from './invoke-opts.js'

// Runtime factory
export { createInvocationHandle } from './runtime.js'
