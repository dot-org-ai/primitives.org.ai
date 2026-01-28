/**
 * @org.ai/types - Business Model Framework Types TDD Tests
 *
 * Tests for business model framework types:
 * - LeanCanvas: 9-box business model canvas
 * - StoryBrand: 7-part narrative framework
 * - Founder: Founding team member with roles
 *
 * These tests define the expected interfaces for startup business modeling.
 */

import { describe, it, expect } from 'vitest'

// ============================================================================
// LeanCanvas Type Tests (9-box model)
// ============================================================================

describe('LeanCanvas type', () => {
  describe('type export', () => {
    it('should export LeanCanvas type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('LeanCanvas')
    })

    it('should export LeanCanvasMarker symbol', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('LeanCanvasMarker')
    })
  })

  describe('9-box structure', () => {
    it('should have problem field', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { problem: string[] }
      }
      expect(module.LeanCanvas).toBeDefined()
    })

    it('should have solution field', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { solution: string[] }
      }
      expect(module.LeanCanvas).toBeDefined()
    })

    it('should have uniqueValueProposition field', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { uniqueValueProposition: string }
      }
      expect(module.LeanCanvas).toBeDefined()
    })

    it('should have unfairAdvantage field', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { unfairAdvantage: string }
      }
      expect(module.LeanCanvas).toBeDefined()
    })

    it('should have customerSegments field', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { customerSegments: string[] }
      }
      expect(module.LeanCanvas).toBeDefined()
    })

    it('should have keyMetrics field', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { keyMetrics: string[] }
      }
      expect(module.LeanCanvas).toBeDefined()
    })

    it('should have channels field', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { channels: string[] }
      }
      expect(module.LeanCanvas).toBeDefined()
    })

    it('should have costStructure field', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { costStructure: string[] }
      }
      expect(module.LeanCanvas).toBeDefined()
    })

    it('should have revenueStreams field', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { revenueStreams: string[] }
      }
      expect(module.LeanCanvas).toBeDefined()
    })
  })

  describe('metadata fields', () => {
    it('should have $id field', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { $id: string }
      }
      expect(module.LeanCanvas).toBeDefined()
    })

    it('should have $type field', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { $type: string }
      }
      expect(module.LeanCanvas).toBeDefined()
    })

    it('should have version field for iterations', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { version?: number }
      }
      expect(module.LeanCanvas).toBeDefined()
    })

    it('should have startupId field for relationship', async () => {
      const module = (await import('../src/index.js')) as {
        LeanCanvas: { startupId?: string }
      }
      expect(module.LeanCanvas).toBeDefined()
    })
  })

  describe('LEAN_CANVAS_TYPE constant', () => {
    it('should export LEAN_CANVAS_TYPE constant', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('LEAN_CANVAS_TYPE')
      expect(module.LEAN_CANVAS_TYPE).toBe('https://schema.org.ai/LeanCanvas')
    })
  })
})

// ============================================================================
// StoryBrand Type Tests (7-part narrative)
// ============================================================================

describe('StoryBrand type', () => {
  describe('type export', () => {
    it('should export StoryBrand type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('StoryBrand')
    })

    it('should export StoryBrandMarker symbol', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('StoryBrandMarker')
    })
  })

  describe('7-part narrative structure', () => {
    it('should have character field', async () => {
      const module = (await import('../src/index.js')) as {
        StoryBrand: { character: { wants: string; identity: string } }
      }
      expect(module.StoryBrand).toBeDefined()
    })

    it('should have problem field with external/internal/philosophical', async () => {
      const module = (await import('../src/index.js')) as {
        StoryBrand: {
          problem: {
            external: string
            internal: string
            philosophical: string
          }
        }
      }
      expect(module.StoryBrand).toBeDefined()
    })

    it('should have guide field with empathy and authority', async () => {
      const module = (await import('../src/index.js')) as {
        StoryBrand: {
          guide: {
            empathy: string
            authority: string
          }
        }
      }
      expect(module.StoryBrand).toBeDefined()
    })

    it('should have plan field as steps array', async () => {
      const module = (await import('../src/index.js')) as {
        StoryBrand: { plan: string[] }
      }
      expect(module.StoryBrand).toBeDefined()
    })

    it('should have callToAction field', async () => {
      const module = (await import('../src/index.js')) as {
        StoryBrand: { callToAction: { direct: string; transitional?: string } }
      }
      expect(module.StoryBrand).toBeDefined()
    })

    it('should have failure field (stakes)', async () => {
      const module = (await import('../src/index.js')) as {
        StoryBrand: { failure: string[] }
      }
      expect(module.StoryBrand).toBeDefined()
    })

    it('should have success field (transformation)', async () => {
      const module = (await import('../src/index.js')) as {
        StoryBrand: { success: string[] }
      }
      expect(module.StoryBrand).toBeDefined()
    })
  })

  describe('metadata fields', () => {
    it('should have $id field', async () => {
      const module = (await import('../src/index.js')) as {
        StoryBrand: { $id: string }
      }
      expect(module.StoryBrand).toBeDefined()
    })

    it('should have $type field', async () => {
      const module = (await import('../src/index.js')) as {
        StoryBrand: { $type: string }
      }
      expect(module.StoryBrand).toBeDefined()
    })

    it('should have startupId field for relationship', async () => {
      const module = (await import('../src/index.js')) as {
        StoryBrand: { startupId?: string }
      }
      expect(module.StoryBrand).toBeDefined()
    })

    it('should have icpId field for ICP relationship', async () => {
      const module = (await import('../src/index.js')) as {
        StoryBrand: { icpId?: string }
      }
      expect(module.StoryBrand).toBeDefined()
    })
  })

  describe('STORY_BRAND_TYPE constant', () => {
    it('should export STORY_BRAND_TYPE constant', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('STORY_BRAND_TYPE')
      expect(module.STORY_BRAND_TYPE).toBe('https://schema.org.ai/StoryBrand')
    })
  })
})

