/**
 * Shopify E-commerce Provider
 *
 * Concrete implementation of EcommerceProvider using Shopify Admin REST API.
 *
 * @packageDocumentation
 */

import type {
  EcommerceProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  EcommerceProductData,
  CreateProductOptions,
  ProductListOptions,
  PaginatedResult,
  OrderData,
  OrderListOptions,
  EcommerceCustomerData,
  PaginationOptions,
} from '../types.js'
import { defineProvider } from '../registry.js'

const API_VERSION = '2023-10'

/**
 * Shopify provider info
 */
export const shopifyInfo: ProviderInfo = {
  id: 'ecommerce.shopify',
  name: 'Shopify',
  description: 'Shopify e-commerce platform',
  category: 'ecommerce',
  website: 'https://www.shopify.com',
  docsUrl: 'https://shopify.dev/docs/api/admin-rest',
  requiredConfig: ['shopDomain', 'accessToken'],
  optionalConfig: [],
}

/**
 * Create Shopify e-commerce provider
 */
export function createShopifyProvider(config: ProviderConfig): EcommerceProvider {
  let shopDomain: string
  let accessToken: string
  let baseUrl: string

  function getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    }
  }

  async function makeRequest<T>(
    endpoint: string,
    method: string = 'GET',
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method,
      headers: getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        `Shopify API error: ${response.status} - ${(errorData as any)?.errors || response.statusText}`
      )
    }

    return response.json() as Promise<T>
  }

  return {
    info: shopifyInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      shopDomain = cfg.shopDomain as string
      accessToken = cfg.accessToken as string

      if (!shopDomain) {
        throw new Error('Shopify shop domain is required')
      }
      if (!accessToken) {
        throw new Error('Shopify access token is required')
      }

      // Ensure domain has proper format
      const domain = shopDomain.includes('.myshopify.com')
        ? shopDomain
        : `${shopDomain}.myshopify.com`

      baseUrl = `https://${domain}/admin/api/${API_VERSION}`
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        await makeRequest('/shop.json', 'GET')

        return {
          healthy: true,
          latencyMs: Date.now() - start,
          message: 'Connected',
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

    async createProduct(product: CreateProductOptions): Promise<EcommerceProductData> {
      const shopifyProduct: any = {
        title: product.title,
        body_html: product.description,
        vendor: 'Default',
        product_type: '',
        tags: product.tags?.join(', ') || '',
        status: product.status || 'active',
      }

      // Add variants
      if (product.variants && product.variants.length > 0) {
        shopifyProduct.variants = product.variants.map((v) => ({
          title: v.title,
          price: v.price.toString(),
          sku: v.sku,
          inventory_quantity: v.inventory || 0,
        }))
      } else {
        // Single variant
        shopifyProduct.variants = [
          {
            title: 'Default Title',
            price: product.price.toString(),
            sku: product.sku,
            inventory_quantity: product.inventory || 0,
          },
        ]
      }

      // Add images
      if (product.images && product.images.length > 0) {
        shopifyProduct.images = product.images.map((url) => ({ src: url }))
      }

      const response = await makeRequest<{ product: any }>('/products.json', 'POST', {
        product: shopifyProduct,
      })

      return mapShopifyProduct(response.product)
    },

    async getProduct(productId: string): Promise<EcommerceProductData | null> {
      try {
        const response = await makeRequest<{ product: any }>(`/products/${productId}.json`, 'GET')
        return mapShopifyProduct(response.product)
      } catch (error) {
        return null
      }
    },

    async updateProduct(
      productId: string,
      updates: Partial<CreateProductOptions>
    ): Promise<EcommerceProductData> {
      const shopifyUpdates: any = {}

      if (updates.title) shopifyUpdates.title = updates.title
      if (updates.description) shopifyUpdates.body_html = updates.description
      if (updates.tags) shopifyUpdates.tags = updates.tags.join(', ')
      if (updates.status) shopifyUpdates.status = updates.status

      // Handle images update
      if (updates.images) {
        shopifyUpdates.images = updates.images.map((url) => ({ src: url }))
      }

      const response = await makeRequest<{ product: any }>(`/products/${productId}.json`, 'PUT', {
        product: shopifyUpdates,
      })

      return mapShopifyProduct(response.product)
    },

    async deleteProduct(productId: string): Promise<boolean> {
      try {
        await makeRequest(`/products/${productId}.json`, 'DELETE')
        return true
      } catch (error) {
        return false
      }
    },

    async listProducts(options?: ProductListOptions): Promise<PaginatedResult<EcommerceProductData>> {
      const params = new URLSearchParams()

      if (options?.limit) params.append('limit', options.limit.toString())
      if (options?.status) params.append('status', options.status)
      if (options?.vendor) params.append('vendor', options.vendor)
      if (options?.cursor) params.append('page_info', options.cursor)

      const queryString = params.toString()
      const endpoint = `/products.json${queryString ? `?${queryString}` : ''}`

      const response = await makeRequest<{ products: any[] }>(endpoint, 'GET')

      return {
        items: response.products.map(mapShopifyProduct),
        hasMore: response.products.length === (options?.limit || 50),
        total: undefined, // Shopify doesn't provide total count in products endpoint
      }
    },

    async getOrder(orderId: string): Promise<OrderData | null> {
      try {
        const response = await makeRequest<{ order: any }>(`/orders/${orderId}.json`, 'GET')
        return mapShopifyOrder(response.order)
      } catch (error) {
        return null
      }
    },

    async listOrders(options?: OrderListOptions): Promise<PaginatedResult<OrderData>> {
      const params = new URLSearchParams()

      if (options?.limit) params.append('limit', options.limit.toString())
      if (options?.status) params.append('status', options.status)
      if (options?.financialStatus) params.append('financial_status', options.financialStatus)
      if (options?.fulfillmentStatus)
        params.append('fulfillment_status', options.fulfillmentStatus)
      if (options?.customerId) params.append('customer_id', options.customerId)
      if (options?.since) params.append('created_at_min', options.since.toISOString())
      if (options?.until) params.append('created_at_max', options.until.toISOString())
      if (options?.cursor) params.append('page_info', options.cursor)

      const queryString = params.toString()
      const endpoint = `/orders.json${queryString ? `?${queryString}` : ''}`

      const response = await makeRequest<{ orders: any[] }>(endpoint, 'GET')

      return {
        items: response.orders.map(mapShopifyOrder),
        hasMore: response.orders.length === (options?.limit || 50),
        total: undefined,
      }
    },

    async updateOrderStatus(orderId: string, status: string): Promise<OrderData> {
      const response = await makeRequest<{ order: any }>(`/orders/${orderId}.json`, 'PUT', {
        order: {
          id: orderId,
          tags: status,
        },
      })

      return mapShopifyOrder(response.order)
    },

    async getEcommerceCustomer(customerId: string): Promise<EcommerceCustomerData | null> {
      try {
        const response = await makeRequest<{ customer: any }>(`/customers/${customerId}.json`, 'GET')
        return mapShopifyCustomer(response.customer)
      } catch (error) {
        return null
      }
    },

    async listEcommerceCustomers(
      options?: PaginationOptions
    ): Promise<PaginatedResult<EcommerceCustomerData>> {
      const params = new URLSearchParams()

      if (options?.limit) params.append('limit', options.limit.toString())
      if (options?.cursor) params.append('page_info', options.cursor)

      const queryString = params.toString()
      const endpoint = `/customers.json${queryString ? `?${queryString}` : ''}`

      const response = await makeRequest<{ customers: any[] }>(endpoint, 'GET')

      return {
        items: response.customers.map(mapShopifyCustomer),
        hasMore: response.customers.length === (options?.limit || 50),
        total: undefined,
      }
    },

    async updateInventory(
      productId: string,
      variantId: string,
      quantity: number
    ): Promise<boolean> {
      try {
        // First get the inventory item ID from the variant
        const variantResponse = await makeRequest<{ variant: any }>(
          `/variants/${variantId}.json`,
          'GET'
        )
        const inventoryItemId = variantResponse.variant.inventory_item_id

        // Get inventory levels
        const levelsResponse = await makeRequest<{ inventory_levels: any[] }>(
          `/inventory_levels.json?inventory_item_ids=${inventoryItemId}`,
          'GET'
        )

        if (levelsResponse.inventory_levels.length === 0) {
          throw new Error('No inventory levels found for this variant')
        }

        const locationId = levelsResponse.inventory_levels[0].location_id

        // Set the inventory level
        await makeRequest('/inventory_levels/set.json', 'POST', {
          location_id: locationId,
          inventory_item_id: inventoryItemId,
          available: quantity,
        })

        return true
      } catch (error) {
        return false
      }
    },
  }
}

