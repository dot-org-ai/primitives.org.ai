/**
 * AuthorityBoundary — typed regulatory marker on a Service.
 * The 12-tag catalog (per startup-builder SERVICES.md) lets a cascade
 * declare the boundary it operates within; routing and HITL gates
 * compose against the boundary.
 *
 * 10 regulated tags + 2 sentinels (none, self-only).
 */

export type AuthorityBoundaryRef =
  | 'self-only' // sentinel: agent acts for itself; no externally-binding outputs
  | 'tenant-only' // sentinel: outputs bind only the tenant; no external counterparties
  | 'unlicensed-advisory' // general-knowledge advisory; no professional license claimed
  | 'cpa-attest' // CPA-signed attestation required
  | 'jd-bar-admitted' // attorney admitted to relevant bar
  | 'md-licensed' // physician with current state license
  | 'fiduciary-investment-advice' // RIA / fiduciary-grade investment recommendation
  | 'broker-dealer' // broker-dealer scope (FINRA-registered context)
  | 'insurance-licensed' // licensed insurance producer
  | 'real-estate-licensed' // licensed real-estate broker / agent
  | 'pe-stamp' // PE-stamped engineering output
  | 'kyc-aml-required' // identity + AML screening before action
  | (string & { __brand?: 'AuthorityBoundaryRef' })

/**
 * Catalog of canonical AuthorityBoundary tags with policy hints. Consumers
 * reference by id; substrate enforces gating + HITL routing per tag.
 */
export const AuthorityBoundaries = {
  'self-only': { regulated: false, requiresHumanSign: false, requiresKYC: false },
  'tenant-only': { regulated: false, requiresHumanSign: false, requiresKYC: false },
  'unlicensed-advisory': { regulated: false, requiresHumanSign: false, requiresKYC: false },
  'cpa-attest': { regulated: true, requiresHumanSign: true, requiresKYC: true },
  'jd-bar-admitted': { regulated: true, requiresHumanSign: true, requiresKYC: true },
  'md-licensed': { regulated: true, requiresHumanSign: true, requiresKYC: true },
  'fiduciary-investment-advice': { regulated: true, requiresHumanSign: true, requiresKYC: true },
  'broker-dealer': { regulated: true, requiresHumanSign: true, requiresKYC: true },
  'insurance-licensed': { regulated: true, requiresHumanSign: true, requiresKYC: true },
  'real-estate-licensed': { regulated: true, requiresHumanSign: true, requiresKYC: true },
  'pe-stamp': { regulated: true, requiresHumanSign: true, requiresKYC: false },
  'kyc-aml-required': { regulated: true, requiresHumanSign: false, requiresKYC: true },
} as const
