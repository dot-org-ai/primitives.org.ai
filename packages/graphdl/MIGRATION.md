# Migration Plan: Consolidating ai-database with @graphdl/core

This document outlines the plan for migrating overlapping functionality from `ai-database` to use `@graphdl/core` as its foundation for graph schema definition, linguistic utilities, and relationship operators.

## Overview

`@graphdl/core` is a pure TypeScript DSL for defining entity graphs with noun/verb semantics and relationship operators. It has been designed as a Layer 0 (Foundation) package with no internal dependencies, making it ideal for use as a foundational dependency for `ai-database`.

The `ai-database` package currently contains duplicate implementations of:
- Linguistic utilities (verb conjugation, noun pluralization)
- Relationship operator parsing
- Dependency graph building
- Type metadata (TypeMeta, Noun, Verb types)

## 1. Files in ai-database to be Removed After Migration

The following files have significant overlap with `@graphdl/core` and should be removed after migration:

### Complete Removals (Full File Deletion)

| File | Reason |
|------|--------|
| `/packages/ai-database/src/linguistic.ts` | Fully duplicated by `@graphdl/core` `linguistic.ts` - same functions: `conjugate`, `pluralize`, `singularize`, `inferNoun`, `createTypeMeta`, `getTypeMeta`, `Type`, `getVerbFields` |
| `/packages/ai-database/src/schema/dependency-graph.ts` | Nearly identical to `@graphdl/core` `dependency-graph.ts` - same API: `buildDependencyGraph`, `topologicalSort`, `detectCycles`, `getParallelGroups`, `getAllDependencies`, `hasCycles`, `visualizeGraph`, `CircularDependencyError`, `PRIMITIVE_TYPES` |

### Partial Removals (Extract and Consolidate)

| File | What to Remove | What to Keep |
|------|----------------|--------------|
| `/packages/ai-database/src/types.ts` | Lines 199-445: `Verb`, `Verbs`, `Noun`, `NounProperty`, `NounRelationship`, `TypeMeta` interfaces - these are duplicated in `@graphdl/core` | Keep: `ThingFlat`, `ThingExpanded`, `toExpanded`, `toFlat`, `FieldDefinition`, `EntitySchema`, `DatabaseSchema`, `ParsedField`, `ParsedEntity`, `ParsedSchema`, `SeedConfig`, and all database-specific types (EntityId, Thing, Relationship, Query types, etc.) |
| `/packages/ai-database/src/schema/parse.ts` | `parseOperator` function (lines 550-701) - duplicated in `@graphdl/core` `relationship.ts` | Keep: `SchemaValidationError`, validation functions (`validateEntityName`, `validateFieldName`, `validateFieldType`, `validateArrayDefinition`, `validateOperatorTarget`, `validateOperatorSyntax`), `isPrimitiveType`, `parseField`, `parseSchema` |
| `/packages/ai-database/src/schema/types.ts` | Re-exports of `Verb`, `Noun`, `NounProperty`, `NounRelationship`, `PrimitiveType` from `../types.ts` | Keep: All two-phase types (`ReferenceSpec`, `Draft`, `Resolved`, etc.), entity operation types, Events/Actions/Artifacts API types, NL query types |

## 2. Import Changes Needed in ai-database

### New Dependencies

Add `@graphdl/core` as a dependency in `/packages/ai-database/package.json`:

```json
{
  "dependencies": {
    "@graphdl/core": "workspace:*",
    // ... existing dependencies
  }
}
```

### Import Replacements

#### `/packages/ai-database/src/types.ts`

```diff
- // Local Verb definition
- export interface Verb { ... }
- export const Verbs = { ... } as const satisfies Record<string, Verb>
- export interface Noun { ... }
- export interface NounProperty { ... }
- export interface NounRelationship { ... }
- export interface TypeMeta { ... }
+ // Re-export from @graphdl/core
+ export type {
+   Verb,
+   VerbReverse,
+   Noun,
+   NounProperty,
+   NounRelationship,
+   TypeMeta,
+   PrimitiveType,
+   RelationshipOperator,
+   RelationshipDirection,
+   RelationshipMatchMode,
+   ParsedRelationship,
+ } from '@graphdl/core'
+ export { Verbs } from '@graphdl/core'
```

#### `/packages/ai-database/src/linguistic.ts`

