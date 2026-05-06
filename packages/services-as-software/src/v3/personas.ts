/**
 * Personas — reusable persona factory library (v3 §9).
 *
 * Six factories that cover ~80% of the seed catalog's evaluator-slot needs
 * (per the Catalog HOW agent's persona-reuse analysis). Each factory mints
 * an {@link AgenticPersona} ready to drop into an
 * {@link EvaluatorPanelSpec.personas} array.
 *
 * Custom personas remain first-class — construct an `AgenticPersona` literal
 * directly. The factories are sugar, not a moat.
 *
 *   - {@link Personas.pedantic} — strict rubric/style/format checker.
 *   - {@link Personas.skeptic}  — adversarial probe, looks for failure modes.
 *   - {@link Personas.accuracy} — fact-grounding against named sources.
 *   - {@link Personas.voice}    — brand-voice / tone / style alignment.
 *   - {@link Personas.coverage} — completeness floor (e.g. ≥ 95% rubric items).
 *   - {@link Personas.domain}   — pulls a named expert from `business.org.ai`.
 *
 * All factories default `signOff` to `'must-approve'`. Pass-through `name`
 * convention is `'<archetype>-validator-<domain>'`.
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
      name: `pedantic-validator-${slug(opts.domain)}`,
      persona:
        `You are a pedantic validator for the ${opts.domain} domain. ` +
        `Apply the rubric strictly; cite each item by index when rejecting.`,
      signOff: 'must-approve',
      config: {
        archetype: 'pedantic',
        domain: opts.domain,
        rubric: opts.rubric ?? [],
      },
    }
  },

  /**
   * Skeptic — adversarial probe. Hunts for failure modes within `focus` (when
   * supplied), otherwise across the broader `domain`.
   */
  skeptic(opts: SkepticPersonaOpts): AgenticPersona {
    return {
      name: `skeptic-${slug(opts.domain)}`,
      persona:
        `You are an adversarial skeptic auditing the ${opts.domain} domain. ` +
        `Probe for failure modes; assume the artifact is wrong until proven otherwise.`,
      signOff: 'must-approve',
      config: {
        archetype: 'skeptic',
        domain: opts.domain,
        focus: opts.focus ?? [],
      },
    }
  },

  /**
   * Accuracy reviewer — fact-grounds claims against named `sources`. Rejects
   * unsupported / contradicted claims.
   */
  accuracy(opts: AccuracyPersonaOpts): AgenticPersona {
    return {
      name: `accuracy-reviewer-${slug(opts.domain)}`,
      persona:
        `You are an accuracy reviewer for the ${opts.domain} domain. ` +
        `Ground every load-bearing claim against the provided sources; reject unsupported claims.`,
      signOff: 'must-approve',
      config: {
        archetype: 'accuracy',
        domain: opts.domain,
        sources: opts.sources ?? [],
      },
    }
  },

  /**
   * Voice / brand reviewer — checks alignment against a brand-voice guide.
   * `brandVoiceRef` is opaque here; the runtime resolves it.
   */
  voice(opts: VoicePersonaOpts): AgenticPersona {
    return {
      name: `voice-and-style-${slug(opts.brandVoiceRef)}`,
      persona:
        `You review the artifact for alignment with the brand voice referenced by ${opts.brandVoiceRef}. ` +
        `Reject deviations in tone, register, or vocabulary.`,
      signOff: 'must-approve',
      config: {
        archetype: 'voice',
        brandVoiceRef: opts.brandVoiceRef,
      },
    }
  },

  /**
   * Coverage pedant — enforces that ≥ `minPercent` (0–1) of rubric items /
   * required sections are addressed.
   */
  coverage(opts: CoveragePersonaOpts): AgenticPersona {
    return {
      name: `coverage-pedant-${Math.round(opts.minPercent * 100)}`,
      persona:
        `You are a coverage pedant. Reject the artifact unless it addresses at least ` +
        `${Math.round(opts.minPercent * 100)}% of the required rubric items / sections.`,
      signOff: 'must-approve',
      config: {
        archetype: 'coverage',
        minPercent: opts.minPercent,
      },
    }
  },

  /**
   * Domain expert — pulls a named expert from `business.org.ai`. `expertRef`
   * is a namespace string like `'occupations.org.ai/SeniorAccountant'`.
   */
  domain(opts: DomainPersonaOpts): AgenticPersona {
    return {
      name: `domain-expert-${slug(opts.expertRef)}`,
      persona:
        `You are a domain expert as defined by ${opts.expertRef} in business.org.ai. ` +
        `Apply the expectations and norms of that role when reviewing.`,
      signOff: 'must-approve',
      config: {
        archetype: 'domain',
        expertRef: opts.expertRef,
      },
    }
  },
}
