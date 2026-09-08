---
'ai-evaluate': patch
---

ai-evaluate: reconcile the Miniflare 5 pin, engines, and options shape (aip-263g.13)

- `miniflare` stays pinned to `^5.20260907.0-alpha` (optional dependency): every
  Miniflare 5 release is an `-alpha` prerelease, and a bare `^5` matches none of
  them under npm semver. The range admits the first stable 5.x; re-pin to `^5`
  once one ships.
- `ai-evaluate` now declares `engines.node >= 22`, matching Miniflare 5's own
  `engines`. On older Node, package managers skip the optional dependency at
  install time; `ai-evaluate/node` now reports the exported
  `MINIFLARE_UNAVAILABLE_ERROR` (what is missing and why, plus the resolver's
  message) instead of a bare "Cannot find package 'miniflare'". Other import
  failures pass through unchanged.
- Documented that the local host is built with native Miniflare 5 options
  (`workers[].config` + `manifest` + `env.LOADER: { type: 'worker-loader' }`);
  the Miniflare 4 shape and `convertV4MiniflareOptions()` are no longer used
  anywhere.
- Monorepo: CI and the root `engines.node` move to Node 22 (Node 20 is
  end-of-life and cannot install Miniflare 5).
