/**
 * Tests for entities/index.ts - Business Entity Type Definitions
 */

import { describe, it, expect } from 'vitest'
import {
  // Business entities
  Business,
  Vision,
  Value,
  BusinessEntities,
  BusinessCategories,

  // Organization entities
  Organization,
  Department,
  Team,
  Position,
  Role,
  Worker,
  OrganizationEntities,
  OrganizationCategories,

  // Goal entities
  Goal,
  OKR,
  KeyResult,
  KPI,
  Metric,
  Initiative,
  GoalEntities,
  GoalCategories,

  // Offering entities
  Product,
  Service,
  Feature,
  PricingPlan,
  RoadmapItem,
  OfferingEntities,
  OfferingCategories,

  // Operations entities
  Process,
  ProcessStep,
  Workflow,
  WorkflowAction,
  WorkflowRun,
  Policy,
  OperationsEntities,
  OperationsCategories,

  // Financial entities
  Budget,
  Revenue,
  Expense,
  Investment,
  FinancialPeriod,
  Forecast,
  FinancialEntities,
  FinancialCategories,

  // All entities
  AllBusinessEntities,
  BusinessEntityCategories,
  Entities,
} from '../src/entities/index.js'

// Helper to validate Noun structure
function isValidNoun(entity: unknown): boolean {
  if (typeof entity !== 'object' || entity === null) return false
  const e = entity as Record<string, unknown>
  return (
    typeof e.singular === 'string' &&
    typeof e.plural === 'string' &&
    typeof e.description === 'string' &&
    typeof e.properties === 'object' &&
    Array.isArray(e.actions) &&
    Array.isArray(e.events)
  )
}

describe('Business Entities', () => {
  describe('Business', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Business)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Business.singular).toBe('business')
      expect(Business.plural).toBe('businesses')
    })

    it('should have identity properties', () => {
      expect(Business.properties.name).toBeDefined()
      expect(Business.properties.legalName).toBeDefined()
      expect(Business.properties.slug).toBeDefined()
    })

    it('should have purpose properties', () => {
      expect(Business.properties.mission).toBeDefined()
      expect(Business.properties.vision).toBeDefined()
      expect(Business.properties.values).toBeDefined()
    })

    it('should have relationships', () => {
      expect(Business.relationships).toBeDefined()
      expect(Business.relationships?.organization).toBeDefined()
      expect(Business.relationships?.products).toBeDefined()
      expect(Business.relationships?.services).toBeDefined()
    })

    it('should have actions and events', () => {
      expect(Business.actions).toContain('create')
      expect(Business.actions).toContain('update')
      expect(Business.actions).toContain('launch')
      expect(Business.events).toContain('created')
      expect(Business.events).toContain('updated')
    })
  })

  describe('Vision', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Vision)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Vision.singular).toBe('vision')
      expect(Vision.plural).toBe('visions')
    })

    it('should have statement property', () => {
      expect(Vision.properties.statement).toBeDefined()
      expect(Vision.properties.statement.type).toBe('string')
    })

    it('should have success indicators', () => {
      expect(Vision.properties.successIndicators).toBeDefined()
      expect(Vision.properties.successIndicators.array).toBe(true)
    })
  })

  describe('Value', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Value)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Value.singular).toBe('value')
      expect(Value.plural).toBe('values')
    })

    it('should have behaviors property', () => {
      expect(Value.properties.behaviors).toBeDefined()
      expect(Value.properties.antiPatterns).toBeDefined()
    })
  })

  describe('BusinessEntities', () => {
    it('should contain all business entities', () => {
      expect(BusinessEntities.Business).toBe(Business)
      expect(BusinessEntities.Vision).toBe(Vision)
      expect(BusinessEntities.Value).toBe(Value)
    })
  })

  describe('BusinessCategories', () => {
    it('should categorize entities', () => {
      expect(BusinessCategories.core).toContain('Business')
      expect(BusinessCategories.purpose).toContain('Vision')
      expect(BusinessCategories.purpose).toContain('Value')
    })
  })
})

describe('Organization Entities', () => {
  describe('Organization', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Organization)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Organization.singular).toBe('organization')
      expect(Organization.plural).toBe('organizations')
    })
  })

  describe('Department', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Department)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Department.singular).toBe('department')
      expect(Department.plural).toBe('departments')
    })
  })

  describe('Team', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Team)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Team.singular).toBe('team')
      expect(Team.plural).toBe('teams')
    })
  })

  describe('Position', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Position)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Position.singular).toBe('position')
      expect(Position.plural).toBe('positions')
    })
  })

  describe('Role', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Role)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Role.singular).toBe('role')
      expect(Role.plural).toBe('roles')
    })
  })

  describe('Worker', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Worker)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Worker.singular).toBe('worker')
      expect(Worker.plural).toBe('workers')
    })
  })

  describe('OrganizationEntities', () => {
    it('should contain all organization entities', () => {
      expect(OrganizationEntities.Organization).toBe(Organization)
      expect(OrganizationEntities.Department).toBe(Department)
      expect(OrganizationEntities.Team).toBe(Team)
      expect(OrganizationEntities.Position).toBe(Position)
      expect(OrganizationEntities.Role).toBe(Role)
      expect(OrganizationEntities.Worker).toBe(Worker)
    })
  })
})

