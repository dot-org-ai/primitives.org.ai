/**
 * Forms and Survey Entity Types (Nouns)
 *
 * Semantic type definitions for forms, surveys, and quizzes that can be used by
 * both remote human workers AND AI agents. Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, Verb } from 'ai-database'

// =============================================================================
// Form
// =============================================================================

/**
 * Form entity
 *
 * Represents a customizable form for collecting structured data from users.
 * Can be used for applications, registrations, feedback, data collection, etc.
 */
export const Form: Noun = {
  singular: 'form',
  plural: 'forms',
  description: 'A customizable form for collecting structured data from users',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Form title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Form description or instructions',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly identifier',
    },

    // Status
    status: {
      type: 'string',
      description: 'Form status: draft, published, archived, closed',
      examples: ['draft', 'published', 'archived', 'closed'],
    },
    active: {
      type: 'boolean',
      description: 'Whether the form is actively accepting responses',
    },

    // Configuration
    allowMultipleResponses: {
      type: 'boolean',
      optional: true,
      description: 'Whether users can submit multiple times',
    },
    requireAuthentication: {
      type: 'boolean',
      optional: true,
      description: 'Whether users must be logged in to submit',
    },
    collectEmail: {
      type: 'boolean',
      optional: true,
      description: 'Whether to collect respondent email addresses',
    },
    shuffleFields: {
      type: 'boolean',
      optional: true,
      description: 'Whether to randomize field order',
    },

    // Submission settings
    submitButtonText: {
      type: 'string',
      optional: true,
      description: 'Custom text for submit button',
    },
    confirmationMessage: {
      type: 'string',
      optional: true,
      description: 'Message shown after successful submission',
    },
    redirectUrl: {
      type: 'url',
      optional: true,
      description: 'URL to redirect to after submission',
    },

    // Notifications
    notifyOnSubmission: {
      type: 'boolean',
      optional: true,
      description: 'Whether to send notifications on new submissions',
    },
    notificationEmails: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Email addresses to notify on submissions',
    },

    // Limits
    maxResponses: {
      type: 'number',
      optional: true,
      description: 'Maximum number of responses allowed',
    },
    responseCount: {
      type: 'number',
      optional: true,
      description: 'Current number of responses received',
    },
    closesAt: {
      type: 'datetime',
      optional: true,
      description: 'When the form stops accepting responses',
    },

    // Styling
    theme: {
      type: 'json',
      optional: true,
      description: 'Custom theme and styling configuration',
    },
    logo: {
      type: 'url',
      optional: true,
      description: 'Logo URL to display on the form',
    },

    // Integration
    webhookUrl: {
      type: 'url',
      optional: true,
      description: 'Webhook URL to POST submissions to',
    },
    integrations: {
      type: 'json',
      optional: true,
      description: 'Third-party integration configurations',
    },

    // Metadata
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorizing the form',
    },
    folder: {
      type: 'string',
      optional: true,
      description: 'Folder or workspace the form belongs to',
    },
  },

  relationships: {
    fields: {
      type: 'FormField[]',
      backref: 'form',
      description: 'Fields in this form',
    },
    responses: {
      type: 'FormResponse[]',
      backref: 'form',
      description: 'Responses submitted to this form',
    },
    owner: {
      type: 'Contact',
      description: 'Owner of the form',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with edit access to the form',
    },
  },

  actions: [
    'create',
    'edit',
    'duplicate',
    'publish',
    'unpublish',
    'archive',
    'delete',
    'addField',
    'removeField',
    'reorderFields',
    'share',
    'export',
    'import',
    'preview',
    'embed',
    'close',
    'reopen',
  ],

  events: [
    'created',
    'edited',
    'duplicated',
    'published',
    'unpublished',
    'archived',
    'deleted',
    'fieldAdded',
    'fieldRemoved',
    'fieldsReordered',
    'shared',
    'exported',
    'imported',
    'responseReceived',
    'closed',
    'reopened',
  ],
}

/**
 * FormField entity
 *
 * Represents a single field within a form with validation rules and options.
 */