// ============================================================================
// Founder Type Tests
// ============================================================================

describe('Founder type', () => {
  describe('type export', () => {
    it('should export Founder type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('Founder')
    })

    it('should export FounderMarker symbol', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('FounderMarker')
    })

    it('should export FounderRole type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('FounderRole')
    })
  })

  describe('identity fields', () => {
    it('should have name field', async () => {
      const module = (await import('../src/index.js')) as {
        Founder: { name: string }
      }
      expect(module.Founder).toBeDefined()
    })

    it('should have email field', async () => {
      const module = (await import('../src/index.js')) as {
        Founder: { email?: string }
      }
      expect(module.Founder).toBeDefined()
    })

    it('should have role field', async () => {
      const module = (await import('../src/index.js')) as {
        Founder: { role: string }
      }
      expect(module.Founder).toBeDefined()
    })
  })

  describe('capability fields', () => {
    it('should have skills field as array', async () => {
      const module = (await import('../src/index.js')) as {
        Founder: { skills: string[] }
      }
      expect(module.Founder).toBeDefined()
    })

    it('should have expertise field as array', async () => {
      const module = (await import('../src/index.js')) as {
        Founder: { expertise?: string[] }
      }
      expect(module.Founder).toBeDefined()
    })
  })

  describe('metadata fields', () => {
    it('should have $id field', async () => {
      const module = (await import('../src/index.js')) as {
        Founder: { $id: string }
      }
      expect(module.Founder).toBeDefined()
    })

    it('should have $type field', async () => {
      const module = (await import('../src/index.js')) as {
        Founder: { $type: string }
      }
      expect(module.Founder).toBeDefined()
    })

    it('should have startupIds field for many-to-many relationship', async () => {
      const module = (await import('../src/index.js')) as {
        Founder: { startupIds?: string[] }
      }
      expect(module.Founder).toBeDefined()
    })
  })

  describe('FounderRole enum values', () => {
    it('should include CEO role', async () => {
      const module = (await import('../src/index.js')) as {
        FounderRoles: readonly string[]
      }
      expect(module.FounderRoles).toContain('ceo')
    })

    it('should include CTO role', async () => {
      const module = (await import('../src/index.js')) as {
        FounderRoles: readonly string[]
      }
      expect(module.FounderRoles).toContain('cto')
    })

    it('should include CPO role', async () => {
      const module = (await import('../src/index.js')) as {
        FounderRoles: readonly string[]
      }
      expect(module.FounderRoles).toContain('cpo')
    })

    it('should include COO role', async () => {
      const module = (await import('../src/index.js')) as {
        FounderRoles: readonly string[]
      }
      expect(module.FounderRoles).toContain('coo')
    })

    it('should include CFO role', async () => {
      const module = (await import('../src/index.js')) as {
        FounderRoles: readonly string[]
      }
      expect(module.FounderRoles).toContain('cfo')
    })
  })

  describe('FOUNDER_TYPE constant', () => {
    it('should export FOUNDER_TYPE constant', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('FOUNDER_TYPE')
      expect(module.FOUNDER_TYPE).toBe('https://schema.org.ai/Founder')
    })
  })
})

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Business model type guards', () => {
  it('should export isLeanCanvas type guard', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('isLeanCanvas')
    expect(typeof module.isLeanCanvas).toBe('function')
  })

  it('should export isStoryBrand type guard', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('isStoryBrand')
    expect(typeof module.isStoryBrand).toBe('function')
  })

  it('should export isFounder type guard', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('isFounder')
    expect(typeof module.isFounder).toBe('function')
  })
})
