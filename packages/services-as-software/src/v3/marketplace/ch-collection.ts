/**
 * ClickHouse-backed {@link ServiceCollection} — round-13 stub.
 *
 * Per ADR-0005, the production catalog read-path is served by a ClickHouse
 * materialized view fed from R2 Iceberg via the Stack-B Pipelines fan-out
 * (per ADR-0003). This module reserves the surface so consumers can write
 *
 * ```ts
 * configureServiceCollection(new CHServiceCollection({ ch }))
 * ```
 *
 * today and have it light up as soon as round-14+ wires the actual
 * ClickHouse client + Vectorize sidecar.
 *
 * Required CH MV schema (per ADR-0005 §Decision):
 *
 * ```sql
 * CREATE MATERIALIZED VIEW services_catalog_mv (
 *   service_id String,
 *   tenant String,
 *   archetype String,
 *   category String,
 *   audience String,
 *   state String,
 *   published_at DateTime,
 *   lineage_cell_id String,
 *   lineage_icp_id String,
 *   name String,
 *   promise String,
 *   pricing_summary String,
 *   popularity_score Float64
 * ) ENGINE = MergeTree()
 * ORDER BY (tenant, archetype, category, popularity_score DESC)
 * ```
 *
 * Secondary indexes on `lineage_cell_id` and `lineage_icp_id` per ADR-0005
 * support the reverse-lookup queries ("every Service for occupation X" /
 * "every Service in cell Y"). Free-text `query` filtering delegates to the
 * Vectorize sidecar indexed on the same Service mutation events that feed
 * the MV.
 *
 * Pagination uses keyset on `(popularity_score DESC, service_id ASC)` per
 * ADR-0005 — never `OFFSET`, which degrades sharply at catalog scale.
 *
 * @packageDocumentation
 */

import type {
  ServiceCollection,
  ServiceCollectionFilter,
  ServiceCollectionOpts,
  ServiceCollectionPage,
} from './collection.js'
import { NotImplementedError } from '../service/expand-do-sugar.js'

// ============================================================================
// CH client port (stub)
// ============================================================================

/**
 * Minimal ClickHouse-client port the round-14+ implementation will wire
 * against. Kept as a structural type so consumers can pass `@clickhouse/client`,
 * `@cloudflare/workers-clickhouse`, or a test double without an adapter.
 *
 * Round-13 ships without a body — see {@link CHServiceCollection.page}.
 */
export interface CHClientPort {
  /** Execute a parameterised query and return the rows. */
  query<TRow = Record<string, unknown>>(opts: {
    query: string
    query_params?: Record<string, unknown>
  }): Promise<{ data: TRow[] }>
}

/** Construction options for {@link CHServiceCollection}. */
export interface CHServiceCollectionOpts {
  /** ClickHouse client connected to the catalog cluster. */
  ch: CHClientPort
  /**
   * Override the materialized-view name; defaults to `services_catalog_mv`
   * per ADR-0005.
   */
  mvName?: string
  /**
   * Vectorize sidecar handle for free-text search on `name + promise +
   * description`. Optional; when absent, `filter.query` falls back to a CH
   * `LIKE` scan (slow at scale — round-14+ requires the sidecar for
   * production).
   */
  vectorize?: unknown
}

// ============================================================================
// CHServiceCollection — round-13 stub
// ============================================================================

/**
 * ClickHouse-backed {@link ServiceCollection}. **Round-13 stub** — every
 * method throws {@link NotImplementedError}. The class exists so production
 * boot code can wire it through {@link configureServiceCollection} today and
 * the round-14+ implementation is a drop-in body fill, not a re-design.
 *
 * @example Wire production read-path (round-14+ — body NotImplemented today)
 * ```ts
 * import { createClient } from '@clickhouse/client'
 * import {
 *   CHServiceCollection,
 *   configureServiceCollection,
 * } from 'services-as-software/v3'
 *
 * const ch = createClient({ url: env.CH_URL })
 * configureServiceCollection(new CHServiceCollection({ ch }))
 * ```
 */
export class CHServiceCollection implements ServiceCollection {
  // `opts` is captured for the round-14+ body fill — kept private so we don't
  // promise a public surface we haven't validated yet.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private readonly opts: CHServiceCollectionOpts) {}

  // TODO(round-14+): replace with real implementation against
  // `services_catalog_mv` per ADR-0005:
  //
  //   const { data } = await this.opts.ch.query<MVRow>({
  //     query: `
  //       SELECT service_id, tenant, archetype, audience, popularity_score, ...
  //       FROM ${this.opts.mvName ?? 'services_catalog_mv'}
  //       WHERE ${buildWhere(filter)}
  //         AND (popularity_score, service_id) <
  //             ({afterScore:Float64}, {afterId:String})
  //       ORDER BY popularity_score DESC, service_id ASC
  //       LIMIT {pageSize:UInt32}
  //     `,
  //     query_params: { ... },
  //   })
  //
  // Free-text `filter.query` delegates to the Vectorize sidecar (per ADR-0005)
  // and AND-intersects the resulting service_ids into the WHERE clause.
  async page(
    _filter?: ServiceCollectionFilter,
    _opts?: ServiceCollectionOpts
  ): Promise<ServiceCollectionPage> {
    throw new NotImplementedError(
      'Service.collection over CH MV requires ADR-0005 production materialization — ' +
        'install services-as-software-ch-collection plugin or use InMemoryServiceCollection.'
    )
  }
}
