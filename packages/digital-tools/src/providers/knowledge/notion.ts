/**
 * Notion Knowledge Provider
 *
 * Concrete implementation of KnowledgeProvider using Notion API v1.
 *
 * @packageDocumentation
 */

import type {
  KnowledgeProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  CreatePageOptions,
  PageData,
  PageListOptions,
  PaginatedResult,
  PaginationOptions,
  SpaceData,
} from '../types.js'
import { defineProvider } from '../registry.js'

const NOTION_API_URL = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

// =============================================================================
// Notion API Types
// =============================================================================

/**
 * Notion rich text object
 */
interface NotionRichText {
  type: 'text' | 'mention' | 'equation'
  text?: {
    content: string
    link?: { url: string } | null
  }
  plain_text: string
  annotations?: {
    bold: boolean
    italic: boolean
    strikethrough: boolean
    underline: boolean
    code: boolean
    color: string
  }
  href?: string | null
}

/**
 * Notion user reference
 */
interface NotionUserReference {
  id: string
  object?: 'user'
}

/**
 * Notion icon object
 */
interface NotionIcon {
  type: 'emoji' | 'external' | 'file'
  emoji?: string
  external?: { url: string }
  file?: { url: string; expiry_time?: string }
}

/**
 * Notion cover object
 */
interface NotionCover {
  type: 'external' | 'file'
  external?: { url: string }
  file?: { url: string; expiry_time?: string }
}

/**
 * Notion parent object
 */
interface NotionParent {
  type: 'page_id' | 'database_id' | 'workspace' | 'block_id'
  page_id?: string
  database_id?: string
  workspace?: boolean
  block_id?: string
}

/**
 * Notion property value types
 */
interface NotionTitleProperty {
  type: 'title'
  title: NotionRichText[]
  id: string
}

interface NotionRichTextProperty {
  type: 'rich_text'
  rich_text: NotionRichText[]
  id: string
}

interface NotionProperty {
  type: string
  id: string
  title?: NotionRichText[]
  rich_text?: NotionRichText[]
  [key: string]: unknown
}

/**
 * Notion page object from API
 */
interface NotionPage {
  object: 'page'
  id: string
  created_time: string
  last_edited_time: string
  created_by: NotionUserReference
  last_edited_by: NotionUserReference
  cover: NotionCover | null
  icon: NotionIcon | null
  parent: NotionParent
  archived: boolean
  in_trash: boolean
  properties: Record<string, NotionProperty>
  url: string
  public_url?: string | null
  child_page?: { title: string }
}

/**
 * Notion database object from API
 */
interface NotionDatabase {
  object: 'database'
  id: string
  created_time: string
  last_edited_time: string
  created_by: NotionUserReference
  last_edited_by: NotionUserReference
  title: NotionRichText[]
  description: NotionRichText[]
  icon: NotionIcon | null
  cover: NotionCover | null
  parent: NotionParent
  url: string
  public_url?: string | null
  archived: boolean
  in_trash: boolean
  is_inline: boolean
  properties: Record<string, NotionProperty>
}

/**
 * Notion API error response
 */
interface NotionErrorResponse {
  object: 'error'
  status: number
  code: string
  message: string
}

/**
 * Notion paginated response
 */
interface NotionPaginatedResponse<T> {
  object: 'list'
  results: T[]
  next_cursor: string | null
  has_more: boolean
  type?: string
}

/**
 * Request body for creating a page
 */
interface NotionCreatePageBody {
  parent: { page_id: string } | { database_id: string }
  properties: {
    title: Array<{ text: { content: string } }>
  }
  icon?: { emoji: string }
  cover?: { external: { url: string } }
  children?: NotionBlock[]
}

/**
 * Notion block object
 */
interface NotionBlock {
  object: 'block'
  type: string
  paragraph?: {
    rich_text: Array<{
      type: 'text'
      text: { content: string }
    }>
  }
  [key: string]: unknown
}

/**
 * Request body for database query
 */
interface NotionDatabaseQueryBody {
  page_size?: number
  start_cursor?: string
  filter?: Record<string, unknown>
  sorts?: Array<Record<string, unknown>>
}

