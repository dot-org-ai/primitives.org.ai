/**
 * System Tools - Filesystem, Git, and Shell operations
 *
 * Integrates fsx.do, gitx.do, and bashx.do primitives for the dotdo ecosystem.
 * These tools provide edge-compatible filesystem, git, and bash operations
 * that work in Cloudflare Workers and Durable Objects.
 *
 * @packageDocumentation
 */

import { defineTool } from '../define.js'
import type { AnyTool } from '../types.js'

// ============================================================================
// Filesystem Tools (fsx.do integration)
// ============================================================================

/**
 * Read file contents from the virtual filesystem
 */
export const fsRead = defineTool<
  { path: string; encoding?: 'utf-8' | 'binary' | 'base64' },
  { content: string; size: number; encoding: string }
>({
  id: 'system.fs.read',
  name: 'Read File',
  description: 'Read contents of a file from the virtual filesystem (fsx.do)',
  category: 'system',
  subcategory: 'filesystem',
  input: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to read' },
      encoding: {
        type: 'string',
        description: 'Encoding for the file content',
        enum: ['utf-8', 'binary', 'base64'],
        default: 'utf-8',
      },
    },
    required: ['path'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/fsx
    // In production, this connects to the fsx.do Durable Object
    const encoding = input.encoding || 'utf-8'
    return {
      content: `[fsx.do] Content of ${input.path}`,
      size: 0,
      encoding,
    }
  },
  options: {
    audience: 'both',
    tags: ['fs', 'read', 'file', 'fsx'],
    idempotent: true,
  },
})

/**
 * Write content to a file in the virtual filesystem
 */
export const fsWrite = defineTool<
  { path: string; content: string; encoding?: 'utf-8' | 'binary' | 'base64'; createDirs?: boolean },
  { success: boolean; path: string; size: number }
>({
  id: 'system.fs.write',
  name: 'Write File',
  description: 'Write content to a file in the virtual filesystem (fsx.do)',
  category: 'system',
  subcategory: 'filesystem',
  input: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to write the file' },
      content: { type: 'string', description: 'Content to write' },
      encoding: {
        type: 'string',
        description: 'Encoding for the content',
        enum: ['utf-8', 'binary', 'base64'],
        default: 'utf-8',
      },
      createDirs: {
        type: 'boolean',
        description: 'Create parent directories if they do not exist',
        default: true,
      },
    },
    required: ['path', 'content'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/fsx
    return {
      success: true,
      path: input.path,
      size: input.content.length,
    }
  },
  options: {
    audience: 'both',
    tags: ['fs', 'write', 'file', 'fsx'],
    permissions: [{ type: 'write', resource: 'filesystem' }],
  },
})

/**
 * List directory contents
 */
export const fsList = defineTool<
  { path: string; recursive?: boolean; pattern?: string },
  {
    entries: Array<{ name: string; type: 'file' | 'directory'; size?: number; modified?: string }>
    count: number
  }
>({
  id: 'system.fs.list',
  name: 'List Directory',
  description: 'List contents of a directory in the virtual filesystem (fsx.do)',
  category: 'system',
  subcategory: 'filesystem',
  input: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Directory path to list' },
      recursive: { type: 'boolean', description: 'List recursively', default: false },
      pattern: { type: 'string', description: 'Glob pattern to filter results' },
    },
    required: ['path'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/fsx
    return {
      entries: [],
      count: 0,
    }
  },
  options: {
    audience: 'both',
    tags: ['fs', 'list', 'directory', 'fsx'],
    idempotent: true,
  },
})

/**
 * Delete a file or directory
 */
export const fsDelete = defineTool<
  { path: string; recursive?: boolean },
  { success: boolean; path: string; deleted: number }
