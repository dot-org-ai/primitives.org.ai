/**
 * Tests for function type inference from name + args
 *
 * The ai.* magic proxy infers function type based on:
 * 1. Function name (e.g., fizzBuzz → Code, storyBrand → Generative)
 * 2. Argument structure (e.g., { max: 100 } → Code parameters)
 * 3. Argument values (e.g., { amount: 50000 } → Human approval needed)
 *
 * Function Types:
 * - Generative: Generate content (text, json, lists, images)
 * - Code: Generate and execute code
 * - Agentic: Multi-step tasks with tools
 * - Human: Requires human input or approval
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
// Type definitions
// ============================================================================

type FunctionType = 'generative' | 'code' | 'agentic' | 'human'

interface InferredFunction {
  type: FunctionType
  name: string
  args: unknown
  execute: () => Promise<unknown>
}

// ============================================================================
// Mock type inference logic
// ============================================================================

/**
 * Infer function type from name patterns
 */
function inferTypeFromName(name: string): FunctionType | null {
  // Code patterns - computing, algorithms, transformations
  const codePatterns = [
    /^(fizz|buzz|calculate|compute|sort|filter|map|reduce|transform)/i,
    /^(validate|parse|format|convert|encode|decode|hash|compress)/i,
    /^(find|search|match|replace|split|join|merge)/i,
    /(algorithm|function|method|handler|processor)$/i,
  ]

  // Agentic patterns - tasks, workflows, automation
  const agenticPatterns = [
    /^(launch|deploy|publish|schedule|automate)/i,
    /^(research|investigate|analyze|audit|monitor)/i,
    /^(create|build|setup|configure|integrate)/i,
    /(workflow|pipeline|process|task|job)$/i,
  ]

  // Human patterns - approval, review, decisions
  const humanPatterns = [
    /^(approve|reject|review|verify|confirm)/i,
    /^(decide|choose|select|pick)/i,
    /(approval|review|confirmation)$/i,
  ]

  // Check patterns in order of specificity
  for (const pattern of humanPatterns) {
    if (pattern.test(name)) return 'human'
  }
  for (const pattern of agenticPatterns) {
    if (pattern.test(name)) return 'agentic'
  }
  for (const pattern of codePatterns) {
    if (pattern.test(name)) return 'code'
  }

  // Default to generative
  return 'generative'
}

/**
 * Infer function type from argument structure
 */
function inferTypeFromArgs(args: unknown): FunctionType | null {
  if (typeof args !== 'object' || args === null) return null

  const argObj = args as Record<string, unknown>
  const keys = Object.keys(argObj)

  // Code indicators - numeric parameters, input/output pairs
  const codeIndicators = ['max', 'min', 'count', 'input', 'output', 'format', 'precision']
  if (codeIndicators.some(k => keys.includes(k))) {
    return 'code'
  }

  // Agentic indicators - URLs, targets, configurations
  const agenticIndicators = ['url', 'target', 'destination', 'webhook', 'schedule']
  if (agenticIndicators.some(k => keys.includes(k))) {
    return 'agentic'
  }

  // Human indicators - requires explicit approval flags
  const humanIndicators = ['requiresApproval', 'needsReview', 'manualStep']
  if (humanIndicators.some(k => keys.includes(k))) {
    return 'human'
  }

  return null
}

/**
 * Infer if human approval needed based on values (subjective judgment)
 */
function requiresHumanApproval(name: string, args: unknown): boolean {
  if (typeof args !== 'object' || args === null) return false

  const argObj = args as Record<string, unknown>

  // High-value financial transactions
  if ('amount' in argObj && typeof argObj.amount === 'number') {
    if (argObj.amount > 10000) return true
  }

  // Sensitive operations
  if ('action' in argObj) {
    const sensitiveActions = ['delete', 'terminate', 'cancel', 'refund', 'transfer']
    if (sensitiveActions.includes(String(argObj.action).toLowerCase())) {
      return true
    }
  }

  // Large scale operations
  if ('count' in argObj && typeof argObj.count === 'number') {
    if (argObj.count > 1000) return true
  }

  // External communications
  if (name.toLowerCase().includes('email') || name.toLowerCase().includes('notify')) {
    if ('recipients' in argObj && Array.isArray(argObj.recipients)) {
      if (argObj.recipients.length > 100) return true
    }
  }

  return false
}

/**
 * Full type inference combining name, args, and values
 */
