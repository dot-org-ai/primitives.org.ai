/**
 * Catalog barrel — autonomous-it Services.
 *
 * Ships three Services (`helpdeskTicketResolver`, `endpointFleetMonitor`,
 * `identityLifecycleOrchestrator`).
 *
 * Per v3 §12, catalog Services are module-evaluated TypeScript that yield a
 * typed `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `helpdeskTicketResolver.invoke(input)`.
 *
 * @packageDocumentation
 */

export {
  helpdeskTicketResolver,
  HelpdeskTicketResolverInputSchema,
  HelpdeskTicketResolverOutputSchema,
  type HelpdeskTicketResolverInput,
  type HelpdeskTicketResolverOutput,
} from './helpdesk-ticket-resolver.js'

export {
  endpointFleetMonitor,
  EndpointFleetMonitorInputSchema,
  EndpointFleetMonitorOutputSchema,
  type EndpointFleetMonitorInput,
  type EndpointFleetMonitorOutput,
} from './endpoint-fleet-monitor.js'

export {
  identityLifecycleOrchestrator,
  IdentityLifecycleInputSchema,
  IdentityLifecycleOutputSchema,
  type IdentityLifecycleInput,
  type IdentityLifecycleOutput,
} from './identity-lifecycle-orchestrator.js'
