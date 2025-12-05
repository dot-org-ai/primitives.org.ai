/**
 * E-Commerce Entity Types (Nouns)
 *
 * Semantic type definitions for e-commerce digital tools that can be used by
 * both remote human workers AND AI agents. Each entity defines:
 * - Properties: The data fields
 * - Actions: Operations that can be performed (Verbs)
 * - Events: State changes that occur
 *
 * @packageDocumentation
 */

import type { Noun, NounProperty, NounRelationship, Verb } from 'ai-database'

// =============================================================================
// Product
// =============================================================================

/**
 * Product entity
 *
 * Represents a product that can be sold in an e-commerce store
 */
export const Product: Noun = {
  singular: 'product',
  plural: 'products',
  description: 'A product that can be sold in an e-commerce store',

  properties: {
    // Identity
    sku: {
      type: 'string',
      description: 'Stock Keeping Unit - unique product identifier',
    },
    name: {
      type: 'string',
      description: 'Product name',
    },
    slug: {
      type: 'string',
      optional: true,
      description: 'URL-friendly version of the product name',
    },

    // Content
    description: {
      type: 'string',
      optional: true,
      description: 'Product description',
    },
    shortDescription: {
      type: 'string',
      optional: true,
      description: 'Brief product summary',
    },
    features: {
      type: 'string',
      array: true,
      optional: true,
      description: 'List of product features',
    },
    specifications: {
      type: 'json',
      optional: true,
      description: 'Technical specifications and attributes',
    },

    // Pricing
    price: {
      type: 'number',
      description: 'Base price of the product',
    },
    compareAtPrice: {
      type: 'number',
      optional: true,
      description: 'Original price for comparison (for showing discounts)',
    },
    cost: {
      type: 'number',
      optional: true,
      description: 'Cost of goods (for internal use)',
    },
    currency: {
      type: 'string',
      description: 'Currency code (USD, EUR, etc.)',
      examples: ['USD', 'EUR', 'GBP', 'CAD'],
    },

    // Media
    images: {
      type: 'url',
      array: true,
      optional: true,
      description: 'Product image URLs',
    },
    featuredImage: {
      type: 'url',
      optional: true,
      description: 'Primary product image URL',
    },
    videos: {
      type: 'url',
      array: true,
      optional: true,
      description: 'Product video URLs',
    },

    // Categorization
    category: {
      type: 'string',
      optional: true,
      description: 'Product category',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for organization and search',
    },
    brand: {
      type: 'string',
      optional: true,
      description: 'Product brand or manufacturer',
    },

    // Inventory
    trackInventory: {
      type: 'boolean',
      optional: true,
      description: 'Whether to track inventory for this product',
    },
    inventoryQuantity: {
      type: 'number',
      optional: true,
      description: 'Available inventory quantity',
    },
    lowStockThreshold: {
      type: 'number',
      optional: true,
      description: 'Quantity at which low stock warning triggers',
    },

    // Variants
    hasVariants: {
      type: 'boolean',
      optional: true,
      description: 'Whether product has variants (size, color, etc.)',
    },
    variantOptions: {
      type: 'json',
      optional: true,
      description: 'Available variant options (e.g., sizes, colors)',
    },

    // Status
    status: {
      type: 'string',
      description: 'Product status: draft, active, archived',
      examples: ['draft', 'active', 'archived'],
    },
    published: {
      type: 'boolean',
      optional: true,
      description: 'Whether the product is publicly visible',
    },
    publishedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the product was published',
    },

    // Shipping
    weight: {
      type: 'number',
      optional: true,
      description: 'Product weight for shipping',
    },
    weightUnit: {
      type: 'string',
      optional: true,
      description: 'Weight unit: lb, kg, oz, g',
      examples: ['lb', 'kg', 'oz', 'g'],
    },
    dimensions: {
      type: 'json',
      optional: true,
      description: 'Product dimensions (length, width, height)',
    },
    requiresShipping: {
      type: 'boolean',
      optional: true,
      description: 'Whether product requires physical shipping',
    },

    // SEO
    metaTitle: {
      type: 'string',
      optional: true,
      description: 'SEO meta title',
    },
    metaDescription: {
      type: 'string',
      optional: true,
      description: 'SEO meta description',
    },

    // Metrics
    viewCount: {
      type: 'number',
      optional: true,
      description: 'Number of times product has been viewed',
    },
    salesCount: {
      type: 'number',
      optional: true,
      description: 'Total number of units sold',
    },
    averageRating: {
      type: 'number',
      optional: true,
      description: 'Average customer rating (e.g., 4.5)',
    },
    reviewCount: {
      type: 'number',
      optional: true,
      description: 'Number of customer reviews',
    },
  },

  relationships: {
    variants: {
      type: 'ProductVariant[]',
      backref: 'product',
      description: 'Product variants (different sizes, colors, etc.)',
    },
    reviews: {
      type: 'Review[]',
      backref: 'product',
      description: 'Customer reviews for this product',
    },
    inventory: {
      type: 'Inventory',
      backref: 'product',
      description: 'Inventory tracking information',
    },
    orderItems: {
      type: 'OrderItem[]',
      backref: 'product',
      description: 'Order items containing this product',
    },
  },

  actions: [
    'create',
    'update',
    'publish',
    'unpublish',
    'archive',
    'delete',
    'duplicate',
    'addVariant',
    'removeVariant',
    'updatePrice',
    'updateInventory',
    'addImage',
    'removeImage',
    'addToCart',
    'addToWishlist',
    'view',
    'review',
  ],

  events: [
    'created',
    'updated',
    'published',
    'unpublished',
    'archived',
    'deleted',
    'duplicated',
    'variantAdded',
    'variantRemoved',
    'priceChanged',
    'inventoryUpdated',
    'imageAdded',
    'imageRemoved',
    'viewed',
    'addedToCart',
    'addedToWishlist',
    'purchased',
    'reviewed',
    'outOfStock',
    'lowStock',
  ],
}

