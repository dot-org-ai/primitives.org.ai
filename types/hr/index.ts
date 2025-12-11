/**
 * HR & People Management Tool Types
 *
 * Types for HR & People integrations covering the complete employee lifecycle:
 * Employee, Contractor, Candidate, JobPosting, Application, Interview, Offer,
 * Onboarding, Department, Team, Position, PerformanceReview, Goal, Feedback,
 * Training, Certification, TimeOff, TimeOffPolicy, Attendance, Benefit,
 * BenefitEnrollment, Compensation, CompensationChange, EmployeeDocument,
 * EmergencyContact, EmploymentHistory.
 *
 * @module hr
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
// Enums and Types
// =============================================================================

/**
 * Employment status.
 */
export type EmploymentStatus = 'active' | 'inactive' | 'on_leave' | 'terminated' | 'suspended'

/**
 * Employment type.
 */
export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'temporary' | 'intern' | 'seasonal'

/**
 * Contractor type.
 */
export type ContractorType = '1099' | 'w2_contract' | 'corp_to_corp' | 'freelance' | 'agency'

/**
 * Candidate status.
 */
export type CandidateStatus = 'new' | 'screening' | 'interviewing' | 'offered' | 'hired' | 'rejected' | 'withdrawn'

/**
 * Application status.
 */
export type ApplicationStatus = 'submitted' | 'under_review' | 'shortlisted' | 'interviewing' | 'offer_extended' | 'accepted' | 'rejected' | 'withdrawn'

/**
 * Interview status.
 */
export type InterviewStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

/**
 * Interview type.
 */
export type InterviewType = 'phone_screen' | 'video' | 'onsite' | 'technical' | 'behavioral' | 'panel' | 'final'

/**
 * Offer status.
 */
export type OfferStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'withdrawn'

/**
 * Performance rating.
 */
export type PerformanceRating = 'exceeds_expectations' | 'meets_expectations' | 'needs_improvement' | 'unsatisfactory' | 'outstanding'

/**
 * Time off type.
 */
export type TimeOffType = 'vacation' | 'sick' | 'personal' | 'parental' | 'bereavement' | 'jury_duty' | 'military' | 'unpaid' | 'other'

/**
 * Time off status.
 */
export type TimeOffStatus = 'pending' | 'approved' | 'denied' | 'cancelled'

/**
 * Benefit type.
 */
export type BenefitType = 'health_insurance' | 'dental_insurance' | 'vision_insurance' | 'life_insurance' | 'disability_insurance' | '401k' | 'hsa' | 'fsa' | 'commuter' | 'equity' | 'other'

/**
 * Benefit enrollment status.
 */
export type BenefitEnrollmentStatus = 'pending' | 'enrolled' | 'waived' | 'terminated'

/**
 * Compensation type.
 */
export type CompensationType = 'salary' | 'hourly' | 'commission' | 'bonus' | 'equity' | 'other'

/**
 * Compensation frequency.
 */
export type CompensationFrequency = 'hourly' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'

/**
 * Document type.
 */
export type DocumentType = 'contract' | 'offer_letter' | 'nda' | 'handbook' | 'policy' | 'review' | 'certification' | 'id' | 'tax_form' | 'other'

/**
 * Onboarding status.
 */
export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'overdue'

/**
 * Goal type.
 */
export type GoalType = 'individual' | 'team' | 'company' | 'okr' | 'kpi' | 'development'

/**
 * Goal status.
 */
export type GoalStatus = 'not_started' | 'in_progress' | 'at_risk' | 'completed' | 'cancelled'

/**
 * Training status.
 */
export type TrainingStatus = 'not_started' | 'in_progress' | 'completed' | 'failed' | 'expired'

/**
 * Termination reason.
 */
export type TerminationReason = 'voluntary' | 'involuntary' | 'retirement' | 'end_of_contract' | 'layoff' | 'performance' | 'other'

// =============================================================================
// Employee
// =============================================================================

