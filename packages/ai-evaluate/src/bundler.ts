/**
 * Dependency resolution for sandbox code
 *
 * Sandboxed `module` / `script` code may `import` npm packages declared in
 * `dependencies` (package.json style). Inside workerd, `@cloudflare/worker-bundler`
 * resolves them against the npm registry and bundles them into the worker's
 * entry module with esbuild-wasm, so the code that reaches the loader has no
 * bare specifiers left. That is the primary path: real packages, real
 * versions, CommonJS interop, no CDN in the loop.
 *
 * The bundler only loads where the module loader resolves packages
 * (a wrangler-bundled deployment, `@cloudflare/vitest-pool-workers`). The
 * local Miniflare host of `ai-evaluate/node` gets the same `evaluate()` as a
 * plain module graph and cannot import it, and Node itself lacks the
 * `WebAssembly.Module` import esbuild-wasm needs. There, and with
 * `bundler: false`, `evaluate()` falls back to fetching each dependency from
 * esm.sh as one bundled module and registering it under its bare name
 * (see `prefetchDependencies` in evaluate.ts), so the same `import` syntax
 * keeps working.
 *
 * Two caches, scoped to the isolate that runs `evaluate()`:
 * - resolved worker modules, keyed by the full input (entry, files,
 *   dependencies), so repeated evaluations of the same code never rebuild;
 * - installed `node_modules`, keyed by the dependencies alone, so a new entry
 *   over the same packages bundles without touching the registry.
 *
 * Known bundler limits (0.2.x, experimental): flat `node_modules` (one
 * version per package), text-only tarball extraction (no `.wasm` / `.node`),
 * no PAX tar headers (paths over 100 characters are dropped).
 */

import type {
  CreateWorkerOptions,
  CreateWorkerResult,
  FileSystem,
} from '@cloudflare/worker-bundler'
import type { WorkerModule } from './types.js'
import { cyrb53, stableStringify } from './shared.js'

/** The bundler's entry module name; also the `mainModule` it hands back when bundling */
export const BUNDLER_ENTRY = 'index.js'

/** The slice of `@cloudflare/worker-bundler` this module uses */
export type CreateWorker = (options: CreateWorkerOptions) => Promise<CreateWorkerResult>

/** Input to `resolveImports` */
export interface ResolveImportsOptions {
  /** The worker's entry module, plain JavaScript, importing packages by bare name */
  entry: string
  /** package.json `dependencies`: package name -> version or range */
  dependencies: Record<string, string>
  /**
   * Further source files, bundled with the entry when it imports them by
   * relative path (`./__external_0__.js`).
   */
  files?: Record<string, string> | undefined
  /**
   * Bare specifiers the bundler must leave as they are: sibling modules the
   * loader provides (`capnweb.js`). `cloudflare:*` is always external.
   */
  externals?: readonly string[] | undefined
  /**
   * `false` keeps the module structure (sucrase + naive resolution, no
   * esbuild) instead of bundling into one file. Default: bundle.
   */
  bundle?: boolean | undefined
  /** The bundler to use; default: `@cloudflare/worker-bundler` loaded on demand */
  createWorker?: CreateWorker | undefined
}

/** What `resolveImports` returns: the worker's resolved module map */
export interface ResolvedImports {
  mainModule: string
  modules: Record<string, string | WorkerModule>
  /** Bundler warnings (install failures, unresolved subpaths); surfaced as `warn` logs */
  warnings: string[]
  /** Served from the resolved-modules cache (no bundler call) */
  cached: boolean
}

/** Thrown by `resolveImports` when the bundler cannot be loaded in this runtime */
export class BundlerUnavailableError extends Error {
  constructor(reason: string) {
    super(`@cloudflare/worker-bundler is not available in this runtime: ${reason}`)
    this.name = 'BundlerUnavailableError'
  }
}

/**
 * An in-memory `FileSystem` for the bundler with an optional read-through
 * base. Writes and deletes stay in this layer, so one installed `node_modules`
 * (the base) serves many builds, each writing its own entry on top, without
 * a build seeing another's files.
 */
export class MemoryFiles implements FileSystem {
  private readonly files = new Map<string, string>()
  private readonly deleted = new Set<string>()

  constructor(private readonly base: MemoryFiles | null = null, seed: Record<string, string> = {}) {
    for (const [path, content] of Object.entries(seed)) this.files.set(path, content)
  }

  read(path: string): string | null {
    const own = this.files.get(path)
    if (own !== undefined) return own
    if (this.deleted.has(path)) return null
    return this.base?.read(path) ?? null
  }

  write(path: string, content: string | { data: Uint8Array }): void {
    // Binary entries (the bundler never writes them for npm installs) are
    // stored as text; the base contract is `read(): string | null`.
    this.files.set(path, typeof content === 'string' ? content : decodeUtf8(content.data))
    this.deleted.delete(path)
  }

  delete(path: string): void {
    this.files.delete(path)
    if (this.base?.read(path) !== null && this.base !== null) this.deleted.add(path)
  }

  list(prefix?: string): string[] {
    const names = new Set<string>()
    for (const path of this.base?.list(prefix) ?? []) {
      if (!this.deleted.has(path)) names.add(path)
    }
    for (const path of this.files.keys()) {
      if (prefix === undefined || path.startsWith(prefix)) names.add(path)
    }
    return [...names]
  }

