/**
 * Site Types
 *
 * Types for web presence and content:
 * Site, Blog, Directory.
 *
 * @module site
 */

import type {
  Input,
  Output,
  Action,
  BaseEvent,
  EventHandler,
  CRUDResource,
  ListParams,
  PaginatedResult,
} from '@/core/rpc'

// =============================================================================
// Site - Web Presence
// =============================================================================

/**
 * Site type.
 */
export type SiteType = 'marketing' | 'docs' | 'commerce' | 'community' | 'portal' | 'landing' | 'custom'

/**
 * Site status.
 */
export type SiteStatus = 'development' | 'staging' | 'live' | 'maintenance' | 'archived'

/**
 * Web presence for content and commerce.
 *
 * Sites represent web properties that serve content,
 * enable commerce, or provide community features.
 *
 * @example
 * ```ts
 * const marketingSite: Site = {
 *   id: 'site_marketing',
 *   name: 'Acme Marketing Site',
 *   type: 'marketing',
 *   status: 'live',
 *   url: 'https://acme.example.com',
 *   domain: 'acme.example.com',
 *   description: 'Main marketing website',
 *   seo: {
 *     title: 'Acme - The Best Widgets',
 *     description: 'Leading provider of widgets',
 *     keywords: ['widgets', 'quality', 'innovation']
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Site {
  /** Unique identifier */
  id: string

  /** Site name */
  name: string

  /** Site type */
  type: SiteType

  /** Current status */
  status: SiteStatus

  /** Human-readable description */
  description?: string

  /** Primary URL */
  url?: string

  /** Primary domain */
  domain?: string

  /** Additional domains */
  aliases?: string[]

  /** SEO configuration */
  seo?: {
    title?: string
    description?: string
    keywords?: string[]
    ogImage?: string
    twitterCard?: 'summary' | 'summary_large_image'
    robots?: string
    canonical?: string
  }

  /** Analytics configuration */
  analytics?: {
    googleAnalytics?: string
    plausible?: boolean
    custom?: Record<string, unknown>
  }

  /** Navigation structure */
  navigation?: Array<{
    label: string
    href: string
    children?: Array<{ label: string; href: string }>
  }>

  /** Footer configuration */
  footer?: {
    links?: Array<{
      heading: string
      items: Array<{ label: string; href: string }>
    }>
    copyright?: string
    social?: Record<string, string>
  }

  /** Theme configuration */
  theme?: {
    primaryColor?: string
    secondaryColor?: string
    fontFamily?: string
    darkMode?: boolean
    customCss?: string
  }

  /** Features enabled */
  features?: {
    blog?: boolean
    search?: boolean
    i18n?: boolean
    comments?: boolean
    newsletter?: boolean
  }

  /** Localization */
  locales?: string[]
  defaultLocale?: string

  /** Related blog ID */
  blogId?: string

  /** Related product ID */
  productId?: string

  /** Owner business ID */
  businessId?: string

  /** Metrics */
  metrics?: {
    pageviews?: number
    visitors?: number
    bounceRate?: number
  }

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date

  /** Last published timestamp */
  publishedAt?: Date
}

export type SiteInput = Input<Site>
export type SiteOutput = Output<Site>

// =============================================================================
// Blog - Content Publication
// =============================================================================

/**
 * Blog status.
 */
export type BlogStatus = 'draft' | 'active' | 'paused' | 'archived'

