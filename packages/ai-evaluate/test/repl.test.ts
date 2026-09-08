/**
 * REPL sessions on the Node pool: `createReplSession({ local: true })` runs
 * on the process-wide Miniflare host of `ai-evaluate/node`, whose host worker
 * exports the `SandboxHost` Durable Object - so a session's variables live in
 * a `ReplState` facet (SQLite-backed storage of the sandbox), hydrated and
 * stored by each evaluation, never re-serialized into module source.
 *
 * The pure pieces (statement splitting, last-expression capture, declared
 * names, the script) are tested first, without a host.
 */
import { describe, it, expect, afterAll, vi } from 'vitest'
import {
  createReplSession,
  quickEval,
  splitStatements,
  captureLastExpression,
  declaredNames,
  buildReplScript,
  REPL_FACET_BINDING,
  REPL_FACET_CLASS,
} from '../src/repl.js'
import { dispose } from '../src/node.js'

afterAll(async () => {
  await dispose()
})

describe('splitStatements', () => {
  it('splits at semicolons and line breaks outside brackets and strings', () => {
    expect(splitStatements('a; b').map((s) => s.text.trim())).toEqual(['a', 'b'])
    expect(splitStatements('a\nb').map((s) => s.text.trim())).toEqual(['a', 'b'])
    expect(splitStatements('f(1,\n 2)\nb').map((s) => s.text.trim())).toEqual(['f(1,\n 2)', 'b'])
    expect(splitStatements("const s = 'a;b'\ns").map((s) => s.text.trim())).toEqual([
      "const s = 'a;b'",
      's',
    ])
    expect(splitStatements('const t = `x;${y};z`; t').map((s) => s.text.trim())).toEqual([
      'const t = `x;${y};z`',
      't',
    ])
    expect(splitStatements('// c; d\nx').map((s) => s.text.trim())).toEqual(['// c; d', 'x'])
  })

  it('does not split a line break inside an expression', () => {
    expect(splitStatements('const f = (a) =>\n  a + 1').map((s) => s.text.trim())).toEqual([
      'const f = (a) =>\n  a + 1',
    ])
    expect(splitStatements('x\n  .map(y)\n  .join()').map((s) => s.text.trim())).toEqual([
      'x\n  .map(y)\n  .join()',
    ])
    expect(splitStatements('a +\n b').map((s) => s.text.trim())).toEqual(['a +\n b'])
    expect(splitStatements('a\n++b').map((s) => s.text.trim())).toEqual(['a', '++b'])
  })
})

describe('captureLastExpression', () => {
  it('assigns the last expression statement to __value__', () => {
    expect(captureLastExpression('1 + 1')).toBe('__value__ = (1 + 1);')
    expect(captureLastExpression('counter.n += 1; counter.n')).toBe(
      'counter.n += 1; __value__ = (counter.n);'
    )
    expect(captureLastExpression('const x = 1\nx * 2')).toBe('const x = 1\n__value__ = (x * 2);')
    expect(captureLastExpression('({ a: 1 })')).toBe('__value__ = (({ a: 1 }));')
  })

  it('turns a trailing return into the value', () => {
    expect(captureLastExpression('const x = 1; return x')).toBe('const x = 1; __value__ = (x);')
  })

  it('leaves declarations, control flow and blocks alone', () => {
    expect(captureLastExpression('const x = 1')).toBe('const x = 1')
    expect(captureLastExpression('function f() { return 1 }')).toBe('function f() { return 1 }')
    expect(captureLastExpression('if (a) { b }')).toBe('if (a) { b }')
    expect(captureLastExpression('for (const x of y) g(x)')).toBe('for (const x of y) g(x)')
    expect(captureLastExpression('')).toBe('')
  })
})

