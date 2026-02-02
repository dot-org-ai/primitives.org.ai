/**
 * Example: Scheduled Reporting with Dependency Chains
 *
 * This example demonstrates scheduled tasks with complex dependencies using
 * the DependencyGraph for execution ordering and barriers for synchronization.
 *
 * Workflow:
 * 1. Fetch data from multiple sources (parallel)
 * 2. Transform and aggregate data (depends on fetch)
 * 3. Generate reports (depends on aggregation)
 * 4. Distribute reports (depends on generation)
 *
 * Key concepts demonstrated:
 * - $.every for scheduled execution
 * - DependencyGraph for step ordering
 * - topologicalSort for execution planning
 * - getExecutionLevels for parallel grouping
 * - waitForAll and Barrier for synchronization
 * - withConcurrencyLimit for controlled parallelism
 *
 * @example
 * ```bash
 * npx tsx examples/03-scheduled-reporting-dependencies.ts
 * ```
 */

import {
  Workflow,
  DependencyGraph,
  topologicalSort,
  getExecutionLevels,
  waitForAll,
  Barrier,
  withConcurrencyLimit,
  type WorkflowContext,
} from '../dist/index.js'

// ============================================================================
// Type Definitions
// ============================================================================

interface DataSource {
  id: string
  name: string
  type: 'database' | 'api' | 'file'
}

interface FetchedData {
  sourceId: string
  records: Array<{ id: string; value: number; timestamp: number }>
  fetchedAt: number
}

interface AggregatedMetrics {
  period: string
  totalRecords: number
  sumValues: number
  avgValue: number
  sources: string[]
}

interface Report {
  id: string
  type: 'daily' | 'weekly' | 'monthly'
  metrics: AggregatedMetrics
  generatedAt: number
}

interface DistributionResult {
  reportId: string
  channel: string
  success: boolean
  deliveredAt?: number
}

// ============================================================================
// Mock Data Sources
// ============================================================================

const dataSources: DataSource[] = [
  { id: 'sales-db', name: 'Sales Database', type: 'database' },
  { id: 'crm-api', name: 'CRM API', type: 'api' },
  { id: 'inventory-file', name: 'Inventory Export', type: 'file' },
  { id: 'analytics-api', name: 'Analytics Service', type: 'api' },
]

// ============================================================================
// Mock Services
// ============================================================================

const dataService = {
  async fetchFromSource(source: DataSource): Promise<FetchedData> {
    // Simulate varying fetch times
    const delay = 50 + Math.random() * 100
    await new Promise((resolve) => setTimeout(resolve, delay))

    console.log(`    [Fetch] ${source.name} (${delay.toFixed(0)}ms)`)

    return {
      sourceId: source.id,
      records: Array.from({ length: 10 + Math.floor(Math.random() * 20) }, (_, i) => ({
        id: `${source.id}-${i}`,
        value: Math.random() * 1000,
        timestamp: Date.now() - Math.random() * 86400000,
      })),
      fetchedAt: Date.now(),
    }
  },
}

const aggregationService = {
  async aggregate(data: FetchedData[], period: string): Promise<AggregatedMetrics> {
    await new Promise((resolve) => setTimeout(resolve, 30))

    const allRecords = data.flatMap((d) => d.records)
    const sum = allRecords.reduce((acc, r) => acc + r.value, 0)

    return {
      period,
      totalRecords: allRecords.length,
      sumValues: sum,
      avgValue: sum / allRecords.length,
      sources: data.map((d) => d.sourceId),
    }
  },
}

const reportService = {
  async generateReport(
    type: 'daily' | 'weekly' | 'monthly',
    metrics: AggregatedMetrics
  ): Promise<Report> {
    await new Promise((resolve) => setTimeout(resolve, 50))

    return {
      id: `report-${type}-${Date.now()}`,
      type,
      metrics,
      generatedAt: Date.now(),
    }
  },
}

const distributionService = {
  async distribute(report: Report, channel: 'email' | 'slack' | 's3'): Promise<DistributionResult> {
    await new Promise((resolve) => setTimeout(resolve, 30))

    return {
      reportId: report.id,
      channel,
      success: true,
      deliveredAt: Date.now(),
    }
  },
}

// ============================================================================
// Dependency Graph Setup
// ============================================================================

