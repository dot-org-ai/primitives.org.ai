/**
 * Threat Model Author Service — threat modeling for new systems / features
 * Service for the security catalog.
 *
 * Distinguishing shape vs. siblings (`vuln-triager`,
 * `access-review-coordinator`, `phishing-simulation-orchestrator`,
 * `incident-response-orchestrator`, `compliance-audit-prepper`):
 *   - `quality-review` archetype — the artefact is a security-architect-
 *     approved STRIDE/PASTA threat model + linked mitigation tickets, not
 *     an incident-response coordination pack or an audit prep dossier;
 *   - 5-step cascade: Code fan-in (system design + dataflow + dependency
 *     graph + auth model + prior threat models) → Generative (STRIDE-or-
 *     PASTA enumeration of threats per component, with likelihood +
 *     impact scoring) → Generative (mitigations + risk-acceptance
 *     recommendations + monitoring watchpoints) → Human (security-architect
 *     + service-owner review) → Code (emit threat-model doc + linked
 *     mitigation tickets);
 *   - `Pricing.perInvocation` 3 tiers keyed on system scope: small-feature
 *     / service / cross-system-platform ($499 / $1,999 / $7,999) — value
 *     scales with the depth of dataflow + auth-model surface area;
 *   - declarative HITL = mandatory security-architect review (security-
 *     architect owns scoring + mitigation-actionability authority — no
 *     mitigation tickets open before the architect has signed). Service-
 *     owner co-reviews to ensure mitigations are buildable. OutcomeContract
 *     requires security-architect signature (premium rationale: human
 *     architectural reasoning is the value being sold);
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(threat-enumeration-
 *     completeness + scoring-soundness + mitigation-actionability) +
 *     HumanSign(security-architect))`.
 *
 * Per design v3 §3 (Catalog HOW security) + §6 (binding triggers, conditional
 * HumanSign) + §7 (per-invocation tiered pricing factory) + §8 (ProofPredicate
 * AND).
 *
 * Service-level reward = `post-launch-incident-rate-on-modeled-systems` —
 * the compound metric every appsec org optimises against (the author is
 * worth running iff the post-launch incident rate on threat-modeled systems
 * trends down vs. a parity-scope unmodeled baseline at parity time-since-
 * launch).
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
 * Input — a new service / feature pre-launch firing into intake. Tight: 8
 * fields cover the system identity, the modeling-scope tier (so the per-
 * tier per-invocation pricing resolves at intake), the chosen modeling
 * methodology (STRIDE / PASTA / both), the system-design + dataflow +
 * dependency + auth-model source pointers (the cascade fans-in against
 * these), the prior-threat-model lineage (so the synthesis carries
 * forward unresolved findings), the assigned security-architect routing
 * target, the service-owner routing target for the co-review, and the
 * mitigation-tracker fan-out target.
 */
export const ThreatModelInputSchema = z.object({
  systemRef: z.string(),
  systemName: z.string(),
  modelingScope: z.enum(['small-feature', 'service', 'cross-system-platform']),
  methodology: z.enum(['stride', 'pasta', 'stride-and-pasta']),
  sources: z.object({
    systemDesignRef: z.string(),
    dataflowDiagramRef: z.string(),
    dependencyGraphRef: z.string(),
    authModelRef: z.string(),
    priorThreatModelRefs: z.array(z.string()).default([]),
  }),
  componentInventory: z
    .array(
      z.object({
        componentRef: z.string(),
        componentKind: z.enum([
          'frontend',
          'api-gateway',
          'service',
          'worker',
          'database',
          'cache',
          'queue',
          'storage',
          'identity-provider',
          'third-party',
        ]),
        trustBoundary: z.enum(['public', 'tenant', 'internal', 'privileged']),
      })
    )
    .min(1),
  assignedSecurityArchitectRef: z.string(),
  assignedServiceOwnerRef: z.string(),
  mitigationTracker: z.enum(['jira', 'linear', 'github', 'gitlab']),
})

