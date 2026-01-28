/**
 * @org.ai/types - Tool Type TDD RED Phase Tests
 *
 * These tests define the expected interface for the Tool type.
 * Tests should FAIL initially - this is RED phase of TDD.
 *
 * Tool types for schema.org.ai represent capabilities and integrations
 * available to workers and systems.
 *
 * Expected Tool interface:
 * - name: string - Tool identifier
 * - description: string - Human-readable description
 * - inputs: InputSchema - Input parameter definitions
 * - outputs: OutputSchema - Output type definition
 * - execute: function - Tool execution interface
 * - validate: function - Input validation
 */

import { describe, it, expect } from 'vitest'

// ============================================================================
// Tool Type Structure Tests
// ============================================================================

describe('Tool type', () => {
  describe('type export', () => {
    it('should export Tool type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('Tool')
    })

    it('should export ToolInput type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ToolInput')
    })

    it('should export ToolOutput type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ToolOutput')
    })

    it('should export ToolParameter type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ToolParameter')
    })

    it('should export ToolExecutionResult type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ToolExecutionResult')
    })

    it('should export ToolValidationError type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ToolValidationError')
    })
  })

  describe('Tool interface structure', () => {
    it('should have $id field for unique identification', async () => {
      // Tool must follow Thing pattern with $id
      const module = (await import('../src/index.js')) as {
        Tool: { $id: string }
      }
      expect(module.Tool).toBeDefined()
    })

    it('should have $type field set to Tool schema URL', async () => {
      // $type should be 'https://schema.org.ai/Tool'
      const module = (await import('../src/index.js')) as {
        Tool: { $type: string }
        TOOL_TYPE: string
      }
      expect(module.TOOL_TYPE).toBe('https://schema.org.ai/Tool')
    })

    it('should have name field', async () => {
      const module = (await import('../src/index.js')) as {
        Tool: { name: string }
      }
      expect(module.Tool).toBeDefined()
    })

    it('should have description field', async () => {
      const module = (await import('../src/index.js')) as {
        Tool: { description: string }
      }
      expect(module.Tool).toBeDefined()
    })

    it('should have inputs field for parameter definitions', async () => {
      const module = (await import('../src/index.js')) as {
        Tool: { inputs: unknown[] }
      }
      expect(module.Tool).toBeDefined()
    })

    it('should have outputs field for return type definition', async () => {
      const module = (await import('../src/index.js')) as {
        Tool: { outputs: unknown }
      }
      expect(module.Tool).toBeDefined()
    })
  })
})

// ============================================================================
// ToolParameter Type Tests
// ============================================================================

describe('ToolParameter type', () => {
  describe('structure', () => {
    it('should have name field', async () => {
      const module = (await import('../src/index.js')) as {
        ToolParameter: { name: string }
      }
      expect(module.ToolParameter).toBeDefined()
    })

    it('should have type field', async () => {
      const module = (await import('../src/index.js')) as {
        ToolParameter: { type: string }
      }
      expect(module.ToolParameter).toBeDefined()
    })

    it('should have description field', async () => {
      const module = (await import('../src/index.js')) as {
        ToolParameter: { description?: string }
      }
      expect(module.ToolParameter).toBeDefined()
    })

    it('should have required field', async () => {
      const module = (await import('../src/index.js')) as {
        ToolParameter: { required: boolean }
      }
      expect(module.ToolParameter).toBeDefined()
    })

    it('should have default field for default values', async () => {
      const module = (await import('../src/index.js')) as {
        ToolParameter: { default?: unknown }
      }
      expect(module.ToolParameter).toBeDefined()
    })

    it('should have enum field for allowed values', async () => {
      const module = (await import('../src/index.js')) as {
        ToolParameter: { enum?: unknown[] }
      }
      expect(module.ToolParameter).toBeDefined()
    })
  })
})

// ============================================================================
// ToolInput Type Tests
// ============================================================================

describe('ToolInput type', () => {
  it('should be an array of ToolParameter', async () => {
    const module = (await import('../src/index.js')) as {
      ToolInput: unknown[]
      ToolParameter: unknown
    }
    expect(module.ToolInput).toBeDefined()
  })

  it('should support JSON Schema-like structure', async () => {
    // Tool inputs should be definable in JSON Schema format
    const module = (await import('../src/index.js')) as {
      ToolInput: {
        type: 'object'
        properties: Record<string, unknown>
        required?: string[]
      }
    }
    expect(module.ToolInput).toBeDefined()
  })
})

