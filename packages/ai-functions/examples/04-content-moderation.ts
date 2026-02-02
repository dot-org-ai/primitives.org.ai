/**
 * Content Moderation Pipeline Example
 *
 * This example demonstrates building a content moderation pipeline using ai-functions.
 * It shows how to:
 * - Check content for policy violations
 * - Classify content severity
 * - Handle edge cases with human review
 * - Build a multi-stage moderation pipeline
 *
 * @example
 * ```bash
 * ANTHROPIC_API_KEY=sk-... npx tsx examples/04-content-moderation.ts
 * ```
 */

import { ai, is, list, configure, withRetry, FallbackChain } from '../src/index.js'

// ============================================================================
// Types
// ============================================================================

interface ModerationResult {
  contentId: string
  decision: 'approved' | 'flagged' | 'rejected' | 'needs_review'
  categories: ViolationCategory[]
  severity: 'none' | 'low' | 'medium' | 'high' | 'severe'
  confidence: number
  reasoning: string
  suggestedAction: string
}

interface ViolationCategory {
  category: string
  detected: boolean
  confidence: number
  examples?: string[]
}

interface ContentItem {
  id: string
  type: 'text' | 'comment' | 'review' | 'bio'
  content: string
  author?: string
  context?: string
}

// ============================================================================
// Sample Content
// ============================================================================

const sampleContent: ContentItem[] = [
  {
    id: 'content-1',
    type: 'review',
    content: 'Great product! Really helped with my workflow. Highly recommend to anyone.',
    author: 'happy_user',
  },
  {
    id: 'content-2',
    type: 'comment',
    content: 'This is terrible! The developers are incompetent idiots who should be fired!',
    author: 'angry_person',
  },
  {
    id: 'content-3',
    type: 'bio',
    content: 'Follow me on MyWebsite.com for free stuff! DM for exclusive deals!!!',
    author: 'spammer_account',
  },
  {
    id: 'content-4',
    type: 'review',
    content: "I didn't like this product. It wasn't what I expected and the quality was poor.",
    author: 'honest_reviewer',
  },
  {
    id: 'content-5',
    type: 'comment',
    content:
      'Let me share some really helpful information: To solve this, try restarting the app and clearing cache.',
    author: 'helpful_user',
  },
]

// ============================================================================
// Moderation Checks
// ============================================================================

const POLICY_CATEGORIES = [
  'hate_speech',
  'harassment',
  'spam',
  'personal_attacks',
  'misinformation',
  'self_promotion',
  'profanity',
  'threats',
]

/**
 * Quick initial check - fast binary decision
 */
async function quickCheck(content: ContentItem): Promise<boolean> {
  return is`This content is clearly safe and requires no further moderation review:
"${content.content}"

Content is safe if it:
- Is constructive or helpful
- Contains no insults, threats, or harassment
- Is not spam or self-promotion
- Is appropriate for a general audience`
}

/**
 * Detailed category analysis
 */
async function analyzeCategories(content: ContentItem): Promise<ViolationCategory[]> {
  const results: ViolationCategory[] = []

  // Check each category
  for (const category of POLICY_CATEGORIES) {
    const detected = await is`This content violates the "${category}" policy:
"${content.content}"

${getCategoryDescription(category)}`

    results.push({
      category,
      detected,
      confidence: detected ? 0.8 : 0.9, // Simplified confidence
    })
  }

  return results
}

function getCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    hate_speech: 'Content that attacks or demeans people based on protected characteristics',
    harassment: 'Content that targets individuals with abuse, intimidation, or threats',
    spam: 'Unsolicited promotional content, repetitive messages, or commercial solicitation',
    personal_attacks: 'Direct insults or attacks on specific individuals',
    misinformation: 'Demonstrably false information presented as fact',
    self_promotion: 'Excessive self-promotion or advertising',
    profanity: 'Explicit language or vulgar content',
    threats: 'Threats of violence or harm to individuals or groups',
  }
  return descriptions[category] || 'Content that violates community guidelines'
}

/**
 * Determine severity based on violations
 */
async function assessSeverity(
  content: ContentItem,
  violations: ViolationCategory[]
): Promise<{
  severity: ModerationResult['severity']
  reasoning: string
}> {
  const detectedViolations = violations.filter((v) => v.detected)

  if (detectedViolations.length === 0) {
    return { severity: 'none', reasoning: 'No policy violations detected' }
  }

  const { severity, reasoning } = await ai`Assess the severity of these policy violations:

Content: "${content.content}"

Detected violations: ${detectedViolations.map((v) => v.category).join(', ')}

Provide:
- severity: one of [low, medium, high, severe] based on potential harm
- reasoning: brief explanation of the severity assessment`

  return {
    severity: severity as ModerationResult['severity'],
    reasoning: reasoning as string,
  }
}

/**
 * Determine final action
 */
