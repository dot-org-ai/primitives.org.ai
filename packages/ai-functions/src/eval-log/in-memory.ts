/**
 * InMemoryEvalLogStore — Map-backed default implementation of
 * {@link EvalLogStore}.
 *
 * Matches Evalite v1's default backend: process-local Map keyed on `$id`,
 * insertion-ordered for "most recent first" listing without sorting. Suitable
 * for single-process tests, evals, and the cascade walker's in-flight log;
 * not suitable for cross-process or multi-worker setups (use a disk/SQLite
 * backend for those — same contract).
 *
 * @packageDocumentation
 */

import { randomUUID } from 'crypto'
import type { EvalLogEntry, EvalLogListOptions, EvalLogStore } from './types.js'

/**
 * In-memory implementation of {@link EvalLogStore}.
 */
export class InMemoryEvalLogStore implements EvalLogStore {
  /**
   * Map keyed on `$id`. Insertion order on a JS Map is preserved, so we
   * walk it in reverse for "most recent first" listing.
   */
  private readonly entries: Map<string, EvalLogEntry> = new Map()

  async record(
    entry: Omit<EvalLogEntry, '$id' | 'createdAt'> &
      Partial<Pick<EvalLogEntry, '$id' | 'createdAt'>>
  ): Promise<EvalLogEntry> {
    const $id = entry.$id ?? randomUUID()
    const createdAt = entry.createdAt ?? Date.now()
    const stored: EvalLogEntry = {
      $id,
      createdAt,
      model: entry.model,
      prompt: entry.prompt,
      response: entry.response,
      usage: entry.usage,
      costUsd: entry.costUsd,
      durationMs: entry.durationMs,
      ...(entry.traceId !== undefined ? { traceId: entry.traceId } : {}),
      ...(entry.tags !== undefined ? { tags: entry.tags } : {}),
    }
    this.entries.set($id, stored)
    return stored
  }

  async get(id: string): Promise<EvalLogEntry | undefined> {
    return this.entries.get(id)
  }

  async list(options: EvalLogListOptions = {}): Promise<EvalLogEntry[]> {
    const { traceId, model, tags, limit } = options
    const out: EvalLogEntry[] = []
    // Iterate in reverse insertion order — Map preserves order; we walk
    // values into an array, then reverse for most-recent-first.
    const all = Array.from(this.entries.values()).reverse()
    for (const entry of all) {
      if (traceId !== undefined && entry.traceId !== traceId) continue
      if (model !== undefined && entry.model !== model) continue
      if (tags !== undefined) {
        let matchesAll = true
        for (const k of Object.keys(tags)) {
          if (entry.tags?.[k] !== tags[k]) {
            matchesAll = false
            break
          }
        }
        if (!matchesAll) continue
      }
      out.push(entry)
      if (limit !== undefined && out.length >= limit) break
    }
    return out
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id)
  }

  /**
   * Convenience for tests: drop every entry. Not on the public
   * {@link EvalLogStore} interface because the disk/SQLite backends may not
   * want to expose a one-shot wipe.
   */
  clear(): void {
    this.entries.clear()
  }
}
