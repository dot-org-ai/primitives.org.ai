/**
 * Catalog barrel — autonomous-customer-success Services.
 *
 * Ships five Services (`supportTriage`, `npsFollowup`, `churnRescue`,
 * `accountReview`, `onboardingRunbook`).
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

export {
  accountReview,
  AccountReviewInputSchema,
  AccountBriefOutputSchema,
  type AccountReviewInput,
  type AccountBriefOutput,
} from './account-review.js'

export {
  onboardingRunbook,
  NewCustomerInputSchema,
  ActivatedCustomerOutputSchema,
  type NewCustomerInput,
  type ActivatedCustomerOutput,
} from './onboarding-runbook.js'
