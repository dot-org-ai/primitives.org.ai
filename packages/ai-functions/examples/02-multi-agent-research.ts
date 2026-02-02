/**
 * Multi-Agent Research Workflow Example
 *
 * This example demonstrates a multi-agent research workflow where different
 * specialized agents collaborate to research a topic. It shows how to:
 * - Define specialized agents with different roles
 * - Coordinate agent interactions
 * - Aggregate and synthesize results
 * - Use tool orchestration for complex workflows
 *
 * @example
 * ```bash
 * ANTHROPIC_API_KEY=sk-... npx tsx examples/02-multi-agent-research.ts
 * ```
 */

import {
  ai,
  write,
  list,
  is,
  configure,
  AgenticLoop,
  createTool,
  createToolset,
  type Tool,
} from '../src/index.js'
import { z } from 'zod'

// ============================================================================
// Agent Definitions
// ============================================================================

interface AgentResult {
  agent: string
  findings: string[]
  confidence: number
}

/**
 * Research Planner Agent - Creates a research plan
 */
async function plannerAgent(topic: string): Promise<string[]> {
  console.log('\n[Planner Agent] Creating research plan...')

  const questions = await list`5 key research questions to thoroughly investigate: "${topic}"

Consider:
- Background and context
- Current state and trends
- Key players and stakeholders
- Challenges and opportunities
- Future implications`

  console.log('[Planner Agent] Research questions:')
  questions.forEach((q, i) => console.log(`  ${i + 1}. ${q}`))

  return questions
}

/**
 * Fact Finder Agent - Gathers factual information
 */
async function factFinderAgent(question: string): Promise<AgentResult> {
  console.log(`\n[Fact Finder] Researching: ${question.substring(0, 50)}...`)

  const { facts, sources, confidence } =
    await ai`Research this question and provide factual information:
"${question}"

Provide your response with:
- facts: array of factual findings (3-5 key facts)
- sources: where this information typically comes from
- confidence: your confidence level 0-1 in these facts`

  const result: AgentResult = {
    agent: 'FactFinder',
    findings: facts as string[],
    confidence: (confidence as number) || 0.7,
  }

  console.log(
    `[Fact Finder] Found ${result.findings.length} facts (confidence: ${result.confidence})`
  )
  return result
}

/**
 * Critical Analyst Agent - Analyzes and critiques
 */
async function analystAgent(findings: string[]): Promise<AgentResult> {
  console.log('\n[Analyst Agent] Analyzing findings...')

  const { analysis, gaps, confidence } = await ai`Critically analyze these research findings:
${findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

Provide:
- analysis: array of analytical insights (3-4 insights)
- gaps: any gaps or areas needing more research
- confidence: confidence in the analysis 0-1`

  const result: AgentResult = {
    agent: 'Analyst',
    findings: analysis as string[],
    confidence: (confidence as number) || 0.6,
  }

  console.log(`[Analyst Agent] Generated ${result.findings.length} insights`)
  return result
}

/**
 * Synthesizer Agent - Creates final summary
 */
async function synthesizerAgent(allResults: AgentResult[]): Promise<string> {
  console.log('\n[Synthesizer Agent] Creating final synthesis...')

  const allFindings = allResults.flatMap((r) => r.findings)

  const synthesis = await write`Create a comprehensive research summary from these findings:

${allFindings.map((f, i) => `- ${f}`).join('\n')}

Structure the summary with:
1. Executive Summary (2-3 sentences)
2. Key Findings (bullet points)
3. Analysis & Insights
4. Recommendations
5. Areas for Further Research`

  return synthesis
}

// ============================================================================
// Coordinator - Orchestrates the Multi-Agent Workflow
// ============================================================================

class ResearchCoordinator {
  private topic: string
  private results: AgentResult[] = []

  constructor(topic: string) {
    this.topic = topic
  }

  async run(): Promise<string> {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Research Topic: ${this.topic}`)
    console.log('='.repeat(60))

    // Phase 1: Planning
    const questions = await plannerAgent(this.topic)

    // Phase 2: Parallel Research
    console.log('\n[Coordinator] Starting parallel research phase...')
    const researchPromises = questions.slice(0, 3).map((q) => factFinderAgent(q))
    const researchResults = await Promise.all(researchPromises)
    this.results.push(...researchResults)

    // Phase 3: Analysis
    const allFacts = researchResults.flatMap((r) => r.findings)
    const analysisResult = await analystAgent(allFacts)
    this.results.push(analysisResult)

    // Phase 4: Synthesis
    const finalReport = await synthesizerAgent(this.results)

    // Phase 5: Quality Check
    const isQualityOk =
      await is`This research summary is well-structured and comprehensive: "${finalReport.substring(
        0,
        200
      )}..."`

    if (!isQualityOk) {
      console.log('[Coordinator] Quality check failed, requesting revision...')
      // In production, you might iterate on the summary
    }

    return finalReport
  }

  getResults(): AgentResult[] {
    return this.results
  }
}

// ============================================================================
// Tool-Based Research Agent (Alternative Approach)
// ============================================================================

const searchTool = createTool({
  name: 'search',
  description: 'Search for information on a topic',
  parameters: {
    query: z.string().describe('Search query'),
  },
  execute: async ({ query }) => {
    // Simulate search results
    console.log(`  [Tool] Searching: ${query}`)
    return {
      results: [
        `Result 1 for "${query}": Found relevant information...`,
        `Result 2 for "${query}": Additional context...`,
      ],
    }
  },
})

const analyzeTool = createTool({
  name: 'analyze',
  description: 'Analyze and synthesize information',
  parameters: {
    data: z.string().describe('Data to analyze'),
    perspective: z.string().describe('Analysis perspective'),
  },
  execute: async ({ data, perspective }) => {
    console.log(`  [Tool] Analyzing from ${perspective} perspective...`)
    return {
      analysis: `Analysis of "${data.substring(
        0,
        30
      )}..." from ${perspective} perspective: Key insights identified.`,
    }
  },
})

async function toolBasedResearch(topic: string): Promise<void> {
  console.log('\n--- Tool-Based Research Agent ---')

  const loop = new AgenticLoop({
    tools: createToolset(searchTool, analyzeTool),
    maxSteps: 5,
    onStep: (step) => {
      console.log(`[Step ${step.stepNumber}] Tool calls: ${step.toolCalls.length}`)
    },
  })

  // This requires a model that supports tool calling
  // For demonstration, we'll skip the actual execution
  console.log('Tool-based agent configured with:', loop.getToolsForSDK())
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('\n=== Multi-Agent Research Workflow ===\n')

  // Configure the AI provider
  configure({
    model: 'sonnet',
    provider: 'anthropic',
  })

  // Run the research workflow
  const coordinator = new ResearchCoordinator(
    'The impact of Large Language Models on software development practices'
  )

  const report = await coordinator.run()

  console.log('\n' + '='.repeat(60))
  console.log('FINAL RESEARCH REPORT')
  console.log('='.repeat(60))
  console.log(report)

  // Show agent statistics
  console.log('\n--- Agent Statistics ---')
  const results = coordinator.getResults()
  for (const result of results) {
    console.log(
      `${result.agent}: ${result.findings.length} findings (confidence: ${result.confidence})`
    )
  }

  // Demonstrate tool-based approach
  await toolBasedResearch('AI in healthcare')
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
