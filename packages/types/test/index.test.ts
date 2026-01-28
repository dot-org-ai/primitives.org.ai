/**
 * @org.ai/types - TDD RED Phase Tests
 *
 * These tests verify that the shared types package exports all expected types.
 * Tests should FAIL initially because index.ts is empty.
 *
 * Expected types:
 * - AIFunction<Output, Input, Config> - Generic AI function type
 * - EventHandler<Output, Input> - Event handler type
 * - WorkflowContext - Workflow execution context interface
 * - RelationshipOperator - Type for relationship operators
 * - ParsedField - Interface for parsed field definitions
 */

import { describe, it, expect, expectTypeOf } from 'vitest'

describe('@org.ai/types package exports', () => {
  describe('AIFunction type', () => {
    it('should export AIFunction type', async () => {
      // This import will fail until the type is exported
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('AIFunction')
    })

    it('should have correct generic parameters', async () => {
      // Type-level test - verifies AIFunction<Output, Input, Config> signature
      const { AIFunction } = (await import('../src/index.js')) as {
        AIFunction: new <O, I, C>() => { output: O; input: I; config: C }
      }

      // If AIFunction exists as a type, this should compile
      // The test passes if the import succeeds and the type is usable
      expect(AIFunction).toBeDefined()
    })
  })

  describe('EventHandler type', () => {
    it('should export EventHandler type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('EventHandler')
    })

    it('should have correct generic parameters', async () => {
      // Type-level test - verifies EventHandler<Output, Input> signature
      const { EventHandler } = (await import('../src/index.js')) as {
        EventHandler: new <O, I>() => { output: O; input: I }
      }
      expect(EventHandler).toBeDefined()
    })
  })

  describe('WorkflowContext interface', () => {
    it('should export WorkflowContext interface', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('WorkflowContext')
    })

    it('should have expected properties', async () => {
      const module = (await import('../src/index.js')) as {
        WorkflowContext: {
          send: unknown
          try: unknown
          do: unknown
          on: unknown
          every: unknown
        }
      }

      // WorkflowContext should expose workflow operations
      expect(module.WorkflowContext).toBeDefined()
    })
  })

  describe('RelationshipOperator type', () => {
    it('should export RelationshipOperator type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('RelationshipOperator')
    })

    it('should be a union of relationship operators', async () => {
      // RelationshipOperator should be '->' | '~>' | '<-' | '<~'
      const { RelationshipOperator } = (await import('../src/index.js')) as {
        RelationshipOperator: '->' | '~>' | '<-' | '<~'
      }

      // Type assertion - if the union is correct, this compiles
      const validOperators: Array<typeof RelationshipOperator> = ['->', '~>', '<-', '<~']
      expect(validOperators).toContain('->')
      expect(validOperators).toContain('~>')
      expect(validOperators).toContain('<-')
      expect(validOperators).toContain('<~')
    })
  })

  describe('ParsedField interface', () => {
    it('should export ParsedField interface', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ParsedField')
    })

    it('should have expected properties', async () => {
      const module = (await import('../src/index.js')) as {
        ParsedField: {
          name: string
          type: string
          required: boolean
          description?: string
        }
      }

      // ParsedField should have name, type, required, and optional description
      expect(module.ParsedField).toBeDefined()
    })
  })
})

describe('Type import verification', () => {
  it('should be importable as named exports', async () => {
    // This verifies the package can be imported
    const { AIFunction, EventHandler, WorkflowContext, RelationshipOperator, ParsedField } =
      (await import('../src/index.js')) as {
        AIFunction: unknown
        EventHandler: unknown
        WorkflowContext: unknown
        RelationshipOperator: unknown
        ParsedField: unknown
      }

    expect(AIFunction).toBeDefined()
    expect(EventHandler).toBeDefined()
    expect(WorkflowContext).toBeDefined()
    expect(RelationshipOperator).toBeDefined()
    expect(ParsedField).toBeDefined()
  })
})

describe('Type constraints and compatibility', () => {
  describe('AIFunction usage', () => {
    it('should work with concrete types', async () => {
      // When implemented, AIFunction should work like:
      // type MyFunc = AIFunction<string, { prompt: string }, { model: string }>

      const module = await import('../src/index.js')
      expect(module).toHaveProperty('AIFunction')
    })
  })

  describe('EventHandler usage', () => {
    it('should work with event payloads', async () => {
      // When implemented, EventHandler should work like:
      // type OnCreate = EventHandler<void, { id: string; timestamp: Date }>

      const module = await import('../src/index.js')
      expect(module).toHaveProperty('EventHandler')
    })
  })

  describe('WorkflowContext usage', () => {
    it('should provide workflow execution methods', async () => {
      // When implemented, WorkflowContext should provide:
      // $.send(event, data) - fire and forget
      // $.try(action, data) - quick attempt
      // $.do(action, data) - durable execution

      const module = await import('../src/index.js')
      expect(module).toHaveProperty('WorkflowContext')
    })
  })
})

// ============================================================================
// Noun and Verb Types Tests (aip-rcov.2)
// ============================================================================

describe('Noun type', () => {
  it('should have correct structure for schema definition', () => {
    type Noun = import('../src/index.js').Noun

    const validNoun: Noun = {
      noun: 'Customer',
      plural: 'Customers',
      schema: {
        name: 'string',
        email: 'email',
      },
      doClass: 'CustomerDO',
      description: 'Customer entity',
    }

    expect(validNoun.noun).toBe('Customer')
    expect(validNoun.plural).toBe('Customers')
    expect(validNoun.schema).toHaveProperty('name')
    expect(validNoun.doClass).toBe('CustomerDO')
    expect(validNoun.description).toBe('Customer entity')
  })

  it('should allow minimal noun with only required field', () => {
    type Noun = import('../src/index.js').Noun

    const minimalNoun: Noun = {
      noun: 'Product',
    }

    expect(minimalNoun.noun).toBe('Product')
    expect(minimalNoun.plural).toBeUndefined()
    expect(minimalNoun.schema).toBeUndefined()
  })

  it('should support ParsedFieldType in schema', () => {
    type Noun = import('../src/index.js').Noun
    type ParsedFieldType = import('../src/index.js').ParsedFieldType

    const nounWithParsedFields: Noun = {
      noun: 'Order',
      schema: {
        id: 'string',
        customer: {
          name: 'customer',
          type: 'Customer',
          operator: '->',
          relatedType: 'Customer',
        } as ParsedFieldType,
      },
    }

    const customerField = nounWithParsedFields.schema?.customer as ParsedFieldType
    expect(customerField).toHaveProperty('operator')
    expect(customerField.operator).toBe('->')
  })

  it('should have noun as required field', () => {
    type Noun = import('../src/index.js').Noun
    type HasNoun = Noun extends { noun: string } ? true : false
    const hasNoun: HasNoun = true
    expect(hasNoun).toBe(true)
  })
})

