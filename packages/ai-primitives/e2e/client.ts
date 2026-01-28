/**
 * RPC Client Factory
 *
 * Creates RPC clients for different environments.
 * Uses fetch-based transport for browser/node, service bindings for workers.
 *
 * @packageDocumentation
 */

import type {
  RPCClient,
  DatabaseClient,
  DigitalObjectsClient,
  ProvidersClient,
  WorkflowsClient,
  EnvironmentConfig,
  EntityResult,
  SearchResult,
  SemanticSearchResult,
  HybridSearchResult,
  ListOptions,
  SearchOptions,
  SemanticSearchOptions,
  HybridSearchOptions,
  Thing,
  Action,
  ProviderInfo,
  ModelInfo,
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowRun,
} from './types.js'

/**
 * Service binding types for worker environment
 */
interface ServiceBinding {
  connect(namespace?: string): unknown
}

interface WorkerEnv {
  AI_DATABASE?: ServiceBinding
  DIGITAL_OBJECTS?: ServiceBinding
  AI_PROVIDERS?: ServiceBinding
  AI_WORKFLOWS?: ServiceBinding
}

/**
 * Create an RPC client using fetch-based transport
 * Used in browser and node environments
 */
export function createFetchClient(config: EnvironmentConfig): RPCClient {
  const { baseUrl, token, timeout = 30000 } = config

  async function rpcCall<T>(service: string, method: string, ...args: unknown[]): Promise<T> {
    const url = `${baseUrl}/${service}/rpc`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ method, args }),
      signal: AbortSignal.timeout(timeout),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`RPC call failed: ${response.status} ${error}`)
    }

    const result = await response.json()
    if (result.error) {
      throw new Error(result.error)
    }

    return result.data as T
  }

  const database: DatabaseClient = {
    get: (type, id) => rpcCall('database', 'get', type, id),
    list: (type, options) => rpcCall('database', 'list', type, options),
    create: (type, data, id) => rpcCall('database', 'create', type, data, id),
    update: (type, id, data) => rpcCall('database', 'update', type, id, data),
    delete: (type, id) => rpcCall('database', 'delete', type, id),
    search: (type, query, options) => rpcCall('database', 'search', type, query, options),
    semanticSearch: (type, query, options) =>
      rpcCall('database', 'semanticSearch', type, query, options),
    hybridSearch: (type, query, options) =>
      rpcCall('database', 'hybridSearch', type, query, options),
    related: (type, id, relation) => rpcCall('database', 'related', type, id, relation),
    relate: (fromType, fromId, relation, toType, toId) =>
      rpcCall('database', 'relate', fromType, fromId, relation, toType, toId),
    unrelate: (fromType, fromId, relation, toType, toId) =>
      rpcCall('database', 'unrelate', fromType, fromId, relation, toType, toId),
    clear: () => {
      // No-op for remote - clearing is only for tests
    },
  }

  const objects: DigitalObjectsClient = {
    create: (noun, data, id) => rpcCall('objects', 'create', noun, data, id),
    get: (id) => rpcCall('objects', 'get', id),
    list: (noun, options) => rpcCall('objects', 'list', noun, options),
    update: (id, data) => rpcCall('objects', 'update', id, data),
    delete: (id) => rpcCall('objects', 'delete', id),
    relate: (subject, verb, object, data) =>
      rpcCall('objects', 'relate', subject, verb, object, data),
    unrelate: (subject, verb, object) => rpcCall('objects', 'unrelate', subject, verb, object),
    related: (id, verb, direction) => rpcCall('objects', 'related', id, verb, direction),
    search: (query, options) => rpcCall('objects', 'search', query, options),
  }

  const providers: ProvidersClient = {
    list: () => rpcCall('providers', 'list'),
    get: (id) => rpcCall('providers', 'get', id),
    models: (providerId) => rpcCall('providers', 'models', providerId),
    resolve: (alias) => rpcCall('providers', 'resolve', alias),
  }

  const workflows: WorkflowsClient = {
    create: (definition) => rpcCall('workflows', 'create', definition),
    get: (id) => rpcCall('workflows', 'get', id),
    list: (options) => rpcCall('workflows', 'list', options),
    start: (id, input) => rpcCall('workflows', 'start', id, input),
    pause: (runId) => rpcCall('workflows', 'pause', runId),
    resume: (runId) => rpcCall('workflows', 'resume', runId),
    cancel: (runId) => rpcCall('workflows', 'cancel', runId),
  }

  return { database, objects, providers, workflows }
}

/**
 * Create an RPC client using service bindings
 * Used in vitest-pool-workers environment
 */
