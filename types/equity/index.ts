/**
 * Equity & Fundraising Types
 *
 * Comprehensive types for startup equity management:
 * - Investors and shareholder management
 * - Share classes and equity ownership
 * - Vesting schedules and option grants
 * - Funding rounds and cap table
 * - Startup metrics (burn, runway, CAC, LTV)
 *
 * @module equity
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
// Investor - Venture Capital, Angel, and Individual Investors
// =============================================================================

/**
 * Investor type classification.
 */
export type InvestorType =
  | 'individual'
  | 'angel'
  | 'vc'
  | 'corporate_vc'
  | 'family_office'
  | 'fund'
  | 'accelerator'
  | 'institutional'
  | 'strategic'

/**
 * Investor relationship status.
 */
export type InvestorRelationship =
  | 'cold'
  | 'warm_intro'
  | 'in_conversations'
  | 'term_sheet'
  | 'committed'
  | 'invested'
  | 'passed'

/**
 * Investor stage focus.
 */
export type InvestorStage =
  | 'pre_seed'
  | 'seed'
  | 'series_a'
  | 'series_b'
  | 'series_c'
  | 'growth'
  | 'late_stage'

/**
 * Investor representing a potential or actual investor in the company.
 *
 * Tracks VC firms, angel investors, and institutional investors
 * along with their investment preferences and relationship status.
 *
 * @example
 * ```ts
 * const investor: Investor = {
 *   id: 'inv_001',
 *   name: 'Sequoia Capital',
 *   type: 'vc',
 *   firmName: 'Sequoia Capital',
 *   contactName: 'Partner Name',
 *   email: 'partner@sequoia.com',
 *   website: 'https://sequoia.com',
 *   focus: ['B2B SaaS', 'AI', 'Developer Tools'],
 *   checkSize: { min: 500000, max: 15000000, currency: 'USD' },
 *   stages: ['seed', 'series_a', 'series_b'],
 *   geography: ['US', 'EU'],
 *   relationship: 'warm_intro',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Investor {
  /** Unique identifier */
  id: string

  /** Investor or firm name */
  name: string

  /** Investor type */
  type: InvestorType

  /** Firm name (if applicable) */
  firmName?: string

  /** Primary contact name */
  contactName?: string

  /** Contact title */
  contactTitle?: string

  /** Contact email */
  email?: string

  /** Contact phone */
  phone?: string

  /** Website */
  website?: string

  /** LinkedIn profile */
  linkedIn?: string

  /** Investment focus areas/sectors */
  focus: string[]

  /** Check size range */
  checkSize?: {
    min: number
    max: number
    currency: string
  }

  /** Investment stages */
  stages: InvestorStage[]

  /** Geographic focus */
  geography?: string[]

  /** Portfolio companies (references) */
  portfolio?: string[]

  /** Relationship status */
  relationship: InvestorRelationship

  /** Source of introduction */
  introSource?: string

  /** Last contact date */
  lastContactDate?: Date

  /** Next follow-up date */
  nextFollowUpDate?: Date

  /** Notes */
  notes?: string

  /** Tags for categorization */
  tags?: string[]

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type InvestorInput = Input<Investor>
export type InvestorOutput = Output<Investor>

// =============================================================================
// Shareholder - Equity Ownership Record
// =============================================================================

/**
 * Shareholder type classification.
 */
export type ShareholderType =
  | 'founder'
  | 'co_founder'
  | 'employee'
  | 'advisor'
  | 'investor'
  | 'board_member'
  | 'consultant'
  | 'other'

/**
 * Shareholder status.
 */
export type ShareholderStatus = 'active' | 'departed' | 'inactive'

/**
 * Shareholder representing an equity holder in the company.
 *
 * Tracks all individuals and entities that own or have rights
 * to equity in the company.
 *
 * @example
 * ```ts
 * const shareholder: Shareholder = {
 *   id: 'sh_001',
 *   businessId: 'biz_acme',
 *   name: 'Alice Smith',
 *   type: 'founder',
 *   email: 'alice@acme.com',
 *   status: 'active',
 *   joinedDate: new Date('2023-01-01'),
 *   signatoryRights: true,
 *   informationRights: true,
 *   proRataRights: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Shareholder {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** Shareholder name */
  name: string

  /** Shareholder type */
  type: ShareholderType

  /** Email address */
  email?: string

  /** Phone number */
  phone?: string

  /** Address */
  address?: {
    street: string
    city: string
    state?: string
    postalCode: string
    country: string
  }

  /** Tax ID (EIN, SSN, etc.) */
  taxId?: string

  /** Status */
  status: ShareholderStatus

  /** Date joined */
  joinedDate: Date

  /** Departure date (if applicable) */
  departedDate?: Date

  /** Whether shareholder has signatory rights */
  signatoryRights: boolean

  /** Whether shareholder has information rights */
  informationRights: boolean

  /** Whether shareholder has pro-rata rights */
  proRataRights: boolean

  /** Whether shareholder has drag-along rights */
  dragAlongRights?: boolean

  /** Whether shareholder has tag-along rights */
  tagAlongRights?: boolean

  /** Board seat (if applicable) */
  boardSeat?: boolean

  /** Related investor ID */
  investorId?: string

  /** Related employee ID */
  employeeId?: string

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ShareholderInput = Input<Shareholder>
export type ShareholderOutput = Output<Shareholder>