/**
 * Product variant entity
 *
 * Represents a variant of a product (e.g., size, color)
 */
export const ProductVariant: Noun = {
  singular: 'product variant',
  plural: 'product variants',
  description: 'A variant of a product with different options (size, color, etc.)',

  properties: {
    // Identity
    sku: {
      type: 'string',
      description: 'Unique SKU for this variant',
    },
    title: {
      type: 'string',
      description: 'Variant title (e.g., "Large / Blue")',
    },

    // Options
    option1: {
      type: 'string',
      optional: true,
      description: 'First option value (e.g., "Large")',
    },
    option2: {
      type: 'string',
      optional: true,
      description: 'Second option value (e.g., "Blue")',
    },
    option3: {
      type: 'string',
      optional: true,
      description: 'Third option value',
    },

    // Pricing
    price: {
      type: 'number',
      description: 'Variant price (overrides product price)',
    },
    compareAtPrice: {
      type: 'number',
      optional: true,
      description: 'Original price for comparison',
    },
    cost: {
      type: 'number',
      optional: true,
      description: 'Cost of goods for this variant',
    },

    // Inventory
    inventoryQuantity: {
      type: 'number',
      description: 'Available inventory quantity',
    },
    inventoryPolicy: {
      type: 'string',
      optional: true,
      description: 'How to handle out-of-stock: deny, continue',
      examples: ['deny', 'continue'],
    },

    // Media
    image: {
      type: 'url',
      optional: true,
      description: 'Variant-specific image URL',
    },
    position: {
      type: 'number',
      optional: true,
      description: 'Display position/order',
    },

    // Physical
    weight: {
      type: 'number',
      optional: true,
      description: 'Variant weight (overrides product weight)',
    },
    barcode: {
      type: 'string',
      optional: true,
      description: 'Barcode/UPC for this variant',
    },

    // Status
    available: {
      type: 'boolean',
      description: 'Whether variant is available for purchase',
    },
  },

  relationships: {
    product: {
      type: 'Product',
      backref: 'variants',
      description: 'Parent product',
    },
    inventory: {
      type: 'Inventory',
      backref: 'variant',
      description: 'Inventory tracking for this variant',
    },
    orderItems: {
      type: 'OrderItem[]',
      backref: 'variant',
      description: 'Order items for this variant',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'updatePrice',
    'updateInventory',
    'enable',
    'disable',
    'addToCart',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'priceChanged',
    'inventoryUpdated',
    'enabled',
    'disabled',
    'purchased',
    'outOfStock',
    'restocked',
  ],
}

// =============================================================================
// Order
// =============================================================================

/**
 * Order entity
 *
 * Represents a customer order
 */
export const Order: Noun = {
  singular: 'order',
  plural: 'orders',
  description: 'A customer order containing one or more products',

  properties: {
    // Identity
    orderNumber: {
      type: 'string',
      description: 'Unique order number (human-readable)',
    },

    // Status
    status: {
      type: 'string',
      description: 'Order status: pending, confirmed, processing, shipped, delivered, cancelled, refunded',
      examples: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    },
    fulfillmentStatus: {
      type: 'string',
      optional: true,
      description: 'Fulfillment status: unfulfilled, partial, fulfilled',
      examples: ['unfulfilled', 'partial', 'fulfilled'],
    },
    paymentStatus: {
      type: 'string',
      description: 'Payment status: pending, paid, partial, refunded, failed',
      examples: ['pending', 'paid', 'partial', 'refunded', 'failed'],
    },

    // Amounts
    subtotal: {
      type: 'number',
      description: 'Subtotal before tax and shipping',
    },
    shippingCost: {
      type: 'number',
      optional: true,
      description: 'Shipping cost',
    },
    taxAmount: {
      type: 'number',
      optional: true,
      description: 'Total tax amount',
    },
    discountAmount: {
      type: 'number',
      optional: true,
      description: 'Total discount amount applied',
    },
    total: {
      type: 'number',
      description: 'Total amount charged',
    },
    currency: {
      type: 'string',
      description: 'Currency code',
      examples: ['USD', 'EUR', 'GBP', 'CAD'],
    },

    // Shipping
    shippingMethod: {
      type: 'string',
      optional: true,
      description: 'Selected shipping method',
    },
    shippingAddress: {
      type: 'json',
      description: 'Shipping address details',
    },
    billingAddress: {
      type: 'json',
      optional: true,
      description: 'Billing address details',
    },
    trackingNumber: {
      type: 'string',
      optional: true,
      description: 'Shipping tracking number',
    },
    trackingUrl: {
      type: 'url',
      optional: true,
      description: 'URL to track shipment',
    },

    // Payment
    paymentMethod: {
      type: 'string',
      optional: true,
      description: 'Payment method used: card, paypal, bank_transfer, etc.',
      examples: ['card', 'paypal', 'bank_transfer', 'apple_pay', 'google_pay'],
    },
    paymentReference: {
      type: 'string',
      optional: true,
      description: 'Payment gateway transaction reference',
    },

    // Customer
    customerEmail: {
      type: 'string',
      description: 'Customer email address',
    },
    customerPhone: {
      type: 'string',
      optional: true,
      description: 'Customer phone number',
    },

    // Discounts
    couponCode: {
      type: 'string',
      optional: true,
      description: 'Applied coupon code',
    },

    // Metadata
    notes: {
      type: 'string',
      optional: true,
      description: 'Order notes or special instructions',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Tags for organization',
    },
    source: {
      type: 'string',
      optional: true,
      description: 'Order source: web, mobile, phone, pos',
      examples: ['web', 'mobile', 'phone', 'pos'],
    },

    // Timestamps
    placedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the order was placed',
    },
    confirmedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the order was confirmed',
    },
    shippedAt: {
      type: 'datetime',
      optional: true,
      description: 'When the order was shipped',
    },
    deliveredAt: {
      type: 'datetime',
      optional: true,
      description: 'When the order was delivered',
    },
    cancelledAt: {
      type: 'datetime',
      optional: true,
      description: 'When the order was cancelled',
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      backref: 'orders',
      description: 'Customer who placed the order',
    },
    items: {
      type: 'OrderItem[]',
      backref: 'order',
      description: 'Line items in this order',
    },
    discount: {
      type: 'Discount',
      required: false,
      description: 'Applied discount/coupon',
    },
  },

  actions: [
    'create',
    'update',
    'confirm',
    'process',
    'fulfill',
    'ship',
    'deliver',
    'cancel',
    'refund',
    'addItem',
    'removeItem',
    'updateAddress',
    'applyDiscount',
    'removeDiscount',
    'sendNotification',
    'print',
    'export',
  ],

  events: [
    'created',
    'updated',
    'confirmed',
    'processing',
    'fulfilled',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
    'itemAdded',
    'itemRemoved',
    'addressUpdated',
    'discountApplied',
    'discountRemoved',
    'notificationSent',
    'printed',
    'exported',
  ],
}

