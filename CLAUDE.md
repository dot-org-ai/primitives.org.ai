# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
pnpm install              # Install all dependencies
pnpm build                # Build all packages (topologically sorted via Turborepo)
pnpm test                 # Run tests across all packages
pnpm typecheck            # Type-check all packages
pnpm lint                 # Lint all packages
pnpm dev                  # Watch mode for all packages
pnpm clean                # Remove dist/ artifacts
```

### Single Package Operations

```bash
pnpm test --filter=ai-functions       # Test one package via Turbo
pnpm build --filter=ai-database       # Build one package via Turbo

cd packages/ai-functions
pnpm test                              # vitest (watch mode)
pnpm test -- --run                     # vitest run (single pass)
pnpm test -- path/to/file.test.ts      # Run specific test file
```

### Code Style

- Prettier: no semicolons, single quotes, trailing commas (es5), 100 char width
- Lint-staged runs `prettier --write` on `*.{ts,tsx}` at commit time
- Conventional commits: `feat(scope):`, `fix(scope):`, `docs:`, etc.

## Architecture

This is a pnpm workspace + Turborepo monorepo of composable TypeScript packages for building AI-powered applications. All packages are ES modules targeting Node 18+.

### Layer Hierarchy

Packages follow strict layer rules -- each layer may only import from layers below it:

- **Layer 0 (Foundation):** `@org.ai/types`, `@org.ai/config`, `language-models`, `ai-workflows`, `ai-tests` -- no internal deps
- **Layer 1 (Providers):** `ai-providers` -- unified registry for OpenAI, Anthropic, Google, Bedrock
- **Layer 2 (Core):** `ai-functions` (formerly `ai-core`) -- AIPromise, generate(), context, batch, resilience
- **Layer 3 (Functions):** `ai-database` -- AI-powered data with MDXLD conventions
- **Layer 4 (Workers):** `digital-workers`, `digital-tools`, `digital-tasks`
- **Layer 5 (Applications):** `autonomous-agents`, `human-in-the-loop`, `business-as-code`, `services-as-software`, `digital-products`
- **Testing (parallel):** `ai-evaluate`, `ai-experiments`, `ai-props`
- **Umbrella:** `ai-primitives` (new primary), `org.ai` (legacy with subpath exports)

> **Layering exception — economic substrate (`business-as-code/finance`).** The
> outcome-contract economic substrate (Money/Cost/Pricing/OutcomeContract/
> ProofPredicate/SLAPolicy/RefundContract/AuthorityBoundary + FinanceProvider/
> Merchant ports) lives in `business-as-code` (Layer 5) under the `./finance`
> subpath but is conceptually **foundational** (Layer 0): finance is the core of
> the default OKRs (Revenue/Growth/Profit), and `services-as-software` (L5) and
> `digital-tools` (L4) **consume** it. This means `digital-tools` (L4) imports
> `business-as-code` (L5) — a lower-layer-imports-higher-layer inversion that is
> intentional and acyclic (`business-as-code`'s dep closure contains neither
> `digital-tools` nor `services-as-software`). The substrate is self-contained
> (no internal workspace deps), so this introduces no dependency cycle.
> The former `autonomous-finance` package (and the 16 unpublished `autonomous-*`
> catalog packages it served) have been **removed**; `business-as-code/finance`
> is now the sole home for these economic primitives. The inversion is accepted;
> if it is later resolved, the substrate can move to a dedicated Layer 0
> foundation module instead of `business-as-code`.

### Package Naming

Only two packages are scoped: `@org.ai/types` and `@org.ai/config`. All other packages are **unscoped** (e.g., `ai-functions`, `digital-workers`, `autonomous-agents`). Never reference packages as `@org.ai/ai-functions` or `@primitives/types` -- those are incorrect.

### Key Patterns

**MDXLD conventions:** Types use `$id` and `$type` fields (not JSON-LD's `@id`/`@type`). MDXLD is the `$`-prefixed superset of JSON-LD, used throughout for semantic identity. Type URIs reference `https://schema.org.ai/`.

**AIPromise:** Promise pipelining inspired by Cap'n Proto. Property access on an AIPromise tracks accessed fields to infer output schema. Dependencies between AIPromises are tracked so execution can be batched when finally awaited.

**Context hierarchy:** Configuration flows via `AsyncLocalStorage`: env vars (`AI_MODEL`, `AI_PROVIDER`) -> `configure()` global -> `withContext()` scoped -> function-level options.

**Resilience:** `ai-functions` provides `RetryPolicy` (exponential backoff with jitter), `CircuitBreaker` (fail-fast with half-open recovery), and `FallbackChain` (model failover). Errors are classified by `ErrorCategory` (Network, RateLimit, Server, InvalidInput, Authentication, ContextLength).

**Cloudflare Workers:** Many packages export a `/worker` subpath with `WorkerEntrypoint` classes for Cloudflare Workers deployment. Testing uses Miniflare via `ai-evaluate`.

### Testing

Framework is Vitest 2.x. Tests live in `test/` directories within each package. AI-dependent tests use long timeouts (60s) and single-worker execution (`maxWorkers: 1`, `pool: 'forks'`) to avoid rate limiting.

## Publishing & npm packages

The publish script (`scripts/publish.ts`) auto-handles npm web auth for non-TTY callers (agents, CI) via `expect` — it opens a browser for the human to authorize each publish. **Agents may run the publish** with the human approving in-browser when prompted.

### What agents CAN do autonomously

- Bump existing package versions (semver-appropriate, via changesets).
- Modify existing package source (with an appropriate changeset entry).
- Consume changesets, run `pnpm changeset version`, then run the publish script (the human sees the browser auth prompt and approves).

### What agents MUST NOT do without explicit human discussion + approval

- **Create new npm packages** — any new `packages/*/package.json` with a `name` field destined for npm.
  - **Why this is non-negotiable:** npm package names are effectively permanent. npm's unpublish policy only allows removal within 72 hours of *original* publish, only if no other package depends on it, and even then the name remains *reserved* (no one can ever publish under it again). A mistakenly-published name is permanent clutter we cannot undo. A wrongly-scoped name (publishing under a scope we don't own, or under a scope someone else does) is worse — it can claim or contest scope ownership.
  - **Required process before creating any new package:**
    1. **Scope ownership** — `npm access ls-packages <scope>` confirms we own the scope. If we don't own it, STOP and discuss.
    2. **Naming intent** — the human approves the exact name + scope.
    3. **Home placement** — the human confirms it should be a *new* package vs folded into an existing one. Most things that look like they want to be their own package belong inside an existing one as a submodule (e.g. a new subpath export with `src/<subdomain>/` and a `./<subdomain>` entry in `exports`).
- **Change the npm scope of an existing package** — renaming `@old/x` → `@new/x` orphans the old name on npm (still resolvable, still installable, but unmaintained).
- **Publish to a scope we don't own** — would fail or contest ownership.

A `pnpm pre-publish` scope-ownership check (`npm access ls-packages <scope>`) is the right long-term guard; until it lands, the human-approval gate above is the discipline.

(Why this section exists: in 2026-05 an agent scaffolded `@primitives/content-derived-id`, `@primitives/db-docs-rels`, and `@primitives/llm-pricing` under a scope we do not own — discovered at pre-publish review. They've since been folded into `@graphdl/core`, `ai-database`, and `language-models` respectively. See the `## Package Naming` note above: only `@org.ai/types` and `@org.ai/config` are scoped; everything else is unscoped.)
