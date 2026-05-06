/**
 * Migration Guide Writer Service — pure-autonomous catalog Service that turns
 * a `(packageName, fromVersion, toVersion)` tuple into a published migration
 * guide with code transformations (codemods) for every breaking change.
 *
 * Demonstrates: composite pricing (one-time per-version-pair base + metered
 * per-breaking-change overage), `multi-step-research` archetype, fully
 * autonomous cascade (zero Human Functions, zero clarification round-trips —
 * the `categorize-breaking-changes` Agentic step is already promoted to
 * `autonomous`), `escalate`-on-trigger gate (>10 breaking changes signals
 * "needs human eyes" — escalates instead of auto-publishing), EvaluatorPanel
 * of 3 personas (100% breaking-change coverage / codemod-correctness /
 * docs-style-voice) under `all-approve`, AND-composed OutcomeContract
 * predicate (SchemaMatch + EvaluatorPass + External github-pages verifier)
 * with a 2-day `timeoutDays`.
 *
 * Sibling to `changelog-generator` + `sdk-generator` — same DX-catalog
 * shape, different cascade depth: where `changelog-generator` summarizes
 * commit history, this Service produces actionable upgrade transformations.
 *
 * Per design v3 §3 (Catalog HOW agent: Migration Guide Writer worked
 * example) + §6 (binding triggers — `escalate` on breaking-change-count
 * threshold) + §7 (composite pricing factory) + §8 (ProofPredicate AND with
 * External) + round-6 cleanups (`{ enabled: false }` clarification form,
 * Pricing factory call, Personas `name` overrides, `timeoutDays`).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, External, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Severity of a single breaking change. `low` = source-compatible runtime
 * shift; `medium` = signature change covered by a codemod; `high` =
 * architectural / hand-edit required.
 */
export const BreakingChangeSeveritySchema = z.enum(['low', 'medium', 'high'])
export type BreakingChangeSeverity = z.infer<typeof BreakingChangeSeveritySchema>

/**
 * Input — a version pair: the npm package name + its from/to versions, plus
 * the GitHub repo ref the `fetch-versions` Code step pulls release tags +
 * compares from. The `fromVersion` and `toVersion` are opaque semver strings
 * — the `diff-api` Code step resolves them to AST diffs.
 */
export const VersionPairInputSchema = z.object({
  packageName: z.string(),
  fromVersion: z.string(),
  toVersion: z.string(),
  repoRef: z
    .string()
    .regex(
      /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?$/,
      'repoRef must be a github.com repository URL'
    ),
})

/**
 * Output — a published migration guide. The published guide URL (GitHub
 * Pages), an array of breaking-change records (each with id + title +
 * description + optional codemod snippet + severity), and the publish
 * timestamp. The `breakingChanges` array drives both the metered-pricing
 * line and the panel's coverage check (every diff entry must be covered).
 */
export const MigrationGuideOutputSchema = z.object({
  packageName: z.string(),
  guideUrl: z.string(),
  breakingChanges: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      codemodSnippet: z.string().optional(),
      severity: BreakingChangeSeveritySchema,
    })
  ),
  publishedAt: z.string(), // ISO-8601
})

export type VersionPairInput = z.infer<typeof VersionPairInputSchema>
export type MigrationGuideOutput = z.infer<typeof MigrationGuideOutputSchema>

// ============================================================================
// RewardSignal placeholder — single Service-level reward (migration-guide
// utilization → Adoption / Migration Velocity). TODO: replace with real
// $.Reward references when business-as-code KR primitive lands.
// ============================================================================

const kr_migrationGuideUtilization: RewardSignal = {
  keyResultRef: 'kr:migration-guide-writer:migration-guide-utilization',
}

// ============================================================================
// Migration Guide Writer Service
// ============================================================================

/**
 * Migration Guide Writer — version diff in, migration guide with code
 * transformations published to GitHub Pages out.
 *
 * Cascade: fetch-versions (Code, github + npm registry pulls)
 *        → diff-api (Code, AST + signature diff)
 *        → categorize-breaking-changes (Agentic, autonomous — already
 *          promoted; classifies each diff entry into low/medium/high
 *          severity buckets)
 *        → write-guide (Generative, docs-style-voice prose for each
 *          breaking change)
 *        → write-codemod (Generative, executable jscodeshift / ts-morph
 *          transform per medium-severity entry)
 *        → publish (Code, github.pages publish).
 *
 * Pure-autonomous: no Human Functions, `clarificationPolicy.enabled: false`,
 * `iterationPolicy.onMaxRoundsExceeded: 'auto-fail'` (no human escalation
 * on quality issues). The single trigger flips to `escalate` when the
 * breaking-change count exceeds 10 — at that threshold the guide is large
 * enough to deserve a human reviewer regardless of panel sign-off.
 */
