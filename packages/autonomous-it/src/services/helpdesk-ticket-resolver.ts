/**
 * Helpdesk Ticket Resolver Service — Tier-1/Tier-2 IT helpdesk ticket triage
 * + auto-resolution Service for the IT-ops catalog.
 *
 * Distinguishing shape vs. siblings (`endpoint-fleet-monitor`,
 * `identity-lifecycle-orchestrator`):
 *   - `triage` archetype — the artefact is an IT-tech-reviewed (on non-trivial
 *     cases) ticket-resolution record + tracking update + remote-action result,
 *     not an endpoint-fleet drift report and not a joiner/mover/leaver
 *     identity-orchestration runbook;
 *   - 5-step cascade: Code fan-in (ticket payload + user-context + asset-
 *     inventory + similar past tickets) → Generative (classify-issue +
 *     severity + auto-resolution-feasibility) → Generative (draft resolution
 *     or escalation: KB-article-link + step-by-step + remote-action permission
 *     request) → Human (IT-tech review on non-trivial cases) → Code (apply
 *     resolution + emit ticket update + tracking);
 *   - `Pricing.perInvocation` 3 tiers keyed on resolution path —
 *     auto-resolved / tech-assisted / escalated ($19 / $99 / $399) — the
 *     resolver is worth more on a tech-assisted resolution than on a fully-
 *     auto case, and worth even more on an escalation that turns into a
 *     real on-call interrupt;
 *   - declarative HITL = mandatory IT-tech review on non-trivial cases (the
 *     IT-tech owns approval authority on remote-actions touching the
 *     employee endpoint surface — `approval` rationale, not `regulatory`);
 *     OutcomeContract requires IT-tech signature on any non-auto-resolved
 *     ticket;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(classification-
 *     precision + resolution-actionability + user-comms-clarity))`.
 *
 * Per design v3 §3 (Catalog HOW it-ops) + §6 (binding triggers, conditional
 * HumanSign) + §7 (per-invocation tiered pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `ticket-deflection-rate-and-mean-time-to-resolution`
 * — the compound metric every IT-helpdesk org optimises against (the resolver
 * is worth running iff ticket-deflection-rate AND mean-time-to-resolution
 * both beat the pre-Service baseline at parity ticket-mix + parity employee-
 * count).
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
 * Input — a helpdesk ticket submitted into intake. Tight: 8 fields cover
 * the ticket identity, the helpdesk system the ticket lives in, the
 * submitter (user) profile pointer for context fan-in, the channel the
 * ticket arrived on, the inbound subject + body, the asset-inventory
 * reference (so the cascade can scope auto-actions to the right device),
 * the assigned IT-tech routing target for the review step, and the
 * declared SLA tier the OutcomeContract sizes its timeout-policy against.
 */
export const HelpdeskTicketResolverInputSchema = z.object({
  ticketId: z.string(),
  helpdeskSystem: z.enum(['zendesk', 'jira-servicedesk', 'freshservice', 'servicenow', 'gitlab']),
  submittedAt: z.string(), // ISO-8601
  submitter: z.object({
    userRef: z.string(),
    department: z.string().optional(),
    seniority: z.enum(['ic', 'manager', 'director', 'vp', 'cxo']).optional(),
    primaryDeviceRef: z.string().optional(),
  }),
  channel: z.enum(['email', 'web-portal', 'slack', 'teams', 'walk-up', 'phone']),
  inboundContent: z.object({
    subject: z.string(),
    body: z.string(),
    attachmentRefs: z.array(z.string()).default([]),
  }),
  assetInventoryRef: z.string(),
  assignedItTechRef: z.string(),
  declaredSlaTier: z.enum(['standard', 'priority', 'vip']).default('standard'),
})

/**
 * Output — an IT-tech-reviewed (on non-trivial cases) ticket-resolution
 * record: the fan-in snapshot (user-context + asset-inventory + similar-
 * past-tickets), the classification + severity + auto-resolution-feasibility
 * judgement, the drafted resolution-or-escalation pack (KB-article-link +
 * step-by-step + remote-action permission request), the tech-review audit
 * (when triggered), the applied resolution log, and the emitted ticket
 * update + tracking record.
 */
