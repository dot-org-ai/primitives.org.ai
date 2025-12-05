/**
 * Knowledge & Wiki Entity Types (Nouns)
 *
 * Semantic type definitions for knowledge management and wiki systems
 * that can be used by both remote human workers AND AI agents. Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, Verb } from 'ai-database'

// =============================================================================
// Wiki
// =============================================================================

/**
 * WikiPage entity
 *
 * Represents a wiki page with title, content, and version history
 */
export const WikiPage: Noun = {
  singular: 'wiki page',
  plural: 'wiki pages',
  description: 'A wiki page containing collaborative documentation',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Page title',
    },
    slug: {
      type: 'string',
      description: 'URL-friendly page identifier',
    },

    // Content
    content: {
      type: 'markdown',
      description: 'Page content in markdown or wiki markup',
    },
    rawContent: {
      type: 'string',
      optional: true,
      description: 'Raw content before rendering',
    },
    summary: {
      type: 'string',
      optional: true,
      description: 'Brief summary or excerpt of the page',
    },
    format: {
      type: 'string',
      description: 'Content format: markdown, wiki, html, plaintext',
      examples: ['markdown', 'wiki', 'html', 'plaintext'],
    },

    // Hierarchy
    path: {
      type: 'string',
      description: 'Full hierarchical path (e.g., /docs/api/overview)',
    },
    level: {
      type: 'number',
      description: 'Depth level in the page hierarchy',
    },

    // Version Control
    version: {
      type: 'number',
      description: 'Current version number',
    },
    revisionCount: {
      type: 'number',
      optional: true,
      description: 'Total number of revisions',
    },

    // Metadata
    status: {
      type: 'string',
      description: 'Page status: draft, published, archived, deleted',
      examples: ['draft', 'published', 'archived', 'deleted'],
    },
    visibility: {
      type: 'string',
      description: 'Visibility level: public, private, restricted',
      examples: ['public', 'private', 'restricted'],
    },
    featured: {
      type: 'boolean',
      optional: true,
      description: 'Whether the page is featured or highlighted',
    },
    locked: {
      type: 'boolean',
      optional: true,
      description: 'Whether the page is locked from editing',
    },
    template: {
      type: 'boolean',
      optional: true,
      description: 'Whether this page is a template for creating new pages',
    },

    // Statistics
    viewCount: {
      type: 'number',
      optional: true,
      description: 'Number of times the page has been viewed',
    },
    editCount: {
      type: 'number',
      optional: true,
      description: 'Number of edits made to the page',
    },
    wordCount: {
      type: 'number',
      optional: true,
      description: 'Number of words in the page',
    },
    characterCount: {
      type: 'number',
      optional: true,
      description: 'Number of characters',
    },

    // Timestamps
    publishedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the page was first published',
    },
    lastEditedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the page was last edited',
    },
  },

  relationships: {
    space: {
      type: 'WikiSpace',
      backref: 'pages',
      description: 'The wiki space this page belongs to',
    },
    parent: {
      type: 'WikiPage',
      required: false,
      description: 'Parent page in the hierarchy',
    },
    children: {
      type: 'WikiPage[]',
      description: 'Child pages under this page',
    },
    author: {
      type: 'Contact',
      description: 'Original author of the page',
    },
    lastEditor: {
      type: 'Contact',
      description: 'Person who last edited the page',
    },
    contributors: {
      type: 'Contact[]',
      description: 'All people who have edited this page',
    },
    revisions: {
      type: 'WikiRevision[]',
      backref: 'page',
      description: 'Version history of the page',
    },
    comments: {
      type: 'Comment[]',
      backref: 'page',
      description: 'Comments on the page',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'Files attached to the page',
    },
    tags: {
      type: 'Tag[]',
      description: 'Tags categorizing this page',
    },
    linkedPages: {
      type: 'WikiPage[]',
      description: 'Pages that this page links to',
    },
    backlinks: {
      type: 'WikiPage[]',
      description: 'Pages that link to this page',
    },
  },

  actions: [
    'create',
    'edit',
    'save',
    'publish',
    'unpublish',
    'archive',
    'restore',
    'delete',
    'rename',
    'move',
    'duplicate',
    'lock',
    'unlock',
    'watch',
    'unwatch',
    'comment',
    'tag',
    'untag',
    'export',
    'print',
    'share',
    'revert',
    'compare',
  ],

  events: [
    'created',
    'edited',
    'saved',
    'published',
    'unpublished',
    'archived',
    'restored',
    'deleted',
    'renamed',
    'moved',
    'duplicated',
    'locked',
    'unlocked',
    'viewed',
    'commented',
    'tagged',
    'exported',
    'shared',
    'reverted',
  ],
}

