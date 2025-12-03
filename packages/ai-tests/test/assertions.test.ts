import { describe, it, expect as vitestExpect } from 'vitest'
import { expect, should, assert, Assertion } from '../src/assertions.js'

describe('Assertion', () => {
  describe('expect()', () => {
    it('creates an Assertion instance', () => {
      const assertion = expect(42)
      vitestExpect(assertion).toBeInstanceOf(Assertion)
    })

    it('accepts an optional message', () => {
      const assertion = expect(42, 'custom message')
      vitestExpect(assertion).toBeInstanceOf(Assertion)
    })
  })

  describe('should()', () => {
    it('creates an Assertion instance', () => {
      const assertion = should(42)
      vitestExpect(assertion).toBeInstanceOf(Assertion)
    })
  })

  describe('assert', () => {
    it('exports chai assert object', () => {
      vitestExpect(assert).toBeDefined()
      vitestExpect(typeof assert.equal).toBe('function')
      vitestExpect(typeof assert.strictEqual).toBe('function')
      vitestExpect(typeof assert.deepEqual).toBe('function')
    })
  })
})

describe('Assertion chains', () => {
  describe('language chains', () => {
    it('to returns this', () => {
      const a = expect(42)
      vitestExpect(a.to).toBe(a)
    })

    it('be returns this', () => {
      const a = expect(42)
      vitestExpect(a.be).toBe(a)
    })

    it('been returns this', () => {
      const a = expect(42)
      vitestExpect(a.been).toBe(a)
    })

    it('is returns this', () => {
      const a = expect(42)
      vitestExpect(a.is).toBe(a)
    })

    it('that returns this', () => {
      const a = expect(42)
      vitestExpect(a.that).toBe(a)
    })

    it('which returns this', () => {
      const a = expect(42)
      vitestExpect(a.which).toBe(a)
    })

    it('and returns this', () => {
      const a = expect(42)
      vitestExpect(a.and).toBe(a)
    })

    it('has returns this', () => {
      const a = expect(42)
      vitestExpect(a.has).toBe(a)
    })

    it('have returns this', () => {
      const a = expect(42)
      vitestExpect(a.have).toBe(a)
    })

    it('with returns this', () => {
      const a = expect(42)
      vitestExpect(a.with).toBe(a)
    })

    it('at returns this', () => {
      const a = expect(42)
      vitestExpect(a.at).toBe(a)
    })

    it('of returns this', () => {
      const a = expect(42)
      vitestExpect(a.of).toBe(a)
    })

    it('same returns this', () => {
      const a = expect(42)
      vitestExpect(a.same).toBe(a)
    })

    it('but returns this', () => {
      const a = expect(42)
      vitestExpect(a.but).toBe(a)
    })

    it('does returns this', () => {
      const a = expect(42)
      vitestExpect(a.does).toBe(a)
    })

    it('still returns this', () => {
      const a = expect(42)
      vitestExpect(a.still).toBe(a)
    })

    it('also returns this', () => {
      const a = expect(42)
      vitestExpect(a.also).toBe(a)
    })
  })

  describe('flags', () => {
    it('not sets negation flag', () => {
      const a = expect(42)
      vitestExpect(a.not).toBe(a)
    })

    it('deep sets deep flag', () => {
      const a = expect({ a: 1 })
      vitestExpect(a.deep).toBe(a)
    })

    it('nested sets nested flag', () => {
      const a = expect({ a: { b: 1 } })
      vitestExpect(a.nested).toBe(a)
    })

    it('own sets own flag', () => {
      const a = expect({ a: 1 })
      vitestExpect(a.own).toBe(a)
    })

    it('ordered sets ordered flag', () => {
      const a = expect([1, 2, 3])
      vitestExpect(a.ordered).toBe(a)
    })

    it('any sets any flag', () => {
      const a = expect({ a: 1 })
      vitestExpect(a.any).toBe(a)
    })

    it('all sets all flag', () => {
      const a = expect({ a: 1 })
      vitestExpect(a.all).toBe(a)
    })

    it('length returns this', () => {
      const a = expect([1, 2, 3])
      vitestExpect(a.length).toBe(a)
    })
  })
})

