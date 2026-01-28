/**
 * Tests for identity utilities re-exported from id.org.ai
 *
 * Tests the Identity, User, AgentIdentity, Credential, and Session types
 * along with their type guards, factory functions, and schemas.
 */

import { describe, it, expect, beforeEach } from 'vitest'

// Import from org.ai/identity which re-exports from id.org.ai
import {
  // Types
  type Identity,
  type User,
  type AgentIdentity,
  type Credential,
  type CredentialType,
  type Session,
  // Schemas
  IdentitySchema,
  UserSchema,
  AgentIdentitySchema,
  CredentialSchema,
  SessionSchema,
  // Type guards
  isIdentity,
  isUser,
  isAgentIdentity,
  isCredential,
  isSession,
  isSessionExpired,
  // Factory functions
  createIdentity,
  createUser,
  createAgentIdentity,
  createCredential,
  createSession,
} from '../src/identity.js'

describe('Identity Types - id.org.ai re-exports', () => {
  // ==========================================================================
  // Identity Tests
  // ==========================================================================
  describe('Identity', () => {
    it('creates a basic identity with auto-generated $id', () => {
      const identity = createIdentity()

      expect(identity.$id).toMatch(/^https:\/\/schema\.org\.ai\/identities\//)
      expect(identity.$type).toBe('https://schema.org.ai/Identity')
      expect(identity.createdAt).toBeDefined()
      expect(identity.updatedAt).toBeDefined()
    })

    it('creates identity with custom $id', () => {
      const customId = 'https://example.com/identities/custom-123'
      const identity = createIdentity({ $id: customId })

      expect(identity.$id).toBe(customId)
    })

    it('validates identity with IdentitySchema', () => {
      const identity = createIdentity()
      const result = IdentitySchema.safeParse(identity)

      expect(result.success).toBe(true)
    })

    it('isIdentity returns true for valid identity', () => {
      const identity = createIdentity()
      expect(isIdentity(identity)).toBe(true)
    })

    it('isIdentity returns false for invalid objects', () => {
      expect(isIdentity(null)).toBe(false)
      expect(isIdentity(undefined)).toBe(false)
      expect(isIdentity({})).toBe(false)
      expect(isIdentity({ $id: 'test' })).toBe(false)
    })
  })

  // ==========================================================================
  // User Tests
  // ==========================================================================
  describe('User', () => {
    it('creates a user with required fields', () => {
      const user = createUser({
        email: 'alice@example.com',
        name: 'Alice',
      })

      expect(user.$id).toMatch(/^https:\/\/schema\.org\.ai\/users\//)
      expect(user.$type).toBe('https://schema.org.ai/User')
      expect(user.email).toBe('alice@example.com')
      expect(user.name).toBe('Alice')
      expect(user.createdAt).toBeDefined()
      expect(user.updatedAt).toBeDefined()
    })

    it('creates user with custom $id', () => {
      const user = createUser({
        $id: 'https://myapp.com/users/alice',
        email: 'alice@example.com',
        name: 'Alice',
      })

      expect(user.$id).toBe('https://myapp.com/users/alice')
    })

    it('creates user with profile data', () => {
      const user = createUser({
        email: 'bob@example.com',
        name: 'Bob',
        profile: {
          avatar: 'https://example.com/avatar.png',
          bio: 'Software developer',
        },
      })

      expect(user.profile).toEqual({
        avatar: 'https://example.com/avatar.png',
        bio: 'Software developer',
      })
    })

    it('validates user with UserSchema', () => {
      const user = createUser({
        email: 'test@example.com',
        name: 'Test User',
      })
      const result = UserSchema.safeParse(user)

      expect(result.success).toBe(true)
    })

    it('UserSchema rejects invalid email', () => {
      const invalidUser = {
        $id: 'https://example.com/users/1',
        $type: 'https://schema.org.ai/User',
        email: 'not-an-email',
        name: 'Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const result = UserSchema.safeParse(invalidUser)

      expect(result.success).toBe(false)
    })

    it('isUser returns true for valid user', () => {
      const user = createUser({
        email: 'test@example.com',
        name: 'Test',
      })
      expect(isUser(user)).toBe(true)
    })

    it('isUser returns false for identity (not user)', () => {
      const identity = createIdentity()
      expect(isUser(identity)).toBe(false)
    })
  })

  // ==========================================================================
  // AgentIdentity Tests
  // ==========================================================================
  describe('AgentIdentity', () => {
    it('creates an agent identity with required fields', () => {
      const agent = createAgentIdentity({
        model: 'claude-3-opus',
        capabilities: ['text-generation', 'code-analysis'],
        autonomous: false,
      })

      expect(agent.$id).toMatch(/^https:\/\/schema\.org\.ai\/agents\//)
      expect(agent.$type).toBe('https://schema.org.ai/AgentIdentity')
      expect(agent.model).toBe('claude-3-opus')
      expect(agent.capabilities).toEqual(['text-generation', 'code-analysis'])
      expect(agent.autonomous).toBe(false)
    })

    it('creates autonomous agent', () => {
      const agent = createAgentIdentity({
        model: 'claude-3-haiku',
        capabilities: ['task-execution'],
        autonomous: true,
      })

      expect(agent.autonomous).toBe(true)
    })

    it('creates agent with custom $id', () => {
      const agent = createAgentIdentity({
        $id: 'https://myapp.com/agents/worker-1',
        model: 'gpt-4',
        capabilities: ['coding'],
        autonomous: true,
      })

      expect(agent.$id).toBe('https://myapp.com/agents/worker-1')
    })

    it('validates agent with AgentIdentitySchema', () => {
      const agent = createAgentIdentity({
        model: 'claude-3-opus',
        capabilities: [],
        autonomous: false,
      })
      const result = AgentIdentitySchema.safeParse(agent)

      expect(result.success).toBe(true)
    })

    it('isAgentIdentity returns true for valid agent', () => {
      const agent = createAgentIdentity({
        model: 'test-model',
        capabilities: [],
        autonomous: false,
      })
      expect(isAgentIdentity(agent)).toBe(true)
    })

    it('isAgentIdentity returns false for user', () => {
      const user = createUser({
        email: 'test@example.com',
        name: 'Test',
      })
      expect(isAgentIdentity(user)).toBe(false)
    })
  })

  // ==========================================================================
  // Credential Tests
  // ==========================================================================
  describe('Credential', () => {
    it('creates a password credential', () => {
      const cred = createCredential({
        identityId: 'https://schema.org.ai/users/123',
        credentialType: 'password',
      })

      expect(cred.$id).toMatch(/^https:\/\/schema\.org\.ai\/credentials\//)
      expect(cred.$type).toBe('https://schema.org.ai/Credential')
      expect(cred.identityId).toBe('https://schema.org.ai/users/123')
      expect(cred.credentialType).toBe('password')
    })

    it('creates an OAuth credential with provider', () => {
      const cred = createCredential({
        identityId: 'https://schema.org.ai/users/456',
        credentialType: 'oauth',
        provider: 'google',
        expiresAt: '2024-12-31T23:59:59Z',
      })

      expect(cred.credentialType).toBe('oauth')
      expect(cred.provider).toBe('google')
      expect(cred.expiresAt).toBe('2024-12-31T23:59:59Z')
    })

    it('creates an API key credential', () => {
      const cred = createCredential({
        identityId: 'https://schema.org.ai/agents/worker-1',
        credentialType: 'api_key',
      })

      expect(cred.credentialType).toBe('api_key')
    })

    it('creates an SSO credential', () => {
      const cred = createCredential({
        identityId: 'https://schema.org.ai/users/789',
        credentialType: 'sso',
        provider: 'okta',
      })

      expect(cred.credentialType).toBe('sso')
      expect(cred.provider).toBe('okta')
    })

    it('validates credential with CredentialSchema', () => {
      const cred = createCredential({
        identityId: 'https://example.com/users/1',
        credentialType: 'password',
      })
      const result = CredentialSchema.safeParse(cred)

      expect(result.success).toBe(true)
    })

    it('isCredential returns true for valid credential', () => {
      const cred = createCredential({
        identityId: 'https://example.com/users/1',
        credentialType: 'password',
      })
      expect(isCredential(cred)).toBe(true)
    })

    it('isCredential returns false for invalid objects', () => {
      expect(isCredential(null)).toBe(false)
      expect(isCredential({})).toBe(false)
      expect(isCredential({ credentialType: 'password' })).toBe(false)
    })
  })

  // ==========================================================================
  // Session Tests
  // ==========================================================================
  describe('Session', () => {
    it('creates a session with default token and expiration', () => {
      const session = createSession({
        identityId: 'https://schema.org.ai/users/123',
      })

      expect(session.$id).toMatch(/^https:\/\/schema\.org\.ai\/sessions\//)
      expect(session.$type).toBe('https://schema.org.ai/Session')
      expect(session.identityId).toBe('https://schema.org.ai/users/123')
      expect(session.token).toBeDefined()
      expect(session.token.length).toBeGreaterThan(0)
      expect(session.expiresAt).toBeDefined()
    })

    it('creates session with custom token', () => {
      const customToken = 'custom-token-12345'
      const session = createSession({
        identityId: 'https://schema.org.ai/users/123',
        token: customToken,
      })

      expect(session.token).toBe(customToken)
    })

    it('creates session with custom expiration', () => {
      const expiresAt = '2024-06-01T00:00:00Z'
      const session = createSession({
        identityId: 'https://schema.org.ai/users/123',
        expiresAt,
      })

      expect(session.expiresAt).toBe(expiresAt)
    })

    it('creates session with metadata', () => {
      const session = createSession({
        identityId: 'https://schema.org.ai/users/123',
        metadata: {
          userAgent: 'Mozilla/5.0',
          ip: '192.168.1.1',
        },
      })

      expect(session.metadata).toEqual({
        userAgent: 'Mozilla/5.0',
        ip: '192.168.1.1',
      })
    })

    it('validates session with SessionSchema', () => {
      const session = createSession({
        identityId: 'https://example.com/users/1',
      })
      const result = SessionSchema.safeParse(session)

      expect(result.success).toBe(true)
    })

    it('isSession returns true for valid session', () => {
      const session = createSession({
        identityId: 'https://example.com/users/1',
      })
      expect(isSession(session)).toBe(true)
    })

    it('isSession returns false for invalid objects', () => {
      expect(isSession(null)).toBe(false)
      expect(isSession({})).toBe(false)
    })

    it('isSessionExpired returns true for expired session', () => {
      const session = createSession({
        identityId: 'https://example.com/users/1',
        expiresAt: '2020-01-01T00:00:00Z', // Past date
      })

      expect(isSessionExpired(session)).toBe(true)
    })

    it('isSessionExpired returns false for valid session', () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      const session = createSession({
        identityId: 'https://example.com/users/1',
        expiresAt: futureDate,
      })

      expect(isSessionExpired(session)).toBe(false)
    })
  })
})
