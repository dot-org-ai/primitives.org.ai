/**
 * E-Signature Entity Types (Nouns)
 *
 * Semantic type definitions for electronic signature workflows compatible with
 * DocuSign, DocuSeal, and other e-signature platforms. Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// SignatureDocument
// =============================================================================

/**
 * SignatureDocument entity
 *
 * Represents a document requiring electronic signatures from one or more signers.
 * Tracks the lifecycle from draft through completion or voiding.
 */
export const SignatureDocument: Noun = {
  singular: 'signature document',
  plural: 'signature documents',
  description: 'A document requiring electronic signatures from one or more signers',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Document title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Document description or purpose',
    },

    // Status
    status: {
      type: 'string',
      description: 'Document status: draft, sent, pending, completed, declined, voided',
      examples: ['draft', 'sent', 'pending', 'completed', 'declined', 'voided'],
    },

    // File information
    fileUrl: {
      type: 'url',
      description: 'URL to the document file',
    },
    fileName: {
      type: 'string',
      description: 'Original file name',
    },
    fileType: {
      type: 'string',
      description: 'File MIME type',
      examples: ['application/pdf', 'application/msword', 'image/png'],
    },
    fileSize: {
      type: 'number',
      description: 'File size in bytes',
    },

    // Dates
    createdAt: {
      type: 'datetime',
      description: 'When the document was created',
    },
    sentAt: {
      type: 'datetime',
      optional: true,
      description: 'When the document was sent to signers',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'When all signatures were completed',
    },
    expiresAt: {
      type: 'datetime',
      optional: true,
      description: 'When the signature request expires',
    },

    // Email communication
    subject: {
      type: 'string',
      optional: true,
      description: 'Email subject line for signature requests',
    },
    message: {
      type: 'string',
      optional: true,
      description: 'Email message or instructions for signers',
    },

    // Settings
    requireAllSigners: {
      type: 'boolean',
      optional: true,
      description: 'Whether all signers must complete or just one',
    },
    allowDecline: {
      type: 'boolean',
      optional: true,
      description: 'Whether signers can decline to sign',
    },
    allowReassign: {
      type: 'boolean',
      optional: true,
      description: 'Whether signers can reassign to someone else',
    },
    enableReminders: {
      type: 'boolean',
      optional: true,
      description: 'Whether to send automatic reminders',
    },
    reminderFrequency: {
      type: 'number',
      optional: true,
      description: 'Reminder frequency in days',
    },

    // Security
    requireAuthentication: {
      type: 'boolean',
      optional: true,
      description: 'Whether signers must authenticate',
    },
    requireAccessCode: {
      type: 'boolean',
      optional: true,
      description: 'Whether an access code is required',
    },
    accessCode: {
      type: 'string',
      optional: true,
      description: 'Access code for viewing/signing',
    },

    // Completion
    completedFileUrl: {
      type: 'url',
      optional: true,
      description: 'URL to the signed/completed document',
    },
    certificateUrl: {
      type: 'url',
      optional: true,
      description: 'URL to completion certificate',
    },

    // Metadata
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorizing the document',
    },
    folder: {
      type: 'string',
      optional: true,
      description: 'Folder or workspace the document belongs to',
    },
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional document metadata',
    },
  },

  relationships: {
    requests: {
      type: 'SignatureRequest[]',
      backref: 'document',
      description: 'Signature requests for this document',
    },
    fields: {
      type: 'SignatureField[]',
      backref: 'document',
      description: 'Signature and input fields in the document',
    },
    auditTrail: {
      type: 'AuditTrail[]',
      backref: 'document',
      description: 'Audit log entries for this document',
    },
    owner: {
      type: 'Contact',
      description: 'Owner who created the document',
    },
    template: {
      type: 'SignatureTemplate',
      required: false,
      description: 'Template used to create this document',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'send',
    'resend',
    'void',
    'download',
    'downloadCertificate',
    'addSigner',
    'removeSigner',
    'addField',
    'removeField',
    'duplicate',
    'preview',
    'remind',
    'archive',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'sent',
    'resent',
    'voided',
    'downloaded',
    'signerAdded',
    'signerRemoved',
    'fieldAdded',
    'fieldRemoved',
    'viewed',
    'completed',
    'declined',
    'expired',
    'reminderSent',
    'archived',
  ],
}