function createReportingPipeline(): DependencyGraph {
  const graph = new DependencyGraph()

  // Level 0: Data fetching (no dependencies, run in parallel)
  graph.addNode('fetch-sales')
  graph.addNode('fetch-crm')
  graph.addNode('fetch-inventory')
  graph.addNode('fetch-analytics')

  // Level 1: Aggregation (depends on all fetches)
  graph.addNode('aggregate-data', {
    dependsOn: ['fetch-sales', 'fetch-crm', 'fetch-inventory', 'fetch-analytics'],
  })

  // Level 2: Report generation (depends on aggregation)
  graph.addNode('generate-daily-report', { dependsOn: 'aggregate-data' })
  graph.addNode('generate-summary', { dependsOn: 'aggregate-data' })

  // Level 3: Distribution (depends on report generation)
  graph.addNode('distribute-email', { dependsOn: 'generate-daily-report' })
  graph.addNode('distribute-slack', { dependsOn: 'generate-daily-report' })
  graph.addNode('archive-s3', { dependsOn: ['generate-daily-report', 'generate-summary'] })

  return graph
}

// ============================================================================
// Pipeline Executor
// ============================================================================

async function executePipeline(
  graph: DependencyGraph,
  $: WorkflowContext
): Promise<Map<string, unknown>> {
  const results = new Map<string, unknown>()
  const levels = getExecutionLevels(
    graph.getNodes().map((n) => ({ id: n.id, dependencies: n.dependencies }))
  )

  $.log(`Executing pipeline with ${levels.length} levels`)

  for (const level of levels) {
    $.log(`Level ${level.level}: ${level.nodes.join(', ')}`)

    // Execute all nodes at this level in parallel
    const levelResults = await Promise.all(
      level.nodes.map(async (nodeId) => {
        const result = await executeStep(nodeId, results, $)
        return { nodeId, result }
      })
    )

    // Store results
    for (const { nodeId, result } of levelResults) {
      results.set(nodeId, result)
    }
  }

  return results
}

async function executeStep(
  stepId: string,
  previousResults: Map<string, unknown>,
  $: WorkflowContext
): Promise<unknown> {
  switch (stepId) {
    // Fetch steps
    case 'fetch-sales':
      return dataService.fetchFromSource(dataSources[0]!)
    case 'fetch-crm':
      return dataService.fetchFromSource(dataSources[1]!)
    case 'fetch-inventory':
      return dataService.fetchFromSource(dataSources[2]!)
    case 'fetch-analytics':
      return dataService.fetchFromSource(dataSources[3]!)

    // Aggregation
    case 'aggregate-data': {
      const fetchedData = [
        previousResults.get('fetch-sales'),
        previousResults.get('fetch-crm'),
        previousResults.get('fetch-inventory'),
        previousResults.get('fetch-analytics'),
      ].filter(Boolean) as FetchedData[]

      $.log(`  Aggregating ${fetchedData.length} data sources`)
      return aggregationService.aggregate(fetchedData, 'daily')
    }

    // Report generation
    case 'generate-daily-report': {
      const metrics = previousResults.get('aggregate-data') as AggregatedMetrics
      $.log(`  Generating daily report`)
      return reportService.generateReport('daily', metrics)
    }
    case 'generate-summary': {
      const metrics = previousResults.get('aggregate-data') as AggregatedMetrics
      $.log(`  Generating summary report`)
      return reportService.generateReport('weekly', metrics)
    }

    // Distribution
    case 'distribute-email': {
      const report = previousResults.get('generate-daily-report') as Report
      $.log(`  Distributing via email`)
      return distributionService.distribute(report, 'email')
    }
    case 'distribute-slack': {
      const report = previousResults.get('generate-daily-report') as Report
      $.log(`  Distributing via Slack`)
      return distributionService.distribute(report, 'slack')
    }
    case 'archive-s3': {
      const report = previousResults.get('generate-daily-report') as Report
      $.log(`  Archiving to S3`)
      return distributionService.distribute(report, 's3')
    }

    default:
      throw new Error(`Unknown step: ${stepId}`)
  }
}

// ============================================================================
// Barrier Example: Parallel Data Collection
// ============================================================================

async function collectDataWithBarrier($: WorkflowContext): Promise<FetchedData[]> {
  $.log('Starting parallel data collection with barrier...')

  const barrier = new Barrier<FetchedData>(dataSources.length, {
    timeout: 5000,
    onProgress: (progress) => {
      $.log(
        `  Collection progress: ${progress.arrived}/${progress.expected} (${progress.percentage}%)`
      )
    },
  })

  // Start all fetches
  const fetchPromises = dataSources.map(async (source) => {
    const data = await dataService.fetchFromSource(source)
    barrier.arrive(data)
    return data
  })

  // Wait for all to complete
  const results = await barrier.wait()
  $.log(`Barrier complete: collected ${results.length} datasets`)

  return results
}

// ============================================================================
// Concurrency Control Example
// ============================================================================

