/**
 * Personas — reusable persona factory library (v3 §9).
 *
 * Eighteen factories — six general-purpose evaluation axes plus twelve
 * specialized domain factories that cover the regulator / safety / realism /
 * production-axes surfaces Services in production verticals frequently need.
 * Each factory mints an {@link AgenticPersona} ready to drop into an
 * {@link EvaluatorPanelSpec.personas} array.
 *
 * Custom personas remain first-class — construct an `AgenticPersona` literal
 * directly. The factories are sugar, not a moat.
 *
 * General-purpose:
 *   - {@link Personas.pedantic} — strict rubric/style/format checker.
 *   - {@link Personas.skeptic}  — adversarial probe, looks for failure modes.
 *   - {@link Personas.accuracy} — fact-grounding against named sources.
 *   - {@link Personas.voice}    — brand-voice / tone / style alignment.
 *   - {@link Personas.coverage} — completeness floor (e.g. ≥ 95% rubric items).
 *   - {@link Personas.domain}   — pulls a named expert from `business.org.ai`.
 *
 * Specialized (regulator / safety / privacy surfaces):
 *   - {@link Personas.regulatoryCompliance} — regulator-tier framework checks
 *     (SEC / FINRA / FinCEN / HIPAA / GDPR / CCPA / SOX / PCI-DSS / custom).
 *   - {@link Personas.accessibility}        — WCAG 2.1 AA/AAA review for any
 *     human-consumed prose / UI / document output.
 *   - {@link Personas.securityThreat}       — adversarial security review
 *     (injection / exfiltration / privilege-escalation / PII leakage / etc).
 *   - {@link Personas.dataPrivacy}          — privacy-impact review (GDPR /
 *     CCPA / PIPEDA / general), PII-category-aware, minimization-checked.
 *
 * Specialized (production-evaluation realism surfaces):
 *   - {@link Personas.factualAccuracy}      — fact-checking with source-
 *     citation enforcement (citations required, source-quality tiered).
 *   - {@link Personas.brandSafety}          — brand-voice + reputational-risk
 *     review for customer/public-facing output.
 *   - {@link Personas.budgetRealism}        — cost / time / scope realism
 *     check for proposals, plans, and forecasts (advisory).
 *   - {@link Personas.timelineRealism}      — schedule + sequencing realism
 *     check for roadmaps and timelines (advisory).
 *
 * Specialized (production-evaluation execution surfaces):
 *   - {@link Personas.scopeClarity}         — scope-clarity / scope-creep
 *     review for PRDs, SOWs, project briefs, and epics.
 *   - {@link Personas.edgeCaseCoverage}     — edge-case enumeration check for
 *     test plans, acceptance criteria, and API contracts.
 *   - {@link Personas.regressionRisk}       — change-impact / regression-risk
 *     assessment for code, schema, config, policy, and process changes.
 *   - {@link Personas.localizationReady}    — i18n / l10n readiness review for
 *     prose / UI / document output bound for global audiences (advisory).
 *
 * Most factories default `signOff` to `'must-approve'`. The three realism /
 * readiness factories (`budgetRealism`, `timelineRealism`, `localizationReady`)
 * default to `'advisory'` — they are load-bearing inputs for Services that
 * propose work or ship globally, but their verdicts are guidance, not gates.
 * Each factory mints a default `name` of the form
 * `'<archetype>-<discriminator>'` (e.g. `'pedantic-validator-gaap'`). Callers
 * may pass an explicit `name` to override — useful when the panel uses
 * natural names like `'qa-reviewer'` instead of the minted convention.
 *
 * @packageDocumentation
 */

import type { AgenticPersona } from './evaluator-panel.js'

// ============================================================================
// Per-factory option shapes
// ============================================================================

/**
 * Options for {@link Personas.pedantic}.
 */
export interface PedanticPersonaOpts {
  /** Domain shortname used in the minted name (e.g. `'gaap-validation'`). */
  domain: string
  /** Optional rubric items the validator should enforce verbatim. */
  rubric?: string[]
  /** Override the default-minted `name`. */
  name?: string
  /**
   * Optional model hint (e.g. `'opus'`, `'sonnet'`, `'haiku'`). Stored on
   * `config.modelHint` and read by `EvaluatorPanel` when running in
   * `parallel-multi-call` mode so each persona can pick its own model
   * (e.g. `Personas.skeptic({ modelHint: 'opus' })` for high-stakes review).
   * Honoured only in `parallel-multi-call`; ignored in `aggregate-single-call`
   * (the single LLM call uses the panel-level model).
   */
  modelHint?: string
}

/**
 * Options for {@link Personas.skeptic}.
 */
export interface SkepticPersonaOpts {
  /** Domain shortname used in the minted name (e.g. `'security'`). */
  domain: string
  /**
   * Optional focus list (e.g. `['secrets', 'sast', 'auth']`) — narrows the
   * skeptic's adversarial lens.
   */
  focus?: string[]
  /** Override the default-minted `name`. */
  name?: string
  /** See {@link PedanticPersonaOpts.modelHint}. */
  modelHint?: string
}

/**
 * Options for {@link Personas.accuracy}.
 */
export interface AccuracyPersonaOpts {
  /** Domain shortname (e.g. `'fact-grounding'`). */
  domain: string
  /**
   * Optional source list — namespace refs / URIs the reviewer may cite as
   * grounding evidence (e.g. `['kb://corp-policy', 'web://nasdaq.com/AAPL']`).
   */
  sources?: string[]
  /** Override the default-minted `name`. */
  name?: string
  /** See {@link PedanticPersonaOpts.modelHint}. */
  modelHint?: string
}

/**
 * Options for {@link Personas.voice}.
 */
export interface VoicePersonaOpts {
  /**
   * Reference into the brand-voice guide (e.g. `'brand:do-industries/voice'`).
   * Resolution is deferred to the runtime.
   */
  brandVoiceRef: string
  /** Override the default-minted `name`. */
  name?: string
  /** See {@link PedanticPersonaOpts.modelHint}. */
  modelHint?: string
}

/**
 * Options for {@link Personas.coverage}.
 */
export interface CoveragePersonaOpts {
  /**
   * Floor for fraction of rubric items / required sections that must be
   * covered (0–1). E.g. `0.95` = 95%.
   */
  minPercent: number
  /** Override the default-minted `name`. */
  name?: string
  /** See {@link PedanticPersonaOpts.modelHint}. */
  modelHint?: string
}

/**
 * Options for {@link Personas.domain}.
 */
export interface DomainPersonaOpts {
  /**
   * Reference into `business.org.ai` (e.g. `'occupations.org.ai/SeniorAccountant'`).
   * The runtime resolves this to a domain-expert prompt + rubric lookup.
   */
  expertRef: string
  /** Override the default-minted `name`. */
  name?: string
  /** See {@link PedanticPersonaOpts.modelHint}. */
  modelHint?: string
}

