/**
 * createInvocationHandle — runtime factory that mints an
 * {@link InvocationHandle} and starts the mock cascade walker.
 *
 * **This is intentionally a mock for now.** The walker emits the FSM
 * transitions, cascade-progress events, and a hard-coded evaluator-signoff
 * burst, then resolves the result with a `null` payload (cast to `TOut`).
 * It does NOT actually call LLMs, run agentic Functions, or persist state.
 *
 * The mock is enough to validate the typed surface end-to-end so the parallel
 * `Service.define` + UI-shapes agents can wire against a real handle today.
 *
 * TODO(round 4/5): replace mock cascade execution with the
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
 * The walker is a **mock** today (see file header); it advances the FSM
 * through the happy path and emits one synthetic event per cascade step.
 */
export function createInvocationHandle<TIn, TOut>(
  svc: ServiceInstance<TIn, TOut>,
  _input: TIn,
  _opts?: InvokeOpts
): InvocationHandle<TOut> {
  const handle = new InvocationHandleImpl<TOut>(mintInvocationId())

  // TODO: replace mock cascade execution with ai-workflows
  //   DurableExecutionAdapter (round 5 / production work).
  // The mock kicks off on next-tick so the caller has a chance to attach a
  // `for await` consumer before any events fire.
  queueMicrotask(() => {
    void runMockCascade(svc, handle)
  })

  return handle
}

// ============================================================================
// Mock cascade walker
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
 * Mock cascade walker — drives the handle through the FSM happy path,
 * emitting one `cascade-progress` per `binding.cascade` step and a synthetic
 * `evaluator-signoff` burst (one approve per persona). Resolves the handle's
 * result with `null as TOut`.
 *
 * **No real LLM dispatch happens here** — see file header for the production
 * replacement plan.
 */
async function runMockCascade<TIn, TOut>(
  svc: ServiceInstance<TIn, TOut>,
  handle: InvocationHandleImpl<TOut>
): Promise<void> {
  // Wire the buyer-control hooks. The mock walker accepts cancel/dispute by
  // emitting the corresponding terminal event; clarify is a noop today.
  // TODO: replace with workflow-signal dispatch (round 4/5).
  handle.onClarify = async (_response: ClarificationResponse): Promise<void> => {
    // Mock: would resume the workflow. For now: noop.
  }
  handle.onCancel = async (_reason?: string): Promise<void> => {
    if (canTransition(handle.state, 'CANCELLED')) {
      transition(handle, 'CANCELLED')
      handle.emit({
        kind: 'failed',
        reason: 'external-failure',
        detail: _reason ?? 'caller cancelled',
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

    // Walk the cascade; one event per FunctionRef. Human steps would suspend
    // for clarification — the mock emits a `clarification-needed` event but
    // does NOT actually park the workflow (the in-memory walker has no
    // reply mechanism wired beyond the noop `onClarify` above).
    for (const fn of svc.binding.cascade) {
      handle.emit({ kind: 'cascade-progress', functionRef: fn.name, pct: 0 })
      if (fn.kind === 'human') {
        handle.emit({
          kind: 'clarification-needed',
          request: {
            id: `clr:${fn.$id}`,
            question: `(mock) human step '${fn.name}' would request input here`,
          },
        })
        // TODO: real walker would transition NEEDS_CLARIFICATION + park.
      }
      handle.emit({ kind: 'cascade-progress', functionRef: fn.name, pct: 100 })
    }

    // Synthetic evaluator-panel burst — one approve per persona.
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

    // Resolve the result with a null payload.
    // TODO: real walker resolves with the cascade's typed output.
    const mockPayload = null as unknown as TOut
    const deliveredEvent: InvocationEvent<TOut> = { kind: 'delivered', payload: mockPayload }
    handle.emit(deliveredEvent)
  } catch (err) {
    // Any thrown error during the mock walk → emit a typed failure.
    const detail = err instanceof Error ? err.message : String(err)
    if (canTransition(handle.state, 'FAILED')) {
      handle.emit({ kind: 'state-changed', state: 'FAILED', at: new Date() })
    }
    handle.emit({ kind: 'failed', reason: 'external-failure', detail })
  }
}