export const FormField: Noun = {
  singular: 'form field',
  plural: 'form fields',
  description: 'A field within a form for collecting specific data',

  properties: {
    // Identity
    label: {
      type: 'string',
      description: 'Field label displayed to users',
    },
    name: {
      type: 'string',
      description: 'Internal field name/key for data storage',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Help text or description for the field',
    },
    placeholder: {
      type: 'string',
      optional: true,
      description: 'Placeholder text shown in the input',
    },

    // Type and configuration
    type: {
      type: 'string',
      description: 'Field type: text, textarea, email, number, phone, select, radio, checkbox, date, file, rating, etc.',
      examples: [
        'text',
        'textarea',
        'email',
        'number',
        'phone',
        'url',
        'select',
        'multiselect',
        'radio',
        'checkbox',
        'date',
        'datetime',
        'time',
        'file',
        'rating',
        'scale',
        'matrix',
        'signature',
      ],
    },
    order: {
      type: 'number',
      description: 'Display order within the form',
    },
    section: {
      type: 'string',
      optional: true,
      description: 'Section or page the field belongs to',
    },

    // Options for select/radio/checkbox fields
    options: {
      type: 'json',
      optional: true,
      description: 'Options for select, radio, or checkbox fields',
    },
    allowOther: {
      type: 'boolean',
      optional: true,
      description: 'Whether to allow "Other" option with text input',
    },

    // Validation
    required: {
      type: 'boolean',
      optional: true,
      description: 'Whether the field is required',
    },
    validation: {
      type: 'json',
      optional: true,
      description: 'Validation rules (regex, min/max, format, etc.)',
    },
    minLength: {
      type: 'number',
      optional: true,
      description: 'Minimum length for text fields',
    },
    maxLength: {
      type: 'number',
      optional: true,
      description: 'Maximum length for text fields',
    },
    minValue: {
      type: 'number',
      optional: true,
      description: 'Minimum value for number fields',
    },
    maxValue: {
      type: 'number',
      optional: true,
      description: 'Maximum value for number fields',
    },
    pattern: {
      type: 'string',
      optional: true,
      description: 'Regex pattern for validation',
    },
    errorMessage: {
      type: 'string',
      optional: true,
      description: 'Custom error message for validation failures',
    },

    // File upload specific
    acceptedFileTypes: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Accepted file types for file upload fields',
    },
    maxFileSize: {
      type: 'number',
      optional: true,
      description: 'Maximum file size in bytes',
    },
    maxFiles: {
      type: 'number',
      optional: true,
      description: 'Maximum number of files allowed',
    },

    // Conditional logic
    conditionalLogic: {
      type: 'json',
      optional: true,
      description: 'Rules for showing/hiding field based on other answers',
    },

    // Display
    width: {
      type: 'string',
      optional: true,
      description: 'Field width: full, half, third, quarter',
      examples: ['full', 'half', 'third', 'quarter'],
    },
    hidden: {
      type: 'boolean',
      optional: true,
      description: 'Whether the field is hidden',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional field configuration and metadata',
    },
  },

  relationships: {
    form: {
      type: 'Form',
      backref: 'fields',
      description: 'Parent form',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'duplicate',
    'move',
    'hide',
    'show',
    'setRequired',
    'setOptional',
    'addOption',
    'removeOption',
    'reorderOptions',
    'setValidation',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'duplicated',
    'moved',
    'hidden',
    'shown',
    'requiredChanged',
    'optionAdded',
    'optionRemoved',
    'optionsReordered',
    'validationChanged',
  ],
}

/**
 * FormResponse entity
 *
 * Represents a submission/response to a form.
 */
