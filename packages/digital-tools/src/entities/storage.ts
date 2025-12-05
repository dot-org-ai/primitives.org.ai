/**
 * Storage & Files Entity Types (Nouns)
 *
 * Semantic type definitions for file storage and cloud drive tools.
 * Each entity defines properties, relationships, actions, and events
 * for working with files, folders, drives, sharing, versioning, and backups.
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, Verb } from 'ai-database'

// =============================================================================
// File
// =============================================================================

/**
 * File entity
 *
 * Represents a file with metadata, permissions, and version control
 */
export const File: Noun = {
  singular: 'file',
  plural: 'files',
  description: 'A file stored in a filesystem or cloud drive',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'File name including extension',
    },
    path: {
      type: 'string',
      description: 'Full path to the file',
    },
    extension: {
      type: 'string',
      optional: true,
      description: 'File extension (e.g., pdf, jpg, docx)',
    },

    // Content
    size: {
      type: 'number',
      description: 'File size in bytes',
    },
    mimeType: {
      type: 'string',
      description: 'MIME type of the file',
    },
    hash: {
      type: 'string',
      optional: true,
      description: 'Content hash (MD5, SHA256, etc.) for integrity verification',
    },
    encoding: {
      type: 'string',
      optional: true,
      description: 'Character encoding for text files',
    },

    // Metadata
    type: {
      type: 'string',
      description: 'File type category: document, image, video, audio, archive, code, other',
      examples: ['document', 'image', 'video', 'audio', 'archive', 'code', 'other'],
    },
    description: {
      type: 'string',
      optional: true,
      description: 'File description or notes',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags or labels for organization',
    },

    // Permissions
    permissions: {
      type: 'json',
      optional: true,
      description: 'File permissions (read, write, execute)',
    },
    visibility: {
      type: 'string',
      optional: true,
      description: 'Visibility level: private, shared, public',
      examples: ['private', 'shared', 'public'],
    },
    owner: {
      type: 'string',
      optional: true,
      description: 'File owner user ID',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'File status: active, archived, deleted, quarantined',
      examples: ['active', 'archived', 'deleted', 'quarantined'],
    },
    starred: {
      type: 'boolean',
      optional: true,
      description: 'Whether the file is starred/favorited',
    },
    locked: {
      type: 'boolean',
      optional: true,
      description: 'Whether the file is locked from editing',
    },

    // URLs
    url: {
      type: 'url',
      optional: true,
      description: 'URL to access/download the file',
    },
    thumbnailUrl: {
      type: 'url',
      optional: true,
      description: 'URL to a thumbnail preview',
    },
    webViewUrl: {
      type: 'url',
      optional: true,
      description: 'URL to view the file in a web browser',
    },

    // Dates
    createdAt: {
      type: 'datetime',
      optional: true,
      description: 'When the file was created',
    },
    modifiedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the file was last modified',
    },
    accessedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the file was last accessed',
    },
  },

  relationships: {
    folder: {
      type: 'Folder',
      backref: 'files',
      description: 'Parent folder containing this file',
    },
    drive: {
      type: 'Drive',
      description: 'Drive where this file is stored',
    },
    versions: {
      type: 'FileVersion[]',
      backref: 'file',
      description: 'Version history of this file',
    },
    sharedLinks: {
      type: 'SharedLink[]',
      backref: 'file',
      description: 'Sharing links for this file',
    },
    owner: {
      type: 'Contact',
      description: 'Owner of the file',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with access to the file',
    },
  },

  actions: [
    'create',
    'upload',
    'download',
    'open',
    'edit',
    'save',
    'copy',
    'move',
    'rename',
    'delete',
    'restore',
    'share',
    'unshare',
    'star',
    'unstar',
    'lock',
    'unlock',
    'tag',
    'untag',
    'preview',
    'compress',
    'decompress',
    'encrypt',
    'decrypt',
  ],

  events: [
    'created',
    'uploaded',
    'downloaded',
    'opened',
    'edited',
    'saved',
    'copied',
    'moved',
    'renamed',
    'deleted',
    'restored',
    'shared',
    'unshared',
    'starred',
    'unstarred',
    'locked',
    'unlocked',
    'tagged',
    'untagged',
    'previewed',
    'compressed',
    'decompressed',
    'encrypted',
    'decrypted',
    'virusScanned',
    'quarantined',
  ],
}

