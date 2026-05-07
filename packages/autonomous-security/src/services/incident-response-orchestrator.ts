/**
 * Incident Response Orchestrator Service — security-incident response
 * coordination Service for the security catalog.
 *
 * Distinguishing shape vs. siblings (`vuln-triager`,
 * `access-review-coordinator`, `phishing-simulation-orchestrator`,
 * `threat-model-author`, `compliance-audit-prepper`):
 *   - `multi-step-research` archetype — the artefact is a CISO + GC-approved
 *     incident-response coordination pack (initial impact assessment +
 *     likely blast radius + IOC correlation + supervised-coordinated
 *     evidence collection + containment recommendations + comms strategy +
 *     incident timeline + post-update + regulatory-notification-prep), not
 *     a vuln triage record, an access review pack, a phishing simulation,
 *     a threat model, or an audit prep pack;
 *   - 5-phase cascade with an Agentic supervised-coordination middle:
 *     Code fan-in (current-detection + asset-context + breach-history) →
 *     Generative (synthesise initial-impact-assessment + likely-blast-
 *     radius + IOC-correlation) → Agentic supervised (coordinate evidence
 *     collection + containment recommendations + comms strategy) → Human
 *     (CISO + GC review and approve actions) → Code (emit incident
 *     timeline + post-update + regulatory-notification-prep);
 *   - `Pricing.outcome` 3 tiers keyed on declared incident severity:
 *     SEV2 / SEV1 / breach-with-disclosure ($4,999 / $19,999 / $99,999) —
 *     value scales with blast-radius + regulatory-disclosure depth;
 *   - declarative HITL = mandatory CISO + GC review-and-approve-actions
 *     (CISO owns containment authority; GC owns regulatory + privileged-
 *     info-handling authority). OutcomeContract requires BOTH signatures;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(impact-assessment-
 *     soundness + containment-actionability + comms-clarity) + HumanSign(CISO)
 *     + HumanSign(GC))`.
 *
 * Per design v3 §3 (Catalog HOW security) + §6 (binding triggers, conditional
 * HumanSign with multiple roles) + §7 (outcome pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `time-to-containment-and-time-to-disclosure-readiness`
 * — the compound metric every security-ops org optimises against during
 * SEV2+ incident response (the orchestrator is worth running iff time-to-
 * containment AND time-to-disclosure-readiness both beat the pre-Service
 * baseline at parity severity + parity blast-radius).
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
 * Input — a SEV2+ security incident declared into intake. Tight: 8 fields
 * cover the incident identity, the declared severity tier (so the per-tier
 * outcome pricing resolves at intake), the suspected nature, the affected
 * surface (services + data classes + tenant scope), the detection sources,
 * the assigned CISO + GC routing targets for the regulatory-grade approval
 * step, the breach-disclosure jurisdiction set (so the cascade sizes the
 * regulatory-notification-prep correctly), and the comms-channel fan-out
 * targets.
 */
export const IncidentResponseInputSchema = z.object({
  incidentId: z.string(),
  declaredSeverity: z.enum(['SEV2', 'SEV1', 'breach-with-disclosure']),
  declaredAt: z.string(), // ISO-8601
  suspectedNature: z.enum([
    'unauthorised-access',
    'data-exfiltration',
    'ransomware',
    'ddos',
    'supply-chain-compromise',
    'credential-leak',
    'insider-threat',
    'unknown',
  ]),
  affectedSurface: z.object({
    affectedServices: z.array(z.string()).min(1),
    affectedDataClasses: z
      .array(z.enum(['pii', 'phi', 'pci', 'financial', 'credentials', 'source-code', 'internal']))
      .default([]),
    tenantScope: z.enum(['single-tenant', 'multi-tenant', 'cross-tenant', 'platform-wide']),
    perimeterPosture: z.enum(['internet-facing', 'tenant-facing', 'internal-only']),
  }),
  detectionSources: z
    .array(
      z.object({
        sourceSystem: z.enum([
          'siem',
          'edr',
          'ids-ips',
          'cloud-audit',
          'waf',
          'dlp',
          'user-report',
          'third-party',
        ]),
        signalRef: z.string(),
        firstSeenAt: z.string(),
      })
    )
    .min(1),
  assignedCisoRef: z.string(),
  assignedGcRef: z.string(),
  disclosureJurisdictions: z
    .array(z.enum(['gdpr-eu', 'ccpa-ca', 'hipaa-us', 'pci-dss', 'sec-cyber', 'state-breach-laws']))
    .default([]),
  commsChannels: z
    .array(z.enum(['internal-employees', 'affected-customers', 'regulators', 'public-statement']))
    .default([]),
})