/**
 * Known regulator IDs surfaced by {@link Personas.regulatoryCompliance}.
 *
 * `(string & {})` keeps autocomplete on the curated list while still
 * accepting custom regulator slugs (e.g. `'iso-27001'`, `'mas-fsra'`) without
 * forcing a library bump.
 */
export type RegulatoryFramework =
  | 'sec'
  | 'finra'
  | 'fincen'
  | 'hipaa'
  | 'gdpr'
  | 'ccpa'
  | 'sox'
  | 'pci-dss'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {})

/**
 * Options for {@link Personas.regulatoryCompliance}.
 */
export interface RegulatoryCompliancePersonaOpts {
  /** Regulator / framework whose rules apply (e.g. `'sec'`, `'hipaa'`). */
  regulator: RegulatoryFramework
  /**
   * Optional explicit rule-set IDs (e.g. `['SEC-17a-4', 'SEC-Reg-FD']`). When
   * omitted, the persona defers to the regulator's default rule surface.
   */
  ruleSet?: string[]
  /** Override the default-minted `name`. */
  name?: string
  /**
   * See {@link PedanticPersonaOpts.modelHint}. Defaults to `'opus'` because
   * regulator-tier checks are high-stakes — callers can downshift explicitly
   * by passing `modelHint: 'sonnet'` (or any alias) when budget matters more
   * than ceiling.
   */
  modelHint?: string
}

/**
 * Surfaces an {@link Personas.accessibility} reviewer can audit.
 */
export type AccessibilitySurface = 'screen-reader' | 'keyboard-only' | 'low-vision' | 'cognitive'

/**
 * Options for {@link Personas.accessibility}.
 */
export interface AccessibilityPersonaOpts {
  /** WCAG conformance level. Defaults to `'AA'` (WCAG 2.1 AA). */
  level?: 'AA' | 'AAA'
  /**
   * Surfaces to audit. Defaults to all four
   * (`screen-reader`, `keyboard-only`, `low-vision`, `cognitive`).
   */
  surfaces?: AccessibilitySurface[]
  /** Override the default-minted `name`. */
  name?: string
  /** See {@link PedanticPersonaOpts.modelHint}. */
  modelHint?: string
}

/**
 * Surfaces a {@link Personas.securityThreat} reviewer can audit.
 */
export type SecuritySurface =
  | 'injection'
  | 'data-exfiltration'
  | 'privilege-escalation'
  | 'pii-leakage'
  | 'prompt-injection'
  | 'denial-of-service'

/**
 * Options for {@link Personas.securityThreat}.
 */
export interface SecurityThreatPersonaOpts {
  /**
   * Threat surfaces to audit. Defaults to all six
   * (`injection`, `data-exfiltration`, `privilege-escalation`, `pii-leakage`,
   * `prompt-injection`, `denial-of-service`).
   */
  surfaces?: SecuritySurface[]
  /**
   * Severity gate.
   *   - `'critical-only'` — flag only critical-severity findings.
   *   - `'all'` (default) — flag every finding regardless of severity.
   */
  severity?: 'critical-only' | 'all'
  /** Override the default-minted `name`. */
  name?: string
  /**
   * See {@link PedanticPersonaOpts.modelHint}. Defaults to `'opus'` because
   * adversarial-reasoning quality is dispositive for security review.
   */
  modelHint?: string
}

/**
 * PII categories surfaced by {@link Personas.dataPrivacy}.
 */
export type PiiCategory =
  | 'name'
  | 'email'
  | 'phone'
  | 'ssn'
  | 'health'
  | 'financial'
  | 'biometric'
  | 'behavioral'

/**
 * Privacy frameworks surfaced by {@link Personas.dataPrivacy}.
 */
export type PrivacyFramework = 'gdpr' | 'ccpa' | 'pipeda' | 'general'

/**
 * Options for {@link Personas.dataPrivacy}.
 */
export interface DataPrivacyPersonaOpts {
  /**
   * Privacy framework whose obligations apply. Defaults to `'general'`
   * (framework-agnostic baseline that overlaps most regimes).
   */
  framework?: PrivacyFramework
  /**
   * PII categories to scan for. Defaults to all eight
   * (`name`, `email`, `phone`, `ssn`, `health`, `financial`, `biometric`,
   * `behavioral`).
   */
  piiCategories?: PiiCategory[]
  /**
   * When `true` (default), the persona enforces data-minimization — flags
   * unnecessary PII inclusion even when the included PII is otherwise
   * lawful.
   */
  minimizationCheck?: boolean
  /** Override the default-minted `name`. */
  name?: string
  /** See {@link PedanticPersonaOpts.modelHint}. */
  modelHint?: string
}

/**
 * Source-quality tiers surfaced by {@link Personas.factualAccuracy}. The list
 * is ordered from most-authoritative (`primary`) to least-authoritative
 * (`first-party`); `(string & {})` keeps autocomplete on the curated tiers
 * while allowing custom sourcing taxonomies without a library bump.
 */
export type FactualSourceType =
  | 'primary'
  | 'peer-reviewed'
  | 'government'
  | 'industry-standard'
  | 'first-party'

/**
 * Options for {@link Personas.factualAccuracy}.
 */
export interface FactualAccuracyPersonaOpts {
  /**
   * When `true` (default), every load-bearing factual claim must carry an
   * inline citation. When `false`, claims may be unsupported but the persona
   * still flags source-quality issues on whatever citations are present.
   */
  citationRequired?: boolean
  /**
   * Acceptable source-quality tiers. Defaults to all five
   * (`primary`, `peer-reviewed`, `government`, `industry-standard`,
   * `first-party`). Narrowing this list lets the persona reject otherwise-
   * valid citations from disallowed tiers (e.g. excluding `first-party` for a
   * regulatory filing).
   */
  sourceTypes?: FactualSourceType[]
  /**
   * Minimum citation count per load-bearing claim. Defaults to `1`. Raise to
   * `2`+ for high-stakes domains (medical, legal) where corroborating sources
   * are part of the editorial standard.
   */
  minCitationsPerClaim?: number
  /** Override the default-minted `name`. */
  name?: string
  /**
   * See {@link PedanticPersonaOpts.modelHint}. Defaults to `'opus'` because
   * citations may live in long source documents — a high-context-window model
   * is the right default for fact-grounding work.
   */
  modelHint?: string
}

/**
 * Tone register surfaced by {@link Personas.brandSafety}. `(string & {})`
 * keeps autocomplete on the curated registers while allowing arbitrary brand-
 * voice descriptors (e.g. `'playful-formal'`) without a library bump.
 */
export type BrandToneRange =
  | 'formal'
  | 'conversational'
  | 'technical'
  | 'irreverent'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {})

/**
 * Options for {@link Personas.brandSafety}.
 */