/**
 * WikiSpace entity
 *
 * Represents a wiki space or namespace containing related pages
 */
export const WikiSpace: Noun = {
  singular: 'wiki space',
  plural: 'wiki spaces',
  description: 'A container or namespace for organizing related wiki pages',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Space name',
    },
    key: {
      type: 'string',
      description: 'Unique space key or identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Space description',
    },

    // Appearance
    icon: {
      type: 'url',
      optional: true,
      description: 'Space icon or logo URL',
    },
    color: {
      type: 'string',
      optional: true,
      description: 'Space color theme',
    },
    homepage: {
      type: 'string',
      optional: true,
      description: 'Path to the space homepage',
    },

    // Configuration
    visibility: {
      type: 'string',
      description: 'Space visibility: public, private, organization',
      examples: ['public', 'private', 'organization'],
    },
    status: {
      type: 'string',
      description: 'Space status: active, archived, deleted',
      examples: ['active', 'archived', 'deleted'],
    },
    template: {
      type: 'string',
      optional: true,
      description: 'Space template used',
    },

    // Settings
    allowAnonymousAccess: {
      type: 'boolean',
      optional: true,
      description: 'Whether anonymous users can view the space',
    },
    allowComments: {
      type: 'boolean',
      optional: true,
      description: 'Whether comments are enabled',
    },
    requireApproval: {
      type: 'boolean',
      optional: true,
      description: 'Whether edits require approval',
    },

    // Statistics
    pageCount: {
      type: 'number',
      optional: true,
      description: 'Number of pages in the space',
    },
    memberCount: {
      type: 'number',
      optional: true,
      description: 'Number of members with access',
    },
  },

  relationships: {
    pages: {
      type: 'WikiPage[]',
      backref: 'space',
      description: 'Pages in this space',
    },
    owner: {
      type: 'Contact',
      description: 'Space owner',
    },
    admins: {
      type: 'Contact[]',
      description: 'Space administrators',
    },
    members: {
      type: 'Contact[]',
      description: 'Members with access to the space',
    },
    categories: {
      type: 'Category[]',
      description: 'Categories for organizing pages',
    },
  },

  actions: [
    'create',
    'configure',
    'archive',
    'restore',
    'delete',
    'invite',
    'removeMember',
    'setPermissions',
    'export',
  ],

  events: [
    'created',
    'configured',
    'archived',
    'restored',
    'deleted',
    'memberJoined',
    'memberLeft',
    'memberRemoved',
    'exported',
  ],
}

/**
 * WikiRevision entity
 *
 * Represents a specific revision in a wiki page's history
 */
