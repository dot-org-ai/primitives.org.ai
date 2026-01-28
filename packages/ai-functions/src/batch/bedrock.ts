/**
 * AWS Bedrock Batch Inference Adapter
 *
 * Implements batch processing using AWS Bedrock's batch inference API.
 * Bedrock batch inference provides cost-effective processing for large workloads.
 *
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference.html
 *
 * @packageDocumentation
 */

import {
  registerBatchAdapter,
  registerFlexAdapter,
  type BatchAdapter,
  type FlexAdapter,
  type BatchItem,
  type BatchJob,
  type BatchQueueOptions,
  type BatchResult,
  type BatchSubmitResult,
  type BatchStatus,
} from '../batch-queue.js'
import { schema as convertSchema } from '../schema.js'

// ============================================================================
// Types
// ============================================================================

interface BedrockBatchRequest {
  recordId: string
  modelInput: {
    anthropic_version?: string
    max_tokens: number
    messages: Array<{ role: string; content: string }>
    system?: string
    temperature?: number
  }
}

interface BedrockBatchResponse {
  recordId: string
  modelOutput?: {
    content: Array<{ type: string; text?: string }>
    usage: {
      input_tokens: number
      output_tokens: number
    }
    stop_reason: string
  }
  error?: {
    errorCode: string
    errorMessage: string
  }
}

interface BedrockBatchJobStatus {
  jobArn: string
  jobName: string
  status: 'Submitted' | 'InProgress' | 'Completed' | 'Failed' | 'Stopping' | 'Stopped'
  modelId: string
  inputDataConfig: {
    s3InputDataConfig: {
      s3Uri: string
    }
  }
  outputDataConfig: {
    s3OutputDataConfig: {
      s3Uri: string
    }
  }
  creationTime: string
  lastModifiedTime: string
  endTime?: string
  failureMessage?: string
  statistics?: {
    inputRecordCount: number
    outputRecordCount: number
    errorCount: number
  }
}

// ============================================================================
// AWS Configuration
// ============================================================================

let awsRegion: string | undefined
let awsAccessKeyId: string | undefined
let awsSecretAccessKey: string | undefined
let awsSessionToken: string | undefined
let s3Bucket: string | undefined
let roleArn: string | undefined

// AI Gateway configuration (optional - for routing through Cloudflare AI Gateway)
let gatewayUrl: string | undefined
let gatewayToken: string | undefined

/**
 * Configure AWS credentials and settings
 */
export function configureAWSBedrock(options: {
  region?: string
  accessKeyId?: string
  secretAccessKey?: string
  sessionToken?: string
  s3Bucket?: string
  roleArn?: string
  /** Optional: Cloudflare AI Gateway URL for routing requests */
  gatewayUrl?: string
  /** Optional: Cloudflare AI Gateway token */
  gatewayToken?: string
}): void {
  if (options.region) awsRegion = options.region
  if (options.accessKeyId) awsAccessKeyId = options.accessKeyId
  if (options.secretAccessKey) awsSecretAccessKey = options.secretAccessKey
  if (options.sessionToken) awsSessionToken = options.sessionToken
  if (options.s3Bucket) s3Bucket = options.s3Bucket
  if (options.roleArn) roleArn = options.roleArn
  if (options.gatewayUrl) gatewayUrl = options.gatewayUrl
  if (options.gatewayToken) gatewayToken = options.gatewayToken
}

function getConfig() {
  const region =
    awsRegion || process.env['AWS_REGION'] || process.env['AWS_DEFAULT_REGION'] || 'us-east-1'
  const accessKeyId = awsAccessKeyId || process.env['AWS_ACCESS_KEY_ID']
  const secretAccessKey = awsSecretAccessKey || process.env['AWS_SECRET_ACCESS_KEY']
  const sessionToken = awsSessionToken || process.env['AWS_SESSION_TOKEN']
  const bucket = s3Bucket || process.env['BEDROCK_BATCH_S3_BUCKET']
  const role = roleArn || process.env['BEDROCK_BATCH_ROLE_ARN']

  // Check for AI Gateway configuration
  const gwUrl = gatewayUrl || process.env['AI_GATEWAY_URL']
  const gwToken = gatewayToken || process.env['AI_GATEWAY_TOKEN']

  // If using gateway, we don't need AWS credentials
  if (gwUrl && gwToken) {
    return {
      region,
      accessKeyId: accessKeyId || '',
      secretAccessKey: secretAccessKey || '',
      sessionToken,
      bucket: bucket || '',
      role,
      gatewayUrl: gwUrl,
      gatewayToken: gwToken,
    }
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY, or use AI_GATEWAY_URL and AI_GATEWAY_TOKEN'
    )
  }

  if (!bucket) {
    throw new Error('S3 bucket for Bedrock batch not configured. Set BEDROCK_BATCH_S3_BUCKET')
  }

  return {
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    bucket,
    role,
    gatewayUrl: undefined,
    gatewayToken: undefined,
  }
}

