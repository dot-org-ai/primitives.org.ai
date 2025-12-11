/**
 * Identity & Authentication Types
 *
 * Types for identity and authentication systems:
 * User, Identity, Credential, Session, Token, APIKey, OAuth2, Roles, Permissions,
 * Groups, Organizations, Invitations, MFA, Audit Logs, and more.
 *
 * @module auth
 */

import type {
  Input,
  Output,
  Action,
  BaseEvent,
  EventHandler,
  CRUDResource,
  ListParams,
  PaginatedResult,
} from '@/core/rpc'

// =============================================================================
// Enums & Status Types
// =============================================================================

/**
 * User account status.
 */
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification' | 'deleted'

/**
 * Identity provider types.
 */
export type IdentityProvider =
  | 'email'
  | 'google'
  | 'github'
  | 'microsoft'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'apple'
  | 'saml'
  | 'oidc'
  | 'okta'
  | 'auth0'
  | 'custom'

/**
 * Session status.
 */
export type SessionStatus = 'active' | 'expired' | 'revoked' | 'logged_out'

/**
 * Token type.
 */
export type TokenType = 'access' | 'refresh' | 'id' | 'verification' | 'reset' | 'invite'

/**
 * Role type.
 */
export type RoleType = 'system' | 'organization' | 'custom'

/**
 * Permission scope.
 */
export type PermissionScope = 'global' | 'organization' | 'project' | 'resource'

/**
 * MFA type.
 */
export type MFAType = 'totp' | 'sms' | 'email' | 'webauthn' | 'backup_codes'

/**
 * MFA status.
 */
export type MFAStatus = 'enabled' | 'disabled' | 'pending_setup' | 'suspended'

/**
 * Invitation status.
 */
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

/**
 * Login attempt result.
 */
export type LoginResult = 'success' | 'failed' | 'locked' | 'mfa_required' | 'suspended'

// =============================================================================
// User
// =============================================================================

/**
 * User account in the authentication system.
 *
 * @example
 * ```ts
 * const user: User = {
 *   id: 'usr_123',
 *   email: 'john.doe@example.com',
 *   emailVerified: true,
 *   username: 'johndoe',
 *   displayName: 'John Doe',
 *   avatarUrl: 'https://example.com/avatar.jpg',
 *   status: 'active',
 *   locale: 'en-US',
 *   timezone: 'America/New_York',
 *   lastLoginAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date(),
 *   metadata: { source: 'web' },
 *   externalIds: { auth0: 'auth0|123', okta: 'okta_456' }
 * }
 * ```
 */
export interface User {
  /** Unique identifier */
  id: string

  /** Primary email address */
  email: string

  /** Email verification status */
  emailVerified: boolean

  /** Username (if applicable) */
  username?: string

  /** Display name */
  displayName?: string

  /** First name */
  firstName?: string

  /** Last name */
  lastName?: string

  /** Avatar/profile picture URL */
  avatarUrl?: string

  /** Phone number */
  phone?: string

  /** Phone verification status */
  phoneVerified?: boolean

  /** User status */
  status: UserStatus

  /** Preferred locale */
  locale?: string

  /** Timezone */
  timezone?: string

  /** Last login timestamp */
  lastLoginAt?: Date

  /** Last password change timestamp */
  lastPasswordChangeAt?: Date

  /** Failed login attempts count */
  failedLoginAttempts?: number

  /** Account locked until */
  lockedUntil?: Date

  /** Terms accepted timestamp */
  termsAcceptedAt?: Date

  /** Privacy policy accepted timestamp */
  privacyAcceptedAt?: Date

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    firebase?: string
    cognito?: string
    supabase?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date

  /** Deletion timestamp (soft delete) */
  deletedAt?: Date
}

export type UserInput = Input<User>
export type UserOutput = Output<User>

// =============================================================================
// Identity
// =============================================================================

/**
 * Identity record linking user to external authentication provider.
 *
 * @example
 * ```ts
 * const identity: Identity = {
 *   id: 'ident_123',
 *   userId: 'usr_123',
 *   provider: 'google',
 *   providerId: 'google_user_id_xyz',
 *   providerEmail: 'john@gmail.com',
 *   providerData: { picture: 'https://...', locale: 'en' },
 *   lastUsedAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Identity {
  /** Unique identifier */
  id: string

  /** User ID this identity belongs to */
  userId: string

  /** Identity provider */
  provider: IdentityProvider

  /** Provider-specific user ID */
  providerId: string

  /** Email from provider */
  providerEmail?: string

  /** Provider-specific data */
  providerData?: Record<string, unknown>

  /** Access token (if stored) */
  accessToken?: string

  /** Refresh token (if stored) */
  refreshToken?: string

  /** Token expiry */
  tokenExpiresAt?: Date

  /** Last used timestamp */
  lastUsedAt?: Date

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type IdentityInput = Input<Identity>
export type IdentityOutput = Output<Identity>

// =============================================================================
// Credential
// =============================================================================

/**
 * Credential record storing password hashes and related data.
 *
 * @example
 * ```ts
 * const credential: Credential = {
 *   id: 'cred_123',
 *   userId: 'usr_123',
 *   type: 'password',
 *   hashedPassword: '$2b$10$...',
 *   algorithm: 'bcrypt',
 *   salt: 'random_salt',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Credential {
  /** Unique identifier */
  id: string

  /** User ID this credential belongs to */
  userId: string

  /** Credential type */
  type: 'password' | 'pin' | 'passkey' | 'custom'

  /** Hashed password/credential */
  hashedPassword?: string

  /** Hashing algorithm used */
  algorithm?: 'bcrypt' | 'argon2' | 'scrypt' | 'pbkdf2'

  /** Salt (if not included in hash) */
  salt?: string

  /** Iterations (for algorithms that use it) */
  iterations?: number

  /** Previous passwords (hashed) */
  passwordHistory?: string[]

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CredentialInput = Input<Credential>
export type CredentialOutput = Output<Credential>

// =============================================================================
// Session
// =============================================================================

/**
 * Active user session.
 *
 * @example
 * ```ts
 * const session: Session = {
 *   id: 'sess_123',
 *   userId: 'usr_123',
 *   status: 'active',
 *   deviceId: 'dev_456',
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...',
 *   expiresAt: new Date('2024-12-31'),
 *   lastActivityAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Session {
  /** Unique identifier */
  id: string

  /** User ID */
  userId: string

  /** Session status */
  status: SessionStatus

  /** Device ID (if tracked) */
  deviceId?: string

  /** IP address */
  ipAddress?: string

  /** User agent string */
  userAgent?: string

  /** Geo location */
  location?: {
    country?: string
    region?: string
    city?: string
    latitude?: number
    longitude?: number
  }

  /** Session expiry */
  expiresAt: Date

  /** Last activity timestamp */
  lastActivityAt: Date

  /** Logout timestamp */
  loggedOutAt?: Date

  /** Revocation reason */
  revocationReason?: string

  /** Remember me flag */
  rememberMe?: boolean

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SessionInput = Input<Session>
export type SessionOutput = Output<Session>

// =============================================================================
// Token
// =============================================================================

/**
 * Access/refresh token for API authentication.
 *
 * @example
 * ```ts
 * const token: Token = {
 *   id: 'tok_123',
 *   userId: 'usr_123',
 *   type: 'access',
 *   token: 'eyJhbGciOiJIUzI1NiIs...',
 *   scopes: ['read:profile', 'write:data'],
 *   expiresAt: new Date('2024-12-31'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Token {
  /** Unique identifier */
  id: string

  /** User ID (if user-specific) */
  userId?: string

  /** Token type */
  type: TokenType

  /** Token string (hashed in storage) */
  token: string

  /** Token scopes */
  scopes?: string[]

  /** Related session ID */
  sessionId?: string

  /** Token expiry */
  expiresAt?: Date

  /** Used/redeemed timestamp */
  usedAt?: Date

  /** Revoked flag */
  revoked?: boolean

  /** Revocation timestamp */
  revokedAt?: Date

  /** Revocation reason */
  revocationReason?: string

  /** IP address of creation */
  ipAddress?: string

  /** User agent of creation */
  userAgent?: string

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TokenInput = Input<Token>
export type TokenOutput = Output<Token>

// =============================================================================
// APIKey
// =============================================================================

