/**
 * Assertion utilities powered by Chai
 *
 * Exposes expect, should, and assert APIs via RPC.
 * Uses Chai under the hood for battle-tested assertions.
 */

import * as chai from 'chai'
import { RpcTarget } from 'cloudflare:workers'

// Initialize chai's should
chai.should()

/**
 * Wrapper around Chai's expect that extends RpcTarget
 * This allows the assertion chain to work over RPC with promise pipelining
 */
export class Assertion extends RpcTarget {
  // Using 'any' to avoid complex type gymnastics with Chai's chainable types
  // (Deep, Nested, etc. don't match Chai.Assertion directly)
  private assertion: any

  constructor(value: unknown, message?: string) {
    super()
    this.assertion = chai.expect(value, message)
  }

  // Chainable language chains
  get to() { return this }
  get be() { return this }
  get been() { return this }
  get is() { return this }
  get that() { return this }
  get which() { return this }
  get and() { return this }
  get has() { return this }
  get have() { return this }
  get with() { return this }
  get at() { return this }
  get of() { return this }
  get same() { return this }
  get but() { return this }
  get does() { return this }
  get still() { return this }
  get also() { return this }

  // Negation
  get not(): Assertion {
    this.assertion = this.assertion.not
    return this
  }

  // Deep flag
  get deep(): Assertion {
    this.assertion = this.assertion.deep
    return this
  }

  // Nested flag
  get nested(): Assertion {
    this.assertion = this.assertion.nested
    return this
  }

  // Own flag
  get own(): Assertion {
    this.assertion = this.assertion.own
    return this
  }

  // Ordered flag
  get ordered(): Assertion {
    this.assertion = this.assertion.ordered
    return this
  }

  // Any flag
  get any(): Assertion {
    this.assertion = this.assertion.any
    return this
  }

  // All flag
  get all(): Assertion {
    this.assertion = this.assertion.all
    return this
  }

  // Length chain
  get length(): Assertion {
    this.assertion = this.assertion.length
    return this
  }

  // Type assertions
  get ok() { this.assertion.ok; return this }
  get true() { this.assertion.true; return this }
  get false() { this.assertion.false; return this }
  get null() { this.assertion.null; return this }
  get undefined() { this.assertion.undefined; return this }
  get NaN() { this.assertion.NaN; return this }
  get exist() { this.assertion.exist; return this }
  get empty() { this.assertion.empty; return this }
  get arguments() { this.assertion.arguments; return this }

  // Value assertions
  equal(value: unknown, message?: string) {
    this.assertion.equal(value, message)
    return this
  }

  equals(value: unknown, message?: string) {
    return this.equal(value, message)
  }

  eq(value: unknown, message?: string) {
    return this.equal(value, message)
  }

  eql(value: unknown, message?: string) {
    this.assertion.eql(value, message)
    return this
  }

  eqls(value: unknown, message?: string) {
    return this.eql(value, message)
  }

  above(value: number, message?: string) {
    this.assertion.above(value, message)
    return this
  }

  gt(value: number, message?: string) {
    return this.above(value, message)
  }

  greaterThan(value: number, message?: string) {
    return this.above(value, message)
  }

  least(value: number, message?: string) {
    this.assertion.least(value, message)
    return this
  }

  gte(value: number, message?: string) {
    return this.least(value, message)
  }

  greaterThanOrEqual(value: number, message?: string) {
    return this.least(value, message)
  }

  below(value: number, message?: string) {
    this.assertion.below(value, message)
    return this
  }

  lt(value: number, message?: string) {
    return this.below(value, message)
  }

  lessThan(value: number, message?: string) {
    return this.below(value, message)
  }

  most(value: number, message?: string) {
    this.assertion.most(value, message)
    return this
  }

  lte(value: number, message?: string) {
    return this.most(value, message)
  }

  lessThanOrEqual(value: number, message?: string) {
    return this.most(value, message)
  }

  within(start: number, finish: number, message?: string) {
    this.assertion.within(start, finish, message)
    return this
  }

  instanceof(constructor: unknown, message?: string) {
    this.assertion.instanceof(constructor as any, message)
    return this
  }

  instanceOf(constructor: unknown, message?: string) {
    return this.instanceof(constructor, message)
  }

  property(name: string, value?: unknown, message?: string) {
    if (arguments.length > 1) {
      this.assertion.property(name, value, message)
    } else {
      this.assertion.property(name)
    }
    return this
  }

  ownProperty(name: string, message?: string) {
    this.assertion.ownProperty(name, message)
    return this
  }

  haveOwnProperty(name: string, message?: string) {
    return this.ownProperty(name, message)
  }

  ownPropertyDescriptor(name: string, descriptor?: PropertyDescriptor, message?: string) {
    this.assertion.ownPropertyDescriptor(name, descriptor, message)
    return this
  }

  lengthOf(n: number, message?: string) {
    this.assertion.lengthOf(n, message)
    return this
  }

  match(re: RegExp, message?: string) {
    this.assertion.match(re, message)
    return this
  }

