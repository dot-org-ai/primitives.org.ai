/**
 * Legal & Compliance Tool Types
 *
 * Types for legal and compliance management:
 * Contracts, Agreements, Compliance, Audits, IP, and more.
 *
 * @module tool/legal
 */

import type {
  Input,
  Output,
  Action,
  BaseEvent,
  EventHandler,
  CRUDResource,
  ListParams,
  PaginatedResult,
} from '@/core/rpc'

// =============================================================================
// Contract
// =============================================================================

/**
 * Contract status.
 */
export type ContractStatus =
  | 'draft'
  | 'pending_review'
  | 'pending_signatures'
  | 'active'
  | 'expired'
  | 'terminated'
  | 'renewed'

/**
 * Contract type.
 */
export type ContractType =
  | 'service_agreement'
  | 'employment'
  | 'vendor'
  | 'customer'
  | 'partnership'
  | 'lease'
  | 'license'
  | 'msa'
  | 'sow'
  | 'other'

/**
 * Legal contract between parties.
 *
 * @example
 * ```ts
 * const contract: Contract = {
 *   id: 'ctr_123',
 *   title: 'Software Development Agreement',
 *   type: 'service_agreement',
 *   status: 'active',
 *   parties: [
 *     { name: 'Acme Corp', role: 'client', email: 'legal@acme.com' },
 *     { name: 'DevCo', role: 'vendor', email: 'contracts@devco.com' }
 *   ],
 *   value: { amount: 100000, currency: 'USD' },
 *   effectiveDate: new Date('2024-01-01'),
 *   expirationDate: new Date('2024-12-31'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Contract {
  /** Unique identifier */
  id: string

  /** Contract title */
  title: string

  /** Contract type */
  type: ContractType

  /** Contract status */
  status: ContractStatus

  /** Contract number/reference */
  contractNumber?: string

  /** Parties involved */
  parties: Array<{
    name: string
    role: string
    email?: string
    address?: string
    signatory?: string
    entityId?: string
  }>

  /** Contract value */
  value?: {
    amount: number
    currency: string
  }

  /** Effective/start date */
  effectiveDate?: Date

  /** Expiration/end date */
  expirationDate?: Date

  /** Termination date (if terminated early) */
  terminationDate?: Date

  /** Auto-renewal terms */
  autoRenewal?: {
    enabled: boolean
    term: string
    noticePeriodDays?: number
  }

  /** Related template ID */
  templateId?: string

  /** Contract terms summary */
  terms?: string

  /** Payment terms */
  paymentTerms?: string

  /** Governing law */
  governingLaw?: string

  /** Jurisdiction */
  jurisdiction?: string

  /** Clauses */
  clauseIds?: string[]

  /** Amendments */
  amendmentIds?: string[]

  /** Signature requests */
  signatureRequestIds?: string[]

  /** Document URLs */
  documentUrls?: string[]

  /** Primary document version */
  currentVersion?: number

  /** Owner/responsible person */
  ownerId?: string

  /** Related customer ID */
  customerId?: string

  /** Related vendor ID */
  vendorId?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    docusign?: string
    ironclad?: string
    adobesign?: string
    pandadoc?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ContractInput = Input<Contract>
export type ContractOutput = Output<Contract>

// =============================================================================
// ContractTemplate
// =============================================================================

/**
 * Reusable contract template.
 *
 * @example
 * ```ts
 * const template: ContractTemplate = {
 *   id: 'tmpl_123',
 *   name: 'Standard NDA Template',
 *   category: 'nda',
 *   version: '2.1',
 *   content: '<!-- template content -->',
 *   variables: [
 *     { name: 'partyName', type: 'text', required: true },
 *     { name: 'effectiveDate', type: 'date', required: true }
 *   ],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ContractTemplate {
  /** Unique identifier */
  id: string

  /** Template name */
  name: string

  /** Template description */
  description?: string

  /** Template category */
  category: string

  /** Template version */
  version?: string

  /** Template content/body */
  content: string

  /** Template variables/fields */
  variables?: Array<{
    name: string
    type: 'text' | 'date' | 'number' | 'boolean' | 'select'
    label?: string
    required?: boolean
    defaultValue?: unknown
    options?: string[]
  }>

  /** Required clauses */
  requiredClauses?: string[]

  /** Default terms */
  defaultTerms?: Record<string, unknown>

  /** Is active/published */
  isActive?: boolean

  /** Owner/author */
  ownerId?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    docusign?: string
    ironclad?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ContractTemplateInput = Input<ContractTemplate>
export type ContractTemplateOutput = Output<ContractTemplate>

// =============================================================================
// ContractClause
// =============================================================================

/**
 * Reusable contract clause.
 *
 * @example
 * ```ts
 * const clause: ContractClause = {
 *   id: 'cls_123',
 *   title: 'Confidentiality Obligation',
 *   category: 'confidentiality',
 *   content: 'The receiving party shall...',
 *   isMandatory: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ContractClause {
  /** Unique identifier */
  id: string

  /** Clause title */
  title: string

  /** Clause category */
  category: string

  /** Clause content */
  content: string

  /** Clause summary */
  summary?: string

  /** Version */
  version?: string

  /** Is mandatory */
  isMandatory?: boolean

  /** Applicable contract types */
  applicableTypes?: ContractType[]

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ContractClauseInput = Input<ContractClause>
export type ContractClauseOutput = Output<ContractClause>

// =============================================================================
// Amendment
// =============================================================================

/**
 * Contract amendment status.
 */
export type AmendmentStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'executed'

/**
 * Contract amendment/modification.
 *
 * @example
 * ```ts
 * const amendment: Amendment = {
 *   id: 'amd_123',
 *   contractId: 'ctr_123',
 *   title: 'Amendment No. 1 - Scope Extension',
 *   status: 'executed',
 *   description: 'Extending scope to include mobile development',
 *   effectiveDate: new Date('2024-06-01'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Amendment {
  /** Unique identifier */
  id: string

  /** Related contract ID */
  contractId: string

  /** Amendment title */
  title: string

  /** Amendment status */
  status: AmendmentStatus

  /** Amendment number */
  amendmentNumber?: string

  /** Description of changes */
  description?: string

  /** Detailed changes */
  changes?: Array<{
    field: string
    oldValue?: unknown
    newValue?: unknown
    description?: string
  }>

  /** Effective date */
  effectiveDate?: Date

  /** Document URL */
  documentUrl?: string

  /** Approved by */
  approvedBy?: string

  /** Approval date */
  approvedAt?: Date

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AmendmentInput = Input<Amendment>
export type AmendmentOutput = Output<Amendment>

// =============================================================================
// Signature
// =============================================================================

/**
 * Signature status.
 */
export type SignatureStatus = 'pending' | 'signed' | 'declined' | 'expired'

/**
 * Electronic signature on a document.
 *
 * @example
 * ```ts
 * const signature: Signature = {
 *   id: 'sig_123',
 *   signatureRequestId: 'req_123',
 *   signerName: 'John Doe',
 *   signerEmail: 'john@example.com',
 *   status: 'signed',
 *   signedAt: new Date(),
 *   ipAddress: '192.168.1.1',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Signature {
  /** Unique identifier */
  id: string

  /** Related signature request ID */
  signatureRequestId: string

  /** Signer name */
  signerName: string

  /** Signer email */
  signerEmail: string

  /** Signer role */
  signerRole?: string

  /** Signature status */
  status: SignatureStatus

  /** Signature method */
  signatureMethod?: 'typed' | 'drawn' | 'uploaded' | 'click_to_sign'

  /** Signature data/image */
  signatureData?: string

  /** Signed timestamp */
  signedAt?: Date

  /** Declined reason */
  declinedReason?: string

  /** IP address */
  ipAddress?: string

  /** User agent */
  userAgent?: string

  /** Geolocation */
  location?: {
    latitude?: number
    longitude?: number
    city?: string
    country?: string
  }

  /** Authentication method */
  authenticationMethod?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    docusign?: string
    hellosign?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SignatureInput = Input<Signature>
export type SignatureOutput = Output<Signature>

// =============================================================================
// SignatureRequest
// =============================================================================

/**
 * Signature request status.
 */
export type SignatureRequestStatus =
  | 'draft'
  | 'sent'
  | 'in_progress'
  | 'completed'
  | 'declined'
  | 'expired'
  | 'cancelled'

/**
 * Request for signatures on a document.
 *
 * @example
 * ```ts
 * const request: SignatureRequest = {
 *   id: 'req_123',
 *   title: 'NDA Signature Request',
 *   documentId: 'doc_123',
 *   status: 'in_progress',
 *   signers: [
 *     { email: 'john@example.com', name: 'John Doe', order: 1 },
 *     { email: 'jane@example.com', name: 'Jane Smith', order: 2 }
 *   ],
 *   expiresAt: new Date('2024-02-01'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface SignatureRequest {
  /** Unique identifier */
  id: string

  /** Request title */
  title: string

  /** Related document/contract ID */
  documentId?: string

  /** Related contract ID */
  contractId?: string

  /** Request status */
  status: SignatureRequestStatus

  /** Signers */
  signers: Array<{
    email: string
    name: string
    role?: string
    order?: number
    signatureId?: string
  }>

  /** Message to signers */
  message?: string

  /** Subject line */
  subject?: string

  /** Document URL */
  documentUrl?: string

  /** Sent timestamp */
  sentAt?: Date

  /** Expiration date */
  expiresAt?: Date

  /** Completed timestamp */
  completedAt?: Date

  /** Reminder settings */
  reminders?: {
    enabled: boolean
    frequency?: number
    lastSent?: Date
  }

  /** Require all signers */
  requireAllSigners?: boolean

  /** Allow comments */
  allowComments?: boolean

  /** CC email addresses */
  ccEmails?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    docusign?: string
    hellosign?: string
    adobesign?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type SignatureRequestInput = Input<SignatureRequest>
export type SignatureRequestOutput = Output<SignatureRequest>

// =============================================================================
// Agreement
// =============================================================================

/**
 * General legal agreement.
 *
 * @example
 * ```ts
 * const agreement: Agreement = {
 *   id: 'agr_123',
 *   title: 'Partnership Agreement',
 *   type: 'partnership',
 *   status: 'active',
 *   parties: ['Acme Corp', 'Partner Inc'],
 *   effectiveDate: new Date('2024-01-01'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Agreement {
  /** Unique identifier */
  id: string

  /** Agreement title */
  title: string

  /** Agreement type */
  type: string

  /** Agreement status */
  status: 'draft' | 'active' | 'expired' | 'terminated'

  /** Parties involved */
  parties: string[]

  /** Agreement terms */
  terms?: string

  /** Effective date */
  effectiveDate?: Date

  /** Expiration date */
  expirationDate?: Date

  /** Document URL */
  documentUrl?: string

  /** Related contract ID */
  contractId?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AgreementInput = Input<Agreement>
export type AgreementOutput = Output<Agreement>

// =============================================================================
// NDA (Non-Disclosure Agreement)
// =============================================================================

/**
 * NDA type.
 */
export type NDAType = 'unilateral' | 'mutual' | 'multilateral'

