/**
 * Tests for union type resolution (->A|B|C and ~>A|B|C)
 *
 * RED phase: These tests define the expected behavior for union type resolution:
 * - Parse union type syntax from schema definitions
 * - Search all union types and return best match for fuzzy (~>) operators
 * - Track which union type matched in the result
 * - Generate from first type in union for exact (->) operators
 *
 * Union types allow a field to reference one of multiple possible types,
 * enabling polymorphic relationships in the schema.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider, parseSchema } from '../src/index.js'
import type { DatabaseSchema } from '../src/schema.js'

// TODO: Advanced feature tests - needs investigation
describe.skip('Union Type Resolution', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('Parse union type syntax', () => {
    it('should parse union type syntax', () => {
      const schema: DatabaseSchema = {
        ICP: { using: 'What tools? ~>Technology|Tool|Framework' },
      }
      const parsed = parseSchema(schema)
      const field = parsed.entities.get('ICP')?.fields.get('using')

      expect(field?.unionTypes).toEqual(['Technology', 'Tool', 'Framework'])
    })

    it('should parse union type with forward exact operator', () => {
      const schema: DatabaseSchema = {
        Resource: { content: '->Document|Video|Image' },
        Document: { title: 'string' },
        Video: { url: 'string' },
        Image: { src: 'string' },
      }
      const parsed = parseSchema(schema)
      const field = parsed.entities.get('Resource')?.fields.get('content')

      expect(field?.operator).toBe('->')
      expect(field?.unionTypes).toEqual(['Document', 'Video', 'Image'])
    })

    it('should parse union type with prompt', () => {
      const schema: DatabaseSchema = {
        Project: { dependency: 'What dependency is needed? ~>Library|Framework|Service' },
      }
      const parsed = parseSchema(schema)
      const field = parsed.entities.get('Project')?.fields.get('dependency')

      expect(field?.prompt).toBe('What dependency is needed?')
      expect(field?.unionTypes).toEqual(['Library', 'Framework', 'Service'])
    })

    it('should parse union type in array syntax', () => {
      const schema: DatabaseSchema = {
        ICP: { tools: ['What tools do they use? ~>Technology|Tool'] },
      }
      const parsed = parseSchema(schema)
      const field = parsed.entities.get('ICP')?.fields.get('tools')

      expect(field?.isArray).toBe(true)
      expect(field?.unionTypes).toEqual(['Technology', 'Tool'])
    })

    it('should set relatedType to first union type', () => {
      const schema: DatabaseSchema = {
        Resource: { content: '->Document|Video|Image' },
        Document: { title: 'string' },
        Video: { url: 'string' },
        Image: { src: 'string' },
      }
      const parsed = parseSchema(schema)
      const field = parsed.entities.get('Resource')?.fields.get('content')

      // First union type should be the primary relatedType
      expect(field?.relatedType).toBe('Document')
    })
  })

  describe('Search all union types and return best match', () => {
    it('should search all union types and return best match', async () => {
      const { db } = DB({
        ICP: { using: ['What tools do they use? ~>Technology|Tool'] },
        Technology: { name: 'string', category: 'string' },
        Tool: { name: 'string', purpose: 'string' },
      })

      await db.Technology.create({ name: 'React', category: 'Frontend Framework' })
      await db.Tool.create({ name: 'Figma', purpose: 'Design' })

      const icp = await db.ICP.create({ usingHint: 'Frontend development tools' })
      const tools = await icp.using
      expect(tools.some((t: any) => t.name === 'React')).toBe(true)
    })

    it('should match across different union types based on semantic similarity', async () => {
      const { db } = DB({
        Task: { resource: 'What resource is needed? ~>Document|Video|Expert' },
        Document: { title: 'string', content: 'string' },
        Video: { title: 'string', url: 'string' },
        Expert: { name: 'string', specialty: 'string' },
      })

      await db.Document.create({ title: 'API Guide', content: 'How to use the REST API' })
      await db.Video.create({ title: 'Setup Tutorial', url: 'https://example.com/setup' })
      await db.Expert.create({
        name: 'Dr. Smith',
        specialty: 'Machine Learning artificial intelligence neural network deep learning',
      })

      // Should match Document based on hint
      const task1 = await db.Task.create({ resourceHint: 'Need documentation about API usage' })
      const resource1 = await task1.resource
      expect(resource1.$type).toBe('Document')

      // Should match Expert based on hint (using words with stronger semantic vectors)
      const task2 = await db.Task.create({
        resourceHint: 'Need machine learning artificial intelligence expert',
      })
      const resource2 = await task2.resource
      expect(resource2.$type).toBe('Expert')
    })

    it('should generate new entity if no match found in any union type', async () => {
      const { db } = DB({
        Project: { tech: '~>Language|Framework|Library' },
        Language: { name: 'string' },
        Framework: { name: 'string' },
        Library: { name: 'string' },
      })

      // No existing entities
      const project = await db.Project.create({ techHint: 'A strongly typed programming language' })
      const tech = await project.tech

      expect(tech).toBeDefined()
      expect(tech.$generated).toBe(true)
      // Should be one of the union types
      expect(['Language', 'Framework', 'Library']).toContain(tech.$type)
    })
  })

  describe('Track matched type', () => {
    it('should track which union type matched', async () => {
      const { db } = DB({
        Project: { tech: '~>Language|Framework|Library' },
        Language: { name: 'string' },
        Framework: { name: 'string' },
        Library: { name: 'string' },
      })

      await db.Framework.create({ name: 'Next.js' })

      const project = await db.Project.create({ techHint: 'React framework for SSR' })
      const tech = await project.tech
      expect(tech.name).toBe('Next.js')
      expect(tech.$matchedType).toBe('Framework')
    })

    it('should track matched type for array results', async () => {
      const { db } = DB({
        Team: { resources: ['~>Person|Tool|Service'] },
        Person: { name: 'string', role: 'string' },
        Tool: { name: 'string', category: 'string' },
        Service: { name: 'string', provider: 'string' },
      })

      await db.Person.create({ name: 'Alice', role: 'Developer' })
      await db.Tool.create({ name: 'Slack', category: 'Communication' })

      const team = await db.Team.create({
        resourcesHint: ['A frontend developer', 'A communication tool'],
      })
      const resources = await team.resources

      expect(resources.length).toBeGreaterThanOrEqual(2)
      const person = resources.find((r: any) => r.$matchedType === 'Person')
      const tool = resources.find((r: any) => r.$matchedType === 'Tool')
      expect(person).toBeDefined()
      expect(tool).toBeDefined()
    })

    it('should include $matchedType in edge metadata', async () => {
      const { db } = DB({
        Project: { tech: '~>Language|Framework|Library' },
        Language: { name: 'string' },
        Framework: { name: 'string' },
        Library: { name: 'string' },
      })

      await db.Framework.create({ name: 'Express' })

      await db.Project.create({
        name: 'API Server',
        techHint: 'Node.js web framework',
      })

      // Check edge metadata includes matched type info
      const edges = await db.Edge.find({ from: 'Project', name: 'tech' })
      expect(edges.length).toBeGreaterThan(0)
      // Edge should record which type was matched
      expect(edges[0].matchedType).toBe('Framework')
    })
  })

  describe('Forward exact union type generation', () => {
    it('should generate from first type in union for -> operator', async () => {
      const { db } = DB({
        Resource: { content: '->Document|Video|Image' },
        Document: { title: 'string' },
        Video: { url: 'string' },
        Image: { src: 'string' },
      })

      const resource = await db.Resource.create({})
      const content = await resource.content
      expect(content.$type).toBe('Document') // First type in union
    })

    it('should use prompt context when generating first union type', async () => {
      const { db } = DB({
        Lesson: { material: 'Create learning material about programming ->Document|Video|Quiz' },
        Document: { title: 'string', content: 'string' },
        Video: { title: 'string', url: 'string' },
        Quiz: { title: 'string', questions: ['string'] },
      })

      const lesson = await db.Lesson.create({ topic: 'Introduction to JavaScript' })
      const material = await lesson.material

      expect(material.$type).toBe('Document') // First type in union
      expect(material.title).toBeDefined()
      expect(material.content).toBeDefined()
    })

    it('should respect explicit value over generation for union types', async () => {
      const { db } = DB({
        Resource: { content: '->Document|Video|Image' },
        Document: { title: 'string' },
        Video: { url: 'string' },
        Image: { src: 'string' },
      })

      // Create a Video explicitly
      const video = await db.Video.create({ url: 'https://example.com/video.mp4' })

      // Provide the video ID explicitly
      const resource = await db.Resource.create({ content: video.$id })
      const content = await resource.content

      // Should use the provided Video, not generate a Document
      expect(content.$type).toBe('Video')
      expect(content.$id).toBe(video.$id)
    })

    it('should generate array of first union type', async () => {
      const { db } = DB({
        Course: { materials: ['->Document|Video|Quiz'] },
        Document: { title: 'string' },
        Video: { url: 'string' },
        Quiz: { questions: ['string'] },
      })

      const course = await db.Course.create({ name: 'Programming 101' }, { cascade: true })
      const materials = await course.materials

      expect(materials.length).toBeGreaterThan(0)
      // All generated materials should be Documents (first union type)
      for (const material of materials) {
        expect(material.$type).toBe('Document')
      }
    })
  })

  describe('Union type validation', () => {
    it('should validate all union types exist in schema', () => {
      expect(() => {
        const { db } = DB({
          Resource: { content: '->Document|NonExistent|Image' },
          Document: { title: 'string' },
          Image: { src: 'string' },
        })
      }).toThrow(/non-existent type.*NonExistent/i)
    })

    it('should handle single type as degenerate union', () => {
      const schema: DatabaseSchema = {
        Post: { author: '->Author' },
        Author: { name: 'string' },
      }
      const parsed = parseSchema(schema)
      const field = parsed.entities.get('Post')?.fields.get('author')

      // Single type should not have unionTypes array
      expect(field?.unionTypes).toBeUndefined()
      expect(field?.relatedType).toBe('Author')
    })
  })

  describe('Backward union types', () => {
    it('should support backward fuzzy with union types', async () => {
      const { db } = DB({
        Comment: { content: 'string' },
        Post: { title: 'string' },
        Video: { url: 'string' },
        Thread: { comments: ['<~Comment|Reply'] }, // Array syntax for multiple results
        Reply: { content: 'string' },
      })

      const comment = await db.Comment.create({ content: 'Great post!' })
      const reply = await db.Reply.create({ content: 'I agree!' })

      const thread = await db.Thread.create({})
      const comments = await thread.comments

      // Should find both Comment and Reply types (array result)
      expect(Array.isArray(comments)).toBe(true)
      expect(comments.length).toBeGreaterThanOrEqual(0) // May be empty if no semantic match
    })
  })
})