/**
 * Publication for content and updates.
 *
 * Blogs manage articles, authors, and categories
 * for content marketing and communication.
 *
 * @example
 * ```ts
 * const engineeringBlog: Blog = {
 *   id: 'blog_engineering',
 *   name: 'Engineering Blog',
 *   status: 'active',
 *   url: 'https://blog.acme.example.com',
 *   description: 'Technical articles from our engineering team',
 *   categories: ['Engineering', 'Product', 'Culture'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Blog {
  /** Unique identifier */
  id: string

  /** Blog name */
  name: string

  /** Current status */
  status: BlogStatus

  /** Human-readable description */
  description?: string

  /** Blog URL */
  url?: string

  /** RSS feed URL */
  feedUrl?: string

  /** Categories */
  categories?: string[]

  /** Tags */
  tags?: string[]

  /** Default author ID */
  defaultAuthorId?: string

  /** SEO configuration */
  seo?: {
    title?: string
    description?: string
    ogImage?: string
  }

  /** Comments configuration */
  comments?: {
    enabled: boolean
    moderated?: boolean
    provider?: 'native' | 'disqus' | 'giscus'
  }

  /** Newsletter integration */
  newsletter?: {
    enabled: boolean
    provider?: string
    listId?: string
  }

  /** Metrics */
  metrics?: {
    posts?: number
    views?: number
    subscribers?: number
  }

  /** Related site ID */
  siteId?: string

  /** Owner business ID */
  businessId?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BlogInput = Input<Blog>
export type BlogOutput = Output<Blog>

// =============================================================================
// Post - Blog Article
// =============================================================================

/**
 * Post status.
 */
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'archived'

/**
 * Blog post/article.
 */
export interface Post {
  /** Unique identifier */
  id: string

  /** Blog ID */
  blogId: string

  /** Post title */
  title: string

  /** URL slug */
  slug: string

  /** Current status */
  status: PostStatus

  /** Post excerpt/summary */
  excerpt?: string

  /** Post content (markdown/html) */
  content: string

  /** Content format */
  contentFormat?: 'markdown' | 'html' | 'mdx'

  /** Featured image */
  featuredImage?: string

  /** Author ID */
  authorId: string

  /** Co-author IDs */
  coAuthorIds?: string[]

  /** Category */
  category?: string

  /** Tags */
  tags?: string[]

  /** SEO overrides */
  seo?: {
    title?: string
    description?: string
    ogImage?: string
    canonical?: string
  }

  /** Reading time (minutes) */
  readingTime?: number

  /** Word count */
  wordCount?: number

  /** Scheduled publish date */
  scheduledAt?: Date

  /** Published date */
  publishedAt?: Date

  /** View count */
  views?: number

  /** Likes/reactions */
  likes?: number

  /** Comment count */
  comments?: number

  /** Related post IDs */
  relatedPosts?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PostInput = Input<Post>
export type PostOutput = Output<Post>

// =============================================================================
// Directory - Curated Collection
// =============================================================================

/**
 * Directory type.
 */
export type DirectoryType = 'resources' | 'tools' | 'people' | 'companies' | 'jobs' | 'events' | 'custom'

/**
 * Directory status.
 */
export type DirectoryStatus = 'draft' | 'active' | 'paused' | 'archived'

/**
 * Directory category.
 */
export interface DirectoryCategory {
  id: string
  name: string
  slug: string
  description?: string
  icon?: string
  parentId?: string
  itemCount?: number
}

/**
 * Curated collection of resources.
 *
 * Directories organize and showcase items
 * in categories with search and filtering.
 *
 * @example
 * ```ts
 * const toolsDirectory: Directory = {
 *   id: 'dir_tools',
 *   name: 'Developer Tools',
 *   type: 'tools',
 *   status: 'active',
 *   url: 'https://tools.acme.example.com',
 *   description: 'Curated list of developer tools',
 *   categories: [
 *     { id: 'ide', name: 'IDEs', slug: 'ide' },
 *     { id: 'testing', name: 'Testing', slug: 'testing' }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Directory {
  /** Unique identifier */
  id: string

  /** Directory name */
  name: string

  /** Directory type */
  type: DirectoryType

  /** Current status */
  status: DirectoryStatus

  /** Human-readable description */
  description?: string

  /** Directory URL */
  url?: string

  /** Categories */
  categories?: DirectoryCategory[]

  /** Filter options */
  filters?: Array<{
    name: string
    type: 'select' | 'multi-select' | 'range' | 'boolean'
    options?: string[]
  }>

  /** Sort options */
  sortOptions?: Array<{
    label: string
    value: string
  }>

  /** Submission settings */
  submissions?: {
    enabled: boolean
    moderated?: boolean
    requireAuth?: boolean
    fields?: Array<{
      name: string
      type: string
      required?: boolean
    }>
  }

