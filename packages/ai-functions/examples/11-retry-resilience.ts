/**
 * Retry and Resilience Patterns Example
 *
 * This example demonstrates building resilient AI applications using ai-functions.
 * It shows how to:
 * - Implement retry logic with exponential backoff
 * - Use circuit breakers for fail-fast behavior
 * - Create fallback chains across models
 * - Handle rate limits and transient errors
 *
 * @example
 * ```bash
 * ANTHROPIC_API_KEY=sk-... npx tsx examples/11-retry-resilience.ts
 * ```
 */

import {
  write,
  ai,
  configure,
  withRetry,
  RetryPolicy,
  CircuitBreaker,
  FallbackChain,
  RetryableError,
  RateLimitError,
  classifyError,
  calculateBackoff,
  type RetryOptions,
  type JitterStrategy,
} from '../src/index.js'

// ============================================================================
// Basic Retry with withRetry
// ============================================================================

async function basicRetryExample(): Promise<void> {
  console.log('\n=== Basic Retry with withRetry() ===\n')

  // Simple retry wrapper
  const reliableGenerate = async (prompt: string): Promise<string> => {
    return withRetry(async () => write`${prompt}`, {
      maxRetries: 3,
      baseDelay: 1000,
      jitter: 0.2, // Add 20% random jitter
    })
  }

  console.log('Generating with retry protection...')
  const result = await reliableGenerate('Say hello in one word')
  console.log(`Result: ${result}`)
}

// ============================================================================
// RetryPolicy - Advanced Configuration
// ============================================================================

async function retryPolicyExample(): Promise<void> {
  console.log('\n=== RetryPolicy - Advanced Configuration ===\n')

  // Create a reusable retry policy
  const policy = new RetryPolicy({
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    jitterStrategy: 'decorrelated', // Better than simple jitter for distributed systems
    shouldRetry: (error, attempt) => {
      // Custom retry decision logic
      console.log(`  Attempt ${attempt}: ${error.message}`)

      // Don't retry authentication errors
      if (error.message.includes('auth')) {
        return false
      }

      // Retry rate limits with longer delay
      if (error.message.includes('rate limit')) {
        return true
      }

      return attempt < 5
    },
    onRetry: (error, attempt, delay) => {
      console.log(`  Retrying in ${delay}ms (attempt ${attempt})...`)
    },
  })

  // Simulate a function that might fail
  let attempts = 0
  const flakyFunction = async (): Promise<string> => {
    attempts++
    if (attempts < 3) {
      throw new RetryableError('Temporary failure')
    }
    return 'Success!'
  }

  console.log('Executing with RetryPolicy...')
  try {
    const result = await policy.execute(flakyFunction)
    console.log(`Result: ${result} (after ${attempts} attempts)`)
  } catch (error) {
    console.log(`Failed: ${(error as Error).message}`)
  }
}

// ============================================================================
// Jitter Strategies
// ============================================================================

async function jitterStrategiesExample(): Promise<void> {
  console.log('\n=== Jitter Strategies ===\n')

  const strategies: JitterStrategy[] = ['none', 'full', 'equal', 'decorrelated']

  console.log('Backoff delays with different jitter strategies:')
  console.log('(Base delay: 1000ms, Max delay: 30000ms)\n')

  for (const strategy of strategies) {
    console.log(`${strategy}:`)
    let prevDelay = 1000

    for (let attempt = 1; attempt <= 5; attempt++) {
      const delay = calculateBackoff(attempt, {
        baseDelay: 1000,
        maxDelay: 30000,
        jitterStrategy: strategy,
        previousDelay: prevDelay,
      })
      console.log(`  Attempt ${attempt}: ${Math.round(delay)}ms`)
      prevDelay = delay
    }
    console.log('')
  }
}

// ============================================================================
// Circuit Breaker Pattern
// ============================================================================

async function circuitBreakerExample(): Promise<void> {
  console.log('\n=== Circuit Breaker Pattern ===\n')

  const breaker = new CircuitBreaker({
    failureThreshold: 3, // Open after 3 failures
    resetTimeout: 5000, // Try again after 5 seconds
    halfOpenMaxAttempts: 2, // Allow 2 attempts in half-open
    onStateChange: (from, to) => {
      console.log(`  Circuit state: ${from} -> ${to}`)
    },
  })

  // Simulate failures
  let callCount = 0
  const unreliableService = async (): Promise<string> => {
    callCount++
    if (callCount <= 4) {
      throw new Error('Service unavailable')
    }
    return 'Success!'
  }

  console.log('Making calls through circuit breaker...\n')

  for (let i = 1; i <= 8; i++) {
    try {
      const result = await breaker.execute(unreliableService)
      console.log(`  Call ${i}: ${result}`)
    } catch (error) {
      console.log(`  Call ${i}: ${(error as Error).message}`)
    }

    // Small delay between calls
    await new Promise((r) => setTimeout(r, 500))
  }

  // Show circuit metrics
  const metrics = breaker.getMetrics()
  console.log('\nCircuit Breaker Metrics:')
  console.log(`  State: ${metrics.state}`)
  console.log(`  Failures: ${metrics.failures}`)
  console.log(`  Successes: ${metrics.successes}`)
  console.log(`  Consecutive Failures: ${metrics.consecutiveFailures}`)
}

// ============================================================================
// Fallback Chain
// ============================================================================

