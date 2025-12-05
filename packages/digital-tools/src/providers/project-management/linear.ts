/**
 * Linear Project Management Provider
 *
 * Concrete implementation of ProjectManagementProvider using Linear GraphQL API.
 *
 * @packageDocumentation
 */

import type {
  ProjectManagementProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  PMProjectData,
  CreateIssueOptions,
  IssueData,
  IssueListOptions,
  IssueCommentData,
  PaginatedResult,
  PaginationOptions,
} from '../types.js'
import { defineProvider } from '../registry.js'

const LINEAR_API_URL = 'https://api.linear.app/graphql'

/**
 * Linear provider info
 */
export const linearInfo: ProviderInfo = {
  id: 'project-management.linear',
  name: 'Linear',
  description: 'Linear issue tracking and project management',
  category: 'project-management',
  website: 'https://linear.app',
  docsUrl: 'https://developers.linear.app',
  requiredConfig: ['apiKey'],
  optionalConfig: [],
}

/**
 * GraphQL query helper
 */
async function graphqlRequest<T = any>(
  apiKey: string,
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const response = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ query, variables }),
  })

  const result = (await response.json()) as any

  if (result.errors) {
    throw new Error(result.errors[0]?.message || 'GraphQL query failed')
  }

  return result.data as T
}

/**
 * Create Linear project management provider
 */
