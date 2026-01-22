/**
 * @packageDocumentation
 * @module id.org.ai
 *
 * Identity primitives for schema.org.ai
 *
 * This package provides identity types for humans and AI agents:
 * - {@link Identity} - Base identity interface
 * - {@link User} - Human user identity
 * - {@link AgentIdentity} - AI agent identity
 * - {@link Credential} - Authentication credentials
 * - {@link Session} - Active sessions
 *
 * All types follow JSON-LD conventions with `$id` and `$type` fields.
 *
 * @example
 * ```typescript
 * import { createUser, isUser, UserSchema } from 'id.org.ai'
 *
 * const user = createUser({
 *   email: 'alice@example.com',
 *   name: 'Alice'
 * })
 *
 * // Runtime validation
 * if (isUser(unknownData)) {
 *   console.log(unknownData.email)
 * }
 *
 * // Schema validation
 * const result = UserSchema.safeParse(data)
 * ```
 *
 * @version 0.1.0
 */
import { z } from 'zod';
// === Internal Helpers ===
/**
 * Generates a unique identifier URI for a given resource type
 * @internal
 */
function generateId(prefix) {
    const uuid = crypto.randomUUID();
    return `https://schema.org.ai/${prefix}/${uuid}`;
}
/**
 * Generates a secure random token for session authentication
 * @internal
 */
function generateToken() {
    return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}
/**
 * Zod schema for validating Identity objects
 *
 * Use this schema for runtime validation of identity data.
 *
 * @see {@link Identity}
 *
 * @example
 * ```typescript
 * const result = IdentitySchema.safeParse(unknownData)
 * if (result.success) {
 *   console.log(result.data.$id)
 * } else {
 *   console.error(result.error)
 * }
 * ```
 */
export const IdentitySchema = z.object({
    $id: z.string(),
    $type: z.literal('https://schema.org.ai/Identity'),
    createdAt: z.string(),
    updatedAt: z.string(),
});
/**
 * Type guard to check if an object is a valid Identity
 *
 * Uses Zod schema validation internally to ensure type safety.
 *
 * @param obj - Object to validate
 * @returns True if the object is a valid Identity
 *
 * @example
 * ```typescript
 * const data: unknown = fetchFromAPI()
 * if (isIdentity(data)) {
 *   // TypeScript knows data is Identity
 *   console.log(data.createdAt)
 * }
 * ```
 */
export function isIdentity(obj) {
    return IdentitySchema.safeParse(obj).success;
}
/**
 * Factory function to create a new Identity
 *
 * Creates a complete Identity object with auto-generated `$id` (if not provided)
 * and timestamps. The `$type` is always set to the correct JSON-LD type.
 *
 * @param input - Optional partial identity data
 * @param input.$id - Custom identifier URI (auto-generated if not provided)
 * @returns A complete Identity object with all required fields
 *
 * @example
 * ```typescript
 * // Auto-generate all fields
 * const identity = createIdentity()
 *
 * // With custom $id
 * const identity = createIdentity({ $id: 'https://example.com/id/custom' })
 * ```
 */
export function createIdentity(input) {
    const now = new Date().toISOString();
    return {
        $id: input?.$id ?? generateId('identities'),
        $type: 'https://schema.org.ai/Identity',
        createdAt: now,
        updatedAt: now,
    };
}
/**
 * Zod schema for validating User objects
 *
 * Validates all User fields including email format validation.
 *
 * @see {@link User}
 *
 * @example
 * ```typescript
 * const result = UserSchema.safeParse({
 *   $id: 'https://example.com/users/1',
 *   $type: 'https://schema.org.ai/User',
 *   email: 'alice@example.com',
 *   name: 'Alice',
 *   createdAt: new Date().toISOString(),
 *   updatedAt: new Date().toISOString()
 * })
 *
 * if (!result.success) {
 *   console.error('Invalid email:', result.error.issues)
 * }
 * ```
 */
