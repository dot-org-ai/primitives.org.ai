/**
 * Jobs-To-Be-Done Clusterer Service — JTBD discovery + cluster authoring
 * Service for the product-management catalog.
 *
 * Distinguishing shape vs. siblings (`prd-author`,
 * `customer-feedback-synthesizer`, `roadmap-tradeoff-evaluator`,
 * `release-experiment-designer`, `feature-deprecation-coordinator`):
 *   - `multi-step-research` archetype — the artefact is a product-strategy-
 *     lead-reviewed JTBD doc clustering customer jobs across a discovery
 *     interview round (≥ 12 transcripts) with citation-traceable evidence
 *     trail and prioritization recommendations + product-implication
 *     options, not a PRD or a feedback synthesis;
 *   - 5-step cascade with one supervised Agentic extraction step (the
 *     supervised cluster-similar-jobs step is the load-bearing reasoning
 *     surface), bookended by Code fan-in over interview transcripts +
 *     prior-round transcripts, Generative synthesis with frequency-and-
 *     importance metadata, Generative drafting of prioritization
 *     recommendations + product-implication options, Human review by the
 *     product-strategy-lead, and Code fan-out (JTBD doc + linked evidence
 *     trail);
 *   - `Pricing.outcome` 3 tiers keyed on the round size — small-round /
 *     standard-round / enterprise-round ($999 / $2,999 / $9,999) — an
 *     enterprise-scale interview round is worth more than a small round;
 *   - declarative HITL = mandatory product-strategy-lead sign-off Human
 *     Function (uses `'premium'` rationale because the strategic-product-
 *     decision authority is the value the customer pays for and the
 *     product-strategy-lead is the premium-tier signer for the doc), plus
 *     OutcomeContract requires product-strategy-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(clustering-
 *     precision + JTBD-clarity + evidence-traceability) +
 *     HumanSign(product-strategy-lead))`;
 *   - EvaluatorPanel includes `Personas.factualAccuracy({ citationRequired:
 *     true, minCitationsPerClaim: 3 })` because every JTBD claim must be
 *     corroborated by at least three citations across the transcript
 *     evidence trail (the evidence-traceability requirement is the
 *     load-bearing quality bar the product-strategy-lead reads), plus
 *     `Personas.scopeClarity({ artifactType: 'project-brief' })` because
 *     a JTBD doc is a project-brief-shaped artefact whose scope-boundary
 *     and out-of-scope claims must hold the project-brief-grade clarity
 *     bar.
 *
 * Per design v3 §3 (Catalog HOW product) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `feature-conversion-rate-on-JTBD-aligned-features`
 * — the compound metric every product org optimises against (the clusterer
 * is worth running iff a higher fraction of features built off the
 * surfaced JTBDs convert vs. the pre-Service baseline of bespoke
 * interview-synthesis exercises).
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
 * Input — a customer-discovery interview round has completed with at
 * least 12 transcripts. Tight: 8 fields cover the artefact identity,
 * the round size tier (small / standard / enterprise — resolves the
 * outcome tier at intake), the assigned product-strategy-lead (Human
 * review routing), the discovery round identifier, the transcript
 * pointers (≥ 12), the prior-round transcript pointers used to enrich
 * cluster continuity, the interview corpus language, and the trigger
 * stage gating intake.
 */
export const JobsToBeDoneInputSchema = z.object({
  artefactId: z.string(),
  roundSize: z.enum(['small-round', 'standard-round', 'enterprise-round']),
  assignedProductStrategyLeadRef: z.string(),
  discoveryRoundId: z.string(),
  interviewTranscriptRefs: z.array(z.string()).min(12),
  priorRoundTranscriptRefs: z.array(z.string()).default([]),
  corpusLanguage: z.string().default('en'),
  triggerStage: z.literal('discovery-round-complete'),
})

/**
 * Output — a product-strategy-lead reviewed JTBD doc clustering customer
 * jobs across the discovery round, the synthesized JTBD statements with
 * frequency + importance metadata, the prioritization recommendations,
 * the product-implication options, the review audit, and pointers to
 * the emitted JTBD doc + the linked evidence trail.
 */
