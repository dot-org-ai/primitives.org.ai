/**
 * Runtime Unit Emitter — Stage-25/27/28-aligned runtime-unit minting
 * Service.
 *
 * Distinguishing shape vs. siblings (`claude-code-feature-build`,
 * `wedge-hypothesis-generator`, `competitor-uncopyability-prober`):
 *   - `quality-review` archetype — the artefact is a founder-published
 *     RuntimeUnit (Service.define-shape + MarketplaceListing) registered
 *     with cluster-1-4 flag-gates, not an FH or an uncopyability memo;
 *   - 6-step cascade: Code fan-in (FH + brand + thesis + lens) →
 *     Generative (Service.define shape: schema + cascade + pricing +
 *     outcomeContract + lineage + reward) → Code (validate against
 *     services-as-software/v3 Service.define types) → Generative
 *     (MarketplaceListing + audience + promise denormalization) → Human
 *     (founder review + publish) → Code (emit RuntimeUnit + register
 *     with cluster-1-4 flag-gates);
 *   - `Pricing.outcome` 2 tiers keyed on the breadth of the runtime
 *     unit — `wedge` (single-Service runtime unit, $999) / `platform`
 *     (multi-Service platform-grade runtime unit, $4,999) — platform-
 *     grade units carry the heavier evaluator pass + must survive
 *     cluster-1-4 flag-gate registration;
 *   - declarative HITL = mandatory founder review + publish Human
 *     Function (uses `'approval'` rationale because the runtime unit
 *     becomes externally-callable on publish — the founder owns the
 *     ship/no-ship call), plus OutcomeContract requires founder
 *     signature;
 *   - OutcomeContract = `AND(SchemaMatch + EvaluatorPass(service-shape-
 *     validity + listing-coherence + lineage-soundness) +
 *     HumanSign(founder))`;
 *   - EvaluatorPanel includes `Personas.pedantic` rubrics for
 *     Service.define-shape validity (must conform to v3 types) and
 *     listing coherence + `Personas.accuracy` for lineage soundness
 *     (the runtime unit must trace cleanly back to the FH and cell).
 *
 * Per design v3 §3 (Catalog HOW startup) + §6 (binding triggers,
 * conditional HumanSign) + §7 (outcome pricing factory) + §8
 * (ProofPredicate AND).
 *
 * Service-level reward = `stage-33-37-publish-success-rate` — the
 * compound metric the platform team optimises against (runtime
 * minting is worth running iff the published unit survives Stages
 * 33-37 publish flow without an unpublish cycle).
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
 * Input — an FH approved at Stage 9 with the cascade ready for
 * Stage 25/27/28 emission. `runtimeBreadth` resolves the outcome tier
 * at intake (single-Service `wedge` vs. multi-Service `platform`).
 * `clusterFlagGates` lists which of cluster-1-4 the unit must register
 * with (a wedge unit may register with a single cluster; a platform
 * unit registers with all four).
 */
export const RuntimeUnitInputSchema = z.object({
  foundingHypothesisRef: z.string(),
  cellRef: z.string(),
  brandRef: z.string(),
  thesisRef: z.string(),
  lensRef: z.string(),
  runtimeBreadth: z.enum(['wedge', 'platform']),
  clusterFlagGates: z.array(z.enum(['cluster-1', 'cluster-2', 'cluster-3', 'cluster-4'])).min(1),
  founderRef: z.string(),
  triggerStage: z.enum(['stage-25-runtime-mint', 'stage-27-listing-emit', 'stage-28-publish']),
})

const ServiceDefineShapeSchema = z.object({
  $id: z.string(),
  name: z.string(),
  promise: z.string(),
  audience: z.enum(['business', 'consumer', 'platform']),
  archetype: z.string(),
  schemaSummary: z.object({
    inputFields: z.array(z.string()).min(1),
    outputFields: z.array(z.string()).min(1),
  }),
  cascadeSummary: z.array(
    z.object({
      stepName: z.string(),
      kind: z.enum(['code', 'generative', 'agentic', 'human']),
    })
  ),
  pricingKind: z.enum(['outcome', 'subscription', 'composite', 'per-invocation', 'percent-of']),
  outcomeContractPredicateSummary: z.string(),
  rewardKeyResultRef: z.string(),
  lineageCellRef: z.string(),
})

const MarketplaceListingSchema = z.object({
  listingId: z.string(),
  title: z.string(),
  audience: z.enum(['business', 'consumer', 'platform']),
  promise: z.string(),
  promiseDenormalizedFields: z.object({
    headline: z.string(),
    subhead: z.string(),
    proofPoints: z.array(z.string()).min(1),
  }),
  pricingHeadline: z.string(),
})