>({
  id: 'system.fs.delete',
  name: 'Delete File/Directory',
  description: 'Delete a file or directory from the virtual filesystem (fsx.do)',
  category: 'system',
  subcategory: 'filesystem',
  input: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to delete' },
      recursive: { type: 'boolean', description: 'Delete directories recursively', default: false },
    },
    required: ['path'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/fsx
    return {
      success: true,
      path: input.path,
      deleted: 1,
    }
  },
  options: {
    audience: 'both',
    tags: ['fs', 'delete', 'remove', 'fsx'],
    permissions: [{ type: 'write', resource: 'filesystem' }],
    requiresConfirmation: true,
  },
})

/**
 * Search files using glob patterns
 */
export const fsGlob = defineTool<
  { pattern: string; cwd?: string },
  { matches: string[]; count: number }
>({
  id: 'system.fs.glob',
  name: 'Glob Search',
  description: 'Search for files using glob patterns (fsx.do)',
  category: 'system',
  subcategory: 'filesystem',
  input: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Glob pattern (e.g., "**/*.ts")' },
      cwd: { type: 'string', description: 'Working directory for the search' },
    },
    required: ['pattern'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/fsx
    return {
      matches: [],
      count: 0,
    }
  },
  options: {
    audience: 'both',
    tags: ['fs', 'glob', 'search', 'fsx'],
    idempotent: true,
  },
})

/**
 * Search file contents using grep
 */
export const fsGrep = defineTool<
  { pattern: string; path?: string; recursive?: boolean; ignoreCase?: boolean },
  { matches: Array<{ file: string; line: number; content: string }>; count: number }
>({
  id: 'system.fs.grep',
  name: 'Grep Search',
  description: 'Search file contents using regular expressions (fsx.do)',
  category: 'system',
  subcategory: 'filesystem',
  input: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (regex)' },
      path: { type: 'string', description: 'Path to search in' },
      recursive: { type: 'boolean', description: 'Search recursively', default: true },
      ignoreCase: { type: 'boolean', description: 'Case-insensitive search', default: false },
    },
    required: ['pattern'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/fsx
    return {
      matches: [],
      count: 0,
    }
  },
  options: {
    audience: 'both',
    tags: ['fs', 'grep', 'search', 'regex', 'fsx'],
    idempotent: true,
  },
})

// ============================================================================
// Git Tools (gitx.do integration)
// ============================================================================

/**
 * Initialize a git repository
 */
export const gitInit = defineTool<
  { path?: string; bare?: boolean },
  { success: boolean; path: string }
>({
  id: 'system.git.init',
  name: 'Git Init',
  description: 'Initialize a new git repository (gitx.do)',
  category: 'development',
  subcategory: 'git',
  input: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path for the repository' },
      bare: { type: 'boolean', description: 'Create a bare repository', default: false },
    },
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/gitx
    return {
      success: true,
      path: input.path || '.',
    }
  },
  options: {
    audience: 'both',
    tags: ['git', 'init', 'repository', 'gitx'],
    permissions: [{ type: 'write', resource: 'git' }],
  },
})

/**
 * Clone a git repository
 */
export const gitClone = defineTool<
  { url: string; path?: string; branch?: string; depth?: number },
  { success: boolean; path: string; branch: string }
>({
  id: 'system.git.clone',
  name: 'Git Clone',
  description: 'Clone a git repository (gitx.do)',
  category: 'development',
  subcategory: 'git',
  input: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'Repository URL to clone' },
      path: { type: 'string', description: 'Local path for the clone' },
      branch: { type: 'string', description: 'Branch to checkout' },
      depth: { type: 'number', description: 'Shallow clone depth' },
    },
    required: ['url'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/gitx
    return {
      success: true,
      path: input.path || '.',
      branch: input.branch || 'main',
    }
  },
  options: {
    audience: 'both',
    tags: ['git', 'clone', 'repository', 'gitx'],
    permissions: [{ type: 'write', resource: 'git' }],
  },
})

/**
 * Get git repository status
 */
export const gitStatus = defineTool<
  { path?: string },
  {
    branch: string
    clean: boolean
    staged: string[]
    modified: string[]
    untracked: string[]
    ahead: number
    behind: number
  }
