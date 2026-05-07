/**
 * Pricing Architect — startup pricing-architecture authoring Service.
 *
 * Distinguishing shape vs. siblings (`claude-code-feature-build`,
 * `wedge-hypothesis-generator`, `competitor-uncopyability-prober`,
 * `runtime-unit-emitter`, `pitch-deck-builder`, `gtm-experiment-runner`):
 *   - `forecast-narrative` archetype — the artefact is a founder-and-
 *     finance-lead-signed pricing-architecture doc + Stripe-product-config
 *     skeleton, not an FH or a code diff;
 *   - 5-step cascade: Code fan-in (product-shape + ICP-context + competitor
 *     pricing + cost-structure) → Generative (synthesise three pricing-
 *     model options with tradeoffs: outcome / subscription / per-invocation
 *     / composite / percent-of) → Generative (draft pricing-page copy +
 *     objection-handling) → Human (founder + finance-lead review) → Code
 *     (emit pricing-architecture doc + Stripe-product-config skeleton);
 *   - `Pricing.outcome` 3 tiers keyed on the depth of the architecture —
 *     `simple` (single-product flat tiering, $499) / `usage-based`
 *     (metered + percent-of, $1,999) / `enterprise` (composite multi-tier
 *     with custom terms, $5,999) — enterprise architectures carry the
 *     heaviest evaluator pass + must survive procurement-grade scrutiny;
 *   - declarative HITL = mandatory founder-and-finance-lead review Human
 *     Function (uses `'approval'` rationale because the founder owns the
 *     pricing call and the finance-lead owns the unit-economics signoff;
 *     neither can be delegated), plus OutcomeContract requires both
 *     signatures;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(model-fit-with-
 *     icp + objection-handling-coverage + unit-economics-soundness) +
 *     HumanSign(founder))`;
 *   - EvaluatorPanel includes `Personas.budgetRealism({ budgetType: 'cost' })`
 *     (unit-economics realism) and `Personas.brandSafety({ riskTolerance:
 *     'medium' })` (pricing copy must not over-promise or trigger
 *     reputational risk on price-anchoring).
 *
 * Per design v3 §3 (Catalog HOW startup) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `pricing-page-conversion-rate-and-asp-improvement`
 * — the compound metric the GTM team optimises against (pricing
 * architecture is worth running iff the emitted pricing-page lifts
 * conversion + ASP after publish).
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

const ProductShapeRefSchema = z.object({
  productRef: z.string(),
  shape: z.enum(['saas', 'api', 'data', 'infra', 'platform', 'marketplace', 'service']),
  unitOfValue: z.string(),
})

const CompetitorPricePointSchema = z.object({
  competitorRef: z.string(),
  pricingModel: z.enum([
    'outcome',
    'subscription',
    'per-invocation',
    'composite',
    'percent-of',
    'unknown',
  ]),
  headlineUsd: z.number().min(0).optional(),
  notes: z.string().optional(),
})

const CostStructureSchema = z.object({
  cogsPerUnitUsd: z.number().min(0),
  fixedCostsPerMonthUsd: z.number().min(0),
  marginalCostNotes: z.string().optional(),
})

/**
 * Input — a pricing-architecture brief from the founder. `repricingEvent`
 * distinguishes a fresh launch from a repricing pass (carries inherited
 * constraints like grandfathered customers). `architectureDepth` resolves
 * the outcome tier at intake.
 */
export const PricingArchitectInputSchema = z.object({
  productShape: ProductShapeRefSchema,
  icpContextRef: z.string(),
  competitorPricing: z.array(CompetitorPricePointSchema).default([]),
  costStructure: CostStructureSchema,
  architectureDepth: z.enum(['simple', 'usage-based', 'enterprise']),
  founderRef: z.string(),
  financeLeadRef: z.string(),
  repricingEvent: z.boolean().default(false),
  triggerStage: z.enum(['new-product-pricing', 'repricing-event']),
})

const PricingModelOptionSchema = z.object({
  optionId: z.string(),
  pricingKind: z.enum(['outcome', 'subscription', 'per-invocation', 'composite', 'percent-of']),
  summary: z.string().min(20),
  tradeoffs: z.object({
    pros: z.array(z.string()).min(1),
    cons: z.array(z.string()).min(1),
    fitWithIcp: z.string(),
  }),
  unitEconomics: z.object({
    targetGrossMarginPct: z.number().min(0).max(100),
    paybackMonthsAtAvgAcv: z.number().min(0),
    breakevenAssumptionNotes: z.string(),
  }),
  recommendedTiers: z
    .array(
      z.object({
        tierId: z.string(),
        amountUsd: z.number().min(0),
        description: z.string(),
      })
    )
    .min(1),
})

