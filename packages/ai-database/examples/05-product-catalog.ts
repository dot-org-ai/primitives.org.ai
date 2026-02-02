/**
 * Product Catalog Example - ai-database
 *
 * This example demonstrates building a product catalog with complex relationships:
 * - Hierarchical categories (self-referential trees)
 * - Many-to-many relationships (products <-> tags)
 * - Computed relationships
 * - Promise pipelining for efficient queries
 * - Batch operations with forEach
 *
 * Run with: npx tsx examples/05-product-catalog.ts
 */

import { DB, setProvider, createMemoryProvider } from '../src/index.js'
import type { DatabaseSchema } from '../src/index.js'

async function main() {
  // Initialize provider
  setProvider(createMemoryProvider())

  // Define the product catalog schema
  const schema = {
    // Hierarchical categories (self-referential tree)
    Category: {
      name: 'string',
      slug: 'string',
      description: 'string?',
      // Parent category (optional for root categories)
      parent: '->Category?',
      // Children categories (backward reference)
      children: ['<-Category.parent'],
      // Products in this category
      products: ['<-Product.category'],
    },

    // Products
    Product: {
      name: 'string',
      sku: 'string',
      description: 'string',
      price: 'number',
      inventory: 'number',
      isActive: 'boolean',
      // Category relationship
      category: '->Category',
      // Brand relationship
      brand: '->Brand?',
      // Many-to-many with tags
      tags: ['->Tag'],
      // Product variants (e.g., sizes, colors)
      variants: ['<-Variant.product'],
      // Reviews
      reviews: ['<-Review.product'],
    },

    Brand: {
      name: 'string',
      slug: 'string',
      logo: 'url?',
      description: 'string?',
      products: ['<-Product.brand'],
    },

    Tag: {
      name: 'string',
      slug: 'string',
      products: ['<-Product.tags'],
    },

    Variant: {
      product: '->Product',
      sku: 'string',
      name: 'string',
      priceDelta: 'number', // Price difference from base
      inventory: 'number',
      attributes: 'json', // { color: 'red', size: 'L' }
    },

    Review: {
      product: '->Product',
      customer: '->Customer',
      rating: 'number', // 1-5
      title: 'string',
      content: 'string',
      helpful: 'number',
    },

    Customer: {
      name: 'string',
      email: 'string',
      reviews: ['<-Review.customer'],
    },

    // Orders for analytics
    Order: {
      customer: '->Customer',
      items: ['->OrderItem'],
      total: 'number',
      status: 'string',
      createdAt: 'datetime',
    },

    OrderItem: {
      order: '<-Order.items',
      product: '->Product',
      variant: '->Variant?',
      quantity: 'number',
      unitPrice: 'number',
    },
  } as const satisfies DatabaseSchema

  const { db } = DB(schema)

  console.log('=== Product Catalog Example ===\n')

  // Step 1: Create category hierarchy
  console.log('--- Creating Category Hierarchy ---\n')

  // Root categories
  const electronics = await db.Category.create({
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronic devices and accessories',
  })

  const clothing = await db.Category.create({
    name: 'Clothing',
    slug: 'clothing',
    description: 'Apparel and accessories',
  })

  // Sub-categories
  const laptops = await db.Category.create({
    name: 'Laptops',
    slug: 'laptops',
    description: 'Portable computers',
    parent: electronics.$id,
  })

  const phones = await db.Category.create({
    name: 'Phones',
    slug: 'phones',
    description: 'Mobile devices',
    parent: electronics.$id,
  })

  const tshirts = await db.Category.create({
    name: 'T-Shirts',
    slug: 'tshirts',
    description: 'Casual wear',
    parent: clothing.$id,
  })

  console.log('Created category hierarchy:')
  console.log(`  ${electronics.name}`)
  console.log(`    -> ${laptops.name}`)
  console.log(`    -> ${phones.name}`)
  console.log(`  ${clothing.name}`)
  console.log(`    -> ${tshirts.name}`)

  // Verify tree navigation
  const electronicsChildren = await electronics.children
  console.log(`\nElectronics has ${electronicsChildren.length} subcategories`)

  // Step 2: Create brands
  console.log('\n--- Creating Brands ---\n')

  const brands = await Promise.all([
    db.Brand.create({ name: 'TechCorp', slug: 'techcorp', description: 'Premium tech products' }),
    db.Brand.create({ name: 'FashionCo', slug: 'fashionco', description: 'Modern fashion brand' }),
    db.Brand.create({ name: 'GadgetPro', slug: 'gadgetpro', description: 'Innovative gadgets' }),
  ])

  console.log('Created brands:', brands.map((b) => b.name).join(', '))

  // Step 3: Create tags
  console.log('\n--- Creating Tags ---\n')

  const tags = {
    featured: await db.Tag.create({ name: 'Featured', slug: 'featured' }),
    sale: await db.Tag.create({ name: 'On Sale', slug: 'on-sale' }),
    newArrival: await db.Tag.create({ name: 'New Arrival', slug: 'new-arrival' }),
    bestseller: await db.Tag.create({ name: 'Bestseller', slug: 'bestseller' }),
  }

  console.log('Created tags:', Object.keys(tags).join(', '))

  // Step 4: Create products with relationships
  console.log('\n--- Creating Products ---\n')

  const products = [
    {
      name: 'Pro Laptop 15"',
      sku: 'LAPTOP-001',
      description: 'High-performance laptop for professionals',
      price: 1299.99,
      inventory: 50,
      isActive: true,
      category: laptops.$id,
      brand: brands[0].$id,
      tags: [tags.featured.$id, tags.bestseller.$id],
    },
    {
      name: 'Budget Laptop 13"',
      sku: 'LAPTOP-002',
      description: 'Affordable laptop for everyday use',
      price: 599.99,
      inventory: 100,
      isActive: true,
      category: laptops.$id,
      brand: brands[0].$id,
      tags: [tags.sale.$id],
    },
    {
      name: 'SmartPhone X',
      sku: 'PHONE-001',
      description: 'Latest smartphone with advanced features',
      price: 999.99,
      inventory: 200,
      isActive: true,
      category: phones.$id,
      brand: brands[2].$id,
      tags: [tags.featured.$id, tags.newArrival.$id],
    },
    {
      name: 'Classic T-Shirt',
      sku: 'SHIRT-001',
      description: 'Comfortable cotton t-shirt',
      price: 29.99,
      inventory: 500,
      isActive: true,
      category: tshirts.$id,
      brand: brands[1].$id,
      tags: [tags.bestseller.$id],
    },
  ]

  const createdProducts = []
  for (const product of products) {
    const p = await db.Product.create(product)
    createdProducts.push(p)
    console.log(`Created: ${p.name} (${p.sku}) - $${p.price}`)
  }

  // Step 5: Add variants to a product
  console.log('\n--- Adding Product Variants ---\n')

  const shirtVariants = [
    { name: 'Small Red', priceDelta: 0, inventory: 100, attributes: { size: 'S', color: 'Red' } },
    { name: 'Medium Red', priceDelta: 0, inventory: 150, attributes: { size: 'M', color: 'Red' } },
    { name: 'Large Red', priceDelta: 5, inventory: 75, attributes: { size: 'L', color: 'Red' } },
    { name: 'Small Blue', priceDelta: 0, inventory: 120, attributes: { size: 'S', color: 'Blue' } },
    {
      name: 'Medium Blue',
      priceDelta: 0,
      inventory: 180,
      attributes: { size: 'M', color: 'Blue' },
    },
    { name: 'Large Blue', priceDelta: 5, inventory: 80, attributes: { size: 'L', color: 'Blue' } },
  ]

  const tshirt = createdProducts[3]
  for (const v of shirtVariants) {
    await db.Variant.create({
      product: tshirt.$id,
      sku: `${tshirt.sku}-${v.attributes.size}-${v.attributes.color}`,
      ...v,
    })
  }

  const variants = await tshirt.variants
  console.log(`Added ${variants.length} variants to ${tshirt.name}`)

  // Step 6: Create customers and reviews
  console.log('\n--- Adding Reviews ---\n')

  const customers = await Promise.all([
    db.Customer.create({ name: 'Alice Johnson', email: 'alice@example.com' }),
    db.Customer.create({ name: 'Bob Smith', email: 'bob@example.com' }),
    db.Customer.create({ name: 'Carol White', email: 'carol@example.com' }),
  ])

  // Add reviews
  const laptop = createdProducts[0]
  await db.Review.create({
    product: laptop.$id,
    customer: customers[0].$id,
    rating: 5,
    title: 'Excellent laptop!',
    content: 'Best laptop I have ever used. Highly recommend!',
    helpful: 42,
  })

  await db.Review.create({
    product: laptop.$id,
    customer: customers[1].$id,
    rating: 4,
    title: 'Great but pricey',
    content: 'Great performance but a bit expensive.',
    helpful: 15,
  })

  const laptopReviews = await laptop.reviews
  const avgRating =
    laptopReviews.reduce((sum, r) => sum + (r.rating as number), 0) / laptopReviews.length
  console.log(
    `${laptop.name} has ${laptopReviews.length} reviews, avg rating: ${avgRating.toFixed(1)}`
  )

  // Step 7: Promise pipelining for complex queries
  console.log('\n--- Promise Pipelining Queries ---\n')

  // Find all active products in Electronics category with price > $500
  const premiumElectronics = await db.Product.list()
    .filter((p) => p.isActive && p.price > 500)
    .filter((p) => p.category === laptops.$id || p.category === phones.$id)
    .sort((a, b) => b.price - a.price)

  console.log('Premium Electronics (>$500):')
  for (const p of premiumElectronics) {
    console.log(`  - ${p.name}: $${p.price}`)
  }

  // Get all featured products with their tags
  const featuredProducts = await db.Product.list().filter((p) => {
    // Check if product has the 'featured' tag
    return p.tags.includes(tags.featured.$id)
  })

  console.log('\nFeatured Products:')
  for (const p of featuredProducts) {
    const productTags = await p.tags
    console.log(`  - ${p.name} [${productTags.map((t: any) => t.name).join(', ')}]`)
  }

  // Step 8: Batch operations with forEach
  console.log('\n--- Batch Operations (forEach) ---\n')

  // Update inventory for all products (simulating a stock update)
  let updatedCount = 0
  await db.Product.forEach(
    async (product) => {
      // In real scenario, you might fetch from inventory system
      const newInventory = product.inventory + 10
      await db.Product.update(product.$id, { inventory: newInventory })
      updatedCount++
    },
    {
      concurrency: 5, // Process 5 at a time
      onProgress: (p) => {
        if (p.completed % 2 === 0) {
          console.log(`Progress: ${p.completed}/${p.total}`)
        }
      },
    }
  )

  console.log(`Updated inventory for ${updatedCount} products`)

  // Step 9: Create an order
  console.log('\n--- Creating Order ---\n')

  const order = await db.Order.create({
    customer: customers[0].$id,
    status: 'confirmed',
    total: 0,
    createdAt: new Date(),
  })

  // Add items
  const item1 = await db.OrderItem.create({
    product: laptop.$id,
    quantity: 1,
    unitPrice: laptop.price,
  })

  const item2 = await db.OrderItem.create({
    product: tshirt.$id,
    variant: variants[1].$id, // Medium Red
    quantity: 2,
    unitPrice: tshirt.price,
  })

  // Calculate total
  const items = await order.items
  const total = items.reduce(
    (sum, item) => sum + (item.quantity as number) * (item.unitPrice as number),
    0
  )

  await db.Order.update(order.$id, { total })

  console.log(`Order created for ${customers[0].name}`)
  console.log(`  Items: ${items.length}`)
  console.log(`  Total: $${total.toFixed(2)}`)

  // Step 10: Show catalog statistics
  console.log('\n--- Catalog Statistics ---\n')

  const allProducts = await db.Product.list()
  const activeProducts = allProducts.filter((p) => p.isActive)
  const totalInventory = allProducts.reduce((sum, p) => sum + (p.inventory as number), 0)
  const avgPrice = allProducts.reduce((sum, p) => sum + (p.price as number), 0) / allProducts.length

  console.log(`Total Products: ${allProducts.length}`)
  console.log(`Active Products: ${activeProducts.length}`)
  console.log(`Total Inventory: ${totalInventory} units`)
  console.log(`Average Price: $${avgPrice.toFixed(2)}`)

  // Products by category
  console.log('\nProducts by Category:')
  const categories = await db.Category.list()
  for (const cat of categories) {
    const catProducts = await cat.products
    if (catProducts.length > 0) {
      console.log(`  ${cat.name}: ${catProducts.length} products`)
    }
  }

  // Products by tag
  console.log('\nProducts by Tag:')
  for (const [name, tag] of Object.entries(tags)) {
    const tagProducts = await tag.products
    console.log(`  ${tag.name}: ${tagProducts.length} products`)
  }

  console.log('\n=== Product Catalog Example Complete ===')
}

main().catch(console.error)
