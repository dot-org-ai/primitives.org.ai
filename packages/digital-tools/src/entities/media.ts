/**
 * Media Entity Types (Nouns)
 *
 * Semantic type definitions for media-related digital tools that can be used by
 * both remote human workers AND AI agents. Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, Verb } from 'ai-database'

// =============================================================================
// Image
// =============================================================================

/**
 * Image file entity
 *
 * Represents an image file with dimensions, format, and metadata
 */
export const Image: Noun = {
  singular: 'image',
  plural: 'images',
  description: 'An image file with dimensions, format, and metadata',

  properties: {
    // Basic info
    filename: {
      type: 'string',
      description: 'Original filename',
    },
    url: {
      type: 'url',
      description: 'URL to access the image',
    },
    altText: {
      type: 'string',
      optional: true,
      description: 'Alternative text for accessibility',
    },
    caption: {
      type: 'string',
      optional: true,
      description: 'Image caption or description',
    },
    title: {
      type: 'string',
      optional: true,
      description: 'Image title',
    },

    // Format & dimensions
    format: {
      type: 'string',
      description: 'Image format: jpg, jpeg, png, gif, webp, svg, heic, bmp, tiff',
      examples: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'heic', 'bmp', 'tiff'],
    },
    mimeType: {
      type: 'string',
      description: 'MIME type of the image',
    },
    width: {
      type: 'number',
      description: 'Width in pixels',
    },
    height: {
      type: 'number',
      description: 'Height in pixels',
    },
    aspectRatio: {
      type: 'string',
      optional: true,
      description: 'Aspect ratio (e.g., 16:9, 4:3)',
    },
    orientation: {
      type: 'string',
      optional: true,
      description: 'Image orientation: landscape, portrait, square',
      examples: ['landscape', 'portrait', 'square'],
    },

    // File properties
    size: {
      type: 'number',
      description: 'File size in bytes',
    },
    hash: {
      type: 'string',
      optional: true,
      description: 'Content hash for deduplication',
    },

    // Technical metadata
    colorSpace: {
      type: 'string',
      optional: true,
      description: 'Color space: rgb, cmyk, grayscale',
      examples: ['rgb', 'cmyk', 'grayscale'],
    },
    bitDepth: {
      type: 'number',
      optional: true,
      description: 'Color bit depth',
    },
    dpi: {
      type: 'number',
      optional: true,
      description: 'Dots per inch resolution',
    },
    hasAlpha: {
      type: 'boolean',
      optional: true,
      description: 'Whether the image has an alpha channel',
    },

    // EXIF & camera metadata
    exif: {
      type: 'json',
      optional: true,
      description: 'EXIF metadata from the camera',
    },
    camera: {
      type: 'string',
      optional: true,
      description: 'Camera make and model',
    },
    lens: {
      type: 'string',
      optional: true,
      description: 'Lens information',
    },
    focalLength: {
      type: 'number',
      optional: true,
      description: 'Focal length in millimeters',
    },
    aperture: {
      type: 'number',
      optional: true,
      description: 'Aperture f-stop value',
    },
    shutterSpeed: {
      type: 'string',
      optional: true,
      description: 'Shutter speed (e.g., 1/1000)',
    },
    iso: {
      type: 'number',
      optional: true,
      description: 'ISO sensitivity',
    },
    flash: {
      type: 'boolean',
      optional: true,
      description: 'Whether flash was used',
    },

    // Location & time
    takenAt: {
      type: 'datetime',
      optional: true,
      description: 'When the photo was taken',
    },
    location: {
      type: 'json',
      optional: true,
      description: 'GPS coordinates (latitude, longitude)',
    },

    // Organization
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    keywords: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Search keywords',
    },

    // Processing
    thumbnail: {
      type: 'url',
      optional: true,
      description: 'URL to thumbnail version',
    },
    versions: {
      type: 'json',
      optional: true,
      description: 'Different sizes/versions of the image',
    },
  },

  relationships: {
    album: {
      type: 'Album',
      required: false,
      description: 'Album this image belongs to',
    },
    library: {
      type: 'MediaLibrary',
      required: false,
      description: 'Media library containing this image',
    },
    photographer: {
      type: 'Contact',
      required: false,
      description: 'Photographer who took the photo',
    },
  },

  actions: [
    'upload',
    'download',
    'view',
    'edit',
    'crop',
    'resize',
    'rotate',
    'flip',
    'filter',
    'enhance',
    'compress',
    'convert',
    'tag',
    'share',
    'delete',
    'restore',
    'duplicate',
    'addToAlbum',
    'removeFromAlbum',
    'setAltText',
  ],

  events: [
    'uploaded',
    'downloaded',
    'viewed',
    'edited',
    'cropped',
    'resized',
    'rotated',
    'flipped',
    'filtered',
    'enhanced',
    'compressed',
    'converted',
    'tagged',
    'shared',
    'deleted',
    'restored',
    'duplicated',
    'addedToAlbum',
    'removedFromAlbum',
  ],
}

