/**
 * Tests for Content functionality
 *
 * Covers content creation and workflow helper.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Content, Workflow, registry } from '../src/index.js'

describe('Content', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('Content creation', () => {
    it('creates content with basic config', () => {
      const content = Content({
        id: 'blog',
        name: 'Blog Posts',
        description: 'Blog content',
        version: '1.0.0',
      })

      expect(content.id).toBe('blog')
      expect(content.name).toBe('Blog Posts')
      expect(content.type).toBe('content')
    })

    it('defaults format to markdown', () => {
      const content = Content({
        id: 'docs',
        name: 'Documentation',
        description: 'Docs content',
        version: '1.0.0',
      })

      expect(content.format).toBe('markdown')
    })

    it('supports mdx format', () => {
      const content = Content({
        id: 'interactive-docs',
        name: 'Interactive Docs',
        description: 'MDX content',
        version: '1.0.0',
        format: 'mdx',
      })

      expect(content.format).toBe('mdx')
    })

    it('creates content with source', () => {
      const content = Content({
        id: 'blog',
        name: 'Blog Posts',
        description: 'Blog content',
        version: '1.0.0',
        source: './content/blog',
      })

      expect(content.source).toBe('./content/blog')
    })

    it('creates content with frontmatter schema', () => {
      const content = Content({
        id: 'blog',
        name: 'Blog Posts',
        description: 'Blog content',
        version: '1.0.0',
        frontmatter: {
          title: 'Post title',
          author: 'Author name',
          date: 'Publication date (date)',
          tags: ['Array of tags'],
        },
      })

      expect(content.frontmatter?.title).toBe('Post title')
      expect(content.frontmatter?.author).toBe('Author name')
    })

    it('creates content with categories', () => {
      const content = Content({
        id: 'blog',
        name: 'Blog Posts',
        description: 'Blog content',
        version: '1.0.0',
        categories: ['Technology', 'Business', 'Design'],
      })

      expect(content.categories).toHaveLength(3)
      expect(content.categories).toContain('Technology')
    })

    it('creates content with workflow', () => {
      const content = Content({
        id: 'blog',
        name: 'Blog Posts',
        description: 'Blog content',
        version: '1.0.0',
        workflow: Workflow({
          states: ['draft', 'review', 'published'],
          initialState: 'draft',
          transitions: [
            { from: 'draft', to: 'review', action: 'submit' },
            { from: 'review', to: 'published', action: 'approve' },
          ],
        }),
      })

      expect(content.workflow?.states).toHaveLength(3)
      expect(content.workflow?.initialState).toBe('draft')
    })

    it('registers content automatically', () => {
      Content({
        id: 'auto-registered',
        name: 'Auto Registered',
        description: 'Automatically registered',
        version: '1.0.0',
      })

      expect(registry.get('auto-registered')).toBeDefined()
    })
  })

  describe('Workflow helper', () => {
    it('creates a workflow with states', () => {
      const workflow = Workflow({
        states: ['draft', 'review', 'published', 'archived'],
        initialState: 'draft',
        transitions: [],
      })

      expect(workflow.states).toHaveLength(4)
      expect(workflow.initialState).toBe('draft')
    })

    it('creates a workflow with transitions', () => {
      const workflow = Workflow({
        states: ['draft', 'review', 'published'],
        initialState: 'draft',
        transitions: [
          { from: 'draft', to: 'review', action: 'submit' },
          { from: 'review', to: 'published', action: 'approve' },
          { from: 'review', to: 'draft', action: 'reject' },
        ],
      })

      expect(workflow.transitions).toHaveLength(3)
      expect(workflow.transitions?.[0]?.from).toBe('draft')
      expect(workflow.transitions?.[0]?.to).toBe('review')
    })

    it('supports approvals config', () => {
      const workflow = Workflow({
        states: ['draft', 'review', 'published'],
        initialState: 'draft',
        transitions: [
          { from: 'draft', to: 'review', action: 'submit' },
        ],
        approvals: [
          { state: 'review', roles: ['editor', 'admin'] },
        ],
      })

      expect(workflow.approvals).toHaveLength(1)
      expect(workflow.approvals?.[0]?.roles).toContain('editor')
    })
  })
})