const PricingPageCopySchema = z.object({
  headline: z.string().min(10),
  subhead: z.string().min(10),
  proofPoints: z.array(z.string()).min(1),
  tierCopy: z
    .array(
      z.object({
        tierId: z.string(),
        cta: z.string(),
        valueProp: z.string(),
      })
    )
    .min(1),
})

const ObjectionHandlingSchema = z.object({
  objections: z
    .array(
      z.object({
        objection: z.string(),
        rebuttal: z.string(),
        evidenceRef: z.string().optional(),
      })
    )
    .min(1),
})

/**
 * Output — a founder-and-finance-lead-signed pricing-architecture doc
 * plus the three pricing-model options considered, the chosen option's
 * pricing-page copy + objection-handling, and a Stripe-product-config
 * skeleton ready for handoff to engineering.
 */
export const PricingArchitectOutputSchema = z.object({
  productShape: ProductShapeRefSchema,
  pricingModelOptions: z.array(PricingModelOptionSchema).length(3),
  selectedOptionId: z.string(),
  pricingPageCopy: PricingPageCopySchema,
  objectionHandling: ObjectionHandlingSchema,
  reviewDecisions: z.object({
    founder: z.object({
      founderRef: z.string(),
      decision: z.enum(['accept', 'request-revision', 'reject']),
      rationale: z.string(),
      decidedAt: z.string(),
    }),
    financeLead: z.object({
      financeLeadRef: z.string(),
      decision: z.enum(['accept', 'request-revision', 'reject']),
      rationale: z.string(),
      decidedAt: z.string(),
    }),
  }),
  emittedPricingArchitectureDocRef: z.string(),
  stripeProductConfigSkeleton: z.object({
    skeletonRef: z.string(),
    products: z
      .array(
        z.object({
          productId: z.string(),
          prices: z
            .array(
              z.object({
                priceId: z.string(),
                unitAmountCents: z.number().int().min(0),
                interval: z.enum(['one-time', 'day', 'week', 'month', 'quarter', 'year']),
              })
            )
            .min(1),
        })
      )
      .min(1),
  }),
  generatedAt: z.string(),
})

export type PricingArchitectInput = z.infer<typeof PricingArchitectInputSchema>
export type PricingArchitectOutput = z.infer<typeof PricingArchitectOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_pricingPageConversionAndAsp: RewardSignal = {
  keyResultRef: 'kr:pricing-architect:pricing-page-conversion-rate-and-asp-improvement',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:pricing-architect:intake-coverage',
}
const kr_modelOptionDistinctiveness: RewardSignal = {
  keyResultRef: 'kr:pricing-architect:model-option-distinctiveness',
}
const kr_pricingCopyClarity: RewardSignal = {
  keyResultRef: 'kr:pricing-architect:pricing-copy-clarity',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:pricing-architect:emit-latency',
}

// ============================================================================
// Pricing Architect Service
// ============================================================================

/**
 * Pricing Architect — new-product or repricing trigger → founder-and-
 * finance-lead-signed pricing-architecture doc + Stripe-product-config
 * skeleton as a Service.
 *
 * Cascade: fetch-product-shape-icp-competitors-and-cost-structure (Code, fan-in)
 *        → synthesize-3-pricing-model-options-with-tradeoffs (Generative)
 *        → draft-pricing-page-copy-and-objection-handling (Generative)
 *        → founder-and-finance-lead-review (Human, approval rationale)
 *        → emit-pricing-architecture-doc-and-stripe-config (Code, fan-out).
 */