  matches(re: RegExp, message?: string) {
    return this.match(re, message)
  }

  string(str: string, message?: string) {
    this.assertion.string(str, message)
    return this
  }

  keys(...keys: string[]) {
    this.assertion.keys(...keys)
    return this
  }

  key(...keys: string[]) {
    return this.keys(...keys)
  }

  throw(errorLike?: unknown, errMsgMatcher?: string | RegExp, message?: string) {
    this.assertion.throw(errorLike as any, errMsgMatcher, message)
    return this
  }

  throws(errorLike?: unknown, errMsgMatcher?: string | RegExp, message?: string) {
    return this.throw(errorLike, errMsgMatcher, message)
  }

  Throw(errorLike?: unknown, errMsgMatcher?: string | RegExp, message?: string) {
    return this.throw(errorLike, errMsgMatcher, message)
  }

  respondTo(method: string, message?: string) {
    this.assertion.respondTo(method, message)
    return this
  }

  respondsTo(method: string, message?: string) {
    return this.respondTo(method, message)
  }

  satisfy(matcher: (val: unknown) => boolean, message?: string) {
    this.assertion.satisfy(matcher, message)
    return this
  }

  satisfies(matcher: (val: unknown) => boolean, message?: string) {
    return this.satisfy(matcher, message)
  }

  closeTo(expected: number, delta: number, message?: string) {
    this.assertion.closeTo(expected, delta, message)
    return this
  }

  approximately(expected: number, delta: number, message?: string) {
    return this.closeTo(expected, delta, message)
  }

  members(set: unknown[], message?: string) {
    this.assertion.members(set, message)
    return this
  }

  oneOf(list: unknown[], message?: string) {
    this.assertion.oneOf(list, message)
    return this
  }

  include(value: unknown, message?: string) {
    this.assertion.include(value, message)
    return this
  }

  includes(value: unknown, message?: string) {
    return this.include(value, message)
  }

  contain(value: unknown, message?: string) {
    return this.include(value, message)
  }

  contains(value: unknown, message?: string) {
    return this.include(value, message)
  }

  a(type: string, message?: string) {
    this.assertion.a(type, message)
    return this
  }

  an(type: string, message?: string) {
    return this.a(type, message)
  }

  // Vitest-compatible aliases
  toBe(value: unknown) {
    this.assertion.equal(value)
    return this
  }

  toEqual(value: unknown) {
    this.assertion.deep.equal(value)
    return this
  }

  toStrictEqual(value: unknown) {
    this.assertion.deep.equal(value)
    return this
  }

  toBeTruthy() {
    this.assertion.ok
    return this
  }

  toBeFalsy() {
    this.assertion.not.ok
    return this
  }

  toBeNull() {
    this.assertion.null
    return this
  }

  toBeUndefined() {
    this.assertion.undefined
    return this
  }

  toBeDefined() {
    this.assertion.not.undefined
    return this
  }

  toBeNaN() {
    this.assertion.NaN
    return this
  }

  toContain(value: unknown) {
    this.assertion.include(value)
    return this
  }

  toHaveLength(length: number) {
    this.assertion.lengthOf(length)
    return this
  }

  toHaveProperty(path: string, value?: unknown) {
    if (arguments.length > 1) {
      this.assertion.nested.property(path, value)
    } else {
      this.assertion.nested.property(path)
    }
    return this
  }

  toMatch(pattern: RegExp | string) {
    if (typeof pattern === 'string') {
      this.assertion.include(pattern)
    } else {
      this.assertion.match(pattern)
    }
    return this
  }

  toMatchObject(obj: object) {
    this.assertion.deep.include(obj)
    return this
  }

  toThrow(expected?: string | RegExp | Error) {
    if (expected) {
      this.assertion.throw(expected as any)
    } else {
      this.assertion.throw()
    }
    return this
  }

  toBeGreaterThan(n: number) {
    this.assertion.above(n)
    return this
  }

  toBeLessThan(n: number) {
    this.assertion.below(n)
    return this
  }

  toBeGreaterThanOrEqual(n: number) {
    this.assertion.least(n)
    return this
  }

  toBeLessThanOrEqual(n: number) {
    this.assertion.most(n)
    return this
  }

  toBeCloseTo(n: number, digits = 2) {
    const delta = Math.pow(10, -digits) / 2
    this.assertion.closeTo(n, delta)
    return this
  }

  toBeInstanceOf(cls: unknown) {
    this.assertion.instanceof(cls as any)
    return this
  }

  toBeTypeOf(type: string) {
    this.assertion.a(type)
    return this
  }
}

/**
 * Assert API - TDD style assertions
 */
export const assert = chai.assert

/**
 * Create an expect assertion
 */
export function expect(value: unknown, message?: string): Assertion {
  return new Assertion(value, message)
}

/**
 * Create a should-style assertion
 * Since we can't modify Object.prototype over RPC, this takes a value
 */
export function should(value: unknown): Assertion {
  return new Assertion(value)
}
