# Version Policy for AI Primitives Packages

This document outlines the version alignment policy for all packages in the primitives.org.ai monorepo. It defines maturity levels based on semantic versioning and provides recommendations for aligning package versions with their actual maturity.

## Version Maturity Levels

| Version Range | Maturity Level | Description |
|---------------|----------------|-------------|
| **0.x.x** | Experimental/Alpha | Early development, API may change significantly, limited testing |
| **1.x.x** | Beta | API stabilizing, good test coverage, documentation in progress |
| **2.x.x+** | Stable | Production-ready, comprehensive tests, stable API, complete documentation |

## Assessment Criteria

Packages are evaluated on three dimensions:

1. **Test Coverage**: Number of test files relative to source files, breadth of test scenarios
2. **API Stability**: Consistency of exports, type definitions, and interface design
3. **Documentation Completeness**: README quality, CHANGELOG presence, API documentation

## Current Package Assessment

### Tier 1: Stable (2.x recommended)

These packages have comprehensive test coverage, stable APIs, and good documentation.

| Package | Current Version | Test Files | Source Files | Test Ratio | Documentation | Recommended |
|---------|-----------------|------------|--------------|------------|---------------|-------------|
| ai-database | 2.1.3 | 81 | 51 | 1.59 | README, CHANGELOG, TESTING.md | **2.x (Aligned)** |
| ai-functions | 2.1.3 | 34 | 31 | 1.10 | README, CHANGELOG, TODO.md | **2.x (Aligned)** |
| ai-workflows | 2.1.3 | 23 | 20 | 1.15 | README, CHANGELOG | **2.x (Aligned)** |
| digital-workers | 2.1.3 | 29 | 30 | 0.97 | README, CHANGELOG | **2.x (Aligned)** |
| digital-objects | 1.0.0 | 25 | 16 | 1.56 | README, CHANGELOG | **2.x (Upgrade)** |
| ai-evaluate | 2.2.0 | 10 | 17 | 0.59 | README, CHANGELOG | **2.x (Aligned)** |

**Assessment Notes:**
- `ai-database`: Exceptional test coverage (81 tests), comprehensive documentation including testing guide
- `ai-functions`: Core package with extensive evals system, strong integration tests
- `ai-workflows`: Good test coverage including edge cases (race conditions, timer cleanup)
- `digital-workers`: High test coverage for complex scenarios (load balancing, thread safety)
- `digital-objects`: Strong test coverage and documentation, version should be upgraded to 2.x
- `ai-evaluate`: Stable sandbox execution with changelog tracking releases

### Tier 2: Beta (1.x recommended)

These packages have moderate test coverage and stabilizing APIs.

| Package | Current Version | Test Files | Source Files | Test Ratio | Documentation | Recommended |
|---------|-----------------|------------|--------------|------------|---------------|-------------|
| digital-tools | 2.1.3 | 15 | 91 | 0.16 | README, CHANGELOG | **1.x (Downgrade)** |
| digital-products | 2.1.3 | 11 | 21 | 0.52 | README, CHANGELOG | **1.x (Downgrade)** |
| digital-tasks | 2.1.3 | 5 | 8 | 0.63 | README, CHANGELOG | **1.x (Downgrade)** |
| autonomous-agents | 2.1.3 | 8 | 10 | 0.80 | README, CHANGELOG | **1.x (Downgrade)** |
| human-in-the-loop | 2.1.3 | 11 | 13 | 0.85 | README, CHANGELOG | **1.x (Downgrade)** |
| ai-props | 2.1.3 | 10 | 14 | 0.71 | README, CHANGELOG | **1.x (Downgrade)** |
| graphdl | 0.3.0 | 14 | 9 | 1.56 | README, MIGRATION.md | **1.x (Upgrade)** |
| business-as-code | 2.1.3 | 17 | 35 | 0.49 | README, CHANGELOG, IMPLEMENTATION.md | **1.x (Downgrade)** |
| services-as-software | 2.1.3 | 6 | 15 | 0.40 | README, CHANGELOG | **1.x (Downgrade)** |
| ai-primitives | 1.0.0 | 3 | 1 | 3.00 | README | **1.x (Aligned)** |

**Assessment Notes:**
- `digital-tools`: Large codebase (91 files) with relatively few tests, API still evolving
- `digital-products`: Moderate coverage but API surface area suggests beta maturity
- `digital-tasks`: Limited test coverage for task management functionality
- `autonomous-agents`: Good progress but agent APIs typically need more iteration
- `human-in-the-loop`: HITL patterns require more real-world validation
- `ai-props`: Component props system needs more edge case testing
- `graphdl`: Good test coverage, ready for 1.x promotion
- `business-as-code`: Extensive codebase needs more test coverage
- `services-as-software`: Service patterns need more integration testing
- `ai-primitives`: Meta-package that re-exports others, minimal own code

### Tier 3: Experimental/Alpha (0.x recommended)

These packages are in early development or have limited coverage.

