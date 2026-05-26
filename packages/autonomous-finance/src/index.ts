/**
 * autonomous-finance — re-export SHIM.
 *
 * The outcome-contract economic substrate now lives in `business-as-code`
 * (subpath `business-as-code/finance`), the source of truth for the economic
 * primitives of the agentic economy. This package re-exports that surface
 * unchanged so existing importers keep compiling.
 *
 * New code should import from `business-as-code/finance` directly. This shim
 * remains until the owner question for the `autonomous-*` catalog packages
 * (which still import it) is resolved.
 *
 * @packageDocumentation
 */

export * from 'business-as-code/finance'