export const FormResponse: Noun = {
  singular: 'form response',
  plural: 'form responses',
  description: 'A submitted response to a form',

  properties: {
    // Response data
    answers: {
      type: 'json',
      description: 'Field answers as key-value pairs',
    },
    completionTime: {
      type: 'number',
      optional: true,
      description: 'Time taken to complete the form in seconds',
    },

    // Status
    status: {
      type: 'string',
      description: 'Response status: draft, completed, verified, flagged',
      examples: ['draft', 'completed', 'verified', 'flagged'],
    },
    completed: {
      type: 'boolean',
      description: 'Whether the response is fully completed',
    },

    // Respondent info
    respondentEmail: {
      type: 'string',
      optional: true,
      description: 'Email address of the respondent',
    },
    respondentName: {
      type: 'string',
      optional: true,
      description: 'Name of the respondent',
    },
    respondentId: {
      type: 'string',
      optional: true,
      description: 'ID of authenticated respondent',
    },

    // Metadata
    ipAddress: {
      type: 'string',
      optional: true,
      description: 'IP address of submission',
    },
    userAgent: {
      type: 'string',
      optional: true,
      description: 'Browser user agent string',
    },
    referrer: {
      type: 'url',
      optional: true,
      description: 'Referrer URL',
    },
    source: {
      type: 'string',
      optional: true,
      description: 'Source of the response: web, email, api, embed',
      examples: ['web', 'email', 'api', 'embed', 'mobile'],
    },
    device: {
      type: 'string',
      optional: true,
      description: 'Device type: desktop, mobile, tablet',
      examples: ['desktop', 'mobile', 'tablet'],
    },

    // Tracking
    startedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the respondent started filling the form',
    },
    submittedAt: {
      type: 'datetime',
      description: 'When the response was submitted',
    },

    // Processing
    score: {
      type: 'number',
      optional: true,
      description: 'Calculated score if applicable',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags applied to this response',
    },
    notes: {
      type: 'string',
      optional: true,
      description: 'Internal notes about the response',
    },
    reviewed: {
      type: 'boolean',
      optional: true,
      description: 'Whether the response has been reviewed',
    },
    reviewedBy: {
      type: 'string',
      optional: true,
      description: 'User who reviewed the response',
    },
    reviewedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the response was reviewed',
    },

    // Integration
    exported: {
      type: 'boolean',
      optional: true,
      description: 'Whether the response has been exported',
    },
    webhookDelivered: {
      type: 'boolean',
      optional: true,
      description: 'Whether webhook delivery succeeded',
    },
  },

  relationships: {
    form: {
      type: 'Form',
      backref: 'responses',
      description: 'Form this response belongs to',
    },
    respondent: {
      type: 'Contact',
      required: false,
      description: 'Contact record for the respondent',
    },
    attachments: {
      type: 'Attachment[]',
      description: 'Files uploaded with the response',
    },
  },

  actions: [
    'submit',
    'save',
    'edit',
    'delete',
    'review',
    'flag',
    'unflag',
    'tag',
    'untag',
    'export',
    'print',
    'addNote',
    'verify',
  ],

  events: [
    'started',
    'saved',
    'submitted',
    'edited',
    'deleted',
    'reviewed',
    'flagged',
    'unflagged',
    'tagged',
    'exported',
    'verified',
  ],
}

// =============================================================================
// Survey
// =============================================================================

/**
 * Survey entity
 *
 * Represents a survey for collecting feedback, opinions, and research data.
 * Surveys typically include conditional logic, branching, and analysis features.
 */
export const Survey: Noun = {
  singular: 'survey',
  plural: 'surveys',
  description: 'A survey for collecting feedback, opinions, and research data',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Survey title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Survey description or purpose',
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Survey category: customer satisfaction, market research, feedback, poll, etc.',
      examples: [
        'customer-satisfaction',
        'market-research',
        'employee-feedback',
        'product-feedback',
        'nps',
        'poll',
        'quiz',
      ],
    },

    // Status
    status: {
      type: 'string',
      description: 'Survey status: draft, active, paused, closed, archived',
      examples: ['draft', 'active', 'paused', 'closed', 'archived'],
    },

    // Settings
    anonymous: {
      type: 'boolean',
      optional: true,
      description: 'Whether responses are anonymous',
    },
    allowMultipleResponses: {
      type: 'boolean',
      optional: true,
      description: 'Whether users can submit multiple responses',
    },
    requireCompletion: {
      type: 'boolean',
      optional: true,
      description: 'Whether partial responses are saved',
    },
    showProgress: {
      type: 'boolean',
      optional: true,
      description: 'Whether to show progress indicator',
    },
    randomizeQuestions: {
      type: 'boolean',
      optional: true,
      description: 'Whether to randomize question order',
    },
    allowBackNavigation: {
      type: 'boolean',
      optional: true,
      description: 'Whether respondents can go back to previous questions',
    },

    // Pages/sections
    pages: {
      type: 'json',
      optional: true,
      description: 'Page/section configuration for multi-page surveys',
    },
    questionCount: {
      type: 'number',
      optional: true,
      description: 'Total number of questions',
    },

    // Logic
    branchingLogic: {
      type: 'json',
      optional: true,
      description: 'Conditional branching and skip logic rules',
    },
    quotas: {
      type: 'json',
      optional: true,
      description: 'Response quotas by segment or condition',
    },

    // Distribution
    accessMode: {
      type: 'string',
      optional: true,
      description: 'Access mode: public, private, invite-only',
      examples: ['public', 'private', 'invite-only'],
    },
    distributionChannels: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Channels where survey is distributed',
      examples: ['email', 'web', 'social', 'embed', 'sms', 'qr-code'],
    },

    // Timing
    estimatedTime: {
      type: 'number',
      optional: true,
      description: 'Estimated completion time in minutes',
    },
    opensAt: {
      type: 'datetime',
      optional: true,
      description: 'When the survey opens for responses',
    },
    closesAt: {
      type: 'datetime',
      optional: true,
      description: 'When the survey closes',
    },

    // Responses
    targetResponses: {
      type: 'number',
      optional: true,
      description: 'Target number of responses',
    },
    responseCount: {
      type: 'number',
      optional: true,
      description: 'Current number of responses',
    },
    completionRate: {
      type: 'number',
      optional: true,
      description: 'Percentage of started surveys that were completed',
    },

    // Appearance
    theme: {
      type: 'json',
      optional: true,
      description: 'Visual theme and branding',
    },
    logo: {
      type: 'url',
      optional: true,
      description: 'Logo URL',
    },
    language: {
      type: 'string',
      optional: true,
      description: 'Primary language code',
    },
    languages: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Supported languages for multi-lingual surveys',
    },

    // Incentives
    incentive: {
      type: 'json',
      optional: true,
      description: 'Incentive configuration for completion',
    },

    // Metadata
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorizing the survey',
    },
  },

  relationships: {
    questions: {
      type: 'SurveyQuestion[]',
      backref: 'survey',
      description: 'Questions in this survey',
    },
    responses: {
      type: 'SurveyResponse[]',
      backref: 'survey',
      description: 'Responses submitted to this survey',
    },
    owner: {
      type: 'Contact',
      description: 'Owner of the survey',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with edit access',
    },
  },

  actions: [
    'create',
    'edit',
    'duplicate',
    'activate',
    'pause',
    'close',
    'archive',
    'delete',
    'addQuestion',
    'removeQuestion',
    'reorderQuestions',
    'addPage',
    'removePage',
    'setBranching',
    'share',
    'distribute',
    'export',
    'analyze',
    'preview',
  ],

  events: [
    'created',
    'edited',
    'duplicated',
    'activated',
    'paused',
    'closed',
    'archived',
    'deleted',
    'questionAdded',
    'questionRemoved',
    'questionsReordered',
    'pageAdded',
    'pageRemoved',
    'branchingSet',
    'shared',
    'distributed',
    'responseReceived',
    'targetReached',
  ],
}

