/**
 * Core types for services-as-software
 */

import type { AIFunctionDefinition, JSONSchema as AIJSONSchema } from 'ai-functions'

// Re-export JSONSchema for use in this package
export type JSONSchema = AIJSONSchema

// Use Promise for RPC interface definitions
type RpcPromise<T> = Promise<T>

/**
 * Pricing models for services
 */
export type PricingModel =
  | 'free'
  | 'fixed'
  | 'per-use'
  | 'subscription'
  | 'tiered'
  | 'usage-based'
  | 'custom'

/**
 * Billing intervals for subscriptions
 */
export type BillingInterval = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

/**
 * Service status
 */
export type ServiceStatus = 'active' | 'inactive' | 'deprecated' | 'beta' | 'alpha'

/**
 * Order status
 */
export type OrderStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

/**
 * Subscription status
 */
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'expired' | 'pending'

/**
 * Currency code (ISO 4217)
 */
export type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CNY' | string

/**
 * Pricing configuration
 */
export interface PricingConfig {
  /** Pricing model type */
  model: PricingModel
  /** Base price (for fixed or subscription) */
  basePrice?: number
  /** Currency code */
  currency?: Currency
  /** Price per unit (for per-use or usage-based) */
  pricePerUnit?: number
  /** Billing interval (for subscriptions) */
  interval?: BillingInterval
  /** Usage tiers (for tiered pricing) */
  tiers?: PricingTier[]
  /** Free tier limits */
  freeTier?: {
    requests?: number
    units?: number
    resetInterval?: BillingInterval
  }
}

/**
 * Pricing tier for tiered pricing models
 */
export interface PricingTier {
  /** Starting quantity for this tier */
  from: number
  /** Ending quantity (exclusive) - undefined means no upper limit */
  to?: number
  /** Price per unit in this tier */
  pricePerUnit: number
  /** Fixed price for this tier */
  fixedPrice?: number
}

/**
 * Service endpoint definition
 */
export interface EndpointDefinition<TInput = unknown, TOutput = unknown> {
  /** Endpoint name */
  name: string
  /** Description of what this endpoint does */
  description?: string
  /** HTTP method (for REST endpoints) */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  /** Path pattern (e.g., '/users/:id') */
  path?: string
  /** Input schema */
  input?: JSONSchema
  /** Output schema */
  output?: JSONSchema
  /** Handler function */
  handler: (input: TInput, context?: ServiceContext) => TOutput | Promise<TOutput>
  /** Pricing specific to this endpoint */
  pricing?: PricingConfig
  /** Rate limiting */
  rateLimit?: {
    requests: number
    window: number // milliseconds
  }
  /** Whether authentication is required */
  requiresAuth?: boolean
}

/**
 * Service context provided to endpoint handlers
 */
export interface ServiceContext {
  /** Customer/user ID */
  customerId?: string
  /** Subscription ID */
  subscriptionId?: string
  /** Request ID for tracing */
  requestId: string
  /** Request metadata */
  metadata?: Record<string, unknown>
  /** Entitlements for this customer */
  entitlements: string[]
  /** Usage tracking */
  usage?: UsageTracker
}

/**
 * Usage tracker for billing and analytics
 */
export interface UsageTracker {
  /** Track a usage event */
  track(event: UsageEvent): Promise<void>
  /** Get current usage for a customer */
  get(customerId: string, period?: { start: Date; end: Date }): Promise<Usage>
}

/**
 * Usage event
 */
export interface UsageEvent {
  /** Customer ID */
  customerId: string
  /** Endpoint or resource that was used */
  resource: string
  /** Quantity used */
  quantity: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
  /** Timestamp */
  timestamp?: Date
}

/**
 * Usage summary
 */
export interface Usage {
  /** Customer ID */
  customerId: string
  /** Usage by resource */
  byResource: Record<string, number>
  /** Total usage */
  total: number
  /** Period start */
  periodStart: Date
  /** Period end */
  periodEnd: Date
}

/**
 * Service definition
 */
