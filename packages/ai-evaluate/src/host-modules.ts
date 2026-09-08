/**
 * The Miniflare host worker as workerd modules.
 *
 * Internal to `./node.ts` (not part of the `ai-evaluate/node` surface): the
 * host is `./host-worker` - which imports the exact `evaluate()` that ships
 * to Cloudflare - plus everything it imports, collected as plain ES modules.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, extname, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stripTypes } from './transform.js'

/** Name of the Miniflare host worker */
export const HOST_WORKER_NAME = 'ai-evaluate-host'

/** Entry module of the host worker inside the Miniflare instance */
export const HOST_MODULE = 'host-worker.js'

/** The host worker as workerd modules: its entry name and `name -> ESM source` */
export interface HostWorkerModules {
  mainModule: string
  modules: Record<string, string>
}

/**
 * Relative `import ... from './x.js'` / `export ... from './x.js'` /
 * `import './x.js'` specifiers in an ES module. Specifiers that only appear
 * inside generated-code string literals are filtered out later by existence.
 */
const RELATIVE_IMPORT =
  /\b(?:import|export)\b[^'"`;]*?\bfrom\s*['"](\.\.?\/[^'"]+)['"]|\bimport\s*['"](\.\.?\/[^'"]+)['"]/g

function relativeImports(source: string): string[] {
  const specifiers: string[] = []
  for (const match of source.matchAll(RELATIVE_IMPORT)) {
    const specifier = match[1] ?? match[2]
    if (specifier && !specifier.includes('${')) specifiers.push(specifier)
  }
  return specifiers
}

/**
 * Collect `./host-worker` (which imports `./evaluate`) and everything it
 * imports as a set of ES modules for the Miniflare host - no bundler involved.
 *
 * Resolves against this file's own directory: from `dist/*.js` when installed
 * (used as-is) and from `src/*.ts` under vitest (TypeScript stripped with the
 * same bundled sucrase that `evaluate()` uses for sandbox code). Module names
 * are paths relative to that directory (`evaluate.js`,
 * `worker-template/core.js`), which is how their relative imports resolve
 * inside workerd.
 */
export function loadHostWorker(): HostWorkerModules {
  const here = fileURLToPath(import.meta.url)
  const root = dirname(here)
  const fromSource = extname(here) === '.ts'
  const fileFor = (name: string): string =>
    join(root, ...(fromSource ? name.replace(/\.js$/, '.ts') : name).split('/'))

  const modules: Record<string, string> = {}
  const queue = [HOST_MODULE]
  for (let name = queue.shift(); name !== undefined; name = queue.shift()) {
    if (name in modules) continue
    const source = readFileSync(fileFor(name), 'utf8')
    const code = fromSource ? stripTypes(source) : source
    modules[name] = code
    for (const specifier of relativeImports(code)) {
      const target = posix.normalize(posix.join(posix.dirname(name), specifier))
      // A specifier with no file behind it came from a string literal of
      // generated sandbox code (e.g. `./__external_0__.js`); workerd reports
      // any real miss when the host loads.
      if (!target.startsWith('../') && existsSync(fileFor(target))) queue.push(target)
    }
  }
  return { mainModule: HOST_MODULE, modules }
}
