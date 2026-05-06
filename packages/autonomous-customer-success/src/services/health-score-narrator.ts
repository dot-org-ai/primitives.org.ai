/**
 * Health Score Narrator Service — customer-health weekly digest Service for
 * the customer-success catalog.
 *
 * Distinguishing shape vs. siblings (`account-review`, `nps-followup`,
 * `support-triage`, `churn-rescue`, `onboarding-runbook`, `csm-qbr-deck`,
 * `expansion-opportunity-detector`):
 *   - `forecast-narrative` archetype — the artefact is a per-account health
 *     narrative + early-warning-flagged digest emailed to the CS team
 *     weekly, not a per-account brief / triage / outreach play;
 *   - 3-step cascade: Code fan-in (engagement signals + product usage +
 *     support tickets) → Generative (per-account health-narrative + early-
 *     warning flags) → Code (rank by risk + emit digest); no Human Function
 *     in the cascade — the digest goes straight to the CS-team inbox and
 *     the team triages from there;
 *   - `subscription` pricing — the digest is a recurring weekly cadence
 *     Service consumed by an entire CS-team ($299/mo per CS-team);
 *   - no HumanSign in the OutcomeContract — the digest is informational
 *     and the quality floor is enforced by the evaluator panel; the CS
 *     team owns the action;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(signal-quality +
 *     early-warning-precision))`.
 *
 * Per design v3 §3 (Catalog HOW customer-success) + §6 (binding triggers)
 * + §7 (subscription pricing factory) + §8 (ProofPredicate AND).
 *
 * Service-level reward = `at-risk-account-detected-before-renewal-cycle` —
 * the compound metric every CS-team optimises against (the digest is worth
 * running iff at-risk accounts are flagged a renewal-cycle ahead vs. the
 * pre-Service baseline; the alternative is "I wish we'd seen it coming"
 * QBR-eve scrambles).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Input — a weekly cron firing across the CS-team's book of accounts.
 * Tight: 5 fields cover team identity, the digest week, the in-scope
 * account refs (so the cascade fans-in to the right slice of usage +
 * tickets), the connected source systems, and the digest-recipient email
 * list (the CS-team distribution).
 */
export const WeeklyDigestInputSchema = z.object({
  csTeamRef: z.string(),
  digestWeek: z.object({
    fromDate: z.string(), // ISO-8601
    toDate: z.string(), // ISO-8601
  }),
  accountRefs: z.array(z.string()).min(1),
  sources: z.object({
    productAnalytics: z.enum(['mixpanel', 'amplitude', 'heap', 'pendo']),
    supportSystem: z.enum(['zendesk', 'intercom', 'freshdesk', 'helpscout']),
    crm: z.enum(['salesforce', 'hubspot']),
  }),
  recipients: z.array(z.string()).min(1),
})

/**
 * Output — a weekly customer-health digest: per-account health narratives,
 * per-account early-warning flags, the risk-ranked account list, and
 * pointers to the emitted digest artefacts (HTML email + dashboard URL).
 */
export const HealthDigestOutputSchema = z.object({
  csTeamRef: z.string(),
  digestWeek: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  accountNarratives: z.array(
    z.object({
      accountRef: z.string(),
      currentHealthScore: z.number().min(0).max(100),
      priorHealthScore: z.number().min(0).max(100),
      healthDirection: z.enum(['better', 'worse', 'flat']),
      narrativeMarkdown: z.string(),
      drivingSignals: z.array(z.string()),
      earlyWarningFlags: z.array(
        z.object({
          flag: z.enum([
            'usage-decline',
            'champion-departure',
            'support-volume-spike',
            'feature-adoption-stall',
            'engagement-drop',
            'csat-decline',
          ]),
          severity: z.enum(['low', 'med', 'high']),
          evidenceCitations: z.array(z.string()).min(1),
        })
      ),
    })
  ),
  riskRanking: z.array(
    z.object({
      accountRef: z.string(),
      rank: z.number().int().positive(),
      compositeRiskScore: z.number().min(0).max(100),
      renewalCycleAt: z.string(),
    })
  ),
  digest: z.object({
    htmlEmailUrl: z.string(),
    dashboardUrl: z.string(),
    sentAt: z.string(),
  }),
  generatedAt: z.string(),
})

