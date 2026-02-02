/**
 * Budget-Constrained Generation Example
 *
 * This example demonstrates controlling costs and monitoring token usage.
 * It shows how to:
 * - Set and enforce budget limits
 * - Track costs by model and request
 * - Handle budget alerts
 * - Use cost-effective strategies
 *
 * @example
 * ```bash
 * ANTHROPIC_API_KEY=sk-... npx tsx examples/09-budget-constrained.ts
 * ```
 */

import {
  ai,
  write,
  list,
  configure,
  withBudget,
  BudgetTracker,
  BudgetExceededError,
  TokenCounter,
  createRequestContext,
  FallbackChain,
} from '../src/index.js'

// ============================================================================
// Types
// ============================================================================

interface GenerationTask {
  id: string
  prompt: string
  priority: 'high' | 'medium' | 'low'
  maxTokens?: number
  requiredModel?: string
}

interface CostReport {
  totalCost: number
  costByModel: Record<string, number>
  tokensByModel: Record<string, { input: number; output: number }>
  requestCount: number
  avgCostPerRequest: number
  budgetUtilization: number
}

// ============================================================================
// Budget Management
// ============================================================================

class BudgetAwareGenerator {
  private tracker: BudgetTracker
  private maxBudget: number
  private alertsReceived: string[] = []
  private requestHistory: { id: string; cost: number; tokens: number }[] = []

  constructor(maxBudget: number) {
    this.maxBudget = maxBudget
    this.tracker = new BudgetTracker({
      maxCost: maxBudget,
      maxTokens: 1000000,
      alertThresholds: [0.25, 0.5, 0.75, 0.9, 1.0],
      onAlert: (alert) => {
        this.alertsReceived.push(
          `${(alert.threshold * 100).toFixed(0)}% budget used ($${alert.currentUsage.toFixed(4)})`
        )
        console.log(`  [ALERT] Budget ${(alert.threshold * 100).toFixed(0)}% consumed`)
      },
    })
  }

  /**
   * Check if we can afford a generation
   */
  canAfford(estimatedTokens: number, model: string = 'sonnet'): boolean {
    try {
      this.tracker.checkBudget({ estimatedTokens, model })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get remaining budget
   */
  getRemainingBudget(): { cost: number; tokens: number } {
    return this.tracker.getRemainingBudget()
  }

  /**
   * Generate with budget tracking
   */
  async generate(task: GenerationTask): Promise<string | null> {
    const estimatedInputTokens = Math.ceil(task.prompt.length / 4)
    const estimatedOutputTokens = task.maxTokens || 500
    const estimatedTotal = estimatedInputTokens + estimatedOutputTokens

    // Check budget before generating
    if (!this.canAfford(estimatedTotal, task.requiredModel || 'sonnet')) {
      console.log(`  [SKIP] Task ${task.id}: Insufficient budget`)
      return null
    }

    console.log(`  [GENERATING] Task ${task.id} (est. ${estimatedTotal} tokens)`)

    try {
      const result = await write`${task.prompt}`

      // Record actual usage (estimated for this demo)
      const actualInputTokens = estimatedInputTokens
      const actualOutputTokens = Math.ceil(result.length / 4)

      this.tracker.recordUsage({
        inputTokens: actualInputTokens,
        outputTokens: actualOutputTokens,
        model: task.requiredModel || 'claude-sonnet-4-20250514',
      })

      // Track request
      const cost = this.estimateCost(actualInputTokens, actualOutputTokens, task.requiredModel)
      this.requestHistory.push({
        id: task.id,
        cost,
        tokens: actualInputTokens + actualOutputTokens,
      })

      return result
    } catch (error) {
      if (error instanceof BudgetExceededError) {
        console.log(`  [BUDGET EXCEEDED] Task ${task.id}`)
        return null
      }
      throw error
    }
  }

  /**
   * Estimate cost for tokens
   */
  private estimateCost(input: number, output: number, model?: string): number {
    // Approximate pricing per million tokens
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-sonnet-4-20250514': { input: 3, output: 15 },
      'claude-3-5-haiku-latest': { input: 0.25, output: 1.25 },
      'gpt-4o': { input: 2.5, output: 10 },
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
    }

    const p = pricing[model || 'claude-sonnet-4-20250514'] || pricing['claude-sonnet-4-20250514']
    return (input * p.input + output * p.output) / 1000000
  }

  /**
   * Generate cost report
   */
  getReport(): CostReport {
    const totalCost = this.tracker.getTotalCost()
    const costByModel = this.tracker.getCostByModel()

    return {
      totalCost,
      costByModel,
      tokensByModel: {}, // Would be tracked in full implementation
      requestCount: this.requestHistory.length,
      avgCostPerRequest:
        this.requestHistory.length > 0 ? totalCost / this.requestHistory.length : 0,
      budgetUtilization: (totalCost / this.maxBudget) * 100,
    }
  }

  /**
   * Get alerts received
   */
  getAlerts(): string[] {
    return [...this.alertsReceived]
  }
}

// ============================================================================
// Cost Optimization Strategies
// ============================================================================

/**
 * Strategy 1: Use cheaper models for simple tasks
 */
async function useModelTiering(
  prompt: string,
  complexity: 'simple' | 'medium' | 'complex'
): Promise<string> {
  const modelMap = {
    simple: 'claude-3-5-haiku-latest', // Cheapest
    medium: 'gpt-4o-mini', // Mid-tier
    complex: 'claude-sonnet-4-20250514', // Best quality
  }

  configure({ model: modelMap[complexity] })
  return write`${prompt}`
}

/**
 * Strategy 2: Fallback chain for cost optimization
 */
async function useFallbackForCost(prompt: string): Promise<string> {
  const chain = new FallbackChain([
    {
      name: 'haiku',
      execute: async () => {
        configure({ model: 'claude-3-5-haiku-latest' })
        return write`${prompt}`
      },
    },
    {
      name: 'sonnet',
      execute: async () => {
        configure({ model: 'sonnet' })
        return write`${prompt}`
      },
    },
  ])

  return chain.execute()
}

/**
 * Strategy 3: Prompt compression
 */
function compressPrompt(prompt: string): string {
  // Remove extra whitespace
  let compressed = prompt.replace(/\s+/g, ' ').trim()

  // Remove filler words (simplified)
  const fillers = ['please', 'kindly', 'just', 'simply', 'basically']
  for (const filler of fillers) {
    compressed = compressed.replace(new RegExp(`\\b${filler}\\b`, 'gi'), '')
  }

  return compressed.replace(/\s+/g, ' ').trim()
}

/**
 * Strategy 4: Cache similar requests
 */
class CostAwareCache {
  private cache = new Map<string, { result: string; savedCost: number }>()