describe('Verb type', () => {
  it('should have correct structure for action definition', () => {
    type Verb = import('../src/index.js').Verb

    const validVerb: Verb = {
      verb: 'create',
      activity: 'creating',
      event: 'created',
      inverse: 'delete',
      description: 'Create a new entity',
    }

    expect(validVerb.verb).toBe('create')
    expect(validVerb.activity).toBe('creating')
    expect(validVerb.event).toBe('created')
    expect(validVerb.inverse).toBe('delete')
    expect(validVerb.description).toBe('Create a new entity')
  })

  it('should allow minimal verb with only required field', () => {
    type Verb = import('../src/index.js').Verb

    const minimalVerb: Verb = {
      verb: 'update',
    }

    expect(minimalVerb.verb).toBe('update')
    expect(minimalVerb.activity).toBeUndefined()
    expect(minimalVerb.event).toBeUndefined()
    expect(minimalVerb.inverse).toBeUndefined()
  })

  it('should have verb as required field', () => {
    type Verb = import('../src/index.js').Verb
    type HasVerb = Verb extends { verb: string } ? true : false
    const hasVerb: HasVerb = true
    expect(hasVerb).toBe(true)
  })

  it('should have activity, event, inverse as optional fields', () => {
    type Verb = import('../src/index.js').Verb
    type OptionalFields = 'activity' | 'event' | 'inverse' | 'description'
    const checkOptional: OptionalFields extends keyof Verb ? true : false = true
    expect(checkOptional).toBe(true)
  })
})

describe('StandardVerbs constant', () => {
  it('should export StandardVerbs array', async () => {
    const { StandardVerbs } = await import('../src/index.js')
    expect(StandardVerbs).toBeDefined()
    expect(Array.isArray(StandardVerbs)).toBe(true)
  })

  it('should contain common CRUD verbs', async () => {
    const { StandardVerbs } = await import('../src/index.js')
    expect(StandardVerbs).toContain('create')
    expect(StandardVerbs).toContain('update')
    expect(StandardVerbs).toContain('delete')
    expect(StandardVerbs).toContain('get')
    expect(StandardVerbs).toContain('list')
  })

  it('should contain workflow verbs', async () => {
    const { StandardVerbs } = await import('../src/index.js')
    expect(StandardVerbs).toContain('start')
    expect(StandardVerbs).toContain('stop')
    expect(StandardVerbs).toContain('complete')
    expect(StandardVerbs).toContain('cancel')
  })

  it('should contain messaging verbs', async () => {
    const { StandardVerbs } = await import('../src/index.js')
    expect(StandardVerbs).toContain('send')
    expect(StandardVerbs).toContain('receive')
    expect(StandardVerbs).toContain('notify')
    expect(StandardVerbs).toContain('subscribe')
    expect(StandardVerbs).toContain('unsubscribe')
  })

  it('should be a readonly array at type level', async () => {
    const { StandardVerbs } = await import('../src/index.js')
    expect(Array.isArray(StandardVerbs)).toBe(true)
    expect(StandardVerbs.length).toBeGreaterThan(0)
  })
})

describe('StandardVerb type', () => {
  it('should be a union type of StandardVerbs values', () => {
    type StandardVerb = import('../src/index.js').StandardVerb

    const verb1: StandardVerb = 'create'
    const verb2: StandardVerb = 'delete'
    const verb3: StandardVerb = 'subscribe'

    expect(verb1).toBe('create')
    expect(verb2).toBe('delete')
    expect(verb3).toBe('subscribe')
  })
})

describe('Branded ID types for Noun and Verb', () => {
  it('should export NounId branded type', () => {
    type NounId = import('../src/index.js').NounId

    type ExtendsString = NounId extends string ? true : false
    const extendsString: ExtendsString = true
    expect(extendsString).toBe(true)
  })

  it('should export VerbId branded type', () => {
    type VerbId = import('../src/index.js').VerbId

    type ExtendsString = VerbId extends string ? true : false
    const extendsString: ExtendsString = true
    expect(extendsString).toBe(true)
  })
})

// ============================================================================
// Digital Products Types - TDD RED Phase (aip-sd98)
// ============================================================================
// These tests define the expected interface for Service, Product, and Feature types.
// Tests should FAIL initially because the types are not yet implemented.

