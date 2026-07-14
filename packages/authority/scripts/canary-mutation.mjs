#!/usr/bin/env node
// =====================================================================================
// @org.ai/authority FC2 MUTATION SELF-TEST — `pnpm --filter @org.ai/authority canary:mutation`.
// (Extracted per ADR 0082 §B from the atlas repo's `scripts/sas-canary-mutation.mjs`,
//  ADR 0081 · Epic-A2 · atlas issue #933.)
//
// Proves the config canary can actually CATCH a missing NoInfer — "a missing NoInfer already
// slipped human review three times; this must never wait for review again." It copies the
// kernel + harnesses to a temp dir, strips ONE covariant `NoInfer<…>` SITE at a time from the
// copy, and re-runs the guarded harnesses against the mutant.
//
// A "site" is a (verb, type-parameter) pair. Repeated occurrences of the SAME type var within
// one signature (e.g. adversarialGate's three checker seats) are stripped TOGETHER, because a
// sibling occurrence still pins the var — the meaningful, catchable unit is the whole site.
//
// Two expected classes (any deviation FAILS the build):
//   • LOAD-BEARING — stripping the site must be CAUGHT by >=1 guarded harness (the strip widens
//     the covariant param to a union, un-spends a `@ts-expect-error`, and the harness stops
//     compiling). If a load-bearing strip is NOT caught, the canary is blind to it -> FAIL.
//         authorityGate.D · adversarialGate.D · resolvePending.OutcomeD · resolvePending.Corr ·
//         serialize.D · remint.D · remint.Corr
//   • BRAND-ANCHORED — authorityGate.Prin / adversarialGate.Prin. The branded `principal: Prin`
//     source argument already fixes Prin, so the cross-tenant lie is rejected by the BRAND
//     regardless of NoInfer<Prin>. The strip must be NOT caught AND the suite must stay green
//     (the brand guard in i-covariant-canary keeps firing) -> the redundancy is proven SAFE.
//     (That the brand guard fires in the UNMUTATED module is asserted by `canary` itself:
//      i-covariant-canary's corrected config only EXIT 0s when the cross-tenant lines error.)
// =====================================================================================
import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..')

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

// The two gate Prin sites are documented brand-anchored (redundant). Everything else covariant
// is load-bearing.
const isBrandAnchored = (verb, typeVar) =>
  typeVar === 'Prin' && (verb === 'authorityGate' || verb === 'adversarialGate')

// ---- parse: find every code NoInfer<…> occurrence, its enclosing verb, and its inner type var
function matchAngle(src, openAt) {
  // openAt points at '<'; return index just past the matching '>'
  let i = openAt + 1
  let depth = 1
  while (i < src.length && depth > 0) {
    if (src[i] === '<') depth++
    else if (src[i] === '>') depth--
    i++
  }
  return i
}

function enclosingVerb(src, at) {
  const head = src.slice(0, at)
  const m = [...head.matchAll(/declare function (\w+)\s*</g)]
  return m.length ? m[m.length - 1][1] : '?'
}

function isCommentLine(src, at) {
  const lineStart = src.lastIndexOf('\n', at - 1) + 1
  return /^\s*\/\//.test(src.slice(lineStart, at))
}

function collectSites(src) {
  // site key -> { verb, typeVar, ranges: [[start,end], …] } where a range spans "NoInfer<…>"
  const sites = new Map()
  const re = /NoInfer</g
  let m
  while ((m = re.exec(src))) {
    const at = m.index
    if (isCommentLine(src, at)) continue
    const open = at + 'NoInfer'.length // index of '<'
    const end = matchAngle(src, open)
    const inner = src.slice(open + 1, end - 1)
    const verb = enclosingVerb(src, at)
    const key = `${verb}.${inner}`
    if (!sites.has(key)) sites.set(key, { verb, typeVar: inner, ranges: [] })
    sites.get(key).ranges.push([at, end])
  }
  return sites
}

