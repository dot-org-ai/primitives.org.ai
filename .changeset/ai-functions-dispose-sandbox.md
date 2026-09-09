---
'ai-functions': minor
---

ai-functions: `disposeSandbox()` releases the Miniflare host behind the Node sandbox fallback

The Node fallback in `runInSandbox` uses the process-wide host from
`ai-evaluate/node`, which is unref'd while idle so a process exits on its own
without any teardown. `disposeSandbox()` shuts it down early (test teardown)
and is a no-op if the Node entry was never used.
