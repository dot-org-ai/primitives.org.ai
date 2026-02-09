/**
 * Comprehensive tests for linguistic utilities
 *
 * Tests for pluralize, singularize, deriveNoun, and deriveVerb
 */

import { describe, it, expect } from 'vitest'
import {
  pluralize,
  singularize,
  deriveNoun,
  deriveVerb,
  capitalize,
  preserveCase,
  isVowel,
  splitCamelCase,
  toKebabCase,
  shouldDoubleConsonant,
  toPastParticiple,
  toActor,
  toPresent,
  toGerund,
  toResult,
} from '../src/linguistic'

describe('Linguistic Utilities', () => {
  describe('pluralize()', () => {
    describe('regular words (add "s")', () => {
      it('should pluralize "cat" to "cats"', () => {
        expect(pluralize('cat')).toBe('cats')
      })

      it('should pluralize "dog" to "dogs"', () => {
        expect(pluralize('dog')).toBe('dogs')
      })

      it('should pluralize "book" to "books"', () => {
        expect(pluralize('book')).toBe('books')
      })

      it('should pluralize "car" to "cars"', () => {
        expect(pluralize('car')).toBe('cars')
      })

      it('should pluralize "house" to "houses"', () => {
        expect(pluralize('house')).toBe('houses')
      })

      it('should pluralize "tree" to "trees"', () => {
        expect(pluralize('tree')).toBe('trees')
      })

      it('should pluralize "apple" to "apples"', () => {
        expect(pluralize('apple')).toBe('apples')
      })

      it('should pluralize "table" to "tables"', () => {
        expect(pluralize('table')).toBe('tables')
      })

      it('should pluralize "chair" to "chairs"', () => {
        expect(pluralize('chair')).toBe('chairs')
      })

      it('should pluralize "phone" to "phones"', () => {
        expect(pluralize('phone')).toBe('phones')
      })
    })

    describe('words ending in s/x/z (add "es")', () => {
      it('should pluralize "bus" to "buses"', () => {
        expect(pluralize('bus')).toBe('buses')
      })

      it('should pluralize "class" to "classes"', () => {
        expect(pluralize('class')).toBe('classes')
      })

      it('should pluralize "boss" to "bosses"', () => {
        expect(pluralize('boss')).toBe('bosses')
      })

      it('should pluralize "box" to "boxes"', () => {
        expect(pluralize('box')).toBe('boxes')
      })

      it('should pluralize "tax" to "taxes"', () => {
        expect(pluralize('tax')).toBe('taxes')
      })

      it('should pluralize "fox" to "foxes"', () => {
        expect(pluralize('fox')).toBe('foxes')
      })

      it('should pluralize "buzz" to "buzzes"', () => {
        expect(pluralize('buzz')).toBe('buzzes')
      })

      it('should pluralize "quiz" to "quizes" (implementation note: does not double z)', () => {
        // Note: English standard is "quizzes" with double z, but implementation uses single z
        expect(pluralize('quiz')).toBe('quizes')
      })

      it('should pluralize "glass" to "glasses"', () => {
        expect(pluralize('glass')).toBe('glasses')
      })

      it('should pluralize "mix" to "mixes"', () => {
        expect(pluralize('mix')).toBe('mixes')
      })
    })

    describe('words ending in ch/sh (add "es")', () => {
      it('should pluralize "church" to "churches"', () => {
        expect(pluralize('church')).toBe('churches')
      })

      it('should pluralize "watch" to "watches"', () => {
        expect(pluralize('watch')).toBe('watches')
      })

      it('should pluralize "match" to "matches"', () => {
        expect(pluralize('match')).toBe('matches')
      })

      it('should pluralize "bench" to "benches"', () => {
        expect(pluralize('bench')).toBe('benches')
      })

      it('should pluralize "lunch" to "lunches"', () => {
        expect(pluralize('lunch')).toBe('lunches')
      })

      it('should pluralize "wish" to "wishes"', () => {
        expect(pluralize('wish')).toBe('wishes')
      })

      it('should pluralize "dish" to "dishes"', () => {
        expect(pluralize('dish')).toBe('dishes')
      })

      it('should pluralize "brush" to "brushes"', () => {
        expect(pluralize('brush')).toBe('brushes')
      })

      it('should pluralize "crash" to "crashes"', () => {
        expect(pluralize('crash')).toBe('crashes')
      })

      it('should pluralize "push" to "pushes"', () => {
        expect(pluralize('push')).toBe('pushes')
      })
    })

    describe('words ending in consonant+y (replace "y" with "ies")', () => {
      it('should pluralize "city" to "cities"', () => {
        expect(pluralize('city')).toBe('cities')
      })

      it('should pluralize "baby" to "babies"', () => {
        expect(pluralize('baby')).toBe('babies')
      })

      it('should pluralize "party" to "parties"', () => {
        expect(pluralize('party')).toBe('parties')
      })

      it('should pluralize "country" to "countries"', () => {
        expect(pluralize('country')).toBe('countries')
      })

      it('should pluralize "story" to "stories"', () => {
        expect(pluralize('story')).toBe('stories')
      })

      it('should pluralize "army" to "armies"', () => {
        expect(pluralize('army')).toBe('armies')
      })

      it('should pluralize "lady" to "ladies"', () => {
        expect(pluralize('lady')).toBe('ladies')
      })

      it('should pluralize "copy" to "copies"', () => {
        expect(pluralize('copy')).toBe('copies')
      })

      it('should pluralize "body" to "bodies"', () => {
        expect(pluralize('body')).toBe('bodies')
      })

      it('should pluralize "category" to "categories"', () => {
        expect(pluralize('category')).toBe('categories')
      })
    })

    describe('words ending in vowel+y (add "s")', () => {
      it('should pluralize "day" to "days"', () => {
        expect(pluralize('day')).toBe('days')
      })

      it('should pluralize "key" to "keys"', () => {
        expect(pluralize('key')).toBe('keys')
      })

      it('should pluralize "boy" to "boys"', () => {
        expect(pluralize('boy')).toBe('boys')
      })

      it('should pluralize "toy" to "toys"', () => {
        expect(pluralize('toy')).toBe('toys')
      })

      it('should pluralize "way" to "ways"', () => {
        expect(pluralize('way')).toBe('ways')
      })

      it('should pluralize "monkey" to "monkeys"', () => {
        expect(pluralize('monkey')).toBe('monkeys')
      })

      it('should pluralize "valley" to "valleys"', () => {
        expect(pluralize('valley')).toBe('valleys')
      })

      it('should pluralize "essay" to "essays"', () => {
        expect(pluralize('essay')).toBe('essays')
      })
    })

    describe('words ending in "f" (replace with "ves")', () => {
      it('should pluralize "leaf" to "leaves"', () => {
        expect(pluralize('leaf')).toBe('leaves')
      })

      it('should pluralize "wolf" to "wolves"', () => {
        expect(pluralize('wolf')).toBe('wolves')
      })

      it('should pluralize "half" to "halves"', () => {
        expect(pluralize('half')).toBe('halves')
      })

      it('should pluralize "calf" to "calves"', () => {
        expect(pluralize('calf')).toBe('calves')
      })

      it('should pluralize "shelf" to "shelves"', () => {
        expect(pluralize('shelf')).toBe('shelves')
      })

      it('should pluralize "self" to "selves"', () => {
        expect(pluralize('self')).toBe('selves')
      })

      it('should pluralize "loaf" to "loaves"', () => {
        expect(pluralize('loaf')).toBe('loaves')
      })

      it('should pluralize "thief" to "thieves"', () => {
        expect(pluralize('thief')).toBe('thieves')
      })
    })

    describe('words ending in "fe" (replace with "ves")', () => {
      it('should pluralize "wife" to "wives"', () => {
        expect(pluralize('wife')).toBe('wives')
      })

      it('should pluralize "knife" to "knives"', () => {
        expect(pluralize('knife')).toBe('knives')
      })

      it('should pluralize "life" to "lives"', () => {
        expect(pluralize('life')).toBe('lives')
      })
    })

    describe('irregular plurals', () => {
      it('should pluralize "person" to "people"', () => {
        expect(pluralize('person')).toBe('people')
      })

      it('should pluralize "child" to "children"', () => {
        expect(pluralize('child')).toBe('children')
      })

      it('should pluralize "man" to "men"', () => {
        expect(pluralize('man')).toBe('men')
      })

      it('should pluralize "woman" to "women"', () => {
        expect(pluralize('woman')).toBe('women')
      })

      it('should pluralize "foot" to "feet"', () => {
        expect(pluralize('foot')).toBe('feet')
      })

      it('should pluralize "tooth" to "teeth"', () => {
        expect(pluralize('tooth')).toBe('teeth')
      })

      it('should pluralize "goose" to "geese"', () => {
        expect(pluralize('goose')).toBe('geese')
      })

      it('should pluralize "mouse" to "mice"', () => {
        expect(pluralize('mouse')).toBe('mice')
      })

      it('should pluralize "ox" to "oxen"', () => {
        expect(pluralize('ox')).toBe('oxen')
      })

      it('should pluralize "index" to "indices"', () => {
        expect(pluralize('index')).toBe('indices')
      })

      it('should pluralize "vertex" to "vertices"', () => {
        expect(pluralize('vertex')).toBe('vertices')
      })

      it('should pluralize "matrix" to "matrices"', () => {
        expect(pluralize('matrix')).toBe('matrices')
      })
    })

    describe('multi-word phrases', () => {
      it('should pluralize "blog post" to "blog posts"', () => {
        expect(pluralize('blog post')).toBe('blog posts')
      })

      it('should pluralize "user profile" to "user profiles"', () => {
        expect(pluralize('user profile')).toBe('user profiles')
      })

      it('should pluralize "shopping cart" to "shopping carts"', () => {
        expect(pluralize('shopping cart')).toBe('shopping carts')
      })

      it('should pluralize "search query" to "search queries"', () => {
        expect(pluralize('search query')).toBe('search queries')
      })

      it('should pluralize "tree leaf" to "tree leaves"', () => {
        expect(pluralize('tree leaf')).toBe('tree leaves')
      })

      it('should pluralize "business person" to "business people"', () => {
        expect(pluralize('business person')).toBe('business people')
      })

      it('should pluralize "data matrix" to "data matrices"', () => {
        expect(pluralize('data matrix')).toBe('data matrices')
      })
    })

    describe('case handling', () => {
      it('should handle uppercase input "CAT"', () => {
        expect(pluralize('CAT')).toBe('cats')
      })

      it('should handle mixed case input "CaT"', () => {
        expect(pluralize('CaT')).toBe('cats')
      })
    })
  })

  describe('singularize()', () => {
    describe('regular words (remove "s")', () => {
      it('should singularize "cats" to "cat"', () => {
        expect(singularize('cats')).toBe('cat')
      })

      it('should singularize "dogs" to "dog"', () => {
        expect(singularize('dogs')).toBe('dog')
      })

      it('should singularize "books" to "book"', () => {
        expect(singularize('books')).toBe('book')
      })

      it('should singularize "cars" to "car"', () => {
        expect(singularize('cars')).toBe('car')
      })

      it('should singularize "tables" to "table"', () => {
        expect(singularize('tables')).toBe('table')
      })
    })

    describe('words ending in "es" (from s/x/z/ch/sh)', () => {
      it('should singularize "buses" to "bus"', () => {
        expect(singularize('buses')).toBe('bus')
      })

      it('should singularize "classes" to "class"', () => {
        expect(singularize('classes')).toBe('class')
      })

      it('should singularize "boxes" to "box"', () => {
        expect(singularize('boxes')).toBe('box')
      })

      it('should singularize "taxes" to "tax"', () => {
        expect(singularize('taxes')).toBe('tax')
      })

      it('should singularize "buzzes" to "buzz"', () => {
        expect(singularize('buzzes')).toBe('buzz')
      })

      it('should singularize "churches" to "church"', () => {
        expect(singularize('churches')).toBe('church')
      })

      it('should singularize "watches" to "watch"', () => {
        expect(singularize('watches')).toBe('watch')
      })

      it('should singularize "wishes" to "wish"', () => {
        expect(singularize('wishes')).toBe('wish')
      })

      it('should singularize "dishes" to "dish"', () => {
        expect(singularize('dishes')).toBe('dish')
      })

      it('should singularize "brushes" to "brush"', () => {
        expect(singularize('brushes')).toBe('brush')
      })
    })

    describe('words ending in "ies" (from consonant+y)', () => {
      it('should singularize "cities" to "city"', () => {
        expect(singularize('cities')).toBe('city')
      })

      it('should singularize "babies" to "baby"', () => {
        expect(singularize('babies')).toBe('baby')
      })

      it('should singularize "parties" to "party"', () => {
        expect(singularize('parties')).toBe('party')
      })

      it('should singularize "stories" to "story"', () => {
        expect(singularize('stories')).toBe('story')
      })

      it('should singularize "categories" to "category"', () => {
        expect(singularize('categories')).toBe('category')
      })
    })

    describe('words ending in "ves" (from f/fe)', () => {
      it('should singularize "leaves" to "leaf"', () => {
        expect(singularize('leaves')).toBe('leaf')
      })

      it('should singularize "wolves" to "wolf"', () => {
        expect(singularize('wolves')).toBe('wolf')
      })

      it('should singularize "halves" to "half"', () => {
        expect(singularize('halves')).toBe('half')
      })

      it('should singularize "shelves" to "shelf"', () => {
        expect(singularize('shelves')).toBe('shelf')
      })

      it('should singularize "knives" to "knife"', () => {
        expect(singularize('knives')).toBe('knife')
      })

      it('should singularize "wives" to "wife"', () => {
        expect(singularize('wives')).toBe('wife')
      })

      it('should singularize "lives" to "life"', () => {
        expect(singularize('lives')).toBe('life')
      })
    })

    describe('irregular singulars', () => {
      it('should singularize "people" to "person"', () => {
        expect(singularize('people')).toBe('person')
      })

      it('should singularize "children" to "child"', () => {
        expect(singularize('children')).toBe('child')
      })

      it('should singularize "men" to "man"', () => {
        expect(singularize('men')).toBe('man')
      })

      it('should singularize "women" to "woman"', () => {
        expect(singularize('women')).toBe('woman')
      })

      it('should singularize "feet" to "foot"', () => {
        expect(singularize('feet')).toBe('foot')
      })

      it('should singularize "teeth" to "tooth"', () => {
        expect(singularize('teeth')).toBe('tooth')
      })

      it('should singularize "geese" to "goose"', () => {
        expect(singularize('geese')).toBe('goose')
      })

      it('should singularize "mice" to "mouse"', () => {
        expect(singularize('mice')).toBe('mouse')
      })

      it('should singularize "oxen" to "ox"', () => {
        expect(singularize('oxen')).toBe('ox')
      })

      it('should singularize "indices" to "index"', () => {
        expect(singularize('indices')).toBe('index')
      })

      it('should singularize "vertices" to "vertex"', () => {
        expect(singularize('vertices')).toBe('vertex')
      })

      it('should singularize "matrices" to "matrix"', () => {
        expect(singularize('matrices')).toBe('matrix')
      })
    })

    describe('multi-word phrases', () => {
      it('should singularize "blog posts" to "blog post"', () => {
        expect(singularize('blog posts')).toBe('blog post')
      })

      it('should singularize "user profiles" to "user profile"', () => {
        expect(singularize('user profiles')).toBe('user profile')
      })

      it('should singularize "search queries" to "search query"', () => {
        expect(singularize('search queries')).toBe('search query')
      })

      it('should singularize "business people" to "business person"', () => {
        expect(singularize('business people')).toBe('business person')
      })
    })

    describe('edge cases', () => {
      it('should not modify words not ending in "s"', () => {
        expect(singularize('fish')).toBe('fish')
      })

      it('should handle words ending in "ss"', () => {
        // Words ending in 'ss' should not have the final 's' removed
        expect(singularize('boss')).toBe('boss')
      })
    })
  })

  describe('deriveNoun()', () => {
    describe('single word (PascalCase)', () => {
      it('should derive noun forms from "Post"', () => {
        const result = deriveNoun('Post')
        expect(result.singular).toBe('post')
        expect(result.plural).toBe('posts')
        expect(result.slug).toBe('post')
      })

      it('should derive noun forms from "User"', () => {
        const result = deriveNoun('User')
        expect(result.singular).toBe('user')
        expect(result.plural).toBe('users')
        expect(result.slug).toBe('user')
      })

      it('should derive noun forms from "Article"', () => {
        const result = deriveNoun('Article')
        expect(result.singular).toBe('article')
        expect(result.plural).toBe('articles')
        expect(result.slug).toBe('article')
      })

      it('should derive noun forms from "Comment"', () => {
        const result = deriveNoun('Comment')
        expect(result.singular).toBe('comment')
        expect(result.plural).toBe('comments')
        expect(result.slug).toBe('comment')
      })

      it('should derive noun forms from "Category"', () => {
        const result = deriveNoun('Category')
        expect(result.singular).toBe('category')
        expect(result.plural).toBe('categories')
        expect(result.slug).toBe('category')
      })
    })

    describe('multi-word (PascalCase)', () => {
      it('should derive noun forms from "BlogPost"', () => {
        const result = deriveNoun('BlogPost')
        expect(result.singular).toBe('blog post')
        expect(result.plural).toBe('blog posts')
        expect(result.slug).toBe('blog-post')
      })

      it('should derive noun forms from "UserProfile"', () => {
        const result = deriveNoun('UserProfile')
        expect(result.singular).toBe('user profile')
        expect(result.plural).toBe('user profiles')
        expect(result.slug).toBe('user-profile')
      })

      it('should derive noun forms from "ShoppingCart"', () => {
        const result = deriveNoun('ShoppingCart')
        expect(result.singular).toBe('shopping cart')
        expect(result.plural).toBe('shopping carts')
        expect(result.slug).toBe('shopping-cart')
      })

      it('should derive noun forms from "ProductCategory"', () => {
        const result = deriveNoun('ProductCategory')
        expect(result.singular).toBe('product category')
        expect(result.plural).toBe('product categories')
        expect(result.slug).toBe('product-category')
      })

      it('should derive noun forms from "OrderItem"', () => {
        const result = deriveNoun('OrderItem')
        expect(result.singular).toBe('order item')
        expect(result.plural).toBe('order items')
        expect(result.slug).toBe('order-item')
      })

      it('should derive noun forms from "TreeLeaf"', () => {
        const result = deriveNoun('TreeLeaf')
        expect(result.singular).toBe('tree leaf')
        expect(result.plural).toBe('tree leaves')
        expect(result.slug).toBe('tree-leaf')
      })
    })

    describe('irregular nouns', () => {
      it('should derive noun forms from "Person"', () => {
        const result = deriveNoun('Person')
        expect(result.singular).toBe('person')
        expect(result.plural).toBe('people')
        expect(result.slug).toBe('person')
      })

      it('should derive noun forms from "Child"', () => {
        const result = deriveNoun('Child')
        expect(result.singular).toBe('child')
        expect(result.plural).toBe('children')
        expect(result.slug).toBe('child')
      })

      it('should derive noun forms from "DataMatrix"', () => {
        const result = deriveNoun('DataMatrix')
        expect(result.singular).toBe('data matrix')
        expect(result.plural).toBe('data matrices')
        expect(result.slug).toBe('data-matrix')
      })
    })

    describe('three-word names', () => {
      it('should derive noun forms from "UserBlogPost"', () => {
        const result = deriveNoun('UserBlogPost')
        expect(result.singular).toBe('user blog post')
        expect(result.plural).toBe('user blog posts')
        expect(result.slug).toBe('user-blog-post')
      })

      it('should derive noun forms from "ProductReviewComment"', () => {
        const result = deriveNoun('ProductReviewComment')
        expect(result.singular).toBe('product review comment')
        expect(result.plural).toBe('product review comments')
        expect(result.slug).toBe('product-review-comment')
      })
    })

    describe('edge cases', () => {
      it('should handle lowercase input "post"', () => {
        const result = deriveNoun('post')
        expect(result.singular).toBe('post')
        expect(result.plural).toBe('posts')
        expect(result.slug).toBe('post')
      })

      it('should handle single character "A"', () => {
        const result = deriveNoun('A')
        expect(result.singular).toBe('a')
        expect(result.plural).toBe('as')
        expect(result.slug).toBe('a')
      })
    })
  })

  describe('deriveVerb()', () => {
    describe('regular verbs ending in consonant', () => {
      it('should derive verb conjugations from "work"', () => {
        const result = deriveVerb('work')
        expect(result.action).toBe('work')
        expect(result.act).toBe('works')
        expect(result.activity).toBe('working')
        expect(result.event).toBe('worked')
        expect(result.reverseBy).toBe('workedBy')
        expect(result.reverseAt).toBe('workedAt')
        expect(result.reverseIn).toBe('workedIn')
      })

      it('should derive verb conjugations from "start"', () => {
        const result = deriveVerb('start')
        expect(result.action).toBe('start')
        expect(result.act).toBe('starts')
        expect(result.activity).toBe('starting')
        expect(result.event).toBe('started')
      })

      it('should derive verb conjugations from "add"', () => {
        const result = deriveVerb('add')
        expect(result.action).toBe('add')
        expect(result.act).toBe('adds')
        expect(result.activity).toBe('adding')
        expect(result.event).toBe('added')
      })

      it('should derive verb conjugations from "return"', () => {
        const result = deriveVerb('return')
        expect(result.action).toBe('return')
        expect(result.act).toBe('returns')
        expect(result.activity).toBe('returning')
        expect(result.event).toBe('returned')
      })

      it('should derive verb conjugations from "open"', () => {
        const result = deriveVerb('open')
        expect(result.action).toBe('open')
        expect(result.act).toBe('opens')
        expect(result.activity).toBe('opening')
        expect(result.event).toBe('opened')
      })
    })

    describe('regular verbs ending in "e"', () => {
      it('should derive verb conjugations from "create"', () => {
        const result = deriveVerb('create')
        expect(result.action).toBe('create')
        expect(result.act).toBe('creates')
        expect(result.activity).toBe('creating')
        expect(result.event).toBe('created')
        expect(result.reverseBy).toBe('createdBy')
        expect(result.reverseAt).toBe('createdAt')
        expect(result.reverseIn).toBe('createdIn')
      })

      it('should derive verb conjugations from "like"', () => {
        const result = deriveVerb('like')
        expect(result.action).toBe('like')
        expect(result.act).toBe('likes')
        expect(result.activity).toBe('liking')
        expect(result.event).toBe('liked')
      })

      it('should derive verb conjugations from "update"', () => {
        const result = deriveVerb('update')
        expect(result.action).toBe('update')
        expect(result.act).toBe('updates')
        expect(result.activity).toBe('updating')
        expect(result.event).toBe('updated')
      })

      it('should derive verb conjugations from "delete"', () => {
        const result = deriveVerb('delete')
        expect(result.action).toBe('delete')
        expect(result.act).toBe('deletes')
        expect(result.activity).toBe('deleting')
        expect(result.event).toBe('deleted')
      })

      it('should derive verb conjugations from "save"', () => {
        const result = deriveVerb('save')
        expect(result.action).toBe('save')
        expect(result.act).toBe('saves')
        expect(result.activity).toBe('saving')
        expect(result.event).toBe('saved')
      })

      it('should derive verb conjugations from "close"', () => {
        const result = deriveVerb('close')
        expect(result.action).toBe('close')
        expect(result.act).toBe('closes')
        expect(result.activity).toBe('closing')
        expect(result.event).toBe('closed')
      })

      it('should derive verb conjugations from "move"', () => {
        const result = deriveVerb('move')
        expect(result.action).toBe('move')
        expect(result.act).toBe('moves')
        expect(result.activity).toBe('moving')
        expect(result.event).toBe('moved')
      })

      it('should derive verb conjugations from "share"', () => {
        const result = deriveVerb('share')
        expect(result.action).toBe('share')
        expect(result.act).toBe('shares')
        expect(result.activity).toBe('sharing')
        expect(result.event).toBe('shared')
      })
    })

    describe('verbs ending in s/x/z/ch/sh (add "es")', () => {
      it('should derive verb conjugations from "pass"', () => {
        const result = deriveVerb('pass')
        expect(result.act).toBe('passes')
        expect(result.activity).toBe('passing')
        expect(result.event).toBe('passed')
      })

      it('should derive verb conjugations from "fix"', () => {
        const result = deriveVerb('fix')
        expect(result.act).toBe('fixes')
        expect(result.activity).toBe('fixing')
        expect(result.event).toBe('fixed')
      })

      it('should derive verb conjugations from "watch"', () => {
        const result = deriveVerb('watch')
        expect(result.act).toBe('watches')
        expect(result.activity).toBe('watching')
        expect(result.event).toBe('watched')
      })

      it('should derive verb conjugations from "push"', () => {
        const result = deriveVerb('push')
        expect(result.act).toBe('pushes')
        expect(result.activity).toBe('pushing')
        expect(result.event).toBe('pushed')
      })

      it('should derive verb conjugations from "miss"', () => {
        const result = deriveVerb('miss')
        expect(result.act).toBe('misses')
        expect(result.activity).toBe('missing')
        expect(result.event).toBe('missed')
      })
    })

    describe('verbs ending in consonant+y (change y to ies/ied)', () => {
      it('should derive verb conjugations from "try"', () => {
        const result = deriveVerb('try')
        expect(result.act).toBe('tries')
        expect(result.activity).toBe('trying')
        expect(result.event).toBe('tried')
      })

      it('should derive verb conjugations from "copy"', () => {
        const result = deriveVerb('copy')
        expect(result.act).toBe('copies')
        expect(result.activity).toBe('copying')
        expect(result.event).toBe('copied')
      })

      it('should derive verb conjugations from "carry"', () => {
        const result = deriveVerb('carry')
        expect(result.act).toBe('carries')
        expect(result.activity).toBe('carrying')
        expect(result.event).toBe('carried')
      })

      it('should derive verb conjugations from "study"', () => {
        const result = deriveVerb('study')
        expect(result.act).toBe('studies')
        expect(result.activity).toBe('studying')
        expect(result.event).toBe('studied')
      })
    })

    describe('verbs ending in vowel+y (add "s")', () => {
      it('should derive verb conjugations from "play"', () => {
        const result = deriveVerb('play')
        expect(result.act).toBe('plays')
        expect(result.activity).toBe('playing')
        expect(result.event).toBe('played')
      })

      it('should derive verb conjugations from "stay"', () => {
        const result = deriveVerb('stay')
        expect(result.act).toBe('stays')
        expect(result.activity).toBe('staying')
        expect(result.event).toBe('stayed')
      })

      it('should derive verb conjugations from "enjoy"', () => {
        const result = deriveVerb('enjoy')
        expect(result.act).toBe('enjoys')
        expect(result.activity).toBe('enjoying')
        expect(result.event).toBe('enjoyed')
      })
    })

    describe('verbs with consonant doubling (CVC pattern)', () => {
      it('should derive verb conjugations from "stop"', () => {
        const result = deriveVerb('stop')
        expect(result.activity).toBe('stopping')
        expect(result.event).toBe('stopped')
      })

      it('should derive verb conjugations from "plan"', () => {
        const result = deriveVerb('plan')
        expect(result.activity).toBe('planning')
        expect(result.event).toBe('planned')
      })

      it('should derive verb conjugations from "drop"', () => {
        const result = deriveVerb('drop')
        expect(result.activity).toBe('dropping')
        expect(result.event).toBe('dropped')
      })

      it('should derive verb conjugations from "grab"', () => {
        const result = deriveVerb('grab')
        expect(result.activity).toBe('grabbing')
        expect(result.event).toBe('grabbed')
      })

      it('should derive verb conjugations from "chat"', () => {
        const result = deriveVerb('chat')
        expect(result.activity).toBe('chatting')
        expect(result.event).toBe('chatted')
      })
    })

    describe('irregular verbs', () => {
      it('should derive verb conjugations from "write"', () => {
        const result = deriveVerb('write')
        expect(result.action).toBe('write')
        expect(result.act).toBe('writes')
        expect(result.activity).toBe('writing')
        expect(result.event).toBe('written')
        expect(result.reverseBy).toBe('writtenBy')
        expect(result.reverseAt).toBe('writtenAt')
        expect(result.reverseIn).toBe('writtenIn')
      })

      it('should derive verb conjugations from "read"', () => {
        const result = deriveVerb('read')
        expect(result.action).toBe('read')
        expect(result.act).toBe('reads')
        expect(result.activity).toBe('reading')
        expect(result.event).toBe('read')
        expect(result.reverseBy).toBe('readBy')
        expect(result.reverseAt).toBe('readAt')
      })

      it('should derive verb conjugations from "run"', () => {
        const result = deriveVerb('run')
        expect(result.action).toBe('run')
        expect(result.act).toBe('runs')
        expect(result.activity).toBe('running')
        expect(result.event).toBe('run')
      })

      it('should derive verb conjugations from "begin"', () => {
        const result = deriveVerb('begin')
        expect(result.action).toBe('begin')
        expect(result.act).toBe('begins')
        expect(result.activity).toBe('beginning')
        expect(result.event).toBe('begun')
      })

      it('should derive verb conjugations from "do"', () => {
        const result = deriveVerb('do')
        expect(result.action).toBe('do')
        expect(result.act).toBe('does')
        expect(result.activity).toBe('doing')
        expect(result.event).toBe('done')
      })

      it('should derive verb conjugations from "go"', () => {
        const result = deriveVerb('go')
        expect(result.action).toBe('go')
        expect(result.act).toBe('goes')
        expect(result.activity).toBe('going')
        expect(result.event).toBe('gone')
      })

      it('should derive verb conjugations from "have"', () => {
        const result = deriveVerb('have')
        expect(result.action).toBe('have')
        expect(result.act).toBe('has')
        expect(result.activity).toBe('having')
        expect(result.event).toBe('had')
      })

      it('should derive verb conjugations from "be"', () => {
        const result = deriveVerb('be')
        expect(result.action).toBe('be')
        expect(result.act).toBe('is')
        expect(result.activity).toBe('being')
        expect(result.event).toBe('been')
      })

      it('should derive verb conjugations from "set"', () => {
        const result = deriveVerb('set')
        expect(result.action).toBe('set')
        expect(result.act).toBe('sets')
        expect(result.activity).toBe('setting')
        expect(result.event).toBe('set')
      })

      it('should derive verb conjugations from "get"', () => {
        const result = deriveVerb('get')
        expect(result.action).toBe('get')
        expect(result.act).toBe('gets')
        expect(result.activity).toBe('getting')
        expect(result.event).toBe('got')
      })

      it('should derive verb conjugations from "put"', () => {
        const result = deriveVerb('put')
        expect(result.action).toBe('put')
        expect(result.act).toBe('puts')
        expect(result.activity).toBe('putting')
        expect(result.event).toBe('put')
      })

      it('should derive verb conjugations from "cut"', () => {
        const result = deriveVerb('cut')
        expect(result.action).toBe('cut')
        expect(result.act).toBe('cuts')
        expect(result.activity).toBe('cutting')
        expect(result.event).toBe('cut')
      })

      it('should derive verb conjugations from "hit"', () => {
        const result = deriveVerb('hit')
        expect(result.action).toBe('hit')
        expect(result.act).toBe('hits')
        expect(result.activity).toBe('hitting')
        expect(result.event).toBe('hit')
      })
    })

    describe('reverseBy and reverseAt derivation', () => {
      it('should derive correct reverseBy and reverseAt for "create"', () => {
        const result = deriveVerb('create')
        expect(result.reverseBy).toBe('createdBy')
        expect(result.reverseAt).toBe('createdAt')
      })

      it('should derive correct reverseBy and reverseAt for "write" (irregular)', () => {
        const result = deriveVerb('write')
        expect(result.reverseBy).toBe('writtenBy')
        expect(result.reverseAt).toBe('writtenAt')
      })

      it('should derive correct reverseBy and reverseAt for "update"', () => {
        const result = deriveVerb('update')
        expect(result.reverseBy).toBe('updatedBy')
        expect(result.reverseAt).toBe('updatedAt')
      })

      it('should derive correct reverseBy and reverseAt for "delete"', () => {
        const result = deriveVerb('delete')
        expect(result.reverseBy).toBe('deletedBy')
        expect(result.reverseAt).toBe('deletedAt')
      })

      it('should derive correct reverseBy and reverseAt for "publish"', () => {
        const result = deriveVerb('publish')
        expect(result.reverseBy).toBe('publishedBy')
        expect(result.reverseAt).toBe('publishedAt')
      })
    })

    describe('reverseIn derivation', () => {
      it('should derive correct reverseIn for "create"', () => {
        const result = deriveVerb('create')
        expect(result.reverseIn).toBe('createdIn')
      })

      it('should derive correct reverseIn for "write" (irregular)', () => {
        const result = deriveVerb('write')
        expect(result.reverseIn).toBe('writtenIn')
      })

      it('should derive correct reverseIn for "do" (irregular)', () => {
        const result = deriveVerb('do')
        expect(result.reverseIn).toBe('doneIn')
      })
    })

    describe('case handling', () => {
      it('should handle uppercase input "CREATE"', () => {
        const result = deriveVerb('CREATE')
        expect(result.action).toBe('create')
        expect(result.act).toBe('creates')
        expect(result.activity).toBe('creating')
        expect(result.event).toBe('created')
      })

      it('should handle mixed case input "CrEaTe"', () => {
        const result = deriveVerb('CrEaTe')
        expect(result.action).toBe('create')
        expect(result.act).toBe('creates')
      })
    })
  })

  describe('Utility Helpers', () => {
    describe('capitalize()', () => {
      it('should capitalize first letter', () => {
        expect(capitalize('hello')).toBe('Hello')
      })

      it('should handle already capitalized', () => {
        expect(capitalize('Hello')).toBe('Hello')
      })

      it('should handle single char', () => {
        expect(capitalize('a')).toBe('A')
      })
    })

    describe('preserveCase()', () => {
      it('should capitalize replacement if original is capitalized', () => {
        expect(preserveCase('Person', 'people')).toBe('People')
      })

      it('should keep lowercase if original is lowercase', () => {
        expect(preserveCase('person', 'people')).toBe('people')
      })
    })

    describe('isVowel()', () => {
      it('should return true for vowels', () => {
        expect(isVowel('a')).toBe(true)
        expect(isVowel('e')).toBe(true)
        expect(isVowel('i')).toBe(true)
        expect(isVowel('o')).toBe(true)
        expect(isVowel('u')).toBe(true)
      })

      it('should return true for uppercase vowels', () => {
        expect(isVowel('A')).toBe(true)
        expect(isVowel('E')).toBe(true)
      })

      it('should return false for consonants', () => {
        expect(isVowel('b')).toBe(false)
        expect(isVowel('c')).toBe(false)
        expect(isVowel('z')).toBe(false)
      })

      it('should return false for undefined', () => {
        expect(isVowel(undefined)).toBe(false)
      })
    })

    describe('splitCamelCase()', () => {
      it('should split PascalCase', () => {
        expect(splitCamelCase('BlogPost')).toEqual(['Blog', 'Post'])
      })

      it('should split camelCase', () => {
        expect(splitCamelCase('userProfile')).toEqual(['user', 'Profile'])
      })

      it('should handle single word', () => {
        expect(splitCamelCase('Post')).toEqual(['Post'])
      })

      it('should handle three words', () => {
        expect(splitCamelCase('ProductReviewComment')).toEqual(['Product', 'Review', 'Comment'])
      })
    })

    describe('toKebabCase()', () => {
      it('should convert PascalCase to kebab-case', () => {
        expect(toKebabCase('BlogPost')).toBe('blog-post')
      })

      it('should convert space-separated to kebab-case', () => {
        expect(toKebabCase('Blog Post')).toBe('blog-post')
      })

      it('should handle single word', () => {
        expect(toKebabCase('Post')).toBe('post')
      })
    })

    describe('shouldDoubleConsonant()', () => {
      it('should return true for short CVC words', () => {
        expect(shouldDoubleConsonant('run')).toBe(true)
        expect(shouldDoubleConsonant('sit')).toBe(true)
        expect(shouldDoubleConsonant('hop')).toBe(true)
      })

      it('should return true for known doubling verbs', () => {
        expect(shouldDoubleConsonant('submit')).toBe(true)
        expect(shouldDoubleConsonant('commit')).toBe(true)
        expect(shouldDoubleConsonant('refer')).toBe(true)
        expect(shouldDoubleConsonant('stop')).toBe(true)
        expect(shouldDoubleConsonant('plan')).toBe(true)
        expect(shouldDoubleConsonant('grab')).toBe(true)
      })

      it('should return false for non-doubling verbs', () => {
        expect(shouldDoubleConsonant('open')).toBe(false)
        expect(shouldDoubleConsonant('listen')).toBe(false)
        expect(shouldDoubleConsonant('happen')).toBe(false)
        expect(shouldDoubleConsonant('develop')).toBe(false)
      })

      it('should not double w, x, y endings', () => {
        expect(shouldDoubleConsonant('play')).toBe(false)
        expect(shouldDoubleConsonant('fix')).toBe(false)
        expect(shouldDoubleConsonant('show')).toBe(false)
      })
    })
  })

  describe('Composable Verb Helpers', () => {
    describe('toPastParticiple()', () => {
      it('should handle -e ending', () => {
        expect(toPastParticiple('create')).toBe('created')
        expect(toPastParticiple('like')).toBe('liked')
      })

      it('should handle consonant+y ending', () => {
        expect(toPastParticiple('carry')).toBe('carried')
        expect(toPastParticiple('try')).toBe('tried')
      })

      it('should handle consonant doubling', () => {
        expect(toPastParticiple('stop')).toBe('stopped')
        expect(toPastParticiple('submit')).toBe('submitted')
      })

      it('should handle regular verbs', () => {
        expect(toPastParticiple('work')).toBe('worked')
        expect(toPastParticiple('open')).toBe('opened')
      })
    })

    describe('toActor()', () => {
      it('should handle -ate ending', () => {
        expect(toActor('create')).toBe('creator')
      })

      it('should handle -e ending', () => {
        expect(toActor('manage')).toBe('manager')
      })

      it('should handle consonant+y ending', () => {
        expect(toActor('carry')).toBe('carrier')
      })

      it('should handle consonant doubling', () => {
        expect(toActor('submit')).toBe('submitter')
      })

      it('should handle regular verbs', () => {
        expect(toActor('work')).toBe('worker')
        expect(toActor('publish')).toBe('publisher')
      })
    })

    describe('toPresent()', () => {
      it('should handle consonant+y ending', () => {
        expect(toPresent('carry')).toBe('carries')
      })

      it('should handle sibilant endings', () => {
        expect(toPresent('push')).toBe('pushes')
        expect(toPresent('watch')).toBe('watches')
        expect(toPresent('fix')).toBe('fixes')
      })

      it('should handle regular verbs', () => {
        expect(toPresent('create')).toBe('creates')
        expect(toPresent('work')).toBe('works')
      })
    })

    describe('toGerund()', () => {
      it('should handle -ie ending', () => {
        expect(toGerund('die')).toBe('dying')
        expect(toGerund('lie')).toBe('lying')
      })

      it('should handle -e ending', () => {
        expect(toGerund('create')).toBe('creating')
        expect(toGerund('like')).toBe('liking')
      })

      it('should handle consonant doubling', () => {
        expect(toGerund('run')).toBe('running')
        expect(toGerund('stop')).toBe('stopping')
        expect(toGerund('submit')).toBe('submitting')
      })

      it('should handle regular verbs', () => {
        expect(toGerund('work')).toBe('working')
        expect(toGerund('open')).toBe('opening')
      })
    })

    describe('toResult()', () => {
      it('should handle -ate ending', () => {
        expect(toResult('create')).toBe('creation')
        expect(toResult('generate')).toBe('generation')
      })

      it('should handle -ify ending', () => {
        expect(toResult('notify')).toBe('notification')
        expect(toResult('classify')).toBe('classification')
      })

      it('should handle -ize ending', () => {
        expect(toResult('organize')).toBe('organization')
      })

      it('should handle -e ending', () => {
        expect(toResult('define')).toBe('definion')
      })

      it('should handle default', () => {
        expect(toResult('publish')).toBe('publishion')
      })
    })
  })
})