/**
 * Core employee record representing an active or past employee.
 *
 * @example
 * ```ts
 * const employee: Employee = {
 *   id: 'emp_123',
 *   employeeNumber: 'E001234',
 *   firstName: 'Jane',
 *   lastName: 'Smith',
 *   email: 'jane.smith@company.com',
 *   personalEmail: 'jane@example.com',
 *   phone: '+1-555-0100',
 *   status: 'active',
 *   employmentType: 'full_time',
 *   departmentId: 'dept_eng',
 *   teamId: 'team_platform',
 *   positionId: 'pos_senior_eng',
 *   managerId: 'emp_456',
 *   hireDate: new Date('2020-01-15'),
 *   location: 'San Francisco, CA',
 *   workLocation: 'hybrid',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Employee {
  /** Unique identifier */
  id: string

  /** Employee number/code */
  employeeNumber?: string

  /** First name */
  firstName: string

  /** Last name */
  lastName: string

  /** Middle name */
  middleName?: string

  /** Preferred name */
  preferredName?: string

  /** Work email address */
  email: string

  /** Personal email address */
  personalEmail?: string

  /** Work phone number */
  phone?: string

  /** Mobile phone number */
  mobilePhone?: string

  /** Employment status */
  status: EmploymentStatus

  /** Employment type */
  employmentType: EmploymentType

  /** Department ID */
  departmentId?: string

  /** Team ID */
  teamId?: string

  /** Position/role ID */
  positionId?: string

  /** Job title */
  jobTitle?: string

  /** Direct manager ID */
  managerId?: string

  /** Hire date */
  hireDate?: Date

  /** Termination date */
  terminationDate?: Date

  /** Termination reason */
  terminationReason?: TerminationReason

  /** Date of birth */
  dateOfBirth?: Date

  /** Gender */
  gender?: string

  /** Pronouns */
  pronouns?: string

  /** Home address */
  address?: {
    street?: string
    street2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Work location (office/city) */
  location?: string

  /** Work arrangement */
  workLocation?: 'onsite' | 'remote' | 'hybrid'

  /** Social security number (encrypted) */
  ssn?: string

  /** Passport number */
  passportNumber?: string

  /** Visa type */
  visaType?: string

  /** Visa expiration */
  visaExpirationDate?: Date

  /** Shirt size */
  shirtSize?: string

  /** Photo URL */
  photoUrl?: string

  /** LinkedIn profile */
  linkedinUrl?: string

  /** Bio/about */
  bio?: string

  /** Skills */
  skills?: string[]

  /** Languages */
  languages?: string[]

  /** Start date (for anniversaries) */
  startDate?: Date

  /** Probation end date */
  probationEndDate?: Date

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    bamboohr?: string
    adp?: string
    gusto?: string
    rippling?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EmployeeInput = Input<Employee>
export type EmployeeOutput = Output<Employee>

// =============================================================================
// Contractor
// =============================================================================

/**
 * Independent contractor or contingent worker.
 *
 * @example
 * ```ts
 * const contractor: Contractor = {
 *   id: 'ctr_123',
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   email: 'john@example.com',
 *   contractorType: '1099',
 *   status: 'active',
 *   contractStartDate: new Date('2024-01-01'),
 *   contractEndDate: new Date('2024-12-31'),
 *   hourlyRate: 150,
 *   currency: 'USD',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Contractor {
  /** Unique identifier */
  id: string

  /** First name */
  firstName: string

  /** Last name */
  lastName: string

  /** Email address */
  email: string

  /** Phone number */
  phone?: string

  /** Contractor type */
  contractorType: ContractorType

  /** Status */
  status: EmploymentStatus

  /** Company name (if applicable) */
  companyName?: string

  /** Contract start date */
  contractStartDate?: Date

  /** Contract end date */
  contractEndDate?: Date

  /** Hourly rate */
  hourlyRate?: number

  /** Fixed contract amount */
  contractAmount?: number

  /** Currency */
  currency?: string

  /** Department ID */
  departmentId?: string

  /** Team ID */
  teamId?: string

  /** Manager ID */
  managerId?: string

  /** Job title */
  jobTitle?: string

  /** Work location */
  location?: string

  /** Skills */
  skills?: string[]

  /** Contract document URL */
  contractDocumentUrl?: string

  /** W9/tax document URL */
  taxDocumentUrl?: string

  /** Address */
  address?: {
    street?: string
    street2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Tax ID (EIN or SSN) */
  taxId?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    bamboohr?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ContractorInput = Input<Contractor>
export type ContractorOutput = Output<Contractor>

// =============================================================================
// Candidate
// =============================================================================

/**
 * Job applicant or potential hire.
 *
 * @example
 * ```ts
 * const candidate: Candidate = {
 *   id: 'cand_123',
 *   firstName: 'Alice',
 *   lastName: 'Johnson',
 *   email: 'alice@example.com',
 *   phone: '+1-555-0200',
 *   status: 'interviewing',
 *   source: 'linkedin',
 *   resumeUrl: 'https://example.com/resumes/alice.pdf',
 *   currentCompany: 'TechCorp',
 *   currentTitle: 'Software Engineer',
 *   yearsOfExperience: 5,
 *   desiredSalary: 150000,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Candidate {
  /** Unique identifier */
  id: string

  /** First name */
  firstName: string

  /** Last name */
  lastName: string

  /** Email address */
  email: string

  /** Phone number */
  phone?: string

  /** Candidate status */
  status: CandidateStatus

  /** Source (how they found us) */
  source?: string

  /** Referrer employee ID */
  referredById?: string

  /** Resume/CV URL */
  resumeUrl?: string

  /** Cover letter */
  coverLetter?: string

  /** LinkedIn profile */
  linkedinUrl?: string

  /** Portfolio URL */
  portfolioUrl?: string

  /** GitHub profile */
  githubUrl?: string

  /** Current company */
  currentCompany?: string

  /** Current job title */
  currentTitle?: string

  /** Years of experience */
  yearsOfExperience?: number

  /** Education */
  education?: Array<{
    school: string
    degree?: string
    field?: string
    graduationYear?: number
  }>

  /** Skills */
  skills?: string[]

  /** Languages */
  languages?: string[]

  /** Location */
  location?: string

  /** Willing to relocate */
  willingToRelocate?: boolean

  /** Current salary */
  currentSalary?: number

  /** Desired salary */
  desiredSalary?: number

  /** Currency */
  currency?: string

  /** Notice period (days) */
  noticePeriod?: number

  /** Available start date */
  availableStartDate?: Date

  /** Work authorization */
  workAuthorization?: string

  /** Requires sponsorship */
  requiresSponsorship?: boolean

  /** Notes */
  notes?: string

  /** Tags */
  tags?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    greenhouse?: string
    lever?: string
    workday?: string
    ashby?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CandidateInput = Input<Candidate>
export type CandidateOutput = Output<Candidate>

// =============================================================================
// JobPosting
// =============================================================================

/**
 * Job listing or requisition.
 *
 * @example
 * ```ts
 * const jobPosting: JobPosting = {
 *   id: 'job_123',
 *   title: 'Senior Software Engineer',
 *   departmentId: 'dept_eng',
 *   positionId: 'pos_senior_eng',
 *   employmentType: 'full_time',
 *   location: 'San Francisco, CA',
 *   remote: true,
 *   status: 'open',
 *   description: 'We are looking for...',
 *   requirements: ['5+ years experience', 'TypeScript', 'React'],
 *   responsibilities: ['Build features', 'Code review', 'Mentor'],
 *   salaryMin: 150000,
 *   salaryMax: 200000,
 *   currency: 'USD',
 *   openings: 2,
 *   hiringManagerId: 'emp_456',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface JobPosting {
  /** Unique identifier */
  id: string

  /** Job title */
  title: string

  /** Department ID */
  departmentId?: string

  /** Position ID */
  positionId?: string

  /** Employment type */
  employmentType: EmploymentType

  /** Office location */
  location?: string

  /** Remote allowed */
  remote?: boolean

  /** Work arrangement */
  workArrangement?: 'onsite' | 'remote' | 'hybrid'

  /** Status */
  status: 'draft' | 'open' | 'closed' | 'on_hold' | 'filled'

  /** Job description */
  description?: string

  /** Requirements */
  requirements?: string[]

  /** Responsibilities */
  responsibilities?: string[]

  /** Nice to have qualifications */
  niceToHave?: string[]

  /** Benefits */
  benefits?: string[]

  /** Salary minimum */
  salaryMin?: number

  /** Salary maximum */
  salaryMax?: number

  /** Currency */
  currency?: string

  /** Number of openings */
  openings?: number

  /** Hiring manager ID */
  hiringManagerId?: string

  /** Recruiter ID */
  recruiterId?: string

  /** Job posting URL */
  postingUrl?: string

  /** Posted on external sites */
  postedOn?: string[]

  /** Application deadline */
  applicationDeadline?: Date

  /** Requisition number */
  requisitionNumber?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    greenhouse?: string
    lever?: string
    workday?: string
    ashby?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type JobPostingInput = Input<JobPosting>
export type JobPostingOutput = Output<JobPosting>

// =============================================================================
// Application
// =============================================================================

/**
 * Job application from a candidate.
 *
 * @example
 * ```ts
 * const application: Application = {
 *   id: 'app_123',
 *   candidateId: 'cand_123',
 *   jobPostingId: 'job_123',
 *   status: 'under_review',
 *   appliedDate: new Date(),
 *   source: 'linkedin',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Application {
  /** Unique identifier */
  id: string

  /** Candidate ID */
  candidateId: string

  /** Job posting ID */
  jobPostingId: string

  /** Application status */
  status: ApplicationStatus

  /** Date applied */
  appliedDate: Date

  /** Application source */
  source?: string

  /** Resume URL (application-specific) */
  resumeUrl?: string

  /** Cover letter */
  coverLetter?: string

  /** Screening questions/answers */
  screeningAnswers?: Record<string, unknown>

  /** Assigned recruiter ID */
  recruiterId?: string

  /** Assigned hiring manager ID */
  hiringManagerId?: string

  /** Rating/score */
  rating?: number

  /** Rejection reason */
  rejectionReason?: string

  /** Notes */
  notes?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    greenhouse?: string
    lever?: string
    workday?: string
    ashby?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type ApplicationInput = Input<Application>
export type ApplicationOutput = Output<Application>

// =============================================================================
// Interview
// =============================================================================

/**
 * Interview session with a candidate.
 *
 * @example
 * ```ts
 * const interview: Interview = {
 *   id: 'int_123',
 *   applicationId: 'app_123',
 *   candidateId: 'cand_123',
 *   type: 'technical',
 *   status: 'scheduled',
 *   scheduledAt: new Date('2024-02-15T10:00:00Z'),
 *   duration: 60,
 *   interviewers: ['emp_123', 'emp_456'],
 *   location: 'Zoom',
 *   meetingUrl: 'https://zoom.us/j/123456789',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Interview {
  /** Unique identifier */
  id: string

  /** Application ID */
  applicationId: string

  /** Candidate ID */
  candidateId: string

  /** Job posting ID */
  jobPostingId?: string

  /** Interview type */
  type: InterviewType

  /** Interview status */
  status: InterviewStatus

  /** Scheduled date/time */
  scheduledAt?: Date

  /** Duration in minutes */
  duration?: number

  /** Interviewer IDs */
  interviewers?: string[]

  /** Location or platform */
  location?: string

  /** Meeting/video call URL */
  meetingUrl?: string

  /** Interview stage/round */
  stage?: string

  /** Feedback submitted */
  feedbackSubmitted?: boolean

  /** Overall recommendation */
  recommendation?: 'strong_yes' | 'yes' | 'neutral' | 'no' | 'strong_no'

  /** Overall rating */
  rating?: number

  /** Interview notes */
  notes?: string

  /** Scorecard data */
  scorecard?: {
    criterion: string
    rating: number
    notes?: string
  }[]

  /** Cancellation reason */
  cancellationReason?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    greenhouse?: string
    lever?: string
    workday?: string
    ashby?: string
    calendly?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type InterviewInput = Input<Interview>
export type InterviewOutput = Output<Interview>

// =============================================================================
// Offer
// =============================================================================

/**
 * Job offer extended to a candidate.
 *
 * @example
 * ```ts
 * const offer: Offer = {
 *   id: 'off_123',
 *   candidateId: 'cand_123',
 *   jobPostingId: 'job_123',
 *   applicationId: 'app_123',
 *   status: 'sent',
 *   jobTitle: 'Senior Software Engineer',
 *   employmentType: 'full_time',
 *   salary: 175000,
 *   currency: 'USD',
 *   startDate: new Date('2024-03-01'),
 *   sentDate: new Date(),
 *   expirationDate: new Date('2024-02-15'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Offer {
  /** Unique identifier */
  id: string

  /** Candidate ID */
  candidateId: string

  /** Job posting ID */
  jobPostingId?: string

  /** Application ID */
  applicationId?: string

  /** Offer status */
  status: OfferStatus

  /** Job title */
  jobTitle: string

  /** Department ID */
  departmentId?: string

  /** Position ID */
  positionId?: string

  /** Employment type */
  employmentType: EmploymentType

  /** Base salary */
  salary?: number

  /** Hourly rate */
  hourlyRate?: number

  /** Currency */
  currency?: string

  /** Sign-on bonus */
  signOnBonus?: number

  /** Equity/stock options */
  equity?: {
    type?: 'stock_options' | 'rsu' | 'restricted_stock'
    amount?: number
    vestingYears?: number
  }

  /** Annual bonus target */
  bonusTarget?: number

  /** Benefits summary */
  benefits?: string[]

  /** Start date */
  startDate?: Date

  /** Offer sent date */
  sentDate?: Date

  /** Offer expiration date */
  expirationDate?: Date

  /** Acceptance date */
  acceptanceDate?: Date

  /** Rejection date */
  rejectionDate?: Date

  /** Rejection reason */
  rejectionReason?: string

  /** Offer letter URL */
  offerLetterUrl?: string

  /** Hiring manager ID */
  hiringManagerId?: string

  /** Approver IDs */
  approvers?: string[]

  /** Approval status */
  approvalStatus?: 'pending' | 'approved' | 'rejected'

  /** Notes */
  notes?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    greenhouse?: string
    lever?: string
    workday?: string
    ashby?: string
    docusign?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type OfferInput = Input<Offer>
export type OfferOutput = Output<Offer>

// =============================================================================
// Onboarding
// =============================================================================

/**
 * Onboarding checklist and process for new hire.
 *
 * @example
 * ```ts
 * const onboarding: Onboarding = {
 *   id: 'onb_123',
 *   employeeId: 'emp_123',
 *   status: 'in_progress',
 *   startDate: new Date('2024-03-01'),
 *   tasks: [
 *     { id: 't1', title: 'Complete I-9', completed: true },
 *     { id: 't2', title: 'Setup laptop', completed: false }
 *   ],
 *   completionPercentage: 50,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Onboarding {
  /** Unique identifier */
  id: string

  /** Employee ID */
  employeeId: string

  /** Onboarding status */
  status: OnboardingStatus

  /** Start date */
  startDate?: Date

  /** Expected completion date */
  expectedCompletionDate?: Date

  /** Actual completion date */
  completionDate?: Date

  /** Onboarding tasks/checklist */
  tasks?: Array<{
    id: string
    title: string
    description?: string
    category?: string
    assignedTo?: string
    dueDate?: Date
    completed: boolean
    completedAt?: Date
    completedBy?: string
  }>

  /** Completion percentage */
  completionPercentage?: number

  /** Buddy/mentor ID */
  buddyId?: string

  /** Manager ID */
  managerId?: string

  /** Documents to complete */
  requiredDocuments?: string[]

  /** Training modules */
  trainingModules?: string[]

  /** Notes */
  notes?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    bamboohr?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type OnboardingInput = Input<Onboarding>
export type OnboardingOutput = Output<Onboarding>

// =============================================================================
// Department
// =============================================================================

/**
 * Organizational department.
 *
 * @example
 * ```ts
 * const department: Department = {
 *   id: 'dept_eng',
 *   name: 'Engineering',
 *   code: 'ENG',
 *   headId: 'emp_cto',
 *   parentDepartmentId: 'dept_product',
 *   employeeCount: 50,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Department {
  /** Unique identifier */
  id: string

  /** Department name */
  name: string

  /** Department code */
  code?: string

  /** Description */
  description?: string

  /** Department head/leader ID */
  headId?: string

  /** Parent department ID */
  parentDepartmentId?: string

  /** Cost center */
  costCenter?: string

  /** Employee count */
  employeeCount?: number

  /** Location */
  location?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    bamboohr?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type DepartmentInput = Input<Department>
export type DepartmentOutput = Output<Department>

// =============================================================================
// Team
// =============================================================================

/**
 * Team within a department.
 *
 * @example
 * ```ts
 * const team: Team = {
 *   id: 'team_platform',
 *   name: 'Platform Engineering',
 *   departmentId: 'dept_eng',
 *   leadId: 'emp_789',
 *   memberIds: ['emp_123', 'emp_456', 'emp_789'],
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Team {
  /** Unique identifier */
  id: string

  /** Team name */
  name: string

  /** Department ID */
  departmentId?: string

  /** Team lead/manager ID */
  leadId?: string

  /** Description */
  description?: string

  /** Team member IDs */
  memberIds?: string[]

  /** Team type */
  type?: 'permanent' | 'project' | 'cross_functional' | 'temporary'

  /** Location */
  location?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    bamboohr?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TeamInput = Input<Team>
export type TeamOutput = Output<Team>

// =============================================================================
// Position
// =============================================================================

/**
 * Job position or role template.
 *
 * @example
 * ```ts
 * const position: Position = {
 *   id: 'pos_senior_eng',
 *   title: 'Senior Software Engineer',
 *   level: 'senior',
 *   departmentId: 'dept_eng',
 *   salaryMin: 150000,
 *   salaryMax: 200000,
 *   currency: 'USD',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Position {
  /** Unique identifier */
  id: string

  /** Position title */
  title: string

  /** Job level */
  level?: 'intern' | 'junior' | 'mid' | 'senior' | 'staff' | 'principal' | 'lead' | 'manager' | 'director' | 'vp' | 'c_level'

  /** Department ID */
  departmentId?: string

  /** Job family */
  jobFamily?: string

  /** Description */
  description?: string

  /** Responsibilities */
  responsibilities?: string[]

  /** Required skills */
  requiredSkills?: string[]

  /** Preferred skills */
  preferredSkills?: string[]

  /** Minimum education */
  minimumEducation?: string

  /** Years of experience required */
  yearsOfExperience?: number

  /** Salary minimum */
  salaryMin?: number

  /** Salary maximum */
  salaryMax?: number

  /** Currency */
  currency?: string

  /** Is remote eligible */
  remoteEligible?: boolean

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    bamboohr?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PositionInput = Input<Position>
export type PositionOutput = Output<Position>

// =============================================================================
// PerformanceReview
// =============================================================================

/**
 * Performance review/evaluation.
 *
 * @example
 * ```ts
 * const review: PerformanceReview = {
 *   id: 'rev_123',
 *   employeeId: 'emp_123',
 *   reviewerId: 'emp_456',
 *   reviewPeriodStart: new Date('2024-01-01'),
 *   reviewPeriodEnd: new Date('2024-12-31'),
 *   status: 'completed',
 *   overallRating: 'exceeds_expectations',
 *   summary: 'Excellent performance this year...',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface PerformanceReview {
  /** Unique identifier */
  id: string

  /** Employee being reviewed */
  employeeId: string

  /** Primary reviewer ID */
  reviewerId: string

  /** Review period start date */
  reviewPeriodStart: Date

  /** Review period end date */
  reviewPeriodEnd: Date

  /** Review status */
  status: 'not_started' | 'in_progress' | 'completed' | 'cancelled'

  /** Review type */
  type?: 'annual' | 'mid_year' | 'probation' | '90_day' | 'project' | 'promotion'

  /** Overall rating */
  overallRating?: PerformanceRating

  /** Category ratings */
  categoryRatings?: Array<{
    category: string
    rating: PerformanceRating
    comments?: string
  }>

  /** Strengths */
  strengths?: string[]

  /** Areas for improvement */
  areasForImprovement?: string[]

  /** Goals achieved */
  goalsAchieved?: string[]

  /** Summary/comments */
  summary?: string

  /** Reviewer comments */
  reviewerComments?: string

  /** Employee self-assessment */
  selfAssessment?: string

  /** Manager comments */
  managerComments?: string

  /** Promotion recommendation */
  promotionRecommended?: boolean

  /** Salary increase percentage */
  salaryIncreasePercentage?: number

  /** Bonus amount */
  bonusAmount?: number

  /** Development plan */
  developmentPlan?: string

  /** Due date */
  dueDate?: Date

  /** Completion date */
  completionDate?: Date

  /** Signature date */
  signatureDate?: Date

  /** Employee acknowledged */
  employeeAcknowledged?: boolean

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    bamboohr?: string
    lattice?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type PerformanceReviewInput = Input<PerformanceReview>
export type PerformanceReviewOutput = Output<PerformanceReview>

// =============================================================================
// Goal
// =============================================================================

/**
 * Employee goal (OKR, KPI, development goal).
 *
 * @example
 * ```ts
 * const goal: Goal = {
 *   id: 'goal_123',
 *   employeeId: 'emp_123',
 *   title: 'Improve API response time by 30%',
 *   type: 'kpi',
 *   status: 'in_progress',
 *   startDate: new Date('2024-01-01'),
 *   endDate: new Date('2024-12-31'),
 *   progress: 65,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Goal {
  /** Unique identifier */
  id: string

  /** Employee ID */
  employeeId?: string

  /** Team ID (for team goals) */
  teamId?: string

  /** Department ID (for department goals) */
  departmentId?: string

  /** Goal title */
  title: string

  /** Description */
  description?: string

  /** Goal type */
  type: GoalType

  /** Goal status */
  status: GoalStatus

  /** Priority */
  priority?: 'low' | 'medium' | 'high' | 'critical'

  /** Start date */
  startDate?: Date

  /** End date */
  endDate?: Date

  /** Progress percentage (0-100) */
  progress?: number

  /** Target metric */
  targetMetric?: {
    name: string
    currentValue?: number
    targetValue?: number
    unit?: string
  }

  /** Key results (for OKRs) */
  keyResults?: Array<{
    id: string
    description: string
    progress: number
    targetValue?: number
    currentValue?: number
  }>

  /** Parent goal ID */
  parentGoalId?: string

  /** Owner ID */
  ownerId?: string

  /** Aligned to goal ID */
  alignedToGoalId?: string

  /** Notes */
  notes?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    lattice?: string
    betterworks?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type GoalInput = Input<Goal>
export type GoalOutput = Output<Goal>

// =============================================================================
// Feedback
// =============================================================================

/**
 * 360-degree feedback or peer feedback.
 *
 * @example
 * ```ts
 * const feedback: Feedback = {
 *   id: 'fb_123',
 *   employeeId: 'emp_123',
 *   providedById: 'emp_456',
 *   type: 'peer',
 *   summary: 'Great collaboration on the project...',
 *   anonymous: false,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Feedback {
  /** Unique identifier */
  id: string

  /** Employee receiving feedback */
  employeeId: string

  /** Feedback provider ID */
  providedById?: string

  /** Feedback type */
  type: 'peer' | 'upward' | 'downward' | '360' | 'manager' | 'self'

  /** Performance review ID (if part of review) */
  reviewId?: string

  /** Summary/comments */
  summary?: string

  /** Category ratings */
  categoryRatings?: Array<{
    category: string
    rating: number
    comments?: string
  }>

  /** Strengths */
  strengths?: string[]

  /** Areas for improvement */
  areasForImprovement?: string[]

  /** Anonymous feedback */
  anonymous?: boolean

  /** Visibility */
  visibility?: 'private' | 'manager_only' | 'employee_visible'

  /** Sentiment */
  sentiment?: 'positive' | 'neutral' | 'constructive'

  /** Requested date */
  requestedDate?: Date

  /** Submitted date */
  submittedDate?: Date

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    lattice?: string
    cultureamp?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type FeedbackInput = Input<Feedback>
export type FeedbackOutput = Output<Feedback>

// =============================================================================
// Training
// =============================================================================

/**
 * Training program or course.
 *
 * @example
 * ```ts
 * const training: Training = {
 *   id: 'trn_123',
 *   title: 'Leadership Development Program',
 *   type: 'leadership',
 *   status: 'active',
 *   provider: 'LinkedIn Learning',
 *   duration: 40,
 *   required: false,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Training {
  /** Unique identifier */
  id: string

  /** Training title */
  title: string

  /** Description */
  description?: string

  /** Training type */
  type?: 'onboarding' | 'compliance' | 'technical' | 'leadership' | 'soft_skills' | 'safety' | 'other'

  /** Status */
  status: 'draft' | 'active' | 'archived'

  /** Provider/vendor */
  provider?: string

  /** Duration in hours */
  duration?: number

  /** Course URL */
  courseUrl?: string

  /** Delivery method */
  deliveryMethod?: 'online' | 'in_person' | 'hybrid' | 'video' | 'self_paced'

  /** Required training */
  required?: boolean

  /** Target audience */
  targetAudience?: string[]

  /** Prerequisites */
  prerequisites?: string[]

  /** Instructor */
  instructor?: string

  /** Cost per participant */
  cost?: number

  /** Currency */
  currency?: string

  /** Certification awarded */
  certificationAwarded?: boolean

  /** Expiration period (months) */
  expirationMonths?: number

  /** Tags */
  tags?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    cornerstone?: string
    saba?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TrainingInput = Input<Training>
export type TrainingOutput = Output<Training>

// =============================================================================
// Certification
// =============================================================================

/**
 * Employee certification or license.
 *
 * @example
 * ```ts
 * const certification: Certification = {
 *   id: 'cert_123',
 *   employeeId: 'emp_123',
 *   name: 'AWS Solutions Architect - Professional',
 *   issuingOrganization: 'Amazon Web Services',
 *   issueDate: new Date('2023-06-15'),
 *   expirationDate: new Date('2026-06-15'),
 *   status: 'active',
 *   credentialId: 'AWS-12345',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Certification {
  /** Unique identifier */
  id: string

  /** Employee ID */
  employeeId: string

  /** Certification name */
  name: string

  /** Issuing organization */
  issuingOrganization?: string

  /** Issue date */
  issueDate?: Date

  /** Expiration date */
  expirationDate?: Date

  /** Status */
  status: 'active' | 'expired' | 'pending' | 'revoked'

  /** Credential ID/number */
  credentialId?: string

  /** Credential URL */
  credentialUrl?: string

  /** Document URL */
  documentUrl?: string

  /** Training ID (if from training) */
  trainingId?: string

  /** Renewal required */
  renewalRequired?: boolean

  /** Renewal reminder sent */
  renewalReminderSent?: boolean

  /** Notes */
  notes?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CertificationInput = Input<Certification>
export type CertificationOutput = Output<Certification>

// =============================================================================
// TimeOff
// =============================================================================

/**
 * Time off / leave request.
 *
 * @example
 * ```ts
 * const timeOff: TimeOff = {
 *   id: 'to_123',
 *   employeeId: 'emp_123',
 *   type: 'vacation',
 *   status: 'approved',
 *   startDate: new Date('2024-07-01'),
 *   endDate: new Date('2024-07-05'),
 *   days: 5,
 *   approverId: 'emp_456',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface TimeOff {
  /** Unique identifier */
  id: string

  /** Employee ID */
  employeeId: string

  /** Time off type */
  type: TimeOffType

  /** Status */
  status: TimeOffStatus

  /** Policy ID */
  policyId?: string

  /** Start date */
  startDate: Date

  /** End date */
  endDate: Date

  /** Number of days */
  days?: number

  /** Number of hours */
  hours?: number

  /** Partial day (start time) */
  startTime?: string

  /** Partial day (end time) */
  endTime?: string

  /** Reason/notes */
  reason?: string

  /** Submitted date */
  submittedDate?: Date

  /** Approver ID */
  approverId?: string

  /** Approval date */
  approvalDate?: Date

  /** Denial reason */
  denialReason?: string

  /** Cancellation reason */
  cancellationReason?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    bamboohr?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TimeOffInput = Input<TimeOff>
export type TimeOffOutput = Output<TimeOff>

// =============================================================================
// TimeOffPolicy
// =============================================================================

/**
 * Time off / leave policy.
 *
 * @example
 * ```ts
 * const policy: TimeOffPolicy = {
 *   id: 'pol_123',
 *   name: 'Standard PTO',
 *   type: 'vacation',
 *   accrualRate: 15,
 *   accrualPeriod: 'annual',
 *   maxBalance: 30,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface TimeOffPolicy {
  /** Unique identifier */
  id: string

  /** Policy name */
  name: string

  /** Time off type */
  type: TimeOffType

  /** Description */
  description?: string

  /** Accrual rate (days per period) */
  accrualRate?: number

  /** Accrual period */
  accrualPeriod?: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'annual'

  /** Maximum balance */
  maxBalance?: number

  /** Carryover allowed */
  carryoverAllowed?: boolean

  /** Max carryover days */
  maxCarryover?: number

  /** Waiting period (days) */
  waitingPeriod?: number

  /** Unlimited policy */
  unlimited?: boolean

  /** Applicable employment types */
  applicableEmploymentTypes?: EmploymentType[]

  /** Applicable locations */
  applicableLocations?: string[]

  /** Active status */
  active?: boolean

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    bamboohr?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type TimeOffPolicyInput = Input<TimeOffPolicy>
export type TimeOffPolicyOutput = Output<TimeOffPolicy>

// =============================================================================
// Attendance
// =============================================================================

/**
 * Time and attendance record.
 *
 * @example
 * ```ts
 * const attendance: Attendance = {
 *   id: 'att_123',
 *   employeeId: 'emp_123',
 *   date: new Date('2024-01-15'),
 *   clockIn: new Date('2024-01-15T09:00:00'),
 *   clockOut: new Date('2024-01-15T17:30:00'),
 *   hoursWorked: 8,
 *   status: 'present',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Attendance {
  /** Unique identifier */
  id: string

  /** Employee ID */
  employeeId: string

  /** Date */
  date: Date

  /** Clock in time */
  clockIn?: Date

  /** Clock out time */
  clockOut?: Date

  /** Hours worked */
  hoursWorked?: number

  /** Overtime hours */
  overtimeHours?: number

  /** Status */
  status: 'present' | 'absent' | 'late' | 'half_day' | 'remote' | 'on_leave'

  /** Location */
  location?: string

  /** IP address (for remote clock in) */
  ipAddress?: string

  /** Device info */
  device?: string

  /** Notes */
  notes?: string

  /** Approved by */
  approvedBy?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    adp?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type AttendanceInput = Input<Attendance>
export type AttendanceOutput = Output<Attendance>

// =============================================================================
// Benefit
// =============================================================================

/**
 * Employee benefit offering (health, 401k, etc.).
 *
 * @example
 * ```ts
 * const benefit: Benefit = {
 *   id: 'ben_123',
 *   name: 'Health Insurance - PPO',
 *   type: 'health_insurance',
 *   provider: 'Blue Cross Blue Shield',
 *   description: 'Comprehensive health coverage...',
 *   employeeCost: 200,
 *   employerCost: 600,
 *   currency: 'USD',
 *   active: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Benefit {
  /** Unique identifier */
  id: string

  /** Benefit name */
  name: string

  /** Benefit type */
  type: BenefitType

  /** Provider/carrier */
  provider?: string

  /** Description */
  description?: string

  /** Plan details */
  planDetails?: string

  /** Employee cost per period */
  employeeCost?: number

  /** Employer cost per period */
  employerCost?: number

  /** Currency */
  currency?: string

  /** Cost frequency */
  costFrequency?: 'monthly' | 'annual'

  /** Coverage levels */
  coverageLevels?: Array<{
    level: string
    employeeCost: number
    employerCost: number
  }>

  /** Eligibility requirements */
  eligibilityRequirements?: string[]

  /** Waiting period (days) */
  waitingPeriod?: number

  /** Enrollment period */
  enrollmentPeriod?: {
    startDate: Date
    endDate: Date
  }

  /** Active status */
  active?: boolean

  /** Plan documents */
  documents?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    adp?: string
    zenefits?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BenefitInput = Input<Benefit>
export type BenefitOutput = Output<Benefit>

// =============================================================================
// BenefitEnrollment
// =============================================================================

/**
 * Employee benefit enrollment/election.
 *
 * @example
 * ```ts
 * const enrollment: BenefitEnrollment = {
 *   id: 'enr_123',
 *   employeeId: 'emp_123',
 *   benefitId: 'ben_123',
 *   status: 'enrolled',
 *   coverageLevel: 'employee_plus_family',
 *   startDate: new Date('2024-01-01'),
 *   employeeCost: 200,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface BenefitEnrollment {
  /** Unique identifier */
  id: string

  /** Employee ID */
  employeeId: string

  /** Benefit ID */
  benefitId: string

  /** Enrollment status */
  status: BenefitEnrollmentStatus

  /** Coverage level */
  coverageLevel?: string

  /** Start date */
  startDate?: Date

  /** End date */
  endDate?: Date

  /** Employee cost per period */
  employeeCost?: number

  /** Employer cost per period */
  employerCost?: number

  /** Currency */
  currency?: string

  /** Dependents covered */
  dependents?: Array<{
    name: string
    relationship: string
    dateOfBirth?: Date
  }>

  /** Beneficiaries */
  beneficiaries?: Array<{
    name: string
    relationship: string
    percentage: number
  }>

  /** Enrollment date */
  enrollmentDate?: Date

  /** Termination date */
  terminationDate?: Date

  /** Termination reason */
  terminationReason?: string

  /** Waiver reason */
  waiverReason?: string

  /** Evidence of insurability */
  evidenceOfInsurability?: boolean

  /** Documents */
  documents?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    adp?: string
    zenefits?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type BenefitEnrollmentInput = Input<BenefitEnrollment>
export type BenefitEnrollmentOutput = Output<BenefitEnrollment>

// =============================================================================
// Compensation
// =============================================================================

/**
 * Employee compensation record.
 *
 * @example
 * ```ts
 * const compensation: Compensation = {
 *   id: 'comp_123',
 *   employeeId: 'emp_123',
 *   effectiveDate: new Date('2024-01-01'),
 *   baseSalary: 150000,
 *   currency: 'USD',
 *   payFrequency: 'biweekly',
 *   type: 'salary',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface Compensation {
  /** Unique identifier */
  id: string

  /** Employee ID */
  employeeId: string

  /** Effective date */
  effectiveDate: Date

  /** End date (if changed) */
  endDate?: Date

  /** Compensation type */
  type: CompensationType

  /** Base salary (annual) */
  baseSalary?: number

  /** Hourly rate */
  hourlyRate?: number

  /** Currency */
  currency?: string

  /** Pay frequency */
  payFrequency?: CompensationFrequency

  /** Target bonus percentage */
  targetBonusPercentage?: number

  /** Target bonus amount */
  targetBonusAmount?: number

  /** Commission rate */
  commissionRate?: number

  /** Equity grant */
  equity?: {
    type: 'stock_options' | 'rsu' | 'restricted_stock'
    shares: number
    vestingSchedule?: string
    grantDate?: Date
    strikePrice?: number
  }

  /** Pay grade */
  payGrade?: string

  /** Pay step */
  payStep?: string

  /** Reason for change */
  changeReason?: 'new_hire' | 'promotion' | 'merit_increase' | 'market_adjustment' | 'cost_of_living' | 'other'

  /** Notes */
  notes?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    adp?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CompensationInput = Input<Compensation>
export type CompensationOutput = Output<Compensation>

// =============================================================================
// CompensationChange
// =============================================================================

/**
 * Compensation change/adjustment record.
 *
 * @example
 * ```ts
 * const change: CompensationChange = {
 *   id: 'cc_123',
 *   employeeId: 'emp_123',
 *   effectiveDate: new Date('2024-07-01'),
 *   previousSalary: 150000,
 *   newSalary: 165000,
 *   increaseAmount: 15000,
 *   increasePercentage: 10,
 *   reason: 'merit_increase',
 *   status: 'approved',
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface CompensationChange {
  /** Unique identifier */
  id: string

  /** Employee ID */
  employeeId: string

  /** Effective date */
  effectiveDate: Date

  /** Previous compensation ID */
  previousCompensationId?: string

  /** New compensation ID */
  newCompensationId?: string

  /** Previous salary */
  previousSalary?: number

  /** New salary */
  newSalary?: number

  /** Increase amount */
  increaseAmount?: number

  /** Increase percentage */
  increasePercentage?: number

  /** Currency */
  currency?: string

  /** Change reason */
  reason: 'new_hire' | 'promotion' | 'merit_increase' | 'market_adjustment' | 'cost_of_living' | 'title_change' | 'other'

  /** Status */
  status: 'pending' | 'approved' | 'rejected' | 'implemented'

  /** Requested by */
  requestedById?: string

  /** Request date */
  requestDate?: Date

  /** Approved by */
  approvedById?: string

  /** Approval date */
  approvalDate?: Date

  /** Justification */
  justification?: string

  /** Notes */
  notes?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type CompensationChangeInput = Input<CompensationChange>
export type CompensationChangeOutput = Output<CompensationChange>

// =============================================================================
// EmployeeDocument
// =============================================================================

/**
 * HR document associated with an employee.
 *
 * @example
 * ```ts
 * const document: EmployeeDocument = {
 *   id: 'doc_123',
 *   employeeId: 'emp_123',
 *   type: 'contract',
 *   title: 'Employment Contract',
 *   fileUrl: 'https://example.com/docs/contract.pdf',
 *   uploadedBy: 'emp_hr',
 *   uploadedAt: new Date(),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface EmployeeDocument {
  /** Unique identifier */
  id: string

  /** Employee ID */
  employeeId: string

  /** Document type */
  type: DocumentType

  /** Document title */
  title: string

  /** Description */
  description?: string

  /** File URL */
  fileUrl?: string

  /** File name */
  fileName?: string

  /** File size (bytes) */
  fileSize?: number

  /** MIME type */
  mimeType?: string

  /** Uploaded by */
  uploadedBy?: string

  /** Upload date */
  uploadedAt?: Date

  /** Expiration date */
  expirationDate?: Date

  /** Requires signature */
  requiresSignature?: boolean

  /** Signed */
  signed?: boolean

  /** Signature date */
  signatureDate?: Date

  /** Confidential */
  confidential?: boolean

  /** Tags */
  tags?: string[]

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    docusign?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EmployeeDocumentInput = Input<EmployeeDocument>
export type EmployeeDocumentOutput = Output<EmployeeDocument>

// =============================================================================
// EmergencyContact
// =============================================================================

/**
 * Emergency contact information.
 *
 * @example
 * ```ts
 * const contact: EmergencyContact = {
 *   id: 'ec_123',
 *   employeeId: 'emp_123',
 *   name: 'Jane Doe',
 *   relationship: 'spouse',
 *   phone: '+1-555-0300',
 *   isPrimary: true,
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface EmergencyContact {
  /** Unique identifier */
  id: string

  /** Employee ID */
  employeeId: string

  /** Contact name */
  name: string

  /** Relationship */
  relationship: string

  /** Primary phone */
  phone: string

  /** Alternate phone */
  alternatePhone?: string

  /** Email */
  email?: string

  /** Address */
  address?: {
    street?: string
    street2?: string
    city?: string
    state?: string
    postalCode?: string
    country?: string
  }

  /** Primary contact */
  isPrimary?: boolean

  /** Order/priority */
  priority?: number

  /** Notes */
  notes?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    bamboohr?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EmergencyContactInput = Input<EmergencyContact>
export type EmergencyContactOutput = Output<EmergencyContact>

// =============================================================================
// EmploymentHistory
// =============================================================================

/**
 * Previous employment history.
 *
 * @example
 * ```ts
 * const history: EmploymentHistory = {
 *   id: 'eh_123',
 *   employeeId: 'emp_123',
 *   companyName: 'Previous Company Inc',
 *   jobTitle: 'Software Engineer',
 *   startDate: new Date('2018-01-01'),
 *   endDate: new Date('2020-01-01'),
 *   createdAt: new Date(),
 *   updatedAt: new Date()
 * }
 * ```
 */
export interface EmploymentHistory {
  /** Unique identifier */
  id: string

  /** Employee ID */
  employeeId: string

  /** Company name */
  companyName: string

  /** Job title */
  jobTitle?: string

  /** Start date */
  startDate?: Date

  /** End date */
  endDate?: Date

  /** Location */
  location?: string

  /** Description/responsibilities */
  description?: string

  /** Reason for leaving */
  reasonForLeaving?: string

  /** Manager name */
  managerName?: string

  /** Manager contact */
  managerContact?: string

  /** May contact */
  mayContact?: boolean

  /** Salary */
  salary?: number

  /** Currency */
  currency?: string

  /** Custom fields */
  customFields?: Record<string, unknown>

  /** External system IDs */
  externalIds?: {
    workday?: string
    [key: string]: string | undefined
  }

  /** Metadata */
  metadata?: Record<string, unknown>

  /** Creation timestamp */
  createdAt: Date

  /** Last update timestamp */
  updatedAt: Date
}

export type EmploymentHistoryInput = Input<EmploymentHistory>
export type EmploymentHistoryOutput = Output<EmploymentHistory>

// =============================================================================
// Actions Interfaces
// =============================================================================

export interface EmployeeActions extends CRUDResource<Employee, EmployeeInput> {
  /** Search employees */
  search: Action<{ query: string } & ListParams, PaginatedResult<Employee>>

  /** Update status */
  updateStatus: Action<{ id: string; status: EmploymentStatus }, Employee>

  /** Assign to department */
  assignToDepartment: Action<{ id: string; departmentId: string }, Employee>

  /** Assign to team */
  assignToTeam: Action<{ id: string; teamId: string }, Employee>

  /** Assign manager */
  assignManager: Action<{ id: string; managerId: string }, Employee>

  /** Terminate employment */
  terminate: Action<{ id: string; terminationDate: Date; reason: TerminationReason; notes?: string }, Employee>

  /** Get direct reports */
  getDirectReports: Action<{ id: string }, Employee[]>

  /** Get compensation history */
  getCompensationHistory: Action<{ id: string }, Compensation[]>

  /** Get time off balance */
  getTimeOffBalance: Action<{ id: string; type?: TimeOffType }, Record<string, number>>

  /** Get documents */
  getDocuments: Action<{ id: string } & ListParams, PaginatedResult<EmployeeDocument>>

  /** Get performance reviews */
  getPerformanceReviews: Action<{ id: string } & ListParams, PaginatedResult<PerformanceReview>>
}

export interface ContractorActions extends CRUDResource<Contractor, ContractorInput> {
  /** Search contractors */
  search: Action<{ query: string } & ListParams, PaginatedResult<Contractor>>

  /** Update status */
  updateStatus: Action<{ id: string; status: EmploymentStatus }, Contractor>

  /** Renew contract */
  renewContract: Action<{ id: string; endDate: Date; rate?: number }, Contractor>

  /** End contract */
  endContract: Action<{ id: string; endDate: Date; reason?: string }, Contractor>
}

export interface CandidateActions extends CRUDResource<Candidate, CandidateInput> {
  /** Search candidates */
  search: Action<{ query: string } & ListParams, PaginatedResult<Candidate>>

  /** Update status */
  updateStatus: Action<{ id: string; status: CandidateStatus }, Candidate>

  /** Add tags */
  addTag: Action<{ id: string; tag: string }, Candidate>

  /** Remove tag */
  removeTag: Action<{ id: string; tag: string }, Candidate>

  /** Get applications */
  getApplications: Action<{ id: string }, Application[]>

  /** Convert to employee */
  convertToEmployee: Action<{ id: string; employeeData: EmployeeInput }, Employee>
}

export interface JobPostingActions extends CRUDResource<JobPosting, JobPostingInput> {
  /** Search job postings */
  search: Action<{ query: string } & ListParams, PaginatedResult<JobPosting>>

  /** Update status */
  updateStatus: Action<{ id: string; status: 'draft' | 'open' | 'closed' | 'on_hold' | 'filled' }, JobPosting>

  /** Publish posting */
  publish: Action<{ id: string; sites?: string[] }, JobPosting>

  /** Close posting */
  close: Action<{ id: string; reason?: string }, JobPosting>

  /** Get applications */
  getApplications: Action<{ id: string } & ListParams, PaginatedResult<Application>>
}

export interface ApplicationActions extends CRUDResource<Application, ApplicationInput> {
  /** Search applications */
  search: Action<{ query: string } & ListParams, PaginatedResult<Application>>

  /** Update status */
  updateStatus: Action<{ id: string; status: ApplicationStatus }, Application>

  /** Schedule interview */
  scheduleInterview: Action<{ id: string; interview: InterviewInput }, Interview>

  /** Reject application */
  reject: Action<{ id: string; reason: string }, Application>

  /** Move to next stage */
  moveToNextStage: Action<{ id: string }, Application>
}

export interface InterviewActions extends CRUDResource<Interview, InterviewInput> {
  /** Reschedule interview */
  reschedule: Action<{ id: string; scheduledAt: Date }, Interview>

  /** Cancel interview */
  cancel: Action<{ id: string; reason: string }, Interview>

  /** Submit feedback */
  submitFeedback: Action<{ id: string; recommendation: 'strong_yes' | 'yes' | 'neutral' | 'no' | 'strong_no'; rating?: number; notes?: string; scorecard?: Array<{ criterion: string; rating: number; notes?: string }> }, Interview>

  /** Mark as completed */
  complete: Action<{ id: string }, Interview>
}

export interface OfferActions extends CRUDResource<Offer, OfferInput> {
  /** Send offer */
  send: Action<{ id: string }, Offer>

  /** Accept offer */
  accept: Action<{ id: string; acceptanceDate?: Date }, Offer>

  /** Reject offer */
  reject: Action<{ id: string; reason: string }, Offer>

  /** Withdraw offer */
  withdraw: Action<{ id: string; reason?: string }, Offer>

  /** Extend expiration */
  extendExpiration: Action<{ id: string; newExpirationDate: Date }, Offer>
}

export interface OnboardingActions extends CRUDResource<Onboarding, OnboardingInput> {
  /** Update task status */
  updateTask: Action<{ id: string; taskId: string; completed: boolean }, Onboarding>

  /** Add task */
  addTask: Action<{ id: string; task: { title: string; description?: string; category?: string; assignedTo?: string; dueDate?: Date } }, Onboarding>

  /** Remove task */
  removeTask: Action<{ id: string; taskId: string }, Onboarding>

  /** Complete onboarding */
  complete: Action<{ id: string }, Onboarding>

  /** Get progress */
  getProgress: Action<{ id: string }, { percentage: number; completedTasks: number; totalTasks: number }>
}

export interface DepartmentActions extends CRUDResource<Department, DepartmentInput> {
  /** Get employees */
  getEmployees: Action<{ id: string } & ListParams, PaginatedResult<Employee>>

  /** Get teams */
  getTeams: Action<{ id: string }, Team[]>

  /** Set head */
  setHead: Action<{ id: string; headId: string }, Department>
}

export interface TeamActions extends CRUDResource<Team, TeamInput> {
  /** Get members */
  getMembers: Action<{ id: string }, Employee[]>

  /** Add member */
  addMember: Action<{ id: string; employeeId: string }, Team>

  /** Remove member */
  removeMember: Action<{ id: string; employeeId: string }, Team>

  /** Set lead */
  setLead: Action<{ id: string; leadId: string }, Team>
}

export interface PositionActions extends CRUDResource<Position, PositionInput> {
  /** Get employees in position */
  getEmployees: Action<{ id: string }, Employee[]>

  /** Get open requisitions */
  getOpenRequisitions: Action<{ id: string }, JobPosting[]>
}

export interface PerformanceReviewActions extends CRUDResource<PerformanceReview, PerformanceReviewInput> {
  /** Submit review */
  submit: Action<{ id: string }, PerformanceReview>

  /** Approve review */
  approve: Action<{ id: string }, PerformanceReview>

  /** Employee acknowledge */
  acknowledge: Action<{ id: string }, PerformanceReview>

  /** Get reviews for employee */
  getByEmployee: Action<{ employeeId: string } & ListParams, PaginatedResult<PerformanceReview>>
}

export interface GoalActions extends CRUDResource<Goal, GoalInput> {
  /** Update progress */
  updateProgress: Action<{ id: string; progress: number }, Goal>

  /** Update status */
  updateStatus: Action<{ id: string; status: GoalStatus }, Goal>

  /** Get by employee */
  getByEmployee: Action<{ employeeId: string } & ListParams, PaginatedResult<Goal>>

  /** Get by team */
  getByTeam: Action<{ teamId: string } & ListParams, PaginatedResult<Goal>>

  /** Align goal */
  alignTo: Action<{ id: string; alignedToGoalId: string }, Goal>
}

export interface FeedbackActions extends CRUDResource<Feedback, FeedbackInput> {
  /** Request feedback */
  request: Action<{ employeeId: string; requestFrom: string[]; type: 'peer' | 'upward' | 'downward' | '360' }, Feedback[]>

  /** Submit feedback */
  submit: Action<{ id: string }, Feedback>

  /** Get feedback for employee */
  getByEmployee: Action<{ employeeId: string } & ListParams, PaginatedResult<Feedback>>
}

export interface TrainingActions extends CRUDResource<Training, TrainingInput> {
  /** Assign to employee */
  assignToEmployee: Action<{ id: string; employeeId: string; dueDate?: Date }, { employeeId: string; trainingId: string; status: TrainingStatus }>

  /** Get assigned employees */
  getAssignedEmployees: Action<{ id: string }, Array<{ employeeId: string; status: TrainingStatus; completedAt?: Date }>>

  /** Archive training */
  archive: Action<{ id: string }, Training>
}

export interface CertificationActions extends CRUDResource<Certification, CertificationInput> {
  /** Renew certification */
  renew: Action<{ id: string; expirationDate: Date }, Certification>

  /** Get by employee */
  getByEmployee: Action<{ employeeId: string }, Certification[]>

  /** Get expiring soon */
  getExpiringSoon: Action<{ days: number }, Certification[]>
}

export interface TimeOffActions extends CRUDResource<TimeOff, TimeOffInput> {
  /** Approve request */
  approve: Action<{ id: string; approverId: string }, TimeOff>

  /** Deny request */
  deny: Action<{ id: string; reason: string }, TimeOff>

  /** Cancel request */
  cancel: Action<{ id: string; reason?: string }, TimeOff>

  /** Get by employee */
  getByEmployee: Action<{ employeeId: string; year?: number }, TimeOff[]>

  /** Get pending approvals */
  getPendingApprovals: Action<{ approverId: string }, TimeOff[]>
}

export interface TimeOffPolicyActions extends CRUDResource<TimeOffPolicy, TimeOffPolicyInput> {
  /** Get applicable policies */
  getApplicable: Action<{ employeeId: string }, TimeOffPolicy[]>

  /** Calculate balance */
  calculateBalance: Action<{ employeeId: string; policyId: string }, { accrued: number; used: number; balance: number }>
}

export interface AttendanceActions extends CRUDResource<Attendance, AttendanceInput> {
  /** Clock in */
  clockIn: Action<{ employeeId: string; location?: string }, Attendance>

  /** Clock out */
  clockOut: Action<{ id: string }, Attendance>

  /** Get by employee */
  getByEmployee: Action<{ employeeId: string; startDate?: Date; endDate?: Date }, Attendance[]>

  /** Get by date range */
  getByDateRange: Action<{ startDate: Date; endDate: Date } & ListParams, PaginatedResult<Attendance>>
}

export interface BenefitActions extends CRUDResource<Benefit, BenefitInput> {
  /** Get active benefits */
  getActive: Action<ListParams, PaginatedResult<Benefit>>

  /** Get by type */
  getByType: Action<{ type: BenefitType }, Benefit[]>

  /** Deactivate benefit */
  deactivate: Action<{ id: string }, Benefit>
}

export interface BenefitEnrollmentActions extends CRUDResource<BenefitEnrollment, BenefitEnrollmentInput> {
  /** Enroll employee */
  enroll: Action<{ employeeId: string; benefitId: string; coverageLevel?: string; dependents?: Array<{ name: string; relationship: string; dateOfBirth?: Date }> }, BenefitEnrollment>

  /** Waive benefit */
  waive: Action<{ employeeId: string; benefitId: string; reason: string }, BenefitEnrollment>

  /** Terminate enrollment */
  terminate: Action<{ id: string; terminationDate: Date; reason: string }, BenefitEnrollment>

  /** Get by employee */
  getByEmployee: Action<{ employeeId: string }, BenefitEnrollment[]>

  /** Get by benefit */
  getByBenefit: Action<{ benefitId: string } & ListParams, PaginatedResult<BenefitEnrollment>>
}

export interface CompensationActions extends CRUDResource<Compensation, CompensationInput> {
  /** Get current compensation */
  getCurrent: Action<{ employeeId: string }, Compensation>

  /** Get history */
  getHistory: Action<{ employeeId: string }, Compensation[]>

  /** Update compensation */
  updateCompensation: Action<{ employeeId: string; compensation: CompensationInput; reason: string }, Compensation>
}

export interface CompensationChangeActions extends CRUDResource<CompensationChange, CompensationChangeInput> {
  /** Request change */
  request: Action<{ employeeId: string; newSalary: number; effectiveDate: Date; reason: string; justification?: string }, CompensationChange>

  /** Approve change */
  approve: Action<{ id: string; approverId: string }, CompensationChange>

  /** Reject change */
  reject: Action<{ id: string; approverId: string; reason: string }, CompensationChange>

  /** Implement change */
  implement: Action<{ id: string }, CompensationChange>

  /** Get pending changes */
  getPending: Action<ListParams, PaginatedResult<CompensationChange>>
}

export interface EmployeeDocumentActions extends CRUDResource<EmployeeDocument, EmployeeDocumentInput> {
  /** Upload document */
  upload: Action<{ employeeId: string; type: DocumentType; title: string; file: File | Blob; requiresSignature?: boolean }, EmployeeDocument>

  /** Sign document */
  sign: Action<{ id: string }, EmployeeDocument>

  /** Get by employee */
  getByEmployee: Action<{ employeeId: string; type?: DocumentType } & ListParams, PaginatedResult<EmployeeDocument>>

  /** Get expiring documents */
  getExpiring: Action<{ days: number }, EmployeeDocument[]>
}

export interface EmergencyContactActions extends CRUDResource<EmergencyContact, EmergencyContactInput> {
  /** Get by employee */
  getByEmployee: Action<{ employeeId: string }, EmergencyContact[]>

  /** Set primary */
  setPrimary: Action<{ id: string }, EmergencyContact>
}

export interface EmploymentHistoryActions extends CRUDResource<EmploymentHistory, EmploymentHistoryInput> {
  /** Get by employee */
  getByEmployee: Action<{ employeeId: string }, EmploymentHistory[]>
}

// =============================================================================
// Events
// =============================================================================

export interface EmployeeEvents {
  created: BaseEvent<'employee.created', Employee>
  updated: BaseEvent<'employee.updated', Employee>
  deleted: BaseEvent<'employee.deleted', { id: string }>
  status_changed: BaseEvent<'employee.status_changed', { employeeId: string; oldStatus: EmploymentStatus; newStatus: EmploymentStatus }>
  department_changed: BaseEvent<'employee.department_changed', { employeeId: string; oldDepartmentId?: string; newDepartmentId: string }>
  team_changed: BaseEvent<'employee.team_changed', { employeeId: string; oldTeamId?: string; newTeamId: string }>
  manager_changed: BaseEvent<'employee.manager_changed', { employeeId: string; oldManagerId?: string; newManagerId: string }>
  terminated: BaseEvent<'employee.terminated', { employeeId: string; terminationDate: Date; reason: TerminationReason }>
  anniversary: BaseEvent<'employee.anniversary', { employeeId: string; years: number }>
  birthday: BaseEvent<'employee.birthday', { employeeId: string }>
}

export interface ContractorEvents {
  created: BaseEvent<'contractor.created', Contractor>
  updated: BaseEvent<'contractor.updated', Contractor>
  deleted: BaseEvent<'contractor.deleted', { id: string }>
  status_changed: BaseEvent<'contractor.status_changed', { contractorId: string; oldStatus: EmploymentStatus; newStatus: EmploymentStatus }>
  contract_renewed: BaseEvent<'contractor.contract_renewed', { contractorId: string; newEndDate: Date }>
  contract_ended: BaseEvent<'contractor.contract_ended', { contractorId: string; endDate: Date }>
  contract_expiring: BaseEvent<'contractor.contract_expiring', { contractorId: string; daysUntilExpiration: number }>
}

export interface CandidateEvents {
  created: BaseEvent<'candidate.created', Candidate>
  updated: BaseEvent<'candidate.updated', Candidate>
  deleted: BaseEvent<'candidate.deleted', { id: string }>
  status_changed: BaseEvent<'candidate.status_changed', { candidateId: string; oldStatus: CandidateStatus; newStatus: CandidateStatus }>
  tagged: BaseEvent<'candidate.tagged', { candidateId: string; tag: string }>
  untagged: BaseEvent<'candidate.untagged', { candidateId: string; tag: string }>
  converted_to_employee: BaseEvent<'candidate.converted_to_employee', { candidateId: string; employeeId: string }>
}

export interface JobPostingEvents {
  created: BaseEvent<'job_posting.created', JobPosting>
  updated: BaseEvent<'job_posting.updated', JobPosting>
  deleted: BaseEvent<'job_posting.deleted', { id: string }>
  status_changed: BaseEvent<'job_posting.status_changed', { jobPostingId: string; oldStatus: string; newStatus: string }>
  published: BaseEvent<'job_posting.published', { jobPostingId: string; sites: string[] }>
  closed: BaseEvent<'job_posting.closed', { jobPostingId: string; reason?: string }>
}

export interface ApplicationEvents {
  created: BaseEvent<'application.created', Application>
  updated: BaseEvent<'application.updated', Application>
  deleted: BaseEvent<'application.deleted', { id: string }>
  status_changed: BaseEvent<'application.status_changed', { applicationId: string; oldStatus: ApplicationStatus; newStatus: ApplicationStatus }>
  rejected: BaseEvent<'application.rejected', { applicationId: string; reason: string }>
  moved_to_next_stage: BaseEvent<'application.moved_to_next_stage', { applicationId: string; stage: string }>
}

export interface InterviewEvents {
  created: BaseEvent<'interview.created', Interview>
  updated: BaseEvent<'interview.updated', Interview>
  deleted: BaseEvent<'interview.deleted', { id: string }>
  scheduled: BaseEvent<'interview.scheduled', { interviewId: string; scheduledAt: Date; interviewers: string[] }>
  rescheduled: BaseEvent<'interview.rescheduled', { interviewId: string; oldDate: Date; newDate: Date }>
  cancelled: BaseEvent<'interview.cancelled', { interviewId: string; reason: string }>
  completed: BaseEvent<'interview.completed', { interviewId: string; recommendation?: string }>
  feedback_submitted: BaseEvent<'interview.feedback_submitted', { interviewId: string; interviewerId: string; recommendation: string }>
  reminder: BaseEvent<'interview.reminder', { interviewId: string; hoursUntil: number }>
}

export interface OfferEvents {
  created: BaseEvent<'offer.created', Offer>
  updated: BaseEvent<'offer.updated', Offer>
  deleted: BaseEvent<'offer.deleted', { id: string }>
  sent: BaseEvent<'offer.sent', { offerId: string; candidateId: string }>
  accepted: BaseEvent<'offer.accepted', { offerId: string; candidateId: string; acceptanceDate: Date }>
  rejected: BaseEvent<'offer.rejected', { offerId: string; candidateId: string; reason: string }>
  withdrawn: BaseEvent<'offer.withdrawn', { offerId: string; reason?: string }>
  expiring_soon: BaseEvent<'offer.expiring_soon', { offerId: string; daysUntilExpiration: number }>
  expired: BaseEvent<'offer.expired', { offerId: string }>
}

export interface OnboardingEvents {
  created: BaseEvent<'onboarding.created', Onboarding>
  updated: BaseEvent<'onboarding.updated', Onboarding>
  deleted: BaseEvent<'onboarding.deleted', { id: string }>
  task_completed: BaseEvent<'onboarding.task_completed', { onboardingId: string; taskId: string; completedBy: string }>
  task_added: BaseEvent<'onboarding.task_added', { onboardingId: string; task: { id: string; title: string } }>
  completed: BaseEvent<'onboarding.completed', { onboardingId: string; employeeId: string }>
  overdue: BaseEvent<'onboarding.overdue', { onboardingId: string; employeeId: string }>
}

export interface DepartmentEvents {
  created: BaseEvent<'department.created', Department>
  updated: BaseEvent<'department.updated', Department>
  deleted: BaseEvent<'department.deleted', { id: string }>
  head_changed: BaseEvent<'department.head_changed', { departmentId: string; oldHeadId?: string; newHeadId: string }>
}

export interface TeamEvents {
  created: BaseEvent<'team.created', Team>
  updated: BaseEvent<'team.updated', Team>
  deleted: BaseEvent<'team.deleted', { id: string }>
  member_added: BaseEvent<'team.member_added', { teamId: string; employeeId: string }>
  member_removed: BaseEvent<'team.member_removed', { teamId: string; employeeId: string }>
  lead_changed: BaseEvent<'team.lead_changed', { teamId: string; oldLeadId?: string; newLeadId: string }>
}

export interface PositionEvents {
  created: BaseEvent<'position.created', Position>
  updated: BaseEvent<'position.updated', Position>
  deleted: BaseEvent<'position.deleted', { id: string }>
}

export interface PerformanceReviewEvents {
  created: BaseEvent<'performance_review.created', PerformanceReview>
  updated: BaseEvent<'performance_review.updated', PerformanceReview>
  deleted: BaseEvent<'performance_review.deleted', { id: string }>
  submitted: BaseEvent<'performance_review.submitted', { reviewId: string; employeeId: string }>
  approved: BaseEvent<'performance_review.approved', { reviewId: string; employeeId: string }>
  acknowledged: BaseEvent<'performance_review.acknowledged', { reviewId: string; employeeId: string }>
  due_soon: BaseEvent<'performance_review.due_soon', { reviewId: string; daysUntilDue: number }>
}

export interface GoalEvents {
  created: BaseEvent<'goal.created', Goal>
  updated: BaseEvent<'goal.updated', Goal>
  deleted: BaseEvent<'goal.deleted', { id: string }>
  progress_updated: BaseEvent<'goal.progress_updated', { goalId: string; oldProgress: number; newProgress: number }>
  status_changed: BaseEvent<'goal.status_changed', { goalId: string; oldStatus: GoalStatus; newStatus: GoalStatus }>
  completed: BaseEvent<'goal.completed', { goalId: string }>
  at_risk: BaseEvent<'goal.at_risk', { goalId: string }>
}

export interface FeedbackEvents {
  created: BaseEvent<'feedback.created', Feedback>
  updated: BaseEvent<'feedback.updated', Feedback>
  deleted: BaseEvent<'feedback.deleted', { id: string }>
  requested: BaseEvent<'feedback.requested', { employeeId: string; requestFrom: string[] }>
  submitted: BaseEvent<'feedback.submitted', { feedbackId: string; employeeId: string; providedById?: string }>
}

export interface TrainingEvents {
  created: BaseEvent<'training.created', Training>
  updated: BaseEvent<'training.updated', Training>
  deleted: BaseEvent<'training.deleted', { id: string }>
  assigned: BaseEvent<'training.assigned', { trainingId: string; employeeId: string; dueDate?: Date }>
  completed: BaseEvent<'training.completed', { trainingId: string; employeeId: string }>
  expired: BaseEvent<'training.expired', { trainingId: string; employeeId: string }>
  archived: BaseEvent<'training.archived', { trainingId: string }>
}

export interface CertificationEvents {
  created: BaseEvent<'certification.created', Certification>
  updated: BaseEvent<'certification.updated', Certification>
  deleted: BaseEvent<'certification.deleted', { id: string }>
  renewed: BaseEvent<'certification.renewed', { certificationId: string; newExpirationDate: Date }>
  expiring_soon: BaseEvent<'certification.expiring_soon', { certificationId: string; daysUntilExpiration: number }>
  expired: BaseEvent<'certification.expired', { certificationId: string }>
}

export interface TimeOffEvents {
  created: BaseEvent<'time_off.created', TimeOff>
  updated: BaseEvent<'time_off.updated', TimeOff>
  deleted: BaseEvent<'time_off.deleted', { id: string }>
  submitted: BaseEvent<'time_off.submitted', { timeOffId: string; employeeId: string }>
  approved: BaseEvent<'time_off.approved', { timeOffId: string; employeeId: string; approverId: string }>
  denied: BaseEvent<'time_off.denied', { timeOffId: string; employeeId: string; reason: string }>
  cancelled: BaseEvent<'time_off.cancelled', { timeOffId: string; employeeId: string }>
}

export interface TimeOffPolicyEvents {
  created: BaseEvent<'time_off_policy.created', TimeOffPolicy>
  updated: BaseEvent<'time_off_policy.updated', TimeOffPolicy>
  deleted: BaseEvent<'time_off_policy.deleted', { id: string }>
  activated: BaseEvent<'time_off_policy.activated', { policyId: string }>
  deactivated: BaseEvent<'time_off_policy.deactivated', { policyId: string }>
}

export interface AttendanceEvents {
  created: BaseEvent<'attendance.created', Attendance>
  updated: BaseEvent<'attendance.updated', Attendance>
  deleted: BaseEvent<'attendance.deleted', { id: string }>
  clocked_in: BaseEvent<'attendance.clocked_in', { attendanceId: string; employeeId: string; clockIn: Date }>
  clocked_out: BaseEvent<'attendance.clocked_out', { attendanceId: string; employeeId: string; clockOut: Date; hoursWorked: number }>
  late: BaseEvent<'attendance.late', { attendanceId: string; employeeId: string; minutesLate: number }>
  absent: BaseEvent<'attendance.absent', { employeeId: string; date: Date }>
}

export interface BenefitEvents {
  created: BaseEvent<'benefit.created', Benefit>
  updated: BaseEvent<'benefit.updated', Benefit>
  deleted: BaseEvent<'benefit.deleted', { id: string }>
  activated: BaseEvent<'benefit.activated', { benefitId: string }>
  deactivated: BaseEvent<'benefit.deactivated', { benefitId: string }>
  enrollment_opening: BaseEvent<'benefit.enrollment_opening', { benefitId: string; openDate: Date }>
  enrollment_closing: BaseEvent<'benefit.enrollment_closing', { benefitId: string; closeDate: Date }>
}

export interface BenefitEnrollmentEvents {
  created: BaseEvent<'benefit_enrollment.created', BenefitEnrollment>
  updated: BaseEvent<'benefit_enrollment.updated', BenefitEnrollment>
  deleted: BaseEvent<'benefit_enrollment.deleted', { id: string }>
  enrolled: BaseEvent<'benefit_enrollment.enrolled', { enrollmentId: string; employeeId: string; benefitId: string }>
  waived: BaseEvent<'benefit_enrollment.waived', { enrollmentId: string; employeeId: string; benefitId: string; reason: string }>
  terminated: BaseEvent<'benefit_enrollment.terminated', { enrollmentId: string; employeeId: string; benefitId: string; terminationDate: Date }>
}

export interface CompensationEvents {
  created: BaseEvent<'compensation.created', Compensation>
  updated: BaseEvent<'compensation.updated', Compensation>
  deleted: BaseEvent<'compensation.deleted', { id: string }>
  changed: BaseEvent<'compensation.changed', { employeeId: string; oldCompensation: Compensation; newCompensation: Compensation }>
}

export interface CompensationChangeEvents {
  created: BaseEvent<'compensation_change.created', CompensationChange>
  updated: BaseEvent<'compensation_change.updated', CompensationChange>
  deleted: BaseEvent<'compensation_change.deleted', { id: string }>
  requested: BaseEvent<'compensation_change.requested', { changeId: string; employeeId: string }>
  approved: BaseEvent<'compensation_change.approved', { changeId: string; employeeId: string; approverId: string }>
  rejected: BaseEvent<'compensation_change.rejected', { changeId: string; employeeId: string; reason: string }>
  implemented: BaseEvent<'compensation_change.implemented', { changeId: string; employeeId: string }>
}

export interface EmployeeDocumentEvents {
  created: BaseEvent<'employee_document.created', EmployeeDocument>
  updated: BaseEvent<'employee_document.updated', EmployeeDocument>
  deleted: BaseEvent<'employee_document.deleted', { id: string }>
  uploaded: BaseEvent<'employee_document.uploaded', { documentId: string; employeeId: string; type: DocumentType }>
  signed: BaseEvent<'employee_document.signed', { documentId: string; employeeId: string; signatureDate: Date }>
  expiring_soon: BaseEvent<'employee_document.expiring_soon', { documentId: string; employeeId: string; daysUntilExpiration: number }>
  expired: BaseEvent<'employee_document.expired', { documentId: string; employeeId: string }>
}

export interface EmergencyContactEvents {
  created: BaseEvent<'emergency_contact.created', EmergencyContact>
  updated: BaseEvent<'emergency_contact.updated', EmergencyContact>
  deleted: BaseEvent<'emergency_contact.deleted', { id: string }>
  primary_changed: BaseEvent<'emergency_contact.primary_changed', { employeeId: string; contactId: string }>
}

export interface EmploymentHistoryEvents {
  created: BaseEvent<'employment_history.created', EmploymentHistory>
  updated: BaseEvent<'employment_history.updated', EmploymentHistory>
  deleted: BaseEvent<'employment_history.deleted', { id: string }>
}

// =============================================================================
// Resources
// =============================================================================

export interface EmployeeResource extends EmployeeActions {
  on: <K extends keyof EmployeeEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<EmployeeEvents[K], TProxy>
  ) => () => void
}

export interface ContractorResource extends ContractorActions {
  on: <K extends keyof ContractorEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ContractorEvents[K], TProxy>
  ) => () => void
}