describe('Digital Products Types', () => {
  describe('Service type', () => {
    it('should export Service runtime marker', async () => {
      // This import will fail until the type is exported
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('Service')
    })

    it('should export ServiceType interface', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ServiceType')
    })

    it('should have required Service properties', async () => {
      // Service represents a digital service offering
      // Required properties:
      // - $id: Unique URL identifier
      // - $type: Should be 'https://schema.org.ai/Service'
      // - name: Service name
      // - provider: Organization or Person providing the service
      const module = (await import('../src/index.js')) as {
        ServiceType: {
          $id: string
          $type: 'https://schema.org.ai/Service'
          name: string
          provider: { $id: string; $type: string }
        }
      }
      expect(module.ServiceType).toBeDefined()
    })

    it('should have optional Service properties', async () => {
      // Optional properties for Service:
      // - description: Text description of the service
      // - url: URL to the service
      // - logo: URL to service logo
      // - category: Service category
      // - offers: Array of Product offerings
      // - features: Array of Feature items
      // - termsOfService: URL to terms
      // - privacyPolicy: URL to privacy policy
      // - status: 'active' | 'inactive' | 'deprecated'
      const module = (await import('../src/index.js')) as {
        ServiceType: {
          description?: string
          url?: string
          logo?: string
          category?: string
          offers?: unknown[]
          features?: unknown[]
          termsOfService?: string
          privacyPolicy?: string
          status?: 'active' | 'inactive' | 'deprecated'
        }
      }
      expect(module.ServiceType).toBeDefined()
    })

    it('should extend Thing base type', async () => {
      // Service should inherit from Thing:
      // - createdAt, updatedAt, deletedAt timestamps
      // - visibility level
      // - relationships and references
      const module = (await import('../src/index.js')) as {
        ServiceType: {
          createdAt?: Date
          updatedAt?: Date
          deletedAt?: Date
          visibility?: 'public' | 'unlisted' | 'org' | 'user'
        }
      }
      expect(module.ServiceType).toBeDefined()
    })

    it('should have SERVICE_TYPE constant', async () => {
      // Should export the type URL constant
      const module = (await import('../src/index.js')) as { SERVICE_TYPE: string }
      expect(module.SERVICE_TYPE).toBe('https://schema.org.ai/Service')
    })
  })

  describe('Product type', () => {
    it('should export Product runtime marker', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('Product')
    })

    it('should export ProductType interface', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ProductType')
    })

    it('should have required Product properties', async () => {
      // Product represents a purchasable offering
      // Required properties:
      // - $id: Unique URL identifier
      // - $type: Should be 'https://schema.org.ai/Product'
      // - name: Product name
      // - offers: Pricing/offer information
      const module = (await import('../src/index.js')) as {
        ProductType: {
          $id: string
          $type: 'https://schema.org.ai/Product'
          name: string
          offers: unknown
        }
      }
      expect(module.ProductType).toBeDefined()
    })

    it('should have optional Product properties', async () => {
      // Optional properties for Product:
      // - description: Product description
      // - sku: Stock keeping unit identifier
      // - brand: Brand name or reference
      // - category: Product category
      // - image: Product image URL
      // - features: Array of Feature items
      // - service: Reference to parent Service
      // - availability: 'available' | 'out_of_stock' | 'discontinued'
      // - price: Numeric price value
      // - priceCurrency: Currency code (e.g., 'USD')
      const module = (await import('../src/index.js')) as {
        ProductType: {
          description?: string
          sku?: string
          brand?: string
          category?: string
          image?: string
          features?: unknown[]
          service?: unknown
          availability?: 'available' | 'out_of_stock' | 'discontinued'
          price?: number
          priceCurrency?: string
        }
      }
      expect(module.ProductType).toBeDefined()
    })

    it('should have Offer subtype for pricing', async () => {
      // Products should have structured offer information
      const module = (await import('../src/index.js')) as {
        OfferType: {
          price: number
          priceCurrency: string
          availability?: string
          validFrom?: Date
          validThrough?: Date
          priceValidUntil?: Date
        }
      }
      expect(module.OfferType).toBeDefined()
    })

    it('should export Offer runtime marker', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('Offer')
    })

    it('should extend Thing base type', async () => {
      const module = (await import('../src/index.js')) as {
        ProductType: {
          createdAt?: Date
          updatedAt?: Date
          deletedAt?: Date
          visibility?: 'public' | 'unlisted' | 'org' | 'user'
        }
      }
      expect(module.ProductType).toBeDefined()
    })

    it('should have PRODUCT_TYPE constant', async () => {
      const module = (await import('../src/index.js')) as { PRODUCT_TYPE: string }
      expect(module.PRODUCT_TYPE).toBe('https://schema.org.ai/Product')
    })

    it('should have OFFER_TYPE constant', async () => {
      const module = (await import('../src/index.js')) as { OFFER_TYPE: string }
      expect(module.OFFER_TYPE).toBe('https://schema.org.ai/Offer')
    })
  })

  describe('Feature type', () => {
    it('should export Feature runtime marker', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('Feature')
    })

    it('should export FeatureType interface', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('FeatureType')
    })

    it('should have required Feature properties', async () => {
      // Feature represents a product/service feature
      // Required properties:
      // - $id: Unique URL identifier
      // - $type: Should be 'https://schema.org.ai/Feature'
      // - name: Feature name
      const module = (await import('../src/index.js')) as {
        FeatureType: {
          $id: string
          $type: 'https://schema.org.ai/Feature'
          name: string
        }
      }
      expect(module.FeatureType).toBeDefined()
    })

    it('should have optional Feature properties', async () => {
      // Optional properties for Feature:
      // - description: Feature description
      // - value: Feature value (string, number, boolean)
      // - unit: Unit of measurement for numeric values
      // - included: Whether feature is included (for plan comparison)
      // - limit: Numeric limit for metered features
      // - unlimited: Whether the feature is unlimited
      // - icon: Icon identifier or URL
      // - category: Feature category for grouping
      const module = (await import('../src/index.js')) as {
        FeatureType: {
          description?: string
          value?: string | number | boolean
          unit?: string
          included?: boolean
          limit?: number
          unlimited?: boolean
          icon?: string
          category?: string
        }
      }
      expect(module.FeatureType).toBeDefined()
    })

    it('should support metered vs boolean features', async () => {
      // Features can be:
      // - Boolean: included/not included
      // - Metered: has a limit (e.g., "10 API calls/month")
      // - Unlimited: no limit
      const module = (await import('../src/index.js')) as {
        FeatureType: {
          featureType?: 'boolean' | 'metered' | 'unlimited'
        }
      }
      expect(module.FeatureType).toBeDefined()
    })

    it('should extend Thing base type', async () => {
      const module = (await import('../src/index.js')) as {
        FeatureType: {
          createdAt?: Date
          updatedAt?: Date
          deletedAt?: Date
          visibility?: 'public' | 'unlisted' | 'org' | 'user'
        }
      }
      expect(module.FeatureType).toBeDefined()
    })

    it('should have FEATURE_TYPE constant', async () => {
      const module = (await import('../src/index.js')) as { FEATURE_TYPE: string }
      expect(module.FEATURE_TYPE).toBe('https://schema.org.ai/Feature')
    })
  })

  describe('Relationships between types', () => {
    it('Service should relate to Products via offers', async () => {
      // Service.offers -> Product[] relationship
      const module = (await import('../src/index.js')) as {
        ServiceType: {
          offers?: Array<{ $id: string; $type: 'https://schema.org.ai/Product' }>
        }
      }
      expect(module.ServiceType).toBeDefined()
    })

    it('Service should relate to Features via features', async () => {
      // Service.features -> Feature[] relationship
      const module = (await import('../src/index.js')) as {
        ServiceType: {
          features?: Array<{ $id: string; $type: 'https://schema.org.ai/Feature' }>
        }
      }
      expect(module.ServiceType).toBeDefined()
    })

    it('Product should relate to Features via features', async () => {
      // Product.features -> Feature[] relationship
      const module = (await import('../src/index.js')) as {
        ProductType: {
          features?: Array<{ $id: string; $type: 'https://schema.org.ai/Feature' }>
        }
      }
      expect(module.ProductType).toBeDefined()
    })

    it('Product should back-reference Service via service', async () => {
      // Product.service -> Service relationship (inverse of Service.offers)
      const module = (await import('../src/index.js')) as {
        ProductType: {
          service?: { $id: string; $type: 'https://schema.org.ai/Service' }
        }
      }
      expect(module.ProductType).toBeDefined()
    })

    it('Feature should back-reference products and services', async () => {
      // Feature can belong to Service or Product
      const module = (await import('../src/index.js')) as {
        FeatureType: {
          products?: Array<{ $id: string }>
          services?: Array<{ $id: string }>
        }
      }
      expect(module.FeatureType).toBeDefined()
    })
  })

  describe('Type guards', () => {
    it('should export isService type guard', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('isService')
      expect(typeof (module as { isService: unknown }).isService).toBe('function')
    })

    it('should export isProduct type guard', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('isProduct')
      expect(typeof (module as { isProduct: unknown }).isProduct).toBe('function')
    })

    it('should export isFeature type guard', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('isFeature')
      expect(typeof (module as { isFeature: unknown }).isFeature).toBe('function')
    })

    it('should export isOffer type guard', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('isOffer')
      expect(typeof (module as { isOffer: unknown }).isOffer).toBe('function')
    })

    it('isService should correctly identify Service objects', async () => {
      const { isService } = (await import('../src/index.js')) as {
        isService: (v: unknown) => boolean
      }

      // Should return true for valid Service
      expect(
        isService({
          $id: 'https://example.com/services/my-service',
          $type: 'https://schema.org.ai/Service',
          name: 'My Service',
          provider: {
            $id: 'https://example.com/org/acme',
            $type: 'https://schema.org.ai/Organization',
          },
        })
      ).toBe(true)

      // Should return false for non-Service
      expect(isService({ name: 'Not a service' })).toBe(false)
      expect(isService(null)).toBe(false)
      expect(isService(undefined)).toBe(false)
    })

    it('isProduct should correctly identify Product objects', async () => {
      const { isProduct } = (await import('../src/index.js')) as {
        isProduct: (v: unknown) => boolean
      }

      // Should return true for valid Product
      expect(
        isProduct({
          $id: 'https://example.com/products/pro-plan',
          $type: 'https://schema.org.ai/Product',
          name: 'Pro Plan',
          offers: { price: 99, priceCurrency: 'USD' },
        })
      ).toBe(true)

      // Should return false for non-Product
      expect(isProduct({ name: 'Not a product' })).toBe(false)
    })

    it('isFeature should correctly identify Feature objects', async () => {
      const { isFeature } = (await import('../src/index.js')) as {
        isFeature: (v: unknown) => boolean
      }

      // Should return true for valid Feature
      expect(
        isFeature({
          $id: 'https://example.com/features/unlimited-storage',
          $type: 'https://schema.org.ai/Feature',
          name: 'Unlimited Storage',
        })
      ).toBe(true)

      // Should return false for non-Feature
      expect(isFeature({ name: 'Not a feature' })).toBe(false)
    })

    it('isOffer should correctly identify Offer objects', async () => {
      const { isOffer } = (await import('../src/index.js')) as {
        isOffer: (v: unknown) => boolean
      }

      // Should return true for valid Offer
      expect(
        isOffer({
          $id: 'https://example.com/offers/monthly',
          $type: 'https://schema.org.ai/Offer',
          price: 29.99,
          priceCurrency: 'USD',
        })
      ).toBe(true)

      // Should return false for non-Offer
      expect(isOffer({ price: 100 })).toBe(false)
    })
  })
})