/**
 * Order item entity
 *
 * Represents a line item in an order
 */
export const OrderItem: Noun = {
  singular: 'order item',
  plural: 'order items',
  description: 'A line item in an order',

  properties: {
    // Product Info
    productName: {
      type: 'string',
      description: 'Product name (snapshot at time of order)',
    },
    variantTitle: {
      type: 'string',
      optional: true,
      description: 'Variant title if applicable',
    },
    sku: {
      type: 'string',
      optional: true,
      description: 'Product or variant SKU',
    },

    // Quantity & Price
    quantity: {
      type: 'number',
      description: 'Quantity ordered',
    },
    price: {
      type: 'number',
      description: 'Unit price at time of order',
    },
    subtotal: {
      type: 'number',
      description: 'Line item subtotal (price × quantity)',
    },
    discountAmount: {
      type: 'number',
      optional: true,
      description: 'Discount applied to this line item',
    },
    taxAmount: {
      type: 'number',
      optional: true,
      description: 'Tax for this line item',
    },
    total: {
      type: 'number',
      description: 'Line item total',
    },

    // Fulfillment
    fulfillmentStatus: {
      type: 'string',
      optional: true,
      description: 'Fulfillment status: unfulfilled, fulfilled, returned',
      examples: ['unfulfilled', 'fulfilled', 'returned'],
    },
    quantityFulfilled: {
      type: 'number',
      optional: true,
      description: 'Quantity that has been fulfilled',
    },

    // Metadata
    image: {
      type: 'url',
      optional: true,
      description: 'Product image URL',
    },
    requiresShipping: {
      type: 'boolean',
      optional: true,
      description: 'Whether this item requires shipping',
    },
  },

  relationships: {
    order: {
      type: 'Order',
      backref: 'items',
      description: 'Parent order',
    },
    product: {
      type: 'Product',
      backref: 'orderItems',
      description: 'The product ordered',
    },
    variant: {
      type: 'ProductVariant',
      required: false,
      backref: 'orderItems',
      description: 'The variant ordered if applicable',
    },
  },

  actions: [
    'add',
    'update',
    'remove',
    'fulfill',
    'unfulfill',
    'return',
    'refund',
  ],

  events: [
    'added',
    'updated',
    'removed',
    'fulfilled',
    'unfulfilled',
    'returned',
    'refunded',
  ],
}

