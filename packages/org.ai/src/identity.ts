/**
 * Identity utilities from id.org.ai
 *
 * Provides identity, auth, and payment broker primitives for users and AI
 * agents following MDXLD conventions with $id and $type fields.
 *
 * ## Curation policy (do NOT replace with `export *`)
 *
 * `id.org.ai` is the most fragile cross-repo seam in this monorepo: anything
 * exported from its `dist/index.d.ts` becomes part of `org.ai`'s public API
 * the moment it's re-exported. To keep the contract small and intentional,
 * this module re-exports a **curated** subset rather than wildcarding.
 *
 * The curated set is the canonical public surface published in the
 * `id.org.ai@^0.3.0` release note (auth/payment broker primitives + the
 * `Identity` type) plus a few extras that current consumers in this repo
 * (notably `digital-tools/src/wrap.ts`) need to type-check.
 *
 * ### How to add a new export
 *
 * 1. Verify the symbol is part of `id.org.ai`'s **intended** public API
 *    (check the package README / release notes — internal helpers like
 *    `OAuth21Server`, `MCPAuth`, WorkOS adapters, etc. should NOT be
 *    surfaced through `org.ai`; consumers that need those should import
 *    from `id.org.ai` directly).
 * 2. Add it to the appropriate `export` block below (values vs. types).
 * 3. If unsure whether a symbol is public, prefer leaving it out and
 *    importing it from `id.org.ai` directly at the call site.
 *
 * @example
 * ```ts
 * import { wrap, denialResponse, AuthBrokerImpl } from 'org.ai/identity'
 * import type { Identity, AuthDecision, PaymentReceipt } from 'org.ai/identity'
 * ```
 */

// ----------------------------------------------------------------------------
// Value exports — runtime brokers, helpers, and HTTP wrappers
// ----------------------------------------------------------------------------
export {
  // Auth brokers
  AuthBrokerImpl,
  // Payment brokers
  PaymentBrokerImpl,
  HttpFacilitatorClient,
  // HTTP helpers (wrap a fetch handler with broker-aware gating)
  wrap,
  denialResponse,
  statusForDenial,
} from 'id.org.ai'

// ----------------------------------------------------------------------------
// Type exports — Identity, broker interfaces, and request/response shapes
// ----------------------------------------------------------------------------
export type {
  // Identity
  Identity,
  // Auth contract
  AuthBroker,
  AuthRequirement,
  AuthDecision,
  // Payment contract
  PaymentBroker,
  PaymentRail,
  PaymentInstrument,
  PaymentRequired,
  PaymentReceipt,
  PaymentSession,
  PaymentOutcome,
  RailQuote,
  SessionRequired,
} from 'id.org.ai'
