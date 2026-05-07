-- @primitives/db-docs-rels — initial migration (v0.1.0)
--
-- Renders the canonical four-table spine into the schema named `:schema_name:`.
-- Embedding column is `halfvec(:dim:)` (FP16) — requires pgvector >= 0.7.
--
-- This file is parameterized: substitute `:schema_name:` and `:dim:` at
-- migration time. The `createMigrationSql(opts)` helper in
-- `src/migrations/index.ts` does this substitution programmatically.

CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS ":schema_name:";

-- ---------------------------------------------------------------------------
-- docs(ns, id, type, data jsonb) — content-addressed
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ":schema_name:".docs (
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
);

CREATE INDEX IF NOT EXISTS docs_ns_type      ON ":schema_name:".docs (ns, type);
CREATE INDEX IF NOT EXISTS docs_type         ON ":schema_name:".docs (type);
CREATE INDEX IF NOT EXISTS docs_layer        ON ":schema_name:".docs (layer);
CREATE INDEX IF NOT EXISTS docs_status       ON ":schema_name:".docs (status);
CREATE INDEX IF NOT EXISTS docs_review_state ON ":schema_name:".docs (review_state);
CREATE INDEX IF NOT EXISTS docs_updated      ON ":schema_name:".docs (updated_at);
CREATE INDEX IF NOT EXISTS docs_data_gin     ON ":schema_name:".docs USING gin (data);

-- ---------------------------------------------------------------------------
-- rels(ns, src, rel, dst, data jsonb) — typed edges
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ":schema_name:".rels (
  ns               TEXT          NOT NULL,
  src              TEXT          NOT NULL,
  rel              TEXT          NOT NULL,
  dst              TEXT          NOT NULL,
  data             JSONB         DEFAULT '{}'::jsonb,
  evidence_kind    TEXT,
  review_state     TEXT,
  review_notes     JSONB,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT rels_pk PRIMARY KEY (ns, src, rel, dst)
);

CREATE INDEX IF NOT EXISTS rels_ns_src         ON ":schema_name:".rels (ns, src, rel);
CREATE INDEX IF NOT EXISTS rels_ns_dst         ON ":schema_name:".rels (ns, dst, rel);
CREATE INDEX IF NOT EXISTS rels_rel            ON ":schema_name:".rels (rel);
CREATE INDEX IF NOT EXISTS rels_evidence_kind  ON ":schema_name:".rels (evidence_kind);
CREATE INDEX IF NOT EXISTS rels_data_gin       ON ":schema_name:".rels USING gin (data);

-- ---------------------------------------------------------------------------
-- search(content_id pk, ns, type, vector halfvec(:dim:), tsv tsvector)
-- — embedding + FTS spine
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ":schema_name:".search (
  content_id        TEXT                  NOT NULL,
  ns                TEXT                  NOT NULL,
  type              TEXT                  NOT NULL,
  doc_id            TEXT,
  content           TEXT                  NOT NULL,
  content_hash      TEXT                  NOT NULL,
  recipe_version    TEXT                  NOT NULL DEFAULT 'v1',
  dim               INTEGER               NOT NULL DEFAULT :dim:,
  tsv               TSVECTOR              GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  embedding         HALFVEC(:dim:),
  embedding_model   TEXT                  NOT NULL DEFAULT 'gemini-embedding-2',
  data              JSONB                 DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ           NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ           NOT NULL DEFAULT now(),
  CONSTRAINT search_pk PRIMARY KEY (content_id)
);

CREATE INDEX IF NOT EXISTS search_ns_type        ON ":schema_name:".search (ns, type);
CREATE INDEX IF NOT EXISTS search_ns_doc         ON ":schema_name:".search (ns, doc_id);
CREATE INDEX IF NOT EXISTS search_content_hash   ON ":schema_name:".search (content_hash);
CREATE INDEX IF NOT EXISTS search_recipe         ON ":schema_name:".search (recipe_version);
CREATE INDEX IF NOT EXISTS search_model_dim      ON ":schema_name:".search (embedding_model, dim);
CREATE INDEX IF NOT EXISTS search_tsv_gin        ON ":schema_name:".search USING gin (tsv);
CREATE INDEX IF NOT EXISTS search_embedding_hnsw ON ":schema_name:".search USING hnsw (embedding halfvec_cosine_ops);

-- ---------------------------------------------------------------------------
-- events(id uuid pk, ns, type, payload jsonb) — append-only event stream
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ":schema_name:".events (
  id                  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  ns                  TEXT,
  doc_id              TEXT,
  type                TEXT              NOT NULL,
  layer               TEXT,
  model               TEXT,
  prompt              JSONB,
  output              JSONB,
  prompt_tokens       INTEGER,
  completion_tokens   INTEGER,
  thinking_tokens     INTEGER,
  cost_usd            NUMERIC(12, 6),
  latency_ms          INTEGER,
  run_id              TEXT,
  parent_event_id     UUID,
  status              TEXT              NOT NULL,
  rejection_reason    TEXT,
  error               TEXT,
  payload             JSONB,
  created_at          TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_type_layer ON ":schema_name:".events (type, layer, created_at DESC);
CREATE INDEX IF NOT EXISTS events_doc        ON ":schema_name:".events (ns, doc_id) WHERE doc_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_run        ON ":schema_name:".events (run_id) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS events_failures   ON ":schema_name:".events (status, created_at DESC) WHERE status <> 'success';
CREATE INDEX IF NOT EXISTS events_parent     ON ":schema_name:".events (parent_event_id) WHERE parent_event_id IS NOT NULL;
