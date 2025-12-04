/**
 * Core types for AI functions
 */

// Use Promise directly for interface definitions
// The actual RPC layer handles serialization
type RpcPromise<T> = Promise<T>

/**
 * A function definition that can be called by AI
 */
export interface AIFunctionDefinition<
  TInput = unknown,
  TOutput = unknown
> {
  /** Unique name for the function */
  name: string
  /** Human-readable description for the AI */
  description: string
  /** JSON Schema for the input parameters */
  parameters: JSONSchema
  /** The implementation */
  handler: (input: TInput) => TOutput | Promise<TOutput>
}

/**
 * JSON Schema type (simplified)
 */
export interface JSONSchema {
  type?: string
  properties?: Record<string, JSONSchema>
  items?: JSONSchema
  required?: string[]
  description?: string
  enum?: unknown[]
  default?: unknown
  [key: string]: unknown
}

/**
 * Options for AI generation
 */
export interface AIGenerateOptions {
  /** The prompt or input */
  prompt?: string
  /** System message */
  system?: string
  /** Model to use */
  model?: string
  /** Temperature (0-1) */
  temperature?: number
  /** Maximum tokens to generate */
  maxTokens?: number
  /** Stop sequences */
  stop?: string[]
  /** Structured output schema */
  schema?: JSONSchema
  /** Available functions */
  functions?: AIFunctionDefinition[]
}

/**
 * Result of AI generation
 */
export interface AIGenerateResult {
  /** Generated text */
  text: string
  /** Structured output (if schema was provided) */
  object?: unknown
  /** Function calls (if functions were provided) */
  functionCalls?: AIFunctionCall[]
  /** Token usage */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * A function call made by the AI
 */
export interface AIFunctionCall {
  /** Name of the function to call */
  name: string
  /** Arguments as JSON */
  arguments: unknown
}

/**
 * AI client interface - all methods return RpcPromise for pipelining
 */
export interface AIClient {
  /** Generate text or structured output */
  generate(options: AIGenerateOptions): RpcPromise<AIGenerateResult>

  /** Execute an action */
  do(action: string, context?: unknown): RpcPromise<unknown>

  /** Type checking / validation */
  is(value: unknown, type: string | JSONSchema): RpcPromise<boolean>

  /** Generate code */
  code(prompt: string, language?: string): RpcPromise<string>

  /** Make a decision */
  decide<T extends string>(options: T[], context?: string): RpcPromise<T>

  /** Generate a diagram */
  diagram(description: string, format?: 'mermaid' | 'svg' | 'ascii'): RpcPromise<string>

  /** Generate an image */
  image(prompt: string, options?: ImageOptions): RpcPromise<ImageResult>

  /** Generate a video */
  video(prompt: string, options?: VideoOptions): RpcPromise<VideoResult>

  /** Write/generate text content */
  write(prompt: string, options?: WriteOptions): RpcPromise<string>

  /** Generate a list of items with names and descriptions */
  list(prompt: string): RpcPromise<ListResult>

