/**
 * Catalog barrel — autonomous-marketing Services.
 *
 * Ships nine Services (`campaignBriefGenerator`, `seoContentPillarAuthor`,
 * `paidAdCreativeIterator`, `brandVoiceMonitor`,
 * `contentLocalizationOrchestrator`, `campaignAttributionAuditor`,
 * `emailNurtureSequencer`, `competitorPositioningMonitor`,
 * `webinarFunnelOrchestrator`).
 *
 * Per v3 §12, catalog Services are module-evaluated TypeScript that yield a
 * typed `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `campaignBriefGenerator.invoke(input)`.
 *
 * @packageDocumentation
 */

export {
  campaignBriefGenerator,
  CampaignKickoffInputSchema,
  CampaignBriefOutputSchema,
  type CampaignKickoffInput,
  type CampaignBriefOutput,
} from './campaign-brief-generator.js'

export {
  seoContentPillarAuthor,
  PillarClusterInputSchema,
  PillarClusterOutputSchema,
  type PillarClusterInput,
  type PillarClusterOutput,
} from './seo-content-pillar-author.js'

export {
  paidAdCreativeIterator,
  AdPerfTriggerInputSchema,
  AdVariantSetOutputSchema,
  type AdPerfTriggerInput,
  type AdVariantSetOutput,
} from './paid-ad-creative-iterator.js'

export {
  brandVoiceMonitor,
  BrandAuditTriggerInputSchema,
  BrandAuditReportOutputSchema,
  type BrandAuditTriggerInput,
  type BrandAuditReportOutput,
} from './brand-voice-monitor.js'

export {
  contentLocalizationOrchestrator,
  LocalizationRequestInputSchema,
  LocalizedBundleOutputSchema,
  type LocalizationRequestInput,
  type LocalizedBundleOutput,
} from './content-localization-orchestrator.js'

export {
  campaignAttributionAuditor,
  AttributionAuditTriggerInputSchema,
  AttributionAuditReportOutputSchema,
  type AttributionAuditTriggerInput,
  type AttributionAuditReportOutput,
} from './campaign-attribution-auditor.js'

export {
  emailNurtureSequencer,
  NurtureBriefInputSchema,
  NurtureSequenceOutputSchema,
  type NurtureBriefInput,
  type NurtureSequenceOutput,
} from './email-nurture-sequencer.js'

export {
  competitorPositioningMonitor,
  CompetitorMonitorTriggerInputSchema,
  CompetitorPositioningBriefOutputSchema,
  type CompetitorMonitorTriggerInput,
  type CompetitorPositioningBriefOutput,
} from './competitor-positioning-monitor.js'

export {
  webinarFunnelOrchestrator,
  WebinarPlanInputSchema,
  WebinarFunnelOutputSchema,
  type WebinarPlanInput,
  type WebinarFunnelOutput,
} from './webinar-funnel-orchestrator.js'
