/**
 * Regulatory Filing Drafter Service — regulatory filings drafter (Form D /
 * 10-K / 10-Q sections / FINRA filings) for the legal catalog.
 *
 * Distinguishing shape vs. siblings (`contract-reviewer`,
 * `policy-impact-analyzer`, `ip-disclosure-triage`,
 * `litigation-discovery-prep`, `compliance-attestation-author`):
 *   - `content-generation` archetype — the artefact is a GC + CFO co-signed
 *     draft regulatory filing package (Form D / 10-K / 10-Q section / FINRA
 *     filing) with citations to source data + materiality coverage +
 *     submission-readiness checklist, not a third-party-contract redline
 *     (sibling `contract-reviewer`), a forward-looking jurisdictional impact
 *     memo (sibling `policy-impact-analyzer`), an invention-disclosure
 *     triage decision (sibling `ip-disclosure-triage`), a courtroom
 *     production package (sibling `litigation-discovery-prep`), or an SOC2/
 *     ISO27001/HIPAA attestation packet (sibling
 *     `compliance-attestation-author`);
 *   - 5-step cascade: Code fan-in (financial data + corporate structure +
 *     prior filings + regulatory template) → Generative (draft filing
 *     sections with citations to source data) → Generative (internal
 *     consistency check + completeness check + materiality disclosure pass)
 *     → Human (GC + CFO review and sign) → Code (emit filing package +
 *     submission-readiness checklist);
 *   - `Pricing.outcome` 3 tiers keyed on filing kind — form-d / 10-q-section /
 *     10-k-or-s-1 ($999 / $4,999 / $19,999) — a Form D notice filing is worth
 *     less than a 10-K with full MD&A + risk factors + audited financials;
 *   - declarative HITL = mandatory dual-sign GC + CFO Human Function (the
 *     GC owns regulatory-filing-binding authority, the CFO owns financial-
 *     data-attestation authority — public-issuer filings carry Section 10(b)
 *     + Section 18 personal-liability exposure that requires both signers),
 *     plus OutcomeContract requires BOTH GC and CFO signatures;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(citation-density +
 *     materiality-coverage + style-guide-conformance + SEC-regulatoryCompliance +
 *     factualAccuracy[first-party,government]) + HumanSign(GC) +
 *     HumanSign(CFO))`.
 *
 * Per design v3 §3 (Catalog HOW legal) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND with
 * dual-signer requirement).
 *
 * Service-level reward = `filing-on-time-rate-and-amendment-rate-reduction` —
 * the compound metric every public-company / regulated-entity legal team
 * optimises against (the drafter is worth running iff filings ship on or
 * before the regulatory deadline AND post-filing amendment rate drops vs.
 * the prior baseline — amendments are the costliest signal of a filing-
 * quality miss).
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
 * Input — a regulatory-filing trigger (filing deadline approaching OR new
 * filing requirement triggered) routed to the regulatory-filing intake
 * channel. Tight: 9 fields cover the filing identity, the filing kind +
 * declared scope (so the outcome-tier pricing is resolvable at intake), the
 * regulator + form ID, the reporting period, the source-data references the
 * cascade fans-in against, the corporate-structure pointer, the prior-filing
 * reference, the regulatory-template + style-guide references the drafting
 * step grades against, the targeted submission date, and the assigned GC +
 * CFO reviewers.
 */
export const FilingDraftInputSchema = z.object({
  filingId: z.string(),
  filingKind: z.enum([
    'form-d',
    '10-q-section',
    '10-k-or-s-1',
    'form-8-k',
    'finra-filing',
    'form-adv',
  ]),
  declaredScope: z.enum(['form-d', '10-q-section', '10-k-or-s-1']),
  regulator: z.enum(['sec', 'finra', 'state-securities', 'fdic', 'occ']),
  formId: z.string(),
  reportingPeriod: z.object({
    periodStart: z.string(), // ISO-8601
    periodEnd: z.string(), // ISO-8601
  }),
  sourceData: z.object({
    financialDataRef: z.string(),
    corporateStructureRef: z.string(),
    materialEventsRef: z.string().optional(),
    legalProceedingsRef: z.string().optional(),
    riskFactorsRef: z.string().optional(),
  }),
  priorFilingRef: z.string().optional(),
  templateAndStyle: z.object({
    regulatoryTemplateRef: z.string(),
    styleGuideRef: z.string(),
  }),
  targetSubmissionDate: z.string(), // ISO-8601
  reviewers: z.object({
    generalCounselRef: z.string(),
    cfoRef: z.string(),
  }),
})

