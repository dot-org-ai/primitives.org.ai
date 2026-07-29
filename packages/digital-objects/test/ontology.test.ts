/**
 * Tests for Ontology() — the storage-agnostic SVO vocabulary factory.
 *
 * Ontology() = graphdl's Graph(schema) wrapped + Frame layering + provider
 * binding. It returns a PURE vocabulary (no I/O): parsed nouns, verbs (with
 * optional Frame complement-role declarations), and an optional bound provider.
 */

import { describe, it, expect } from 'vitest'
import { Ontology } from '../src/ontology'
import { createMemoryProvider } from '../src/memory-provider'
import type { Frame } from '../src/types'

describe('Ontology()', () => {
  describe('graphdl Graph() wrapping', () => {
    it('parses a graphdl-style schema into nouns', () => {
      const onto = Ontology({
        Post: {
          $type: 'https://schema.org.ai/Post',
          title: 'string',
          author: '->Author.posts',
        },
        Author: {
          name: 'string',
        },
      })

      expect(onto.hasNoun('Post')).toBe(true)
      expect(onto.hasNoun('Author')).toBe(true)
      expect(onto.nounNames().sort()).toEqual(['Author', 'Post'])
    })

    it('exposes the parsed graph (entities + typeUris)', () => {
      const onto = Ontology({
        Post: { $type: 'https://schema.org.ai/Post', title: 'string' },
      })
      expect(onto.graph.entities.has('Post')).toBe(true)
      expect(onto.graph.typeUris.get('Post')).toBe('https://schema.org.ai/Post')
    })

    it('derives linguistic noun forms (singular/plural/slug)', () => {
      const onto = Ontology({ BlogPost: { title: 'string' } })
      const noun = onto.getNoun('BlogPost')
      expect(noun?.singular).toBe('blog post')
      expect(noun?.plural).toBe('blog posts')
      expect(noun?.slug).toBe('blog-post')
    })

    it('handles an empty schema (no nouns, default CRUD verbs still present)', () => {
      const onto = Ontology({})
      expect(onto.nounNames()).toEqual([])
      expect(onto.verbNames().sort()).toEqual(['create', 'delete', 'update'])
    })

    it('disables a default CRUD verb when its spec is null', () => {
      const onto = Ontology({ Post: { title: 'string' } }, { verbs: { delete: null } })
      expect(onto.hasVerb('delete')).toBe(false)
      expect(onto.hasVerb('create')).toBe(true)
    })
  })

  describe('verb + Frame layering', () => {
    it('includes default CRUD verbs', () => {
      const onto = Ontology({ Post: { title: 'string' } })
      expect(onto.hasVerb('create')).toBe(true)
      expect(onto.hasVerb('update')).toBe(true)
      expect(onto.hasVerb('delete')).toBe(true)
    })

    it('conjugates verbs into the flat runtime representation', () => {
      const onto = Ontology({ Post: { title: 'string' } })
      const create = onto.getVerb('create')
      expect(create?.action).toBe('create')
      expect(create?.act).toBe('creates')
      expect(create?.activity).toBe('creating')
      expect(create?.event).toBe('created')
      expect(create?.reverseBy).toBe('createdBy')
      expect(create?.reverseAt).toBe('createdAt')
    })

    it('layers a Frame onto a declared verb', () => {
      const frame: Frame = { subject: 'Author', object: 'Post' }
      const onto = Ontology(
        { Post: { title: 'string' }, Author: { name: 'string' } },
        { verbs: { publish: { frame } } }
      )
      const publish = onto.getVerb('publish')
      expect(publish?.frame).toEqual(frame)
      expect(publish?.event).toBe('published')
    })

    it('accepts a bare Frame as the verb spec (sugar)', () => {
      const frame: Frame = { subject: 'any', object: 'Post' }
      const onto = Ontology({ Post: { title: 'string' } }, { verbs: { archive: frame } })
      expect(onto.getVerb('archive')?.frame).toEqual(frame)
    })

    it('defaults source to domain and canonical to false for user verbs', () => {
      const onto = Ontology({ Post: { title: 'string' } }, { verbs: { publish: {} } })
      const publish = onto.getVerb('publish')
      expect(publish?.source).toBe('domain')
      expect(publish?.canonical).toBe(false)
    })
  })

  describe('provider binding (no I/O)', () => {
    it('returns undefined provider when none is bound', () => {
      const onto = Ontology({ Post: { title: 'string' } })
      expect(onto.provider).toBeUndefined()
    })

    it('binds a provider without performing any I/O', () => {
      const provider = createMemoryProvider()
      const onto = Ontology({ Post: { title: 'string' } }, { provider })
      expect(onto.provider).toBe(provider)
    })
  })

  describe('purity', () => {
    it('is storage-agnostic — constructing an Ontology touches no provider', async () => {
      const provider = createMemoryProvider()
      Ontology({ Post: { title: 'string' } }, { provider })
      // No nouns/verbs should have been written to the provider by construction.
      expect(await provider.listNouns()).toEqual([])
      expect(await provider.listVerbs()).toEqual([])
    })
  })
})