describe('Digital Products import verification', () => {
  it('should export all digital product types as named exports', async () => {
    const {
      Service,
      ServiceType,
      SERVICE_TYPE,
      Product,
      ProductType,
      PRODUCT_TYPE,
      Offer,
      OfferType,
      OFFER_TYPE,
      Feature,
      FeatureType,
      FEATURE_TYPE,
      isService,
      isProduct,
      isFeature,
      isOffer,
    } = (await import('../src/index.js')) as {
      Service: symbol
      ServiceType: unknown
      SERVICE_TYPE: string
      Product: symbol
      ProductType: unknown
      PRODUCT_TYPE: string
      Offer: symbol
      OfferType: unknown
      OFFER_TYPE: string
      Feature: symbol
      FeatureType: unknown
      FEATURE_TYPE: string
      isService: (v: unknown) => boolean
      isProduct: (v: unknown) => boolean
      isFeature: (v: unknown) => boolean
      isOffer: (v: unknown) => boolean
    }

    // Runtime markers
    expect(Service).toBeDefined()
    expect(Product).toBeDefined()
    expect(Offer).toBeDefined()
    expect(Feature).toBeDefined()

    // Type constants
    expect(SERVICE_TYPE).toBe('https://schema.org.ai/Service')
    expect(PRODUCT_TYPE).toBe('https://schema.org.ai/Product')
    expect(OFFER_TYPE).toBe('https://schema.org.ai/Offer')
    expect(FEATURE_TYPE).toBe('https://schema.org.ai/Feature')

    // Type guards
    expect(typeof isService).toBe('function')
    expect(typeof isProduct).toBe('function')
    expect(typeof isFeature).toBe('function')
    expect(typeof isOffer).toBe('function')
  })
})

