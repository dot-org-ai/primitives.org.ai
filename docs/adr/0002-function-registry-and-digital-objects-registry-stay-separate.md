# `function-registry` and `digital-objects-registry` are intentionally separate

**Status:** accepted
**Date:** 2026-05-05

## Context

The 2026-05-05 architecture review flagged `packages/ai-functions/src/function-registry.ts` and `packages/ai-functions/src/digital-objects-registry.ts` as parallel façades that should be unified into a single schema-aware metadata store. Two claims drove the recommendation:

1. Shared schema normalization (SimpleSchema → JSONSchema) was duplicated across both files.
2. `digital-objects-registry` wrapped `MemoryProvider` from `ai-database`, creating a layering smell.

Investigation found both claims are wrong:

- **No shared schema conversion.** `function-registry`'s `convertArgsToJSONSchema` produces JSON Schema for OpenAI tool-calling parameters. `digital-objects-registry` uses inline string-shape SimpleSchemas for Noun definitions plus per-function-type `definitionToData`/`dataToDefinition` serializers for storage round-tripping. Different shapes, different consumers, no shared code path.
- **No layering smell.** `digital-objects-registry` imports `DigitalObjectsProvider` from the `digital-objects` package (Layer 0), not `MemoryProvider` from `ai-database`. `ai-functions` (Layer 3) depending on `digital-objects` (Layer 0) is allowed.
- The two files serve genuinely distinct purposes: `function-registry` owns AI-callable function definitions plus four kind-specific executors (code / generative / agentic / human); `digital-objects-registry` is a function-specific persistence layer over the digital-objects substrate.

The only real overlap is a small `Map<string, DefinedFunction>` cache. That's already abstracted by the existing `FunctionRegistry` interface — there is nothing further to unify.

## Decision

Keep `function-registry.ts` and `digital-objects-registry.ts` as separate modules. Do not introduce a unified metadata store. The existing `FunctionRegistry` interface already captures the legitimate unification.

## Consequences

- Future architecture reviews will not re-suggest merging these two files.
- If a third entity-kind registry ever appears with genuine schema-conversion duplication, *that* would justify revisiting; the current shape doesn't.
- Bead `aip-zq2q` is closed as `wontfix` with this ADR as the reason.
- Pattern note: this is the second bead from the 2026-05-05 review (after `aip-cg2y`, see ADR-0001) where the premise didn't survive code-level inspection. Future architecture reviews on this codebase should validate duplication claims by reading both files end-to-end before proposing merges, not by surface pattern-matching.