export interface BrandSafetyPersonaOpts {
  /**
   * Optional reference into the brand-voice guide
   * (e.g. `'brand:do-industries/voice'`). When omitted, the persona applies
   * a generic brand-voice baseline keyed to `toneRange`. Resolution is
   * deferred to the runtime.
   */
  brandVoiceRef?: string
  /**
   * Tone register the artifact should match. Defaults to `'conversational'`.
   */
  toneRange?: BrandToneRange
  /**
   * Reputational-risk tolerance.
   *   - `'high'`   — only flag content with extreme reputational risk.
   *   - `'medium'` (default) — flag content with material reputational risk.
   *   - `'low'`    — flag content with any non-trivial reputational risk.
   */
  riskTolerance?: 'high' | 'medium' | 'low'
  /** Override the default-minted `name`. */
  name?: string
  /** See {@link PedanticPersonaOpts.modelHint}. */
  modelHint?: string
}

/**
 * Budget axes surfaced by {@link Personas.budgetRealism}.
 */
export type BudgetType = 'cost' | 'time' | 'scope' | 'all'

/**
 * Optional sanity ranges for {@link Personas.budgetRealism}. Each cap is the
 * upper bound the persona treats as plausible without further justification —
 * proposals exceeding any cap are flagged as overrun-risk candidates. Omit a
 * field to defer to the LLM's own training-data norms for that axis.
 */
export interface BudgetSanityRanges {
  /** Maximum plausible cost in USD. */
  costUsdMax?: number
  /** Maximum plausible duration in weeks. */
  timeWeeksMax?: number
  /** Maximum plausible scope-item count (deliverables, features, etc). */
  scopeItemsMax?: number
}

/**
 * Options for {@link Personas.budgetRealism}.
 */
export interface BudgetRealismPersonaOpts {
  /**
   * Budget axis the persona scrutinizes. Defaults to `'all'` (cost, time,
   * and scope simultaneously). Narrow when the artifact only carries one
   * axis (e.g. a cost-only quote).
   */
  budgetType?: BudgetType
  /**
   * Optional sanity ranges. When omitted (default), the persona uses its own
   * training-data norms for each axis.
   */
  sanityRanges?: BudgetSanityRanges
  /** Override the default-minted `name`. */
  name?: string
  /** See {@link PedanticPersonaOpts.modelHint}. */
  modelHint?: string
}

/**
 * Options for {@link Personas.timelineRealism}.
 */
export interface TimelineRealismPersonaOpts {
  /**
   * When `true` (default), the persona is dependency-aware — it flags missing
   * cross-task dependencies, unmodelled handoffs, and invalid sequencing.
   * When `false`, the persona only checks raw duration plausibility per task.
   */
  dependencyAware?: boolean
  /**
   * How many weeks of forward planning the persona scrutinizes. Defaults to
   * `12` weeks (one quarter). Plans extending beyond this horizon are not
   * rejected — just not scrutinized for fine-grained sequencing past the
   * lookahead.
   */
  lookaheadWeeks?: number
  /**
   * When `true`, the persona requires that the plan declares an explicit
   * critical path. Defaults to `false` (advisory observation only when
   * critical path is missing).
   */
  criticalPathRequired?: boolean
  /** Override the default-minted `name`. */
  name?: string
  /** See {@link PedanticPersonaOpts.modelHint}. */
  modelHint?: string
}

/**
 * Artifact types surfaced by {@link Personas.scopeClarity}. `(string & {})`
 * keeps autocomplete on the curated artifact list while still accepting
 * arbitrary artifact slugs (e.g. `'rfp'`, `'design-doc'`) without a library
 * bump.
 */
export type ScopeArtifactType =
  | 'prd'
  | 'sow'
  | 'project-brief'
  | 'epic'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {})

/**
 * Options for {@link Personas.scopeClarity}.
 */
export interface ScopeClarityPersonaOpts {
  /**
   * Artifact type the persona is scrutinizing. Defaults to `'prd'`. Affects
   * the prompt language so the LLM applies artifact-appropriate scope norms
   * (e.g. SOWs typically demand contract-grade boundary statements; epics
   * demand exit-criteria-grade boundary statements).
   */
  artifactType?: ScopeArtifactType
  /**
   * When `true` (default), the persona requires an explicit scope-boundary
   * statement (what is in scope; what bounds the work). Reject on absence.
   */
  scopeBoundaryRequired?: boolean
  /**
   * When `true` (default), the persona requires an explicit out-of-scope
   * section enumerating what the artifact is NOT committing to. Reject on
   * absence.
   */
  outOfScopeListRequired?: boolean
  /** Override the default-minted `name`. */
  name?: string
  /** See {@link PedanticPersonaOpts.modelHint}. */
  modelHint?: string
}

/**
 * Edge-case domains surfaced by {@link Personas.edgeCaseCoverage}.
 */
export type EdgeCaseDomain =
  | 'empty-input'
  | 'malformed-input'
  | 'extreme-volume'
  | 'concurrent-modification'
  | 'partial-failure'
  | 'time-zone'
  | 'localization'

/**
 * Options for {@link Personas.edgeCaseCoverage}.
 */
export interface EdgeCaseCoveragePersonaOpts {
  /**
   * Edge-case domains the persona enumerates against. Defaults to all seven
   * (`empty-input`, `malformed-input`, `extreme-volume`,
   * `concurrent-modification`, `partial-failure`, `time-zone`,
   * `localization`). Narrow the list to focus the persona on a subset.
   */
  domains?: EdgeCaseDomain[]
  /**
   * Minimum edge cases enumerated per primary scenario / behaviour / endpoint.
   * Defaults to `3`. Raise for high-stakes domains where exhaustive coverage
   * is part of the editorial standard.
   */
  minEdgeCasesPerScenario?: number
  /** Override the default-minted `name`. */
  name?: string
  /**
   * See {@link PedanticPersonaOpts.modelHint}. Defaults to `'opus'` because
   * thorough edge-case enumeration benefits from a high-context-window model
   * that can simultaneously hold the full spec / scenario list while
   * enumerating its corners.
   */
  modelHint?: string
}

/**
 * Change types surfaced by {@link Personas.regressionRisk}. `(string & {})`
 * keeps autocomplete on the curated list while still accepting arbitrary
 * change-type slugs (e.g. `'feature-flag'`, `'experiment'`) without a
 * library bump.
 */
export type RegressionChangeType =
  | 'code'
  | 'config'
  | 'schema'
  | 'policy'
  | 'process'
  // eslint-disable-next-line @typescript-eslint/ban-types
  | (string & {})

/**
 * Options for {@link Personas.regressionRisk}.
 */