// =============================================================================
// SignatureRequest
// =============================================================================

/**
 * SignatureRequest entity
 *
 * Represents a request for a specific person to sign a document.
 * Tracks individual signer status and actions.
 */
export const SignatureRequest: Noun = {
  singular: 'signature request',
  plural: 'signature requests',
  description: 'A request for a specific person to sign a document',

  properties: {
    // Status
    status: {
      type: 'string',
      description: 'Request status: pending, viewed, signed, declined',
      examples: ['pending', 'viewed', 'signed', 'declined'],
    },

    // Signing order
    order: {
      type: 'number',
      optional: true,
      description: 'Signing order (1-based, null for parallel signing)',
    },

    // Dates
    sentAt: {
      type: 'datetime',
      description: 'When the request was sent',
    },
    viewedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the signer first viewed the document',
    },
    signedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the signer completed signing',
    },
    declinedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the signer declined',
    },

    // Communication
    message: {
      type: 'string',
      optional: true,
      description: 'Custom message for this specific signer',
    },

    // Decline
    declineReason: {
      type: 'string',
      optional: true,
      description: 'Reason provided for declining',
    },

    // Reassignment
    reassignedTo: {
      type: 'string',
      optional: true,
      description: 'Email address if reassigned to another person',
    },
    reassignedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the request was reassigned',
    },
    reassignReason: {
      type: 'string',
      optional: true,
      description: 'Reason for reassignment',
    },

    // Reminders
    reminderCount: {
      type: 'number',
      optional: true,
      description: 'Number of reminders sent',
    },
    lastReminderAt: {
      type: 'datetime',
      optional: true,
      description: 'When the last reminder was sent',
    },

    // Access
    accessCode: {
      type: 'string',
      optional: true,
      description: 'Access code for this specific signer',
    },
    viewToken: {
      type: 'string',
      optional: true,
      description: 'Unique token for viewing the document',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional request metadata',
    },
  },

  relationships: {
    document: {
      type: 'SignatureDocument',
      backref: 'requests',
      description: 'Document being signed',
    },
    signer: {
      type: 'Signer',
      description: 'Person who needs to sign',
    },
    signatures: {
      type: 'Signature[]',
      backref: 'request',
      description: 'Signatures created by this signer',
    },
  },

  actions: [
    'send',
    'resend',
    'remind',
    'view',
    'sign',
    'decline',
    'reassign',
    'cancel',
    'withdraw',
  ],

  events: [
    'sent',
    'resent',
    'reminded',
    'viewed',
    'signed',
    'declined',
    'reassigned',
    'cancelled',
    'withdrawn',
  ],
}

// =============================================================================
// Signer
// =============================================================================

/**
 * Signer entity
 *
 * Represents a person who needs to sign, view, or approve a document.
 * Can have different roles and authentication requirements.
 */
export const Signer: Noun = {
  singular: 'signer',
  plural: 'signers',
  description: 'A person who needs to sign, view, or approve a document',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Full name of the signer',
    },
    email: {
      type: 'string',
      description: 'Email address',
    },
    phone: {
      type: 'string',
      optional: true,
      description: 'Phone number for SMS authentication',
    },

    // Role
    role: {
      type: 'string',
      description: 'Signer role: signer, viewer, approver, editor',
      examples: ['signer', 'viewer', 'approver', 'editor'],
    },
    roleName: {
      type: 'string',
      optional: true,
      description: 'Custom role name (e.g., "Buyer", "Seller", "Witness")',
    },

    // Authentication
    authMethod: {
      type: 'string',
      description: 'Authentication method: email, sms, none, oauth',
      examples: ['email', 'sms', 'none', 'oauth'],
    },
    requireIdVerification: {
      type: 'boolean',
      optional: true,
      description: 'Whether ID verification is required',
    },

    // Status
    status: {
      type: 'string',
      description: 'Signer status: pending, active, completed, declined',
      examples: ['pending', 'active', 'completed', 'declined'],
    },

    // Notifications
    receiveEmailNotifications: {
      type: 'boolean',
      optional: true,
      description: 'Whether to receive email notifications',
    },
    receiveSmsNotifications: {
      type: 'boolean',
      optional: true,
      description: 'Whether to receive SMS notifications',
    },

    // Company
    company: {
      type: 'string',
      optional: true,
      description: 'Company or organization name',
    },
    title: {
      type: 'string',
      optional: true,
      description: 'Job title',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional signer metadata',
    },
  },

  relationships: {
    requests: {
      type: 'SignatureRequest[]',
      backref: 'signer',
      description: 'Signature requests for this signer',
    },
    contact: {
      type: 'Contact',
      required: false,
      description: 'Associated contact record',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'sendInvitation',
    'resendInvitation',
    'verify',
    'updateRole',
    'updateAuthMethod',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'invitationSent',
    'invitationResent',
    'verified',
    'roleUpdated',
    'authMethodUpdated',
  ],
}