/**
 * Output — a founder-published RuntimeUnit + MarketplaceListing
 * registered with the named cluster-1-4 flag-gates. `validationResult`
 * captures the v3 type-validation pass; `flagGateRegistrations` records
 * which cluster gates were registered against (wedge units typically
 * register with one cluster; platform units register with all four).
 */
export const RuntimeUnitOutputSchema = z.object({
  foundingHypothesisRef: z.string(),
  serviceDefineShape: ServiceDefineShapeSchema,
  validationResult: z.object({
    valid: z.boolean(),
    schemaErrors: z.array(z.string()).default([]),
    typeWarnings: z.array(z.string()).default([]),
  }),
  marketplaceListing: MarketplaceListingSchema,
  founderPublishDecision: z.object({
    founderRef: z.string(),
    decision: z.enum(['publish', 'request-edit', 'reject']),
    rationale: z.string(),
    decidedAt: z.string(),
  }),
  emittedRuntimeUnitRef: z.string(),
  flagGateRegistrations: z
    .array(
      z.object({
        cluster: z.enum(['cluster-1', 'cluster-2', 'cluster-3', 'cluster-4']),
        gateRef: z.string(),
        registeredAt: z.string(),
      })
    )
    .min(1),
  generatedAt: z.string(),
})

export type RuntimeUnitInput = z.infer<typeof RuntimeUnitInputSchema>
export type RuntimeUnitOutput = z.infer<typeof RuntimeUnitOutputSchema>

// ============================================================================
// RewardSignal placeholders — per-Function reward references.
// ============================================================================

const kr_publishSuccessRate: RewardSignal = {
  keyResultRef: 'kr:runtime-unit-emitter:stage-33-37-publish-success-rate',
}
const kr_intakeCoverage: RewardSignal = {
  keyResultRef: 'kr:runtime-unit-emitter:intake-coverage',
}
const kr_serviceShapeValidity: RewardSignal = {
  keyResultRef: 'kr:runtime-unit-emitter:service-shape-validity',
}
const kr_validationPassRate: RewardSignal = {
  keyResultRef: 'kr:runtime-unit-emitter:validation-pass-rate',
}
const kr_listingCoherence: RewardSignal = {
  keyResultRef: 'kr:runtime-unit-emitter:listing-coherence',
}
const kr_emitLatency: RewardSignal = {
  keyResultRef: 'kr:runtime-unit-emitter:emit-latency',
}

// ============================================================================
// Runtime Unit Emitter Service
// ============================================================================

/**
 * Runtime Unit Emitter — FH-approved-at-Stage-9 trigger → founder-
 * published RuntimeUnit + MarketplaceListing + cluster-1-4 flag-gate
 * registrations as a Service.
 *
 * Cascade: fetch-fh-brand-thesis-lens (Code, fan-in)
 *        → synthesize-service-define-shape (Generative)
 *        → validate-against-v3-service-define-types (Code)
 *        → emit-marketplace-listing-with-promise-denormalization (Generative)
 *        → founder-review-and-publish (Human, approval rationale)
 *        → emit-runtime-unit-and-register-cluster-flag-gates (Code, fan-out).
 */