// =============================================================================
// Folder
// =============================================================================

/**
 * Folder/Directory entity
 *
 * Represents a folder or directory that can contain files and subfolders
 */
export const Folder: Noun = {
  singular: 'folder',
  plural: 'folders',
  description: 'A folder or directory containing files and subfolders',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Folder name',
    },
    path: {
      type: 'string',
      description: 'Full path to the folder',
    },

    // Metadata
    description: {
      type: 'string',
      optional: true,
      description: 'Folder description or purpose',
    },
    color: {
      type: 'string',
      optional: true,
      description: 'Folder color for visual organization',
    },
    icon: {
      type: 'string',
      optional: true,
      description: 'Folder icon identifier',
    },

    // Content stats
    fileCount: {
      type: 'number',
      optional: true,
      description: 'Number of files directly in this folder',
    },
    folderCount: {
      type: 'number',
      optional: true,
      description: 'Number of subfolders',
    },
    totalSize: {
      type: 'number',
      optional: true,
      description: 'Total size of all contents in bytes',
    },

    // Permissions
    permissions: {
      type: 'json',
      optional: true,
      description: 'Folder permissions',
    },
    visibility: {
      type: 'string',
      optional: true,
      description: 'Visibility level: private, shared, public',
      examples: ['private', 'shared', 'public'],
    },
    owner: {
      type: 'string',
      optional: true,
      description: 'Folder owner user ID',
    },

    // Status
    starred: {
      type: 'boolean',
      optional: true,
      description: 'Whether the folder is starred/favorited',
    },
    pinned: {
      type: 'boolean',
      optional: true,
      description: 'Whether the folder is pinned for quick access',
    },
    archived: {
      type: 'boolean',
      optional: true,
      description: 'Whether the folder is archived',
    },

    // URLs
    url: {
      type: 'url',
      optional: true,
      description: 'URL to access the folder',
    },
    webViewUrl: {
      type: 'url',
      optional: true,
      description: 'URL to view the folder in a web browser',
    },

    // Dates
    createdAt: {
      type: 'datetime',
      optional: true,
      description: 'When the folder was created',
    },
    modifiedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the folder contents were last modified',
    },
  },

  relationships: {
    parentFolder: {
      type: 'Folder',
      backref: 'subfolders',
      required: false,
      description: 'Parent folder (null for root)',
    },
    subfolders: {
      type: 'Folder[]',
      backref: 'parentFolder',
      description: 'Subfolders within this folder',
    },
    files: {
      type: 'File[]',
      backref: 'folder',
      description: 'Files within this folder',
    },
    drive: {
      type: 'Drive',
      description: 'Drive where this folder is stored',
    },
    sharedLinks: {
      type: 'SharedLink[]',
      backref: 'folder',
      description: 'Sharing links for this folder',
    },
    owner: {
      type: 'Contact',
      description: 'Owner of the folder',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with access to the folder',
    },
  },

  actions: [
    'create',
    'rename',
    'move',
    'copy',
    'delete',
    'restore',
    'share',
    'unshare',
    'star',
    'unstar',
    'pin',
    'unpin',
    'archive',
    'unarchive',
    'compress',
    'sync',
  ],

  events: [
    'created',
    'renamed',
    'moved',
    'copied',
    'deleted',
    'restored',
    'shared',
    'unshared',
    'starred',
    'unstarred',
    'pinned',
    'unpinned',
    'archived',
    'unarchived',
    'compressed',
    'synced',
  ],
}