export const pricingArchitect: ServiceInstance<PricingArchitectInput, PricingArchitectOutput> =
  Service.define<PricingArchitectInput, PricingArchitectOutput>({
    name: 'Pricing Architect',
    promise:
      'Every new product or repricing event reaches a founder-and-finance-lead-signed pricing architecture in under a week — three pricing-model options scored on tradeoffs and unit economics, chosen-option pricing-page copy with objection-handling, Stripe-product-config skeleton ready for engineering — so founders ship pricing on conviction + math, not on hand-wave.',
    audience: 'business',
    archetype: 'forecast-narrative',
    schema: { input: PricingArchitectInputSchema, output: PricingArchitectOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-product-shape-icp-competitors-and-cost-structure',
          reward: kr_intakeCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-3-pricing-model-options-with-tradeoffs',
          reward: kr_modelOptionDistinctiveness,
        }),
        Generative({
          name: 'draft-pricing-page-copy-and-objection-handling',
          reward: kr_pricingCopyClarity,
        }),
        Human({
          name: 'founder-and-finance-lead-review',
          // `approval` rationale: the founder owns the pricing call and
          // the finance-lead owns the unit-economics signoff — neither
          // authority can be delegated.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-pricing-architecture-doc-and-stripe-config',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'product.registry',
        'icp.registry',
        'competitor.pricing-feed',
        'finance.cost-structure',
        'pricing-architecture.docs',
        'stripe.products',
        'stripe.prices',
      ],
      // Pricing authoring: clarification disabled — the cascade synthesises
      // from (product-shape, ICP, competitors, cost-structure); the
      // founder + finance-lead review step is the single human contact.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Enterprise architectures escalate to a procurement-grade
          // reviewer before the founder + finance-lead review (multi-
          // tier composite pricing carries compounding negotiation risk).
          when: 'architectureDepth == "enterprise"',
          action: 'escalate',
        },
        {
          // Every architecture routes through founder + finance-lead
          // review before the doc emits; OutcomeContract enforces the
          // founder signature, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'founder-and-finance-lead-review',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:pricing-architect-review',
      personas: [
        // Model-fit-with-ICP reviewer — pedantic check that each pricing-
        // model option's `fitWithIcp` rationale grounds in the named ICP
        // context (no generic copy-paste; no model-ICP mismatch like
        // per-invocation pricing for SMB-monthly buyers).
        Personas.pedantic({
          domain: 'model-fit-with-icp',
          rubric: [
            'fit-rationale-cites-icp-segment',
            'pricing-model-matches-buying-cycle',
            'tier-amounts-match-icp-budget-band',
            'no-model-icp-mismatch',
          ],
          name: 'model-fit-with-icp-checker',
        }),
        // Objection-handling-coverage reviewer — pedantic check that the
        // top objections (price-anchoring, competitor-cheaper, value-
        // unclear, lock-in) all have a rebuttal + evidence reference.
        Personas.pedantic({
          domain: 'objection-handling-coverage',
          rubric: [
            'top-objections-enumerated',
            'every-objection-has-a-rebuttal',
            'rebuttals-cite-evidence',
            'no-strawman-objections',
          ],
          name: 'objection-handling-coverage-checker',
        }),
        // Unit-economics-soundness reviewer — accuracy check that the
        // gross-margin + payback assumptions reconcile with the input
        // cost structure (no math errors; no implausible margins).
        Personas.accuracy({
          domain: 'unit-economics-soundness',
          name: 'unit-economics-soundness-reviewer',
        }),
        // Budget-realism reviewer — narrowed to `cost` axis (the
        // architecture is a cost-structure-and-margin artefact; time +
        // scope axes don't apply at this stage).
        Personas.budgetRealism({ budgetType: 'cost' }),
        // Brand-safety reviewer — pricing copy must not over-promise or
        // trigger reputational risk on price-anchoring (`medium` risk
        // tolerance because pricing pages are externally visible).
        Personas.brandSafety({ riskTolerance: 'medium' }),
        // Domain reviewer — pulls the senior-pricing-strategist expert
        // for judgment on the overall architecture quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/PricingStrategists',
          name: 'pricing-strategy-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:pricing-architect:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-founder',
      seller: 'svc:pricing-architect',
      serviceRef: 'svc:pricing-architect',
      // Founder signs every pricing architecture before downstream Stripe
      // config emits — the pricing call cannot be delegated.
      predicate: AND(
        SchemaMatch(PricingArchitectOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['founder'] })
      ),
      tiers: [
        {
          id: 'simple',
          amount: 49900n,
          currency: 'USD',
          description: 'Single-product flat tiering',
        },
        {
          id: 'usage-based',
          amount: 199900n,
          currency: 'USD',
          description: 'Metered + percent-of architecture',
        },
        {
          id: 'enterprise',
          amount: 599900n,
          currency: 'USD',
          description: 'Composite multi-tier with custom terms',
        },
      ],
      // 5-day SLA — pricing architecture takes a workweek from intake to
      // founder-and-finance-lead-signed doc.
      timeoutDays: 5,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        { id: 'simple', amount: 49900n },
        { id: 'usage-based', amount: 199900n },
        { id: 'enterprise', amount: 599900n },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 5500n, perApiCall: 12n },
    reward: kr_pricingPageConversionAndAsp,

    lineage: {
      cellRef: 'business.org.ai/cells/founders/pricing-architecture',
      icpContextProblemRef: 'icp:pricing-architect:v1',
      foundingHypothesisRef: 'fh:pricing-architect:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