// =============================================================================
// Cart
// =============================================================================

/**
 * Shopping cart entity
 *
 * Represents a customer's shopping cart
 */
export const Cart: Noun = {
  singular: 'cart',
  plural: 'carts',
  description: 'A shopping cart containing products to be purchased',

  properties: {
    // Status
    status: {
      type: 'string',
      description: 'Cart status: active, abandoned, completed',
      examples: ['active', 'abandoned', 'completed'],
    },

    // Amounts
    subtotal: {
      type: 'number',
      optional: true,
      description: 'Subtotal of all items',
    },
    discountAmount: {
      type: 'number',
      optional: true,
      description: 'Total discount amount',
    },
    total: {
      type: 'number',
      optional: true,
      description: 'Total cart value',
    },
    currency: {
      type: 'string',
      description: 'Currency code',
      examples: ['USD', 'EUR', 'GBP', 'CAD'],
    },

    // Item Count
    itemCount: {
      type: 'number',
      optional: true,
      description: 'Total number of items in cart',
    },
    uniqueItemCount: {
      type: 'number',
      optional: true,
      description: 'Number of unique products in cart',
    },

    // Discounts
    couponCode: {
      type: 'string',
      optional: true,
      description: 'Applied coupon code',
    },

    // Session
    token: {
      type: 'string',
      optional: true,
      description: 'Cart token for anonymous users',
    },
    expiresAt: {
      type: 'datetime',
      optional: true,
      description: 'When the cart expires',
    },

    // Metadata
    notes: {
      type: 'string',
      optional: true,
      description: 'Customer notes or special instructions',
    },
    lastActivityAt: {
      type: 'datetime',
      optional: true,
      description: 'Last time cart was modified',
    },
  },

  relationships: {
    customer: {
      type: 'Customer',
      required: false,
      backref: 'carts',
      description: 'Customer who owns this cart (if logged in)',
    },
    items: {
      type: 'OrderItem[]',
      description: 'Items in the cart',
    },
    discount: {
      type: 'Discount',
      required: false,
      description: 'Applied discount/coupon',
    },
  },

  actions: [
    'create',
    'addItem',
    'removeItem',
    'updateItem',
    'clear',
    'applyCoupon',
    'removeCoupon',
    'checkout',
    'abandon',
    'recover',
    'merge',
  ],

  events: [
    'created',
    'itemAdded',
    'itemRemoved',
    'itemUpdated',
    'cleared',
    'couponApplied',
    'couponRemoved',
    'checkedOut',
    'abandoned',
    'recovered',
    'merged',
  ],
}

