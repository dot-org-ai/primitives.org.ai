/**
 * Presentation Entity Types (Nouns)
 *
 * Semantic type definitions for presentations that support
 * Google Slides, Microsoft PowerPoint/PPTX, and Reveal.js/MDX formats.
 * Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun } from 'ai-database'

// =============================================================================
// Presentation
// =============================================================================

/**
 * Presentation entity
 *
 * Represents a slide presentation for creating and delivering visual content.
 * Supports Google Slides, PowerPoint/PPTX, and Reveal.js/MDX formats.
 */
export const Presentation: Noun = {
  singular: 'presentation',
  plural: 'presentations',
  description: 'A slide presentation for creating and delivering visual content',

  properties: {
    // Identity
    title: {
      type: 'string',
      description: 'Presentation title',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly identifier',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Presentation description or summary',
    },
    subtitle: {
      type: 'string',
      optional: true,
      description: 'Presentation subtitle',
    },

    // Format
    format: {
      type: 'string',
      description: 'Presentation format: pptx, gslides, revealjs, mdx, pdf',
      examples: ['pptx', 'gslides', 'revealjs', 'mdx', 'pdf', 'keynote'],
    },
    aspectRatio: {
      type: 'string',
      optional: true,
      description: 'Slide aspect ratio: 16:9, 4:3, 16:10',
      examples: ['16:9', '4:3', '16:10'],
    },
    slideSize: {
      type: 'json',
      optional: true,
      description: 'Custom slide dimensions',
    },

    // Status
    status: {
      type: 'string',
      description: 'Presentation status: draft, in-review, ready, presented, archived',
      examples: ['draft', 'in-review', 'ready', 'presented', 'archived'],
    },
    visibility: {
      type: 'string',
      description: 'Visibility: private, internal, public',
      examples: ['private', 'internal', 'public'],
    },

    // Structure
    slideCount: {
      type: 'number',
      optional: true,
      description: 'Total number of slides',
    },
    duration: {
      type: 'number',
      optional: true,
      description: 'Estimated presentation duration in minutes',
    },

    // Theme and styling
    theme: {
      type: 'string',
      optional: true,
      description: 'Presentation theme name',
    },
    themeConfig: {
      type: 'json',
      optional: true,
      description: 'Theme configuration and customization',
    },
    masterSlides: {
      type: 'json',
      optional: true,
      description: 'Master slide layouts',
    },
    colorScheme: {
      type: 'json',
      optional: true,
      description: 'Color scheme configuration',
    },
    fontScheme: {
      type: 'json',
      optional: true,
      description: 'Font scheme configuration',
    },

    // Transitions and animations
    defaultTransition: {
      type: 'string',
      optional: true,
      description: 'Default slide transition effect',
      examples: ['none', 'fade', 'slide', 'zoom', 'flip', 'cube', 'wipe'],
    },
    transitionSpeed: {
      type: 'string',
      optional: true,
      description: 'Transition speed: slow, default, fast',
      examples: ['slow', 'default', 'fast'],
    },

    // Presenter features
    hasNotes: {
      type: 'boolean',
      optional: true,
      description: 'Whether presentation includes speaker notes',
    },
    hasTimings: {
      type: 'boolean',
      optional: true,
      description: 'Whether slides have timing information',
    },
    autoAdvance: {
      type: 'boolean',
      optional: true,
      description: 'Whether slides auto-advance',
    },
    autoAdvanceDelay: {
      type: 'number',
      optional: true,
      description: 'Auto-advance delay in seconds',
    },
    loop: {
      type: 'boolean',
      optional: true,
      description: 'Whether presentation loops',
    },

    // Collaboration
    allowComments: {
      type: 'boolean',
      optional: true,
      description: 'Whether comments are enabled',
    },
    shareMode: {
      type: 'string',
      optional: true,
      description: 'Sharing mode: view, comment, edit, present',
      examples: ['view', 'comment', 'edit', 'present'],
    },
    allowDownload: {
      type: 'boolean',
      optional: true,
      description: 'Whether download is allowed',
    },

    // Templates
    isTemplate: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a template',
    },
    templateId: {
      type: 'string',
      optional: true,
      description: 'ID of template this was created from',
    },
    templateCategory: {
      type: 'string',
      optional: true,
      description: 'Template category',
      examples: ['business', 'education', 'pitch-deck', 'report', 'training'],
    },

    // Publishing
    published: {
      type: 'boolean',
      optional: true,
      description: 'Whether presentation is published',
    },
    publishedUrl: {
      type: 'url',
      optional: true,
      description: 'Published presentation URL',
    },
    publishedAt: {
      type: 'datetime',
      optional: true,
      description: 'Publication timestamp',
    },
    embedCode: {
      type: 'string',
      optional: true,
      description: 'HTML embed code',
    },

    // Presentation sessions
    lastPresentedAt: {
      type: 'datetime',
      optional: true,
      description: 'Last presentation timestamp',
    },
    presentationCount: {
      type: 'number',
      optional: true,
      description: 'Number of times presented',
    },

    // Integration
    externalId: {
      type: 'string',
      optional: true,
      description: 'External system ID (Google Slides ID, OneDrive ID, etc.)',
    },
    externalUrl: {
      type: 'url',
      optional: true,
      description: 'URL in external system',
    },
    syncEnabled: {
      type: 'boolean',
      optional: true,
      description: 'Whether sync is enabled',
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
      description: 'Presentation language code',
    },
    author: {
      type: 'string',
      optional: true,
      description: 'Presentation author name',
    },
    company: {
      type: 'string',
      optional: true,
      description: 'Company or organization',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    category: {
      type: 'string',
      optional: true,
      description: 'Presentation category',
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
  },

  relationships: {
    owner: {
      type: 'Contact',
      description: 'Presentation owner',
    },
    creator: {
      type: 'Contact',
      description: 'User who created the presentation',
    },
    lastEditor: {
      type: 'Contact',
      required: false,
      description: 'User who last edited',
    },
    slides: {
      type: 'Slide[]',
      backref: 'presentation',
      description: 'Slides in this presentation',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'Users with access',
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
    'present',
    'startPresentation',
    'endPresentation',
    'addSlide',
    'removeSlide',
    'reorderSlides',
    'duplicateSlide',
    'makeTemplate',
    'createFromTemplate',
    'applyTheme',
    'changeAspectRatio',
    'setTransitions',
    'addAnimation',
    'recordPresentation',
    'embedPresentation',
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
    'presented',
    'presentationStarted',
    'presentationEnded',
    'slideAdded',
    'slideRemoved',
    'slidesReordered',
    'slideDuplicated',
    'themeApplied',
    'aspectRatioChanged',
    'transitionsSet',
    'animationAdded',
    'recorded',
    'embedded',
    'collaboratorAdded',
    'collaboratorRemoved',
    'permissionChanged',
    'synced',
    'viewed',
  ],
}

// =============================================================================
// Slide
// =============================================================================

/**
 * Slide entity
 *
 * Represents a single slide within a presentation.
 */
export const Slide: Noun = {
  singular: 'slide',
  plural: 'slides',
  description: 'A single slide within a presentation',

  properties: {
    // Identity
    title: {
      type: 'string',
      optional: true,
      description: 'Slide title',
    },
    index: {
      type: 'number',
      description: 'Slide position in presentation (0-based)',
    },
    slideId: {
      type: 'string',
      optional: true,
      description: 'Internal slide identifier',
    },

    // Layout
    layout: {
      type: 'string',
      optional: true,
      description: 'Slide layout type',
      examples: [
        'title',
        'title-content',
        'section-header',
        'two-column',
        'comparison',
        'blank',
        'content',
        'title-only',
        'picture',
      ],
    },
    masterSlideId: {
      type: 'string',
      optional: true,
      description: 'Master slide/layout reference',
    },

    // Background
    backgroundColor: {
      type: 'string',
      optional: true,
      description: 'Background color (hex)',
    },
    backgroundImage: {
      type: 'url',
      optional: true,
      description: 'Background image URL',
    },
    backgroundType: {
      type: 'string',
      optional: true,
      description: 'Background type: solid, gradient, image, video',
      examples: ['solid', 'gradient', 'image', 'video'],
    },
    backgroundGradient: {
      type: 'json',
      optional: true,
      description: 'Gradient configuration',
    },

    // Transition
    transition: {
      type: 'string',
      optional: true,
      description: 'Slide transition effect',
      examples: ['none', 'fade', 'slide', 'zoom', 'flip', 'cube', 'wipe', 'dissolve'],
    },
    transitionDuration: {
      type: 'number',
      optional: true,
      description: 'Transition duration in milliseconds',
    },
    transitionDirection: {
      type: 'string',
      optional: true,
      description: 'Transition direction',
      examples: ['left', 'right', 'up', 'down'],
    },

    // Timing
    duration: {
      type: 'number',
      optional: true,
      description: 'Slide display duration in seconds',
    },
    autoAdvance: {
      type: 'boolean',
      optional: true,
      description: 'Whether slide auto-advances',
    },
    advanceAfter: {
      type: 'number',
      optional: true,
      description: 'Seconds before auto-advance',
    },

    // Content
    hasContent: {
      type: 'boolean',
      optional: true,
      description: 'Whether slide has content elements',
    },
    elementCount: {
      type: 'number',
      optional: true,
      description: 'Number of elements on slide',
    },

    // Notes
    notes: {
      type: 'string',
      optional: true,
      description: 'Speaker notes for this slide',
    },
    hasNotes: {
      type: 'boolean',
      optional: true,
      description: 'Whether slide has speaker notes',
    },

    // Visibility
    hidden: {
      type: 'boolean',
      optional: true,
      description: 'Whether slide is hidden',
    },

    // Section
    sectionTitle: {
      type: 'string',
      optional: true,
      description: 'Section this slide belongs to',
    },
    isSection: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is a section divider',
    },

    // Animations
    hasAnimations: {
      type: 'boolean',
      optional: true,
      description: 'Whether slide has animations',
    },
    animationCount: {
      type: 'number',
      optional: true,
      description: 'Number of animations',
    },

    // Thumbnail
    thumbnail: {
      type: 'url',
      optional: true,
      description: 'Slide thumbnail URL',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Custom metadata',
    },
  },

  relationships: {
    presentation: {
      type: 'Presentation',
      backref: 'slides',
      description: 'Parent presentation',
    },
    elements: {
      type: 'SlideElement[]',
      backref: 'slide',
      description: 'Elements on this slide',
    },
    speakerNotes: {
      type: 'SpeakerNotes',
      required: false,
      description: 'Detailed speaker notes',
    },
    animations: {
      type: 'Animation[]',
      backref: 'slide',
      description: 'Animations on this slide',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'duplicate',
    'move',
    'hide',
    'unhide',
    'setLayout',
    'setBackground',
    'setTransition',
    'addElement',
    'removeElement',
    'reorderElements',
    'addNotes',
    'editNotes',
    'addAnimation',
    'preview',
    'present',
    'export',
    'generateThumbnail',
    'createSection',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'duplicated',
    'moved',
    'hidden',
    'unhidden',
    'layoutSet',
    'backgroundSet',
    'transitionSet',
    'elementAdded',
    'elementRemoved',
    'elementsReordered',
    'notesAdded',
    'notesEdited',
    'animationAdded',
    'presented',
    'exported',
    'thumbnailGenerated',
    'sectionCreated',
  ],
}

// =============================================================================
// SlideElement
// =============================================================================

/**
 * SlideElement entity
 *
 * Represents a content element on a slide (text, image, shape, chart, etc.).
 */
export const SlideElement: Noun = {
  singular: 'slide element',
  plural: 'slide elements',
  description: 'A content element on a slide (text, image, shape, chart, video, etc.)',

  properties: {
    // Identity
    elementId: {
      type: 'string',
      optional: true,
      description: 'Unique element identifier',
    },
    name: {
      type: 'string',
      optional: true,
      description: 'Element name or label',
    },

    // Type
    type: {
      type: 'string',
      description: 'Element type',
      examples: [
        'text',
        'textbox',
        'image',
        'shape',
        'chart',
        'table',
        'video',
        'audio',
        'embed',
        'line',
        'arrow',
        'group',
        'smartart',
      ],
    },
    subtype: {
      type: 'string',
      optional: true,
      description: 'Element subtype (shape type, chart type, etc.)',
    },

    // Position and size
    x: {
      type: 'number',
      description: 'X position in slide coordinates',
    },
    y: {
      type: 'number',
      description: 'Y position in slide coordinates',
    },
    width: {
      type: 'number',
      description: 'Element width',
    },
    height: {
      type: 'number',
      description: 'Element height',
    },
    rotation: {
      type: 'number',
      optional: true,
      description: 'Rotation angle in degrees',
    },
    zIndex: {
      type: 'number',
      optional: true,
      description: 'Z-index for layering',
    },

    // Content (varies by type)
    content: {
      type: 'string',
      optional: true,
      description: 'Element content (text, URL, etc.)',
    },
    richContent: {
      type: 'json',
      optional: true,
      description: 'Rich formatted content',
    },

    // Text-specific
    text: {
      type: 'string',
      optional: true,
      description: 'Text content',
    },
    fontFamily: {
      type: 'string',
      optional: true,
      description: 'Font family',
    },
    fontSize: {
      type: 'number',
      optional: true,
      description: 'Font size in points',
    },
    fontWeight: {
      type: 'string',
      optional: true,
      description: 'Font weight: normal, bold',
      examples: ['normal', 'bold'],
    },
    fontStyle: {
      type: 'string',
      optional: true,
      description: 'Font style: normal, italic',
      examples: ['normal', 'italic'],
    },
    textAlign: {
      type: 'string',
      optional: true,
      description: 'Text alignment: left, center, right, justify',
      examples: ['left', 'center', 'right', 'justify'],
    },
    textColor: {
      type: 'string',
      optional: true,
      description: 'Text color (hex)',
    },
    lineHeight: {
      type: 'number',
      optional: true,
      description: 'Line height multiplier',
    },
    bulletStyle: {
      type: 'string',
      optional: true,
      description: 'Bullet list style',
    },

    // Image-specific
    imageUrl: {
      type: 'url',
      optional: true,
      description: 'Image URL',
    },
    imageSource: {
      type: 'string',
      optional: true,
      description: 'Image source or attribution',
    },
    imageAlt: {
      type: 'string',
      optional: true,
      description: 'Image alt text',
    },

    // Video-specific
    videoUrl: {
      type: 'url',
      optional: true,
      description: 'Video URL',
    },
    videoProvider: {
      type: 'string',
      optional: true,
      description: 'Video provider: youtube, vimeo, etc.',
      examples: ['youtube', 'vimeo', 'local'],
    },
    autoplay: {
      type: 'boolean',
      optional: true,
      description: 'Whether video autoplays',
    },
    loop: {
      type: 'boolean',
      optional: true,
      description: 'Whether video loops',
    },

    // Shape-specific
    shapeType: {
      type: 'string',
      optional: true,
      description: 'Shape type',
      examples: ['rectangle', 'circle', 'triangle', 'star', 'arrow', 'callout'],
    },
    fillColor: {
      type: 'string',
      optional: true,
      description: 'Fill color (hex)',
    },
    strokeColor: {
      type: 'string',
      optional: true,
      description: 'Stroke/border color (hex)',
    },
    strokeWidth: {
      type: 'number',
      optional: true,
      description: 'Stroke width in points',
    },

    // Chart-specific
    chartType: {
      type: 'string',
      optional: true,
      description: 'Chart type',
      examples: ['line', 'bar', 'pie', 'scatter', 'area'],
    },
    chartData: {
      type: 'json',
      optional: true,
      description: 'Chart data and configuration',
    },

    // Table-specific
    tableData: {
      type: 'json',
      optional: true,
      description: 'Table data as 2D array',
    },
    tableRows: {
      type: 'number',
      optional: true,
      description: 'Number of table rows',
    },
    tableColumns: {
      type: 'number',
      optional: true,
      description: 'Number of table columns',
    },

    // Styling
    backgroundColor: {
      type: 'string',
      optional: true,
      description: 'Background color (hex)',
    },
    opacity: {
      type: 'number',
      optional: true,
      description: 'Opacity (0-1)',
    },
    shadow: {
      type: 'json',
      optional: true,
      description: 'Shadow configuration',
    },
    border: {
      type: 'json',
      optional: true,
      description: 'Border configuration',
    },

    // Interactions
    link: {
      type: 'url',
      optional: true,
      description: 'Hyperlink URL',
    },
    linkType: {
      type: 'string',
      optional: true,
      description: 'Link type: url, slide, file',
      examples: ['url', 'slide', 'file', 'email'],
    },
    linkedSlideIndex: {
      type: 'number',
      optional: true,
      description: 'Linked slide index for navigation',
    },

    // Animation
    hasAnimation: {
      type: 'boolean',
      optional: true,
      description: 'Whether element has animation',
    },

    // Grouping
    isGrouped: {
      type: 'boolean',
      optional: true,
      description: 'Whether element is part of a group',
    },
    groupId: {
      type: 'string',
      optional: true,
      description: 'Group identifier',
    },

    // Visibility
    hidden: {
      type: 'boolean',
      optional: true,
      description: 'Whether element is hidden',
    },
    locked: {
      type: 'boolean',
      optional: true,
      description: 'Whether element is locked from editing',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Custom metadata',
    },
  },

  relationships: {
    slide: {
      type: 'Slide',
      backref: 'elements',
      description: 'Parent slide',
    },
    animations: {
      type: 'Animation[]',
      backref: 'element',
      description: 'Animations applied to this element',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'duplicate',
    'move',
    'resize',
    'rotate',
    'bringToFront',
    'sendToBack',
    'bringForward',
    'sendBackward',
    'align',
    'distribute',
    'group',
    'ungroup',
    'lock',
    'unlock',
    'hide',
    'unhide',
    'setStyle',
    'addLink',
    'removeLink',
    'addAnimation',
    'copy',
    'paste',
    'cut',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'duplicated',
    'moved',
    'resized',
    'rotated',
    'reordered',
    'aligned',
    'distributed',
    'grouped',
    'ungrouped',
    'locked',
    'unlocked',
    'hidden',
    'unhidden',
    'styled',
    'linkAdded',
    'linkRemoved',
    'animationAdded',
    'copied',
    'pasted',
  ],
}

// =============================================================================
// SpeakerNotes
// =============================================================================

/**
 * SpeakerNotes entity
 *
 * Represents detailed speaker notes for a slide.
 */
export const SpeakerNotes: Noun = {
  singular: 'speaker notes',
  plural: 'speaker notes',
  description: 'Detailed speaker notes for a presentation slide',

  properties: {
    // Content
    text: {
      type: 'string',
      description: 'Notes text content',
    },
    richText: {
      type: 'json',
      optional: true,
      description: 'Rich formatted notes',
    },

    // Formatting
    fontSize: {
      type: 'number',
      optional: true,
      description: 'Font size for display',
    },

    // Timing
    estimatedTime: {
      type: 'number',
      optional: true,
      description: 'Estimated time for this slide in seconds',
    },
    actualTime: {
      type: 'number',
      optional: true,
      description: 'Actual time spent on slide during presentation',
    },

    // Cues
    cuePoints: {
      type: 'json',
      optional: true,
      description: 'Timing cues or reminders',
    },

    // Structure
    keyPoints: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Key points to cover',
    },
    questions: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Questions to ask audience',
    },

    // Visibility
    visibleToAudience: {
      type: 'boolean',
      optional: true,
      description: 'Whether notes are visible to audience',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Custom metadata',
    },
  },

  relationships: {
    slide: {
      type: 'Slide',
      description: 'Associated slide',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'clear',
    'format',
    'addCue',
    'removeCue',
    'setTiming',
    'addKeyPoint',
    'addQuestion',
    'print',
    'export',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'cleared',
    'formatted',
    'cueAdded',
    'cueRemoved',
    'timingSet',
    'keyPointAdded',
    'questionAdded',
    'printed',
    'exported',
  ],
}

// =============================================================================
// Animation
// =============================================================================

/**
 * Animation entity
 *
 * Represents an animation effect applied to a slide or element.
 */
export const Animation: Noun = {
  singular: 'animation',
  plural: 'animations',
  description: 'An animation effect applied to a slide or element',

  properties: {
    // Type
    type: {
      type: 'string',
      description: 'Animation type: entrance, emphasis, exit, motion',
      examples: ['entrance', 'emphasis', 'exit', 'motion'],
    },
    effect: {
      type: 'string',
      description: 'Animation effect name',
      examples: [
        'fade',
        'fly',
        'wipe',
        'split',
        'shape',
        'wheel',
        'zoom',
        'bounce',
        'spin',
        'grow',
        'shrink',
        'pulse',
      ],
    },
    variant: {
      type: 'string',
      optional: true,
      description: 'Effect variant or direction',
      examples: ['left', 'right', 'up', 'down', 'in', 'out'],
    },

    // Timing
    trigger: {
      type: 'string',
      description: 'Animation trigger: on-click, with-previous, after-previous, auto',
      examples: ['on-click', 'with-previous', 'after-previous', 'auto'],
    },
    order: {
      type: 'number',
      description: 'Animation sequence order',
    },
    delay: {
      type: 'number',
      optional: true,
      description: 'Delay before animation starts in milliseconds',
    },
    duration: {
      type: 'number',
      optional: true,
      description: 'Animation duration in milliseconds',
    },

    // Easing
    easing: {
      type: 'string',
      optional: true,
      description: 'Easing function',
      examples: ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'bounce', 'elastic'],
    },

    // Motion path (for motion animations)
    motionPath: {
      type: 'json',
      optional: true,
      description: 'Motion path configuration',
    },

    // Options
    reverse: {
      type: 'boolean',
      optional: true,
      description: 'Whether animation plays in reverse',
    },
    rewind: {
      type: 'boolean',
      optional: true,
      description: 'Whether element rewinds after animation',
    },
    loop: {
      type: 'boolean',
      optional: true,
      description: 'Whether animation loops',
    },
    loopCount: {
      type: 'number',
      optional: true,
      description: 'Number of times to loop',
    },

    // Sound
    soundEffect: {
      type: 'url',
      optional: true,
      description: 'Sound effect URL',
    },

    // Metadata
    metadata: {
      type: 'json',
      optional: true,
      description: 'Custom metadata',
    },
  },

  relationships: {
    slide: {
      type: 'Slide',
      backref: 'animations',
      description: 'Parent slide',
    },
    element: {
      type: 'SlideElement',
      backref: 'animations',
      required: false,
      description: 'Element being animated',
    },
  },

  actions: [
    'create',
    'edit',
    'delete',
    'duplicate',
    'reorder',
    'play',
    'pause',
    'stop',
    'reset',
    'preview',
    'setTiming',
    'setEffect',
    'setTrigger',
  ],

  events: [
    'created',
    'edited',
    'deleted',
    'duplicated',
    'reordered',
    'played',
    'paused',
    'stopped',
    'reset',
    'timingSet',
    'effectSet',
    'triggerSet',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All presentation entity types
 */
export const PresentationEntities = {
  Presentation,
  Slide,
  SlideElement,
  SpeakerNotes,
  Animation,
}

/**
 * Entity categories for organization
 */
export const PresentationCategories = {
  presentations: ['Presentation', 'Slide', 'SlideElement', 'SpeakerNotes', 'Animation'],
} as const