/**
 * API key for programmatic access.
 *
 * @example
 * ```ts
 * const apiKey: APIKey = {
 *   id: 'key_123',
 *   userId: 'usr_123',
 *   name: 'Production API Key',
 *   key: 'sk_live_...',
 *   scopes: ['read:*', 'write:data'],
 *   lastUsedAt: new Date(),
 *   expiresAt: new Date('2025-12-31'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface APIKey {
  /** Unique identifier */
  id: string

  /** User ID who owns this key */
  userId: string

  /** Organization ID (if org-scoped) */
  organizationId?: string

  /** Key name/description */
  name: string

  /** API key string (hashed in storage) */
  key: string

  /** Prefix for display (e.g., 'sk_live_') */
  prefix?: string

  /** Last 4 characters for display */
  last4?: string

  /** Key scopes/permissions */
  scopes?: string[]

  /** Rate limit (requests per minute) */
  rateLimit?: number

  /** Allowed IP addresses */
  allowedIPs?: string[]

  /** Last used timestamp */
  lastUsedAt?: Date

  /** Usage count */
  usageCount?: number

  /** Expiry date */
  expiresAt?: Date

  /** Revoked flag */
  revoked?: boolean

  /** Revocation timestamp */
  revokedAt?: Date

  /** Revocation reason */
  revocationReason?: string

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type APIKeyInput = Input<APIKey>
export type APIKeyOutput = Output<APIKey>

// =============================================================================
// OAuth2Client
// =============================================================================

/**
 * OAuth2 client application.
 *
 * @example
 * ```ts
 * const client: OAuth2Client = {
 *   id: 'client_123',
 *   clientId: 'my_app_client_id',
 *   clientSecret: 'secret_hash',
 *   name: 'My Application',
 *   redirectUris: ['https://app.example.com/callback'],
 *   grantTypes: ['authorization_code', 'refresh_token'],
 *   scopes: ['read:profile', 'write:data'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface OAuth2Client {
  /** Unique identifier */
  id: string

  /** OAuth2 client ID */
  clientId: string

  /** Client secret (hashed) */
  clientSecret?: string

  /** Client name */
  name: string

  /** Client description */
  description?: string

  /** Logo URL */
  logoUrl?: string

  /** Homepage URL */
  homepageUrl?: string

  /** Privacy policy URL */
  privacyUrl?: string

  /** Terms of service URL */
  termsUrl?: string

  /** Owner user ID */
  ownerId?: string

  /** Owner organization ID */
  ownerOrganizationId?: string

  /** Redirect URIs */
  redirectUris: string[]

  /** Allowed grant types */
  grantTypes: Array<'authorization_code' | 'implicit' | 'password' | 'client_credentials' | 'refresh_token'>

  /** Allowed scopes */
  scopes: string[]

  /** Client type */
  clientType?: 'public' | 'confidential'

  /** Trusted/first-party flag */
  trusted?: boolean

  /** Active/enabled status */
  active?: boolean

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type OAuth2ClientInput = Input<OAuth2Client>
export type OAuth2ClientOutput = Output<OAuth2Client>

// =============================================================================
// OAuth2Grant
// =============================================================================

/**
 * OAuth2 authorization grant.
 *
 * @example
 * ```ts
 * const grant: OAuth2Grant = {
 *   id: 'grant_123',
 *   userId: 'usr_123',
 *   clientId: 'client_123',
 *   scopes: ['read:profile', 'write:data'],
 *   status: 'active',
 *   expiresAt: new Date('2024-12-31'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface OAuth2Grant {
  /** Unique identifier */
  id: string

  /** User ID who granted authorization */
  userId: string

  /** OAuth2 client ID */
  clientId: string

  /** Granted scopes */
  scopes: string[]

  /** Authorization code (if using code flow) */
  authorizationCode?: string

  /** Code challenge (PKCE) */
  codeChallenge?: string

  /** Code challenge method */
  codeChallengeMethod?: 'plain' | 'S256'

  /** Redirect URI used */
  redirectUri?: string

  /** Grant status */
  status: 'active' | 'revoked' | 'expired'

  /** Grant expiry */
  expiresAt?: Date

  /** Revoked timestamp */
  revokedAt?: Date

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type OAuth2GrantInput = Input<OAuth2Grant>
export type OAuth2GrantOutput = Output<OAuth2Grant>

// =============================================================================
// OAuth2Token
// =============================================================================

/**
 * OAuth2 access/refresh token.
 *
 * @example
 * ```ts
 * const oauth2Token: OAuth2Token = {
 *   id: 'oatk_123',
 *   grantId: 'grant_123',
 *   userId: 'usr_123',
 *   clientId: 'client_123',
 *   type: 'access',
 *   token: 'access_token_string',
 *   scopes: ['read:profile'],
 *   expiresAt: new Date('2024-12-31'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface OAuth2Token {
  /** Unique identifier */
  id: string

  /** Related grant ID */
  grantId: string

  /** User ID */
  userId: string

  /** Client ID */
  clientId: string

  /** Token type */
  type: 'access' | 'refresh'

  /** Token string (hashed in storage) */
  token: string

  /** Token scopes */
  scopes: string[]

  /** Token expiry */
  expiresAt?: Date

  /** Revoked flag */
  revoked?: boolean

  /** Revocation timestamp */
  revokedAt?: Date

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type OAuth2TokenInput = Input<OAuth2Token>
export type OAuth2TokenOutput = Output<OAuth2Token>

// =============================================================================
// Role
// =============================================================================

/**
 * Role for access control.
 *
 * @example
 * ```ts
 * const role: Role = {
 *   id: 'role_123',
 *   name: 'admin',
 *   displayName: 'Administrator',
 *   description: 'Full system access',
 *   type: 'system',
 *   permissions: ['*'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Role {
  /** Unique identifier */
  id: string

  /** Role name (slug) */
  name: string

  /** Display name */
  displayName: string

  /** Role description */
  description?: string

  /** Role type */
  type: RoleType

  /** Organization ID (if org-scoped) */
  organizationId?: string

  /** Permission IDs or names */
  permissions?: string[]

  /** Inherits from role IDs */
  inheritsFrom?: string[]

  /** System/protected flag */
  system?: boolean

  /** Active flag */
  active?: boolean

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type RoleInput = Input<Role>
export type RoleOutput = Output<Role>

// =============================================================================
// Permission
// =============================================================================

/**
 * Permission definition.
 *
 * @example
 * ```ts
 * const permission: Permission = {
 *   id: 'perm_123',
 *   name: 'read:users',
 *   displayName: 'Read Users',
 *   description: 'View user information',
 *   scope: 'global',
 *   resource: 'users',
 *   action: 'read',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Permission {
  /** Unique identifier */
  id: string

  /** Permission name (e.g., 'read:users') */
  name: string

  /** Display name */
  displayName: string

  /** Permission description */
  description?: string

  /** Permission scope */
  scope: PermissionScope

  /** Resource type */
  resource?: string

  /** Action/operation */
  action?: string

  /** System/protected flag */
  system?: boolean

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PermissionInput = Input<Permission>
export type PermissionOutput = Output<Permission>

// =============================================================================
// RoleAssignment
// =============================================================================

/**
 * Role assignment to a user.
 *
 * @example
 * ```ts
 * const assignment: RoleAssignment = {
 *   id: 'assign_123',
 *   userId: 'usr_123',
 *   roleId: 'role_123',
 *   scope: 'global',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface RoleAssignment {
  /** Unique identifier */
  id: string

  /** User ID */
  userId: string

  /** Role ID */
  roleId: string

  /** Assignment scope */
  scope?: 'global' | 'organization' | 'project' | 'resource'

  /** Organization ID (if org-scoped) */
  organizationId?: string

  /** Project ID (if project-scoped) */
  projectId?: string

  /** Resource ID (if resource-scoped) */
  resourceId?: string

  /** Resource type (if resource-scoped) */
  resourceType?: string

  /** Granted by user ID */
  grantedBy?: string

  /** Assignment expiry */
  expiresAt?: Date

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type RoleAssignmentInput = Input<RoleAssignment>
export type RoleAssignmentOutput = Output<RoleAssignment>

// =============================================================================
// Policy
// =============================================================================

/**
 * Access control policy.
 *
 * @example
 * ```ts
 * const policy: Policy = {
 *   id: 'pol_123',
 *   name: 'admin-access',
 *   displayName: 'Admin Access Policy',
 *   description: 'Full access for admins',
 *   effect: 'allow',
 *   actions: ['*'],
 *   resources: ['*'],
 *   conditions: { 'user.role': 'admin' },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Policy {
  /** Unique identifier */
  id: string

  /** Policy name */
  name: string

  /** Display name */
  displayName: string

  /** Policy description */
  description?: string

  /** Effect (allow or deny) */
  effect: 'allow' | 'deny'

  /** Actions/permissions */
  actions: string[]

  /** Resources */
  resources: string[]

  /** Conditions (IAM-style) */
  conditions?: Record<string, unknown>

  /** Priority (for conflict resolution) */
  priority?: number

  /** Active flag */
  active?: boolean

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PolicyInput = Input<Policy>
export type PolicyOutput = Output<Policy>

