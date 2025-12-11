/**
 * Operations & Logistics Types
 *
 * Comprehensive types for operations and logistics management:
 * Products, Inventory, Warehousing, Purchasing, Shipping, Returns,
 * Fulfillment, Manufacturing, and Quality Control.
 *
 * @module ops
 */

import type {
  Input,
  Output,
  Action,
  BaseEvent,
  EventHandler,
  CRUDResource,
  ListParams,
  PaginatedResult,
} from '@/core/rpc'

// =============================================================================
// Product
// =============================================================================

/**
 * Product status.
 */
export type ProductStatus = 'active' | 'inactive' | 'archived' | 'discontinued'

/**
 * Physical or digital product tracked in inventory.
 *
 * @example
 * ```ts
 * const product: Product = {
 *   id: 'prod_123',
 *   sku: 'WIDGET-001',
 *   name: 'Premium Widget',
 *   description: 'High-quality widget for industrial use',
 *   status: 'active',
 *   type: 'physical',
 *   weight: 2.5,
 *   weightUnit: 'kg',
 *   dimensions: { length: 10, width: 8, height: 6, unit: 'cm' },
 *   price: 4999,
 *   currency: 'USD',
 *   costPrice: 2500,
 *   reorderPoint: 100,
 *   reorderQuantity: 500,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Product {
  /** Unique identifier */
  id: string

  /** Stock keeping unit */
  sku: string

  /** Product name */
  name: string

  /** Product description */
  description?: string

  /** Product status */
  status: ProductStatus

  /** Product type */
  type: 'physical' | 'digital' | 'service' | 'bundle'

  /** Category */
  category?: string

  /** Brand */
  brand?: string

  /** Manufacturer */
  manufacturer?: string

  /** UPC/EAN barcode */
  barcode?: string

  /** Weight */
  weight?: number

  /** Weight unit */
  weightUnit?: 'kg' | 'lb' | 'oz' | 'g'

  /** Dimensions */
  dimensions?: {
    length: number
    width: number
    height: number
    unit: 'cm' | 'in' | 'm'
  }

  /** Selling price (in cents) */
  price?: number

  /** Currency */
  currency?: string

  /** Cost price (in cents) */
  costPrice?: number

  /** Compare at price (MSRP) */
  compareAtPrice?: number

  /** Requires shipping */
  requiresShipping?: boolean

  /** Taxable */
  taxable?: boolean

  /** Tax code */
  taxCode?: string

  /** Reorder point (stock level that triggers reorder) */
  reorderPoint?: number

  /** Reorder quantity */
  reorderQuantity?: number

  /** Lead time (days) */
  leadTime?: number

  /** Country of origin */
  countryOfOrigin?: string

  /** HS tariff code */
  hsTariffCode?: string

  /** Image URLs */
  images?: string[]

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    shopify?: string
    woocommerce?: string
    magento?: string
    netsuite?: string
    erp?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ProductInput = Input<Product>
export type ProductOutput = Output<Product>

// =============================================================================
// ProductVariant
// =============================================================================

/**
 * Product variation (e.g., size, color).
 *
 * @example
 * ```ts
 * const variant: ProductVariant = {
 *   id: 'var_123',
 *   productId: 'prod_123',
 *   sku: 'WIDGET-001-RED-L',
 *   name: 'Premium Widget - Red - Large',
 *   options: { color: 'Red', size: 'Large' },
 *   price: 5499,
 *   compareAtPrice: 6999,
 *   weight: 2.8,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ProductVariant {
  /** Unique identifier */
  id: string

  /** Parent product ID */
  productId: string

  /** Variant SKU */
  sku: string

  /** Variant name */
  name?: string

  /** Variant options */
  options: Record<string, string>

  /** Price override */
  price?: number

  /** Compare at price override */
  compareAtPrice?: number

  /** Weight override */
  weight?: number

  /** Barcode */
  barcode?: string

  /** Image URL */
  imageUrl?: string

  /** Position in list */
  position?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    shopify?: string
    woocommerce?: string
    magento?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ProductVariantInput = Input<ProductVariant>
export type ProductVariantOutput = Output<ProductVariant>

// =============================================================================
// Inventory
// =============================================================================

/**
 * Inventory status.
 */
export type InventoryStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'backordered' | 'discontinued'

/**
 * Inventory level for a product at a location.
 *
 * @example
 * ```ts
 * const inventory: Inventory = {
 *   id: 'inv_123',
 *   productId: 'prod_123',
 *   variantId: 'var_123',
 *   locationId: 'loc_123',
 *   quantityAvailable: 150,
 *   quantityReserved: 25,
 *   quantityOnHand: 175,
 *   quantityIncoming: 500,
 *   status: 'in_stock',
 *   binLocation: 'A-12-3',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Inventory {
  /** Unique identifier */
  id: string

  /** Product ID */
  productId: string

  /** Variant ID (if applicable) */
  variantId?: string

  /** Location ID */
  locationId: string

  /** Available quantity (on hand - reserved) */
  quantityAvailable: number

  /** Reserved quantity (allocated but not shipped) */
  quantityReserved: number

  /** On hand quantity (physical count) */
  quantityOnHand: number

  /** Incoming quantity (in transit) */
  quantityIncoming?: number

  /** Committed quantity (in open orders) */
  quantityCommitted?: number

  /** Inventory status */
  status: InventoryStatus

  /** Bin/location within warehouse */
  binLocation?: string

  /** Last counted date */
  lastCountedAt?: Date

  /** Last movement date */
  lastMovementAt?: Date

  /** Lot number */
  lotNumber?: string

  /** Serial numbers */
  serialNumbers?: string[]

  /** Expiration date */
  expirationDate?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    wms?: string
    erp?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type InventoryInput = Input<Inventory>
export type InventoryOutput = Output<Inventory>

// =============================================================================
// InventoryLocation
// =============================================================================

