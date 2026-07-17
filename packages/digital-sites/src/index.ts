/**
 * digital-sites — a site as code (framework primitive).
 *
 * TYPE-ONLY name-claim stub (0.1.0, pre-1.0). Per ADR 0001's fixation gate the
 * shape below is a marker, not an entrenched contract — it will change without a
 * major bump while the package is 0.x. No runtime, no implementation.
 *
 * Seeded (conceptually, not yet in code) from startup-builder's site-hono-jsx +
 * ui-primitives: a website expressed as a composable, type-checked artifact.
 *
 * @packageDocumentation
 */

/** A single addressable route within a site-as-code artifact. */
export interface SitePage {
  readonly path: string
  readonly title: string
}

/**
 * A site expressed as code: the G4 public surface a minted Startup renders
 * through. Placeholder shape — pages + brand slot; no engine binding yet.
 */
export interface DigitalSite {
  readonly slug: string
  readonly pages: readonly SitePage[]
}

/**
 * Marker for the eventual `defineSite` factory. Kept as a type so consumers can
 * reference the intended surface without an implementation existing.
 */
export type DefineSite = (spec: DigitalSite) => DigitalSite

/** Package identity marker (lets `import` resolve to a real value in 0.x). */
export const DIGITAL_SITES_STUB = '0.1.0' as const