// =============================================================================
// Drive
// =============================================================================

/**
 * Cloud drive entity
 *
 * Represents a cloud storage drive (Google Drive, Dropbox, OneDrive, etc.)
 */
export const Drive: Noun = {
  singular: 'drive',
  plural: 'drives',
  description: 'A cloud storage drive or filesystem root',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Drive name',
    },
    type: {
      type: 'string',
      description: 'Drive type: personal, shared, team, external, system',
      examples: ['personal', 'shared', 'team', 'external', 'system'],
    },
    provider: {
      type: 'string',
      optional: true,
      description: 'Cloud provider: google-drive, dropbox, onedrive, box, s3',
      examples: ['google-drive', 'dropbox', 'onedrive', 'box', 's3', 'local'],
    },

    // Metadata
    description: {
      type: 'string',
      optional: true,
      description: 'Drive description or purpose',
    },
    icon: {
      type: 'url',
      optional: true,
      description: 'Drive icon URL',
    },

    // Capacity
    totalCapacity: {
      type: 'number',
      optional: true,
      description: 'Total storage capacity in bytes',
    },
    usedSpace: {
      type: 'number',
      optional: true,
      description: 'Used storage space in bytes',
    },
    availableSpace: {
      type: 'number',
      optional: true,
      description: 'Available storage space in bytes',
    },

    // Permissions
    owner: {
      type: 'string',
      optional: true,
      description: 'Drive owner user ID',
    },
    permissions: {
      type: 'json',
      optional: true,
      description: 'Drive-level permissions',
    },

    // Features
    features: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Supported features: versioning, sharing, sync, encryption, backup',
      examples: ['versioning', 'sharing', 'sync', 'encryption', 'backup'],
    },
    versioningEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether version history is enabled',
    },
    encryptionEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether encryption is enabled',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Drive status: active, readonly, suspended, error',
      examples: ['active', 'readonly', 'suspended', 'error'],
    },
    connected: {
      type: 'boolean',
      optional: true,
      description: 'Whether the drive is currently connected/accessible',
    },

    // URLs
    url: {
      type: 'url',
      optional: true,
      description: 'URL to access the drive',
    },
    webViewUrl: {
      type: 'url',
      optional: true,
      description: 'URL to view the drive in a web browser',
    },

    // Dates
    createdAt: {
      type: 'datetime',
      optional: true,
      description: 'When the drive was created',
    },
    lastSyncedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the drive was last synced',
    },
  },

  relationships: {
    rootFolder: {
      type: 'Folder',
      description: 'Root folder of the drive',
    },
    quota: {
      type: 'StorageQuota',
      backref: 'drive',
      description: 'Storage quota for this drive',
    },
    syncs: {
      type: 'Sync[]',
      backref: 'drive',
      description: 'Sync operations for this drive',
    },
    backups: {
      type: 'Backup[]',
      backref: 'drive',
      description: 'Backups of this drive',
    },
    owner: {
      type: 'Contact',
      description: 'Owner of the drive',
    },
    members: {
      type: 'Contact[]',
      description: 'Members with access to the drive',
    },
  },

  actions: [
    'create',
    'connect',
    'disconnect',
    'sync',
    'configure',
    'delete',
    'share',
    'unshare',
    'backup',
    'restore',
    'checkQuota',
    'cleanUp',
  ],

  events: [
    'created',
    'connected',
    'disconnected',
    'synced',
    'configured',
    'deleted',
    'shared',
    'unshared',
    'backedUp',
    'restored',
    'quotaExceeded',
    'quotaWarning',
    'error',
  ],
}

// =============================================================================
// SharedLink
// =============================================================================

/**
 * Shared link entity
 *
 * Represents a sharing link with permissions and expiry
 */
