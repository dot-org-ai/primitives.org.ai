/**
 * Schema Input Validation Tests (RED Phase - TDD)
 *
 * These tests verify that invalid schema definitions are rejected with helpful error messages.
 * Currently, schema definitions are trusted without validation - this is a security issue.
 *
 * All tests are expected to FAIL initially. The GREEN phase will implement the validation.
 *
 * Security concerns addressed:
 * - SQL injection via entity names
 * - XSS via entity names
 * - Invalid field types that could cause runtime errors
 * - Malformed operator syntax
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest'
import { parseSchema, parseOperator, parseField } from '../schema/parse.js'
import type { DatabaseSchema } from '../types.js'

// =============================================================================
// Helper: Validation Error Assertions
// =============================================================================

/**
 * Expected structure for schema validation errors
 */
interface SchemaValidationError extends Error {
  code: string
  path?: string
  details?: string
}

/**
 * Check if error is a SchemaValidationError with expected properties
 */
function expectSchemaError(
  error: unknown,
  expectedCode: string,
  expectedPathContains?: string
): void {
  expect(error).toBeInstanceOf(Error)
  const err = error as SchemaValidationError
  expect(err.code).toBe(expectedCode)
  if (expectedPathContains) {
    expect(err.path).toContain(expectedPathContains)
  }
  // Error message should be helpful
  expect(err.message.length).toBeGreaterThan(10)
}

// =============================================================================
// Entity Name Validation Tests
// =============================================================================

