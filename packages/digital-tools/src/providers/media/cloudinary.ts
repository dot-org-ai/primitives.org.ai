/**
 * Cloudinary Media Provider
 *
 * Concrete implementation of MediaProvider using Cloudinary API.
 *
 * @packageDocumentation
 */

import type {
  MediaProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  UploadOptions,
  MediaAssetData,
  MediaListOptions,
  PaginatedResult,
  TransformOptions,
  UrlOptions,
} from '../types.js'
import { defineProvider } from '../registry.js'

const CLOUDINARY_API_VERSION = 'v1_1'

// =============================================================================
// Cloudinary API Response Types
// =============================================================================

/** Cloudinary error response */
interface CloudinaryErrorResponse {
  error?: {
    message?: string
  }
}

/** Cloudinary upload response */
interface CloudinaryUploadResponse {
  public_id: string
  url: string
  secure_url: string
  resource_type: string
  format: string
  bytes: number
  width?: number
  height?: number
  duration?: number
  created_at: string
}

/** Cloudinary resource from API */
interface CloudinaryResource {
  public_id: string
  url: string
  secure_url: string
  resource_type: string
  format: string
  bytes: number
  width?: number
  height?: number
  duration?: number
  created_at: string
}

/** Cloudinary resources list response */
interface CloudinaryResourcesResponse {
  resources?: CloudinaryResource[]
  next_cursor?: string
}

/** Cloudinary delete response */
interface CloudinaryDeleteResponse {
  deleted?: Record<string, string>
}

/**
 * Cloudinary provider info
 */
export const cloudinaryInfo: ProviderInfo = {
  id: 'media.cloudinary',
  name: 'Cloudinary',
  description: 'Cloud-based image and video management service',
  category: 'media',
  website: 'https://cloudinary.com',
  docsUrl: 'https://cloudinary.com/documentation',
  requiredConfig: ['cloudName', 'apiKey', 'apiSecret'],
  optionalConfig: ['uploadPreset', 'secure'],
}

/**
 * Create Cloudinary media provider
 */
