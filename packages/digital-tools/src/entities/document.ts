/**
 * Document Entity Types (Nouns)
 *
 * Semantic type definitions for word processing documents that support
 * Google Docs, Microsoft Word/DOCX, and Markdown/MDX formats.
 * Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// Document
// =============================================================================

/**
 * Document entity
 *
 * Represents a word processing document for creating and editing text content.
 * Supports Google Docs, Microsoft Word/DOCX, and Markdown/MDX formats.
 */
export const Document: Noun = {
  singular: 'document',
  plural: 'documents',
  description: 'A word processing document for creating and editing text content',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Document title',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Document description or summary',
    },

    // Content
    content: {
      type: 'string',
      description: 'Document content in native format',
    },
    format: {
      type: 'string',
      description: 'Document format: docx, gdoc, markdown, mdx, html, plain',
      examples: ['docx', 'gdoc', 'markdown', 'mdx', 'html', 'plain'],
    },
    wordCount: {
      type: 'number',
      optional: true,
      description: 'Total word count',
    },
    characterCount: {
      type: 'number',
      optional: true,
      description: 'Total character count',
    },
    pageCount: {
      type: 'number',
      optional: true,
      description: 'Number of pages',
    },

    // Status and workflow
    status: {
      type: 'string',
      description: 'Document status: draft, in-review, approved, published, archived',
      examples: ['draft', 'in-review', 'approved', 'published', 'archived'],
    },
    visibility: {
      type: 'string',
      description: 'Visibility: private, internal, public',
      examples: ['private', 'internal', 'public'],
    },

    // Versioning
    version: {
      type: 'string',
      optional: true,
      description: 'Current version number',
    },
    versionNumber: {
      type: 'number',
      optional: true,
      description: 'Numeric version counter',
    },
    majorVersion: {
      type: 'number',
      optional: true,
      description: 'Major version number',
    },
    minorVersion: {
      type: 'number',
      optional: true,
      description: 'Minor version number',
    },

    // Styling and formatting
    pageSize: {
      type: 'string',
      optional: true,
      description: 'Page size: letter, a4, legal, custom',
      examples: ['letter', 'a4', 'legal', 'custom'],
    },
    pageOrientation: {
      type: 'string',
      optional: true,
      description: 'Page orientation: portrait, landscape',
      examples: ['portrait', 'landscape'],
    },
    margins: {
      type: 'json',
      optional: true,
      description: 'Page margins configuration',
    },
    defaultFont: {
      type: 'string',
      optional: true,
      description: 'Default font family',
    },
    defaultFontSize: {
      type: 'number',
      optional: true,
      description: 'Default font size in points',
    },
    lineSpacing: {
      type: 'number',
      optional: true,
      description: 'Line spacing multiplier',
    },
    theme: {
      type: 'json',
      optional: true,
      description: 'Document theme and styling configuration',
    },

    // Collaboration
    allowComments: {
      type: 'boolean',
      optional: true,
      description: 'Whether comments are enabled',
    },
    allowSuggestions: {
      type: 'boolean',
      optional: true,
      description: 'Whether suggestions/tracked changes are enabled',
    },
    shareMode: {
      type: 'string',
      optional: true,
      description: 'Sharing mode: view, comment, edit',
      examples: ['view', 'comment', 'edit'],
    },

    // Protection
    protected: {
      type: 'boolean',
      optional: true,
      description: 'Whether document is protected from editing',
    },
    password: {
      type: 'string',
      optional: true,
      description: 'Password for protected documents',
    },
    readOnly: {
      type: 'boolean',
      optional: true,
      description: 'Whether document is read-only',
    },
    downloadable: {
      type: 'boolean',
      optional: true,
      description: 'Whether document can be downloaded',
    },
    copyable: {
      type: 'boolean',
      optional: true,
      description: 'Whether content can be copied',
    },
    printable: {
      type: 'boolean',
      optional: true,
      description: 'Whether document can be printed',
    },

    // Templates
    isTemplate: {
      type: 'boolean',
      optional: true,
      description: 'Whether this document is a template',
    },
    templateId: {
      type: 'string',
      optional: true,
      description: 'ID of template this was created from',
    },

    // Integration
    externalId: {
      type: 'string',
      optional: true,
      description: 'External system ID (Google Docs ID, OneDrive ID, etc.)',
    },
    externalUrl: {
      type: 'url',
      optional: true,
      description: 'URL in external system',
    },
    syncEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether sync with external system is enabled',
    },
    lastSyncedAt: {
      type: 'datetime',
      optional: true,
      description: 'Last sync timestamp',
    },

    // Metadata
    language: {
      type: 'string',
      optional: true,
      description: 'Document language code',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorizing the document',
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Document category',
    },
    folder: {
      type: 'string',
      optional: true,
      description: 'Folder or workspace path',
    },
    customMetadata: {
      type: 'json',
      optional: true,
      description: 'Custom metadata fields',
    },

    // Analytics
    viewCount: {
      type: 'number',
      optional: true,
      description: 'Number of views',
    },
    downloadCount: {
      type: 'number',
      optional: true,
      description: 'Number of downloads',
    },
    lastViewedAt: {
      type: 'datetime',
      optional: true,
      description: 'Last view timestamp',
    },
    lastEditedAt: {
      type: 'datetime',
      optional: true,
      description: 'Last edit timestamp',
    },

    // Publishing
    publishedAt: {
      type: 'datetime',
      optional: true,
      description: 'Publication timestamp',
    },
    publishedUrl: {
      type: 'url',
      optional: true,
      description: 'Published document URL',
    },
    expiresAt: {
      type: 'datetime',
      optional: true,
      description: 'Document expiration timestamp',
    },
  },

  relationships: {
    owner: {
      type: 'Contact',
      description: 'Document owner',
    },
    creator: {
      type: 'Contact',
      description: 'User who created the document',
    },
    lastEditor: {
      type: 'Contact',
      required: false,
      description: 'User who last edited the document',
    },
    collaborators: {
      type: 'DocumentCollaborator[]',
      backref: 'document',
      description: 'Users with access to the document',
    },
    versions: {
      type: 'DocumentVersion[]',
      backref: 'document',
      description: 'Version history',
    },
    comments: {
      type: 'DocumentComment[]',
      backref: 'document',
      description: 'Comments and suggestions',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'Attached files',
    },
  },

  actions: [
    'create',
    'open',
    'edit',
    'save',
    'saveAs',
    'duplicate',
    'rename',
    'delete',
    'restore',
    'export',
    'download',
    'print',
    'share',
    'unshare',
    'publish',
    'unpublish',
    'archive',
    'unarchive',
    'move',
    'copy',
    'lock',
    'unlock',
    'protect',
    'unprotect',
    'makeTemplate',
    'createFromTemplate',
    'compare',
    'merge',
    'split',
    'convert',
    'translate',
    'spellCheck',
    'findAndReplace',
    'formatDocument',
    'insertImage',
    'insertTable',
    'insertLink',
    'addPageBreak',
    'addComment',
    'acceptSuggestion',
    'rejectSuggestion',
  ],

  events: [
    'created',
    'opened',
    'edited',
    'saved',
    'renamed',
    'deleted',
    'restored',
    'exported',
    'downloaded',
    'printed',
    'shared',
    'unshared',
    'published',
    'unpublished',
    'archived',
    'unarchived',
    'moved',
    'copied',
    'locked',
    'unlocked',
    'protected',
    'unprotected',
    'converted',
    'translated',
    'commentAdded',
    'commentResolved',
    'suggestionAccepted',
    'suggestionRejected',
    'collaboratorAdded',
    'collaboratorRemoved',
    'permissionChanged',
    'versionCreated',
    'versionRestored',
    'synced',
    'viewed',
  ],
}

