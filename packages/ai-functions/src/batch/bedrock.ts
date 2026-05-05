/**
 * AWS Bedrock Batch Inference Adapter
 *
 * Bedrock has a true batch inference API (S3-driven) and a runtime invoke API.
 * The "batch" adapter here uses concurrent runtime invocations as a fallback
 * (no S3 setup required); `createBedrockBatchJob` is exported separately for
 * callers who want to drive the real S3-based batch flow directly.
 *
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/batch-inference.html
 *
 * @packageDocumentation
 */

import { getLogger } from '../logger.js'
import {
  LocalJobStore,
  processConcurrently,
  registerBatchAdapter,
  registerFlexAdapter,
  tryParseJson,
  type BatchAdapter,
  type BatchItem,
  type BatchJob,
  type BatchQueueOptions,
  type BatchResult,
  type BatchSubmitResult,
  type FlexAdapter,
} from './provider.js'

// ============================================================================
// Provider-specific types
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

// ============================================================================
// AWS configuration
// ============================================================================

let awsRegion: string | undefined
let awsAccessKeyId: string | undefined
let awsSecretAccessKey: string | undefined
let awsSessionToken: string | undefined
let s3Bucket: string | undefined
let roleArn: string | undefined

let gatewayUrl: string | undefined
let gatewayToken: string | undefined

/** Configure AWS credentials and settings. */
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

interface BedrockConfig {
  region: string
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string | undefined
  bucket: string
  role: string | undefined
  gatewayUrl: string | undefined
  gatewayToken: string | undefined
}

function getConfig(): BedrockConfig {
  const region =
    awsRegion || process.env['AWS_REGION'] || process.env['AWS_DEFAULT_REGION'] || 'us-east-1'
  const accessKeyId = awsAccessKeyId || process.env['AWS_ACCESS_KEY_ID']
  const secretAccessKey = awsSecretAccessKey || process.env['AWS_SECRET_ACCESS_KEY']
  const sessionToken = awsSessionToken || process.env['AWS_SESSION_TOKEN']
  const bucket = s3Bucket || process.env['BEDROCK_BATCH_S3_BUCKET']
  const role = roleArn || process.env['BEDROCK_BATCH_ROLE_ARN']

  const gwUrl = gatewayUrl || process.env['AI_GATEWAY_URL']
  const gwToken = gatewayToken || process.env['AI_GATEWAY_TOKEN']

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
// AWS SigV4 (delegated to optional @smithy/signature-v4 if available)
// ============================================================================

async function signRequest(
  method: string,
  url: string,
  body: string,
  config: BedrockConfig,
  service: string
): Promise<Headers> {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Amz-Date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
  })

  if (config.sessionToken) {
    headers.set('X-Amz-Security-Token', config.sessionToken)
  }

  try {
    // Optional dependency — present in production, absent in dev/test.
    // @ts-expect-error - Optional dependency
    const signatureV4Module = await import('@smithy/signature-v4')
    // @ts-expect-error - Optional dependency
    const sha256Module = await import('@aws-crypto/sha256-js')

    const signer = new signatureV4Module.SignatureV4({
      service,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        sessionToken: config.sessionToken,
      },
      sha256: sha256Module.Sha256,
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
    getLogger().warn(
      'AWS SDK not available for request signing. Install @smithy/signature-v4 and @aws-crypto/sha256-js'
    )
    return headers
  }
}

// ============================================================================
// Local job tracking
// ============================================================================

const jobs = new LocalJobStore('bedrock_batch')

// ============================================================================
// Bedrock batch adapter (BatchProvider port)
// ============================================================================