describe('declaredNames', () => {
  it('finds top-level const/let/var, function and class declarations', () => {
    expect(declaredNames('const a = 1; let b = 2\nvar c = 3')).toEqual(['a', 'b', 'c'])
    expect(declaredNames('function f() {}\nasync function g() {}\nclass K {}')).toEqual([
      'f',
      'g',
      'K',
    ])
    expect(declaredNames('export const e = 1')).toEqual(['e'])
    expect(declaredNames('let u')).toEqual(['u'])
  })

  it('reads destructuring patterns', () => {
    expect(declaredNames('const { a, b: c = 1, ...rest } = o')).toEqual(['a', 'c', 'rest'])
    expect(declaredNames('const [x, , y] = arr')).toEqual(['x', 'y'])
  })

  it('ignores declarations inside blocks and bodies', () => {
    expect(declaredNames('function f() { const inner = 1 }\nif (a) { let b = 2 }')).toEqual(['f'])
    expect(declaredNames('for (const i of xs) { i }')).toEqual([])
    expect(declaredNames('counter.n += 1; counter.n')).toEqual([])
  })
})

describe('buildReplScript', () => {
  it('hydrates, replays, assigns, captures and saves through the facet binding', () => {
    const script = buildReplScript({
      code: 'const z = x + 1; z',
      hydrate: ['x', 'y'],
      replay: ['const sum = (a, b) => a + b'],
      assignments: [['k', { v: 1 }]],
      names: ['x', 'y', 'sum', 'k', 'z'],
      clear: true,
    })
    expect(script).toContain(`await env.${REPL_FACET_BINDING}.clear();`)
    expect(script).toContain(`const __context__ = await env.${REPL_FACET_BINDING}.load();`)
    expect(script).toContain('let { x, y } = __context__;')
    expect(script).toContain('const sum = (a, b) => a + b')
    expect(script).toContain('let k = {"v":1};')
    expect(script).toContain('const z = x + 1; __value__ = (z);')
    expect(script).toContain('{ x: x, y: y, sum: sum, k: k, z: z }')
    expect(script).toContain(`await env.${REPL_FACET_BINDING}.save(__saved__, __dropped__)`)
    expect(script).toContain('return { __repl__: true, value: __value__')
  })

  it('omits what is not there', () => {
    const script = buildReplScript({
      code: '1',
      hydrate: [],
      replay: [],
      assignments: [],
      names: [],
      clear: false,
    })
    expect(script).not.toContain('.clear()')
    expect(script).not.toContain('let {')
    expect(script).toContain('Object.entries({  })')
  })
})