export interface CandidateResource extends CandidateActions {
  on: <K extends keyof CandidateEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CandidateEvents[K], TProxy>
  ) => () => void
}

export interface JobPostingResource extends JobPostingActions {
  on: <K extends keyof JobPostingEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<JobPostingEvents[K], TProxy>
  ) => () => void
}

export interface ApplicationResource extends ApplicationActions {
  on: <K extends keyof ApplicationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<ApplicationEvents[K], TProxy>
  ) => () => void
}

export interface InterviewResource extends InterviewActions {
  on: <K extends keyof InterviewEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<InterviewEvents[K], TProxy>
  ) => () => void
}

export interface OfferResource extends OfferActions {
  on: <K extends keyof OfferEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<OfferEvents[K], TProxy>
  ) => () => void
}

export interface OnboardingResource extends OnboardingActions {
  on: <K extends keyof OnboardingEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<OnboardingEvents[K], TProxy>
  ) => () => void
}

export interface DepartmentResource extends DepartmentActions {
  on: <K extends keyof DepartmentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<DepartmentEvents[K], TProxy>
  ) => () => void
}

export interface TeamResource extends TeamActions {
  on: <K extends keyof TeamEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TeamEvents[K], TProxy>
  ) => () => void
}

export interface PositionResource extends PositionActions {
  on: <K extends keyof PositionEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PositionEvents[K], TProxy>
  ) => () => void
}

