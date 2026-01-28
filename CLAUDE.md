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
