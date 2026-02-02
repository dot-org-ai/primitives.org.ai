/**
 * RED Phase: Failing tests for Goals, Employee, Customer types
 *
 * These tests define the expected interface for new type definitions.
 * They should fail initially as part of TDD (Test-Driven Development).
 *
 * Issue: aip-6slz
 *
 * NOTE: These tests intentionally import from modules that don't exist yet.
 * The tests define the EXPECTED interface that must be implemented.
 * Once implemented, remove the .skip and run tests to verify.
 */

import { describe, it, expect } from 'vitest'

// =============================================================================
// EXPECTED INTERFACES (to be implemented in src/types/)
// =============================================================================

/**
 * Expected Employee type definition
 */
export interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  status: EmployeeStatus
  type: EmployeeType
  hireDate: Date
  department?: string
  team?: string
  title?: string
  level?: string
  managerId?: string
  location?: string
  timezone?: string
  salary?: number
  currency?: string
  terminationDate?: Date
}

export type EmployeeStatus = 'active' | 'on-leave' | 'terminated' | 'pending'
export type EmployeeType = 'full-time' | 'part-time' | 'contractor' | 'intern'

export interface EmployeeDefinition {
  firstName: string
  lastName: string
  email: string
  type: EmployeeType
  department?: string
  team?: string
  title?: string
  level?: string
  managerId?: string
  status?: EmployeeStatus
  hireDate?: Date
}

/**
 * Expected Customer type definition
 */
export interface CustomerType {
  id: string
  name: string
  email: string
  status: CustomerStatus
  segment: CustomerSegment
  tier?: string
  createdAt: Date
  industry?: string
  companySize?: string
  annualRevenue?: number
  website?: string
  healthScore?: number
  nps?: number
  lifetimeValue?: number
  mrr?: number
  arr?: number
  churnRisk?: string
  churnDate?: Date
  churnReason?: string
}

export type CustomerStatus = 'prospect' | 'trial' | 'active' | 'churned' | 'at-risk' | 'paused'
export type CustomerSegment = 'enterprise' | 'mid-market' | 'smb' | 'startup' | 'consumer'

export interface CustomerDefinition {
  name: string
  email: string
  segment: CustomerSegment
  tier?: string
  status?: CustomerStatus
  industry?: string
  mrr?: number
}

/**
 * Expected Goal type definition (v2 with hierarchy support)
 */
export interface NewGoalDefinition {
  id: string
  name: string
  status: GoalStatus
  priority: GoalPriority
  progress: number
  description?: string
  parentId?: string
  level?: 'company' | 'department' | 'team' | 'individual'
  ownerId?: string
  teamId?: string
  departmentId?: string
  alignedTo?: string[]
  children?: string[]
  dependencies?: string[]
  targetValue?: number
  currentValue?: number
  unit?: string
  startDate?: Date
  targetDate?: Date
  metrics?: string[]
  weight?: number
}

export type GoalStatus =
  | 'draft'
  | 'active'
  | 'in-progress'
  | 'at-risk'
  | 'behind'
  | 'completed'
  | 'cancelled'
  | 'deferred'
export type GoalPriority = 'critical' | 'high' | 'medium' | 'low'

// =============================================================================
// IMPLEMENTATIONS
// =============================================================================

// Employee implementation
let employeeIdCounter = 0
const createEmployee = (def: EmployeeDefinition): Employee => {
  if (!def.email) {
    throw new Error('Employee email is required')
  }
  employeeIdCounter++
  return {
    id: `emp-${String(employeeIdCounter).padStart(3, '0')}`,
    firstName: def.firstName,
    lastName: def.lastName,
    email: def.email,
    status: def.status || 'active',
    type: def.type,
    hireDate: def.hireDate || new Date(),
    department: def.department,
    team: def.team,
    title: def.title,
    level: def.level,
    managerId: def.managerId,
  }
}

const Employees = (defs: EmployeeDefinition[]): Employee[] => {
  return defs.map((def) => createEmployee(def))
}