>({
  id: 'system.git.status',
  name: 'Git Status',
  description: 'Get the status of a git repository (gitx.do)',
  category: 'development',
  subcategory: 'git',
  input: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repository path' },
    },
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/gitx
    return {
      branch: 'main',
      clean: true,
      staged: [],
      modified: [],
      untracked: [],
      ahead: 0,
      behind: 0,
    }
  },
  options: {
    audience: 'both',
    tags: ['git', 'status', 'gitx'],
    idempotent: true,
  },
})

/**
 * Stage files for commit
 */
export const gitAdd = defineTool<
  { files: string[]; path?: string },
  { success: boolean; staged: string[] }
>({
  id: 'system.git.add',
  name: 'Git Add',
  description: 'Stage files for commit (gitx.do)',
  category: 'development',
  subcategory: 'git',
  input: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to stage (use "." for all)',
      },
      path: { type: 'string', description: 'Repository path' },
    },
    required: ['files'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/gitx
    return {
      success: true,
      staged: input.files,
    }
  },
  options: {
    audience: 'both',
    tags: ['git', 'add', 'stage', 'gitx'],
    permissions: [{ type: 'write', resource: 'git' }],
  },
})

/**
 * Create a commit
 */
export const gitCommit = defineTool<
  { message: string; path?: string; author?: { name: string; email: string } },
  { success: boolean; sha: string; message: string }
>({
  id: 'system.git.commit',
  name: 'Git Commit',
  description: 'Create a new commit (gitx.do)',
  category: 'development',
  subcategory: 'git',
  input: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'Commit message' },
      path: { type: 'string', description: 'Repository path' },
      author: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
        },
        description: 'Commit author',
      },
    },
    required: ['message'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/gitx
    return {
      success: true,
      sha: 'abc1234',
      message: input.message,
    }
  },
  options: {
    audience: 'both',
    tags: ['git', 'commit', 'gitx'],
    permissions: [{ type: 'write', resource: 'git' }],
  },
})

/**
 * Get commit log
 */
export const gitLog = defineTool<
  { path?: string; limit?: number; branch?: string },
  {
    commits: Array<{
      sha: string
      message: string
      author: { name: string; email: string }
      date: string
    }>
  }
>({
  id: 'system.git.log',
  name: 'Git Log',
  description: 'Get commit history (gitx.do)',
  category: 'development',
  subcategory: 'git',
  input: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repository path' },
      limit: { type: 'number', description: 'Maximum number of commits', default: 10 },
      branch: { type: 'string', description: 'Branch to get log from' },
    },
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/gitx
    return {
      commits: [],
    }
  },
  options: {
    audience: 'both',
    tags: ['git', 'log', 'history', 'gitx'],
    idempotent: true,
  },
})

/**
 * Show diff between commits or working tree
 */
export const gitDiff = defineTool<
  { path?: string; from?: string; to?: string; file?: string },
  { diff: string; additions: number; deletions: number; files: string[] }
>({
  id: 'system.git.diff',
  name: 'Git Diff',
  description: 'Show differences between commits or working tree (gitx.do)',
  category: 'development',
  subcategory: 'git',
  input: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repository path' },
      from: { type: 'string', description: 'From commit/ref' },
      to: { type: 'string', description: 'To commit/ref' },
      file: { type: 'string', description: 'Specific file to diff' },
    },
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/gitx
    return {
      diff: '',
      additions: 0,
      deletions: 0,
      files: [],
    }
  },
  options: {
    audience: 'both',
    tags: ['git', 'diff', 'gitx'],
    idempotent: true,
  },
})

/**
 * Checkout a branch or commit
 */
export const gitCheckout = defineTool<
  { ref: string; path?: string; create?: boolean },
  { success: boolean; ref: string }
