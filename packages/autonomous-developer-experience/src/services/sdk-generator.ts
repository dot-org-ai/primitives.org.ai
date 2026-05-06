/**
 * SDK Generator Service — transactional-workflow catalog Service that turns
 * an OpenAPI spec into typed SDKs across N target languages and publishes
 * them to the canonical package registries.
 *
 * Demonstrates: composite pricing (one-time per-spec-version base + metered
 * per-language-target overage), `transactional-workflow` archetype,
 * partly-supervised cascade (`harmonize-naming` is the lone Agentic step
 * and runs supervised — naming consistency across N languages is the
 * judgment call worth a human-in-the-loop), declarative trigger routing
 * (`spec.breaking_changes_count > 0` routes to `harmonize-naming` so a
 * maintainer reviews naming before publish), clarification enabled with
 * `maxRoundTrips: 1` escalating to `sdk-maintainer`, EvaluatorPanel of 3
 * personas (endpoint-coverage / naming-skeptic / type-fidelity-checker)
 * under `all-approve`, AND-composed OutcomeContract predicate (SchemaMatch
 * + EvaluatorPass + External npm-published verifier) with a 2-day
 * `timeoutDays`.
 *
 * Sibling to `api-docs-writer` + `changelog-generator` — same catalog
 * package, but transactional rather than pure-autonomous: the multi-language
 * harmonization step needs supervision, and the publish gate hits three
 * registries (npm / pypi / goproxy) so the External verifier pins to
 * `npm` as the canonical publish-target signal.
 *
 * Per design v3 §3 (Catalog HOW agent: SDK Generator worked example) +
 * §6 (binding triggers — `route-to harmonize-naming` on breaking changes) +
 * §7 (composite pricing factory) + §8 (ProofPredicate AND with External) +
 * round-6 cleanups (Pricing factory call, Personas `name` overrides,
 * `timeoutDays`).
 *
 * @packageDocumentation
 */

import { z } from 'zod'

import { Agentic, Code, Generative } from 'digital-tools'
import type { RewardSignal } from 'digital-tools'

import { EvaluatorPanel, Personas, Service, type ServiceInstance } from 'services-as-software/v3'

import { AND, EvaluatorPass, External, Pricing, SchemaMatch } from 'autonomous-finance'

// ============================================================================
// Schemas (Zod 3.24+ implements StandardSchemaV1 natively)
// ============================================================================

/**
 * Supported SDK target languages. Five-language seed; `rust` and `java` are
 * present but defer their generators to round-9+.
 */
export const SdkTargetLanguageSchema = z.enum(['typescript', 'python', 'go', 'rust', 'java'])
export type SdkTargetLanguage = z.infer<typeof SdkTargetLanguageSchema>

/**
 * Supported package registries (one per language target). The `publishTo`
 * array is opaque-ordered — registry choice mirrors the language target.
 */
export const SdkRegistrySchema = z.enum(['npm', 'pypi', 'goproxy', 'crates', 'maven'])
export type SdkRegistry = z.infer<typeof SdkRegistrySchema>

/**
 * Input — an OpenAPI spec source plus the target languages + registries to
 * publish to. Either `specUrl` (fetched by the `fetch-spec` Code step) or
 * `specInline` (already-resolved object) must be supplied; the union below
 * is enforced by Zod.
 */
export const OpenAPISpecInputSchema = z.union([
  z.object({
    specUrl: z.string().url(),
    targetLanguages: z.array(SdkTargetLanguageSchema).nonempty(),
    publishTo: z.array(SdkRegistrySchema).nonempty(),
  }),
  z.object({
    specInline: z.record(z.unknown()),
    targetLanguages: z.array(SdkTargetLanguageSchema).nonempty(),
    publishTo: z.array(SdkRegistrySchema).nonempty(),
  }),
])

/**
 * Output — published SDKs across N languages. The resolved spec version,
 * one entry per language target (with the registry-canonical package name,
 * version, and registry URL), the published quickstart guide URL, and the
 * publish timestamp.
 */
export const PublishedSDKsOutputSchema = z.object({
  specVersion: z.string(),
  packagesByLanguage: z.array(
    z.object({
      language: SdkTargetLanguageSchema,
      packageName: z.string(),
      packageVersion: z.string(),
      registryUrl: z.string(),
    })
  ),
  quickstartUrl: z.string(),
  publishedAt: z.string(),
})

export type OpenAPISpecInput = z.infer<typeof OpenAPISpecInputSchema>
export type PublishedSDKsOutput = z.infer<typeof PublishedSDKsOutputSchema>

// ============================================================================
// RewardSignal placeholder — single Service-level reward (SDK adoption
// velocity → Adoption / Growth). TODO: replace with real $.Reward references
// when business-as-code KR primitive lands.
// ============================================================================

const kr_sdkAdoptionVelocity: RewardSignal = {
  keyResultRef: 'kr:sdk-generator:sdk-adoption-velocity',
}

// ============================================================================
// SDK Generator Service
// ============================================================================

/**
 * SDK Generator — OpenAPI spec in, typed SDKs published across N target
 * languages out.
 *
 * Cascade: fetch-spec (Code, http GET / inline parse)
 *        → validate-spec (Code, OpenAPI 3.x validator)
 *        → generate-typescript (Code, openapi-typescript)
 *        → generate-python (Code, openapi-python-client)
 *        → generate-go (Code, oapi-codegen)
 *        → harmonize-naming (Agentic, supervised — multi-language naming
 *          consistency is the judgment call worth HITL)
 *        → write-quickstarts (Generative)
 *        → publish (Code, npm + pypi + goproxy publish).
 *
 * Triggers route-to `harmonize-naming` when the spec carries breaking
 * changes — the human-in-the-loop double-checks naming for breaking
 * versions before publish. `clarificationPolicy` enabled with one
 * round-trip to `sdk-maintainer` for spec ambiguities.
 */