export interface RegressionRiskPersonaOpts {
  /**
   * Change type the persona is assessing. Defaults to `'code'`. Affects the
   * prompt language so the LLM applies change-appropriate blast-radius norms
   * (e.g. schema migrations carry data-shape blast radius; policy changes
   * carry operational-behaviour blast radius).
   */
  changeType?: RegressionChangeType
  /**
   * When `true` (default), the persona requires an explicit blast-radius
   * analysis (which systems / consumers / workflows are affected). Reject on
   * absence.
   */
  blastRadiusRequired?: boolean
  /**
   * When `true` (default), the persona requires an explicit rollback plan
   * (how the change is reversed if it regresses production). Reject on
   * absence.
   */
  rollbackPlanRequired?: boolean
  /** Override the default-minted `name`. */
  name?: string
  /**
   * See {@link PedanticPersonaOpts.modelHint}. Defaults to `'opus'` because
   * regression reasoning across system boundaries benefits from strong
   * deductive ability and a high context window.
   */
  modelHint?: string
}

/**
 * Surfaces a {@link Personas.localizationReady} reviewer can audit.
 */
export type LocalizationSurface =
  | 'prose'
  | 'numerals'
  | 'date-time'
  | 'currency'
  | 'rtl'
  | 'plurals'
  | 'cultural-references'

/**
 * Options for {@link Personas.localizationReady}.
 */
export interface LocalizationReadyPersonaOpts {
  /**
   * Target locales the artifact is intended to support
   * (e.g. `['en-US', 'fr-FR', 'ja-JP', 'ar-SA']`). Defaults to `[]`
   * (universal — the persona applies a locale-agnostic baseline that flags
   * any hard-coded locale assumption regardless of target).
   */
  targetLocales?: string[]
  /**
   * Surfaces to audit. Defaults to all seven (`prose`, `numerals`,
   * `date-time`, `currency`, `rtl`, `plurals`, `cultural-references`).
   * Narrow the list to focus the persona on a subset (e.g. `['rtl']` for an
   * Arabic-launch audit).
   */
  checkSurfaces?: LocalizationSurface[]
  /** Override the default-minted `name`. */
  name?: string
  /** See {@link PedanticPersonaOpts.modelHint}. */
  modelHint?: string
}

// ============================================================================
// Factories
// ============================================================================

/**
 * Slugify a free-form domain string for use in a persona name.
 *
 * Lower-cases, strips characters outside `[a-z0-9]`, collapses runs to a
 * single dash, trims leading / trailing dashes. Empty input becomes `'unknown'`.
 */
function slug(s: string): string {
  const out = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return out === '' ? 'unknown' : out
}

/**
 * `Personas` namespace — eighteen factory functions
 * (six general-purpose + twelve specialized).
 */
