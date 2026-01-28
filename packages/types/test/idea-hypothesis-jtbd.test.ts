/**
 * @org.ai/types - TDD RED Phase Tests for Idea, Hypothesis, JTBD
 *
 * These tests verify that the validation framework types are correctly exported.
 * Tests should FAIL initially because the types are not yet implemented.
 *
 * Issue: aip-kzbp
 *
 * Expected types:
 * - IdeaType - Business idea type with status workflow
 * - HypothesisType - Testable hypothesis with evidence collection
 * - JTBDType - Jobs To Be Done framework type
 */

import { describe, it, expect } from 'vitest'

// ============================================================================
// Idea Type - TDD RED Phase (aip-kzbp)
// ============================================================================

describe('Idea type (schema.org.ai)', () => {
  describe('exports', () => {
    it('should export Idea runtime marker', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('Idea')
    })

    it('should export IdeaType type', async () => {
      // Type-level test: IdeaType should be importable
      type IdeaType = import('../src/index.js').IdeaType
      const ideaExists: IdeaType extends object ? true : false = true
      expect(ideaExists).toBe(true)
    })

    it('should export IdeaStatus type', async () => {
      // IdeaStatus should be a union type
      type IdeaStatus = import('../src/index.js').IdeaStatus
      const validStatuses: IdeaStatus[] = ['raw', 'refined', 'validated', 'rejected']
      expect(validStatuses).toHaveLength(4)
    })

    it('should export isIdea type guard', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('isIdea')
      expect(typeof module.isIdea).toBe('function')
    })
  })

  describe('IdeaType interface structure', () => {
    it('should have $type set to schema.org.ai/Idea', async () => {
      type IdeaType = import('../src/index.js').IdeaType
      type HasType = IdeaType extends { $type: 'https://schema.org.ai/Idea' } ? true : false
      const hasType: HasType = true
      expect(hasType).toBe(true)
    })

    it('should have name as required string field', async () => {
      type IdeaType = import('../src/index.js').IdeaType
      type HasName = IdeaType extends { name: string } ? true : false
      const hasName: HasName = true
      expect(hasName).toBe(true)
    })

    it('should have pitch as required string field', async () => {
      type IdeaType = import('../src/index.js').IdeaType
      type HasPitch = IdeaType extends { pitch: string } ? true : false
      const hasPitch: HasPitch = true
      expect(hasPitch).toBe(true)
    })

    it('should have description as optional string field', async () => {
      type IdeaType = import('../src/index.js').IdeaType
      type HasDescription = 'description' extends keyof IdeaType ? true : false
      const hasDescription: HasDescription = true
      expect(hasDescription).toBe(true)
    })

    it('should have status as IdeaStatus type', async () => {
      type IdeaType = import('../src/index.js').IdeaType
      type IdeaStatus = import('../src/index.js').IdeaStatus
      type StatusMatches = IdeaType['status'] extends IdeaStatus ? true : false
      const statusMatches: StatusMatches = true
      expect(statusMatches).toBe(true)
    })

    it('should have optional startup relationship field', async () => {
      type IdeaType = import('../src/index.js').IdeaType
      type HasStartup = 'startup' extends keyof IdeaType ? true : false
      const hasStartup: HasStartup = true
      expect(hasStartup).toBe(true)
    })

    it('should have optional hypotheses array field', async () => {
      type IdeaType = import('../src/index.js').IdeaType
      type HasHypotheses = 'hypotheses' extends keyof IdeaType ? true : false
      const hasHypotheses: HasHypotheses = true
      expect(hasHypotheses).toBe(true)
    })

    it('should have optional tags array field', async () => {
      type IdeaType = import('../src/index.js').IdeaType
      type HasTags = 'tags' extends keyof IdeaType ? true : false
      const hasTags: HasTags = true
      expect(hasTags).toBe(true)
    })

    it('should have createdAt and updatedAt timestamp fields', async () => {
      type IdeaType = import('../src/index.js').IdeaType
      type HasTimestamps = IdeaType extends { createdAt?: Date; updatedAt?: Date } ? true : false
      const hasTimestamps: HasTimestamps = true
      expect(hasTimestamps).toBe(true)
    })
  })

  describe('IdeaStatus union type', () => {
    it('should include raw status for new unrefined ideas', async () => {
      type IdeaStatus = import('../src/index.js').IdeaStatus
      type HasRaw = 'raw' extends IdeaStatus ? true : false
      const hasRaw: HasRaw = true
      expect(hasRaw).toBe(true)
    })

    it('should include refined status for developed ideas', async () => {
      type IdeaStatus = import('../src/index.js').IdeaStatus
      type HasRefined = 'refined' extends IdeaStatus ? true : false
      const hasRefined: HasRefined = true
      expect(hasRefined).toBe(true)
    })

    it('should include validated status for proven ideas', async () => {
      type IdeaStatus = import('../src/index.js').IdeaStatus
      type HasValidated = 'validated' extends IdeaStatus ? true : false
      const hasValidated: HasValidated = true
      expect(hasValidated).toBe(true)
    })

    it('should include rejected status for discarded ideas', async () => {
      type IdeaStatus = import('../src/index.js').IdeaStatus
      type HasRejected = 'rejected' extends IdeaStatus ? true : false
      const hasRejected: HasRejected = true
      expect(hasRejected).toBe(true)
    })
  })

  describe('isIdea type guard', () => {
    it('should return true for valid Idea objects', async () => {
      const { isIdea } = await import('../src/index.js')
      const validIdea = {
        $type: 'https://schema.org.ai/Idea',
        $id: 'https://example.com/ideas/todoai',
        name: 'AI-powered todo app',
        pitch: 'TodoAI uses AI to prioritize your tasks automatically',
        status: 'raw',
      }
      expect(isIdea(validIdea)).toBe(true)
    })

    it('should return false for objects without $type', async () => {
      const { isIdea } = await import('../src/index.js')
      const invalid = {
        $id: 'https://example.com/ideas/todoai',
        name: 'AI-powered todo app',
        pitch: 'TodoAI uses AI to prioritize your tasks',
        status: 'raw',
      }
      expect(isIdea(invalid)).toBe(false)
    })

    it('should return false for objects with wrong $type', async () => {
      const { isIdea } = await import('../src/index.js')
      const invalid = {
        $type: 'https://schema.org.ai/Hypothesis',
        $id: 'https://example.com/ideas/todoai',
        name: 'AI-powered todo app',
        pitch: 'TodoAI uses AI to prioritize your tasks',
        status: 'raw',
      }
      expect(isIdea(invalid)).toBe(false)
    })

    it('should return false for objects missing required fields', async () => {
      const { isIdea } = await import('../src/index.js')
      const missingName = {
        $type: 'https://schema.org.ai/Idea',
        $id: 'https://example.com/ideas/todoai',
        pitch: 'TodoAI uses AI to prioritize your tasks',
        status: 'raw',
      }
      const missingPitch = {
        $type: 'https://schema.org.ai/Idea',
        $id: 'https://example.com/ideas/todoai',
        name: 'AI-powered todo app',
        status: 'raw',
      }
      expect(isIdea(missingName)).toBe(false)
      expect(isIdea(missingPitch)).toBe(false)
    })

    it('should return false for null and undefined', async () => {
      const { isIdea } = await import('../src/index.js')
      expect(isIdea(null)).toBe(false)
      expect(isIdea(undefined)).toBe(false)
    })

    it('should return false for primitive values', async () => {
      const { isIdea } = await import('../src/index.js')
      expect(isIdea('string')).toBe(false)
      expect(isIdea(123)).toBe(false)
      expect(isIdea(true)).toBe(false)
    })
  })
})