/**
 * Non-disclosure agreement.
 *
 * @example
 * ```ts
 * const nda: NDA = {
 *   id: 'nda_123',
 *   type: 'mutual',
 *   status: 'active',
 *   parties: ['Acme Corp', 'Partner Inc'],
 *   effectiveDate: new Date('2024-01-01'),
 *   expirationDate: new Date('2026-01-01'),
 *   confidentialityPeriod: { years: 5 },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface NDA {
  /** Unique identifier */
  id: string

  /** NDA type */
  type: NDAType

  /** NDA status */
  status: 'draft' | 'active' | 'expired' | 'terminated'

  /** Parties involved */
  parties: string[]

  /** Disclosing party (for unilateral) */
  disclosingParty?: string

  /** Receiving party (for unilateral) */
  receivingParty?: string

  /** Purpose of disclosure */
  purpose?: string

  /** Effective date */
  effectiveDate?: Date

  /** Expiration date */
  expirationDate?: Date

  /** Confidentiality period */
  confidentialityPeriod?: {
    years?: number
    months?: number
    perpetual?: boolean
  }

  /** Scope of confidential information */
  scope?: string

  /** Permitted disclosures */
  permittedDisclosures?: string[]

  /** Return/destruction obligations */
  returnObligations?: string

  /** Governing law */
  governingLaw?: string

  /** Document URL */
  documentUrl?: string

  /** Related contract ID */
  contractId?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type NDAInput = Input<NDA>
export type NDAOutput = Output<NDA>

// =============================================================================
// TermsOfService
// =============================================================================

/**
 * Terms of Service document.
 *
 * @example
 * ```ts
 * const tos: TermsOfService = {
 *   id: 'tos_123',
 *   version: '2.0',
 *   effectiveDate: new Date('2024-01-01'),
 *   content: '<!-- TOS content -->',
 *   isPublished: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface TermsOfService {
  /** Unique identifier */
  id: string

  /** Version number */
  version: string

  /** Title */
  title?: string

  /** Effective date */
  effectiveDate: Date

  /** Previous version ID */
  previousVersionId?: string

  /** Content/body */
  content: string

  /** Summary of changes */
  changesSummary?: string

  /** Is currently published */
  isPublished: boolean

  /** Published timestamp */
  publishedAt?: Date

  /** Product/service name */
  serviceName?: string

  /** Acceptance required */
  requiresAcceptance?: boolean

  /** User acceptance count */
  acceptanceCount?: number

  /** Document URL */
  documentUrl?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TermsOfServiceInput = Input<TermsOfService>
export type TermsOfServiceOutput = Output<TermsOfService>

// =============================================================================
// PrivacyPolicy
// =============================================================================

/**
 * Privacy policy document.
 *
 * @example
 * ```ts
 * const policy: PrivacyPolicy = {
 *   id: 'pp_123',
 *   version: '3.0',
 *   effectiveDate: new Date('2024-01-01'),
 *   content: '<!-- Privacy policy content -->',
 *   isPublished: true,
 *   applicableRegulations: ['GDPR', 'CCPA'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface PrivacyPolicy {
  /** Unique identifier */
  id: string

  /** Version number */
  version: string

  /** Title */
  title?: string

  /** Effective date */
  effectiveDate: Date

  /** Previous version ID */
  previousVersionId?: string

  /** Content/body */
  content: string

  /** Summary of changes */
  changesSummary?: string

  /** Is currently published */
  isPublished: boolean

  /** Published timestamp */
  publishedAt?: Date

  /** Applicable regulations */
  applicableRegulations?: string[]

  /** Data collection types */
  dataCollectionTypes?: string[]

  /** Data usage purposes */
  dataUsagePurposes?: string[]

  /** Third-party sharing */
  thirdPartySharing?: boolean

  /** Third-party services */
  thirdPartyServices?: string[]

  /** User rights described */
  userRights?: string[]

  /** Cookie policy included */
  includesCookiePolicy?: boolean

  /** Document URL */
  documentUrl?: string

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PrivacyPolicyInput = Input<PrivacyPolicy>
export type PrivacyPolicyOutput = Output<PrivacyPolicy>

// =============================================================================
// Compliance
// =============================================================================

/**
 * Compliance status.
 */
export type ComplianceStatus = 'compliant' | 'non_compliant' | 'in_progress' | 'not_applicable'

/**
 * Compliance record.
 *
 * @example
 * ```ts
 * const compliance: Compliance = {
 *   id: 'cmp_123',
 *   frameworkId: 'fw_gdpr',
 *   status: 'compliant',
 *   assessmentDate: new Date(),
 *   nextReviewDate: new Date('2024-12-31'),
 *   score: 95,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Compliance {
  /** Unique identifier */
  id: string

  /** Related framework ID */
  frameworkId: string

  /** Compliance status */
  status: ComplianceStatus

  /** Assessment date */
  assessmentDate?: Date

  /** Next review date */
  nextReviewDate?: Date

  /** Compliance score (0-100) */
  score?: number

  /** Findings summary */
  findingsSummary?: string

  /** Control status counts */
  controlStats?: {
    total: number
    compliant: number
    nonCompliant: number
    inProgress: number
  }

  /** Responsible person */
  ownerId?: string

  /** Assessor */
  assessorId?: string

  /** Related audit IDs */
  auditIds?: string[]

  /** Evidence documents */
  evidenceUrls?: string[]

  /** Remediation plan */
  remediationPlan?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    vanta?: string
    drata?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ComplianceInput = Input<Compliance>
export type ComplianceOutput = Output<Compliance>

// =============================================================================
// ComplianceFramework
// =============================================================================

/**
 * Compliance framework type.
 */
export type FrameworkType =
  | 'SOC2'
  | 'ISO27001'
  | 'GDPR'
  | 'HIPAA'
  | 'PCI_DSS'
  | 'CCPA'
  | 'NIST'
  | 'FedRAMP'
  | 'Custom'

/**
 * Compliance framework definition.
 *
 * @example
 * ```ts
 * const framework: ComplianceFramework = {
 *   id: 'fw_soc2',
 *   name: 'SOC 2 Type II',
 *   type: 'SOC2',
 *   version: '2017',
 *   description: 'Service Organization Control 2',
 *   controlCount: 64,
 *   isActive: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ComplianceFramework {
  /** Unique identifier */
  id: string

  /** Framework name */
  name: string

  /** Framework type */
  type: FrameworkType

  /** Framework version */
  version?: string

  /** Description */
  description?: string

  /** Number of controls */
  controlCount?: number

  /** Control IDs */
  controlIds?: string[]

  /** Requirements */
  requirements?: Array<{
    id: string
    title: string
    description?: string
    category?: string
  }>

  /** Certification body */
  certificationBody?: string

  /** Audit frequency */
  auditFrequency?: string

  /** Is active */
  isActive?: boolean

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ComplianceFrameworkInput = Input<ComplianceFramework>
export type ComplianceFrameworkOutput = Output<ComplianceFramework>

// =============================================================================
// ComplianceControl
// =============================================================================

/**
 * Control status.
 */
export type ControlStatus = 'implemented' | 'partially_implemented' | 'not_implemented' | 'not_applicable'

/**
 * Individual compliance control.
 *
 * @example
 * ```ts
 * const control: ComplianceControl = {
 *   id: 'ctl_123',
 *   frameworkId: 'fw_soc2',
 *   controlId: 'CC6.1',
 *   title: 'Logical and Physical Access Controls',
 *   status: 'implemented',
 *   implementationDate: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ComplianceControl {
  /** Unique identifier */
  id: string

  /** Related framework ID */
  frameworkId: string

  /** Control identifier within framework */
  controlId: string

  /** Control title */
  title: string

  /** Control description */
  description?: string

  /** Control category */
  category?: string

  /** Control status */
  status: ControlStatus

  /** Implementation date */
  implementationDate?: Date

  /** Last tested date */
  lastTestedAt?: Date

  /** Test frequency */
  testFrequency?: string

  /** Next test date */
  nextTestDate?: Date

  /** Owner */
  ownerId?: string

  /** Implementation details */
  implementation?: string

  /** Evidence of compliance */
  evidenceUrls?: string[]

  /** Test results */
  testResults?: Array<{
    date: Date
    result: 'passed' | 'failed' | 'partial'
    notes?: string
    testerId?: string
  }>

  /** Related policies */
  policyIds?: string[]

  /** Related procedures */
  procedureIds?: string[]

  /** Gaps/issues */
  gaps?: string[]

  /** Remediation plan */
  remediationPlan?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ComplianceControlInput = Input<ComplianceControl>
export type ComplianceControlOutput = Output<ComplianceControl>

// =============================================================================
// Audit
// =============================================================================

/**
 * Audit status.
 */
export type AuditStatus =
  | 'planned'
  | 'in_progress'
  | 'fieldwork'
  | 'reporting'
  | 'completed'
  | 'cancelled'

/**
 * Audit type.
 */
export type AuditType = 'internal' | 'external' | 'regulatory' | 'vendor' | 'financial' | 'security'

/**
 * Audit record.
 *
 * @example
 * ```ts
 * const audit: Audit = {
 *   id: 'aud_123',
 *   title: 'SOC 2 Type II Audit 2024',
 *   type: 'external',
 *   status: 'in_progress',
 *   frameworkId: 'fw_soc2',
 *   auditor: 'BigFour Auditing',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-03-31'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Audit {
  /** Unique identifier */
  id: string

  /** Audit title */
  title: string

  /** Audit type */
  type: AuditType

  /** Audit status */
  status: AuditStatus

  /** Related framework ID */
  frameworkId?: string

  /** Auditor name/firm */
  auditor?: string

  /** Lead auditor */
  leadAuditorId?: string

  /** Audit scope */
  scope?: string

  /** Start date */
  startDate?: Date

  /** End date */
  endDate?: Date

  /** Reporting date */
  reportingDate?: Date

  /** Audit period start */
  periodStart?: Date

  /** Audit period end */
  periodEnd?: Date

  /** Audit objectives */
  objectives?: string[]

  /** Areas covered */
  areasCovered?: string[]

  /** Finding IDs */
  findingIds?: string[]

  /** Overall conclusion */
  conclusion?: string

  /** Opinion */
  opinion?: 'unqualified' | 'qualified' | 'adverse' | 'disclaimer'

  /** Report URL */
  reportUrl?: string

  /** Evidence collected */
  evidenceUrls?: string[]

  /** Responsible person */
  ownerId?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AuditInput = Input<Audit>
export type AuditOutput = Output<Audit>

// =============================================================================
// AuditFinding
// =============================================================================

/**
 * Finding severity.
 */
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational'

/**
 * Finding status.
 */
export type FindingStatus = 'open' | 'in_remediation' | 'resolved' | 'accepted' | 'closed'

/**
 * Audit finding.
 *
 * @example
 * ```ts
 * const finding: AuditFinding = {
 *   id: 'fnd_123',
 *   auditId: 'aud_123',
 *   title: 'Insufficient Access Controls',
 *   severity: 'high',
 *   status: 'in_remediation',
 *   description: 'Access controls do not meet requirements...',
 *   recommendation: 'Implement role-based access control...',
 *   dueDate: new Date('2024-06-30'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface AuditFinding {
  /** Unique identifier */
  id: string

  /** Related audit ID */
  auditId: string

  /** Finding title */
  title: string

  /** Finding severity */
  severity: FindingSeverity

  /** Finding status */
  status: FindingStatus

  /** Finding description */
  description: string

  /** Recommendation */
  recommendation?: string

  /** Affected control IDs */
  controlIds?: string[]

  /** Affected areas */
  affectedAreas?: string[]

  /** Root cause */
  rootCause?: string

  /** Impact assessment */
  impact?: string

  /** Remediation plan */
  remediationPlan?: string

  /** Responsible for remediation */
  remediationOwnerId?: string

  /** Due date for remediation */
  dueDate?: Date

  /** Resolved date */
  resolvedAt?: Date

  /** Evidence of issue */
  evidenceUrls?: string[]

  /** Evidence of resolution */
  resolutionEvidenceUrls?: string[]

  /** Risk score */
  riskScore?: number

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AuditFindingInput = Input<AuditFinding>
export type AuditFindingOutput = Output<AuditFinding>