export const JobsToBeDoneOutputSchema = z.object({
  artefactId: z.string(),
  discoveryRoundId: z.string(),
  jobsToBeDone: z
    .array(
      z.object({
        jtbdId: z.string(),
        statement: z.string(),
        clusterRationale: z.string(),
        frequency: z.number().int().nonnegative(),
        importanceScore: z.number().min(0).max(1),
        evidenceCitations: z
          .array(
            z.object({
              transcriptRef: z.string(),
              quotedSnippet: z.string(),
              speakerRole: z.string(),
            })
          )
          .min(3),
      })
    )
    .min(1),
  prioritizationRecommendations: z
    .array(
      z.object({
        jtbdRef: z.string(),
        rank: z.number().int().positive(),
        rationale: z.string(),
      })
    )
    .min(1),
  productImplicationOptions: z
    .array(
      z.object({
        optionId: z.string(),
        forJtbdRefs: z.array(z.string()).min(1),
        narrative: z.string(),
        confidence: z.enum(['low', 'medium', 'high']),
      })
    )
    .min(1),
  reviewAudit: z.object({
    productStrategyLeadRef: z.string(),
    decision: z.enum(['accept', 'request-edit', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  emittedArtefacts: z.object({
    jtbdDocUrl: z.string(),
    evidenceTrailUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type JobsToBeDoneInput = z.infer<typeof JobsToBeDoneInputSchema>
export type JobsToBeDoneOutput = z.infer<typeof JobsToBeDoneOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_jtbdAlignedFeatureConversion: RewardSignal = {
  keyResultRef: 'kr:jobs-to-be-done-clusterer:feature-conversion-rate-on-JTBD-aligned-features',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:jobs-to-be-done-clusterer:intake-coverage',
}
const kr_clusteringPrecision: RewardSignal = {
  keyResultRef: 'kr:jobs-to-be-done-clusterer:clustering-precision',
}
const kr_jtbdClarity: RewardSignal = {
  keyResultRef: 'kr:jobs-to-be-done-clusterer:jtbd-clarity',
}
const kr_implicationActionability: RewardSignal = {
  keyResultRef: 'kr:jobs-to-be-done-clusterer:implication-actionability',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:jobs-to-be-done-clusterer:emit-latency',
}

// ============================================================================
// Jobs-To-Be-Done Clusterer Service
// ============================================================================

/**
 * Jobs-To-Be-Done Clusterer — discovery-round-complete + ≥ 12 transcripts
 * trigger → product-strategy-lead-reviewed JTBD doc clustering customer
 * jobs with citation-traceable evidence trail and prioritization
 * recommendations + product-implication options as a Service.
 *
 * Cascade: fetch-interview-transcripts-and-transcripts-from-prior-rounds (Code, fan-in)
 *        → supervised-extract-jobs-from-quotes-and-cluster-similar-jobs (Agentic, supervised)
 *        → synthesize-JTBD-statements-with-frequency-and-importance (Generative)
 *        → draft-prioritization-recommendations-and-product-implication-options (Generative)
 *        → product-strategy-lead-review (Human, premium rationale)
 *        → emit-JTBD-doc-and-linked-evidence-trail (Code, fan-out).
 */
export const jobsToBeDoneClusterer: ServiceInstance<JobsToBeDoneInput, JobsToBeDoneOutput> =
  Service.define<JobsToBeDoneInput, JobsToBeDoneOutput>({
    name: 'Jobs-To-Be-Done Clusterer',
    promise:
      'Every customer-discovery interview round gets a product-strategy-lead-signed JTBD doc — clustered customer jobs, frequency + importance metadata, prioritization recommendations, citation-traceable evidence trail — so product-strategy spends the cycle on the decision, not on transcript-cluster assembly.',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: JobsToBeDoneInputSchema, output: JobsToBeDoneOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-interview-transcripts-and-transcripts-from-prior-rounds',
          reward: kr_intakeCoverage,
          handler: () => undefined,
        }),
        Agentic({
          name: 'supervised-extract-jobs-from-quotes-and-cluster-similar-jobs',
          reward: kr_clusteringPrecision,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Generative({
          name: 'synthesize-JTBD-statements-with-frequency-and-importance',
          reward: kr_jtbdClarity,
        }),
        Generative({
          name: 'draft-prioritization-recommendations-and-product-implication-options',
          reward: kr_implicationActionability,
        }),
        Human({
          name: 'product-strategy-lead-review',
          // `premium` rationale: the strategic-product-decision authority
          // is the value the customer pays for and the product-strategy-
          // lead is the premium-tier signer for the JTBD doc.
          rationale: 'premium',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-JTBD-doc-and-linked-evidence-trail',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'gong.calls',
        'chorus.calls',
        'notion.docs',
        'productboard.research',
        'docs.write',
        'pdf.render',
      ],
      // JTBD clustering: clarification disabled — the cascade synthesises
      // from the transcript corpus + prior-round transcripts; the product-
      // strategy-lead review step is the single human contact point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Enterprise-round-size cycles escalate the supervised
          // extraction step to a senior research-ops supervisor before
          // the product-strategy-lead review (cluster precision compounds
          // at enterprise transcript volume).
          when: 'roundSize == "enterprise-round"',
          action: 'escalate',
        },
        {
          // Every round routes through the product-strategy-lead review
          // before the JTBD doc emits; OutcomeContract enforces the
          // product-strategy-lead signature, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'product-strategy-lead-review',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:jobs-to-be-done-clusterer-review',
      personas: [
        // Clustering-precision reviewer — pedantic check that every cluster
        // has a single coherent narrative thread (not a junk-drawer
        // cluster), that no JTBD silently merges unrelated jobs, and that
        // the cluster rationale references the constituent transcripts.
        Personas.pedantic({
          domain: 'clustering-precision',
          rubric: [
            'every-cluster-single-coherent-narrative',
            'no-junk-drawer-clusters',
            'no-silently-merged-jobs',
            'cluster-rationale-references-constituent-transcripts',
          ],
          name: 'clustering-precision-checker',
        }),
        // JTBD-clarity reviewer — pedantic check that every JTBD statement
        // follows the canonical "When [situation], I want to [motivation],
        // so I can [outcome]" structure (or equivalent), that no statement
        // is solution-shaped disguised as a job, and that the importance
        // score is grounded in the cited evidence.
        Personas.pedantic({
          domain: 'jtbd-clarity',
          rubric: [
            'every-statement-follows-when-i-want-so-i-can-structure',
            'no-solution-shaped-jobs',
            'importance-score-grounded-in-evidence',
            'no-vague-motivation-language',
          ],
          name: 'jtbd-clarity-checker',
        }),
        // Evidence-traceability reviewer — adversarially probes whether
        // every JTBD has a transcript-citation trail that survives a
        // back-trace audit, and whether the speaker-role metadata is
        // consistent across cited snippets.
        Personas.skeptic({
          domain: 'evidence-traceability',
          focus: [
            'every-jtbd-has-back-traceable-transcript-citations',
            'speaker-role-consistent-across-snippets',
            'no-paraphrased-quotes-presented-as-verbatim',
            'no-orphaned-evidence-citations',
          ],
          name: 'evidence-traceability-reviewer',
        }),
        // Factual-accuracy reviewer — citation-required + 3+ citations per
        // claim. Every JTBD claim must be corroborated by at least three
        // transcript citations before the product-strategy-lead signs.
        Personas.factualAccuracy({
          citationRequired: true,
          minCitationsPerClaim: 3,
          name: 'factual-accuracy-checker',
        }),
        // Scope-clarity reviewer — JTBD doc is a project-brief-shaped
        // artefact; the scope-boundary and out-of-scope claims must hold
        // the project-brief-grade clarity bar before product-strategy-lead
        // signs.
        Personas.scopeClarity({
          artifactType: 'project-brief',
          name: 'scope-clarity-checker',
        }),
        // Product domain reviewer — pulls the senior-product-manager
        // expert for judgment on the overall JTBD-doc quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/ProductManagers',
          name: 'product-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:jobs-to-be-done-clusterer:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-product-strategy-lead',
      seller: 'svc:jobs-to-be-done-clusterer',
      serviceRef: 'svc:jobs-to-be-done-clusterer',
      // Product-strategy-lead signs every JTBD doc before it emits —
      // strategic-product-decision authority cannot be delegated.
      predicate: AND(
        SchemaMatch(JobsToBeDoneOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['product-strategy-lead'] })
      ),
      // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
      amount: { amount: 299900n, currency: 'USD' },
      // 7-day SLA — JTBD clustering takes a week from discovery-round-
      // complete intake to product-strategy-lead-signed doc.
      timeoutDays: 7,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        { id: 'small-round', amount: 99900n },
        { id: 'standard-round', amount: 299900n },
        { id: 'enterprise-round', amount: 999900n },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 9000n, perApiCall: 16n },
    reward: kr_jtbdAlignedFeatureConversion,

    lineage: {
      cellRef: 'business.org.ai/cells/product-managers/jobs-to-be-done-clusterer',
      icpContextProblemRef: 'icp:jobs-to-be-done-clusterer:v1',
      foundingHypothesisRef: 'fh:jobs-to-be-done-clusterer:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