export const SharedLink: Noun = {
  singular: 'shared link',
  plural: 'shared links',
  description: 'A sharing link for files or folders',

  properties: {
    // Identity
    token: {
      type: 'string',
      description: 'Unique sharing token/ID',
    },
    url: {
      type: 'url',
      description: 'Full sharing URL',
    },

    // Permissions
    permissions: {
      type: 'string',
      description: 'Link permissions: view, comment, edit',
      examples: ['view', 'comment', 'edit'],
    },
    passwordProtected: {
      type: 'boolean',
      optional: true,
      description: 'Whether the link requires a password',
    },
    password: {
      type: 'string',
      optional: true,
      description: 'Password required to access (if password protected)',
    },

    // Access control
    allowedDomains: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Email domains allowed to access (e.g., company.com)',
    },
    allowedUsers: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Specific user IDs allowed to access',
    },
    maxAccessCount: {
      type: 'number',
      optional: true,
      description: 'Maximum number of times link can be accessed',
    },
    accessCount: {
      type: 'number',
      optional: true,
      description: 'Number of times link has been accessed',
    },

    // Expiration
    expiresAt: {
      type: 'datetime',
      optional: true,
      description: 'When the link expires',
    },
    expired: {
      type: 'boolean',
      optional: true,
      description: 'Whether the link has expired',
    },

    // Status
    active: {
      type: 'boolean',
      description: 'Whether the link is active',
    },
    revoked: {
      type: 'boolean',
      optional: true,
      description: 'Whether the link has been revoked',
    },

    // Features
    allowDownload: {
      type: 'boolean',
      optional: true,
      description: 'Whether downloading is allowed',
    },
    notifyOnAccess: {
      type: 'boolean',
      optional: true,
      description: 'Whether to notify owner when accessed',
    },

    // Metadata
    label: {
      type: 'string',
      optional: true,
      description: 'Custom label for the link',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Description of what is being shared',
    },

    // Dates
    createdAt: {
      type: 'datetime',
      optional: true,
      description: 'When the link was created',
    },
    lastAccessedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the link was last accessed',
    },
  },

  relationships: {
    file: {
      type: 'File',
      backref: 'sharedLinks',
      required: false,
      description: 'File being shared (if sharing a file)',
    },
    folder: {
      type: 'Folder',
      backref: 'sharedLinks',
      required: false,
      description: 'Folder being shared (if sharing a folder)',
    },
    creator: {
      type: 'Contact',
      description: 'Who created the sharing link',
    },
    accessedBy: {
      type: 'Contact[]',
      description: 'Users who have accessed the link',
    },
  },

  actions: [
    'create',
    'revoke',
    'extend',
    'updatePermissions',
    'setPassword',
    'removePassword',
    'copy',
    'delete',
  ],

  events: [
    'created',
    'accessed',
    'revoked',
    'extended',
    'permissionsUpdated',
    'passwordSet',
    'passwordRemoved',
    'expired',
    'deleted',
  ],
}

// =============================================================================
// FileVersion
// =============================================================================

/**
 * File version entity
 *
 * Represents a version in a file's version history
 */
