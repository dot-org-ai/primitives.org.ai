import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    // Main entry
    'index.ts',
    // Core
    'core/index.ts',
    // Organizational
    'org/index.ts',
    // Application
    'app/index.ts',
    // Business
    'business/index.ts',
    // Product
    'product/index.ts',
    // Service
    'service/index.ts',
    // Site
    'site/index.ts',
    // Tool
    'tool/index.ts',
    'tool/crm.ts',
    'tool/payments.ts',
    // Finance & Accounting
    'finance/index.ts',
    // HR & People
    'hr/index.ts',
    // Sales & Revenue
    'sales/index.ts',
    // Operations & Logistics
    'ops/index.ts',
    // Legal & Compliance
    'legal/index.ts',
    // Marketing & Growth
    'marketing/index.ts',
    // Customer Success & Support
    'support/index.ts',
    // Identity & Auth
    'auth/index.ts',
    // Communication & Collaboration
    'collab/index.ts',
    // Data & Analytics
    'analytics/index.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  outDir: 'dist',
})
