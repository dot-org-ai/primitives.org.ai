/**
 * Image generation functionality for digital workers
 *
 * This module provides image generation primitives within a worker context,
 * with rich metadata about the generation process.
 *
 * - `image()` - Generates images with full metadata (model, size, style)
 * - `image.variations()` - Creates variations of an existing image
 * - `image.edit()` - Edits an image with a text prompt and optional mask
 * - `image.upscale()` - Upscales an image to higher resolution
 * - `image.style()` - Creates a curried function for a specific style
 *
 * The key difference from direct API calls is context and metadata:
 * - digital-workers returns `ImageResult` with content + metadata
 * - Direct API calls return just the generated image
 *
 * @module
 */

/**
 * Available image style presets
 */
export type ImageStyle =
  | 'realistic'
  | 'artistic'
  | 'cartoon'
  | 'abstract'
  | 'photographic'
  | 'digital-art'
  | 'cinematic'

/**
 * Available image sizes
 */
export type ImageSize = '256x256' | '512x512' | '1024x1024' | '1024x1792' | '1792x1024'

/**
 * Available image formats
 */
export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'b64_json' | 'url'

/**
 * Options for image generation
 */
export interface ImageOptions {
  /** The prompt describing the image to generate */
  prompt: string
  /** The style preset to apply */
  style?: ImageStyle
  /** The size of the generated image */
  size?: ImageSize
  /** The model to use for generation */
  model?: string
  /** Number of images to generate (1-10) */
  n?: number
  /** Output format */
  format?: ImageFormat
  /** Quality setting */
  quality?: 'standard' | 'hd'
  /** Negative prompt - what to avoid in the image */
  negativePrompt?: string
  /** Seed for reproducible generation */
  seed?: number
  /** Additional model-specific parameters */
  parameters?: Record<string, unknown>
}

/**
 * Result of image generation
 */
export interface ImageResult {
  /** URL or base64 data of the generated image */
  url: string
  /** The original prompt */
  prompt: string
  /** The revised/enhanced prompt if the model modified it */
  revisedPrompt?: string
  /** Generation metadata */
  metadata: {
    /** Model used for generation */
    model: string
    /** Size of the generated image */
    size: string
    /** Style applied */
    style?: string
    /** Generation duration in milliseconds */
    duration?: number
    /** Seed used for generation */
    seed?: number
    /** Format of the output */
    format?: ImageFormat
    /** Quality setting used */
    quality?: string
    /** Provider-specific metadata */
    provider?: Record<string, unknown>
  }
}

/**
 * Options for image variations
 */
export interface VariationOptions {
  /** Number of variations to generate */
  count?: number
  /** Size of the generated variations */
  size?: ImageSize
  /** Model to use for generation */
  model?: string
  /** Output format */
  format?: ImageFormat
}

/**
 * Options for image editing
 */
export interface EditOptions {
  /** The prompt describing the edit */
  prompt: string
  /** URL or base64 of the mask image (transparent areas will be edited) */
  mask?: string
  /** Size of the output image */
  size?: ImageSize
  /** Model to use for editing */
  model?: string
  /** Number of edits to generate */
  n?: number
  /** Output format */
  format?: ImageFormat
}

/**
 * Options for image upscaling
 */
export interface UpscaleOptions {
  /** Scale factor (2, 4, etc.) */
  scale?: number
  /** Model to use for upscaling */
  model?: string
  /** Output format */
  format?: ImageFormat
  /** Denoise level (0-1) */
  denoise?: number
}

/**
 * Result of image upscaling
 */
export interface UpscaleResult extends ImageResult {
  /** Original image dimensions */
  originalSize: {
    width: number
    height: number
  }
  /** Upscaled image dimensions */
  upscaledSize: {
    width: number
    height: number
  }
  /** Scale factor used */
  scaleFactor: number
}

/**
 * Style preset configurations
 */
