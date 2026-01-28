/**
 * Agent - Create an autonomous agent
 *
 * Agents are autonomous AI workers that can execute tasks, make decisions,
 * and collaborate with other agents and humans.
 *
 * @packageDocumentation
 */

import { generateObject, type AIGenerateOptions, type SimpleSchema } from 'ai-functions'
import { z } from 'zod'
import type {
  Agent,
  AgentConfig,
  AgentStatus,
  AgentHistoryEntry,
  ApprovalRequest,
  ApprovalResult,
  ApprovalStatus,
} from './types.js'
import { executeApproval } from './actions.js'

// ============================================================================
// Zod schemas for runtime validation of AI responses
// ============================================================================

/**
 * Schema for task execution response (doTask in supervised/manual mode)
 */
const DoTaskResponseSchema = z.object({
  result: z.unknown(),
  reasoning: z.string(),
  needsApproval: z.boolean(),
})

/**
 * Schema for ask response
 */
const AskResponseSchema = z.object({
  answer: z.unknown(),
  reasoning: z.string(),
})

/**
 * Schema for decide response
 */
const DecideResponseSchema = z.object({
  decision: z.string(),
  reasoning: z.string(),
  confidence: z.number(),
})

/**
 * Schema for type validation response (is function)
 */
const IsValidResponseSchema = z.object({
  isValid: z.boolean(),
})

/**
 * Schema for agentic task response (executeAgenticTask)
 */
const AgenticTaskResponseSchema = z.object({
  thinking: z.string(),
  action: z.object({
    type: z.string(),
    toolName: z.string().optional(),
    arguments: z.string().optional(),
  }),
  result: z.unknown().optional(),
})

/**
 * Create an autonomous agent
 *
 * @example
 * ```ts
 * import { Agent, Role } from 'autonomous-agents'
 *
 * const agent = Agent({
 *   name: 'ProductAgent',
 *   role: Role({
 *     name: 'Product Manager',
 *     description: 'Manages product strategy and roadmap',
 *     skills: ['product strategy', 'user research', 'roadmap planning'],
 *   }),
 *   mode: 'autonomous',
 *   goals: [
 *     { id: 'g1', description: 'Define Q1 product roadmap', target: '100%' }
 *   ],
 * })
 *
 * // Execute a task
 * const result = await agent.do('Create a product brief for new feature X')
 *
 * // Ask a question
 * const answer = await agent.ask('What are the top 3 customer pain points?')
 *
 * // Make a decision
 * const decision = await agent.decide(['feature A', 'feature B', 'feature C'], 'Which should we prioritize?')
 *
 * // Request approval
 * const approval = await agent.approve({
 *   title: 'Budget Request',
 *   description: 'Request $50k budget for user research',
 *   data: { amount: 50000, purpose: 'User research study' },
 *   approver: 'manager@company.com',
 * })
 * ```
 */