// =============================================================================
// SignatureField
// =============================================================================

/**
 * SignatureField entity
 *
 * Represents a field in the document where a signer must provide input.
 * Includes signatures, initials, dates, text, checkboxes, and more.
 */
export const SignatureField: Noun = {
  singular: 'signature field',
  plural: 'signature fields',
  description: 'A field in the document where a signer must provide input',

  properties: {
    // Type
    type: {
      type: 'string',
      description: 'Field type: signature, initials, date, text, checkbox, radio, dropdown, image',
      examples: [
        'signature',
        'initials',
        'date',
        'text',
        'textarea',
        'checkbox',
        'radio',
        'dropdown',
        'image',
        'email',
        'phone',
        'number',
      ],
    },

    // Position
    page: {
      type: 'number',
      description: 'Page number (0-based)',
    },
    x: {
      type: 'number',
      description: 'X coordinate on the page',
    },
    y: {
      type: 'number',
      description: 'Y coordinate on the page',
    },
    width: {
      type: 'number',
      description: 'Field width',
    },
    height: {
      type: 'number',
      description: 'Field height',
    },

    // Validation
    required: {
      type: 'boolean',
      optional: true,
      description: 'Whether the field must be filled',
    },

    // Labels and help
    label: {
      type: 'string',
      optional: true,
      description: 'Field label',
    },
    placeholder: {
      type: 'string',
      optional: true,
      description: 'Placeholder text',
    },
    tooltip: {
      type: 'string',
      optional: true,
      description: 'Tooltip or help text',
    },

    // Options (for dropdown, radio)
    options: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Options for dropdown or radio fields',
    },

    // Default value
    defaultValue: {
      type: 'string',
      optional: true,
      description: 'Default or pre-filled value',
    },

    // Validation rules
    validation: {
      type: 'json',
      optional: true,
      description: 'Validation rules (regex, min/max length, format)',
    },
    minLength: {
      type: 'number',
      optional: true,
      description: 'Minimum text length',
    },
    maxLength: {
      type: 'number',
      optional: true,
      description: 'Maximum text length',
    },

    // Conditional logic
    conditionalLogic: {
      type: 'json',
      optional: true,
      description: 'Conditions for showing/hiding this field',
    },

    // Read-only
    readOnly: {
      type: 'boolean',
      optional: true,
      description: 'Whether the field is read-only',
    },

    // Group
    group: {
      type: 'string',
      optional: true,
      description: 'Field group for related fields',
    },

    // Value
    value: {
      type: 'string',
      optional: true,
      description: 'Current field value',
    },
    completedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the field was completed',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional field metadata',
    },
  },

  relationships: {
    document: {
      type: 'SignatureDocument',
      backref: 'fields',
      description: 'Document this field belongs to',
    },
    signer: {
      type: 'Signer',
      required: false,
      description: 'Signer assigned to this field (null for shared fields)',
    },
    signature: {
      type: 'Signature',
      required: false,
      backref: 'field',
      description: 'Signature data for this field',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'move',
    'resize',
    'duplicate',
    'setValue',
    'clearValue',
    'validate',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'moved',
    'resized',
    'duplicated',
    'valueSet',
    'valueCleared',
    'completed',
    'validated',
  ],
}