export interface ServiceDefinition {
  /** Service name */
  name: string
  /** Service version */
  version: string
  /** Description */
  description?: string
  /** Service status */
  status?: ServiceStatus
  /** Service endpoints */
  endpoints: EndpointDefinition[]
  /** Default pricing configuration */
  pricing?: PricingConfig
  /** Service-level functions (AI tools) */
  functions?: AIFunctionDefinition[]
  /** Event handlers */
  events?: Record<string, EventHandler>
  /** Scheduled tasks */
  scheduled?: ScheduledTask[]
  /** Subscription plans */
  plans?: SubscriptionPlan[]
  /** Entitlement definitions */
  entitlements?: EntitlementDefinition[]
  /** KPI definitions */
  kpis?: KPIDefinition[]
  /** OKR definitions */
  okrs?: OKRDefinition[]
}

/**
 * Event handler definition
 */
export interface EventHandler<TPayload = unknown> {
  /** Event name/pattern */
  event: string
  /** Handler function */
  handler: (payload: TPayload, context?: ServiceContext) => void | Promise<void>
  /** Whether to retry on failure */
  retry?: boolean
  /** Max retry attempts */
  maxRetries?: number
}

/**
 * Scheduled task definition
 */
export interface ScheduledTask<TInput = unknown> {
  /** Task name */
  name: string
  /** Cron expression or interval */
  schedule: string
  /** Task handler */
  handler: (input?: TInput, context?: ServiceContext) => void | Promise<void>
  /** Whether task is enabled */
  enabled?: boolean
}

/**
 * Subscription plan
 */
export interface SubscriptionPlan {
  /** Plan ID */
  id: string
  /** Plan name */
  name: string
  /** Description */
  description?: string
  /** Pricing configuration */
  pricing: PricingConfig
  /** Entitlements included */
  entitlements: string[]
  /** Features included */
  features: string[]
  /** Usage limits */
  limits?: Record<string, number>
  /** Trial period (days) */
  trialDays?: number
}

/**
 * Entitlement definition
 */
export interface EntitlementDefinition {
  /** Entitlement ID */
  id: string
  /** Human-readable name */
  name: string
  /** Description */
  description?: string
  /** Resource type this entitlement grants access to */
  resource?: string
  /** Actions permitted */
  actions?: string[]
}

/**
 * KPI (Key Performance Indicator) definition
 */
export interface KPIDefinition {
  /** KPI ID */
  id: string
  /** KPI name */
  name: string
  /** Description */
  description?: string
  /** How to calculate this KPI */
  calculate: () => Promise<number | string>
  /** Target value */
  target?: number | string
  /** Unit of measurement */
  unit?: string
  /** Update frequency */
  updateInterval?: BillingInterval
}

/**
 * OKR (Objectives and Key Results) definition
 */
export interface OKRDefinition {
  /** OKR ID */
  id: string
  /** Objective statement */
  objective: string
  /** Key results */
  keyResults: KeyResult[]
  /** Quarter or time period */
  period?: string
  /** Owner */
  owner?: string
}

/**
 * Key Result within an OKR
 */
export interface KeyResult {
  /** Key result description */
  description: string
  /** How to measure this result */
  measure: () => Promise<number>
  /** Target value */
  target: number
  /** Current value */
  current?: number
  /** Unit of measurement */
  unit?: string
}

/**
 * Order definition
 */
