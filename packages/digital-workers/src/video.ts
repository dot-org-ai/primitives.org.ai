/**
 * Video generation functionality for digital workers
 *
 * This module provides video generation within a worker context,
 * supporting various AI video generation models (Runway, Pika, etc.)
 * with rich metadata about the generation process.
 *
 * @module
 */

// ============================================================================
// Video Types
// ============================================================================

/**
 * Video resolution options
 */
export type VideoResolution = '480p' | '720p' | '1080p' | '4k'

/**
 * Video aspect ratio options
 */
export type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '21:9'

/**
 * Supported video generation models
 */
export type VideoModel =
  | 'runway-gen3'
  | 'runway-gen2'
  | 'pika-1.0'
  | 'pika-1.5'
  | 'stable-video'
  | 'minimax'
  | 'kling'
  | 'luma'
  | string

/**
 * Video style presets
 */
export type VideoStyle =
  | 'cinematic'
  | 'anime'
  | 'realistic'
  | 'cartoon'
  | 'documentary'
  | 'vintage'
  | 'noir'
  | 'fantasy'
  | 'sci-fi'
  | string

/**
 * Options for video generation
 */
export interface VideoOptions {
  /** Text prompt describing the video to generate */
  prompt: string
  /** Video duration in seconds (default: 4) */
  duration?: number
  /** Frames per second (default: 24) */
  fps?: number
  /** Video resolution (default: '1080p') */
  resolution?: VideoResolution
  /** Aspect ratio (default: '16:9') */
  aspectRatio?: VideoAspectRatio
  /** Visual style preset */
  style?: VideoStyle
  /** AI model to use */
  model?: VideoModel
  /** Negative prompt - what to avoid */
  negativePrompt?: string
  /** Guidance scale for generation (1-20) */
  guidance?: number
  /** Random seed for reproducibility */
  seed?: number
  /** Camera motion type */
  motion?: 'static' | 'pan' | 'zoom' | 'orbit' | 'dolly' | 'handheld'
  /** Motion intensity (0-1) */
  motionIntensity?: number
  /** Whether to loop the video */
  loop?: boolean
  /** Additional model-specific parameters */
  modelParams?: Record<string, unknown>
}

/**
 * Metadata about the generated video
 */
export interface VideoMetadata {
  /** Model used for generation */
  model: string
  /** Video duration in seconds */
  duration: number
  /** Video resolution */
  resolution: string
  /** Frames per second */
  fps: number
  /** Aspect ratio */
  aspectRatio: string
  /** Generation time in milliseconds */
  generationTime: number
  /** File size in bytes (if available) */
  fileSize?: number
  /** Video format */
  format?: string
  /** Style applied */
  style?: string
  /** Seed used for generation */
  seed?: number
  /** Cost in credits/tokens (if applicable) */
  cost?: number
}

/**
 * Result of video generation
 */
export interface VideoResult {
  /** URL of the generated video */
  url: string
  /** Original prompt used */
  prompt: string
  /** Generation metadata */
  metadata: VideoMetadata
  /** Thumbnail URL (if available) */
  thumbnail?: string
  /** Preview GIF URL (if available) */
  preview?: string
  /** Status of generation */
  status: 'completed' | 'processing' | 'failed'
  /** Error message if failed */
  error?: string
}

/**
 * Options for video-from-image generation
 */
export interface VideoFromImageOptions extends Omit<VideoOptions, 'prompt'> {
  /** Source image URL */
  imageUrl: string
  /** Text prompt describing the desired motion/animation */
  prompt: string
  /** How much the image can change (0-1) */
  imageFidelity?: number
}

/**
 * Options for video extension
 */
export interface VideoExtendOptions {
  /** Source video URL */
  videoUrl: string
  /** Additional duration in seconds to add */
  duration: number
  /** Prompt for the extension (optional) */
  prompt?: string
  /** Direction to extend: beginning or end */
  direction?: 'forward' | 'backward'
  /** Overlap frames for smoother transition */
  overlap?: number
}

/**
 * Options for video editing
 */
