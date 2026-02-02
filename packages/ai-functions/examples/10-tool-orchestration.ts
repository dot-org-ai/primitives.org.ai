/**
 * Tool Orchestration Example
 *
 * This example demonstrates building agentic loops with tool calling using ai-functions.
 * It shows how to:
 * - Define and register tools
 * - Create an agentic loop
 * - Handle tool results and multi-turn conversations
 * - Implement tool composition patterns
 *
 * @example
 * ```bash
 * ANTHROPIC_API_KEY=sk-... npx tsx examples/10-tool-orchestration.ts
 * ```
 */

import {
  configure,
  AgenticLoop,
  ToolRouter,
  ToolValidator,
  createTool,
  createToolset,
  wrapTool,
  cachedTool,
  rateLimitedTool,
  timeoutTool,
  createAgenticLoop,
  type Tool,
  type ToolCall,
  type LoopResult,
} from '../src/index.js'
import { z } from 'zod'

// ============================================================================
// Define Tools
// ============================================================================

/**
 * Calculator tool - performs basic math
 */
const calculatorTool = createTool({
  name: 'calculator',
  description: 'Performs basic math operations (add, subtract, multiply, divide)',
  parameters: {
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number().describe('First operand'),
    b: z.number().describe('Second operand'),
  },
  execute: async ({ operation, a, b }) => {
    console.log(`  [Calculator] ${a} ${operation} ${b}`)
    switch (operation) {
      case 'add':
        return a + b
      case 'subtract':
        return a - b
      case 'multiply':
        return a * b
      case 'divide':
        return b !== 0 ? a / b : 'Error: Division by zero'
    }
  },
})

/**
 * Weather tool - simulates weather lookup
 */
const weatherTool = createTool({
  name: 'get_weather',
  description: 'Gets the current weather for a location',
  parameters: {
    location: z.string().describe('City name or location'),
    units: z.enum(['celsius', 'fahrenheit']).optional().default('celsius'),
  },
  execute: async ({ location, units }) => {
    console.log(`  [Weather] Looking up: ${location}`)
    // Simulated weather data
    const temp = Math.floor(Math.random() * 30) + 5
    const conditions = ['sunny', 'cloudy', 'rainy', 'partly cloudy'][Math.floor(Math.random() * 4)]
    const displayTemp = units === 'fahrenheit' ? Math.round(temp * 1.8 + 32) : temp
    const unit = units === 'fahrenheit' ? 'F' : 'C'

    return {
      location,
      temperature: `${displayTemp}${unit}`,
      conditions,
      humidity: `${Math.floor(Math.random() * 50) + 30}%`,
    }
  },
})

/**
 * Search tool - simulates web search
 */
const searchTool = createTool({
  name: 'search',
  description: 'Searches the web for information',
  parameters: {
    query: z.string().describe('Search query'),
    maxResults: z.number().optional().default(3),
  },
  execute: async ({ query, maxResults }) => {
    console.log(`  [Search] Query: "${query}"`)
    // Simulated search results
    return {
      query,
      results: [
        {
          title: `Result 1 for "${query}"`,
          snippet: 'Relevant information found...',
          url: 'https://example.com/1',
        },
        {
          title: `Result 2 for "${query}"`,
          snippet: 'More details about the topic...',
          url: 'https://example.com/2',
        },
        {
          title: `Result 3 for "${query}"`,
          snippet: 'Additional context and data...',
          url: 'https://example.com/3',
        },
      ].slice(0, maxResults),
    }
  },
})

/**
 * Database tool - simulates data lookup
 */
const databaseTool = createTool({
  name: 'query_database',
  description: 'Queries a database for user or product information',
  parameters: {
    table: z.enum(['users', 'products', 'orders']),
    filter: z.object({
      field: z.string(),
      value: z.string(),
    }),
  },
  execute: async ({ table, filter }) => {
    console.log(`  [Database] Querying ${table} where ${filter.field} = ${filter.value}`)

    // Simulated database results
    const mockData: Record<string, unknown[]> = {
      users: [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
      ],
      products: [
        { id: 101, name: 'Widget Pro', price: 99.99 },
        { id: 102, name: 'Widget Basic', price: 49.99 },
      ],
      orders: [
        { id: 1001, userId: 1, productId: 101, status: 'shipped' },
        { id: 1002, userId: 2, productId: 102, status: 'pending' },
      ],
    }

    return {
      table,
      results: mockData[table] || [],
      count: mockData[table]?.length || 0,
    }
  },
})

// ============================================================================
// Tool Composition Patterns
// ============================================================================

/**
 * Wrap a tool with logging middleware
 */
function withLogging<T extends Tool>(tool: T): Tool {
  return wrapTool(tool, {
    before: (params) => {
      console.log(`  [LOG] Calling ${tool.name} with:`, JSON.stringify(params).substring(0, 100))
      return params
    },
    after: (result) => {
      console.log(`  [LOG] ${tool.name} returned:`, JSON.stringify(result).substring(0, 100))
      return result
    },
    onError: (error) => {
      console.log(`  [LOG] ${tool.name} error:`, error.message)
      throw error
    },
  })
}