export interface Order<TProduct = unknown> {
  /** Order ID */
  id: string
  /** Customer ID */
  customerId: string
  /** Product or service being ordered */
  product: TProduct
  /** Quantity */
  quantity: number
  /** Total price */
  total: number
  /** Currency */
  currency: Currency
  /** Order status */
  status: OrderStatus
  /** Created timestamp */
  createdAt: Date
  /** Updated timestamp */
  updatedAt: Date
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Quote definition
 */
export interface Quote<TProduct = unknown> {
  /** Quote ID */
  id: string
  /** Customer ID */
  customerId: string
  /** Product or service being quoted */
  product: TProduct
  /** Quantity */
  quantity: number
  /** Quoted price */
  price: number
  /** Currency */
  currency: Currency
  /** Valid until */
  expiresAt: Date
  /** Quote metadata */
  metadata?: Record<string, unknown>
}

/**
 * Subscription definition
 */
export interface Subscription {
  /** Subscription ID */
  id: string
  /** Customer ID */
  customerId: string
  /** Plan ID */
  planId: string
  /** Subscription status */
  status: SubscriptionStatus
  /** Current period start */
  currentPeriodStart: Date
  /** Current period end */
  currentPeriodEnd: Date
  /** Cancel at period end */
  cancelAtPeriodEnd?: boolean
  /** Trial end date */
  trialEnd?: Date
  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Notification definition
 */
export interface Notification {
  /** Notification ID */
  id: string
  /** Recipient(s) */
  to: string | string[]
  /** Subject */
  subject: string
  /** Message body */
  body: string
  /** Channel (email, slack, sms, etc.) */
  channel: string
  /** Priority */
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  /** Metadata */
  metadata?: Record<string, unknown>
}

/**
 * Service client interface
 */
export interface ServiceClient {
  /** Ask a question to the service */
  ask(question: string, context?: unknown): RpcPromise<string>

  /** Deliver results */
  deliver(orderId: string, results: unknown): RpcPromise<void>

  /** Execute a task */
  do(action: string, input?: unknown): RpcPromise<unknown>

  /** Generate content */
  generate(prompt: string, options?: unknown): RpcPromise<unknown>

  /** Type checking/validation */
  is(value: unknown, type: string | JSONSchema): RpcPromise<boolean>

  /** Send notification */
  notify(notification: Notification): RpcPromise<void>

  /** Place an order */
  order<TProduct>(product: TProduct, quantity: number): RpcPromise<Order<TProduct>>

  /** Request a quote */
  quote<TProduct>(product: TProduct, quantity: number): RpcPromise<Quote<TProduct>>

  /** Subscribe to a plan */
  subscribe(planId: string): RpcPromise<Subscription>

  /** Get entitlements */
  entitlements(): RpcPromise<string[]>

  /** Get KPIs */
  kpis(): RpcPromise<Record<string, number | string>>

  /** Get OKRs */
  okrs(): RpcPromise<OKRDefinition[]>
}

/**
 * Service instance returned by Service()
 */
export interface Service extends ServiceClient {
  /** Service definition */
  definition: ServiceDefinition

  /** Call an endpoint directly */
  call<TInput, TOutput>(
    endpoint: string,
    input: TInput,
    context?: ServiceContext
  ): RpcPromise<TOutput>

  /** Register an event handler */
  on<TPayload>(
    event: string,
    handler: (payload: TPayload, context?: ServiceContext) => void | Promise<void>
  ): void

  /** Schedule a recurring task */
  every(
    schedule: string,
    handler: (context?: ServiceContext) => void | Promise<void>
  ): void

  /** Add a queue processor */
  queue<TJob>(
    name: string,
    handler: (job: TJob, context?: ServiceContext) => void | Promise<void>
  ): void

  /** Get service as RPC target */
  asRPC(): unknown

  /** Get service as API routes */
  asAPI(): unknown
}

/**
 * Provider interface for services
 */
export interface Provider {
  /** Provider name */
  name: string

  /** Base URL */
  baseUrl: string

  /** Authentication configuration */
  auth?: {
    type: 'api-key' | 'oauth' | 'jwt' | 'basic'
    credentials: Record<string, string>
  }

  /** Available services */
  services: string[]

  /** Get a service client */
  service<T extends ServiceClient>(serviceName: string): T
}

/**
 * Client configuration for connecting to remote services
 */
export interface ClientConfig {
  /** Service URL or provider */
  url?: string

  /** Provider instance */
  provider?: Provider

  /** Authentication */
  auth?: {
    type: 'api-key' | 'oauth' | 'jwt' | 'basic'
    credentials: Record<string, string>
  }

  /** Custom headers */
  headers?: Record<string, string>

  /** Timeout (milliseconds) */
  timeout?: number
}
