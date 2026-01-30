import { describe, it, expect } from 'vitest'
import {
  capitalize,
  preserveCase,
  isVowel,
  splitCamelCase,
  toKebabCase,
  toPastParticiple,
  toActor,
  toPresent,
  toGerund,
  toResult,
  pluralize,
  singularize,
} from '../src/linguistic.js'

describe('linguistic helpers', () => {
  describe('capitalize', () => {
    it('capitalizes first letter', () => {
      expect(capitalize('hello')).toBe('Hello')
      expect(capitalize('world')).toBe('World')
    })

    it('handles empty string', () => {
      expect(capitalize('')).toBe('')
    })

    it('handles already capitalized', () => {
      expect(capitalize('Hello')).toBe('Hello')
    })
  })

  describe('preserveCase', () => {
    it('preserves capitalization from original', () => {
      expect(preserveCase('Person', 'people')).toBe('People')
      expect(preserveCase('person', 'people')).toBe('people')
    })
  })

  describe('isVowel', () => {
    it('identifies vowels', () => {
      expect(isVowel('a')).toBe(true)
      expect(isVowel('e')).toBe(true)
      expect(isVowel('i')).toBe(true)
      expect(isVowel('o')).toBe(true)
      expect(isVowel('u')).toBe(true)
    })

    it('identifies consonants', () => {
      expect(isVowel('b')).toBe(false)
      expect(isVowel('c')).toBe(false)
      expect(isVowel('z')).toBe(false)
    })

    it('handles undefined', () => {
      expect(isVowel(undefined)).toBe(false)
    })
  })

  describe('splitCamelCase', () => {
    it('splits PascalCase', () => {
      expect(splitCamelCase('BlogPost')).toEqual(['Blog', 'Post'])
      expect(splitCamelCase('UserProfile')).toEqual(['User', 'Profile'])
    })

    it('splits camelCase', () => {
      expect(splitCamelCase('blogPost')).toEqual(['blog', 'Post'])
    })

    it('handles single word', () => {
      expect(splitCamelCase('User')).toEqual(['User'])
    })

    it('handles multiple words', () => {
      expect(splitCamelCase('BlogPostComment')).toEqual(['Blog', 'Post', 'Comment'])
    })
  })

  describe('toKebabCase', () => {
    it('converts PascalCase to kebab-case', () => {
      expect(toKebabCase('BlogPost')).toBe('blog-post')
      expect(toKebabCase('UserProfile')).toBe('user-profile')
    })

    it('handles single word', () => {
      expect(toKebabCase('User')).toBe('user')
    })
  })
})

describe('verb conjugation', () => {
  describe('toPastParticiple', () => {
    it('adds -d to verbs ending in e', () => {
      expect(toPastParticiple('create')).toBe('created')
      expect(toPastParticiple('update')).toBe('updated')
    })

    it('adds -ed to regular verbs', () => {
      expect(toPastParticiple('publish')).toBe('published')
      expect(toPastParticiple('delete')).toBe('deleted')
    })

    it('handles -y ending', () => {
      expect(toPastParticiple('carry')).toBe('carried')
      expect(toPastParticiple('play')).toBe('played') // vowel before y
    })

    it('doubles consonant for CVC pattern', () => {
      expect(toPastParticiple('submit')).toBe('submitted')
      expect(toPastParticiple('stop')).toBe('stopped')
      expect(toPastParticiple('run')).toBe('runned') // short word
    })
  })

  describe('toActor', () => {
    it('converts -ate verbs to -ator', () => {
      expect(toActor('create')).toBe('creator')
      expect(toActor('validate')).toBe('validator')
      expect(toActor('generate')).toBe('generator')
    })

    it('converts update to updator (as -ate verb)', () => {
      // 'update' ends in 'ate' so it becomes 'updator'
      expect(toActor('update')).toBe('updator')
    })

    it('adds -r to other verbs ending in e (non -ate)', () => {
      expect(toActor('delete')).toBe('deleter')
      expect(toActor('configure')).toBe('configurer')
    })

    it('adds -er to regular verbs', () => {
      expect(toActor('publish')).toBe('publisher')
      expect(toActor('build')).toBe('builder')
    })

    it('handles -y ending', () => {
      expect(toActor('carry')).toBe('carrier')
    })

    it('doubles consonant for CVC pattern', () => {
      expect(toActor('submit')).toBe('submitter')
    })
  })

  describe('toPresent', () => {
    it('adds -s to regular verbs', () => {
      expect(toPresent('create')).toBe('creates')
      expect(toPresent('update')).toBe('updates')
    })

    it('adds -es to verbs ending in s, x, z, ch, sh', () => {
      expect(toPresent('publish')).toBe('publishes')
      expect(toPresent('push')).toBe('pushes')
      expect(toPresent('watch')).toBe('watches')
    })

    it('handles -y ending', () => {
      expect(toPresent('carry')).toBe('carries')
      expect(toPresent('play')).toBe('plays') // vowel before y
    })
  })

  describe('toGerund', () => {
    it('removes -e and adds -ing', () => {
      expect(toGerund('create')).toBe('creating')
      expect(toGerund('update')).toBe('updating')
    })

    it('adds -ing to regular verbs', () => {
      expect(toGerund('publish')).toBe('publishing')
    })

    it('handles -ie ending', () => {
      expect(toGerund('die')).toBe('dying')
      expect(toGerund('lie')).toBe('lying')
    })

    it('doubles consonant for CVC pattern', () => {
      expect(toGerund('submit')).toBe('submitting')
      expect(toGerund('run')).toBe('running')
    })
  })

  describe('toResult', () => {
    it('handles -ate verbs', () => {
      expect(toResult('create')).toBe('creation')
      expect(toResult('generate')).toBe('generation')
    })

    it('handles -ify verbs', () => {
      expect(toResult('verify')).toBe('verification')
    })

    it('handles -ize verbs', () => {
      expect(toResult('organize')).toBe('organization')
    })

    it('handles regular verbs', () => {
      expect(toResult('publish')).toBe('publishion')
    })
  })
})