/**
 * Warehouse or storage location.
 *
 * @example
 * ```ts
 * const location: InventoryLocation = {
 *   id: 'loc_123',
 *   name: 'Main Warehouse',
 *   code: 'WH-001',
 *   type: 'warehouse',
 *   address: {
 *     line1: '123 Industrial Pkwy',
 *     city: 'Chicago',
 *     state: 'IL',
 *     postalCode: '60601',
 *     country: 'US'
 *   },
 *   active: true,
 *   fulfillmentPriority: 1,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface InventoryLocation {
  /** Unique identifier */
  id: string

  /** Location name */
  name: string

  /** Location code */
  code: string

  /** Location type */
  type: 'warehouse' | 'store' | 'distribution_center' | 'dropship' | 'virtual'

  /** Address */
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Active status */
  active: boolean

  /** Can fulfill orders */
  fulfillmentEnabled?: boolean

  /** Fulfillment priority */
  fulfillmentPriority?: number

  /** Contact info */
  contact?: {
    name?: string
    email?: string
    phone?: string
  }

  /** Operating hours */
  operatingHours?: {
    monday?: { open: string; close: string }
    tuesday?: { open: string; close: string }
    wednesday?: { open: string; close: string }
    thursday?: { open: string; close: string }
    friday?: { open: string; close: string }
    saturday?: { open: string; close: string }
    sunday?: { open: string; close: string }
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    wms?: string
    erp?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type InventoryLocationInput = Input<InventoryLocation>
export type InventoryLocationOutput = Output<InventoryLocation>

// =============================================================================
// InventoryMovement
// =============================================================================

/**
 * Movement type.
 */
export type MovementType =
  | 'receipt'
  | 'shipment'
  | 'adjustment'
  | 'transfer'
  | 'return'
  | 'damage'
  | 'theft'
  | 'cycle_count'
  | 'production'
  | 'consumption'

/**
 * Stock movement record.
 *
 * @example
 * ```ts
 * const movement: InventoryMovement = {
 *   id: 'mov_123',
 *   productId: 'prod_123',
 *   variantId: 'var_123',
 *   locationId: 'loc_123',
 *   type: 'receipt',
 *   quantity: 500,
 *   quantityBefore: 100,
 *   quantityAfter: 600,
 *   reference: 'PO-2024-001',
 *   referenceId: 'po_123',
 *   notes: 'Received purchase order shipment',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface InventoryMovement {
  /** Unique identifier */
  id: string

  /** Product ID */
  productId: string

  /** Variant ID (if applicable) */
  variantId?: string

  /** Location ID */
  locationId: string

  /** Destination location (for transfers) */
  destinationLocationId?: string

  /** Movement type */
  type: MovementType

  /** Quantity changed (positive or negative) */
  quantity: number

  /** Quantity before movement */
  quantityBefore: number

  /** Quantity after movement */
  quantityAfter: number

  /** Reference number */
  reference?: string

  /** Reference ID (order, PO, etc.) */
  referenceId?: string

  /** Reason */
  reason?: string

  /** Notes */
  notes?: string

  /** User who performed movement */
  userId?: string

  /** Lot number */
  lotNumber?: string

  /** Serial numbers */
  serialNumbers?: string[]

  /** Cost per unit */
  costPerUnit?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    wms?: string
    erp?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type InventoryMovementInput = Input<InventoryMovement>
export type InventoryMovementOutput = Output<InventoryMovement>

// =============================================================================
// Warehouse
// =============================================================================

/**
 * Warehouse facility.
 *
 * @example
 * ```ts
 * const warehouse: Warehouse = {
 *   id: 'wh_123',
 *   name: 'Chicago Distribution Center',
 *   code: 'CDC-001',
 *   type: 'distribution_center',
 *   capacity: 100000,
 *   utilization: 75000,
 *   address: {
 *     line1: '123 Industrial Pkwy',
 *     city: 'Chicago',
 *     state: 'IL',
 *     postalCode: '60601',
 *     country: 'US'
 *   },
 *   active: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Warehouse {
  /** Unique identifier */
  id: string

  /** Warehouse name */
  name: string

  /** Warehouse code */
  code: string

  /** Warehouse type */
  type: 'warehouse' | 'distribution_center' | 'fulfillment_center' | 'cold_storage' | 'cross_dock'

  /** Address */
  address: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }

  /** Total capacity (sq ft or m²) */
  capacity?: number

  /** Current utilization */
  utilization?: number

  /** Capacity unit */
  capacityUnit?: 'sqft' | 'sqm' | 'pallets' | 'units'

  /** Active status */
  active: boolean

  /** Manager ID */
  managerId?: string

  /** Contact info */
  contact?: {
    name?: string
    email?: string
    phone?: string
  }

  /** Timezone */
  timezone?: string

  /** Certifications */
  certifications?: string[]

  /** Equipment */
  equipment?: {
    forklifts?: number
    conveyors?: boolean
    automation?: boolean
    refrigeration?: boolean
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    wms?: string
    erp?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type WarehouseInput = Input<Warehouse>
export type WarehouseOutput = Output<Warehouse>

// =============================================================================
// Bin
// =============================================================================

/**
 * Storage bin or location within warehouse.
 *
 * @example
 * ```ts
 * const bin: Bin = {
 *   id: 'bin_123',
 *   warehouseId: 'wh_123',
 *   code: 'A-12-3',
 *   zone: 'A',
 *   aisle: '12',
 *   shelf: '3',
 *   type: 'shelf',
 *   capacity: 100,
 *   occupied: 75,
 *   active: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Bin {
  /** Unique identifier */
  id: string

  /** Warehouse ID */
  warehouseId: string

  /** Bin code */
  code: string

  /** Zone */
  zone?: string

  /** Aisle */
  aisle?: string

  /** Shelf */
  shelf?: string

  /** Level */
  level?: string

  /** Bin type */
  type: 'shelf' | 'pallet' | 'floor' | 'bin' | 'cage' | 'rack' | 'bulk'

  /** Capacity (units or weight) */
  capacity?: number

  /** Currently occupied */
  occupied?: number

  /** Capacity unit */
  capacityUnit?: 'units' | 'kg' | 'lb' | 'pallets'

  /** Active status */
  active: boolean

  /** Requires special handling */
  specialHandling?: boolean

  /** Temperature controlled */
  temperatureControlled?: boolean

  /** Min temperature */
  minTemperature?: number

  /** Max temperature */
  maxTemperature?: number

  /** Temperature unit */
  temperatureUnit?: 'C' | 'F'

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    wms?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BinInput = Input<Bin>
export type BinOutput = Output<Bin>

// =============================================================================
// Supplier
// =============================================================================

/**
 * Supplier or vendor.
 *
 * @example
 * ```ts
 * const supplier: Supplier = {
 *   id: 'sup_123',
 *   name: 'Acme Suppliers Inc',
 *   code: 'SUP-001',
 *   email: 'orders@acme-suppliers.com',
 *   phone: '+1-555-0100',
 *   address: {
 *     line1: '456 Vendor St',
 *     city: 'New York',
 *     state: 'NY',
 *     postalCode: '10001',
 *     country: 'US'
 *   },
 *   status: 'active',
 *   rating: 4.5,
 *   paymentTerms: 'Net 30',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Supplier {
  /** Unique identifier */
  id: string

  /** Supplier name */
  name: string

  /** Supplier code */
  code: string

  /** Status */
  status: 'active' | 'inactive' | 'suspended'

  /** Email */
  email?: string

  /** Phone */
  phone?: string

  /** Website */
  website?: string

  /** Address */
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Contact person */
  contactPerson?: {
    name?: string
    email?: string
    phone?: string
    title?: string
  }

  /** Payment terms */
  paymentTerms?: string

  /** Currency */
  currency?: string

  /** Tax ID */
  taxId?: string

  /** Lead time (days) */
  leadTime?: number

  /** Minimum order quantity */
  minimumOrderQuantity?: number

  /** Minimum order value */
  minimumOrderValue?: number

  /** Supplier rating (0-5) */
  rating?: number

  /** Categories */
  categories?: string[]

  /** Tags */
  tags?: string[]

  /** Notes */
  notes?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    erp?: string
    netsuite?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SupplierInput = Input<Supplier>
export type SupplierOutput = Output<Supplier>

// =============================================================================
// PurchaseOrder
// =============================================================================

/**
 * Purchase order status.
 */
export type PurchaseOrderStatus = 'draft' | 'pending' | 'approved' | 'ordered' | 'partially_received' | 'received' | 'cancelled' | 'closed'

/**
 * Purchase order to supplier.
 *
 * @example
 * ```ts
 * const po: PurchaseOrder = {
 *   id: 'po_123',
 *   number: 'PO-2024-001',
 *   supplierId: 'sup_123',
 *   status: 'approved',
 *   orderDate: new Date(),
 *   expectedDate: new Date('2024-03-15'),
 *   subtotal: 10000,
 *   tax: 800,
 *   shipping: 500,
 *   total: 11300,
 *   currency: 'USD',
 *   destinationLocationId: 'loc_123',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface PurchaseOrder {
  /** Unique identifier */
  id: string

  /** PO number */
  number: string

  /** Supplier ID */
  supplierId: string

  /** PO status */
  status: PurchaseOrderStatus

  /** Order date */
  orderDate: Date

  /** Expected delivery date */
  expectedDate?: Date

  /** Delivery deadline */
  deadline?: Date

  /** Destination location */
  destinationLocationId: string

  /** Subtotal (in cents) */
  subtotal: number

  /** Tax amount */
  tax?: number

  /** Shipping cost */
  shipping?: number

  /** Discount */
  discount?: number

  /** Total amount */
  total: number

  /** Currency */
  currency: string

  /** Payment terms */
  paymentTerms?: string

  /** Shipping method */
  shippingMethod?: string

  /** Shipping address */
  shippingAddress?: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }

  /** Billing address */
  billingAddress?: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }

  /** Notes */
  notes?: string

  /** Internal notes */
  internalNotes?: string

  /** Approved by */
  approvedBy?: string

  /** Approved at */
  approvedAt?: Date

  /** Ordered by */
  orderedBy?: string

  /** Ordered at */
  orderedAt?: Date

  /** Received at */
  receivedAt?: Date

  /** Cancelled by */
  cancelledBy?: string

  /** Cancelled at */
  cancelledAt?: Date

  /** Cancellation reason */
  cancellationReason?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    erp?: string
    netsuite?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PurchaseOrderInput = Input<PurchaseOrder>
export type PurchaseOrderOutput = Output<PurchaseOrder>

// =============================================================================
// PurchaseOrderItem
// =============================================================================

/**
 * Line item in purchase order.
 *
 * @example
 * ```ts
 * const item: PurchaseOrderItem = {
 *   id: 'poi_123',
 *   purchaseOrderId: 'po_123',
 *   productId: 'prod_123',
 *   variantId: 'var_123',
 *   quantity: 500,
 *   quantityReceived: 500,
 *   unitPrice: 2500,
 *   total: 1250000,
 *   currency: 'USD',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface PurchaseOrderItem {
  /** Unique identifier */
  id: string

  /** Purchase order ID */
  purchaseOrderId: string

  /** Product ID */
  productId: string

  /** Variant ID */
  variantId?: string

  /** SKU */
  sku?: string

  /** Product name */
  name?: string

  /** Quantity ordered */
  quantity: number

  /** Quantity received */
  quantityReceived: number

  /** Unit price (in cents) */
  unitPrice: number

  /** Tax amount */
  tax?: number

  /** Discount amount */
  discount?: number

  /** Line total */
  total: number

  /** Currency */
  currency: string

  /** Expected date */
  expectedDate?: Date

  /** Notes */
  notes?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PurchaseOrderItemInput = Input<PurchaseOrderItem>
export type PurchaseOrderItemOutput = Output<PurchaseOrderItem>

// =============================================================================
// Receiving
// =============================================================================