// =============================================================================
// ShareClass - Types of Equity
// =============================================================================

/**
 * Share class type.
 */
export type ShareClassType = 'common' | 'preferred'

/**
 * Anti-dilution protection type.
 */
export type AntiDilutionType = 'none' | 'weighted_average' | 'full_ratchet'

/**
 * Liquidation preference type.
 */
export type LiquidationPreferenceType =
  | 'non_participating'
  | 'participating'
  | 'capped_participating'

/**
 * ShareClass defining a type of stock in the company.
 *
 * Share classes define the rights, preferences, and protections
 * for different types of equity (Common, Preferred Series A, etc.).
 *
 * @example
 * ```ts
 * const seriesA: ShareClass = {
 *   id: 'sc_series_a',
 *   businessId: 'biz_acme',
 *   name: 'Series A Preferred',
 *   type: 'preferred',
 *   series: 'A',
 *   authorizedShares: 10000000,
 *   issuedShares: 8000000,
 *   parValue: 0.0001,
 *   pricePerShare: 1.50,
 *   votesPerShare: 1,
 *   liquidationPreference: {
 *     type: 'non_participating',
 *     multiple: 1,
 *     cumulative: false
 *   },
 *   antiDilution: 'weighted_average',
 *   conversionRights: true,
 *   conversionRatio: 1,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface ShareClass {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** Class name (e.g., 'Common', 'Series A Preferred') */
  name: string

  /** Class type */
  type: ShareClassType

  /** Series designation (for preferred stock) */
  series?: string

  /** Total authorized shares */
  authorizedShares: number

  /** Currently issued shares */
  issuedShares: number

  /** Par value per share */
  parValue?: number

  /** Original issue price per share */
  pricePerShare?: number

  /** Votes per share */
  votesPerShare: number

  /** Liquidation preference */
  liquidationPreference?: {
    type: LiquidationPreferenceType
    multiple: number
    cumulative: boolean
    carveOut?: number
  }

  /** Anti-dilution protection */
  antiDilution: AntiDilutionType

  /** Has conversion rights */
  conversionRights: boolean

  /** Conversion ratio to common */
  conversionRatio?: number

  /** Automatic conversion triggers */
  conversionTriggers?: {
    qualifiedIPO?: { minimumValuation: number; minimumProceeds: number }
    majorityShareholder?: boolean
    maturityDate?: Date
  }

  /** Dividend rights */
  dividendRights?: {
    rate?: number
    type: 'cumulative' | 'non_cumulative'
    participating: boolean
  }

  /** Preemptive/pro-rata rights */
  preemptiveRights: boolean

  /** Registration rights */
  registrationRights?: 'demand' | 'piggyback' | 's3' | 'none'

  /** Board seats allocated to this class */
  boardSeats?: number

  /** Protective provisions */
  protectiveProvisions?: string[]

  /** Seniority rank (1 = highest) */
  seniority: number

  /** Is this the option pool? */
  isOptionPool?: boolean

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ShareClassInput = Input<ShareClass>
export type ShareClassOutput = Output<ShareClass>

// =============================================================================
// Share - Actual Equity Ownership
// =============================================================================

/**
 * Share status.
 */
export type ShareStatus =
  | 'authorized'
  | 'issued'
  | 'outstanding'
  | 'unvested'
  | 'vested'
  | 'exercised'
  | 'cancelled'
  | 'forfeited'
  | 'repurchased'

/**
 * Share representing actual equity ownership.
 *
 * Tracks specific share issuances to shareholders,
 * including vesting status and ownership percentage.
 *
 * @example
 * ```ts
 * const founderShares: Share = {
 *   id: 'share_001',
 *   businessId: 'biz_acme',
 *   shareholderId: 'sh_001',
 *   shareClassId: 'sc_common',
 *   certificateNumber: 'CERT-001',
 *   quantity: 5000000,
 *   status: 'vested',
 *   acquisitionDate: new Date('2023-01-01'),
 *   acquisitionPrice: 0.0001,
 *   costBasis: 500,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Share {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** Shareholder ID */
  shareholderId: string

  /** Share class ID */
  shareClassId: string

  /** Stock certificate number */
  certificateNumber?: string

  /** Number of shares */
  quantity: number

  /** Current ownership percentage */
  ownershipPercentage?: number

  /** Share status */
  status: ShareStatus

  /** Acquisition date */
  acquisitionDate: Date

  /** Price paid per share */
  acquisitionPrice: number

  /** Total cost basis */
  costBasis: number

  /** Acquisition method */
  acquisitionMethod?:
    | 'founder_issuance'
    | 'option_exercise'
    | 'rsu_vesting'
    | 'purchase'
    | 'gift'
    | 'conversion'
    | 'stock_split'

  /** Vesting schedule ID (if applicable) */
  vestingScheduleId?: string

  /** Vested shares (if subject to vesting) */
  vestedShares?: number

  /** Unvested shares */
  unvestedShares?: number

  /** Next vesting date */
  nextVestingDate?: Date

  /** Subject to repurchase */
  subjectToRepurchase: boolean

  /** Repurchase price (if applicable) */
  repurchasePrice?: number

  /** Legend/restrictions */
  restrictions?: string[]

  /** 83(b) election filed */
  election83b?: {
    filed: boolean
    filedDate?: Date
    valuationAtGrant?: number
  }

  /** Related grant ID (if from option exercise) */
  grantId?: string

  /** Related funding round ID (if from investment) */
  fundingRoundId?: string

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ShareInput = Input<Share>
export type ShareOutput = Output<Share>

