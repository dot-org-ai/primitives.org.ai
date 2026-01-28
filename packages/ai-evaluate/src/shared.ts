/**
 * Shared utilities for ai-evaluate
 *
 * Contains constants and helper functions used by both
 * evaluate.ts (Workers) and node.ts (Node.js/Miniflare)
 */

import type { EvaluateResult } from './types.js'

/**
 * Compatibility date for dynamic workers (2026)
 */
export const COMPATIBILITY_DATE = '2026-01-01'

/**
 * Normalize an import specifier to a full URL
 *
 * Supports:
 * - Full URLs: https://esm.sh/lodash@4.17.21 (unchanged)
 * - Bare package names: lodash -> https://esm.sh/lodash
 * - Package with version: lodash@4.17.21 -> https://esm.sh/lodash@4.17.21
 * - Scoped packages: @scope/pkg -> https://esm.sh/@scope/pkg
 */
export function normalizeImport(specifier: string): string {
  // Already a URL - return as-is
  if (specifier.includes('://')) {
    return specifier
  }

  // Bare package name or scoped package - prepend esm.sh
  return `https://esm.sh/${specifier}`
}

/**
 * Normalize an array of import specifiers
 */
export function normalizeImports(imports: string[] | undefined): string[] | undefined {
  if (!imports || imports.length === 0) return imports
  return imports.map(normalizeImport)
}

/**
 * Extract package name from import specifier for variable naming
 * Supports: lodash, lodash@4.17.21, @scope/pkg, https://esm.sh/lodash
 */
export function extractPackageName(specifier: string, index: number): string {
  let pkgName: string
  if (specifier.includes('://')) {
    // Full URL - extract from path
    const match = specifier.match(/esm\.sh\/(@?[^@/]+)/)
    pkgName = match?.[1]?.replace(/^@/, '').replace(/-/g, '_') ?? `pkg${index}`
  } else {
    // Bare package name - extract before @ version
    const baseName = specifier.split('@')[0]
    pkgName = baseName
      ? baseName.replace(/^@/, '').replace(/-/g, '_').replace(/\//g, '_')
      : `pkg${index}`
  }
  return pkgName
}

/**
 * Default sandbox URL for worker fetch requests
 */
export const SANDBOX_URL = 'http://sandbox/execute'

/**
 * Generate a unique sandbox worker ID
 */
export const generateSandboxId = (): string =>
  `sandbox-${Date.now()}-${Math.random().toString(36).slice(2)}`

/**
 * Create an error result with consistent structure
 */
export function createErrorResult(error: unknown, start: number): EvaluateResult {
  return {
    success: false,
    logs: [],
    error: error instanceof Error ? error.message : String(error),
    duration: Date.now() - start,
  }
}

/**
 * Process a result from worker execution, adding duration
 */
export function processResult(result: EvaluateResult, start: number): EvaluateResult {
  return {
    ...result,
    duration: Date.now() - start,
  }
}

/**
 * Check if a domain matches a pattern (supports wildcards)
 * @param domain - The domain to check (e.g., 'api.example.com')
 * @param pattern - The pattern to match against (e.g., '*.example.com' or 'api.example.com')
 * @returns true if the domain matches the pattern
 */
export function matchesDomainPattern(domain: string, pattern: string): boolean {
  // Normalize both to lowercase
  const normalizedDomain = domain.toLowerCase()
  const normalizedPattern = pattern.toLowerCase()

  // Exact match
  if (normalizedDomain === normalizedPattern) {
    return true
  }

  // Wildcard pattern: *.example.com
  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(2) // Remove '*.'
    // Domain must end with the suffix and have at least one character before it
    // e.g., 'api.example.com' matches '*.example.com'
    // but 'example.com' does not match '*.example.com'
    return normalizedDomain.endsWith('.' + suffix) || normalizedDomain === suffix
  }

  return false
}

/**
 * Check if a URL's domain is in the allowed list
 * @param url - The URL to check
 * @param allowedDomains - List of allowed domains (supports wildcards like '*.example.com')
 * @returns true if the URL's domain is allowed
 */
export function isDomainAllowed(url: string, allowedDomains: string[]): boolean {
  try {
    const parsedUrl = new URL(url)
    const hostname = parsedUrl.hostname

    for (const pattern of allowedDomains) {
      if (matchesDomainPattern(hostname, pattern)) {
        return true
      }
    }

    return false
  } catch {
    // Invalid URL - not allowed
    return false
  }
}

/**
 * Generate JavaScript code for domain checking in workers
 * This is embedded into the worker source code
 */
export function generateDomainCheckCode(allowedDomains: string[]): string {
  const domainsJson = JSON.stringify(allowedDomains)

  return `
// Domain allowlist checking
const __allowedDomains__ = ${domainsJson};

const __matchesDomainPattern__ = (domain, pattern) => {
  const normalizedDomain = domain.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();
  if (normalizedDomain === normalizedPattern) return true;
  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(2);
    return normalizedDomain.endsWith('.' + suffix) || normalizedDomain === suffix;
  }
  return false;
};

const __isDomainAllowed__ = (url) => {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    for (const pattern of __allowedDomains__) {
      if (__matchesDomainPattern__(hostname, pattern)) return true;
    }
    return false;
  } catch { return false; }
};

const __originalFetch__ = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  if (!__isDomainAllowed__(url)) {
    throw new Error(\`Network access blocked: domain not in allowlist. Attempted: \${new URL(url).hostname}\`);
  }
  return __originalFetch__(input, init);
};
`
}