export function Agent(config: AgentConfig): Agent {
  // Initialize agent state
  const state: Record<string, unknown> = config.context || {}
  let status: AgentStatus = 'idle'
  const history: AgentHistoryEntry[] = []

  // Default model and parameters
  const model = config.model || 'sonnet'
  const temperature = config.temperature ?? 0.7
  const maxIterations = config.maxIterations || 10

  /**
   * Record action in history
   */
  function recordHistory(entry: Omit<AgentHistoryEntry, 'timestamp'>): void {
    history.push({
      ...entry,
      timestamp: new Date(),
    })
  }

  /**
   * Execute a task
   */
  async function doTask<TResult = unknown>(task: string, context?: unknown): Promise<TResult> {
    const startTime = Date.now()
    status = 'thinking'

    try {
      // Build system prompt with role and goals
      const systemPrompt = buildSystemPrompt(config)

      // For autonomous mode, use agentic loop
      if (config.mode === 'autonomous') {
        const result = await executeAgenticTask<TResult>(
          task,
          context,
          systemPrompt,
          config.tools || [],
          maxIterations
        )

        recordHistory({
          type: 'task',
          action: task,
          input: context,
          output: result,
          duration: Date.now() - startTime,
        })

        status = 'completed'
        return result
      }

      // For supervised/manual mode, generate response with optional approval
      const result = await generateObject({
        model,
        schema: {
          result: 'The result of the task',
          reasoning: 'Step-by-step reasoning',
          needsApproval: 'Whether this needs approval (boolean)',
        },
        system: systemPrompt,
        prompt: `Task: ${task}\n\nContext: ${JSON.stringify(context || {})}`,
        temperature,
      })

      const parsed = DoTaskResponseSchema.safeParse(result.object)
      if (!parsed.success) {
        throw new Error(`Invalid AI response for task: ${parsed.error.message}`)
      }
      const response = parsed.data

      // Request approval if needed and agent requires approval
      if (config.requiresApproval || response.needsApproval) {
        const approval = await executeApproval({
          title: `Task: ${task}`,
          description: response.reasoning,
          data: response.result,
          approver: config.supervisor,
          channel: 'web',
        })

        if (approval.status !== 'approved') {
          throw new Error(`Task approval ${approval.status}: ${approval.notes || ''}`)
        }
      }

      recordHistory({
        type: 'task',
        action: task,
        input: context,
        output: response.result,
        duration: Date.now() - startTime,
      })

      status = 'completed'
      return response.result as TResult
    } catch (error) {
      status = 'error'
      recordHistory({
        type: 'error',
        action: task,
        input: context,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      })
      throw error
    } finally {
      if (status !== 'error') {
        status = 'idle'
      }
    }
  }

  /**
   * Ask a question
   */
  async function ask<TResult = unknown>(question: string, context?: unknown): Promise<TResult> {
    const startTime = Date.now()
    status = 'thinking'

    try {
      const systemPrompt = buildSystemPrompt(config)

      const result = await generateObject({
        model,
        schema: {
          answer: 'The answer to the question',
          reasoning: 'Supporting reasoning and evidence',
        },
        system: systemPrompt,
        prompt: `Question: ${question}\n\nContext: ${JSON.stringify(context || {})}`,
        temperature,
      })

      const parsed = AskResponseSchema.safeParse(result.object)
      if (!parsed.success) {
        throw new Error(`Invalid AI response for ask: ${parsed.error.message}`)
      }
      const response = parsed.data

      recordHistory({
        type: 'question',
        action: question,
        input: context,
        output: response.answer,
        duration: Date.now() - startTime,
      })

      status = 'idle'
      return response.answer as TResult
    } catch (error) {
      status = 'error'
      recordHistory({
        type: 'error',
        action: question,
        input: context,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      })
      throw error
    }
  }

  /**
   * Make a decision
   */
  async function decide<T extends string>(options: T[], context?: string): Promise<T> {
    const startTime = Date.now()
    status = 'thinking'

    try {
      const systemPrompt = buildSystemPrompt(config)

      const result = await generateObject({
        model,
        schema: {
          decision: options.join(' | '),
          reasoning: 'Reasoning for this decision',
          confidence: 'Confidence level 0-100 (number)',
        },
        system: systemPrompt,
        prompt: `Make a decision between these options:\n${options
          .map((o, i) => `${i + 1}. ${o}`)
          .join('\n')}\n\nContext: ${context || 'No additional context'}`,
        temperature,
      })

      const parsed = DecideResponseSchema.safeParse(result.object)
      if (!parsed.success) {
        throw new Error(`Invalid AI response for decide: ${parsed.error.message}`)
      }
      const response = parsed.data

      // Validate the decision is one of the provided options
      if (!options.includes(response.decision as T)) {
        throw new Error(
          `AI returned invalid decision "${response.decision}". Expected one of: ${options.join(
            ', '
          )}`
        )
      }

      recordHistory({
        type: 'decision',
        action: `Choose from: ${options.join(', ')}`,
        input: context,
        output: response,
        duration: Date.now() - startTime,
      })

      status = 'idle'
      return response.decision as T
    } catch (error) {
      status = 'error'
      recordHistory({
        type: 'error',
        action: 'decision',
        input: { options, context },
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      })
      throw error
    }
  }

  /**
   * Request approval
   */
  async function approve<TResult = unknown>(
    request: ApprovalRequest
  ): Promise<ApprovalResult<TResult>> {
    const startTime = Date.now()
    status = 'waiting'

    try {
      const result = await executeApproval(request)

      recordHistory({
        type: 'approval',
        action: request.title,
        input: request,
        output: result,
        duration: Date.now() - startTime,
      })

      status = 'idle'
      return result as ApprovalResult<TResult>
    } catch (error) {
      status = 'error'
      recordHistory({
        type: 'error',
        action: request.title,
        input: request,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      })
      throw error
    }
  }

  /**
   * Generate content
   */
  async function generate(options: AIGenerateOptions): Promise<unknown> {
    const startTime = Date.now()
    status = 'acting'

    try {
      const systemPrompt = buildSystemPrompt(config)

      const result = await generateObject({
        model: options.model || model,
        schema: options.schema || { result: 'Generated content' },
        system: options.system || systemPrompt,
        prompt: options.prompt || '',
        temperature: options.temperature ?? temperature,
      })

      recordHistory({
        type: 'task',
        action: 'generate',
        input: options,
        output: result.object,
        duration: Date.now() - startTime,
      })

      status = 'idle'
      return result.object
    } catch (error) {
      status = 'error'
      recordHistory({
        type: 'error',
        action: 'generate',
        input: options,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      })
      throw error
    }
  }

  /**
   * Type checking/validation
   */
  async function is(value: unknown, type: string | SimpleSchema): Promise<boolean> {
    try {
      const schema =
        typeof type === 'string'
          ? { isValid: `Is this value a valid ${type}? (boolean)` }
          : { isValid: 'Does this value match the schema? (boolean)' }

      const result = await generateObject({
        model,
        schema,
        system: 'You are a type validator. Determine if the value matches the expected type.',
        prompt: `Value: ${JSON.stringify(value)}\n\nExpected type: ${
          typeof type === 'string' ? type : JSON.stringify(type)
        }`,
        temperature: 0,
      })

      const parsed = IsValidResponseSchema.safeParse(result.object)
      if (!parsed.success) {
        // If we can't parse the response, treat as validation failure
        return false
      }
      return parsed.data.isValid
    } catch {
      return false
    }
  }

  /**
   * Send notification
   */
  async function notify(message: string, channel?: string): Promise<void> {
    const startTime = Date.now()

    try {
      // In a real implementation, this would send via the specified channel
      recordHistory({
        type: 'notification',
        action: 'notify',
        input: { message, channel },
        duration: Date.now() - startTime,
      })

      // For now, just log
      console.log(`[${config.name}] ${message}`)
    } catch (error) {
      recordHistory({
        type: 'error',
        action: 'notify',
        input: { message, channel },
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      })
      throw error
    }
  }

  /**
   * Update agent state
   */
  function setState(key: string, value: unknown): void {
    state[key] = value
  }

  /**
   * Get agent state
   */
  function getState<T = unknown>(key: string): T | undefined {
    return state[key] as T | undefined
  }

  /**
   * Get agent history
   */
  function getHistory(): AgentHistoryEntry[] {
    return [...history]
  }

  /**
   * Reset agent state
   */
  function reset(): void {
    Object.keys(state).forEach((key) => delete state[key])
    history.length = 0
    status = 'idle'
  }

  return {
    config,
    get status() {
      return status
    },
    state,
    do: doTask,
    ask,
    decide,
    approve,
    generate,
    is,
    notify,
    setState,
    getState,
    getHistory,
    reset,
  }
}