// =============================================================================
// VestingSchedule - Equity Vesting Terms
// =============================================================================

/**
 * Vesting type.
 */
export type VestingType = 'time_based' | 'milestone_based' | 'hybrid'

/**
 * Vesting frequency.
 */
export type VestingFrequency = 'monthly' | 'quarterly' | 'annually' | 'cliff_only'

/**
 * VestingSchedule defining how equity vests over time.
 *
 * Standard schedules include 4-year vesting with 1-year cliff,
 * but can be customized for different arrangements.
 *
 * @example
 * ```ts
 * const standardVesting: VestingSchedule = {
 *   id: 'vest_standard_4yr',
 *   name: '4-Year with 1-Year Cliff',
 *   type: 'time_based',
 *   vestingMonths: 48,
 *   cliffMonths: 12,
 *   frequency: 'monthly',
 *   accelerationOnExit: false,
 *   doubleAcceleration: false,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface VestingSchedule {
  /** Unique identifier */
  id: string

  /** Schedule name */
  name: string

  /** Vesting type */
  type: VestingType

  /** Total vesting period in months */
  vestingMonths: number

  /** Cliff period in months */
  cliffMonths: number

  /** Vesting frequency after cliff */
  frequency: VestingFrequency

  /** Percentage vested at cliff */
  cliffPercentage?: number

  /** Single-trigger acceleration on change of control */
  accelerationOnExit: boolean

  /** Single-trigger acceleration percentage */
  accelerationPercentage?: number

  /** Double-trigger acceleration (CIC + termination) */
  doubleAcceleration: boolean

  /** Double-trigger acceleration percentage */
  doubleAccelerationPercentage?: number

  /** Good leaver provisions */
  goodLeaverProvisions?: {
    vestingContinuation: boolean
    exercisePeriod?: number // months
  }

  /** Bad leaver provisions */
  badLeaverProvisions?: {
    forfeitUnvested: boolean
    repurchaseVested: boolean
    repurchasePrice?: 'cost_basis' | 'fair_market_value' | 'lower_of'
  }

  /** Milestones (for milestone-based vesting) */
  milestones?: Array<{
    name: string
    percentage: number
    criteria: string
    targetDate?: Date
    achievedDate?: Date
  }>

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type VestingScheduleInput = Input<VestingSchedule>
export type VestingScheduleOutput = Output<VestingSchedule>

// =============================================================================
// OptionGrant - Stock Option Grants
// =============================================================================

/**
 * Option grant type.
 */
export type OptionGrantType = 'iso' | 'nso' | 'rsu' | 'sar' | 'phantom'

/**
 * Option grant status.
 */
export type OptionGrantStatus =
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'partially_exercised'
  | 'fully_exercised'
  | 'expired'
  | 'cancelled'
  | 'forfeited'

/**
 * OptionGrant representing a stock option or equity grant to an employee.
 *
 * Tracks option grants including vesting, exercise prices,
 * and current exercise status.
 *
 * @example
 * ```ts
 * const optionGrant: OptionGrant = {
 *   id: 'grant_001',
 *   businessId: 'biz_acme',
 *   recipientId: 'emp_001',
 *   recipientType: 'employee',
 *   type: 'iso',
 *   status: 'active',
 *   shareClassId: 'sc_common',
 *   grantDate: new Date('2023-06-01'),
 *   numberOfShares: 50000,
 *   exercisePrice: 0.50,
 *   fairMarketValueAtGrant: 0.50,
 *   vestingScheduleId: 'vest_standard_4yr',
 *   vestingStartDate: new Date('2023-06-01'),
 *   expirationDate: new Date('2033-06-01'),
 *   vestedShares: 12500,
 *   exercisedShares: 0,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface OptionGrant {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** Recipient ID (employee, advisor, etc.) */
  recipientId: string

  /** Recipient type */
  recipientType: 'employee' | 'advisor' | 'consultant' | 'board_member'

  /** Grant type */
  type: OptionGrantType

  /** Grant status */
  status: OptionGrantStatus

  /** Share class ID */
  shareClassId: string

  /** Grant date */
  grantDate: Date

  /** Board approval date */
  boardApprovalDate?: Date

  /** Total shares granted */
  numberOfShares: number

  /** Exercise price per share */
  exercisePrice: number

  /** Fair market value at grant */
  fairMarketValueAtGrant: number

  /** 409A valuation ID */
  valuationId?: string

  /** Vesting schedule ID */
  vestingScheduleId: string

  /** Vesting start date */
  vestingStartDate: Date

  /** Cliff date */
  cliffDate?: Date

  /** Vesting end date */
  vestingEndDate?: Date

  /** Expiration date */
  expirationDate: Date

  /** Currently vested shares */
  vestedShares: number

  /** Unvested shares */
  unvestedShares: number

  /** Exercised shares */
  exercisedShares: number

  /** Shares remaining to exercise */
  exercisableShares: number

  /** Cancelled shares */
  cancelledShares: number

  /** Exercise history */
  exercises?: Array<{
    date: Date
    shares: number
    pricePerShare: number
    totalCost: number
    paymentMethod: 'cash' | 'cashless' | 'net_exercise'
  }>

  /** Early exercise allowed */
  earlyExerciseAllowed: boolean

  /** Post-termination exercise period (months) */
  postTerminationExercisePeriod: number

  /** Extended exercise upon termination */
  extendedExercise?: {
    eligible: boolean
    yearsOfService?: number
    extensionMonths?: number
  }

  /** Grant agreement document URL */
  grantAgreementUrl?: string

  /** Signed date */
  signedDate?: Date

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type OptionGrantInput = Input<OptionGrant>
export type OptionGrantOutput = Output<OptionGrant>

