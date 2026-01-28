/**
 * Tests for System Tools (fsx.do, gitx.do, bashx.do integration)
 *
 * Tests filesystem, git, and bash tools that integrate with the dotdo ecosystem.
 */

import { describe, it, expect, beforeEach } from 'vitest'
// Import directly from the source file to ensure proper resolution
import {
  fsRead,
  fsWrite,
  fsList,
  fsDelete,
  fsGlob,
  fsGrep,
  fsxTools,
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
  gitxTools,
  bashExec,
  bashAnalyze,
  bashScript,
  bashEnv,
  bashxTools,
  systemTools,
} from '../src/tools/system.js'

import { registry, registerBuiltinTools, getBuiltinTools } from '../src/index.js'

// ============================================================================
// Filesystem Tools (fsx.do) Tests
// ============================================================================

describe('Filesystem Tools (fsx.do)', () => {
  describe('fsRead', () => {
    it('has correct metadata', () => {
      expect(fsRead.id).toBe('system.fs.read')
      expect(fsRead.name).toBe('Read File')
      expect(fsRead.category).toBe('system')
      expect(fsRead.subcategory).toBe('filesystem')
    })

    it('has required path parameter', () => {
      const pathParam = fsRead.parameters.find((p) => p.name === 'path')
      expect(pathParam).toBeDefined()
      expect(pathParam?.required).toBe(true)
    })

    it('has optional encoding parameter', () => {
      const encodingParam = fsRead.parameters.find((p) => p.name === 'encoding')
      expect(encodingParam).toBeDefined()
      expect(encodingParam?.required).toBe(false)
    })

    it('is idempotent', () => {
      expect(fsRead.idempotent).toBe(true)
    })

    it('has fsx tag', () => {
      expect(fsRead.tags).toContain('fsx')
    })

    it('returns file content structure', async () => {
      const result = await fsRead.handler({ path: '/test/file.txt' })
      expect(result).toHaveProperty('content')
      expect(result).toHaveProperty('size')
      expect(result).toHaveProperty('encoding')
    })
  })

  describe('fsWrite', () => {
    it('has correct metadata', () => {
      expect(fsWrite.id).toBe('system.fs.write')
      expect(fsWrite.category).toBe('system')
      expect(fsWrite.subcategory).toBe('filesystem')
    })

    it('has required parameters', () => {
      const pathParam = fsWrite.parameters.find((p) => p.name === 'path')
      const contentParam = fsWrite.parameters.find((p) => p.name === 'content')
      expect(pathParam?.required).toBe(true)
      expect(contentParam?.required).toBe(true)
    })

    it('has write permission', () => {
      expect(fsWrite.permissions).toBeDefined()
      expect(fsWrite.permissions?.[0]?.type).toBe('write')
      expect(fsWrite.permissions?.[0]?.resource).toBe('filesystem')
    })

    it('returns success structure', async () => {
      const result = await fsWrite.handler({
        path: '/test/file.txt',
        content: 'Hello World',
      })
      expect(result.success).toBe(true)
      expect(result.path).toBe('/test/file.txt')
      expect(result.size).toBe(11)
    })
  })

  describe('fsList', () => {
    it('has correct metadata', () => {
      expect(fsList.id).toBe('system.fs.list')
      expect(fsList.category).toBe('system')
    })

    it('returns directory listing structure', async () => {
      const result = await fsList.handler({ path: '/test' })
      expect(result).toHaveProperty('entries')
      expect(result).toHaveProperty('count')
      expect(Array.isArray(result.entries)).toBe(true)
    })

    it('is idempotent', () => {
      expect(fsList.idempotent).toBe(true)
    })
  })

  describe('fsDelete', () => {
    it('has correct metadata', () => {
      expect(fsDelete.id).toBe('system.fs.delete')
      expect(fsDelete.category).toBe('system')
    })

    it('requires confirmation', () => {
      expect(fsDelete.requiresConfirmation).toBe(true)
    })

    it('has write permission', () => {
      expect(fsDelete.permissions?.[0]?.type).toBe('write')
    })
  })

  describe('fsGlob', () => {
    it('has correct metadata', () => {
      expect(fsGlob.id).toBe('system.fs.glob')
      expect(fsGlob.category).toBe('system')
    })

    it('requires pattern parameter', () => {
      const patternParam = fsGlob.parameters.find((p) => p.name === 'pattern')
      expect(patternParam?.required).toBe(true)
    })

    it('returns matches structure', async () => {
      const result = await fsGlob.handler({ pattern: '**/*.ts' })
      expect(result).toHaveProperty('matches')
      expect(result).toHaveProperty('count')
    })
  })

  describe('fsGrep', () => {
    it('has correct metadata', () => {
      expect(fsGrep.id).toBe('system.fs.grep')
      expect(fsGrep.category).toBe('system')
    })

    it('requires pattern parameter', () => {
      const patternParam = fsGrep.parameters.find((p) => p.name === 'pattern')
      expect(patternParam?.required).toBe(true)
    })

    it('returns matches with line info', async () => {
      const result = await fsGrep.handler({ pattern: 'TODO' })
      expect(result).toHaveProperty('matches')
      expect(result).toHaveProperty('count')
    })
  })

  describe('fsxTools array', () => {
    it('contains all filesystem tools', () => {
      expect(fsxTools).toHaveLength(6)
      const ids = fsxTools.map((t) => t.id)
      expect(ids).toContain('system.fs.read')
      expect(ids).toContain('system.fs.write')
      expect(ids).toContain('system.fs.list')
      expect(ids).toContain('system.fs.delete')
      expect(ids).toContain('system.fs.glob')
      expect(ids).toContain('system.fs.grep')
    })

    it('all tools have fsx tag', () => {
      for (const tool of fsxTools) {
        expect(tool.tags).toContain('fsx')
      }
    })
  })
})