  flush(): Promise<void> {
    return Promise.resolve()
  }

  /** Whether this layer (not the base) holds any file under `prefix` */
  hasOwn(prefix: string): boolean {
    for (const path of this.files.keys()) if (path.startsWith(prefix)) return true
    return false
  }

  /**
   * A new, base-less layer holding only this layer's files under `prefix`:
   * what one build installed, without that build's own sources.
   */
  layer(prefix: string): MemoryFiles {
    const seed: Record<string, string> = {}
    for (const [path, content] of this.files) if (path.startsWith(prefix)) seed[path] = content
    return new MemoryFiles(null, seed)
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

/** A `Map` that forgets its oldest entries past `capacity` */
class BoundedMap<K, V> extends Map<K, V> {
  constructor(private readonly capacity: number) {
    super()
  }
  override set(key: K, value: V): this {
    if (this.has(key)) this.delete(key)
    super.set(key, value)
    while (this.size > this.capacity) {
      const oldest = this.keys().next().value
      if (oldest === undefined) break
      this.delete(oldest)
    }
    return this
  }
}

/** Resolved module maps by full input; one entry per distinct evaluation code */
const resolvedCache = new BoundedMap<string, ResolvedImports>(64)

/** Installed `node_modules` layers by dependencies; each can be megabytes */
const installedCache = new BoundedMap<string, MemoryFiles>(8)

/** The hash under which a set of dependencies is cached */
export function dependenciesHash(dependencies: Record<string, string>): string {
  return cyrb53(stableStringify(dependencies))
}

/** Drop both caches (tests) */
export function clearBundlerCache(): void {
  resolvedCache.clear()
  installedCache.clear()
}

/** Whether this runtime is workerd - the only place the bundler's wasm import resolves */
function isWorkersRuntime(): boolean {
  const { navigator } = globalThis as { navigator?: { userAgent?: unknown } }
  return navigator?.userAgent === 'Cloudflare-Workers'
}

let bundlerImport: Promise<CreateWorker> | null = null

/**
 * Load `@cloudflare/worker-bundler` once per isolate.
 *
 * Outside workerd the package installs from the registry and only then fails
 * at esbuild initialisation, so the runtime is checked first and no network
 * is touched. Inside workerd without package resolution (the Miniflare host
 * running a plain module graph) the import itself rejects; that outcome is
 * memoised so every evaluation does not retry it.
 */
export function loadBundler(): Promise<CreateWorker> {
  bundlerImport ??= (async () => {
    if (!isWorkersRuntime()) {
      throw new BundlerUnavailableError('not the Cloudflare Workers runtime (workerd)')
    }
    try {
      const { createWorker } = await import('@cloudflare/worker-bundler')
      return createWorker
    } catch (error) {
      throw new BundlerUnavailableError(
        `the package cannot be imported here (${
          error instanceof Error ? error.message : String(error)
        })`
      )
    }
  })()
  return bundlerImport
}

/**
 * Replace the bundler this isolate uses (tests): a stand-in `createWorker`,
 * or `null` to go back to loading `@cloudflare/worker-bundler` on demand.
 */
export function overrideBundler(createWorker: CreateWorker | null): void {
  bundlerImport = createWorker ? Promise.resolve(createWorker) : null
}

/**
 * Resolve the bare imports of an entry module into loader-ready modules.
 *
 * Writes `package.json` (from `dependencies`), the entry and any extra
 * `files` into an in-memory filesystem layered over the cached install for
 * these dependencies, then runs the bundler with `externals` left unresolved.
 * The result is `{ mainModule, modules }` to merge into a `WorkerCode`, plus
 * the bundler's warnings. Both caches are consulted first (see the module
 * comment).
 *
 * @throws BundlerUnavailableError when the bundler cannot load in this runtime
 * @throws Error from the bundler itself (unresolvable import, registry error)
 */
export async function resolveImports(options: ResolveImportsOptions): Promise<ResolvedImports> {
  const { entry, dependencies, files = {}, externals = [], bundle = true } = options
  const resolvedKey = cyrb53(stableStringify({ entry, dependencies, files, externals, bundle }))
  const hit = resolvedCache.get(resolvedKey)
  if (hit) return { ...hit, cached: true }

  const createWorker = options.createWorker ?? (await loadBundler())
  const depsKey = dependenciesHash(dependencies)
  const installed = installedCache.get(depsKey) ?? null
  const fs = new MemoryFiles(installed, {
    ...files,
    'package.json': JSON.stringify({ dependencies }),
    [BUNDLER_ENTRY]: entry,
  })

  const result = await createWorker({
    files: fs,
    entryPoint: BUNDLER_ENTRY,
    bundle,
    externals: ['cloudflare:workers', ...externals],
  })

  // First build for these dependencies: keep what it installed - only
  // node_modules, never this build's entry, package.json or `files` - as the
  // base for the next one, which writes its own sources on top.
  if (!installed && fs.hasOwn('node_modules/')) {
    installedCache.set(depsKey, fs.layer('node_modules/'))
  }

  const resolved: ResolvedImports = {
    mainModule: result.mainModule,
    modules: result.modules as Record<string, string | WorkerModule>,
    warnings: result.warnings ?? [],
    cached: false,
  }
  resolvedCache.set(resolvedKey, resolved)
  return resolved
}
