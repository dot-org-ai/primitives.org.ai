/**
 * Derive an {@link IntegrationsShape} purely from `binding.toolPermissions`
 * + the {@link KNOWN_PROVIDERS} registry.
 *
 * Per v3 §8 this shape is *not* overridable on the Service spec — it is
 * always a pure projection of declared tool permissions, so the integrations
 * panel is guaranteed to match what the cascade actually requests.
 *
 * @packageDocumentation
 */

import { KNOWN_PROVIDERS, parseToolPermission, providerScopesFor } from './known-providers.js'
import type { ServiceInstance } from '../service.js'
import type { IntegrationsProvider, IntegrationsShape } from './types.js'

// ============================================================================
// Public API
// ============================================================================

/**
 * Derive the integrations connection-panel shape from the Service binding.
 * Pure function — always returns the same value for the same input.
 *
 * Behaviour:
 *
 * 1. Parse each `binding.toolPermissions` entry into `{ provider, scope? }`
 *    via {@link parseToolPermission}.
 * 2. Group by provider, unioning declared short scopes.
 * 3. Resolve full OAuth scopes via {@link providerScopesFor} (falling back
 *    to declared values when the provider isn't in {@link KNOWN_PROVIDERS}).
 * 4. Mark every provider as `required: true` — every cascade-bound tool
 *    permission is required by definition.
 *
 * Output is sorted by provider name for stable rendering.
 */
export function deriveIntegrations(svc: ServiceInstance<unknown, unknown>): IntegrationsShape {
  const byProvider = new Map<string, Set<string>>()
  for (const perm of svc.binding.toolPermissions) {
    const parsed = parseToolPermission(perm)
    if (!parsed) continue
    const existing = byProvider.get(parsed.provider) ?? new Set<string>()
    if (parsed.scope) existing.add(parsed.scope)
    byProvider.set(parsed.provider, existing)
  }

  const providers: IntegrationsProvider[] = []
  for (const [name, scopeSet] of byProvider) {
    const declared = Array.from(scopeSet)
    providers.push({
      name,
      scopes: providerScopesFor(name, declared),
      required: true,
    })
  }
  providers.sort((a, b) => a.name.localeCompare(b.name))

  return { providers }
}

// Re-export so consumers that want the registry directly don't need to
// reach into a sibling module.
export { KNOWN_PROVIDERS }
