/**
 * Media Providers
 *
 * @packageDocumentation
 */

export { cloudinaryInfo, cloudinaryProvider, createCloudinaryProvider } from './cloudinary.js'

import { cloudinaryProvider } from './cloudinary.js'

/**
 * Register all media providers
 */
export function registerMediaProviders(): void {
  cloudinaryProvider.register()
}

/**
 * All media providers
 */
export const mediaProviders = [cloudinaryProvider]