function inferFunctionType(name: string, args: unknown): FunctionType {
  // First check if human approval is needed based on values
  if (requiresHumanApproval(name, args)) {
    return 'human'
  }

  // Then check args structure
  const argsType = inferTypeFromArgs(args)
  if (argsType) return argsType

  // Finally fall back to name inference
  return inferTypeFromName(name) || 'generative'
}

// ============================================================================
// Type inference from name tests
// ============================================================================

describe('type inference from function name', () => {
  describe('Code function patterns', () => {
    it('infers code type from algorithm names', () => {
      expect(inferTypeFromName('fizzBuzz')).toBe('code')
      expect(inferTypeFromName('calculateSum')).toBe('code')
      expect(inferTypeFromName('computeHash')).toBe('code')
      expect(inferTypeFromName('sortArray')).toBe('code')
    })

    it('infers code type from transformation names', () => {
      expect(inferTypeFromName('validateEmail')).toBe('code')
      expect(inferTypeFromName('parseJSON')).toBe('code')
      expect(inferTypeFromName('formatDate')).toBe('code')
      expect(inferTypeFromName('convertCurrency')).toBe('code')
    })

    it('infers code type from data operation names', () => {
      expect(inferTypeFromName('findUser')).toBe('code')
      expect(inferTypeFromName('searchRecords')).toBe('code')
      expect(inferTypeFromName('filterProducts')).toBe('code')
      expect(inferTypeFromName('mergeArrays')).toBe('code')
    })
  })

  describe('Generative function patterns', () => {
    it('infers generative type from content names', () => {
      expect(inferTypeFromName('storyBrand')).toBe('generative')
      expect(inferTypeFromName('blogPost')).toBe('generative')
      expect(inferTypeFromName('productDescription')).toBe('generative')
      expect(inferTypeFromName('marketingCopy')).toBe('generative')
    })

    it('defaults unknown names to generative', () => {
      expect(inferTypeFromName('foo')).toBe('generative')
      expect(inferTypeFromName('customThing')).toBe('generative')
      expect(inferTypeFromName('randomName')).toBe('generative')
    })
  })

  describe('Agentic function patterns', () => {
    it('infers agentic type from automation names', () => {
      expect(inferTypeFromName('launchProduct')).toBe('agentic')
      expect(inferTypeFromName('deployApplication')).toBe('agentic')
      expect(inferTypeFromName('publishArticle')).toBe('agentic')
      expect(inferTypeFromName('scheduleTask')).toBe('agentic')
    })

    it('infers agentic type from research names', () => {
      expect(inferTypeFromName('researchMarket')).toBe('agentic')
      expect(inferTypeFromName('investigateIssue')).toBe('agentic')
      expect(inferTypeFromName('analyzeCompetitors')).toBe('agentic')
    })

    it('infers agentic type from workflow suffixes', () => {
      expect(inferTypeFromName('onboardingWorkflow')).toBe('agentic')
      expect(inferTypeFromName('deploymentPipeline')).toBe('agentic')
      expect(inferTypeFromName('dataProcess')).toBe('agentic')
    })
  })

  describe('Human function patterns', () => {
    it('infers human type from approval names', () => {
      expect(inferTypeFromName('approveRefund')).toBe('human')
      expect(inferTypeFromName('rejectApplication')).toBe('human')
      expect(inferTypeFromName('reviewCode')).toBe('human')
    })

    it('infers human type from decision names', () => {
      expect(inferTypeFromName('decideOutcome')).toBe('human')
      expect(inferTypeFromName('chooseOption')).toBe('human')
      expect(inferTypeFromName('selectWinner')).toBe('human')
    })
  })
})

// ============================================================================
// Type inference from args tests
// ============================================================================

