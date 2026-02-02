/**
 * Quickstart Example
 *
 * This example demonstrates the core primitives of ai-functions in a simple,
 * easy-to-follow format. It covers:
 * - Basic text generation with `write`
 * - List generation with `list`
 * - Boolean checks with `is`
 * - Structured output with `ai`
 * - Configuration options
 *
 * @example
 * ```bash
 * ANTHROPIC_API_KEY=sk-... npx tsx examples/00-quickstart.ts
 * ```
 */

import { ai, write, list, is, extract, configure, withContext } from '../src/index.js'

// ============================================================================
// Setup
// ============================================================================

// Configure the AI provider (optional - will use env vars by default)
configure({
  model: 'sonnet', // or 'gpt-4o', 'claude-3-5-haiku-latest', etc.
  provider: 'anthropic', // or 'openai'
})

// ============================================================================
// Text Generation
// ============================================================================

async function textGenerationExamples() {
  console.log('\n=== Text Generation ===\n')

  // Simple text generation
  const haiku = await write`a haiku about TypeScript`
  console.log('Haiku:', haiku)

  // With more context
  const email = await write`a professional email declining a meeting invitation.
  Keep it brief and polite.`
  console.log('\nEmail:', email)
}

// ============================================================================
// List Generation
// ============================================================================

async function listGenerationExamples() {
  console.log('\n=== List Generation ===\n')

  // Generate a simple list
  const ideas = await list`5 startup ideas in the AI space`
  console.log('Startup Ideas:')
  ideas.forEach((idea, i) => console.log(`  ${i + 1}. ${idea}`))

  // Using map for processing (batched automatically)
  console.log('\nProcessing ideas with map...')
  const evaluated = await Promise.all(
    ideas.slice(0, 3).map(async (idea) => ({
      idea,
      feasible: await is`"${idea}" is technically feasible with current technology`,
    }))
  )

  console.log('\nFeasibility Check:')
  evaluated.forEach((e) => {
    console.log(`  ${e.feasible ? '✓' : '✗'} ${e.idea}`)
  })
}

// ============================================================================
// Boolean Checks
// ============================================================================

async function booleanCheckExamples() {
  console.log('\n=== Boolean Checks ===\n')

  // Simple true/false questions
  const checks = [
    await is`"TypeScript" is a programming language`,
    await is`42 is a prime number`,
    await is`Paris is the capital of France`,
    await is`HTML is a programming language`,
  ]

  console.log('Boolean Checks:')
  console.log(`  TypeScript is a programming language: ${checks[0]}`)
  console.log(`  42 is a prime number: ${checks[1]}`)
  console.log(`  Paris is capital of France: ${checks[2]}`)
  console.log(`  HTML is a programming language: ${checks[3]}`)

  // Content validation example
  const userInput = 'Buy our amazing product at discount.com!!!'
  const isSpam = await is`This text is spam or promotional: "${userInput}"`
  console.log(`\n  "${userInput}" is spam: ${isSpam}`)
}

// ============================================================================
// Structured Output
// ============================================================================

async function structuredOutputExamples() {
  console.log('\n=== Structured Output ===\n')

  // Extract structured data from text
  const article = `
    Apple Inc. announced today that CEO Tim Cook will be presenting
    the new iPhone 16 at the September 2024 event in Cupertino, California.
    The device is expected to feature AI capabilities and cost around $999.
  `

  // Using destructuring to define the schema
  const { company, product, person, location, price, date } = await ai`
    Extract key information from this article:
    ${article}

    Provide:
    - company: company name
    - product: product mentioned
    - person: person mentioned
    - location: location mentioned
    - price: price if mentioned
    - date: date or time mentioned
  `

  console.log('Extracted Information:')
  console.log(`  Company: ${company}`)
  console.log(`  Product: ${product}`)
  console.log(`  Person: ${person}`)
  console.log(`  Location: ${location}`)
  console.log(`  Price: ${price}`)
  console.log(`  Date: ${date}`)

  // Generate structured content
  const { title, description, tags } = await ai`
    Create a blog post metadata for a post about "Getting Started with AI Functions":
    - title: engaging blog post title
    - description: SEO description (under 160 chars)
    - tags: array of 5 relevant tags
  `

  console.log('\nGenerated Blog Metadata:')
  console.log(`  Title: ${title}`)
  console.log(`  Description: ${description}`)
  console.log(`  Tags: ${(tags as string[]).join(', ')}`)
}

// ============================================================================
// Data Extraction
// ============================================================================

async function extractionExamples() {
  console.log('\n=== Data Extraction ===\n')

  const text = `
    Contact us at support@example.com or sales@company.io.
    Call John at 555-123-4567 or reach Sarah at 555-987-6543.
    Meeting scheduled for March 15, 2024 and follow-up on April 1st.
  `

  const emails = await extract`all email addresses from: ${text}`
  console.log('Emails:', emails)

  const phones = await extract`all phone numbers from: ${text}`
  console.log('Phone Numbers:', phones)

  const dates = await extract`all dates from: ${text}`
  console.log('Dates:', dates)
}

// ============================================================================
// Scoped Configuration
// ============================================================================

async function scopedConfigExamples() {
  console.log('\n=== Scoped Configuration ===\n')

  // Use different settings for specific operations
  const result = await withContext(
    {
      model: 'claude-3-5-haiku-latest', // Use faster model
      temperature: 0.1, // More deterministic
    },
    async () => {
      console.log('  Using Haiku model with low temperature...')
      return write`What is 2+2? Answer with just the number.`
    }
  )

  console.log(`  Result: ${result}`)

  // Back to default configuration
  const creative = await write`Give a creative name for a cat`
  console.log(`  Creative cat name: ${creative}`)
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('\n========================================')
  console.log('  ai-functions Quickstart')
  console.log('========================================')

  await textGenerationExamples()
  await listGenerationExamples()
  await booleanCheckExamples()
  await structuredOutputExamples()
  await extractionExamples()
  await scopedConfigExamples()

  console.log('\n========================================')
  console.log('  Quickstart Complete!')
  console.log('========================================')
  console.log(`
Next steps:
- Try the other examples in this directory
- Read the README.md for the full API reference
- Check out test/ for more usage patterns
`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nError:', error.message)
    process.exit(1)
  })
