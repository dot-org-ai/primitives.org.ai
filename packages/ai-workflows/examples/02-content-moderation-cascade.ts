/**
 * Example: AI Content Moderation with Human Escalation
 *
 * This example demonstrates the CascadeExecutor pattern for content moderation.
 * Content is processed through escalating tiers:
 *
 * 1. Code (rules) - Fast keyword/pattern matching
 * 2. Generative AI - LLM-based analysis for nuanced content
 * 3. Agentic AI - Multi-step reasoning with tools
 * 4. Human - Expert review for edge cases
 *
 * Key concepts demonstrated:
 * - CascadeExecutor for tiered escalation
 * - Per-tier timeouts and retry configuration
 * - Skip conditions for tier bypassing
 * - 5W+H audit trail for compliance
 * - Integration with workflow events
 *
 * @example
 * ```bash
 * npx tsx examples/02-content-moderation-cascade.ts
 * ```
 */

import {
  Workflow,
  CascadeExecutor,
  type TierContext,
  type WorkflowContext,
  TIER_ORDER,
} from '../dist/index.js'

// ============================================================================
// Type Definitions
// ============================================================================

interface ContentItem {
  id: string
  type: 'text' | 'image' | 'video'
  content: string
  metadata: {
    userId: string
    platform: string
    timestamp: number
  }
}

interface ModerationResult {
  action: 'approve' | 'reject' | 'flag'
  confidence: number
  reason: string
  categories?: string[]
  requiresReview?: boolean
}

interface HumanReviewTask {
  contentId: string
  content: string
  aiAnalysis: string
  priority: 'low' | 'medium' | 'high'
  assignedTo?: string
}

// ============================================================================
// Mock Services
// ============================================================================

// Blocked keywords for rule-based tier
const BLOCKED_KEYWORDS = ['spam', 'scam', 'hack', 'illegal', 'violence']
const SUSPICIOUS_PATTERNS = [
  /\b(buy|sell)\s+followers\b/i,
  /\b(free|win)\s+\$?\d+/i,
  /click\s+here\s+now/i,
]

// Mock AI service
const aiService = {
  async analyzeContent(content: string): Promise<{
    isSafe: boolean
    confidence: number
    categories: string[]
    explanation: string
  }> {
    // Simulate AI analysis with some latency
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Mock logic based on content length and keywords
    const hasIssues = content.toLowerCase().includes('suspicious') || content.length > 500
    const confidence = hasIssues ? 0.65 : 0.95

    return {
      isSafe: !hasIssues,
      confidence,
      categories: hasIssues ? ['potentially_harmful'] : [],
      explanation: hasIssues
        ? 'Content requires further analysis due to suspicious patterns'
        : 'Content appears safe based on AI analysis',
    }
  },
}

// Mock agentic AI with tool access
const agenticService = {
  async deepAnalysis(
    content: string,
    context: TierContext
  ): Promise<{
    isSafe: boolean
    confidence: number
    reasoning: string[]
  }> {
    // Simulate multi-step reasoning
    await new Promise((resolve) => setTimeout(resolve, 100))

    const reasoning = [
      'Step 1: Analyzed semantic meaning of content',
      'Step 2: Checked against known harmful patterns',
      'Step 3: Verified user history and context',
      'Step 4: Applied platform-specific policies',
    ]

    const isSafe = !content.toLowerCase().includes('escalate')
    const confidence = isSafe ? 0.92 : 0.45

    return { isSafe, confidence, reasoning }
  },
}

// Mock human review queue
const humanReviewQueue: HumanReviewTask[] = []

// ============================================================================
// Cascade Executor Configuration
// ============================================================================