// =============================================================================
// Risk
// =============================================================================

/**
 * Risk level.
 */
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'negligible'

/**
 * Risk status.
 */
export type RiskStatus = 'identified' | 'assessing' | 'mitigating' | 'monitoring' | 'closed' | 'accepted'

/**
 * Risk assessment record.
 *
 * @example
 * ```ts
 * const risk: Risk = {
 *   id: 'rsk_123',
 *   title: 'Data Breach Risk',
 *   category: 'security',
 *   level: 'high',
 *   status: 'mitigating',
 *   probability: 0.3,
 *   impact: 0.8,
 *   riskScore: 24,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Risk {
  /** Unique identifier */
  id: string

  /** Risk title */
  title: string

  /** Risk description */
  description?: string

  /** Risk category */
  category: string

  /** Risk level */
  level: RiskLevel

  /** Risk status */
  status: RiskStatus

  /** Probability (0-1) */
  probability?: number

  /** Impact (0-1) */
  impact?: number

  /** Risk score (probability × impact × 100) */
  riskScore?: number

  /** Inherent risk level (before controls) */
  inherentRisk?: RiskLevel

  /** Residual risk level (after controls) */
  residualRisk?: RiskLevel

  /** Risk owner */
  ownerId?: string

  /** Identified date */
  identifiedAt?: Date

  /** Last assessed date */
  lastAssessedAt?: Date

  /** Next review date */
  nextReviewDate?: Date

  /** Affected assets */
  affectedAssets?: string[]

  /** Threat sources */
  threatSources?: string[]

  /** Vulnerabilities */
  vulnerabilities?: string[]

  /** Existing controls */
  existingControls?: string[]

  /** Control effectiveness */
  controlEffectiveness?: 'effective' | 'partially_effective' | 'ineffective'

  /** Mitigation IDs */
  mitigationIds?: string[]

  /** Risk appetite threshold */
  appetiteThreshold?: number

  /** Exceeds appetite */
  exceedsAppetite?: boolean

  /** Related compliance frameworks */
  frameworkIds?: string[]

  /** Related incidents */
  incidentIds?: string[]

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type RiskInput = Input<Risk>
export type RiskOutput = Output<Risk>

// =============================================================================
// RiskMitigation
// =============================================================================

/**
 * Mitigation status.
 */
export type MitigationStatus = 'planned' | 'in_progress' | 'implemented' | 'validated' | 'cancelled'

/**
 * Mitigation strategy type.
 */
export type MitigationStrategy = 'avoid' | 'transfer' | 'mitigate' | 'accept'

/**
 * Risk mitigation plan.
 *
 * @example
 * ```ts
 * const mitigation: RiskMitigation = {
 *   id: 'mtg_123',
 *   riskId: 'rsk_123',
 *   title: 'Implement MFA',
 *   strategy: 'mitigate',
 *   status: 'in_progress',
 *   targetRiskLevel: 'low',
 *   dueDate: new Date('2024-06-30'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface RiskMitigation {
  /** Unique identifier */
  id: string

  /** Related risk ID */
  riskId: string

  /** Mitigation title */
  title: string

  /** Mitigation description */
  description?: string

  /** Mitigation strategy */
  strategy: MitigationStrategy

  /** Mitigation status */
  status: MitigationStatus

  /** Target risk level after mitigation */
  targetRiskLevel?: RiskLevel

  /** Implementation plan */
  implementationPlan?: string

  /** Due date */
  dueDate?: Date

  /** Implementation date */
  implementedAt?: Date

  /** Validation date */
  validatedAt?: Date

  /** Owner */
  ownerId?: string

  /** Cost estimate */
  costEstimate?: {
    amount: number
    currency: string
  }

  /** Actual cost */
  actualCost?: {
    amount: number
    currency: string
  }

  /** Effectiveness rating */
  effectiveness?: number

  /** Related controls */
  controlIds?: string[]

  /** Progress percentage */
  progress?: number

  /** Milestones */
  milestones?: Array<{
    title: string
    dueDate?: Date
    completedAt?: Date
    status: 'pending' | 'completed'
  }>

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type RiskMitigationInput = Input<RiskMitigation>
export type RiskMitigationOutput = Output<RiskMitigation>

// =============================================================================
// Incident
// =============================================================================

/**
 * Incident severity.
 */
export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low'

/**
 * Incident status.
 */
export type IncidentStatus =
  | 'reported'
  | 'investigating'
  | 'containment'
  | 'eradication'
  | 'recovery'
  | 'resolved'
  | 'closed'

/**
 * Incident type.
 */
export type IncidentType =
  | 'security_breach'
  | 'data_breach'
  | 'compliance_violation'
  | 'privacy_incident'
  | 'policy_violation'
  | 'other'

/**
 * Security or compliance incident.
 *
 * @example
 * ```ts
 * const incident: Incident = {
 *   id: 'inc_123',
 *   title: 'Unauthorized Access Attempt',
 *   type: 'security_breach',
 *   severity: 'high',
 *   status: 'investigating',
 *   reportedAt: new Date(),
 *   reportedBy: 'user_123',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Incident {
  /** Unique identifier */
  id: string

  /** Incident title */
  title: string

  /** Incident type */
  type: IncidentType

  /** Incident severity */
  severity: IncidentSeverity

  /** Incident status */
  status: IncidentStatus

  /** Incident description */
  description?: string

  /** Reported timestamp */
  reportedAt: Date

  /** Reported by */
  reportedBy?: string

  /** Detected timestamp */
  detectedAt?: Date

  /** Occurred timestamp */
  occurredAt?: Date

  /** Incident response team */
  responseTeam?: string[]

  /** Incident commander */
  commanderId?: string

  /** Affected systems */
  affectedSystems?: string[]

  /** Affected users count */
  affectedUsersCount?: number

  /** Affected records count */
  affectedRecordsCount?: number

  /** Data types affected */
  affectedDataTypes?: string[]

  /** Root cause */
  rootCause?: string

  /** Containment actions */
  containmentActions?: string[]

  /** Eradication actions */
  eradicationActions?: string[]

  /** Recovery actions */
  recoveryActions?: string[]

  /** Lessons learned */
  lessonsLearned?: string

  /** Notification required */
  notificationRequired?: boolean

  /** Notification deadline */
  notificationDeadline?: Date

  /** Notifications sent */
  notificationsSent?: Array<{
    recipient: string
    type: 'user' | 'regulator' | 'customer' | 'partner'
    sentAt: Date
  }>

  /** Regulatory reporting required */
  regulatoryReportingRequired?: boolean

  /** Regulators notified */
  regulatorsNotified?: string[]

  /** Related risk IDs */
  riskIds?: string[]

  /** Related finding IDs */
  findingIds?: string[]

  /** Evidence collected */
  evidenceUrls?: string[]

  /** Post-incident report URL */
  reportUrl?: string

  /** Resolved timestamp */
  resolvedAt?: Date

  /** Closed timestamp */
  closedAt?: Date

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type IncidentInput = Input<Incident>
export type IncidentOutput = Output<Incident>

// =============================================================================
// DataProcessingAgreement
// =============================================================================

/**
 * Data processing agreement (DPA).
 *
 * @example
 * ```ts
 * const dpa: DataProcessingAgreement = {
 *   id: 'dpa_123',
 *   controller: 'Acme Corp',
 *   processor: 'DataCo Services',
 *   status: 'active',
 *   effectiveDate: new Date('2024-01-01'),
 *   processingPurposes: ['customer analytics', 'email marketing'],
 *   dataCategories: ['contact information', 'usage data'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface DataProcessingAgreement {
  /** Unique identifier */
  id: string

  /** Data controller */
  controller: string

  /** Data processor */
  processor: string

  /** DPA status */
  status: 'draft' | 'active' | 'expired' | 'terminated'

  /** Effective date */
  effectiveDate?: Date

  /** Expiration date */
  expirationDate?: Date

  /** Processing purposes */
  processingPurposes?: string[]

  /** Data categories */
  dataCategories?: string[]

  /** Data subjects */
  dataSubjects?: string[]

  /** Processing duration */
  processingDuration?: string

  /** Sub-processors allowed */
  subProcessorsAllowed?: boolean

  /** Sub-processors */
  subProcessors?: Array<{
    name: string
    service: string
    location?: string
  }>

  /** Data transfer mechanisms */
  dataTransferMechanisms?: string[]

  /** Security measures */
  securityMeasures?: string[]

  /** Audit rights */
  auditRights?: string

  /** Breach notification period */
  breachNotificationPeriodHours?: number

  /** Data retention period */
  dataRetentionPeriod?: string

  /** Data deletion obligations */
  dataDeletionObligations?: string

  /** Document URL */
  documentUrl?: string

  /** Related contract ID */
  contractId?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DataProcessingAgreementInput = Input<DataProcessingAgreement>
export type DataProcessingAgreementOutput = Output<DataProcessingAgreement>

// =============================================================================
// DataSubjectRequest
// =============================================================================

/**
 * Data subject request type.
 */
export type DataRequestType =
  | 'access'
  | 'rectification'
  | 'erasure'
  | 'portability'
  | 'restriction'
  | 'objection'
  | 'opt_out'
  | 'do_not_sell'

/**
 * Request status.
 */
export type DataRequestStatus =
  | 'received'
  | 'verifying'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'cancelled'

/**
 * Data subject request (GDPR/CCPA).
 *
 * @example
 * ```ts
 * const request: DataSubjectRequest = {
 *   id: 'dsr_123',
 *   type: 'erasure',
 *   status: 'processing',
 *   subjectEmail: 'user@example.com',
 *   requestDate: new Date(),
 *   dueDate: new Date('2024-02-15'),
 *   regulation: 'GDPR',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface DataSubjectRequest {
  /** Unique identifier */
  id: string

  /** Request type */
  type: DataRequestType

  /** Request status */
  status: DataRequestStatus

  /** Data subject email */
  subjectEmail: string

  /** Data subject name */
  subjectName?: string

  /** Request date */
  requestDate: Date

  /** Due date (typically 30 days) */
  dueDate?: Date

  /** Applicable regulation */
  regulation?: 'GDPR' | 'CCPA' | 'LGPD' | 'PIPEDA' | 'Other'

  /** Request details */
  details?: string

  /** Verification method */
  verificationMethod?: string

  /** Verified timestamp */
  verifiedAt?: Date

  /** Assigned to */
  assignedTo?: string

  /** Processing notes */
  processingNotes?: string

  /** Data categories affected */
  dataCategoriesAffected?: string[]

  /** Systems searched */
  systemsSearched?: string[]

  /** Data found */
  dataFound?: boolean

  /** Response sent */
  responseSent?: boolean

  /** Response date */
  responseDate?: Date

  /** Response method */
  responseMethod?: string

  /** Completion date */
  completedAt?: Date

  /** Rejection reason */
  rejectionReason?: string

  /** Related user ID */
  userId?: string

  /** Evidence of completion */
  evidenceUrls?: string[]

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DataSubjectRequestInput = Input<DataSubjectRequest>
export type DataSubjectRequestOutput = Output<DataSubjectRequest>

// =============================================================================
// Consent
// =============================================================================

/**
 * Consent status.
 */
export type ConsentStatus = 'granted' | 'denied' | 'withdrawn' | 'expired'