export const runtimeUnitEmitter: ServiceInstance<RuntimeUnitInput, RuntimeUnitOutput> =
  Service.define<RuntimeUnitInput, RuntimeUnitOutput>({
    name: 'Runtime Unit Emitter',
    promise:
      'Every Stage-9-approved FH reaches Stage 28 with a founder-published RuntimeUnit + MarketplaceListing — Service.define-shape validated against v3 types, listing coherent on promise + audience + pricing, lineage clean back to the FH and cell, registered with the named cluster-1-4 flag-gates — so runtime minting is a checklist, not an authoring sprint.',
    audience: 'agent',
    archetype: 'quality-review',
    schema: { input: RuntimeUnitInputSchema, output: RuntimeUnitOutputSchema },

    binding: {
      cascade: [
        Code({
          name: 'fetch-fh-brand-thesis-and-lens',
          reward: kr_intakeCoverage,
          handler: () => undefined,
        }),
        Generative({
          name: 'synthesize-service-define-shape',
          reward: kr_serviceShapeValidity,
        }),
        Code({
          name: 'validate-against-v3-service-define-types',
          reward: kr_validationPassRate,
          handler: () => undefined,
        }),
        Generative({
          name: 'emit-marketplace-listing-with-promise-denormalization',
          reward: kr_listingCoherence,
        }),
        Human({
          name: 'founder-review-and-publish',
          // `approval` rationale: the runtime unit becomes externally-
          // callable on publish — the founder owns the ship/no-ship call
          // and the call cannot be delegated.
          rationale: 'approval',
          expirationPolicy: { whenAccuracyExceeds: 1.01, whenSamplesExceed: 999_999 },
        }),
        Code({
          name: 'emit-runtime-unit-and-register-cluster-flag-gates',
          reward: kr_emitLatency,
          handler: () => undefined,
        }),
      ],
      toolPermissions: [
        'fh.registry',
        'brand.registry',
        'thesis.registry',
        'lens.registry',
        'service.define.validator',
        'marketplace.listings',
        'runtime.units',
        'cluster.flag-gates',
      ],
      // Runtime minting: clarification disabled — the cascade synthesises
      // from (FH, brand, thesis, lens); the founder review step is the
      // single human contact point.
      clarificationPolicy: { enabled: false },
      triggers: [
        {
          // Platform-breadth runtime units escalate the listing emission
          // to a platform-strategy supervisor before the founder publish
          // (cross-cluster blast-radius compounds at platform scope).
          when: 'runtimeBreadth == "platform"',
          action: 'escalate',
        },
        {
          // Every runtime unit routes through founder review + publish
          // before the unit emits; OutcomeContract enforces the founder
          // signature, the trigger primes the queue.
          when: 'true',
          action: 'route-to',
          target: 'founder-review-and-publish',
        },
      ],
    },

    evaluators: EvaluatorPanel.define({
      $id: 'panel:runtime-unit-emitter-review',
      personas: [
        // Service-shape-validity reviewer — pedantic check that the
        // generated Service.define shape conforms to v3 types: schema
        // input/output present, cascade is non-empty + ordered, pricing
        // resolves to a known kind, outcomeContract predicate is well-
        // formed, lineage refs are present.
        Personas.pedantic({
          domain: 'service-shape-validity',
          rubric: [
            'schema-input-and-output-present',
            'cascade-non-empty-and-ordered',
            'pricing-kind-recognised',
            'outcome-contract-predicate-well-formed',
            'lineage-refs-present',
            'reward-key-result-ref-present',
          ],
          name: 'service-shape-validity-checker',
        }),
        // Listing-coherence reviewer — pedantic check that the
        // MarketplaceListing audience + promise + pricing-headline
        // cohere with the underlying Service.define shape (no audience
        // mismatch, no over-promise vs. outcomeContract).
        Personas.pedantic({
          domain: 'listing-coherence',
          rubric: [
            'listing-audience-matches-service-audience',
            'promise-denormalization-grounded-in-service-promise',
            'pricing-headline-matches-pricing-kind',
            'no-claims-not-supported-by-outcome-contract',
          ],
          name: 'listing-coherence-checker',
        }),
        // Lineage-soundness reviewer — accuracy check that the runtime
        // unit traces cleanly back to the FH, cell, brand, thesis, and
        // lens; no orphan references; cascadeRunId resolvable.
        Personas.accuracy({
          domain: 'lineage-soundness',
          name: 'lineage-soundness-reviewer',
        }),
        // Domain reviewer — pulls the senior-platform-architect expert
        // for judgment on the overall runtime unit quality.
        Personas.domain({
          expertRef: 'occupations.org.ai/PlatformArchitects',
          name: 'platform-architecture-domain',
        }),
      ],
      signOffPolicy: 'all-approve',
      iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
    }),

    outcomeContract: {
      $id: 'oc:runtime-unit-emitter:v1',
      $type: 'OutcomeContract',
      buyer: 'role:tenant-founder',
      seller: 'svc:runtime-unit-emitter',
      serviceRef: 'svc:runtime-unit-emitter',
      // Founder signs every runtime unit before publish — the
      // ship/no-ship authority cannot be delegated.
      predicate: AND(
        SchemaMatch(RuntimeUnitOutputSchema),
        EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
        HumanSign({ signerRoles: ['founder'] })
      ),
      tiers: [
        {
          id: 'wedge',
          amount: 99900n,
          currency: 'USD',
          description: 'Single-Service runtime unit',
        },
        {
          id: 'platform',
          amount: 499900n,
          currency: 'USD',
          description: 'Multi-Service platform-grade runtime unit',
        },
      ],
      // 2-day SLA — runtime minting is a tight loop from FH-approved to
      // founder-published unit.
      timeoutDays: 2,
      onTimeout: 'escalate',
    },

    pricing: Pricing.outcome({
      tiers: [
        { id: 'wedge', amount: 99900n },
        { id: 'platform', amount: 499900n },
      ],
    }),

    refundContract: 'quality-floor-fail',
    authorityBoundary: 'tenant-only',
    costModel: { perInvocation: 5000n, perApiCall: 12n },
    reward: kr_publishSuccessRate,

    lineage: {
      cellRef: 'business.org.ai/cells/founders/runtime-unit-emitting',
      icpContextProblemRef: 'icp:runtime-unit-emitter:v1',
      foundingHypothesisRef: 'fh:runtime-unit-emitter:v1',
      cascadeRunId: 'manual:v1',
      versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
    },
  })