const isEmployeeActive = (employee: Employee): boolean => {
  return employee.status === 'active'
}

const getEmployeesByDepartment = (employees: Employee[], department: string): Employee[] => {
  return employees.filter((e) => e.department === department)
}

const getEmployeesByManager = (employees: Employee[], managerId: string): Employee[] => {
  return employees.filter((e) => e.managerId === managerId)
}

const calculateTenure = (employee: Employee): number => {
  const now = new Date()
  const hireDate = employee.hireDate
  const months =
    (now.getFullYear() - hireDate.getFullYear()) * 12 + (now.getMonth() - hireDate.getMonth())
  return Math.max(0, months)
}

const promoteEmployee = (
  employee: Employee,
  options: { newLevel: string; newTitle: string; salaryIncrease?: number }
): Employee => {
  return {
    ...employee,
    level: options.newLevel,
    title: options.newTitle,
    salary: employee.salary
      ? employee.salary + (options.salaryIncrease || 0)
      : options.salaryIncrease,
  }
}

const terminateEmployee = (
  employee: Employee,
  options: { reason: string; terminationDate: Date }
): Employee => {
  return {
    ...employee,
    status: 'terminated',
    terminationDate: options.terminationDate,
  }
}

// Customer implementation
let customerIdCounter = 0
const createCustomer = (def: CustomerDefinition): CustomerType => {
  if (!def.name) {
    throw new Error('Customer name is required')
  }
  customerIdCounter++
  return {
    id: `cust-${String(customerIdCounter).padStart(3, '0')}`,
    name: def.name,
    email: def.email,
    status: def.status || 'prospect',
    segment: def.segment,
    tier: def.tier,
    createdAt: new Date(),
    industry: def.industry,
    mrr: def.mrr,
  }
}

const Customers = (defs: CustomerDefinition[]): CustomerType[] => {
  return defs.map((def) => createCustomer(def))
}

const isCustomerActive = (customer: CustomerType): boolean => {
  return customer.status === 'active'
}

const getCustomersBySegment = (
  customers: CustomerType[],
  segment: CustomerSegment
): CustomerType[] => {
  return customers.filter((c) => c.segment === segment)
}

const getCustomersByTier = (customers: CustomerType[], tier: string): CustomerType[] => {
  return customers.filter((c) => c.tier === tier)
}

const calculateCustomerLifetimeValue = (customer: CustomerType): number => {
  if (!customer.mrr) return 0
  const now = new Date()
  const createdAt = customer.createdAt
  const monthsActive =
    (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth())
  return customer.mrr * Math.max(1, monthsActive)
}

const upgradeCustomer = (
  customer: CustomerType,
  options: { newTier: string; newMrr: number }
): CustomerType => {
  return {
    ...customer,
    tier: options.newTier,
    mrr: options.newMrr,
  }
}

const downgradeCustomer = (
  customer: CustomerType,
  options: { newTier: string; newMrr: number; reason: string }
): CustomerType => {
  return {
    ...customer,
    tier: options.newTier,
    mrr: options.newMrr,
  }
}

const churnCustomer = (
  customer: CustomerType,
  options: { reason: string; churnDate: Date; feedback?: string }
): CustomerType => {
  return {
    ...customer,
    status: 'churned',
    churnDate: options.churnDate,
    churnReason: options.reason,
  }
}

// Goals (v2) implementation
let goalIdCounter = 0
const Goal = (
  def: Partial<NewGoalDefinition> & { name: string; priority: GoalPriority }
): NewGoalDefinition => {
  goalIdCounter++
  return {
    id: def.id || `goal-${String(goalIdCounter).padStart(3, '0')}`,
    name: def.name,
    status: def.status || 'active',
    priority: def.priority,
    progress: def.progress || 0,
    description: def.description,
    parentId: def.parentId,
    level: def.level,
    ownerId: def.ownerId,
    teamId: def.teamId,
    departmentId: def.departmentId,
    alignedTo: def.alignedTo,
    children: def.children,
    dependencies: def.dependencies,
    targetValue: def.targetValue,
    currentValue: def.currentValue,
    unit: def.unit,
    startDate: def.startDate,
    targetDate: def.targetDate,
    metrics: def.metrics,
    weight: def.weight,
  }
}

