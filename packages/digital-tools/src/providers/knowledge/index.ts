/**
 * Knowledge Providers
 *
 * @packageDocumentation
 */

export { notionInfo, notionProvider, createNotionProvider } from './notion.js'

import { notionProvider } from './notion.js'

/**
 * Register all knowledge providers
 */
export function registerKnowledgeProviders(): void {
  notionProvider.register()
}

/**
 * All knowledge providers
 */
export const knowledgeProviders = [notionProvider]