/**
 * Create a toolset with common wrappers
 */
function createProductionToolset(...tools: Tool[]): Tool[] {
  return tools.map((tool) => {
    // Apply wrappers in order
    let wrapped: Tool = tool

    // Add rate limiting (5 calls per 10 seconds)
    wrapped = rateLimitedTool(wrapped, { maxCalls: 5, windowMs: 10000 })

    // Add timeout (30 seconds)
    wrapped = timeoutTool(wrapped, 30000)

    return wrapped
  })
}

// ============================================================================
// Agentic Loop Examples
// ============================================================================

/**
 * Simple calculation agent
 */
async function runCalculationAgent(): Promise<void> {
  console.log('\n--- Calculation Agent ---\n')

  const loop = new AgenticLoop({
    tools: [calculatorTool],
    maxSteps: 5,
    onStep: (step) => {
      console.log(`  Step ${step.stepNumber}: ${step.toolCalls.length} tool calls`)
    },
  })

  // Mock model that performs a calculation
  const mockModel = {
    generate: async ({ messages }: { messages: Array<{ role: string; content: string }> }) => {
      const lastMessage = messages[messages.length - 1]?.content || ''

      // First call: request calculation
      if (!lastMessage.includes('100')) {
        return {
          toolCalls: [{ name: 'calculator', arguments: { operation: 'multiply', a: 25, b: 4 } }],
          finishReason: 'tool_call' as const,
        }
      }

      // After getting result
      return {
        text: 'The result of 25 multiplied by 4 is 100.',
        finishReason: 'stop' as const,
      }
    },
  }

  const result = await loop.run({
    model: mockModel,
    prompt: 'What is 25 multiplied by 4?',
  })

  console.log(`\n  Final answer: ${result.text}`)
  console.log(`  Total steps: ${result.steps}`)
  console.log(`  Tool calls: ${result.toolCalls.length}`)
}

/**
 * Research agent with multiple tools
 */
async function runResearchAgent(): Promise<void> {
  console.log('\n--- Research Agent ---\n')

  const toolset = createToolset(searchTool, weatherTool, calculatorTool)

  const loop = createAgenticLoop({
    tools: toolset,
    maxSteps: 10,
    parallelExecution: true,
    trackUsage: true,
    onStep: (step) => {
      console.log(`  Step ${step.stepNumber}:`)
      for (const call of step.toolCalls) {
        console.log(
          `    - ${call.name}${
            call.result !== undefined
              ? ` -> ${JSON.stringify(call.result).substring(0, 50)}...`
              : ''
          }`
        )
      }
    },
  })

  // Mock model that does research
  let stepCount = 0
  const mockModel = {
    generate: async () => {
      stepCount++

      if (stepCount === 1) {
        // First: search and get weather in parallel
        return {
          toolCalls: [
            { name: 'search', arguments: { query: 'best coffee shops' } },
            { name: 'get_weather', arguments: { location: 'San Francisco' } },
          ],
          finishReason: 'tool_call' as const,
        }
      }

      if (stepCount === 2) {
        // Second: do a calculation
        return {
          toolCalls: [{ name: 'calculator', arguments: { operation: 'add', a: 3, b: 2 } }],
          finishReason: 'tool_call' as const,
        }
      }

      // Final response
      return {
        text: 'Based on my research, I found several coffee shops. The weather is pleasant. And 3 + 2 = 5.',
        finishReason: 'stop' as const,
      }
    },
  }

  const result = await loop.run({
    model: mockModel,
    prompt: 'Find coffee shops, check the weather in SF, and calculate 3+2',
    system: 'You are a helpful research assistant.',
  })

  console.log(`\n  Final answer: ${result.text}`)
  console.log(`  Total steps: ${result.steps}`)
  console.log(`  Tool calls made: ${result.toolCalls.length}`)
}

/**
 * Data lookup agent
 */
async function runDatabaseAgent(): Promise<void> {
  console.log('\n--- Database Agent ---\n')

  // Use cached version of database tool
  const cachedDb = cachedTool(databaseTool, { ttl: 60000, maxSize: 100 })

  const loop = new AgenticLoop({
    tools: [cachedDb],
    maxSteps: 5,
    retryFailedTools: true,
    maxToolRetries: 2,
  })

  // Mock model
  let called = false
  const mockModel = {
    generate: async () => {
      if (!called) {
        called = true
        return {
          toolCalls: [
            {
              name: 'query_database',
              arguments: { table: 'users', filter: { field: 'name', value: 'Alice' } },
            },
          ],
          finishReason: 'tool_call' as const,
        }
      }

      return {
        text: 'Found user Alice in the database.',
        finishReason: 'stop' as const,
      }
    },
  }

  const result = await loop.run({
    model: mockModel,
    prompt: 'Find information about user Alice',
  })

  console.log(`\n  Result: ${result.text}`)

  // Clean up cached tool
  ;(cachedDb as any).destroy?.()
}