// =============================================================================
// Video
// =============================================================================

/**
 * Video file entity
 *
 * Represents a video file with duration, resolution, and metadata
 */
export const Video: Noun = {
  singular: 'video',
  plural: 'videos',
  description: 'A video file with duration, resolution, format, and metadata',

  properties: {
    // Basic info
    filename: {
      type: 'string',
      description: 'Original filename',
    },
    url: {
      type: 'url',
      description: 'URL to access the video',
    },
    title: {
      type: 'string',
      optional: true,
      description: 'Video title',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Video description',
    },

    // Format & technical
    format: {
      type: 'string',
      description: 'Video format: mp4, mov, avi, webm, mkv, flv, wmv',
      examples: ['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv', 'wmv'],
    },
    mimeType: {
      type: 'string',
      description: 'MIME type of the video',
    },
    codec: {
      type: 'string',
      optional: true,
      description: 'Video codec: h264, h265, vp9, av1',
      examples: ['h264', 'h265', 'vp9', 'av1'],
    },
    audioCodec: {
      type: 'string',
      optional: true,
      description: 'Audio codec: aac, mp3, opus, vorbis',
      examples: ['aac', 'mp3', 'opus', 'vorbis'],
    },
    container: {
      type: 'string',
      optional: true,
      description: 'Container format',
    },

    // Duration & timing
    duration: {
      type: 'number',
      description: 'Duration in seconds',
    },
    frameRate: {
      type: 'number',
      optional: true,
      description: 'Frames per second',
    },
    totalFrames: {
      type: 'number',
      optional: true,
      description: 'Total number of frames',
    },

    // Dimensions
    width: {
      type: 'number',
      description: 'Width in pixels',
    },
    height: {
      type: 'number',
      description: 'Height in pixels',
    },
    aspectRatio: {
      type: 'string',
      optional: true,
      description: 'Aspect ratio (e.g., 16:9, 4:3, 21:9)',
      examples: ['16:9', '4:3', '21:9', '1:1'],
    },
    resolution: {
      type: 'string',
      optional: true,
      description: 'Video resolution: 480p, 720p, 1080p, 2k, 4k, 8k',
      examples: ['480p', '720p', '1080p', '1440p', '2k', '4k', '8k'],
    },
    orientation: {
      type: 'string',
      optional: true,
      description: 'Video orientation: landscape, portrait',
      examples: ['landscape', 'portrait'],
    },

    // File properties
    size: {
      type: 'number',
      description: 'File size in bytes',
    },
    bitrate: {
      type: 'number',
      optional: true,
      description: 'Bitrate in bits per second',
    },
    audioBitrate: {
      type: 'number',
      optional: true,
      description: 'Audio bitrate in bits per second',
    },

    // Thumbnail
    thumbnail: {
      type: 'url',
      optional: true,
      description: 'URL to thumbnail image',
    },
    poster: {
      type: 'url',
      optional: true,
      description: 'URL to poster image',
    },
    thumbnailTime: {
      type: 'number',
      optional: true,
      description: 'Time in seconds for thumbnail generation',
    },

    // Audio properties
    hasAudio: {
      type: 'boolean',
      optional: true,
      description: 'Whether the video has an audio track',
    },
    audioChannels: {
      type: 'number',
      optional: true,
      description: 'Number of audio channels',
    },
    sampleRate: {
      type: 'number',
      optional: true,
      description: 'Audio sample rate in Hz',
    },

    // Recording metadata
    recordedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the video was recorded',
    },
    location: {
      type: 'json',
      optional: true,
      description: 'GPS coordinates where recorded',
    },
    camera: {
      type: 'string',
      optional: true,
      description: 'Camera or device used',
    },

    // Organization
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    keywords: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Search keywords',
    },
    chapters: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Video chapters with timestamps',
    },

    // Processing status
    status: {
      type: 'string',
      optional: true,
      description: 'Processing status: uploading, processing, ready, error',
      examples: ['uploading', 'processing', 'ready', 'error'],
    },
    versions: {
      type: 'json',
      optional: true,
      description: 'Different quality versions of the video',
    },
  },

  relationships: {
    album: {
      type: 'Album',
      required: false,
      description: 'Album this video belongs to',
    },
    library: {
      type: 'MediaLibrary',
      required: false,
      description: 'Media library containing this video',
    },
    transcript: {
      type: 'Transcript',
      required: false,
      description: 'Transcription of the audio',
    },
    captions: {
      type: 'Caption[]',
      description: 'Subtitle/caption tracks',
    },
    creator: {
      type: 'Contact',
      required: false,
      description: 'Person who created the video',
    },
  },

  actions: [
    'upload',
    'download',
    'play',
    'pause',
    'seek',
    'edit',
    'trim',
    'crop',
    'rotate',
    'merge',
    'split',
    'transcode',
    'compress',
    'extract',
    'mute',
    'addAudio',
    'addSubtitles',
    'tag',
    'share',
    'delete',
    'restore',
    'duplicate',
    'addToAlbum',
    'removeFromAlbum',
    'generateThumbnail',
    'transcribe',
  ],

  events: [
    'uploaded',
    'downloaded',
    'played',
    'paused',
    'seeked',
    'edited',
    'trimmed',
    'cropped',
    'rotated',
    'merged',
    'split',
    'transcoded',
    'compressed',
    'extracted',
    'muted',
    'audioAdded',
    'subtitlesAdded',
    'tagged',
    'shared',
    'deleted',
    'restored',
    'duplicated',
    'addedToAlbum',
    'removedFromAlbum',
    'thumbnailGenerated',
    'transcribed',
    'processingStarted',
    'processingCompleted',
    'processingFailed',
  ],
}