// =============================================================================
// Customer
// =============================================================================

/**
 * Customer entity
 *
 * Represents an e-commerce customer
 */
export const Customer: Noun = {
  singular: 'customer',
  plural: 'customers',
  description: 'An e-commerce customer',

  properties: {
    // Identity
    email: {
      type: 'string',
      description: 'Customer email address',
    },
    firstName: {
      type: 'string',
      optional: true,
      description: 'First name',
    },
    lastName: {
      type: 'string',
      optional: true,
      description: 'Last name',
    },
    phone: {
      type: 'string',
      optional: true,
      description: 'Phone number',
    },

    // Account
    acceptsMarketing: {
      type: 'boolean',
      optional: true,
      description: 'Whether customer accepts marketing emails',
    },
    emailVerified: {
      type: 'boolean',
      optional: true,
      description: 'Whether email has been verified',
    },

    // Status
    status: {
      type: 'string',
      optional: true,
      description: 'Customer status: active, disabled, invited',
      examples: ['active', 'disabled', 'invited'],
    },

    // Addresses
    defaultAddress: {
      type: 'json',
      optional: true,
      description: 'Default shipping address',
    },
    addresses: {
      type: 'json',
      array: true,
      optional: true,
      description: 'Saved addresses',
    },

    // Metadata
    notes: {
      type: 'string',
      optional: true,
      description: 'Internal notes about the customer',
    },
    tags: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Customer tags for segmentation',
    },

    // Statistics
    orderCount: {
      type: 'number',
      optional: true,
      description: 'Total number of orders',
    },
    totalSpent: {
      type: 'number',
      optional: true,
      description: 'Total amount spent',
    },
    averageOrderValue: {
      type: 'number',
      optional: true,
      description: 'Average order value',
    },

    // Timestamps
    lastOrderAt: {
      type: 'datetime',
      optional: true,
      description: 'Date of last order',
    },
    firstOrderAt: {
      type: 'datetime',
      optional: true,
      description: 'Date of first order',
    },
  },

  relationships: {
    orders: {
      type: 'Order[]',
      backref: 'customer',
      description: 'Customer orders',
    },
    carts: {
      type: 'Cart[]',
      backref: 'customer',
      description: 'Customer shopping carts',
    },
    reviews: {
      type: 'Review[]',
      backref: 'customer',
      description: 'Product reviews written by this customer',
    },
  },

  actions: [
    'create',
    'update',
    'delete',
    'enable',
    'disable',
    'invite',
    'addAddress',
    'updateAddress',
    'removeAddress',
    'setDefaultAddress',
    'sendEmail',
    'addNote',
    'tag',
    'untag',
    'merge',
    'export',
  ],

  events: [
    'created',
    'updated',
    'deleted',
    'enabled',
    'disabled',
    'invited',
    'addressAdded',
    'addressUpdated',
    'addressRemoved',
    'defaultAddressSet',
    'emailSent',
    'noteAdded',
    'tagged',
    'untagged',
    'merged',
    'exported',
    'orderPlaced',
    'emailVerified',
  ],
}

