/**
 * Policy Impact Analyzer Service — proposed-policy-change impact analysis for
 * the legal catalog.
 *
 * Distinguishing shape vs. siblings (`contract-reviewer`,
 * `ip-disclosure-triage`):
 *   - `multi-step-research` archetype — the artefact is a GC + privacy-officer
 *     signed forward-looking impact memo over a proposed policy change
 *     (handbook update, terms-of-service amendment, privacy-policy delta),
 *     not an in-document redline or an invention triage decision;
 *   - 5-step cascade with one supervised Agentic jurisdictional-research
 *     step (the only Agentic step in the legal catalog), bookended by Code
 *     fan-in (current policy + affected systems), Generative synthesis of
 *     the impact narrative + mitigations, dual-Human approval gate (GC +
 *     privacy officer), and Code fan-out (impact memo + change tracker);
 *   - `Pricing.outcome` 3 tiers keyed on policy-change scope — minor /
 *     major / cross-border ($999 / $4,999 / $14,999) — a typo fix in the
 *     handbook is worth less than a cross-border data-transfer mechanism
 *     change with multi-jurisdiction obligations;
 *   - declarative HITL = mandatory GC + privacy-officer sign-off (the GC
 *     owns regulatory-binding authority on policy changes, the privacy
 *     officer owns the data-subject-rights envelope), plus OutcomeContract
 *     requires GC signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(jurisdictional-coverage +
 *     scenario-completeness + GDPR-regulatoryCompliance +
 *     factualAccuracy[government,peer-reviewed]) + HumanSign(GC))`.
 *
 * Per design v3 §3 (Catalog HOW legal) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `policy-change-incident-rate-reduction` — the
 * compound metric every legal + privacy org optimises against (the analyzer
 * is worth running iff post-change incidents — regulator inquiries,
 * customer-rights complaints, contractual-breach notifications — drop vs.
 * the pre-Service baseline).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative, Human } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, HumanSign, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a proposed policy change filed against the legal+privacy intake
 * channel. Tight: 7 fields cover the change identity, the policy kind +
 * declared scope (so the outcome-tier pricing is resolvable at intake), the
 * proposed-delta pointer the cascade fans-in against, the in-scope
 * jurisdictions the Agentic research step researches, the affected internal
 * systems the impact narrative grounds against, the proposed effective date,
 * and the assigned GC + privacy-officer reviewers.
 */
export const PolicyChangeInputSchema = z.object({
  changeId: z.string(),
  policyKind: z.enum([
    'handbook',
    'terms-of-service',
    'privacy-policy',
    'data-processing-addendum',
    'acceptable-use-policy',
    'cookie-policy',
    'sub-processor-list',
  ]),
  declaredScope: z.enum(['minor', 'major', 'cross-border']),
  proposedDelta: z.object({
    currentDocumentUrl: z.string(),
    proposedDocumentUrl: z.string(),
    diffSummaryMarkdown: z.string(),
  }),
  inScopeJurisdictions: z.array(z.string()).min(1),
  affectedSystems: z
    .array(
      z.object({
        systemRef: z.string(),
        systemKind: z.enum([
          'product-surface',
          'data-store',
          'integration',
          'workflow',
          'sub-processor',
        ]),
      })
    )
    .min(0),
  proposedEffectiveDate: z.string(), // ISO-8601
  reviewers: z.object({
    generalCounselRef: z.string(),
    privacyOfficerRef: z.string(),
  }),
})

/**
 * Output — a GC + privacy-officer signed policy-impact memo: the current-
 * policy snapshot + affected systems, the jurisdictional-research findings,
 * the synthesized impact narrative + mitigations, the GC + privacy-officer
 * review audit, and pointers to the emitted impact memo + change-tracker
 * artefacts.
 */