Replace the entire file with re-exports:

```typescript
/**
 * Linguistic Helpers - Re-exported from @graphdl/core
 *
 * @packageDocumentation
 */
export {
  // Verb functions
  conjugate,
  getVerbFields,
  Verbs,
  isStandardVerb,
  getStandardVerbs,

  // Noun functions
  inferNoun,
  defineNoun,
  createTypeMeta,
  getTypeMeta,
  Type,
  clearTypeMetaCache,

  // Linguistic utilities
  pluralize,
  singularize,
  capitalize,
  preserveCase,
  isVowel,
  splitCamelCase,
  toKebabCase,
  toPastParticiple,
  toActor,
  toPresent,
  toGerund,
  toResult,
} from '@graphdl/core'

export type { DefineNounOptions } from '@graphdl/core'
```

#### `/packages/ai-database/src/schema/parse.ts`

```diff
+ import {
+   parseOperator as graphdlParseOperator,
+   hasOperator,
+   getOperator,
+   isForwardOperator,
+   isBackwardOperator,
+   isFuzzyOperator,
+   isExactOperator,
+   OPERATOR_SEMANTICS,
+   OPERATORS,
+ } from '@graphdl/core'
+ import type { ParsedRelationship } from '@graphdl/core'

  // ... keep validation functions

- export function parseOperator(definition: string): OperatorParseResult | null {
-   // ... 150 lines of operator parsing
- }
+ // Wrapper to maintain API compatibility
+ export function parseOperator(definition: string): OperatorParseResult | null {
+   const result = graphdlParseOperator(definition)
+   if (!result) return null
+   // Map ParsedRelationship to OperatorParseResult
+   return {
+     operator: result.operator,
+     direction: result.direction,
+     matchMode: result.matchMode,
+     targetType: result.targetType,
+     prompt: result.prompt,
+     unionTypes: result.unionTypes,
+     threshold: result.threshold,
+   }
+ }
```

#### `/packages/ai-database/src/schema/dependency-graph.ts`

Replace the entire file with re-exports and type adapters:

```typescript
/**
 * Dependency Graph - Re-exported from @graphdl/core
 *
 * @packageDocumentation
 */
import type { ParsedSchema } from '../types.js'
import type {
  DependencyGraph as GraphDLDependencyGraph,
  DependencyNode as GraphDLDependencyNode,
  DependencyEdge as GraphDLDependencyEdge,
  ParsedGraph,
} from '@graphdl/core'

// Re-export types with ai-database naming convention
export type SchemaDepNode = GraphDLDependencyNode
export type SchemaDepEdge = GraphDLDependencyEdge
export type SchemaDepGraph = GraphDLDependencyGraph

// Re-export functions
export {
  topologicalSort,
  detectCycles,
  getParallelGroups,
  getAllDependencies,
  hasCycles,
  visualizeGraph,
  CircularDependencyError,
  PRIMITIVE_TYPES,
} from '@graphdl/core'

export type { DetectCyclesOptions } from '@graphdl/core'

// Adapter function for ParsedSchema -> ParsedGraph conversion
export function buildDependencyGraph(schema: ParsedSchema): SchemaDepGraph {
  // Convert ParsedSchema to ParsedGraph format
  const parsedGraph: ParsedGraph = {
    entities: schema.entities,
    typeUris: new Map(),
  }

  // Import and call the graphdl version
  const { buildDependencyGraph: graphdlBuildDependencyGraph } = await import('@graphdl/core')
  return graphdlBuildDependencyGraph(parsedGraph)
}
```

#### `/packages/ai-database/src/schema/index.ts`

```diff
- import { inferNoun, getTypeMeta, conjugate } from '../linguistic.js'
+ import { inferNoun, getTypeMeta, conjugate } from '@graphdl/core'

- import { Verbs, parseUrl } from '../types.js'
+ import { Verbs } from '@graphdl/core'
+ import { parseUrl } from '../types.js'
```

## 3. Breaking Changes and API Differences

### Type Name Differences

| ai-database | @graphdl/core | Notes |
|-------------|---------------|-------|
| `SchemaDepNode` | `DependencyNode` | Rename required or keep as alias |
| `SchemaDepEdge` | `DependencyEdge` | Rename required or keep as alias |
| `SchemaDepGraph` | `DependencyGraph` | Rename required or keep as alias |
| `OperatorParseResult` | `ParsedRelationship` | Similar structure, minor differences |

