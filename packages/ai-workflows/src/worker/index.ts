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
 *   creation, lifecycle, event emission, and state persistence
 *
 * - **WorkflowStateAdapter**: Persistent storage for workflow state using
 *   ai-database, with optimistic locking, checkpoints, and snapshots
 *
 * @example
 * ```typescript
 * import {
 *   DurableStep,
 *   WorkflowBuilder,
 *   WorkflowService,
 *   WorkflowServiceCore,
 *   WorkflowStateAdapter
 * } from 'ai-workflows/worker'
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
 * @example State Persistence with WorkflowServiceCore
 * ```typescript
 * import { DB } from 'ai-database'
 * import { WorkflowServiceCore } from 'ai-workflows/worker'
 *
 * // Create database and service with persistence
 * const { db } = DB({ WorkflowState: { status: 'string' } })
 * const service = new WorkflowServiceCore(db)
 *
 * // Create workflow and persist state
 * const workflow = service.create('order-processor')
 * await service.persistState(workflow.id, {
 *   workflowId: workflow.id,
 *   status: 'running',
 *   currentStep: 'validate-order',
 *   context: { orderId: 'order-123' }
 * })
 *
 * // Save step checkpoint
 * await service.saveCheckpoint(workflow.id, 'validate-order', {
 *   stepId: 'validate-order',
 *   status: 'completed',
 *   result: { valid: true },
 *   attempt: 1
 * })
 *
 * // Query workflows by status
 * const runningWorkflows = await service.queryByStatus('running')
 *
 * // Create snapshot before risky operation
 * const snapshotId = await service.createSnapshot(workflow.id, 'before-payment')
 *
 * // Restore if something goes wrong
 * await service.restoreSnapshot(workflow.id, snapshotId)
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
// WorkflowStateAdapter - Persistent workflow state storage
// =============================================================================

export {
  WorkflowStateAdapter,
  type PersistedWorkflowState,
  type StepCheckpoint,
  type WorkflowHistoryEntry as StateHistoryEntry,
  type SnapshotInfo,
  type DatabaseConnection,
} from './state-adapter.js'

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
