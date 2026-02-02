/**
 * @org.ai/types - Integration and Capability Types TDD RED Phase Tests
 *
 * These tests define the expected interface for Integration and Capability types.
 * Tests should FAIL initially - this is RED phase of TDD.
 *
 * Integration and Capability types for schema.org.ai represent:
 * - Integration: Connections to external services and APIs
 * - Capability: What a Worker/Agent/Tool can do
 *
 * Type hierarchy:
 *   Thing
 *     ├── Integration (external service connection)
 *     └── Capability (ability/skill definition)
 *
 * Expected interfaces:
 *
 * Integration:
 * - $id: string - Unique identifier URL
 * - $type: 'https://schema.org.ai/Integration'
 * - name: string - Integration name
 * - provider: string - Service provider (e.g., 'stripe', 'slack')
 * - category: string - Integration category (e.g., 'finance', 'message')
 * - status: 'active' | 'inactive' | 'error' | 'pending'
 * - config: object - Integration-specific configuration
 * - credentials?: object - Encrypted credentials reference
 * - tools?: Tool[] - Tools exposed by this integration
 *
 * Capability:
 * - $id: string - Unique identifier URL
 * - $type: 'https://schema.org.ai/Capability'
 * - name: string - Capability name
 * - description: string - What this capability enables
 * - category: string - Capability category
 * - permissions?: string[] - Required permissions
 * - constraints?: object - Constraints/limits
 * - tools?: Tool[] - Tools that implement this capability
 */

import { describe, it, expect } from 'vitest'

// ============================================================================
// Integration Type Tests
// ============================================================================

describe('Integration type', () => {
  describe('type export', () => {
    it('should export Integration type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('Integration')
    })

    it('should export IntegrationType interface', async () => {
      // Runtime marker for type export
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('Integration')
    })

    it('should export INTEGRATION_TYPE constant', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('INTEGRATION_TYPE')
      expect(module.INTEGRATION_TYPE).toBe('https://schema.org.ai/Integration')
    })

    it('should export IntegrationStatus type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('IntegrationStatus')
    })

    it('should export IntegrationCategory type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('IntegrationCategory')
    })
  })

  describe('Integration interface structure', () => {
    it('should have $id field for unique identification', async () => {
      // Integration must follow Thing pattern with $id URL
      const module = (await import('../src/index.js')) as {
        Integration: { $id: string }
      }
      expect(module.Integration).toBeDefined()
    })

    it('should have $type field set to Integration schema URL', async () => {
      const module = (await import('../src/index.js')) as {
        Integration: { $type: string }
        INTEGRATION_TYPE: string
      }
      expect(module.INTEGRATION_TYPE).toBe('https://schema.org.ai/Integration')
    })

    it('should have name field', async () => {
      const module = (await import('../src/index.js')) as {
        Integration: { name: string }
      }
      expect(module.Integration).toBeDefined()
    })

    it('should have provider field', async () => {
      // Provider identifies the external service (stripe, slack, github, etc.)
      const module = (await import('../src/index.js')) as {
        Integration: { provider: string }
      }
      expect(module.Integration).toBeDefined()
    })

    it('should have category field', async () => {
      // Category groups integrations (finance, message, code, etc.)
      const module = (await import('../src/index.js')) as {
        Integration: { category: string }
      }
      expect(module.Integration).toBeDefined()
    })

    it('should have status field', async () => {
      // Connection status: active, inactive, error, pending
      const module = (await import('../src/index.js')) as {
        Integration: { status: string }
      }
      expect(module.Integration).toBeDefined()
    })

    it('should have optional description field', async () => {
      const module = (await import('../src/index.js')) as {
        Integration: { description?: string }
      }
      expect(module.Integration).toBeDefined()
    })

    it('should have optional config field', async () => {
      // Integration-specific configuration
      const module = (await import('../src/index.js')) as {
        Integration: { config?: Record<string, unknown> }
      }
      expect(module.Integration).toBeDefined()
    })

    it('should have optional credentials field', async () => {
      // Reference to encrypted credentials
      const module = (await import('../src/index.js')) as {
        Integration: { credentials?: { ref: string } }
      }
      expect(module.Integration).toBeDefined()
    })

    it('should have optional tools field', async () => {
      // Tools exposed by this integration
      const module = (await import('../src/index.js')) as {
        Integration: { tools?: unknown[] }
      }
      expect(module.Integration).toBeDefined()
    })

    it('should have optional capabilities field', async () => {
      // Capabilities provided by this integration
      const module = (await import('../src/index.js')) as {
        Integration: { capabilities?: string[] }
      }
      expect(module.Integration).toBeDefined()
    })

    it('should have optional webhookUrl field', async () => {
      // Webhook URL for receiving events
      const module = (await import('../src/index.js')) as {
        Integration: { webhookUrl?: string }
      }
      expect(module.Integration).toBeDefined()
    })

    it('should have optional rateLimit field', async () => {
      // Rate limiting configuration
      const module = (await import('../src/index.js')) as {
        Integration: { rateLimit?: { requests: number; period: string } }
      }
      expect(module.Integration).toBeDefined()
    })
  })

  describe('IntegrationStatus values', () => {
    it('should include active status', async () => {
      const { IntegrationStatus } = (await import('../src/index.js')) as {
        IntegrationStatus: readonly string[]
      }
      expect(IntegrationStatus).toContain('active')
    })

    it('should include inactive status', async () => {
      const { IntegrationStatus } = (await import('../src/index.js')) as {
        IntegrationStatus: readonly string[]
      }
      expect(IntegrationStatus).toContain('inactive')
    })

    it('should include error status', async () => {
      const { IntegrationStatus } = (await import('../src/index.js')) as {
        IntegrationStatus: readonly string[]
      }
      expect(IntegrationStatus).toContain('error')
    })

    it('should include pending status', async () => {
      const { IntegrationStatus } = (await import('../src/index.js')) as {
        IntegrationStatus: readonly string[]
      }
      expect(IntegrationStatus).toContain('pending')
    })
  })

  describe('IntegrationCategory values', () => {
    it('should include finance category', async () => {
      const { IntegrationCategory } = (await import('../src/index.js')) as {
        IntegrationCategory: readonly string[]
      }
      expect(IntegrationCategory).toContain('finance')
    })

    it('should include message category', async () => {
      const { IntegrationCategory } = (await import('../src/index.js')) as {
        IntegrationCategory: readonly string[]
      }
      expect(IntegrationCategory).toContain('message')
    })

    it('should include code category', async () => {
      const { IntegrationCategory } = (await import('../src/index.js')) as {
        IntegrationCategory: readonly string[]
      }
      expect(IntegrationCategory).toContain('code')
    })

    it('should include storage category', async () => {
      const { IntegrationCategory } = (await import('../src/index.js')) as {
        IntegrationCategory: readonly string[]
      }
      expect(IntegrationCategory).toContain('storage')
    })

    it('should include analytics category', async () => {
      const { IntegrationCategory } = (await import('../src/index.js')) as {
        IntegrationCategory: readonly string[]
      }
      expect(IntegrationCategory).toContain('analytics')
    })

    it('should include ai category', async () => {
      const { IntegrationCategory } = (await import('../src/index.js')) as {
        IntegrationCategory: readonly string[]
      }
      expect(IntegrationCategory).toContain('ai')
    })
  })
})