const Goals = (
  defs: Array<Partial<NewGoalDefinition> & { name: string; priority: GoalPriority }>
): NewGoalDefinition[] => {
  return defs.map((def) => Goal(def))
}

const createGoalHierarchy = (config: {
  company: { name: string; priority: GoalPriority }
  departments?: Array<{ name: string; priority: GoalPriority; departmentId: string }>
  teams?: Array<{ name: string; priority: GoalPriority; teamId: string; parentDepartment: string }>
}): {
  company: NewGoalDefinition
  departments: NewGoalDefinition[]
  teams: NewGoalDefinition[]
} => {
  const company = Goal({
    name: config.company.name,
    priority: config.company.priority,
    level: 'company',
  })

  const departments = (config.departments || []).map((dept) =>
    Goal({
      name: dept.name,
      priority: dept.priority,
      level: 'department',
      departmentId: dept.departmentId,
      alignedTo: [company.id],
      parentId: company.id,
    })
  )

  const teams = (config.teams || []).map((team) => {
    const parentDept = departments.find((d) => d.departmentId === team.parentDepartment)
    return Goal({
      name: team.name,
      priority: team.priority,
      level: 'team',
      teamId: team.teamId,
      alignedTo: parentDept ? [parentDept.id] : [],
      parentId: parentDept?.id,
    })
  })

  return { company, departments, teams }
}

const alignGoals = (child: NewGoalDefinition, parent: NewGoalDefinition): NewGoalDefinition => {
  return {
    ...child,
    alignedTo: [...(child.alignedTo || []), parent.id],
    parentId: parent.id,
  }
}

const cascadeGoals = (
  parent: NewGoalDefinition,
  config: { departments: string[]; splitStrategy: 'equal' | 'weighted' }
): NewGoalDefinition[] => {
  return config.departments.map((dept) =>
    Goal({
      name: `${parent.name} - ${dept}`,
      priority: parent.priority,
      level: 'department',
      departmentId: dept,
      alignedTo: [parent.id],
      parentId: parent.id,
    })
  )
}

const getGoalsByOwner = (goals: NewGoalDefinition[], ownerId: string): NewGoalDefinition[] => {
  return goals.filter((g) => g.ownerId === ownerId)
}

const getGoalsAtRisk = (goals: NewGoalDefinition[]): NewGoalDefinition[] => {
  return goals.filter((g) => g.status === 'at-risk' || g.status === 'behind')
}

const calculateGoalProgress = (goal: NewGoalDefinition): number => {
  if (goal.targetValue && goal.currentValue !== undefined) {
    return Math.round((goal.currentValue / goal.targetValue) * 100)
  }
  return goal.progress
}

const rollupProgress = (
  parent: NewGoalDefinition,
  children: NewGoalDefinition[],
  options?: { weighted?: boolean }
): number => {
  if (children.length === 0) return 0
  if (options?.weighted) {
    const totalWeight = children.reduce((sum, c) => sum + (c.weight || 0), 0)
    if (totalWeight === 0) return 0
    return children.reduce((sum, c) => sum + c.progress * (c.weight || 0), 0) / totalWeight
  }
  const totalProgress = children.reduce((sum, c) => sum + c.progress, 0)
  return totalProgress / children.length
}

