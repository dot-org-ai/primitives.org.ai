/**
 * Shared utilities for ai-evaluate
 *
 * Contains constants and helper functions used by both
 * evaluate.ts (Workers) and node.ts (Node.js/Miniflare)
 */

import type { EvaluateResult, WorkerCode } from './types.js'

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
 * An npm package name, optionally scoped: `lodash`, `@scope/pkg`, `pkg.js`.
 * The npm rules, minus length: lowercase, URL-safe, no leading `.` or `_`.
 */
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/

/** A bare import specifier split into its package name and version range */
export interface ImportSpecifier {
  /** Package name, scope included: `lodash`, `@scope/pkg` */
  name: string
  /** Version or range after the last `@` (`4.17.21`, `^4`); `'latest'` when absent */
  version: string
}

/**
 * Parse a bare package specifier - `lodash`, `lodash@4.17.21`, `@scope/pkg`,
 * `@scope/pkg@^1.0.0` - into name and version. Returns `null` for anything
 * that is not a bare specifier: URLs, relative paths, empty or malformed
 * names. Subpaths (`lodash/fp`) are not specifiers of a package to install
 * and are rejected too.
 */
export function parseImportSpecifier(specifier: string): ImportSpecifier | null {
  if (!specifier || specifier.includes('://') || specifier.startsWith('.')) return null
  // The version separator is the last `@` that is not the scope marker
  const at = specifier.lastIndexOf('@')
  const [name, version] =
    at > 0 ? [specifier.slice(0, at), specifier.slice(at + 1)] : [specifier, 'latest']
  if (!PACKAGE_NAME_PATTERN.test(name) || version.length === 0 || /\s/.test(version)) {
    return null
  }
  return { name, version }
}

/**
 * Whether a string is a valid npm package name (`lodash`, `@scope/pkg`) - the
 * shape of a `dependencies` key.
 */
export function isPackageName(name: string): boolean {
  return PACKAGE_NAME_PATTERN.test(name)
}

/**
 * Split an `imports` list into what the bundler resolves (bare specifiers,
 * as package.json `dependencies`) and what is fetched as-is (URLs). Order is
 * preserved per group; a bare specifier that is also in `dependencies`
 * keeps the explicit dependency's version.
 */
export function partitionImports(
  imports: readonly string[],
  dependencies: Record<string, string> = {}
): { dependencies: Record<string, string>; urls: string[] } {
  const resolved: Record<string, string> = { ...dependencies }
  const urls: string[] = []
  for (const specifier of imports) {
    const parsed = parseImportSpecifier(specifier)
    if (!parsed) {
      urls.push(specifier)
      continue
    }
    resolved[parsed.name] ??= parsed.version
  }
  return { dependencies: resolved, urls }
}

/**
 * The `package.json` module every worker with dependencies carries. A json
 * module the code never imports; it puts the dependency versions into the
 * content-addressed spec so that `lodash@4.17.21` and `lodash@4.17.20` are
 * two workers even when their bundled bytes happen to agree.
 */
export const PACKAGE_JSON_MODULE = 'package.json'

/** The `package.json` module for a set of dependencies (sorted keys) */
export function packageJsonModule(dependencies: Record<string, string>): {
  json: { dependencies: Record<string, string> }
} {
  const sorted: Record<string, string> = {}
  for (const name of Object.keys(dependencies).sort()) sorted[name] = dependencies[name]!
  return { json: { dependencies: sorted } }
}

/**
 * Extract package name from import specifier for variable naming
 * Supports: lodash, lodash@4.17.21, @scope/pkg, https://esm.sh/lodash
 */
