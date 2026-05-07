/**
 * Literature Review Synthesizer Service — multi-source literature review
 * for research initiatives.
 *
 * Distinguishing shape vs. siblings (`experiment-protocol-author`,
 * `manuscript-pre-submission-reviewer`):
 *   - `multi-step-research` archetype — PI-signed lit-review document +
 *     bibliographic export grounded in a citation graph spanning internal
 *     research + open literature;
 *   - 6-step cascade: Code (internal research + bibliography from collab
 *     tools) → Agentic (supervised search of PubMed / arXiv / Scholar +
 *     full-text retrieval) → Generative (synthesize themes + gaps +
 *     contradictions) → Generative (citation graph + recommended-reading
 *     priorities) → Human (PI review) → Code (emit doc + export);
 *   - `Pricing.outcome` 3 tiers — narrow / medium / comprehensive
 *     ($499 / $1,999 / $5,999) — keyed on source-count band;
 *   - declarative HITL = PI review Human Function (premium rationale; PI
 *     signs);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass + HumanSign(
 *     principal-investigator))`.
 *
 * Service-level reward =
 * `lit-review-cycle-time-reduction-and-citation-coverage-score`.
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

/** Input — a research question entering review with declared scope. */
export const LiteratureReviewInputSchema = z.object({
  initiativeRef: z.string(),
  researchQuestion: z.object({
    title: z.string(),
    framedQuestion: z.string(),
    background: z.string().optional(),
    targetAudience: z.enum([
      'internal-research-team',
      'grant-application',
      'manuscript-prep',
      'protocol-design',
    ]),
  }),
  scopeTier: z.enum(['narrow', 'medium', 'comprehensive']),
  domainAnchors: z.object({
    primaryField: z.string(),
    adjacentFields: z.array(z.string()).default([]),
    keyConcepts: z.array(z.string()).min(1),
    excludedTerms: z.array(z.string()).default([]),
  }),
  internalSources: z.object({
    collabToolRefs: z
      .array(z.enum(['notion', 'confluence', 'google-drive', 'sharepoint', 'slab', 'roam']))
      .default([]),
    referenceManagerRefs: z
      .array(z.enum(['zotero', 'mendeley', 'endnote', 'paperpile']))
      .default([]),
    priorReviewRefs: z.array(z.string()).default([]),
  }),
  openLiteratureSources: z
    .array(z.enum(['pubmed', 'arxiv', 'google-scholar', 'semantic-scholar', 'biorxiv', 'medrxiv']))
    .min(1),
  assignedPrincipalInvestigatorRef: z.string(),
  bibliographyExport: z.object({
    format: z.enum(['bibtex', 'ris', 'csl-json', 'endnote-xml']),
    targetRef: z.string(),
  }),
})

