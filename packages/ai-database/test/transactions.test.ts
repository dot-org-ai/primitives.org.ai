/**
 * Tests for transaction support in MemoryProvider
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryProvider, MemoryTransaction, createMemoryProvider } from '../src/memory-provider.js'
import { hasTransactionSupport } from '../src/schema/provider.js'

describe('Transaction Support', () => {
  let provider: MemoryProvider

  beforeEach(() => {
    provider = createMemoryProvider()
  })

  describe('hasTransactionSupport', () => {
    it('returns true for MemoryProvider', () => {
      expect(hasTransactionSupport(provider)).toBe(true)
    })

    it('returns false for a provider without beginTransaction', () => {
      const plainProvider = {
        get: async () => null,
        list: async () => [],
        search: async () => [],
        create: async () => ({}),
        update: async () => ({}),
        delete: async () => false,
        related: async () => [],
        relate: async () => {},
        unrelate: async () => {},
      }
      expect(hasTransactionSupport(plainProvider)).toBe(false)
    })
  })

  describe('beginTransaction', () => {
    it('returns a Transaction object', async () => {
      const txn = await provider.beginTransaction()
      expect(txn).toBeDefined()
      expect(typeof txn.get).toBe('function')
      expect(typeof txn.create).toBe('function')
      expect(typeof txn.update).toBe('function')
      expect(typeof txn.delete).toBe('function')
      expect(typeof txn.relate).toBe('function')
      expect(typeof txn.commit).toBe('function')
      expect(typeof txn.rollback).toBe('function')
      // Clean up
      await txn.rollback()
    })
  })

  describe('commit', () => {
    it('applies buffered creates on commit', async () => {
      const txn = await provider.beginTransaction()

      await txn.create('User', 'alice', { name: 'Alice' })
      await txn.create('User', 'bob', { name: 'Bob' })

      // Not visible in provider yet
      expect(await provider.get('User', 'alice')).toBeNull()
      expect(await provider.get('User', 'bob')).toBeNull()

      // But visible within the transaction
      const alice = await txn.get('User', 'alice')
      expect(alice).not.toBeNull()
      expect(alice!.name).toBe('Alice')

      await txn.commit()

      // Now visible in provider
      const aliceAfter = await provider.get('User', 'alice')
      expect(aliceAfter).not.toBeNull()
      expect(aliceAfter!.name).toBe('Alice')

      const bobAfter = await provider.get('User', 'bob')
      expect(bobAfter).not.toBeNull()
      expect(bobAfter!.name).toBe('Bob')
    })

    it('applies buffered updates on commit', async () => {
      // Pre-create entity
      await provider.create('User', 'alice', { name: 'Alice', age: 25 })

      const txn = await provider.beginTransaction()
      await txn.update('User', 'alice', { age: 26 })

      // Provider still has old data
      const before = await provider.get('User', 'alice')
      expect(before!.age).toBe(25)

      // Transaction sees updated data
      const inTxn = await txn.get('User', 'alice')
      expect(inTxn!.age).toBe(26)

      await txn.commit()

      // Provider now has updated data
      const after = await provider.get('User', 'alice')
      expect(after!.age).toBe(26)
    })

    it('applies buffered deletes on commit', async () => {
      await provider.create('User', 'alice', { name: 'Alice' })

      const txn = await provider.beginTransaction()
      const deleted = await txn.delete('User', 'alice')
      expect(deleted).toBe(true)

      // Still exists in provider
      expect(await provider.get('User', 'alice')).not.toBeNull()

      // But not visible in transaction
      expect(await txn.get('User', 'alice')).toBeNull()

      await txn.commit()

      // Now deleted from provider
      expect(await provider.get('User', 'alice')).toBeNull()
    })

    it('applies buffered relates on commit', async () => {
      await provider.create('User', 'alice', { name: 'Alice' })
      await provider.create('Post', 'post1', { title: 'Hello' })

      const txn = await provider.beginTransaction()
      await txn.relate('User', 'alice', 'posts', 'Post', 'post1')

      // No relation in provider yet
      const beforeRelated = await provider.related('User', 'alice', 'posts')
      expect(beforeRelated).toHaveLength(0)

      await txn.commit()

      // Relation now exists
      const afterRelated = await provider.related('User', 'alice', 'posts')
      expect(afterRelated).toHaveLength(1)
    })
  })

  describe('rollback', () => {
    it('discards buffered creates on rollback', async () => {
      const txn = await provider.beginTransaction()
      await txn.create('User', 'alice', { name: 'Alice' })

      await txn.rollback()

      // Not in provider
      expect(await provider.get('User', 'alice')).toBeNull()
    })

    it('discards buffered updates on rollback', async () => {
      await provider.create('User', 'alice', { name: 'Alice', age: 25 })

      const txn = await provider.beginTransaction()
      await txn.update('User', 'alice', { age: 99 })
      await txn.rollback()

      // Provider still has original data
      const after = await provider.get('User', 'alice')
      expect(after!.age).toBe(25)
    })

    it('discards buffered deletes on rollback', async () => {
      await provider.create('User', 'alice', { name: 'Alice' })

      const txn = await provider.beginTransaction()
      await txn.delete('User', 'alice')
      await txn.rollback()

      // Still exists
      expect(await provider.get('User', 'alice')).not.toBeNull()
    })
  })

  describe('error handling', () => {
    it('throws if commit called twice', async () => {
      const txn = await provider.beginTransaction()
      await txn.commit()
      await expect(txn.commit()).rejects.toThrow('Transaction already committed')
    })

    it('throws if rollback called after commit', async () => {
      const txn = await provider.beginTransaction()
      await txn.commit()
      await expect(txn.rollback()).rejects.toThrow('Transaction already committed')
    })

    it('throws if commit called after rollback', async () => {
      const txn = await provider.beginTransaction()
      await txn.rollback()
      await expect(txn.commit()).rejects.toThrow('Transaction already rolled back')
    })

    it('throws if operations called after commit', async () => {
      const txn = await provider.beginTransaction()
      await txn.commit()
      await expect(txn.create('User', 'x', {})).rejects.toThrow('Transaction already committed')
      await expect(txn.get('User', 'x')).rejects.toThrow('Transaction already committed')
    })

    it('throws if operations called after rollback', async () => {
      const txn = await provider.beginTransaction()
      await txn.rollback()
      await expect(txn.create('User', 'x', {})).rejects.toThrow('Transaction already rolled back')
    })

    it('throws on update of nonexistent entity', async () => {
      const txn = await provider.beginTransaction()
      await expect(txn.update('User', 'nonexistent', { name: 'X' })).rejects.toThrow(
        'Entity not found'
      )
      await txn.rollback()
    })

    it('returns false on delete of nonexistent entity', async () => {
      const txn = await provider.beginTransaction()
      const result = await txn.delete('User', 'nonexistent')
      expect(result).toBe(false)
      await txn.rollback()
    })
  })

  describe('isolation', () => {
    it('transaction reads see buffered writes from same transaction', async () => {
      const txn = await provider.beginTransaction()

      await txn.create('User', 'alice', { name: 'Alice' })
      const alice = await txn.get('User', 'alice')
      expect(alice).not.toBeNull()
      expect(alice!.name).toBe('Alice')

      await txn.rollback()
    })

    it('transaction reads fall through to provider for non-buffered data', async () => {
      await provider.create('User', 'existing', { name: 'Existing' })

      const txn = await provider.beginTransaction()
      const existing = await txn.get('User', 'existing')
      expect(existing).not.toBeNull()
      expect(existing!.name).toBe('Existing')

      await txn.rollback()
    })

    it('create then update within same transaction works', async () => {
      const txn = await provider.beginTransaction()

      await txn.create('User', 'alice', { name: 'Alice', age: 25 })
      await txn.update('User', 'alice', { age: 30 })

      const alice = await txn.get('User', 'alice')
      expect(alice!.age).toBe(30)

      await txn.commit()

      const committed = await provider.get('User', 'alice')
      expect(committed!.name).toBe('Alice')
      expect(committed!.age).toBe(30)
    })

    it('create then delete within same transaction results in nothing committed', async () => {
      const txn = await provider.beginTransaction()

      await txn.create('User', 'temp', { name: 'Temporary' })
      await txn.delete('User', 'temp')

      // The create op is still in ops list, but delete will run after.
      // Since the entity was created then deleted, the net effect after commit
      // should be that the entity exists then gets deleted.
      await txn.commit()

      expect(await provider.get('User', 'temp')).toBeNull()
    })
  })

  describe('auto-generated IDs', () => {
    it('generates a temporary ID when none provided', async () => {
      const txn = await provider.beginTransaction()
      const result = await txn.create('User', undefined, { name: 'No ID' })
      expect(result.$id).toMatch(/^txn-temp-/)
      await txn.rollback()
    })
  })
})