/**
 * Goods receipt record.
 *
 * @example
 * ```ts
 * const receiving: Receiving = {
 *   id: 'rcv_123',
 *   purchaseOrderId: 'po_123',
 *   locationId: 'loc_123',
 *   receivedDate: new Date(),
 *   receivedBy: 'user_456',
 *   status: 'completed',
 *   notes: 'All items received in good condition',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Receiving {
  /** Unique identifier */
  id: string

  /** Purchase order ID */
  purchaseOrderId: string

  /** Receiving number */
  number?: string

  /** Destination location */
  locationId: string

  /** Status */
  status: 'pending' | 'in_progress' | 'completed' | 'discrepancy'

  /** Received date */
  receivedDate: Date

  /** Received by user */
  receivedBy: string

  /** Carrier */
  carrier?: string

  /** Tracking number */
  trackingNumber?: string

  /** Number of packages */
  packageCount?: number

  /** Discrepancies found */
  hasDiscrepancies?: boolean

  /** Notes */
  notes?: string

  /** Attachments */
  attachments?: {
    url: string
    type: string
    name: string
  }[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    wms?: string
    erp?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ReceivingInput = Input<Receiving>
export type ReceivingOutput = Output<Receiving>

// =============================================================================
// Shipment
// =============================================================================

/**
 * Shipment status.
 */
export type ShipmentStatus =
  | 'pending'
  | 'processing'
  | 'picked'
  | 'packed'
  | 'labeled'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'returned'

/**
 * Outbound shipment.
 *
 * @example
 * ```ts
 * const shipment: Shipment = {
 *   id: 'shp_123',
 *   number: 'SHP-2024-001',
 *   orderId: 'ord_123',
 *   status: 'shipped',
 *   carrierId: 'car_123',
 *   carrierService: 'ground',
 *   trackingNumber: '1Z999AA10123456784',
 *   trackingUrl: 'https://tracking.example.com/1Z999AA10123456784',
 *   locationId: 'loc_123',
 *   shippingAddress: {
 *     name: 'John Doe',
 *     line1: '123 Main St',
 *     city: 'San Francisco',
 *     state: 'CA',
 *     postalCode: '94102',
 *     country: 'US'
 *   },
 *   shippedAt: new Date(),
 *   estimatedDelivery: new Date('2024-03-10'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Shipment {
  /** Unique identifier */
  id: string

  /** Shipment number */
  number: string

  /** Related order ID */
  orderId?: string

  /** Related fulfillment ID */
  fulfillmentId?: string

  /** Status */
  status: ShipmentStatus

  /** Carrier ID */
  carrierId?: string

  /** Carrier name */
  carrier?: string

  /** Carrier service level */
  carrierService?: string

  /** Tracking number */
  trackingNumber?: string

  /** Tracking URL */
  trackingUrl?: string

  /** Label URL */
  labelUrl?: string

  /** Origin location */
  locationId: string

  /** Shipping address */
  shippingAddress: {
    name: string
    company?: string
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
    phone?: string
    email?: string
  }

  /** Weight */
  weight?: number

  /** Weight unit */
  weightUnit?: 'kg' | 'lb' | 'oz' | 'g'

  /** Dimensions */
  dimensions?: {
    length: number
    width: number
    height: number
    unit: 'cm' | 'in'
  }

  /** Shipping cost (in cents) */
  shippingCost?: number

  /** Insurance value */
  insuranceValue?: number

  /** Currency */
  currency?: string

  /** Number of packages */
  packageCount?: number

  /** Signature required */
  signatureRequired?: boolean

  /** Picked at */
  pickedAt?: Date

  /** Packed at */
  packedAt?: Date

  /** Shipped at */
  shippedAt?: Date

  /** Estimated delivery */
  estimatedDelivery?: Date

  /** Delivered at */
  deliveredAt?: Date

  /** Failed at */
  failedAt?: Date

  /** Failure reason */
  failureReason?: string

  /** Notes */
  notes?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    shipstation?: string
    easypost?: string
    shopify?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ShipmentInput = Input<Shipment>
export type ShipmentOutput = Output<Shipment>

// =============================================================================
// ShipmentItem
// =============================================================================

/**
 * Item in shipment.
 *
 * @example
 * ```ts
 * const item: ShipmentItem = {
 *   id: 'shi_123',
 *   shipmentId: 'shp_123',
 *   productId: 'prod_123',
 *   variantId: 'var_123',
 *   quantity: 2,
 *   binLocation: 'A-12-3',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ShipmentItem {
  /** Unique identifier */
  id: string

  /** Shipment ID */
  shipmentId: string

  /** Product ID */
  productId: string

  /** Variant ID */
  variantId?: string

  /** SKU */
  sku?: string

  /** Product name */
  name?: string

  /** Quantity */
  quantity: number

  /** Bin location */
  binLocation?: string

  /** Lot number */
  lotNumber?: string

  /** Serial numbers */
  serialNumbers?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ShipmentItemInput = Input<ShipmentItem>
export type ShipmentItemOutput = Output<ShipmentItem>

// =============================================================================
// Carrier
// =============================================================================

/**
 * Shipping carrier.
 *
 * @example
 * ```ts
 * const carrier: Carrier = {
 *   id: 'car_123',
 *   name: 'UPS',
 *   code: 'ups',
 *   active: true,
 *   services: [
 *     { code: 'ground', name: 'UPS Ground', transitDays: '1-5' },
 *     { code: 'next_day', name: 'UPS Next Day Air', transitDays: '1' }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Carrier {
  /** Unique identifier */
  id: string

  /** Carrier name */
  name: string

  /** Carrier code */
  code: string

  /** Active status */
  active: boolean

  /** Website */
  website?: string

  /** Tracking URL template */
  trackingUrlTemplate?: string

  /** Services offered */
  services?: {
    code: string
    name: string
    transitDays?: string
    description?: string
  }[]

  /** Account number */
  accountNumber?: string

  /** API credentials */
  apiCredentials?: {
    username?: string
    password?: string
    apiKey?: string
    secret?: string
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    shipstation?: string
    easypost?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CarrierInput = Input<Carrier>
export type CarrierOutput = Output<Carrier>

// =============================================================================
// ShippingRate
// =============================================================================

/**
 * Shipping rate quote.
 *
 * @example
 * ```ts
 * const rate: ShippingRate = {
 *   id: 'rate_123',
 *   carrierId: 'car_123',
 *   carrier: 'UPS',
 *   service: 'ground',
 *   serviceName: 'UPS Ground',
 *   rate: 1250,
 *   currency: 'USD',
 *   transitDays: '3-5',
 *   deliveryDate: new Date('2024-03-08'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ShippingRate {
  /** Unique identifier */
  id: string

  /** Carrier ID */
  carrierId?: string

  /** Carrier name */
  carrier: string

  /** Service code */
  service: string

  /** Service name */
  serviceName: string

  /** Rate amount (in cents) */
  rate: number

  /** Currency */
  currency: string

  /** Transit days estimate */
  transitDays?: string

  /** Estimated delivery date */
  deliveryDate?: Date

  /** Delivery guarantee */
  deliveryGuarantee?: boolean

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    shipstation?: string
    easypost?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ShippingRateInput = Input<ShippingRate>
export type ShippingRateOutput = Output<ShippingRate>

// =============================================================================
// TrackingEvent
// =============================================================================

/**
 * Shipment tracking event.
 *
 * @example
 * ```ts
 * const event: TrackingEvent = {
 *   id: 'trk_123',
 *   shipmentId: 'shp_123',
 *   status: 'in_transit',
 *   message: 'Package is in transit',
 *   location: 'Memphis, TN',
 *   timestamp: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface TrackingEvent {
  /** Unique identifier */
  id: string

  /** Shipment ID */
  shipmentId: string

  /** Event status */
  status: string

  /** Event message */
  message: string

  /** Location */
  location?: string

  /** City */
  city?: string

  /** State */
  state?: string

  /** Country */
  country?: string

  /** Event timestamp */
  timestamp: Date

  /** Carrier */
  carrier?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    carrier?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TrackingEventInput = Input<TrackingEvent>
export type TrackingEventOutput = Output<TrackingEvent>

// =============================================================================
// Return
// =============================================================================

/**
 * Return status.
 */
export type ReturnStatus = 'pending' | 'approved' | 'received' | 'inspected' | 'refunded' | 'rejected' | 'cancelled'

/**
 * Return merchandise authorization.
 *
 * @example
 * ```ts
 * const returnRecord: Return = {
 *   id: 'ret_123',
 *   number: 'RMA-2024-001',
 *   orderId: 'ord_123',
 *   shipmentId: 'shp_123',
 *   status: 'approved',
 *   reason: 'defective',
 *   requestedAt: new Date(),
 *   approvedAt: new Date(),
 *   locationId: 'loc_123',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Return {
  /** Unique identifier */
  id: string

  /** RMA number */
  number: string

  /** Original order ID */
  orderId?: string

  /** Original shipment ID */
  shipmentId?: string

  /** Customer ID */
  customerId?: string

  /** Status */
  status: ReturnStatus

  /** Return reason */
  reason: 'defective' | 'wrong_item' | 'damaged' | 'not_as_described' | 'unwanted' | 'other'

  /** Detailed reason */
  reasonDetails?: string

  /** Requested date */
  requestedAt: Date

  /** Approved date */
  approvedAt?: Date

  /** Approved by */
  approvedBy?: string

  /** Return location */
  locationId?: string

  /** Return address */
  returnAddress?: {
    name: string
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }

  /** Return shipping label URL */
  shippingLabelUrl?: string

  /** Return tracking number */
  trackingNumber?: string

  /** Carrier */
  carrier?: string

  /** Received date */
  receivedAt?: Date

  /** Received by */
  receivedBy?: string

  /** Inspected date */
  inspectedAt?: Date

  /** Inspected by */
  inspectedBy?: string

  /** Inspection notes */
  inspectionNotes?: string

  /** Refund amount (in cents) */
  refundAmount?: number

  /** Restocking fee */
  restockingFee?: number

  /** Currency */
  currency?: string

  /** Refunded date */
  refundedAt?: Date

  /** Refund method */
  refundMethod?: 'original' | 'store_credit' | 'exchange'

  /** Notes */
  notes?: string

  /** Customer notes */
  customerNotes?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    shopify?: string
    returnly?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ReturnInput = Input<Return>
export type ReturnOutput = Output<Return>

// =============================================================================
// ReturnItem
// =============================================================================

/**
 * Item in return.
 *
 * @example
 * ```ts
 * const item: ReturnItem = {
 *   id: 'rti_123',
 *   returnId: 'ret_123',
 *   productId: 'prod_123',
 *   variantId: 'var_123',
 *   quantity: 1,
 *   condition: 'defective',
 *   restockable: false,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ReturnItem {
  /** Unique identifier */
  id: string

  /** Return ID */
  returnId: string

  /** Product ID */
  productId: string

  /** Variant ID */
  variantId?: string

  /** SKU */
  sku?: string

  /** Product name */
  name?: string

  /** Quantity */
  quantity: number

  /** Item condition */
  condition: 'new' | 'opened' | 'used' | 'defective' | 'damaged'

  /** Restockable */
  restockable: boolean

  /** Reason */
  reason?: string

  /** Notes */
  notes?: string

  /** Refund amount */
  refundAmount?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ReturnItemInput = Input<ReturnItem>
export type ReturnItemOutput = Output<ReturnItem>

// =============================================================================
// Fulfillment
// =============================================================================

/**
 * Fulfillment status.
 */
export type FulfillmentStatus = 'pending' | 'processing' | 'picked' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'failed'

/**
 * Order fulfillment.
 *
 * @example
 * ```ts
 * const fulfillment: Fulfillment = {
 *   id: 'ful_123',
 *   orderId: 'ord_123',
 *   locationId: 'loc_123',
 *   status: 'picked',
 *   trackingNumber: '1Z999AA10123456784',
 *   carrier: 'UPS',
 *   pickedAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Fulfillment {
  /** Unique identifier */
  id: string

  /** Order ID */
  orderId: string

  /** Fulfillment number */
  number?: string

  /** Fulfillment location */
  locationId: string

  /** Status */
  status: FulfillmentStatus

  /** Tracking company */
  carrier?: string

  /** Tracking number */
  trackingNumber?: string

  /** Tracking URL */
  trackingUrl?: string

  /** Shipping label URL */
  shippingLabelUrl?: string

  /** Assigned to user */
  assignedTo?: string

  /** Picked at */
  pickedAt?: Date

  /** Picked by */
  pickedBy?: string

  /** Packed at */
  packedAt?: Date

  /** Packed by */
  packedBy?: string

  /** Shipped at */
  shippedAt?: Date

  /** Estimated delivery */
  estimatedDelivery?: Date

  /** Delivered at */
  deliveredAt?: Date

  /** Cancelled at */
  cancelledAt?: Date

  /** Cancellation reason */
  cancellationReason?: string

  /** Failed at */
  failedAt?: Date

  /** Failure reason */
  failureReason?: string

  /** Notes */
  notes?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    shopify?: string
    shipstation?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FulfillmentInput = Input<Fulfillment>
export type FulfillmentOutput = Output<Fulfillment>

// =============================================================================
// FulfillmentItem
// =============================================================================

/**
 * Item in fulfillment.
 *
 * @example
 * ```ts
 * const item: FulfillmentItem = {
 *   id: 'fli_123',
 *   fulfillmentId: 'ful_123',
 *   productId: 'prod_123',
 *   variantId: 'var_123',
 *   quantity: 2,
 *   binLocation: 'A-12-3',
 *   picked: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface FulfillmentItem {
  /** Unique identifier */
  id: string

  /** Fulfillment ID */
  fulfillmentId: string

  /** Product ID */
  productId: string

  /** Variant ID */
  variantId?: string

  /** SKU */
  sku?: string

  /** Product name */
  name?: string

  /** Quantity */
  quantity: number

  /** Bin location */
  binLocation?: string

  /** Picked */
  picked: boolean

  /** Picked at */
  pickedAt?: Date

  /** Picked by */
  pickedBy?: string

  /** Lot number */
  lotNumber?: string

  /** Serial numbers */
  serialNumbers?: string[]

  /** Notes */
  notes?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FulfillmentItemInput = Input<FulfillmentItem>
export type FulfillmentItemOutput = Output<FulfillmentItem>

// =============================================================================
// WorkOrder
// =============================================================================

/**
 * Work order status.
 */
export type WorkOrderStatus = 'draft' | 'scheduled' | 'in_progress' | 'paused' | 'completed' | 'cancelled'

/**
 * Manufacturing work order.
 *
 * @example
 * ```ts
 * const wo: WorkOrder = {
 *   id: 'wo_123',
 *   number: 'WO-2024-001',
 *   productId: 'prod_123',
 *   quantity: 1000,
 *   status: 'scheduled',
 *   scheduledStart: new Date('2024-03-01'),
 *   scheduledEnd: new Date('2024-03-05'),
 *   locationId: 'loc_123',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface WorkOrder {
  /** Unique identifier */
  id: string

  /** Work order number */
  number: string

  /** Product to produce */
  productId: string

  /** Variant ID */
  variantId?: string

  /** BOM ID */
  bomId?: string

  /** Quantity to produce */
  quantity: number

  /** Quantity produced */
  quantityProduced: number

  /** Status */
  status: WorkOrderStatus

  /** Priority */
  priority?: 'low' | 'normal' | 'high' | 'urgent'

  /** Production location */
  locationId: string

  /** Scheduled start */
  scheduledStart?: Date

  /** Scheduled end */
  scheduledEnd?: Date

  /** Actual start */
  actualStart?: Date

  /** Actual end */
  actualEnd?: Date

  /** Assigned to */
  assignedTo?: string

  /** Supervisor */
  supervisor?: string

  /** Notes */
  notes?: string

  /** Instructions */
  instructions?: string

  /** Completion percentage */
  completionPercentage?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    erp?: string
    mes?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type WorkOrderInput = Input<WorkOrder>
export type WorkOrderOutput = Output<WorkOrder>

// =============================================================================
// BillOfMaterials
// =============================================================================

/**
 * Bill of materials.
 *
 * @example
 * ```ts
 * const bom: BillOfMaterials = {
 *   id: 'bom_123',
 *   productId: 'prod_123',
 *   version: '1.0',
 *   active: true,
 *   components: [
 *     {
 *       productId: 'prod_456',
 *       quantity: 2,
 *       unit: 'pcs'
 *     },
 *     {
 *       productId: 'prod_789',
 *       quantity: 1,
 *       unit: 'pcs'
 *     }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface BillOfMaterials {
  /** Unique identifier */
  id: string

  /** Finished product ID */
  productId: string

  /** Variant ID */
  variantId?: string

  /** BOM name */
  name?: string

  /** Version */
  version: string

  /** Active status */
  active: boolean

  /** Components */
  components: {
    productId: string
    variantId?: string
    sku?: string
    name?: string
    quantity: number
    unit: string
    isOptional?: boolean
    notes?: string
  }[]

  /** Labor time (minutes) */
  laborTime?: number

  /** Labor cost */
  laborCost?: number

  /** Notes */
  notes?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    erp?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BillOfMaterialsInput = Input<BillOfMaterials>
export type BillOfMaterialsOutput = Output<BillOfMaterials>

// =============================================================================
// Assembly
// =============================================================================

/**
 * Assembly record.
 *
 * @example
 * ```ts
 * const assembly: Assembly = {
 *   id: 'asm_123',
 *   workOrderId: 'wo_123',
 *   productId: 'prod_123',
 *   quantity: 100,
 *   locationId: 'loc_123',
 *   startedAt: new Date(),
 *   completedAt: new Date(),
 *   status: 'completed',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Assembly {
  /** Unique identifier */
  id: string

  /** Work order ID */
  workOrderId?: string

  /** Product assembled */
  productId: string

  /** Variant ID */
  variantId?: string

  /** BOM used */
  bomId?: string

  /** Quantity assembled */
  quantity: number

  /** Assembly location */
  locationId: string

  /** Status */
  status: 'in_progress' | 'completed' | 'failed'

  /** Started at */
  startedAt: Date

  /** Completed at */
  completedAt?: Date

  /** Assembled by */
  assembledBy?: string

  /** Lot number */
  lotNumber?: string

  /** Serial numbers */
  serialNumbers?: string[]

  /** Notes */
  notes?: string

  /** Defects found */
  defectCount?: number

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    erp?: string
    mes?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AssemblyInput = Input<Assembly>
export type AssemblyOutput = Output<Assembly>

// =============================================================================
// QualityCheck
// =============================================================================

/**
 * Quality control check.
 *
 * @example
 * ```ts
 * const check: QualityCheck = {
 *   id: 'qc_123',
 *   type: 'receiving',
 *   referenceId: 'rcv_123',
 *   productId: 'prod_123',
 *   status: 'passed',
 *   inspectedAt: new Date(),
 *   inspectedBy: 'user_456',
 *   sampleSize: 10,
 *   defectCount: 0,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface QualityCheck {
  /** Unique identifier */
  id: string

  /** Check type */
  type: 'receiving' | 'production' | 'pre_ship' | 'random' | 'customer_return'

  /** Reference ID (receiving, assembly, shipment, etc.) */
  referenceId?: string

  /** Product ID */
  productId: string

  /** Variant ID */
  variantId?: string

  /** Lot number */
  lotNumber?: string

  /** Status */
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'partial'

  /** Inspection criteria */
  criteria?: {
    name: string
    passed: boolean
    notes?: string
  }[]

  /** Inspected at */
  inspectedAt: Date

  /** Inspected by */
  inspectedBy: string

  /** Sample size */
  sampleSize?: number

  /** Defect count */
  defectCount: number

  /** Defect types */
  defects?: {
    type: string
    severity: 'minor' | 'major' | 'critical'
    count: number
    description?: string
  }[]

  /** Pass/fail threshold */
  threshold?: number

  /** Notes */
  notes?: string

  /** Photos */
  photos?: string[]

  /** Action taken */
  action?: 'accept' | 'reject' | 'quarantine' | 'rework'

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs */
  externalIds?: {
    erp?: string
    qms?: string
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type QualityCheckInput = Input<QualityCheck>
export type QualityCheckOutput = Output<QualityCheck>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface ProductActions extends CRUDResource<Product, ProductInput> {
  /** Search products */
  search: Action<{ query: string } & ListParams, PaginatedResult<Product>>

  /** Find by SKU */
  findBySku: Action<{ sku: string }, Product>

  /** Update status */
  updateStatus: Action<{ id: string; status: ProductStatus }, Product>

  /** Add tag */
  addTag: Action<{ id: string; tag: string }, Product>

  /** Remove tag */
  removeTag: Action<{ id: string; tag: string }, Product>

  /** Get variants */
  getVariants: Action<{ id: string }, ProductVariant[]>

  /** Get inventory levels */
  getInventoryLevels: Action<{ id: string }, Inventory[]>

  /** Get total inventory */
  getTotalInventory: Action<{ id: string }, { available: number; reserved: number; onHand: number }>
}

export interface ProductVariantActions extends CRUDResource<ProductVariant, ProductVariantInput> {
  /** Find by SKU */
  findBySku: Action<{ sku: string }, ProductVariant>

  /** Get inventory levels */
  getInventoryLevels: Action<{ id: string }, Inventory[]>

  /** List by product */
  listByProduct: Action<{ productId: string }, ProductVariant[]>
}

export interface InventoryActions extends CRUDResource<Inventory, InventoryInput> {
  /** Adjust inventory */
  adjust: Action<{ id: string; quantity: number; reason: string; notes?: string }, Inventory>

  /** Reserve inventory */
  reserve: Action<{ productId: string; variantId?: string; locationId: string; quantity: number; referenceId?: string }, Inventory>

  /** Release reservation */
  release: Action<{ id: string; quantity: number; referenceId?: string }, Inventory>

  /** Transfer between locations */
  transfer: Action<{ productId: string; variantId?: string; fromLocationId: string; toLocationId: string; quantity: number }, InventoryMovement>

  /** Get by product and location */
  getByProductAndLocation: Action<{ productId: string; variantId?: string; locationId: string }, Inventory>

  /** Get movements */
  getMovements: Action<{ id: string } & ListParams, PaginatedResult<InventoryMovement>>

  /** Cycle count */
  cycleCount: Action<{ id: string; countedQuantity: number; countedBy: string; notes?: string }, Inventory>
}

export interface InventoryLocationActions extends CRUDResource<InventoryLocation, InventoryLocationInput> {
  /** Activate location */
  activate: Action<{ id: string }, InventoryLocation>

  /** Deactivate location */
  deactivate: Action<{ id: string }, InventoryLocation>

  /** Get inventory levels */
  getInventoryLevels: Action<{ id: string } & ListParams, PaginatedResult<Inventory>>
}

export interface InventoryMovementActions extends CRUDResource<InventoryMovement, InventoryMovementInput> {
  /** List by product */
  listByProduct: Action<{ productId: string; variantId?: string } & ListParams, PaginatedResult<InventoryMovement>>

  /** List by location */
  listByLocation: Action<{ locationId: string } & ListParams, PaginatedResult<InventoryMovement>>

  /** List by type */
  listByType: Action<{ type: MovementType } & ListParams, PaginatedResult<InventoryMovement>>
}

export interface WarehouseActions extends CRUDResource<Warehouse, WarehouseInput> {
  /** Activate warehouse */
  activate: Action<{ id: string }, Warehouse>

  /** Deactivate warehouse */
  deactivate: Action<{ id: string }, Warehouse>

  /** Get bins */
  getBins: Action<{ id: string } & ListParams, PaginatedResult<Bin>>

  /** Get utilization */
  getUtilization: Action<{ id: string }, { capacity: number; utilized: number; available: number; percentage: number }>
}

export interface BinActions extends CRUDResource<Bin, BinInput> {
  /** Activate bin */
  activate: Action<{ id: string }, Bin>

  /** Deactivate bin */
  deactivate: Action<{ id: string }, Bin>

  /** Get inventory */
  getInventory: Action<{ id: string }, Inventory[]>

  /** Find by code */
  findByCode: Action<{ warehouseId: string; code: string }, Bin>
}

export interface SupplierActions extends CRUDResource<Supplier, SupplierInput> {
  /** Search suppliers */
  search: Action<{ query: string } & ListParams, PaginatedResult<Supplier>>

  /** Activate supplier */
  activate: Action<{ id: string }, Supplier>

  /** Deactivate supplier */
  deactivate: Action<{ id: string }, Supplier>

  /** Suspend supplier */
  suspend: Action<{ id: string; reason: string }, Supplier>

  /** Update rating */
  updateRating: Action<{ id: string; rating: number }, Supplier>

  /** Get purchase orders */
  getPurchaseOrders: Action<{ id: string } & ListParams, PaginatedResult<PurchaseOrder>>
}

export interface PurchaseOrderActions extends CRUDResource<PurchaseOrder, PurchaseOrderInput> {
  /** Approve purchase order */
  approve: Action<{ id: string; approvedBy: string }, PurchaseOrder>

  /** Submit to supplier */
  submit: Action<{ id: string }, PurchaseOrder>

  /** Cancel purchase order */
  cancel: Action<{ id: string; reason: string }, PurchaseOrder>

  /** Close purchase order */
  close: Action<{ id: string }, PurchaseOrder>

  /** Get items */
  getItems: Action<{ id: string }, PurchaseOrderItem[]>

  /** Add item */
  addItem: Action<{ id: string; item: PurchaseOrderItemInput }, PurchaseOrderItem>

  /** Update item */
  updateItem: Action<{ id: string; itemId: string; updates: Partial<PurchaseOrderItemInput> }, PurchaseOrderItem>

  /** Remove item */
  removeItem: Action<{ id: string; itemId: string }, void>

  /** Get receivings */
  getReceivings: Action<{ id: string }, Receiving[]>
}

export interface PurchaseOrderItemActions extends CRUDResource<PurchaseOrderItem, PurchaseOrderItemInput> {
  /** Update received quantity */
  updateReceivedQuantity: Action<{ id: string; quantity: number }, PurchaseOrderItem>
}

export interface ReceivingActions extends CRUDResource<Receiving, ReceivingInput> {
  /** Start receiving */
  start: Action<{ id: string; receivedBy: string }, Receiving>

  /** Complete receiving */
  complete: Action<{ id: string; notes?: string }, Receiving>

  /** Report discrepancy */
  reportDiscrepancy: Action<{ id: string; description: string; items: { itemId: string; expected: number; received: number }[] }, Receiving>

  /** Add attachment */
  addAttachment: Action<{ id: string; url: string; type: string; name: string }, Receiving>
}

export interface ShipmentActions extends CRUDResource<Shipment, ShipmentInput> {
  /** Create label */
  createLabel: Action<{ id: string; carrierId: string; serviceCode: string }, Shipment>

  /** Cancel shipment */
  cancel: Action<{ id: string; reason?: string }, Shipment>

  /** Mark as picked */
  markPicked: Action<{ id: string; pickedBy: string }, Shipment>

  /** Mark as packed */
  markPacked: Action<{ id: string; packedBy: string }, Shipment>

  /** Mark as shipped */
  markShipped: Action<{ id: string; trackingNumber: string }, Shipment>

  /** Update tracking */
  updateTracking: Action<{ id: string }, Shipment>

  /** Get items */
  getItems: Action<{ id: string }, ShipmentItem[]>

  /** Add item */
  addItem: Action<{ id: string; item: ShipmentItemInput }, ShipmentItem>

  /** Get tracking events */
  getTrackingEvents: Action<{ id: string }, TrackingEvent[]>

  /** Get rates */
  getRates: Action<{ id: string }, ShippingRate[]>
}

export interface ShipmentItemActions extends CRUDResource<ShipmentItem, ShipmentItemInput> {
  /** Update quantity */
  updateQuantity: Action<{ id: string; quantity: number }, ShipmentItem>
}

export interface CarrierActions extends CRUDResource<Carrier, CarrierInput> {
  /** Activate carrier */
  activate: Action<{ id: string }, Carrier>

  /** Deactivate carrier */
  deactivate: Action<{ id: string }, Carrier>

  /** Get rates */
  getRates: Action<{ carrierId: string; shipment: { weight: number; dimensions?: { length: number; width: number; height: number }; origin: string; destination: string } }, ShippingRate[]>

  /** Validate address */
  validateAddress: Action<{ address: { line1: string; city: string; state: string; postalCode: string; country: string } }, { valid: boolean; suggestions?: unknown[] }>
}

export interface ShippingRateActions extends CRUDResource<ShippingRate, ShippingRateInput> {
  /** Get rates for shipment */
  getForShipment: Action<{ shipmentId: string }, ShippingRate[]>
}

export interface TrackingEventActions extends CRUDResource<TrackingEvent, TrackingEventInput> {
  /** List by shipment */
  listByShipment: Action<{ shipmentId: string }, TrackingEvent[]>
}

export interface ReturnActions extends CRUDResource<Return, ReturnInput> {
  /** Approve return */
  approve: Action<{ id: string; approvedBy: string }, Return>

  /** Reject return */
  reject: Action<{ id: string; reason: string }, Return>

  /** Cancel return */
  cancel: Action<{ id: string; reason: string }, Return>

  /** Mark as received */
  markReceived: Action<{ id: string; receivedBy: string; receivedAt?: Date }, Return>

  /** Inspect return */
  inspect: Action<{ id: string; inspectedBy: string; notes: string; items: { itemId: string; condition: string; restockable: boolean }[] }, Return>

  /** Process refund */
  processRefund: Action<{ id: string; amount: number; method: 'original' | 'store_credit' | 'exchange' }, Return>

  /** Get items */
  getItems: Action<{ id: string }, ReturnItem[]>

  /** Add item */
  addItem: Action<{ id: string; item: ReturnItemInput }, ReturnItem>

  /** Generate label */
  generateLabel: Action<{ id: string }, { labelUrl: string; trackingNumber: string }>
}

export interface ReturnItemActions extends CRUDResource<ReturnItem, ReturnItemInput> {
  /** Update condition */
  updateCondition: Action<{ id: string; condition: string; restockable: boolean }, ReturnItem>
}

export interface FulfillmentActions extends CRUDResource<Fulfillment, FulfillmentInput> {
  /** Assign to user */
  assign: Action<{ id: string; userId: string }, Fulfillment>

  /** Start picking */
  startPicking: Action<{ id: string; pickedBy: string }, Fulfillment>

  /** Complete picking */
  completePicking: Action<{ id: string }, Fulfillment>

  /** Start packing */
  startPacking: Action<{ id: string; packedBy: string }, Fulfillment>

  /** Complete packing */
  completePacking: Action<{ id: string; weight?: number; dimensions?: { length: number; width: number; height: number } }, Fulfillment>

  /** Ship fulfillment */
  ship: Action<{ id: string; carrier: string; trackingNumber: string; trackingUrl?: string }, Fulfillment>

  /** Cancel fulfillment */
  cancel: Action<{ id: string; reason: string }, Fulfillment>

  /** Get items */
  getItems: Action<{ id: string }, FulfillmentItem[]>

  /** Add item */
  addItem: Action<{ id: string; item: FulfillmentItemInput }, FulfillmentItem>

  /** Mark item picked */
  markItemPicked: Action<{ id: string; itemId: string; pickedBy: string }, FulfillmentItem>
}

export interface FulfillmentItemActions extends CRUDResource<FulfillmentItem, FulfillmentItemInput> {
  /** Mark as picked */
  markPicked: Action<{ id: string; pickedBy: string }, FulfillmentItem>

  /** Update quantity */
  updateQuantity: Action<{ id: string; quantity: number }, FulfillmentItem>
}

export interface WorkOrderActions extends CRUDResource<WorkOrder, WorkOrderInput> {
  /** Schedule work order */
  schedule: Action<{ id: string; scheduledStart: Date; scheduledEnd: Date }, WorkOrder>

  /** Start work order */
  start: Action<{ id: string; assignedTo: string }, WorkOrder>

  /** Pause work order */
  pause: Action<{ id: string; reason: string }, WorkOrder>

  /** Resume work order */
  resume: Action<{ id: string }, WorkOrder>

  /** Complete work order */
  complete: Action<{ id: string; quantityProduced: number; notes?: string }, WorkOrder>

  /** Cancel work order */
  cancel: Action<{ id: string; reason: string }, WorkOrder>

  /** Update progress */
  updateProgress: Action<{ id: string; quantityProduced: number; completionPercentage?: number }, WorkOrder>

  /** Get assemblies */
  getAssemblies: Action<{ id: string }, Assembly[]>
}

export interface BillOfMaterialsActions extends CRUDResource<BillOfMaterials, BillOfMaterialsInput> {
  /** Activate BOM */
  activate: Action<{ id: string }, BillOfMaterials>

  /** Deactivate BOM */
  deactivate: Action<{ id: string }, BillOfMaterials>

  /** Add component */
  addComponent: Action<{ id: string; component: { productId: string; variantId?: string; quantity: number; unit: string; isOptional?: boolean } }, BillOfMaterials>

  /** Remove component */
  removeComponent: Action<{ id: string; productId: string }, BillOfMaterials>

  /** Calculate cost */
  calculateCost: Action<{ id: string }, { materialCost: number; laborCost: number; totalCost: number }>

  /** List by product */
  listByProduct: Action<{ productId: string }, BillOfMaterials[]>

  /** Get active */
  getActive: Action<{ productId: string; variantId?: string }, BillOfMaterials>
}

export interface AssemblyActions extends CRUDResource<Assembly, AssemblyInput> {
  /** Start assembly */
  start: Action<{ id: string; assembledBy: string }, Assembly>

  /** Complete assembly */
  complete: Action<{ id: string; notes?: string; serialNumbers?: string[] }, Assembly>

  /** Report failure */
  reportFailure: Action<{ id: string; reason: string }, Assembly>

  /** List by work order */
  listByWorkOrder: Action<{ workOrderId: string }, Assembly[]>

  /** List by product */
  listByProduct: Action<{ productId: string } & ListParams, PaginatedResult<Assembly>>
}

export interface QualityCheckActions extends CRUDResource<QualityCheck, QualityCheckInput> {
  /** Start inspection */
  start: Action<{ id: string; inspectedBy: string }, QualityCheck>

  /** Complete inspection */
  complete: Action<{ id: string; status: 'passed' | 'failed' | 'partial'; defects?: { type: string; severity: string; count: number; description?: string }[]; action: string; notes?: string }, QualityCheck>

  /** Add photo */
  addPhoto: Action<{ id: string; url: string }, QualityCheck>

  /** List by product */
  listByProduct: Action<{ productId: string } & ListParams, PaginatedResult<QualityCheck>>

  /** List by type */
  listByType: Action<{ type: string } & ListParams, PaginatedResult<QualityCheck>>
}

// =============================================================================
// Events
// =============================================================================

export interface ProductEvents {
  created: BaseEvent<'product.created', Product>
  updated: BaseEvent<'product.updated', Product>
  deleted: BaseEvent<'product.deleted', { id: string }>
  status_changed: BaseEvent<'product.status_changed', { productId: string; oldStatus: ProductStatus; newStatus: ProductStatus }>
  tagged: BaseEvent<'product.tagged', { productId: string; tag: string }>
  untagged: BaseEvent<'product.untagged', { productId: string; tag: string }>
}

export interface ProductVariantEvents {
  created: BaseEvent<'product_variant.created', ProductVariant>
  updated: BaseEvent<'product_variant.updated', ProductVariant>
  deleted: BaseEvent<'product_variant.deleted', { id: string }>
}

export interface InventoryEvents {
  created: BaseEvent<'inventory.created', Inventory>
  updated: BaseEvent<'inventory.updated', Inventory>
  deleted: BaseEvent<'inventory.deleted', { id: string }>
  adjusted: BaseEvent<'inventory.adjusted', { inventoryId: string; quantityBefore: number; quantityAfter: number; reason: string }>
  reserved: BaseEvent<'inventory.reserved', { inventoryId: string; quantity: number; referenceId?: string }>
  released: BaseEvent<'inventory.released', { inventoryId: string; quantity: number; referenceId?: string }>
  low_stock: BaseEvent<'inventory.low_stock', { inventoryId: string; productId: string; locationId: string; quantity: number; reorderPoint: number }>
  out_of_stock: BaseEvent<'inventory.out_of_stock', { inventoryId: string; productId: string; locationId: string }>
  transferred: BaseEvent<'inventory.transferred', { productId: string; fromLocationId: string; toLocationId: string; quantity: number }>
}

export interface InventoryLocationEvents {
  created: BaseEvent<'inventory_location.created', InventoryLocation>
  updated: BaseEvent<'inventory_location.updated', InventoryLocation>
  deleted: BaseEvent<'inventory_location.deleted', { id: string }>
  activated: BaseEvent<'inventory_location.activated', { locationId: string }>
  deactivated: BaseEvent<'inventory_location.deactivated', { locationId: string }>
}

export interface InventoryMovementEvents {
  created: BaseEvent<'inventory_movement.created', InventoryMovement>
}

export interface WarehouseEvents {
  created: BaseEvent<'warehouse.created', Warehouse>
  updated: BaseEvent<'warehouse.updated', Warehouse>
  deleted: BaseEvent<'warehouse.deleted', { id: string }>
  activated: BaseEvent<'warehouse.activated', { warehouseId: string }>
  deactivated: BaseEvent<'warehouse.deactivated', { warehouseId: string }>
}

export interface BinEvents {
  created: BaseEvent<'bin.created', Bin>
  updated: BaseEvent<'bin.updated', Bin>
  deleted: BaseEvent<'bin.deleted', { id: string }>
  activated: BaseEvent<'bin.activated', { binId: string }>
  deactivated: BaseEvent<'bin.deactivated', { binId: string }>
}

export interface SupplierEvents {
  created: BaseEvent<'supplier.created', Supplier>
  updated: BaseEvent<'supplier.updated', Supplier>
  deleted: BaseEvent<'supplier.deleted', { id: string }>
  activated: BaseEvent<'supplier.activated', { supplierId: string }>
  deactivated: BaseEvent<'supplier.deactivated', { supplierId: string }>
  suspended: BaseEvent<'supplier.suspended', { supplierId: string; reason: string }>
  rating_updated: BaseEvent<'supplier.rating_updated', { supplierId: string; oldRating?: number; newRating: number }>
}

export interface PurchaseOrderEvents {
  created: BaseEvent<'purchase_order.created', PurchaseOrder>
  updated: BaseEvent<'purchase_order.updated', PurchaseOrder>
  deleted: BaseEvent<'purchase_order.deleted', { id: string }>
  approved: BaseEvent<'purchase_order.approved', { purchaseOrderId: string; approvedBy: string }>
  submitted: BaseEvent<'purchase_order.submitted', { purchaseOrderId: string }>
  received: BaseEvent<'purchase_order.received', { purchaseOrderId: string }>
  cancelled: BaseEvent<'purchase_order.cancelled', { purchaseOrderId: string; reason: string }>
  closed: BaseEvent<'purchase_order.closed', { purchaseOrderId: string }>
  item_added: BaseEvent<'purchase_order.item_added', { purchaseOrderId: string; item: PurchaseOrderItem }>
  item_removed: BaseEvent<'purchase_order.item_removed', { purchaseOrderId: string; itemId: string }>
}

export interface PurchaseOrderItemEvents {
  created: BaseEvent<'purchase_order_item.created', PurchaseOrderItem>
  updated: BaseEvent<'purchase_order_item.updated', PurchaseOrderItem>
  deleted: BaseEvent<'purchase_order_item.deleted', { id: string }>
}

export interface ReceivingEvents {
  created: BaseEvent<'receiving.created', Receiving>
  updated: BaseEvent<'receiving.updated', Receiving>
  deleted: BaseEvent<'receiving.deleted', { id: string }>
  started: BaseEvent<'receiving.started', { receivingId: string; receivedBy: string }>
  completed: BaseEvent<'receiving.completed', { receivingId: string }>
  discrepancy_reported: BaseEvent<'receiving.discrepancy_reported', { receivingId: string; description: string }>
}

export interface ShipmentEvents {
  created: BaseEvent<'shipment.created', Shipment>
  updated: BaseEvent<'shipment.updated', Shipment>
  deleted: BaseEvent<'shipment.deleted', { id: string }>
  picked: BaseEvent<'shipment.picked', { shipmentId: string; pickedBy: string }>
  packed: BaseEvent<'shipment.packed', { shipmentId: string; packedBy: string }>
  shipped: BaseEvent<'shipment.shipped', { shipmentId: string; trackingNumber: string; carrier: string }>
  in_transit: BaseEvent<'shipment.in_transit', { shipmentId: string }>
  out_for_delivery: BaseEvent<'shipment.out_for_delivery', { shipmentId: string }>
  delivered: BaseEvent<'shipment.delivered', { shipmentId: string; deliveredAt: Date }>
  failed: BaseEvent<'shipment.failed', { shipmentId: string; reason: string }>
  cancelled: BaseEvent<'shipment.cancelled', { shipmentId: string; reason?: string }>
  label_created: BaseEvent<'shipment.label_created', { shipmentId: string; labelUrl: string }>
}

export interface ShipmentItemEvents {
  created: BaseEvent<'shipment_item.created', ShipmentItem>
  updated: BaseEvent<'shipment_item.updated', ShipmentItem>
  deleted: BaseEvent<'shipment_item.deleted', { id: string }>
}

export interface CarrierEvents {
  created: BaseEvent<'carrier.created', Carrier>
  updated: BaseEvent<'carrier.updated', Carrier>
  deleted: BaseEvent<'carrier.deleted', { id: string }>
  activated: BaseEvent<'carrier.activated', { carrierId: string }>
  deactivated: BaseEvent<'carrier.deactivated', { carrierId: string }>
}

export interface ShippingRateEvents {
  created: BaseEvent<'shipping_rate.created', ShippingRate>
  updated: BaseEvent<'shipping_rate.updated', ShippingRate>
}

export interface TrackingEventEvents {
  created: BaseEvent<'tracking_event.created', TrackingEvent>
}

export interface ReturnEvents {
  created: BaseEvent<'return.created', Return>
  updated: BaseEvent<'return.updated', Return>
  deleted: BaseEvent<'return.deleted', { id: string }>
  approved: BaseEvent<'return.approved', { returnId: string; approvedBy: string }>
  rejected: BaseEvent<'return.rejected', { returnId: string; reason: string }>
  received: BaseEvent<'return.received', { returnId: string; receivedBy: string }>
  inspected: BaseEvent<'return.inspected', { returnId: string; inspectedBy: string; notes: string }>
  refunded: BaseEvent<'return.refunded', { returnId: string; amount: number; method: string }>
  cancelled: BaseEvent<'return.cancelled', { returnId: string; reason: string }>
}

export interface ReturnItemEvents {
  created: BaseEvent<'return_item.created', ReturnItem>
  updated: BaseEvent<'return_item.updated', ReturnItem>
  deleted: BaseEvent<'return_item.deleted', { id: string }>
}

export interface FulfillmentEvents {
  created: BaseEvent<'fulfillment.created', Fulfillment>
  updated: BaseEvent<'fulfillment.updated', Fulfillment>
  deleted: BaseEvent<'fulfillment.deleted', { id: string }>
  assigned: BaseEvent<'fulfillment.assigned', { fulfillmentId: string; userId: string }>
  picking_started: BaseEvent<'fulfillment.picking_started', { fulfillmentId: string; pickedBy: string }>
  picked: BaseEvent<'fulfillment.picked', { fulfillmentId: string }>
  packing_started: BaseEvent<'fulfillment.packing_started', { fulfillmentId: string; packedBy: string }>
  packed: BaseEvent<'fulfillment.packed', { fulfillmentId: string }>
  shipped: BaseEvent<'fulfillment.shipped', { fulfillmentId: string; carrier: string; trackingNumber: string }>
  delivered: BaseEvent<'fulfillment.delivered', { fulfillmentId: string }>
  cancelled: BaseEvent<'fulfillment.cancelled', { fulfillmentId: string; reason: string }>
  failed: BaseEvent<'fulfillment.failed', { fulfillmentId: string; reason: string }>
}

export interface FulfillmentItemEvents {
  created: BaseEvent<'fulfillment_item.created', FulfillmentItem>
  updated: BaseEvent<'fulfillment_item.updated', FulfillmentItem>
  deleted: BaseEvent<'fulfillment_item.deleted', { id: string }>
  picked: BaseEvent<'fulfillment_item.picked', { itemId: string; pickedBy: string }>
}

export interface WorkOrderEvents {
  created: BaseEvent<'work_order.created', WorkOrder>
  updated: BaseEvent<'work_order.updated', WorkOrder>
  deleted: BaseEvent<'work_order.deleted', { id: string }>
  scheduled: BaseEvent<'work_order.scheduled', { workOrderId: string; scheduledStart: Date; scheduledEnd: Date }>
  started: BaseEvent<'work_order.started', { workOrderId: string; assignedTo: string }>
  paused: BaseEvent<'work_order.paused', { workOrderId: string; reason: string }>
  resumed: BaseEvent<'work_order.resumed', { workOrderId: string }>
  completed: BaseEvent<'work_order.completed', { workOrderId: string; quantityProduced: number }>
  cancelled: BaseEvent<'work_order.cancelled', { workOrderId: string; reason: string }>
  progress_updated: BaseEvent<'work_order.progress_updated', { workOrderId: string; quantityProduced: number; completionPercentage?: number }>
}

export interface BillOfMaterialsEvents {
  created: BaseEvent<'bill_of_materials.created', BillOfMaterials>
  updated: BaseEvent<'bill_of_materials.updated', BillOfMaterials>
  deleted: BaseEvent<'bill_of_materials.deleted', { id: string }>
  activated: BaseEvent<'bill_of_materials.activated', { bomId: string }>
  deactivated: BaseEvent<'bill_of_materials.deactivated', { bomId: string }>
  component_added: BaseEvent<'bill_of_materials.component_added', { bomId: string; productId: string; quantity: number }>
  component_removed: BaseEvent<'bill_of_materials.component_removed', { bomId: string; productId: string }>
}

export interface AssemblyEvents {
  created: BaseEvent<'assembly.created', Assembly>
  updated: BaseEvent<'assembly.updated', Assembly>
  deleted: BaseEvent<'assembly.deleted', { id: string }>
  started: BaseEvent<'assembly.started', { assemblyId: string; assembledBy: string }>
  completed: BaseEvent<'assembly.completed', { assemblyId: string }>
  failed: BaseEvent<'assembly.failed', { assemblyId: string; reason: string }>
}

export interface QualityCheckEvents {
  created: BaseEvent<'quality_check.created', QualityCheck>
  updated: BaseEvent<'quality_check.updated', QualityCheck>
  deleted: BaseEvent<'quality_check.deleted', { id: string }>
  started: BaseEvent<'quality_check.started', { checkId: string; inspectedBy: string }>
  completed: BaseEvent<'quality_check.completed', { checkId: string; status: string; action: string }>
  failed: BaseEvent<'quality_check.failed', { checkId: string; defectCount: number }>
}

// =============================================================================
// Resources
// =============================================================================

export interface ProductResource extends ProductActions {
  on: <K extends keyof ProductEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ProductEvents[K], TProxy>
  ) => () => void
}

export interface ProductVariantResource extends ProductVariantActions {
  on: <K extends keyof ProductVariantEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ProductVariantEvents[K], TProxy>
  ) => () => void
}

export interface InventoryResource extends InventoryActions {
  on: <K extends keyof InventoryEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<InventoryEvents[K], TProxy>
  ) => () => void
}