async function distributeToBulkRecipients(
  report: Report,
  recipients: string[],
  $: WorkflowContext
): Promise<DistributionResult[]> {
  $.log(`Distributing to ${recipients.length} recipients with concurrency limit...`)

  // Create distribution tasks
  const tasks = recipients.map((recipient) => async () => {
    await new Promise((resolve) => setTimeout(resolve, 20)) // Simulate network
    return {
      reportId: report.id,
      channel: 'email' as const,
      success: true,
      deliveredAt: Date.now(),
    }
  })

  // Execute with max 3 concurrent operations
  const results = await withConcurrencyLimit<DistributionResult>(tasks, 3, {
    collectErrors: true,
  })

  const successful = results.filter((r) => !(r instanceof Error)).length
  $.log(`Distributed to ${successful}/${recipients.length} recipients`)

  return results as DistributionResult[]
}

// ============================================================================
// Scheduled Workflow
// ============================================================================

function createScheduledReportingWorkflow() {
  const graph = createReportingPipeline()

  const workflow = Workflow(($) => {
    // Show graph structure
    $.log('Pipeline dependency graph created:')
    const levels = getExecutionLevels(
      graph.getNodes().map((n) => ({ id: n.id, dependencies: n.dependencies }))
    )
    for (const level of levels) {
      $.log(`  Level ${level.level}: ${level.nodes.join(', ')}`)
    }

    // Manual trigger for demo
    $.on.Report.triggerDaily(async (_data: unknown, $: WorkflowContext) => {
      $.log('')
      $.log('=== Daily Report Pipeline Started ===')
      const startTime = Date.now()

      try {
        const results = await executePipeline(graph, $)

        const duration = Date.now() - startTime
        $.log(`=== Pipeline complete in ${duration}ms ===`)

        // Emit completion event
        $.send('Report.completed', {
          type: 'daily',
          duration,
          steps: results.size,
        })
      } catch (error) {
        $.log(`Pipeline failed: ${error}`)
        $.send('Report.failed', {
          type: 'daily',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })

    // Barrier-based collection trigger
    $.on.Data.collectWithBarrier(async (_data: unknown, $: WorkflowContext) => {
      $.log('')
      $.log('=== Barrier-based Data Collection ===')
      const data = await collectDataWithBarrier($)
      $.log(`Collected ${data.length} datasets`)
    })

    // Bulk distribution trigger
    $.on.Report.bulkDistribute(
      async (data: { report: Report; recipients: string[] }, $: WorkflowContext) => {
        $.log('')
        $.log('=== Bulk Distribution with Concurrency Control ===')
        await distributeToBulkRecipients(data.report, data.recipients, $)
      }
    )

    $.on.Report.completed(
      async (data: { type: string; duration: number; steps: number }, $: WorkflowContext) => {
        $.log(`Report ${data.type} completed: ${data.steps} steps in ${data.duration}ms`)
      }
    )
  })

  return workflow
}

// ============================================================================
// Demo Execution
// ============================================================================

async function runDemo() {
  console.log('='.repeat(60))
  console.log('Scheduled Reporting with Dependency Chains Demo')
  console.log('='.repeat(60))
  console.log()

  // Show topological sort
  console.log('Topological Sort of Pipeline:')
  const graph = createReportingPipeline()
  const { order } = topologicalSort(
    graph.getNodes().map((n) => ({ id: n.id, dependencies: n.dependencies }))
  )
  console.log('  Execution order:', order.join(' -> '))
  console.log()

  // Show DOT representation
  console.log('Graph visualization (DOT format):')
  console.log(graph.toDot())
  console.log()

  // Create and run workflow
  const workflow = createScheduledReportingWorkflow()
  await workflow.start()

  // Trigger daily report
  await workflow.send('Report.triggerDaily', {})
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Trigger barrier-based collection
  await workflow.send('Data.collectWithBarrier', {})
  await new Promise((resolve) => setTimeout(resolve, 500))

  // Trigger bulk distribution
  const mockReport: Report = {
    id: 'report-demo',
    type: 'daily',
    metrics: {
      period: 'daily',
      totalRecords: 100,
      sumValues: 50000,
      avgValue: 500,
      sources: ['demo'],
    },
    generatedAt: Date.now(),
  }
  await workflow.send('Report.bulkDistribute', {
    report: mockReport,
    recipients: Array.from({ length: 10 }, (_, i) => `user${i}@example.com`),
  })
  await new Promise((resolve) => setTimeout(resolve, 300))

  // Clean up
  await workflow.stop()
}

// Run if executed directly
runDemo().catch(console.error)
