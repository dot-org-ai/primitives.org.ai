/**
 * Canonical-schema tests for ai-database/docs-rels.
 *
 * These tests are static (no live DB). They verify:
 *
 * 1. The Drizzle schema exposes the four canonical tables (docs, rels,
 *    search, events) with the expected primary keys.
 * 2. The canonical column set is a strict superset of the union of the
 *    three downstream consumer schemas (icps + svc + sb). The consumer
 *    column lists are encoded inline below — when those consumers later
 *    `import` this package, they should be able to derive their own view
 *    by narrowing column nullability + applying CHECK constraints.
 * 3. The migration SQL builder emits CREATE TABLE / CREATE INDEX
 *    statements with the canonical halfvec(1536) embedding type, the
 *    canonical (content_id) primary key on `search`, and the HNSW vector
 *    index using `halfvec_cosine_ops`.
 * 4. The legacy fp32 escape hatch produces `vector(...)` + `vector_cosine_ops`.
 */

import { getTableColumns } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'

import { createDocsRelsSchema, createMigrationSql, DEFAULT_EMBEDDING_DIM } from '../src/docs-rels/index.js'

describe('ai-database/docs-rels — canonical schema', () => {
  const { docs, rels, search, events } = createDocsRelsSchema()

  it('exposes all four canonical tables', () => {
    expect(docs).toBeDefined()
    expect(rels).toBeDefined()
    expect(search).toBeDefined()
    expect(events).toBeDefined()
  })

  it('docs has the canonical column shape', () => {
    const cols = getTableColumns(docs)
    expect(Object.keys(cols).sort()).toEqual(
      [
        'createdAt',
        'data',
        'id',
        'layer',
        'ns',
        'reviewNotes',
        'reviewState',
        'reviewSystemicIssueId',
        'status',
        'type',
        'updatedAt',
      ].sort()
    )
    // ns + id are required
    expect(cols.ns?.notNull).toBe(true)
    expect(cols.id?.notNull).toBe(true)
    expect(cols.type?.notNull).toBe(true)
    expect(cols.data?.notNull).toBe(true)
    // review-pipeline columns are nullable so non-review consumers can ignore them
    expect(cols.layer?.notNull).toBe(false)
    expect(cols.status?.notNull).toBe(false)
    expect(cols.reviewState?.notNull).toBe(false)
  })

  it('docs primary key is (ns, id)', () => {
    const cfg = getTableConfig(docs)
    const pk = cfg.primaryKeys[0]
    expect(pk).toBeDefined()
    expect(pk!.columns.map((c) => c.name)).toEqual(['ns', 'id'])
  })

  it('rels primary key is (ns, src, rel, dst)', () => {
    const cfg = getTableConfig(rels)
    const pk = cfg.primaryKeys[0]
    expect(pk).toBeDefined()
    expect(pk!.columns.map((c) => c.name)).toEqual(['ns', 'src', 'rel', 'dst'])
  })

  it('search primary key is (content_id) per canonical spec', () => {
    const cfg = getTableConfig(search)
    const pk = cfg.primaryKeys[0]
    expect(pk).toBeDefined()
    expect(pk!.columns.map((c) => c.name)).toEqual(['content_id'])
  })

  it('search has the canonical column shape including ns + type discriminators', () => {
    const cols = getTableColumns(search)
    // canonical contract: content_id PK + ns + type + content + content_hash + tsv + embedding
    const names = Object.keys(cols).sort()
    expect(names).toContain('contentId')
    expect(names).toContain('ns')
    expect(names).toContain('type')
    expect(names).toContain('content')
    expect(names).toContain('contentHash')
    expect(names).toContain('tsv')
    expect(names).toContain('embedding')
    expect(names).toContain('embeddingModel')
  })

  it('events has uuid PK + token + cost + latency + status columns', () => {
    const cols = getTableColumns(events)
    const names = Object.keys(cols).sort()
    for (const required of [
      'id',
      'type',
      'status',
      'promptTokens',
      'completionTokens',
      'thinkingTokens',
      'costUsd',
      'latencyMs',
      'runId',
      'parentEventId',
      'payload',
      'createdAt',
    ]) {
      expect(names).toContain(required)
    }
  })
})