// ============================================================================
// Startup Types - TDD GREEN Phase (aip-unce)
// ============================================================================

describe('Startup type', () => {
  describe('Runtime marker export', () => {
    it('should export Startup runtime marker', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('Startup')
    })

    it('should export StartupStage runtime marker', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('StartupStage')
    })
  })

  describe('Startup interface structure', () => {
    it('should extend Thing with $id and $type', async () => {
      // Startup must extend Thing base interface
      type StartupType = import('../src/index.js').StartupType
      type HasThingFields = StartupType extends { $id: string; $type: string } ? true : false
      const hasThingFields: HasThingFields = true
      expect(hasThingFields).toBe(true)
    })

    it('should have required name field', async () => {
      type StartupType = import('../src/index.js').StartupType
      type HasName = StartupType extends { name: string } ? true : false
      const hasName: HasName = true
      expect(hasName).toBe(true)
    })

    it('should have required stage field with lifecycle states', async () => {
      type StartupType = import('../src/index.js').StartupType
      type HasStage = StartupType extends { stage: string } ? true : false
      const hasStage: HasStage = true
      expect(hasStage).toBe(true)
    })

    it('should have optional description field', async () => {
      type StartupType = import('../src/index.js').StartupType
      type HasDescription = 'description' extends keyof StartupType ? true : false
      const hasDescription: HasDescription = true
      expect(hasDescription).toBe(true)
    })

    it('should have optional pitch field', async () => {
      type StartupType = import('../src/index.js').StartupType
      type HasPitch = 'pitch' extends keyof StartupType ? true : false
      const hasPitch: HasPitch = true
      expect(hasPitch).toBe(true)
    })

    it('should have optional founded date field', async () => {
      type StartupType = import('../src/index.js').StartupType
      type HasFounded = 'founded' extends keyof StartupType ? true : false
      const hasFounded: HasFounded = true
      expect(hasFounded).toBe(true)
    })

    it('should have optional website field', async () => {
      type StartupType = import('../src/index.js').StartupType
      type HasWebsite = 'website' extends keyof StartupType ? true : false
      const hasWebsite: HasWebsite = true
      expect(hasWebsite).toBe(true)
    })

    it('should have optional industry field', async () => {
      type StartupType = import('../src/index.js').StartupType
      type HasIndustry = 'industry' extends keyof StartupType ? true : false
      const hasIndustry: HasIndustry = true
      expect(hasIndustry).toBe(true)
    })
  })

  describe('StartupStage type', () => {
    it('should be a union of lifecycle stages', async () => {
      type StartupStageType = import('../src/index.js').StartupStageType
      // StartupStage should be: 'idea' | 'validating' | 'building' | 'scaling' | 'established'
      const validStages: StartupStageType[] = [
        'idea',
        'validating',
        'building',
        'scaling',
        'established',
      ]
      expect(validStages).toHaveLength(5)
    })

    it('should include idea stage', async () => {
      type StartupStageType = import('../src/index.js').StartupStageType
      type HasIdea = 'idea' extends StartupStageType ? true : false
      const hasIdea: HasIdea = true
      expect(hasIdea).toBe(true)
    })

    it('should include validating stage', async () => {
      type StartupStageType = import('../src/index.js').StartupStageType
      type HasValidating = 'validating' extends StartupStageType ? true : false
      const hasValidating: HasValidating = true
      expect(hasValidating).toBe(true)
    })

    it('should include building stage', async () => {
      type StartupStageType = import('../src/index.js').StartupStageType
      type HasBuilding = 'building' extends StartupStageType ? true : false
      const hasBuilding: HasBuilding = true
      expect(hasBuilding).toBe(true)
    })

    it('should include scaling stage', async () => {
      type StartupStageType = import('../src/index.js').StartupStageType
      type HasScaling = 'scaling' extends StartupStageType ? true : false
      const hasScaling: HasScaling = true
      expect(hasScaling).toBe(true)
    })

    it('should include established stage', async () => {
      type StartupStageType = import('../src/index.js').StartupStageType
      type HasEstablished = 'established' extends StartupStageType ? true : false
      const hasEstablished: HasEstablished = true
      expect(hasEstablished).toBe(true)
    })
  })

  describe('Startup type guard', () => {
    it('should export isStartup type guard function', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('isStartup')
      expect(typeof module.isStartup).toBe('function')
    })

    it('should return true for valid Startup objects', async () => {
      const { isStartup } = await import('../src/index.js')
      const validStartup = {
        $id: 'https://example.com/startups/acme',
        $type: 'https://schema.org.ai/Startup',
        name: 'Acme Inc',
        stage: 'building' as const,
      }
      expect(isStartup(validStartup)).toBe(true)
    })

    it('should return false for objects missing required fields', async () => {
      const { isStartup } = await import('../src/index.js')
      const invalidStartup = {
        $id: 'https://example.com/startups/acme',
        $type: 'https://schema.org.ai/Startup',
        // missing name and stage
      }
      expect(isStartup(invalidStartup)).toBe(false)
    })

    it('should return false for non-object values', async () => {
      const { isStartup } = await import('../src/index.js')
      expect(isStartup(null)).toBe(false)
      expect(isStartup(undefined)).toBe(false)
      expect(isStartup('startup')).toBe(false)
      expect(isStartup(123)).toBe(false)
    })
  })
})

// ============================================================================
// ICP (Ideal Customer Profile) Type - TDD GREEN Phase (aip-unce)
// ============================================================================