export function createLinearProvider(config: ProviderConfig): ProjectManagementProvider {
  let apiKey: string

  return {
    info: linearInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      apiKey = cfg.apiKey as string

      if (!apiKey) {
        throw new Error('Linear API key is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        await graphqlRequest(
          apiKey,
          `query { viewer { id name } }`
        )

        return {
          healthy: true,
          latencyMs: Date.now() - start,
          message: 'Connected',
          checkedAt: new Date(),
        }
      } catch (error) {
        return {
          healthy: false,
          latencyMs: Date.now() - start,
          message: error instanceof Error ? error.message : 'Unknown error',
          checkedAt: new Date(),
        }
      }
    },

    async dispose(): Promise<void> {
      // No cleanup needed
    },

    async listProjects(options?: PaginationOptions): Promise<PaginatedResult<PMProjectData>> {
      const first = options?.limit || 50
      const after = options?.cursor

      const query = `
        query($first: Int!, $after: String) {
          projects(first: $first, after: $after) {
            nodes {
              id
              key
              name
              description
              lead {
                id
              }
              url
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `

      const data = await graphqlRequest<{
        projects: {
          nodes: any[]
          pageInfo: { hasNextPage: boolean; endCursor: string }
        }
      }>(apiKey, query, { first, after })

      return {
        items: data.projects.nodes.map((p: any) => ({
          id: p.id,
          key: p.key,
          name: p.name,
          description: p.description,
          lead: p.lead?.id,
          url: p.url,
        })),
        hasMore: data.projects.pageInfo.hasNextPage,
        nextCursor: data.projects.pageInfo.endCursor,
      }
    },

    async getProject(projectId: string): Promise<PMProjectData | null> {
      const query = `
        query($id: String!) {
          project(id: $id) {
            id
            key
            name
            description
            lead {
              id
            }
            url
          }
        }
      `

      try {
        const data = await graphqlRequest<{ project: any }>(apiKey, query, { id: projectId })

        if (!data.project) {
          return null
        }

        return {
          id: data.project.id,
          key: data.project.key,
          name: data.project.name,
          description: data.project.description,
          lead: data.project.lead?.id,
          url: data.project.url,
        }
      } catch {
        return null
      }
    },

    async createIssue(projectId: string, issue: CreateIssueOptions): Promise<IssueData> {
      const query = `
        mutation($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue {
              id
              identifier
              title
              description
              state {
                name
              }
              priority
              priorityLabel
              labels {
                nodes {
                  name
                }
              }
              assignee {
                id
              }
              creator {
                id
              }
              createdAt
              updatedAt
              url
            }
          }
        }
      `

      const input: any = {
        projectId,
        title: issue.title,
        description: issue.description,
        ...(issue.type && { type: issue.type }),
        ...(issue.priority && { priority: parsePriority(issue.priority) }),
        ...(issue.assigneeId && { assigneeId: issue.assigneeId }),
        ...(issue.parentId && { parentId: issue.parentId }),
        ...(issue.estimate && { estimate: issue.estimate }),
      }

      if (issue.labels?.length) {
        input.labelIds = issue.labels
      }

      const data = await graphqlRequest<{
        issueCreate: { success: boolean; issue: any }
      }>(apiKey, query, { input })

      if (!data.issueCreate.success) {
        throw new Error('Failed to create issue')
      }

      const created = data.issueCreate.issue

      return {
        id: created.id,
        key: created.identifier,
        title: created.title,
        description: created.description,
        type: issue.type || 'Issue',
        status: created.state.name,
        priority: created.priorityLabel,
        labels: created.labels.nodes.map((l: any) => l.name),
        assigneeId: created.assignee?.id,
        reporterId: created.creator?.id,
        createdAt: new Date(created.createdAt),
        updatedAt: new Date(created.updatedAt),
        url: created.url,
      }
    },

    async getIssue(issueId: string): Promise<IssueData | null> {
      const query = `
        query($id: String!) {
          issue(id: $id) {
            id
            identifier
            title
            description
            state {
              name
            }
            priority
            priorityLabel
            labels {
              nodes {
                name
              }
            }
            assignee {
              id
            }
            creator {
              id
            }
            createdAt
            updatedAt
            url
          }
        }
      `

      try {
        const data = await graphqlRequest<{ issue: any }>(apiKey, query, { id: issueId })

        if (!data.issue) {
          return null
        }

        const issue = data.issue

        return {
          id: issue.id,
          key: issue.identifier,
          title: issue.title,
          description: issue.description,
          type: 'Issue',
          status: issue.state.name,
          priority: issue.priorityLabel,
          labels: issue.labels.nodes.map((l: any) => l.name),
          assigneeId: issue.assignee?.id,
          reporterId: issue.creator?.id,
          createdAt: new Date(issue.createdAt),
          updatedAt: new Date(issue.updatedAt),
          url: issue.url,
        }
      } catch {
        return null
      }
    },

    async updateIssue(issueId: string, updates: Partial<CreateIssueOptions>): Promise<IssueData> {
      const query = `
        mutation($id: String!, $input: IssueUpdateInput!) {
          issueUpdate(id: $id, input: $input) {
            success
            issue {
              id
              identifier
              title
              description
              state {
                name
              }
              priority
              priorityLabel
              labels {
                nodes {
                  name
                }
              }
              assignee {
                id
              }
              creator {
                id
              }
              createdAt
              updatedAt
              url
            }
          }
        }
      `

      const input: any = {}

      if (updates.title) input.title = updates.title
      if (updates.description !== undefined) input.description = updates.description
      if (updates.priority) input.priority = parsePriority(updates.priority)
      if (updates.assigneeId) input.assigneeId = updates.assigneeId
      if (updates.estimate !== undefined) input.estimate = updates.estimate

      const data = await graphqlRequest<{
        issueUpdate: { success: boolean; issue: any }
      }>(apiKey, query, { id: issueId, input })

      if (!data.issueUpdate.success) {
        throw new Error('Failed to update issue')
      }

      const updated = data.issueUpdate.issue

      return {
        id: updated.id,
        key: updated.identifier,
        title: updated.title,
        description: updated.description,
        type: 'Issue',
        status: updated.state.name,
        priority: updated.priorityLabel,
        labels: updated.labels.nodes.map((l: any) => l.name),
        assigneeId: updated.assignee?.id,
        reporterId: updated.creator?.id,
        createdAt: new Date(updated.createdAt),
        updatedAt: new Date(updated.updatedAt),
        url: updated.url,
      }
    },

    async deleteIssue(issueId: string): Promise<boolean> {
      const query = `
        mutation($id: String!) {
          issueDelete(id: $id) {
            success
          }
        }
      `

      try {
        const data = await graphqlRequest<{
          issueDelete: { success: boolean }
        }>(apiKey, query, { id: issueId })

        return data.issueDelete.success
      } catch {
        return false
      }
    },

    async listIssues(
      projectId: string,
      options?: IssueListOptions
    ): Promise<PaginatedResult<IssueData>> {
      const first = options?.limit || 50
      const after = options?.cursor

      // Build filter
      const filter: any = { project: { id: { eq: projectId } } }

      if (options?.status?.length) {
        filter.state = { name: { in: options.status } }
      }

      if (options?.assignee) {
        filter.assignee = { id: { eq: options.assignee } }
      }

      if (options?.labels?.length) {
        filter.labels = { name: { in: options.labels } }
      }

      const query = `
        query($first: Int!, $after: String, $filter: IssueFilter) {
          issues(first: $first, after: $after, filter: $filter) {
            nodes {
              id
              identifier
              title
              description
              state {
                name
              }
              priority
              priorityLabel
              labels {
                nodes {
                  name
                }
              }
              assignee {
                id
              }
              creator {
                id
              }
              createdAt
              updatedAt
              url
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `

      const data = await graphqlRequest<{
        issues: {
          nodes: any[]
          pageInfo: { hasNextPage: boolean; endCursor: string }
        }
      }>(apiKey, query, { first, after, filter })

      return {
        items: data.issues.nodes.map((issue: any) => ({
          id: issue.id,
          key: issue.identifier,
          title: issue.title,
          description: issue.description,
          type: 'Issue',
          status: issue.state.name,
          priority: issue.priorityLabel,
          labels: issue.labels.nodes.map((l: any) => l.name),
          assigneeId: issue.assignee?.id,
          reporterId: issue.creator?.id,
          createdAt: new Date(issue.createdAt),
          updatedAt: new Date(issue.updatedAt),
          url: issue.url,
        })),
        hasMore: data.issues.pageInfo.hasNextPage,
        nextCursor: data.issues.pageInfo.endCursor,
      }
    },

    async searchIssues(
      query: string,
      options?: IssueListOptions
    ): Promise<PaginatedResult<IssueData>> {
      const first = options?.limit || 50
      const after = options?.cursor

      const graphqlQuery = `
        query($first: Int!, $after: String, $filter: IssueFilter) {
          issueSearch(first: $first, after: $after, query: $query, filter: $filter) {
            nodes {
              id
              identifier
              title
              description
              state {
                name
              }
              priority
              priorityLabel
              labels {
                nodes {
                  name
                }
              }
              assignee {
                id
              }
              creator {
                id
              }
              createdAt
              updatedAt
              url
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `

      // Build filter
      const filter: any = {}

      if (options?.status?.length) {
        filter.state = { name: { in: options.status } }
      }

      if (options?.assignee) {
        filter.assignee = { id: { eq: options.assignee } }
      }

      if (options?.labels?.length) {
        filter.labels = { name: { in: options.labels } }
      }

      const data = await graphqlRequest<{
        issueSearch: {
          nodes: any[]
          pageInfo: { hasNextPage: boolean; endCursor: string }
        }
      }>(apiKey, graphqlQuery, { first, after, query, filter })

      return {
        items: data.issueSearch.nodes.map((issue: any) => ({
          id: issue.id,
          key: issue.identifier,
          title: issue.title,
          description: issue.description,
          type: 'Issue',
          status: issue.state.name,
          priority: issue.priorityLabel,
          labels: issue.labels.nodes.map((l: any) => l.name),
          assigneeId: issue.assignee?.id,
          reporterId: issue.creator?.id,
          createdAt: new Date(issue.createdAt),
          updatedAt: new Date(issue.updatedAt),
          url: issue.url,
        })),
        hasMore: data.issueSearch.pageInfo.hasNextPage,
        nextCursor: data.issueSearch.pageInfo.endCursor,
      }
    },

    async addComment(issueId: string, body: string): Promise<IssueCommentData> {
      const query = `
        mutation($input: CommentCreateInput!) {
          commentCreate(input: $input) {
            success
            comment {
              id
              body
              user {
                id
              }
              createdAt
            }
          }
        }
      `

      const data = await graphqlRequest<{
        commentCreate: { success: boolean; comment: any }
      }>(apiKey, query, {
        input: {
          issueId,
          body,
        },
      })

      if (!data.commentCreate.success) {
        throw new Error('Failed to create comment')
      }

      const comment = data.commentCreate.comment

      return {
        id: comment.id,
        issueId,
        body: comment.body,
        authorId: comment.user.id,
        createdAt: new Date(comment.createdAt),
      }
    },

    async transition(issueId: string, statusId: string): Promise<boolean> {
      const query = `
        mutation($id: String!, $stateId: String!) {
          issueUpdate(id: $id, input: { stateId: $stateId }) {
            success
          }
        }
      `

      try {
        const data = await graphqlRequest<{
          issueUpdate: { success: boolean }
        }>(apiKey, query, { id: issueId, stateId: statusId })

        return data.issueUpdate.success
      } catch {
        return false
      }
    },

    async assign(issueId: string, userId: string): Promise<boolean> {
      const query = `
        mutation($id: String!, $assigneeId: String!) {
          issueUpdate(id: $id, input: { assigneeId: $assigneeId }) {
            success
          }
        }
      `

      try {
        const data = await graphqlRequest<{
          issueUpdate: { success: boolean }
        }>(apiKey, query, { id: issueId, assigneeId: userId })

        return data.issueUpdate.success
      } catch {
        return false
      }
    },
  }
}

/**
 * Parse priority string to Linear priority number
 */
function parsePriority(priority: string): number {
  const map: Record<string, number> = {
    urgent: 1,
    high: 2,
    medium: 3,
    low: 4,
    none: 0,
  }

  return map[priority.toLowerCase()] ?? 0
}

/**
 * Linear provider definition
 */
export const linearProvider = defineProvider(linearInfo, async (config) =>
  createLinearProvider(config)
)
