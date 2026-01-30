import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DB, setProvider, createMemoryProvider, configureAIGeneration } from './src/index.js'
import { parquetWriteBuffer } from 'hyparquet-writer'

setProvider(createMemoryProvider())
configureAIGeneration({ enabled: true, model: 'sonnet' })

// Output directory for generated data (within this repo)
const DATA_DIR = join(import.meta.dirname, 'data', 'cascade')

const { db } = DB({
  Task: {
    $instructions: 'A business task that could be improved with software',
    title: 'string',
    digital: 'Digital | Physical | Hybrid',
    problems: ['What problems exist? ->Problem'],
  },
  Problem: {
    $instructions: 'A specific pain point that costs time or money',
    task: '<-Task',
    description: 'What is the problem?',
    painLevel: 'Low | Medium | High | Critical',
    frequency: 'Rare | Occasional | Frequent | Constant',
    solutions: ['How could this be solved? ->Solution'],
  },
  Solution: {
    $instructions: 'A potential solution approach',
    problem: '<-Problem',
    name: 'string',
    description: 'How does this solution work?',
    approach: 'Automation | Augmentation | Optimization | Elimination',
    headlessSaaS: '->HeadlessSaaS',
  },
  HeadlessSaaS: {
    $instructions: 'An agent-first SaaS product (APIs not UIs)',
    solution: '<-Solution',
    existingSaaS: 'What human SaaS does this replace?',
    differentiator: 'Why is agent-first better?',
    agentNeeds: ['What do AI agents need that humans dont?'],
    icps: ['Who would buy this? ->ICP'],
  },
  ICP: {
    $instructions: 'An Ideal Customer Profile',
    product: '<-HeadlessSaaS',
    as: 'Who are they? (role)',
    at: 'Where do they work? (company type)',
    to: 'What goal are they trying to achieve?',
  },
})

// Serialize entity for Parquet (flatten and stringify complex values)
function serializeForParquet(
  entity: Record<string, unknown>
): Record<string, string | number | boolean | null> {
  const result: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(entity)) {
    if (key.startsWith('_pending_')) continue
    if (value === null || value === undefined) {
      result[key] = null
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      result[key] = value
    } else if (value instanceof Date) {
      result[key] = value.toISOString()
    } else if (Array.isArray(value)) {
      // Serialize arrays as JSON strings
      result[key] = JSON.stringify(
        value.map((v) => {
          if (v && typeof v === 'object' && '$id' in v) return (v as Record<string, unknown>).$id
          if (v && typeof v === 'object' && Object.keys(v).length === 0) return null
          return v
        })
      )
    } else if (typeof value === 'object') {
      // Handle proxy objects (relations)
      const obj = value as Record<string, unknown>
      if ('$id' in obj) {
        result[key] = obj.$id as string
      } else if (Object.keys(obj).length === 0) {
        result[key] = null
      } else {
        result[key] = JSON.stringify(value)
      }
    }
  }
  return result
}

// Convert rows to columnar format for Parquet
function rowsToColumns(
  rows: Record<string, string | number | boolean | null>[]
): Array<{ name: string; data: (string | number | boolean | null)[]; type: string }> {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return []

  // Get all unique keys across all rows
  const keys = new Set<string>()
  for (const row of rows) {
    if (row && typeof row === 'object') {
      for (const key of Object.keys(row)) {
        keys.add(key)
      }
    }
  }

  // Create column data
  return Array.from(keys).map((key) => {
    const data = rows.map((row) => row[key] ?? null)
    // Infer type from first non-null value
    const firstValue = data.find((v) => v !== null)
    let type = 'STRING'
    if (typeof firstValue === 'number') {
      type = Number.isInteger(firstValue) ? 'INT64' : 'DOUBLE'
    } else if (typeof firstValue === 'boolean') {
      type = 'BOOLEAN'
    }
    return { name: key, data, type }
  })
}