  /** Generate multiple named lists of items */
  lists(prompt: string): RpcPromise<ListsResult>
}

export interface ImageOptions {
  width?: number
  height?: number
  style?: string
  model?: string
}

export interface ImageResult {
  url: string
  base64?: string
  width: number
  height: number
}

export interface VideoOptions {
  duration?: number
  width?: number
  height?: number
  fps?: number
  model?: string
}

export interface VideoResult {
  url: string
  duration: number
  width: number
  height: number
}

export interface WriteOptions {
  tone?: string
  length?: 'short' | 'medium' | 'long'
  format?: 'text' | 'markdown' | 'html'
}

/**
 * Type for functions that support both regular calls and tagged template literals
 */
export type TemplateFunction<TArgs extends unknown[], TReturn> =
  & ((prompt: string, ...args: TArgs) => TReturn)
  & ((strings: TemplateStringsArray, ...values: unknown[]) => TReturn)

/**
 * A single item in a list
 */
export interface ListItem {
  name: string
  description: string
}

/**
 * Result of the list() function
 */
export interface ListResult {
  items: ListItem[]
}

/**
 * A named list containing items
 */
export interface NamedList {
  name: string
  items: ListItem[]
}

/**
 * Result of the lists() function
 */
export interface ListsResult {
  lists: NamedList[]
}

// ============================================================================
// Function Definition Types
// ============================================================================

/**
 * Supported programming languages for code generation
 */
export type CodeLanguage = 'typescript' | 'javascript' | 'python' | 'go' | 'rust'

/**
 * Output types for generative functions
 */
export type GenerativeOutputType = 'string' | 'object' | 'image' | 'video' | 'audio'

/**
 * Human interaction channels
 *
 * - chat: Real-time messaging (WebSocket, in-app)
 * - email: Async email communication
 * - phone: Voice calls
 * - sms: SMS text messages
 * - workspace: Team collaboration platforms (Slack, Teams, Discord)
 * - web: Web-based interface (browser, web app)
 */
export type HumanChannel = 'chat' | 'email' | 'phone' | 'sms' | 'workspace' | 'web'

/**
 * Legacy channel type for backwards compatibility
 * @deprecated Use HumanChannel instead
 */
export type LegacyHumanChannel = 'slack' | 'email' | 'web' | 'sms' | 'custom'

/**
 * Schema limitations that apply across providers
 * These constraints ensure compatibility with OpenAI, Anthropic, and Google
 */
export interface SchemaLimitations {
  /** OpenAI requires additionalProperties: false on all objects */
  noAdditionalProperties: true
  /** OpenAI requires all properties in 'required' - no optional keys */
  allPropertiesRequired: true
  /** OpenAI doesn't support default values */
  noDefaultValues: true
  /** No recursive schema definitions (all providers) */
  noRecursiveSchemas: true
  /** No external $ref URLs (all providers) */
  noExternalRefs: true
  /** Anthropic doesn't support min/max on numbers */
  noNumericBounds: true
  /** Anthropic doesn't support minLength/maxLength on strings */
  noStringLengthBounds: true
  /** Anthropic only supports minItems of 0 or 1 */
  limitedArrayMinItems: true
  /** Anthropic doesn't support complex types in enums */
  simpleEnumsOnly: true
  /** Anthropic doesn't support lookahead/lookbehind in regex */
  simpleRegexOnly: true
}

/**
 * Base definition shared by all function types
 */
export interface BaseFunctionDefinition<TArgs = unknown, TReturn = unknown> {
  /** Function name (used as the callable identifier) */
  name: string
  /** Human-readable description of what this function does */
  description?: string
  /** Arguments schema - SimpleSchema or Zod schema */
  args: TArgs
  /** Return type schema - SimpleSchema or Zod schema (optional) */
  returnType?: TReturn
}

/**
 * Code function - generates actual executable code
 *
 * When called, this generates:
 * - Implementation code with JSDoc comments
 * - Vitest test cases
 * - Example usage scripts
 *
 * @example
 * ```ts
 * defineFunction({
 *   type: 'code',
 *   name: 'calculateTax',
 *   args: {
 *     amount: 'The amount to calculate tax on (number)',
 *     rate: 'Tax rate as decimal (number)',
 *   },
 *   returnType: 'The calculated tax amount (number)',
 *   language: 'typescript',
 * })
 * ```
 */
export interface CodeFunctionDefinition<TArgs = unknown, TReturn = unknown>
  extends BaseFunctionDefinition<TArgs, TReturn> {
  type: 'code'
  /** Target programming language */
  language?: CodeLanguage
  /** Additional context or requirements for code generation */
  instructions?: string
  /** Whether to include vitest tests (default: true) */
  includeTests?: boolean
  /** Whether to include example usage (default: true) */
  includeExamples?: boolean
}

/**
 * Code function result with generated artifacts
 */
export interface CodeFunctionResult {
  /** The generated implementation code */
  code: string
  /** Generated vitest test code */
  tests?: string
  /** Generated example usage code */
  examples?: string
  /** The language the code was generated in */
  language: CodeLanguage
  /** JSDoc or equivalent documentation */
  documentation: string
}

/**
 * Generative function - uses AI to generate text, objects, or media
 *
 * @example
 * ```ts
 * defineFunction({
 *   type: 'generative',
 *   name: 'summarize',
 *   args: { text: 'The text to summarize' },
 *   output: 'string',
 *   system: 'You are an expert summarizer.',
 *   promptTemplate: 'Summarize the following text:\n\n{{text}}',
 * })
 * ```
 */
export interface GenerativeFunctionDefinition<TArgs = unknown, TReturn = unknown>
  extends BaseFunctionDefinition<TArgs, TReturn> {
  type: 'generative'
  /** What type of output this function produces */
  output: GenerativeOutputType
  /** System prompt for the AI */
  system?: string
  /** Prompt template with {{arg}} placeholders */
  promptTemplate?: string
  /** Model to use (defaults to 'sonnet') */
  model?: string
  /** Temperature for generation (0-2) */
  temperature?: number
}

/**
 * Generative function result
 */
export interface GenerativeFunctionResult<T = unknown> {
  /** Generated text (if output is 'string') */
  text?: string
  /** Generated object (if output is 'object') */
  object?: T
  /** Generated image (if output is 'image') */
  image?: ImageResult
  /** Generated video (if output is 'video') */
  video?: VideoResult
  /** Generated audio URL (if output is 'audio') */
  audio?: { url: string; duration: number }
}

/**
 * Agentic function - runs in a loop with tools until completion
 *
 * @example
 * ```ts
 * defineFunction({
 *   type: 'agentic',
 *   name: 'researchTopic',
 *   args: { topic: 'The topic to research' },
 *   returnType: {
 *     summary: 'Research summary',
 *     sources: ['List of sources'],
 *   },
 *   instructions: 'Research the topic thoroughly using available tools.',
 *   tools: [searchTool, fetchTool],
 *   maxIterations: 10,
 * })
 * ```
 */
export interface AgenticFunctionDefinition<TArgs = unknown, TReturn = unknown>
  extends BaseFunctionDefinition<TArgs, TReturn> {
  type: 'agentic'
  /** Instructions for the agent on how to accomplish the task */
  instructions: string
  /** Prompt template with {{arg}} placeholders */
  promptTemplate?: string
  /** Tools available to the agent */
  tools?: AIFunctionDefinition[]
  /** Maximum number of iterations before stopping (default: 10) */
  maxIterations?: number
  /** Model to use for the agent (defaults to 'sonnet') */
  model?: string
  /** Whether to stream intermediate results */
  stream?: boolean
}

/**
 * Agentic function execution state
 */
export interface AgenticExecutionState {
  /** Current iteration number */
  iteration: number
  /** Tool calls made so far */
  toolCalls: AIFunctionCall[]
  /** Intermediate results */
  intermediateResults: unknown[]
  /** Whether the agent has completed */
  completed: boolean
  /** Final result (if completed) */
  result?: unknown
}

/**
 * Human function - requires human input/approval
 *
 * Generates appropriate UI/interaction for the specified channel:
 * - slack: Generates Slack BlockKit JSON
 * - email: Generates email template
 * - web: Generates form/UI component
 * - sms: Generates SMS-friendly text
 * - custom: Provides structured data for custom implementation
 *
 * @example
 * ```ts
 * defineFunction({
 *   type: 'human',
 *   name: 'approveExpense',
 *   args: {
 *     amount: 'Expense amount (number)',
 *     description: 'What the expense is for',
 *     submitter: 'Who submitted the expense',
 *   },
 *   returnType: {
 *     approved: 'Whether the expense was approved (boolean)',
 *     notes: 'Any notes from the approver',
 *   },
 *   channel: 'workspace',
 *   instructions: 'Review the expense request and approve or reject it.',
 * })
 * ```
 */
export interface HumanFunctionDefinition<TArgs = unknown, TReturn = unknown>
  extends BaseFunctionDefinition<TArgs, TReturn> {
  type: 'human'
  /** How to interact with the human */
  channel: HumanChannel
  /** Instructions shown to the human */
  instructions: string
  /** Prompt template with {{arg}} placeholders for the request */
  promptTemplate?: string
  /** Timeout in milliseconds (default: none - wait indefinitely) */
  timeout?: number
  /** Who should handle this (e.g., user ID, email, channel ID) */
  assignee?: string
}

/**
 * Human function result with channel-specific artifacts
 */
export interface HumanFunctionResult<T = unknown> {
  /** The human's response */
  response: T
  /** Who responded */
  respondedBy?: string
  /** When they responded */
  respondedAt?: Date
  /** Channel-specific artifacts */
  artifacts?: {
    /** Slack BlockKit JSON */
    slackBlocks?: unknown[]
    /** Email HTML template */
    emailHtml?: string
    /** Web form component */
    webComponent?: string
    /** SMS message text */
    smsText?: string
  }
}

/**
 * Union of all function definition types
 */
export type FunctionDefinition<TArgs = unknown, TReturn = unknown> =
  | CodeFunctionDefinition<TArgs, TReturn>
  | GenerativeFunctionDefinition<TArgs, TReturn>
  | AgenticFunctionDefinition<TArgs, TReturn>
  | HumanFunctionDefinition<TArgs, TReturn>

/**
 * Result of defineFunction - a callable with metadata
 */
export interface DefinedFunction<TArgs = unknown, TReturn = unknown> {
  /** The original definition */
  definition: FunctionDefinition<TArgs, TReturn>
  /** Call the function */
  call: (args: TArgs) => Promise<TReturn>
  /** Get the function as a tool definition for AI */
  asTool: () => AIFunctionDefinition<TArgs, TReturn>
}

/**
 * Function registry for storing and retrieving defined functions
 *
 * Note: This is in-memory only. For persistence, use mdxai or mdxdb packages.
 */
export interface FunctionRegistry {
  /** Get a function by name */
  get(name: string): DefinedFunction | undefined
  /** Set/store a function */
  set(name: string, fn: DefinedFunction): void
  /** Check if a function exists */
  has(name: string): boolean
  /** List all function names */
  list(): string[]
  /** Delete a function */
  delete(name: string): boolean
  /** Clear all functions */
  clear(): void
}

/**
 * Result of auto-defining a function
 */
export interface AutoDefineResult {
  /** The determined function type */
  type: 'code' | 'generative' | 'agentic' | 'human'
  /** Reasoning for why this type was chosen */
  reasoning: string
  /** The complete function definition */
  definition: FunctionDefinition
}
