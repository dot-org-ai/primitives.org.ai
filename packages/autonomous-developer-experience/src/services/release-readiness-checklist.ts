/**
 * Release Readiness Checklist Service — pre-release gate Service for the
 * developer-experience catalog.
 *
 * Distinguishing shape vs. siblings (`api-docs-writer`, `changelog-generator`,
 * `sdk-generator`, `migration-guide-writer`, `tutorial-author`,
 * `example-suite-builder`):
 *   - `quality-gate` archetype — the artefact is a pass/fail readiness report
 *     that toggles a PR status check, not a published doc / SDK / example
 *     suite;
 *   - 5-step cascade with two Generative quality-checks (release-notes
 *     completeness + breaking-changes documented), bookended by a Code fan-in
 *     (PR diff + open issues + test status) and a Code fan-out (status check
 *     + readiness report), with a load-bearing Human maintainer-sign-off in
 *     the middle of the cascade;
 *   - `perInvocation` pricing across three tiers keyed on changed-LOC
 *     (small-PR / medium-PR / large-PR);
 *   - declarative HITL = Human Function in the cascade, plus the
 *     OutcomeContract requires a maintainer signature (the gate is a
 *     maintainer-led decision);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(coverage +
 *     breaking-changes-flagged) + HumanSign(maintainer))`.
 *
 * Per design v3 §3 (Catalog HOW DX) + §6 (binding triggers, conditional
 * HumanSign) + §7 (perInvocation pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `post-release-incident-rate-improvement` — the gate
 * is worth running iff post-release-incident rate trends down vs. the
 * pre-Service baseline.
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a release-candidate PR. Tight: 5 fields cover repository identity,
 * the PR ref + base/head shas (so the cascade can fan-out to GitHub for the
 * diff + tests + linked issues), and the labelled release tier so the
 * pricing tier is resolvable at intake time.
 */
export const ReleaseCandidatePRSchema = z.object({
  repoRef: z
    .string()
    .regex(
      /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+(?:\.git)?$/,
      'repoRef must be a github.com repository URL'
    ),
  prNumber: z.number().int().positive(),
  baseSha: z.string(),
  headSha: z.string(),
  releaseTier: z.enum(['patch', 'minor', 'major']),
})

/**
 * Output — a readiness report: the PR diff stats, the linked-issue inventory,
 * the test-status snapshot, the per-check verdicts, the maintainer
 * sign-off ref, and the final go/no-go decision (which the cascade emits as
 * a GitHub commit status against the PR's head sha).
 */
export const ReadinessReportSchema = z.object({
  repoRef: z.string(),
  prNumber: z.number().int().positive(),
  diffStats: z.object({
    filesChanged: z.number().int().nonnegative(),
    linesAdded: z.number().int().nonnegative(),
    linesRemoved: z.number().int().nonnegative(),
  }),
  linkedIssues: z.array(
    z.object({
      issueNumber: z.number().int().positive(),
      title: z.string(),
      state: z.enum(['open', 'closed']),
      isReleaseBlocker: z.boolean(),
    })
  ),
  testStatus: z.object({
    overall: z.enum(['passing', 'failing', 'pending']),
    coveragePercent: z.number().min(0).max(100),
    failingSuites: z.array(z.string()),
  }),
  checks: z.array(
    z.object({
      id: z.enum(['release-notes-complete', 'breaking-changes-documented']),
      verdict: z.enum(['pass', 'fail', 'warn']),
      rationale: z.string(),
    })
  ),
  maintainerSignOffRef: z.string(),
  decision: z.enum(['ready-to-release', 'block-release']),
  statusCheckUrl: z.string(),
  generatedAt: z.string(),
})

export type ReleaseCandidatePR = z.infer<typeof ReleaseCandidatePRSchema>
export type ReadinessReport = z.infer<typeof ReadinessReportSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_postReleaseIncidentRate: RewardSignal = {
  keyResultRef: 'kr:release-readiness-checklist:post-release-incident-rate-improvement',
}
const kr_signalCoverage: RewardSignal = {
  keyResultRef: 'kr:release-readiness-checklist:signal-coverage',
}
const kr_releaseNotesCheck: RewardSignal = {
  keyResultRef: 'kr:release-readiness-checklist:release-notes-check-accuracy',
}
const kr_breakingChangesCheck: RewardSignal = {
  keyResultRef: 'kr:release-readiness-checklist:breaking-changes-check-accuracy',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:release-readiness-checklist:emit-latency',
}

// ============================================================================
// Release Readiness Checklist Service
// ============================================================================