// =============================================================================
// PolicyBinding
// =============================================================================

/**
 * Policy binding to users/groups.
 *
 * @example
 * ```ts
 * const binding: PolicyBinding = {
 *   id: 'bind_123',
 *   policyId: 'pol_123',
 *   principalType: 'user',
 *   principalId: 'usr_123',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface PolicyBinding {
  /** Unique identifier */
  id: string

  /** Policy ID */
  policyId: string

  /** Principal type */
  principalType: 'user' | 'group' | 'role' | 'service_account'

  /** Principal ID */
  principalId: string

  /** Organization ID (if org-scoped) */
  organizationId?: string

  /** Binding expiry */
  expiresAt?: Date

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PolicyBindingInput = Input<PolicyBinding>
export type PolicyBindingOutput = Output<PolicyBinding>

// =============================================================================
// Group
// =============================================================================

/**
 * User group for organizing users.
 *
 * @example
 * ```ts
 * const group: Group = {
 *   id: 'grp_123',
 *   name: 'engineering',
 *   displayName: 'Engineering Team',
 *   description: 'All engineers',
 *   memberCount: 42,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Group {
  /** Unique identifier */
  id: string

  /** Group name (slug) */
  name: string

  /** Display name */
  displayName: string

  /** Group description */
  description?: string

  /** Organization ID (if org-scoped) */
  organizationId?: string

  /** Parent group ID */
  parentGroupId?: string

  /** Member count */
  memberCount?: number

  /** Role IDs assigned to group */
  roleIds?: string[]

  /** Active flag */
  active?: boolean

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type GroupInput = Input<Group>
export type GroupOutput = Output<Group>

// =============================================================================
// GroupMembership
// =============================================================================

/**
 * Group membership record.
 *
 * @example
 * ```ts
 * const membership: GroupMembership = {
 *   id: 'gmem_123',
 *   groupId: 'grp_123',
 *   userId: 'usr_123',
 *   role: 'member',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface GroupMembership {
  /** Unique identifier */
  id: string

  /** Group ID */
  groupId: string

  /** User ID */
  userId: string

  /** Role in group */
  role?: 'owner' | 'admin' | 'member'

  /** Joined timestamp */
  joinedAt?: Date

  /** Added by user ID */
  addedBy?: string

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type GroupMembershipInput = Input<GroupMembership>
export type GroupMembershipOutput = Output<GroupMembership>

// =============================================================================
// Organization
// =============================================================================

/**
 * Multi-tenant organization.
 *
 * @example
 * ```ts
 * const organization: Organization = {
 *   id: 'org_123',
 *   name: 'Acme Corp',
 *   slug: 'acme-corp',
 *   domain: 'acme.com',
 *   plan: 'enterprise',
 *   status: 'active',
 *   memberCount: 100,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Organization {
  /** Unique identifier */
  id: string

  /** Organization name */
  name: string

  /** Organization slug */
  slug: string

  /** Display name */
  displayName?: string

  /** Description */
  description?: string

  /** Logo URL */
  logoUrl?: string

  /** Website URL */
  websiteUrl?: string

  /** Primary domain */
  domain?: string

  /** Verified domains */
  verifiedDomains?: string[]

  /** Organization status */
  status?: 'active' | 'suspended' | 'deleted'

  /** Subscription plan */
  plan?: string

  /** Member count */
  memberCount?: number

  /** Settings */
  settings?: {
    allowSignup?: boolean
    requireEmailVerification?: boolean
    requireMFA?: boolean
    sessionTimeout?: number
    [key: string]: unknown
  }

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date

  /** Deletion timestamp (soft delete) */
  deletedAt?: Date
}

export type OrganizationInput = Input<Organization>
export type OrganizationOutput = Output<Organization>

// =============================================================================
// OrganizationMember
// =============================================================================

/**
 * Organization membership record.
 *
 * @example
 * ```ts
 * const member: OrganizationMember = {
 *   id: 'omem_123',
 *   organizationId: 'org_123',
 *   userId: 'usr_123',
 *   role: 'admin',
 *   joinedAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface OrganizationMember {
  /** Unique identifier */
  id: string

  /** Organization ID */
  organizationId: string

  /** User ID */
  userId: string

  /** Role in organization */
  role: 'owner' | 'admin' | 'member' | 'billing' | 'guest'

  /** Joined timestamp */
  joinedAt?: Date

  /** Invited by user ID */
  invitedBy?: string

  /** Invitation ID */
  invitationId?: string

  /** Active status */
  active?: boolean

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type OrganizationMemberInput = Input<OrganizationMember>
export type OrganizationMemberOutput = Output<OrganizationMember>

// =============================================================================
// Invitation
// =============================================================================

/**
 * User invitation to join organization.
 *
 * @example
 * ```ts
 * const invitation: Invitation = {
 *   id: 'inv_123',
 *   email: 'newuser@example.com',
 *   organizationId: 'org_123',
 *   role: 'member',
 *   status: 'pending',
 *   invitedBy: 'usr_456',
 *   expiresAt: new Date('2024-12-31'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Invitation {
  /** Unique identifier */
  id: string

  /** Email address invited */
  email: string

  /** Organization ID (if org invitation) */
  organizationId?: string

  /** Group ID (if group invitation) */
  groupId?: string

  /** Role to assign */
  role?: string

  /** Invitation status */
  status: InvitationStatus

  /** Invited by user ID */
  invitedBy?: string

  /** Invitation token */
  token?: string

  /** Accepted by user ID */
  acceptedBy?: string

  /** Accepted timestamp */
  acceptedAt?: Date

  /** Expiry timestamp */
  expiresAt?: Date

  /** Revoked by user ID */
  revokedBy?: string

  /** Revoked timestamp */
  revokedAt?: Date

  /** Revocation reason */
  revocationReason?: string

  /** Custom message */
  message?: string

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type InvitationInput = Input<Invitation>
export type InvitationOutput = Output<Invitation>

// =============================================================================
// MFA
// =============================================================================

/**
 * Multi-factor authentication configuration.
 *
 * @example
 * ```ts
 * const mfa: MFA = {
 *   id: 'mfa_123',
 *   userId: 'usr_123',
 *   type: 'totp',
 *   status: 'enabled',
 *   name: 'Authenticator App',
 *   secret: 'encrypted_secret',
 *   backupCodes: ['encrypted_code_1', 'encrypted_code_2'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface MFA {
  /** Unique identifier */
  id: string

  /** User ID */
  userId: string

  /** MFA type */
  type: MFAType

  /** MFA status */
  status: MFAStatus

  /** Device/method name */
  name?: string

  /** TOTP secret (encrypted) */
  secret?: string

  /** Phone number (for SMS) */
  phone?: string

  /** Email (for email MFA) */
  email?: string

  /** WebAuthn credential ID */
  credentialId?: string

  /** WebAuthn public key */
  publicKey?: string

  /** Backup codes (encrypted) */
  backupCodes?: string[]

  /** Last used timestamp */
  lastUsedAt?: Date

  /** Primary/default flag */
  primary?: boolean

  /** Verified timestamp */
  verifiedAt?: Date

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MFAInput = Input<MFA>
export type MFAOutput = Output<MFA>

// =============================================================================
// MFAChallenge
// =============================================================================

/**
 * MFA challenge for authentication.
 *
 * @example
 * ```ts
 * const challenge: MFAChallenge = {
 *   id: 'chal_123',
 *   userId: 'usr_123',
 *   mfaId: 'mfa_123',
 *   type: 'totp',
 *   status: 'pending',
 *   expiresAt: new Date(Date.now() + 5 * 60 * 1000),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface MFAChallenge {
  /** Unique identifier */
  id: string

  /** User ID */
  userId: string

  /** MFA configuration ID */
  mfaId: string

  /** Challenge type */
  type: MFAType

  /** Challenge status */
  status: 'pending' | 'verified' | 'failed' | 'expired'

  /** Session ID being verified */
  sessionId?: string

  /** Challenge code (for SMS/email) */
  code?: string

  /** Challenge data (for WebAuthn) */
  challengeData?: string

  /** Attempts count */
  attempts?: number

  /** Max attempts allowed */
  maxAttempts?: number

  /** Verified timestamp */
  verifiedAt?: Date

  /** Expiry timestamp */
  expiresAt: Date

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type MFAChallengeInput = Input<MFAChallenge>
export type MFAChallengeOutput = Output<MFAChallenge>