export const WikiRevision: Noun = {
  singular: 'wiki revision',
  plural: 'wiki revisions',
  description: 'A specific version in a wiki page history',

  properties: {
    version: {
      type: 'number',
      description: 'Version number',
    },
    content: {
      type: 'markdown',
      description: 'Page content at this revision',
    },
    comment: {
      type: 'string',
      optional: true,
      description: 'Edit comment or summary of changes',
    },
    changeSize: {
      type: 'number',
      optional: true,
      description: 'Size of change in characters (positive or negative)',
    },
    isMajor: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a major revision',
    },
    isReverted: {
      type: 'boolean',
      optional: true,
      description: 'Whether this revision was later reverted',
    },
  },

  relationships: {
    page: {
      type: 'WikiPage',
      backref: 'revisions',
      description: 'Page this is a revision of',
    },
    author: {
      type: 'Contact',
      description: 'Who made this revision',
    },
    previousRevision: {
      type: 'WikiRevision',
      required: false,
      description: 'Previous revision',
    },
  },

  actions: ['view', 'restore', 'compare', 'revert', 'export'],

  events: ['created', 'viewed', 'restored', 'compared', 'reverted'],
}

// =============================================================================
// Knowledge Base
// =============================================================================

/**
 * Article entity
 *
 * Represents a knowledge base article (more structured than wiki pages)
 */
export const Article: Noun = {
  singular: 'article',
  plural: 'articles',
  description: 'A knowledge base article with structured content',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Article title',
    },
    slug: {
      type: 'string',
      description: 'URL-friendly identifier',
    },

    // Content
    content: {
      type: 'markdown',
      description: 'Article content',
    },
    excerpt: {
      type: 'string',
      optional: true,
      description: 'Short excerpt or summary',
    },
    format: {
      type: 'string',
      description: 'Content format: markdown, html, richtext',
      examples: ['markdown', 'html', 'richtext'],
    },

    // Organization
    category: {
      type: 'string',
      optional: true,
      description: 'Primary category',
    },
    section: {
      type: 'string',
      optional: true,
      description: 'Section within category',
    },
    order: {
      type: 'number',
      optional: true,
      description: 'Sort order within section or category',
    },

    // Status
    status: {
      type: 'string',
      description: 'Article status: draft, review, published, archived',
      examples: ['draft', 'review', 'published', 'archived'],
    },
    visibility: {
      type: 'string',
      description: 'Visibility: public, internal, private',
      examples: ['public', 'internal', 'private'],
    },
    featured: {
      type: 'boolean',
      optional: true,
      description: 'Whether the article is featured',
    },
    pinned: {
      type: 'boolean',
      optional: true,
      description: 'Whether the article is pinned to the top',
    },

    // Metadata
    language: {
      type: 'string',
      optional: true,
      description: 'Article language code',
    },
    locale: {
      type: 'string',
      optional: true,
      description: 'Locale for localized content',
    },

    // Quality
    reviewStatus: {
      type: 'string',
      optional: true,
      description: 'Review status: pending, approved, rejected',
      examples: ['pending', 'approved', 'rejected'],
    },
    qualityScore: {
      type: 'number',
      optional: true,
      description: 'Quality score from 0-100',
    },
    lastReviewedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the article was last reviewed',
    },

    // Engagement
    viewCount: {
      type: 'number',
      optional: true,
      description: 'Number of views',
    },
    helpfulCount: {
      type: 'number',
      optional: true,
      description: 'Number of helpful votes',
    },
    unhelpfulCount: {
      type: 'number',
      optional: true,
      description: 'Number of unhelpful votes',
    },

    // SEO
    metaTitle: {
      type: 'string',
      optional: true,
      description: 'SEO meta title',
    },
    metaDescription: {
      type: 'string',
      optional: true,
      description: 'SEO meta description',
    },
    keywords: {
      type: 'string',
      array: true,
      optional: true,
      description: 'SEO keywords',
    },

    // Timestamps
    publishedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the article was published',
    },
    scheduledAt: {
      type: 'datetime',
      optional: true,
      description: 'Scheduled publication time',
    },
  },

  relationships: {
    knowledgeBase: {
      type: 'KnowledgeBase',
      backref: 'articles',
      description: 'Knowledge base this article belongs to',
    },
    author: {
      type: 'Contact',
      description: 'Article author',
    },
    reviewers: {
      type: 'Contact[]',
      description: 'People who have reviewed this article',
    },
    relatedArticles: {
      type: 'Article[]',
      description: 'Related or similar articles',
    },
    tags: {
      type: 'Tag[]',
      description: 'Tags categorizing this article',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'Attached files and media',
    },
    comments: {
      type: 'Comment[]',
      backref: 'article',
      description: 'Comments and feedback',
    },
    translations: {
      type: 'Article[]',
      description: 'Translated versions of this article',
    },
  },

  actions: [
    'create',
    'edit',
    'save',
    'publish',
    'unpublish',
    'schedule',
    'review',
    'approve',
    'reject',
    'archive',
    'restore',
    'delete',
    'duplicate',
    'translate',
    'export',
    'vote',
    'report',
  ],

  events: [
    'created',
    'edited',
    'saved',
    'published',
    'unpublished',
    'scheduled',
    'reviewed',
    'approved',
    'rejected',
    'archived',
    'restored',
    'deleted',
    'duplicated',
    'viewed',
    'voted',
    'translated',
    'reported',
  ],
}