/**
 * Output — a security-architect-approved threat model + linked mitigation
 * tickets: the system-design snapshot, the per-component STRIDE/PASTA
 * threat enumeration with likelihood + impact scoring, the mitigations
 * + risk-acceptance recommendations + monitoring watchpoints, the per-
 * reviewer review audit, the emitted threat-model doc reference, and the
 * fan-out of opened mitigation tickets.
 */
export const ThreatModelOutputSchema = z.object({
  systemRef: z.string(),
  modelingScope: z.enum(['small-feature', 'service', 'cross-system-platform']),
  methodology: z.enum(['stride', 'pasta', 'stride-and-pasta']),
  systemDesignSnapshot: z.object({
    componentCount: z.number().int().nonnegative(),
    trustBoundaries: z.array(z.enum(['public', 'tenant', 'internal', 'privileged'])),
    externalDependencyCount: z.number().int().nonnegative(),
    inheritedFindingsFromPrior: z.array(
      z.object({
        priorThreatModelRef: z.string(),
        carriedFindingId: z.string(),
        status: z.enum(['unresolved', 'partially-mitigated', 'reopened']),
      })
    ),
  }),
  threatEnumeration: z
    .array(
      z.object({
        threatId: z.string(),
        componentRef: z.string(),
        category: z.enum([
          'spoofing',
          'tampering',
          'repudiation',
          'information-disclosure',
          'denial-of-service',
          'elevation-of-privilege',
        ]),
        attackerProfile: z.enum([
          'external-unauthenticated',
          'external-authenticated',
          'tenant-insider',
          'platform-insider',
          'supply-chain',
        ]),
        scenario: z.string(),
        likelihood: z.enum(['low', 'medium', 'high', 'critical']),
        impact: z.enum(['low', 'medium', 'high', 'critical']),
        riskScore: z.number().min(0).max(25),
        rationale: z.string(),
      })
    )
    .min(1),
  mitigations: z
    .array(
      z.object({
        mitigationId: z.string(),
        threatIds: z.array(z.string()).min(1),
        approach: z.enum([
          'control',
          'detection',
          'compensating-control',
          'risk-acceptance',
          'transfer',
          'avoid',
        ]),
        summary: z.string(),
        ownerTeamRef: z.string(),
        effortEstimate: z.enum(['hours', 'days', 'weeks']),
        residualRiskBand: z.enum(['low', 'medium', 'high']),
        residualRiskRationale: z.string(),
      })
    )
    .min(1),
  monitoringWatchpoints: z
    .array(
      z.object({
        watchpointId: z.string(),
        threatIds: z.array(z.string()).min(1),
        signalSource: z.enum(['siem', 'edr', 'cloud-audit', 'app-logs', 'waf', 'dlp', 'metrics']),
        detectionLogic: z.string(),
        alertSeverity: z.enum(['low', 'medium', 'high', 'critical']),
      })
    )
    .default([]),
  riskAcceptances: z
    .array(
      z.object({
        acceptanceId: z.string(),
        threatId: z.string(),
        rationale: z.string(),
        ownerRoleRef: z.string(),
        reevaluateAt: z.string(),
      })
    )
    .default([]),
  securityArchitectReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    notes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  serviceOwnerReview: z.object({
    reviewerRef: z.string(),
    decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
    buildabilityNotes: z.string().optional(),
    reviewedAt: z.string(),
  }),
  threatModelDoc: z.object({
    docRef: z.string(),
    docUrl: z.string(),
    emittedAt: z.string(),
  }),
  mitigationTickets: z.array(
    z.object({
      mitigationId: z.string(),
      tracker: z.enum(['jira', 'linear', 'github', 'gitlab']),
      issueRef: z.string(),
      ownerRef: z.string(),
      createdAt: z.string(),
    })
  ),
  generatedAt: z.string(),
})

export type ThreatModelInput = z.infer<typeof ThreatModelInputSchema>
export type ThreatModelOutput = z.infer<typeof ThreatModelOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_postLaunchIncidentRate: RewardSignal = {
  keyResultRef: 'kr:threat-model-author:post-launch-incident-rate-on-modeled-systems',
}
const kr_systemDesignFanInCoverage: RewardSignal = {
  keyResultRef: 'kr:threat-model-author:system-design-fan-in-coverage',
}
const kr_threatEnumerationCompleteness: RewardSignal = {
  keyResultRef: 'kr:threat-model-author:threat-enumeration-completeness',
}
const kr_mitigationActionability: RewardSignal = {
  keyResultRef: 'kr:threat-model-author:mitigation-actionability',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:threat-model-author:emit-latency',
}