// =============================================================================
// RecoveryCode
// =============================================================================

/**
 * Recovery/backup code for account access.
 *
 * @example
 * ```ts
 * const recoveryCode: RecoveryCode = {
 *   id: 'rec_123',
 *   userId: 'usr_123',
 *   code: 'hashed_code',
 *   used: false,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface RecoveryCode {
  /** Unique identifier */
  id: string

  /** User ID */
  userId: string

  /** Recovery code (hashed) */
  code: string

  /** Used flag */
  used: boolean

  /** Used timestamp */
  usedAt?: Date

  /** Used from IP */
  usedFromIp?: string

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type RecoveryCodeInput = Input<RecoveryCode>
export type RecoveryCodeOutput = Output<RecoveryCode>

// =============================================================================
// PasswordReset
// =============================================================================

/**
 * Password reset token.
 *
 * @example
 * ```ts
 * const passwordReset: PasswordReset = {
 *   id: 'reset_123',
 *   userId: 'usr_123',
 *   token: 'hashed_token',
 *   used: false,
 *   expiresAt: new Date(Date.now() + 60 * 60 * 1000),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface PasswordReset {
  /** Unique identifier */
  id: string

  /** User ID */
  userId: string

  /** Email address */
  email: string

  /** Reset token (hashed) */
  token: string

  /** Used flag */
  used: boolean

  /** Used timestamp */
  usedAt?: Date

  /** Expiry timestamp */
  expiresAt: Date

  /** IP address of request */
  ipAddress?: string

  /** User agent of request */
  userAgent?: string

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PasswordResetInput = Input<PasswordReset>
export type PasswordResetOutput = Output<PasswordReset>

// =============================================================================
// EmailVerification
// =============================================================================

/**
 * Email verification token.
 *
 * @example
 * ```ts
 * const verification: EmailVerification = {
 *   id: 'ver_123',
 *   userId: 'usr_123',
 *   email: 'user@example.com',
 *   token: 'hashed_token',
 *   verified: false,
 *   expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface EmailVerification {
  /** Unique identifier */
  id: string

  /** User ID */
  userId: string

  /** Email address to verify */
  email: string

  /** Verification token (hashed) */
  token: string

  /** Verified flag */
  verified: boolean

  /** Verified timestamp */
  verifiedAt?: Date

  /** Expiry timestamp */
  expiresAt: Date

  /** IP address of verification */
  ipAddress?: string

  /** User agent of verification */
  userAgent?: string

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EmailVerificationInput = Input<EmailVerification>
export type EmailVerificationOutput = Output<EmailVerification>

// =============================================================================
// AuditLog
// =============================================================================

/**
 * Security audit log entry.
 *
 * @example
 * ```ts
 * const log: AuditLog = {
 *   id: 'log_123',
 *   userId: 'usr_123',
 *   action: 'user.login',
 *   resource: 'user',
 *   resourceId: 'usr_123',
 *   result: 'success',
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface AuditLog {
  /** Unique identifier */
  id: string

  /** User ID performing action */
  userId?: string

  /** Organization ID */
  organizationId?: string

  /** Action performed */
  action: string

  /** Resource type */
  resource?: string

  /** Resource ID */
  resourceId?: string

  /** Action result */
  result: 'success' | 'failure' | 'error'

  /** Error message (if failed) */
  errorMessage?: string

  /** IP address */
  ipAddress?: string

  /** User agent */
  userAgent?: string

  /** Geo location */
  location?: {
    country?: string
    region?: string
    city?: string
  }

  /** Request details */
  request?: {
    method?: string
    path?: string
    query?: Record<string, unknown>
  }

  /** Response details */
  response?: {
    status?: number
    duration?: number
  }

  /** Changes made (before/after) */
  changes?: {
    before?: Record<string, unknown>
    after?: Record<string, unknown>
  }

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AuditLogInput = Input<AuditLog>
export type AuditLogOutput = Output<AuditLog>

// =============================================================================
// LoginAttempt
// =============================================================================

/**
 * Login attempt record for security monitoring.
 *
 * @example
 * ```ts
 * const attempt: LoginAttempt = {
 *   id: 'attempt_123',
 *   userId: 'usr_123',
 *   email: 'user@example.com',
 *   result: 'success',
 *   ipAddress: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface LoginAttempt {
  /** Unique identifier */
  id: string

  /** User ID (if known) */
  userId?: string

  /** Email/username attempted */
  email?: string

  /** Login result */
  result: LoginResult

  /** Failure reason */
  failureReason?: string

  /** IP address */
  ipAddress?: string

  /** User agent */
  userAgent?: string

  /** Geo location */
  location?: {
    country?: string
    region?: string
    city?: string
  }

  /** Device fingerprint */
  deviceFingerprint?: string

  /** MFA required flag */
  mfaRequired?: boolean

  /** MFA verified flag */
  mfaVerified?: boolean

  /** Session ID (if successful) */
  sessionId?: string

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type LoginAttemptInput = Input<LoginAttempt>
export type LoginAttemptOutput = Output<LoginAttempt>

// =============================================================================
// Device
// =============================================================================

/**
 * Trusted device for authentication.
 *
 * @example
 * ```ts
 * const device: Device = {
 *   id: 'dev_123',
 *   userId: 'usr_123',
 *   name: 'iPhone 15',
 *   fingerprint: 'device_fingerprint_hash',
 *   trusted: true,
 *   lastUsedAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Device {
  /** Unique identifier */
  id: string

  /** User ID */
  userId: string

  /** Device name */
  name?: string

  /** Device type */
  type?: 'desktop' | 'mobile' | 'tablet' | 'other'

  /** Device fingerprint/hash */
  fingerprint: string

  /** Trusted flag */
  trusted: boolean

  /** IP address */
  ipAddress?: string

  /** User agent */
  userAgent?: string

  /** Operating system */
  os?: string

  /** Browser */
  browser?: string

  /** Last used timestamp */
  lastUsedAt?: Date

  /** Last location */
  lastLocation?: {
    country?: string
    region?: string
    city?: string
  }

  /** Revoked flag */
  revoked?: boolean

  /** Revoked timestamp */
  revokedAt?: Date

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DeviceInput = Input<Device>
export type DeviceOutput = Output<Device>

// =============================================================================
// IPWhitelist
// =============================================================================

