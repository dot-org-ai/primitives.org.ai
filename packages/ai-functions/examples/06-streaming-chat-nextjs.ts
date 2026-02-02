/**
 * Streaming Chat UI Example (Next.js Compatible)
 *
 * This example demonstrates building a streaming chat interface using ai-functions.
 * It shows how to:
 * - Stream responses in real-time
 * - Handle partial object streaming
 * - Integrate with frontend frameworks
 * - Manage conversation state
 *
 * Note: This example simulates the streaming behavior. In a real Next.js app,
 * you would use this in an API route or server action.
 *
 * @example
 * ```bash
 * ANTHROPIC_API_KEY=sk-... npx tsx examples/06-streaming-chat-nextjs.ts
 * ```
 */

import { ai, write, list, configure, AIPromise } from '../src/index.js'

// ============================================================================
// Types
// ============================================================================

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  streaming?: boolean
  metadata?: {
    model?: string
    tokens?: number
    latencyMs?: number
  }
}

interface ChatState {
  messages: Message[]
  isStreaming: boolean
  error?: string
}

interface StreamChunk {
  type: 'text' | 'partial' | 'complete' | 'error'
  content: string
  partial?: unknown
}

// ============================================================================
// Chat Implementation
// ============================================================================

class StreamingChat {
  private messages: Message[] = []
  private model: string
  private systemPrompt: string

  constructor(options: { model?: string; systemPrompt?: string } = {}) {
    this.model = options.model || 'sonnet'
    this.systemPrompt =
      options.systemPrompt ||
      'You are a helpful assistant. Be concise but thorough in your responses.'
  }

  /**
   * Get conversation history
   */
  getMessages(): Message[] {
    return [...this.messages]
  }

  /**
   * Add a user message
   */
  addUserMessage(content: string): Message {
    const message: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    }
    this.messages.push(message)
    return message
  }

  /**
   * Send a message and get a streaming response
   *
   * In Next.js, this would be used in an API route:
   * ```ts
   * // app/api/chat/route.ts
   * export async function POST(req: Request) {
   *   const { message } = await req.json()
   *   const stream = chat.streamResponse(message)
   *
   *   return new Response(stream, {
   *     headers: { 'Content-Type': 'text/event-stream' }
   *   })
   * }
   * ```
   */
  async *streamResponse(userMessage: string): AsyncGenerator<StreamChunk> {
    // Add user message
    this.addUserMessage(userMessage)

    // Build context from conversation history
    const context = this.messages
      .slice(-10) // Last 10 messages for context
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')

    const startTime = Date.now()

    try {
      // Create the AI prompt
      const response = write`${this.systemPrompt}

Conversation history:
${context}

Respond to the user's last message naturally and helpfully.`

      // Get the streaming interface
      const stream = response.stream()

      // Create placeholder assistant message
      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        streaming: true,
      }
      this.messages.push(assistantMessage)

      let fullContent = ''

      // Stream text chunks
      for await (const chunk of stream.textStream) {
        fullContent += chunk
        assistantMessage.content = fullContent

        yield {
          type: 'text',
          content: chunk,
        }
      }

      // Finalize message
      assistantMessage.streaming = false
      assistantMessage.metadata = {
        model: this.model,
        latencyMs: Date.now() - startTime,
      }

      yield {
        type: 'complete',
        content: fullContent,
      }
    } catch (error) {
      yield {
        type: 'error',
        content: (error as Error).message,
      }
    }
  }

  /**
   * Get a non-streaming response (simpler for testing)
   */
  async sendMessage(userMessage: string): Promise<Message> {
    this.addUserMessage(userMessage)

    const context = this.messages
      .slice(-10)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n')

    const startTime = Date.now()

    const response = await write`${this.systemPrompt}

Conversation history:
${context}

Respond to the user's last message naturally and helpfully.`

    const assistantMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      metadata: {
        model: this.model,
        latencyMs: Date.now() - startTime,
      },
    }

    this.messages.push(assistantMessage)
    return assistantMessage
  }

  /**
   * Clear conversation
   */
  clear(): void {
    this.messages = []
  }
}

// ============================================================================
// Structured Response Streaming
// ============================================================================

interface AnalysisResult {
  summary: string
  keyPoints: string[]
  sentiment: string
  confidence: number
}

async function streamStructuredResponse(text: string): Promise<void> {
  console.log('\n--- Structured Response Streaming ---')
  console.log('Analyzing text with streaming partial objects...\n')

  const analysis = ai`Analyze this text:
"${text}"

Provide:
- summary: brief summary of the text
- keyPoints: array of 3-5 key points
- sentiment: positive/negative/neutral
- confidence: confidence score 0-1`

  // Access properties to set schema
  const { summary, keyPoints, sentiment, confidence } = analysis

  const stream = analysis.stream()

  console.log('Streaming partial objects:')
  for await (const partial of stream.partialObjectStream) {
    // Clear line and show current partial object
    process.stdout.write('\r\x1b[K')
    const p = partial as Partial<AnalysisResult>
    const status = [
      p.summary ? 'summary' : '',
      p.keyPoints?.length ? `keyPoints(${p.keyPoints.length})` : '',
      p.sentiment ? 'sentiment' : '',
      p.confidence !== undefined ? 'confidence' : '',
    ]
      .filter(Boolean)
      .join(', ')
    process.stdout.write(`Received: ${status}`)
  }

  const result = await stream.result
  console.log('\n\nFinal result:', JSON.stringify(result, null, 2))
}