const STYLE_PROMPTS: Record<ImageStyle, string> = {
  realistic: 'photorealistic, highly detailed, natural lighting, 8k resolution',
  artistic: 'artistic interpretation, painterly style, creative composition',
  cartoon: 'cartoon style, cel-shaded, vibrant colors, animated look',
  abstract: 'abstract art, non-representational, geometric shapes, modern art',
  photographic: 'professional photography, DSLR quality, sharp focus, studio lighting',
  'digital-art': 'digital art, concept art, detailed illustration, artstation trending',
  cinematic: 'cinematic composition, dramatic lighting, movie scene, film grain',
}

/**
 * Default configuration
 */
const DEFAULTS = {
  model: 'dall-e-3',
  size: '1024x1024' as ImageSize,
  format: 'url' as ImageFormat,
  quality: 'standard' as const,
  n: 1,
}

// Declare process for environments where it exists (Node.js)
declare const process: { env?: Record<string, string | undefined> } | undefined

/**
 * Get environment variable safely (works in both Node.js and Workers)
 */
function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[key]
  }
  return undefined
}

/**
 * Get the image generation endpoint based on model
 */
function getImageEndpoint(model: string): string {
  // Route to appropriate worker based on model
  const baseUrl =
    getEnv('AI_GATEWAY_URL') || getEnv('IMAGE_GATEWAY_URL') || 'https://image.workers.do'

  if (model.startsWith('dall-e') || model.startsWith('openai/')) {
    return `${baseUrl}/openai/images/generations`
  }

  if (model.startsWith('stable-diffusion') || model.startsWith('stability/')) {
    return `${baseUrl}/stability/images/generations`
  }

  if (model.startsWith('flux') || model.startsWith('black-forest/')) {
    return `${baseUrl}/flux/images/generations`
  }

  if (model.startsWith('midjourney/')) {
    return `${baseUrl}/midjourney/images/generations`
  }

  // Default to generic endpoint
  return `${baseUrl}/images/generations`
}

/**
 * Get authorization headers
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {}

  const openaiKey = getEnv('OPENAI_API_KEY')
  if (openaiKey) {
    headers['Authorization'] = `Bearer ${openaiKey}`
  }

  const gatewayToken = getEnv('AI_GATEWAY_TOKEN')
  if (gatewayToken) {
    headers['X-Gateway-Token'] = gatewayToken
  }

  return headers
}

/**
 * Enhance prompt with style modifiers
 */
function enhancePrompt(prompt: string, style?: ImageStyle): string {
  if (!style || !STYLE_PROMPTS[style]) {
    return prompt
  }
  return `${prompt}, ${STYLE_PROMPTS[style]}`
}

/**
 * Convert base64 data URL to Blob
 */
function base64ToBlob(dataUrl: string): Blob {
  const base64Data = dataUrl.split(',')[1]
  if (!base64Data) {
    throw new Error('Invalid data URL format')
  }
  const binaryData = atob(base64Data)
  const bytes = new Uint8Array(binaryData.length)
  for (let i = 0; i < binaryData.length; i++) {
    bytes[i] = binaryData.charCodeAt(i)
  }
  return new Blob([bytes], { type: 'image/png' })
}

/**
 * Generate an image from a text prompt
 *
 * @param prompt - The text prompt describing the image to generate
 * @param options - Generation options (style, size, model, etc.)
 * @returns Promise resolving to ImageResult with URL and metadata
 *
 * @example
 * ```ts
 * // Generate a simple image
 * const result = await image('A sunset over mountains')
 * console.log(result.url) // URL to the generated image
 * console.log(result.metadata.model) // Model used
 * ```
 *
 * @example
 * ```ts
 * // Generate with options
 * const result = await image('A portrait of a robot', {
 *   style: 'cinematic',
 *   size: '1024x1024',
 *   quality: 'hd',
 * })
 * ```
 *
 * @example
 * ```ts
 * // Generate multiple images
 * const result = await image('Abstract patterns', {
 *   style: 'abstract',
 *   n: 4,
 * })
 * ```
 */