export function createCloudinaryProvider(config: ProviderConfig): MediaProvider {
  let cloudName: string
  let apiKey: string
  let apiSecret: string
  let secure: boolean

  function getApiUrl(): string {
    return `https://api.cloudinary.com/${CLOUDINARY_API_VERSION}/${cloudName}`
  }

  function getAuthHeader(): string {
    return 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
  }

  function buildTransformUrl(
    publicId: string,
    resourceType: string,
    transforms?: TransformOptions
  ): string {
    const protocol = secure ? 'https' : 'http'
    const baseUrl = `${protocol}://res.cloudinary.com/${cloudName}`

    if (!transforms) {
      return `${baseUrl}/${resourceType}/upload/${publicId}`
    }

    const parts: string[] = []
    if (transforms.width) parts.push(`w_${transforms.width}`)
    if (transforms.height) parts.push(`h_${transforms.height}`)
    if (transforms.crop) parts.push(`c_${transforms.crop}`)
    if (transforms.quality) parts.push(`q_${transforms.quality}`)
    if (transforms.format) parts.push(`f_${transforms.format}`)

    const transformation = parts.length > 0 ? parts.join(',') + '/' : ''
    return `${baseUrl}/${resourceType}/upload/${transformation}${publicId}`
  }

  return {
    info: cloudinaryInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      cloudName = cfg.cloudName as string
      apiKey = cfg.apiKey as string
      apiSecret = cfg.apiSecret as string
      secure = cfg.secure !== false

      if (!cloudName || !apiKey || !apiSecret) {
        throw new Error('Cloudinary requires cloudName, apiKey, and apiSecret')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        const response = await fetch(`${getApiUrl()}/resources/image`, {
          method: 'GET',
          headers: {
            Authorization: getAuthHeader(),
          },
        })

        return {
          healthy: response.ok,
          latencyMs: Date.now() - start,
          message: response.ok ? 'Connected' : `HTTP ${response.status}`,
          checkedAt: new Date(),
        }
      } catch (error) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          message: error instanceof Error ? error.message : 'Unknown error',
          checkedAt: new Date(),
        }
      }
    },

    async dispose(): Promise<void> {
      // No cleanup needed
    },

    async upload(file: Buffer | string, options?: UploadOptions): Promise<MediaAssetData> {
      const resourceType = options?.resourceType || 'auto'
      const formData = new FormData()

      if (typeof file === 'string') {
        // URL or base64
        formData.append('file', file)
      } else {
        // Buffer - convert to ArrayBuffer for Blob
        const arrayBuffer = file.buffer.slice(
          file.byteOffset,
          file.byteOffset + file.byteLength
        ) as ArrayBuffer
        const blob = new Blob([arrayBuffer])
        formData.append('file', blob)
      }

      if (options?.publicId) {
        formData.append('public_id', options.publicId)
      }
      if (options?.folder) {
        formData.append('folder', options.folder)
      }
      if (options?.tags?.length) {
        formData.append('tags', options.tags.join(','))
      }
      if (options?.metadata) {
        formData.append(
          'context',
          Object.entries(options.metadata)
            .map(([k, v]) => `${k}=${v}`)
            .join('|')
        )
      }

      try {
        const response = await fetch(`${getApiUrl()}/${resourceType}/upload`, {
          method: 'POST',
          headers: {
            Authorization: getAuthHeader(),
          },
          body: formData,
        })

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as CloudinaryErrorResponse
          throw new Error(errorData.error?.message || `Upload failed: HTTP ${response.status}`)
        }

        const data = (await response.json()) as CloudinaryUploadResponse

        return {
          id: data.public_id,
          publicId: data.public_id,
          url: data.url,
          secureUrl: data.secure_url,
          resourceType: data.resource_type,
          format: data.format,
          bytes: data.bytes,
          width: data.width,
          height: data.height,
          duration: data.duration,
          createdAt: new Date(data.created_at),
        }
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'Upload failed')
      }
    },

    async get(assetId: string): Promise<MediaAssetData | null> {
      try {
        // Try image first
        const response = await fetch(`${getApiUrl()}/resources/image/upload/${assetId}`, {
          method: 'GET',
          headers: {
            Authorization: getAuthHeader(),
          },
        })

        if (!response.ok) {
          // Try video
          const videoResponse = await fetch(`${getApiUrl()}/resources/video/upload/${assetId}`, {
            method: 'GET',
            headers: {
              Authorization: getAuthHeader(),
            },
          })

          if (!videoResponse.ok) {
            return null
          }

          const data = (await videoResponse.json()) as CloudinaryResource
          return {
            id: data.public_id,
            publicId: data.public_id,
            url: data.url,
            secureUrl: data.secure_url,
            resourceType: data.resource_type,
            format: data.format,
            bytes: data.bytes,
            width: data.width,
            height: data.height,
            duration: data.duration,
            createdAt: new Date(data.created_at),
          }
        }

        const data = (await response.json()) as CloudinaryResource
        return {
          id: data.public_id,
          publicId: data.public_id,
          url: data.url,
          secureUrl: data.secure_url,
          resourceType: data.resource_type,
          format: data.format,
          bytes: data.bytes,
          width: data.width,
          height: data.height,
          duration: data.duration,
          createdAt: new Date(data.created_at),
        }
      } catch {
        return null
      }
    },

    async delete(assetId: string): Promise<boolean> {
      try {
        // Try deleting as image first
        let response = await fetch(`${getApiUrl()}/resources/image/upload`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: getAuthHeader(),
          },
          body: JSON.stringify({ public_ids: [assetId] }),
        })

        if (response.ok) {
          const result = (await response.json()) as CloudinaryDeleteResponse
          return result.deleted?.[assetId] === 'deleted'
        }

        // Try video if image failed
        response = await fetch(`${getApiUrl()}/resources/video/upload`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: getAuthHeader(),
          },
          body: JSON.stringify({ public_ids: [assetId] }),
        })

        if (response.ok) {
          const result = (await response.json()) as CloudinaryDeleteResponse
          return result.deleted?.[assetId] === 'deleted'
        }

        return false
      } catch {
        return false
      }
    },

    async list(options?: MediaListOptions): Promise<PaginatedResult<MediaAssetData>> {
      try {
        const resourceType = options?.resourceType || 'image'
        const params = new URLSearchParams()

        if (options?.limit) params.append('max_results', options.limit.toString())
        if (options?.cursor) params.append('next_cursor', options.cursor)
        if (options?.folder) params.append('prefix', options.folder)
        if (options?.tags?.length) {
          params.append('tags', 'true')
        }

        const response = await fetch(
          `${getApiUrl()}/resources/${resourceType}?${params.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: getAuthHeader(),
            },
          }
        )

        if (!response.ok) {
          throw new Error(`List failed: HTTP ${response.status}`)
        }

        const data = (await response.json()) as CloudinaryResourcesResponse

        const items: MediaAssetData[] = (data.resources || []).map((resource) => ({
          id: resource.public_id,
          publicId: resource.public_id,
          url: resource.url,
          secureUrl: resource.secure_url,
          resourceType: resource.resource_type,
          format: resource.format,
          bytes: resource.bytes,
          width: resource.width,
          height: resource.height,
          duration: resource.duration,
          createdAt: new Date(resource.created_at),
        }))

        return {
          items,
          hasMore: !!data.next_cursor,
          nextCursor: data.next_cursor,
        }
      } catch (error) {
        throw new Error(error instanceof Error ? error.message : 'List failed')
      }
    },

    async transform(assetId: string, transformations: TransformOptions): Promise<string> {
      // Get asset to determine resource type
      const asset = await this.get(assetId)
      if (!asset) {
        throw new Error(`Asset not found: ${assetId}`)
      }

      return buildTransformUrl(assetId, asset.resourceType, transformations)
    },

    async getUrl(assetId: string, options?: UrlOptions): Promise<string> {
      // Get asset to determine resource type
      const asset = await this.get(assetId)
      if (!asset) {
        throw new Error(`Asset not found: ${assetId}`)
      }

      let url = buildTransformUrl(assetId, asset.resourceType, options?.transformation)

      // Add signed URL parameters if requested
      if (options?.signed) {
        // For signed URLs, we'd need to implement signature generation
        // This is a simplified version - production would need proper signing
        const timestamp = options.expiration
          ? Math.floor(options.expiration.getTime() / 1000)
          : Math.floor(Date.now() / 1000) + 3600 // 1 hour default

        // Note: This would need proper signature generation in production
        url += `?timestamp=${timestamp}`
      }

      return url
    },
  }
}

/**
 * Cloudinary provider definition
 */
export const cloudinaryProvider = defineProvider(cloudinaryInfo, async (config) =>
  createCloudinaryProvider(config)
)
