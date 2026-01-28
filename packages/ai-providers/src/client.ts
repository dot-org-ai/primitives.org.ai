/**
 * RPC client for ai-providers - connects to remote ProviderService via rpc.do
 *
 * Provides a typed client interface that communicates with the deployed
 * ai-providers worker over HTTP RPC, matching the ProviderServiceCore methods.
 *
 * @packageDocumentation
 */

import type { ProviderId } from './registry.js'

/**
 * Configuration for the provider RPC client
 */
export interface ProviderClientConfig {
  /** RPC endpoint URL (default: https://rpc.do) */
  rpcUrl?: string
  /** Authentication token */
  token?: string
  /** Namespace for the service (default: ai-providers) */
  ns?: string
}

/**
 * Typed client interface matching ProviderServiceCore methods
 *
 * Methods mirror the RPC methods exposed by the ProviderService worker:
 * - model(id) - Get a language model by ID
 * - embeddingModel(id) - Get an embedding model by ID
 * - listProviders() - List available provider IDs
 */
export interface ProviderClient {
  /** Get a language model by ID (e.g., 'anthropic:claude-sonnet-4-20250514', 'opus') */
  model(id: string): Promise<unknown>
  /** Get an embedding model by ID (e.g., 'openai:text-embedding-3-small') */
  embeddingModel(id: string): Promise<unknown>
  /** List all available provider IDs */
  listProviders(): Promise<ProviderId[]>
}

/**
 * Create a client to connect to remote ai-providers service via rpc.do
 *
 * @param config - Client configuration options
 * @returns A typed ProviderClient that communicates via RPC
 *
 * @example
 * ```ts
 * import { createClient } from 'ai-providers/client'
 *
 * const client = createClient({
 *   token: process.env.RPC_TOKEN,
 * })
 *
 * const providers = await client.listProviders()
 * const model = await client.model('opus')
 * ```
 *
 * @example Custom RPC endpoint
 * ```ts
 * const client = createClient({
 *   rpcUrl: 'https://custom-rpc.example.com',
 *   ns: 'my-providers',
 *   token: 'my-token',
 * })
 * ```
 */
export function createClient(config: ProviderClientConfig = {}): ProviderClient {
  const rpcUrl = config.rpcUrl || 'https://rpc.do'
  const ns = config.ns || 'ai-providers'

  async function rpc<T>(method: string, params?: unknown): Promise<T> {
    const response = await fetch(`${rpcUrl}/${ns}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.token && { Authorization: `Bearer ${config.token}` }),
      },
      body: JSON.stringify({ method, params }),
    })

    if (!response.ok) {
      throw new Error(`RPC error: ${response.status}`)
    }

    const result = await response.json()
    return result as T
  }

  return {
    model: (id: string) => rpc('model', { id }),
    embeddingModel: (id: string) => rpc('embeddingModel', { id }),
    listProviders: () => rpc<ProviderId[]>('listProviders'),
  }
}

export default createClient
