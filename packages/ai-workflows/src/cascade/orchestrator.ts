/**
 * The cascade orchestrator — ④ queue-spine, recursive expansion.
 *
 * A durable-shaped work queue of refs that expand. Each dequeued item runs the
 * Draft/Resolve two-phase keyed on the Noun's timing policy:
 *
 *   online Noun:  ADMIT first (pre-gen gate)
 *                   link     → record + short-circuit (never generate/enqueue)
 *                   escalate → record + defer        (never generate/enqueue)
 *                   mint     → generate → store → enqueue children
 *   offline Noun: GENERATE first → store eagerly, then ADMIT to compute a
 *                   deferred collapse decision (applied by a later batch phase);
 *                   children are always enqueued (offline never short-circuits
 *                   expansion). Default timing.
 *
 * Cycle detection is a visited-set on `noun:text` identity (NOT a depth cap):
 * `Post → Author → Org → Posts` terminates because the back-edge to an already
 * visited node is dropped. `maxDepth` is an optional additional backstop.
 *
 * The orchestrator owns NO generate/admit/store implementation — all three are
 * injected ports (see ./types.ts). It is pure control flow over those seams,
 * which is what keeps ai-workflows at Layer 1 with no ai-functions/ai-database
 * value import.
 */

import type {
  CascadeNode,
  CascadeOptions,
  CascadeRef,
  CascadeResult,
  NounPolicy,
} from './types.js'

/** Stable identity for visited/dedup: a node IS its (noun, text) pair. */
function refId(ref: CascadeRef): string {
  return `${ref.noun}:${ref.text}`
}

interface QueueItem {
  readonly ref: CascadeRef
  readonly depth: number
  /** refIds on the path from the root to this item — used to detect true cycles. */
  readonly ancestors: ReadonlySet<string>
}

/**
 * Resolve a Noun's timing. Default is `online` (admit gates expansion, link
 * short-circuits) — the safe default that yields zero post-hoc cleanup. A Noun
 * opts into `offline` (generate-first, deferred collapse) only when its overlap
 * is low enough that the batch cleanup is cheaper than gating every generation.
 */
function timingFor(
  noun: string,
  policies: Readonly<Record<string, NounPolicy>> | undefined
): 'online' | 'offline' {
  return policies?.[noun]?.timing ?? 'online'
}

export async function runCascade<TOutput = unknown>(
  options: CascadeOptions<TOutput>
): Promise<CascadeResult> {
  const { root, ports, policies, maxDepth } = options

  const result: CascadeResult = {
    minted: [],
    linked: [],
    escalated: [],
    skipped: [],
    deferredCollapse: [],
  }

  // `visited` guards against generating a node twice (one mint per identity).
  // `mintedId` resolves a re-convergent reference to the canonical it minted —
  // distinct from `visited` because a DAG re-convergence links (provenance kept)
  // while an active-path back-edge is a true cycle that is dropped.
  const visited = new Set<string>([refId(root)])
  const mintedId = new Map<string, string>()
  // Re-convergent references seen before their target was minted; resolved to a
  // `linked` entry once the target mints (preserves every parent's provenance).
  const pendingLinks = new Map<string, number>()
  const queue: QueueItem[] = [{ ref: root, depth: 0, ancestors: new Set() }]

  while (queue.length > 0) {
    const item = queue.shift()!
    const { ref, depth, ancestors } = item
    const id = refId(ref)

    if (maxDepth !== undefined && depth > maxDepth) {
      result.skipped.push({ ref: id, reason: 'max-depth' })
      continue
    }

    const timing = timingFor(ref.noun, policies)

    if (timing === 'online') {
      // Pre-gen admission gate: link/escalate short-circuit before any generation.
      const verdict = await ports.admit.admit(ref)
      if (verdict.kind === 'link') {
        result.linked.push({ ref: id, canonical: verdict.canonical })
        continue
      }
      if (verdict.kind === 'escalate') {
        result.escalated.push({ ref: id, reason: verdict.reason })
        continue
      }
      // mint → fall through to generate + store + enqueue children.
    }

    // Generate (Draft phase). The generate port composes the LLM call; the
    // returned refs are the child seeds of the Resolve phase.
    const draft = await ports.generate.generate({ ref } as CascadeNode<TOutput>)
    const node: CascadeNode<TOutput> & { output: TOutput } = { ref, output: draft.output }
    const storedId = await ports.store.store(node)
    result.minted.push(storedId)
    mintedId.set(id, storedId)
    // Resolve any re-convergent references that arrived before this node minted:
    // each becomes a `linked` entry to the now-known canonical (provenance per
    // exposing parent).
    const pending = pendingLinks.get(id)
    if (pending !== undefined) {
      for (let i = 0; i < pending; i++) result.linked.push({ ref: id, canonical: storedId })
      pendingLinks.delete(id)
    }

    if (timing === 'offline') {
      // Offline collapse is deferred to a batch phase: generate first, then ask
      // the gate what it WOULD collapse onto — but don't apply it inline.
      const verdict = await ports.admit.admit(ref)
      if (verdict.kind === 'link') {
        result.deferredCollapse.push({ ref: id, stored: storedId, canonical: verdict.canonical })
      }
    }

    // Resolve phase: enqueue children. Three guards converge here:
    //  - within-parent dedup: ['AI','ML','AI'] resolves 'AI' once.
    //  - true cycle (childId is an active-path ancestor): drop as `visited`, the
    //    `Post→Author→Org→Posts` back-edge — no infinite recursion.
    //  - DAG re-convergence (childId already minted/enqueued via a NON-ancestor
    //    path): link to its canonical (resolved now or once it mints), preserving
    //    the provenance edge from THIS parent rather than silently dropping it.
    const childAncestors = new Set([...ancestors, id])
    const seenThisParent = new Set<string>()
    for (const child of draft.refs) {
      const childId = refId(child)
      if (seenThisParent.has(childId)) continue // within-parent dedup
      seenThisParent.add(childId)

      if (childAncestors.has(childId)) {
        result.skipped.push({ ref: childId, reason: 'visited' }) // true cycle
        continue
      }
      if (visited.has(childId)) {
        // Re-convergent reference: link to the canonical (provenance kept).
        const canonical = mintedId.get(childId)
        if (canonical !== undefined) {
          result.linked.push({ ref: childId, canonical })
        } else {
          pendingLinks.set(childId, (pendingLinks.get(childId) ?? 0) + 1)
        }
        continue
      }
      visited.add(childId)
      // Every newly-admitted child is enqueued; its own timing policy (online
      // gate vs offline generate-first) is applied when it is dequeued, so there
      // is one admission code path per timing rather than two here.
      queue.push({ ref: child, depth: depth + 1, ancestors: childAncestors })
    }
  }

  return result
}
