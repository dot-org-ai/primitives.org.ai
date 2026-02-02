/**
 * ICP Builder Example - ai-database
 *
 * This example demonstrates semantic grounding for Ideal Customer Profile (ICP)
 * generation using the backward fuzzy (<~) operator:
 * - Ground AI-generated content against reference data (O*NET, NAICS, etc.)
 * - Union types for polymorphic references
 * - Fuzzy threshold configuration
 * - Semantic search for matching
 *
 * Run with: npx tsx examples/04-icp-builder.ts
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

  // Define schema with semantic grounding
  const schema = {
    // The ICP entity - uses backward fuzzy to ground against reference data
    IdealCustomerProfile: {
      $instructions: 'Generate an Ideal Customer Profile for a B2B SaaS product',
      // Semantic grounding with threshold
      as: 'Who are they? (role/occupation) <~Occupation(0.7)',
      at: 'Where do they work? (company type/industry) <~Industry(0.7)',
      are: 'What are they doing? (daily tasks) <~Task(0.6)',
      using: 'What tools do they use? <~Tool|Software(0.6)',
      to: 'What is their goal? <~Outcome(0.5)',
      // Regular generated fields
      painPoints: 'What are their main frustrations?',
      budget: 'What is their typical budget range?',
      decisionProcess: 'How do they make purchasing decisions?',
    },

    // Reference data entities - seeded from authoritative sources
    Occupation: {
      title: 'string',
      description: 'string',
      category: 'string',
      // In production, you'd seed from O*NET: $seed: 'https://onet.data/occupations.tsv'
    },

    Industry: {
      name: 'string',
      naicsCode: 'string',
      description: 'string',
      // In production: $seed: 'https://naics.data/industries.tsv'
    },

    Task: {
      name: 'string',
      description: 'string',
      category: 'string',
    },

    Tool: {
      name: 'string',
      category: 'string',
      vendor: 'string?',
    },

    Software: {
      name: 'string',
      type: 'string',
      pricing: 'string',
    },

    Outcome: {
      description: 'string',
      metric: 'string?',
    },

    // Startup entity that targets ICPs
    Startup: {
      $instructions: 'A B2B SaaS startup',
      name: 'string',
      pitch: 'One-line value proposition',
      // Forward exact to create ICPs
      targetICPs: ['Who would buy this product? ->IdealCustomerProfile'],
      // Forward fuzzy to match existing competitors
      competitors: ['What companies compete in this space? ~>Competitor(0.5)'],
    },

    Competitor: {
      name: 'string',
      description: 'string',
      strengths: 'string',
      weaknesses: 'string',
    },
  } as const satisfies DatabaseSchema

  const { db } = DB(schema)

  console.log('=== ICP Builder Example ===\n')

  // Step 1: Seed reference data (simulating O*NET, NAICS, etc.)
  console.log('--- Seeding Reference Data ---\n')

  // Seed occupations (O*NET style)
  const occupations = [
    {
      title: 'Software Developer',
      description: 'Develops, creates, and modifies computer applications software.',
      category: 'Computer and Mathematical',
    },
    {
      title: 'Data Scientist',
      description: 'Uses advanced analytics to find insights from data.',
      category: 'Computer and Mathematical',
    },
    {
      title: 'Product Manager',
      description: 'Defines product vision and roadmap.',
      category: 'Management',
    },
    {
      title: 'DevOps Engineer',
      description: 'Builds and maintains infrastructure and deployment pipelines.',
      category: 'Computer and Mathematical',
    },
    {
      title: 'Engineering Manager',
      description: 'Leads engineering teams and technical initiatives.',
      category: 'Management',
    },
    {
      title: 'Sales Representative',
      description: 'Sells products and services to businesses.',
      category: 'Sales',
    },
  ]

  for (const occ of occupations) {
    await db.Occupation.create(occ)
  }
  console.log(`Seeded ${occupations.length} occupations`)

  // Seed industries (NAICS style)
  const industries = [
    {
      name: 'Software Publishers',
      naicsCode: '5112',
      description: 'Companies that publish software',
    },
    {
      name: 'Data Processing Services',
      naicsCode: '5182',
      description: 'Companies providing data processing',
    },
    {
      name: 'Computer Systems Design',
      naicsCode: '5415',
      description: 'IT consulting and custom software',
    },
    { name: 'Financial Technology', naicsCode: '5239', description: 'Fintech companies' },
    { name: 'Healthcare Technology', naicsCode: '5417', description: 'Health tech companies' },
  ]

  for (const ind of industries) {
    await db.Industry.create(ind)
  }
  console.log(`Seeded ${industries.length} industries`)

  // Seed tasks
  const tasks = [
    {
      name: 'Code Review',
      description: 'Review and approve code changes',
      category: 'Development',
    },
    { name: 'Sprint Planning', description: 'Plan upcoming work iterations', category: 'Planning' },
    {
      name: 'Deploy to Production',
      description: 'Ship code to production environment',
      category: 'DevOps',
    },
    { name: 'Data Analysis', description: 'Analyze datasets for insights', category: 'Analytics' },
    {
      name: 'Customer Discovery',
      description: 'Interview customers to understand needs',
      category: 'Research',
    },
  ]

  for (const task of tasks) {
    await db.Task.create(task)
  }
  console.log(`Seeded ${tasks.length} tasks`)

  // Seed tools and software
  const tools = [
    { name: 'VS Code', category: 'IDE', vendor: 'Microsoft' },
    { name: 'GitHub', category: 'Version Control', vendor: 'Microsoft' },
    { name: 'Jira', category: 'Project Management', vendor: 'Atlassian' },
    { name: 'Slack', category: 'Communication', vendor: 'Salesforce' },
    { name: 'Docker', category: 'Containerization', vendor: 'Docker Inc' },
  ]

  for (const tool of tools) {
    await db.Tool.create(tool)
  }

  const software = [
    { name: 'Kubernetes', type: 'Container Orchestration', pricing: 'Open Source' },
    { name: 'Datadog', type: 'Monitoring', pricing: 'SaaS Subscription' },
    { name: 'AWS', type: 'Cloud Platform', pricing: 'Pay-as-you-go' },
    { name: 'Notion', type: 'Documentation', pricing: 'Freemium' },
  ]

  for (const sw of software) {
    await db.Software.create(sw)
  }
  console.log(`Seeded ${tools.length} tools and ${software.length} software`)

  // Seed outcomes
  const outcomes = [
    { description: 'Ship features faster', metric: 'Deploy frequency' },
    { description: 'Reduce bugs in production', metric: 'Bug count' },
    { description: 'Improve team productivity', metric: 'Velocity' },
    { description: 'Cut infrastructure costs', metric: 'Monthly AWS bill' },
  ]

  for (const outcome of outcomes) {
    await db.Outcome.create(outcome)
  }
  console.log(`Seeded ${outcomes.length} outcomes`)

  // Step 2: Create ICP with semantic grounding
  console.log('\n--- Creating ICP with Semantic Grounding ---\n')

  const icp = await db.IdealCustomerProfile.create({
    // Hints for backward fuzzy matching
    asHint: 'Engineers who build and maintain software systems',
    atHint: 'Technology companies building SaaS products',
    areHint: 'Deploying code and managing infrastructure',
    usingHint: 'Container tools and cloud platforms',
    toHint: 'Ship code faster with fewer bugs',
  })

  console.log('Created ICP:\n')

  // Access grounded references
  const occupation = await icp.as
  console.log('WHO (grounded to Occupation):')
  console.log(`  Title: ${occupation?.title || 'Not matched'}`)
  console.log(`  Description: ${occupation?.description || 'N/A'}`)

  const industry = await icp.at
  console.log('\nWHERE (grounded to Industry):')
  console.log(`  Name: ${industry?.name || 'Not matched'}`)
  console.log(`  NAICS: ${industry?.naicsCode || 'N/A'}`)

  const task = await icp.are
  console.log('\nWHAT (grounded to Task):')
  console.log(`  Name: ${task?.name || 'Not matched'}`)

  const tool = await icp.using
  console.log('\nUSING (grounded to Tool|Software):')
  console.log(`  Name: ${tool?.name || 'Not matched'}`)
  console.log(`  Type: ${tool?.$type || 'N/A'}`)

  const outcome = await icp.to
  console.log('\nGOAL (grounded to Outcome):')
  console.log(`  Description: ${outcome?.description || 'Not matched'}`)

  console.log('\nGenerated Fields:')
  console.log(`  Pain Points: ${icp.painPoints}`)
  console.log(`  Budget: ${icp.budget}`)
  console.log(`  Decision Process: ${icp.decisionProcess}`)

  // Step 3: Create a startup with ICPs
  console.log('\n--- Creating Startup with Target ICPs ---\n')

  // First, add some competitors
  await db.Competitor.create({
    name: 'Jenkins',
    description: 'Open-source automation server for CI/CD',
    strengths: 'Highly customizable, large plugin ecosystem',
    weaknesses: 'Complex setup, requires maintenance',
  })

  await db.Competitor.create({
    name: 'CircleCI',
    description: 'Cloud-native CI/CD platform',
    strengths: 'Easy setup, good documentation',
    weaknesses: 'Can be expensive at scale',
  })

  const startup = await db.Startup.create(
    {
      name: 'DeployFlow',
      // Hint for fuzzy competitor matching
      competitorsHint: 'CI/CD and deployment automation tools',
    },
    {
      cascade: true,
      maxDepth: 1,
    }
  )

  console.log('Startup:', startup.name)
  console.log('Pitch:', startup.pitch)

  // Get matched competitors
  const competitors = await startup.competitors
  console.log('\nMatched Competitors:')
  for (const comp of competitors) {
    console.log(`  - ${comp.name}: ${comp.description}`)
  }

  // Get generated ICPs
  const targetICPs = await startup.targetICPs
  console.log('\nTarget ICPs:')
  for (const target of targetICPs) {
    const role = await target.as
    console.log(`  - Role: ${role?.title || 'Generated'}`)
    console.log(`    Pain Points: ${target.painPoints?.substring(0, 80)}...`)
  }

  // Step 4: Demonstrate threshold effects
  console.log('\n--- Threshold Effects Demo ---\n')

  // Search with different thresholds
  const strictMatch = await db.Occupation.semanticSearch('backend developer', {
    minScore: 0.9,
  })
  console.log(`Strict (0.9 threshold): ${strictMatch.length} matches`)

  const mediumMatch = await db.Occupation.semanticSearch('backend developer', {
    minScore: 0.7,
  })
  console.log(`Medium (0.7 threshold): ${mediumMatch.length} matches`)

  const looseMatch = await db.Occupation.semanticSearch('backend developer', {
    minScore: 0.5,
  })
  console.log(`Loose (0.5 threshold): ${looseMatch.length} matches`)

  if (looseMatch.length > 0) {
    console.log('\nTop matches:')
    for (const match of looseMatch.slice(0, 3)) {
      console.log(`  - ${match.title} (score: ${match.$score?.toFixed(3)})`)
    }
  }

  console.log('\n=== ICP Builder Example Complete ===')
}

main().catch(console.error)
