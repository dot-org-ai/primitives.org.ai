/**
 * Governance & Corporate Structure Types
 *
 * Comprehensive types for corporate governance:
 * - Board of directors and meetings
 * - Advisors and advisory relationships
 * - Founders and founding team
 * - Organizational levels and career progression
 * - Roles and responsibilities
 *
 * @module governance
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
// Board - Board of Directors
// =============================================================================

/**
 * Board status.
 */
export type BoardStatus = 'active' | 'dissolved' | 'transitioning'

/**
 * Board representing the board of directors.
 *
 * Tracks board composition, meetings, and governance.
 *
 * @example
 * ```ts
 * const board: Board = {
 *   id: 'board_001',
 *   businessId: 'biz_acme',
 *   name: 'Board of Directors',
 *   status: 'active',
 *   size: 5,
 *   meetingFrequency: 'quarterly',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Board {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** Board name */
  name: string

  /** Current status */
  status: BoardStatus

  /** Target board size */
  size: number

  /** Current member count */
  memberCount?: number

  /** Meeting frequency */
  meetingFrequency: 'monthly' | 'bi_monthly' | 'quarterly' | 'semi_annually' | 'annually'

  /** Next scheduled meeting */
  nextMeetingDate?: Date

  /** Last meeting date */
  lastMeetingDate?: Date

  /** Board committees */
  committees?: Array<{
    id?: string
    name: string
    type: 'audit' | 'compensation' | 'nominating' | 'governance' | 'executive' | 'other'
    chair?: string
    members: string[]
  }>

  /** Governance documents */
  documents?: Array<{
    type: 'charter' | 'bylaws' | 'code_of_conduct' | 'committee_charter' | 'other'
    name: string
    url: string
    version: string
    adoptedDate?: Date
  }>

  /** D&O Insurance */
  insurance?: {
    carrier: string
    policyNumber: string
    coverage: number
    expiresAt: Date
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

export type BoardInput = Input<Board>
export type BoardOutput = Output<Board>

// =============================================================================
// BoardMember - Director
// =============================================================================

/**
 * Board member role.
 */
export type BoardMemberRole =
  | 'chair'
  | 'vice_chair'
  | 'director'
  | 'independent_director'
  | 'observer'
  | 'secretary'

/**
 * Board member status.
 */
export type BoardMemberStatus = 'active' | 'inactive' | 'resigned' | 'removed'

/**
 * BoardMember representing a board director.
 *
 * Tracks individual board members and their roles.
 *
 * @example
 * ```ts
 * const director: BoardMember = {
 *   id: 'bm_001',
 *   boardId: 'board_001',
 *   personId: 'person_001',
 *   name: 'Jane Smith',
 *   role: 'independent_director',
 *   status: 'active',
 *   appointedDate: new Date('2023-01-15'),
 *   committees: ['audit', 'compensation'],
 *   isIndependent: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface BoardMember {
  /** Unique identifier */
  id: string

  /** Board ID */
  boardId: string

  /** Person/Human ID */
  personId: string

  /** Full name */
  name: string

  /** Email */
  email?: string

  /** Phone */
  phone?: string

  /** Role on board */
  role: BoardMemberRole

  /** Current status */
  status: BoardMemberStatus

  /** Appointed date */
  appointedDate: Date

  /** Term end date */
  termEndDate?: Date

  /** Resigned/removed date */
  departedDate?: Date

  /** Departure reason */
  departureReason?: string

  /** Is independent director */
  isIndependent: boolean

  /** Committees served on */
  committees?: string[]

  /** Representing share class */
  representingShareClass?: string

  /** Representing investor */
  representingInvestor?: string

  /** Compensation */
  compensation?: {
    cashRetainer?: number
    equityGrant?: number
    meetingFee?: number
    committeeChairFee?: number
  }

  /** Background/bio */
  bio?: string

  /** Expertise areas */
  expertise?: string[]

  /** Other board seats */
  otherBoardSeats?: Array<{
    company: string
    role: string
    since?: Date
  }>

  /** Voting rights */
  votingRights: boolean

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BoardMemberInput = Input<BoardMember>
export type BoardMemberOutput = Output<BoardMember>

// =============================================================================
// BoardMeeting - Board Meeting
// =============================================================================

/**
 * Meeting type.
 */
export type BoardMeetingType = 'regular' | 'special' | 'annual' | 'emergency' | 'committee'

/**
 * Meeting status.
 */
export type BoardMeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'postponed'

/**
 * BoardMeeting representing a board meeting.
 *
 * Tracks board meeting agendas, attendance, and minutes.
 *
 * @example
 * ```ts
 * const meeting: BoardMeeting = {
 *   id: 'mtg_001',
 *   boardId: 'board_001',
 *   title: 'Q1 2024 Board Meeting',
 *   type: 'regular',
 *   status: 'completed',
 *   scheduledDate: new Date('2024-03-15T10:00:00Z'),
 *   duration: 120,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface BoardMeeting {
  /** Unique identifier */
  id: string

  /** Board ID */
  boardId: string

  /** Meeting title */
  title: string

  /** Meeting type */
  type: BoardMeetingType

  /** Current status */
  status: BoardMeetingStatus

  /** Committee (if committee meeting) */
  committee?: string

  /** Scheduled date/time */
  scheduledDate: Date

  /** Actual start time */
  startedAt?: Date

  /** Actual end time */
  endedAt?: Date

  /** Duration in minutes */
  duration?: number

  /** Location */
  location?: {
    type: 'in_person' | 'virtual' | 'hybrid'
    address?: string
    videoLink?: string
    dialIn?: string
  }

  /** Agenda items */
  agenda?: Array<{
    id?: string
    title: string
    description?: string
    presenter?: string
    duration?: number
    documents?: string[]
    requiresVote?: boolean
  }>

  /** Attendees */
  attendees?: Array<{
    memberId: string
    name: string
    status: 'attending' | 'absent' | 'proxy'
    proxy?: string
    arrivalTime?: Date
    departureTime?: Date
  }>

  /** Quorum requirements */
  quorum?: {
    required: number
    present: number
    achieved: boolean
  }

  /** Resolutions/votes */
  resolutions?: Array<{
    id: string
    title: string
    description?: string
    status: 'proposed' | 'approved' | 'rejected' | 'tabled'
    votesFor: number
    votesAgainst: number
    abstentions: number
    passedAt?: Date
  }>

  /** Minutes document */
  minutesUrl?: string

  /** Minutes status */
  minutesStatus?: 'draft' | 'pending_approval' | 'approved'

  /** Minutes approved date */
  minutesApprovedAt?: Date

  /** Recording URL */
  recordingUrl?: string

  /** Materials/documents */
  materials?: Array<{
    name: string
    url: string
    type: string
  }>

  /** Action items */
  actionItems?: Array<{
    id: string
    description: string
    assignee?: string
    dueDate?: Date
    status: 'open' | 'in_progress' | 'completed'
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

export type BoardMeetingInput = Input<BoardMeeting>
export type BoardMeetingOutput = Output<BoardMeeting>

// =============================================================================
// Advisor - Company Advisor
// =============================================================================

/**
 * Advisor type.
 */
export type AdvisorType =
  | 'strategic'
  | 'technical'
  | 'sales'
  | 'marketing'
  | 'product'
  | 'finance'
  | 'legal'
  | 'industry'
  | 'investor'
  | 'other'

/**
 * Advisor status.
 */
export type AdvisorStatus = 'active' | 'inactive' | 'completed'

/**
 * Advisor representing a company advisor.
 *
 * Tracks advisory relationships and engagements.
 *
 * @example
 * ```ts
 * const advisor: Advisor = {
 *   id: 'adv_001',
 *   businessId: 'biz_acme',
 *   personId: 'person_001',
 *   name: 'John Doe',
 *   type: 'strategic',
 *   status: 'active',
 *   expertise: ['go-to-market', 'enterprise sales', 'SaaS'],
 *   engagementLevel: 'monthly',
 *   startDate: new Date('2023-06-01'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Advisor {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** Person/Human ID */
  personId?: string

  /** Full name */
  name: string

  /** Email */
  email?: string

  /** Phone */
  phone?: string

  /** LinkedIn */
  linkedIn?: string

  /** Advisor type */
  type: AdvisorType

  /** Current status */
  status: AdvisorStatus

  /** Title/role */
  title?: string

  /** Company (current affiliation) */
  company?: string

  /** Expertise areas */
  expertise: string[]

  /** Engagement level */
  engagementLevel: 'weekly' | 'bi_weekly' | 'monthly' | 'quarterly' | 'ad_hoc'

  /** Start date */
  startDate: Date

  /** End date (if completed) */
  endDate?: Date

  /** Agreement type */
  agreementType?: 'informal' | 'formal' | 'equity' | 'paid'

  /** Equity compensation */
  equity?: {
    grantId?: string
    shares?: number
    percentage?: number
    vestingScheduleId?: string
    vestingStartDate?: Date
  }

  /** Cash compensation */
  cashCompensation?: {
    amount: number
    frequency: 'hourly' | 'monthly' | 'per_engagement' | 'retainer'
    currency: string
  }

  /** Introductions made */
  introductionsMade?: Array<{
    type: 'investor' | 'customer' | 'partner' | 'hire' | 'other'
    name: string
    date: Date
    outcome?: string
  }>

  /** Engagement log */
  engagements?: Array<{
    date: Date
    type: 'meeting' | 'call' | 'email' | 'introduction' | 'review'
    topic: string
    notes?: string
    duration?: number
  }>

  /** Last engagement */
  lastEngagementDate?: Date

  /** Portfolio (other companies advised) */
  portfolio?: Array<{
    company: string
    role?: string
    since?: Date
  }>

  /** Bio */
  bio?: string

  /** NDA signed */
  ndaSigned?: boolean

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

export type AdvisorInput = Input<Advisor>
export type AdvisorOutput = Output<Advisor>

// =============================================================================
// Founder - Founding Team Member
// =============================================================================

/**
 * Founder role.
 */
export type FounderRole =
  | 'ceo'
  | 'cto'
  | 'coo'
  | 'cfo'
  | 'cpo'
  | 'cmo'
  | 'president'
  | 'technical'
  | 'business'
  | 'other'

/**
 * Founder status.
 */
export type FounderStatus = 'active' | 'departed' | 'transitioned'

/**
 * Founder representing a founding team member.
 *
 * Tracks founders, their roles, and contributions.
 *
 * @example
 * ```ts
 * const founder: Founder = {
 *   id: 'founder_001',
 *   businessId: 'biz_acme',
 *   personId: 'person_001',
 *   name: 'Alice Smith',
 *   role: 'ceo',
 *   status: 'active',
 *   foundingOrder: 1,
 *   foundingDate: new Date('2023-01-01'),
 *   fullTimeCommitment: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Founder {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** Person/Human ID */
  personId: string

  /** Full name */
  name: string

  /** Email */
  email?: string

  /** Phone */
  phone?: string

  /** LinkedIn */
  linkedIn?: string

  /** Current role */
  role: FounderRole

  /** Current title */
  title?: string

  /** Current status */
  status: FounderStatus

  /** Founding order (1 = first founder) */
  foundingOrder: number

  /** Founding date */
  foundingDate: Date

  /** Departure date (if departed) */
  departedDate?: Date

  /** Departure reason */
  departureReason?: string

  /** Full-time commitment */
  fullTimeCommitment: boolean

  /** Co-founders */
  coFounders?: string[]

  /** Equity */
  equity?: {
    shareholderId?: string
    shares?: number
    percentage?: number
    vestingScheduleId?: string
    vestingStartDate?: Date
    vestedPercentage?: number
  }

  /** Background */
  background?: {
    education?: Array<{
      institution: string
      degree?: string
      field?: string
      year?: number
    }>
    previousCompanies?: Array<{
      company: string
      role: string
      years?: string
    }>
    previousExits?: Array<{
      company: string
      role: string
      outcome: string
      year?: number
    }>
  }

  /** Areas of responsibility */
  responsibilities?: string[]

  /** Skills/expertise */
  expertise?: string[]

  /** Personal website */
  website?: string

  /** Twitter/X */
  twitter?: string

  /** Bio */
  bio?: string

  /** Headshot URL */
  headshotUrl?: string

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FounderInput = Input<Founder>
export type FounderOutput = Output<Founder>

// =============================================================================
// Level - Career Level
// =============================================================================

/**
 * Level track.
 */
export type LevelTrack = 'individual_contributor' | 'management' | 'executive' | 'specialist'

/**
 * Level representing a career level in the organization.
 *
 * Defines career progression and compensation bands.
 *
 * @example
 * ```ts
 * const level: Level = {
 *   id: 'level_senior_eng',
 *   businessId: 'biz_acme',
 *   name: 'Senior Engineer',
 *   code: 'L4',
 *   track: 'individual_contributor',
 *   rank: 4,
 *   compensation: {
 *     min: 150000,
 *     mid: 180000,
 *     max: 210000,
 *     currency: 'USD'
 *   },
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Level {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** Level name */
  name: string

  /** Level code (e.g., L1, L2, IC3, M1) */
  code: string

  /** Career track */
  track: LevelTrack

  /** Numeric rank (for ordering) */
  rank: number

  /** Department (if department-specific) */
  department?: string

  /** Function (e.g., Engineering, Sales, Marketing) */
  function?: string

  /** Description */
  description?: string

  /** Years of experience typically required */
  yearsExperience?: {
    min: number
    max?: number
  }

  /** Compensation band */
  compensation?: {
    min: number
    mid: number
    max: number
    currency: string
  }

  /** Equity band (shares or percentage) */
  equity?: {
    min: number
    max: number
    type: 'shares' | 'percentage'
  }

  /** Key responsibilities at this level */
  responsibilities?: string[]

  /** Required competencies */
  competencies?: Array<{
    name: string
    proficiencyLevel: 'basic' | 'intermediate' | 'advanced' | 'expert'
  }>

  /** Promotion criteria to next level */
  promotionCriteria?: string[]

  /** Next level ID */
  nextLevelId?: string

  /** Previous level ID */
  previousLevelId?: string

  /** Management scope */
  managementScope?: {
    directReports?: { min: number; max: number }
    teamSize?: { min: number; max: number }
    budgetAuthority?: number
  }

  /** Decision-making authority */
  decisionAuthority?: string[]

  /** Notes */
  notes?: string

  /** Custom metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type LevelInput = Input<Level>
export type LevelOutput = Output<Level>

// =============================================================================
// Role - Job Role Definition
// =============================================================================

/**
 * Role status.
 */
export type RoleStatus = 'active' | 'deprecated' | 'draft'

/**
 * Role representing a job role in the organization.
 *
 * Defines job roles independently from specific positions.
 *
 * @example
 * ```ts
 * const role: Role = {
 *   id: 'role_swe',
 *   businessId: 'biz_acme',
 *   title: 'Software Engineer',
 *   code: 'SWE',
 *   department: 'Engineering',
 *   status: 'active',
 *   levels: ['L2', 'L3', 'L4', 'L5'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Role {
  /** Unique identifier */
  id: string

  /** Business/company ID */
  businessId: string

  /** Role title */
  title: string

  /** Role code */
  code?: string

  /** Department */
  department: string

  /** Function */
  function?: string

  /** Current status */
  status: RoleStatus

  /** Description */
  description?: string

  /** Job family (e.g., Software Engineering) */
  jobFamily?: string

  /** Applicable levels */
  levels?: string[]

  /** Reports to (role ID) */
  reportsTo?: string

  /** Direct reports (role IDs) */
  directReports?: string[]

  /** Key responsibilities */
  responsibilities?: string[]

  /** Required qualifications */
  qualifications?: {
    required?: string[]
    preferred?: string[]
  }

  /** Required skills */
  skills?: Array<{
    name: string
    level: 'basic' | 'intermediate' | 'advanced' | 'expert'
    required: boolean
  }>

  /** Required certifications */
  certifications?: Array<{
    name: string
    required: boolean
  }>

  /** Work location options */
  workLocation?: 'office' | 'remote' | 'hybrid'

  /** Travel requirements */
  travelRequired?: string

  /** Job description document */
  jobDescriptionUrl?: string

  /** Interview process */
  interviewProcess?: Array<{
    stage: string
    type: 'screening' | 'technical' | 'behavioral' | 'culture' | 'executive'
    interviewers?: string[]
    duration?: number
  }>

  /** Headcount in this role */
  currentHeadcount?: number

  /** Approved headcount */
  approvedHeadcount?: number

  /** Tags */
  tags?: string[]

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

export type RoleInput = Input<Role>
export type RoleOutput = Output<Role>

// =============================================================================
// Actions
// =============================================================================

export interface BoardActions extends CRUDResource<Board, BoardInput> {
  /** Get board by business */
  getByBusiness: Action<{ businessId: string }, Board | null>
  /** Add committee */
  addCommittee: Action<
    { id: string; committee: NonNullable<Board['committees']>[0] },
    Board
  >
  /** Remove committee */
  removeCommittee: Action<{ id: string; committeeId: string }, Board>
  /** Get members */
  getMembers: Action<{ id: string } & ListParams, PaginatedResult<BoardMember>>
  /** Get meetings */
  getMeetings: Action<{ id: string } & ListParams, PaginatedResult<BoardMeeting>>
}

export interface BoardMemberActions extends CRUDResource<BoardMember, BoardMemberInput> {
  /** List by board */
  listByBoard: Action<{ boardId: string } & ListParams, PaginatedResult<BoardMember>>
  /** Appoint member */
  appoint: Action<BoardMemberInput, BoardMember>
  /** Remove member */
  remove: Action<{ id: string; reason?: string }, BoardMember>
  /** Resign */
  resign: Action<{ id: string; reason?: string; effectiveDate?: Date }, BoardMember>
  /** Update role */
  updateRole: Action<{ id: string; role: BoardMemberRole }, BoardMember>
  /** Assign to committee */
  assignToCommittee: Action<{ id: string; committee: string }, BoardMember>
  /** Remove from committee */
  removeFromCommittee: Action<{ id: string; committee: string }, BoardMember>
}

export interface BoardMeetingActions extends CRUDResource<BoardMeeting, BoardMeetingInput> {
  /** List by board */
  listByBoard: Action<{ boardId: string } & ListParams, PaginatedResult<BoardMeeting>>
  /** Schedule meeting */
  schedule: Action<BoardMeetingInput, BoardMeeting>
  /** Start meeting */
  start: Action<{ id: string }, BoardMeeting>
  /** End meeting */
  end: Action<{ id: string }, BoardMeeting>
  /** Cancel meeting */
  cancel: Action<{ id: string; reason?: string }, BoardMeeting>
  /** Add agenda item */
  addAgendaItem: Action<
    { id: string; item: NonNullable<BoardMeeting['agenda']>[0] },
    BoardMeeting
  >
  /** Record attendance */
  recordAttendance: Action<
    { id: string; memberId: string; status: 'attending' | 'absent' | 'proxy'; proxy?: string },
    BoardMeeting
  >
  /** Add resolution */
  addResolution: Action<
    { id: string; title: string; description?: string },
    BoardMeeting
  >
  /** Vote on resolution */
  vote: Action<
    { id: string; resolutionId: string; vote: 'for' | 'against' | 'abstain'; memberId: string },
    BoardMeeting
  >
  /** Approve minutes */
  approveMinutes: Action<{ id: string }, BoardMeeting>
}

export interface AdvisorActions extends CRUDResource<Advisor, AdvisorInput> {
  /** List by business */
  listByBusiness: Action<{ businessId: string } & ListParams, PaginatedResult<Advisor>>
  /** List by type */
  listByType: Action<{ businessId: string; type: AdvisorType } & ListParams, PaginatedResult<Advisor>>
  /** Log engagement */
  logEngagement: Action<
    { id: string; engagement: NonNullable<Advisor['engagements']>[0] },
    Advisor
  >
  /** Record introduction */
  recordIntroduction: Action<
    { id: string; introduction: NonNullable<Advisor['introductionsMade']>[0] },
    Advisor
  >
  /** Grant equity */
  grantEquity: Action<
    { id: string; shares?: number; percentage?: number; vestingScheduleId?: string },
    Advisor
  >
  /** Complete engagement */
  complete: Action<{ id: string; endDate?: Date }, Advisor>
}

export interface FounderActions extends CRUDResource<Founder, FounderInput> {
  /** List by business */
  listByBusiness: Action<{ businessId: string } & ListParams, PaginatedResult<Founder>>
  /** Get active founders */
  getActive: Action<{ businessId: string }, Founder[]>
  /** Update role */
  updateRole: Action<{ id: string; role: FounderRole; title?: string }, Founder>
  /** Record departure */
  recordDeparture: Action<
    { id: string; date: Date; reason?: string; status: 'departed' | 'transitioned' },
    Founder
  >
  /** Update equity */
  updateEquity: Action<
    { id: string; equity: Founder['equity'] },
    Founder
  >
}

export interface LevelActions extends CRUDResource<Level, LevelInput> {
  /** List by business */
  listByBusiness: Action<{ businessId: string } & ListParams, PaginatedResult<Level>>
  /** List by track */
  listByTrack: Action<{ businessId: string; track: LevelTrack } & ListParams, PaginatedResult<Level>>
  /** List by department */
  listByDepartment: Action<{ businessId: string; department: string } & ListParams, PaginatedResult<Level>>
  /** Get progression path */
  getProgressionPath: Action<{ id: string }, Level[]>
  /** Update compensation */
  updateCompensation: Action<{ id: string; compensation: Level['compensation'] }, Level>
}

export interface RoleActions extends CRUDResource<Role, RoleInput> {
  /** List by business */
  listByBusiness: Action<{ businessId: string } & ListParams, PaginatedResult<Role>>
  /** List by department */
  listByDepartment: Action<{ businessId: string; department: string } & ListParams, PaginatedResult<Role>>
  /** Get reporting structure */
  getReportingStructure: Action<{ id: string }, { role: Role; reportsTo?: Role; directReports: Role[] }>
  /** Update headcount */
  updateHeadcount: Action<{ id: string; approved: number; current?: number }, Role>
  /** Deprecate role */
  deprecate: Action<{ id: string; replacedBy?: string }, Role>
}

// =============================================================================
// Events
// =============================================================================

export interface BoardEvents {
  created: BaseEvent<'board.created', Board>
  updated: BaseEvent<'board.updated', { before: Board; after: Board }>
  committee_added: BaseEvent<'board.committee_added', { board: Board; committee: NonNullable<Board['committees']>[0] }>
  committee_removed: BaseEvent<'board.committee_removed', { boardId: string; committeeId: string }>
}

export interface BoardMemberEvents {
  appointed: BaseEvent<'board_member.appointed', BoardMember>
  updated: BaseEvent<'board_member.updated', { before: BoardMember; after: BoardMember }>
  resigned: BaseEvent<'board_member.resigned', BoardMember>
  removed: BaseEvent<'board_member.removed', BoardMember>
  role_changed: BaseEvent<'board_member.role_changed', { member: BoardMember; previousRole: BoardMemberRole }>
}

export interface BoardMeetingEvents {
  scheduled: BaseEvent<'board_meeting.scheduled', BoardMeeting>
  started: BaseEvent<'board_meeting.started', BoardMeeting>
  ended: BaseEvent<'board_meeting.ended', BoardMeeting>
  cancelled: BaseEvent<'board_meeting.cancelled', BoardMeeting>
  resolution_passed: BaseEvent<'board_meeting.resolution_passed', { meeting: BoardMeeting; resolution: NonNullable<BoardMeeting['resolutions']>[0] }>
  minutes_approved: BaseEvent<'board_meeting.minutes_approved', BoardMeeting>
}

export interface AdvisorEvents {
  onboarded: BaseEvent<'advisor.onboarded', Advisor>
  updated: BaseEvent<'advisor.updated', { before: Advisor; after: Advisor }>
  engagement_logged: BaseEvent<'advisor.engagement_logged', { advisor: Advisor; engagement: NonNullable<Advisor['engagements']>[0] }>
  equity_granted: BaseEvent<'advisor.equity_granted', { advisor: Advisor; equity: Advisor['equity'] }>
  completed: BaseEvent<'advisor.completed', Advisor>
}

export interface FounderEvents {
  created: BaseEvent<'founder.created', Founder>
  updated: BaseEvent<'founder.updated', { before: Founder; after: Founder }>
  role_changed: BaseEvent<'founder.role_changed', { founder: Founder; previousRole: FounderRole }>
  departed: BaseEvent<'founder.departed', Founder>
}

export interface LevelEvents {
  created: BaseEvent<'level.created', Level>
  updated: BaseEvent<'level.updated', { before: Level; after: Level }>
  compensation_updated: BaseEvent<'level.compensation_updated', { level: Level; previousCompensation: Level['compensation'] }>
}

export interface RoleEvents {
  created: BaseEvent<'role.created', Role>
  updated: BaseEvent<'role.updated', { before: Role; after: Role }>
  deprecated: BaseEvent<'role.deprecated', { role: Role; replacedBy?: string }>
  headcount_updated: BaseEvent<'role.headcount_updated', { role: Role; previousHeadcount: number }>
}

// =============================================================================
// Resources
// =============================================================================

export interface BoardResource extends BoardActions {
  on: <E extends keyof BoardEvents>(
    event: E,
    handler: EventHandler<BoardEvents[E]>
  ) => () => void
}

export interface BoardMemberResource extends BoardMemberActions {
  on: <E extends keyof BoardMemberEvents>(
    event: E,
    handler: EventHandler<BoardMemberEvents[E]>
  ) => () => void
}

export interface BoardMeetingResource extends BoardMeetingActions {
  on: <E extends keyof BoardMeetingEvents>(
    event: E,
    handler: EventHandler<BoardMeetingEvents[E]>
  ) => () => void
}

export interface AdvisorResource extends AdvisorActions {
  on: <E extends keyof AdvisorEvents>(
    event: E,
    handler: EventHandler<AdvisorEvents[E]>
  ) => () => void
}

export interface FounderResource extends FounderActions {
  on: <E extends keyof FounderEvents>(
    event: E,
    handler: EventHandler<FounderEvents[E]>
  ) => () => void
}

export interface LevelResource extends LevelActions {
  on: <E extends keyof LevelEvents>(
    event: E,
    handler: EventHandler<LevelEvents[E]>
  ) => () => void
}

export interface RoleResource extends RoleActions {
  on: <E extends keyof RoleEvents>(
    event: E,
    handler: EventHandler<RoleEvents[E]>
  ) => () => void
}

// =============================================================================
// Proxy
// =============================================================================

/**
 * Governance module proxy for RPC access.
 */
export interface GovernanceProxy {
  boards: BoardResource
  boardMembers: BoardMemberResource
  boardMeetings: BoardMeetingResource
  advisors: AdvisorResource
  founders: FounderResource
  levels: LevelResource
  roles: RoleResource
}