// =============================================================================
// Audio
// =============================================================================

/**
 * Audio file entity
 *
 * Represents an audio file with duration, format, and metadata
 */
export const Audio: Noun = {
  singular: 'audio',
  plural: 'audio files',
  description: 'An audio file with duration, format, and metadata',

  properties: {
    // Basic info
    filename: {
      type: 'string',
      description: 'Original filename',
    },
    url: {
      type: 'url',
      description: 'URL to access the audio',
    },
    title: {
      type: 'string',
      optional: true,
      description: 'Audio title or track name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Audio description',
    },

    // Format & technical
    format: {
      type: 'string',
      description: 'Audio format: mp3, wav, aac, flac, ogg, m4a, wma, opus',
      examples: ['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'opus'],
    },
    mimeType: {
      type: 'string',
      description: 'MIME type of the audio',
    },
    codec: {
      type: 'string',
      optional: true,
      description: 'Audio codec',
    },

    // Duration
    duration: {
      type: 'number',
      description: 'Duration in seconds',
    },

    // Audio properties
    bitrate: {
      type: 'number',
      optional: true,
      description: 'Bitrate in bits per second',
    },
    sampleRate: {
      type: 'number',
      optional: true,
      description: 'Sample rate in Hz (e.g., 44100, 48000)',
    },
    channels: {
      type: 'number',
      optional: true,
      description: 'Number of audio channels: 1 (mono), 2 (stereo)',
    },
    bitDepth: {
      type: 'number',
      optional: true,
      description: 'Bit depth (e.g., 16, 24)',
    },

    // File properties
    size: {
      type: 'number',
      description: 'File size in bytes',
    },

    // Music metadata
    artist: {
      type: 'string',
      optional: true,
      description: 'Artist or performer',
    },
    album: {
      type: 'string',
      optional: true,
      description: 'Album name',
    },
    albumArtist: {
      type: 'string',
      optional: true,
      description: 'Album artist',
    },
    genre: {
      type: 'string',
      optional: true,
      description: 'Music genre',
    },
    year: {
      type: 'number',
      optional: true,
      description: 'Release year',
    },
    trackNumber: {
      type: 'number',
      optional: true,
      description: 'Track number in album',
    },
    trackCount: {
      type: 'number',
      optional: true,
      description: 'Total tracks in album',
    },
    discNumber: {
      type: 'number',
      optional: true,
      description: 'Disc number for multi-disc albums',
    },
    composer: {
      type: 'string',
      optional: true,
      description: 'Composer name',
    },
    publisher: {
      type: 'string',
      optional: true,
      description: 'Publisher or record label',
    },
    copyright: {
      type: 'string',
      optional: true,
      description: 'Copyright information',
    },
    isrc: {
      type: 'string',
      optional: true,
      description: 'International Standard Recording Code',
    },

    // Cover art
    coverArt: {
      type: 'url',
      optional: true,
      description: 'URL to album cover art',
    },

    // Recording metadata
    recordedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the audio was recorded',
    },

    // Organization
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    keywords: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Search keywords',
    },

    // Lyrics & transcription
    lyrics: {
      type: 'string',
      optional: true,
      description: 'Song lyrics',
    },
    hasLyrics: {
      type: 'boolean',
      optional: true,
      description: 'Whether lyrics are available',
    },
  },

  relationships: {
    library: {
      type: 'MediaLibrary',
      required: false,
      description: 'Media library containing this audio',
    },
    transcript: {
      type: 'Transcript',
      required: false,
      description: 'Transcription of the audio',
    },
    artist: {
      type: 'Contact',
      required: false,
      description: 'The artist or performer',
    },
  },

  actions: [
    'upload',
    'download',
    'play',
    'pause',
    'seek',
    'stop',
    'edit',
    'trim',
    'normalize',
    'fade',
    'merge',
    'split',
    'convert',
    'compress',
    'tag',
    'share',
    'delete',
    'restore',
    'duplicate',
    'transcribe',
    'addLyrics',
  ],

  events: [
    'uploaded',
    'downloaded',
    'played',
    'paused',
    'seeked',
    'stopped',
    'edited',
    'trimmed',
    'normalized',
    'faded',
    'merged',
    'split',
    'converted',
    'compressed',
    'tagged',
    'shared',
    'deleted',
    'restored',
    'duplicated',
    'transcribed',
    'lyricsAdded',
  ],
}

