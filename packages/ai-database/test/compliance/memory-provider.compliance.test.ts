/**
 * MemoryProvider Compliance Tests
 *
 * Verifies that MemoryProvider implements the DBProvider interface correctly.
 *
 * @packageDocumentation
 */

import { createProviderComplianceSuite } from '../provider-compliance-suite.js'
import { createMemoryProvider } from '../../src/memory-provider.js'

createProviderComplianceSuite('MemoryProvider', {
  factory: () => createMemoryProvider(),
  capabilities: {
    extended: true,
    transactions: true,
    semanticSearch: true,
    events: true,
    actions: true,
    artifacts: true,
  },
})
