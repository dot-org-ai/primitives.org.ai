/**
 * InvocationEvent — typed discriminated union streamed on
 * `InvocationHandle.events` (per v3 §5).
 *
 * The handle's `events` is the single observation seam during a live
 * invocation. Each event narrows on `kind`; consumers can render a
 * customer-runtime UI, capture cost, append to an audit log, or react to
 * mid-cascade signals (clarification request, evaluator sign-off, preview
 * payload) without touching internal cascade state.
 *
 * The union is **locked** — no `| string` escape on `failed.reason`. If a new
 * failure mode is needed, extend the union here so consumers narrow correctly
 * (and the FSM's failure-trigger handler is updated in the same change).
 *
 * @packageDocumentation
 */

import type { Money } from 'business-as-code/finance'

import type { Schema } from '../types.js'
import type { InvocationState } from './invocation-state.js'

// ============================================================================
// Clarification round-trip shapes
// ============================================================================

/**
 * Question dispatched to the buyer when the cascade pauses for clarification.
 *
 * `id` correlates the request with the eventual {@link ClarificationResponse}
 * delivered via `handle.clarify()`. `choices` (when present) renders as a
 * picker; `schema` (when present) renders as a typed form. Both omitted →
 * free-text response.
 *
 * `TOut` is carried so a future `schema` could be narrowed against the
 * Service's output type; today it stays `Schema<unknown>` to keep the surface
 * small.
 */
export interface ClarificationRequest<_TOut = unknown> {
  /** Stable id correlating request → response. */
  id: string
  /** Human-readable prompt rendered to the buyer. */
  question: string
  /** Optional enum of choices; renders as a single-select picker. */
  choices?: string[]
  /** Optional Standard-Schema validator; renders as a typed form. */
  schema?: Schema<unknown>
}

/**
 * Buyer's reply to a {@link ClarificationRequest}. Delivered via
 * `handle.clarify()`; the runtime correlates by `requestId`.
 *
 * Exactly one of `choice` (when the request offered `choices`) or `payload`
 * (when the request offered a `schema` or free-text) is meaningful.
 */
export interface ClarificationResponse {
  /** {@link ClarificationRequest.id} this response answers. */
  requestId: string
  /** Selected enum value; required when the request offered `choices`. */
  choice?: string
  /** Typed payload validating against the request's `schema` (or free text). */
  payload?: unknown
}

// ============================================================================
// Event union
// ============================================================================

/**
 * Discriminated union of every event the runtime may emit on
 * `InvocationHandle.events`. Narrow with `switch (ev.kind)`.
 *
 * Per v3 §5 the union is locked (no `| string` escape on `failed.reason`).
 *
 * - `state-changed`        — FSM transition; `state` is the new state, `at`
 *                            the wall-clock timestamp the transition fired.
 * - `cascade-progress`     — a cascade {@link FunctionRef} reports progress;
 *                            `pct` is `0..100`. Multiple events per Function.
 * - `cost-incurred`        — a cascade step booked a {@link Money} cost.
 *                            `functionRef` (when present) attributes it to a
 *                            cascade step; `model` (when present) attributes
 *                            it to the LLM that incurred the cost so
 *                            subscribers can break costs out per-model
 *                            (round-12 follow-up).
 * - `preview-available`    — a partial {@link TOut} payload is ready for a
 *                            named slot (the customer-runtime can render
 *                            previews mid-cascade).
 * - `clarification-needed` — the cascade has paused; the runtime is awaiting
 *                            `handle.clarify(...)`.
 * - `evaluator-signoff`    — an EvaluatorPanel persona returned a verdict.
 *                            `'approve'` and `'reject'` are load-bearing;
 *                            `'advisory'` denotes an informational sign-off
 *                            that does not block downstream cascade steps
 *                            (e.g. supervised-mode agentic Functions whose UI
 *                            gate has not yet been implemented).
 * - `delivered`            — terminal-success event carrying the final
 *                            `TOut`; the handle's `result` resolves with it.
 * - `failed`               — terminal-failure event; the handle's `result`
 *                            rejects with the reason + detail.
 */
export type InvocationEvent<TOut> =
  | { kind: 'state-changed'; state: InvocationState; at: Date }
  | { kind: 'cascade-progress'; functionRef: string; pct: number }
  | { kind: 'cost-incurred'; cost: Money; functionRef?: string; model?: string }
  | { kind: 'preview-available'; slot: string; payload: Partial<TOut> }
  | { kind: 'clarification-needed'; request: ClarificationRequest<TOut> }
  | {
      kind: 'evaluator-signoff'
      reviewer: string
      verdict: 'approve' | 'reject' | 'advisory'
      rationale: string
    }
  | { kind: 'delivered'; payload: TOut }
  | {
      kind: 'failed'
      reason: 'timeout' | 'evaluator-blocked' | 'budget-exceeded' | 'external-failure'
      detail: string
    }