const bedrockAdapter: BatchAdapter = {
  async submit(items: BatchItem[], options: BatchQueueOptions): Promise<BatchSubmitResult> {
    const config = getConfig()
    const model = options.model || 'anthropic.claude-3-sonnet-20240229-v1:0'
    const { id, state } = jobs.create(items, options)

    // Drive the job state machine in the background.
    const completion = (async () => {
      state.status = 'in_progress'
      const results = await processConcurrently(
        items,
        (item) => processBedrockItem(item, config, model),
        {
          concurrency: 5, // Bedrock has stricter rate limits.
          delayBetweenWaves: 1000,
          onWaveComplete: (partial) => {
            state.results = partial
          },
        }
      )
      state.results = results
      state.status = results.every((r) => r.status === 'completed') ? 'completed' : 'failed'
      state.completedAt = new Date()
      return results
    })()

    const job: BatchJob = {
      id,
      provider: 'bedrock',
      status: 'pending',
      totalItems: items.length,
      completedItems: 0,
      failedItems: 0,
      createdAt: state.createdAt,
      ...(options.webhookUrl !== undefined && { webhookUrl: options.webhookUrl }),
    }

    return { job, completion }
  },

  async getStatus(batchId: string): Promise<BatchJob> {
    return jobs.snapshot(batchId, 'bedrock')
  },

  async cancel(batchId: string): Promise<void> {
    if (!jobs.has(batchId)) return
    const state = jobs.get(batchId)
    state.status = 'cancelled'

    const jobArn = state.meta?.['jobArn'] as string | undefined
    if (jobArn) {
      const config = getConfig()
      const url = `https://bedrock.${
        config.region
      }.amazonaws.com/model-invocation-job/${encodeURIComponent(jobArn)}/stop`
      try {
        await fetch(url, {
          method: 'POST',
          headers: await signRequest('POST', url, '', config, 'bedrock'),
        })
      } catch (error) {
        getLogger().warn('Failed to cancel Bedrock job:', error)
      }
    }
  },

  async getResults(batchId: string): Promise<BatchResult[]> {
    return jobs.get(batchId).results
  },

  async waitForCompletion(batchId: string, pollInterval = 5000): Promise<BatchResult[]> {
    return jobs.waitForCompletion(batchId, pollInterval)
  },
}

// ============================================================================
// Per-item processing
// ============================================================================

async function processBedrockItem(
  item: BatchItem,
  config: BedrockConfig,
  model: string
): Promise<BatchResult> {
  if (config.gatewayUrl && config.gatewayToken) {
    return processBedrockItemViaGateway(item, config, model)
  }

  const url = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${encodeURIComponent(
    model
  )}/invoke`

  const body = buildBedrockRequestBody(item, model)
  const bodyStr = JSON.stringify(body)
  const headers = await signRequest('POST', url, bodyStr, config, 'bedrock')

  const response = await fetch(url, { method: 'POST', headers, body: bodyStr })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Bedrock API error: ${response.status} ${error}`)
  }

  return parseBedrockResponse(item, await response.json())
}

/**
 * Process a Bedrock item via Cloudflare AI Gateway.
 *
 * Note: AI Gateway routes the request but doesn't handle authentication —
 * Bedrock still requires AWS SigV4 signing.
 * @see https://developers.cloudflare.com/ai-gateway/usage/providers/bedrock/
 */