export function createServiceBindingClient(env: WorkerEnv): RPCClient {
  // Helper to wrap service binding methods
  function wrapService<T extends object>(
    binding: ServiceBinding | undefined,
    serviceName: string
  ): T {
    if (!binding) {
      throw new Error(`Service binding ${serviceName} not available`)
    }

    const service = binding.connect('default')
    return service as T
  }

  const database: DatabaseClient = {
    get: async (type, id) => {
      const svc = wrapService<any>(env.AI_DATABASE, 'AI_DATABASE')
      return svc.get(type, id)
    },
    list: async (type, options) => {
      const svc = wrapService<any>(env.AI_DATABASE, 'AI_DATABASE')
      return svc.list(type, options)
    },
    create: async (type, data, id) => {
      const svc = wrapService<any>(env.AI_DATABASE, 'AI_DATABASE')
      return svc.create(type, data, id)
    },
    update: async (type, id, data) => {
      const svc = wrapService<any>(env.AI_DATABASE, 'AI_DATABASE')
      return svc.update(type, id, data)
    },
    delete: async (type, id) => {
      const svc = wrapService<any>(env.AI_DATABASE, 'AI_DATABASE')
      return svc.delete(type, id)
    },
    search: async (type, query, options) => {
      const svc = wrapService<any>(env.AI_DATABASE, 'AI_DATABASE')
      return svc.search(type, query, options)
    },
    semanticSearch: async (type, query, options) => {
      const svc = wrapService<any>(env.AI_DATABASE, 'AI_DATABASE')
      return svc.semanticSearch(type, query, options)
    },
    hybridSearch: async (type, query, options) => {
      const svc = wrapService<any>(env.AI_DATABASE, 'AI_DATABASE')
      return svc.hybridSearch(type, query, options)
    },
    related: async (type, id, relation) => {
      const svc = wrapService<any>(env.AI_DATABASE, 'AI_DATABASE')
      return svc.related(type, id, relation)
    },
    relate: async (fromType, fromId, relation, toType, toId) => {
      const svc = wrapService<any>(env.AI_DATABASE, 'AI_DATABASE')
      return svc.relate(fromType, fromId, relation, toType, toId)
    },
    unrelate: async (fromType, fromId, relation, toType, toId) => {
      const svc = wrapService<any>(env.AI_DATABASE, 'AI_DATABASE')
      return svc.unrelate(fromType, fromId, relation, toType, toId)
    },
    clear: () => {
      const svc = wrapService<any>(env.AI_DATABASE, 'AI_DATABASE')
      svc.clear?.()
    },
  }

  const objects: DigitalObjectsClient = {
    create: async (noun, data, id) => {
      const svc = wrapService<any>(env.DIGITAL_OBJECTS, 'DIGITAL_OBJECTS')
      return svc.create(noun, data, id)
    },
    get: async (id) => {
      const svc = wrapService<any>(env.DIGITAL_OBJECTS, 'DIGITAL_OBJECTS')
      return svc.get(id)
    },
    list: async (noun, options) => {
      const svc = wrapService<any>(env.DIGITAL_OBJECTS, 'DIGITAL_OBJECTS')
      return svc.list(noun, options)
    },
    update: async (id, data) => {
      const svc = wrapService<any>(env.DIGITAL_OBJECTS, 'DIGITAL_OBJECTS')
      return svc.update(id, data)
    },
    delete: async (id) => {
      const svc = wrapService<any>(env.DIGITAL_OBJECTS, 'DIGITAL_OBJECTS')
      return svc.delete(id)
    },
    relate: async (subject, verb, object, data) => {
      const svc = wrapService<any>(env.DIGITAL_OBJECTS, 'DIGITAL_OBJECTS')
      return svc.relate(subject, verb, object, data)
    },
    unrelate: async (subject, verb, object) => {
      const svc = wrapService<any>(env.DIGITAL_OBJECTS, 'DIGITAL_OBJECTS')
      return svc.unrelate(subject, verb, object)
    },
    related: async (id, verb, direction) => {
      const svc = wrapService<any>(env.DIGITAL_OBJECTS, 'DIGITAL_OBJECTS')
      return svc.related(id, verb, direction)
    },
    search: async (query, options) => {
      const svc = wrapService<any>(env.DIGITAL_OBJECTS, 'DIGITAL_OBJECTS')
      return svc.search(query, options)
    },
  }

  const providers: ProvidersClient = {
    list: async () => {
      const svc = wrapService<any>(env.AI_PROVIDERS, 'AI_PROVIDERS')
      return svc.list()
    },
    get: async (id) => {
      const svc = wrapService<any>(env.AI_PROVIDERS, 'AI_PROVIDERS')
      return svc.get(id)
    },
    models: async (providerId) => {
      const svc = wrapService<any>(env.AI_PROVIDERS, 'AI_PROVIDERS')
      return svc.models(providerId)
    },
    resolve: async (alias) => {
      const svc = wrapService<any>(env.AI_PROVIDERS, 'AI_PROVIDERS')
      return svc.resolve(alias)
    },
  }

  const workflows: WorkflowsClient = {
    create: async (definition) => {
      const svc = wrapService<any>(env.AI_WORKFLOWS, 'AI_WORKFLOWS')
      return svc.create(definition)
    },
    get: async (id) => {
      const svc = wrapService<any>(env.AI_WORKFLOWS, 'AI_WORKFLOWS')
      return svc.get(id)
    },
    list: async (options) => {
      const svc = wrapService<any>(env.AI_WORKFLOWS, 'AI_WORKFLOWS')
      return svc.list(options)
    },
    start: async (id, input) => {
      const svc = wrapService<any>(env.AI_WORKFLOWS, 'AI_WORKFLOWS')
      return svc.start(id, input)
    },
    pause: async (runId) => {
      const svc = wrapService<any>(env.AI_WORKFLOWS, 'AI_WORKFLOWS')
      return svc.pause(runId)
    },
    resume: async (runId) => {
      const svc = wrapService<any>(env.AI_WORKFLOWS, 'AI_WORKFLOWS')
      return svc.resume(runId)
    },
    cancel: async (runId) => {
      const svc = wrapService<any>(env.AI_WORKFLOWS, 'AI_WORKFLOWS')
      return svc.cancel(runId)
    },
  }

  return { database, objects, providers, workflows }
}

/**
 * Get environment configuration from environment variables
 */
export function getEnvConfig(): EnvironmentConfig {
  const name = (process.env.E2E_ENV || 'node') as 'browser' | 'node' | 'worker'
  const baseUrl = process.env.E2E_BASE_URL || 'https://api.primitives.org.ai'
  const token = process.env.E2E_TOKEN
  const timeout = process.env.E2E_TIMEOUT ? parseInt(process.env.E2E_TIMEOUT, 10) : 30000

  return { name, baseUrl, token, timeout }
}