// =============================================================================
// Screenshot
// =============================================================================

/**
 * Screenshot capture entity
 *
 * Represents a screenshot with annotations and context
 */
export const Screenshot: Noun = {
  singular: 'screenshot',
  plural: 'screenshots',
  description: 'A screenshot capture with annotations and context',

  properties: {
    // Basic info
    filename: {
      type: 'string',
      description: 'Original filename',
    },
    url: {
      type: 'url',
      description: 'URL to access the screenshot',
    },
    title: {
      type: 'string',
      optional: true,
      description: 'Screenshot title or caption',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Description of what the screenshot shows',
    },

    // Format & dimensions
    format: {
      type: 'string',
      description: 'Image format: png, jpg, jpeg',
      examples: ['png', 'jpg', 'jpeg'],
    },
    width: {
      type: 'number',
      description: 'Width in pixels',
    },
    height: {
      type: 'number',
      description: 'Height in pixels',
    },

    // File properties
    size: {
      type: 'number',
      description: 'File size in bytes',
    },

    // Capture context
    capturedAt: {
      type: 'datetime',
      description: 'When the screenshot was taken',
    },
    source: {
      type: 'string',
      optional: true,
      description: 'Source application or window',
    },
    sourceUrl: {
      type: 'url',
      optional: true,
      description: 'URL if screenshot is of a webpage',
    },
    device: {
      type: 'string',
      optional: true,
      description: 'Device where screenshot was taken',
    },
    displayName: {
      type: 'string',
      optional: true,
      description: 'Display or monitor name',
    },

    // Capture type
    captureType: {
      type: 'string',
      optional: true,
      description: 'Capture type: fullscreen, window, region, scrolling',
      examples: ['fullscreen', 'window', 'region', 'scrolling'],
    },

    // Annotations
    hasAnnotations: {
      type: 'boolean',
      optional: true,
      description: 'Whether the screenshot has annotations',
    },
    annotations: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Annotations (arrows, text, shapes, highlights)',
    },

    // Organization
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for categorization',
    },
    keywords: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Search keywords',
    },

    // Thumbnail
    thumbnail: {
      type: 'url',
      optional: true,
      description: 'URL to thumbnail version',
    },

    // OCR & text extraction
    extractedText: {
      type: 'string',
      optional: true,
      description: 'Text extracted from screenshot via OCR',
    },
    hasText: {
      type: 'boolean',
      optional: true,
      description: 'Whether text was detected in the screenshot',
    },
  },

  relationships: {
    library: {
      type: 'MediaLibrary',
      required: false,
      description: 'Media library containing this screenshot',
    },
    capturedBy: {
      type: 'Contact',
      required: false,
      description: 'Person who took the screenshot',
    },
  },

  actions: [
    'capture',
    'upload',
    'download',
    'view',
    'edit',
    'annotate',
    'crop',
    'resize',
    'blur',
    'highlight',
    'addText',
    'addArrow',
    'addShape',
    'redact',
    'ocr',
    'tag',
    'share',
    'delete',
    'restore',
    'duplicate',
  ],

  events: [
    'captured',
    'uploaded',
    'downloaded',
    'viewed',
    'edited',
    'annotated',
    'cropped',
    'resized',
    'blurred',
    'highlighted',
    'textAdded',
    'arrowAdded',
    'shapeAdded',
    'redacted',
    'ocrProcessed',
    'tagged',
    'shared',
    'deleted',
    'restored',
    'duplicated',
  ],
}