/**
 * KnowledgeBase entity
 *
 * Represents a knowledge base container
 */
export const KnowledgeBase: Noun = {
  singular: 'knowledge base',
  plural: 'knowledge bases',
  description: 'A structured collection of articles and documentation',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Knowledge base name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Knowledge base description',
    },
    slug: {
      type: 'string',
      description: 'URL-friendly identifier',
    },

    // Appearance
    logo: {
      type: 'url',
      optional: true,
      description: 'Logo URL',
    },
    icon: {
      type: 'url',
      optional: true,
      description: 'Icon URL',
    },
    theme: {
      type: 'json',
      optional: true,
      description: 'Theme configuration',
    },

    // Configuration
    visibility: {
      type: 'string',
      description: 'Visibility: public, private, organization',
      examples: ['public', 'private', 'organization'],
    },
    status: {
      type: 'string',
      description: 'Status: active, archived, maintenance',
      examples: ['active', 'archived', 'maintenance'],
    },
    language: {
      type: 'string',
      description: 'Default language code',
    },
    supportedLanguages: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Supported language codes',
    },

    // Features
    enableSearch: {
      type: 'boolean',
      optional: true,
      description: 'Whether search is enabled',
    },
    enableComments: {
      type: 'boolean',
      optional: true,
      description: 'Whether comments are enabled',
    },
    enableVoting: {
      type: 'boolean',
      optional: true,
      description: 'Whether article voting is enabled',
    },
    enableSuggestions: {
      type: 'boolean',
      optional: true,
      description: 'Whether article suggestions are enabled',
    },

    // Statistics
    articleCount: {
      type: 'number',
      optional: true,
      description: 'Number of articles',
    },
    categoryCount: {
      type: 'number',
      optional: true,
      description: 'Number of categories',
    },
    viewCount: {
      type: 'number',
      optional: true,
      description: 'Total views across all articles',
    },

    // SEO
    domain: {
      type: 'string',
      optional: true,
      description: 'Custom domain',
    },
    basePath: {
      type: 'string',
      optional: true,
      description: 'Base URL path',
    },
  },

  relationships: {
    articles: {
      type: 'Article[]',
      backref: 'knowledgeBase',
      description: 'Articles in this knowledge base',
    },
    categories: {
      type: 'Category[]',
      description: 'Categories for organizing articles',
    },
    owner: {
      type: 'Contact',
      description: 'Knowledge base owner',
    },
    editors: {
      type: 'Contact[]',
      description: 'People with edit permissions',
    },
    searchIndex: {
      type: 'SearchIndex',
      required: false,
      description: 'Search index for this knowledge base',
    },
  },

  actions: [
    'create',
    'configure',
    'archive',
    'restore',
    'delete',
    'addEditor',
    'removeEditor',
    'export',
    'import',
    'rebuildIndex',
  ],

  events: [
    'created',
    'configured',
    'archived',
    'restored',
    'deleted',
    'editorAdded',
    'editorRemoved',
    'exported',
    'imported',
    'indexRebuilt',
  ],
}

