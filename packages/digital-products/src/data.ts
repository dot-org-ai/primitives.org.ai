/**
 * Data() - Define structured data
 */

import type {
  DataDefinition,
  IndexDefinition,
  RelationshipDefinition,
  ValidationRule,
} from './types.js'
import type { SimpleSchema } from 'ai-functions'
import { registerProduct } from './product.js'

/**
 * Create a data definition
 *
 * @example
 * ```ts
 * const userData = Data({
 *   id: 'users',
 *   name: 'Users',
 *   description: 'User data store',
 *   version: '1.0.0',
 *   schema: {
 *     id: 'User ID',
 *     name: 'User name',
 *     email: 'User email',
 *     createdAt: 'Creation timestamp (date)',
 *     role: 'admin | user | guest',
 *   },
 *   provider: 'postgres',
 *   indexes: [
 *     Index('email_idx', ['email'], { unique: true }),
 *     Index('role_idx', ['role']),
 *   ],
 *   validation: [
 *     Validate('email', 'email', 'Must be a valid email'),
 *     Validate('name', 'required', 'Name is required'),
 *   ],
 * })
 * ```
 */
export function Data(config: Omit<DataDefinition, 'type'>): DataDefinition {
  const data: DataDefinition = {
    type: 'data',
    id: config.id,
    name: config.name,
    description: config.description,
    version: config.version,
    schema: config.schema,
    provider: config.provider || 'fs',
    status: config.status || 'active',
    ...(config.indexes !== undefined && { indexes: config.indexes }),
    ...(config.relationships !== undefined && { relationships: config.relationships }),
    ...(config.validation !== undefined && { validation: config.validation }),
    ...(config.metadata !== undefined && { metadata: config.metadata }),
    ...(config.tags !== undefined && { tags: config.tags }),
  }

  return registerProduct(data)
}

/**
 * Helper to create an index definition
 *
 * @example
 * ```ts
 * const emailIndex = Index('email_idx', ['email'], { unique: true })
 * const nameIndex = Index('name_idx', ['firstName', 'lastName'])
 * const vectorIndex = Index('embedding_idx', ['embedding'], { type: 'vector' })
 * ```
 */
export function Index(
  name: string,
  fields: string[],
  options?: Omit<IndexDefinition, 'name' | 'fields'>
): IndexDefinition {
  return {
    name,
    fields,
    ...options,
  }
}

/**
 * Helper to create a relationship definition
 *
 * @example
 * ```ts
 * const userPosts = Relationship('one-to-many', 'userId', 'posts', 'author')
 * const postTags = Relationship('many-to-many', 'postId', 'tags', 'posts')
 * ```
 */
export function Relationship(
  type: RelationshipDefinition['type'],
  from: string,
  to: string,
  field: string
): RelationshipDefinition {
  return {
    type,
    from,
    to,
    field,
  }
}

/**
 * Helper to create a validation rule
 *
 * @example
 * ```ts
 * const emailRule = Validate('email', 'email', 'Must be a valid email')
 * const ageRule = Validate('age', 'min', { value: 18 }, 'Must be 18 or older')
 * const uniqueRule = Validate('username', 'unique', 'Username already taken')
 * ```
 */
export function Validate(
  field: string,
  rule: ValidationRule['rule'],
  paramsOrMessage?: unknown | string,
  message?: string
): ValidationRule {
  if (typeof paramsOrMessage === 'string') {
    return { field, rule, message: paramsOrMessage }
  }

  return {
    field,
    rule,
    params: paramsOrMessage,
    ...(message !== undefined && { message }),
  }
}
