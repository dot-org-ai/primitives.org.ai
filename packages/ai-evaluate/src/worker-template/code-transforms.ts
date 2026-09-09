/**
 * Module transformation and export detection utilities
 */

/**
 * Transform module code to work in sandbox
 * Converts ES module exports to CommonJS-style for the sandbox
 */
export function transformModuleCode(moduleCode: string): string {
  let code = moduleCode

  // Transform: export const foo = ... -> const foo = ...; exports.foo = foo;
  code = code.replace(/export\s+(const|let|var)\s+(\w+)\s*=/g, '$1 $2 = exports.$2 =')

  // Transform: export function foo(...) -> function foo(...) exports.foo = foo;
  // Also handles async generators: export async function* foo
  code = code.replace(/export\s+(async\s+)?function(\*?)\s+(\w+)/g, '$1function$2 $3')
  // Add exports for functions after their definition
  const funcNames = [...moduleCode.matchAll(/export\s+(?:async\s+)?function\*?\s+(\w+)/g)]
  for (const [, name] of funcNames) {
    code += `\nexports.${name} = ${name};`
  }

  // Transform: export class Foo -> class Foo; exports.Foo = Foo;
  code = code.replace(/export\s+class\s+(\w+)/g, 'class $1')
  const classNames = [...moduleCode.matchAll(/export\s+class\s+(\w+)/g)]
  for (const [, name] of classNames) {
    code += `\nexports.${name} = ${name};`
  }

  return code
}

/**
 * A static `import` declaration at the start of a line or statement: a
 * default, named, namespace or side-effect import, possibly spanning lines,
 * up to and including its `;`. Dynamic `import()` and `import.meta` do not
 * match (no `from` clause, no quoted specifier directly after the keyword).
 */
const STATIC_IMPORT = /(?<=^|[;\n])[ \t]*import\s+(?:[^'"`;]*?\bfrom\s*)?['"][^'"\n]+['"][ \t]*;?/gm

/** A module with its static imports separated from the rest of its code */
export interface HoistedImports {
  /** The import declarations, in source order, one statement each */
  imports: string[]
  /** The module without them (blank lines where they were, so line numbers hold) */
  code: string
}

/**
 * Lift the static `import` declarations out of a module.
 *
 * User `module` and `script` code is embedded inside blocks of the generated
 * worker (a `try` around the module, the async function around the script),
 * where an `import` declaration is a syntax error. Hoisting puts them at the
 * true top level of the worker module, where the loader (or the bundler)
 * resolves them, and leaves the rest of the code in place.
 */
export function hoistImports(code: string): HoistedImports {
  const imports: string[] = []
  const rest = code.replace(STATIC_IMPORT, (statement) => {
    imports.push(statement.trim().replace(/;$/, '') + ';')
    // Keep the line count so runtime error positions still point at the source
    return statement.replace(/[^\n]/g, '')
  })
  return { imports, code: rest }
}
