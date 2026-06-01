/**
 * R2 Persistence Layer
 *
 * Provides backup, restore, and export functionality for digital-objects
 * using Cloudflare R2 object storage.
 */

/// <reference types="@cloudflare/workers-types" />

// Note: digital-objects exports the entity TYPE as `NounType` (the bare `Noun`
// export is the deprecated factory function). Alias back to `Noun` locally.
import type { DigitalObjectsProvider, NounType as Noun, Verb, Thing, Action } from 'digital-objects'

/**
 * Snapshot data structure
 */
export interface Snapshot {
  version: number
  timestamp: number
  namespace: string
  nouns: Noun[]
  verbs: Verb[]
  things: Thing<unknown>[]
  actions: Action<unknown>[]
}

/**
 * WAL entry types
 */
export type WALEntry =
  | { type: 'defineNoun'; data: Noun; timestamp: number }
  | { type: 'defineVerb'; data: Verb; timestamp: number }
  | { type: 'create'; noun: string; id: string; data: unknown; timestamp: number }
  | { type: 'update'; id: string; data: unknown; timestamp: number }
  | { type: 'delete'; id: string; timestamp: number }
  | {
      type: 'perform'
      verb: string
      subject?: string
      object?: string
      data?: unknown
      timestamp: number
    }

export interface SnapshotOptions {
  /** Include timestamp in filename */
  timestamp?: boolean
}

export interface SnapshotResult {
  key: string
  size: number
  timestamp: number
}

/**
 * Create a complete snapshot of all data
 */
export async function createSnapshot(
  provider: DigitalObjectsProvider,
  r2: R2Bucket,
  namespace: string,
  options?: SnapshotOptions
): Promise<SnapshotResult> {
  const timestamp = Date.now()

  // Collect all data
  const [nouns, verbs] = await Promise.all([provider.listNouns(), provider.listVerbs()])

  // Collect things for each noun type
  const things: Thing<unknown>[] = []
  for (const noun of nouns) {
    const nounThings = await provider.list(noun.name)
    things.push(...nounThings)
  }

  // Collect all actions
  const actions = await provider.listActions()

  const snapshot: Snapshot = {
    version: 1,
    timestamp,
    namespace,
    nouns,
    verbs,
    things,
    actions,
  }

  const content = JSON.stringify(snapshot, null, 2)
  const key = options?.timestamp
    ? `snapshots/${namespace}/${timestamp}.json`
    : `snapshots/${namespace}/latest.json`

  await r2.put(key, content)

  return {
    key,
    size: content.length,
    timestamp,
  }
}

/**
 * Restore provider state from a snapshot
 */
export async function restoreSnapshot(
  provider: DigitalObjectsProvider,
  r2: R2Bucket,
  namespace: string,
  snapshotKey?: string
): Promise<void> {
  const key = snapshotKey ?? `snapshots/${namespace}/latest.json`
  const obj = await r2.get(key)

  if (!obj) {
    throw new Error(`Snapshot not found: ${key}`)
  }

  const snapshot = await obj.json<Snapshot>()

  // Restore nouns
  for (const noun of snapshot.nouns) {
    await provider.defineNoun({
      name: noun.name,
      singular: noun.singular,
      plural: noun.plural,
      description: noun.description,
      schema: noun.schema,
    })
  }

  // Restore verbs
  for (const verb of snapshot.verbs) {
    await provider.defineVerb({
      name: verb.name,
      action: verb.action,
      act: verb.act,
      activity: verb.activity,
      event: verb.event,
      reverseBy: verb.reverseBy,
      inverse: verb.inverse,
      description: verb.description,
    })
  }

  // Restore things
  for (const thing of snapshot.things) {
    await provider.create(thing.noun, thing.data, thing.id)
  }

  // Restore actions
  for (const action of snapshot.actions) {
    await provider.perform(action.verb, action.subject, action.object, action.data)
  }
}

/**
 * Append an operation to the WAL
 */
export async function appendWAL(r2: R2Bucket, namespace: string, entry: WALEntry): Promise<void> {
  const key = `wal/${namespace}/${entry.timestamp}.json`
  await r2.put(key, JSON.stringify(entry))
}

/**
 * Replay WAL entries on top of current state
 */