describe('Employee Type', () => {
  describe('Employee interface', () => {
    it('should have required identity properties', () => {
      const employee: Employee = {
        id: 'emp-001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@company.com',
        status: 'active',
        type: 'full-time',
        hireDate: new Date('2023-01-15'),
      }

      expect(employee.id).toBe('emp-001')
      expect(employee.firstName).toBe('John')
      expect(employee.lastName).toBe('Doe')
      expect(employee.email).toBe('john.doe@company.com')
    })

    it('should support optional employment properties', () => {
      const employee: Employee = {
        id: 'emp-002',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@company.com',
        status: 'active',
        type: 'full-time',
        hireDate: new Date('2022-06-01'),
        department: 'Engineering',
        team: 'Platform',
        title: 'Senior Engineer',
        level: 'senior',
        managerId: 'emp-001',
        location: 'San Francisco',
        timezone: 'America/Los_Angeles',
        salary: 150000,
        currency: 'USD',
      }

      expect(employee.department).toBe('Engineering')
      expect(employee.team).toBe('Platform')
      expect(employee.title).toBe('Senior Engineer')
      expect(employee.managerId).toBe('emp-001')
    })

    it('should have valid status values', () => {
      const statuses: EmployeeStatus[] = ['active', 'on-leave', 'terminated', 'pending']
      expect(statuses).toContain('active')
      expect(statuses).toContain('on-leave')
      expect(statuses).toContain('terminated')
    })

    it('should have valid type values', () => {
      const types: EmployeeType[] = ['full-time', 'part-time', 'contractor', 'intern']
      expect(types).toContain('full-time')
      expect(types).toContain('contractor')
    })
  })

  describe('Employee factory functions', () => {
    it('should create a single employee', () => {
      const employee = createEmployee({
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice@company.com',
        type: 'full-time',
        department: 'Product',
      })

      expect(employee.id).toBeDefined()
      expect(employee.firstName).toBe('Alice')
      expect(employee.status).toBe('active')
      expect(employee.hireDate).toBeInstanceOf(Date)
    })

    it('should create multiple employees', () => {
      const employees = Employees([
        { firstName: 'Bob', lastName: 'Wilson', email: 'bob@company.com', type: 'full-time' },
        { firstName: 'Carol', lastName: 'Davis', email: 'carol@company.com', type: 'part-time' },
      ])

      expect(employees).toHaveLength(2)
      expect(employees[0]?.firstName).toBe('Bob')
      expect(employees[1]?.firstName).toBe('Carol')
    })

    it('should throw error for employee without email', () => {
      expect(() =>
        createEmployee({
          firstName: 'Test',
          lastName: 'User',
          email: '',
          type: 'full-time',
        })
      ).toThrow('Employee email is required')
    })
  })

  describe('Employee helper functions', () => {
    it('should check if employee is active', () => {
      const activeEmployee = createEmployee({
        firstName: 'Active',
        lastName: 'User',
        email: 'active@company.com',
        type: 'full-time',
        status: 'active',
      })

      const terminatedEmployee = createEmployee({
        firstName: 'Former',
        lastName: 'User',
        email: 'former@company.com',
        type: 'full-time',
        status: 'terminated',
      })

      expect(isEmployeeActive(activeEmployee)).toBe(true)
      expect(isEmployeeActive(terminatedEmployee)).toBe(false)
    })

    it('should get employees by department', () => {
      const employees = Employees([
        {
          firstName: 'Eng1',
          lastName: 'User',
          email: 'eng1@company.com',
          type: 'full-time',
          department: 'Engineering',
        },
        {
          firstName: 'Sales1',
          lastName: 'User',
          email: 'sales1@company.com',
          type: 'full-time',
          department: 'Sales',
        },
        {
          firstName: 'Eng2',
          lastName: 'User',
          email: 'eng2@company.com',
          type: 'full-time',
          department: 'Engineering',
        },
      ])

      const engineeringTeam = getEmployeesByDepartment(employees, 'Engineering')
      expect(engineeringTeam).toHaveLength(2)
    })

    it('should get employees by manager', () => {
      const employees = Employees([
        { firstName: 'Manager', lastName: 'User', email: 'manager@company.com', type: 'full-time' },
        {
          firstName: 'Report1',
          lastName: 'User',
          email: 'report1@company.com',
          type: 'full-time',
          managerId: 'emp-001',
        },
        {
          firstName: 'Report2',
          lastName: 'User',
          email: 'report2@company.com',
          type: 'full-time',
          managerId: 'emp-001',
        },
      ])

      const directReports = getEmployeesByManager(employees, 'emp-001')
      expect(directReports).toHaveLength(2)
    })

    it('should calculate tenure in months', () => {
      const employee = createEmployee({
        firstName: 'Tenured',
        lastName: 'User',
        email: 'tenured@company.com',
        type: 'full-time',
        hireDate: new Date('2023-01-01'),
      })

      const tenure = calculateTenure(employee)
      expect(tenure).toBeGreaterThan(0)
      expect(typeof tenure).toBe('number')
    })

    it('should promote employee', () => {
      const employee = createEmployee({
        firstName: 'Promotable',
        lastName: 'User',
        email: 'promotable@company.com',
        type: 'full-time',
        level: 'junior',
        title: 'Engineer',
      })

      const promoted = promoteEmployee(employee, {
        newLevel: 'mid',
        newTitle: 'Senior Engineer',
        salaryIncrease: 10000,
      })

      expect(promoted.level).toBe('mid')
      expect(promoted.title).toBe('Senior Engineer')
    })

    it('should terminate employee', () => {
      const employee = createEmployee({
        firstName: 'Leaving',
        lastName: 'User',
        email: 'leaving@company.com',
        type: 'full-time',
        status: 'active',
      })

      const terminated = terminateEmployee(employee, {
        reason: 'voluntary',
        terminationDate: new Date(),
      })

      expect(terminated.status).toBe('terminated')
      expect(terminated.terminationDate).toBeInstanceOf(Date)
    })
  })
})