export interface InventoryLocationResource extends InventoryLocationActions {
  on: <K extends keyof InventoryLocationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<InventoryLocationEvents[K], TProxy>
  ) => () => void
}

export interface InventoryMovementResource extends InventoryMovementActions {
  on: <K extends keyof InventoryMovementEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<InventoryMovementEvents[K], TProxy>
  ) => () => void
}

export interface WarehouseResource extends WarehouseActions {
  on: <K extends keyof WarehouseEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<WarehouseEvents[K], TProxy>
  ) => () => void
}

export interface BinResource extends BinActions {
  on: <K extends keyof BinEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<BinEvents[K], TProxy>
  ) => () => void
}

export interface SupplierResource extends SupplierActions {
  on: <K extends keyof SupplierEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SupplierEvents[K], TProxy>
  ) => () => void
}

export interface PurchaseOrderResource extends PurchaseOrderActions {
  on: <K extends keyof PurchaseOrderEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PurchaseOrderEvents[K], TProxy>
  ) => () => void
}

export interface PurchaseOrderItemResource extends PurchaseOrderItemActions {
  on: <K extends keyof PurchaseOrderItemEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PurchaseOrderItemEvents[K], TProxy>
  ) => () => void
}

export interface ReceivingResource extends ReceivingActions {
  on: <K extends keyof ReceivingEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ReceivingEvents[K], TProxy>
  ) => () => void
}

