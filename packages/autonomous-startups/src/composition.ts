// =====================================================================================
// The five-primitive composition.
//
// An autonomous startup IS the composition of exactly five conceptual primitives. This
// module does NOT redefine those primitives — it consumes their published shapes and
// names the five register slots the capstone binds them into. Every import here is
// type-only: the capstone carries zero runtime edges to the primitives it composes, so it
// stays pure domain (no HTTP, no db, no platform coupling).
//
//   business     — the commercial model         (business-as-code)
//   offers       — paid delivery / the offer     (services-as-software)
//   products     — what the startup sells         (digital-products)
//   tools        — what the startup wields         (digital-tools)
//   workforce    — who performs the work           (digital-workers; type 'agent' | 'human')
// =====================================================================================

import type { BusinessDefinition } from 'business-as-code'
import type { ServiceDefinition } from 'services-as-software'
import type { DigitalProduct } from 'digital-products'
import type { Tool } from 'digital-tools'
import type { Worker, WorkerType } from 'digital-workers'

export type { Tool, Worker, WorkerType }

/** The commercial model — what the startup IS as a business (business-as-code). */
export type BusinessModel = BusinessDefinition

/** A paid delivery unit — how value crosses the company boundary to a buyer (services-as-software). */
export type Offer = ServiceDefinition

/** Something the startup sells — a whole product, app, API, or site (digital-products). */
export type Product = DigitalProduct

/**
 * The five bound registers of an autonomous startup.
 *
 * Exactly one business model; zero-or-more offers, products, tools, and workers. The
 * workforce is the digital-workers interface over both autonomous agents and humans, so a
 * startup composes its labor uniformly regardless of who performs each unit of work.
 */
export interface StartupComposition {
  /** The commercial model (business-as-code). */
  readonly business: BusinessModel
  /** Paid-delivery offers the startup sells and fulfills (services-as-software). */
  readonly offers: readonly Offer[]
  /** Digital products the startup ships (digital-products). */
  readonly products: readonly Product[]
  /** Tools the startup wields to do its work (digital-tools). */
  readonly tools: readonly Tool[]
  /** The workforce that performs the work — agents and humans (digital-workers). */
  readonly workforce: readonly Worker[]
}