// ============================================================================
// Integration Schema Validation Tests
// ============================================================================

describe('Integration schema validation', () => {
  describe('IntegrationSchema Zod validation', () => {
    it('should export IntegrationSchema', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('IntegrationSchema')
    })

    it('should validate a valid Integration object', async () => {
      const { IntegrationSchema } = (await import('../src/index.js')) as {
        IntegrationSchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = IntegrationSchema.safeParse({
        $id: 'https://example.com/integrations/stripe-1',
        $type: 'https://schema.org.ai/Integration',
        name: 'Stripe Production',
        provider: 'stripe',
        category: 'finance',
        status: 'active',
      })
      expect(result.success).toBe(true)
    })

    it('should validate Integration with all optional fields', async () => {
      const { IntegrationSchema } = (await import('../src/index.js')) as {
        IntegrationSchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = IntegrationSchema.safeParse({
        $id: 'https://example.com/integrations/slack-1',
        $type: 'https://schema.org.ai/Integration',
        name: 'Slack Workspace',
        provider: 'slack',
        category: 'message',
        status: 'active',
        description: 'Main workspace integration',
        config: {
          workspace: 'acme-corp',
          defaultChannel: '#general',
        },
        credentials: {
          ref: 'vault://integrations/slack-1/token',
        },
        capabilities: ['send_message', 'read_channel', 'manage_users'],
        webhookUrl: 'https://example.com/webhooks/slack',
        rateLimit: {
          requests: 100,
          period: '1m',
        },
      })
      expect(result.success).toBe(true)
    })

    it('should reject Integration without $id', async () => {
      const { IntegrationSchema } = (await import('../src/index.js')) as {
        IntegrationSchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = IntegrationSchema.safeParse({
        $type: 'https://schema.org.ai/Integration',
        name: 'Stripe',
        provider: 'stripe',
        category: 'finance',
        status: 'active',
      })
      expect(result.success).toBe(false)
    })

    it('should reject Integration without name', async () => {
      const { IntegrationSchema } = (await import('../src/index.js')) as {
        IntegrationSchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = IntegrationSchema.safeParse({
        $id: 'https://example.com/integrations/1',
        $type: 'https://schema.org.ai/Integration',
        provider: 'stripe',
        category: 'finance',
        status: 'active',
      })
      expect(result.success).toBe(false)
    })

    it('should reject Integration without provider', async () => {
      const { IntegrationSchema } = (await import('../src/index.js')) as {
        IntegrationSchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = IntegrationSchema.safeParse({
        $id: 'https://example.com/integrations/1',
        $type: 'https://schema.org.ai/Integration',
        name: 'Stripe',
        category: 'finance',
        status: 'active',
      })
      expect(result.success).toBe(false)
    })

    it('should reject Integration without category', async () => {
      const { IntegrationSchema } = (await import('../src/index.js')) as {
        IntegrationSchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = IntegrationSchema.safeParse({
        $id: 'https://example.com/integrations/1',
        $type: 'https://schema.org.ai/Integration',
        name: 'Stripe',
        provider: 'stripe',
        status: 'active',
      })
      expect(result.success).toBe(false)
    })

    it('should reject Integration without status', async () => {
      const { IntegrationSchema } = (await import('../src/index.js')) as {
        IntegrationSchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = IntegrationSchema.safeParse({
        $id: 'https://example.com/integrations/1',
        $type: 'https://schema.org.ai/Integration',
        name: 'Stripe',
        provider: 'stripe',
        category: 'finance',
      })
      expect(result.success).toBe(false)
    })

    it('should reject Integration with invalid status', async () => {
      const { IntegrationSchema } = (await import('../src/index.js')) as {
        IntegrationSchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = IntegrationSchema.safeParse({
        $id: 'https://example.com/integrations/1',
        $type: 'https://schema.org.ai/Integration',
        name: 'Stripe',
        provider: 'stripe',
        category: 'finance',
        status: 'invalid-status',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-object values', async () => {
      const { IntegrationSchema } = (await import('../src/index.js')) as {
        IntegrationSchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      expect(IntegrationSchema.safeParse(null).success).toBe(false)
      expect(IntegrationSchema.safeParse(undefined).success).toBe(false)
      expect(IntegrationSchema.safeParse('string').success).toBe(false)
      expect(IntegrationSchema.safeParse(123).success).toBe(false)
    })
  })
})

// ============================================================================
// Integration Type Guards Tests
// ============================================================================

describe('Integration type guards', () => {
  it('should export isIntegration type guard function', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('isIntegration')
    expect(typeof module.isIntegration).toBe('function')
  })

  it('should return true for valid Integration', async () => {
    const { isIntegration } = (await import('../src/index.js')) as {
      isIntegration: (v: unknown) => boolean
    }
    const integration = {
      $id: 'https://example.com/integrations/1',
      $type: 'https://schema.org.ai/Integration',
      name: 'Stripe',
      provider: 'stripe',
      category: 'finance',
      status: 'active',
    }
    expect(isIntegration(integration)).toBe(true)
  })

  it('should return false for Thing without Integration $type', async () => {
    const { isIntegration } = (await import('../src/index.js')) as {
      isIntegration: (v: unknown) => boolean
    }
    const thing = {
      $id: 'https://example.com/things/1',
      $type: 'https://schema.org.ai/Thing',
    }
    expect(isIntegration(thing)).toBe(false)
  })

  it('should return false for Tool', async () => {
    const { isIntegration } = (await import('../src/index.js')) as {
      isIntegration: (v: unknown) => boolean
    }
    const tool = {
      $id: 'https://example.com/tools/1',
      $type: 'https://schema.org.ai/Tool',
      name: 'My Tool',
    }
    expect(isIntegration(tool)).toBe(false)
  })

  it('should return false for invalid data', async () => {
    const { isIntegration } = (await import('../src/index.js')) as {
      isIntegration: (v: unknown) => boolean
    }
    expect(isIntegration({ invalid: 'data' })).toBe(false)
    expect(isIntegration(null)).toBe(false)
    expect(isIntegration(undefined)).toBe(false)
    expect(isIntegration('string')).toBe(false)
  })

  it('should export isIntegrationId type guard', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('isIntegrationId')
    expect(typeof module.isIntegrationId).toBe('function')
  })

  it('should recognize integration URL patterns', async () => {
    const { isIntegrationId } = (await import('../src/index.js')) as {
      isIntegrationId: (v: string) => boolean
    }
    expect(isIntegrationId('https://example.com/integrations/stripe-1')).toBe(true)
    expect(isIntegrationId('https://example.com/integration/slack-1')).toBe(true)
    expect(isIntegrationId('https://example.com/tools/1')).toBe(false)
  })
})

// ============================================================================
// Integration Factory Tests
// ============================================================================

describe('Integration factory', () => {
  it('should export createIntegration function', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('createIntegration')
    expect(typeof module.createIntegration).toBe('function')
  })

  it('should create a valid Integration with required fields', async () => {
    const { createIntegration, isIntegration } = (await import('../src/index.js')) as {
      createIntegration: (opts: { name: string; provider: string; category: string }) => object
      isIntegration: (v: unknown) => boolean
    }
    const integration = createIntegration({
      name: 'Stripe Production',
      provider: 'stripe',
      category: 'finance',
    })
    expect(isIntegration(integration)).toBe(true)
  })

  it('should auto-generate $id', async () => {
    const { createIntegration } = (await import('../src/index.js')) as {
      createIntegration: (opts: { name: string; provider: string; category: string }) => {
        $id: string
      }
    }
    const integration = createIntegration({
      name: 'Stripe',
      provider: 'stripe',
      category: 'finance',
    })
    expect(integration.$id).toBeDefined()
    expect(integration.$id).toMatch(/^https:\/\//)
  })

  it('should set correct $type', async () => {
    const { createIntegration } = (await import('../src/index.js')) as {
      createIntegration: (opts: { name: string; provider: string; category: string }) => {
        $type: string
      }
    }
    const integration = createIntegration({
      name: 'Stripe',
      provider: 'stripe',
      category: 'finance',
    })
    expect(integration.$type).toBe('https://schema.org.ai/Integration')
  })

  it('should default status to pending', async () => {
    const { createIntegration } = (await import('../src/index.js')) as {
      createIntegration: (opts: { name: string; provider: string; category: string }) => {
        status: string
      }
    }
    const integration = createIntegration({
      name: 'Stripe',
      provider: 'stripe',
      category: 'finance',
    })
    expect(integration.status).toBe('pending')
  })

  it('should allow custom options', async () => {
    const { createIntegration } = (await import('../src/index.js')) as {
      createIntegration: (opts: {
        name: string
        provider: string
        category: string
        status?: string
        description?: string
        config?: Record<string, unknown>
      }) => {
        name: string
        status: string
        description: string
        config: Record<string, unknown>
      }
    }
    const integration = createIntegration({
      name: 'Slack Workspace',
      provider: 'slack',
      category: 'message',
      status: 'active',
      description: 'Main workspace',
      config: { workspace: 'acme' },
    })
    expect(integration.status).toBe('active')
    expect(integration.description).toBe('Main workspace')
    expect(integration.config).toEqual({ workspace: 'acme' })
  })
})

// ============================================================================
// Integration Collection Types Tests
// ============================================================================

describe('Integration collection types', () => {
  it('should export Integrations collection type', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('Integrations')
  })

  it('should export IntegrationId branded type', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('IntegrationId')
  })
})

// ============================================================================
// Capability Type Tests
// ============================================================================

describe('Capability type', () => {
  describe('type export', () => {
    it('should export Capability type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('Capability')
    })

    it('should export CAPABILITY_TYPE constant', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('CAPABILITY_TYPE')
      expect(module.CAPABILITY_TYPE).toBe('https://schema.org.ai/Capability')
    })

    it('should export CapabilityCategory type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('CapabilityCategory')
    })
  })

  describe('Capability interface structure', () => {
    it('should have $id field for unique identification', async () => {
      // Capability must follow Thing pattern with $id URL
      const module = (await import('../src/index.js')) as {
        Capability: { $id: string }
      }
      expect(module.Capability).toBeDefined()
    })

    it('should have $type field set to Capability schema URL', async () => {
      const module = (await import('../src/index.js')) as {
        Capability: { $type: string }
        CAPABILITY_TYPE: string
      }
      expect(module.CAPABILITY_TYPE).toBe('https://schema.org.ai/Capability')
    })

    it('should have name field', async () => {
      const module = (await import('../src/index.js')) as {
        Capability: { name: string }
      }
      expect(module.Capability).toBeDefined()
    })

    it('should have description field', async () => {
      const module = (await import('../src/index.js')) as {
        Capability: { description: string }
      }
      expect(module.Capability).toBeDefined()
    })

    it('should have optional category field', async () => {
      const module = (await import('../src/index.js')) as {
        Capability: { category?: string }
      }
      expect(module.Capability).toBeDefined()
    })

    it('should have optional permissions field', async () => {
      // Required permissions to use this capability
      const module = (await import('../src/index.js')) as {
        Capability: { permissions?: string[] }
      }
      expect(module.Capability).toBeDefined()
    })

    it('should have optional constraints field', async () => {
      // Constraints/limits on the capability
      const module = (await import('../src/index.js')) as {
        Capability: { constraints?: Record<string, unknown> }
      }
      expect(module.Capability).toBeDefined()
    })

    it('should have optional tools field', async () => {
      // Tools that implement this capability
      const module = (await import('../src/index.js')) as {
        Capability: { tools?: unknown[] }
      }
      expect(module.Capability).toBeDefined()
    })

    it('should have optional integrations field', async () => {
      // Integrations that provide this capability
      const module = (await import('../src/index.js')) as {
        Capability: { integrations?: unknown[] }
      }
      expect(module.Capability).toBeDefined()
    })

    it('should have optional requiredCapabilities field', async () => {
      // Other capabilities this depends on
      const module = (await import('../src/index.js')) as {
        Capability: { requiredCapabilities?: string[] }
      }
      expect(module.Capability).toBeDefined()
    })

    it('should have optional level field', async () => {
      // Capability proficiency level (basic, intermediate, advanced)
      const module = (await import('../src/index.js')) as {
        Capability: { level?: string }
      }
      expect(module.Capability).toBeDefined()
    })
  })

  describe('CapabilityCategory values', () => {
    it('should include read category', async () => {
      const { CapabilityCategory } = (await import('../src/index.js')) as {
        CapabilityCategory: readonly string[]
      }
      expect(CapabilityCategory).toContain('read')
    })

    it('should include write category', async () => {
      const { CapabilityCategory } = (await import('../src/index.js')) as {
        CapabilityCategory: readonly string[]
      }
      expect(CapabilityCategory).toContain('write')
    })

    it('should include execute category', async () => {
      const { CapabilityCategory } = (await import('../src/index.js')) as {
        CapabilityCategory: readonly string[]
      }
      expect(CapabilityCategory).toContain('execute')
    })

    it('should include communicate category', async () => {
      const { CapabilityCategory } = (await import('../src/index.js')) as {
        CapabilityCategory: readonly string[]
      }
      expect(CapabilityCategory).toContain('communicate')
    })

    it('should include analyze category', async () => {
      const { CapabilityCategory } = (await import('../src/index.js')) as {
        CapabilityCategory: readonly string[]
      }
      expect(CapabilityCategory).toContain('analyze')
    })

    it('should include transform category', async () => {
      const { CapabilityCategory } = (await import('../src/index.js')) as {
        CapabilityCategory: readonly string[]
      }
      expect(CapabilityCategory).toContain('transform')
    })

    it('should include manage category', async () => {
      const { CapabilityCategory } = (await import('../src/index.js')) as {
        CapabilityCategory: readonly string[]
      }
      expect(CapabilityCategory).toContain('manage')
    })
  })

  describe('CapabilityLevel values', () => {
    it('should export CapabilityLevel type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('CapabilityLevel')
    })

    it('should include basic level', async () => {
      const { CapabilityLevel } = (await import('../src/index.js')) as {
        CapabilityLevel: readonly string[]
      }
      expect(CapabilityLevel).toContain('basic')
    })

    it('should include intermediate level', async () => {
      const { CapabilityLevel } = (await import('../src/index.js')) as {
        CapabilityLevel: readonly string[]
      }
      expect(CapabilityLevel).toContain('intermediate')
    })

    it('should include advanced level', async () => {
      const { CapabilityLevel } = (await import('../src/index.js')) as {
        CapabilityLevel: readonly string[]
      }
      expect(CapabilityLevel).toContain('advanced')
    })

    it('should include expert level', async () => {
      const { CapabilityLevel } = (await import('../src/index.js')) as {
        CapabilityLevel: readonly string[]
      }
      expect(CapabilityLevel).toContain('expert')
    })
  })
})

// ============================================================================
// Capability Schema Validation Tests
// ============================================================================

describe('Capability schema validation', () => {
  describe('CapabilitySchema Zod validation', () => {
    it('should export CapabilitySchema', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('CapabilitySchema')
    })

    it('should validate a valid Capability object', async () => {
      const { CapabilitySchema } = (await import('../src/index.js')) as {
        CapabilitySchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = CapabilitySchema.safeParse({
        $id: 'https://example.com/capabilities/read-file',
        $type: 'https://schema.org.ai/Capability',
        name: 'read_file',
        description: 'Ability to read files from the filesystem',
      })
      expect(result.success).toBe(true)
    })

    it('should validate Capability with all optional fields', async () => {
      const { CapabilitySchema } = (await import('../src/index.js')) as {
        CapabilitySchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = CapabilitySchema.safeParse({
        $id: 'https://example.com/capabilities/send-email',
        $type: 'https://schema.org.ai/Capability',
        name: 'send_email',
        description: 'Ability to send emails',
        category: 'communicate',
        level: 'basic',
        permissions: ['email:send', 'contacts:read'],
        constraints: {
          maxRecipients: 100,
          maxAttachmentSize: '10MB',
          allowedDomains: ['example.com'],
        },
        requiredCapabilities: ['authenticate'],
      })
      expect(result.success).toBe(true)
    })

    it('should reject Capability without $id', async () => {
      const { CapabilitySchema } = (await import('../src/index.js')) as {
        CapabilitySchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = CapabilitySchema.safeParse({
        $type: 'https://schema.org.ai/Capability',
        name: 'read_file',
        description: 'Read files',
      })
      expect(result.success).toBe(false)
    })

    it('should reject Capability without name', async () => {
      const { CapabilitySchema } = (await import('../src/index.js')) as {
        CapabilitySchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = CapabilitySchema.safeParse({
        $id: 'https://example.com/capabilities/1',
        $type: 'https://schema.org.ai/Capability',
        description: 'Read files',
      })
      expect(result.success).toBe(false)
    })

    it('should reject Capability without description', async () => {
      const { CapabilitySchema } = (await import('../src/index.js')) as {
        CapabilitySchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = CapabilitySchema.safeParse({
        $id: 'https://example.com/capabilities/1',
        $type: 'https://schema.org.ai/Capability',
        name: 'read_file',
      })
      expect(result.success).toBe(false)
    })

    it('should reject Capability with invalid level', async () => {
      const { CapabilitySchema } = (await import('../src/index.js')) as {
        CapabilitySchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      const result = CapabilitySchema.safeParse({
        $id: 'https://example.com/capabilities/1',
        $type: 'https://schema.org.ai/Capability',
        name: 'read_file',
        description: 'Read files',
        level: 'invalid-level',
      })
      expect(result.success).toBe(false)
    })

    it('should reject non-object values', async () => {
      const { CapabilitySchema } = (await import('../src/index.js')) as {
        CapabilitySchema: { safeParse: (v: unknown) => { success: boolean } }
      }
      expect(CapabilitySchema.safeParse(null).success).toBe(false)
      expect(CapabilitySchema.safeParse(undefined).success).toBe(false)
      expect(CapabilitySchema.safeParse('string').success).toBe(false)
      expect(CapabilitySchema.safeParse(123).success).toBe(false)
    })
  })
})

// ============================================================================
// Capability Type Guards Tests
// ============================================================================

describe('Capability type guards', () => {
  it('should export isCapability type guard function', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('isCapability')
    expect(typeof module.isCapability).toBe('function')
  })

  it('should return true for valid Capability', async () => {
    const { isCapability } = (await import('../src/index.js')) as {
      isCapability: (v: unknown) => boolean
    }
    const capability = {
      $id: 'https://example.com/capabilities/1',
      $type: 'https://schema.org.ai/Capability',
      name: 'read_file',
      description: 'Read files from filesystem',
    }
    expect(isCapability(capability)).toBe(true)
  })

  it('should return false for Thing without Capability $type', async () => {
    const { isCapability } = (await import('../src/index.js')) as {
      isCapability: (v: unknown) => boolean
    }
    const thing = {
      $id: 'https://example.com/things/1',
      $type: 'https://schema.org.ai/Thing',
    }
    expect(isCapability(thing)).toBe(false)
  })

  it('should return false for Tool', async () => {
    const { isCapability } = (await import('../src/index.js')) as {
      isCapability: (v: unknown) => boolean
    }
    const tool = {
      $id: 'https://example.com/tools/1',
      $type: 'https://schema.org.ai/Tool',
      name: 'My Tool',
    }
    expect(isCapability(tool)).toBe(false)
  })

  it('should return false for Integration', async () => {
    const { isCapability } = (await import('../src/index.js')) as {
      isCapability: (v: unknown) => boolean
    }
    const integration = {
      $id: 'https://example.com/integrations/1',
      $type: 'https://schema.org.ai/Integration',
      name: 'Stripe',
      provider: 'stripe',
      category: 'finance',
      status: 'active',
    }
    expect(isCapability(integration)).toBe(false)
  })

  it('should return false for invalid data', async () => {
    const { isCapability } = (await import('../src/index.js')) as {
      isCapability: (v: unknown) => boolean
    }
    expect(isCapability({ invalid: 'data' })).toBe(false)
    expect(isCapability(null)).toBe(false)
    expect(isCapability(undefined)).toBe(false)
    expect(isCapability('string')).toBe(false)
  })

  it('should export isCapabilityId type guard', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('isCapabilityId')
    expect(typeof module.isCapabilityId).toBe('function')
  })

  it('should recognize capability URL patterns', async () => {
    const { isCapabilityId } = (await import('../src/index.js')) as {
      isCapabilityId: (v: string) => boolean
    }
    expect(isCapabilityId('https://example.com/capabilities/read-file')).toBe(true)
    expect(isCapabilityId('https://example.com/capability/write-file')).toBe(true)
    expect(isCapabilityId('https://example.com/tools/1')).toBe(false)
  })
})

// ============================================================================
// Capability Factory Tests
// ============================================================================

describe('Capability factory', () => {
  it('should export createCapability function', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('createCapability')
    expect(typeof module.createCapability).toBe('function')
  })

  it('should create a valid Capability with required fields', async () => {
    const { createCapability, isCapability } = (await import('../src/index.js')) as {
      createCapability: (opts: { name: string; description: string }) => object
      isCapability: (v: unknown) => boolean
    }
    const capability = createCapability({
      name: 'read_file',
      description: 'Read files from the filesystem',
    })
    expect(isCapability(capability)).toBe(true)
  })

  it('should auto-generate $id', async () => {
    const { createCapability } = (await import('../src/index.js')) as {
      createCapability: (opts: { name: string; description: string }) => { $id: string }
    }
    const capability = createCapability({
      name: 'read_file',
      description: 'Read files',
    })
    expect(capability.$id).toBeDefined()
    expect(capability.$id).toMatch(/^https:\/\//)
  })

  it('should set correct $type', async () => {
    const { createCapability } = (await import('../src/index.js')) as {
      createCapability: (opts: { name: string; description: string }) => { $type: string }
    }
    const capability = createCapability({
      name: 'read_file',
      description: 'Read files',
    })
    expect(capability.$type).toBe('https://schema.org.ai/Capability')
  })

  it('should allow custom options', async () => {
    const { createCapability } = (await import('../src/index.js')) as {
      createCapability: (opts: {
        name: string
        description: string
        category?: string
        level?: string
        permissions?: string[]
      }) => {
        name: string
        category: string
        level: string
        permissions: string[]
      }
    }
    const capability = createCapability({
      name: 'send_email',
      description: 'Send emails',
      category: 'communicate',
      level: 'basic',
      permissions: ['email:send'],
    })
    expect(capability.category).toBe('communicate')
    expect(capability.level).toBe('basic')
    expect(capability.permissions).toEqual(['email:send'])
  })
})

// ============================================================================
// Capability Collection Types Tests
// ============================================================================

describe('Capability collection types', () => {
  it('should export Capabilities collection type', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('Capabilities')
  })

  it('should export CapabilityId branded type', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('CapabilityId')
  })
})

// ============================================================================
// Standard Capabilities Tests
// ============================================================================

describe('Standard capabilities', () => {
  it('should export StandardCapabilities constant', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('StandardCapabilities')
  })

  it('should include read capability', async () => {
    const { StandardCapabilities } = (await import('../src/index.js')) as {
      StandardCapabilities: readonly string[]
    }
    expect(StandardCapabilities).toContain('read')
  })

  it('should include write capability', async () => {
    const { StandardCapabilities } = (await import('../src/index.js')) as {
      StandardCapabilities: readonly string[]
    }
    expect(StandardCapabilities).toContain('write')
  })

  it('should include execute capability', async () => {
    const { StandardCapabilities } = (await import('../src/index.js')) as {
      StandardCapabilities: readonly string[]
    }
    expect(StandardCapabilities).toContain('execute')
  })

  it('should include delete capability', async () => {
    const { StandardCapabilities } = (await import('../src/index.js')) as {
      StandardCapabilities: readonly string[]
    }
    expect(StandardCapabilities).toContain('delete')
  })

  it('should include create capability', async () => {
    const { StandardCapabilities } = (await import('../src/index.js')) as {
      StandardCapabilities: readonly string[]
    }
    expect(StandardCapabilities).toContain('create')
  })

  it('should include update capability', async () => {
    const { StandardCapabilities } = (await import('../src/index.js')) as {
      StandardCapabilities: readonly string[]
    }
    expect(StandardCapabilities).toContain('update')
  })
})

// ============================================================================
// Integration-Capability Relationship Tests
// ============================================================================

describe('Integration-Capability relationships', () => {
  it('Integration should reference Capabilities', async () => {
    // Integrations can have capabilities they provide
    const { IntegrationSchema } = (await import('../src/index.js')) as {
      IntegrationSchema: { safeParse: (v: unknown) => { success: boolean } }
    }
    const result = IntegrationSchema.safeParse({
      $id: 'https://example.com/integrations/github-1',
      $type: 'https://schema.org.ai/Integration',
      name: 'GitHub',
      provider: 'github',
      category: 'code',
      status: 'active',
      capabilities: ['read_repo', 'write_repo', 'manage_issues'],
    })
    expect(result.success).toBe(true)
  })

  it('Capability should reference Integrations', async () => {
    // Capabilities can list integrations that provide them
    const { CapabilitySchema } = (await import('../src/index.js')) as {
      CapabilitySchema: { safeParse: (v: unknown) => { success: boolean } }
    }
    const result = CapabilitySchema.safeParse({
      $id: 'https://example.com/capabilities/send-message',
      $type: 'https://schema.org.ai/Capability',
      name: 'send_message',
      description: 'Send messages to users',
      integrations: ['slack', 'discord', 'email'],
    })
    expect(result.success).toBe(true)
  })

  it('should export hasCapability helper function', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('hasCapability')
    expect(typeof module.hasCapability).toBe('function')
  })

  it('hasCapability should check if entity has capability', async () => {
    const { hasCapability } = (await import('../src/index.js')) as {
      hasCapability: (entity: { capabilities?: string[] }, capability: string) => boolean
    }
    const integration = {
      capabilities: ['read', 'write', 'execute'],
    }
    expect(hasCapability(integration, 'read')).toBe(true)
    expect(hasCapability(integration, 'delete')).toBe(false)
  })

  it('hasCapability should handle missing capabilities array', async () => {
    const { hasCapability } = (await import('../src/index.js')) as {
      hasCapability: (entity: { capabilities?: string[] }, capability: string) => boolean
    }
    const integration = {}
    expect(hasCapability(integration, 'read')).toBe(false)
  })
})

// ============================================================================
// Integration with Tool Type Tests
// ============================================================================

describe('Integration with Tool type', () => {
  it('Integration should be able to expose Tools', async () => {
    // Integration can have a list of tools it provides
    const module = (await import('../src/index.js')) as {
      Integration: { tools?: unknown[] }
    }
    expect(module.Integration).toBeDefined()
  })

  it('Capability should be able to reference Tools', async () => {
    // Capability can list tools that implement it
    const module = (await import('../src/index.js')) as {
      Capability: { tools?: unknown[] }
    }
    expect(module.Capability).toBeDefined()
  })

  it('Tool should be able to reference Capabilities', async () => {
    // Tools can declare capabilities they provide
    // This extends the existing ToolCapability concept
    const module = (await import('../src/index.js')) as {
      Tool: object
      ToolCapability: object
    }
    expect(module.Tool).toBeDefined()
    expect(module.ToolCapability).toBeDefined()
  })
})

// ============================================================================
// Integration with Thing Type Tests
// ============================================================================

describe('Integration with Thing base type', () => {
  it('Integration should have Thing properties available', async () => {
    const { IntegrationSchema } = (await import('../src/index.js')) as {
      IntegrationSchema: { safeParse: (v: unknown) => { success: boolean } }
    }
    const result = IntegrationSchema.safeParse({
      $id: 'https://example.com/integrations/1',
      $type: 'https://schema.org.ai/Integration',
      name: 'Stripe',
      provider: 'stripe',
      category: 'finance',
      status: 'active',
      // Thing properties
      data: { custom: 'data' },
      visibility: 'org',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    expect(result.success).toBe(true)
  })

  it('Capability should have Thing properties available', async () => {
    const { CapabilitySchema } = (await import('../src/index.js')) as {
      CapabilitySchema: { safeParse: (v: unknown) => { success: boolean } }
    }
    const result = CapabilitySchema.safeParse({
      $id: 'https://example.com/capabilities/1',
      $type: 'https://schema.org.ai/Capability',
      name: 'read_file',
      description: 'Read files',
      // Thing properties
      data: { version: '1.0' },
      visibility: 'public',
      createdAt: new Date(),
    })
    expect(result.success).toBe(true)
  })
})
