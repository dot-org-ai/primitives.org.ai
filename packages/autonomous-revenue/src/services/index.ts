/**
 * Catalog Services exported from `autonomous-revenue`. Per v3 §12, catalog
 * Services are module-evaluated TypeScript that yield a typed
 * `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `leadQualification.invoke(input)`.
 *
 * @packageDocumentation
 */

export { leadQualification, InboundLeadSchema, QualifiedLeadSchema } from './lead-qualification.js'
export type { InboundLead, QualifiedLead } from './lead-qualification.js'

export { meetingPrep, MeetingEventInputSchema, MeetingBriefOutputSchema } from './meeting-prep.js'
export type { MeetingEventInput, MeetingBriefOutput } from './meeting-prep.js'

export {
  contractRedliner,
  ContractDocInputSchema,
  RedlinedContractOutputSchema,
} from './contract-redliner.js'
export type { ContractDocInput, RedlinedContractOutput } from './contract-redliner.js'

export {
  proposalGenerator,
  OpportunityInputSchema,
  ProposalOutputSchema,
} from './proposal-generator.js'
export type { OpportunityInput, ProposalOutput } from './proposal-generator.js'

export {
  renewalWorkbench,
  UpcomingRenewalInputSchema,
  RenewalBriefOutputSchema,
} from './renewal-workbench.js'
export type { UpcomingRenewalInput, RenewalBriefOutput } from './renewal-workbench.js'