describe('Goal Entities', () => {
  describe('Goal', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Goal)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Goal.singular).toBe('goal')
      expect(Goal.plural).toBe('goals')
    })

    it('should have progress properties', () => {
      expect(Goal.properties.progress).toBeDefined()
      expect(Goal.properties.status).toBeDefined()
    })
  })

  describe('OKR', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(OKR)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(OKR.singular).toBe('okr')
      expect(OKR.plural).toBe('okrs')
    })
  })

  describe('KeyResult', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(KeyResult)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(KeyResult.singular).toBe('key-result')
      expect(KeyResult.plural).toBe('key-results')
    })
  })

  describe('KPI', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(KPI)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(KPI.singular).toBe('kpi')
      expect(KPI.plural).toBe('kpis')
    })
  })

  describe('Metric', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Metric)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Metric.singular).toBe('metric')
      expect(Metric.plural).toBe('metrics')
    })
  })

  describe('Initiative', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Initiative)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Initiative.singular).toBe('initiative')
      expect(Initiative.plural).toBe('initiatives')
    })
  })

  describe('GoalEntities', () => {
    it('should contain all goal entities', () => {
      expect(GoalEntities.Goal).toBe(Goal)
      expect(GoalEntities.OKR).toBe(OKR)
      expect(GoalEntities.KeyResult).toBe(KeyResult)
      expect(GoalEntities.KPI).toBe(KPI)
      expect(GoalEntities.Metric).toBe(Metric)
      expect(GoalEntities.Initiative).toBe(Initiative)
    })
  })
})

describe('Offering Entities', () => {
  describe('Product', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Product)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Product.singular).toBe('product')
      expect(Product.plural).toBe('products')
    })
  })

  describe('Service', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Service)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Service.singular).toBe('service')
      expect(Service.plural).toBe('services')
    })
  })

  describe('Feature', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Feature)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Feature.singular).toBe('feature')
      expect(Feature.plural).toBe('features')
    })
  })

  describe('PricingPlan', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(PricingPlan)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(PricingPlan.singular).toBe('pricing-plan')
      expect(PricingPlan.plural).toBe('pricing-plans')
    })
  })

  describe('RoadmapItem', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(RoadmapItem)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(RoadmapItem.singular).toBe('roadmap-item')
      expect(RoadmapItem.plural).toBe('roadmap-items')
    })
  })

  describe('OfferingEntities', () => {
    it('should contain all offering entities', () => {
      expect(OfferingEntities.Product).toBe(Product)
      expect(OfferingEntities.Service).toBe(Service)
      expect(OfferingEntities.Feature).toBe(Feature)
      expect(OfferingEntities.PricingPlan).toBe(PricingPlan)
      expect(OfferingEntities.RoadmapItem).toBe(RoadmapItem)
    })
  })
})

describe('Operations Entities', () => {
  describe('Process', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Process)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Process.singular).toBe('process')
      expect(Process.plural).toBe('processes')
    })
  })

  describe('ProcessStep', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(ProcessStep)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(ProcessStep.singular).toBe('process-step')
      expect(ProcessStep.plural).toBe('process-steps')
    })
  })

  describe('Workflow', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Workflow)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Workflow.singular).toBe('workflow')
      expect(Workflow.plural).toBe('workflows')
    })
  })

  describe('WorkflowAction', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(WorkflowAction)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(WorkflowAction.singular).toBe('workflow-action')
      expect(WorkflowAction.plural).toBe('workflow-actions')
    })
  })

  describe('WorkflowRun', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(WorkflowRun)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(WorkflowRun.singular).toBe('workflow-run')
      expect(WorkflowRun.plural).toBe('workflow-runs')
    })
  })

  describe('Policy', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Policy)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Policy.singular).toBe('policy')
      expect(Policy.plural).toBe('policies')
    })
  })

  describe('OperationsEntities', () => {
    it('should contain all operations entities', () => {
      expect(OperationsEntities.Process).toBe(Process)
      expect(OperationsEntities.ProcessStep).toBe(ProcessStep)
      expect(OperationsEntities.Workflow).toBe(Workflow)
      expect(OperationsEntities.WorkflowAction).toBe(WorkflowAction)
      expect(OperationsEntities.WorkflowRun).toBe(WorkflowRun)
      expect(OperationsEntities.Policy).toBe(Policy)
    })
  })
})