/**
 * Output — a GC + CFO co-signed regulatory-filing draft package: the source-
 * data snapshot + corporate-structure snapshot, the drafted filing sections
 * with per-section citations, the consistency + completeness + materiality
 * QA pass, the dual-reviewer audit, and pointers to the emitted filing
 * package + submission-readiness checklist.
 */
export const FilingDraftOutputSchema = z.object({
  filingId: z.string(),
  filingKind: z.string(),
  sourceSnapshot: z.object({
    financialDataSha256: z.string(),
    corporateStructureSha256: z.string(),
    snapshotCapturedAt: z.string(),
  }),
  filingSections: z
    .array(
      z.object({
        sectionId: z.string(),
        sectionTitle: z.string(),
        contentMarkdown: z.string(),
        citations: z
          .array(
            z.object({
              citationId: z.string(),
              sourceRef: z.string(),
              sourceKind: z.enum([
                'first-party-financial-data',
                'first-party-corporate-document',
                'government-regulation',
                'government-template',
                'prior-filing',
              ]),
              quoteOrLineRef: z.string(),
            })
          )
          .min(1),
      })
    )
    .min(1),
  qualityChecks: z.object({
    internalConsistency: z.object({
      summaryMarkdown: z.string(),
      issuesFound: z
        .array(
          z.object({
            issueId: z.string(),
            sectionId: z.string(),
            description: z.string(),
            severity: z.enum(['low', 'med', 'high', 'blocker']),
          })
        )
        .min(0),
    }),
    completeness: z.object({
      summaryMarkdown: z.string(),
      missingSections: z.array(z.string()),
    }),
    materialityCoverage: z.object({
      summaryMarkdown: z.string(),
      materialItemsDisclosed: z.array(z.string()),
      materialItemsOmitted: z
        .array(
          z.object({
            itemId: z.string(),
            description: z.string(),
            omissionRationale: z.string(),
          })
        )
        .min(0),
    }),
  }),
  reviews: z.object({
    generalCounsel: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    }),
    cfo: z.object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    }),
  }),
  artefacts: z.object({
    filingPackageUrl: z.string(),
    submissionReadinessChecklistUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type FilingDraftInput = z.infer<typeof FilingDraftInputSchema>
export type FilingDraftOutput = z.infer<typeof FilingDraftOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_filingOnTimeRate: RewardSignal = {
  keyResultRef: 'kr:regulatory-filing-drafter:filing-on-time-rate-and-amendment-rate-reduction',
}
const kr_sourceDataFanInCoverage: RewardSignal = {
  keyResultRef: 'kr:regulatory-filing-drafter:source-data-fan-in-coverage',
}
const kr_citationDensity: RewardSignal = {
  keyResultRef: 'kr:regulatory-filing-drafter:citation-density',
}
const kr_consistencyAndCompleteness: RewardSignal = {
  keyResultRef: 'kr:regulatory-filing-drafter:consistency-and-completeness',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:regulatory-filing-drafter:emit-latency',
}

// ============================================================================
// Regulatory Filing Drafter Service
// ============================================================================

/**
 * Regulatory Filing Drafter — filing deadline approaching → GC + CFO co-
 * signed regulatory-filing draft (Form D / 10-Q section / 10-K / S-1 / 8-K /
 * FINRA / Form ADV) with per-section citations + consistency + materiality
 * QA + submission-readiness checklist as a Service.
 *
 * Cascade: fetch-financial-data-and-corporate-structure-and-prior-filings-and-regulatory-template (Code, fan-in)
 *        → draft-filing-sections-with-citations-to-source-data (Generative)
 *        → internal-consistency-check-and-completeness-check-and-materiality-disclosure-pass (Generative)
 *        → gc-and-cfo-review-and-sign (Human, regulatory rationale)
 *        → emit-filing-package-and-submission-readiness-checklist (Code, fan-out).
 */
export const regulatoryFilingDrafter: ServiceInstance<FilingDraftInput, FilingDraftOutput> =
  Service.define<FilingDraftInput, FilingDraftOutput>({
    $id: 'svc:regulatory-filing-drafter',
    name: 'Regulatory Filing Drafter',
    promise:
      'Every regulatory filing (Form D / 10-Q section / 10-K / S-1 / 8-K / FINRA / Form ADV) ships as a GC + CFO co-signed draft package with per-section citations + materiality coverage + submission-readiness checklist — so filings land on or before the regulatory deadline and the post-filing amendment rate drops below the prior baseline.',
    audience: 'business',
    archetype: 'content-generation',
    schema: { input: FilingDraftInputSchema, output: FilingDraftOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-financial-data-and-corporate-structure-and-prior-filings-and-regulatory-template',
          reward: kr_sourceDataFanInCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'draft-filing-sections-with-citations-to-source-data',
          reward: kr_citationDensity,
        }),
        Generative({
          name: 'internal-consistency-check-and-completeness-check-and-materiality-disclosure-pass',
          reward: kr_consistencyAndCompleteness,
        }),
        Human({
          name: 'gc-and-cfo-review-and-sign',
          // `regulatory` rationale: regulatory-filing-binding authority sits
          // with the GC + CFO jointly — Section 10(b) + Section 18 personal-
          // liability exposure on public-issuer filings means the gate stays
          // human regardless of model accuracy. OutcomeContract requires
          // BOTH GC and CFO signatures.
          rationale: 'regulatory',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-filing-package-and-submission-readiness-checklist',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'financial-data-store.read',
        'corporate-structure.read',
        'prior-filings.read',
        'regulatory-template-store.read',
        'style-guide.read',
        'material-events-log.read',
        'legal-proceedings-registry.read',
        'risk-factors-registry.read',
        'filing-engine.write',
        'submission-checklist.write',
        'audit-trail.write',
      ],
      // Filing draft: clarification disabled — the cascade synthesises from
      // the financial data + corporate structure + prior filings + regulatory
      // template + style guide; the GC + CFO review step is the single human
      // contact point in the cascade.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // 10-K and S-1 filings escalate the materiality-disclosure step to
          // a senior securities-counsel supervisor before the routine GC +
          // CFO review (the GC + CFO still sign, but the supervisor backstops
          // the synthesis on the highest-stakes filing kinds — annual report
          // + registration statement carry the broadest materiality
          // surface area and the most protracted SEC-comment exposure).
          when: 'declaredScope == "10-k-or-s-1"',
          action: 'escalate',
        },
        {
          // Every filing routes through GC + CFO review before the package
          // emits; OutcomeContract enforces both signatures, the trigger
          // primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'gc-and-cfo-review-and-sign',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:regulatory-filing-drafter-review',
      personas: [
        // Citation-density reviewer — pedantic check that every load-bearing
        // factual claim in every filing section carries an inline citation
        // back to source data (financial-data-store, corporate-structure,
        // prior filing, government template), no section is citation-thin
        // (every paragraph anchored), and citation source-kinds match the
        // claim type (financial figures cite financial data, not prior
        // filings). The risk this guards against is "fabricated figure" or
        // "uncited material claim" — the most expensive failure mode for a
        // public-issuer filing.
        Personas.pedantic({
          domain: 'citation-density',
          rubric: [
            'every-load-bearing-claim-cited',
            'every-section-citation-anchored',
            'citation-source-kind-matches-claim-type',
            'no-fabricated-figures',
            'no-uncited-material-claims',
          ],
          name: 'citation-density-checker',
        }),
        // Materiality-coverage reviewer — adversarially probes whether the
        // materiality disclosure pass surfaces every material item from the
        // source data (legal proceedings, related-party transactions, risk
        // factors, MD&A trends, subsequent events) vs. surface-level "we
        // disclosed the major items" hand-waving. Omitted-with-rationale is
        // OK; silently-omitted is not.
        Personas.skeptic({
          domain: 'materiality-coverage',
          focus: [
            'every-material-event-disclosed-or-explicitly-omitted',
            'omission-rationales-defensible',
            'related-party-transactions-evaluated',
            'risk-factors-current',
            'subsequent-events-evaluated',
            'no-hand-waves',
          ],
          name: 'materiality-coverage-reviewer',
        }),
        // Style-guide-conformance reviewer — pedantic check against the
        // company-or-firm regulatory-filing style guide (defined-term usage,
        // numerical-formatting conventions, plain-English compliance for
        // SEC filings, exhibit-cross-reference style). The risk this guards
        // against is "house-style drift" that triggers SEC comment letters
        // on otherwise-substantively-correct disclosures.
        Personas.pedantic({
          domain: 'style-guide-conformance',
          rubric: [
            'defined-terms-consistent',
            'numerical-formatting-consistent',
            'plain-english-compliance-for-sec-filings',
            'exhibit-cross-references-resolve',
            'section-numbering-matches-template',
          ],
          name: 'style-guide-conformance-checker',
        }),
        // Regulatory-compliance reviewer — SEC-tier pass over the proposed
        // filing draft. Catches Reg-FD + Item-303 (MD&A) + Item-105 (risk
        // factors) + Item-303(b) (off-balance-sheet arrangements) issues
        // before the GC + CFO sign.
        Personas.regulatoryCompliance({ regulator: 'sec' }),
        // Factual-accuracy reviewer — every load-bearing claim in the
        // filing must cite first-party financial / corporate sources or
        // government regulations / templates only; first-party blogs,
        // industry-standard frameworks, and peer-reviewed sources don't
        // qualify for an SEC-or-FINRA filing.
        Personas.factualAccuracy({
          citationRequired: true,
          sourceTypes: ['first-party', 'government'],
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:regulatory-filing-drafter:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-general-counsel',
      seller: 'svc:regulatory-filing-drafter',
      serviceRef: 'svc:regulatory-filing-drafter',
      // Both GC AND CFO sign every regulatory-filing draft before submission —
      // Section 10(b) + Section 18 personal-liability exposure means
      // regulatory-filing authority is dual-signer, not delegable to either
      // signer alone.
      predicate: AND(
        SchemaMatch(FilingDraftOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['general-counsel'] }),
        HumanSign({ signerRoles: ['cfo'] })
      ),
      // Mid-tier amount; the per-tier outcome amounts are in `pricing.tiers`.
      amount: { amount: 499900n, currency: 'USD' },
      // 21-day SLA — regulatory filings run on monthly + quarterly + annual
      // rhythms; the package lands inside three weeks so the GC + CFO have
      // runway and the SEC + FINRA submission windows have buffer.
      timeoutDays: 21,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        {
          id: 'form-d',
          amount: 99900n,
          currency: 'USD',
          description:
            'Form D notice filing — Reg D / Reg A exempt-offering notice, single-tier complexity. $999.',
        },
        {
          id: '10-q-section',
          amount: 499900n,
          currency: 'USD',
          description:
            '10-Q section — quarterly report section (financials, MD&A, risk factors, controls). $4,999.',
        },
        {
          id: '10-k-or-s-1',
          amount: 1999900n,
          currency: 'USD',
          description:
            '10-K or S-1 — annual report or registration statement, full materiality + risk-factor + MD&A surface. $19,999.',
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 30000n, perApiCall: 35n },
    reward: kr_filingOnTimeRate,

    lineage: {
      cellRef: 'business.org.ai/cells/general-counsel/regulatory-filing-drafter',
      icpContextProblemRef: 'icp:regulatory-filing-drafter:v1',
      foundingHypothesisRef: 'fh:regulatory-filing-drafter:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
