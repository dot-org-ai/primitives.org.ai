# HITL workflow lifetime caps and refund-on-timeout

**Status:** accepted
**Date:** 2026-05-05

## Context

ADR-0004 picks Cloudflare Workflows as the default durable-execution backend, leveraging its 365-day max sleep to support long-running human-in-the-loop steps. That capability has a downside: an Invocation that lands in `NEEDS_CLARIFICATION` (waiting on the customer) or `ESCALATED_TO_HUMAN_REVIEW` (waiting on a human reviewer) can sit indefinitely, persisting state and accruing implicit liability without any progress.

The v2 production-critic review estimated ~10K/day permanently-stuck Invocations across the platform once HITL Services scale — a non-trivial state and liability accumulation with no garbage-collection mechanism. CF Workflows will happily hold these forever; the platform needs explicit lifetime caps that drive auto-transitions and refunds.

## Decision

Each HITL-bearing Invocation state gets a **max-dwell cap** with a defined auto-transition behavior on timeout:

- `NEEDS_CLARIFICATION`: 30 days max → auto-`CANCELLED` with refund per `RefundContract`.
- `ESCALATED_TO_HUMAN_REVIEW`: 14 days max → auto-`DISPUTED`, escalate to support queue.
- `QUALITY_REVIEW`: 7 days max → auto-`FAILED`, refund per contract.

Per-Service overrides are allowed via the `oversight.maxDwell.<state>` field on `ServiceSpec` — a Service whose human reviewers are guaranteed-available within hours can shorten the QUALITY_REVIEW cap; a Service with deliberately-slow legal review can extend it. Hard ceilings (90/30/14 days) prevent unbounded overrides.

Implementation: a durable timer per Invocation per state, registered when the state is entered. Timer fires via CF Workflows' `step.sleepUntil` (per ADR-0004's port shape). On wake, the workflow transitions to the next state. Customer responses to `NEEDS_CLARIFICATION` reset the timer rather than discarding it — engagement extends the deadline, silence consumes it.

Refund Actions on timeout-driven cancellation flow through autonomous-finance's `RefundContract` resolver and write to the LedgerEntry transactional store (per ADR-0009).

## Consequences

- Liability per Invocation is bounded — at most 30 days of held funds for any single stuck Invocation.
- The garbage-collection workload becomes implicit, driven by the durable timers rather than a cron sweep — no separate stuck-invocation reaper to run or monitor.
- Customer-side UX: clarification requests carry an explicit deadline and refund-or-cancel default, reducing ambiguity and support load.
- ADR-0007's `tenantRef` scopes the refund flow — refunds return to the originating tenant's wallet.
- Per-state caps become part of the `ServiceSpec` public contract; adding a new HITL state requires declaring its cap at the same time.
- The `oversight.maxDwell` field is exposed to operators as a tuning knob for cost/availability trade-offs (faster human SLA → shorter cap → fewer refunds → tighter unit economics).