export async function image(
  prompt: string,
  options: Partial<ImageOptions> = {}
): Promise<ImageResult> {
  const startTime = Date.now()

  const {
    style,
    size = DEFAULTS.size,
    model = DEFAULTS.model,
    n = DEFAULTS.n,
    format = DEFAULTS.format,
    quality = DEFAULTS.quality,
    negativePrompt,
    seed,
    parameters = {},
  } = options

  const enhancedPrompt = enhancePrompt(prompt, style)
  const endpoint = getImageEndpoint(model)

  // Build the request payload
  const payload: Record<string, unknown> = {
    prompt: enhancedPrompt,
    size,
    n,
    response_format: format === 'url' ? 'url' : format === 'b64_json' ? 'b64_json' : 'url',
    ...parameters,
  }

  // Add optional parameters using bracket notation for index signatures
  if (quality && model.includes('dall-e-3')) {
    payload['quality'] = quality
  }

  if (negativePrompt) {
    payload['negative_prompt'] = negativePrompt
  }

  if (seed !== undefined) {
    payload['seed'] = seed
  }

  if (model) {
    payload['model'] = model
  }

  // Make the API request
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Image generation failed: ${response.status} - ${error}`)
  }

  const apiResponse = (await response.json()) as {
    data?: Array<{
      url?: string
      b64_json?: string
      revised_prompt?: string
    }>
    created?: number
  }

  const imageData = apiResponse.data?.[0]

  if (!imageData) {
    throw new Error('No image data returned from API')
  }

  const imageUrl =
    imageData.url || (imageData.b64_json ? `data:image/png;base64,${imageData.b64_json}` : '')

  if (!imageUrl) {
    throw new Error('No image URL or data returned from API')
  }

  // Build metadata, only including defined values
  const metadata: ImageResult['metadata'] = {
    model,
    size,
    duration: Date.now() - startTime,
    format,
    quality,
  }

  if (style) {
    metadata.style = style
  }

  if (seed !== undefined) {
    metadata.seed = seed
  }

  const imageResult: ImageResult = {
    url: imageUrl,
    prompt,
    metadata,
  }

  // Only add revisedPrompt if it's defined (exactOptionalPropertyTypes)
  if (imageData.revised_prompt) {
    imageResult.revisedPrompt = imageData.revised_prompt
  }

  return imageResult
}

/**
 * Generate variations of an existing image
 *
 * @param imageUrl - URL or base64 of the source image
 * @param options - Variation options
 * @returns Promise resolving to array of ImageResults
 *
 * @example
 * ```ts
 * const variations = await image.variations('https://example.com/image.png', {
 *   count: 3,
 *   size: '1024x1024',
 * })
 *
 * variations.forEach((v, i) => {
 *   console.log(`Variation ${i + 1}: ${v.url}`)
 * })
 * ```
 */
image.variations = async function variations(
  imageUrl: string,
  options: VariationOptions = {}
): Promise<ImageResult[]> {
  const startTime = Date.now()

  const {
    count = 3,
    size = DEFAULTS.size,
    model = 'dall-e-2', // DALL-E 2 supports variations
    format = DEFAULTS.format,
  } = options

  const baseUrl =
    getEnv('AI_GATEWAY_URL') || getEnv('IMAGE_GATEWAY_URL') || 'https://image.workers.do'
  const endpoint = `${baseUrl}/openai/images/variations`

  // Build form data for image upload
  const formData = new FormData()

  // If it's a URL, we need to fetch the image first
  if (imageUrl.startsWith('http')) {
    const imageResponse = await fetch(imageUrl)
    const imageBlob = await imageResponse.blob()
    formData.append('image', imageBlob, 'image.png')
  } else if (imageUrl.startsWith('data:')) {
    // Handle base64 data URL
    const blob = base64ToBlob(imageUrl)
    formData.append('image', blob, 'image.png')
  } else {
    throw new Error('Invalid image URL format. Must be an HTTP URL or data URL.')
  }

  formData.append('n', String(count))
  formData.append('size', size)
  formData.append('response_format', format === 'b64_json' ? 'b64_json' : 'url')
  if (model) {
    formData.append('model', model)
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Image variations failed: ${response.status} - ${error}`)
  }

  const apiResponse = (await response.json()) as {
    data?: Array<{
      url?: string
      b64_json?: string
    }>
  }

  if (!apiResponse.data || apiResponse.data.length === 0) {
    throw new Error('No variations returned from API')
  }

  const duration = Date.now() - startTime
  const dataLength = apiResponse.data.length

  return apiResponse.data.map((item, index) => ({
    url: item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : ''),
    prompt: `Variation ${index + 1} of source image`,
    metadata: {
      model,
      size,
      duration: Math.round(duration / dataLength),
      format,
    },
  }))
}

