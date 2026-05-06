/**
 * `Service.fromFunction()` — migration adapter for existing `ai-functions` calls.
 *
 * Per v3 §1, `Service.fromFunction()` is the critical DX export for the
 * migration story: any plain async function can be wrapped as a single-step
 * `Code` cascade Service so existing call sites become Service-shaped without
 * rewriting their internals.
 *
 * The synthesised Service is mintable but **not publishable** — no pricing,
 * no reward, no evaluators. Callers extend with `Service.define()` or by
 * supplying additional fields once they're ready to publish to a marketplace.
 *
 * Defaults applied:
 *   - `archetype`            → `'transactional-workflow'`
 *   - `audience`             → `'human'`
 *   - `schema.input/output`  → caller-provided override or `unknownSchema`
 *   - `binding.cascade`      → `[Code({ name, handler: fn })]`
 *   - `binding.toolPermissions` → `[]`
 *   - `binding.clarificationPolicy` → `{ enabled: false, ... }`
 *
 * @packageDocumentation
 */

import { Code } from 'digital-tools'
import type { FunctionRef } from 'digital-tools'
import type { StandardSchemaV1 } from '@standard-schema/spec'

import type { ServiceInstance } from '../service.js'
import type { Schema } from '../types.js'

import { define } from './define.js'

// ============================================================================
// Internal: an "accept anything" Standard Schema vendor for `unknown`
// ============================================================================

/**
 * Minimal Standard-Schema-conformant validator that accepts any input and
 * passes it through untyped. Used as the default when the caller does not
 * supply a schema override on `fromFunction`.
 *
 * Real consumers supply Zod / Valibot / ArkType schemas; this default keeps
 * the migration path frictionless ("just wrap the function") while the
 * compile-time signature still carries `TIn` / `TOut` from the function
 * being adapted.
 */
function unknownSchema<T>(): Schema<T> {
  const schema: StandardSchemaV1<unknown, T> = {
    '~standard': {
      version: 1,
      vendor: 'services-as-software/from-function',
      validate: (value: unknown) => ({ value: value as T }),
    },
  }
  return schema
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Options accepted by {@link fromFunction}.
 *
 * `name` and `promise` are required (the bare minimum to mint a Service).
 * `schema.input` and `schema.output` are optional — the default is the
 * accept-everything `unknownSchema` validator that preserves `TIn` / `TOut`
 * inference from the wrapped function.
 */
export interface FromFunctionOpts<TIn, TOut> {
  name: string
  promise: string
  description?: string
  schema?: { input?: Schema<TIn>; output?: Schema<TOut> }
}

/**
 * Wrap a plain async function as a {@link ServiceInstance}.
 *
 * The result is a single-step `Code` cascade. Mintable (registers in
 * `ServiceLifecycle` as `'draft'`) and invokable once the round-4 invoke
 * runtime lands. Not publishable until extended with pricing + reward via
 * a follow-on `Service.define()` call.
 */
export function fromFunction<TIn, TOut>(
  fn: (input: TIn) => Promise<TOut>,
  opts: FromFunctionOpts<TIn, TOut>
): ServiceInstance<TIn, TOut> {
  const codeStep = Code<TIn, TOut>({
    name: opts.name,
    handler: fn,
  })

  return define<TIn, TOut>({
    name: opts.name,
    promise: opts.promise,
    ...(opts.description !== undefined && { description: opts.description }),
    audience: 'human',
    archetype: 'transactional-workflow',
    schema: {
      input: opts.schema?.input ?? unknownSchema<TIn>(),
      output: opts.schema?.output ?? unknownSchema<TOut>(),
    },
    binding: {
      // The Code factory infers TIn/TOut from `fn`; cascade is a
      // FunctionRef[] (unknown-defaulted) at the binding level — the cast
      // erases the typed handler-shape into the canonical union for storage.
      cascade: [codeStep as unknown as FunctionRef],
      toolPermissions: [],
      clarificationPolicy: {
        enabled: false,
        maxRoundTrips: 0,
        escalateTo: '',
      },
    },
  })
}