function createModerationCascade() {
  const events: Array<{ timestamp: number; event: string; data: unknown }> = []

  const cascade = new CascadeExecutor<ModerationResult>({
    cascadeName: 'content-moderation',
    actor: 'moderation-system',

    tiers: {
      // Tier 1: Rule-based (fastest, deterministic)
      code: {
        name: 'rule-based-filter',
        execute: async (input: unknown): Promise<ModerationResult> => {
          const content = (input as ContentItem).content.toLowerCase()

          // Check blocked keywords
          for (const keyword of BLOCKED_KEYWORDS) {
            if (content.includes(keyword)) {
              return {
                action: 'reject',
                confidence: 1.0,
                reason: `Contains blocked keyword: ${keyword}`,
                categories: ['blocked_content'],
              }
            }
          }

          // Check suspicious patterns
          for (const pattern of SUSPICIOUS_PATTERNS) {
            if (pattern.test(content)) {
              return {
                action: 'reject',
                confidence: 0.95,
                reason: 'Matches suspicious pattern',
                categories: ['spam_pattern'],
              }
            }
          }

          // Quick approve obviously safe content
          if (content.length < 50 && /^[a-z\s.,!?]+$/.test(content)) {
            return {
              action: 'approve',
              confidence: 0.99,
              reason: 'Simple safe content',
            }
          }

          // Escalate to AI for more complex content
          throw new Error('Content requires AI analysis')
        },
      },

      // Tier 2: Generative AI (nuanced analysis)
      generative: {
        name: 'ai-content-analysis',
        execute: async (input: unknown): Promise<ModerationResult> => {
          const contentItem = input as ContentItem
          const analysis = await aiService.analyzeContent(contentItem.content)

          // High confidence safe - approve
          if (analysis.isSafe && analysis.confidence > 0.9) {
            return {
              action: 'approve',
              confidence: analysis.confidence,
              reason: analysis.explanation,
              categories: analysis.categories,
            }
          }

          // High confidence unsafe - reject
          if (!analysis.isSafe && analysis.confidence > 0.9) {
            return {
              action: 'reject',
              confidence: analysis.confidence,
              reason: analysis.explanation,
              categories: analysis.categories,
            }
          }

          // Low confidence - escalate for deeper analysis
          throw new Error(`Confidence too low (${analysis.confidence}) - needs deeper analysis`)
        },
      },

      // Tier 3: Agentic AI (multi-step reasoning)
      agentic: {
        name: 'agentic-deep-analysis',
        execute: async (input: unknown, context: TierContext): Promise<ModerationResult> => {
          const contentItem = input as ContentItem
          const analysis = await agenticService.deepAnalysis(contentItem.content, context)

          console.log('  [Agentic] Reasoning steps:', analysis.reasoning)

          // High confidence from agent
          if (analysis.confidence > 0.85) {
            return {
              action: analysis.isSafe ? 'approve' : 'reject',
              confidence: analysis.confidence,
              reason: analysis.reasoning.join(' -> '),
            }
          }

          // Still uncertain - needs human
          throw new Error('Agent uncertain - requires human review')
        },
      },

      // Tier 4: Human review (final decision)
      human: {
        name: 'human-review',
        execute: async (input: unknown): Promise<ModerationResult> => {
          const contentItem = input as ContentItem

          // Create review task
          const task: HumanReviewTask = {
            contentId: contentItem.id,
            content: contentItem.content,
            aiAnalysis: 'AI was unable to reach high confidence decision',
            priority: 'high',
          }

          humanReviewQueue.push(task)
          console.log(`  [Human] Created review task for content ${contentItem.id}`)

          // For demo, simulate immediate human decision
          return {
            action: 'flag',
            confidence: 1.0,
            reason: 'Flagged for human review - decision pending',
            requiresReview: true,
          }
        },
      },
    },

    // Timeouts per tier
    timeouts: {
      code: 100, // 100ms for rules
      generative: 5000, // 5s for AI
      agentic: 30000, // 30s for agent
      human: 3600000, // 1 hour for human
    },

    // Retry configuration
    retryConfig: {
      generative: { maxRetries: 2, baseDelay: 100, multiplier: 2 },
      agentic: { maxRetries: 1, baseDelay: 500 },
    },

    // Skip conditions
    skipConditions: {
      // Skip agentic for very short content
      agentic: (input) => (input as ContentItem).content.length < 20,
    },

    // Event callback for audit trail
    onEvent: (event) => {
      events.push({
        timestamp: event.when,
        event: event.what,
        data: {
          status: event.how.status,
          duration: event.how.duration,
          ...(event.why && { reason: event.why }),
        },
      })
    },
  })

  return { cascade, events, humanReviewQueue }
}