/**
 * SurveyQuestion entity
 *
 * Represents a single question within a survey.
 */
export const SurveyQuestion: Noun = {
  singular: 'survey question',
  plural: 'survey questions',
  description: 'A question within a survey',

  properties: {
    // Identity
    text: {
      type: 'string',
      description: 'Question text',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Additional context or instructions',
    },
    code: {
      type: 'string',
      optional: true,
      description: 'Question code for analysis',
    },

    // Type
    type: {
      type: 'string',
      description: 'Question type',
      examples: [
        'multiple-choice',
        'checkbox',
        'dropdown',
        'rating',
        'scale',
        'matrix',
        'text',
        'textarea',
        'number',
        'email',
        'date',
        'ranking',
        'slider',
        'nps',
        'likert',
      ],
    },
    subtype: {
      type: 'string',
      optional: true,
      description: 'Question subtype for specific variations',
    },

    // Order and grouping
    order: {
      type: 'number',
      description: 'Display order within the survey',
    },
    page: {
      type: 'number',
      optional: true,
      description: 'Page number for multi-page surveys',
    },
    section: {
      type: 'string',
      optional: true,
      description: 'Section identifier',
    },

    // Options
    options: {
      type: 'json',
      optional: true,
      description: 'Answer options for multiple choice, rating, etc.',
    },
    randomizeOptions: {
      type: 'boolean',
      optional: true,
      description: 'Whether to randomize option order',
    },
    allowOther: {
      type: 'boolean',
      optional: true,
      description: 'Whether to allow "Other" with text input',
    },
    allowMultiple: {
      type: 'boolean',
      optional: true,
      description: 'Whether multiple selections are allowed',
    },

    // Validation
    required: {
      type: 'boolean',
      optional: true,
      description: 'Whether the question is required',
    },
    validation: {
      type: 'json',
      optional: true,
      description: 'Validation rules',
    },
    minSelections: {
      type: 'number',
      optional: true,
      description: 'Minimum number of selections required',
    },
    maxSelections: {
      type: 'number',
      optional: true,
      description: 'Maximum number of selections allowed',
    },

    // Scale settings
    scaleMin: {
      type: 'number',
      optional: true,
      description: 'Minimum scale value',
    },
    scaleMax: {
      type: 'number',
      optional: true,
      description: 'Maximum scale value',
    },
    scaleMinLabel: {
      type: 'string',
      optional: true,
      description: 'Label for minimum scale value',
    },
    scaleMaxLabel: {
      type: 'string',
      optional: true,
      description: 'Label for maximum scale value',
    },

    // Logic
    skipLogic: {
      type: 'json',
      optional: true,
      description: 'Skip logic rules based on this answer',
    },
    displayLogic: {
      type: 'json',
      optional: true,
      description: 'Conditions for showing this question',
    },
    piping: {
      type: 'json',
      optional: true,
      description: 'Text piping configuration from other answers',
    },

    // Media
    imageUrl: {
      type: 'url',
      optional: true,
      description: 'Image to display with the question',
    },
    videoUrl: {
      type: 'url',
      optional: true,
      description: 'Video to display with the question',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional question configuration',
    },
  },

  relationships: {
    survey: {
      type: 'Survey',
      backref: 'questions',
      description: 'Parent survey',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'duplicate',
    'move',
    'setRequired',
    'setOptional',
    'addOption',
    'removeOption',
    'reorderOptions',
    'setSkipLogic',
    'setDisplayLogic',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'duplicated',
    'moved',
    'requiredChanged',
    'optionAdded',
    'optionRemoved',
    'optionsReordered',
    'skipLogicSet',
    'displayLogicSet',
  ],
}

/**
 * SurveyResponse entity
 *
 * Represents a submitted response to a survey.
 */
export const SurveyResponse: Noun = {
  singular: 'survey response',
  plural: 'survey responses',
  description: 'A submitted response to a survey',

  properties: {
    // Response data
    answers: {
      type: 'json',
      description: 'Question answers as key-value pairs',
    },
    metadata: {
      type: 'json',
      optional: true,
      description: 'Response metadata and tracking data',
    },

    // Status
    status: {
      type: 'string',
      description: 'Response status: in-progress, completed, partial, disqualified',
      examples: ['in-progress', 'completed', 'partial', 'disqualified'],
    },
    completionProgress: {
      type: 'number',
      optional: true,
      description: 'Completion percentage (0-100)',
    },

    // Timing
    startedAt: {
      type: 'datetime',
      description: 'When the respondent started the survey',
    },
    submittedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the response was submitted',
    },
    duration: {
      type: 'number',
      optional: true,
      description: 'Time taken to complete in seconds',
    },
    lastActivityAt: {
      type: 'datetime',
      optional: true,
      description: 'Last interaction timestamp',
    },

    // Respondent
    respondentEmail: {
      type: 'string',
      optional: true,
      description: 'Email address if not anonymous',
    },
    respondentName: {
      type: 'string',
      optional: true,
      description: 'Name if provided',
    },
    respondentId: {
      type: 'string',
      optional: true,
      description: 'Authenticated respondent ID',
    },
    anonymous: {
      type: 'boolean',
      description: 'Whether the response is anonymous',
    },

    // Source tracking
    source: {
      type: 'string',
      optional: true,
      description: 'Response source',
      examples: ['email', 'web', 'social', 'embed', 'sms', 'qr-code', 'api'],
    },
    channel: {
      type: 'string',
      optional: true,
      description: 'Distribution channel identifier',
    },
    campaign: {
      type: 'string',
      optional: true,
      description: 'Campaign identifier',
    },
    referrer: {
      type: 'url',
      optional: true,
      description: 'Referrer URL',
    },

    // Technical
    ipAddress: {
      type: 'string',
      optional: true,
      description: 'IP address',
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

    // Analysis
    segment: {
      type: 'string',
      optional: true,
      description: 'Respondent segment for analysis',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    quality: {
      type: 'string',
      optional: true,
      description: 'Response quality score or flag',
      examples: ['high', 'medium', 'low', 'flagged', 'spam'],
    },
    notes: {
      type: 'string',
      optional: true,
      description: 'Internal notes',
    },

    // Processing
    reviewed: {
      type: 'boolean',
      optional: true,
      description: 'Whether response has been reviewed',
    },
    exported: {
      type: 'boolean',
      optional: true,
      description: 'Whether response has been exported',
    },
  },

  relationships: {
    survey: {
      type: 'Survey',
      backref: 'responses',
      description: 'Survey this response belongs to',
    },
    respondent: {
      type: 'Contact',
      required: false,
      description: 'Contact record for the respondent',
    },
  },

  actions: [
    'start',
    'continue',
    'submit',
    'save',
    'delete',
    'review',
    'flag',
    'unflag',
    'tag',
    'untag',
    'export',
    'disqualify',
  ],

  events: [
    'started',
    'saved',
    'submitted',
    'deleted',
    'reviewed',
    'flagged',
    'unflagged',
    'tagged',
    'exported',
    'disqualified',
  ],
}

// =============================================================================
// Quiz
// =============================================================================

/**
 * Quiz entity
 *
 * Represents a quiz for testing knowledge with correct/incorrect answers and scoring.
 */
export const Quiz: Noun = {
  singular: 'quiz',
  plural: 'quizzes',
  description: 'A quiz for testing knowledge with scoring and correct answers',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Quiz title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Quiz description or instructions',
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Quiz category or subject',
    },

    // Status
    status: {
      type: 'string',
      description: 'Quiz status: draft, published, archived',
      examples: ['draft', 'published', 'archived'],
    },

    // Settings
    randomizeQuestions: {
      type: 'boolean',
      optional: true,
      description: 'Whether to randomize question order',
    },
    randomizeAnswers: {
      type: 'boolean',
      optional: true,
      description: 'Whether to randomize answer options',
    },
    showFeedback: {
      type: 'boolean',
      optional: true,
      description: 'Whether to show correct/incorrect feedback',
    },
    showCorrectAnswers: {
      type: 'boolean',
      optional: true,
      description: 'Whether to show correct answers after submission',
    },
    allowRetake: {
      type: 'boolean',
      optional: true,
      description: 'Whether users can retake the quiz',
    },
    maxAttempts: {
      type: 'number',
      optional: true,
      description: 'Maximum number of attempts allowed',
    },
    allowBackNavigation: {
      type: 'boolean',
      optional: true,
      description: 'Whether users can go back to previous questions',
    },

    // Timing
    timeLimit: {
      type: 'number',
      optional: true,
      description: 'Time limit in seconds',
    },
    timeLimitPerQuestion: {
      type: 'number',
      optional: true,
      description: 'Time limit per question in seconds',
    },
    availableFrom: {
      type: 'datetime',
      optional: true,
      description: 'When quiz becomes available',
    },
    availableUntil: {
      type: 'datetime',
      optional: true,
      description: 'When quiz expires',
    },

    // Structure
    questionCount: {
      type: 'number',
      optional: true,
      description: 'Total number of questions',
    },
    questionsPerPage: {
      type: 'number',
      optional: true,
      description: 'Number of questions per page',
    },

    // Scoring
    totalPoints: {
      type: 'number',
      optional: true,
      description: 'Total points possible',
    },
    passingScore: {
      type: 'number',
      optional: true,
      description: 'Minimum score to pass (percentage or points)',
    },
    scoringType: {
      type: 'string',
      optional: true,
      description: 'Scoring method: points, percentage, letter-grade',
      examples: ['points', 'percentage', 'letter-grade'],
    },
    negativeMarking: {
      type: 'boolean',
      optional: true,
      description: 'Whether incorrect answers deduct points',
    },
    partialCredit: {
      type: 'boolean',
      optional: true,
      description: 'Whether partial credit is awarded',
    },

    // Results
    showScore: {
      type: 'boolean',
      optional: true,
      description: 'Whether to show score to quiz takers',
    },
    certificateEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether to generate completion certificate',
    },
    certificateTemplate: {
      type: 'string',
      optional: true,
      description: 'Certificate template ID',
    },

    // Access
    accessMode: {
      type: 'string',
      optional: true,
      description: 'Access mode: public, private, password-protected',
      examples: ['public', 'private', 'password-protected'],
    },
    password: {
      type: 'string',
      optional: true,
      description: 'Password for protected quizzes',
    },
    requireAuthentication: {
      type: 'boolean',
      optional: true,
      description: 'Whether authentication is required',
    },

    // Statistics
    attemptCount: {
      type: 'number',
      optional: true,
      description: 'Total number of attempts',
    },
    averageScore: {
      type: 'number',
      optional: true,
      description: 'Average score across all attempts',
    },
    passRate: {
      type: 'number',
      optional: true,
      description: 'Percentage of passing attempts',
    },

    // Appearance
    theme: {
      type: 'json',
      optional: true,
      description: 'Visual theme and styling',
    },
    logo: {
      type: 'url',
      optional: true,
      description: 'Logo URL',
    },

    // Metadata
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
  },

  relationships: {
    questions: {
      type: 'QuizQuestion[]',
      backref: 'quiz',
      description: 'Questions in this quiz',
    },
    results: {
      type: 'QuizResult[]',
      backref: 'quiz',
      description: 'Results from quiz attempts',
    },
    owner: {
      type: 'Contact',
      description: 'Owner of the quiz',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with edit access',
    },
  },

  actions: [
    'create',
    'edit',
    'duplicate',
    'publish',
    'unpublish',
    'archive',
    'delete',
    'addQuestion',
    'removeQuestion',
    'reorderQuestions',
    'share',
    'export',
    'import',
    'preview',
    'reset',
  ],

  events: [
    'created',
    'edited',
    'duplicated',
    'published',
    'unpublished',
    'archived',
    'deleted',
    'questionAdded',
    'questionRemoved',
    'questionsReordered',
    'shared',
    'attempted',
    'completed',
  ],
}