/**
 * IP whitelist entry for access control.
 *
 * @example
 * ```ts
 * const whitelist: IPWhitelist = {
 *   id: 'ip_123',
 *   organizationId: 'org_123',
 *   ipAddress: '192.168.1.0/24',
 *   description: 'Office network',
 *   active: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface IPWhitelist {
  /** Unique identifier */
  id: string

  /** Organization ID (if org-scoped) */
  organizationId?: string

  /** User ID (if user-scoped) */
  userId?: string

  /** IP address or CIDR range */
  ipAddress: string

  /** Description */
  description?: string

  /** Active flag */
  active: boolean

  /** Added by user ID */
  addedBy?: string

  /** Expiry timestamp */
  expiresAt?: Date

  /** Arbitrary metadata */
  metadata?: Record<string, unknown>

  /** External provider IDs */
  externalIds?: {
    auth0?: string
    okta?: string
    clerk?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type IPWhitelistInput = Input<IPWhitelist>
export type IPWhitelistOutput = Output<IPWhitelist>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface UserActions extends CRUDResource<User, UserInput> {
  /** Get user by email */
  getByEmail: Action<{ email: string }, User>

  /** Get user by username */
  getByUsername: Action<{ username: string }, User>

  /** Verify email */
  verifyEmail: Action<{ id: string; token: string }, User>

  /** Update password */
  updatePassword: Action<{ id: string; currentPassword: string; newPassword: string }, User>

  /** Request password reset */
  requestPasswordReset: Action<{ email: string }, { success: boolean }>

  /** Reset password */
  resetPassword: Action<{ token: string; newPassword: string }, User>

  /** Suspend user */
  suspend: Action<{ id: string; reason?: string }, User>

  /** Activate user */
  activate: Action<{ id: string }, User>

  /** Delete user (soft delete) */
  softDelete: Action<{ id: string }, User>

  /** Get user sessions */
  getSessions: Action<{ id: string } & ListParams, PaginatedResult<Session>>

  /** Get user roles */
  getRoles: Action<{ id: string }, Role[]>

  /** Get user permissions */
  getPermissions: Action<{ id: string }, Permission[]>

  /** Check permission */
  hasPermission: Action<{ id: string; permission: string }, boolean>

  /** Get user organizations */
  getOrganizations: Action<{ id: string } & ListParams, PaginatedResult<Organization>>

  /** Get audit logs */
  getAuditLogs: Action<{ id: string } & ListParams, PaginatedResult<AuditLog>>
}

export interface IdentityActions extends CRUDResource<Identity, IdentityInput> {
  /** Get identities by user */
  getByUser: Action<{ userId: string }, Identity[]>

  /** Get identity by provider */
  getByProvider: Action<{ userId: string; provider: IdentityProvider }, Identity>

  /** Link identity */
  link: Action<{ userId: string; provider: IdentityProvider; providerId: string }, Identity>

  /** Unlink identity */
  unlink: Action<{ id: string }, void>
}

export interface CredentialActions extends CRUDResource<Credential, CredentialInput> {
  /** Get credential by user */
  getByUser: Action<{ userId: string }, Credential>

  /** Verify password */
  verifyPassword: Action<{ userId: string; password: string }, boolean>

  /** Update password */
  updatePassword: Action<{ userId: string; password: string }, Credential>
}

export interface SessionActions extends CRUDResource<Session, SessionInput> {
  /** Get active sessions by user */
  getByUser: Action<{ userId: string } & ListParams, PaginatedResult<Session>>

  /** Revoke session */
  revoke: Action<{ id: string; reason?: string }, Session>

  /** Revoke all user sessions */
  revokeAll: Action<{ userId: string; exceptSessionId?: string }, { count: number }>

  /** Refresh session */
  refresh: Action<{ id: string }, Session>

  /** Get session by token */
  getByToken: Action<{ token: string }, Session>
}

export interface TokenActions extends CRUDResource<Token, TokenInput> {
  /** Get tokens by user */
  getByUser: Action<{ userId: string; type?: TokenType } & ListParams, PaginatedResult<Token>>

  /** Verify token */
  verify: Action<{ token: string }, Token>

  /** Revoke token */
  revoke: Action<{ id: string; reason?: string }, Token>

  /** Refresh token */
  refresh: Action<{ refreshToken: string }, { accessToken: Token; refreshToken: Token }>

  /** Decode token */
  decode: Action<{ token: string }, Record<string, unknown>>
}

export interface APIKeyActions extends CRUDResource<APIKey, APIKeyInput> {
  /** Get API keys by user */
  getByUser: Action<{ userId: string } & ListParams, PaginatedResult<APIKey>>

  /** Verify API key */
  verify: Action<{ key: string }, APIKey>

  /** Revoke API key */
  revoke: Action<{ id: string; reason?: string }, APIKey>

  /** Rotate API key */
  rotate: Action<{ id: string }, APIKey>

  /** Record usage */
  recordUsage: Action<{ id: string }, APIKey>
}

export interface OAuth2ClientActions extends CRUDResource<OAuth2Client, OAuth2ClientInput> {
  /** Get client by client ID */
  getByClientId: Action<{ clientId: string }, OAuth2Client>

  /** Verify client secret */
  verifySecret: Action<{ clientId: string; clientSecret: string }, boolean>

  /** Rotate client secret */
  rotateSecret: Action<{ id: string }, OAuth2Client>

  /** Get grants */
  getGrants: Action<{ id: string } & ListParams, PaginatedResult<OAuth2Grant>>
}

export interface OAuth2GrantActions extends CRUDResource<OAuth2Grant, OAuth2GrantInput> {
  /** Get grants by user */
  getByUser: Action<{ userId: string } & ListParams, PaginatedResult<OAuth2Grant>>

  /** Get grants by client */
  getByClient: Action<{ clientId: string } & ListParams, PaginatedResult<OAuth2Grant>>

  /** Revoke grant */
  revoke: Action<{ id: string }, OAuth2Grant>

  /** Exchange authorization code */
  exchangeCode: Action<{ code: string; clientId: string; redirectUri: string }, OAuth2Token>
}

export interface OAuth2TokenActions extends CRUDResource<OAuth2Token, OAuth2TokenInput> {
  /** Get tokens by grant */
  getByGrant: Action<{ grantId: string }, OAuth2Token[]>

  /** Verify token */
  verify: Action<{ token: string }, OAuth2Token>

  /** Revoke token */
  revoke: Action<{ id: string }, OAuth2Token>

  /** Refresh access token */
  refresh: Action<{ refreshToken: string }, OAuth2Token>
}

export interface RoleActions extends CRUDResource<Role, RoleInput> {
  /** Get role by name */
  getByName: Action<{ name: string; organizationId?: string }, Role>

  /** Add permission */
  addPermission: Action<{ id: string; permissionId: string }, Role>

  /** Remove permission */
  removePermission: Action<{ id: string; permissionId: string }, Role>

  /** Get permissions */
  getPermissions: Action<{ id: string }, Permission[]>

  /** Get users with role */
  getUsers: Action<{ id: string } & ListParams, PaginatedResult<User>>
}

export interface PermissionActions extends CRUDResource<Permission, PermissionInput> {
  /** Get permission by name */
  getByName: Action<{ name: string }, Permission>

  /** Get roles with permission */
  getRoles: Action<{ id: string } & ListParams, PaginatedResult<Role>>
}

export interface RoleAssignmentActions extends CRUDResource<RoleAssignment, RoleAssignmentInput> {
  /** Get assignments by user */
  getByUser: Action<{ userId: string }, RoleAssignment[]>

  /** Get assignments by role */
  getByRole: Action<{ roleId: string } & ListParams, PaginatedResult<RoleAssignment>>

  /** Revoke assignment */
  revoke: Action<{ id: string }, void>
}

export interface PolicyActions extends CRUDResource<Policy, PolicyInput> {
  /** Get policy by name */
  getByName: Action<{ name: string }, Policy>

  /** Evaluate policy */
  evaluate: Action<{
    policyId: string
    principal: string
    action: string
    resource: string
    context?: Record<string, unknown>
  }, { allowed: boolean; reason?: string }>

  /** Get bindings */
  getBindings: Action<{ id: string } & ListParams, PaginatedResult<PolicyBinding>>
}

export interface PolicyBindingActions extends CRUDResource<PolicyBinding, PolicyBindingInput> {
  /** Get bindings by policy */
  getByPolicy: Action<{ policyId: string } & ListParams, PaginatedResult<PolicyBinding>>

  /** Get bindings by principal */
  getByPrincipal: Action<{ principalType: string; principalId: string }, PolicyBinding[]>

  /** Revoke binding */
  revoke: Action<{ id: string }, void>
}

export interface GroupActions extends CRUDResource<Group, GroupInput> {
  /** Get group by name */
  getByName: Action<{ name: string; organizationId?: string }, Group>

  /** Add member */
  addMember: Action<{ id: string; userId: string; role?: string }, GroupMembership>

  /** Remove member */
  removeMember: Action<{ id: string; userId: string }, void>

  /** Get members */
  getMembers: Action<{ id: string } & ListParams, PaginatedResult<User>>

  /** Assign role */
  assignRole: Action<{ id: string; roleId: string }, Group>

  /** Unassign role */
  unassignRole: Action<{ id: string; roleId: string }, Group>
}

export interface GroupMembershipActions extends CRUDResource<GroupMembership, GroupMembershipInput> {
  /** Get memberships by user */
  getByUser: Action<{ userId: string }, GroupMembership[]>

  /** Get memberships by group */
  getByGroup: Action<{ groupId: string } & ListParams, PaginatedResult<GroupMembership>>

  /** Update role */
  updateRole: Action<{ id: string; role: string }, GroupMembership>
}

export interface OrganizationActions extends CRUDResource<Organization, OrganizationInput> {
  /** Get organization by slug */
  getBySlug: Action<{ slug: string }, Organization>

  /** Get organization by domain */
  getByDomain: Action<{ domain: string }, Organization>

  /** Add member */
  addMember: Action<{ id: string; userId: string; role: string }, OrganizationMember>

  /** Remove member */
  removeMember: Action<{ id: string; userId: string }, void>

  /** Get members */
  getMembers: Action<{ id: string } & ListParams, PaginatedResult<OrganizationMember>>

  /** Update member role */
  updateMemberRole: Action<{ id: string; userId: string; role: string }, OrganizationMember>

  /** Verify domain */
  verifyDomain: Action<{ id: string; domain: string; verificationCode: string }, Organization>

  /** Update settings */
  updateSettings: Action<{ id: string; settings: Record<string, unknown> }, Organization>

  /** Suspend organization */
  suspend: Action<{ id: string; reason?: string }, Organization>

  /** Activate organization */
  activate: Action<{ id: string }, Organization>
}

export interface OrganizationMemberActions extends CRUDResource<OrganizationMember, OrganizationMemberInput> {
  /** Get members by organization */
  getByOrganization: Action<{ organizationId: string } & ListParams, PaginatedResult<OrganizationMember>>

  /** Get memberships by user */
  getByUser: Action<{ userId: string }, OrganizationMember[]>

  /** Update role */
  updateRole: Action<{ id: string; role: string }, OrganizationMember>

  /** Deactivate member */
  deactivate: Action<{ id: string }, OrganizationMember>

  /** Activate member */
  activate: Action<{ id: string }, OrganizationMember>
}

export interface InvitationActions extends CRUDResource<Invitation, InvitationInput> {
  /** Get invitations by organization */
  getByOrganization: Action<{ organizationId: string; status?: InvitationStatus } & ListParams, PaginatedResult<Invitation>>

  /** Get invitation by token */
  getByToken: Action<{ token: string }, Invitation>

  /** Accept invitation */
  accept: Action<{ id: string; userId: string }, { invitation: Invitation; member: OrganizationMember }>

  /** Revoke invitation */
  revoke: Action<{ id: string; reason?: string }, Invitation>

  /** Resend invitation */
  resend: Action<{ id: string }, Invitation>
}

export interface MFAActions extends CRUDResource<MFA, MFAInput> {
  /** Get MFA methods by user */
  getByUser: Action<{ userId: string }, MFA[]>

  /** Setup TOTP */
  setupTOTP: Action<{ userId: string; name?: string }, { mfa: MFA; secret: string; qrCode: string }>

  /** Verify TOTP setup */
  verifyTOTP: Action<{ id: string; code: string }, MFA>

  /** Setup SMS */
  setupSMS: Action<{ userId: string; phone: string }, MFA>

  /** Verify SMS setup */
  verifySMS: Action<{ id: string; code: string }, MFA>

  /** Setup WebAuthn */
  setupWebAuthn: Action<{ userId: string; name?: string }, { mfa: MFA; challenge: string }>

  /** Verify WebAuthn setup */
  verifyWebAuthn: Action<{ id: string; credential: Record<string, unknown> }, MFA>

  /** Generate backup codes */
  generateBackupCodes: Action<{ userId: string }, { mfa: MFA; codes: string[] }>

  /** Disable MFA */
  disable: Action<{ id: string }, MFA>

  /** Set primary */
  setPrimary: Action<{ id: string }, MFA>
}

export interface MFAChallengeActions extends CRUDResource<MFAChallenge, MFAChallengeInput> {
  /** Create challenge */
  createChallenge: Action<{ userId: string; mfaId: string; sessionId?: string }, MFAChallenge>

  /** Verify challenge */
  verify: Action<{ id: string; code: string }, MFAChallenge>

  /** Verify backup code */
  verifyBackupCode: Action<{ userId: string; code: string }, { success: boolean }>
}

export interface RecoveryCodeActions extends CRUDResource<RecoveryCode, RecoveryCodeInput> {
  /** Get recovery codes by user */
  getByUser: Action<{ userId: string }, RecoveryCode[]>

  /** Generate codes */
  generate: Action<{ userId: string; count?: number }, { codes: string[] }>

  /** Use recovery code */
  use: Action<{ userId: string; code: string }, { success: boolean }>

  /** Regenerate codes */
  regenerate: Action<{ userId: string }, { codes: string[] }>
}

export interface PasswordResetActions extends CRUDResource<PasswordReset, PasswordResetInput> {
  /** Create password reset */
  createReset: Action<{ email: string }, PasswordReset>

  /** Verify reset token */
  verifyToken: Action<{ token: string }, PasswordReset>

  /** Complete password reset */
  complete: Action<{ token: string; newPassword: string }, { success: boolean }>
}

export interface EmailVerificationActions extends CRUDResource<EmailVerification, EmailVerificationInput> {
  /** Create verification */
  createVerification: Action<{ userId: string; email: string }, EmailVerification>

  /** Verify email */
  verify: Action<{ token: string }, EmailVerification>

  /** Resend verification */
  resend: Action<{ userId: string; email: string }, EmailVerification>
}

export interface AuditLogActions extends CRUDResource<AuditLog, AuditLogInput> {
  /** Get logs by user */
  getByUser: Action<{ userId: string } & ListParams, PaginatedResult<AuditLog>>

  /** Get logs by organization */
  getByOrganization: Action<{ organizationId: string } & ListParams, PaginatedResult<AuditLog>>

  /** Get logs by action */
  getByAction: Action<{ action: string } & ListParams, PaginatedResult<AuditLog>>

  /** Get logs by resource */
  getByResource: Action<{ resource: string; resourceId?: string } & ListParams, PaginatedResult<AuditLog>>

  /** Search logs */
  search: Action<{ query: string; filters?: Record<string, unknown> } & ListParams, PaginatedResult<AuditLog>>
}

export interface LoginAttemptActions extends CRUDResource<LoginAttempt, LoginAttemptInput> {
  /** Get attempts by user */
  getByUser: Action<{ userId: string } & ListParams, PaginatedResult<LoginAttempt>>

  /** Get attempts by email */
  getByEmail: Action<{ email: string } & ListParams, PaginatedResult<LoginAttempt>>

  /** Get attempts by IP */
  getByIP: Action<{ ipAddress: string } & ListParams, PaginatedResult<LoginAttempt>>

  /** Get failed attempts */
  getFailedAttempts: Action<{ userId?: string; email?: string; ipAddress?: string; since?: Date }, LoginAttempt[]>

  /** Record attempt */
  record: Action<{
    userId?: string
    email?: string
    result: LoginResult
    ipAddress?: string
    userAgent?: string
    metadata?: Record<string, unknown>
  }, LoginAttempt>
}

export interface DeviceActions extends CRUDResource<Device, DeviceInput> {
  /** Get devices by user */
  getByUser: Action<{ userId: string } & ListParams, PaginatedResult<Device>>

  /** Get device by fingerprint */
  getByFingerprint: Action<{ fingerprint: string }, Device>

  /** Trust device */
  trust: Action<{ id: string }, Device>

  /** Revoke device */
  revoke: Action<{ id: string }, Device>

  /** Update last used */
  updateLastUsed: Action<{ id: string }, Device>
}

export interface IPWhitelistActions extends CRUDResource<IPWhitelist, IPWhitelistInput> {
  /** Get entries by organization */
  getByOrganization: Action<{ organizationId: string } & ListParams, PaginatedResult<IPWhitelist>>

  /** Get entries by user */
  getByUser: Action<{ userId: string } & ListParams, PaginatedResult<IPWhitelist>>

  /** Check IP */
  checkIP: Action<{ ipAddress: string; organizationId?: string; userId?: string }, { allowed: boolean }>

  /** Activate entry */
  activate: Action<{ id: string }, IPWhitelist>

  /** Deactivate entry */
  deactivate: Action<{ id: string }, IPWhitelist>
}

// =============================================================================
// Events
// =============================================================================

export interface UserEvents {
  created: BaseEvent<'user.created', User>
  updated: BaseEvent<'user.updated', User>
  deleted: BaseEvent<'user.deleted', { id: string }>
  email_verified: BaseEvent<'user.email_verified', { userId: string; email: string }>
  password_changed: BaseEvent<'user.password_changed', { userId: string }>
  suspended: BaseEvent<'user.suspended', { userId: string; reason?: string }>
  activated: BaseEvent<'user.activated', { userId: string }>
  logged_in: BaseEvent<'user.logged_in', { userId: string; sessionId: string }>
  logged_out: BaseEvent<'user.logged_out', { userId: string; sessionId: string }>
}

export interface IdentityEvents {
  created: BaseEvent<'identity.created', Identity>
  updated: BaseEvent<'identity.updated', Identity>
  deleted: BaseEvent<'identity.deleted', { id: string }>
  linked: BaseEvent<'identity.linked', { userId: string; provider: IdentityProvider }>
  unlinked: BaseEvent<'identity.unlinked', { userId: string; provider: IdentityProvider }>
}

export interface CredentialEvents {
  created: BaseEvent<'credential.created', { userId: string }>
  updated: BaseEvent<'credential.updated', { userId: string }>
  deleted: BaseEvent<'credential.deleted', { id: string }>
}

export interface SessionEvents {
  created: BaseEvent<'session.created', Session>
  updated: BaseEvent<'session.updated', Session>
  revoked: BaseEvent<'session.revoked', { sessionId: string; reason?: string }>
  expired: BaseEvent<'session.expired', { sessionId: string }>
  refreshed: BaseEvent<'session.refreshed', Session>
}

export interface TokenEvents {
  created: BaseEvent<'token.created', Token>
  verified: BaseEvent<'token.verified', { tokenId: string }>
  revoked: BaseEvent<'token.revoked', { tokenId: string; reason?: string }>
  refreshed: BaseEvent<'token.refreshed', { oldTokenId: string; newTokenId: string }>
}

export interface APIKeyEvents {
  created: BaseEvent<'apikey.created', APIKey>
  updated: BaseEvent<'apikey.updated', APIKey>
  deleted: BaseEvent<'apikey.deleted', { id: string }>
  revoked: BaseEvent<'apikey.revoked', { apiKeyId: string; reason?: string }>
  rotated: BaseEvent<'apikey.rotated', { oldKeyId: string; newKeyId: string }>
  used: BaseEvent<'apikey.used', { apiKeyId: string }>
}

export interface OAuth2ClientEvents {
  created: BaseEvent<'oauth2_client.created', OAuth2Client>
  updated: BaseEvent<'oauth2_client.updated', OAuth2Client>
  deleted: BaseEvent<'oauth2_client.deleted', { id: string }>
  secret_rotated: BaseEvent<'oauth2_client.secret_rotated', { clientId: string }>
}

export interface OAuth2GrantEvents {
  created: BaseEvent<'oauth2_grant.created', OAuth2Grant>
  revoked: BaseEvent<'oauth2_grant.revoked', { grantId: string }>
  expired: BaseEvent<'oauth2_grant.expired', { grantId: string }>
}

export interface OAuth2TokenEvents {
  created: BaseEvent<'oauth2_token.created', OAuth2Token>
  verified: BaseEvent<'oauth2_token.verified', { tokenId: string }>
  revoked: BaseEvent<'oauth2_token.revoked', { tokenId: string }>
  refreshed: BaseEvent<'oauth2_token.refreshed', { oldTokenId: string; newTokenId: string }>
}

export interface RoleEvents {
  created: BaseEvent<'role.created', Role>
  updated: BaseEvent<'role.updated', Role>
  deleted: BaseEvent<'role.deleted', { id: string }>
  permission_added: BaseEvent<'role.permission_added', { roleId: string; permissionId: string }>
  permission_removed: BaseEvent<'role.permission_removed', { roleId: string; permissionId: string }>
}

export interface PermissionEvents {
  created: BaseEvent<'permission.created', Permission>
  updated: BaseEvent<'permission.updated', Permission>
  deleted: BaseEvent<'permission.deleted', { id: string }>
}

export interface RoleAssignmentEvents {
  created: BaseEvent<'role_assignment.created', RoleAssignment>
  revoked: BaseEvent<'role_assignment.revoked', { assignmentId: string }>
}

export interface PolicyEvents {
  created: BaseEvent<'policy.created', Policy>
  updated: BaseEvent<'policy.updated', Policy>
  deleted: BaseEvent<'policy.deleted', { id: string }>
  evaluated: BaseEvent<'policy.evaluated', { policyId: string; allowed: boolean }>
}

export interface PolicyBindingEvents {
  created: BaseEvent<'policy_binding.created', PolicyBinding>
  revoked: BaseEvent<'policy_binding.revoked', { bindingId: string }>
}

export interface GroupEvents {
  created: BaseEvent<'group.created', Group>
  updated: BaseEvent<'group.updated', Group>
  deleted: BaseEvent<'group.deleted', { id: string }>
  member_added: BaseEvent<'group.member_added', { groupId: string; userId: string }>
  member_removed: BaseEvent<'group.member_removed', { groupId: string; userId: string }>
  role_assigned: BaseEvent<'group.role_assigned', { groupId: string; roleId: string }>
  role_unassigned: BaseEvent<'group.role_unassigned', { groupId: string; roleId: string }>
}

export interface GroupMembershipEvents {
  created: BaseEvent<'group_membership.created', GroupMembership>
  updated: BaseEvent<'group_membership.updated', GroupMembership>
  deleted: BaseEvent<'group_membership.deleted', { id: string }>
}

export interface OrganizationEvents {
  created: BaseEvent<'organization.created', Organization>
  updated: BaseEvent<'organization.updated', Organization>
  deleted: BaseEvent<'organization.deleted', { id: string }>
  member_added: BaseEvent<'organization.member_added', { organizationId: string; userId: string; role: string }>
  member_removed: BaseEvent<'organization.member_removed', { organizationId: string; userId: string }>
  member_role_updated: BaseEvent<'organization.member_role_updated', { organizationId: string; userId: string; oldRole: string; newRole: string }>
  domain_verified: BaseEvent<'organization.domain_verified', { organizationId: string; domain: string }>
  settings_updated: BaseEvent<'organization.settings_updated', { organizationId: string }>
  suspended: BaseEvent<'organization.suspended', { organizationId: string; reason?: string }>
  activated: BaseEvent<'organization.activated', { organizationId: string }>
}

export interface OrganizationMemberEvents {
  created: BaseEvent<'organization_member.created', OrganizationMember>
  updated: BaseEvent<'organization_member.updated', OrganizationMember>
  deleted: BaseEvent<'organization_member.deleted', { id: string }>
  role_updated: BaseEvent<'organization_member.role_updated', { memberId: string; oldRole: string; newRole: string }>
  deactivated: BaseEvent<'organization_member.deactivated', { memberId: string }>
  activated: BaseEvent<'organization_member.activated', { memberId: string }>
}

export interface InvitationEvents {
  created: BaseEvent<'invitation.created', Invitation>
  accepted: BaseEvent<'invitation.accepted', { invitationId: string; userId: string }>
  revoked: BaseEvent<'invitation.revoked', { invitationId: string; reason?: string }>
  expired: BaseEvent<'invitation.expired', { invitationId: string }>
  resent: BaseEvent<'invitation.resent', { invitationId: string }>
}

export interface MFAEvents {
  created: BaseEvent<'mfa.created', MFA>
  updated: BaseEvent<'mfa.updated', MFA>
  deleted: BaseEvent<'mfa.deleted', { id: string }>
  enabled: BaseEvent<'mfa.enabled', { userId: string; type: MFAType }>
  disabled: BaseEvent<'mfa.disabled', { userId: string; type: MFAType }>
  verified: BaseEvent<'mfa.verified', { userId: string; mfaId: string }>
  backup_codes_generated: BaseEvent<'mfa.backup_codes_generated', { userId: string }>
}

export interface MFAChallengeEvents {
  created: BaseEvent<'mfa_challenge.created', MFAChallenge>
  verified: BaseEvent<'mfa_challenge.verified', { challengeId: string }>
  failed: BaseEvent<'mfa_challenge.failed', { challengeId: string }>
  expired: BaseEvent<'mfa_challenge.expired', { challengeId: string }>
}

export interface RecoveryCodeEvents {
  generated: BaseEvent<'recovery_code.generated', { userId: string; count: number }>
  used: BaseEvent<'recovery_code.used', { userId: string; codeId: string }>
  regenerated: BaseEvent<'recovery_code.regenerated', { userId: string }>
}

export interface PasswordResetEvents {
  created: BaseEvent<'password_reset.created', { email: string }>
  completed: BaseEvent<'password_reset.completed', { userId: string }>
  expired: BaseEvent<'password_reset.expired', { resetId: string }>
}

export interface EmailVerificationEvents {
  created: BaseEvent<'email_verification.created', { userId: string; email: string }>
  verified: BaseEvent<'email_verification.verified', { userId: string; email: string }>
  resent: BaseEvent<'email_verification.resent', { userId: string; email: string }>
  expired: BaseEvent<'email_verification.expired', { verificationId: string }>
}

export interface AuditLogEvents {
  created: BaseEvent<'audit_log.created', AuditLog>
}

export interface LoginAttemptEvents {
  recorded: BaseEvent<'login_attempt.recorded', LoginAttempt>
  succeeded: BaseEvent<'login_attempt.succeeded', { userId: string; sessionId: string }>
  failed: BaseEvent<'login_attempt.failed', { email?: string; reason: string }>
  locked: BaseEvent<'login_attempt.locked', { userId: string }>
}

export interface DeviceEvents {
  created: BaseEvent<'device.created', Device>
  updated: BaseEvent<'device.updated', Device>
  trusted: BaseEvent<'device.trusted', { deviceId: string; userId: string }>
  revoked: BaseEvent<'device.revoked', { deviceId: string; userId: string }>
}

export interface IPWhitelistEvents {
  created: BaseEvent<'ip_whitelist.created', IPWhitelist>
  updated: BaseEvent<'ip_whitelist.updated', IPWhitelist>
  deleted: BaseEvent<'ip_whitelist.deleted', { id: string }>
  activated: BaseEvent<'ip_whitelist.activated', { id: string }>
  deactivated: BaseEvent<'ip_whitelist.deactivated', { id: string }>
}

// =============================================================================
// Resources
// =============================================================================

export interface UserResource extends UserActions {
  on: <K extends keyof UserEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<UserEvents[K], TProxy>
  ) => () => void
}

