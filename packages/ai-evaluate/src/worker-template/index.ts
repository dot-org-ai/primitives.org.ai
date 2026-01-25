/**
 * Worker template module for sandbox execution
 *
 * This module provides functions to generate worker code for sandboxed execution.
 * The generated code is stringified and sent to the worker loader.
 *
 * @module worker-template
 */

// Main public API - worker code generators
export { generateWorkerCode, generateDevWorkerCode } from './core.js'

// SDK code generation (local and remote modes)
export { generateSDKCode, generateShouldCode } from './sdk-generator.js'

// Test framework embedding
export { generateTestFrameworkCode, generateTestRunnerCode } from './test-generator.js'

// Module transformation and export detection
export { transformModuleCode } from './code-transforms.js'

// Shared utility functions
export { getExportNames, wrapScriptForReturn } from './helpers.js'
