/**
 * Cascade orchestration / schedule seam — the ④ queue-spine.
 *
 * Public entry point for the `ai-workflows/cascade` subpath. See ./orchestrator.ts
 * for the control flow and ./types.ts for the injected port contracts and the
 * no-cycle layering argument.
 */

export { runCascade } from './orchestrator.js'

export type {
  CascadeMode,
  CascadeRef,
  Draft,
  CascadeNode,
  AdmissionVerdict,
  NounPolicy,
  GeneratePort,
  AdmitPort,
  StorePort,
  CascadePorts,
  CascadeOptions,
  DeferredCollapse,
  CascadeResult,
} from './types.js'