/**
 * User consent record.
 *
 * @example
 * ```ts
 * const consent: Consent = {
 *   id: 'cns_123',
 *   userId: 'user_123',
 *   purpose: 'marketing_emails',
 *   status: 'granted',
 *   grantedAt: new Date(),
 *   method: 'checkbox',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Consent {
  /** Unique identifier */
  id: string

  /** User ID */
  userId: string

  /** Purpose of consent */
  purpose: string

  /** Consent status */
  status: ConsentStatus

  /** Granted timestamp */
  grantedAt?: Date

  /** Withdrawn timestamp */
  withdrawnAt?: Date

  /** Expiration date */
  expiresAt?: Date

  /** Consent version */
  version?: string

  /** Consent method */
  method?: 'checkbox' | 'button' | 'email' | 'verbal' | 'other'

  /** Consent text shown */
  consentText?: string

  /** Privacy policy version */
  privacyPolicyVersion?: string

  /** Terms version */
  termsVersion?: string

  /** IP address */
  ipAddress?: string

  /** User agent */
  userAgent?: string

  /** Granular consents */
  granularConsents?: Record<string, boolean>

  /** Legal basis */
  legalBasis?: 'consent' | 'contract' | 'legal_obligation' | 'legitimate_interest'

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ConsentInput = Input<Consent>
export type ConsentOutput = Output<Consent>

// =============================================================================
// IntellectualProperty
// =============================================================================

/**
 * IP type.
 */
export type IPType = 'patent' | 'trademark' | 'copyright' | 'trade_secret' | 'design' | 'other'

/**
 * IP status.
 */
export type IPStatus = 'application' | 'pending' | 'granted' | 'active' | 'expired' | 'abandoned'

/**
 * Intellectual property record.
 *
 * @example
 * ```ts
 * const ip: IntellectualProperty = {
 *   id: 'ip_123',
 *   title: 'Advanced Data Processing System',
 *   type: 'patent',
 *   status: 'granted',
 *   registrationNumber: 'US1234567',
 *   filingDate: new Date('2022-01-01'),
 *   grantDate: new Date('2024-01-01'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface IntellectualProperty {
  /** Unique identifier */
  id: string

  /** IP title */
  title: string

  /** IP type */
  type: IPType

  /** IP status */
  status: IPStatus

  /** Description */
  description?: string

  /** Registration/application number */
  registrationNumber?: string

  /** Filing date */
  filingDate?: Date

  /** Grant/issue date */
  grantDate?: Date

  /** Expiration date */
  expirationDate?: Date

  /** Jurisdiction/country */
  jurisdiction?: string

  /** Inventors/creators */
  inventors?: string[]

  /** Assignee/owner */
  assignee?: string

  /** Owner entity ID */
  ownerEntityId?: string

  /** Classes/categories */
  classes?: string[]

  /** Related patent IDs */
  relatedPatentIds?: string[]

  /** License IDs */
  licenseIds?: string[]

  /** Renewal dates */
  renewalDates?: Date[]

  /** Maintenance fees */
  maintenanceFees?: Array<{
    dueDate: Date
    amount: number
    currency: string
    paidAt?: Date
  }>

  /** Attorney/agent */
  attorney?: string

  /** Document URLs */
  documentUrls?: string[]

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    uspto?: string
    epo?: string
    wipo?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type IntellectualPropertyInput = Input<IntellectualProperty>
export type IntellectualPropertyOutput = Output<IntellectualProperty>

// =============================================================================
// Patent
// =============================================================================

/**
 * Patent type.
 */
export type PatentType = 'utility' | 'design' | 'plant' | 'provisional'

/**
 * Patent record.
 *
 * @example
 * ```ts
 * const patent: Patent = {
 *   id: 'pat_123',
 *   title: 'Method for Data Compression',
 *   patentType: 'utility',
 *   status: 'granted',
 *   patentNumber: 'US10123456',
 *   filingDate: new Date('2022-01-01'),
 *   issueDate: new Date('2024-01-01'),
 *   expirationDate: new Date('2042-01-01'),
 *   inventors: ['John Smith', 'Jane Doe'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Patent {
  /** Unique identifier */
  id: string

  /** Patent title */
  title: string

  /** Patent type */
  patentType: PatentType

  /** Patent status */
  status: IPStatus

  /** Patent number */
  patentNumber?: string

  /** Application number */
  applicationNumber?: string

  /** Abstract */
  abstract?: string

  /** Filing date */
  filingDate?: Date

  /** Publication date */
  publicationDate?: Date

  /** Issue/grant date */
  issueDate?: Date

  /** Expiration date */
  expirationDate?: Date

  /** Priority date */
  priorityDate?: Date

  /** Country/jurisdiction */
  country?: string

  /** Inventors */
  inventors: string[]

  /** Assignee */
  assignee?: string

  /** Claims */
  claims?: string[]

  /** Classifications */
  classifications?: Array<{
    system: 'IPC' | 'CPC' | 'USPC'
    code: string
    description?: string
  }>

  /** Related applications */
  relatedApplications?: Array<{
    type: 'continuation' | 'divisional' | 'parent' | 'child'
    number: string
  }>

  /** Citations */
  citations?: Array<{
    type: 'patent' | 'non_patent'
    reference: string
  }>

  /** Family members (international) */
  familyMembers?: string[]

  /** Patent attorney */
  attorney?: string

  /** Document URL */
  documentUrl?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    uspto?: string
    epo?: string
    wipo?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PatentInput = Input<Patent>
export type PatentOutput = Output<Patent>

// =============================================================================
// Trademark
// =============================================================================

/**
 * Trademark type.
 */
export type TrademarkType = 'word_mark' | 'design_mark' | 'composite' | 'sound' | 'color'

/**
 * Trademark record.
 *
 * @example
 * ```ts
 * const trademark: Trademark = {
 *   id: 'tm_123',
 *   mark: 'ACME',
 *   trademarkType: 'word_mark',
 *   status: 'registered',
 *   registrationNumber: 'US87654321',
 *   filingDate: new Date('2023-01-01'),
 *   registrationDate: new Date('2024-01-01'),
 *   classes: ['009', '042'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Trademark {
  /** Unique identifier */
  id: string

  /** Trademark/mark text */
  mark: string

  /** Trademark type */
  trademarkType: TrademarkType

  /** Trademark status */
  status: IPStatus

  /** Registration number */
  registrationNumber?: string

  /** Application number */
  applicationNumber?: string

  /** Serial number */
  serialNumber?: string

  /** Filing date */
  filingDate?: Date

  /** Publication date */
  publicationDate?: Date

  /** Registration date */
  registrationDate?: Date

  /** Expiration date */
  expirationDate?: Date

  /** Country/jurisdiction */
  country?: string

  /** Owner */
  owner?: string

  /** Owner entity ID */
  ownerEntityId?: string

  /** Description of goods/services */
  goodsAndServices?: string

  /** Nice classification classes */
  classes?: string[]

  /** First use date */
  firstUseDate?: Date

  /** First use in commerce date */
  firstUseInCommerceDate?: Date

  /** Design description (for design marks) */
  designDescription?: string

  /** Image URL */
  imageUrl?: string

  /** Disclaimer */
  disclaimer?: string

  /** Renewal dates */
  renewalDates?: Date[]

  /** Attorney */
  attorney?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    uspto?: string
    euipo?: string
    wipo?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TrademarkInput = Input<Trademark>
export type TrademarkOutput = Output<Trademark>

// =============================================================================
// Copyright
// =============================================================================

/**
 * Copyright type.
 */
export type CopyrightType = 'literary' | 'musical' | 'dramatic' | 'artistic' | 'software' | 'audiovisual'

/**
 * Copyright record.
 *
 * @example
 * ```ts
 * const copyright: Copyright = {
 *   id: 'cr_123',
 *   title: 'Acme Software Suite v2.0',
 *   copyrightType: 'software',
 *   status: 'registered',
 *   registrationNumber: 'TXu002345678',
 *   author: 'Acme Corp',
 *   creationDate: new Date('2023-01-01'),
 *   registrationDate: new Date('2024-01-01'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Copyright {
  /** Unique identifier */
  id: string

  /** Work title */
  title: string

  /** Copyright type */
  copyrightType: CopyrightType

  /** Copyright status */
  status: 'unregistered' | 'registered' | 'active' | 'expired' | 'public_domain'

  /** Registration number */
  registrationNumber?: string

  /** Author(s) */
  author?: string

  /** Copyright holder */
  copyrightHolder?: string

  /** Creation date */
  creationDate?: Date

  /** Publication date */
  publicationDate?: Date

  /** Registration date */
  registrationDate?: Date

  /** Country */
  country?: string

  /** Work description */
  description?: string

  /** Is work for hire */
  isWorkForHire?: boolean

  /** Derivative work */
  isDerivative?: boolean

  /** Based on (if derivative) */
  basedOn?: string

  /** License type */
  licenseType?: string

  /** Rights reserved */
  rightsReserved?: string[]

  /** Document URL */
  documentUrl?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    usco?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CopyrightInput = Input<Copyright>
export type CopyrightOutput = Output<Copyright>

// =============================================================================
// License
// =============================================================================

/**
 * License type.
 */
export type LicenseType = 'exclusive' | 'non_exclusive' | 'sole' | 'sublicense'

/**
 * License status.
 */
export type LicenseStatus = 'draft' | 'active' | 'suspended' | 'terminated' | 'expired'

/**
 * IP license agreement.
 *
 * @example
 * ```ts
 * const license: License = {
 *   id: 'lic_123',
 *   title: 'Software License Agreement',
 *   licenseType: 'non_exclusive',
 *   status: 'active',
 *   licensor: 'Acme Corp',
 *   licensee: 'Partner Inc',
 *   ipId: 'ip_123',
 *   effectiveDate: new Date('2024-01-01'),
 *   expirationDate: new Date('2026-01-01'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface License {
  /** Unique identifier */
  id: string

  /** License title */
  title: string

  /** License type */
  licenseType: LicenseType

  /** License status */
  status: LicenseStatus

  /** Licensor (IP owner) */
  licensor: string

  /** Licensee */
  licensee: string

  /** Related IP ID */
  ipId?: string

  /** Licensed IP types */
  ipTypes?: IPType[]

  /** Scope/field of use */
  scope?: string

  /** Territory/geographic scope */
  territory?: string[]

  /** Effective date */
  effectiveDate?: Date

  /** Expiration date */
  expirationDate?: Date

  /** Royalty terms */
  royaltyTerms?: {
    type: 'fixed' | 'percentage' | 'per_unit' | 'milestone'
    rate?: number
    minimumRoyalty?: number
    paymentSchedule?: string
  }

  /** Upfront fee */
  upfrontFee?: {
    amount: number
    currency: string
  }

  /** Performance milestones */
  milestones?: Array<{
    description: string
    dueDate?: Date
    payment?: number
  }>

  /** Minimum sales requirements */
  minimumSales?: {
    amount: number
    period: string
  }

  /** Sublicense rights */
  sublicenseRights?: boolean

  /** Quality control provisions */
  qualityControl?: string

  /** Audit rights */
  auditRights?: string

  /** Termination clauses */
  terminationClauses?: string[]

  /** Related contract ID */
  contractId?: string

  /** Document URL */
  documentUrl?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type LicenseInput = Input<License>
export type LicenseOutput = Output<License>

// =============================================================================
// LegalEntity
// =============================================================================

/**
 * Entity type.
 */
export type EntityType =
  | 'corporation'
  | 'llc'
  | 'partnership'
  | 'sole_proprietorship'
  | 'nonprofit'
  | 'subsidiary'
  | 'branch'

