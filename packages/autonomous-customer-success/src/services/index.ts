/**
 * Catalog barrel — autonomous-customer-success Services.
 *
 * Currently ships one Service (`supportTriage`); future Services
 * (`npsFollowup`, `onboardingRunbook`, `churnRescue`, `accountReview`) re-export
 * from here as they land.
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