export const sdkGenerator: ServiceInstance<OpenAPISpecInput, PublishedSDKsOutput> = Service.define<
  OpenAPISpecInput,
  PublishedSDKsOutput
>({
  name: 'SDK Generator',
  promise: 'OpenAPI spec → typed SDKs in N languages → published packages',
  audience: 'business',
  archetype: 'transactional-workflow',
  schema: { input: OpenAPISpecInputSchema, output: PublishedSDKsOutputSchema },

  binding: {
    cascade: [
      Code({ name: 'fetch-spec', reward: kr_sdkAdoptionVelocity, handler: () => undefined }),
      Code({ name: 'validate-spec', reward: kr_sdkAdoptionVelocity, handler: () => undefined }),
      Code({
        name: 'generate-typescript',
        reward: kr_sdkAdoptionVelocity,
        handler: () => undefined,
      }),
      Code({
        name: 'generate-python',
        reward: kr_sdkAdoptionVelocity,
        handler: () => undefined,
      }),
      Code({ name: 'generate-go', reward: kr_sdkAdoptionVelocity, handler: () => undefined }),
      Agentic({
        name: 'harmonize-naming',
        reward: kr_sdkAdoptionVelocity,
        mode: 'supervised',
        oversight: { mode: 'supervised' },
      }),
      Generative({ name: 'write-quickstarts', reward: kr_sdkAdoptionVelocity }),
      Code({ name: 'publish', reward: kr_sdkAdoptionVelocity, handler: () => undefined }),
    ],
    toolPermissions: ['npm.registry', 'pypi.registry', 'goproxy.registry', 'github.releases'],
    // Spec ambiguities → one clarification round-trip to the SDK maintainer
    // before falling through to escalation. Tight cap because most SDK
    // generation is deterministic; clarification is the rare-edge-case path.
    clarificationPolicy: { enabled: true, maxRoundTrips: 1, escalateTo: 'sdk-maintainer' },
    triggers: [
      {
        // Breaking changes in the spec → route to the supervised
        // harmonize-naming step so the maintainer reviews naming impact
        // across every target language before any package is published.
        when: 'spec.breaking_changes_count > 0',
        action: 'route-to',
        target: 'harmonize-naming',
      },
    ],
  },

  evaluators: EvaluatorPanel.define({
    $id: 'panel:sdk-generator-review',
    personas: [
      // Coverage pedant — every endpoint in the OpenAPI spec must be
      // represented in every published SDK (100% — no missing endpoints).
      Personas.coverage({ minPercent: 1.0, name: 'endpoint-coverage' }),
      // Naming skeptic — adversarially probes naming consistency across
      // target languages (camelCase ↔ snake_case ↔ PascalCase
      // round-trips, reserved-word collisions, registry-publish-blocking
      // names).
      Personas.skeptic({ domain: 'naming-consistency', name: 'naming-skeptic' }),
      // Type-fidelity reviewer — fact-grounds generated TS/Py/Go types
      // against the OpenAPI schemas they're derived from; rejects any
      // type that doesn't faithfully represent its source schema.
      Personas.accuracy({ domain: 'type-fidelity', name: 'type-fidelity-checker' }),
    ],
    signOffPolicy: 'all-approve',
    iterationPolicy: { maxRounds: 3, onMaxRoundsExceeded: 'escalate' },
  }),

  outcomeContract: {
    $id: 'oc:sdk-generator:v1',
    $type: 'OutcomeContract',
    buyer: 'role:api-product-owner',
    seller: 'svc:sdk-generator',
    serviceRef: 'svc:sdk-generator',
    // AND(schema, panel, external): output validates, panel approves, AND
    // npm confirms the package was actually published. npm is the canonical
    // publish-target signal — pypi + goproxy follow the same pipeline so
    // npm-published is sufficient evidence for the autonomous-pass path.
    predicate: AND(
      SchemaMatch(PublishedSDKsOutputSchema),
      EvaluatorPass({ panelRef: 'self', minScore: 'all-approved' }),
      External({ verifier: 'npm', spec: { published: true } })
    ),
    amount: { amount: 50000n, currency: 'USD' },
    // 2-day SLA — multi-language generation + harmonize-naming review +
    // multi-registry publish takes more than a day of wall clock.
    timeoutDays: 2,
    onTimeout: 'escalate',
  },

  pricing: Pricing.composite({
    base: { id: 'spec-version', amount: 50000n, description: 'one-time per spec version' },
    metered: [
      {
        event: 'language-target-published',
        amount: 10000n,
        description: '$100 per language target',
      },
    ],
  }),

  refundContract: 'quality-floor-fail',
  authorityBoundary: 'self-only',
  costModel: { perInvocation: 500n, perUnit: 50n },
  reward: kr_sdkAdoptionVelocity,

  lineage: {
    cellRef: 'business.org.ai/cells/technical-writers/sdk-generation',
    icpContextProblemRef: 'icp:sdk-generator:v1',
    foundingHypothesisRef: 'fh:sdk-generator:v1',
    cascadeRunId: 'manual:v1',
    versionVector: { ontology: 'v1', engine: 'v1', generation: 'v1', fh: 'v1' },
  },
})