// =============================================================================
// FundingRound - Investment Rounds
// =============================================================================

/**
 * Funding round type.
 */
export type FundingRoundType =
  | 'pre_seed'
  | 'seed'
  | 'series_a'
  | 'series_b'
  | 'series_c'
  | 'series_d'
  | 'series_e'
  | 'bridge'
  | 'convertible_note'
  | 'safe'
  | 'debt'
  | 'grant'

/**
 * Funding round status.
 */
export type FundingRoundStatus =
  | 'planning'
  | 'fundraising'
  | 'term_sheet'
  | 'due_diligence'
  | 'closing'
  | 'closed'
  | 'cancelled'

/**
 * FundingRound representing an investment round.
 *
 * Tracks all details of a funding round including
 * valuations, investors, and terms.
 *
 * @example
 * ```ts
 * const seriesA: FundingRound = {
 *   id: 'round_series_a',
 *   businessId: 'biz_acme',
 *   name: 'Series A',
 *   type: 'series_a',
 *   status: 'closed',
 *   targetAmount: 10000000,
 *   raisedAmount: 12000000,
 *   preMoneyValuation: 40000000,
 *   postMoneyValuation: 52000000,
 *   pricePerShare: 1.50,
 *   shareClassId: 'sc_series_a',
 *   leadInvestorId: 'inv_001',
 *   openedDate: new Date('2024-01-01'),
 *   closedDate: new Date('2024-03-15'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface FundingRound {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** Round name */
  name: string

  /** Round type */
  type: FundingRoundType

  /** Round status */
  status: FundingRoundStatus

  /** Target raise amount */
  targetAmount: number

  /** Minimum raise amount */
  minimumAmount?: number

  /** Maximum raise amount */
  maximumAmount?: number

  /** Actually raised amount */
  raisedAmount: number

  /** Currency */
  currency: string

  /** Pre-money valuation */
  preMoneyValuation?: number

  /** Post-money valuation */
  postMoneyValuation?: number

  /** Price per share */
  pricePerShare?: number

  /** Share class created for this round */
  shareClassId?: string

  /** Lead investor ID */
  leadInvestorId?: string

  /** Co-lead investor IDs */
  coLeadInvestorIds?: string[]

  /** All participating investors */
  investments: Array<{
    investorId: string
    amount: number
    shares?: number
    isLead: boolean
    isProRata: boolean
    commitmentDate?: Date
    fundedDate?: Date
  }>

  /** Option pool expansion */
  optionPoolExpansion?: {
    preRoundPercentage: number
    postRoundPercentage: number
    newSharesCreated: number
  }

  /** Dilution impact */
  dilution?: {
    founderDilution: number
    employeeDilution: number
    existingInvestorDilution: number
  }

  /** Key terms */
  terms?: {
    liquidationPreference?: string
    antiDilution?: string
    boardSeats?: number
    protectiveProvisions?: string[]
    dragAlong?: boolean
    tagAlong?: boolean
    informationRights?: boolean
    proRataRights?: boolean
  }

  /** SAFE/Convertible specific terms */
  convertibleTerms?: {
    valuationCap?: number
    discountRate?: number
    interestRate?: number
    maturityDate?: Date
    conversionTrigger?: string
  }

  /** Round dates */
  openedDate?: Date
  termSheetDate?: Date
  closedDate?: Date

  /** Documents */
  documents?: Array<{
    type: 'term_sheet' | 'spa' | 'ira' | 'rofr' | 'voting_agreement' | 'other'
    name: string
    url: string
    uploadedAt: Date
  }>

  /** Milestones for this raise */
  milestones?: Array<{
    name: string
    targetDate: Date
    achieved: boolean
    achievedDate?: Date
  }>

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FundingRoundInput = Input<FundingRound>
export type FundingRoundOutput = Output<FundingRound>

// =============================================================================
// CapTable - Capitalization Table Snapshot
// =============================================================================