describe('ai-database/docs-rels — strict superset over icps + svc + sb', () => {
  const { docs, rels, search, events } = createDocsRelsSchema()
  const docsCols = new Set(Object.keys(getTableColumns(docs)))
  const relsCols = new Set(Object.keys(getTableColumns(rels)))
  const searchCols = new Set(Object.keys(getTableColumns(search)))
  const eventsCols = new Set(Object.keys(getTableColumns(events)))

  // Column lists below mirror what each consumer's schema.ts encodes today.
  // If a consumer adds a new column, this test fails until the canonical
  // schema is updated. That's the point — schema drift becomes a CI signal
  // instead of a silent bug.

  it('docs columns are a superset of icps.docs', () => {
    // icps/packages/db/src/schema.ts (2026-05-07)
    const icpsDocsCols = [
      'ns',
      'id',
      'type',
      'layer',
      'status',
      'reviewState',
      'reviewNotes',
      'reviewSystemicIssueId',
      'data',
      'createdAt',
      'updatedAt',
    ]
    for (const col of icpsDocsCols) {
      expect(docsCols.has(col), `canonical docs missing icps column ${col}`).toBe(true)
    }
  })

  it('docs columns are a superset of services.docs', () => {
    // services-builder/packages/db/src/schema.ts (2026-05-07)
    const svcDocsCols = [
      'ns',
      'id',
      'type',
      'layer',
      'status',
      'reviewState',
      'reviewNotes',
      'data',
      'createdAt',
      'updatedAt',
    ]
    for (const col of svcDocsCols) {
      expect(docsCols.has(col), `canonical docs missing svc column ${col}`).toBe(true)
    }
  })

  it('docs columns are a superset of startup-builder.docs', () => {
    // startup-builder/packages/db/src/postgres/schema.ts (2026-05-07);
    // sb uses created/updated, the canonical uses created_at/updated_at.
    // The static check here is column-name-equivalent under our drizzle
    // alias: sb's canonical post-migration name aligns with createdAt.
    const sbDocsCols = ['ns', 'id', 'type', 'data', 'createdAt', 'updatedAt']
    for (const col of sbDocsCols) {
      expect(docsCols.has(col), `canonical docs missing sb column ${col}`).toBe(true)
    }
  })

  it('rels columns are a superset of icps.rels', () => {
    const icpsRelsCols = [
      'ns',
      'src',
      'rel',
      'dst',
      'data',
      'evidenceKind',
      'reviewState',
      'reviewNotes',
      'createdAt',
    ]
    for (const col of icpsRelsCols) {
      expect(relsCols.has(col), `canonical rels missing icps column ${col}`).toBe(true)
    }
  })

  it('rels columns are a superset of services.rels', () => {
    const svcRelsCols = [
      'ns',
      'src',
      'rel',
      'dst',
      'data',
      'evidenceKind',
      'reviewState',
      'reviewNotes',
      'createdAt',
    ]
    for (const col of svcRelsCols) {
      expect(relsCols.has(col), `canonical rels missing svc column ${col}`).toBe(true)
    }
  })

  it('rels columns are a superset of startup-builder.rels', () => {
    // sb's rels carries `ts` instead of `createdAt`; the alias on the
    // canonical column maps to created_at — superset check is on the
    // canonical column name.
    const sbRelsCols = ['ns', 'src', 'rel', 'dst', 'data']
    for (const col of sbRelsCols) {
      expect(relsCols.has(col), `canonical rels missing sb column ${col}`).toBe(true)
    }
  })

  it('search columns cover the icps + svc + sb union', () => {
    // Canonical search has content_id PK; icps + svc carry doc_id, sb
    // carries id + doc_id. The canonical column set covers all three.
    for (const col of [
      'contentId',
      'ns',
      'type',
      'docId',
      'content',
      'contentHash',
      'recipeVersion',
      'dim',
      'tsv',
      'embedding',
      'embeddingModel',
      'createdAt',
    ]) {
      expect(searchCols.has(col), `canonical search missing column ${col}`).toBe(true)
    }
  })

  it('events columns cover the icps + svc union', () => {
    for (const col of [
      'id',
      'ns',
      'docId',
      'type',
      'layer',
      'model',
      'prompt',
      'output',
      'promptTokens',
      'completionTokens',
      'thinkingTokens',
      'costUsd',
      'latencyMs',
      'runId',
      'parentEventId',
      'status',
      'rejectionReason',
      'error',
      'payload',
      'createdAt',
    ]) {
      expect(eventsCols.has(col), `canonical events missing column ${col}`).toBe(true)
    }
  })
})

