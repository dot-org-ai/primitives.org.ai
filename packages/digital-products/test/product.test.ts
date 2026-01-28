import { describe, it, expect } from 'vitest'
import type { Product, App, API, Site } from '../src/types'

describe('Product types', () => {
  it('Product has required properties', () => {
    const product: Product = {
      $id: 'https://schema.org.ai/products/p1',
      $type: 'https://schema.org.ai/Product',
      name: 'Test Product',
      description: 'A digital product',
      status: 'active',
    }
    expect(product.$type).toBe('https://schema.org.ai/Product')
  })

  it('App extends Product with app-specific properties', () => {
    const app: App = {
      $id: 'https://schema.org.ai/apps/a1',
      $type: 'https://schema.org.ai/App',
      name: 'My App',
      description: 'A web application',
      status: 'active',
      platform: 'web',
      url: 'https://myapp.com',
    }
    expect(app.$type).toBe('https://schema.org.ai/App')
  })

  it('API extends Product with endpoint info', () => {
    const api: API = {
      $id: 'https://schema.org.ai/apis/a1',
      $type: 'https://schema.org.ai/API',
      name: 'My API',
      description: 'REST API',
      status: 'active',
      baseUrl: 'https://api.myapp.com',
      version: 'v1',
      authentication: 'bearer',
    }
    expect(api.$type).toBe('https://schema.org.ai/API')
  })

  it('Site extends Product with website properties', () => {
    const site: Site = {
      $id: 'https://schema.org.ai/sites/s1',
      $type: 'https://schema.org.ai/Site',
      name: 'My Site',
      description: 'Marketing website',
      status: 'active',
      url: 'https://mysite.com',
      siteType: 'marketing',
    }
    expect(site.$type).toBe('https://schema.org.ai/Site')
  })
})
