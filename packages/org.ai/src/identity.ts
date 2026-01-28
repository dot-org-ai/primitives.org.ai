/**
 * Identity utilities from id.org.ai
 *
 * Provides identity management for users and AI agents following
 * MDXLD conventions with $id and $type fields.
 *
 * @example
 * ```ts
 * import { createUser, createAgentIdentity, createSession } from 'org.ai/identity'
 *
 * const user = createUser({ email: 'alice@example.com', name: 'Alice' })
 * const agent = createAgentIdentity({ model: 'claude-3-opus', capabilities: ['coding'], autonomous: true })
 * const session = createSession({ identityId: user.$id })
 * ```
 */
export * from 'id.org.ai'
