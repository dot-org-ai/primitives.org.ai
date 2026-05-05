/**
 * Verb Auto-Registration (aip-47tm)
 *
 * Bridges `defineTool()` (synchronous, side-effect-free builder) to
 * `digital-objects`' provider-mediated `defineVerb()` (async, I/O-bound).
 *
 * ## Design choice — Option B: explicit bootstrap
 *
 * `defineTool({ verb, frame })` records the metadata on the Tool but does
 * NOT call `provider.defineVerb()` itself. Cross-package side effects
 * from a pure builder are surprising; the provider is also caller-supplied,
 * so eager registration would force `defineTool` to know about a provider
 * it doesn't currently take.
 *
 * Instead, registration is an explicit, idempotent helper:
 *
 *   - `registerToolVerb(provider, tool)`     — single-tool, used from
 *                                                custom dispatchers that
 *                                                want lazy-on-first-call.
 *   - `registerToolVerbs(provider, tools)`   — bootstrap list, used at
 *                                                startup once per provider.
 *
 * Both are idempotent: re-registering a Verb with the same name and same
 * frame is a no-op. Re-registering with a different frame throws —
 * silent overwrite would mask an ontology drift bug.
 *
 * ## Why not Option A (lazy in `wrapTool`)
 *
 * `wrapTool()` takes auth + payment brokers, not a `DigitalObjectsProvider`.
 * Wiring a provider into `wrapTool()` would couple HTTP wrapping to the
 * digital-objects ontology — a layering inversion. Callers that want
 * lazy-on-first-call can compose `registerToolVerb()` into their own
 * dispatcher; the helper is fast enough to call per-request because the
 * idempotency check short-circuits to a single `getVerb()` lookup.
 *
 * ## Why not Option C (eager-with-deferred-provider queue)
 *
 * A module-level queue is global state in `digital-tools` — exactly what
 * the bead forbids. It also can't flush deterministically across
 * concurrent test workers, and ordering becomes load-dependent.
 *
 * @packageDocumentation
 */

import type { Frame, Verb, VerbDefinition } from 'digital-objects'
import type { AnyTool, Tool } from './types.js'

/**
 * Subset of `DigitalObjectsProvider` that this module requires.
 *
 * We deliberately accept only `getVerb` + `defineVerb` (rather than the
 * full provider interface) so callers can pass any object with these
 * two methods — including HTTP/RPC clients, test doubles, and the
 * canonical `MemoryProvider`.
 */
export interface VerbRegistrationProvider {
  defineVerb(def: VerbDefinition): Promise<Verb>
  getVerb(name: string): Promise<Verb | null>
}

/**
 * Compare two optional Frames structurally. Returns true when both are
 * undefined, or both define the same set of role -> NounRef mappings.
 *
 * `manner` (string[]) is compared as an unordered set since the role
 * order is not semantically meaningful.
 */
function framesEqual(a: Frame | undefined, b: Frame | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false

  const keys = new Set<keyof Frame>([
    ...(Object.keys(a) as (keyof Frame)[]),
    ...(Object.keys(b) as (keyof Frame)[]),
  ])

  for (const k of keys) {
    const av = a[k]
    const bv = b[k]
    if (k === 'manner') {
      const aArr = (av as string[] | undefined) ?? []
      const bArr = (bv as string[] | undefined) ?? []
      if (aArr.length !== bArr.length) return false
      const aSet = new Set(aArr)
      for (const v of bArr) if (!aSet.has(v)) return false
    } else {
      if (av !== bv) return false
    }
  }
  return true
}

/**
 * Mismatch error raised when a Tool tries to register a Verb whose name
 * already exists with a different frame. We do not silently overwrite —
 * conflicting ontology shapes are almost always a bug (two tools claiming
 * the same verb with different role expectations).
 */
export class VerbRegistrationConflictError extends Error {
  constructor(
    public readonly verbName: string,
    public readonly existing: Frame | undefined,
    public readonly incoming: Frame | undefined
  ) {
    super(
      `Verb "${verbName}" is already registered with a different frame. ` +
        `Tools that share a verb name must declare the same frame. ` +
        `Re-registering a verb with the same frame is a no-op (idempotent), ` +
        `but the incoming frame does not match the existing one.`
    )
    this.name = 'VerbRegistrationConflictError'
  }
}

/**
 * Register the Verb declared by a single Tool against `provider`.
 *
 * - Tools without a `verb` field are skipped (they are not SVO-aware).
 * - If the verb already exists with the same frame, the call is a no-op
 *   and the existing Verb is returned (idempotent).
 * - If the verb already exists with a different frame, throws
 *   {@link VerbRegistrationConflictError}.
 *
 * Suitable for both eager bootstrap and lazy-per-request use:
 * the idempotency check is a single `getVerb()` lookup, so it is safe
 * to call from a hot dispatch path.
 *
 * @returns The registered Verb, or `null` if the tool has no `verb` field.
 *
 * @example Lazy registration in a custom dispatcher
 * ```ts
 * async function dispatch(provider: DigitalObjectsProvider, tool: Tool, args: unknown) {
 *   await registerToolVerb(provider, tool)   // idempotent, cheap on subsequent calls
 *   return tool.handler(args)
 * }
 * ```
 */
export async function registerToolVerb(
  provider: VerbRegistrationProvider,
  tool: Tool<unknown, unknown> | AnyTool
): Promise<Verb | null> {
  if (!tool.verb) return null

  const existing = await provider.getVerb(tool.verb)
  if (existing) {
    if (framesEqual(existing.frame, tool.frame)) {
      return existing
    }
    throw new VerbRegistrationConflictError(tool.verb, existing.frame, tool.frame)
  }

  return provider.defineVerb({
    name: tool.verb,
    ...(tool.frame !== undefined && { frame: tool.frame }),
    ...(tool.description !== undefined && { description: tool.description }),
  })
}

/**
 * Bootstrap helper: register the Verbs for every SVO-aware tool in
 * `tools` against `provider`.
 *
 * Tools without a `verb` field are skipped silently (legacy / non-SVO
 * tools coexist with SVO-aware tools in the same registry).
 *
 * Conflicts (same verb name, different frame) throw on the first
 * conflicting tool — the caller can decide whether to retry without
 * the conflicting tool or surface the error.
 *
 * @returns The list of Verbs that were registered (or already existed,
 *          for idempotent calls). Tools with no verb are not included.
 *
 * @example Startup
 * ```ts
 * import { MemoryProvider, registerToolVerbs, getBuiltinTools } from 'digital-tools'
 *
 * const provider = new MemoryProvider()
 * await registerToolVerbs(provider, getBuiltinTools())
 * ```
 */
export async function registerToolVerbs(
  provider: VerbRegistrationProvider,
  tools: ReadonlyArray<Tool<unknown, unknown> | AnyTool>
): Promise<Verb[]> {
  const registered: Verb[] = []
  for (const tool of tools) {
    const verb = await registerToolVerb(provider, tool)
    if (verb) registered.push(verb)
  }
  return registered
}

/**
 * Alias for {@link registerToolVerbs}. The "bootstrap" name reads better
 * at startup sites where a list of tools is wired against a provider once.
 */
export const bootstrapTools = registerToolVerbs
