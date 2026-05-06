/**
 * Tutorial Author Service — pure-autonomous catalog Service that turns a
 * feature doc into an end-to-end runnable tutorial published with prose +
 * validated code samples.
 *
 * Demonstrates: composite pricing (one-time per-tutorial base + metered
 * per-validated-step overage), `multi-step-research` archetype, fully
 * autonomous cascade (zero Human Functions, zero clarification round-trips —
 * the `identify-prereqs` Agentic step is already promoted to `autonomous`),
 * sandbox-execution-driven retry trigger (`run-validate.exit_code !== 0`
 * routes back to `write-runnable-code` so a failed run regenerates the code
 * automatically), EvaluatorPanel of 3 personas (100% feature-coverage /
 * code-correctness / tutorial-style-voice) under `all-approve`, AND-composed
 * OutcomeContract predicate (SchemaMatch + EvaluatorPass + External sandbox
 * verifier confirming exit_code 0) with a 2-day `timeoutDays`.
 *
 * Sibling to `migration-guide-writer` + `changelog-generator` — same
 * pure-autonomous DX-catalog shape, different cascade depth: where
 * `migration-guide-writer` produces upgrade transformations, this Service
 * produces an executable narrative — every code block actually runs in a
 * sandbox before publish, and a failed run loops back to code-writing
 * rather than escalating.
 *
 * Per design v3 §3 (Catalog HOW agent: Tutorial Author worked example) +
 * §6 (binding triggers — `route-to write-runnable-code` on sandbox failure)
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
 * Supported tutorial languages. Mirrors the SDK-generator seed — same five
 * targets so a feature documented here can hand off to a generated SDK.
 */
export const TutorialLanguageSchema = z.enum(['typescript', 'python', 'go', 'rust', 'java'])
export type TutorialLanguage = z.infer<typeof TutorialLanguageSchema>

/**
 * Input — a feature doc reference + the repo it lives in + the target
 * tutorial language. The optional `sandboxConfig` object passes through to
 * the `run-validate` Code step as a pre-baked sandbox image / env-var bag
 * (e.g. `{ image: 'node:20', env: { API_KEY: '…' } }`); when absent the
 * step uses the default per-language sandbox.
 */
export const FeatureDocInputSchema = z.object({
  featureDocRef: z.string(),
  repoRef: z
    .string()
    .regex(
      /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?$/,
      'repoRef must be a github.com repository URL'
    ),
  language: TutorialLanguageSchema,
  sandboxConfig: z.record(z.unknown()).optional(),
})

/**
 * Output — a published runnable tutorial. The published tutorial URL
 * (GitHub Pages), an ordered array of steps (each with id + title + code
 * snippet + prose explanation + validated flag — every `validated: true`
 * step actually executed in the sandbox with exit_code 0), the total step
 * count (drives the metered-pricing line), and the publish timestamp.
 */
export const PublishedTutorialOutputSchema = z.object({
  tutorialUrl: z.string(),
  steps: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      code: z.string(),
      prose: z.string(),
      validated: z.boolean(),
    })
  ),
  totalSteps: z.number().int().nonnegative(),
  publishedAt: z.string(), // ISO-8601
})

export type FeatureDocInput = z.infer<typeof FeatureDocInputSchema>
export type PublishedTutorialOutput = z.infer<typeof PublishedTutorialOutputSchema>

// ============================================================================
// RewardSignal placeholder — single Service-level reward (tutorial completion
// rate → Adoption / Activation). TODO: replace with real $.Reward references
// when business-as-code KR primitive lands.
// ============================================================================

const kr_tutorialCompletionRate: RewardSignal = {
  keyResultRef: 'kr:tutorial-author:tutorial-completion-rate',
}

// ============================================================================
// Tutorial Author Service
// ============================================================================

/**
 * Tutorial Author — feature doc in, end-to-end runnable tutorial published
 * to GitHub Pages out.
 *
 * Cascade: parse-feature-doc (Code, markdown / mdx parse)
 *        → identify-prereqs (Agentic, autonomous — already promoted;
 *          extracts the dependency / setup graph the tutorial assumes)
 *        → outline-tutorial (Generative, ordered step skeleton)
 *        → write-runnable-code (Generative, per-step code blocks)
 *        → run-validate (Code, sandbox.execute — actually runs every code
 *          block in an isolated sandbox)
 *        → write-prose (Generative, narrative around each validated block)
 *        → publish (Code, github.pages publish).
 *
 * Pure-autonomous: no Human Functions, `clarificationPolicy.enabled: false`,
 * `iterationPolicy.onMaxRoundsExceeded: 'auto-fail'` (no human escalation
 * on quality issues). The single trigger routes a failed sandbox run
 * (`exit_code !== 0`) back to `write-runnable-code` so the cascade
 * regenerates the offending block instead of escalating — bounded by
 * `iterationPolicy.maxRounds`.
 */