// =============================================================================
// Inventory
// =============================================================================

/**
 * Inventory entity
 *
 * Tracks inventory for products and variants
 */
export const Inventory: Noun = {
  singular: 'inventory',
  plural: 'inventories',
  description: 'Inventory tracking for a product or variant',

  properties: {
    // Quantity
    quantity: {
      type: 'number',
      description: 'Available quantity',
    },
    reservedQuantity: {
      type: 'number',
      optional: true,
      description: 'Quantity reserved for pending orders',
    },
    availableQuantity: {
      type: 'number',
      optional: true,
      description: 'Quantity available for new orders',
    },

    // Thresholds
    lowStockThreshold: {
      type: 'number',
      optional: true,
      description: 'Threshold for low stock warning',
    },
    isLowStock: {
      type: 'boolean',
      optional: true,
      description: 'Whether inventory is below threshold',
    },
    isOutOfStock: {
      type: 'boolean',
      optional: true,
      description: 'Whether inventory is out of stock',
    },

    // Policy
    allowBackorder: {
      type: 'boolean',
      optional: true,
      description: 'Whether to allow backorders when out of stock',
    },
    trackInventory: {
      type: 'boolean',
      description: 'Whether to track inventory for this item',
    },

    // Location
    location: {
      type: 'string',
      optional: true,
      description: 'Warehouse or location name',
    },
    bin: {
      type: 'string',
      optional: true,
      description: 'Bin or shelf location',
    },

    // Metadata
    lastRestockedAt: {
      type: 'datetime',
      optional: true,
      description: 'Last time inventory was restocked',
    },
    lastCountedAt: {
      type: 'datetime',
      optional: true,
      description: 'Last physical inventory count',
    },
  },

  relationships: {
    product: {
      type: 'Product',
      required: false,
      backref: 'inventory',
      description: 'Product being tracked',
    },
    variant: {
      type: 'ProductVariant',
      required: false,
      backref: 'inventory',
      description: 'Variant being tracked',
    },
  },

  actions: [
    'create',
    'update',
    'adjust',
    'reserve',
    'release',
    'restock',
    'count',
    'transfer',
    'setThreshold',
  ],

  events: [
    'created',
    'updated',
    'adjusted',
    'reserved',
    'released',
    'restocked',
    'counted',
    'transferred',
    'thresholdSet',
    'lowStock',
    'outOfStock',
    'backInStock',
  ],
}

// =============================================================================
// Discount
// =============================================================================

/**
 * Discount entity
 *
 * Represents a discount code or coupon
 */
export const Discount: Noun = {
  singular: 'discount',
  plural: 'discounts',
  description: 'A discount code or coupon',

  properties: {
    // Identity
    code: {
      type: 'string',
      description: 'Discount code (e.g., "SAVE20")',
    },
    name: {
      type: 'string',
      optional: true,
      description: 'Internal name for the discount',
    },

    // Type
    type: {
      type: 'string',
      description: 'Discount type: percentage, fixed_amount, free_shipping',
      examples: ['percentage', 'fixed_amount', 'free_shipping'],
    },
    value: {
      type: 'number',
      description: 'Discount value (percentage or amount)',
    },

    // Conditions
    minimumPurchase: {
      type: 'number',
      optional: true,
      description: 'Minimum purchase amount required',
    },
    minimumQuantity: {
      type: 'number',
      optional: true,
      description: 'Minimum quantity of items required',
    },
    appliesToProducts: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Product IDs this discount applies to',
    },
    appliesToCategories: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Categories this discount applies to',
    },
    excludedProducts: {
      type: 'string',
      array: true,
      optional: true,
      description: 'Product IDs excluded from discount',
    },

    // Usage
    usageLimit: {
      type: 'number',
      optional: true,
      description: 'Maximum number of times code can be used',
    },
    usageCount: {
      type: 'number',
      optional: true,
      description: 'Number of times code has been used',
    },
    usageLimitPerCustomer: {
      type: 'number',
      optional: true,
      description: 'Max uses per customer',
    },
    oneTimeUse: {
      type: 'boolean',
      optional: true,
      description: 'Whether code can only be used once',
    },

    // Validity
    startsAt: {
      type: 'datetime',
      optional: true,
      description: 'When discount becomes active',
    },
    endsAt: {
      type: 'datetime',
      optional: true,
      description: 'When discount expires',
    },
    active: {
      type: 'boolean',
      description: 'Whether discount is currently active',
    },

    // Metadata
    description: {
      type: 'string',
      optional: true,
      description: 'Description of the discount',
    },
  },

  relationships: {
    orders: {
      type: 'Order[]',
      description: 'Orders that used this discount',
    },
  },

  actions: [
    'create',
    'update',
    'activate',
    'deactivate',
    'delete',
    'apply',
    'remove',
    'extend',
    'duplicate',
  ],

  events: [
    'created',
    'updated',
    'activated',
    'deactivated',
    'deleted',
    'applied',
    'removed',
    'extended',
    'duplicated',
    'expired',
    'limitReached',
  ],
}