export const FileVersion: Noun = {
  singular: 'file version',
  plural: 'file versions',
  description: 'A version snapshot in a file\'s version history',

  properties: {
    // Identity
    versionNumber: {
      type: 'number',
      description: 'Version number (sequential)',
    },
    versionId: {
      type: 'string',
      optional: true,
      description: 'Unique version identifier',
    },
    label: {
      type: 'string',
      optional: true,
      description: 'Version label or tag (e.g., v1.0, final)',
    },

    // Content
    size: {
      type: 'number',
      description: 'File size at this version in bytes',
    },
    hash: {
      type: 'string',
      optional: true,
      description: 'Content hash for this version',
    },

    // Changes
    changeDescription: {
      type: 'string',
      optional: true,
      description: 'Description of changes in this version',
    },
    changeType: {
      type: 'string',
      optional: true,
      description: 'Type of change: create, modify, rename, restore',
      examples: ['create', 'modify', 'rename', 'restore'],
    },

    // Status
    current: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is the current version',
    },
    pinned: {
      type: 'boolean',
      optional: true,
      description: 'Whether this version is pinned to prevent deletion',
    },

    // Storage
    url: {
      type: 'url',
      optional: true,
      description: 'URL to download this version',
    },
    storagePath: {
      type: 'string',
      optional: true,
      description: 'Storage path for this version',
    },

    // Dates
    createdAt: {
      type: 'datetime',
      description: 'When this version was created',
    },
    expiresAt: {
      type: 'datetime',
      optional: true,
      description: 'When this version expires (if retention policy applies)',
    },
  },

  relationships: {
    file: {
      type: 'File',
      backref: 'versions',
      description: 'File this is a version of',
    },
    author: {
      type: 'Contact',
      description: 'Who created this version',
    },
    previousVersion: {
      type: 'FileVersion',
      required: false,
      description: 'Previous version in the history',
    },
  },

  actions: [
    'create',
    'restore',
    'download',
    'compare',
    'delete',
    'pin',
    'unpin',
    'label',
  ],

  events: [
    'created',
    'restored',
    'downloaded',
    'compared',
    'deleted',
    'pinned',
    'unpinned',
    'labeled',
    'expired',
  ],
}

// =============================================================================
// StorageQuota
// =============================================================================

/**
 * Storage quota entity
 *
 * Represents storage quota and usage tracking
 */
export const StorageQuota: Noun = {
  singular: 'storage quota',
  plural: 'storage quotas',
  description: 'Storage quota and usage tracking for a drive or account',

  properties: {
    // Capacity
    total: {
      type: 'number',
      description: 'Total storage quota in bytes',
    },
    used: {
      type: 'number',
      description: 'Used storage in bytes',
    },
    available: {
      type: 'number',
      description: 'Available storage in bytes',
    },
    percentUsed: {
      type: 'number',
      optional: true,
      description: 'Percentage of quota used (0-100)',
    },

    // Breakdown
    usedByFiles: {
      type: 'number',
      optional: true,
      description: 'Storage used by files in bytes',
    },
    usedByTrash: {
      type: 'number',
      optional: true,
      description: 'Storage used by trash/deleted items in bytes',
    },
    usedByVersions: {
      type: 'number',
      optional: true,
      description: 'Storage used by file versions in bytes',
    },

    // Limits
    unlimited: {
      type: 'boolean',
      optional: true,
      description: 'Whether storage is unlimited',
    },
    maxFileSize: {
      type: 'number',
      optional: true,
      description: 'Maximum individual file size in bytes',
    },

    // Thresholds
    warningThreshold: {
      type: 'number',
      optional: true,
      description: 'Percentage at which to warn (e.g., 80)',
    },
    criticalThreshold: {
      type: 'number',
      optional: true,
      description: 'Percentage at which to alert (e.g., 95)',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Quota status: normal, warning, critical, exceeded',
      examples: ['normal', 'warning', 'critical', 'exceeded'],
    },

    // Plan
    plan: {
      type: 'string',
      optional: true,
      description: 'Storage plan: free, basic, premium, business, enterprise',
      examples: ['free', 'basic', 'premium', 'business', 'enterprise'],
    },

    // Dates
    lastUpdatedAt: {
      type: 'datetime',
      optional: true,
      description: 'When quota was last calculated',
    },
    renewsAt: {
      type: 'datetime',
      optional: true,
      description: 'When quota resets (for monthly limits)',
    },
  },

  relationships: {
    drive: {
      type: 'Drive',
      backref: 'quota',
      description: 'Drive this quota applies to',
    },
    owner: {
      type: 'Contact',
      description: 'Account owner',
    },
  },

  actions: [
    'check',
    'update',
    'upgrade',
    'downgrade',
    'cleanUp',
    'emptyTrash',
    'deleteOldVersions',
  ],

  events: [
    'checked',
    'updated',
    'upgraded',
    'downgraded',
    'warningThresholdReached',
    'criticalThresholdReached',
    'exceeded',
    'cleanedUp',
  ],
}