// =============================================================================
// Signature
// =============================================================================

/**
 * Signature entity
 *
 * Represents an actual signature or input provided by a signer.
 * Captures the signature image/data and metadata for audit trail.
 */
export const Signature: Noun = {
  singular: 'signature',
  plural: 'signatures',
  description: 'An actual signature or input provided by a signer',

  properties: {
    // Type
    type: {
      type: 'string',
      description: 'Signature type: drawn, typed, uploaded, stamp, mobile',
      examples: ['drawn', 'typed', 'uploaded', 'stamp', 'mobile'],
    },

    // Data
    imageUrl: {
      type: 'url',
      optional: true,
      description: 'URL to the signature image',
    },
    imageData: {
      type: 'string',
      optional: true,
      description: 'Base64-encoded signature image data',
    },
    textValue: {
      type: 'string',
      optional: true,
      description: 'Text value for typed signatures or text fields',
    },

    // Timestamp
    signedAt: {
      type: 'datetime',
      description: 'When the signature was created',
    },

    // Security and audit
    ipAddress: {
      type: 'string',
      optional: true,
      description: 'IP address where signature was created',
    },
    userAgent: {
      type: 'string',
      optional: true,
      description: 'Browser user agent',
    },
    device: {
      type: 'string',
      optional: true,
      description: 'Device type: desktop, mobile, tablet',
      examples: ['desktop', 'mobile', 'tablet'],
    },
    location: {
      type: 'json',
      optional: true,
      description: 'Geographic location data',
    },

    // Biometric data (for advanced security)
    biometricData: {
      type: 'json',
      optional: true,
      description: 'Biometric signature data (pressure, speed, etc.)',
    },

    // Font (for typed signatures)
    fontFamily: {
      type: 'string',
      optional: true,
      description: 'Font family for typed signatures',
    },
    fontSize: {
      type: 'number',
      optional: true,
      description: 'Font size for typed signatures',
    },

    // Validation
    validated: {
      type: 'boolean',
      optional: true,
      description: 'Whether the signature has been validated',
    },
    validatedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the signature was validated',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional signature metadata',
    },
  },

  relationships: {
    field: {
      type: 'SignatureField',
      backref: 'signature',
      description: 'Field this signature belongs to',
    },
    signer: {
      type: 'Signer',
      description: 'Person who created the signature',
    },
    request: {
      type: 'SignatureRequest',
      backref: 'signatures',
      description: 'Signature request this belongs to',
    },
  },

  actions: [
    'create',
    'validate',
    'verify',
    'export',
    'delete',
  ],

  events: [
    'created',
    'validated',
    'verified',
    'exported',
    'deleted',
  ],
}

// =============================================================================
// SignatureTemplate
// =============================================================================

/**
 * SignatureTemplate entity
 *
 * Represents a reusable template for signature documents.
 * Defines document structure, fields, and signer roles.
 */
export const SignatureTemplate: Noun = {
  singular: 'signature template',
  plural: 'signature templates',
  description: 'A reusable template for signature documents',

  properties: {
    // Identity
    name: {
      type: 'string',
      description: 'Template name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Template description',
    },

    // Document
    documentUrl: {
      type: 'url',
      optional: true,
      description: 'URL to the template document',
    },
    documentFileName: {
      type: 'string',
      optional: true,
      description: 'Template document file name',
    },

    // Fields configuration
    fields: {
      type: 'json',
      description: 'Field definitions with positions and properties',
    },

    // Roles
    roles: {
      type: 'json',
      description: 'Signer role definitions',
    },

    // Settings
    settings: {
      type: 'json',
      optional: true,
      description: 'Default template settings (reminders, expiration, etc.)',
    },

    // Usage
    useCount: {
      type: 'number',
      optional: true,
      description: 'Number of times template has been used',
    },
    lastUsedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the template was last used',
    },

    // Organization
    category: {
      type: 'string',
      optional: true,
      description: 'Template category',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorizing the template',
    },
    folder: {
      type: 'string',
      optional: true,
      description: 'Folder or workspace',
    },

    // Sharing
    shared: {
      type: 'boolean',
      optional: true,
      description: 'Whether template is shared with organization',
    },
    public: {
      type: 'boolean',
      optional: true,
      description: 'Whether template is publicly available',
    },

    // Version
    version: {
      type: 'number',
      optional: true,
      description: 'Template version number',
    },
    versionNotes: {
      type: 'string',
      optional: true,
      description: 'Notes about this version',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional template metadata',
    },
  },

  relationships: {
    documents: {
      type: 'SignatureDocument[]',
      backref: 'template',
      description: 'Documents created from this template',
    },
    owner: {
      type: 'Contact',
      description: 'Template owner',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with edit access to the template',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'duplicate',
    'use',
    'share',
    'unshare',
    'publish',
    'unpublish',
    'archive',
    'export',
    'import',
    'createVersion',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'duplicated',
    'used',
    'shared',
    'unshared',
    'published',
    'unpublished',
    'archived',
    'exported',
    'imported',
    'versionCreated',
  ],
}