### Structural Differences

#### ParsedRelationship vs OperatorParseResult

```typescript
// @graphdl/core ParsedRelationship
interface ParsedRelationship {
  operator: RelationshipOperator     // Required in graphdl
  direction: RelationshipDirection   // Required in graphdl
  matchMode: RelationshipMatchMode   // Required in graphdl
  targetType: string
  backref?: string                   // graphdl includes backref
  isArray?: boolean
  isOptional?: boolean
  unionTypes?: string[]
  threshold?: number
  prompt?: string
}

// ai-database OperatorParseResult
interface OperatorParseResult {
  operator?: '->' | '~>' | '<-' | '<~'  // Optional in ai-database
  direction?: 'forward' | 'backward'     // Optional in ai-database
  matchMode?: 'exact' | 'fuzzy'          // Optional in ai-database
  targetType: string
  unionTypes?: string[]
  threshold?: number
  prompt?: string
  // No backref, isArray, isOptional (handled separately in parseField)
}
```

#### PrimitiveType

```typescript
// @graphdl/core - includes 'email'
type PrimitiveType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'json' | 'markdown' | 'url' | 'email'

// ai-database - does NOT include 'email'
type PrimitiveType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'json' | 'markdown' | 'url'
```

**Action Required**: Update ai-database to support 'email' primitive type.

#### Verb.actor Handling

```typescript
// @graphdl/core - toActor handles -ate verbs specially
if (verb.endsWith('ate')) return verb.slice(0, -1) + 'or'  // create -> creator (correct via Verbs lookup)

// ai-database - no special -ate handling
if (verb.endsWith('e')) return verb + 'r'  // create -> creater (incorrect)
```

**Note**: Both packages use the `Verbs` constant for standard verbs which includes correct forms. The difference only affects custom/unknown verbs.

### Function Signature Differences

#### buildDependencyGraph

```typescript
// @graphdl/core
function buildDependencyGraph(schema: ParsedGraph): DependencyGraph

// ai-database
function buildDependencyGraph(schema: ParsedSchema): SchemaDepGraph
```

**Action Required**: Create adapter or convert ParsedSchema to ParsedGraph format.

### Export Differences

`@graphdl/core` exports additional utilities not in `ai-database`:

- `defineNoun()` - Explicit noun definition helper
- `clearTypeMetaCache()` - Cache management for testing
- `toKebabCase()` - URL slug generation
- `isStandardVerb()` / `getStandardVerbs()` - Verb introspection
- `Graph()` - Main DSL function (not needed by ai-database)
- Relationship operator utilities: `hasOperator`, `getOperator`, `isForwardOperator`, `isBackwardOperator`, `isFuzzyOperator`, `isExactOperator`

## 4. Step-by-Step Migration Checklist

### Phase 1: Preparation

- [ ] Add `@graphdl/core` as a workspace dependency to `ai-database/package.json`
- [ ] Run `pnpm install` to link the workspace packages
- [ ] Ensure `@graphdl/core` builds successfully: `pnpm build --filter=@graphdl/core`

### Phase 2: Type Migration

- [ ] Update `/packages/ai-database/src/types.ts`:
  - [ ] Import `Verb`, `VerbReverse`, `Noun`, `NounProperty`, `NounRelationship`, `TypeMeta`, `PrimitiveType` from `@graphdl/core`
  - [ ] Re-export the imported types
  - [ ] Remove local type definitions
  - [ ] Keep `Verbs` constant locally OR import from `@graphdl/core` (prefer import)

- [ ] Update `/packages/ai-database/src/schema/types.ts`:
  - [ ] Remove redundant re-exports that now come from `@graphdl/core`
  - [ ] Keep all two-phase types and API interfaces

### Phase 3: Linguistic Migration

- [ ] Update `/packages/ai-database/src/linguistic.ts`:
  - [ ] Replace implementation with re-exports from `@graphdl/core`
  - [ ] Test that all consumers still work

- [ ] Update imports in dependent files:
  - [ ] `/packages/ai-database/src/schema/index.ts`
  - [ ] `/packages/ai-database/src/schema/cascade.ts` (if it imports from linguistic.ts)
  - [ ] Any test files