/**
 * Release Readiness Checklist — release-candidate PR → quality-gate decision
 * + GitHub commit status as a Service.
 *
 * Cascade: fetch-pr-diff-issues-tests (Code, GitHub fan-in)
 *        → check-release-notes-completeness (Generative)
 *        → check-breaking-changes-documented (Generative)
 *        → maintainer-sign-off-on-release-blockers (Human, load-bearing)
 *        → emit-readiness-report-and-set-pr-status-check (Code, GitHub fan-out).
 */
export const releaseReadinessChecklist: ServiceInstance<ReleaseCandidatePR, ReadinessReport> =
  Service.define<ReleaseCandidatePR, ReadinessReport>({
    name: 'Release Readiness Checklist',
    promise:
      'Every release-candidate PR gets a maintainer-signed readiness report and GitHub status check before it can merge — release-notes completeness, breaking-changes documented, blockers triaged.',
    audience: 'business',
    archetype: 'quality-gate',
    schema: { input: ReleaseCandidatePRSchema, output: ReadinessReportSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-pr-diff-issues-tests',
          reward: kr_signalCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'check-release-notes-completeness',
          reward: kr_releaseNotesCheck,
        }),
        Generative({
          name: 'check-breaking-changes-documented',
          reward: kr_breakingChangesCheck,
        }),
        Human({
          name: 'maintainer-sign-off-on-release-blockers',
          rationale: 'approval',
          // Release sign-off stays human — even after high-accuracy
          // promotion thresholds, a maintainer's name is on the release.
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-readiness-report-and-set-pr-status-check',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'github.repos',
        'github.pulls',
        'github.commits',
        'github.issues',
        'github.checks',
        'github.statuses',
        'ci.status',
      ],
      // PR-gate: clarification disabled — the cascade reads the diff +
      // linked issues + test status; it does not pause to ask the PR
      // author for clarification.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Major-tier PRs always escalate to the maintainer sign-off step;
          // smaller tiers may auto-pass low-risk gates.
          when: 'releaseTier == "major"',
          action: 'route-to',
          target: 'maintainer-sign-off-on-release-blockers',
        },
        {
          // Open release-blocker issues block the PR's status check
          // regardless of the rest of the cascade — the gate fails.
          when: 'linkedIssues.some(i => i.isReleaseBlocker && i.state == "open")',
          action: 'escalate',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:release-readiness-checklist-review',
      personas: [
        // Coverage pedant — the readiness report must address every check
        // (≥ 100%), not silently skip one that the cascade couldn't
        // evaluate.
        Personas.coverage({ minPercent: 1.0, name: 'check-coverage' }),
        // Breaking-change skeptic — adversarially probes for breaking
        // changes the cascade missed or under-flagged.
        Personas.skeptic({
          domain: 'breaking-change-flagging',
          focus: ['api-removal', 'signature-change', 'default-flip', 'wire-format-change'],
          name: 'breaking-changes-flagged',
        }),
        // Maintainer domain reviewer — pulls a senior maintainer persona
        // for judgment on the overall readiness verdict.
        Personas.domain({
          expertRef: 'occupations.org.ai/SoftwareDevelopers',
          name: 'maintainer-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:release-readiness-checklist:v1',
      $type: 'OutcomeContract',
      buyer: 'role:repo-maintainer',
      seller: 'svc:release-readiness-checklist',
      serviceRef: 'svc:release-readiness-checklist',
      // Maintainer signs every readiness report — the gate is a
      // maintainer-led decision and the maintainer's name is on the
      // commit status.
      predicate: AND(
        SchemaMatch(ReadinessReportSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['maintainer'] })
      ),
      amount: { amount: 2500n, currency: 'USD' },
      // 1-day SLA — release-candidate PRs are time-sensitive.
      timeoutDays: 1,
      onTimeout: 'escalate',
    },

    pricing: Pricing.perInvocation({
      tiers: [
        {
          id: 'small-pr',
          amount: 2500n,
          includedPerMonth: 500,
          overage: 2500n,
        },
        {
          id: 'medium-pr',
          amount: 7500n,
          includedPerMonth: 200,
          overage: 7500n,
        },
        {
          id: 'large-pr',
          amount: 25000n,
          includedPerMonth: 50,
          overage: 25000n,
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 500n, perApiCall: 5n },
    reward: kr_postReleaseIncidentRate,

    lineage: {
      cellRef: 'business.org.ai/cells/software-developers/release-readiness-gate',
      icpContextProblemRef: 'icp:release-readiness-checklist:v1',
      foundingHypothesisRef: 'fh:release-readiness-checklist:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