export interface IdentityResource extends IdentityActions {
  on: <K extends keyof IdentityEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<IdentityEvents[K], TProxy>
  ) => () => void
}

export interface CredentialResource extends CredentialActions {
  on: <K extends keyof CredentialEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CredentialEvents[K], TProxy>
  ) => () => void
}

export interface SessionResource extends SessionActions {
  on: <K extends keyof SessionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SessionEvents[K], TProxy>
  ) => () => void
}

export interface TokenResource extends TokenActions {
  on: <K extends keyof TokenEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TokenEvents[K], TProxy>
  ) => () => void
}

export interface APIKeyResource extends APIKeyActions {
  on: <K extends keyof APIKeyEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<APIKeyEvents[K], TProxy>
  ) => () => void
}

export interface OAuth2ClientResource extends OAuth2ClientActions {
  on: <K extends keyof OAuth2ClientEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<OAuth2ClientEvents[K], TProxy>
  ) => () => void
}

export interface OAuth2GrantResource extends OAuth2GrantActions {
  on: <K extends keyof OAuth2GrantEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<OAuth2GrantEvents[K], TProxy>
  ) => () => void
}

export interface OAuth2TokenResource extends OAuth2TokenActions {
  on: <K extends keyof OAuth2TokenEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<OAuth2TokenEvents[K], TProxy>
  ) => () => void
}