export interface PerformanceReviewResource extends PerformanceReviewActions {
  on: <K extends keyof PerformanceReviewEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<PerformanceReviewEvents[K], TProxy>
  ) => () => void
}

export interface GoalResource extends GoalActions {
  on: <K extends keyof GoalEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<GoalEvents[K], TProxy>
  ) => () => void
}

export interface FeedbackResource extends FeedbackActions {
  on: <K extends keyof FeedbackEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<FeedbackEvents[K], TProxy>
  ) => () => void
}

export interface TrainingResource extends TrainingActions {
  on: <K extends keyof TrainingEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TrainingEvents[K], TProxy>
  ) => () => void
}

export interface CertificationResource extends CertificationActions {
  on: <K extends keyof CertificationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CertificationEvents[K], TProxy>
  ) => () => void
}

export interface TimeOffResource extends TimeOffActions {
  on: <K extends keyof TimeOffEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TimeOffEvents[K], TProxy>
  ) => () => void
}

export interface TimeOffPolicyResource extends TimeOffPolicyActions {
  on: <K extends keyof TimeOffPolicyEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<TimeOffPolicyEvents[K], TProxy>
  ) => () => void
}

export interface AttendanceResource extends AttendanceActions {
  on: <K extends keyof AttendanceEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<AttendanceEvents[K], TProxy>
  ) => () => void
}

