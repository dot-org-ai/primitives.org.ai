import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const CONTENT_DIR = join(__dirname, '../../../content/digital-objects')

// Skip documentation tests until docs are created - see aip-v99 (StoryBrand Documentation Overhaul)
describe.skip('Documentation Structure', () => {
  describe('content/digital-objects/ folder', () => {
    it('should exist', () => {
      expect(existsSync(CONTENT_DIR)).toBe(true)
    })

    it('should have meta.json with proper structure', () => {
      const metaPath = join(CONTENT_DIR, 'meta.json')
      expect(existsSync(metaPath)).toBe(true)
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'))
      expect(meta.title).toBe('Digital Objects')
      expect(meta.root).toBe(true)
      expect(Array.isArray(meta.pages)).toBe(true)
    })
  })

  describe('Required MDX files', () => {
    const requiredFiles = [
      'index.mdx',
      'nouns.mdx',
      'verbs.mdx',
      'things.mdx',
      'actions.mdx',
      'graph.mdx',
      'providers.mdx',
      'r2-persistence.mdx',
    ]

    for (const file of requiredFiles) {
      it(`should have ${file}`, () => {
        expect(existsSync(join(CONTENT_DIR, file))).toBe(true)
      })

      it(`${file} should have proper frontmatter`, () => {
        const content = readFileSync(join(CONTENT_DIR, file), 'utf-8')
        expect(content.startsWith('---')).toBe(true)
        expect(content).toMatch(/title:\s*.+/)
        expect(content).toMatch(/description:\s*.+/)
      })
    }
  })
})