describe('Financial Entities', () => {
  describe('Budget', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Budget)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Budget.singular).toBe('budget')
      expect(Budget.plural).toBe('budgets')
    })
  })

  describe('Revenue', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Revenue)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Revenue.singular).toBe('revenue')
      expect(Revenue.plural).toBe('revenues')
    })
  })

  describe('Expense', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Expense)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Expense.singular).toBe('expense')
      expect(Expense.plural).toBe('expenses')
    })
  })

  describe('Investment', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Investment)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Investment.singular).toBe('investment')
      expect(Investment.plural).toBe('investments')
    })
  })

  describe('FinancialPeriod', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(FinancialPeriod)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(FinancialPeriod.singular).toBe('financial-period')
      expect(FinancialPeriod.plural).toBe('financial-periods')
    })
  })

  describe('Forecast', () => {
    it('should be a valid Noun definition', () => {
      expect(isValidNoun(Forecast)).toBe(true)
    })

    it('should have correct singular/plural', () => {
      expect(Forecast.singular).toBe('forecast')
      expect(Forecast.plural).toBe('forecasts')
    })
  })

  describe('FinancialEntities', () => {
    it('should contain all financial entities', () => {
      expect(FinancialEntities.Budget).toBe(Budget)
      expect(FinancialEntities.Revenue).toBe(Revenue)
      expect(FinancialEntities.Expense).toBe(Expense)
      expect(FinancialEntities.Investment).toBe(Investment)
      expect(FinancialEntities.FinancialPeriod).toBe(FinancialPeriod)
      expect(FinancialEntities.Forecast).toBe(Forecast)
    })
  })
})

describe('AllBusinessEntities', () => {
  it('should contain all entity categories', () => {
    expect(AllBusinessEntities.business).toBeDefined()
    expect(AllBusinessEntities.organization).toBeDefined()
    expect(AllBusinessEntities.goals).toBeDefined()
    expect(AllBusinessEntities.offerings).toBeDefined()
    expect(AllBusinessEntities.operations).toBeDefined()
    expect(AllBusinessEntities.financials).toBeDefined()
    expect(AllBusinessEntities.customers).toBeDefined()
    expect(AllBusinessEntities.sales).toBeDefined()
    expect(AllBusinessEntities.marketing).toBeDefined()
    expect(AllBusinessEntities.partnerships).toBeDefined()
    expect(AllBusinessEntities.legal).toBeDefined()
    expect(AllBusinessEntities.risk).toBeDefined()
    expect(AllBusinessEntities.projects).toBeDefined()
    expect(AllBusinessEntities.planning).toBeDefined()
    expect(AllBusinessEntities.communication).toBeDefined()
    expect(AllBusinessEntities.assets).toBeDefined()
    expect(AllBusinessEntities.market).toBeDefined()
  })
})

describe('BusinessEntityCategories', () => {
  it('should contain all category names', () => {
    expect(BusinessEntityCategories).toContain('business')
    expect(BusinessEntityCategories).toContain('organization')
    expect(BusinessEntityCategories).toContain('goals')
    expect(BusinessEntityCategories).toContain('offerings')
    expect(BusinessEntityCategories).toContain('operations')
    expect(BusinessEntityCategories).toContain('financials')
    expect(BusinessEntityCategories).toContain('customers')
    expect(BusinessEntityCategories).toContain('sales')
    expect(BusinessEntityCategories).toContain('marketing')
    expect(BusinessEntityCategories).toContain('partnerships')
    expect(BusinessEntityCategories).toContain('legal')
    expect(BusinessEntityCategories).toContain('risk')
    expect(BusinessEntityCategories).toContain('projects')
    expect(BusinessEntityCategories).toContain('planning')
    expect(BusinessEntityCategories).toContain('communication')
    expect(BusinessEntityCategories).toContain('assets')
    expect(BusinessEntityCategories).toContain('market')
  })

  it('should have 17 categories', () => {
    expect(BusinessEntityCategories).toHaveLength(17)
  })
})

describe('Entities', () => {
  it('should be a flat object containing all entities', () => {
    // Verify some entities from different categories exist
    expect(Entities.Business).toBeDefined()
    expect(Entities.Organization).toBeDefined()
    expect(Entities.Goal).toBeDefined()
    expect(Entities.Product).toBeDefined()
    expect(Entities.Process).toBeDefined()
    expect(Entities.Budget).toBeDefined()
  })

  it('should have valid Noun structure for all entities', () => {
    for (const [name, entity] of Object.entries(Entities)) {
      expect(isValidNoun(entity)).toBe(true)
    }
  })
})