/**
 * Legal entity/subsidiary.
 *
 * @example
 * ```ts
 * const entity: LegalEntity = {
 *   id: 'ent_123',
 *   name: 'Acme Corp',
 *   legalName: 'Acme Corporation Inc.',
 *   entityType: 'corporation',
 *   jurisdiction: 'Delaware',
 *   registrationNumber: '1234567',
 *   incorporationDate: new Date('2020-01-01'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface LegalEntity {
  /** Unique identifier */
  id: string

  /** Display name */
  name: string

  /** Legal name */
  legalName: string

  /** Entity type */
  entityType: EntityType

  /** Jurisdiction */
  jurisdiction: string

  /** Registration/EIN number */
  registrationNumber?: string

  /** Tax ID */
  taxId?: string

  /** Incorporation/formation date */
  incorporationDate?: Date

  /** Registered address */
  registeredAddress?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Principal business address */
  businessAddress?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Registered agent */
  registeredAgent?: {
    name: string
    address?: string
  }

  /** Parent entity ID */
  parentEntityId?: string

  /** Subsidiary entity IDs */
  subsidiaryIds?: string[]

  /** Directors/officers */
  officers?: Array<{
    name: string
    role: string
    appointedDate?: Date
  }>

  /** Shareholders */
  shareholders?: Array<{
    name: string
    shares?: number
    percentage?: number
  }>

  /** Annual report due date */
  annualReportDueDate?: Date

  /** Status */
  status?: 'active' | 'inactive' | 'dissolved'

  /** Dissolution date */
  dissolutionDate?: Date

  /** Document URLs */
  documentUrls?: string[]

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type LegalEntityInput = Input<LegalEntity>
export type LegalEntityOutput = Output<LegalEntity>

// =============================================================================
// LegalCase
// =============================================================================

/**
 * Case status.
 */
export type LegalCaseStatus =
  | 'filed'
  | 'discovery'
  | 'motion_pending'
  | 'trial'
  | 'appeal'
  | 'settled'
  | 'dismissed'
  | 'judgment'
  | 'closed'

/**
 * Case type.
 */
export type CaseType =
  | 'litigation'
  | 'arbitration'
  | 'mediation'
  | 'contract_dispute'
  | 'ip_dispute'
  | 'employment'
  | 'regulatory'
  | 'other'

/**
 * Legal case or dispute.
 *
 * @example
 * ```ts
 * const legalCase: LegalCase = {
 *   id: 'case_123',
 *   title: 'Acme v. Competitor Inc.',
 *   caseType: 'ip_dispute',
 *   status: 'discovery',
 *   caseNumber: '2024-CV-001234',
 *   filingDate: new Date('2024-01-15'),
 *   court: 'District Court for Northern California',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface LegalCase {
  /** Unique identifier */
  id: string

  /** Case title */
  title: string

  /** Case type */
  caseType: CaseType

  /** Case status */
  status: LegalCaseStatus

  /** Case number */
  caseNumber?: string

  /** Filing date */
  filingDate?: Date

  /** Court/tribunal */
  court?: string

  /** Judge */
  judge?: string

  /** Our role */
  ourRole?: 'plaintiff' | 'defendant' | 'petitioner' | 'respondent' | 'third_party'

  /** Opposing party */
  opposingParty?: string

  /** Our counsel */
  ourCounsel?: Array<{
    name: string
    firm?: string
    role?: string
  }>

  /** Opposing counsel */
  opposingCounsel?: Array<{
    name: string
    firm?: string
  }>

  /** Case summary */
  summary?: string

  /** Claims/causes of action */
  claims?: string[]

  /** Amount in controversy */
  amountInControversy?: {
    amount: number
    currency: string
  }

  /** Key dates */
  keyDates?: Array<{
    event: string
    date: Date
  }>

  /** Discovery cutoff */
  discoveryCutoff?: Date

  /** Trial date */
  trialDate?: Date

  /** Settlement amount */
  settlementAmount?: {
    amount: number
    currency: string
  }

  /** Judgment amount */
  judgmentAmount?: {
    amount: number
    currency: string
  }

  /** Outcome */
  outcome?: string

  /** Related contracts */
  contractIds?: string[]

  /** Related IP */
  ipIds?: string[]

  /** Case documents */
  documentUrls?: string[]

  /** Internal case manager */
  caseManagerId?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    pacer?: string
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type LegalCaseInput = Input<LegalCase>
export type LegalCaseOutput = Output<LegalCase>

// =============================================================================
// LegalDocument
// =============================================================================

/**
 * Document category.
 */
export type DocumentCategory =
  | 'contract'
  | 'agreement'
  | 'policy'
  | 'pleading'
  | 'motion'
  | 'brief'
  | 'filing'
  | 'correspondence'
  | 'evidence'
  | 'other'

/**
 * Legal document storage.
 *
 * @example
 * ```ts
 * const document: LegalDocument = {
 *   id: 'doc_123',
 *   title: 'Complaint - Patent Infringement',
 *   category: 'pleading',
 *   fileUrl: 'https://...',
 *   fileType: 'application/pdf',
 *   caseId: 'case_123',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface LegalDocument {
  /** Unique identifier */
  id: string

  /** Document title */
  title: string

  /** Document category */
  category: DocumentCategory

  /** File URL */
  fileUrl: string

  /** File type/MIME type */
  fileType?: string

  /** File size (bytes) */
  fileSize?: number

  /** Version */
  version?: string

  /** Document date */
  documentDate?: Date

  /** Author */
  author?: string

  /** Related case ID */
  caseId?: string

  /** Related contract ID */
  contractId?: string

  /** Related entity ID */
  entityId?: string

  /** Description */
  description?: string

  /** Is confidential */
  isConfidential?: boolean

  /** Is privileged */
  isPrivileged?: boolean

  /** Retention period */
  retentionPeriod?: string

  /** Destruction date */
  destructionDate?: Date

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type LegalDocumentInput = Input<LegalDocument>
export type LegalDocumentOutput = Output<LegalDocument>

// =============================================================================
// Regulation
// =============================================================================

/**
 * Regulatory requirement.
 *
 * @example
 * ```ts
 * const regulation: Regulation = {
 *   id: 'reg_123',
 *   title: 'GDPR Article 32 - Security of Processing',
 *   framework: 'GDPR',
 *   category: 'data_security',
 *   jurisdiction: 'EU',
 *   effectiveDate: new Date('2018-05-25'),
 *   requirementText: 'Implement appropriate technical and organizational measures...',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Regulation {
  /** Unique identifier */
  id: string

  /** Regulation title */
  title: string

  /** Regulatory framework */
  framework: string

  /** Category */
  category: string

  /** Jurisdiction */
  jurisdiction?: string

  /** Regulatory body */
  regulatoryBody?: string

  /** Citation/reference */
  citation?: string

  /** Effective date */
  effectiveDate?: Date

  /** Amendment date */
  amendmentDate?: Date

  /** Requirement text */
  requirementText?: string

  /** Applicability criteria */
  applicability?: string

  /** Is applicable to us */
  isApplicable?: boolean

  /** Compliance deadline */
  complianceDeadline?: Date

  /** Penalties for non-compliance */
  penalties?: string

  /** Related controls */
  controlIds?: string[]

  /** Related policies */
  policyIds?: string[]

  /** Official URL */
  officialUrl?: string

  /** Tags */
  tags?: string[]

  /** Metadata */
  metadata?: Record<string, unknown>

  /** External IDs from integrated systems */
  externalIds?: {
    [key: string]: string | undefined
  }

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type RegulationInput = Input<Regulation>
export type RegulationOutput = Output<Regulation>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface ContractActions extends CRUDResource<Contract, ContractInput> {
  /** Search contracts */
  search: Action<{ query: string } & ListParams, PaginatedResult<Contract>>

  /** Renew contract */
  renew: Action<{ id: string; term?: string; value?: { amount: number; currency: string } }, Contract>

  /** Terminate contract */
  terminate: Action<{ id: string; terminationDate?: Date; reason?: string }, Contract>

  /** Add amendment */
  addAmendment: Action<{ id: string; amendment: AmendmentInput }, Amendment>

  /** Get amendments */
  getAmendments: Action<{ id: string }, Amendment[]>

  /** Request signatures */
  requestSignatures: Action<{ id: string; signers: Array<{ email: string; name: string }> }, SignatureRequest>

  /** Get expiring contracts */
  getExpiring: Action<{ daysAhead: number } & ListParams, PaginatedResult<Contract>>
}

export interface ContractTemplateActions extends CRUDResource<ContractTemplate, ContractTemplateInput> {
  /** Generate contract from template */
  generate: Action<{ id: string; variables: Record<string, unknown> }, Contract>

  /** Clone template */
  clone: Action<{ id: string; name?: string }, ContractTemplate>

  /** Publish template */
  publish: Action<{ id: string }, ContractTemplate>

  /** Unpublish template */
  unpublish: Action<{ id: string }, ContractTemplate>
}

export interface ContractClauseActions extends CRUDResource<ContractClause, ContractClauseInput> {
  /** Search clauses */
  search: Action<{ query: string; category?: string } & ListParams, PaginatedResult<ContractClause>>

  /** Get by category */
  getByCategory: Action<{ category: string } & ListParams, PaginatedResult<ContractClause>>
}

export interface AmendmentActions extends CRUDResource<Amendment, AmendmentInput> {
  /** Approve amendment */
  approve: Action<{ id: string; approvedBy: string }, Amendment>

  /** Reject amendment */
  reject: Action<{ id: string; reason: string }, Amendment>

  /** Execute amendment */
  execute: Action<{ id: string; effectiveDate?: Date }, Amendment>
}

export interface SignatureActions extends CRUDResource<Signature, SignatureInput> {
  /** Verify signature */
  verify: Action<{ id: string }, { valid: boolean; details: Record<string, unknown> }>
}

export interface SignatureRequestActions extends CRUDResource<SignatureRequest, SignatureRequestInput> {
  /** Send signature request */
  send: Action<{ id: string }, SignatureRequest>

  /** Cancel signature request */
  cancel: Action<{ id: string; reason?: string }, SignatureRequest>

  /** Send reminder */
  sendReminder: Action<{ id: string; signerEmail?: string }, SignatureRequest>

  /** Get status */
  getStatus: Action<{ id: string }, { status: SignatureRequestStatus; signers: Array<{ email: string; status: SignatureStatus }> }>
}

export interface AgreementActions extends CRUDResource<Agreement, AgreementInput> {
  /** Search agreements */
  search: Action<{ query: string; type?: string } & ListParams, PaginatedResult<Agreement>>

  /** Terminate agreement */
  terminate: Action<{ id: string; reason?: string }, Agreement>
}

export interface NDAActions extends CRUDResource<NDA, NDAInput> {
  /** Search NDAs */
  search: Action<{ query: string; type?: NDAType } & ListParams, PaginatedResult<NDA>>

  /** Terminate NDA */
  terminate: Action<{ id: string; reason?: string }, NDA>
}

export interface TermsOfServiceActions extends CRUDResource<TermsOfService, TermsOfServiceInput> {
  /** Publish new version */
  publish: Action<{ id: string }, TermsOfService>

  /** Get current version */
  getCurrent: Action<Record<string, never>, TermsOfService>

  /** Get user acceptances */
  getUserAcceptances: Action<{ id: string } & ListParams, PaginatedResult<{ userId: string; acceptedAt: Date }>>

  /** Record user acceptance */
  recordAcceptance: Action<{ id: string; userId: string }, void>
}

export interface PrivacyPolicyActions extends CRUDResource<PrivacyPolicy, PrivacyPolicyInput> {
  /** Publish new version */
  publish: Action<{ id: string }, PrivacyPolicy>