// ============================================================================
// Hypothesis Type - TDD RED Phase (aip-kzbp)
// ============================================================================

describe('Hypothesis type (schema.org.ai)', () => {
  describe('exports', () => {
    it('should export Hypothesis runtime marker', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('Hypothesis')
    })

    it('should export HypothesisType type', async () => {
      // Type-level test: HypothesisType should be importable
      type HypothesisType = import('../src/index.js').HypothesisType
      const hypothesisExists: HypothesisType extends object ? true : false = true
      expect(hypothesisExists).toBe(true)
    })

    it('should export HypothesisStatus type', async () => {
      // HypothesisStatus should be a union type
      type HypothesisStatus = import('../src/index.js').HypothesisStatus
      const validStatuses: HypothesisStatus[] = ['untested', 'testing', 'validated', 'invalidated']
      expect(validStatuses).toHaveLength(4)
    })

    it('should export Evidence type', async () => {
      type Evidence = import('../src/index.js').Evidence
      const evidenceExists: Evidence extends object ? true : false = true
      expect(evidenceExists).toBe(true)
    })

    it('should export isHypothesis type guard', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('isHypothesis')
      expect(typeof module.isHypothesis).toBe('function')
    })
  })

  describe('HypothesisType interface structure', () => {
    it('should have $type set to schema.org.ai/Hypothesis', async () => {
      type HypothesisType = import('../src/index.js').HypothesisType
      type HasType = HypothesisType extends { $type: 'https://schema.org.ai/Hypothesis' }
        ? true
        : false
      const hasType: HasType = true
      expect(hasType).toBe(true)
    })

    it('should have statement as required string field', async () => {
      type HypothesisType = import('../src/index.js').HypothesisType
      type HasStatement = HypothesisType extends { statement: string } ? true : false
      const hasStatement: HasStatement = true
      expect(hasStatement).toBe(true)
    })

    it('should have metric as required string field', async () => {
      type HypothesisType = import('../src/index.js').HypothesisType
      type HasMetric = HypothesisType extends { metric: string } ? true : false
      const hasMetric: HasMetric = true
      expect(hasMetric).toBe(true)
    })

    it('should have target as required number field', async () => {
      type HypothesisType = import('../src/index.js').HypothesisType
      type HasTarget = HypothesisType extends { target: number } ? true : false
      const hasTarget: HasTarget = true
      expect(hasTarget).toBe(true)
    })

    it('should have status as HypothesisStatus type', async () => {
      type HypothesisType = import('../src/index.js').HypothesisType
      type HypothesisStatus = import('../src/index.js').HypothesisStatus
      type StatusMatches = HypothesisType['status'] extends HypothesisStatus ? true : false
      const statusMatches: StatusMatches = true
      expect(statusMatches).toBe(true)
    })

    it('should have optional evidence array field', async () => {
      type HypothesisType = import('../src/index.js').HypothesisType
      type HasEvidence = 'evidence' extends keyof HypothesisType ? true : false
      const hasEvidence: HasEvidence = true
      expect(hasEvidence).toBe(true)
    })

    it('should have optional idea relationship field', async () => {
      type HypothesisType = import('../src/index.js').HypothesisType
      type HasIdea = 'idea' extends keyof HypothesisType ? true : false
      const hasIdea: HasIdea = true
      expect(hasIdea).toBe(true)
    })

    it('should have optional baseline number field', async () => {
      type HypothesisType = import('../src/index.js').HypothesisType
      type HasBaseline = 'baseline' extends keyof HypothesisType ? true : false
      const hasBaseline: HasBaseline = true
      expect(hasBaseline).toBe(true)
    })

    it('should have optional deadline date field', async () => {
      type HypothesisType = import('../src/index.js').HypothesisType
      type HasDeadline = 'deadline' extends keyof HypothesisType ? true : false
      const hasDeadline: HasDeadline = true
      expect(hasDeadline).toBe(true)
    })

    it('should have createdAt and updatedAt timestamp fields', async () => {
      type HypothesisType = import('../src/index.js').HypothesisType
      type HasTimestamps = HypothesisType extends { createdAt?: Date; updatedAt?: Date }
        ? true
        : false
      const hasTimestamps: HasTimestamps = true
      expect(hasTimestamps).toBe(true)
    })
  })

  describe('HypothesisStatus union type', () => {
    it('should include untested status for new hypotheses', async () => {
      type HypothesisStatus = import('../src/index.js').HypothesisStatus
      type HasUntested = 'untested' extends HypothesisStatus ? true : false
      const hasUntested: HasUntested = true
      expect(hasUntested).toBe(true)
    })

    it('should include testing status for hypotheses under test', async () => {
      type HypothesisStatus = import('../src/index.js').HypothesisStatus
      type HasTesting = 'testing' extends HypothesisStatus ? true : false
      const hasTesting: HasTesting = true
      expect(hasTesting).toBe(true)
    })

    it('should include validated status for proven hypotheses', async () => {
      type HypothesisStatus = import('../src/index.js').HypothesisStatus
      type HasValidated = 'validated' extends HypothesisStatus ? true : false
      const hasValidated: HasValidated = true
      expect(hasValidated).toBe(true)
    })

    it('should include invalidated status for disproven hypotheses', async () => {
      type HypothesisStatus = import('../src/index.js').HypothesisStatus
      type HasInvalidated = 'invalidated' extends HypothesisStatus ? true : false
      const hasInvalidated: HasInvalidated = true
      expect(hasInvalidated).toBe(true)
    })
  })

  describe('Evidence interface structure', () => {
    it('should have type field for evidence classification', async () => {
      type Evidence = import('../src/index.js').Evidence
      type HasType = Evidence extends { type: string } ? true : false
      const hasType: HasType = true
      expect(hasType).toBe(true)
    })

    it('should have value field for measured result', async () => {
      type Evidence = import('../src/index.js').Evidence
      type HasValue = Evidence extends { value: number } ? true : false
      const hasValue: HasValue = true
      expect(hasValue).toBe(true)
    })

    it('should have source field for evidence origin', async () => {
      type Evidence = import('../src/index.js').Evidence
      type HasSource = Evidence extends { source: string } ? true : false
      const hasSource: HasSource = true
      expect(hasSource).toBe(true)
    })

    it('should have collectedAt timestamp field', async () => {
      type Evidence = import('../src/index.js').Evidence
      type HasCollectedAt = Evidence extends { collectedAt: Date } ? true : false
      const hasCollectedAt: HasCollectedAt = true
      expect(hasCollectedAt).toBe(true)
    })

    it('should have optional notes field', async () => {
      type Evidence = import('../src/index.js').Evidence
      type HasNotes = 'notes' extends keyof Evidence ? true : false
      const hasNotes: HasNotes = true
      expect(hasNotes).toBe(true)
    })

    it('should have optional confidence number field (0-1)', async () => {
      type Evidence = import('../src/index.js').Evidence
      type HasConfidence = 'confidence' extends keyof Evidence ? true : false
      const hasConfidence: HasConfidence = true
      expect(hasConfidence).toBe(true)
    })
  })

  describe('isHypothesis type guard', () => {
    it('should return true for valid Hypothesis objects', async () => {
      const { isHypothesis } = await import('../src/index.js')
      const validHypothesis = {
        $type: 'https://schema.org.ai/Hypothesis',
        $id: 'https://example.com/hypotheses/pricing',
        statement: 'Users will pay $10/month for AI task prioritization',
        metric: 'conversion_rate',
        target: 0.05,
        status: 'untested',
      }
      expect(isHypothesis(validHypothesis)).toBe(true)
    })

    it('should return false for objects without $type', async () => {
      const { isHypothesis } = await import('../src/index.js')
      const invalid = {
        $id: 'https://example.com/hypotheses/pricing',
        statement: 'Users will pay $10/month',
        metric: 'conversion_rate',
        target: 0.05,
        status: 'untested',
      }
      expect(isHypothesis(invalid)).toBe(false)
    })

    it('should return false for objects with wrong $type', async () => {
      const { isHypothesis } = await import('../src/index.js')
      const invalid = {
        $type: 'https://schema.org.ai/Idea',
        $id: 'https://example.com/hypotheses/pricing',
        statement: 'Users will pay $10/month',
        metric: 'conversion_rate',
        target: 0.05,
        status: 'untested',
      }
      expect(isHypothesis(invalid)).toBe(false)
    })

    it('should return false for objects missing required fields', async () => {
      const { isHypothesis } = await import('../src/index.js')
      const missingStatement = {
        $type: 'https://schema.org.ai/Hypothesis',
        $id: 'https://example.com/hypotheses/pricing',
        metric: 'conversion_rate',
        target: 0.05,
        status: 'untested',
      }
      const missingMetric = {
        $type: 'https://schema.org.ai/Hypothesis',
        $id: 'https://example.com/hypotheses/pricing',
        statement: 'Users will pay $10/month',
        target: 0.05,
        status: 'untested',
      }
      const missingTarget = {
        $type: 'https://schema.org.ai/Hypothesis',
        $id: 'https://example.com/hypotheses/pricing',
        statement: 'Users will pay $10/month',
        metric: 'conversion_rate',
        status: 'untested',
      }
      expect(isHypothesis(missingStatement)).toBe(false)
      expect(isHypothesis(missingMetric)).toBe(false)
      expect(isHypothesis(missingTarget)).toBe(false)
    })

    it('should return false for null and undefined', async () => {
      const { isHypothesis } = await import('../src/index.js')
      expect(isHypothesis(null)).toBe(false)
      expect(isHypothesis(undefined)).toBe(false)
    })

    it('should return false for primitive values', async () => {
      const { isHypothesis } = await import('../src/index.js')
      expect(isHypothesis('string')).toBe(false)
      expect(isHypothesis(123)).toBe(false)
      expect(isHypothesis(true)).toBe(false)
    })
  })
})

