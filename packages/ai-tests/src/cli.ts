#!/usr/bin/env node
/**
 * ai-tests CLI
 *
 * Simple CLI for deploying and managing the ai-tests worker.
 *
 * Usage:
 *   npx ai-tests deploy     Deploy to Cloudflare Workers
 *   npx ai-tests dev        Start local dev server
 *   npx ai-tests --help     Show help
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(__dirname, '..')

const commands: Record<string, { description: string; args: string[] }> = {
  deploy: {
    description: 'Deploy ai-tests worker to Cloudflare',
    args: ['wrangler', 'deploy']
  },
  dev: {
    description: 'Start local development server',
    args: ['wrangler', 'dev']
  }
}

function showHelp() {
  console.log(`
ai-tests - Test utilities worker for Cloudflare Workers

Usage:
  npx ai-tests <command>

Commands:
  deploy    Deploy to Cloudflare Workers
  dev       Start local development server
  help      Show this help message

Examples:
  npx ai-tests deploy
  npx ai-tests dev

After deploying, bind the worker to your sandbox worker:
  # In your wrangler.toml:
  [[services]]
  binding = "TEST"
  service = "ai-tests"
`)
}

async function run() {
  const args = process.argv.slice(2)
  const command = args[0]

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp()
    process.exit(0)
  }

  const cmd = commands[command]
  if (!cmd) {
    console.error(`Unknown command: ${command}`)
    showHelp()
    process.exit(1)
  }

  console.log(`Running: ${cmd.args.join(' ')}`)

  const child = spawn('npx', cmd.args, {
    cwd: packageRoot,
    stdio: 'inherit',
    shell: true
  })

  child.on('close', (code) => {
    process.exit(code ?? 0)
  })
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