export interface BenefitResource extends BenefitActions {
  on: <K extends keyof BenefitEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<BenefitEvents[K], TProxy>
  ) => () => void
}

export interface BenefitEnrollmentResource extends BenefitEnrollmentActions {
  on: <K extends keyof BenefitEnrollmentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<BenefitEnrollmentEvents[K], TProxy>
  ) => () => void
}

export interface CompensationResource extends CompensationActions {
  on: <K extends keyof CompensationEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CompensationEvents[K], TProxy>
  ) => () => void
}

export interface CompensationChangeResource extends CompensationChangeActions {
  on: <K extends keyof CompensationChangeEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<CompensationChangeEvents[K], TProxy>
  ) => () => void
}

export interface EmployeeDocumentResource extends EmployeeDocumentActions {
  on: <K extends keyof EmployeeDocumentEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<EmployeeDocumentEvents[K], TProxy>
  ) => () => void
}

export interface EmergencyContactResource extends EmergencyContactActions {
  on: <K extends keyof EmergencyContactEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<EmergencyContactEvents[K], TProxy>
  ) => () => void
}

export interface EmploymentHistoryResource extends EmploymentHistoryActions {
  on: <K extends keyof EmploymentHistoryEvents, TProxy = unknown>(
    event: K,
    handler: EventHandler<EmploymentHistoryEvents[K], TProxy>
  ) => () => void
}

