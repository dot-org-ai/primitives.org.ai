/**
 * Tests for schema migration executor
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryProvider } from '../src/memory-provider.js'
import {
  defineMigration,
  runMigrations,
  getPendingMigrations,
  rollbackLastMigration,
  type Migration,
} from '../src/schema/migration.js'
import { getSchemaVersion } from '../src/schema/version.js'

describe('Schema Migration', () => {
  let provider: ReturnType<typeof createMemoryProvider>

  beforeEach(() => {
    provider = createMemoryProvider()
  })

  describe('defineMigration', () => {
    it('creates a valid migration definition', () => {
      const migration = defineMigration({
        version: 1,
        description: 'Initial schema',
        up: [],
        down: [],
      })

      expect(migration.version).toBe(1)
      expect(migration.description).toBe('Initial schema')
      expect(migration.up).toEqual([])
      expect(migration.down).toEqual([])
    })

    it('validates version must be positive', () => {
      expect(() =>
        defineMigration({
          version: 0,
          description: 'Invalid',
          up: [],
          down: [],
        })
      ).toThrow('positive number')
    })

    it('validates version must be a number', () => {
      expect(() =>
        defineMigration({
          version: 'one' as any,
          description: 'Invalid',
          up: [],
          down: [],
        })
      ).toThrow('positive number')
    })

    it('validates description is required', () => {
      expect(() =>
        defineMigration({
          version: 1,
          description: '',
          up: [],
          down: [],
        })
      ).toThrow('description')
    })

    it('validates up operations array is required', () => {
      expect(() =>
        defineMigration({
          version: 1,
          description: 'Test',
          up: null as any,
          down: [],
        })
      ).toThrow("'up'")
    })

    it('validates down operations array is required', () => {
      expect(() =>
        defineMigration({
          version: 1,
          description: 'Test',
          up: [],
          down: null as any,
        })
      ).toThrow("'down'")
    })
  })

  describe('runMigrations', () => {
    it('runs pending migrations in order', async () => {
      const migrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'Add User entity',
          up: [{ type: 'addEntity', entityName: 'User' }],
          down: [{ type: 'removeEntity', entityName: 'User' }],
        }),
        defineMigration({
          version: 2,
          description: 'Add email field to User',
          up: [
            {
              type: 'addField',
              entityName: 'User',
              fieldName: 'email',
              fieldType: 'string',
              defaultValue: '',
            },
          ],
          down: [{ type: 'removeField', entityName: 'User', fieldName: 'email' }],
        }),
      ]

      const result = await runMigrations(provider, migrations)

      expect(result.migrationsRun).toBe(true)
      expect(result.fromVersion).toBeNull()
      expect(result.toVersion).toBe(2)
      expect(result.appliedMigrations).toEqual([1, 2])
      expect(result.errors).toHaveLength(0)

      const version = await getSchemaVersion(provider)
      expect(version?.version).toBe(2)
    })

    it('skips already applied migrations', async () => {
      const migrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'v1',
          up: [],
          down: [],
        }),
        defineMigration({
          version: 2,
          description: 'v2',
          up: [],
          down: [],
        }),
      ]

      // Run migrations first time
      await runMigrations(provider, migrations)

      // Run again
      const result = await runMigrations(provider, migrations)

      expect(result.migrationsRun).toBe(false)
      expect(result.fromVersion).toBe(2)
      expect(result.toVersion).toBe(2)
      expect(result.appliedMigrations).toHaveLength(0)
    })

    it('runs only new migrations', async () => {
      const initialMigrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'v1',
          up: [],
          down: [],
        }),
      ]

      await runMigrations(provider, initialMigrations)

      const allMigrations: Migration[] = [
        ...initialMigrations,
        defineMigration({
          version: 2,
          description: 'v2',
          up: [],
          down: [],
        }),
      ]

      const result = await runMigrations(provider, allMigrations)

      expect(result.migrationsRun).toBe(true)
      expect(result.fromVersion).toBe(1)
      expect(result.toVersion).toBe(2)
      expect(result.appliedMigrations).toEqual([2])
    })

    it('validates sequential version numbers', async () => {
      const migrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'v1',
          up: [],
          down: [],
        }),
        defineMigration({
          version: 3, // Skipped version 2
          description: 'v3',
          up: [],
          down: [],
        }),
      ]

      await expect(runMigrations(provider, migrations)).rejects.toThrow('sequential')
    })

    it('migrates to specific target version', async () => {
      const migrations: Migration[] = [
        defineMigration({ version: 1, description: 'v1', up: [], down: [] }),
        defineMigration({ version: 2, description: 'v2', up: [], down: [] }),
        defineMigration({ version: 3, description: 'v3', up: [], down: [] }),
      ]

      const result = await runMigrations(provider, migrations, 2)

      expect(result.toVersion).toBe(2)
      expect(result.appliedMigrations).toEqual([1, 2])

      const version = await getSchemaVersion(provider)
      expect(version?.version).toBe(2)
    })

    it('executes addField operation with default value', async () => {
      // Create a user first
      await provider.create('User', 'user1', { name: 'John' })

      const migrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'Add email field',
          up: [
            {
              type: 'addField',
              entityName: 'User',
              fieldName: 'email',
              fieldType: 'string',
              defaultValue: 'noemail@example.com',
            },
          ],
          down: [{ type: 'removeField', entityName: 'User', fieldName: 'email' }],
        }),
      ]

      await runMigrations(provider, migrations)

      const user = await provider.get('User', 'user1')
      expect(user?.email).toBe('noemail@example.com')
    })

    it('executes renameField operation', async () => {
      await provider.create('User', 'user1', { userName: 'john_doe' })

      const migrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'Rename userName to displayName',
          up: [
            {
              type: 'renameField',
              entityName: 'User',
              oldFieldName: 'userName',
              newFieldName: 'displayName',
            },
          ],
          down: [
            {
              type: 'renameField',
              entityName: 'User',
              oldFieldName: 'displayName',
              newFieldName: 'userName',
            },
          ],
        }),
      ]

      await runMigrations(provider, migrations)

      const user = await provider.get('User', 'user1')
      expect(user?.displayName).toBe('john_doe')
      expect(user?.userName).toBeNull()
    })

    it('executes changeType operation with transform', async () => {
      await provider.create('User', 'user1', { age: '25' })

      const migrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'Change age from string to number',
          up: [
            {
              type: 'changeType',
              entityName: 'User',
              fieldName: 'age',
              newType: 'number',
              transform: (val) => parseInt(val as string, 10),
            },
          ],
          down: [
            {
              type: 'changeType',
              entityName: 'User',
              fieldName: 'age',
              newType: 'string',
              transform: (val) => String(val),
            },
          ],
        }),
      ]

      await runMigrations(provider, migrations)

      const user = await provider.get('User', 'user1')
      expect(user?.age).toBe(25)
      expect(typeof user?.age).toBe('number')
    })

    it('executes transformData operation', async () => {
      await provider.create('User', 'user1', { firstName: 'John', lastName: 'Doe' })
      await provider.create('User', 'user2', { firstName: 'Jane', lastName: 'Smith' })

      const migrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'Add fullName field',
          up: [
            {
              type: 'transformData',
              entityName: 'User',
              transform: (entity) => ({
                ...entity,
                fullName: `${entity.firstName} ${entity.lastName}`,
              }),
            },
          ],
          down: [
            {
              type: 'removeField',
              entityName: 'User',
              fieldName: 'fullName',
            },
          ],
        }),
      ]

      await runMigrations(provider, migrations)

      const user1 = await provider.get('User', 'user1')
      const user2 = await provider.get('User', 'user2')
      expect(user1?.fullName).toBe('John Doe')
      expect(user2?.fullName).toBe('Jane Smith')
    })

    it('executes transformData with filter', async () => {
      await provider.create('User', 'admin', { name: 'Admin', isAdmin: true })
      await provider.create('User', 'user1', { name: 'User', isAdmin: false })

      const migrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'Add adminBadge to admins only',
          up: [
            {
              type: 'transformData',
              entityName: 'User',
              filter: (entity) => entity.isAdmin === true,
              transform: (entity) => ({
                ...entity,
                adminBadge: 'ADMIN',
              }),
            },
          ],
          down: [],
        }),
      ]

      await runMigrations(provider, migrations)

      const admin = await provider.get('User', 'admin')
      const user = await provider.get('User', 'user1')
      expect(admin?.adminBadge).toBe('ADMIN')
      expect(user?.adminBadge).toBeUndefined()
    })

    it('executes removeEntity with deleteData', async () => {
      await provider.create('TempData', 'temp1', { value: 1 })
      await provider.create('TempData', 'temp2', { value: 2 })

      const migrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'Remove TempData entity',
          up: [
            {
              type: 'removeEntity',
              entityName: 'TempData',
              deleteData: true,
            },
          ],
          down: [{ type: 'addEntity', entityName: 'TempData' }],
        }),
      ]

      await runMigrations(provider, migrations)

      const all = await provider.list('TempData')
      expect(all).toHaveLength(0)
    })
  })

  describe('rollback migrations', () => {
    it('rolls back to previous version', async () => {
      const migrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'v1',
          up: [],
          down: [],
        }),
        defineMigration({
          version: 2,
          description: 'v2',
          up: [],
          down: [],
        }),
      ]

      await runMigrations(provider, migrations)
      const result = await runMigrations(provider, migrations, 1)

      expect(result.migrationsRun).toBe(true)
      expect(result.fromVersion).toBe(2)
      expect(result.toVersion).toBe(1)
      expect(result.appliedMigrations).toEqual([2])

      const version = await getSchemaVersion(provider)
      expect(version?.version).toBe(1)
    })

    it('executes down operations on rollback', async () => {
      await provider.create('User', 'user1', { name: 'John' })

      const migrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'Add email field',
          up: [
            {
              type: 'addField',
              entityName: 'User',
              fieldName: 'email',
              fieldType: 'string',
              defaultValue: 'default@example.com',
            },
          ],
          down: [{ type: 'removeField', entityName: 'User', fieldName: 'email' }],
        }),
      ]

      await runMigrations(provider, migrations)
      let user = await provider.get('User', 'user1')
      expect(user?.email).toBe('default@example.com')

      await runMigrations(provider, migrations, 0)
      user = await provider.get('User', 'user1')
      expect(user?.email).toBeNull()
    })
  })

  describe('getPendingMigrations', () => {
    it('returns all migrations when none applied', async () => {
      const migrations: Migration[] = [
        defineMigration({ version: 1, description: 'v1', up: [], down: [] }),
        defineMigration({ version: 2, description: 'v2', up: [], down: [] }),
      ]

      const pending = await getPendingMigrations(provider, migrations)

      expect(pending).toHaveLength(2)
      expect(pending.map((m) => m.version)).toEqual([1, 2])
    })

    it('returns only unapplied migrations', async () => {
      const migrations: Migration[] = [
        defineMigration({ version: 1, description: 'v1', up: [], down: [] }),
        defineMigration({ version: 2, description: 'v2', up: [], down: [] }),
        defineMigration({ version: 3, description: 'v3', up: [], down: [] }),
      ]

      await runMigrations(provider, migrations, 1)

      const pending = await getPendingMigrations(provider, migrations)

      expect(pending).toHaveLength(2)
      expect(pending.map((m) => m.version)).toEqual([2, 3])
    })

    it('returns empty array when all applied', async () => {
      const migrations: Migration[] = [
        defineMigration({ version: 1, description: 'v1', up: [], down: [] }),
      ]

      await runMigrations(provider, migrations)

      const pending = await getPendingMigrations(provider, migrations)

      expect(pending).toHaveLength(0)
    })
  })

  describe('rollbackLastMigration', () => {
    it('rolls back the most recent migration', async () => {
      const migrations: Migration[] = [
        defineMigration({ version: 1, description: 'v1', up: [], down: [] }),
        defineMigration({ version: 2, description: 'v2', up: [], down: [] }),
      ]

      await runMigrations(provider, migrations)
      const result = await rollbackLastMigration(provider, migrations)

      expect(result.migrationsRun).toBe(true)
      expect(result.toVersion).toBe(1)
    })

    it('does nothing when no migrations applied', async () => {
      const migrations: Migration[] = [
        defineMigration({ version: 1, description: 'v1', up: [], down: [] }),
      ]

      const result = await rollbackLastMigration(provider, migrations)

      expect(result.migrationsRun).toBe(false)
      expect(result.toVersion).toBe(0)
    })
  })

  describe('error handling', () => {
    it('stops on first error and reports it', async () => {
      const migrations: Migration[] = [
        defineMigration({
          version: 1,
          description: 'v1',
          up: [
            {
              type: 'transformData',
              entityName: 'User',
              transform: () => {
                throw new Error('Transform failed')
              },
            },
          ],
          down: [],
        }),
      ]

      // Create a user so transform gets called
      await provider.create('User', 'user1', { name: 'John' })

      const result = await runMigrations(provider, migrations)

      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]!.version).toBe(1)
      expect(result.errors[0]!.error.message).toContain('Transform failed')
    })
  })
})
