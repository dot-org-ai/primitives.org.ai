/**
 * Claude Code Feature Build — the v3 worked example as a real Service.
 *
 * Demonstrates: outcome-tier pricing (S/M/L by feature complexity), multi-step-
 * research archetype, 5-Function cascade (Generative + 3 Agentic + 1 Code) with
 * a fan-out dev step, 4-persona EvaluatorPanel (qa / arch / security / product),
 * AND-composed OutcomeContract predicate (EvaluatorPass + External github
 * verifier with `ci: passing` + `merged: true`).
 *
 * Per design v3 §3 (Claude Code worked example) + §6 (binding triggers) + §7
 * (outcome pricing factory) + §8 (ProofPredicate AND + External verifier).
 *
 * Layer note: this Service lives in `autonomous-startups` (catalog package at
 * L5). It depends on `services-as-software` (L5 primitive) +
 * `autonomous-finance` (L3 substrate) + `digital-tools` (L4 Function-refs).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, External, Pricing } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a feature-build brief from the buyer (typically a tenant
 * engineering lead). Three fields: which repo, what to build, and the
 * acceptance criteria the EvaluatorPanel will assert against at sign-off.
 */
export const FeatureBuildInput = z.object({
  repoRef: z.string().regex(/^github\.com\//),
  featureBrief: z.string().min(40),
  acceptanceCriteria: z.array(z.string()).min(1),
})

/**
 * Output — a merged PR plus the four reviewer verdicts. `prRef` is the PR
 * URL/ref returned by github; `mergedAt` is ISO-8601; `reviewerApprovals`
 * captures the verdict + rationale for each of the four EvaluatorPanel
 * personas (qa / arch / security / product).
 */
const ReviewerVerdictSchema = z.object({
  verdict: z.enum(['approve', 'reject']),
  rationale: z.string(),
})

export const ReviewerApprovalsSchema = z.object({
  qa: ReviewerVerdictSchema,
  arch: ReviewerVerdictSchema,
  security: ReviewerVerdictSchema,
  product: ReviewerVerdictSchema,
})

export const FeatureBuildOutput = z.object({
  prRef: z.string(),
  mergedAt: z.string(),
  reviewerApprovals: ReviewerApprovalsSchema,
})

export type FeatureBuildInput = z.infer<typeof FeatureBuildInput>
export type FeatureBuildOutput = z.infer<typeof FeatureBuildOutput>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// TODO: replace with real $.Reward references when business-as-code KR
// primitive lands.
// ============================================================================

// TODO(business-as-code): wire to real KR ref once $.Reward primitive ships.
const kr_solutionDiversity: RewardSignal = {
  keyResultRef: 'kr:claude-code:solution-diversity',
}
// TODO(business-as-code): wire to real KR ref once $.Reward primitive ships.
const kr_planFidelity: RewardSignal = { keyResultRef: 'kr:claude-code:plan-fidelity' }
// TODO(business-as-code): wire to real KR ref once $.Reward primitive ships.
const kr_scopeAccuracy: RewardSignal = { keyResultRef: 'kr:claude-code:scope-accuracy' }
// TODO(business-as-code): wire to real KR ref once $.Reward primitive ships.
const kr_prMergedRate: RewardSignal = { keyResultRef: 'kr:claude-code:pr-merged-rate' }
// TODO(business-as-code): wire to real KR ref once $.Reward primitive ships.
const kr_customerCSAT: RewardSignal = { keyResultRef: 'kr:claude-code:customer-csat' }

// ============================================================================
// Claude Code Feature Build Service
// ============================================================================

/**
 * Claude Code Feature Build — ship a feature to the buyer's repo, reviewed
 * by 4 specialist personas (qa / arch / security / product).
 *
 * Cascade: brainstorm (G) → plan (A) → scope (A) → dispatch (C)
 *        → dev × N (A, fan-out).
 *
 * Outcome predicate: AND(EvaluatorPass(panel:self, all-approved),
 *                        External(github, { ci: 'passing', merged: true })).
 *
 * Pricing: outcome tiers — S=$200, M=$800, L=$2400 by feature complexity.
 */
export const claudeCodeFeatureBuild: ServiceInstance<FeatureBuildInput, FeatureBuildOutput> =
  Service.define<FeatureBuildInput, FeatureBuildOutput>({
    name: 'Claude Code Feature Build',
    promise: 'Ship a feature to your repo, reviewed by 4 specialists.',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: FeatureBuildInput, output: FeatureBuildOutput },

    binding: {
      cascade: [
        Generative({ name: 'brainstorm', reward: kr_solutionDiversity }),
        Agentic({
          name: 'plan',
          reward: kr_planFidelity,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Agentic({
          name: 'scope',
          reward: kr_scopeAccuracy,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Code({ name: 'dispatch', handler: () => undefined }),
        Agentic({
          name: 'dev',
          reward: kr_prMergedRate,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
          // `dev` fans out N parallel sub-tasks emitted by `dispatch`.
          // The cascade compiler chooses N at runtime based on the upstream
          // dispatch batch size + ambient cost budget.
          concurrency: 'fan-out',
        }),
      ],
      toolPermissions: ['github.repos', 'github.pulls', 'github.actions'],
      clarificationPolicy: {
        enabled: true,
        maxRoundTrips: 3,
        escalateTo: 'engineer',
      },
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:claude-code-review',
      personas: [
        Personas.skeptic({
          domain: 'qa',
          focus: ['tests', 'edge-cases'],
          name: 'qa-reviewer',
        }),
        Personas.domain({
          expertRef: 'occupations.org.ai/SoftwareArchitects',
          name: 'arch-reviewer',
        }),
        Personas.skeptic({
          domain: 'security',
          focus: ['secrets', 'sast', 'auth'],
          name: 'security-reviewer',
        }),
        Personas.accuracy({
          domain: 'product-acceptance',
          name: 'product-reviewer',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 5, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:claude-code-feature-build:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-engineering-lead',
      seller: 'role:claude-code-service',
      serviceRef: 'will-be-svc-id',
      predicate: AND(
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        External({ verifier: 'github', spec: { ci: 'passing', merged: true } })
      ),
      amount: { amount: 20000n, currency: 'USD' },
      // 14-day SLA; onTimeout escalates per refundContract.
      expiresAt: 'P14D',
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        { id: 'S', amount: 20000n, currency: 'USD', description: 'Small feature' },
        { id: 'M', amount: 80000n, currency: 'USD', description: 'Medium feature' },
        { id: 'L', amount: 240000n, currency: 'USD', description: 'Large feature' },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'self-only',
    costModel: { perInvocation: 800n, perAgentRound: 50n },
    reward: kr_customerCSAT,

    lineage: {
      cellRef: 'business.org.ai/cells/software-developers/feature-implementation',
      icpContextProblemRef: 'icp:claude-code:v1',
      foundingHypothesisRef: 'fh:claude-code:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
