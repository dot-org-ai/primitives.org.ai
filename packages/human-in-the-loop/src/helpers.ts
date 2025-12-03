/**
 * Helper functions for common human-in-the-loop patterns
 */

import type {
  Role,
  Team,
  Goals,
  KPIs,
  OKRs,
  Human as HumanType,
  ApprovalResponse,
  ReviewResponse,
} from './types.js'
import { Human } from './human.js'

/**
 * Create a default Human instance for convenience
 */
const defaultHuman = Human()

/**
 * Define a human role
 *
 * @example
 * ```ts
 * const techLead = Role({
 *   id: 'tech-lead',
 *   name: 'Tech Lead',
 *   capabilities: ['approve-prs', 'deploy-prod'],
 *   escalatesTo: 'engineering-manager',
 * })
 * ```
 */
export function Role(role: Role): Role {
  return defaultHuman.defineRole(role)
}

/**
 * Define a team
 *
 * @example
 * ```ts
 * const engineering = Team({
 *   id: 'engineering',
 *   name: 'Engineering Team',
 *   members: ['alice', 'bob', 'charlie'],
 *   lead: 'alice',
 * })
 * ```
 */
export function Team(team: Team): Team {
  return defaultHuman.defineTeam(team)
}

/**
 * Define goals for a team or individual
 *
 * @example
 * ```ts
 * const q1Goals = Goals({
 *   id: 'q1-2024',
 *   objectives: [
 *     'Launch v2.0',
 *     'Improve performance by 50%',
 *   ],
 *   targetDate: new Date('2024-03-31'),
 * })
 * ```
 */
export function Goals(goals: Goals): Goals {
  return defaultHuman.defineGoals(goals)
}

/**
 * Request approval from a human
 *
 * @example
 * ```ts
 * const result = await approve({
 *   title: 'Deploy to production',
 *   description: 'Deploy v2.0.0 to production',
 *   subject: 'Production Deployment',
 *   input: { version: '2.0.0', environment: 'prod' },
 *   assignee: 'tech-lead@example.com',
 *   priority: 'high',
 * })
 *
 * if (result.approved) {
 *   await deploy()
 * }
 * ```
 */
export async function approve<TData = unknown>(params: {
  title: string
  description: string
  subject: string
  input: TData
  assignee?: string | string[]
  role?: string
  team?: string
  priority?: 'low' | 'normal' | 'high' | 'critical'
  timeout?: number
  escalatesTo?: string | string[]
  requiresApproval?: boolean
  approvers?: string[]
  metadata?: Record<string, unknown>
}): Promise<ApprovalResponse> {
  return defaultHuman.approve(params)
}

/**
 * Ask a question to a human
 *
 * @example
 * ```ts
 * const answer = await ask({
 *   title: 'Product naming',
 *   question: 'What should we name the new feature?',
 *   context: { feature: 'AI Assistant' },
 *   assignee: 'product-manager@example.com',
 * })
 * ```
 */
export async function ask(params: {
  title: string
  question: string
  context?: unknown
  assignee?: string | string[]
  role?: string
  team?: string
  priority?: 'low' | 'normal' | 'high' | 'critical'
  timeout?: number
  suggestions?: string[]
  metadata?: Record<string, unknown>
}): Promise<string> {
  return defaultHuman.ask(params)
}

/**
 * Request a human to perform a task
 *
 * This uses the digital-workers interface for humans
 *
 * @example
 * ```ts
 * const result = await do({
 *   title: 'Review code',
 *   instructions: 'Review the PR and provide feedback',
 *   input: { prUrl: 'https://github.com/...' },
 *   assignee: 'senior-dev@example.com',
 * })
 * ```
 */
export async function do_<TInput = unknown, TOutput = unknown>(params: {
  title: string
  instructions: string
  input: TInput
  assignee?: string | string[]
  role?: string
  team?: string
  priority?: 'low' | 'normal' | 'high' | 'critical'
  timeout?: number
  tools?: any[]
  estimatedEffort?: string
  metadata?: Record<string, unknown>
}): Promise<TOutput> {
  return defaultHuman.do(params)
}

// Export as 'do' for the API, but define as 'do_' to avoid reserved keyword
export { do_ as do }

/**
 * Request a human to make a decision
 *
 * @example
 * ```ts
 * const choice = await decide({
 *   title: 'Pick deployment strategy',
 *   options: ['blue-green', 'canary', 'rolling'],
 *   context: { risk: 'high', users: 100000 },
 *   assignee: 'devops-lead@example.com',
 * })
 * ```
 */