  /** Get current version */
  getCurrent: Action<Record<string, never>, PrivacyPolicy>
}

export interface ComplianceActions extends CRUDResource<Compliance, ComplianceInput> {
  /** Run assessment */
  runAssessment: Action<{ frameworkId: string; assessorId?: string }, Compliance>

  /** Get by framework */
  getByFramework: Action<{ frameworkId: string }, Compliance[]>

  /** Update status */
  updateStatus: Action<{ id: string; status: ComplianceStatus; score?: number }, Compliance>
}

export interface ComplianceFrameworkActions extends CRUDResource<ComplianceFramework, ComplianceFrameworkInput> {
  /** Search frameworks */
  search: Action<{ query: string; type?: FrameworkType } & ListParams, PaginatedResult<ComplianceFramework>>

  /** Get controls */
  getControls: Action<{ id: string } & ListParams, PaginatedResult<ComplianceControl>>

  /** Activate framework */
  activate: Action<{ id: string }, ComplianceFramework>

  /** Deactivate framework */
  deactivate: Action<{ id: string }, ComplianceFramework>
}

export interface ComplianceControlActions extends CRUDResource<ComplianceControl, ComplianceControlInput> {
  /** Test control */
  test: Action<{ id: string; testerId?: string; notes?: string }, { result: 'passed' | 'failed' | 'partial'; control: ComplianceControl }>

  /** Update status */
  updateStatus: Action<{ id: string; status: ControlStatus; implementationDate?: Date }, ComplianceControl>

  /** Get by framework */
  getByFramework: Action<{ frameworkId: string } & ListParams, PaginatedResult<ComplianceControl>>
}

export interface AuditActions extends CRUDResource<Audit, AuditInput> {
  /** Start audit */
  start: Action<{ id: string }, Audit>

  /** Complete audit */
  complete: Action<{ id: string; conclusion?: string; opinion?: string; reportUrl?: string }, Audit>

  /** Cancel audit */
  cancel: Action<{ id: string; reason?: string }, Audit>

  /** Get findings */
  getFindings: Action<{ id: string } & ListParams, PaginatedResult<AuditFinding>>

  /** Add finding */
  addFinding: Action<{ auditId: string; finding: AuditFindingInput }, AuditFinding>
}

export interface AuditFindingActions extends CRUDResource<AuditFinding, AuditFindingInput> {
  /** Resolve finding */
  resolve: Action<{ id: string; resolutionEvidenceUrls?: string[] }, AuditFinding>

  /** Accept finding */
  accept: Action<{ id: string; reason?: string }, AuditFinding>

  /** Get by severity */
  getBySeverity: Action<{ severity: FindingSeverity } & ListParams, PaginatedResult<AuditFinding>>
}

export interface RiskActions extends CRUDResource<Risk, RiskInput> {
  /** Assess risk */
  assess: Action<{ id: string; probability: number; impact: number }, Risk>

  /** Accept risk */
  accept: Action<{ id: string; reason: string }, Risk>

  /** Get high risks */
  getHighRisks: Action<ListParams, PaginatedResult<Risk>>

  /** Get by category */
  getByCategory: Action<{ category: string } & ListParams, PaginatedResult<Risk>>

  /** Get mitigations */
  getMitigations: Action<{ id: string }, RiskMitigation[]>
}

export interface RiskMitigationActions extends CRUDResource<RiskMitigation, RiskMitigationInput> {
  /** Implement mitigation */
  implement: Action<{ id: string }, RiskMitigation>

  /** Validate mitigation */
  validate: Action<{ id: string; effectiveness?: number }, RiskMitigation>

  /** Cancel mitigation */
  cancel: Action<{ id: string; reason?: string }, RiskMitigation>

  /** Update progress */
  updateProgress: Action<{ id: string; progress: number }, RiskMitigation>
}

export interface IncidentActions extends CRUDResource<Incident, IncidentInput> {
  /** Escalate incident */
  escalate: Action<{ id: string; severity: IncidentSeverity; commanderId?: string }, Incident>

  /** Contain incident */
  contain: Action<{ id: string; actions: string[] }, Incident>

  /** Resolve incident */
  resolve: Action<{ id: string; resolutionNotes?: string }, Incident>

  /** Close incident */
  close: Action<{ id: string; reportUrl?: string }, Incident>

  /** Send notifications */
  sendNotifications: Action<{ id: string; recipients: Array<{ type: string; recipient: string }> }, Incident>

  /** Get by severity */
  getBySeverity: Action<{ severity: IncidentSeverity } & ListParams, PaginatedResult<Incident>>

  /** Get open incidents */
  getOpen: Action<ListParams, PaginatedResult<Incident>>
}

export interface DataProcessingAgreementActions extends CRUDResource<DataProcessingAgreement, DataProcessingAgreementInput> {
  /** Search DPAs */
  search: Action<{ query: string } & ListParams, PaginatedResult<DataProcessingAgreement>>

  /** Terminate DPA */
  terminate: Action<{ id: string; reason?: string }, DataProcessingAgreement>

  /** Add sub-processor */
  addSubProcessor: Action<{ id: string; name: string; service: string; location?: string }, DataProcessingAgreement>

  /** Remove sub-processor */
  removeSubProcessor: Action<{ id: string; name: string }, DataProcessingAgreement>
}

export interface DataSubjectRequestActions extends CRUDResource<DataSubjectRequest, DataSubjectRequestInput> {
  /** Verify request */
  verify: Action<{ id: string; method: string }, DataSubjectRequest>

  /** Process request */
  process: Action<{ id: string; notes?: string }, DataSubjectRequest>

  /** Complete request */
  complete: Action<{ id: string; evidenceUrls?: string[] }, DataSubjectRequest>

  /** Reject request */
  reject: Action<{ id: string; reason: string }, DataSubjectRequest>

  /** Get overdue requests */
  getOverdue: Action<ListParams, PaginatedResult<DataSubjectRequest>>
}

export interface ConsentActions extends CRUDResource<Consent, ConsentInput> {
  /** Withdraw consent */
  withdraw: Action<{ id: string }, Consent>

  /** Get by user */
  getByUser: Action<{ userId: string } & ListParams, PaginatedResult<Consent>>

  /** Get by purpose */
  getByPurpose: Action<{ purpose: string } & ListParams, PaginatedResult<Consent>>

  /** Check consent */
  check: Action<{ userId: string; purpose: string }, { hasConsent: boolean; consent?: Consent }>
}

export interface IntellectualPropertyActions extends CRUDResource<IntellectualProperty, IntellectualPropertyInput> {
  /** Search IP */
  search: Action<{ query: string; type?: IPType } & ListParams, PaginatedResult<IntellectualProperty>>

  /** Get by type */
  getByType: Action<{ type: IPType } & ListParams, PaginatedResult<IntellectualProperty>>

  /** Get expiring IP */
  getExpiring: Action<{ daysAhead: number } & ListParams, PaginatedResult<IntellectualProperty>>

  /** Pay maintenance fee */
  payMaintenanceFee: Action<{ id: string; feeIndex: number }, IntellectualProperty>
}

export interface PatentActions extends CRUDResource<Patent, PatentInput> {
  /** Search patents */
  search: Action<{ query: string; patentType?: PatentType } & ListParams, PaginatedResult<Patent>>

  /** Get by inventor */
  getByInventor: Action<{ inventor: string } & ListParams, PaginatedResult<Patent>>

  /** Get family members */
  getFamilyMembers: Action<{ id: string }, Patent[]>
}

export interface TrademarkActions extends CRUDResource<Trademark, TrademarkInput> {
  /** Search trademarks */
  search: Action<{ query: string; trademarkType?: TrademarkType } & ListParams, PaginatedResult<Trademark>>

  /** Get by class */
  getByClass: Action<{ class: string } & ListParams, PaginatedResult<Trademark>>

  /** Get renewals due */
  getRenewalsDue: Action<{ daysAhead: number } & ListParams, PaginatedResult<Trademark>>
}

export interface CopyrightActions extends CRUDResource<Copyright, CopyrightInput> {
  /** Search copyrights */
  search: Action<{ query: string; copyrightType?: CopyrightType } & ListParams, PaginatedResult<Copyright>>

  /** Get by author */
  getByAuthor: Action<{ author: string } & ListParams, PaginatedResult<Copyright>>
}

export interface LicenseActions extends CRUDResource<License, LicenseInput> {
  /** Search licenses */
  search: Action<{ query: string; licenseType?: LicenseType } & ListParams, PaginatedResult<License>>

  /** Terminate license */
  terminate: Action<{ id: string; reason?: string }, License>

  /** Suspend license */
  suspend: Action<{ id: string; reason?: string }, License>

  /** Resume license */
  resume: Action<{ id: string }, License>

  /** Get expiring licenses */
  getExpiring: Action<{ daysAhead: number } & ListParams, PaginatedResult<License>>
}

export interface LegalEntityActions extends CRUDResource<LegalEntity, LegalEntityInput> {
  /** Search entities */
  search: Action<{ query: string; entityType?: EntityType } & ListParams, PaginatedResult<LegalEntity>>

  /** Get subsidiaries */
  getSubsidiaries: Action<{ id: string }, LegalEntity[]>

  /** Dissolve entity */
  dissolve: Action<{ id: string; dissolutionDate?: Date }, LegalEntity>

  /** Add officer */
  addOfficer: Action<{ id: string; name: string; role: string; appointedDate?: Date }, LegalEntity>

  /** Remove officer */
  removeOfficer: Action<{ id: string; name: string }, LegalEntity>
}

export interface LegalCaseActions extends CRUDResource<LegalCase, LegalCaseInput> {
  /** Search cases */
  search: Action<{ query: string; caseType?: CaseType } & ListParams, PaginatedResult<LegalCase>>

  /** Settle case */
  settle: Action<{ id: string; settlementAmount?: { amount: number; currency: string }; terms?: string }, LegalCase>

  /** Close case */
  close: Action<{ id: string; outcome?: string }, LegalCase>

  /** Add key date */
  addKeyDate: Action<{ id: string; event: string; date: Date }, LegalCase>

  /** Get active cases */
  getActive: Action<ListParams, PaginatedResult<LegalCase>>
}

export interface LegalDocumentActions extends CRUDResource<LegalDocument, LegalDocumentInput> {
  /** Search documents */
  search: Action<{ query: string; category?: DocumentCategory } & ListParams, PaginatedResult<LegalDocument>>

  /** Get by case */
  getByCase: Action<{ caseId: string } & ListParams, PaginatedResult<LegalDocument>>

  /** Get by contract */
  getByContract: Action<{ contractId: string } & ListParams, PaginatedResult<LegalDocument>>

  /** Upload new version */
  uploadVersion: Action<{ id: string; fileUrl: string; version?: string }, LegalDocument>
}

export interface RegulationActions extends CRUDResource<Regulation, RegulationInput> {
  /** Search regulations */
  search: Action<{ query: string; framework?: string } & ListParams, PaginatedResult<Regulation>>

  /** Get by framework */
  getByFramework: Action<{ framework: string } & ListParams, PaginatedResult<Regulation>>

  /** Get applicable regulations */
  getApplicable: Action<ListParams, PaginatedResult<Regulation>>

  /** Mark as applicable */
  markApplicable: Action<{ id: string; isApplicable: boolean }, Regulation>
}

// =============================================================================
// Events
// =============================================================================