async function fallbackChainExample(): Promise<void> {
  console.log('\n=== Fallback Chain ===\n')

  // Simulate different model behaviors
  const claudeCall = async () => {
    console.log('  Trying Claude Sonnet...')
    // Simulate occasional failure
    if (Math.random() < 0.7) {
      throw new Error('Claude temporarily unavailable')
    }
    return 'Response from Claude Sonnet'
  }

  const gptCall = async () => {
    console.log('  Trying GPT-4o...')
    // Simulate occasional failure
    if (Math.random() < 0.5) {
      throw new Error('GPT-4o rate limited')
    }
    return 'Response from GPT-4o'
  }

  const haikuCall = async () => {
    console.log('  Trying Claude Haiku...')
    return 'Response from Claude Haiku (fallback)'
  }

  // Create fallback chain
  const chain = new FallbackChain([
    { name: 'claude-sonnet', execute: claudeCall },
    { name: 'gpt-4o', execute: gptCall },
    { name: 'claude-haiku', execute: haikuCall }, // Always succeeds
  ])

  console.log('Executing with fallback chain:\n')

  // Try a few times to see different paths
  for (let i = 1; i <= 3; i++) {
    console.log(`Attempt ${i}:`)
    const result = await chain.execute()
    console.log(`  Result: ${result}\n`)
  }

  // Show metrics
  const metrics = chain.getMetrics()
  console.log('Fallback Chain Metrics:')
  for (const [name, m] of Object.entries(metrics)) {
    console.log(`  ${name}: ${m.successes} successes, ${m.failures} failures`)
  }
}

// ============================================================================
// Error Classification
// ============================================================================

async function errorClassificationExample(): Promise<void> {
  console.log('\n=== Error Classification ===\n')

  const errors = [
    new Error('Request timeout'),
    new Error('Rate limit exceeded'),
    new Error('Invalid API key'),
    new Error('Connection refused'),
    new Error('Internal server error'),
    new RateLimitError('Too many requests', 60),
  ]

  console.log('Classifying errors:\n')

  for (const error of errors) {
    const category = classifyError(error)
    const shouldRetry = category === 'transient' || category === 'rate_limit'

    console.log(`  "${error.message}"`)
    console.log(`    Category: ${category}`)
    console.log(`    Should retry: ${shouldRetry}`)

    if (error instanceof RateLimitError) {
      console.log(`    Retry after: ${error.retryAfter}s`)
    }
    console.log('')
  }
}

// ============================================================================
// Combined Resilience Pattern
// ============================================================================

async function combinedResilienceExample(): Promise<void> {
  console.log('\n=== Combined Resilience Pattern ===\n')

  // Create circuit breaker
  const breaker = new CircuitBreaker({
    failureThreshold: 5,
    resetTimeout: 10000,
  })

  // Create retry policy
  const retryPolicy = new RetryPolicy({
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 5000,
    jitterStrategy: 'decorrelated',
  })

  // Create fallback chain
  const fallbackChain = new FallbackChain([
    {
      name: 'primary',
      execute: async () => {
        // Wrap in circuit breaker and retry
        return breaker.execute(() =>
          retryPolicy.execute(async () => {
            // Simulate primary service
            return write`Hello world`
          })
        )
      },
    },
    {
      name: 'fallback',
      execute: async () => {
        // Simpler fallback with just retry
        return retryPolicy.execute(async () => {
          return 'Fallback response'
        })
      },
    },
  ])

  console.log('Combined resilience: Fallback -> Circuit Breaker -> Retry\n')

  const result = await fallbackChain.execute()
  console.log(`Result: ${result}`)

  console.log(`
This pattern provides:
1. Automatic retries with exponential backoff
2. Circuit breaker to prevent cascading failures
3. Fallback to alternative services when primary fails
`)
}

// ============================================================================
// Production Recommendations
// ============================================================================

function showProductionRecommendations(): void {
  console.log('\n=== Production Recommendations ===\n')

  console.log(`
1. RETRY CONFIGURATION
   - Start with 3 retries, adjust based on SLAs
   - Use decorrelated jitter for distributed systems
   - Set maxDelay to prevent infinite waits
   - Respect Retry-After headers from providers

2. CIRCUIT BREAKER
   - Set failureThreshold based on error budget
   - resetTimeout should match service recovery time
   - Monitor state changes for alerting
   - Use separate breakers for different services

3. FALLBACK CHAINS
   - Order by quality: best -> acceptable -> minimal
   - Consider cost differences between models
   - Log which model was used for debugging
   - Set timeouts per fallback option

4. ERROR HANDLING
   - Classify errors to determine retry strategy
   - Don't retry authentication errors
   - Rate limit errors: use Retry-After header
   - Log all errors with request IDs

5. MONITORING
   - Track retry rates and success/failure ratios
   - Alert on circuit breaker state changes
   - Monitor fallback usage patterns
   - Set up dashboards for resilience metrics
`)
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('\n=== Retry and Resilience Patterns Example ===')

  configure({
    model: 'sonnet',
    provider: 'anthropic',
  })

  await basicRetryExample()
  await retryPolicyExample()
  await jitterStrategiesExample()
  await circuitBreakerExample()
  await fallbackChainExample()
  await errorClassificationExample()
  await combinedResilienceExample()
  showProductionRecommendations()
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
