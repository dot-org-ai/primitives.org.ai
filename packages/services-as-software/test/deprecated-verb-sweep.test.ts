/**
 * Cross-package sweep guard (PRD aip-chuu).
 *
 * Asserts that no source file under `packages/*\/src` (other than the
 * wrapper bodies themselves and the `ai-primitives` stable-surface
 * re-export — which does NOT re-export the deprecated verbs) imports any
 * of the deprecated Verb verbs (`ask`, `do`, `decide`, `approve`,
 * `notify`, `generate`, `is`) from the three Layer 5 packages
 * (`autonomous-agents`, `human-in-the-loop`, `services-as-software`).
 *
 * This is the CI assertion the PRD describes — when the deletion slice
 * (aip-x6js) runs, this test plus the telemetry counter together prove
 * there are no remaining internal callers.
 *
 * The test is positioned in `services-as-software` because that package
 * has a Node-pool vitest config (autonomous-agents + human-in-the-loop
 * use the Cloudflare Workers pool, which restricts `fs` access).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '..', '..', '..')
const PACKAGES_DIR = resolve(REPO_ROOT, 'packages')

// The three Layer 5 packages whose deprecated Verb exports we sweep for.
const L5_PACKAGES = ['autonomous-agents', 'human-in-the-loop', 'services-as-software'] as const

// The seven Verbs that route through `digital-workers` now.
const DEPRECATED_VERBS = [
  'ask',
  'do',
  'do_',
  'doAction',
  'decide',
  'approve',
  'notify',
  'generate',
  'is',
] as const

// Files we explicitly allow to import the deprecated symbols — the wrapper
// bodies themselves (which must keep the names exported until the deletion
// slice) and their own deprecation-test files (which exercise the wrappers).
const ALLOWLIST_SUFFIXES = [
  'packages/autonomous-agents/src/actions.ts',
  'packages/autonomous-agents/src/index.ts',
  'packages/autonomous-agents/src/ask-dispatch.ts',
  'packages/autonomous-agents/src/worker.ts',
  'packages/human-in-the-loop/src/helpers.ts',
  'packages/human-in-the-loop/src/index.ts',
  'packages/services-as-software/src/helpers.ts',
  'packages/services-as-software/src/index.ts',
]

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return acc
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name === '.turbo') continue
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) walk(full, acc)
    else if (st.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) acc.push(full)
  }
  return acc
}

interface Finding {
  file: string
  line: number
  text: string
  pkg: string
}

function findDeprecatedImports(): Finding[] {
  const findings: Finding[] = []
  const allSrcRoots: string[] = []
  for (const name of readdirSync(PACKAGES_DIR)) {
    const srcDir = join(PACKAGES_DIR, name, 'src')
    try {
      if (statSync(srcDir).isDirectory()) allSrcRoots.push(srcDir)
    } catch {
      // package without src/ — skip
    }
  }

  const files = allSrcRoots.flatMap((root) => walk(root))

  // Match `import { ... } from '<l5-pkg>'` on a single line.
  // Verb names are picked out of the destructured list below.
  const importRegex = new RegExp(
    `import\\s+(?:type\\s+)?\\{([^}]*)\\}\\s+from\\s+['"](${L5_PACKAGES.join('|')})['"]`,
    'g'
  )

  for (const file of files) {
    const rel = file.slice(REPO_ROOT.length + 1)
    // Skip allowlisted files (wrapper bodies + their entry-points)
    if (ALLOWLIST_SUFFIXES.some((suffix) => rel === suffix)) continue

    const content = readFileSync(file, 'utf8')
    let match: RegExpExecArray | null
    importRegex.lastIndex = 0
    while ((match = importRegex.exec(content)) !== null) {
      const namedBindings = match[1] ?? ''
      const pkg = match[2] ?? ''
      // Split named imports on commas, strip `as` aliases
      const names = namedBindings
        .split(',')
        .map(
          (n) =>
            n
              .trim()
              .split(/\s+as\s+/)[0]
              ?.trim() ?? ''
        )
        .filter(Boolean)

      const hits = names.filter((n) => (DEPRECATED_VERBS as readonly string[]).includes(n))
      if (hits.length > 0) {
        const upto = content.slice(0, match.index)
        const line = upto.split('\n').length
        findings.push({ file: rel, line, text: match[0], pkg })
      }
    }
  }
  return findings
}

describe('cross-package sweep — no internal callers of the deprecated L5 Verbs', () => {
  it('packages/*/src has zero imports of deprecated verbs from L5 packages', () => {
    const findings = findDeprecatedImports()
    if (findings.length > 0) {
      const lines = findings.map((f) => `  ${f.file}:${f.line}  ${f.text}`).join('\n')
      throw new Error(
        `Found ${findings.length} import(s) of deprecated L5 Verb verbs that should ` +
          `route through digital-workers instead:\n${lines}\n\n` +
          `Migrate each import to \`import { <verb> } from 'digital-workers'\` and ` +
          `dispatch via agentAsWorker(agent) / personAsWorker(person, { resolve }).`
      )
    }
    expect(findings).toEqual([])
  })
})
