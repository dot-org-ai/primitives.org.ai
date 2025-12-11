// @ts-expect-error - evalite package doesn't export types properly for bundler moduleResolution
import { defineConfig } from 'evalite/config'

export default defineConfig({
  // Single trial by default (override per-eval for LLM-as-judge)
  trialCount: 1,

  // Allow longer timeouts for API calls
  testTimeout: 60_000,

  // Run up to 5 evals in parallel (be nice to rate limits)
  maxConcurrency: 5,

  // Fail CI if average score drops below 70%
  scoreThreshold: 70,

  // Enable caching for faster re-runs
  cache: true,

  server: {
    port: 3006,
  },
})
