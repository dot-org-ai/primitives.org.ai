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
