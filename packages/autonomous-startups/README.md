# autonomous-startups

> **Status: shipping.** First Service (`claude-code-feature-build`) is live — the v3 worked example, ported to a real `Service.define({...})` call. Sibling of `autonomous-finance-services`, `autonomous-customer-success`, `autonomous-revenue`, `autonomous-developer-experience`.

The catalog package for startup-shaped Services-as-Software, plus the future home of the meta-primitive for autonomous startups across every business model — not just Services-as-Software.

## Initial Service

- **`claude-code-feature-build`** — ship a feature to your repo, reviewed by 4 specialists. Cascade: `brainstorm (Generative) → plan (Agentic) → scope (Agentic) → dispatch (Code) → dev × N (Agentic, fan-out)`. EvaluatorPanel of 4 personas (`qa-reviewer / arch-reviewer / security-reviewer / product-reviewer`). OutcomeContract = `AND(EvaluatorPass(panel:self, all-approved), External(github, { ci: 'passing', merged: true }))`. Pricing: outcome tiers — S=$200, M=$800, L=$2400 by feature complexity. Reward laddering to customer CSAT. Lineage to `business.org.ai/cells/software-developers/feature-implementation`.

```ts
import { claudeCodeFeatureBuild } from 'autonomous-startups/claude-code-feature-build'

const handle = claudeCodeFeatureBuild.invoke({
  repoRef: 'github.com/acme/widgets',
  featureBrief: 'Add a Stripe webhook handler for subscription.deleted events that rolls users back to the free plan.',
  acceptanceCriteria: ['rollback within 60s', 'idempotent on replay', 'covered by an integration test'],
})
```

Type inference flows: `claudeCodeFeatureBuild: ServiceInstance<FeatureBuildInput, FeatureBuildOutput>`. `handle.result` resolves to `FeatureBuildOutput`.

## Future scope: meta-primitive for every business model

This package will eventually grow to host the meta-primitive for *the autonomous business itself* — sitting above `business-as-code` (deterministic rails: Goals/OKRs/Oversight/Process) and `services-as-software` (one specific business-model primitive). It will provide one typed primitive per business-model archetype, higher-order generators producing N businesses across a strategic-token grid (the "1M businesses from every (ICP × Problem)" thesis, generalized beyond Services-as-Software), and shared substrate over `business-as-code` rails + `autonomous-finance` economics.

### Business models in scope (planned)

| Primitive | Maps to business model |
|---|---|
| `Service` | Services-as-Software (cascade-delivered outcome) — lives in `services-as-software` |
| `SaaSProduct` | Headless SaaS — multi-tenant feature-gated software product |
| `APIProduct` | API-as-a-Service — programmable interface as the deliverable |
| `DataProduct` | DaaS — curated dataset as the deliverable |
| `InfraProduct` | IaaS — provisioned infrastructure as the deliverable |
| `PlatformProduct` | PaaS — managed platform as the deliverable |
| `MarketplaceProduct` | Marketplace — multi-sided platform connecting buyers and sellers |
| `DirectoryProduct` | Directory — curated discovery layer |

Each primitive shares structure (a typed mint contract, a durable invocation/usage FSM, pricing, oversight, lineage) but differs in delivery mechanics, customer experience, and economic model.

## References

- Beads epic: `aip-n1b8`
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v3.md` (§3 has the Claude Code worked example)
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
