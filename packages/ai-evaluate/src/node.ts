/**
 * Evaluate code in a sandboxed environment (Node.js version)
 *
 * Uses Cloudflare worker_loaders when available, falls back to Miniflare for local dev.
 * For Workers-only builds, import from 'ai-evaluate' instead.
 */

import type { EvaluateOptions, EvaluateResult, WorkerLoader, SandboxEnv } from './types.js'
import { generateWorkerCode, generateDevWorkerCode } from './worker-template.js'

/**
 * Check if code contains JSX syntax that needs transformation
 */
function containsJSX(code: string): boolean {
  if (!code) return false
  const jsxPattern = /<[A-Z][a-zA-Z0-9]*[\s/>]|<[a-z][a-z0-9-]*[\s/>]|<>|<\/>/
  const jsxReturnPattern = /return\s*\(\s*<|return\s+<[A-Za-z]/
  return jsxPattern.test(code) || jsxReturnPattern.test(code)
}

/**
 * Transform JSX in code using esbuild
 */
async function transformJSX(code: string): Promise<string> {
  if (!code || !containsJSX(code)) return code

  try {
    const { transform } = await import('esbuild')
    const result = await transform(code, {
      loader: 'tsx',
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
      target: 'esnext',
      format: 'esm',
    })
    return result.code
  } catch (error) {
    console.error('JSX transform failed:', error)
    return code
  }
}

/**
 * Evaluate code in a sandboxed worker (Node.js version with Miniflare fallback)
 */
export async function evaluate(
  options: EvaluateOptions,
  env?: SandboxEnv
): Promise<EvaluateResult> {
  const start = Date.now()

  try {
    // Transform JSX in module, tests, and script before evaluation
    const transformedModule = options.module ? await transformJSX(options.module) : undefined
    const transformedTests = options.tests ? await transformJSX(options.tests) : undefined
    const transformedScript = options.script ? await transformJSX(options.script) : undefined

    const transformedOptions: EvaluateOptions = {
      ...options,
      module: transformedModule,
      tests: transformedTests,
      script: transformedScript,
    }

    // Use worker_loaders if available (Cloudflare Workers)
    if (env?.LOADER && env?.TEST) {
      return await evaluateWithWorkerLoader(transformedOptions, env.LOADER, env.TEST, start)
    }

    // Fall back to Miniflare (Node.js/local development)
    return await evaluateWithMiniflare(transformedOptions, start)
  } catch (error) {
    return {
      success: false,
      logs: [],
      error: error instanceof Error ? error.message : String(error),
      duration: Date.now() - start,
    }
  }
}

/**
 * Evaluate using Cloudflare worker_loaders binding
 */
async function evaluateWithWorkerLoader(
  options: EvaluateOptions,
  loader: WorkerLoader,
  testService: unknown,
  start: number
): Promise<EvaluateResult> {
  const workerCode = generateWorkerCode({
    module: options.module,
    tests: options.tests,
    script: options.script,
    sdk: options.sdk,
    imports: options.imports,
  })
  const id = `sandbox-${Date.now()}-${Math.random().toString(36).slice(2)}`

  const worker = loader.get(id, async () => ({
    mainModule: 'worker.js',
    modules: {
      'worker.js': workerCode,
    },
    compatibilityDate: '2026-01-01',
    globalOutbound: options.fetch === null ? null : undefined,
    bindings: {
      TEST: testService,
    },
  }))

  const entrypoint = worker.getEntrypoint()
  const response = await entrypoint.fetch(new Request('http://sandbox/execute'))
  const result = (await response.json()) as EvaluateResult

  return {
    ...result,
    duration: Date.now() - start,
  }
}

/**
 * Evaluate using Miniflare (for Node.js/development)
 */
async function evaluateWithMiniflare(
  options: EvaluateOptions,
  start: number
): Promise<EvaluateResult> {
  const { Miniflare } = await import('miniflare')

  const workerCode = generateDevWorkerCode({
    module: options.module,
    tests: options.tests,
    script: options.script,
    sdk: options.sdk,
    imports: options.imports,
  })

  const mf = new Miniflare({
    modules: true,
    script: workerCode,
    compatibilityDate: '2026-01-01',
  })

  try {
    const response = await mf.dispatchFetch('http://sandbox/execute')
    const result = (await response.json()) as EvaluateResult

    return {
      ...result,
      duration: Date.now() - start,
    }
  } finally {
    await mf.dispose()
  }
}

/**
 * Create an evaluate function bound to a specific environment
 */
export function createEvaluator(env?: SandboxEnv) {
  return (options: EvaluateOptions) => evaluate(options, env)
}

// Re-export types
export type { EvaluateOptions, EvaluateResult, SandboxEnv } from './types.js'
