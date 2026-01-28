/**
 * Type declarations for optional @mdxdb/* packages
 *
 * These modules are optional dependencies that may or may not be installed.
 * When available, they are dynamically imported with fallback to memory-provider.
 */

declare module '@mdxdb/fs' {
  import type { DatabaseProvider } from './types.js'
  export function createFsProvider(options: { root: string }): DatabaseProvider
}

declare module '@mdxdb/sqlite' {
  import type { DatabaseProvider } from './types.js'
  export function createSqliteProvider(options: { url: string }): Promise<DatabaseProvider>
}

declare module '@mdxdb/clickhouse' {
  import type { DatabaseProvider } from './types.js'
  export function createClickhouseProvider(options: {
    mode: 'http' | 'chdb'
    url: string
  }): Promise<DatabaseProvider>
}