/**
 * Build system prompt from agent configuration
 */
function buildSystemPrompt(config: AgentConfig): string {
  const parts: string[] = []

  parts.push(`You are ${config.name}, an autonomous AI agent.`)

  if (config.description) {
    parts.push(config.description)
  }

  if (config.role) {
    parts.push(`\nRole: ${config.role.name}`)
    parts.push(config.role.description)

    if (config.role.skills.length > 0) {
      parts.push(`\nSkills: ${config.role.skills.join(', ')}`)
    }
  }

  if (config.goals && config.goals.length > 0) {
    parts.push('\nGoals:')
    config.goals.forEach((goal, i) => {
      parts.push(`${i + 1}. ${goal.description}`)
    })
  }

  if (config.system) {
    parts.push(`\n${config.system}`)
  }

  return parts.join('\n')
}

/**
 * Execute an agentic task with tool use
 */
async function executeAgenticTask<TResult>(
  task: string,
  context: unknown,
  systemPrompt: string,
  tools: import('ai-functions').AIFunctionDefinition[],
  maxIterations: number
): Promise<TResult> {
  let iteration = 0
  const toolResults: unknown[] = []

  while (iteration < maxIterations) {
    iteration++

    const result = await generateObject({
      model: 'sonnet',
      schema: {
        thinking: 'Your step-by-step reasoning',
        action: {
          type: 'tool | done',
          toolName: 'Name of tool to use (if action is tool)',
          arguments: 'Arguments for the tool as JSON string',
        },
        result: 'The final result if done',
      },
      system: systemPrompt,
      prompt: `Task: ${task}\n\nContext: ${JSON.stringify(context)}\n\nPrevious actions:\n${
        toolResults.map((r, i) => `${i + 1}. ${JSON.stringify(r)}`).join('\n') || 'None yet'
      }\n\nWhat should you do next?`,
    })

    const parsed = AgenticTaskResponseSchema.safeParse(result.object)
    if (!parsed.success) {
      throw new Error(
        `Invalid AI response in agentic loop (iteration ${iteration}): ${parsed.error.message}`
      )
    }
    const response = parsed.data

    // Check if done
    if (response.action.type === 'done' || response.result) {
      return response.result as TResult
    }

    // Execute tool
    if (response.action.type === 'tool' && response.action.toolName) {
      const tool = tools.find((t) => t.name === response.action.toolName)
      if (tool) {
        const args = JSON.parse(response.action.arguments || '{}')
        const toolResult = await tool.handler(args)
        toolResults.push({ tool: response.action.toolName, result: toolResult })
      } else {
        toolResults.push({ error: `Tool not found: ${response.action.toolName}` })
      }
    }
  }

  throw new Error(`Agent exceeded maximum iterations (${maxIterations})`)
}