// ============================================================================
// Threat Model Author Service
// ============================================================================

/**
 * Threat Model Author — new service / feature pre-launch + threat-model
 * required → security-architect-approved STRIDE/PASTA threat model +
 * linked mitigation tickets as a Service.
 *
 * Cascade: fetch-system-design-dataflow-dependency-graph-auth-model-and-prior-threat-models (Code, fan-in)
 *        → STRIDE-or-PASTA-analysis-enumerate-threats-by-component-and-likelihood-and-impact-scoring (Generative)
 *        → draft-mitigations-risk-acceptance-recommendations-and-monitoring-watchpoints (Generative)
 *        → security-architect-and-service-owner-review (Human, premium rationale)
 *        → emit-threat-model-doc-and-linked-mitigation-tickets (Code, fan-out).
 */
export const threatModelAuthor: ServiceInstance<ThreatModelInput, ThreatModelOutput> =
  Service.define<ThreatModelInput, ThreatModelOutput>({
    name: 'Threat Model Author',
    promise:
      'Every new service or feature pre-launch lands as a security-architect-approved STRIDE/PASTA threat model — per-component threat enumeration with likelihood + impact scoring, mitigations + risk-acceptance recommendations + monitoring watchpoints, and linked mitigation tickets — so the post-launch incident rate on modeled systems trends down vs. unmodeled peers at parity scope.',
    audience: 'business',
    archetype: 'quality-review',
    schema: { input: ThreatModelInputSchema, output: ThreatModelOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-system-design-dataflow-dependency-graph-auth-model-and-prior-threat-models',
          reward: kr_systemDesignFanInCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'STRIDE-or-PASTA-analysis-enumerate-threats-by-component-and-likelihood-and-impact-scoring',
          reward: kr_threatEnumerationCompleteness,
        }),
        Generative({
          name: 'draft-mitigations-risk-acceptance-recommendations-and-monitoring-watchpoints',
          reward: kr_mitigationActionability,
        }),
        Human({
          name: 'security-architect-and-service-owner-review',
          // `premium` rationale: security-architect human architectural
          // reasoning is the value being sold here. Buyers pay specifically
          // for a named architect's signature on the threat model + mitigation
          // ticket set. Service-owner co-review ensures mitigations are
          // buildable, but the premium-tier signature is the architect's.
          rationale: 'premium',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-threat-model-doc-and-linked-mitigation-tickets',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'design-docs.read',
        'dataflow-store.read',
        'sbom.read',
        'iam.read',
        'service-graph.read',
        'prior-threat-models.read',
        'docs.write',
        'jira.issues',
        'linear.issues',
        'github.issues',
        'gitlab.issues',
      ],
      // Pre-launch cadence: clarification disabled — the cascade synthesises
      // from the system-design + dataflow + dependency + auth-model + prior-
      // threat-model signals; the security-architect review step is the
      // single human contact point during model authoring.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Cross-system-platform scope (multi-service blast radius, multi-
          // tenant trust boundary, or third-party integration on the
          // critical path) escalates the threat-enumeration step to a
          // senior security-architect supervisor before the architect
          // review (the architect still signs, but a senior backstops
          // enumeration completeness on the highest-stakes tier).
          when: 'modelingScope == "cross-system-platform"',
          action: 'escalate',
        },
        {
          // Every threat model routes through the security-architect +
          // service-owner review before mitigation tickets open;
          // OutcomeContract enforces the architect signature, the trigger
          // primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'security-architect-and-service-owner-review',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:threat-model-author-review',
      personas: [
        // Threat-enumeration-completeness reviewer — pedantic check that
        // every component in the input inventory carries at least one
        // enumerated threat per relevant STRIDE category, that the
        // attacker-profile axis is exercised across the enumeration (no
        // single-attacker-profile blind spots), and that the
        // riskScore is consistent with likelihood × impact.
        Personas.pedantic({
          domain: 'threat-enumeration-completeness',
          rubric: [
            'every-component-has-at-least-one-stride-category-enumerated',
            'attacker-profile-axis-exercised-across-enumeration',
            'no-component-silently-omitted',
            'risk-score-consistent-with-likelihood-times-impact',
            'inherited-findings-from-prior-explicitly-carried-forward',
          ],
          name: 'threat-enumeration-completeness-checker',
        }),
        // Scoring-soundness reviewer — pedantic check that every threat
        // carries a non-trivial rationale (cites the specific component +
        // attacker-profile + scenario that supports the score) and that
        // likelihood + impact bands track the cited evidence.
        Personas.pedantic({
          domain: 'scoring-soundness',
          rubric: [
            'every-threat-has-cited-rationale',
            'likelihood-band-tracks-cited-evidence',
            'impact-band-tracks-blast-radius-and-data-classes',
            'no-score-without-rationale',
            'rationale-cites-component-attacker-profile-and-scenario',
          ],
          name: 'scoring-soundness-checker',
        }),
        // Mitigation-actionability reviewer — adversarially probes whether
        // every mitigation cites a concrete approach (control / detection
        // / compensating / acceptance / transfer / avoid), a named owner-
        // team, a realistic effort estimate, and an explicit residual-risk
        // band + rationale.
        Personas.skeptic({
          domain: 'mitigation-actionability',
          focus: [
            'every-mitigation-cites-approach',
            'every-mitigation-has-named-owner-team',
            'every-mitigation-has-realistic-effort-estimate',
            'every-mitigation-has-explicit-residual-risk-band',
            'no-mitigation-without-rationale',
          ],
          name: 'mitigation-actionability-reviewer',
        }),
        // Security-threat reviewer — adversarial security review across
        // the five surfaces specified in the spec (injection, data-
        // exfiltration, privilege-escalation, pii-leakage, denial-of-
        // service). Cross-checks that the enumeration adequately covers
        // each surface for systems where it is plausibly relevant.
        Personas.securityThreat({
          surfaces: [
            'injection',
            'data-exfiltration',
            'privilege-escalation',
            'pii-leakage',
            'denial-of-service',
          ],
          name: 'security-threat-reviewer',
        }),
        // Edge-case-coverage reviewer — enumerates whether the threat
        // model has been exercised against the seven edge-case domains
        // (empty-input, malformed-input, extreme-volume, concurrent-
        // modification, partial-failure, time-zone, localization) with
        // at least 5 edge cases per primary scenario.
        Personas.edgeCaseCoverage({
          minEdgeCasesPerScenario: 5,
          name: 'edge-case-coverage-checker',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:threat-model-author:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-security-architect',
      seller: 'svc:threat-model-author',
      serviceRef: 'svc:threat-model-author',
      // Security-architect signs every threat model before mitigation
      // tickets open — threat-modeling sign-off authority is premium
      // human work the buyer is paying specifically for.
      predicate: AND(
        SchemaMatch(ThreatModelOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['security-architect'] })
      ),
      // Mid-tier amount; the per-tier amounts are in `pricing.tiers`.
      amount: { amount: 199900n, currency: 'USD' },
      // 7-day SLA — pre-launch cadence + dataflow-and-auth-model fan-in
      // depth + architect-and-service-owner review depth means the
      // threat-model doc + mitigation tickets ship within a week.
      timeoutDays: 7,
      onTimeout: 'escalate',
    },

    pricing: Pricing.perInvocation({
      tiers: [
        {
          id: 'small-feature',
          amount: 49900n,
          includedPerMonth: 8,
          overage: 49900n,
        },
        {
          id: 'service',
          amount: 199900n,
          includedPerMonth: 4,
          overage: 199900n,
        },
        {
          id: 'cross-system-platform',
          amount: 799900n,
          includedPerMonth: 1,
          overage: 799900n,
        },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 16000n, perApiCall: 12n },
    reward: kr_postLaunchIncidentRate,

    lineage: {
      cellRef: 'business.org.ai/cells/security-leads/threat-model-author',
      icpContextProblemRef: 'icp:threat-model-author:v1',
      foundingHypothesisRef: 'fh:threat-model-author:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