export interface ShipmentResource extends ShipmentActions {
  on: <K extends keyof ShipmentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ShipmentEvents[K], TProxy>
  ) => () => void
}

export interface ShipmentItemResource extends ShipmentItemActions {
  on: <K extends keyof ShipmentItemEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ShipmentItemEvents[K], TProxy>
  ) => () => void
}

export interface CarrierResource extends CarrierActions {
  on: <K extends keyof CarrierEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CarrierEvents[K], TProxy>
  ) => () => void
}

export interface ShippingRateResource extends ShippingRateActions {
  on: <K extends keyof ShippingRateEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ShippingRateEvents[K], TProxy>
  ) => () => void
}

export interface TrackingEventResource extends TrackingEventActions {
  on: <K extends keyof TrackingEventEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TrackingEventEvents[K], TProxy>
  ) => () => void
}

export interface ReturnResource extends ReturnActions {
  on: <K extends keyof ReturnEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ReturnEvents[K], TProxy>
  ) => () => void
}

export interface ReturnItemResource extends ReturnItemActions {
  on: <K extends keyof ReturnItemEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ReturnItemEvents[K], TProxy>
  ) => () => void
}

export interface FulfillmentResource extends FulfillmentActions {
  on: <K extends keyof FulfillmentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<FulfillmentEvents[K], TProxy>
  ) => () => void
}

