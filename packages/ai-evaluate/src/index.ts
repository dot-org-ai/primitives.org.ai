/**
 * ai-evaluate - Secure code execution in sandboxed environments
 *
 * Provides evaluate() for running untrusted code safely in Cloudflare
 * Dynamic Workers (`worker_loaders`). This entry runs inside a Worker; for
 * Node.js, `ai-evaluate/node` runs the same evaluate() inside a Miniflare 5
 * host worker with a real loader binding.
 *
 * The runtime exports of this module are the documented 3.0 surface and are
 * pinned by test/index.test.ts; see README "Exports" and MIGRATION.md.
 *
 * @packageDocumentation
 */

export { VERSION } from './version.js'

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
  OUTBOUND_RPC_CACHED_ERROR,
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
  SANDBOX_ENV_FUNCTION,
  SANDBOX_HOST_EXPORT,
  SANDBOX_HOST_BINDING_KEY,
  SANDBOX_JSON_MODULE,
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