describe('Assertion methods', () => {
  describe('type assertions', () => {
    it('ok passes for truthy values', () => {
      vitestExpect(() => expect(1).ok).not.toThrow()
      vitestExpect(() => expect('a').ok).not.toThrow()
      vitestExpect(() => expect({}).ok).not.toThrow()
    })

    it('true passes for true', () => {
      vitestExpect(() => expect(true).true).not.toThrow()
    })

    it('false passes for false', () => {
      vitestExpect(() => expect(false).false).not.toThrow()
    })

    it('null passes for null', () => {
      vitestExpect(() => expect(null).null).not.toThrow()
    })

    it('undefined passes for undefined', () => {
      vitestExpect(() => expect(undefined).undefined).not.toThrow()
    })

    it('NaN passes for NaN', () => {
      vitestExpect(() => expect(NaN).NaN).not.toThrow()
    })

    it('exist passes for non-null/undefined', () => {
      vitestExpect(() => expect(0).exist).not.toThrow()
      vitestExpect(() => expect('').exist).not.toThrow()
    })

    it('empty passes for empty values', () => {
      vitestExpect(() => expect([]).empty).not.toThrow()
      vitestExpect(() => expect('').empty).not.toThrow()
      vitestExpect(() => expect({}).empty).not.toThrow()
    })
  })

  describe('equal', () => {
    it('passes for equal values', () => {
      vitestExpect(() => expect(42).equal(42)).not.toThrow()
      vitestExpect(() => expect('a').equal('a')).not.toThrow()
    })

    it('fails for unequal values', () => {
      vitestExpect(() => expect(42).equal(43)).toThrow()
    })

    it('equals is alias', () => {
      vitestExpect(() => expect(42).equals(42)).not.toThrow()
    })

    it('eq is alias', () => {
      vitestExpect(() => expect(42).eq(42)).not.toThrow()
    })
  })

  describe('eql (deep equal)', () => {
    it('passes for deeply equal objects', () => {
      vitestExpect(() => expect({ a: 1 }).eql({ a: 1 })).not.toThrow()
      vitestExpect(() => expect([1, 2]).eql([1, 2])).not.toThrow()
    })

    it('fails for non-equal objects', () => {
      vitestExpect(() => expect({ a: 1 }).eql({ a: 2 })).toThrow()
    })

    it('eqls is alias', () => {
      vitestExpect(() => expect({ a: 1 }).eqls({ a: 1 })).not.toThrow()
    })
  })

  describe('above/below/within', () => {
    it('above passes when value is greater', () => {
      vitestExpect(() => expect(10).above(5)).not.toThrow()
    })

    it('above fails when value is not greater', () => {
      vitestExpect(() => expect(5).above(10)).toThrow()
    })

    it('gt is alias for above', () => {
      vitestExpect(() => expect(10).gt(5)).not.toThrow()
    })

    it('greaterThan is alias for above', () => {
      vitestExpect(() => expect(10).greaterThan(5)).not.toThrow()
    })

    it('least passes when value is >= ', () => {
      vitestExpect(() => expect(10).least(10)).not.toThrow()
      vitestExpect(() => expect(10).least(5)).not.toThrow()
    })

    it('gte is alias for least', () => {
      vitestExpect(() => expect(10).gte(10)).not.toThrow()
    })

    it('below passes when value is less', () => {
      vitestExpect(() => expect(5).below(10)).not.toThrow()
    })

    it('lt is alias for below', () => {
      vitestExpect(() => expect(5).lt(10)).not.toThrow()
    })

    it('most passes when value is <=', () => {
      vitestExpect(() => expect(10).most(10)).not.toThrow()
      vitestExpect(() => expect(5).most(10)).not.toThrow()
    })

    it('lte is alias for most', () => {
      vitestExpect(() => expect(10).lte(10)).not.toThrow()
    })

    it('within passes when value is in range', () => {
      vitestExpect(() => expect(5).within(1, 10)).not.toThrow()
    })
  })

  describe('instanceof', () => {
    it('passes for correct instance', () => {
      vitestExpect(() => expect(new Error()).instanceof(Error)).not.toThrow()
    })

    it('instanceOf is alias', () => {
      vitestExpect(() => expect(new Error()).instanceOf(Error)).not.toThrow()
    })
  })

  describe('property', () => {
    it('passes when property exists', () => {
      vitestExpect(() => expect({ a: 1 }).property('a')).not.toThrow()
    })

    it('passes when property has expected value', () => {
      vitestExpect(() => expect({ a: 1 }).property('a', 1)).not.toThrow()
    })

    it('fails when property does not exist', () => {
      vitestExpect(() => expect({}).property('a')).toThrow()
    })
  })

  describe('ownProperty', () => {
    it('passes for own property with value', () => {
      vitestExpect(() => expect({ a: 1 }).ownProperty('a', 1)).not.toThrow()
    })

    it('haveOwnProperty is alias', () => {
      vitestExpect(() => expect({ a: 1 }).haveOwnProperty('a', 1)).not.toThrow()
    })
  })

  describe('lengthOf', () => {
    it('passes for correct length', () => {
      vitestExpect(() => expect([1, 2, 3]).lengthOf(3)).not.toThrow()
      vitestExpect(() => expect('abc').lengthOf(3)).not.toThrow()
    })
  })

  describe('match', () => {
    it('passes when string matches regex', () => {
      vitestExpect(() => expect('hello').match(/ell/)).not.toThrow()
    })

    it('matches is alias', () => {
      vitestExpect(() => expect('hello').matches(/ell/)).not.toThrow()
    })
  })

  describe('string', () => {
    it('passes when string contains substring', () => {
      vitestExpect(() => expect('hello world').string('world')).not.toThrow()
    })
  })

  describe('keys', () => {
    it('passes when object has keys', () => {
      vitestExpect(() => expect({ a: 1, b: 2 }).keys('a', 'b')).not.toThrow()
    })

    it('key is alias', () => {
      vitestExpect(() => expect({ a: 1 }).key('a')).not.toThrow()
    })
  })

  describe('throw', () => {
    it('passes when function throws', () => {
      vitestExpect(() => expect(() => { throw new Error() }).throw()).not.toThrow()
    })

    it('throws is alias', () => {
      vitestExpect(() => expect(() => { throw new Error() }).throws()).not.toThrow()
    })

    it('Throw is alias', () => {
      vitestExpect(() => expect(() => { throw new Error() }).Throw()).not.toThrow()
    })
  })

  describe('respondTo', () => {
    it('passes when object has method', () => {
      vitestExpect(() => expect({ foo: () => {} }).respondTo('foo')).not.toThrow()
    })

    it('respondsTo is alias', () => {
      vitestExpect(() => expect({ foo: () => {} }).respondsTo('foo')).not.toThrow()
    })
  })

  describe('satisfy', () => {
    it('passes when matcher returns true', () => {
      vitestExpect(() => expect(10).satisfy((n: number) => n > 5)).not.toThrow()
    })

    it('satisfies is alias', () => {
      vitestExpect(() => expect(10).satisfies((n: number) => n > 5)).not.toThrow()
    })
  })

  describe('closeTo', () => {
    it('passes when value is close', () => {
      vitestExpect(() => expect(1.5).closeTo(1.5, 0.01)).not.toThrow()
    })

    it('approximately is alias', () => {
      vitestExpect(() => expect(1.5).approximately(1.5, 0.01)).not.toThrow()
    })
  })

  describe('members', () => {
    it('passes when array has members', () => {
      vitestExpect(() => expect([1, 2, 3]).members([1, 2, 3])).not.toThrow()
    })
  })

  describe('oneOf', () => {
    it('passes when value is in list', () => {
      vitestExpect(() => expect(2).oneOf([1, 2, 3])).not.toThrow()
    })
  })

  describe('include', () => {
    it('passes when array includes value', () => {
      vitestExpect(() => expect([1, 2, 3]).include(2)).not.toThrow()
    })

    it('includes is alias', () => {
      vitestExpect(() => expect([1, 2, 3]).includes(2)).not.toThrow()
    })

    it('contain is alias', () => {
      vitestExpect(() => expect([1, 2, 3]).contain(2)).not.toThrow()
    })

    it('contains is alias', () => {
      vitestExpect(() => expect([1, 2, 3]).contains(2)).not.toThrow()
    })
  })

  describe('a/an', () => {
    it('passes for correct type', () => {
      vitestExpect(() => expect('hello').a('string')).not.toThrow()
      vitestExpect(() => expect([]).an('array')).not.toThrow()
    })
  })
})