async function determineAction(
  severity: ModerationResult['severity'],
  violations: ViolationCategory[]
): Promise<{
  decision: ModerationResult['decision']
  suggestedAction: string
}> {
  const detectedViolations = violations.filter((v) => v.detected)

  // Clear approval
  if (severity === 'none') {
    return {
      decision: 'approved',
      suggestedAction: 'No action needed - content is appropriate',
    }
  }

  // Auto-reject severe violations
  if (severity === 'severe') {
    return {
      decision: 'rejected',
      suggestedAction: 'Remove content and warn user account',
    }
  }

  // High severity needs review
  if (severity === 'high') {
    return {
      decision: 'needs_review',
      suggestedAction: 'Escalate to human moderator for final decision',
    }
  }

  // Medium/low - flag for monitoring
  const { action } = await ai`Recommend an action for content with ${severity} severity violations:
Violations: ${detectedViolations.map((v) => v.category).join(', ')}

Provide a brief action recommendation.`

  return {
    decision: 'flagged',
    suggestedAction: action as string,
  }
}

// ============================================================================
// Moderation Pipeline
// ============================================================================

async function moderateContent(content: ContentItem): Promise<ModerationResult> {
  console.log(`\nModerating [${content.id}]: "${content.content.substring(0, 40)}..."`)

  // Stage 1: Quick check
  const isClearlySafe = await quickCheck(content)
  console.log(`  Quick check: ${isClearlySafe ? 'Safe' : 'Needs analysis'}`)

  if (isClearlySafe) {
    return {
      contentId: content.id,
      decision: 'approved',
      categories: POLICY_CATEGORIES.map((c) => ({
        category: c,
        detected: false,
        confidence: 0.95,
      })),
      severity: 'none',
      confidence: 0.95,
      reasoning: 'Content passed quick safety check',
      suggestedAction: 'No action needed',
    }
  }

  // Stage 2: Detailed category analysis
  const violations = await analyzeCategories(content)
  const detectedCount = violations.filter((v) => v.detected).length
  console.log(`  Category analysis: ${detectedCount} violations detected`)

  // Stage 3: Severity assessment
  const { severity, reasoning } = await assessSeverity(content, violations)
  console.log(`  Severity: ${severity}`)

  // Stage 4: Action determination
  const { decision, suggestedAction } = await determineAction(severity, violations)
  console.log(`  Decision: ${decision}`)

  return {
    contentId: content.id,
    decision,
    categories: violations,
    severity,
    confidence: 0.85, // Simplified
    reasoning,
    suggestedAction,
  }
}

// ============================================================================
// Batch Processing with Resilience
// ============================================================================

async function batchModerate(contents: ContentItem[]): Promise<ModerationResult[]> {
  console.log(`\n${'='.repeat(60)}`)
  console.log('Content Moderation Pipeline')
  console.log('='.repeat(60))

  const results: ModerationResult[] = []

  for (const content of contents) {
    try {
      // Use retry logic for resilience
      const result = await withRetry(async () => moderateContent(content), {
        maxRetries: 2,
        baseDelay: 1000,
      })
      results.push(result)
    } catch (error) {
      // If moderation fails, flag for human review
      results.push({
        contentId: content.id,
        decision: 'needs_review',
        categories: [],
        severity: 'medium',
        confidence: 0,
        reasoning: `Moderation failed: ${(error as Error).message}`,
        suggestedAction: 'Manual review required due to processing error',
      })
    }
  }

  return results
}

// ============================================================================
// Report Generation
// ============================================================================

function generateReport(results: ModerationResult[]): void {
  console.log(`\n${'='.repeat(60)}`)
  console.log('Moderation Report')
  console.log('='.repeat(60))

  const stats = {
    approved: results.filter((r) => r.decision === 'approved').length,
    flagged: results.filter((r) => r.decision === 'flagged').length,
    rejected: results.filter((r) => r.decision === 'rejected').length,
    needs_review: results.filter((r) => r.decision === 'needs_review').length,
  }

  console.log('\nSummary:')
  console.log(`  Approved: ${stats.approved}`)
  console.log(`  Flagged: ${stats.flagged}`)
  console.log(`  Rejected: ${stats.rejected}`)
  console.log(`  Needs Review: ${stats.needs_review}`)

  console.log('\nDetailed Results:')
  for (const result of results) {
    const detectedCategories = result.categories.filter((c) => c.detected).map((c) => c.category)

    console.log(`
  [${result.contentId}]
    Decision: ${result.decision.toUpperCase()}
    Severity: ${result.severity}
    Confidence: ${(result.confidence * 100).toFixed(0)}%
    ${
      detectedCategories.length > 0
        ? `Violations: ${detectedCategories.join(', ')}`
        : 'No violations'
    }
    Action: ${result.suggestedAction}`)
  }

  // Violation breakdown
  console.log('\nViolation Breakdown:')
  const violationCounts: Record<string, number> = {}
  for (const result of results) {
    for (const cat of result.categories.filter((c) => c.detected)) {
      violationCounts[cat.category] = (violationCounts[cat.category] || 0) + 1
    }
  }

  for (const [category, count] of Object.entries(violationCounts)) {
    console.log(`  ${category}: ${count}`)
  }
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('\n=== Content Moderation Pipeline Example ===\n')

  // Configure the AI provider
  configure({
    model: 'sonnet',
    provider: 'anthropic',
  })

  // Process all sample content
  const results = await batchModerate(sampleContent)

  // Generate report
  generateReport(results)
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
