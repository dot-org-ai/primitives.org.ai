/**
 * Catalog barrel — autonomous-customer-success Services.
 *
 * Currently ships three Services (`supportTriage`, `npsFollowup`,
 * `churnRescue`); future Services (`onboardingRunbook`, `accountReview`)
 * re-export from here as they land.
 *
 * @packageDocumentation
 */

export {
  supportTriage,
  TicketSchema,
  TriagedSchema,
  type Ticket,
  type Triaged,
} from './support-triage.js'

export {
  npsFollowup,
  NPSResponseInputSchema,
  NPSAcknowledgedOutputSchema,
  type NPSResponseInput,
  type NPSAcknowledgedOutput,
} from './nps-followup.js'

export {
  churnRescue,
  ChurnSignalInputSchema,
  ChurnDecisionOutputSchema,
  type ChurnSignalInput,
  type ChurnDecisionOutput,
} from './churn-rescue.js'
