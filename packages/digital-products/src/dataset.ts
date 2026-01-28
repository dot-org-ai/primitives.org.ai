/**
 * Dataset() - Define a dataset
 */

import type { DatasetDefinition } from './types.js'
import { registerProduct } from './product.js'

/**
 * Create a dataset definition
 *
 * @example
 * ```ts
 * const movieDataset = Dataset({
 *   id: 'movies',
 *   name: 'Movie Database',
 *   description: 'Comprehensive movie information dataset',
 *   version: '2024.1',
 *   format: 'parquet',
 *   schema: {
 *     id: 'Movie ID',
 *     title: 'Movie title',
 *     year: 'Release year (number)',
 *     genres: ['Array of genre names'],
 *     rating: 'Average rating (number)',
 *     votes: 'Number of votes (number)',
 *   },
 *   source: 's3://datasets/movies.parquet',
 *   size: 1000000,
 *   license: 'CC-BY-4.0',
 *   updateFrequency: 'daily',
 * })
 * ```
 */
export function Dataset(config: Omit<DatasetDefinition, 'type'>): DatasetDefinition {
  const dataset: DatasetDefinition = {
    type: 'dataset',
    id: config.id,
    name: config.name,
    description: config.description,
    version: config.version,
    format: config.format || 'json',
    schema: config.schema,
    updateFrequency: config.updateFrequency || 'static',
    status: config.status || 'active',
    ...(config.source !== undefined && { source: config.source }),
    ...(config.size !== undefined && { size: config.size }),
    ...(config.license !== undefined && { license: config.license }),
    ...(config.metadata !== undefined && { metadata: config.metadata }),
    ...(config.tags !== undefined && { tags: config.tags }),
  }

  return registerProduct(dataset)
}
