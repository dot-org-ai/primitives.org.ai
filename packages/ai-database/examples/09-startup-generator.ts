/**
 * Startup Generator Example - ai-database
 *
 * This example demonstrates a complete startup ecosystem generator
 * showing all four relationship operators working together:
 * - Forward exact (->) for creating child entities
 * - Forward fuzzy (~>) for reusing existing entities
 * - Backward exact (<-) for aggregation queries
 * - Backward fuzzy (<~) for semantic grounding
 *
 * Run with: npx tsx examples/09-startup-generator.ts
 */

import { DB, setProvider, createMemoryProvider, configureAIGeneration } from '../src/index.js'
import type { DatabaseSchema, CascadeProgress } from '../src/index.js'

async function main() {
  // Initialize provider
  setProvider(createMemoryProvider())

  // Enable AI generation
  configureAIGeneration({
    enabled: true,
    model: 'sonnet',
  })

  // Define the complete startup ecosystem schema
  const schema = {
    // ====================================
    // Reference Data (for semantic grounding)
    // ====================================

    // O*NET-style occupation data
    Occupation: {
      title: 'string',
      code: 'string', // O*NET SOC code
      description: 'string',
      category: 'string',
    },

    // NAICS-style industry data
    Industry: {
      name: 'string',
      code: 'string', // NAICS code
      description: 'string',
    },

    // Skills taxonomy
    Skill: {
      name: 'string',
      category: 'string',
      level: 'string', // beginner/intermediate/expert
    },

    // Common tools and software
    Tool: {
      name: 'string',
      category: 'string',
      description: 'string?',
    },

    // Market segments
    MarketSegment: {
      name: 'string',
      size: 'string', // SMB, Mid-Market, Enterprise
      description: 'string',
    },

    // ====================================
    // Core Startup Entities
    // ====================================

    Startup: {
      $instructions: 'Generate a B2B SaaS startup with a clear problem-solution fit',
      name: 'string',
      tagline: 'A compelling one-liner',
      description: 'What does this company do?',

      // Forward exact: Create the core problem
      problem: 'What problem does this startup solve? ->Problem',

      // Forward exact: Create founding team
      founders: ['Who are the founding team members? ->Founder'],

      // Forward fuzzy: Match to existing or create ICP
      targetCustomer: 'Who is the ideal customer? ~>IdealCustomerProfile',

      // Backward fuzzy: Ground to industry reference data
      industry: '<~Industry(0.7)',

      // Forward exact: Generate business model
      businessModel: 'What is the business model? ->BusinessModel',

      // Forward exact: Generate go-to-market strategy
      gtmStrategy: 'How will they go to market? ->GTMStrategy',

      // Backward reference for aggregation
      pitchDecks: ['<-PitchDeck.startup'],
    },

    Problem: {
      $instructions: 'A real business problem that affects {startup.targetCustomer}',
      statement: 'string',
      impact: 'What is the business impact?',
      currentSolutions: 'How do people solve this today?',
      painLevel: 'number', // 1-10

      // Forward exact: Generate solutions
      solutions: ['What are potential solutions? ->Solution'],

      // Backward reference
      startup: '<-Startup.problem',
    },

    Solution: {
      $instructions: 'A solution to {problem.statement}',
      approach: 'string',
      uniqueValue: 'What makes this unique?',
      technicalFeasibility: 'How technically feasible is this?',

      // Backward reference
      problem: '<-Problem.solutions',
    },

    Founder: {
      $instructions: 'A startup founder for {startup.name}',
      name: 'string',
      role: 'string', // CEO, CTO, etc.
      background: 'Relevant background and experience',

      // Backward fuzzy: Match to occupation reference
      expertise: '<~Occupation(0.6)',

      // Forward fuzzy: Match to skills
      skills: ['What skills do they bring? ~>Skill(0.5)'],

      // Backward reference
      startup: '<-Startup.founders',
    },

    IdealCustomerProfile: {
      $instructions: 'An ICP for a B2B SaaS product',

      // Grounded fields with backward fuzzy
      persona: '<~Occupation(0.7)', // Who they are
      industry: '<~Industry(0.7)', // Where they work

      // Generated fields
      title: 'string',
      companySize: 'string',
      budget: 'What is their budget?',
      painPoints: 'What are their main frustrations?',
      goals: 'What are they trying to achieve?',
      objections: 'What objections might they have?',

      // Forward fuzzy: Tools they use
      tools: ['What tools do they currently use? ~>Tool(0.5)'],

      // Forward fuzzy: Market segment
      segment: '~>MarketSegment(0.6)',
    },

    BusinessModel: {
      $instructions: 'A SaaS business model for {startup.name}',
      pricing: 'Pricing strategy (freemium, usage-based, seat-based, etc.)',
      revenue: 'Primary revenue streams',
      cac: 'Expected customer acquisition cost',
      ltv: 'Expected lifetime value',
      margins: 'Expected gross margins',

      // Forward exact: Generate pricing tiers
      tiers: ['What pricing tiers? ->PricingTier'],

      // Backward reference
      startup: '<-Startup.businessModel',
    },

    PricingTier: {
      $instructions: 'A pricing tier for {businessModel.startup.name}',
      name: 'string',
      price: 'string',
      billing: 'string', // monthly, annual
      features: 'Key features included',
      targetSegment: 'Who is this tier for?',

      // Backward reference
      businessModel: '<-BusinessModel.tiers',
    },

    GTMStrategy: {
      $instructions: 'Go-to-market strategy for {startup.name}',
      approach: 'string', // PLG, Sales-led, Hybrid
      channels: 'Primary acquisition channels',
      timeline: '12-month execution timeline',
      milestones: 'Key milestones to hit',

      // Forward exact: Generate campaigns
      campaigns: ['What marketing campaigns? ->Campaign'],

      // Backward reference
      startup: '<-Startup.gtmStrategy',
    },

    Campaign: {
      $instructions: 'A marketing campaign for {gtmStrategy.startup.name}',
      name: 'string',
      channel: 'string',
      objective: 'Campaign objective',
      budget: 'string',
      expectedROI: 'Expected return on investment',

      // Backward reference
      strategy: '<-GTMStrategy.campaigns',
    },

    PitchDeck: {
      $instructions: 'A pitch deck for {startup.name}',
      title: 'string',
      version: 'string',

      // Forward reference to startup
      startup: '->Startup',

      // Forward exact: Generate slides
      slides: ['What slides should be included? ->Slide'],
    },

    Slide: {
      $instructions: 'A slide for the pitch deck',
      title: 'string',
      type: 'string', // problem, solution, market, team, etc.
      content: 'Slide content summary',
      speakerNotes: 'What to say when presenting',

      // Backward reference
      deck: '<-PitchDeck.slides',
    },
  } as const satisfies DatabaseSchema

  const { db } = DB(schema)

  console.log('=== Startup Generator Example ===\n')

  // ====================================
  // Step 1: Seed Reference Data
  // ====================================
  console.log('--- Seeding Reference Data ---\n')

  // Seed occupations
  const occupations = [
    {
      title: 'Software Developer',
      code: '15-1252',
      description: 'Develops applications',
      category: 'Technology',
    },
    {
      title: 'DevOps Engineer',
      code: '15-1244',
      description: 'Manages infrastructure',
      category: 'Technology',
    },
    {
      title: 'Product Manager',
      code: '11-2021',
      description: 'Defines product vision',
      category: 'Management',
    },
    {
      title: 'Data Scientist',
      code: '15-2051',
      description: 'Analyzes data',
      category: 'Technology',
    },
    {
      title: 'Sales Manager',
      code: '11-2022',
      description: 'Leads sales teams',
      category: 'Sales',
    },
    {
      title: 'Marketing Manager',
      code: '11-2021',
      description: 'Drives marketing',
      category: 'Marketing',
    },
    {
      title: 'Engineering Manager',
      code: '11-9041',
      description: 'Leads engineers',
      category: 'Management',
    },
    {
      title: 'CTO',
      code: '11-1021',
      description: 'Chief Technology Officer',
      category: 'Executive',
    },
    {
      title: 'CEO',
      code: '11-1011',
      description: 'Chief Executive Officer',
      category: 'Executive',
    },
  ]

  for (const occ of occupations) {
    await db.Occupation.create(occ)
  }
  console.log(`Seeded ${occupations.length} occupations`)

  // Seed industries
  const industries = [
    { name: 'Software Publishers', code: '5112', description: 'Publish and distribute software' },
    { name: 'Data Processing', code: '5182', description: 'Data processing and hosting' },
    { name: 'Cloud Computing', code: '5415', description: 'Cloud infrastructure services' },
    { name: 'Fintech', code: '5239', description: 'Financial technology' },
    { name: 'Healthcare Technology', code: '5417', description: 'Healthcare software' },
    { name: 'E-commerce', code: '4541', description: 'Online retail' },
    { name: 'Cybersecurity', code: '5416', description: 'Security software and services' },
  ]

  for (const ind of industries) {
    await db.Industry.create(ind)
  }
  console.log(`Seeded ${industries.length} industries`)

  // Seed skills
  const skills = [
    { name: 'TypeScript', category: 'Programming', level: 'intermediate' },
    { name: 'Python', category: 'Programming', level: 'intermediate' },
    { name: 'Machine Learning', category: 'AI/ML', level: 'expert' },
    { name: 'Product Strategy', category: 'Business', level: 'expert' },
    { name: 'Sales Leadership', category: 'Sales', level: 'expert' },
    { name: 'Kubernetes', category: 'Infrastructure', level: 'intermediate' },
    { name: 'AWS', category: 'Cloud', level: 'intermediate' },
  ]

  for (const skill of skills) {
    await db.Skill.create(skill)
  }
  console.log(`Seeded ${skills.length} skills`)

  // Seed tools
  const tools = [
    { name: 'Slack', category: 'Communication', description: 'Team messaging' },
    { name: 'Jira', category: 'Project Management', description: 'Issue tracking' },
    { name: 'GitHub', category: 'Development', description: 'Code hosting' },
    { name: 'Salesforce', category: 'CRM', description: 'Customer relationship management' },
    { name: 'AWS', category: 'Cloud', description: 'Cloud infrastructure' },
    { name: 'Datadog', category: 'Monitoring', description: 'Application monitoring' },
  ]

  for (const tool of tools) {
    await db.Tool.create(tool)
  }
  console.log(`Seeded ${tools.length} tools`)

  // Seed market segments
  const segments = [
    { name: 'SMB', size: 'Small', description: '1-100 employees' },
    { name: 'Mid-Market', size: 'Medium', description: '100-1000 employees' },
    { name: 'Enterprise', size: 'Large', description: '1000+ employees' },
  ]

  for (const seg of segments) {
    await db.MarketSegment.create(seg)
  }
  console.log(`Seeded ${segments.length} market segments`)

  // ====================================
  // Step 2: Generate a Complete Startup
  // ====================================
  console.log('\n--- Generating Startup ---\n')

  const progressLog: string[] = []

  function onProgress(p: CascadeProgress) {
    const msg = `[${p.phase}] Depth ${p.depth}: ${p.currentType || 'root'}`
    progressLog.push(msg)
    if (p.phase !== 'complete') {
      console.log(msg)
    }
  }

  const startup = await db.Startup.create(
    {
      name: 'DevPilot',
      // Hint for industry grounding
      industryHint: 'Developer tools and software automation',
    },
    {
      cascade: true,
      maxDepth: 3,
      onProgress,
      onError: (err) => console.error('Generation error:', err.message),
    }
  )

  // ====================================
  // Step 3: Display Generated Startup
  // ====================================
  console.log('\n--- Generated Startup ---\n')

  console.log(`Name: ${startup.name}`)
  console.log(`Tagline: ${startup.tagline}`)
  console.log(`Description: ${startup.description}`)

  // Industry (grounded)
  const industry = await startup.industry
  console.log(`\nIndustry: ${industry?.name || 'Not grounded'} (${industry?.code || 'N/A'})`)

  // Problem
  const problem = await startup.problem
  console.log(`\nProblem:`)
  console.log(`  Statement: ${problem?.statement}`)
  console.log(`  Impact: ${problem?.impact}`)
  console.log(`  Pain Level: ${problem?.painLevel}/10`)

  // Solutions
  if (problem) {
    const solutions = await problem.solutions
    console.log(`\nSolutions (${solutions.length}):`)
    for (const sol of solutions) {
      console.log(`  - ${sol.approach}`)
      console.log(`    Unique Value: ${sol.uniqueValue}`)
    }
  }

  // Founders
  const founders = await startup.founders
  console.log(`\nFounders (${founders.length}):`)
  for (const founder of founders) {
    const expertise = await founder.expertise
    const skills = await founder.skills
    console.log(`  ${founder.name} (${founder.role})`)
    console.log(`    Background: ${founder.background?.substring(0, 60)}...`)
    console.log(`    Expertise: ${expertise?.title || 'Various'}`)
    console.log(`    Skills: ${skills.map((s: any) => s.name).join(', ')}`)
  }

  // Target Customer (ICP)
  const icp = await startup.targetCustomer
  if (icp) {
    const persona = await icp.persona
    const icpIndustry = await icp.industry
    const segment = await icp.segment
    const icpTools = await icp.tools

    console.log(`\nTarget Customer:`)
    console.log(`  Title: ${icp.title}`)
    console.log(`  Persona: ${persona?.title || 'Various'}`)
    console.log(`  Industry: ${icpIndustry?.name || 'Various'}`)
    console.log(`  Company Size: ${icp.companySize}`)
    console.log(`  Segment: ${segment?.name || 'Various'}`)
    console.log(`  Budget: ${icp.budget}`)
    console.log(`  Tools: ${icpTools.map((t: any) => t.name).join(', ')}`)
    console.log(`  Pain Points: ${icp.painPoints?.substring(0, 80)}...`)
  }

  // Business Model
  const businessModel = await startup.businessModel
  if (businessModel) {
    const tiers = await businessModel.tiers

    console.log(`\nBusiness Model:`)
    console.log(`  Pricing: ${businessModel.pricing}`)
    console.log(`  Revenue: ${businessModel.revenue}`)
    console.log(`  CAC: ${businessModel.cac}`)
    console.log(`  LTV: ${businessModel.ltv}`)
    console.log(`\n  Pricing Tiers (${tiers.length}):`)
    for (const tier of tiers) {
      console.log(`    - ${tier.name}: ${tier.price}`)
      console.log(`      Target: ${tier.targetSegment}`)
    }
  }

  // GTM Strategy
  const gtm = await startup.gtmStrategy
  if (gtm) {
    const campaigns = await gtm.campaigns

    console.log(`\nGo-to-Market Strategy:`)
    console.log(`  Approach: ${gtm.approach}`)
    console.log(`  Channels: ${gtm.channels}`)
    console.log(`  Timeline: ${gtm.timeline?.substring(0, 80)}...`)
    console.log(`\n  Campaigns (${campaigns.length}):`)
    for (const campaign of campaigns) {
      console.log(`    - ${campaign.name} (${campaign.channel})`)
      console.log(`      Budget: ${campaign.budget}, Expected ROI: ${campaign.expectedROI}`)
    }
  }

  // ====================================
  // Step 4: Generate a Pitch Deck
  // ====================================
  console.log('\n--- Generating Pitch Deck ---\n')

  const pitchDeck = await db.PitchDeck.create(
    {
      title: `${startup.name} - Series A Pitch`,
      version: 'v1.0',
      startup: startup.$id,
    },
    {
      cascade: true,
      maxDepth: 1,
    }
  )

  const slides = await pitchDeck.slides
  console.log(`Generated pitch deck with ${slides.length} slides:`)
  for (const slide of slides) {
    console.log(`  ${slide.type}: ${slide.title}`)
  }

  // ====================================
  // Step 5: Statistics
  // ====================================
  console.log('\n--- Generation Statistics ---\n')

  const allStartups = await db.Startup.list()
  const allFounders = await db.Founder.list()
  const allProblems = await db.Problem.list()
  const allSolutions = await db.Solution.list()
  const allICPs = await db.IdealCustomerProfile.list()
  const allCampaigns = await db.Campaign.list()
  const allSlides = await db.Slide.list()

  console.log(`Startups: ${allStartups.length}`)
  console.log(`Founders: ${allFounders.length}`)
  console.log(`Problems: ${allProblems.length}`)
  console.log(`Solutions: ${allSolutions.length}`)
  console.log(`ICPs: ${allICPs.length}`)
  console.log(`Campaigns: ${allCampaigns.length}`)
  console.log(`Pitch Slides: ${allSlides.length}`)
  console.log(`\nProgress events: ${progressLog.length}`)

  console.log('\n=== Startup Generator Example Complete ===')
}

main().catch(console.error)