export const tutorialAuthor: ServiceInstance<FeatureDocInput, PublishedTutorialOutput> =
  Service.define<FeatureDocInput, PublishedTutorialOutput>({
    name: 'Tutorial Author',
    promise: 'Feature doc → end-to-end runnable tutorial → published',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: FeatureDocInputSchema, output: PublishedTutorialOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'parse-feature-doc',
          reward: kr_tutorialCompletionRate,
          handler: () => undefined,
        }),
        Agentic({
          name: 'identify-prereqs',
          reward: kr_tutorialCompletionRate,
          mode: 'autonomous',
          oversight: { mode: 'autonomous' },
          signOff: 'none',
        }),
        Generative({ name: 'outline-tutorial', reward: kr_tutorialCompletionRate }),
        Generative({ name: 'write-runnable-code', reward: kr_tutorialCompletionRate }),
        Code({
          name: 'run-validate',
          reward: kr_tutorialCompletionRate,
          handler: () => undefined,
        }),
        Generative({ name: 'write-prose', reward: kr_tutorialCompletionRate }),
        Code({ name: 'publish', reward: kr_tutorialCompletionRate, handler: () => undefined }),
      ],
      // sandbox.execute lets `run-validate` actually execute the tutorial
      // code in an isolated environment; docker.run is the substrate the
      // sandbox runs on; github.repos + github.pages handle source pull +
      // published-site hosting.
      toolPermissions: ['github.repos', 'github.pages', 'docker.run', 'sandbox.execute'],
      // Pure-autonomous: no human in the loop on the happy path. Spec
      // ambiguities or unrunnable code paths auto-fail rather than pause
      // for a clarification round-trip.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Sandbox failure → route back to write-runnable-code so the
          // cascade regenerates the failing block. Bounded by the panel's
          // iterationPolicy.maxRounds; on max-rounds the service auto-fails.
          when: 'run-validate.exit_code !== 0',
          action: 'route-to',
          target: 'write-runnable-code',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:tutorial-author-review',
      personas: [
        // Coverage pedant — every feature surfaced in the source doc must
        // be represented by at least one tutorial step (100% — a missed
        // feature defeats the point of the tutorial).
        Personas.coverage({ minPercent: 1.0, name: 'feature-coverage' }),
        // Code-correctness reviewer — fact-grounds each generated code
        // block against the source feature doc + the SDK / API surface
        // it's exercising; rejects blocks that compile but misuse the
        // primitive.
        Personas.accuracy({ domain: 'code-correctness', name: 'code-correctness-checker' }),
        // Voice reviewer — checks the prose matches the tutorial brand
        // voice (welcoming, second-person, "you'll do X next" — distinct
        // from the migration-guide / changelog voices).
        Personas.voice({ brandVoiceRef: 'tutorial-style-guide', name: 'voice-reviewer' }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'auto-fail' },
    }),

    outcomeContract: {
      $id: 'oc:tutorial-author:v1',
      $type: 'OutcomeContract',
      buyer: 'role:devrel-lead',
      seller: 'svc:tutorial-author',
      serviceRef: 'svc:tutorial-author',
      // AND(schema, panel, external): output validates, panel approves, AND
      // the sandbox confirms the tutorial code actually ran (exit_code 0).
      // The external check pins the outcome to a verifiable execution —
      // a tutorial that doesn't run isn't a tutorial.
      predicate: AND(
        SchemaMatch(PublishedTutorialOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        External({ verifier: 'sandbox', spec: { code_runs: true, exit_code: 0 } })
      ),
      amount: { amount: 7500n, currency: 'USD' },
      // 2-day SLA — outline + per-step code-gen + per-step sandbox run +
      // per-step prose + publish takes more than a day of wall clock for
      // a typical 6-12 step tutorial.
      timeoutDays: 2,
      onTimeout: 'escalate',
    },

    pricing: Pricing.composite({
      base: { id: 'tutorial', amount: 7500n, description: 'one-time per tutorial' },
      metered: [
        {
          event: 'tutorial-step-validated',
          amount: 50n,
          description: '$0.50 per validated step',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'self-only',
    costModel: { perInvocation: 300n, perUnit: 10n },
    reward: kr_tutorialCompletionRate,

    lineage: {
      cellRef: 'business.org.ai/cells/technical-writers/tutorial-authoring',
      icpContextProblemRef: 'icp:tutorial-author:v1',
      foundingHypothesisRef: 'fh:tutorial-author:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
