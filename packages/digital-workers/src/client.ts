/**
 * RPC Client for Digital Workers
 *
 * Provides a typed RPC client that connects to the deployed
 * digital-workers worker using rpc.do for remote procedure calls.
 *
 * @example
 * ```ts
 * import { createDigitalWorkersClient } from 'digital-workers/client'
 *
 * const client = createDigitalWorkersClient('https://digital-workers.workers.dev')
 * const worker = await client.spawn({ name: 'my-agent', type: 'agent' })
 * await client.send(worker.id, otherWorkerId, 'task', { data: 'hello' })
 * ```
 *
 * @packageDocumentation
 */

import { RPC, http } from 'rpc.do'

// ==================== Types ====================

/** Worker instance status */
type WorkerInstanceStatus = 'spawning' | 'running' | 'paused' | 'terminated' | 'error'

/** Worker instance state */
interface WorkerInstance {
  id: string
  name: string
  status: WorkerInstanceStatus
  type: 'agent' | 'human'
  tier?: string | undefined
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, unknown> | undefined
}

/** Message sent between workers */
interface WorkerMessage<T = unknown> {
  id: string
  from: string
  to: string
  type: string
  payload: T
  timestamp: Date
  acknowledged?: boolean
}

/** Worker spawn options */
interface SpawnOptions {
  name?: string
  type?: 'agent' | 'human'
  tier?: string
  metadata?: Record<string, unknown>
  timeout?: number
}

/** Receive options */
interface ReceiveOptions {
  type?: string
  limit?: number
  acknowledged?: boolean
}

/** List options */
interface ListOptions {
  status?: WorkerInstanceStatus
  type?: 'agent' | 'human'
  tier?: string
  limit?: number
  includeTerminated?: boolean
}

/** Set state options */
interface SetStateOptions {
  metadata?: Record<string, unknown>
}

/** Broadcast result */
interface BroadcastResult {
  workerId: string
  success: boolean
  messageId?: string | undefined
  error?: string | undefined
}

/** Coordination task */
interface CoordinationTask<T = unknown> {
  id: string
  type: 'fanout' | 'pipeline' | 'race' | 'consensus'
  workers: string[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: T | undefined
  errors?: Error[] | undefined
}

/** Consensus options */
interface ConsensusOptions {
  quorum?: number
}

// ==================== API Type ====================

/**
 * DigitalWorkersAPI - Type-safe interface matching DigitalWorkersServiceCore RPC methods
 *
 * This interface mirrors all public methods on DigitalWorkersServiceCore so that
 * the RPC client provides full type safety when calling remote methods.
 */
export interface DigitalWorkersAPI {
  // Worker Lifecycle Management
  spawn(options?: SpawnOptions): Promise<WorkerInstance>
  terminate(workerId: string): Promise<boolean>
  pause(workerId: string): Promise<boolean>
  resume(workerId: string): Promise<boolean>

  // Worker Communication / Messaging
  send<T = unknown>(
    fromId: string,
    toId: string,
    type: string,
    payload: T
  ): Promise<WorkerMessage<T>>
  receive<T = unknown>(workerId: string, options?: ReceiveOptions): Promise<WorkerMessage<T>[]>
  acknowledge(workerId: string, messageId: string): Promise<boolean>
  broadcast<T = unknown>(
    fromId: string,
    toIds: string[],
    type: string,
    payload: T
  ): Promise<BroadcastResult[]>

  // Worker State Management
  getState(workerId: string): Promise<WorkerInstance | null>
  setState(workerId: string, options: SetStateOptions): Promise<void>
  list(options?: ListOptions): Promise<WorkerInstance[]>

  // Worker Coordination Patterns
  fanOut<T = unknown>(
    coordinatorId: string,
    workerIds: string[],
    type: string,
    payload: T
  ): Promise<CoordinationTask<T>>
  pipeline<T = unknown>(workerIds: string[], type: string, payload: T): Promise<CoordinationTask<T>>
  race<T = unknown>(workerIds: string[], type: string, payload: T): Promise<CoordinationTask<T>>
  consensus<T = unknown>(
    workerIds: string[],
    type: string,
    payload: T,
    options?: ConsensusOptions
  ): Promise<CoordinationTask<T>>
  getTaskStatus<T = unknown>(taskId: string): Promise<CoordinationTask<T> | null>
}

// ==================== Client Options ====================

/**
 * Options for creating a digital workers RPC client
 */
export interface DigitalWorkersClientOptions {
  /** Authentication token or API key */
  token?: string
  /** Request timeout in milliseconds */
  timeout?: number
  /** Custom headers to include in requests */
  headers?: Record<string, string>
}

// ==================== Client Factory ====================

/** Default URL for the digital-workers worker */
const DEFAULT_URL = 'https://digital-workers.workers.dev'

/**
 * Create a typed RPC client for the digital-workers worker
 *
 * @param url - The URL of the deployed digital-workers worker
 * @param options - Optional client configuration
 * @returns A typed RPC client with all DigitalWorkersServiceCore methods
 *
 * @example
 * ```ts
 * import { createDigitalWorkersClient } from 'digital-workers/client'
 *
 * // Connect to production
 * const client = createDigitalWorkersClient('https://digital-workers.workers.dev')
 *
 * // Spawn and manage workers
 * const agent = await client.spawn({ name: 'my-agent', type: 'agent' })
 * const human = await client.spawn({ name: 'reviewer', type: 'human' })
 *
 * // Send messages between workers
 * await client.send(agent.id, human.id, 'review-request', { content: 'Please review' })
 * const messages = await client.receive(human.id, { type: 'review-request' })
 *
 * // Coordinate multiple workers
 * const task = await client.fanOut(agent.id, [worker1.id, worker2.id], 'process', data)
 * const status = await client.getTaskStatus(task.id)
 * ```
 */
export function createDigitalWorkersClient(
  url: string = DEFAULT_URL,
  options?: DigitalWorkersClientOptions
) {
  return RPC<DigitalWorkersAPI>(http(url, options?.token))
}

/**
 * Default client instance connected to the production digital-workers worker
 *
 * @example
 * ```ts
 * import client from 'digital-workers/client'
 *
 * const worker = await client.spawn({ name: 'my-agent' })
 * ```
 */
const client = createDigitalWorkersClient()

export default client