// =============================================================================
// Review
// =============================================================================

/**
 * Review entity
 *
 * Represents a product review
 */
export const Review: Noun = {
  singular: 'review',
  plural: 'reviews',
  description: 'A customer review of a product',

  properties: {
    // Rating
    rating: {
      type: 'number',
      description: 'Star rating (typically 1-5)',
    },

    // Content
    title: {
      type: 'string',
      optional: true,
      description: 'Review title or headline',
    },
    body: {
      type: 'string',
      description: 'Review text content',
    },

    // Author
    authorName: {
      type: 'string',
      optional: true,
      description: 'Name of reviewer',
    },
    authorEmail: {
      type: 'string',
      optional: true,
      description: 'Email of reviewer',
    },
    verified: {
      type: 'boolean',
      optional: true,
      description: 'Whether reviewer is a verified purchaser',
    },

    // Status
    status: {
      type: 'string',
      description: 'Review status: pending, published, rejected',
      examples: ['pending', 'published', 'rejected'],
    },
    publishedAt: {
      type: 'datetime',
      optional: true,
      description: 'When review was published',
    },

    // Engagement
    helpful: {
      type: 'number',
      optional: true,
      description: 'Number of "helpful" votes',
    },
    notHelpful: {
      type: 'number',
      optional: true,
      description: 'Number of "not helpful" votes',
    },

    // Media
    images: {
      type: 'url',
      array: true,
      optional: true,
      description: 'Customer-submitted images',
    },
    videos: {
      type: 'url',
      array: true,
      optional: true,
      description: 'Customer-submitted videos',
    },

    // Metadata
    source: {
      type: 'string',
      optional: true,
      description: 'Review source: website, email, imported',
      examples: ['website', 'email', 'imported'],
    },
  },

  relationships: {
    product: {
      type: 'Product',
      backref: 'reviews',
      description: 'Product being reviewed',
    },
    customer: {
      type: 'Customer',
      required: false,
      backref: 'reviews',
      description: 'Customer who wrote the review',
    },
  },

  actions: [
    'create',
    'update',
    'publish',
    'unpublish',
    'approve',
    'reject',
    'delete',
    'markHelpful',
    'markNotHelpful',
    'reply',
    'flag',
  ],

  events: [
    'created',
    'updated',
    'published',
    'unpublished',
    'approved',
    'rejected',
    'deleted',
    'markedHelpful',
    'markedNotHelpful',
    'replied',
    'flagged',
  ],
}

// =============================================================================
// Export all entities as a schema
// =============================================================================

/**
 * All e-commerce entity types
 */
export const EcommerceEntities = {
  Product,
  ProductVariant,
  Order,
  OrderItem,
  Cart,
  Customer,
  Inventory,
  Discount,
  Review,
}

/**
 * Entity categories for organization
 */
export const EcommerceCategories = {
  products: ['Product', 'ProductVariant'],
  orders: ['Order', 'OrderItem'],
  cart: ['Cart'],
  customers: ['Customer'],
  inventory: ['Inventory'],
  marketing: ['Discount'],
  reviews: ['Review'],
} as const