function stripRanges(src, ranges) {
  // replace each "NoInfer<X>" with "X"; apply right-to-left so earlier offsets stay valid
  let out = src
  for (const [start, end] of [...ranges].sort((a, b) => b[0] - a[0])) {
    const inner = out.slice(start + 'NoInfer<'.length, end - 1)
    out = out.slice(0, start) + inner + out.slice(end)
  }
  return out
}

function guardedConfigs(root) {
  const harn = join(root, 'harnesses')
  const out = []
  for (const d of readdirSync(harn).sort()) {
    const dir = join(harn, d)
    if (!statSync(dir).isDirectory()) continue
    const cfg = join(dir, 'tsconfig.json')
    if (existsSync(cfg)) out.push([d, cfg])
  }
  return out
}

function tscFails(cfg) {
  try {
    execFileSync(process.execPath, [TSC, '-p', cfg], { stdio: 'pipe' })
    return false
  } catch {
    return true
  }
}

// ---- run ----------------------------------------------------------------------------
if (!TSC || !existsSync(TSC)) {
  console.error(`canary:mutation — typescript not resolvable from ${PKG}. Run pnpm install first.`)
  process.exit(2)
}

const tmp = mkdtempSync(join(tmpdir(), 'authority-mutation-'))
// Copy only the kernel + harnesses (relative layout preserved so '../../src/index' resolves).
cpSync(join(PKG, 'src'), join(tmp, 'src'), { recursive: true })
cpSync(join(PKG, 'harnesses'), join(tmp, 'harnesses'), { recursive: true })
const authPath = join(tmp, 'src', 'index.ts')
const orig = readFileSync(authPath, 'utf8')

const sites = collectSites(orig)
const guarded = guardedConfigs(tmp)
const totalOcc = [...sites.values()].reduce((n, s) => n + s.ranges.length, 0)

console.log(`\n@org.ai/authority FC2 mutation self-test — ${sites.size} covariant NoInfer sites, ${totalOcc} occurrences`)
console.log(`  guarded harnesses: ${guarded.map((g) => g[0]).join(', ')}\n`)
console.log(`  ${'RESULT'.padEnd(6)}  ${'CLASS'.padEnd(14)}  ${'SITE'.padEnd(26)}  DETAIL`)

const rows = []
let failures = 0
try {
  for (const [key, site] of sites) {
    const mutant = stripRanges(orig, site.ranges)
    writeFileSync(authPath, mutant)
    const caughtBy = guarded.filter(([, cfg]) => tscFails(cfg)).map(([name]) => name)
    const brand = isBrandAnchored(site.verb, site.typeVar)
    const caught = caughtBy.length > 0

    let pass
    let detail
    if (brand) {
      // brand-anchored: strip must NOT be caught, and the suite must stay green (brand guard fires)
      pass = !caught
      detail = caught
        ? `EXPECTED brand-anchored (uncaught) but caught by [${caughtBy.join(',')}]`
        : `brand-anchored, safe — suite green with site stripped (cross-tenant lie still rejected)`
    } else {
      // load-bearing: strip MUST be caught
      pass = caught
      detail = caught
        ? `caught by [${caughtBy.join(',')}]`
        : `NOT CAUGHT — the canary is blind to this missing NoInfer`
    }
    if (!pass) failures++
    rows.push({ key, class: brand ? 'brand-anchored' : 'load-bearing', pass, detail, occ: site.ranges.length })
    console.log(
      `  ${(pass ? 'PASS' : 'FAIL').padEnd(6)}  ${(brand ? 'brand-anchored' : 'load-bearing').padEnd(14)}  ${key.padEnd(26)}  ${detail}`,
    )
  }
} finally {
  writeFileSync(authPath, orig)
  rmSync(tmp, { recursive: true, force: true })
}

if (failures > 0) {
  console.error(`\ncanary:mutation FAILED — ${failures} site(s) off expectation:`)
  for (const r of rows.filter((r) => !r.pass)) console.error(`  • ${r.key} (${r.class}): ${r.detail}`)
  process.exit(1)
}
console.log(`\ncanary:mutation PASSED — every load-bearing NoInfer is proven load-bearing; brand-anchored sites proven safe.`)
