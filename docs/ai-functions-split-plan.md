# AI Functions Package Split Plan

**Issue:** aip-qgzi
**Status:** Planning
**Author:** AI Analysis
**Date:** 2026-01-28

## Executive Summary

The `ai-functions` package has grown to encompass too many concerns, making it difficult to maintain and causing unnecessary dependency bloat for users who only need specific features. This document outlines a plan to split the package into focused, single-purpose packages while maintaining backward compatibility.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Proposed Package Structure](#proposed-package-structure)
3. [Dependency Graph Analysis](#dependency-graph-analysis)
4. [Detailed Package Specifications](#detailed-package-specifications)
5. [Circular Dependency Risks](#circular-dependency-risks)
6. [Migration Plan](#migration-plan)
7. [Backward Compatibility Strategy](#backward-compatibility-strategy)
8. [Implementation Order](#implementation-order)

---

## Current State Analysis

### File Structure

```
packages/ai-functions/src/
├── ai.ts                    # AI proxy, function registry, defineFunction
├── ai-promise.ts            # AIPromise with pipelining and streaming
├── batch/                   # Provider-specific batch adapters
│   ├── index.ts
│   ├── anthropic.ts
│   ├── bedrock.ts
│   ├── cloudflare.ts
│   ├── google.ts
│   ├── memory.ts
│   └── openai.ts
├── batch-map.ts             # BatchMapPromise for automatic batching
├── batch-queue.ts           # BatchQueue for deferred execution
├── budget.ts                # BudgetTracker, TokenCounter, RequestContext
├── cache.ts                 # MemoryCache, EmbeddingCache, GenerationCache
├── context.ts               # Execution context with batch/budget config
├── digital-objects-registry.ts  # Function registry for digital-objects.do
├── embeddings.ts            # Embedding utilities (re-exports from AI SDK)
├── errors.ts                # NotImplementedError
├── eval/                    # Evaluation framework
│   ├── index.ts
│   ├── models.ts
│   └── runner.ts
├── generate.ts              # generateObject, generateText wrappers
├── index.ts                 # Main exports
├── primitives.ts            # Core AI template functions
├── providers/               # Provider integrations
│   ├── cloudflare.ts
│   └── index.ts
├── retry.ts                 # RetryPolicy, CircuitBreaker, FallbackChain
├── schema.ts                # SimpleSchema to Zod conversion
├── template.ts              # Template literal utilities
├── tool-orchestration.ts    # AgenticLoop, ToolRouter, ToolValidator
├── type-guards.ts           # isZodSchema helper
└── types.ts                 # Core type definitions
```

### Current Export Categories

| Category | Exports | Lines of Code |
|----------|---------|---------------|
| **Core** | generate, ai, write, code, list, lists, extract, summarize, is, diagram, slides, image, video | ~700 |
| **Human** | do, research, read, browse, decide, ask, approve, review | ~200 |
| **AIPromise** | AIPromise, createTextPromise, createObjectPromise, etc. | ~1200 |
| **Batch** | BatchQueue, BatchMapPromise, createBatch, withBatch | ~1300 |
| **Budget** | BudgetTracker, TokenCounter, RequestContext | ~730 |
| **Cache** | MemoryCache, EmbeddingCache, GenerationCache, withCache | ~650 |
| **Retry** | RetryPolicy, CircuitBreaker, FallbackChain, withRetry | ~780 |
| **Tools** | AgenticLoop, ToolRouter, ToolValidator, createTool | ~1130 |
| **Schema** | schema, SimpleSchema | ~140 |
| **Context** | configure, getContext, withContext | ~395 |

### Current Dependencies Between Modules

```
types.ts (standalone)
    ↓
errors.ts (standalone)
    ↓
type-guards.ts (standalone, uses zod)
    ↓
schema.ts (uses type-guards, zod)
    ↓
template.ts (uses yaml)
    ↓
generate.ts (uses schema, type-guards, ai-providers, ai)
    ↓
context.ts (uses batch-queue types, budget types)
    ↓
batch-queue.ts (uses template, schema)
    ↓
batch-map.ts (uses context, batch-queue, generate, schema)
    ↓
ai-promise.ts (uses generate, schema, template, batch-map, context)
    ↓
primitives.ts (uses ai-promise, generate, schema, types)
    ↓
ai.ts (uses generate, schema, types, ai-promise)
    ↓
budget.ts (standalone, uses crypto)
    ↓
cache.ts (standalone)
    ↓
retry.ts (standalone)
    ↓
tool-orchestration.ts (uses zod)
    ↓
embeddings.ts (uses ai, ai-providers)
```

---

## Proposed Package Structure

### 1. `ai-core` (New Foundation Package)

**Purpose:** Core generation primitives and type definitions.

**Exports:**
- Types: `AIFunctionDefinition`, `JSONSchema`, `AIGenerateOptions`, `AIGenerateResult`, etc.
- Schema: `schema`, `SimpleSchema`
- Generation: `generateObject`, `generateText`, `streamObject`, `streamText`
- Context: `configure`, `getContext`, `withContext`, `getModel`, `getProvider`
- Template: `parseTemplate`, `createTemplateFunction`, `FunctionOptions`
- Type Guards: `isZodSchema`
- Errors: `NotImplementedError`

**Dependencies:**
- `ai` (Vercel AI SDK)
- `ai-providers`
- `zod`
- `yaml`

### 2. `ai-primitives` (Depends on ai-core)

**Purpose:** AI template tag functions with AIPromise pipelining.

**Exports:**
- Primitives: `ai`, `write`, `code`, `list`, `lists`, `extract`, `summarize`, `is`, `diagram`, `slides`, `image`, `video`
- Human: `do`, `research`, `read`, `browse`, `decide`, `ask`, `approve`, `review`
- AIPromise: `AIPromise`, `createTextPromise`, `createObjectPromise`, `createListPromise`, etc.
- Generate: `generate` (high-level wrapper)

**Dependencies:**
- `ai-core`
- `ai-batch` (optional peer dependency for `.map()` batching)

### 3. `ai-batch` (Depends on ai-core)

**Purpose:** Batch processing with provider APIs.

**Exports:**
- Core: `BatchQueue`, `createBatch`, `withBatch`, `isBatchMode`, `deferToBatch`
- Map: `BatchMapPromise`, `createBatchMap`, `isBatchMapPromise`
- Types: `BatchMode`, `BatchProvider`, `BatchStatus`, `BatchItem`, `BatchJob`, `BatchResult`
- Adapters: Export path `ai-batch/adapters/openai`, `ai-batch/adapters/anthropic`, etc.
- Context Extensions: `getBatchMode`, `getBatchThreshold`, `getExecutionTier`

**Dependencies:**
- `ai-core`

### 4. `ai-budget` (Standalone)

**Purpose:** Budget tracking and request tracing.

**Exports:**
- `BudgetTracker`
- `TokenCounter`
- `RequestContext`
- `BudgetExceededError`
- `createRequestContext`
- `withBudget`
- Types: `BudgetConfig`, `TokenUsage`, `ModelPricing`, etc.

**Dependencies:**
- Node.js `crypto` (for UUID generation)
- No ai-core dependency (fully standalone)

### 5. `ai-cache` (Standalone)

**Purpose:** Caching layer for embeddings and generations.

**Exports:**
- `MemoryCache`
- `EmbeddingCache`
- `GenerationCache`
- `withCache`
- `hashKey`, `createCacheKey`
- Types: `CacheStorage`, `CacheEntry`, `CacheOptions`, `CacheStats`

**Dependencies:**
- None (fully standalone)

### 6. `ai-resilience` (Standalone)

**Purpose:** Retry patterns and circuit breakers.

**Exports:**
- Errors: `RetryableError`, `NonRetryableError`, `NetworkError`, `RateLimitError`, `CircuitOpenError`
- Classification: `ErrorCategory`, `classifyError`
- Backoff: `calculateBackoff`, `JitterStrategy`, `BackoffOptions`
- Retry: `RetryPolicy`, `withRetry`
- Circuit Breaker: `CircuitBreaker`, `CircuitState`
- Fallback: `FallbackChain`, `FallbackModel`
- Types: `RetryOptions`, `RetryInfo`, `CircuitBreakerOptions`, etc.

**Dependencies:**
- None (fully standalone)

### 7. `ai-tools` (Depends on ai-core)

**Purpose:** Agentic tool orchestration.

**Exports:**
- Core: `AgenticLoop`, `ToolRouter`, `ToolValidator`, `createAgenticLoop`
- Composition: `createTool`, `createToolset`, `wrapTool`, `cachedTool`, `rateLimitedTool`, `timeoutTool`
- Types: `Tool`, `ToolCall`, `ToolResult`, `LoopOptions`, `LoopResult`, `LoopStreamEvent`

**Dependencies:**
- `ai-core` (for generation)
- `zod`

### 8. `ai-functions` (Facade Package - Re-exports All)

**Purpose:** Full-featured package that re-exports everything for backward compatibility.

**Exports:**
- Re-exports from all packages above
- Legacy compatibility aliases

**Dependencies:**
- All packages above as dependencies (not peer dependencies)

---

## Dependency Graph Analysis

### Visual Dependency Graph

```
                    ┌─────────────┐
                    │  ai-budget  │ (standalone)
                    └─────────────┘

                    ┌─────────────┐
                    │  ai-cache   │ (standalone)
                    └─────────────┘

                    ┌─────────────┐
                    │ai-resilience│ (standalone)
                    └─────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                              ai-core                                    │
│  (types, schema, generate, context, template, type-guards, errors)     │
│                                                                         │
└───────────────────────────┬─────────────────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
          ▼                 ▼                 ▼
   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
   │ ai-primitives│   │  ai-batch   │   │  ai-tools   │
   │              │   │             │   │             │
   └──────┬───────┘   └─────────────┘   └─────────────┘
          │
          │ (optional peer dep)
          ▼
   ┌─────────────┐
   │  ai-batch   │
   └─────────────┘


┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                           ai-functions                                  │
│              (facade - re-exports all packages)                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Module-Level Dependencies

| Module | Direct Dependencies |
|--------|---------------------|
| `types.ts` | None |
| `errors.ts` | None |
| `type-guards.ts` | `zod` |
| `schema.ts` | `type-guards`, `zod` |
| `template.ts` | `yaml` |
| `generate.ts` | `schema`, `type-guards`, `ai`, `ai-providers` |
| `context.ts` | Types from `batch-queue`, `budget` (type-only imports) |
| `batch-queue.ts` | `template` (types), `schema` |
| `batch-map.ts` | `context`, `batch-queue`, `generate`, `schema` |
| `ai-promise.ts` | `generate`, `schema`, `template`, `batch-map`, `context` |
| `primitives.ts` | `ai-promise`, `generate`, `schema`, `types` |
| `ai.ts` | `generate`, `schema`, `types` |
| `budget.ts` | `crypto` (Node.js built-in) |
| `cache.ts` | None |
| `retry.ts` | None |
| `tool-orchestration.ts` | `zod` |
| `embeddings.ts` | `ai`, `ai-providers` |

---

## Detailed Package Specifications

### Package 1: `ai-core`

```json
{
  "name": "ai-core",
  "version": "1.0.0",
  "description": "Core AI generation primitives and types",
  "exports": {
    ".": "./dist/index.js",
    "./types": "./dist/types.js",
    "./schema": "./dist/schema.js",
    "./generate": "./dist/generate.js",
    "./context": "./dist/context.js",
    "./template": "./dist/template.js"
  },
  "peerDependencies": {
    "ai": "^4.0.0",
    "ai-providers": "^1.0.0",
    "zod": "^3.22.0"
  },
  "dependencies": {
    "yaml": "^2.3.0"
  }
}
```

**File Structure:**
```
packages/ai-core/src/
├── index.ts          # Main exports
├── types.ts          # Type definitions
├── errors.ts         # Error classes
├── type-guards.ts    # Type guard utilities
├── schema.ts         # SimpleSchema conversion
├── template.ts       # Template utilities
├── generate.ts       # generateObject/Text wrappers
└── context.ts        # Execution context (core only)
```

### Package 2: `ai-primitives`

```json
{
  "name": "ai-primitives",
  "version": "1.0.0",
  "description": "AI template tag functions with AIPromise pipelining",
  "exports": {
    ".": "./dist/index.js",
    "./promise": "./dist/ai-promise.js"
  },
  "dependencies": {
    "ai-core": "^1.0.0"
  },
  "peerDependencies": {
    "ai-batch": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "ai-batch": { "optional": true }
  }
}
```

**File Structure:**
```
packages/ai-primitives/src/
├── index.ts          # Main exports
├── ai-promise.ts     # AIPromise implementation
├── primitives.ts     # Template tag functions
└── generate.ts       # High-level generate wrapper
```

### Package 3: `ai-batch`

```json
{
  "name": "ai-batch",
  "version": "1.0.0",
  "description": "Batch processing with provider APIs",
  "exports": {
    ".": "./dist/index.js",
    "./adapters/openai": "./dist/adapters/openai.js",
    "./adapters/anthropic": "./dist/adapters/anthropic.js",
    "./adapters/google": "./dist/adapters/google.js",
    "./adapters/bedrock": "./dist/adapters/bedrock.js",
    "./adapters/cloudflare": "./dist/adapters/cloudflare.js",
    "./adapters/memory": "./dist/adapters/memory.js"
  },
  "dependencies": {
    "ai-core": "^1.0.0"
  }
}
```

**File Structure:**
```
packages/ai-batch/src/
├── index.ts          # Main exports
├── batch-queue.ts    # BatchQueue implementation
├── batch-map.ts      # BatchMapPromise
├── context.ts        # Batch-specific context extensions
└── adapters/
    ├── index.ts
    ├── openai.ts
    ├── anthropic.ts
    ├── google.ts
    ├── bedrock.ts
    ├── cloudflare.ts
    └── memory.ts
```

### Package 4: `ai-budget`

```json
{
  "name": "ai-budget",
  "version": "1.0.0",
  "description": "Budget tracking and request tracing for AI operations",
  "exports": {
    ".": "./dist/index.js"
  },
  "dependencies": {}
}
```

**File Structure:**
```
packages/ai-budget/src/
├── index.ts          # Main exports
├── budget-tracker.ts # BudgetTracker class
├── token-counter.ts  # TokenCounter class
├── request-context.ts # RequestContext class
└── types.ts          # Type definitions
```

### Package 5: `ai-cache`

```json
{
  "name": "ai-cache",
  "version": "1.0.0",
  "description": "Caching layer for AI embeddings and generations",
  "exports": {
    ".": "./dist/index.js"
  },
  "dependencies": {}
}
```

**File Structure:**
```
packages/ai-cache/src/
├── index.ts          # Main exports
├── memory-cache.ts   # MemoryCache implementation
├── embedding-cache.ts # EmbeddingCache
├── generation-cache.ts # GenerationCache
├── with-cache.ts     # withCache wrapper
└── utils.ts          # hashKey, createCacheKey
```

### Package 6: `ai-resilience`

```json
{
  "name": "ai-resilience",
  "version": "1.0.0",
  "description": "Retry patterns and circuit breakers for AI operations",
  "exports": {
    ".": "./dist/index.js"
  },
  "dependencies": {}
}
```

**File Structure:**
```
packages/ai-resilience/src/
├── index.ts          # Main exports
├── errors.ts         # Error classes
├── classify.ts       # Error classification
├── backoff.ts        # Backoff calculation
├── retry-policy.ts   # RetryPolicy class
├── circuit-breaker.ts # CircuitBreaker class
├── fallback-chain.ts # FallbackChain class
└── with-retry.ts     # withRetry wrapper
```

### Package 7: `ai-tools`

```json
{
  "name": "ai-tools",
  "version": "1.0.0",
  "description": "Agentic tool orchestration for AI workflows",
  "exports": {
    ".": "./dist/index.js"
  },
  "dependencies": {
    "ai-core": "^1.0.0"
  },
  "peerDependencies": {
    "zod": "^3.22.0"
  }
}
```

**File Structure:**
```
packages/ai-tools/src/
├── index.ts          # Main exports
├── agentic-loop.ts   # AgenticLoop class
├── tool-router.ts    # ToolRouter class
├── tool-validator.ts # ToolValidator class
├── composition.ts    # createTool, wrapTool, etc.
└── types.ts          # Type definitions
```

---

## Circular Dependency Risks

### Identified Risk 1: ai-primitives <-> ai-batch

**Issue:** `ai-primitives` needs `BatchMapPromise` for `.map()` functionality, while `ai-batch` might need primitives for generating.

**Solution:**
- Make `ai-batch` an optional peer dependency of `ai-primitives`
- Use dynamic imports in `ai-primitives` when batch features are needed
- `ai-batch` should only depend on `ai-core`, not on `ai-primitives`

```typescript
// In ai-primitives/ai-promise.ts
async map<U>(callback: (item: T, index: number) => U): Promise<U[]> {
  try {
    const { createBatchMap } = await import('ai-batch')
    // Use batch processing
  } catch {
    // Fallback to sequential processing
  }
}
```

### Identified Risk 2: context.ts Dependencies

**Issue:** `context.ts` imports types from both `batch-queue.ts` and `budget.ts`.

**Solution:**
- Define batch-specific context types in `ai-batch`
- Define budget-specific context types in `ai-budget`
- Keep `ai-core/context.ts` minimal with only core context types
- Each package extends the context interface as needed

```typescript
// ai-core/context.ts
export interface ExecutionContext {
  model?: string
  provider?: string
  system?: string
  // ... core options only
}

// ai-batch/context.ts
import type { ExecutionContext as CoreContext } from 'ai-core'

export interface BatchExecutionContext extends CoreContext {
  batchMode?: BatchMode
  batchThreshold?: number
  // ... batch-specific options
}
```

### Identified Risk 3: Shared Type Definitions

**Issue:** Multiple packages need access to types like `SimpleSchema`, `FunctionOptions`.

**Solution:**
- All shared types live in `ai-core`
- Other packages import types from `ai-core`
- Use `type` imports to avoid runtime circular dependencies

```typescript
// In ai-batch/batch-queue.ts
import type { SimpleSchema, FunctionOptions } from 'ai-core'
```

---

## Migration Plan

### Phase 1: Extract Standalone Packages (No Breaking Changes)

**Duration:** 1-2 weeks

1. **Create `ai-budget`** - Extract from `budget.ts`
   - No external dependencies
   - Copy file, update imports
   - Publish as new package

2. **Create `ai-cache`** - Extract from `cache.ts`
   - No external dependencies
   - Copy file, update imports
   - Publish as new package

3. **Create `ai-resilience`** - Extract from `retry.ts`
   - No external dependencies
   - Copy file, update imports
   - Publish as new package

### Phase 2: Create Foundation Package

**Duration:** 1-2 weeks

4. **Create `ai-core`** - Extract core modules
   - `types.ts`
   - `errors.ts`
   - `type-guards.ts`
   - `schema.ts`
   - `template.ts`
   - `generate.ts`
   - `context.ts` (core only)

### Phase 3: Extract Dependent Packages

**Duration:** 2-3 weeks

5. **Create `ai-tools`** - Extract from `tool-orchestration.ts`
   - Depends on `ai-core`
   - Copy file, update imports
   - Publish as new package

6. **Create `ai-batch`** - Extract batch processing
   - `batch-queue.ts`
   - `batch-map.ts`
   - `batch/` adapters
   - Depends on `ai-core`

7. **Create `ai-primitives`** - Extract AI template functions
   - `ai-promise.ts`
   - `primitives.ts`
   - `ai.ts` (proxy and define)
   - Depends on `ai-core`, optional `ai-batch`

### Phase 4: Update ai-functions to Facade

**Duration:** 1 week

8. **Update `ai-functions`** - Convert to facade
   - Remove direct implementations
   - Re-export from all packages
   - Maintain backward compatibility
   - Add deprecation notices for direct imports

---

## Backward Compatibility Strategy

### Approach: Re-export Facade

The `ai-functions` package becomes a facade that re-exports everything from the split packages:

```typescript
// packages/ai-functions/src/index.ts

// Re-export everything from ai-core
export * from 'ai-core'

// Re-export everything from ai-primitives
export * from 'ai-primitives'

// Re-export everything from ai-batch
export * from 'ai-batch'

// Re-export everything from ai-budget
export * from 'ai-budget'

// Re-export everything from ai-cache
export * from 'ai-cache'

// Re-export everything from ai-resilience
export * from 'ai-resilience'

// Re-export everything from ai-tools
export * from 'ai-tools'

// Legacy compatibility - re-export with original names if any changed
export { ai as aiProxy } from 'ai-primitives'
```

### Handling Import Paths

For users who import from sub-paths:

```typescript
// Old (still works - deprecated)
import { BatchQueue } from 'ai-functions'

// New (recommended)
import { BatchQueue } from 'ai-batch'
```

Add deprecation warnings via JSDoc:

```typescript
/**
 * @deprecated Import from 'ai-batch' instead: `import { BatchQueue } from 'ai-batch'`
 */
export { BatchQueue } from 'ai-batch'
```

### Versioning Strategy

1. **New packages:** Start at `1.0.0`
2. **ai-functions:**
   - Minor version bump when facade is introduced
   - Keep major version for breaking changes only
   - Add deprecation warnings in minor versions
   - Remove deprecated exports in next major version

---

## Implementation Order

### Recommended Order (By Complexity and Risk)

| Order | Package | Risk Level | Estimated Effort |
|-------|---------|------------|------------------|
| 1 | `ai-budget` | Low | 0.5 days |
| 2 | `ai-cache` | Low | 0.5 days |
| 3 | `ai-resilience` | Low | 0.5 days |
| 4 | `ai-core` | Medium | 2 days |
| 5 | `ai-tools` | Low | 1 day |
| 6 | `ai-batch` | Medium | 2 days |
| 7 | `ai-primitives` | High | 2 days |
| 8 | `ai-functions` (facade) | Low | 0.5 days |

**Total Estimated Effort:** 9 days

### Testing Strategy

1. **Unit Tests:** Each new package should have its own test suite
2. **Integration Tests:** Test package interactions
3. **Compatibility Tests:** Ensure `ai-functions` facade maintains all existing behavior
4. **Import Tests:** Verify all import paths work as documented

### Documentation Updates

1. Update README for each new package
2. Update `ai-functions` README to show migration path
3. Add MIGRATION.md guide
4. Update examples to show preferred imports

---

## Appendix: Files to Move

### ai-core
- `types.ts` -> `ai-core/src/types.ts`
- `errors.ts` -> `ai-core/src/errors.ts`
- `type-guards.ts` -> `ai-core/src/type-guards.ts`
- `schema.ts` -> `ai-core/src/schema.ts`
- `template.ts` -> `ai-core/src/template.ts`
- `generate.ts` -> `ai-core/src/generate.ts`
- `context.ts` (partial) -> `ai-core/src/context.ts`

### ai-primitives
- `ai-promise.ts` -> `ai-primitives/src/ai-promise.ts`
- `primitives.ts` -> `ai-primitives/src/primitives.ts`
- `ai.ts` -> `ai-primitives/src/ai.ts`

### ai-batch
- `batch-queue.ts` -> `ai-batch/src/batch-queue.ts`
- `batch-map.ts` -> `ai-batch/src/batch-map.ts`
- `batch/` -> `ai-batch/src/adapters/`
- `context.ts` (batch parts) -> `ai-batch/src/context.ts`

### ai-budget
- `budget.ts` -> `ai-budget/src/index.ts` (split into multiple files)

### ai-cache
- `cache.ts` -> `ai-cache/src/` (split into multiple files)

### ai-resilience
- `retry.ts` -> `ai-resilience/src/` (split into multiple files)

### ai-tools
- `tool-orchestration.ts` -> `ai-tools/src/` (split into multiple files)

---

## Open Questions

1. **Embeddings:** Should `embeddings.ts` be part of `ai-core` or a separate `ai-embeddings` package?
   - **Recommendation:** Keep in `ai-core` since it's just re-exports with convenience wrappers

2. **Digital Objects Registry:** Should `digital-objects-registry.ts` stay in `ai-functions` or move to a separate package?
   - **Recommendation:** Keep in `ai-functions` as it's specific to digital-objects.do integration

3. **Evaluation Framework:** The `eval/` directory - where should it go?
   - **Recommendation:** Keep as separate export path in `ai-core` or create `ai-evaluate` package

4. **Providers Directory:** Where should `providers/` go?
   - **Recommendation:** Move to `ai-providers` package or keep in `ai-core`

---

## Conclusion

This split plan divides `ai-functions` into 7 focused packages while maintaining full backward compatibility through a facade pattern. The standalone packages (`ai-budget`, `ai-cache`, `ai-resilience`) can be extracted first with minimal risk, followed by the foundation `ai-core` package, and finally the dependent packages.

The key benefits of this approach:
1. **Reduced bundle size** for users who only need specific features
2. **Clear separation of concerns** for easier maintenance
3. **Independent versioning** for packages with different release cadences
4. **Full backward compatibility** through the facade package