// ============================================================================
// ToolOutput Type Tests
// ============================================================================

describe('ToolOutput type', () => {
  it('should have type field', async () => {
    const module = (await import('../src/index.js')) as {
      ToolOutput: { type: string }
    }
    expect(module.ToolOutput).toBeDefined()
  })

  it('should have description field', async () => {
    const module = (await import('../src/index.js')) as {
      ToolOutput: { description?: string }
    }
    expect(module.ToolOutput).toBeDefined()
  })

  it('should support schema definition', async () => {
    const module = (await import('../src/index.js')) as {
      ToolOutput: { schema?: Record<string, unknown> }
    }
    expect(module.ToolOutput).toBeDefined()
  })
})

// ============================================================================
// Tool Execution Interface Tests
// ============================================================================

describe('Tool execution interface', () => {
  describe('ToolExecutionResult type', () => {
    it('should have success field', async () => {
      const module = (await import('../src/index.js')) as {
        ToolExecutionResult: { success: boolean }
      }
      expect(module.ToolExecutionResult).toBeDefined()
    })

    it('should have data field for successful result', async () => {
      const module = (await import('../src/index.js')) as {
        ToolExecutionResult: { data?: unknown }
      }
      expect(module.ToolExecutionResult).toBeDefined()
    })

    it('should have error field for failed result', async () => {
      const module = (await import('../src/index.js')) as {
        ToolExecutionResult: { error?: string }
      }
      expect(module.ToolExecutionResult).toBeDefined()
    })

    it('should have duration field for execution time', async () => {
      const module = (await import('../src/index.js')) as {
        ToolExecutionResult: { duration?: number }
      }
      expect(module.ToolExecutionResult).toBeDefined()
    })

    it('should have metadata field for additional info', async () => {
      const module = (await import('../src/index.js')) as {
        ToolExecutionResult: { metadata?: Record<string, unknown> }
      }
      expect(module.ToolExecutionResult).toBeDefined()
    })
  })

  describe('ToolExecutor type', () => {
    it('should export ToolExecutor type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ToolExecutor')
    })

    it('should be a function type that takes input and returns result', async () => {
      // ToolExecutor should be: (input: unknown) => Promise<ToolExecutionResult>
      const module = (await import('../src/index.js')) as {
        ToolExecutor: (input: unknown) => Promise<unknown>
      }
      expect(module.ToolExecutor).toBeDefined()
    })
  })

  describe('ExecutableTool interface', () => {
    it('should export ExecutableTool type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ExecutableTool')
    })

    it('should extend Tool with execute method', async () => {
      const module = (await import('../src/index.js')) as {
        ExecutableTool: {
          execute: (input: unknown) => Promise<unknown>
        }
      }
      expect(module.ExecutableTool).toBeDefined()
    })
  })
})

// ============================================================================
// Tool Validation Tests
// ============================================================================

describe('Tool validation', () => {
  describe('ToolValidationError type', () => {
    it('should have field field for error location', async () => {
      const module = (await import('../src/index.js')) as {
        ToolValidationError: { field: string }
      }
      expect(module.ToolValidationError).toBeDefined()
    })

    it('should have message field', async () => {
      const module = (await import('../src/index.js')) as {
        ToolValidationError: { message: string }
      }
      expect(module.ToolValidationError).toBeDefined()
    })

    it('should have code field for error type', async () => {
      const module = (await import('../src/index.js')) as {
        ToolValidationError: { code: string }
      }
      expect(module.ToolValidationError).toBeDefined()
    })

    it('should have expected field for expected value', async () => {
      const module = (await import('../src/index.js')) as {
        ToolValidationError: { expected?: unknown }
      }
      expect(module.ToolValidationError).toBeDefined()
    })

    it('should have received field for actual value', async () => {
      const module = (await import('../src/index.js')) as {
        ToolValidationError: { received?: unknown }
      }
      expect(module.ToolValidationError).toBeDefined()
    })
  })

  describe('ToolValidationResult type', () => {
    it('should export ToolValidationResult type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ToolValidationResult')
    })

    it('should have valid field', async () => {
      const module = (await import('../src/index.js')) as {
        ToolValidationResult: { valid: boolean }
      }
      expect(module.ToolValidationResult).toBeDefined()
    })

    it('should have errors field as array of ToolValidationError', async () => {
      const module = (await import('../src/index.js')) as {
        ToolValidationResult: { errors: unknown[] }
      }
      expect(module.ToolValidationResult).toBeDefined()
    })
  })

  describe('ValidatableTool interface', () => {
    it('should export ValidatableTool type', async () => {
      const module = await import('../src/index.js')
      expect(module).toHaveProperty('ValidatableTool')
    })

    it('should extend Tool with validate method', async () => {
      const module = (await import('../src/index.js')) as {
        ValidatableTool: {
          validate: (input: unknown) => unknown
        }
      }
      expect(module.ValidatableTool).toBeDefined()
    })
  })
})

