/**
 * Worker module exports for ai-workflows
 *
 * This module provides Cloudflare Workers-specific functionality:
 *
 * - **DurableStep**: Wrapper for Cloudflare Workflows step semantics with
 *   durable execution, retries, sleep, and step metadata
 *
 * - **StepContext**: Context provided to step functions for additional
 *   operations like nested durable calls and sleep
 *
 * - **WorkflowBuilder**: Declarative DSL for building workflows with
 *   step definitions, dependencies, triggers, and schedules
 *
 * - **WorkflowService**: WorkerEntrypoint for RPC access to workflow
 *   functionality via service bindings
 *
 * - **WorkflowServiceCore**: Core RPC-enabled service for workflow
 *   creation, lifecycle, and event emission
 *
 * @example
 * ```typescript
 * import { DurableStep, WorkflowBuilder, WorkflowService } from 'ai-workflows/worker'
 *
 * // Create a durable step
 * const fetchData = new DurableStep('fetch-data', async (input: { url: string }) => {
 *   const response = await fetch(input.url)
 *   return response.json()
 * })
 *
 * // Build a workflow
 * const workflow = WorkflowBuilder.create('order-process')
 *   .step('validate', validateOrder)
 *   .step('charge', chargePayment).dependsOn('validate')
 *   .on('Order.placed').do('validate')
 *   .build()
 *
 * // Export WorkflowService as your worker entrypoint
 * export { WorkflowService }
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// DurableStep - Durable function execution wrapper
// =============================================================================

export {
  DurableStep,
  StepContext,
  type StepConfig,
  type StepMetadata,
  type RetryConfig,
  type WorkflowStep,
  type StepFunction,
} from './durable-step.js'

// =============================================================================
// WorkflowBuilder - Declarative workflow definition DSL
// =============================================================================

export {
  WorkflowBuilder,
  type WorkflowBuilderConfig,
  type StepDefinition,
  type StepChain,
  type TriggerConfig,
  type ScheduleConfig,
  type BuiltWorkflow,
  type ExecutionContext,
  type EventTriggerChain,
  type ScheduleTriggerChain,
  type NumericScheduleChain,
  type DependencyOptions,
} from './workflow-builder.js'

// =============================================================================
// WorkflowService - RPC-enabled workflow service
// =============================================================================

// Re-export from parent worker.ts for complete worker functionality
export {
  WorkflowService,
  WorkflowServiceCore,
  WorkflowWorker,
  TestWorkflow,
  type Env,
  type WorkflowInstanceInfo,
} from '../worker.js'

// =============================================================================
// Types - Re-export commonly needed types from main package
// =============================================================================

export type {
  WorkflowContext,
  WorkflowState,
  WorkflowHistoryEntry,
  EventHandler,
  ScheduleHandler,
  ScheduleInterval,
  ParsedEvent,
} from '../types.js'
