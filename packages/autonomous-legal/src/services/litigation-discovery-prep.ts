/**
 * Litigation Discovery Prep Service — discovery-document review + privilege-
 * log builder for the legal catalog.
 *
 * Distinguishing shape vs. siblings (`contract-reviewer`,
 * `policy-impact-analyzer`, `ip-disclosure-triage`,
 * `compliance-attestation-author`, `regulatory-filing-drafter`):
 *   - `quality-review` archetype — the artefact is a litigation-counsel-signed
 *     production-set + privilege-log + redaction package against a discovery
 *     request, not a third-party-contract redline (sibling `contract-reviewer`),
 *     a forward-looking jurisdictional impact memo (sibling
 *     `policy-impact-analyzer`), an invention-disclosure triage decision
 *     (sibling `ip-disclosure-triage`), an SOC2/ISO27001/HIPAA attestation
 *     packet (sibling `compliance-attestation-author`), or an SEC/FINRA
 *     regulatory filing (sibling `regulatory-filing-drafter`);
 *   - 5-step cascade: Code fan-in (fetch document corpus + custodian list +
 *     matter context + privilege policy) → Generative (per-document
 *     classification: responsive / non-responsive / privileged /
 *     partially-privileged-with-redactions) → Generative (draft privilege-log
 *     entries + redaction rationale) → Human (litigation-counsel review and
 *     attest) → Code (emit production set + privilege log + audit trail);
 *   - `Pricing.outcome` 3 tiers keyed on corpus size — small-corpus /
 *     medium-corpus / large-corpus ($1,999 / $9,999 / $49,999) — privilege-log
 *     defensibility scales with corpus size and custodian count, and the price
 *     follows the audited per-doc-review-cost-reduction the production set
 *     yields against the e-discovery-vendor / contract-attorney baseline;
 *   - declarative HITL = mandatory litigation-counsel attestation Human
 *     Function (litigation-counsel owns courtroom-defensibility authority on
 *     privilege calls — only litigation-counsel can attest that a privilege
 *     log is complete and that no responsive-non-privileged document was
 *     withheld), plus OutcomeContract requires litigation-counsel signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(privilege-
 *     classification-accuracy + redaction-completeness +
 *     GDPR-regulatoryCompliance + dataPrivacy[name+email+phone+health+
 *     financial]) + HumanSign(litigation-counsel))`.
 *
 * Per design v3 §3 (Catalog HOW legal) + §6 (binding triggers, conditional
 * HumanSign) + §7 (outcome pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `per-doc-review-cost-reduction-and-privilege-log-
 * defensibility` — the compound metric every litigation team optimises against
 * (the prep is worth running iff per-document-reviewed cost drops vs. the
 * contract-attorney baseline AND privilege-log challenges from opposing
 * counsel resolve in the producing party's favour at-or-above the historical
 * baseline).
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
 * Input — a discovery request received against an active matter (or a
 * pre-trial deadline approaching) routed to the litigation-prep intake
 * channel. Tight: 8 fields cover the matter identity, the discovery-request
 * pointer the cascade fans-in against, the corpus locator + declared corpus
 * size (so the outcome-tier pricing is resolvable at intake), the custodian
 * list, the matter-context bundle (court, jurisdiction, opposing-counsel,
 * date-range, claims-at-issue), the privilege-policy reference the
 * classification step grades against, the production deadline, and the
 * assigned litigation-counsel reviewer.
 */
export const DiscoveryRequestInputSchema = z.object({
  matterId: z.string(),
  discoveryRequest: z.object({
    requestId: z.string(),
    requestDocumentUrl: z.string(),
    receivedAt: z.string(), // ISO-8601
    requestKind: z.enum([
      'requests-for-production',
      'interrogatories',
      'requests-for-admission',
      'subpoena-duces-tecum',
      'third-party-subpoena',
    ]),
  }),
  documentCorpus: z.object({
    corpusLocator: z.string(),
    declaredSize: z.enum(['small-corpus', 'medium-corpus', 'large-corpus']),
    documentCount: z.number().int().nonnegative(),
    totalSizeBytes: z.bigint(),
  }),
  custodians: z
    .array(
      z.object({
        custodianRef: z.string(),
        roleAtTimeOfFacts: z.string(),
        dateRangeStart: z.string(), // ISO-8601
        dateRangeEnd: z.string(), // ISO-8601
      })
    )
    .min(1),
  matterContext: z.object({
    court: z.string(),
    jurisdiction: z.string(),
    opposingCounsel: z.string(),
    claimsAtIssue: z.array(z.string()).min(1),
    relevantDateRangeStart: z.string(),
    relevantDateRangeEnd: z.string(),
  }),
  privilegePolicyRef: z.string(),
  productionDeadline: z.string(), // ISO-8601
  assignedLitigationCounselRef: z.string(),
})

/**
 * Output — a litigation-counsel-attested production package: the corpus
 * snapshot + custodian roll, the per-document classification roll, the
 * drafted privilege-log entries + redaction rationale, the litigation-counsel
 * attestation audit, and pointers to the emitted production-set +
 * privilege-log + audit-trail artefacts.
 */
