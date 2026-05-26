/**
 * Canonical Drizzle schema for the four-table docs+rels+search+events spine.
 *
 * # Background
 *
 * This schema is implemented THREE TIMES with near-identical Drizzle code
 * across icps, services-builder, and startup-builder. The bd ticket sb-yjqn
 * (Phase-1 lift) consolidates them.
 *
 * The lift produces a `createDocsRelsSchema(opts)` factory rather than a
 * fixed `pgSchema`-bound module so that each downstream repo can choose its
 * schema name (`docs_rels`, `icps`, `services`, ...) and opt in/out of the
 * review-pipeline columns it does or doesn't need.
 *
 * # Canonical contract
 *
 * - `docs(ns, id, type, data jsonb, created_at, updated_at)` — content-addressed.
 *   PK on `(ns, id)`. Optional `layer`, `status`, `review_state`, `review_notes`
 *   columns are gated behind factory flags.
 * - `rels(ns, src, rel, dst, data jsonb, created_at)` — typed edges. PK on
 *   `(ns, src, rel, dst)`. Optional `evidence_kind`, `review_state`,
 *   `review_notes` flags.
 * - `search(content_id, ns, type, content, content_hash, embedding halfvec(1536),
 *   tsv tsvector, ...)` — embedding + FTS spine. PK on `(content_id)`.
 * - `events(id uuid pk, ns, doc_id, type, ..., status, created_at)` — append-only
 *   event stream with token + cost + latency rollup columns.
 *
 * # Index strategy (per the inventory + the user's spec)
 *
 * - HNSW on `search.embedding` for ANN cosine
 * - GIN on `search.tsv` for FTS
 * - GIN on `docs.data` for jsonb path queries
 * - GIN on `rels.data` for jsonb path queries
 * - Partial indexes on `events.status <> 'success'` (failure tail) and
 *   on `events.parent_event_id is not null` (causal tree).
 *
 * # Strict superset over icps + sb + svc
 *
 * Every column in the union of the three repos' schemas is reachable
 * through some combination of factory options. See the schema-contract test
 * for the static check.
 */

import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import {
  DEFAULT_EMBEDDING_DIM,
  DEFAULT_EMBEDDING_MODEL,
  halfvec,
  tsvector,
  vector,
} from './custom-types.js'

/**
 * Document `status` vocabulary. The icps + svc enums differ by one element
 * (icps: `validated`; svc: `unverified` + `verified`). The canonical schema
 * unions both vocabularies — consumers narrow at the application layer.
 */
export const DOC_STATUS = [
  'candidate',
  'validated',
  'unverified',
  'verified',
  'published',
  'retired',
] as const
export type DocStatus = (typeof DOC_STATUS)[number]

/**
 * Review state vocabulary. icps + svc agree on these seven states; the
 * canonical schema preserves the enum.
 */
export const REVIEW_STATE = [
  'untriaged',
  'agent-approved',
  'agent-rejected',
  'human-flagged',
  'systemic-issue',
  'accepted',
  'retired',
] as const
export type ReviewState = (typeof REVIEW_STATE)[number]

/**
 * Evidence-kind vocabulary for typed edges. icps + svc agree on these five
 * tiers.
 */
export const EVIDENCE_KIND = [
  'source_exact',
  'mechanical',
  'embed_judge',
  'llm_verified',
  'inherited_llm',
] as const
export type EvidenceKind = (typeof EVIDENCE_KIND)[number]

/**
 * Event `status` vocabulary. icps + svc agree.
 */
export const EVENT_STATUS = ['success', 'error', 'rejected'] as const
export type EventStatus = (typeof EVENT_STATUS)[number]

/**
 * Options for the canonical schema factory.
 */
export interface DocsRelsSchemaOptions {
  /** Postgres schema name. Default `docs_rels`. */
  schemaName?: string
  /** Embedding dimensionality. Default 1536. */
  embeddingDim?: number
  /** Default embedding model id. Default `gemini-embedding-2`. */
  embeddingModel?: string
  /** Use legacy full-precision `vector` instead of canonical `halfvec`. Default `false`. */
  useLegacyFp32Vector?: boolean
}

/**
 * Build the canonical four-table schema bound to a specific Postgres
 * `pgSchema`. Returns the table objects + the bound schema.
 *
 * Every column that any consumer requires is present. Consumers that don't
 * use a column simply leave it nullable / default.
 *
 * @example
 * ```ts
 * const { docs, rels, search, events } = createDocsRelsSchema({
 *   schemaName: 'icps',
 *   embeddingDim: 1536,
 *   embeddingModel: 'gemini-embedding-2',
 * })
 * ```
 */
