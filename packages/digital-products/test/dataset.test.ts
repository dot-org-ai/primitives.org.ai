/**
 * Tests for Dataset functionality
 *
 * Covers dataset creation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { Dataset, registry } from '../src/index.js'

describe('Dataset', () => {
  beforeEach(() => {
    registry.clear()
  })

  describe('Dataset creation', () => {
    it('creates a dataset with basic config', () => {
      const dataset = Dataset({
        id: 'movies',
        name: 'Movie Database',
        description: 'Movie information dataset',
        version: '2024.1',
      })

      expect(dataset.id).toBe('movies')
      expect(dataset.name).toBe('Movie Database')
      expect(dataset.type).toBe('dataset')
    })

    it('defaults format to json', () => {
      const dataset = Dataset({
        id: 'default-format',
        name: 'Default Format',
        description: 'Uses default format',
        version: '1.0.0',
      })

      expect(dataset.format).toBe('json')
    })

    it('supports parquet format', () => {
      const dataset = Dataset({
        id: 'parquet-dataset',
        name: 'Parquet Dataset',
        description: 'Parquet format',
        version: '1.0.0',
        format: 'parquet',
      })

      expect(dataset.format).toBe('parquet')
    })

    it('supports csv format', () => {
      const dataset = Dataset({
        id: 'csv-dataset',
        name: 'CSV Dataset',
        description: 'CSV format',
        version: '1.0.0',
        format: 'csv',
      })

      expect(dataset.format).toBe('csv')
    })

    it('creates a dataset with schema', () => {
      const dataset = Dataset({
        id: 'schema-dataset',
        name: 'Schema Dataset',
        description: 'Dataset with schema',
        version: '1.0.0',
        schema: {
          id: 'Movie ID',
          title: 'Movie title',
          year: 'Release year (number)',
          rating: 'Average rating (number)',
        },
      })

      expect(dataset.schema?.id).toBe('Movie ID')
      expect(dataset.schema?.title).toBe('Movie title')
    })

    it('creates a dataset with source', () => {
      const dataset = Dataset({
        id: 'source-dataset',
        name: 'Source Dataset',
        description: 'Dataset with source',
        version: '1.0.0',
        source: 's3://datasets/movies.parquet',
      })

      expect(dataset.source).toBe('s3://datasets/movies.parquet')
    })

    it('creates a dataset with size', () => {
      const dataset = Dataset({
        id: 'sized-dataset',
        name: 'Sized Dataset',
        description: 'Dataset with size',
        version: '1.0.0',
        size: 1000000,
      })

      expect(dataset.size).toBe(1000000)
    })

    it('creates a dataset with license', () => {
      const dataset = Dataset({
        id: 'licensed-dataset',
        name: 'Licensed Dataset',
        description: 'Dataset with license',
        version: '1.0.0',
        license: 'CC-BY-4.0',
      })

      expect(dataset.license).toBe('CC-BY-4.0')
    })

    it('defaults updateFrequency to static', () => {
      const dataset = Dataset({
        id: 'static-dataset',
        name: 'Static Dataset',
        description: 'Static dataset',
        version: '1.0.0',
      })

      expect(dataset.updateFrequency).toBe('static')
    })

    it('supports daily updateFrequency', () => {
      const dataset = Dataset({
        id: 'daily-dataset',
        name: 'Daily Dataset',
        description: 'Updated daily',
        version: '1.0.0',
        updateFrequency: 'daily',
      })

      expect(dataset.updateFrequency).toBe('daily')
    })

    it('registers dataset automatically', () => {
      Dataset({
        id: 'auto-registered',
        name: 'Auto Registered',
        description: 'Automatically registered',
        version: '1.0.0',
      })

      expect(registry.get('auto-registered')).toBeDefined()
    })

    it('creates a complete dataset definition', () => {
      const dataset = Dataset({
        id: 'complete-dataset',
        name: 'Complete Dataset',
        description: 'Comprehensive movie information dataset',
        version: '2024.1',
        format: 'parquet',
        schema: {
          id: 'Movie ID',
          title: 'Movie title',
          year: 'Release year (number)',
          genres: ['Array of genre names'],
          rating: 'Average rating (number)',
          votes: 'Number of votes (number)',
        },
        source: 's3://datasets/movies.parquet',
        size: 1000000,
        license: 'CC-BY-4.0',
        updateFrequency: 'daily',
        tags: ['movies', 'entertainment'],
        metadata: { curator: 'Data Team' },
      })

      expect(dataset.id).toBe('complete-dataset')
      expect(dataset.format).toBe('parquet')
      expect(dataset.license).toBe('CC-BY-4.0')
      expect(dataset.tags).toContain('movies')
    })
  })
})
