/**
 * createInvocationHandle — runtime factory that mints an
 * {@link InvocationHandle} and starts the cascade walker.
 *
 * Round-6 status: the walker now performs **real LLM dispatch for Generative
 * FunctionRefs** via `ai-functions.generateObject` (see
 * {@link ./cascade-walker.ts}). Code Functions execute their inline handlers.
 * Agentic and Human Functions remain mocked pending round-7 work.
 *
 * The runtime keeps the FSM-transition emissions inline (so the state-machine
 * narrative reads top-to-bottom in this file); per-step cascade events are
 * emitted by `runCascade` against the same handle.
 *
 * TODO(round 7+): replace the in-process walker with the
 *   `ai-workflows` `DurableExecutionAdapter` + CF Workflows backend per
 *   ADR-0004. The replacement walker:
 *     - enqueues the cascade as a durable workflow
 *     - bridges workflow signals → `handle.emit(...)`
 *     - wires `handle.onClarify` / `onCancel` / `onDispute` to workflow
 *       signal dispatch
 *     - persists FSM state through `WorkflowRuntime` per
 *       `ai-workflows/src/runtime.ts`
 *
 * @packageDocumentation
 */

import type { ServiceInstance } from '../service.js'
import { runCascade } from './cascade-walker.js'
import type { ClarificationResponse, InvocationEvent } from './invocation-event.js'
import { InvocationHandleImpl, type InvocationHandle } from './handle.js'
import type { InvokeOpts } from './invoke-opts.js'
import { canTransition, type InvocationState } from './invocation-state.js'

// ============================================================================
// ID minting
// ============================================================================

/**
 * Mint a fresh invocation `$id`. Format: `'inv:<base36-time>-<base36-rand>'`.
 * Replaced with a tenant-scoped MDXLD id in the durable adapter.
 */
function mintInvocationId(): string {
  const t = Date.now().toString(36)
  const r = Math.floor(Math.random() * 0xffffff).toString(36)
  return `inv:${t}-${r}`
}

// ============================================================================
// Public factory
// ============================================================================

/**
 * Mint a typed {@link InvocationHandle} and (asynchronously) start the
 * cascade walker. Returns synchronously so the caller can subscribe to
 * `handle.events` before the first event fires.
 *
 * Generative cascade steps trigger real LLM calls via `ai-functions`; Code
 * steps invoke their inline handlers; Agentic and Human steps are mocked.
 */
export function createInvocationHandle<TIn, TOut>(
  svc: ServiceInstance<TIn, TOut>,
  input: TIn,
  opts?: InvokeOpts
): InvocationHandle<TOut> {
  const handle = new InvocationHandleImpl<TOut>(mintInvocationId())

  // Kick off on next-tick so the caller has a chance to attach a `for await`
  // consumer before any events fire.
  queueMicrotask(() => {
    void driveInvocation(svc, input, handle, opts)
  })

  return handle
}

// ============================================================================
// FSM driver — wraps runCascade with state-changed emissions + buyer hooks
// ============================================================================

/**
 * Helper: emit a `state-changed` event after asserting the transition is
 * legal under the FSM. Throws on illegal transitions so a future durable
 * walker fails loudly during development rather than silently advancing.
 */
function transition<TOut>(handle: InvocationHandleImpl<TOut>, to: InvocationState): void {
  if (!canTransition(handle.state, to)) {
    throw new Error(`illegal FSM transition: ${handle.state} → ${to}`)
  }
  handle.emit({ kind: 'state-changed', state: to, at: new Date() })
}

/**
 * Drive an invocation through the FSM happy path, delegating cascade
 * execution to {@link runCascade} for the DELIVERING phase. Settles the
 * handle's `result` Deferred via the terminal `'delivered'` / `'failed'`
 * event.
 */
async function driveInvocation<TIn, TOut>(
  svc: ServiceInstance<TIn, TOut>,
  input: TIn,
  handle: InvocationHandleImpl<TOut>,
  opts?: InvokeOpts
): Promise<void> {
  // Wire the buyer-control hooks. Cancel / dispute drive the FSM directly;
  // clarify is a noop today (the in-memory walker has no reply mechanism).
  // TODO(round 7): replace with workflow-signal dispatch.
  handle.onClarify = async (_response: ClarificationResponse): Promise<void> => {
    // Mock: would resume the workflow. For now: noop.
  }
  handle.onCancel = async (reason?: string): Promise<void> => {
    if (canTransition(handle.state, 'CANCELLED')) {
      transition(handle, 'CANCELLED')
      handle.emit({
        kind: 'failed',
        reason: 'external-failure',
        detail: reason ?? 'caller cancelled',
      })
    }
  }
  handle.onDispute = async (reason: string): Promise<void> => {
    if (canTransition(handle.state, 'DISPUTED')) {
      transition(handle, 'DISPUTED')
      transition(handle, 'ESCALATED_TO_HUMAN_REVIEW')
      transition(handle, 'CLOSED')
      handle.emit({ kind: 'failed', reason: 'external-failure', detail: reason })
    }
  }

  try {
    // Forward-progress through the onboarding/active states.
    transition(handle, 'ONBOARDING')
    transition(handle, 'ACTIVE')
    transition(handle, 'DELIVERING')

    // Real cascade execution — generative steps dispatch to ai-functions.
    const payload = await runCascade<TIn, TOut>({
      service: svc,
      input,
      emit: (event) => handle.emit(event),
      ...(opts?.tenantRef !== undefined ? { tenantRef: opts.tenantRef } : {}),
    })

    // Synthetic evaluator-panel burst — one approve per persona. Real panel
    // dispatch + verdict aggregation lands in round 7+ alongside the panel
    // implementation.
    if (svc.evaluators) {
      const personas: ReadonlyArray<{ name: string }> =
        (svc.evaluators as { personas?: ReadonlyArray<{ name: string }> }).personas ?? []
      for (const p of personas) {
        handle.emit({
          kind: 'evaluator-signoff',
          reviewer: p.name,
          verdict: 'approve',
          rationale: '(mock) evaluator approval',
        })
      }
    }

    // QUALITY_REVIEW → DELIVERED.
    transition(handle, 'QUALITY_REVIEW')
    transition(handle, 'DELIVERED')

    const deliveredEvent: InvocationEvent<TOut> = { kind: 'delivered', payload }
    handle.emit(deliveredEvent)
  } catch (err) {
    // Any thrown error during cascade execution → emit a typed failure.
    const detail = err instanceof Error ? err.message : String(err)
    if (canTransition(handle.state, 'FAILED')) {
      handle.emit({ kind: 'state-changed', state: 'FAILED', at: new Date() })
    }
    handle.emit({ kind: 'failed', reason: 'external-failure', detail })
  }
}