// =============================================================================
// HR Proxy (unified interface)
// =============================================================================

/**
 * Complete HR & People interface combining all resources.
 *
 * @example
 * ```ts
 * const hr: HRProxy = getHRProxy()
 *
 * // Create an employee
 * const employee = await hr.employees.create({
 *   firstName: 'Jane',
 *   lastName: 'Smith',
 *   email: 'jane.smith@company.com',
 *   status: 'active',
 *   employmentType: 'full_time',
 *   departmentId: 'dept_eng',
 *   hireDate: new Date()
 * })
 *
 * // Subscribe to events
 * hr.employees.on('created', (event, ctx) => {
 *   console.log('New employee:', event.data.email)
 * })
 *
 * // Create time off request
 * const timeOff = await hr.timeOff.create({
 *   employeeId: employee.id,
 *   type: 'vacation',
 *   status: 'pending',
 *   startDate: new Date('2024-07-01'),
 *   endDate: new Date('2024-07-05'),
 *   days: 5
 * })
 *
 * // Approve time off
 * await hr.timeOff.approve({
 *   id: timeOff.id,
 *   approverId: 'emp_manager'
 * })
 * ```
 */
export interface HRProxy {
  employees: EmployeeResource
  contractors: ContractorResource
  candidates: CandidateResource
  jobPostings: JobPostingResource
  applications: ApplicationResource
  interviews: InterviewResource
  offers: OfferResource
  onboarding: OnboardingResource
  departments: DepartmentResource
  teams: TeamResource
  positions: PositionResource
  performanceReviews: PerformanceReviewResource
  goals: GoalResource
  feedback: FeedbackResource
  training: TrainingResource
  certifications: CertificationResource
  timeOff: TimeOffResource
  timeOffPolicies: TimeOffPolicyResource
  attendance: AttendanceResource
  benefits: BenefitResource
  benefitEnrollments: BenefitEnrollmentResource
  compensation: CompensationResource
  compensationChanges: CompensationChangeResource
  employeeDocuments: EmployeeDocumentResource
  emergencyContacts: EmergencyContactResource
  employmentHistory: EmploymentHistoryResource
}

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Supported HR providers.
 */
export type HRProvider =
  | 'workday'
  | 'bamboohr'
  | 'adp'
  | 'gusto'
  | 'rippling'
  | 'zenefits'
  | 'namely'
  | 'paycor'
  | 'paylocity'
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'lattice'
  | 'cultureamp'

/**
 * Provider configuration.
 */
export interface HRProviderConfig {
  provider: HRProvider
  apiKey?: string
  accessToken?: string
  refreshToken?: string
  instanceUrl?: string
  apiVersion?: string
  tenantId?: string
}