// ============================================================================
// AWS Signature V4 (Simplified)
// ============================================================================

async function signRequest(
  method: string,
  url: string,
  body: string,
  config: ReturnType<typeof getConfig>,
  service: string
): Promise<Headers> {
  // In production, use @aws-sdk/signature-v4 or similar
  // This is a simplified implementation for demonstration

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Amz-Date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
  })

  if (config.sessionToken) {
    headers.set('X-Amz-Security-Token', config.sessionToken)
  }

  // For actual implementation, compute proper AWS Signature V4
  // This requires crypto operations that vary by environment

  // Fallback: Use AWS SDK if available
  try {
    // Dynamic import to avoid build-time dependency
    // @ts-expect-error - Optional dependency
    const signatureV4Module = await import('@smithy/signature-v4')
    // @ts-expect-error - Optional dependency
    const sha256Module = await import('@aws-crypto/sha256-js')

    const SignatureV4 = signatureV4Module.SignatureV4
    const Sha256 = sha256Module.Sha256

    const signer = new SignatureV4({
      service,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
      },
      sha256: Sha256,
    })

    const signedRequest = await signer.sign({
      method,
      headers: Object.fromEntries(headers.entries()),
      hostname: new URL(url).hostname,
      path: new URL(url).pathname,
      body,
    })

    return new Headers(signedRequest.headers as Record<string, string>)
  } catch {
    // AWS SDK not available - return basic headers
    // In production, the SDK should always be available
    console.warn(
      'AWS SDK not available for request signing. Install @smithy/signature-v4 and @aws-crypto/sha256-js'
    )
    return headers
  }
}

// ============================================================================
// In-memory job tracking
// ============================================================================

const pendingJobs = new Map<
  string,
  {
    items: BatchItem[]
    options: BatchQueueOptions
    jobArn?: string
    results: BatchResult[]
    status: BatchStatus
    createdAt: Date
    completedAt?: Date
  }
>()

let jobCounter = 0

// ============================================================================
// Bedrock Batch Adapter
// ============================================================================

/**
 * AWS Bedrock batch adapter
 *
 * Bedrock batch inference:
 * 1. Uploads input JSONL to S3
 * 2. Creates a batch inference job
 * 3. Results are written to S3
 * 4. Download and parse results
 *
 * Note: This requires S3 bucket access and proper IAM roles.
 */
