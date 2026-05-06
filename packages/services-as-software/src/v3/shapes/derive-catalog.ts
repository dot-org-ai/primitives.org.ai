/**
 * Derive a default {@link CatalogShape} from a {@link ServiceInstance}.
 *
 * Per v3 §8, the catalog UI derives from `name`, `promise`, `audience`,
 * `pricing.summary`, and `archetype.heroTemplate`. This module reads only
 * those fields and returns a sensible default — pure; no I/O; no LLM.
 *
 * @packageDocumentation
 */

import { archetypes } from '../archetype/registry.js'
import type { ServiceInstance } from '../service.js'
import type { Pricing } from 'autonomous-finance'
import type { CatalogHero, CatalogShape, PricingSummary } from './types.js'

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Pick the catalog `pricingSummary` layout hint from the discriminated
 * {@link Pricing} union. Per v3 §7:
 *
 * - `outcome`        → `'tier-comparison'` (S/M/L tiers compared in cards)
 * - `subscription`   → `'starting-at'`     (single plan amount + metered tail)
 * - `per-invocation` → `'per-call'`        (per-tier ladder)
 * - `composite`      → `'starting-at'`     (one-time base + metered events)
 *
 * Absent pricing → `'contact-us'`.
 */
function pricingSummaryFor(pricing: Pricing | undefined): PricingSummary {
  if (!pricing) return 'contact-us'
  switch (pricing.kind) {
    case 'outcome':
      return 'tier-comparison'
    case 'subscription':
      return 'starting-at'
    case 'per-invocation':
      return 'per-call'
    case 'composite':
      return 'starting-at'
  }
}

/**
 * Build the default hero block. Uses the archetype's optional
 * `heroTemplate.props` to override copy when present; otherwise falls back to
 * `name` (headline) + `promise` (subheadline) + the archetype's hero
 * `templateRef` (visual asset).
 */
function deriveHero(svc: ServiceInstance<unknown, unknown>): CatalogHero | undefined {
  const archetype = archetypes.get(svc.archetype)
  const template = archetype?.heroTemplate
  const props = (template?.props ?? {}) as Record<string, unknown>

  const headline = typeof props['headline'] === 'string' ? props['headline'] : svc.name
  const subheadline = typeof props['subheadline'] === 'string' ? props['subheadline'] : svc.promise
  const visual = typeof props['visual'] === 'string' ? props['visual'] : template?.templateRef

  if (!headline && !subheadline && !visual) return undefined

  const hero: CatalogHero = {}
  if (headline) hero.headline = headline
  if (subheadline) hero.subheadline = subheadline
  if (visual) hero.visual = visual
  return hero
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Derive a default {@link CatalogShape} from `svc`. Pure function — same
 * input always yields the same output.
 */
export function deriveCatalog(svc: ServiceInstance<unknown, unknown>): CatalogShape {
  const hero = deriveHero(svc)
  const shape: CatalogShape = {
    pricingSummary: pricingSummaryFor(svc.pricing),
  }
  if (hero) shape.hero = hero
  return shape
}