/**
 * Edit an image using a text prompt and optional mask
 *
 * @param imageUrl - URL or base64 of the source image
 * @param options - Edit options including prompt and optional mask
 * @returns Promise resolving to ImageResult
 *
 * @example
 * ```ts
 * // Simple edit
 * const result = await image.edit('https://example.com/image.png', {
 *   prompt: 'Add a rainbow in the sky',
 * })
 * ```
 *
 * @example
 * ```ts
 * // Edit with mask
 * const result = await image.edit('https://example.com/image.png', {
 *   prompt: 'A cat sitting on the couch',
 *   mask: 'https://example.com/mask.png', // Transparent areas will be edited
 * })
 * ```
 */
image.edit = async function edit(imageUrl: string, options: EditOptions): Promise<ImageResult> {
  const startTime = Date.now()

  const {
    prompt,
    mask,
    size = DEFAULTS.size,
    model = 'dall-e-2', // DALL-E 2 supports edits
    n = 1,
    format = DEFAULTS.format,
  } = options

  const baseUrl =
    getEnv('AI_GATEWAY_URL') || getEnv('IMAGE_GATEWAY_URL') || 'https://image.workers.do'
  const endpoint = `${baseUrl}/openai/images/edits`

  const formData = new FormData()

  // Add source image
  if (imageUrl.startsWith('http')) {
    const imageResponse = await fetch(imageUrl)
    const imageBlob = await imageResponse.blob()
    formData.append('image', imageBlob, 'image.png')
  } else if (imageUrl.startsWith('data:')) {
    const blob = base64ToBlob(imageUrl)
    formData.append('image', blob, 'image.png')
  } else {
    throw new Error('Invalid image URL format. Must be an HTTP URL or data URL.')
  }

  // Add mask if provided
  if (mask) {
    if (mask.startsWith('http')) {
      const maskResponse = await fetch(mask)
      const maskBlob = await maskResponse.blob()
      formData.append('mask', maskBlob, 'mask.png')
    } else if (mask.startsWith('data:')) {
      const maskBlob = base64ToBlob(mask)
      formData.append('mask', maskBlob, 'mask.png')
    }
  }

  formData.append('prompt', prompt)
  formData.append('n', String(n))
  formData.append('size', size)
  formData.append('response_format', format === 'b64_json' ? 'b64_json' : 'url')
  if (model) {
    formData.append('model', model)
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Image edit failed: ${response.status} - ${error}`)
  }

  const apiResponse = (await response.json()) as {
    data?: Array<{
      url?: string
      b64_json?: string
    }>
  }

  const imageData = apiResponse.data?.[0]

  if (!imageData) {
    throw new Error('No edited image returned from API')
  }

  const editedUrl =
    imageData.url || (imageData.b64_json ? `data:image/png;base64,${imageData.b64_json}` : '')

  return {
    url: editedUrl,
    prompt,
    metadata: {
      model,
      size,
      duration: Date.now() - startTime,
      format,
    },
  }
}

/**
 * Upscale an image to a higher resolution
 *
 * @param imageUrl - URL or base64 of the source image
 * @param options - Upscale options
 * @returns Promise resolving to UpscaleResult
 *
 * @example
 * ```ts
 * const result = await image.upscale('https://example.com/small.png', {
 *   scale: 4,
 * })
 *
 * console.log(`Upscaled from ${result.originalSize.width}x${result.originalSize.height}`)
 * console.log(`to ${result.upscaledSize.width}x${result.upscaledSize.height}`)
 * ```
 */
image.upscale = async function upscale(
  imageUrl: string,
  options: UpscaleOptions = {}
): Promise<UpscaleResult> {
  const startTime = Date.now()

  const { scale = 2, model = 'real-esrgan', format = DEFAULTS.format, denoise } = options

  const baseUrl =
    getEnv('AI_GATEWAY_URL') || getEnv('IMAGE_GATEWAY_URL') || 'https://image.workers.do'
  const endpoint = `${baseUrl}/upscale`

  const payload: Record<string, unknown> = {
    image: imageUrl,
    scale,
    model,
    response_format: format,
  }

  if (denoise !== undefined) {
    payload['denoise'] = denoise
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Image upscale failed: ${response.status} - ${error}`)
  }

  const apiResponse = (await response.json()) as {
    url?: string
    b64_json?: string
    original_width?: number
    original_height?: number
    upscaled_width?: number
    upscaled_height?: number
  }

  const upscaledUrl =
    apiResponse.url || (apiResponse.b64_json ? `data:image/png;base64,${apiResponse.b64_json}` : '')

  if (!upscaledUrl) {
    throw new Error('No upscaled image returned from API')
  }

  // Extract dimensions from response or estimate
  const originalWidth = apiResponse.original_width || 256
  const originalHeight = apiResponse.original_height || 256
  const upscaledWidth = apiResponse.upscaled_width || originalWidth * scale
  const upscaledHeight = apiResponse.upscaled_height || originalHeight * scale

  return {
    url: upscaledUrl,
    prompt: 'Upscaled image',
    originalSize: {
      width: originalWidth,
      height: originalHeight,
    },
    upscaledSize: {
      width: upscaledWidth,
      height: upscaledHeight,
    },
    scaleFactor: scale,
    metadata: {
      model,
      size: `${upscaledWidth}x${upscaledHeight}`,
      duration: Date.now() - startTime,
      format,
    },
  }
}