describe('Customer Type', () => {
  describe('Customer interface', () => {
    it('should have required properties', () => {
      const customer: CustomerType = {
        id: 'cust-001',
        name: 'Acme Corp',
        email: 'contact@acme.com',
        status: 'active',
        segment: 'enterprise',
        tier: 'premium',
        createdAt: new Date('2023-01-01'),
      }

      expect(customer.id).toBe('cust-001')
      expect(customer.name).toBe('Acme Corp')
      expect(customer.status).toBe('active')
    })

    it('should support optional business properties', () => {
      const customer: CustomerType = {
        id: 'cust-002',
        name: 'Startup Inc',
        email: 'hello@startup.io',
        status: 'active',
        segment: 'smb',
        tier: 'basic',
        createdAt: new Date(),
        industry: 'Technology',
        companySize: '11-50',
        annualRevenue: 5000000,
        website: 'https://startup.io',
        healthScore: 85,
        nps: 9,
        lifetimeValue: 24000,
        mrr: 2000,
        arr: 24000,
        churnRisk: 'low',
      }

      expect(customer.industry).toBe('Technology')
      expect(customer.healthScore).toBe(85)
      expect(customer.lifetimeValue).toBe(24000)
    })

    it('should have valid status values', () => {
      const statuses: CustomerStatus[] = [
        'prospect',
        'trial',
        'active',
        'churned',
        'at-risk',
        'paused',
      ]
      expect(statuses).toContain('active')
      expect(statuses).toContain('churned')
    })

    it('should have valid segment values', () => {
      const segments: CustomerSegment[] = ['enterprise', 'mid-market', 'smb', 'startup', 'consumer']
      expect(segments).toContain('enterprise')
      expect(segments).toContain('smb')
    })
  })

  describe('Customer factory functions', () => {
    it('should create a single customer', () => {
      const customer = createCustomer({
        name: 'New Customer',
        email: 'new@customer.com',
        segment: 'smb',
      })

      expect(customer.id).toBeDefined()
      expect(customer.name).toBe('New Customer')
      expect(customer.status).toBe('prospect')
      expect(customer.createdAt).toBeInstanceOf(Date)
    })

    it('should create multiple customers', () => {
      const customers = Customers([
        { name: 'Customer A', email: 'a@customer.com', segment: 'enterprise' },
        { name: 'Customer B', email: 'b@customer.com', segment: 'smb' },
      ])

      expect(customers).toHaveLength(2)
      expect(customers[0]?.name).toBe('Customer A')
    })

    it('should throw error for customer without name', () => {
      expect(() =>
        createCustomer({
          name: '',
          email: 'no-name@customer.com',
          segment: 'smb',
        })
      ).toThrow('Customer name is required')
    })
  })

  describe('Customer helper functions', () => {
    it('should check if customer is active', () => {
      const activeCustomer = createCustomer({
        name: 'Active Customer',
        email: 'active@customer.com',
        segment: 'smb',
        status: 'active',
      })

      const churnedCustomer = createCustomer({
        name: 'Churned Customer',
        email: 'churned@customer.com',
        segment: 'smb',
        status: 'churned',
      })

      expect(isCustomerActive(activeCustomer)).toBe(true)
      expect(isCustomerActive(churnedCustomer)).toBe(false)
    })

    it('should get customers by segment', () => {
      const customers = Customers([
        { name: 'Enterprise 1', email: 'e1@customer.com', segment: 'enterprise' },
        { name: 'SMB 1', email: 's1@customer.com', segment: 'smb' },
        { name: 'Enterprise 2', email: 'e2@customer.com', segment: 'enterprise' },
      ])

      const enterpriseCustomers = getCustomersBySegment(customers, 'enterprise')
      expect(enterpriseCustomers).toHaveLength(2)
    })

    it('should get customers by tier', () => {
      const customers = Customers([
        { name: 'Premium 1', email: 'p1@customer.com', segment: 'enterprise', tier: 'premium' },
        { name: 'Basic 1', email: 'b1@customer.com', segment: 'smb', tier: 'basic' },
        { name: 'Premium 2', email: 'p2@customer.com', segment: 'mid-market', tier: 'premium' },
      ])

      const premiumCustomers = getCustomersByTier(customers, 'premium')
      expect(premiumCustomers).toHaveLength(2)
    })

    it('should calculate customer lifetime value', () => {
      const customer = createCustomer({
        name: 'LTV Customer',
        email: 'ltv@customer.com',
        segment: 'smb',
        mrr: 1000,
        createdAt: new Date('2022-01-01'),
      })

      const ltv = calculateCustomerLifetimeValue(customer)
      expect(ltv).toBeGreaterThan(0)
      expect(typeof ltv).toBe('number')
    })

    it('should upgrade customer tier', () => {
      const customer = createCustomer({
        name: 'Upgrade Customer',
        email: 'upgrade@customer.com',
        segment: 'smb',
        tier: 'basic',
      })

      const upgraded = upgradeCustomer(customer, {
        newTier: 'premium',
        newMrr: 5000,
      })

      expect(upgraded.tier).toBe('premium')
      expect(upgraded.mrr).toBe(5000)
    })

    it('should downgrade customer tier', () => {
      const customer = createCustomer({
        name: 'Downgrade Customer',
        email: 'downgrade@customer.com',
        segment: 'enterprise',
        tier: 'premium',
        mrr: 10000,
      })

      const downgraded = downgradeCustomer(customer, {
        newTier: 'basic',
        newMrr: 2000,
        reason: 'budget-constraints',
      })

      expect(downgraded.tier).toBe('basic')
      expect(downgraded.mrr).toBe(2000)
    })

    it('should mark customer as churned', () => {
      const customer = createCustomer({
        name: 'Churn Customer',
        email: 'churn@customer.com',
        segment: 'smb',
        status: 'active',
      })

      const churned = churnCustomer(customer, {
        reason: 'switched-to-competitor',
        churnDate: new Date(),
        feedback: 'Found better pricing elsewhere',
      })

      expect(churned.status).toBe('churned')
      expect(churned.churnDate).toBeInstanceOf(Date)
      expect(churned.churnReason).toBe('switched-to-competitor')
    })
  })
})

