/**
 * `deriveAll` — bundle the six UI shapes for a Service.
 *
 * Per v3 §8, five of the six shapes (`catalog`, `order`, `onboarding`,
 * `delivery`, `portal`) honour an explicit override on the Service spec
 * (`svc.<shape> ?? derive<Shape>(svc)`). The sixth (`integrations`) is
 * always derived from `binding.toolPermissions` and is *not* overridable.
 *
 * Pure; no I/O; no LLM.
 *
 * @packageDocumentation
 */

import { deriveCatalog } from './derive-catalog.js'
import { deriveDelivery } from './derive-delivery.js'
import { deriveIntegrations } from './derive-integrations.js'
import { deriveOnboarding } from './derive-onboarding.js'
import { deriveOrder } from './derive-order.js'
import { derivePortal } from './derive-portal.js'
import type { ServiceInstance } from '../service.js'
import type { ServiceShapes } from './types.js'

/**
 * Compute every UI shape for a Service in one call. Override-aware for the
 * five spec-overridable shapes; `integrations` is always derived.
 */
export function deriveAll(svc: ServiceInstance<unknown, unknown>): ServiceShapes {
  return {
    catalog: svc.catalog ?? deriveCatalog(svc),
    order: svc.order ?? deriveOrder(svc),
    onboarding: svc.onboarding ?? deriveOnboarding(svc),
    delivery: svc.delivery ?? deriveDelivery(svc),
    portal: svc.portal ?? derivePortal(svc),
    integrations: deriveIntegrations(svc),
  }
}
