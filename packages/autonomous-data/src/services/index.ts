/**
 * Catalog barrel — autonomous-data Services.
 *
 * Ships three Services (`dbtModelAuthor`, `dataQualityIncidentTriager`,
 * `metricsCatalogCurator`).
 *
 * Per v3 §12, catalog Services are module-evaluated TypeScript that yield a
 * typed `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `dbtModelAuthor.invoke(input)`.
 *
 * @packageDocumentation
 */

export {
  dbtModelAuthor,
  DbtModelRequestInputSchema,
  DbtModelAuthorOutputSchema,
  type DbtModelRequestInput,
  type DbtModelAuthorOutput,
} from './dbt-model-author.js'

export {
  dataQualityIncidentTriager,
  DataQualityAlertInputSchema,
  DataQualityRcaOutputSchema,
  type DataQualityAlertInput,
  type DataQualityRcaOutput,
} from './data-quality-incident-triager.js'

export {
  metricsCatalogCurator,
  MetricsCatalogReviewInputSchema,
  MetricsCatalogCurationOutputSchema,
  type MetricsCatalogReviewInput,
  type MetricsCatalogCurationOutput,
} from './metrics-catalog-curator.js'