// =============================================================================
// Glossary
// =============================================================================

/**
 * Glossary entity
 *
 * Represents a glossary or dictionary of terms
 */
export const Glossary: Noun = {
  singular: 'glossary',
  plural: 'glossaries',
  description: 'A collection of term definitions and explanations',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Glossary name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Glossary description',
    },
    slug: {
      type: 'string',
      description: 'URL-friendly identifier',
    },

    // Configuration
    visibility: {
      type: 'string',
      description: 'Visibility: public, private, organization',
      examples: ['public', 'private', 'organization'],
    },
    language: {
      type: 'string',
      description: 'Primary language code',
    },
    domain: {
      type: 'string',
      optional: true,
      description: 'Subject domain or field (e.g., medical, legal, technical)',
    },

    // Organization
    sortOrder: {
      type: 'string',
      description: 'Sort order: alphabetical, custom, date',
      examples: ['alphabetical', 'custom', 'date'],
    },
    groupBy: {
      type: 'string',
      optional: true,
      description: 'Grouping method: letter, category, none',
      examples: ['letter', 'category', 'none'],
    },

    // Features
    allowAbbreviations: {
      type: 'boolean',
      optional: true,
      description: 'Whether abbreviations are supported',
    },
    allowSynonyms: {
      type: 'boolean',
      optional: true,
      description: 'Whether synonyms are supported',
    },
    enableSearch: {
      type: 'boolean',
      optional: true,
      description: 'Whether search is enabled',
    },

    // Statistics
    termCount: {
      type: 'number',
      optional: true,
      description: 'Number of terms',
    },
  },

  relationships: {
    terms: {
      type: 'GlossaryTerm[]',
      backref: 'glossary',
      description: 'Terms in this glossary',
    },
    owner: {
      type: 'Contact',
      description: 'Glossary owner',
    },
    contributors: {
      type: 'Contact[]',
      description: 'People who have contributed terms',
    },
    categories: {
      type: 'Category[]',
      description: 'Categories for organizing terms',
    },
  },

  actions: [
    'create',
    'configure',
    'addTerm',
    'removeTerm',
    'export',
    'import',
    'merge',
    'archive',
    'delete',
  ],

  events: [
    'created',
    'configured',
    'termAdded',
    'termRemoved',
    'exported',
    'imported',
    'merged',
    'archived',
    'deleted',
  ],
}

/**
 * GlossaryTerm entity
 *
 * Represents a term definition in a glossary
 */