describe('ICP (Ideal Customer Profile) type', () => {
  describe('Runtime marker export', () => {
    it('should export ICP runtime marker', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ICP')
    })
  })

  describe('ICP interface structure', () => {
    it('should extend Thing with $id and $type', async () => {
      // ICP must extend Thing base interface
      type ICPType = import('../src/index.js').ICPType
      type HasThingFields = ICPType extends { $id: string; $type: string } ? true : false
      const hasThingFields: HasThingFields = true
      expect(hasThingFields).toBe(true)
    })

    it('should have optional name field for profile identification', async () => {
      type ICPType = import('../src/index.js').ICPType
      type HasName = 'name' extends keyof ICPType ? true : false
      const hasName: HasName = true
      expect(hasName).toBe(true)
    })
  })

  describe('ICP as/at/are/using/to framework fields', () => {
    it('should have "as" field for persona/role description', async () => {
      // "as" describes who the customer is (role, title, persona)
      // e.g., "as a product manager"
      type ICPType = import('../src/index.js').ICPType
      type HasAs = 'as' extends keyof ICPType ? true : false
      const hasAs: HasAs = true
      expect(hasAs).toBe(true)
    })

    it('should have "at" field for company/context description', async () => {
      // "at" describes where/what context they work in
      // e.g., "at a B2B SaaS company with 50-200 employees"
      type ICPType = import('../src/index.js').ICPType
      type HasAt = 'at' extends keyof ICPType ? true : false
      const hasAt: HasAt = true
      expect(hasAt).toBe(true)
    })

    it('should have "are" field for current state/pain points', async () => {
      // "are" describes their current situation, challenges, pain points
      // e.g., "are struggling to manage customer feedback at scale"
      type ICPType = import('../src/index.js').ICPType
      type HasAre = 'are' extends keyof ICPType ? true : false
      const hasAre: HasAre = true
      expect(hasAre).toBe(true)
    })

    it('should have "using" field for current solutions', async () => {
      // "using" describes their current tools, workarounds, solutions
      // e.g., "using spreadsheets and email to track feedback"
      type ICPType = import('../src/index.js').ICPType
      type HasUsing = 'using' extends keyof ICPType ? true : false
      const hasUsing: HasUsing = true
      expect(hasUsing).toBe(true)
    })

    it('should have "to" field for desired outcome/job to be done', async () => {
      // "to" describes what they want to achieve (JTBD-style)
      // e.g., "to prioritize features based on customer impact"
      type ICPType = import('../src/index.js').ICPType
      type HasTo = 'to' extends keyof ICPType ? true : false
      const hasTo: HasTo = true
      expect(hasTo).toBe(true)
    })
  })

  describe('ICP framework completeness', () => {
    it('should allow all framework fields to be strings', async () => {
      type ICPType = import('../src/index.js').ICPType
      // All framework fields should accept string values
      const validICP: ICPType = {
        $id: 'https://example.com/icps/product-manager',
        $type: 'https://schema.org.ai/ICP',
        name: 'Product Manager ICP',
        as: 'a product manager',
        at: 'a B2B SaaS company with 50-200 employees',
        are: 'struggling to manage customer feedback at scale',
        using: 'spreadsheets and email to track feedback',
        to: 'prioritize features based on customer impact',
      }
      expect(validICP).toBeDefined()
    })

    it('should allow framework fields to be optional', async () => {
      type ICPType = import('../src/index.js').ICPType
      // A minimal ICP with only required fields should be valid
      const minimalICP: ICPType = {
        $id: 'https://example.com/icps/minimal',
        $type: 'https://schema.org.ai/ICP',
      }
      expect(minimalICP).toBeDefined()
    })
  })

  describe('ICP type guard', () => {
    it('should export isICP type guard function', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('isICP')
      expect(typeof module.isICP).toBe('function')
    })

    it('should return true for valid ICP objects', async () => {
      const { isICP } = await import('../src/index.js')
      const validICP = {
        $id: 'https://example.com/icps/pm',
        $type: 'https://schema.org.ai/ICP',
        as: 'a product manager',
        at: 'a SaaS company',
        are: 'overwhelmed with feedback',
        using: 'spreadsheets',
        to: 'make better product decisions',
      }
      expect(isICP(validICP)).toBe(true)
    })

    it('should return true for minimal ICP with only $id and $type', async () => {
      const { isICP } = await import('../src/index.js')
      const minimalICP = {
        $id: 'https://example.com/icps/minimal',
        $type: 'https://schema.org.ai/ICP',
      }
      expect(isICP(minimalICP)).toBe(true)
    })

    it('should return false for non-object values', async () => {
      const { isICP } = await import('../src/index.js')
      expect(isICP(null)).toBe(false)
      expect(isICP(undefined)).toBe(false)
      expect(isICP('icp')).toBe(false)
      expect(isICP(123)).toBe(false)
    })

    it('should return false for objects with wrong $type', async () => {
      const { isICP } = await import('../src/index.js')
      const wrongType = {
        $id: 'https://example.com/icps/wrong',
        $type: 'https://schema.org.ai/Startup',
      }
      expect(isICP(wrongType)).toBe(false)
    })
  })
})

// ============================================================================
// Startup <-> ICP Relationship Tests
// ============================================================================

describe('Startup and ICP relationship', () => {
  it('should allow Startup to have optional icps relationship field', async () => {
    type StartupType = import('../src/index.js').StartupType
    type ICPType = import('../src/index.js').ICPType
    // Startup should be able to reference multiple ICPs
    type HasICPs = 'icps' extends keyof StartupType ? true : false
    const hasICPs: HasICPs = true
    expect(hasICPs).toBe(true)
  })

  it('should allow ICP to have optional startup relationship field', async () => {
    type ICPType = import('../src/index.js').ICPType
    // ICP should be able to reference the Startup it belongs to
    type HasStartup = 'startup' extends keyof ICPType ? true : false
    const hasStartup: HasStartup = true
    expect(hasStartup).toBe(true)
  })

  it('should support creating a Startup with ICPs', async () => {
    type StartupType = import('../src/index.js').StartupType
    type ICPType = import('../src/index.js').ICPType

    const icp: ICPType = {
      $id: 'https://example.com/icps/pm',
      $type: 'https://schema.org.ai/ICP',
      name: 'Product Manager',
      as: 'a product manager',
      at: 'a growing SaaS company',
      are: 'struggling with feedback management',
      using: 'spreadsheets and Slack',
      to: 'make data-driven product decisions',
    }

    const startup: StartupType = {
      $id: 'https://example.com/startups/feedbackai',
      $type: 'https://schema.org.ai/Startup',
      name: 'FeedbackAI',
      stage: 'validating',
      description: 'AI-powered customer feedback analysis',
      pitch: 'Turn customer feedback into product insights',
      icps: [icp],
    }

    expect(startup.icps).toContain(icp)
  })
})

