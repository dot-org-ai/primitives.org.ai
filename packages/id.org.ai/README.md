# id.org.ai

Identity primitives for AI systems following [schema.org.ai](https://schema.org.ai) conventions.

## Overview

`id.org.ai` provides type-safe identity management for both humans and AI agents. All types follow JSON-LD conventions with `$id` and `$type` fields, enabling interoperability with semantic web standards.

## Installation

```bash
npm install id.org.ai
```

```bash
pnpm add id.org.ai
```

```bash
yarn add id.org.ai
```

## Features

- **Type-safe identity primitives** for humans (User) and AI agents (AgentIdentity)
- **Runtime validation** using Zod schemas
- **Type guards** for safe type narrowing
- **Factory functions** with auto-generated IDs and timestamps
- **Session management** with expiration handling
- **Credential types** for multiple authentication methods

## Usage

### Creating Users

```typescript
import { createUser, isUser, UserSchema } from 'id.org.ai'

// Create a new user with auto-generated ID and timestamps
const user = createUser({
  email: 'alice@example.com',
  name: 'Alice Smith'
})

// With optional profile data
const userWithProfile = createUser({
  email: 'bob@example.com',
  name: 'Bob Jones',
  profile: {
    avatar: 'https://example.com/bob.png',
    bio: 'Software developer',
    settings: { theme: 'dark' }
  }
})

// With custom $id
const customUser = createUser({
  $id: 'https://myapp.com/users/alice',
  email: 'alice@example.com',
  name: 'Alice'
})
```

### Creating AI Agent Identities

```typescript
import { createAgentIdentity, isAgentIdentity } from 'id.org.ai'

// Create a supervised agent
const assistant = createAgentIdentity({
  model: 'claude-3-opus',
  capabilities: ['text-generation', 'code-analysis'],
  autonomous: false
})

// Create an autonomous agent
const worker = createAgentIdentity({
  model: 'claude-3-haiku',
  capabilities: ['task-execution', 'tool-use'],
  autonomous: true
})
```

### Managing Sessions

```typescript
import { createSession, isSession, isSessionExpired } from 'id.org.ai'

// Create a session with defaults (24h expiry, auto-generated token)
const session = createSession({
  identityId: 'https://schema.org.ai/users/123'
})

// Create a session with custom expiration
const shortSession = createSession({
  identityId: 'https://schema.org.ai/users/123',
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour
})

// Create a session with metadata
const trackedSession = createSession({
  identityId: 'https://schema.org.ai/users/123',
  metadata: {
    userAgent: 'Mozilla/5.0...',
    ip: '192.168.1.1',
    device: 'desktop'
  }
})

// Check if session is expired
if (isSessionExpired(session)) {
  console.log('Session has expired')
}
```

### Managing Credentials

```typescript
import { createCredential, isCredential } from 'id.org.ai'

// Password credential
const passwordCred = createCredential({
  identityId: 'https://schema.org.ai/users/123',
  credentialType: 'password'
})

// OAuth credential with expiration
const oauthCred = createCredential({
  identityId: 'https://schema.org.ai/users/123',
  credentialType: 'oauth',
  provider: 'google',
  expiresAt: '2024-12-31T23:59:59Z'
})

// API key for programmatic access
const apiKeyCred = createCredential({
  identityId: 'https://schema.org.ai/agents/worker-1',
  credentialType: 'api_key'
})
```

### Runtime Validation

```typescript
import { UserSchema, isUser, isAgentIdentity } from 'id.org.ai'

// Using Zod schema for validation
const result = UserSchema.safeParse(unknownData)
if (result.success) {
  console.log(result.data.email)
} else {
  console.error(result.error.issues)
}

// Using type guards
function handleIdentity(data: unknown) {
  if (isUser(data)) {
    // TypeScript knows data is User
    console.log(`User: ${data.name} <${data.email}>`)
  } else if (isAgentIdentity(data)) {
    // TypeScript knows data is AgentIdentity
    console.log(`Agent: ${data.model} (autonomous: ${data.autonomous})`)
  }
}
```

## API Reference

### Types

#### `Identity`

Base interface for all identity types.

```typescript
interface Identity {
  $id: string              // Unique identifier URI (JSON-LD @id)
  $type: string            // Type discriminator (JSON-LD @type)
  createdAt: string        // ISO 8601 timestamp
  updatedAt: string        // ISO 8601 timestamp
}
```

#### `User`

Human user identity extending `Identity`.

```typescript
interface User extends Identity {
  $type: 'https://schema.org.ai/User'
  email: string                           // Valid email address
  name: string                            // Display name
  profile?: Record<string, unknown>       // Optional profile data
}
```

#### `AgentIdentity`

AI agent identity extending `Identity`.

```typescript
interface AgentIdentity extends Identity {
  $type: 'https://schema.org.ai/AgentIdentity'
  model: string            // AI model name (e.g., 'claude-3-opus')
  capabilities: string[]   // List of supported capabilities
  autonomous: boolean      // Can act without human approval
}
```

#### `Credential`

Authentication credential for an identity.

```typescript
interface Credential {
  $id: string
  $type: 'https://schema.org.ai/Credential'
  identityId: string                      // Reference to owning identity
  credentialType: CredentialType          // 'password' | 'oauth' | 'api_key' | 'sso'
  provider?: string                       // OAuth/SSO provider name
  expiresAt?: string                      // ISO 8601 expiration timestamp
}
```

#### `Session`

Active authentication session.

```typescript
interface Session {
  $id: string
  $type: 'https://schema.org.ai/Session'
  identityId: string                      // Reference to authenticated identity
  token: string                           // Secure session token
  expiresAt: string                       // ISO 8601 expiration timestamp
  metadata?: Record<string, unknown>      // Optional session metadata
}
```

### Factory Functions

| Function | Description |
|----------|-------------|
| `createIdentity(input?)` | Create a base Identity with auto-generated ID and timestamps |
| `createUser(input)` | Create a User with email, name, and optional profile |
| `createAgentIdentity(input)` | Create an AgentIdentity with model, capabilities, and autonomy flag |
| `createCredential(input)` | Create a Credential linked to an identity |
| `createSession(input)` | Create a Session with auto-generated token (defaults to 24h expiry) |

### Type Guards

| Function | Description |
|----------|-------------|
| `isIdentity(obj)` | Check if object is a valid Identity |
| `isUser(obj)` | Check if object is a valid User |
| `isAgentIdentity(obj)` | Check if object is a valid AgentIdentity |
| `isCredential(obj)` | Check if object is a valid Credential |
| `isSession(obj)` | Check if object is a valid Session |
| `isSessionExpired(session)` | Check if a Session has expired |

### Zod Schemas

| Schema | Description |
|--------|-------------|
| `IdentitySchema` | Zod schema for validating Identity objects |
| `UserSchema` | Zod schema for validating User objects (includes email validation) |
| `AgentIdentitySchema` | Zod schema for validating AgentIdentity objects |
| `CredentialSchema` | Zod schema for validating Credential objects |
| `SessionSchema` | Zod schema for validating Session objects |

## JSON-LD Compatibility

All types use JSON-LD conventions:

- `$id` corresponds to JSON-LD `@id` - a unique URI identifier
- `$type` corresponds to JSON-LD `@type` - the type URI

Example JSON-LD representation:

```json
{
  "$id": "https://schema.org.ai/users/abc123",
  "$type": "https://schema.org.ai/User",
  "email": "alice@example.com",
  "name": "Alice Smith",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

## Dependencies

- [zod](https://zod.dev) - TypeScript-first schema validation

## License

MIT
