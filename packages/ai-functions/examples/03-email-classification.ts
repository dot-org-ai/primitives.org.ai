/**
 * Email Classification and Routing Example
 *
 * This example demonstrates building an email classification and routing system
 * using ai-functions. It shows how to:
 * - Classify emails into categories
 * - Extract key information from emails
 * - Route to appropriate handlers
 * - Handle priority and urgency
 *
 * @example
 * ```bash
 * ANTHROPIC_API_KEY=sk-... npx tsx examples/03-email-classification.ts
 * ```
 */

import { ai, is, list, extract, configure, decide } from '../src/index.js'

// ============================================================================
// Types
// ============================================================================

interface Email {
  id: string
  from: string
  to: string
  subject: string
  body: string
  timestamp: Date
}

interface ClassificationResult {
  category: string
  subcategory: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  sentiment: 'positive' | 'neutral' | 'negative'
  requiresResponse: boolean
  suggestedTeam: string
}

interface ExtractedInfo {
  senderIntent: string
  keyEntities: string[]
  actionItems: string[]
  deadlines: string[]
  attachmentReferences: string[]
}

interface RoutingDecision {
  team: string
  handler: string
  autoResponse: boolean
  escalate: boolean
  suggestedResponse?: string
}

// ============================================================================
// Sample Emails
// ============================================================================

const sampleEmails: Email[] = [
  {
    id: 'email-1',
    from: 'john.smith@bigcorp.com',
    to: 'sales@ourcompany.com',
    subject: 'Enterprise License Inquiry - 500 seats',
    body: `Hi,

We are interested in your enterprise solution for our organization.
We have approximately 500 developers who would need access.

Could you please provide:
1. Enterprise pricing for 500 seats
2. Volume discount options
3. Security compliance certifications (SOC2, HIPAA)
4. On-premise deployment options

We're looking to make a decision within the next 2 weeks.

Best regards,
John Smith
VP of Engineering, BigCorp Inc.`,
    timestamp: new Date(),
  },
  {
    id: 'email-2',
    from: 'frustrated.user@example.com',
    to: 'support@ourcompany.com',
    subject: 'URGENT: System down - Production blocked!',
    body: `Our production system has been down for 3 hours!!!

Error: "Connection timeout to API endpoint"

We're losing thousands of dollars per hour. We need immediate assistance.
Our contract includes 24/7 premium support.

Account ID: ENT-12345
Contact: 555-123-4567

This needs to be fixed NOW.`,
    timestamp: new Date(),
  },
  {
    id: 'email-3',
    from: 'newsletter@techblog.com',
    to: 'team@ourcompany.com',
    subject: 'Weekly AI Newsletter - Top Stories',
    body: `This week in AI:

- GPT-5 rumors continue to swirl
- New open-source models released
- Industry adoption trends

Click to read more...

Unsubscribe: techblog.com/unsubscribe`,
    timestamp: new Date(),
  },
  {
    id: 'email-4',
    from: 'hr@ourcompany.com',
    to: 'team@ourcompany.com',
    subject: 'Company All-Hands Meeting - Friday 3pm',
    body: `Hi everyone,

Reminder: Our monthly all-hands meeting is this Friday at 3pm.

Agenda:
- Q4 Results Review
- 2025 Planning
- Team Awards

Please submit any questions beforehand.

Best,
HR Team`,
    timestamp: new Date(),
  },
]

// ============================================================================
// Email Classifier
// ============================================================================

async function classifyEmail(email: Email): Promise<ClassificationResult> {
  console.log(`\nClassifying: "${email.subject}"`)

  const { category, subcategory, priority, sentiment, requiresResponse, suggestedTeam } =
    await ai`Classify this email:

From: ${email.from}
Subject: ${email.subject}
Body: ${email.body}

Provide:
- category: one of [sales, support, marketing, internal, spam, other]
- subcategory: more specific classification
- priority: one of [low, medium, high, urgent]
- sentiment: one of [positive, neutral, negative]
- requiresResponse: boolean - does this need a reply?
- suggestedTeam: which team should handle this`

  return {
    category: category as string,
    subcategory: subcategory as string,
    priority: priority as 'low' | 'medium' | 'high' | 'urgent',
    sentiment: sentiment as 'positive' | 'neutral' | 'negative',
    requiresResponse: requiresResponse as boolean,
    suggestedTeam: suggestedTeam as string,
  }
}

// ============================================================================
// Information Extractor
// ============================================================================

async function extractInfo(email: Email): Promise<ExtractedInfo> {
  console.log(`  Extracting key information...`)

  const { senderIntent, keyEntities, actionItems, deadlines, attachmentReferences } =
    await ai`Extract key information from this email:

Subject: ${email.subject}
Body: ${email.body}

Provide:
- senderIntent: what the sender wants (1 sentence)
- keyEntities: array of important entities (names, companies, products, account IDs)
- actionItems: array of action items or requests
- deadlines: array of mentioned deadlines or timeframes
- attachmentReferences: any references to attachments or documents`

  return {
    senderIntent: senderIntent as string,
    keyEntities: keyEntities as string[],
    actionItems: actionItems as string[],
    deadlines: deadlines as string[],
    attachmentReferences: attachmentReferences as string[],
  }
}