>({
  id: 'system.git.checkout',
  name: 'Git Checkout',
  description: 'Checkout a branch or commit (gitx.do)',
  category: 'development',
  subcategory: 'git',
  input: {
    type: 'object',
    properties: {
      ref: { type: 'string', description: 'Branch, tag, or commit to checkout' },
      path: { type: 'string', description: 'Repository path' },
      create: { type: 'boolean', description: 'Create new branch (-b flag)', default: false },
    },
    required: ['ref'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/gitx
    return {
      success: true,
      ref: input.ref,
    }
  },
  options: {
    audience: 'both',
    tags: ['git', 'checkout', 'branch', 'gitx'],
    permissions: [{ type: 'write', resource: 'git' }],
  },
})

/**
 * Push commits to remote
 */
export const gitPush = defineTool<
  { path?: string; remote?: string; branch?: string; force?: boolean },
  { success: boolean; remote: string; branch: string; commits: number }
>({
  id: 'system.git.push',
  name: 'Git Push',
  description: 'Push commits to a remote repository (gitx.do)',
  category: 'development',
  subcategory: 'git',
  input: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repository path' },
      remote: { type: 'string', description: 'Remote name', default: 'origin' },
      branch: { type: 'string', description: 'Branch to push' },
      force: { type: 'boolean', description: 'Force push', default: false },
    },
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/gitx
    return {
      success: true,
      remote: input.remote || 'origin',
      branch: input.branch || 'main',
      commits: 0,
    }
  },
  options: {
    audience: 'both',
    tags: ['git', 'push', 'remote', 'gitx'],
    permissions: [{ type: 'write', resource: 'git' }],
    requiresConfirmation: true,
  },
})

/**
 * Pull commits from remote
 */
export const gitPull = defineTool<
  { path?: string; remote?: string; branch?: string; rebase?: boolean },
  { success: boolean; remote: string; branch: string; commits: number; conflicts: string[] }
>({
  id: 'system.git.pull',
  name: 'Git Pull',
  description: 'Pull commits from a remote repository (gitx.do)',
  category: 'development',
  subcategory: 'git',
  input: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Repository path' },
      remote: { type: 'string', description: 'Remote name', default: 'origin' },
      branch: { type: 'string', description: 'Branch to pull' },
      rebase: { type: 'boolean', description: 'Rebase instead of merge', default: false },
    },
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use @dotdo/gitx
    return {
      success: true,
      remote: input.remote || 'origin',
      branch: input.branch || 'main',
      commits: 0,
      conflicts: [],
    }
  },
  options: {
    audience: 'both',
    tags: ['git', 'pull', 'remote', 'gitx'],
    permissions: [{ type: 'write', resource: 'git' }],
  },
})

// ============================================================================
// Shell/Bash Tools (bashx.do integration)
// ============================================================================

/**
 * Execute a bash command with AI-enhanced safety
 */
export const bashExec = defineTool<
  {
    command: string
    cwd?: string
    env?: Record<string, string>
    timeout?: number
    stdin?: string
  },
  {
    stdout: string
    stderr: string
    exitCode: number
    duration: number
  }
>({
  id: 'system.bash.exec',
  name: 'Execute Bash Command',
  description: 'Execute a bash command with AI-enhanced safety and intent understanding (bashx.do)',
  category: 'system',
  subcategory: 'shell',
  input: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Command to execute' },
      cwd: { type: 'string', description: 'Working directory' },
      env: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Environment variables',
      },
      timeout: { type: 'number', description: 'Timeout in milliseconds', default: 30000 },
      stdin: { type: 'string', description: 'Standard input to provide' },
    },
    required: ['command'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use bashx.do
    // bashx.do provides:
    // - AI safety analysis (warns about destructive commands)
    // - Intent understanding (suggests corrections)
    // - Intelligent error recovery
    return {
      stdout: `[bashx.do] Would execute: ${input.command}`,
      stderr: '',
      exitCode: 0,
      duration: 0,
    }
  },
  options: {
    audience: 'both',
    tags: ['bash', 'shell', 'exec', 'command', 'bashx'],
    permissions: [{ type: 'execute', resource: 'shell' }],
    requiresConfirmation: true,
    securityLevel: 'restricted',
  },
})

/**
 * Analyze command safety before execution
 */
export const bashAnalyze = defineTool<
  { command: string },
  {
    safe: boolean
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
    warnings: string[]
    suggestions: string[]
    intent: string
  }
