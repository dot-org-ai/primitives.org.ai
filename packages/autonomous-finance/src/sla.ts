/**
 * SLAPolicy — service-level agreement with auto-credit / auto-refund / escalate
 * on breach. The SaS book's "outcome-pricing requires you to stand behind quality"
 * substrate.
 */

export interface SLATarget {
  metric:
    | 'latency-ms'
    | 'accuracy'
    | 'on-time'
    | 'completeness'
    | 'first-contact-resolution'
    | 'csat'
    | string
  /** Threshold value or expression (e.g. 'day-5', 0.95, 1000). */
  threshold: number | string
}

export interface SLAPolicy {
  $id: string
  $type: 'SLAPolicy'
  serviceRef: string
  targets: SLATarget[]
  onBreach: {
    /** Percent of charge to credit back (0-100). */
    creditPercent?: number
    /** Percent of charge to refund (0-100). */
    refundPercent?: number
    /** Worker (Person/Agent/Role) to escalate to. */
    escalateTo?: string
  }
}
