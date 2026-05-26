/**
 * Derive a default {@link DeliveryShape} from a {@link ServiceInstance}.
 *
 * Per v3 §8, the in-flight delivery UI derives from
 * `archetype.estimatedCost` (used as a coarse time proxy),
 * `binding.cascade.length` (one progress indicator per cascade step), and
 * `oversight` + `clarificationPolicy` (HITL touchpoints).
 *
 * @packageDocumentation
 */

import { archetypes } from '../archetype/registry.js'
import type { ServiceInstance } from '../service.js'
import type { Money } from 'business-as-code/finance'
import type { DeliveryShape, Duration, HITLTouchpoint, ProgressIndicator } from './types.js'

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Map an archetype's coarse cost range (USD cents) onto a coarse time range.
 *
 * Heuristic: assume an average $0.05 / second cost rate at LLM-cascade
 * pricing — works well enough across the ten seed archetypes. The renderer
 * displays the result as "≈ 30s – 2m"; precise SLAs come from `pricing.sla`
 * (a separate concern).
 */
function moneyToDuration(m: Money): Duration {
  // Treat amount as USD cents (per Money convention in autonomous-finance).
  const cents = Number(m.amount)
  // $0.05 / second → 5 cents / second; minimum 1 second.
  const seconds = Math.max(1, Math.round(cents / 5))
  if (seconds < 60) return { value: seconds, unit: 'seconds' }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return { value: minutes, unit: 'minutes' }
  const hours = Math.round(minutes / 60)
  if (hours < 24) return { value: hours, unit: 'hours' }
  const days = Math.round(hours / 24)
  return { value: days, unit: 'days' }
}

/**
 * Default estimated time bracket. Falls back to a generic 30s – 5m range
 * when the archetype isn't registered.
 */
function deriveEstimatedTime(svc: ServiceInstance<unknown, unknown>): {
  min: Duration
  max: Duration
} {
  const archetype = archetypes.get(svc.archetype)
  if (!archetype) {
    return {
      min: { value: 30, unit: 'seconds' },
      max: { value: 5, unit: 'minutes' },
    }
  }
  return {
    min: moneyToDuration(archetype.estimatedCost.minPerInvocation),
    max: moneyToDuration(archetype.estimatedCost.maxPerInvocation),
  }
}

/**
 * Build one {@link ProgressIndicator} per cascade step. The first step is
 * tagged with the `'ACTIVE'` invocation state; intermediate steps fall under
 * `'DELIVERING'`; this gives the UI a clean two-state ribbon without
 * inventing per-step states.
 */
function deriveProgressIndicators(svc: ServiceInstance<unknown, unknown>): ProgressIndicator[] {
  const cascade = svc.binding.cascade
  if (cascade.length === 0) {
    return [{ fromState: 'ACTIVE', label: 'Working…' }]
  }
  return cascade.map((step, idx): ProgressIndicator => {
    // FunctionRef carries a `name` field on every variant — use it for the
    // label; renderer humanises kebab/camel as needed.
    const name = (step as { name?: string }).name ?? `step-${idx + 1}`
    return {
      fromState: idx === 0 ? 'ACTIVE' : 'DELIVERING',
      label: name,
    }
  })
}

/**
 * Default HITL touchpoints. Three rules:
 *
 * 1. If the Service has `oversight` requiring human sign-off (mode !==
 *    `'autonomous'`), add a `QUALITY_REVIEW` touchpoint.
 * 2. If `binding.clarificationPolicy.enabled`, add a `NEEDS_CLARIFICATION`
 *    touchpoint with the policy's escalation channel hint.
 * 3. Always include the safety-net `ESCALATED_TO_HUMAN_REVIEW` touchpoint —
 *    every Service can escalate even when no other HITL gate is configured.
 *
 * Default channel is `'web'` and timeout behaviour is `'auto-escalate'`
 * after 24 hours; renderers and Service overrides can change either.
 */
function deriveHitlTouchpoints(svc: ServiceInstance<unknown, unknown>): HITLTouchpoint[] {
  const out: HITLTouchpoint[] = []

  const oversightMode = svc.oversight?.mode
  if (oversightMode && oversightMode !== 'autonomous') {
    out.push({
      fromState: 'QUALITY_REVIEW',
      channel: 'web',
      timeoutBehavior: 'auto-escalate',
      timeoutAfter: { value: 24, unit: 'hours' },
    })
  }

  if (svc.binding.clarificationPolicy.enabled) {
    out.push({
      fromState: 'NEEDS_CLARIFICATION',
      channel: 'web',
      timeoutBehavior: 'auto-escalate',
      timeoutAfter: { value: 24, unit: 'hours' },
    })
  }

  out.push({
    fromState: 'ESCALATED_TO_HUMAN_REVIEW',
    channel: 'web',
    timeoutBehavior: 'auto-cancel',
    timeoutAfter: { value: 7, unit: 'days' },
  })

  return out
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Derive a default {@link DeliveryShape} from `svc`. Pure function.
 */
export function deriveDelivery(svc: ServiceInstance<unknown, unknown>): DeliveryShape {
  return {
    estimatedTime: deriveEstimatedTime(svc),
    progressIndicators: deriveProgressIndicators(svc),
    hitlTouchpoints: deriveHitlTouchpoints(svc),
  }
}