// ============================================================================
// Git Tools (gitx.do) Tests
// ============================================================================

describe('Git Tools (gitx.do)', () => {
  describe('gitInit', () => {
    it('has correct metadata', () => {
      expect(gitInit.id).toBe('system.git.init')
      expect(gitInit.name).toBe('Git Init')
      expect(gitInit.category).toBe('development')
      expect(gitInit.subcategory).toBe('git')
    })

    it('has gitx tag', () => {
      expect(gitInit.tags).toContain('gitx')
    })

    it('returns success structure', async () => {
      const result = await gitInit.handler({})
      expect(result.success).toBe(true)
      expect(result.path).toBeDefined()
    })
  })

  describe('gitClone', () => {
    it('has correct metadata', () => {
      expect(gitClone.id).toBe('system.git.clone')
      expect(gitClone.category).toBe('development')
    })

    it('requires url parameter', () => {
      const urlParam = gitClone.parameters.find((p) => p.name === 'url')
      expect(urlParam?.required).toBe(true)
    })

    it('returns clone result', async () => {
      const result = await gitClone.handler({ url: 'https://github.com/test/repo' })
      expect(result.success).toBe(true)
      expect(result.branch).toBeDefined()
    })
  })

  describe('gitStatus', () => {
    it('has correct metadata', () => {
      expect(gitStatus.id).toBe('system.git.status')
      expect(gitStatus.category).toBe('development')
    })

    it('is idempotent', () => {
      expect(gitStatus.idempotent).toBe(true)
    })

    it('returns comprehensive status', async () => {
      const result = await gitStatus.handler({})
      expect(result).toHaveProperty('branch')
      expect(result).toHaveProperty('clean')
      expect(result).toHaveProperty('staged')
      expect(result).toHaveProperty('modified')
      expect(result).toHaveProperty('untracked')
      expect(result).toHaveProperty('ahead')
      expect(result).toHaveProperty('behind')
    })
  })

  describe('gitAdd', () => {
    it('has correct metadata', () => {
      expect(gitAdd.id).toBe('system.git.add')
      expect(gitAdd.category).toBe('development')
    })

    it('requires files parameter', () => {
      const filesParam = gitAdd.parameters.find((p) => p.name === 'files')
      expect(filesParam?.required).toBe(true)
    })

    it('has write permission', () => {
      expect(gitAdd.permissions?.[0]?.resource).toBe('git')
    })
  })

  describe('gitCommit', () => {
    it('has correct metadata', () => {
      expect(gitCommit.id).toBe('system.git.commit')
      expect(gitCommit.category).toBe('development')
    })

    it('requires message parameter', () => {
      const messageParam = gitCommit.parameters.find((p) => p.name === 'message')
      expect(messageParam?.required).toBe(true)
    })

    it('returns commit result', async () => {
      const result = await gitCommit.handler({ message: 'Test commit' })
      expect(result.success).toBe(true)
      expect(result.sha).toBeDefined()
      expect(result.message).toBe('Test commit')
    })
  })

  describe('gitLog', () => {
    it('has correct metadata', () => {
      expect(gitLog.id).toBe('system.git.log')
      expect(gitLog.category).toBe('development')
    })

    it('is idempotent', () => {
      expect(gitLog.idempotent).toBe(true)
    })

    it('returns commits array', async () => {
      const result = await gitLog.handler({})
      expect(result).toHaveProperty('commits')
      expect(Array.isArray(result.commits)).toBe(true)
    })
  })

  describe('gitDiff', () => {
    it('has correct metadata', () => {
      expect(gitDiff.id).toBe('system.git.diff')
      expect(gitDiff.category).toBe('development')
    })

    it('returns diff statistics', async () => {
      const result = await gitDiff.handler({})
      expect(result).toHaveProperty('diff')
      expect(result).toHaveProperty('additions')
      expect(result).toHaveProperty('deletions')
      expect(result).toHaveProperty('files')
    })
  })

  describe('gitCheckout', () => {
    it('has correct metadata', () => {
      expect(gitCheckout.id).toBe('system.git.checkout')
      expect(gitCheckout.category).toBe('development')
    })

    it('requires ref parameter', () => {
      const refParam = gitCheckout.parameters.find((p) => p.name === 'ref')
      expect(refParam?.required).toBe(true)
    })
  })

  describe('gitPush', () => {
    it('has correct metadata', () => {
      expect(gitPush.id).toBe('system.git.push')
      expect(gitPush.category).toBe('development')
    })

    it('requires confirmation', () => {
      expect(gitPush.requiresConfirmation).toBe(true)
    })

    it('has write permission', () => {
      expect(gitPush.permissions?.[0]?.type).toBe('write')
    })
  })

  describe('gitPull', () => {
    it('has correct metadata', () => {
      expect(gitPull.id).toBe('system.git.pull')
      expect(gitPull.category).toBe('development')
    })

    it('returns pull result with conflict info', async () => {
      const result = await gitPull.handler({})
      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('commits')
      expect(result).toHaveProperty('conflicts')
    })
  })

  describe('gitxTools array', () => {
    it('contains all git tools', () => {
      expect(gitxTools).toHaveLength(10)
      const ids = gitxTools.map((t) => t.id)
      expect(ids).toContain('system.git.init')
      expect(ids).toContain('system.git.clone')
      expect(ids).toContain('system.git.status')
      expect(ids).toContain('system.git.add')
      expect(ids).toContain('system.git.commit')
      expect(ids).toContain('system.git.log')
      expect(ids).toContain('system.git.diff')
      expect(ids).toContain('system.git.checkout')
      expect(ids).toContain('system.git.push')
      expect(ids).toContain('system.git.pull')
    })

    it('all tools have gitx tag', () => {
      for (const tool of gitxTools) {
        expect(tool.tags).toContain('gitx')
      }
    })
  })
})