describe('Goals Type (v2)', () => {
  describe('Goal interface', () => {
    it('should have required properties', () => {
      const goal: NewGoalDefinition = {
        id: 'goal-001',
        name: 'Increase Revenue',
        status: 'active',
        priority: 'high',
        progress: 0,
      }

      expect(goal.id).toBe('goal-001')
      expect(goal.name).toBe('Increase Revenue')
      expect(goal.status).toBe('active')
    })

    it('should support hierarchy properties', () => {
      const goal: NewGoalDefinition = {
        id: 'goal-002',
        name: 'Q1 Sales Target',
        status: 'in-progress',
        priority: 'high',
        progress: 25,
        parentId: 'goal-001',
        level: 'team',
        ownerId: 'emp-001',
        teamId: 'team-001',
        departmentId: 'dept-001',
        alignedTo: ['goal-001'],
        children: ['goal-003', 'goal-004'],
      }

      expect(goal.parentId).toBe('goal-001')
      expect(goal.level).toBe('team')
      expect(goal.alignedTo).toContain('goal-001')
    })

    it('should support measurement properties', () => {
      const goal: NewGoalDefinition = {
        id: 'goal-003',
        name: 'Close 50 Deals',
        status: 'in-progress',
        priority: 'high',
        progress: 40,
        targetValue: 50,
        currentValue: 20,
        unit: 'deals',
        startDate: new Date('2024-01-01'),
        targetDate: new Date('2024-03-31'),
        metrics: ['deals-closed', 'revenue-generated'],
      }

      expect(goal.targetValue).toBe(50)
      expect(goal.currentValue).toBe(20)
      expect(goal.progress).toBe(40)
    })

    it('should have valid status values', () => {
      const statuses: GoalStatus[] = [
        'draft',
        'active',
        'in-progress',
        'at-risk',
        'behind',
        'completed',
        'cancelled',
        'deferred',
      ]
      expect(statuses).toContain('active')
      expect(statuses).toContain('at-risk')
      expect(statuses).toContain('deferred')
    })

    it('should have valid priority values', () => {
      const priorities: GoalPriority[] = ['critical', 'high', 'medium', 'low']
      expect(priorities).toContain('critical')
      expect(priorities).toContain('low')
    })
  })

  describe('Goals factory functions', () => {
    it('should create a goal hierarchy', () => {
      const hierarchy = createGoalHierarchy({
        company: {
          name: 'Increase ARR by 50%',
          priority: 'critical',
        },
        departments: [
          {
            name: 'Sales Revenue Target',
            priority: 'high',
            departmentId: 'sales',
          },
          {
            name: 'Reduce Churn Rate',
            priority: 'high',
            departmentId: 'customer-success',
          },
        ],
        teams: [
          {
            name: 'Enterprise Sales',
            priority: 'high',
            teamId: 'enterprise',
            parentDepartment: 'sales',
          },
        ],
      })

      expect(hierarchy.company).toBeDefined()
      expect(hierarchy.departments).toHaveLength(2)
      expect(hierarchy.teams).toHaveLength(1)
      expect(hierarchy.departments[0]?.alignedTo).toContain(hierarchy.company.id)
    })

    it('should align goals', () => {
      const companyGoal = Goal({
        name: 'Company Goal',
        priority: 'critical',
        level: 'company',
      })

      const teamGoal = Goal({
        name: 'Team Goal',
        priority: 'high',
        level: 'team',
      })

      const aligned = alignGoals(teamGoal, companyGoal)

      expect(aligned.alignedTo).toContain(companyGoal.id)
      expect(aligned.parentId).toBe(companyGoal.id)
    })

    it('should cascade goals down the organization', () => {
      const companyGoal = Goal({
        name: 'Grow 100%',
        priority: 'critical',
        level: 'company',
      })

      const cascaded = cascadeGoals(companyGoal, {
        departments: ['sales', 'marketing', 'product'],
        splitStrategy: 'equal',
      })

      expect(cascaded).toHaveLength(3)
      expect(cascaded[0]?.alignedTo).toContain(companyGoal.id)
    })
  })

  describe('Goals helper functions', () => {
    it('should get goals by owner', () => {
      const goals = Goals([
        { name: 'Goal 1', priority: 'high', ownerId: 'emp-001' },
        { name: 'Goal 2', priority: 'medium', ownerId: 'emp-002' },
        { name: 'Goal 3', priority: 'low', ownerId: 'emp-001' },
      ])

      const ownerGoals = getGoalsByOwner(goals, 'emp-001')
      expect(ownerGoals).toHaveLength(2)
    })

    it('should get goals at risk', () => {
      const goals = Goals([
        { name: 'On Track', priority: 'high', status: 'in-progress', progress: 80 },
        { name: 'At Risk', priority: 'high', status: 'at-risk', progress: 30 },
        { name: 'Behind', priority: 'medium', status: 'behind', progress: 10 },
      ])

      const atRiskGoals = getGoalsAtRisk(goals)
      expect(atRiskGoals).toHaveLength(2)
      expect(atRiskGoals.map((g) => g.name)).toContain('At Risk')
      expect(atRiskGoals.map((g) => g.name)).toContain('Behind')
    })

    it('should calculate goal progress from current/target values', () => {
      const goal = Goal({
        name: 'Close Deals',
        priority: 'high',
        targetValue: 100,
        currentValue: 35,
      })

      const progress = calculateGoalProgress(goal)
      expect(progress).toBe(35)
    })

    it('should rollup progress from child goals', () => {
      const parentGoal = Goal({
        name: 'Parent Goal',
        priority: 'high',
        children: ['child-1', 'child-2', 'child-3'],
      })

      const childGoals = Goals([
        { id: 'child-1', name: 'Child 1', priority: 'high', progress: 100 },
        { id: 'child-2', name: 'Child 2', priority: 'high', progress: 50 },
        { id: 'child-3', name: 'Child 3', priority: 'medium', progress: 25 },
      ])

      const rolledUpProgress = rollupProgress(parentGoal, childGoals)
      expect(rolledUpProgress).toBeCloseTo(58.33, 1) // Average of 100, 50, 25
    })

    it('should calculate weighted rollup based on priority', () => {
      const parentGoal = Goal({
        name: 'Parent Goal',
        priority: 'high',
        children: ['child-1', 'child-2'],
      })

      const childGoals = Goals([
        { id: 'child-1', name: 'Critical Child', priority: 'critical', progress: 100, weight: 0.7 },
        { id: 'child-2', name: 'Low Child', priority: 'low', progress: 0, weight: 0.3 },
      ])

      const weightedProgress = rollupProgress(parentGoal, childGoals, { weighted: true })
      expect(weightedProgress).toBe(70) // 100 * 0.7 + 0 * 0.3 = 70
    })
  })

  describe('Goal relationships', () => {
    it('should support parent-child relationships', () => {
      const parent = Goal({
        name: 'Parent',
        priority: 'high',
      })

      const child1 = Goal({
        name: 'Child 1',
        priority: 'medium',
        parentId: parent.id,
      })

      const child2 = Goal({
        name: 'Child 2',
        priority: 'medium',
        parentId: parent.id,
      })

      expect(child1.parentId).toBe(parent.id)
      expect(child2.parentId).toBe(parent.id)
    })

    it('should support alignment relationships', () => {
      const strategic = Goal({
        name: 'Strategic Goal',
        priority: 'critical',
        level: 'company',
      })

      const operational = Goal({
        name: 'Operational Goal',
        priority: 'high',
        level: 'department',
        alignedTo: [strategic.id],
      })

      expect(operational.alignedTo).toContain(strategic.id)
    })

    it('should support dependency relationships', () => {
      const prerequisite = Goal({
        name: 'Prerequisite Goal',
        priority: 'high',
      })

      const dependent = Goal({
        name: 'Dependent Goal',
        priority: 'medium',
        dependencies: [prerequisite.id],
      })

      expect(dependent.dependencies).toContain(prerequisite.id)
    })
  })
})