describe('Vitest-compatible matchers', () => {
  describe('toBe', () => {
    it('passes for strictly equal values', () => {
      vitestExpect(() => expect(42).toBe(42)).not.toThrow()
    })

    it('fails for different values', () => {
      vitestExpect(() => expect(42).toBe(43)).toThrow()
    })
  })

  describe('toEqual', () => {
    it('passes for deeply equal objects', () => {
      vitestExpect(() => expect({ a: 1 }).toEqual({ a: 1 })).not.toThrow()
    })
  })

  describe('toStrictEqual', () => {
    it('passes for deeply equal objects', () => {
      vitestExpect(() => expect({ a: 1 }).toStrictEqual({ a: 1 })).not.toThrow()
    })
  })

  describe('toBeTruthy', () => {
    it('passes for truthy values', () => {
      vitestExpect(() => expect(1).toBeTruthy()).not.toThrow()
      vitestExpect(() => expect('a').toBeTruthy()).not.toThrow()
    })
  })

  describe('toBeFalsy', () => {
    it('passes for falsy values', () => {
      vitestExpect(() => expect(0).toBeFalsy()).not.toThrow()
      vitestExpect(() => expect('').toBeFalsy()).not.toThrow()
    })
  })

  describe('toBeNull', () => {
    it('passes for null', () => {
      vitestExpect(() => expect(null).toBeNull()).not.toThrow()
    })
  })

  describe('toBeUndefined', () => {
    it('passes for undefined', () => {
      vitestExpect(() => expect(undefined).toBeUndefined()).not.toThrow()
    })
  })

  describe('toBeDefined', () => {
    it('passes for defined values', () => {
      vitestExpect(() => expect(0).toBeDefined()).not.toThrow()
    })
  })

  describe('toBeNaN', () => {
    it('passes for NaN', () => {
      vitestExpect(() => expect(NaN).toBeNaN()).not.toThrow()
    })
  })

  describe('toContain', () => {
    it('passes when array contains value', () => {
      vitestExpect(() => expect([1, 2, 3]).toContain(2)).not.toThrow()
    })
  })

  describe('toHaveLength', () => {
    it('passes for correct length', () => {
      vitestExpect(() => expect([1, 2, 3]).toHaveLength(3)).not.toThrow()
    })
  })

  describe('toHaveProperty', () => {
    it('passes when property exists', () => {
      vitestExpect(() => expect({ a: { b: 1 } }).toHaveProperty('a.b')).not.toThrow()
    })

    it('passes when property has value', () => {
      vitestExpect(() => expect({ a: { b: 1 } }).toHaveProperty('a.b', 1)).not.toThrow()
    })
  })

  describe('toMatch', () => {
    it('passes when string matches pattern', () => {
      vitestExpect(() => expect('hello').toMatch(/ell/)).not.toThrow()
    })

    it('passes when string contains substring', () => {
      vitestExpect(() => expect('hello').toMatch('ell')).not.toThrow()
    })
  })

  describe('toMatchObject', () => {
    it('passes when object matches subset', () => {
      vitestExpect(() => expect({ a: 1, b: 2 }).toMatchObject({ a: 1 })).not.toThrow()
    })
  })

  describe('toThrow', () => {
    it('passes when function throws', () => {
      vitestExpect(() => expect(() => { throw new Error('test') }).toThrow()).not.toThrow()
    })

    it('passes when error matches string', () => {
      vitestExpect(() => expect(() => { throw new Error('test') }).toThrow('test')).not.toThrow()
    })

    it('passes when error matches regex', () => {
      vitestExpect(() => expect(() => { throw new Error('test') }).toThrow(/test/)).not.toThrow()
    })
  })

  describe('toBeGreaterThan', () => {
    it('passes when value is greater', () => {
      vitestExpect(() => expect(10).toBeGreaterThan(5)).not.toThrow()
    })
  })

  describe('toBeLessThan', () => {
    it('passes when value is less', () => {
      vitestExpect(() => expect(5).toBeLessThan(10)).not.toThrow()
    })
  })

  describe('toBeGreaterThanOrEqual', () => {
    it('passes when value is >=', () => {
      vitestExpect(() => expect(10).toBeGreaterThanOrEqual(10)).not.toThrow()
    })
  })

  describe('toBeLessThanOrEqual', () => {
    it('passes when value is <=', () => {
      vitestExpect(() => expect(10).toBeLessThanOrEqual(10)).not.toThrow()
    })
  })

  describe('toBeCloseTo', () => {
    it('passes when value is close', () => {
      vitestExpect(() => expect(0.1 + 0.2).toBeCloseTo(0.3)).not.toThrow()
    })
  })

  describe('toBeInstanceOf', () => {
    it('passes for correct instance', () => {
      vitestExpect(() => expect(new Error()).toBeInstanceOf(Error)).not.toThrow()
    })
  })

  describe('toBeTypeOf', () => {
    it('passes for correct type', () => {
      vitestExpect(() => expect('hello').toBeTypeOf('string')).not.toThrow()
      vitestExpect(() => expect(42).toBeTypeOf('number')).not.toThrow()
    })
  })
})

describe('Chained assertions', () => {
  it('supports chaining multiple checks', () => {
    vitestExpect(() => {
      expect(42).to.be.a('number').and.equal(42).and.above(40)
    }).not.toThrow()
  })

  it('supports not negation', () => {
    vitestExpect(() => expect(42).to.not.equal(43)).not.toThrow()
  })

  it('supports deep comparison', () => {
    vitestExpect(() => expect({ a: 1 }).to.deep.equal({ a: 1 })).not.toThrow()
  })
})