// =============================================================================
// Album
// =============================================================================

/**
 * Album/collection entity
 *
 * Represents a collection of media items (images, videos)
 */
export const Album: Noun = {
  singular: 'album',
  plural: 'albums',
  description: 'A collection of media items (images, videos)',

  properties: {
    // Basic info
    name: {
      type: 'string',
      description: 'Album name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Album description',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly slug',
    },

    // Cover
    coverImage: {
      type: 'url',
      optional: true,
      description: 'URL to cover/thumbnail image',
    },

    // Counts
    itemCount: {
      type: 'number',
      optional: true,
      description: 'Number of items in the album',
    },
    imageCount: {
      type: 'number',
      optional: true,
      description: 'Number of images',
    },
    videoCount: {
      type: 'number',
      optional: true,
      description: 'Number of videos',
    },

    // Dates
    startDate: {
      type: 'datetime',
      optional: true,
      description: 'Start date for event/date range albums',
    },
    endDate: {
      type: 'datetime',
      optional: true,
      description: 'End date for event/date range albums',
    },

    // Organization
    albumType: {
      type: 'string',
      optional: true,
      description: 'Album type: manual, smart, event, date, location',
      examples: ['manual', 'smart', 'event', 'date', 'location'],
    },
    sortOrder: {
      type: 'string',
      optional: true,
      description: 'How items are sorted: date, name, manual',
      examples: ['date-asc', 'date-desc', 'name-asc', 'name-desc', 'manual'],
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Album tags',
    },

    // Smart album criteria
    smartCriteria: {
      type: 'json',
      optional: true,
      description: 'Criteria for smart/dynamic albums',
    },

    // Privacy & sharing
    visibility: {
      type: 'string',
      optional: true,
      description: 'Album visibility: private, shared, public',
      examples: ['private', 'shared', 'public'],
    },
    shareUrl: {
      type: 'url',
      optional: true,
      description: 'Public sharing URL',
    },
    password: {
      type: 'string',
      optional: true,
      description: 'Password for protected albums',
    },

    // Location
    location: {
      type: 'json',
      optional: true,
      description: 'Location associated with the album',
    },
  },

  relationships: {
    images: {
      type: 'Image[]',
      description: 'Images in this album',
    },
    videos: {
      type: 'Video[]',
      description: 'Videos in this album',
    },
    library: {
      type: 'MediaLibrary',
      required: false,
      description: 'Media library containing this album',
    },
    owner: {
      type: 'Contact',
      description: 'Album owner/creator',
    },
    collaborators: {
      type: 'Contact[]',
      description: 'People with access to the album',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'rename',
    'addMedia',
    'removeMedia',
    'reorder',
    'sort',
    'setCover',
    'share',
    'unshare',
    'export',
    'duplicate',
    'merge',
    'split',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'renamed',
    'mediaAdded',
    'mediaRemoved',
    'reordered',
    'sorted',
    'coverChanged',
    'shared',
    'unshared',
    'exported',
    'duplicated',
    'merged',
    'split',
  ],
}

// =============================================================================
// MediaLibrary
// =============================================================================

/**
 * Media library entity
 *
 * Represents a media asset management system/library
 */
export const MediaLibrary: Noun = {
  singular: 'media library',
  plural: 'media libraries',
  description: 'A media asset management system containing organized media',

  properties: {
    // Basic info
    name: {
      type: 'string',
      description: 'Library name',
    },
    description: {
      type: 'string',
      optional: true,
      description: 'Library description',
    },

    // Storage
    storageLocation: {
      type: 'string',
      optional: true,
      description: 'Storage location or path',
    },
    storageProvider: {
      type: 'string',
      optional: true,
      description: 'Storage provider: local, s3, cloudinary, cloudflare',
      examples: ['local', 's3', 'cloudinary', 'cloudflare', 'gcs', 'azure'],
    },

    // Statistics
    totalItems: {
      type: 'number',
      optional: true,
      description: 'Total number of media items',
    },
    totalImages: {
      type: 'number',
      optional: true,
      description: 'Total number of images',
    },
    totalVideos: {
      type: 'number',
      optional: true,
      description: 'Total number of videos',
    },
    totalAudio: {
      type: 'number',
      optional: true,
      description: 'Total number of audio files',
    },
    totalSize: {
      type: 'number',
      optional: true,
      description: 'Total storage size in bytes',
    },
    albumCount: {
      type: 'number',
      optional: true,
      description: 'Number of albums',
    },

    // Organization
    organizationType: {
      type: 'string',
      optional: true,
      description: 'How media is organized: folders, tags, albums, flat',
      examples: ['folders', 'tags', 'albums', 'flat', 'hybrid'],
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Available tags in the library',
    },

    // Settings
    autoTag: {
      type: 'boolean',
      optional: true,
      description: 'Whether to automatically tag media',
    },
    autoOrganize: {
      type: 'boolean',
      optional: true,
      description: 'Whether to automatically organize media',
    },
    duplicateDetection: {
      type: 'boolean',
      optional: true,
      description: 'Whether to detect duplicate files',
    },
    faceRecognition: {
      type: 'boolean',
      optional: true,
      description: 'Whether face recognition is enabled',
    },

    // Access control
    visibility: {
      type: 'string',
      optional: true,
      description: 'Library visibility: private, team, public',
      examples: ['private', 'team', 'public'],
    },
  },

  relationships: {
    images: {
      type: 'Image[]',
      description: 'Images in this library',
    },
    videos: {
      type: 'Video[]',
      description: 'Videos in this library',
    },
    audio: {
      type: 'Audio[]',
      description: 'Audio files in this library',
    },
    albums: {
      type: 'Album[]',
      description: 'Albums in this library',
    },
    owner: {
      type: 'Contact',
      description: 'Library owner',
    },
    members: {
      type: 'Contact[]',
      description: 'People with access to the library',
    },
  },

  actions: [
    'create',
    'configure',
    'import',
    'export',
    'scan',
    'index',
    'search',
    'backup',
    'restore',
    'optimize',
    'deduplicate',
    'share',
    'archive',
    'delete',
  ],

  events: [
    'created',
    'configured',
    'imported',
    'exported',
    'scanned',
    'indexed',
    'searched',
    'backedUp',
    'restored',
    'optimized',
    'deduplicated',
    'shared',
    'archived',
    'deleted',
  ],
}

// =============================================================================
// Transcript
// =============================================================================

/**
 * Transcript entity
 *
 * Represents a transcription of audio or video content
 */
export const Transcript: Noun = {
  singular: 'transcript',
  plural: 'transcripts',
  description: 'A transcription of audio or video content',

  properties: {
    // Basic info
    text: {
      type: 'string',
      description: 'Full transcript text',
    },
    title: {
      type: 'string',
      optional: true,
      description: 'Transcript title',
    },

    // Format
    format: {
      type: 'string',
      optional: true,
      description: 'Transcript format: plain, srt, vtt, json',
      examples: ['plain', 'srt', 'vtt', 'json'],
    },

    // Language
    language: {
      type: 'string',
      description: 'Language code (e.g., en, es, fr)',
    },
    languageName: {
      type: 'string',
      optional: true,
      description: 'Language name (e.g., English, Spanish)',
    },

    // Timing
    duration: {
      type: 'number',
      optional: true,
      description: 'Duration of the transcribed content in seconds',
    },

    // Segments
    segments: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Timed segments with start, end, and text',
    },
    wordTimestamps: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Word-level timestamps',
    },

    // Speaker identification
    hasSpeakers: {
      type: 'boolean',
      optional: true,
      description: 'Whether speakers are identified',
    },
    speakers: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Speaker labels and segments',
    },
    speakerCount: {
      type: 'number',
      optional: true,
      description: 'Number of distinct speakers',
    },

    // Quality & confidence
    confidence: {
      type: 'number',
      optional: true,
      description: 'Overall transcription confidence score (0-1)',
    },
    quality: {
      type: 'string',
      optional: true,
      description: 'Transcript quality: low, medium, high',
      examples: ['low', 'medium', 'high'],
    },

    // Processing
    status: {
      type: 'string',
      optional: true,
      description: 'Processing status: pending, processing, completed, error',
      examples: ['pending', 'processing', 'completed', 'error'],
    },
    provider: {
      type: 'string',
      optional: true,
      description: 'Transcription provider: whisper, deepgram, rev, etc',
      examples: ['whisper', 'deepgram', 'assemblyai', 'rev', 'manual'],
    },
    method: {
      type: 'string',
      optional: true,
      description: 'Transcription method: automatic, manual, hybrid',
      examples: ['automatic', 'manual', 'hybrid'],
    },

    // Metadata
    wordCount: {
      type: 'number',
      optional: true,
      description: 'Total word count',
    },
    edited: {
      type: 'boolean',
      optional: true,
      description: 'Whether the transcript has been edited',
    },
  },

  relationships: {
    video: {
      type: 'Video',
      required: false,
      description: 'Video this is a transcript of',
    },
    audio: {
      type: 'Audio',
      required: false,
      description: 'Audio this is a transcript of',
    },
    editor: {
      type: 'Contact',
      required: false,
      description: 'Person who edited the transcript',
    },
  },

  actions: [
    'generate',
    'edit',
    'format',
    'export',
    'search',
    'translate',
    'identify',
    'timestamp',
    'sync',
    'review',
    'approve',
    'delete',
  ],

  events: [
    'generated',
    'edited',
    'formatted',
    'exported',
    'searched',
    'translated',
    'identified',
    'timestamped',
    'synced',
    'reviewed',
    'approved',
    'deleted',
    'processingStarted',
    'processingCompleted',
    'processingFailed',
  ],
}

