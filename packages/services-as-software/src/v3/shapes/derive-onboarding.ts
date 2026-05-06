/**
 * Derive a default {@link OnboardingShape} from a {@link ServiceInstance}.
 *
 * Per v3 §8, the onboarding UI derives from `binding.toolPermissions`
 * (one IntegrationRequirement per provider) plus `audience` (KYC depth).
 * Per v3 §13, regulated authority boundaries trigger full KYC.
 *
 * @packageDocumentation
 */

import { KNOWN_PROVIDERS, parseToolPermission, providerScopesFor } from './known-providers.js'
import type { ServiceInstance } from '../service.js'
import type { Audience } from '../types.js'
import type {
  IntegrationRequirement,
  OnboardingShape,
  PrerequisiteRequirement,
  VerificationRequirement,
  WelcomeStep,
} from './types.js'

// ============================================================================
// Internal helpers
// ============================================================================

/**
 * Collapse `binding.toolPermissions` (e.g. `['github.repos', 'github.pulls',
 * 'gmail.send']`) into one {@link IntegrationRequirement} per provider with
 * the union of declared scopes.
 *
 * Permissions that don't follow the `provider.scope` convention are skipped
 * — those are handled by the runtime's tool registry, not OAuth.
 */
function deriveIntegrations(toolPermissions: string[]): IntegrationRequirement[] {
  const byProvider = new Map<string, Set<string>>()
  for (const perm of toolPermissions) {
    const parsed = parseToolPermission(perm)
    if (!parsed) continue
    const existing = byProvider.get(parsed.provider) ?? new Set<string>()
    if (parsed.scope) existing.add(parsed.scope)
    byProvider.set(parsed.provider, existing)
  }

  const out: IntegrationRequirement[] = []
  for (const [provider, scopeSet] of byProvider) {
    const declaredScopes = Array.from(scopeSet)
    const scopes = providerScopesFor(provider, declaredScopes)
    out.push({
      provider,
      scopes,
      // All cascade-bound integrations are required by default; Service may
      // override individual entries to mark optional add-ons.
      required: true,
    })
  }
  return out
}

/**
 * Pick default verifications based on audience + authority boundary.
 *
 * - `audience: 'human'`        → `[]` (no verification)
 * - `audience: 'business'`     → `[{ kind: 'kyc-light' }]`
 * - regulated authority boundary → `[{ kind: 'kyc-full' }, { kind: 'business-verification' }]`
 *
 * When multiple audiences are declared, the most restrictive wins.
 */
function deriveVerifications(
  audience: Audience | Audience[],
  authorityBoundary: string | undefined
): VerificationRequirement[] {
  const audiences = new Set(Array.isArray(audience) ? audience : [audience])

  // Heuristic: any authority-boundary ref containing 'regulated' / 'gdpr' /
  // 'hipaa' / 'sox' / 'finra' / 'pci' triggers full KYC. The
  // `authorityBoundary` namespace is open-ended (per autonomous-finance), so
  // we string-match rather than enum-check.
  const regulated =
    !!authorityBoundary && /regulat|gdpr|hipaa|sox|finra|pci|kyc/i.test(authorityBoundary)
  if (regulated) {
    return [{ kind: 'kyc-full' }, { kind: 'business-verification' }]
  }

  if (audiences.has('business')) {
    return [{ kind: 'kyc-light' }]
  }

  return []
}

/** Default prerequisites — empty; Services override with custom checks. */
function defaultPrerequisites(): PrerequisiteRequirement[] {
  return []
}

/** Default welcome flow — undefined; renderer falls back to a generic intro. */
function defaultWelcomeFlow(): WelcomeStep[] | undefined {
  return undefined
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Derive a default {@link OnboardingShape} from `svc`. Pure function.
 */
export function deriveOnboarding(svc: ServiceInstance<unknown, unknown>): OnboardingShape {
  const integrations = deriveIntegrations(svc.binding.toolPermissions)
  const verifications = deriveVerifications(svc.audience, svc.authorityBoundary)
  const prerequisites = defaultPrerequisites()
  const welcomeFlow = defaultWelcomeFlow()

  const shape: OnboardingShape = {
    integrations,
    verifications,
    prerequisites,
  }
  if (welcomeFlow) shape.welcomeFlow = welcomeFlow
  return shape
}

// Re-export for downstream consumers that want the provider list.
export { KNOWN_PROVIDERS }
