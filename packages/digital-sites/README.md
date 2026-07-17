# digital-sites

**A site as code** — the framework primitive for a website expressed as a
composable, type-checked artifact rather than a hand-authored deployment. Seeded
from startup-builder's `site-hono-jsx` + `ui-primitives`, `digital-sites` is a
G4 primitive: brand + offer mint a startup, and the startup's public surface is
one of these. It is the shape a generated Startup renders _through_, not a bag of
files.

## Status — defensive name-claim stub (0.1.0, pre-1.0)

This is a **type-only placeholder** published under ADR 0001's fixation gate:
everything stays `0.x` until **≥2 real external binders prove the shape**. Nothing
here is entrenched — the exported types are a marker for the eventual surface, not
a committed contract. The package exists so the bare `digital-sites` name (verified
unclaimed on npm) is held by this monorepo before a squatter takes it, matching the
`digital-products` / `digital-tools` / `digital-workers` primitive family.

There is **no implementation** yet. Do not depend on the type shapes; they will
change without a major bump while the package is `0.x`.

## Thesis (from the constitution, annex STRAWMAN-v2)

> Framework primitives (each one module, schema + logic together): `storybrand`,
> `lean-canvas`, `positioning`, `pricing`, `hypothesis-evidence`, **`digital-sites`
> (a site as code — seeded from startup-builder's site-hono-jsx + ui-primitives)**.

See `org.ai` ADR 0001 — the four-register constitution.