export const DiscoveryProductionOutputSchema = z.object({
  matterId: z.string(),
  corpusSnapshot: z.object({
    corpusLocator: z.string(),
    documentCount: z.number().int().nonnegative(),
    custodianCount: z.number().int().nonnegative(),
    snapshotSha256: z.string(),
  }),
  perDocumentClassifications: z
    .array(
      z.object({
        documentId: z.string(),
        custodianRef: z.string(),
        classification: z.enum([
          'responsive',
          'non-responsive',
          'privileged',
          'partially-privileged-with-redactions',
        ]),
        privilegeKind: z
          .enum([
            'attorney-client',
            'work-product',
            'common-interest',
            'self-critical-analysis',
            'not-privileged',
          ])
          .optional(),
        rationale: z.string(),
        confidenceScore: z.number().min(0).max(1),
      })
    )
    .min(0),
  privilegeLog: z
    .array(
      z.object({
        logEntryId: z.string(),
        documentId: z.string(),
        privilegeAsserted: z.enum([
          'attorney-client',
          'work-product',
          'common-interest',
          'self-critical-analysis',
        ]),
        author: z.string(),
        recipients: z.array(z.string()),
        dateOfDocument: z.string(),
        subjectDescription: z.string(),
        basisForPrivilege: z.string(),
      })
    )
    .min(0),
  redactions: z
    .array(
      z.object({
        redactionId: z.string(),
        documentId: z.string(),
        pageRef: z.number().int().positive(),
        redactionRationale: z.string(),
        redactionScope: z.enum([
          'attorney-client-quote',
          'work-product-mental-impressions',
          'pii',
          'trade-secret',
          'other',
        ]),
      })
    )
    .min(0),
  litigationCounselAttestation: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['attest', 'attest-with-edits', 'request-revision', 'reject']),
    attestationStatement: z.string(),
    notes: z.string().optional(),
    attestedAt: z.string(),
  }),
  artefacts: z.object({
    productionSetUrl: z.string(),
    privilegeLogUrl: z.string(),
    auditTrailUrl: z.string(),
    emittedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type DiscoveryRequestInput = z.infer<typeof DiscoveryRequestInputSchema>
export type DiscoveryProductionOutput = z.infer<typeof DiscoveryProductionOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_perDocReviewCostReduction: RewardSignal = {
  keyResultRef:
    'kr:litigation-discovery-prep:per-doc-review-cost-reduction-and-privilege-log-defensibility',
}
const kr_corpusFanInCoverage: RewardSignal = {
  keyResultRef: 'kr:litigation-discovery-prep:corpus-fan-in-coverage',
}
const kr_classificationAccuracy: RewardSignal = {
  keyResultRef: 'kr:litigation-discovery-prep:per-doc-classification-accuracy',
}
const kr_privilegeLogQuality: RewardSignal = {
  keyResultRef: 'kr:litigation-discovery-prep:privilege-log-and-redaction-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:litigation-discovery-prep:emit-latency',
}

// ============================================================================
// Litigation Discovery Prep Service
// ============================================================================

/**
 * Litigation Discovery Prep — discovery request received → litigation-counsel-
 * attested production set + privilege log + audit trail as a Service.
 *
 * Cascade: fetch-document-corpus-and-custodian-list-and-matter-context-and-privilege-policy (Code, fan-in)
 *        → per-document-classification (Generative)
 *        → draft-privilege-log-entries-and-redaction-rationale (Generative)
 *        → litigation-counsel-review-and-attest (Human, regulatory rationale)
 *        → emit-production-set-and-privilege-log-and-audit-trail (Code, fan-out).
 */
export const litigationDiscoveryPrep: ServiceInstance<
  DiscoveryRequestInput,
  DiscoveryProductionOutput
> = Service.define<DiscoveryRequestInput, DiscoveryProductionOutput>({
  $id: 'svc:litigation-discovery-prep',
  name: 'Litigation Discovery Prep',
  promise:
    'Every discovery request lands a litigation-counsel-attested production set + privilege log + audit trail inside the production deadline — per-document classification + privilege calls + redactions — so per-doc-review cost falls below the contract-attorney baseline while privilege-log defensibility holds at-or-above prior-art under opposing-counsel challenge.',
  audience: 'business',
  archetype: 'quality-review',
  schema: { input: DiscoveryRequestInputSchema, output: DiscoveryProductionOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-document-corpus-and-custodian-list-and-matter-context-and-privilege-policy',
        reward: kr_corpusFanInCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'per-document-classification',
        reward: kr_classificationAccuracy,
      }),
      Generative({
        name: 'draft-privilege-log-entries-and-redaction-rationale',
        reward: kr_privilegeLogQuality,
      }),
      Human({
        name: 'litigation-counsel-review-and-attest',
        // `regulatory` rationale: courtroom-defensibility authority on
        // privilege calls sits with litigation-counsel — only litigation-
        // counsel can attest that the privilege log is complete and that no
        // responsive-non-privileged document was withheld. The gate stays
        // human regardless of model accuracy.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-production-set-and-privilege-log-and-audit-trail',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'matter-registry.read',
      'discovery-intake.read',
      'document-corpus.read',
      'custodian-registry.read',
      'privilege-policy.read',
      'classification-engine.write',
      'privilege-log-engine.write',
      'redaction-engine.write',
      'production-set.write',
      'audit-trail.write',
    ],
    // Discovery prep: clarification disabled — the cascade synthesises from
    // the discovery request + corpus + custodian list + matter context +
    // privilege policy; the litigation-counsel attestation step is the
    // single human contact point in the cascade.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // Large-corpus matters escalate the per-document classification
        // step to a senior litigation-counsel supervisor before the routine
        // attestation (the litigation-counsel still attests, but the
        // supervisor backstops the synthesis on the highest-stakes corpus
        // size — privilege-log challenges scale super-linearly with corpus
        // size).
        when: 'documentCorpus.declaredSize == "large-corpus"',
        action: 'escalate',
      },
      {
        // Every production routes through litigation-counsel attestation
        // before the production set + privilege log emit; OutcomeContract
        // enforces the signature, the trigger primes the queue.
        when: 'true',
        action: 'route-to',
        target: 'litigation-counsel-review-and-attest',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:litigation-discovery-prep-review',
    personas: [
      // Privilege-classification-accuracy reviewer — pedantic check that
      // every document receives a classification, every privilege call cites
      // the privilege-policy rule, and the privilege-kind matches the
      // recipient list (attorney-client requires lawyer on the to/from line,
      // work-product requires litigation-anticipated context, etc). The
      // risk this guards against is "over-claim of privilege" or
      // "under-claim of privilege" — both yield motion-to-compel exposure.
      Personas.pedantic({
        domain: 'privilege-classification-accuracy',
        rubric: [
          'every-document-classified',
          'every-privilege-call-cites-the-policy-rule',
          'privilege-kind-matches-recipient-list',
          'no-silent-classification-skips',
          'confidence-scores-justified',
        ],
        name: 'privilege-classification-accuracy-checker',
      }),
      // Redaction-completeness reviewer — adversarially probes whether the
      // redactions on partially-privileged documents catch the full
      // privileged passage (no orphan privileged sentences left visible)
      // and whether the redaction-scope label matches the actual content
      // redacted (no PII redacted under a work-product label, etc).
      Personas.skeptic({
        domain: 'redaction-completeness',
        focus: [
          'every-partially-privileged-doc-has-redactions',
          'no-orphan-privileged-passages-visible',
          'redaction-scope-matches-content',
          'pii-redactions-distinguished-from-privilege-redactions',
          'no-hand-waves',
        ],
        name: 'redaction-completeness-reviewer',
      }),
      // Regulatory-compliance reviewer — GDPR-tier pass over the production
      // set + redactions. Catches cross-border discovery + DSAR-overlap
      // issues before litigation-counsel attests.
      Personas.regulatoryCompliance({ regulator: 'gdpr' }),
      // Data-privacy reviewer — explicit PII scan over the production set
      // (name, email, phone, health, financial) so partial-redaction calls
      // catch PII before the production ships to opposing counsel.
      Personas.dataPrivacy({
        piiCategories: ['name', 'email', 'phone', 'health', 'financial'],
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:litigation-discovery-prep:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-litigation-counsel',
    seller: 'svc:litigation-discovery-prep',
    serviceRef: 'svc:litigation-discovery-prep',
    // Litigation-counsel attests every production package before it ships
    // to opposing counsel — courtroom-defensibility authority on privilege
    // calls cannot be delegated.
    predicate: AND(
      SchemaMatch(DiscoveryProductionOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['litigation-counsel'] })
    ),
    // Mid-tier amount; the per-tier outcome amounts are in `pricing.tiers`.
    amount: { amount: 999900n, currency: 'USD' },
    // 14-day SLA — discovery production runs on multi-week rhythms; the
    // production package lands inside two weeks so the production-deadline
    // backstop has a buffer.
    timeoutDays: 14,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'small-corpus',
        amount: 199900n,
        currency: 'USD',
        description:
          'Small corpus — single-custodian, < 10k documents, single-jurisdiction matter. $1,999.',
      },
      {
        id: 'medium-corpus',
        amount: 999900n,
        currency: 'USD',
        description:
          'Medium corpus — multi-custodian, 10k-100k documents, single-jurisdiction matter. $9,999.',
      },
      {
        id: 'large-corpus',
        amount: 4999900n,
        currency: 'USD',
        description:
          'Large corpus — multi-custodian, 100k+ documents, multi-jurisdiction or cross-border matter. $49,999.',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 25000n, perApiCall: 30n },
  reward: kr_perDocReviewCostReduction,

  lineage: {
    cellRef: 'business.org.ai/cells/litigation-counsel/litigation-discovery-prep',
    icpContextProblemRef: 'icp:litigation-discovery-prep:v1',
    foundingHypothesisRef: 'fh:litigation-discovery-prep:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