  /** Featuring/promotion */
  featured?: string[]

  /** SEO configuration */
  seo?: {
    title?: string
    description?: string
    ogImage?: string
  }

  /** Metrics */
  metrics?: {
    items?: number
    views?: number
    submissions?: number
  }

  /** Related site ID */
  siteId?: string

  /** Owner business ID */
  businessId?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DirectoryInput = Input<Directory>
export type DirectoryOutput = Output<Directory>

// =============================================================================
// Directory Item
// =============================================================================

/**
 * Directory item status.
 */
export type DirectoryItemStatus = 'pending' | 'approved' | 'rejected' | 'featured' | 'archived'

/**
 * Item in a directory.
 */
export interface DirectoryItem {
  /** Unique identifier */
  id: string

  /** Directory ID */
  directoryId: string

  /** Item name */
  name: string

  /** URL slug */
  slug: string

  /** Current status */
  status: DirectoryItemStatus

  /** Description */
  description?: string

  /** Website URL */
  url?: string

  /** Logo/image */
  image?: string

  /** Category ID */
  categoryId?: string

  /** Tags */
  tags?: string[]

  /** Custom attributes */
  attributes?: Record<string, unknown>

  /** Pricing info */
  pricing?: {
    type: 'free' | 'paid' | 'freemium' | 'open-source'
    startingPrice?: number
  }

  /** Submitter ID */
  submitterId?: string

  /** View count */
  views?: number

  /** Click count (to URL) */
  clicks?: number

  /** Upvotes */
  upvotes?: number

  /** Featured until */
  featuredUntil?: Date

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date

  /** Approved timestamp */
  approvedAt?: Date
}

export type DirectoryItemInput = Input<DirectoryItem>
export type DirectoryItemOutput = Output<DirectoryItem>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface SiteActions extends CRUDResource<Site, SiteInput> {
  /** Publish site */
  publish: Action<{ id: string }, Site>

  /** Unpublish site */
  unpublish: Action<{ id: string }, Site>

  /** Enter maintenance mode */
  enterMaintenance: Action<{ id: string; message?: string }, Site>

  /** Exit maintenance mode */
  exitMaintenance: Action<{ id: string }, Site>

  /** Add domain alias */
  addAlias: Action<{ id: string; domain: string }, Site>

  /** Remove domain alias */
  removeAlias: Action<{ id: string; domain: string }, Site>

  /** Verify domain */
  verifyDomain: Action<{ id: string; domain: string }, { verified: boolean; records?: unknown[] }>

  /** Get analytics */
  getAnalytics: Action<{ id: string; from?: Date; to?: Date }, SiteAnalytics>

  /** Purge cache */
  purgeCache: Action<{ id: string; paths?: string[] }, void>
}

export interface BlogActions extends CRUDResource<Blog, BlogInput> {
  /** Get posts */
  getPosts: Action<{ id: string } & ListParams, PaginatedResult<Post>>

  /** Get authors */
  getAuthors: Action<{ id: string }, BlogAuthor[]>

  /** Add author */
  addAuthor: Action<{ id: string; authorId: string; role?: string }, BlogAuthor>

  /** Remove author */
  removeAuthor: Action<{ id: string; authorId: string }, void>

  /** Get categories */
  getCategories: Action<{ id: string }, string[]>

  /** Add category */
  addCategory: Action<{ id: string; category: string }, Blog>

  /** Remove category */
  removeCategory: Action<{ id: string; category: string }, Blog>

  /** Get analytics */
  getAnalytics: Action<{ id: string; from?: Date; to?: Date }, BlogAnalytics>

  /** Import posts */
  import: Action<{ id: string; source: string; data: unknown }, { imported: number }>
}

export interface PostActions extends CRUDResource<Post, PostInput> {
  /** Publish post */
  publish: Action<{ id: string }, Post>

  /** Unpublish post */
  unpublish: Action<{ id: string }, Post>

  /** Schedule post */
  schedule: Action<{ id: string; publishAt: Date }, Post>

  /** Archive post */
  archive: Action<{ id: string }, Post>