describe('type inference from argument structure', () => {
  describe('Code argument patterns', () => {
    it('infers code from numeric parameters', () => {
      expect(inferTypeFromArgs({ max: 100 })).toBe('code')
      expect(inferTypeFromArgs({ min: 0, max: 100 })).toBe('code')
      expect(inferTypeFromArgs({ count: 10 })).toBe('code')
    })

    it('infers code from input/output pairs', () => {
      expect(inferTypeFromArgs({ input: 'data', format: 'json' })).toBe('code')
      expect(inferTypeFromArgs({ output: 'file.txt' })).toBe('code')
    })
  })

  describe('Agentic argument patterns', () => {
    it('infers agentic from URL parameters', () => {
      expect(inferTypeFromArgs({ url: 'https://example.com' })).toBe('agentic')
      expect(inferTypeFromArgs({ target: 'https://api.example.com' })).toBe('agentic')
    })

    it('infers agentic from webhook/schedule parameters', () => {
      expect(inferTypeFromArgs({ webhook: 'https://hooks.example.com' })).toBe('agentic')
      expect(inferTypeFromArgs({ schedule: '0 9 * * *' })).toBe('agentic')
    })
  })

  describe('Human argument patterns', () => {
    it('infers human from explicit approval flags', () => {
      expect(inferTypeFromArgs({ requiresApproval: true })).toBe('human')
      expect(inferTypeFromArgs({ needsReview: true })).toBe('human')
      expect(inferTypeFromArgs({ manualStep: true })).toBe('human')
    })
  })

  describe('No inference from args', () => {
    it('returns null for unrecognized arg patterns', () => {
      expect(inferTypeFromArgs({ name: 'John' })).toBeNull()
      expect(inferTypeFromArgs({ text: 'Hello' })).toBeNull()
      expect(inferTypeFromArgs({})).toBeNull()
    })

    it('returns null for non-object args', () => {
      expect(inferTypeFromArgs('string')).toBeNull()
      expect(inferTypeFromArgs(123)).toBeNull()
      expect(inferTypeFromArgs(null)).toBeNull()
    })
  })
})

// ============================================================================
// Human approval from values (subjective judgment)
// ============================================================================

describe('human approval from values (subjective judgment)', () => {
  describe('high-value transactions', () => {
    it('requires human approval for large amounts', () => {
      expect(requiresHumanApproval('processRefund', { amount: 50000 })).toBe(true)
      expect(requiresHumanApproval('processRefund', { amount: 12.99 })).toBe(false)
    })

    it('threshold is $10,000', () => {
      expect(requiresHumanApproval('transfer', { amount: 9999 })).toBe(false)
      expect(requiresHumanApproval('transfer', { amount: 10001 })).toBe(true)
    })
  })

  describe('sensitive actions', () => {
    it('requires approval for destructive actions', () => {
      expect(requiresHumanApproval('performAction', { action: 'delete' })).toBe(true)
      expect(requiresHumanApproval('performAction', { action: 'terminate' })).toBe(true)
      expect(requiresHumanApproval('performAction', { action: 'cancel' })).toBe(true)
    })

    it('does not require approval for safe actions', () => {
      expect(requiresHumanApproval('performAction', { action: 'read' })).toBe(false)
      expect(requiresHumanApproval('performAction', { action: 'list' })).toBe(false)
    })
  })

  describe('large scale operations', () => {
    it('requires approval for operations affecting many items', () => {
      expect(requiresHumanApproval('bulkOperation', { count: 5000 })).toBe(true)
      expect(requiresHumanApproval('bulkOperation', { count: 100 })).toBe(false)
    })
  })

  describe('mass communications', () => {
    it('requires approval for mass emails', () => {
      const manyRecipients = Array(500).fill('user@example.com')
      expect(requiresHumanApproval('sendEmail', { recipients: manyRecipients })).toBe(true)

      const fewRecipients = ['user1@example.com', 'user2@example.com']
      expect(requiresHumanApproval('sendEmail', { recipients: fewRecipients })).toBe(false)
    })
  })
})

// ============================================================================
// Combined inference tests
// ============================================================================

describe('combined function type inference', () => {
  it('prioritizes human approval based on values', () => {
    // Even though name suggests code, high amount triggers human
    expect(inferFunctionType('processRefund', { amount: 50000 })).toBe('human')
  })

  it('uses args when name is ambiguous', () => {
    expect(inferFunctionType('handleData', { max: 100 })).toBe('code')
    expect(inferFunctionType('handleData', { url: 'https://api.com' })).toBe('agentic')
  })

  it('falls back to name when args are generic', () => {
    expect(inferFunctionType('fizzBuzz', { n: 100 })).toBe('code')
    expect(inferFunctionType('storyBrand', { hero: 'developers' })).toBe('generative')
  })

  describe('README examples', () => {
    it('ai.fizzBuzz({ max: 100 }) → code', () => {
      expect(inferFunctionType('fizzBuzz', { max: 100 })).toBe('code')
    })

    it('ai.storyBrand({ hero: "developers" }) → generative', () => {
      expect(inferFunctionType('storyBrand', { hero: 'developers' })).toBe('generative')
    })

    it('ai.launchProductHunt({ product }) → agentic', () => {
      expect(inferFunctionType('launchProductHunt', { product: {} })).toBe('agentic')
    })

    it('ai.processRefund({ amount: 12.99 }) → generative (small amount, automated)', () => {
      // Small refund can be automated - falls through to generative
      // The key insight is it's NOT human (which would be triggered by high amounts)
      expect(inferFunctionType('processRefund', { amount: 12.99 })).toBe('generative')
    })

    it('ai.processRefund({ amount: 50000 }) → human (large amount)', () => {
      // Large refund needs human approval
      expect(inferFunctionType('processRefund', { amount: 50000 })).toBe('human')
    })
  })
})

