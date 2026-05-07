/**
 * Runbook Author Service — operational runbook authoring from past-incident
 * learnings Service for the operations catalog.
 *
 * Distinguishing shape vs. siblings (`incident-commander`,
 * `oncall-handoff-narrator`, `capacity-planner`, `slo-budget-tracker`,
 * `change-window-coordinator`):
 *   - `quality-review` archetype — the artefact is an IC-approved
 *     operational runbook (triage tree + commands with context + escalation
 *     paths + edge cases) authored from a missing-runbook gap, not a one-off
 *     in-incident mitigation plan or a recurring weekly narrative;
 *   - 5-step cascade: Code fan-in (incident timeline + similar past incidents
 *     + service graph + tooling context) → Generative (synthesize runbook:
 *     triage tree + commands with context + escalation paths + edge cases) →
 *     Generative (validation tests for runbook + dry-run procedure) → Human
 *     (IC + service-owner review and confirm) → Code (emit runbook + register
 *     with on-call tooling);
 *   - `Pricing.outcome` 3 tiers keyed on runbook complexity — simple,
 *     standard, complex-multi-service ($299 / $999 / $2,999) — the runbook
 *     is worth more on a multi-service complexity tier;
 *   - declarative HITL = mandatory IC sign on the runbook (the IC who ran
 *     the originating incident owns the institutional knowledge encoded in
 *     the runbook, plus the rationale is `regulatory` because the runbook
 *     becomes a registered procedure other on-calls execute on production);
 *     plus OutcomeContract requires IC signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(triage-completeness +
 *     command-precision + edge-case-coverage) + HumanSign(IC))`.
 *
 * Per design v3 §3 (Catalog HOW operations) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate
 * AND).
 *
 * Service-level reward = `time-to-mitigation-for-similar-future-incidents` —
 * the compound metric every SRE / on-call org optimises against (the runbook
 * author is worth running iff the next time a similar-shape incident fires
 * the on-call mitigates faster vs. the no-runbook baseline; the artefact
 * compounds institutional learning across rotations).
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
 * Input — a post-incident-review-complete trigger combined with a missing-
 * runbook gap identified at retro. Tight: 7 fields cover the originating
 * incident, the complexity tier (so the outcome-tier pricing is resolvable
 * at intake), the affected services (so the cascade fans-in to the right
 * service-graph slice), the on-call tooling target (so the registration
 * step writes to the right surface), the assigned IC reviewer (so the
 * Human sign routes to the right inbox), the assigned service-owner
 * reviewers, and the originating retro reference (so lineage is preserved).
 */
export const RunbookAuthoringInputSchema = z.object({
  originatingIncidentRef: z.string(),
  complexityTier: z.enum(['simple', 'standard', 'complex-multi-service']),
  affectedServiceRefs: z.array(z.string()).min(1),
  oncallToolingTarget: z.enum(['pagerduty', 'opsgenie', 'incident-io', 'firehydrant', 'rootly']),
  assignedIcReviewerRef: z.string(),
  assignedServiceOwnerReviewerRefs: z.array(z.string()).min(1),
  originatingRetroRef: z.string(),
})

/**
 * Output — an IC-approved operational runbook: the originating-incident
 * context snapshot, the runbook itself (triage tree + commands + escalation
 * paths + edge cases), the validation tests + dry-run procedure, the joint
 * IC + service-owner review audit, and pointers to the emitted runbook
 * artefact + on-call-tooling registration.
 */