export const HelpdeskTicketResolverOutputSchema = z.object({
  ticketId: z.string(),
  fanInSnapshot: z.object({
    userContext: z.object({
      userRef: z.string(),
      tenureBand: z.enum(['under-90-days', 'tenured', 'long-tenured']).optional(),
      priorTicketCount90d: z.number().int().nonnegative(),
      activeProjectsRefs: z.array(z.string()).default([]),
    }),
    assetSnapshot: z.object({
      primaryDeviceRef: z.string().optional(),
      osPlatform: z.enum(['macos', 'windows', 'linux', 'chromeos', 'ios', 'android']).optional(),
      mdmEnrolled: z.boolean(),
      lastCheckInIso: z.string().optional(),
    }),
    similarPastTickets: z.array(
      z.object({
        ticketRef: z.string(),
        similarityScore: z.number().min(0).max(1),
        resolutionPath: z.enum(['auto-resolved', 'tech-assisted', 'escalated']),
        resolutionSummary: z.string(),
      })
    ),
  }),
  classification: z.object({
    issueCategory: z.enum([
      'access-or-permissions',
      'sso-or-mfa',
      'password-reset',
      'software-install-or-license',
      'hardware-fault',
      'connectivity-or-vpn',
      'email-or-collaboration',
      'printer-or-peripheral',
      'security-or-malware',
      'mobile-device',
      'how-to-or-training',
      'other',
    ]),
    severity: z.enum(['low', 'medium', 'high', 'urgent']),
    autoResolutionFeasibility: z.enum([
      'auto-resolvable',
      'auto-resolvable-with-permission',
      'tech-assisted-required',
      'escalation-required',
    ]),
    rationale: z.string(),
  }),
  draftedResolution: z.object({
    summary: z.string(),
    kbArticleLinks: z
      .array(
        z.object({
          articleRef: z.string(),
          articleUrl: z.string(),
          relevanceScore: z.number().min(0).max(1),
        })
      )
      .default([]),
    stepByStep: z.array(z.string()).min(1),
    remoteActionRequest: z
      .object({
        actionKind: z.enum([
          'reset-password',
          'unlock-account',
          'reinstall-app',
          'reissue-mfa-factor',
          'wipe-device',
          'rotate-cert',
          'remote-shell',
          'patch-install',
        ]),
        targetAssetRef: z.string(),
        permissionScope: z.enum(['user-consent', 'tech-elevated', 'security-elevated']),
        rationale: z.string(),
      })
      .optional(),
    escalationRecommendation: z
      .object({
        escalateTo: z.enum([
          'tier-2-tech',
          'on-call-engineer',
          'security-on-call',
          'vendor-support',
        ]),
        reason: z.string(),
      })
      .optional(),
  }),
  techReview: z
    .object({
      reviewerRef: z.string(),
      decision: z.enum(['approve', 'approve-with-edits', 'request-revision', 'reject']),
      notes: z.string().optional(),
      reviewedAt: z.string(),
    })
    .optional(),
  appliedResolution: z.object({
    resolutionPath: z.enum(['auto-resolved', 'tech-assisted', 'escalated']),
    appliedActions: z.array(
      z.object({
        actionId: z.string(),
        actionKind: z.string(),
        targetAssetRef: z.string().optional(),
        appliedAt: z.string(),
        outcome: z.enum(['succeeded', 'partial', 'failed', 'skipped']),
        outcomeNote: z.string().optional(),
      })
    ),
    userCommsMarkdown: z.string(),
  }),
  ticketUpdate: z.object({
    ticketRef: z.string(),
    status: z.enum(['resolved', 'pending-user', 'escalated', 'in-progress']),
    updatedAt: z.string(),
    trackingRef: z.string(),
  }),
  generatedAt: z.string(),
})

export type HelpdeskTicketResolverInput = z.infer<typeof HelpdeskTicketResolverInputSchema>
export type HelpdeskTicketResolverOutput = z.infer<typeof HelpdeskTicketResolverOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_deflectionAndMttr: RewardSignal = {
  keyResultRef: 'kr:helpdesk-ticket-resolver:ticket-deflection-rate-and-mean-time-to-resolution',
}
const kr_fanInCoverage: RewardSignal = {
  keyResultRef: 'kr:helpdesk-ticket-resolver:fan-in-coverage',
}
const kr_classificationPrecision: RewardSignal = {
  keyResultRef: 'kr:helpdesk-ticket-resolver:classification-precision',
}
const kr_resolutionActionability: RewardSignal = {
  keyResultRef: 'kr:helpdesk-ticket-resolver:resolution-actionability',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:helpdesk-ticket-resolver:emit-latency',
}