export const migrationGuideWriter: ServiceInstance<VersionPairInput, MigrationGuideOutput> =
  Service.define<VersionPairInput, MigrationGuideOutput>({
    name: 'Migration Guide Writer',
    promise: 'Version diff → migration guide with code transformations → published',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: VersionPairInputSchema, output: MigrationGuideOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-versions',
          reward: kr_migrationGuideUtilization,
          handler: () => undefined,
        }),
        Code({ name: 'diff-api', reward: kr_migrationGuideUtilization, handler: () => undefined }),
        Agentic({
          name: 'categorize-breaking-changes',
          reward: kr_migrationGuideUtilization,
          mode: 'autonomous',
          oversight: { mode: 'autonomous' },
          signOff: 'none',
        }),
        Generative({ name: 'write-guide', reward: kr_migrationGuideUtilization }),
        Generative({ name: 'write-codemod', reward: kr_migrationGuideUtilization }),
        Code({ name: 'publish', reward: kr_migrationGuideUtilization, handler: () => undefined }),
      ],
      toolPermissions: ['github.repos', 'github.releases', 'npm.registry', 'github.pages'],
      // Pure-autonomous: no human in the loop on the happy path. Spec
      // ambiguities or unresolved diffs auto-fail rather than pause for
      // a clarification round-trip — the next-round iteration starts from
      // a fresh version pair.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // >10 breaking changes signals a major / multi-major version jump
          // — too risky to auto-publish, escalate for human review.
          when: 'breaking_changes.count > 10',
          action: 'escalate',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:migration-guide-writer-review',
      personas: [
        // Coverage pedant — every breaking change in the diff must be
        // covered by an entry in the published guide (100% — no missing
        // breaking changes; a missed breaking change is a silent footgun).
        Personas.coverage({ minPercent: 1.0, name: 'breaking-change-coverage' }),
        // Codemod correctness — fact-grounds each generated codemod
        // against the AST diff it's derived from; rejects any codemod
        // that doesn't faithfully transform the from-shape into the
        // to-shape.
        Personas.accuracy({ domain: 'codemod-correctness', name: 'codemod-checker' }),
        // Voice reviewer — checks the prose matches the docs-style brand
        // voice (clear, direct, no marketing fluff in upgrade guides).
        Personas.voice({ brandVoiceRef: 'docs-style-guide', name: 'voice-reviewer' }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'auto-fail' },
    }),

    outcomeContract: {
      $id: 'oc:migration-guide-writer:v1',
      $type: 'OutcomeContract',
      buyer: 'role:repo-maintainer',
      seller: 'svc:migration-guide-writer',
      serviceRef: 'svc:migration-guide-writer',
      // AND(schema, panel, external): output validates, panel approves, AND
      // GitHub Pages confirms the guide was actually deployed. The external
      // check pins the outcome to a verifiable side-effect.
      predicate: AND(
        SchemaMatch(MigrationGuideOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        External({ verifier: 'github-pages', spec: { deployed: true } })
      ),
      amount: { amount: 7500n, currency: 'USD' },
      // 2-day SLA — diff + categorize + per-change prose + per-change
      // codemod + publish takes more than a day of wall clock for a
      // typical 5-10 breaking-change version pair.
      timeoutDays: 2,
      onTimeout: 'escalate',
    },

    pricing: Pricing.composite({
      base: { id: 'version-pair', amount: 7500n, description: 'one-time per version pair' },
      metered: [
        {
          event: 'breaking-change-documented',
          amount: 25n,
          description: '$0.25 per documented breaking change',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'self-only',
    costModel: { perInvocation: 200n, perUnit: 5n },
    reward: kr_migrationGuideUtilization,

    lineage: {
      cellRef: 'business.org.ai/cells/technical-writers/migration-guide-authoring',
      icpContextProblemRef: 'icp:migration-guide-writer:v1',
      foundingHypothesisRef: 'fh:migration-guide-writer:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