| Package | Current Version | Test Files | Source Files | Test Ratio | Documentation | Recommended |
|---------|-----------------|------------|--------------|------------|---------------|-------------|
| org.ai | 0.0.1 | 6 | 10 | 0.60 | README | **0.x (Aligned)** |
| id.org.ai | 0.1.0 | 5 | 2 | 2.50 | README | **0.x (Aligned)** |
| @org.ai/config | 0.0.2 | 0 | 0 | N/A | README, CHANGELOG | **0.x (Aligned)** |
| @org.ai/types | 2.1.3 | 6 | 1 | 6.00 | README, CHANGELOG | **0.x (Downgrade)** |
| language-models | 2.1.3 | 3 | 3 | 1.00 | README, CHANGELOG | **1.x (Downgrade)** |
| ai-providers | 2.1.3 | 6 | 6 | 1.00 | README, CHANGELOG | **1.x (Downgrade)** |
| ai-experiments | 2.1.3 | 4 | 7 | 0.57 | README, CHANGELOG | **0.x (Downgrade)** |
| ai-tests | 2.1.3 | 6 | 7 | 0.86 | README, CHANGELOG | **1.x (Downgrade)** |

**Assessment Notes:**
- `org.ai`: New organizational primitives package, early development
- `id.org.ai`: Identity primitives, APIs not yet stabilized
- `@org.ai/config`: Configuration package, minimal codebase
- `@org.ai/types`: Type definitions only, should track dependent packages
- `language-models`: Model utilities, relatively stable but limited scope
- `ai-providers`: Provider integrations, evolving with upstream SDKs
- `ai-experiments`: Experimentation features, early stage
- `ai-tests`: Test utilities, still evolving API

## Version Alignment Summary

### Packages Currently Aligned

| Package | Current | Recommended | Status |
|---------|---------|-------------|--------|
| ai-database | 2.1.3 | 2.x | Aligned |
| ai-functions | 2.1.3 | 2.x | Aligned |
| ai-workflows | 2.1.3 | 2.x | Aligned |
| digital-workers | 2.1.3 | 2.x | Aligned |
| ai-evaluate | 2.2.0 | 2.x | Aligned |
| ai-primitives | 1.0.0 | 1.x | Aligned |
| org.ai | 0.0.1 | 0.x | Aligned |
| id.org.ai | 0.1.0 | 0.x | Aligned |
| @org.ai/config | 0.0.2 | 0.x | Aligned |

### Packages Needing Upgrade

| Package | Current | Recommended | Action |
|---------|---------|-------------|--------|
| digital-objects | 1.0.0 | 2.x | Upgrade to 2.0.0 |
| graphdl | 0.3.0 | 1.x | Upgrade to 1.0.0 |

### Packages Needing Downgrade

These packages are versioned higher than their maturity warrants:

| Package | Current | Recommended | Action |
|---------|---------|-------------|--------|
| digital-tools | 2.1.3 | 1.x | Downgrade to 1.0.0 |
| digital-products | 2.1.3 | 1.x | Downgrade to 1.0.0 |
| digital-tasks | 2.1.3 | 1.x | Downgrade to 1.0.0 |
| autonomous-agents | 2.1.3 | 1.x | Downgrade to 1.0.0 |
| human-in-the-loop | 2.1.3 | 1.x | Downgrade to 1.0.0 |
| ai-props | 2.1.3 | 1.x | Downgrade to 1.0.0 |
| business-as-code | 2.1.3 | 1.x | Downgrade to 1.0.0 |
| services-as-software | 2.1.3 | 1.x | Downgrade to 1.0.0 |
| @org.ai/types | 2.1.3 | 0.x | Downgrade to 0.1.0 |
| language-models | 2.1.3 | 1.x | Downgrade to 1.0.0 |
| ai-providers | 2.1.3 | 1.x | Downgrade to 1.0.0 |
| ai-experiments | 2.1.3 | 0.x | Downgrade to 0.1.0 |
| ai-tests | 2.1.3 | 1.x | Downgrade to 1.0.0 |

## Recommendations

### Immediate Actions

1. **Do not downgrade in production**: Version downgrades can break dependent projects. Instead, consider this policy for future releases.

2. **Document breaking changes**: When making significant API changes, increment the major version appropriately.

3. **Establish promotion criteria**: Define clear gates for moving from 0.x to 1.x to 2.x:
   - 0.x -> 1.x: Minimum 50% test ratio, README with examples, stable core API
   - 1.x -> 2.x: Minimum 80% test ratio, comprehensive CHANGELOG, API unchanged for 3+ minor releases

### Long-term Strategy

1. **Freeze 2.x versions**: Packages currently at 2.x should only increment patch/minor for stability.

2. **Promote ready packages**: `digital-objects` and `graphdl` should be promoted based on their maturity.

3. **Focus testing efforts**: Prioritize test coverage for packages with low test ratios that are widely depended upon.

4. **Sync version bumps**: Consider coordinating version bumps across the monorepo to maintain consistency.

## Dependency Graph Impact

When adjusting versions, consider these dependency chains:

```
ai-primitives (meta)
  -> ai-functions (core)
     -> ai-providers
     -> language-models
     -> digital-objects
  -> digital-workers
     -> ai-workflows
     -> org.ai
  -> autonomous-agents
     -> digital-workers
  -> human-in-the-loop
     -> digital-workers
```

Core packages (`ai-functions`, `ai-workflows`, `digital-workers`) should remain at 2.x to not break downstream consumers.

---

*Last updated: 2026-02-01*
*Issue: aip-tj8b*
