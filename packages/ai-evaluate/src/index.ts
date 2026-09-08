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
export {
  createOutboundGateway,
  outboundPolicy,
  blockedHostError,
  OUTBOUND_GATEWAY_EXPORT,
  OUTBOUND_JSON_MODULE,
  OUTBOUND_GATEWAY_UNAVAILABLE_ERROR,
  INTERCEPTOR_UNAVAILABLE_ERROR,
} from './outbound.js'
export type {
  OutboundGateway,
  OutboundGatewayProps,
  OutboundGatewayFactory,
  OutboundInterceptor,
} from './outbound.js'
export {
  createFacetHost,
  facetBindingName,
  facetEnvSource,
  generateFacetWorkerCode,
  loopbackSandboxHost,
  facetNotAttachedError,
  isIdentifier,
  SANDBOX_HOST_EXPORT,
  SANDBOX_HOST_BINDING_KEY,
  SANDBOX_HOST_UNAVAILABLE_ERROR,
} from './facets.js'
export type {
  FacetSpec,
  FacetHost,
  FacetStub,
  FacetsApi,
  FacetStartup,
  SandboxHostStub,
  SandboxHostNamespace,
} from './facets.js'
export { loopbackExport } from './loopback.js'
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
  FacetOptions,
  Isolation,
  WorkerLoader,
  WorkerCode,
  WorkerModule,
  WorkerLimits,
  WorkerStub,
  WorkerEntrypoint,
  WorkerEntrypointOptions,
} from './types.js'