export const GlossaryTerm: Noun = {
  singular: 'glossary term',
  plural: 'glossary terms',
  description: 'A term and its definition in a glossary',

  properties: {
    // Term
    term: {
      type: 'string',
      description: 'The term being defined',
    },
    pronunciation: {
      type: 'string',
      optional: true,
      description: 'Phonetic pronunciation',
    },
    partOfSpeech: {
      type: 'string',
      optional: true,
      description: 'Part of speech: noun, verb, adjective, etc.',
      examples: ['noun', 'verb', 'adjective', 'adverb', 'acronym', 'abbreviation'],
    },

    // Definition
    definition: {
      type: 'markdown',
      description: 'Term definition',
    },
    shortDefinition: {
      type: 'string',
      optional: true,
      description: 'Brief one-line definition',
    },
    etymology: {
      type: 'string',
      optional: true,
      description: 'Origin and history of the term',
    },

    // Variations
    pluralForm: {
      type: 'string',
      optional: true,
      description: 'Plural form of the term',
    },
    abbreviation: {
      type: 'string',
      optional: true,
      description: 'Abbreviated form',
    },
    acronymFor: {
      type: 'string',
      optional: true,
      description: 'What the acronym stands for',
    },
    synonyms: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Synonymous terms',
    },
    antonyms: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Opposite terms',
    },

    // Context
    category: {
      type: 'string',
      optional: true,
      description: 'Category or subject area',
    },
    examples: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Usage examples',
    },
    usageNotes: {
      type: 'string',
      optional: true,
      description: 'Notes on proper usage',
    },

    // Status
    status: {
      type: 'string',
      description: 'Status: draft, published, deprecated',
      examples: ['draft', 'published', 'deprecated'],
    },
    visibility: {
      type: 'string',
      description: 'Visibility: public, private',
      examples: ['public', 'private'],
    },

    // Metadata
    language: {
      type: 'string',
      description: 'Language code',
    },
    sortKey: {
      type: 'string',
      optional: true,
      description: 'Custom sort key',
    },
  },

  relationships: {
    glossary: {
      type: 'Glossary',
      backref: 'terms',
      description: 'Glossary this term belongs to',
    },
    author: {
      type: 'Contact',
      description: 'Who created this term',
    },
    relatedTerms: {
      type: 'GlossaryTerm[]',
      description: 'Related terms',
    },
    seeAlso: {
      type: 'GlossaryTerm[]',
      description: 'Cross-reference terms',
    },
    translations: {
      type: 'GlossaryTerm[]',
      description: 'Translations in other languages',
    },
    references: {
      type: 'Article[]',
      description: 'Articles or pages that reference this term',
    },
  },

  actions: [
    'create',
    'edit',
    'publish',
    'unpublish',
    'deprecate',
    'delete',
    'translate',
    'link',
    'unlink',
  ],

  events: [
    'created',
    'edited',
    'published',
    'unpublished',
    'deprecated',
    'deleted',
    'translated',
    'linked',
    'viewed',
  ],
}

// =============================================================================
// Search
// =============================================================================

/**
 * SearchIndex entity
 *
 * Represents a search index for content
 */
export const SearchIndex: Noun = {
  singular: 'search index',
  plural: 'search indexes',
  description: 'A search index for finding content quickly',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Index name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Index description',
    },

    // Configuration
    type: {
      type: 'string',
      description: 'Index type: full-text, semantic, vector, hybrid',
      examples: ['full-text', 'semantic', 'vector', 'hybrid'],
    },
    language: {
      type: 'string',
      description: 'Primary language for text analysis',
    },
    supportedLanguages: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Supported languages',
    },

    // Schema
    fields: {
      type: 'json',
      description: 'Indexed field configurations',
    },
    boosts: {
      type: 'json',
      optional: true,
      description: 'Field boost weights for relevance scoring',
    },

    // Status
    status: {
      type: 'string',
      description: 'Index status: building, ready, updating, error',
      examples: ['building', 'ready', 'updating', 'error'],
    },
    lastBuiltAt: {
      type: 'datetime',
      optional: true,
      description: 'When the index was last built',
    },
    lastUpdatedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the index was last updated',
    },

    // Statistics
    documentCount: {
      type: 'number',
      optional: true,
      description: 'Number of documents indexed',
    },
    size: {
      type: 'number',
      optional: true,
      description: 'Index size in bytes',
    },

    // Performance
    queryTimeMs: {
      type: 'number',
      optional: true,
      description: 'Average query time in milliseconds',
    },
    indexingTimeMs: {
      type: 'number',
      optional: true,
      description: 'Time taken to build the index',
    },
  },

  relationships: {
    knowledgeBase: {
      type: 'KnowledgeBase',
      required: false,
      description: 'Knowledge base this index belongs to',
    },
    wikiSpace: {
      type: 'WikiSpace',
      required: false,
      description: 'Wiki space this index belongs to',
    },
  },

  actions: [
    'create',
    'build',
    'update',
    'rebuild',
    'optimize',
    'clear',
    'delete',
    'search',
    'suggest',
  ],

  events: [
    'created',
    'built',
    'updated',
    'rebuilt',
    'optimized',
    'cleared',
    'deleted',
    'searched',
  ],
}