  /** Duplicate post */
  duplicate: Action<{ id: string }, Post>

  /** Get comments */
  getComments: Action<{ id: string } & ListParams, PaginatedResult<PostComment>>

  /** Add comment */
  addComment: Action<{ postId: string; authorId: string; content: string; parentId?: string }, PostComment>

  /** Like post */
  like: Action<{ id: string; userId: string }, Post>

  /** Unlike post */
  unlike: Action<{ id: string; userId: string }, Post>
}

export interface DirectoryActions extends CRUDResource<Directory, DirectoryInput> {
  /** Get items */
  getItems: Action<{ id: string } & ListParams & { categoryId?: string; tags?: string[] }, PaginatedResult<DirectoryItem>>

  /** Get featured items */
  getFeatured: Action<{ id: string }, DirectoryItem[]>

  /** Add category */
  addCategory: Action<{ id: string; category: DirectoryCategory }, Directory>

  /** Update category */
  updateCategory: Action<{ id: string; categoryId: string; category: Partial<DirectoryCategory> }, Directory>

  /** Remove category */
  removeCategory: Action<{ id: string; categoryId: string }, Directory>

  /** Get submissions */
  getSubmissions: Action<{ id: string } & ListParams, PaginatedResult<DirectoryItem>>

  /** Get analytics */
  getAnalytics: Action<{ id: string; from?: Date; to?: Date }, DirectoryAnalytics>
}

export interface DirectoryItemActions extends CRUDResource<DirectoryItem, DirectoryItemInput> {
  /** Submit item */
  submit: Action<{ directoryId: string; item: DirectoryItemInput }, DirectoryItem>

  /** Approve item */
  approve: Action<{ id: string }, DirectoryItem>

  /** Reject item */
  reject: Action<{ id: string; reason: string }, DirectoryItem>

  /** Feature item */
  feature: Action<{ id: string; until?: Date }, DirectoryItem>

  /** Unfeature item */
  unfeature: Action<{ id: string }, DirectoryItem>

  /** Archive item */
  archive: Action<{ id: string }, DirectoryItem>

  /** Upvote item */
  upvote: Action<{ id: string; userId: string }, DirectoryItem>

  /** Remove upvote */
  removeUpvote: Action<{ id: string; userId: string }, DirectoryItem>