describe('createReplSession (local host, ReplState facet)', () => {
  it('keeps an object across evaluations: counter.n += 1 sees the stored counter', async () => {
    const session = await createReplSession({ local: true })
    try {
      const first = await session.eval('const counter = { n: 1 }')
      expect(first.success, first.error).toBe(true)
      expect(first.value).toBeUndefined()
      const second = await session.eval('counter.n += 1; counter.n')
      expect(second.success, second.error).toBe(true)
      expect(second.value).toBe(2)
      const third = await session.eval('counter')
      expect(third.value).toEqual({ n: 2 })
    } finally {
      await session.close()
    }
  })

  it('getContext() is deprecated: warns once, returns the stored snapshot', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const session = await createReplSession({ local: true })
    try {
      await session.eval('const answer = 42')
      expect(session.getContext()).toEqual({ answer: 42 })
      session.getContext()
      const notices = warn.mock.calls.filter((call) =>
        String(call[0]).includes('getContext() is deprecated')
      )
      expect(notices).toHaveLength(1)
    } finally {
      warn.mockRestore()
      await session.close()
    }
  })

  it('replays the code that declared a function, so it survives without re-serializing values', async () => {
    const session = await createReplSession({ local: true })
    try {
      await session.eval('const sum = (a, b) => a + b')
      expect((await session.eval('sum(1, 2)')).value).toBe(3)
      await session.eval('const x = 10')
      const result = await session.eval('sum(x, 5)')
      expect(result.success, result.error).toBe(true)
      expect(result.value).toBe(15)
      // The function is not in the stored context; the number is
      expect(session.getContext()).toEqual({ x: 10 })
    } finally {
      await session.close()
    }
  })

  it('a class instance is recreated by replay; plain data is restored from the facet', async () => {
    const session = await createReplSession({ local: true })
    try {
      await session.eval('class Box { constructor(v) { this.v = v } get() { return this.v } }')
      await session.eval('const box = new Box(7)')
      await session.eval('const list = [1, 2, 3]')
      const result = await session.eval('list.push(box.get()); list')
      expect(result.success, result.error).toBe(true)
      expect(result.value).toEqual([1, 2, 3, 7])
      expect((await session.eval('list.length')).value).toBe(4)
    } finally {
      await session.close()
    }
  })

  it('sessions are isolated: one sandboxId per session', async () => {
    const a = await createReplSession({ local: true })
    const b = await createReplSession({ local: true })
    try {
      expect(a.sandboxId).not.toBe(b.sandboxId)
      await a.eval('const secret = "a"')
      const result = await b.eval('typeof secret')
      expect(result.success, result.error).toBe(true)
      expect(result.value).toBe('undefined')
    } finally {
      await a.close()
      await b.close()
    }
  })

  it('sessions with the same sandboxId share the facet (state outlives a session)', async () => {
    const sandboxId = `repl-shared-${crypto.randomUUID()}`
    const first = await createReplSession({ local: true, sandboxId })
    await first.eval('const shared = { hits: 1 }')
    await first.close()
    // The client forgets; the facet remembers. A fresh session on the same
    // sandbox finds the variable in scope again.
    const second = await createReplSession({ local: true, sandboxId })
    try {
      const result = await second.eval('shared.hits += 1; shared.hits')
      expect(result.success, result.error).toBe(true)
      expect(result.value).toBe(2)
      expect(second.getContext()).toEqual({ shared: { hits: 2 } })
    } finally {
      await second.close()
    }
  })

  it('setContext and clearContext apply at the next evaluation', async () => {
    const session = await createReplSession({ local: true })
    try {
      session.setContext('seed', { n: 5 })
      expect((await session.eval('seed.n * 2')).value).toBe(10)
      session.clearContext()
      const result = await session.eval('typeof seed')
      expect(result.success, result.error).toBe(true)
      expect(result.value).toBe('undefined')
      expect(session.getContext()).toEqual({})
    } finally {
      await session.close()
    }
  })

  it('prelude exports are in scope of every evaluation', async () => {
    const session = await createReplSession({
      local: true,
      prelude: 'export const double = (n) => n * 2',
    })
    try {
      await session.runPrelude()
      expect((await session.eval('double(21)')).value).toBe(42)
    } finally {
      await session.close()
    }
  })

  it('errors come back as results, and the failed code is not replayed', async () => {
    const session = await createReplSession({ local: true })
    try {
      const failed = await session.eval('const boom = (() => { throw new Error("nope") })()')
      expect(failed.success).toBe(false)
      expect(failed.error).toContain('nope')
      const ok = await session.eval('1 + 1')
      expect(ok.success, ok.error).toBe(true)
      expect(ok.value).toBe(2)
    } finally {
      await session.close()
    }
  })

  it('the facet is the ReplState class, reached as env.REPL', async () => {
    const session = await createReplSession({ local: true })
    try {
      const result = await session.eval(
        `Object.keys(env).concat(typeof env.${REPL_FACET_BINDING}.load)`
      )
      expect(result.value).toEqual([REPL_FACET_BINDING, 'function'])
      expect(REPL_FACET_CLASS).toBe('ReplState')
    } finally {
      await session.close()
    }
  })
})

describe('quickEval', () => {
  it('evaluates one expression', async () => {
    const result = await quickEval('1 + 2 * 3', { local: true })
    expect(result.success, result.error).toBe(true)
    expect(result.value).toBe(7)
  })
})