// ============================================================================
// Helpdesk Ticket Resolver Service
// ============================================================================

/**
 * Helpdesk Ticket Resolver — IT helpdesk ticket submitted →
 * IT-tech-reviewed-on-non-trivial-cases ticket-resolution record + tracking
 * update + remote-action result as a Service.
 *
 * Cascade: fetch-ticket-user-context-asset-inventory-and-similar-past-tickets (Code, fan-in)
 *        → classify-issue-severity-and-auto-resolution-feasibility (Generative)
 *        → draft-resolution-or-escalation-with-KB-link-step-by-step-and-remote-action-permission-request (Generative)
 *        → IT-tech-review-on-non-trivial-cases (Human, approval rationale)
 *        → apply-resolution-and-emit-ticket-update-and-tracking (Code, fan-out).
 */
export const helpdeskTicketResolver: ServiceInstance<
  HelpdeskTicketResolverInput,
  HelpdeskTicketResolverOutput
> = Service.define<HelpdeskTicketResolverInput, HelpdeskTicketResolverOutput>({
  name: 'Helpdesk Ticket Resolver',
  promise:
    'Every IT-helpdesk ticket lands as a classified, drafted, and (where appropriate) auto-applied resolution — KB-article-grounded step-by-step plus remote-action permission request when needed — with an IT-tech review backstop on non-trivial cases, so ticket-deflection-rate climbs AND mean-time-to-resolution drops without sacrificing employee-comms quality.',
  audience: 'business',
  archetype: 'triage',
  schema: {
    input: HelpdeskTicketResolverInputSchema,
    output: HelpdeskTicketResolverOutputSchema,
  },

  binding: {
    cascade: [
      Code({
        name: 'fetch-ticket-user-context-asset-inventory-and-similar-past-tickets',
        reward: kr_fanInCoverage,
        handler: () => undefined,
      }),
      Generative({
        name: 'classify-issue-severity-and-auto-resolution-feasibility',
        reward: kr_classificationPrecision,
      }),
      Generative({
        name: 'draft-resolution-or-escalation-with-KB-link-step-by-step-and-remote-action-permission-request',
        reward: kr_resolutionActionability,
      }),
      Human({
        name: 'IT-tech-review-on-non-trivial-cases',
        // `approval` rationale: the IT-tech owns approval authority on
        // remote-actions touching the employee endpoint surface and on
        // escalations leaving the helpdesk queue. Not `regulatory` — the
        // gate is operational ownership, not compliance accountability
        // (compare `endpoint-fleet-monitor` IT-lead → `regulatory`).
        rationale: 'approval',
        expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
      }),
      Code({
        name: 'apply-resolution-and-emit-ticket-update-and-tracking',
        reward: kr_emitLatency,
        handler: () => undefined,
      }),
    ],
    toolPermissions: [
      'zendesk.tickets',
      'jira.servicedesk',
      'freshservice.tickets',
      'servicenow.incidents',
      'hris.read',
      'asset-inventory.read',
      'mdm.read',
      'mdm.actions',
      'idp.read',
      'idp.password-reset',
      'kb.search',
      'comms.notify',
      'audit-log.write',
    ],
    // Helpdesk intake: clarification disabled — the cascade synthesises
    // from the ticket body + user-context + asset snapshot; the IT-tech
    // review step is the single human contact point on non-trivial cases,
    // and the user-comms output is the contact point with the submitter.
    clarificationPolicy: { enabled: false },
    triggers: [
      {
        // VIP-tier tickets and `urgent` severity always escalate the
        // review step to a senior IT-tech regardless of the auto-
        // resolution-feasibility judgement (the senior backstops
        // synthesis quality on the highest-stakes tier).
        when: 'declaredSlaTier == "vip" || classification.severity == "urgent"',
        action: 'escalate',
      },
      {
        // Non-trivial cases (auto-resolvable-with-permission /
        // tech-assisted-required / escalation-required) route through the
        // IT-tech review step before the remote-action applies; fully
        // auto-resolvable cases skip the human gate.
        when: 'classification.autoResolutionFeasibility != "auto-resolvable"',
        action: 'route-to',
        target: 'IT-tech-review-on-non-trivial-cases',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:helpdesk-ticket-resolver-review',
    personas: [
      // Classification-precision reviewer — pedantic check that the
      // issue-category, severity, and auto-resolution-feasibility
      // judgement each cite the specific signal (ticket body excerpt,
      // asset-inventory state, similar-past-ticket reference) that
      // supports the call. Guards against "scanner says malware so we
      // assume malware" hand-waving.
      Personas.pedantic({
        domain: 'classification-precision',
        rubric: [
          'issue-category-cites-ticket-body-or-similar-ticket-evidence',
          'severity-cites-asset-or-user-impact-evidence',
          'auto-resolution-feasibility-tracks-classification-and-asset-state',
          'no-classification-claim-without-evidence',
          'similar-past-ticket-references-actually-similar',
        ],
        name: 'classification-precision-checker',
      }),
      // Resolution-actionability reviewer — adversarially probes whether
      // the drafted step-by-step is concretely actionable for the
      // submitter (or for the IT-tech, when escalated), whether the
      // remote-action request cites a target asset + permission scope,
      // and whether escalation recommendations cite a specific
      // escalation target.
      Personas.skeptic({
        domain: 'resolution-actionability',
        focus: [
          'step-by-step-cites-concrete-clicks-not-vague-instructions',
          'remote-action-request-cites-target-asset-and-permission-scope',
          'escalation-recommendation-cites-specific-target',
          'kb-article-links-actually-relevant',
          'no-instruction-undefined-on-platform-specifics',
        ],
        name: 'resolution-actionability-reviewer',
      }),
      // Empathy reviewer — empathy + tone-fit review on the user-comms
      // output. Helpdesk replies must read as reassuring (the submitter
      // is frustrated, often blocked) and audience-appropriate
      // (employee, not external customer).
      Personas.empathy({
        audienceType: 'employee',
        sentimentTarget: 'reassuring',
        name: 'empathy-reviewer',
      }),
      // Factual-accuracy reviewer — every load-bearing claim in the
      // user-comms (e.g. "your VPN client is up to date", "this KB
      // article applies to your device") must cite at least one source
      // (asset-inventory pull, KB article, similar-past-ticket).
      Personas.factualAccuracy({
        minCitationsPerClaim: 1,
        name: 'factual-accuracy-reviewer',
      }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:helpdesk-ticket-resolver:v1',
    $type: 'OutcomeContract',
    buyer: 'role:tenant-it-helpdesk-lead',
    seller: 'svc:helpdesk-ticket-resolver',
    serviceRef: 'svc:helpdesk-ticket-resolver',
    // Predicate is `AND(SchemaMatch + EvaluatorPass)` only — the IT-tech
    // signature is conditional on classification feasibility (see
    // binding.triggers); fully auto-resolvable tickets do not require a
    // human signature, so the OutcomeContract leaves HumanSign off the
    // gating predicate. Non-trivial cases are routed to the human gate
    // by the trigger and the schema records the review audit.
    predicate: AND(
      SchemaMatch(HelpdeskTicketResolverOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
    ),
    // Mid-tier amount; the per-tier amounts are in `pricing.tiers`.
    amount: { amount: 9900n, currency: 'USD' },
    // Sub-day SLA — ticket resolution demands a draft within hours, not
    // days, especially on the VIP / urgent tiers.
    timeoutDays: 1,
    onTimeout: 'escalate',
  },

  pricing: Pricing.perInvocation({
    tiers: [
      {
        id: 'auto-resolved',
        amount: 1900n,
        includedPerMonth: 200,
        overage: 1900n,
      },
      {
        id: 'tech-assisted',
        amount: 9900n,
        includedPerMonth: 80,
        overage: 9900n,
      },
      {
        id: 'escalated',
        amount: 39900n,
        includedPerMonth: 20,
        overage: 39900n,
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'tenant-only',
  costModel: { perInvocation: 1500n, perApiCall: 6n },
  reward: kr_deflectionAndMttr,

  lineage: {
    cellRef: 'business.org.ai/cells/it-leads/helpdesk-ticket-resolver',
    icpContextProblemRef: 'icp:helpdesk-ticket-resolver:v1',
    foundingHypothesisRef: 'fh:helpdesk-ticket-resolver:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
