/**
 * ai-sandbox - Secure code execution in sandboxed environments
 *
 * Provides evaluate() for running untrusted code safely using:
 * - Cloudflare worker_loaders in production
 * - Miniflare in development/Node.js
 *
 * @packageDocumentation
 */

export {
  evaluate,
  createEvaluator,
  buildWorkerCode,
  loadWorker,
  DEFAULT_ISOLATION,
} from './evaluate.js'
export { normalizeImport, normalizeImports, workerCodeId } from './shared.js'
export { transformSource, transformOptions, containsJSX } from './transform.js'
export type { TransformSourceOptions } from './transform.js'

export type {
  EvaluateOptions,
  EvaluateResult,
  LogEntry,
  TestResults,
  TestResult,
  SandboxEnv,
  SDKConfig,
  FetchConfig,
  JSXOptions,
  Isolation,
  WorkerLoader,
  WorkerCode,
  WorkerModule,
  WorkerLimits,
  WorkerStub,
  WorkerEntrypoint,
  WorkerEntrypointOptions,
} from './types.js'
