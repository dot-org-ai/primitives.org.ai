/**
 * Two-Phase Draft/Resolve Example - ai-database
 *
 * This example demonstrates the two-phase workflow for generating entities:
 * - Phase 1 (Draft): Generate with natural language placeholders
 * - Phase 2 (Resolve): Convert placeholders to actual entity references
 *
 * This is useful when you want to:
 * - Review generated content before committing
 * - Edit drafts before resolution
 * - Decouple content generation from entity creation
 *
 * Run with: npx tsx examples/10-two-phase-draft.ts
 */

import { DB, setProvider, createMemoryProvider, configureAIGeneration } from '../src/index.js'
import type { DatabaseSchema } from '../src/index.js'

async function main() {
  // Initialize provider
  setProvider(createMemoryProvider())

  // Enable AI generation
  configureAIGeneration({
    enabled: true,
    model: 'sonnet',
  })

  // Define schema with relationships
  const schema = {
    Proposal: {
      $instructions: 'A B2B sales proposal',
      title: 'string',
      summary: 'Executive summary of the proposal',
      // Relationships that will be resolved in phase 2
      client: '->Client',
      products: ['->Product'],
      pricing: '->PricingPlan',
      terms: '->ContractTerms',
    },

    Client: {
      name: 'string',
      industry: 'string',
      size: 'string',
      contacts: ['->Contact'],
    },

    Contact: {
      name: 'string',
      title: 'string',
      email: 'string',
      phone: 'string?',
    },

    Product: {
      name: 'string',
      sku: 'string',
      description: 'string',
      basePrice: 'number',
    },

    PricingPlan: {
      name: 'string',
      discount: 'number', // percentage
      validity: 'string', // e.g., "30 days"
      total: 'number',
      breakdown: 'json', // line items
    },

    ContractTerms: {
      duration: 'string', // e.g., "12 months"
      paymentTerms: 'string', // e.g., "Net 30"
      sla: 'string', // Service level agreement
      cancellation: 'string', // Cancellation policy
    },

    Article: {
      $instructions: 'A blog article for technical audiences',
      title: 'string',
      slug: 'string',
      excerpt: 'string',
      content: 'markdown',
      author: '->Author',
      tags: ['->Tag'],
      relatedArticles: ['~>Article'],
    },

    Author: {
      name: 'string',
      bio: 'string',
      avatar: 'url?',
    },

    Tag: {
      name: 'string',
      slug: 'string',
    },

    Email: {
      $context: ['Client', 'Product'],
      $instructions: 'Personalized email for {client.name} about {product.name}',
      subject: 'string',
      body: 'markdown',
      client: '->Client',
      product: '->Product',
    },
  } as const satisfies DatabaseSchema

  const { db } = DB(schema)

  console.log('=== Two-Phase Draft/Resolve Example ===\n')

  // ====================================
  // Part 1: Basic Draft/Resolve Workflow
  // ====================================
  console.log('--- Part 1: Basic Draft/Resolve ---\n')

  // Create seed data first
  const existingClient = await db.Client.create({
    name: 'TechCorp Industries',
    industry: 'Technology',
    size: 'Enterprise',
  })

  const existingProducts = await Promise.all([
    db.Product.create({
      name: 'Analytics Pro',
      sku: 'AP-001',
      description: 'Advanced analytics',
      basePrice: 5000,
    }),
    db.Product.create({
      name: 'DataSync',
      sku: 'DS-001',
      description: 'Data synchronization',
      basePrice: 2000,
    }),
  ])

  console.log('Created seed data:')
  console.log(`  Client: ${existingClient.name}`)
  console.log(`  Products: ${existingProducts.map((p) => p.name).join(', ')}`)

  // Phase 1: Create a draft
  console.log('\n--- Phase 1: Creating Draft ---')

  const draft = await db.Proposal.draft({
    title: 'Q1 Enterprise Package Proposal',
  })

  console.log('\nDraft created:')
  console.log(`  Phase: ${draft.$phase}`)
  console.log(`  Title: ${draft.title}`)
  console.log(`  Summary: ${draft.summary}`)

  // Inspect draft references
  console.log('\n  References (unresolved):')
  if (draft.$refs) {
    for (const [field, ref] of Object.entries(draft.$refs)) {
      console.log(`    ${field}:`)
      console.log(`      Type: ${ref.type}`)
      console.log(`      Resolved: ${ref.resolved}`)
      console.log(`      Description: ${ref.description || 'N/A'}`)
    }
  }

  // Phase 2: Modify draft before resolution
  console.log('\n--- Modifying Draft ---')

  // You can edit the draft before resolution
  draft.summary =
    'Comprehensive enterprise solution for TechCorp Industries, including analytics and data sync capabilities.'

  // Provide specific values for references
  draft.client = `${existingClient.name} - a leading enterprise in the technology sector`
  draft.products = [
    'Analytics Pro - our flagship analytics platform',
    'DataSync - real-time data synchronization solution',
  ]

  console.log('Draft modified:')
  console.log(`  Summary: ${draft.summary.substring(0, 60)}...`)

  // Phase 3: Resolve the draft
  console.log('\n--- Phase 2: Resolving Draft ---')

  const resolved = await db.Proposal.resolve(draft)

  console.log('\nResolved proposal:')
  console.log(`  Phase: ${resolved.$phase}`)
  console.log(`  Title: ${resolved.title}`)

  // Access resolved relationships
  const resolvedClient = await db.Client.get(resolved.client)
  console.log(`  Client: ${resolvedClient?.name}`)

  // ====================================
  // Part 2: Article Generation with Draft
  // ====================================
  console.log('\n--- Part 2: Article Draft Workflow ---\n')

  // Create author and tags first
  const author = await db.Author.create({
    name: 'Jane Developer',
    bio: 'Senior engineer with 10 years of experience',
  })

  const tags = await Promise.all([
    db.Tag.create({ name: 'TypeScript', slug: 'typescript' }),
    db.Tag.create({ name: 'Tutorial', slug: 'tutorial' }),
    db.Tag.create({ name: 'Best Practices', slug: 'best-practices' }),
  ])

  // Create draft with streaming
  console.log('Creating article draft with streaming...\n')

  const chunks: string[] = []

  const articleDraft = await db.Article.draft(
    {
      title: 'Building Type-Safe APIs with TypeScript',
    },
    {
      stream: true,
      onChunk: (chunk) => {
        chunks.push(chunk)
        process.stdout.write('.')
      },
    }
  )

  console.log(`\n\nDraft created with ${chunks.length} chunks`)
  console.log(`\nArticle Draft:`)
  console.log(`  Title: ${articleDraft.title}`)
  console.log(`  Slug: ${articleDraft.slug}`)
  console.log(`  Excerpt: ${articleDraft.excerpt?.substring(0, 80)}...`)

  // Preview content
  console.log(`\n  Content Preview:`)
  console.log(`    ${articleDraft.content?.substring(0, 200)}...`)

  // Edit draft - specify actual references
  articleDraft.author = `${author.name}`
  articleDraft.tags = tags.map((t) => t.name)

  // Resolve with callback
  console.log('\n--- Resolving Article Draft ---')

  const resolvedRefs: string[] = []

  const resolvedArticle = await db.Article.resolve(articleDraft, {
    onResolved: (fieldName, entityId) => {
      resolvedRefs.push(`${fieldName} -> ${entityId}`)
      console.log(`  Resolved ${fieldName}: ${entityId}`)
    },
  })

  console.log(`\nResolution complete:`)
  console.log(`  References resolved: ${resolvedRefs.length}`)

  // ====================================
  // Part 3: Context-Aware Draft
  // ====================================
  console.log('\n--- Part 3: Context-Aware Draft ---\n')

  // Create email with explicit context
  const product = existingProducts[0]

  console.log('Creating personalized email draft...')
  console.log(`  Client: ${existingClient.name}`)
  console.log(`  Product: ${product.name}`)

  const emailDraft = await db.Email.draft({
    client: existingClient.$id,
    product: product.$id,
  })

  console.log('\nEmail Draft:')
  console.log(`  Subject: ${emailDraft.subject}`)
  console.log(`  Body Preview: ${emailDraft.body?.substring(0, 150)}...`)

  // Resolve email
  const resolvedEmail = await db.Email.resolve(emailDraft)
  console.log('\nEmail resolved successfully')

  // ====================================
  // Part 4: Draft Validation
  // ====================================
  console.log('\n--- Part 4: Draft Validation ---\n')

  // Create a simple draft
  const simpleDraft = await db.Client.draft({
    name: 'Acme Corporation',
    industry: 'Manufacturing',
    size: 'Mid-Market',
  })

  console.log('Simple draft created:')
  console.log(`  Name: ${simpleDraft.name}`)
  console.log(`  Phase: ${simpleDraft.$phase}`)

  // Try to resolve a non-draft (should fail)
  console.log('\nAttempting to resolve a non-draft entity...')

  const regularEntity = await db.Client.create({
    name: 'Regular Corp',
    industry: 'Services',
    size: 'SMB',
  })

  try {
    await db.Client.resolve(regularEntity)
    console.log('ERROR: Should have thrown!')
  } catch (err: any) {
    console.log(`Expected error: ${err.message}`)
  }

  // ====================================
  // Part 5: Batch Draft Processing
  // ====================================
  console.log('\n--- Part 5: Batch Draft Processing ---\n')

  // Create multiple drafts
  const drafts = []
  for (let i = 1; i <= 3; i++) {
    const d = await db.Client.draft({
      name: `Draft Client ${i}`,
      industry: `Industry ${i}`,
      size: 'SMB',
    })
    drafts.push(d)
  }

  console.log(`Created ${drafts.length} drafts`)

  // Review drafts
  console.log('\nReviewing drafts:')
  for (const d of drafts) {
    console.log(`  - ${d.name} (${d.$phase})`)
  }

  // Edit some drafts
  drafts[0].industry = 'Technology'
  drafts[1].size = 'Enterprise'

  // Resolve all drafts
  console.log('\nResolving all drafts...')

  const resolvedClients = []
  for (const d of drafts) {
    const resolved = await db.Client.resolve(d)
    resolvedClients.push(resolved)
  }

  console.log(`Resolved ${resolvedClients.length} clients`)

  // Verify
  const allClients = await db.Client.list()
  console.log(`Total clients in database: ${allClients.length}`)

  // ====================================
  // Summary
  // ====================================
  console.log('\n--- Summary ---\n')

  console.log('Two-Phase Draft/Resolve workflow:')
  console.log('')
  console.log('Phase 1 (Draft):')
  console.log('  - Call entity.draft() with initial data')
  console.log('  - AI generates content with placeholder references')
  console.log('  - Draft is NOT persisted to database')
  console.log('  - Draft can be inspected, edited, validated')
  console.log('')
  console.log('Phase 2 (Resolve):')
  console.log('  - Call entity.resolve(draft) to commit')
  console.log('  - Placeholder references become real entities')
  console.log('  - All relationships are created')
  console.log('  - Entity is persisted to database')
  console.log('')
  console.log('Benefits:')
  console.log('  - Review before committing')
  console.log('  - Human-in-the-loop editing')
  console.log('  - Decouple generation from storage')
  console.log('  - Batch processing of drafts')
  console.log('  - Streaming support for long content')

  console.log('\n=== Two-Phase Draft/Resolve Example Complete ===')
}

main().catch(console.error)