// =============================================================================
// DocumentVersion
// =============================================================================

/**
 * DocumentVersion entity
 *
 * Represents a version in the document's history with content snapshot.
 */
export const DocumentVersion: Noun = {
  singular: 'document version',
  plural: 'document versions',
  description: 'A version snapshot in document history',

  properties: {
    // Identity
    versionNumber: {
      type: 'number',
      description: 'Sequential version number',
    },
    label: {
      type: 'string',
      optional: true,
      description: 'Version label or tag',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Version description or change notes',
    },

    // Content
    content: {
      type: 'string',
      description: 'Document content at this version',
    },
    contentDiff: {
      type: 'string',
      optional: true,
      description: 'Diff from previous version',
    },
    wordCount: {
      type: 'number',
      optional: true,
      description: 'Word count at this version',
    },
    characterCount: {
      type: 'number',
      optional: true,
      description: 'Character count at this version',
    },

    // Change tracking
    changeType: {
      type: 'string',
      optional: true,
      description: 'Type of change: edit, format, insert, delete, move',
      examples: ['edit', 'format', 'insert', 'delete', 'move', 'restructure'],
    },
    changedSections: {
      type: 'json',
      optional: true,
      description: 'Sections that were changed',
    },
    addedWords: {
      type: 'number',
      optional: true,
      description: 'Number of words added',
    },
    deletedWords: {
      type: 'number',
      optional: true,
      description: 'Number of words deleted',
    },

    // Versioning
    isMajorVersion: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a major version',
    },
    isAutoSave: {
      type: 'boolean',
      optional: true,
      description: 'Whether this was an auto-saved version',
    },
    isPinned: {
      type: 'boolean',
      optional: true,
      description: 'Whether this version is pinned',
    },

    // Metadata
    size: {
      type: 'number',
      optional: true,
      description: 'Version size in bytes',
    },
    checksum: {
      type: 'string',
      optional: true,
      description: 'Content checksum for verification',
    },
  },

  relationships: {
    document: {
      type: 'Document',
      backref: 'versions',
      description: 'Parent document',
    },
    author: {
      type: 'Contact',
      description: 'User who created this version',
    },
    previousVersion: {
      type: 'DocumentVersion',
      required: false,
      description: 'Previous version in history',
    },
  },

  actions: [
    'create',
    'view',
    'compare',
    'restore',
    'download',
    'delete',
    'pin',
    'unpin',
    'label',
    'addNote',
  ],

  events: [
    'created',
    'viewed',
    'compared',
    'restored',
    'downloaded',
    'deleted',
    'pinned',
    'unpinned',
    'labeled',
  ],
}