// =============================================================================
// Sync
// =============================================================================

/**
 * Sync operation entity
 *
 * Represents a sync operation between local and cloud storage
 */
export const Sync: Noun = {
  singular: 'sync',
  plural: 'syncs',
  description: 'A synchronization operation between local and cloud storage',

  properties: {
    // Identity
    syncId: {
      type: 'string',
      description: 'Unique sync operation ID',
    },

    // Direction
    direction: {
      type: 'string',
      description: 'Sync direction: upload, download, bidirectional',
      examples: ['upload', 'download', 'bidirectional'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Sync status: pending, in-progress, completed, paused, failed, canceled',
      examples: ['pending', 'in-progress', 'completed', 'paused', 'failed', 'canceled'],
    },

    // Progress
    totalItems: {
      type: 'number',
      optional: true,
      description: 'Total number of items to sync',
    },
    syncedItems: {
      type: 'number',
      optional: true,
      description: 'Number of items synced so far',
    },
    totalBytes: {
      type: 'number',
      optional: true,
      description: 'Total bytes to sync',
    },
    syncedBytes: {
      type: 'number',
      optional: true,
      description: 'Number of bytes synced so far',
    },
    percentComplete: {
      type: 'number',
      optional: true,
      description: 'Percentage complete (0-100)',
    },

    // Paths
    sourcePath: {
      type: 'string',
      description: 'Source path (local or cloud)',
    },
    destinationPath: {
      type: 'string',
      description: 'Destination path (cloud or local)',
    },

    // Configuration
    syncType: {
      type: 'string',
      optional: true,
      description: 'Sync type: full, incremental, selective',
      examples: ['full', 'incremental', 'selective'],
    },
    conflictResolution: {
      type: 'string',
      optional: true,
      description: 'How to handle conflicts: newest, largest, manual',
      examples: ['newest', 'largest', 'manual'],
    },
    deleteOnSource: {
      type: 'boolean',
      optional: true,
      description: 'Whether to delete items from source after sync',
    },

    // Errors
    errors: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Array of sync errors encountered',
    },
    errorCount: {
      type: 'number',
      optional: true,
      description: 'Number of errors encountered',
    },

    // Performance
    transferRate: {
      type: 'number',
      optional: true,
      description: 'Current transfer rate in bytes per second',
    },
    estimatedTimeRemaining: {
      type: 'number',
      optional: true,
      description: 'Estimated time remaining in seconds',
    },

    // Dates
    startedAt: {
      type: 'datetime',
      optional: true,
      description: 'When sync started',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'When sync completed',
    },
    lastSyncAt: {
      type: 'datetime',
      optional: true,
      description: 'When last successful sync occurred',
    },
  },

  relationships: {
    drive: {
      type: 'Drive',
      backref: 'syncs',
      description: 'Drive being synced',
    },
    files: {
      type: 'File[]',
      description: 'Files involved in this sync',
    },
    folders: {
      type: 'Folder[]',
      description: 'Folders involved in this sync',
    },
  },

  actions: [
    'start',
    'pause',
    'resume',
    'cancel',
    'retry',
    'configure',
    'resolveConflict',
  ],

  events: [
    'started',
    'progressed',
    'paused',
    'resumed',
    'completed',
    'failed',
    'canceled',
    'conflictDetected',
    'conflictResolved',
  ],
}

// =============================================================================
// Backup
// =============================================================================

/**
 * Backup entity
 *
 * Represents a backup snapshot of files or drives
 */