export const UserSchema = z.object({
    $id: z.string(),
    $type: z.literal('https://schema.org.ai/User'),
    email: z.string().email(),
    name: z.string(),
    profile: z.record(z.unknown()).optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
/**
 * Type guard to check if an object is a valid User
 *
 * Uses Zod schema validation internally including email format validation.
 *
 * @param obj - Object to validate
 * @returns True if the object is a valid User
 *
 * @example
 * ```typescript
 * const data: unknown = await fetchUser(id)
 * if (isUser(data)) {
 *   // TypeScript knows data is User
 *   sendEmail(data.email, `Hello ${data.name}!`)
 * }
 * ```
 */
export function isUser(obj) {
    return UserSchema.safeParse(obj).success;
}
/**
 * Factory function to create a new User
 *
 * Creates a complete User object with auto-generated `$id` (if not provided),
 * timestamps, and the correct `$type`. Email and name are required.
 *
 * @param input - User data (email and name required)
 * @param input.email - User's email address
 * @param input.name - User's display name
 * @param input.$id - Custom identifier URI (auto-generated if not provided)
 * @param input.profile - Optional profile metadata
 * @returns A complete User object ready for storage
 *
 * @example
 * ```typescript
 * // Basic user creation
 * const user = createUser({
 *   email: 'alice@example.com',
 *   name: 'Alice Smith'
 * })
 *
 * // With profile data
 * const user = createUser({
 *   email: 'bob@example.com',
 *   name: 'Bob Jones',
 *   profile: {
 *     avatar: 'https://example.com/bob.png',
 *     bio: 'Software developer',
 *     settings: { theme: 'dark' }
 *   }
 * })
 *
 * // With custom $id
 * const user = createUser({
 *   $id: 'https://myapp.com/users/alice',
 *   email: 'alice@example.com',
 *   name: 'Alice'
 * })
 * ```
 */
export function createUser(input) {
    const now = new Date().toISOString();
    return {
        $id: input.$id ?? generateId('users'),
        $type: 'https://schema.org.ai/User',
        email: input.email,
        name: input.name,
        profile: input.profile,
        createdAt: now,
        updatedAt: now,
    };
}
/**
 * Zod schema for validating AgentIdentity objects
 *
 * Validates all AgentIdentity fields including model, capabilities array,
 * and autonomous flag.
 *
 * @see {@link AgentIdentity}
 *
 * @example
 * ```typescript
 * const result = AgentIdentitySchema.safeParse(agentData)
 * if (result.success) {
 *   const agent = result.data
 *   if (agent.autonomous) {
 *     console.log('Agent can act independently')
 *   }
 * }
 * ```
 */
export const AgentIdentitySchema = z.object({
    $id: z.string(),
    $type: z.literal('https://schema.org.ai/AgentIdentity'),
    model: z.string(),
    capabilities: z.array(z.string()),
    autonomous: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
});
/**
 * Type guard to check if an object is a valid AgentIdentity
 *
 * Uses Zod schema validation internally to ensure type safety.
 *
 * @param obj - Object to validate
 * @returns True if the object is a valid AgentIdentity
 *
 * @example
 * ```typescript
 * const identity: unknown = getIdentity(id)
 * if (isAgentIdentity(identity)) {
 *   // TypeScript knows identity is AgentIdentity
 *   console.log(`Agent model: ${identity.model}`)
 *   console.log(`Capabilities: ${identity.capabilities.join(', ')}`)
 * }
 * ```
 */
export function isAgentIdentity(obj) {
    return AgentIdentitySchema.safeParse(obj).success;
}
/**
 * Factory function to create a new AgentIdentity
 *
 * Creates a complete AgentIdentity object with auto-generated `$id` (if not provided),
 * timestamps, and the correct `$type`. Model, capabilities, and autonomous flag are required.
 *
 * @param input - Agent identity data
 * @param input.model - The AI model name (e.g., 'claude-3-opus')
 * @param input.capabilities - Array of capability strings
 * @param input.autonomous - Whether the agent can act autonomously
 * @param input.$id - Custom identifier URI (auto-generated if not provided)
 * @returns A complete AgentIdentity object ready for storage
 *
 * @example
 * ```typescript
 * // Create a supervised agent
 * const assistant = createAgentIdentity({
 *   model: 'claude-3-opus',
 *   capabilities: ['text-generation', 'code-analysis'],
 *   autonomous: false
 * })
 *
 * // Create an autonomous agent
 * const worker = createAgentIdentity({
 *   model: 'claude-3-haiku',
 *   capabilities: ['task-execution', 'tool-use'],
 *   autonomous: true
 * })
 *
 * // With custom $id
 * const namedAgent = createAgentIdentity({
 *   $id: 'https://myapp.com/agents/ralph',
 *   model: 'claude-3-opus',
 *   capabilities: ['coding', 'review'],
 *   autonomous: true
 * })
 * ```
 */
export function createAgentIdentity(input) {
    const now = new Date().toISOString();
    return {
        $id: input.$id ?? generateId('agents'),
        $type: 'https://schema.org.ai/AgentIdentity',
        model: input.model,
        capabilities: input.capabilities,
        autonomous: input.autonomous,
        createdAt: now,
        updatedAt: now,
    };
}
/**
 * Zod schema for validating Credential objects
 *
 * Validates credential type as one of the allowed enum values.
 *
 * @see {@link Credential}
 * @see {@link CredentialType}
 *
 * @example
 * ```typescript
 * const result = CredentialSchema.safeParse(credentialData)
 * if (result.success) {
 *   const cred = result.data
 *   if (cred.credentialType === 'oauth' && cred.provider) {
 *     console.log(`OAuth via ${cred.provider}`)
 *   }
 * }
 * ```
 */
export const CredentialSchema = z.object({
    $id: z.string(),
    $type: z.literal('https://schema.org.ai/Credential'),
    identityId: z.string(),
    credentialType: z.enum(['password', 'oauth', 'api_key', 'sso']),
    provider: z.string().optional(),
    expiresAt: z.string().optional(),
});
/**
 * Type guard to check if an object is a valid Credential
 *
 * Uses Zod schema validation internally to ensure type safety.
 *
 * @param obj - Object to validate
 * @returns True if the object is a valid Credential
 *
 * @example
 * ```typescript
 * const data: unknown = await getCredential(id)
 * if (isCredential(data)) {
 *   // TypeScript knows data is Credential
 *   console.log(`Credential type: ${data.credentialType}`)
 *   if (data.expiresAt) {
 *     console.log(`Expires: ${data.expiresAt}`)
 *   }
 * }
 * ```
 */
export function isCredential(obj) {
    return CredentialSchema.safeParse(obj).success;
}
/**
 * Factory function to create a new Credential
 *
 * Creates a complete Credential object with auto-generated `$id` (if not provided)
 * and the correct `$type`. The identityId and credentialType are required.
 *
 * @param input - Credential data
 * @param input.identityId - Reference to the owning identity
 * @param input.credentialType - Type of credential (password, oauth, api_key, sso)
 * @param input.$id - Custom identifier URI (auto-generated if not provided)
 * @param input.provider - OAuth/SSO provider name (optional)
 * @param input.expiresAt - Expiration timestamp (optional)
 * @returns A complete Credential object ready for storage
 *
 * @example
 * ```typescript
 * // Password credential (never expires)
 * const passwordCred = createCredential({
 *   identityId: 'https://schema.org.ai/users/123',
 *   credentialType: 'password'
 * })
 *
 * // OAuth credential with expiration
 * const oauthCred = createCredential({
 *   identityId: 'https://schema.org.ai/users/123',
 *   credentialType: 'oauth',
 *   provider: 'google',
 *   expiresAt: '2024-12-31T23:59:59Z'
 * })
 *
 * // API key for programmatic access
 * const apiKeyCred = createCredential({
 *   identityId: 'https://schema.org.ai/agents/worker-1',
 *   credentialType: 'api_key'
 * })
 * ```
 */
export function createCredential(input) {
    return {
        $id: input.$id ?? generateId('credentials'),
        $type: 'https://schema.org.ai/Credential',
        identityId: input.identityId,
        credentialType: input.credentialType,
        provider: input.provider,
        expiresAt: input.expiresAt,
    };
}
/**
 * Zod schema for validating Session objects
 *
 * Validates all Session fields including non-empty token requirement.
 *
 * @see {@link Session}
 *
 * @example
 * ```typescript
 * const result = SessionSchema.safeParse(sessionData)
 * if (result.success) {
 *   const session = result.data
 *   // Use the validated session
 * } else {
 *   console.error('Invalid session:', result.error.issues)
 * }
 * ```
 */
export const SessionSchema = z.object({
    $id: z.string(),
    $type: z.literal('https://schema.org.ai/Session'),
    identityId: z.string(),
    token: z.string().min(1),
    expiresAt: z.string(),
    metadata: z.record(z.unknown()).optional(),
});
/**
 * Type guard to check if an object is a valid Session
 *
 * Uses Zod schema validation internally to ensure type safety.
 * Note: This only validates structure, not expiration. Use {@link isSessionExpired}
 * to check if a session has expired.
 *
 * @param obj - Object to validate
 * @returns True if the object is a valid Session
 *
 * @example
 * ```typescript
 * const data: unknown = await getSession(token)
 * if (isSession(data)) {
 *   // TypeScript knows data is Session
 *   if (!isSessionExpired(data)) {
 *     console.log(`Session valid until: ${data.expiresAt}`)
 *   }
 * }
 * ```
 */
export function isSession(obj) {
    return SessionSchema.safeParse(obj).success;
}
/**
 * Factory function to create a new Session
 *
 * Creates a complete Session object with auto-generated `$id`, `token`, and
 * `expiresAt` (24 hours from now) if not provided. Only `identityId` is required.
 *
 * @param input - Session data
 * @param input.identityId - Reference to the authenticated identity
 * @param input.$id - Custom identifier URI (auto-generated if not provided)
 * @param input.token - Custom session token (auto-generated if not provided)
 * @param input.expiresAt - Custom expiration (defaults to 24 hours from now)
 * @param input.metadata - Optional session metadata
 * @returns A complete Session object ready for storage
 *
 * @example
 * ```typescript
 * // Basic session with defaults (24h expiry, auto-generated token)
 * const session = createSession({
 *   identityId: 'https://schema.org.ai/users/123'
 * })
 *
 * // Session with custom expiration
 * const shortSession = createSession({
 *   identityId: 'https://schema.org.ai/users/123',
 *   expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
 * })
 *
 * // Session with metadata
 * const trackedSession = createSession({
 *   identityId: 'https://schema.org.ai/users/123',
 *   metadata: {
 *     userAgent: 'Mozilla/5.0...',
 *     ip: '192.168.1.1',
 *     device: 'desktop'
 *   }
 * })
 * ```
 */
export function createSession(input) {
    // Default expiration: 24 hours from now
    const defaultExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return {
        $id: input.$id ?? generateId('sessions'),
        $type: 'https://schema.org.ai/Session',
        identityId: input.identityId,
        token: input.token ?? generateToken(),
        expiresAt: input.expiresAt ?? defaultExpiresAt,
        metadata: input.metadata,
    };
}
/**
 * Check if a session has expired
 *
 * Compares the session's `expiresAt` timestamp against the current time.
 *
 * @param session - The session to check
 * @returns True if the session has expired (expiresAt is in the past)
 *
 * @example
 * ```typescript
 * const session = await getSession(token)
 * if (isSession(session)) {
 *   if (isSessionExpired(session)) {
 *     // Redirect to login
 *     throw new Error('Session expired')
 *   }
 *   // Continue with authenticated request
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Clean up expired sessions
 * const sessions = await getAllSessions()
 * const activeSessions = sessions.filter(s => !isSessionExpired(s))
 * const expiredSessions = sessions.filter(isSessionExpired)
 * ```
 */
export function isSessionExpired(session) {
    return new Date(session.expiresAt).getTime() < Date.now();
}
//# sourceMappingURL=index.js.map