export async function replayWAL(
  provider: DigitalObjectsProvider,
  r2: R2Bucket,
  namespace: string,
  afterTimestamp?: number
): Promise<number> {
  const list = await r2.list({ prefix: `wal/${namespace}/` })

  // Sort by timestamp (filename)
  const entries = list.objects
    .map((obj) => ({
      key: obj.key,
      timestamp: parseInt(obj.key.split('/').pop()?.replace('.json', '') ?? '0'),
    }))
    .filter((e) => !afterTimestamp || e.timestamp > afterTimestamp)
    .sort((a, b) => a.timestamp - b.timestamp)

  let replayed = 0

  for (const { key } of entries) {
    const obj = await r2.get(key)
    if (!obj) continue

    const entry = await obj.json<WALEntry>()

    switch (entry.type) {
      case 'defineNoun':
        await provider.defineNoun(entry.data)
        break
      case 'defineVerb':
        await provider.defineVerb(entry.data)
        break
      case 'create':
        await provider.create(entry.noun, entry.data, entry.id)
        break
      case 'update':
        await provider.update(entry.id, entry.data as Record<string, unknown>)
        break
      case 'delete':
        await provider.delete(entry.id)
        break
      case 'perform':
        await provider.perform(entry.verb, entry.subject, entry.object, entry.data)
        break
    }

    replayed++
  }

  return replayed
}

/**
 * Compact WAL by deleting entries older than the latest snapshot
 */
export async function compactWAL(
  r2: R2Bucket,
  namespace: string,
  beforeTimestamp?: number
): Promise<number> {
  const list = await r2.list({ prefix: `wal/${namespace}/` })

  const toDelete = list.objects
    .filter((obj) => {
      if (!beforeTimestamp) return true
      const ts = parseInt(obj.key.split('/').pop()?.replace('.json', '') ?? '0')
      return ts < beforeTimestamp
    })
    .map((obj) => obj.key)

  if (toDelete.length > 0) {
    await r2.delete(toDelete)
  }

  return toDelete.length
}

/**
 * Export all data as JSONL (JSON Lines) format
 */
export async function exportJSONL(provider: DigitalObjectsProvider): Promise<string> {
  const lines: string[] = []

  // Export nouns
  const nouns = await provider.listNouns()
  for (const noun of nouns) {
    lines.push(JSON.stringify({ type: 'noun', data: noun }))
  }

  // Export verbs
  const verbs = await provider.listVerbs()
  for (const verb of verbs) {
    lines.push(JSON.stringify({ type: 'verb', data: verb }))
  }

  // Export things
  for (const noun of nouns) {
    const things = await provider.list(noun.name)
    for (const thing of things) {
      lines.push(JSON.stringify({ type: 'thing', data: thing }))
    }
  }

  // Export actions
  const actions = await provider.listActions()
  for (const action of actions) {
    lines.push(JSON.stringify({ type: 'action', data: action }))
  }

  return lines.join('\n')
}

/**
 * Import data from JSONL format
 */
export async function importJSONL(
  provider: DigitalObjectsProvider,
  jsonl: string
): Promise<{ nouns: number; verbs: number; things: number; actions: number }> {
  const stats = { nouns: 0, verbs: 0, things: 0, actions: 0 }

  const lines = jsonl.trim().split('\n').filter(Boolean)

  for (const line of lines) {
    const entry = JSON.parse(line) as { type: string; data: unknown }

    switch (entry.type) {
      case 'noun': {
        const noun = entry.data as Noun
        await provider.defineNoun({
          name: noun.name,
          singular: noun.singular,
          plural: noun.plural,
          description: noun.description,
          schema: noun.schema,
        })
        stats.nouns++
        break
      }
      case 'verb': {
        const verb = entry.data as Verb
        await provider.defineVerb({
          name: verb.name,
          action: verb.action,
          act: verb.act,
          activity: verb.activity,
          event: verb.event,
          reverseBy: verb.reverseBy,
          inverse: verb.inverse,
          description: verb.description,
        })
        stats.verbs++
        break
      }
      case 'thing': {
        const thing = entry.data as Thing
        await provider.create(thing.noun, thing.data, thing.id)
        stats.things++
        break
      }
      case 'action': {
        const action = entry.data as Action
        await provider.perform(action.verb, action.subject, action.object, action.data)
        stats.actions++
        break
      }
    }
  }

  return stats
}

/**
 * Export to R2 as JSONL
 */
export async function exportToR2(
  provider: DigitalObjectsProvider,
  r2: R2Bucket,
  key: string
): Promise<{ key: string; size: number }> {
  const jsonl = await exportJSONL(provider)
  await r2.put(key, jsonl)
  return { key, size: jsonl.length }
}

/**
 * Import from R2 JSONL file
 */
export async function importFromR2(
  provider: DigitalObjectsProvider,
  r2: R2Bucket,
  key: string
): Promise<{ nouns: number; verbs: number; things: number; actions: number }> {
  const obj = await r2.get(key)
  if (!obj) {
    throw new Error(`File not found: ${key}`)
  }

  const jsonl = await obj.text()
  return importJSONL(provider, jsonl)
}
