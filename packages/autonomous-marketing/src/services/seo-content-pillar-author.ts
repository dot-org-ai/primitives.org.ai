/**
 * SEO Content Pillar Author Service — pillar-page authoring with cluster
 * strategy for the marketing catalog.
 *
 * Distinguishing shape vs. siblings (`campaign-brief-generator`,
 * `paid-ad-creative-iterator`):
 *   - `multi-step-research` archetype — the artefact is a pillar page +
 *     cluster-piece outlines published to the CMS with internal linking,
 *     not a campaign brief or ad-creative variant set;
 *   - 5-step cascade with one supervised Agentic SERP-research +
 *     topical-expertise-source-vetting step (the only Agentic step in the
 *     marketing catalog), bookended by Code fan-in (keyword research +
 *     competitor content + style guide) and Code fan-out (publish to CMS);
 *   - `Pricing.outcome` 3 tiers (S/M/L) keyed on pillar-cluster size
 *     ($799 / $2,999 / $8,999) — the pillar is worth more on a 20-piece
 *     cluster than a 3-piece cluster;
 *   - declarative HITL = mandatory content-lead review Human Function (the
 *     content-lead owns the editorial standard), plus OutcomeContract
 *     requires content-lead signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(topical-authority +
 *     e-e-a-t-signals + readability) + HumanSign(content-lead))`.
 *
 * Per design v3 §3 (Catalog HOW marketing) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `organic-rank-position-1-3-rate-on-target-keywords`
 * — the compound metric every SEO/content org optimises against (the
 * pillar is worth running iff target-keyword cluster ranks position 1-3
 * within the SLA window vs. the pre-Service baseline).
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
 * Input — a keyword cluster + content-gap-analysis declaration. Tight: 6
 * fields cover the cluster identity, the target keywords, the content-gap
 * findings, the target audience descriptor, the cluster-size band so the
 * outcome pricing tier is resolvable at intake, and the assigned
 * content-lead (so the Human review step routes to the right inbox).
 */
export const PillarClusterInputSchema = z.object({
  clusterId: z.string(),
  targetKeywords: z
    .array(
      z.object({
        keyword: z.string(),
        monthlySearchVolume: z.number().int().nonnegative(),
        difficulty: z.number().min(0).max(100),
      })
    )
    .min(1),
  contentGapFindings: z.array(z.string()).min(1),
  targetAudienceDescriptor: z.string(),
  clusterSizeBand: z.enum(['small', 'medium', 'large']),
  assignedContentLeadRef: z.string(),
})

/**
 * Output — a content-lead-reviewed pillar page + cluster outlines: the
 * researched SERP context, the pillar page draft, the per-cluster-piece
 * outlines, the content-lead review audit, and pointers to the published
 * CMS artefacts.
 */
export const PillarClusterOutputSchema = z.object({
  clusterId: z.string(),
  serpResearch: z.object({
    competingPages: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
        domainAuthority: z.number().min(0).max(100),
        contentDepthAssessment: z.string(),
      })
    ),
    expertiseSources: z.array(
      z.object({
        sourceUrl: z.string(),
        authorOrInstitution: z.string(),
        vettingNotes: z.string(),
      })
    ),
    topicalGapsToCover: z.array(z.string()),
  }),
  pillarPage: z.object({
    title: z.string(),
    metaDescription: z.string(),
    bodyMarkdown: z.string(),
    targetWordCount: z.number().int().positive(),
    internalLinkTargets: z.array(z.string()),
  }),
  clusterPieceOutlines: z
    .array(
      z.object({
        pieceId: z.string(),
        title: z.string(),
        targetKeyword: z.string(),
        sectionOutline: z.array(z.string()).min(1),
        suggestedWordCount: z.number().int().positive(),
      })
    )
    .min(1),
  contentLeadReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-and-publish', 'edit-and-publish', 'park', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  publishedArtefacts: z.object({
    pillarUrl: z.string(),
    cmsRefs: z.array(z.string()),
    publishedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type PillarClusterInput = z.infer<typeof PillarClusterInputSchema>
export type PillarClusterOutput = z.infer<typeof PillarClusterOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_organicRank: RewardSignal = {
  keyResultRef: 'kr:seo-content-pillar-author:organic-rank-position-1-3-rate-on-target-keywords',
}
const kr_keywordCoverage: RewardSignal = {
  keyResultRef: 'kr:seo-content-pillar-author:keyword-coverage',
}
const kr_serpResearchDepth: RewardSignal = {
  keyResultRef: 'kr:seo-content-pillar-author:serp-research-depth',
}
const kr_pillarDraftQuality: RewardSignal = {
  keyResultRef: 'kr:seo-content-pillar-author:pillar-draft-quality',
}
const kr_publishLatency: RewardSignal = {
  keyResultRef: 'kr:seo-content-pillar-author:publish-latency',
}

// ============================================================================
// SEO Content Pillar Author Service
// ============================================================================

/**
 * SEO Content Pillar Author — keyword cluster + content-gap analysis →
 * content-lead-reviewed pillar page + cluster outlines published to CMS as
 * a Service.
 *
 * Cascade: fetch-keyword-research-competitor-content-and-style-guide (Code, fan-in)
 *        → research-serp-leaders-and-vet-topical-expertise (Agentic, supervised)
 *        → draft-pillar-page-and-cluster-outlines (Generative)
 *        → content-lead-review (Human, premium rationale)
 *        → publish-to-cms-with-internal-linking (Code, fan-out).
 */