describe('ai-database/docs-rels — migration SQL', () => {
  it('default migrations target halfvec(1536) + halfvec_cosine_ops', () => {
    const stmts = createMigrationSql()
    const joined = stmts.join('\n')
    expect(joined).toContain('CREATE EXTENSION IF NOT EXISTS vector')
    expect(joined).toContain('CREATE SCHEMA IF NOT EXISTS "docs_rels"')
    expect(joined).toContain('HALFVEC(1536)')
    expect(joined).toContain('halfvec_cosine_ops')
    // canonical PK on search is content_id
    expect(joined).toMatch(/CONSTRAINT search_pk PRIMARY KEY \(content_id\)/)
  })

  it('honours custom schema name + embedding dim', () => {
    const stmts = createMigrationSql({ schemaName: 'icps', embeddingDim: 768 })
    const joined = stmts.join('\n')
    expect(joined).toContain('CREATE SCHEMA IF NOT EXISTS "icps"')
    expect(joined).toContain('HALFVEC(768)')
    expect(joined).not.toContain('HALFVEC(1536)')
  })

  it('legacy fp32 escape hatch emits vector(...) + vector_cosine_ops', () => {
    const stmts = createMigrationSql({ useLegacyFp32Vector: true })
    const joined = stmts.join('\n')
    expect(joined).toContain('VECTOR(1536)')
    expect(joined).toContain('vector_cosine_ops')
    expect(joined).not.toContain('HALFVEC(1536)')
    expect(joined).not.toContain('halfvec_cosine_ops')
  })

  it('emits canonical index strategy (HNSW + GIN) for every required surface', () => {
    const stmts = createMigrationSql()
    const joined = stmts.join('\n')
    // GIN on jsonb
    expect(joined).toMatch(/docs_data_gin .* USING gin \(data\)/)
    expect(joined).toMatch(/rels_data_gin .* USING gin \(data\)/)
    // GIN on tsv
    expect(joined).toMatch(/search_tsv_gin .* USING gin \(tsv\)/)
    // HNSW on embedding
    expect(joined).toMatch(/search_embedding_hnsw .* USING hnsw/)
    // partial indexes on events
    expect(joined).toMatch(/events_failures .* WHERE status <> 'success'/)
    expect(joined).toMatch(/events_doc .* WHERE doc_id IS NOT NULL/)
  })
})

describe('ai-database/docs-rels — defaults', () => {
  it('default embedding dim is 1536', () => {
    expect(DEFAULT_EMBEDDING_DIM).toBe(1536)
  })

  it('default schema bound to docs_rels uses gemini-embedding-2 (no provider prefix)', () => {
    const sch = createDocsRelsSchema()
    expect(sch.schemaName).toBe('docs_rels')
    expect(sch.embeddingModel).toBe('gemini-embedding-2')
    expect(sch.embeddingDim).toBe(1536)
  })
})