// =============================================================================
// DocumentComment
// =============================================================================

/**
 * DocumentComment entity
 *
 * Represents a comment or suggestion on a document.
 */
export const DocumentComment: Noun = {
  singular: 'document comment',
  plural: 'document comments',
  description: 'A comment or suggestion on a document',

  properties: {
    // Content
    text: {
      type: 'string',
      description: 'Comment text',
    },
    quotedText: {
      type: 'string',
      optional: true,
      description: 'Text being commented on',
    },

    // Type
    type: {
      type: 'string',
      description: 'Comment type: comment, suggestion, edit, note',
      examples: ['comment', 'suggestion', 'edit', 'note', 'question'],
    },
    severity: {
      type: 'string',
      optional: true,
      description: 'Comment severity for editorial workflows',
      examples: ['info', 'suggestion', 'warning', 'required'],
    },

    // Location
    anchor: {
      type: 'json',
      optional: true,
      description: 'Position anchor in document (character offset, paragraph, etc.)',
    },
    range: {
      type: 'json',
      optional: true,
      description: 'Text range this comment applies to',
    },
    page: {
      type: 'number',
      optional: true,
      description: 'Page number',
    },

    // Status
    status: {
      type: 'string',
      description: 'Comment status: open, resolved, accepted, rejected',
      examples: ['open', 'resolved', 'accepted', 'rejected', 'wont-fix'],
    },
    resolved: {
      type: 'boolean',
      description: 'Whether comment is resolved',
    },

    // Suggestions
    suggestedChange: {
      type: 'string',
      optional: true,
      description: 'Suggested text change',
    },
    originalText: {
      type: 'string',
      optional: true,
      description: 'Original text before suggestion',
    },

    // Threading
    isReply: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a reply to another comment',
    },
    replyCount: {
      type: 'number',
      optional: true,
      description: 'Number of replies',
    },

    // Resolution
    resolvedAt: {
      type: 'datetime',
      optional: true,
      description: 'When comment was resolved',
    },
    resolution: {
      type: 'string',
      optional: true,
      description: 'Resolution notes',
    },

    // Metadata
    mentions: {
      type: 'string',
      array: true,
      optional: true,
      description: 'User IDs mentioned in comment',
    },
    attachments: {
      type: 'json',
      optional: true,
      description: 'Attached files or images',
    },
  },

  relationships: {
    document: {
      type: 'Document',
      backref: 'comments',
      description: 'Parent document',
    },
    author: {
      type: 'Contact',
      description: 'Comment author',
    },
    parentComment: {
      type: 'DocumentComment',
      required: false,
      description: 'Parent comment if this is a reply',
    },
    replies: {
      type: 'DocumentComment[]',
      backref: 'parentComment',
      description: 'Reply comments',
    },
    resolver: {
      type: 'Contact',
      required: false,
      description: 'User who resolved the comment',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'reply',
    'resolve',
    'reopen',
    'accept',
    'reject',
    'mention',
    'attach',
    'react',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'replied',
    'resolved',
    'reopened',
    'accepted',
    'rejected',
    'mentioned',
    'reacted',
  ],
}