// ============================================================================
// JTBD (Jobs To Be Done) Type - TDD RED Phase (aip-kzbp)
// ============================================================================

describe('JTBD type (schema.org.ai)', () => {
  describe('exports', () => {
    it('should export JTBD runtime marker', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('JTBD')
    })

    it('should export JTBDType type', async () => {
      // Type-level test: JTBDType should be importable
      type JTBDType = import('../src/index.js').JTBDType
      const jtbdExists: JTBDType extends object ? true : false = true
      expect(jtbdExists).toBe(true)
    })

    it('should export JobDimension type', async () => {
      type JobDimension = import('../src/index.js').JobDimension
      const dimensionExists: JobDimension extends object ? true : false = true
      expect(dimensionExists).toBe(true)
    })

    it('should export JTBDFrequency type', async () => {
      type JTBDFrequency = import('../src/index.js').JTBDFrequency
      const validFrequencies: JTBDFrequency[] = [
        'hourly',
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'yearly',
        'occasionally',
      ]
      expect(validFrequencies).toHaveLength(7)
    })

    it('should export isJTBD type guard', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('isJTBD')
      expect(typeof module.isJTBD).toBe('function')
    })
  })

  describe('JTBDType interface structure', () => {
    it('should have $type set to schema.org.ai/JTBD', async () => {
      type JTBDType = import('../src/index.js').JTBDType
      type HasType = JTBDType extends { $type: 'https://schema.org.ai/JTBD' } ? true : false
      const hasType: HasType = true
      expect(hasType).toBe(true)
    })

    it('should have situation field (When...)', async () => {
      type JTBDType = import('../src/index.js').JTBDType
      type HasSituation = JTBDType extends { situation: string } ? true : false
      const hasSituation: HasSituation = true
      expect(hasSituation).toBe(true)
    })

    it('should have motivation field (I want to...)', async () => {
      type JTBDType = import('../src/index.js').JTBDType
      type HasMotivation = JTBDType extends { motivation: string } ? true : false
      const hasMotivation: HasMotivation = true
      expect(hasMotivation).toBe(true)
    })

    it('should have outcome field (So I can...)', async () => {
      type JTBDType = import('../src/index.js').JTBDType
      type HasOutcome = JTBDType extends { outcome: string } ? true : false
      const hasOutcome: HasOutcome = true
      expect(hasOutcome).toBe(true)
    })

    it('should have optional functional dimension field', async () => {
      type JTBDType = import('../src/index.js').JTBDType
      type HasFunctional = 'functional' extends keyof JTBDType ? true : false
      const hasFunctional: HasFunctional = true
      expect(hasFunctional).toBe(true)
    })

    it('should have optional emotional dimension field', async () => {
      type JTBDType = import('../src/index.js').JTBDType
      type HasEmotional = 'emotional' extends keyof JTBDType ? true : false
      const hasEmotional: HasEmotional = true
      expect(hasEmotional).toBe(true)
    })

    it('should have optional social dimension field', async () => {
      type JTBDType = import('../src/index.js').JTBDType
      type HasSocial = 'social' extends keyof JTBDType ? true : false
      const hasSocial: HasSocial = true
      expect(hasSocial).toBe(true)
    })

    it('should have optional priority field (1-5)', async () => {
      type JTBDType = import('../src/index.js').JTBDType
      type HasPriority = 'priority' extends keyof JTBDType ? true : false
      const hasPriority: HasPriority = true
      expect(hasPriority).toBe(true)
    })

    it('should have optional frequency field', async () => {
      type JTBDType = import('../src/index.js').JTBDType
      type HasFrequency = 'frequency' extends keyof JTBDType ? true : false
      const hasFrequency: HasFrequency = true
      expect(hasFrequency).toBe(true)
    })

    it('should have optional persona/icp relationship field', async () => {
      type JTBDType = import('../src/index.js').JTBDType
      type HasPersona = 'persona' extends keyof JTBDType ? true : false
      const hasPersona: HasPersona = true
      expect(hasPersona).toBe(true)
    })

    it('should have createdAt and updatedAt timestamp fields', async () => {
      type JTBDType = import('../src/index.js').JTBDType
      type HasTimestamps = JTBDType extends { createdAt?: Date; updatedAt?: Date } ? true : false
      const hasTimestamps: HasTimestamps = true
      expect(hasTimestamps).toBe(true)
    })
  })

  describe('JobDimension interface structure', () => {
    it('should have description field', async () => {
      type JobDimension = import('../src/index.js').JobDimension
      type HasDescription = JobDimension extends { description: string } ? true : false
      const hasDescription: HasDescription = true
      expect(hasDescription).toBe(true)
    })

    it('should have importance number field (0-10)', async () => {
      type JobDimension = import('../src/index.js').JobDimension
      type HasImportance = JobDimension extends { importance: number } ? true : false
      const hasImportance: HasImportance = true
      expect(hasImportance).toBe(true)
    })

    it('should have optional currentSolution field', async () => {
      type JobDimension = import('../src/index.js').JobDimension
      type HasCurrentSolution = 'currentSolution' extends keyof JobDimension ? true : false
      const hasCurrentSolution: HasCurrentSolution = true
      expect(hasCurrentSolution).toBe(true)
    })

    it('should have optional satisfaction number field (0-10)', async () => {
      type JobDimension = import('../src/index.js').JobDimension
      type HasSatisfaction = 'satisfaction' extends keyof JobDimension ? true : false
      const hasSatisfaction: HasSatisfaction = true
      expect(hasSatisfaction).toBe(true)
    })
  })

  describe('JTBD statement format', () => {
    it('should support the When/I want/So I can pattern', async () => {
      type JTBDType = import('../src/index.js').JTBDType
      // A valid JTBD follows the pattern:
      // When [situation], I want to [motivation], so I can [outcome]
      const exampleJTBD: Pick<JTBDType, 'situation' | 'motivation' | 'outcome'> = {
        situation: 'I have a long list of tasks to complete',
        motivation: 'quickly identify what to work on next',
        outcome: 'make progress on my most important goals',
      }
      expect(exampleJTBD.situation).toBeDefined()
      expect(exampleJTBD.motivation).toBeDefined()
      expect(exampleJTBD.outcome).toBeDefined()
    })

    it('should have helper to format as statement string', async () => {
      const { formatJTBDStatement } = await import('../src/index.js')
      expect(typeof formatJTBDStatement).toBe('function')

      const result = formatJTBDStatement({
        situation: 'I have a long list of tasks',
        motivation: 'quickly identify what to work on next',
        outcome: 'make progress on my most important goals',
      })
      expect(result).toBe(
        'When I have a long list of tasks, I want to quickly identify what to work on next, so I can make progress on my most important goals.'
      )
    })
  })

  describe('Job dimensions', () => {
    it('should support functional dimension (practical task completion)', async () => {
      type JobDimension = import('../src/index.js').JobDimension
      const functionalJob: JobDimension = {
        description: 'Complete my work tasks efficiently',
        importance: 9,
        currentSolution: 'Manual prioritization',
        satisfaction: 4,
      }
      expect(functionalJob.description).toBeDefined()
      expect(functionalJob.importance).toBeGreaterThanOrEqual(0)
    })

    it('should support emotional dimension (feelings and peace of mind)', async () => {
      type JobDimension = import('../src/index.js').JobDimension
      const emotionalJob: JobDimension = {
        description: 'Feel in control of my workload',
        importance: 8,
        currentSolution: 'Anxiety and stress',
        satisfaction: 3,
      }
      expect(emotionalJob.description).toBeDefined()
    })

    it('should support social dimension (how others perceive me)', async () => {
      type JobDimension = import('../src/index.js').JobDimension
      const socialJob: JobDimension = {
        description: 'Be seen as reliable and organized',
        importance: 7,
        currentSolution: 'Over-communication',
        satisfaction: 5,
      }
      expect(socialJob.description).toBeDefined()
    })
  })

  describe('isJTBD type guard', () => {
    it('should return true for valid JTBD objects', async () => {
      const { isJTBD } = await import('../src/index.js')
      const validJTBD = {
        $type: 'https://schema.org.ai/JTBD',
        $id: 'https://example.com/jtbds/task-prioritization',
        situation: 'I have too many tasks',
        motivation: 'find the most important one',
        outcome: 'make meaningful progress',
      }
      expect(isJTBD(validJTBD)).toBe(true)
    })

    it('should return true for JTBD with all dimensions', async () => {
      const { isJTBD } = await import('../src/index.js')
      const fullJTBD = {
        $type: 'https://schema.org.ai/JTBD',
        $id: 'https://example.com/jtbds/full',
        situation: 'I have too many tasks',
        motivation: 'find the most important one',
        outcome: 'make meaningful progress',
        functional: { description: 'Complete tasks', importance: 9 },
        emotional: { description: 'Feel calm', importance: 8 },
        social: { description: 'Look organized', importance: 6 },
        priority: 5,
        frequency: 'daily',
      }
      expect(isJTBD(fullJTBD)).toBe(true)
    })

    it('should return false for objects without $type', async () => {
      const { isJTBD } = await import('../src/index.js')
      const invalid = {
        $id: 'https://example.com/jtbds/task-prioritization',
        situation: 'I have too many tasks',
        motivation: 'find the most important one',
        outcome: 'make meaningful progress',
      }
      expect(isJTBD(invalid)).toBe(false)
    })

    it('should return false for objects with wrong $type', async () => {
      const { isJTBD } = await import('../src/index.js')
      const invalid = {
        $type: 'https://schema.org.ai/Idea',
        $id: 'https://example.com/jtbds/task-prioritization',
        situation: 'I have too many tasks',
        motivation: 'find the most important one',
        outcome: 'make meaningful progress',
      }
      expect(isJTBD(invalid)).toBe(false)
    })

    it('should return false for objects missing required fields', async () => {
      const { isJTBD } = await import('../src/index.js')
      const missingSituation = {
        $type: 'https://schema.org.ai/JTBD',
        $id: 'https://example.com/jtbds/task-prioritization',
        motivation: 'find the most important one',
        outcome: 'make meaningful progress',
      }
      const missingMotivation = {
        $type: 'https://schema.org.ai/JTBD',
        $id: 'https://example.com/jtbds/task-prioritization',
        situation: 'I have too many tasks',
        outcome: 'make meaningful progress',
      }
      const missingOutcome = {
        $type: 'https://schema.org.ai/JTBD',
        $id: 'https://example.com/jtbds/task-prioritization',
        situation: 'I have too many tasks',
        motivation: 'find the most important one',
      }
      expect(isJTBD(missingSituation)).toBe(false)
      expect(isJTBD(missingMotivation)).toBe(false)
      expect(isJTBD(missingOutcome)).toBe(false)
    })

    it('should return false for null and undefined', async () => {
      const { isJTBD } = await import('../src/index.js')
      expect(isJTBD(null)).toBe(false)
      expect(isJTBD(undefined)).toBe(false)
    })

    it('should return false for primitive values', async () => {
      const { isJTBD } = await import('../src/index.js')
      expect(isJTBD('string')).toBe(false)
      expect(isJTBD(123)).toBe(false)
      expect(isJTBD(true)).toBe(false)
    })
  })

  describe('JTBD frequency values', () => {
    it('should support common frequency values', async () => {
      type JTBDFrequency = import('../src/index.js').JTBDFrequency
      const validFrequencies: JTBDFrequency[] = [
        'hourly',
        'daily',
        'weekly',
        'monthly',
        'quarterly',
        'yearly',
        'occasionally',
      ]
      expect(validFrequencies).toContain('daily')
      expect(validFrequencies).toContain('weekly')
    })
  })
})

