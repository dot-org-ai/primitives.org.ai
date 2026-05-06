/**
 * Example Suite Builder Service — pure-autonomous catalog Service that takes
 * a repository + an examples directory and produces a maintained suite of
 * runnable example apps with their own CI matrix.
 *
 * Demonstrates: composite pricing (one-time per-suite base + metered
 * per-published-example-app overage), `transactional-workflow` archetype,
 * fully autonomous cascade (zero Human Functions, zero clarification
 * round-trips — the `discover-features` Agentic step is already promoted
 * to `autonomous`), `escalate`-on-trigger gate (>50 features signals
 * "this is too much surface area to auto-generate" — escalates instead of
 * publishing dozens of low-signal examples), EvaluatorPanel of 3 personas
 * (95% feature-coverage / example-correctness / runnability-skeptic) under
 * `all-approve`, AND-composed OutcomeContract predicate (SchemaMatch +
 * EvaluatorPass + External github-actions verifier confirming all examples
 * green) with a 3-day `timeoutDays`.
 *
 * Sibling to `tutorial-author` — same pure-autonomous DX-catalog shape,
 * different cascade focus: where `tutorial-author` produces a single
 * narrative end-to-end, this Service produces N independent example apps
 * each with its own CI matrix; the publish gate is "all examples green
 * in github-actions" rather than "tutorial code runs in sandbox".
 *
 * Per design v3 §3 (Catalog HOW agent: Example Suite Builder worked
 * example) + §6 (binding triggers — `escalate` on feature-count threshold)
 * + §7 (composite pricing factory) + §8 (ProofPredicate AND with External)
 * + round-6 cleanups (`{ enabled: false }` clarification form, Pricing
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
 * Supported example languages — same seed as `tutorial-author` /
 * `sdk-generator`. The cascade emits one example app per (feature ×
 * language) pair, capped by the optional `exampleCount`.
 */
export const ExampleLanguageSchema = z.enum(['typescript', 'python', 'go', 'rust', 'java'])
export type ExampleLanguage = z.infer<typeof ExampleLanguageSchema>

/**
 * CI status for a single published example app. Mirrors the github-actions
 * conclusion vocabulary: `passing` = green run, `failing` = red, `skipped`
 * = the example was scaffolded but not exercised this round (e.g. a
 * language target with no runtime in the matrix).
 */
export const ExampleCiStatusSchema = z.enum(['passing', 'failing', 'skipped'])
export type ExampleCiStatus = z.infer<typeof ExampleCiStatusSchema>

/**
 * Input — a repo + an optional branch + an optional cap on example count
 * + the languages to generate examples in. The `branchRef` defaults to the
 * repo's default branch when absent. The `exampleCount` cap is a soft hint
 * to the discover-features step; the hard gate is the >50-features
 * `escalate` trigger below.
 */
export const RepoExamplesInputSchema = z.object({
  repoRef: z
    .string()
    .regex(
      /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?$/,
      'repoRef must be a github.com repository URL'
    ),
  branchRef: z.string().optional(),
  exampleCount: z.number().int().positive().optional(),
  languages: z.array(ExampleLanguageSchema).nonempty(),
})

/**
 * Output — a published example suite. The examples-repo URL (typically a
 * sibling repo or a `/examples` subtree), one entry per published example
 * app (with name + language + code URL + CI conclusion), the total app
 * count (drives the metered-pricing line), and the publish timestamp.
 */
export const PublishedExamplesOutputSchema = z.object({
  examplesRepoUrl: z.string(),
  exampleApps: z.array(
    z.object({
      name: z.string(),
      language: ExampleLanguageSchema,
      codeUrl: z.string(),
      ciStatus: ExampleCiStatusSchema,
    })
  ),
  totalApps: z.number().int().nonnegative(),
  publishedAt: z.string(), // ISO-8601
})

export type RepoExamplesInput = z.infer<typeof RepoExamplesInputSchema>
export type PublishedExamplesOutput = z.infer<typeof PublishedExamplesOutputSchema>

// ============================================================================
// RewardSignal placeholder — single Service-level reward (example-suite
// adoption → Adoption / Activation). TODO: replace with real $.Reward
// references when business-as-code KR primitive lands.
// ============================================================================

const kr_exampleSuiteAdoption: RewardSignal = {
  keyResultRef: 'kr:example-suite-builder:example-suite-adoption',
}

// ============================================================================
// Example Suite Builder Service
// ============================================================================

/**
 * Example Suite Builder — repo + examples directory in, maintained example
 * apps with CI out.
 *
 * Cascade: clone (Code, git clone)
 *        → discover-features (Agentic, autonomous — already promoted;
 *          walks the repo + its public surface to enumerate the features
 *          worth an example)
 *        → generate-example-apps (Generative, one app per feature × language)
 *        → write-readmes (Generative, per-app README.md)
 *        → setup-ci (Code, github.actions workflow scaffold)
 *        → publish (Code, github.repos + github.pages publish).
 *
 * Pure-autonomous: no Human Functions, `clarificationPolicy.enabled: false`,
 * `iterationPolicy.onMaxRoundsExceeded: 'auto-fail'` (no human escalation
 * on quality issues). The single trigger flips to `escalate` when the
 * discovered-feature count exceeds 50 — at that threshold the suite would
 * balloon into dozens of low-signal examples, so a human picks the
 * priority slice instead of auto-publishing the long tail.
 */
