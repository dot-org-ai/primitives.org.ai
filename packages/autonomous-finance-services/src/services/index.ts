/**
 * Catalog Services exported from `autonomous-finance`. Per v3 §12, catalog
 * Services are module-evaluated TypeScript that yield a typed
 * `ServiceInstance<TIn, TOut>` value, exported as a named binding so
 * consumers get full type inference into `bookkeeper.invoke(input)`.
 *
 * @packageDocumentation
 */

export { bookkeeper, TxIngestSchema, ClosedBooksSchema } from './bookkeeper.js'
export type { TxIngest, ClosedBooks } from './bookkeeper.js'