/**
 * CapTable representing ownership at a point in time.
 *
 * Provides a snapshot of all equity ownership, dilution,
 * and waterfall analysis for exit scenarios.
 *
 * @example
 * ```ts
 * const capTable: CapTable = {
 *   id: 'cap_2024_q1',
 *   businessId: 'biz_acme',
 *   asOfDate: new Date('2024-03-31'),
 *   version: 5,
 *   totalAuthorizedShares: 50000000,
 *   totalIssuedShares: 35000000,
 *   totalOutstandingShares: 30000000,
 *   fullyDilutedShares: 40000000,
 *   optionPoolRemaining: 5000000,
 *   optionPoolPercentage: 12.5,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface CapTable {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** As-of date for this snapshot */
  asOfDate: Date

  /** Version number */
  version: number

  /** Description of changes in this version */
  versionDescription?: string

  /** Related funding round (if version triggered by round) */
  fundingRoundId?: string

  /** Total authorized shares */
  totalAuthorizedShares: number

  /** Total issued shares */
  totalIssuedShares: number

  /** Total outstanding shares */
  totalOutstandingShares: number

  /** Fully diluted share count */
  fullyDilutedShares: number

  /** Option pool remaining shares */
  optionPoolRemaining: number

  /** Option pool percentage */
  optionPoolPercentage: number

  /** Ownership by share class */
  ownershipByClass: Array<{
    shareClassId: string
    shareClassName: string
    authorizedShares: number
    issuedShares: number
    outstandingShares: number
    ownershipPercentage: number
    fullyDilutedPercentage: number
  }>

  /** Ownership by shareholder type */
  ownershipByType: Array<{
    type: ShareholderType
    shares: number
    percentage: number
    fullyDilutedPercentage: number
  }>

  /** Top shareholders */
  topShareholders: Array<{
    shareholderId: string
    shareholderName: string
    type: ShareholderType
    shares: number
    percentage: number
    fullyDilutedPercentage: number
  }>

  /** Dilution since last round */
  dilutionSinceLastRound?: number

  /** Waterfall analysis */
  waterfallAnalysis?: Array<{
    exitValuation: number
    distributions: Array<{
      shareholderId: string
      shareholderName: string
      shareClassId: string
      proceeds: number
      multiple?: number
    }>
  }>

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CapTableInput = Input<CapTable>
export type CapTableOutput = Output<CapTable>

// =============================================================================
// StartupMetrics - Key Startup KPIs
// =============================================================================

/**
 * StartupMetrics tracking key business health indicators.
 *
 * Provides a comprehensive view of startup performance metrics
 * that investors and founders care about: burn, runway, unit economics.
 *
 * @example
 * ```ts
 * const metrics: StartupMetrics = {
 *   id: 'metrics_2024_03',
 *   businessId: 'biz_acme',
 *   periodStart: new Date('2024-03-01'),
 *   periodEnd: new Date('2024-03-31'),
 *   periodType: 'monthly',
 *   financial: {
 *     mrr: 150000,
 *     arr: 1800000,
 *     mrrGrowthRate: 15,
 *     monthlyBurnRate: 200000,
 *     runway: 18,
 *     cashPosition: 3600000,
 *     grossMargin: 75
 *   },
 *   customers: {
 *     totalCustomers: 250,
 *     newCustomers: 35,
 *     churnedCustomers: 8,
 *     monthlyChurnRate: 3.2,
 *     netRevenueRetention: 115
 *   },
 *   unitEconomics: {
 *     cac: 5000,
 *     ltv: 25000,
 *     ltvToCacRatio: 5,
 *     paybackPeriodMonths: 8
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface StartupMetrics {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** Period start date */
  periodStart: Date

  /** Period end date */
  periodEnd: Date

  /** Period type */
  periodType: 'weekly' | 'monthly' | 'quarterly' | 'annual'

  /** Financial metrics */
  financial: {
    /** Monthly Recurring Revenue */
    mrr: number
    /** Annual Recurring Revenue */
    arr: number
    /** MRR growth rate (percentage) */
    mrrGrowthRate: number
    /** Monthly burn rate */
    monthlyBurnRate: number
    /** Runway in months */
    runway: number
    /** Current cash position */
    cashPosition: number
    /** Gross margin percentage */
    grossMargin: number
    /** Net margin percentage */
    netMargin?: number
    /** Total revenue (including non-recurring) */
    totalRevenue?: number
    /** Gross profit */
    grossProfit?: number
    /** Operating expenses */
    operatingExpenses?: number
    /** EBITDA */
    ebitda?: number
  }

  /** Customer metrics */
  customers: {
    /** Total active customers */
    totalCustomers: number
    /** New customers this period */
    newCustomers: number
    /** Churned customers this period */
    churnedCustomers: number
    /** Monthly churn rate (percentage) */
    monthlyChurnRate: number
    /** Annual churn rate (percentage) */
    annualChurnRate?: number
    /** Net Revenue Retention (percentage) */
    netRevenueRetention: number
    /** Gross Revenue Retention (percentage) */
    grossRevenueRetention?: number
    /** Logo retention rate */
    logoRetentionRate?: number
    /** Average contract value */
    averageContractValue?: number
    /** Average revenue per user/account */
    arpu?: number
  }

  /** Unit economics */
  unitEconomics: {
    /** Customer Acquisition Cost */
    cac: number
    /** Lifetime Value */
    ltv: number
    /** LTV to CAC ratio */
    ltvToCacRatio: number
    /** CAC payback period in months */
    paybackPeriodMonths: number
    /** Blended CAC (including all marketing spend) */
    blendedCac?: number
    /** Organic CAC */
    organicCac?: number
    /** Paid CAC */
    paidCac?: number
  }

  /** Growth metrics */
  growth?: {
    /** Year-over-year growth */
    yoyGrowth: number
    /** Month-over-month growth */
    momGrowth: number
    /** Quarter-over-quarter growth */
    qoqGrowth?: number
    /** Customer growth rate */
    customerGrowthRate: number
    /** Revenue per employee */
    revenuePerEmployee?: number
    /** Burn multiple (net burn / net new ARR) */
    burnMultiple?: number
    /** Magic number (net new ARR / S&M spend) */
    magicNumber?: number
    /** Rule of 40 score (growth rate + profit margin) */
    ruleOf40?: number
  }

  /** Sales efficiency */
  salesEfficiency?: {
    /** Sales cycle length (days) */
    salesCycleLength: number
    /** Win rate */
    winRate: number
    /** Average deal size */
    averageDealSize: number
    /** Pipeline coverage */
    pipelineCoverage?: number
    /** Quota attainment */
    quotaAttainment?: number
  }

  /** Product metrics */
  product?: {
    /** Daily active users */
    dau?: number
    /** Monthly active users */
    mau?: number
    /** DAU/MAU ratio */
    dauMauRatio?: number
    /** Activation rate */
    activationRate?: number
    /** Feature adoption rate */
    featureAdoptionRate?: number
    /** NPS score */
    nps?: number
    /** Time to value (days) */
    timeToValue?: number
  }

  /** Health flags */
  healthFlags: {
    /** Is runway concerning (<6 months) */
    runwayAtRisk: boolean
    /** Churn trend */
    churnTrend: 'improving' | 'stable' | 'declining'
    /** Unit economics health */
    unitEconomicsPositive: boolean
    /** Growth trajectory */
    growthTrajectory: 'accelerating' | 'stable' | 'decelerating'
    /** Cash efficiency */
    cashEfficient: boolean
  }

  /** Comparisons/benchmarks */
  benchmarks?: {
    /** Industry benchmark comparisons */
    industry?: Record<string, { metric: string; value: number; percentile: number }>
    /** Period-over-period comparisons */
    periodComparison?: Record<string, { current: number; previous: number; change: number }>
  }

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type StartupMetricsInput = Input<StartupMetrics>
export type StartupMetricsOutput = Output<StartupMetrics>

