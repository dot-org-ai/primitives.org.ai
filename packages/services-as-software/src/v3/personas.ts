/**
 * Personas — reusable persona factory library (v3 §9).
 *
 * Ten factories — six general-purpose evaluation axes plus four specialized
 * domain factories that cover the regulator/safety surfaces Services in
 * regulated verticals frequently need. Each factory mints an
 * {@link AgenticPersona} ready to drop into an
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
 * All factories default `signOff` to `'must-approve'`. Each factory mints a
 * default `name` of the form `'<archetype>-<domain>'` (e.g.
 * `'pedantic-validator-gaap'`). Callers may pass an explicit `name` to
 * override — useful when the panel uses natural names like `'qa-reviewer'`
 * instead of the minted convention.
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
 * `Personas` namespace — six factory functions.
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
}