const bedrockAdapter: BatchAdapter = {
  async submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult> {
    const config = getConfig()
    const jobId = `bedrock_batch_${++jobCounter}_${Date.now()}`

    // Default to Claude on Bedrock
    const model = options.model || 'anthropic.claude-3-sonnet-20240229-v1:0'

    // Store job state
    pendingJobs.set(jobId, {
      items,
      options,
      results: [],
      status: 'pending',
      createdAt: new Date(),
    })

    // For true Bedrock batch processing:
    // 1. Create JSONL file with requests
    // 2. Upload to S3
    // 3. Create batch inference job via Bedrock API
    // 4. Poll for completion
    // 5. Download and parse results from S3

    // For now, we implement a concurrent processing approach
    // (similar to Cloudflare) that works without S3 setup
    const completion = processBedrockRequestsConcurrently(jobId, items, config, model, options)

    const job: BatchJob = {
      id: jobId,
      provider: 'bedrock',
      status: 'pending',
      totalItems: items.length,
      completedItems: 0,
      failedItems: 0,
      createdAt: new Date(),
      ...(options.webhookUrl !== undefined && { webhookUrl: options.webhookUrl }),
    }

    return { job, completion }
  },

  async getStatus(batchId: string): Promise<BatchJob> {
    const job = pendingJobs.get(batchId)
    if (!job) {
      throw new Error(`Batch not found: ${batchId}`)
    }

    const completedItems = job.results.filter((r) => r.status === 'completed').length
    const failedItems = job.results.filter((r) => r.status === 'failed').length

    return {
      id: batchId,
      provider: 'bedrock',
      status: job.status,
      totalItems: job.items.length,
      completedItems,
      failedItems,
      createdAt: job.createdAt,
      ...(job.completedAt && { completedAt: job.completedAt }),
    }
  },

  async cancel(batchId: string): Promise<void> {
    const job = pendingJobs.get(batchId)
    if (job) {
      job.status = 'cancelled'

      // If we have a Bedrock job ARN, cancel it
      if (job.jobArn) {
        const config = getConfig()
        const url = `https://bedrock.${
          config.region
        }.amazonaws.com/model-invocation-job/${encodeURIComponent(job.jobArn)}/stop`

        try {
          await fetch(url, {
            method: 'POST',
            headers: await signRequest('POST', url, '', config, 'bedrock'),
          })
        } catch (error) {
          console.warn('Failed to cancel Bedrock job:', error)
        }
      }
    }
  },

  async getResults(batchId: string): Promise<BatchResult[]> {
    const job = pendingJobs.get(batchId)
    if (!job) {
      throw new Error(`Batch not found: ${batchId}`)
    }
    return job.results
  },

  async waitForCompletion(batchId: string, pollInterval = 5000): Promise<BatchResult[]> {
    const job = pendingJobs.get(batchId)
    if (!job) {
      throw new Error(`Batch not found: ${batchId}`)
    }

    while (job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    return job.results
  },
}

// ============================================================================
// Processing (Concurrent Mode)
// ============================================================================

/**
 * Process Bedrock requests concurrently
 * This is a fallback when true batch inference isn't configured
 */
async function processBedrockRequestsConcurrently(
  jobId: string,
  items: BatchItem[],
  config: ReturnType<typeof getConfig>,
  model: string,
  options: BatchQueueOptions
): Promise<BatchResult[]> {
  const job = pendingJobs.get(jobId)
  if (!job) {
    throw new Error(`Job not found: ${jobId}`)
  }

  job.status = 'in_progress'

  // Process with concurrency limit
  const CONCURRENCY = 5 // Bedrock has stricter rate limits
  const results: BatchResult[] = []

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY)

    const batchResults = await Promise.all(
      batch.map(async (item) => {
        try {
          return await processBedrockItem(item, config, model)
        } catch (error) {
          return {
            id: item.id,
            customId: item.id,
            status: 'failed' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      })
    )

    results.push(...batchResults)
    job.results = results

    // Respect rate limits
    if (i + CONCURRENCY < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  job.status = results.every((r) => r.status === 'completed') ? 'completed' : 'failed'
  job.completedAt = new Date()

  return results
}

async function processBedrockItem(
  item: BatchItem,
  config: ReturnType<typeof getConfig>,
  model: string
): Promise<BatchResult> {
  // Check if using AI Gateway
  if (config.gatewayUrl && config.gatewayToken) {
    return processBedrockItemViaGateway(item, config, model)
  }

  const url = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${encodeURIComponent(
    model
  )}/invoke`

  // Build the request body based on the model type
  let body: Record<string, unknown>

  if (model.includes('anthropic')) {
    // Anthropic models on Bedrock
    body = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: item.options?.maxTokens || 4096,
      messages: [{ role: 'user', content: item.prompt }],
      ...(item.options?.system !== undefined && { system: item.options.system }),
      ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
    }
  } else if (model.includes('amazon')) {
    // Amazon Titan models
    body = {
      inputText: item.prompt,
      textGenerationConfig: {
        maxTokenCount: item.options?.maxTokens || 4096,
        temperature: item.options?.temperature || 0.7,
      },
    }
  } else if (model.includes('meta')) {
    // Meta Llama models
    body = {
      prompt: item.prompt,
      max_gen_len: item.options?.maxTokens || 4096,
      temperature: item.options?.temperature || 0.7,
    }
  } else if (model.includes('mistral')) {
    // Mistral models
    body = {
      prompt: `<s>[INST] ${item.prompt} [/INST]`,
      max_tokens: item.options?.maxTokens || 4096,
      temperature: item.options?.temperature || 0.7,
    }
  } else {
    // Generic format (Claude-style)
    body = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: item.options?.maxTokens || 4096,
      messages: [{ role: 'user', content: item.prompt }],
      ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
    }
  }

  const bodyStr = JSON.stringify(body)
  const headers = await signRequest('POST', url, bodyStr, config, 'bedrock')

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyStr,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Bedrock API error: ${response.status} ${error}`)
  }

  const data = (await response.json()) as {
    // Anthropic format
    content?: Array<{ type: string; text?: string }>
    usage?: { input_tokens: number; output_tokens: number }
    // Titan format
    results?: Array<{ outputText: string; tokenCount: number }>
    // Llama/Mistral format
    generation?: string
    generation_token_count?: number
    prompt_token_count?: number
  }

  // Extract content based on model response format
  let content: string | undefined
  let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined

  if (data.content) {
    // Anthropic format
    const textContent = data.content.find((c) => c.type === 'text')
    content = textContent?.text
    if (data.usage) {
      usage = {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      }
    }
  } else if (data.results?.[0]) {
    // Titan format
    content = data.results[0].outputText
    usage = {
      promptTokens: 0, // Titan doesn't return this
      completionTokens: data.results[0].tokenCount || 0,
      totalTokens: data.results[0].tokenCount || 0,
    }
  } else if (data.generation) {
    // Llama/Mistral format
    content = data.generation
    if (data.generation_token_count !== undefined) {
      usage = {
        promptTokens: data.prompt_token_count || 0,
        completionTokens: data.generation_token_count,
        totalTokens: (data.prompt_token_count || 0) + data.generation_token_count,
      }
    }
  }

  let result: unknown = content

  // Try to parse JSON if schema was provided
  if (item.schema && content) {
    try {
      result = JSON.parse(content)
    } catch {
      // Keep as string
    }
  }

  return {
    id: item.id,
    customId: item.id,
    status: 'completed',
    result,
    ...(usage && { usage }),
  }
}

/**
 * Process a Bedrock item via Cloudflare AI Gateway
 *
 * NOTE: Unlike OpenAI and Google, Bedrock via AI Gateway still requires AWS Signature V4 signing.
 * The gateway routes the request but doesn't handle authentication.
 * @see https://developers.cloudflare.com/ai-gateway/usage/providers/bedrock/
 *
 * Gateway URL format: {gateway_url}/aws-bedrock/bedrock-runtime/{region}/model/{model}/invoke
 */
async function processBedrockItemViaGateway(
  item: BatchItem,
  config: ReturnType<typeof getConfig>,
  model: string
): Promise<BatchResult> {
  // AI Gateway URL for Bedrock - requires full path including region
  // Format: {gateway_url}/aws-bedrock/bedrock-runtime/{region}/model/{model}/invoke
  const url = `${config.gatewayUrl}/aws-bedrock/bedrock-runtime/${
    config.region
  }/model/${encodeURIComponent(model)}/invoke`

  // Build the request body (Anthropic format for Claude models)
  const body: Record<string, unknown> = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: item.options?.maxTokens || 4096,
    messages: [{ role: 'user', content: item.prompt }],
    ...(item.options?.system !== undefined && { system: item.options.system }),
    ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
  }

  const bodyStr = JSON.stringify(body)

  // NOTE: Bedrock via Gateway still requires AWS SigV4 signing
  // We need both the gateway token AND AWS credentials
  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error(
      'Bedrock via AI Gateway still requires AWS credentials for SigV4 signing. ' +
        'Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.'
    )
  }

  const headers = await signRequest('POST', url, bodyStr, config, 'bedrock')
  headers.set('cf-aig-authorization', `Bearer ${config.gatewayToken}`)

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyStr,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Bedrock via Gateway error: ${response.status} ${error}`)
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>
    usage?: { input_tokens: number; output_tokens: number }
  }

  // Extract content (Anthropic format)
  const textContent = data.content?.find((c) => c.type === 'text')
  let content = textContent?.text
  let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined

  if (data.usage) {
    usage = {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
      totalTokens: data.usage.input_tokens + data.usage.output_tokens,
    }
  }

  let result: unknown = content

  // Try to parse JSON if schema was provided
  if (item.schema && content) {
    try {
      result = JSON.parse(content)
    } catch {
      // Keep as string
    }
  }

  return {
    id: item.id,
    customId: item.id,
    status: 'completed',
    result,
    ...(usage && { usage }),
  }
}

// ============================================================================
// True Batch Inference (S3-based)
// ============================================================================

/**
 * Create and submit a true Bedrock batch inference job
 * This requires S3 bucket access and proper IAM setup
 */
export async function createBedrockBatchJob(
  items: BatchItem[],
  model: string,
  options: {
    jobName: string
    s3InputPrefix?: string
    s3OutputPrefix?: string
    roleArn: string
  }
): Promise<{ jobArn: string }> {
  const config = getConfig()

  // Build JSONL content
  const jsonlLines = items.map((item) => {
    const request: BedrockBatchRequest = {
      recordId: item.id,
      modelInput: {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: item.options?.maxTokens || 4096,
        messages: [{ role: 'user', content: item.prompt }],
        ...(item.options?.system !== undefined && { system: item.options.system }),
        ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
      },
    }
    return JSON.stringify(request)
  })

  const inputKey = `${options.s3InputPrefix || 'bedrock-batch/input'}/${options.jobName}.jsonl`
  const outputPrefix = `${options.s3OutputPrefix || 'bedrock-batch/output'}/${options.jobName}/`

  // Upload to S3
  // In production, use @aws-sdk/client-s3
  const s3Url = `https://${config.bucket}.s3.${config.region}.amazonaws.com/${inputKey}`
  const content = jsonlLines.join('\n')

  const s3Response = await fetch(s3Url, {
    method: 'PUT',
    headers: await signRequest('PUT', s3Url, content, config, 's3'),
    body: content,
  })

  if (!s3Response.ok) {
    throw new Error(`Failed to upload to S3: ${s3Response.status}`)
  }

  // Create batch inference job
  const jobUrl = `https://bedrock.${config.region}.amazonaws.com/model-invocation-job`
  const jobBody = JSON.stringify({
    jobName: options.jobName,
    modelId: model,
    roleArn: options.roleArn,
    inputDataConfig: {
      s3InputDataConfig: {
        s3Uri: `s3://${config.bucket}/${inputKey}`,
      },
    },
    outputDataConfig: {
      s3OutputDataConfig: {
        s3Uri: `s3://${config.bucket}/${outputPrefix}`,
      },
    },
  })

  const jobResponse = await fetch(jobUrl, {
    method: 'POST',
    headers: await signRequest('POST', jobUrl, jobBody, config, 'bedrock'),
    body: jobBody,
  })

  if (!jobResponse.ok) {
    const error = await jobResponse.text()
    throw new Error(`Failed to create Bedrock batch job: ${jobResponse.status} ${error}`)
  }

  const jobData = (await jobResponse.json()) as { jobArn: string }
  return jobData
}

