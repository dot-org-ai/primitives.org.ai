/**
 * Evaluate code in a sandboxed environment (Node.js version)
 *
 * Uses Cloudflare worker_loaders when available, falls back to Miniflare for local dev.
 * For Workers-only builds, import from 'ai-evaluate' instead.
 */
import type { EvaluateOptions, EvaluateResult, SandboxEnv } from './types.js';
/**
 * Evaluate code in a sandboxed worker (Node.js version with Miniflare fallback)
 */
export declare function evaluate(options: EvaluateOptions, env?: SandboxEnv): Promise<EvaluateResult>;
/**
 * Create an evaluate function bound to a specific environment
 */
export declare function createEvaluator(env?: SandboxEnv): (options: EvaluateOptions) => Promise<EvaluateResult>;
export type { EvaluateOptions, EvaluateResult, SandboxEnv } from './types.js';
//# sourceMappingURL=node.d.ts.map