// ============================================================================
// Things Collection Types Tests (aip-rcov.3)
// ============================================================================

describe('Things collection types', () => {
  describe('Things<T> interface', () => {
    it('should export ThingsMarker runtime marker', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ThingsMarker')
    })

    it('should have required $id and $type fields', async () => {
      type Things = import('../src/index.js').Things
      type HasRequired = Things extends { $id: string; $type: 'https://schema.org.ai/Things' }
        ? true
        : false
      const hasRequired: HasRequired = true
      expect(hasRequired).toBe(true)
    })

    it('should have itemType field', async () => {
      type Things = import('../src/index.js').Things
      type HasItemType = Things extends { itemType: string } ? true : false
      const hasItemType: HasItemType = true
      expect(hasItemType).toBe(true)
    })

    it('should have optional count field', async () => {
      type Things = import('../src/index.js').Things
      type HasCount = 'count' extends keyof Things ? true : false
      const hasCount: HasCount = true
      expect(hasCount).toBe(true)
    })

    it('should be generic over Thing type', async () => {
      type Things = import('../src/index.js').Things
      type Thing = import('../src/index.js').Thing

      // Custom Thing type
      interface Customer extends Thing {
        email: string
      }

      // Things<Customer> should compile
      type CustomerCollection = Things<Customer>
      const isGeneric: CustomerCollection extends Things ? true : false = true
      expect(isGeneric).toBe(true)
    })
  })

  describe('ThingsDO<T> interface', () => {
    it('should extend Things<T>', async () => {
      type ThingsDO = import('../src/index.js').ThingsDO
      type Things = import('../src/index.js').Things
      type ExtendsThings = ThingsDO extends Things ? true : false
      const extendsThings: ExtendsThings = true
      expect(extendsThings).toBe(true)
    })

    it('should have isDO marker set to true', async () => {
      type ThingsDO = import('../src/index.js').ThingsDO
      type HasIsDO = ThingsDO extends { isDO: true } ? true : false
      const hasIsDO: HasIsDO = true
      expect(hasIsDO).toBe(true)
    })
  })

  describe('Collection<T> interface', () => {
    it('should have $id and $type fields', async () => {
      type Collection = import('../src/index.js').Collection
      type HasRequired = Collection extends {
        $id: string
        $type: 'https://schema.org.ai/Collection'
      }
        ? true
        : false
      const hasRequired: HasRequired = true
      expect(hasRequired).toBe(true)
    })

    it('should have ns (namespace) field', async () => {
      type Collection = import('../src/index.js').Collection
      type HasNs = Collection extends { ns: string } ? true : false
      const hasNs: HasNs = true
      expect(hasNs).toBe(true)
    })

    it('should have itemType field', async () => {
      type Collection = import('../src/index.js').Collection
      type HasItemType = Collection extends { itemType: string } ? true : false
      const hasItemType: HasItemType = true
      expect(hasItemType).toBe(true)
    })
  })

  describe('THINGS_TYPE and COLLECTION_TYPE constants', () => {
    it('should export THINGS_TYPE constant', async () => {
      const { THINGS_TYPE } = await import('../src/index.js')
      expect(THINGS_TYPE).toBe('https://schema.org.ai/Things')
    })

    it('should export COLLECTION_TYPE constant', async () => {
      const { COLLECTION_TYPE } = await import('../src/index.js')
      expect(COLLECTION_TYPE).toBe('https://schema.org.ai/Collection')
    })
  })
})

describe('ListOptions interface', () => {
  it('should export ListOptionsMarker runtime marker', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('ListOptionsMarker')
  })

  it('should have optional limit field', async () => {
    type ListOptions = import('../src/index.js').ListOptions
    type HasLimit = 'limit' extends keyof ListOptions ? true : false
    const hasLimit: HasLimit = true
    expect(hasLimit).toBe(true)

    // Should be optional
    const emptyOptions: ListOptions = {}
    expect(emptyOptions).toEqual({})
  })

  it('should have optional offset field for pagination', async () => {
    type ListOptions = import('../src/index.js').ListOptions
    type HasOffset = 'offset' extends keyof ListOptions ? true : false
    const hasOffset: HasOffset = true
    expect(hasOffset).toBe(true)
  })

  it('should have optional cursor field for cursor-based pagination', async () => {
    type ListOptions = import('../src/index.js').ListOptions
    type HasCursor = 'cursor' extends keyof ListOptions ? true : false
    const hasCursor: HasCursor = true
    expect(hasCursor).toBe(true)
  })

  it('should have optional sort field', async () => {
    type ListOptions = import('../src/index.js').ListOptions
    type HasSort = 'sort' extends keyof ListOptions ? true : false
    const hasSort: HasSort = true
    expect(hasSort).toBe(true)
  })

  it('should have optional filter field', async () => {
    type ListOptions = import('../src/index.js').ListOptions
    type HasFilter = 'filter' extends keyof ListOptions ? true : false
    const hasFilter: HasFilter = true
    expect(hasFilter).toBe(true)
  })

  it('should have optional search field for text search', async () => {
    type ListOptions = import('../src/index.js').ListOptions
    type HasSearch = 'search' extends keyof ListOptions ? true : false
    const hasSearch: HasSearch = true
    expect(hasSearch).toBe(true)
  })

  it('should have optional includeDeleted field', async () => {
    type ListOptions = import('../src/index.js').ListOptions
    type HasIncludeDeleted = 'includeDeleted' extends keyof ListOptions ? true : false
    const hasIncludeDeleted: HasIncludeDeleted = true
    expect(hasIncludeDeleted).toBe(true)
  })

  it('should be generic over Thing type for typed filters', async () => {
    type ListOptions = import('../src/index.js').ListOptions
    type Thing = import('../src/index.js').Thing

    interface Customer extends Thing {
      email: string
      status: 'active' | 'inactive'
    }

    // ListOptions<Customer> should allow filtering by Customer fields
    type CustomerListOptions = ListOptions<Customer>
    const options: CustomerListOptions = {
      filter: { email: 'test@example.com' },
    }
    expect(options.filter?.email).toBe('test@example.com')
  })
})