export function extractPackageName(specifier: string, index: number): string {
  let name: string | undefined
  if (specifier.includes('://')) {
    // Full URL - the package path segment(s) of an esm.sh-style URL
    name = specifier.match(/esm\.sh\/(@[^@/]+\/[^@/]+|[^@/]+)/)?.[1]
  } else {
    name = parseImportSpecifier(specifier)?.name
  }
  if (!name) return `pkg${index}`
  // `@scope/pkg-name` -> `scope_pkg_name`: a plain identifier for globalThis
  const identifier = name.replace(/^@/, '').replace(/[^A-Za-z0-9_$]/g, '_')
  return /^[A-Za-z_$]/.test(identifier) ? identifier : `_${identifier}`
}

/**
 * Default sandbox URL for worker fetch requests
 */
export const SANDBOX_URL = 'http://sandbox/execute'

/**
 * Route served by the host worker (see host-worker.ts): POST an
 * `EvaluateOptions` body, receive an `EvaluateResult`.
 */
export const EVALUATE_PATH = '/evaluate'

/**
 * cyrb53: fast, well-distributed ~53-bit string hash. A cache key, not a
 * security hash.
 */
export const cyrb53 = (input: string): string => {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

/**
 * Serialize a value to JSON with object keys sorted at every depth, so two
 * specs that differ only in property order serialize identically.
 * `undefined` properties are dropped (as `JSON.stringify` does), so an absent
 * field and an explicitly `undefined` one are the same spec.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return v
    // Binary modules (`data`, `wasm`) would serialize as `{}`; stand in a
    // digest of the bytes so differing binaries get differing ids.
    if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
      const bytes =
        v instanceof ArrayBuffer
          ? new Uint8Array(v)
          : new Uint8Array(v.buffer, v.byteOffset, v.byteLength)
      return { $bytes: bytes.byteLength, $hash: cyrb53(String.fromCharCode(...bytes)) }
    }
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(v as Record<string, unknown>).sort()) {
      sorted[key] = (v as Record<string, unknown>)[key]
    }
    return sorted
  })
}

/**
 * The parts of a `WorkerCode` spec that define a unique worker.
 *
 * Bindings (`env`, the `globalOutbound` service, `tails`) are excluded: they
 * are attached to the isolate at load time, and hashing them would either
 * fail (RPC stubs are not serializable) or split one worker into many for
 * the same code. Whether outbound fetch is blocked (`globalOutbound: null`)
 * is kept, as it changes what the worker can do.
 */
function workerIdentity(spec: WorkerCode) {
  return {
    mainModule: spec.mainModule,
    modules: spec.modules,
    compatibilityDate: spec.compatibilityDate,
    compatibilityFlags: spec.compatibilityFlags,
    allowExperimental: spec.allowExperimental,
    limits: spec.limits,
    outboundBlocked: spec.globalOutbound === null,
  }
}

/**
 * Content-address a `WorkerCode` spec.
 *
 * Deterministic: the same spec (modules, compatibility date and flags,
 * `allowExperimental`, `limits`, whether outbound fetch is blocked) yields the
 * same id, so the Dynamic Workers loader (`loader.get(id, factory)`) reuses the
 * cached isolate instead of minting a fresh one per call. Any change to those
 * fields changes the id; `env`, `globalOutbound` services and `tails` do not
 * (see `workerIdentity`). One id per unique worker is the cost control under
 * Cloudflare's per-unique-worker/day pricing.
 *
 * What must not be shared across callers of the same code goes into
 * `modules` as a json module instead, so it is hashed: the outbound policy as
 * `outbound.json`, and with a facet the sandbox identity as `sandbox.json`
 * (`SANDBOX_JSON_MODULE`) - a `'cached'` isolate whose env holds sandbox A's
 * `SandboxHost` stub is never handed sandbox B's script.
 *
 * Uses a stable (sorted-key) JSON serialization hashed with cyrb53.
 */
export const workerCodeId = (spec: WorkerCode): string =>
  `sandbox-${cyrb53(stableStringify(workerIdentity(spec)))}`

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
    // Any subdomain, and the apex itself: 'api.example.com' and
    // 'example.com' both match '*.example.com'; 'example.com.evil.com' does not
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