  /**
   * Get cached result or null
   */
  get(prompt: string): { result: string; savedCost: number } | null {
    const key = this.hashPrompt(prompt)
    return this.cache.get(key) || null
  }

  /**
   * Cache a result
   */
  set(prompt: string, result: string, cost: number): void {
    const key = this.hashPrompt(prompt)
    this.cache.set(key, { result, savedCost: cost })
  }

  /**
   * Get total savings
   */
  getTotalSavings(): number {
    let total = 0
    for (const entry of this.cache.values()) {
      total += entry.savedCost
    }
    return total
  }

  private hashPrompt(prompt: string): string {
    // Simple hash for demo
    return prompt.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 100)
  }
}

// ============================================================================
// withBudget Usage
// ============================================================================

async function demonstrateWithBudget(): Promise<void> {
  console.log('\n--- Using withBudget() wrapper ---\n')

  try {
    const result = await withBudget(
      {
        maxCost: 0.01, // $0.01 budget
        maxTokens: 1000,
        userId: 'user-123',
        tenantId: 'tenant-456',
      },
      async (tracker, ctx) => {
        console.log(`  Request ID: ${ctx?.requestId}`)
        console.log(`  User: ${ctx?.userId}`)
        console.log(`  Budget: $0.01 / 1000 tokens`)

        // Track usage
        tracker.recordUsage({ inputTokens: 100, outputTokens: 50 })

        const remaining = tracker.getRemainingBudget()
        console.log(`  Remaining: $${remaining.cost.toFixed(4)} / ${remaining.tokens} tokens`)

        // Generate something
        const response = await write`Say hello briefly`
        tracker.recordUsage({ inputTokens: 50, outputTokens: 30 })

        return response
      }
    )

    console.log(`  Result: "${result.substring(0, 50)}..."`)
  } catch (error) {
    if (error instanceof BudgetExceededError) {
      console.log('  Budget exceeded!')
    } else {
      throw error
    }
  }
}

// ============================================================================
// Per-User Budget Management
// ============================================================================

class UserBudgetManager {
  private userBudgets = new Map<string, BudgetTracker>()
  private defaultBudget: number

  constructor(defaultBudget: number = 1.0) {
    this.defaultBudget = defaultBudget
  }

  /**
   * Get or create budget tracker for user
   */
  getTracker(userId: string): BudgetTracker {
    if (!this.userBudgets.has(userId)) {
      this.userBudgets.set(
        userId,
        new BudgetTracker({
          maxCost: this.defaultBudget,
          alertThresholds: [0.8, 1.0],
          onAlert: (alert) => {
            console.log(`  [USER ${userId}] Budget alert: ${(alert.threshold * 100).toFixed(0)}%`)
          },
        })
      )
    }
    return this.userBudgets.get(userId)!
  }

  /**
   * Check if user can make request
   */
  canRequest(userId: string, estimatedTokens: number): boolean {
    const tracker = this.getTracker(userId)
    try {
      tracker.checkBudget({ estimatedTokens })
      return true
    } catch {
      return false
    }
  }