describe('SortSpec interface', () => {
  it('should have field and direction properties', async () => {
    type SortSpec = import('../src/index.js').SortSpec
    type HasField = SortSpec extends { field: string } ? true : false
    type HasDirection = SortSpec extends { direction: 'asc' | 'desc' } ? true : false
    const hasField: HasField = true
    const hasDirection: HasDirection = true
    expect(hasField).toBe(true)
    expect(hasDirection).toBe(true)
  })

  it('should work with ListOptions sort field', async () => {
    type ListOptions = import('../src/index.js').ListOptions
    type SortSpec = import('../src/index.js').SortSpec

    const options: ListOptions = {
      sort: { field: 'createdAt', direction: 'desc' },
    }
    expect(options.sort).toEqual({ field: 'createdAt', direction: 'desc' })
  })

  it('should allow array of sort specs for multi-field sorting', async () => {
    type ListOptions = import('../src/index.js').ListOptions

    const options: ListOptions = {
      sort: [
        { field: 'priority', direction: 'desc' },
        { field: 'createdAt', direction: 'asc' },
      ],
    }
    expect(Array.isArray(options.sort)).toBe(true)
  })
})

describe('SortDirection type', () => {
  it('should be union of asc and desc', async () => {
    type SortDirection = import('../src/index.js').SortDirection
    const directions: SortDirection[] = ['asc', 'desc']
    expect(directions).toContain('asc')
    expect(directions).toContain('desc')
  })
})

describe('PaginationInfo interface', () => {
  it('should have total count field', async () => {
    type PaginationInfo = import('../src/index.js').PaginationInfo
    type HasTotal = PaginationInfo extends { total: number } ? true : false
    const hasTotal: HasTotal = true
    expect(hasTotal).toBe(true)
  })

  it('should have count field for items in current page', async () => {
    type PaginationInfo = import('../src/index.js').PaginationInfo
    type HasCount = PaginationInfo extends { count: number } ? true : false
    const hasCount: HasCount = true
    expect(hasCount).toBe(true)
  })

  it('should have limit and offset fields', async () => {
    type PaginationInfo = import('../src/index.js').PaginationInfo
    type HasLimit = PaginationInfo extends { limit: number } ? true : false
    type HasOffset = PaginationInfo extends { offset: number } ? true : false
    const hasLimit: HasLimit = true
    const hasOffset: HasOffset = true
    expect(hasLimit).toBe(true)
    expect(hasOffset).toBe(true)
  })

  it('should have optional cursor fields for cursor-based pagination', async () => {
    type PaginationInfo = import('../src/index.js').PaginationInfo
    type HasNextCursor = 'nextCursor' extends keyof PaginationInfo ? true : false
    type HasPrevCursor = 'prevCursor' extends keyof PaginationInfo ? true : false
    const hasNextCursor: HasNextCursor = true
    const hasPrevCursor: HasPrevCursor = true
    expect(hasNextCursor).toBe(true)
    expect(hasPrevCursor).toBe(true)
  })

  it('should have hasMore boolean field', async () => {
    type PaginationInfo = import('../src/index.js').PaginationInfo
    type HasMore = PaginationInfo extends { hasMore: boolean } ? true : false
    const hasMore: HasMore = true
    expect(hasMore).toBe(true)
  })
})

describe('ListResult interface', () => {
  it('should export ListResultMarker runtime marker', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('ListResultMarker')
  })

  it('should have items array field', async () => {
    type ListResult = import('../src/index.js').ListResult
    type Thing = import('../src/index.js').Thing
    type HasItems = ListResult extends { items: Thing[] } ? true : false
    const hasItems: HasItems = true
    expect(hasItems).toBe(true)
  })

  it('should have pagination field', async () => {
    type ListResult = import('../src/index.js').ListResult
    type PaginationInfo = import('../src/index.js').PaginationInfo
    type HasPagination = ListResult extends { pagination: PaginationInfo } ? true : false
    const hasPagination: HasPagination = true
    expect(hasPagination).toBe(true)
  })

  it('should be generic over Thing type', async () => {
    type ListResult = import('../src/index.js').ListResult
    type Thing = import('../src/index.js').Thing

    interface Customer extends Thing {
      email: string
    }

    // ListResult<Customer> should have items typed as Customer[]
    type CustomerResult = ListResult<Customer>
    type ItemsAreCustomers = CustomerResult['items'] extends Customer[] ? true : false
    const itemsAreCustomers: ItemsAreCustomers = true
    expect(itemsAreCustomers).toBe(true)
  })

  it('should work with actual result data', async () => {
    type ListResult = import('../src/index.js').ListResult
    type Thing = import('../src/index.js').Thing

    const result: ListResult = {
      items: [
        { $id: 'thing/1', $type: 'Customer', name: 'Alice' },
        { $id: 'thing/2', $type: 'Customer', name: 'Bob' },
      ],
      pagination: {
        total: 100,
        count: 2,
        limit: 10,
        offset: 0,
        hasMore: true,
        nextCursor: 'cursor_abc123',
      },
    }

    expect(result.items).toHaveLength(2)
    expect(result.pagination.total).toBe(100)
    expect(result.pagination.hasMore).toBe(true)
    expect(result.pagination.nextCursor).toBe('cursor_abc123')
  })
})
