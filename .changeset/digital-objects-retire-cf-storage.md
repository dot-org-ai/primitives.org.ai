---
'digital-objects': major
'ai-database': patch
---

digital-objects: retire the legacy Cloudflare Durable Object / SQLite storage from the package — the `NS` Durable Object, the `NS` HTTP client, the CF worker entry, and the `./ns` + `./worker` subpath exports. The DO-SQLite storage capability is **preserved** in `ai-database`'s `do-sqlite-adapter` (a first-class transactional backend per ADR-0003). The provider-agnostic R2 snapshot/WAL backup utility **moves** to `ai-database` (`r2-persistence.ts`), where the storage it serves now lives.

Additionally retires the legacy instance-proxy factories in favour of `Ontology()`:

- **`DO()` and `Noun()` are removed** (along with the `noun-proxy`/`noun-registry`/`noun-parse`/`noun-verbs`/`noun-types` runtime and the `DigitalObjectDefinition` class). Define vocabularies with `Ontology()` instead. The `RpcPromise` type moved to `rpc-promise` (its natural home).
- **The in-memory reference provider and the ai-database adapter move to a `digital-objects/testing` subpath** — `createMemoryProvider` / `MemoryProvider` / `createDBProviderAdapter` are now imported from `digital-objects/testing`, not the main entry point. They are a test/dev surface; production storage lives in `ai-database` (ADR-0003).

This is the storage-strip + factory/runtime-retirement step of the digital-objects → SVO-runtime-layer redesign (ADR-0012, aip-cnks.8 / aip-idyi): digital-objects keeps the `DigitalObjectsProvider` *port*, the SVO ontology, the `Ontology()` factory, linguistics, validation, token-strata, errors, and rpc-promise; `ai-database` owns the storage *implementations*.
