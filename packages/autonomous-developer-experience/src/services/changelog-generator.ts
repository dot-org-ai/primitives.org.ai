/**
 * Changelog Generator Service — pure-autonomous catalog Service that turns a
 * git-history range into a categorized, customer-facing changelog and
 * publishes it as a GitHub Release.
 *
 * Demonstrates: composite pricing (one-time per-release base + metered
 * per-categorized-commit overage), `multi-step-research` archetype, fully
 * autonomous cascade (zero Human Functions, zero clarification round-trips —
 * the categorize + group-by-feature-area Agentic steps are already promoted
 * to `autonomous`), EvaluatorPanel of 3 personas (commit-coverage / brand-
 * voice / breaking-change-skeptic) under `all-approve`, AND-composed
 * OutcomeContract predicate (SchemaMatch + EvaluatorPass + External
 * github-releases verifier) with a 1-day `timeoutDays`.
 *
 * Sibling to `api-docs-writer` — same pure-autonomous shape (no Human
 * Functions, `clarificationPolicy.enabled: false`, `auto-fail` on
 * max-rounds), different cascade (history-range → categorized release notes
 * vs. repo → per-symbol API docs).
 *
 * Per design v3 §3 (Catalog HOW agent: Changelog Generator worked example) +
 * §6 (binding, no triggers needed for the autonomous-pass path) + §7
 * (composite pricing factory) + §8 (ProofPredicate AND with External) +
 * round-6 cleanups (`{ enabled: false }` clarification form, Pricing
 * factory call, Personas `name` overrides, `timeoutDays`).
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
 * Input — a git-history range. Tight: the repository ref + a `from`/`to`
 * pair (commit shas, tags, or branch names — opaque to the Service; the
 * `fetch-commits` Code step resolves them via the GitHub API). The optional
 * `includeAuthor` flag toggles per-entry author attribution in the
 * customer-facing changelog (off by default — most product changelogs omit
 * authors).
 */
export const GitRangeInputSchema = z.object({
  repoRef: z
    .string()
    .regex(
      /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?$/,
      'repoRef must be a github.com repository URL'
    ),
  fromRef: z.string(),
  toRef: z.string(),
  includeAuthor: z.boolean().optional(),
})

/**
 * Output — a published changelog. The released-notes URL, the categorized
 * sections (each holding a `title` like `"Features"` / `"Bug Fixes"` /
 * `"Breaking Changes"` and an array of per-commit entries), the count of
 * breaking-change entries (used by the breaking-change-checker persona +
 * surfaced in upgrade-guidance UI), and the publish timestamp.
 */
export const ChangelogOutputSchema = z.object({
  releaseUrl: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      entries: z.array(
        z.object({
          commitSha: z.string(),
          description: z.string(),
          isBreaking: z.boolean(),
          areas: z.array(z.string()),
        })
      ),
    })
  ),
  breakingChangesCount: z.number().int().nonnegative(),
  publishedAt: z.string(),
})

export type GitRangeInput = z.infer<typeof GitRangeInputSchema>
export type ChangelogOutput = z.infer<typeof ChangelogOutputSchema>

// ============================================================================
// RewardSignal placeholder — single Service-level reward (changelog readership
// → Adoption). TODO: replace with real $.Reward references when business-as-
// code KR primitive lands.
// ============================================================================

const kr_changelogReadership: RewardSignal = {
  keyResultRef: 'kr:changelog-generator:changelog-readership',
}

// ============================================================================
// Changelog Generator Service
// ============================================================================

/**
 * Changelog Generator — git-range in, customer-facing changelog published to
 * GitHub Releases out.
 *
 * Cascade: fetch-commits (Code, github API)
 *        → categorize (Agentic, autonomous — already promoted)
 *        → group-by-feature-area (Agentic, autonomous — already promoted)
 *        → write-customer-facing (Generative)
 *        → publish (Code, calls $.api.github.releases).
 *
 * Pure-autonomous: no Human Functions, `clarificationPolicy.enabled: false`,
 * `iterationPolicy.onMaxRoundsExceeded: 'auto-fail'` (no human escalation).
 */
export const changelogGenerator: ServiceInstance<GitRangeInput, ChangelogOutput> = Service.define<
  GitRangeInput,
  ChangelogOutput
>({
  name: 'Changelog Generator',
  promise: 'Git history range → categorized customer-facing changelog → published',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: GitRangeInputSchema, output: ChangelogOutputSchema },

  binding: {
    cascade: [
      Code({ name: 'fetch-commits', reward: kr_changelogReadership, handler: () => undefined }),
      Agentic({
        name: 'categorize',
        reward: kr_changelogReadership,
        mode: 'autonomous',
        oversight: { mode: 'autonomous' },
        signOff: 'none',
      }),
      Agentic({
        name: 'group-by-feature-area',
        reward: kr_changelogReadership,
        mode: 'autonomous',
        oversight: { mode: 'autonomous' },
        signOff: 'none',
      }),
      Generative({ name: 'write-customer-facing', reward: kr_changelogReadership }),
      Code({ name: 'publish', reward: kr_changelogReadership, handler: () => undefined }),
    ],
    toolPermissions: ['github.repos', 'github.commits', 'github.pulls', 'github.releases'],
    clarificationPolicy: { enabled: false },
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:changelog-generator-review',
    personas: [
      // Coverage pedant — every commit in the range must end up in some
      // section (≥ 95%). Misses suggest categorize / group-by-feature-area
      // dropped a commit; reject and re-run.
      Personas.coverage({ minPercent: 0.95, name: 'commit-coverage' }),
      // Voice reviewer — checks the customer-facing copy matches the
      // changelog brand-voice guide (concise, customer-impact-first).
      Personas.voice({ brandVoiceRef: 'changelog-style-guide', name: 'voice-reviewer' }),
      // Breaking-change skeptic — adversarially probes for breaking
      // changes that were missed (or under-flagged) by the categorize
      // step. A single missed breaking change is worth blocking the
      // entire changelog.
      Personas.skeptic({ domain: 'breaking-change-flagging', name: 'breaking-change-checker' }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'auto-fail' },
  }),

  outcomeContract: {
    $id: 'oc:changelog-generator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:repo-maintainer',
    seller: 'svc:changelog-generator',
    serviceRef: 'svc:changelog-generator',
    // AND(schema, panel, external): output validates, panel approves, AND
    // GitHub confirms the release was actually published. The external
    // check pins the outcome to a verifiable side-effect.
    predicate: AND(
      SchemaMatch(ChangelogOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      External({ verifier: 'github-releases', spec: { published: true } })
    ),
    amount: { amount: 5000n, currency: 'USD' },
    // 1-day SLA — release notes are time-sensitive (ship the changelog
    // alongside the release, not a week later).
    timeoutDays: 1,
    onTimeout: 'auto-cancel',
  },

  pricing: Pricing.composite({
    base: { id: 'release', amount: 5000n, description: 'one-time per release' },
    metered: [
      { event: 'commit-categorized', amount: 2n, description: '$0.02 per categorized commit' },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'self-only',
  costModel: { perInvocation: 150n, perUnit: 1n },
  reward: kr_changelogReadership,

  lineage: {
    cellRef: 'business.org.ai/cells/technical-writers/changelog-authoring',
    icpContextProblemRef: 'icp:changelog-generator:v1',
    foundingHypothesisRef: 'fh:changelog-generator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
