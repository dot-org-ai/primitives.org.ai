/**
 * Derive a default {@link OrderShape} from a {@link ServiceInstance}.
 *
 * Per v3 §8, the order UI derives from `schema.input` (number of fields
 * picks `flow`), `pricing` (tier picker), and `audience` (which determines
 * identity flow). This module is pure — it inspects the optional
 * `outputContract.input.uiHints` to discover field paths because Standard
 * Schema does not statically expose field metadata.
 *
 * @packageDocumentation
 */

import type { ServiceInstance } from '../service.js'
import type { Audience } from '../types.js'
import type { OrderFlow, OrderLegal, OrderShape, OrderStep } from './types.js'

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Best-effort field extraction from the optional `outputContract.input.uiHints`
 * map. Standard Schema doesn't carry static field metadata, so the
 * authoritative knob for "how many fields does this Service take?" is the
 * UI hints map (which itself is opt-in). When uiHints are absent we cannot
 * tell — caller falls back to a sensible default.
 *
 * Field paths are JSON-pointer-style (`'/repoRef'`); we strip the leading
 * slash for display.
 */
function extractInputFieldPaths(svc: ServiceInstance<unknown, unknown>): string[] | undefined {
  const hints = svc.outputContract?.input.uiHints
  if (!hints) return undefined
  const keys = Object.keys(hints)
  return keys.length > 0 ? keys : undefined
}

/**
 * Humanise a JSON-pointer-style field path into a step title.
 *
 * `'/featureBrief'` → `'Feature brief'`
 * `'/repo/owner'`   → `'Repo owner'`
 */
function humanisePath(path: string): string {
  const normalised = path.replace(/^\/+/, '').replace(/\//g, ' ')
  // camelCase → spaces; uppercase first letter
  const spaced = normalised.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * Pick the default order `flow` based on field count + audience.
 *
 * - Single field         → `'instant'`  (one-step form)
 * - Multi-field          → `'guided'`   (wizard auto-derived from fields)
 * - Audience contains `'business'` and field count is unknown → `'guided'`
 *   (default to wizard so the identity / org-context step has a frame)
 */
function pickFlow(fields: string[] | undefined, audience: Audience | Audience[]): OrderFlow {
  if (fields && fields.length === 1) return 'instant'
  if (fields && fields.length > 1) return 'guided'
  // Unknown field count: business audiences tend to want a guided flow,
  // human/agent audiences default to instant.
  const audiences = Array.isArray(audience) ? audience : [audience]
  return audiences.includes('business') ? 'guided' : 'instant'
}

/**
 * Derive default `steps` for a guided flow by walking the discovered input
 * fields. One field per step — the renderer can collapse adjacent simple
 * fields into a shared step at presentation time.
 */
function deriveSteps(fields: string[] | undefined): OrderStep[] | undefined {
  if (!fields || fields.length === 0) return undefined
  return fields.map(
    (path): OrderStep => ({
      title: humanisePath(path),
      fields: [path],
    })
  )
}

/**
 * Default legal block. `tosRef` is a generic ref the runtime resolves;
 * jurisdiction notices are empty by default (Service may override).
 */
function defaultLegal(): OrderLegal {
  return {
    tosRef: 'tos:default',
    jurisdictionNotices: [],
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Derive a default {@link OrderShape} from `svc`. Pure function.
 */
export function deriveOrder(svc: ServiceInstance<unknown, unknown>): OrderShape {
  const fields = extractInputFieldPaths(svc)
  const flow = pickFlow(fields, svc.audience)

  const shape: OrderShape = {
    flow,
    legal: defaultLegal(),
  }

  if (flow === 'guided') {
    const steps = deriveSteps(fields)
    if (steps) shape.steps = steps
  }

  return shape
}