/**
 * QuizQuestion entity
 *
 * Represents a question within a quiz with correct answer(s) and scoring.
 */
export const QuizQuestion: Noun = {
  singular: 'quiz question',
  plural: 'quiz questions',
  description: 'A question within a quiz with correct answer and scoring',

  properties: {
    // Identity
    text: {
      type: 'string',
      description: 'Question text',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Additional context or instructions',
    },

    // Type
    type: {
      type: 'string',
      description: 'Question type',
      examples: [
        'multiple-choice',
        'multiple-select',
        'true-false',
        'short-answer',
        'essay',
        'fill-blank',
        'matching',
        'ordering',
      ],
    },
    order: {
      type: 'number',
      description: 'Display order within the quiz',
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Question category for grouping',
    },

    // Options and answers
    options: {
      type: 'json',
      optional: true,
      description: 'Answer options for multiple choice',
    },
    correctAnswers: {
      type: 'json',
      description: 'Correct answer(s) with metadata',
    },
    caseSensitive: {
      type: 'boolean',
      optional: true,
      description: 'Whether text answers are case sensitive',
    },

    // Scoring
    points: {
      type: 'number',
      optional: true,
      description: 'Points awarded for correct answer',
    },
    negativePoints: {
      type: 'number',
      optional: true,
      description: 'Points deducted for incorrect answer',
    },
    partialCreditRules: {
      type: 'json',
      optional: true,
      description: 'Rules for awarding partial credit',
    },

    // Difficulty
    difficulty: {
      type: 'string',
      optional: true,
      description: 'Question difficulty level',
      examples: ['easy', 'medium', 'hard'],
    },

    // Feedback
    correctFeedback: {
      type: 'string',
      optional: true,
      description: 'Feedback shown for correct answers',
    },
    incorrectFeedback: {
      type: 'string',
      optional: true,
      description: 'Feedback shown for incorrect answers',
    },
    explanation: {
      type: 'string',
      optional: true,
      description: 'Detailed explanation of the correct answer',
    },

    // Media
    imageUrl: {
      type: 'url',
      optional: true,
      description: 'Image to display with the question',
    },
    videoUrl: {
      type: 'url',
      optional: true,
      description: 'Video to display with the question',
    },
    audioUrl: {
      type: 'url',
      optional: true,
      description: 'Audio to play with the question',
    },

    // Settings
    required: {
      type: 'boolean',
      optional: true,
      description: 'Whether the question must be answered',
    },
    randomizeOptions: {
      type: 'boolean',
      optional: true,
      description: 'Whether to randomize option order',
    },
    timeLimit: {
      type: 'number',
      optional: true,
      description: 'Time limit for this question in seconds',
    },

    // Statistics
    timesAnswered: {
      type: 'number',
      optional: true,
      description: 'Number of times this question was answered',
    },
    correctRate: {
      type: 'number',
      optional: true,
      description: 'Percentage of correct answers',
    },
    averageTime: {
      type: 'number',
      optional: true,
      description: 'Average time to answer in seconds',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Additional question configuration',
    },
  },

  relationships: {
    quiz: {
      type: 'Quiz',
      backref: 'questions',
      description: 'Parent quiz',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'duplicate',
    'move',
    'setCorrectAnswer',
    'addOption',
    'removeOption',
    'reorderOptions',
    'setPoints',
    'setFeedback',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'duplicated',
    'moved',
    'correctAnswerSet',
    'optionAdded',
    'optionRemoved',
    'optionsReordered',
    'pointsSet',
    'feedbackSet',
  ],
}

/**
 * QuizResult entity
 *
 * Represents a completed quiz attempt with score and answers.
 */
export const QuizResult: Noun = {
  singular: 'quiz result',
  plural: 'quiz results',
  description: 'A completed quiz attempt with score and detailed results',

  properties: {
    // Score
    score: {
      type: 'number',
      description: 'Total score achieved',
    },
    maxScore: {
      type: 'number',
      description: 'Maximum possible score',
    },
    percentage: {
      type: 'number',
      description: 'Score as percentage (0-100)',
    },
    grade: {
      type: 'string',
      optional: true,
      description: 'Letter grade if applicable',
    },
    passed: {
      type: 'boolean',
      description: 'Whether the passing score was met',
    },

    // Answers
    answers: {
      type: 'json',
      description: 'Question answers with correctness',
    },
    correctCount: {
      type: 'number',
      description: 'Number of correct answers',
    },
    incorrectCount: {
      type: 'number',
      description: 'Number of incorrect answers',
    },
    skippedCount: {
      type: 'number',
      optional: true,
      description: 'Number of skipped questions',
    },

    // Timing
    startedAt: {
      type: 'datetime',
      description: 'When the quiz was started',
    },
    completedAt: {
      type: 'datetime',
      description: 'When the quiz was completed',
    },
    duration: {
      type: 'number',
      description: 'Time taken to complete in seconds',
    },
    timePerQuestion: {
      type: 'json',
      optional: true,
      description: 'Time spent on each question',
    },

    // Attempt
    attemptNumber: {
      type: 'number',
      description: 'Attempt number for this user',
    },
    isRetake: {
      type: 'boolean',
      description: 'Whether this is a retake',
    },
    previousBestScore: {
      type: 'number',
      optional: true,
      description: 'Best score from previous attempts',
    },

    // Participant
    participantEmail: {
      type: 'string',
      optional: true,
      description: 'Email address of quiz taker',
    },
    participantName: {
      type: 'string',
      optional: true,
      description: 'Name of quiz taker',
    },
    participantId: {
      type: 'string',
      optional: true,
      description: 'Authenticated user ID',
    },

    // Certification
    certificateIssued: {
      type: 'boolean',
      optional: true,
      description: 'Whether a certificate was issued',
    },
    certificateUrl: {
      type: 'url',
      optional: true,
      description: 'URL to download certificate',
    },
    certificateId: {
      type: 'string',
      optional: true,
      description: 'Unique certificate identifier',
    },

    // Analysis
    strengthAreas: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Categories where participant performed well',
    },
    improvementAreas: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Categories needing improvement',
    },
    percentile: {
      type: 'number',
      optional: true,
      description: 'Percentile rank compared to other attempts',
    },

    // Technical
    ipAddress: {
      type: 'string',
      optional: true,
      description: 'IP address',
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

    // Review
    reviewed: {
      type: 'boolean',
      optional: true,
      description: 'Whether result has been reviewed by instructor',
    },
    reviewedBy: {
      type: 'string',
      optional: true,
      description: 'Instructor who reviewed the result',
    },
    reviewNotes: {
      type: 'string',
      optional: true,
      description: 'Instructor notes',
    },
    manualScore: {
      type: 'number',
      optional: true,
      description: 'Manually adjusted score if applicable',
    },

    // Flags
    flagged: {
      type: 'boolean',
      optional: true,
      description: 'Whether result is flagged for review',
    },
    flagReason: {
      type: 'string',
      optional: true,
      description: 'Reason for flagging',
    },
    cheatingDetected: {
      type: 'boolean',
      optional: true,
      description: 'Whether potential cheating was detected',
    },
  },

  relationships: {
    quiz: {
      type: 'Quiz',
      backref: 'results',
      description: 'Quiz this result belongs to',
    },
    participant: {
      type: 'Contact',
      required: false,
      description: 'Contact record for the quiz taker',
    },
  },

  actions: [
    'view',
    'export',
    'print',
    'downloadCertificate',
    'review',
    'flag',
    'unflag',
    'adjustScore',
    'delete',
    'retake',
  ],

  events: [
    'completed',
    'exported',
    'printed',
    'certificateDownloaded',
    'reviewed',
    'flagged',
    'unflagged',
    'scoreAdjusted',
    'deleted',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All forms and survey entity types
 */
export const FormsEntities = {
  // Forms
  Form,
  FormField,
  FormResponse,

  // Surveys
  Survey,
  SurveyQuestion,
  SurveyResponse,

  // Quizzes
  Quiz,
  QuizQuestion,
  QuizResult,
}

/**
 * Entity categories for organization
 */
export const FormsCategories = {
  forms: ['Form', 'FormField', 'FormResponse'],
  surveys: ['Survey', 'SurveyQuestion', 'SurveyResponse'],
  quizzes: ['Quiz', 'QuizQuestion', 'QuizResult'],
} as const