export type WeeklyDigestInput = z.infer<typeof WeeklyDigestInputSchema>
export type HealthDigestOutput = z.infer<typeof HealthDigestOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_atRiskDetected: RewardSignal = {
  keyResultRef: 'kr:health-score-narrator:at-risk-account-detected-before-renewal-cycle',
}
const kr_signalCoverage: RewardSignal = {
  keyResultRef: 'kr:health-score-narrator:signal-coverage',
}
const kr_signalQuality: RewardSignal = {
  keyResultRef: 'kr:health-score-narrator:signal-quality',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:health-score-narrator:emit-latency',
}

// ============================================================================
// Health Score Narrator Service
// ============================================================================

/**
 * Health Score Narrator — weekly cron + CS-team book of accounts → per-
 * account health-narrative digest with early-warning flags as a Service.
 *
 * Cascade: fetch-engagement-product-and-support-signals (Code, fan-in)
 *        → synthesize-per-account-health-narrative-and-flags (Generative)
 *        → rank-by-risk-and-emit-digest (Code, fan-out).
 */
export const healthScoreNarrator: ServiceInstance<WeeklyDigestInput, HealthDigestOutput> =
  Service.define<WeeklyDigestInput, HealthDigestOutput>({
    name: 'Health Score Narrator',
    promise:
      'Every week, the CS-team gets a per-account health digest — narrative + early-warning flags + risk-ranked — so at-risk accounts surface a renewal-cycle ahead, not at QBR-eve.',
    audience: 'business',
    archetype: 'forecast-narrative',
    schema: { input: WeeklyDigestInputSchema, output: HealthDigestOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-engagement-product-and-support-signals',
          reward: kr_signalCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-per-account-health-narrative-and-flags',
          reward: kr_signalQuality,
        }),
        Code({
          name: 'rank-by-risk-and-emit-digest',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'product-analytics.usage',
        'product-analytics.feature-graph',
        'mixpanel.events',
        'amplitude.events',
        'zendesk.tickets',
        'intercom.conversations',
        'crm.accounts',
        'crm.contacts',
        'gmail.send',
        'sendgrid.send',
      ],
      // Weekly cadence: clarification disabled — the digest synthesises
      // from the engagement + usage + support signals; the cascade does not
      // pause to clarify with the CS-team.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // High-severity early-warning flags (any "high" flag on any
          // account in the digest) escalate out-of-band to the CS-team
          // lead in addition to the regular weekly digest.
          when: 'accountNarratives.some(a => a.earlyWarningFlags.some(f => f.severity == "high"))',
          action: 'escalate',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:health-score-narrator-review',
      personas: [
        // Signal-quality reviewer — adversarially probes whether the
        // per-account narratives are grounded in the engagement + usage +
        // support signals (no "things look good" hand-waves), and whether
        // the driving signals are concrete and citable.
        Personas.skeptic({
          domain: 'signal-quality',
          focus: ['signals-grounded', 'no-hand-waves', 'concrete-and-citable'],
          name: 'signal-quality-reviewer',
        }),
        // Early-warning-precision reviewer — pedantic check that every
        // early-warning flag has evidence citations and that the severity
        // grading is calibrated against the underlying signals.
        Personas.pedantic({
          domain: 'early-warning-precision',
          rubric: [
            'every-flag-has-evidence',
            'severity-calibrated-to-signal',
            'no-flag-without-supporting-citation',
            'risk-ranking-monotonic-with-flags',
          ],
          name: 'early-warning-precision-checker',
        }),
        // CS domain reviewer — pulls the senior-CSM expert for judgment
        // on the overall digest quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/CustomerSuccessManagers',
          name: 'cs-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 2, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:health-score-narrator:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-cs-lead',
      seller: 'svc:health-score-narrator',
      serviceRef: 'svc:health-score-narrator',
      // No HumanSign — the digest is informational; the CS-team owns the
      // action. The quality floor is enforced by the evaluator panel.
      predicate: AND(
        SchemaMatch(HealthDigestOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' })
      ),
      amount: { amount: 29900n, currency: 'USD' },
      // 1-day SLA — weekly cron fires Monday, digest needs to land by
      // Tuesday so the CS-team can act on it before mid-week.
      timeoutDays: 1,
      onTimeout: 'escalate',
    },

    pricing: Pricing.subscription({
      plan: {
        id: 'health-score-narrator-monthly',
        amount: 29900n,
        currency: 'USD',
        interval: 'month',
      },
    }),

    refundContract: 'sla-credit-on-late-delivery',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 400n, perApiCall: 3n },
    reward: kr_atRiskDetected,

    lineage: {
      cellRef: 'business.org.ai/cells/customer-success-managers/health-score-narrator',
      icpContextProblemRef: 'icp:health-score-narrator:v1',
      foundingHypothesisRef: 'fh:health-score-narrator:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