export const exampleSuiteBuilder: ServiceInstance<RepoExamplesInput, PublishedExamplesOutput> =
  Service.define<RepoExamplesInput, PublishedExamplesOutput>({
    name: 'Example Suite Builder',
    promise: 'Repo + examples directory → maintained example apps with CI',
    audience: 'business',
    archetype: 'transactional-workflow',
    schema: { input: RepoExamplesInputSchema, output: PublishedExamplesOutputSchema },

    binding: {
      cascade: [
        Code({ name: 'clone', reward: kr_exampleSuiteAdoption, handler: () => undefined }),
        Agentic({
          name: 'discover-features',
          reward: kr_exampleSuiteAdoption,
          mode: 'autonomous',
          oversight: { mode: 'autonomous' },
          signOff: 'none',
        }),
        Generative({ name: 'generate-example-apps', reward: kr_exampleSuiteAdoption }),
        Generative({ name: 'write-readmes', reward: kr_exampleSuiteAdoption }),
        Code({ name: 'setup-ci', reward: kr_exampleSuiteAdoption, handler: () => undefined }),
        Code({ name: 'publish', reward: kr_exampleSuiteAdoption, handler: () => undefined }),
      ],
      // docker.build supports the per-example container baseline used by
      // the github-actions matrix; github.actions / github.pages handle
      // CI + hosting; github.repos pulls source + writes back the
      // examples subtree.
      toolPermissions: ['github.repos', 'github.actions', 'github.pages', 'docker.build'],
      // Pure-autonomous: no human in the loop on the happy path. Spec
      // ambiguities auto-fail rather than pause for a clarification
      // round-trip.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // >50 discovered features signals "too much surface area to
          // auto-generate sensibly" — escalate so a human picks the
          // priority slice instead of letting the cascade publish
          // dozens of low-signal examples.
          when: 'feature.count > 50',
          action: 'escalate',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:example-suite-builder-review',
      personas: [
        // Coverage pedant — at least 95% of discovered features must be
        // represented by an example app. The 5% slack covers features
        // that are intentionally skipped (deprecated, internal, etc.)
        // without forcing the panel to enumerate every exclusion.
        Personas.coverage({ minPercent: 0.95, name: 'feature-coverage' }),
        // Example-correctness reviewer — fact-grounds each generated app
        // against the feature it's exercising; rejects apps that compile
        // but misuse the primitive (the example-suite analog of the
        // tutorial code-correctness checker).
        Personas.accuracy({ domain: 'example-correctness', name: 'correctness-checker' }),
        // Runnability skeptic — adversarially probes for examples that
        // look right but fail to actually run end-to-end (missing env
        // var, broken peer dep, registry-publish-blocking name). A
        // single broken example degrades trust in the whole suite.
        Personas.skeptic({ domain: 'example-runnability', name: 'runnability-skeptic' }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'auto-fail' },
    }),

    outcomeContract: {
      $id: 'oc:example-suite-builder:v1',
      $type: 'OutcomeContract',
      buyer: 'role:devrel-lead',
      seller: 'svc:example-suite-builder',
      serviceRef: 'svc:example-suite-builder',
      // AND(schema, panel, external): output validates, panel approves, AND
      // github-actions confirms every example app is passing. The external
      // check pins the outcome to a verifiable CI signal — a "maintained
      // example suite" with red CI isn't maintained.
      predicate: AND(
        SchemaMatch(PublishedExamplesOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        External({ verifier: 'github-actions', spec: { all_examples_passing: true } })
      ),
      amount: { amount: 15000n, currency: 'USD' },
      // 3-day SLA — discover + per-app generate + per-app readme + per-app
      // CI scaffold + per-app green run takes more wall clock than the
      // single-narrative tutorial path; 3 days covers a typical 10-30
      // example suite.
      timeoutDays: 3,
      onTimeout: 'escalate',
    },

    pricing: Pricing.composite({
      base: { id: 'suite', amount: 15000n, description: 'one-time per example suite' },
      metered: [
        {
          event: 'example-app-published',
          amount: 500n,
          description: '$5 per published example app',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'self-only',
    costModel: { perInvocation: 600n, perUnit: 25n },
    reward: kr_exampleSuiteAdoption,

    lineage: {
      cellRef: 'business.org.ai/cells/technical-writers/example-suite-curation',
      icpContextProblemRef: 'icp:example-suite-builder:v1',
      foundingHypothesisRef: 'fh:example-suite-builder:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