export const seoContentPillarAuthor: ServiceInstance<PillarClusterInput, PillarClusterOutput> =
  Service.define<PillarClusterInput, PillarClusterOutput>({
    name: 'SEO Content Pillar Author',
    promise:
      'Every keyword cluster + content-gap analysis becomes a content-lead-reviewed pillar page + cluster outlines published to CMS — topical authority + E-E-A-T signals + readability — without burning the editorial team on first drafts.',
    audience: 'business',
    archetype: 'multi-step-research',
    schema: { input: PillarClusterInputSchema, output: PillarClusterOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-keyword-research-competitor-content-and-style-guide',
          reward: kr_keywordCoverage,
          handler: () => undefined,
        }),
        Agentic({
          name: 'research-serp-leaders-and-vet-topical-expertise',
          reward: kr_serpResearchDepth,
          mode: 'supervised',
          oversight: { mode: 'supervised' },
        }),
        Generative({
          name: 'draft-pillar-page-and-cluster-outlines',
          reward: kr_pillarDraftQuality,
        }),
        Human({
          name: 'content-lead-review',
          // `premium` rationale: the content-lead's editorial judgment is
          // the value the customer pays for — the gate stays human.
          rationale: 'premium',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'publish-to-cms-with-internal-linking',
          reward: kr_publishLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'seo.keyword-research',
        'seo.serp-snapshots',
        'seo.competitor-content',
        'brand.style-guide',
        'web.search',
        'cms.pages',
        'cms.internal-links',
      ],
      // Pillar authoring: clarification disabled — the cascade synthesises
      // from the keyword research + SERP context; the content-lead review
      // step at the end is the single human contact point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Large-cluster pillars escalate the SERP-research step to a
          // senior content-strategist supervisor before the draft synthesis
          // runs.
          when: 'clusterSizeBand == "large"',
          action: 'escalate',
        },
        {
          // Every pillar routes through content-lead review before it
          // publishes; OutcomeContract enforces the signature, the trigger
          // primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'content-lead-review',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:seo-content-pillar-author-review',
      personas: [
        // Topical authority reviewer — adversarially probes whether the
        // pillar page actually demonstrates topical authority in the
        // cluster vs. surface-skim coverage of the keyword set.
        Personas.skeptic({
          domain: 'topical-authority',
          focus: ['depth-not-breadth', 'cites-vetted-sources', 'covers-topical-gaps'],
          name: 'topical-authority-reviewer',
        }),
        // E-E-A-T signals reviewer — pedantic check that the pillar carries
        // experience / expertise / authoritativeness / trust signals
        // (cited expert sources with vetting notes, author byline,
        // publish + review dates).
        Personas.pedantic({
          domain: 'e-e-a-t-signals',
          rubric: [
            'every-claim-has-cited-source',
            'expertise-source-vetting-notes-present',
            'author-byline-present',
            'publish-and-review-dates-present',
            'no-unsourced-statistics',
          ],
          name: 'e-e-a-t-checker',
        }),
        // Readability reviewer — pedantic check that the pillar copy hits
        // the target audience's reading level + uses headers + lists +
        // examples to break up dense prose.
        Personas.pedantic({
          domain: 'readability',
          rubric: [
            'target-audience-reading-level',
            'headers-and-subheaders-structured',
            'lists-and-examples-break-up-prose',
            'no-walls-of-text',
          ],
          name: 'readability-checker',
        }),
        // Marketing domain reviewer — pulls the senior-content-strategist
        // expert for judgment on the overall pillar + cluster strategy.
        Personas.domain({
          expertRef: 'occupations.org.ai/MarketingManagers',
          name: 'marketing-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:seo-content-pillar-author:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-content-lead',
      seller: 'svc:seo-content-pillar-author',
      serviceRef: 'svc:seo-content-pillar-author',
      // Content-lead signs every pillar before it publishes — the
      // editorial standard ownership cannot be delegated.
      predicate: AND(
        SchemaMatch(PillarClusterOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['content-lead'] })
      ),
      // Mid-tier amount; the per-tier contract amounts are in `pricing.tiers`.
      amount: { amount: 299900n, currency: 'USD' },
      // 7-day SLA — pillar authoring takes a week from cluster intake to
      // CMS-published.
      timeoutDays: 7,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        {
          id: 'small-cluster',
          amount: 79900n,
          currency: 'USD',
          description: 'Small cluster (3-5 pieces) pillar — $799.',
        },
        {
          id: 'medium-cluster',
          amount: 299900n,
          currency: 'USD',
          description: 'Medium cluster (6-12 pieces) pillar — $2,999.',
        },
        {
          id: 'large-cluster',
          amount: 899900n,
          currency: 'USD',
          description: 'Large cluster (13+ pieces) pillar — $8,999.',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 4500n, perApiCall: 12n },
    reward: kr_organicRank,

    lineage: {
      cellRef: 'business.org.ai/cells/marketing-managers/seo-content-pillar-author',
      icpContextProblemRef: 'icp:seo-content-pillar-author:v1',
      foundingHypothesisRef: 'fh:seo-content-pillar-author:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
