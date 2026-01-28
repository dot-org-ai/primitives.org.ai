/**
 * GitHub Development Provider
 *
 * Concrete implementation of DevelopmentProvider using GitHub REST API v3.
 *
 * @packageDocumentation
 */

import type {
  DevelopmentProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderInfo,
  PaginatedResult,
  RepoListOptions,
  RepoData,
  CreateDevIssueOptions,
  DevIssueData,
  DevIssueListOptions,
  CreatePROptions,
  PRData,
  PRListOptions,
  DevCommentData,
} from '../types.js'
import { defineProvider } from '../registry.js'

const GITHUB_API_URL = 'https://api.github.com'

// =============================================================================
// GitHub API Response Types
// =============================================================================

/**
 * GitHub API user/owner object
 */
interface GitHubUser {
  login: string
  id: number
  avatar_url: string
  type: string
}

/**
 * GitHub API repository response
 */
interface GitHubRepository {
  id: number
  name: string
  full_name: string
  description: string | null
  private: boolean
  default_branch: string
  html_url: string
  clone_url: string
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  created_at: string
  updated_at: string
  owner: GitHubUser
}

/**
 * GitHub API label object
 */
interface GitHubLabel {
  id: number
  name: string
  color: string
  description: string | null
}

/**
 * GitHub API issue response
 */
interface GitHubIssue {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  html_url: string
  created_at: string
  updated_at: string
  closed_at: string | null
  user: GitHubUser
  labels: GitHubLabel[]
  assignees: GitHubUser[]
  pull_request?: {
    url: string
    html_url: string
  }
}

/**
 * GitHub API branch reference
 */
interface GitHubBranchRef {
  ref: string
  sha: string
  label: string
  user: GitHubUser
}

/**
 * GitHub API pull request response
 */
interface GitHubPullRequest {
  id: number
  number: number
  title: string
  body: string | null
  state: 'open' | 'closed'
  html_url: string
  created_at: string
  updated_at: string
  closed_at: string | null
  merged_at: string | null
  draft: boolean
  mergeable: boolean | null
  user: GitHubUser
  head: GitHubBranchRef
  base: GitHubBranchRef
}

/**
 * GitHub API comment response
 */
interface GitHubComment {
  id: number
  body: string
  created_at: string
  updated_at: string
  user: GitHubUser
}

/**
 * GitHub provider info
 */
export const githubInfo: ProviderInfo = {
  id: 'development.github',
  name: 'GitHub',
  description: 'GitHub development platform and version control service',
  category: 'development',
  website: 'https://github.com',
  docsUrl: 'https://docs.github.com/rest',
  requiredConfig: ['accessToken'],
  optionalConfig: ['baseUrl'],
}

/**
 * Create GitHub development provider
 */