// ============================================================================
// Router
// ============================================================================

async function routeEmail(
  email: Email,
  classification: ClassificationResult,
  info: ExtractedInfo
): Promise<RoutingDecision> {
  console.log(`  Determining routing...`)

  // Check if escalation is needed
  const needsEscalation = await is`This email requires immediate escalation to management:
Category: ${classification.category}
Priority: ${classification.priority}
Sentiment: ${classification.sentiment}
Intent: ${info.senderIntent}`

  // Determine if auto-response is appropriate
  const canAutoRespond = await is`This email can be handled with an automated response:
Category: ${classification.category}
Intent: ${info.senderIntent}
Action Items: ${info.actionItems.join(', ')}`

  // Route based on category
  const routingMap: Record<string, { team: string; handler: string }> = {
    sales: { team: 'Sales', handler: 'sales-queue' },
    support: {
      team: 'Support',
      handler: classification.priority === 'urgent' ? 'urgent-queue' : 'support-queue',
    },
    marketing: { team: 'Marketing', handler: 'marketing-inbox' },
    internal: { team: 'Internal', handler: 'internal-comms' },
    spam: { team: 'None', handler: 'spam-filter' },
    other: { team: 'Triage', handler: 'general-queue' },
  }

  const route = routingMap[classification.category] || routingMap.other

  let suggestedResponse: string | undefined
  if (canAutoRespond) {
    suggestedResponse = await generateAutoResponse(email, classification, info)
  }

  return {
    team: route.team,
    handler: route.handler,
    autoResponse: canAutoRespond,
    escalate: needsEscalation,
    suggestedResponse,
  }
}

// ============================================================================
// Auto-Response Generator
// ============================================================================

async function generateAutoResponse(
  email: Email,
  classification: ClassificationResult,
  info: ExtractedInfo
): Promise<string> {
  console.log(`  Generating auto-response...`)

  const response = await ai`Generate a brief, professional auto-response for this email:

Original Subject: ${email.subject}
Category: ${classification.category}
Sender Intent: ${info.senderIntent}

The response should:
- Acknowledge receipt
- Set expectations for response time
- Provide any immediately helpful information
- Be concise (3-4 sentences max)

Return just the response text.`

  return response as string
}

// ============================================================================
// Batch Classification
// ============================================================================

async function batchClassifyEmails(emails: Email[]): Promise<void> {
  console.log(`\n${'='.repeat(60)}`)
  console.log('Batch Email Classification Results')
  console.log('='.repeat(60))

  for (const email of emails) {
    const classification = await classifyEmail(email)
    const info = await extractInfo(email)
    const routing = await routeEmail(email, classification, info)

    console.log(`
ID: ${email.id}
Subject: ${email.subject}
---
Classification:
  Category: ${classification.category} / ${classification.subcategory}
  Priority: ${classification.priority}
  Sentiment: ${classification.sentiment}
  Requires Response: ${classification.requiresResponse}

Extracted Info:
  Intent: ${info.senderIntent}
  Entities: ${info.keyEntities.join(', ') || 'none'}
  Action Items: ${info.actionItems.length}
  Deadlines: ${info.deadlines.join(', ') || 'none'}

Routing:
  Team: ${routing.team}
  Handler: ${routing.handler}
  Auto-Response: ${routing.autoResponse}
  Escalate: ${routing.escalate}
${
  routing.suggestedResponse
    ? `\nSuggested Response:\n  "${routing.suggestedResponse.substring(0, 100)}..."`
    : ''
}
${'='.repeat(60)}`)
  }
}

// ============================================================================
// Priority Comparison
// ============================================================================

async function prioritizeEmails(emails: Email[]): Promise<Email[]> {
  console.log('\n--- Prioritizing Emails ---')

  // Use decide to compare email urgency
  if (emails.length < 2) return emails

  // For demo, just compare first two
  const moreUrgent = await decide`which email is more urgent and should be handled first`(
    { subject: emails[0].subject, body: emails[0].body.substring(0, 100) },
    { subject: emails[1].subject, body: emails[1].body.substring(0, 100) }
  )

  console.log(`Most urgent: "${(moreUrgent as Email).subject}"`)
  return emails
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('\n=== Email Classification & Routing Example ===\n')

  // Configure the AI provider
  configure({
    model: 'sonnet',
    provider: 'anthropic',
  })

  // Process all sample emails
  await batchClassifyEmails(sampleEmails)

  // Prioritize emails
  await prioritizeEmails(sampleEmails.slice(0, 2))

  // Show statistics
  console.log('\n--- Processing Statistics ---')
  console.log(`Total emails processed: ${sampleEmails.length}`)
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
