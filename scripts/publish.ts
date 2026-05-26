#!/usr/bin/env node
/**
 * Smart publish script that:
 * 1. Replaces workspace:* with actual versions
 * 2. Auto-logs in to npm if the existing token is missing or expired
 * 3. Uses npm publish with web auth (TouchID / WebAuthn)
 * 4. Works both interactively AND from a non-TTY caller (an agent, a CI runner) —
 *    when stdin isn't a TTY, npm refuses to prompt; we wrap the call in `expect`
 *    so npm sees a PTY and we auto-press Enter on its "Press ENTER to open in
 *    the browser…" prompt. The browser opens, you authorize once per OTP, and
 *    the publish proceeds.
 * 5. Restores original package.json files
 */

import { execSync, spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const packagesDir = join(rootDir, 'packages')

// Packages to exclude from publishing (npm restrictions, "for now" relocations, etc.)
//
// - `org.ai`: moved to a different monorepo; this package is a bridge to its new
//   home and should not republish from here for now. Re-include once the
//   org.ai home is fully settled and we decide where it ships from.
const EXCLUDED_PACKAGES = new Set<string>([
  'org.ai',
])

interface PackageJson {
  name: string
  version: string
  private?: boolean
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function getPackageDirs(): string[] {
  const dirs = [
    ...readdirSync(packagesDir)
      .filter((name) => {
        const pkgPath = join(packagesDir, name)
        const pkgJsonPath = join(pkgPath, 'package.json')
        try {
          return statSync(pkgPath).isDirectory() && statSync(pkgJsonPath).isFile()
        } catch {
          return false
        }
      })
      .map((name) => join(packagesDir, name)),
    join(rootDir, 'examples'),
  ]
  return dirs
}

function readPackageJson(pkgDir: string): PackageJson {
  return JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf-8'))
}

function writePackageJson(pkgDir: string, pkg: PackageJson): void {
  writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n')
}

function isPublished(name: string, version: string): boolean {
  try {
    execSync(`npm view "${name}@${version}" version`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * `true` if both stdin and stdout are real TTYs — meaning the user is running
 * the script in a terminal and can respond to prompts directly. `false` means
 * we're being invoked by an agent / CI / pipe; npm will refuse to prompt and
 * we need to wrap with `expect` to provide a PTY.
 */
function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

/** `true` if `expect` (the Tcl tool, ships with macOS) is on PATH. */
function hasExpect(): boolean {
  return spawnSync('which', ['expect'], { stdio: 'pipe' }).status === 0
}

/**
 * Tcl program that drives an interactive npm command on our behalf:
 *  - spawns the command with a PTY (so npm thinks it's interactive)
 *  - sends Enter when npm prompts "Press ENTER to open in the browser…"
 *  - waits up to 10 minutes for the user to authorize in the browser
 *  - inherits stdout so all npm output streams through
 */
function expectScript(spawnLine: string): string {
  return [
    'set timeout 600',
    'log_user 1',
    spawnLine,
    'expect {',
    '  -re {Press \\[Enter\\] to open in the browser} { send "\\r"; exp_continue }',
    '  -re {Press ENTER to open}                      { send "\\r"; exp_continue }',
    '  -re {to open in the browser}                   { send "\\r"; exp_continue }',
    '  timeout                                         { puts stderr "*** timeout ***"; exit 2 }',
    '  eof',
    '}',
    'catch wait result',
    'exit [lindex $result 3]',
  ].join('\n')
}

/**
 * Run `npm <args>` in `cwd`, auto-handling the WebAuthn prompt.
 *
 * - TTY mode (a human in a terminal): inherit stdio — npm shows its prompts
 *   directly to the user, who presses Enter and authorizes in the browser
 *   themselves. Same as before this script grew an auto-auth path.
 * - Non-TTY mode (agent / pipe): wrap with `expect` so npm sees a PTY and we
 *   auto-feed Enter on "Press ENTER to open in the browser…". The browser
 *   opens via npm's own `open` call; the human authorizes once; publish
 *   proceeds. If `expect` isn't on PATH we fall back to inherit-stdio with a
 *   loud warning — the call will likely fail in non-TTY mode but at least
 *   the reason is visible.
 *
 * Returns the process exit code.
 */
function runNpmWithAutoAuth(args: string[], cwd: string): number {
  if (isInteractive()) {
    const result = spawnSync('npm', args, { cwd, stdio: 'inherit' })
    return result.status ?? 1
  }
  if (!hasExpect()) {
    console.warn(
      '[publish] non-TTY caller and `expect` not on PATH — npm prompts will fail. ' +
        'Install expect (macOS ships it; on Linux: `apt install expect`).',
    )
    const result = spawnSync('npm', args, { cwd, stdio: 'inherit' })
    return result.status ?? 1
  }
  const spawnLine = ['spawn', 'npm', ...args].map(quoteForTcl).join(' ')
  const result = spawnSync('expect', ['-c', expectScript(spawnLine)], {
    cwd,
    stdio: 'inherit',
  })
  return result.status ?? 1
}

/** Minimal Tcl quoting: leave alphanum/safe punctuation alone, brace-wrap the rest. */
function quoteForTcl(s: string): string {
  if (/^[A-Za-z0-9._/@:=-]+$/.test(s)) return s
  if (!/[{}\\]/.test(s)) return `{${s}}`
  return `"${s.replace(/[\\$\[\]"]/g, (c) => `\\${c}`)}"`
}

/**
 * Make sure we're logged in before the publish loop kicks off. `npm whoami`
 * exits non-zero with `E401` if the cached token is missing / expired; in that
 * case we trigger `npm login --auth-type=web` which prints a CLI URL and (with
 * Enter — auto-sent in non-TTY mode) opens it in the browser. After the user
 * authorizes there, the token is saved to ~/.npmrc and the publish loop reuses
 * it.
 */
function ensureLoggedIn(): void {
  const whoami = spawnSync('npm', ['whoami'], { stdio: 'pipe' })
  if (whoami.status === 0) {
    console.log(`✅ npm logged in as ${whoami.stdout.toString().trim()}`)
    return
  }
  console.log('🔑 npm not logged in — opening browser for web auth...')
  const code = runNpmWithAutoAuth(
    ['login', '--auth-type=web', '--registry=https://registry.npmjs.org/'],
    process.cwd(),
  )
  if (code !== 0) {
    console.error('❌ npm login failed')
    process.exit(code || 1)
  }
}

function replaceWorkspaceProtocol(
  deps: Record<string, string> | undefined,
  versionMap: Map<string, string>
): Record<string, string> | undefined {
  if (!deps) return deps

  const result: Record<string, string> = {}
  for (const [name, version] of Object.entries(deps)) {
    if (version.startsWith('workspace:')) {
      const actualVersion = versionMap.get(name)
      if (!actualVersion) {
        throw new Error(`Could not find version for workspace dependency: ${name}`)
      }
      const prefix = version.replace('workspace:', '').replace('*', '')
      result[name] = prefix + actualVersion
    } else {
      result[name] = version
    }
  }
  return result
}

async function main() {
  const dirs = getPackageDirs()
  const versionMap = new Map<string, string>()
  const originalContents = new Map<string, string>()
  const toPublish: { dir: string; name: string; version: string }[] = []

  // First pass: collect versions and check what needs publishing
  console.log('Checking which packages need publishing...\n')

  for (const dir of dirs) {
    const pkg = readPackageJson(dir)
    versionMap.set(pkg.name, pkg.version)

    if (pkg.private) {
      console.log(`⏭️  ${pkg.name} (private)`)
      continue
    }

    if (EXCLUDED_PACKAGES.has(pkg.name)) {
      console.log(`⏭️  ${pkg.name} (excluded - npm restriction)`)
      continue
    }

    if (isPublished(pkg.name, pkg.version)) {
      console.log(`✅ ${pkg.name}@${pkg.version} (already published)`)
    } else {
      console.log(`📦 ${pkg.name}@${pkg.version} (needs publish)`)
      toPublish.push({ dir, name: pkg.name, version: pkg.version })
    }
  }

  if (toPublish.length === 0) {
    console.log('\nAll packages are already published!')
    return
  }

  // Verify login BEFORE replacing any package.json files — if auth is broken
  // we want to bail before mutating the workspace.
  ensureLoggedIn()

  // Save original package.json contents and replace workspace:*
  console.log('\nPreparing packages for publish...')

  for (const { dir } of toPublish) {
    const pkgJsonPath = join(dir, 'package.json')
    originalContents.set(pkgJsonPath, readFileSync(pkgJsonPath, 'utf-8'))

    const pkg = readPackageJson(dir)
    pkg.dependencies = replaceWorkspaceProtocol(pkg.dependencies, versionMap)
    pkg.devDependencies = replaceWorkspaceProtocol(pkg.devDependencies, versionMap)
    pkg.peerDependencies = replaceWorkspaceProtocol(pkg.peerDependencies, versionMap)
    writePackageJson(dir, pkg)
  }

  console.log(`\nPublishing ${toPublish.length} package(s)...\n`)

  let failed = false
  for (const { dir, name, version } of toPublish) {
    console.log(`\n📤 Publishing ${name}@${version}...`)
    const status = runNpmWithAutoAuth(['publish', '--access', 'public'], dir)
    if (status !== 0) {
      console.error(`❌ Failed to publish ${name}@${version}`)
      failed = true
      break
    }
    console.log(`✅ Published ${name}@${version}`)
  }

  // Restore original package.json files
  console.log('\nRestoring package.json files...')
  for (const [path, content] of originalContents) {
    writeFileSync(path, content)
  }

  if (failed) {
    process.exit(1)
  }

  console.log('\n🎉 All packages published!')
}

main()
