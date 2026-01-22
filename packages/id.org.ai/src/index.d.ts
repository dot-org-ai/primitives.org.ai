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
/**
 * Identity - Base interface for all identity types
 *
 * Represents a unique identity in the schema.org.ai system. All identity
 * types ({@link User}, {@link AgentIdentity}) extend this base interface.
 *
 * @see https://schema.org.ai/Identity
 *
 * @example
 * ```typescript
 * const identity: Identity = {
 *   $id: 'https://schema.org.ai/identities/123',
 *   $type: 'https://schema.org.ai/Identity',
 *   createdAt: '2024-01-01T00:00:00Z',
 *   updatedAt: '2024-01-01T00:00:00Z'
 * }
 * ```
 */
export interface Identity {
    /** Unique identifier URI (JSON-LD @id) */
    $id: string;
    /** Type discriminator (JSON-LD @type) */
    $type: 'https://schema.org.ai/Identity';
    /** ISO 8601 timestamp when identity was created */
    createdAt: string;
    /** ISO 8601 timestamp when identity was last updated */
    updatedAt: string;
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
export declare const IdentitySchema: z.ZodObject<{
    $id: z.ZodString;
    $type: z.ZodLiteral<"https://schema.org.ai/Identity">;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    $id: string;
    $type: "https://schema.org.ai/Identity";
    createdAt: string;
    updatedAt: string;
}, {
    $id: string;
    $type: "https://schema.org.ai/Identity";
    createdAt: string;
    updatedAt: string;
}>;
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
export declare function isIdentity(obj: unknown): obj is Identity;
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
export declare function createIdentity(input?: {
    $id?: string;
}): Identity;
/**
 * User - Human user identity
 *
 * Extends the base {@link Identity} interface with human-specific fields
 * such as email, name, and an optional profile for additional metadata.
 *
 * @see https://schema.org.ai/User
 *
 * @example
 * ```typescript
 * const user: User = {
 *   $id: 'https://schema.org.ai/users/123',
 *   $type: 'https://schema.org.ai/User',
 *   email: 'alice@example.com',
 *   name: 'Alice Smith',
 *   profile: { avatar: 'https://example.com/avatar.png' },
 *   createdAt: '2024-01-01T00:00:00Z',
 *   updatedAt: '2024-01-01T00:00:00Z'
 * }
 * ```
 */
export interface User extends Omit<Identity, '$type'> {
    /** Type discriminator for User (JSON-LD @type) */
    $type: 'https://schema.org.ai/User';
    /** User's email address (must be valid email format) */
    email: string;
    /** User's display name */
    name: string;
    /** Optional profile data for additional user information */
    profile?: Record<string, unknown> | undefined;
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
export declare const UserSchema: z.ZodObject<{
    $id: z.ZodString;
    $type: z.ZodLiteral<"https://schema.org.ai/User">;
    email: z.ZodString;
    name: z.ZodString;
    profile: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    $id: string;
    $type: "https://schema.org.ai/User";
    email: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    profile?: Record<string, unknown> | undefined;
}, {
    $id: string;
    $type: "https://schema.org.ai/User";
    email: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    profile?: Record<string, unknown> | undefined;
}>;
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
export declare function isUser(obj: unknown): obj is User;
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
export declare function createUser(input: Omit<User, '$type' | 'createdAt' | 'updatedAt' | '$id'> & {
    $id?: string;
}): User;
/**
 * AgentIdentity - AI agent identity
 *
 * Extends the base {@link Identity} interface with AI agent-specific fields
 * such as model name, capabilities, and autonomy level.
 *
 * @see https://schema.org.ai/AgentIdentity
 *
 * @example
 * ```typescript
 * const agent: AgentIdentity = {
 *   $id: 'https://schema.org.ai/agents/assistant-1',
 *   $type: 'https://schema.org.ai/AgentIdentity',
 *   model: 'claude-3-opus',
 *   capabilities: ['text-generation', 'code-analysis', 'tool-use'],
 *   autonomous: false,
 *   createdAt: '2024-01-01T00:00:00Z',
 *   updatedAt: '2024-01-01T00:00:00Z'
 * }
 * ```
 */
export interface AgentIdentity extends Omit<Identity, '$type'> {
    /** Type discriminator for AgentIdentity (JSON-LD @type) */
    $type: 'https://schema.org.ai/AgentIdentity';
    /** The AI model powering this agent (e.g., 'claude-3-opus', 'gpt-4') */
    model: string;
    /** List of capabilities this agent supports */
    capabilities: string[];
    /** Whether the agent can act autonomously without human approval */
    autonomous: boolean;
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
export declare const AgentIdentitySchema: z.ZodObject<{
    $id: z.ZodString;
    $type: z.ZodLiteral<"https://schema.org.ai/AgentIdentity">;
    model: z.ZodString;
    capabilities: z.ZodArray<z.ZodString, "many">;
    autonomous: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    $id: string;
    $type: "https://schema.org.ai/AgentIdentity";
    createdAt: string;
    updatedAt: string;
    model: string;
    capabilities: string[];
    autonomous: boolean;
}, {
    $id: string;
    $type: "https://schema.org.ai/AgentIdentity";
    createdAt: string;
    updatedAt: string;
    model: string;
    capabilities: string[];
    autonomous: boolean;
}>;
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
export declare function isAgentIdentity(obj: unknown): obj is AgentIdentity;
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
export declare function createAgentIdentity(input: Omit<AgentIdentity, '$type' | 'createdAt' | 'updatedAt' | '$id'> & {
    $id?: string;
}): AgentIdentity;
/**
 * Supported credential types for authentication
 *
 * - `password` - Traditional username/password authentication
 * - `oauth` - OAuth 2.0 / OpenID Connect (Google, GitHub, etc.)
 * - `api_key` - API key authentication for programmatic access
 * - `sso` - Enterprise Single Sign-On (SAML, etc.)
 */
export type CredentialType = 'password' | 'oauth' | 'api_key' | 'sso';
/**
 * Credential - Authentication credential for an identity
 *
 * Represents an authentication method associated with an {@link Identity}.
 * Each identity can have multiple credentials of different types.
 *
 * Note: This stores credential metadata, NOT the actual secret values.
 * Secret handling should be done through a secure credential store.
 *
 * @see https://schema.org.ai/Credential
 *
 * @example
 * ```typescript
 * const credential: Credential = {
 *   $id: 'https://schema.org.ai/credentials/cred-123',
 *   $type: 'https://schema.org.ai/Credential',
 *   identityId: 'https://schema.org.ai/users/user-456',
 *   credentialType: 'oauth',
 *   provider: 'google',
 *   expiresAt: '2024-12-31T23:59:59Z'
 * }
 * ```
 */
export interface Credential {
    /** Unique identifier URI (JSON-LD @id) */
    $id: string;
    /** Type discriminator (JSON-LD @type) */
    $type: 'https://schema.org.ai/Credential';
    /** Reference to the identity this credential belongs to */
    identityId: string;
    /** The type of credential (password, oauth, api_key, sso) */
    credentialType: CredentialType;
    /** OAuth/SSO provider name (e.g., 'google', 'github', 'okta') */
    provider?: string | undefined;
    /** ISO 8601 timestamp when the credential expires (if applicable) */
    expiresAt?: string | undefined;
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
export declare const CredentialSchema: z.ZodObject<{
    $id: z.ZodString;
    $type: z.ZodLiteral<"https://schema.org.ai/Credential">;
    identityId: z.ZodString;
    credentialType: z.ZodEnum<["password", "oauth", "api_key", "sso"]>;
    provider: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    $id: string;
    $type: "https://schema.org.ai/Credential";
    identityId: string;
    credentialType: "password" | "api_key" | "oauth" | "sso";
    provider?: string | undefined;
    expiresAt?: string | undefined;
}, {
    $id: string;
    $type: "https://schema.org.ai/Credential";
    identityId: string;
    credentialType: "password" | "api_key" | "oauth" | "sso";
    provider?: string | undefined;
    expiresAt?: string | undefined;
}>;
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
export declare function isCredential(obj: unknown): obj is Credential;
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
export declare function createCredential(input: Omit<Credential, '$type' | '$id'> & {
    $id?: string;
}): Credential;
/**
 * Session - Active authentication session
 *
 * Represents an authenticated session for an {@link Identity}. Sessions have
 * a secure token and an expiration time. Use {@link isSessionExpired} to check
 * if a session is still valid.
 *
 * @see https://schema.org.ai/Session
 *
 * @example
 * ```typescript
 * const session: Session = {
 *   $id: 'https://schema.org.ai/sessions/sess-123',
 *   $type: 'https://schema.org.ai/Session',
 *   identityId: 'https://schema.org.ai/users/user-456',
 *   token: 'a1b2c3d4e5f6...',
 *   expiresAt: '2024-01-02T00:00:00Z',
 *   metadata: { userAgent: 'Mozilla/5.0...', ip: '192.168.1.1' }
 * }
 * ```
 */
export interface Session {
    /** Unique identifier URI (JSON-LD @id) */
    $id: string;
    /** Type discriminator (JSON-LD @type) */
    $type: 'https://schema.org.ai/Session';
    /** Reference to the authenticated identity */
    identityId: string;
    /** Secure session token (auto-generated if not provided) */
    token: string;
    /** ISO 8601 timestamp when the session expires */
    expiresAt: string;
    /** Optional metadata about the session (user agent, IP, etc.) */
    metadata?: Record<string, unknown> | undefined;
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
export declare const SessionSchema: z.ZodObject<{
    $id: z.ZodString;
    $type: z.ZodLiteral<"https://schema.org.ai/Session">;
    identityId: z.ZodString;
    token: z.ZodString;
    expiresAt: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    $id: string;
    $type: "https://schema.org.ai/Session";
    token: string;
    expiresAt: string;
    identityId: string;
    metadata?: Record<string, unknown> | undefined;
}, {
    $id: string;
    $type: "https://schema.org.ai/Session";
    token: string;
    expiresAt: string;
    identityId: string;
    metadata?: Record<string, unknown> | undefined;
}>;
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
export declare function isSession(obj: unknown): obj is Session;
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
export declare function createSession(input: Omit<Session, '$type' | '$id' | 'token' | 'expiresAt'> & {
    $id?: string;
    token?: string;
    expiresAt?: string;
}): Session;
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
export declare function isSessionExpired(session: Session): boolean;
//# sourceMappingURL=index.d.ts.map