export const PolicyImpactOutputSchema = z.object({
  changeId: z.string(),
  currentPolicySnapshot: z.object({
    documentUrl: z.string(),
    documentSha256: z.string(),
    affectedSystemRefs: z.array(z.string()),
  }),
  jurisdictionalFindings: z
    .array(
      z.object({
        findingId: z.string(),
        jurisdiction: z.string(),
        applicableRegulationRef: z.string(),
        obligationSummary: z.string(),
        sourceCitations: z.array(z.string()).min(1),
      })
    )
    .min(1),
  impactNarrative: z.object({
    summaryMarkdown: z.string(),
    affectedDataSubjectCategories: z.array(z.string()),
    affectedCustomerSegments: z.array(z.string()),
    contractualImplications: z
      .array(
        z.object({
          contractKind: z.string(),
          implication: z.string(),
        })
      )
      .min(0),
    operationalImplications: z
      .array(
        z.object({
          systemRef: z.string(),
          implication: z.string(),
        })
      )
      .min(0),
  }),
  mitigations: z
    .array(
      z.object({
        mitigationId: z.string(),
        description: z.string(),
        ownerRef: z.string(),
        targetCompletionAt: z.string().optional(),
      })
    )
    .min(0),
  reviews: z.object({
    generalCounsel: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    }),
    privacyOfficer: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    }),
  }),
  artefacts: z.object({
    impactMemoUrl: z.string(),
    changeTrackerUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type PolicyChangeInput = z.infer<typeof PolicyChangeInputSchema>
export type PolicyImpactOutput = z.infer<typeof PolicyImpactOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_policyChangeIncidentRate: RewardSignal = {
  keyResultRef: 'kr:policy-impact-analyzer:policy-change-incident-rate-reduction',
}
const kr_systemCoverage: RewardSignal = {
  keyResultRef: 'kr:policy-impact-analyzer:system-coverage',
}
const kr_jurisdictionalCoverage: RewardSignal = {
  keyResultRef: 'kr:policy-impact-analyzer:jurisdictional-coverage',
}
const kr_scenarioCompleteness: RewardSignal = {
  keyResultRef: 'kr:policy-impact-analyzer:scenario-completeness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:policy-impact-analyzer:emit-latency',
}

// ============================================================================
// Policy Impact Analyzer Service
// ============================================================================

/**
 * Policy Impact Analyzer — proposed policy-change → GC + privacy-officer
 * signed impact memo with applicable-regulation findings, affected-system
 * implications, and mitigations as a Service.
 *
 * Cascade: fetch-current-policy-and-affected-systems (Code, fan-in)
 *        → supervised-jurisdictional-research-on-applicable-regulations (Agentic, supervised)
 *        → synthesize-impact-narrative-and-mitigations (Generative)
 *        → gc-and-privacy-officer-sign-off (Human, regulatory rationale)
 *        → emit-impact-memo-and-change-tracker (Code, fan-out).
 */
export const policyImpactAnalyzer: ServiceInstance<PolicyChangeInput, PolicyImpactOutput> =
  Service.define<PolicyChangeInput, PolicyImpactOutput>({
    name: 'Policy Impact Analyzer',
    promise:
      'Every proposed policy change ships with a GC + privacy-officer signed impact memo — applicable-regulation findings + affected-systems implications + concrete mitigations — so post-change regulator inquiries and rights-complaints land at the lower bound of incident rate, not the prior-art baseline.',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: PolicyChangeInputSchema, output: PolicyImpactOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-current-policy-and-affected-systems',
          reward: kr_systemCoverage,
          handler: () => undefined,
        }),
        Agentic({
          name: 'supervised-jurisdictional-research-on-applicable-regulations',
          reward: kr_jurisdictionalCoverage,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Generative({
          name: 'synthesize-impact-narrative-and-mitigations',
          reward: kr_scenarioCompleteness,
        }),
        Human({
          name: 'gc-and-privacy-officer-sign-off',
          // `regulatory` rationale: regulatory-binding authority on policy
          // changes sits with the GC (and the privacy officer for the
          // data-subject-rights envelope). The gate stays human regardless
          // of model accuracy.
          rationale: 'regulatory',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-impact-memo-and-change-tracker',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'policy-store.read',
        'policy-store.write',
        'system-graph.read',
        'subprocessor-registry.read',
        'regulator-corpus.read',
        'jurisdiction-mapping.read',
        'memo-engine.write',
        'docs.write',
      ],
      // Policy-impact analysis: clarification disabled — the cascade
      // synthesises from the proposed-delta + affected-systems + regulator-
      // corpus signals; the GC + privacy-officer review step is the single
      // human contact point in the cascade.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Cross-border-scope changes escalate the jurisdictional-research
          // step to a senior privacy-counsel supervisor before the GC +
          // privacy-officer review (the GC + privacy-officer still sign,
          // but the supervisor backstops the synthesis quality on the
          // highest-stakes scope).
          when: 'declaredScope == "cross-border"',
          action: 'escalate',
        },
        {
          // Every change routes through the GC + privacy-officer review
          // before the impact memo emits; OutcomeContract enforces the
          // GC signature, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'gc-and-privacy-officer-sign-off',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:policy-impact-analyzer-review',
      personas: [
        // Jurisdictional-coverage reviewer — pedantic check that every
        // in-scope jurisdiction was researched, every applicable regulation
        // surfaces a finding, and no jurisdiction was silently skipped. The
        // risk this guards against is "cherry-picked jurisdictions".
        Personas.pedantic({
          domain: 'jurisdictional-coverage',
          rubric: [
            'every-in-scope-jurisdiction-researched',
            'every-applicable-regulation-cited',
            'no-silent-jurisdiction-skips',
            'cross-border-mechanism-evaluated-when-applicable',
          ],
          name: 'jurisdictional-coverage-checker',
        }),
        // Scenario-completeness reviewer — adversarially probes whether the
        // impact narrative covers the full surface (data-subject categories,
        // customer segments, contractual implications, operational
        // implications) vs. surface-level "this affects users" hand-waving.
        Personas.skeptic({
          domain: 'scenario-completeness',
          focus: [
            'data-subject-categories-named',
            'customer-segments-named',
            'contractual-implications-evaluated',
            'operational-implications-evaluated',
            'no-hand-waves',
          ],
          name: 'scenario-completeness-reviewer',
        }),
        // Regulatory-compliance reviewer — GDPR-tier pass over the proposed
        // impact memo + mitigations. Catches DPA + Schrems-II + DSAR-flow
        // issues before the GC signs.
        Personas.regulatoryCompliance({ regulator: 'gdpr' }),
        // Factual-accuracy reviewer — every load-bearing jurisdictional
        // finding must cite government or peer-reviewed sources only;
        // first-party blogs and vendor white-papers don't qualify for a
        // regulator-tier impact memo.
        Personas.factualAccuracy({
          citationRequired: true,
          sourceTypes: ['government', 'peer-reviewed'],
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:policy-impact-analyzer:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-general-counsel',
      seller: 'svc:policy-impact-analyzer',
      serviceRef: 'svc:policy-impact-analyzer',
      // GC signs every policy-impact memo before the policy change rolls out
      // — regulatory-binding authority on policy changes cannot be delegated.
      predicate: AND(
        SchemaMatch(PolicyImpactOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['general-counsel'] })
      ),
      // Mid-tier amount; the per-tier outcome amounts are in `pricing.tiers`.
      amount: { amount: 499900n, currency: 'USD' },
      // 7-day SLA — policy-change cycles run on weekly rhythms, not
      // incident time-scales; impact memo lands inside one rotation.
      timeoutDays: 7,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        {
          id: 'minor',
          amount: 99900n,
          currency: 'USD',
          description: 'Minor policy change — typo fix, in-jurisdiction clarification. $999.',
        },
        {
          id: 'major',
          amount: 499900n,
          currency: 'USD',
          description: 'Major policy change — handbook section rewrite, TOS amendment. $4,999.',
        },
        {
          id: 'cross-border',
          amount: 1499900n,
          currency: 'USD',
          description:
            'Cross-border policy change — multi-jurisdiction data-transfer mechanism, sub-processor swap. $14,999.',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 12000n, perApiCall: 22n },
    reward: kr_policyChangeIncidentRate,

    lineage: {
      cellRef: 'business.org.ai/cells/general-counsel/policy-impact-analyzer',
      icpContextProblemRef: 'icp:policy-impact-analyzer:v1',
      foundingHypothesisRef: 'fh:policy-impact-analyzer:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