// ============================================================================
// Integration: Idea -> Hypothesis -> JTBD Relationships (aip-kzbp)
// ============================================================================

describe('Integration: Idea -> Hypothesis -> JTBD relationships', () => {
  it('should allow Idea to reference multiple Hypotheses', async () => {
    type IdeaType = import('../src/index.js').IdeaType
    type HypothesisType = import('../src/index.js').HypothesisType

    // An Idea can have multiple hypotheses to validate
    type HasHypotheses = IdeaType extends { hypotheses?: HypothesisType[] } ? true : false
    const hasHypotheses: HasHypotheses = true
    expect(hasHypotheses).toBe(true)
  })

  it('should allow Hypothesis to reference back to Idea', async () => {
    type HypothesisType = import('../src/index.js').HypothesisType
    type IdeaType = import('../src/index.js').IdeaType

    // A Hypothesis can reference the Idea it validates
    type HasIdea = HypothesisType extends { idea?: IdeaType | string } ? true : false
    const hasIdea: HasIdea = true
    expect(hasIdea).toBe(true)
  })

  it('should allow JTBD to reference persona/ICP', async () => {
    type JTBDType = import('../src/index.js').JTBDType

    // A JTBD can be associated with a specific persona or ICP
    type HasPersona = 'persona' extends keyof JTBDType ? true : false
    const hasPersona: HasPersona = true
    expect(hasPersona).toBe(true)
  })

  it('should support validation flow from Idea through Hypothesis', async () => {
    // This tests the conceptual flow:
    // 1. Create Idea (status: raw)
    // 2. Generate Hypotheses from Idea
    // 3. Test Hypotheses, collect Evidence
    // 4. Update Idea status based on Hypothesis results

    const module = await import('../src/index.js')

    // All three types should be exportable
    expect(module).toHaveProperty('Idea')
    expect(module).toHaveProperty('Hypothesis')
    expect(module).toHaveProperty('JTBD')

    // Type guards should exist for runtime validation
    expect(module).toHaveProperty('isIdea')
    expect(module).toHaveProperty('isHypothesis')
    expect(module).toHaveProperty('isJTBD')
  })

  it('should support creating an Idea with Hypotheses and JTBD relationships', async () => {
    type IdeaType = import('../src/index.js').IdeaType
    type HypothesisType = import('../src/index.js').HypothesisType
    type JTBDType = import('../src/index.js').JTBDType

    // Create a complete validation workflow example
    const jtbd: JTBDType = {
      $type: 'https://schema.org.ai/JTBD',
      $id: 'https://example.com/jtbds/task-management',
      situation: 'I have multiple projects with competing deadlines',
      motivation: 'quickly determine what to work on next',
      outcome: 'meet all my deadlines without stress',
      functional: { description: 'Complete tasks on time', importance: 9 },
      emotional: { description: 'Feel confident about priorities', importance: 8 },
      social: { description: 'Be seen as reliable', importance: 7 },
      priority: 5,
      frequency: 'daily',
    }

    const hypothesis: HypothesisType = {
      $type: 'https://schema.org.ai/Hypothesis',
      $id: 'https://example.com/hypotheses/ai-prioritization',
      statement: 'Users will complete 30% more high-priority tasks with AI prioritization',
      metric: 'task_completion_rate',
      target: 0.3,
      status: 'testing',
      baseline: 0.0,
      evidence: [
        {
          type: 'user_study',
          value: 0.25,
          source: 'beta_test_cohort_1',
          collectedAt: new Date('2026-01-10'),
          confidence: 0.8,
        },
      ],
    }

    const idea: IdeaType = {
      $type: 'https://schema.org.ai/Idea',
      $id: 'https://example.com/ideas/ai-task-prioritizer',
      name: 'AI Task Prioritizer',
      pitch: 'Let AI analyze your tasks and suggest what to work on next',
      description:
        'An intelligent task management system that uses AI to analyze deadlines, dependencies, and importance to recommend the optimal task to work on.',
      status: 'refined',
      hypotheses: [hypothesis],
      tags: ['productivity', 'AI', 'task-management'],
    }

    expect(idea.name).toBe('AI Task Prioritizer')
    expect(idea.hypotheses).toHaveLength(1)
    expect(idea.status).toBe('refined')
  })
})
