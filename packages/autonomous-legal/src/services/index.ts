/**
 * Catalog barrel — autonomous-legal Services.
 *
 * Ships six Services (`contractReviewer`, `policyImpactAnalyzer`,
 * `ipDisclosureTriage`, `litigationDiscoveryPrep`,
 * `complianceAttestationAuthor`, `regulatoryFilingDrafter`).
 *
 * Per v3 §12, catalog Services are module-evaluated TypeScript that yield a
 * typed `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `contractReviewer.invoke(input)`.
 *
 * @packageDocumentation
 */

export {
  contractReviewer,
  ContractIntakeInputSchema,
  ContractReviewOutputSchema,
  type ContractIntakeInput,
  type ContractReviewOutput,
} from './contract-reviewer.js'

export {
  policyImpactAnalyzer,
  PolicyChangeInputSchema,
  PolicyImpactOutputSchema,
  type PolicyChangeInput,
  type PolicyImpactOutput,
} from './policy-impact-analyzer.js'

export {
  ipDisclosureTriage,
  DisclosureIntakeInputSchema,
  DisclosureTriageOutputSchema,
  type DisclosureIntakeInput,
  type DisclosureTriageOutput,
} from './ip-disclosure-triage.js'

export {
  litigationDiscoveryPrep,
  DiscoveryRequestInputSchema,
  DiscoveryProductionOutputSchema,
  type DiscoveryRequestInput,
  type DiscoveryProductionOutput,
} from './litigation-discovery-prep.js'

export {
  complianceAttestationAuthor,
  AttestationCycleInputSchema,
  AttestationPacketOutputSchema,
  type AttestationCycleInput,
  type AttestationPacketOutput,
} from './compliance-attestation-author.js'

export {
  regulatoryFilingDrafter,
  FilingDraftInputSchema,
  FilingDraftOutputSchema,
  type FilingDraftInput,
  type FilingDraftOutput,
} from './regulatory-filing-drafter.js'