// ============================================================================
// Workflow Integration
// ============================================================================

async function runModerationWorkflow() {
  const { cascade, events, humanReviewQueue } = createModerationCascade()

  const workflow = Workflow(($) => {
    $.on.Content.submitted(async (content: ContentItem, $: WorkflowContext) => {
      $.log(`Processing content ${content.id}`)

      try {
        const result = await cascade.execute(content)

        $.log(`Moderation complete: ${result.tier} tier -> ${result.value.action}`)

        // Emit result event
        $.send('Content.moderated', {
          contentId: content.id,
          result: result.value,
          resolvedBy: result.tier,
          metrics: result.metrics,
        })

        // Handle based on result
        if (result.value.action === 'approve') {
          $.send('Content.published', { contentId: content.id })
        } else if (result.value.action === 'reject') {
          $.send('Content.rejected', {
            contentId: content.id,
            reason: result.value.reason,
          })
        }
      } catch (error) {
        $.log(`Moderation failed: ${error}`)
        $.send('Content.moderationFailed', {
          contentId: content.id,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    $.on.Content.published(async (data: { contentId: string }, $: WorkflowContext) => {
      $.log(`Content ${data.contentId} published successfully`)
    })

    $.on.Content.rejected(
      async (data: { contentId: string; reason: string }, $: WorkflowContext) => {
        $.log(`Content ${data.contentId} rejected: ${data.reason}`)
      }
    )
  })

  await workflow.start()
  return { workflow, cascade, events, humanReviewQueue }
}

// ============================================================================
// Demo Execution
// ============================================================================

async function runDemo() {
  console.log('='.repeat(60))
  console.log('AI Content Moderation with Human Escalation Demo')
  console.log('='.repeat(60))
  console.log()

  const { workflow, events } = await runModerationWorkflow()

  // Test cases demonstrating different tiers
  const testContent: ContentItem[] = [
    // Case 1: Blocked keyword - handled by code tier
    {
      id: 'content_001',
      type: 'text',
      content: 'Check out this amazing spam offer!',
      metadata: { userId: 'user_1', platform: 'web', timestamp: Date.now() },
    },

    // Case 2: Simple safe content - handled by code tier
    {
      id: 'content_002',
      type: 'text',
      content: 'Hello, how are you today?',
      metadata: { userId: 'user_2', platform: 'mobile', timestamp: Date.now() },
    },

    // Case 3: Complex content - needs AI analysis
    {
      id: 'content_003',
      type: 'text',
      content:
        'This is a longer piece of content that discusses various topics in a nuanced way. ' +
        'It requires deeper analysis to determine if it meets community guidelines.',
      metadata: { userId: 'user_3', platform: 'web', timestamp: Date.now() },
    },

    // Case 4: Suspicious content - may need agent
    {
      id: 'content_004',
      type: 'text',
      content:
        'This content has suspicious elements that the AI flagged but cannot ' +
        'determine with high confidence. It requires multi-step reasoning.',
      metadata: { userId: 'user_4', platform: 'web', timestamp: Date.now() },
    },

    // Case 5: Needs escalation to human
    {
      id: 'content_005',
      type: 'text',
      content:
        'This complex content contains patterns that need to escalate ' +
        'all the way to human review for a final decision.',
      metadata: { userId: 'user_5', platform: 'web', timestamp: Date.now() },
    },
  ]

  // Process each content item
  for (const content of testContent) {
    console.log('-'.repeat(60))
    console.log(`Processing: ${content.id}`)
    console.log(`Content: "${content.content.substring(0, 50)}..."`)
    console.log()

    await workflow.send('Content.submitted', content)

    // Small delay between items
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  // Display audit trail
  console.log()
  console.log('='.repeat(60))
  console.log('Audit Trail (5W+H Events):')
  console.log('='.repeat(60))
  for (const event of events.slice(-10)) {
    console.log(`  ${new Date(event.timestamp).toISOString()} | ${event.event}`)
    console.log(`    Data: ${JSON.stringify(event.data)}`)
  }

  // Clean up
  await workflow.stop()
}

// Run if executed directly
runDemo().catch(console.error)