  /** Record click */
  recordClick: Action<{ id: string }, void>
}

// =============================================================================
// Supporting Types
// =============================================================================

export interface SiteAnalytics {
  siteId: string
  period: { from: Date; to: Date }
  pageviews: number
  visitors: number
  uniqueVisitors: number
  bounceRate: number
  avgSessionDuration: number
  topPages: Array<{ path: string; views: number }>
  topReferrers: Array<{ referrer: string; visits: number }>
  byCountry: Record<string, number>
  byDevice: Record<string, number>
  byBrowser: Record<string, number>
}

export interface BlogAuthor {
  id: string
  name: string
  email?: string
  bio?: string
  avatar?: string
  role?: 'admin' | 'editor' | 'author' | 'contributor'
  postCount?: number
  social?: Record<string, string>
}

export interface BlogAnalytics {
  blogId: string
  period: { from: Date; to: Date }
  posts: number
  views: number
  subscribers: number
  avgReadTime: number
  topPosts: Array<{ postId: string; title: string; views: number }>
  byCategory: Record<string, number>
  growth: {
    views: number
    subscribers: number
  }
}

export interface PostComment {
  id: string
  postId: string
  authorId: string
  authorName?: string
  authorAvatar?: string
  content: string
  parentId?: string
  status: 'pending' | 'approved' | 'spam' | 'deleted'
  likes?: number
  createdAt: Date
  updatedAt: Date
}

export interface DirectoryAnalytics {
  directoryId: string
  period: { from: Date; to: Date }
  items: number
  views: number
  clicks: number
  submissions: number
  approvalRate: number
  topItems: Array<{ itemId: string; name: string; views: number }>
  byCategory: Record<string, number>
}

// =============================================================================
// Events
// =============================================================================

export interface SiteEvents {
  created: BaseEvent<'site.created', Site>
  updated: BaseEvent<'site.updated', Site>
  deleted: BaseEvent<'site.deleted', { id: string }>
  published: BaseEvent<'site.published', Site>
  unpublished: BaseEvent<'site.unpublished', { id: string }>
  maintenance_started: BaseEvent<'site.maintenance_started', { id: string; message?: string }>
  maintenance_ended: BaseEvent<'site.maintenance_ended', { id: string }>
  domain_added: BaseEvent<'site.domain_added', { siteId: string; domain: string }>
  domain_removed: BaseEvent<'site.domain_removed', { siteId: string; domain: string }>
  domain_verified: BaseEvent<'site.domain_verified', { siteId: string; domain: string }>
}

export interface BlogEvents {
  created: BaseEvent<'blog.created', Blog>
  updated: BaseEvent<'blog.updated', Blog>
  deleted: BaseEvent<'blog.deleted', { id: string }>
  author_added: BaseEvent<'blog.author_added', { blogId: string; authorId: string }>
  author_removed: BaseEvent<'blog.author_removed', { blogId: string; authorId: string }>
  category_added: BaseEvent<'blog.category_added', { blogId: string; category: string }>
  category_removed: BaseEvent<'blog.category_removed', { blogId: string; category: string }>
}

export interface PostEvents {
  created: BaseEvent<'post.created', Post>
  updated: BaseEvent<'post.updated', Post>
  deleted: BaseEvent<'post.deleted', { id: string }>
  published: BaseEvent<'post.published', Post>
  unpublished: BaseEvent<'post.unpublished', { id: string }>
  scheduled: BaseEvent<'post.scheduled', { postId: string; publishAt: Date }>
  archived: BaseEvent<'post.archived', { id: string }>
  commented: BaseEvent<'post.commented', PostComment>
  liked: BaseEvent<'post.liked', { postId: string; userId: string }>
  unliked: BaseEvent<'post.unliked', { postId: string; userId: string }>
}

export interface DirectoryEvents {
  created: BaseEvent<'directory.created', Directory>
  updated: BaseEvent<'directory.updated', Directory>
  deleted: BaseEvent<'directory.deleted', { id: string }>
  category_added: BaseEvent<'directory.category_added', { directoryId: string; category: DirectoryCategory }>
  category_removed: BaseEvent<'directory.category_removed', { directoryId: string; categoryId: string }>
}

export interface DirectoryItemEvents {
  created: BaseEvent<'directory_item.created', DirectoryItem>
  updated: BaseEvent<'directory_item.updated', DirectoryItem>
  deleted: BaseEvent<'directory_item.deleted', { id: string }>
  submitted: BaseEvent<'directory_item.submitted', DirectoryItem>
  approved: BaseEvent<'directory_item.approved', DirectoryItem>
  rejected: BaseEvent<'directory_item.rejected', { itemId: string; reason: string }>
  featured: BaseEvent<'directory_item.featured', { itemId: string; until?: Date }>
  unfeatured: BaseEvent<'directory_item.unfeatured', { itemId: string }>
  upvoted: BaseEvent<'directory_item.upvoted', { itemId: string; userId: string }>
  clicked: BaseEvent<'directory_item.clicked', { itemId: string }>
}

// =============================================================================
// Resources (Actions + Events)
// =============================================================================

export interface SiteResource extends SiteActions {
  on: <K extends keyof SiteEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SiteEvents[K], TProxy>
  ) => () => void
}

export interface BlogResource extends BlogActions {
  on: <K extends keyof BlogEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<BlogEvents[K], TProxy>
  ) => () => void
}

export interface PostResource extends PostActions {
  on: <K extends keyof PostEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PostEvents[K], TProxy>
  ) => () => void
}

export interface DirectoryResource extends DirectoryActions {
  on: <K extends keyof DirectoryEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DirectoryEvents[K], TProxy>
  ) => () => void
}

export interface DirectoryItemResource extends DirectoryItemActions {
  on: <K extends keyof DirectoryItemEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DirectoryItemEvents[K], TProxy>
  ) => () => void
}