/** Output — PI-signed lit-review document + bibliographic export. */
export const LiteratureReviewOutputSchema = z.object({
  initiativeRef: z.string(),
  researchQuestion: z.object({
    title: z.string(),
    framedQuestion: z.string(),
  }),
  scopeTier: z.enum(['narrow', 'medium', 'comprehensive']),
  internalCorpusSnapshot: z.array(
    z.object({
      sourceRef: z.string(),
      sourceKind: z.enum([
        'internal-paper',
        'internal-memo',
        'collab-doc',
        'reference-manager-entry',
        'prior-review',
      ]),
      title: z.string(),
      authors: z.array(z.string()).default([]),
      indexedAt: z.string(),
    })
  ),
  openLiteratureRetrieval: z.object({
    queriesIssued: z
      .array(
        z.object({
          source: z.enum([
            'pubmed',
            'arxiv',
            'google-scholar',
            'semantic-scholar',
            'biorxiv',
            'medrxiv',
          ]),
          query: z.string(),
          resultCount: z.number().int().nonnegative(),
          retrievedAt: z.string(),
        })
      )
      .min(1),
    retrievedSources: z.array(
      z.object({
        sourceRef: z.string(),
        title: z.string(),
        authors: z.array(z.string()).min(1),
        venue: z.string().optional(),
        year: z.number().int().min(1800).max(2100),
        doi: z.string().optional(),
        sourceTier: z.enum(['primary', 'peer-reviewed', 'preprint', 'review-article']),
        fullTextAvailable: z.boolean(),
      })
    ),
    supervisorAuditRef: z.string(),
  }),
  themeSynthesis: z.object({
    themes: z
      .array(
        z.object({
          themeId: z.string(),
          label: z.string(),
          summary: z.string(),
          supportingSourceRefs: z.array(z.string()).min(1),
        })
      )
      .min(1),
    gaps: z
      .array(
        z.object({
          gapId: z.string(),
          description: z.string(),
          rationale: z.string(),
        })
      )
      .default([]),
    contradictions: z
      .array(
        z.object({
          contradictionId: z.string(),
          description: z.string(),
          conflictingSourceRefs: z.array(z.string()).min(2),
        })
      )
      .default([]),
  }),
  citationGraph: z.object({
    nodes: z
      .array(
        z.object({
          sourceRef: z.string(),
          centralityRank: z.number().int().nonnegative(),
        })
      )
      .min(1),
    edges: z
      .array(
        z.object({
          fromSourceRef: z.string(),
          toSourceRef: z.string(),
          edgeKind: z.enum(['cites', 'extends', 'critiques', 'replicates']),
        })
      )
      .default([]),
    recommendedReading: z
      .array(
        z.object({
          sourceRef: z.string(),
          priority: z.enum(['must-read', 'should-read', 'optional']),
          rationale: z.string(),
        })
      )
      .min(1),
  }),
  principalInvestigatorReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  reviewDocument: z.object({
    documentRef: z.string(),
    documentUrl: z.string(),
    emittedAt: z.string(),
  }),
  bibliographicExport: z.object({
    format: z.enum(['bibtex', 'ris', 'csl-json', 'endnote-xml']),
    exportRef: z.string(),
    targetRef: z.string(),
    exportedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type LiteratureReviewInput = z.infer<typeof LiteratureReviewInputSchema>
export type LiteratureReviewOutput = z.infer<typeof LiteratureReviewOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_litReviewCycleTimeAndCoverage: RewardSignal = {
  keyResultRef:
    'kr:literature-review-synthesizer:lit-review-cycle-time-reduction-and-citation-coverage-score',
}
const kr_internalCorpusCoverage: RewardSignal = {
  keyResultRef: 'kr:literature-review-synthesizer:internal-corpus-coverage',
}
const kr_openLiteratureRecall: RewardSignal = {
  keyResultRef: 'kr:literature-review-synthesizer:open-literature-recall',
}
const kr_themeAndGapPrecision: RewardSignal = {
  keyResultRef: 'kr:literature-review-synthesizer:theme-and-gap-precision',
}
const kr_citationGraphSoundness: RewardSignal = {
  keyResultRef: 'kr:literature-review-synthesizer:citation-graph-soundness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:literature-review-synthesizer:emit-latency',
}

// ============================================================================
// Literature Review Synthesizer Service
// ============================================================================

/**
 * Literature Review Synthesizer — research question + scope → PI-signed
 * lit-review doc + bibliographic export grounded in a citation graph
 * spanning internal research + open literature as a Service.
 */
export const literatureReviewSynthesizer: ServiceInstance<
  LiteratureReviewInput,
  LiteratureReviewOutput
> = Service.define<LiteratureReviewInput, LiteratureReviewOutput>({
  name: 'Literature Review Synthesizer',
  promise:
    'Every research question lands as a PI-signed literature-review document plus a bibliographic export — themes synthesised from internal corpus + supervised open-literature search, gaps and contradictions called out, a citation graph with prioritised reading — so the time from question framed to PI-approved review collapses from weeks to days at parity citation coverage.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: LiteratureReviewInputSchema, output: LiteratureReviewOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-existing-internal-research-and-bibliography-from-collab-tools',
        reward: kr_internalCorpusCoverage,
        handler: () => undefined,
      }),
      Agentic({
        name: 'supervised-search-of-pubmed-arxiv-scholar-and-retrieve-full-texts-where-allowed',
        reward: kr_openLiteratureRecall,
        mode: 'supervised',
      }),
      Generative({
        name: 'synthesize-themes-and-identify-gaps-and-contradictions',
        reward: kr_themeAndGapPrecision,
      }),
      Generative({
        name: 'draft-citation-graph-and-recommended-reading-priorities',
        reward: kr_citationGraphSoundness,
      }),
      Human({
        name: 'principal-investigator-review',
        // `premium` rationale: the PI's editorial-and-scientific judgement
        // applied to theme framing, gap identification, and recommended-
        // reading is the value being sold; gate stays human regardless of
        // model accuracy.
        rationale: 'premium',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-lit-review-doc-and-bibliographic-export',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'notion.read',
      'confluence.read',
      'google-drive.read',
      'sharepoint.read',
      'zotero.read',
      'mendeley.read',
      'pubmed.search',
      'arxiv.search',
      'google-scholar.search',
      'semantic-scholar.search',
      'biorxiv.search',
      'medrxiv.search',
      'fulltext.fetch',
      'docs.write',
      'bibliography.export',
    ],
    // Cascade synthesises from question + scope + domain anchors; PI
    // review is the single human contact surface.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Comprehensive-tier reviews escalate supervised search to a
        // senior research librarian before PI review.
        when: 'scopeTier == "comprehensive"',
        action: 'escalate',
      },
      {
        // Every review routes through PI review before emit.
        when: 'true',
        action: 'route-to',
        target: 'principal-investigator-review',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:literature-review-synthesizer-review',
    personas: [
      // Citation-density + source-quality reviewer — every load-bearing
      // claim carries ≥3 peer-reviewed / primary citations; guards against
      // hand-wavy synthesis that drifts from the corpus.
      Personas.factualAccuracy({
        citationRequired: true,
        sourceTypes: ['peer-reviewed', 'primary'],
        minCitationsPerClaim: 3,
        name: 'citation-density-and-source-quality-reviewer',
      }),
      // Scope-clarity reviewer — declares scope-boundary + out-of-scope
      // against the framed question (project-brief artifact); guards
      // against scope creep into an unbounded survey.
      Personas.scopeClarity({
        artifactType: 'project-brief',
        name: 'scope-clarity-reviewer',
      }),
      // Theme-coherence reviewer — every theme has a non-trivial summary,
      // supporting-source refs match the theme claim, and no source is
      // double-counted across mutually-exclusive themes.
      Personas.pedantic({
        domain: 'theme-coherence',
        rubric: [
          'every-theme-cites-at-least-one-supporting-source',
          'theme-summaries-non-trivial-and-grounded',
          'no-source-double-counted-across-mutually-exclusive-themes',
          'every-recommended-reading-cites-rationale',
          'centrality-rank-tracks-citation-graph-edges',
        ],
        name: 'theme-coherence-checker',
      }),
      // Gap-identification reviewer — gaps cite the specific corpus
      // slice (not "more research is needed"); contradictions name ≥2
      // conflicting sources with concrete competing claims.
      Personas.skeptic({
        domain: 'gap-identification',
        focus: [
          'every-gap-cites-the-specific-corpus-slice',
          'every-gap-rationale-non-trivial',
          'every-contradiction-cites-at-least-two-sources',
          'contradictions-state-the-specific-competing-claims',
          'no-trivial-more-research-is-needed-claims',
        ],
        name: 'gap-identification-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:literature-review-synthesizer:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-research-lead',
    seller: 'svc:literature-review-synthesizer',
    serviceRef: 'svc:literature-review-synthesizer',
    // PI signs every lit-review before the bibliographic export emits.
    predicate: AND(
      SchemaMatch(LiteratureReviewOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['principal-investigator'] })
    ),
    // Mid-tier; per-tier amounts in `pricing.tiers`.
    amount: { amount: 199900n, currency: 'USD' },
    // 14-day SLA.
    timeoutDays: 14,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'narrow',
        amount: 49900n,
        currency: 'USD',
        description:
          'Narrow scope (single sub-question, ≤25 sources, single domain). PI-signed brief. $499.',
      },
      {
        id: 'medium',
        amount: 199900n,
        currency: 'USD',
        description:
          'Medium scope (multi-aspect question, 25–100 sources, primary domain + adjacents). PI-signed standard review. $1,999.',
      },
      {
        id: 'comprehensive',
        amount: 599900n,
        currency: 'USD',
        description:
          'Comprehensive scope (broad-corpus, 100+ sources, multi-domain with citation-graph centrality analysis). PI-signed deep review. $5,999.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 18000n, perApiCall: 9n },
  reward: kr_litReviewCycleTimeAndCoverage,

  lineage: {
    cellRef: 'business.org.ai/cells/research-leads/literature-review-synthesizer',
    icpContextProblemRef: 'icp:literature-review-synthesizer:v1',
    foundingHypothesisRef: 'fh:literature-review-synthesizer:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
