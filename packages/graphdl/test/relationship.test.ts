import { describe, it, expect } from 'vitest'
import {
  parseOperator,
  hasOperator,
  getOperator,
  isForwardOperator,
  isBackwardOperator,
  isFuzzyOperator,
  isExactOperator,
  OPERATOR_SEMANTICS,
  OPERATORS,
} from '../src/relationship.js'

describe('OPERATOR_SEMANTICS', () => {
  it('defines correct semantics for each operator', () => {
    expect(OPERATOR_SEMANTICS['->']).toEqual({ direction: 'forward', matchMode: 'exact' })
    expect(OPERATOR_SEMANTICS['~>']).toEqual({ direction: 'forward', matchMode: 'fuzzy' })
    expect(OPERATOR_SEMANTICS['<-']).toEqual({ direction: 'backward', matchMode: 'exact' })
    expect(OPERATOR_SEMANTICS['<~']).toEqual({ direction: 'backward', matchMode: 'fuzzy' })
  })
})

describe('OPERATORS', () => {
  it('lists all operators in order of specificity', () => {
    expect(OPERATORS).toEqual(['~>', '<~', '->', '<-'])
  })
})

describe('parseOperator', () => {
  describe('basic parsing', () => {
    it('parses forward exact operator', () => {
      const result = parseOperator('->Author')
      expect(result).toEqual({
        operator: '->',
        direction: 'forward',
        matchMode: 'exact',
        targetType: 'Author',
      })
    })

    it('parses forward fuzzy operator', () => {
      const result = parseOperator('~>Category')
      expect(result).toEqual({
        operator: '~>',
        direction: 'forward',
        matchMode: 'fuzzy',
        targetType: 'Category',
      })
    })

    it('parses backward exact operator', () => {
      const result = parseOperator('<-Post')
      expect(result).toEqual({
        operator: '<-',
        direction: 'backward',
        matchMode: 'exact',
        targetType: 'Post',
      })
    })

    it('parses backward fuzzy operator', () => {
      const result = parseOperator('<~Topic')
      expect(result).toEqual({
        operator: '<~',
        direction: 'backward',
        matchMode: 'fuzzy',
        targetType: 'Topic',
      })
    })

    it('returns null for non-operator strings', () => {
      expect(parseOperator('string')).toBeNull()
      expect(parseOperator('Author')).toBeNull()
      expect(parseOperator('Author.posts')).toBeNull()
    })
  })

  describe('with prompt', () => {
    it('extracts prompt before operator', () => {
      const result = parseOperator('What is the main category? ~>Category')
      expect(result?.prompt).toBe('What is the main category?')
      expect(result?.operator).toBe('~>')
      expect(result?.targetType).toBe('Category')
    })

    it('extracts multi-word prompt', () => {
      const result = parseOperator('Describe the primary author of this content ->Author')
      expect(result?.prompt).toBe('Describe the primary author of this content')
      expect(result?.targetType).toBe('Author')
    })
  })

  describe('with backref', () => {
    it('parses backref syntax', () => {
      const result = parseOperator('->User.posts')
      expect(result?.targetType).toBe('User')
      expect(result?.backref).toBe('posts')
    })

    it('parses backref with fuzzy operator', () => {
      const result = parseOperator('~>Category.items')
      expect(result?.targetType).toBe('Category')
      expect(result?.backref).toBe('items')
      expect(result?.matchMode).toBe('fuzzy')
    })
  })

  describe('with modifiers', () => {
    it('parses optional modifier', () => {
      const result = parseOperator('->Author?')
      expect(result?.targetType).toBe('Author')
      expect(result?.isOptional).toBe(true)
    })

    it('parses array modifier', () => {
      const result = parseOperator('->Tag[]')
      expect(result?.targetType).toBe('Tag')
      expect(result?.isArray).toBe(true)
    })

    it('parses optional array', () => {
      const result = parseOperator('->Tag[]?')
      expect(result?.targetType).toBe('Tag')
      expect(result?.isArray).toBe(true)
      expect(result?.isOptional).toBe(true)
    })
  })

  describe('with union types', () => {
    it('parses union types', () => {
      const result = parseOperator('->Person|Company|Organization')
      expect(result?.targetType).toBe('Person')
      expect(result?.unionTypes).toEqual(['Person', 'Company', 'Organization'])
    })

    it('parses union with modifiers', () => {
      const result = parseOperator('->Person|Company?')
      expect(result?.targetType).toBe('Person')
      expect(result?.isOptional).toBe(true)
    })
  })

  describe('with threshold', () => {
    it('parses threshold for fuzzy operator', () => {
      const result = parseOperator('~>Category(0.8)')
      expect(result?.targetType).toBe('Category')
      expect(result?.threshold).toBe(0.8)
    })

    it('parses threshold with modifiers', () => {
      const result = parseOperator('~>Category(0.9)?')
      expect(result?.targetType).toBe('Category')
      expect(result?.threshold).toBe(0.9)
      expect(result?.isOptional).toBe(true)
    })

    it('handles malformed threshold gracefully', () => {
      const result = parseOperator('~>Category(0.8')
      expect(result?.targetType).toBe('Category')
      expect(result?.threshold).toBeUndefined()
    })

    it('ignores invalid threshold values', () => {
      const result = parseOperator('~>Category(1.5)')
      expect(result?.threshold).toBeUndefined()
    })
  })
})