export function createGitHubProvider(config: ProviderConfig): DevelopmentProvider {
  let accessToken: string
  let baseUrl: string

  return {
    info: githubInfo,

    async initialize(cfg: ProviderConfig): Promise<void> {
      accessToken = cfg.accessToken as string
      baseUrl = (cfg.baseUrl as string) || GITHUB_API_URL

      if (!accessToken) {
        throw new Error('GitHub access token is required')
      }
    },

    async healthCheck(): Promise<ProviderHealth> {
      const start = Date.now()
      try {
        const response = await fetch(`${baseUrl}/user`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        })

        return {
          healthy: response.ok,
          latencyMs: Date.now() - start,
          message: response.ok ? 'Connected' : `HTTP ${response.status}`,
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

    async listRepos(options?: RepoListOptions): Promise<PaginatedResult<RepoData>> {
      const params = new URLSearchParams()

      if (options?.visibility) {
        params.append('visibility', options.visibility)
      }
      if (options?.sort) {
        params.append('sort', options.sort)
      }
      if (options?.limit) {
        params.append('per_page', String(options.limit))
      }
      if (options?.cursor) {
        params.append('page', options.cursor)
      }

      const response = await fetch(`${baseUrl}/user/repos?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as GitHubRepository[]
      const repos: RepoData[] = data.map((repo) => ({
        id: String(repo.id),
        owner: repo.owner.login,
        name: repo.name,
        fullName: repo.full_name,
        ...(repo.description !== null && { description: repo.description }),
        private: repo.private,
        defaultBranch: repo.default_branch,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        openIssues: repo.open_issues_count,
        createdAt: new Date(repo.created_at),
        updatedAt: new Date(repo.updated_at),
      }))

      const linkHeader = response.headers.get('Link')
      const hasMore = linkHeader ? linkHeader.includes('rel="next"') : false
      const nextCursor = hasMore ? String(Number(options?.cursor || '1') + 1) : undefined

      return {
        items: repos,
        hasMore,
        ...(nextCursor !== undefined && { nextCursor }),
      }
    },

    async getRepo(owner: string, repo: string): Promise<RepoData | null> {
      const response = await fetch(`${baseUrl}/repos/${owner}/${repo}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as GitHubRepository
      return {
        id: String(data.id),
        owner: data.owner.login,
        name: data.name,
        fullName: data.full_name,
        ...(data.description !== null && { description: data.description }),
        private: data.private,
        defaultBranch: data.default_branch,
        url: data.html_url,
        cloneUrl: data.clone_url,
        stars: data.stargazers_count,
        forks: data.forks_count,
        openIssues: data.open_issues_count,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      }
    },

    async createIssue(
      owner: string,
      repo: string,
      issue: CreateDevIssueOptions
    ): Promise<DevIssueData> {
      const body = {
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
        assignees: issue.assignees,
        milestone: issue.milestone,
      }

      const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/issues`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as GitHubIssue
      return {
        id: String(data.id),
        number: data.number,
        title: data.title,
        ...(data.body !== null && { body: data.body }),
        state: data.state,
        labels: data.labels.map((l) => l.name),
        assignees: data.assignees.map((a) => a.login),
        authorId: data.user.login,
        url: data.html_url,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        ...(data.closed_at !== null && { closedAt: new Date(data.closed_at) }),
      }
    },

    async getIssue(owner: string, repo: string, issueNumber: number): Promise<DevIssueData | null> {
      const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as GitHubIssue
      return {
        id: String(data.id),
        number: data.number,
        title: data.title,
        ...(data.body !== null && { body: data.body }),
        state: data.state,
        labels: data.labels.map((l) => l.name),
        assignees: data.assignees.map((a) => a.login),
        authorId: data.user.login,
        url: data.html_url,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        ...(data.closed_at !== null && { closedAt: new Date(data.closed_at) }),
      }
    },

    async updateIssue(
      owner: string,
      repo: string,
      issueNumber: number,
      updates: Partial<CreateDevIssueOptions>
    ): Promise<DevIssueData> {
      const body: Record<string, unknown> = {}

      if (updates.title !== undefined) body['title'] = updates.title
      if (updates.body !== undefined) body['body'] = updates.body
      if (updates.labels !== undefined) body['labels'] = updates.labels
      if (updates.assignees !== undefined) body['assignees'] = updates.assignees
      if (updates.milestone !== undefined) body['milestone'] = updates.milestone

      const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as GitHubIssue
      return {
        id: String(data.id),
        number: data.number,
        title: data.title,
        ...(data.body !== null && { body: data.body }),
        state: data.state,
        labels: data.labels.map((l) => l.name),
        assignees: data.assignees.map((a) => a.login),
        authorId: data.user.login,
        url: data.html_url,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        ...(data.closed_at !== null && { closedAt: new Date(data.closed_at) }),
      }
    },

    async listIssues(
      owner: string,
      repo: string,
      options?: DevIssueListOptions
    ): Promise<PaginatedResult<DevIssueData>> {
      const params = new URLSearchParams()

      if (options?.state) {
        params.append('state', options.state)
      }
      if (options?.labels?.length) {
        params.append('labels', options.labels.join(','))
      }
      if (options?.assignee) {
        params.append('assignee', options.assignee)
      }
      if (options?.sort) {
        params.append('sort', options.sort)
      }
      if (options?.limit) {
        params.append('per_page', String(options.limit))
      }
      if (options?.cursor) {
        params.append('page', options.cursor)
      }

      const response = await fetch(
        `${baseUrl}/repos/${owner}/${repo}/issues?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as GitHubIssue[]
      const issues: DevIssueData[] = data
        .filter((item) => !item.pull_request) // Filter out PRs
        .map((issue) => ({
          id: String(issue.id),
          number: issue.number,
          title: issue.title,
          ...(issue.body !== null && { body: issue.body }),
          state: issue.state,
          labels: issue.labels.map((l) => l.name),
          assignees: issue.assignees.map((a) => a.login),
          authorId: issue.user.login,
          url: issue.html_url,
          createdAt: new Date(issue.created_at),
          updatedAt: new Date(issue.updated_at),
          ...(issue.closed_at !== null && { closedAt: new Date(issue.closed_at) }),
        }))

      const linkHeader = response.headers.get('Link')
      const hasMore = linkHeader ? linkHeader.includes('rel="next"') : false
      const nextCursor = hasMore ? String(Number(options?.cursor || '1') + 1) : undefined

      return {
        items: issues,
        hasMore,
        ...(nextCursor !== undefined && { nextCursor }),
      }
    },

    async createPullRequest(owner: string, repo: string, pr: CreatePROptions): Promise<PRData> {
      const body = {
        title: pr.title,
        body: pr.body,
        head: pr.head,
        base: pr.base,
        draft: pr.draft,
      }

      const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as GitHubPullRequest
      return {
        id: String(data.id),
        number: data.number,
        title: data.title,
        ...(data.body !== null && { body: data.body }),
        state: data.merged_at ? 'merged' : data.state,
        head: data.head.ref,
        base: data.base.ref,
        authorId: data.user.login,
        draft: data.draft,
        ...(data.mergeable !== null && { mergeable: data.mergeable }),
        url: data.html_url,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        ...(data.merged_at !== null && { mergedAt: new Date(data.merged_at) }),
        ...(data.closed_at !== null && { closedAt: new Date(data.closed_at) }),
      }
    },

    async getPullRequest(owner: string, repo: string, prNumber: number): Promise<PRData | null> {
      const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (response.status === 404) {
        return null
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as GitHubPullRequest
      return {
        id: String(data.id),
        number: data.number,
        title: data.title,
        ...(data.body !== null && { body: data.body }),
        state: data.merged_at ? 'merged' : data.state,
        head: data.head.ref,
        base: data.base.ref,
        authorId: data.user.login,
        draft: data.draft,
        ...(data.mergeable !== null && { mergeable: data.mergeable }),
        url: data.html_url,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        ...(data.merged_at !== null && { mergedAt: new Date(data.merged_at) }),
        ...(data.closed_at !== null && { closedAt: new Date(data.closed_at) }),
      }
    },

    async listPullRequests(
      owner: string,
      repo: string,
      options?: PRListOptions
    ): Promise<PaginatedResult<PRData>> {
      const params = new URLSearchParams()

      if (options?.state) {
        params.append('state', options.state)
      }
      if (options?.sort) {
        params.append('sort', options.sort)
      }
      if (options?.direction) {
        params.append('direction', options.direction)
      }
      if (options?.limit) {
        params.append('per_page', String(options.limit))
      }
      if (options?.cursor) {
        params.append('page', options.cursor)
      }

      const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/pulls?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as GitHubPullRequest[]
      const prs: PRData[] = data.map((pr) => ({
        id: String(pr.id),
        number: pr.number,
        title: pr.title,
        ...(pr.body !== null && { body: pr.body }),
        state: pr.merged_at ? 'merged' : pr.state,
        head: pr.head.ref,
        base: pr.base.ref,
        authorId: pr.user.login,
        draft: pr.draft,
        ...(pr.mergeable !== null && { mergeable: pr.mergeable }),
        url: pr.html_url,
        createdAt: new Date(pr.created_at),
        updatedAt: new Date(pr.updated_at),
        ...(pr.merged_at !== null && { mergedAt: new Date(pr.merged_at) }),
        ...(pr.closed_at !== null && { closedAt: new Date(pr.closed_at) }),
      }))

      const linkHeader = response.headers.get('Link')
      const hasMore = linkHeader ? linkHeader.includes('rel="next"') : false
      const nextCursor = hasMore ? String(Number(options?.cursor || '1') + 1) : undefined

      return {
        items: prs,
        hasMore,
        ...(nextCursor !== undefined && { nextCursor }),
      }
    },

    async mergePullRequest(owner: string, repo: string, prNumber: number): Promise<boolean> {
      const response = await fetch(`${baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      return response.ok
    },

    async addComment(
      owner: string,
      repo: string,
      issueNumber: number,
      body: string
    ): Promise<DevCommentData> {
      const response = await fetch(
        `${baseUrl}/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ body }),
        }
      )

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as GitHubComment
      return {
        id: String(data.id),
        body: data.body,
        authorId: data.user.login,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      }
    },
  }
}

/**
 * GitHub provider definition
 */
export const githubProvider = defineProvider(githubInfo, async (config) =>
  createGitHubProvider(config)
)