// =============================================================================
// Valuation409A - Fair Market Value Determination
// =============================================================================

/**
 * Valuation method.
 */
export type ValuationMethod =
  | 'market_approach'
  | 'income_approach'
  | 'asset_approach'
  | 'option_pricing'
  | 'backsolve'

/**
 * Valuation409A representing an independent valuation for stock options.
 *
 * Required for setting exercise prices on ISO/NSO grants
 * to comply with IRC Section 409A.
 *
 * @example
 * ```ts
 * const valuation: Valuation409A = {
 *   id: 'val_2024_q1',
 *   businessId: 'biz_acme',
 *   valuationDate: new Date('2024-03-15'),
 *   effectiveDate: new Date('2024-03-15'),
 *   expirationDate: new Date('2024-06-15'),
 *   fairMarketValue: 1.25,
 *   enterpriseValue: 50000000,
 *   method: 'backsolve',
 *   provider: 'Carta',
 *   status: 'approved',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Valuation409A {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** Valuation date */
  valuationDate: Date

  /** Effective date (when FMV becomes valid) */
  effectiveDate: Date

  /** Expiration date (typically 12 months) */
  expirationDate: Date

  /** Fair market value per common share */
  fairMarketValue: number

  /** Enterprise value */
  enterpriseValue: number

  /** Equity value */
  equityValue: number

  /** Valuation method used */
  method: ValuationMethod

  /** Methods used if multiple */
  methods?: Array<{
    method: ValuationMethod
    weight: number
    value: number
  }>

  /** Valuation provider */
  provider: string

  /** Provider report URL */
  reportUrl?: string

  /** Status */
  status: 'draft' | 'pending_review' | 'approved' | 'superseded'

  /** Board approval date */
  boardApprovalDate?: Date

  /** Key assumptions */
  assumptions?: {
    discountForLackOfMarketability?: number
    timeToLiquidity?: number
    volatility?: number
    riskFreeRate?: number
  }

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** External system IDs */
  externalIds?: Record<string, string>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type Valuation409AInput = Input<Valuation409A>
export type Valuation409AOutput = Output<Valuation409A>

// =============================================================================
// Actions
// =============================================================================

/**
 * Investor actions.
 */
export interface InvestorActions extends CRUDResource<Investor, InvestorInput> {
  /** Record an interaction with the investor */
  logInteraction: Action<
    { id: string; type: string; notes: string; date: Date },
    Investor
  >
  /** Update relationship status */
  updateRelationship: Action<
    { id: string; relationship: InvestorRelationship },
    Investor
  >
  /** Find investors by stage/focus */
  search: Action<
    { stages?: InvestorStage[]; focus?: string[]; type?: InvestorType },
    PaginatedResult<Investor>
  >
}

/**
 * Shareholder actions.
 */
export interface ShareholderActions extends CRUDResource<Shareholder, ShareholderInput> {
  /** Get all shareholders for a business */
  listByBusiness: Action<{ businessId: string } & ListParams, PaginatedResult<Shareholder>>
  /** Get ownership summary */
  getOwnership: Action<{ id: string }, { shares: Share[]; totalOwnership: number }>
}

/**
 * ShareClass actions.
 */
export interface ShareClassActions extends CRUDResource<ShareClass, ShareClassInput> {
  /** Get all share classes for a business */
  listByBusiness: Action<{ businessId: string } & ListParams, PaginatedResult<ShareClass>>
  /** Issue new shares */
  issueShares: Action<{ id: string; quantity: number }, ShareClass>
  /** Cancel shares */
  cancelShares: Action<{ id: string; quantity: number }, ShareClass>
}

/**
 * Share actions.
 */
export interface ShareActions extends CRUDResource<Share, ShareInput> {
  /** Get shares by shareholder */
  listByShareholder: Action<{ shareholderId: string } & ListParams, PaginatedResult<Share>>
  /** Transfer shares between shareholders */
  transfer: Action<
    { shareId: string; toShareholderId: string; quantity: number; price?: number },
    { from: Share; to: Share }
  >
  /** Calculate vested shares as of date */
  calculateVested: Action<{ id: string; asOfDate: Date }, { vested: number; unvested: number }>
}