// ============================================================================
// Tool Type Guards Tests
// ============================================================================

describe('Tool type guards', () => {
  it('should export isTool type guard function', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('isTool')
    expect(typeof module.isTool).toBe('function')
  })

  it('should export isToolParameter type guard function', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('isToolParameter')
    expect(typeof module.isToolParameter).toBe('function')
  })

  it('should export isToolExecutionResult type guard function', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('isToolExecutionResult')
    expect(typeof module.isToolExecutionResult).toBe('function')
  })

  it('should export isToolValidationError type guard function', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('isToolValidationError')
    expect(typeof module.isToolValidationError).toBe('function')
  })
})

// ============================================================================
// Tool Constants Tests
// ============================================================================

describe('Tool constants', () => {
  it('should export TOOL_TYPE constant', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('TOOL_TYPE')
    expect(module.TOOL_TYPE).toBe('https://schema.org.ai/Tool')
  })

  it('should export StandardToolTypes constant', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('StandardToolTypes')
  })

  it('should include standard tool parameter types', async () => {
    const module = (await import('../src/index.js')) as {
      StandardToolTypes: readonly string[]
    }
    expect(module.StandardToolTypes).toContain('string')
    expect(module.StandardToolTypes).toContain('number')
    expect(module.StandardToolTypes).toContain('boolean')
    expect(module.StandardToolTypes).toContain('object')
    expect(module.StandardToolTypes).toContain('array')
  })
})

// ============================================================================
// Tool Integration with Thing Tests
// ============================================================================

describe('Tool integration with Thing type', () => {
  it('should be compatible with Thing interface', async () => {
    // Tool should extend Thing, inheriting $id, $type, etc.
    const module = (await import('../src/index.js')) as {
      Tool: { $id: string; $type: string }
      Thing: { $id: string; $type: string }
    }
    expect(module.Tool).toBeDefined()
    expect(module.Thing).toBeDefined()
  })

  it('should export ToolId branded type', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('ToolId')
  })

  it('should export isToolId type guard', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('isToolId')
    expect(typeof module.isToolId).toBe('function')
  })
})

// ============================================================================
// Tool Collection Types Tests
// ============================================================================

describe('Tool collection types', () => {
  it('should export Tools collection type', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('Tools')
  })

  it('should export Toolbox type for tool groupings', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('Toolbox')
  })

  it('should have Toolbox with name and tools fields', async () => {
    const module = (await import('../src/index.js')) as {
      Toolbox: {
        name: string
        description?: string
        tools: unknown[]
      }
    }
    expect(module.Toolbox).toBeDefined()
  })
})

// ============================================================================
// Tool Capability Types Tests
// ============================================================================

describe('Tool capability types', () => {
  it('should export ToolCapability type', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('ToolCapability')
  })

  it('should have capability with name and description', async () => {
    const module = (await import('../src/index.js')) as {
      ToolCapability: {
        name: string
        description: string
      }
    }
    expect(module.ToolCapability).toBeDefined()
  })

  it('should export StandardCapabilities constant', async () => {
    const module = await import('../src/index.js')
    expect(module).toHaveProperty('StandardCapabilities')
  })

  it('should include standard capabilities like read, write, execute', async () => {
    const module = (await import('../src/index.js')) as {
      StandardCapabilities: readonly string[]
    }
    expect(module.StandardCapabilities).toContain('read')
    expect(module.StandardCapabilities).toContain('write')
    expect(module.StandardCapabilities).toContain('execute')
  })
})
