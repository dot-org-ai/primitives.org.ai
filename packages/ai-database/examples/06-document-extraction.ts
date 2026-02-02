/**
 * Document Extraction Example - ai-database
 *
 * This example demonstrates extracting structured data from documents:
 * - AI-powered entity extraction from unstructured text
 * - Two-phase draft/resolve workflow
 * - Semantic grounding for extracted entities
 * - Relationship inference between extracted entities
 *
 * Run with: npx tsx examples/06-document-extraction.ts
 */

import { DB, setProvider, createMemoryProvider, configureAIGeneration } from '../src/index.js'
import type { DatabaseSchema } from '../src/index.js'

async function main() {
  // Initialize provider
  setProvider(createMemoryProvider())

  // Enable AI generation for extraction
  configureAIGeneration({
    enabled: true,
    model: 'sonnet',
  })

  // Define schema for document extraction
  const schema = {
    // Source documents
    Document: {
      title: 'string',
      source: 'string', // URL, file path, or document ID
      content: 'markdown',
      extractedAt: 'datetime?',
      // Extracted entities (backward references)
      people: ['<-Person.sourceDocument'],
      companies: ['<-Company.sourceDocument'],
      events: ['<-Event.sourceDocument'],
      relationships: ['<-ExtractedRelationship.sourceDocument'],
    },

    // Extracted person entities
    Person: {
      $instructions: 'Extract person information from the source document',
      name: 'string',
      role: 'string?',
      email: 'string?',
      organization: 'string?',
      // Ground against existing known people
      knownPerson: '<~KnownPerson(0.8)?',
      // Link to source
      sourceDocument: '->Document',
      confidence: 'number', // 0-1 extraction confidence
    },

    // Extracted company entities
    Company: {
      $instructions: 'Extract company/organization information',
      name: 'string',
      industry: 'string?',
      description: 'string?',
      website: 'url?',
      // Ground against known companies
      knownCompany: '<~KnownCompany(0.8)?',
      sourceDocument: '->Document',
      confidence: 'number',
    },

    // Extracted events
    Event: {
      $instructions: 'Extract event or meeting information',
      name: 'string',
      date: 'datetime?',
      location: 'string?',
      description: 'string',
      participants: ['~>Person'],
      sourceDocument: '->Document',
      confidence: 'number',
    },

    // Extracted relationships between entities
    ExtractedRelationship: {
      type: 'string', // 'works_at', 'partners_with', 'invested_in', etc.
      fromEntity: 'string', // Reference to extracted entity
      toEntity: 'string',
      description: 'string',
      sourceDocument: '->Document',
      confidence: 'number',
    },

    // Known entities for grounding (reference data)
    KnownPerson: {
      name: 'string',
      email: 'string?',
      linkedIn: 'url?',
      company: 'string?',
    },

    KnownCompany: {
      name: 'string',
      website: 'url?',
      industry: 'string?',
      headquarters: 'string?',
    },

    // Extraction job tracking
    ExtractionJob: {
      document: '->Document',
      status: 'string', // 'pending', 'processing', 'completed', 'failed'
      startedAt: 'datetime?',
      completedAt: 'datetime?',
      entitiesExtracted: 'number',
      errors: 'json?',
    },
  } as const satisfies DatabaseSchema

  const { db, actions } = DB(schema)

  console.log('=== Document Extraction Example ===\n')

  // Step 1: Seed known entities for grounding
  console.log('--- Seeding Known Entities ---\n')

  const knownPeople = [
    {
      name: 'Elon Musk',
      email: null,
      linkedIn: 'https://linkedin.com/in/elonmusk',
      company: 'Tesla, SpaceX',
    },
    {
      name: 'Satya Nadella',
      email: null,
      linkedIn: 'https://linkedin.com/in/satyanadella',
      company: 'Microsoft',
    },
    {
      name: 'Sundar Pichai',
      email: null,
      linkedIn: 'https://linkedin.com/in/sundarpichai',
      company: 'Google',
    },
    {
      name: 'Tim Cook',
      email: null,
      linkedIn: 'https://linkedin.com/in/timcook',
      company: 'Apple',
    },
  ]

  for (const person of knownPeople) {
    await db.KnownPerson.create(person)
  }
  console.log(`Seeded ${knownPeople.length} known people`)

  const knownCompanies = [
    {
      name: 'Microsoft Corporation',
      website: 'https://microsoft.com',
      industry: 'Technology',
      headquarters: 'Redmond, WA',
    },
    {
      name: 'Google LLC',
      website: 'https://google.com',
      industry: 'Technology',
      headquarters: 'Mountain View, CA',
    },
    {
      name: 'Apple Inc.',
      website: 'https://apple.com',
      industry: 'Technology',
      headquarters: 'Cupertino, CA',
    },
    {
      name: 'Tesla, Inc.',
      website: 'https://tesla.com',
      industry: 'Automotive/Energy',
      headquarters: 'Austin, TX',
    },
    {
      name: 'Amazon.com, Inc.',
      website: 'https://amazon.com',
      industry: 'E-commerce/Cloud',
      headquarters: 'Seattle, WA',
    },
  ]

  for (const company of knownCompanies) {
    await db.KnownCompany.create(company)
  }
  console.log(`Seeded ${knownCompanies.length} known companies`)

  // Step 2: Create sample documents to extract
  console.log('\n--- Creating Documents for Extraction ---\n')

  const documents = [
    {
      title: 'Tech Industry Partnership Announcement',
      source: 'press-release-001',
      content: `# Microsoft and OpenAI Extend Partnership

**January 23, 2024** - Satya Nadella, CEO of Microsoft, announced today a multi-year
extension of the partnership with OpenAI. The deal, valued at several billion dollars,
will see Microsoft continue to provide cloud infrastructure for OpenAI's research.

"This partnership represents our commitment to responsible AI development," said Nadella
in a press conference held at Microsoft's Redmond headquarters.

Sam Altman, CEO of OpenAI, expressed enthusiasm: "Working with Microsoft allows us to
pursue our mission of ensuring AI benefits all of humanity."

Key highlights:
- Extended Azure cloud computing resources
- Joint research initiatives
- Enterprise AI product development
- AI safety collaboration

Contact: press@microsoft.com`,
    },
    {
      title: 'Startup Funding Round News',
      source: 'techcrunch-article-042',
      content: `# AI Startup DeepMind Spinoff Raises $100M

A new AI startup founded by former DeepMind researchers has closed a $100 million
Series A funding round.

The company, called NeuralForge, was founded by:
- Dr. Sarah Chen (CEO) - Former DeepMind research lead
- James Wilson (CTO) - Ex-Google Brain engineer
- Maria Rodriguez (COO) - Previously at Anthropic

The round was led by Andreessen Horowitz with participation from:
- Sequoia Capital
- Index Ventures
- Google Ventures

NeuralForge is developing next-generation language models for enterprise applications.
The company plans to hire 50 engineers by end of year.

For more info: contact@neuralforge.ai
Headquarters: San Francisco, CA`,
    },
    {
      title: 'Industry Conference Schedule',
      source: 'event-calendar-2024',
      content: `# AI Summit 2024 - Event Schedule

**Date:** March 15-17, 2024
**Location:** Moscone Center, San Francisco

## Day 1 - March 15
- 9:00 AM - Opening Keynote: Sundar Pichai (Google CEO)
- 11:00 AM - Panel: "Future of Generative AI"
  - Participants: Dario Amodei (Anthropic), Demis Hassabis (DeepMind)
- 2:00 PM - Workshop: LLM Fine-tuning Best Practices
- 4:00 PM - Networking Reception

## Day 2 - March 16
- 9:00 AM - Keynote: Jensen Huang (NVIDIA CEO)
- 11:00 AM - Technical Deep Dive: Transformer Architectures
- 2:00 PM - Startup Pitch Competition
- 6:00 PM - Gala Dinner at City Hall

## Day 3 - March 17
- 9:00 AM - Closing Keynote: Tim Cook (Apple CEO)
- 12:00 PM - Conference Close

Register: events@aisummit.com`,
    },
  ]

  const createdDocs = []
  for (const doc of documents) {
    const created = await db.Document.create(doc)
    createdDocs.push(created)
    console.log(`Created document: ${doc.title}`)
  }

  // Step 3: Extract entities from documents
  console.log('\n--- Extracting Entities ---\n')

  async function extractFromDocument(document: any) {
    console.log(`\nProcessing: ${document.title}`)
    console.log('-'.repeat(50))

    // Create extraction job
    const job = await db.ExtractionJob.create({
      document: document.$id,
      status: 'processing',
      startedAt: new Date(),
      entitiesExtracted: 0,
    })

    // Simulated entity extraction (in production, call your LLM)
    const extractedData = simulateExtraction(document.content)

    // Extract people
    let entityCount = 0
    for (const person of extractedData.people) {
      const p = await db.Person.create({
        ...person,
        sourceDocument: document.$id,
        // Hint for semantic grounding
        knownPersonHint: person.name,
      })

      // Check if grounded to known person
      const grounded = await p.knownPerson
      if (grounded) {
        console.log(`  Person: ${person.name} -> Grounded to: ${grounded.name}`)
      } else {
        console.log(`  Person: ${person.name} (new)`)
      }
      entityCount++
    }

    // Extract companies
    for (const company of extractedData.companies) {
      const c = await db.Company.create({
        ...company,
        sourceDocument: document.$id,
        knownCompanyHint: company.name,
      })

      const grounded = await c.knownCompany
      if (grounded) {
        console.log(`  Company: ${company.name} -> Grounded to: ${grounded.name}`)
      } else {
        console.log(`  Company: ${company.name} (new)`)
      }
      entityCount++
    }

    // Extract events
    for (const event of extractedData.events) {
      await db.Event.create({
        ...event,
        sourceDocument: document.$id,
      })
      console.log(`  Event: ${event.name}`)
      entityCount++
    }

    // Extract relationships
    for (const rel of extractedData.relationships) {
      await db.ExtractedRelationship.create({
        ...rel,
        sourceDocument: document.$id,
      })
      console.log(`  Relationship: ${rel.fromEntity} --[${rel.type}]--> ${rel.toEntity}`)
      entityCount++
    }

    // Update job
    await db.ExtractionJob.update(job.$id, {
      status: 'completed',
      completedAt: new Date(),
      entitiesExtracted: entityCount,
    })

    console.log(`  Total entities extracted: ${entityCount}`)

    // Update document
    await db.Document.update(document.$id, {
      extractedAt: new Date(),
    })
  }

  // Simulated extraction logic (replace with actual LLM extraction)
  function simulateExtraction(content: string) {
    const result = {
      people: [] as any[],
      companies: [] as any[],
      events: [] as any[],
      relationships: [] as any[],
    }

    // Simple pattern matching for demo
    // In production, use LLM for intelligent extraction

    // Extract people mentioned
    if (content.includes('Satya Nadella')) {
      result.people.push({
        name: 'Satya Nadella',
        role: 'CEO',
        organization: 'Microsoft',
        confidence: 0.95,
      })
    }
    if (content.includes('Sam Altman')) {
      result.people.push({
        name: 'Sam Altman',
        role: 'CEO',
        organization: 'OpenAI',
        confidence: 0.95,
      })
    }
    if (content.includes('Sundar Pichai')) {
      result.people.push({
        name: 'Sundar Pichai',
        role: 'CEO',
        organization: 'Google',
        confidence: 0.95,
      })
    }
    if (content.includes('Tim Cook')) {
      result.people.push({ name: 'Tim Cook', role: 'CEO', organization: 'Apple', confidence: 0.95 })
    }
    if (content.includes('Dr. Sarah Chen')) {
      result.people.push({
        name: 'Dr. Sarah Chen',
        role: 'CEO',
        organization: 'NeuralForge',
        confidence: 0.9,
      })
    }
    if (content.includes('James Wilson')) {
      result.people.push({
        name: 'James Wilson',
        role: 'CTO',
        organization: 'NeuralForge',
        confidence: 0.9,
      })
    }

    // Extract companies
    if (content.includes('Microsoft')) {
      result.companies.push({ name: 'Microsoft', industry: 'Technology', confidence: 0.95 })
    }
    if (content.includes('OpenAI')) {
      result.companies.push({ name: 'OpenAI', industry: 'AI Research', confidence: 0.95 })
    }
    if (content.includes('NeuralForge')) {
      result.companies.push({
        name: 'NeuralForge',
        industry: 'AI/ML',
        description: 'AI startup for enterprise LLMs',
        confidence: 0.85,
      })
    }
    if (content.includes('Andreessen Horowitz')) {
      result.companies.push({
        name: 'Andreessen Horowitz',
        industry: 'Venture Capital',
        confidence: 0.9,
      })
    }

    // Extract events
    if (content.includes('AI Summit 2024')) {
      result.events.push({
        name: 'AI Summit 2024',
        date: new Date('2024-03-15'),
        location: 'Moscone Center, San Francisco',
        description: 'Major AI industry conference',
        confidence: 0.95,
      })
    }
    if (content.includes('press conference')) {
      result.events.push({
        name: 'Microsoft-OpenAI Partnership Announcement',
        date: new Date('2024-01-23'),
        location: 'Redmond, WA',
        description: 'Press conference announcing partnership extension',
        confidence: 0.85,
      })
    }

    // Extract relationships
    if (content.includes('partnership')) {
      result.relationships.push({
        type: 'partners_with',
        fromEntity: 'Microsoft',
        toEntity: 'OpenAI',
        description: 'Multi-year cloud computing partnership',
        confidence: 0.9,
      })
    }
    if (content.includes('funding round')) {
      result.relationships.push({
        type: 'invested_in',
        fromEntity: 'Andreessen Horowitz',
        toEntity: 'NeuralForge',
        description: 'Led $100M Series A round',
        confidence: 0.9,
      })
    }

    return result
  }

  // Process all documents
  for (const doc of createdDocs) {
    await extractFromDocument(doc)
  }

  // Step 4: Query extracted data
  console.log('\n--- Querying Extracted Data ---\n')

  // Get all extracted people
  const allPeople = await db.Person.list()
  console.log(`Total people extracted: ${allPeople.length}`)

  // Group by organization
  const byOrg = new Map<string, string[]>()
  for (const person of allPeople) {
    const org = (person.organization as string) || 'Unknown'
    if (!byOrg.has(org)) byOrg.set(org, [])
    byOrg.get(org)!.push(person.name as string)
  }

  console.log('\nPeople by Organization:')
  for (const [org, people] of byOrg) {
    console.log(`  ${org}: ${people.join(', ')}`)
  }

  // Get all companies
  const allCompanies = await db.Company.list()
  console.log(`\nTotal companies extracted: ${allCompanies.length}`)

  // Get all relationships
  const allRelationships = await db.ExtractedRelationship.list()
  console.log('\nExtracted Relationships:')
  for (const rel of allRelationships) {
    console.log(`  ${rel.fromEntity} --[${rel.type}]--> ${rel.toEntity}`)
  }

  // Step 5: Show document statistics
  console.log('\n--- Extraction Statistics ---\n')

  for (const doc of createdDocs) {
    const people = await doc.people
    const companies = await doc.companies
    const events = await doc.events
    const relationships = await doc.relationships

    console.log(`${doc.title}:`)
    console.log(`  People: ${people.length}, Companies: ${companies.length}`)
    console.log(`  Events: ${events.length}, Relationships: ${relationships.length}`)
  }

  // Get extraction jobs
  const jobs = await db.ExtractionJob.list()
  const completed = jobs.filter((j) => j.status === 'completed')
  const totalExtracted = completed.reduce((sum, j) => sum + (j.entitiesExtracted as number), 0)

  console.log(`\nExtraction Jobs: ${completed.length}/${jobs.length} completed`)
  console.log(`Total Entities Extracted: ${totalExtracted}`)

  console.log('\n=== Document Extraction Example Complete ===')
}

main().catch(console.error)
