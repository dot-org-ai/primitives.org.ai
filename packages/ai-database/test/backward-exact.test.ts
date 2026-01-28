/**
 * Tests for backward exact (<-) edge direction resolution
 *
 * The `<-` operator inverts the edge direction, meaning:
 * - The source entity contains the reference definition
 * - But the edge is stored in the opposite direction
 * - Enables reverse lookups and aggregation queries
 *
 * ## Distinction from Backward Fuzzy (<~)
 *
 * | Operator | Direction | Match Mode | Resolution Method |
 * |----------|-----------|------------|-------------------|
 * | `<-`     | backward  | exact      | Foreign key lookup (exact ID match) |
 * | `<~`     | backward  | fuzzy      | Semantic search (embedding similarity) |
 *
 * - **`<-` (backward exact)**: Finds entities that explicitly reference the current
 *   entity via a foreign key. Uses `provider.list(type, { where: { field: id } })`.
 *   Example: `Blog.posts: ['<-Post']` finds all Posts where `post.blog === blog.$id`.
 *
 * - **`<~` (backward fuzzy)**: Grounds AI generation against reference data using
 *   semantic search. Uses embedding similarity to find the best match from existing
 *   entities. Does NOT generate new entities. Example: `ICP.as: '<~Occupation'`
 *   matches an existing Occupation based on semantic similarity.
 *
 * These tests validate:
 * 1. Inverted edge creation for <- references
 * 2. Aggregation queries via backward refs
 * 3. Backward ref behavior in generation context
 * 4. No duplicate creation with symmetric <- and ->
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DB, setProvider, createMemoryProvider } from '../src/index.js'

// TODO: Advanced feature tests - needs investigation
describe.skip('Backward Exact (<-) Resolution', () => {
  beforeEach(() => {
    setProvider(createMemoryProvider())
  })

  describe('Inverted edge creation', () => {
    it('should create inverted edge for <- reference', async () => {
      const { db } = DB({
        Blog: { posts: ['<-Post'] },
        Post: { title: 'string' },
      })

      const blog = await db.Blog.create({ name: 'Tech Blog' })
      const post = await db.Post.create({ title: 'Hello', blog: blog.$id })

      // Edge should be: Post -> Blog (Post points TO Blog)
      const blogPosts = await blog.posts
      expect(blogPosts).toHaveLength(1)
      expect(blogPosts[0].$id).toBe(post.$id)
    })

    it('should store edge with correct direction metadata', async () => {
      const { db } = DB({
        Blog: { posts: ['<-Post'] },
        Post: { title: 'string' },
      })

      // Verify edge metadata shows inverted direction
      const edges = await db.Edge.find({ name: 'posts' })
      expect(edges).toHaveLength(1)
      expect(edges[0]?.direction).toBe('backward')
      expect(edges[0]?.from).toBe('Post')
      expect(edges[0]?.to).toBe('Blog')
    })
  })

  describe('Aggregation queries', () => {
    it('should enable aggregation queries via backward refs', async () => {
      const { db } = DB({
        Author: { articles: ['<-Article'] },
        Article: { title: 'string', author: '->Author' },
      })

      const author = await db.Author.create({ name: 'John' })
      await db.Article.create({ title: 'Post 1', author: author.$id })
      await db.Article.create({ title: 'Post 2', author: author.$id })
      await db.Article.create({ title: 'Post 3', author: author.$id })

      const authorWithArticles = await db.Author.get(author.$id)
      const articles = await authorWithArticles.articles
      expect(articles).toHaveLength(3)
    })

    it('should return correct entities in aggregation', async () => {
      const { db } = DB({
        Author: { articles: ['<-Article'] },
        Article: { title: 'string', author: '->Author' },
      })

      const author = await db.Author.create({ name: 'Jane' })
      const article1 = await db.Article.create({ title: 'First Article', author: author.$id })
      const article2 = await db.Article.create({ title: 'Second Article', author: author.$id })

      const authorWithArticles = await db.Author.get(author.$id)
      const articles = await authorWithArticles.articles

      const articleIds = articles.map((a: any) => a.$id)
      expect(articleIds).toContain(article1.$id)
      expect(articleIds).toContain(article2.$id)
    })

    it('should not include unrelated entities in aggregation', async () => {
      const { db } = DB({
        Author: { articles: ['<-Article'] },
        Article: { title: 'string', author: '->Author' },
      })

      const author1 = await db.Author.create({ name: 'Author 1' })
      const author2 = await db.Author.create({ name: 'Author 2' })

      await db.Article.create({ title: 'Author 1 Article', author: author1.$id })
      await db.Article.create({ title: 'Author 2 Article', author: author2.$id })

      const author1WithArticles = await db.Author.get(author1.$id)
      const articles = await author1WithArticles.articles

      expect(articles).toHaveLength(1)
      expect(articles[0].title).toBe('Author 1 Article')
    })
  })

  describe('Backward ref in generation context', () => {
    it('should handle <- in generation context', async () => {
      const { db } = DB({
        Problem: {
          task: '<-Task',
          description: 'string', // Plain string field for problem description
        },
        Task: {
          name: 'string',
          problems: ['->Problem'],
        },
      })

      const task = await db.Task.create({ name: 'Data Entry' })
      const problems = await task.problems

      for (const problem of problems) {
        const resolvedTask = await problem.task
        expect(resolvedTask.$id).toBe(task.$id)
      }
    })

    it('should resolve backward ref to correct parent', async () => {
      const { db } = DB({
        Category: {
          items: ['<-Item'],
          name: 'string',
        },
        Item: {
          name: 'string',
          category: '->Category',
        },
      })

      const category = await db.Category.create({ name: 'Electronics' })
      const item = await db.Item.create({ name: 'Phone', category: category.$id })

      // The item's category should resolve to the original category
      const resolvedCategory = await item.category
      expect(resolvedCategory.$id).toBe(category.$id)

      // The category's items should include the item
      const items = await category.items
      expect(items).toHaveLength(1)
      expect(items[0].$id).toBe(item.$id)
    })

    it('should handle nested backward refs', async () => {
      const { db } = DB({
        Store: {
          departments: ['<-Department'],
          name: 'string',
        },
        Department: {
          products: ['<-Product'],
          store: '->Store',
          name: 'string',
        },
        Product: {
          department: '->Department',
          name: 'string',
        },
      })

      const store = await db.Store.create({ name: 'SuperMart' })
      const department = await db.Department.create({ name: 'Electronics', store: store.$id })
      const product = await db.Product.create({ name: 'TV', department: department.$id })

      // Navigate the chain
      const storeDepartments = await store.departments
      expect(storeDepartments).toHaveLength(1)
      expect(storeDepartments[0].$id).toBe(department.$id)

      const departmentProducts = await department.products
      expect(departmentProducts).toHaveLength(1)
      expect(departmentProducts[0].$id).toBe(product.$id)
    })
  })

  describe('No duplicate creation with symmetric refs', () => {
    it('should not create duplicates with symmetric <- and ->', async () => {
      const { db } = DB({
        Parent: { children: ['->Child'] },
        Child: { parent: '<-Parent' },
      })

      const parent = await db.Parent.create({ name: 'P1' }, { cascade: true })
      const children = await parent.children

      expect(children.length).toBeGreaterThan(0)
      const child = children[0]
      const childParent = await child.parent
      expect(childParent.$id).toBe(parent.$id)
    })

    it('should maintain referential integrity with symmetric refs', async () => {
      const { db } = DB({
        Team: { members: ['<-Member.team'] },
        Member: { team: '->Team', name: 'string' },
      })

      const team = await db.Team.create({ name: 'Engineering' })
      const member = await db.Member.create({ name: 'Alice', team: team.$id })

      // Get team members via forward ref
      const teamMembers = await team.members

      // Verify no duplicate members were created
      const allMembers = await db.Member.list()
      expect(allMembers).toHaveLength(1)

      // The member's team ref should point back correctly
      const memberTeam = await member.team
      expect(memberTeam.$id).toBe(team.$id)
    })

    it('should handle bidirectional navigation consistently', async () => {
      const { db } = DB({
        Project: { tasks: ['<-Task'] },
        Task: { project: '->Project', title: 'string' },
      })

      const project = await db.Project.create({ name: 'Website Redesign' })
      const task1 = await db.Task.create({ title: 'Design mockups', project: project.$id })
      const task2 = await db.Task.create({ title: 'Implement UI', project: project.$id })

      // Navigate from project to tasks
      const projectTasks = await project.tasks
      expect(projectTasks).toHaveLength(2)

      // Navigate from each task back to project
      for (const task of projectTasks) {
        const taskProject = await task.project
        expect(taskProject.$id).toBe(project.$id)
      }

      // Ensure task1 and task2's project refs are correct
      const task1Project = await task1.project
      const task2Project = await task2.project
      expect(task1Project.$id).toBe(project.$id)
      expect(task2Project.$id).toBe(project.$id)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty backward ref arrays', async () => {
      const { db } = DB({
        Folder: { files: ['<-File'] },
        File: { folder: '->Folder', name: 'string' },
      })

      const folder = await db.Folder.create({ name: 'Empty Folder' })
      const files = await folder.files

      expect(files).toHaveLength(0)
      expect(Array.isArray(files)).toBe(true)
    })

    it('should handle <- with explicit backref', async () => {
      const { db } = DB({
        Company: { employees: ['<-Employee.employer'] },
        Employee: { employer: '->Company', name: 'string' },
      })

      const company = await db.Company.create({ name: 'TechCorp' })
      const employee = await db.Employee.create({ name: 'Bob', employer: company.$id })

      const companyEmployees = await company.employees
      expect(companyEmployees).toHaveLength(1)
      expect(companyEmployees[0].$id).toBe(employee.$id)
    })

    it('should handle self-referential <- edges', async () => {
      const { db } = DB({
        Node: {
          children: ['<-Node.parent'],
          parent: '->Node?',
        },
      })

      const root = await db.Node.create({ name: 'Root' })
      const child1 = await db.Node.create({ name: 'Child 1', parent: root.$id })
      const child2 = await db.Node.create({ name: 'Child 2', parent: root.$id })

      const rootChildren = await root.children
      expect(rootChildren).toHaveLength(2)

      const childIds = rootChildren.map((c: any) => c.$id)
      expect(childIds).toContain(child1.$id)
      expect(childIds).toContain(child2.$id)
    })
  })
})