### Phase 4: Operator Parsing Migration

- [ ] Update `/packages/ai-database/src/schema/parse.ts`:
  - [ ] Import `parseOperator` from `@graphdl/core` (aliased as `graphdlParseOperator`)
  - [ ] Create thin wrapper to maintain `OperatorParseResult` interface
  - [ ] Remove the 150-line local implementation
  - [ ] Verify all edge cases still pass (union types, thresholds, backref, etc.)

### Phase 5: Dependency Graph Migration

- [ ] Update `/packages/ai-database/src/schema/dependency-graph.ts`:
  - [ ] Replace implementation with imports from `@graphdl/core`
  - [ ] Create type aliases for backward compatibility (`SchemaDepNode`, `SchemaDepEdge`, `SchemaDepGraph`)
  - [ ] Create adapter for `ParsedSchema` -> `ParsedGraph` conversion in `buildDependencyGraph`

### Phase 6: Test Migration

- [ ] Run all ai-database tests: `pnpm test --filter=ai-database`
- [ ] Fix any failing tests due to type or behavior changes
- [ ] Update test imports to use new paths

### Phase 7: Cleanup

- [ ] Remove unused code after successful migration
- [ ] Update CHANGELOG.md with migration notes
- [ ] Update package version (semver: minor if no breaking changes, major if breaking)

## 5. Verification Steps

### Build Verification

```bash
# Build @graphdl/core first
pnpm build --filter=@graphdl/core

# Build ai-database
pnpm build --filter=ai-database

# Verify no TypeScript errors
pnpm typecheck --filter=ai-database
```

### Test Verification

```bash
# Run all ai-database tests
pnpm test --filter=ai-database -- --run

# Run specific test suites that exercise migrated code
pnpm test --filter=ai-database -- --run test/linguistic.test.ts
pnpm test --filter=ai-database -- --run test/schema/parse.test.ts
pnpm test --filter=ai-database -- --run test/schema/dependency-graph.test.ts
```

### Integration Verification

```bash
# Test that dependent packages still work
pnpm build
pnpm test
```

### Behavioral Verification

1. **Verb Conjugation**
   ```typescript
   import { conjugate } from 'ai-database/schema'

   // Should work identically
   expect(conjugate('create').actor).toBe('creator')
   expect(conjugate('publish').activity).toBe('publishing')
   expect(conjugate('submit').act).toBe('submits')
   ```

2. **Noun Inference**
   ```typescript
   import { inferNoun } from 'ai-database/schema'

   // Should work identically
   expect(inferNoun('BlogPost').singular).toBe('blog post')
   expect(inferNoun('BlogPost').plural).toBe('blog posts')
   ```

3. **Operator Parsing**
   ```typescript
   import { parseOperator } from 'ai-database/schema'

   // Should work identically
   const result = parseOperator('->Author.posts')
   expect(result?.operator).toBe('->')
   expect(result?.targetType).toBe('Author')
   ```

4. **Dependency Graph**
   ```typescript
   import { buildDependencyGraph, topologicalSort } from 'ai-database/schema'
   import { parseSchema } from 'ai-database/schema'

   const schema = parseSchema({
     Post: { title: 'string', author: '->Author.posts' },
     Author: { name: 'string' }
   })

   const graph = buildDependencyGraph(schema)
   const order = topologicalSort(graph, 'Post')

   // Author should come before Post (Post depends on Author)
   expect(order).toEqual(['Author', 'Post'])
   ```

## Notes

### Why Consolidate?

1. **DRY Principle**: Eliminates ~800 lines of duplicated code
2. **Single Source of Truth**: Linguistic rules and relationship semantics in one place
3. **Easier Maintenance**: Bug fixes and improvements apply to both packages
4. **Layer Architecture**: Enforces proper dependency hierarchy (Layer 0 -> Layer 3)

### Rollback Plan

If migration causes issues:
1. Revert `package.json` dependency change
2. Restore original file contents from git
3. Re-run builds and tests

### Future Considerations

- Consider whether `@graphdl/core` should also include the `Graph()` DSL function from ai-database's `DB()` factory
- Evaluate if verb-derivation.ts should move to `@graphdl/core` (currently ai-database only)
- Consider adding seed configuration types to `@graphdl/core` if other packages need them