export interface RoleResource extends RoleActions {
  on: <K extends keyof RoleEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<RoleEvents[K], TProxy>
  ) => () => void
}

export interface PermissionResource extends PermissionActions {
  on: <K extends keyof PermissionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PermissionEvents[K], TProxy>
  ) => () => void
}

export interface RoleAssignmentResource extends RoleAssignmentActions {
  on: <K extends keyof RoleAssignmentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<RoleAssignmentEvents[K], TProxy>
  ) => () => void
}

export interface PolicyResource extends PolicyActions {
  on: <K extends keyof PolicyEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PolicyEvents[K], TProxy>
  ) => () => void
}

export interface PolicyBindingResource extends PolicyBindingActions {
  on: <K extends keyof PolicyBindingEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PolicyBindingEvents[K], TProxy>
  ) => () => void
}

export interface GroupResource extends GroupActions {
  on: <K extends keyof GroupEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<GroupEvents[K], TProxy>
  ) => () => void
}

export interface GroupMembershipResource extends GroupMembershipActions {
  on: <K extends keyof GroupMembershipEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<GroupMembershipEvents[K], TProxy>
  ) => () => void
}

export interface OrganizationResource extends OrganizationActions {
  on: <K extends keyof OrganizationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<OrganizationEvents[K], TProxy>
  ) => () => void
}