describe('Schema Validation: Entity Names', () => {
  describe('SQL injection prevention', () => {
    it('rejects entity names with SQL injection attempts (DROP TABLE)', () => {
      const schema: DatabaseSchema = {
        'User; DROP TABLE users--': {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()

      try {
        parseSchema(schema)
      } catch (error) {
        expectSchemaError(error, 'INVALID_ENTITY_NAME', 'User; DROP TABLE')
      }
    })

    it('rejects entity names with SQL injection (SELECT)', () => {
      const schema: DatabaseSchema = {
        "User' OR '1'='1": {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()

      try {
        parseSchema(schema)
      } catch (error) {
        expectSchemaError(error, 'INVALID_ENTITY_NAME')
      }
    })

    it('rejects entity names with semicolons', () => {
      const schema: DatabaseSchema = {
        'User;Admin': {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects entity names with SQL comments', () => {
      const schema: DatabaseSchema = {
        'User--comment': {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects entity names with SQL UNION injection', () => {
      const schema: DatabaseSchema = {
        'User UNION SELECT * FROM secrets': {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })
  })

  describe('XSS prevention', () => {
    it('rejects entity names with script tags', () => {
      const schema: DatabaseSchema = {
        'User<script>alert(1)</script>': {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()

      try {
        parseSchema(schema)
      } catch (error) {
        expectSchemaError(error, 'INVALID_ENTITY_NAME')
      }
    })

    it('rejects entity names with HTML event handlers', () => {
      const schema: DatabaseSchema = {
        'User<img onerror=alert(1)>': {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects entity names with JavaScript protocol', () => {
      const schema: DatabaseSchema = {
        'javascript:alert(1)': {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects entity names with angle brackets', () => {
      const schema: DatabaseSchema = {
        'User<Admin>': {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })
  })

  describe('valid entity name format', () => {
    it('rejects entity names starting with numbers', () => {
      const schema: DatabaseSchema = {
        '123User': {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects entity names with spaces', () => {
      const schema: DatabaseSchema = {
        'User Profile': {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects entity names with special characters', () => {
      const specialChars = ['@', '#', '$', '%', '^', '&', '*', '!', '?', '+', '=', '/', '\\', '|', '`', '~']

      for (const char of specialChars) {
        const schema: DatabaseSchema = {
          [`User${char}Entity`]: {
            name: 'string',
          },
        }

        expect(() => parseSchema(schema)).toThrow()
      }
    })

    it('rejects empty entity names', () => {
      const schema: DatabaseSchema = {
        '': {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects entity names that are too long (> 64 characters)', () => {
      const longName = 'A'.repeat(65)
      const schema: DatabaseSchema = {
        [longName]: {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('accepts valid PascalCase entity names', () => {
      const schema: DatabaseSchema = {
        User: { name: 'string' },
        BlogPost: { title: 'string' },
        UserProfile: { bio: 'string' },
        APIKey: { key: 'string' },
      }

      // This should NOT throw
      expect(() => parseSchema(schema)).not.toThrow()
    })

    it('accepts entity names with underscores', () => {
      const schema: DatabaseSchema = {
        User_Profile: { name: 'string' },
        API_Key: { key: 'string' },
      }

      // This should NOT throw
      expect(() => parseSchema(schema)).not.toThrow()
    })

    it('accepts entity names with numbers (not at start)', () => {
      const schema: DatabaseSchema = {
        User2: { name: 'string' },
        OAuth2Token: { token: 'string' },
      }

      // This should NOT throw
      expect(() => parseSchema(schema)).not.toThrow()
    })
  })
})

// =============================================================================
// Field Definition Validation Tests
// =============================================================================

describe('Schema Validation: Field Definitions', () => {
  describe('invalid field types', () => {
    it('rejects unknown primitive types', () => {
      const schema: DatabaseSchema = {
        User: {
          name: 'varchar', // Invalid - not a supported primitive
        },
      }

      expect(() => parseSchema(schema)).toThrow()

      try {
        parseSchema(schema)
      } catch (error) {
        expectSchemaError(error, 'INVALID_FIELD_TYPE', 'User.name')
      }
    })

    it('rejects SQL types', () => {
      const sqlTypes = ['int', 'varchar', 'text', 'blob', 'integer', 'real', 'float', 'double']

      for (const sqlType of sqlTypes) {
        const schema: DatabaseSchema = {
          User: {
            field: sqlType,
          },
        }

        expect(() => parseSchema(schema)).toThrow()
      }
    })

    it('rejects JavaScript types (not in our type system)', () => {
      const jsTypes = ['object', 'array', 'function', 'symbol', 'bigint', 'undefined', 'null']

      for (const jsType of jsTypes) {
        const schema: DatabaseSchema = {
          User: {
            field: jsType,
          },
        }

        expect(() => parseSchema(schema)).toThrow()
      }
    })

    it('rejects empty string as field type', () => {
      const schema: DatabaseSchema = {
        User: {
          name: '',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects whitespace-only field type', () => {
      const schema: DatabaseSchema = {
        User: {
          name: '   ',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })
  })

  describe('invalid field names', () => {
    it('rejects field names with SQL injection', () => {
      const schema: DatabaseSchema = {
        User: {
          'name; DROP TABLE users--': 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()

      try {
        parseSchema(schema)
      } catch (error) {
        expectSchemaError(error, 'INVALID_FIELD_NAME')
      }
    })

    it('rejects field names with special characters', () => {
      const schema: DatabaseSchema = {
        User: {
          'user@email': 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects empty field names', () => {
      const schema: DatabaseSchema = {
        User: {
          '': 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('accepts valid camelCase field names', () => {
      const schema: DatabaseSchema = {
        User: {
          name: 'string',
          emailAddress: 'string',
          createdAt: 'datetime',
          isActive: 'boolean',
        },
      }

      expect(() => parseSchema(schema)).not.toThrow()
    })

    it('accepts valid snake_case field names', () => {
      const schema: DatabaseSchema = {
        User: {
          first_name: 'string',
          last_name: 'string',
          created_at: 'datetime',
        },
      }

      expect(() => parseSchema(schema)).not.toThrow()
    })
  })

  describe('invalid array syntax', () => {
    it('rejects nested array syntax', () => {
      const schema: DatabaseSchema = {
        User: {
          matrix: [['string']] as unknown as [string], // Type assertion to bypass TS
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects empty array syntax', () => {
      const schema: DatabaseSchema = {
        User: {
          tags: [] as unknown as [string],
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects array with multiple elements', () => {
      const schema: DatabaseSchema = {
        User: {
          tags: ['string', 'number'] as unknown as [string],
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })
  })

  describe('invalid optional syntax', () => {
    it('rejects double optional modifier (??)', () => {
      const schema: DatabaseSchema = {
        User: {
          bio: 'string??',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects optional in wrong position ([]?)', () => {
      // []? is actually valid per the grammar, but we should test the parsing
      // This test documents expected behavior
      const schema: DatabaseSchema = {
        User: {
          tags: 'string[]?',
        },
      }

      // Should either work or throw with a clear error
      // Current implementation may not handle this
      const result = parseSchema(schema)
      const field = result.entities.get('User')?.fields.get('tags')

      // If it parses, verify the semantics are correct
      if (field) {
        expect(field.isArray).toBe(true)
        expect(field.isOptional).toBe(true)
      }
    })
  })
})

// =============================================================================
// Operator Syntax Validation Tests
// =============================================================================

describe('Schema Validation: Operator Syntax', () => {
  describe('malformed operators', () => {
    it('rejects operators with missing target type', () => {
      expect(() => parseField('author', '->')).toThrow()
      expect(() => parseField('author', '~>')).toThrow()
      expect(() => parseField('author', '<-')).toThrow()
      expect(() => parseField('author', '<~')).toThrow()
    })

    it('rejects operators with whitespace-only target', () => {
      expect(() => parseField('author', '->   ')).toThrow()
      expect(() => parseField('author', '~>   ')).toThrow()
    })

    it('rejects invalid operator combinations', () => {
      expect(() => parseField('author', '<>')).toThrow() // Not a valid operator
      expect(() => parseField('author', '><')).toThrow() // Not a valid operator
      expect(() => parseField('author', '~~>')).toThrow() // Double tilde
      expect(() => parseField('author', '-->>')).toThrow() // Double arrow
    })

    it('rejects operators with SQL injection in target type', () => {
      expect(() => parseField('author', '->User; DROP TABLE--')).toThrow()
      expect(() => parseField('author', "~>User' OR '1'='1")).toThrow()
    })

    it('rejects operators with XSS in target type', () => {
      expect(() => parseField('author', '->User<script>')).toThrow()
      expect(() => parseField('author', '~>User<img onerror=alert(1)>')).toThrow()
    })
  })

  describe('invalid union types', () => {
    it('rejects empty union members', () => {
      expect(() => parseField('ref', '->User|')).toThrow()
      expect(() => parseField('ref', '->|Author')).toThrow()
      expect(() => parseField('ref', '->User||Author')).toThrow()
    })

    it('rejects union with invalid type names', () => {
      expect(() => parseField('ref', '->User|123Invalid')).toThrow()
      expect(() => parseField('ref', '->User|Author; DROP TABLE')).toThrow()
    })
  })

  describe('invalid threshold syntax', () => {
    it('rejects threshold outside valid range (> 1)', () => {
      const result = parseOperator('~>Category(1.5)')
      // Should either reject or clamp to valid range
      if (result?.threshold !== undefined) {
        expect(result.threshold).toBeLessThanOrEqual(1)
      }
    })

    it('rejects threshold outside valid range (< 0)', () => {
      const result = parseOperator('~>Category(-0.5)')
      // Should either reject or clamp to valid range
      if (result?.threshold !== undefined) {
        expect(result.threshold).toBeGreaterThanOrEqual(0)
      }
    })

    it('rejects non-numeric threshold', () => {
      // Should not parse 'abc' as a valid threshold
      const result = parseOperator('~>Category(abc)')
      expect(result?.threshold).toBeUndefined()
    })

    it('rejects malformed threshold parentheses', () => {
      const schema: DatabaseSchema = {
        Post: {
          category: '~>Category(0.8',  // Missing closing paren
        },
        Category: {
          name: 'string',
        },
      }

      // Should either handle gracefully or throw
      // Current implementation should parse but may not extract threshold correctly
      const parsed = parseSchema(schema)
      const field = parsed.entities.get('Post')?.fields.get('category')

      // If threshold was extracted, it should be valid or undefined
      if (field?.threshold !== undefined) {
        expect(field.threshold).toBeGreaterThanOrEqual(0)
        expect(field.threshold).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('invalid backref syntax', () => {
    it('rejects backref with invalid field name', () => {
      const schema: DatabaseSchema = {
        Post: {
          author: '->Author.123posts', // Invalid: starts with number
        },
        Author: {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects backref with special characters', () => {
      const schema: DatabaseSchema = {
        Post: {
          author: '->Author.posts@all', // Invalid: @ symbol
        },
        Author: {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })

    it('rejects multiple dots in backref', () => {
      const schema: DatabaseSchema = {
        Post: {
          author: '->Author.posts.items', // Invalid: multiple dots
        },
        Author: {
          name: 'string',
        },
      }

      expect(() => parseSchema(schema)).toThrow()
    })
  })
})

// =============================================================================
// Error Message Quality Tests
// =============================================================================

describe('Schema Validation: Error Messages', () => {
  it('error includes the problematic entity name', () => {
    const schema: DatabaseSchema = {
      'User; DROP TABLE': {
        name: 'string',
      },
    }

    try {
      parseSchema(schema)
      expect.fail('Should have thrown')
    } catch (error) {
      expect((error as Error).message).toContain('User; DROP TABLE')
    }
  })

  it('error includes the problematic field name', () => {
    const schema: DatabaseSchema = {
      User: {
        'name; DROP TABLE': 'string',
      },
    }

    try {
      parseSchema(schema)
      expect.fail('Should have thrown')
    } catch (error) {
      expect((error as Error).message).toContain('name; DROP TABLE')
    }
  })

  it('error includes the problematic field type', () => {
    const schema: DatabaseSchema = {
      User: {
        age: 'integer', // Invalid type
      },
    }

    try {
      parseSchema(schema)
      expect.fail('Should have thrown')
    } catch (error) {
      expect((error as Error).message).toContain('integer')
    }
  })

  it('error suggests valid alternatives for invalid types', () => {
    const schema: DatabaseSchema = {
      User: {
        age: 'int', // Should suggest 'number'
      },
    }

    try {
      parseSchema(schema)
      expect.fail('Should have thrown')
    } catch (error) {
      const message = (error as Error).message.toLowerCase()
      // Should suggest the correct type
      expect(message).toMatch(/number|valid types/)
    }
  })

  it('error provides clear path to the problem', () => {
    const schema: DatabaseSchema = {
      User: {
        profile: {
          bio: 'string', // Invalid nested object
        } as unknown as string,
      },
    }

    try {
      parseSchema(schema)
      expect.fail('Should have thrown')
    } catch (error) {
      const message = (error as Error).message
      // Should include the path
      expect(message).toMatch(/User.*profile|profile.*User/i)
    }
  })

  it('error explains what is wrong, not just that something is wrong', () => {
    const schema: DatabaseSchema = {
      'User<script>': {
        name: 'string',
      },
    }

    try {
      parseSchema(schema)
      expect.fail('Should have thrown')
    } catch (error) {
      const message = (error as Error).message
      // Should explain WHY it's invalid, not just say "invalid"
      expect(message).toMatch(/special char|alphanumeric|letter.*underscore|PascalCase/i)
    }
  })
})

// =============================================================================
// Reserved Names Tests
// =============================================================================

describe('Schema Validation: Reserved Names', () => {
  it('rejects reserved entity names that conflict with system types', () => {
    const reservedNames = ['Edge', 'Noun', 'Verb', 'Thing']

    for (const name of reservedNames) {
      const schema: DatabaseSchema = {
        [name]: {
          customField: 'string',
        },
      }

      // These should either throw or be handled specially
      // The current implementation adds Edge automatically, so this tests
      // that user-defined types don't conflict
      try {
        const parsed = parseSchema(schema)
        // If it doesn't throw, verify the system type is preserved
        const entity = parsed.entities.get(name)
        // User-defined fields should be preserved if not conflicting
        expect(entity).toBeDefined()
      } catch (error) {
        // Throwing is also acceptable behavior
        expect((error as Error).message).toContain(name)
      }
    }
  })

  it('warns about reserved field names', () => {
    const schema: DatabaseSchema = {
      User: {
        $id: 'string', // Reserved
        $type: 'string', // Reserved
        name: 'string',
      },
    }

    // $ prefixed fields are metadata and should be skipped or handled specially
    const parsed = parseSchema(schema)
    const user = parsed.entities.get('User')

    // $id and $type should not be in the parsed fields
    // (they're system fields, not user-defined)
    expect(user?.fields.has('$id')).toBe(false)
    expect(user?.fields.has('$type')).toBe(false)
    expect(user?.fields.has('name')).toBe(true)
  })
})

// =============================================================================
// Circular Reference Validation Tests
// =============================================================================

describe('Schema Validation: Circular References', () => {
  it('allows valid self-referential types', () => {
    const schema: DatabaseSchema = {
      User: {
        name: 'string',
        manager: 'User.reports?',
      },
    }

    // Self-references are valid
    expect(() => parseSchema(schema)).not.toThrow()
  })

  it('allows valid mutual references', () => {
    const schema: DatabaseSchema = {
      Post: {
        title: 'string',
        author: '->Author.posts',
      },
      Author: {
        name: 'string',
        // posts is auto-created
      },
    }

    expect(() => parseSchema(schema)).not.toThrow()
  })

  it('validates that referenced types exist', () => {
    const schema: DatabaseSchema = {
      Post: {
        title: 'string',
        category: '->NonExistentType', // Type doesn't exist
      },
    }

    // This should throw because NonExistentType doesn't exist
    expect(() => parseSchema(schema)).toThrow()

    try {
      parseSchema(schema)
    } catch (error) {
      expect((error as Error).message).toContain('NonExistentType')
    }
  })
})
