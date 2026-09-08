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
  buildWorkerCodeWithWarnings,
  planImports,
  loadWorker,
  entrypointLimits,
  DEFAULT_ISOLATION,
  DEFAULT_TIMEOUT,
} from './evaluate.js'
export type { BuiltWorkerCode } from './evaluate.js'
export {
  normalizeImport,
  normalizeImports,
  parseImportSpecifier,
  partitionImports,
  packageJsonModule,
  workerCodeId,
  COMPATIBILITY_DATE,
  PACKAGE_JSON_MODULE,
} from './shared.js'
export type { ImportSpecifier } from './shared.js'
export {
  resolveImports,
  dependenciesHash,
  clearBundlerCache,
  BundlerUnavailableError,
} from './bundler.js'
export type { ResolveImportsOptions, ResolvedImports, CreateWorker } from './bundler.js'
export {
  ValidationError,
  validateOptions,
  buildSandboxEnv,
  isRpcStubLike,
  isStructuredCloneable,
  TEST_BINDING_KEY,
  MAX_TIMEOUT,
} from './validation.js'
export { isEvaluateResult, assertEvaluateResult } from './type-guards.js'
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