export interface OrganizationMemberResource extends OrganizationMemberActions {
  on: <K extends keyof OrganizationMemberEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<OrganizationMemberEvents[K], TProxy>
  ) => () => void
}

export interface InvitationResource extends InvitationActions {
  on: <K extends keyof InvitationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<InvitationEvents[K], TProxy>
  ) => () => void
}

export interface MFAResource extends MFAActions {
  on: <K extends keyof MFAEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<MFAEvents[K], TProxy>
  ) => () => void
}

export interface MFAChallengeResource extends MFAChallengeActions {
  on: <K extends keyof MFAChallengeEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<MFAChallengeEvents[K], TProxy>
  ) => () => void
}

export interface RecoveryCodeResource extends RecoveryCodeActions {
  on: <K extends keyof RecoveryCodeEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<RecoveryCodeEvents[K], TProxy>
  ) => () => void
}

export interface PasswordResetResource extends PasswordResetActions {
  on: <K extends keyof PasswordResetEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PasswordResetEvents[K], TProxy>
  ) => () => void
}

export interface EmailVerificationResource extends EmailVerificationActions {
  on: <K extends keyof EmailVerificationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<EmailVerificationEvents[K], TProxy>
  ) => () => void
}

export interface AuditLogResource extends AuditLogActions {
  on: <K extends keyof AuditLogEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AuditLogEvents[K], TProxy>
  ) => () => void
}

export interface LoginAttemptResource extends LoginAttemptActions {
  on: <K extends keyof LoginAttemptEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<LoginAttemptEvents[K], TProxy>
  ) => () => void
}

export interface DeviceResource extends DeviceActions {
  on: <K extends keyof DeviceEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DeviceEvents[K], TProxy>
  ) => () => void
}

export interface IPWhitelistResource extends IPWhitelistActions {
  on: <K extends keyof IPWhitelistEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<IPWhitelistEvents[K], TProxy>
  ) => () => void
}

// =============================================================================
// Auth Proxy (unified interface)
// =============================================================================

/**
 * Complete Authentication & Identity interface combining all resources.
 *
 * @example
 * ```ts
 * const auth: AuthProxy = getAuthProxy()
 *
 * // Create a user
 * const user = await auth.users.create({
 *   email: 'john@example.com',
 *   emailVerified: false,
 *   status: 'pending_verification'
 * })
 *
 * // Create a session
 * const session = await auth.sessions.create({
 *   userId: user.id,
 *   status: 'active',
 *   expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
 * })
 *
 * // Subscribe to events
 * auth.users.on('created', async (event, ctx) => {
 *   console.log('New user:', event.data.email)
 *
 *   // Send verification email
 *   await ctx.$.emailVerifications.createVerification({
 *     userId: event.data.id,
 *     email: event.data.email
 *   })
 * })
 *
 * // Assign role
 * const assignment = await auth.roleAssignments.create({
 *   userId: user.id,
 *   roleId: 'role_admin',
 *   scope: 'global'
 * })
 *
 * // Setup MFA
 * const mfa = await auth.mfa.setupTOTP({
 *   userId: user.id,
 *   name: 'Authenticator App'
 * })
 * ```
 */
export interface AuthProxy {
  /** User management */
  users: UserResource
  /** Identity management */
  identities: IdentityResource
  /** Credential management */
  credentials: CredentialResource
  /** Session management */
  sessions: SessionResource
  /** Token management */
  tokens: TokenResource
  /** API key management */
  apiKeys: APIKeyResource
  /** OAuth2 client management */
  oauth2Clients: OAuth2ClientResource
  /** OAuth2 grant management */
  oauth2Grants: OAuth2GrantResource
  /** OAuth2 token management */
  oauth2Tokens: OAuth2TokenResource
  /** Role management */
  roles: RoleResource
  /** Permission management */
  permissions: PermissionResource
  /** Role assignment management */
  roleAssignments: RoleAssignmentResource
  /** Policy management */
  policies: PolicyResource
  /** Policy binding management */
  policyBindings: PolicyBindingResource
  /** Group management */
  groups: GroupResource
  /** Group membership management */
  groupMemberships: GroupMembershipResource
  /** Organization management */
  organizations: OrganizationResource
  /** Organization member management */
  organizationMembers: OrganizationMemberResource
  /** Invitation management */
  invitations: InvitationResource
  /** MFA management */
  mfa: MFAResource
  /** MFA challenge management */
  mfaChallenges: MFAChallengeResource
  /** Recovery code management */
  recoveryCodes: RecoveryCodeResource
  /** Password reset management */
  passwordResets: PasswordResetResource
  /** Email verification management */
  emailVerifications: EmailVerificationResource
  /** Audit log management */
  auditLogs: AuditLogResource
  /** Login attempt management */
  loginAttempts: LoginAttemptResource
  /** Device management */
  devices: DeviceResource
  /** IP whitelist management */
  ipWhitelists: IPWhitelistResource
}

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported authentication providers.
 */
export type AuthProvider =
  | 'auth0'
  | 'okta'
  | 'clerk'
  | 'firebase'
  | 'cognito'
  | 'supabase'
  | 'keycloak'
  | 'fusionauth'
  | 'custom'

/**
 * Provider configuration.
 */
export interface AuthProviderConfig {
  provider: AuthProvider
  domain?: string
  clientId?: string
  clientSecret?: string
  apiKey?: string
  region?: string
  tenantId?: string
  audience?: string
  issuer?: string
  jwksUri?: string
  tokenEndpoint?: string
  userInfoEndpoint?: string
  authorizationEndpoint?: string
  redirectUri?: string
}
