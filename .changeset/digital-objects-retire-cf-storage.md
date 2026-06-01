---
'digital-objects': major
'ai-database': patch
---

digital-objects: retire the legacy Cloudflare Durable Object / SQLite storage from the package — the `NS` Durable Object, the `NS` HTTP client, the CF worker entry, and the `./ns` + `./worker` subpath exports. The DO-SQLite storage capability is **preserved** in `ai-database`'s `do-sqlite-adapter` (a first-class transactional backend per ADR-0003). The provider-agnostic R2 snapshot/WAL backup utility **moves** to `ai-database` (`r2-persistence.ts`), where the storage it serves now lives.

This is the storage-strip step of the digital-objects → SVO-runtime-layer redesign (ADR-0012, aip-cnks.8 / aip-idyi): digital-objects keeps the `DigitalObjectsProvider` *port* and the SVO ontology; `ai-database` owns the storage *implementations*.