async function processBedrockItemViaGateway(
  item: BatchItem,
  config: BedrockConfig,
  model: string
): Promise<BatchResult> {
  const url = `${config.gatewayUrl}/aws-bedrock/bedrock-runtime/${
    config.region
  }/model/${encodeURIComponent(model)}/invoke`

  const body: Record<string, unknown> = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: item.options?.maxTokens || 4096,
    messages: [{ role: 'user', content: item.prompt }],
    ...(item.options?.system !== undefined && { system: item.options.system }),
    ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
  }

  const bodyStr = JSON.stringify(body)

  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error(
      'Bedrock via AI Gateway still requires AWS credentials for SigV4 signing. ' +
        'Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.'
    )
  }

  const headers = await signRequest('POST', url, bodyStr, config, 'bedrock')
  headers.set('cf-aig-authorization', `Bearer ${config.gatewayToken}`)

  const response = await fetch(url, { method: 'POST', headers, body: bodyStr })
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Bedrock via Gateway error: ${response.status} ${error}`)
  }

  return parseBedrockResponse(item, await response.json())
}

/** Build the Bedrock invoke body for the model family. */
function buildBedrockRequestBody(item: BatchItem, model: string): Record<string, unknown> {
  if (model.includes('anthropic')) {
    return {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: item.options?.maxTokens || 4096,
      messages: [{ role: 'user', content: item.prompt }],
      ...(item.options?.system !== undefined && { system: item.options.system }),
      ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
    }
  }
  if (model.includes('amazon')) {
    return {
      inputText: item.prompt,
      textGenerationConfig: {
        maxTokenCount: item.options?.maxTokens || 4096,
        temperature: item.options?.temperature || 0.7,
      },
    }
  }
  if (model.includes('meta')) {
    return {
      prompt: item.prompt,
      max_gen_len: item.options?.maxTokens || 4096,
      temperature: item.options?.temperature || 0.7,
    }
  }
  if (model.includes('mistral')) {
    return {
      prompt: `<s>[INST] ${item.prompt} [/INST]`,
      max_tokens: item.options?.maxTokens || 4096,
      temperature: item.options?.temperature || 0.7,
    }
  }
  // Default: Claude-style.
  return {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: item.options?.maxTokens || 4096,
    messages: [{ role: 'user', content: item.prompt }],
    ...(item.options?.temperature !== undefined && { temperature: item.options.temperature }),
  }
}

/** Parse a Bedrock invoke response across model families. */
function parseBedrockResponse(item: BatchItem, raw: unknown): BatchResult {
  const data = raw as {
    content?: Array<{ type: string; text?: string }>
    usage?: { input_tokens: number; output_tokens: number }
    results?: Array<{ outputText: string; tokenCount: number }>
    generation?: string
    generation_token_count?: number
    prompt_token_count?: number
  }

  let content: string | undefined
  let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined

  if (data.content) {
    content = data.content.find((c) => c.type === 'text')?.text
    if (data.usage) {
      usage = {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      }
    }
  } else if (data.results?.[0]) {
    content = data.results[0].outputText
    usage = {
      promptTokens: 0,
      completionTokens: data.results[0].tokenCount || 0,
      totalTokens: data.results[0].tokenCount || 0,
    }
  } else if (data.generation) {
    content = data.generation
    if (data.generation_token_count !== undefined) {
      usage = {
        promptTokens: data.prompt_token_count || 0,
        completionTokens: data.generation_token_count,
        totalTokens: (data.prompt_token_count || 0) + data.generation_token_count,
      }
    }
  }

  return {
    id: item.id,
    customId: item.id,
    status: 'completed',
    result: tryParseJson(content, !!item.schema),
    ...(usage && { usage }),
  }
}

// ============================================================================
// True S3-based batch inference (separate from the BatchProvider adapter)
// ============================================================================

/**
 * Create and submit a true Bedrock batch inference job.
 * Requires S3 bucket access and proper IAM setup.
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

  const jsonlLines = items.map((item) => {
    const request: BedrockBatchRequest = {
      recordId: item.id,
      modelInput: {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: item.options?.maxTokens || 4096,
        messages: [{ role: 'user', content: item.prompt }],
        ...(item.options?.system !== undefined && { system: item.options.system }),
        ...(item.options?.temperature !== undefined && {
          temperature: item.options.temperature,
        }),
      },
    }
    return JSON.stringify(request)
  })

  const inputKey = `${options.s3InputPrefix || 'bedrock-batch/input'}/${options.jobName}.jsonl`
  const outputPrefix = `${options.s3OutputPrefix || 'bedrock-batch/output'}/${options.jobName}/`

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

  const jobUrl = `https://bedrock.${config.region}.amazonaws.com/model-invocation-job`
  const jobBody = JSON.stringify({
    jobName: options.jobName,
    modelId: model,
    roleArn: options.roleArn,
    inputDataConfig: {
      s3InputDataConfig: { s3Uri: `s3://${config.bucket}/${inputKey}` },
    },
    outputDataConfig: {
      s3OutputDataConfig: { s3Uri: `s3://${config.bucket}/${outputPrefix}` },
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
// Bedrock flex adapter (FlexAdapter port)
// ============================================================================

const bedrockFlexAdapter: FlexAdapter = {
  async submitFlex(items: BatchItem[], options: { model?: string }): Promise<BatchResult[]> {
    const config = getConfig()
    const model = options.model || 'anthropic.claude-3-sonnet-20240229-v1:0'
    return processConcurrently(items, (item) => processBedrockItem(item, config, model), {
      concurrency: 8,
      delayBetweenWaves: 500,
    })
  },
}

// ============================================================================
// Register adapters
// ============================================================================

registerBatchAdapter('bedrock', bedrockAdapter)
registerFlexAdapter('bedrock', bedrockFlexAdapter)

export { bedrockAdapter, bedrockFlexAdapter }