// ============================================================================
// Bash Tools (bashx.do) Tests
// ============================================================================

describe('Bash Tools (bashx.do)', () => {
  describe('bashExec', () => {
    it('has correct metadata', () => {
      expect(bashExec.id).toBe('system.bash.exec')
      expect(bashExec.name).toBe('Execute Bash Command')
      expect(bashExec.category).toBe('system')
      expect(bashExec.subcategory).toBe('shell')
    })

    it('requires command parameter', () => {
      const cmdParam = bashExec.parameters.find((p) => p.name === 'command')
      expect(cmdParam?.required).toBe(true)
    })

    it('has bashx tag', () => {
      expect(bashExec.tags).toContain('bashx')
    })

    it('requires confirmation', () => {
      expect(bashExec.requiresConfirmation).toBe(true)
    })

    it('has restricted security level', () => {
      expect(bashExec.securityLevel).toBe('restricted')
    })

    it('has execute permission', () => {
      expect(bashExec.permissions?.[0]?.type).toBe('execute')
      expect(bashExec.permissions?.[0]?.resource).toBe('shell')
    })

    it('returns execution result', async () => {
      const result = await bashExec.handler({ command: 'echo hello' })
      expect(result).toHaveProperty('stdout')
      expect(result).toHaveProperty('stderr')
      expect(result).toHaveProperty('exitCode')
      expect(result).toHaveProperty('duration')
    })
  })

  describe('bashAnalyze', () => {
    it('has correct metadata', () => {
      expect(bashAnalyze.id).toBe('system.bash.analyze')
      expect(bashAnalyze.category).toBe('system')
    })

    it('requires command parameter', () => {
      const cmdParam = bashAnalyze.parameters.find((p) => p.name === 'command')
      expect(cmdParam?.required).toBe(true)
    })

    it('is idempotent', () => {
      expect(bashAnalyze.idempotent).toBe(true)
    })

    it('returns safety analysis', async () => {
      const result = await bashAnalyze.handler({ command: 'ls -la' })
      expect(result).toHaveProperty('safe')
      expect(result).toHaveProperty('riskLevel')
      expect(result).toHaveProperty('warnings')
      expect(result).toHaveProperty('suggestions')
      expect(result).toHaveProperty('intent')
    })

    it('detects dangerous rm -rf command', async () => {
      const result = await bashAnalyze.handler({ command: 'rm -rf /' })
      expect(result.safe).toBe(false)
      expect(result.riskLevel).toBe('high')
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('detects overly permissive chmod', async () => {
      const result = await bashAnalyze.handler({ command: 'chmod 777 file.txt' })
      expect(result.safe).toBe(false)
      expect(result.warnings.length).toBeGreaterThan(0)
    })

    it('detects pipe to bash execution', async () => {
      const result = await bashAnalyze.handler({ command: 'curl http://example.com | bash' })
      expect(result.safe).toBe(false)
      expect(result.riskLevel).toBe('high')
    })

    it('marks safe commands as safe', async () => {
      const result = await bashAnalyze.handler({ command: 'echo hello' })
      expect(result.safe).toBe(true)
      expect(result.riskLevel).toBe('low')
    })
  })

  describe('bashScript', () => {
    it('has correct metadata', () => {
      expect(bashScript.id).toBe('system.bash.script')
      expect(bashScript.category).toBe('system')
    })

    it('requires script parameter', () => {
      const scriptParam = bashScript.parameters.find((p) => p.name === 'script')
      expect(scriptParam?.required).toBe(true)
    })

    it('requires confirmation', () => {
      expect(bashScript.requiresConfirmation).toBe(true)
    })

    it('has restricted security level', () => {
      expect(bashScript.securityLevel).toBe('restricted')
    })
  })

  describe('bashEnv', () => {
    it('has correct metadata', () => {
      expect(bashEnv.id).toBe('system.bash.env')
      expect(bashEnv.category).toBe('system')
    })

    it('is idempotent', () => {
      expect(bashEnv.idempotent).toBe(true)
    })

    it('returns environment info', async () => {
      const result = await bashEnv.handler({})
      expect(result).toHaveProperty('variables')
      expect(result).toHaveProperty('shell')
      expect(result).toHaveProperty('cwd')
      expect(result).toHaveProperty('user')
    })
  })

  describe('bashxTools array', () => {
    it('contains all bash tools', () => {
      expect(bashxTools).toHaveLength(4)
      const ids = bashxTools.map((t) => t.id)
      expect(ids).toContain('system.bash.exec')
      expect(ids).toContain('system.bash.analyze')
      expect(ids).toContain('system.bash.script')
      expect(ids).toContain('system.bash.env')
    })

    it('all tools have bashx tag', () => {
      for (const tool of bashxTools) {
        expect(tool.tags).toContain('bashx')
      }
    })
  })
})

// ============================================================================
// Combined System Tools Tests
// ============================================================================

describe('System Tools Collection', () => {
  describe('systemTools array', () => {
    it('contains all system tools', () => {
      const expectedCount = fsxTools.length + gitxTools.length + bashxTools.length
      expect(systemTools).toHaveLength(expectedCount)
    })

    it('includes fsx tools', () => {
      const ids = systemTools.map((t) => t.id)
      expect(ids).toContain('system.fs.read')
      expect(ids).toContain('system.fs.write')
    })

    it('includes gitx tools', () => {
      const ids = systemTools.map((t) => t.id)
      expect(ids).toContain('system.git.init')
      expect(ids).toContain('system.git.commit')
    })

    it('includes bashx tools', () => {
      const ids = systemTools.map((t) => t.id)
      expect(ids).toContain('system.bash.exec')
      expect(ids).toContain('system.bash.analyze')
    })
  })
})

// ============================================================================
// Registry Integration Tests
// ============================================================================

describe('Registry Integration', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('direct registration', () => {
    it('can register system tools directly', () => {
      // Register system tools directly (bypassing main index)
      for (const tool of systemTools) {
        registry.register(tool)
      }

      // Check fsx tools
      expect(registry.has('system.fs.read')).toBe(true)
      expect(registry.has('system.fs.write')).toBe(true)

      // Check gitx tools
      expect(registry.has('system.git.status')).toBe(true)
      expect(registry.has('system.git.commit')).toBe(true)

      // Check bashx tools
      expect(registry.has('system.bash.exec')).toBe(true)
      expect(registry.has('system.bash.analyze')).toBe(true)
    })
  })

  describe('query by category', () => {
    it('can find system tools', () => {
      for (const tool of systemTools) {
        registry.register(tool)
      }

      const systemToolsFromRegistry = registry.byCategory('system')
      expect(systemToolsFromRegistry.length).toBeGreaterThan(0)

      const ids = systemToolsFromRegistry.map((t) => t.id)
      expect(ids).toContain('system.fs.read')
      expect(ids).toContain('system.bash.exec')
    })

    it('can find development tools (git)', () => {
      for (const tool of systemTools) {
        registry.register(tool)
      }

      const devTools = registry.byCategory('development')
      expect(devTools.length).toBeGreaterThan(0)

      const ids = devTools.map((t) => t.id)
      expect(ids).toContain('system.git.init')
      expect(ids).toContain('system.git.commit')
    })
  })
})

// ============================================================================
// Type Safety Tests
// ============================================================================

describe('Type Safety', () => {
  it('fsRead handler has correct types', async () => {
    const result = await fsRead.handler({ path: '/test', encoding: 'utf-8' })
    // TypeScript should infer these types correctly
    const content: string = result.content
    const size: number = result.size
    const encoding: string = result.encoding
    expect(typeof content).toBe('string')
    expect(typeof size).toBe('number')
    expect(typeof encoding).toBe('string')
  })

  it('gitStatus handler has correct types', async () => {
    const result = await gitStatus.handler({})
    // TypeScript should infer these types correctly
    const branch: string = result.branch
    const clean: boolean = result.clean
    const staged: string[] = result.staged
    expect(typeof branch).toBe('string')
    expect(typeof clean).toBe('boolean')
    expect(Array.isArray(staged)).toBe(true)
  })

  it('bashAnalyze handler has correct types', async () => {
    const result = await bashAnalyze.handler({ command: 'test' })
    // TypeScript should infer these types correctly
    const safe: boolean = result.safe
    const riskLevel: 'low' | 'medium' | 'high' | 'critical' = result.riskLevel
    const warnings: string[] = result.warnings
    expect(typeof safe).toBe('boolean')
    expect(['low', 'medium', 'high', 'critical']).toContain(riskLevel)
    expect(Array.isArray(warnings)).toBe(true)
  })
})