/**
 * Map Shopify product to our format
 */
function mapShopifyProduct(product: any): EcommerceProductData {
  const firstVariant = product.variants?.[0]

  return {
    id: product.id.toString(),
    title: product.title,
    description: product.body_html,
    price: parseFloat(firstVariant?.price || '0'),
    compareAtPrice: firstVariant?.compare_at_price
      ? parseFloat(firstVariant.compare_at_price)
      : undefined,
    sku: firstVariant?.sku,
    inventory: firstVariant?.inventory_quantity,
    images: product.images?.map((img: any) => img.src) || [],
    variants:
      product.variants?.map((v: any) => ({
        id: v.id.toString(),
        title: v.title,
        price: parseFloat(v.price),
        sku: v.sku,
        inventory: v.inventory_quantity,
      })) || [],
    tags: product.tags ? product.tags.split(', ') : [],
    status: product.status,
    url: product.admin_graphql_api_id,
    createdAt: new Date(product.created_at),
    updatedAt: new Date(product.updated_at),
  }
}

/**
 * Map Shopify order to our format
 */
function mapShopifyOrder(order: any): OrderData {
  return {
    id: order.id.toString(),
    orderNumber: order.name || order.order_number?.toString(),
    status: order.cancelled_at ? 'cancelled' : order.closed_at ? 'closed' : 'open',
    financialStatus: order.financial_status,
    fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
    customerId: order.customer?.id?.toString(),
    email: order.email || order.customer?.email || '',
    lineItems:
      order.line_items?.map((item: any) => ({
        productId: item.product_id?.toString() || '',
        variantId: item.variant_id?.toString(),
        title: item.title,
        quantity: item.quantity,
        price: parseFloat(item.price),
      })) || [],
    subtotal: parseFloat(order.subtotal_price || '0'),
    tax: parseFloat(order.total_tax || '0'),
    shipping: parseFloat(order.total_shipping_price_set?.shop_money?.amount || '0'),
    total: parseFloat(order.total_price || '0'),
    currency: order.currency,
    shippingAddress: order.shipping_address
      ? {
          firstName: order.shipping_address.first_name,
          lastName: order.shipping_address.last_name,
          address1: order.shipping_address.address1,
          address2: order.shipping_address.address2,
          city: order.shipping_address.city,
          province: order.shipping_address.province,
          postalCode: order.shipping_address.zip,
          country: order.shipping_address.country,
          phone: order.shipping_address.phone,
        }
      : undefined,
    billingAddress: order.billing_address
      ? {
          firstName: order.billing_address.first_name,
          lastName: order.billing_address.last_name,
          address1: order.billing_address.address1,
          address2: order.billing_address.address2,
          city: order.billing_address.city,
          province: order.billing_address.province,
          postalCode: order.billing_address.zip,
          country: order.billing_address.country,
          phone: order.billing_address.phone,
        }
      : undefined,
    createdAt: new Date(order.created_at),
    updatedAt: new Date(order.updated_at),
  }
}

/**
 * Map Shopify customer to our format
 */
function mapShopifyCustomer(customer: any): EcommerceCustomerData {
  return {
    id: customer.id.toString(),
    email: customer.email,
    firstName: customer.first_name,
    lastName: customer.last_name,
    phone: customer.phone,
    ordersCount: customer.orders_count || 0,
    totalSpent: parseFloat(customer.total_spent || '0'),
    createdAt: new Date(customer.created_at),
  }
}

/**
 * Shopify provider definition
 */
export const shopifyProvider = defineProvider(shopifyInfo, async (config) =>
  createShopifyProvider(config)
)