// =============================================================================
// DocumentCollaborator
// =============================================================================

/**
 * DocumentCollaborator entity
 *
 * Represents a user with access to a document and their permissions.
 */
export const DocumentCollaborator: Noun = {
  singular: 'document collaborator',
  plural: 'document collaborators',
  description: 'A user with access permissions to a document',

  properties: {
    // Permissions
    role: {
      type: 'string',
      description: 'Access role: owner, editor, commenter, viewer',
      examples: ['owner', 'editor', 'commenter', 'viewer', 'reviewer'],
    },
    canEdit: {
      type: 'boolean',
      description: 'Whether user can edit content',
    },
    canComment: {
      type: 'boolean',
      description: 'Whether user can add comments',
    },
    canShare: {
      type: 'boolean',
      optional: true,
      description: 'Whether user can share with others',
    },
    canDownload: {
      type: 'boolean',
      optional: true,
      description: 'Whether user can download',
    },
    canPrint: {
      type: 'boolean',
      optional: true,
      description: 'Whether user can print',
    },
    canDelete: {
      type: 'boolean',
      optional: true,
      description: 'Whether user can delete document',
    },

    // Access control
    accessType: {
      type: 'string',
      description: 'Access type: direct, inherited, link, public',
      examples: ['direct', 'inherited', 'link', 'public'],
    },
    inviteStatus: {
      type: 'string',
      optional: true,
      description: 'Invitation status: pending, accepted, declined',
      examples: ['pending', 'accepted', 'declined'],
    },

    // Expiration
    expiresAt: {
      type: 'datetime',
      optional: true,
      description: 'When access expires',
    },
    isTemporary: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is temporary access',
    },

    // Activity
    lastAccessedAt: {
      type: 'datetime',
      optional: true,
      description: 'Last access timestamp',
    },
    accessCount: {
      type: 'number',
      optional: true,
      description: 'Number of times accessed',
    },
    editCount: {
      type: 'number',
      optional: true,
      description: 'Number of edits made',
    },
    commentCount: {
      type: 'number',
      optional: true,
      description: 'Number of comments made',
    },

    // Notifications
    notifyOnEdit: {
      type: 'boolean',
      optional: true,
      description: 'Whether to notify on edits',
    },
    notifyOnComment: {
      type: 'boolean',
      optional: true,
      description: 'Whether to notify on comments',
    },
    notifyOnShare: {
      type: 'boolean',
      optional: true,
      description: 'Whether to notify on new shares',
    },

    // Metadata
    inviteMessage: {
      type: 'string',
      optional: true,
      description: 'Message included with invitation',
    },
    customPermissions: {
      type: 'json',
      optional: true,
      description: 'Additional custom permissions',
    },
  },

  relationships: {
    document: {
      type: 'Document',
      backref: 'collaborators',
      description: 'Document being shared',
    },
    user: {
      type: 'Contact',
      description: 'User with access',
    },
    inviter: {
      type: 'Contact',
      required: false,
      description: 'User who shared the document',
    },
  },

  actions: [
    'invite',
    'accept',
    'decline',
    'revoke',
    'updatePermissions',
    'makeOwner',
    'promote',
    'demote',
    'notify',
    'resendInvite',
    'setExpiration',
  ],

  events: [
    'invited',
    'accepted',
    'declined',
    'revoked',
    'permissionsUpdated',
    'ownerChanged',
    'promoted',
    'demoted',
    'expired',
    'accessed',
    'edited',
    'commented',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All document entity types
 */
export const DocumentEntities = {
  Document,
  DocumentVersion,
  DocumentComment,
  DocumentCollaborator,
}

/**
 * Entity categories for organization
 */
export const DocumentCategories = {
  documents: ['Document', 'DocumentVersion', 'DocumentComment', 'DocumentCollaborator'],
} as const