// =============================================================================
// Supporting Entities
// =============================================================================

/**
 * Tag entity
 *
 * Represents a tag for categorizing content
 */
export const Tag: Noun = {
  singular: 'tag',
  plural: 'tags',
  description: 'A label for categorizing and organizing content',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Tag name',
    },
    slug: {
      type: 'string',
      description: 'URL-friendly identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Tag description',
    },

    // Appearance
    color: {
      type: 'string',
      optional: true,
      description: 'Tag color (hex code)',
    },
    icon: {
      type: 'string',
      optional: true,
      description: 'Tag icon or emoji',
    },

    // Organization
    category: {
      type: 'string',
      optional: true,
      description: 'Tag category for grouping',
    },
    group: {
      type: 'string',
      optional: true,
      description: 'Tag group',
    },

    // Metadata
    type: {
      type: 'string',
      optional: true,
      description: 'Tag type: general, system, custom',
      examples: ['general', 'system', 'custom'],
    },
    visibility: {
      type: 'string',
      description: 'Visibility: public, private',
      examples: ['public', 'private'],
    },

    // Statistics
    usageCount: {
      type: 'number',
      optional: true,
      description: 'Number of items tagged with this',
    },
  },

  relationships: {
    parent: {
      type: 'Tag',
      required: false,
      description: 'Parent tag for hierarchical tags',
    },
    children: {
      type: 'Tag[]',
      description: 'Child tags',
    },
    synonyms: {
      type: 'Tag[]',
      description: 'Synonym tags',
    },
    relatedTags: {
      type: 'Tag[]',
      description: 'Related tags',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'merge',
    'split',
    'rename',
    'link',
    'unlink',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'merged',
    'split',
    'renamed',
    'applied',
    'removed',
  ],
}

/**
 * Category entity
 *
 * Represents a category for organizing content
 */
export const Category: Noun = {
  singular: 'category',
  plural: 'categories',
  description: 'A category for organizing related content',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Category name',
    },
    slug: {
      type: 'string',
      description: 'URL-friendly identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Category description',
    },

    // Hierarchy
    path: {
      type: 'string',
      description: 'Full hierarchical path',
    },
    level: {
      type: 'number',
      description: 'Depth level in hierarchy',
    },
    order: {
      type: 'number',
      optional: true,
      description: 'Sort order',
    },

    // Appearance
    icon: {
      type: 'string',
      optional: true,
      description: 'Category icon or emoji',
    },
    color: {
      type: 'string',
      optional: true,
      description: 'Category color',
    },

    // Configuration
    visibility: {
      type: 'string',
      description: 'Visibility: public, private',
      examples: ['public', 'private'],
    },
    status: {
      type: 'string',
      description: 'Status: active, archived',
      examples: ['active', 'archived'],
    },

    // Statistics
    itemCount: {
      type: 'number',
      optional: true,
      description: 'Number of items in this category',
    },
  },

  relationships: {
    parent: {
      type: 'Category',
      required: false,
      description: 'Parent category',
    },
    children: {
      type: 'Category[]',
      description: 'Child categories',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'move',
    'merge',
    'archive',
    'restore',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'moved',
    'merged',
    'archived',
    'restored',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All knowledge & wiki entity types
 */
export const KnowledgeEntities = {
  // Wiki
  WikiPage,
  WikiSpace,
  WikiRevision,

  // Knowledge Base
  Article,
  KnowledgeBase,

  // Glossary
  Glossary,
  GlossaryTerm,

  // Search
  SearchIndex,

  // Supporting
  Tag,
  Category,
}

/**
 * Entity categories for organization
 */
export const KnowledgeCategories = {
  wiki: ['WikiPage', 'WikiSpace', 'WikiRevision'],
  knowledgeBase: ['Article', 'KnowledgeBase'],
  glossary: ['Glossary', 'GlossaryTerm'],
  search: ['SearchIndex'],
  organization: ['Tag', 'Category'],
} as const