// ============================================================================
// Tool Validation Demo
// ============================================================================

async function demonstrateValidation(): Promise<void> {
  console.log('\n--- Tool Validation ---\n')

  const validator = new ToolValidator()
  validator.register(calculatorTool)
  validator.register(weatherTool)

  const testCalls: ToolCall[] = [
    { name: 'calculator', arguments: { operation: 'add', a: 5, b: 3 } },
    { name: 'calculator', arguments: { operation: 'invalid', a: 5, b: 3 } },
    { name: 'get_weather', arguments: { location: 'NYC' } },
    { name: 'unknown_tool', arguments: {} },
  ]

  for (const call of testCalls) {
    const result = validator.validate(call.name, call.arguments)
    console.log(`  ${call.name}(${JSON.stringify(call.arguments)})`)
    console.log(
      `    Valid: ${result.valid}${result.errors ? ` | Errors: ${result.errors.join(', ')}` : ''}\n`
    )
  }
}

// ============================================================================
// Tool Router Demo
// ============================================================================

async function demonstrateRouter(): Promise<void> {
  console.log('\n--- Tool Router ---\n')

  const router = new ToolRouter()
  router.register(calculatorTool)
  router.register(weatherTool)
  router.register(searchTool)

  // Route single call
  const result = await router.route({
    name: 'calculator',
    arguments: { operation: 'multiply', a: 7, b: 8 },
  })

  console.log(`  Single route result:`, result.success ? result.result : result.error)

  // Route multiple calls in parallel
  const results = await router.routeAllParallel([
    { name: 'get_weather', arguments: { location: 'Tokyo' } },
    { name: 'search', arguments: { query: 'TypeScript tutorials' } },
  ])

  console.log(`\n  Parallel route results:`)
  for (const r of results) {
    const formatted = router.formatResult(r)
    console.log(`    ${r.toolCall?.name}: ${formatted.content.substring(0, 60)}...`)
  }
}

// ============================================================================
// Streaming Agent Demo
// ============================================================================

async function demonstrateStreaming(): Promise<void> {
  console.log('\n--- Streaming Agent Loop ---\n')

  const loop = new AgenticLoop({
    tools: [calculatorTool],
    maxSteps: 3,
    trackUsage: true,
  })

  // Mock streaming model
  let step = 0
  const mockModel = {
    generate: async () => {
      step++
      if (step === 1) {
        return {
          toolCalls: [{ name: 'calculator', arguments: { operation: 'add', a: 10, b: 20 } }],
          finishReason: 'tool_call' as const,
          usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        }
      }
      return {
        text: '10 + 20 = 30',
        finishReason: 'stop' as const,
        usage: { promptTokens: 80, completionTokens: 10, totalTokens: 90 },
      }
    },
  }

  console.log('  Streaming events:')

  for await (const event of loop.stream({
    model: mockModel,
    prompt: 'Calculate 10 + 20',
  })) {
    switch (event.type) {
      case 'start':
        console.log(`    [start] Prompt: "${event.prompt.substring(0, 30)}..."`)
        break
      case 'step_start':
        console.log(`    [step_start] Step ${event.stepNumber}`)
        break
      case 'tool_calls':
        console.log(`    [tool_calls] ${event.toolCalls.map((t) => t.name).join(', ')}`)
        break
      case 'tool_result':
        console.log(`    [tool_result] ${event.toolName}: ${JSON.stringify(event.result)}`)
        break
      case 'text':
        console.log(`    [text] "${event.text}"`)
        break
      case 'end':
        console.log(`    [end] Steps: ${event.steps}, Reason: ${event.stopReason}`)
        break
    }
  }
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('\n=== Tool Orchestration Example ===\n')

  // Configure (not used for mocked examples, but shown for reference)
  configure({
    model: 'sonnet',
    provider: 'anthropic',
  })

  // Run demos
  await runCalculationAgent()
  await runResearchAgent()
  await runDatabaseAgent()
  await demonstrateValidation()
  await demonstrateRouter()
  await demonstrateStreaming()

  // Summary
  console.log('\n=== Tool Orchestration Summary ===')
  console.log(`
Key concepts demonstrated:

1. Tool Definition
   - Use createTool() with Zod schemas
   - Provide clear descriptions for the model
   - Return structured data from execute()

2. AgenticLoop
   - Multi-turn model -> tools -> model loop
   - Configurable max steps and parallel execution
   - Built-in retry and error handling

3. Tool Composition
   - wrapTool() for middleware (logging, auth)
   - cachedTool() for result caching
   - rateLimitedTool() for rate limiting
   - timeoutTool() for execution limits

4. Validation & Routing
   - ToolValidator for pre-execution checks
   - ToolRouter for dispatching calls
   - Support for parallel routing

5. Streaming
   - AsyncGenerator for step-by-step events
   - Real-time progress monitoring
   - Usage tracking
`)
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
