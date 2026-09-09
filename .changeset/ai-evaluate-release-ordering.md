---
'ai-evaluate': patch
---

ai-evaluate: `pnpm build` runs `sync:version` first, and the root `release` script orders `version-packages` -> `build` -> `publish-packages`, so `dist/version.js` and the `public/*.mjs` headers ship at the bumped version (aip-lrjh.11)
