/**
 * Workflow definition (automation sequences)
 */

import type { WorkflowDefinition, WorkflowAction, WorkflowTrigger } from './types.js'

/**
 * Define an automated workflow with triggers and actions
 *
 * @example
 * ```ts
 * const workflow = Workflow({
 *   name: 'New Customer Welcome',
 *   description: 'Automated welcome sequence for new customers',
 *   trigger: {
 *     type: 'event',
 *     event: 'Customer.created',
 *   },
 *   actions: [
 *     {
 *       order: 1,
 *       type: 'send',
 *       description: 'Send welcome email',
 *       params: {
 *         template: 'welcome_email',
 *         to: '{{customer.email}}',
 *       },
 *     },
 *     {
 *       order: 2,
 *       type: 'create',
 *       description: 'Create onboarding task',
 *       params: {
 *         type: 'Task',
 *         title: 'Onboard {{customer.name}}',
 *         assignee: 'customer_success_team',
 *       },
 *     },
 *     {
 *       order: 3,
 *       type: 'wait',
 *       description: 'Wait 24 hours',
 *       params: {
 *         duration: '24 hours',
 *       },
 *     },
 *     {
 *       order: 4,
 *       type: 'notify',
 *       description: 'Send setup reminder',
 *       params: {
 *         channel: 'email',
 *         message: 'Reminder to complete setup',
 *       },
 *       condition: 'customer.setupCompleted === false',
 *     },
 *   ],
 * })
 * ```
 */
export function Workflow(definition: WorkflowDefinition): WorkflowDefinition {
  if (!definition.name) {
    throw new Error('Workflow name is required')
  }

  if (!definition.trigger) {
    throw new Error('Workflow trigger is required')
  }

  return {
    ...definition,
    actions: definition.actions || [],
    metadata: definition.metadata || {},
  }
}

/**
 * Get actions in execution order
 */
export function getActionsInOrder(workflow: WorkflowDefinition): WorkflowAction[] {
  return [...(workflow.actions || [])].sort((a, b) => a.order - b.order)
}

/**
 * Get actions by type
 */
export function getActionsByType(
  workflow: WorkflowDefinition,
  type: WorkflowAction['type']
): WorkflowAction[] {
  return workflow.actions?.filter(action => action.type === type) || []
}

/**
 * Get conditional actions
 */
export function getConditionalActions(workflow: WorkflowDefinition): WorkflowAction[] {
  return workflow.actions?.filter(action => action.condition) || []
}

/**
 * Add action to workflow
 */
export function addAction(workflow: WorkflowDefinition, action: WorkflowAction): WorkflowDefinition {
  return {
    ...workflow,
    actions: [...(workflow.actions || []), action],
  }
}

/**
 * Remove action from workflow
 */
export function removeAction(workflow: WorkflowDefinition, order: number): WorkflowDefinition {
  return {
    ...workflow,
    actions: workflow.actions?.filter(a => a.order !== order),
  }
}

/**
 * Update action in workflow
 */
export function updateAction(
  workflow: WorkflowDefinition,
  order: number,
  updates: Partial<WorkflowAction>
): WorkflowDefinition {
  const actions = workflow.actions?.map(action =>
    action.order === order ? { ...action, ...updates } : action
  )

  return {
    ...workflow,
    actions,
  }
}

/**
 * Check if trigger is event-based
 */
export function isEventTrigger(trigger: WorkflowTrigger): boolean {
  return trigger.type === 'event'
}

/**
 * Check if trigger is schedule-based
 */
export function isScheduleTrigger(trigger: WorkflowTrigger): boolean {
  return trigger.type === 'schedule'
}

/**
 * Check if trigger is webhook-based
 */
export function isWebhookTrigger(trigger: WorkflowTrigger): boolean {
  return trigger.type === 'webhook'
}

/**
 * Parse wait duration to milliseconds
 */
export function parseWaitDuration(duration: string): number {
  const match = duration.match(/(\d+)\s*(ms|millisecond|milliseconds|s|second|seconds|m|minute|minutes|h|hour|hours|d|day|days)/)
  if (!match) return 0

  const value = parseInt(match[1] || '0', 10)
  const unit = match[2]

  switch (unit) {
    case 'ms':
    case 'millisecond':
    case 'milliseconds':
      return value
    case 's':
    case 'second':
    case 'seconds':
      return value * 1000
    case 'm':
    case 'minute':
    case 'minutes':
      return value * 60 * 1000
    case 'h':
    case 'hour':
    case 'hours':
      return value * 60 * 60 * 1000
    case 'd':
    case 'day':
    case 'days':
      return value * 24 * 60 * 60 * 1000
    default:
      return 0
  }
}

/**
 * Evaluate condition (simple implementation)
 */
export function evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
  // This is a simplified implementation
  // In production, use a proper expression evaluator
  try {
    // Replace variable references with actual values
    let expression = condition
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g')
      expression = expression.replace(regex, JSON.stringify(value))
    }

    // Evaluate the expression (unsafe in production - use a proper evaluator)
    return Boolean(eval(expression))
  } catch {
    return false
  }
}

/**
 * Fill template with context values
 */
export function fillTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const value = getNestedValue(context, path.trim())
    return String(value ?? '')
  })
}

/**
 * Get nested value from object by path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: any, part) => acc?.[part], obj)
}

/**
 * Validate workflow definition
 */
export function validateWorkflow(workflow: WorkflowDefinition): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!workflow.name) {
    errors.push('Workflow name is required')
  }

  if (!workflow.trigger) {
    errors.push('Workflow trigger is required')
  } else {
    if (workflow.trigger.type === 'event' && !workflow.trigger.event) {
      errors.push('Event trigger must specify an event name')
    }
    if (workflow.trigger.type === 'schedule' && !workflow.trigger.schedule) {
      errors.push('Schedule trigger must specify a schedule expression')
    }
    if (workflow.trigger.type === 'webhook' && !workflow.trigger.webhook) {
      errors.push('Webhook trigger must specify a webhook URL')
    }
  }

  if (workflow.actions) {
    const orders = new Set<number>()
    for (const action of workflow.actions) {
      if (!action.type) {
        errors.push(`Action at order ${action.order} must have a type`)
      }
      if (orders.has(action.order)) {
        errors.push(`Duplicate action order: ${action.order}`)
      }
      orders.add(action.order)

      // Validate action-specific requirements
      if (action.type === 'wait' && !action.params?.duration) {
        errors.push(`Wait action at order ${action.order} must specify duration`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
