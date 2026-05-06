# autonomous-finance-services

Catalog package: **finance Services-as-Software defined on the `autonomous-finance` substrate + `services-as-software` primitive.** Sibling of `autonomous-customer-success`, `autonomous-revenue`, `autonomous-developer-experience`.

## What this is

Concrete `Service.define({...})` calls for CFO-shop work — the autonomous finance department delivered as outcome-priced, agent-delivered, durable-FSM-governed Services. Each ships as a typed module-evaluated `ServiceInstance<TIn, TOut>` value (not JSON spec) so type inference flows end-to-end into `service.invoke(input)`.

## Shipped Services

- **`bookkeeper`** — monthly books closed by day 5, GAAP-compliant, audit-ready. Cascade: `ingest (Code) → categorize (Agentic) → reconcile (Agentic) → controller-sign-breaks (Human, conditional) → close (Agentic) → statements (Generative) → publish (Code)`. EvaluatorPanel of 3 personas (schema-conformance, gaap-validator, senior-accountant). OutcomeContract = `AND(SchemaMatch, EvaluatorPass, HumanSign)`. Pricing: monthly subscription + per-transaction metered + `closeBy: 'day-5'` SLA. Reward laddering to gross margin. Lineage to `occupations.org.ai/AccountantsAndAuditors` × `processes.org.ai/FinancialStatementReview`.
- **`controller`** — review books, enforce policy, produce attested statements.
- **`ap`** — invoice intake → PO match → approve/escalate → schedule payment.
- **`ar`** — invoice send → follow-up → collect → reconcile.
- **`tax`** — quarterly accrual + annual return + filings + notices.
- **`treasury`** — daily cash position + sweep + FX + runway forecast.
- **`payroll`** — pay run preparation + approval + execution + tax filing.
- **`audit-prep`** — period selected → supporting docs + sampling + audit binder assembled.
- **`expense-policy-enforcer`** — corporate-card / expense-management adjudication. Cascade: `extract-line-items (Code) → classify-against-policy (Generative) → out-of-policy-escalation (Human, conditional via trigger) → emit-approval-or-reject (Code)`. EvaluatorPanel of 2 personas (policy-clause-checker + fraud-checker) under `all-approve`. OutcomeContract = `AND(SchemaMatch, EvaluatorPass, HumanSign(when: out-of-policy))`. Pricing: `Pricing.perInvocation` across starter / growth / scale tiers. Service-level reward = `rejected-claim-rate-aligned-with-policy`. Lineage: `occupations.org.ai/AccountantsAndAuditors` × `processes.org.ai/ExpenseClaimAdjudication`.

## Why a separate package (not subpath of `autonomous-finance`)

Initial v3 design (`docs/plans/2026-05-05-services-as-software-design-v3.md` §12) put the catalog at `autonomous-finance/services/*` as a subpath import. That fails at the workspace dep graph: the catalog needs `services-as-software` at runtime, but `services-as-software` already depends on `autonomous-finance` for `Money` / `Pricing` / `OutcomeContract`. Turborepo (correctly) detects the cycle. Even peer-dep declarations don't break it — peer + dev deps are still in the topological graph.

Resolution: catalog moves to its own L5 package. Substrate (`autonomous-finance`) stays clean at L3 with no SaS dep. This package is the L5 consumer that ties the substrate to the primitive.

## Imports

```ts
import { bookkeeper } from 'autonomous-finance-services/bookkeeper'

const handle = bookkeeper.invoke({ tenantRef: 'acme', period: { year: 2026, month: 5 }, sources: ['plaid', 'quickbooks'] })
```

Type inference flows: `bookkeeper: ServiceInstance<TxIngest, ClosedBooks>`. `handle.result` resolves to `ClosedBooks`.

## References

- Beads epic: `aip-dlmj` (autonomous-finance umbrella; this catalog is the consumer)
- Companion design docs:
  - `docs/plans/2026-05-05-services-as-software-design-v3.md`
  - `docs/plans/2026-05-05-business-as-code-stack-design.md`
