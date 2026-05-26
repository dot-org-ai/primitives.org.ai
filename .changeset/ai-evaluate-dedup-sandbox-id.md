---
'ai-evaluate': patch
---

ai-evaluate: content-addressed Dynamic Workers sandbox id (dedup cache key)

`generateSandboxId` is now a deterministic content hash (cyrb53) over the
generated worker code instead of a random per-call id. Identical worker code
reuses the cached isolate via `LOADER.get(id, factory)`, so the sandbox dedupes
to one "unique worker" per distinct code rather than one per invocation —
relevant once Cloudflare's Dynamic Workers per-worker billing leaves beta. No
public API change; the three internal call sites (`evaluate.ts` simple + worker
paths, `node.ts` worker path) were updated to pass the worker code. Also
refreshes "Worker Loaders → Dynamic Workers" naming in the entry-file headers;
the `worker_loaders` wrangler key is unchanged.
