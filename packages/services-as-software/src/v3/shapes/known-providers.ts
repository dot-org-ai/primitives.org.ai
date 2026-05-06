/**
 * Hardcoded registry of best-known OAuth providers — the seed list per v3 §8.
 *
 * Used by both {@link deriveOnboarding} and {@link deriveIntegrations} to
 * resolve a tool-permission scope string (e.g. `'github.repos'`) into the
 * full OAuth scope set the provider expects. The runtime's `$.api` registry
 * (catalog-side) augments / overrides this at render time; this module
 * carries enough metadata to render a sensible default panel without that
 * registry available.
 *
 * Adding a provider here is additive — never remove an entry without a
 * migration.
 *
 * @packageDocumentation
 */

// ============================================================================
// Provider metadata
// ============================================================================

/**
 * Best-known scope set for a provider. The `defaultScopes` are what we
 * suggest when the Service declares only the bare provider name (e.g.
 * `'github'` rather than `'github.repos'`); the `scopeMap` is keyed by the
 * short scope name used in `binding.toolPermissions` (e.g. `'repos'`,
 * `'pulls'`, `'issues'`) and yields the full OAuth scope string.
 */
export interface KnownProviderMeta {
  /** Display name for the integrations panel header. */
  displayName: string
  /** Default scopes when the Service declares the provider with no sub-scope. */
  defaultScopes: string[]
  /** Optional short-name → full-OAuth-scope mapping. */
  scopeMap?: Record<string, string>
}

/**
 * Seed registry. Lower-case provider keys; values keep the human-readable
 * display name plus default scopes. Per the v3 task spec, the seed set is:
 * github, salesforce, quickbooks, stripe, slack, gmail, hubspot, plaid,
 * brex, linkedin, clearbit, apollo, zendesk.
 */
export const KNOWN_PROVIDERS: Readonly<Record<string, KnownProviderMeta>> = {
  github: {
    displayName: 'GitHub',
    defaultScopes: ['repo', 'read:user'],
    scopeMap: {
      repos: 'repo',
      pulls: 'repo',
      issues: 'repo',
      user: 'read:user',
      org: 'read:org',
    },
  },
  salesforce: {
    displayName: 'Salesforce',
    defaultScopes: ['api', 'refresh_token'],
    scopeMap: {
      leads: 'api',
      contacts: 'api',
      opportunities: 'api',
      accounts: 'api',
    },
  },
  quickbooks: {
    displayName: 'QuickBooks',
    defaultScopes: ['com.intuit.quickbooks.accounting'],
    scopeMap: {
      accounting: 'com.intuit.quickbooks.accounting',
      payments: 'com.intuit.quickbooks.payment',
    },
  },
  stripe: {
    displayName: 'Stripe',
    defaultScopes: ['read_write'],
    scopeMap: {
      charges: 'read_write',
      customers: 'read_write',
      payouts: 'read_write',
      invoices: 'read_write',
    },
  },
  slack: {
    displayName: 'Slack',
    defaultScopes: ['chat:write', 'channels:read'],
    scopeMap: {
      chat: 'chat:write',
      channels: 'channels:read',
      users: 'users:read',
      files: 'files:write',
    },
  },
  gmail: {
    displayName: 'Gmail',
    defaultScopes: ['https://www.googleapis.com/auth/gmail.send'],
    scopeMap: {
      send: 'https://www.googleapis.com/auth/gmail.send',
      read: 'https://www.googleapis.com/auth/gmail.readonly',
      modify: 'https://www.googleapis.com/auth/gmail.modify',
    },
  },
  hubspot: {
    displayName: 'HubSpot',
    defaultScopes: ['crm.objects.contacts.read', 'crm.objects.contacts.write'],
    scopeMap: {
      contacts: 'crm.objects.contacts.read',
      deals: 'crm.objects.deals.read',
      companies: 'crm.objects.companies.read',
    },
  },
  plaid: {
    displayName: 'Plaid',
    defaultScopes: ['transactions', 'auth'],
    scopeMap: {
      transactions: 'transactions',
      auth: 'auth',
      identity: 'identity',
      balance: 'balance',
    },
  },
  brex: {
    displayName: 'Brex',
    defaultScopes: ['transactions:read', 'cards:read'],
    scopeMap: {
      transactions: 'transactions:read',
      cards: 'cards:read',
      users: 'users:read',
    },
  },
  linkedin: {
    displayName: 'LinkedIn',
    defaultScopes: ['r_liteprofile', 'r_emailaddress'],
    scopeMap: {
      profile: 'r_liteprofile',
      email: 'r_emailaddress',
      share: 'w_member_social',
    },
  },
  clearbit: {
    displayName: 'Clearbit',
    defaultScopes: ['enrichment.read'],
    scopeMap: {
      enrich: 'enrichment.read',
      reveal: 'reveal.read',
    },
  },
  apollo: {
    displayName: 'Apollo',
    defaultScopes: ['leads.read', 'contacts.read'],
    scopeMap: {
      leads: 'leads.read',
      contacts: 'contacts.read',
      sequences: 'sequences.read',
    },
  },
  zendesk: {
    displayName: 'Zendesk',
    defaultScopes: ['tickets:read', 'tickets:write'],
    scopeMap: {
      tickets: 'tickets:read',
      users: 'users:read',
      organizations: 'organizations:read',
    },
  },
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Parse a `binding.toolPermissions` string into `{ provider, scope? }`. The
 * convention is `'<provider>.<scope>'`; `'<provider>'` alone is allowed. A
 * permission that doesn't match (no provider key) returns `undefined` — the
 * runtime tool registry handles those independently of OAuth onboarding.
 */
export function parseToolPermission(
  perm: string
): { provider: string; scope: string | undefined } | undefined {
  const trimmed = perm.trim()
  if (!trimmed) return undefined
  const dotIdx = trimmed.indexOf('.')
  const provider = (dotIdx === -1 ? trimmed : trimmed.slice(0, dotIdx)).toLowerCase()
  if (!provider) return undefined
  const scope = dotIdx === -1 ? undefined : trimmed.slice(dotIdx + 1)
  return { provider, scope }
}

/**
 * Resolve the full OAuth scope set for a provider given the short scopes
 * declared on `binding.toolPermissions`. Falls back to the provider's
 * `defaultScopes` when the short scope is unknown or empty.
 *
 * Returns the original `declaredScopes` (de-duplicated) when the provider
 * isn't in {@link KNOWN_PROVIDERS} — keeps the derive function pure even
 * when the consumer wires a custom provider.
 */
export function providerScopesFor(provider: string, declaredScopes: string[]): string[] {
  const meta = KNOWN_PROVIDERS[provider]
  if (!meta) {
    return Array.from(new Set(declaredScopes)).sort()
  }
  if (declaredScopes.length === 0) {
    return [...meta.defaultScopes]
  }
  const scopes = new Set<string>()
  for (const short of declaredScopes) {
    const full = meta.scopeMap?.[short]
    if (full) {
      scopes.add(full)
    } else {
      scopes.add(short)
    }
  }
  return Array.from(scopes).sort()
}

/**
 * Display name for a provider key; falls back to title-casing the key when
 * the provider isn't in {@link KNOWN_PROVIDERS}.
 */
export function providerDisplayName(provider: string): string {
  const meta = KNOWN_PROVIDERS[provider]
  if (meta) return meta.displayName
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}