// ============================================================================
// Register Adapter
// ============================================================================

// ============================================================================
// Bedrock Flex Adapter
// ============================================================================

/**
 * AWS Bedrock Flex Adapter
 *
 * Flex processing uses concurrent requests for medium-sized batches (5-500 items).
 * This provides a balance between:
 * - Immediate execution (fast but full price, <5 items)
 * - Full batch inference (50% discount but 24hr turnaround, 500+ items)
 *
 * Flex tier uses concurrent API calls with rate limiting, providing results
 * in minutes rather than hours while still benefiting from efficient processing.
 */
const bedrockFlexAdapter: FlexAdapter = {
  async submitFlex(items: BatchItem[], options: { model?: string }): Promise<BatchResult[]> {
    const config = getConfig()
    const model = options.model || 'anthropic.claude-3-sonnet-20240229-v1:0'
    const CONCURRENCY = 8 // Bedrock has stricter rate limits than OpenAI

    const results: BatchResult[] = []

    // Process items concurrently with rate limiting
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const batch = items.slice(i, i + CONCURRENCY)

      const batchResults = await Promise.all(
        batch.map(async (item) => {
          try {
            return await processBedrockItem(item, config, model)
          } catch (error) {
            return {
              id: item.id,
              customId: item.id,
              status: 'failed' as const,
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          }
        })
      )

      results.push(...batchResults)

      // Add delay between batches to respect rate limits
      if (i + CONCURRENCY < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }

    return results
  },
}

// ============================================================================
// Register Adapters
// ============================================================================

registerBatchAdapter('bedrock', bedrockAdapter)
registerFlexAdapter('bedrock', bedrockFlexAdapter)

export { bedrockAdapter, bedrockFlexAdapter }
