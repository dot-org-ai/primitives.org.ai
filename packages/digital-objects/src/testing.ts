/**
 * digital-objects/testing — test/dev surface.
 *
 * The in-memory reference implementation of the `DigitalObjectsProvider` port
 * (`MemoryProvider` / `createMemoryProvider`) and the adapter that wraps any
 * `DigitalObjectsProvider` as an ai-database `DBProvider`
 * (`createDBProviderAdapter`) live here rather than on the main entry point.
 *
 * Production storage is NOT here — it lives in `ai-database` (pg+ch + DO-SQLite,
 * ADR-0003). These exports exist for tests, examples, and dev. See ADR-0012.
 *
 * @packageDocumentation
 */

// In-memory reference provider (implements the DigitalObjectsProvider port)
export { MemoryProvider, createMemoryProvider } from './memory-provider.js'

// Adapter: DigitalObjectsProvider -> ai-database DBProvider shape
export { createDBProviderAdapter } from './ai-database-adapter.js'
export type {
  DBProvider,
  ListOptions as DBListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
} from './ai-database-adapter.js'