describe('noun pluralization', () => {
  describe('pluralize', () => {
    it('adds -s to regular nouns', () => {
      expect(pluralize('post')).toBe('posts')
      expect(pluralize('user')).toBe('users')
    })

    it('adds -es to nouns ending in s, x, z, ch, sh', () => {
      expect(pluralize('bus')).toBe('buses')
      expect(pluralize('box')).toBe('boxes')
      expect(pluralize('buzz')).toBe('buzzes')
      expect(pluralize('watch')).toBe('watches')
      expect(pluralize('wish')).toBe('wishes')
    })

    it('handles -y ending', () => {
      expect(pluralize('category')).toBe('categories')
      expect(pluralize('day')).toBe('days') // vowel before y
    })

    it('handles -f ending', () => {
      expect(pluralize('leaf')).toBe('leaves')
    })

    it('handles -z that doubles', () => {
      expect(pluralize('quiz')).toBe('quizzes')
    })

    it('handles irregular plurals', () => {
      expect(pluralize('person')).toBe('people')
      expect(pluralize('child')).toBe('children')
      expect(pluralize('man')).toBe('men')
      expect(pluralize('woman')).toBe('women')
      expect(pluralize('foot')).toBe('feet')
      expect(pluralize('tooth')).toBe('teeth')
      expect(pluralize('mouse')).toBe('mice')
    })

    it('preserves case', () => {
      expect(pluralize('Person')).toBe('People')
      expect(pluralize('Child')).toBe('Children')
    })
  })

  describe('singularize', () => {
    it('removes -s from regular nouns', () => {
      expect(singularize('posts')).toBe('post')
      expect(singularize('users')).toBe('user')
    })

    it('handles -es ending', () => {
      expect(singularize('buses')).toBe('bus')
      expect(singularize('boxes')).toBe('box')
      expect(singularize('watches')).toBe('watch')
      expect(singularize('wishes')).toBe('wish')
    })

    it('handles -ies ending', () => {
      expect(singularize('categories')).toBe('category')
    })

    it('handles -ves ending', () => {
      expect(singularize('leaves')).toBe('leaf')
    })

    it('handles irregular singulars', () => {
      expect(singularize('people')).toBe('person')
      expect(singularize('children')).toBe('child')
      expect(singularize('men')).toBe('man')
      expect(singularize('women')).toBe('woman')
      expect(singularize('feet')).toBe('foot')
      expect(singularize('teeth')).toBe('tooth')
      expect(singularize('mice')).toBe('mouse')
    })

    it('preserves case', () => {
      expect(singularize('People')).toBe('Person')
      expect(singularize('Children')).toBe('Child')
    })
  })
})
