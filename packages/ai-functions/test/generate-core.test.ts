/**
 * Tests for the core generate() primitive
 *
 * generate(type, prompt, opts?) is the foundation that all other functions use.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Mock for underlying AI calls
// ============================================================================

const mockAICall = vi.fn()

// Mock generate implementation
async function generate(
  type: string,
  prompt: string,
  options?: Record<string, unknown>
): Promise<unknown> {
  return mockAICall(type, prompt, options)
}

// ============================================================================
// generate(type, prompt, opts) signature tests
// ============================================================================

describe('generate(type, prompt, opts)', () => {
  beforeEach(() => {
    mockAICall.mockReset()
  })

  describe('type: json', () => {
    it('generates JSON without schema (AI infers structure)', async () => {
      mockAICall.mockResolvedValue({
        competitors: ['Competitor A', 'Competitor B'],
        marketSize: 1000000,
        trends: ['AI adoption', 'Cloud migration'],
      })

      const result = await generate('json', 'competitive analysis of Acme Corp')

      expect(mockAICall).toHaveBeenCalledWith('json', 'competitive analysis of Acme Corp', undefined)
      expect(result).toHaveProperty('competitors')
      expect(result).toHaveProperty('marketSize')
    })

    it('generates JSON with schema (typed, validated)', async () => {
      mockAICall.mockResolvedValue({
        name: 'Spaghetti Carbonara',
        servings: 4,
        ingredients: ['pasta', 'eggs', 'bacon'],
        steps: ['Boil pasta', 'Cook bacon', 'Mix eggs'],
      })

      const result = await generate('json', 'Italian pasta recipe', {
        schema: {
          name: 'Recipe name',
          servings: 'Number of servings (number)',
          ingredients: ['List of ingredients'],
          steps: ['Cooking steps'],
        },
      })

      expect(mockAICall).toHaveBeenCalledWith(
        'json',
        'Italian pasta recipe',
        expect.objectContaining({ schema: expect.any(Object) })
      )
      expect(result).toHaveProperty('name')
      expect(result).toHaveProperty('servings')
      expect(typeof (result as { servings: number }).servings).toBe('number')
    })
  })

  describe('type: text', () => {
    it('generates plain text', async () => {
      mockAICall.mockResolvedValue('This is the generated text content.')

      const result = await generate('text', 'Write a paragraph about AI')

      expect(mockAICall).toHaveBeenCalledWith('text', 'Write a paragraph about AI', undefined)
      expect(typeof result).toBe('string')
    })
  })

  describe('type: code', () => {
    it('generates code with language option', async () => {
      mockAICall.mockResolvedValue(`
function validateEmail(email: string): boolean {
  return /^[^@]+@[^@]+\\.[^@]+$/.test(email);
}
      `.trim())

      const result = await generate('code', 'email validation function', {
        language: 'typescript',
      })

      expect(mockAICall).toHaveBeenCalledWith(
        'code',
        'email validation function',
        expect.objectContaining({ language: 'typescript' })
      )
      expect(typeof result).toBe('string')
      expect(result).toContain('function')
    })

    it('generates code in different languages', async () => {
      mockAICall.mockResolvedValue('def validate_email(email):\n    return "@" in email')

      await generate('code', 'email validation', { language: 'python' })

      expect(mockAICall).toHaveBeenCalledWith(
        'code',
        'email validation',
        expect.objectContaining({ language: 'python' })
      )
    })
  })

  describe('type: markdown', () => {
    it('generates markdown content', async () => {
      mockAICall.mockResolvedValue('# README\n\n## Features\n\n- Feature 1\n- Feature 2')

      const result = await generate('markdown', 'README for a TypeScript library')

      expect(mockAICall).toHaveBeenCalledWith('markdown', 'README for a TypeScript library', undefined)
      expect(typeof result).toBe('string')
      expect(result).toContain('#')
    })
  })

  describe('type: yaml', () => {
    it('generates YAML content', async () => {
      mockAICall.mockResolvedValue(`
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
      `.trim())

      const result = await generate('yaml', 'kubernetes deployment for my-app')

      expect(mockAICall).toHaveBeenCalledWith('yaml', 'kubernetes deployment for my-app', undefined)
      expect(typeof result).toBe('string')
      expect(result).toContain('apiVersion')
    })
  })

  describe('type: list', () => {
    it('generates a list of items', async () => {
      mockAICall.mockResolvedValue(['Item 1', 'Item 2', 'Item 3'])

      const result = await generate('list', '5 startup ideas')

      expect(mockAICall).toHaveBeenCalledWith('list', '5 startup ideas', undefined)
      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('type: diagram', () => {
    it('generates diagram code', async () => {
      mockAICall.mockResolvedValue('graph TD\n  A[Start] --> B[Process]\n  B --> C[End]')

      const result = await generate('diagram', 'user flow for authentication', {
        format: 'mermaid',
      })

      expect(mockAICall).toHaveBeenCalledWith(
        'diagram',
        'user flow for authentication',
        expect.objectContaining({ format: 'mermaid' })
      )
      expect(typeof result).toBe('string')
    })
  })

  describe('type: slides', () => {
    it('generates presentation slides', async () => {
      mockAICall.mockResolvedValue('---\ntheme: default\n---\n\n# Title\n\nContent')

      const result = await generate('slides', 'quarterly review presentation', {
        format: 'slidev',
        slides: 10,
      })

      expect(mockAICall).toHaveBeenCalledWith(
        'slides',
        'quarterly review presentation',
        expect.objectContaining({ format: 'slidev', slides: 10 })
      )
    })
  })
})

// ============================================================================
// Tagged template support on generate
// ============================================================================

describe('generate as tagged template', () => {
  beforeEach(() => {
    mockAICall.mockReset()
  })

  // Note: This tests the concept - actual implementation would need the template wrapper
  it('should support tagged template syntax (conceptual)', async () => {
    mockAICall.mockResolvedValue({ analysis: 'Result' })

    // This would be: generate`analysis of ${company}`
    const company = 'Acme Corp'
    const prompt = `analysis of ${company}`

    const result = await generate('json', prompt)

    expect(result).toHaveProperty('analysis')
  })

  it('should convert objects to YAML in templates (conceptual)', async () => {
    mockAICall.mockResolvedValue('Generated content')

    const context = {
      brand: 'TechCo',
      audience: 'developers',
    }

    // This would be: generate`content for ${{ context }}`
    // The object would be converted to YAML
    const prompt = `content for\ncontext:\n  brand: TechCo\n  audience: developers`

    await generate('text', prompt)

    expect(mockAICall).toHaveBeenCalledWith('text', expect.stringContaining('brand: TechCo'), undefined)
  })
})

// ============================================================================
// Options parameter tests
// ============================================================================

describe('generate options', () => {
  beforeEach(() => {
    mockAICall.mockReset()
    mockAICall.mockResolvedValue('result')
  })

  it('passes model option', async () => {
    await generate('text', 'test', { model: 'claude-opus-4-5' })

    expect(mockAICall).toHaveBeenCalledWith(
      'text',
      'test',
      expect.objectContaining({ model: 'claude-opus-4-5' })
    )
  })

  it('passes temperature option', async () => {
    await generate('text', 'creative writing', { temperature: 0.9 })

    expect(mockAICall).toHaveBeenCalledWith(
      'text',
      'creative writing',
      expect.objectContaining({ temperature: 0.9 })
    )
  })

  it('passes maxTokens option', async () => {
    await generate('text', 'long article', { maxTokens: 4000 })

    expect(mockAICall).toHaveBeenCalledWith(
      'text',
      'long article',
      expect.objectContaining({ maxTokens: 4000 })
    )
  })

  it('passes thinking option', async () => {
    await generate('json', 'complex analysis', { thinking: 'high' })

    expect(mockAICall).toHaveBeenCalledWith(
      'json',
      'complex analysis',
      expect.objectContaining({ thinking: 'high' })
    )
  })

  it('passes thinking as number (token budget)', async () => {
    await generate('json', 'complex analysis', { thinking: 10000 })

    expect(mockAICall).toHaveBeenCalledWith(
      'json',
      'complex analysis',
      expect.objectContaining({ thinking: 10000 })
    )
  })
})

// ============================================================================
// All convenience functions use generate
// ============================================================================

describe('convenience functions map to generate', () => {
  it('documents the mapping', () => {
    // This test documents the expected mappings
    const mappings = {
      'ai(prompt)': "generate('text', prompt)",
      'write(prompt)': "generate('text', prompt)",
      'code(prompt)': "generate('code', prompt)",
      'list(prompt)': "generate('list', prompt)",
      'lists(prompt)': "generate('lists', prompt)",
      'extract(prompt)': "generate('extract', prompt)",
      'summarize(prompt)': "generate('summary', prompt)",
      'diagram(prompt)': "generate('diagram', prompt)",
      'slides(prompt)': "generate('slides', prompt)",
      'is(prompt)': "generate('boolean', prompt)",
    }

    expect(Object.keys(mappings)).toHaveLength(10)
  })
})