export const Personas = {
  /**
   * Pedantic validator — strict rubric/style/format checker for `domain`.
   * Verbatim rubric items (when supplied) are stored on `config.rubric` and
   * become non-negotiable assertions during review.
   */
  pedantic(opts: PedanticPersonaOpts): AgenticPersona {
    return {
      name: opts.name ?? `pedantic-validator-${slug(opts.domain)}`,
      persona:
        `You are a pedantic validator for the ${opts.domain} domain. ` +
        `Apply the rubric strictly; cite each item by index when rejecting.`,
      signOff: 'must-approve',
      config: {
        archetype: 'pedantic',
        domain: opts.domain,
        rubric: opts.rubric ?? [],
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },

  /**
   * Skeptic — adversarial probe. Hunts for failure modes within `focus` (when
   * supplied), otherwise across the broader `domain`.
   */
  skeptic(opts: SkepticPersonaOpts): AgenticPersona {
    return {
      name: opts.name ?? `skeptic-${slug(opts.domain)}`,
      persona:
        `You are an adversarial skeptic auditing the ${opts.domain} domain. ` +
        `Probe for failure modes; assume the artifact is wrong until proven otherwise.`,
      signOff: 'must-approve',
      config: {
        archetype: 'skeptic',
        domain: opts.domain,
        focus: opts.focus ?? [],
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },

  /**
   * Accuracy reviewer — fact-grounds claims against named `sources`. Rejects
   * unsupported / contradicted claims.
   */
  accuracy(opts: AccuracyPersonaOpts): AgenticPersona {
    return {
      name: opts.name ?? `accuracy-reviewer-${slug(opts.domain)}`,
      persona:
        `You are an accuracy reviewer for the ${opts.domain} domain. ` +
        `Ground every load-bearing claim against the provided sources; reject unsupported claims.`,
      signOff: 'must-approve',
      config: {
        archetype: 'accuracy',
        domain: opts.domain,
        sources: opts.sources ?? [],
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },

  /**
   * Voice / brand reviewer — checks alignment against a brand-voice guide.
   * `brandVoiceRef` is opaque here; the runtime resolves it.
   */
  voice(opts: VoicePersonaOpts): AgenticPersona {
    return {
      name: opts.name ?? `voice-and-style-${slug(opts.brandVoiceRef)}`,
      persona:
        `You review the artifact for alignment with the brand voice referenced by ${opts.brandVoiceRef}. ` +
        `Reject deviations in tone, register, or vocabulary.`,
      signOff: 'must-approve',
      config: {
        archetype: 'voice',
        brandVoiceRef: opts.brandVoiceRef,
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },

  /**
   * Coverage pedant — enforces that ≥ `minPercent` (0–1) of rubric items /
   * required sections are addressed.
   */
  coverage(opts: CoveragePersonaOpts): AgenticPersona {
    return {
      name: opts.name ?? `coverage-pedant-${Math.round(opts.minPercent * 100)}`,
      persona:
        `You are a coverage pedant. Reject the artifact unless it addresses at least ` +
        `${Math.round(opts.minPercent * 100)}% of the required rubric items / sections.`,
      signOff: 'must-approve',
      config: {
        archetype: 'coverage',
        minPercent: opts.minPercent,
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },

  /**
   * Domain expert — pulls a named expert from `business.org.ai`. `expertRef`
   * is a namespace string like `'occupations.org.ai/SeniorAccountant'`.
   */
  domain(opts: DomainPersonaOpts): AgenticPersona {
    return {
      name: opts.name ?? `domain-expert-${slug(opts.expertRef)}`,
      persona:
        `You are a domain expert as defined by ${opts.expertRef} in business.org.ai. ` +
        `Apply the expectations and norms of that role when reviewing.`,
      signOff: 'must-approve',
      config: {
        archetype: 'domain',
        expertRef: opts.expertRef,
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },

  /**
   * Regulatory-compliance reviewer — scrutinizes the artifact against a named
   * regulator-tier framework (SEC disclosure rules, HIPAA PHI handling, GDPR
   * data-minimization, etc). Always `'must-approve'` — regulator-tier checks
   * are load-bearing for any catalog Service in a regulated vertical.
   *
   * Defaults to `modelHint: 'opus'` (callers can downshift explicitly).
   *
   * `$id` namespace: `persona:regulatory-compliance:<regulator>`.
   *
   * @example
   * ```ts
   * Personas.regulatoryCompliance({ regulator: 'sec', ruleSet: ['SEC-Reg-FD'] })
   * Personas.regulatoryCompliance({ regulator: 'hipaa' })
   * Personas.regulatoryCompliance({ regulator: 'iso-27001' }) // custom OK
   * ```
   */
  regulatoryCompliance(opts: RegulatoryCompliancePersonaOpts): AgenticPersona {
    const ruleSet = opts.ruleSet ?? []
    const ruleClause =
      ruleSet.length > 0
        ? ` Apply the following rule-set verbatim: ${ruleSet.join(', ')}.`
        : ` Apply the regulator's default rule surface.`
    return {
      name: opts.name ?? `regulatory-compliance-${slug(opts.regulator)}`,
      persona:
        `You are a regulatory-compliance reviewer for the ${opts.regulator.toUpperCase()} ` +
        `framework. Scrutinize the artifact for any violation of ${opts.regulator.toUpperCase()} ` +
        `obligations (disclosure, handling, retention, redaction, consent, etc).` +
        ruleClause +
        ` Reject on any material violation; cite the specific rule when rejecting.`,
      signOff: 'must-approve',
      config: {
        $id: `persona:regulatory-compliance:${slug(opts.regulator)}`,
        archetype: 'regulatory-compliance',
        regulator: opts.regulator,
        ruleSet,
        modelHint: opts.modelHint ?? 'opus',
      },
    }
  },

  /**
   * Accessibility reviewer — WCAG 2.1 AA (default) or AAA review of any
   * human-consumed prose / UI / document output. Reads for plain-language
   * compliance, alt-text presence, semantic-heading structure, color-
   * independence claims, keyboard-reachability, and cognitive-load surfaces.
   *
   * Always `'must-approve'` — for catalog Services whose output is consumed
   * by humans, accessibility failures are dispositive.
   *
   * `$id` namespace: `persona:accessibility:wcag-<level>`.
   *
   * @example
   * ```ts
   * Personas.accessibility() // WCAG 2.1 AA, all surfaces
   * Personas.accessibility({ level: 'AAA' })
   * Personas.accessibility({ surfaces: ['screen-reader', 'cognitive'] })
   * ```
   */
  accessibility(opts: AccessibilityPersonaOpts = {}): AgenticPersona {
    const level: 'AA' | 'AAA' = opts.level ?? 'AA'
    const surfaces: AccessibilitySurface[] = opts.surfaces ?? [
      'screen-reader',
      'keyboard-only',
      'low-vision',
      'cognitive',
    ]
    return {
      name: opts.name ?? `accessibility-wcag-${slug(level)}`,
      persona:
        `You are an accessibility reviewer applying WCAG 2.1 ${level} criteria. ` +
        `Audit the artifact across these surfaces: ${surfaces.join(', ')}. ` +
        `Check for plain-language compliance, alt-text presence on non-text content, ` +
        `semantic-heading structure, color-independence (no information conveyed by ` +
        `color alone), and keyboard-only reachability where applicable. Reject on any ` +
        `WCAG 2.1 ${level} violation; cite the specific success criterion when rejecting.`,
      signOff: 'must-approve',
      config: {
        $id: `persona:accessibility:wcag-${slug(level)}`,
        archetype: 'accessibility',
        level,
        surfaces,
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },

  /**
   * Security-threat reviewer — adversarial security review across configured
   * surfaces. Hunts for leaked secrets, PII in logs, prompt-injection vectors,
   * data-exfiltration patterns, privilege-escalation paths, and DoS-
   * adjacent failure modes. Always `'must-approve'` — security failures are
   * dispositive and override aggregate sign-off policies.
   *
   * Defaults to `modelHint: 'opus'` (strong adversarial reasoning).
   *
   * `$id` namespace: `persona:security-threat:<severity>`.
   *
   * @example
   * ```ts
   * Personas.securityThreat() // all surfaces, all severities
   * Personas.securityThreat({ severity: 'critical-only' })
   * Personas.securityThreat({ surfaces: ['prompt-injection', 'pii-leakage'] })
   * ```
   */
  securityThreat(opts: SecurityThreatPersonaOpts = {}): AgenticPersona {
    const surfaces: SecuritySurface[] = opts.surfaces ?? [
      'injection',
      'data-exfiltration',
      'privilege-escalation',
      'pii-leakage',
      'prompt-injection',
      'denial-of-service',
    ]
    const severity: 'critical-only' | 'all' = opts.severity ?? 'all'
    const severityClause =
      severity === 'critical-only'
        ? ` Flag only critical-severity findings.`
        : ` Flag every finding regardless of severity.`
    return {
      name: opts.name ?? `security-threat-${slug(severity)}`,
      persona:
        `You are an adversarial security reviewer. Audit the artifact for security-` +
        `relevant content across these surfaces: ${surfaces.join(', ')}. ` +
        `Look for leaked secrets / API keys, PII in log output, prompt-injection ` +
        `vectors that could subvert downstream agents, exfiltration patterns, ` +
        `privilege-escalation paths, and denial-of-service-adjacent failure modes.` +
        severityClause +
        ` Reject on any qualifying finding; cite the specific surface and the ` +
        `evidence in the artifact when rejecting.`,
      signOff: 'must-approve',
      config: {
        $id: `persona:security-threat:${slug(severity)}`,
        archetype: 'security-threat',
        surfaces,
        severity,
        modelHint: opts.modelHint ?? 'opus',
      },
    }
  },

  /**
   * Data-privacy reviewer — privacy-impact review aligned to GDPR / CCPA /
   * PIPEDA (or framework-agnostic `'general'` baseline). Checks for
   * unnecessary PII inclusion, missing consent markers, retention-policy
   * violations, and (when `minimizationCheck` is on) data-minimization
   * compliance. Always `'must-approve'` — privacy failures are load-bearing
   * for any Service touching customer data.
   *
   * `$id` namespace: `persona:data-privacy:<framework>`.
   *
   * @example
   * ```ts
   * Personas.dataPrivacy() // 'general', all PII categories, minimization on
   * Personas.dataPrivacy({ framework: 'gdpr', minimizationCheck: true })
   * Personas.dataPrivacy({ piiCategories: ['health', 'biometric'] })
   * ```
   */
  dataPrivacy(opts: DataPrivacyPersonaOpts = {}): AgenticPersona {
    const framework: PrivacyFramework = opts.framework ?? 'general'
    const piiCategories: PiiCategory[] = opts.piiCategories ?? [
      'name',
      'email',
      'phone',
      'ssn',
      'health',
      'financial',
      'biometric',
      'behavioral',
    ]
    const minimizationCheck = opts.minimizationCheck ?? true
    const minimizationClause = minimizationCheck
      ? ` Enforce data-minimization: flag unnecessary PII inclusion even when ` +
        `the included PII is otherwise lawful.`
      : ` Data-minimization enforcement is disabled — flag only unlawful PII ` + `inclusion.`
    return {
      name: opts.name ?? `data-privacy-${slug(framework)}`,
      persona:
        `You are a data-privacy reviewer applying the ${framework.toUpperCase()} ` +
        `framework. Scan the artifact for these PII categories: ` +
        `${piiCategories.join(', ')}. Check for missing consent markers, ` +
        `retention-policy violations, and lawful-basis gaps under ${framework.toUpperCase()}.` +
        minimizationClause +
        ` Reject on any qualifying finding; cite the PII category, the framework ` +
        `obligation, and the evidence in the artifact when rejecting.`,
      signOff: 'must-approve',
      config: {
        $id: `persona:data-privacy:${slug(framework)}`,
        archetype: 'data-privacy',
        framework,
        piiCategories,
        minimizationCheck,
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },

  /**
   * Factual-accuracy reviewer — fact-checks the artifact and enforces source-
   * citation discipline. Flags unsupported claims, missing citations, and
   * source-quality issues (e.g. citing a blog post in a regulatory filing
   * that should cite primary sources). Always `'must-approve'` — Services
   * whose output makes load-bearing factual claims (financial, legal,
   * medical, technical) cannot ship unsupported assertions.
   *
   * Defaults to `modelHint: 'opus'` because citations may live in long source
   * documents — high-context-window models are the right default here.
   *
   * `$id` namespace: `persona:factual-accuracy:cit-<required>-min-<n>`.
   *
   * @example
   * ```ts
   * Personas.factualAccuracy() // citations required, all source types, min 1
   * Personas.factualAccuracy({ minCitationsPerClaim: 2 })
   * Personas.factualAccuracy({ sourceTypes: ['primary', 'peer-reviewed'] })
   * ```
   */
  factualAccuracy(opts: FactualAccuracyPersonaOpts = {}): AgenticPersona {
    const citationRequired = opts.citationRequired ?? true
    const sourceTypes: FactualSourceType[] = opts.sourceTypes ?? [
      'primary',
      'peer-reviewed',
      'government',
      'industry-standard',
      'first-party',
    ]
    const minCitationsPerClaim = opts.minCitationsPerClaim ?? 1
    const citationClause = citationRequired
      ? ` Every load-bearing factual claim MUST carry at least ` +
        `${minCitationsPerClaim} inline citation${minCitationsPerClaim === 1 ? '' : 's'}; ` +
        `reject any uncited claim.`
      : ` Citations are optional — but flag any source-quality issues on whatever ` +
        `citations are present.`
    return {
      name:
        opts.name ??
        `factual-accuracy-cit-${
          citationRequired ? 'required' : 'optional'
        }-min-${minCitationsPerClaim}`,
      persona:
        `You are a factual-accuracy reviewer. Scrutinize the artifact for ` +
        `unsupported factual claims and source-quality issues. ` +
        `Acceptable source tiers (most-authoritative first): ${sourceTypes.join(', ')}. ` +
        `Reject citations from any tier outside that list.` +
        citationClause +
        ` Cite the specific claim and the missing / inadequate source when rejecting.`,
      signOff: 'must-approve',
      config: {
        $id: `persona:factual-accuracy:cit-${
          citationRequired ? 'required' : 'optional'
        }-min-${minCitationsPerClaim}`,
        archetype: 'factual-accuracy',
        citationRequired,
        sourceTypes,
        minCitationsPerClaim,
        modelHint: opts.modelHint ?? 'opus',
      },
    }
  },

  /**
   * Brand-safety reviewer — brand-voice + reputational-risk review for
   * customer/public-facing output. Scrutinizes the artifact for off-brand
   * language, controversial claims, and reputational risks calibrated to
   * `riskTolerance`. Always `'must-approve'` — public-facing copy with
   * reputational risk is dispositive.
   *
   * `$id` namespace: `persona:brand-safety:<tone>-<risk>`.
   *
   * @example
   * ```ts
   * Personas.brandSafety() // conversational tone, medium risk tolerance
   * Personas.brandSafety({ brandVoiceRef: 'brand:do-industries/voice' })
   * Personas.brandSafety({ toneRange: 'formal', riskTolerance: 'low' })
   * ```
   */
  brandSafety(opts: BrandSafetyPersonaOpts = {}): AgenticPersona {
    const toneRange: BrandToneRange = opts.toneRange ?? 'conversational'
    const riskTolerance: 'high' | 'medium' | 'low' = opts.riskTolerance ?? 'medium'
    const brandVoiceClause =
      opts.brandVoiceRef !== undefined
        ? ` Apply the brand voice referenced by ${opts.brandVoiceRef}.`
        : ` Apply a generic brand-voice baseline keyed to the ${toneRange} register.`
    const riskClause =
      riskTolerance === 'high'
        ? ` Flag only content with extreme reputational risk.`
        : riskTolerance === 'low'
        ? ` Flag content with any non-trivial reputational risk.`
        : ` Flag content with material reputational risk.`
    return {
      name: opts.name ?? `brand-safety-${slug(toneRange)}-${slug(riskTolerance)}`,
      persona:
        `You are a brand-safety reviewer. Scrutinize the artifact for off-brand ` +
        `language, controversial claims, and reputational risks. The expected ` +
        `tone register is ${toneRange}.` +
        brandVoiceClause +
        riskClause +
        ` Reject on any qualifying finding; cite the specific phrasing and the ` +
        `brand-voice or risk dimension when rejecting.`,
      signOff: 'must-approve',
      config: {
        $id: `persona:brand-safety:${slug(toneRange)}-${slug(riskTolerance)}`,
        archetype: 'brand-safety',
        toneRange,
        riskTolerance,
        ...(opts.brandVoiceRef !== undefined && { brandVoiceRef: opts.brandVoiceRef }),
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },

  /**
   * Budget-realism reviewer — cost / time / scope realism check for
   * proposals, plans, and forecasts. Flags cost-overrun risk, timeline-
   * overrun risk, and scope-creep risk. Defaults to `'advisory'` sign-off —
   * load-bearing for any Service that proposes work, but the verdict is
   * guidance rather than a gate (the human reviewer makes the call).
   *
   * `$id` namespace: `persona:budget-realism:<budgetType>`.
   *
   * @example
   * ```ts
   * Personas.budgetRealism() // all axes, no sanity ranges
   * Personas.budgetRealism({ budgetType: 'cost' })
   * Personas.budgetRealism({ sanityRanges: { costUsdMax: 250_000 } })
   * ```
   */
  budgetRealism(opts: BudgetRealismPersonaOpts = {}): AgenticPersona {
    const budgetType: BudgetType = opts.budgetType ?? 'all'
    const sanityRanges: BudgetSanityRanges = opts.sanityRanges ?? {}
    const axesClause =
      budgetType === 'all'
        ? ` Scrutinize cost, time, and scope simultaneously.`
        : ` Scrutinize the ${budgetType} axis only.`
    const rangeParts: string[] = []
    if (sanityRanges.costUsdMax !== undefined) {
      rangeParts.push(`cost ≤ $${sanityRanges.costUsdMax.toLocaleString('en-US')}`)
    }
    if (sanityRanges.timeWeeksMax !== undefined) {
      rangeParts.push(`duration ≤ ${sanityRanges.timeWeeksMax} weeks`)
    }
    if (sanityRanges.scopeItemsMax !== undefined) {
      rangeParts.push(`scope items ≤ ${sanityRanges.scopeItemsMax}`)
    }
    const sanityClause =
      rangeParts.length > 0
        ? ` Apply these sanity ranges: ${rangeParts.join('; ')}. Flag any axis ` +
          `exceeding its cap as overrun-risk without further justification.`
        : ` No explicit sanity ranges supplied — apply your own training-data ` +
          `norms for what's plausible on each axis.`
    return {
      name: opts.name ?? `budget-realism-${slug(budgetType)}`,
      persona:
        `You are a budget-realism reviewer. Scrutinize the artifact (proposal, ` +
        `plan, forecast, or estimate) for cost-overrun risk, timeline-overrun ` +
        `risk, and scope-creep risk.` +
        axesClause +
        sanityClause +
        ` Flag overrun-risk candidates with the axis, the asserted figure, and ` +
        `the basis for the overrun concern.`,
      signOff: 'advisory',
      config: {
        $id: `persona:budget-realism:${slug(budgetType)}`,
        archetype: 'budget-realism',
        budgetType,
        sanityRanges,
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },

  /**
   * Timeline-realism reviewer — schedule + sequencing realism check for
   * plans, roadmaps, and timelines. Flags unrealistic sequencing, missing
   * dependencies, and no-slack assumptions. Defaults to `'advisory'` sign-
   * off — guidance for the human planner, not a hard gate.
   *
   * `$id` namespace: `persona:timeline-realism:lookahead-<weeks>`.
   *
   * @example
   * ```ts
   * Personas.timelineRealism() // dependency-aware, 12-week lookahead
   * Personas.timelineRealism({ lookaheadWeeks: 26 })
   * Personas.timelineRealism({ criticalPathRequired: true })
   * ```
   */
  timelineRealism(opts: TimelineRealismPersonaOpts = {}): AgenticPersona {
    const dependencyAware = opts.dependencyAware ?? true
    const lookaheadWeeks = opts.lookaheadWeeks ?? 12
    const criticalPathRequired = opts.criticalPathRequired ?? false
    const dependencyClause = dependencyAware
      ? ` Be dependency-aware: flag missing cross-task dependencies, unmodelled ` +
        `handoffs, and invalid sequencing (e.g. parallel tasks that share an ` +
        `exclusive resource).`
      : ` Dependency-awareness is disabled — check raw duration plausibility per ` + `task only.`
    const criticalPathClause = criticalPathRequired
      ? ` The plan MUST declare an explicit critical path; reject if missing.`
      : ` Critical-path declaration is optional — note its absence as advisory ` +
        `observation only.`
    return {
      name: opts.name ?? `timeline-realism-lookahead-${lookaheadWeeks}`,
      persona:
        `You are a timeline-realism reviewer. Scrutinize the artifact (plan, ` +
        `roadmap, or timeline) for unrealistic sequencing, missing dependencies, ` +
        `and no-slack assumptions over the next ${lookaheadWeeks} week` +
        `${lookaheadWeeks === 1 ? '' : 's'} of forward planning.` +
        dependencyClause +
        criticalPathClause +
        ` Flag risk candidates with the specific task, the sequencing concern, ` +
        `and the slack / dependency evidence.`,
      signOff: 'advisory',
      config: {
        $id: `persona:timeline-realism:lookahead-${lookaheadWeeks}`,
        archetype: 'timeline-realism',
        dependencyAware,
        lookaheadWeeks,
        criticalPathRequired,
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },

  /**
   * Scope-clarity reviewer — scrutinizes scoped-work artifacts (PRDs, SOWs,
   * project briefs, epics) for unclear scope statements, ambiguous deliverable
   * boundaries, and missing out-of-scope sections. Always `'must-approve'` —
   * scope ambiguity is the single largest source of downstream scope creep,
   * which makes it dispositive for any catalog Service producing a scoped-work
   * artifact.
   *
   * `$id` namespace: `persona:scope-clarity:<artifactType>`.
   *
   * @example
   * ```ts
   * Personas.scopeClarity() // 'prd', boundary required, out-of-scope required
   * Personas.scopeClarity({ artifactType: 'sow' })
   * Personas.scopeClarity({ outOfScopeListRequired: false })
   * ```
   */
  scopeClarity(opts: ScopeClarityPersonaOpts = {}): AgenticPersona {
    const artifactType: ScopeArtifactType = opts.artifactType ?? 'prd'
    const scopeBoundaryRequired = opts.scopeBoundaryRequired ?? true
    const outOfScopeListRequired = opts.outOfScopeListRequired ?? true
    const boundaryClause = scopeBoundaryRequired
      ? ` The artifact MUST declare an explicit scope boundary (what is in ` +
        `scope; what bounds the work). Reject if missing or ambiguous.`
      : ` Scope-boundary declaration is optional — note its absence as ` +
        `advisory observation only.`
    const outOfScopeClause = outOfScopeListRequired
      ? ` The artifact MUST include an explicit out-of-scope section enumerating ` +
        `what is NOT being committed to. Reject if missing.`
      : ` Out-of-scope enumeration is optional — note its absence as advisory ` +
        `observation only.`
    return {
      name: opts.name ?? `scope-clarity-${slug(artifactType)}`,
      persona:
        `You are a scope-clarity reviewer for ${artifactType.toUpperCase()} ` +
        `artifacts. Scrutinize the artifact for unclear scope statements, ` +
        `ambiguous deliverable boundaries, and unstated assumptions that would ` +
        `invite downstream scope creep.` +
        boundaryClause +
        outOfScopeClause +
        ` Reject on any qualifying finding; cite the specific section and the ` +
        `ambiguity when rejecting.`,
      signOff: 'must-approve',
      config: {
        $id: `persona:scope-clarity:${slug(artifactType)}`,
        archetype: 'scope-clarity',
        artifactType,
        scopeBoundaryRequired,
        outOfScopeListRequired,
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },

  /**
   * Edge-case-coverage reviewer — scrutinizes test plans, acceptance criteria,
   * and API contracts for missing edge-case enumeration across configured
   * domains. Always `'must-approve'` — under-enumerated edge cases are the
   * single largest source of post-ship regressions in test-plan / contract
   * artifacts, which makes them dispositive.
   *
   * Defaults to `modelHint: 'opus'` because thorough edge-case enumeration
   * benefits from a high-context-window model that can simultaneously hold the
   * full spec / scenario list while enumerating its corners.
   *
   * `$id` namespace: `persona:edge-case-coverage:min-<n>`.
   *
   * @example
   * ```ts
   * Personas.edgeCaseCoverage() // all domains, min 3 per scenario
   * Personas.edgeCaseCoverage({ minEdgeCasesPerScenario: 5 })
   * Personas.edgeCaseCoverage({ domains: ['empty-input', 'partial-failure'] })
   * ```
   */
  edgeCaseCoverage(opts: EdgeCaseCoveragePersonaOpts = {}): AgenticPersona {
    const domains: EdgeCaseDomain[] = opts.domains ?? [
      'empty-input',
      'malformed-input',
      'extreme-volume',
      'concurrent-modification',
      'partial-failure',
      'time-zone',
      'localization',
    ]
    const minEdgeCasesPerScenario = opts.minEdgeCasesPerScenario ?? 3
    return {
      name: opts.name ?? `edge-case-coverage-min-${minEdgeCasesPerScenario}`,
      persona:
        `You are an edge-case-coverage reviewer. Scrutinize the artifact ` +
        `(test plan, acceptance criteria, API contract, design doc) for missing ` +
        `edge-case enumeration. Required edge-case domains: ${domains.join(', ')}. ` +
        `Each primary scenario / behaviour / endpoint MUST enumerate at least ` +
        `${minEdgeCasesPerScenario} edge case` +
        `${minEdgeCasesPerScenario === 1 ? '' : 's'} drawn from the required ` +
        `domains. Reject any scenario falling below the cap; cite the scenario, ` +
        `the missing domains, and the count gap when rejecting.`,
      signOff: 'must-approve',
      config: {
        $id: `persona:edge-case-coverage:min-${minEdgeCasesPerScenario}`,
        archetype: 'edge-case-coverage',
        domains,
        minEdgeCasesPerScenario,
        modelHint: opts.modelHint ?? 'opus',
      },
    }
  },

  /**
   * Regression-risk reviewer — scrutinizes change proposals (PRs, schema
   * migrations, config changes, policy changes, process changes) for
   * unaccounted regression risk, missing blast-radius analysis, and missing
   * rollback steps. Always `'must-approve'` — change proposals shipping
   * without blast-radius / rollback discipline are dispositive on any
   * production-grade Service.
   *
   * Defaults to `modelHint: 'opus'` because regression reasoning across system
   * boundaries benefits from strong deductive ability and a high context
   * window.
   *
   * `$id` namespace: `persona:regression-risk:<changeType>`.
   *
   * @example
   * ```ts
   * Personas.regressionRisk() // 'code', blast-radius + rollback required
   * Personas.regressionRisk({ changeType: 'schema' })
   * Personas.regressionRisk({ rollbackPlanRequired: false })
   * ```
   */
  regressionRisk(opts: RegressionRiskPersonaOpts = {}): AgenticPersona {
    const changeType: RegressionChangeType = opts.changeType ?? 'code'
    const blastRadiusRequired = opts.blastRadiusRequired ?? true
    const rollbackPlanRequired = opts.rollbackPlanRequired ?? true
    const blastRadiusClause = blastRadiusRequired
      ? ` The proposal MUST include an explicit blast-radius analysis ` +
        `enumerating which systems / consumers / workflows are affected. ` +
        `Reject if missing or under-scoped.`
      : ` Blast-radius analysis is optional — note its absence as advisory ` + `observation only.`
    const rollbackClause = rollbackPlanRequired
      ? ` The proposal MUST include an explicit rollback plan documenting how ` +
        `the change is reversed if it regresses production. Reject if missing.`
      : ` Rollback-plan declaration is optional — note its absence as advisory ` +
        `observation only.`
    return {
      name: opts.name ?? `regression-risk-${slug(changeType)}`,
      persona:
        `You are a regression-risk reviewer for ${changeType.toUpperCase()} ` +
        `changes. Scrutinize the change proposal for unaccounted regression ` +
        `risk: hidden coupling, untested call sites, schema-shape breakage, ` +
        `policy / process side-effects, and ordering / migration hazards.` +
        blastRadiusClause +
        rollbackClause +
        ` Reject on any qualifying finding; cite the specific risk, the ` +
        `affected surface, and the missing mitigation when rejecting.`,
      signOff: 'must-approve',
      config: {
        $id: `persona:regression-risk:${slug(changeType)}`,
        archetype: 'regression-risk',
        changeType,
        blastRadiusRequired,
        rollbackPlanRequired,
        modelHint: opts.modelHint ?? 'opus',
      },
    }
  },

  /**
   * Localization-readiness reviewer — i18n / l10n review of prose, UI, and
   * document output for hard-coded locale assumptions, missing pluralization
   * rules, untranslatable cultural references, and RTL-hostile layout
   * assumptions. Defaults to `'advisory'` sign-off — informational for
   * single-locale Services, load-bearing for global-product Services where
   * localization defects ship to real users.
   *
   * `$id` namespace: `persona:localization-ready:<locales>`.
   *
   * @example
   * ```ts
   * Personas.localizationReady() // universal baseline, all surfaces
   * Personas.localizationReady({ targetLocales: ['en-US', 'ja-JP', 'ar-SA'] })
   * Personas.localizationReady({ checkSurfaces: ['rtl', 'plurals'] })
   * ```
   */
  localizationReady(opts: LocalizationReadyPersonaOpts = {}): AgenticPersona {
    const targetLocales: string[] = opts.targetLocales ?? []
    const checkSurfaces: LocalizationSurface[] = opts.checkSurfaces ?? [
      'prose',
      'numerals',
      'date-time',
      'currency',
      'rtl',
      'plurals',
      'cultural-references',
    ]
    const localesDiscriminator =
      targetLocales.length === 0 ? 'universal' : targetLocales.map(slug).join('-')
    const localesClause =
      targetLocales.length === 0
        ? ` No specific target locales supplied — apply a universal baseline ` +
          `that flags any hard-coded locale assumption regardless of target.`
        : ` Target locales: ${targetLocales.join(', ')}. Apply each locale's ` +
          `conventions when assessing the surfaces below.`
    return {
      name: opts.name ?? `localization-ready-${localesDiscriminator}`,
      persona:
        `You are a localization-readiness reviewer. Scrutinize the artifact ` +
        `(prose, UI copy, document output) for hard-coded locale assumptions, ` +
        `missing pluralization rules, untranslatable cultural references, and ` +
        `RTL-hostile layout assumptions. Surfaces to audit: ` +
        `${checkSurfaces.join(', ')}.` +
        localesClause +
        ` Flag findings with the specific surface, the locale-affected phrasing ` +
        `or pattern, and the recommended remediation.`,
      signOff: 'advisory',
      config: {
        $id: `persona:localization-ready:${localesDiscriminator}`,
        archetype: 'localization-ready',
        targetLocales,
        checkSurfaces,
        ...(opts.modelHint !== undefined && { modelHint: opts.modelHint }),
      },
    }
  },
}