export const Backup: Noun = {
  singular: 'backup',
  plural: 'backups',
  description: 'A backup snapshot of files or an entire drive',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Backup name or label',
    },
    backupId: {
      type: 'string',
      optional: true,
      description: 'Unique backup identifier',
    },

    // Type
    type: {
      type: 'string',
      description: 'Backup type: full, incremental, differential',
      examples: ['full', 'incremental', 'differential'],
    },
    scope: {
      type: 'string',
      description: 'Backup scope: file, folder, drive',
      examples: ['file', 'folder', 'drive'],
    },

    // Status
    status: {
      type: 'string',
      description: 'Backup status: pending, in-progress, completed, failed, expired',
      examples: ['pending', 'in-progress', 'completed', 'failed', 'expired'],
    },

    // Content
    itemCount: {
      type: 'number',
      optional: true,
      description: 'Number of items backed up',
    },
    totalSize: {
      type: 'number',
      optional: true,
      description: 'Total size of backup in bytes',
    },
    compressedSize: {
      type: 'number',
      optional: true,
      description: 'Compressed backup size in bytes',
    },
    compressed: {
      type: 'boolean',
      optional: true,
      description: 'Whether backup is compressed',
    },
    encrypted: {
      type: 'boolean',
      optional: true,
      description: 'Whether backup is encrypted',
    },

    // Storage
    storagePath: {
      type: 'string',
      optional: true,
      description: 'Path where backup is stored',
    },
    storageLocation: {
      type: 'string',
      optional: true,
      description: 'Storage location: local, cloud, external',
      examples: ['local', 'cloud', 'external'],
    },

    // Schedule
    scheduled: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a scheduled backup',
    },
    scheduleType: {
      type: 'string',
      optional: true,
      description: 'Schedule type: manual, hourly, daily, weekly, monthly',
      examples: ['manual', 'hourly', 'daily', 'weekly', 'monthly'],
    },

    // Retention
    retentionDays: {
      type: 'number',
      optional: true,
      description: 'Number of days to retain this backup',
    },
    expiresAt: {
      type: 'datetime',
      optional: true,
      description: 'When this backup expires',
    },
    keepForever: {
      type: 'boolean',
      optional: true,
      description: 'Whether to keep this backup indefinitely',
    },

    // Verification
    verified: {
      type: 'boolean',
      optional: true,
      description: 'Whether backup integrity has been verified',
    },
    verifiedAt: {
      type: 'datetime',
      optional: true,
      description: 'When backup was last verified',
    },
    checksum: {
      type: 'string',
      optional: true,
      description: 'Backup checksum for integrity verification',
    },

    // Dates
    createdAt: {
      type: 'datetime',
      description: 'When backup was created',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'When backup completed',
    },
  },

  relationships: {
    drive: {
      type: 'Drive',
      backref: 'backups',
      description: 'Drive being backed up',
    },
    files: {
      type: 'File[]',
      description: 'Files included in this backup',
    },
    folders: {
      type: 'Folder[]',
      description: 'Folders included in this backup',
    },
    creator: {
      type: 'Contact',
      description: 'Who created the backup',
    },
    parentBackup: {
      type: 'Backup',
      required: false,
      description: 'Parent backup for incremental backups',
    },
  },

  actions: [
    'create',
    'restore',
    'verify',
    'download',
    'delete',
    'schedule',
    'cancel',
    'compress',
    'encrypt',
    'export',
  ],

  events: [
    'created',
    'started',
    'progressed',
    'completed',
    'failed',
    'restored',
    'verified',
    'downloaded',
    'deleted',
    'scheduled',
    'expired',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All storage entity types
 */
export const StorageEntities = {
  File,
  Folder,
  Drive,
  SharedLink,
  FileVersion,
  StorageQuota,
  Sync,
  Backup,
}

/**
 * Storage entity categories for organization
 */
export const StorageCategories = {
  files: ['File', 'Folder', 'FileVersion'],
  drives: ['Drive', 'StorageQuota'],
  sharing: ['SharedLink'],
  operations: ['Sync', 'Backup'],
} as const