  /**
   * Get all user budgets
   */
  getAllUsage(): Record<string, { cost: number; remaining: number }> {
    const usage: Record<string, { cost: number; remaining: number }> = {}
    for (const [userId, tracker] of this.userBudgets) {
      const remaining = tracker.getRemainingBudget()
      usage[userId] = {
        cost: tracker.getTotalCost(),
        remaining: remaining.cost,
      }
    }
    return usage
  }
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('\n=== Budget-Constrained Generation Example ===\n')

  // Configure the AI provider
  configure({
    model: 'sonnet',
    provider: 'anthropic',
  })

  // Example 1: Basic budget tracking
  console.log('=== Example 1: Basic Budget Tracking ===')

  const generator = new BudgetAwareGenerator(0.1) // $0.10 budget

  const tasks: GenerationTask[] = [
    { id: 'task-1', prompt: 'Write a haiku about coding', priority: 'high' },
    { id: 'task-2', prompt: 'Explain REST APIs in one sentence', priority: 'medium' },
    { id: 'task-3', prompt: 'List 3 programming languages', priority: 'low' },
    { id: 'task-4', prompt: 'What is TypeScript?', priority: 'medium' },
    { id: 'task-5', prompt: 'Define AI briefly', priority: 'low' },
  ]

  console.log(`\nProcessing ${tasks.length} tasks with $0.10 budget:\n`)

  for (const task of tasks) {
    const result = await generator.generate(task)
    if (result) {
      console.log(`    Result: "${result.substring(0, 40)}..."\n`)
    }
  }

  const report = generator.getReport()
  console.log('\nCost Report:')
  console.log(`  Total Cost: $${report.totalCost.toFixed(4)}`)
  console.log(`  Requests: ${report.requestCount}`)
  console.log(`  Avg Cost/Request: $${report.avgCostPerRequest.toFixed(4)}`)
  console.log(`  Budget Utilization: ${report.budgetUtilization.toFixed(1)}%`)

  const alerts = generator.getAlerts()
  if (alerts.length > 0) {
    console.log('\nAlerts:')
    alerts.forEach((a) => console.log(`  - ${a}`))
  }

  // Example 2: withBudget wrapper
  console.log('\n=== Example 2: withBudget() Wrapper ===')
  await demonstrateWithBudget()

  // Example 3: Cost optimization strategies
  console.log('\n=== Example 3: Cost Optimization Strategies ===')

  // Prompt compression
  const longPrompt =
    'Please kindly write me a haiku poem about coding. Just make it simple and basically about programming.'
  const compressed = compressPrompt(longPrompt)
  console.log(`\nPrompt compression:`)
  console.log(`  Original: "${longPrompt}" (${longPrompt.length} chars)`)
  console.log(`  Compressed: "${compressed}" (${compressed.length} chars)`)
  console.log(
    `  Savings: ${(((longPrompt.length - compressed.length) / longPrompt.length) * 100).toFixed(
      0
    )}%`
  )

  // Example 4: Per-user budgets
  console.log('\n=== Example 4: Per-User Budget Management ===')

  const userManager = new UserBudgetManager(0.05) // $0.05 per user

  // Simulate user requests
  const users = ['user-1', 'user-2', 'user-3']
  for (const userId of users) {
    const tracker = userManager.getTracker(userId)
    tracker.recordUsage({
      inputTokens: Math.floor(Math.random() * 500) + 100,
      outputTokens: Math.floor(Math.random() * 200) + 50,
      model: 'claude-sonnet-4-20250514',
    })
  }

  const allUsage = userManager.getAllUsage()
  console.log('\nPer-User Budget Status:')
  for (const [userId, usage] of Object.entries(allUsage)) {
    console.log(
      `  ${userId}: Spent $${usage.cost.toFixed(4)}, Remaining $${usage.remaining.toFixed(4)}`
    )
  }

  // Example 5: Token estimation
  console.log('\n=== Example 5: Token Estimation ===')

  const counter = new TokenCounter()
  const sampleText = 'The quick brown fox jumps over the lazy dog.'
  const estimated = counter.estimateTokens(sampleText)

  console.log(`Text: "${sampleText}"`)
  console.log(`Estimated tokens: ${estimated}`)
  console.log(`Cost estimate (Sonnet): $${((estimated * 3) / 1000000).toFixed(6)} input`)

  // Summary
  console.log('\n=== Budget Management Summary ===')
  console.log(`
Key strategies for cost control:

1. Set hard limits with BudgetTracker
   - maxCost: Maximum spend in USD
   - maxTokens: Maximum token usage
   - alertThresholds: Early warnings

2. Use withBudget() for scoped tracking
   - Automatic enforcement
   - Request context tracking
   - Nested budget support

3. Optimize costs with:
   - Model tiering (Haiku < GPT-4o-mini < Sonnet)
   - Prompt compression
   - Caching similar requests
   - Fallback chains

4. Monitor per-user/tenant budgets
   - Fair usage enforcement
   - Quota management
   - Usage reporting
`)
}

main()
  .then(() => {
    console.log('\n=== Example Complete ===\n')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nError:', error.message)
    process.exit(1)
  })