export interface VideoEditOptions {
  /** Source video URL */
  videoUrl: string
  /** Edit prompt describing changes */
  prompt: string
  /** Specific region to edit (if supported) */
  region?: {
    x: number
    y: number
    width: number
    height: number
  }
  /** Mask image URL for selective editing */
  maskUrl?: string
  /** Edit strength (0-1) */
  strength?: number
  /** Preserve audio from original */
  preserveAudio?: boolean
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build metadata object, only including defined optional fields
 */
function buildMetadata(
  model: string,
  duration: number,
  resolution: string,
  fps: number,
  aspectRatio: string,
  generationTime: number,
  optionals: {
    fileSize?: number
    format?: string
    style?: string
    seed?: number
    cost?: number
  } = {}
): VideoMetadata {
  const metadata: VideoMetadata = {
    model,
    duration,
    resolution,
    fps,
    aspectRatio,
    generationTime,
  }

  if (optionals.fileSize !== undefined) metadata.fileSize = optionals.fileSize
  if (optionals.format !== undefined) metadata.format = optionals.format
  if (optionals.style !== undefined) metadata.style = optionals.style
  if (optionals.seed !== undefined) metadata.seed = optionals.seed
  if (optionals.cost !== undefined) metadata.cost = optionals.cost

  return metadata
}

/**
 * Resolve the worker URL for video generation based on model
 */
function resolveVideoWorkerUrl(model: string): string {
  // Map models to their respective worker endpoints
  const workerMap: Record<string, string> = {
    'runway-gen3': 'https://video.workers.do/runway/gen3',
    'runway-gen2': 'https://video.workers.do/runway/gen2',
    'pika-1.0': 'https://video.workers.do/pika/1.0',
    'pika-1.5': 'https://video.workers.do/pika/1.5',
    'stable-video': 'https://video.workers.do/stability/svd',
    minimax: 'https://video.workers.do/minimax',
    kling: 'https://video.workers.do/kling',
    luma: 'https://video.workers.do/luma',
  }

  // Check for custom endpoint in environment
  const customEndpoint =
    typeof globalThis !== 'undefined' && 'process' in globalThis
      ? (globalThis as { process?: { env?: Record<string, string> } }).process?.env?.[
          'VIDEO_WORKER_URL'
        ]
      : undefined

  if (customEndpoint) {
    return customEndpoint
  }

  return workerMap[model] || `https://video.workers.do/${model}`
}

// ============================================================================
// Video Generation Function
// ============================================================================

/**
 * Generate a video from a text prompt.
 *
 * Creates AI-generated video content using models like Runway, Pika,
 * Stable Video, and others. Returns the video URL with rich metadata
 * about the generation process.
 *
 * @param prompt - Text description of the video to generate
 * @param options - Generation options (duration, fps, resolution, model, etc.)
 * @returns Promise resolving to VideoResult with URL and metadata
 *
 * @example
 * ```ts
 * // Basic video generation
 * const result = await video('A serene mountain lake at sunset with gentle ripples')
 * console.log(result.url) // URL of generated video
 * console.log(result.metadata.duration) // Video duration in seconds
 * ```
 *
 * @example
 * ```ts
 * // With options
 * const result = await video('A futuristic city with flying cars', {
 *   duration: 8,
 *   resolution: '4k',
 *   style: 'cinematic',
 *   model: 'runway-gen3',
 *   motion: 'dolly',
 * })
 * ```
 *
 * @example
 * ```ts
 * // With negative prompt
 * const result = await video('A happy golden retriever playing in a park', {
 *   negativePrompt: 'blurry, distorted, extra limbs',
 *   guidance: 12,
 * })
 * ```
 */
export async function video(
  prompt: string,
  options: Partial<VideoOptions> = {}
): Promise<VideoResult> {
  const {
    duration = 4,
    fps = 24,
    resolution = '1080p',
    aspectRatio = '16:9',
    style,
    model = 'runway-gen3',
    negativePrompt,
    guidance,
    seed,
    motion,
    motionIntensity,
    loop,
    modelParams,
  } = options

  const startTime = Date.now()

  // Build the worker URL for video generation
  const workerUrl = resolveVideoWorkerUrl(model)

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        duration,
        fps,
        resolution,
        aspectRatio,
        style,
        model,
        negativePrompt,
        guidance,
        seed,
        motion,
        motionIntensity,
        loop,
        ...modelParams,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Video generation failed: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as {
      url: string
      thumbnail?: string
      preview?: string
      fileSize?: number
      format?: string
      seed?: number
      cost?: number
    }

    const optionals: {
      fileSize?: number
      format?: string
      style?: string
      seed?: number
      cost?: number
    } = {
      format: data.format || 'mp4',
    }

    if (data.fileSize !== undefined) optionals.fileSize = data.fileSize
    if (style !== undefined) optionals.style = style
    if (data.seed !== undefined) optionals.seed = data.seed
    else if (seed !== undefined) optionals.seed = seed
    if (data.cost !== undefined) optionals.cost = data.cost

    const result: VideoResult = {
      url: data.url,
      prompt,
      metadata: buildMetadata(
        model,
        duration,
        resolution,
        fps,
        aspectRatio,
        Date.now() - startTime,
        optionals
      ),
      status: 'completed',
    }

    if (data.thumbnail) result.thumbnail = data.thumbnail
    if (data.preview) result.preview = data.preview

    return result
  } catch (error) {
    const result: VideoResult = {
      url: '',
      prompt,
      metadata: buildMetadata(
        model,
        duration,
        resolution,
        fps,
        aspectRatio,
        Date.now() - startTime
      ),
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }

    return result
  }
}