describe('hasOperator', () => {
  it('returns true for strings with operators', () => {
    expect(hasOperator('->Author')).toBe(true)
    expect(hasOperator('~>Category')).toBe(true)
    expect(hasOperator('<-Post')).toBe(true)
    expect(hasOperator('<~Topic')).toBe(true)
  })

  it('returns false for strings without operators', () => {
    expect(hasOperator('string')).toBe(false)
    expect(hasOperator('Author')).toBe(false)
    expect(hasOperator('Author.posts')).toBe(false)
  })
})

describe('getOperator', () => {
  it('returns the operator from a string', () => {
    expect(getOperator('->Author')).toBe('->')
    expect(getOperator('~>Category')).toBe('~>')
    expect(getOperator('<-Post')).toBe('<-')
    expect(getOperator('<~Topic')).toBe('<~')
  })

  it('returns null for strings without operators', () => {
    expect(getOperator('string')).toBeNull()
    expect(getOperator('Author')).toBeNull()
  })
})

describe('operator type checks', () => {
  describe('isForwardOperator', () => {
    it('returns true for forward operators', () => {
      expect(isForwardOperator('->')).toBe(true)
      expect(isForwardOperator('~>')).toBe(true)
    })

    it('returns false for backward operators', () => {
      expect(isForwardOperator('<-')).toBe(false)
      expect(isForwardOperator('<~')).toBe(false)
    })
  })

  describe('isBackwardOperator', () => {
    it('returns true for backward operators', () => {
      expect(isBackwardOperator('<-')).toBe(true)
      expect(isBackwardOperator('<~')).toBe(true)
    })

    it('returns false for forward operators', () => {
      expect(isBackwardOperator('->')).toBe(false)
      expect(isBackwardOperator('~>')).toBe(false)
    })
  })

  describe('isFuzzyOperator', () => {
    it('returns true for fuzzy operators', () => {
      expect(isFuzzyOperator('~>')).toBe(true)
      expect(isFuzzyOperator('<~')).toBe(true)
    })

    it('returns false for exact operators', () => {
      expect(isFuzzyOperator('->')).toBe(false)
      expect(isFuzzyOperator('<-')).toBe(false)
    })
  })

  describe('isExactOperator', () => {
    it('returns true for exact operators', () => {
      expect(isExactOperator('->')).toBe(true)
      expect(isExactOperator('<-')).toBe(true)
    })

    it('returns false for fuzzy operators', () => {
      expect(isExactOperator('~>')).toBe(false)
      expect(isExactOperator('<~')).toBe(false)
    })
  })
})