// ============================================================================
// Magic proxy behavior tests
// ============================================================================

describe('magic proxy ai.* behavior', () => {
  // Mock the magic proxy
  const mockDefine = vi.fn()
  const mockExecute = vi.fn()

  function createMockAiProxy() {
    return new Proxy(
      {},
      {
        get(_target, prop) {
          if (typeof prop !== 'string') return undefined

          // Return a function that infers type and executes
          return (args: unknown) => {
            const type = inferFunctionType(prop, args)
            mockDefine(prop, type, args)
            return mockExecute(prop, type, args)
          }
        },
      }
    )
  }

  beforeEach(() => {
    mockDefine.mockReset()
    mockExecute.mockReset()
  })

  it('infers type when accessing property', async () => {
    const ai = createMockAiProxy() as Record<string, (args: unknown) => Promise<unknown>>

    mockExecute.mockResolvedValue('1, 2, Fizz, 4, Buzz...')

    await ai.fizzBuzz({ max: 100 })

    expect(mockDefine).toHaveBeenCalledWith('fizzBuzz', 'code', { max: 100 })
  })

  it('creates new function for each call', async () => {
    const ai = createMockAiProxy() as Record<string, (args: unknown) => Promise<unknown>>

    mockExecute.mockResolvedValue('result')

    await ai.functionA({ a: 1 })
    await ai.functionB({ b: 2 })

    expect(mockDefine).toHaveBeenCalledTimes(2)
    expect(mockDefine).toHaveBeenNthCalledWith(1, 'functionA', expect.any(String), { a: 1 })
    expect(mockDefine).toHaveBeenNthCalledWith(2, 'functionB', expect.any(String), { b: 2 })
  })

  it('same function name can have different types based on args', async () => {
    const ai = createMockAiProxy() as Record<string, (args: unknown) => Promise<unknown>>

    mockExecute.mockResolvedValue('result')

    // Same name, different args → different types
    await ai.process({ max: 100 }) // code (due to max)
    await ai.process({ url: 'https://api.com' }) // agentic (due to url)
    await ai.process({ amount: 50000 }) // human (due to high amount)

    expect(mockDefine).toHaveBeenNthCalledWith(1, 'process', 'code', { max: 100 })
    expect(mockDefine).toHaveBeenNthCalledWith(2, 'process', 'agentic', { url: 'https://api.com' })
    expect(mockDefine).toHaveBeenNthCalledWith(3, 'process', 'human', { amount: 50000 })
  })
})

// ============================================================================
// Function type execution behavior
// ============================================================================

describe('function type execution behavior', () => {
  it('documents expected behavior per type', () => {
    const typeBehaviors = {
      generative: {
        description: 'Generate content',
        examples: ['ai.storyBrand()', 'ai.blogPost()', 'ai.productDescription()'],
        returns: 'Generated content (text, JSON, etc.)',
      },
      code: {
        description: 'Generate and execute code',
        examples: ['ai.fizzBuzz()', 'ai.validateEmail()', 'ai.sortArray()'],
        returns: 'Execution result',
        integration: 'Uses ai-sandbox evaluate()',
      },
      agentic: {
        description: 'Multi-step tasks with tools',
        examples: ['ai.launchProductHunt()', 'ai.researchCompetitors()'],
        returns: 'Task completion result',
        features: ['Tool use', 'Multi-step execution', 'External integrations'],
      },
      human: {
        description: 'Requires human input or approval',
        examples: ['ai.approveRefund()', 'ai.processRefund({ amount: 50000 })'],
        returns: 'Result after human approval',
        flow: ['Generate proposal', 'Wait for approval', 'Execute if approved'],
      },
    }

    expect(Object.keys(typeBehaviors)).toHaveLength(4)
    expect(typeBehaviors.code.integration).toBe('Uses ai-sandbox evaluate()')
  })
})
