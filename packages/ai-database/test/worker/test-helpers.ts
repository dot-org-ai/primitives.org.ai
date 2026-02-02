/**
 * Shared test helpers for Worker/DO tests
 *
 * Provides common utilities for testing Durable Object functionality
 * in @cloudflare/vitest-pool-workers tests.
 *
 * @packageDocumentation
 */

import { expect } from 'vitest'
import { env } from 'cloudflare:test'

/**
 * Get a DurableObject stub for DatabaseDO.
 * Each call with a unique name creates a fresh, isolated DO instance.
 */
export function getStub(name?: string): DurableObjectStub {
  const id = env.DATABASE.idFromName(name ?? crypto.randomUUID())
  return env.DATABASE.get(id)
}

/**
 * Send a fetch request to a DO stub and return the Response.
 */
export async function doRequest(
  stub: DurableObjectStub,
  path: string,
  options?: RequestInit
): Promise<Response> {
  return stub.fetch(`https://do.test${path}`, options)
}

/**
 * Send a JSON body request to a DO stub.
 */
export async function doJSON(
  stub: DurableObjectStub,
  path: string,
  body: unknown,
  method = 'POST'
): Promise<Response> {
  return stub.fetch(`https://do.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/**
 * Shorthand to POST to /data and parse the JSON result.
 */
export async function insertData(
  stub: DurableObjectStub,
  record: { id?: string; type: string; data: Record<string, unknown> }
): Promise<Record<string, unknown>> {
  const res = await doJSON(stub, '/data', record)
  expect(res.status).toBe(200)
  return res.json() as Promise<Record<string, unknown>>
}

/**
 * Shorthand to POST to /rels and parse the JSON result.
 */
export async function insertRel(
  stub: DurableObjectStub,
  rel: { from_id: string; relation: string; to_id: string; metadata?: Record<string, unknown> }
): Promise<Record<string, unknown>> {
  const res = await doJSON(stub, '/rels', rel)
  expect(res.status).toBe(200)
  return res.json() as Promise<Record<string, unknown>>
}

/**
 * Shorthand to POST to /schema and parse the JSON result.
 */
export async function setSchema(
  stub: DurableObjectStub,
  schema: Record<string, Record<string, string>>
): Promise<Record<string, unknown>> {
  const res = await doJSON(stub, '/schema', schema)
  expect(res.status).toBe(200)
  return res.json() as Promise<Record<string, unknown>>
}

/**
 * Shorthand to POST to /schema/migrate with explicit migration.
 */
export async function runMigration(
  stub: DurableObjectStub,
  migration: { version: number; up: string; down?: string }
): Promise<Record<string, unknown>> {
  const res = await doJSON(stub, '/schema/migrate', migration)
  expect(res.status).toBe(200)
  return res.json() as Promise<Record<string, unknown>>
}