// Write entities to Parquet file
function writeParquet(filename: string, entities: Record<string, unknown>[]) {
  if (!entities || entities.length === 0) return

  // Convert to plain array if needed (handles proxy objects)
  const entitiesArray = Array.isArray(entities)
    ? [...entities]
    : Array.from(entities as Iterable<Record<string, unknown>>)
  const rows = entitiesArray.map((e) => serializeForParquet(e as Record<string, unknown>))
  const columnData = rowsToColumns(rows)
  const buffer = parquetWriteBuffer({ columnData })
  writeFileSync(join(DATA_DIR, filename), Buffer.from(buffer))
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('              STARTUP CASCADE - AI GENERATED CONTENT            ')
  console.log('═══════════════════════════════════════════════════════════════\n')

  const task = await db.Task.create(
    { title: 'Customer Support Ticket Routing', digital: 'Digital' },
    {
      cascade: true,
      maxDepth: 4,
      onProgress: (p) =>
        console.log(
          `[Depth ${p.currentDepth}] Creating ${p.currentType}... (${p.totalEntitiesCreated} total)`
        ),
      onError: (err) => console.error('Cascade error:', err),
    }
  )

  // Fetch all entities
  const tasks = await db.Task.list()
  const problems = await db.Problem.list()
  const solutions = await db.Solution.list()
  const products = await db.HeadlessSaaS.list()
  const icps = await db.ICP.list()

  console.log('─────────────────────────────────────────────────────────────────')
  console.log('TASK')
  console.log('─────────────────────────────────────────────────────────────────')
  for (const t of tasks) {
    console.log('  Title:', t.title)
    console.log('  Digital:', t.digital)
  }

  console.log('\n─────────────────────────────────────────────────────────────────')
  console.log('PROBLEM')
  console.log('─────────────────────────────────────────────────────────────────')
  for (const p of problems) {
    console.log('  Description:', p.description)
    console.log('  Pain Level:', p.painLevel)
    console.log('  Frequency:', p.frequency)
  }

  console.log('\n─────────────────────────────────────────────────────────────────')
  console.log('SOLUTION')
  console.log('─────────────────────────────────────────────────────────────────')
  for (const s of solutions) {
    console.log('  Name:', s.name)
    console.log('  Description:', s.description)
    console.log('  Approach:', s.approach)
  }

  console.log('\n─────────────────────────────────────────────────────────────────')
  console.log('HEADLESS SAAS')
  console.log('─────────────────────────────────────────────────────────────────')
  for (const h of products) {
    console.log('  Existing SaaS:', h.existingSaaS)
    console.log('  Differentiator:', h.differentiator)
    console.log('  Agent Needs:', h.agentNeeds)
  }

  console.log('\n─────────────────────────────────────────────────────────────────')
  console.log('ICP (Ideal Customer Profile)')
  console.log('─────────────────────────────────────────────────────────────────')
  for (const i of icps) {
    console.log('  As:', i.as)
    console.log('  At:', i.at)
    console.log('  To:', i.to)
  }

  console.log('\n═══════════════════════════════════════════════════════════════')
  console.log(
    'Total:',
    tasks.length,
    'Task,',
    problems.length,
    'Problem,',
    solutions.length,
    'Solution,',
    products.length,
    'HeadlessSaaS,',
    icps.length,
    'ICP'
  )
  console.log('═══════════════════════════════════════════════════════════════')

  // Save to Parquet files
  console.log('\n─────────────────────────────────────────────────────────────────')
  console.log('SAVING TO PARQUET:', DATA_DIR)
  console.log('─────────────────────────────────────────────────────────────────')

  try {
    mkdirSync(DATA_DIR, { recursive: true })

    writeParquet('tasks.parquet', tasks as Record<string, unknown>[])
    console.log(`  ✓ tasks.parquet (${tasks.length} rows)`)

    writeParquet('problems.parquet', problems as Record<string, unknown>[])
    console.log(`  ✓ problems.parquet (${problems.length} rows)`)

    writeParquet('solutions.parquet', solutions as Record<string, unknown>[])
    console.log(`  ✓ solutions.parquet (${solutions.length} rows)`)

    writeParquet('headless-saas.parquet', products as Record<string, unknown>[])
    console.log(`  ✓ headless-saas.parquet (${products.length} rows)`)

    writeParquet('icps.parquet', icps as Record<string, unknown>[])
    console.log(`  ✓ icps.parquet (${icps.length} rows)`)

    console.log('\n  All entities saved to Parquet format!')
  } catch (err) {
    console.error('  Failed to save:', err)
  }
}

main().catch(console.error)
