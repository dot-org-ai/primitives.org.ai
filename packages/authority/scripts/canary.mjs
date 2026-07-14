#!/usr/bin/env node
// =====================================================================================
// @org.ai/authority FC2 CONFIG CANARY — `pnpm --filter @org.ai/authority canary`.
// (Extracted per ADR 0082 §B from the atlas repo's `scripts/sas-canary.mjs`,
//  ADR 0081 · Epic-A2 · atlas issue #933.)
//
// Runs EVERY harness tsconfig under harnesses/ and asserts each compiles to the
// outcome its NAMING CONVENTION declares:
//   • tsconfig.json           (corrected / guarded)   -> must EXIT 0 (good path + every guard fires)
//   • tsconfig.stripped.json  (guards removed)         -> must FAIL  (inverted: a clean compile is a bug)
//   • tsconfig.old-minimal.json (pre-factoring lie)    -> must EXIT 0 (compiles the lie silently, by design)
//   • tsconfig.residual.json  (honest runtime residue) -> must EXIT 0 (non-linear residue, ADR-owned)
// Prints a PASS/FAIL table naming any deviation and exits non-zero if any config is off.
// =====================================================================================
import { execFileSync } from 'node:child_process'
import { readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..')
const HARNESSES = join(PKG, 'harnesses')

// Resolve tsc from the package's own dependency graph (works in the monorepo and from a
// consumer's node_modules alike) and run it through the current node binary.
function resolveTsc() {
  try {
    const require = createRequire(join(PKG, 'package.json'))
    const tsPkg = require.resolve('typescript/package.json')
    return join(dirname(tsPkg), 'bin', 'tsc')
  } catch {
    return null
  }
}
const TSC = resolveTsc()

// Expected outcome is derived from the config basename. Only `.stripped.` configs are expected
// to FAIL; corrected / old-minimal / residual configs are all expected to compile (EXIT 0).
const expectFail = (name) => name.includes('.stripped.')

function collectConfigs() {
  const out = []
  for (const d of readdirSync(HARNESSES).sort()) {
    const dir = join(HARNESSES, d)
    if (!statSync(dir).isDirectory()) continue
    for (const f of readdirSync(dir).sort()) {
      if (/^tsconfig.*\.json$/.test(f)) out.push(join(dir, f))
    }
  }
  return out
}

function tscExit(cfg) {
  try {
    execFileSync(process.execPath, [TSC, '-p', cfg], { stdio: 'pipe' })
    return 0
  } catch (e) {
    return typeof e.status === 'number' ? e.status : 1
  }
}

if (!TSC || !existsSync(TSC)) {
  console.error(`canary — typescript not resolvable from ${PKG}. Run pnpm install first.`)
  process.exit(2)
}
const configs = collectConfigs()
if (configs.length === 0) {
  console.error(`canary — no harness tsconfigs found under ${relative(PKG, HARNESSES)}`)
  process.exit(2)
}

const rows = []
let failures = 0
for (const cfg of configs) {
  const wantFail = expectFail(basename(cfg))
  const exit = tscExit(cfg)
  const compiled = exit === 0
  const pass = wantFail ? !compiled : compiled
  if (!pass) failures++
  rows.push({
    rel: relative(PKG, cfg),
    want: wantFail ? 'FAIL' : 'EXIT 0',
    got: compiled ? 'EXIT 0' : `exit ${exit}`,
    pass,
  })
}

console.log(`\n@org.ai/authority FC2 config canary — ${configs.length} harness tsconfigs\n`)
console.log(`  ${'RESULT'.padEnd(6)}  ${'EXPECT'.padEnd(6)}  ${'ACTUAL'.padEnd(8)}  CONFIG`)
for (const r of rows) {
  console.log(`  ${(r.pass ? 'PASS' : 'FAIL').padEnd(6)}  ${r.want.padEnd(6)}  ${r.got.padEnd(8)}  ${r.rel}`)
}

if (failures > 0) {
  console.error(`\ncanary FAILED — ${failures} config(s) deviated from their expected outcome:`)
  for (const r of rows.filter((r) => !r.pass)) {
    console.error(`  • ${r.rel}: expected ${r.want}, got ${r.got}`)
  }
  process.exit(1)
}
console.log(`\ncanary PASSED — all ${configs.length} configs match their naming-convention outcome.`)
