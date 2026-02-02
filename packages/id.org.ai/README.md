# id.org.ai

![Stability: Experimental](https://img.shields.io/badge/stability-experimental-red)

Identity primitives for AI systems following [schema.org.ai](https://schema.org.ai) conventions.

## Overview

`id.org.ai` provides type-safe identity management for humans and AI agents in the schema.org.ai ecosystem. All types follow [MDXLD](https://mdxld.org) conventions using `$id` and `$type` fields (the `$`-prefixed superset of JSON-LD's `@` notation).

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

## Core Concepts

### MDXLD Identity Format

MDXLD extends JSON-LD conventions with `$` prefixes instead of `@`:

- `$id` - Unique URI identifier for the entity
- `$type` - Type URI from schema.org.ai

This enables semantic interoperability while being more developer-friendly in JavaScript/TypeScript (no escaping needed).

### Identity Hierarchy

```
Identity (base)
├── User (human)
└── AgentIdentity (AI agent)
```

Each identity can have:
- **Credentials** - Authentication methods (password, OAuth, API key, SSO)
- **Sessions** - Active authenticated sessions with expiration

## Usage

### Users

```typescript
import { createUser, isUser } from 'id.org.ai'

const user = createUser({
  email: 'alice@example.com',
  name: 'Alice Smith',
  profile: { role: 'admin' }
})

// Result:
// {
//   $id: 'https://schema.org.ai/users/550e8400-e29b-...',
//   $type: 'https://schema.org.ai/User',
//   email: 'alice@example.com',
//   name: 'Alice Smith',
//   profile: { role: 'admin' },
//   createdAt: '2024-01-01T00:00:00.000Z',
//   updatedAt: '2024-01-01T00:00:00.000Z'
// }
```

### AI Agents

```typescript
import { createAgentIdentity } from 'id.org.ai'

const agent = createAgentIdentity({
  model: 'claude-3-opus',
  capabilities: ['text-generation', 'code-analysis', 'tool-use'],
  autonomous: true
})

// Result:
// {
//   $id: 'https://schema.org.ai/agents/550e8400-e29b-...',
//   $type: 'https://schema.org.ai/AgentIdentity',
//   model: 'claude-3-opus',
//   capabilities: ['text-generation', 'code-analysis', 'tool-use'],
//   autonomous: true,
//   createdAt: '2024-01-01T00:00:00.000Z',
//   updatedAt: '2024-01-01T00:00:00.000Z'
// }
```

### Sessions

```typescript
import { createSession, isSessionExpired } from 'id.org.ai'

const session = createSession({
  identityId: user.$id,
  metadata: { userAgent: 'Mozilla/5.0...', ip: '192.168.1.1' }
})
// Auto-generates secure token, expires in 24 hours

if (isSessionExpired(session)) {
  // Handle expired session
}
```

### Credentials

```typescript
import { createCredential } from 'id.org.ai'

// OAuth credential
const oauth = createCredential({
  identityId: user.$id,
  credentialType: 'oauth',
  provider: 'google',
  expiresAt: '2024-12-31T23:59:59Z'
})

// API key for agent
const apiKey = createCredential({
  identityId: agent.$id,
  credentialType: 'api_key'
})
```

### Validation

```typescript
import { UserSchema, isUser, isAgentIdentity } from 'id.org.ai'

// Zod schema validation
const result = UserSchema.safeParse(unknownData)
if (result.success) {
  console.log(result.data.email)
}

// Type guards
if (isUser(data)) {
  console.log(data.email) // TypeScript knows this is User
} else if (isAgentIdentity(data)) {
  console.log(data.model) // TypeScript knows this is AgentIdentity
}
```

## API Reference

### Types

| Type | Description |
|------|-------------|
| `Identity` | Base identity with `$id`, `$type`, `createdAt`, `updatedAt` |
| `User` | Human identity with `email`, `name`, optional `profile` |
| `AgentIdentity` | AI agent with `model`, `capabilities`, `autonomous` flag |
| `Credential` | Auth method: `password`, `oauth`, `api_key`, or `sso` |
| `Session` | Active session with `token`, `expiresAt`, optional `metadata` |
| `CredentialType` | Union: `'password' \| 'oauth' \| 'api_key' \| 'sso'` |

### Factory Functions

| Function | Description |
|----------|-------------|
| `createIdentity(input?)` | Base identity with auto-generated `$id` and timestamps |
| `createUser(input)` | User with `email` and `name` required |
| `createAgentIdentity(input)` | Agent with `model`, `capabilities`, `autonomous` required |
| `createCredential(input)` | Credential linked to an `identityId` |
| `createSession(input)` | Session with auto-generated token, 24h default expiry |

### Type Guards

| Function | Description |
|----------|-------------|
| `isIdentity(obj)` | Check if valid Identity |
| `isUser(obj)` | Check if valid User |
| `isAgentIdentity(obj)` | Check if valid AgentIdentity |
| `isCredential(obj)` | Check if valid Credential |
| `isSession(obj)` | Check if valid Session |
| `isSessionExpired(session)` | Check if session's `expiresAt` is past |

### Zod Schemas

| Schema | Description |
|--------|-------------|
| `IdentitySchema` | Validates Identity structure |
| `UserSchema` | Validates User with email format check |
| `AgentIdentitySchema` | Validates AgentIdentity |
| `CredentialSchema` | Validates Credential with enum check |
| `SessionSchema` | Validates Session with non-empty token |

## Dependencies

- [zod](https://zod.dev) - Runtime schema validation

## License

MIT
