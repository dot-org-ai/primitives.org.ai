/**
 * Content() - Define content
 */

import type { ContentDefinition, WorkflowDefinition } from './types.js'
import { registerProduct } from './product.js'

/**
 * Create a content definition
 *
 * @example
 * ```ts
 * const blogContent = Content({
 *   id: 'blog',
 *   name: 'Blog Posts',
 *   description: 'Blog content for the website',
 *   version: '1.0.0',
 *   format: 'mdx',
 *   source: './content/blog',
 *   frontmatter: {
 *     title: 'Post title',
 *     author: 'Author name',
 *     date: 'Publication date (date)',
 *     tags: ['Array of tags'],
 *   },
 *   categories: ['Technology', 'Business', 'Design'],
 *   workflow: Workflow({
 *     states: ['draft', 'review', 'published'],
 *     initialState: 'draft',
 *     transitions: [
 *       { from: 'draft', to: 'review', action: 'submit' },
 *       { from: 'review', to: 'published', action: 'approve' },
 *       { from: 'review', to: 'draft', action: 'reject' },
 *     ],
 *   }),
 * })
 * ```
 */
export function Content(config: Omit<ContentDefinition, 'type'>): ContentDefinition {
  const content: ContentDefinition = {
    type: 'content',
    id: config.id,
    name: config.name,
    description: config.description,
    version: config.version,
    format: config.format || 'markdown',
    status: config.status || 'active',
    ...(config.source !== undefined && { source: config.source }),
    ...(config.schema !== undefined && { schema: config.schema }),
    ...(config.frontmatter !== undefined && { frontmatter: config.frontmatter }),
    ...(config.categories !== undefined && { categories: config.categories }),
    ...(config.workflow !== undefined && { workflow: config.workflow }),
    ...(config.metadata !== undefined && { metadata: config.metadata }),
    ...(config.tags !== undefined && { tags: config.tags }),
  }

  return registerProduct(content)
}

/**
 * Helper to create a workflow definition
 *
 * @example
 * ```ts
 * const workflow = Workflow({
 *   states: ['draft', 'review', 'published', 'archived'],
 *   initialState: 'draft',
 *   transitions: [
 *     { from: 'draft', to: 'review', action: 'submit' },
 *     { from: 'review', to: 'published', action: 'approve' },
 *     { from: 'review', to: 'draft', action: 'reject' },
 *     { from: 'published', to: 'archived', action: 'archive' },
 *   ],
 *   approvals: [
 *     { state: 'review', roles: ['editor', 'admin'] },
 *   ],
 * })
 * ```
 */
export function Workflow(config: WorkflowDefinition): WorkflowDefinition {
  return config
}
