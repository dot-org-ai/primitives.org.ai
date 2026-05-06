/**
 * `Service.load()` — load a previously-published Service from the marketplace.
 *
 * Round 3 status: stub. Real implementation requires marketplace persistence
 * (per ADR-0005 — ClickHouse MV from Iceberg) which lands alongside
 * `Service.publish()` in round 5.
 *
 * The signature is locked today so callers can write `await Service.load(ref)`
 * code now and have it light up as soon as round 5 ships.
 *
 * @packageDocumentation
 */

import type { ServiceInstance } from '../service.js'
import type { ServiceRef } from '../types.js'

import { NotImplementedError } from './expand-do-sugar.js'

/**
 * Load a {@link ServiceInstance} by its {@link ServiceRef} from the
 * marketplace.
 *
 * **Round 3 stub** — throws {@link NotImplementedError} until round 5
 * persistence lands. The returned promise type uses `unknown` defaults for
 * `TIn` / `TOut` since at load time the catalog is the source of truth for
 * those schemas.
 */
export function load<TIn = unknown, TOut = unknown>(
  ref: ServiceRef
): Promise<ServiceInstance<TIn, TOut>> {
  return Promise.reject(
    new NotImplementedError(
      `Service.load(${JSON.stringify(ref)}) requires marketplace persistence; ` +
        `arrives in round 5 alongside Service.publish (per ADR-0005).`
    )
  )
}