export interface FulfillmentItemResource extends FulfillmentItemActions {
  on: <K extends keyof FulfillmentItemEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<FulfillmentItemEvents[K], TProxy>
  ) => () => void
}

export interface WorkOrderResource extends WorkOrderActions {
  on: <K extends keyof WorkOrderEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<WorkOrderEvents[K], TProxy>
  ) => () => void
}

export interface BillOfMaterialsResource extends BillOfMaterialsActions {
  on: <K extends keyof BillOfMaterialsEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<BillOfMaterialsEvents[K], TProxy>
  ) => () => void
}

export interface AssemblyResource extends AssemblyActions {
  on: <K extends keyof AssemblyEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AssemblyEvents[K], TProxy>
  ) => () => void
}

export interface QualityCheckResource extends QualityCheckActions {
  on: <K extends keyof QualityCheckEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<QualityCheckEvents[K], TProxy>
  ) => () => void
}

// =============================================================================
// Operations Proxy (unified interface)
// =============================================================================

/**
 * Complete Operations & Logistics interface combining all resources.
 *
 * @example
 * ```ts
 * const ops: OpsProxy = getOpsProxy()
 *
 * // Create a product
 * const product = await ops.products.create({
 *   sku: 'WIDGET-001',
 *   name: 'Premium Widget',
 *   status: 'active',
 *   price: 4999,
 *   currency: 'USD'
 * })
 *
 * // Subscribe to inventory events
 * ops.inventory.on('low_stock', async (event, ctx) => {
 *   console.log('Low stock alert:', event.data.productId)
 *
 *   // Create purchase order
 *   const po = await ctx.$.purchaseOrders.create({
 *     supplierId: 'sup_123',
 *     destinationLocationId: 'loc_123',
 *     // ...
 *   })
 * })
 *
 * // Create a shipment
 * const shipment = await ops.shipments.create({
 *   orderId: 'ord_123',
 *   locationId: 'loc_123',
 *   shippingAddress: {
 *     name: 'John Doe',
 *     line1: '123 Main St',
 *     city: 'San Francisco',
 *     state: 'CA',
 *     postalCode: '94102',
 *     country: 'US'
 *   }
 * })
 * ```
 */
export interface OpsProxy {
  products: ProductResource
  productVariants: ProductVariantResource
  inventory: InventoryResource
  inventoryLocations: InventoryLocationResource
  inventoryMovements: InventoryMovementResource
  warehouses: WarehouseResource
  bins: BinResource
  suppliers: SupplierResource
  purchaseOrders: PurchaseOrderResource
  purchaseOrderItems: PurchaseOrderItemResource
  receivings: ReceivingResource
  shipments: ShipmentResource
  shipmentItems: ShipmentItemResource
  carriers: CarrierResource
  shippingRates: ShippingRateResource
  trackingEvents: TrackingEventResource
  returns: ReturnResource
  returnItems: ReturnItemResource
  fulfillments: FulfillmentResource
  fulfillmentItems: FulfillmentItemResource
  workOrders: WorkOrderResource
  billOfMaterials: BillOfMaterialsResource
  assemblies: AssemblyResource
  qualityChecks: QualityCheckResource
}