/**
 * Output — a CISO + GC-approved incident-response coordination pack: the
 * detection + asset-context + breach-history snapshot, the synthesised
 * initial impact assessment + likely-blast-radius + IOC-correlation, the
 * supervised-coordinated evidence collection + containment recommendations
 * + comms strategy, the CISO + GC review audit, the emitted incident
 * timeline, the post-update record, and the regulatory-notification-prep
 * dossier.
 */
export const IncidentResponseOutputSchema = z.object({
  incidentId: z.string(),
  declaredSeverity: z.enum(['SEV2', 'SEV1', 'breach-with-disclosure']),
  detectionSnapshot: z.object({
    correlatedSignals: z.array(
      z.object({
        signalRef: z.string(),
        sourceSystem: z.string(),
        firstSeenAt: z.string(),
        lastSeenAt: z.string(),
        observedIndicator: z.string(),
      })
    ),
    assetContext: z.object({
      affectedAssets: z.array(
        z.object({
          assetRef: z.string(),
          assetKind: z.enum(['service', 'database', 'storage', 'identity', 'network', 'endpoint']),
          ownerTeamRef: z.string(),
          dataSensitivity: z.enum(['restricted', 'confidential', 'internal']),
        })
      ),
      assetCount: z.number().int().nonnegative(),
    }),
    breachHistory: z.object({
      priorIncidentCount: z.number().int().nonnegative(),
      priorIncidentRefs: z.array(z.string()).default([]),
      priorIocOverlapCount: z.number().int().nonnegative(),
    }),
  }),
  initialImpactAssessment: z.object({
    confidenceBand: z.enum(['preliminary', 'corroborated', 'high-confidence']),
    likelyBlastRadius: z.enum([
      'contained',
      'service-wide',
      'tenant-wide',
      'cross-tenant',
      'global',
    ]),
    likelyDataClassesExposed: z
      .array(z.enum(['pii', 'phi', 'pci', 'financial', 'credentials', 'source-code', 'internal']))
      .default([]),
    estimatedAffectedSubjectCount: z.number().int().nonnegative().optional(),
    iocCorrelation: z.array(
      z.object({
        iocId: z.string(),
        iocKind: z.enum(['ip', 'domain', 'hash', 'ja3', 'user-agent', 'tool-signature']),
        iocValue: z.string(),
        correlatedSignalRefs: z.array(z.string()).min(1),
      })
    ),
    rationale: z.string(),
  }),
  containmentCoordination: z.object({
    evidenceCollectionPlan: z.array(
      z.object({
        evidenceItemId: z.string(),
        sourceSystem: z.string(),
        chainOfCustodyRef: z.string(),
        collectionStatus: z.enum(['queued', 'in-progress', 'collected', 'unavailable']),
      })
    ),
    containmentRecommendations: z
      .array(
        z.object({
          recommendationId: z.string(),
          action: z.enum([
            'rotate-credentials',
            'revoke-sessions',
            'isolate-host',
            'block-egress',
            'patch-in-place',
            'failover-tenant',
            'engage-third-party-ir',
          ]),
          targetAssetRefs: z.array(z.string()).min(1),
          urgency: z.enum(['immediate', 'within-1h', 'within-4h', 'within-24h']),
          expectedEffect: z.string(),
          residualRiskNote: z.string(),
        })
      )
      .min(1),
    commsStrategy: z.object({
      internalUpdateMarkdown: z.string(),
      affectedCustomerNoticeMarkdown: z.string().optional(),
      regulatorNoticeMarkdown: z.string().optional(),
      publicStatementMarkdown: z.string().optional(),
      cadence: z.enum(['hourly', 'every-4h', 'daily', 'on-material-change']),
    }),
  }),
  cisoReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve-all-actions', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  gcReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum([
      'approve-disclosure-strategy',
      'approve-with-edits',
      'request-revision',
      'reject',
    ]),
    privilegedInfoHandlingNotes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  incidentTimeline: z.object({
    timelineRef: z.string(),
    timelineUrl: z.string(),
    entries: z.array(
      z.object({
        entryAt: z.string(),
        actorRef: z.string(),
        action: z.string(),
      })
    ),
    emittedAt: z.string(),
  }),
  postUpdateRecord: z.object({
    postUpdateRef: z.string(),
    distributedToChannels: z.array(
      z.enum(['internal-employees', 'affected-customers', 'regulators', 'public-statement'])
    ),
    distributedAt: z.string(),
  }),
  regulatoryNotificationPrep: z.object({
    notificationDossierRef: z.string(),
    perJurisdiction: z.array(
      z.object({
        jurisdiction: z.enum([
          'gdpr-eu',
          'ccpa-ca',
          'hipaa-us',
          'pci-dss',
          'sec-cyber',
          'state-breach-laws',
        ]),
        clockStartAt: z.string(),
        statutoryDeadlineAt: z.string(),
        readinessStatus: z.enum(['drafted', 'reviewed', 'gc-approved', 'submitted']),
      })
    ),
    preparedAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type IncidentResponseInput = z.infer<typeof IncidentResponseInputSchema>
export type IncidentResponseOutput = z.infer<typeof IncidentResponseOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_containmentAndDisclosure: RewardSignal = {
  keyResultRef:
    'kr:incident-response-orchestrator:time-to-containment-and-time-to-disclosure-readiness',
}
const kr_detectionFanInCoverage: RewardSignal = {
  keyResultRef: 'kr:incident-response-orchestrator:detection-fan-in-coverage',
}
const kr_impactAssessmentSoundness: RewardSignal = {
  keyResultRef: 'kr:incident-response-orchestrator:impact-assessment-soundness',
}
const kr_containmentActionability: RewardSignal = {
  keyResultRef: 'kr:incident-response-orchestrator:containment-actionability',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:incident-response-orchestrator:emit-latency',
}

// ============================================================================
// Incident Response Orchestrator Service
// ============================================================================

/**
 * Incident Response Orchestrator — security-incident SEV2+ declared →
 * CISO + GC-approved incident-response coordination pack (impact assessment
 * + containment recommendations + comms strategy + incident timeline + post-
 * update + regulatory-notification-prep) as a Service.
 *
 * Cascade: fetch-current-detection-asset-context-and-breach-history (Code, fan-in)
 *        → synthesize-initial-impact-assessment-likely-blast-radius-and-IOC-correlation (Generative)
 *        → supervised-coordinate-evidence-collection-containment-recommendations-and-comms-strategy (Agentic, supervised)
 *        → CISO-and-GC-review-and-approve-actions (Human, regulatory rationale)
 *        → emit-incident-timeline-post-update-and-regulatory-notification-prep (Code, fan-out).
 */
export const incidentResponseOrchestrator: ServiceInstance<
  IncidentResponseInput,
  IncidentResponseOutput
> = Service.define<IncidentResponseInput, IncidentResponseOutput>({
  name: 'Incident Response Orchestrator',
  promise:
    'Every SEV2+ security incident lands as a CISO + GC-approved coordination pack — initial impact assessment with IOC correlation, supervised-coordinated evidence collection + containment recommendations, a comms strategy keyed to the disclosure jurisdiction set, an incident timeline + post-update, and regulatory-notification-prep — so the time-to-containment AND the time-to-disclosure-readiness both shrink from days to hours.',
  audience: 'business',
  archetype: 'multi-step-research',
  schema: { input: IncidentResponseInputSchema, output: IncidentResponseOutputSchema },

  binding: {
    cascade: [
      Code({
        name: 'fetch-current-detection-asset-context-and-breach-history',
        reward: kr_detectionFanInCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'synthesize-initial-impact-assessment-likely-blast-radius-and-IOC-correlation',
        reward: kr_impactAssessmentSoundness,
      }),
      Agentic({
        name: 'supervised-coordinate-evidence-collection-containment-recommendations-and-comms-strategy',
        // Supervised mode: the agentic loop fans across evidence-collection +
        // containment-recommendation + comms-strategy synthesis with a human
        // (CISO) backing every load-bearing action before it commits. The
        // agentic kind is the right shape here because the loop is multi-
        // tool, multi-target (assets + comms channels + jurisdictions) and
        // the order of operations matters (evidence-first, then contain,
        // then comms).
        mode: 'supervised',
        signOff: 'human',
        reward: kr_containmentActionability,
      }),
      Human({
        name: 'CISO-and-GC-review-and-approve-actions',
        // `regulatory` rationale: incident-response actions carry compliance-
        // tied accountability — SEC cyber, GDPR Art. 33, HIPAA breach-
        // notification, state breach laws all require a named human owner
        // on the disclosure-and-containment decision. The gate stays human
        // regardless of model accuracy.
        rationale: 'regulatory',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'emit-incident-timeline-post-update-and-regulatory-notification-prep',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'siem.search',
      'edr.events',
      'cloud-audit.read',
      'waf.events',
      'dlp.events',
      'asset-graph.read',
      'breach-history.read',
      'ioc-feeds.read',
      'comms-platform.draft',
      'evidence-store.write',
      'timeline.write',
      'regulator-portal.draft',
    ],
    // Incident intake: clarification disabled — the supervised agentic loop
    // is the proper escalation surface during incident response (the CISO
    // is the synchronous human contact point for clarifications, and the
    // agentic mid-step holds the open-question queue for them).
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // SEV1 / breach-with-disclosure incidents escalate the agentic
        // coordination step to a senior incident-commander before the
        // CISO + GC review (CISO + GC still sign, but a senior backstops
        // synthesis quality on the highest-stakes tier).
        when: 'declaredSeverity == "SEV1" || declaredSeverity == "breach-with-disclosure"',
        action: 'escalate',
      },
      {
        // Every incident routes through the CISO + GC review step before
        // the timeline + post-update + regulatory-notification-prep emit;
        // OutcomeContract enforces both signatures, the trigger primes
        // the queue.
        when: 'true',
        action: 'route-to',
        target: 'CISO-and-GC-review-and-approve-actions',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:incident-response-orchestrator-review',
    personas: [
      // Impact-assessment-soundness reviewer — pedantic check that the
      // initial impact assessment is grounded (every load-bearing claim
      // about blast radius or data-classes-exposed cites a corroborating
      // signal; IOC correlations cite at least one signal ref; confidence
      // band tracks the count + diversity of corroborating signals).
      Personas.pedantic({
        domain: 'impact-assessment-soundness',
        rubric: [
          'every-blast-radius-claim-cites-corroborating-signal',
          'every-data-classes-exposed-claim-cites-asset-context',
          'every-ioc-correlation-cites-at-least-one-signal-ref',
          'confidence-band-tracks-corroboration-count-and-diversity',
          'no-impact-claim-without-evidence',
        ],
        name: 'impact-assessment-soundness-checker',
      }),
      // Containment-actionability reviewer — adversarially probes whether
      // every containment recommendation cites concrete target assets,
      // realistic urgency, and an option-specific residual-risk note.
      Personas.skeptic({
        domain: 'containment-actionability',
        focus: [
          'every-recommendation-cites-target-asset-refs',
          'every-recommendation-has-realistic-urgency',
          'every-recommendation-has-specific-residual-risk-note',
          'evidence-collection-precedes-containment-where-appropriate',
          'no-recommendation-undefined-on-success-criteria',
        ],
        name: 'containment-actionability-reviewer',
      }),
      // Comms-clarity reviewer — pedantic check that the comms strategy
      // is internally consistent (cadence + per-channel notice content +
      // distribution list match) and that each per-channel notice is
      // pitched at the right register for that audience.
      Personas.pedantic({
        domain: 'comms-clarity',
        rubric: [
          'cadence-matches-severity-and-disclosure-jurisdictions',
          'internal-update-pitched-for-employees',
          'affected-customer-notice-pitched-for-end-users',
          'regulator-notice-cites-statutory-clock-start',
          'public-statement-mirrors-customer-notice-without-leaking-privileged-info',
        ],
        name: 'comms-clarity-checker',
      }),
      // Regulatory-compliance reviewer — GDPR-tier compliance check on
      // the regulatory-notification-prep dossier (Art. 33 72-hour clock,
      // per-jurisdiction statutory deadlines, GC-approval surface).
      Personas.regulatoryCompliance({
        regulator: 'gdpr',
        name: 'gdpr-compliance-reviewer',
      }),
      // Data-privacy reviewer — privacy-impact review on the comms
      // strategy + regulatory-notification-prep (no surplus PII in
      // internal updates, data-minimization on customer notices, named
      // PII categories scanned across the full set: name, email, phone,
      // ssn, health, financial).
      Personas.dataPrivacy({
        piiCategories: ['name', 'email', 'phone', 'ssn', 'health', 'financial'],
        name: 'data-privacy-reviewer',
      }),
      // Brand-safety reviewer — low-risk-tolerance brand check on the
      // public-statement + customer-notice surfaces (tone register,
      // reputational-risk floor, no privileged-info leaks).
      Personas.brandSafety({
        riskTolerance: 'low',
        name: 'brand-safety-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:incident-response-orchestrator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-ciso',
    seller: 'svc:incident-response-orchestrator',
    serviceRef: 'svc:incident-response-orchestrator',
    // Both CISO (containment authority) and GC (regulatory + privileged-
    // info-handling authority) sign every coordination pack before the
    // timeline + post-update + regulatory-notification-prep emit.
    predicate: AND(
      SchemaMatch(IncidentResponseOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      HumanSign({ signerRoles: ['ciso'] }),
      HumanSign({ signerRoles: ['gc'] })
    ),
    // Mid-tier amount; the per-tier amounts are in `pricing.tiers`.
    amount: { amount: 499900n, currency: 'USD' },
    // Sub-day SLA — incident response demands a coordination pack within
    // hours, not days, especially on the breach-with-disclosure tier
    // (GDPR Art. 33 carries a 72-hour statutory clock).
    timeoutDays: 1,
    onTimeout: 'escalate',
  },

  pricing: Pricing.outcome({
    tiers: [
      {
        id: 'SEV2',
        amount: 499900n,
        currency: 'USD',
        description:
          'SEV2 incident — service-wide impact, no confirmed data exposure. Coordination pack delivered within 24h. $4,999.',
      },
      {
        id: 'SEV1',
        amount: 1999900n,
        currency: 'USD',
        description:
          'SEV1 incident — tenant-wide or cross-tenant impact, suspected data exposure. Coordination pack delivered within 12h. $19,999.',
      },
      {
        id: 'breach-with-disclosure',
        amount: 9999900n,
        currency: 'USD',
        description:
          'Breach-with-disclosure incident — confirmed data exposure triggering one or more statutory notification clocks. Coordination pack + regulatory-notification-prep delivered within 6h. $99,999.',
      },
    ],
  }),

  refundContract: 'sla-credit-on-late-delivery',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 25000n, perApiCall: 22n },
  reward: kr_containmentAndDisclosure,

  lineage: {
    cellRef: 'business.org.ai/cells/security-leads/incident-response-orchestrator',
    icpContextProblemRef: 'icp:incident-response-orchestrator:v1',
    foundingHypothesisRef: 'fh:incident-response-orchestrator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