export interface ContractEvents {
  created: BaseEvent<'contract.created', Contract>
  updated: BaseEvent<'contract.updated', Contract>
  deleted: BaseEvent<'contract.deleted', { id: string }>
  signed: BaseEvent<'contract.signed', Contract>
  renewed: BaseEvent<'contract.renewed', Contract>
  terminated: BaseEvent<'contract.terminated', { id: string; reason?: string }>
  expiring_soon: BaseEvent<'contract.expiring_soon', { contract: Contract; daysRemaining: number }>
  expired: BaseEvent<'contract.expired', { id: string }>
  amendment_added: BaseEvent<'contract.amendment_added', { contractId: string; amendment: Amendment }>
}

export interface ContractTemplateEvents {
  created: BaseEvent<'contract_template.created', ContractTemplate>
  updated: BaseEvent<'contract_template.updated', ContractTemplate>
  deleted: BaseEvent<'contract_template.deleted', { id: string }>
  published: BaseEvent<'contract_template.published', ContractTemplate>
  unpublished: BaseEvent<'contract_template.unpublished', { id: string }>
}

export interface ContractClauseEvents {
  created: BaseEvent<'contract_clause.created', ContractClause>
  updated: BaseEvent<'contract_clause.updated', ContractClause>
  deleted: BaseEvent<'contract_clause.deleted', { id: string }>
}

export interface AmendmentEvents {
  created: BaseEvent<'amendment.created', Amendment>
  updated: BaseEvent<'amendment.updated', Amendment>
  deleted: BaseEvent<'amendment.deleted', { id: string }>
  approved: BaseEvent<'amendment.approved', Amendment>
  rejected: BaseEvent<'amendment.rejected', { id: string; reason: string }>
  executed: BaseEvent<'amendment.executed', Amendment>
}

export interface SignatureEvents {
  created: BaseEvent<'signature.created', Signature>
  signed: BaseEvent<'signature.signed', Signature>
  declined: BaseEvent<'signature.declined', { id: string; reason?: string }>
  expired: BaseEvent<'signature.expired', { id: string }>
}

export interface SignatureRequestEvents {
  created: BaseEvent<'signature_request.created', SignatureRequest>
  updated: BaseEvent<'signature_request.updated', SignatureRequest>
  sent: BaseEvent<'signature_request.sent', SignatureRequest>
  completed: BaseEvent<'signature_request.completed', SignatureRequest>
  declined: BaseEvent<'signature_request.declined', { id: string }>
  expired: BaseEvent<'signature_request.expired', { id: string }>
  cancelled: BaseEvent<'signature_request.cancelled', { id: string; reason?: string }>
  reminder_sent: BaseEvent<'signature_request.reminder_sent', { id: string; signerEmail?: string }>
}

export interface AgreementEvents {
  created: BaseEvent<'agreement.created', Agreement>
  updated: BaseEvent<'agreement.updated', Agreement>
  deleted: BaseEvent<'agreement.deleted', { id: string }>
  terminated: BaseEvent<'agreement.terminated', { id: string; reason?: string }>
}

export interface NDAEvents {
  created: BaseEvent<'nda.created', NDA>
  updated: BaseEvent<'nda.updated', NDA>
  deleted: BaseEvent<'nda.deleted', { id: string }>
  terminated: BaseEvent<'nda.terminated', { id: string; reason?: string }>
  expiring_soon: BaseEvent<'nda.expiring_soon', { nda: NDA; daysRemaining: number }>
}

export interface TermsOfServiceEvents {
  created: BaseEvent<'terms_of_service.created', TermsOfService>
  updated: BaseEvent<'terms_of_service.updated', TermsOfService>
  published: BaseEvent<'terms_of_service.published', TermsOfService>
  accepted: BaseEvent<'terms_of_service.accepted', { tosId: string; userId: string }>
}

export interface PrivacyPolicyEvents {
  created: BaseEvent<'privacy_policy.created', PrivacyPolicy>
  updated: BaseEvent<'privacy_policy.updated', PrivacyPolicy>
  published: BaseEvent<'privacy_policy.published', PrivacyPolicy>
}

export interface ComplianceEvents {
  created: BaseEvent<'compliance.created', Compliance>
  updated: BaseEvent<'compliance.updated', Compliance>
  assessment_started: BaseEvent<'compliance.assessment_started', { frameworkId: string }>
  assessment_completed: BaseEvent<'compliance.assessment_completed', Compliance>
  status_changed: BaseEvent<'compliance.status_changed', { id: string; oldStatus: ComplianceStatus; newStatus: ComplianceStatus }>
  review_due: BaseEvent<'compliance.review_due', { compliance: Compliance }>
}

export interface ComplianceFrameworkEvents {
  created: BaseEvent<'compliance_framework.created', ComplianceFramework>
  updated: BaseEvent<'compliance_framework.updated', ComplianceFramework>
  deleted: BaseEvent<'compliance_framework.deleted', { id: string }>
  activated: BaseEvent<'compliance_framework.activated', ComplianceFramework>
  deactivated: BaseEvent<'compliance_framework.deactivated', { id: string }>
}

export interface ComplianceControlEvents {
  created: BaseEvent<'compliance_control.created', ComplianceControl>
  updated: BaseEvent<'compliance_control.updated', ComplianceControl>
  deleted: BaseEvent<'compliance_control.deleted', { id: string }>
  tested: BaseEvent<'compliance_control.tested', { control: ComplianceControl; result: string }>
  status_changed: BaseEvent<'compliance_control.status_changed', { id: string; oldStatus: ControlStatus; newStatus: ControlStatus }>
  test_due: BaseEvent<'compliance_control.test_due', { control: ComplianceControl }>
}

export interface AuditEvents {
  created: BaseEvent<'audit.created', Audit>
  updated: BaseEvent<'audit.updated', Audit>
  started: BaseEvent<'audit.started', Audit>
  completed: BaseEvent<'audit.completed', Audit>
  cancelled: BaseEvent<'audit.cancelled', { id: string; reason?: string }>
  finding_added: BaseEvent<'audit.finding_added', { auditId: string; finding: AuditFinding }>
}

export interface AuditFindingEvents {
  created: BaseEvent<'audit_finding.created', AuditFinding>
  updated: BaseEvent<'audit_finding.updated', AuditFinding>
  resolved: BaseEvent<'audit_finding.resolved', AuditFinding>
  accepted: BaseEvent<'audit_finding.accepted', { id: string; reason?: string }>
  due_soon: BaseEvent<'audit_finding.due_soon', { finding: AuditFinding; daysRemaining: number }>
}

export interface RiskEvents {
  created: BaseEvent<'risk.created', Risk>
  updated: BaseEvent<'risk.updated', Risk>
  deleted: BaseEvent<'risk.deleted', { id: string }>
  assessed: BaseEvent<'risk.assessed', Risk>
  accepted: BaseEvent<'risk.accepted', { id: string; reason: string }>
  level_changed: BaseEvent<'risk.level_changed', { id: string; oldLevel: RiskLevel; newLevel: RiskLevel }>
  review_due: BaseEvent<'risk.review_due', { risk: Risk }>
  threshold_exceeded: BaseEvent<'risk.threshold_exceeded', { risk: Risk }>
}

export interface RiskMitigationEvents {
  created: BaseEvent<'risk_mitigation.created', RiskMitigation>
  updated: BaseEvent<'risk_mitigation.updated', RiskMitigation>
  deleted: BaseEvent<'risk_mitigation.deleted', { id: string }>
  implemented: BaseEvent<'risk_mitigation.implemented', RiskMitigation>
  validated: BaseEvent<'risk_mitigation.validated', RiskMitigation>
  cancelled: BaseEvent<'risk_mitigation.cancelled', { id: string; reason?: string }>
  due_soon: BaseEvent<'risk_mitigation.due_soon', { mitigation: RiskMitigation; daysRemaining: number }>
}

export interface IncidentEvents {
  created: BaseEvent<'incident.created', Incident>
  updated: BaseEvent<'incident.updated', Incident>
  escalated: BaseEvent<'incident.escalated', { id: string; oldSeverity: IncidentSeverity; newSeverity: IncidentSeverity }>
  contained: BaseEvent<'incident.contained', Incident>
  resolved: BaseEvent<'incident.resolved', Incident>
  closed: BaseEvent<'incident.closed', Incident>
  notification_sent: BaseEvent<'incident.notification_sent', { incidentId: string; recipient: string; type: string }>
  notification_deadline_approaching: BaseEvent<'incident.notification_deadline_approaching', { incident: Incident; hoursRemaining: number }>
}

export interface DataProcessingAgreementEvents {
  created: BaseEvent<'data_processing_agreement.created', DataProcessingAgreement>
  updated: BaseEvent<'data_processing_agreement.updated', DataProcessingAgreement>
  deleted: BaseEvent<'data_processing_agreement.deleted', { id: string }>
  terminated: BaseEvent<'data_processing_agreement.terminated', { id: string; reason?: string }>
  sub_processor_added: BaseEvent<'data_processing_agreement.sub_processor_added', { dpaId: string; subProcessor: string }>
  expiring_soon: BaseEvent<'data_processing_agreement.expiring_soon', { dpa: DataProcessingAgreement; daysRemaining: number }>
}

export interface DataSubjectRequestEvents {
  created: BaseEvent<'data_subject_request.created', DataSubjectRequest>
  updated: BaseEvent<'data_subject_request.updated', DataSubjectRequest>
  verified: BaseEvent<'data_subject_request.verified', DataSubjectRequest>
  completed: BaseEvent<'data_subject_request.completed', DataSubjectRequest>
  rejected: BaseEvent<'data_subject_request.rejected', { id: string; reason: string }>
  due_soon: BaseEvent<'data_subject_request.due_soon', { request: DataSubjectRequest; daysRemaining: number }>
  overdue: BaseEvent<'data_subject_request.overdue', { request: DataSubjectRequest }>
}

export interface ConsentEvents {
  created: BaseEvent<'consent.created', Consent>
  granted: BaseEvent<'consent.granted', Consent>
  withdrawn: BaseEvent<'consent.withdrawn', Consent>
  expired: BaseEvent<'consent.expired', { id: string }>
}

export interface IntellectualPropertyEvents {
  created: BaseEvent<'intellectual_property.created', IntellectualProperty>
  updated: BaseEvent<'intellectual_property.updated', IntellectualProperty>
  deleted: BaseEvent<'intellectual_property.deleted', { id: string }>
  granted: BaseEvent<'intellectual_property.granted', IntellectualProperty>
  expired: BaseEvent<'intellectual_property.expired', { id: string }>
  renewal_due: BaseEvent<'intellectual_property.renewal_due', { ip: IntellectualProperty; daysRemaining: number }>
  maintenance_fee_due: BaseEvent<'intellectual_property.maintenance_fee_due', { ip: IntellectualProperty; fee: { dueDate: Date; amount: number } }>
}

export interface PatentEvents {
  created: BaseEvent<'patent.created', Patent>
  updated: BaseEvent<'patent.updated', Patent>
  deleted: BaseEvent<'patent.deleted', { id: string }>
  granted: BaseEvent<'patent.granted', Patent>
  published: BaseEvent<'patent.published', Patent>
  expired: BaseEvent<'patent.expired', { id: string }>
}

export interface TrademarkEvents {
  created: BaseEvent<'trademark.created', Trademark>
  updated: BaseEvent<'trademark.updated', Trademark>
  deleted: BaseEvent<'trademark.deleted', { id: string }>
  registered: BaseEvent<'trademark.registered', Trademark>
  published: BaseEvent<'trademark.published', Trademark>
  expired: BaseEvent<'trademark.expired', { id: string }>
  renewal_due: BaseEvent<'trademark.renewal_due', { trademark: Trademark; daysRemaining: number }>
}