/**
 * Request body for search
 */
interface NotionSearchBody {
  query?: string
  page_size?: number
  start_cursor?: string
  filter?: {
    property: 'object'
    value: 'page' | 'database'
  }
  sort?: {
    direction: 'ascending' | 'descending'
    timestamp: 'last_edited_time'
  }
}

/**
 * Request body for updating a page
 */
interface NotionUpdatePageBody {
  properties: {
    title?: Array<{ text: { content: string } }>
  }
  icon?: { emoji: string } | null
  cover?: { external: { url: string } } | null
  archived?: boolean
}

/**
 * Notion provider info
 */
export const notionInfo: ProviderInfo = {
  id: 'knowledge.notion',
  name: 'Notion',
  description: 'Notion workspace and knowledge management platform',
  category: 'knowledge',
  website: 'https://notion.so',
  docsUrl: 'https://developers.notion.com',
  requiredConfig: ['integrationToken'],
  optionalConfig: ['defaultParentId', 'defaultDatabaseId'],
}

/**
 * Create Notion knowledge provider
 */
export function createNotionProvider(config: ProviderConfig): KnowledgeProvider {
  let integrationToken: string
  let defaultParentId: string | undefined
  let defaultDatabaseId: string | undefined

  /**
   * Make authenticated request to Notion API
   */
  async function notionRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = endpoint.startsWith('http') ? endpoint : `${NOTION_API_URL}${endpoint}`

    return fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${integrationToken}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
  }

  /**
   * Convert Notion page to PageData
   */
  function convertNotionPage(notionPage: NotionPage): PageData {
    const title = extractTitle(notionPage)
    const parentId = notionPage.parent?.page_id || notionPage.parent?.database_id || undefined
    const icon = notionPage.icon?.emoji || notionPage.icon?.external?.url
    const cover = notionPage.cover?.external?.url || notionPage.cover?.file?.url

    return {
      id: notionPage.id,
      title,
      ...(parentId !== undefined && { parentId }),
      ...(notionPage.parent?.workspace
        ? { spaceId: 'workspace' }
        : parentId !== undefined
        ? { spaceId: parentId }
        : {}),
      url: notionPage.url,
      ...(icon !== undefined && { icon }),
      ...(cover !== undefined && { cover }),
      createdAt: new Date(notionPage.created_time),
      updatedAt: new Date(notionPage.last_edited_time),
      createdBy: notionPage.created_by?.id,
      updatedBy: notionPage.last_edited_by?.id,
    }
  }

  /**
   * Extract title from Notion page properties
   */
  function extractTitle(notionPage: NotionPage | NotionDatabase): string {
    // For databases, title is a top-level property
    if ('title' in notionPage && Array.isArray(notionPage.title)) {
      const dbPage = notionPage as NotionDatabase
      if (dbPage.title.length > 0) {
        return dbPage.title.map((t) => t.plain_text).join('')
      }
    }

    // Check for title property in page properties
    const properties = notionPage.properties || {}

    // Look for title or Name property
    for (const [_key, value] of Object.entries(properties)) {
      const prop = value as NotionProperty
      if (prop.type === 'title' && prop.title && prop.title.length > 0) {
        return prop.title.map((t) => t.plain_text).join('')
      }
    }

    // Fallback to page title in child_page parent
    if ('child_page' in notionPage && notionPage.child_page?.title) {
      return notionPage.child_page.title
    }

    return 'Untitled'
  }

  /**
   * Build page properties for creation/update
   */
  function buildPageProperties(title: string): { title: Array<{ text: { content: string } }> } {
    return {
      title: [
        {
          text: {
            content: title,
          },
        },
      ],
    }
  }

  /**
   * Build parent object for page creation
   */
  function buildParent(
    parentId?: string,
    spaceId?: string
  ): { page_id: string } | { database_id: string } {
    const targetParent = parentId || spaceId || defaultParentId || defaultDatabaseId

    if (!targetParent) {
      throw new Error('Parent ID, space ID, or default parent/database must be provided')
    }

    // Determine if this is a page or database parent
    // UUIDs with dashes are typically pages, without dashes or starting with certain patterns are databases
    if (targetParent.includes('-')) {
      return { page_id: targetParent }
    } else {
      return { database_id: targetParent }
    }
  }

  return {
    info: notionInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      integrationToken = cfg['integrationToken'] as string
      defaultParentId = cfg['defaultParentId'] as string | undefined
      defaultDatabaseId = cfg['defaultDatabaseId'] as string | undefined

      if (!integrationToken) {
        throw new Error('Notion integration token is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        const response = await notionRequest('/users/me')

        return {
          healthy: response.ok,
          latencyMs: Date.now() - start,
          message: response.ok ? 'Connected' : `HTTP ${response.status}`,
          checkedAt: new Date(),
        }
      } catch (error) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          message: error instanceof Error ? error.message : 'Unknown error',
          checkedAt: new Date(),
        }
      }
    },

    async dispose(): Promise<void> {
      // No cleanup needed
    },

    async createPage(page: CreatePageOptions): Promise<PageData> {
      const parent = buildParent(page.parentId, page.spaceId)

      const body: NotionCreatePageBody = {
        parent,
        properties: buildPageProperties(page.title),
      }

      if (page.icon) {
        body.icon = { emoji: page.icon }
      }

      if (page.cover) {
        body.cover = { external: { url: page.cover } }
      }

      if (page.content) {
        // Convert simple content to Notion blocks
        body.children = [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: { content: page.content },
                },
              ],
            },
          },
        ]
      }

      try {
        const response = await notionRequest('/pages', {
          method: 'POST',
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorData = (await response
            .json()
            .catch(() => ({}))) as Partial<NotionErrorResponse>
          throw new Error(`Failed to create page: ${errorData?.message || response.statusText}`)
        }

        const notionPage = (await response.json()) as NotionPage
        return convertNotionPage(notionPage)
      } catch (error) {
        throw new Error(
          `Failed to create Notion page: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }
    },

    async getPage(pageId: string): Promise<PageData | null> {
      try {
        const response = await notionRequest(`/pages/${pageId}`)

        if (response.status === 404) {
          return null
        }

        if (!response.ok) {
          const errorData = (await response
            .json()
            .catch(() => ({}))) as Partial<NotionErrorResponse>
          throw new Error(`Failed to get page: ${errorData?.message || response.statusText}`)
        }

        const notionPage = (await response.json()) as NotionPage
        return convertNotionPage(notionPage)
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return null
        }
        throw new Error(
          `Failed to get Notion page: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async updatePage(pageId: string, updates: Partial<CreatePageOptions>): Promise<PageData> {
      const body: NotionUpdatePageBody = {
        properties: {},
      }

      if (updates.title) {
        body.properties.title = buildPageProperties(updates.title).title
      }

      if (updates.icon !== undefined) {
        body.icon = updates.icon ? { emoji: updates.icon } : null
      }

      if (updates.cover !== undefined) {
        body.cover = updates.cover ? { external: { url: updates.cover } } : null
      }

      try {
        const response = await notionRequest(`/pages/${pageId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorData = (await response
            .json()
            .catch(() => ({}))) as Partial<NotionErrorResponse>
          throw new Error(`Failed to update page: ${errorData?.message || response.statusText}`)
        }

        const notionPage = (await response.json()) as NotionPage
        return convertNotionPage(notionPage)
      } catch (error) {
        throw new Error(
          `Failed to update Notion page: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }
    },

    async deletePage(pageId: string): Promise<boolean> {
      try {
        const response = await notionRequest(`/pages/${pageId}`, {
          method: 'PATCH',
          body: JSON.stringify({ archived: true }),
        })

        if (!response.ok) {
          const errorData = (await response
            .json()
            .catch(() => ({}))) as Partial<NotionErrorResponse>
          throw new Error(`Failed to delete page: ${errorData?.message || response.statusText}`)
        }

        return true
      } catch (error) {
        throw new Error(
          `Failed to delete Notion page: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }
    },

    async listPages(options?: PageListOptions): Promise<PaginatedResult<PageData>> {
      // If parentId or spaceId is provided, use it; otherwise use defaults
      const parentId = options?.parentId || options?.spaceId || defaultDatabaseId

      if (!parentId) {
        throw new Error(
          'Parent ID, space ID, or default database must be provided for listing pages'
        )
      }

      try {
        const body: NotionDatabaseQueryBody = {
          page_size: options?.limit || 100,
        }

        if (options?.cursor) {
          body.start_cursor = options.cursor
        }

        const response = await notionRequest(`/databases/${parentId}/query`, {
          method: 'POST',
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorData = (await response
            .json()
            .catch(() => ({}))) as Partial<NotionErrorResponse>
          throw new Error(`Failed to list pages: ${errorData?.message || response.statusText}`)
        }

        const data = (await response.json()) as NotionPaginatedResponse<NotionPage>
        const pages = data.results.map(convertNotionPage)

        return {
          items: pages,
          hasMore: data.has_more,
          ...(data.next_cursor !== null && { nextCursor: data.next_cursor }),
        }
      } catch (error) {
        throw new Error(
          `Failed to list Notion pages: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },

    async searchPages(
      query: string,
      options?: PaginationOptions
    ): Promise<PaginatedResult<PageData>> {
      try {
        const body: NotionSearchBody = {
          query,
          page_size: options?.limit || 100,
          filter: {
            property: 'object',
            value: 'page',
          },
        }

        if (options?.cursor) {
          body.start_cursor = options.cursor
        }

        const response = await notionRequest('/search', {
          method: 'POST',
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorData = (await response
            .json()
            .catch(() => ({}))) as Partial<NotionErrorResponse>
          throw new Error(`Failed to search pages: ${errorData?.message || response.statusText}`)
        }

        const data = (await response.json()) as NotionPaginatedResponse<NotionPage>
        const pages = data.results.map(convertNotionPage)

        return {
          items: pages,
          hasMore: data.has_more,
          ...(data.next_cursor !== null && { nextCursor: data.next_cursor }),
        }
      } catch (error) {
        throw new Error(
          `Failed to search Notion pages: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }
    },

    async listSpaces(): Promise<SpaceData[]> {
      try {
        // List databases as "spaces"
        const body: NotionSearchBody = {
          filter: {
            property: 'object',
            value: 'database',
          },
          page_size: 100,
        }

        const response = await notionRequest('/search', {
          method: 'POST',
          body: JSON.stringify(body),
        })

        if (!response.ok) {
          const errorData = (await response
            .json()
            .catch(() => ({}))) as Partial<NotionErrorResponse>
          throw new Error(`Failed to list spaces: ${errorData?.message || response.statusText}`)
        }

        const data = (await response.json()) as NotionPaginatedResponse<NotionDatabase>

        return data.results.map((db): SpaceData => {
          const description = db.description?.[0]?.plain_text
          const icon = db.icon?.emoji || db.icon?.external?.url
          return {
            id: db.id,
            name: extractTitle(db),
            ...(description !== undefined && { description }),
            ...(icon !== undefined && { icon }),
            url: db.url,
          }
        })
      } catch (error) {
        throw new Error(
          `Failed to list Notion spaces: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        )
      }
    },

    async getSpace(spaceId: string): Promise<SpaceData | null> {
      try {
        // Get database as "space"
        const response = await notionRequest(`/databases/${spaceId}`)

        if (response.status === 404) {
          return null
        }

        if (!response.ok) {
          const errorData = (await response
            .json()
            .catch(() => ({}))) as Partial<NotionErrorResponse>
          throw new Error(`Failed to get space: ${errorData?.message || response.statusText}`)
        }

        const db = (await response.json()) as NotionDatabase
        const description = db.description?.[0]?.plain_text
        const icon = db.icon?.emoji || db.icon?.external?.url

        return {
          id: db.id,
          name: extractTitle(db),
          ...(description !== undefined && { description }),
          ...(icon !== undefined && { icon }),
          url: db.url,
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('404')) {
          return null
        }
        throw new Error(
          `Failed to get Notion space: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    },
  }
}

/**
 * Notion provider definition
 */
export const notionProvider = defineProvider(notionInfo, async (config) =>
  createNotionProvider(config)
)
