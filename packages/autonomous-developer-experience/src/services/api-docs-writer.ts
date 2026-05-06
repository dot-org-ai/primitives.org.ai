/**
 * API Docs Writer Service — pure-autonomous proof-of-life for the v3 Service
 * primitives.
 *
 * Demonstrates: composite pricing (one-time per-repo base + metered per-symbol
 * overage), multi-step-research archetype, fully autonomous cascade (zero
 * Human Functions, zero clarification round-trips), EvaluatorPanel of 3
 * personas (coverage / accuracy / voice) with `auto-fail` (no human
 * escalation) on max-rounds, AND-composed OutcomeContract predicate
 * (SchemaMatch + EvaluatorPass + External github-pages verifier).
 *
 * Per design v3 §3 (Catalog HOW agent: API Docs Writer worked example) +
 * §6 (binding, no triggers needed) + §7 (composite pricing factory) + §8
 * (ProofPredicate AND with External).
 *
 * Sibling to `autonomous-finance-services/bookkeeper`. Same packaging
 * tradeoff (catalog Service depending on services-as-software L5 from a
 * package that lives outside the strict L5 cone — see v3 §12).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, External, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — repository intake. Tight: a github.com repo URL + branch + optional
 * language hint + publish target. The cascade clones the repo, parses the
 * symbol surface, describes each symbol, cross-links references, and
 * publishes to the chosen target.
 */
export const RepoIntakeSchema = z.object({
  repoRef: z
    .string()
    .regex(
      /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?$/,
      'repoRef must be a github.com repository URL'
    ),
  branch: z.string().default('main'),
  language: z.enum(['typescript', 'python', 'go', 'rust', 'java']).optional(),
  publishTarget: z.enum(['github-pages']).default('github-pages'),
})

/**
 * Output — published API reference docs. 4 fields cover the published URL,
 * the per-symbol API surface (with cross-links), the coverage stats used
 * by the metered billing event + the coverage evaluator persona, and the
 * publish timestamp.
 */
export const PublishedDocsSchema = z.object({
  docsUrl: z.string(),
  apiSurface: z.array(
    z.object({
      symbol: z.string(),
      kind: z.enum(['function', 'class', 'type', 'endpoint']),
      signature: z.string(),
      description: z.string(),
      examples: z.array(z.string()),
      crossLinks: z.array(z.string()),
    })
  ),
  coverage: z.object({
    documented: z.number(),
    total: z.number(),
    pct: z.number(),
  }),
  publishedAt: z.string(),
})

export type RepoIntake = z.infer<typeof RepoIntakeSchema>
export type PublishedDocs = z.infer<typeof PublishedDocsSchema>

// ============================================================================
// RewardSignal placeholder — single Service-level reward (user-thumbs-up rate
// → Growth). TODO: replace with real $.Reward references when business-as-code
// KR primitive lands.
// ============================================================================

const kr_thumbsUp: RewardSignal = { keyResultRef: 'kr:api-docs-writer:user-thumbs-up' }

// ============================================================================
// API Docs Writer Service
// ============================================================================

/**
 * API Docs Writer — repo URL → typed reference docs published to GitHub Pages.
 *
 * Cascade: clone (Code) → extract-surface (Code, AST parse) → describe
 *        (Generative) → cross-link (Agentic, autonomous; already promoted)
 *        → publish (Code, calls $.api.github.pages).
 *
 * Pure-autonomous: no Human Functions, `clarificationPolicy.enabled: false`.
 * `iterationPolicy.onMaxRoundsExceeded: 'auto-fail'` (no human escalation).
 */
export const apiDocsWriter: ServiceInstance<RepoIntake, PublishedDocs> = Service.define<
  RepoIntake,
  PublishedDocs
>({
  name: 'API Docs Writer',
  promise: 'Repo URL in, typed API reference docs published to GitHub Pages out.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: RepoIntakeSchema, output: PublishedDocsSchema },

  binding: {
    cascade: [
      Code({ name: 'clone', reward: kr_thumbsUp, handler: () => undefined }),
      Code({ name: 'extract-surface', reward: kr_thumbsUp, handler: () => undefined }),
      Generative({ name: 'describe', reward: kr_thumbsUp }),
      Agentic({
        name: 'cross-link',
        reward: kr_thumbsUp,
        mode: 'autonomous',
        oversight: { mode: 'autonomous' },
        signOff: 'none',
      }),
      Code({ name: 'publish', reward: kr_thumbsUp, handler: () => undefined }),
    ],
    toolPermissions: ['github.repos', 'github.pages'],
    clarificationPolicy: { enabled: false },
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:api-docs-writer-review',
    personas: [
      Personas.coverage({ minPercent: 0.95 }),
      Personas.accuracy({ domain: 'signature-checking' }),
      Personas.voice({ brandVoiceRef: 'docs-style-guide' }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'auto-fail' },
  }),

  outcomeContract: {
    $id: 'oc:api-docs-writer:v1',
    $type: 'OutcomeContract',
    buyer: 'role:repo-maintainer',
    seller: 'svc:api-docs-writer',
    serviceRef: 'svc:api-docs-writer',
    predicate: AND(
      SchemaMatch(PublishedDocsSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      External({ verifier: 'github-pages', spec: { deployed: true, statusCode: 200 } })
    ),
    amount: { amount: 10000n, currency: 'USD' },
    // 2-day SLA — onTimeout cancels (pure-autonomous; no human to escalate to).
    expiresAt: 'P2D',
    onTimeout: 'auto-cancel',
  },

  pricing: {
    kind: 'composite',
    base: { id: 'repo', amount: 10000n, description: 'one-time per repo per version' },
    metered: [
      { event: 'symbol-documented', amount: 5n, description: '$0.05 per documented symbol' },
    ],
  },

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'self-only',
  costModel: { perInvocation: 200n, perUnit: 2n },
  reward: kr_thumbsUp,

  lineage: {
    cellRef: 'business.org.ai/cells/technical-writers/api-reference-authoring',
    icpContextProblemRef: 'icp:api-docs-writer:v1',
    foundingHypothesisRef: 'fh:api-docs-writer:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
