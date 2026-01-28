# @org.ai/examples

Real-world examples of digital businesses built with primitives.org.ai packages.

```typescript
import { saas, marketplace, vcFirm } from '@org.ai/examples'

// Complete SaaS business model
const { business, kpis, metrics } = saas.getBusinessSummary()
console.log(business.name)  // 'CloudMetrics Inc.'
console.log(metrics.mrr)    // 780000

// VC firm with portfolio
const portfolio = vcFirm.getPortfolioSummary()
console.log(portfolio.unicorns)  // 6
```

## Installation

```bash
pnpm add @org.ai/examples
```

## Available Examples

| Example | Business Type | Description |
|---------|---------------|-------------|
| `saas` | SaaS | B2B analytics platform (CloudMetrics) |
| `apiPlatform` | API Business | Developer-focused API platform (APIHub) |
| `directory` | Directory | Curated software tools directory (TechDirectory) |
| `marketplace` | Marketplace | Two-sided freelance marketplace (TalentHub) |
| `startupStudio` | Startup Studio | B2B SaaS venture builder (VentureForge) |
| `vcFirm` | VC Firm | Early-stage enterprise VC (Catalyst Ventures) |

## Usage

### Import Individual Examples

```typescript
import { saas, marketplace, vcFirm } from '@org.ai/examples'

// Each example is a complete business model
const saasModel = saas
```

### List Available Examples

```typescript
import { listExamples } from '@org.ai/examples'

const examples = listExamples()
// [
//   { id: 'saas', name: 'SaaS Business', description: '...' },
//   { id: 'marketplace', name: 'Marketplace', description: '...' },
//   ...
// ]
```

### Dynamic Loading

```typescript
import { loadExample } from '@org.ai/examples'

const example = await loadExample('saas')
```

## What Each Example Includes

Every example is a complete business model with:

- **Business Definition** — Mission, values, structure
- **Vision & Goals** — Strategic direction
- **Products & Services** — What the business offers
- **Organization & Roles** — Team structure with FGA/RBAC
- **KPIs & OKRs** — Key metrics and objectives
- **Processes & Workflows** — How work gets done
- **Financials & Metrics** — Revenue, costs, projections

## Example: SaaS Business

```typescript
import { saas } from '@org.ai/examples'

// Get business overview
const summary = saas.getBusinessSummary()
console.log(summary.business.name)      // CloudMetrics Inc.
console.log(summary.business.mission)   // Help companies understand their data
console.log(summary.metrics.mrr)        // 780000
console.log(summary.metrics.customers)  // 156

// Access specific domains
const { products, organization, kpis } = summary
```

## Example: VC Firm

```typescript
import { vcFirm } from '@org.ai/examples'

const portfolio = vcFirm.getPortfolioSummary()
console.log(portfolio.aum)        // Assets under management
console.log(portfolio.companies)  // Number of portfolio companies
console.log(portfolio.unicorns)   // Number of unicorns
console.log(portfolio.irr)        // Internal rate of return
```

## Example: Marketplace

```typescript
import { marketplace } from '@org.ai/examples'

const summary = marketplace.getBusinessSummary()
console.log(summary.metrics.gmv)         // Gross merchandise value
console.log(summary.metrics.sellers)     // Active sellers
console.log(summary.metrics.buyers)      // Active buyers
console.log(summary.metrics.takeRate)    // Platform take rate
```

## Used Packages

These examples demonstrate integration of:

- [`business-as-code`](../business-as-code) — Business definitions
- [`ai-database`](../ai-database) — Data modeling
- [`digital-workers`](../digital-workers) — Worker definitions
- [`ai-functions`](../ai-functions) — AI capabilities

## Use Cases

- **Learning** — Understand how to structure digital businesses
- **Templates** — Starting points for new projects
- **Testing** — Reference implementations for testing
- **Demos** — Showcase platform capabilities

## API Reference

| Export | Description |
|--------|-------------|
| `saas` | SaaS business model |
| `apiPlatform` | API platform model |
| `directory` | Directory business model |
| `marketplace` | Marketplace model |
| `startupStudio` | Startup studio model |
| `vcFirm` | VC firm model |
| `listExamples()` | List all available examples |
| `loadExample(id)` | Dynamically load an example |
| `examples` | Object with lazy loaders |