export async function decide<TOptions extends string = string>(params: {
  title: string
  description?: string
  options: TOptions[]
  context?: unknown
  assignee?: string | string[]
  role?: string
  team?: string
  priority?: 'low' | 'normal' | 'high' | 'critical'
  timeout?: number
  criteria?: string[]
  metadata?: Record<string, unknown>
}): Promise<TOptions> {
  return defaultHuman.decide(params)
}

/**
 * Request generation/content creation from a human
 *
 * This is a specialized form of do() for content generation
 *
 * @example
 * ```ts
 * const content = await generate({
 *   title: 'Write blog post',
 *   instructions: 'Write a blog post about our new feature',
 *   input: { topic: 'AI Assistant', targetAudience: 'developers' },
 *   assignee: 'content-writer@example.com',
 * })
 * ```
 */
export async function generate<TInput = unknown>(params: {
  title: string
  instructions: string
  input: TInput
  assignee?: string | string[]
  role?: string
  team?: string
  priority?: 'low' | 'normal' | 'high' | 'critical'
  timeout?: number
  metadata?: Record<string, unknown>
}): Promise<string> {
  return defaultHuman.do<TInput, string>(params)
}

/**
 * Type checking/validation request
 *
 * Ask a human to validate data or check type compliance
 *
 * @example
 * ```ts
 * const valid = await is({
 *   title: 'Validate user data',
 *   question: 'Is this user data valid and complete?',
 *   input: userData,
 *   assignee: 'data-specialist@example.com',
 * })
 * ```
 */
export async function is(params: {
  title: string
  question: string
  input: unknown
  assignee?: string | string[]
  role?: string
  team?: string
  priority?: 'low' | 'normal' | 'high' | 'critical'
  timeout?: number
  metadata?: Record<string, unknown>
}): Promise<boolean> {
  const result = await defaultHuman.decide<'true' | 'false'>({
    title: params.title,
    description: params.question,
    options: ['true', 'false'],
    context: params.input,
    assignee: params.assignee,
    role: params.role,
    team: params.team,
    priority: params.priority,
    timeout: params.timeout,
    metadata: params.metadata,
  })

  return result === 'true'
}

/**
 * Send a notification to a human
 *
 * @example
 * ```ts
 * await notify({
 *   type: 'info',
 *   title: 'Deployment complete',
 *   message: 'Version 2.0.0 deployed successfully',
 *   recipient: 'team@example.com',
 *   channels: ['slack', 'email'],
 * })
 * ```
 */
export async function notify(params: {
  type: 'info' | 'warning' | 'error' | 'success'
  title: string
  message: string
  recipient: string | string[]
  channels?: ('slack' | 'email' | 'sms' | 'web')[]
  priority?: 'low' | 'normal' | 'high' | 'critical'
  data?: unknown
}): Promise<void> {
  await defaultHuman.notify(params)
}

/**
 * Track Key Performance Indicators
 *
 * @example
 * ```ts
 * kpis({
 *   id: 'monthly-revenue',
 *   name: 'Monthly Revenue',
 *   value: 150000,
 *   target: 200000,
 *   unit: 'USD',
 *   trend: 'up',
 * })
 * ```
 */
export function kpis(kpis: KPIs): KPIs {
  return defaultHuman.trackKPIs(kpis)
}

/**
 * Define Objectives and Key Results
 *
 * @example
 * ```ts
 * okrs({
 *   id: 'q1-2024-growth',
 *   objective: 'Accelerate user growth',
 *   keyResults: [
 *     {
 *       description: 'Increase active users by 50%',
 *       progress: 0.3,
 *       current: 13000,
 *       target: 15000,
 *     },
 *     {
 *       description: 'Achieve 95% customer satisfaction',
 *       progress: 0.85,
 *       current: 0.93,
 *       target: 0.95,
 *     },
 *   ],
 *   period: 'Q1 2024',
 *   owner: 'ceo@example.com',
 * })
 * ```
 */
export function okrs(okrs: OKRs): OKRs {
  return defaultHuman.defineOKRs(okrs)
}

/**
 * Register a human worker in the system
 *
 * @example
 * ```ts
 * const alice = registerHuman({
 *   id: 'alice',
 *   name: 'Alice Smith',
 *   email: 'alice@example.com',
 *   roles: ['tech-lead', 'developer'],
 *   teams: ['engineering', 'frontend'],
 *   channels: {
 *     slack: '@alice',
 *     email: 'alice@example.com',
 *   },
 * })
 * ```
 */
export function registerHuman(human: HumanType): HumanType {
  return defaultHuman.registerHuman(human)
}

/**
 * Get the default Human manager instance
 *
 * Use this to access the underlying HumanManager for advanced operations
 */
export function getDefaultHuman(): ReturnType<typeof Human> {
  return defaultHuman
}