/**
 * Create a curried function for generating images with a specific style
 *
 * @param style - The style preset to use
 * @returns A function that generates images with the specified style
 *
 * @example
 * ```ts
 * // Create a cinematic image generator
 * const cinematicImage = image.style('cinematic')
 *
 * const result1 = await cinematicImage('A spaceship landing on Mars')
 * const result2 = await cinematicImage('A detective in a rainy city')
 * // Both images will have cinematic style applied
 * ```
 *
 * @example
 * ```ts
 * // Create specialized generators
 * const cartoonGen = image.style('cartoon')
 * const realisticGen = image.style('realistic')
 * const abstractGen = image.style('abstract')
 *
 * // Use them throughout your app
 * const cartoonAvatar = await cartoonGen('A friendly robot')
 * ```
 */
image.style = function style(stylePreset: ImageStyle) {
  return function styledImage(
    prompt: string,
    options: Partial<Omit<ImageOptions, 'style'>> = {}
  ): Promise<ImageResult> {
    return image(prompt, { ...options, style: stylePreset })
  }
}

/**
 * Batch generate multiple images from different prompts
 *
 * @param prompts - Array of prompts to generate
 * @param options - Shared options for all generations
 * @returns Promise resolving to array of ImageResults
 *
 * @example
 * ```ts
 * const results = await image.batch([
 *   'A sunset over mountains',
 *   'A forest in autumn',
 *   'A city at night',
 * ], { style: 'photographic' })
 * ```
 */
image.batch = async function batch(
  prompts: string[],
  options: Partial<ImageOptions> = {}
): Promise<ImageResult[]> {
  return Promise.all(prompts.map((prompt) => image(prompt, options)))
}

/**
 * Generate an image with a specific aspect ratio
 *
 * @param prompt - The text prompt
 * @param aspectRatio - The desired aspect ratio ('portrait' | 'landscape' | 'square')
 * @param options - Additional options
 * @returns Promise resolving to ImageResult
 *
 * @example
 * ```ts
 * // Generate a portrait image
 * const portrait = await image.aspectRatio('A professional headshot', 'portrait')
 *
 * // Generate a landscape image
 * const landscape = await image.aspectRatio('Mountain range panorama', 'landscape')
 * ```
 */
image.aspectRatio = async function aspectRatio(
  prompt: string,
  ratio: 'portrait' | 'landscape' | 'square',
  options: Partial<Omit<ImageOptions, 'size'>> = {}
): Promise<ImageResult> {
  const sizeMap: Record<'portrait' | 'landscape' | 'square', ImageSize> = {
    portrait: '1024x1792',
    landscape: '1792x1024',
    square: '1024x1024',
  }

  return image(prompt, { ...options, size: sizeMap[ratio] })
}