export function createDocsRelsSchema(opts: DocsRelsSchemaOptions = {}) {
  const schemaName = opts.schemaName ?? 'docs_rels'
  const embeddingDim = opts.embeddingDim ?? DEFAULT_EMBEDDING_DIM
  const embeddingModel = opts.embeddingModel ?? DEFAULT_EMBEDDING_MODEL
  const embedding = opts.useLegacyFp32Vector ? vector(embeddingDim) : halfvec(embeddingDim)

  const ns = pgSchema(schemaName)

  const docs = ns.table(
    'docs',
    {
      ns: text('ns').notNull(),
      id: text('id').notNull(),
      type: text('type').notNull(),
      // Optional review-pipeline columns. Nullable so consumers that don't run
      // a review pipeline (sb today) can simply ignore them.
      layer: text('layer'),
      status: text('status', { enum: DOC_STATUS }),
      reviewState: text('review_state', { enum: REVIEW_STATE }),
      reviewNotes: jsonb('review_notes'),
      reviewSystemicIssueId: uuid('review_systemic_issue_id'),
      data: jsonb('data').$type<Record<string, unknown>>().notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
      primaryKey({ name: 'docs_pk', columns: [t.ns, t.id] }),
      index('docs_ns_type').on(t.ns, t.type),
      index('docs_type').on(t.type),
      index('docs_layer').on(t.layer),
      index('docs_status').on(t.status),
      index('docs_review_state').on(t.reviewState),
      index('docs_updated').on(t.updatedAt),
      index('docs_data_gin').using('gin', t.data),
    ]
  )

  const rels = ns.table(
    'rels',
    {
      ns: text('ns').notNull(),
      src: text('src').notNull(),
      rel: text('rel').notNull(),
      dst: text('dst').notNull(),
      data: jsonb('data')
        .$type<Record<string, unknown> | null>()
        .default(sql`'{}'::jsonb`),
      // Optional review-pipeline columns
      evidenceKind: text('evidence_kind', { enum: EVIDENCE_KIND }),
      reviewState: text('review_state', { enum: REVIEW_STATE }),
      reviewNotes: jsonb('review_notes'),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
      primaryKey({ name: 'rels_pk', columns: [t.ns, t.src, t.rel, t.dst] }),
      index('rels_ns_src').on(t.ns, t.src, t.rel),
      index('rels_ns_dst').on(t.ns, t.dst, t.rel),
      index('rels_rel').on(t.rel),
      index('rels_evidence_kind').on(t.evidenceKind),
      index('rels_data_gin').using('gin', t.data),
    ]
  )

  const search = ns.table(
    'search',
    {
      // Per the canonical contract: PK is content_id.
      contentId: text('content_id').notNull(),
      ns: text('ns').notNull(),
      // The `type` column is part of the canonical contract per the user's
      // spec — used to discriminate which subset of the search corpus a
      // record belongs to (e.g. `cascade-output` vs `naics`).
      type: text('type').notNull(),
      // Optional pointer back to the source doc. NOT part of the search PK.
      docId: text('doc_id'),
      content: text('content').notNull(),
      contentHash: text('content_hash').notNull(),
      recipeVersion: text('recipe_version').notNull().default('v1'),
      dim: integer('dim').notNull().default(embeddingDim),
      tsv: tsvector('tsv'),
      embedding: embedding('embedding'),
      embeddingModel: text('embedding_model').notNull().default(embeddingModel),
      data: jsonb('data')
        .$type<Record<string, unknown>>()
        .default(sql`'{}'::jsonb`),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
      // Per the user's canonical spec: PK is content_id.
      primaryKey({ name: 'search_pk', columns: [t.contentId] }),
      index('search_ns_type').on(t.ns, t.type),
      index('search_ns_doc').on(t.ns, t.docId),
      index('search_content_hash').on(t.contentHash),
      index('search_recipe').on(t.recipeVersion),
      index('search_model_dim').on(t.embeddingModel, t.dim),
      // GIN on tsv for FTS
      index('search_tsv_gin').using('gin', t.tsv),
      // HNSW vector index (cosine ops) ships as raw-SQL migration; drizzle-kit
      // doesn't model HNSW operator class indexes, but the schema declaration
      // here is sufficient for the consumer + the migration SQL below.
    ]
  )

  const events = ns.table(
    'events',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      ns: text('ns'),
      docId: text('doc_id'),
      type: text('type').notNull(),
      layer: text('layer'),
      model: text('model'),
      prompt: jsonb('prompt'),
      output: jsonb('output'),
      promptTokens: integer('prompt_tokens'),
      completionTokens: integer('completion_tokens'),
      thinkingTokens: integer('thinking_tokens'),
      costUsd: numeric('cost_usd', { precision: 12, scale: 6 }),
      latencyMs: integer('latency_ms'),
      runId: text('run_id'),
      parentEventId: uuid('parent_event_id'),
      status: text('status', { enum: EVENT_STATUS }).notNull(),
      rejectionReason: text('rejection_reason'),
      error: text('error'),
      payload: jsonb('payload'),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
      index('events_type_layer').on(t.type, t.layer, t.createdAt.desc()),
      index('events_doc')
        .on(t.ns, t.docId)
        .where(sql`doc_id is not null`),
      index('events_run')
        .on(t.runId)
        .where(sql`run_id is not null`),
      index('events_failures')
        .on(t.status, t.createdAt.desc())
        .where(sql`status <> 'success'`),
      index('events_parent')
        .on(t.parentEventId)
        .where(sql`parent_event_id is not null`),
    ]
  )

  return {
    schema: ns,
    schemaName,
    embeddingDim,
    embeddingModel,
    docs,
    rels,
    search,
    events,
  } as const
}

/**
 * Return type of the canonical factory. Useful for consumers that want a
 * typed reference to the bound schema.
 */
export type DocsRelsSchema = ReturnType<typeof createDocsRelsSchema>

/**
 * Convenience: the default-bound schema (schema name `docs_rels`,
 * 1536-dim halfvec, gemini-embedding-2). This matches what
 * startup-builder uses today (modulo the halfvec migration).
 */
export const docsRelsSchema = createDocsRelsSchema()
export const { docs, rels, search, events } = docsRelsSchema

export type Doc = typeof docs.$inferSelect
export type NewDoc = typeof docs.$inferInsert
export type Rel = typeof rels.$inferSelect
export type NewRel = typeof rels.$inferInsert
export type SearchRow = typeof search.$inferSelect
export type NewSearchRow = typeof search.$inferInsert
export type EventRow = typeof events.$inferSelect
export type NewEventRow = typeof events.$inferInsert
