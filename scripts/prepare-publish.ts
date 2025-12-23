#!/usr/bin/env node
/**
 * Prepare packages for publishing by replacing workspace:* dependencies
 * with the actual version number from the root package.json
 *
 * Usage: pnpm tsx scripts/prepare-publish.ts
 *
 * This script is automatically run by changesets during the publish process,
 * but can also be run manually for verification.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const packagesDir = join(rootDir, 'packages')

interface PackageJson {
  name: string
  version: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

function getPackages(): string[] {
  return readdirSync(packagesDir).filter(name => {
    const pkgPath = join(packagesDir, name)
    const pkgJsonPath = join(pkgPath, 'package.json')
    try {
      return statSync(pkgPath).isDirectory() && statSync(pkgJsonPath).isFile()
    } catch {
      // Directory exists but no package.json - skip it
      return false
    }
  })
}

function readPackageJson(pkgDir: string): PackageJson {
  const pkgJsonPath = join(pkgDir, 'package.json')
  return JSON.parse(readFileSync(pkgJsonPath, 'utf-8'))
}

function writePackageJson(pkgDir: string, pkg: PackageJson): void {
  const pkgJsonPath = join(pkgDir, 'package.json')
  writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n')
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
      // workspace:* -> actual version, workspace:^ -> ^version
      const prefix = version.replace('workspace:', '').replace('*', '')
      result[name] = prefix + actualVersion
    } else {
      result[name] = version
    }
  }
  return result
}

function main() {
  console.log('Preparing packages for publish...\n')

  const packages = getPackages()
  const versionMap = new Map<string, string>()

  // First pass: collect all package versions
  for (const pkgName of packages) {
    const pkgDir = join(packagesDir, pkgName)
    const pkg = readPackageJson(pkgDir)
    versionMap.set(pkg.name, pkg.version)
    console.log(`Found: ${pkg.name}@${pkg.version}`)
  }

  console.log('\nReplacing workspace:* dependencies...\n')

  // Second pass: replace workspace:* with actual versions
  for (const pkgName of packages) {
    const pkgDir = join(packagesDir, pkgName)
    const pkg = readPackageJson(pkgDir)

    let modified = false

    const newDeps = replaceWorkspaceProtocol(pkg.dependencies, versionMap)
    if (JSON.stringify(newDeps) !== JSON.stringify(pkg.dependencies)) {
      pkg.dependencies = newDeps
      modified = true
    }

    const newDevDeps = replaceWorkspaceProtocol(pkg.devDependencies, versionMap)
    if (JSON.stringify(newDevDeps) !== JSON.stringify(pkg.devDependencies)) {
      pkg.devDependencies = newDevDeps
      modified = true
    }

    const newPeerDeps = replaceWorkspaceProtocol(pkg.peerDependencies, versionMap)
    if (JSON.stringify(newPeerDeps) !== JSON.stringify(pkg.peerDependencies)) {
      pkg.peerDependencies = newPeerDeps
      modified = true
    }

    if (modified) {
      writePackageJson(pkgDir, pkg)
      console.log(`Updated: ${pkg.name}`)
      if (pkg.dependencies) {
        for (const [dep, ver] of Object.entries(pkg.dependencies)) {
          if (versionMap.has(dep)) {
            console.log(`  - ${dep}: ${ver}`)
          }
        }
      }
    }
  }

  console.log('\nDone!')
}

main()
