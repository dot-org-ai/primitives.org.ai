/**
 * JSX / TypeScript transform for sandbox source
 *
 * Runs inside whichever worker runs `evaluate()` (Cloudflare in production,
 * the Miniflare host worker locally), so the code handed to the loader is
 * plain JavaScript on every path and the content id hashes what actually runs.
 *
 * Backed by sucrase, bundled into `./transform-bundle.js` at build time
 * (`scripts/build-transform-bundle.ts`) so the worker needs no package
 * resolution and Node needs no native compiler.
 */

import { transform } from './transform-bundle.js'
import type { EvaluateOptions, JSXOptions } from './types.js'

/** Default JSX factory, matching the hyperscript convention `h(tag, props, ...children)` */
export const DEFAULT_JSX_FACTORY = 'h'

/** Default JSX fragment component */
export const DEFAULT_JSX_FRAGMENT = 'Fragment'

/** A JSX factory/fragment must be a plain (dotted) identifier: `h`, `React.createElement` */
const IDENTIFIER_PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/

/**
 * Check whether code contains JSX syntax that needs transforming.
 *
 * A cheap syntactic sniff: an opening tag (`<div `, `<Button/>`), a fragment
 * (`<>`, `</>`), or a `return <...` / `return (<...` expression. Comparisons
 * such as `a < b` and generics written without a trailing space do not match.
 */
export function containsJSX(code: string): boolean {
  if (!code) return false
  const jsxPattern = /<[A-Z][a-zA-Z0-9]*[\s/>]|<[a-z][a-z0-9-]*[\s/>]|<>|<\/>/
  const jsxReturnPattern = /return\s*\(\s*<|return\s+<[A-Za-z]/
  return jsxPattern.test(code) || jsxReturnPattern.test(code)
}

/** Options for `transformSource` */
export interface TransformSourceOptions {
  /** JSX factory/fragment/runtime; defaults to `h` / `Fragment` (classic runtime) */
  jsx?: JSXOptions | undefined
}

/** Build sucrase options for one source string */
function sucraseOptions(code: string, jsx: JSXOptions | undefined) {
  const withJSX = containsJSX(code)
  const factory = jsx?.factory ?? DEFAULT_JSX_FACTORY
  const fragment = jsx?.fragment ?? DEFAULT_JSX_FRAGMENT
  for (const [name, value] of [
    ['factory', factory],
    ['fragment', fragment],
  ] as const) {
    if (!IDENTIFIER_PATH.test(value)) {
      throw new Error(`jsx.${name} must be an identifier such as "h" or "React.createElement"`)
    }
  }
  return {
    // JSX parsing is only enabled when the code looks like it has JSX, so a
    // plain `a < b` in JavaScript is never read as a tag.
    transforms: withJSX ? (['jsx', 'typescript'] as const) : (['typescript'] as const),
    ...(jsx?.importSource
      ? { jsxRuntime: 'automatic' as const, jsxImportSource: jsx.importSource }
      : { jsxRuntime: 'classic' as const, jsxPragma: factory, jsxFragmentPragma: fragment }),
    // No `__source` / `__self` debug props
    production: true,
    // Leave ES2022+ syntax (class fields, optional chaining) as written
    disableESTransforms: true,
    // An import only used as a value the transform cannot see must survive:
    // sandbox imports are resolved by the loader, not by the type checker.
    keepUnusedImports: true,
  }
}

/**
 * Transform JSX and strip TypeScript from a source string.
 *
 * - JSX becomes `factory(tag, props, ...children)` calls (classic runtime), or
 *   `jsx()` imports from `${importSource}/jsx-runtime` when `importSource` is set.
 * - Type annotations, `import type`, interfaces and `as` casts are removed.
 * - Plain JavaScript comes back byte-identical.
 *
 * Code that does not parse is returned unchanged: the sandbox then reports the
 * syntax error from the runtime, exactly as it would for untransformed code.
 */
export function transformSource(code: string, options: TransformSourceOptions = {}): string {
  if (!code) return code
  const sucrase = sucraseOptions(code, options.jsx)
  try {
    return transform(code, sucrase).code
  } catch (error) {
    if (error instanceof SyntaxError) return code
    throw error
  }
}

/**
 * Strip TypeScript (only) from a module - no JSX parsing.
 *
 * Used by `ai-evaluate/node` to turn this package's own `src/*.ts` into the
 * modules of the local host worker when running from source.
 */
export function stripTypes(code: string): string {
  return transform(code, {
    transforms: ['typescript'],
    disableESTransforms: true,
    keepUnusedImports: true,
  }).code
}

/**
 * Apply `transformSource` to every source field of an `EvaluateOptions`
 * (`module`, `tests`, `script`) using its `jsx` settings. Fields that are not
 * set stay unset.
 */
export function transformOptions(options: EvaluateOptions): EvaluateOptions {
  const jsx = options.jsx
  const transformed: EvaluateOptions = { ...options }
  if (options.module !== undefined) transformed.module = transformSource(options.module, { jsx })
  if (options.tests !== undefined) transformed.tests = transformSource(options.tests, { jsx })
  if (options.script !== undefined) transformed.script = transformSource(options.script, { jsx })
  return transformed
}