// =============================================================================
// AuditTrail
// =============================================================================

/**
 * AuditTrail entity
 *
 * Represents an audit log entry for compliance and tracking.
 * Records all actions taken on signature documents.
 */
export const AuditTrail: Noun = {
  singular: 'audit trail entry',
  plural: 'audit trail entries',
  description: 'An audit log entry for tracking document actions and compliance',

  properties: {
    // Action
    action: {
      type: 'string',
      description: 'Action performed',
      examples: [
        'created',
        'sent',
        'viewed',
        'signed',
        'declined',
        'completed',
        'voided',
        'downloaded',
        'email_sent',
        'reminder_sent',
        'signer_added',
        'signer_removed',
        'field_added',
        'field_modified',
        'reassigned',
      ],
    },

    // Actor
    actor: {
      type: 'string',
      description: 'Who performed the action (name or email)',
    },
    actorRole: {
      type: 'string',
      optional: true,
      description: 'Role of the actor: owner, signer, viewer, system',
      examples: ['owner', 'signer', 'viewer', 'approver', 'system'],
    },

    // Timestamp
    timestamp: {
      type: 'datetime',
      description: 'When the action occurred',
    },

    // Location and device
    ipAddress: {
      type: 'string',
      optional: true,
      description: 'IP address where action was performed',
    },
    userAgent: {
      type: 'string',
      optional: true,
      description: 'Browser user agent',
    },
    device: {
      type: 'string',
      optional: true,
      description: 'Device type: desktop, mobile, tablet',
      examples: ['desktop', 'mobile', 'tablet'],
    },
    location: {
      type: 'json',
      optional: true,
      description: 'Geographic location data',
    },

    // Details
    details: {
      type: 'json',
      optional: true,
      description: 'Additional action details and metadata',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Human-readable action description',
    },

    // Related entities
    entityType: {
      type: 'string',
      optional: true,
      description: 'Type of entity affected: document, request, field, signature',
      examples: ['document', 'request', 'field', 'signature', 'template'],
    },
    entityId: {
      type: 'string',
      optional: true,
      description: 'ID of the affected entity',
    },

    // Security
    verified: {
      type: 'boolean',
      optional: true,
      description: 'Whether the action has been verified/validated',
    },
    hash: {
      type: 'string',
      optional: true,
      description: 'Cryptographic hash of the audit entry for tamper detection',
    },
  },

  relationships: {
    document: {
      type: 'SignatureDocument',
      backref: 'auditTrail',
      description: 'Document this audit entry relates to',
    },
  },

  actions: [
    'view',
    'export',
    'verify',
  ],

  events: [
    'created',
    'exported',
    'verified',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All signature entity types
 */
export const SignatureEntities = {
  SignatureDocument,
  SignatureRequest,
  Signer,
  SignatureField,
  Signature,
  SignatureTemplate,
  AuditTrail,
}

/**
 * Entity categories for organization
 */
export const SignatureCategories = {
  documents: ['SignatureDocument', 'SignatureTemplate'],
  workflow: ['SignatureRequest', 'Signer'],
  fields: ['SignatureField', 'Signature'],
  compliance: ['AuditTrail'],
} as const