export interface CopyrightEvents {
  created: BaseEvent<'copyright.created', Copyright>
  updated: BaseEvent<'copyright.updated', Copyright>
  deleted: BaseEvent<'copyright.deleted', { id: string }>
  registered: BaseEvent<'copyright.registered', Copyright>
  expired: BaseEvent<'copyright.expired', { id: string }>
}

export interface LicenseEvents {
  created: BaseEvent<'license.created', License>
  updated: BaseEvent<'license.updated', License>
  deleted: BaseEvent<'license.deleted', { id: string }>
  terminated: BaseEvent<'license.terminated', { id: string; reason?: string }>
  suspended: BaseEvent<'license.suspended', { id: string; reason?: string }>
  resumed: BaseEvent<'license.resumed', License>
  expiring_soon: BaseEvent<'license.expiring_soon', { license: License; daysRemaining: number }>
}

export interface LegalEntityEvents {
  created: BaseEvent<'legal_entity.created', LegalEntity>
  updated: BaseEvent<'legal_entity.updated', LegalEntity>
  deleted: BaseEvent<'legal_entity.deleted', { id: string }>
  dissolved: BaseEvent<'legal_entity.dissolved', { id: string; dissolutionDate: Date }>
  officer_added: BaseEvent<'legal_entity.officer_added', { entityId: string; officer: { name: string; role: string } }>
  officer_removed: BaseEvent<'legal_entity.officer_removed', { entityId: string; officer: string }>
  annual_report_due: BaseEvent<'legal_entity.annual_report_due', { entity: LegalEntity }>
}

export interface LegalCaseEvents {
  created: BaseEvent<'legal_case.created', LegalCase>
  updated: BaseEvent<'legal_case.updated', LegalCase>
  deleted: BaseEvent<'legal_case.deleted', { id: string }>
  filed: BaseEvent<'legal_case.filed', LegalCase>
  settled: BaseEvent<'legal_case.settled', { caseId: string; settlementAmount?: { amount: number; currency: string } }>
  closed: BaseEvent<'legal_case.closed', { caseId: string; outcome?: string }>
  key_date_approaching: BaseEvent<'legal_case.key_date_approaching', { case: LegalCase; event: string; date: Date; daysRemaining: number }>
}

export interface LegalDocumentEvents {
  created: BaseEvent<'legal_document.created', LegalDocument>
  updated: BaseEvent<'legal_document.updated', LegalDocument>
  deleted: BaseEvent<'legal_document.deleted', { id: string }>
  version_uploaded: BaseEvent<'legal_document.version_uploaded', { documentId: string; version: string }>
  destruction_due: BaseEvent<'legal_document.destruction_due', { document: LegalDocument }>
}

export interface RegulationEvents {
  created: BaseEvent<'regulation.created', Regulation>
  updated: BaseEvent<'regulation.updated', Regulation>
  deleted: BaseEvent<'regulation.deleted', { id: string }>
  marked_applicable: BaseEvent<'regulation.marked_applicable', Regulation>
  compliance_deadline_approaching: BaseEvent<'regulation.compliance_deadline_approaching', { regulation: Regulation; daysRemaining: number }>
}

// =============================================================================
// Resources
// =============================================================================

export interface ContractResource extends ContractActions {
  on: <K extends keyof ContractEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ContractEvents[K], TProxy>
  ) => () => void
}

export interface ContractTemplateResource extends ContractTemplateActions {
  on: <K extends keyof ContractTemplateEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ContractTemplateEvents[K], TProxy>
  ) => () => void
}

export interface ContractClauseResource extends ContractClauseActions {
  on: <K extends keyof ContractClauseEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ContractClauseEvents[K], TProxy>
  ) => () => void
}

export interface AmendmentResource extends AmendmentActions {
  on: <K extends keyof AmendmentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AmendmentEvents[K], TProxy>
  ) => () => void
}

export interface SignatureResource extends SignatureActions {
  on: <K extends keyof SignatureEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SignatureEvents[K], TProxy>
  ) => () => void
}

export interface SignatureRequestResource extends SignatureRequestActions {
  on: <K extends keyof SignatureRequestEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<SignatureRequestEvents[K], TProxy>
  ) => () => void
}

export interface AgreementResource extends AgreementActions {
  on: <K extends keyof AgreementEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AgreementEvents[K], TProxy>
  ) => () => void
}

export interface NDAResource extends NDAActions {
  on: <K extends keyof NDAEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<NDAEvents[K], TProxy>
  ) => () => void
}

export interface TermsOfServiceResource extends TermsOfServiceActions {
  on: <K extends keyof TermsOfServiceEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TermsOfServiceEvents[K], TProxy>
  ) => () => void
}

export interface PrivacyPolicyResource extends PrivacyPolicyActions {
  on: <K extends keyof PrivacyPolicyEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PrivacyPolicyEvents[K], TProxy>
  ) => () => void
}

export interface ComplianceResource extends ComplianceActions {
  on: <K extends keyof ComplianceEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ComplianceEvents[K], TProxy>
  ) => () => void
}

export interface ComplianceFrameworkResource extends ComplianceFrameworkActions {
  on: <K extends keyof ComplianceFrameworkEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ComplianceFrameworkEvents[K], TProxy>
  ) => () => void
}

export interface ComplianceControlResource extends ComplianceControlActions {
  on: <K extends keyof ComplianceControlEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ComplianceControlEvents[K], TProxy>
  ) => () => void
}

export interface AuditResource extends AuditActions {
  on: <K extends keyof AuditEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AuditEvents[K], TProxy>
  ) => () => void
}

export interface AuditFindingResource extends AuditFindingActions {
  on: <K extends keyof AuditFindingEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AuditFindingEvents[K], TProxy>
  ) => () => void
}

export interface RiskResource extends RiskActions {
  on: <K extends keyof RiskEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<RiskEvents[K], TProxy>
  ) => () => void
}

export interface RiskMitigationResource extends RiskMitigationActions {
  on: <K extends keyof RiskMitigationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<RiskMitigationEvents[K], TProxy>
  ) => () => void
}

export interface IncidentResource extends IncidentActions {
  on: <K extends keyof IncidentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<IncidentEvents[K], TProxy>
  ) => () => void
}

export interface DataProcessingAgreementResource extends DataProcessingAgreementActions {
  on: <K extends keyof DataProcessingAgreementEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DataProcessingAgreementEvents[K], TProxy>
  ) => () => void
}

export interface DataSubjectRequestResource extends DataSubjectRequestActions {
  on: <K extends keyof DataSubjectRequestEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DataSubjectRequestEvents[K], TProxy>
  ) => () => void
}

export interface ConsentResource extends ConsentActions {
  on: <K extends keyof ConsentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ConsentEvents[K], TProxy>
  ) => () => void
}

export interface IntellectualPropertyResource extends IntellectualPropertyActions {
  on: <K extends keyof IntellectualPropertyEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<IntellectualPropertyEvents[K], TProxy>
  ) => () => void
}

export interface PatentResource extends PatentActions {
  on: <K extends keyof PatentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PatentEvents[K], TProxy>
  ) => () => void
}

export interface TrademarkResource extends TrademarkActions {
  on: <K extends keyof TrademarkEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TrademarkEvents[K], TProxy>
  ) => () => void
}

export interface CopyrightResource extends CopyrightActions {
  on: <K extends keyof CopyrightEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CopyrightEvents[K], TProxy>
  ) => () => void
}

export interface LicenseResource extends LicenseActions {
  on: <K extends keyof LicenseEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<LicenseEvents[K], TProxy>
  ) => () => void
}

export interface LegalEntityResource extends LegalEntityActions {
  on: <K extends keyof LegalEntityEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<LegalEntityEvents[K], TProxy>
  ) => () => void
}

export interface LegalCaseResource extends LegalCaseActions {
  on: <K extends keyof LegalCaseEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<LegalCaseEvents[K], TProxy>
  ) => () => void
}

export interface LegalDocumentResource extends LegalDocumentActions {
  on: <K extends keyof LegalDocumentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<LegalDocumentEvents[K], TProxy>
  ) => () => void
}

export interface RegulationResource extends RegulationActions {
  on: <K extends keyof RegulationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<RegulationEvents[K], TProxy>
  ) => () => void
}

// =============================================================================
// Legal Proxy (unified interface)
// =============================================================================

/**
 * Complete Legal & Compliance interface combining all resources.
 *
 * @example
 * ```ts
 * const legal: LegalProxy = getLegalProxy()
 *
 * // Create a contract
 * const contract = await legal.contracts.create({
 *   title: 'Software Development Agreement',
 *   type: 'service_agreement',
 *   status: 'draft',
 *   parties: [
 *     { name: 'Acme Corp', role: 'client' },
 *     { name: 'DevCo', role: 'vendor' }
 *   ]
 * })
 *
 * // Subscribe to events
 * legal.contracts.on('expiring_soon', (event, ctx) => {
 *   console.log('Contract expiring:', event.data.contract.title)
 * })
 *
 * // Create a compliance assessment
 * const compliance = await legal.compliance.runAssessment({
 *   frameworkId: 'fw_soc2'
 * })
 * ```
 */
export interface LegalProxy {
  /** Contract resources */
  contracts: ContractResource
  /** Contract template resources */
  contractTemplates: ContractTemplateResource
  /** Contract clause resources */
  contractClauses: ContractClauseResource
  /** Amendment resources */
  amendments: AmendmentResource
  /** Signature resources */
  signatures: SignatureResource
  /** Signature request resources */
  signatureRequests: SignatureRequestResource
  /** Agreement resources */
  agreements: AgreementResource
  /** NDA resources */
  ndas: NDAResource
  /** Terms of Service resources */
  termsOfService: TermsOfServiceResource
  /** Privacy Policy resources */
  privacyPolicies: PrivacyPolicyResource
  /** Compliance resources */
  compliance: ComplianceResource
  /** Compliance framework resources */
  complianceFrameworks: ComplianceFrameworkResource
  /** Compliance control resources */
  complianceControls: ComplianceControlResource
  /** Audit resources */
  audits: AuditResource
  /** Audit finding resources */
  auditFindings: AuditFindingResource
  /** Risk resources */
  risks: RiskResource
  /** Risk mitigation resources */
  riskMitigations: RiskMitigationResource
  /** Incident resources */
  incidents: IncidentResource
  /** Data processing agreement resources */
  dataProcessingAgreements: DataProcessingAgreementResource
  /** Data subject request resources */
  dataSubjectRequests: DataSubjectRequestResource
  /** Consent resources */
  consents: ConsentResource
  /** Intellectual property resources */
  intellectualProperty: IntellectualPropertyResource
  /** Patent resources */
  patents: PatentResource
  /** Trademark resources */
  trademarks: TrademarkResource
  /** Copyright resources */
  copyrights: CopyrightResource
  /** License resources */
  licenses: LicenseResource
  /** Legal entity resources */
  legalEntities: LegalEntityResource
  /** Legal case resources */
  legalCases: LegalCaseResource
  /** Legal document resources */
  legalDocuments: LegalDocumentResource
  /** Regulation resources */
  regulations: RegulationResource
}

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported legal management providers.
 */
export type LegalProvider =
  | 'docusign'
  | 'hellosign'
  | 'adobesign'
  | 'pandadoc'
  | 'ironclad'
  | 'contractworks'
  | 'vanta'
  | 'drata'
  | 'secureframe'
  | 'custom'

/**
 * Provider configuration.
 */
export interface LegalProviderConfig {
  provider: LegalProvider
  apiKey?: string
  accessToken?: string
  refreshToken?: string
  baseUrl?: string
  webhookSecret?: string
}