// =============================================================================
// Caption
// =============================================================================

/**
 * Caption/subtitle entity
 *
 * Represents captions or subtitles for video content
 */
export const Caption: Noun = {
  singular: 'caption',
  plural: 'captions',
  description: 'Captions or subtitles for video content',

  properties: {
    // Basic info
    label: {
      type: 'string',
      description: 'Caption track label (e.g., English, Spanish, English CC)',
    },

    // Language
    language: {
      type: 'string',
      description: 'Language code (e.g., en, es, fr)',
    },
    languageName: {
      type: 'string',
      optional: true,
      description: 'Language name (e.g., English, Spanish)',
    },

    // Type
    kind: {
      type: 'string',
      description: 'Caption kind: subtitles, captions, descriptions',
      examples: ['subtitles', 'captions', 'descriptions'],
    },
    closedCaptions: {
      type: 'boolean',
      optional: true,
      description: 'Whether these are closed captions (CC)',
    },
    sdh: {
      type: 'boolean',
      optional: true,
      description: 'Whether these are SDH (Subtitles for Deaf and Hard of hearing)',
    },

    // Format
    format: {
      type: 'string',
      description: 'Caption format: vtt, srt, ass, scc',
      examples: ['vtt', 'srt', 'ass', 'scc', 'dfxp', 'ttml'],
    },
    url: {
      type: 'url',
      optional: true,
      description: 'URL to the caption file',
    },

    // Content
    content: {
      type: 'string',
      optional: true,
      description: 'Raw caption content',
    },
    cues: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Caption cues with timing and text',
    },

    // Processing
    status: {
      type: 'string',
      optional: true,
      description: 'Processing status: pending, processing, ready, error',
      examples: ['pending', 'processing', 'ready', 'error'],
    },
    provider: {
      type: 'string',
      optional: true,
      description: 'Caption generation provider',
    },
    method: {
      type: 'string',
      optional: true,
      description: 'Caption method: automatic, manual, hybrid',
      examples: ['automatic', 'manual', 'hybrid'],
    },

    // Settings
    default: {
      type: 'boolean',
      optional: true,
      description: 'Whether this is the default caption track',
    },
    autoGenerated: {
      type: 'boolean',
      optional: true,
      description: 'Whether these captions were auto-generated',
    },
    edited: {
      type: 'boolean',
      optional: true,
      description: 'Whether the captions have been edited',
    },

    // Metadata
    cueCount: {
      type: 'number',
      optional: true,
      description: 'Number of caption cues',
    },
  },

  relationships: {
    video: {
      type: 'Video',
      description: 'Video these captions belong to',
    },
    transcript: {
      type: 'Transcript',
      required: false,
      description: 'Source transcript',
    },
    editor: {
      type: 'Contact',
      required: false,
      description: 'Person who edited the captions',
    },
  },

  actions: [
    'generate',
    'upload',
    'download',
    'edit',
    'sync',
    'translate',
    'export',
    'validate',
    'preview',
    'delete',
    'setDefault',
  ],

  events: [
    'generated',
    'uploaded',
    'downloaded',
    'edited',
    'synced',
    'translated',
    'exported',
    'validated',
    'previewed',
    'deleted',
    'setAsDefault',
    'processingStarted',
    'processingCompleted',
    'processingFailed',
  ],
}

// =============================================================================
// Export all entities as a collection
// =============================================================================

/**
 * All media entity types
 */
export const MediaEntities = {
  Image,
  Video,
  Audio,
  Screenshot,
  Album,
  MediaLibrary,
  Transcript,
  Caption,
}

/**
 * Entity categories for organization
 */
export const MediaCategories = {
  visual: ['Image', 'Video', 'Screenshot'],
  audio: ['Audio'],
  collections: ['Album', 'MediaLibrary'],
  text: ['Transcript', 'Caption'],
} as const