>({
  id: 'system.bash.analyze',
  name: 'Analyze Bash Command',
  description: 'Analyze a bash command for safety using AI (bashx.do)',
  category: 'system',
  subcategory: 'shell',
  input: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Command to analyze' },
    },
    required: ['command'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use bashx.do AI analysis
    // Detect patterns like:
    // - rm -rf / (destructive)
    // - chmod 777 (security risk)
    // - curl | bash (execution risk)
    const warnings: string[] = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    if (input.command.includes('rm -rf')) {
      warnings.push('Recursive force delete detected')
      riskLevel = 'high'
    }
    if (input.command.includes('chmod 777')) {
      warnings.push('Overly permissive file permissions')
      riskLevel = 'medium'
    }
    if (input.command.includes('| bash') || input.command.includes('| sh')) {
      warnings.push('Pipe to shell execution detected')
      riskLevel = 'high'
    }

    return {
      safe: warnings.length === 0,
      riskLevel,
      warnings,
      suggestions: [],
      intent: `Execute: ${input.command}`,
    }
  },
  options: {
    audience: 'both',
    tags: ['bash', 'safety', 'analyze', 'bashx'],
    idempotent: true,
  },
})

/**
 * Execute a script file
 */
export const bashScript = defineTool<
  {
    script: string
    args?: string[]
    cwd?: string
    env?: Record<string, string>
  },
  {
    stdout: string
    stderr: string
    exitCode: number
  }
>({
  id: 'system.bash.script',
  name: 'Execute Bash Script',
  description: 'Execute a bash script with arguments (bashx.do)',
  category: 'system',
  subcategory: 'shell',
  input: {
    type: 'object',
    properties: {
      script: { type: 'string', description: 'Script content or path' },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Script arguments',
      },
      cwd: { type: 'string', description: 'Working directory' },
      env: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Environment variables',
      },
    },
    required: ['script'],
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use bashx.do
    return {
      stdout: `[bashx.do] Would execute script with args: ${input.args?.join(' ') || '(none)'}`,
      stderr: '',
      exitCode: 0,
    }
  },
  options: {
    audience: 'both',
    tags: ['bash', 'script', 'execute', 'bashx'],
    permissions: [{ type: 'execute', resource: 'shell' }],
    requiresConfirmation: true,
    securityLevel: 'restricted',
  },
})

/**
 * Get environment information
 */
export const bashEnv = defineTool<
  { filter?: string },
  { variables: Record<string, string>; shell: string; cwd: string; user: string }
>({
  id: 'system.bash.env',
  name: 'Get Environment',
  description: 'Get shell environment information (bashx.do)',
  category: 'system',
  subcategory: 'shell',
  input: {
    type: 'object',
    properties: {
      filter: { type: 'string', description: 'Filter variables by prefix' },
    },
  },
  handler: async (input) => {
    // Placeholder - actual implementation will use bashx.do
    return {
      variables: {},
      shell: '/bin/bash',
      cwd: '/',
      user: 'unknown',
    }
  },
  options: {
    audience: 'both',
    tags: ['bash', 'environment', 'env', 'bashx'],
    idempotent: true,
  },
})

// ============================================================================
// Tool Collections
// ============================================================================

/**
 * All filesystem tools (fsx.do)
 */
export const fsxTools: AnyTool[] = [fsRead, fsWrite, fsList, fsDelete, fsGlob, fsGrep]

/**
 * All git tools (gitx.do)
 */
export const gitxTools: AnyTool[] = [
  gitInit,
  gitClone,
  gitStatus,
  gitAdd,
  gitCommit,
  gitLog,
  gitDiff,
  gitCheckout,
  gitPush,
  gitPull,
]

/**
 * All bash tools (bashx.do)
 */
export const bashxTools: AnyTool[] = [bashExec, bashAnalyze, bashScript, bashEnv]

/**
 * All system tools (fsx + gitx + bashx)
 */
export const systemTools: AnyTool[] = [...fsxTools, ...gitxTools, ...bashxTools]