/**
 * VestingSchedule actions.
 */
export interface VestingScheduleActions extends CRUDResource<VestingSchedule, VestingScheduleInput> {
  /** Calculate vesting at a point in time */
  calculateVesting: Action<
    { id: string; startDate: Date; shares: number; asOfDate: Date },
    { vestedShares: number; unvestedShares: number; nextVestingDate?: Date }
  >
}

/**
 * OptionGrant actions.
 */
export interface OptionGrantActions extends CRUDResource<OptionGrant, OptionGrantInput> {
  /** List grants by recipient */
  listByRecipient: Action<{ recipientId: string } & ListParams, PaginatedResult<OptionGrant>>
  /** Exercise options */
  exercise: Action<
    { id: string; shares: number; paymentMethod: 'cash' | 'cashless' | 'net_exercise' },
    { grant: OptionGrant; share: Share }
  >
  /** Cancel grant */
  cancel: Action<{ id: string; reason: string }, OptionGrant>
  /** Approve grant */
  approve: Action<{ id: string; boardApprovalDate: Date }, OptionGrant>
  /** Calculate current value */
  calculateValue: Action<
    { id: string; currentFmv: number },
    { intrinsicValue: number; vestedValue: number; unvestedValue: number }
  >
}

/**
 * FundingRound actions.
 */
export interface FundingRoundActions extends CRUDResource<FundingRound, FundingRoundInput> {
  /** List rounds by business */
  listByBusiness: Action<{ businessId: string } & ListParams, PaginatedResult<FundingRound>>
  /** Add investor to round */
  addInvestor: Action<
    { id: string; investorId: string; amount: number; isLead?: boolean },
    FundingRound
  >
  /** Close round */
  close: Action<{ id: string; closedDate: Date }, FundingRound>
  /** Calculate dilution */
  calculateDilution: Action<{ id: string }, FundingRound['dilution']>
}

/**
 * CapTable actions.
 */
export interface CapTableActions extends CRUDResource<CapTable, CapTableInput> {
  /** Get latest cap table for a business */
  getLatest: Action<{ businessId: string }, CapTable>
  /** Create new snapshot */
  createSnapshot: Action<
    { businessId: string; description?: string; fundingRoundId?: string },
    CapTable
  >
  /** Calculate waterfall at exit valuation */
  calculateWaterfall: Action<
    { id: string; exitValuation: number },
    CapTable['waterfallAnalysis']
  >
  /** Get ownership for a shareholder */
  getOwnership: Action<
    { id: string; shareholderId: string },
    { shares: number; percentage: number; fullyDilutedPercentage: number }
  >
  /** Model dilution from new round */
  modelDilution: Action<
    { id: string; newRoundAmount: number; preMoneyValuation: number; optionPoolIncrease?: number },
    {
      preRound: CapTable
      postRound: CapTable
      dilution: Record<string, number>
    }
  >
}

/**
 * StartupMetrics actions.
 */
export interface StartupMetricsActions extends CRUDResource<StartupMetrics, StartupMetricsInput> {
  /** Get latest metrics for a business */
  getLatest: Action<{ businessId: string }, StartupMetrics>
  /** Get metrics for a period */
  getByPeriod: Action<
    { businessId: string; periodStart: Date; periodEnd: Date },
    StartupMetrics[]
  >
  /** Calculate runway */
  calculateRunway: Action<
    { businessId: string; burnRate: number; cashPosition: number },
    { runway: number; runwayEndDate: Date }
  >
  /** Calculate unit economics */
  calculateUnitEconomics: Action<
    { businessId: string; cac: number; ltv: number },
    StartupMetrics['unitEconomics']
  >
  /** Compare to benchmarks */
  compareToBenchmarks: Action<
    { id: string; industry?: string },
    StartupMetrics['benchmarks']
  >
}

/**
 * Valuation409A actions.
 */
export interface Valuation409AActions extends CRUDResource<Valuation409A, Valuation409AInput> {
  /** Get active valuation */
  getActive: Action<{ businessId: string }, Valuation409A>
  /** Approve valuation */
  approve: Action<{ id: string; boardApprovalDate: Date }, Valuation409A>
  /** Check if new valuation needed */
  checkExpiration: Action<{ businessId: string }, { needsNew: boolean; expiresIn?: number }>
}

// =============================================================================
// Events
// =============================================================================

export interface InvestorEvents {
  created: BaseEvent<'investor.created', Investor>
  updated: BaseEvent<'investor.updated', { before: Investor; after: Investor }>
  deleted: BaseEvent<'investor.deleted', { id: string }>
  relationship_changed: BaseEvent<
    'investor.relationship_changed',
    { investor: Investor; from: InvestorRelationship; to: InvestorRelationship }
  >
}

export interface ShareholderEvents {
  created: BaseEvent<'shareholder.created', Shareholder>
  updated: BaseEvent<'shareholder.updated', { before: Shareholder; after: Shareholder }>
  departed: BaseEvent<'shareholder.departed', Shareholder>
}