// ============================================================================
// React Hooks Simulation (for documentation)
// ============================================================================

/**
 * Example React hook for streaming chat (for reference)
 *
 * ```tsx
 * // hooks/useStreamingChat.ts
 * import { useState, useCallback } from 'react'
 *
 * export function useStreamingChat() {
 *   const [messages, setMessages] = useState<Message[]>([])
 *   const [isStreaming, setIsStreaming] = useState(false)
 *
 *   const sendMessage = useCallback(async (content: string) => {
 *     setIsStreaming(true)
 *
 *     // Add user message
 *     const userMsg: Message = {
 *       id: Date.now().toString(),
 *       role: 'user',
 *       content,
 *       timestamp: new Date(),
 *     }
 *     setMessages(prev => [...prev, userMsg])
 *
 *     // Create placeholder for assistant
 *     const assistantMsg: Message = {
 *       id: (Date.now() + 1).toString(),
 *       role: 'assistant',
 *       content: '',
 *       timestamp: new Date(),
 *       streaming: true,
 *     }
 *     setMessages(prev => [...prev, assistantMsg])
 *
 *     // Stream from API
 *     const response = await fetch('/api/chat', {
 *       method: 'POST',
 *       body: JSON.stringify({ message: content }),
 *     })
 *
 *     const reader = response.body?.getReader()
 *     const decoder = new TextDecoder()
 *
 *     while (reader) {
 *       const { done, value } = await reader.read()
 *       if (done) break
 *
 *       const chunk = decoder.decode(value)
 *       setMessages(prev => {
 *         const msgs = [...prev]
 *         const last = msgs[msgs.length - 1]
 *         if (last.role === 'assistant') {
 *           last.content += chunk
 *         }
 *         return msgs
 *       })
 *     }
 *
 *     setIsStreaming(false)
 *   }, [])
 *
 *   return { messages, isStreaming, sendMessage }
 * }
 * ```
 */

// ============================================================================
// Terminal UI Simulation
// ============================================================================

function displayMessage(message: Message): void {
  const roleColor = message.role === 'user' ? '\x1b[36m' : '\x1b[32m'
  const reset = '\x1b[0m'
  const prefix = message.role === 'user' ? 'You' : 'Assistant'

  console.log(`\n${roleColor}${prefix}:${reset} ${message.content}`)

  if (message.metadata?.latencyMs) {
    console.log(`\x1b[90m  (${message.metadata.latencyMs}ms)${reset}`)
  }
}

async function simulateStreamingUI(chat: StreamingChat, message: string): Promise<void> {
  console.log(`\n\x1b[36mYou:\x1b[0m ${message}`)

  // Add user message
  chat.addUserMessage(message)

  // Build response like we would in the streaming method
  const context = chat
    .getMessages()
    .slice(-10)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')

  process.stdout.write('\n\x1b[32mAssistant:\x1b[0m ')

  const response = write`You are a helpful assistant. Be concise but thorough.

Conversation history:
${context}

Respond to the user's last message naturally and helpfully.`

  // Since streaming requires gateway, we'll show non-streaming with simulated delay
  const fullResponse = await response

  // Simulate streaming output
  for (const char of fullResponse) {
    process.stdout.write(char)
    await new Promise((r) => setTimeout(r, 10))
  }

  console.log('')
}

// ============================================================================
// Main Example
// ============================================================================

async function main() {
  console.log('\n=== Streaming Chat UI Example ===\n')

  // Configure the AI provider
  configure({
    model: 'sonnet',
    provider: 'anthropic',
  })

  // Create chat instance
  const chat = new StreamingChat({
    systemPrompt:
      'You are a friendly and helpful assistant. Keep responses concise but informative.',
  })

  console.log('Simulating a streaming chat interface...')
  console.log('(In Next.js, you would use Server-Sent Events or WebSockets)\n')

  // Simulate a conversation
  const conversation = [
    'What are the key features of ai-functions?',
    'How does streaming work?',
    'Can you give me a code example?',
  ]

  for (const message of conversation) {
    await simulateStreamingUI(chat, message)
    console.log('')
    await new Promise((r) => setTimeout(r, 500))
  }

  // Show structured streaming
  await streamStructuredResponse(
    'The new product launch exceeded expectations with a 40% increase in sales.'
  )

  // Display conversation summary
  console.log('\n--- Conversation Summary ---')
  const messages = chat.getMessages()
  console.log(`Total messages: ${messages.length}`)
  console.log(`User messages: ${messages.filter((m) => m.role === 'user').length}`)
  console.log(`Assistant messages: ${messages.filter((m) => m.role === 'assistant').length}`)
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