// ============================================================================
// Helper Methods
// ============================================================================

/**
 * Generate a video from a static image.
 *
 * Animates a source image based on a motion prompt, bringing still
 * images to life with AI-generated animation.
 *
 * @param imageUrl - URL of the source image
 * @param prompt - Text description of the desired motion/animation
 * @param options - Additional generation options
 * @returns Promise resolving to VideoResult
 *
 * @example
 * ```ts
 * const result = await video.fromImage(
 *   'https://example.com/landscape.jpg',
 *   'Camera slowly pans across the scene, clouds drift by',
 *   { duration: 6, imageFidelity: 0.8 }
 * )
 * ```
 */
video.fromImage = async function fromImage(
  imageUrl: string,
  prompt: string,
  options: Partial<Omit<VideoFromImageOptions, 'imageUrl' | 'prompt'>> = {}
): Promise<VideoResult> {
  const {
    duration = 4,
    fps = 24,
    resolution = '1080p',
    aspectRatio = '16:9',
    style,
    model = 'runway-gen3',
    imageFidelity = 0.7,
    motion,
    motionIntensity,
  } = options

  const startTime = Date.now()
  const workerUrl = resolveVideoWorkerUrl(model)

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'image-to-video',
        imageUrl,
        prompt,
        duration,
        fps,
        resolution,
        aspectRatio,
        style,
        model,
        imageFidelity,
        motion,
        motionIntensity,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Image-to-video generation failed: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as {
      url: string
      thumbnail?: string
      preview?: string
      fileSize?: number
      format?: string
      seed?: number
      cost?: number
    }

    const optionals: {
      fileSize?: number
      format?: string
      style?: string
      seed?: number
      cost?: number
    } = {
      format: data.format || 'mp4',
    }

    if (data.fileSize !== undefined) optionals.fileSize = data.fileSize
    if (style !== undefined) optionals.style = style
    if (data.seed !== undefined) optionals.seed = data.seed
    if (data.cost !== undefined) optionals.cost = data.cost

    const result: VideoResult = {
      url: data.url,
      prompt,
      metadata: buildMetadata(
        model,
        duration,
        resolution,
        fps,
        aspectRatio,
        Date.now() - startTime,
        optionals
      ),
      status: 'completed',
    }

    if (data.thumbnail) result.thumbnail = data.thumbnail
    if (data.preview) result.preview = data.preview

    return result
  } catch (error) {
    return {
      url: '',
      prompt,
      metadata: buildMetadata(
        model,
        duration,
        resolution,
        fps,
        aspectRatio,
        Date.now() - startTime
      ),
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Extend an existing video by generating additional frames.
 *
 * Continues a video seamlessly by generating new content that
 * matches the style and content of the original.
 *
 * @param videoUrl - URL of the source video
 * @param duration - Additional duration in seconds to add
 * @param options - Extension options
 * @returns Promise resolving to VideoResult with extended video
 *
 * @example
 * ```ts
 * // Extend video by 4 more seconds
 * const result = await video.extend(
 *   'https://example.com/short-clip.mp4',
 *   4
 * )
 * ```
 *
 * @example
 * ```ts
 * // Extend with a prompt hint
 * const result = await video.extend(
 *   'https://example.com/scene.mp4',
 *   6,
 *   { prompt: 'The character turns and walks away', direction: 'forward' }
 * )
 * ```
 */
video.extend = async function extend(
  videoUrl: string,
  duration: number,
  options: Partial<Omit<VideoExtendOptions, 'videoUrl' | 'duration'>> = {}
): Promise<VideoResult> {
  const { prompt, direction = 'forward', overlap = 4 } = options

  const startTime = Date.now()
  const workerUrl = resolveVideoWorkerUrl('runway-gen3')

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'extend',
        videoUrl,
        duration,
        prompt,
        direction,
        overlap,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Video extension failed: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as {
      url: string
      thumbnail?: string
      preview?: string
      fileSize?: number
      format?: string
      totalDuration?: number
      cost?: number
    }

    const resultPrompt = prompt || 'Extended video'
    const optionals: {
      fileSize?: number
      format?: string
      style?: string
      seed?: number
      cost?: number
    } = {
      format: data.format || 'mp4',
    }

    if (data.fileSize !== undefined) optionals.fileSize = data.fileSize
    if (data.cost !== undefined) optionals.cost = data.cost

    const result: VideoResult = {
      url: data.url,
      prompt: resultPrompt,
      metadata: buildMetadata(
        'runway-gen3',
        data.totalDuration || duration,
        '1080p',
        24,
        '16:9',
        Date.now() - startTime,
        optionals
      ),
      status: 'completed',
    }

    if (data.thumbnail) result.thumbnail = data.thumbnail
    if (data.preview) result.preview = data.preview

    return result
  } catch (error) {
    return {
      url: '',
      prompt: prompt || 'Extended video',
      metadata: buildMetadata('runway-gen3', duration, '1080p', 24, '16:9', Date.now() - startTime),
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Edit an existing video using AI.
 *
 * Modifies a video based on a text prompt, allowing for
 * style changes, object removal/addition, and other edits.
 *
 * @param videoUrl - URL of the video to edit
 * @param prompt - Text description of the desired edits
 * @param options - Edit options
 * @returns Promise resolving to VideoResult with edited video
 *
 * @example
 * ```ts
 * // Change the style of a video
 * const result = await video.edit(
 *   'https://example.com/original.mp4',
 *   'Make it look like a vintage 1970s film'
 * )
 * ```
 *
 * @example
 * ```ts
 * // Edit with mask
 * const result = await video.edit(
 *   'https://example.com/scene.mp4',
 *   'Replace the car with a spaceship',
 *   { maskUrl: 'https://example.com/car-mask.png', strength: 0.9 }
 * )
 * ```
 */
video.edit = async function edit(
  videoUrl: string,
  prompt: string,
  options: Partial<Omit<VideoEditOptions, 'videoUrl' | 'prompt'>> = {}
): Promise<VideoResult> {
  const { region, maskUrl, strength = 0.7, preserveAudio = true } = options

  const startTime = Date.now()
  const workerUrl = resolveVideoWorkerUrl('runway-gen3')

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: 'edit',
        videoUrl,
        prompt,
        region,
        maskUrl,
        strength,
        preserveAudio,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Video editing failed: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as {
      url: string
      thumbnail?: string
      preview?: string
      fileSize?: number
      format?: string
      duration?: number
      cost?: number
    }

    const optionals: {
      fileSize?: number
      format?: string
      style?: string
      seed?: number
      cost?: number
    } = {
      format: data.format || 'mp4',
    }

    if (data.fileSize !== undefined) optionals.fileSize = data.fileSize
    if (data.cost !== undefined) optionals.cost = data.cost

    const result: VideoResult = {
      url: data.url,
      prompt,
      metadata: buildMetadata(
        'runway-gen3',
        data.duration || 4,
        '1080p',
        24,
        '16:9',
        Date.now() - startTime,
        optionals
      ),
      status: 'completed',
    }

    if (data.thumbnail) result.thumbnail = data.thumbnail
    if (data.preview) result.preview = data.preview

    return result
  } catch (error) {
    return {
      url: '',
      prompt,
      metadata: buildMetadata('runway-gen3', 4, '1080p', 24, '16:9', Date.now() - startTime),
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Create a video generator with a preset style.
 *
 * Returns a function that generates videos with the specified
 * style pre-applied. Useful for maintaining consistent aesthetics.
 *
 * @param style - Style preset to apply to all generated videos
 * @returns Function that generates styled videos
 *
 * @example
 * ```ts
 * // Create a cinematic video generator
 * const cinematicVideo = video.style('cinematic')
 *
 * const result1 = await cinematicVideo('A dramatic sunset over the ocean')
 * const result2 = await cinematicVideo('A hero walking into the distance')
 * // Both will have cinematic style applied
 * ```
 *
 * @example
 * ```ts
 * // Chain with other options
 * const animeVideo = video.style('anime')
 * const result = await animeVideo('A magical girl transformation sequence', {
 *   duration: 8,
 *   resolution: '4k',
 * })
 * ```
 */
video.style = function style(stylePreset: VideoStyle) {
  return function styledVideo(
    prompt: string,
    options: Partial<Omit<VideoOptions, 'style'>> = {}
  ): Promise<VideoResult> {
    return video(prompt, { ...options, style: stylePreset })
  }
}

/**
 * Generate multiple video variations from the same prompt.
 *
 * @param prompt - Text description of the video
 * @param count - Number of variations to generate
 * @param options - Generation options
 * @returns Promise resolving to array of VideoResults
 *
 * @example
 * ```ts
 * const variations = await video.variations(
 *   'A cat playing with a ball of yarn',
 *   3,
 *   { duration: 4 }
 * )
 *
 * variations.forEach((v, i) => {
 *   console.log(`Variation ${i + 1}: ${v.url}`)
 * })
 * ```
 */
video.variations = async function variations(
  prompt: string,
  count: number,
  options: Partial<VideoOptions> = {}
): Promise<VideoResult[]> {
  const results = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      video(prompt, {
        ...options,
        // Use different seeds for variations
        seed:
          options.seed !== undefined ? options.seed + i : Math.floor(Math.random() * 1000000) + i,
      })
    )
  )
  return results
}

/**
 * Generate video with specific camera motion.
 *
 * @param prompt - Text description of the scene
 * @param motion - Camera motion type
 * @param options - Additional generation options
 * @returns Promise resolving to VideoResult
 *
 * @example
 * ```ts
 * const result = await video.withMotion(
 *   'A beautiful landscape',
 *   'dolly',
 *   { motionIntensity: 0.5 }
 * )
 * ```
 */
video.withMotion = async function withMotion(
  prompt: string,
  motion: 'static' | 'pan' | 'zoom' | 'orbit' | 'dolly' | 'handheld',
  options: Partial<Omit<VideoOptions, 'motion'>> = {}
): Promise<VideoResult> {
  return video(prompt, { ...options, motion })
}

/**
 * Generate a looping video (perfect for backgrounds, GIFs).
 *
 * @param prompt - Text description of the video
 * @param options - Generation options
 * @returns Promise resolving to VideoResult with looping video
 *
 * @example
 * ```ts
 * const result = await video.loop(
 *   'Gently swaying grass in the wind',
 *   { duration: 3 }
 * )
 * ```
 */
video.loop = async function loop(
  prompt: string,
  options: Partial<Omit<VideoOptions, 'loop'>> = {}
): Promise<VideoResult> {
  return video(prompt, { ...options, loop: true })
}
