# Durable execution: Cloudflare Workflows default; Vercel WDK and in-process as alternates

**Status:** accepted
**Date:** 2026-05-05

## Context

`packages/ai-workflows/` provides event-driven workflow primitives. Its `WorkflowRuntime` (introduced in `1e5ff39`, bead `aip-k9uy`) owns the `$` runtime contract — handlers, dispatch, cascade-context, database-context. Today the runtime executes in-process: workflows live as long as the process does. For long-running cascades, scheduled jobs, and durable orchestration spanning hours/days, an external durable execution backend is needed.

Two candidate backends, both significantly improved/released recently (per research dated 2026-05-05):

### Cloudflare Workflows
- **Recently increased limits** (Mar/Apr 2026): 10K steps default → 25K configurable; 50K concurrent instances; 2M queued; 365-day max sleep; 1 GB persisted state per workflow.
- Programming model: `WorkflowEntrypoint` class + `step.do`, `step.sleep`, `step.waitForEvent`. State must flow through step returns; in-memory variables don't survive hibernation.
- **No per-step billing.** Billed as Workers — invocations, CPU ms, storage. Idle/sleeping/waiting workflows incur zero CPU.
- Workers-only runtime.

### Vercel Workflow Development Kit (WDK)
- GA May 2026 (was open beta Oct 2025). Apache-2.0 licensed (open source, `vercel/workflow`).
- Directive-based programming model — `'use workflow'` and `'use step'` directives mark async functions as durable. Event-sourced replay (deterministic), like Temporal.
- Pluggable **"Worlds"** backends — Local, Vercel, Postgres reference impl, community alternatives. Self-hostable on Docker/AWS/DO/etc.
- 10K steps, 50 MB payload (vs CF's 1 MB), unlimited sleep and run duration, 100K concurrency.
- **Per-step billing**: 50K free, then $2.50 per 100K steps. Plus Vercel Functions compute and Queues at standard rates.

### Cost analysis for cascade-heavy workloads

A typical cascade (per ADR-0003) produces thousands of inserts; a 5K-step cascade is reasonable. At 10K cascades/day × 5K steps:

- **Cloudflare Workflows: ~$0/day extra** (just CPU/requests on Workers infrastructure)
- **Vercel WDK: ~$1,250/day on steps alone** (50M steps × $2.50/100K)

The gap is structural — CF doesn't bill per step. For cascade-generation as the moat workload, this dominates.

## Decision

**Default backend: Cloudflare Workflows.** Cost-optimal for cascade-heavy workloads. Recently expanded limits (25K steps, 50K concurrency, 365-day sleeps) cover virtually any cascade or scheduled job. Hibernate-while-waiting model fits read-then-traverse patterns native to cascade generation.

**Alternate backend: Vercel WDK.** For Vercel-hosted users, self-hosted deployments (Docker/AWS/DO), or callers wanting open-source portability. Apache-2.0 license + "Worlds" pattern make it a genuinely portable *primitive* — better than Inngest/Trigger.dev for our needs because it's spec-driven rather than queue-driven.

**Test/dev backend: in-process.** The existing `WorkflowRuntime` becomes the in-process adapter — used for tests, local development, and any caller who doesn't need durability across process restarts.

### Port shape

Define `DurableExecutionAdapter` in `ai-workflows`. Small interface, modeled after WDK's "Worlds" abstraction (which is the prior art for this exact pattern):

```ts
interface DurableExecutionAdapter {
  kind: 'in-process' | 'cloudflare' | 'vercel-wdk'
  run<T>(name: string, fn: WorkflowFn<T>, input: unknown): Promise<T>
  step<T>(name: string, fn: () => Promise<T>): Promise<T>
  sleep(duration: string | number): Promise<void>
  sleepUntil(date: Date): Promise<void>
  waitForEvent<T>(name: string, timeout?: number): Promise<T>
  schedule(name: string, cron: string, fn: WorkflowFn): void
}
```

Three real adapters (in-process, CF, WDK) → real seam per LANGUAGE.md.

## Consequences

- The `WorkflowRuntime` we just built (`1e5ff39`) doesn't go away — it becomes the in-process implementation of the new port. Existing callers continue to work.
- Cloudflare adapter ships first (production-priority; cost-optimal for cascades).
- WDK adapter ships when there's a Vercel-hosted or self-hosted user requesting it. Don't speculate.
- Cascade generator (ADR-0003 moat work) calls into `DurableExecutionAdapter` for orchestration; it doesn't need to know which backend is wired.
- Programming model unification: callers write to the port's `step`/`sleep`/`waitForEvent` shape. Each adapter translates to its native primitive. CF's hibernation, WDK's event-sourced replay, in-process's plain async — all hidden behind the port.
- The `Rules of Workflows` from CF (idempotent steps, deterministic step names, state through step returns) become guidance for callers writing against the port — they apply universally to durable execution and aren't CF-specific.
- WDK's open "Worlds" pattern means a community PG-backed adapter or other implementations are possible without rebuilding the port.

## Sources

- [Cloudflare Workflows](https://developers.cloudflare.com/workflows/)
- [CF step limit raised to 25K (Mar 2026)](https://developers.cloudflare.com/changelog/post/2026-03-03-step-limits-to-25k/)
- [CF concurrency raised (Apr 2026)](https://developers.cloudflare.com/changelog/post/2026-04-15-workflows-limits-raised/)
- [CF Workflows Pricing](https://developers.cloudflare.com/workflows/reference/pricing/)
- [Vercel: Introducing Workflow Development Kit](https://vercel.com/blog/introducing-workflow)
- [WDK docs](https://vercel.com/docs/workflows) · [workflow-sdk.dev](https://workflow-sdk.dev/) · [vercel/workflow](https://github.com/vercel/workflow)
