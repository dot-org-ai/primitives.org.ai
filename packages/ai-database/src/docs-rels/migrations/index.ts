/**
 * Migration helpers. The `createMigrationSql(opts)` builder produces the
 * raw SQL statements the canonical schema needs, parameterised by schema
 * name + embedding dim.
 *
 * Consumers can either:
 * - feed the array of statements through their own driver (`db.execute(sql)`),
 * - or treat each statement as an immutable migration step.
 */

import { DEFAULT_EMBEDDING_DIM, DEFAULT_EMBEDDING_MODEL } from '../custom-types.js'

export interface MigrationOptions {
  /** Postgres schema name. Default `docs_rels`. */
  schemaName?: string
  /** Embedding dimensionality. Default 1536. */
  embeddingDim?: number
  /** Default embedding model id. Default `gemini-embedding-2`. */
  embeddingModel?: string
  /** Use legacy `vector` instead of canonical `halfvec`. Default `false`. */
  useLegacyFp32Vector?: boolean
}

/**
 * Build the canonical CREATE TABLE / CREATE INDEX statements for the
 * four-table spine, returned as a list of executable SQL strings.
 *
 * Each statement is `IF NOT EXISTS`-guarded so the migration is idempotent
 * within a single schema-version. Migrating to a NEW major version (e.g.
 * 0.1 → 0.2 with a column rename) requires explicit ALTER TABLE migrations
 * in addition.
 */
export function createMigrationSql(opts: MigrationOptions = {}): string[] {
  const schemaName = opts.schemaName ?? 'docs_rels'
  const dim = opts.embeddingDim ?? DEFAULT_EMBEDDING_DIM
  const embeddingModel = opts.embeddingModel ?? DEFAULT_EMBEDDING_MODEL
  const vectorType = opts.useLegacyFp32Vector ? 'VECTOR' : 'HALFVEC'
  const cosineOps = opts.useLegacyFp32Vector ? 'vector_cosine_ops' : 'halfvec_cosine_ops'

  return [
    `CREATE EXTENSION IF NOT EXISTS vector`,
    `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
    `
      CREATE TABLE IF NOT EXISTS "${schemaName}".docs (
        ns                          TEXT          NOT NULL,
        id                          TEXT          NOT NULL,
        type                        TEXT          NOT NULL,
        layer                       TEXT,
        status                      TEXT,
        review_state                TEXT,
        review_notes                JSONB,
        review_systemic_issue_id    UUID,
        data                        JSONB         NOT NULL,
        created_at                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT docs_pk PRIMARY KEY (ns, id)
      )
    `.trim(),
    `
      CREATE TABLE IF NOT EXISTS "${schemaName}".rels (
        ns             TEXT          NOT NULL,
        src            TEXT          NOT NULL,
        rel            TEXT          NOT NULL,
        dst            TEXT          NOT NULL,
        data           JSONB         DEFAULT '{}'::jsonb,
        evidence_kind  TEXT,
        review_state   TEXT,
        review_notes   JSONB,
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT rels_pk PRIMARY KEY (ns, src, rel, dst)
      )
    `.trim(),
    `
      CREATE TABLE IF NOT EXISTS "${schemaName}".search (
        content_id      TEXT          NOT NULL,
        ns              TEXT          NOT NULL,
        type            TEXT          NOT NULL,
        doc_id          TEXT,
        content         TEXT          NOT NULL,
        content_hash    TEXT          NOT NULL,
        recipe_version  TEXT          NOT NULL DEFAULT 'v1',
        dim             INTEGER       NOT NULL DEFAULT ${dim},
        tsv             TSVECTOR      GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
        embedding       ${vectorType}(${dim}),
        embedding_model TEXT          NOT NULL DEFAULT '${embeddingModel}',
        data            JSONB         DEFAULT '{}'::jsonb,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT search_pk PRIMARY KEY (content_id)
      )
    `.trim(),
    `
      CREATE TABLE IF NOT EXISTS "${schemaName}".events (
        id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        ns                TEXT,
        doc_id            TEXT,
        type              TEXT          NOT NULL,
        layer             TEXT,
        model             TEXT,
        prompt            JSONB,
        output            JSONB,
        prompt_tokens     INTEGER,
        completion_tokens INTEGER,
        thinking_tokens   INTEGER,
        cost_usd          NUMERIC(12, 6),
        latency_ms        INTEGER,
        run_id            TEXT,
        parent_event_id   UUID,
        status            TEXT          NOT NULL,
        rejection_reason  TEXT,
        error             TEXT,
        payload           JSONB,
        created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
      )
    `.trim(),
    `CREATE INDEX IF NOT EXISTS docs_ns_type      ON "${schemaName}".docs (ns, type)`,
    `CREATE INDEX IF NOT EXISTS docs_type         ON "${schemaName}".docs (type)`,
    `CREATE INDEX IF NOT EXISTS docs_layer        ON "${schemaName}".docs (layer)`,
    `CREATE INDEX IF NOT EXISTS docs_status       ON "${schemaName}".docs (status)`,
    `CREATE INDEX IF NOT EXISTS docs_review_state ON "${schemaName}".docs (review_state)`,
    `CREATE INDEX IF NOT EXISTS docs_updated      ON "${schemaName}".docs (updated_at)`,
    `CREATE INDEX IF NOT EXISTS docs_data_gin     ON "${schemaName}".docs USING gin (data)`,
    `CREATE INDEX IF NOT EXISTS rels_ns_src        ON "${schemaName}".rels (ns, src, rel)`,
    `CREATE INDEX IF NOT EXISTS rels_ns_dst        ON "${schemaName}".rels (ns, dst, rel)`,
    `CREATE INDEX IF NOT EXISTS rels_rel           ON "${schemaName}".rels (rel)`,
    `CREATE INDEX IF NOT EXISTS rels_evidence_kind ON "${schemaName}".rels (evidence_kind)`,
    `CREATE INDEX IF NOT EXISTS rels_data_gin      ON "${schemaName}".rels USING gin (data)`,
    `CREATE INDEX IF NOT EXISTS search_ns_type        ON "${schemaName}".search (ns, type)`,
    `CREATE INDEX IF NOT EXISTS search_ns_doc         ON "${schemaName}".search (ns, doc_id)`,
    `CREATE INDEX IF NOT EXISTS search_content_hash   ON "${schemaName}".search (content_hash)`,
    `CREATE INDEX IF NOT EXISTS search_recipe         ON "${schemaName}".search (recipe_version)`,
    `CREATE INDEX IF NOT EXISTS search_model_dim      ON "${schemaName}".search (embedding_model, dim)`,
    `CREATE INDEX IF NOT EXISTS search_tsv_gin        ON "${schemaName}".search USING gin (tsv)`,
    `CREATE INDEX IF NOT EXISTS search_embedding_hnsw ON "${schemaName}".search USING hnsw (embedding ${cosineOps})`,
    `CREATE INDEX IF NOT EXISTS events_type_layer ON "${schemaName}".events (type, layer, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS events_doc        ON "${schemaName}".events (ns, doc_id) WHERE doc_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS events_run        ON "${schemaName}".events (run_id) WHERE run_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS events_failures   ON "${schemaName}".events (status, created_at DESC) WHERE status <> 'success'`,
    `CREATE INDEX IF NOT EXISTS events_parent     ON "${schemaName}".events (parent_event_id) WHERE parent_event_id IS NOT NULL`,
  ]
}