export interface ShareClassEvents {
  created: BaseEvent<'share_class.created', ShareClass>
  updated: BaseEvent<'share_class.updated', { before: ShareClass; after: ShareClass }>
  shares_issued: BaseEvent<'share_class.shares_issued', { shareClass: ShareClass; quantity: number }>
}

export interface ShareEvents {
  issued: BaseEvent<'share.issued', Share>
  transferred: BaseEvent<'share.transferred', { from: Share; to: Share; quantity: number }>
  vested: BaseEvent<'share.vested', { share: Share; vestedShares: number }>
  cancelled: BaseEvent<'share.cancelled', Share>
}

export interface OptionGrantEvents {
  created: BaseEvent<'option_grant.created', OptionGrant>
  approved: BaseEvent<'option_grant.approved', OptionGrant>
  vested: BaseEvent<'option_grant.vested', { grant: OptionGrant; vestedShares: number }>
  exercised: BaseEvent<'option_grant.exercised', { grant: OptionGrant; exercisedShares: number }>
  cancelled: BaseEvent<'option_grant.cancelled', OptionGrant>
  expiring: BaseEvent<'option_grant.expiring', { grant: OptionGrant; daysUntilExpiration: number }>
}

export interface FundingRoundEvents {
  created: BaseEvent<'funding_round.created', FundingRound>
  opened: BaseEvent<'funding_round.opened', FundingRound>
  term_sheet_signed: BaseEvent<'funding_round.term_sheet_signed', FundingRound>
  investor_added: BaseEvent<'funding_round.investor_added', { round: FundingRound; investorId: string; amount: number }>
  closed: BaseEvent<'funding_round.closed', FundingRound>
  cancelled: BaseEvent<'funding_round.cancelled', FundingRound>
}

export interface CapTableEvents {
  snapshot_created: BaseEvent<'cap_table.snapshot_created', CapTable>
  updated: BaseEvent<'cap_table.updated', { before: CapTable; after: CapTable }>
}

export interface StartupMetricsEvents {
  recorded: BaseEvent<'startup_metrics.recorded', StartupMetrics>
  runway_alert: BaseEvent<'startup_metrics.runway_alert', { metrics: StartupMetrics; runway: number }>
  churn_alert: BaseEvent<'startup_metrics.churn_alert', { metrics: StartupMetrics; churnRate: number }>
}

export interface Valuation409AEvents {
  created: BaseEvent<'valuation_409a.created', Valuation409A>
  approved: BaseEvent<'valuation_409a.approved', Valuation409A>
  expiring: BaseEvent<'valuation_409a.expiring', { valuation: Valuation409A; daysUntilExpiration: number }>
}

// =============================================================================
// Resource
// =============================================================================

/**
 * Investor resource.
 */
export interface InvestorResource extends InvestorActions {
  on: <E extends keyof InvestorEvents>(
    event: E,
    handler: EventHandler<InvestorEvents[E]>
  ) => () => void
}

/**
 * Shareholder resource.
 */
export interface ShareholderResource extends ShareholderActions {
  on: <E extends keyof ShareholderEvents>(
    event: E,
    handler: EventHandler<ShareholderEvents[E]>
  ) => () => void
}

/**
 * ShareClass resource.
 */
export interface ShareClassResource extends ShareClassActions {
  on: <E extends keyof ShareClassEvents>(
    event: E,
    handler: EventHandler<ShareClassEvents[E]>
  ) => () => void
}

/**
 * Share resource.
 */
export interface ShareResource extends ShareActions {
  on: <E extends keyof ShareEvents>(
    event: E,
    handler: EventHandler<ShareEvents[E]>
  ) => () => void
}

/**
 * VestingSchedule resource.
 */
export interface VestingScheduleResource extends VestingScheduleActions {}

/**
 * OptionGrant resource.
 */
export interface OptionGrantResource extends OptionGrantActions {
  on: <E extends keyof OptionGrantEvents>(
    event: E,
    handler: EventHandler<OptionGrantEvents[E]>
  ) => () => void
}

/**
 * FundingRound resource.
 */
export interface FundingRoundResource extends FundingRoundActions {
  on: <E extends keyof FundingRoundEvents>(
    event: E,
    handler: EventHandler<FundingRoundEvents[E]>
  ) => () => void
}

/**
 * CapTable resource.
 */
export interface CapTableResource extends CapTableActions {
  on: <E extends keyof CapTableEvents>(
    event: E,
    handler: EventHandler<CapTableEvents[E]>
  ) => () => void
}

/**
 * StartupMetrics resource.
 */
export interface StartupMetricsResource extends StartupMetricsActions {
  on: <E extends keyof StartupMetricsEvents>(
    event: E,
    handler: EventHandler<StartupMetricsEvents[E]>
  ) => () => void
}

/**
 * Valuation409A resource.
 */
export interface Valuation409AResource extends Valuation409AActions {
  on: <E extends keyof Valuation409AEvents>(
    event: E,
    handler: EventHandler<Valuation409AEvents[E]>
  ) => () => void
}

// =============================================================================
// Proxy
// =============================================================================

/**
 * Equity module proxy for RPC access.
 */
export interface EquityProxy {
  investors: InvestorResource
  shareholders: ShareholderResource
  shareClasses: ShareClassResource
  shares: ShareResource
  vestingSchedules: VestingScheduleResource
  optionGrants: OptionGrantResource
  fundingRounds: FundingRoundResource
  capTables: CapTableResource
  startupMetrics: StartupMetricsResource
  valuations409A: Valuation409AResource
}