export const RunbookOutputSchema = z.object({
  originatingIncidentRef: z.string(),
  complexityTier: z.enum(['simple', 'standard', 'complex-multi-service']),
  contextSnapshot: z.object({
    incidentTimelineRef: z.string(),
    similarPastIncidentRefs: z.array(z.string()),
    serviceGraphSliceRef: z.string(),
    toolingContextRefs: z.array(z.string()),
  }),
  runbook: z.object({
    title: z.string(),
    summaryMarkdown: z.string(),
    triageTree: z
      .array(
        z.object({
          nodeId: z.string(),
          parentNodeId: z.string().optional(),
          symptom: z.string(),
          checkCommand: z.string(),
          expectedSignal: z.string(),
          branchOnSignal: z.array(
            z.object({
              signal: z.string(),
              nextNodeId: z.string(),
            })
          ),
        })
      )
      .min(1),
    commandsWithContext: z
      .array(
        z.object({
          commandId: z.string(),
          command: z.string(),
          contextualWhen: z.string(),
          contextualWhy: z.string(),
          dangerLevel: z.enum([
            'safe-read',
            'mutating-contained',
            'mutating-broad',
            'irreversible',
          ]),
          requiresHumanApproval: z.boolean(),
        })
      )
      .min(1),
    escalationPaths: z
      .array(
        z.object({
          escalationId: z.string(),
          triggerCondition: z.string(),
          escalateToRoleRef: z.string(),
          targetMinutesToRespond: z.number().int().nonnegative(),
        })
      )
      .min(1),
    edgeCases: z
      .array(
        z.object({
          edgeCaseId: z.string(),
          description: z.string(),
          handling: z.string(),
        })
      )
      .min(5),
  }),
  validation: z.object({
    tests: z
      .array(
        z.object({
          testId: z.string(),
          targetNodeId: z.string(),
          inputScenario: z.string(),
          expectedTraversal: z.array(z.string()),
        })
      )
      .min(1),
    dryRunProcedure: z.string(),
  }),
  jointApproval: z.object({
    icReviewerRef: z.string(),
    serviceOwnerReviewerRefs: z.array(z.string()),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  emittedRunbook: z.object({
    runbookUrl: z.string(),
    oncallToolingRegistrationRef: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type RunbookAuthoringInput = z.infer<typeof RunbookAuthoringInputSchema>
export type RunbookOutput = z.infer<typeof RunbookOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_timeToMitigationForSimilar: RewardSignal = {
  keyResultRef: 'kr:runbook-author:time-to-mitigation-for-similar-future-incidents',
}
const kr_contextCoverage: RewardSignal = {
  keyResultRef: 'kr:runbook-author:incident-and-tooling-context-coverage',
}
const kr_runbookCompleteness: RewardSignal = {
  keyResultRef: 'kr:runbook-author:runbook-completeness-and-precision',
}
const kr_validationCoverage: RewardSignal = {
  keyResultRef: 'kr:runbook-author:validation-and-dry-run-coverage',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:runbook-author:emit-latency',
}

// ============================================================================
// Runbook Author Service
// ============================================================================

/**
 * Runbook Author — post-incident-review-complete + missing-runbook-gap
 * identified → IC-approved operational runbook + on-call-tooling
 * registration as a Service.
 *
 * Cascade: fetch-incident-timeline-similar-past-incidents-service-graph-and-tooling-context (Code, fan-in)
 *        → synthesize-runbook-with-triage-tree-commands-escalation-paths-and-edge-cases (Generative)
 *        → draft-validation-tests-and-dry-run-procedure (Generative)
 *        → ic-and-service-owner-review-and-confirm (Human, regulatory rationale)
 *        → emit-runbook-and-register-with-oncall-tooling (Code, fan-out).
 */
export const runbookAuthor: ServiceInstance<RunbookAuthoringInput, RunbookOutput> = Service.define<
  RunbookAuthoringInput,
  RunbookOutput
>({
  name: 'Runbook Author',
  promise:
    'Every post-incident retro that surfaces a missing-runbook gap closes with an IC-approved operational runbook — triage tree + commands with context + escalation paths + edge cases + validation tests — registered with on-call tooling, so the next similar-shape incident mitigates from institutional knowledge instead of from scratch.',
  audience: 'business',
  archetype: 'quality-review',
  schema: { input: RunbookAuthoringInputSchema, output: RunbookOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-incident-timeline-similar-past-incidents-service-graph-and-tooling-context',
        reward: kr_contextCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-runbook-with-triage-tree-commands-escalation-paths-and-edge-cases',
        reward: kr_runbookCompleteness,
      }),
      Generative({
        name: 'draft-validation-tests-and-dry-run-procedure',
        reward: kr_validationCoverage,
      }),
      Human({
        name: 'ic-and-service-owner-review-and-confirm',
        // `regulatory` rationale: the runbook becomes a registered
        // procedure that future on-calls execute against production
        // surfaces (mutating-broad / irreversible commands carry blast
        // radius). The IC who ran the originating incident owns the
        // institutional knowledge encoded in the runbook; their sign-off
        // gates registration. The gate stays human regardless of model
        // accuracy.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-runbook-and-register-with-oncall-tooling',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'incident-history.read',
      'service-graph.read',
      'pagerduty.runbooks',
      'opsgenie.runbooks',
      'incident-io.runbooks',
      'firehydrant.runbooks',
      'rootly.runbooks',
      'datadog.metrics',
      'datadog.logs',
      'docs.write',
    ],
    // Post-incident-review cadence: clarification disabled — the cascade
    // synthesises from the incident-timeline + similar-past-incidents +
    // service-graph + tooling-context signals; the joint IC + service-
    // owner review is the single human contact point.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Complex-multi-service runbooks escalate the synthesis step to a
        // senior SRE supervisor before the joint review (the IC still
        // signs, but a supervisor backstops the runbook quality on the
        // highest-complexity tier where edge-case coverage and command
        // precision matter most).
        when: 'complexityTier == "complex-multi-service"',
        action: 'escalate',
      },
      {
        // Every runbook routes through the joint IC + service-owner
        // review before on-call-tooling registration; OutcomeContract
        // enforces the signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'ic-and-service-owner-review-and-confirm',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:runbook-author-review',
    personas: [
      // Triage-completeness reviewer — pedantic check that the triage
      // tree's branching covers all signals named in the originating
      // incident's timeline, that no orphan nodes (nodes not reachable
      // from the root) exist, and that every leaf node either resolves
      // the symptom or escalates explicitly.
      Personas.pedantic({
        domain: 'triage-completeness',
        rubric: [
          'every-incident-signal-covered-by-a-tree-branch',
          'no-orphan-nodes',
          'every-leaf-resolves-or-escalates',
          'parent-child-references-internally-consistent',
          'no-silent-dead-ends',
        ],
        name: 'triage-completeness-checker',
      }),
      // Command-precision reviewer — pedantic check that every command
      // declares its dangerLevel honestly (no silent mutating-broad
      // commands shipped as safe-read), that every mutating-broad or
      // irreversible command carries `requiresHumanApproval = true`, and
      // that every command pairs with concrete contextualWhen / Why
      // language (not vague "use this if needed").
      Personas.pedantic({
        domain: 'command-precision',
        rubric: [
          'every-command-declares-danger-level',
          'mutating-broad-or-irreversible-requires-human-approval',
          'contextual-when-and-why-concrete-not-vague',
          'no-bare-commands-without-context',
          'no-misclassified-danger-levels',
        ],
        name: 'command-precision-checker',
      }),
      // Edge-case-coverage reviewer — at least 5 edge cases per primary
      // scenario before the IC signs (the schema enforces .min(5);
      // the persona enforces edge-case quality across the curated
      // domains: empty-input, malformed-input, partial-failure,
      // concurrent-modification, time-zone, etc).
      Personas.edgeCaseCoverage({
        minEdgeCasesPerScenario: 5,
        name: 'edge-case-coverage-checker',
      }),
      // Scope-clarity reviewer — runbook is treated as a project-brief
      // artefact (the brief commits the on-call to a procedure scoped to
      // a specific failure-mode); require explicit scope-boundary and
      // out-of-scope sections so future on-calls don't over-extend the
      // runbook to incidents it wasn't authored for.
      Personas.scopeClarity({
        artifactType: 'project-brief',
        name: 'runbook-scope-clarity-reviewer',
      }),
      // SRE domain reviewer — pulls the senior-SRE expert for judgment
      // on the overall runbook quality.
      Personas.domain({
        expertRef: 'occupations.org.ai/SiteReliabilityEngineers',
        name: 'sre-domain',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:runbook-author:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-sre-lead',
    seller: 'svc:runbook-author',
    serviceRef: 'svc:runbook-author',
    // IC signs every runbook before on-call-tooling registration —
    // procedure-authority cannot be delegated.
    predicate: AND(
      SchemaMatch(RunbookOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['incident-commander'] })
    ),
    // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
    amount: { amount: 99900n, currency: 'USD' },
    // 7-day SLA — runbooks ship within a week of the post-incident retro
    // so the institutional learning compounds while the originating
    // incident is still fresh.
    timeoutDays: 7,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'simple',
        amount: 29900n,
        currency: 'USD',
        description:
          'Simple runbook — single-service, single-failure-mode, contained triage tree. $299.',
      },
      {
        id: 'standard',
        amount: 99900n,
        currency: 'USD',
        description:
          'Standard runbook — single-service, multi-failure-mode triage tree with escalation paths. $999.',
      },
      {
        id: 'complex-multi-service',
        amount: 299900n,
        currency: 'USD',
        description:
          'Complex multi-service runbook — cross-service triage tree, mutating-broad commands, multi-team escalation paths. $2,999.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 7000n, perApiCall: 12n },
  reward: kr_timeToMitigationForSimilar,

  lineage: {
    cellRef: 'business.org.ai/cells/sre-managers/runbook-author',
    icpContextProblemRef: 'icp:runbook-author:v1',
    foundingHypothesisRef: 'fh:runbook-author:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
